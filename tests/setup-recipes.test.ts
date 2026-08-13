import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parse as parseToml } from "smol-toml";
import { describe, expect, it } from "vitest";
import {
  CLIENT_DOCUMENTATION_ORDER,
  CLIENT_SETUPS,
  type ClientSetup,
  INSTALL_METHODS,
  VERIFY_EXAMPLE,
} from "../docs/setup-recipes.js";

const clientSetups: readonly ClientSetup[] = CLIENT_SETUPS;

function parseRecipe(language: string, code: string): unknown {
  if (language === "json") return JSON.parse(code);
  if (language === "toml") return parseToml(code);
  throw new Error(`Unsupported configuration language: ${language}`);
}

describe("setup recipe catalog", () => {
  it("keeps stable, unique client keys and documentation anchors", () => {
    expect(clientSetups.map(({ key }) => key)).toEqual([
      "codex",
      "claude-code",
      "claude-desktop",
      "vscode",
      "opencode",
    ]);
    expect(new Set(clientSetups.map(({ key }) => key)).size).toBe(
      clientSetups.length,
    );
    expect(CLIENT_DOCUMENTATION_ORDER).toEqual([
      "codex",
      "claude-code",
      "claude-desktop",
      "vscode",
      "opencode",
    ]);
    expect(
      clientSetups.map(({ documentation }) => documentation.heading),
    ).toEqual([
      "Codex",
      "Claude Code",
      "Claude Desktop",
      "VS Code",
      "OpenCode",
    ]);
  });

  it("parses every client configuration without executing it", () => {
    for (const client of clientSetups) {
      expect(() => parseRecipe(client.language, client.code)).not.toThrow();
      expect(client.code).toContain("stdio");

      const http = client.http;
      if (http) {
        expect(() => parseRecipe(http.language, http.code)).not.toThrow();
        expect(http.code).toContain("http://127.0.0.1:3000/mcp");
        expect(http.code).not.toContain("TRELLO_API_KEY");
        expect(http.code).not.toContain("TRELLO_TOKEN");
        expect(client.httpUnavailableNote).toBeUndefined();
      }
    }
  });

  it("documents Claude Desktop as the only client without an HTTP recipe", () => {
    const withoutHttp = clientSetups.filter(({ http }) => !http);
    expect(withoutHttp.map(({ key }) => key)).toEqual(["claude-desktop"]);
    expect(withoutHttp[0]?.httpUnavailableNote).toContain(
      "does not expose a documented custom bearer-header field",
    );
  });

  it("syntax-checks every install recipe without running its commands", () => {
    for (const method of INSTALL_METHODS) {
      if (method.language === "shell") {
        const result = spawnSync("bash", ["-n"], {
          encoding: "utf8",
          input: method.code,
        });
        expect(result.status, result.stderr).toBe(0);
        expect(method.code).not.toContain("localhost");
        expect(method.code).toContain("127.0.0.1");
      } else {
        expect(() => parseRecipe(method.language, method.code)).not.toThrow();
      }
    }
  });

  it("keeps install method keys and guide links unique", () => {
    expect(INSTALL_METHODS.map(({ key }) => key)).toEqual([
      "docker",
      "http",
      "stdio",
    ]);
    expect(new Set(INSTALL_METHODS.map(({ key }) => key)).size).toBe(
      INSTALL_METHODS.length,
    );
    expect(new Set(INSTALL_METHODS.map(({ href }) => href)).size).toBe(
      INSTALL_METHODS.length,
    );
  });

  it("keeps the verification example parseable and free of credentials", () => {
    expect(JSON.parse(VERIFY_EXAMPLE)).toEqual({
      id: "member-id",
      username: "your-username",
      fullName: "Your Name",
    });
    expect(VERIFY_EXAMPLE).not.toMatch(
      /TRELLO_(?:API_KEY|TOKEN)|MCP_AUTH_TOKEN|authorization/i,
    );
  });

  it("keeps local client configuration and live reports out of commits and Docker contexts", async () => {
    const [gitignore, dockerignore] = await Promise.all([
      readFile(new URL("../.gitignore", import.meta.url), "utf8"),
      readFile(new URL("../.dockerignore", import.meta.url), "utf8"),
    ]);
    const localConfigurationPaths = [
      ".codex/config.toml",
      ".claude/settings.local.json",
      ".mcp.json",
      ".*/mcp.json",
      ".mcp-inspector.local.json",
      "opencode.json",
      "opencode.jsonc",
      ".opencode/opencode.json",
      ".opencode/opencode.jsonc",
    ];

    expect(gitignore.split(/\r?\n/)).toEqual(
      expect.arrayContaining([...localConfigurationPaths, "reports/"]),
    );
    expect(dockerignore.split(/\r?\n/)).toEqual(
      expect.arrayContaining([...localConfigurationPaths, "reports"]),
    );
  });
});
