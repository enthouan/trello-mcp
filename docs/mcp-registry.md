# Official MCP Registry releases

The official Registry identity is `io.github.enthouan/trello-mcp`. It describes
the self-hosted GHCR container over stdio. This is an independent,
community-maintained project, not an official Trello or Atlassian product.
The Registry hosts metadata; GHCR hosts the executable image.

Initial publication and observed production automation are tracked in
[issue #225](https://github.com/enthouan/trello-mcp/issues/225). Docker MCP
Registry [#62](https://github.com/enthouan/trello-mcp/issues/62) and Glama
[#66](https://github.com/enthouan/trello-mcp/issues/66) are separate submissions.

## Manifest and installation

The root `server.json` uses the official `2025-12-11` schema. Its server version,
`package.json` version, `vX.Y.Z` tag, and OCI identifier
`ghcr.io/enthouan/trello-mcp:X.Y.Z` must agree. OCI carries its version in the
identifier; no separate package `version` is needed.

The entry sets `TRANSPORT=stdio` and declares `TRELLO_API_KEY` and
`TRELLO_TOKEN` as required secret inputs, without values or defaults. Each
operator supplies their own credentials using the client secret mechanism.
HTTP settings, exposed ports, upload roots, and host mounts are not part of
this installation. `card_attachment_upload` remains discoverable but needs a
separately configured upload root to operate, as documented in its tool schema.

An MCP client supporting OCI packages can launch the exact image using this
command, forwarding credentials from its secret environment:

```bash
docker run --rm -i \
  -e TRANSPORT=stdio -e TRELLO_API_KEY -e TRELLO_TOKEN \
  ghcr.io/enthouan/trello-mcp:X.Y.Z
```

Do not add `-t`: stdout carries MCP protocol messages. Do not put credentials
in `server.json`, command arguments, issues, or logs.

For release validation, the discovery command uses synthetic credentials and
`--network=none`, initializes MCP, checks the server version, and compares
`tools/list` with the release source. It never invokes a Trello tool:

```bash
corepack pnpm registry:check
docker pull ghcr.io/enthouan/trello-mcp:X.Y.Z
corepack pnpm registry:release discover ghcr.io/enthouan/trello-mcp:X.Y.Z
```

Run these from the matching release checkout. The workflow uses the verified
image digest for discovery, so the inspected and executed artifacts are the
same. A local candidate image can also be passed to `discover` before a release.

## Release preparation and publication order

Follow the [repository release skill](../.agents/skills/trello-mcp-release/SKILL.md).
The exact release PR review remains the single normal approval boundary.

1. Bump `package.json`, both version-bearing fields in `server.json`, and the
   changelog together. Run `corepack pnpm registry:check`, focused Registry
   tests, and the normal repository gates. The checked-in official schema is
   validated offline with the SDK's JSON Schema validator; local tests make no
   Registry or Trello requests.
2. Review and merge the release PR through protected `main`. Check the
   post-merge Release image job before pushing the approved annotated tag.
3. Only a `push` of a canonical stable `vX.Y.Z` tag in `enthouan/trello-mcp`
   can publish to the Registry. PRs, main pushes, prereleases, other repositories,
   and manual dispatches do not publish entries. Manual image dispatches are
   restricted to `main` and keep their existing dry-run default.
4. A read-only `release-policy` job checks out `github.sha`, freshly fetches
   `origin/main`, and rejects tags whose commits are not on main before either
   publishing job starts. All jobs use the exact event commit. The release
   scripts also require the checkout, tag target, and event SHA to agree.
5. Before building, query the exact public image. If it exists, verify its
   digest, ownership, revision, version, source, command, and both supported
   architectures and reuse it. A conflicting image stops the release. A new
   image is published only when that exact version is absent.
6. Verify anonymous GHCR access, the ownership annotation on the index and
   `io.modelcontextprotocol.server.name` label on both linux/amd64 and linux/arm64
   configurations, the image digest, and offline stdio discovery. Only successful
   verification produces the digest consumed by the Registry job.
7. The dependent `registry` job rechecks the exact image digest and production
   Registry entry. An identical active payload is success without authentication
   or republishing. Lookups include `?include_deleted=true` so a deleted version
   cannot be mistaken for an unused version. Only 404 permits publication;
   conflicting metadata, malformed responses, inactive entries, and other
   preflight HTTP errors fail closed.
8. Install the pinned official `mcp-publisher` with its checked-in SHA-256,
   run `validate server.json` against the production validation API, then
   authenticate using `login github-oidc` and publish the unchanged manifest.
   Only this job has `id-token: write`; only the image job has `packages: write`.
   No long-lived Registry secret or device login is needed for normal releases.
9. Read the exact version anonymously from the production API, compare every
   publisher field, and require active status. Ignore only the separate
   Registry-managed response envelope. The workflow summary records version,
   commit, digest, exact API URL, and publication/reuse outcome.

Workflows serialize runs for the same ref. They never intentionally replace an
existing exact release image. `latest`, minor-line, and commit tags retain their
normal release conventions for newly built images; retrying a completed image
does not move those tags backwards.

The ancestry gate verifies release lineage for this workflow. Registry OIDC
authorizes the owner's namespace, so repository write access must remain
limited to trusted maintainers. Repository tag rulesets are managed separately.

## Verification and completion evidence

From the exact release checkout:

```bash
corepack pnpm registry:release verify
gh run view <TAG_RUN_ID> --repo enthouan/trello-mcp
```

The public exact-version endpoint is:

```text
https://registry.modelcontextprotocol.io/v0.1/servers/io.github.enthouan%2Ftrello-mcp/versions/X.Y.Z
```

Record the approved PR, tag commit, successful image and Registry jobs, image
digest, exact-version API URL, complete payload comparison, discovery result,
and GitHub Release URL. Static tests and local validation do not prove a
production OIDC publication succeeded. Do not call the release complete or
close its tracking issue until that evidence exists. Close a broader milestone
only when its other acceptance criteria and issues are also complete.

## Recovery without rebuilding artifacts

- **Image succeeded; Registry failed:** inspect the failed step and exact public
  entry, then run `gh run rerun <TAG_RUN_ID> --failed --repo enthouan/trello-mcp`.
  The successful image job stays complete. The Registry job verifies its original
  digest and manifest before retrying. A full rerun also reuses the already
  published image after checking all metadata; it does not rebuild that version.
- **Publish response lost:** the script checks production even after a publisher
  error. It accepts success only if the exact active entry matches. It makes
  at most six read-back attempts with five-second pauses for an absent entry,
  network failure, HTTP 408/429, or HTTP 5xx. It never retries the write.
  Conflicts, inactive entries, malformed responses, and other HTTP errors stop
  verification immediately. Rerun the same failed job if verification remains
  inconclusive; each request also has a 30-second timeout.
- **Conflicting/inactive entry:** stop and record the exact version URL and
  differing non-secret metadata. Do not overwrite or delete the entry, move the
  tag, relabel the published image, or invent a new version just to retry.
- **Image not public or ownership metadata missing:** fix package visibility
  without rebuilding when that is the only problem. A missing ownership label
  cannot be retrofitted: prepare a real new packaging release through the normal
  PR approval process. For initial publication, `1.0.2` lacked this label;
  `1.0.3` is the first prepared candidate.
- **Workflow/publisher defect:** a rerun uses the original workflow commit, so a
  fix on `main` alone does not repair that run. Fix and review the tooling through
  a PR. If necessary, use a reviewed fixed publisher locally against the original
  tag's unmodified `server.json` and original verified image. Run
  `mcp-publisher login github --registry=https://registry.modelcontextprotocol.io`,
  pause for the maintainer's interactive device authorization, then
  `mcp-publisher publish server.json` and verify the exact payload anonymously.
  Log out afterward. Record this as manual recovery, not a successful automated
  run; leave automation verification outstanding until a genuine stable release
  exercises the corrected workflow. No fake release is needed.

## Upstream evidence and pinned tools

Requirements were checked on 2026-10-08 against official Registry revision
`970df037919faa70456dde08c295473002d850e5`:

- [Publishing guide](https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/docs/modelcontextprotocol-io/quickstart.mdx)
- [Package ownership and OCI](https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/docs/modelcontextprotocol-io/package-types.mdx)
- [Authentication](https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/docs/modelcontextprotocol-io/authentication.mdx)
- [GitHub Actions OIDC](https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/docs/modelcontextprotocol-io/github-actions.mdx)
- [Versioning](https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/docs/modelcontextprotocol-io/versioning.mdx)
- [Official JSON schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json),
  vendored in `scripts/schemas/`; original download SHA-256:
  `3fba09590c99f61735d234822279f4223fab9e300c0a81e81c91ab62a4114de0`.

The installer pins [publisher v1.8.1](https://github.com/modelcontextprotocol/registry/releases/tag/v1.8.1)
and release-asset checksums. Its OIDC implementation derives the audience from
the target Registry URL. `mcp-publisher validate server.json` uses the
production validation API and was verified successfully. Use `registry:check`
for offline schema and project-contract validation, and the publisher command
for remote validation before OIDC authentication.
Refresh the schema and publisher deliberately, with matching checksums and
tests, if upstream requirements change.

The [simplelogin-mcp automation PR #136](https://github.com/enthouan/simplelogin-mcp/pull/136),
reviewed at `4f8ab00ba7de340cbd46254f1ee637a4904bbdce`, informed the read-only
ancestry gate, deleted-version lookup, online validation, and read-back retry
policy. The [official exact-version handler](https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/internal/api/handlers/v0/servers.go)
confirms the `include_deleted` behavior. Trello retains its existing-image reuse
and offline installation checks. The reference PR is not evidence that Trello
publication has run.
