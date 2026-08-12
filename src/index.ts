import { randomUUID } from "node:crypto";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ZodError } from "zod";
import { loadConfig } from "./config.js";
import { handleHealth, rejectNonMcpPath, writeJson } from "./health.js";
import { authorizeHttpMcpRequest } from "./http-auth.js";
import { createServer, createTrelloClient } from "./server.js";
import { createLogger } from "./utils/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);

  if (config.TRANSPORT === "stdio") {
    const app = createServer(config, logger);
    const transport = new StdioServerTransport();
    await app.mcp.connect(transport);
    logger.info("trello MCP server started on stdio");
    setupShutdown(async () => {
      await app.mcp.close();
    }, logger);
    return;
  }

  const sessions = new Map<string, HttpSession>();
  const trello = createTrelloClient(config, logger);
  let accepting = true;
  let inFlight = 0;

  const httpServer = createHttpServer(async (req, res) => {
    if (handleHealth(req, res, { ready: accepting, config })) {
      return;
    }
    if (rejectNonMcpPath(req, res)) {
      return;
    }
    if (!authorizeHttpMcpRequest(config, req, res)) {
      return;
    }
    if (!accepting) {
      writeJson(res, 503, { error: "server shutting down" });
      return;
    }
    inFlight += 1;
    try {
      await handleMcpRequest({ config, logger, sessions, trello }, req, res);
    } catch (error) {
      logger.error(
        { errorType: error instanceof Error ? error.name : "UnknownError" },
        "unhandled HTTP transport error",
      );
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
    await Promise.all(
      [...sessions.values()].map(async ({ app }) => {
        await app.mcp.close();
      }),
    );
    sessions.clear();
  }, logger);
}

type HttpSession = {
  app: ReturnType<typeof createServer>;
  transport: StreamableHTTPServerTransport;
};

type HttpContext = {
  config: ReturnType<typeof loadConfig>;
  logger: ReturnType<typeof createLogger>;
  sessions: Map<string, HttpSession>;
  trello: ReturnType<typeof createTrelloClient>;
};

async function handleMcpRequest(
  context: HttpContext,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJsonBody(req);
  const sessionId = readSessionId(req);
  const session = sessionId ? context.sessions.get(sessionId) : undefined;

  if (session) {
    await session.transport.handleRequest(req, res, body);
    return;
  }

  if (sessionId) {
    writeJson(res, 404, { error: "MCP session not found" });
    return;
  }

  if (!isInitializeRequest(body)) {
    writeJson(res, 400, { error: "Mcp-Session-Id header is required" });
    return;
  }

  const nextSession = await createHttpSession(context);
  await nextSession.transport.handleRequest(req, res, body);
  if (nextSession.transport.sessionId) {
    context.sessions.set(nextSession.transport.sessionId, nextSession);
  }
}

async function createHttpSession(context: HttpContext): Promise<HttpSession> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
  });
  const app = createServer(context.config, context.logger, {
    trello: context.trello,
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      context.sessions.delete(transport.sessionId);
    }
  };
  transport.onerror = (error) => {
    context.logger.warn(
      { errorType: error.name },
      "HTTP MCP transport reported an error",
    );
  };

  const session = { app, transport };
  await app.mcp.connect(transport as Transport);
  return session;
}

function readSessionId(req: IncomingMessage): string | undefined {
  const value = req.headers["mcp-session-id"];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isInitializeRequest(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      "method" in message &&
      message.method === "initialize",
  );
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

function setupShutdown(
  close: () => Promise<void>,
  logger: ReturnType<typeof createLogger>,
): void {
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
        logger.error(
          { errorType: error instanceof Error ? error.name : "UnknownError" },
          "shutdown failed",
        );
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
    fallbackLogger.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "fatal startup error",
    );
  }
  process.exit(1);
});
