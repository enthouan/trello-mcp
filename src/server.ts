import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "./config.js";
import { authTools } from "./trello/auth.js";
import { boardTools } from "./trello/boards.js";
import { cardTools } from "./trello/cards.js";
import { TrelloClient } from "./trello/client.js";
import { customFieldTools } from "./trello/custom-fields.js";
import { labelTools } from "./trello/labels.js";
import { listTools } from "./trello/lists.js";
import { memberTools } from "./trello/members.js";
import { searchTools } from "./trello/search.js";
import { workspaceTools } from "./trello/workspaces.js";
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

export function createServer(config: Config, logger: Logger): AppServer {
  const mcp = new McpServer({
    name: "trello-mcp",
    version: packageJson.version,
  });
  const trello = new TrelloClient(config);
  const tools = [
    ...authTools,
    ...boardTools,
    ...workspaceTools,
    ...memberTools,
    ...listTools,
    ...cardTools,
    ...labelTools,
    ...customFieldTools,
    ...searchTools,
  ];

  for (const tool of tools) {
    registerTool(mcp, tool, { trello, logger });
  }

  return { mcp, tools };
}
