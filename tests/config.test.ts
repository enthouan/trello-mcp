import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const baseEnv = {
  TRELLO_API_KEY: "key",
  TRELLO_TOKEN: "token",
};

describe("loadConfig", () => {
  it("loads default rate-limit and retry settings", () => {
    expect(loadConfig(baseEnv)).toEqual(
      expect.objectContaining({
        TRELLO_RATE_LIMIT_CAPACITY: 100,
        TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS: 10_000,
        TRELLO_RETRY_MAX_ATTEMPTS: 3,
        TRELLO_RETRY_BASE_DELAY_MS: 100,
        TRELLO_RETRY_MAX_DELAY_MS: 2_000,
      }),
    );
  });

  it("loads custom rate-limit and retry settings", () => {
    expect(
      loadConfig({
        ...baseEnv,
        TRELLO_RATE_LIMIT_CAPACITY: "25",
        TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS: "5000",
        TRELLO_RETRY_MAX_ATTEMPTS: "5",
        TRELLO_RETRY_BASE_DELAY_MS: "250",
        TRELLO_RETRY_MAX_DELAY_MS: "5000",
      }),
    ).toEqual(
      expect.objectContaining({
        TRELLO_RATE_LIMIT_CAPACITY: 25,
        TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS: 5_000,
        TRELLO_RETRY_MAX_ATTEMPTS: 5,
        TRELLO_RETRY_BASE_DELAY_MS: 250,
        TRELLO_RETRY_MAX_DELAY_MS: 5_000,
      }),
    );
  });

  it("treats empty rate-limit and retry settings as defaults", () => {
    expect(
      loadConfig({
        ...baseEnv,
        TRELLO_RATE_LIMIT_CAPACITY: "  ",
        TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS: "",
        TRELLO_RETRY_MAX_ATTEMPTS: "  ",
        TRELLO_RETRY_BASE_DELAY_MS: "",
        TRELLO_RETRY_MAX_DELAY_MS: "  ",
      }),
    ).toEqual(
      expect.objectContaining({
        TRELLO_RATE_LIMIT_CAPACITY: 100,
        TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS: 10_000,
        TRELLO_RETRY_MAX_ATTEMPTS: 3,
        TRELLO_RETRY_BASE_DELAY_MS: 100,
        TRELLO_RETRY_MAX_DELAY_MS: 2_000,
      }),
    );
  });

  it.each([
    "TRELLO_RATE_LIMIT_CAPACITY",
    "TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS",
    "TRELLO_RETRY_MAX_ATTEMPTS",
    "TRELLO_RETRY_BASE_DELAY_MS",
    "TRELLO_RETRY_MAX_DELAY_MS",
  ] as const)("rejects invalid %s values", (name) => {
    for (const value of ["0", "-1", "1.5", "not-a-number"]) {
      expect(() =>
        loadConfig({
          ...baseEnv,
          [name]: value,
        }),
      ).toThrow();
    }
  });

  it("still requires Trello credentials", () => {
    expect(() => loadConfig({ TRELLO_TOKEN: "token" })).toThrow();
    expect(() => loadConfig({ TRELLO_API_KEY: "key" })).toThrow();
  });

  it("loads the optional HTTP MCP auth token when provided", () => {
    expect(
      loadConfig({
        ...baseEnv,
        MCP_AUTH_TOKEN: "shared-secret",
      }),
    ).toEqual(
      expect.objectContaining({
        MCP_AUTH_TOKEN: "shared-secret",
      }),
    );
  });

  it("treats an empty HTTP MCP auth token as disabled", () => {
    expect(
      loadConfig({
        ...baseEnv,
        MCP_AUTH_TOKEN: "   ",
      }).MCP_AUTH_TOKEN,
    ).toBeUndefined();
  });

  it("loads the optional attachment upload root when provided", () => {
    expect(
      loadConfig({
        ...baseEnv,
        TRELLO_ATTACHMENT_UPLOAD_ROOT: "/srv/trello-uploads",
      }),
    ).toEqual(
      expect.objectContaining({
        TRELLO_ATTACHMENT_UPLOAD_ROOT: "/srv/trello-uploads",
      }),
    );
  });

  it("treats an empty attachment upload root as disabled", () => {
    expect(
      loadConfig({
        ...baseEnv,
        TRELLO_ATTACHMENT_UPLOAD_ROOT: "   ",
      }).TRELLO_ATTACHMENT_UPLOAD_ROOT,
    ).toBeUndefined();
  });

  it("rejects relative attachment upload roots", () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        TRELLO_ATTACHMENT_UPLOAD_ROOT: "uploads",
      }),
    ).toThrow();
  });
});
