import { describe, expect, it, vi } from "vitest";
import { cardTools } from "../src/trello/cards.js";
import { TrelloApiError } from "../src/utils/errors.js";

describe("card tools", () => {
  it("rejects bad create-card input with schema validation", () => {
    const tool = cardTools.find((candidate) => candidate.name === "trello_card_create");

    expect(() => tool?.inputSchema.parse({ listId: "list1", name: "", due: "not-a-date" })).toThrow();
  });

  it("calls Trello with parsed create-card inputs", async () => {
    const tool = cardTools.find((candidate) => candidate.name === "trello_card_create");
    const trello = {
      request: vi.fn(async () => ({ id: "card1", name: "New card" }))
    };

    await expect(
      tool?.handler(
        { listId: "list1", name: "New card", pos: "bottom" },
        { trello: trello as never, logger: {} as never, requestId: "req1" }
      )
    ).resolves.toEqual({ id: "card1", name: "New card" });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards",
      expect.anything(),
      expect.objectContaining({ method: "POST", query: expect.objectContaining({ idList: "list1", name: "New card" }) })
    );
  });

  it("allows Trello API errors to be mapped by the tool factory", async () => {
    const tool = cardTools.find((candidate) => candidate.name === "trello_card_get");
    const error = new TrelloApiError(500, "Trello failed", { status: 500 });

    await expect(
      tool?.handler(
        { cardId: "card1", fields: "all" },
        { trello: { request: vi.fn(async () => Promise.reject(error)) } as never, logger: {} as never, requestId: "req1" }
      )
    ).rejects.toBe(error);
  });
});
