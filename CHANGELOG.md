# Changelog

## v0.7.0

Board creation and cross-resource activity audit release, with a refreshed
Node 24 baseline and broader release validation.

### Trello Tools

- Add `board_create` for creating private, workspace-visible, or public Trello boards with optional workspace placement.
- Add `board_actions`, `list_actions`, and `workspace_actions` so activity and comment audits can cover boards, lists, cards, and workspaces with bounded pagination, filters, and member output shaping.
- Document compact action-audit reads and how to combine `filter`, `limit`, `since`, `before`, and `page` for large activity histories.

### Runtime And Tooling

- Refresh the Node 24 runtime baseline across package metadata, Docker images, Compose files, Codex setup scripts, and GitHub Actions.
- Update the pnpm, Biome, TypeScript, MCP SDK, Vitest, Pino, and GitHub Actions versions used for local development and CI validation.
- Keep the release workflow aligned with the current toolchain and published-image metadata.

### Live Validation

- Rename and expand the repo live validation skill guidance for smoke, regression, and release-candidate runs.
- Improve live regression reporting, artifact handling, and fixture coverage for release validation.
- Cover `list_move_to_board` in live regression when a secondary disposable board is configured, while keeping `board_create` unsupported until a verified board cleanup path exists.

## v0.6.0

Reliability and tool ergonomics release, with opt-in live Trello validation,
checklist deletion, and tunable rate-limit handling.

### Trello Tools

- Add `card_checklist_delete` for deleting an entire checklist from a Trello card.
- Cover checklist deletion in the generated MCP tool catalog and the opt-in live smoke and regression flows.

### Live Validation

- Add `corepack pnpm smoke:live` for a guarded, disposable-board release smoke test against real Trello.
- Add `corepack pnpm regression:live` for broader opt-in live regression coverage by domain or individual tool.
- Add cleanup verification, explicit environment gates, and JSON reporting for live validation runs.
- Keep secret-backed live regression workflow dispatch isolated from normal pull request and CI runs.

### Runtime And Observability

- Add configurable Trello rate-limit and retry settings for large workflows.
- Log safe retry and token-bucket wait metadata without exposing Trello credentials, raw URLs, or query strings.
- Limit build-test push runs to `main` while keeping pull request validation intact.

## v0.5.1

Patch release for Trello label color compatibility.

- Accept Trello's newer light and dark label color keys in label, card label, and card cover response validation.
- Allow the same label color variants in label creation and update inputs.
- Add regression coverage for board labels, individual label reads, embedded card labels, cover colors, and label creation inputs.

## v0.5.0

Members, workspaces, and auth diagnostics release, with HTTP bearer auth and
more specific Trello permission and validation errors.

### Trello Tools

- Add auth diagnostic tools to identify the authenticated Trello member and inspect token metadata without managing or exposing tokens.
- Add member profile, board, card, and workspace lookup tools for Trello member-centric workflows.
- Add workspace discovery, metadata, board listing, and member listing tools for Trello organizations.
- Polish MCP tool names, descriptions, schemas, and output shapes for the 0.5 tool surface.

### Runtime And Configuration

- Add optional `MCP_AUTH_TOKEN` bearer authentication for Streamable HTTP MCP requests.
- Map permission-related Trello failures to clearer MCP errors for collaboration and access-limited workflows.
- Document HTTP bearer auth, updated environment variables, and the refreshed 0.5 tool catalog.

### Validation And Tests

- Surface specific validation errors for `card_cover_set` cover-clearing requests with display options.
- Surface a specific no-op validation error for `card_due_date_set`.
- Add focused tests for auth diagnostics, HTTP auth, member tools, workspace tools, permission-aware errors, logger redaction, and validation behavior.

## v0.4.0

Search and MCP ergonomics release, with smaller tool names, shared output
shaping, and release tag improvements.

### Trello Tools

- Add `search` and `search_members` tools for finding Trello cards, boards, members, and organizations from natural language search terms.
- Rename public MCP tools to remove the redundant `trello_` prefix while keeping the `trello-mcp` server name unchanged.
- Extend `card_cover_set` with Trello card cover display options for `normal` and `full` cover sizes plus optional text brightness.
- Standardize pagination, field selection, and output shaping for high-volume board, card, list, member, label, action, and search responses.
- Fix card attachment listing so the default request works without sending Trello an invalid attachment filter.

### Deployment And Documentation

