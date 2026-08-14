# Changelog

## v1.0.0

Public 1.0 baseline for the self-hostable `trello-mcp` server: 77
workflow-oriented tools over stdio and Streamable HTTP, multi-platform Docker
deployment through GHCR, public documentation, and guarded live validation.
Coverage is broad but does not claim complete Trello REST API parity.

`trello-mcp` is an independent, community-maintained project. It is not an
official Trello or Atlassian product, service, or MCP implementation, and it is
not affiliated with, endorsed by, or sponsored by Trello or Atlassian. For
Trello's official managed service, see the
[Trello MCP documentation](https://support.atlassian.com/trello/docs/connect-trello-to-ai-assistants-with-trello-mcp/).

### Runtime And Security

- Require URL-shaped `cardId` values used by card and card-label tools to be canonical HTTPS card URLs on `trello.com` or `www.trello.com`, rejecting deceptive, malformed, and ambiguous references before a Trello request while continuing to accept ordinary card ids and short links.
- Redact deceptive Trello-like URLs and secret-shaped identifiers from retry metadata.
- Make GitHub Action reference validation linear-time and reject ambiguous empty path segments.

### Public Launch And Live Validation

- Keep credential-bearing local MCP and agent configuration plus generated live-validation reports out of Git commits and Docker build contexts.
- Pin hosted smoke and regression workflows to the documented public disposable boards and verify Trello still reports every configured board as public before recording board identity or performing writes. Local private-board validation remains configurable when its output stays private.
- Keep raw Trello tool failures and observed member or workspace identifiers out of live-validation logs, reports, summaries, and terminal failures. Narrow member reads to `me` and workspace-specific validation to the disposable board's own workspace.

### Documentation Website And Privacy

- Add a compact, accessible GitHub star count to desktop and mobile repository navigation while retaining the existing static repository link and unchanged homepage call to action.
- Use at most one best-effort, unauthenticated GitHub API attempt per browser session when session storage is available. The request omits credentials, cookies, and the page referrer; GitHub still receives ordinary request metadata such as IP address, user agent, request time, API URL, and Origin/CORS information. JavaScript, storage, API, network, or response failures leave the static link usable without repeated requests.
- Update the security policy, reference overview, live-validation description, and exact-image examples for the v1.0 release while preserving the generic `latest`, `X.Y`, `X.Y.Z`, and `sha-<commit>` deployment guidance.

### Development Tooling

- Update `@axe-core/playwright` from 4.12.1 to 4.13.0, Biome from 2.5.7 to 2.5.8, `smol-toml` from 1.7.1 to 1.8.0, `tsx` from 4.23.11 to 4.23.12, Astro from 7.2.0 to 7.2.1, and the development-only `parse5` parser from 7.3.0 to 8.0.1.

## v0.9.0

Public-launch readiness and release-candidate work with a production
documentation site, hardened public contribution and release surfaces, and
refreshed validation and tooling.

### Documentation Website

- Add the Starlight documentation site with getting-started, reference, and guide content; a runtime-backed searchable 77-tool catalog; canonical metadata; social imagery; redirects and headers; robots and LLM endpoints; and responsive, accessibility, navigation, contract, and Lighthouse validation.
- Add canonical configuration, Trello API key, architecture and request-flow, workflow, operations, and troubleshooting guides with deterministic website mirrors and freshness checks.

### Client Setup And Compatibility

- Add sanitized setup recipes for Claude Desktop, Claude Code, Codex CLI, VS Code, OpenCode, MCP Inspector, and manual clients over stdio and bearer-protected Streamable HTTP.
- Record dated compatibility evidence separately for documentation review, connection, tool discovery, and live Trello use, with contract tests for setup recipes and generated mirrors.

### Runtime And Security

- Return 404 for HTTP paths other than health endpoints and `/mcp` before authentication or body parsing, while continuing to accept query strings on `/mcp`.
- Limit failed-tool logs to generic messages plus safe error and resource metadata so private identifiers and upstream details are not exposed.
- Clarify the public input descriptions for `card_checklist_update` and `list_create.pos` without changing the 77-tool surface.

### API Coverage And Repository Readiness

- Finalize the Trello REST coverage matrix across all 18 official groups and all 77 registered tools, with endpoint-family detail, explicit coverage states, roadmap links, and contract tests.
- Add public bug, documentation, and feature Issue Forms; disable blank issues; route sensitive reports to the security policy; and strengthen sanitized support, contribution, and release guidance.
- Remove pre-publication and machine-local assumptions, ignore local AI and MCP configuration that may contain credentials, and align public-facing repository and roadmap wording.

### CI, Release, And Supply-Chain Hardening

- Pin every external GitHub Action to a verified immutable commit SHA with exact-version comments, plus semantic pin-consistency regression tests.
- Expand pull-request validation with website QA, both Compose configuration checks, and a non-publishing multi-platform image build; align OCI source metadata with this repository.
- Remediate the transitive Hono dependency at 4.12.34.

### Live Validation

- Replace the third-party dummy attachment image with the project-owned social card while retaining cleanup assertions.

### Packaging And Tooling

- Restrict the published package to built runtime files, `README.md`, `CHANGELOG.md`, and `LICENSE`; keep the website in a private, non-publishable workspace outside the runtime package and image.
- Update the MCP SDK from 1.29.0 to 1.30.0, Biome from 2.5.5 to 2.5.7, tsx from 4.23.1 to 4.23.11, and the root TypeScript compiler from 6.0.3 to 7.0.2; add the pinned Astro, Starlight, Playwright, accessibility, and Lighthouse documentation toolchain while retaining TypeScript 6.0.3 in the website workspace for compatibility.

## v0.8.1

Dependency maintenance release with refreshed development tooling and CI setup.

### Runtime And Tooling

- Update Biome, tsx, Vitest, and Node type definitions to their current compatible releases.
- Update GitHub Actions setup-node to v7 for CI and live-validation workflows.
- Keep Dependabot updates aligned with the supported Node 24 runtime policy.

## v0.8.0

Public readiness groundwork release, with API coverage documentation, client
compatibility evidence, support policies, and checklist metadata updates.

### Documentation And Policy

- Add the Trello API coverage matrix with supported, partial, unsupported, and non-goal endpoint families for public launch planning.
- Add security, privacy, and support policy docs covering vulnerability reporting, credential handling, telemetry posture, and support boundaries.
- Add the MCP client compatibility matrix with validated client/runtime combinations and documented limitations.

### Trello Tools

- Add `card_checklist_update` for renaming a card checklist and changing its position.

### Runtime And Tooling

- Set up Dependabot dependency updates and the repository auto-merge policy for eligible patch and minor updates.
- Pin the Node runtime in version-manager files, including `.tool-versions`, so local development and automation use the same Node 24 baseline.
- Update GitHub Actions workflow checkout steps to the current major version.

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
