import { z } from "zod";
import { defineTool } from "../utils/tool.js";
import {
  DEFAULT_BOARD_FIELDS,
  DEFAULT_MEMBER_FIELDS,
  DEFAULT_WORKSPACE_FIELDS,
  fieldsSchema,
  includeRequiredFields,
} from "./fields.js";
import {
  TrelloBoardListSchema,
  TrelloIdSchema,
  TrelloMemberListSchema,
  TrelloOrganizationListSchema,
  TrelloOrganizationSchema,
} from "./types.js";

const WorkspaceIdInput = z.object({
  workspaceId: TrelloIdSchema.describe("Trello workspace id or short name."),
});

const WorkspaceFieldsInput = z.object({
  fields: fieldsSchema(DEFAULT_WORKSPACE_FIELDS, "workspace", true),
});

const ListWorkspacesInput = z.object({
  filter: z
    .enum(["all", "members", "none", "public"])
    .default("all")
    .describe("Which Trello workspaces to include for the current member."),
  fields: WorkspaceFieldsInput.shape.fields,
  paidAccount: z
    .boolean()
    .default(false)
    .describe("Whether to include Trello paid account details when available."),
});

const WorkspaceBoardsInput = WorkspaceIdInput.extend({
  filter: z
    .enum(["all", "closed", "members", "open", "organization", "public"])
    .default("open")
    .describe("Which boards to include from the workspace."),
  fields: fieldsSchema(DEFAULT_BOARD_FIELDS, "board", true),
});

const WorkspaceMembersInput = WorkspaceIdInput.extend({
  filter: z
    .enum(["admins", "all", "none", "normal", "owners"])
    .default("all")
    .describe("Which workspace members to include."),
  fields: fieldsSchema(DEFAULT_MEMBER_FIELDS, "workspace member", true),
});

function workspacePath(workspaceId: string): string {
  return `/organizations/${encodeURIComponent(workspaceId)}`;
}

export const workspaceTools = [
  defineTool({
    name: "list_workspaces",
    description:
      "Use first when the user asks to show Trello workspaces or needs to choose a workspace before drilling into its boards or members.",
    inputSchema: ListWorkspacesInput,
    handler: async ({ filter, fields, paidAccount }, { trello }) =>
      trello.request(
        "/members/me/organizations",
        TrelloOrganizationListSchema,
        {
          query: {
            filter,
            fields: includeRequiredFields(fields, ["name", "displayName"]),
            ...(paidAccount ? { paid_account: true } : {}),
          },
          resourceType: "member workspaces",
          resourceId: "me",
        },
      ),
  }),
  defineTool({
    name: "workspace_get",
    description:
      "Use when you need basic Trello workspace metadata, such as display name, description, URL, website, board ids, or preferences.",
    inputSchema: WorkspaceIdInput.merge(WorkspaceFieldsInput),
    handler: async ({ workspaceId, fields }, { trello }) =>
      trello.request(workspacePath(workspaceId), TrelloOrganizationSchema, {
        query: {
          fields: includeRequiredFields(fields, ["name", "displayName"]),
        },
        resourceType: "workspace",
        resourceId: workspaceId,
      }),
  }),
  defineTool({
    name: "workspace_boards",
    description:
      "Use when you need boards in a known Trello workspace so the user can drill into a workspace board.",
    inputSchema: WorkspaceBoardsInput,
    handler: async ({ workspaceId, filter, fields }, { trello }) =>
      trello.request(
        `${workspacePath(workspaceId)}/boards`,
        TrelloBoardListSchema,
        {
          query: { filter, fields: includeRequiredFields(fields, ["name"]) },
          resourceType: "workspace boards",
          resourceId: workspaceId,
        },
      ),
  }),
  defineTool({
    name: "workspace_members",
    description:
      "Use when you need members in a known Trello workspace before assignment, auditing, or permission review.",
    inputSchema: WorkspaceMembersInput,
    handler: async ({ workspaceId, filter, fields }, { trello }) =>
      trello.request(
        `${workspacePath(workspaceId)}/members`,
        TrelloMemberListSchema,
        {
          query: {
            filter,
            fields: includeRequiredFields(fields, ["username", "fullName"]),
          },
          resourceType: "workspace members",
          resourceId: workspaceId,
        },
      ),
  }),
];
