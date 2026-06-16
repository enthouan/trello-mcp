import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendLiveRegressionMarkdownSummary,
  formatLiveRegressionMarkdownSummary,
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
        TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_URL:
          "https://trello.com/b/r9BpowfZ/secondary",
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
      secondaryBoardRef: "r9BpowfZ",
      tools: ["card_get", "card_attachment_upload"],
      uploadFile: "sample.txt",
    });

    expect(
      loadLiveRegressionConfig(
        {
          ...regressionEnv(),
          TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_ID: "board2",
        },
        new Date("2026-06-14T10:11:12.123Z"),
      ).secondaryBoardRef,
    ).toBe("board2");
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
      "--secondary-board",
      "https://trello.com/b/r9BpowfZ/secondary",
    ]);

    expect(cli).toEqual({
      domains: ["cards"],
      jsonReportPath: "live.json",
      runId: "pr-127",
      secondaryBoard: "https://trello.com/b/r9BpowfZ/secondary",
      tools: ["card_get,card_update"],
    });
    expect(
      loadLiveRegressionConfig(
        regressionEnv(),
        new Date("2026-06-14T10:11:12.123Z"),
        cli,
      ).secondaryBoardRef,
    ).toBe("r9BpowfZ");

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

  it("rejects invalid secondary board URLs without echoing query-string secrets", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const credentialUrl =
      "https://api.trello.com/b/board2?key=secret-key&token=secret-token";

    expect(() =>
      loadLiveRegressionConfig({
        TRELLO_API_KEY: "key1",
        TRELLO_LIVE_REGRESSION: "1",
        TRELLO_LIVE_REGRESSION_BOARD_ID: "board1",
        TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_URL: credentialUrl,
        TRELLO_TOKEN: "token1",
      }),
    ).toThrow(LiveRegressionConfigError);

    try {
      loadLiveRegressionConfig({
        TRELLO_API_KEY: "key1",
        TRELLO_LIVE_REGRESSION: "1",
        TRELLO_LIVE_REGRESSION_BOARD_ID: "board1",
        TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_URL: credentialUrl,
        TRELLO_TOKEN: "token1",
      });
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_URL");
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
          reason:
            "Set TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_ID, TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_URL, or --secondary-board to cover cross-board list moves.",
          status: "skipped",
          tool: "list_move_to_board",
        }),
      ]),
    );
    expect(
      fake.calls.find((call) => call.name === "card_attachment_add_url")?.input,
    ).toEqual(
      expect.objectContaining({
        url: "https://dummyimage.com/600x400/0052cc/ffffff.png",
      }),
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

  it("covers list_move_to_board when a secondary board is configured", async () => {
    const fake = createFakeRegressionInvoker();

    const result = await runLiveRegressionSuite({
      boardRef: "board1",
      invoke: fake.invoke,
      runId: "unit-secondary",
      secondaryBoardRef: "https://trello.com/b/board2/secondary",
    });

    expect(result.secondaryBoard).toEqual({
      id: "board2",
      name: "Live Regression Board 2",
    });
    expect(result.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "covered",
          tool: "list_move_to_board",
        }),
      ]),
    );
    expect(fake.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: expect.objectContaining({ boardId: "board2" }),
          name: "list_move_to_board",
        }),
      ]),
    );
    expect(
      [...fake.state.lists.values()].filter(
        (list) => list.idBoard === "board2",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          closed: true,
          name: expect.stringContaining("movable list"),
        }),
      ]),
    );
    expect(fake.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: expect.objectContaining({ boardId: "board1" }),
          name: "board_lists",
        }),
        expect.objectContaining({
          input: expect.objectContaining({ boardId: "board2" }),
          name: "board_lists",
        }),
      ]),
    );
    expect(result.cleanup.remainingOpenArtifacts).toEqual([]);
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

  it("does not resolve secondary boards for unrelated focused runs", async () => {
    const fake = createFakeRegressionInvoker();

    const result = await runLiveRegressionSuite({
      boardRef: "board1",
      invoke: fake.invoke,
      runId: "card-only-with-secondary",
      secondaryBoardRef: "missing-board",
      tools: ["card_get"],
    });

    expect(result.secondaryBoard).toBeUndefined();
    expect(result.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "covered", tool: "card_get" }),
      ]),
    );
    expect(fake.calls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: expect.objectContaining({ boardId: "missing-board" }),
          name: "board_get",
        }),
      ]),
    );
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
      { domain: "lists", tool: "list_create" },
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

  it("skips focused list_move_to_board runs when no secondary board is configured", async () => {
    const fake = createFakeRegressionInvoker();

    const result = await runLiveRegressionSuite({
      boardRef: "board1",
      invoke: fake.invoke,
      runId: "focused-list-move-no-secondary",
      tools: ["list_move_to_board"],
    });

    expect(result.coverage).toEqual([
      expect.objectContaining({
        reason:
          "Set TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_ID, TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_URL, or --secondary-board to cover cross-board list moves.",
        status: "skipped",
        tool: "list_move_to_board",
      }),
    ]);
    expect(fake.calls.map((call) => call.name)).not.toContain("list_create");
    expect(fake.calls.map((call) => call.name)).not.toContain(
      "list_move_to_board",
    );
  });

  it("runs focused list_move_to_board only after primary and secondary board setup", async () => {
    const fake = createFakeRegressionInvoker();

    const result = await runLiveRegressionSuite({
      boardRef: "board1",
      invoke: fake.invoke,
      runId: "focused-list-move",
      secondaryBoardRef: "board2",
      tools: ["list_move_to_board"],
    });

    const callNames = fake.calls.map((call) => call.name);
    expect(callNames).toEqual(
      expect.arrayContaining([
        "auth_whoami",
        "auth_token_info",
        "board_get",
        "list_boards",
        "list_create",
        "list_move_to_board",
        "list_archive",
      ]),
    );
    expect(callNames.indexOf("list_boards")).toBeLessThan(
      callNames.indexOf("list_create"),
    );
    expect(callNames.indexOf("list_create")).toBeLessThan(
      callNames.indexOf("list_move_to_board"),
    );
    expect(callNames).not.toContain("list_get");
    expect(callNames).not.toContain("list_update");
    expect(result.coverage).toEqual([
      expect.objectContaining({
        status: "covered",
        tool: "list_move_to_board",
      }),
    ]);
  });

  it("fake regression invoker filters lists and cards by board id", async () => {
    const fake = createFakeRegressionInvoker();
    const primaryList = (await fake.invoke("list_create", {
      boardId: "board1",
      name: "primary",
    })) as FakeList;
    const secondaryList = (await fake.invoke("list_create", {
      boardId: "board2",
      name: "secondary",
    })) as FakeList;
    const secondaryCard = (await fake.invoke("card_create", {
      listId: secondaryList.id,
      name: "secondary card",
    })) as FakeCard;

    await fake.invoke("card_create", {
      listId: primaryList.id,
      name: "primary card",
    });

    expect(await fake.invoke("board_lists", { boardId: "board1" })).toEqual([
      expect.objectContaining({ id: primaryList.id }),
    ]);
    expect(await fake.invoke("board_lists", { boardId: "board2" })).toEqual([
      expect.objectContaining({ id: secondaryList.id }),
    ]);
    expect(await fake.invoke("board_cards", { boardId: "board2" })).toEqual([
      expect.objectContaining({ id: secondaryCard.id }),
    ]);
  });

  it("covers cross-resource action audit tools under the comments-actions domain", async () => {
    for (const tool of ["board_actions", "list_actions", "workspace_actions"]) {
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
          expect.objectContaining({
            domain: "comments-actions",
            status: "covered",
            tool,
          }),
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

  it("archives a moved list and checks the secondary board after a post-move failure", async () => {
    const fake = createFakeRegressionInvoker({
      failAfterMoveOn: "list_move_to_board",
    });

    let thrown: unknown;
    try {
      await runLiveRegressionSuite({
        boardRef: "board1",
        invoke: fake.invoke,
        runId: "post-move",
        secondaryBoardRef: "board2",
        tools: ["list_move_to_board"],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LiveRegressionRunError);
    const result = (thrown as LiveRegressionRunError).result;
    expect(result.failures).toEqual([
      "planned post-move failure in list_move_to_board",
    ]);
    expect(result.cleanup.completed).toEqual(
      expect.arrayContaining([
        expect.stringContaining("archive regression list"),
      ]),
    );
    expect(
      [...fake.state.lists.values()].filter((list) =>
        list.name.includes("movable list"),
      ),
    ).toEqual([expect.objectContaining({ closed: true, idBoard: "board2" })]);
    expect(fake.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: expect.objectContaining({ boardId: "board2" }),
          name: "board_lists",
        }),
      ]),
    );
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

    const summary = formatLiveRegressionMarkdownSummary(result);
    expect(summary).toContain("## Live Trello Regression");
    expect(summary).toContain("**Result:** Passed");
    expect(summary).toContain("| skipped | 1 |");
    expect(summary).toContain("### Skipped Live Coverage");

    const failedSummary = formatLiveRegressionMarkdownSummary(
      {
        ...result,
        coverage: [
          ...result.coverage,
          {
            domain: "search",
            reason: "No live regression scenario covers this tool.",
            status: "missing",
            tool: "search",
          },
        ],
        failures: ["secret-key failure"],
      },
      { secrets: ["secret-key"] },
    );
    expect(failedSummary).toContain("**Result:** Failed");
    expect(failedSummary).toContain("### Failures");
    expect(failedSummary).toContain("[redacted] failure");
    expect(failedSummary).toContain("### Missing Live Coverage");

    const dir = await mkdtemp(join(tmpdir(), "trello-mcp-live-regression-"));
    tempDirs.push(dir);
    const jsonPath = join(dir, "report.json");
    await writeLiveRegressionJsonReport(result, jsonPath);
    const parsed = JSON.parse(await readFile(jsonPath, "utf8")) as {
      runId: string;
    };
    expect(parsed.runId).toBe("report");

    const summaryPath = join(dir, "summary.md");
    await appendLiveRegressionMarkdownSummary(result, summaryPath);
    expect(await readFile(summaryPath, "utf8")).toContain(
      "## Live Trello Regression",
    );
  });
});

