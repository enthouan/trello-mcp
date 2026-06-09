import { z } from "zod";
import { defineTool } from "../utils/tool.js";
import { fieldsSchema, includeRequiredFields } from "./fields.js";
import { TrelloMemberSchema, TrelloTokenSchema } from "./types.js";

const DEFAULT_AUTH_MEMBER_FIELDS = "username,fullName,initials,avatarUrl";
const DEFAULT_TOKEN_FIELDS =
  "identifier,idMember,dateCreated,dateExpires,permissions";

const AuthMemberInput = z.object({
  fields: fieldsSchema(DEFAULT_AUTH_MEMBER_FIELDS, "authenticated member"),
});

const AuthTokenInput = z.object({
  fields: fieldsSchema(DEFAULT_TOKEN_FIELDS, "configured token", true),
});

export const authTools = [
  defineTool({
    name: "auth_whoami",
    description:
      "Use as a read-only credential diagnostic to confirm which Trello member the configured API key and token authenticate as.",
    inputSchema: AuthMemberInput,
    handler: async ({ fields }, { trello }) =>
      trello.request("/members/me", TrelloMemberSchema, {
        query: { fields: includeRequiredFields(fields, ["username"]) },
        resourceType: "authenticated member",
        resourceId: "me",
      }),
  }),
  defineTool({
    name: "auth_token_info",
    description:
      "Use as a read-only credential diagnostic to inspect the configured Trello token's owner, expiration, and permissions; it does not create, refresh, revoke, or manage tokens.",
    inputSchema: AuthTokenInput,
    handler: async ({ fields }, { trello }) =>
      trello.requestConfiguredToken(TrelloTokenSchema, {
        query: { fields: includeRequiredFields(fields, ["id", "idMember"]) },
      }),
  }),
];
