import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Config } from "../src/config.js";
import { TrelloClient } from "../src/trello/client.js";
import { allTools } from "../src/trello/tools.js";
import { createLogger, type Logger } from "../src/utils/logger.js";
import type { ToolDefinition } from "../src/utils/tool.js";

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

type LiveSmokeClientConfig = Pick<
  Config,
  "TRELLO_API_KEY" | "TRELLO_TOKEN" | "TRELLO_ATTACHMENT_UPLOAD_ROOT"
>;

export type LiveSmokeConfig = LiveSmokeClientConfig & {
  boardRef: string;
  logLevel: Config["LOG_LEVEL"];
  runId: string;
};

export type SmokeToolInvoker = (
  name: string,
  input: Record<string, unknown>,
) => Promise<unknown>;

type SmokeDetails = Record<string, string | number | boolean | null>;

export type SmokeLogEvent = {
  level: "info" | "warn" | "error";
  message: string;
  details?: SmokeDetails;
};

export type SmokeArtifact = {
  id: string;
  name: string;
};

export type LiveSmokeResult = {
  board: SmokeArtifact;
  cleanup: {
    attempted: string[];
    completed: string[];
    failures: string[];
    remainingOpenArtifacts: string[];
  };
  created: {
    cards: SmokeArtifact[];
    checklistItems: SmokeArtifact[];
    checklists: SmokeArtifact[];
    labels: SmokeArtifact[];
    lists: SmokeArtifact[];
  };
  failures: string[];
  runId: string;
  verified: string[];
};

type TrackedState = {
  boardResolved?: boolean;
  cardId?: string;
  labelApplied?: boolean;
  labelId?: string;
  memberAssigned?: boolean;
  memberId?: string;
};

export class LiveSmokeConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LiveSmokeConfigError";
  }
}

export class LiveSmokeRunError extends Error {
  public readonly result: LiveSmokeResult;

  public constructor(message: string, result: LiveSmokeResult, cause: unknown) {
    super(message, { cause });
    this.name = "LiveSmokeRunError";
    this.result = result;
  }
}

export function loadLiveSmokeConfig(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): LiveSmokeConfig {
  const missing: string[] = [];
  if (!isOptedIn(env.TRELLO_LIVE_SMOKE)) {
    missing.push("TRELLO_LIVE_SMOKE=1");
  }

  const apiKey = nonEmpty(env.TRELLO_API_KEY);
  if (!apiKey) {
    missing.push("TRELLO_API_KEY");
  }

  const token = nonEmpty(env.TRELLO_TOKEN);
  if (!token) {
    missing.push("TRELLO_TOKEN");
  }

  const boardRef = liveSmokeBoardRef(env);
  if (!boardRef) {
    missing.push("TRELLO_LIVE_SMOKE_BOARD_ID or TRELLO_LIVE_SMOKE_BOARD_URL");
  }

  if (missing.length > 0) {
    throw new LiveSmokeConfigError(
      [
        "Live Trello smoke test was not run.",
        "This command is strictly opt-in and will not contact Trello until every required live-smoke variable is set.",
        `Missing: ${missing.join(", ")}.`,
      ].join(" "),
    );
  }

  const config: LiveSmokeConfig = {
    TRELLO_API_KEY: apiKey as string,
    TRELLO_TOKEN: token as string,
    boardRef: boardRef as string,
    logLevel: parseLogLevel(env.LOG_LEVEL),
    runId: smokeRunId(env.TRELLO_LIVE_SMOKE_RUN_ID, now),
  };

  const uploadRoot = nonEmpty(env.TRELLO_ATTACHMENT_UPLOAD_ROOT);
  if (uploadRoot) {
    config.TRELLO_ATTACHMENT_UPLOAD_ROOT = uploadRoot;
  }

  return config;
}

