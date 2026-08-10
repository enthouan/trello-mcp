import { allTools } from "../../../src/trello/tools.js";

export type CatalogBehavior = "delete" | "read" | "write";

type CatalogToolMetadata = readonly [
  name: string,
  behavior: CatalogBehavior,
  result: string,
];

type CategoryDefinition = {
  category: string;
  description: string;
  example: string;
  label: string;
  tools: readonly CatalogToolMetadata[];
};

type InputSchema = {
  description?: string;
  safeParse(value: unknown): { success: boolean };
};

const categoryDefinitions = [
  {
    category: "credentials",
    label: "Credential diagnostics",
    description:
      "Confirm the configured account and inspect token metadata before doing real work.",
    example:
      "Tell me which Trello account this server uses and show the token permissions. Do not make changes.",
    tools: [
      ["auth_whoami", "read", "authenticated member object"],
      ["auth_token_info", "read", "configured token metadata"],
    ],
  },
  {
    category: "boards",
    label: "Boards",
    description:
      "Discover boards and inspect their lists, cards, fields, labels, members, and recent activity.",
    example:
      "List the boards I can access, then show the open lists on the board I choose. Do not make changes.",
    tools: [
      ["list_boards", "read", "board array"],
      ["board_create", "write", "created board object"],
      ["board_get", "read", "board object"],
      ["board_field_get", "read", "selected board field"],
      ["board_actions", "read", "action array"],
      ["board_lists", "read", "list array"],
      ["board_cards", "read", "card array"],
      ["board_custom_fields", "read", "custom field array"],
      ["board_labels", "read", "label array"],
      ["board_members", "read", "member array"],
      ["board_memberships", "read", "membership array"],
    ],
  },
  {
    category: "workspaces",
    label: "Workspaces",
    description:
      "Find Trello workspaces and inspect their metadata, boards, members, and activity.",
    example:
      "List my Trello workspaces and summarize the boards in the workspace I choose. Do not make changes.",
    tools: [
      ["list_workspaces", "read", "workspace array"],
      ["workspace_get", "read", "workspace object"],
      ["workspace_boards", "read", "board array"],
      ["workspace_members", "read", "member array"],
      ["workspace_actions", "read", "action array"],
    ],
  },
  {
    category: "members",
    label: "Members",
    description:
      "Inspect Trello member profiles and the boards, cards, and workspaces visible for them.",
    example:
      "Using this Trello member username or id, list the cards assigned to that member. Do not make changes.",
    tools: [
      ["member_get", "read", "member object"],
      ["member_boards", "read", "board array"],
      ["member_cards", "read", "card array"],
      ["member_workspaces", "read", "workspace array"],
    ],
  },
  {
    category: "lists",
    label: "Lists",
    description:
      "Inspect, create, rename, move, archive, and review cards or activity within lists.",
    example:
      "Show the cards in the Doing list, ordered as Trello returns them. Do not make changes.",
    tools: [
      ["list_get", "read", "list object"],
      ["list_create", "write", "created list object"],
      ["list_update", "write", "updated list object"],
      ["list_archive", "write", "updated list object"],
      ["list_move_to_board", "write", "moved list object"],
      ["list_actions", "read", "action array"],
      ["list_cards", "read", "card array"],
    ],
  },
  {
    category: "cards",
    label: "Cards",
    description:
      "Read, create, update, move, archive, cover, label, or permanently delete individual cards.",
    example:
      "Show me the current details of this card and its board and list. Do not make changes.",
    tools: [
      ["card_get", "read", "card object"],
      ["card_board", "read", "board object"],
      ["card_list", "read", "list object"],
      ["card_create", "write", "created card object"],
      ["card_update", "write", "updated card object"],
      ["card_due_date_set", "write", "updated card object"],
      ["card_position_set", "write", "updated card object"],
      ["card_cover_set", "write", "updated card object"],
      ["card_label_create_and_add", "write", "created label object"],
      ["card_delete", "delete", "validated deletion response"],
      ["card_move", "write", "moved card object"],
      ["card_archive", "write", "updated card object"],
    ],
  },
  {
    category: "attachments",
    label: "Attachments",
    description:
      "Inspect card attachments, add public URLs, upload allowed local files, or remove attachments.",
    example:
      "List the attachments on this card and include their names and URLs. Do not make changes.",
    tools: [
      ["card_attachments", "read", "attachment array"],
      ["card_attachment_get", "read", "attachment object"],
      ["card_attachment_add_url", "write", "created attachment object"],
      ["card_attachment_upload", "write", "uploaded attachment object"],
      ["card_attachment_delete", "delete", "validated deletion response"],
    ],
  },
  {
    category: "checklists",
    label: "Checklists",
    description:
      "Manage card checklists and checklist items, including text, state, ownership, dates, and position.",
    example:
      "Show every checklist and incomplete checklist item on this card. Do not make changes.",
    tools: [
      ["card_checklists", "read", "checklist array"],
      ["card_checklist_create", "write", "created checklist object"],
      ["card_checklist_update", "write", "updated checklist object"],
      ["card_checklist_delete", "delete", "validated deletion response"],
      ["card_checklist_item_create", "write", "created checklist item object"],
      ["card_checklist_items", "read", "checklist item array"],
      ["card_checklist_item_update", "write", "updated checklist item object"],
      [
        "card_checklist_item_set_checked",
        "write",
        "updated checklist item object",
      ],
      ["card_checklist_item_move", "write", "moved checklist item object"],
      ["card_checklist_item_delete", "delete", "validated deletion response"],
    ],
  },
  {
    category: "custom-fields",
    label: "Custom fields",
    description:
      "Inspect custom field definitions and options, then read, set, or clear card values.",
    example:
      "Using this custom field id, show its definition and options, then show the custom field values on this card. Do not make changes.",
    tools: [
      ["card_custom_field_items", "read", "custom field item array"],
      ["card_custom_field_set", "write", "custom field item result"],
      ["card_custom_field_clear", "write", "custom field clear result"],
      ["custom_field_get", "read", "custom field object"],
      ["custom_field_options", "read", "custom field option array"],
    ],
  },
  {
    category: "card-members",
    label: "Card members",
    description:
      "Review card assignments and explicitly assign or unassign Trello members.",
    example:
      "List the members assigned to this card and show their usernames. Do not make changes.",
    tools: [
      ["card_members", "read", "member array"],
      ["card_member_add", "write", "assignment confirmation"],
      ["card_member_remove", "write", "unassignment confirmation"],
    ],
  },
  {
    category: "comments-activity",
    label: "Comments and card activity",
    description:
      "Review card history and add, edit, or permanently delete individual comments.",
    example:
      "Show the latest activity and comments on this card. Do not make changes.",
    tools: [
      ["card_comment_add", "write", "created comment action"],
      ["card_comment_update", "write", "updated comment action"],
      ["card_comment_delete", "delete", "validated deletion response"],
      ["card_actions", "read", "action array"],
    ],
  },
  {
    category: "labels",
    label: "Labels",
    description:
      "Inspect board or card labels, maintain reusable labels, and apply or remove them from cards.",
    example:
      "Using this label id, show its details and list the labels currently applied to this card. Do not make changes.",
    tools: [
      ["card_labels", "read", "card label object"],
      ["label_get", "read", "label object"],
      ["label_create", "write", "created label object"],
      ["label_update", "write", "updated label object"],
      ["label_delete", "delete", "validated deletion response"],
      ["card_label_add", "write", "label assignment confirmation"],
      ["card_label_remove", "write", "label removal confirmation"],
    ],
  },
  {
    category: "search",
    label: "Search",
    description:
      "Search cards, boards, members, and workspaces with explicit scopes, fields, and result limits.",
    example:
      "Search for cards mentioning launch and return at most ten matches. Do not make changes.",
    tools: [
      ["search", "read", "grouped search result object"],
      ["search_members", "read", "member array"],
    ],
  },
] as const satisfies readonly CategoryDefinition[];

