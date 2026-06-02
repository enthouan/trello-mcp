import type { IncomingMessage, ServerResponse } from "node:http";
import type { Config } from "./config.js";

type HealthState = {
  ready: boolean;
  config: Pick<Config, "TRANSPORT">;
};

export function handleHealth(
  req: IncomingMessage,
  res: ServerResponse,
  state: HealthState,
): boolean {
  if (req.method !== "GET") {
    return false;
  }
  if (req.url === "/healthz") {
    writeJson(res, 200, { status: "ok" });
    return true;
  }
  if (req.url === "/readyz") {
    writeJson(res, state.ready ? 200 : 503, {
      status: state.ready ? "ready" : "not_ready",
      transport: state.config.TRANSPORT,
    });
    return true;
  }
  return false;
}

export function writeJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
