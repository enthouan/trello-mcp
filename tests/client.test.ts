import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { TrelloClient } from "../src/trello/client.js";
import {
  AuthError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  TrelloApiError,
  ValidationError,
} from "../src/utils/errors.js";
import { createLogger } from "../src/utils/logger.js";

const config = { TRELLO_API_KEY: "key", TRELLO_TOKEN: "token" };
const OkSchema = z.object({ ok: z.boolean() });
const AttachmentSchema = z.object({ id: z.string(), name: z.string() });
const collaborationErrorCases = [
  {
    status: 401,
    ErrorClass: AuthError,
    messageFragment: "auth_whoami or auth_token_info",
    trelloMessage: "invalid token",
  },
  {
    status: 403,
    ErrorClass: PermissionError,
    messageFragment: "lacks the required permission",
    trelloMessage: "insufficient permissions",
  },
  {
    status: 404,
    ErrorClass: NotFoundError,
    messageFragment: "not found or is not visible",
    trelloMessage: "model not found",
  },
] as const;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "content-type": "application/json" },
  });
}

function captureLogger() {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  const logger = createLogger({ LOG_LEVEL: "debug" }, stream);
  return {
    logger,
    output: async () => {
      await new Promise((resolve) => setImmediate(resolve));
      return output;
    },
  };
}