const toolsByName = new Map(allTools.map((tool) => [tool.name, tool]));
const configuredNames = categoryDefinitions.flatMap(({ tools }) =>
  tools.map(([name]) => name),
);
const configuredNameSet = new Set<string>(configuredNames);
const runtimeNameSet = new Set<string>(allTools.map(({ name }) => name));

if (configuredNameSet.size !== configuredNames.length) {
  throw new Error("Tool catalog assigns at least one tool to multiple groups.");
}

const missingNames = allTools
  .map(({ name }) => name)
  .filter((name) => !configuredNameSet.has(name));
const unknownNames = configuredNames.filter(
  (name) => !runtimeNameSet.has(name),
);

if (missingNames.length > 0 || unknownNames.length > 0) {
  throw new Error(
    `Tool catalog grouping drifted from allTools. Missing: ${missingNames.join(", ") || "none"}. Unknown: ${unknownNames.join(", ") || "none"}.`,
  );
}

function toolInputs(toolName: string) {
  const tool = toolsByName.get(toolName);
  if (!tool) throw new Error(`Unknown tool catalog entry: ${toolName}`);
  if (!("shape" in tool.inputSchema)) {
    throw new Error(`Tool input schema is not an object: ${toolName}`);
  }

  return Object.entries(
    tool.inputSchema.shape as Record<string, InputSchema>,
  ).map(([name, schema]) => {
    const description = schema.description?.trim();
    if (!description) {
      throw new Error(`Missing input description: ${toolName}.${name}`);
    }

    return {
      name,
      description,
      required: !schema.safeParse(undefined).success,
    };
  });
}

function toolScope(
  behavior: CatalogBehavior,
  toolName: string,
  inputNames: readonly string[],
): string {
  if (behavior === "delete") return "single permanent deletion";
  if (behavior === "write") return "single Trello mutation";
  if (toolName.startsWith("search")) return "caller-bounded search";
  if (
    inputNames.some((name) =>
      ["before", "limit", "page", "since"].includes(name),
    )
  ) {
    return "caller-bounded collection";
  }
  return "single resource or visible collection";
}

export const CATEGORY_ENTRIES = categoryDefinitions.map(
  ({ tools, ...category }) => ({
    ...category,
    tools: tools.map(([name, behavior, result]) => {
      const tool = toolsByName.get(name);
      if (!tool) throw new Error(`Unknown tool catalog entry: ${name}`);
      const inputs = toolInputs(name);

      return {
        behavior,
        category: category.category,
        description: tool.description,
        inputs,
        name,
        result,
        scope: toolScope(
          behavior,
          name,
          inputs.map((input) => input.name),
        ),
      };
    }),
  }),
);

export const TOOL_COUNT = allTools.length;
export const CATEGORY_COUNT = CATEGORY_ENTRIES.length;
