import { describe, expect, it, vi } from "vitest";
import { workspaceTools } from "../src/trello/workspaces.js";

type WorkspaceTool = (typeof workspaceTools)[number];

function getWorkspaceTool<TName extends WorkspaceTool["name"]>(
  name: TName,
): Extract<WorkspaceTool, { name: TName }> {
  const tool = workspaceTools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing workspace tool: ${name}`);
  }
  return tool as Extract<WorkspaceTool, { name: TName }>;
}

describe("workspace tools", () => {
  it("lists the current member's workspaces by default", async () => {
    const tool = getWorkspaceTool("list_workspaces");
    const trello = {
      request: vi.fn(async () => [
        { id: "org1", name: "workspace", displayName: "Workspace" },
      ]),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({}), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual([
      { id: "org1", name: "workspace", displayName: "Workspace" },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/members/me/organizations",
      expect.anything(),
      expect.objectContaining({
        query: {
          filter: "all",
          fields:
            "name,displayName,desc,url,website,idBoards,dateLastActivity,prefs",
        },
        resourceType: "member workspaces",
        resourceId: "me",
      }),
    );
  });

  it("adds required workspace names when minimizing fields", async () => {
    const tool = getWorkspaceTool("list_workspaces");
    const trello = {
      request: vi.fn(async () => [
        { id: "org1", name: "workspace", displayName: "Workspace" },
      ]),
    };

    await tool.handler(
      tool.inputSchema.parse({ fields: "url", paidAccount: true }),
      { trello: trello as never, logger: {} as never, requestId: "req1" },
    );

    expect(trello.request).toHaveBeenCalledWith(
      "/members/me/organizations",
      expect.anything(),
      expect.objectContaining({
        query: {
          filter: "all",
          fields: "url,name,displayName",
          paid_account: true,
        },
      }),
    );
  });

  it("gets workspace metadata by id or short name", async () => {
    const tool = getWorkspaceTool("workspace_get");
    const trello = {
      request: vi.fn(async () => ({
        id: "org1",
        name: "team-space",
        displayName: "Team Space",
        idBoards: ["board1"],
      })),
    };

    await expect(
      tool.handler(
        tool.inputSchema.parse({
          workspaceId: "team space",
          fields: "idBoards",
        }),
        {
          trello: trello as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).resolves.toEqual({
      id: "org1",
      name: "team-space",
      displayName: "Team Space",
      idBoards: ["board1"],
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/organizations/team%20space",
      expect.anything(),
      expect.objectContaining({
        query: { fields: "idBoards,name,displayName" },
        resourceType: "workspace",
        resourceId: "team space",
      }),
    );
  });

  it("lists open boards in a workspace by default", async () => {
    const tool = getWorkspaceTool("workspace_boards");
    const trello = {
      request: vi.fn(async () => [{ id: "board1", name: "Roadmap" }]),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({ workspaceId: "org1" }), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual([{ id: "board1", name: "Roadmap" }]);
    expect(trello.request).toHaveBeenCalledWith(
      "/organizations/org1/boards",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          filter: "open",
          fields: expect.stringContaining("name"),
        }),
        resourceType: "workspace boards",
        resourceId: "org1",
      }),
    );
  });

  it("lists workspace members with filter and compact fields", async () => {
    const tool = getWorkspaceTool("workspace_members");
    const trello = {
      request: vi.fn(async () => [
        { id: "member1", username: "ada", fullName: "Ada Lovelace" },
      ]),
    };

    await expect(
      tool.handler(
        tool.inputSchema.parse({
          workspaceId: "org1",
          filter: "owners",
          fields: "avatarUrl",
        }),
        {
          trello: trello as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).resolves.toEqual([
      { id: "member1", username: "ada", fullName: "Ada Lovelace" },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/organizations/org1/members",
      expect.anything(),
      expect.objectContaining({
        query: {
          filter: "owners",
          fields: "avatarUrl,username,fullName",
        },
        resourceType: "workspace members",
        resourceId: "org1",
      }),
    );
  });

  it("lists workspace actions by id or short name with bounded filters", async () => {
    const tool = getWorkspaceTool("workspace_actions");
    const trello = {
      request: vi.fn(
        async (_path: string, schema: { parse: (value: unknown) => unknown }) =>
          schema.parse([
            {
              id: "action1",
              type: "commentCard",
              date: "2026-06-01T00:00:00.000Z",
              data: {
                board: { id: "board1", name: "Roadmap" },
                text: "Ready",
              },
              display: { translationKey: "action_comment_on_card" },
            },
          ]),
      ),
    };

    await expect(
      tool.handler(
        tool.inputSchema.parse({
          workspaceId: "team space",
          filter: "commentCard",
          fields: "date,data,display",
          limit: 10,
          memberCreator: false,
        }),
        {
          trello: trello as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).resolves.toEqual([
      {
        id: "action1",
        type: "commentCard",
        date: "2026-06-01T00:00:00.000Z",
        data: {
          board: { id: "board1", name: "Roadmap" },
          text: "Ready",
        },
        display: { translationKey: "action_comment_on_card" },
      },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/organizations/team%20space/actions",
      expect.anything(),
      expect.objectContaining({
        query: {
          filter: "commentCard",
          fields: "date,data,display,id,type",
          limit: 10,
          page: 0,
          member: false,
          memberCreator: false,
        },
        resourceType: "workspace",
        resourceId: "team space",
      }),
    );
  });

  it("validates workspace ids and collection filters before requesting Trello", () => {
    expect(() =>
      getWorkspaceTool("workspace_get").inputSchema.parse({ workspaceId: "" }),
    ).toThrow();
    expect(() =>
      getWorkspaceTool("workspace_actions").inputSchema.parse({
        workspaceId: "",
      }),
    ).toThrow();
    expect(() =>
      getWorkspaceTool("list_workspaces").inputSchema.parse({
        filter: "closed",
      }),
    ).toThrow();
    expect(() =>
      getWorkspaceTool("workspace_boards").inputSchema.parse({
        workspaceId: "org1",
        filter: "starred",
      }),
    ).toThrow();
    expect(() =>
      getWorkspaceTool("workspace_members").inputSchema.parse({
        workspaceId: "org1",
        filter: "members",
      }),
    ).toThrow();
  });
});
