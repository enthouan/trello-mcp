import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatLiveRegressionReport,
  LiveRegressionConfigError,
  type LiveRegressionDomain,
  LiveRegressionRunError,
  loadLiveRegressionConfig,
  parseLiveRegressionArgs,
  runLiveRegressionSuite,
  writeLiveRegressionJsonReport,
} from "../scripts/live-regression.js";
import type { SmokeToolInvoker } from "../scripts/live-smoke.js";

type FakeBoard = {
  closed: boolean;
  id: string;
  idOrganization: string | null;
  name: string;
};

type FakeList = {
  closed: boolean;
  id: string;
  idBoard: string;
  name: string;
};

type FakeLabel = {
  color: string;
  id: string;
  idBoard: string;
  name: string;
};

type FakeMember = {
  fullName: string;
  id: string;
  username: string;
};

type FakeCard = {
  closed: boolean;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  id: string;
  idAttachmentCover: string | null;
  idBoard: string;
  idLabels: string[];
  idList: string;
  idMembers: string[];
  labels: FakeLabel[];
  name: string;
};

type FakeChecklist = {
  id: string;
  idCard: string;
  name: string;
};

type FakeChecklistItem = {
  id: string;
  idChecklist: string;
  name: string;
  state: "complete" | "incomplete";
};

type FakeAction = {
  data: { text: string };
  id: string;
  type: string;
};

type FakeAttachment = {
  id: string;
  idCard: string;
  name: string;
  url: string;
};

