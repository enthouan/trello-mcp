---
name: trello-mcp-release
description: Use when cutting, preparing, publishing, or verifying a trello-mcp release. Covers protected-main release PRs, version and changelog updates, vX.Y.Z tag publication, GitHub Actions release workflow checks, GHCR ownership and image verification, official MCP Registry OIDC publication, exact-version verification, and safe recovery.
---

# Trello MCP Release

## Guardrails

- `main` is protected. Do not commit or push directly to `main`; all file changes must land through a PR.
- The user's review of the release PR is the only normal approval boundary. After opening the release PR, ask the user to review that exact PR and wait for their approval.
- Once the user says the release PR is reviewed or approved, continue automatically for that exact `vX.Y.Z`: wait for required checks, merge it, push the tag, verify workflows/GHCR and the exact official MCP Registry entry, create the GitHub Release, and close the milestone when its remaining criteria are complete. Do not ask separately for merge approval or publish approval.
- Do not move, delete, or retag existing release tags.
- In this repo, the normal release artifact is an annotated Git tag, GHCR images, an exact verified official MCP Registry entry, and a GitHub Release titled exactly `vX.Y.Z`.
- Release tags should point at the current `origin/main` commit after the release prep PR has merged.
- Keep secrets out of commits, logs, PR text, and release notes.
- Follow [the official Registry release and recovery guide](../../../docs/mcp-registry.md). The Registry identity is `io.github.enthouan/trello-mcp`; Docker MCP Registry (#62) and Glama (#66) remain separate catalogs.
- Never declare a release complete based only on static tests or publisher exit status. Require the exact active production Registry payload to match the release manifest.

## Refresh State

Run these first:

```bash
git fetch --prune --tags origin
git status --short --branch
git log --oneline --decorate -n 10 origin/main
gh pr list --repo enthouan/trello-mcp --state open --json number,title,url,isDraft
gh issue list --repo enthouan/trello-mcp --state all --limit 300 \
  --json number,title,state,milestone,projectItems,url
gh api repos/enthouan/trello-mcp/milestones --paginate \
  --jq '.[] | {number,title,state,open_issues,closed_issues,description}'
gh run list --repo enthouan/trello-mcp --branch main --limit 10 \
  --json databaseId,name,headSha,status,conclusion,createdAt,url
gh release list --repo enthouan/trello-mcp --limit 10
git tag --list 'v*.*.*' --sort=-v:refname | head -n 10
gh workflow view Release --repo enthouan/trello-mcp --yaml
```

Then choose the target version from the current `package.json`, `CHANGELOG.md`,
existing tags, merged work, and semver impact. Stop if the target `vX.Y.Z` tag
or GitHub release already exists.

If the release maps to a GitHub milestone or roadmap slice, confirm that there
are no open milestone issues and that related project items are in a completed
state before preparing the PR.

## Prepare The Release PR

Use a branch from `origin/main`, for example:

```bash
git switch -c antoine/release-vX.Y.Z origin/main
```

Make the smallest release metadata change:

- Set `package.json` `version` to `X.Y.Z`.
- Set `server.json` `version` to `X.Y.Z` and its OCI identifier to `ghcr.io/enthouan/trello-mcp:X.Y.Z`. Preserve `TRANSPORT=stdio`, the independent/community disclaimer, and both required secret Trello inputs without values.
- Run `corepack pnpm registry:check` to validate the vendored official schema, ownership label, and package/manifest/image version alignment. Do not substitute `latest` or an older image. Verify the Dockerfile label and Release index annotation both equal `io.github.enthouan/trello-mcp`. Older artifacts without ownership metadata require a real new packaging release; never retrofit a published image.
- Add the new `CHANGELOG.md` section at the top with user-facing changes grouped like existing releases.
- Update docs only when release behavior or supported commands changed.
- If the release adds, removes, renames, or materially changes public MCP tools
  or Trello endpoint coverage, check `docs/api-coverage.md` and update the
  matrix if status, tool coverage, unsupported endpoint families, rationale, or
  follow-up links changed. If the matrix was checked but unchanged, note that
  in the release PR validation or handoff.
- If public MCP tool names, descriptions, or key inputs changed, run
  `corepack pnpm docs:tools`.
- If package-manager metadata changes, include the resulting lockfile update.

Validate before opening or marking the PR ready:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
corepack pnpm registry:check
corepack pnpm exec vitest run tests/mcp-registry.test.ts tests/container-health.test.ts tests/workflow-actions.test.ts
```

Use `corepack pnpm test:coverage` if the release prep includes core behavior,
tool registration, error handling, or CI/release workflow changes.

If the release adds or changes public MCP tools, also smoke the common
discovery and auth workflows from a connected MCP client when one is
available: `auth_whoami` and `auth_token_info` should identify the configured
member and token, and `list_boards`, `list_workspaces`, `workspace_boards`,
and `member_get` with `me` should return compact, readable shapes. Note in the
release PR whether this manual smoke ran or was skipped.

Review the release diff like an external reviewer before publishing the PR:

```bash
git diff --check
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- package.json server.json CHANGELOG.md README.md CONTRIBUTING.md docs/api-coverage.md docs/mcp-registry.md Dockerfile scripts/mcp-registry.ts scripts/lib/mcp-registry.ts .github/workflows/release.yml
```

Open the PR with a direct title such as `vX.Y.Z`. Include validation
commands and note any skipped checks with reasons. Keep Codex attribution out
of the PR title, commits, and body. If the release maps to a milestone or
GitHub Project item, add the PR to the same tracking surfaces.

After opening the PR, run the manual live regression workflow against the PR
branch before asking the user for release review. Use the full suite by default
so release validation covers the public tool surface; use `domains` or `tools`
filters only for a clearly scoped release candidate or focused debugging, and
state any filters in the PR/review handoff.

```bash
gh workflow run "Live Trello Regression" --repo enthouan/trello-mcp \
  --ref <RELEASE_BRANCH>
gh run list --repo enthouan/trello-mcp --workflow "Live Trello Regression" \
  --branch <RELEASE_BRANCH> --event workflow_dispatch --limit 5 \
  --json databaseId,status,conclusion,createdAt,url,headBranch,headSha
gh run watch --repo enthouan/trello-mcp <LIVE_REGRESSION_RUN_ID> --exit-status
gh run view --repo enthouan/trello-mcp <LIVE_REGRESSION_RUN_ID> --log-failed
```

If the run passes, include the workflow run URL and mention the
`live-regression-report` artifact in the release PR handoff. If the run fails,
inspect the failed logs and uploaded report before proceeding. Treat a failed
or missing live regression run as a release-prep blocker unless the user
explicitly accepts a skipped result for that release.

Ask the user once to review the release PR. Include the PR URL, target version,
and validation summary, and state that after they approve/review that PR you
will automatically wait for checks, merge, tag, publish and verify GHCR and the
official Registry, create the GitHub Release, and close any completed milestone
for the same version. Registry publication requires no separate approval.

After the user says the release PR is reviewed or approved, wait for PR checks:

```bash
gh pr checks <PR_NUMBER> --repo enthouan/trello-mcp --watch
```

## Merge

If checks fail, stop and report the failure. If checks pass, merge through
GitHub without asking for another approval. Do not bypass the branch protection
rule.

Refresh and verify the merged state:

```bash
git fetch --prune --tags origin
gh pr view <PR_NUMBER> --repo enthouan/trello-mcp --json state,mergedAt,mergeCommit,title
git log --oneline --decorate -n 5 origin/main
git show origin/main:package.json | rg '"version": "X.Y.Z"'
git show origin/main:CHANGELOG.md | sed -n '1,80p'
```

The merge also starts the `Release` workflow for the default branch, which
updates `latest` and the main-commit `sha-...` image. Check it before tagging;
if it fails, fix that through a follow-up PR before publishing `vX.Y.Z`.

```bash
gh run list --repo enthouan/trello-mcp --workflow Release --branch main --limit 5
gh run watch --repo enthouan/trello-mcp <MAIN_RUN_ID>
gh run view --repo enthouan/trello-mcp <MAIN_RUN_ID> --log-failed
```

After the merge, verify the main-branch state and main release workflow result,
then continue directly to Tag And Publish. Do not pause for another approval
before pushing the release tag, creating the GitHub Release, or closing the
milestone.

## Tag And Publish

Run this immediately after the reviewed/approved release PR is merged and the
main release workflow result is verified. The user's PR review approval covers
the normal release-side effects for the exact `vX.Y.Z`: tag push, GHCR publish
verification, official MCP Registry publication and exact-version verification,
GitHub Release creation, and milestone closure when all milestone work is done.

Stop and ask for explicit approval only when a corrective action would rewrite
history or replace published release state, such as moving/deleting a tag,
force-pushing, rewriting `main`, or replacing an existing GitHub Release.

Fetch the merged main commit and ensure the tag does not already exist:

```bash
git fetch --prune --tags origin
git show origin/main:package.json | rg '"version": "X.Y.Z"'
git show origin/main:CHANGELOG.md | sed -n '1,80p'
git tag --list "vX.Y.Z"
```

Create and push an annotated tag on `origin/main`:

```bash
git tag -a vX.Y.Z origin/main -m "vX.Y.Z"
git push origin vX.Y.Z
```

Watch release workflows for both the merged `main` push and the tag push. The
main workflow publishes `latest` and `sha-<full-main-sha>`; the tag workflow
publishes only `X.Y.Z` initially, verifies the image and its attestations, then
repairs `sha-<full-main-sha>` and minor `X.Y` from the verified digest. A retry
of an older release leaves a newer release's minor line untouched. Repository-wide
Release concurrency serializes these shared alias checks and writes.

```bash
gh run list --repo enthouan/trello-mcp --workflow Release --limit 10 \
  --json databaseId,name,headBranch,headSha,status,conclusion,event,createdAt,url
gh run watch --repo enthouan/trello-mcp <MAIN_RUN_ID> --exit-status
gh run watch --repo enthouan/trello-mcp <TAG_RUN_ID> --exit-status
gh run view --repo enthouan/trello-mcp <TAG_RUN_ID> --log-failed
```

For GHCR, verify the exact version, moving minor, and commit tags. `latest`
should move only on default-branch pushes, not because of the semver tag run.

```bash
docker buildx imagetools inspect ghcr.io/enthouan/trello-mcp:X.Y.Z
docker buildx imagetools inspect ghcr.io/enthouan/trello-mcp:X.Y
docker buildx imagetools inspect ghcr.io/enthouan/trello-mcp:sha-<full-main-sha>
```

If any publish step fails, report the failed step and sanitized error before
trying manual repair. Prefer a follow-up PR for workflow fixes; never repush
the same release tag. Follow Registry Recovery below when GHCR succeeded.

Create the GitHub Release only after the tag workflow, GHCR image checks, and
exact official Registry payload verification pass. Use the title `vX.Y.Z` exactly, without `release` or any other suffix,
and use the changelog section as notes.

```bash
version=X.Y.Z
gh release create "v${version}" --repo enthouan/trello-mcp --title "v${version}" \
  --notes "$(git show origin/main:CHANGELOG.md | awk -v "tag=v${version}" '$0 == "## " tag {p=1; next} /^## v/ && p {p=0} p {print}')"
gh release view "v${version}" --repo enthouan/trello-mcp \
  --json tagName,name,isDraft,isPrerelease,publishedAt,url
```

Finish with the PR URL, tag and exact commit, image and Registry job URLs,
verified GHCR tags and digest, exact public Registry API URL and matching active
payload result, offline discovery result, and GitHub Release URL. Distinguish
local/static checks from an observed successful production OIDC run.

If the release completes a milestone, close it only after the tag workflow,
GHCR image checks, and exact live Registry verification have passed and its other
issues are complete. A packaging patch can belong to the distribution milestone
without completing unrelated catalog submissions. Use non-closing PR references
while live publication or automation verification is outstanding; keep the
tracking issue open with a precise next action until all acceptance criteria pass.


## Official Registry Job And Verification

The read-only `release-policy` job rejects lightweight tags, requires the
annotated tag target to match the event commit, freshly fetches protected `main`,
and rejects unmerged tag commits before jobs with publishing permissions start. The tag
workflow validates the tag/package/manifest/image versions at the exact release
commit before building. It checks whether the exact GHCR image already
exists, validates and reuses a matching image, and fails on conflicting metadata.
Builds explicitly generate SPDX SBOMs and maximum BuildKit provenance. Before
Registry publication, verification checks public anonymous access, ownership
metadata, version, revision, source, and digest on both architectures. It verifies
the SHA-256 chain through the attestation manifests and blobs, requires maximum
provenance build steps and populated SPDX SBOMs, and binds their in-toto subjects
to each platform image digest. Missing or mismatched attestations block reuse.
It initializes stdio, lists tools, and waits for the actual image health check
with synthetic credentials and container networking disabled. Stdio health uses
process liveness; HTTP health probes the configured port. This check cannot call
Trello. Only after verification may alias repair copy the unchanged index and
read back its digest; alias failure blocks the dependent Registry job.

The dependent `registry` job runs only on stable tag pushes, after image
verification succeeds. It uses the checksum-verified pinned official publisher
to validate `server.json` through the production API before GitHub Actions OIDC
(`id-token: write` only in that job). No routine device login or long-lived
publishing secret is needed. PRs, ordinary main pushes,
prereleases, and manual image dispatches must not publish Registry entries.

Watch `release-policy`, `image`, and `registry` in the original tag Release run.
Require its summary to report the release commit, verified image digest, exact
version URL, and full payload match. From the exact release checkout, independently run:

```bash
corepack pnpm registry:release verify
```

This anonymously reads the production API at
`https://registry.modelcontextprotocol.io/v0.1/servers/io.github.enthouan%2Ftrello-mcp/versions/X.Y.Z`,
compares all publisher metadata with `server.json`, and requires active status.
A Registry search result or `latest` alias alone is insufficient. Include this
evidence in the tracking issue before closing it.

## Registry Recovery

- If the image job succeeded and Registry publication failed, inspect the exact
  API entry and rerun only failed jobs:
  `gh run rerun <TAG_RUN_ID> --failed --repo enthouan/trello-mcp`. The original
  image digest and release manifest are reused. Even a full rerun verifies and
  reuses the existing exact image instead of rebuilding it. If alias publication
  failed, rerun the image job to repair missing/stale commit and minor aliases
  from that digest. A newer remote annotated release tag owns its minor line;
  retry that newer release for minor-alias repair. An already-published newer
  exact image also prevents moving the minor alias backward.
- Identical active Registry metadata is a verified no-op. Exact-version lookups
  include `?include_deleted=true`; only 404 means absent. Conflicts, inactive or
  deleted entries, malformed responses, preflight HTTP errors, and image metadata
  mismatches must fail clearly. Do not overwrite entries.
- If a publish response was lost, check production before retrying. The script
  reconciles a matching entry and makes at most six read-back attempts for
  propagation, network failures, or HTTP 408/429/5xx. It never retries the write
  and stops immediately on invalid or conflicting metadata. If verification
  remains inconclusive, retry the same version and immutable image.
- Never move Git release tags, replace exact version images, or invent a new
  version merely to retry. Repairing moving image aliases from a verified digest
  is part of normal recovery. An image that lacks required ownership metadata
  or SBOM/provenance requires a real packaging release through the usual PR
  review boundary.
- Workflow reruns use the original workflow commit. For a defect requiring new
  tooling, prepare a reviewed fix and follow the manual recovery procedure in
  `docs/mcp-registry.md` against the original tag's manifest and image. Pause for
  interactive authorization if needed. Record manual recovery honestly and leave
  automated publication verification outstanding until a genuine stable release
  exercises the corrected workflow.
