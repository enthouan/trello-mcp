import { describe, expect, it } from "vitest";
import {
  LiveSmokeConfigError,
  LiveSmokeRunError,
  loadLiveSmokeConfig,
  runLiveSmokeFlow,
  type SmokeLogEvent,
  type SmokeToolInvoker,
} from "../scripts/live-smoke.js";

type FakeBoard = {
  closed: boolean;
  id: string;
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
  pos?: string | number;
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

type FakeCall = {
  input: Record<string, unknown>;
  name: string;
};

function createFakeSmokeInvoker(
  options: {
    boardName?: string;
    failAfterCreateOn?: string;
    failOn?: string;
  } = {},
): {
  calls: FakeCall[];
  invoke: SmokeToolInvoker;
  state: {
    actions: Map<string, FakeAction>;
    cards: Map<string, FakeCard>;
    checklists: Map<string, FakeChecklist>;
    checklistItems: Map<string, FakeChecklistItem>;
    labels: Map<string, FakeLabel>;
    lists: Map<string, FakeList>;
  };
} {
  const board: FakeBoard = {
    closed: false,
    id: "board1",
    name: options.boardName ?? "Live Smoke Board",
  };
  const member: FakeMember = {
    fullName: "Ada Lovelace",
    id: "member1",
    username: "ada",
  };
  const state = {
    actions: new Map<string, FakeAction>(),
    cards: new Map<string, FakeCard>(),
    checklists: new Map<string, FakeChecklist>(),
    checklistItems: new Map<string, FakeChecklistItem>(),
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
        return [];
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
      case "list_create": {
        const id = next("list");
        const list = {
          closed: false,
          id,
          idBoard: requiredInputString(input, "boardId"),
          name: requiredInputString(input, "name"),
        };
        state.lists.set(id, list);
        if (options.failAfterCreateOn === name) {
          throw new Error(`planned post-create failure in ${name}`);
        }
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
          idBoard: list.idBoard,
          idLabels: [],
          idList: list.id,
          idMembers: [],
          labels: [],
          name: requiredInputString(input, "name"),
        };
        state.cards.set(id, card);
        if (options.failAfterCreateOn === name) {
          throw new Error(`planned post-create failure in ${name}`);
        }
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
      case "label_create": {
        const id = next("label");
        const label = {
          color: requiredInputString(input, "color"),
          id,
          idBoard: requiredInputString(input, "boardId"),
          name: requiredInputString(input, "name"),
        };
        state.labels.set(id, label);
        if (options.failAfterCreateOn === name) {
          throw new Error(`planned post-create failure in ${name}`);
        }
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
        if (!card.idLabels.includes(label.id)) {
          card.idLabels.push(label.id);
          card.labels.push(label);
        }
        return { action: "label_added", success: true };
      }
      case "card_labels": {
        const card = requiredMapValue(
          state.cards,
          requiredInputString(input, "cardId"),
        );
        return { id: card.id, idLabels: card.idLabels, labels: card.labels };
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
      case "card_checklist_update": {
        const checklist = requiredMapValue(
          state.checklists,
          requiredInputString(input, "checklistId"),
        );
        const nameValue = optionalInputString(input, "name");
        if (nameValue) {
          checklist.name = nameValue;
        }
        if (typeof input.pos === "string" || typeof input.pos === "number") {
          checklist.pos = input.pos;
        }
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
      case "card_delete": {
        const cardId = requiredInputString(input, "cardId");
        state.cards.delete(cardId);
        for (const [checklistId, checklist] of state.checklists) {
          if (checklist.idCard === cardId) {
            state.checklists.delete(checklistId);
            for (const [itemId, item] of state.checklistItems) {
              if (item.idChecklist === checklistId) {
                state.checklistItems.delete(itemId);
              }
            }
          }
        }
        return { _value: null };
      }
      default:
        throw new Error(`Unhandled fake tool: ${name}`);
    }
  };

  return { calls, invoke, state };
}

describe("live smoke config", () => {
  it("fails loudly without opt-in while not exposing secret values", () => {
    expect(() =>
      loadLiveSmokeConfig({
        TRELLO_API_KEY: "secret-key",
        TRELLO_TOKEN: "secret-token",
      }),
    ).toThrow(LiveSmokeConfigError);

    try {
      loadLiveSmokeConfig({
        TRELLO_API_KEY: "secret-key",
        TRELLO_TOKEN: "secret-token",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(LiveSmokeConfigError);
      expect((error as Error).message).toContain("TRELLO_LIVE_SMOKE=1");
      expect((error as Error).message).not.toContain("secret-key");
      expect((error as Error).message).not.toContain("secret-token");
    }
  });

  it("parses explicit opt-in, board URLs, and deterministic run ids", () => {
    const config = loadLiveSmokeConfig(
      {
        LOG_LEVEL: "debug",
        TRELLO_API_KEY: "key1",
        TRELLO_LIVE_SMOKE: "true",
        TRELLO_LIVE_SMOKE_BOARD_URL: "https://trello.com/b/GnKmvuHz/trello-mcp",
        TRELLO_TOKEN: "token1",
      },
      new Date("2026-06-14T10:11:12.123Z"),
    );

    expect(config).toMatchObject({
      TRELLO_API_KEY: "key1",
      TRELLO_TOKEN: "token1",
      boardRef: "GnKmvuHz",
      logLevel: "debug",
      runId: "local-2026-06-14T10-11-12-123Z",
    });
  });

  it("accepts www Trello board URLs", () => {
    const config = loadLiveSmokeConfig({
      TRELLO_API_KEY: "key1",
      TRELLO_LIVE_SMOKE: "1",
      TRELLO_LIVE_SMOKE_BOARD_URL: "https://www.trello.com/b/GnKmvuHz/board",
      TRELLO_TOKEN: "token1",
    });

    expect(config.boardRef).toBe("GnKmvuHz");
  });

  it("rejects non-board URLs without echoing credential query strings", () => {
    const credentialUrl =
      "https://api.trello.com/b/board1?key=secret-key&token=secret-token";

    expect(() =>
      loadLiveSmokeConfig({
        TRELLO_API_KEY: "key1",
        TRELLO_LIVE_SMOKE: "1",
        TRELLO_LIVE_SMOKE_BOARD_URL: credentialUrl,
        TRELLO_TOKEN: "token1",
      }),
    ).toThrow(LiveSmokeConfigError);

    try {
      loadLiveSmokeConfig({
        TRELLO_API_KEY: "key1",
        TRELLO_LIVE_SMOKE: "1",
        TRELLO_LIVE_SMOKE_BOARD_URL: credentialUrl,
        TRELLO_TOKEN: "token1",
      });
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("TRELLO_LIVE_SMOKE_BOARD_URL");
      expect(message).not.toContain("secret-key");
      expect(message).not.toContain("secret-token");
      expect(message).not.toContain(credentialUrl);
    }
  });
});

describe("live smoke flow", () => {
  it("exercises representative workflows and cleans up happy-path artifacts", async () => {
    const fake = createFakeSmokeInvoker();
    const logs: SmokeLogEvent[] = [];

    const result = await runLiveSmokeFlow({
      boardRef:
        "https://trello.com/b/board1/live-smoke?key=secret-key&token=secret-token",
      invoke: fake.invoke,
      log: (event) => logs.push(event),
      runId: "unit",
    });

    expect(result.failures).toEqual([]);
    expect(result.cleanup.failures).toEqual([]);
    expect(result.cleanup.remainingOpenArtifacts).toEqual([]);
    expect(result.created.lists).toHaveLength(2);
    expect(result.created.cards).toHaveLength(1);
    expect(result.created.labels).toHaveLength(1);
    expect(result.verified).toEqual(
      expect.arrayContaining([
        expect.stringContaining("authenticated"),
        "created, read, and renamed disposable lists",
        "created and read disposable card relationships",
        "updated, archived, restored, and moved disposable card",
        "created, updated, applied, and removed disposable label",
        "safely assigned and removed authenticated member",
        "created, read, renamed, updated, checked, and deleted checklist item and checklist",
        "created, updated, listed, and deleted a card comment",
        "cleanup verification found no open temp lists, cards, or labels",
      ]),
    );

    expect(fake.state.cards.size).toBe(0);
    expect(fake.state.labels.size).toBe(0);
    expect(Array.from(fake.state.lists.values())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ closed: true }),
        expect.objectContaining({ closed: true }),
      ]),
    );
    expect(fake.calls.map((call) => call.name)).toEqual(
      expect.arrayContaining([
        "auth_whoami",
        "auth_token_info",
        "list_boards",
        "board_get",
        "board_lists",
        "board_cards",
        "board_labels",
        "board_members",
        "board_memberships",
        "list_create",
        "list_update",
        "card_create",
        "card_update",
        "card_archive",
        "card_move",
        "label_create",
        "card_label_add",
        "card_label_remove",
        "card_member_add",
        "card_member_remove",
        "card_checklist_create",
        "card_checklist_update",
        "card_checklist_item_create",
        "card_checklist_item_set_checked",
        "card_checklist_item_delete",
        "card_checklist_delete",
        "card_comment_add",
        "card_comment_update",
        "card_comment_delete",
        "card_delete",
        "list_archive",
      ]),
    );
    expect(logs.some((event) => event.level === "error")).toBe(false);
    expect(logs[0]).toMatchObject({
      details: { boardRef: "board1", runId: "unit" },
    });
    expect(JSON.stringify(logs)).not.toContain("secret-key");
    expect(JSON.stringify(logs)).not.toContain("secret-token");
  });

  it("still deletes and archives tracked artifacts after a mid-flow failure", async () => {
    const fake = createFakeSmokeInvoker({
      failOn: "card_checklist_item_create",
    });

    let thrown: unknown;
    try {
      await runLiveSmokeFlow({
        boardRef: "board1",
        invoke: fake.invoke,
        runId: "unit-failure",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LiveSmokeRunError);
    const result = (thrown as LiveSmokeRunError).result;
    expect(result.failures).toEqual([
      "planned failure in card_checklist_item_create",
    ]);
    expect(result.cleanup.completed).toEqual(
      expect.arrayContaining([
        expect.stringContaining("delete smoke label"),
        expect.stringContaining("delete smoke card"),
        expect.stringContaining("archive smoke list"),
      ]),
    );
    expect(fake.state.cards.size).toBe(0);
    expect(fake.state.labels.size).toBe(0);
    expect(
      Array.from(fake.state.lists.values()).every((list) => list.closed),
    ).toBe(true);
  });

  it.each([
    {
      completedStep: "archive untracked smoke list",
      failAfterCreateOn: "list_create",
      remaining: () => undefined,
    },
    {
      completedStep: "delete untracked smoke card",
      failAfterCreateOn: "card_create",
      remaining: (fake: ReturnType<typeof createFakeSmokeInvoker>) =>
        fake.state.cards.size,
    },
    {
      completedStep: "delete untracked smoke label",
      failAfterCreateOn: "label_create",
      remaining: (fake: ReturnType<typeof createFakeSmokeInvoker>) =>
        fake.state.labels.size,
    },
  ])(
    "discovers and cleans up untracked artifacts after $failAfterCreateOn post-create failures",
    async ({ completedStep, failAfterCreateOn, remaining }) => {
      const fake = createFakeSmokeInvoker({ failAfterCreateOn });

      let thrown: unknown;
      try {
        await runLiveSmokeFlow({
          boardRef: "board1",
          invoke: fake.invoke,
          runId: `unit-${failAfterCreateOn}`,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(LiveSmokeRunError);
      const result = (thrown as LiveSmokeRunError).result;
      expect(result.failures).toEqual([
        `planned post-create failure in ${failAfterCreateOn}`,
      ]);
      expect(result.verified).toContain(
        "cleanup recovered 1 untracked prefix-matched smoke artifacts",
      );
      expect(result.cleanup.completed).toEqual(
        expect.arrayContaining([expect.stringContaining(completedStep)]),
      );
      expect(result.cleanup.remainingOpenArtifacts).toEqual([]);
      expect(
        Array.from(fake.state.lists.values()).every((list) => list.closed),
      ).toBe(true);
      expect(remaining?.(fake) ?? 0).toBe(0);
    },
  );

  it("does not clean up artifacts from run ids that only share a prefix", async () => {
    const fake = createFakeSmokeInvoker({ failAfterCreateOn: "list_create" });
    fake.state.lists.set("other-list", {
      closed: false,
      id: "other-list",
      idBoard: "board1",
      name: "trello-mcp live smoke pr-10 primary list",
    });
    fake.state.cards.set("other-card", {
      closed: false,
      desc: "",
      due: null,
      dueComplete: false,
      id: "other-card",
      idBoard: "board1",
      idLabels: [],
      idList: "other-list",
      idMembers: [],
      labels: [],
      name: "trello-mcp live smoke pr-10 card",
    });
    fake.state.labels.set("other-label", {
      color: "blue",
      id: "other-label",
      idBoard: "board1",
      name: "trello-mcp live smoke pr-10 label",
    });

    let thrown: unknown;
    try {
      await runLiveSmokeFlow({
        boardRef: "board1",
        invoke: fake.invoke,
        runId: "pr-1",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LiveSmokeRunError);
    expect(fake.state.lists.get("other-list")).toMatchObject({
      closed: false,
    });
    expect(fake.state.cards.has("other-card")).toBe(true);
    expect(fake.state.labels.has("other-label")).toBe(true);
    expect(
      (thrown as LiveSmokeRunError).result.cleanup.remainingOpenArtifacts,
    ).toEqual([]);
  });

  it("still performs untracked cleanup when the board is named unknown", async () => {
    const fake = createFakeSmokeInvoker({
      boardName: "unknown",
      failAfterCreateOn: "list_create",
    });

    let thrown: unknown;
    try {
      await runLiveSmokeFlow({
        boardRef: "board1",
        invoke: fake.invoke,
        runId: "unknown-board",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LiveSmokeRunError);
    const result = (thrown as LiveSmokeRunError).result;
    expect(result.board.name).toBe("unknown");
    expect(result.verified).toContain(
      "cleanup recovered 1 untracked prefix-matched smoke artifacts",
    );
    expect(result.cleanup.completed).toEqual(
      expect.arrayContaining([
        expect.stringContaining("archive untracked smoke list"),
      ]),
    );
    expect(result.cleanup.remainingOpenArtifacts).toEqual([]);
    expect(
      Array.from(fake.state.lists.values()).every((list) => list.closed),
    ).toBe(true);
  });
});

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
