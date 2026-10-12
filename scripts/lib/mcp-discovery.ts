import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  ErrorCode,
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  McpError,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

/** Discovery only: never invokes a tool handler. Preserve the wire schemas. */
export async function inspectDiscovery(
  client: Client,
  expectedNames: readonly string[],
  expectedVersion: string,
) {
  if (client.getServerVersion()?.version !== expectedVersion)
    throw new Error("Discovery version differs from the matching source.");
  const tools: Tool[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  let pages = 0;
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...page.tools);
    pages++;
    cursor = page.nextCursor;
    if (cursor !== undefined) {
      if (!cursor || cursors.has(cursor) || pages >= 100)
        throw new Error("Invalid or repeated tools/list pagination cursor.");
      cursors.add(cursor);
    }
  } while (cursor !== undefined);

  const names = tools.map(({ name }) => name);
  if (
    new Set(names).size !== names.length ||
    new Set(expectedNames).size !== expectedNames.length ||
    JSON.stringify([...names].sort()) !==
      JSON.stringify([...expectedNames].sort())
  )
    throw new Error("Missing, duplicate, or unexpected discovery tools.");
  for (const tool of tools) {
    if (!tool.description?.trim() || tool.inputSchema.type !== "object")
      throw new Error(`Incomplete tool definition: ${tool.name}.`);
  }

  // request() intentionally bypasses the client's convenience-method capability
  // guard, so MethodNotFound records a server response, not a local SDK error.
  async function catalog(method: "resources/list" | "prompts/list") {
    try {
      const result =
        method === "resources/list"
          ? await client.request({ method }, ListResourcesResultSchema)
          : await client.request({ method }, ListPromptsResultSchema);
      return { status: "supported" as const, result };
    } catch (error) {
      if (error instanceof McpError && error.code === ErrorCode.MethodNotFound)
        return { status: "unsupported" as const, code: error.code };
      throw error;
    }
  }

  return {
    server: client.getServerVersion(),
    capabilities: client.getServerCapabilities(),
    pages,
    tools,
    resources: await catalog("resources/list"),
    prompts: await catalog("prompts/list"),
  };
}

export function assertNoSyntheticSecrets(
  output: string,
  values: readonly string[],
): void {
  if (
    values.some(
      (value) =>
        output.includes(value) || output.includes(encodeURIComponent(value)),
    )
  )
    throw new Error("Discovery output contains a synthetic credential.");
}
