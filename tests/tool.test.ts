import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { boardTools } from "../src/trello/boards.js";
import { cardTools } from "../src/trello/cards.js";
import { customFieldTools } from "../src/trello/custom-fields.js";
import { labelTools } from "../src/trello/labels.js";
import { listTools } from "../src/trello/lists.js";
import { defineTool, registerTool } from "../src/utils/tool.js";

const logger = {
  child: () => logger,
  debug: vi.fn(),
  warn: vi.fn(),
};

type RegisteredHandler = (input: unknown) => Promise<unknown>;

function fakeServer(): {
  server: { registerTool: ReturnType<typeof vi.fn> };
  handlers: RegisteredHandler[];
} {
  const handlers: RegisteredHandler[] = [];
  return {
    server: {
      registerTool: vi.fn(
        (_name: string, _options: unknown, handler: RegisteredHandler) =>
          handlers.push(handler),
      ),
    },
    handlers,
  };
}

describe("registerTool", () => {
  it("rejects invalid input before the handler runs", async () => {
    const { server, handlers } = fakeServer();
    const handler = vi.fn(async () => ({ ok: true }));
    const tool = defineTool({
      name: "test_tool",
      description: "test",
      inputSchema: z.object({ id: z.string().min(1) }),
      handler,
    });

    registerTool(server as never, tool, {
      trello: {} as never,
      logger: logger as never,
    });

    await expect(handlers[0]?.({ id: "" })).rejects.toMatchObject({
      code: -32602,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("wraps successful handler output as JSON text content", async () => {
    const { server, handlers } = fakeServer();
    const tool = defineTool({
      name: "test_tool",
      description: "test",
      inputSchema: z.object({ id: z.string() }),
      handler: async ({ id }) => ({ id }),
    });

    registerTool(server as never, tool, {
      trello: {} as never,
      logger: logger as never,
    });

    await expect(handlers[0]?.({ id: "card1" })).resolves.toEqual({
      content: [
        { type: "text", text: JSON.stringify({ id: "card1" }, null, 2) },
      ],
    });
  });
});

describe("Trello tool names", () => {
  it("omit the redundant server prefix and remain unique MCP names", () => {
    const names = [
      ...boardTools,
      ...listTools,
      ...cardTools,
      ...labelTools,
      ...customFieldTools,
    ].map((tool) => tool.name);

    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => !name.startsWith("trello_"))).toBe(true);
    expect(new Set(names).size).toBe(names.length);

    for (const name of names) {
      expect(name).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
    }
  });
});
