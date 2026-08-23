import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const metadataUrl = new URL(
  "../servers/trello-mcp/server.yaml",
  import.meta.url,
);

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a YAML mapping.`);
  }
  return value as Record<string, unknown>;
}

function nestedKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(nestedKeys);
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, entry]) => [
    key,
    ...nestedKeys(entry),
  ]);
}

async function metadata(): Promise<{
  parsed: Record<string, unknown>;
  source: string;
}> {
  const source = await readFile(metadataUrl, "utf8");
  return { parsed: record(parse(source), "server.yaml"), source };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Docker MCP Registry metadata", () => {
  it("matches the Trello registry identity and source contract", async () => {
    const { parsed } = await metadata();
    const directory = basename(dirname(fileURLToPath(metadataUrl)));
    const meta = record(parsed.meta, "meta");
    const about = record(parsed.about, "about");
    const source = record(parsed.source, "source");

    expect(parsed.name).toBe(directory);
    expect(parsed).toMatchObject({
      name: "trello-mcp",
      image: "mcp/trello-mcp",
      type: "server",
    });
    expect(meta).toEqual({
      category: "productivity",
      tags: ["trello", "productivity", "project-management"],
    });
    expect(about.title).toBe("Trello");
    expect(String(about.description)).toMatch(
      /board.*list.*card.*workspace.*independent community integration/i,
    );

    const icon = new URL(String(about.icon));
    expect(icon.protocol).toBe("https:");
    expect(icon.href).toBe("https://trello-mcp.com/favicon.svg");
    expect(source).toEqual({
      project: "https://github.com/enthouan/trello-mcp",
      commit: "06b5b3a6151be516bb92f746dad06b797c1f2bf1",
      dockerfile: "Dockerfile",
    });
    expect(source.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("fixes stdio runtime behavior and the sole outbound host", async () => {
    const { parsed } = await metadata();

    expect(record(parsed.run, "run")).toEqual({
      env: {
        TRANSPORT: "stdio",
        LOG_LEVEL: "info",
      },
      allowHosts: ["api.trello.com:443"],
    });
  });

  it("declares only the two required synthetic Trello secrets", async () => {
    const { parsed } = await metadata();
    const config = record(parsed.config, "config");

    expect(config.secrets).toEqual([
      {
        name: "trello-mcp.api_key",
        env: "TRELLO_API_KEY",
        example: "<YOUR_TRELLO_API_KEY>",
        required: true,
      },
      {
        name: "trello-mcp.token",
        env: "TRELLO_TOKEN",
        example: "<YOUR_TRELLO_TOKEN>",
        required: true,
      },
    ]);

    for (const secret of config.secrets as Record<string, unknown>[]) {
      expect(secret.example).toMatch(/^<YOUR_[A-Z_]+>$/);
      expect(secret.example).not.toMatch(/[0-9a-f]{32,}/i);
    }
  });

  it("excludes deferred configuration and stays environment-independent", async () => {
    vi.stubEnv("TRELLO_API_KEY", "environment-api-key-sentinel");
    vi.stubEnv("TRELLO_TOKEN", "environment-token-sentinel");
    const first = await metadata();

    vi.stubEnv("TRELLO_API_KEY", "different-api-key-sentinel");
    vi.stubEnv("TRELLO_TOKEN", "different-token-sentinel");
    const second = await metadata();

    expect(second).toEqual(first);
    expect(first.source).not.toMatch(
      /environment-(?:api-key|token)-sentinel|different-(?:api-key|token)-sentinel/,
    );
    expect(first.source).not.toContain("process.env");
    expect(first.source).not.toContain("${");

    const run = record(first.parsed.run, "run");
    const config = record(first.parsed.config, "config");
    expect(run).not.toHaveProperty("command");
    expect(run).not.toHaveProperty("volumes");
    expect(config).not.toHaveProperty("env");
    expect(config).not.toHaveProperty("parameters");

    const keys = nestedKeys(first.parsed);
    for (const excluded of [
      "PORT",
      "MCP_AUTH_TOKEN",
      "TRELLO_ATTACHMENT_UPLOAD_ROOT",
      "TRELLO_RATE_LIMIT_CAPACITY",
      "TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS",
      "TRELLO_RETRY_MAX_ATTEMPTS",
      "TRELLO_RETRY_BASE_DELAY_MS",
      "TRELLO_RETRY_MAX_DELAY_MS",
    ]) {
      expect(keys).not.toContain(excluded);
    }
  });
});
