import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Config } from "./config.js";
import { writeJson } from "./health.js";

type HttpAuthConfig = Pick<Config, "MCP_AUTH_TOKEN">;

export function authorizeHttpMcpRequest(
  config: HttpAuthConfig,
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  if (!config.MCP_AUTH_TOKEN) {
    return true;
  }

  const token = extractBearerToken(req.headers.authorization);
  if (
    token !== undefined &&
    timingSafeStringEqual(token, config.MCP_AUTH_TOKEN)
  ) {
    return true;
  }

  writeJson(
    res,
    401,
    { error: "unauthorized" },
    { "WWW-Authenticate": "Bearer" },
  );
  return false;
}

export function extractBearerToken(
  authorization: string | string[] | undefined,
): string | undefined {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (value === undefined) {
    return undefined;
  }

  return /^Bearer +(\S+)$/i.exec(value.trim())?.[1];
}

export function timingSafeStringEqual(
  actual: string,
  expected: string,
): boolean {
  if (actual.length === 0 || expected.length === 0) {
    return false;
  }

  const actualDigest = createHash("sha256").update(actual).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}
