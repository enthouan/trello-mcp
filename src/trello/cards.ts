import { z } from "zod";
import { defineTool } from "../utils/tool.js";
import { includeRequiredFields } from "./fields.js";
import {
  DeleteResponseSchema,
  TrelloActionListSchema,
  TrelloAttachmentListSchema,
  TrelloBoardSchema,
  TrelloCardLabelsSchema,
  TrelloCardListSchema,
  TrelloCardSchema,
  TrelloChecklistItemListSchema,
  TrelloChecklistItemSchema,
  TrelloChecklistItemStateSchema,
  TrelloChecklistListSchema,
  TrelloChecklistSchema,
  TrelloCustomFieldItemListSchema,
  TrelloCustomFieldItemSchema,
  TrelloIdSchema,
  TrelloLabelColorSchema,
  TrelloLabelSchema,
  TrelloListSchema,
  TrelloMemberListSchema,
  TrelloMutationSuccessSchema,
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
      "Comma-separated Trello card fields to request; schema-required fields are added automatically.",
    ),
});

const CardRelationshipFieldsInput = z.object({
  fields: z
    .string()
    .default("all")
    .describe(
      "Comma-separated fields to request for the related Trello resource; schema-required fields are added automatically.",
    ),
});

const CardDueDateInput = CardIdInput.extend({
  due: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe("ISO-8601 due date to set, or null to clear the card due date."),
  dueComplete: z
    .boolean()
    .optional()
    .describe("Whether the due date should be marked complete."),
}).refine(
  (input) => input.due !== undefined || input.dueComplete !== undefined,
  {
    message: "Provide at least one of due or dueComplete.",
    path: ["due"],
  },
);

const CardPositionInput = CardIdInput.extend({
  pos: z
    .union([z.literal("top"), z.literal("bottom"), z.number()])
    .describe(
      "New position for the card within its current or destination list.",
    ),
});

const CardCoverInput = CardIdInput.extend({
  attachmentId: TrelloIdSchema.nullable().describe(
    "Attachment id to use as the card cover, or null to clear the attachment cover.",
  ),
});

