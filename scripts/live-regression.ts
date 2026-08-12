import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "../src/config.js";
import { TrelloClient } from "../src/trello/client.js";
import { allTools } from "../src/trello/tools.js";
import { createLogger } from "../src/utils/logger.js";
import {
  createLiveToolInvoker,
  type SmokeLogEvent,
  type SmokeToolInvoker,
} from "./live-smoke.js";

const OPT_IN_VALUES = new Set(["1", "true", "yes"]);
const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
] as const satisfies readonly Config["LOG_LEVEL"][];

export const LIVE_REGRESSION_DOMAINS = [
  "auth",
  "boards",
  "lists",
  "cards",
  "labels",
  "checklists",
  "members",
  "workspaces",
  "search",
  "custom-fields",
  "comments-actions",
  "attachments",
] as const;

type LiveRegressionClientConfig = Pick<
  Config,
  "TRELLO_API_KEY" | "TRELLO_TOKEN" | "TRELLO_ATTACHMENT_UPLOAD_ROOT"
>;

export type LiveRegressionDomain = (typeof LIVE_REGRESSION_DOMAINS)[number];

export type LiveRegressionConfig = LiveRegressionClientConfig & {
  boardRef: string;
  logLevel: Config["LOG_LEVEL"];
  runId: string;
  domains?: LiveRegressionDomain[];
  jsonReportPath?: string;
  secondaryBoardRef?: string;
  tools?: string[];
  uploadFile?: string;
};

export type LiveRegressionCliOptions = {
  domains?: string[];
  jsonReportPath?: string;
  runId?: string;
  secondaryBoard?: string;
  tools?: string[];
  uploadFile?: string;
};

export type LiveRegressionFilters = {
  domains?: LiveRegressionDomain[];
  tools?: string[];
};

type NormalizedFilters = {
  domains?: ReadonlySet<LiveRegressionDomain>;
  tools?: ReadonlySet<string>;
};

type RegressionArtifact = {
  id: string;
  name: string;
};

type RegressionAttachment = RegressionArtifact & {
  cardId: string;
};

type CleanupReport = {
  attempted: string[];
  completed: string[];
  failures: string[];
  remainingOpenArtifacts: string[];
};

export type CoverageStatus = "covered" | "missing" | "skipped" | "unsupported";

const COVERAGE_STATUSES = [
  "covered",
  "skipped",
  "unsupported",
  "missing",
] as const satisfies readonly CoverageStatus[];

export type ToolCoverageEntry = {
  domain: LiveRegressionDomain;
  status: CoverageStatus;
  tool: string;
  reason?: string;
};

export type LiveRegressionResult = {
  board: RegressionArtifact;
  cleanup: CleanupReport;
  coverage: ToolCoverageEntry[];
  created: {
    attachments: RegressionAttachment[];
    cards: RegressionArtifact[];
    checklistItems: RegressionArtifact[];
    checklists: RegressionArtifact[];
    labels: RegressionArtifact[];
    lists: RegressionArtifact[];
  };
  failures: string[];
  runId: string;
  secondaryBoard?: RegressionArtifact;
  selection: {
    domains: LiveRegressionDomain[];
    tools: string[];
  };
  verified: string[];
};

type RegressionState = {
  boardMembers: unknown[];
  customFields: unknown[];
  labelAssignments: Array<{ cardId: string; labelId: string }>;
  memberAssignments: Array<{ cardId: string; memberId: string }>;
  setCustomFields: Array<{ cardId: string; customFieldId: string }>;
  authMemberId?: string;
  authUsername?: string;
  boardId?: string;
  boardOrganizationId?: string;
  cardId?: string;
  movableListId?: string;
  primaryListId?: string;
  secondaryListId?: string;
  secondaryBoardRef?: string;
  secondaryBoardId?: string;
};

type RegressionContext = {
  filters: NormalizedFilters;
  invoke: SmokeToolInvoker;
  log?: (event: SmokeLogEvent) => void;
  prefix: string;
  result: LiveRegressionResult;
  state: RegressionState;
  uploadFile?: string;
};

const ALL_TOOL_NAMES = allTools.map((tool) => tool.name);
const ALL_TOOL_NAME_SET = new Set(ALL_TOOL_NAMES);
const DOMAIN_SET = new Set<string>(LIVE_REGRESSION_DOMAINS);
const UNSUPPORTED_TOOL_REASONS = new Map<string, string>([
  [
    "board_create",
    "Creates a real Trello board; live regression defers coverage until a verified board cleanup path exists.",
  ],
]);

export class LiveRegressionConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LiveRegressionConfigError";
  }
}

export class LiveRegressionRunError extends Error {
  public readonly result: LiveRegressionResult;

  public constructor(
    message: string,
    result: LiveRegressionResult,
    cause: unknown,
  ) {
    super(message, { cause });
    this.name = "LiveRegressionRunError";
    this.result = result;
  }
}

export function parseLiveRegressionArgs(
  args: readonly string[],
): LiveRegressionCliOptions {
  const options: LiveRegressionCliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    const [flag, inlineValue] = arg.split("=", 2);
    const readValue = (): string => {
      if (inlineValue !== undefined) {
        return inlineValue;
      }
      const next = args[index + 1];
      if (next === undefined) {
        throw new LiveRegressionConfigError(`${flag} requires a value.`);
      }
      index += 1;
      return next;
    };

    switch (flag) {
      case "--domain":
      case "--domains":
        options.domains = [...(options.domains ?? []), readValue()];
        break;
      case "--tool":
      case "--tools":
        options.tools = [...(options.tools ?? []), readValue()];
        break;
      case "--json":
        options.jsonReportPath = readValue();
        break;
      case "--run-id":
        options.runId = readValue();
        break;
      case "--secondary-board":
        options.secondaryBoard = readValue();
        break;
      case "--upload-file":
        options.uploadFile = readValue();
        break;
      case "--help":
        throw new LiveRegressionConfigError(liveRegressionUsage());
      default:
        throw new LiveRegressionConfigError(
          `Unknown live regression option: ${flag}.`,
        );
    }
  }

  return options;
}

export function loadLiveRegressionConfig(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
  cli: LiveRegressionCliOptions = {},
): LiveRegressionConfig {
  const missing: string[] = [];
  if (!isOptedIn(env.TRELLO_LIVE_REGRESSION)) {
    missing.push("TRELLO_LIVE_REGRESSION=1");
  }

  const apiKey = nonEmpty(env.TRELLO_API_KEY);
  if (!apiKey) {
    missing.push("TRELLO_API_KEY");
  }

  const token = nonEmpty(env.TRELLO_TOKEN);
  if (!token) {
    missing.push("TRELLO_TOKEN");
  }

  const boardRef = liveRegressionBoardRef(env);
  if (!boardRef) {
    missing.push(
      "TRELLO_LIVE_REGRESSION_BOARD_ID or TRELLO_LIVE_REGRESSION_BOARD_URL",
    );
  }

  if (missing.length > 0) {
    throw new LiveRegressionConfigError(
      [
        "Live Trello regression was not run.",
        "This command is strictly opt-in and will not contact Trello until every required live-regression variable is set.",
        `Missing: ${missing.join(", ")}.`,
      ].join(" "),
    );
  }

  const domains = parseDomainFilters(
    cli.domains ?? splitFilterValue(env.TRELLO_LIVE_REGRESSION_DOMAINS),
  );
  const tools = parseToolFilters(
    cli.tools ?? splitFilterValue(env.TRELLO_LIVE_REGRESSION_TOOLS),
  );
  assertNonEmptyFilterIntersection(domains, tools);
  const secondaryBoardRef = liveRegressionSecondaryBoardRef(
    env,
    cli.secondaryBoard,
  );

  const config: LiveRegressionConfig = {
    TRELLO_API_KEY: apiKey as string,
    TRELLO_TOKEN: token as string,
    boardRef: boardRef as string,
    logLevel: parseLogLevel(env.LOG_LEVEL),
    runId: regressionRunId(cli.runId ?? env.TRELLO_LIVE_REGRESSION_RUN_ID, now),
  };

  if (domains) {
    config.domains = domains;
  }
  if (tools) {
    config.tools = tools;
  }
  if (secondaryBoardRef) {
    config.secondaryBoardRef = secondaryBoardRef;
  }

  const uploadRoot = nonEmpty(env.TRELLO_ATTACHMENT_UPLOAD_ROOT);
  const uploadFile =
    nonEmpty(cli.uploadFile) ??
    nonEmpty(env.TRELLO_LIVE_REGRESSION_UPLOAD_FILE);
  if (uploadRoot) {
    config.TRELLO_ATTACHMENT_UPLOAD_ROOT = uploadRoot;
  }
  if (uploadRoot && uploadFile) {
    config.uploadFile = uploadFile;
  }

  const jsonReportPath =
    nonEmpty(cli.jsonReportPath) ??
    nonEmpty(env.TRELLO_LIVE_REGRESSION_REPORT_JSON);
  if (jsonReportPath) {
    config.jsonReportPath = jsonReportPath;
  }

  return config;
}

export async function runLiveRegressionSuite(options: {
  boardRef: string;
  domains?: LiveRegressionDomain[];
  invoke: SmokeToolInvoker;
  log?: (event: SmokeLogEvent) => void;
  runId: string;
  secondaryBoardRef?: string;
  tools?: string[];
  uploadFile?: string;
}): Promise<LiveRegressionResult> {
  const boardRef = boardIdentifier(options.boardRef, "boardRef");
  const secondaryBoardRef = options.secondaryBoardRef
    ? boardIdentifier(options.secondaryBoardRef, "secondaryBoardRef")
    : undefined;
  const filters = normalizeFilters(options);
  const prefix = `trello-mcp live regression ${options.runId}`;
  const result = emptyResult(options.runId, boardRef, filters);
  const state: RegressionState = {
    boardMembers: [],
    customFields: [],
    labelAssignments: [],
    memberAssignments: [],
    setCustomFields: [],
  };
  if (secondaryBoardRef) {
    state.secondaryBoardRef = secondaryBoardRef;
  }
  const context: RegressionContext = {
    filters,
    invoke: options.invoke,
    prefix,
    result,
    state,
  };
  if (options.log) {
    context.log = options.log;
  }
  if (options.uploadFile) {
    context.uploadFile = options.uploadFile;
  }

  let failure: unknown;

  options.log?.({
    level: "info",
    message: "Starting live Trello regression",
    details: { boardRef, runId: options.runId },
  });

  try {
    await resolveRegressionBoard(context);
    if (shouldRunDomain(context, "boards")) {
      await runBoardRegression(context);
    }
    if (shouldRunDomain(context, "workspaces")) {
      await runWorkspaceRegression(context);
    }
    if (shouldRunDomain(context, "lists")) {
      await runListRegression(context);
    }
    if (shouldRunDomain(context, "cards")) {
      await runCardRegression(context);
    }
    if (shouldRunDomain(context, "labels")) {
      await runLabelRegression(context);
    }
    if (shouldRunDomain(context, "members")) {
      await runMemberRegression(context);
    }
    if (shouldRunDomain(context, "checklists")) {
      await runChecklistRegression(context);
    }
    if (shouldRunDomain(context, "comments-actions")) {
      await runCommentRegression(context);
    }
    if (shouldRunDomain(context, "attachments")) {
      await runAttachmentRegression(context);
    }
    if (shouldRunDomain(context, "custom-fields")) {
      await runCustomFieldRegression(context);
    }
    if (shouldRunDomain(context, "search")) {
      await runSearchRegression(context);
    }
  } catch (error) {
    failure = error;
    const message = errorMessage(error);
    result.failures.push(message);
    options.log?.({
      level: "error",
      message: "Live regression failed; cleanup will still run",
      details: { error: message },
    });
  } finally {
    await cleanupRegressionArtifacts(context);
  }

  if (state.boardId) {
    await verifyNoOpenArtifacts(context);
  }

  finalizeCoverage(result, filters);

  const missingCoverage = result.coverage.filter(
    (entry) => entry.status === "missing",
  );
  if (
    failure !== undefined ||
    result.cleanup.failures.length > 0 ||
    result.cleanup.remainingOpenArtifacts.length > 0 ||
    missingCoverage.length > 0
  ) {
    throw new LiveRegressionRunError(
      "Live Trello regression failed; cleanup was attempted.",
      result,
      failure,
    );
  }

  options.log?.({
    level: "info",
    message: "Live Trello regression completed",
    details: { boardId: result.board.id, runId: result.runId },
  });

  return result;
}

