# Changelog

## v0.2.0

Core workflow completion release for boards, lists, labels, checklists, card
comments, common card relationships, and safer Compose defaults.

### Trello Tools

- Add board-level read tools for board details, board fields, cards, labels, members, memberships, and lists.
- Add list management tools to inspect, create, rename, archive, unarchive, and move Trello lists.
- Add label management tools to inspect, create, update, delete, apply, and remove labels.
- Add checklist item tools to create, list, update, check, uncheck, move, and delete checklist items.
- Add tools to add, edit, and delete Trello card comments.
- Add focused card relationship and mutation tools for card board, list, labels, due date, position, cover, and create-and-add label workflows.
- Fix `trello_card_due_date_set` so `dueComplete` can be updated without resending `due`.

### Deployment And Documentation

- Refine Docker Compose environment handling so host port, image tag, and network names are explicit Compose settings.
- Add `TRELLO_MCP_HOST_BIND_IP`, defaulting Docker Compose port publishing to `127.0.0.1` for local-only access.
- Document the project roadmap and refreshed 0.2 tool catalog.

### Runtime

- Read the MCP server version from `package.json` so server metadata stays aligned with release metadata.

## v0.1.1

Packaging metadata patch release.

- Add GHCR-supported OCI image labels for source, description, and license metadata.
- Add OCI index annotations so the package description is available on the multi-platform image.
- Add an inspectable GitHub Actions run URL to published image metadata.

## v0.1.0

Initial self-hostable Trello MCP server release.

### Trello Tools

- Discover boards visible to the authenticated Trello member.
- Read board metadata and list board lists.
- Read cards by id, short id, or Trello card URL.
- List cards in a Trello list.
- Create, update, move, archive, unarchive, and delete cards.
- List card attachments and add or remove URL attachments.
- List card checklists and create card checklists.
- List card members and add or remove members.
- Read card actions and activity.

### Runtime

- Support stdio transport for local MCP clients.
- Support Streamable HTTP transport for self-hosted/container deployments.
- Route Streamable HTTP requests by MCP session id.
- Expose `/healthz` and `/readyz` endpoints.
- Keep stdio logs on stderr so stdout stays protocol-only.
- Validate environment config, tool inputs, and Trello API responses with Zod.
- Redact Trello API credentials in logs.

### Deployment And Development

- Provide Dockerfile, published-image Compose config, and local-build Compose config.
- Publish Docker images to `ghcr.io/enthouan/trello-mcp`.
- Run build, lint, typecheck, and test coverage in GitHub Actions.
- Include Quick Start docs for Docker image use, local builds, and MCP clients.
- Include Codex setup and maintenance scripts for cloud development.
