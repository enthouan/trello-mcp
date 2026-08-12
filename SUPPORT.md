# Support

`trello-mcp` is a self-hosted open source project with best-effort community support.

## Choose the right channel

| Situation | Where to go |
| --- | --- |
| Reproducible server bug, documentation problem, or focused feature request | Open a GitHub issue in this repository. |
| Vulnerability, credential exposure, authentication bypass, or a report that requires private details | Follow [SECURITY.md](SECURITY.md) and use GitHub private vulnerability reporting. Do not open a public issue. |
| Trello account access, billing, Workspace administration, credential generation, upstream API availability, or Trello-enforced rate limits | Use the official Atlassian or Trello support channel. |
| Reverse proxy, TLS, firewall, custom container platform, or private-host networking problem | Start with the platform or network operator. This project can document its interfaces, but cannot support every deployment stack. |

## Prepare a useful report

1. **Check the focused documentation first.** Review the README, the website's
   troubleshooting and FAQ pages, the current tool catalog, and API coverage.

2. **Identify the exact environment.** Include the `trello-mcp` version, commit,
   branch, or Docker image tag; installation method; Node.js and pnpm versions
   for source builds; transport; and MCP client name and version when relevant.

3. **Reduce the problem to a safe reproduction.** Include the exact command or
   tool-call shape when it can be shared, the expected behavior, the actual
   behavior, and the smallest sanitized error or log excerpt that demonstrates
   the problem.

4. **Describe configuration without exposing values.** Name relevant settings,
   such as whether `MCP_AUTH_TOKEN` or `TRELLO_ATTACHMENT_UPLOAD_ROOT` is
   enabled, but replace every credential, identifier, private Trello value, and
   local path with a clear placeholder.

5. **State what you already tried.** Note whether the problem reproduces on the
   latest release or current `main`, whether a client restart changed the
   result, and which troubleshooting checks passed or failed.

## Security reports

Do not open a public issue for vulnerabilities, credential leaks,
authentication bypasses, or exposure problems. Follow
[SECURITY.md](SECURITY.md) and use GitHub private vulnerability reporting from
the repository's Security tab. If that action is unavailable, do not publish
sensitive details in an issue or discussion.

## Support boundaries

Support is best effort. There is no service-level agreement, guaranteed response time, emergency support channel, or guarantee that a maintainer can debug private deployments.

The maintainers may ask for a minimal reproduction against the latest release or `main`, sanitized logs, exact commands, or a smaller Trello workflow before investigating. Private deployments, reverse proxies, host firewalls, MCP client behavior, custom Docker setups, and local filesystem permissions may need to be debugged by the operator.

This project is independent and unofficial. It is not affiliated with, endorsed by, sponsored by, or operated by Trello or Atlassian.
