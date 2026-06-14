# Trello MCP Server

A self-hostable [Model Context Protocol](https://modelcontextprotocol.io/) server that lets MCP-compatible clients work with [Trello](https://trello.com/) cards, lists, labels, attachments, checklists, members, and card activity.

I built this for my own Trello workflows, but it is intentionally self-hostable and reusable. Feel free to adapt it for your own setup, open issues, or send PRs with improvements.

The roadmap is, of course, tracked on Trello, and `trello-mcp` helps keep it up to date: [trello-mcp roadmap](https://trello.com/b/GnKmvuHz/trello-mcp).

## Disclaimer

This is an independent, unofficial open source project. It is not affiliated with, associated with, authorized by, endorsed by, or sponsored by [Trello](https://trello.com/), [Atlassian](https://www.atlassian.com/), or any related company. Trello, Atlassian, and related names, logos, product names, and trademarks belong to their respective owners.

This project exists to make it easier for MCP-compatible LLM clients to interface with Trello through Trello's [public API](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/) and user-provided API credentials.

## Personal Note

I have been using Trello since the early launch-era, pre-Atlassian days, across college, work, and day-to-day life. I have always found ways to integrate it into my workflow in one form or another.

As I have been using AI and LLM tools more often, having a reliable MCP server for Trello became necessary. I have built many small bridge scripts before, but this repository is my first attempt to make the integration clean, reusable, and self-hostable. Other Trello MCP solutions already exist; I built this because I was not fully satisfied with the options I tried, and because I wanted to learn how to build an MCP server from scratch.

Most of this project was built with Codex under my close supervision.

## Features

### Board Discovery

- List boards visible to the authenticated Trello member.
- Read basic board metadata.
- List open, closed, or all lists on a board.
- List open, closed, visible, or all cards on a board.
- List board labels, members, and memberships.
- Create, inspect, update, and delete board labels.
- Create, inspect, rename, archive, unarchive, and move lists between boards.

### Card Workflows

- Read cards by id, short id, or Trello card URL.
- Create cards with title, description, due date, position, members, and labels.
- Update card metadata including title, description, due date, due completion, and archived state.
- Move cards between lists or boards.
- Apply and remove existing labels on cards.
- Permanently delete cards only when explicitly requested.

### Card Context

- List cards in a Trello list.
- List card attachments, inspect individual attachments, add public URL attachments, and upload server-local files from an explicitly configured directory.
- List and create card checklists, and manage checklist items.
- List card members and add or remove members.
- Read card actions and activity history.
- Add, edit, and delete Trello card comments.

### Search Workflows

- Search Trello cards, boards, members, and workspaces by natural language terms.
- Scope search results to specific boards, cards, or workspaces.
- Look up Trello members by name or username before assignment.
- Read member profiles, assigned cards, boards, and workspaces.

### Workspace Discovery

- List Trello workspaces visible to the authenticated member.
- Read workspace metadata, boards, and members.

### Self-Hosted Runtime

- Run with Docker Compose using the published GHCR image.
- Build locally with a separate Compose file.
- Use Streamable HTTP for container deployments.
- Use stdio for local MCP clients that launch the server as a child process.
- Keep stdio logs on stderr so local MCP clients receive protocol-only stdout.
- Expose HTTP health and readiness endpoints.
- Optionally require a bearer token for HTTP MCP endpoint requests.
- Validate config, tool input, and Trello API responses with Zod.
- Redact Trello credentials from logs.
- Run typecheck, lint, build, tests, and coverage in GitHub Actions.

## Quick Start

### 1. Get Trello API Credentials

Trello API keys are created from a Power-Up or integration. Each person running this server should use their own Trello account and token.

1. Visit [Trello Power-Up admin](https://trello.com/power-ups/admin) and create a new Power-Up or integration.
2. Fill in the required form fields. A name like `Trello MCP` is fine. If Trello asks for an iframe connector URL, use `https://localhost`; this server does not use that URL.
3. Open the Power-Up's **API key** tab.
4. Generate an API key if one does not already exist, then copy it.
5. Use the **Token** link near the API key to authorize access for your Trello account.
6. Copy the generated token.

You will use those values as:

```bash
TRELLO_API_KEY=your-api-key
TRELLO_TOKEN=your-token
```

### 2. Choose an Install Path

#### Option A: Run the Published Docker Image

Use this path if you just want to run the server. It pulls the prebuilt image from GHCR and does not build anything locally.

```bash
git clone https://github.com/enthouan/trello-mcp.git
cd trello-mcp
cp .env.example .env
```

Edit `.env` and replace the placeholder values:

```bash
TRELLO_API_KEY=your-api-key
TRELLO_TOKEN=your-token
TRANSPORT=http
LOG_LEVEL=info
# MCP_AUTH_TOKEN=optional-shared-secret
TRELLO_MCP_HOST_BIND_IP=127.0.0.1
TRELLO_MCP_HOST_PORT=3000
TRELLO_MCP_IMAGE_TAG=latest
TRELLO_MCP_NETWORK=trello-mcp_network
```

Start the published image:

```bash
docker compose up -d
```

The default `docker-compose.yml` uses:

```text
ghcr.io/enthouan/trello-mcp:latest
```

Docker Compose values such as image tag, host bind IP, host port, and network name can be overridden with environment variables or the `.env` file. The compose files document their defaults at the top; for example, `TRELLO_MCP_IMAGE_TAG` defaults to the `latest` tag in `docker-compose.yml` (`latest` follows the `main` branch, and release tags such as `0.4` and `0.4.1` are available for versioned deployments), `TRELLO_MCP_HOST_BIND_IP` defaults to `127.0.0.1` for local-only access, `TRELLO_MCP_HOST_PORT` defaults to `3000` and maps that host port to the container's fixed internal `3000` listener, while `TRELLO_MCP_NETWORK` defaults to `trello-mcp_network`. Set `TRELLO_MCP_HOST_BIND_IP=0.0.0.0` only when you intentionally want Docker to publish the service on all host interfaces, such as for LAN access.

Set `MCP_AUTH_TOKEN` to require `Authorization: Bearer <token>` on HTTP MCP requests to `/mcp`. Leave it unset for the default unauthenticated local behavior. Health and readiness endpoints remain unauthenticated for container and reverse-proxy checks.

Published Docker image tags use these conventions:

| Tag | Use case |
| --- | --- |
| `latest` | Follows the current `main` branch build. Use it when you intentionally want the newest main-branch image. |
| `X.Y` | Follows the newest patch release in a minor line, such as `0.4` moving to the image built from the latest `v0.4.Z` tag. |
| `X.Y.Z` | Pins to one exact release, such as `0.4.1`. Use this for the most reproducible deployments. |
| `sha-<commit>` | Pins to one exact commit image from the release workflow. Use this for debugging or audit trails. |

You can also run the published image directly without Compose:

```bash
docker run --rm -p 3000:3000 \
  -e TRELLO_API_KEY=your-api-key \
  -e TRELLO_TOKEN=your-token \
  ghcr.io/enthouan/trello-mcp:latest
```

#### Option B: Build Locally from Source

Use this path if you want to develop the project, test local changes, or build the Docker image yourself.

```bash
git clone https://github.com/enthouan/trello-mcp.git
cd trello-mcp
cp .env.example .env
```

Edit `.env` with your Trello credentials, then build and run locally:

```bash
docker compose -f docker-compose.local.yml up --build
```

This uses `docker-compose.local.yml`, which builds from the local `Dockerfile` and tags the image as `trello-mcp:local`.

For a non-Docker local build:

```bash
corepack pnpm install
corepack pnpm build:clean
```

Then run the compiled server directly:

```bash
TRELLO_API_KEY=your-api-key TRELLO_TOKEN=your-token TRANSPORT=stdio node dist/index.js
```

Treat the token like a password. Do not commit it, paste it in logs, or share it in PRs.

### 3. Connect Your MCP Client

Choose your client below. For stdio examples, replace `/absolute/path/to/trello-mcp` with the path to your local clone and run `corepack pnpm build` first.

#### Claude Code

```bash
claude mcp add-json trello '{"type":"stdio","command":"node","args":["/absolute/path/to/trello-mcp/dist/index.js"],"env":{"TRANSPORT":"stdio","TRELLO_API_KEY":"your-api-key","TRELLO_TOKEN":"your-token"}}'
```

If you are running the Docker/HTTP server:

```bash
claude mcp add --transport http trello http://localhost:3000/mcp
```

If the server sets `MCP_AUTH_TOKEN`, include the bearer header:

```bash
claude mcp add --transport http trello http://localhost:3000/mcp \
  --header "Authorization: Bearer your-shared-secret"
```

#### Codex

If you are running the Docker/HTTP server:

```bash
codex mcp add trello --url http://localhost:3000/mcp
```

If the server sets `MCP_AUTH_TOKEN`, put the same token in your shell and tell
Codex which environment variable to read:

```bash
export TRELLO_MCP_BEARER_TOKEN=your-shared-secret
codex mcp add trello \
  --url http://localhost:3000/mcp \
  --bearer-token-env-var TRELLO_MCP_BEARER_TOKEN
```

If you want Codex to launch the local stdio server:

```bash
codex mcp add trello \
  --env TRANSPORT=stdio \
  --env TRELLO_API_KEY=your-api-key \
  --env TRELLO_TOKEN=your-token \
  -- node /absolute/path/to/trello-mcp/dist/index.js
```

#### OpenCode

Add this to `opencode.json` or your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "trello": {
      "type": "local",
      "command": ["node", "/absolute/path/to/trello-mcp/dist/index.js"],
      "enabled": true,
      "environment": {
        "TRANSPORT": "stdio",
        "TRELLO_API_KEY": "your-api-key",
        "TRELLO_TOKEN": "your-token"
      }
    }
  }
}
```

#### Cursor

Add this to `.cursor/mcp.json` in a project or to `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "trello": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "TRELLO_API_KEY": "your-api-key",
        "TRELLO_TOKEN": "your-token"
      }
    }
  }
}
```

#### Other / Manual

For any MCP client that supports Streamable HTTP, point it to:

```text
http://localhost:3000/mcp
```

If the server sets `MCP_AUTH_TOKEN`, the client must send `Authorization: Bearer <token>` on every MCP request; requests without it receive `401 unauthorized`.

For any MCP client that supports stdio, use this command:

```bash
node /absolute/path/to/trello-mcp/dist/index.js
```

with this environment:

```bash
TRANSPORT=stdio
TRELLO_API_KEY=your-api-key
TRELLO_TOKEN=your-token
```

### 4. Verify

Check the HTTP server:

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
```

