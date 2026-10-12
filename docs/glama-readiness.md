# Glama MCP registry readiness audit

Last verified: **2026-10-12**. Implementation: [#65](https://github.com/enthouan/trello-mcp/issues/65).

## Readiness decision and disposition

The repository has a **locally verified candidate Glama-compatible build and
stdio discovery path**. Built source, its Docker image, and the published
`v1.0.3` image initialize without functional credentials and enumerate all 77
intended tools under network isolation. This is not a Glama acceptance, indexing,
security, or TDQS result. Actual Glama configuration remains unobserved.

| Disposition | Evidence / decision |
| --- | --- |
| Already satisfied | Public personal repository, MIT license, README/install/configuration documentation, Node 24 frozen build, non-root Docker runtime, stdio/Streamable HTTP, transport-aware health, centralized Trello client, disabled-by-default local upload. |
| Concrete changes required | Correct understated permanent deletion and upload transmission, distinguish label creation from assignment, expose custom-field conditional requirements, and replace misleading natural-language search wording. Add reproducible full-schema discovery and zero-request regression coverage; replace the August audit and obsolete prose assertions. |
| Local proof needed, now executed | Source, source-image, and immutable-release discovery; stdout/stderr and synthetic-value checks; exact tool/schema comparisons; source network-denial negative control; real image health in stdio and HTTP; clean shutdown and scoped cleanup. See the matrix below. |
| External observations deferred | [#66](https://github.com/enthouan/trello-mcp/issues/66): exact profile search, ownership verification, approved build instructions, actual Glama discovery, score/security findings and search visibility. |
| Specifically tracked gaps | [#182](https://github.com/enthouan/trello-mcp/issues/182): typed runtime annotations, catalog alignment, sibling ergonomics and richer parameter/result guidance. [#206](https://github.com/enthouan/trello-mcp/issues/206): deliberate output schemas and structured results after the SDK work. Neither is absorbed into #65. |

No evidence establishes a need for new package metadata, `bin`/npx packaging,
cosmetic titles, or a root `glama.json`. No dependencies, transports, handlers,
release metadata, or Docker health behavior changed. The Docker fallback was
regenerated only because its descriptions derive from the runtime definitions;
its separate upstream submission is outside this work.

## Pinned evidence and current requirements

| Evidence | Revision / observation |
| --- | --- |
| Starting `origin/main` | `e6bacd34b03542663548ae00e85160571dd2bdce`, containing merged PR #227; canonical checkout clean, one commit behind, before branching from the fetched remote. |
| Tested implementation source | `76fe34b9347dc4d5faaf5dfd1f77c94dcda2e06f`; later audit-only edits do not alter the tested runtime. |
| Published release | [v1.0.3](https://github.com/enthouan/trello-mcp/releases/tag/v1.0.3), published 2026-10-09; annotated tag source `d7c22c78223b60ccabe269ae3af2415957fed861`. |
| TDQS | [v1.3 specification at b9881b0cfec88969e42672c92544487ca191a992](https://github.com/glama-ai/tool-definition-quality-score/blob/b9881b0cfec88969e42672c92544487ca191a992/README.md), current upstream head when read. |
| Mutable requirements | [Methodology](https://glama.ai/mcp/methodology), [server directory](https://glama.ai/mcp/servers), [ownership guidance](https://glama.ai/blog/2025-07-08-what-is-glamajson), and [server schema](https://glama.ai/mcp/schemas/server.json), read 2026-10-12. |
| Submission wording | Public [Add Server bundle](https://glama.ai/client/AddMcpServerModal-Ce09_ZZv.js), read 2026-10-12. The signed-out Add Server button opened sign-up; no authentication or form submission occurred. Bundle URLs are dated observations, not stable API contracts. |

The current public submission client calls its source option **Runs from source**
and asks for name, description, and GitHub repository URL. Its review message
says Dockerfile instructions arrive after approval. The authenticated form and
selected build configuration were not observed. The candidate below must be
adapted to that actual configuration in #66.

Glama's methodology describes source ingestion, isolated builds, protocol
introspection, behavioral inspection and repeated scoring. A profile can exist
while build failure prevents search distribution. Ownership, submission, build,
introspection, public listing, scoring/security, and search visibility are
independent states. Hosting, Gateway, deployment and Make Release are not
established prerequisites for this source-listing preparation.

The ownership guidance permits GitHub association for personal repositories.
This repository is personal; actual association belongs to #66. An absent
`glama.json` is not automatically a build or submission blocker. The current
schema requires `maintainers`, a unique array of strings; it declares no command,
environment, transport or deployment fields. If observed ownership requirements
later justify a file, validate the current schema and use only a minimal
maintainer declaration. Do not create configuration fields by analogy with
other registries.

No current authenticated directory/API identity was established. In particular,
the planning API HTTP 401 is an authentication failure, not evidence of absence.
The August claim that no listing exists is withdrawn. #66 must search for the
exact repository, including automatic ingestion, before choosing claim or submit.
No badge or accepted-listing link is justified yet.

## Credential-independent validation matrix

Host: macOS x64, Node **24.17.0**, pnpm **10.34.1**. Docker Desktop **4.94.0**,
Engine/CLI **29.8.2**, local execution **linux/amd64**. The matching release
checkout's probe launcher used Node 24.18.0; the MCP runtime ran inside its image.

The source image was built from the committed implementation using the root
Dockerfile. Published-image comparisons used the `v1.0.3` source/manifest extracted
separately, with only the non-publishing inspection helper copied into that
checkout. Shared dependencies match the identical release lockfile. No version
was changed to conceal source-versus-release drift.

| Artifact | Identity | stdio discovery | Actual image health | Shutdown / cleanup |
| --- | --- | --- | --- | --- |
| Built source | `76fe34b9347dc4d5faaf5dfd1f77c94dcda2e06f` | Pass; macOS `(deny network*)`; 77 tools | Not applicable | SIGTERM, code 0, shutdown log |
| Source-built image | Local ID `sha256:427b9c70e4b0120c86fe0fe80a0318b6931a97d35873d2b38ef1c5920da2056d` | Pass; `--network=none`; full definitions equal built source | Healthy in stdio and HTTP | Code 0; empty `docker diff`; temporary containers removed |
| Published image | `ghcr.io/enthouan/trello-mcp@sha256:198f6758ea06fb786622a5335ad68d6a618adf3e20d1dda1094754d4a02b48a6` | Pass against matching `v1.0.3`; `--network=none`; 77 tools | Healthy in stdio and HTTP | Code 0; empty `docker diff`; temporary containers removed |

All three initialize responses negotiated **2025-11-25**, server name
`trello-mcp`, version **1.0.3**, and capabilities
`{"tools":{"listChanged":true}}`. Each `tools/list` completed in one page with
no cursor, missing, duplicate or unexpected names. The probe follows pagination
and rejects repeated cursors; tests exercise these paths. Attachment upload
remained enumerated with the upload root unset. The 76-tool Docker Registry
fallback intentionally excludes that tool and is not the expected Glama catalog.

Both `resources/list` and `prompts/list` returned protocol **-32601
MethodNotFound**. Neither capability is advertised. These are unsupported
methods, not successful empty catalogs. The low-level client request records the
server response rather than a local convenience-method capability error.

All 77 definitions expose descriptions and Zod-derived object input schemas;
every top-level property has a description. Full source and source-image schemas
match, including requiredness, defaults, enums, constraints and nullable inputs.
No tool has a title, annotations or outputSchema. JSON text is the existing
handler-result format. Refinements such as custom-field type/value requirements
remain enforced at invocation even when not expressible in the wire schema;
parameter prose now states that particular conditional contract explicitly.

The SHA-256 of `JSON.stringify(capture.tools)` is:

- source and source image: `9d4d75825a0f5ab785661f99e65c07c4833d2ccafc1fb2f6c1aa43a14ecbe559`;
- published release: `08ad9caa75d0399ee8fb43d843d6beaaddd5c5433551919f35cd5fb8d16863c4`.

Release drift is expected: this change improves 13 descriptions and three
property descriptions across 14 tools. Names, validation behavior, capabilities,
version and health are unchanged. The release does not contain these new words.
The non-publishing `verifyImage` function from the release source independently
verified the index digest, anonymous accessibility, ownership/source/version/
revision metadata, both architecture configurations and digest-linked maximum
provenance/SPDX attestations. Execution was amd64 only; arm64 provenance
verification is not arm64 runtime testing.

### Reproduction and isolation

Run from the source being compared, using its pinned Node/pnpm versions:

```bash
CI=true corepack pnpm install --frozen-lockfile
corepack pnpm build
node --import tsx scripts/glama-discovery.ts source /tmp/glama-source.json
docker build --label org.opencontainers.image.revision=76fe34b9347dc4d5faaf5dfd1f77c94dcda2e06f -t trello-mcp:issue65-glama-20261012 .
node --import tsx scripts/glama-discovery.ts image /tmp/glama-image.json trello-mcp:issue65-glama-20261012
corepack pnpm registry:release discover trello-mcp:issue65-glama-20261012
```

The new probe writes complete initialization, tool schemas/metadata, resource/
prompt responses, stderr, image configuration, health, filesystem changes and
exit results to the specified local file. It verifies output safety and cleanup
before reporting success. The older `discover` command remains a separate check
of names, version and Docker health; it does not provide the full-schema proof.
Neither command publishes anything or invokes a tool handler.

For the published image, extract `v1.0.3` with `git archive` into a separate
directory, install its frozen dependencies, copy `scripts/glama-discovery.ts` and
`scripts/lib/mcp-discovery.ts` there, and run the same image probe and existing
`registry:release discover` using the immutable reference above. Do not compare
an older image to a newer catalog and call legitimate drift a release failure.

The source child receives only `TRANSPORT`, `LOG_LEVEL`, `TRELLO_API_KEY` and
`TRELLO_TOKEN`, using fixed, nonfunctional synthetic values. It runs the absolute
Node executable and `dist/index.js` beneath macOS `sandbox-exec` with
`(version 1)(allow default)(deny network*)`. A negative-control connection to
`127.0.0.1:9` failed with **EPERM**, confirming denial rather than assuming it.
On other hosts the source mode fails closed; use an explicitly isolated runtime.
The in-memory regression injects a throw-on-use fetcher and asserts **zero
requests and zero fetch calls** through initialization and all discovery methods.

Docker receives explicit synthetic runtime variables, no `--env-file`, no host
mount, no upload root and no published port. Only PATH and HOME are allowed into
the Docker CLI for its local context/socket; these are not forwarded into the
container. Source startup does not load `.env`. No real Trello credentials were
read, passed, or used by the validation probes.

### Transport-specific health

The image-defined health command was retained, without `--no-healthcheck` or an
override. Stdin remained open through the real MCP client during stdio checks.
The successful initialize/tools exchange proves responsiveness independently of
Docker's stdio process-liveness status. Executing each image's actual health
JavaScript with a throw-on-fetch spy in stdio observed zero HTTP probes.

For each image the HTTP check used this shape, with a unique task-specific name:

```bash
docker run -d --network=none --name <unique-health-container> \
  -e TRANSPORT=http -e PORT=4321 -e LOG_LEVEL=debug \
  -e TRELLO_API_KEY=synthetic-http-glama-key \
  -e TRELLO_TOKEN=synthetic-http-glama-token <image-reference>
docker inspect --format '{{json .State.Health}}' <unique-health-container>
docker exec <unique-health-container> node --input-type=module -e "const r=await fetch('http://127.0.0.1:4321/healthz'); console.log(r.status,await r.json())"
docker diff <unique-health-container>
docker stop --time 5 <unique-health-container>
docker inspect --format '{{.State.ExitCode}}' <unique-health-container>
docker logs <unique-health-container>
docker rm <unique-health-container>
```

Both scheduled health checks became healthy; container-local `/healthz` returned
HTTP **200** and `{"status":"ok"}` on **4321**. Inspected network mode was `none`
and port bindings were empty. No HTTP endpoint was exposed. HTTP logs used
stdout, stdio logs used stderr, and no synthetic credential appeared in either
stream. All stdio stdout lines were JSON-RPC. Both HTTP processes shut down with
code 0, empty filesystem diffs and removed temporary containers.

## Complete tool-quality audit

This is an implementation review of actual `tools/list` and all nine definition
modules, informed by the pinned TDQS specification. It is **not a computed TDQS
score**. Its dimensions are Purpose Clarity, Usage Guidelines, Behavioral
Transparency, Parameter Semantics, Conciseness & Structure, and Contextual
Completeness. The current specification evaluates actual documented output
fields; a placeholder output schema earns no completeness claim.

Every row shares two tracked omissions: **M** = annotations/catalog semantics in
[#182](https://github.com/enthouan/trello-mcp/issues/182); **O** = output schemas/
structured results in [#206](https://github.com/enthouan/trello-mcp/issues/206).
Titles are optional and no functional selection problem requires cosmetic ones.
**Adequate** means the existing purpose/input wording is usable with M/O still
open; **Fixed** identifies a concrete wording defect addressed here.

Behavior notation is derived from handlers, not name prefixes: **R** reads Trello
without mutation; repeated reads may return changed external state. **C** creates
new state, is not idempotent and can duplicate on replay. **S** sets existing
state; restoring it needs old values and permissions. **A** adds/removes an
association, reversible by its sibling while the objects remain accessible.
**D** permanently removes state; repeating may fail because the resource is gone.
S/A/D do not promise safe retries or notification-free replay. Reordering and
cross-board moves can depend on intervening changes. All operations are
**open-world Trello operations**, including diagnostics; upload additionally
reads a guarded local file. No runtime hint claims otherwise.

| Tool | Purpose, schema/parameter clarity and sibling distinction | Behavior / reversibility | Disposition |
| --- | --- | --- | --- |
| `auth_whoami` | Current authenticated member; described fields; unlike member_get, checks configured identity. | R; requires functional credentials when invoked | Adequate; M/O |
| `auth_token_info` | Configured token owner/expiry/permissions; no token-management side effect; token-sensitive path audited. | R; real Trello request, not offline discovery | Adequate; M/O |
| `list_boards` | Visible member boards; open default and field projection; initial board selection. | R | Adequate; M/O |
| `board_create` | Name/workspace/visibility; private default, explicit public opt-in; server leaves other defaults to Trello. | C; no board-delete tool; archive/manage externally | Adequate; M/O |
| `board_get` | Known board details/preferences/label names; required name preserved. | R | Adequate; M/O |
| `board_field_get` | One enumerated field; narrower than board_get. | R; response varies by field | Adequate; M/O |
| `board_actions` | Board-wide history; filters, limit 50, page 0 and since/before; not whole-history retrieval. | R | Adequate; M/O |
| `board_lists` | Lists on one board, open default; obtains list ids before card workflows. | R | Adequate; M/O |
| `board_cards` | Cross-list card collection; bounded limit/cursors/fields in schema; list_cards is narrower. | R | Adequate; M/O |
| `board_custom_fields` | Definitions/options on a board; differs from card values. | R | Adequate; M/O |
| `board_labels` | Available board labels, fields and bounded limit; differs from applied card labels. | R | Adequate; M/O |
| `board_members` | Accessible member profiles; token visibility caveat; memberships returns roles. | R | Adequate; M/O |
| `board_memberships` | Roles/permission context, admins filter and optional profiles. | R | Adequate; M/O |
| `list_workspaces` | Current member's workspaces; all default, optional paid details. | R | Adequate; M/O |
| `workspace_get` | One workspace's metadata; described id/name and fields. | R | Adequate; M/O |
| `workspace_boards` | Boards in one workspace; open default; narrower than list_boards. | R | Adequate; M/O |
| `workspace_members` | Members in workspace; role filter and fields. | R | Adequate; M/O |
| `workspace_actions` | Workspace history; shared bounded filters/cursors/page. | R | Adequate; M/O |
| `member_get` | Member id/username/me profile; complements search_members. | R | Adequate; M/O |
| `member_boards` | Known member's boards, open filter; visibility caveat. | R | Adequate; M/O |
| `member_cards` | Assigned cards, visible default, bounded paging/fields. | R | Adequate; M/O |
| `member_workspaces` | Known member's workspaces; differs from current-member discovery. | R | Adequate; M/O |
| `list_get` | Known list metadata and field projection. | R | Adequate; M/O |
| `list_create` | Name/board/position, bottom default. | C; can archive later | Adequate; M/O |
| `list_update` | Name/position/archive fields; list_archive is focused state alternative. | S; recoverable with prior values | Adequate; M/O |
| `list_archive` | closed defaults true; false restores; cards retained. | S; reversible archive state | Adequate; M/O |
| `list_move_to_board` | Destination board; now discloses moving cards and access changes; list_update reorders. | S; move-back depends on permissions/state | Fixed; M/O |
| `list_actions` | One list's bounded history, distinct scope from board_actions. | R | Adequate; M/O |
| `card_get` | Known card details; now says short link, not ambiguous short id; all fields default. | R | Fixed; M/O |
| `card_board` | Parent board object; relationship lookup rather than board-id discovery. | R | Adequate; M/O |
| `card_list` | Parent list object before moving/reporting status. | R | Adequate; M/O |
| `card_labels` | Applied label objects and ids, unlike board_labels. | R | Adequate; M/O |
| `list_cards` | Cards from one list; explicit limit/cursor/fields guidance. | R | Adequate; M/O |
| `card_create` | Known list, title/description/due/position/members/labels; bottom default. | C; archive or delete new card | Adequate; M/O |
| `card_update` | Metadata and archive state without movement; null clears due. | S; prior values needed | Adequate; M/O |
| `card_due_date_set` | Focused due/completion; at least one required in prose and handler. | S; null clears due | Adequate; M/O |
| `card_position_set` | Current-list position; names card_move alternative. | S; order depends on other cards | Adequate; M/O |
| `card_cover_set` | Existing attachment or null; display options require attachment; leaves file intact. | S; previous cover needed | Adequate; M/O |
| `card_label_create_and_add` | New board label plus assignment; now names existing-label alternative and duplicates. | C; remove association does not delete label | Fixed; M/O |
| `card_delete` | Explicit permanent deletion; archive alternative already disclosed. | D; cannot restore | Adequate; M/O |
| `card_move` | Optional list/board/position, distinct from metadata; cross-board constraints enforced by Trello. | S; access/labels/member mapping can change | Adequate; M/O; cross-board ergonomics tracked |
| `card_archive` | closed true/false, reversible alternative to card_delete. | S; restore with false | Adequate; M/O |
| `card_attachments` | Metadata list, optional fields/filter; does not download files. | R | Adequate; M/O |
| `card_attachment_get` | One attachment's metadata, no file-content fetch. | R | Adequate; M/O |
| `card_attachment_add_url` | Public URL, optional display name/cover; distinct from upload. | C; duplicate attachments possible; delete to remove | Adequate; M/O |
| `card_attachment_upload` | Server-side path/root containment, optional MIME/name/cover; now states transmission and disabled default. | C plus local read; duplicates possible | Fixed; M/O |
| `card_attachment_delete` | Card and attachment ids; now permanent upload-file removal, with cover-clearing alternative. | D; cannot restore stored upload | Fixed; M/O |
| `card_checklists` | All card checklists/items; card_checklist_items narrows to one checklist. | R | Adequate; M/O |
| `card_checklist_create` | Name and optional copy source; new checklist. | C; delete to remove | Adequate; M/O |
| `card_checklist_update` | Name/position, at least one explicitly required; checklist id suffices. | S; previous values needed | Adequate; M/O |
| `card_checklist_delete` | Card/checklist ids; now discloses permanent loss of all items and single-item alternative. | D; cannot restore | Fixed; M/O |
| `card_checklist_item_create` | Text/position/checked/due/reminder/member; existing checklist prerequisite. | C; delete to remove | Adequate; M/O |
| `card_checklist_items` | One checklist, all/checked/unchecked filter and fields. | R | Adequate; M/O |
| `card_checklist_item_update` | Text/state/date/reminder/member and destination checklist; null clear semantics described. | S; previous values needed | Adequate; M/O |
| `card_checklist_item_set_checked` | Boolean checked; focused completion without other edits. | S; toggle to restore | Adequate; M/O |
| `card_checklist_item_move` | Destination checklist on same card; optional position. | S; prior checklist/order needed | Adequate; M/O |
| `card_checklist_item_delete` | Card/item ids; now permanent loss, with set_checked alternative. | D; cannot restore | Fixed; M/O |
| `card_custom_field_items` | Current card values; differs from board definitions/options. | R | Adequate; M/O |
| `card_custom_field_set` | Exact type/value mapping now in schema prose; definition/options/clear siblings named. | S; replaces value; extra value inputs ignored | Fixed; M/O |
| `card_custom_field_clear` | Now explains value loss and retained board definition instead of HTTP mechanics. | S; old value needed to restore | Fixed; M/O |
| `card_members` | Assigned members, visibility/fields; differs from board eligibility. | R | Adequate; M/O |
| `card_member_add` | Existing member id; requires write access and eligible member. | A; sibling remove, replay effects unpromised | Adequate; M/O |
| `card_member_remove` | Unassign only, not board-membership deletion. | A; sibling add | Adequate; M/O |
| `card_comment_add` | New comment action; now warns replay duplicates and names update. | C; update/delete with returned action id | Fixed; M/O |
| `card_comment_update` | Action id and replacement text; not new comment. | S; previous text needed | Adequate; M/O |
| `card_comment_delete` | Action id; now permanent loss, with update alternative. | D; cannot restore original action | Fixed; M/O |
| `card_actions` | Card's bounded action/comment history; scope differs from board/list/workspace. | R | Adequate; M/O |
| `label_get` | Specific reusable board label details. | R | Adequate; M/O |
| `label_create` | Name/color/board; palette enum, creates reusable label. | C; delete to remove | Adequate; M/O |
| `label_update` | Name/color, null removes color; assignments preserved. | S; affects appearance wherever used | Adequate; M/O |
| `label_delete` | Now discloses board-wide removal and names single-card removal alternative. | D; cannot restore original label | Fixed; M/O |
| `card_label_add` | Existing label id, not creation. | A; sibling remove | Adequate; M/O |
| `card_label_remove` | Single-card unassignment; board label remains. | A; sibling add | Adequate; M/O |
| `custom_field_get` | Definition/type/options, prerequisite to setting correct value type. | R | Adequate; M/O |
| `custom_field_options` | Dropdown options before selecting optionId; not card values. | R | Adequate; M/O |
| `search` | Query passed through; now grouped result types, default cards/boards, scope and cardsPage explained. | R; bounded, not exhaustive cross-type pagination | Fixed; M/O |
| `search_members` | Name/username, small result limit, board/workspace visibility; corrected shared query wording. | R | Fixed; M/O |

The consequential corrections are supported by the handlers and Trello's primary
[card deletion](https://support.atlassian.com/trello/docs/archiving-and-deleting-cards/),
[checklist deletion](https://support.atlassian.com/trello/docs/adding-checklists-to-cards/),
[attachments](https://support.atlassian.com/trello/docs/adding-attachments-to-cards/),
and [search API](https://developer.atlassian.com/cloud/trello/rest/api-group-search/)
documentation, read 2026-10-12. Create operations have no deduplication key in
this implementation. Dense setter families remain deliberately distinct; #182
owns broader annotation/coherence improvements, including formal replay hints.
No rename, consolidation, blanket annotation, placeholder output schema or
predicted score was introduced.

## Safety assumptions and limits

- **Credentials:** configuration requires non-empty `TRELLO_API_KEY` and
  `TRELLO_TOKEN`, not validated credentials at startup. Synthetic values suffice
  for initialization/discovery only. Auth diagnostic tool invocation is a real
  Trello request and was not used as an offline probe.
- **Egress:** application requests originate only in `src/trello/client.ts`, using
  `https://api.trello.com/1`. Key/token are query parameters; `auth_token_info`
  additionally encodes the token in `/tokens/{token}`. Do not log request URLs,
  query strings, token paths or raw environment objects. Expected API use is not
  a claim of packet-level confinement: redirects/dependency behavior and future
  authenticated operations were not exercised. HTTP health's only request is
  container-local `/healthz`.
- **Logs/output:** redaction removes known credential/authorization and whole
  URL/path/query fields. Runtime errors avoid raw network errors. Never place
  credentials in logs, screenshots, committed evidence or review text. Synthetic
  leak checks cover captured protocol and log output, not every future handler
  response. Trello-originated content remains untrusted input.
- **Files:** startup reads package metadata and runtime modules. Upload is disabled
  unless `TRELLO_ATTACHMENT_UPLOAD_ROOT` is configured. Enabled upload resolves
  the root and requested file through realpath, rejects paths/symlinks outside
  the root, requires a regular file, reads it into memory and transmits it to
  Trello. Those checks are not protection against a hostile concurrent writer
  changing filesystem entries between validation and read; use an operator-owned
  upload directory. Discovery uses no upload root or mounted files.
- **Processes/writes:** production application code does not spawn subprocesses
  or write application files. Node/module reads and Docker's scheduled health
  process are expected. Builds and the validation harness legitimately spawn
  compilers, clients and Docker commands. Empty `docker diff` is supporting
  evidence, not a syscall trace or proof of no reads. Glama's actual behavioral
  scan remains external.
- **Access:** optional `MCP_AUTH_TOKEN` protects HTTP MCP requests, not health
  endpoints. Stdio opens no HTTP listener. No public endpoint was created.

Glama distinguishes noteworthy **Risky** findings from **Malicious** findings
that require internal review. No such finding or numeric security grade was
obtained here. Actual findings must be resolved or linked to a specific issue
before #66 represents them as handled.

## Verification and handoff to #66

Required local checks and final review results are recorded in the implementing
PR. Offline discovery is a local compatibility baseline; ordinary CI success is
not Glama validation. The offline matrix does not test live Trello functionality, Glama Firecracker
execution, authenticated ownership/consent, public profile identity, scan
findings, or arm64 runtime execution. Separately authorized existing PR smoke CI
is recorded with its run and cleanup result in the implementing PR.

[#64](https://github.com/enthouan/trello-mcp/issues/64) supplied the initial audit.
[#65](https://github.com/enthouan/trello-mcp/issues/65) owns this preparation and
its merge verification. [#66](https://github.com/enthouan/trello-mcp/issues/66)
should perform this explicit handoff, under separately authorized external work:

1. Refresh methodology, schema, TDQS revision and the exact-repository search.
   Check source URL `https://github.com/enthouan/trello-mcp`; claim an existing
   match instead of creating a duplicate. Do not infer absence from API 401.
2. Observe actual GitHub association/ownership and consent requirements. Do not
   install the Hosting GitHub App or add `glama.json` without a demonstrated need.
3. If needed, submit through Runs from source with the canonical identity and
   concise description. Record submission/review independently of public listing.
4. Observe the approved Dockerfile/build/run instructions. Start from this
   candidate, retain a synthetic-only allowlist and disabled upload root, and
   reproduce initialize, full tools/list, resource/prompt behavior, output safety,
   transport health and shutdown under the actual Glama configuration.
5. Verify detected source revision and full catalog. A scan of the release image
   legitimately lacks these description fixes; do not republish or alter version
   metadata merely to hide drift. No real Trello credential is needed for discovery.
6. Record independent states for ownership, submission, build/introspection,
   public profile, scoring/security and search visibility. Do not infer that
   deployment or Make Release is required from unrelated product guidance.
7. Review every actual score/security finding; resolve it or link a specific
   follow-up, including #182/#206 when applicable. Use only observed refresh
   controls and do not promise a sync SLA. Add a badge/link only after verifying
   the exact accepted public profile.

The grouped distribution roadmap card stays in Doing until its other Docker
and Glama outcomes are complete. Finishing #65 does not complete #66, release a
new version, or make a listing claim.
