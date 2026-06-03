import { z } from "zod";
import { defineTool } from "../utils/tool.js";
import {
  DeleteResponseSchema,
  TrelloActionListSchema,
  TrelloAttachmentListSchema,
  TrelloCardListSchema,
  TrelloCardSchema,
  TrelloChecklistListSchema,
  TrelloChecklistSchema,
  TrelloIdSchema,
  TrelloMemberListSchema,
} from "./types.js";

const CardIdInput = z.object({
  cardId: TrelloIdSchema.describe(
    "Trello card id, short link, or Trello card URL.",
  ),
});

const CardFieldsInput = z.object({
  fields: z
    .string()
    .default("all")
    .describe(
      "Comma-separated Trello card fields to return; use 'all' unless minimizing output.",
    ),
});

const ListCardsInput = z.object({
  listId: TrelloIdSchema.describe("Trello list id to read cards from."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(50)
    .describe("Maximum number of cards to return."),
  filter: z
    .enum(["all", "closed", "none", "open"])
    .default("open")
    .describe("Which cards to include from the list."),
});

const CreateCardInput = z.object({
  listId: TrelloIdSchema.describe(
    "Destination list id where the new card should be created.",
  ),
  name: z.string().min(1).describe("Human-readable card title."),
  desc: z.string().optional().describe("Optional card description."),
  due: z.string().datetime().optional().describe("Optional ISO-8601 due date."),
  pos: z
    .union([z.literal("top"), z.literal("bottom"), z.number()])
    .default("bottom")
    .describe("Position in the destination list."),
  memberIds: z
    .array(TrelloIdSchema)
    .optional()
    .describe("Optional member ids to assign when creating the card."),
  labelIds: z
    .array(TrelloIdSchema)
    .optional()
    .describe("Optional label ids to apply when creating the card."),
});

const UpdateCardInput = CardIdInput.extend({
  name: z.string().min(1).optional().describe("New card title."),
  desc: z.string().optional().describe("New card description."),
  due: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe("New ISO-8601 due date, or null to clear it."),
  dueComplete: z
    .boolean()
    .optional()
    .describe("Whether the due date is complete."),
  closed: z
    .boolean()
    .optional()
    .describe("Set true to archive the card; false to unarchive it."),
});

const MoveCardInput = CardIdInput.extend({
  listId: TrelloIdSchema.optional().describe(
    "Destination list id. Required when moving to another list.",
  ),
  boardId: TrelloIdSchema.optional().describe(
    "Destination board id. Include when moving across boards.",
  ),
  pos: z
    .union([z.literal("top"), z.literal("bottom"), z.number()])
    .optional()
    .describe("Position in the destination list."),
});

const CardMemberInput = CardIdInput.extend({
  memberId: TrelloIdSchema.describe(
    "Trello member id to add or remove from the card.",
  ),
});

const CardAttachmentCreateInput = CardIdInput.extend({
  url: z.string().url().describe("Public URL to attach to the card."),
  name: z
    .string()
    .optional()
    .describe("Optional display name for the attachment."),
});

const CardAttachmentDeleteInput = CardIdInput.extend({
  attachmentId: TrelloIdSchema.describe(
    "Attachment id to remove from the card.",
  ),
});

const CardChecklistCreateInput = CardIdInput.extend({
  name: z.string().min(1).describe("Checklist name."),
  sourceChecklistId: TrelloIdSchema.optional().describe(
    "Existing checklist id to copy items from.",
  ),
});

const CardCommentCreateInput = CardIdInput.extend({
  text: z.string().min(1).describe("Comment text to add to the card."),
});

export const cardTools = [
  defineTool({
    name: "trello_card_get",
    description:
      "Use when you need the current details of one Trello card by id, short id, or URL before editing or summarizing it.",
    inputSchema: CardIdInput.merge(CardFieldsInput),
    handler: async ({ cardId, fields }, { trello }) =>
      trello.request(cardPath(cardId), TrelloCardSchema, {
        query: { fields },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_list_cards",
    description:
      "Use when you need cards in a specific Trello list; prefer board-level tools later when you need every list on a board.",
    inputSchema: ListCardsInput,
    handler: async ({ listId, limit, filter }, { trello }) =>
      trello.request(
        `/lists/${encodeURIComponent(listId)}/cards`,
        TrelloCardListSchema,
        {
          query: { limit, filter },
          resourceType: "list",
          resourceId: listId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_create",
    description:
      "Use when the user asks to create a new Trello card in a known list; accepts title, description, due date, members, and labels.",
    inputSchema: CreateCardInput,
    handler: async ({ listId, memberIds, labelIds, ...input }, { trello }) =>
      trello.request("/cards", TrelloCardSchema, {
        method: "POST",
        query: {
          idList: listId,
          idMembers: memberIds?.join(","),
          idLabels: labelIds?.join(","),
          ...input,
        },
      }),
  }),
  defineTool({
    name: "trello_card_update",
    description:
      "Use when changing card metadata such as title, description, due date, due completion, or archive state without moving it.",
    inputSchema: UpdateCardInput,
    handler: async ({ cardId, ...input }, { trello }) =>
      trello.request(cardPath(cardId), TrelloCardSchema, {
        method: "PUT",
        query: input,
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_delete",
    description:
      "Use only when the user explicitly asks to permanently delete a Trello card; archive instead for reversible removal.",
    inputSchema: CardIdInput,
    handler: async ({ cardId }, { trello }) =>
      trello.request(cardPath(cardId), DeleteResponseSchema, {
        method: "DELETE",
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_move",
    description:
      "Use when moving a card to another list, another board, or a different position; this is distinct from general card metadata updates.",
    inputSchema: MoveCardInput,
    handler: async ({ cardId, listId, boardId, pos }, { trello }) =>
      trello.request(cardPath(cardId), TrelloCardSchema, {
        method: "PUT",
        query: { idList: listId, idBoard: boardId, pos },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_archive",
    description:
      "Use when the user wants to archive or unarchive a card while keeping it recoverable; do not use for permanent deletion.",
    inputSchema: CardIdInput.extend({
      closed: z
        .boolean()
        .default(true)
        .describe("True archives the card; false restores it."),
    }),
    handler: async ({ cardId, closed }, { trello }) =>
      trello.request(cardPath(cardId), TrelloCardSchema, {
        method: "PUT",
        query: { closed },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_attachments",
    description: "Use when listing files or links attached to a card.",
    inputSchema: CardIdInput,
    handler: async ({ cardId }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/attachments`,
        TrelloAttachmentListSchema,
        { resourceType: "card", resourceId: cardId },
      ),
  }),
  defineTool({
    name: "trello_card_attachment_add_url",
    description:
      "Use when attaching an existing public URL to a card; this does not upload local files.",
    inputSchema: CardAttachmentCreateInput,
    handler: async ({ cardId, ...input }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/attachments`,
        TrelloAttachmentListSchema.element,
        {
          method: "POST",
          query: input,
          resourceType: "card",
          resourceId: cardId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_attachment_delete",
    description:
      "Use when removing a specific attachment from a card by attachment id.",
    inputSchema: CardAttachmentDeleteInput,
    handler: async ({ cardId, attachmentId }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/attachments/${encodeURIComponent(attachmentId)}`,
        DeleteResponseSchema,
        {
          method: "DELETE",
          resourceType: "attachment",
          resourceId: attachmentId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_checklists",
    description:
      "Use when viewing all checklists and checklist items currently on a card.",
    inputSchema: CardIdInput,
    handler: async ({ cardId }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/checklists`,
        TrelloChecklistListSchema,
        { resourceType: "card", resourceId: cardId },
      ),
  }),
  defineTool({
    name: "trello_card_checklist_create",
    description:
      "Use when adding a new checklist to an existing card, optionally copied from another checklist.",
    inputSchema: CardChecklistCreateInput,
    handler: async ({ cardId, sourceChecklistId, name }, { trello }) =>
      trello.request(`${cardPath(cardId)}/checklists`, TrelloChecklistSchema, {
        method: "POST",
        query: { name, idChecklistSource: sourceChecklistId },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_members",
    description:
      "Use when listing members assigned to a card; use add/remove member tools to change assignment.",
    inputSchema: CardIdInput,
    handler: async ({ cardId }, { trello }) =>
      trello.request(`${cardPath(cardId)}/members`, TrelloMemberListSchema, {
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_member_add",
    description: "Use when assigning a Trello member to a card by member id.",
    inputSchema: CardMemberInput,
    handler: async ({ cardId, memberId }, { trello }) =>
      trello.request(`${cardPath(cardId)}/idMembers`, TrelloCardSchema, {
        method: "POST",
        query: { value: memberId },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_member_remove",
    description:
      "Use when unassigning a Trello member from a card by member id.",
    inputSchema: CardMemberInput,
    handler: async ({ cardId, memberId }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/idMembers/${encodeURIComponent(memberId)}`,
        DeleteResponseSchema,
        {
          method: "DELETE",
          resourceType: "card member",
          resourceId: memberId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_comment_add",
    description:
      "Use when adding a new comment to a Trello card; returns the created comment action.",
    inputSchema: CardCommentCreateInput,
    handler: async ({ cardId, text }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/actions/comments`,
        TrelloActionListSchema.element,
        {
          method: "POST",
          query: { text },
          resourceType: "card",
          resourceId: cardId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_actions",
    description:
      "Use when auditing recent activity or comments for a card; set filter to commentCard for comments only.",
    inputSchema: CardIdInput.extend({
      filter: z
        .string()
        .default("all")
        .describe("Trello action filter such as all or commentCard."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .default(50)
        .describe("Maximum number of actions to return."),
    }),
    handler: async ({ cardId, filter, limit }, { trello }) =>
      trello.request(`${cardPath(cardId)}/actions`, TrelloActionListSchema, {
        query: { filter, limit },
        resourceType: "card",
        resourceId: cardId,
      }),
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