function createFakeRegressionInvoker(
  options: {
    customFields?: unknown[];
    domains?: LiveRegressionDomain[];
    failAfterCreateOn?: string;
    failAfterMoveOn?: string;
    failOn?: string;
    workspaceVisible?: boolean;
  } = {},
): {
  calls: FakeCall[];
  invoke: SmokeToolInvoker;
  state: {
    actions: Map<string, FakeAction>;
    attachments: Map<string, FakeAttachment>;
    boards: Map<string, FakeBoard>;
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
  const secondaryBoard: FakeBoard = {
    closed: false,
    id: "board2",
    idOrganization: options.workspaceVisible === false ? null : "workspace1",
    name: "Live Regression Board 2",
  };
  const boards = new Map<string, FakeBoard>([
    [board.id, board],
    [secondaryBoard.id, secondaryBoard],
  ]);
  const member: FakeMember = {
    fullName: "Ada Lovelace",
    id: "member1",
    username: "ada",
  };
  const workspace = {
    displayName: "Regression Workspace",
    id: "workspace1",
    idBoards: [...boards.keys()],
    name: "regression-workspace",
    url: "https://trello.com/w/regression",
    website: null,
  };
  const state = {
    actions: new Map<string, FakeAction>(),
    attachments: new Map<string, FakeAttachment>(),
    boards,
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
          permissions: [...boards.values()].map((visibleBoard) => ({
            idModel: visibleBoard.id,
            modelType: "board",
            read: true,
            write: true,
          })),
        };
      case "list_boards":
        return openBoards(boards);
      case "board_get":
        return requiredMapValue(boards, requiredInputString(input, "boardId"));
      case "board_field_get":
        return requiredMapValue(boards, requiredInputString(input, "boardId"))
          .name;
      case "board_custom_fields":
        return options.customFields ?? [];
      case "board_lists":
        return listsForFilter(state.lists, input);
      case "board_cards":
        return cardsForFilter(state.cards, input);
      case "board_labels":
        return labelsForFilter(state.labels, input);
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
        return openBoards(boards);
      case "workspace_members":
        return [member];
      case "list_create": {
        requiredMapValue(boards, requiredInputString(input, "boardId"));
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
      case "list_move_to_board": {
        const list = requiredMapValue(
          state.lists,
          requiredInputString(input, "listId"),
        );
        const boardId = requiredInputString(input, "boardId");
        requiredMapValue(boards, boardId);
        list.idBoard = boardId;
        for (const card of state.cards.values()) {
          if (card.idList === list.id) {
            card.idBoard = boardId;
          }
        }
        failAfterMove(options, name);
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
      case "card_board": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        return requiredMapValue(boards, card.idBoard);
      }
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
        return openBoards(boards);
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
      case "board_actions":
        return Array.from(state.actions.values());
      case "list_actions":
        return Array.from(state.actions.values());
      case "workspace_actions":
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
          boards: openBoards(boards),
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

function failAfterMove(
  options: { failAfterMoveOn?: string },
  name: string,
): void {
  if (options.failAfterMoveOn === name) {
    throw new Error(`planned post-move failure in ${name}`);
  }
}

function openBoards(boards: Map<string, FakeBoard>): FakeBoard[] {
  return [...boards.values()].filter((board) => !board.closed);
}

function listsForFilter(
  lists: Map<string, FakeList>,
  input: Record<string, unknown>,
): FakeList[] {
  const filter = optionalInputString(input, "filter") ?? "open";
  const boardId = optionalInputString(input, "boardId");
  return Array.from(lists.values()).filter((list) => {
    if (boardId && list.idBoard !== boardId) {
      return false;
    }
    return filter === "closed" ? list.closed : filter === "all" || !list.closed;
  });
}

function cardsForFilter(
  cards: Map<string, FakeCard>,
  input: Record<string, unknown>,
): FakeCard[] {
  const filter = optionalInputString(input, "filter") ?? "open";
  const boardId = optionalInputString(input, "boardId");
  return Array.from(cards.values()).filter((card) => {
    if (boardId && card.idBoard !== boardId) {
      return false;
    }
    return filter === "closed" ? card.closed : filter === "all" || !card.closed;
  });
}

function labelsForFilter(
  labels: Map<string, FakeLabel>,
  input: Record<string, unknown>,
): FakeLabel[] {
  const boardId = optionalInputString(input, "boardId");
  return Array.from(labels.values()).filter(
    (label) => !boardId || label.idBoard === boardId,
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
