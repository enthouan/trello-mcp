# MCP Client Compatibility

This page records concrete MCP client evidence for `trello-mcp`. It is a dated
validation record, not a promise that every client has been fully exercised on
every release.

Last updated: 2026-10-08.

## Evidence labels

The table keeps four different claims separate:

- **Official docs reviewed** means the linked vendor documentation was checked
  for the current configuration shape. It does not prove the client was run.
- **Client connected** means that named client completed MCP initialization with
  the built server over the stated transport.
- **Tools discovered** means the client completed `tools/list`; where available,
  the client UI or CLI was also checked for the expected server surface: 77
  canonical runtime tools or the registry profile's intentional 76-tool subset.
- **Live Trello workflow** means a tool completed a successful authenticated
  Trello request. Startup, health checks, initialization, `tools/list`, blocked
  network controls, and rejected unauthenticated probes do not establish one.

No row is promoted from one state to another by inference alone. The VS Code
and OpenCode rows record documentation and syntax review only; neither is
presented as client-run connection evidence.

## 2026-08-07 validation environment

- Host: macOS `26.6` (`25G72`), Apple silicon (`arm64`).
- Runtime: Node.js `24.17.0`, pnpm `10.34.1` through Corepack.
- Server: a clean build of the commit under validation, matching its
  `origin/main` base at the time of validation.
- Tool surface: 77 registered tools.
- Discovery credentials: dummy Trello values. No Trello tool was invoked during
  discovery.
- HTTP auth: an unauthenticated `/mcp` request returned `401`; authenticated
  Streamable HTTP discovery succeeded with the configured bearer header.

## 2026-08-29–30 Docker Toolkit validation environment

- Docker Desktop: `4.88.0` build `237115` for the initial credential-independent
  checks; `4.88.1` build `237512` for the fresh catalog/profile setup and
  preparation for the approved live continuation.
