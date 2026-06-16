import { z } from "zod";
import {
  ActionPagingInput,
  pagingQuery as buildPagingQuery,
} from "../utils/pagination.js";
import {
  DEFAULT_ACTION_FIELDS,
  DEFAULT_MEMBER_FIELDS,
  fieldsSchema,
  includeRequiredFields,
} from "./fields.js";

export const ActionAuditInput = z.object({
  filter: z
    .string()
    .default("all")
    .describe("Trello action filter such as all or commentCard."),
  fields: fieldsSchema(DEFAULT_ACTION_FIELDS, "action", true),
  limit: ActionPagingInput.shape.limit,
  since: ActionPagingInput.shape.since,
  before: ActionPagingInput.shape.before,
  page: ActionPagingInput.shape.page,
  member: z
    .boolean()
    .default(false)
    .describe("Whether to include member objects on actions."),
  memberFields: z
    .string()
    .default(DEFAULT_MEMBER_FIELDS)
    .describe("Comma-separated Trello member fields when member is true."),
  memberCreator: z
    .boolean()
    .default(true)
    .describe("Whether to include the memberCreator object on actions."),
  memberCreatorFields: z
    .string()
    .default(DEFAULT_MEMBER_FIELDS)
    .describe(
      "Comma-separated Trello memberCreator fields when memberCreator is true.",
    ),
});

type ActionAuditQueryInput = z.infer<typeof ActionAuditInput>;

export type ActionAuditQuery = Record<
  string,
  boolean | number | string | null | undefined
>;

export function buildActionAuditQuery({
  filter,
  fields,
  limit,
  since,
  before,
  page,
  member,
  memberFields,
  memberCreator,
  memberCreatorFields,
}: ActionAuditQueryInput): ActionAuditQuery {
  return {
    filter,
    fields: includeRequiredFields(
      fields,
      memberCreator ? ["id", "type", "idMemberCreator"] : ["id", "type"],
    ),
    ...buildPagingQuery({ limit, since, before, page }),
    member,
    ...(member ? { member_fields: memberFields } : {}),
    memberCreator,
    ...(memberCreator ? { memberCreator_fields: memberCreatorFields } : {}),
  };
}
