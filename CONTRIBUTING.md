# Contributing

## Local checks

Use Node.js 24 or newer with the pinned pnpm version from `package.json`.

```bash
corepack enable
corepack prepare pnpm@10.34.1 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:coverage
corepack pnpm build
```


## Codex cloud setup

When configuring a Codex cloud environment, use:

- Setup script: `./scripts/codex/setup.sh`
- Maintenance script: `./scripts/codex/maintenance.sh`

The setup script prepares pnpm and installs dependencies for a fresh container. The maintenance script is intentionally similar but is meant for cached containers that resume on a newer task branch. Both scripts use `--frozen-lockfile` once `pnpm-lock.yaml` exists and fall back to `pnpm install` until the first lockfile can be generated.

## Tool module pattern

Each Trello domain module exports an array of `defineTool(...)` definitions. Keep schemas close to handlers, parse all Trello responses with shared schemas from `src/trello/types.ts`, and let `src/trello/client.ts` be the only place that calls `fetch`.

## Pull requests

Keep changes small, include deterministic tests for error paths, and do not include secrets in logs, fixtures, commits, or PR descriptions.

## Releases

Publish releases by pushing a new semver tag in the form `vX.Y.Z`. Do not move or retag old releases.

The release workflow publishes Docker images to GHCR with these tag conventions:

| Tag | Meaning |
| --- | --- |
| `latest` | Current `main` branch image. |
| `X.Y` | Moving minor-line tag for the newest patch in that release line. |
| `X.Y.Z` | Exact release image for the pushed `vX.Y.Z` tag. |
| `sha-<commit>` | Exact commit image from the workflow run. |
