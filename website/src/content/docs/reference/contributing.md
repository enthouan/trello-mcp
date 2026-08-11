---
title: "Contributing"
description: "Run the project checks, update canonical documentation, follow the Trello tool pattern, and prepare focused contributions safely."
---

## Local checks

Use Node.js 24.x with the pinned pnpm version from `package.json`.

```bash
corepack enable
corepack prepare pnpm@10.34.1 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:coverage
corepack pnpm build
corepack pnpm docs:check
corepack pnpm site:check
corepack pnpm website:build
corepack pnpm exec playwright install --with-deps chromium
corepack pnpm site:test
```

## Documentation website

The public documentation site uses Astro Starlight under `website/`. Canonical
long-form project documentation remains in `docs/`; the checked-in website
copies and tool catalog are generated deterministically.

```bash
corepack pnpm docs:tools
corepack pnpm website:dev
```

Every website build targets the canonical origin `https://trello-mcp.com/` and
includes production canonical metadata. To inspect the built artifact locally:

```bash
corepack pnpm website:build
corepack pnpm website:preview
```

Cloudflare Pages should run `corepack pnpm website:build` and publish
`website/dist`. The canonical URL is built in, so no website environment
variable is required.

The normal pull-request gate uses Chromium with screenshots retained only on
failure. Run `corepack pnpm site:visual` for the smaller desktop/mobile,
light/dark design matrix, or `corepack pnpm site:lighthouse` when a release or
substantial layout change needs an explicit performance audit.

Before changing generated website pages, update their canonical source or
`src/trello/tools.ts`, then run `corepack pnpm docs:tools`. Use
`corepack pnpm docs:check` to confirm the generated output is current.


## Codex cloud setup

When configuring a Codex cloud environment, use:

- Setup script: `./scripts/codex/setup.sh`
- Maintenance script: `./scripts/codex/maintenance.sh`

The setup script prepares pnpm and installs dependencies for a fresh container. The maintenance script is intentionally similar but is meant for cached containers that resume on a newer task branch. Both scripts use `--frozen-lockfile` once `pnpm-lock.yaml` exists and fall back to `pnpm install` until the first lockfile can be generated.

## Tool module pattern

Each Trello domain module exports an array of `defineTool(...)` definitions. Keep schemas close to handlers, parse all Trello responses with shared schemas from `src/trello/types.ts`, and let `src/trello/client.ts` be the only place that calls `fetch`.

## Pull requests

Keep changes small, include deterministic tests for error paths, and do not include secrets in issues, pull requests, logs, fixtures, commits, screenshots, or generated docs.

## Security-sensitive reports

Follow [SECURITY.md](/reference/security-policy/) for vulnerabilities or reports that need private details. Do not post Trello API keys, Trello tokens, `MCP_AUTH_TOKEN` values, authorization headers, private board or card data, credential-bearing URLs, raw environment dumps, unredacted logs, or sensitive local file paths in public issues or pull requests.

## Releases

Publish releases by pushing a new semver tag in the form `vX.Y.Z`. Do not move or retag old releases.

The release workflow publishes Docker images to GHCR with these tag conventions:

| Tag | Meaning |
| --- | --- |
| `latest` | Current `main` branch image. |
| `X.Y` | Moving minor-line tag for the newest patch in that release line. |
| `X.Y.Z` | Exact release image for the pushed `vX.Y.Z` tag. |
| `sha-<commit>` | Exact commit image from the workflow run. |
