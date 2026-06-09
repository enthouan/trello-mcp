import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { TrelloClient } from "../src/trello/client.js";
import {
  AuthError,
  NotFoundError,
  RateLimitError,
  TrelloApiError,
  ValidationError,
} from "../src/utils/errors.js";

const config = { TRELLO_API_KEY: "key", TRELLO_TOKEN: "token" };
const OkSchema = z.object({ ok: z.boolean() });
const AttachmentSchema = z.object({ id: z.string(), name: z.string() });

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "content-type": "application/json" },
  });
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

  it.each([
    [401, AuthError],
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
});