describe("TrelloClient", () => {
  it("attaches auth credentials and parses response schemas", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
    const client = new TrelloClient(config, { fetcher });

    const result = await client.request("/cards/abc", OkSchema, {
      query: { fields: "name" },
    });

    expect(result).toEqual({ ok: true });
    const calledUrl = fetcher.mock.calls[0]?.[0];
    expect(calledUrl).toBeInstanceOf(URL);
    if (!(calledUrl instanceof URL)) {
      throw new TypeError("Expected fetcher to be called with a URL");
    }
    expect(calledUrl.searchParams.get("key")).toBe("key");
    expect(calledUrl.searchParams.get("token")).toBe("token");
    expect(calledUrl.searchParams.get("fields")).toBe("name");
  });

  it("preserves null query values for Trello clear operations", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
    const client = new TrelloClient(config, { fetcher });

    await client.request("/cards/card1/checkItem/item1", OkSchema, {
      query: { due: null, dueReminder: null, idMember: null, pos: undefined },
    });

    const calledUrl = fetcher.mock.calls[0]?.[0];
    expect(calledUrl).toBeInstanceOf(URL);
    if (!(calledUrl instanceof URL)) {
      throw new TypeError("Expected fetcher to be called with a URL");
    }
    expect(calledUrl.searchParams.get("due")).toBe("null");
    expect(calledUrl.searchParams.get("dueReminder")).toBe("null");
    expect(calledUrl.searchParams.get("idMember")).toBe("null");
    expect(calledUrl.searchParams.has("pos")).toBe(false);
  });

  it("requests configured token diagnostics without exposing the token as resource metadata", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ id: "tokenRecord1", idMember: "member1" }),
    );
    const client = new TrelloClient(
      { ...config, TRELLO_TOKEN: "secret token" },
      { fetcher },
    );

    await expect(
      client.requestConfiguredToken(
        z.object({ id: z.string(), idMember: z.string() }),
        { query: { fields: "id,idMember" } },
      ),
    ).resolves.toEqual({ id: "tokenRecord1", idMember: "member1" });

    const calledUrl = fetcher.mock.calls[0]?.[0];
    expect(calledUrl).toBeInstanceOf(URL);
    if (!(calledUrl instanceof URL)) {
      throw new TypeError("Expected fetcher to be called with a URL");
    }
    expect(calledUrl.pathname).toBe("/1/tokens/secret%20token");
    expect(calledUrl.searchParams.get("fields")).toBe("id,idMember");
  });

  it("uses redacted resource metadata for configured token not found errors", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "not found" }), {
          status: 404,
        }),
    );
    const client = new TrelloClient(
      { ...config, TRELLO_TOKEN: "secret-token" },
      { fetcher },
    );

    await expect(
      client.requestConfiguredToken(z.object({ id: z.string() })),
    ).rejects.toMatchObject({
      details: {
        resourceType: "configured Trello token",
        resourceId: "configured token",
      },
    });
  });

  it("builds multipart requests for attachment uploads inside the configured root", async () => {
    const uploadRoot = await mkdtemp(join(tmpdir(), "trello-mcp-upload-"));
    const uploadPath = join(uploadRoot, "note.txt");
    await writeFile(uploadPath, "hello upload", "utf8");
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ id: "attachment1", name: "Display name" }),
    );
    const client = new TrelloClient(
      {
        ...config,
        TRELLO_ATTACHMENT_UPLOAD_ROOT: uploadRoot,
      },
      { fetcher },
    );

    try {
      const result = await client.request(
        "/cards/card1/attachments",
        AttachmentSchema,
        {
          method: "POST",
          form: {
            name: "Display name",
            mimeType: "text/plain",
            setCover: true,
          },
          file: {
            filePath: "note.txt",
            mimeType: "text/plain",
          },
        },
      );

      expect(result).toEqual({ id: "attachment1", name: "Display name" });
      const calledUrl = fetcher.mock.calls[0]?.[0];
      expect(calledUrl).toBeInstanceOf(URL);
      if (!(calledUrl instanceof URL)) {
        throw new TypeError("Expected fetcher to be called with a URL");
      }
      expect(calledUrl.searchParams.get("key")).toBe("key");
      expect(calledUrl.searchParams.get("token")).toBe("token");

      const init = fetcher.mock.calls[0]?.[1];
      expect(init?.method).toBe("POST");
      expect(init?.headers).toBeUndefined();
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init?.body as FormData;
      expect(form.get("name")).toBe("Display name");
      expect(form.get("mimeType")).toBe("text/plain");
      expect(form.get("setCover")).toBe("true");
      const file = form.get("file");
      expect(file).toBeInstanceOf(Blob);
      expect(file).toHaveProperty("name", "note.txt");
      expect(file).toHaveProperty("type", "text/plain");
      expect(await (file as Blob).text()).toBe("hello upload");
    } finally {
      await rm(uploadRoot, { force: true, recursive: true });
    }
  });

  it("rejects attachment uploads until an upload root is configured", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
    const client = new TrelloClient(config, { fetcher });

    await expect(
      client.request("/cards/card1/attachments", OkSchema, {
        method: "POST",
        file: { filePath: "/tmp/note.txt" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects attachment upload paths outside the configured root", async () => {
    const uploadRoot = await mkdtemp(join(tmpdir(), "trello-mcp-upload-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "trello-mcp-outside-"));
    const outsidePath = join(outsideRoot, "secret.txt");
    await writeFile(outsidePath, "do not upload", "utf8");
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
    const client = new TrelloClient(
      {
        ...config,
        TRELLO_ATTACHMENT_UPLOAD_ROOT: uploadRoot,
      },
      { fetcher },
    );

    try {
      await expect(
        client.request("/cards/card1/attachments", OkSchema, {
          method: "POST",
          file: { filePath: outsidePath },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      await rm(uploadRoot, { force: true, recursive: true });
      await rm(outsideRoot, { force: true, recursive: true });
    }
  });

  it("throttles through the token bucket", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ok: true }));
    const sleep = vi.fn(async () => undefined);
    const client = new TrelloClient(config, {
      fetcher,
      sleep,
      rateLimit: { capacity: 1, refillIntervalMs: 10_000 },
    });

    await client.request("/one", OkSchema);
    await client.request("/two", OkSchema);

    expect(sleep).toHaveBeenCalledWith(expect.any(Number));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("uses configured token-bucket capacity and refill interval", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ok: true }));
    const sleep = vi.fn(async () => undefined);
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const client = new TrelloClient(config, {
      fetcher,
      sleep,
      rateLimit: { capacity: 2, refillIntervalMs: 1_234 },
    });

    try {
      await client.request("/one", OkSchema);
      await client.request("/two", OkSchema);
      await client.request("/three", OkSchema);
    } finally {
      now.mockRestore();
    }

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1_234);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("retries HTTP 429 with backoff and eventually succeeds", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn(async () => undefined);
    const client = new TrelloClient(config, {
      fetcher,
      sleep,
      random: () => 0,
    });

    await expect(client.request("/cards/abc", OkSchema)).resolves.toEqual({
      ok: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it("uses configured retry max attempts", async () => {
    const fetcher = vi.fn(
      async () => new Response("rate limited", { status: 429 }),
    );
    const sleep = vi.fn(async () => undefined);
    const client = new TrelloClient(config, {
      fetcher,
      sleep,
      random: () => 0,
      retry: { maxAttempts: 2 },
    });

    await expect(client.request("/cards/abc", OkSchema)).rejects.toBeInstanceOf(
      RateLimitError,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("uses configured retry base delay with deterministic jitter", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn(async () => undefined);
    const client = new TrelloClient(config, {
      fetcher,
      sleep,
      random: () => 0.5,
      retry: { baseDelayMs: 250, maxDelayMs: 1_000 },
    });

    await expect(client.request("/cards/abc", OkSchema)).resolves.toEqual({
      ok: true,
    });
    expect(sleep).toHaveBeenCalledWith(375);
  });

  it("caps configured retry delays", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn(async () => undefined);
    const client = new TrelloClient(config, {
      fetcher,
      sleep,
      random: () => 0.75,
      retry: { baseDelayMs: 1_000, maxDelayMs: 500 },
    });

    await expect(client.request("/cards/abc", OkSchema)).resolves.toEqual({
      ok: true,
    });
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it("surfaces a distinct RateLimitError after retry cap", async () => {
    const fetcher = vi.fn(
      async () => new Response("rate limited", { status: 429 }),
    );
    const client = new TrelloClient(config, {
      fetcher,
      sleep: async () => undefined,
      random: () => 0,
    });

    await expect(client.request("/cards/abc", OkSchema)).rejects.toBeInstanceOf(
      RateLimitError,
    );
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("logs retry and rate-limit wait events with safe metadata", async () => {
    const { logger, output } = captureLogger();
    const secretConfig = {
      TRELLO_API_KEY: "retry-key-secret",
      TRELLO_TOKEN: "retry-token-secret",
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockImplementation(async () => jsonResponse({ ok: true }));
    const sleep = vi.fn(async () => undefined);
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const client = new TrelloClient(secretConfig, {
      fetcher,
      sleep,
      random: () => 0,
      logger,
      rateLimit: { capacity: 1, refillIntervalMs: 1_234 },
      retry: { maxAttempts: 2 },
    });

    try {
      await client.request("/cards/abc", OkSchema, {
        resourceType: "card",
        resourceId: "abc",
      });
      await client.request("/cards/def", OkSchema, {
        method: "POST",
        resourceType: "card",
        resourceId: "def",
      });
    } finally {
      now.mockRestore();
    }

    const logs = await output();
    expect(logs).toContain("trello request rate limited; retrying");
    expect(logs).toContain("trello rate limit wait");
    expect(logs).toContain('"statusCode":429');
    expect(logs).toContain('"attempt":1');
    expect(logs).toContain('"maxAttempts":2');
    expect(logs).toContain('"waitMs":1234');
    expect(logs).toContain('"method":"POST"');
    expect(logs).toContain('"resourceType":"card"');
    expect(logs).toContain('"resourceId":"def"');
    expect(logs).not.toContain("retry-key-secret");
    expect(logs).not.toContain("retry-token-secret");
    expect(logs).not.toContain("https://api.trello.com");
    expect(logs).not.toContain("key=");
    expect(logs).not.toContain("token=");
    expect(logs).not.toContain("/cards/");
  });

  it("uses request-scoped loggers for retry observability", async () => {
    const baseLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
    };
    const scopedLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = new TrelloClient(config, {
      fetcher,
      sleep: async () => undefined,
      random: () => 0,
      logger: baseLogger as never,
    });

    await client.withLogger(scopedLogger as never, () =>
      client.request("/cards/abc", OkSchema),
    );

    expect(scopedLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        attempt: 1,
        maxAttempts: 3,
        waitMs: 100,
      }),
      "trello request rate limited; retrying",
    );
    expect(baseLogger.warn).not.toHaveBeenCalled();
  });

  it("does not log credentials, authenticated URLs, or configured-token paths", async () => {
    const { logger, output } = captureLogger();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        jsonResponse({ id: "tokenRecord1", idMember: "member1" }),
      );
    const client = new TrelloClient(
      {
        TRELLO_API_KEY: "trello-key-secret",
        TRELLO_TOKEN: "configured-token-secret",
      },
      {
        fetcher,
        sleep: async () => undefined,
        random: () => 0,
        logger,
        retry: { maxAttempts: 2 },
      },
    );

    await client.requestConfiguredToken(
      z.object({ id: z.string(), idMember: z.string() }),
      { query: { fields: "id,idMember" } },
    );

    const logs = await output();
    expect(logs).toContain("trello request rate limited; retrying");
    expect(logs).not.toContain("trello-key-secret");
    expect(logs).not.toContain("configured-token-secret");
    expect(logs).not.toContain("https://api.trello.com");
    expect(logs).not.toContain("key=");
    expect(logs).not.toContain("token=");
    expect(logs).not.toContain("/tokens/");
  });

  it.each([
    [401, AuthError],
    [403, PermissionError],
    [404, NotFoundError],
    [500, TrelloApiError],
  ])("maps HTTP %i to typed errors", async (status, ErrorClass) => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ message: "bad" }), { status }),
    );
    const client = new TrelloClient(config, { fetcher });

    await expect(
      client.request("/cards/abc", OkSchema, {
        resourceType: "card",
        resourceId: "abc",
      }),
    ).rejects.toBeInstanceOf(ErrorClass);
  });

  it.each(
    collaborationErrorCases,
  )("surfaces actionable HTTP $status errors for board collaboration workflows", async ({
    status,
    ErrorClass,
    messageFragment,
    trelloMessage,
  }) => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: trelloMessage }), { status }),
    );
    const client = new TrelloClient(config, { fetcher });

    let thrown: unknown;
    try {
      await client.request(
        "/boards/private-board/memberships",
        z.array(z.unknown()),
        {
          resourceType: "board",
          resourceId: "private-board",
        },
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ErrorClass);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain(messageFragment);
    expect(thrown).toMatchObject({
      details: {
        status,
        resourceType: "board",
        resourceId: "private-board",
      },
    });
  });
});
