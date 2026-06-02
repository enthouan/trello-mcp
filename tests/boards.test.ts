import { describe, expect, it, vi } from "vitest";
import { boardTools } from "../src/trello/boards.js";

type BoardTool = (typeof boardTools)[number];

function getBoardTool<TName extends BoardTool["name"]>(
  name: TName,
): Extract<BoardTool, { name: TName }> {
  const tool = boardTools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing board tool: ${name}`);
  }
  return tool as Extract<BoardTool, { name: TName }>;
}

describe("board tools", () => {
  it("lists the current member's open boards by default", async () => {
    const tool = getBoardTool("trello_list_boards");
    const trello = {
      request: vi.fn(async () => [{ id: "board1", name: "Jobs" }]),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({}), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual([{ id: "board1", name: "Jobs" }]);
    expect(trello.request).toHaveBeenCalledWith(
      "/members/me/boards",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({ filter: "open" }),
      }),
    );
  });

  it("lists open board lists by default", async () => {
    const tool = getBoardTool("trello_board_lists");
    const trello = {
      request: vi.fn(async () => [{ id: "list1", name: "Today" }]),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ boardId: "board1" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual([{ id: "list1", name: "Today" }]);
    expect(trello.request).toHaveBeenCalledWith(
      "/boards/board1/lists",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({ filter: "open" }),
        resourceType: "board",
        resourceId: "board1",
      }),
    );
  });

  it("rejects empty board ids before requesting Trello", async () => {
    const tool = getBoardTool("trello_board_get");

    expect(() => tool.inputSchema.parse({ boardId: "" })).toThrow();
  });
});
