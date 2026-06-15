import { AsyncLocalStorage } from "node:async_hooks";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative } from "node:path";
import type { z } from "zod";
import type { Config } from "../config.js";
import {
  AuthError,
  type ErrorDetails,
  NotFoundError,
  PermissionError,
  RateLimitError,
  TrelloApiError,
  ValidationError,
} from "../utils/errors.js";
import type { Logger } from "../utils/logger.js";

const TRELLO_API_BASE_URL = "https://api.trello.com/1";
const DEFAULT_CAPACITY = 100;
const DEFAULT_REFILL_INTERVAL_MS = 10_000;
const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 100;
const DEFAULT_RETRY_MAX_DELAY_MS = 2_000;

type Fetcher = typeof fetch;

type LocalFileRequest = {
  fieldName?: string;
  filePath: string;
  filename?: string;
  mimeType?: string;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: Record<string, unknown>;
  form?: Record<string, string | number | boolean | null | undefined>;
  file?: LocalFileRequest;
  resourceType?: string;
  resourceId?: string;
};

type RateLimitOptions = {
  capacity?: number;
  refillIntervalMs?: number;
};

type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

type TrelloClientOptions = {
  fetcher?: Fetcher;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  rateLimit?: RateLimitOptions;
  retry?: RetryOptions;
  logger?: Logger;
};

type RequestLogFields = {
  method: string;
  resourceType?: string;
  resourceId?: string;
};

class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  public constructor(
    private readonly capacity: number,
    private readonly refillIntervalMs: number,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {
    this.tokens = capacity;
    this.updatedAt = Date.now();
  }

  public async take(onWait?: (waitMs: number) => void): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.max(
      1,
      this.refillIntervalMs - (Date.now() - this.updatedAt),
    );
    onWait?.(waitMs);
    await this.sleep(waitMs);
    this.refill(true);
    this.tokens = Math.max(0, this.tokens - 1);
  }

  private refill(force = false): void {
    const now = Date.now();
    if (force || now - this.updatedAt >= this.refillIntervalMs) {
      this.tokens = this.capacity;
      this.updatedAt = now;
    }
  }
}

export class TrelloClient {
  private readonly fetcher: Fetcher;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly bucket: TokenBucket;
  private readonly retry: Required<RetryOptions>;
  private readonly logger: Logger | undefined;
  private readonly loggerContext = new AsyncLocalStorage<Logger>();

  public constructor(
    private readonly config: Pick<
      Config,
      "TRELLO_API_KEY" | "TRELLO_TOKEN" | "TRELLO_ATTACHMENT_UPLOAD_ROOT"
    >,
    options: TrelloClientOptions = {},
  ) {
    this.fetcher = options.fetcher ?? fetch;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.retry = {
      maxAttempts: options.retry?.maxAttempts ?? DEFAULT_RETRY_MAX_ATTEMPTS,
      baseDelayMs: options.retry?.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
      maxDelayMs: options.retry?.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS,
    };
    this.logger = options.logger;
    this.bucket = new TokenBucket(
      options.rateLimit?.capacity ?? DEFAULT_CAPACITY,
      options.rateLimit?.refillIntervalMs ?? DEFAULT_REFILL_INTERVAL_MS,
      this.sleep,
    );
  }

  public async withLogger<T>(
    logger: Logger,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.loggerContext.run(logger, operation);
  }

