import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/utils/logger.js";

describe("createLogger", () => {
  it("redacts MCP auth tokens and authorization headers", async () => {
    let output = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ LOG_LEVEL: "info" }, stream);

    logger.info(
      {
        MCP_AUTH_TOKEN: "shared-secret",
        env: { MCP_AUTH_TOKEN: "shared-secret" },
        headers: { authorization: "Bearer shared-secret" },
        request: { headers: { Authorization: "Bearer shared-secret" } },
        nested: { authorization: "Bearer shared-secret" },
      },
      "redaction check",
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(output).toContain("redaction check");
    expect(output).not.toContain("shared-secret");
    expect(output).not.toContain("Bearer shared-secret");
  });
});
