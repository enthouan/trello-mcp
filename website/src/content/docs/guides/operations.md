---
title: "Operate trello-mcp"
description: "Upgrade, roll back, inspect, stop, and rotate credentials for a running trello-mcp deployment."
---

Use this guide for routine inspection, exact-version upgrades, rollback,
credential rotation, and shutdown after `trello-mcp` is already connected. The
commands assume the published-image Docker Compose path from the
[published-image quick start](/getting-started/). For a local image, add
`-f docker-compose.local.yml` to the relevant Compose commands.

> **Keep operational output private.** Do not post `.env`, resolved Compose
> configuration, authorization headers, raw MCP traffic, private Trello data,
> or unredacted logs. The commands below avoid printing configured credentials,
> but logs and resource identities can still contain private information.

## Before a change

1. Record the running image and the exact tag configured in your private
   deployment settings:

   ```bash
   docker compose images trello-mcp
   ```

   Do not use `docker compose config` as a diagnostic export: its resolved
   output can include secrets. For reproducible upgrades and rollback, set
   `TRELLO_MCP_IMAGE_TAG` to an available exact `X.Y.Z` release rather than
   `latest` or the moving `X.Y` tag.
2. Read the target release notes and check for configuration, transport, or
   client-compatibility changes.
3. Confirm that you still have the previous exact image tag and access to the
   operator-managed secret store, Compose overrides, reverse-proxy settings,
   and attachment staging directory, if used. The server itself has no
   database to back up.
4. Plan for clients to reconnect. Streamable HTTP session IDs live only in the
   running process and are invalid after a restart.

## Inspect a running service

Start with process and container state:

```bash
docker compose ps
docker compose logs --tail=100 trello-mcp
```

Follow new logs only while reproducing one narrow operation:

```bash
docker compose logs --tail=100 --follow trello-mcp
```

Review excerpts before sharing them. The logger redacts known credential and
request-location fields, but Trello resource IDs and other account-specific
metadata can still be private.

For Streamable HTTP, check both unauthenticated status endpoints on the host
address and port you published:

```bash
curl http://127.0.0.1:3000/healthz
curl http://127.0.0.1:3000/readyz
```

`/healthz` proves that the HTTP process is serving requests. `/readyz` proves
that it is accepting work. Neither endpoint validates Trello credentials,
initializes MCP, or lists tools. After connecting through an MCP client, run the
read-only `auth_whoami` tool to confirm the expected Trello member, then
`auth_token_info` to inspect the token owner, expiration, and permissions.

See [Troubleshooting](/guides/troubleshooting/) when one of those boundaries fails.

## Upgrade the published image

1. Set `TRELLO_MCP_IMAGE_TAG` in the deployment's ignored `.env` or secret
   source to the target exact `X.Y.Z` release.
2. Pull that image and recreate the service:

   ```bash
   docker compose pull trello-mcp
   docker compose up -d --wait --wait-timeout 120
   ```

3. Inspect `docker compose ps`, then check `/healthz` and `/readyz`.
4. Reconnect each MCP client so it initializes a new HTTP session and discovers
   the current tool list.
5. Run `auth_whoami` and `auth_token_info` before a write. Confirm the expected
   member, token permissions, and expiration without creating Trello data.

The Compose update sends the container a termination signal. `trello-mcp`
stops accepting new work, waits for in-flight HTTP work, closes its MCP
sessions, and exits. A client whose request was interrupted should inspect the
target in Trello before retrying; the server does not provide a cross-tool
transaction or automatic rollback.

## Roll back

Rollback changes the server version, not Trello mutations that already
succeeded.

1. Restore the previously recorded exact `X.Y.Z` value of
   `TRELLO_MCP_IMAGE_TAG`.
2. Pull and recreate that version:

   ```bash
   docker compose pull trello-mcp
   docker compose up -d --wait --wait-timeout 120
   ```

3. Repeat the health, readiness, client reconnection, and read-only
   authentication checks from the upgrade procedure.

Do not roll back by changing to `latest`: it follows the current `main` image
and is not a record of the previous deployment. If a newer release made a
Trello change through a tool call, restore or reverse that data explicitly in
Trello where possible.

## Rotate credentials

The Trello credentials and optional HTTP bearer token protect different
boundaries. Rotate them independently and restart the server after changing its
environment.

### Rotate a Trello token or API key

