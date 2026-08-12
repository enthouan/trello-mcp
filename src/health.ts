import type {
  IncomingMessage,
  OutgoingHttpHeaders,
  ServerResponse,
} from "node:http";
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

export function rejectNonMcpPath(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  const [pathname] = (req.url ?? "/").split("?", 1);
  if (pathname === "/mcp") {
    return false;
  }

  writeJson(res, 404, { error: "not found" });
  return true;
}

export function writeJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: OutgoingHttpHeaders = {},
): void {
  res.writeHead(statusCode, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}
