export type ClientKey =
  | "codex"
  | "claude-code"
  | "claude-desktop"
  | "vscode"
  | "opencode-v2";

export type ClientIcon = "openai" | "claude" | "vscode" | "opencode";

export interface ClientSetup {
  key: ClientKey;
  icon: ClientIcon;
  label: string;
  description: string;
  configLocation: string;
  configTitle: string;
  language: string;
  code: string;
  reload: string;
  secretNote: string;
  docsLabel: string;
  docsUrl: string;
}

export const VERIFY_PROMPT =
  "Which Trello account is connected? Use auth_whoami and do not change anything.";

export const VERIFY_EXPECTED =
  "Review the proposed call and approve only auth_whoami. It has no required inputs, is read-only, and returns the authenticated Trello member without changing Trello. That account metadata still passes through the MCP client and its configured model.";

export const CLIENT_SETUPS = [
  {
    key: "codex",
    icon: "openai",
    label: "Codex",
    description:
      "Codex reads MCP servers from TOML and can forward already exported credentials without writing their values into the configuration file.",
    configLocation: "Add these tables to ~/.codex/config.toml.",
    configTitle: "~/.codex/config.toml",
    language: "toml",
    code: `[mcp_servers.trello]
command = "node"
args = ["/absolute/path/to/trello-mcp/dist/index.js"]
env_vars = ["TRELLO_API_KEY", "TRELLO_TOKEN"]

[mcp_servers.trello.env]
TRANSPORT = "stdio"`,
    reload:
      "Start a new Codex session, then run codex mcp list or use /mcp to confirm that trello is connected.",
    secretNote:
      "Export TRELLO_API_KEY and TRELLO_TOKEN before launching Codex. env_vars forwards them to the child process without storing their values in TOML.",
    docsLabel: "Codex MCP documentation",
    docsUrl: "https://learn.chatgpt.com/docs/extend/mcp",
  },
  {
    key: "claude-code",
    icon: "claude",
    label: "Claude Code",
    description:
      "Claude Code expands environment-variable references in a project-scoped .mcp.json file, so the shared file can avoid containing the Trello credentials.",
    configLocation:
      "Export TRELLO_MCP_ROOT, TRELLO_API_KEY, and TRELLO_TOKEN, then create .mcp.json at the project root.",
    configTitle: ".mcp.json",
    language: "json",
    code: `{
  "mcpServers": {
    "trello": {
      "type": "stdio",
      "command": "node",
      "args": ["\${TRELLO_MCP_ROOT}/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "TRELLO_API_KEY": "\${TRELLO_API_KEY}",
        "TRELLO_TOKEN": "\${TRELLO_TOKEN}"
      }
    }
  }
}`,
    reload:
      "Start a new Claude Code session, run /mcp, and confirm that trello is connected. claude mcp list also reports connection status.",
    secretNote:
      "The file contains only environment-variable references and can be shared after review. Keep the environment source for both Trello credentials private.",
    docsLabel: "Claude Code MCP documentation",
    docsUrl: "https://code.claude.com/docs/en/mcp",
  },
  {
    key: "claude-desktop",
    icon: "claude",
    label: "Claude Desktop",
    description:
      "trello-mcp does not yet ship an MCPB desktop extension, so Claude Desktop launches the locally built server as a developer-defined stdio process.",
    configLocation:
      "Open Settings → Developer → Edit Config and merge this entry into claude_desktop_config.json.",
    configTitle: "claude_desktop_config.json",
    language: "json",
    code: `{
  "mcpServers": {
    "trello": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/trello-mcp/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "TRELLO_API_KEY": "replace-in-this-user-local-file",
        "TRELLO_TOKEN": "replace-in-this-user-local-file"
      }
    }
  }
}`,
    reload:
      "Fully quit and reopen Claude Desktop, then inspect Connectors or Developer settings for the trello server and its tools.",
    secretNote:
      "This user-local file contains both Trello credentials in plaintext. Restrict access to it and never copy it into the repository or a support request.",
    docsLabel: "MCP local-server guide",
    docsUrl:
      "https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers",
  },
  {
    key: "vscode",
    icon: "vscode",
    label: "VS Code",
    description:
      "VS Code password inputs can request both Trello credentials when the server first starts without placing their values directly in mcp.json.",
    configLocation:
      "Run MCP: Open User Configuration from the Command Palette and merge these inputs and server entries.",
    configTitle: "User profile mcp.json",
    language: "json",
    code: `{
  "inputs": [
    {
      "type": "promptString",
      "id": "trello-api-key",
      "description": "Trello API key",
      "password": true
    },
    {
      "type": "promptString",
      "id": "trello-token",
      "description": "Trello token",
      "password": true
    }
  ],
  "servers": {
    "trello": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "TRELLO_API_KEY": "\${input:trello-api-key}",
        "TRELLO_TOKEN": "\${input:trello-token}"
      }
    }
  }
}`,
    reload:
      "Run MCP: List Servers, select trello, and start or restart it. Review the configuration before accepting VS Code's trust prompt.",
    secretNote:
      "Password inputs keep both credential values out of mcp.json. These inputs target desktop VS Code; use private environment values for Agent Host portability.",
    docsLabel: "VS Code MCP configuration reference",
    docsUrl:
      "https://code.visualstudio.com/docs/agents/reference/mcp-configuration",
  },
  {
    key: "opencode-v2",
    icon: "opencode",
    label: "OpenCode",
    description:
      "OpenCode V2 defines local servers under mcp.servers and can read Trello credentials from the environment instead of a tracked project file.",
    configLocation:
      "Save this as opencode.json in the project or ~/.config/opencode/opencode.json for global use.",
    configTitle: "opencode.json",
    language: "json",
    code: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "trello": {
        "type": "local",
        "command": [
          "node",
          "/absolute/path/to/trello-mcp/dist/index.js"
        ],
        "environment": {
          "TRANSPORT": "stdio",
          "TRELLO_API_KEY": "{env:TRELLO_API_KEY}",
          "TRELLO_TOKEN": "{env:TRELLO_TOKEN}"
        }
      }
    }
  }
}`,
    reload:
      "Relaunch OpenCode and run opencode2 mcp list. OpenCode V2 does not currently promise hot reload after direct configuration edits.",
    secretNote:
      "Keep the environment that supplies TRELLO_API_KEY and TRELLO_TOKEN private. This recipe was documentation-reviewed and syntax-checked, not directly run.",
    docsLabel: "OpenCode V2 MCP documentation",
    docsUrl: "https://opencode.ai/v2/docs/mcp-servers",
  },
] as const satisfies readonly ClientSetup[];
