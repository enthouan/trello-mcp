import { z } from "zod";
import { defineTool } from "../utils/tool.js";
import { normalizeTrelloCardIdentifier } from "./identifiers.js";
import {
  DeleteResponseSchema,
  TrelloIdSchema,
  TrelloLabelColorSchema,
  TrelloLabelSchema,
  TrelloMutationSuccessSchema,
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
    name: "label_get",
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
    name: "label_create",
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
    name: "label_update",
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
    name: "label_delete",
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
    name: "card_label_add",
    description:
      "Use when applying an existing Trello label to a card by label id.",
    inputSchema: CardLabelInput,
    handler: async ({ cardId, labelId }, { trello }) => {
      await trello.request(
        `${cardPath(cardId)}/idLabels`,
        TrelloMutationSuccessSchema,
        {
          method: "POST",
          query: { value: labelId },
          resourceType: "card",
          resourceId: cardId,
        },
      );
      return {
        success: true,
        action: "label_added",
        cardId: normalizeTrelloCardIdentifier(cardId),
        labelId,
      };
    },
  }),
  defineTool({
    name: "card_label_remove",
    description:
      "Use when removing an existing Trello label from a card by label id.",
    inputSchema: CardLabelInput,
    handler: async ({ cardId, labelId }, { trello }) => {
      await trello.request(
        `${cardPath(cardId)}/idLabels/${encodeURIComponent(labelId)}`,
        DeleteResponseSchema.or(TrelloMutationSuccessSchema),
        {
          method: "DELETE",
          resourceType: "card label",
          resourceId: labelId,
        },
      );
      return {
        success: true,
        action: "label_removed",
        cardId: normalizeTrelloCardIdentifier(cardId),
        labelId,
      };
    },
  }),
];

function cardPath(cardId: string): string {
  return `/cards/${encodeURIComponent(normalizeTrelloCardIdentifier(cardId))}`;
}
