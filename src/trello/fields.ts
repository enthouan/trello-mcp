import { z } from "zod";

export const DEFAULT_BOARD_FIELDS =
  "name,desc,closed,url,shortUrl,idOrganization,dateLastActivity,prefs,labelNames,subscribed";
export const DEFAULT_WORKSPACE_FIELDS =
  "name,displayName,desc,url,website,idBoards,dateLastActivity,prefs";
export const DEFAULT_LIST_FIELDS = "name,closed,idBoard,pos";
export const DEFAULT_CARD_COLLECTION_FIELDS =
  "name,desc,closed,idBoard,idList,idMembers,idLabels,url,shortUrl,due,dueComplete,pos,dateLastActivity";
export const DEFAULT_MEMBER_FIELDS = "username,fullName,initials,avatarUrl";
export const DEFAULT_ACTION_FIELDS = "id,type,date,data,idMemberCreator";

export function fieldsSchema(
  defaultFields: string,
  resourceName: string,
  addRequiredFields = false,
): z.ZodDefault<z.ZodString> {
  const requiredNote = addRequiredFields
    ? " Schema-required fields are added automatically."
    : "";
  return z
    .string()
    .default(defaultFields)
    .describe(
      `Comma-separated Trello ${resourceName} fields to request; use all for detailed follow-up reads.${requiredNote}`,
    );
}

export function includeRequiredFields(
  fields: string,
  requiredFields: readonly string[],
): string {
  const trimmedFields = fields.trim();
  if (trimmedFields.toLowerCase() === "all") {
    return trimmedFields;
  }

  const requestedFields = trimmedFields
    .split(",")
    .map((field) => field.trim())
    .filter((field) => field.length > 0 && field.toLowerCase() !== "none");
  const requestedFieldSet = new Set(requestedFields);

  for (const requiredField of requiredFields) {
    if (!requestedFieldSet.has(requiredField)) {
      requestedFields.push(requiredField);
      requestedFieldSet.add(requiredField);
    }
  }

  return requestedFields.join(",");
}