export function formatLiveRegressionReport(
  result: LiveRegressionResult,
): string {
  const lines = [
    `Live Trello regression run ${result.runId}`,
    `Board: ${result.board.name} (${result.board.id})`,
    ...(result.secondaryBoard
      ? [
          `Secondary board: ${result.secondaryBoard.name} (${result.secondaryBoard.id})`,
        ]
      : []),
    `Selection: ${formatSelection(result.selection)}`,
    `Created: ${result.created.lists.length} lists, ${result.created.cards.length} cards, ${result.created.labels.length} labels, ${result.created.checklists.length} checklists, ${result.created.checklistItems.length} checklist items, ${result.created.attachments.length} attachments`,
    `Verified: ${result.verified.length > 0 ? result.verified.join("; ") : "none"}`,
    `Cleanup: ${result.cleanup.completed.length}/${result.cleanup.attempted.length} steps completed`,
    result.cleanup.remainingOpenArtifacts.length === 0
      ? "Cleanup verification: no open regression artifacts found"
      : `Cleanup verification: remaining artifacts: ${result.cleanup.remainingOpenArtifacts.join(", ")}`,
    "",
    "Coverage:",
  ];

  for (const domain of LIVE_REGRESSION_DOMAINS) {
    const entries = result.coverage.filter((entry) => entry.domain === domain);
    if (entries.length === 0) {
      continue;
    }
    lines.push(`- ${domain}:`);
    for (const status of [
      "covered",
      "skipped",
      "unsupported",
      "missing",
    ] as const) {
      const matches = entries.filter((entry) => entry.status === status);
      if (matches.length === 0) {
        continue;
      }
      lines.push(`  ${status}: ${formatCoverageEntries(matches)}`);
    }
  }

  return lines.join("\n");
}

export async function writeLiveRegressionJsonReport(
  result: LiveRegressionResult,
  path: string,
): Promise<void> {
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(result, null, 2)}\n`);
}

export function formatLiveRegressionMarkdownSummary(
  result: LiveRegressionResult,
  options: { secrets?: readonly string[] } = {},
): string {
  const secrets = options.secrets ?? [];
  const missingCoverage = result.coverage.filter(
    (entry) => entry.status === "missing",
  );
  const failed =
    result.failures.length > 0 ||
    result.cleanup.failures.length > 0 ||
    result.cleanup.remainingOpenArtifacts.length > 0 ||
    missingCoverage.length > 0;
  const lines = [
    "## Live Trello Regression",
    "",
    `**Result:** ${failed ? "Failed" : "Passed"}`,
    `**Run:** \`${markdownInline(result.runId)}\``,
    `**Board:** ${markdownText(result.board.name)} (\`${markdownInline(result.board.id)}\`)`,
    ...(result.secondaryBoard
      ? [
          `**Secondary board:** ${markdownText(result.secondaryBoard.name)} (\`${markdownInline(result.secondaryBoard.id)}\`)`,
        ]
      : []),
    `**Selection:** \`${markdownInline(formatSelection(result.selection))}\``,
    `**Created:** ${result.created.lists.length} lists, ${result.created.cards.length} cards, ${result.created.labels.length} labels, ${result.created.checklists.length} checklists, ${result.created.checklistItems.length} checklist items, ${result.created.attachments.length} attachments`,
    `**Cleanup:** ${result.cleanup.completed.length}/${result.cleanup.attempted.length} steps completed`,
    result.cleanup.remainingOpenArtifacts.length === 0
      ? "**Cleanup verification:** no open regression artifacts found"
      : `**Cleanup verification:** remaining artifacts: ${markdownText(result.cleanup.remainingOpenArtifacts.join(", "))}`,
    "",
    "### Coverage",
    "",
    "| Status | Count |",
    "| --- | ---: |",
  ];

  for (const status of COVERAGE_STATUSES) {
    const count = result.coverage.filter(
      (entry) => entry.status === status,
    ).length;
    lines.push(`| ${status} | ${count} |`);
  }

  appendMarkdownList(
    lines,
    "Failures",
    result.failures.map((failure) => redactedMessage(failure, secrets)),
  );
  appendMarkdownList(
    lines,
    "Cleanup Failures",
    result.cleanup.failures.map((failure) => redactedMessage(failure, secrets)),
  );
  appendMarkdownList(
    lines,
    "Remaining Open Artifacts",
    result.cleanup.remainingOpenArtifacts,
  );
  appendCoverageSection(lines, "Missing Live Coverage", missingCoverage);
  appendCoverageSection(
    lines,
    "Skipped Live Coverage",
    result.coverage.filter((entry) => entry.status === "skipped"),
  );
  appendCoverageSection(
    lines,
    "Unsupported Live Coverage",
    result.coverage.filter((entry) => entry.status === "unsupported"),
  );

  if (result.verified.length > 0) {
    appendMarkdownList(lines, "Verified", result.verified);
  }

  return `${lines.join("\n")}\n`;
}

export async function appendLiveRegressionMarkdownSummary(
  result: LiveRegressionResult,
  path: string,
  options: { secrets?: readonly string[] } = {},
): Promise<void> {
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await appendFile(
    absolutePath,
    formatLiveRegressionMarkdownSummary(result, options),
  );
}

async function resolveRegressionBoard(
  context: RegressionContext,
): Promise<void> {
  const authMember = await objectResult(
    invokeTool(context, "auth_whoami", {
      fields: "username,fullName,initials,avatarUrl",
    }),
    "auth_whoami",
  );
  context.state.authMemberId = stringField(authMember, "id", "auth_whoami");
  const username = optionalStringField(authMember, "username");
  if (username) {
    context.state.authUsername = username;
  }

  await invokeTool(context, "auth_token_info", {
    fields: "identifier,idMember,dateExpires,permissions",
  });

  const board = await objectResult(
    invokeTool(context, "board_get", {
      boardId: context.result.board.id,
      fields: "name,closed,url,idOrganization",
    }),
    "board_get",
  );
  const boardId = stringField(board, "id", "board_get");
  const boardName = stringField(board, "name", "board_get");
  if (board.closed === true) {
    throw new Error("Configured live regression board is closed.");
  }
  context.result.board = { id: boardId, name: boardName };
  context.state.boardId = boardId;
  const organizationId = optionalStringField(board, "idOrganization");
  if (organizationId) {
    context.state.boardOrganizationId = organizationId;
  }

  const visibleBoards = await arrayResult(
    invokeTool(context, "list_boards", {
      fields: "name,closed",
      filter: "open",
    }),
    "list_boards",
  );
  assertContainsId(visibleBoards, boardId, "list_boards");
  if (shouldRunTool(context, "list_move_to_board")) {
    await resolveSecondaryRegressionBoard(context, visibleBoards);
  }
  verify(context.result, `authenticated and resolved board ${boardName}`);
}

async function resolveSecondaryRegressionBoard(
  context: RegressionContext,
  visibleBoards: unknown[],
): Promise<void> {
  const secondaryBoardRef = context.state.secondaryBoardRef;
  if (!secondaryBoardRef) {
    return;
  }

  const secondaryBoard = await objectResult(
    invokeTool(context, "board_get", {
      boardId: secondaryBoardRef,
      fields: "name,closed,url,idOrganization",
    }),
    "secondary board_get",
  );
  const secondaryBoardId = stringField(
    secondaryBoard,
    "id",
    "secondary board_get",
  );
  const secondaryBoardName = stringField(
    secondaryBoard,
    "name",
    "secondary board_get",
  );
  if (secondaryBoard.closed === true) {
    throw new Error("Configured secondary live regression board is closed.");
  }
  if (secondaryBoardId === requireBoardId(context)) {
    throw new Error(
      "Secondary live regression board must be different from the primary board.",
    );
  }
  assertContainsId(
    visibleBoards,
    secondaryBoardId,
    "list_boards for secondary board",
  );
  context.result.secondaryBoard = {
    id: secondaryBoardId,
    name: secondaryBoardName,
  };
  context.state.secondaryBoardId = secondaryBoardId;
  verify(
    context.result,
    `authenticated and resolved secondary board ${secondaryBoardName}`,
  );
}

async function runBoardRegression(context: RegressionContext): Promise<void> {
  const boardId = requireBoardId(context);
  if (shouldRunTool(context, "board_field_get")) {
    await invokeTool(context, "board_field_get", { boardId, field: "name" });
  }
  if (shouldRunTool(context, "board_custom_fields")) {
    await getBoardCustomFields(context);
  }
  if (shouldRunTool(context, "board_lists")) {
    await arrayResult(
      invokeTool(context, "board_lists", {
        boardId,
        fields: "name,closed,idBoard,pos",
        filter: "open",
      }),
      "board_lists",
    );
  }
  if (shouldRunTool(context, "board_cards")) {
    await arrayResult(
      invokeTool(context, "board_cards", {
        boardId,
        fields: "name,idList,closed",
        filter: "open",
        limit: 20,
      }),
      "board_cards",
    );
  }
  if (shouldRunTool(context, "board_labels")) {
    await arrayResult(
      invokeTool(context, "board_labels", {
        boardId,
        fields: "name,color,uses",
        limit: 100,
      }),
      "board_labels",
    );
  }
  if (shouldRunTool(context, "board_members")) {
    await getBoardMembers(context);
  }
  if (shouldRunTool(context, "board_memberships")) {
    await arrayResult(
      invokeTool(context, "board_memberships", {
        boardId,
        filter: "all",
        member: true,
        memberFields: "username,fullName",
      }),
      "board_memberships",
    );
  }
  verify(
    context.result,
    "read board discovery, list, card, label, and member data",
  );
}

