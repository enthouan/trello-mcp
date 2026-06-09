import { describe, expect, it, vi } from "vitest";
import { authTools } from "../src/trello/auth.js";
import { TrelloTokenSchema } from "../src/trello/types.js";

type AuthTool = (typeof authTools)[number];

function getAuthTool<TName extends AuthTool["name"]>(
  name: TName,
): Extract<AuthTool, { name: TName }> {
  const tool = authTools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing auth tool: ${name}`);
  }
  return tool as Extract<AuthTool, { name: TName }>;
}

describe("auth diagnostic tools", () => {
  it("gets the authenticated Trello member with compact defaults", async () => {
    const tool = getAuthTool("auth_whoami");
    const trello = {
      request: vi.fn(async () => ({
        id: "member1",
        username: "ada",
        fullName: "Ada Lovelace",
      })),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({}), {
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
      "/members/me",
      expect.anything(),
      expect.objectContaining({
        query: {
          fields: "username,fullName,initials,avatarUrl",
        },
        resourceType: "authenticated member",
        resourceId: "me",
      }),
    );
  });

  it("keeps username when auth member fields are minimized", async () => {
    const tool = getAuthTool("auth_whoami");
    const trello = {
      request: vi.fn(async () => ({ id: "member1", username: "ada" })),
    };

    await tool.handler(tool.inputSchema.parse({ fields: "initials" }), {
      trello: trello as never,
      logger: {} as never,
      requestId: "req1",
    });

    expect(trello.request).toHaveBeenCalledWith(
      "/members/me",
      expect.anything(),
      expect.objectContaining({
        query: { fields: "initials,username" },
      }),
    );
  });

  it("gets configured token diagnostics without accepting a token input", async () => {
    const tool = getAuthTool("auth_token_info");
    const trello = {
      requestConfiguredToken: vi.fn(async () => ({
        id: "tokenRecord1",
        identifier: "trello-mcp",
        idMember: "member1",
        permissions: [{ idModel: "board1", modelType: "board", read: true }],
      })),
    };

    await expect(
      tool.handler(tool.inputSchema.parse({}), {
        trello: trello as never,
        logger: {} as never,
        requestId: "req1",
      }),
    ).resolves.toEqual({
      id: "tokenRecord1",
      identifier: "trello-mcp",
      idMember: "member1",
      permissions: [{ idModel: "board1", modelType: "board", read: true }],
    });
    expect(tool.inputSchema.keyof().options).toEqual(["fields"]);
    expect(trello.requestConfiguredToken).toHaveBeenCalledWith(
      expect.anything(),
      {
        query: {
          fields: "identifier,idMember,dateCreated,dateExpires,permissions,id",
        },
      },
    );
  });

  it("keeps token id and member id when token fields are minimized", async () => {
    const tool = getAuthTool("auth_token_info");
    const trello = {
      requestConfiguredToken: vi.fn(async () => ({
        id: "tokenRecord1",
        idMember: "member1",
      })),
    };

    await tool.handler(tool.inputSchema.parse({ fields: "dateExpires" }), {
      trello: trello as never,
      logger: {} as never,
      requestId: "req1",
    });

    expect(trello.requestConfiguredToken).toHaveBeenCalledWith(
      expect.anything(),
      {
        query: { fields: "dateExpires,id,idMember" },
      },
    );
  });

  it("parses token diagnostics without passing through unknown fields", () => {
    expect(
      TrelloTokenSchema.parse({
        id: "tokenRecord1",
        identifier: "trello-mcp",
        idMember: "member1",
        dateCreated: "2026-06-08T00:00:00.000Z",
        dateExpires: null,
        permissions: [
          {
            idModel: "board1",
            modelType: "board",
            read: true,
            write: false,
          },
        ],
        token: "should-not-pass-through",
      }),
    ).toEqual({
      id: "tokenRecord1",
      identifier: "trello-mcp",
      idMember: "member1",
      dateCreated: "2026-06-08T00:00:00.000Z",
      dateExpires: null,
      permissions: [
        {
          idModel: "board1",
          modelType: "board",
          read: true,
          write: false,
        },
      ],
    });
  });
});
