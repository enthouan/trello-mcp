export type ClientKey =
  | "codex"
  | "claude-code"
  | "claude-desktop"
  | "vscode"
  | "opencode";

export type ClientIcon = "openai" | "claude" | "vscode" | "opencode";

export type RecipeLanguage = "json" | "shell" | "toml";

export interface ClientHttpSetup {
  configTitle: string;
  language: RecipeLanguage;
  code: string;
}

export interface ClientDocumentation {
  heading: string;
  introduction: string;
  stdioHeading?: string;
  afterStdio: string;
  httpHeading?: string;
  afterHttp?: string;
}

export interface ClientSetup {
  key: ClientKey;
  icon: ClientIcon;
  label: string;
  description: string;
  configLocation: string;
  configTitle: string;
  language: RecipeLanguage;
  code: string;
  http?: ClientHttpSetup;
  httpUnavailableNote?: string;
  reload: string;
  secretNote: string;
  docsLabel: string;
  docsUrl: string;
  documentation: ClientDocumentation;
}

export const VERIFY_PROMPT =
  "Which Trello account is connected? Use auth_whoami and do not change anything.";

export const VERIFY_EXPECTED =
  "Review the proposed call and approve only auth_whoami. It has no required inputs, is read-only, and returns the authenticated Trello member without changing Trello. That account metadata still passes through the MCP client and its configured model.";