- Docker CLI and Engine: `29.7.2`, API `1.55`.
- Docker MCP Toolkit/Gateway: `v0.43.3`, release commit
  [`8b5d526aef123f49aae07fe95036109c315177b3`](https://github.com/docker/mcp-gateway/tree/8b5d526aef123f49aae07fe95036109c315177b3).
- Registry source: a fresh Docker MCP Registry checkout at
  [`8c773729f13f036da8c909be503fe433923a9aa2`](https://github.com/docker/mcp-registry/tree/8c773729f13f036da8c909be503fe433923a9aa2).
- Repository: validation head
  [`4dce72213740d56ab00ee2b7dea60362431efeb9`](https://github.com/enthouan/trello-mcp/commit/4dce72213740d56ab00ee2b7dea60362431efeb9),
  with the Registry image built from its exact `17679f1` source pin in an
  isolated daemon.
- Gateway runtime image: the preserved host `mcp/trello-mcp` image, whose source
  revision label was the exact `17679f1` pin. The two builds are not claimed to
  have byte or digest identity.
- Transport: stdio through a uniquely named, unconnected temporary OCI catalog
  and Toolkit profile. Discovery used dummy values and made no intended Trello
  call.

## Current validation record

The Docker row and named-client details record the August observations; the
following paragraphs record the current refresh. On 2026-10-08, the
repository validation base was `d7c22c7` (`v1.0.3`) and the upstream Registry
validate/build/catalog checks passed again at `49b643ce`. The installed
environment is now Docker Desktop `4.94.0` build `241994`, CLI/Engine `29.8.2`
with API `1.56`, and Toolkit/Gateway `v0.44.1`. The submission still pins
`17679f1`; the newer transport-aware health check on main is not in that image.
No authenticated Trello request completed during the October pass. See the
[current readiness evidence](https://github.com/enthouan/trello-mcp/blob/main/docs/registry-readiness.md#2026-10-08-refresh-after-rebase).

October discovery also passed through an isolated OCI/profile fixture using
unique dummy secret names and unchanged environment mappings. Gateway
`v0.44.1` returned the same 76 Trello tools plus eight internal helpers;
descriptions, argument names, and requiredness matched the Registry fallback.
It again required the scoped local `--verify-signatures=false` exception.
Five captured stdout messages were valid JSON-RPC; application and Gateway
logs remained on stderr. The pinned image stayed running at 108 seconds
despite four failed HTTP health probes, and discovery plus locally rejected
input-validation calls continued. A separate dummy-only negative fixture with
`example.com:443` and `--block-network` returned `Unable to reach Trello API`;
no unblocked control was run in October.

All October offline/negative fixtures, dummy secrets, captures, checkout, and
run-created containers were removed, including six leftover L7 proxy sidecars.
Profile, catalog, and secret-name inventories matched the October baseline.
The pinned test image is intentionally retained for the pending owner
continuation; the canonical August profile/catalog already existed at that
baseline. Canonical credential UI confirmation, the authenticated positive
call, and final cleanup of that continuation remain pending.

| Client | Official docs reviewed | Installed client and transport | Client connected | Tools discovered | Live Trello workflow | Restart requirement, limitation, or blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Codex CLI | Yes, 2026-08-07: [MCP documentation](https://learn.chatgpt.com/docs/extend/mcp) | Codex CLI `0.146.0`; macOS; `stdio` and Streamable HTTP with bearer auth | Yes on both transports through session-only configuration. | Yes. `/mcp` displayed all 77 tools for each entry. | No. No Trello tool was called. | Session-only configuration left the shared config unchanged. |
| Claude Code | Yes, 2026-08-07: [MCP documentation](https://code.claude.com/docs/en/mcp) | Claude Code `2.1.212`; macOS; `stdio` and Streamable HTTP with bearer auth | Yes on both transports. | Yes. `/mcp` displayed all 77 tools for each temporary entry. | No. No Trello tool was called. | Start a new session if an active one does not reload configuration. Temporary entries were removed and the pre-test config was restored byte for byte. |
| Claude Desktop | Yes, 2026-08-07: [desktop extensions](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) and [manual JSON](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers) | Claude Desktop `1.26832.0`; macOS; `stdio` | Yes. A full app launch initialized the existing user-local `trello` entry and connected to the built server. | Yes. Claude Desktop issued `tools/list` successfully. The exact 77-tool count was corroborated against the same built artifact with Inspector; Claude Desktop's log does not print the result body. | No. No Trello tool was called. | Fully quit and reopen after config changes. Current official guidance emphasizes MCPB desktop extensions, but this repository has no `.mcpb` package; the tested manual `stdio` entry remains the documented path. No HTTP bearer path is claimed. |
| VS Code | Yes, 2026-08-09: [MCP server guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers) and [configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) | Not exercised for this record; current `stdio` and Streamable HTTP configurations reviewed and syntax-checked | Not tested. | Not tested. | No. No Trello tool was called. | Use **MCP: List Servers** to start, restart, and inspect output. The documented password-input recipes target desktop VS Code; Agent Host does not forward servers that require interactive inputs. |
| OpenCode | Yes, 2026-08-07: [MCP servers](https://opencode.ai/v2/docs/mcp-servers) | Not installed; current `stdio` and Streamable HTTP configurations reviewed and syntax-checked | Not tested. | Not tested. | No. | The current configuration requires entries under `mcp.servers`, uses `disabled` rather than `enabled`, and groups MCP tools in Code Mode by default. Relaunch after config edits. |
| MCP Inspector | Yes, 2026-08-07: [Inspector documentation](https://modelcontextprotocol.io/docs/tools/inspector) | `@modelcontextprotocol/inspector` `2.0.0`; Node.js `24.17.0`; `stdio` and Streamable HTTP with bearer auth | Yes on both transports. | Yes. `tools/list` returned exactly 77 tools on both transports. | No. No Trello tool was called. | No restart required. The guide uses an ignored, read-only Inspector config so credentials do not appear in process arguments. `--cli` must be the first Inspector argument. Version 2.0.0 requires Node.js `22.19.0` or newer. |
| Docker MCP Toolkit/Gateway | Yes, 2026-08-29–30: [CLI](https://docs.docker.com/ai/mcp-catalog-and-toolkit/cli/), [catalog](https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/), and [profile](https://docs.docker.com/ai/mcp-catalog-and-toolkit/profiles/) documentation | Docker Desktop `4.88.0` build `237115` initially and `4.88.1` build `237512` for the prepared continuation; Docker CLI/Engine `29.7.2`; Toolkit/Gateway `v0.43.3`; stdio through an isolated OCI catalog and profile | Yes. Gateway completed initialization against the temporary profile without connecting a persistent MCP client. | Yes. Exactly 76 Trello tools were callable and matched the Registry fallback; raw `tools/list` also contained eight Toolkit-internal helpers. | No. Live authorization is recorded, but no authenticated Gateway Trello request has run; secure credential entry and exact disposable-board confirmation remain pending. | Secure defaults rejected the unsigned tag-referenced local image, so only scoped test runs used `--verify-signatures=false`. The tested direct Gateway CLI path required `--block-network` to enforce the host list. Docker reported the long-lived stdio container unhealthy, but Gateway calls continued. Docker Desktop UI confirmation remains pending. The 2026-08-29 targeted cleanup restored the sanitized Toolkit inventory; the fresh 2026-08-30 profile remains active only for the authorized continuation. |

## Named-client test details

### Codex

Codex CLI `0.146.0` was launched with session-only configuration overrides; the
shared `~/.codex/config.toml` was not edited. The `stdio` and bearer-protected
Streamable HTTP entries both initialized, and `/mcp` enumerated all 77 tools for
each one.

### Claude Code

An isolated JSON file copied the guide's project-level shapes, including the
`${...}` environment references, and Claude Code loaded it with
`--strict-mcp-config`. Its two entries targeted the built server:

- `stdio`: Claude Code launched `node dist/index.js` with `TRANSPORT=stdio` and
  dummy Trello values.
- Streamable HTTP: Claude Code connected to `/mcp` and sent the required bearer
  header.

The interactive `/mcp` view enumerated the same 77 tools for each transport.
Separate temporary user entries confirmed that `claude mcp list` also reported
both connections healthy. All temporary files and entries were removed after
validation, and the original user configuration was restored exactly.

### Claude Desktop

The installed app was launched with its existing user-local `stdio`
configuration. Its MCP log recorded successful server startup, initialization,
and `tools/list`. The configured server artifact was byte-identical to the build
enumerated independently as 77 tools. The MCP transport was then closed without
changing its configuration.

The current Claude Desktop documentation centers on installable `.mcpb` desktop
extensions. This repository does not contain an MCPB manifest or package, so a
one-click extension could not be tested without expanding the issue into a new
packaging deliverable. The guide states that limitation plainly and documents
the tested manual `stdio` path.

### VS Code

VS Code was not run for this compatibility record. Microsoft's current MCP
server guide and configuration reference were reviewed on 2026-08-09, and the
guide's `stdio` and Streamable HTTP JSON examples were syntax-checked. The
password inputs, user-profile configuration, trust prompt, server commands, and
Agent Host limitation therefore remain configuration evidence only.

### OpenCode

OpenCode was not installed on the validation host. Its current official
documentation was reviewed, and every JSON example was syntax-checked. Direct
connection and tool-discovery validation were not performed, so this record
makes no client-compatibility claim beyond documentation and syntax review.

### MCP Inspector

Inspector `2.0.0` initialized the built server over both transports. Each
`tools/list --format json` result contained 77 tools. The guide's ignored
`--config` form was tested for both named entries. The HTTP test used a dummy
server bearer token; a separate request without that header returned `401`.

This is direct transport and tool-discovery evidence. It is not evidence that a
Trello workflow ran.

### Docker MCP Toolkit/Gateway

The Registry entry passed upstream validation, built from its exact pinned
source in an isolated daemon, and generated a one-server legacy catalog without
credentials. Toolkit
`v0.43.3` no longer provides the Registry guide's legacy `catalog import/reset`
commands, so the catalog was converted with `docker mcp catalog create
--from-legacy-catalog` and referenced from an isolated profile. No persistent
MCP client configuration was changed.

Gateway used a preserved host image whose OCI source-revision label matched the
exact pin and whose discovered tool metadata matched the pinned source and
fallback. It was not the isolated build artifact, so no byte or image-digest
equivalence is claimed.

The conversion preserved the image, stdio environment, two secret mappings,
and `api.trello.com:443` host metadata, but not the adjacent fallback's tool
list. The profile therefore used an explicit allowlist generated from
`servers/trello-mcp/tools.json`. Gateway discovery then produced this exact
comparison:

- 77 canonical runtime tools.
- 76 Registry fallback tools.
- 76 Toolkit-callable Trello tools, with only `card_attachment_upload` omitted.
- Eight additional Gateway-internal helpers in the raw `tools/list` response.

All 76 Trello names, descriptions, argument names, and requiredness matched the
Registry fallback. Separate stdout and stderr capture showed only valid JSON-RPC
responses on stdout and application/Gateway logs on stderr.

The default signature check rejected the unsigned, tag-referenced local image;
the development-only validation retry used `--verify-signatures=false` without
changing a repository or Toolkit default. In the tested direct Gateway CLI
path, host-list enforcement required `--block-network`: a dummy-credential
negative variant was blocked before successful Trello authentication only when
that flag was set. A control without the flag reached Trello but received
HTTP `401`; this was an unauthenticated network probe, not a successful live
workflow. The exact catalog's positive path remains pending the approved call.

In long-lived mode, Docker marked the stdio container unhealthy after its
HTTP-oriented probes failed, but a subsequent Gateway request completed through
the same running container. This observation did not justify a Dockerfile
change. Direct inspection of the Docker Desktop credential form was blocked by
host UI permissions, so the two fields visible in the catalog/profile CLI
snapshot are not presented as UI evidence.

The 2026-08-29 targeted cleanup removed that pass's temporary profile, OCI
catalog, dummy secrets, trusted catalog copy, captures, checkouts, and
containers. The original catalog, profiles, client connections, secret-name
inventory, and pre-existing Trello image matched the sanitized baseline
afterward. A fresh issue-specific profile, OCI catalog, trusted catalog copy,
and temporary checkout were prepared on 2026-08-30 for the authorized
continuation. The October inventory still found that profile and catalog,
with no saved secret names or Trello containers. Final targeted cleanup of
the continuation remains pending.

## Live Trello workflow status

No authorized live Trello workflow was invoked from any named client during the
2026-08-07 pass or from Docker MCP Gateway during the initial 2026-08-29 pass.
On 2026-08-30, explicit authorization was granted for the minimal read-only
Gateway continuation, but no authenticated Gateway Trello request has run:
secure credential entry and explicit confirmation of the exact disposable
board remain pending.
The repository's live-validation safety gate requires all of the following
before any intentional Trello request:

- `TRELLO_LIVE_SMOKE=1`
- `TRELLO_API_KEY`
- `TRELLO_TOKEN`
- `TRELLO_LIVE_SMOKE_BOARD_ID` or `TRELLO_LIVE_SMOKE_BOARD_URL`

The local named-client pass did not have the explicit live-smoke opt-in plus a
confirmed disposable board. Discovery therefore used dummy values and stopped
at `tools/list`. That is the intended safe behavior, not a successful live
Trello workflow from a named client.

Separately, a secret-backed
[GitHub Actions `Live Trello Smoke` run](https://github.com/enthouan/trello-mcp/actions/runs/31227974590)
passed during the 2026-08-07 PR validation. The repository harness covered
authentication, board/list/card reads, disposable mutations, and cleanup
through the registered tool handlers. This is server-harness evidence only; it
is not attributed to any named client and does not change the `No` entries in
the table's **Live Trello workflow** column.

When a disposable board and explicit opt-in are available, follow the
[live validation instructions](../README.md#live-trello-smoke-tests). Never run
write-side validation against an ordinary board.

## Documentation and visual review

The canonical [Set up your MCP client guide](client-setup.md) contains the sanitized
configurations used by this compatibility record. JSON snippets were checked
with `jq`; Codex TOML entries were loaded by the actual Codex CLI; and the
Inspector commands were executed against the built server.

No client screenshot was committed. The genuine installed-client views also
contained unrelated user configuration and would expose details unrelated to
the sanitized configuration examples. The public documentation uses only
purpose-built diagrams with no credentials, private UI, or machine-specific
paths.
