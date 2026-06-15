import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "./config.js";
import { TrelloClient } from "./trello/client.js";
import { allTools } from "./trello/tools.js";
import type { Logger } from "./utils/logger.js";
import { registerTool, type ToolDefinition } from "./utils/tool.js";

const PackageJsonSchema = z.object({
  version: z.string().min(1),
});

const packageJson = PackageJsonSchema.parse(
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")),
);

export type AppServer = {
  mcp: McpServer;
  tools: ToolDefinition[];
};

type CreateServerOptions = {
  trello?: TrelloClient;
};

export function createTrelloClient(
  config: Config,
  logger: Logger,
): TrelloClient {
  return new TrelloClient(config, {
    logger,
    rateLimit: {
      capacity: config.TRELLO_RATE_LIMIT_CAPACITY,
      refillIntervalMs: config.TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS,
    },
    retry: {
      maxAttempts: config.TRELLO_RETRY_MAX_ATTEMPTS,
      baseDelayMs: config.TRELLO_RETRY_BASE_DELAY_MS,
      maxDelayMs: config.TRELLO_RETRY_MAX_DELAY_MS,
    },
  });
}

export function createServer(
  config: Config,
  logger: Logger,
  options: CreateServerOptions = {},
): AppServer {
  const mcp = new McpServer({
    name: "trello-mcp",
    version: packageJson.version,
  });
  const trello = options.trello ?? createTrelloClient(config, logger);
  const tools = allTools;

  for (const tool of tools) {
    registerTool(mcp, tool, { trello, logger });
  }

  return { mcp, tools };
}
