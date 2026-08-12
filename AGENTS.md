# AGENTS.md

This file gives coding agents project-specific instructions for this repository. It applies to the entire repo unless a more specific `AGENTS.md` is added in a subdirectory.

## Project Summary

`trello-mcp` is a self-hostable Model Context Protocol server for Trello. It exposes Trello operations as MCP tools and supports:

- Streamable HTTP MCP transport for container/server deployments.
- stdio MCP transport for local process-based clients.
- Trello API key + token authentication.
- Zod validation for config, tool input, and Trello API responses.
- Pino logging with secret redaction.
- Vitest tests and Biome formatting/linting.
- Docker image publishing through GitHub Actions.

This project is still early, but it has a meaningful public tool surface. Keep changes focused and avoid speculative architecture.

## Hard Constraints

- Do not log Trello credentials, request URLs containing credentials, raw environment objects, or full query strings that include auth.
- Do not make live Trello API calls in tests. Use injected fetchers/mocks.
- Do not bypass Zod validation for tool inputs or Trello API responses.
- Keep `src/trello/client.ts` as the only place that performs `fetch` calls to Trello.
- Keep generated/build output such as `dist/`, coverage output, and `node_modules/` out of commits.

## Runtime And Package Manager

- Node.js: `>=24.0.0 <25.0.0`.
- Package manager: `pnpm@10.34.1` through Corepack.
- Module system: ESM (`"type": "module"`).
- TypeScript is strict, with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` enabled.

Use:

```bash
corepack enable
corepack prepare pnpm@10.34.1 --activate
corepack pnpm install --frozen-lockfile
```

When `pnpm-lock.yaml` exists, CI/Codex setup should use frozen installs.

## Common Commands

Run these from the repository root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
corepack pnpm test:coverage
corepack pnpm docs:check
corepack pnpm website:typecheck
corepack pnpm website:build
corepack pnpm website:contracts
corepack pnpm website:test
corepack pnpm website:lighthouse
corepack pnpm website:check
```

