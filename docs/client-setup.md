# Set up your MCP client

This is the canonical setup guide for connecting MCP clients to `trello-mcp`.
Choose one transport, keep credentials out of source control, and then follow the
client-specific example below. For dated test evidence, see
[MCP Client Compatibility](mcp-client-compatibility.md).

![Transport chooser showing local stdio and service-oriented Streamable HTTP paths](assets/client-setup/transport-chooser.svg)

## Choose a transport

| Choose | When it fits | Where Trello credentials live | Client configuration |
| --- | --- | --- | --- |
| `stdio` | The MCP client and a built clone of this repository are on the same machine. The client should own the server process. | In the environment passed to the local child process. | A command, arguments, and environment variables. |
| Streamable HTTP | The server runs continuously in Docker, behind a reverse proxy, or on another host. Multiple clients may share it. | On the server only. Clients receive the MCP URL and, when enabled, a bearer token. | An `/mcp` URL and optionally an `Authorization` header. |

Use `stdio` for the shortest local path. Use Streamable HTTP when you already run
the server as a service. A cloud client cannot reach `127.0.0.1` on your laptop;
give it a deliberately reachable HTTPS endpoint instead.

For a local-only HTTP deployment, keep Docker bound to `127.0.0.1`. For a remote
deployment, use HTTPS plus reverse-proxy authentication, IP restrictions, or an
equivalent access-control layer. `MCP_AUTH_TOKEN` is a shared-secret check, not a
replacement for transport security.

## Prepare the server and secrets

Create `TRELLO_API_KEY` and `TRELLO_TOKEN` first by following
[Trello API Key](trello-api-key.md). Keep both values out of
source control and public troubleshooting material.

For `stdio`, build the local server before configuring a client:

```bash
corepack enable
corepack prepare pnpm@10.34.1 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

Export Trello credentials in the environment that launches the client:

```bash
export TRELLO_API_KEY=replace-with-your-api-key
export TRELLO_TOKEN=replace-with-your-token
```

For Streamable HTTP, follow the README's
[published Docker setup](../README.md#option-a-run-the-published-docker-image) or
[local Docker build](../README.md#option-b-build-locally-from-source). The
default local endpoint is:

```text
http://127.0.0.1:3000/mcp
```

If the server's ignored `.env` sets `MCP_AUTH_TOKEN`, export the same value under
a client-side name before launching the client:

```bash
export TRELLO_MCP_BEARER_TOKEN=replace-with-the-server-shared-secret
```

The different names make the security boundary explicit:
`MCP_AUTH_TOKEN` is read by the server, while `TRELLO_MCP_BEARER_TOKEN` is read by
the MCP client. Their values must match.

Never commit `.env`, user-level client configuration, or files containing real
credentials. The examples below contain placeholders only. Use a password
manager or operating-system secret facility when your client can populate its
environment that way.

## Claude Desktop

[Claude Desktop's current local-server guidance](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
emphasizes one-click desktop extensions (`.mcpb`). This repository does not yet
ship an MCPB package. Packaging one would be separate work. The current
[MCP local-server walkthrough](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers)
also documents Claude Desktop's manual JSON path; that is the directly tested
`stdio` path today.

Edit the user-local Claude Desktop configuration:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Merge this server into the existing `mcpServers` object. Do not replace other
entries:

```json
{
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
}
```

Use an absolute path to `node` because a desktop app may not inherit your shell's
`PATH`. This plaintext user-local config contains the secrets for the manual
path, so restrict access to it and do not copy it into the repository or a
support ticket.

Fully quit and reopen Claude Desktop after changing the file. A successful
startup initializes the `trello` server and requests `tools/list`. Claude
Desktop does not expose a documented custom bearer-header field for this manual
local path, so this guide does not claim an HTTP bearer-token setup for it.

## Claude Code

Claude Code supports both transports. Save project-scoped entries in `.mcp.json`
at the project root; that format expands `${NAME}` references from the
environment, including values in `env` and `headers`. Choose one of the
following entries and ensure the referenced variables are exported before
starting Claude Code. A project-scoped entry can prompt for workspace trust;
approve it only after reviewing the command, URL, and environment names.

### Claude Code over stdio

```json
{
  "mcpServers": {
    "trello": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "TRELLO_API_KEY": "${TRELLO_API_KEY}",
        "TRELLO_TOKEN": "${TRELLO_TOKEN}"
      }
    }
  }
}
```

### Claude Code over Streamable HTTP

```json
{
  "mcpServers": {
    "trello": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp",
      "headers": {
        "Authorization": "Bearer ${TRELLO_MCP_BEARER_TOKEN}"
      }
    }
  }
}
```

Remove `headers` when the server does not set `MCP_AUTH_TOKEN`. Use
`type: "http"`; a URL without a transport type is not a valid Claude Code
entry.

Run `claude mcp list` to see connection status. In an interactive session, run
`/mcp` to inspect the server and its tools. Start a new session after changing
the configuration if the active session does not reload it.

Reference: [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

## Codex

Codex CLI reads MCP entries from `~/.codex/config.toml`. The examples below were
directly tested in Codex CLI. A trusted project may instead use
`.codex/config.toml`; this repository ignores that local file. Choose one of the
following `trello` tables, not both.

### Codex over stdio

```toml
[mcp_servers.trello]
command = "node"
args = ["/absolute/path/to/trello-mcp/dist/index.js"]
env_vars = ["TRELLO_API_KEY", "TRELLO_TOKEN"]