async function runWorkspaceRegression(
  context: RegressionContext,
): Promise<void> {
  const workspaces = await arrayResult(
    invokeTool(context, "list_workspaces", {
      fields: "name,displayName,url,website,idBoards",
      filter: "all",
      paidAccount: false,
    }),
    "list_workspaces",
  );
  const workspaceId = context.state.boardOrganizationId ?? firstId(workspaces);
  if (!workspaceId) {
    skipTool(
      context,
      "workspace_get",
      "The configured token does not expose a workspace for the disposable board.",
    );
    skipTool(
      context,
      "workspace_boards",
      "The configured token does not expose a workspace for the disposable board.",
    );
    skipTool(
      context,
      "workspace_members",
      "The configured token does not expose a workspace for the disposable board.",
    );
    return;
  }

  if (shouldRunTool(context, "workspace_get")) {
    await objectResult(
      invokeTool(context, "workspace_get", {
        workspaceId,
        fields: "name,displayName,url,website,idBoards",
      }),
      "workspace_get",
    );
  }
  if (shouldRunTool(context, "workspace_boards")) {
    await arrayResult(
      invokeTool(context, "workspace_boards", {
        workspaceId,
        fields: "name,closed,url",
        filter: "open",
      }),
      "workspace_boards",
    );
  }
  if (shouldRunTool(context, "workspace_members")) {
    await arrayResult(
      invokeTool(context, "workspace_members", {
        workspaceId,
        fields: "username,fullName,initials,avatarUrl",
        filter: "all",
      }),
      "workspace_members",
    );
  }
  verify(context.result, "exercised selected workspace regression scenarios");
}

async function runListRegression(context: RegressionContext): Promise<void> {
  const shouldUseStandardLists = shouldRunAnyTool(context, [
    "list_create",
    "list_get",
    "list_update",
    "list_archive",
  ]);
  const lists = shouldUseStandardLists
    ? await ensureRegressionLists(context)
    : undefined;
  if (lists && shouldRunTool(context, "list_get")) {
    await objectResult(
      invokeTool(context, "list_get", {
        fields: "name,closed,idBoard,pos",
        listId: lists.primaryList.id,
      }),
      "list_get",
    );
  }

  const renamedListName = `${context.prefix} primary list renamed`;
  if (lists && shouldRunTool(context, "list_update")) {
    await objectResult(
      invokeTool(context, "list_update", {
        listId: lists.primaryList.id,
        name: renamedListName,
        pos: "top",
      }),
      "list_update",
    );
    updateArtifactName(
      context.result.created.lists,
      lists.primaryList.id,
      renamedListName,
    );
  }

  if (lists && shouldRunTool(context, "list_archive")) {
    await objectResult(
      invokeTool(context, "list_archive", {
        closed: true,
        listId: lists.secondaryList.id,
      }),
      "list_archive",
    );
    await objectResult(
      invokeTool(context, "list_archive", {
        closed: false,
        listId: lists.secondaryList.id,
      }),
      "list_archive",
    );
  }
  if (shouldRunTool(context, "list_move_to_board")) {
    await runListMoveToBoardRegression(context);
  }
  verify(context.result, "exercised selected list regression scenarios");
}

async function runListMoveToBoardRegression(
  context: RegressionContext,
): Promise<void> {
  const secondaryBoardId = context.state.secondaryBoardId;
  if (!secondaryBoardId) {
    skipTool(
      context,
      "list_move_to_board",
      "Set TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_ID, TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_URL, or --secondary-board to cover cross-board list moves.",
    );
    return;
  }

  const movableList = await ensureMovableRegressionList(context);
  const movedList = await objectResult(
    invokeTool(context, "list_move_to_board", {
      boardId: secondaryBoardId,
      listId: movableList.id,
    }),
    "list_move_to_board",
  );
  const returnedBoardId = optionalStringField(movedList, "idBoard");
  if (returnedBoardId && returnedBoardId !== secondaryBoardId) {
    throw new Error(
      `list_move_to_board returned idBoard=${returnedBoardId}; expected ${secondaryBoardId}.`,
    );
  }
  verify(
    context.result,
    `moved disposable list ${movableList.name} to secondary board`,
  );
}

async function runCardRegression(context: RegressionContext): Promise<void> {
  const card = await ensureRegressionCard(context);
  const lists = await ensureRegressionLists(context);

  if (shouldRunTool(context, "board_cards")) {
    assertContainsId(
      await arrayResult(
        invokeTool(context, "board_cards", {
          boardId: requireBoardId(context),
          fields: "name,idList,closed",
          filter: "open",
          limit: 20,
        }),
        "board_cards",
      ),
      card.id,
      "board_cards",
    );
  }
  if (shouldRunTool(context, "card_get")) {
    await objectResult(
      invokeTool(context, "card_get", {
        cardId: card.id,
        fields:
          "name,desc,idBoard,idList,closed,due,dueComplete,idLabels,labels,idAttachmentCover",
      }),
      "card_get",
    );
  }
  if (shouldRunTool(context, "card_board")) {
    await objectResult(
      invokeTool(context, "card_board", {
        cardId: card.id,
        fields: "name,closed",
      }),
      "card_board",
    );
  }
  if (shouldRunTool(context, "card_list")) {
    await objectResult(
      invokeTool(context, "card_list", {
        cardId: card.id,
        fields: "name,closed,idBoard",
      }),
      "card_list",
    );
  }
  if (shouldRunTool(context, "card_labels")) {
    await objectResult(
      invokeTool(context, "card_labels", { cardId: card.id }),
      "card_labels",
    );
  }
  if (shouldRunTool(context, "list_cards")) {
    assertContainsId(
      await arrayResult(
        invokeTool(context, "list_cards", {
          fields: "name,idList,closed",
          filter: "open",
          listId: lists.primaryList.id,
          limit: 20,
        }),
        "list_cards",
      ),
      card.id,
      "list_cards",
    );
  }

  const updatedCardName = `${context.prefix} card updated`;
  if (shouldRunTool(context, "card_update")) {
    await objectResult(
      invokeTool(context, "card_update", {
        cardId: card.id,
        desc: `Updated by live regression run ${context.result.runId}.`,
        name: updatedCardName,
      }),
      "card_update",
    );
    updateArtifactName(context.result.created.cards, card.id, updatedCardName);
  }
  if (shouldRunTool(context, "card_due_date_set")) {
    await objectResult(
      invokeTool(context, "card_due_date_set", {
        cardId: card.id,
        due: "2030-01-01T00:00:00.000Z",
        dueComplete: false,
      }),
      "card_due_date_set",
    );
  }
  if (shouldRunTool(context, "card_position_set")) {
    await objectResult(
      invokeTool(context, "card_position_set", {
        cardId: card.id,
        pos: "top",
      }),
      "card_position_set",
    );
  }
  if (shouldRunTool(context, "card_cover_set")) {
    await objectResult(
      invokeTool(context, "card_cover_set", {
        attachmentId: null,
        cardId: card.id,
      }),
      "card_cover_set",
    );
  }
  if (shouldRunTool(context, "card_archive")) {
    await objectResult(
      invokeTool(context, "card_archive", { cardId: card.id, closed: true }),
      "card_archive",
    );
    await objectResult(
      invokeTool(context, "card_archive", { cardId: card.id, closed: false }),
      "card_archive",
    );
  }
  if (shouldRunTool(context, "card_move")) {
    const movedCard = await objectResult(
      invokeTool(context, "card_move", {
        cardId: card.id,
        listId: lists.secondaryList.id,
        pos: "bottom",
      }),
      "card_move",
    );
    assertFieldEquals(movedCard, "idList", lists.secondaryList.id, "card_move");
  }
  verify(context.result, "exercised selected card regression scenarios");
}

async function runLabelRegression(context: RegressionContext): Promise<void> {
  const boardId = requireBoardId(context);
  const needsCard = shouldRunAnyTool(context, [
    "card_labels",
    "card_label_add",
    "card_label_remove",
    "card_label_create_and_add",
  ]);
  const needsTrackedLabel = shouldRunAnyTool(context, [
    "label_create",
    "label_get",
    "label_update",
    "label_delete",
    "card_label_add",
    "card_label_remove",
  ]);
  const card = needsCard ? await ensureRegressionCard(context) : undefined;

  if (shouldRunTool(context, "board_labels")) {
    await arrayResult(
      invokeTool(context, "board_labels", {
        boardId,
        fields: "name,color,uses",
        limit: 100,
      }),
      "board_labels",
    );
  }

  const label = needsTrackedLabel
    ? await createTrackedLabel(context, `${context.prefix} label`, "blue")
    : undefined;
  if (label && shouldRunTool(context, "label_get")) {
    await objectResult(
      invokeTool(context, "label_get", { labelId: label.id }),
      "label_get",
    );
  }
  const renamedLabel = `${context.prefix} label updated`;
  if (label && shouldRunTool(context, "label_update")) {
    await objectResult(
      invokeTool(context, "label_update", {
        color: "green",
        labelId: label.id,
        name: renamedLabel,
      }),
      "label_update",
    );
    updateArtifactName(context.result.created.labels, label.id, renamedLabel);
  }

  if (card && shouldRunTool(context, "card_labels")) {
    await objectResult(
      invokeTool(context, "card_labels", { cardId: card.id }),
      "card_labels",
    );
  }
  if (card && label && shouldRunTool(context, "card_label_add")) {
    await invokeTool(context, "card_label_add", {
      cardId: card.id,
      labelId: label.id,
    });
    trackLabelAssignment(context, card.id, label.id);
    if (shouldRunTool(context, "card_labels")) {
      const cardLabels = await objectResult(
        invokeTool(context, "card_labels", { cardId: card.id }),
        "card_labels",
      );
      assertNestedArrayContainsId(
        cardLabels,
        "labels",
        label.id,
        "card_labels",
      );
    }
  }
  if (card && label && shouldRunTool(context, "card_label_remove")) {
    if (
      !context.state.labelAssignments.some(
        (assignment) =>
          assignment.cardId === card.id && assignment.labelId === label.id,
      )
    ) {
      await invokeTool(context, "card_label_add", {
        cardId: card.id,
        labelId: label.id,
      });
      trackLabelAssignment(context, card.id, label.id);
    }
    await invokeTool(context, "card_label_remove", {
      cardId: card.id,
      labelId: label.id,
    });
    untrackLabelAssignment(context, card.id, label.id);
  }

  if (card && shouldRunTool(context, "card_label_create_and_add")) {
    const inlineLabel = await objectResult(
      invokeTool(context, "card_label_create_and_add", {
        cardId: card.id,
        color: "yellow",
        name: `${context.prefix} inline label`,
      }),
      "card_label_create_and_add",
    );
    const inlineLabelId = stringField(
      inlineLabel,
      "id",
      "card_label_create_and_add",
    );
    context.result.created.labels.push({
      id: inlineLabelId,
      name: stringField(inlineLabel, "name", "card_label_create_and_add"),
    });
    trackLabelAssignment(context, card.id, inlineLabelId);
  }
  verify(context.result, "exercised selected label regression scenarios");
}