If you changed `TRELLO_MCP_HOST_PORT`, replace `3000` with that host port. If you changed `TRELLO_MCP_HOST_BIND_IP` from `127.0.0.1`, use a hostname or IP address that can reach the bound host interface.

Check your Trello credentials:

```bash
curl "https://api.trello.com/1/members/me?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN"
```

If everything is configured correctly, the health endpoints return JSON status responses and Trello returns your member JSON.

## Trello Credentials

This server currently uses Trello API key + token authentication. See Trello's [REST API getting started guide](https://support.atlassian.com/trello/docs/getting-started-with-trello-rest-api/) and [API introduction](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/) for the official credential flow.

Use the read-only `auth_whoami` and `auth_token_info` tools to verify which Trello member the configured credentials authenticate as and to inspect the configured token's owner, expiration, and permissions. These tools are diagnostics only; this server does not implement OAuth redirects, token creation, token refresh, token revocation, or other token lifecycle management.

## MCP Client Setup

### Streamable HTTP

Use this mode when the server runs as a service or container. For Docker Compose, set `TRELLO_MCP_HOST_BIND_IP` to choose the host interface Docker binds to and `TRELLO_MCP_HOST_PORT` to choose the published host port; the container listens internally on the fixed port `3000`.

```bash
TRANSPORT=http
TRELLO_MCP_HOST_BIND_IP=127.0.0.1
TRELLO_MCP_HOST_PORT=3000
```