export const VERIFY_EXAMPLE = `{
  "id": "member-id",
  "username": "your-username",
  "fullName": "Your Name"
}`;

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
    http: {
      configTitle: "~/.codex/config.toml",
      language: "toml",
      code: `[mcp_servers.trello]
url = "http://127.0.0.1:3000/mcp"
bearer_token_env_var = "TRELLO_MCP_BEARER_TOKEN"`,
    },
    reload:
      "Start a new Codex session, then run codex mcp list or use /mcp to confirm that trello is connected.",
    secretNote:
      "Export TRELLO_API_KEY and TRELLO_TOKEN before launching Codex. env_vars forwards them to the child process without storing their values in TOML.",
    docsLabel: "Codex MCP documentation",
    docsUrl: "https://learn.chatgpt.com/docs/extend/mcp",
    documentation: {
      heading: "Codex",
      introduction:
        "Codex CLI reads MCP entries from `~/.codex/config.toml`. The examples below were directly tested in Codex CLI. A trusted project may instead use `.codex/config.toml`; this repository ignores that local file. Choose one of the following `trello` tables, not both.",
      stdioHeading: "Codex over stdio",
      afterStdio:
        "`env_vars` forwards the already exported credentials without writing their values into TOML. Launch Codex CLI from the shell that exported them. If Codex cannot resolve `node`, replace it with an absolute executable path.",
      httpHeading: "Codex over Streamable HTTP",
      afterHttp:
        "Omit `bearer_token_env_var` when the HTTP server does not set `MCP_AUTH_TOKEN`.\n\nRun `codex mcp list` from the CLI or `/mcp` in an interactive session to inspect the connection. Start a new Codex CLI session after changing the configuration if the active session does not reload it.\n\nReference: [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp).",
    },
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
    http: {
      configTitle: ".mcp.json",
      language: "json",
      code: `{
  "mcpServers": {
    "trello": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp",
      "headers": {
        "Authorization": "Bearer \${TRELLO_MCP_BEARER_TOKEN}"
      }
    }
  }
}`,
    },
    reload:
      "Start a new Claude Code session, run /mcp, and confirm that trello is connected. claude mcp list also reports connection status.",
    secretNote:
      "The file contains only environment-variable references and can be shared after review. Keep the environment source for both Trello credentials private.",
    docsLabel: "Claude Code MCP documentation",
    docsUrl: "https://code.claude.com/docs/en/mcp",
    documentation: {
      heading: "Claude Code",
      introduction:
        "Claude Code supports both transports. Save project-scoped entries in `.mcp.json` at the project root; that format expands environment-variable references, including values in `env` and `headers`. For stdio, export `TRELLO_MCP_ROOT=/absolute/path/to/trello-mcp` along with both Trello credentials before starting Claude Code. For HTTP, export the bearer value used by the selected configuration. Choose one entry and review its command, URL, and environment names before approving a project-scoped trust prompt.",
      stdioHeading: "Claude Code over stdio",
      afterStdio: "",
      httpHeading: "Claude Code over Streamable HTTP",
      afterHttp:
        'Remove `headers` when the server does not set `MCP_AUTH_TOKEN`. Use `type: "http"`; a URL without a transport type is not a valid Claude Code entry.\n\nRun `claude mcp list` to see connection status. In an interactive session, run `/mcp` to inspect the server and its tools. Start a new session after changing the configuration if the active session does not reload it.\n\nReference: [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).',
    },
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
    httpUnavailableNote:
      "Claude Desktop does not expose a documented custom bearer-header field for this manual local path, so this guide does not claim an HTTP bearer-token setup for it.",
    reload:
      "Fully quit and reopen Claude Desktop, then inspect Connectors or Developer settings for the trello server and its tools.",
    secretNote:
      "This user-local file contains both Trello credentials in plaintext. Restrict access to it and never copy it into the repository or a support request.",
    docsLabel: "MCP local-server guide",
    docsUrl:
      "https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers",
    documentation: {
      heading: "Claude Desktop",
      introduction:
        "[Claude Desktop's current local-server guidance](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) emphasizes one-click desktop extensions (`.mcpb`). This repository does not yet ship an MCPB package. Packaging one would be separate work. The current [MCP local-server walkthrough](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers) also documents Claude Desktop's manual JSON path; that is the directly tested `stdio` path today.\n\nEdit the user-local Claude Desktop configuration:\n\n- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`\n- Windows: `%APPDATA%\\Claude\\claude_desktop_config.json`\n\nMerge this server into the existing `mcpServers` object. Do not replace other entries:",
      afterStdio:
        "Use an absolute path to `node` because a desktop app may not inherit your shell's `PATH`. This plaintext user-local config contains the secrets for the manual path, so restrict access to it and do not copy it into the repository or a support ticket.\n\nFully quit and reopen Claude Desktop after changing the file. A successful startup initializes the `trello` server and requests `tools/list`. Claude Desktop does not expose a documented custom bearer-header field for this manual local path, so this guide does not claim an HTTP bearer-token setup for it.",
    },
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
    http: {
      configTitle: "User profile mcp.json",
      language: "json",
      code: `{
  "inputs": [
    {
      "type": "promptString",
      "id": "trello-mcp-bearer-token",
      "description": "trello-mcp bearer token",
      "password": true
    }
  ],
  "servers": {
    "trello": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp",
      "headers": {
        "Authorization": "Bearer \${input:trello-mcp-bearer-token}"
      }
    }
  }
}`,
    },
    reload:
      "Run MCP: List Servers, select trello, and start or restart it. Review the configuration before accepting VS Code's trust prompt.",
    secretNote:
      "Password inputs keep both credential values out of mcp.json. These inputs target desktop VS Code; use private environment values for Agent Host portability.",
    docsLabel: "VS Code MCP configuration reference",
    docsUrl:
      "https://code.visualstudio.com/docs/agents/reference/mcp-configuration",
    documentation: {
      heading: "VS Code",
      introduction:
        "VS Code stores workspace-scoped servers in `.vscode/mcp.json`. For a private user-level setup, run **MCP: Open User Configuration** from the Command Palette. The configuration uses a top-level `servers` object. The examples below use password inputs so secrets are requested and stored without appearing directly in the JSON file.",
      stdioHeading: "VS Code over stdio",
      afterStdio: "",
      httpHeading: "VS Code over Streamable HTTP",
      afterHttp:
        "Remove both `headers` and the unused bearer-token input when the server does not set `MCP_AUTH_TOKEN`. These password-input examples target desktop VS Code. Current VS Code Agent Host behavior does not forward servers that require interactive inputs; use environment references or a private `envFile` when that separate mode must start the server without a prompt.\n\nRun **MCP: List Servers**, select `trello`, and choose **Start**, **Restart**, or **Show Output**. Review the configuration before accepting VS Code's trust prompt, then use **Configure Tools** in Chat to confirm that Trello tools are available.\n\nReferences:\n[VS Code MCP server guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers)\nand\n[MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).",
    },
  },
  {
    key: "opencode",
    icon: "opencode",
    label: "OpenCode",
    description:
      "OpenCode defines local servers under mcp.servers and can read Trello credentials from the environment instead of a tracked project file.",
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
    http: {
      configTitle: "opencode.json",
      language: "json",
      code: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "trello": {
        "type": "remote",
        "url": "http://127.0.0.1:3000/mcp",
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {env:TRELLO_MCP_BEARER_TOKEN}"
        }
      }
    }
  }
}`,
    },
    reload:
      "Relaunch OpenCode and run opencode2 mcp list. OpenCode does not currently promise hot reload after direct configuration edits.",
    secretNote:
      "Keep the environment that supplies TRELLO_API_KEY and TRELLO_TOKEN private. This recipe was documentation-reviewed and syntax-checked, not directly run.",
    docsLabel: "OpenCode MCP documentation",
    docsUrl: "https://opencode.ai/v2/docs/mcp-servers",
    documentation: {
      heading: "OpenCode",
      introduction:
        "OpenCode defines named servers under `mcp.servers`. Older examples that put server names directly under `mcp`, or that use `enabled`, are stale. OpenCode connects servers by default and uses `disabled: true` to turn one off.\n\nChoose one of these `opencode.json` configurations. For project scope, save it as `<project-root>/opencode.json` or `<project-root>/.opencode/opencode.json`. For global scope, use `~/.config/opencode/opencode.json`. OpenCode also accepts the corresponding `.jsonc` filenames.",
      stdioHeading: "OpenCode over stdio",
      afterStdio: "",
      httpHeading: "OpenCode over Streamable HTTP",
      afterHttp:
        "Remove `headers` when HTTP bearer authentication is disabled.\n\nOpenCode's documentation does not promise hot reload after direct config edits, so relaunch it and run `opencode2 mcp list` to inspect connection status. Its default Code Mode groups MCP tools under the normalized server name; set `codemode: false` only if you deliberately want all MCP tools exposed individually to the model.\n\nReference: [OpenCode MCP server documentation](https://opencode.ai/v2/docs/mcp-servers).",
    },
  },
] as const satisfies readonly ClientSetup[];

export const CLIENT_DOCUMENTATION_ORDER = [
  "codex",
  "claude-code",
  "claude-desktop",
  "vscode",
  "opencode",
] as const satisfies readonly ClientKey[];

export type InstallMethodKey = "docker" | "http" | "stdio";

export interface InstallMethod {
  key: InstallMethodKey;
  label: string;
  title: string;
  language: RecipeLanguage;
  code: string;
  href: string;
}

export const INSTALL_METHODS = [
  {
    key: "docker",
    label: "HTTP · published image",
    title: "macOS/Linux — published image with Docker Compose",
    language: "shell",
    href: "getting-started/docker/",
    code: `git clone https://github.com/enthouan/trello-mcp.git
