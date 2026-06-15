---
name: trello-mcp-live-smoke-test
description: Use when running, verifying, debugging, or reporting the opt-in live Trello smoke test harness for trello-mcp. Covers required environment gates, disposable board safety, offline validation, live smoke execution, cleanup expectations, and PR/release validation notes.
---

# Trello MCP Live Smoke Test

## Guardrails

- Never run live Trello validation from normal CI, `corepack pnpm test`, or any command path that is not explicitly requested.
- Never contact Trello unless `TRELLO_LIVE_SMOKE=1`, `TRELLO_API_KEY`, `TRELLO_TOKEN`, and either `TRELLO_LIVE_SMOKE_BOARD_ID` or `TRELLO_LIVE_SMOKE_BOARD_URL` are all set.
- Treat only Trello board ids, short links, and `trello.com/b/...` board URLs as valid board refs. Non-board URLs must fail before any raw value or query string can be logged.
- Use a board reserved for disposable validation artifacts. Do not point the harness at a production planning board unless the user explicitly accepts temporary lists, cards, labels, checklists, and comments there.
- Do not log Trello API keys, tokens, credential-bearing URLs, raw env, or raw request data.
- Treat a missing live env preflight failure as a valid skipped-live result when local credentials are unavailable.

## Before Running

Inspect the current checkout first:

```bash
git status --short --branch
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
```

If public tool docs may have changed, run:

```bash
corepack pnpm docs:tools
```

## GitHub Actions

Use the `Live Trello Smoke` workflow for remote PR and release validation. It runs for same-repository pull requests and manual dispatch. Fork PRs are skipped so Trello credentials are not exposed to untrusted PR code.

The workflow must run `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm test` before the secret-backed `pnpm smoke:live` step.

Before asking GitHub Actions to run live smoke, confirm the repository has a `live-smoke` Environment with:

- `TRELLO_LIVE_SMOKE_API_KEY`
- `TRELLO_LIVE_SMOKE_TOKEN`

Prefer a dedicated Trello member/token with access only to the disposable smoke board. Use Environment required reviewers when available. Never convert this workflow to `pull_request_target`.

The default workflow board is `hUaItfNq`, the disposable public board. Override it for PR runs with environment variable `TRELLO_LIVE_SMOKE_BOARD_ID`, or override `board_ref` on manual dispatch.

## Live Smoke Command

Run the harness only with an explicit smoke board and credentials:

```bash
TRELLO_LIVE_SMOKE=1 \
TRELLO_LIVE_SMOKE_BOARD_ID=<disposable-board-id-or-short-link> \
TRELLO_API_KEY=<trello-api-key> \
TRELLO_TOKEN=<trello-token> \
corepack pnpm smoke:live
```

`TRELLO_LIVE_SMOKE_BOARD_URL` may be used instead of `TRELLO_LIVE_SMOKE_BOARD_ID`, but it must be a `trello.com/b/...` board URL. `TRELLO_LIVE_SMOKE_RUN_ID` is optional and helps identify temporary artifacts.

## Expected Coverage

The harness should validate these representative pre-1.0 workflows through existing tool handlers and `TrelloClient`:

- Auth and discovery: `auth_whoami`, `auth_token_info`, visible boards, board fields, lists, cards, labels, members, memberships, and custom fields.
- Disposable list/card flow: create, read, rename/update, due-date update, position update, archive/restore, move, delete card, archive lists.
- Checklist flow: create checklist, create/list/update/check/delete checklist item.
- Label flow: create/read/update/apply/remove/delete a disposable label.
- Member flow: read card members and assign/remove the authenticated member only when that member is visible on the board.
- Activity flow: create/update/list/delete a disposable comment.

## Cleanup Verification

The command must attempt cleanup even after an intermediate failure. A successful live run should report:

- the board it used,
- temporary lists/cards/labels/checklists/items created,
- validation steps completed,
- cleanup steps completed,
- no open smoke-test lists, cards, or labels remaining.

Cleanup should also discover and remove prefix-matched lists, cards, and labels that were created by Trello but not recorded because a create response failed validation.

If cleanup fails, report exactly which artifacts may remain and avoid claiming the board is clean.

## Reporting

For PRs or release validation, report both offline and live status:

```text
Offline validation:
- corepack pnpm typecheck
- corepack pnpm lint
- corepack pnpm build
- corepack pnpm test

Live smoke:
- corepack pnpm smoke:live
- Result: ran against <board name/id> and cleaned up <artifacts>, or skipped because <missing env vars>.
```

If using GitHub Actions, include the workflow run URL and conclusion. If the local preflight skip is expected, say that the command exited before contacting Trello.
