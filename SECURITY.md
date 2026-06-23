# Security Policy

## Supported Versions

`trello-mcp` is a pre-1.0 project. Unless a maintainer states otherwise, security fixes are supported for:

| Version | Support |
| --- | --- |
| `main` | Supported for current development and review. |
| Latest published release | Supported for normal self-hosted deployments. |
| Older pre-1.0 releases | Best effort only. Upgrade to the latest release or `main` before reporting deployment-specific issues where practical. |

## Reporting A Vulnerability

Do not post secrets, exploit details, private Trello data, unredacted logs, or sensitive local file paths in public GitHub issues, pull requests, discussions, screenshots, or comments.

Preferred reporting path:

1. Use GitHub private vulnerability reporting from this repository's Security tab if it is available.
2. If private vulnerability reporting is unavailable, open a public GitHub issue with only a short non-sensitive summary, such as "I need to report a security issue affecting HTTP auth", and ask for a private reporting path. Do not include reproduction details or private data in that public issue.

Useful report context includes:

- Affected version, commit, Docker image tag, or branch.
- Transport mode (`http` or `stdio`) and deployment shape, such as local process, Docker Compose, reverse proxy, or hosted VM.
- Whether `MCP_AUTH_TOKEN` and `TRELLO_ATTACHMENT_UPLOAD_ROOT` are enabled.
- A minimal redacted reproduction or proof of impact.
- Sanitized logs with credentials, query strings, Trello object data, authorization headers, and sensitive file paths removed.

If a credential or private Trello object was exposed, rotate or revoke the affected credential in Trello or your own deployment immediately. The maintainers cannot rotate user-provided Trello credentials or operator-managed MCP auth tokens.

## Sensitive Data

Treat all of the following as sensitive:

- `TRELLO_API_KEY` and `TRELLO_TOKEN`.
- `MCP_AUTH_TOKEN` and HTTP `Authorization` headers.
- Trello URLs or request URLs that include `key`, `token`, or other auth query parameters.
- Private board names, card titles, descriptions, comments, attachments, checklist data, member data, workspace data, and custom field values.
- Unredacted logs, raw environment dumps, MCP request payloads, and response bodies.
- Local file paths and file contents used with attachment uploads.

## Threat Model Basics

`trello-mcp` is a self-hosted MCP server. Operators choose where it runs, which MCP clients can reach it, which Trello credentials it receives, and which logs or volumes are retained.

The server uses user-provided Trello API key and token credentials. Trello permissions and board visibility determine what the server can read or mutate through the Trello API. The server sends Trello API requests over HTTPS and does not manage OAuth redirects, token creation, token refresh, or token revocation.

For Streamable HTTP deployments, `MCP_AUTH_TOKEN` adds a simple bearer-token check for `/mcp` requests when configured. It is not a replacement for TLS, reverse-proxy authentication, IP allowlists, careful host binding, firewall rules, or other deployment controls. Health and readiness endpoints are intended for container and proxy checks and do not require this bearer token.

For stdio deployments, the local MCP client launches the server process and provides environment variables. Protect the client configuration and shell environment like any other credential store.

Local attachment uploads are disabled unless `TRELLO_ATTACHMENT_UPLOAD_ROOT` is configured. When enabled, MCP clients provide a file path on the server host or inside the container; the server reads that file and uploads the bytes to Trello only after path validation. Operators are responsible for the mounted upload directory, file permissions, and cleanup of sensitive files.

Docker and self-hosted deployments inherit the security posture of the host, container runtime, network, reverse proxy, secrets manager, and log storage. Do not publish the service beyond trusted networks unless you have added appropriate transport security and access control.

## Credential Handling And Redaction

Project code should keep credential handling centralized and should not log:

- Trello credentials.
- MCP bearer tokens.
- Raw environment objects.
- Full request URLs or query strings that may include credentials.
- Raw request or response bodies that may include private Trello data.

Logs are expected to redact `TRELLO_API_KEY`, `TRELLO_TOKEN`, `MCP_AUTH_TOKEN`, authorization headers, and common key/token field names. When adding new logging, prefer structured metadata such as request id, tool name, resource type, resource id, duration, status, or error type, and keep private Trello content out of log fields.

Do not commit `.env` files, real Trello ids from private boards, private card content, unredacted logs, credentials, or screenshots containing sensitive data.

## Out Of Scope

This policy covers vulnerabilities in this repository. Trello account recovery, Atlassian service availability, Trello API outages, Trello permission model issues, GitHub account security, and private deployment incident response should be handled with the relevant service provider or operator.

This project is independent and unofficial. It is not affiliated with, endorsed by, sponsored by, or operated by Trello or Atlassian.