export function createLiveToolInvoker(options: {
  logger: Logger;
  tools?: ToolDefinition[];
  trello: TrelloClient;
}): SmokeToolInvoker {
  const tools = new Map<string, ToolDefinition>();
  for (const tool of options.tools ?? allTools) {
    tools.set(tool.name, tool);
  }

  return async (
    name: string,
    input: Record<string, unknown>,
  ): Promise<unknown> => {
    const tool = tools.get(name);
    if (!tool) {
      throw new Error(`Live smoke tool is not registered: ${name}`);
    }

    const requestId = randomUUID();
    const logger = options.logger.child({ requestId, toolName: name });
    const parsedInput = tool.inputSchema.parse(input);
    return tool.handler(parsedInput, {
      logger,
      requestId,
      trello: options.trello,
    });
  };
}

export async function runLiveSmokeFlow(options: {
  boardRef: string;
  invoke: SmokeToolInvoker;
  log?: (event: SmokeLogEvent) => void;
  runId: string;
}): Promise<LiveSmokeResult> {
  const boardRef = boardIdentifier(options.boardRef, "boardRef");
  const prefix = `trello-mcp live smoke ${options.runId}`;
  const state: TrackedState = {};
  const result = emptyResult(options.runId, boardRef);
  let failure: unknown;

  options.log?.({
    level: "info",
    message: "Starting live Trello smoke test",
    details: { boardRef, runId: options.runId },
  });

  try {
    const authMember = await objectResult(
      options.invoke("auth_whoami", {
        fields: "username,fullName,initials,avatarUrl",
      }),
      "auth_whoami",
    );
    const memberId = stringField(authMember, "id", "auth_whoami");
    state.memberId = memberId;

    await options.invoke("auth_token_info", {
      fields: "identifier,idMember,dateExpires,permissions",
    });

    const board = await objectResult(
      options.invoke("board_get", {
        boardId: boardRef,
        fields: "name,closed,url",
      }),
      "board_get",
    );
    const boardId = stringField(board, "id", "board_get");
    const boardName = stringField(board, "name", "board_get");
    if (board.closed === true) {
      throw new Error("Configured live smoke board is closed.");
    }
    result.board = { id: boardId, name: boardName };
    state.boardResolved = true;
    verify(result, `authenticated and resolved board ${boardName}`);

    const visibleBoards = await arrayResult(
      options.invoke("list_boards", { fields: "name,closed", filter: "open" }),
      "list_boards",
    );
    assertContainsId(visibleBoards, boardId, "list_boards");

    await options.invoke("board_field_get", { boardId, field: "name" });
    await options.invoke("board_custom_fields", { boardId });

    const existingLists = await arrayResult(
      options.invoke("board_lists", {
        boardId,
        fields: "name,closed,idBoard,pos",
        filter: "open",
      }),
      "board_lists",
    );
    await arrayResult(
      options.invoke("board_cards", {
        boardId,
        fields: "name,idList,closed",
        filter: "open",
        limit: 10,
      }),
      "board_cards",
    );
    await arrayResult(
      options.invoke("board_labels", {
        boardId,
        fields: "name,color,uses",
        limit: 50,
      }),
      "board_labels",
    );
    const boardMembers = await arrayResult(
      options.invoke("board_members", {
        boardId,
        fields: "username,fullName,initials,avatarUrl",
      }),
      "board_members",
    );
    await arrayResult(
      options.invoke("board_memberships", {
        boardId,
        filter: "all",
        member: true,
        memberFields: "username,fullName",
      }),
      "board_memberships",
    );
    verify(
      result,
      `read board discovery data (${existingLists.length} existing open lists)`,
    );

    const primaryList = await createSmokeList(
      options.invoke,
      result,
      boardId,
      `${prefix} primary list`,
    );
    const secondaryList = await createSmokeList(
      options.invoke,
      result,
      boardId,
      `${prefix} target list`,
    );

    await objectResult(
      options.invoke("list_get", {
        fields: "name,closed,idBoard,pos",
        listId: primaryList.id,
      }),
      "list_get",
    );

    const renamedListName = `${prefix} primary list renamed`;
    await objectResult(
      options.invoke("list_update", {
        listId: primaryList.id,
        name: renamedListName,
        pos: "top",
      }),
      "list_update",
    );
    updateArtifactName(result.created.lists, primaryList.id, renamedListName);
    const openListsAfterCreate = await arrayResult(
      options.invoke("board_lists", {
        boardId,
        fields: "name,closed,idBoard,pos",
        filter: "open",
      }),
      "board_lists",
    );
    assertContainsId(openListsAfterCreate, primaryList.id, "board_lists");
    assertContainsId(openListsAfterCreate, secondaryList.id, "board_lists");
    verify(result, "created, read, and renamed disposable lists");

    const card = await objectResult(
      options.invoke("card_create", {
        desc: `Created by live smoke run ${options.runId}; safe to delete.`,
        listId: primaryList.id,
        name: `${prefix} card`,
        pos: "bottom",
      }),
      "card_create",
    );
    const cardId = stringField(card, "id", "card_create");
    state.cardId = cardId;
    result.created.cards.push({
      id: cardId,
      name: stringField(card, "name", "card_create"),
    });

    await objectResult(
      options.invoke("card_get", {
        cardId,
        fields:
          "name,desc,idBoard,idList,closed,due,dueComplete,idLabels,labels",
      }),
      "card_get",
    );
    await objectResult(
      options.invoke("card_board", { cardId, fields: "name,closed" }),
      "card_board",
    );
    await objectResult(
      options.invoke("card_list", { cardId, fields: "name,closed,idBoard" }),
      "card_list",
    );
    assertContainsId(
      await arrayResult(
        options.invoke("list_cards", {
          fields: "name,idList,closed",
          filter: "open",
          listId: primaryList.id,
          limit: 10,
        }),
        "list_cards",
      ),
      cardId,
      "list_cards",
    );
    verify(result, "created and read disposable card relationships");

    const updatedCardName = `${prefix} card updated`;
    await objectResult(
      options.invoke("card_update", {
        cardId,
        desc: `Updated by live smoke run ${options.runId}.`,
        name: updatedCardName,
      }),
      "card_update",
    );
    updateArtifactName(result.created.cards, cardId, updatedCardName);

    await objectResult(
      options.invoke("card_due_date_set", {
        cardId,
        due: "2030-01-01T00:00:00.000Z",
        dueComplete: false,
      }),
      "card_due_date_set",
    );
    await objectResult(
      options.invoke("card_position_set", { cardId, pos: "top" }),
      "card_position_set",
    );
    await objectResult(
      options.invoke("card_archive", { cardId, closed: true }),
      "card_archive",
    );
    await objectResult(
      options.invoke("card_archive", { cardId, closed: false }),
      "card_archive",
    );
    const movedCard = await objectResult(
      options.invoke("card_move", {
        cardId,
        listId: secondaryList.id,
        pos: "bottom",
      }),
      "card_move",
    );
    assertFieldEquals(movedCard, "idList", secondaryList.id, "card_move");
    verify(result, "updated, archived, restored, and moved disposable card");

    const label = await objectResult(
      options.invoke("label_create", {
        boardId,
        color: "blue",
        name: `${prefix} label`,
      }),
      "label_create",
    );
    const labelId = stringField(label, "id", "label_create");
    state.labelId = labelId;
    result.created.labels.push({
      id: labelId,
      name: stringField(label, "name", "label_create"),
    });
    await objectResult(options.invoke("label_get", { labelId }), "label_get");
    const renamedLabel = `${prefix} label updated`;
    await objectResult(
      options.invoke("label_update", {
        color: "green",
        labelId,
        name: renamedLabel,
      }),
      "label_update",
    );
    updateArtifactName(result.created.labels, labelId, renamedLabel);

    await options.invoke("card_label_add", { cardId, labelId });
    state.labelApplied = true;
    const cardLabels = await objectResult(
      options.invoke("card_labels", { cardId }),
      "card_labels",
    );
    assertNestedArrayContainsId(cardLabels, "labels", labelId, "card_labels");
    await options.invoke("card_label_remove", { cardId, labelId });
    state.labelApplied = false;
    verify(result, "created, updated, applied, and removed disposable label");

    await arrayResult(
      options.invoke("card_members", {
        cardId,
        fields: "username,fullName,initials,avatarUrl",
      }),
      "card_members",
    );
    if (containsId(boardMembers, memberId)) {
      await options.invoke("card_member_add", { cardId, memberId });
      state.memberAssigned = true;
      assertContainsId(
        await arrayResult(
          options.invoke("card_members", {
            cardId,
            fields: "username,fullName,initials,avatarUrl",
          }),
          "card_members",
        ),
        memberId,
        "card_members",
      );
      await options.invoke("card_member_remove", { cardId, memberId });
      state.memberAssigned = false;
      verify(result, "safely assigned and removed authenticated member");
    } else {
      verify(
        result,
        "read card members; skipped assignment because authenticated member was not listed on the board",
      );
    }

    const checklist = await objectResult(
      options.invoke("card_checklist_create", {
        cardId,
        name: `${prefix} checklist`,
      }),
      "card_checklist_create",
    );
    const checklistId = stringField(checklist, "id", "card_checklist_create");
    result.created.checklists.push({
      id: checklistId,
      name: stringField(checklist, "name", "card_checklist_create"),
    });
    assertContainsId(
      await arrayResult(
        options.invoke("card_checklists", { cardId }),
        "card_checklists",
      ),
      checklistId,
      "card_checklists",
    );

    const item = await objectResult(
      options.invoke("card_checklist_item_create", {
        checked: false,
        checklistId,
        name: `${prefix} checklist item`,
        pos: "bottom",
      }),
      "card_checklist_item_create",
    );
    const checkItemId = stringField(item, "id", "card_checklist_item_create");
    result.created.checklistItems.push({
      id: checkItemId,
      name: stringField(item, "name", "card_checklist_item_create"),
    });
    assertContainsId(
      await arrayResult(
        options.invoke("card_checklist_items", {
          checklistId,
          fields: "name,state,pos",
          filter: "all",
        }),
        "card_checklist_items",
      ),
      checkItemId,
      "card_checklist_items",
    );
    await objectResult(
      options.invoke("card_checklist_item_update", {
        cardId,
        checkItemId,
        name: `${prefix} checklist item updated`,
        state: "incomplete",
      }),
      "card_checklist_item_update",
    );
    const checkedItem = await objectResult(
      options.invoke("card_checklist_item_set_checked", {
        cardId,
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
    await options.invoke("card_checklist_item_delete", {
      cardId,
      checkItemId,
    });
    await options.invoke("card_checklist_delete", {
      cardId,
      checklistId,
    });
    const checklistsAfterDelete = await arrayResult(
      options.invoke("card_checklists", { cardId }),
      "card_checklists",
    );
    if (containsId(checklistsAfterDelete, checklistId)) {
      throw new Error(
        "card_checklist_delete did not remove the deleted checklist from card_checklists.",
      );
    }
    verify(
      result,
      "created, read, updated, checked, and deleted checklist item and checklist",
    );

    const comment = await objectResult(
      options.invoke("card_comment_add", {
        cardId,
        text: `${prefix} comment`,
      }),
      "card_comment_add",
    );
    const actionId = stringField(comment, "id", "card_comment_add");
    await objectResult(
      options.invoke("card_comment_update", {
        actionId,
        text: `${prefix} comment updated`,
      }),
      "card_comment_update",
    );
    await arrayResult(
      options.invoke("card_actions", {
        cardId,
        fields: "id,type,date",
        filter: "commentCard",
        limit: 10,
        member: false,
        memberCreator: false,
      }),
      "card_actions",
    );
    await options.invoke("card_comment_delete", { actionId });
    verify(result, "created, updated, listed, and deleted a card comment");
  } catch (error) {
    failure = error;
    const message = errorMessage(error);
    result.failures.push(message);
    options.log?.({
      level: "error",
      message: "Live smoke flow failed; cleanup will still run",
      details: { error: message },
    });
  } finally {
    await cleanupLiveArtifacts({
      invoke: options.invoke,
      prefix,
      result,
      state,
      ...(options.log ? { log: options.log } : {}),
    });
  }

  if (hasResolvedBoard(state)) {
    await verifyNoOpenArtifacts(options.invoke, result, prefix, options.log);
  }

  if (
    failure !== undefined ||
    result.cleanup.failures.length > 0 ||
    result.cleanup.remainingOpenArtifacts.length > 0
  ) {
    throw new LiveSmokeRunError(
      "Live Trello smoke test failed; cleanup was attempted.",
      result,
      failure,
    );
  }

  options.log?.({
    level: "info",
    message: "Live Trello smoke test completed",
    details: { boardId: result.board.id, runId: result.runId },
  });
  return result;
}

export function formatLiveSmokeSummary(result: LiveSmokeResult): string {
  return [
    `Live Trello smoke test run ${result.runId}`,
    `Board: ${result.board.name} (${result.board.id})`,
    `Created: ${result.created.lists.length} lists, ${result.created.cards.length} cards, ${result.created.labels.length} labels, ${result.created.checklists.length} checklists, ${result.created.checklistItems.length} checklist items`,
    `Verified: ${result.verified.join("; ")}`,
    `Cleanup: ${result.cleanup.completed.length}/${result.cleanup.attempted.length} steps completed`,
    result.cleanup.remainingOpenArtifacts.length === 0
      ? "Cleanup verification: no open smoke artifacts found"
      : `Cleanup verification: remaining artifacts: ${result.cleanup.remainingOpenArtifacts.join(", ")}`,
  ].join("\n");
}

function emptyResult(runId: string, boardRef: string): LiveSmokeResult {
  return {
    board: { id: boardRef, name: "unknown" },
    cleanup: {
      attempted: [],
      completed: [],
      failures: [],
      remainingOpenArtifacts: [],
    },
    created: {
      cards: [],
      checklistItems: [],
      checklists: [],
      labels: [],
      lists: [],
    },
    failures: [],
    runId,
    verified: [],
  };
}

function hasResolvedBoard(state: TrackedState): boolean {
  return state.boardResolved === true;
}

async function createSmokeList(
  invoke: SmokeToolInvoker,
  result: LiveSmokeResult,
  boardId: string,
  name: string,
): Promise<SmokeArtifact> {
  const list = await objectResult(
    invoke("list_create", { boardId, name, pos: "bottom" }),
    "list_create",
  );
  const artifact = {
    id: stringField(list, "id", "list_create"),
    name: stringField(list, "name", "list_create"),
  };
  result.created.lists.push(artifact);
  return artifact;
}

async function cleanupLiveArtifacts(options: {
  invoke: SmokeToolInvoker;
  log?: (event: SmokeLogEvent) => void;
  prefix: string;
  result: LiveSmokeResult;
  state: TrackedState;
}): Promise<void> {
  const { invoke, result, state } = options;

  if (state.cardId && state.memberAssigned && state.memberId) {
    await cleanupStep(result, options.log, "remove smoke card member", () =>
      invoke("card_member_remove", {
        cardId: state.cardId as string,
        memberId: state.memberId as string,
      }),
    );
    state.memberAssigned = false;
  }

  if (state.cardId && state.labelApplied && state.labelId) {
    await cleanupStep(result, options.log, "remove smoke card label", () =>
      invoke("card_label_remove", {
        cardId: state.cardId as string,
        labelId: state.labelId as string,
      }),
    );
    state.labelApplied = false;
  }

  for (const label of [...result.created.labels].reverse()) {
    await cleanupStep(
      result,
      options.log,
      `delete smoke label ${label.id}`,
      () => invoke("label_delete", { labelId: label.id }),
    );
  }

  for (const card of [...result.created.cards].reverse()) {
    await cleanupStep(result, options.log, `delete smoke card ${card.id}`, () =>
      invoke("card_delete", { cardId: card.id }),
    );
  }

  if (hasResolvedBoard(state)) {
    await cleanupUntrackedOpenArtifacts({
      invoke,
      ...(options.log ? { log: options.log } : {}),
      prefix: options.prefix,
      result,
    });
  }

  for (const list of [...result.created.lists].reverse()) {
    await cleanupStep(
      result,
      options.log,
      `archive smoke list ${list.id}`,
      () => invoke("list_archive", { closed: true, listId: list.id }),
    );
  }
}

async function cleanupUntrackedOpenArtifacts(options: {
  invoke: SmokeToolInvoker;
  log?: (event: SmokeLogEvent) => void;
  prefix: string;
  result: LiveSmokeResult;
}): Promise<void> {
  const { invoke, prefix, result } = options;
  const trackedLabelIds = new Set(result.created.labels.map(({ id }) => id));
  const trackedCardIds = new Set(result.created.cards.map(({ id }) => id));
  const trackedListIds = new Set(result.created.lists.map(({ id }) => id));

  let openLists: unknown[];
  let openCards: unknown[];
  let labels: unknown[];
  try {
    [openLists, openCards, labels] = await Promise.all([
      arrayResult(
        invoke("board_lists", {
          boardId: result.board.id,
          fields: "name,closed,idBoard",
          filter: "open",
        }),
        "board_lists untracked cleanup",
      ),
      arrayResult(
        invoke("board_cards", {
          boardId: result.board.id,
          fields: "name,closed,idList",
          filter: "open",
          limit: 1000,
        }),
        "board_cards untracked cleanup",
      ),
      arrayResult(
        invoke("board_labels", {
          boardId: result.board.id,
          fields: "name,color",
          limit: 1000,
        }),
        "board_labels untracked cleanup",
      ),
    ]);
  } catch (error) {
    const message = `discover untracked smoke artifacts: ${errorMessage(error)}`;
    result.cleanup.failures.push(message);
    options.log?.({
      level: "warn",
      message: "Untracked cleanup discovery failed",
      details: { error: message },
    });
    return;
  }

  const untrackedLabels = untrackedArtifacts(labels, prefix, trackedLabelIds);
  const untrackedCards = untrackedArtifacts(openCards, prefix, trackedCardIds);
  const untrackedLists = untrackedArtifacts(openLists, prefix, trackedListIds);

  for (const label of untrackedLabels.reverse()) {
    await cleanupStep(
      result,
      options.log,
      `delete untracked smoke label ${label.id}`,
      () => invoke("label_delete", { labelId: label.id }),
    );
  }

  for (const card of untrackedCards.reverse()) {
    await cleanupStep(
      result,
      options.log,
      `delete untracked smoke card ${card.id}`,
      () => invoke("card_delete", { cardId: card.id }),
    );
  }

  for (const list of untrackedLists.reverse()) {
    await cleanupStep(
      result,
      options.log,
      `archive untracked smoke list ${list.id}`,
      () => invoke("list_archive", { closed: true, listId: list.id }),
    );
  }

  const recovered =
    untrackedLabels.length + untrackedCards.length + untrackedLists.length;
  if (recovered > 0) {
    verify(
      result,
      `cleanup recovered ${recovered} untracked prefix-matched smoke artifacts`,
    );
  }
}

async function cleanupStep(
  result: LiveSmokeResult,
  log: ((event: SmokeLogEvent) => void) | undefined,
  label: string,
  action: () => Promise<unknown>,
): Promise<void> {
  result.cleanup.attempted.push(label);
  try {
    await action();
    result.cleanup.completed.push(label);
  } catch (error) {
    const message = `${label}: ${errorMessage(error)}`;
    result.cleanup.failures.push(message);
    log?.({
      level: "warn",
      message: "Cleanup step failed",
      details: { error: message },
    });
  }
}

async function verifyNoOpenArtifacts(
  invoke: SmokeToolInvoker,
  result: LiveSmokeResult,
  prefix: string,
  log?: (event: SmokeLogEvent) => void,
): Promise<void> {
  try {
    const [openLists, openCards, labels] = await Promise.all([
      arrayResult(
        invoke("board_lists", {
          boardId: result.board.id,
          fields: "name,closed,idBoard",
          filter: "open",
        }),
        "board_lists cleanup verification",
      ),
      arrayResult(
        invoke("board_cards", {
          boardId: result.board.id,
          fields: "name,closed,idList",
          filter: "open",
          limit: 1000,
        }),
        "board_cards cleanup verification",
      ),
      arrayResult(
        invoke("board_labels", {
          boardId: result.board.id,
          fields: "name,color",
          limit: 1000,
        }),
        "board_labels cleanup verification",
      ),
    ]);
    result.cleanup.remainingOpenArtifacts.push(
      ...matchingNames(openLists, prefix, "open list"),
      ...matchingNames(openCards, prefix, "open card"),
      ...matchingNames(labels, prefix, "label"),
    );
    if (result.cleanup.remainingOpenArtifacts.length === 0) {
      verify(
        result,
        "cleanup verification found no open temp lists, cards, or labels",
      );
    }
  } catch (error) {
    const message = `cleanup verification: ${errorMessage(error)}`;
    result.cleanup.failures.push(message);
    log?.({
      level: "warn",
      message: "Cleanup verification failed",
      details: { error: message },
    });
  }
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
): SmokeArtifact[] {
  return matchingArtifacts(values, prefix).filter(
    (artifact) => !trackedIds.has(artifact.id),
  );
}

function matchingArtifacts(values: unknown[], prefix: string): SmokeArtifact[] {
  const artifacts: SmokeArtifact[] = [];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function updateArtifactName(
  artifacts: SmokeArtifact[],
  id: string,
  name: string,
): void {
  const artifact = artifacts.find((candidate) => candidate.id === id);
  if (artifact) {
    artifact.name = name;
  }
}

function verify(result: LiveSmokeResult, message: string): void {
  result.verified.push(message);
}

function isOptedIn(value: string | undefined): boolean {
  return value !== undefined && OPT_IN_VALUES.has(value.trim().toLowerCase());
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function liveSmokeBoardRef(env: NodeJS.ProcessEnv): string | undefined {
  const boardId = nonEmpty(env.TRELLO_LIVE_SMOKE_BOARD_ID);
  if (boardId) {
    return boardIdentifier(boardId, "TRELLO_LIVE_SMOKE_BOARD_ID");
  }

  const boardUrl = nonEmpty(env.TRELLO_LIVE_SMOKE_BOARD_URL);
  if (boardUrl) {
    return boardIdentifier(boardUrl, "TRELLO_LIVE_SMOKE_BOARD_URL");
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
      throw new LiveSmokeConfigError(
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
    throw new LiveSmokeConfigError(
      `${source} must be a Trello board id, short link, or trello.com /b/ board URL.`,
    );
  }
  if (/^[A-Za-z0-9_-]+$/.test(raw)) {
    return raw;
  }
  throw new LiveSmokeConfigError(
    `${source} must be a Trello board id, short link, or trello.com /b/ board URL.`,
  );
}

function smokeRunId(value: string | undefined, now: Date): string {
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

async function main(): Promise<void> {
  let config: LiveSmokeConfig;
  try {
    config = loadLiveSmokeConfig();
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
    return;
  }

  const logger = createLogger({
    LOG_LEVEL: config.logLevel,
    TRANSPORT: "stdio",
  });
  const clientConfig: LiveSmokeClientConfig = {
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
    const result = await runLiveSmokeFlow({
      boardRef: config.boardRef,
      invoke,
      log: printEvent,
      runId: config.runId,
    });
    console.log(formatLiveSmokeSummary(result));
  } catch (error) {
    if (error instanceof LiveSmokeRunError) {
      console.error(formatLiveSmokeSummary(error.result));
      for (const failure of error.result.failures) {
        console.error(`Failure: ${redactedMessage(failure, secrets)}`);
      }
      for (const failure of error.result.cleanup.failures) {
        console.error(`Cleanup failure: ${redactedMessage(failure, secrets)}`);
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
