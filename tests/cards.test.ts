import { describe, expect, it, vi } from "vitest";
import { cardTools } from "../src/trello/cards.js";
import { TrelloApiError } from "../src/utils/errors.js";

type CardTool = (typeof cardTools)[number];

function getCardTool<TName extends CardTool["name"]>(
  name: TName,
): Extract<CardTool, { name: TName }> {
  const tool = cardTools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing card tool: ${name}`);
  }
  return tool as Extract<CardTool, { name: TName }>;
}

describe("card tools", () => {
  it("rejects bad create-card input with schema validation", () => {
    const tool = getCardTool("trello_card_create");

    expect(() =>
      tool.inputSchema.parse({ listId: "list1", name: "", due: "not-a-date" }),
    ).toThrow();
  });

  it("calls Trello with parsed create-card inputs", async () => {
    const tool = getCardTool("trello_card_create");
    const trello = {
      request: vi.fn(async () => ({ id: "card1", name: "New card" })),
    };

    await expect(
      tool.handler(
        { listId: "list1", name: "New card", pos: "bottom" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({ id: "card1", name: "New card" });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        query: expect.objectContaining({ idList: "list1", name: "New card" }),
      }),
    );
  });

  it("normalizes Trello card URLs before requesting card details", async () => {
    const tool = getCardTool("trello_card_get");
    const trello = {
      request: vi.fn(async () => ({ id: "card1", name: "Existing card" })),
    };

    await expect(
      tool.handler(
        {
          cardId: "https://trello.com/c/AbCd1234/example-card",
          fields: "all",
        },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({ id: "card1", name: "Existing card" });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/AbCd1234",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({ fields: "all" }),
        resourceType: "card",
      }),
    );
  });

  it("adds a card comment through the Trello comments endpoint", async () => {
    const tool = getCardTool("trello_card_comment_add");
    const trello = {
      request: vi.fn(async () => ({
        id: "action1",
        type: "commentCard",
        data: { text: "Looks good" },
      })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", text: "Looks good" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({
      id: "action1",
      type: "commentCard",
      data: { text: "Looks good" },
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/actions/comments",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        query: { text: "Looks good" },
        resourceType: "card",
        resourceId: "card1",
      }),
    );
  });

  it("updates a card comment by comment action id", async () => {
    const tool = getCardTool("trello_card_comment_update");
    const trello = {
      request: vi.fn(async () => ({
        id: "action1",
        type: "commentCard",
        data: { text: "Updated" },
      })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", actionId: "action1", text: "Updated" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({
      id: "action1",
      type: "commentCard",
      data: { text: "Updated" },
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/actions/action1/comments",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: { text: "Updated" },
        resourceType: "card comment",
        resourceId: "action1",
      }),
    );
  });

  it("deletes a card comment by comment action id", async () => {
    const tool = getCardTool("trello_card_comment_delete");
    const trello = {
      request: vi.fn(async () => ({ _value: null })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", actionId: "action1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({ _value: null });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/actions/action1/comments",
      expect.anything(),
      expect.objectContaining({
        method: "DELETE",
        resourceType: "card comment",
        resourceId: "action1",
      }),
    );
  });

  it("rejects empty card comment text before requesting Trello", () => {
    const tool = getCardTool("trello_card_comment_add");

    expect(() =>
      tool.inputSchema.parse({ cardId: "card1", text: "" }),
    ).toThrow();
  });

  it("allows Trello API errors to be mapped by the tool factory", async () => {
    const tool = getCardTool("trello_card_get");
    const error = new TrelloApiError(500, "Trello failed", { status: 500 });

    await expect(
      tool.handler(
        { cardId: "card1", fields: "all" },
        {
          trello: {
            request: vi.fn(async () => Promise.reject(error)),
          } as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).rejects.toBe(error);
  });
});
