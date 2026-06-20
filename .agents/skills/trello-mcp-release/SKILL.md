---
name: trello-mcp-release
description: Use when cutting, preparing, publishing, or verifying a trello-mcp release. Covers protected-main release PRs, version and changelog updates, vX.Y.Z tag publication, GitHub Actions release workflow checks, and GHCR image verification.
---

# Trello MCP Release

## Guardrails

- `main` is protected. Do not commit or push directly to `main`; all file changes must land through a PR.
- The user's review of the release PR is the only normal approval boundary. After opening the release PR, ask the user to review that exact PR and wait for their approval.
- Once the user says the release PR is reviewed or approved, continue automatically for that exact `vX.Y.Z`: wait for required checks, merge it, push the tag, verify workflows/GHCR, create the GitHub Release, and close the milestone. Do not ask separately for merge approval or publish approval.
- Do not move, delete, or retag existing release tags.
- In this repo, the normal release artifact is an annotated Git tag, GHCR images, and a GitHub Release titled exactly `vX.Y.Z`.
- Release tags should point at the current `origin/main` commit after the release prep PR has merged.
- Keep secrets out of commits, logs, PR text, and release notes.

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
git switch -c release-vX.Y.Z origin/main
```

Make the smallest release metadata change:

- Set `package.json` `version` to `X.Y.Z`.
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
git diff origin/main...HEAD -- package.json CHANGELOG.md README.md CONTRIBUTING.md docs/api-coverage.md .github/workflows/release.yml
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
  --ref <RELEASE_BRANCH> \
  -f board_ref=<DISPOSABLE_BOARD_ID_OR_SHORT_LINK>
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
will automatically wait for checks, merge, tag, publish, verify, and close the
milestone for the same version.

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
verification, GitHub Release creation, and milestone closure.

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
publishes `X.Y.Z`, moving minor `X.Y`, and `sha-<full-main-sha>`.

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

If any publish step fails, report the failed command and exact error before
trying manual repair. Prefer a follow-up PR for workflow fixes; never repush
the same release tag.

Create the GitHub Release only after the tag workflow and GHCR image checks
pass. Use the title `vX.Y.Z` exactly, without `release` or any other suffix,
and use the changelog section as notes.

```bash
version=X.Y.Z
gh release create "v${version}" --repo enthouan/trello-mcp --title "v${version}" \
  --notes "$(git show origin/main:CHANGELOG.md | awk -v "tag=v${version}" '$0 == "## " tag {p=1; next} /^## v/ && p {p=0} p {print}')"
gh release view "v${version}" --repo enthouan/trello-mcp \
  --json tagName,name,isDraft,isPrerelease,publishedAt,url
```

Finish with the PR URL, tag, workflow run URL, verified GHCR tags, and GitHub
Release URL.

If the release completes a milestone, close the milestone only after the tag
workflow and GHCR image checks have passed.