Start the Compose service, then point an MCP client with Streamable HTTP support to:

```text
http://localhost:3000/mcp
```

If `MCP_AUTH_TOKEN` is set, configure the client to send this header on every MCP request:

```http
Authorization: Bearer your-shared-secret
```

The bearer token is a simple shared-secret guardrail. Use HTTPS and, for public exposure, a reverse proxy authentication layer or equivalent access control; tokens sent over plain HTTP can be observed on the network.

Health endpoints:

```text
http://localhost:3000/healthz
http://localhost:3000/readyz
```

### stdio

Use this mode when an MCP client launches the server process directly.

Build the project:

```bash
corepack pnpm install
corepack pnpm build
```

Then configure your client to run:

```bash
node /absolute/path/to/trello-mcp/dist/index.js
```

with these environment variables:

```bash
TRANSPORT=stdio
TRELLO_API_KEY=your-key
TRELLO_TOKEN=your-token
```

Example MCP config shape:

```json
{
  "mcpServers": {
    "trello": {
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "TRELLO_API_KEY": "your-key",
        "TRELLO_TOKEN": "your-token"
      }
    }
  }
}
```

## Environment

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `TRELLO_API_KEY` | yes | | Trello API key. |
| `TRELLO_TOKEN` | yes | | Trello token for token auth. |
| `MCP_AUTH_TOKEN` | no | | If set, HTTP MCP requests to `/mcp` require `Authorization: Bearer <token>`. Leave unset for no HTTP bearer-token check. |
| `TRELLO_ATTACHMENT_UPLOAD_ROOT` | no | | Absolute server-side directory that enables local file attachment uploads. Leave unset to disable local uploads. |
| `TRANSPORT` | no | `http` | `http` or `stdio`. |
| `PORT` | no | `3000` | HTTP listen port for the Node process. Docker Compose keeps the container listener on `3000` and uses `TRELLO_MCP_HOST_PORT` for the published host port. |
| `LOG_LEVEL` | no | `info` | Pino log level. |
| `TRELLO_MCP_HOST_BIND_IP` | no | `127.0.0.1` | Docker Compose host interface bind address. Keep `127.0.0.1` for local-only access; set `0.0.0.0` to publish on all host interfaces for intentional network/LAN exposure. |
| `TRELLO_MCP_HOST_PORT` | no | `3000` | Docker Compose host port mapped to the container's fixed internal `3000` listener. |
| `TRELLO_MCP_IMAGE_TAG` | no | `latest` | Published image tag; `latest` follows `main`, `X.Y` follows the newest patch in that minor release line, and `X.Y.Z` pins to an exact release. |
| `TRELLO_MCP_NETWORK` | no | `trello-mcp_network` | Docker Compose bridge network name. |

