import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import type { TrelloClient } from "../trello/client.js";
import { toAppError, toMcpError } from "./errors.js";
import type { Logger } from "./logger.js";

export type ToolContext = {
  trello: TrelloClient;
  logger: Logger;
  requestId: string;
};

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

export type ToolDefinition<TSchema extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  inputSchema: TSchema;
  handler: (input: z.infer<TSchema>, context: ToolContext) => Promise<unknown>;
};

export type DefinedTool<
  TName extends string,
  TSchema extends z.ZodType,
> = ToolDefinition<TSchema> & {
  name: TName;
};

export function defineTool<
  const TName extends string,
  TSchema extends z.ZodType,
>(definition: DefinedTool<TName, TSchema>): DefinedTool<TName, TSchema> {
  return definition;
}

export function asTextResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export function registerTool(
  server: McpServer,
  tool: ToolDefinition,
  baseContext: Omit<ToolContext, "requestId">,
): void {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: zodObjectShape(tool.inputSchema),
    },
    async (rawInput: unknown) => {
      const requestId = crypto.randomUUID();
      const startedAt = performance.now();
      const logger = baseContext.logger.child({
        requestId,
        toolName: tool.name,
      });
      logger.debug("tool invocation started");
      try {
        const input = tool.inputSchema.parse(rawInput);
        const context = {
          ...baseContext,
          logger,
          requestId,
        };
        const result = await baseContext.trello.withLogger(logger, () =>
          tool.handler(input, context),
        );
        logger.debug(
          { durationMs: Math.round(performance.now() - startedAt) },
          "tool invocation completed",
        );
        return asTextResult(result);
      } catch (error) {
        const appError = toAppError(error);
        logger.warn(
          {
            durationMs: Math.round(performance.now() - startedAt),
            errorType: appError.name,
            ...safeErrorLogDetails(appError.details),
          },
          "tool invocation failed",
        );
        throw toMcpError(appError);
      }
    },
  );
}

function safeErrorLogDetails(
  details: Record<string, string | number | boolean | undefined> | undefined,
): { resourceType?: string; statusCode?: number } {
  if (!details) return {};

  return {
    ...(typeof details.resourceType === "string"
      ? { resourceType: details.resourceType }
      : {}),
    ...(typeof details.status === "number"
      ? { statusCode: details.status }
      : {}),
  };
}

function zodObjectShape(schema: z.ZodType): z.ZodRawShape {
  if ("shape" in schema && typeof schema.shape === "object") {
    return schema.shape as z.ZodRawShape;
  }
  return {};
}
