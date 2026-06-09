import { describe, expect, it, vi } from "vitest";
import { memberTools } from "../src/trello/members.js";

type MemberTool = (typeof memberTools)[number];

function getMemberTool<TName extends MemberTool["name"]>(
  name: TName,
): Extract<MemberTool, { name: TName }> {
  const tool = memberTools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing member tool: ${name}`);
  }
  return tool as Extract<MemberTool, { name: TName }>;
}

describe("member tools", () => {
  it("gets a member profile by username with compact defaults", async () => {
    const tool = getMemberTool("member_get");
    const trello = {
      request: vi.fn(async () => ({
        id: "member1",
        username: "ada",
        fullName: "Ada Lovelace",
      })),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ memberId: "ada" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual({
      id: "member1",
      username: "ada",
      fullName: "Ada Lovelace",
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/members/ada",
      expect.anything(),
      expect.objectContaining({
        query: { fields: "username,fullName,initials,avatarUrl" },
        resourceType: "member",
        resourceId: "ada",
      }),
    );
  });

  it("keeps username when minimizing member profile fields", async () => {
    const tool = getMemberTool("member_get");
    const trello = {
      request: vi.fn(async () => ({ id: "member1", username: "ada" })),
    };

    await tool.handler(
      tool.inputSchema.parse({ memberId: "member1", fields: "bio" }),
      { trello: trello as never, logger: {} as never, requestId: "req1" },
    );

    expect(trello.request).toHaveBeenCalledWith(
      "/members/member1",
      expect.anything(),
      expect.objectContaining({
        query: { fields: "bio,username" },
      }),
    );
  });

  it("lists member boards with open boards by default", async () => {
    const tool = getMemberTool("member_boards");
    const trello = {
      request: vi.fn(async () => [{ id: "board1", name: "Roadmap" }]),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ memberId: "me" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual([{ id: "board1", name: "Roadmap" }]);
    expect(trello.request).toHaveBeenCalledWith(
      "/members/me/boards",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          filter: "open",
          fields: expect.stringContaining("name"),
        }),
        resourceType: "member boards",
        resourceId: "me",
      }),
    );
  });

  it("lists member cards with compact card fields and paging", async () => {
    const tool = getMemberTool("member_cards");
    const trello = {
      request: vi.fn(async () => [
        {
          id: "card1",
          name: "Follow up",
          idBoard: "board1",
          idList: "list1",
        },
      ]),
    };

    await expect(
      tool.handler(
        tool.inputSchema.parse({
          memberId: "member 1",
          fields: "name",
          since: "2026-06-01T00:00:00.000Z",
          before: null,
        }),
        {
          trello: trello as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).resolves.toEqual([
      { id: "card1", name: "Follow up", idBoard: "board1", idList: "list1" },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/members/member%201/cards",
      expect.anything(),
      expect.objectContaining({
        query: {
          filter: "visible",
          fields: "name,idBoard,idList",
          limit: 50,
          since: "2026-06-01T00:00:00.000Z",
          before: null,
        },
        resourceType: "member cards",
        resourceId: "member 1",
      }),
    );
  });

  it("lists member organizations with paid account details when requested", async () => {
    const tool = getMemberTool("member_organizations");
    const trello = {
      request: vi.fn(async () => [
        { id: "org1", name: "workspace", displayName: "Workspace" },
      ]),
    };

    await expect(
      tool.handler(
        tool.inputSchema.parse({
          memberId: "member1",
          fields: "url",
          paidAccount: true,
        }),
        {
          trello: trello as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).resolves.toEqual([
      { id: "org1", name: "workspace", displayName: "Workspace" },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/members/member1/organizations",
      expect.anything(),
      expect.objectContaining({
        query: {
          filter: "all",
          fields: "url,name,displayName",
          paid_account: true,
        },
        resourceType: "member organizations",
        resourceId: "member1",
      }),
    );
  });

  it("validates member collection filters before requesting Trello", () => {
    expect(() =>
      getMemberTool("member_boards").inputSchema.parse({
        memberId: "member1",
        filter: "visible",
      }),
    ).toThrow();
    expect(() =>
      getMemberTool("member_cards").inputSchema.parse({
        memberId: "member1",
        filter: "members",
      }),
    ).toThrow();
    expect(() =>
      getMemberTool("member_organizations").inputSchema.parse({
        memberId: "member1",
        filter: "closed",
      }),
    ).toThrow();
  });
});
