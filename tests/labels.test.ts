import { describe, expect, it, vi } from "vitest";
import { labelTools } from "../src/trello/labels.js";

type LabelTool = (typeof labelTools)[number];

function getLabelTool<TName extends LabelTool["name"]>(
  name: TName,
): Extract<LabelTool, { name: TName }> {
  const tool = labelTools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing label tool: ${name}`);
  }
  return tool as Extract<LabelTool, { name: TName }>;
}

describe("label tools", () => {
  it("creates labels on a board", async () => {
    const tool = getLabelTool("label_create");
    const trello = {
      request: vi.fn(async () => ({
        id: "label1",
        idBoard: "board1",
        name: "Urgent",
        color: "red",
      })),
    };

    await expect(
      tool.handler(
        tool.inputSchema.parse({
          boardId: "board1",
          name: "Urgent",
          color: "red",
        }),
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({
      id: "label1",
      idBoard: "board1",
      name: "Urgent",
      color: "red",
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/labels",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        query: expect.objectContaining({
          idBoard: "board1",
          name: "Urgent",
          color: "red",
        }),
      }),
    );
  });

  it("rejects unsupported Trello label colors", () => {
    const tool = getLabelTool("label_create");

    expect(() =>
      tool.inputSchema.parse({
        boardId: "board1",
        name: "Urgent",
        color: "teal",
      }),
    ).toThrow();
  });

  it("normalizes Trello card URLs before adding a label to a card", async () => {
    const tool = getLabelTool("card_label_add");
    const trello = {
      request: vi.fn(
        async (_path: string, schema: { parse: (value: unknown) => unknown }) =>
          schema.parse("label1"),
      ),
    };

    await expect(
      tool.handler(
        {
          cardId: "https://trello.com/c/AbCd1234/example-card",
          labelId: "label1",
        },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({
      success: true,
      action: "label_added",
      cardId: "AbCd1234",
      labelId: "label1",
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/AbCd1234/idLabels",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        query: expect.objectContaining({ value: "label1" }),
      }),
    );
  });

  it("removes labels from cards by label id", async () => {
    const tool = getLabelTool("card_label_remove");
    const trello = {
      request: vi.fn(
        async (_path: string, schema: { parse: (value: unknown) => unknown }) =>
          schema.parse("label1"),
      ),
    };

    await expect(
      tool.handler(
        { cardId: "card1", labelId: "label1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({
      success: true,
      action: "label_removed",
      cardId: "card1",
      labelId: "label1",
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/idLabels/label1",
      expect.anything(),
      expect.objectContaining({
        method: "DELETE",
        resourceType: "card label",
        resourceId: "label1",
      }),
    );
  });
});
