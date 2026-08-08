---
title: Get Started
description: Configure Trello credentials, run trello-mcp with Docker or local stdio, connect a client, and verify the setup safely.
---

:::caution[Independent project]
trello-mcp is an independent, community-maintained project developed by [Antoine Ménard](https://www.antoinemenard.com/). It is not an official Trello or Atlassian product, service, or MCP implementation, and it is not affiliated with, endorsed by, or sponsored by Trello or Atlassian.

Looking for Trello's official MCP server? Visit [Trello MCP](https://trello.com/mcp), hosted at `https://mcp.trello.com/v1`.
:::

## Before you begin

This server uses a Trello API key and token supplied by the operator. Follow Trello's official [REST API getting started guide](https://support.atlassian.com/trello/docs/getting-started-with-trello-rest-api/) to create them.

Treat both values like passwords. Do not commit them, put them in screenshots, paste them into issue reports, or include them in logs.

Choose one run mode:

- **Docker with Streamable HTTP** is the straightforward path for a container or service.
- **Local stdio** is the straightforward path when an MCP client launches the server on the same machine.

## Docker: Streamable HTTP

Clone the repository and create a local environment file:

```bash
git clone https://github.com/enthouan/trello-mcp.git
cd trello-mcp
cp .env.example .env
```

Set the required values in `.env` and keep the default loopback bind:

```dotenv
TRELLO_API_KEY=your-api-key
TRELLO_TOKEN=your-token
TRANSPORT=http
TRELLO_MCP_HOST_BIND_IP=127.0.0.1
```

Start the published image:

```bash
docker compose up -d
```

Configure a Streamable HTTP client to use:

```text
http://localhost:3000/mcp
```

If you set `MCP_AUTH_TOKEN`, configure the client to send `Authorization: Bearer <token>` on every MCP request.

:::danger[Protect HTTP deployments]
Keep `TRELLO_MCP_HOST_BIND_IP=127.0.0.1` for local-only access. Expose the server to a network only intentionally, and add HTTPS plus suitable reverse-proxy authentication or equivalent access control. `MCP_AUTH_TOKEN` is a shared-secret guardrail; it does not replace transport security.
:::

## Local stdio

Local source builds require Node.js 24 and the repository's pinned pnpm version:

```bash
git clone https://github.com/enthouan/trello-mcp.git
cd trello-mcp
corepack enable
corepack prepare pnpm@10.34.1 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

Configure the MCP client to launch the compiled entrypoint with `TRANSPORT=stdio` and the two Trello credentials:

```json
{
  "mcpServers": {
    "trello": {
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "TRELLO_API_KEY": "your-api-key",
        "TRELLO_TOKEN": "your-token"
      }
    }
  }
}
```

Protect the client configuration because it contains credentials. The server writes stdio logs to stderr so stdout remains reserved for the MCP protocol.

## Connect a client

Client configuration shapes and support vary. Use the [Clients guide](/clients/) for client-specific setup status, evidence, and limitations before treating a reviewed setup as directly validated.

For HTTP clients, use the `/mcp` endpoint. `/healthz` and `/readyz` are operational checks, not MCP endpoints.

## Verify safely

For Docker or another HTTP deployment, check the local process first:

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
```

These endpoints confirm health and readiness; they do not validate the Trello credentials.

From the connected MCP client, run the read-only `auth_whoami` tool to confirm the authenticated Trello member. Use the read-only `auth_token_info` tool when you also need the token owner, expiration, and permission metadata.

Do not use write tools for initial verification, and do not run the repository's opt-in live smoke or regression suites against a real working board. Those maintainer workflows require a disposable board and separate safety gates.

## Next steps

- Browse the generated [tool catalog](/tools/).
- Review intentional gaps in [API coverage](/tools/api-coverage/).
- Read the [project security policy](https://github.com/enthouan/trello-mcp/blob/main/SECURITY.md) before exposing HTTP beyond the local machine.
