import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./config.js";
import { boardTools } from "./trello/boards.js";
import { cardTools } from "./trello/cards.js";
import { TrelloClient } from "./trello/client.js";
import type { Logger } from "./utils/logger.js";
import { registerTool, type ToolDefinition } from "./utils/tool.js";

export type AppServer = {
  mcp: McpServer;
  tools: ToolDefinition[];
};

export function createServer(config: Config, logger: Logger): AppServer {
  const mcp = new McpServer({
    name: "trello-mcp",
    version: "0.1.0",
  });
  const trello = new TrelloClient(config);
  const tools = [...boardTools, ...cardTools];

  for (const tool of tools) {
    registerTool(mcp, tool, { trello, logger });
  }

  return { mcp, tools };
}