## Live Trello Smoke Tests

Normal tests are mocked and offline. `corepack pnpm test`, `corepack pnpm test:coverage`, and the default CI workflow never require Trello credentials and never contact Trello.

For release validation against real Trello, use the explicit live smoke command:

```bash
TRELLO_LIVE_SMOKE=1 \
TRELLO_LIVE_SMOKE_BOARD_ID=your-disposable-board-id-or-short-link \
TRELLO_API_KEY=your-api-key \
TRELLO_TOKEN=your-token \
corepack pnpm smoke:live
```

You may use `TRELLO_LIVE_SMOKE_BOARD_URL` instead of `TRELLO_LIVE_SMOKE_BOARD_ID`; Trello board URLs are normalized to their short link, then the harness resolves the canonical board id with `board_get` before creating anything. `TRELLO_LIVE_SMOKE_RUN_ID` is optional and is included in temporary artifact names when set.

Safety model:

- The command exits before any Trello request unless `TRELLO_LIVE_SMOKE=1`, Trello credentials, and a smoke board id or URL are all present.
- The configured board should be a disposable board reserved for validation, not an active production board.
- The harness creates uniquely named temporary lists, one card, one label, one checklist, one checklist item, and one comment. It deletes the card and label, archives the temporary lists, and verifies that no open temporary lists, cards, or labels remain.
- Cleanup runs even when an intermediate validation step fails. Cleanup failures are reported and cause the command to fail.
- The harness invokes the existing tool handlers with a real `TrelloClient`, so tool input validation, Trello response validation, retry/rate-limit handling, and credential redaction stay on the normal code path.
- The harness does not log API keys, tokens, credential-bearing URLs, raw environment objects, or raw request data.

The smoke flow validates representative pre-1.0 coverage:

- Auth and discovery: `auth_whoami`, `auth_token_info`, `list_boards`, board reads, lists, cards, labels, members, memberships, and custom-field discovery.
- List and card writes: disposable list creation/rename/archive, card create/read/update/due-date/position/archive/restore/move/delete.
- Checklist and item behavior: checklist creation, item create/list/update/check/delete.
- Labels and members: disposable label create/read/update/apply/remove/delete, plus authenticated-member assignment/removal when that member is visible on the smoke board.
- Card activity: comment create/update/list/delete on the disposable card.

If the live env vars are absent during local validation, record the live smoke run as skipped. The skipped state is explicit: `corepack pnpm smoke:live` fails before contacting Trello and prints the missing variable names. Do not add this command to normal CI unless the job is intentionally secret-backed and opt-in.

### GitHub Actions

The repository includes a `Live Trello Smoke` workflow for PR and release validation. It runs on same-repository pull requests and manual dispatch. Fork pull requests are skipped so Trello credentials are not exposed to untrusted PR code.

Before using it, configure a GitHub Environment named `live-smoke` with these secrets:

| Secret | Description |
| --- | --- |
| `TRELLO_LIVE_SMOKE_API_KEY` | Trello API key for a dedicated smoke-test Trello member. |
| `TRELLO_LIVE_SMOKE_TOKEN` | Trello token for that same member, with write access to the disposable smoke board. |

Use environment required reviewers if the repository has more than one maintainer or if the token can access anything beyond the smoke board. The workflow maps those secrets to `TRELLO_API_KEY` and `TRELLO_TOKEN` only for the `pnpm smoke:live` step. Do not use `pull_request_target` for this workflow.

The default smoke board is the public disposable test board short link `hUaItfNq`. Override it for same-repository PR runs with environment variable `TRELLO_LIVE_SMOKE_BOARD_ID`, or override `board_ref` when running manually from the Actions tab. A public board is acceptable for smoke testing when temporary artifact names and activity history can be visible, but public visibility does not remove the need for Trello credentials because the harness performs writes.

## Usage Examples

Once connected to an MCP client, ask for Trello actions in natural language:

```text
Show me my Trello boards.
Show me the lists on my job scout board.
Show me the cards in my "Today" list.
Create a card called "Review invoices" in the bookkeeping list.
Move this card to Done.
Archive the card about the old onboarding checklist.
Show the recent activity for this card.
Add a comment to this card saying the invoices are ready for review.
Edit this card comment to include the updated invoice total.
Add this public URL as an attachment to the card.
Upload the file invoice.pdf from my Trello upload folder to this card.
Show me the custom fields configured on this board.
Set this card's Priority custom field to the High option.
Clear this card's Estimate custom field.
```

