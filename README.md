# Trello MCP Server

A self-hostable Model Context Protocol server exposing Trello tools to LLM clients.

This repository is currently at the reviewed vertical-slice milestone: config validation, Trello client auth/rate-limit/error handling, tool factory, card tools, HTTP/stdio transports, tests, Docker, and CI/CD scaffolding.

## Quick start

```bash
docker run --rm -p 3000:3000 \
  -e TRELLO_API_KEY=your-key \
  -e TRELLO_TOKEN=your-token \
  ghcr.io/enthouan/trello-mcp:latest
```


## Codex cloud environments

Codex cloud tasks run a setup script before the agent starts, and can run an optional maintenance script when a cached container resumes on a task branch. Use these repository scripts in the Codex environment settings:

```bash
./scripts/codex/setup.sh
```

```bash
./scripts/codex/maintenance.sh
```

The setup script enables Corepack, activates the pinned pnpm version, installs dependencies with `--frozen-lockfile` when `pnpm-lock.yaml` exists (or a normal install before the lockfile is committed), and runs `pnpm typecheck`. The maintenance script repeats the dependency sync and typecheck for cached containers so branch changes do not use stale dependencies.

## Trello credentials

This server currently supports Trello API key + token authentication only.

1. Go to [Trello Power-Up admin](https://trello.com/power-ups/admin).
2. Create a Power-Up, or open an existing one that should own this API key.
3. Open the Power-Up's **API key** tab.
4. Copy the API key into `TRELLO_API_KEY`.
5. Click the **Token** link near the API key to open Trello's authorization page.
6. Authorize access for your Trello account.
7. Copy the generated token into `TRELLO_TOKEN`.

Treat the token like a password. Do not commit it, paste it in logs, or share it in PRs.

You can verify the credentials with:

```bash
curl "https://api.trello.com/1/members/me?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN"
```

If the credentials are valid, Trello returns your member JSON. See Trello's [REST API getting started guide](https://support.atlassian.com/trello/docs/getting-started-with-trello-rest-api/) and [API introduction](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/) for the official flow.

## Environment

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `TRELLO_API_KEY` | yes | | Trello API key. |
| `TRELLO_TOKEN` | yes | | Trello token for token auth. |
| `TRANSPORT` | no | `http` | `http` or `stdio`. |
| `PORT` | no | `3000` | HTTP port. |
| `LOG_LEVEL` | no | `info` | Pino log level. |

## Tool catalog

<!-- tools:start -->
| Name | When to use | Key inputs |
| --- | --- | --- |
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
| `trello_card_members` | Use when listing members assigned to a card; use add/remove member tools to change assignment. | cardId |
| `trello_card_member_add` | Use when assigning a Trello member to a card by member id. | cardId, memberId |
| `trello_card_member_remove` | Use when unassigning a Trello member from a card by member id. | cardId, memberId |
| `trello_card_actions` | Use when auditing recent activity or comments for a card; set filter to commentCard for comments only. | cardId, filter, limit |
<!-- tools:end -->

Regenerate the catalog with `pnpm docs:tools`.
