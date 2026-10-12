import type { Writable } from "node:stream";
import { isDeepStrictEqual } from "node:util";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import {
  ErrorCode,
  type InitializeResult,
  type JSONRPCMessage,
  JSONRPCMessageSchema,
  LATEST_PROTOCOL_VERSION,
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  McpError,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const ImageIdentitySchema = z.object({
  Id: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  Architecture: z.string(),
  Os: z.string(),
});

export function safeImageIdentity(inspectResult: unknown) {
  // Strip configuration, history, labels, environment values and command text.
  return ImageIdentitySchema.parse(inspectResult);
}

const HealthEvidenceSchema = z.object({
  Status: z.enum(["starting", "healthy", "unhealthy"]),
  FailingStreak: z.number().int().nonnegative(),
  Log: z.array(z.object({ ExitCode: z.number().int() })),
});

export function safeHealthEvidence(health: unknown) {
  // Health command output can contain arbitrary image-controlled secrets.
  return HealthEvidenceSchema.parse(health);
}

export function dockerClientEnvironment(environment: NodeJS.ProcessEnv) {
  const selected: Record<string, string> = {
    PATH: environment.PATH ?? "/usr/local/bin:/usr/bin:/bin",
  };
  for (const key of [
    "HOME",
    "DOCKER_HOST",
    "DOCKER_CONTEXT",
    "DOCKER_CONFIG",
    "DOCKER_TLS",
    "DOCKER_TLS_VERIFY",
    "DOCKER_CERT_PATH",
    "DOCKER_API_VERSION",
  ]) {
    const value = environment[key];
    if (value !== undefined) selected[key] = value;
  }
  return selected;
}

export function validateProtocolStdout(bytes: Uint8Array): string {
  try {
    const output = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!output.endsWith("\n")) throw new Error("Missing stdio delimiter.");
    for (const line of output.slice(0, -1).split("\n"))
      JSONRPCMessageSchema.parse(JSON.parse(line));
    return output;
  } catch {
    throw new Error("Discovery stdout contains an invalid JSON-RPC frame.");
  }
}

export function discoveryWriter(
  stream: Writable,
  onError: (error: Error) => void,
): (message: JSONRPCMessage) => Promise<void> {
  const safeError = () => new Error("Discovery stdin pipe failed.");
  // A failed write invokes its callback AND emits a stream error. Handle both
  // so connect/send rejects normally and the caller's finally can clean up.
  stream.on("error", () => onError(safeError()));
  return (message) =>
    new Promise((resolve, reject) => {
      stream.write(serializeMessage(message), (error) => {
        if (error) reject(safeError());
        else resolve();
      });
    });
}

export function assertMatchingInitialization(
  actual: InitializeResult,
  expectedVersion: string,
): void {
  if (
    !isDeepStrictEqual(actual, {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      serverInfo: { name: "trello-mcp", version: expectedVersion },
      capabilities: { tools: { listChanged: true } },
    })
  )
    throw new Error("Discovery initialization differs from matching source.");
}

/** Discovery only: never invokes a tool handler. Preserve the wire schemas. */
export async function inspectDiscovery(
  client: Client,
  expectedTools: readonly Tool[],
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
  const expectedNames = expectedTools.map(({ name }) => name);
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
    if (
      !isDeepStrictEqual(
        // In-memory SDK transports retain optional undefined properties that
        // JSON-RPC serialization omits. Compare the actual JSON representations.
        JSON.parse(JSON.stringify(tool)),
        JSON.parse(
          JSON.stringify(expectedTools.find(({ name }) => name === tool.name)),
        ),
      )
    )
      throw new Error(
        `Discovery definition differs from matching source: ${tool.name}.`,
      );
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

  const resources = await catalog("resources/list");
  const prompts = await catalog("prompts/list");
  for (const [method, result] of [
    ["resources/list", resources],
    ["prompts/list", prompts],
  ] as const)
    if (result.status !== "unsupported")
      throw new Error(
        `Discovery ${method} behavior differs from matching source.`,
      );

  return {
    server: client.getServerVersion(),
    capabilities: client.getServerCapabilities(),
    pages,
    tools,
    resources,
    prompts,
  };
}

export function assertNoFilesystemChanges(diff: string): void {
  if (diff.trim()) throw new Error("Discovery image changed its filesystem.");
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
