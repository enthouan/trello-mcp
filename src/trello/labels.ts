import { z } from "zod";
import { defineTool } from "../utils/tool.js";
import {
  DeleteResponseSchema,
  TrelloCardSchema,
  TrelloIdSchema,
  TrelloLabelColorSchema,
  TrelloLabelListSchema,
  TrelloLabelSchema,
} from "./types.js";

const BoardIdInput = z.object({
  boardId: TrelloIdSchema.describe("Trello board id containing the labels."),
});

const LabelIdInput = z.object({
  labelId: TrelloIdSchema.describe("Trello label id."),
});

const CardLabelInput = z.object({
  cardId: TrelloIdSchema.describe(
    "Trello card id, short link, or Trello card URL.",
  ),
  labelId: TrelloIdSchema.describe("Trello label id to add or remove."),
});

const ListBoardLabelsInput = BoardIdInput.extend({
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(50)
    .describe("Maximum number of labels to return."),
});

const CreateLabelInput = BoardIdInput.extend({
  name: z.string().min(1).describe("Human-readable label name."),
  color: TrelloLabelColorSchema.describe("Trello label color."),
});

const UpdateLabelInput = LabelIdInput.extend({
  name: z.string().min(1).optional().describe("New label name."),
  color: TrelloLabelColorSchema.nullable()
    .optional()
    .describe("New Trello label color, or null to remove the color."),
});

export const labelTools = [
  defineTool({
    name: "trello_board_labels",
    description:
      "Use when discovering labels available on a board before creating or updating cards with labels.",
    inputSchema: ListBoardLabelsInput,
    handler: async ({ boardId, limit }, { trello }) =>
      trello.request(
        `/boards/${encodeURIComponent(boardId)}/labels`,
        TrelloLabelListSchema,
        {
          query: { limit },
          resourceType: "board",
          resourceId: boardId,
        },
      ),
  }),
  defineTool({
    name: "trello_label_get",
    description:
      "Use when you need the current name, color, or board for a specific Trello label before editing it.",
    inputSchema: LabelIdInput,
    handler: async ({ labelId }, { trello }) =>
      trello.request(
        `/labels/${encodeURIComponent(labelId)}`,
        TrelloLabelSchema,
        {
          resourceType: "label",
          resourceId: labelId,
        },
      ),
  }),
  defineTool({
    name: "trello_label_create",
    description:
      "Use when creating a new reusable label on a Trello board before applying it to cards.",
    inputSchema: CreateLabelInput,
    handler: async ({ boardId, name, color }, { trello }) =>
      trello.request("/labels", TrelloLabelSchema, {
        method: "POST",
        query: { idBoard: boardId, name, color },
        resourceType: "board",
        resourceId: boardId,
      }),
  }),
  defineTool({
    name: "trello_label_update",
    description:
      "Use when renaming a Trello label or changing its color without changing any card assignments.",
    inputSchema: UpdateLabelInput,
    handler: async ({ labelId, ...input }, { trello }) =>
      trello.request(
        `/labels/${encodeURIComponent(labelId)}`,
        TrelloLabelSchema,
        {
          method: "PUT",
          query: input,
          resourceType: "label",
          resourceId: labelId,
        },
      ),
  }),
  defineTool({
    name: "trello_label_delete",
    description:
      "Use only when the user explicitly asks to permanently delete a board label from Trello.",
    inputSchema: LabelIdInput,
    handler: async ({ labelId }, { trello }) =>
      trello.request(
        `/labels/${encodeURIComponent(labelId)}`,
        DeleteResponseSchema,
        {
          method: "DELETE",
          resourceType: "label",
          resourceId: labelId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_label_add",
    description:
      "Use when applying an existing Trello label to a card by label id.",
    inputSchema: CardLabelInput,
    handler: async ({ cardId, labelId }, { trello }) =>
      trello.request(`${cardPath(cardId)}/idLabels`, TrelloCardSchema, {
        method: "POST",
        query: { value: labelId },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_label_remove",
    description:
      "Use when removing an existing Trello label from a card by label id.",
    inputSchema: CardLabelInput,
    handler: async ({ cardId, labelId }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/idLabels/${encodeURIComponent(labelId)}`,
        DeleteResponseSchema,
        {
          method: "DELETE",
          resourceType: "card label",
          resourceId: labelId,
        },
      ),
  }),
];

function cardPath(cardId: string): string {
  return `/cards/${encodeURIComponent(cardIdentifier(cardId))}`;
}

function cardIdentifier(cardId: string): string {
  const value = cardId.trim();
  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.endsWith("trello.com") && pathParts[0] === "c") {
      return pathParts[1] ?? value;
    }
  } catch {
    // Treat non-URL values as Trello ids or short links.
  }
  return value;
}
