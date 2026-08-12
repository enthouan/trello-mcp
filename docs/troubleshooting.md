# Troubleshooting

Troubleshoot `trello-mcp` one boundary at a time: process startup, MCP
transport, Trello authentication, Trello resource access, and optional local
file access are separate concerns. A healthy HTTP process does not prove that
its Trello credentials or a particular board permission work.

> **Sanitize before sharing.** Keep real credentials, authorization headers,
> private Trello URLs, member details, unredacted logs, and local paths out of
> issues and commands you plan to share. The examples below use placeholders
> only.

For the supported settings and defaults, see the
[environment table](../README.md#environment).

## First checks

1. **Identify the failing boundary.** Record whether the process exits, the MCP
   client cannot connect, tools are missing, or one tool returns an error.
2. **Confirm the selected transport.** A client-owned child process needs
   `TRANSPORT=stdio`. A long-running service needs `TRANSPORT=http` and an
   endpoint ending in `/mcp`.
3. **Restart after configuration changes.** The server reads its environment at
   startup. Restart the process or container, then reload or restart the MCP
   client as described in [Set up your MCP client](client-setup.md).
4. **Test the narrowest safe operation.** For HTTP, check `/healthz` and
   `/readyz`. In the MCP client, confirm tool discovery before calling the
   read-only `auth_whoami` or `auth_token_info` tool. Do not create Trello data
   merely to test connectivity.
5. **Separate server bearer errors from Trello errors.** A raw HTTP `401` from
   `/mcp` concerns `MCP_AUTH_TOKEN`. A tool error that says Trello
   authentication failed concerns `TRELLO_API_KEY` or `TRELLO_TOKEN`.

When debugging from source, first confirm the supported Node.js major version
and rebuild the compiled entrypoint:

```bash
node --version
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

This repository requires Node.js 24.x. Do not paste package-manager output into
a public issue without reviewing it for private filesystem paths.

## Startup and configuration

### The process reports `invalid configuration`

The startup log includes validation issues for unsupported or missing values.
Check the variable names rather than printing the entire environment:

- `TRELLO_API_KEY` and `TRELLO_TOKEN` are required and cannot be empty.
- `TRANSPORT` must be `stdio` or `http`.
- `PORT` must be an integer from `1` through `65535`.
- Rate-limit and retry settings must be positive integers.
- `TRELLO_ATTACHMENT_UPLOAD_ROOT`, when set, must be an absolute path. Runtime
  file checks happen later, when `card_attachment_upload` is called.
- `LOG_LEVEL` must be one of the levels listed in the
  [environment table](../README.md#environment).

Remove accidental surrounding quotes or whitespace from credentials, restart
the server, and try again. Never share `.env`, `printenv`, `env`, Docker
inspection output, or an MCP client configuration containing real values.

### The compiled entrypoint is missing

If the client reports that `dist/index.js` does not exist, build the repository
from its root:

```bash
corepack pnpm build
```

Then confirm the client uses an absolute path to this repository checkout's
`dist/index.js`. Rebuild after changing branches or pulling source changes.

### The configured port is unavailable

For a direct HTTP process, choose an unused `PORT` and restart it. For Docker
Compose, change `TRELLO_MCP_HOST_PORT`; the container continues to listen on its
fixed internal port `3000`. Make the same host-port change in the client URL and
health commands.

### More logs are needed

Temporarily set `LOG_LEVEL=debug`, reproduce one narrow operation, and then
restore the previous level. Tool logs include fields such as `requestId`,
`toolName`, `durationMs`, and `errorType`, which are useful for correlation.

The logger removes known credential, authorization, URL, path, and query
fields, but review every excerpt before sharing it. Trello resource ids and
other account-specific metadata can still be private.

## stdio

### The client cannot start the server

- Set `TRANSPORT=stdio` in the child-process environment.
- Use absolute paths to both `node` and `dist/index.js` when a desktop app does
  not inherit the same `PATH` as an interactive shell.
- Pass `TRELLO_API_KEY` and `TRELLO_TOKEN` to the child process using the
  client's supported secret or environment mechanism.
- Fully restart the MCP client after changing its configuration.
- Check the client-specific configuration shape in
  [Set up your MCP client](client-setup.md); field names are not interchangeable
  between clients.

In stdio mode, the MCP client owns the process. Do not also start a background
copy and expect the client to attach to it.

### A manual stdio run appears to hang

That can be expected. A stdio server waits for MCP protocol messages on stdin;
it does not present an interactive prompt. Its protocol output uses stdout and
its logs use stderr. Do not add shell output, redirect logs to stdout, or wrap
the command with a script that prints banners to stdout.

Use the MCP client's connection view or MCP Inspector rather than typing into
the process. Follow the sanitized Inspector setup in
[Set up your MCP client](client-setup.md#mcp-inspector-and-manual-clients).

### The server opens an HTTP port instead

The child process did not receive `TRANSPORT=stdio`. Put that value in the MCP
client's server entry, not only in an unrelated terminal session, and restart
the client.

### The client connects but shows no tools

Confirm it launched the current build, then reload the client and request its
tool list again. The expected surface and dated client evidence are documented
in [MCP Client Compatibility](mcp-client-compatibility.md). Some clients group
or hide tools until the server is enabled for the current workspace.

## Streamable HTTP

### Check process health and readiness

These requests do not call Trello:

```bash
curl http://127.0.0.1:3000/healthz
curl http://127.0.0.1:3000/readyz
```

`/healthz` returns `200` with `{"status":"ok"}` while the HTTP process is
serving requests. `/readyz` returns `200` with `status: "ready"` while the
server is accepting work and `503` with `status: "not_ready"` during shutdown.
The readiness response also reports the configured transport.

These endpoints are intentionally outside the optional `/mcp` bearer check.
They prove process state only: they do not validate Trello credentials, test
board visibility, initialize an MCP session, or list tools. They do not exist
when the server runs in stdio mode.

### Opening `/mcp` in a browser does not work

`/mcp` is a Streamable HTTP MCP endpoint, not a web page or standalone health
URL. Use an MCP client configured for Streamable HTTP. A plain browser request
or a `curl` request without the MCP initialization body and protocol headers is
not a valid connection test.

### `/mcp` returns `401 unauthorized`

When the server sets `MCP_AUTH_TOKEN`, every MCP request must include:

```text
Authorization: Bearer replace-with-the-server-shared-secret
```

Configure the client using the exact value set on the server. Do not send the
Trello token in this header: `MCP_AUTH_TOKEN` protects the MCP endpoint and is
separate from `TRELLO_TOKEN`. If bearer checking is intentionally disabled for
a loopback-only deployment, remove the setting on the server and the matching
client header, then restart both sides.

Use HTTPS plus an appropriate network boundary whenever the endpoint is
reachable beyond loopback. A shared bearer secret does not encrypt traffic.

### The server reports that `Mcp-Session-Id` is required

The first request must be an MCP `initialize` request without a session id. The
server creates an in-memory session and the MCP transport returns its
`Mcp-Session-Id`. The client must send that id on subsequent requests.

This error usually means the client sent a tool or notification request before
initializing, failed to retain the returned session id, or is not using a
compatible Streamable HTTP implementation. Reconnect with the client instead
of manufacturing a session header manually.

### The server reports `MCP session not found`

The supplied session id does not identify a current in-memory session. Sessions
are removed when their transport closes and are not preserved across process or
container restarts. Disconnect and reconnect the MCP client so it sends a new
`initialize` request. Reusing a cached session id returns HTTP `404`.

### A local client cannot reach the HTTP service

- Use the exact `/mcp` path, for example `http://127.0.0.1:3000/mcp`.
- Confirm `/healthz` succeeds on the same host and port.
- If Docker publishes a different `TRELLO_MCP_HOST_PORT`, use that host port.
- A cloud-hosted MCP client cannot reach `127.0.0.1` on your computer. Give it
  a deliberately reachable HTTPS deployment instead.
- Check whether the client supports custom authorization headers before
  enabling `MCP_AUTH_TOKEN`; client support varies.

## Docker Compose

### The service does not start

Create the ignored environment file and set the two required credentials:

```bash
cp .env.example .env
docker compose up -d
docker compose ps
docker compose logs --tail=100 trello-mcp
```

The published-image setup uses `docker-compose.yml`. To build the current
source instead, use:

```bash
docker compose -f docker-compose.local.yml up --build
```

The Compose files require `TRELLO_API_KEY` and `TRELLO_TOKEN` during variable
interpolation. An absent or empty value prevents container creation. Review
logs locally and sanitize them before sharing; do not publish `.env` or the
fully resolved Compose configuration.

### The container is unhealthy

Compose checks `http://127.0.0.1:3000/healthz` inside the container. Keep
`TRANSPORT=http` for this service deployment. `TRELLO_MCP_HOST_PORT` changes
only the host-side port, so it does not change the internal health-check URL.

If the process is running but the host cannot connect, confirm the published
mapping in `docker compose ps`. The default mapping is
`127.0.0.1:3000:3000`, which is reachable only from the Docker host. Set
`TRELLO_MCP_HOST_BIND_IP=0.0.0.0` only for deliberate network exposure with
HTTPS and access controls.

### The image does not contain a local change

`docker-compose.yml` pulls `ghcr.io/enthouan/trello-mcp`; it does not build the
checked-out source. Use `docker-compose.local.yml` for source changes. For
reproducible published deployments, set `TRELLO_MCP_IMAGE_TAG` to an exact
`X.Y.Z` release instead of `latest`, then recreate the service.

### Attachment uploads fail in Compose

The repository's current Compose files do not pass
`TRELLO_ATTACHMENT_UPLOAD_ROOT` or mount an upload directory. The path must
exist inside the container, not only on the Docker host. Use the guarded Docker
mount example in [Attachment Uploads](../README.md#attachment-uploads), or add
an explicit read-only bind mount and matching container-side environment value
to a private Compose override.

## Trello API errors and permissions

### Trello API HTTP `401`: authentication failed

This is a tool-call error from Trello, not the optional HTTP MCP bearer check.

- Confirm both credentials are present without quotes or accidental
  whitespace.
- Confirm the token was authorized from the same Trello app/API key that is
  configured as `TRELLO_API_KEY`.
- Restart the process or container after replacing either value.
- If the token was revoked, expired, exposed, or belongs to the wrong member,
  replace it using [Trello API key](trello-api-key.md).
- Once authentication works, call the read-only `auth_whoami` and
  `auth_token_info` tools to confirm the member, expiration, and permissions.

### Trello API HTTP `403`: access denied

The credentials are valid, but the authenticated member or token lacks the
permission required for that operation. Confirm that:

- `auth_whoami` identifies the intended Trello member;
- the member can see the board or Workspace in Trello;
- the token includes the permission needed for the requested read or write;
- the member has the required board or Workspace role, including admin rights
  for admin-only operations.

A member being able to view a board does not imply permission to administer it.
Use a narrower operation or ask the Trello owner to grant the minimum necessary
role rather than broadening access without review.

### Trello API HTTP `404`: resource not found or not visible

Trello can return `404` for an incorrect id and for a resource the configured
member cannot see. Rediscover the resource with a list or search tool, confirm
the board and Workspace membership, and retry with the canonical id returned by
Trello. Do not assume a private board URL copied from another account is visible
to the server's token.

### Trello API HTTP `429`: rate limit exceeded

The server applies a token-bucket limiter before Trello requests and retries a
Trello `429` with bounded exponential backoff. After the configured attempt
limit, the tool reports a rate-limit error.

First reduce the workflow: target one board or list, request only the fields you
need, use available limits and cursors, and avoid repeatedly scanning every
card. Wait before manually repeating a request after retries are exhausted.

At `LOG_LEVEL=debug`, local token-bucket waits are logged as
`trello rate limit wait`. Trello retry events are logged as
`trello request rate limited; retrying`, followed by
`trello request rate limited; retry attempts exhausted` when applicable. Tune
`TRELLO_RATE_LIMIT_CAPACITY`, `TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS`, and the
three `TRELLO_RETRY_*` settings cautiously; increasing capacity can make a broad
workflow reach Trello's server-side limit sooner.

### Trello cannot be reached

`Unable to reach Trello API.` means the network request failed before an HTTP
response was available. Check DNS, outbound HTTPS access, proxy or firewall
rules, and Trello's service status from the machine or container running the
server. Do not use a credential-bearing Trello request URL as a connectivity
test.

## Attachment upload paths

`card_attachment_add_url` attaches a public URL and needs no local upload root.
`card_attachment_upload` reads an existing file from the server's filesystem
and is disabled until `TRELLO_ATTACHMENT_UPLOAD_ROOT` is configured.

### Uploads are disabled

Set `TRELLO_ATTACHMENT_UPLOAD_ROOT` to an absolute, server-readable directory
and restart the process. For stdio, "server" means the machine where the MCP
client launches `trello-mcp`. For HTTP, it means the service host. For Docker,
it means the container filesystem.

### The root does not exist or is not a directory

The root is checked when an upload is requested. It must resolve to an existing
directory that the server process can traverse. Creating the directory on the
Docker host is insufficient unless it is mounted into the container and the
environment value uses the container-side path.

### The file is outside the root or cannot be found

Relative `filePath` values resolve inside the configured root. Absolute paths
are accepted only when they also resolve inside it. The server resolves
symlinks with `realpath`, rejects the root directory itself, rejects other
directories, and rejects a symlink whose target escapes the root.

Confirm that the file exists, is a regular file, and is readable by the server
process. Do not weaken filesystem permissions broadly to make an upload work;
grant access only to the intended upload directory and files.

For a remote service, copy or mount the file into the upload root before asking
the MCP client to call `card_attachment_upload`. The MCP tool receives a
server-side path; it does not transfer local client bytes to the server.

## Prepare a sanitized issue report

Reduce the problem to one transport and one read-only operation where possible.
Then include:

```text
trello-mcp version, image tag, or commit:
Transport: stdio or Streamable HTTP
Deployment: local Node.js, Docker Compose, or other
MCP client and version:
Operating system and Node.js or Docker version:
Expected behavior:
Observed behavior:
HTTP status, MCP error type, or process exit behavior:
Minimal reproduction steps:
Relevant sanitized log lines and requestId:
```

Before sharing, remove or replace:

- `TRELLO_API_KEY`, `TRELLO_TOKEN`, `MCP_AUTH_TOKEN`, and `Authorization` values;
- `.env` contents, raw environment dumps, and complete client configurations;
- full request URLs, query strings, and Trello authorization links;
- private board, list, card, Workspace, attachment, and member names, ids, and
  URLs;
- local usernames, home-directory paths, upload paths, and file names;
- response bodies from `auth_whoami`, `auth_token_info`, or other account reads.

Use placeholders such as `board-id-redacted` and
`https://example.invalid/mcp`. Keep the safe error type, HTTP status,
`toolName`, timing, and a sanitized `requestId` when they help correlate logs.
Do not perform a write operation on a real board solely to create a
reproduction.

For a suspected credential exposure or security vulnerability, do not open a
public issue. Follow the private reporting process in
[SECURITY.md](../SECURITY.md). For ordinary contribution guidance, see
[CONTRIBUTING.md](../CONTRIBUTING.md).
