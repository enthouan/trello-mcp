# AGENTS.md

This file gives coding agents project-specific instructions for this repository. It applies to the entire repo unless a more specific `AGENTS.md` is added in a subdirectory.

## Project Summary

`trello-mcp` is a self-hostable Model Context Protocol server for Trello. It exposes Trello operations as MCP tools and supports:

- HTTP Streamable MCP transport for container/server deployments.
- stdio MCP transport for local process-based clients.
- Trello API key + token authentication.
- Zod validation for config, tool input, and Trello API responses.
- Pino logging with secret redaction.
- Vitest tests and Biome formatting/linting.
- Docker image publishing through GitHub Actions.

This project is still in the initial scaffold/vertical-slice phase. Keep changes focused and avoid speculative architecture.

## Hard Constraints

- Do not log Trello credentials, request URLs containing credentials, raw environment objects, or full query strings that include auth.
- Do not make live Trello API calls in tests. Use injected fetchers/mocks.
- Do not bypass Zod validation for tool inputs or Trello API responses.
- Keep `src/trello/client.ts` as the only place that performs `fetch` calls to Trello.
- Keep generated/build output such as `dist/`, coverage output, and `node_modules/` out of commits.

## Runtime And Package Manager

- Node.js: `>=22.0.0`.
- Package manager: `pnpm@10.34.1` through Corepack.
- Module system: ESM (`"type": "module"`).
- TypeScript is strict, with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` enabled.

Use:

```bash
corepack enable
corepack prepare pnpm@10.34.1 --activate
corepack pnpm install
```

When `pnpm-lock.yaml` exists, CI/Codex setup should use frozen installs.

## Common Commands

Run these from the repository root:

```bash
corepack pnpm install
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
corepack pnpm test:coverage
```

Use these as the normal verification gate before a PR is considered ready:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
```

Use `corepack pnpm test:coverage` when changing core behavior, error handling, or tool registration.

## Formatting And Linting

- Biome is the formatter/linter.
- The configured Biome version is `@biomejs/biome@2.4.16`; keep it aligned with `biome.json`.
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
- `src/trello/client.ts`: Trello REST client, auth query parameters, rate limiting, retries, response parsing, typed errors.
- `src/trello/cards.ts`: Trello card-related MCP tool definitions.
- `src/trello/types.ts`: Zod schemas for Trello API response shapes.
- `src/utils/tool.ts`: `defineTool`, MCP registration wrapper, request IDs, logging, result wrapping.
- `src/utils/errors.ts`: app error mapping and MCP error conversion.
- `src/utils/logger.ts`: Pino logger and redaction.
- `tests/`: Vitest unit tests.
- `scripts/generate-tool-docs.ts`: regenerates the README tool catalog.
- `scripts/codex/setup.sh`: Codex cloud fresh-container setup.
- `scripts/codex/maintenance.sh`: Codex cloud cached-container maintenance.
- `.github/workflows/build-and-test.yml`: Build and Test workflow.
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

Current test focus:

- `tests/client.test.ts`: auth query construction, rate limiting, retries, HTTP error mapping.
- `tests/cards.test.ts`: card tool input parsing and Trello request construction.
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
- If MCP tools are added, removed, renamed, or their key inputs change, run `corepack pnpm docs:tools` and commit the README update.
- Keep `.env.example` limited to supported environment variables.

## CI And Release

The GitHub Actions workflow named `Build and Test` runs:

- install
- typecheck
- lint
- build
- test coverage

The `Release` workflow publishes Docker images to GHCR from `main` and `v*` tags.

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
- If a dependency update is required, update and commit `pnpm-lock.yaml`.
- Be extra cautious with `@modelcontextprotocol/sdk` and TypeScript updates because SDK declaration changes can affect transport and tool typing.

## Change Checklist

Before finishing a non-trivial change, run:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
```

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
- Explain behavioral changes and test coverage in PR descriptions.
- Note any skipped checks with the reason.
- Do not include Codex attribution in commit messages.
- Do not include secrets in commits, logs, fixtures, or PR text.

## Known Project Direction

Near-term scope is a reliable self-hostable Trello MCP server using API key/token auth. Future domains may include boards, lists, labels, checklists, comments, search, and webhook support, but do not add broad abstractions until a concrete tool or workflow needs them.
