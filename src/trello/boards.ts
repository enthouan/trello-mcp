import { z } from "zod";
import { defineTool } from "../utils/tool.js";
import {
  TrelloBoardListSchema,
  TrelloBoardMembershipListSchema,
  TrelloBoardSchema,
  TrelloCardListSchema,
  TrelloCustomFieldListSchema,
  TrelloIdSchema,
  TrelloLabelListSchema,
  TrelloListListSchema,
  TrelloMemberListSchema,
} from "./types.js";

const BoardIdInput = z.object({
  boardId: TrelloIdSchema.describe("Trello board id to inspect."),
});

const BoardFieldsInput = z.object({
  fields: z
    .string()
    .default(
      "name,desc,closed,url,shortUrl,idOrganization,dateLastActivity,prefs,labelNames,subscribed",
    )
    .describe(
      "Comma-separated Trello board fields to return; use the default for board details, common preferences, and label names.",
    ),
});

const ListBoardsInput = z.object({
  filter: z
    .enum([
      "all",
      "closed",
      "members",
      "open",
      "organization",
      "public",
      "starred",
    ])
    .default("open")
    .describe("Which boards to include for the current Trello member."),
  fields: BoardFieldsInput.shape.fields,
});

const BoardFieldInput = BoardIdInput.extend({
  field: z
    .enum([
      "closed",
      "dateLastActivity",
      "desc",
      "idOrganization",
      "labelNames",
      "name",
      "prefs",
      "shortLink",
      "shortUrl",
      "subscribed",
      "url",
    ])
    .describe(
      "Single board field to read. Use prefs for common board preferences and labelNames for board label names.",
    ),
});

const BoardListsInput = BoardIdInput.extend({
  filter: z
    .enum(["all", "closed", "none", "open"])
    .default("open")
    .describe("Which lists to include from the board."),
  fields: z
    .string()
    .default("name,closed,idBoard,pos")
    .describe(
      "Comma-separated Trello list fields to return; use the default for discovery.",
    ),
});

const BoardCardsInput = BoardIdInput.extend({
  filter: z
    .enum(["all", "closed", "none", "open", "visible"])
    .default("open")
    .describe("Which cards to include from the board."),
  fields: z
    .string()
    .default(
      "name,desc,closed,idBoard,idList,idMembers,idLabels,url,shortUrl,due,dueComplete,pos,dateLastActivity",
    )
    .describe(
      "Comma-separated Trello card fields to return; use the default for personal board summaries.",
    ),
});

const BoardMembersInput = BoardIdInput.extend({
  fields: z
    .string()
    .default("username,fullName,initials,avatarUrl")
    .describe("Comma-separated Trello member fields to return."),
});

const BoardMembershipsInput = BoardIdInput.extend({
  filter: z
    .enum(["admins", "all", "none", "normal"])
    .default("all")
    .describe("Which board memberships to include."),
  member: z
    .boolean()
    .default(true)
    .describe("Whether to include basic member profile details."),
  memberFields: z
    .string()
    .default("username,fullName,initials,avatarUrl")
    .describe("Comma-separated member fields when member is true."),
});

const BoardLabelsInput = BoardIdInput.extend({
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(50)
    .describe("Maximum number of labels to return."),
  fields: z
    .string()
    .default("name,color,uses")
    .describe("Comma-separated Trello label fields to return."),
});

