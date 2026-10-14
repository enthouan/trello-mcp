# Official MCP Registry releases

The official Registry identity is `io.github.enthouan/trello-mcp`. It describes
the self-hosted GHCR container over stdio. This is an independent,
community-maintained project, not an official Trello or Atlassian product.
The Registry hosts metadata; GHCR hosts the executable image.

Initial publication and observed production automation are tracked in
[issue #225](https://github.com/enthouan/trello-mcp/issues/225). Docker MCP
Registry [#62](https://github.com/enthouan/trello-mcp/issues/62) and Glama
[#66](https://github.com/enthouan/trello-mcp/issues/66) are separate submissions.

## Image trust and verification

Trust review: **2026-10-14 UTC**. GHCR provides inspectable SBOM/provenance and
digest integrity. The Release workflow does not establish a maintainer image
signature or independently authenticated build identity. Operators must decide
whether the repository/GitHub/GHCR publication controls meet their policy before
running an image; a successful metadata check alone cannot make that decision.

| Artifact and publisher | Available guarantees and evidence | Consumer boundary |
| --- | --- | --- |
| Maintainer-built `ghcr.io/enthouan/trello-mcp` | Release builds explicitly enable `sbom: true` and `provenance: mode=max`. Stable releases verify both platforms and reuse existing exact images. v1.0.3 evidence is recorded below. | Anonymous metadata checks and digest pinning are available. Publisher signatures are not verified; plain Docker pulls do not enforce the project's metadata policy. |
| Proposed Docker-built `mcp/trello-mcp` | Docker's [contribution guide](https://github.com/docker/mcp-registry/blob/49b643ce3fc73e6ee80bb962719b6e2990e3d397/CONTRIBUTING.md) describes Docker-controlled builds, signatures, SBOM/provenance, and security updates. | These remain expectations for this server until an accepted artifact is published and inspected. The [submission](https://github.com/docker/mcp-registry/pull/5625) is still open. A Docker rebuild need not share a GHCR digest even from the same source. |
| Official MCP Registry entry `io.github.enthouan/trello-mcp` | The exact active metadata payload references the versioned GHCR image. GitHub OIDC authorizes publication in the Registry namespace. | The official Registry does not rebuild or sign the image. Registry OIDC login is not container signing; `registry:release verify` checks Registry metadata, not image signatures. |

### Verified GHCR artifact and limits

The existing verifier and the read-only command below independently retrieved
v1.0.3 anonymously on 2026-10-14 UTC, without running a container or contacting
Trello. The expected identity comes from the maintainer's
[v1.0.3 completion record](https://github.com/enthouan/trello-mcp/issues/225)
and [successful stable-tag Release run](https://github.com/enthouan/trello-mcp/actions/runs/37866552644),
cross-checked against the annotated tag's target. This relies on trusted access
to the repository and GitHub evidence; it is not cryptographic publisher
authentication. An annotated Git tag is not necessarily a cryptographically
signed tag. Fetching a digest and its metadata from the same registry is not an
independent source of trust for who built it.

| Identity | Value |
| --- | --- |
| Version / source revision | `1.0.3` / `d7c22c78223b60ccabe269ae3af2415957fed861` |
| GHCR index | `sha256:198f6758ea06fb786622a5335ad68d6a618adf3e20d1dda1094754d4a02b48a6` |
| linux/amd64 manifest | `sha256:545d7be568b51bf650539f910dbabbde4876bb8c1f95a83c176b19b2d51da797` |
| linux/arm64 manifest | `sha256:bf18952220551e705dace424a7f79c8dbf8356e889661ed56de5bb13962f6d94` |

The index has exactly these two runnable platforms and two `unknown/unknown`
attestation descriptors. Those descriptors are metadata, not runnable platforms.
Both configurations declare version `1.0.3`, the revision above, source
`https://github.com/enthouan/trello-mcp`, ownership
`io.github.enthouan/trello-mcp`, command `["node", "dist/index.js"]`, inherited
entrypoint `["docker-entrypoint.sh"]`, working directory `/app`, and user `node`.
The verifier compares these fields and checks SHA-256 bytes from the
index through platform/configuration and attestation manifests to statement
blobs. It requires each in-toto subject to match its platform digest and any
advertised predicate type to match the statement. It does not download filesystem
layers; their digests are referenced by the checked platform manifests.

Both SPDX 2.3 documents contain **345 package records**, including Debian
`base-files`, Node `24.21.0`, `trello-mcp` `1.0.3`, MCP SDK `1.31.0`, Pino
`10.3.1`, and Zod `4.6.5`. They report Syft `1.51.0` and BuildKit `0.33.1` as
tools. The [default SBOM scope](https://docs.docker.com/build/metadata/attestations/sbom/)
is the final image stage; this Dockerfile does not opt into scanning the build
context or earlier stages. A populated SBOM is not exhaustive evidence of all
build dependencies and is not a clean vulnerability scan. Validation requires
SPDX 2.x, its document identifier, and a nonempty inventory of named packages;
it is not full SPDX conformance or package-to-filesystem verification.

The retrieved provenance uses `https://slsa.dev/provenance/v1`, with maximum-mode
LLB build steps, Dockerfile data, base/frontend/scanner materials, and the
release run URL as builder ID. Its VCS fields declare the expected repository
and revision, while `buildkit_completeness.resolvedDependencies` is `false`.
These build/source fields were inspected for consistency; they are producer
claims, not independently authenticated source provenance. The automated
verifier enforces the supported BuildKit v0.2/v1 format and nonempty maximum-mode
build configuration, not the truth of every provenance field or a SLSA level.

The build and inspection need no Trello credentials. The Dockerfile has no
credential `ARG`/`ENV` inputs, and the workflows pass none to the build. The
reviewed `.dockerignore` excludes `.env`/`.env.*` (except placeholder examples),
local client credential configuration, Git metadata, logs, and local build output.
The inspected build parameters contain public labels/VCS data; no secret build
input was found. Maximum-mode provenance can expose build arguments and source
data: never pass secrets through build arguments or image environment layers.
Review attestations and build records for sensitive content before sharing raw
files. These checks are not a forensic claim that every image byte is secret-free.
See Docker's [Actions attestation guidance](https://docs.docker.com/build/ci/github-actions/attestations/)
and [provenance modes](https://docs.docker.com/build/metadata/attestations/slsa-provenance/)
(mutable documentation reviewed on 2026-10-14 UTC).

### Read-only operator commands

Use a reviewed checkout containing `image:verify`, Node 24.x, and pnpm 10.34.1;
install its locked dependencies with `corepack pnpm install --frozen-lockfile`.
Explicit version/revision/digest inputs can describe a different release than
the checkout. This command shares the stable-release verification library and
uses anonymous pull access only; no Docker daemon, login, Trello credentials,
tool handlers, image execution, publishing, signing, or tag repair is involved.

First resolve the release tag for inspection and compare its displayed digest
with the separately reviewed release evidence above. A tag read alone is not
authentication. Stop on any mismatch; do not replace the expected digest merely
to make verification pass.

```bash
docker buildx imagetools inspect ghcr.io/enthouan/trello-mcp:1.0.3
```

Then perform actual **metadata integrity verification** against the expected
identity. Missing, malformed, mismatched, or incomplete evidence fails nonzero;
network/authentication errors also fail, and are not proof that an image or
signature is absent. Success prints both platform identities, container invocation
fields, statement digests, SBOM counts, provenance format, and the verification limits.

```bash
corepack pnpm image:verify \
  --version 1.0.3 \
  --revision d7c22c78223b60ccabe269ae3af2415957fed861 \
  --digest sha256:198f6758ea06fb786622a5335ad68d6a618adf3e20d1dda1094754d4a02b48a6
```

Use the verified `ghcr.io/enthouan/trello-mcp@sha256:...` reference in the chosen
deployment configuration to keep the selected bytes pinned. These additional
commands are **extraction/inspection**, not signature verification. Buildx
`v0.37.2` was used for this example; `jq` is needed for JSON inspection.

```bash
IMAGE=ghcr.io/enthouan/trello-mcp@sha256:198f6758ea06fb786622a5335ad68d6a618adf3e20d1dda1094754d4a02b48a6
docker buildx imagetools inspect "$IMAGE" --raw | jq .
docker buildx imagetools inspect ghcr.io/enthouan/trello-mcp@sha256:545d7be568b51bf650539f910dbabbde4876bb8c1f95a83c176b19b2d51da797 --raw | jq .
docker buildx imagetools inspect ghcr.io/enthouan/trello-mcp@sha256:bf18952220551e705dace424a7f79c8dbf8356e889661ed56de5bb13962f6d94 --raw | jq .
for platform in linux/amd64 linux/arm64; do
  docker buildx imagetools inspect "$IMAGE" \
    --format "{{ json (index .SBOM \"$platform\").SPDX }}"
  docker buildx imagetools inspect "$IMAGE" \
    --format "{{ json (index .Provenance \"$platform\").SLSA }}"
done
```

The index's `vnd.docker.reference.digest` connects each attestation manifest to
its runnable platform. Inspect either returned `attestationManifests` digest
with `imagetools inspect --raw` to see the statement blob descriptors and
advertised predicates. Buildx's SPDX/SLSA views extract predicates, omitting
the in-toto envelope; the shared verifier reads the actual statement blobs and
checks their subjects and digest chains. See Docker's
[storage format](https://docs.docker.com/build/metadata/attestations/attestation-storage/).
A checksum proves consistency with the expected bytes, not who published them.

`registry:release verify-image` remains release-event-gated and also runs offline
container discovery. Do not spoof GitHub Actions environment variables to use
it for inspection. A cache-only PR build proves buildability, not publication
of attestations. Manual Release image dispatch is main-only; use ordinary PR
validation for this readiness work.

### Signing decision and consumer policy

**Decision: defer maintainer-controlled GHCR signing**, tracked by
[#61](https://github.com/enthouan/trello-mcp/issues/61), with maintainers owning
reconsideration. Existing SBOM/provenance production is retained. No additional
generator, scanner, signing service, or long-lived key is required by the
selected Docker-built submission. Signing GHCR would supply a separate
maintainer identity; it would not satisfy Docker's managed signing policy.
Operators requiring publisher authentication must not treat `image:verify` as
satisfying that requirement. No permissive signature-verification workaround
is part of this policy.

Revisit before adopting the self-provided catalog fallback, or when a concrete
GHCR consumer requires authenticated publisher identity. A separately reviewed
and approved signing change must define keyless CI identity, an exact workflow
and stable-tag ref policy, the GitHub Actions OIDC issuer, a pinned official
tool, job-scoped permissions, failure handling, and identity-constrained consumer
verification. Sign only the already verified index digest after release gates;
exclude PRs, forks, arbitrary branches, and no-push builds. Retry against the
same immutable image without rebuilding; do not silently sign historical
releases. The [Sigstore CI guide](https://docs.sigstore.dev/quickstart/quickstart-ci/)
and [verification guide](https://docs.sigstore.dev/cosign/verifying/verify/)
(reviewed 2026-10-14 UTC) describe the identity/issuer constraints to evaluate.
An authenticated index signature would transitively bind its referenced platform
and attestation bytes through their hashes; it would not prove provenance claims
true, an exhaustive SBOM, reproducible builds, or absence of vulnerabilities.

### Docker-built verification after acceptance

The Docker Registry contribution rules were refreshed at
`49b643ce3fc73e6ee80bb962719b6e2990e3d397`. Docker's
[FAQ](https://docs.docker.com/ai/mcp-catalog-and-toolkit/faqs/) describes build
attestations, source provenance, and signed SBOMs (observed 2026-10-14 UTC).
These are upstream statements, not observed trello-mcp guarantees or endorsement.
[#62](https://github.com/enthouan/trello-mcp/issues/62) is blocked awaiting
Docker confirmation and upstream workflow authorization; neither acceptance of
new submissions nor a 24-hour publication deadline is assumed.

At Gateway revision `a34df45d4ec0e941a9853ad768c4f6cd818966b3`, the
[security policy](https://github.com/docker/mcp-gateway/blob/a34df45d4ec0e941a9853ad768c4f6cd818966b3/docs/security.md#image-verification)
requires digest references and enables signature verification by default for
Docker Hub's `mcp/` images. The
[implementation](https://github.com/docker/mcp-gateway/blob/a34df45d4ec0e941a9853ad768c4f6cd818966b3/pkg/signatures/signatures.go)
uses Docker's embedded public key, the separate `mcp/signatures` repository,
and Rekor bundle verification. Third-party images outside that signing namespace
are **not verified by this Gateway policy**; passing through that path is not a
successful Docker signature verification. Re-audit the installed version and
Docker's documented key distribution before checking a published artifact.

The repository readiness work can merge now. **#61 remains open** and owns the
following evidence; #62 owns acceptance and the deferred Desktop/Gateway checks
transferred from closed-as-superseded #60. A readiness PR uses `Refs #61`.
Transferring this artifact obligation or closing #61 requires an explicit owner
decision recorded with the receiving issue and these acceptance criteria.

- [ ] Confirm the accepted catalog record, `source.commit`, Dockerfile, image
  repository, and publisher. The pending submission selects `mcp/trello-mcp`
  from `d7c22c78223b60ccabe269ae3af2415957fed861`; record any accepted change.
- [ ] Record the immutable Docker index and every runnable platform digest;
  compare architectures, source/revision, configuration, and build metadata
  against the accepted record, without assuming equality with GHCR.
- [ ] Retrieve SBOM/provenance and verify descriptor/blob digests, subjects,
  predicates, package inventory and scope, and source/build declarations.
  Record missing or conflicting evidence as a failure, not an assumed benefit.
- [ ] Verify the exact published digest using Docker's actual trust root and
  signature location; retain the key source/fingerprint, signature subject,
  bundle result, verifier/tool versions, exact successful commands, and date.
  Distinguish a signature over the index from a separately signed SBOM.
  Network or authentication failures are inconclusive failures, not absence.
- [ ] Confirm the applicable Gateway policy is enabled for the selected image
  and the verified digest is the one selected for use. Never use
  `--verify-signatures=false` as a production recommendation or acceptance test;
  earlier local-development exceptions remain dated historical evidence only.
- [ ] Document observed rebuild and update behavior: Docker may rebuild pinned
  source with changed base/dependency inputs; catalog source changes and image
  rebuilds are separate events. Record catalog/profile changes and the operator
  action that actually adopts a new digest, reverify it, and retain the previous
  digest for rollback. An upstream update promise is not observed update behavior.

GHCR exact releases remain immutable by project policy: reruns verify and reuse
existing images, and conflicts fail. Main pushes update `latest` and the commit
image; stable tags publish an exact version then repair commit/minor aliases
from the verified digest, preserving newer minor releases. None of this updates
an already pinned deployment automatically. A frozen dependency install alone
does not make images byte-for-byte reproducible; mutable base tags and build
inputs still matter. Changing a released artifact requires the normal future
release process, not rebuilding or retrofitting an existing exact version.

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
`--network=none`, initializes MCP, checks the server version, compares
`tools/list` with the release source, and waits for the image-defined Docker
health check to pass. Stdio health uses process liveness without HTTP; HTTP
deployments probe `/healthz` on `PORT` (default `3000`). The discovery command
never invokes a Trello tool:

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
4. A read-only `release-policy` job checks out `github.sha`, requires an
   annotated tag object (lightweight tags fail), freshly fetches `origin/main`,
   and rejects tags whose commits are not on main before either publishing job
   starts. All jobs use the exact event commit. The release scripts also require
   an annotated tag and the checkout, tag target, and event SHA to agree.
5. Before any image build, read the exact Registry version with
   `?include_deleted=true`. Conflicting metadata, inactive/deleted entries,
   malformed responses, and unsuccessful lookups stop before any image work.
   Then query the exact public image. If it exists, verify its
   digest, ownership, revision, version, source, command, and both supported
   architectures, plus the attestations below, and reuse it. A conflicting image
   stops the release. A new image may be built only when both the Registry entry
   and exact image are confirmed absent. An identical active Registry entry with
   a missing image fails: never rebuild an already released version. New builds
   use explicit `sbom: true` and `provenance: mode=max` and initially publish only
   the exact version tag.
6. Verify anonymous GHCR access, the ownership annotation on the index and
   `io.modelcontextprotocol.server.name` label on both linux/amd64 and linux/arm64
   configurations, the image digest, and offline stdio discovery and health.
   For each platform, verify the SHA-256 chain from the index through its
   attestation manifest and statement blobs. Require one SPDX SBOM with packages
   and one BuildKit provenance statement with maximum-mode build steps; both
   in-toto subjects must name that platform's digest. Accept the documented
   BuildKit SLSA v0.2 and v1 formats, including OCI artifact manifests.
7. Repair `sha-<full-commit>` and minor `X.Y` image aliases by copying that
   verified index digest, preserving its attestations, and read back each write.
   After image verification and before any alias reads or writes, fetch fresh
   remote annotated release tags. Require the current tag's peeled commit to
   equal the verified release commit; a missing, lightweight, or moved tag stops
   repair. Inspect those same refs before touching the minor alias:
   an older release leaves the line to a newer stable release in the same minor.
   A minor alias already pointing to a verified newer exact image also stays
   untouched. Missing or stale aliases for the current release are repaired on
   reruns without rebuilding or replacing `X.Y.Z`. Alias failures block Registry
   publication.
8. The dependent `registry` job rechecks the exact image digest and production
   Registry entry. An identical active payload is success without authentication
   or republishing. Lookups include `?include_deleted=true` so a deleted version
   cannot be mistaken for an unused version. Only 404 permits publication;
   conflicting metadata, malformed responses, inactive entries, and other
   preflight HTTP errors fail closed.
9. Install the pinned official `mcp-publisher` with its checked-in SHA-256,
   run `validate server.json` against the production validation API, then
   authenticate using `login github-oidc` and publish the unchanged manifest.
   Only this job has `id-token: write`; only the image job has `packages: write`.
   No long-lived Registry secret or device login is needed for normal releases.
10. Read the exact version anonymously from the production API, compare every
   publisher field, and require active status. Ignore only the separate
   Registry-managed response envelope. The workflow summary records version,
   commit, digest, exact API URL, and publication/reuse outcome.

Release workflow runs serialize across the repository so shared image alias
checks and writes cannot race another main or tag run. The shared concurrency
group uses `queue: max` with `cancel-in-progress: false` to preserve pending
releases instead of replacing them with later pushes. GitHub allows up to 100
pending runs; further arrivals are canceled when the queue is full. Release jobs
never intentionally replace an existing exact release image. `latest` is updated only on main;
release retries repair the commit alias and the minor alias when the release
still owns that minor line. Retry the newer release to repair a minor alias it
owns, even when an older release's Registry publication remains outstanding.

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

- **Registry entry exists; exact image is missing:** stop and investigate the
  missing artifact. The pre-build check must fail even when Registry metadata
  matches. A missing image is not permission to rebuild a published version.
- **Remote release tag is missing, lightweight, or moved:** stop before alias
  repair. Investigate the remote identity; do not move tags or use the stale
  checkout's tag as proof of the current remote release.
- **Image succeeded; Registry failed:** inspect the failed step and exact public
  entry, then run `gh run rerun <TAG_RUN_ID> --failed --repo enthouan/trello-mcp`.
  The successful image job stays complete. The Registry job verifies its original
  digest and manifest before retrying. A full rerun also reuses the already
  published image after checking all metadata; it does not rebuild that version.
- **Exact image succeeded; aliases failed:** rerun the failed image job. It
  verifies and reuses the exact image, repairs missing or stale aliases from
  the same digest, and verifies the writes before allowing the Registry job.
  An older release never takes the minor alias back from a newer release.
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
- **Image not public or required metadata missing:** fix package visibility
  without rebuilding when that is the only problem. A missing ownership label
  or required SBOM/provenance cannot be retrofitted onto an immutable exact
  image: prepare a real new packaging release through the normal
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

## Workflow validation

Run the workflow regression tests and actionlint when editing release behavior.
GitHub documents [`queue: max`](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency#example-queueing-multiple-pending-runs),
but actionlint v1.7.12 rejects that key
([upstream compatibility issue](https://github.com/rhysd/actionlint/issues/680)).
Until the installed version supports it, ignore only the exact unsupported-key
diagnostic on `release.yml`. Keep every other diagnostic and workflow enabled.
`tests/mcp-registry.test.ts` requires the shared group, `queue: max`, and
`cancel-in-progress: false`; do not remove the queue to appease an older linter.
Remove the exception when actionlint gains support.

```bash
corepack pnpm exec vitest run tests/mcp-registry.test.ts tests/workflow-actions.test.ts
set -euo pipefail
for workflow in .github/workflows/*.yml; do
  if [ "$workflow" = ".github/workflows/release.yml" ]; then
    actionlint -ignore '^unexpected key "queue" for "concurrency" section\. expected one of "cancel-in-progress", "group"$' "$workflow"
  else
    actionlint "$workflow"
  fi
done
```

## Upstream evidence and pinned tools

Image verification follows Docker's [attestation storage format](https://docs.docker.com/build/metadata/attestations/attestation-storage/)
and BuildKit's [SLSA definitions](https://github.com/moby/buildkit/blob/master/docs/attestations/slsa-definitions.md).
In both supported SLSA formats, the LLB build definition is present only in
maximum mode. Alias repair uses the documented single-index copy behavior of
[`imagetools create`](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/).

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
reviewed at `3c5a658dc154248024a7d0d92d1d9424b132ef4f`, informed the read-only
ancestry gate, deleted-version lookup, online validation, and read-back retry
policy, plus queued concurrency, the Registry-before-build guard, and remote
annotated-tag commit verification. The [official exact-version handler](https://github.com/modelcontextprotocol/registry/blob/970df037919faa70456dde08c295473002d850e5/internal/api/handlers/v0/servers.go)
confirms the `include_deleted` behavior. Trello retains its existing-image reuse
and offline installation checks. The reference PR is not evidence that Trello
publication has run.