type FakeCall = {
  input: Record<string, unknown>;
  name: string;
};

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    tempDirs
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("live regression config", () => {
  it("requires a separate live regression opt-in without exposing secrets", () => {
    expect(() =>
      loadLiveRegressionConfig({
        TRELLO_API_KEY: "secret-key",
        TRELLO_LIVE_SMOKE: "1",
        TRELLO_TOKEN: "secret-token",
      }),
    ).toThrow(LiveRegressionConfigError);

    try {
      loadLiveRegressionConfig({
        TRELLO_API_KEY: "secret-key",
        TRELLO_LIVE_SMOKE: "1",
        TRELLO_TOKEN: "secret-token",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(LiveRegressionConfigError);
      expect((error as Error).message).toContain("TRELLO_LIVE_REGRESSION=1");
      expect((error as Error).message).not.toContain("secret-key");
      expect((error as Error).message).not.toContain("secret-token");
    }
  });

  it("parses board URLs, filters, JSON report paths, upload files, and deterministic run ids", () => {
    const config = loadLiveRegressionConfig(
      {
        LOG_LEVEL: "debug",
        TRELLO_API_KEY: "key1",
        TRELLO_ATTACHMENT_UPLOAD_ROOT: "/tmp/uploads",
        TRELLO_LIVE_REGRESSION: "yes",
        TRELLO_LIVE_REGRESSION_BOARD_URL:
          "https://www.trello.com/b/GnKmvuHz/board",
        TRELLO_LIVE_REGRESSION_DOMAINS: "cards,attachments",
        TRELLO_LIVE_REGRESSION_REPORT_JSON: "reports/live.json",
        TRELLO_LIVE_REGRESSION_TOOLS: "card_get,card_attachment_upload",
        TRELLO_LIVE_REGRESSION_UPLOAD_FILE: "sample.txt",
        TRELLO_TOKEN: "token1",
      },
      new Date("2026-06-14T10:11:12.123Z"),
    );

    expect(config).toMatchObject({
      TRELLO_API_KEY: "key1",
      TRELLO_ATTACHMENT_UPLOAD_ROOT: "/tmp/uploads",
      TRELLO_TOKEN: "token1",
      boardRef: "GnKmvuHz",
      domains: ["cards", "attachments"],
      jsonReportPath: "reports/live.json",
      logLevel: "debug",
      runId: "local-2026-06-14T10-11-12-123Z",
      tools: ["card_get", "card_attachment_upload"],
      uploadFile: "sample.txt",
    });
  });

  it("accepts CLI filters and rejects unknown domains or tools", () => {
    const cli = parseLiveRegressionArgs([
      "--domain",
      "cards",
      "--tools=card_get,card_update",
      "--json",
      "live.json",
      "--run-id",
      "pr-127",
    ]);

    expect(cli).toEqual({
      domains: ["cards"],
      jsonReportPath: "live.json",
      runId: "pr-127",
      tools: ["card_get,card_update"],
    });

    expect(() =>
      loadLiveRegressionConfig(
        regressionEnv(),
        new Date("2026-06-14T10:11:12.123Z"),
        { domains: ["unknown"] },
      ),
    ).toThrow(LiveRegressionConfigError);
    expect(() =>
      loadLiveRegressionConfig(
        regressionEnv(),
        new Date("2026-06-14T10:11:12.123Z"),
        { tools: ["missing_tool"] },
      ),
    ).toThrow(LiveRegressionConfigError);
  });

  it("rejects non-board URLs without echoing credential query strings or contacting Trello", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const credentialUrl =
      "https://api.trello.com/b/board1?key=secret-key&token=secret-token";

    expect(() =>
      loadLiveRegressionConfig({
        TRELLO_API_KEY: "key1",
        TRELLO_LIVE_REGRESSION: "1",
        TRELLO_LIVE_REGRESSION_BOARD_URL: credentialUrl,
        TRELLO_TOKEN: "token1",
      }),
    ).toThrow(LiveRegressionConfigError);

    try {
      loadLiveRegressionConfig({
        TRELLO_API_KEY: "key1",
        TRELLO_LIVE_REGRESSION: "1",
        TRELLO_LIVE_REGRESSION_BOARD_URL: credentialUrl,
        TRELLO_TOKEN: "token1",
      });
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("TRELLO_LIVE_REGRESSION_BOARD_URL");
      expect(message).not.toContain("secret-key");
      expect(message).not.toContain("secret-token");
      expect(message).not.toContain(credentialUrl);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("live regression suite", () => {
  it("runs the full mocked suite, reports coverage, skips config-dependent tools, and cleans up", async () => {
    const fake = createFakeRegressionInvoker();

    const result = await runLiveRegressionSuite({
      boardRef:
        "https://trello.com/b/board1/live-regression?key=secret-key&token=secret-token",
      invoke: fake.invoke,
      runId: "unit",
    });

    expect(result.failures).toEqual([]);
    expect(result.cleanup.failures).toEqual([]);
    expect(result.cleanup.remainingOpenArtifacts).toEqual([]);
    expect(
      result.coverage.filter((entry) => entry.status === "missing"),
    ).toEqual([]);
    expect(result.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "covered", tool: "auth_whoami" }),
        expect.objectContaining({ status: "covered", tool: "card_get" }),
        expect.objectContaining({
          status: "covered",
          tool: "card_checklist_delete",
        }),
        expect.objectContaining({
          status: "covered",
          tool: "card_checklist_item_move",
        }),
        expect.objectContaining({
          status: "unsupported",
          tool: "board_create",
        }),
        expect.objectContaining({
          status: "skipped",
          tool: "card_attachment_upload",
        }),
        expect.objectContaining({
          status: "skipped",
          tool: "custom_field_get",
        }),
        expect.objectContaining({
          status: "unsupported",
          tool: "list_move_to_board",
        }),
      ]),
    );
    expect(fake.state.cards.size).toBe(0);
    expect(fake.state.labels.size).toBe(0);
    expect(fake.state.attachments.size).toBe(0);
    expect(
      Array.from(fake.state.lists.values()).every((list) => list.closed),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain("secret-key");
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("supports targeted domain and tool filters without running unrelated write domains", async () => {
    const authOnly = createFakeRegressionInvoker();
    const authResult = await runLiveRegressionSuite({
      boardRef: "board1",
      domains: ["auth"],
      invoke: authOnly.invoke,
      runId: "auth-only",
    });

    expect(authResult.created.cards).toEqual([]);
    expect(authOnly.calls.map((call) => call.name)).not.toContain(
      "card_create",
    );
    expect(
      authResult.coverage.filter((entry) => entry.status === "missing"),
    ).toEqual([]);

    const cardOnly = createFakeRegressionInvoker();
    const cardResult = await runLiveRegressionSuite({
      boardRef: "board1",
      invoke: cardOnly.invoke,
      runId: "card-only",
      tools: ["card_get"],
    });

    expect(cardResult.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "covered", tool: "card_get" }),
      ]),
    );
    const cardCallNames = cardOnly.calls.map((call) => call.name);
    expect(cardCallNames).toContain("card_create");
    expect(cardCallNames).not.toContain("label_create");
    expect(cardCallNames).not.toContain("card_update");
    expect(cardCallNames).not.toContain("card_due_date_set");
    expect(cardCallNames).not.toContain("card_position_set");
    expect(cardCallNames).not.toContain("card_cover_set");
    expect(cardCallNames).not.toContain("card_archive");
    expect(cardCallNames).not.toContain("card_move");
    expect(
      cardResult.coverage.filter((entry) => entry.status === "missing"),
    ).toEqual([]);
  });

  it("rejects domain and tool filter combinations with no overlap before invoking tools", async () => {
    expect(() =>
      loadLiveRegressionConfig(
        regressionEnv(),
        new Date("2026-06-14T10:11:12.123Z"),
        { domains: ["labels"], tools: ["card_get"] },
      ),
    ).toThrow(LiveRegressionConfigError);

    const fake = createFakeRegressionInvoker();
    await expect(
      runLiveRegressionSuite({
        boardRef: "board1",
        domains: ["labels"],
        invoke: fake.invoke,
        runId: "empty-intersection",
        tools: ["card_get"],
      }),
    ).rejects.toThrow(LiveRegressionConfigError);
    expect(fake.calls).toEqual([]);
  });

  it("covers create and list tools when they are the focused tool filter", async () => {
    for (const { domain, tool } of [
      { domain: "labels", tool: "label_create" },
      { domain: "checklists", tool: "card_checklist_create" },
      { domain: "members", tool: "board_members" },
      { domain: "cards", tool: "list_cards" },
    ]) {
      const fake = createFakeRegressionInvoker();
      const result = await runLiveRegressionSuite({
        boardRef: "board1",
        invoke: fake.invoke,
        runId: `focused-${tool}`,
        tools: [tool],
      });

      expect(fake.calls.map((call) => call.name)).toContain(tool);
      expect(result.coverage).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ domain, status: "covered", tool }),
        ]),
      );
      expect(
        result.coverage.filter((entry) => entry.status === "missing"),
      ).toEqual([]);
    }
  });

  it("marks board_create unsupported until live board cleanup is available", async () => {
    const fake = createFakeRegressionInvoker();

    const result = await runLiveRegressionSuite({
      boardRef: "board1",
      invoke: fake.invoke,
      runId: "board-create",
      tools: ["board_create"],
    });

    expect(fake.calls.map((call) => call.name)).not.toContain("board_create");
    expect(result.coverage).toEqual([
      expect.objectContaining({
        domain: "boards",
        reason:
          "Creates a real Trello board; live regression defers coverage until a verified board cleanup path exists.",
        status: "unsupported",
        tool: "board_create",
      }),
    ]);
  });

  it("classifies list_workspaces under the workspaces domain", async () => {
    const fake = createFakeRegressionInvoker();

    const result = await runLiveRegressionSuite({
      boardRef: "board1",
      domains: ["workspaces"],
      invoke: fake.invoke,
      runId: "workspace-only",
    });

    expect(result.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "workspaces",
          status: "covered",
          tool: "list_workspaces",
        }),
      ]),
    );
    expect(
      result.coverage.filter(
        (entry) => entry.tool === "list_workspaces" && entry.domain === "lists",
      ),
    ).toEqual([]);
  });

  it("covers upload attachments only when upload file config is explicitly present", async () => {
    const fake = createFakeRegressionInvoker();
    const result = await runLiveRegressionSuite({
      boardRef: "board1",
      domains: ["attachments"],
      invoke: fake.invoke,
      runId: "upload",
      uploadFile: "sample.txt",
    });

    expect(result.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "covered",
          tool: "card_attachment_upload",
        }),
      ]),
    );
    expect(fake.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: expect.objectContaining({ filePath: "sample.txt" }),
          name: "card_attachment_upload",
        }),
      ]),
    );
    expect(fake.state.attachments.size).toBe(0);
  });

  it("runs cleanup after an intermediate failure and reports the failed run", async () => {
    const fake = createFakeRegressionInvoker({ failOn: "card_update" });

    let thrown: unknown;
    try {
      await runLiveRegressionSuite({
        boardRef: "board1",
        domains: ["cards"],
        invoke: fake.invoke,
        runId: "failure",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LiveRegressionRunError);
    const result = (thrown as LiveRegressionRunError).result;
    expect(result.failures).toEqual(["planned failure in card_update"]);
    expect(result.cleanup.completed).toEqual(
      expect.arrayContaining([
        expect.stringContaining("delete regression card"),
        expect.stringContaining("archive regression list"),
      ]),
    );
    expect(fake.state.cards.size).toBe(0);
    expect(
      Array.from(fake.state.lists.values()).every((list) => list.closed),
    ).toBe(true);
  });

  it("discovers and cleans up untracked prefix-matched artifacts after post-create failures", async () => {
    const fake = createFakeRegressionInvoker({
      failAfterCreateOn: "card_create",
    });

    let thrown: unknown;
    try {
      await runLiveRegressionSuite({
        boardRef: "board1",
        domains: ["cards"],
        invoke: fake.invoke,
        runId: "post-create",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LiveRegressionRunError);
    const result = (thrown as LiveRegressionRunError).result;
    expect(result.verified).toContain(
      "cleanup recovered 1 untracked prefix-matched regression artifacts",
    );
    expect(result.cleanup.completed).toEqual(
      expect.arrayContaining([
        expect.stringContaining("delete untracked regression card"),
      ]),
    );
    expect(result.cleanup.remainingOpenArtifacts).toEqual([]);
    expect(fake.state.cards.size).toBe(0);
  });

  it("formats and writes human-readable and JSON reports", async () => {
    const fake = createFakeRegressionInvoker();
    const result = await runLiveRegressionSuite({
      boardRef: "board1",
      domains: ["attachments"],
      invoke: fake.invoke,
      runId: "report",
    });

    const report = formatLiveRegressionReport(result);
    expect(report).toContain("Live Trello regression run report");
    expect(report).toContain("attachments:");
    expect(report).toContain("covered:");
    expect(report).toContain("skipped: card_attachment_upload");
    expect(report).toContain(
      "Cleanup verification: no open regression artifacts found",
    );

    const dir = await mkdtemp(join(tmpdir(), "trello-mcp-live-regression-"));
    tempDirs.push(dir);
    const path = join(dir, "report.json");
    await writeLiveRegressionJsonReport(result, path);
    const parsed = JSON.parse(await readFile(path, "utf8")) as {
      runId: string;
    };
    expect(parsed.runId).toBe("report");
  });
});

function createFakeRegressionInvoker(
  options: {
    customFields?: unknown[];
    domains?: LiveRegressionDomain[];
    failAfterCreateOn?: string;
    failOn?: string;
    workspaceVisible?: boolean;
  } = {},
): {
  calls: FakeCall[];
  invoke: SmokeToolInvoker;
  state: {
    actions: Map<string, FakeAction>;
    attachments: Map<string, FakeAttachment>;
    cards: Map<string, FakeCard>;
    checklistItems: Map<string, FakeChecklistItem>;
    checklists: Map<string, FakeChecklist>;
    customFieldItems: Map<string, Record<string, unknown>>;
    labels: Map<string, FakeLabel>;
    lists: Map<string, FakeList>;
  };
} {
  const board: FakeBoard = {
    closed: false,
    id: "board1",
    idOrganization: options.workspaceVisible === false ? null : "workspace1",
    name: "Live Regression Board",
  };
  const member: FakeMember = {
    fullName: "Ada Lovelace",
    id: "member1",
    username: "ada",
  };
  const workspace = {
    displayName: "Regression Workspace",
    id: "workspace1",
    idBoards: [board.id],
    name: "regression-workspace",
    url: "https://trello.com/w/regression",
    website: null,
  };
  const state = {
    actions: new Map<string, FakeAction>(),
    attachments: new Map<string, FakeAttachment>(),
    cards: new Map<string, FakeCard>(),
    checklistItems: new Map<string, FakeChecklistItem>(),
    checklists: new Map<string, FakeChecklist>(),
    customFieldItems: new Map<string, Record<string, unknown>>(),
    labels: new Map<string, FakeLabel>(),
    lists: new Map<string, FakeList>(),
  };
  const calls: FakeCall[] = [];
  let nextId = 1;

  const next = (prefix: string): string => `${prefix}${nextId++}`;
  const invoke: SmokeToolInvoker = async (name, input) => {
    calls.push({ input, name });
    if (options.failOn === name) {
      throw new Error(`planned failure in ${name}`);
    }

    switch (name) {
      case "auth_whoami":
        return member;
      case "auth_token_info":
        return {
          id: "token1",
          idMember: member.id,
          identifier: "trello-mcp-test",
          permissions: [
            { idModel: board.id, modelType: "board", read: true, write: true },
          ],
        };
      case "list_boards":
        return [board];
      case "board_get":
        return board;
      case "board_field_get":
        return board.name;
      case "board_custom_fields":
        return options.customFields ?? [];
      case "board_lists":
        return listsForFilter(state.lists, input);
      case "board_cards":
        return cardsForFilter(state.cards, input);
      case "board_labels":
        return Array.from(state.labels.values());
      case "board_members":
        return [member];
      case "board_memberships":
        return [
          {
            id: "membership1",
            idMember: member.id,
            member,
            memberType: "admin",
          },
        ];
      case "list_workspaces":
        return options.workspaceVisible === false ? [] : [workspace];
      case "workspace_get":
        return workspace;
      case "workspace_boards":
        return [board];
      case "workspace_members":
        return [member];
      case "list_create": {
        const id = next("list");
        const list = {
          closed: false,
          id,
          idBoard: requiredInputString(input, "boardId"),
          name: requiredInputString(input, "name"),
        };
        state.lists.set(id, list);
        failAfterCreate(options, name);
        return list;
      }
      case "list_get":
        return requiredMapValue(
          state.lists,
          requiredInputString(input, "listId"),
        );
      case "list_update": {
        const list = requiredMapValue(
          state.lists,
          requiredInputString(input, "listId"),
        );
        const nameValue = optionalInputString(input, "name");
        if (nameValue) {
          list.name = nameValue;
        }
        if (typeof input.closed === "boolean") {
          list.closed = input.closed;
        }
        return list;
      }
      case "list_archive": {
        const list = requiredMapValue(
          state.lists,
          requiredInputString(input, "listId"),
        );
        list.closed = input.closed !== false;
        return list;
      }
      case "card_create": {
        const list = requiredMapValue(
          state.lists,
          requiredInputString(input, "listId"),
        );
        const id = next("card");
        const card = {
          closed: false,
          desc: optionalInputString(input, "desc") ?? "",
          due: null,
          dueComplete: false,
          id,
          idAttachmentCover: null,
          idBoard: list.idBoard,
          idLabels: [],
          idList: list.id,
          idMembers: [],
          labels: [],
          name: requiredInputString(input, "name"),
        };
        state.cards.set(id, card);
        failAfterCreate(options, name);
        return card;
      }
      case "card_get":
        return requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
      case "card_board":
        return board;
      case "card_list": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        return requiredMapValue(state.lists, card.idList);
      }
      case "card_labels": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        return { id: card.id, idLabels: card.idLabels, labels: card.labels };
      }
      case "list_cards": {
        const listId = requiredInputString(input, "listId");
        return cardsForFilter(state.cards, input).filter(
          (card) => card.idList === listId,
        );
      }
      case "card_update": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        const nameValue = optionalInputString(input, "name");
        if (nameValue) {
          card.name = nameValue;
        }
        const descValue = optionalInputString(input, "desc");
        if (descValue) {
          card.desc = descValue;
        }
        return card;
      }
      case "card_due_date_set": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        card.due = optionalInputString(input, "due") ?? null;
        card.dueComplete = input.dueComplete === true;
        return card;
      }
      case "card_position_set":
        return requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
      case "card_cover_set": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        card.idAttachmentCover =
          optionalInputString(input, "attachmentId") ?? null;
        return card;
      }
      case "card_archive": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        card.closed = input.closed !== false;
        return card;
      }
      case "card_move": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        card.idList = requiredInputString(input, "listId");
        return card;
      }
      case "card_delete":
        state.cards.delete(requiredInputString(input, "cardId"));
        return { _value: null };
      case "label_create": {
        const id = next("label");
        const label = {
          color: requiredInputString(input, "color"),
          id,
          idBoard: requiredInputString(input, "boardId"),
          name: requiredInputString(input, "name"),
        };
        state.labels.set(id, label);
        failAfterCreate(options, name);
        return label;
      }
      case "label_get":
        return requiredMapValue(
          state.labels,
          requiredInputString(input, "labelId"),
        );
      case "label_update": {
        const label = requiredMapValue(
          state.labels,
          requiredInputString(input, "labelId"),
        );
        const nameValue = optionalInputString(input, "name");
        if (nameValue) {
          label.name = nameValue;
        }
        const colorValue = optionalInputString(input, "color");
        if (colorValue) {
          label.color = colorValue;
        }
        return label;
      }
      case "label_delete":
        state.labels.delete(requiredInputString(input, "labelId"));
        return { _value: null };
      case "card_label_add": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        const label = requiredMapValue(
          state.labels,
          requiredInputString(input, "labelId"),
        );
        addLabelToCard(card, label);
        return { action: "label_added", success: true };
      }
      case "card_label_create_and_add": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        const id = next("label");
        const label = {
          color: requiredInputString(input, "color"),
          id,
          idBoard: card.idBoard,
          name: requiredInputString(input, "name"),
        };
        state.labels.set(id, label);
        addLabelToCard(card, label);
        return label;
      }
      case "card_label_remove": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        const labelId = requiredInputString(input, "labelId");
        card.idLabels = card.idLabels.filter((id) => id !== labelId);
        card.labels = card.labels.filter((label) => label.id !== labelId);
        return { action: "label_removed", success: true };
      }
      case "member_get":
        return member;
      case "member_boards":
        return [board];
      case "member_cards":
        return Array.from(state.cards.values()).filter((card) =>
          card.idMembers.includes(member.id),
        );
      case "member_workspaces":
        return options.workspaceVisible === false ? [] : [workspace];
      case "card_members": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        return card.idMembers.map((id) => ({ ...member, id }));
      }
      case "card_member_add": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        const memberId = requiredInputString(input, "memberId");
        if (!card.idMembers.includes(memberId)) {
          card.idMembers.push(memberId);
        }
        return { action: "member_added", success: true };
      }
      case "card_member_remove": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        const memberId = requiredInputString(input, "memberId");
        card.idMembers = card.idMembers.filter((id) => id !== memberId);
        return { action: "member_removed", success: true };
      }
      case "card_checklist_create": {
        const id = next("checklist");
        const checklist = {
          id,
          idCard: requiredInputString(input, "cardId"),
          name: requiredInputString(input, "name"),
        };
        state.checklists.set(id, checklist);
        return checklist;
      }
      case "card_checklists": {
        const cardId = requiredInputString(input, "cardId");
        return Array.from(state.checklists.values()).filter(
          (checklist) => checklist.idCard === cardId,
        );
      }
      case "card_checklist_item_create": {
        const id = next("checkItem");
        const item = {
          id,
          idChecklist: requiredInputString(input, "checklistId"),
          name: requiredInputString(input, "name"),
          state: input.checked === true ? "complete" : "incomplete",
        } satisfies FakeChecklistItem;
        state.checklistItems.set(id, item);
        return item;
      }
      case "card_checklist_items": {
        const checklistId = requiredInputString(input, "checklistId");
        return Array.from(state.checklistItems.values()).filter(
          (item) => item.idChecklist === checklistId,
        );
      }
      case "card_checklist_item_update": {
        const item = requiredMapValue(
          state.checklistItems,
          requiredInputString(input, "checkItemId"),
        );
        const nameValue = optionalInputString(input, "name");
        if (nameValue) {
          item.name = nameValue;
        }
        if (input.state === "complete" || input.state === "incomplete") {
          item.state = input.state;
        }
        return item;
      }
      case "card_checklist_item_set_checked": {
        const item = requiredMapValue(
          state.checklistItems,
          requiredInputString(input, "checkItemId"),
        );
        item.state = input.checked === true ? "complete" : "incomplete";
        return item;
      }
      case "card_checklist_item_move": {
        const item = requiredMapValue(
          state.checklistItems,
          requiredInputString(input, "checkItemId"),
        );
        item.idChecklist = requiredInputString(input, "checklistId");
        return item;
      }
      case "card_checklist_item_delete":
        state.checklistItems.delete(requiredInputString(input, "checkItemId"));
        return { _value: null };
      case "card_checklist_delete": {
        const checklistId = requiredInputString(input, "checklistId");
        state.checklists.delete(checklistId);
        for (const [itemId, item] of state.checklistItems) {
          if (item.idChecklist === checklistId) {
            state.checklistItems.delete(itemId);
          }
        }
        return { _value: null };
      }
      case "card_comment_add": {
        const id = next("action");
        const action = {
          data: { text: requiredInputString(input, "text") },
          id,
          type: "commentCard",
        };
        state.actions.set(id, action);
        return action;
      }
      case "card_comment_update": {
        const action = requiredMapValue(
          state.actions,
          requiredInputString(input, "actionId"),
        );
        action.data.text = requiredInputString(input, "text");
        return action;
      }
      case "card_actions":
        return Array.from(state.actions.values());
      case "card_comment_delete":
        state.actions.delete(requiredInputString(input, "actionId"));
        return { _value: null };
      case "card_attachments": {
        const cardId = requiredInputString(input, "cardId");
        return Array.from(state.attachments.values()).filter(
          (attachment) => attachment.idCard === cardId,
        );
      }
      case "card_attachment_add_url": {
        const id = next("attachment");
        const attachment = {
          id,
          idCard: requiredInputString(input, "cardId"),
          name: requiredInputString(input, "name"),
          url: requiredInputString(input, "url"),
        };
        state.attachments.set(id, attachment);
        return attachment;
      }
      case "card_attachment_upload": {
        const id = next("attachment");
        const attachment = {
          id,
          idCard: requiredInputString(input, "cardId"),
          name: requiredInputString(input, "name"),
          url: `file://${requiredInputString(input, "filePath")}`,
        };
        state.attachments.set(id, attachment);
        return attachment;
      }
      case "card_attachment_get":
        return requiredMapValue(
          state.attachments,
          requiredInputString(input, "attachmentId"),
        );
      case "card_attachment_delete":
        state.attachments.delete(requiredInputString(input, "attachmentId"));
        return { _value: null };
      case "card_custom_field_items": {
        const cardId = requiredInputString(input, "cardId");
        return Array.from(state.customFieldItems.values()).filter(
          (item) => item.idModel === cardId,
        );
      }
      case "custom_field_get":
        return requiredCustomField(
          options,
          requiredInputString(input, "customFieldId"),
        );
      case "custom_field_options": {
        const field = requiredCustomField(
          options,
          requiredInputString(input, "customFieldId"),
        );
        return Array.isArray(field.options) ? field.options : [];
      }
      case "card_custom_field_set": {
        const cardId = requiredInputString(input, "cardId");
        const customFieldId = requiredInputString(input, "customFieldId");
        const item = {
          id: `${cardId}-${customFieldId}`,
          idCustomField: customFieldId,
          idModel: cardId,
          modelType: "card",
        };
        state.customFieldItems.set(item.id, item);
        return item;
      }
      case "card_custom_field_clear": {
        const cardId = requiredInputString(input, "cardId");
        const customFieldId = requiredInputString(input, "customFieldId");
        state.customFieldItems.delete(`${cardId}-${customFieldId}`);
        return { _value: null };
      }
      case "search":
        return {
          boards: [board],
          cards: Array.from(state.cards.values()),
          members: [member],
          organizations: options.workspaceVisible === false ? [] : [workspace],
        };
      case "search_members":
        return [member];
      default:
        throw new Error(`Unhandled fake tool: ${name}`);
    }
  };

  return { calls, invoke, state };
}

