# MCP Client Compatibility

This page records MCP client compatibility evidence for `trello-mcp`. It is a public validation record, not a promise that every listed client has been fully exercised on every release.

Last updated: 2026-06-23.

## Validation Scope

The compatibility target is:

- Server startup over `stdio` and Streamable HTTP.
- MCP tool discovery.
- `auth_whoami` or another credential diagnostic.
- Board discovery.
- List discovery.
- Card read.
- Safe disposable card mutation.
- Cleanup verification for any temporary Trello artifacts.

Do not treat a client as live-validated unless the row says those Trello workflows were exercised in that client. Client setup can be reviewed without live Trello validation, but the matrix keeps those states separate.

## Current Validation Record

| Client | Date | Client/version | Transport path | Setup/config entry point | Tool discovery | Trello workflow validation | HTTP bearer-token support | Restart/reload caveats | Evidence or skipped/blocker note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Desktop | 2026-06-23 | Claude Desktop `1.14271.0` on macOS | `stdio` reviewed | Claude Desktop MCP server config, using `node /absolute/path/to/trello-mcp/dist/index.js` with `TRANSPORT=stdio` and Trello env vars | Not exercised directly in Claude Desktop in this session | Not validated in Claude Desktop | Not validated for Claude Desktop in this session | Restart Claude Desktop after config changes | App version was available locally, but this session did not modify the user's Claude Desktop config or run live Trello credentials. |
| Claude Code | 2026-06-23 | Claude Code `2.1.153` | `stdio` and Streamable HTTP reviewed | `claude mcp add-json` for `stdio`; `claude mcp add --transport http` for HTTP | Not exercised directly in Claude Code in this session | Not validated in Claude Code | Reviewed CLI setup supports adding an `Authorization: Bearer ...` header for HTTP | Restart or reload the Claude Code session after changing MCP config | CLI version was available locally. Direct client config was not changed; manual SDK validation below covered the server transports. |
| Codex | 2026-06-23 | Codex CLI `0.140.0` via Homebrew; Codex app bundled CLI `0.142.0`; local asdf shim was misconfigured | `stdio` and Streamable HTTP reviewed | `codex mcp add` for HTTP or a local `node dist/index.js` command with env vars for `stdio` | Not exercised directly in Codex in this session | Not validated in Codex | Reviewed setup supports `--bearer-token-env-var` for HTTP bearer auth | Restart the Codex session after changing MCP config | Direct binaries reported versions, but the default `codex` shim failed because no asdf version was configured for that shim in this checkout. |
| OpenCode | 2026-06-23 | Not installed locally; OpenCode docs reviewed on 2026-06-23 | `stdio` through local MCP config; Streamable HTTP through remote MCP config | `opencode.json` `mcp` entries with `type: "local"` or `type: "remote"` | Not exercised; OpenCode was not installed locally | Not validated in OpenCode | Reviewed OpenCode remote MCP config supports request `headers`, including `Authorization` | Restart or reload OpenCode after changing config | Local `opencode` binary was missing. Official docs were reviewed for local/remote MCP config shape, but no OpenCode runtime validation was performed. |
| Cursor | 2026-06-23 | Not installed locally | `stdio` reviewed from project setup docs | `.cursor/mcp.json` in a project or `~/.cursor/mcp.json` globally | Not exercised; Cursor was not installed locally | Not validated in Cursor | Not validated in Cursor in this session | Restart or reload Cursor after changing MCP config | Cursor was not present in `/Applications`, `~/Applications`, or the local shell path, so client validation was skipped. |
| Manual MCP SDK client | 2026-06-23 | `@modelcontextprotocol/sdk` `1.29.0` | `stdio` and Streamable HTTP tested | Temporary SDK client using `StdioClientTransport` and `StreamableHTTPClientTransport` against the built server | Passed: `tools/list` returned 77 tools on both transports | Not live-validated because Trello live env vars were not set | Passed for server behavior: unauthenticated HTTP `/mcp` returned `401`; authorized SDK discovery succeeded with `Authorization: Bearer ...` | No client restart required; restart server process after env/config changes | Used dummy Trello env values only. No Trello API calls were made because discovery does not invoke Trello tools. |

## Manual Transport Evidence

Manual SDK validation was run against the built server with dummy Trello credentials:

- `stdio`: initialized `node dist/index.js` with `TRANSPORT=stdio`; `tools/list` returned 77 tools, starting with `auth_whoami`, `auth_token_info`, `list_boards`, and `board_create`.
- Streamable HTTP: started the server with `TRANSPORT=http`, `MCP_AUTH_TOKEN` set, and dummy Trello credentials; `tools/list` with a bearer header returned 77 tools.
- HTTP auth negative check: a POST to `/mcp` without the bearer header returned `401`.

This evidence validates server startup and tool discovery for the two supported transports. It does not prove that each named MCP client loads the config correctly.

## Live Trello Workflow Evidence

No live Trello workflow was run during the 2026-06-23 compatibility pass because the required local opt-in variables were unavailable:

- `TRELLO_LIVE_SMOKE=1`
- `TRELLO_API_KEY`
- `TRELLO_TOKEN`
- `TRELLO_LIVE_SMOKE_BOARD_ID` or `TRELLO_LIVE_SMOKE_BOARD_URL`

Running `corepack pnpm smoke:live` exited before contacting Trello and reported the missing variables. This is the expected safe skip state.

When live credentials and a disposable board are available, use:

```bash
TRELLO_LIVE_SMOKE=1 \
TRELLO_LIVE_SMOKE_BOARD_ID=<disposable-board-id-or-short-link> \
TRELLO_API_KEY=<trello-api-key> \
TRELLO_TOKEN=<trello-token> \
corepack pnpm smoke:live
```

The live smoke harness exercises authentication, board discovery, list discovery, card reads, safe disposable card mutation, and cleanup verification through the registered tool handlers.

## Client Setup References

The README keeps concise setup examples for Claude Code, Codex, OpenCode, Cursor, and generic/manual clients. For named-client examples, see [Connect Your MCP Client](../README.md#3-connect-your-mcp-client). For generic transport details, see [MCP Client Setup](../README.md#mcp-client-setup).

OpenCode's public documentation also describes local and remote MCP server entries in `opencode.json`, including remote request headers for bearer-token style authentication: [OpenCode MCP servers](https://opencode.ai/docs/mcp-servers).
