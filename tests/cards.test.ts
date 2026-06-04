import { describe, expect, it, vi } from "vitest";
import { cardTools } from "../src/trello/cards.js";
import { TrelloApiError } from "../src/utils/errors.js";

type CardTool = (typeof cardTools)[number];

function getCardTool<TName extends CardTool["name"]>(
  name: TName,
): Extract<CardTool, { name: TName }> {
  const tool = cardTools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing card tool: ${name}`);
  }
  return tool as Extract<CardTool, { name: TName }>;
}

describe("card tools", () => {
  it("rejects bad create-card input with schema validation", () => {
    const tool = getCardTool("trello_card_create");

    expect(() =>
      tool.inputSchema.parse({ listId: "list1", name: "", due: "not-a-date" }),
    ).toThrow();
  });

  it("calls Trello with parsed create-card inputs", async () => {
    const tool = getCardTool("trello_card_create");
    const trello = {
      request: vi.fn(async () => ({ id: "card1", name: "New card" })),
    };

    await expect(
      tool.handler(
        { listId: "list1", name: "New card", pos: "bottom" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({ id: "card1", name: "New card" });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        query: expect.objectContaining({ idList: "list1", name: "New card" }),
      }),
    );
  });

  it("normalizes Trello card URLs before requesting card details", async () => {
    const tool = getCardTool("trello_card_get");
    const trello = {
      request: vi.fn(async () => ({ id: "card1", name: "Existing card" })),
    };

    await expect(
      tool.handler(
        {
          cardId: "https://trello.com/c/AbCd1234/example-card",
          fields: "all",
        },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({ id: "card1", name: "Existing card" });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/AbCd1234",
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({ fields: "all" }),
        resourceType: "card",
      }),
    );
  });

  it("adds the required card name field when minimizing card fields", async () => {
    const tool = getCardTool("trello_card_get");
    const trello = {
      request: vi.fn(async () => ({
        id: "card1",
        name: "About this roadmap",
        idLabels: ["label1"],
        labels: [{ id: "label1", name: "Docs", color: "green" }],
      })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", fields: "labels,idLabels" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual(expect.objectContaining({ idLabels: ["label1"] }));
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1",
      expect.anything(),
      expect.objectContaining({
        query: { fields: "labels,idLabels,name" },
        resourceType: "card",
        resourceId: "card1",
      }),
    );
  });

  it("lists custom field items on a card", async () => {
    const tool = getCardTool("trello_card_custom_field_items");
    const trello = {
      request: vi.fn(async () => [
        {
          id: "item1",
          idCustomField: "field1",
          idModel: "card1",
          modelType: "card",
          value: { text: "Hello" },
        },
      ]),
    };

    await expect(
      tool.handler(
        { cardId: "card1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual([
      {
        id: "item1",
        idCustomField: "field1",
        idModel: "card1",
        modelType: "card",
        value: { text: "Hello" },
      },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/customFieldItems",
      expect.anything(),
      expect.objectContaining({
        resourceType: "card custom field items",
        resourceId: "card1",
      }),
    );
  });

  it("lists list custom field items with null values and option ids", async () => {
    const tool = getCardTool("trello_card_custom_field_items");
    const trello = {
      request: vi.fn(
        async (_path: string, schema: { parse: (value: unknown) => unknown }) =>
          schema.parse([
            {
              id: "item1",
              idCustomField: "field1",
              idModel: "card1",
              modelType: "card",
              value: null,
              idValue: "option1",
            },
          ]),
      ),
    };

    await expect(
      tool.handler(
        { cardId: "card1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual([
      {
        id: "item1",
        idCustomField: "field1",
        idModel: "card1",
        modelType: "card",
        value: null,
        idValue: "option1",
      },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/customFieldItems",
      expect.anything(),
      expect.objectContaining({
        resourceType: "card custom field items",
        resourceId: "card1",
      }),
    );
  });

  it.each([
    {
      input: { type: "text", text: "Hello" },
      responseValue: { text: "Hello" },
      expectedBody: { value: { text: "Hello" } },
    },
    {
      input: { type: "number", number: "42" },
      responseValue: { number: "42" },
      expectedBody: { value: { number: "42" } },
    },
    {
      input: { type: "date", date: "2026-06-03T16:00:00.000Z" },
      responseValue: { date: "2026-06-03T16:00:00.000Z" },
      expectedBody: { value: { date: "2026-06-03T16:00:00.000Z" } },
    },
    {
      input: { type: "checkbox", checked: true },
      responseValue: { checked: "true" },
      expectedBody: { value: { checked: "true" } },
    },
  ] as const)(
    "sets $input.type custom field values with Trello's type-specific body shape",
    async ({ input, responseValue, expectedBody }) => {
      const tool = getCardTool("trello_card_custom_field_set");
      const trello = {
        request: vi.fn(async () => ({
          id: "item1",
          idCustomField: "field1",
          value: responseValue,
        })),
      };

      await expect(
        tool.handler(
          {
            cardId: "card1",
            customFieldId: "field1",
            ...input,
          },
          { trello: trello as never, logger: {} as never, requestId: "req1" },
        ),
      ).resolves.toEqual({
        id: "item1",
        idCustomField: "field1",
        value: responseValue,
      });
      expect(trello.request).toHaveBeenCalledWith(
        "/cards/card1/customField/field1/item",
        expect.anything(),
        expect.objectContaining({
          method: "PUT",
          body: expectedBody,
          resourceType: "card custom field item",
          resourceId: "field1",
        }),
      );
    },
  );

  it("sets list custom fields by option id", async () => {
    const tool = getCardTool("trello_card_custom_field_set");
    const trello = {
      request: vi.fn(async () => ({
        idCustomField: "field1",
        idValue: "option1",
      })),
    };

    await expect(
      tool.handler(
        {
          cardId: "card1",
          customFieldId: "field1",
          type: "list",
          optionId: "option1",
        },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({ idCustomField: "field1", idValue: "option1" });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/customField/field1/item",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        body: { idValue: "option1" },
      }),
    );
  });

  it("clears custom field values with an empty PUT body shape", async () => {
    const tool = getCardTool("trello_card_custom_field_clear");
    const trello = {
      request: vi.fn(async () => ({})),
    };

    await expect(
      tool.handler(
        { cardId: "card1", customFieldId: "field1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({});
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/customField/field1/item",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        body: { idValue: "", value: "" },
        resourceType: "card custom field item",
        resourceId: "field1",
      }),
    );
  });

  it("rejects mismatched custom field set input before requesting Trello", () => {
    const tool = getCardTool("trello_card_custom_field_set");

    expect(() =>
      tool.inputSchema.parse({
        cardId: "card1",
        customFieldId: "field1",
        type: "date",
        text: "not a date",
      }),
    ).toThrow();
  });

  it("adds comments to cards through Trello comment actions", async () => {
    const tool = getCardTool("trello_card_comment_add");
    const trello = {
      request: vi.fn(async () => ({
        id: "action1",
        type: "commentCard",
        data: { text: "Looks good" },
      })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", text: "Looks good" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({
      id: "action1",
      type: "commentCard",
      data: { text: "Looks good" },
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/actions/comments",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        query: { text: "Looks good" },
        resourceType: "card",
        resourceId: "card1",
      }),
    );
  });

  it("updates a card comment by comment action id", async () => {
    const tool = getCardTool("trello_card_comment_update");
    const trello = {
      request: vi.fn(async () => ({
        id: "action1",
        type: "commentCard",
        data: { text: "Updated" },
      })),
    };

    await expect(
      tool.handler(
        { actionId: "action1", text: "Updated" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({
      id: "action1",
      type: "commentCard",
      data: { text: "Updated" },
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/actions/action1/text",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: { value: "Updated" },
        resourceType: "card comment",
        resourceId: "action1",
      }),
    );
  });

  it("deletes a card comment by comment action id", async () => {
    const tool = getCardTool("trello_card_comment_delete");
    const trello = {
      request: vi.fn(async () => ({ _value: null })),
    };

    await expect(
      tool.handler(
        { actionId: "action1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({ _value: null });
    expect(trello.request).toHaveBeenCalledWith(
      "/actions/action1",
      expect.anything(),
      expect.objectContaining({
        method: "DELETE",
        resourceType: "card comment",
        resourceId: "action1",
      }),
    );
  });

  it("rejects empty card comment text before requesting Trello", () => {
    const tool = getCardTool("trello_card_comment_add");

    expect(() =>
      tool.inputSchema.parse({ cardId: "card1", text: "" }),
    ).toThrow();
  });

  it("creates checklist items on an existing checklist", async () => {
    const tool = getCardTool("trello_card_checklist_item_create");
    const trello = {
      request: vi.fn(async () => ({
        id: "item1",
        idChecklist: "checklist1",
        name: "Ship it",
        state: "incomplete",
      })),
    };

    await expect(
      tool.handler(
        {
          checklistId: "checklist1",
          name: "Ship it",
          pos: "bottom",
          checked: false,
          memberId: "member1",
        },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({
      id: "item1",
      idChecklist: "checklist1",
      name: "Ship it",
      state: "incomplete",
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/checklists/checklist1/checkItems",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        query: expect.objectContaining({
          name: "Ship it",
          pos: "bottom",
          checked: false,
          idMember: "member1",
        }),
        resourceType: "checklist",
        resourceId: "checklist1",
      }),
    );
  });

  it("sets checklist item state through the card check item endpoint", async () => {
    const tool = getCardTool("trello_card_checklist_item_set_checked");
    const trello = {
      request: vi.fn(async () => ({
        id: "item1",
        idChecklist: "checklist1",
        name: "Ship it",
        state: "complete",
      })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", checkItemId: "item1", checked: true },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({
      id: "item1",
      idChecklist: "checklist1",
      name: "Ship it",
      state: "complete",
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/checkItem/item1",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: { state: "complete" },
        resourceType: "checklist item",
        resourceId: "item1",
      }),
    );
  });

  it("unchecks checklist items through the card check item endpoint", async () => {
    const tool = getCardTool("trello_card_checklist_item_set_checked");
    const trello = {
      request: vi.fn(async () => ({
        id: "item1",
        idChecklist: "checklist1",
        name: "Ship it",
        state: "incomplete",
      })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", checkItemId: "item1", checked: false },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual(
      expect.objectContaining({ id: "item1", state: "incomplete" }),
    );
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/checkItem/item1",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: { state: "incomplete" },
      }),
    );
  });

  it("updates and moves checklist items on cards", async () => {
    const tool = getCardTool("trello_card_checklist_item_update");
    const trello = {
      request: vi.fn(async () => ({
        id: "item1",
        idChecklist: "checklist2",
        name: "Updated",
        state: "incomplete",
        pos: 16384,
      })),
    };

    await expect(
      tool.handler(
        {
          cardId: "card1",
          checkItemId: "item1",
          checklistId: "checklist2",
          name: "Updated",
          pos: 16384,
          memberId: null,
        },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({
      id: "item1",
      idChecklist: "checklist2",
      name: "Updated",
      state: "incomplete",
      pos: 16384,
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/checkItem/item1",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: expect.objectContaining({
          idChecklist: "checklist2",
          name: "Updated",
          pos: 16384,
          idMember: null,
        }),
        resourceType: "checklist item",
        resourceId: "item1",
      }),
    );
  });

  it("moves checklist items with the dedicated move tool", async () => {
    const tool = getCardTool("trello_card_checklist_item_move");
    const trello = {
      request: vi.fn(async () => ({
        id: "item1",
        idChecklist: "checklist2",
        name: "Ship it",
        state: "incomplete",
        pos: "top",
      })),
    };

    await expect(
      tool.handler(
        {
          cardId: "card1",
          checkItemId: "item1",
          checklistId: "checklist2",
          pos: "top",
        },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual(expect.objectContaining({ idChecklist: "checklist2" }));
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/checkItem/item1",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: { idChecklist: "checklist2", pos: "top" },
      }),
    );
  });

  it("deletes checklist items from cards", async () => {
    const tool = getCardTool("trello_card_checklist_item_delete");
    const trello = {
      request: vi.fn(async () => ({ _value: null })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", checkItemId: "item1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({ _value: null });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/checkItem/item1",
      expect.anything(),
      expect.objectContaining({
        method: "DELETE",
        resourceType: "checklist item",
        resourceId: "item1",
      }),
    );
  });

  it("rejects invalid checklist item state before requesting Trello", () => {
    const tool = getCardTool("trello_card_checklist_item_update");

    expect(() =>
      tool.inputSchema.parse({
        cardId: "card1",
        checkItemId: "item1",
        state: "done",
      }),
    ).toThrow();
  });

  it("adds the required checklist item name field when minimizing checklist item fields", async () => {
    const tool = getCardTool("trello_card_checklist_items");
    const trello = {
      request: vi.fn(async () => [
        { id: "item1", name: "Confirm fields", state: "incomplete" },
      ]),
    };

    await expect(
      tool.handler(
        { checklistId: "checklist1", filter: "all", fields: "state" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual([
      { id: "item1", name: "Confirm fields", state: "incomplete" },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/checklists/checklist1/checkItems",
      expect.anything(),
      expect.objectContaining({
        query: { filter: "all", fields: "state,name" },
        resourceType: "checklist",
        resourceId: "checklist1",
      }),
    );
  });

  it("gets a card's board relationship", async () => {
    const tool = getCardTool("trello_card_board");
    const trello = {
      request: vi.fn(async () => ({ id: "board1", name: "Project" })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", fields: "name,url" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({ id: "board1", name: "Project" });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/board",
      expect.anything(),
      expect.objectContaining({
        query: { fields: "name,url" },
        resourceType: "card",
        resourceId: "card1",
      }),
    );
  });

  it("gets a card's list relationship", async () => {
    const tool = getCardTool("trello_card_list");
    const trello = {
      request: vi.fn(async () => ({ id: "list1", name: "Doing" })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", fields: "name,pos" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({ id: "list1", name: "Doing" });
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/list",
      expect.anything(),
      expect.objectContaining({
        query: { fields: "name,pos" },
        resourceType: "card",
        resourceId: "card1",
      }),
    );
  });

  it("lists card labels through a focused card labels lookup", async () => {
    const tool = getCardTool("trello_card_labels");
    const trello = {
      request: vi.fn(async () => ({
        id: "card1",
        idLabels: ["label1"],
        labels: [{ id: "label1", name: "Urgent", color: "red" }],
      })),
    };

    await expect(
      tool.handler(
        { cardId: "card1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual(expect.objectContaining({ idLabels: ["label1"] }));
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1",
      expect.anything(),
      expect.objectContaining({
        query: { fields: "labels,idLabels" },
        resourceType: "card",
        resourceId: "card1",
      }),
    );
  });

  it("sets card due dates without changing unrelated card fields", async () => {
    const tool = getCardTool("trello_card_due_date_set");
    const due = "2026-07-01T12:00:00.000Z";
    const trello = {
      request: vi.fn(async () => ({
        id: "card1",
        name: "Due soon",
        due,
        dueComplete: true,
      })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", due, dueComplete: true },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual(expect.objectContaining({ dueComplete: true }));
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: { due, dueComplete: true },
      }),
    );
  });

  it("marks due completion without requiring the due date value", async () => {
    const tool = getCardTool("trello_card_due_date_set");
    const trello = {
      request: vi.fn(async () => ({
        id: "card1",
        name: "Due soon",
        dueComplete: true,
      })),
    };

    await expect(
      tool.handler(
        tool.inputSchema.parse({ cardId: "card1", dueComplete: true }),
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual(expect.objectContaining({ dueComplete: true }));
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: { dueComplete: true },
      }),
    );
  });

  it("rejects no-op focused due date updates", () => {
    const tool = getCardTool("trello_card_due_date_set");

    expect(() => tool.inputSchema.parse({ cardId: "card1" })).toThrow(
      "Provide at least one of due or dueComplete.",
    );
  });

  it("sets card position without moving lists or boards", async () => {
    const tool = getCardTool("trello_card_position_set");
    const trello = {
      request: vi.fn(async () => ({ id: "card1", name: "Ranked", pos: "top" })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", pos: "top" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual(expect.objectContaining({ pos: "top" }));
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: { pos: "top" },
      }),
    );
  });

  it("sets a card cover from an existing attachment", async () => {
    const tool = getCardTool("trello_card_cover_set");
    const trello = {
      request: vi.fn(async () => ({
        id: "card1",
        name: "Covered",
        idAttachmentCover: "attach1",
      })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", attachmentId: "attach1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual(
      expect.objectContaining({ idAttachmentCover: "attach1" }),
    );
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1",
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        query: { idAttachmentCover: "attach1" },
      }),
    );
  });

  it("creates a board label and applies it to a card", async () => {
    const tool = getCardTool("trello_card_label_create_and_add");
    const trello = {
      request: vi.fn(async () => ({
        id: "label1",
        idBoard: "board1",
        name: "Blocked",
        color: "black",
      })),
    };

    await expect(
      tool.handler(
        { cardId: "card1", name: "Blocked", color: "black" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual(expect.objectContaining({ id: "label1" }));
    expect(trello.request).toHaveBeenCalledWith(
      "/cards/card1/labels",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        query: { name: "Blocked", color: "black" },
        resourceType: "card",
        resourceId: "card1",
      }),
    );
  });

  it("allows Trello API errors to be mapped by the tool factory", async () => {
    const tool = getCardTool("trello_card_get");
    const error = new TrelloApiError(500, "Trello failed", { status: 500 });

    await expect(
      tool.handler(
        { cardId: "card1", fields: "all" },
        {
          trello: {
            request: vi.fn(async () => Promise.reject(error)),
          } as never,
          logger: {} as never,
          requestId: "req1",
        },
      ),
    ).rejects.toBe(error);
  });
});