async function runMemberRegression(context: RegressionContext): Promise<void> {
  const memberId = requireAuthMemberId(context);
  const needsCard = shouldRunAnyTool(context, [
    "card_members",
    "card_member_add",
    "card_member_remove",
  ]);
  const needsBoardMembers = shouldRunAnyTool(context, [
    "board_members",
    "card_member_add",
    "card_member_remove",
  ]);
  const needsAssignableMember = shouldRunAnyTool(context, [
    "card_member_add",
    "card_member_remove",
  ]);
  const card = needsCard ? await ensureRegressionCard(context) : undefined;
  const boardMembers = needsBoardMembers ? await getBoardMembers(context) : [];

  if (shouldRunTool(context, "board_memberships")) {
    await arrayResult(
      invokeTool(context, "board_memberships", {
        boardId: requireBoardId(context),
        filter: "all",
        member: true,
        memberFields: "username,fullName",
      }),
      "board_memberships",
    );
  }
  if (shouldRunTool(context, "member_get")) {
    await objectResult(
      invokeTool(context, "member_get", {
        fields: "username,fullName,initials,avatarUrl",
        memberId,
      }),
      "member_get",
    );
  }
  if (shouldRunTool(context, "member_boards")) {
    await arrayResult(
      invokeTool(context, "member_boards", {
        fields: "name,closed,url",
        filter: "open",
        memberId,
      }),
      "member_boards",
    );
  }
  if (shouldRunTool(context, "member_workspaces")) {
    await arrayResult(
      invokeTool(context, "member_workspaces", {
        fields: "name,displayName,url,website,idBoards",
        filter: "all",
        memberId,
        paidAccount: false,
      }),
      "member_workspaces",
    );
  }
  if (card && shouldRunTool(context, "card_members")) {
    await arrayResult(
      invokeTool(context, "card_members", {
        cardId: card.id,
        fields: "username,fullName,initials,avatarUrl",
      }),
      "card_members",
    );
  }

  if (card && needsAssignableMember) {
    if (containsId(boardMembers, memberId)) {
      await invokeTool(context, "card_member_add", {
        cardId: card.id,
        memberId,
      });
      trackMemberAssignment(context, card.id, memberId);
      if (shouldRunTool(context, "card_members")) {
        assertContainsId(
          await arrayResult(
            invokeTool(context, "card_members", {
              cardId: card.id,
              fields: "username,fullName,initials,avatarUrl",
            }),
            "card_members",
          ),
          memberId,
          "card_members",
        );
      }
      if (shouldRunTool(context, "member_cards")) {
        await arrayResult(
          invokeTool(context, "member_cards", {
            fields: "name,idBoard,idList",
            filter: "visible",
            limit: 20,
            memberId,
          }),
          "member_cards",
        );
      }
      if (shouldRunTool(context, "card_member_remove")) {
        await invokeTool(context, "card_member_remove", {
          cardId: card.id,
          memberId,
        });
        untrackMemberAssignment(context, card.id, memberId);
      }
    } else {
      skipTool(
        context,
        "card_member_add",
        "Authenticated member is not assignable on the disposable board.",
      );
      skipTool(
        context,
        "card_member_remove",
        "Authenticated member is not assignable on the disposable board.",
      );
    }
  }

  if (
    shouldRunTool(context, "member_cards") &&
    (!card || !needsAssignableMember || !containsId(boardMembers, memberId))
  ) {
    await arrayResult(
      invokeTool(context, "member_cards", {
        fields: "name,idBoard,idList",
        filter: "visible",
        limit: 20,
        memberId,
      }),
      "member_cards",
    );
  }
  verify(context.result, "exercised selected member regression scenarios");
}

async function runChecklistRegression(
  context: RegressionContext,
): Promise<void> {
  const card = await ensureRegressionCard(context);
  const needsPrimaryChecklist = shouldRunAnyTool(context, [
    "card_checklist_create",
    "card_checklist_update",
    "card_checklists",
    "card_checklist_item_create",
    "card_checklist_items",
    "card_checklist_item_update",
    "card_checklist_item_set_checked",
    "card_checklist_item_move",
    "card_checklist_item_delete",
    "card_checklist_delete",
  ]);
  const primaryChecklist = needsPrimaryChecklist
    ? await createTrackedChecklist(
        context,
        card.id,
        `${context.prefix} checklist`,
      )
    : undefined;
  const secondaryChecklist = shouldRunTool(context, "card_checklist_item_move")
    ? await createTrackedChecklist(
        context,
        card.id,
        `${context.prefix} secondary checklist`,
      )
    : undefined;

  if (primaryChecklist && shouldRunTool(context, "card_checklists")) {
    assertContainsId(
      await arrayResult(
        invokeTool(context, "card_checklists", { cardId: card.id }),
        "card_checklists",
      ),
      primaryChecklist.id,
      "card_checklists",
    );
  }
  if (primaryChecklist && shouldRunTool(context, "card_checklist_update")) {
    const renamedChecklist = `${context.prefix} checklist renamed`;
    await objectResult(
      invokeTool(context, "card_checklist_update", {
        checklistId: primaryChecklist.id,
        name: renamedChecklist,
        pos: "top",
      }),
      "card_checklist_update",
    );
    updateArtifactName(
      context.result.created.checklists,
      primaryChecklist.id,
      renamedChecklist,
    );
  }
  const needsItem =
    primaryChecklist &&
    shouldRunAnyTool(context, [
      "card_checklist_item_create",
      "card_checklist_items",
      "card_checklist_item_update",
      "card_checklist_item_set_checked",
      "card_checklist_item_move",
      "card_checklist_item_delete",
    ]);
  const item = needsItem
    ? await objectResult(
        invokeTool(context, "card_checklist_item_create", {
          checked: false,
          checklistId: primaryChecklist.id,
          name: `${context.prefix} checklist item`,
          pos: "bottom",
        }),
        "card_checklist_item_create",
      )
    : undefined;
  const checkItemId = item
    ? stringField(item, "id", "card_checklist_item_create")
    : undefined;
  if (item && checkItemId) {
    context.result.created.checklistItems.push({
      id: checkItemId,
      name: stringField(item, "name", "card_checklist_item_create"),
    });
  }
  if (
    primaryChecklist &&
    checkItemId &&
    shouldRunTool(context, "card_checklist_items")
  ) {
    assertContainsId(
      await arrayResult(
        invokeTool(context, "card_checklist_items", {
          checklistId: primaryChecklist.id,
          fields: "name,state,pos",
          filter: "all",
        }),
        "card_checklist_items",
      ),
      checkItemId,
      "card_checklist_items",
    );
  }
  if (checkItemId && shouldRunTool(context, "card_checklist_item_update")) {
    await objectResult(
      invokeTool(context, "card_checklist_item_update", {
        cardId: card.id,
        checkItemId,
        name: `${context.prefix} checklist item updated`,
        state: "incomplete",
      }),
      "card_checklist_item_update",
    );
  }
  if (
    checkItemId &&
    shouldRunTool(context, "card_checklist_item_set_checked")
  ) {
    const checkedItem = await objectResult(
      invokeTool(context, "card_checklist_item_set_checked", {
        cardId: card.id,
        checkItemId,
        checked: true,
      }),
      "card_checklist_item_set_checked",
    );
    assertFieldEquals(
      checkedItem,
      "state",
      "complete",
      "card_checklist_item_set_checked",
    );
  }
  if (
    checkItemId &&
    secondaryChecklist &&
    shouldRunTool(context, "card_checklist_item_move")
  ) {
    await objectResult(
      invokeTool(context, "card_checklist_item_move", {
        cardId: card.id,
        checkItemId,
        checklistId: secondaryChecklist.id,
        pos: "bottom",
      }),
      "card_checklist_item_move",
    );
    if (shouldRunTool(context, "card_checklist_items")) {
      assertContainsId(
        await arrayResult(
          invokeTool(context, "card_checklist_items", {
            checklistId: secondaryChecklist.id,
            fields: "name,state,pos",
            filter: "all",
          }),
          "card_checklist_items",
        ),
        checkItemId,
        "card_checklist_items",
      );
    }
  }
  if (checkItemId && shouldRunTool(context, "card_checklist_item_delete")) {
    await invokeTool(context, "card_checklist_item_delete", {
      cardId: card.id,
      checkItemId,
    });
  }
  if (primaryChecklist && shouldRunTool(context, "card_checklist_delete")) {
    await invokeTool(context, "card_checklist_delete", {
      cardId: card.id,
      checklistId: primaryChecklist.id,
    });
    const checklists = await arrayResult(
      invokeTool(context, "card_checklists", { cardId: card.id }),
      "card_checklists",
    );
    if (containsId(checklists, primaryChecklist.id)) {
      throw new Error(
        "card_checklist_delete did not remove the deleted checklist from card_checklists.",
      );
    }
  }
  verify(context.result, "exercised selected checklist regression scenarios");
}

async function runCommentRegression(context: RegressionContext): Promise<void> {
  const card = await ensureRegressionCard(context);
  const needsComment = shouldRunAnyTool(context, [
    "card_comment_add",
    "card_comment_update",
    "card_actions",
    "board_actions",
    "list_actions",
    "workspace_actions",
    "card_comment_delete",
  ]);
  const comment = needsComment
    ? await objectResult(
        invokeTool(context, "card_comment_add", {
          cardId: card.id,
          text: `${context.prefix} comment`,
        }),
        "card_comment_add",
      )
    : undefined;
  const actionId = comment
    ? stringField(comment, "id", "card_comment_add")
    : undefined;
  if (actionId && shouldRunTool(context, "card_comment_update")) {
    await objectResult(
      invokeTool(context, "card_comment_update", {
        actionId,
        text: `${context.prefix} comment updated`,
      }),
      "card_comment_update",
    );
  }
  if (shouldRunTool(context, "card_actions")) {
    await arrayResult(
      invokeTool(context, "card_actions", {
        cardId: card.id,
        fields: "id,type,date",
        filter: "commentCard",
        limit: 20,
        member: false,
        memberCreator: false,
      }),
      "card_actions",
    );
  }
  if (shouldRunTool(context, "board_actions")) {
    await arrayResult(
      invokeTool(context, "board_actions", {
        boardId: requireBoardId(context),
        fields: "id,type,date",
        filter: "commentCard",
        limit: 20,
        member: false,
        memberCreator: false,
      }),
      "board_actions",
    );
  }
  if (shouldRunTool(context, "list_actions")) {
    const { primaryList } = await ensureRegressionLists(context);
    await arrayResult(
      invokeTool(context, "list_actions", {
        listId: primaryList.id,
        fields: "id,type,date",
        filter: "commentCard",
        limit: 20,
        member: false,
        memberCreator: false,
      }),
      "list_actions",
    );
  }
  if (shouldRunTool(context, "workspace_actions")) {
    const workspaceId = context.state.boardOrganizationId;
    if (!workspaceId) {
      skipTool(
        context,
        "workspace_actions",
        "The disposable board does not belong to a workspace.",
      );
    } else {
      await arrayResult(
        invokeTool(context, "workspace_actions", {
          workspaceId,
          fields: "id,type,date",
          filter: "commentCard",
          limit: 20,
          member: false,
          memberCreator: false,
        }),
        "workspace_actions",
      );
    }
  }
  if (actionId && shouldRunTool(context, "card_comment_delete")) {
    await invokeTool(context, "card_comment_delete", { actionId });
  }
  verify(
    context.result,
    "exercised selected comment/action regression scenarios",
  );
}

