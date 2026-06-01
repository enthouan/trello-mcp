import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ZodError } from "zod";
import { loadConfig } from "./config.js";
import { handleHealth, writeJson } from "./health.js";
import { createServer } from "./server.js";
import { createLogger } from "./utils/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const app = createServer(config, logger);

  if (config.TRANSPORT === "stdio") {
    const transport = new StdioServerTransport();
    await app.mcp.connect(transport);
    logger.info("trello MCP server started on stdio");
    setupShutdown(async () => {
      await app.mcp.close();
    }, logger);
    return;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await app.mcp.connect(transport);
  let accepting = true;
  let inFlight = 0;

  const httpServer = createHttpServer(async (req, res) => {
    if (handleHealth(req, res, { ready: accepting, config })) {
      return;
    }
    if (!accepting) {
      writeJson(res, 503, { error: "server shutting down" });
      return;
    }
    inFlight += 1;
    try {
      await handleMcpRequest(transport, req, res);
    } catch (error) {
      logger.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "unhandled HTTP transport error");
      if (!res.headersSent) {
        writeJson(res, 500, { error: "internal server error" });
      }
    } finally {
      inFlight -= 1;
    }
  });

  httpServer.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "trello MCP server started on HTTP");
  });

  setupShutdown(async () => {
    accepting = false;
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
    while (inFlight > 0) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await app.mcp.close();
  }, logger);
}

async function handleMcpRequest(
  transport: StreamableHTTPServerTransport,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
  await transport.handleRequest(req, res, body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "DELETE") {
    return undefined;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function setupShutdown(close: () => Promise<void>, logger: ReturnType<typeof createLogger>): void {
  let closing = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (closing) {
      return;
    }
    closing = true;
    logger.info({ signal }, "shutdown requested");
    close()
      .then(() => {
        logger.info("shutdown complete");
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "shutdown failed");
        process.exit(1);
      });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

main().catch((error: unknown) => {
  const fallbackLogger = createLogger({ LOG_LEVEL: "error" });
  if (error instanceof ZodError) {
    fallbackLogger.error({ issues: error.issues }, "invalid configuration");
  } else {
    fallbackLogger.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "fatal startup error");
  }
  process.exit(1);
});