const CardLabelCreateInput = CardIdInput.extend({
  name: z.string().min(1).describe("Human-readable label name."),
  color: TrelloLabelColorSchema.describe(
    "Trello label color for the new board label to create and apply.",
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
  setCover: z
    .boolean()
    .optional()
    .describe("Whether Trello should make this URL attachment the card cover."),
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

const ChecklistIdInput = z.object({
  checklistId: TrelloIdSchema.describe("Trello checklist id."),
});

const ChecklistItemIdInput = z.object({
  checkItemId: TrelloIdSchema.describe("Trello checklist item id."),
});

const ChecklistItemPositionInput = z
  .union([z.literal("top"), z.literal("bottom"), z.number()])
  .optional()
  .describe("Position of the checklist item within its checklist.");

const CardChecklistItemCreateInput = ChecklistIdInput.extend({
  name: z.string().min(1).describe("Checklist item text."),
  pos: ChecklistItemPositionInput,
  checked: z
    .boolean()
    .optional()
    .describe("Whether the checklist item should start checked."),
  due: z
    .string()
    .datetime()
    .optional()
    .describe("Optional ISO-8601 due date for the checklist item."),
  dueReminder: z
    .number()
    .int()
    .optional()
    .describe("Optional reminder offset in minutes for the item due date."),
  memberId: TrelloIdSchema.optional().describe(
    "Optional Trello member id assigned to the checklist item.",
  ),
});

const CardChecklistItemUpdateInput = CardIdInput.merge(
  ChecklistItemIdInput,
).extend({
  name: z.string().min(1).optional().describe("Updated checklist item text."),
  state: TrelloChecklistItemStateSchema.optional().describe(
    "Set to complete to check the item or incomplete to uncheck it.",
  ),
  checklistId: TrelloIdSchema.optional().describe(
    "Destination checklist id; include to move the item to another checklist on the card.",
  ),
  pos: ChecklistItemPositionInput,
  due: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe("New ISO-8601 item due date, or null to clear it."),
  dueReminder: z
    .number()
    .int()
    .nullable()
    .optional()
    .describe("New reminder offset in minutes, or null to clear it."),
  memberId: TrelloIdSchema.nullable()
    .optional()
    .describe("Trello member id assigned to the item, or null to unassign."),
});

const CardChecklistItemStateInput = CardIdInput.merge(
  ChecklistItemIdInput,
).extend({
  checked: z.boolean().describe("True checks the item; false unchecks it."),
});

const CardChecklistItemMoveInput = CardIdInput.merge(
  ChecklistItemIdInput,
).extend({
  checklistId: TrelloIdSchema.describe("Destination checklist id on the card."),
  pos: ChecklistItemPositionInput,
});

const CardChecklistItemDeleteInput = CardIdInput.merge(ChecklistItemIdInput);

const CustomFieldIdInput = z.object({
  customFieldId: TrelloIdSchema.describe("Trello custom field definition id."),
});

const CardCustomFieldSetInput = CardIdInput.merge(CustomFieldIdInput)
  .extend({
    type: z
      .enum(["text", "number", "date", "checkbox", "list"])
      .describe("Custom field type for the value being set."),
    text: z.string().optional().describe("Text value for text custom fields."),
    number: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Number value for number custom fields; Trello expects a string.",
      ),
    date: z
      .string()
      .datetime()
      .optional()
      .describe("ISO-8601 date/time value for date custom fields."),
    checked: z
      .boolean()
      .optional()
      .describe("Boolean value for checkbox fields."),
    optionId: TrelloIdSchema.optional().describe(
      "Dropdown/list custom field option id for list fields.",
    ),
  })
  .superRefine((input, ctx) => {
    const requiredByType = {
      checkbox: "checked",
      date: "date",
      list: "optionId",
      number: "number",
      text: "text",
    } as const;
    const requiredKey = requiredByType[input.type];
    if (input[requiredKey] === undefined) {
      ctx.addIssue({
        code: "custom",
        message: `Provide ${requiredKey} when type is ${input.type}.`,
        path: [requiredKey],
      });
    }
  });

const CardCustomFieldClearInput = CardIdInput.merge(CustomFieldIdInput);

const CardCommentCreateInput = CardIdInput.extend({
  text: z.string().min(1).describe("Comment text to add to the card."),
});

const CardCommentUpdateInput = z.object({
  actionId: TrelloIdSchema.describe("Trello comment action id to update."),
  text: z.string().min(1).describe("Updated comment text."),
});

const CardCommentDeleteInput = z.object({
  actionId: TrelloIdSchema.describe("Trello comment action id to delete."),
});

export const cardTools = [
  defineTool({
    name: "trello_card_get",
    description:
      "Use when you need the current details of one Trello card by id, short id, or URL before editing or summarizing it.",
    inputSchema: CardIdInput.merge(CardFieldsInput),
    handler: async ({ cardId, fields }, { trello }) =>
      trello.request(cardPath(cardId), TrelloCardSchema, {
        query: { fields: includeRequiredFields(fields, ["name"]) },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_board",
    description:
      "Use when you need the board relationship for a known Trello card before moving, labeling, or summarizing its context.",
    inputSchema: CardIdInput.merge(CardRelationshipFieldsInput),
    handler: async ({ cardId, fields }, { trello }) =>
      trello.request(`${cardPath(cardId)}/board`, TrelloBoardSchema, {
        query: { fields: includeRequiredFields(fields, ["name"]) },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_list",
    description:
      "Use when you need the current list relationship for a known Trello card before moving or reporting its status.",
    inputSchema: CardIdInput.merge(CardRelationshipFieldsInput),
    handler: async ({ cardId, fields }, { trello }) =>
      trello.request(`${cardPath(cardId)}/list`, TrelloListSchema, {
        query: { fields: includeRequiredFields(fields, ["name"]) },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_labels",
    description:
      "Use when listing the labels currently applied to a card, including label ids for add/remove workflows.",
    inputSchema: CardIdInput,
    handler: async ({ cardId }, { trello }) =>
      trello.request(cardPath(cardId), TrelloCardLabelsSchema, {
        query: { fields: "labels,idLabels" },
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
    name: "trello_card_due_date_set",
    description:
      "Use when setting, clearing, or marking completion of a card due date without changing other card metadata.",
    inputSchema: CardDueDateInput,
    handler: async ({ cardId, due, dueComplete }, { trello }) =>
      trello.request(cardPath(cardId), TrelloCardSchema, {
        method: "PUT",
        query: {
          ...(due !== undefined ? { due } : {}),
          ...(dueComplete !== undefined ? { dueComplete } : {}),
        },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_position_set",
    description:
      "Use when changing only a card's position within its current list; use trello_card_move when changing lists or boards too.",
    inputSchema: CardPositionInput,
    handler: async ({ cardId, pos }, { trello }) =>
      trello.request(cardPath(cardId), TrelloCardSchema, {
        method: "PUT",
        query: { pos },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_cover_set",
    description:
      "Use when setting a card cover to an existing attachment id or clearing the current attachment cover.",
    inputSchema: CardCoverInput,
    handler: async ({ cardId, attachmentId }, { trello }) =>
      trello.request(cardPath(cardId), TrelloCardSchema, {
        method: "PUT",
        query: { idAttachmentCover: attachmentId === null ? "" : attachmentId },
        resourceType: "card",
        resourceId: cardId,
      }),
  }),
  defineTool({
    name: "trello_card_label_create_and_add",
    description:
      "Use when creating a new label on the card's board and applying it to the card in one Trello operation.",
    inputSchema: CardLabelCreateInput,
    handler: async ({ cardId, ...input }, { trello }) =>
      trello.request(`${cardPath(cardId)}/labels`, TrelloLabelSchema, {
        method: "POST",
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
    name: "trello_card_checklist_item_create",
    description:
      "Use when adding a new item to an existing Trello checklist on a card.",
    inputSchema: CardChecklistItemCreateInput,
    handler: async ({ checklistId, memberId, ...input }, { trello }) =>
      trello.request(
        `/checklists/${encodeURIComponent(checklistId)}/checkItems`,
        TrelloChecklistItemSchema,
        {
          method: "POST",
          query: { ...input, idMember: memberId },
          resourceType: "checklist",
          resourceId: checklistId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_checklist_items",
    description:
      "Use when listing the items in one Trello checklist, including complete and incomplete items by default.",
    inputSchema: ChecklistIdInput.extend({
      filter: z
        .enum(["all", "checked", "none", "unchecked"])
        .default("all")
        .describe("Which checklist items to include."),
      fields: z
        .string()
        .default("all")
        .describe(
          "Comma-separated checklist item fields to request; schema-required fields are added automatically.",
        ),
    }),
    handler: async ({ checklistId, filter, fields }, { trello }) =>
      trello.request(
        `/checklists/${encodeURIComponent(checklistId)}/checkItems`,
        TrelloChecklistItemListSchema,
        {
          query: { filter, fields: includeRequiredFields(fields, ["name"]) },
          resourceType: "checklist",
          resourceId: checklistId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_checklist_item_update",
    description:
      "Use when editing a Trello card checklist item text, due date, member assignment, completion state, checklist, or position.",
    inputSchema: CardChecklistItemUpdateInput,
    handler: async (
      { cardId, checkItemId, checklistId, memberId, ...input },
      { trello },
    ) =>
      trello.request(
        `${cardPath(cardId)}/checkItem/${encodeURIComponent(checkItemId)}`,
        TrelloChecklistItemSchema,
        {
          method: "PUT",
          query: { ...input, idChecklist: checklistId, idMember: memberId },
          resourceType: "checklist item",
          resourceId: checkItemId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_checklist_item_set_checked",
    description:
      "Use when checking or unchecking a Trello card checklist item without changing other item fields.",
    inputSchema: CardChecklistItemStateInput,
    handler: async ({ cardId, checkItemId, checked }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/checkItem/${encodeURIComponent(checkItemId)}`,
        TrelloChecklistItemSchema,
        {
          method: "PUT",
          query: { state: checked ? "complete" : "incomplete" },
          resourceType: "checklist item",
          resourceId: checkItemId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_checklist_item_move",
    description:
      "Use when moving a Trello checklist item to another checklist on the same card or to a different position.",
    inputSchema: CardChecklistItemMoveInput,
    handler: async ({ cardId, checkItemId, checklistId, pos }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/checkItem/${encodeURIComponent(checkItemId)}`,
        TrelloChecklistItemSchema,
        {
          method: "PUT",
          query: { idChecklist: checklistId, pos },
          resourceType: "checklist item",
          resourceId: checkItemId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_checklist_item_delete",
    description:
      "Use when deleting a checklist item from a Trello card checklist.",
    inputSchema: CardChecklistItemDeleteInput,
    handler: async ({ cardId, checkItemId }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/checkItem/${encodeURIComponent(checkItemId)}`,
        DeleteResponseSchema,
        {
          method: "DELETE",
          resourceType: "checklist item",
          resourceId: checkItemId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_custom_field_items",
    description:
      "Use when reading all custom field item values currently set on a Trello card.",
    inputSchema: CardIdInput,
    handler: async ({ cardId }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/customFieldItems`,
        TrelloCustomFieldItemListSchema,
        {
          resourceType: "card custom field items",
          resourceId: cardId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_custom_field_set",
    description:
      "Use when setting or updating one Trello card custom field value. Use type-specific inputs: text, number string, ISO date, checkbox boolean, or list optionId.",
    inputSchema: CardCustomFieldSetInput,
    handler: async ({ cardId, customFieldId, ...input }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/customField/${encodeURIComponent(customFieldId)}/item`,
        TrelloCustomFieldItemSchema.or(DeleteResponseSchema),
        {
          method: "PUT",
          body: customFieldItemBody(input),
          resourceType: "card custom field item",
          resourceId: customFieldId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_custom_field_clear",
    description:
      "Use when clearing one Trello card custom field value; Trello clears custom field items with an empty PUT body shape rather than DELETE.",
    inputSchema: CardCustomFieldClearInput,
    handler: async ({ cardId, customFieldId }, { trello }) =>
      trello.request(
        `${cardPath(cardId)}/customField/${encodeURIComponent(customFieldId)}/item`,
        TrelloCustomFieldItemSchema.or(DeleteResponseSchema),
        {
          method: "PUT",
          body: { idValue: "", value: "" },
          resourceType: "card custom field item",
          resourceId: customFieldId,
        },
      ),
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
    handler: async ({ cardId, memberId }, { trello }) => {
      await trello.request(
        `${cardPath(cardId)}/idMembers`,
        TrelloMutationSuccessSchema,
        {
          method: "POST",
          query: { value: memberId },
          resourceType: "card",
          resourceId: cardId,
        },
      );
      return {
        success: true,
        action: "member_added",
        cardId: cardIdentifier(cardId),
        memberId,
      };
    },
  }),
  defineTool({
    name: "trello_card_member_remove",
    description:
      "Use when unassigning a Trello member from a card by member id.",
    inputSchema: CardMemberInput,
    handler: async ({ cardId, memberId }, { trello }) => {
      await trello.request(
        `${cardPath(cardId)}/idMembers/${encodeURIComponent(memberId)}`,
        DeleteResponseSchema.or(TrelloMutationSuccessSchema),
        {
          method: "DELETE",
          resourceType: "card member",
          resourceId: memberId,
        },
      );
      return {
        success: true,
        action: "member_removed",
        cardId: cardIdentifier(cardId),
        memberId,
      };
    },
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
    name: "trello_card_comment_update",
    description:
      "Use when editing the text of an existing Trello card comment by its comment action id.",
    inputSchema: CardCommentUpdateInput,
    handler: async ({ actionId, text }, { trello }) =>
      trello.request(
        `/actions/${encodeURIComponent(actionId)}/text`,
        TrelloActionListSchema.element,
        {
          method: "PUT",
          query: { value: text },
          resourceType: "card comment",
          resourceId: actionId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_comment_delete",
    description:
      "Use when deleting an existing Trello card comment by its comment action id.",
    inputSchema: CardCommentDeleteInput,
    handler: async ({ actionId }, { trello }) =>
      trello.request(
        `/actions/${encodeURIComponent(actionId)}`,
        DeleteResponseSchema,
        {
          method: "DELETE",
          resourceType: "card comment",
          resourceId: actionId,
        },
      ),
  }),
  defineTool({
    name: "trello_card_actions",
    description:
      "Use when auditing recent activity or comments for a card; set filter to commentCard for comments only. Use comment tools to add, edit, or delete comments.",
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

type CardCustomFieldSetValue = Omit<
  z.infer<typeof CardCustomFieldSetInput>,
  "cardId" | "customFieldId"
>;

function customFieldItemBody(
  input: CardCustomFieldSetValue,
): Record<string, unknown> {
  switch (input.type) {
    case "text":
      return { value: { text: input.text } };
    case "number":
      return { value: { number: input.number } };
    case "date":
      return { value: { date: input.date } };
    case "checkbox":
      return { value: { checked: String(input.checked) } };
    case "list":
      return { idValue: input.optionId };
  }
}

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