async function runAttachmentRegression(
  context: RegressionContext,
): Promise<void> {
  const card = await ensureRegressionCard(context);
  if (shouldRunTool(context, "card_attachments")) {
    await arrayResult(
      invokeTool(context, "card_attachments", {
        cardId: card.id,
        fields: "id,name,url,bytes,date,edgeColor",
      }),
      "card_attachments",
    );
  }

  let attachmentId: string | undefined;
  if (
    shouldRunAnyTool(context, [
      "card_attachment_add_url",
      "card_attachment_get",
      "card_cover_set",
      "card_attachment_delete",
    ])
  ) {
    const attachment = await objectResult(
      invokeTool(context, "card_attachment_add_url", {
        cardId: card.id,
        name: `${context.prefix} URL attachment`,
        setCover: false,
        url: "https://trello-mcp.com/social-card.png",
      }),
      "card_attachment_add_url",
    );
    attachmentId = stringField(attachment, "id", "card_attachment_add_url");
    trackAttachment(
      context,
      card.id,
      attachmentId,
      stringField(attachment, "name", "card_attachment_add_url"),
    );
  }
  if (attachmentId && shouldRunTool(context, "card_attachment_get")) {
    await objectResult(
      invokeTool(context, "card_attachment_get", {
        attachmentId,
        cardId: card.id,
        fields: "all",
      }),
      "card_attachment_get",
    );
  }
  if (attachmentId && shouldRunTool(context, "card_cover_set")) {
    await objectResult(
      invokeTool(context, "card_cover_set", {
        attachmentId,
        cardId: card.id,
        size: "normal",
      }),
      "card_cover_set",
    );
    await objectResult(
      invokeTool(context, "card_cover_set", {
        attachmentId: null,
        cardId: card.id,
      }),
      "card_cover_set",
    );
  }
  if (attachmentId && shouldRunTool(context, "card_attachment_delete")) {
    await invokeTool(context, "card_attachment_delete", {
      attachmentId,
      cardId: card.id,
    });
    untrackAttachment(context, attachmentId);
  }

  if (context.uploadFile && shouldRunTool(context, "card_attachment_upload")) {
    const upload = await objectResult(
      invokeTool(context, "card_attachment_upload", {
        cardId: card.id,
        filePath: context.uploadFile,
        mimeType: "text/plain",
        name: `${context.prefix} uploaded attachment`,
        setCover: false,
      }),
      "card_attachment_upload",
    );
    const uploadId = stringField(upload, "id", "card_attachment_upload");
    trackAttachment(
      context,
      card.id,
      uploadId,
      stringField(upload, "name", "card_attachment_upload"),
    );
    if (shouldRunTool(context, "card_attachment_get")) {
      await objectResult(
        invokeTool(context, "card_attachment_get", {
          attachmentId: uploadId,
          cardId: card.id,
          fields: "all",
        }),
        "card_attachment_get",
      );
    }
  } else {
    skipTool(
      context,
      "card_attachment_upload",
      "Set both TRELLO_ATTACHMENT_UPLOAD_ROOT and TRELLO_LIVE_REGRESSION_UPLOAD_FILE to cover local upload behavior.",
    );
  }
  verify(context.result, "exercised selected attachment regression scenarios");
}

async function runCustomFieldRegression(
  context: RegressionContext,
): Promise<void> {
  const needsCard = shouldRunAnyTool(context, [
    "card_custom_field_items",
    "card_custom_field_set",
    "card_custom_field_clear",
  ]);
  const needsDefinitions = shouldRunAnyTool(context, [
    "board_custom_fields",
    "custom_field_get",
    "custom_field_options",
    "card_custom_field_set",
    "card_custom_field_clear",
  ]);
  const card = needsCard ? await ensureRegressionCard(context) : undefined;
  if (card && shouldRunTool(context, "card_custom_field_items")) {
    await arrayResult(
      invokeTool(context, "card_custom_field_items", { cardId: card.id }),
      "card_custom_field_items",
    );
  }
  if (!needsDefinitions) {
    verify(context.result, "exercised selected custom field scenarios");
    return;
  }

  const customFields = await getBoardCustomFields(context);
  const firstField = firstRecord(customFields);
  if (!firstField) {
    skipTool(
      context,
      "custom_field_get",
      "The disposable board has no custom field definitions.",
    );
    skipTool(
      context,
      "custom_field_options",
      "The disposable board has no dropdown/list custom field definitions.",
    );
    skipTool(
      context,
      "card_custom_field_set",
      "The disposable board has no custom field definitions to write.",
    );
    skipTool(
      context,
      "card_custom_field_clear",
      "The disposable board has no custom field definitions to clear.",
    );
    return;
  }

  const customFieldId = stringField(firstField, "id", "board_custom_fields");
  if (shouldRunTool(context, "custom_field_get")) {
    await objectResult(
      invokeTool(context, "custom_field_get", { customFieldId }),
      "custom_field_get",
    );
  }

  const listField = customFields.find(
    (field) => isRecord(field) && field.type === "list",
  );
  if (isRecord(listField) && shouldRunTool(context, "custom_field_options")) {
    await arrayResult(
      invokeTool(context, "custom_field_options", {
        customFieldId: stringField(listField, "id", "board_custom_fields"),
      }),
      "custom_field_options",
    );
  } else if (shouldRunTool(context, "custom_field_options")) {
    skipTool(
      context,
      "custom_field_options",
      "The disposable board has no dropdown/list custom field definitions.",
    );
  }

  if (
    !card ||
    !shouldRunAnyTool(context, [
      "card_custom_field_set",
      "card_custom_field_clear",
    ])
  ) {
    verify(context.result, "exercised selected custom field scenarios");
    return;
  }

  const settable = writableCustomField(customFields);
  if (!settable) {
    skipTool(
      context,
      "card_custom_field_set",
      "The disposable board has no supported writable custom field value.",
    );
    skipTool(
      context,
      "card_custom_field_clear",
      "The disposable board has no supported writable custom field value.",
    );
    return;
  }

  await objectResult(
    invokeTool(context, "card_custom_field_set", {
      cardId: card.id,
      customFieldId: settable.customFieldId,
      ...settable.input,
    }),
    "card_custom_field_set",
  );
  context.state.setCustomFields.push({
    cardId: card.id,
    customFieldId: settable.customFieldId,
  });
  if (shouldRunTool(context, "card_custom_field_clear")) {
    await objectResult(
      invokeTool(context, "card_custom_field_clear", {
        cardId: card.id,
        customFieldId: settable.customFieldId,
      }),
      "card_custom_field_clear",
    );
    untrackCustomField(context, card.id, settable.customFieldId);
  }
  verify(context.result, "exercised selected custom field scenarios");
}

async function runSearchRegression(context: RegressionContext): Promise<void> {
  const boardId = requireBoardId(context);
  if (shouldRunTool(context, "search")) {
    await ensureRegressionCard(context);
    await objectResult(
      invokeTool(context, "search", {
        boardIds: [boardId],
        boardsLimit: 10,
        cardFields: "name,idBoard,idList,closed",
        cardsLimit: 10,
        includeCardBoard: true,
        includeCardList: true,
        includeCardMembers: true,
        modelTypes: ["cards", "boards"],
        query: context.result.runId,
      }),
      "search",
    );
  }
  const query = context.state.authUsername ?? context.state.authMemberId;
  if (!query && shouldRunTool(context, "search_members")) {
    skipTool(
      context,
      "search_members",
      "Authenticated member response did not include a username or id.",
    );
    return;
  }
  if (query && shouldRunTool(context, "search_members")) {
    await arrayResult(
      invokeTool(context, "search_members", {
        boardId,
        limit: 10,
        query,
      }),
      "search_members",
    );
  }
  verify(context.result, "exercised selected search regression scenarios");
}

async function ensureRegressionLists(context: RegressionContext): Promise<{
  primaryList: RegressionArtifact;
  secondaryList: RegressionArtifact;
}> {
  const existingPrimary = artifactById(
    context.result.created.lists,
    context.state.primaryListId,
  );
  const existingSecondary = artifactById(
    context.result.created.lists,
    context.state.secondaryListId,
  );
  if (existingPrimary && existingSecondary) {
    return { primaryList: existingPrimary, secondaryList: existingSecondary };
  }

  const boardId = requireBoardId(context);
  const primaryList = await createRegressionList(
    context,
    boardId,
    `${context.prefix} primary list`,
  );
  const secondaryList = await createRegressionList(
    context,
    boardId,
    `${context.prefix} target list`,
  );
  context.state.primaryListId = primaryList.id;
  context.state.secondaryListId = secondaryList.id;
  return { primaryList, secondaryList };
}

async function ensureMovableRegressionList(
  context: RegressionContext,
): Promise<RegressionArtifact> {
  const existing = artifactById(
    context.result.created.lists,
    context.state.movableListId,
  );
  if (existing) {
    return existing;
  }

  const list = await createRegressionList(
    context,
    requireBoardId(context),
    `${context.prefix} movable list`,
  );
  context.state.movableListId = list.id;
  return list;
}

async function ensureRegressionCard(
  context: RegressionContext,
): Promise<RegressionArtifact> {
  const existingCard = artifactById(
    context.result.created.cards,
    context.state.cardId,
  );
  if (existingCard) {
    return existingCard;
  }

  const { primaryList } = await ensureRegressionLists(context);
  const card = await objectResult(
    invokeTool(context, "card_create", {
      desc: `Created by live regression run ${context.result.runId}; safe to delete.`,
      listId: primaryList.id,
      name: `${context.prefix} card`,
      pos: "bottom",
    }),
    "card_create",
  );
  const artifact = {
    id: stringField(card, "id", "card_create"),
    name: stringField(card, "name", "card_create"),
  };
  context.state.cardId = artifact.id;
  context.result.created.cards.push(artifact);
  return artifact;
}

async function createRegressionList(
  context: RegressionContext,
  boardId: string,
  name: string,
): Promise<RegressionArtifact> {
  const list = await objectResult(
    invokeTool(context, "list_create", { boardId, name, pos: "bottom" }),
    "list_create",
  );
  const artifact = {
    id: stringField(list, "id", "list_create"),
    name: stringField(list, "name", "list_create"),
  };
  context.result.created.lists.push(artifact);
  return artifact;
}

