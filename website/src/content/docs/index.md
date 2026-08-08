---
title: trello-mcp
description: A self-hosted, auditable Model Context Protocol server for broad Trello automation.
template: splash
hero:
  title: '<span class="hero-title-lockup"><img class="hero-title-mark" src="/favicon.svg" width="64" height="64" alt="" aria-hidden="true"><span class="hero-title-text">trello-mcp</span></span>'
  tagline: A self-hosted, auditable Model Context Protocol server for broad Trello automation.
  actions:
    - text: Get started
      link: /get-started/
      icon: right-arrow
    - text: View on GitHub
      link: https://github.com/enthouan/trello-mcp
      icon: external
      variant: secondary
tableOfContents: false
lastUpdated: false
---

:::caution[Independent project]
trello-mcp is an independent, community-maintained project developed by [Antoine Ménard](https://www.antoinemenard.com/). It is not an official Trello or Atlassian product, service, or MCP implementation, and it is not affiliated with, endorsed by, or sponsored by Trello or Atlassian.

Looking for Trello's official MCP server? Visit [Trello MCP](https://trello.com/mcp), hosted at `https://mcp.trello.com/v1`.
:::

## Quick Start

1. **Create Trello credentials.** Supply your own Trello API key and token; the server does not manage an OAuth lifecycle.
2. **Choose a transport.** Run the published image with Docker for Streamable HTTP, or let a local MCP client launch the built server over stdio.
3. **Connect and verify.** Point the client to `/mcp` for HTTP or the local Node entrypoint for stdio, then confirm the account with the read-only auth tools.

The [Get Started guide](/get-started/) keeps credentials, network exposure, client connection, and verification in one short path.

## What the server exposes

- Focused, schema-validated tools for boards, lists, cards, labels, checklists, comments, attachments, members, workspaces, search, and custom fields.
- Streamable HTTP for a self-hosted service and stdio for a client-managed local process.
- A generated [tool catalog](/tools/) and an explicit [API coverage matrix](/tools/api-coverage/) that distinguish supported, partial, deferred, and non-goal areas.

Client documentation keeps reviewed configuration evidence separate from direct runtime validation. See [Clients](/clients/) before choosing a setup.