  public async request<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    options: RequestOptions = {},
  ): Promise<z.infer<TSchema>> {
    const url = this.buildUrl(path, options.query);
    const init = await this.buildRequestInit(options);
    const logger = this.requestLogger();
    const logFields = this.requestLogFields(options, init);

    for (let attempt = 1; attempt <= this.retry.maxAttempts; attempt += 1) {
      await this.bucket.take((waitMs) => {
        logger?.debug(
          {
            ...logFields,
            waitMs,
          },
          "trello rate limit wait",
        );
      });
      let response: Response;
      try {
        response = await this.fetcher(url, init);
      } catch {
        throw new TrelloApiError(0, "Unable to reach Trello API.");
      }

      if (response.status === 429 && attempt < this.retry.maxAttempts) {
        const waitMs = this.backoffMs(attempt);
        logger?.warn(
          {
            ...logFields,
            statusCode: response.status,
            attempt,
            maxAttempts: this.retry.maxAttempts,
            waitMs,
          },
          "trello request rate limited; retrying",
        );
        await this.sleep(waitMs);
        continue;
      }

      if (response.status === 429) {
        logger?.warn(
          {
            ...logFields,
            statusCode: response.status,
            attempt,
            maxAttempts: this.retry.maxAttempts,
          },
          "trello request rate limited; retry attempts exhausted",
        );
      }

      if (!response.ok) {
        throw await this.errorForResponse(response, options);
      }

      const data = await this.parseJson(response);
      return schema.parse(data);
    }

    throw new RateLimitError(
      "Trello rate limit persisted after retries; try again later.",
    );
  }

  public async requestConfiguredToken<TSchema extends z.ZodType>(
    schema: TSchema,
    options: Pick<RequestOptions, "query"> = {},
  ): Promise<z.infer<TSchema>> {
    return this.request(
      `/tokens/${encodeURIComponent(this.config.TRELLO_TOKEN)}`,
      schema,
      {
        ...(options.query ? { query: options.query } : {}),
        resourceType: "configured Trello token",
        resourceId: "configured token",
      },
    );
  }

  private buildUrl(path: string, query: RequestOptions["query"]): URL {
    const url = new URL(
      `${TRELLO_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
    );
    url.searchParams.set("key", this.config.TRELLO_API_KEY);
    url.searchParams.set("token", this.config.TRELLO_TOKEN);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, value === null ? "null" : String(value));
      }
    }
    return url;
  }

  private async buildRequestInit(
    options: RequestOptions,
  ): Promise<RequestInit> {
    if (options.body && (options.file || options.form)) {
      throw new ValidationError(
        "Use either a JSON body or multipart form data, not both.",
      );
    }

    if (options.file || options.form) {
      const form = new FormData();
      for (const [key, value] of Object.entries(options.form ?? {})) {
        if (value !== undefined) {
          form.set(key, value === null ? "null" : String(value));
        }
      }

      if (options.file) {
        const { blob, filename } = await this.localFileBlob(options.file);
        form.set(options.file.fieldName ?? "file", blob, filename);
      }

      return {
        method: options.method ?? "GET",
        body: form,
      };
    }

    return {
      method: options.method ?? "GET",
      ...(options.body
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(options.body),
          }
        : {}),
    };
  }

  private async localFileBlob(
    file: LocalFileRequest,
  ): Promise<{ blob: Blob; filename: string }> {
    const root = this.config.TRELLO_ATTACHMENT_UPLOAD_ROOT;
    if (!root) {
      throw new ValidationError(
        "Local attachment uploads are disabled; set TRELLO_ATTACHMENT_UPLOAD_ROOT to a server-readable directory.",
      );
    }

    const rootPath = await this.checkedUploadRoot(root);
    const requestedPath = isAbsolute(file.filePath)
      ? file.filePath
      : join(rootPath, file.filePath);
    const filePath = await this.checkedUploadFilePath(rootPath, requestedPath);
    const bytes = await readFile(filePath);
    const blob =
      file.mimeType === undefined
        ? new Blob([bytes])
        : new Blob([bytes], { type: file.mimeType });

    return {
      blob,
      filename: file.filename ?? basename(filePath),
    };
  }

  private async checkedUploadRoot(root: string): Promise<string> {
    let rootPath: string;
    try {
      rootPath = await realpath(root);
    } catch {
      throw new ValidationError(
        "TRELLO_ATTACHMENT_UPLOAD_ROOT must point to an existing directory.",
      );
    }

    const rootStats = await stat(rootPath);
    if (!rootStats.isDirectory()) {
      throw new ValidationError(
        "TRELLO_ATTACHMENT_UPLOAD_ROOT must point to a directory.",
      );
    }

    return rootPath;
  }

  private async checkedUploadFilePath(
    rootPath: string,
    requestedPath: string,
  ): Promise<string> {
    let filePath: string;
    try {
      filePath = await realpath(requestedPath);
    } catch {
      throw new ValidationError(
        "Attachment file must exist inside TRELLO_ATTACHMENT_UPLOAD_ROOT.",
      );
    }

    const relativePath = relative(rootPath, filePath);
    if (
      relativePath === "" ||
      relativePath.startsWith("..") ||
      isAbsolute(relativePath)
    ) {
      throw new ValidationError(
        "Attachment file must be inside TRELLO_ATTACHMENT_UPLOAD_ROOT.",
      );
    }

    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      throw new ValidationError("Attachment path must point to a file.");
    }

    return filePath;
  }

  private backoffMs(attempt: number): number {
    const exponentialDelayMs = this.retry.baseDelayMs * 2 ** (attempt - 1);
    const jitterMs = Math.floor(this.random() * this.retry.baseDelayMs);
    return Math.min(this.retry.maxDelayMs, exponentialDelayMs + jitterMs);
  }

  private requestLogger(): Logger | undefined {
    return this.loggerContext.getStore() ?? this.logger;
  }

  private requestLogFields(
    options: RequestOptions,
    init: RequestInit,
  ): RequestLogFields {
    const resourceId = options.resourceId
      ? safeLogResourceId(options.resourceId)
      : undefined;
    return {
      method: init.method ?? options.method ?? "GET",
      ...(options.resourceType ? { resourceType: options.resourceType } : {}),
      ...(resourceId ? { resourceId } : {}),
    };
  }

  private async errorForResponse(
    response: Response,
    options: RequestOptions,
  ): Promise<Error> {
    const trelloMessage = await this.errorMessage(response);
    if (response.status === 401) {
      return new AuthError(
        "Trello authentication failed; check TRELLO_API_KEY and TRELLO_TOKEN, then run auth_whoami or auth_token_info to confirm the configured member and token permissions.",
        this.errorDetails(response, options),
      );
    }
    if (response.status === 403) {
      return new PermissionError(
        `Trello denied access to ${this.resourceLabel(options)}; the configured token is valid but lacks the required permission. Confirm the authenticated member can access the relevant board or workspace and has the necessary role, including admin rights for admin-only operations.`,
        this.errorDetails(response, options, trelloMessage),
      );
    }
    if (response.status === 404) {
      return new NotFoundError(
        `Trello ${this.resourceLabel(options)} was not found or is not visible to the configured token; check the id and confirm the authenticated member has access to the private board, workspace, or member resource.`,
        this.errorDetails(response, options, trelloMessage),
      );
    }
    if (response.status === 429) {
      return new RateLimitError("Trello rate limit exceeded; try again later.");
    }
    return new TrelloApiError(
      response.status,
      trelloMessage,
      this.errorDetails(response, options),
    );
  }

  private resourceLabel(options: RequestOptions): string {
    const resourceType = options.resourceType ?? "resource";
    if (!options.resourceId) {
      return resourceType;
    }
    return `${resourceType} ${options.resourceId}`;
  }

  private errorDetails(
    response: Response,
    options: RequestOptions,
    trelloMessage?: string,
  ): ErrorDetails {
    return {
      status: response.status,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      trelloMessage,
    };
  }

  private async errorMessage(response: Response): Promise<string> {
    const text = await response.text();
    if (!text) {
      return `Trello API returned HTTP ${response.status}.`;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "message" in parsed &&
        typeof parsed.message === "string"
      ) {
        return parsed.message;
      }
    } catch {
      // Trello often returns plain text errors; use the text below.
    }
    return text;
  }

  private async parseJson(response: Response): Promise<unknown> {
    const text = await response.text();
    return text ? (JSON.parse(text) as unknown) : null;
  }
}

function safeLogResourceId(resourceId: string): string | undefined {
  const value = resourceId.trim();
  if (!value) {
    return undefined;
  }

  const urlIdentifier = trelloIdentifierFromUrl(value);
  if (urlIdentifier) {
    return urlIdentifier;
  }

  if (isUnsafeLogResourceId(value)) {
    return "[redacted]";
  }

  return value;
}

function trelloIdentifierFromUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (
      url.hostname.endsWith("trello.com") &&
      ["b", "c", "w"].includes(pathParts[0] ?? "") &&
      pathParts[1]
    ) {
      return pathParts[1];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function isUnsafeLogResourceId(value: string): boolean {
  return (
    value.includes("?") ||
    value.includes("#") ||
    value.includes("/") ||
    /(?:^|[?&#\s])(?:key|token|authorization)\s*=/i.test(value)
  );
}
