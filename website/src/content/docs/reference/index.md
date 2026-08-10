---
title: Reference
description: Repository, policy, support, documentation-source, live-validation, release, and roadmap resources for trello-mcp.
---

Use this overview to find the source, policies, support paths, and maintainer references behind the public documentation.

## Repository and releases

- [GitHub repository](https://github.com/enthouan/trello-mcp) — source code and repository documentation.
- [Releases](https://github.com/enthouan/trello-mcp/releases) — published versions and release notes.
- [Changelog](https://github.com/enthouan/trello-mcp/blob/main/CHANGELOG.md) — version-by-version project changes.
- [Issues](https://github.com/enthouan/trello-mcp/issues) — bugs, focused feature requests, and documentation fixes.
- [Roadmap](https://trello.com/b/GnKmvuHz/trello-mcp) — the public Trello board used to track project direction.
- [MIT License](https://github.com/enthouan/trello-mcp/blob/main/LICENSE) — reuse and distribution terms.
- [`llms.txt`](/llms.txt) — a generated, machine-readable index of the public documentation.

## Policies and help

- [Security & Data](/security/) — runtime boundaries, credentials, transports, logs, attachment uploads, and safer tool use.
- [FAQ](/faq/) — hosting, official status, transport choice, Trello access, destructive tools, privacy, and support.
- [Contributing](/reference/contributing/) — local checks, tool patterns, pull requests, and release conventions.
- [Reporting issues and support](/reference/support/) — best-effort support channels, boundaries, and useful report context.
- [Security policy](/reference/security-policy/) — supported versions, private reporting guidance, credential handling, and threat-model notes.
- [Privacy policy](https://github.com/enthouan/trello-mcp/blob/main/PRIVACY.md) — data processed by a self-hosted deployment and operator responsibilities.

Use the private path described in the [security policy](/reference/security-policy/) for vulnerability details. Ordinary bugs and documentation problems belong in the [support and issue-reporting path](/reference/support/). Never include Trello credentials, bearer tokens, private Trello data, credential-bearing URLs, unredacted logs, or sensitive local paths in a public report.

## Documentation sources

Long-form project documentation under [`docs/`](https://github.com/enthouan/trello-mcp/tree/main/docs) remains canonical. The client setup, compatibility, Trello API key, How it works, workflows, troubleshooting, configuration, and API coverage pages are generated from those sources through `corepack pnpm docs:tools`.

The Contributing, Reporting issues and support, and Security policy pages are generated from the repository-root `CONTRIBUTING.md`, `SUPPORT.md`, and `SECURITY.md` files. The tool catalog is generated from the same `allTools` definitions and Zod schemas used by the server and README catalog. Generated website pages should be changed through their canonical source rather than edited independently.

## Live validation

Normal tests and website checks are offline and do not require Trello credentials. The opt-in live smoke and regression suites are guarded maintainer workflows for a confirmed disposable Trello board; they are not a first-run verification step. Follow the [live validation instructions](https://github.com/enthouan/trello-mcp/blob/main/README.md#live-trello-smoke-tests) before running either suite.

## Independent project and official alternative

`trello-mcp` is an independent, community-maintained project. It is not an official Trello or Atlassian product, service, or MCP implementation, and it is not affiliated with, endorsed by, or sponsored by Trello or Atlassian.

For Trello's official hosted service, visit [Trello MCP](https://trello.com/mcp) and use the endpoint documented by Trello: `https://mcp.trello.com/v1`.
