import { describe, expect, it, vi } from "vitest";
import { boardTools } from "../src/trello/boards.js";
import { AuthError } from "../src/utils/errors.js";

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

  it("gets board details with common preferences and label names by default", async () => {
    const tool = getBoardTool("trello_board_get");
    const trello = {
      request: vi.fn(async () => ({
        id: "board1",
        name: "Personal",
        prefs: { cardCovers: true, calendarFeedEnabled: false },
        labelNames: { green: "Home" },
      })),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ boardId: "board1" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual({
      id: "board1",
      name: "Personal",
      prefs: { cardCovers: true, calendarFeedEnabled: false },
      labelNames: { green: "Home" },
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/boards/board1",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          fields: expect.stringContaining("prefs"),
        }),
        resourceType: "board",
        resourceId: "board1",
      }),
    );
  });

  it("gets a single board field", async () => {
    const tool = getBoardTool("trello_board_field_get");
    const trello = {
      request: vi.fn(async () => ({ cardCovers: true })),
    };

    await expect(
      tool.handler(
        tool.inputSchema.parse({ boardId: "board 1", field: "prefs" }),
        {
          trello: trello as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).resolves.toEqual({ cardCovers: true });
    expect(trello.request).toHaveBeenCalledWith(
      "/boards/board%201/prefs",
      expect.anything(),
      expect.objectContaining({ resourceType: "board", resourceId: "board 1" }),
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

  it("lists open board cards by default", async () => {
    const tool = getBoardTool("trello_board_cards");
    const trello = {
      request: vi.fn(async () => [{ id: "card1", name: "Pay bills" }]),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ boardId: "board1" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual([{ id: "card1", name: "Pay bills" }]);
    expect(trello.request).toHaveBeenCalledWith(
      "/boards/board1/cards",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({ filter: "open" }),
        resourceType: "board",
        resourceId: "board1",
      }),
    );
  });

  it("lists board labels with a default limit and fields", async () => {
    const tool = getBoardTool("trello_board_labels");
    const trello = {
      request: vi.fn(async () => [
        { id: "label1", idBoard: "board1", name: "Urgent", color: "red" },
      ]),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ boardId: "board1" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual([
      { id: "label1", idBoard: "board1", name: "Urgent", color: "red" },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/boards/board1/labels",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          limit: 50,
          fields: "name,color,uses",
        }),
        resourceType: "board",
        resourceId: "board1",
      }),
    );
  });

  it("lists board members", async () => {
    const tool = getBoardTool("trello_board_members");
    const trello = {
      request: vi.fn(async () => [{ id: "member1", fullName: "Ada Lovelace" }]),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ boardId: "board1" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual([{ id: "member1", fullName: "Ada Lovelace" }]);
    expect(trello.request).toHaveBeenCalledWith(
      "/boards/board1/members",
      expect.anything(),
      expect.objectContaining({
        query: { fields: "username,fullName,initials,avatarUrl" },
        resourceType: "board",
        resourceId: "board1",
      }),
    );
  });

  it("lists board memberships with member details", async () => {
    const tool = getBoardTool("trello_board_memberships");
    const trello = {
      request: vi.fn(async () => [
        { id: "membership1", idMember: "member1", memberType: "admin" },
      ]),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ boardId: "board1" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual([
      { id: "membership1", idMember: "member1", memberType: "admin" },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/boards/board1/memberships",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          filter: "all",
          member: true,
          member_fields: "username,fullName,initials,avatarUrl",
        }),
        resourceType: "board",
        resourceId: "board1",
      }),
    );
  });

  it("accepts Trello-supported board membership filters only", () => {
    const tool = getBoardTool("trello_board_memberships");

    expect(
      tool.inputSchema.parse({ boardId: "board1", filter: "admins" }).filter,
    ).toBe("admins");
    expect(() =>
      tool.inputSchema.parse({ boardId: "board1", filter: "active" }),
    ).toThrow();
  });

  it("propagates board permission errors from Trello", async () => {
    const tool = getBoardTool("trello_board_cards");
    const trello = {
      request: vi.fn(async () => {
        throw new AuthError("Trello authentication failed; check credentials.");
      }),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ boardId: "board1" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects empty board ids before requesting Trello", async () => {
    const tool = getBoardTool("trello_board_get");

    expect(() => tool.inputSchema.parse({ boardId: "" })).toThrow();
  });
});
