import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  DOCKER_REGISTRY_EXCLUDED_TOOL_NAMES,
  type DockerRegistryTool,
  type DockerRegistryToolArgument,
  generateDockerRegistryTools,
  renderDockerRegistryTools,
  selectDockerRegistryTools,
} from "../scripts/lib/docker-registry-tools.js";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";
import { TrelloClient } from "../src/trello/client.js";
import { allTools } from "../src/trello/tools.js";
import type { ToolDefinition } from "../src/utils/tool.js";

const artifact = new URL("../servers/trello-mcp/tools.json", import.meta.url);

function tool(name: string): DockerRegistryTool {
  const match = generateDockerRegistryTools(allTools).find(
    (candidate) => candidate.name === name,
  );
  if (!match) throw new Error(`Missing generated tool ${name}.`);
  return match;
}

function argument(
  toolName: string,
  argumentName: string,
): DockerRegistryToolArgument {
  const match = tool(toolName).arguments?.find(
    (candidate) => candidate.name === argumentName,
  );
  if (!match) {
    throw new Error(`Missing generated argument ${toolName}.${argumentName}.`);
  }
  return match;
}

function syntheticTool(
  name: string,
  inputSchema = z.object({}),
  description = "Synthetic tool description.",
): ToolDefinition {
  return {
    name,
    description,
    inputSchema,
    handler: vi.fn(async () => ({})),
  };
}

