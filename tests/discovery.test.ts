import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  assertNoSyntheticSecrets,
  inspectDiscovery,
} from "../scripts/lib/mcp-discovery.js";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";
import { TrelloClient } from "../src/trello/client.js";
import { allTools } from "../src/trello/tools.js";
import { createLogger } from "../src/utils/logger.js";

const version = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
).version as string;

describe("credential-independent MCP discovery", () => {
  it("discloses permanent deletion, upload transmission, and custom-field requirements", () => {
    const find = (name: string) => {
      const tool = allTools.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Missing tool ${name}.`);
      return tool;
    };
    for (const name of [
      "card_delete",
      "label_delete",
      "card_attachment_delete",
      "card_checklist_delete",
      "card_checklist_item_delete",
      "card_comment_delete",
    ])
      expect(find(name).description).toMatch(/permanent/i);
    expect(find("label_delete").description).toContain("card_label_remove");
    expect(find("label_delete").description).toContain("explicitly asked");
    expect(find("card_attachment_upload").description).toMatch(
      /transmit.*Trello/,
    );
    expect(find("card_attachment_upload").description).toContain("Disabled");
    const custom = find("card_custom_field_set");
    const schema = z.toJSONSchema(custom.inputSchema, { io: "input" });
    const typeSchema = schema.properties?.type;
    expect(
      typeof typeSchema === "object" ? typeSchema.description : undefined,
    ).toContain("checked for checkbox");
    for (const [type, key, value] of [
      ["text", "text", "hello"],
      ["number", "number", "42"],
      ["date", "date", "2026-10-12T00:00:00Z"],
      ["checkbox", "checked", false],
      ["list", "optionId", "option1"],
    ] as const) {
      const input = { cardId: "card1", customFieldId: "field1", type };
      expect(custom.inputSchema.safeParse(input).success).toBe(false);
      expect(
        custom.inputSchema.safeParse({ ...input, [key]: value }).success,
      ).toBe(true);
    }
    expect(find("search").description).not.toContain("natural language");
  });

  it("enumerates the complete wire catalog with zero Trello access", async () => {
    const config = loadConfig({
      TRELLO_API_KEY: "synthetic-discovery-key",
      TRELLO_TOKEN: "synthetic-discovery-token",
      TRANSPORT: "stdio",
      LOG_LEVEL: "debug",
    });
    let logs = "";
    const logger = createLogger(config, {
      write: (line) => {
        logs += line;
      },
    });
    const fetcher = vi.fn<typeof fetch>(() => {
      throw new Error("Discovery must not access Trello.");
    });
    const trello = new TrelloClient(config, { fetcher, logger });
    const request = vi.spyOn(trello, "request");
    const app = createServer(config, logger, { trello });
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "discovery-test", version: "1" });
    try {
      await app.mcp.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await inspectDiscovery(
        client,
        allTools.map(({ name }) => name),
        version,
      );
      expect(result.tools).toHaveLength(77);
      expect(result.pages).toBe(1);
      expect(result.capabilities).toEqual({ tools: { listChanged: true } });
      expect(result.resources).toEqual({ status: "unsupported", code: -32601 });
      expect(result.prompts).toEqual({ status: "unsupported", code: -32601 });
      expect(
        result.tools.some(({ name }) => name === "card_attachment_upload"),
      ).toBe(true);
      expect(config.TRELLO_ATTACHMENT_UPLOAD_ROOT).toBeUndefined();
      for (const definition of allTools) {
        const actual = result.tools.find(
          ({ name }) => name === definition.name,
        );
        expect(actual?.description).toBe(definition.description);
        expect(actual?.inputSchema).toEqual(
          z.toJSONSchema(definition.inputSchema, {
            io: "input",
            target: "draft-7",
          }),
        );
        for (const property of Object.values(
          actual?.inputSchema.properties ?? {},
        ))
          expect(
            (property as { description?: string }).description?.trim(),
          ).toBeTruthy();
      }
      expect(request).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
      assertNoSyntheticSecrets(JSON.stringify(result) + logs, [
        config.TRELLO_API_KEY,
        config.TRELLO_TOKEN,
      ]);
    } finally {
      await client.close();
      await app.mcp.close();
    }
  });

  it("follows pagination and rejects duplicate, missing, unexpected or looping names", async () => {
    const a = {
      name: "a",
      description: "Read A",
      inputSchema: { type: "object" },
    };
    const b = { ...a, name: "b" };
    const fake = (pages: unknown[]) => ({
      getServerVersion: () => ({ version }),
      getServerCapabilities: () => ({}),
      listTools: vi.fn().mockImplementation(async () => pages.shift()),
      request: vi.fn().mockResolvedValue({}),
    });
    const client = fake([{ tools: [a], nextCursor: "next" }, { tools: [b] }]);
    expect(
      (await inspectDiscovery(client as never, ["a", "b"], version)).pages,
    ).toBe(2);
    expect(client.listTools).toHaveBeenLastCalledWith({ cursor: "next" });
    for (const pages of [
      [{ tools: [a, a] }],
      [{ tools: [a] }],
      [{ tools: [a, b, { ...a, name: "extra" }] }],
      [
        { tools: [a], nextCursor: "same" },
        { tools: [b], nextCursor: "same" },
      ],
    ])
      await expect(
        inspectDiscovery(fake(pages) as never, ["a", "b"], version),
      ).rejects.toThrow();
  });

  it("fails on credential leaks without echoing the credential", () => {
    for (const value of ["synthetic/key", encodeURIComponent("synthetic/key")])
      expect(() => assertNoSyntheticSecrets(value, ["synthetic/key"])).toThrow(
        "Discovery output contains a synthetic credential.",
      );
  });
});