The exact wording depends on your MCP client. The server can discover your boards and board lists first, then use those ids for card workflows.

## Large Trello Responses

Collection tools default to compact Trello reads so MCP clients do not receive unnecessarily large payloads. High-volume card, label, and action reads default to `limit: 50`; Trello caps these collection reads at `1000`.

Use `fields` to request only the properties needed for a workflow. Tools that validate object names, ids, or action types automatically add schema-required fields even when you request a smaller field set. Use `fields: "all"` only for detailed follow-up reads where the larger response is useful.

Use `since` and `before` on card collection and action tools to page through older or newer Trello objects. These cursors accept an ISO-8601 timestamp, a Trello/Mongo id, or `null` where Trello supports it. Action reads also expose zero-based `page` for Trello's action pagination.

Member-returning tools default to compact member fields (`username,fullName,initials,avatarUrl`). Use member field inputs such as `fields`, `memberFields`, or `memberCreatorFields` when a workflow needs additional member profile properties.

## Search

Use `search` when a user gives a natural language term and you need to find matching cards or boards before taking action. It searches cards and boards by default, returns compact fields, and defaults to 10 results per resource type. Add `members` or `organizations` to `modelTypes` when member or workspace result types are useful.

Use `boardIds: "mine"` or specific board ids to narrow card and board search. Use `organizationIds` for workspace ids, plus `cardIds`, `partial`, `cardsPage`, and the per-type limit inputs when a query needs tighter scope or pagination. Use `search_members` for assignee lookup by name or username, especially when scoped by a board or workspace.

## Attachment Uploads

Public URL attachments work without extra setup. Local file uploads are implemented, but they are disabled by default because the MCP client asks the server process to read a file from the server's filesystem.

To enable `card_attachment_upload`, set `TRELLO_ATTACHMENT_UPLOAD_ROOT` to an absolute directory path the server may read. Upload tool `filePath` values can be relative to that directory, or absolute paths that still resolve inside it. The server resolves symlinks with `realpath`, rejects directories, and rejects files outside the configured root before it sends any Trello request.

For local stdio use:

```bash
TRELLO_ATTACHMENT_UPLOAD_ROOT=/Users/you/trello-uploads \
  TRELLO_API_KEY=your-key \
  TRELLO_TOKEN=your-token \
  TRANSPORT=stdio \
  node dist/index.js
```

For Docker, mount the upload directory into the container and set the root to the container path:

```bash
docker run --rm -p 3000:3000 \
  -v "$PWD/trello-uploads:/uploads:ro" \
  -e TRELLO_ATTACHMENT_UPLOAD_ROOT=/uploads \
  -e TRELLO_API_KEY=your-api-key \
  -e TRELLO_TOKEN=your-token \
  ghcr.io/enthouan/trello-mcp:latest
```

MCP clients do not upload bytes directly through this tool; they provide a path that must exist on the server host or inside the container. For remote servers, copy or mount the file into `TRELLO_ATTACHMENT_UPLOAD_ROOT` first.

## Custom Fields

Custom field definitions live on Trello boards, and card values are exposed as card `customFieldItems`. Use `board_custom_fields` to discover board-level field definitions and their ids, `custom_field_options` to list dropdown/list options for a field, and `card_custom_field_items` to inspect values currently set on a card.

The write tool `card_custom_field_set` accepts one custom field at a time with a type-specific input shape:

| Custom field type | Input shape | Notes |
| --- | --- | --- |
| `text` | `{ "type": "text", "text": "Hello" }` | Plain text value. |
| `number` | `{ "type": "number", "number": "42" }` | Trello expects numbers as strings. |
| `date` | `{ "type": "date", "date": "2026-06-03T16:00:00.000Z" }` | Must be an ISO-8601 date/time string. |
| `checkbox` | `{ "type": "checkbox", "checked": true }` | The server sends Trello the string value Trello expects. |
| `list` | `{ "type": "list", "optionId": "<custom-field-option-id>" }` | Discover option ids with `board_custom_fields` or `custom_field_options`. |

Use `card_custom_field_clear` to clear an existing card custom field value. Trello clears custom field items with an empty PUT request shape rather than a DELETE request, so clearing is intentionally separate from setting values.

## Tool Catalog

