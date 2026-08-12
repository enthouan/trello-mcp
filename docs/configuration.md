# Configuration reference

`trello-mcp` reads its runtime configuration from environment variables. Two
Trello credentials are always required; transport, listener, authentication,
attachment, rate-limit, retry, and logging settings are optional.

The application itself reads `process.env` and does not automatically load a
`.env` file. Docker Compose does read the repository's `.env` file for Compose
interpolation, but it passes only the variables listed in the Compose service's
`environment` section. See [Loading environment variables](#loading-environment-variables)
before choosing where to store a setting.

> **Keep configuration private.** `TRELLO_TOKEN` grants the configured member's
> Trello access, and `MCP_AUTH_TOKEN` grants access to this server's HTTP tool
> surface. Never commit either value, paste it into an issue, or put it in a
> command that will be retained in shell history.

## Where each setting applies

The checked-in Compose files are designed for Streamable HTTP. Running them
with `TRANSPORT=stdio` leaves no MCP client attached to the process and makes
the HTTP health check fail, so use a direct child process for stdio instead.

| Setting | Direct stdio | Direct Streamable HTTP | Current Docker Compose files |
| --- | --- | --- | --- |
| `TRELLO_API_KEY`, `TRELLO_TOKEN` | Required in the child-process environment. | Required in the server environment. | Required; Compose reads and forwards both. |
| `TRANSPORT` | Set to `stdio`. | Set to `http`, or omit it for the default. | Forwarded; keep the default `http`. |
| `PORT` | Not used; stdio opens no listener. | Sets the Node HTTP listener port. | Not forwarded; the container listener remains `3000`. Use `TRELLO_MCP_HOST_PORT` for the host-side port. |
| `MCP_AUTH_TOKEN` | Not used. | Optionally protects HTTP MCP requests. | Forwarded when set. |
| `TRELLO_ATTACHMENT_UPLOAD_ROOT` | May point to an absolute path on the local machine. | May point to an absolute path on the server. | Not forwarded or mounted by the checked-in files. An override is required. |
| Rate-limit and retry variables | Supported. | Supported. | Forwarded with their defaults. |
| `LOG_LEVEL` | Supported; logs go to stderr to keep stdout protocol-only. | Supported. | Forwarded with the `info` default. |
| `TRELLO_MCP_HOST_BIND_IP`, `TRELLO_MCP_HOST_PORT`, `TRELLO_MCP_IMAGE_TAG`, `TRELLO_MCP_NETWORK` | Not used. | Not used. | Compose-only interpolation settings. |

## Required Trello credentials

| Variable | Required | Description |
| --- | --- | --- |
| `TRELLO_API_KEY` | Yes | The API key owned by the Trello app. |
| `TRELLO_TOKEN` | Yes | The token authorizing requests as a Trello member. Treat it like a password. |

Both values must be non-empty or startup fails configuration validation. Create
them with the [Trello API key guide](trello-api-key.md), then keep them in a
protected client configuration, process environment, secrets manager, or
ignored `.env` file. Never commit either value or include it in logs, URLs,
screenshots, issues, or pull requests.

For stdio, the MCP client starts `trello-mcp`, so the credentials belong in that
child process's environment. For Streamable HTTP, the credentials stay on the
server; HTTP clients receive only the MCP endpoint and, when configured, the
separate bearer secret described below.

After connecting, use the read-only `auth_whoami` and `auth_token_info` tools to
confirm the configured member and token permissions before making a write.

## Runtime and transport

| Variable | Required | Default | Accepted values and behavior |
| --- | --- | --- | --- |
| `TRANSPORT` | No | `http` | `http` starts the Streamable HTTP server. `stdio` connects over standard input/output and opens no network listener. |
| `PORT` | No | `3000` | Positive integer from `1` through `65535`. Used only by the direct HTTP listener. |
| `LOG_LEVEL` | No | `info` | `trace`, `debug`, `info`, `warn`, `error`, `fatal`, or `silent`. |

Invalid values stop startup rather than falling back silently. In stdio mode,
structured logs are written to stderr so stdout remains available to the MCP
protocol. The shared logger redacts configured credentials, authorization
headers, and URL/query fields, but secrets should still never be supplied as
ordinary prompt or tool input.

### Direct stdio example

Build the server first, then have the MCP client launch the compiled entrypoint
with this environment:

```dotenv
TRANSPORT=stdio
TRELLO_API_KEY=your-api-key
TRELLO_TOKEN=your-token
LOG_LEVEL=info
```

Use the client-specific format in [Set up your MCP client](client-setup.md). Do not
start a detached stdio process yourself; the MCP client owns its stdin and
stdout streams.

### Direct HTTP example

With a prepared `.env` file and Node.js 24:

```bash
node --env-file=.env dist/index.js
```

The default endpoints are:

```text
http://127.0.0.1:3000/mcp
http://127.0.0.1:3000/healthz
http://127.0.0.1:3000/readyz
```

`/mcp` is the only MCP route. Other non-health paths return `404`.

Those URLs use loopback from the client side, but the direct Node server does
not expose a host-bind configuration variable: it calls `listen(PORT)` without
a hostname. Use host firewall rules, container port publishing, or a properly
configured reverse proxy when the listener's network boundary matters.

## HTTP authentication and exposure

| Variable | Required | Default | Behavior |
| --- | --- | --- | --- |
| `MCP_AUTH_TOKEN` | No | Unset | When non-empty, HTTP MCP requests require `Authorization: Bearer <token>`. An empty or whitespace-only value is treated as unset. |

`MCP_AUTH_TOKEN` is created by the operator. It is separate from
`TRELLO_TOKEN`, is not sent to Trello, and has no effect in stdio mode. Configure
the same value in an HTTP client's supported bearer-header setting; the client
setup guide uses the client-side name `TRELLO_MCP_BEARER_TOKEN` to keep the two
sides of that boundary clear.

The bearer check does not protect `GET /healthz` or `GET /readyz`; those
endpoints remain unauthenticated for health checks. It also does not provide
TLS, user-specific authorization, token rotation, an IP allowlist, or a reverse
proxy. Keep local deployments bound or published to loopback. If the service
must be reachable across a network, terminate HTTPS and apply appropriate
access controls in front of it.

The checked-in Compose files publish the service on `127.0.0.1` by default.
Change `TRELLO_MCP_HOST_BIND_IP` to `0.0.0.0` only when access from every host
interface is intentional and the surrounding network controls are ready.

## Local attachment uploads

| Variable | Required | Default | Behavior |
| --- | --- | --- | --- |
| `TRELLO_ATTACHMENT_UPLOAD_ROOT` | No | Unset | Absolute server-side directory that enables `card_attachment_upload`. An empty or whitespace-only value leaves uploads disabled. |

This setting names a directory on the filesystem of the process running
`trello-mcp`; it is not a path on an HTTP client's computer. At upload time, the
directory must exist and be readable. Relative tool `filePath` values resolve
inside it, while absolute values must still resolve inside it. The server
resolves symlinks, rejects directories and missing files, and refuses files
that escape the configured root.

For a direct stdio or HTTP process, set an absolute host path:

```dotenv
TRELLO_ATTACHMENT_UPLOAD_ROOT=/Users/you/trello-uploads
```

### Current Compose limitation

The checked-in [`docker-compose.yml`](../docker-compose.yml) and
[`docker-compose.local.yml`](../docker-compose.local.yml) do not forward
`TRELLO_ATTACHMENT_UPLOAD_ROOT` and do not mount an upload directory. Adding
the variable to `.env` alone therefore does **not** enable local uploads in
Compose.

Add both a read-only mount and the container-side environment value with a
local override, for example `docker-compose.attachments.yml`:

```yaml
services:
  trello-mcp:
    environment:
      TRELLO_ATTACHMENT_UPLOAD_ROOT: /uploads
    volumes:
      - ./trello-uploads:/uploads:ro
```

Use it with the published-image Compose file:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.attachments.yml \
  up -d
```

For a source-built image, replace the first file with
`docker-compose.local.yml`. The tool receives container paths such as
`/uploads/example.pdf`, not the corresponding host path. A read-only mount is
sufficient because `trello-mcp` reads the file and uploads its bytes to Trello.

## Trello rate limiting and retries

All five values below must be positive integers. An empty value uses the
default; zero, negative, fractional, or non-numeric values fail startup.

| Variable | Default | Behavior |
| --- | --- | --- |
| `TRELLO_RATE_LIMIT_CAPACITY` | `100` | Capacity configured for the local token-bucket pacing mechanism. |
| `TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS` | `10000` | Milliseconds between full local bucket refills. |
| `TRELLO_RETRY_MAX_ATTEMPTS` | `3` | Total attempts, including the initial request, when Trello responds with HTTP `429`. |
| `TRELLO_RETRY_BASE_DELAY_MS` | `100` | Base for exponential `429` backoff and its bounded jitter. |
| `TRELLO_RETRY_MAX_DELAY_MS` | `2000` | Maximum delay before any one `429` retry. |

The local bucket runs before each Trello request and is intended to pace this
server's outbound work. It is not a strict distributed quota and does not
replace Trello's server-side account or token limits, especially under
concurrent workloads. The retry policy applies to HTTP `429` responses; it does
not retry every network or server error.

Keep the defaults unless real workload evidence shows a need to tune them.
First narrow broad workflows with smaller result limits, specific boards or
lists, requested fields, search filters, and pagination. Lower the capacity for
a shared token or deliberately gentler automation. Raising the capacity can
make a broad workflow reach Trello's server-side limit faster.

At `LOG_LEVEL=debug`, local bucket waits are logged as
`trello rate limit wait`. HTTP `429` retries are logged at warn level as
`trello request rate limited; retrying`. These records contain safe operational
metadata rather than credentials or request URLs.

## Docker Compose settings

The default [`docker-compose.yml`](../docker-compose.yml) runs the published
image. [`docker-compose.local.yml`](../docker-compose.local.yml) builds the
current source as `trello-mcp:local`. Both keep the container's HTTP listener
on port `3000` and publish it to a configurable host address and port.

| Variable | Default | Compose behavior |
| --- | --- | --- |
| `TRELLO_MCP_HOST_BIND_IP` | `127.0.0.1` | Host interface used for the published container port. Compose-only. |
| `TRELLO_MCP_HOST_PORT` | `3000` | Host port mapped to container port `3000`. Compose-only. |
| `TRELLO_MCP_IMAGE_TAG` | `latest` | Tag appended to `ghcr.io/enthouan/trello-mcp` by `docker-compose.yml`. Not used by the local-build file. |
| `TRELLO_MCP_NETWORK` | `trello-mcp_network` | Name of the Compose bridge network. Compose-only. |

Compose also forwards `TRANSPORT`, `LOG_LEVEL`, `MCP_AUTH_TOKEN`, and all five
rate-limit/retry variables. It does not forward `PORT`; setting `PORT` in
`.env` does not change the container listener. Set `TRELLO_MCP_HOST_PORT`
instead.

### Published image tags

| Tag | Update behavior | Recommendation |
| --- | --- | --- |
| `latest` | Follows the current `main` branch image. | Use only when intentionally tracking the newest main build. |
| `X.Y` | Follows the newest patch release in that minor line. | Useful for automatic patch updates. |
| `X.Y.Z` | Pins one exact release. | Recommended for reproducible deployments. |
| `sha-<commit>` | Pins the image built for one commit. | Useful for audit trails and debugging. |

For example:

```dotenv
TRELLO_MCP_HOST_BIND_IP=127.0.0.1
TRELLO_MCP_HOST_PORT=3000
TRELLO_MCP_IMAGE_TAG=0.8.1
TRELLO_MCP_NETWORK=trello-mcp_network
```

The image is `ghcr.io/enthouan/trello-mcp:<tag>`. Prefer an available exact
`X.Y.Z` tag for production rather than copying the example version indefinitely.

## Loading environment variables

### Direct Node process

`trello-mcp` has no dotenv loader. Export variables in the parent shell, let an
MCP client pass them to its stdio child, use a process manager or secrets
provider, or use Node.js 24's `--env-file` flag:

```bash
node --env-file=.env dist/index.js
```

Running `node dist/index.js`, `corepack pnpm start`, or `corepack pnpm dev`
without exported variables does not read `.env` automatically.

### Docker Compose

Docker Compose reads `.env` from the project directory for `${...}`
interpolation. Start from the sanitized template:

```bash
cp .env.example .env
```

Replace the credential placeholders, keep `.env` out of source control, and
then run the selected Compose file. A value in `.env` reaches the container only
when the Compose service explicitly includes it under `environment` (or an
override adds it). This distinction is why `TRELLO_ATTACHMENT_UPLOAD_ROOT` and
`PORT` behave differently from the variables that the checked-in files forward.

## Minimal configuration by deployment

### MCP client launching a local stdio server

```dotenv
TRANSPORT=stdio
TRELLO_API_KEY=your-api-key
TRELLO_TOKEN=your-token
```

### Direct Streamable HTTP server

```dotenv
TRANSPORT=http
PORT=3000
TRELLO_API_KEY=your-api-key
TRELLO_TOKEN=your-token
MCP_AUTH_TOKEN=use-a-separate-strong-secret
```

Omit `MCP_AUTH_TOKEN` only when unauthenticated MCP access is appropriate for
the listener's network boundary.

### Published image with Compose

```dotenv
TRELLO_API_KEY=your-api-key
TRELLO_TOKEN=your-token
TRANSPORT=http
MCP_AUTH_TOKEN=use-a-separate-strong-secret
TRELLO_MCP_HOST_BIND_IP=127.0.0.1
TRELLO_MCP_HOST_PORT=3000
TRELLO_MCP_IMAGE_TAG=0.8.1
```

Continue with [Set up your MCP client](client-setup.md), or compare the complete
startup commands in the [README quick start](../README.md#quick-start).