Use these as the normal verification gate before a PR is considered ready:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
```

Use `corepack pnpm test:coverage` when changing core behavior, error handling, or tool registration.

## Repo Agent Skills

- Use `.agents/skills/trello-mcp-release/SKILL.md` when preparing, cutting, publishing, or verifying a release. The release flow must respect protected `main`: release metadata changes go through a PR, then the merged `origin/main` commit is tagged with an annotated `vX.Y.Z` tag.
- Use `.agents/skills/trello-mcp-live-validation/SKILL.md` when running, verifying, debugging, or reporting opt-in live Trello smoke or regression validation. Live Trello runs must stay explicit-env-gated and must never run as part of normal CI or offline tests.
- The user's review of the release PR is the only normal release approval boundary. Once the user says the release PR is reviewed or approved, continue automatically for that exact `vX.Y.Z` through required checks, merge, tag push, GHCR verification, GitHub Release creation, and milestone closure.

## Formatting And Linting

- Biome is the formatter/linter.
- The configured Biome version is `@biomejs/biome@2.5.7`; keep it aligned with `biome.json`.
- Run `corepack pnpm lint` to check formatting and lint rules.
- To format, run:

```bash
corepack pnpm exec biome format --write .
```

- For safe lint/import fixes on a specific file, prefer:

```bash
corepack pnpm exec biome check --write path/to/file.ts
```

## Repository Map

- `src/index.ts`: process entrypoint, config loading, logger creation, HTTP/stdio transport startup, shutdown handling.
- `src/server.ts`: MCP server construction and tool registration.
- `src/config.ts`: environment variable schema. Keep auth to `TRELLO_API_KEY` and `TRELLO_TOKEN`.
- `src/health.ts`: HTTP health/readiness responses.
- `src/http-auth.ts`: optional `MCP_AUTH_TOKEN` bearer check for HTTP MCP requests.
- `src/trello/client.ts`: Trello REST client, auth query parameters, rate limiting, retries, response parsing, typed errors.
- `src/trello/auth.ts`: read-only `auth_whoami` and `auth_token_info` credential diagnostic tools.
- `src/trello/boards.ts`: board discovery and board-level list, card, label, member, and custom field tools.
- `src/trello/workspaces.ts`: workspace discovery, metadata, board, and member tools.
- `src/trello/members.ts`: member profile, board, card, and workspace lookup tools.
- `src/trello/lists.ts`: list create, inspect, update, archive, and move tools.
- `src/trello/cards.ts`: card, attachment, checklist, member, comment, action, and card custom field item tools.
- `src/trello/labels.ts`: label CRUD and card label assignment tools.
- `src/trello/custom-fields.ts`: custom field definition and option lookup tools.
- `src/trello/search.ts`: search tools for cards, boards, members, and workspaces.
- `src/trello/fields.ts`: shared Trello field list validation helpers.
- `src/trello/types.ts`: Zod schemas for Trello API response shapes.
- `src/utils/tool.ts`: `defineTool`, MCP registration wrapper, request IDs, logging, result wrapping.
- `src/utils/errors.ts`: app error mapping and MCP error conversion.
- `src/utils/logger.ts`: Pino logger and redaction.
- `tests/`: Vitest unit tests.
- `scripts/generate-tool-docs.ts`: regenerates the README tool catalog.
- `website/`: Astro Starlight workspace, generated documentation mirrors, production-preview tests, and visual/Lighthouse QA.
- `website/package.json`: Astro/Starlight dependencies and website lifecycle scripts.
- `scripts/codex/setup.sh`: Codex cloud fresh-container setup.
- `scripts/codex/maintenance.sh`: Codex cloud cached-container maintenance.
- `.github/workflows/build-and-test.yml`: Build, test, and website QA workflow.
- `.github/workflows/release.yml`: GHCR Docker image publishing.

## Architecture Rules

### Tool Definitions

Each Trello domain module should export an array of `defineTool(...)` definitions.

For a new tool:

1. Define the input schema close to the handler with Zod.
2. Use precise descriptions; they are visible to MCP clients.
3. Call `trello.request(...)` from the handler.
4. Parse Trello responses with a schema from `src/trello/types.ts`.
5. Include `resourceType` and `resourceId` in request options when that improves error messages.
6. Add focused tests for input validation, request construction, and error behavior.
7. Regenerate the tool catalog if public tools changed:

```bash
corepack pnpm docs:tools
```

Tool handlers should return plain JSON-serializable data. `registerTool` wraps handler output into MCP text content with `asTextResult`.

### Trello Client

Keep network and Trello protocol concerns in `src/trello/client.ts`.

- Add auth query params only in `buildUrl`.
- Keep auth to `key=<TRELLO_API_KEY>` and `token=<TRELLO_TOKEN>`.
- Keep retry and rate-limit behavior deterministic and injectable for tests.
- Use injected `fetcher`, `sleep`, and `random` in tests rather than timers or live network.
- Map Trello errors to typed app errors in one place.
- Do not leak auth values into thrown messages or logs.

### Config

All runtime config belongs in `src/config.ts`.

Current public env vars:

- `TRELLO_API_KEY`, required.
- `TRELLO_TOKEN`, required.
- `MCP_AUTH_TOKEN`, optional, no default; requires `Authorization: Bearer <token>` on HTTP MCP requests when set.
- `TRELLO_ATTACHMENT_UPLOAD_ROOT`, optional, no default; enables server-local attachment uploads when set to an absolute directory.
- `TRANSPORT`, optional, default `http`, valid values `http` or `stdio`.
- `PORT`, optional, default `3000`.
- `LOG_LEVEL`, optional, default `info`.

When changing config:

- Update `README.md`.
- Update `.env.example`.
- Add or update tests where practical.
- Confirm logger redaction still covers secrets.

### Transports And HTTP

- `TRANSPORT=stdio` should connect `StdioServerTransport` and avoid opening an HTTP port.
- `TRANSPORT=http` should create the Node HTTP server and use `StreamableHTTPServerTransport`.
- Keep health handling separate in `src/health.ts`.
- Shutdown should stop accepting requests, wait for in-flight HTTP work, and close the MCP server.
- Be careful with MCP SDK type changes; verify with `corepack pnpm typecheck`.

### Logging

- Use the shared logger from `src/utils/logger.ts`.
- Include structured fields when useful, such as `requestId`, `toolName`, `durationMs`, and `errorType`.
- Do not log raw errors if they may contain credentials.
- Keep redaction paths updated for any new secret-like fields.

## Testing Guidance

Use Vitest.

Current test coverage includes:

- `tests/config.test.ts`: environment parsing and validation.
- `tests/client.test.ts`: auth query construction, rate limiting, retries, HTTP error mapping.
- `tests/boards.test.ts`, `tests/lists.test.ts`, `tests/labels.test.ts`, `tests/custom-fields.test.ts`, and `tests/fields.test.ts`: domain tool input parsing, response parsing, and Trello request construction.
- `tests/auth.test.ts`, `tests/workspaces.test.ts`, `tests/members.test.ts`, and `tests/search.test.ts`: credential diagnostics, workspace and member discovery, and search tool behavior.
- `tests/http-auth.test.ts`: bearer token extraction and HTTP MCP request authorization.
- `tests/cards.test.ts`: card, attachment, checklist, member, comment, action, and custom field item tool behavior.
- `tests/tool.test.ts`: tool registration wrapper, validation, result wrapping, MCP error mapping.

When adding behavior:

- Prefer narrow, deterministic unit tests.
- Mock `fetch` through `TrelloClient` options.
- Mock sleep/random for retry and rate-limit behavior.
- Assert request paths, methods, query params, and response parsing.
- Add regression tests for bugs before or with the fix.

Avoid:

- Tests that depend on real Trello credentials.
- Snapshotting large generated objects when a targeted assertion is clearer.
- Asserting on exact timing except through injected deterministic functions.

## Documentation Rules

- Keep README quick-start and environment tables current.
- If MCP tools are added, removed, renamed, or their key inputs change, run `corepack pnpm docs:tools` and commit the README and generated website catalog updates.
- Canonical long-form documentation remains under `docs/`; use `corepack pnpm docs:tools` to refresh deterministic website mirrors and `corepack pnpm docs:check` to verify they are current.
- Keep `.env.example` limited to supported environment variables.

## CI And Release

The GitHub Actions workflow named `Build and Test` runs:

- install
- typecheck
- lint
- build
- test coverage
- Astro content/type checks and the production website build
- Chromium website, accessibility, navigation, metadata, and responsive checks,
  plus a focused desktop-light WebKit homepage smoke check
- screenshots retained on failure for ordinary CI
- Docker Compose validation and a non-publishing multi-platform image build on pull requests

The `Release` workflow publishes Docker images to GHCR from `main` and `v*` tags.

Cloudflare Pages handles production website builds and deployment outside GitHub
Actions. Keep `Build and Test` focused on validation; it must not require
Cloudflare credentials or invoke a production deployment.

Configure Cloudflare Pages to run `corepack pnpm website:build` and publish
`website/dist`. The canonical production URL is built in, so no website
environment variable is required.

If changing CI:

- Prefer minimal workflow changes.
- Keep Node and pnpm versions consistent with `package.json`.
- Do not add secrets unless the workflow genuinely needs them.

## Docker Notes

- `Dockerfile`, `docker-compose.yml`, and `docker-compose.local.yml` are part of the deploy surface.
- `docker-compose.yml` should use the published image for normal deployment.
- `docker-compose.local.yml` should build from the local Dockerfile for development and local verification.
- Keep container defaults aligned with README env vars.
- Do not bake credentials into images or compose files.
- The app should continue to support stateless container operation.

## Dependency Guidance

- Avoid dependency churn.
- Keep top-level dependency ranges pinned to exact versions for release reproducibility.
- Keep the root runtime toolchain on TypeScript 7. The private website workspace
  intentionally pins TypeScript 6.0.3 because `@astrojs/check@0.9.10` currently
  requires TypeScript 5 or 6; do not downgrade the root package to satisfy that
  website-only peer dependency.
- If a dependency update is required, update and commit `pnpm-lock.yaml`.
- Be extra cautious with `@modelcontextprotocol/sdk` and TypeScript updates because SDK declaration changes can affect transport and tool typing.

## Change Checklist

Before finishing a non-trivial change, run:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
corepack pnpm docs:check
corepack pnpm website:check
```

Use `corepack pnpm website:visual` for the representative desktop/mobile,
light/dark design matrix and `corepack pnpm website:lighthouse` for release-time or
substantial layout/performance validation.

For tool catalog changes, also run:

```bash
corepack pnpm docs:tools
```

For release/Docker changes, consider:

```bash
corepack pnpm docker:build
```

Only run Docker locally if the environment supports it and the user actually needs that verification.

## Pull Request Expectations

- Keep commits small and messages short but specific.
- Never merge a PR unless the user explicitly approves merging that specific PR. For release PRs, follow the release skill's single PR-review approval boundary.
- Explain behavioral changes and test coverage in PR descriptions.
- Note any skipped checks with the reason.
- Do not include Codex attribution in commit messages.
- Do not include secrets in commits, logs, fixtures, or PR text.

## Known Project Direction

Near-term scope is a reliable self-hostable Trello MCP server using API key/token auth. Future domains may include boards, lists, labels, checklists, comments, search, and webhook support, but do not add broad abstractions until a concrete tool or workflow needs them.
