# Docker MCP Registry readiness

Last verified: **2026-08-23**

Decision: submit `trello-mcp` as a **Docker-built local server** with the
registry image name `mcp/trello-mcp`. Keep the existing GHCR image as a viable
self-provided fallback, but do not treat the two paths as having the same
Docker-managed supply-chain guarantees.

## Scope and evidence snapshot

This document began as the requirements audit in
[issue #57](https://github.com/enthouan/trello-mcp/issues/57) and now records
the validated `server.yaml` metadata draft completed by
[issue #58](https://github.com/enthouan/trello-mcp/issues/58). It does not
generate `tools.json`, initiate Docker Desktop/Toolkit or manual live Trello
validation, change the release workflow, open an external registry pull
request, submit credentials, or claim that Docker Registry acceptance or
supply-chain readiness is complete.

| Source | Audited revision | Why it matters |
| --- | --- | --- |
| Docker MCP Registry `main` | [`8c773729f13f036da8c909be503fe433923a9aa2`](https://github.com/docker/mcp-registry/tree/8c773729f13f036da8c909be503fe433923a9aa2) | Refreshed commit-pinned source for every upstream requirement and example below. |
| `trello-mcp` source pin | [`06b5b3a6151be516bb92f746dad06b797c1f2bf1`](https://github.com/enthouan/trello-mcp/commit/06b5b3a6151be516bb92f746dad06b797c1f2bf1) | Exact Dockerfile, package lock, Node.js 24 runtime, and configuration snapshot selected for the metadata draft. |
| `trello-mcp` release | [`v1.0.0`](https://github.com/enthouan/trello-mcp/releases/tag/v1.0.0) | Current release when this audit was performed. |

The refreshed upstream revision is exactly the `8c773729` planning baseline and
is two commits beyond the `fd36a38a` revision audited by #57. Those commits
changed only `servers/circleci/server.yaml` and the adjacent CircleCI
`readme.md` and `tools.json`; the server schema, validator, formatting rule,
contribution guide, CI workflow, pull request template, and relevant local
examples did not change.

The upstream snapshot includes two local-server paths: Docker's recommended
Docker-built path and a self-provided image path. Its contribution guide also
defines the local validation commands, credential form, and review process
([registry overview][registry-readme], [contribution process][registry-contributing],
[pull request template][registry-pr-template]). The upstream repository can
change independently. This refresh satisfies #58's metadata-stage audit; #62
must re-fetch `main`, record the then-current SHA, and re-audit any changed
requirements before opening the external pull request.

## Final issue #58 metadata decisions

The draft lives at [`servers/trello-mcp/server.yaml`](../servers/trello-mcp/server.yaml).
It pins `06b5b3a6151be516bb92f746dad06b797c1f2bf1` because that revision was the
current `origin/main` when #58 began and contains the exact root `Dockerfile`,
`package.json`, `pnpm-lock.yaml`, Node.js 24 runtime, stdio configuration, and
Trello client being submitted. The commits after the #57 source snapshot added
the registry audit, updated pinned GitHub Actions, and refreshed development and
website dependencies; none changed the Dockerfile, runtime configuration, or
Trello API host. Pinning the pre-metadata revision is intentional because the
metadata file does not need to reference its own commit. Issue #62 must refresh
the source pin immediately before opening the external submission.

The selected icon is `https://trello-mcp.com/favicon.svg`. A read-only check on
2026-08-23 returned HTTP 200 with `Content-Type: image/svg+xml` and a 341-byte
body, well below the upstream 2 MiB limit. The response was byte-identical to
the checked-in [`website/public/favicon.svg`](../website/public/favicon.svg)
(SHA-256 `2f4cf274720370127eeddf5b5fc512dbd6b938142a071179faf0208e93d31cd5`).
The canonical project domain and checked-in source make this more durable than
an unrelated favicon proxy. The refreshed validator accepts SVG icons; #62 must
recheck the URL, content type, size, and bytes immediately before submission.

The entry fixes `TRANSPORT=stdio`, so the process opens no HTTP listener and
`PORT` is intentionally omitted. `MCP_AUTH_TOKEN` is also HTTP-only. The
attachment upload root and a host volume remain omitted because the initial
registry runtime has no safe mount; issue #59 consequently owns excluding only
`card_attachment_upload` from `tools.json`. Rate-limit and retry settings keep
their application defaults.

## Submission path decision

### Choose the Docker-built path

The initial entry should use `image: mcp/trello-mcp` and let Docker build the
image from a pinned public `trello-mcp` commit and its root `Dockerfile`.
Docker identifies this as the recommended path and says Docker-built images
receive Docker-managed builds, signing, provenance, SBOMs, automatic security
updates, and post-acceptance publishing in the Docker Hub `mcp` namespace
([path comparison][registry-readme], [local build guidance][registry-build-path]).

Those are upstream-stated path benefits, not evidence that a particular
`trello-mcp` artifact already has them. [Issue #61](https://github.com/enthouan/trello-mcp/issues/61)
must define the pre-submission trust plan, then inspect the artifacts Docker
actually produces after acceptance and document the realized trust and update
model before the project claims supply-chain readiness.

### Path comparison

| Concern | Docker-built (selected) | Self-provided GHCR fallback |
| --- | --- | --- |
| Registry image | `mcp/trello-mcp` | `ghcr.io/enthouan/trello-mcp@sha256:<digest>`; a release tag may accompany it only as a human-readable label |
| Build input | Public repository, root `Dockerfile`, exact `source.commit` | Existing published image plus the same public source pin |
| Maintenance | Docker builds and handles registry updates from pinned source revisions | This repository remains responsible for building, publishing, updating, and proving the image |
| Docker-managed trust | Docker states that its build path adds signing, provenance, SBOMs, and automatic security updates | Upstream explicitly says self-built images do not receive those enhanced Docker-built guarantees |
| Local command | `task build -- --tools trello-mcp` | CI uses the community-image pull path; a local check requires the upstream equivalent of `task build -- --tools --pull-community trello-mcp` |
| Evidence that the path is supported | Docker-built Notion entry: [`image: mcp/notion`][registry-notion] | Self-provided Supadata entry: [`image: ghcr.io/supadata-ai/mcp`][registry-supadata] |

Use the GHCR fallback only if a refreshed upstream audit or actual Docker build
validation finds a material incompatibility with the selected path. A fallback
decision must pin the reviewed image by `@sha256:` digest; a release tag alone
is mutable and is not an image identity. The fallback must not imply that
Docker manages its signing, provenance, SBOM, or updates.

## Exact submission checklist

The checked items are verified only for the source snapshots above. Unchecked
items belong to the downstream issue named in the heading or item.

### 1. Eligibility and contributor prerequisites

- [x] The source repository is public and identifies the project as an
  independent, community-maintained MCP server.
- [x] The repository and package declare the permissive MIT license. Docker's
  pull request template accepts MIT and other listed permissive licenses
  ([eligibility checklist][registry-pr-template]).
- [x] A production root [`Dockerfile`](../Dockerfile) exists, builds the TypeScript
  project, runs as the unprivileged `node` user, and starts `node dist/index.js`.
- [x] [`README.md`](../README.md) documents Docker, source, stdio, credentials,
  setup, and verification.
- [x] [`SECURITY.md`](../SECURITY.md) provides a security contact path and rules
  for handling credentials and private Trello data.
- [x] The server implements local stdio transport and keeps stdio logs on
  stderr, as required for protocol-only stdout.
- [x] The project was active at the audit snapshot: `v1.0.0` was current and
  `origin/main` contained newer maintenance work.
- [x] Reconfirmed the eligibility facts at the exact source commit selected by
  #58.
- [ ] Reconfirm all eligibility facts again immediately before #62 opens the
  external pull request.
- [ ] Prepare the upstream development environment with Go 1.24 or newer,
  Docker Desktop with the Docker MCP Toolkit, and Task
  ([upstream prerequisites][registry-prerequisites]).
- [ ] Fork and clone `docker/mcp-registry`; create a focused branch whose diff
  contains only the `trello-mcp` submission files.
- [ ] Expect automated validation plus manual Docker-team review. Docker says
  accepted commits are squash-merged with the pull request title
  ([review process][registry-contributing]).
- [ ] If Docker requires working credentials for review, the repository owner
  decides whether to provide temporary test credentials through Docker's linked
  credential form. Never put credentials in Git, pull request text, comments,
  logs, screenshots, fixtures, or `tools.json`.

### 2. `server.yaml` and final metadata — issue #58

[Issue #58](https://github.com/enthouan/trello-mcp/issues/58) owns creating
`servers/trello-mcp/server.yaml` and finalizing every value. The upstream schema
supports source Dockerfile selection, fixed runtime environment values,
allowlisted hosts, secrets, user parameters, and volumes
([server schema][registry-server-types], [configuration guide][registry-configuration]).

| Field or concern | Required `trello-mcp` mapping |
| --- | --- |
| Path | `servers/trello-mcp/server.yaml` |
| `name` | `trello-mcp`; the directory and field must match, and the name may contain only lowercase letters, digits, and hyphens |
| `image` | `mcp/trello-mcp` for the selected Docker-built path |
| `type` | `server` |
| Category | `productivity` |
| Tags | `trello`, `productivity`, and `project-management`, validated against the refreshed catalog vocabulary without implying an official Atlassian integration |
| Title | `Trello`; upstream validation requires capitalized words and rejects titles containing `MCP` or `Server` ([name and title validation][registry-name-title-validation]) |
| Description | Concisely describe board, list, card, and workspace workflows and state that this is an independent community integration |
| Icon | `https://trello-mcp.com/favicon.svg`; verified as a retrievable 341-byte SVG that matches the checked-in first-party asset |
| `source.project` | `https://github.com/enthouan/trello-mcp` |
| `source.commit` | `06b5b3a6151be516bb92f746dad06b797c1f2bf1`, the selected lowercase 40-character source revision; #62 must refresh it before submission ([source pinning][registry-source-pinning], [pin validator][registry-pin-validator]) |
| `source.dockerfile` | `Dockerfile`; this is the root default, but recording it explicitly makes the selected build input clear |
| Fixed runtime environment | `TRANSPORT=stdio` and `LOG_LEVEL=info` in `run.env` |
| Secrets | `TRELLO_API_KEY` and `TRELLO_TOKEN`, each represented as a required registry secret with a valid dotted name such as `trello-mcp.api_key` and `trello-mcp.token` |
| Network | `run.allowHosts` contains only `api.trello.com:443` for the initial entry |

Additional metadata decisions:

- [x] Formatted `server.yaml` with upstream's current Prettier expectations and ran
  the validator. The validator checks the directory/name match, title rules,
  YAML formatting, source pin, secret names, parameter references, license, and
  icon ([validation sequence][registry-validation]).
- [x] Keep `TRANSPORT` fixed to `stdio`, not exposed as a user parameter. The
  Docker image defaults to HTTP, so the registry entry must override it.
- [x] Keep `LOG_LEVEL` fixed to `info`, not exposed in the initial credential
  form. Stdio logging already goes to stderr; a user-selectable log level adds
  configuration surface without being necessary for startup.
- [x] Do not include `PORT` or `MCP_AUTH_TOKEN`. They govern the HTTP transport
  and do not apply to the initial stdio registry entry.
- [x] Do not override `run.command`; the image's existing command is correct and
  transport selection is environment-driven.
- [x] Do not expose `TRELLO_ATTACHMENT_UPLOAD_ROOT` or add a volume in the
  initial entry. Local attachment uploads require an explicit, carefully scoped
  host mount and should be evaluated separately after the base entry works.
  Consequently, #59 must exclude `card_attachment_upload` from the initial
  catalog rather than advertise a tool that cannot succeed in this runtime.
- [x] Do not expose rate-limit capacity, refill interval, or retry settings in
  the initial entry. Their application defaults are the intended baseline.
- [x] Confirm from the selected pinned source that `api.trello.com:443` is still
  the complete outbound host set. The current client centralizes Trello fetches
  at `https://api.trello.com/1`.
- [x] Declare both Trello secrets with `required: true` and clearly synthetic
  `<YOUR_...>` examples that do not resemble real keys or tokens.
- [ ] Confirm the two fields are presented as required credential inputs in
  Docker Desktop during issue #60's Toolkit validation.

The refreshed upstream formatting check and
`task validate -- --name trello-mcp` both passed with the draft copied into a
temporary checkout at the recorded registry revision. The metadata validator
does not require `tools.json` for a local server. The broader build and catalog
stages do require working tool discovery or the adjacent artifact; those stages
remain owned by #59 and #60, so #58 did not add a placeholder file.

Required pull-request CI is separate from that metadata-validation scope. After
the #58 PR opened, the repository's existing gated Live Trello Smoke workflow
ran automatically with repository-managed masked credentials against its
disposable public test board and verified cleanup. It did not exercise Docker
Desktop or the Registry entry and does not complete #60's Toolkit validation.

### 3. Credential-independent `tools.json` — issue #59

Startup validation requires non-empty `TRELLO_API_KEY` and `TRELLO_TOKEN`.
Docker's guide calls out configuration-dependent tool discovery as a common PR
blocker and allows `tools.json` beside `server.yaml`; when the file exists,
`task build -- --tools` reads it instead of starting the server to discover
tools ([fallback guidance][registry-tools-fallback]).

[Issue #59](https://github.com/enthouan/trello-mcp/issues/59) owns the generator,
the explicit initial-catalog selection, and the artifact. It must:

- [ ] Generate the submission's `servers/trello-mcp/tools.json` data from the
  canonical [`allTools`](../src/trello/tools.ts) registry through a deterministic
  registry profile, not from a hand-edited duplicate.
- [ ] Produce deterministic ordering and output so source changes create a
  reviewable diff.
- [ ] Include every selected tool's name and description plus each argument's
  name, type, non-empty `desc`, optionality, and array item type where
  applicable. The current upstream tool model is commit-pinned here
  ([tool model][registry-tool-model]).
- [ ] Exclude `card_attachment_upload` while the initial entry omits
  `TRELLO_ATTACHMENT_UPLOAD_ROOT` and its required volume. Make that exclusion
  explicit in the generator and tests, and do not silently omit any other
  `allTools` entry. A later entry may add the tool only with a safe mount and
  matching runtime configuration.
- [ ] Preserve supported tool annotations where the current upstream format can
  represent them.
- [ ] Add deterministic tests that compare the generated artifact with the
  canonical tool registry and reject missing tool or argument descriptions.
- [ ] Contain no credentials, Trello object data, mutable upstream prose, or
  network-dependent generation.
- [ ] Verify `task build -- --tools trello-mcp` reports the expected tool count
  for the explicit initial-catalog profile without requiring valid Trello
  credentials or a live Trello request.

### 4. Upstream validation and local catalog behavior — issue #60

[Issue #60](https://github.com/enthouan/trello-mcp/issues/60) owns Docker
Desktop/Toolkit validation and any live, credentialed Trello smoke test. From a
fresh checkout of the then-current Docker MCP Registry, run:

```bash
task validate -- --name trello-mcp
task build -- --tools trello-mcp
task catalog -- trello-mcp
docker mcp catalog import "$PWD/catalogs/trello-mcp/catalog.yaml"
```

`task import -- trello-mcp` is the current Taskfile wrapper for the catalog
import. After testing, restore Docker's catalog with:

```bash
docker mcp catalog reset
```

The current `task reset` wrapper runs both `docker mcp catalog reset` and
`docker mcp catalog init` ([Taskfile commands][registry-taskfile]).

- [ ] Before any real Trello call, read and follow
  [`.agents/skills/trello-mcp-live-validation/SKILL.md`](../.agents/skills/trello-mcp-live-validation/SKILL.md).
  Require explicit live authorization, Trello credentials, the applicable
  opt-in gate such as `TRELLO_LIVE_SMOKE=1`, and a confirmed disposable board
  ID or `trello.com/b/...` URL. Apply the skill's prechecks, source-versus-client
  tool comparison, temporary-artifact, cleanup, and sanitized-evidence rules to
  manual Docker Toolkit calls as well as scripted smoke or regression runs.
- [ ] Validate YAML and metadata with `task validate -- --name trello-mcp`.
- [ ] Build the Docker-managed image from the exact source pin and load the
  generated `tools.json` with `task build -- --tools trello-mcp`.
- [ ] Generate the catalog, import it, configure both Trello secrets, enable the
  server, and confirm the Toolkit discovers the complete tool list.
- [ ] Run only the minimum approved live behavior check through the Docker MCP
  path: credential diagnostics and read-only board discovery are sufficient.
  Keep credentials and private Trello data out of durable output.
- [ ] Confirm outbound Trello access succeeds with only
  `api.trello.com:443` allowlisted and fails closed for undeclared hosts.
- [ ] Confirm stdio protocol output remains clean while application logs go to
  stderr.
- [ ] Check whether the image's HTTP-oriented Docker `HEALTHCHECK` affects a
  long-running stdio container in Docker Desktop. Docker does not stop a
  container merely because it is unhealthy, but Toolkit behavior must be
  observed rather than assumed.
- [ ] Reset the local catalog after testing and record sanitized evidence in
  issue #60.

For an external pull request, upstream CI currently builds validation tools
from registry `main`, runs Go tests against the PR, identifies changed server
directories, then validates, builds or pulls, catalogs, and cleans each changed
server ([CI workflow][registry-ci]). Re-run the local equivalents immediately
before submission.

### 5. Review, trust planning, acceptance, and artifact verification

- [ ] Before submission, [issue #61](https://github.com/enthouan/trello-mcp/issues/61)
  documents the expected Docker-built trust properties, the digest-pinned GHCR
  fallback, and the exact post-acceptance checks for SBOM, provenance,
  signatures, source revision, and update handling. This is a readiness plan,
  not proof of a Docker-managed artifact that does not exist yet.
- [ ] [Issue #62](https://github.com/enthouan/trello-mcp/issues/62) may open the
  external Docker MCP Registry pull request after #58-#60 and #61's
  pre-submission readiness work provide their required evidence. It does not
  wait for post-acceptance inspection of the Docker-published image.
- [ ] Fill the then-current upstream pull request template: server name,
  repository URL, description, open-source eligibility, MCP compliance, active
  maintenance, Dockerfile, documentation, security contact, validation, build,
  and credential-form status ([pull request template][registry-pr-template]).
- [ ] Keep the upstream PR focused on `servers/trello-mcp/server.yaml` and
  `servers/trello-mcp/tools.json` unless refreshed requirements add another
  file.
- [ ] Address automated failures and Docker-team review. Do not treat an open
  PR, passing local commands, or a requested credential form as acceptance.
- [ ] After merge, verify the accepted catalog record, Docker Desktop Toolkit
  entry, Docker Hub `mcp/trello-mcp` image, exact source revision, and the
  upstream-stated processing window. The current guide says accepted entries
  become available within 24 hours ([post-acceptance processing][registry-post-acceptance]).
- [ ] After #62 records upstream acceptance and Docker publishes the managed
  image, #61 verifies the actual image digest, SBOM, provenance, signatures,
  source revision, and update behavior. Keep #61 open until that evidence is
  durable; only then may the project claim the realized supply-chain model.

## Downstream issue ownership

| Issue | Owns | Status after issue #58 |
| --- | --- | --- |
| [#58](https://github.com/enthouan/trello-mcp/issues/58) | Create `server.yaml`; finalize title, description, tags, icon, source pin, stdio runtime, secrets, and host allowlist | The local metadata draft and its offline contract are complete; no external submission was made |
| [#59](https://github.com/enthouan/trello-mcp/issues/59) | Generate and test credential-independent `tools.json` from the explicit `allTools`-derived initial catalog, excluding the disabled upload tool | No tool export or placeholder is created by #58 |
| [#60](https://github.com/enthouan/trello-mcp/issues/60) | Import the local catalog and verify Toolkit configuration, discovery, outbound access, and minimal live behavior through the opt-in live-validation workflow | No Docker Desktop import or manual #58-specific live validation is performed; required PR smoke remains ordinary CI evidence, not #60 completion |
| [#61](https://github.com/enthouan/trello-mcp/issues/61) | Define the pre-submission trust plan and digest-pinned fallback; after acceptance, verify the actual Docker-published image and final trust/update model | No supply-chain readiness claim is completed by #58 |
| [#62](https://github.com/enthouan/trello-mcp/issues/62) | Open and complete the external Docker MCP Registry submission and verify acceptance | No upstream pull request or credential submission is made by #58 |

## Blockers and open questions

There is no evidence in the 2026-08-23 snapshots that blocks the Docker-built
choice. The remaining questions are deliberately assigned rather than silently
assumed:

- #58 selected and verified the first-party icon, rechecked catalog vocabulary,
  and pinned the exact source revision for the metadata draft. #62 must refresh
  all three decisions immediately before external submission.
- #59 must prove the generated tool representation matches Docker's then-current
  format and the explicit canonical initial-catalog selection, including the
  intentional upload-tool exclusion.
- #60 must observe Docker Desktop behavior for the stdio container, its
  HTTP-oriented image health check, secret fields, host allowlist, and imported
  catalog rather than inferring success from source inspection. Any real Trello
  call must stay behind the repository live-validation skill's explicit opt-in,
  target-confirmation, and cleanup gates.
- #61 must complete the trust plan before submission, then verify the actual
  Docker-published artifacts and update behavior after acceptance. If the
  self-provided GHCR fallback is selected later, it must use a digest and
  document the reduced Docker-managed guarantees and replacement trust model.
- #62 must re-audit upstream `main`, handle the owner-gated credential form if
  Docker requests test access, complete review, and verify post-merge catalog
  processing. It may open after #61's pre-submission phase; it is not blocked on
  evidence that only the accepted Docker-managed image can provide.

[registry-readme]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/README.md#L13-L33
[registry-contributing]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/CONTRIBUTING.md#L36-L45
[registry-pr-template]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/.github/PULL_REQUEST_TEMPLATE.md#L9-L30
[registry-build-path]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/CONTRIBUTING.md#L138-L159
[registry-notion]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/servers/notion/server.yaml#L1-L22
[registry-supadata]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/servers/supadata/server.yaml#L1-L25
[registry-prerequisites]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/CONTRIBUTING.md#L28-L34
[registry-server-types]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/pkg/servers/types.go#L35-L136
[registry-configuration]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/docs/configuration.md#L26-L90
[registry-name-title-validation]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/cmd/validate/main.go#L94-L167
[registry-source-pinning]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/docs/configuration.md#L78-L90
[registry-pin-validator]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/cmd/validate/main.go#L185-L208
[registry-validation]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/cmd/validate/main.go#L37-L84
[registry-tools-fallback]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/CONTRIBUTING.md#L162-L197
[registry-tool-model]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/internal/mcp/types.go#L43-L61
[registry-taskfile]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/Taskfile.yml#L3-L50
[registry-ci]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/.github/workflows/ci.yaml#L1-L75
[registry-post-acceptance]: https://github.com/docker/mcp-registry/blob/8c773729f13f036da8c909be503fe433923a9aa2/CONTRIBUTING.md#L199-L205
