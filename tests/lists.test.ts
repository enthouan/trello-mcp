import { describe, expect, it, vi } from "vitest";
import { listTools } from "../src/trello/lists.js";

type ListTool = (typeof listTools)[number];

function getListTool<TName extends ListTool["name"]>(
  name: TName,
): Extract<ListTool, { name: TName }> {
  const tool = listTools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing list tool: ${name}`);
  }
  return tool as Extract<ListTool, { name: TName }>;
}

describe("list tools", () => {
  it("gets list metadata with default fields", async () => {
    const tool = getListTool("list_get");
    const trello = {
      request: vi.fn(async () => ({ id: "list1", name: "Today" })),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ listId: "list1" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual({ id: "list1", name: "Today" });
    expect(trello.request).toHaveBeenCalledWith(
      "/lists/list1",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({ fields: "name,closed,idBoard,pos" }),
        resourceType: "list",
        resourceId: "list1",
      }),
    );
  });

  it("adds the required list name field when minimizing list fields", async () => {
    const tool = getListTool("list_get");
    const trello = {
      request: vi.fn(async () => ({
        id: "list1",
        name: "Today",
        closed: false,
      })),
    };

    await expect(
      tool.handler(
        tool.inputSchema.parse({ listId: "list1", fields: "closed" }),
        {
          trello: trello as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).resolves.toEqual({ id: "list1", name: "Today", closed: false });
    expect(trello.request).toHaveBeenCalledWith(
      "/lists/list1",
      expect.anything(),
      expect.objectContaining({
        query: { fields: "closed,name" },
        resourceType: "list",
        resourceId: "list1",
      }),
    );
  });

  it("calls Trello with parsed create-list inputs", async () => {
    const tool = getListTool("list_create");
    const trello = {
      request: vi.fn(async () => ({ id: "list1", name: "Done" })),
    };

    await expect(
      tool.handler(
        tool.inputSchema.parse({ boardId: "board1", name: "Done" }),
        {
          trello: trello as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).resolves.toEqual({ id: "list1", name: "Done" });
    expect(trello.request).toHaveBeenCalledWith(
      "/lists",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        query: expect.objectContaining({
          idBoard: "board1",
          name: "Done",
          pos: "bottom",
        }),
        resourceType: "board",
        resourceId: "board1",
      }),
    );
  });

  it("updates list metadata without requiring archive state", async () => {
    const tool = getListTool("list_update");
    const trello = {
      request: vi.fn(async () => ({ id: "list1", name: "Later" })),
    };

    await expect(
      tool.handler(
        { listId: "list1", name: "Later" },
        {
          trello: trello as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).resolves.toEqual({ id: "list1", name: "Later" });
    expect(trello.request).toHaveBeenCalledWith(
      "/lists/list1",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: expect.objectContaining({ name: "Later" }),
      }),
    );
  });

  it("archives lists through the dedicated closed endpoint", async () => {
    const tool = getListTool("list_archive");
    const trello = {
      request: vi.fn(async () => ({ id: "list1", name: "Old", closed: true })),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ listId: "list1" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual({ id: "list1", name: "Old", closed: true });
    expect(trello.request).toHaveBeenCalledWith(
      "/lists/list1/closed",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: { value: true },
        resourceType: "list",
        resourceId: "list1",
      }),
    );
  });

  it("moves lists to another board", async () => {
    const tool = getListTool("list_move_to_board");
    const trello = {
      request: vi.fn(async () => ({
        id: "list1",
        name: "Today",
        idBoard: "board2",
      })),
    };

    await expect(
      tool.handler(
        { listId: "list1", boardId: "board2" },
        {
          trello: trello as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).resolves.toEqual({ id: "list1", name: "Today", idBoard: "board2" });
    expect(trello.request).toHaveBeenCalledWith(
      "/lists/list1/idBoard",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: { value: "board2" },
      }),
    );
  });

  it("rejects empty list ids before requesting Trello", () => {
    const tool = getListTool("list_get");

    expect(() => tool.inputSchema.parse({ listId: "" })).toThrow();
  });
});
