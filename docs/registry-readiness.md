# Docker MCP Registry readiness

Last verified: **2026-10-08**

Decision: submit `trello-mcp` as a **Docker-built local server** with the
registry image name `mcp/trello-mcp`. Keep the existing GHCR image as a viable
self-provided fallback, but do not treat the two paths as having the same
Docker-managed supply-chain guarantees.

## Scope and evidence snapshot

This document began as the requirements audit in
[issue #57](https://github.com/enthouan/trello-mcp/issues/57) and now records
the validated `server.yaml` metadata draft completed by
[issue #58](https://github.com/enthouan/trello-mcp/issues/58), the generated
`tools.json` fallback completed by
[issue #59](https://github.com/enthouan/trello-mcp/issues/59), and the
credential-independent Docker MCP Toolkit validation performed for
[issue #60](https://github.com/enthouan/trello-mcp/issues/60). The approved live
Gateway calls and Docker Desktop credential-form inspection remain explicit
manual gates. This audit does not change the release workflow, open an external
registry pull request, submit credentials, or claim that Docker Registry
acceptance or supply-chain readiness is complete.

| Source | Audited revision | Why it matters |
| --- | --- | --- |
| Docker MCP Registry `main` | [`49b643ce3fc73e6ee80bb962719b6e2990e3d397`](https://github.com/docker/mcp-registry/tree/49b643ce3fc73e6ee80bb962719b6e2990e3d397) | Refreshed upstream checkout for the October validation; contribution rules, schema, and Taskfile are unchanged from the August audit. |
| Docker MCP Registry initial audit | [`8c773729f13f036da8c909be503fe433923a9aa2`](https://github.com/docker/mcp-registry/tree/8c773729f13f036da8c909be503fe433923a9aa2) | Commit-pinned source for the unchanged upstream requirements and examples linked below. |
| `trello-mcp` current validation base | [`d7c22c78223b60ccabe269ae3af2415957fed861`](https://github.com/enthouan/trello-mcp/commit/d7c22c78223b60ccabe269ae3af2415957fed861) | Current main after rebasing the issue #60 documentation work; package version `1.0.3`. |
| `trello-mcp` initial validation head | [`4dce72213740d56ab00ee2b7dea60362431efeb9`](https://github.com/enthouan/trello-mcp/commit/4dce72213740d56ab00ee2b7dea60362431efeb9) | Repository head used for the August results. |
| `trello-mcp` source pin | [`17679f1484e8e255e745dc9a291b9cd587f7a44f`](https://github.com/enthouan/trello-mcp/commit/17679f1484e8e255e745dc9a291b9cd587f7a44f) | Exact issue #59 generator, artifact, non-interactive Docker build fix, package lock, and Node.js 24 runtime used for upstream build validation. |
| Docker MCP Gateway `v0.43.3` | [`8b5d526aef123f49aae07fe95036109c315177b3`](https://github.com/docker/mcp-gateway/tree/8b5d526aef123f49aae07fe95036109c315177b3) | Installed plugin used for the August results. |
| Docker MCP Gateway `v0.44.1` | [`a34df45d4ec0e941a9853ad768c4f6cd818966b3`](https://github.com/docker/mcp-gateway/tree/a34df45d4ec0e941a9853ad768c4f6cd818966b3) | Installed plugin for the October refresh. |
| Docker documentation, initial / refreshed | [`dbad77a00e8352f30e663bec3eeae9fb31a19b4e`](https://github.com/docker/docs/tree/dbad77a00e8352f30e663bec3eeae9fb31a19b4e) / [`858251609b8884594fd1de29c51155bc3024b260`](https://github.com/docker/docs/tree/858251609b8884594fd1de29c51155bc3024b260) | August and October documentation snapshots for catalog, profile, and CLI behavior. |
| `trello-mcp` release | [`v1.0.3`](https://github.com/enthouan/trello-mcp/releases/tag/v1.0.3) | Current release at the October refresh; the August pass used `v1.0.0`. |

The August upstream revision remained exactly the `8c773729` planning
baseline used by #58 and is two commits beyond the `fd36a38a` revision audited
by #57. Those commits
changed only `servers/circleci/server.yaml` and the adjacent CircleCI
`readme.md` and `tools.json`; the server schema, validator, formatting rule,
contribution guide, CI workflow, pull request template, and relevant local
examples did not change.

The October refresh advanced to `49b643ce`; its only change from `8c773729`
updates Airtable's source pin. The requirements linked to the earlier
immutable revision therefore still apply. The current Toolkit uses OCI
catalogs and profiles; the contribution guide still describes legacy commands.

The upstream snapshot includes two local-server paths: Docker's recommended
Docker-built path and a self-provided image path. Its contribution guide also
defines the local validation commands, credential form, and review process
([registry overview][registry-readme], [contribution process][registry-contributing],
[pull request template][registry-pr-template]). The upstream repository can
change independently. This refresh satisfies #58's metadata-stage audit; #62
must re-fetch `main`, record the then-current SHA, and re-audit any changed
requirements before opening the external pull request. If the runtime tool
surface changes before #62, regenerate and revalidate `tools.json` at that time.

## Final issue #58 metadata decisions

The draft lives at [`servers/trello-mcp/server.yaml`](../servers/trello-mcp/server.yaml).
Issue #58 originally pinned `06b5b3a6151be516bb92f746dad06b797c1f2bf1`,
which was `origin/main` when that metadata work began. Issue #59's exact
upstream build then demonstrated that revision's `pnpm prune --prod` aborts in
Docker's non-interactive build step. The pin is therefore refreshed to
`17679f1484e8e255e745dc9a291b9cd587f7a44f`, the issue #59 source commit that
contains both the generated fallback and the minimal `CI=true` prune fix. This
is a demonstrated build correction, not a pin change merely to include the
artifact. It also gives the upstream task an immutable, remotely fetchable
revision for the acceptance check. Issue #62 must refresh the source pin
immediately before opening the external submission.

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
- [x] Prepare the upstream development environment with Go 1.24 or newer,
  Docker Desktop with the Docker MCP Toolkit, and Task. Issue #60 used Go
  `1.27.0`, Docker Desktop `4.88.0` initially and `4.88.1` for the fresh
  continuation, Toolkit `v0.43.3`, and Task `3.53.1`
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
| `source.commit` | `17679f1484e8e255e745dc9a291b9cd587f7a44f`, the selected lowercase 40-character issue #59 validation revision; #62 must refresh it to the final merged revision before submission ([source pinning][registry-source-pinning], [pin validator][registry-pin-validator]) |
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
the explicit initial-catalog selection, and the artifact. The checked-in
[`servers/trello-mcp/tools.json`](../servers/trello-mcp/tools.json) is rendered
by [`scripts/generate-docker-registry-tools.ts`](../scripts/generate-docker-registry-tools.ts)
through the importable conversion library in
[`scripts/lib/docker-registry-tools.ts`](../scripts/lib/docker-registry-tools.ts).
Run `corepack pnpm registry:tools` to regenerate it and
`corepack pnpm registry:tools:check` to fail when it is stale.

The runtime registry currently has 77 tools. The initial Docker profile has 76,
with exactly `card_attachment_upload` excluded because `server.yaml` exposes
neither `TRELLO_ATTACHMENT_UPLOAD_ROOT` nor a safe host volume. Every future
`allTools` entry is included automatically unless it is explicitly added to the
central exclusion profile.

Input metadata comes from Zod's public `toJSONSchema` API in input mode, matching
the MCP SDK's client-facing `tools/list` requiredness. Required argument names
sort alphabetically before optional argument names, and tool names sort
alphabetically. Docker's compact model preserves one top-level string type and
array item type. Nullable and mixed unions have no equivalent compact union
encoding, so they use Docker's current lossy `string` fallback. The runtime
surface currently exposes no client-facing tool annotations, so the generated
objects correctly contain none.

- [x] Generate the submission's `servers/trello-mcp/tools.json` data from the
  canonical [`allTools`](../src/trello/tools.ts) registry through a deterministic
  registry profile, not from a hand-edited duplicate.
- [x] Produce deterministic ordering and output so source changes create a
  reviewable diff.
- [x] Include every selected tool's name and description plus each argument's
  name, type, non-empty `desc`, optionality, and array item type where
  applicable. The current upstream tool model is commit-pinned here
  ([tool model][registry-tool-model]).
- [x] Exclude `card_attachment_upload` while the initial entry omits
  `TRELLO_ATTACHMENT_UPLOAD_ROOT` and its required volume. The exclusion is
  explicit in the generator and tests, and no other `allTools` entry is omitted.
  A later entry may add the tool only with a safe mount and matching runtime
  configuration.
- [x] Preserve supported tool annotations where the current upstream format can
  represent them. There are no annotations in the current client-facing
  `tools/list` output, so no values are invented.
- [x] Add deterministic tests that compare the generated artifact with the
  canonical tool registry and reject missing tool or argument descriptions.
- [x] Contain no credentials, Trello object data, mutable upstream prose, or
  network-dependent generation. The generator imports tool definitions only;
  it loads no runtime configuration and invokes no handler or `fetch` call.
- [x] Verify `task build -- --tools trello-mcp` reports 76 tools for the explicit
  initial-catalog profile without Trello credentials or a live Trello request.

At Docker MCP Registry revision `8c773729`, a temporary checkout containing only
the submission `server.yaml` and generated `tools.json` passed
`task validate -- --name trello-mcp`. The exact
`task build -- --tools trello-mcp` path built the pinned image, used the adjacent
fallback without starting the server for discovery, and reported
`76 tools found.` Both commands ran with `TRELLO_API_KEY` and `TRELLO_TOKEN`
absent. The build also exposed that the Dockerfile's production prune needed
explicit non-interactive CI mode; `CI=true pnpm prune --prod` fixes that
demonstrated build prerequisite without changing runtime behavior.

### 4. Upstream validation and current Toolkit behavior — issue #60

[Issue #60](https://github.com/enthouan/trello-mcp/issues/60) owns Docker
Desktop/Toolkit validation and any live, credentialed Trello smoke test. The
initial 2026-08-29 credential-independent pass used Docker Desktop `4.88.0`
build `237115`. On 2026-08-30, Desktop had updated to `4.88.1` build `237512`;
the fresh upstream validation, catalog conversion, profile setup, and
preparation for the approved live continuation were rerun from that version.
Docker CLI and Engine remained
`29.7.2` with API `1.55`, and Docker MCP Toolkit/Gateway remained `v0.43.3`.
The host validation tools were Node.js `24.17.0`, pnpm `10.34.1`, Go `1.27.0`,
and Task `3.53.1`.

#### Registry validation

A fresh temporary checkout of Docker MCP Registry revision `8c773729` received
only this repository's `server.yaml` and `tools.json`. With no Trello credential
variables present, these exact commands passed:

```bash
task validate -- --name trello-mcp
task build -- --tools trello-mcp
task catalog -- trello-mcp
```

The build cloned and built the exact `17679f1` source pin, consumed the adjacent
fallback instead of starting the server for discovery, and reported
`76 tools found.` It ran in an isolated temporary Docker daemon so it did not
replace a pre-existing host `mcp/trello-mcp` image. The generated legacy
catalog contained one server and retained `TRANSPORT=stdio`, `LOG_LEVEL=info`,
the two Trello secret mappings, and only `api.trello.com:443`. It added no HTTP,
attachment-upload, volume, environment, or secret surface.

The later Gateway checks used that preserved host image. Its OCI source-revision
label was the same exact `17679f1484e8e255e745dc9a291b9cd587f7a44f` pin, and
its discovered tool metadata matched the pinned source and fallback. It was not
the isolated build artifact, however, so this audit does not claim byte or image
digest identity between the two builds.

#### Version-aware catalog and profile procedure

The pinned Registry Taskfile still wraps the legacy `docker mcp catalog import`
and global `catalog reset` flow ([Taskfile commands][registry-taskfile]). Docker
MCP Toolkit `v0.43.3` exposes neither command. Its current supported model uses
OCI catalogs and profiles ([Toolkit CLI][toolkit-cli], [catalogs][toolkit-catalogs],
[profiles][toolkit-profiles]). The non-destructive procedure exercised here was:

1. Copy only the generated legacy `catalog.yaml`, with restrictive permissions,
   into a unique temporary directory below `~/.docker/mcp/catalogs/`, after
   confirming the path did not exist.
2. Run `docker mcp catalog create
   mcp/trello-mcp-issue-60-local:validation --from-legacy-catalog
   ~/.docker/mcp/catalogs/trello-mcp-issue-60-local/catalog.yaml`, then inspect
   that exact OCI catalog. Although the help describes a URL, this installed
   plugin accepted the trusted local path.
3. Run `docker mcp profile create --name "trello-mcp issue 60 local" --id
   trello-mcp-issue-60-local --server
   catalog://mcp/trello-mcp-issue-60-local:validation/trello-mcp`. No persistent
   MCP client was connected.
4. Materialize the profile's explicit tool allowlist by feeding every name in
   `servers/trello-mcp/tools.json` to repeated `docker mcp profile tools
   trello-mcp-issue-60-local --enable trello-mcp.<tool>` calls.
5. Exercise that profile directly with `docker mcp gateway run --profile
   trello-mcp-issue-60-local` or `docker mcp tools --gateway-arg=--profile
   --gateway-arg=trello-mcp-issue-60-local ls`.
6. Remove only that profile with `docker mcp profile remove`, that OCI catalog
   with `docker mcp catalog remove`, the exact trusted copy, secrets created by
   the run, and run-created containers. Never use an unscoped catalog reset.

Conversion preserved the server's image, fixed environment, secret names, and
single allowed host. It did not transfer the adjacent fallback's tool metadata:
the generated legacy catalog has `tools: []`, and an implicit profile therefore
discovered all 77 runtime tools. The explicit allowlist sourced from the
checked-in fallback is necessary for this local conversion path and produced
the intended 76-tool profile without creating a second server definition.

#### Tool, network, protocol, health, and signature observations

The exact tool comparison passed:

| Surface | Count | Difference |
| --- | ---: | --- |
| Canonical `allTools` | 77 | Source-only `card_attachment_upload` |
| Registry `tools.json` | 76 | No registry-only tools |
| Toolkit profile | 76 | No profile-only tools |

Gateway `tools/list` returned those 76 profile tools plus eight Toolkit-internal
tools. After excluding the documented Gateway helpers, all 76 names matched,
`card_attachment_upload` was absent, and descriptions, argument names, and
requiredness matched the registry fallback.

In the tested direct Gateway CLI path, `v0.43.3` enforced the catalog host list
only when launched with `--block-network`. A disposable negative catalog that
replaced `api.trello.com:443` with `example.com:443`, using dummy credentials,
was blocked with that flag before Trello authentication could succeed. A
control run without `--block-network` reached Trello and received HTTP `401`.
That was an unauthenticated network probe, not a successful credentialed live
workflow, but it demonstrates that `allowHosts` metadata alone did not enforce
this direct invocation. The approved positive call through the exact catalog
remains pending; when run, it must also use `--block-network`.

A permission-restricted stdio capture completed `initialize` and `tools/list`.
Stdout contained only two valid JSON-RPC responses, while Gateway and server
logs stayed on stderr. No capture is retained. In long-lived mode, the stdio
container remained running but Docker marked it unhealthy after four
HTTP-oriented probe failures. A second local input-validation call still
completed through the same container, so the observed health state did not
prevent Toolkit operation; the container was then released.

The secure Gateway default rejected the local, tag-referenced image
because it was not digest-referenced and signed. Only the scoped local
validation commands were retried with `--verify-signatures=false`; no
repository or Toolkit default was weakened. Issue #61 owns the eventual trust
and signature plan.

The converted catalog and CLI profile snapshot expose exactly
`trello-mcp.api_key` and `trello-mcp.token`. macOS screen-capture/accessibility
controls prevented direct inspection of the Docker Desktop credential form, so
the UI-specific requirement is not inferred from the CLI snapshot. On
2026-08-30, explicit authorization was granted for the minimal read-only
Gateway continuation. No authenticated Gateway Trello request has run: secure
credential input, direct UI confirmation, explicit confirmation of the exact disposable
board, and the applicable `TRELLO_LIVE_SMOKE=1` opt-in remain required.

The 2026-08-29 targeted cleanup removed that pass's issue-specific profile and
OCI catalog, both dummy secrets, the trusted catalog copy, temporary captures
and checkouts, and run-created containers. The post-cleanup catalog, profile,
client, and secret-name inventories matched the sanitized baseline: the
original catalog and two pre-existing profiles remained, no secrets or issue
containers remained, and the pre-existing `mcp/trello-mcp` image identity was
unchanged. No global reset or client reconfiguration was used. A fresh
issue-specific profile, OCI catalog, trusted catalog copy, and temporary
checkout were prepared on 2026-08-30 for the authorized continuation. The
October inventory found the profile and catalog still present with no saved
secret names or Trello containers. Final targeted cleanup of that continuation
remains pending.

#### 2026-10-08 refresh after rebase

The issue branch was rebased onto `d7c22c7` (`v1.0.3`), preserving the four
documentation/test changes. Installed versions are Docker Desktop `4.94.0`
build `241994`, CLI/Engine `29.8.2` with API `1.56`, and Toolkit/Gateway
`v0.44.1`. The fresh upstream checkout was exactly `49b643ce`.
The October baseline had no `mcp/trello-mcp`, `trello-mcp:latest`, or
`check:latest` image, so these fresh builds replaced no pre-existing image.

The three Registry commands above passed again without Trello credentials.
The build consumed the unchanged 76-tool fallback and built the exact
`17679f1` source pin. Its OCI revision label matched that pin. The generated
catalog still contains one server, the two canonical secret mappings, only
`TRANSPORT=stdio` and `LOG_LEVEL=info`, only `api.trello.com:443`, no volumes,
and `tools: []`. The canonical source remains 77 tools and the generated
Registry artifact remains 76; neither submission file changed in this pass.

The current-source `docker:build` also passed. That is a separate build:
`v1.0.3` added a transport-aware health check, while the Registry submission
still pins the older HTTP-oriented probe. The August observations describe
that pinned image, not the new health check. Issue #62 must refresh the source
pin and rerun validation before submission.

Toolkit `v0.44.1` rejects file-backed `--secrets` when `--profile` is used;
profiles use Docker Desktop's Secrets Engine. Offline dummy credentials must
therefore be isolated from the canonical names the owner is configuring.
The canonical profile and its 76-name allowlist were inspected successfully,
but credential-form confirmation and the authenticated positive-network call
remain pending. No authenticated Trello request completed during this October
refresh; the dummy-only negative control below returned a connectivity error.

For credential-independent discovery, a disposable copy of the generated
catalog changed only the two secret names to issue-specific dummy names; the
canonical `TRELLO_API_KEY`/`TRELLO_TOKEN` environment mappings, image, fixed
environment, and host allowlist stayed identical. It converted successfully
through the OCI command and used an explicit 76-name profile allowlist. The
default signature check again rejected the tag reference; a scoped
`--verify-signatures=false` retry completed initialization and `tools/list`.
The result was 76 Trello tools plus eight Gateway helpers, with all 76
descriptions, argument names, and requiredness matching the fallback. The only
source-only tool remained `card_attachment_upload`. This dummy-only fixture
does not establish credential-form or live-call acceptance for the canonical
profile.

The October stdio capture contained five valid JSON-RPC messages and no invalid
or partial lines; verbose stderr contained both Gateway and application startup
logs. With a locally invalid `board_get` call retaining the long-lived
container, Docker marked the pinned image unhealthy after three HTTP-probe
failures at 81 seconds. At 108 seconds it was still running with four failed
probes, `tools/list` still returned 84 tools, and another missing-`boardId`
request was rejected locally. These calls required no Trello access.

A separate disposable negative fixture changed only the host allowlist to
`example.com:443`. With dummy credentials and `--block-network`, `auth_whoami`
returned `Unable to reach Trello API`, with no authentication response. No
unblocked control was run in October. This establishes the current negative
case, not the still-pending authenticated positive path.

All October offline/negative profiles, catalogs, trusted copies, dummy secrets,
raw captures, and the fresh upstream checkout were removed. Gateway left six
run-created L7 proxy sidecars behind; those exact recorded containers were
removed explicitly. No Trello or proxy containers remain, and the sanitized
profile, catalog, and secret-name inventories match the October baseline.
Canonical secret values were never retrieved or changed. The auxiliary
`check:latest` tag and separate current-source test image were removed. Only
the freshly built `mcp/trello-mcp:latest` image is intentionally retained for
the owner's pending continuation; the canonical August profile, catalog, and
trusted copy already existed at this pass's baseline. Their final cleanup
remains part of that continuation, not a completed cleanup claim.

The following completed technical checks were repeated on 2026-10-08; the
dated cleanup items distinguish the finished fixtures from the pending owner
continuation.

- [x] Read and apply the repository
  [live-validation safety skill](../.agents/skills/trello-mcp-live-validation/SKILL.md)
  before any Trello request boundary.
- [x] Validate YAML and metadata with `task validate -- --name trello-mcp`.
- [x] Build the exact pinned source and load the 76-tool fallback with
  `task build -- --tools trello-mcp` without credentials.
- [x] Generate and convert the legacy catalog through the supported OCI path,
  create an isolated profile, and discover the exact 76-tool registry surface.
- [ ] Confirm both required credential inputs directly in Docker Desktop.
- [ ] Run explicitly approved Gateway credential diagnostics and read-only
  discovery against a confirmed disposable board.
- [ ] Confirm the positive `api.trello.com:443` allowlist path with that approved
  read-only call. The `--block-network` negative case passed.
- [x] Confirm protocol-only stdout and log-only stderr.
- [x] Confirm the unhealthy HTTP probe does not prevent observed stdio Toolkit
  operation; no Dockerfile change is warranted by this result.
- [x] Record the secure-default signature failure and use only a scoped local
  signature-verification exception.
- [x] Remove the first pass's temporary profile, catalog, trusted copy, dummy
  secrets, captures, checkouts, and containers; its sanitized post-test
  inventory matched the initial state on 2026-08-29.
- [x] Remove the October offline/negative fixtures, dummy secrets, raw captures,
  checkout, and all recorded containers; retain only the pinned test image for
  the pending owner continuation and restore the other October inventories.
- [ ] After the authorized continuation, remove only its fresh temporary
  profile, catalog, trusted copy, secrets, captures, checkout, and containers,
  then compare the sanitized inventory with the continuation baseline.
- [ ] Post the final sanitized evidence, including the remaining manual gates if
  authorization is unavailable, to issue #60.

For an external pull request, upstream CI currently builds validation tools
from registry `main`, runs Go tests against the PR, identifies changed server
directories, then validates, builds or pulls, catalogs, and cleans each changed
server ([CI workflow][registry-ci]). Re-run the local equivalents immediately
before submission.

### 5. Review, trust planning, acceptance, and artifact verification

Release `v1.0.3` already publishes to the separate official MCP Registry and
provides per-platform SPDX SBOM and BuildKit provenance for the GHCR image
([release implementation](https://github.com/enthouan/trello-mcp/pull/226)).
That work does not publish a Docker MCP Catalog entry or establish Docker's
managed-image signature/update guarantees. #61 should reuse the existing GHCR
evidence and focus its remaining plan on those Docker-specific questions.

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

| Issue | Owns | Status during issue #60 validation |
| --- | --- | --- |
| [#58](https://github.com/enthouan/trello-mcp/issues/58) | Create `server.yaml`; finalize title, description, tags, icon, source pin, stdio runtime, secrets, and host allowlist | The local metadata draft and its offline contract are complete; no external submission was made |
| [#59](https://github.com/enthouan/trello-mcp/issues/59) | Generate and test credential-independent `tools.json` from the explicit `allTools`-derived initial catalog, excluding the disabled upload tool | The 76-tool artifact, generator, deterministic checks, offline `tools/list` parity, and upstream fallback build are complete |
| [#60](https://github.com/enthouan/trello-mcp/issues/60) | Convert the local catalog through the installed Toolkit's supported path and verify configuration, discovery, outbound access, and minimal live behavior through the opt-in live-validation workflow | Upstream validation, isolated OCI conversion, exact 76-tool discovery, negative network enforcement, stdio/log separation, health behavior, and the local signature exception are recorded; Docker Desktop UI confirmation and the authorized live/positive-network gates remain pending |
| [#61](https://github.com/enthouan/trello-mcp/issues/61) | Define the pre-submission trust plan and digest-pinned fallback; after acceptance, verify the actual Docker-published image and final trust/update model | `v1.0.3` provides GHCR SBOM/provenance; Docker-specific trust, signing, and post-acceptance artifact verification remain open |
| [#62](https://github.com/enthouan/trello-mcp/issues/62) | Open and complete the external Docker MCP Registry submission and verify acceptance | No Docker Registry submission or review-credential sharing has occurred; refresh the source pin and fallback before the external PR |

## Blockers and open questions

There is no evidence in the credential-independent results through 2026-10-08 that
blocks the Docker-built choice. The remaining questions and manual gates are
deliberately assigned rather than silently assumed:

- #58 selected and verified the first-party icon, rechecked catalog vocabulary,
  and pinned the exact source revision for the metadata draft. #62 must refresh
  all three decisions immediately before external submission.
- #60 has directly observed the converted catalog, explicit 76-tool profile,
  negative host enforcement with `--block-network`, stdio/log separation,
  unsigned-local-image exception, and non-blocking unhealthy stdio container
  at the historical source pin. Current main has a transport-aware health
  check; that change does not retroactively alter the pinned-image evidence.
  It still requires direct Docker Desktop credential-form confirmation and an
  explicitly authorized positive Gateway call against a confirmed disposable
  board. No CI run or CLI metadata snapshot substitutes for those gates.
- #61 must complete the trust plan before submission, then verify the actual
  Docker-published artifacts and update behavior after acceptance. If the
  self-provided GHCR fallback is selected later, it must use a digest and
  document the reduced Docker-managed guarantees and replacement trust model.
- #62 must re-audit upstream `main`, handle the owner-gated credential form if
  Docker requests test access, complete review, and verify post-merge catalog
  processing. It may open after #61's pre-submission phase; it is not blocked on
  evidence that only the accepted Docker-managed image can provide. It must
  also regenerate and revalidate `tools.json` if `allTools` changes before
  submission.

## Owner steps to reach Docker Catalog publication

1. Finish the #60 manual gate: in Docker Desktop, open the temporary Trello
   profile and confirm the API key and token fields. Inventory secret names
   first; if either canonical name already exists, do not overwrite it.
   Arrange an isolated or owner-directed setup instead. Save test credentials
   securely and confirm the exact disposable validation board. Track which
   secrets were created by this run. Keep credential values out of chat,
   shell arguments, screenshots, and the submission.
2. Complete `auth_whoami`, `auth_token_info`, and `board_get` through that
   Gateway profile with `TRELLO_LIVE_SMOKE=1`, the confirmed board ID/URL,
   and `--block-network`. Record only sanitized results. Stop the Gateway
   before removing only run-created secrets and temporary state, then verify
   cleanup against the baseline. Complete the #60 PR checks and review before
   the owner approves its merge.
3. Complete #61's pre-submission trust plan, including the exact GHCR fallback
   digest and how Docker-published signatures, SBOM, provenance, source, and
   updates will be checked after acceptance.
4. Start #62 with owner approval: refresh the source pin and fallback, rerun
   the Registry and Gateway checks, then open a focused fork PR in
   `docker/mcp-registry` containing the submission files. The repository owner
   handles temporary review credentials through Docker's official form if
   required by the review process.
5. Address upstream CI and Docker-team review. After acceptance, verify the
   public catalog record, Docker Desktop discovery, and Docker Hub
   `mcp/trello-mcp` artifact. Upstream documents availability within 24 hours;
   observe the actual result rather than treating that window as proof.
6. Finish #61's post-acceptance artifact checks. Local catalog creation,
   pushing this repository's branch, and official MCP Registry publication
   do not themselves create the public Docker Catalog listing.

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
[toolkit-cli]: https://docs.docker.com/ai/mcp-catalog-and-toolkit/cli/
[toolkit-catalogs]: https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/
[toolkit-profiles]: https://docs.docker.com/ai/mcp-catalog-and-toolkit/profiles/
