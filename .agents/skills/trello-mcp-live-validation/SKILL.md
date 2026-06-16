---
name: trello-mcp-live-validation
description: Use when a user asks to live-test the Trello MCP server, run live smoke or regression validation, smoke-test all MCP tools, verify roadmap-board integration, exercise Trello tools against a real board, or run safe end-to-end Trello MCP validation. Covers env gates, target board confirmation, disposable artifact safety, smoke vs regression commands, tool-surface comparison, cleanup verification, and failure reporting.
---

# Trello MCP Live Validation

## Trigger And Scope

Use this skill when the user asks to run, verify, debug, or report live Trello MCP behavior against a real Trello board, including smoke checks, regression runs, broad "all tools" passes, and roadmap-board integration checks.

Do not use it for ordinary unit tests, static review, generic Trello API design, or offline script changes unless the user specifically asks for live MCP behavior.

Do not implement unrelated API coverage while following this skill. In particular, issue #40 cross-resource action audit tools are separate work.

## Required Pre-Checks

Read the current checkout before live work:

```bash
git status --short --branch
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
```

If public tools or key inputs changed, regenerate the catalog and investigate any unexpected README diff:

```bash
corepack pnpm docs:tools
```

## Live Safety Rules

- Never run live Trello validation from normal CI, `corepack pnpm test`, or any command path that is not explicitly requested.
- Never contact Trello unless the relevant live opt-in env vars, Trello credentials, and a board id or board URL are all set.
- Never log Trello API keys, tokens, credential-bearing URLs, raw env, raw request data, or full query strings.
- Treat only Trello board ids, short links, and `trello.com/b/...` board URLs as valid board refs. Reject non-board URLs before logging their raw value or query string.
- Use a board reserved for disposable validation artifacts. Do not mutate an active roadmap or production board unless the user explicitly confirms that board and accepts temporary artifacts there.
- Do not mutate existing cards, lists, labels, members, or custom fields except for read-only inspection. If a narrow reversible touch is unavoidable, verify restoration immediately.
- Prefix every temporary artifact with the script prefix or a stable manual marker such as `Codex MCP smoke test`.
- Treat a missing live env preflight failure as a valid skipped-live result when local credentials are unavailable.

## Target Board Handling

Confirm the target board before mutations. For manual roadmap-board smoke passes, the issue #88 default target is:

```text
https://trello.com/b/GnKmvuHz/trello-mcp-enthouan-trello-mcp
```

For scripted smoke/regression validation, prefer a disposable board reserved for live validation. The GitHub workflow default is the disposable public board short link `hUaItfNq`, unless overridden by workflow input or environment variable.

Accept either a board id/short link or a `trello.com/b/...` URL. The scripts normalize board URLs to their short link and resolve the canonical board id with `board_get` before creating artifacts. In a manual MCP-session pass, do the same: resolve and record the real board id before any write.

## Smoke Vs Regression

`corepack pnpm smoke:live` is the shallow release smoke check. It proves authentication, board discovery, representative list/card/label/checklist/member/comment writes, and cleanup through existing tool handlers and `TrelloClient`.

`corepack pnpm regression:live` is the broader opt-in release-validation suite. It walks the registered public tool surface by domain, supports `--domain` and `--tool` filters, reports live coverage, and makes skipped, unsupported, or missing coverage visible.

Use smoke for a quick PR/release confidence check. Use regression for "all MCP tools", domain coverage, release-candidate validation, or investigation of whether the source-defined tool catalog is covered live.

### Live Smoke Command

```bash
TRELLO_LIVE_SMOKE=1 \
TRELLO_LIVE_SMOKE_BOARD_ID=<disposable-board-id-or-short-link> \
TRELLO_API_KEY=<trello-api-key> \
TRELLO_TOKEN=<trello-token> \
corepack pnpm smoke:live
```

`TRELLO_LIVE_SMOKE_BOARD_URL` may be used instead of `TRELLO_LIVE_SMOKE_BOARD_ID`, but it must be a `trello.com/b/...` board URL. `TRELLO_LIVE_SMOKE_RUN_ID` is optional and helps identify temporary artifacts.

### Live Regression Command

```bash
TRELLO_LIVE_REGRESSION=1 \
TRELLO_LIVE_REGRESSION_BOARD_ID=<disposable-board-id-or-short-link> \
TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_ID=<optional-secondary-disposable-board-id-or-short-link> \
TRELLO_API_KEY=<trello-api-key> \
TRELLO_TOKEN=<trello-token> \
corepack pnpm regression:live
```

Use `TRELLO_LIVE_REGRESSION_BOARD_URL` instead of `TRELLO_LIVE_REGRESSION_BOARD_ID` for a `trello.com/b/...` URL. Use `TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_URL` instead of `TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_ID` when configuring the optional secondary board for `list_move_to_board`. Use `--secondary-board <board-id-short-link-or-url>` for a focused local override. Use `--domain <domain>`, `--tool <tool>`, `TRELLO_LIVE_REGRESSION_DOMAINS`, or `TRELLO_LIVE_REGRESSION_TOOLS` for focused runs. Use `TRELLO_LIVE_REGRESSION_REPORT_JSON=reports/live-regression.json` when a machine-readable report is useful.

Focused cross-board list move validation:

```bash
TRELLO_LIVE_REGRESSION=1 \
TRELLO_LIVE_REGRESSION_BOARD_ID=<primary-disposable-board-id-or-short-link> \
TRELLO_LIVE_REGRESSION_SECONDARY_BOARD_ID=<secondary-disposable-board-id-or-short-link> \
TRELLO_API_KEY=<trello-api-key> \
TRELLO_TOKEN=<trello-token> \
corepack pnpm regression:live --tool list_move_to_board
```

## Current Tool Surface Discovery

For source-defined tools, start from `src/trello/tools.ts`. `allTools` imports the domain modules and is also what `src/server.ts` registers with MCP. The README Tool Catalog is generated from the same public tool definitions and is useful for human review.

For a manual MCP-session smoke pass, enumerate the callable MCP tools in the active client/session, then compare them with the source-defined registered tools:

- `source-only`: present in `src/trello/tools.ts`/registered server tools but not callable in the current MCP session.
- `callable-only`: callable in the MCP session but not present in the working-tree source.
- `matched`: present in both and eligible for live testing if safe.

Report mismatches before running mutations. If the session tool surface is stale, tell the user which client/session likely needs reload instead of silently treating source tools as tested.

## Expected Scripted Coverage

The smoke harness validates these representative workflows through existing tool handlers and `TrelloClient`:

- Auth and discovery: `auth_whoami`, `auth_token_info`, visible boards, board fields, lists, cards, labels, members, memberships, and custom fields.
- Disposable list/card flow: create, read, rename/update, due-date update, position update, archive/restore, move, delete card, archive lists.
- Checklist flow: create checklist, create/list/update/check/delete checklist item.
- Label flow: create/read/update/apply/remove/delete a disposable label.
- Member flow: read card members and assign/remove the authenticated member only when that member is visible on the board.
- Activity flow: create/update/list/delete a disposable comment.

The regression suite classifies the broader registered tool surface as `covered`, `skipped`, `unsupported`, or `missing`. `list_move_to_board` is covered when a secondary disposable board is configured and intentionally skipped when it is not configured.

Current `board_create` behavior: `board_create` exists, but live regression intentionally classifies it as `unsupported` because it creates a real Trello board and this repo does not yet have a verified board cleanup path. Do not run `board_create` live against a real account unless the user explicitly provides a disposable target, understands that a new board will be created, and accepts the cleanup expectations.

## Cleanup Verification

Commands and manual passes must attempt cleanup even after an intermediate failure. A successful live run should report:

- the board it used,
- temporary lists/cards/labels/checklists/items created,
- validation steps completed,
- cleanup steps completed,
- no open smoke-test lists, cards, or labels remaining.

Cleanup should also discover and remove prefix-matched lists, cards, and labels that were created by Trello but not recorded because a create response failed validation. Regression cleanup must check every configured disposable regression board, including the secondary board used for cross-board list moves.

If cleanup fails, report exactly which artifacts may remain and avoid claiming the board is clean.

## Manual MCP-Session Result Categories

When the user asks for a manual all-tools MCP smoke pass, record each tool with one of these categories:

- `pass`: the tool returned success and Trello state matched the expectation.
- `partial`: Trello state changed but MCP returned an error, or cleanup/restoration needed manual attention.
- `expected failure`: a known Trello/API constraint, unsupported live path, absent optional board feature, missing upload fixture, or current WIP/non-goal area.
- `fail`: unexpected MCP, API, schema, auth, permission, or cleanup error.

Include concise repro inputs for failures without secrets or credential-bearing URLs.

## GitHub Issue Filing

Do not create GitHub issues automatically from live findings.

Instead:

1. Summarize observed failures.
2. Classify each as likely bug, WIP/expected, Trello API constraint, cleanup/safety issue, or unclear.
3. Ask the user which findings should become GitHub issues.
4. File issues only after explicit confirmation.

## Reporting

For PRs or release validation, report offline and live status:

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

For regression, include selected domains/tools, coverage counts by `covered`, `skipped`, `unsupported`, and `missing`, cleanup status, and the JSON report path if generated.

For manual MCP-session passes, include source-defined tool count, callable MCP tool count, mismatch summary, result counts by category, cleanup status, and whether existing board data was restored.

If using GitHub Actions, include the workflow run URL and conclusion. If the local preflight skip is expected, say that the command exited before contacting Trello.

## GitHub Actions

Use the `Live Trello Smoke` workflow for remote PR, post-merge `main`, and release validation. It runs offline gates before the secret-backed `pnpm smoke:live` step, and fork PRs are skipped so Trello credentials are not exposed to untrusted code. Never convert this workflow to `pull_request_target`.

Use the `Live Trello Regression` workflow for manual release-candidate or focused live debugging. It is intentionally manual-only and should not become a normal PR gate without an explicit project decision. Its default `secondary_board_ref` input points at the secondary disposable board so full workflow runs can cover `list_move_to_board`; override it only with another disposable board.

Before asking GitHub Actions to run live validation, confirm the repository has the appropriate Environment and secrets:

- `live-smoke`: `TRELLO_LIVE_SMOKE_API_KEY`, `TRELLO_LIVE_SMOKE_TOKEN`
- `live-regression`: `TRELLO_LIVE_REGRESSION_API_KEY`, `TRELLO_LIVE_REGRESSION_TOKEN`

Prefer a dedicated Trello member/token with access only to the disposable validation board. Use Environment required reviewers when available.
