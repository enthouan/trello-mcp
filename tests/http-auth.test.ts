import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { handleHealth, writeJson } from "../src/health.js";
import {
  authorizeHttpMcpRequest,
  extractBearerToken,
  timingSafeStringEqual,
} from "../src/http-auth.js";

type TestAuthConfig = Parameters<typeof authorizeHttpMcpRequest>[0];

const servers: ReturnType<typeof createServer>[] = [];

async function closeServers(): Promise<void> {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
}

async function startAuthServer(config: TestAuthConfig): Promise<{
  bodyReadCount: () => number;
  url: string;
}> {
  let bodyReads = 0;
  const server = createServer(async (req, res) => {
    if (
      handleHealth(req, res, { ready: true, config: { TRANSPORT: "http" } })
    ) {
      return;
    }
    if (!authorizeHttpMcpRequest(config, req, res)) {
      return;
    }

    for await (const chunk of req) {
      if (chunk !== undefined) {
        bodyReads += 1;
      }
    }
    writeJson(res, 200, { ok: true });
  });

  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;

  return {
    bodyReadCount: () => bodyReads,
    url: `http://127.0.0.1:${address.port}`,
  };
}

afterEach(async () => {
  await closeServers();
});

describe("HTTP MCP bearer auth", () => {
  it("allows HTTP MCP requests when MCP_AUTH_TOKEN is unset", async () => {
    const server = await startAuthServer({});

    const response = await fetch(`${server.url}/mcp`, {
      method: "POST",
      body: "{}",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(server.bodyReadCount()).toBeGreaterThan(0);
  });

  it("allows HTTP MCP requests when the bearer token matches", async () => {
    const server = await startAuthServer({ MCP_AUTH_TOKEN: "shared-secret" });

    const response = await fetch(`${server.url}/mcp`, {
      method: "POST",
      headers: { Authorization: "Bearer shared-secret" },
      body: "{}",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("rejects missing authorization before reading the body", async () => {
    const server = await startAuthServer({ MCP_AUTH_TOKEN: "shared-secret" });

    const response = await fetch(`${server.url}/mcp`, {
      method: "POST",
      body: JSON.stringify({ method: "initialize" }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(server.bodyReadCount()).toBe(0);
  });

  it.each([
    ["wrong scheme", "Basic shared-secret"],
    ["wrong token", "Bearer other-secret"],
  ])("rejects %s", async (_name, authorization) => {
    const server = await startAuthServer({ MCP_AUTH_TOKEN: "shared-secret" });

    const response = await fetch(`${server.url}/mcp`, {
      method: "POST",
      headers: { Authorization: authorization },
      body: "{}",
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
  });

  it("leaves health and readiness endpoints unauthenticated", async () => {
    const server = await startAuthServer({ MCP_AUTH_TOKEN: "shared-secret" });

    const health = await fetch(`${server.url}/healthz`);
    const ready = await fetch(`${server.url}/readyz`);

    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ status: "ok" });
    expect(ready.status).toBe(200);
    await expect(ready.json()).resolves.toEqual({
      status: "ready",
      transport: "http",
    });
  });
});

describe("bearer token helpers", () => {
  it.each([
    ["Bearer shared-secret", "shared-secret"],
    ["bearer shared-secret", "shared-secret"],
    ["Bearer    shared-secret", "shared-secret"],
    ["Bearer", undefined],
    ["Bearer shared secret", undefined],
    ["Basic shared-secret", undefined],
    [undefined, undefined],
  ])("extracts bearer token from %s", (authorization, expected) => {
    expect(extractBearerToken(authorization)).toBe(expected);
  });

  it("uses digest-based constant-size comparison", () => {
    expect(timingSafeStringEqual("shared-secret", "shared-secret")).toBe(true);
    expect(timingSafeStringEqual("shared-secret", "other-secret")).toBe(false);
    expect(timingSafeStringEqual("", "shared-secret")).toBe(false);
  });
});
