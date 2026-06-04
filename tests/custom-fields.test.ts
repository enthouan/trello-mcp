import { describe, expect, it, vi } from "vitest";
import { customFieldTools } from "../src/trello/custom-fields.js";

type CustomFieldTool = (typeof customFieldTools)[number];

function getCustomFieldTool<TName extends CustomFieldTool["name"]>(
  name: TName,
): Extract<CustomFieldTool, { name: TName }> {
  const tool = customFieldTools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing custom field tool: ${name}`);
  }
  return tool as Extract<CustomFieldTool, { name: TName }>;
}

describe("custom field tools", () => {
  it("gets one custom field definition by id", async () => {
    const tool = getCustomFieldTool("trello_custom_field_get");
    const trello = {
      request: vi.fn(async () => ({
        id: "field1",
        idModel: "board1",
        modelType: "board",
        name: "Priority",
        type: "list",
      })),
    };

    await expect(
      tool.handler(
        { customFieldId: "field1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual({
      id: "field1",
      idModel: "board1",
      modelType: "board",
      name: "Priority",
      type: "list",
    });
    expect(trello.request).toHaveBeenCalledWith(
      "/customFields/field1",
      expect.anything(),
      expect.objectContaining({
        resourceType: "custom field",
        resourceId: "field1",
      }),
    );
  });

  it("lists dropdown options for one custom field", async () => {
    const tool = getCustomFieldTool("trello_custom_field_options");
    const trello = {
      request: vi.fn(async () => [
        {
          id: "option1",
          idCustomField: "field1",
          value: { text: "High" },
          color: "red",
        },
      ]),
    };

    await expect(
      tool.handler(
        { customFieldId: "field1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual([
      {
        id: "option1",
        idCustomField: "field1",
        value: { text: "High" },
        color: "red",
      },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/customFields/field1/options",
      expect.anything(),
      expect.objectContaining({
        resourceType: "custom field options",
        resourceId: "field1",
      }),
    );
  });

  it("lists dropdown options with nullable values", async () => {
    const tool = getCustomFieldTool("trello_custom_field_options");
    const trello = {
      request: vi.fn(
        async (_path: string, schema: { parse: (value: unknown) => unknown }) =>
          schema.parse([
            {
              id: "option1",
              idCustomField: "field1",
              value: null,
              color: "none",
              pos: 16384,
            },
          ]),
      ),
    };

    await expect(
      tool.handler(
        { customFieldId: "field1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual([
      {
        id: "option1",
        idCustomField: "field1",
        value: null,
        color: "none",
        pos: 16384,
      },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/customFields/field1/options",
      expect.anything(),
      expect.objectContaining({
        resourceType: "custom field options",
        resourceId: "field1",
      }),
    );
  });

  it("normalizes option ids from the dedicated custom field options endpoint", async () => {
    const tool = getCustomFieldTool("trello_custom_field_options");
    const trello = {
      request: vi.fn(
        async (_path: string, schema: { parse: (value: unknown) => unknown }) =>
          schema.parse([
            {
              _id: "option1",
              value: { text: "High" },
              color: "red",
              pos: 16384,
            },
          ]),
      ),
    };

    await expect(
      tool.handler(
        { customFieldId: "field1" },
        { trello: trello as never, logger: {} as never, requestId: "req1" },
      ),
    ).resolves.toEqual([
      {
        id: "option1",
        value: { text: "High" },
        color: "red",
        pos: 16384,
      },
    ]);
    expect(trello.request).toHaveBeenCalledWith(
      "/customFields/field1/options",
      expect.anything(),
      expect.objectContaining({
        resourceType: "custom field options",
        resourceId: "field1",
      }),
    );
  });
});