async function createTrackedLabel(
  context: RegressionContext,
  name: string,
  color: string,
): Promise<RegressionArtifact> {
  const label = await objectResult(
    invokeTool(context, "label_create", {
      boardId: requireBoardId(context),
      color,
      name,
    }),
    "label_create",
  );
  const artifact = {
    id: stringField(label, "id", "label_create"),
    name: stringField(label, "name", "label_create"),
  };
  context.result.created.labels.push(artifact);
  return artifact;
}

async function createTrackedChecklist(
  context: RegressionContext,
  cardId: string,
  name: string,
): Promise<RegressionArtifact> {
  const checklist = await objectResult(
    invokeTool(context, "card_checklist_create", { cardId, name }),
    "card_checklist_create",
  );
  const artifact = {
    id: stringField(checklist, "id", "card_checklist_create"),
    name: stringField(checklist, "name", "card_checklist_create"),
  };
  context.result.created.checklists.push(artifact);
  return artifact;
}

async function getBoardMembers(context: RegressionContext): Promise<unknown[]> {
  if (context.state.boardMembers.length > 0) {
    return context.state.boardMembers;
  }
  const members = await arrayResult(
    invokeTool(context, "board_members", {
      boardId: requireBoardId(context),
      fields: "username,fullName,initials,avatarUrl",
    }),
    "board_members",
  );
  context.state.boardMembers = members;
  return members;
}

async function getBoardCustomFields(
  context: RegressionContext,
): Promise<unknown[]> {
  if (context.state.customFields.length > 0) {
    return context.state.customFields;
  }
  const customFields = await arrayResult(
    invokeTool(context, "board_custom_fields", {
      boardId: requireBoardId(context),
    }),
    "board_custom_fields",
  );
  context.state.customFields = customFields;
  return customFields;
}

async function cleanupRegressionArtifacts(
  context: RegressionContext,
): Promise<void> {
  for (const assignment of [...context.state.memberAssignments].reverse()) {
    await cleanupStep(
      context,
      `remove regression card member ${assignment.memberId}`,
      () =>
        invokeTool(context, "card_member_remove", {
          cardId: assignment.cardId,
          memberId: assignment.memberId,
        }),
    );
    untrackMemberAssignment(context, assignment.cardId, assignment.memberId);
  }

  for (const assignment of [...context.state.labelAssignments].reverse()) {
    await cleanupStep(
      context,
      `remove regression card label ${assignment.labelId}`,
      () =>
        invokeTool(context, "card_label_remove", {
          cardId: assignment.cardId,
          labelId: assignment.labelId,
        }),
    );
    untrackLabelAssignment(context, assignment.cardId, assignment.labelId);
  }

  for (const item of [...context.state.setCustomFields].reverse()) {
    await cleanupStep(
      context,
      `clear regression custom field ${item.customFieldId}`,
      () =>
        invokeTool(context, "card_custom_field_clear", {
          cardId: item.cardId,
          customFieldId: item.customFieldId,
        }),
    );
    untrackCustomField(context, item.cardId, item.customFieldId);
  }

  for (const attachment of [...context.result.created.attachments].reverse()) {
    await cleanupStep(
      context,
      `delete regression attachment ${attachment.id}`,
      () =>
        invokeTool(context, "card_attachment_delete", {
          attachmentId: attachment.id,
          cardId: attachment.cardId,
        }),
    );
    untrackAttachment(context, attachment.id);
  }

  for (const label of [...context.result.created.labels].reverse()) {
    await cleanupStep(context, `delete regression label ${label.id}`, () =>
      invokeTool(context, "label_delete", { labelId: label.id }),
    );
  }

  for (const card of [...context.result.created.cards].reverse()) {
    await cleanupStep(context, `delete regression card ${card.id}`, () =>
      invokeTool(context, "card_delete", { cardId: card.id }),
    );
  }

  for (const board of cleanupBoards(context)) {
    await cleanupUntrackedOpenArtifacts(context, board);
  }

  for (const list of [...context.result.created.lists].reverse()) {
    await cleanupStep(context, `archive regression list ${list.id}`, () =>
      invokeTool(context, "list_archive", { closed: true, listId: list.id }),
    );
  }
}

async function cleanupUntrackedOpenArtifacts(
  context: RegressionContext,
  board: RegressionArtifact,
): Promise<void> {
  const trackedLabelIds = new Set(
    context.result.created.labels.map(({ id }) => id),
  );
  const trackedCardIds = new Set(
    context.result.created.cards.map(({ id }) => id),
  );
  const trackedListIds = new Set(
    context.result.created.lists.map(({ id }) => id),
  );

  let openLists: unknown[];
  let openCards: unknown[];
  let labels: unknown[];
  try {
    [openLists, openCards, labels] = await Promise.all([
      arrayResult(
        invokeTool(context, "board_lists", {
          boardId: board.id,
          fields: "name,closed,idBoard",
          filter: "open",
        }),
        `board_lists untracked cleanup for ${board.id}`,
      ),
      arrayResult(
        invokeTool(context, "board_cards", {
          boardId: board.id,
          fields: "name,closed,idList",
          filter: "open",
          limit: 1000,
        }),
        `board_cards untracked cleanup for ${board.id}`,
      ),
      arrayResult(
        invokeTool(context, "board_labels", {
          boardId: board.id,
          fields: "name,color",
          limit: 1000,
        }),
        `board_labels untracked cleanup for ${board.id}`,
      ),
    ]);
  } catch (error) {
    const message = `discover untracked regression artifacts on board ${board.id}: ${errorMessage(error)}`;
    context.result.cleanup.failures.push(message);
    context.log?.({
      level: "warn",
      message: "Untracked cleanup discovery failed",
      details: { error: message },
    });
    return;
  }

  const untrackedLabels = untrackedArtifacts(
    labels,
    context.prefix,
    trackedLabelIds,
  );
  const untrackedCards = untrackedArtifacts(
    openCards,
    context.prefix,
    trackedCardIds,
  );
  const untrackedLists = untrackedArtifacts(
    openLists,
    context.prefix,
    trackedListIds,
  );

  for (const label of untrackedLabels.reverse()) {
    await cleanupStep(
      context,
      `delete untracked regression label ${label.id}`,
      () => invokeTool(context, "label_delete", { labelId: label.id }),
    );
  }

  for (const card of untrackedCards.reverse()) {
    await cleanupStep(
      context,
      `delete untracked regression card ${card.id}`,
      () => invokeTool(context, "card_delete", { cardId: card.id }),
    );
  }

  for (const list of untrackedLists.reverse()) {
    await cleanupStep(
      context,
      `archive untracked regression list ${list.id}`,
      () =>
        invokeTool(context, "list_archive", { closed: true, listId: list.id }),
    );
  }

  const recovered =
    untrackedLabels.length + untrackedCards.length + untrackedLists.length;
  if (recovered > 0) {
    verify(
      context.result,
      `cleanup recovered ${recovered} untracked prefix-matched regression artifacts`,
    );
  }
}

async function cleanupStep(
  context: RegressionContext,
  label: string,
  action: () => Promise<unknown>,
): Promise<void> {
  context.result.cleanup.attempted.push(label);
  try {
    await action();
    context.result.cleanup.completed.push(label);
  } catch (error) {
    const message = `${label}: ${errorMessage(error)}`;
    context.result.cleanup.failures.push(message);
    context.log?.({
      level: "warn",
      message: "Cleanup step failed",
      details: { error: message },
    });
  }
}

async function verifyNoOpenArtifacts(
  context: RegressionContext,
): Promise<void> {
  try {
    for (const board of cleanupBoards(context)) {
      const [openLists, openCards, labels] = await Promise.all([
        arrayResult(
          invokeTool(context, "board_lists", {
            boardId: board.id,
            fields: "name,closed,idBoard",
            filter: "open",
          }),
          `board_lists cleanup verification for ${board.id}`,
        ),
        arrayResult(
          invokeTool(context, "board_cards", {
            boardId: board.id,
            fields: "name,closed,idList",
            filter: "open",
            limit: 1000,
          }),
          `board_cards cleanup verification for ${board.id}`,
        ),
        arrayResult(
          invokeTool(context, "board_labels", {
            boardId: board.id,
            fields: "name,color",
            limit: 1000,
          }),
          `board_labels cleanup verification for ${board.id}`,
        ),
      ]);
      context.result.cleanup.remainingOpenArtifacts.push(
        ...matchingNames(openLists, context.prefix, `open list on ${board.id}`),
        ...matchingNames(openCards, context.prefix, `open card on ${board.id}`),
        ...matchingNames(labels, context.prefix, `label on ${board.id}`),
      );
    }
    if (context.result.cleanup.remainingOpenArtifacts.length === 0) {
      verify(
        context.result,
        "cleanup verification found no open temp lists, cards, or labels",
      );
    }
  } catch (error) {
    const message = `cleanup verification: ${errorMessage(error)}`;
    context.result.cleanup.failures.push(message);
    context.log?.({
      level: "warn",
      message: "Cleanup verification failed",
      details: { error: message },
    });
  }
}

async function invokeTool(
  context: RegressionContext,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const result = await context.invoke(name, input);
  if (shouldReportTool(context, name)) {
    recordCoverage(context.result, name, "covered");
  }
  return result;
}

function skipTool(
  context: RegressionContext,
  tool: string,
  reason: string,
): void {
  if (shouldReportTool(context, tool)) {
    recordCoverage(context.result, tool, "skipped", reason);
  }
}

function recordCoverage(
  result: LiveRegressionResult,
  tool: string,
  status: CoverageStatus,
  reason?: string,
): void {
  const existing = result.coverage.find((entry) => entry.tool === tool);
  if (existing && coverageRank(existing.status) >= coverageRank(status)) {
    return;
  }

  const entry: ToolCoverageEntry = {
    domain: toolDomain(tool),
    status,
    tool,
  };
  if (reason) {
    entry.reason = reason;
  }

  if (existing) {
    result.coverage.splice(result.coverage.indexOf(existing), 1, entry);
  } else {
    result.coverage.push(entry);
  }
}

function coverageRank(status: CoverageStatus): number {
  switch (status) {
    case "covered":
      return 4;
    case "skipped":
      return 3;
    case "unsupported":
      return 2;
    case "missing":
      return 1;
  }
}

