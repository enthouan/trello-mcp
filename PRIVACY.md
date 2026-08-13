# Privacy

`trello-mcp` is a self-hosted open source MCP server. The project maintainers do not operate a hosted Trello MCP service for this repository, do not receive runtime Trello data from your deployment, and do not collect telemetry from your deployment.

## Data The Server Processes

Depending on the tools you use and how you deploy the server, `trello-mcp` may process:

- Trello object data returned by the Trello API, including boards, lists, cards, labels, attachments, checklists, comments, actions, members, workspaces, and custom fields that your configured Trello token can access.
- MCP client requests and tool inputs, including Trello ids, URLs, names, comments, descriptions, search terms, and requested output fields.
- Optional local attachment upload paths and file bytes when `TRELLO_ATTACHMENT_UPLOAD_ROOT` is configured and an MCP client calls an upload tool.
- Runtime logs, including operational metadata and sanitized error information. Logs should not include Trello credentials, bearer tokens, raw credential-bearing URLs, raw environment objects, or private Trello content.
- Configuration values supplied by the operator, including Trello credentials and optional MCP bearer tokens.

## External Services

Normal runtime operation sends Trello API requests to Trello over HTTPS using the Trello API key and token supplied by the operator.

Other external services are part of repository, distribution, or development workflows rather than hosted application telemetry:

- GHCR may be contacted when you pull the published Docker image.
- GitHub is used for repository hosting, releases, issues, pull requests, Actions workflows, and project coordination.

When you visit the project website, your browser may make one best-effort, unauthenticated request to GitHub's public repository API to display the current star count beside the repository link in the site navigation. GitHub receives the ordinary metadata needed to serve that request, such as your IP address, user agent, request time, requested API URL, and browser-supplied Origin/CORS information. The request uses `credentials: "omit"` and `referrerPolicy: "no-referrer"`, so it sends no project GitHub credential, browser credential, cookie, or page referrer. An attempt marker is stored in `sessionStorage` before the request starts and replaced with the validated count on success, so navigation or failures do not cause repeated GitHub requests during the current browser session; failures leave the static GitHub link unchanged.

Do not paste private Trello data, secrets, unredacted logs, or sensitive screenshots into public GitHub issues, pull requests, discussions, or comments.

## Operator Control

Users and operators control:

- Their own Trello API key and token.
- Their MCP client and client configuration.
- Whether the server runs over stdio or Streamable HTTP.
- Whether HTTP bearer auth is configured with `MCP_AUTH_TOKEN`.
- Whether local attachment uploads are enabled.
- The hosting environment, network exposure, reverse proxy, TLS termination, firewall rules, container runtime, mounted volumes, and log retention.

Because this is self-hosted software, privacy depends on the operator's deployment choices. Review your MCP client, hosting provider, reverse proxy, logging system, backup system, and Trello account permissions before using the server with private boards or sensitive card data.

## Public Project Spaces

GitHub issues and pull requests are public unless GitHub indicates otherwise. Redact or omit:

- Trello API keys, Trello tokens, MCP bearer tokens, and authorization headers.
- Private board, card, checklist, comment, attachment, member, workspace, or custom field data.
- Credential-bearing URLs and full query strings.
- `.env` files, raw environment dumps, and unredacted logs.
- Local file paths or screenshots that reveal private deployment details.

For vulnerability reports, follow [SECURITY.md](SECURITY.md).

This project is independent and unofficial. It is not affiliated with, endorsed by, sponsored by, or operated by Trello or Atlassian.
