# Contributing

## Local checks

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:coverage
pnpm build
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
