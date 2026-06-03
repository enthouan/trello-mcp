import { z } from "zod";
import { defineTool } from "../utils/tool.js";
import { TrelloIdSchema, TrelloListSchema } from "./types.js";

const ListIdInput = z.object({
  listId: TrelloIdSchema.describe("Trello list id to read or update."),
});

const ListFieldsInput = z.object({
  fields: z
    .string()
    .default("name,closed,idBoard,pos")
    .describe(
      "Comma-separated Trello list fields to return; use the default for list discovery.",
    ),
});

const ListPositionInput = z
  .union([z.literal("top"), z.literal("bottom"), z.number()])
  .optional()
  .describe("Position for the list on its board.");

const CreateListInput = z.object({
  boardId: TrelloIdSchema.describe(
    "Board id where the new Trello list should be created.",
  ),
  name: z.string().min(1).describe("Human-readable list name."),
  pos: ListPositionInput.default("bottom"),
});

const UpdateListInput = ListIdInput.extend({
  name: z.string().min(1).optional().describe("New list name."),
  closed: z
    .boolean()
    .optional()
    .describe("Set true to archive the list; false to unarchive it."),
  pos: ListPositionInput,
});

export const listTools = [
  defineTool({
    name: "trello_list_get",
    description:
      "Use when you need metadata for a known Trello list before creating cards in it or changing it.",
    inputSchema: ListIdInput.merge(ListFieldsInput),
    handler: async ({ listId, fields }, { trello }) =>
      trello.request(listPath(listId), TrelloListSchema, {
        query: { fields },
        resourceType: "list",
        resourceId: listId,
      }),
  }),
  defineTool({
    name: "trello_list_create",
    description: "Use when creating a new Trello list on an existing board.",
    inputSchema: CreateListInput,
    handler: async ({ boardId, ...input }, { trello }) =>
      trello.request("/lists", TrelloListSchema, {
        method: "POST",
        query: { idBoard: boardId, ...input },
        resourceType: "board",
        resourceId: boardId,
      }),
  }),
  defineTool({
    name: "trello_list_update",
    description:
      "Use when renaming a Trello list, changing its position, or setting its archive state.",
    inputSchema: UpdateListInput,
    handler: async ({ listId, ...input }, { trello }) =>
      trello.request(listPath(listId), TrelloListSchema, {
        method: "PUT",
        query: input,
        resourceType: "list",
        resourceId: listId,
      }),
  }),
  defineTool({
    name: "trello_list_archive",
    description:
      "Use when archiving or unarchiving a Trello list while keeping its cards recoverable.",
    inputSchema: ListIdInput.extend({
      closed: z
        .boolean()
        .default(true)
        .describe("True archives the list; false restores it."),
    }),
    handler: async ({ listId, closed }, { trello }) =>
      trello.request(`${listPath(listId)}/closed`, TrelloListSchema, {
        method: "PUT",
        query: { value: closed },
        resourceType: "list",
        resourceId: listId,
      }),
  }),
  defineTool({
    name: "trello_list_move_to_board",
    description: "Use when moving an existing Trello list to another board.",
    inputSchema: ListIdInput.extend({
      boardId: TrelloIdSchema.describe("Destination board id."),
    }),
    handler: async ({ listId, boardId }, { trello }) =>
      trello.request(`${listPath(listId)}/idBoard`, TrelloListSchema, {
        method: "PUT",
        query: { value: boardId },
        resourceType: "list",
        resourceId: listId,
      }),
  }),
];

function listPath(listId: string): string {
  return `/lists/${encodeURIComponent(listId)}`;
}