<!-- tools:start -->
| Name | When to use | Key inputs |
| --- | --- | --- |
| `auth_whoami` | Use as a read-only credential diagnostic to confirm which Trello member the configured API key and token authenticate as. | fields |
| `auth_token_info` | Use as a read-only credential diagnostic to inspect the configured Trello token's owner, expiration, and permissions; it does not create, refresh, revoke, or manage tokens. | fields |
| `list_boards` | Use first when the user has not provided a board, list, card id, or Trello URL; returns boards visible to the authenticated Trello member. | filter, fields |
| `board_get` | Use when you need board details, common board preferences, or label names for a known Trello board before listing or summarizing it. | boardId, fields |
| `board_field_get` | Use when you need one specific board field, such as prefs, labelNames, subscribed, name, description, or URL. | boardId, field |
| `board_lists` | Use when you need the lists on a known Trello board so you can find the right list id before listing or creating cards. | boardId, filter, fields |
| `board_cards` | Use when you need cards across all lists on a known Trello board for personal planning, review, or summarization. | boardId, filter, fields, limit, since, before |
| `board_custom_fields` | Use when inspecting custom field definitions on a known Trello board, including dropdown/list options when Trello returns them. | boardId |
| `board_labels` | Use when discovering labels available on a board before creating or updating cards with labels. | boardId, limit, fields |
| `board_members` | Use when you need the members who can access a known Trello board before assigning cards or reviewing collaboration; requires token visibility of private boards. | boardId, fields |
| `board_memberships` | Use when you need board membership records, member roles, or permission context for a known Trello board; use the admins filter when checking board-admin-only operations. | boardId, filter, member, memberFields |
| `list_workspaces` | Use first when the user asks to show Trello workspaces or needs to choose a workspace before drilling into its boards or members. | filter, fields, paidAccount |
| `workspace_get` | Use when you need basic Trello workspace metadata, such as display name, description, URL, website, board ids, or preferences. | workspaceId, fields |
| `workspace_boards` | Use when you need boards in a known Trello workspace so the user can drill into a workspace board. | workspaceId, filter, fields |
| `workspace_members` | Use when you need members in a known Trello workspace before assignment, auditing, or permission review. | workspaceId, filter, fields |
| `member_get` | Use after member search or board member listing to inspect a Trello member profile by id, username, or me before assignment or auditing. | memberId, fields |
| `member_boards` | Use when you need boards associated with a known Trello member by id, username, or me; results are limited to boards visible to the configured token. | memberId, filter, fields |
| `member_cards` | Use when you need cards assigned to a known Trello member by id, username, or me; private board cards require token access to those boards. | memberId, filter, fields, limit, since, before |
| `member_workspaces` | Use when you need Trello workspaces associated with a known member by id, username, or me; workspace visibility and role permissions constrain results. | memberId, filter, fields, paidAccount |
| `list_get` | Use when you need metadata for a known Trello list before creating cards in it or changing it. | listId, fields |
| `list_create` | Use when creating a new Trello list on an existing board. | boardId, name, pos |
| `list_update` | Use when renaming a Trello list, changing its position, or setting its archive state. | listId, name, closed, pos |
| `list_archive` | Use when archiving or unarchiving a Trello list while keeping its cards recoverable. | listId, closed |
| `list_move_to_board` | Use when moving an existing Trello list to another board. | listId, boardId |
| `card_get` | Use when you need the current details of one Trello card by id, short id, or URL before editing or summarizing it. | cardId, fields |
| `card_board` | Use when you need the board relationship for a known Trello card before moving, labeling, or summarizing its context. | cardId, fields |
| `card_list` | Use when you need the current list relationship for a known Trello card before moving or reporting its status. | cardId, fields |
| `card_labels` | Use when listing the labels currently applied to a card, including label ids for add/remove workflows. | cardId |
| `list_cards` | Use when you need cards in a specific Trello list; use limit, since, before, and fields to keep large lists small. | listId, filter, fields, limit, since, before |
| `card_create` | Use when the user asks to create a new Trello card in a known list; accepts title, description, due date, members, and labels. | listId, name, desc, due, pos, memberIds, labelIds |
| `card_update` | Use when changing card metadata such as title, description, due date, due completion, or archive state without moving it. | cardId, name, desc, due, dueComplete, closed |
| `card_due_date_set` | Use when setting, clearing, or marking completion of a card due date without changing other card metadata. Provide at least one of due or dueComplete. | cardId, due, dueComplete |
| `card_position_set` | Use when changing only a card's position within its current list; use card_move when changing lists or boards too. | cardId, pos |
| `card_cover_set` | Use when setting a card cover to an existing attachment id, changing cover display size, or clearing the current attachment cover. | cardId, attachmentId, size, brightness |
| `card_label_create_and_add` | Use when creating a new label on the card's board and applying it to the card in one Trello operation. | cardId, name, color |
| `card_delete` | Use only when the user explicitly asks to permanently delete a Trello card; archive instead for reversible removal. | cardId |
| `card_move` | Use when moving a card to another list, another board, or a different position; this is distinct from general card metadata updates. | cardId, listId, boardId, pos |
| `card_archive` | Use when the user wants to archive or unarchive a card while keeping it recoverable; do not use for permanent deletion. | cardId, closed |
| `card_attachments` | Use when listing files or links attached to a card, optionally narrowed by Trello attachment fields or filter. | cardId, fields, filter |
| `card_attachment_get` | Use when inspecting one existing card attachment by attachment id, including upload metadata when Trello returns it. | cardId, fields, attachmentId |
| `card_attachment_add_url` | Use when attaching an existing public URL to a card; this does not upload local files. | cardId, url, name, setCover |
| `card_attachment_upload` | Use when uploading a server-local file to a card. Requires TRELLO_ATTACHMENT_UPLOAD_ROOT and only reads files inside that directory. | cardId, filePath, name, mimeType, setCover |
| `card_attachment_delete` | Use when removing a specific attachment from a card by attachment id. | cardId, attachmentId |
| `card_checklists` | Use when viewing all checklists and checklist items currently on a card. | cardId |
| `card_checklist_create` | Use when adding a new checklist to an existing card, optionally copied from another checklist. | cardId, name, sourceChecklistId |
| `card_checklist_item_create` | Use when adding a new item to an existing Trello checklist on a card. | checklistId, name, pos, checked, due, dueReminder, memberId |
| `card_checklist_items` | Use when listing the items in one Trello checklist, including complete and incomplete items by default. | checklistId, filter, fields |
| `card_checklist_item_update` | Use when editing a Trello card checklist item text, due date, member assignment, completion state, checklist, or position. | cardId, checkItemId, name, state, checklistId, pos, due, dueReminder, memberId |
| `card_checklist_item_set_checked` | Use when checking or unchecking a Trello card checklist item without changing other item fields. | cardId, checkItemId, checked |
| `card_checklist_item_move` | Use when moving a Trello checklist item to another checklist on the same card or to a different position. | cardId, checkItemId, checklistId, pos |
| `card_checklist_item_delete` | Use when deleting a checklist item from a Trello card checklist. | cardId, checkItemId |
| `card_custom_field_items` | Use when reading all custom field item values currently set on a Trello card. | cardId |
| `card_custom_field_set` | Use when setting or updating one Trello card custom field value. Use type-specific inputs: text, number string, ISO date, checkbox boolean, or list optionId. | cardId, customFieldId, type, text, number, date, checked, optionId |
| `card_custom_field_clear` | Use when clearing one Trello card custom field value; Trello clears custom field items with an empty PUT body shape rather than DELETE. | cardId, customFieldId |
| `card_members` | Use when listing members assigned to a card; requires token access to the card's board. Use fields to keep member output small. | cardId, fields |
| `card_member_add` | Use when assigning a Trello member to a card by member id; requires write access to the card's board and a member who can be assigned to that board. | cardId, memberId |
| `card_member_remove` | Use when unassigning a Trello member from a card by member id; requires write access to the card's board. | cardId, memberId |
| `card_comment_add` | Use when adding a new comment to a Trello card; returns the created comment action. | cardId, text |
| `card_comment_update` | Use when editing the text of an existing Trello card comment by its comment action id. | actionId, text |
| `card_comment_delete` | Use when deleting an existing Trello card comment by its comment action id. | actionId |
| `card_actions` | Use when auditing recent activity or comments for a card; use filter, limit, page, since, before, and fields to page large histories. | cardId, filter, fields, limit, since, before, page, member, memberFields, memberCreator, memberCreatorFields |
| `label_get` | Use when you need the current name, color, or board for a specific Trello label before editing it. | labelId |
| `label_create` | Use when creating a new reusable label on a Trello board before applying it to cards. | boardId, name, color |
| `label_update` | Use when renaming a Trello label or changing its color without changing any card assignments. | labelId, name, color |
| `label_delete` | Use only when the user explicitly asks to permanently delete a board label from Trello. | labelId |
| `card_label_add` | Use when applying an existing Trello label to a card by label id. | cardId, labelId |
| `card_label_remove` | Use when removing an existing Trello label from a card by label id. | cardId, labelId |
| `custom_field_get` | Use when you need one Trello custom field definition by id, including its type and any dropdown/list options Trello returns. | customFieldId |
| `custom_field_options` | Use when listing the available options for a Trello dropdown/list custom field before setting a card list custom field value. | customFieldId |
| `search` | Use when you need to find Trello cards, boards, members, or workspaces by natural language search terms. | query, modelTypes, boardIds, organizationIds, cardIds, cardFields, boardFields, memberFields, organizationFields, cardsLimit, boardsLimit, membersLimit, organizationsLimit, cardsPage, partial, includeCardBoard, includeCardList, includeCardMembers, includeBoardOrganization |
| `search_members` | Use when looking up Trello members by name or username, optionally scoped to a board or workspace; scoped searches require token access to that board or workspace. | query, limit, boardId, organizationId, onlyOrgMembers |
<!-- tools:end -->

