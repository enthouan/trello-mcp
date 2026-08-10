import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { authTools } from "../src/trello/auth.js";
import { boardTools } from "../src/trello/boards.js";
import { cardTools } from "../src/trello/cards.js";
import { customFieldTools } from "../src/trello/custom-fields.js";
import { labelTools } from "../src/trello/labels.js";
import { listTools } from "../src/trello/lists.js";
import { memberTools } from "../src/trello/members.js";
import { searchTools } from "../src/trello/search.js";
import { workspaceTools } from "../src/trello/workspaces.js";
import { PermissionError } from "../src/utils/errors.js";
import { defineTool, registerTool } from "../src/utils/tool.js";

const logger = {
  child: () => logger,
  debug: vi.fn(),
  warn: vi.fn(),
};

const trello = {
  withLogger: async <T>(_logger: unknown, operation: () => Promise<T>) =>
    operation(),
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
      trello: trello as never,
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
      trello: trello as never,
      logger: logger as never,
    });

    await expect(handlers[0]?.({ id: "card1" })).resolves.toEqual({
      content: [
        { type: "text", text: JSON.stringify({ id: "card1" }, null, 2) },
      ],
    });
  });

  it("maps permission errors to MCP invalid request errors with details", async () => {
    const { server, handlers } = fakeServer();
    const tool = defineTool({
      name: "test_permission_tool",
      description: "test",
      inputSchema: z.object({ boardId: z.string() }),
      handler: async ({ boardId }) => {
        throw new PermissionError(
          `Trello denied access to board ${boardId}; the configured token is valid but lacks the required permission.`,
          { status: 403, resourceType: "board", resourceId: boardId },
        );
      },
    });

    registerTool(server as never, tool, {
      trello: trello as never,
      logger: logger as never,
    });

    await expect(handlers[0]?.({ boardId: "private-board" })).rejects.toEqual(
      expect.objectContaining({
        code: -32600,
        message: expect.stringContaining("lacks the required permission"),
        data: {
          status: 403,
          resourceType: "board",
          resourceId: "private-board",
        },
      }),
    );
  });

  it("logs safe error metadata without messages or private resource identifiers", async () => {
    logger.warn.mockClear();
    const { server, handlers } = fakeServer();
    const privateResource =
      "https://trello.com/c/AbCd1234/private-title?key=secret-key&token=secret-token";
    const tool = defineTool({
      name: "test_private_error",
      description: "test",
      inputSchema: z.object({ cardId: z.string() }),
      handler: async ({ cardId }) => {
        throw new PermissionError(`Trello denied access to card ${cardId}.`, {
          status: 403,
          resourceType: "card",
          resourceId: cardId,
          trelloMessage: "private upstream response",
        });
      },
    });

    registerTool(server as never, tool, {
      trello: trello as never,
      logger: logger as never,
    });

    await expect(handlers[0]?.({ cardId: privateResource })).rejects.toEqual(
      expect.objectContaining({ code: -32600 }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: "PermissionError",
        resourceType: "card",
        statusCode: 403,
      }),
      "tool invocation failed",
    );

    const logged = JSON.stringify(logger.warn.mock.calls.at(-1));
    expect(logged).not.toContain(privateResource);
    expect(logged).not.toContain("private-title");
    expect(logged).not.toContain("secret-key");
    expect(logged).not.toContain("secret-token");
    expect(logged).not.toContain("private upstream response");
  });
});

describe("Trello tool names", () => {
  it("omit the redundant server prefix and remain unique MCP names", () => {
    const names = [
      ...authTools,
      ...boardTools,
      ...workspaceTools,
      ...memberTools,
      ...listTools,
      ...cardTools,
      ...labelTools,
      ...customFieldTools,
      ...searchTools,
    ].map((tool) => tool.name);

    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => !name.startsWith("trello_"))).toBe(true);
    expect(new Set(names).size).toBe(names.length);

    for (const name of names) {
      expect(name).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
    }
  });
});
