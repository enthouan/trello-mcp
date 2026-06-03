# Trello MCP Server

A self-hostable Model Context Protocol server that lets MCP-compatible clients work with Trello cards, lists, labels, attachments, checklists, members, and card activity.

I built this for my own Trello workflows, but it is intentionally self-hostable and reusable. Feel free to adapt it for your own setup, open issues, or send PRs with improvements.

The roadmap is, of course, tracked on Trello, and `trello-mcp` helps keep it up to date: [trello-mcp roadmap](https://trello.com/b/GnKmvuHz/trello-mcp).

## Disclaimer

This is an independent, unofficial open source project. It is not affiliated with, associated with, authorized by, endorsed by, or sponsored by Trello, Atlassian, or any related company. Trello, Atlassian, and related names, logos, product names, and trademarks belong to their respective owners.

This project exists to make it easier for MCP-compatible LLM clients to interface with Trello through Trello's public API and user-provided API credentials.

## Personal Note

I have been using Trello since the early launch-era, pre-Atlassian days, across college, work, and day-to-day life. I have always found ways to integrate it into my workflow in one form or another.

As I have been using AI and LLM tools more often, having a reliable MCP server for Trello became necessary. I have built many small bridge scripts before, but this repository is my first attempt to make the integration clean, reusable, and self-hostable. Other Trello MCP solutions already exist; I built this because I was not fully satisfied with the options I tried, and because I wanted to learn how to build an MCP server from scratch.

Most of this project was built with Codex under my close supervision.

## Features

### Board Discovery

- List boards visible to the authenticated Trello member.
- Read basic board metadata.
- List open, closed, or all lists on a board.
- List, create, inspect, update, and delete board labels.
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
- List card attachments and add public URL attachments.
- List and create card checklists, and manage checklist items.
- List card members and add or remove members.
- Read card actions and activity history.
- Add, edit, and delete Trello card comments.

### Self-Hosted Runtime

- Run with Docker Compose using the published GHCR image.
- Build locally with a separate Compose file.
- Use Streamable HTTP for container deployments.
- Use stdio for local MCP clients that launch the server as a child process.
- Keep stdio logs on stderr so local MCP clients receive protocol-only stdout.
- Expose HTTP health and readiness endpoints.
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

Docker Compose values such as image tag, host bind IP, host port, and network name can be overridden with environment variables or the `.env` file. The compose files document their defaults at the top; for example, `TRELLO_MCP_IMAGE_TAG` defaults to the `latest` tag in `docker-compose.yml` (`latest` follows the `main` branch, and you can set a version tag such as `0.1.1` for a pinned release), `TRELLO_MCP_HOST_BIND_IP` defaults to `127.0.0.1` for local-only access, `TRELLO_MCP_HOST_PORT` defaults to `3000` and maps that host port to the container's fixed internal `3000` listener, while `TRELLO_MCP_NETWORK` defaults to `trello-mcp_network`. Set `TRELLO_MCP_HOST_BIND_IP=0.0.0.0` only when you intentionally want Docker to publish the service on all host interfaces, such as for LAN access.

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
corepack pnpm build
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

#### Codex

If you are running the Docker/HTTP server:

```bash
codex mcp add trello --url http://localhost:3000/mcp
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
| `TRANSPORT` | no | `http` | `http` or `stdio`. |
| `LOG_LEVEL` | no | `info` | Pino log level. |
| `TRELLO_MCP_HOST_BIND_IP` | no | `127.0.0.1` | Docker Compose host interface bind address. Keep `127.0.0.1` for local-only access; set `0.0.0.0` to publish on all host interfaces for intentional network/LAN exposure. |
| `TRELLO_MCP_HOST_PORT` | no | `3000` | Docker Compose host port mapped to the container's fixed internal `3000` listener. |
| `TRELLO_MCP_IMAGE_TAG` | no | `latest` | Published image tag; `latest` follows `main`, or use a version tag to pin. |
| `TRELLO_MCP_NETWORK` | no | `trello-mcp_network` | Docker Compose bridge network name. |

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
```

The exact wording depends on your MCP client. The server can discover your boards and board lists first, then use those ids for card workflows.

## Tool Catalog

<!-- tools:start -->
| Name | When to use | Key inputs |
| --- | --- | --- |
| `trello_list_boards` | Use first when the user has not provided a board, list, card id, or Trello URL; returns boards visible to the authenticated Trello member. | filter, fields |
| `trello_board_get` | Use when you need board details, common board preferences, or label names for a known Trello board before listing or summarizing it. | boardId, fields |
| `trello_board_field_get` | Use when you need one specific board field, such as prefs, labelNames, subscribed, name, description, or URL. | boardId, field |
| `trello_board_lists` | Use when you need the lists on a known Trello board so you can find the right list id before listing or creating cards. | boardId, filter, fields |
| `trello_board_cards` | Use when you need cards across all lists on a known Trello board for personal planning, review, or summarization. | boardId, filter, fields |
| `trello_board_labels` | Use when discovering labels available on a board before creating or updating cards with labels. | boardId, limit, fields |
| `trello_board_members` | Use when you need the members who can access a known Trello board before assigning cards or reviewing collaboration. | boardId, fields |
| `trello_board_memberships` | Use when you need board membership records, member roles, or permission context for a known Trello board. | boardId, filter, member, memberFields |
| `trello_list_get` | Use when you need metadata for a known Trello list before creating cards in it or changing it. | listId, fields |
| `trello_list_create` | Use when creating a new Trello list on an existing board. | boardId, name, pos |
| `trello_list_update` | Use when renaming a Trello list, changing its position, or setting its archive state. | listId, name, closed, pos |
| `trello_list_archive` | Use when archiving or unarchiving a Trello list while keeping its cards recoverable. | listId, closed |
| `trello_list_move_to_board` | Use when moving an existing Trello list to another board. | listId, boardId |
| `trello_card_get` | Use when you need the current details of one Trello card by id, short id, or URL before editing or summarizing it. | cardId, fields |
| `trello_list_cards` | Use when you need cards in a specific Trello list; prefer board-level tools later when you need every list on a board. | listId, limit, filter |
| `trello_card_create` | Use when the user asks to create a new Trello card in a known list; accepts title, description, due date, members, and labels. | listId, name, desc, due, pos, memberIds, labelIds |
| `trello_card_update` | Use when changing card metadata such as title, description, due date, due completion, or archive state without moving it. | cardId, name, desc, due, dueComplete, closed |
| `trello_card_delete` | Use only when the user explicitly asks to permanently delete a Trello card; archive instead for reversible removal. | cardId |
| `trello_card_move` | Use when moving a card to another list, another board, or a different position; this is distinct from general card metadata updates. | cardId, listId, boardId, pos |
| `trello_card_archive` | Use when the user wants to archive or unarchive a card while keeping it recoverable; do not use for permanent deletion. | cardId, closed |
| `trello_card_attachments` | Use when listing files or links attached to a card. | cardId |
| `trello_card_attachment_add_url` | Use when attaching an existing public URL to a card; this does not upload local files. | cardId, url, name |
| `trello_card_attachment_delete` | Use when removing a specific attachment from a card by attachment id. | cardId, attachmentId |
| `trello_card_checklists` | Use when viewing all checklists and checklist items currently on a card. | cardId |
| `trello_card_checklist_create` | Use when adding a new checklist to an existing card, optionally copied from another checklist. | cardId, name, sourceChecklistId |
| `trello_card_checklist_item_create` | Use when adding a new item to an existing Trello checklist on a card. | checklistId, name, pos, checked, due, dueReminder, memberId |
| `trello_card_checklist_items` | Use when listing the items in one Trello checklist, including complete and incomplete items by default. | checklistId, filter, fields |
| `trello_card_checklist_item_update` | Use when editing a Trello card checklist item text, due date, member assignment, completion state, checklist, or position. | cardId, checkItemId, name, state, checklistId, pos, due, dueReminder, memberId |
| `trello_card_checklist_item_set_checked` | Use when checking or unchecking a Trello card checklist item without changing other item fields. | cardId, checkItemId, checked |
| `trello_card_checklist_item_move` | Use when moving a Trello checklist item to another checklist on the same card or to a different position. | cardId, checkItemId, checklistId, pos |
| `trello_card_checklist_item_delete` | Use when deleting a checklist item from a Trello card checklist. | cardId, checkItemId |
| `trello_card_members` | Use when listing members assigned to a card; use add/remove member tools to change assignment. | cardId |
| `trello_card_member_add` | Use when assigning a Trello member to a card by member id. | cardId, memberId |
| `trello_card_member_remove` | Use when unassigning a Trello member from a card by member id. | cardId, memberId |
| `trello_card_comment_add` | Use when adding a new comment to a Trello card; returns the created comment action. | cardId, text |
| `trello_card_comment_update` | Use when editing the text of an existing Trello card comment by its comment action id. | actionId, text |
| `trello_card_comment_delete` | Use when deleting an existing Trello card comment by its comment action id. | actionId |
| `trello_card_actions` | Use when auditing recent activity or comments for a card; set filter to commentCard for comments only. Use comment tools to add, edit, or delete comments. | cardId, filter, limit |
| `trello_label_get` | Use when you need the current name, color, or board for a specific Trello label before editing it. | labelId |
| `trello_label_create` | Use when creating a new reusable label on a Trello board before applying it to cards. | boardId, name, color |
| `trello_label_update` | Use when renaming a Trello label or changing its color without changing any card assignments. | labelId, name, color |
| `trello_label_delete` | Use only when the user explicitly asks to permanently delete a board label from Trello. | labelId |
| `trello_card_label_add` | Use when applying an existing Trello label to a card by label id. | cardId, labelId |
| `trello_card_label_remove` | Use when removing an existing Trello label from a card by label id. | cardId, labelId |
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
- `src/trello/client.ts` owns Trello HTTP requests, auth query parameters, retries, and response parsing.
- `src/trello/boards.ts` defines board and board-list discovery tools.
- `src/trello/cards.ts` defines the card tools.
- `src/trello/types.ts` contains Trello response schemas.
- `src/utils/*` contains logging, error mapping, pagination, and tool registration helpers.

## Security Notes

- Trello credentials stay in your environment or MCP client config.
- Logs redact `TRELLO_API_KEY`, `TRELLO_TOKEN`, and common key/token fields.
- Trello API requests use HTTPS.
- Tests use mocks and injected fetchers instead of live Trello calls.
- Do not publish `.env` files or paste tokens into issues and PRs.

## Development

Install dependencies:

```bash
corepack pnpm install
```

Run the local checks:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
```

Run coverage:

```bash
corepack pnpm test:coverage
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

Codex cloud tasks run a setup script before the agent starts, and can run an optional maintenance script when a cached container resumes on a task branch. Use these repository scripts in the Codex environment settings:

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