Regenerate the catalog with:

```bash
corepack pnpm docs:tools
```

## Architecture

```text
MCP client
  -> stdio or Streamable HTTP transport
  -> MCP server and tool registry
  -> Trello tool handlers
  -> Trello REST client
  -> Trello REST API
```

- `src/index.ts` starts stdio or HTTP transport.
- `src/server.ts` creates the MCP server and registers tools.
- `src/http-auth.ts` enforces the optional `MCP_AUTH_TOKEN` bearer check on HTTP MCP requests.
- `src/trello/auth.ts` defines the read-only `auth_whoami` and `auth_token_info` credential diagnostics.
- `src/trello/client.ts` owns Trello HTTP requests, auth query parameters, retries, and response parsing.
- `src/trello/boards.ts` defines board discovery and board-level list, card, label, member, and custom field tools.
- `src/trello/workspaces.ts` defines workspace discovery, metadata, board, and member tools.
- `src/trello/members.ts` defines member profile, board, card, and workspace lookup tools.
- `src/trello/lists.ts` defines list create, inspect, update, archive, and move tools.
- `src/trello/cards.ts` defines card tools, including attachment, checklist, member, comment, action, and card custom field item helpers.
- `src/trello/labels.ts` defines label CRUD and card label assignment tools.
- `src/trello/custom-fields.ts` defines custom field definition and option lookup tools.
- `src/trello/search.ts` defines search tools for cards, boards, members, and workspaces.
- `src/trello/fields.ts` defines shared Trello field list validation helpers.
- `src/trello/types.ts` contains Trello response schemas.
- `src/utils/*` contains logging, error mapping, pagination, and tool registration helpers.

