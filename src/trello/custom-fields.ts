import { z } from "zod";
import { defineTool } from "../utils/tool.js";
import {
  TrelloCustomFieldOptionListSchema,
  TrelloCustomFieldSchema,
  TrelloIdSchema,
} from "./types.js";

const CustomFieldIdInput = z.object({
  customFieldId: TrelloIdSchema.describe("Trello custom field definition id."),
});

export const customFieldTools = [
  defineTool({
    name: "custom_field_get",
    description:
      "Use when you need one Trello custom field definition by id, including its type and any dropdown/list options Trello returns.",
    inputSchema: CustomFieldIdInput,
    handler: async ({ customFieldId }, { trello }) =>
      trello.request(
        `/customFields/${encodeURIComponent(customFieldId)}`,
        TrelloCustomFieldSchema,
        {
          resourceType: "custom field",
          resourceId: customFieldId,
        },
      ),
  }),
  defineTool({
    name: "custom_field_options",
    description:
      "Use when listing the available options for a Trello dropdown/list custom field before setting a card list custom field value.",
    inputSchema: CustomFieldIdInput,
    handler: async ({ customFieldId }, { trello }) =>
      trello.request(
        `/customFields/${encodeURIComponent(customFieldId)}/options`,
        TrelloCustomFieldOptionListSchema,
        {
          resourceType: "custom field options",
          resourceId: customFieldId,
        },
      ),
  }),
];
