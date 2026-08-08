---
title: Project
description: Repository, policy, support, release, contribution, and roadmap resources for trello-mcp.
---

`trello-mcp` is a self-hosted open source project with best-effort community support. The maintainers do not operate a hosted Trello MCP service for this repository.

## Project resources

- [GitHub repository](https://github.com/enthouan/trello-mcp) — source code and repository documentation.
- [Releases](https://github.com/enthouan/trello-mcp/releases) — published versions and release notes.
- [Changelog](https://github.com/enthouan/trello-mcp/blob/main/CHANGELOG.md) — version-by-version project changes.
- [Issues](https://github.com/enthouan/trello-mcp/issues) — bugs, focused feature requests, and documentation fixes.
- [Roadmap](https://trello.com/b/GnKmvuHz/trello-mcp) — the public Trello board used to track project direction.

## Policies and help

- [Security](https://github.com/enthouan/trello-mcp/blob/main/SECURITY.md) — supported versions, private reporting guidance, credential handling, and threat-model notes.
- [Privacy](https://github.com/enthouan/trello-mcp/blob/main/PRIVACY.md) — data processed by a self-hosted deployment and operator responsibilities.
- [Support](https://github.com/enthouan/trello-mcp/blob/main/SUPPORT.md) — best-effort support channels, boundaries, and useful report context.
- [Contributing](https://github.com/enthouan/trello-mcp/blob/main/CONTRIBUTING.md) — local checks, tool patterns, pull requests, and release conventions.
- [MIT License](https://github.com/enthouan/trello-mcp/blob/main/LICENSE) — reuse and distribution terms.

Do not include Trello credentials, bearer tokens, private Trello data, credential-bearing URLs, unredacted logs, or sensitive local paths in public issues or pull requests. Use the private path described in the security policy for vulnerability details.

## Documentation sources

The website's client content is generated from the available canonical client sources, with compatibility evidence kept separate from setup instructions. The tool catalog is generated from the same `allTools` definitions used by the server and README catalog. The [API coverage matrix](/tools/api-coverage/) records deliberate gaps without implying that the server mirrors the entire Trello REST API.

## Live validation

Normal tests and website checks are offline and do not require Trello credentials. The opt-in live smoke and regression suites are maintainer workflows for a confirmed disposable Trello board; they are not a first-run verification step. Follow the guarded [live validation instructions](https://github.com/enthouan/trello-mcp/blob/main/README.md#live-trello-smoke-tests) before running either suite.

## Official Trello MCP

This community project is distinct from Trello's official hosted MCP server. For the official service, visit [Trello MCP](https://trello.com/mcp) and use the endpoint documented by Trello: `https://mcp.trello.com/v1`.
