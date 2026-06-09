import { describe, expect, it, vi } from "vitest";
import { searchTools } from "../src/trello/search.js";
import {
  TrelloSearchMemberListSchema,
  TrelloSearchResultsSchema,
} from "../src/trello/types.js";

type SearchTool = (typeof searchTools)[number];

function getSearchTool<TName extends SearchTool["name"]>(
  name: TName,
): Extract<SearchTool, { name: TName }> {
  const tool = searchTools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing search tool: ${name}`);
  }
  return tool as Extract<SearchTool, { name: TName }>;
}

describe("search tools", () => {
  it("searches cards and boards with compact defaults", async () => {
    const tool = getSearchTool("search");
    const trello = {
      request: vi.fn(async () => ({
        cards: [{ id: "card1", name: "Fix search" }],
        boards: [{ id: "board1", name: "Roadmap" }],
      })),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ query: "search rollout" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual({
      cards: [{ id: "card1", name: "Fix search" }],
      boards: [{ id: "board1", name: "Roadmap" }],
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/search",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: "search rollout",
          modelTypes: "cards,boards",
          card_fields:
            "name,closed,idBoard,idList,url,shortUrl,due,dateLastActivity",
          cards_limit: 10,
          cards_page: 0,
          board_fields:
            "name,closed,idOrganization,url,shortUrl,dateLastActivity",
          boards_limit: 10,
          organization_fields: "name,displayName,url,website",
          organizations_limit: 10,
          member_fields: "username,fullName,initials,url",
          members_limit: 10,
        }),
        resourceType: "search",
        resourceId: "search rollout",
      }),
    );
  });

  it("passes search scopes, result types, limits, and inclusion flags", async () => {
    const tool = getSearchTool("search");
    const trello = {
      request: vi.fn(async () => ({
        cards: [],
        members: [],
        organizations: [],
      })),
    };

    await tool.handler(
      tool.inputSchema.parse({
        query: "dev",
        modelTypes: ["cards", "members", "organizations"],
        boardIds: ["board1", "board2"],
        organizationIds: ["org1"],
        cardIds: ["card1"],
        cardFields: "closed",
        boardFields: "closed",
        memberFields: "username",
        organizationFields: "name",
        cardsLimit: 25,
        boardsLimit: 5,
        membersLimit: 3,
        organizationsLimit: 2,
        cardsPage: 2,
        partial: true,
        includeCardBoard: true,
        includeCardList: true,
        includeCardMembers: true,
        includeBoardOrganization: true,
      }),
      { trello: trello as never, logger: {} as never, requestId: "req1" },
    );

    expect(trello.request).toHaveBeenCalledWith(
      "/search",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: "dev",
          modelTypes: "cards,members,organizations",
          idBoards: "board1,board2",
          idOrganizations: "org1",
          idCards: "card1",
          card_fields: "closed,name,idBoard,idList",
          cards_limit: 25,
          cards_page: 2,
          board_fields: "closed,name,idOrganization",
          boards_limit: 5,
          organization_fields: "name,displayName",
          organizations_limit: 2,
          member_fields: "username,fullName",
          members_limit: 3,
          partial: true,
          card_board: true,
          card_list: true,
          card_members: true,
          board_organization: true,
        }),
      }),
    );
  });

  it("supports Trello's mine board scope", async () => {
    const tool = getSearchTool("search");
    const trello = {
      request: vi.fn(async () => ({ cards: [] })),
    };

    await tool.handler(
      tool.inputSchema.parse({ query: "invoice", boardIds: "mine" }),
      { trello: trello as never, logger: {} as never, requestId: "req1" },
    );

    expect(trello.request).toHaveBeenCalledWith(
      "/search",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({ idBoards: "mine" }),
      }),
    );
  });

  it("searches members through the dedicated member search endpoint", async () => {
    const tool = getSearchTool("search_members");
    const trello = {
      request: vi.fn(async () => [{ id: "member1", username: "ada" }]),
    };

    await expect(
      tool.handler(
        tool.inputSchema.parse({
          query: "Ada",
          boardId: "board1",
          organizationId: "org1",
          onlyOrgMembers: true,
        }),
        {
          trello: trello as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).resolves.toEqual([{ id: "member1", username: "ada" }]);
    expect(trello.request).toHaveBeenCalledWith(
      "/search/members/",
      expect.anything(),
      expect.objectContaining({
        query: {
          query: "Ada",
          limit: 8,
          idBoard: "board1",
          idOrganization: "org1",
          onlyOrgMembers: true,
        },
        resourceType: "board-scoped member search",
        resourceId: "board1",
      }),
    );
  });

  it("uses organization scope as member search resource metadata", async () => {
    const tool = getSearchTool("search_members");
    const trello = {
      request: vi.fn(async () => [{ id: "member1", username: "ada" }]),
    };

    await tool.handler(
      tool.inputSchema.parse({ query: "Ada", organizationId: "org1" }),
      { trello: trello as never, logger: {} as never, requestId: "req1" },
    );

    expect(trello.request).toHaveBeenCalledWith(
      "/search/members/",
      expect.anything(),
      expect.objectContaining({
        resourceType: "organization-scoped member search",
        resourceId: "org1",
      }),
    );
  });

  it("uses the query as unscoped member search resource metadata", async () => {
    const tool = getSearchTool("search_members");
    const trello = {
      request: vi.fn(async () => [{ id: "member1", username: "ada" }]),
    };

    await tool.handler(tool.inputSchema.parse({ query: "Ada" }), {
      trello: trello as never,
      logger: {} as never,
      requestId: "req1",
    });

    expect(trello.request).toHaveBeenCalledWith(
      "/search/members/",
      expect.anything(),
      expect.objectContaining({
        resourceType: "member search",
        resourceId: "Ada",
      }),
    );
  });

  it("validates search inputs before requesting Trello", () => {
    expect(() =>
      getSearchTool("search").inputSchema.parse({ query: "" }),
    ).toThrow();
    expect(() =>
      getSearchTool("search").inputSchema.parse({
        query: "anything",
        modelTypes: ["actions"],
      }),
    ).toThrow();
    expect(() =>
      getSearchTool("search_members").inputSchema.parse({
        query: "Ada",
        limit: 21,
      }),
    ).toThrow();
  });

  it("parses concise grouped search results", () => {
    expect(
      TrelloSearchResultsSchema.parse({
        cards: [
          {
            id: "card1",
            name: "Fix search",
            idBoard: "board1",
            idList: "list1",
          },
        ],
        boards: [{ id: "board1", name: "Roadmap" }],
        members: [{ id: "member1", username: "ada" }],
        organizations: [{ id: "org1", name: "workspace" }],
      }),
    ).toEqual({
      cards: [
        {
          id: "card1",
          name: "Fix search",
          idBoard: "board1",
          idList: "list1",
        },
      ],
      boards: [{ id: "board1", name: "Roadmap" }],
      members: [{ id: "member1", username: "ada" }],
      organizations: [{ id: "org1", name: "workspace" }],
    });
  });

  it("normalizes array-shaped search responses into result groups", () => {
    const parsed = TrelloSearchResultsSchema.parse([
      { id: "card1", name: "Fix search", idBoard: "board1", idList: "list1" },
      { id: "board1", name: "Roadmap", idOrganization: null },
      { id: "member1", username: "ada", fullName: "Ada Lovelace" },
      { id: "org1", name: "workspace", displayName: "Workspace" },
    ]);

    expect(parsed).toEqual({
      cards: [
        {
          id: "card1",
          name: "Fix search",
          idBoard: "board1",
          idList: "list1",
        },
      ],
      boards: [{ id: "board1", name: "Roadmap", idOrganization: null }],
      members: [{ id: "member1", username: "ada", fullName: "Ada Lovelace" }],
      organizations: [
        { id: "org1", name: "workspace", displayName: "Workspace" },
      ],
    });
  });

  it("keeps explicitly requested member fields in global search results", () => {
    const parsed = TrelloSearchResultsSchema.parse({
      members: [
        {
          id: "member1",
          username: "ada",
          fullName: "Ada Lovelace",
          bio: "long profile text",
        },
      ],
    });

    expect(parsed.members).toEqual([
      {
        id: "member1",
        username: "ada",
        fullName: "Ada Lovelace",
        bio: "long profile text",
      },
    ]);
  });

  it("strips oversized member fields from dedicated member search results", () => {
    expect(
      TrelloSearchMemberListSchema.parse([
        {
          id: "member1",
          username: "ada",
          fullName: "Ada Lovelace",
          email: "ada@example.com",
          bio: "long profile text",
        },
      ]),
    ).toEqual([{ id: "member1", username: "ada", fullName: "Ada Lovelace" }]);
  });
});