cd trello-mcp
cp .env.example .env
# Set both Trello credentials and an available exact X.Y.Z image tag in .env
\${EDITOR:-vi} .env
grep -Eq '^TRELLO_API_KEY=.+$' .env && ! grep -Eq '^TRELLO_API_KEY=replace-me$' .env || { echo 'Set TRELLO_API_KEY to a non-placeholder value in .env before starting.' >&2; exit 1; }
grep -Eq '^TRELLO_TOKEN=.+$' .env && ! grep -Eq '^TRELLO_TOKEN=replace-me$' .env || { echo 'Set TRELLO_TOKEN to a non-placeholder value in .env before starting.' >&2; exit 1; }
grep -Eq '^TRELLO_MCP_IMAGE_TAG=[0-9]+\\.[0-9]+\\.[0-9]+$' .env || { echo 'Set TRELLO_MCP_IMAGE_TAG to an exact published X.Y.Z release before starting.' >&2; exit 1; }
docker compose up -d --wait --wait-timeout 120
docker compose ps
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://127.0.0.1:3000/readyz`,
  },
  {
    key: "http",
    label: "HTTP · source build",
    title: "macOS/Linux — source-built HTTP on Docker loopback",
    language: "shell",
    href: "getting-started/http/",
    code: `git clone https://github.com/enthouan/trello-mcp.git
cd trello-mcp
cp .env.example .env
# Set TRELLO_API_KEY and TRELLO_TOKEN in .env
\${EDITOR:-vi} .env
grep -Eq '^TRELLO_API_KEY=.+$' .env && ! grep -Eq '^TRELLO_API_KEY=replace-me$' .env || { echo 'Set TRELLO_API_KEY to a non-placeholder value in .env before starting.' >&2; exit 1; }
grep -Eq '^TRELLO_TOKEN=.+$' .env && ! grep -Eq '^TRELLO_TOKEN=replace-me$' .env || { echo 'Set TRELLO_TOKEN to a non-placeholder value in .env before starting.' >&2; exit 1; }
docker compose -f docker-compose.local.yml up --build -d --wait --wait-timeout 120
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://127.0.0.1:3000/readyz`,
  },
  {
    key: "stdio",
    label: "Local stdio",
    title: "Cross-platform MCP client process configuration",
    language: "json",
    href: "getting-started/stdio/",
    code: `{
  "mcpServers": {
    "trello": {
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "TRELLO_API_KEY": "replace-with-your-api-key",
        "TRELLO_TOKEN": "replace-with-your-token"
      }
    }
  }
}`,
  },
] as const satisfies readonly InstallMethod[];

export function getClientSetup(key: ClientKey): ClientSetup {
  const client = CLIENT_SETUPS.find((candidate) => candidate.key === key);
  if (!client) throw new Error(`Unknown MCP client recipe: ${key}`);
  return client;
}

export function getInstallMethod(key: InstallMethodKey): InstallMethod {
  const method = INSTALL_METHODS.find((candidate) => candidate.key === key);
  if (!method) throw new Error(`Unknown install method: ${key}`);
  return method;
}