For a planned token rotation:

1. Use [Trello API key](/getting-started/trello-api-key/) to authorize a replacement token for
   the intended Trello member. If the app API key itself is being replaced,
   create a token from that replacement key and update both values together.
2. Replace `TRELLO_TOKEN`, and `TRELLO_API_KEY` when applicable, in the private
   server secret source.
3. Recreate the service so the process reads the new environment:

   ```bash
   docker compose up -d --force-recreate --wait --wait-timeout 120
   ```

4. Reconnect the MCP client. Run `auth_whoami` and `auth_token_info` to verify
   the member and access represented by the replacement.
5. Revoke the superseded Trello authorization after the replacement succeeds.

If a token may be exposed, revoke it immediately and accept the service
interruption instead of keeping it active for a staged handoff. Never print
the environment or include a credential in an inspection command.

### Rotate `MCP_AUTH_TOKEN`

`MCP_AUTH_TOKEN` protects only Streamable HTTP requests to `/mcp`; it is not
sent to Trello and has no effect on stdio.

1. Generate a new strong value in your password manager or secrets system.
2. Replace `MCP_AUTH_TOKEN` on the server and the corresponding bearer secret in
   every authorized HTTP client.
3. Recreate the service:

   ```bash
   docker compose up -d --force-recreate --wait --wait-timeout 120
   ```

4. Restart or reconnect clients and confirm tool discovery. Requests carrying
   the old bearer value should now receive `401 unauthorized`.

Keep HTTPS and the deployment's network boundary in place. Rotating this shared
secret does not encrypt traffic, create per-client identities, or narrow the
permissions of the configured Trello member.

## Stop or remove the service

Stop the container while preserving its Compose resources:

```bash
docker compose stop trello-mcp
```

Stop and remove every service container and the network in this Compose
project:

```bash
docker compose down
```

The checked-in project contains only `trello-mcp`, but `docker compose down`
also removes sidecars added through private overrides. Stop only the named
service when other project services must keep running. Do not add `-v` as a
routine shutdown step: operators may add their own volumes in private
overrides. `docker compose down` does not remove the image, ignored `.env`,
external secret store, or files in an operator-managed attachment directory.
Remove those separately only after resolving their exact location and retention
requirements.

For stdio, the MCP client owns the child process. Fully quit or disable the
client's server entry instead of starting and stopping a second background
copy. For a direct HTTP process, use the service manager that launched it and
allow `SIGTERM` to complete rather than force-killing it during active work.

## State, backup, and retention

`trello-mcp` is stateless with respect to persistent Trello data:

- Trello remains the source of truth for boards, cards, lists, comments,
  checklists, attachments, and other resources.
- Streamable HTTP sessions are process-local and disappear on restart. They are
  connection state, not data to restore; clients must initialize again.
- The server has no application database, schema migrations, or built-in
  backup and restore procedure.
- Back up operator-owned deployment material according to your own policy:
  secret-manager records, Compose overrides, reverse-proxy configuration,
  firewall rules, and release/tag records. Store secret backups encrypted and
  access-controlled.
- `TRELLO_ATTACHMENT_UPLOAD_ROOT` is an operator-managed staging directory, not
  a server data store. The server reads a requested file but does not manage its
  lifecycle. Back up files only when your workflow requires it, and remove
  sensitive staging files according to your retention policy.
- Logs are owned by the process manager, container runtime, or logging service.
  Set retention and access controls there, and sanitize any export.

Back up Trello content using Trello's supported account or Workspace features
when required. Copying the `trello-mcp` container does not back up Trello.

## Upgrade a source or stdio installation

Use a clean checkout and an exact release tag when reproducibility matters.
Replace `vX.Y.Z` below with the target tag:

```bash
git fetch --tags
git switch --detach vX.Y.Z
corepack enable
corepack prepare pnpm@10.34.1 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm build:clean
```

Do not switch a checkout with uncommitted work merely to upgrade a running
service; use a separate clean checkout or container deployment instead.

For stdio, fully restart the MCP client so it launches the rebuilt
`dist/index.js`, then confirm tool discovery and run `auth_whoami`. For a direct
HTTP process, restart it through its service manager, check `/healthz` and
`/readyz`, and reconnect clients. If the update fails, return the clean checkout
to the previously recorded exact tag, rebuild, and repeat those checks.
