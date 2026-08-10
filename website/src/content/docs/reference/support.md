---
title: "Reporting issues and support"
description: "Choose the right support channel and prepare a useful, sanitized trello-mcp bug report."
editUrl: "https://github.com/enthouan/trello-mcp/edit/main/SUPPORT.md"
---

`trello-mcp` is a self-hosted open source project with best-effort community support.

## Support Channels

- Use GitHub issues for bugs, documentation fixes, feature requests, and reproducible behavior in this repository.
- Use the reporting path in [SECURITY.md](/reference/security-policy/) for vulnerabilities or reports that require private details.
- Use Atlassian or Trello support channels for Trello account access, billing, workspace administration, API availability, credential generation, rate limits enforced by Trello, or Trello product behavior outside this repository.

## Support Boundaries

Support is best effort. There is no service-level agreement, guaranteed response time, emergency support channel, or guarantee that a maintainer can debug private deployments.

The maintainers may ask for a minimal reproduction against the latest release or `main`, sanitized logs, exact commands, or a smaller Trello workflow before investigating. Private deployments, reverse proxies, host firewalls, MCP client behavior, custom Docker setups, and local filesystem permissions may need to be debugged by the operator.

This project is independent and unofficial. It is not affiliated with, endorsed by, sponsored by, or operated by Trello or Atlassian.

## Bug Report Context

Helpful bug reports include:

- `trello-mcp` version, commit, branch, or Docker image tag.
- Installation method, such as published Docker image, local Docker build, or local Node process.
- Node.js and pnpm versions for local development issues.
- Transport mode (`http` or `stdio`).
- MCP client name and version when the issue depends on client behavior.
- Relevant configuration names, such as whether `MCP_AUTH_TOKEN` or `TRELLO_ATTACHMENT_UPLOAD_ROOT` is enabled, without including secret values.
- Exact command or tool call shape when it can be shared safely.
- Expected behavior, actual behavior, and sanitized logs or error messages.

Before posting, redact:

- Trello API keys, Trello tokens, MCP bearer tokens, and authorization headers.
- Private board, card, checklist, comment, attachment, member, workspace, or custom field data.
- Credential-bearing URLs and full query strings.
- `.env` files, raw environment dumps, and unredacted logs.
- Local file paths or screenshots that reveal private deployment details.