function finalizeCoverage(
  result: LiveRegressionResult,
  filters: NormalizedFilters,
): void {
  const coveredTools = new Set(result.coverage.map((entry) => entry.tool));
  for (const tool of ALL_TOOL_NAMES) {
    if (!matchesFilters(tool, filters) || coveredTools.has(tool)) {
      continue;
    }

    const unsupportedReason = UNSUPPORTED_TOOL_REASONS.get(tool);
    if (unsupportedReason) {
      recordCoverage(result, tool, "unsupported", unsupportedReason);
    } else {
      recordCoverage(
        result,
        tool,
        "missing",
        "No live regression scenario currently covers this selected public tool.",
      );
    }
  }

  result.coverage.sort((left, right) => {
    const domainDelta =
      LIVE_REGRESSION_DOMAINS.indexOf(left.domain) -
      LIVE_REGRESSION_DOMAINS.indexOf(right.domain);
    if (domainDelta !== 0) {
      return domainDelta;
    }
    return left.tool.localeCompare(right.tool);
  });
}

function shouldRunDomain(
  context: RegressionContext,
  domain: LiveRegressionDomain,
): boolean {
  if (context.filters.domains && !context.filters.domains.has(domain)) {
    return false;
  }

  if (!context.filters.tools) {
    return true;
  }

  return [...context.filters.tools].some((tool) => toolDomain(tool) === domain);
}

function shouldRunTool(context: RegressionContext, tool: string): boolean {
  if (context.filters.tools) {
    return context.filters.tools.has(tool);
  }
  return (
    !context.filters.domains || context.filters.domains.has(toolDomain(tool))
  );
}

function shouldRunAnyTool(
  context: RegressionContext,
  tools: readonly string[],
): boolean {
  return tools.some((tool) => shouldRunTool(context, tool));
}

function shouldReportTool(context: RegressionContext, tool: string): boolean {
  return matchesFilters(tool, context.filters);
}

function matchesFilters(tool: string, filters: NormalizedFilters): boolean {
  if (filters.domains && !filters.domains.has(toolDomain(tool))) {
    return false;
  }
  if (filters.tools && !filters.tools.has(tool)) {
    return false;
  }
  return true;
}

function normalizeFilters(filters: LiveRegressionFilters): NormalizedFilters {
  assertNonEmptyFilterIntersection(filters.domains, filters.tools);
  const normalized: NormalizedFilters = {};
  if (filters.domains && filters.domains.length > 0) {
    normalized.domains = new Set(filters.domains);
  }
  if (filters.tools && filters.tools.length > 0) {
    normalized.tools = new Set(filters.tools);
  }
  return normalized;
}

function assertNonEmptyFilterIntersection(
  domains: readonly LiveRegressionDomain[] | undefined,
  tools: readonly string[] | undefined,
): void {
  if (!domains || domains.length === 0 || !tools || tools.length === 0) {
    return;
  }

  const domainSet = new Set(domains);
  const hasOverlap = tools.some((tool) => domainSet.has(toolDomain(tool)));
  if (!hasOverlap) {
    throw new LiveRegressionConfigError(
      `Live regression domain/tool filters have no overlap. Selected domains: ${domains.join(", ")}. Selected tools: ${tools.join(", ")}.`,
    );
  }
}

function toolDomain(tool: string): LiveRegressionDomain {
  if (tool.startsWith("auth_")) {
    return "auth";
  }
  if (
    tool.startsWith("card_comment") ||
    tool === "card_actions" ||
    tool === "board_actions" ||
    tool === "list_actions" ||
    tool === "workspace_actions"
  ) {
    return "comments-actions";
  }
  if (
    tool === "board_create" ||
    tool === "list_boards" ||
    tool === "board_get" ||
    tool === "board_field_get"
  ) {
    return "boards";
  }
  if (tool === "list_workspaces" || tool.startsWith("workspace_")) {
    return "workspaces";
  }
  if (tool === "board_cards" || tool === "list_cards") {
    return "cards";
  }
  if (tool === "board_lists" || tool.startsWith("list_")) {
    return "lists";
  }
  if (
    tool === "board_labels" ||
    tool.startsWith("label_") ||
    tool.startsWith("card_label")
  ) {
    return "labels";
  }
  if (tool.startsWith("card_checklist")) {
    return "checklists";
  }
  if (
    tool === "board_members" ||
    tool === "board_memberships" ||
    tool === "card_members" ||
    tool.startsWith("card_member") ||
    tool.startsWith("member_")
  ) {
    return "members";
  }
  if (tool.startsWith("search")) {
    return "search";
  }
  if (
    tool === "board_custom_fields" ||
    tool.startsWith("custom_field") ||
    tool.startsWith("card_custom_field")
  ) {
    return "custom-fields";
  }
  if (tool.startsWith("card_attachment") || tool === "card_cover_set") {
    return "attachments";
  }
  if (tool.startsWith("card_")) {
    return "cards";
  }
  throw new LiveRegressionConfigError(
    `Registered tool ${tool} has no live regression domain mapping.`,
  );
}

function writableCustomField(customFields: unknown[]):
  | {
      customFieldId: string;
      input: Record<string, unknown>;
    }
  | undefined {
  for (const field of customFields) {
    if (!isRecord(field)) {
      continue;
    }
    const customFieldId = optionalStringField(field, "id");
    if (!customFieldId || typeof field.type !== "string") {
      continue;
    }
    switch (field.type) {
      case "text":
        return {
          customFieldId,
          input: { text: "live regression", type: "text" },
        };
      case "number":
        return { customFieldId, input: { number: "42", type: "number" } };
      case "date":
        return {
          customFieldId,
          input: { date: "2030-01-01T00:00:00.000Z", type: "date" },
        };
      case "checkbox":
        return { customFieldId, input: { checked: true, type: "checkbox" } };
      case "list": {
        const optionId = firstCustomFieldOptionId(field);
        if (optionId) {
          return { customFieldId, input: { optionId, type: "list" } };
        }
        break;
      }
    }
  }
  return undefined;
}

function firstCustomFieldOptionId(
  field: Record<string, unknown>,
): string | undefined {
  const options = field.options;
  if (Array.isArray(options)) {
    const id = firstId(options);
    if (id) {
      return id;
    }
  }
  const display = field.display;
  if (isRecord(display) && Array.isArray(display.options)) {
    return firstId(display.options);
  }
  return undefined;
}

function emptyResult(
  runId: string,
  boardRef: string,
  filters: NormalizedFilters,
): LiveRegressionResult {
  return {
    board: { id: boardRef, name: "unknown" },
    cleanup: {
      attempted: [],
      completed: [],
      failures: [],
      remainingOpenArtifacts: [],
    },
    coverage: [],
    created: {
      attachments: [],
      cards: [],
      checklistItems: [],
      checklists: [],
      labels: [],
      lists: [],
    },
    failures: [],
    runId,
    selection: {
      domains: filters.domains ? [...filters.domains] : [],
      tools: filters.tools ? [...filters.tools] : [],
    },
    verified: [],
  };
}

function cleanupBoards(context: RegressionContext): RegressionArtifact[] {
  const boards: RegressionArtifact[] = [];
  if (context.state.boardId) {
    boards.push(context.result.board);
  }
  if (context.state.secondaryBoardId && context.result.secondaryBoard) {
    boards.push(context.result.secondaryBoard);
  }
  const seen = new Set<string>();
  return boards.filter((board) => {
    if (seen.has(board.id)) {
      return false;
    }
    seen.add(board.id);
    return true;
  });
}

function requireBoardId(context: RegressionContext): string {
  if (!context.state.boardId) {
    throw new Error("Live regression board was not resolved.");
  }
  return context.state.boardId;
}

function requireAuthMemberId(context: RegressionContext): string {
  if (!context.state.authMemberId) {
    throw new Error("Live regression authenticated member was not resolved.");
  }
  return context.state.authMemberId;
}

function trackAttachment(
  context: RegressionContext,
  cardId: string,
  id: string,
  name: string,
): void {
  context.result.created.attachments.push({ cardId, id, name });
}

function untrackAttachment(context: RegressionContext, id: string): void {
  context.result.created.attachments =
    context.result.created.attachments.filter(
      (attachment) => attachment.id !== id,
    );
}

function trackLabelAssignment(
  context: RegressionContext,
  cardId: string,
  labelId: string,
): void {
  context.state.labelAssignments.push({ cardId, labelId });
}

function untrackLabelAssignment(
  context: RegressionContext,
  cardId: string,
  labelId: string,
): void {
  context.state.labelAssignments = context.state.labelAssignments.filter(
    (assignment) =>
      assignment.cardId !== cardId || assignment.labelId !== labelId,
  );
}

function trackMemberAssignment(
  context: RegressionContext,
  cardId: string,
  memberId: string,
): void {
  context.state.memberAssignments.push({ cardId, memberId });
}

function untrackMemberAssignment(
  context: RegressionContext,
  cardId: string,
  memberId: string,
): void {
  context.state.memberAssignments = context.state.memberAssignments.filter(
    (assignment) =>
      assignment.cardId !== cardId || assignment.memberId !== memberId,
  );
}

function untrackCustomField(
  context: RegressionContext,
  cardId: string,
  customFieldId: string,
): void {
  context.state.setCustomFields = context.state.setCustomFields.filter(
    (item) => item.cardId !== cardId || item.customFieldId !== customFieldId,
  );
}

function artifactById(
  artifacts: RegressionArtifact[],
  id: string | undefined,
): RegressionArtifact | undefined {
  return id ? artifacts.find((artifact) => artifact.id === id) : undefined;
}

function updateArtifactName(
  artifacts: RegressionArtifact[],
  id: string,
  name: string,
): void {
  const artifact = artifacts.find((candidate) => candidate.id === id);
  if (artifact) {
    artifact.name = name;
  }
}

function verify(result: LiveRegressionResult, message: string): void {
  result.verified.push(message);
}

async function objectResult(
  promise: Promise<unknown>,
  toolName: string,
): Promise<Record<string, unknown>> {
  const value = await promise;
  if (!isRecord(value)) {
    throw new Error(`${toolName} did not return an object.`);
  }
  return value;
}

async function arrayResult(
  promise: Promise<unknown>,
  toolName: string,
): Promise<unknown[]> {
  const value = await promise;
  if (!Array.isArray(value)) {
    throw new Error(`${toolName} did not return an array.`);
  }
  return value;
}

function stringField(
  value: Record<string, unknown>,
  field: string,
  context: string,
): string {
  const fieldValue = value[field];
  if (typeof fieldValue !== "string" || fieldValue.length === 0) {
    throw new Error(`${context} did not return a usable ${field}.`);
  }
  return fieldValue;
}

function optionalStringField(
  value: Record<string, unknown>,
  field: string,
): string | undefined {
  const fieldValue = value[field];
  return typeof fieldValue === "string" && fieldValue.length > 0
    ? fieldValue
    : undefined;
}

function assertFieldEquals(
  value: Record<string, unknown>,
  field: string,
  expected: string,
  context: string,
): void {
  const actual = value[field];
  if (actual !== expected) {
    throw new Error(
      `${context} returned ${field}=${String(actual)}; expected ${expected}.`,
    );
  }
}

function assertContainsId(
  values: unknown[],
  id: string,
  context: string,
): void {
  if (!containsId(values, id)) {
    throw new Error(`${context} did not include expected id ${id}.`);
  }
}