- Publish moving minor-line Docker image tags such as `0.4` alongside exact release tags such as `0.4.0`.
- Document Docker image tag meanings and versioned deployment options.
- Refresh the generated MCP tool catalog for the unprefixed tool names and search tools.

### Development And CI

- Add CI job timeouts to keep stalled workflow runs bounded.
- Add focused tests for search tools, shared pagination and field helpers, tool-name compatibility rules, cover display options, attachment filter behavior, and output shaping.

## v0.3.0

Custom fields and attachment upload release, with Trello response parsing fixes
and refreshed development tooling.

### Trello Tools

- Add board and card custom field tools to inspect custom field definitions, list dropdown options, read card custom field items, set supported custom field values, and clear card custom fields.
- Add single-attachment lookup and guarded server-local attachment upload support through `trello_card_attachment_get` and `trello_card_attachment_upload`.
- Fix custom field option endpoint ids so option lookup uses the correct Trello route.
- Fix card mutation success response handling for Trello endpoints that return minimal or empty success bodies.
- Fix card cover clearing so removing an attachment cover sends the Trello request shape the API expects.
- Fix projected Trello field validation for filtered board, card, list, and label responses.

### Runtime And Configuration

- Add `TRELLO_ATTACHMENT_UPLOAD_ROOT` to enable local file uploads only from an explicitly configured absolute server-side directory.
- Harden attachment upload path handling so paths resolve inside the configured upload root before Trello requests are made.

### Development And CI

- Refresh the Node, pnpm, Biome, TypeScript, MCP SDK, Vitest, and Pino toolchain versions.
- Reorganize ignore files and Codex maintenance scripts for the current project layout.
- Add focused tests for custom fields, attachment uploads, projected response shapes, config parsing, and Trello client behavior.

## v0.2.0

Core workflow completion release for boards, lists, labels, checklists, card
comments, common card relationships, and safer Compose defaults.

### Trello Tools

- Add board-level read tools for board details, board fields, cards, labels, members, memberships, and lists.
- Add list management tools to inspect, create, rename, archive, unarchive, and move Trello lists.
- Add label management tools to inspect, create, update, delete, apply, and remove labels.
- Add checklist item tools to create, list, update, check, uncheck, move, and delete checklist items.
- Add tools to add, edit, and delete Trello card comments.
- Add focused card relationship and mutation tools for card board, list, labels, due date, position, cover, and create-and-add label workflows.
- Fix `trello_card_due_date_set` so `dueComplete` can be updated without resending `due`.

### Deployment And Documentation

- Refine Docker Compose environment handling so host port, image tag, and network names are explicit Compose settings.
- Add `TRELLO_MCP_HOST_BIND_IP`, defaulting Docker Compose port publishing to `127.0.0.1` for local-only access.
- Document the project roadmap and refreshed 0.2 tool catalog.

### Runtime

- Read the MCP server version from `package.json` so server metadata stays aligned with release metadata.

## v0.1.1

Packaging metadata patch release.

- Add GHCR-supported OCI image labels for source, description, and license metadata.
- Add OCI index annotations so the package description is available on the multi-platform image.
- Add an inspectable GitHub Actions run URL to published image metadata.

## v0.1.0

Initial self-hostable Trello MCP server release.

### Trello Tools

- Discover boards visible to the authenticated Trello member.
- Read board metadata and list board lists.
- Read cards by id, short id, or Trello card URL.
- List cards in a Trello list.
- Create, update, move, archive, unarchive, and delete cards.
- List card attachments and add or remove URL attachments.
- List card checklists and create card checklists.
- List card members and add or remove members.
- Read card actions and activity.

### Runtime

- Support stdio transport for local MCP clients.
- Support Streamable HTTP transport for self-hosted/container deployments.
- Route Streamable HTTP requests by MCP session id.
- Expose `/healthz` and `/readyz` endpoints.
- Keep stdio logs on stderr so stdout stays protocol-only.
- Validate environment config, tool inputs, and Trello API responses with Zod.
- Redact Trello API credentials in logs.

### Deployment And Development

- Provide Dockerfile, published-image Compose config, and local-build Compose config.
- Publish Docker images to `ghcr.io/enthouan/trello-mcp`.
- Run build, lint, typecheck, and test coverage in GitHub Actions.
- Include Quick Start docs for Docker image use, local builds, and MCP clients.
- Include Codex setup and maintenance scripts for cloud development.
