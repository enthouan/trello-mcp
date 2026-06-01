import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { TrelloClient } from "../src/trello/client.js";
import {
  AuthError,
  NotFoundError,
  RateLimitError,
  TrelloApiError,
} from "../src/utils/errors.js";

const config = { TRELLO_API_KEY: "key", TRELLO_TOKEN: "token" };
const OkSchema = z.object({ ok: z.boolean() });

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
