# Changelog

## Unreleased

- Add tools to add, edit, and delete Trello card comments.

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
