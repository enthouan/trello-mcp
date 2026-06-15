import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";
import { TrelloClient } from "../src/trello/client.js";
import { registerTool } from "../src/utils/tool.js";

vi.mock("../src/utils/tool.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/tool.js")>();
  return {
    ...actual,
    registerTool: vi.fn(),
  };
});

const logger = {
  child: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
};

describe("createServer", () => {
  beforeEach(() => {
    vi.mocked(registerTool).mockClear();
  });

  it("registers tools with a provided shared Trello client", () => {
    const config = loadConfig({
      TRELLO_API_KEY: "key",
      TRELLO_TOKEN: "token",
    });
    const trello = new TrelloClient(config, {
      fetcher: vi.fn(),
      sleep: async () => undefined,
    });

    createServer(config, logger as never, { trello });

    expect(registerTool).toHaveBeenCalled();
    for (const call of vi.mocked(registerTool).mock.calls) {
      expect(call[2]).toMatchObject({ trello });
    }
  });
});
