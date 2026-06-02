import { z } from "zod";
import { defineTool } from "../utils/tool.js";
import {
  TrelloBoardListSchema,
  TrelloBoardSchema,
  TrelloIdSchema,
  TrelloListListSchema,
} from "./types.js";

const BoardIdInput = z.object({
  boardId: TrelloIdSchema.describe("Trello board id to inspect."),
});

const BoardFieldsInput = z.object({
  fields: z
    .string()
    .default("name,desc,closed,url,shortUrl,idOrganization,dateLastActivity")
    .describe(
      "Comma-separated Trello board fields to return; use the default for discovery.",
    ),
});

const ListBoardsInput = z.object({
  filter: z
    .enum([
      "all",
      "closed",
      "members",
      "open",
      "organization",
      "public",
      "starred",
    ])
    .default("open")
    .describe("Which boards to include for the current Trello member."),
  fields: BoardFieldsInput.shape.fields,
});

const BoardListsInput = BoardIdInput.extend({
  filter: z
    .enum(["all", "closed", "none", "open"])
    .default("open")
    .describe("Which lists to include from the board."),
  fields: z
    .string()
    .default("name,closed,idBoard,pos")
    .describe(
      "Comma-separated Trello list fields to return; use the default for discovery.",
    ),
});

export const boardTools = [
  defineTool({
    name: "trello_list_boards",
    description:
      "Use first when the user has not provided a board, list, card id, or Trello URL; returns boards visible to the authenticated Trello member.",
    inputSchema: ListBoardsInput,
    handler: async ({ filter, fields }, { trello }) =>
      trello.request("/members/me/boards", TrelloBoardListSchema, {
        query: { filter, fields },
        resourceType: "member boards",
        resourceId: "me",
      }),
  }),
  defineTool({
    name: "trello_board_get",
    description:
      "Use when you need basic metadata for a known Trello board before listing its lists or summarizing it.",
    inputSchema: BoardIdInput.merge(BoardFieldsInput),
    handler: async ({ boardId, fields }, { trello }) =>
      trello.request(
        `/boards/${encodeURIComponent(boardId)}`,
        TrelloBoardSchema,
        {
          query: { fields },
          resourceType: "board",
          resourceId: boardId,
        },
      ),
  }),
  defineTool({
    name: "trello_board_lists",
    description:
      "Use when you need the lists on a known Trello board so you can find the right list id before listing or creating cards.",
    inputSchema: BoardListsInput,
    handler: async ({ boardId, filter, fields }, { trello }) =>
      trello.request(
        `/boards/${encodeURIComponent(boardId)}/lists`,
        TrelloListListSchema,
        {
          query: { filter, fields },
          resourceType: "board",
          resourceId: boardId,
        },
      ),
  }),
];