function regressionEnv(): NodeJS.ProcessEnv {
  return {
    TRELLO_API_KEY: "key1",
    TRELLO_LIVE_REGRESSION: "1",
    TRELLO_LIVE_REGRESSION_BOARD_ID: "board1",
    TRELLO_TOKEN: "token1",
  };
}

function addLabelToCard(card: FakeCard, label: FakeLabel): void {
  if (!card.idLabels.includes(label.id)) {
    card.idLabels.push(label.id);
    card.labels.push(label);
  }
}

function failAfterCreate(
  options: { failAfterCreateOn?: string },
  name: string,
): void {
  if (options.failAfterCreateOn === name) {
    throw new Error(`planned post-create failure in ${name}`);
  }
}

function listsForFilter(
  lists: Map<string, FakeList>,
  input: Record<string, unknown>,
): FakeList[] {
  const filter = optionalInputString(input, "filter") ?? "open";
  return Array.from(lists.values()).filter((list) =>
    filter === "closed" ? list.closed : filter === "all" || !list.closed,
  );
}

function cardsForFilter(
  cards: Map<string, FakeCard>,
  input: Record<string, unknown>,
): FakeCard[] {
  const filter = optionalInputString(input, "filter") ?? "open";
  return Array.from(cards.values()).filter((card) =>
    filter === "closed" ? card.closed : filter === "all" || !card.closed,
  );
}

function requiredCustomField(
  options: { customFields?: unknown[] },
  customFieldId: string,
): Record<string, unknown> {
  const customField = (options.customFields ?? []).find(
    (field) => isRecord(field) && field.id === customFieldId,
  );
  if (!isRecord(customField)) {
    throw new Error(`Missing fake custom field ${customFieldId}`);
  }
  return customField;
}

function requiredInputString(
  input: Record<string, unknown>,
  key: string,
): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing fake input ${key}`);
  }
  return value;
}

function optionalInputString(
  input: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requiredMapValue<TValue>(
  map: Map<string, TValue>,
  id: string,
): TValue {
  const value = map.get(id);
  if (!value) {
    throw new Error(`Missing fake resource ${id}`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