[mcp_servers.trello.env]
TRANSPORT = "stdio"
```

`env_vars` forwards the already exported credentials without writing their
values into TOML. Launch Codex CLI from the shell that exported them. If Codex
cannot resolve `node`, replace it with an absolute executable path.

### Codex over Streamable HTTP

```toml
[mcp_servers.trello]
url = "http://127.0.0.1:3000/mcp"
bearer_token_env_var = "TRELLO_MCP_BEARER_TOKEN"
```

Omit `bearer_token_env_var` when the HTTP server does not set
`MCP_AUTH_TOKEN`.

Run `codex mcp list` from the CLI or `/mcp` in an interactive session to inspect
the connection. Start a new Codex CLI session after changing the configuration
if the active session does not reload it.

Reference: [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp).

## VS Code

VS Code stores workspace-scoped servers in `.vscode/mcp.json`. For a private
user-level setup, run **MCP: Open User Configuration** from the Command Palette.
The configuration uses a top-level `servers` object. The examples below use
password inputs so secrets are requested and stored without appearing directly
in the JSON file.

### VS Code over stdio

```json
{
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
        "TRELLO_API_KEY": "${input:trello-api-key}",
        "TRELLO_TOKEN": "${input:trello-token}"
      }
    }
  }
}
```

### VS Code over Streamable HTTP

```json
{
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
        "Authorization": "Bearer ${input:trello-mcp-bearer-token}"
      }
    }
  }
}
```

Remove both `headers` and the unused bearer-token input when the server does not
set `MCP_AUTH_TOKEN`. These password-input examples target desktop VS Code.
Current VS Code Agent Host behavior does not forward servers that require
interactive inputs; use environment references or a private `envFile` when
that separate mode must start the server without a prompt.

Run **MCP: List Servers**, select `trello`, and choose **Start**, **Restart**, or
**Show Output**. Review the configuration before accepting VS Code's trust
prompt, then use **Configure Tools** in Chat to confirm that Trello tools are
available.

References:
[VS Code MCP server guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers)
and
[MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).

## OpenCode

OpenCode defines named servers under `mcp.servers`. Older examples that put
server names directly under `mcp`, or that use `enabled`, are stale. OpenCode
connects servers by default and uses `disabled: true` to turn one off.

Choose one of these `opencode.json` configurations. For project scope, save it
as `<project-root>/opencode.json` or `<project-root>/.opencode/opencode.json`.
For global scope, use `~/.config/opencode/opencode.json`. OpenCode also accepts
the corresponding `.jsonc` filenames.

### OpenCode over stdio

```json
{
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
}
```

### OpenCode over Streamable HTTP

```json
{
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
}
```

Remove `headers` when HTTP bearer authentication is disabled.

OpenCode's documentation does not promise hot reload after direct config
edits, so relaunch it and run `opencode2 mcp list` to inspect connection status.
Its default Code Mode groups MCP tools under the normalized server name; set
`codemode: false` only if you deliberately want all MCP tools exposed
individually to the model.

Reference: [OpenCode MCP server documentation](https://opencode.ai/v2/docs/mcp-servers).

## MCP Inspector and manual clients

MCP Inspector is a useful transport-level check before troubleshooting a named
client. Version `2.0.0` requires Node.js `22.19.0` or newer; this project uses
Node.js 24.

Create `.mcp-inspector.local.json` in the repository root. It is ignored by this
repository and keeps credential values out of process arguments. Choose the
entry you need; both are shown so one file can check either transport:

```json
{
  "mcpServers": {
    "trello-stdio": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "TRELLO_API_KEY": "validation-only",
        "TRELLO_TOKEN": "validation-only"
      }
    },
    "trello-http": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp",
      "headers": {
        "Authorization": "Bearer replace-with-the-server-shared-secret"
      }
    }
  }
}
```

The `stdio` values above are intentionally dummy values for startup and
`tools/list`; discovery does not contact Trello. Put real Trello credentials in
this ignored file only when you deliberately plan to call a read-only Trello
tool. For HTTP, replace the bearer placeholder with the server's
`MCP_AUTH_TOKEN`. Remove `headers` when HTTP bearer authentication is disabled.

### Inspect stdio

```bash
npx -y @modelcontextprotocol/inspector@2.0.0 --cli \
  --config .mcp-inspector.local.json \
  --server trello-stdio \
  --method tools/list \
  --format json \
  | jq '.result.tools | length'
