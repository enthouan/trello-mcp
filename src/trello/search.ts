import { z } from "zod";
import { defineTool } from "../utils/tool.js";
import { fieldsSchema, includeRequiredFields } from "./fields.js";
import {
  TrelloIdSchema,
  TrelloSearchMemberListSchema,
  TrelloSearchResultsSchema,
} from "./types.js";

const DEFAULT_SEARCH_CARD_FIELDS =
  "name,closed,idBoard,idList,url,shortUrl,due,dateLastActivity";
const DEFAULT_SEARCH_BOARD_FIELDS =
  "name,closed,idOrganization,url,shortUrl,dateLastActivity";
const DEFAULT_SEARCH_MEMBER_FIELDS = "username,fullName,initials,url";
const DEFAULT_SEARCH_ORGANIZATION_FIELDS = "name,displayName,url,website";

const SearchLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(1000)
  .default(10)
  .describe("Maximum number of Trello search results to return.");

const SearchCardsPageSchema = z
  .number()
  .int()
  .min(0)
  .max(100)
  .default(0)
  .describe("Zero-based result page for card search results.");

const SearchMembersLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(20)
  .default(8)
  .describe(
    "Maximum number of Trello members to return; Trello caps this at 20.",
  );

const SearchQueryInput = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(16384)
    .describe("Natural language Trello search query."),
});

const SearchModelTypeSchema = z.enum([
  "cards",
  "boards",
  "members",
  "organizations",
]);

const BoardScopeSchema = z.union([
  z.literal("mine"),
  z.array(TrelloIdSchema).min(1),
]);

const SearchInput = SearchQueryInput.extend({
  modelTypes: z
    .array(SearchModelTypeSchema)
    .min(1)
    .default(["cards", "boards"])
    .describe("Trello object types to search."),
  boardIds: BoardScopeSchema.optional().describe(
    "Use mine to search the current member's boards, or provide one or more board ids.",
  ),
  organizationIds: z
    .array(TrelloIdSchema)
    .min(1)
    .optional()
    .describe("Optional organization ids to scope search results."),
  cardIds: z
    .array(TrelloIdSchema)
    .min(1)
    .optional()
    .describe("Optional card ids to scope search results."),
  cardFields: fieldsSchema(
    DEFAULT_SEARCH_CARD_FIELDS,
    "card search result",
    true,
  ),
  boardFields: fieldsSchema(
    DEFAULT_SEARCH_BOARD_FIELDS,
    "board search result",
    true,
  ),
  memberFields: fieldsSchema(
    DEFAULT_SEARCH_MEMBER_FIELDS,
    "member search result",
  ),
  organizationFields: fieldsSchema(
    DEFAULT_SEARCH_ORGANIZATION_FIELDS,
    "organization search result",
    true,
  ),
  cardsLimit: SearchLimitSchema,
  boardsLimit: SearchLimitSchema,
  membersLimit: SearchLimitSchema,
  organizationsLimit: SearchLimitSchema,
  cardsPage: SearchCardsPageSchema,
  partial: z
    .boolean()
    .default(false)
    .describe("Whether to match query word prefixes in Trello search."),
  includeCardBoard: z
    .boolean()
    .default(false)
    .describe("Whether to include parent board objects with card results."),
  includeCardList: z
    .boolean()
    .default(false)
    .describe("Whether to include parent list objects with card results."),
  includeCardMembers: z
    .boolean()
    .default(false)
    .describe("Whether to include member objects with card results."),
  includeBoardOrganization: z
    .boolean()
    .default(false)
    .describe(
      "Whether to include parent organization objects with board results.",
    ),
});

const SearchMembersInput = SearchQueryInput.extend({
  limit: SearchMembersLimitSchema,
  boardId: TrelloIdSchema.optional().describe(
    "Optional board id to scope member search.",
  ),
  organizationId: TrelloIdSchema.optional().describe(
    "Optional organization id to scope member search.",
  ),
  onlyOrgMembers: z
    .boolean()
    .default(false)
    .describe("Whether to restrict results to organization members."),
});

function joinedIds(ids: "mine" | string[] | undefined): string | undefined {
  if (ids === undefined || ids === "mine") {
    return ids;
  }

  return ids.join(",");
}

export const searchTools = [
  defineTool({
    name: "search",
    description:
      "Use when you need to find Trello cards, boards, members, or organizations by natural language search terms.",
    inputSchema: SearchInput,
    handler: async (
      {
        query,
        modelTypes,
        boardIds,
        organizationIds,
        cardIds,
        cardFields,
        boardFields,
        memberFields,
        organizationFields,
        cardsLimit,
        boardsLimit,
        membersLimit,
        organizationsLimit,
        cardsPage,
        partial,
        includeCardBoard,
        includeCardList,
        includeCardMembers,
        includeBoardOrganization,
      },
      { trello },
    ) =>
      trello.request("/search", TrelloSearchResultsSchema, {
        query: {
          query,
          modelTypes: modelTypes.join(","),
          idBoards: joinedIds(boardIds),
          idOrganizations: joinedIds(organizationIds),
          idCards: joinedIds(cardIds),
          card_fields: includeRequiredFields(cardFields, [
            "name",
            "idBoard",
            "idList",
          ]),
          cards_limit: cardsLimit,
          cards_page: cardsPage,
          board_fields: includeRequiredFields(boardFields, ["name"]),
          boards_limit: boardsLimit,
          organization_fields: includeRequiredFields(organizationFields, [
            "name",
          ]),
          organizations_limit: organizationsLimit,
          member_fields: includeRequiredFields(memberFields, [
            "username",
            "fullName",
          ]),
          members_limit: membersLimit,
          ...(partial ? { partial } : {}),
          ...(includeCardBoard ? { card_board: true } : {}),
          ...(includeCardList ? { card_list: true } : {}),
          ...(includeCardMembers ? { card_members: true } : {}),
          ...(includeBoardOrganization ? { board_organization: true } : {}),
        },
        resourceType: "search",
        resourceId: query,
      }),
  }),
  defineTool({
    name: "search_members",
    description:
      "Use when looking up Trello members by name or username, optionally scoped to a board or organization.",
    inputSchema: SearchMembersInput,
    handler: async (
      { query, limit, boardId, organizationId, onlyOrgMembers },
      { trello },
    ) =>
      trello.request("/search/members/", TrelloSearchMemberListSchema, {
        query: {
          query,
          limit,
          idBoard: boardId,
          idOrganization: organizationId,
          ...(onlyOrgMembers ? { onlyOrgMembers } : {}),
        },
        resourceType: "member search",
        resourceId: query,
      }),
  }),
];
