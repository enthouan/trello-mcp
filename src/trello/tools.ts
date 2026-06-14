import type { ToolDefinition } from "../utils/tool.js";
import { authTools } from "./auth.js";
import { boardTools } from "./boards.js";
import { cardTools } from "./cards.js";
import { customFieldTools } from "./custom-fields.js";
import { labelTools } from "./labels.js";
import { listTools } from "./lists.js";
import { memberTools } from "./members.js";
import { searchTools } from "./search.js";
import { workspaceTools } from "./workspaces.js";

export const allTools: ToolDefinition[] = [
  ...authTools,
  ...boardTools,
  ...workspaceTools,
  ...memberTools,
  ...listTools,
  ...cardTools,
  ...labelTools,
  ...customFieldTools,
  ...searchTools,
];