export const boardTools = [
  defineTool({
    name: "trello_list_boards",
    description:
      "Use first when the user has not provided a board, list, card id, or Trello URL; returns boards visible to the authenticated Trello member.",
    inputSchema: ListBoardsInput,
    handler: async ({ filter, fields }, { trello }) =>
      trello.request("/members/me/boards", TrelloBoardListSchema, {
        query: { filter, fields },
        resourceType: "member boards",
        resourceId: "me",
      }),
  }),
  defineTool({
    name: "trello_board_get",
    description:
      "Use when you need board details, common board preferences, or label names for a known Trello board before listing or summarizing it.",
    inputSchema: BoardIdInput.merge(BoardFieldsInput),
    handler: async ({ boardId, fields }, { trello }) =>
      trello.request(
        `/boards/${encodeURIComponent(boardId)}`,
        TrelloBoardSchema,
        {
          query: { fields },
          resourceType: "board",
          resourceId: boardId,
        },
      ),
  }),
  defineTool({
    name: "trello_board_field_get",
    description:
      "Use when you need one specific board field, such as prefs, labelNames, subscribed, name, description, or URL.",
    inputSchema: BoardFieldInput,
    handler: async ({ boardId, field }, { trello }) =>
      trello.request(
        `/boards/${encodeURIComponent(boardId)}/${encodeURIComponent(field)}`,
        z.unknown(),
        {
          resourceType: "board",
          resourceId: boardId,
        },
      ),
  }),
  defineTool({
    name: "trello_board_lists",
    description:
      "Use when you need the lists on a known Trello board so you can find the right list id before listing or creating cards.",
    inputSchema: BoardListsInput,
    handler: async ({ boardId, filter, fields }, { trello }) =>
      trello.request(
        `/boards/${encodeURIComponent(boardId)}/lists`,
        TrelloListListSchema,
        {
          query: { filter, fields },
          resourceType: "board",
          resourceId: boardId,
        },
      ),
  }),
  defineTool({
    name: "trello_board_cards",
    description:
      "Use when you need cards across all lists on a known Trello board for personal planning, review, or summarization.",
    inputSchema: BoardCardsInput,
    handler: async ({ boardId, filter, fields }, { trello }) =>
      trello.request(
        `/boards/${encodeURIComponent(boardId)}/cards`,
        TrelloCardListSchema,
        {
          query: { filter, fields },
          resourceType: "board",
          resourceId: boardId,
        },
      ),
  }),

  defineTool({
    name: "trello_board_custom_fields",
    description:
      "Use when inspecting custom field definitions on a known Trello board, including dropdown/list options when Trello returns them.",
    inputSchema: BoardIdInput,
    handler: async ({ boardId }, { trello }) =>
      trello.request(
        `/boards/${encodeURIComponent(boardId)}/customFields`,
        TrelloCustomFieldListSchema,
        {
          resourceType: "board custom fields",
          resourceId: boardId,
        },
      ),
  }),
  defineTool({
    name: "trello_board_labels",
    description:
      "Use when discovering labels available on a board before creating or updating cards with labels.",
    inputSchema: BoardLabelsInput,
    handler: async ({ boardId, limit, fields }, { trello }) =>
      trello.request(
        `/boards/${encodeURIComponent(boardId)}/labels`,
        TrelloLabelListSchema,
        {
          query: { limit, fields },
          resourceType: "board",
          resourceId: boardId,
        },
      ),
  }),
  defineTool({
    name: "trello_board_members",
    description:
      "Use when you need the members who can access a known Trello board before assigning cards or reviewing collaboration.",
    inputSchema: BoardMembersInput,
    handler: async ({ boardId, fields }, { trello }) =>
      trello.request(
        `/boards/${encodeURIComponent(boardId)}/members`,
        TrelloMemberListSchema,
        {
          query: { fields },
          resourceType: "board",
          resourceId: boardId,
        },
      ),
  }),
  defineTool({
    name: "trello_board_memberships",
    description:
      "Use when you need board membership records, member roles, or permission context for a known Trello board.",
    inputSchema: BoardMembershipsInput,
    handler: async ({ boardId, filter, member, memberFields }, { trello }) =>
      trello.request(
        `/boards/${encodeURIComponent(boardId)}/memberships`,
        TrelloBoardMembershipListSchema,
        {
          query: { filter, member, member_fields: memberFields },
          resourceType: "board",
          resourceId: boardId,
        },
      ),
  }),
];