function assertNestedArrayContainsId(
  value: Record<string, unknown>,
  field: string,
  id: string,
  context: string,
): void {
  const nested = value[field];
  if (!Array.isArray(nested) || !containsId(nested, id)) {
    throw new Error(`${context}.${field} did not include expected id ${id}.`);
  }
}

function containsId(values: unknown[], id: string): boolean {
  return values.some((value) => isRecord(value) && value.id === id);
}

function firstId(values: unknown[]): string | undefined {
  const first = firstRecord(values);
  return first ? optionalStringField(first, "id") : undefined;
}

function firstRecord(values: unknown[]): Record<string, unknown> | undefined {
  return values.find(isRecord);
}

function matchingNames(
  values: unknown[],
  prefix: string,
  kind: string,
): string[] {
  return matchingArtifacts(values, prefix).map(
    (artifact) => `${kind} ${artifact.id} (${artifact.name})`,
  );
}

function untrackedArtifacts(
  values: unknown[],
  prefix: string,
  trackedIds: ReadonlySet<string>,
): RegressionArtifact[] {
  return matchingArtifacts(values, prefix).filter(
    (artifact) => !trackedIds.has(artifact.id),
  );
}

function matchingArtifacts(
  values: unknown[],
  prefix: string,
): RegressionArtifact[] {
  const artifacts: RegressionArtifact[] = [];
  const artifactPrefix = `${prefix} `;
  const seen = new Set<string>();
  for (const value of values) {
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      value.id.length === 0 ||
      typeof value.name !== "string" ||
      !value.name.startsWith(artifactPrefix) ||
      seen.has(value.id)
    ) {
      continue;
    }
    artifacts.push({ id: value.id, name: value.name });
    seen.add(value.id);
  }
  return artifacts;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function liveRegressionBoardRef(env: NodeJS.ProcessEnv): string | undefined {
  const boardId = nonEmpty(env.TRELLO_LIVE_REGRESSION_BOARD_ID);
  if (boardId) {
    return boardIdentifier(boardId, "TRELLO_LIVE_REGRESSION_BOARD_ID");
  }

  const boardUrl = nonEmpty(env.TRELLO_LIVE_REGRESSION_BOARD_URL);
  if (boardUrl) {
    return boardIdentifier(boardUrl, "TRELLO_LIVE_REGRESSION_BOARD_URL");
  }

  return undefined;
}

function liveRegressionSecondaryBoardRef(
  env: NodeJS.ProcessEnv,
  cliValue: string | undefined,
): string | undefined {
  const cliBoard = nonEmpty(cliValue);
  if (cliBoard) {
    return boardIdentifier(cliBoard, "--secondary-board");
  }

  const boardId = nonEmpty(env.TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_ID);
  if (boardId) {
    return boardIdentifier(
      boardId,
      "TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_ID",
    );
  }

  const boardUrl = nonEmpty(env.TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_URL);
  if (boardUrl) {
    return boardIdentifier(
      boardUrl,
      "TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_URL",
    );
  }

  return undefined;
}

function boardIdentifier(value: string, source: string): string {
  const raw = value.trim();
  if (raw.includes("://")) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new LiveRegressionConfigError(
        `${source} must be a Trello board id, short link, or trello.com /b/ board URL.`,
      );
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const hostname = url.hostname.toLowerCase();
    if (
      (hostname === "trello.com" || hostname === "www.trello.com") &&
      parts[0] === "b" &&
      parts[1]
    ) {
      return parts[1];
    }
    throw new LiveRegressionConfigError(
      `${source} must be a Trello board id, short link, or trello.com /b/ board URL.`,
    );
  }
  if (/^[A-Za-z0-9_-]+$/.test(raw)) {
    return raw;
  }
  throw new LiveRegressionConfigError(
    `${source} must be a Trello board id, short link, or trello.com /b/ board URL.`,
  );
}

function parseDomainFilters(
  values: string[] | undefined,
): LiveRegressionDomain[] | undefined {
  const filters = splitFilterValues(values);
  if (filters.length === 0) {
    return undefined;
  }

  const domains: LiveRegressionDomain[] = [];
  for (const value of filters) {
    if (!DOMAIN_SET.has(value)) {
      throw new LiveRegressionConfigError(
        `Unknown live regression domain ${value}. Valid domains: ${LIVE_REGRESSION_DOMAINS.join(", ")}.`,
      );
    }
    domains.push(value as LiveRegressionDomain);
  }
  return unique(domains);
}

function parseToolFilters(values: string[] | undefined): string[] | undefined {
  const filters = splitFilterValues(values);
  if (filters.length === 0) {
    return undefined;
  }
  for (const value of filters) {
    if (!ALL_TOOL_NAME_SET.has(value)) {
      throw new LiveRegressionConfigError(
        `Unknown live regression tool ${value}.`,
      );
    }
  }
  return unique(filters);
}

function splitFilterValue(value: string | undefined): string[] | undefined {
  return value ? [value] : undefined;
}

function splitFilterValues(values: string[] | undefined): string[] {
  return (values ?? [])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function unique<TValue>(values: TValue[]): TValue[] {
  return [...new Set(values)];
}

function isOptedIn(value: string | undefined): boolean {
  return value !== undefined && OPT_IN_VALUES.has(value.trim().toLowerCase());
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function regressionRunId(value: string | undefined, now: Date): string {
  const raw =
    nonEmpty(value) ??
    `local-${now.toISOString().replaceAll(":", "-").replaceAll(".", "-")}`;
  return raw.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 80);
}

function parseLogLevel(value: string | undefined): Config["LOG_LEVEL"] {
  if (LOG_LEVELS.includes(value as Config["LOG_LEVEL"])) {
    return value as Config["LOG_LEVEL"];
  }
  return "warn";
}

function formatSelection(selection: LiveRegressionResult["selection"]): string {
  const domains =
    selection.domains.length > 0 ? selection.domains.join(",") : "all";
  const tools = selection.tools.length > 0 ? selection.tools.join(",") : "all";
  return `domains=${domains}; tools=${tools}`;
}

function formatCoverageEntries(entries: ToolCoverageEntry[]): string {
  return entries
    .map((entry) =>
      entry.reason ? `${entry.tool} (${entry.reason})` : entry.tool,
    )
    .join(", ");
}

function appendCoverageSection(
  lines: string[],
  title: string,
  entries: ToolCoverageEntry[],
): void {
  if (entries.length === 0) {
    return;
  }

  lines.push("", `### ${title}`, "");
  for (const entry of entries) {
    const reason = entry.reason ? ` - ${markdownText(entry.reason)}` : "";
    lines.push(
      `- \`${markdownInline(entry.tool)}\` (${entry.domain})${reason}`,
    );
  }
}

function appendMarkdownList(
  lines: string[],
  title: string,
  items: readonly string[],
): void {
  if (items.length === 0) {
    return;
  }

  lines.push("", `### ${title}`, "");
  for (const item of items) {
    lines.push(`- ${markdownText(item)}`);
  }
}

function markdownInline(value: string): string {
  return value.replaceAll("`", "\\`").replaceAll(/\s+/g, " ").trim();
}

function markdownText(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function redactedMessage(error: unknown, secrets: readonly string[]): string {
  let message = errorMessage(error);
  for (const secret of secrets) {
    if (secret.length > 0) {
      message = message.replaceAll(secret, "[redacted]");
    }
  }
  return message;
}

function printEvent(event: SmokeLogEvent): void {
  const detailText = event.details ? ` ${JSON.stringify(event.details)}` : "";
  const line = `[${event.level}] ${event.message}${detailText}`;
  if (event.level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

async function appendGitHubSummaryIfConfigured(
  result: LiveRegressionResult,
  secrets: readonly string[],
): Promise<void> {
  const summaryPath = nonEmpty(process.env.GITHUB_STEP_SUMMARY);
  if (!summaryPath) {
    return;
  }

  try {
    await appendLiveRegressionMarkdownSummary(result, summaryPath, { secrets });
  } catch (error) {
    console.error(
      `Failed to write GitHub step summary: ${redactedMessage(error, secrets)}`,
    );
  }
}

function liveRegressionUsage(): string {
  return [
    "Usage: corepack pnpm regression:live [--domain <domain>] [--tool <tool>] [--secondary-board <board>] [--json <path>]",
    `Domains: ${LIVE_REGRESSION_DOMAINS.join(", ")}`,
  ].join("\n");
}

async function main(): Promise<void> {
  let config: LiveRegressionConfig;
  try {
    config = loadLiveRegressionConfig(
      process.env,
      new Date(),
      parseLiveRegressionArgs(process.argv.slice(2)),
    );
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
    return;
  }

  const logger = createLogger({
    LOG_LEVEL: config.logLevel,
    TRANSPORT: "stdio",
  });
  const clientConfig: LiveRegressionClientConfig = {
    TRELLO_API_KEY: config.TRELLO_API_KEY,
    TRELLO_TOKEN: config.TRELLO_TOKEN,
  };
  if (config.TRELLO_ATTACHMENT_UPLOAD_ROOT) {
    clientConfig.TRELLO_ATTACHMENT_UPLOAD_ROOT =
      config.TRELLO_ATTACHMENT_UPLOAD_ROOT;
  }
  const trello = new TrelloClient(clientConfig);
  const invoke = createLiveToolInvoker({ logger, trello });
  const secrets = [config.TRELLO_API_KEY, config.TRELLO_TOKEN];

  try {
    const result = await runLiveRegressionSuite({
      boardRef: config.boardRef,
      invoke,
      log: printEvent,
      runId: config.runId,
      ...(config.domains ? { domains: config.domains } : {}),
      ...(config.secondaryBoardRef
        ? { secondaryBoardRef: config.secondaryBoardRef }
        : {}),
      ...(config.tools ? { tools: config.tools } : {}),
      ...(config.uploadFile ? { uploadFile: config.uploadFile } : {}),
    });
    if (config.jsonReportPath) {
      await writeLiveRegressionJsonReport(result, config.jsonReportPath);
    }
    await appendGitHubSummaryIfConfigured(result, secrets);
    console.log(formatLiveRegressionReport(result));
  } catch (error) {
    if (error instanceof LiveRegressionRunError) {
      if (config.jsonReportPath) {
        await writeLiveRegressionJsonReport(
          error.result,
          config.jsonReportPath,
        );
      }
      await appendGitHubSummaryIfConfigured(error.result, secrets);
      console.error(formatLiveRegressionReport(error.result));
      for (const failure of error.result.failures) {
        console.error(`Failure: ${redactedMessage(failure, secrets)}`);
      }
      for (const failure of error.result.cleanup.failures) {
        console.error(`Cleanup failure: ${redactedMessage(failure, secrets)}`);
      }
      const missing = error.result.coverage.filter(
        (entry) => entry.status === "missing",
      );
      for (const entry of missing) {
        console.error(`Missing live coverage: ${entry.tool}`);
      }
      process.exitCode = 1;
      return;
    }
    console.error(redactedMessage(error, secrets));
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