describe("Docker MCP Registry tools.json generator", () => {
  it("matches the committed artifact byte for byte and remains stable", async () => {
    const first = renderDockerRegistryTools(allTools);
    const second = renderDockerRegistryTools(allTools);

    expect(second).toBe(first);
    expect(await readFile(artifact, "utf8")).toBe(first);
    expect(first.endsWith("\n")).toBe(true);
    expect(first.endsWith("\n\n")).toBe(false);
    expect(JSON.parse(first)).toEqual(generateDockerRegistryTools(allTools));
  });

  it("selects all runtime tools except the sole explicit upload exclusion", () => {
    const selected = selectDockerRegistryTools(allTools);
    const selectedNames = selected.map(({ name }) => name);
    const expectedNames = allTools
      .map(({ name }) => name)
      .filter((name) => name !== "card_attachment_upload")
      .sort();

    expect(DOCKER_REGISTRY_EXCLUDED_TOOL_NAMES).toEqual([
      "card_attachment_upload",
    ]);
    expect(allTools).toHaveLength(77);
    expect(selected).toHaveLength(76);
    expect(selectedNames).toEqual(expectedNames);
    expect(selectedNames).not.toContain("card_attachment_upload");
  });

  it("uses the compact Docker shape and deterministic ordering", () => {
    const generated = generateDockerRegistryTools(allTools);
    const names = generated.map(({ name }) => name);

    expect(names).toEqual([...names].sort());
    for (const generatedTool of generated) {
      expect(Object.keys(generatedTool)).toEqual(
        generatedTool.arguments
          ? ["name", "description", "arguments"]
          : ["name", "description"],
      );
      expect(generatedTool.name.trim()).not.toBe("");
      expect(generatedTool.description.trim()).not.toBe("");
      expect(generatedTool).not.toHaveProperty("annotations");

      const arguments_ = generatedTool.arguments ?? [];
      const requiredNames = arguments_
        .filter((candidate) => candidate.optional === undefined)
        .map(({ name }) => name);
      const optionalNames = arguments_
        .filter((candidate) => candidate.optional === true)
        .map(({ name }) => name);
      expect(requiredNames).toEqual([...requiredNames].sort());
      expect(optionalNames).toEqual([...optionalNames].sort());
      expect(arguments_.map(({ name }) => name)).toEqual([
        ...requiredNames,
        ...optionalNames,
      ]);

      for (const generatedArgument of arguments_) {
        expect(generatedArgument.name.trim()).not.toBe("");
        expect(generatedArgument.type.trim()).not.toBe("");
        expect(generatedArgument.desc.trim()).not.toBe("");
        if ("optional" in generatedArgument) {
          expect(generatedArgument.optional).toBe(true);
        }
        if (generatedArgument.type === "array") {
          expect(generatedArgument.items?.type.trim()).not.toBe("");
        } else {
          expect(generatedArgument).not.toHaveProperty("items");
        }
      }
    }
  });

  it("maps required, defaulted, array, integer, boolean, nullable, and union inputs", () => {
    expect(tool("list_create").arguments?.map(({ name }) => name)).toEqual([
      "boardId",
      "name",
      "pos",
    ]);
    expect(argument("list_create", "boardId")).toMatchObject({
      type: "string",
      desc: "Board id where the new Trello list should be created.",
    });
    expect(argument("list_create", "boardId")).not.toHaveProperty("optional");
    expect(argument("list_create", "name")).not.toHaveProperty("optional");
    expect(argument("list_create", "pos")).toMatchObject({
      type: "string",
      optional: true,
    });
    expect(argument("card_create", "memberIds")).toEqual({
      name: "memberIds",
      type: "array",
      items: { type: "string" },
      desc: "Optional member ids to assign when creating the card.",
      optional: true,
    });
    expect(argument("card_create", "labelIds")).toMatchObject({
      type: "array",
      items: { type: "string" },
      optional: true,
    });
    expect(argument("board_actions", "limit")).toMatchObject({
      type: "integer",
      optional: true,
    });
    expect(argument("board_actions", "member")).toMatchObject({
      type: "boolean",
      optional: true,
    });
    expect(argument("board_actions", "since")).toMatchObject({
      type: "string",
      optional: true,
    });
    expect(argument("card_position_set", "pos")).toEqual({
      name: "pos",
      type: "string",
      desc: "New position for the card within its current or destination list.",
    });
    expect(argument("search", "boardIds")).toMatchObject({
      type: "string",
      optional: true,
    });
  });

  it("rejects missing exclusions, duplicate tools, and blank metadata", () => {
    const excluded = syntheticTool("card_attachment_upload");

    expect(() => selectDockerRegistryTools([])).toThrow(
      "Expected excluded tool card_attachment_upload exactly once; found 0.",
    );
    expect(() =>
      selectDockerRegistryTools([excluded, syntheticTool(excluded.name)]),
    ).toThrow("Duplicate tool name: card_attachment_upload");
    expect(() =>
      selectDockerRegistryTools([excluded, syntheticTool("")]),
    ).toThrow("Tool name must be a non-empty string.");
    expect(() =>
      generateDockerRegistryTools([
        excluded,
        syntheticTool("blank_description", z.object({}), "  "),
      ]),
    ).toThrow(
      "Description for tool blank_description must be a non-empty string.",
    );
    expect(() =>
      generateDockerRegistryTools([
        excluded,
        syntheticTool("blank_argument", z.object({ value: z.string() })),
      ]),
    ).toThrow("Description for argument value must be a non-empty string.");
    expect(() =>
      generateDockerRegistryTools([
        excluded,
        syntheticTool(
          "blank_argument_name",
          z.object({ "": z.string().describe("Synthetic argument.") }),
        ),
      ]),
    ).toThrow(
      "Required property name for tool blank_argument_name must be a non-empty string.",
    );
  });

  it("is independent of credentials, fetch, and tool handlers", () => {
    const firstHandlers = allTools.map(() => vi.fn(async () => ({})));
    const firstTools = allTools.map((current, index) => ({
      ...current,
      handler: firstHandlers[index] as ToolDefinition["handler"],
    }));
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("TRELLO_API_KEY", "synthetic-api-key-sentinel-a");
    vi.stubEnv("TRELLO_TOKEN", "synthetic-token-sentinel-a");
    const first = renderDockerRegistryTools(firstTools);

    vi.stubEnv("TRELLO_API_KEY", "synthetic-api-key-sentinel-b");
    vi.stubEnv("TRELLO_TOKEN", "synthetic-token-sentinel-b");
    const second = renderDockerRegistryTools(firstTools);

    expect(second).toBe(first);
    expect(first).not.toMatch(/synthetic-(?:api-key|token)-sentinel/);
    expect(fetcher).not.toHaveBeenCalled();
    for (const handler of firstHandlers) expect(handler).not.toHaveBeenCalled();
  });

  it("matches offline MCP tools/list client-facing input semantics", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("Unexpected network call during offline tools/list.");
    });
    const config = loadConfig({
      TRELLO_API_KEY: "synthetic-offline-api-key",
      TRELLO_TOKEN: "synthetic-offline-token",
      TRANSPORT: "stdio",
    });
    const logger = {
      child: () => logger,
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };
    const trello = new TrelloClient(config, {
      fetcher: fetcher as typeof fetch,
      sleep: async () => undefined,
    });
    const { mcp } = createServer(config, logger as never, { trello });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client(
      { name: "offline-registry-parity", version: "1.0.0" },
      { capabilities: {} },
    );

    try {
      await mcp.connect(serverTransport);
      await client.connect(clientTransport);
      const listed = await client.listTools();
      const selectedNames = new Set(
        selectDockerRegistryTools(allTools).map(({ name }) => name),
      );
      const listedSelected = listed.tools.filter(({ name }) =>
        selectedNames.has(name),
      );
      const generated = generateDockerRegistryTools(allTools);

      expect(listed.tools).toHaveLength(77);
      expect(listedSelected.map(({ name }) => name).sort()).toEqual(
        generated.map(({ name }) => name),
      );

      for (const generatedTool of generated) {
        const listedTool = listedSelected.find(
          ({ name }) => name === generatedTool.name,
        );
        expect(listedTool?.description).toBe(generatedTool.description);
        const properties = listedTool?.inputSchema.properties ?? {};
        const required = new Set(listedTool?.inputSchema.required ?? []);
        const generatedArguments = generatedTool.arguments ?? [];
        expect(generatedArguments.map(({ name }) => name).sort()).toEqual(
          Object.keys(properties).sort(),
        );

        for (const generatedArgument of generatedArguments) {
          const property = properties[generatedArgument.name] as
            | Record<string, unknown>
            | undefined;
          expect(property).toBeDefined();
          expect(generatedArgument.desc).toBe(property?.description);
          expect(generatedArgument.optional).toBe(
            required.has(generatedArgument.name) ? undefined : true,
          );
          expect(generatedArgument.type).toBe(
            typeof property?.type === "string" ? property.type : "string",
          );
          if (generatedArgument.type === "array") {
            const items = property?.items as
              | Record<string, unknown>
              | undefined;
            expect(generatedArgument.items?.type).toBe(
              typeof items?.type === "string" ? items.type : "string",
            );
          }
        }
      }
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      await client.close();
      await mcp.close();
    }
  });
});
