# Docker Hub stable release mirror

GHCR is the primary registry. Compose uses GHCR and the official MCP Registry identifies the exact GHCR version. The maintainer's secondary destination is `docker.io/enthouan/trello-mcp`.

| Tag | Docker Hub | GHCR |
| --- | --- | --- |
| `X.Y.Z` | Immutable copy of the verified release index | Exact release |
| `latest` | Newest eligible stable release | Main branch |
| `X.Y`, `sha-<commit>` | Unpublished | Minor line and commit aliases |

## Enable the destination

Provision the `dockerhub` GitHub Actions environment with owner authorization before merging a workflow that references it. GitHub can implicitly create a missing environment without protection rules. [GitHub environment management](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)

1. Sign in with the existing personal Docker account **enthouan**, confirm control of the namespace and provision or verify the public **trello-mcp** repository. Confirm its name, namespace and public visibility independently using the [anonymous repository endpoint](https://hub.docker.com/v2/namespaces/enthouan/repositories/trello-mcp). An anonymous 404 cannot establish ownership.
2. Check both environment names in `enthouan/trello-mcp` and inspect queued or waiting Release and mirror jobs. Create `dockerhub` explicitly. If it already exists, verify ownership, settings and deployment history with the owner before changing it.
3. In `dockerhub`, choose **Selected branches and tags** (`custom_branch_policies=true`, `protected_branches=false`). Set exactly one **Tag** rule, `v*.*.*`, and disable administrator bypass. Read back the rule type and pattern, zero branch rules, empty required reviewers, no wait timer or custom protection apps, and disabled bypass. The reviewed release PR and subsequent annotated stable tag authorize normal publication. Under this policy, `main` can only preview. [GitHub environments API](https://docs.github.com/en/rest/deployments/environments)
4. After verifying those protections, set the environment variable `DOCKERHUB_CONFIRMED_REPOSITORY=docker.io/enthouan/trello-mcp`. Privately set the environment secrets `DOCKERHUB_USERNAME` for the `enthouan` account and `DOCKERHUB_TOKEN` from the owner's approved secret manager. Use secure stdin or the hidden prompt from `gh secret set DOCKERHUB_TOKEN --repo enthouan/trello-mcp --env dockerhub` and the equivalent command for the username. Keep secret values out of shell arguments, files, logs and chat. [GitHub CLI secret entry](https://cli.github.com/manual/gh_secret_set)

   GitHub does not return stored secret values. If the original token is unavailable, obtain owner authorization for a replacement on the same account with **None / No expiration**, **Repository Read & Write**, no Delete and Cloud Sandboxes off. Verify the token name, access and expiration in Docker's token list before retrying a creation request with an uncertain result. [GitHub environment secrets](https://docs.github.com/en/rest/actions/secrets#get-an-environment-secret) · [Docker token settings](https://docs.docker.com/security/access-tokens/personal-access-tokens/)

5. Read back the variable value and both secret names at environment scope, verify there are zero repository-level `DOCKERHUB_*` secrets or variables, and have the owner confirm provisioning. Keep the existing publisher active until all checks pass. Then land the workflow change through an approved PR against protected `main`. A separately authorized `publish=false` preview skips the writer. The next genuine authorized stable release verifies the credentials end to end.
6. Keep the public Docker Hub overview in sync with the [reviewed overview text](docker-hub-overview.md). Obtain separate approval for overview changes and verify the public text and links after saving.

For routine token rotation, update the environment secret and verify access with the replacement before revoking the superseded token. Revoke a compromised token promptly. During cutover, check which environments still depend on the old credential before retiring it.

## Cutover history and rollback

Retain the protected `docker-hub-mirror` environment and its four historical `main` deployments through cutover. The `v1.0.3`–`v1.0.5` tags predate the mirror workflow and were backfilled from reviewed `main`. [Backfill verification](https://github.com/enthouan/trello-mcp/issues/250#issuecomment-7140022645)

GitHub reruns use the original commit and ref, so a workflow revision that names the old environment will still target it. Historical manual runs used `docker-hub-mirror.yml`. To preview a historical release with current tooling, dispatch `dockerhub.yml` on reviewed `main`. Follow the [emergency manual publication procedure](#emergency-manual-publication) for a backfill. [Deployment history](https://github.com/enthouan/trello-mcp/deployments/activity_log?environments_filter=docker-hub-mirror) · [GitHub rerun semantics](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs) · [Original mirror implementation (#250)](https://github.com/enthouan/trello-mcp/issues/250)

For rollback, check pending jobs in both environments and verify that the old environment still has the tag-only protections, confirmed repository variable and owner-provisioned credentials above. Through a reviewed PR against protected `main`, point `jobs.mirror.environment`, the writer assertion, the diagnostic and the operator instructions back to `docker-hub-mirror`. Keep the tag-only policy in place. Retiring old credentials or deleting the environment requires a separate owner decision after reviewing pending jobs, historical retry needs and deployment records.

## Release and verification

After the approved release PR merges, a stable annotated tag push on the upstream repository runs the existing release-policy and GHCR image jobs. After the image job verifies release identity, both platform images and attestations, native offline discovery and applicable GHCR aliases, it passes the verified source revision and index digest to the mirror. The official Registry job consumes the same verified image independently. Report both jobs even when their outcomes differ. Follow the [primary release procedure](mcp-registry.md#release-preparation-and-publication-order).

The mirror preview reads the exact GHCR tag and the digest-pinned source anonymously. The writer copies from `ghcr.io/enthouan/trello-mcp@sha256:…` using the checksum-pinned Linux AMD64 regctl v0.11.7 and `image copy --force-recursive`. This preserves the original index bytes, both platform manifests, configurations, filesystem layers, attestation manifests and statements. The annotations and labels continue to identify the GHCR build. See the [regctl release](https://github.com/regclient/regclient/releases/tag/v0.11.7), [recursive copy options](https://regclient.org/cli/regctl/image/copy/) and [attestation layout](https://docs.docker.com/build/metadata/attestations/attestation-storage/).

Public reads verify digest and descriptor sizes throughout the graph, streaming filesystem layers. Both linux/amd64 and linux/arm64 must pass Trello's configuration and invocation checks, populated SPDX and maximum-mode BuildKit provenance checks, with statements bound to each platform digest. Separately, the smoke step pulls the mirrored digest anonymously for the runner's platform. It initializes stdio and lists every runtime tool with synthetic Trello credentials, networking disabled and the image's own health check enabled. It reports which platform actually ran. The existing `image:verify` command retains its metadata-only scope.

The workflow treats an identical complete exact tag as a verified no-op. A different exact digest fails. A matching index with confirmed missing referenced content can be repaired from the original source. Authentication errors, ambiguous 404s, throttling and inconclusive read-back cannot authorize an overwrite. If a copy response is lost, the writer reads back the tag and graph with bounded retries before reporting the outcome.

The Docker Hub writer queue is shared by tag runs and authorized emergency recovery runs. GitHub preserves up to 100 pending jobs with `queue: max` and `cancel-in-progress: false`. A fresh view of canonical annotated release tags on protected main reserves `latest` for the greatest eligible numeric version, even while its image or GitHub Release is pending. A backfill can publish an older exact tag while preserving a newer alias. The writer checks the same annotated tag object observed by the image job or recovery preview, including after any emergency environment review.

Once the exact tag passes graph verification and native discovery, the writer reads its index bytes by digest and verifies their SHA-256. Immediately before assigning those bytes to `latest`, it rechecks the release, the exact tag and the current alias. The final alias write sends only the index. Anonymous read-back verifies the result. See [regctl manifest put](https://regclient.org/cli/regctl/manifest/put/). External Docker Hub writers operate outside GitHub's concurrency group. Coordinate any external changes with the owner. See [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## Preview and recover a release

For a failed automatic mirror, rerun the failed mirror job in the original stable tag run. Its tag ref is eligible under the normal environment policy. A retry reuses the verified immutable GHCR source and rechecks ownership of `latest`. Tag reruns execute the workflow from that tag. A historical release whose workflow predates the mirror, or a repair that needs newer reviewed code, requires the manual recovery procedure below.

Use **Docker Hub stable mirror** on reviewed `main` for a read-only preview. Obtain the full source commit and index digest from the original successful image job, including its source discovery and alias results. Confirm the tag still peels to that commit. Verify the original GHCR evidence independently. For example, use the following commands after setting the three variables to the reviewed values.

```bash
corepack pnpm image:verify --version "${tag#v}" --revision "$revision" --digest "$digest"
gh workflow run dockerhub.yml --repo enthouan/trello-mcp --ref main \
  -f tag="$tag" -f revision="$revision" -f digest="$digest" -f publish=false
```

The default preview performs anonymous source graph verification and native source discovery, then inspects the destination. It reads the historical package, Registry manifest and generated runtime catalog in the selected revision's README as data. Code, schema and installed dependencies come from the reviewed workflow checkout. A missing historical catalog stops recovery. A missing or private destination requires owner setup before a successful preview.

## Emergency manual publication

A future manual publication requires owner authorization for the specific release. Schedule the temporary change between stable releases.

1. Record the reviewed workflow commit and successful preview run, release tag, original full revision and GHCR digest, destination exact tag, current exact and `latest` digests, proposed alias action and environment readiness. Obtain owner authorization for that recovery.
2. While the environment still permits only release tags, enable **Required reviewers** with **enthouan** as the reviewer. Allow self-review so the owner can approve their own dispatch. Disable administrator bypass. Read back all three settings before adding any branch.
3. Temporarily add **Branch** `main` to the deployment policy alongside **Tag** `v*.*.*`. Verify the policy and required review. Dispatch the same tag, revision and digest from reviewed `main` with `-f publish=true`. Confirm the run uses the reviewed workflow commit and inspect its preview and pending deployment. The owner approves that exact writer in GitHub.
4. After the approved writer finishes, record its outcome and remove the **Branch** `main` rule, keeping the owner review in place. Read back the policy and confirm its only rule is **Tag** `v*.*.*`.
5. Check for any remaining `main` writers, including queued jobs and deployments waiting for review. Keep the reviewer in place until every `main` writer has finished or been cancelled. Then remove the required reviewer and verify both the tag-only policy and empty reviewer list.

For each publication, record the workflow URL, job and attempt, source and destination index and both platform digests, anonymous graph checks, native platform, full discovery and actual health result, and final `latest` read-back. An authorized repeat should verify exact-tag reuse. Link the original GHCR and official Registry results separately. The Docker-built Catalog submission and its remaining trust evidence are tracked by [#62](https://github.com/enthouan/trello-mcp/issues/62) and [#61](https://github.com/enthouan/trello-mcp/issues/61).
