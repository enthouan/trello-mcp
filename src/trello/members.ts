import { z } from "zod";
import { PagingInput, pagingQuery } from "../utils/pagination.js";
import { defineTool } from "../utils/tool.js";
import {
  DEFAULT_BOARD_FIELDS,
  DEFAULT_CARD_COLLECTION_FIELDS,
  DEFAULT_MEMBER_FIELDS,
  fieldsSchema,
  includeRequiredFields,
} from "./fields.js";
import {
  TrelloBoardListSchema,
  TrelloCardListSchema,
  TrelloIdSchema,
  TrelloMemberSchema,
  TrelloOrganizationListSchema,
} from "./types.js";

const DEFAULT_MEMBER_ORGANIZATION_FIELDS =
  "name,displayName,url,website,idBoards";

const MemberIdInput = z.object({
  memberId: TrelloIdSchema.describe("Trello member id, username, or me."),
});

const MemberFieldsInput = z.object({
  fields: fieldsSchema(DEFAULT_MEMBER_FIELDS, "member profile"),
});

const MemberBoardsInput = MemberIdInput.extend({
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
    .describe("Which boards to include for the member."),
  fields: fieldsSchema(DEFAULT_BOARD_FIELDS, "board", true),
});

const MemberCardsInput = MemberIdInput.extend({
  filter: z
    .enum(["all", "closed", "none", "open", "visible"])
    .default("visible")
    .describe("Which cards assigned to the member to include."),
  fields: fieldsSchema(DEFAULT_CARD_COLLECTION_FIELDS, "card", true),
  limit: PagingInput.shape.limit,
  since: PagingInput.shape.since,
  before: PagingInput.shape.before,
});

const MemberOrganizationsInput = MemberIdInput.extend({
  filter: z
    .enum(["all", "members", "none", "public"])
    .default("all")
    .describe("Which Trello workspaces to include for the member."),
  fields: fieldsSchema(DEFAULT_MEMBER_ORGANIZATION_FIELDS, "workspace", true),
  paidAccount: z
    .boolean()
    .default(false)
    .describe("Whether to include Trello paid account details when available."),
});

function memberPath(memberId: string): string {
  return `/members/${encodeURIComponent(memberId)}`;
}

export const memberTools = [
  defineTool({
    name: "member_get",
    description:
      "Use after member search or board member listing to inspect a Trello member profile by id, username, or me before assignment or auditing.",
    inputSchema: MemberIdInput.merge(MemberFieldsInput),
    handler: async ({ memberId, fields }, { trello }) =>
      trello.request(memberPath(memberId), TrelloMemberSchema, {
        query: { fields: includeRequiredFields(fields, ["username"]) },
        resourceType: "member",
        resourceId: memberId,
      }),
  }),
  defineTool({
    name: "member_boards",
    description:
      "Use when you need boards associated with a known Trello member by id, username, or me.",
    inputSchema: MemberBoardsInput,
    handler: async ({ memberId, filter, fields }, { trello }) =>
      trello.request(`${memberPath(memberId)}/boards`, TrelloBoardListSchema, {
        query: { filter, fields: includeRequiredFields(fields, ["name"]) },
        resourceType: "member boards",
        resourceId: memberId,
      }),
  }),
  defineTool({
    name: "member_cards",
    description:
      "Use when you need cards assigned to a known Trello member by id, username, or me.",
    inputSchema: MemberCardsInput,
    handler: async (
      { memberId, filter, fields, limit, since, before },
      { trello },
    ) =>
      trello.request(`${memberPath(memberId)}/cards`, TrelloCardListSchema, {
        query: {
          filter,
          fields: includeRequiredFields(fields, ["name", "idBoard", "idList"]),
          ...pagingQuery({ limit, since, before }),
        },
        resourceType: "member cards",
        resourceId: memberId,
      }),
  }),
  defineTool({
    name: "member_organizations",
    description:
      "Use when you need Trello workspaces associated with a known member by id, username, or me.",
    inputSchema: MemberOrganizationsInput,
    handler: async ({ memberId, filter, fields, paidAccount }, { trello }) =>
      trello.request(
        `${memberPath(memberId)}/organizations`,
        TrelloOrganizationListSchema,
        {
          query: {
            filter,
            fields: includeRequiredFields(fields, ["name", "displayName"]),
            ...(paidAccount ? { paid_account: true } : {}),
          },
          resourceType: "member workspaces",
          resourceId: memberId,
        },
      ),
  }),
];
