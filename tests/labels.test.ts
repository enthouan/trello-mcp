import { describe, expect, it, vi } from "vitest";
import { labelTools } from "../src/trello/labels.js";
import {
  TrelloCardLabelsSchema,
  TrelloCoverSchema,
  TrelloLabelListSchema,
  TrelloLabelSchema,
} from "../src/trello/types.js";

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

  it("accepts light and dark Trello label colors on label creation", () => {
    const tool = getLabelTool("label_create");

    expect(
      tool.inputSchema.parse({
        boardId: "board1",
        name: "Flying",
        color: "blue_dark",
      }),
    ).toEqual({ boardId: "board1", name: "Flying", color: "blue_dark" });
    expect(
      tool.inputSchema.parse({
        boardId: "board1",
        name: "Sandvue",
        color: "orange_light",
      }),
    ).toEqual({ boardId: "board1", name: "Sandvue", color: "orange_light" });
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

  it("rejects deceptive Trello card URLs before adding a label", async () => {
    const tool = getLabelTool("card_label_add");
    const trello = { request: vi.fn() };

    await expect(
      tool.handler(
        {
          cardId: "https://eviltrello.com/c/AbCd1234/example-card",
          labelId: "label1",
        },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).rejects.toThrow("HTTPS card URL on trello.com");
    expect(trello.request).not.toHaveBeenCalled();
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

describe("label color schemas", () => {
  const lightDarkColors = [
    "green_dark",
    "yellow_dark",
    "orange_dark",
    "red_dark",
    "purple_dark",
    "blue_dark",
    "sky_dark",
    "lime_dark",
    "pink_dark",
    "black_dark",
    "green_light",
    "yellow_light",
    "orange_light",
    "red_light",
    "purple_light",
    "blue_light",
    "sky_light",
    "lime_light",
    "pink_light",
    "black_light",
  ];

  it("parses board label listings with light and dark colors", () => {
    const labels = lightDarkColors.map((color, index) => ({
      id: `label${index}`,
      idBoard: "board1",
      name: `Label ${color}`,
      color,
    }));

    expect(TrelloLabelListSchema.parse(labels)).toEqual(labels);
  });

  it("parses single labels with legacy colors, new colors, and null", () => {
    for (const color of ["blue", "blue_dark", "orange_light", null]) {
      expect(
        TrelloLabelSchema.parse({
          id: "label1",
          idBoard: "board1",
          name: "Flying",
          color,
        }),
      ).toEqual({ id: "label1", idBoard: "board1", name: "Flying", color });
    }
  });

  it("rejects unknown label colors in responses", () => {
    expect(
      TrelloLabelSchema.safeParse({
        id: "label1",
        idBoard: "board1",
        name: "Flying",
        color: "teal",
      }).success,
    ).toBe(false);
  });

  it("parses embedded card labels with light and dark colors", () => {
    const card = {
      id: "card1",
      idLabels: ["label1"],
      labels: [{ id: "label1", name: "Flying", color: "blue_dark" }],
    };

    expect(TrelloCardLabelsSchema.parse(card)).toEqual(card);
  });

  it("parses card covers reusing label color values", () => {
    expect(TrelloCoverSchema.parse({ color: "blue_dark" })).toEqual({
      color: "blue_dark",
    });
    expect(TrelloCoverSchema.parse({ color: null })).toEqual({ color: null });
  });
});
