# Docker Hub stable release mirror

GHCR is the primary registry. Compose uses GHCR and the official MCP Registry identifies the exact GHCR version. The maintainer's secondary destination is `docker.io/enthouan/trello-mcp`.

| Tag | Docker Hub | GHCR |
| --- | --- | --- |
| `X.Y.Z` | Immutable copy of the verified release index | Exact release |
| `latest` | Newest eligible stable release | Main branch |
| `X.Y`, `sha-<commit>` | Unpublished | Minor line and commit aliases |

## Enable the destination

The following setup requires owner authorization. Until a genuine publication has passed anonymous verification, use the [GHCR package](https://github.com/enthouan/trello-mcp/pkgs/container/trello-mcp).

1. Sign in with the existing personal Docker account **enthouan**, confirm control of the namespace and provision or verify the public **trello-mcp** repository. Confirm its name, namespace and public visibility independently using the [anonymous repository endpoint](https://hub.docker.com/v2/namespaces/enthouan/repositories/trello-mcp). An anonymous 404 cannot establish ownership.
2. Create a new personal access token named **trello-mcp GitHub Actions mirror** on that account. Select **None / No expiration**, **Repository Read & Write**, no Delete, and leave Cloud Sandboxes off. The token can act on repositories accessible to the account. No expiration extends its lifetime without adding permissions. Verify the token name, access settings and expiration in Docker's token list before retrying a creation request with an uncertain result. Follow [Docker's token instructions](https://docs.docker.com/security/access-tokens/personal-access-tokens/) and [permissions reference](https://docs.docker.com/security/access-tokens/reference/).
3. Configure the **docker-hub-mirror** environment on the upstream GitHub repository. Allow deployments from the `main` branch and release tags matching `v*.*.*`. The workflow applies the stricter canonical tag check. For per-run approval, select a maintainer as required reviewer who can approve the intended runs. This review gates only the secondary writer. The release PR review and primary publication process continue independently. See [GitHub deployment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments).
4. In that environment install **DOCKERHUB_USERNAME** with the value `enthouan` and **DOCKERHUB_TOKEN** through private secret entry. Store both values at environment scope. The stable release caller forwards those two names explicitly, and the protected writer job receives the environment values. Verify the two names in GitHub separately from verifying token creation on Docker. Once control and public visibility are confirmed, set **DOCKERHUB_CONFIRMED_REPOSITORY** to `docker.io/enthouan/trello-mcp`. Keep tokens out of chat, shell arguments, logs, artifacts and repository files.
5. To change the expiration, issue a replacement token with the intended settings, update the environment secret, verify access, then revoke the superseded token. Revoke a compromised token promptly. Leave credentials for other repositories under their existing owners and workflows.
6. Review the [repository overview draft](docker-hub-overview.md). Publish it to Docker Hub only with separate approval, after the advertised tags are publicly verified. Check the public overview and links after saving.

## Release and verification

A stable annotated tag push on the upstream repository runs the existing release-policy and GHCR image jobs. After the image job verifies release identity, both platform images and attestations, native offline discovery and applicable GHCR aliases, it passes the verified source revision and index digest to the mirror. The official Registry job consumes the same verified image independently. Report both jobs even when their outcomes differ. Follow the [primary release procedure](mcp-registry.md#release-preparation-and-publication-order).

The mirror preview reads the exact GHCR tag and the digest-pinned source anonymously. The writer copies from `ghcr.io/enthouan/trello-mcp@sha256:…` using the checksum-pinned Linux AMD64 regctl v0.11.7 and `image copy --force-recursive`. This preserves the original index bytes, both platform manifests, configurations, filesystem layers, attestation manifests and statements. The annotations and labels continue to identify the GHCR build. See the [regctl release](https://github.com/regclient/regclient/releases/tag/v0.11.7), [recursive copy options](https://regclient.org/cli/regctl/image/copy/) and [attestation layout](https://docs.docker.com/build/metadata/attestations/attestation-storage/).

Public reads verify digest and descriptor sizes throughout the graph, streaming filesystem layers. Both linux/amd64 and linux/arm64 must pass Trello's configuration and invocation checks, populated SPDX and maximum-mode BuildKit provenance checks, with statements bound to each platform digest. Separately, the smoke step pulls the mirrored digest anonymously for the runner's platform. It initializes stdio and lists every runtime tool with synthetic Trello credentials, networking disabled and the image's own health check enabled. It reports which platform actually ran. The existing `image:verify` command retains its metadata-only scope.

The workflow treats an identical complete exact tag as a verified no-op. A different exact digest fails. A matching index with confirmed missing referenced content can be repaired from the original source. Authentication errors, ambiguous 404s, throttling and inconclusive read-back cannot authorize an overwrite. If a copy response is lost, the writer reads back the tag and graph with bounded retries before reporting the outcome.

The Docker Hub writer queue is shared by tag pushes and mirror-only dispatches. GitHub preserves up to 100 pending jobs with `queue: max` and `cancel-in-progress: false`. A fresh view of canonical annotated release tags on protected main reserves `latest` for the greatest eligible numeric version, even while its image or GitHub Release is pending. A backfill can publish an older exact tag while preserving a newer alias. The writer checks the same annotated tag object observed by the image job or recovery preview, including across an environment approval wait.

Once the exact tag passes graph verification and native discovery, the writer reads its index bytes by digest and verifies their SHA-256. Immediately before assigning those bytes to `latest`, it rechecks the release, the exact tag and the current alias. The final alias write sends only the index. Anonymous read-back verifies the result. See [regctl manifest put](https://regclient.org/cli/regctl/manifest/put/). External Docker Hub writers operate outside GitHub's concurrency group. Coordinate any external changes with the owner. See [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## Preview and recover a release

Use **Docker Hub stable mirror** on reviewed `main` for recovery or backfill. Obtain the full source commit and index digest from the original successful image job, including its source discovery and alias results. Confirm the tag still peels to that commit. Verify the original GHCR evidence independently. For example, use the following commands after setting the three variables to the reviewed values.

```bash
corepack pnpm image:verify --version "${tag#v}" --revision "$revision" --digest "$digest"
gh workflow run docker-hub-mirror.yml --repo enthouan/trello-mcp --ref main \
  -f tag="$tag" -f revision="$revision" -f digest="$digest" -f publish=false
```

The default preview performs anonymous source graph verification and native source discovery, then inspects the destination. It reads the historical package, Registry manifest and generated runtime catalog in the selected revision's README as data. Code, schema and installed dependencies come from the reviewed workflow checkout. A missing historical catalog stops recovery. A missing or private destination requires owner setup before a successful preview.

Before authorizing publication, record the tag, full revision, source digest, target repository and exact tag, current exact and latest digests, proposed latest decision, workflow ref and preview run, and environment readiness. After approval, dispatch the same reviewed inputs with `-f publish=true`. Review the environment request if configured. A failed mirror can be retried independently this way. Leave the original release tag, successful primary jobs and existing exact images intact.

For acceptance, record the workflow URL, job and attempt, source and destination index and both platform digests, anonymous graph checks, native platform, full discovery and actual health result, and final latest read-back. An authorized repeat should verify exact-tag reuse. Link the original GHCR and official Registry results separately and record public overview verification if published. Keep [#250](https://github.com/enthouan/trello-mcp/issues/250) open until the production evidence exists. The Docker-built Catalog submission and its remaining trust evidence are tracked by [#62](https://github.com/enthouan/trello-mcp/issues/62) and [#61](https://github.com/enthouan/trello-mcp/issues/61). The maintainer mirror carries the original build metadata and makes no Docker-managed signing claim.
