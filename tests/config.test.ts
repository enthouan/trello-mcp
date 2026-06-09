import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const baseEnv = {
  TRELLO_API_KEY: "key",
  TRELLO_TOKEN: "token",
};

describe("loadConfig", () => {
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
