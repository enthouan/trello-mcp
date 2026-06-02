import type { z } from "zod";
import type { Config } from "../config.js";
import {
  AuthError,
  NotFoundError,
  RateLimitError,
  TrelloApiError,
} from "../utils/errors.js";

const TRELLO_API_BASE_URL = "https://api.trello.com/1";
const DEFAULT_CAPACITY = 100;
const DEFAULT_REFILL_INTERVAL_MS = 10_000;
const MAX_ATTEMPTS = 3;

type Fetcher = typeof fetch;

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: Record<string, unknown>;
  resourceType?: string;
  resourceId?: string;
};

type RateLimitOptions = {
  capacity?: number;
  refillIntervalMs?: number;
};

type TrelloClientOptions = {
  fetcher?: Fetcher;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  rateLimit?: RateLimitOptions;
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

  public async take(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.max(
      1,
      this.refillIntervalMs - (Date.now() - this.updatedAt),
    );
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

  public constructor(
    private readonly config: Pick<Config, "TRELLO_API_KEY" | "TRELLO_TOKEN">,
    options: TrelloClientOptions = {},
  ) {
    this.fetcher = options.fetcher ?? fetch;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.bucket = new TokenBucket(
      options.rateLimit?.capacity ?? DEFAULT_CAPACITY,
      options.rateLimit?.refillIntervalMs ?? DEFAULT_REFILL_INTERVAL_MS,
      this.sleep,
    );
  }

  public async request<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    options: RequestOptions = {},
  ): Promise<z.infer<TSchema>> {
    const url = this.buildUrl(path, options.query);
    const init: RequestInit = {
      method: options.method ?? "GET",
      ...(options.body
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(options.body),
          }
        : {}),
    };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      await this.bucket.take();
      let response: Response;
      try {
        response = await this.fetcher(url, init);
      } catch {
        throw new TrelloApiError(0, "Unable to reach Trello API.");
      }

      if (response.status === 429 && attempt < MAX_ATTEMPTS) {
        await this.sleep(this.backoffMs(attempt));
        continue;
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

  private buildUrl(path: string, query: RequestOptions["query"]): URL {
    const url = new URL(
      `${TRELLO_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
    );
    url.searchParams.set("key", this.config.TRELLO_API_KEY);
    url.searchParams.set("token", this.config.TRELLO_TOKEN);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
    return url;
  }

  private backoffMs(attempt: number): number {
    return Math.min(
      2_000,
      100 * 2 ** (attempt - 1) + Math.floor(this.random() * 100),
    );
  }

  private async errorForResponse(
    response: Response,
    options: RequestOptions,
  ): Promise<Error> {
    const trelloMessage = await this.errorMessage(response);
    if (response.status === 401) {
      return new AuthError(
        "Trello authentication failed; check TRELLO_API_KEY and TRELLO_TOKEN.",
      );
    }
    if (response.status === 404) {
      return new NotFoundError(
        `${options.resourceType ?? "Trello resource"} not found.`,
        {
          resourceType: options.resourceType,
          resourceId: options.resourceId,
        },
      );
    }
    if (response.status === 429) {
      return new RateLimitError("Trello rate limit exceeded; try again later.");
    }
    return new TrelloApiError(response.status, trelloMessage, {
      status: response.status,
    });
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