```

### Inspect Streamable HTTP

```bash
npx -y @modelcontextprotocol/inspector@2.0.0 --cli \
  --config .mcp-inspector.local.json \
  --server trello-http \
  --method tools/list \
  --format json \
  | jq '.result.tools | length'
```

Both commands print `77` for the tool surface documented by this revision. The
Inspector opens `--config` files read-only. Its `--cli` mode flag must be the
first Inspector argument; `--config`, `--server`, and protocol method flags come
after it as shown.

Reference: [MCP Inspector documentation](https://modelcontextprotocol.io/docs/tools/inspector).

Any other MCP client can use the same transport contract:

- `stdio`: launch `node /absolute/path/to/trello-mcp/dist/index.js` with
  `TRANSPORT=stdio`, `TRELLO_API_KEY`, and `TRELLO_TOKEN` in the child
  environment.
- Streamable HTTP: connect to `/mcp` and, when `MCP_AUTH_TOKEN` is enabled, send
  `Authorization: Bearer <token>` on every request.

Only claim HTTP bearer compatibility when the client can configure that header.

## Verify the connection safely

1. Confirm the client reports the `trello` server as connected.
2. Confirm it discovers the current 77-tool surface. Some clients group tools
   rather than displaying all names at once.
3. With real credentials and an intentional read-only check, call
   `auth_whoami` or `auth_token_info` and inspect only the expected account
   metadata.
4. Do not create or mutate Trello content just to prove setup. Use the
   repository's explicitly gated live validation harness only with a disposable
   board and the opt-in variables documented in the README.

For HTTP startup checks that do not touch Trello:

```bash
curl http://127.0.0.1:3000/healthz
curl http://127.0.0.1:3000/readyz
```

## Troubleshooting

- **The process cannot start:** use absolute paths to `node` and
  `dist/index.js`, then rebuild with `corepack pnpm build`.
- **The client connects but shows no tools:** confirm `TRANSPORT=stdio` for a
  child process or use the exact `/mcp` path for HTTP, then restart or reload the
  client.
- **HTTP returns `401 unauthorized`:** set the client bearer variable to the
  exact value of the server's `MCP_AUTH_TOKEN`, or remove both settings for an
  intentionally unauthenticated loopback-only deployment.
- **The server starts on an HTTP port during a stdio setup:** the client did not
  pass `TRANSPORT=stdio` to the child process.
- **A desktop client cannot find `node`:** GUI apps often have a smaller `PATH`
  than an interactive shell. Use the absolute executable path.
- **A cloud client cannot connect to `127.0.0.1`:** deploy the server at a
  reachable HTTPS address; do not publish an unauthenticated MCP endpoint to the
  internet.