## Security Notes

- Trello credentials stay in your environment or MCP client config.
- Logs redact `TRELLO_API_KEY`, `TRELLO_TOKEN`, `MCP_AUTH_TOKEN`, authorization headers, and common key/token fields.
- Trello API requests use HTTPS.
- Set `MCP_AUTH_TOKEN` for a basic shared-secret check on HTTP MCP traffic. This does not replace HTTPS, reverse-proxy authentication, IP allowlists, or careful host binding.
- Local file attachment uploads are disabled unless `TRELLO_ATTACHMENT_UPLOAD_ROOT` is configured; upload paths are restricted to that directory.
- Tests use mocks and injected fetchers instead of live Trello calls.
- Do not publish `.env` files or paste tokens into issues and PRs.

## Development

Install dependencies:

```bash
corepack pnpm install
```

Rebuild the project from scratch:

```bash
corepack pnpm build:clean
```

Run the local checks:

```bash
corepack pnpm verify
```

Run the coverage gate:

```bash
corepack pnpm verify:coverage
```

Run the opt-in live Trello smoke test:

```bash
TRELLO_LIVE_SMOKE=1 \
TRELLO_LIVE_SMOKE_BOARD_ID=your-disposable-board-id-or-short-link \
TRELLO_API_KEY=your-api-key \
TRELLO_TOKEN=your-token \
corepack pnpm smoke:live
```

Run locally in watch mode:

```bash
TRELLO_API_KEY=your-key TRELLO_TOKEN=your-token corepack pnpm dev
```

Build the Docker image locally:

```bash
corepack pnpm docker:build
```

## Codex Cloud Environments

Codex Cloud tasks run a setup script before the agent starts, and can run an optional maintenance script when a cached container resumes on a task branch. Use these repository scripts in the Codex environment settings:

```bash
./scripts/codex/setup.sh
```

```bash
./scripts/codex/maintenance.sh
```

The setup script enables Corepack, activates the pinned pnpm version, installs dependencies with `--frozen-lockfile` when `pnpm-lock.yaml` exists, and runs `pnpm typecheck`. The maintenance script repeats dependency sync and typecheck for cached containers so branch changes do not use stale dependencies.

## Troubleshooting

### The server starts but my MCP client does not show tools

- Confirm the client is using the right transport.
- For stdio, set `TRANSPORT=stdio`.
- For HTTP, point the client to `/mcp`, not `/healthz` or `/readyz`.
- Restart the MCP client after changing its config.

### Trello says the credentials are invalid

- Run the `auth_whoami` and `auth_token_info` tools from your MCP client to confirm the authenticated member and the token's expiration and permissions.
- Re-run the `members/me` curl check from the credential setup section.
- Confirm the token was generated from the same Power-Up/API key.
- Regenerate the token if it was revoked.

### Docker Compose cannot find `.env`

- Copy `.env.example` to `.env`.
- Fill in `TRELLO_API_KEY` and `TRELLO_TOKEN`.
- Keep `.env` uncommitted.

### I hit Trello rate limits

- The client retries `429` responses with backoff.
- Wait a few minutes before retrying large workflows.
- Prefer narrower prompts that touch fewer cards or lists at once.

## Contributing

PRs are welcome. Keep changes focused, add tests for behavior changes, and avoid committing secrets or generated output.

Before opening a PR, run:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
```

## License

MIT License. See [LICENSE](./LICENSE).
