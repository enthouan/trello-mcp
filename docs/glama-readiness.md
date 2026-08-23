# Glama MCP registry readiness audit

Last verified: **2026-08-23**

## Decision

Pursue a **Glama open-source MCP server listing first**, after the repository
preparation work described below. This is the route Glama documents for a public
GitHub repository that users can build and run themselves.

Do not treat Glama Hosting, the Glama Gateway, or a hosted connector as listing
prerequisites:

- Glama Hosting is an optional deployment product. It connects a repository with
  the Glama GitHub App, builds it, and exposes a private-by-default hosted
  instance.
- The Gateway is an optional reverse proxy and control plane in front of a hosted
  server or connector.
- A hosted connector represents a remote MCP endpoint that somebody already
  operates. Connector introspection may require sandbox credentials or a
  non-production OAuth configuration. `trello-mcp` has neither such a plan nor a
  maintainer-operated public endpoint.

Reconsider Hosting only after the open-source profile is accepted and its exact
build/runtime behavior is known. Reconsider a connector only if the project later
operates a stable remote endpoint. Neither is necessary for the selected first
submission.

Glama describes its directory as a superset of the official MCP Registry. An
exact-repository profile can therefore appear through automatic ingestion before
the owner submits one directly. The later submission run must search again and
claim an automatically ingested exact match instead of creating a duplicate.

This audit performed **no Glama authentication, OAuth consent, submission,
claim, GitHub App installation, build-spec change, deployment, Glama release,
manual sync, rescan, Inspector session, or listing mutation**. It used no real
Trello credentials and made no live Trello API calls.

## Scope and evidence policy

This document records current public Glama requirements, maps them to the
repository, and assigns the remaining work. Glama pages and APIs are unversioned,
so every mutable observation below includes the retrieval date. Requirements
must be refreshed immediately before authenticated submission.

| Evidence | Snapshot used by this audit |
| --- | --- |
| `trello-mcp` source | `00a5915e2d0888ec0b65c75728f8e11b2becf35a` (`origin/main` at audit start) |
| TDQS specification | [`c8c6b0c291466fe13e22dbfedcea0af1f1ca47b7`](https://github.com/glama-ai/tool-definition-quality-score/tree/c8c6b0c291466fe13e22dbfedcea0af1f1ca47b7) |
| TDQS README bytes | SHA-256 `196ff5cae922534e84621166d8853a37113157dd9c5831dc979d2987e8b65162` |
| Live server schema | [`https://glama.ai/mcp/schemas/server.json`](https://glama.ai/mcp/schemas/server.json), retrieved 2026-08-23, 345 bytes, SHA-256 `7f652273293b658bcf9156646745c3aa9c42edcbd179ee126361e462814f1508` |
| Listing/indexing rules | [Glama methodology](https://glama.ai/mcp/methodology), retrieved 2026-08-23 |
| Product distinction | [Glama home](https://glama.ai/), [Hosting](https://glama.ai/mcp/hosting), and [Gateway](https://glama.ai/mcp/gateway), retrieved 2026-08-23 |
| Submission UI | [Server directory](https://glama.ai/mcp/servers) and its public [submission bundle](https://glama.ai/client/SearchInput-gNdNux8K.js), retrieved 2026-08-23 |
| Claim UI | Public [claim bundle](https://glama.ai/client/ClaimMcpServerModal-BUOkjwyt.js), retrieved 2026-08-23 |
| Current checklist behavior | Public [no-release score page](https://glama.ai/mcp/servers/LeadBroaf/mcp-agent-server/score), [high-quality score page](https://glama.ai/mcp/servers/docmancer/docmancer/score), and [no-license score page](https://glama.ai/mcp/servers/Kminer2053/Artifact-Intelligence-public/score), retrieved 2026-08-23 |
| Connector ownership contrast | Public [connector claim page](https://glama.ai/mcp/connectors/com.deploytoagents/server), retrieved 2026-08-23 |
| Directory API contract | [OpenAPI document](https://glama.ai/api/mcp/openapi.json), retrieved 2026-08-23 |

The immutable TDQS links are normative for this audit. The live Glama pages,
bundles, schema, and API are dated observations rather than permanent contracts.

## Current Glama directory state

The canonical repository was not listed when checked:

- [`GET /v1/servers?query=enthouan&first=100`](https://glama.ai/api/mcp/v1/servers?query=enthouan&first=100)
  returned HTTP 200 with zero servers.
- The [directory owner search](https://glama.ai/mcp/servers?query=enthouan)
  returned no profile.
- The expected public profile
  [`/mcp/servers/enthouan/trello-mcp`](https://glama.ai/mcp/servers/enthouan/trello-mcp)
  returned HTTP 404.
- The expected API identifier
  [`/api/mcp/v1/servers/enthouan/trello-mcp`](https://glama.ai/api/mcp/v1/servers/enthouan/trello-mcp)
  returned HTTP 404.
- A public API query for `trello` returned related servers, but none had the
  exact repository URL `https://github.com/enthouan/trello-mcp`.

Other Trello-named profiles are unrelated repositories, not aliases of this
project. There is therefore no existing profile to claim and no duplicate to
reconcile based on the public evidence. This result is only the dated audit
snapshot; automatic ingestion means it must be repeated immediately before any
external action.

## Exact open-source submission and claim path

The current public path is:

1. Search the [Glama server directory](https://glama.ai/mcp/servers) and public
   API again for the exact source URL. If an exact profile appeared through
   Glama's official-registry ingestion or another indexing path, verify its source
   URL and use **Claim**; do not submit a duplicate.
2. If the exact profile is still absent, choose **Add Server**. Signed-out users
   are sent through sign-up with a return path to `/mcp/servers`; signed-in users
   receive the Add Server modal. There is no stable standalone public Add Server
   URL in the current client.
3. Select **Open-source Server**, which the UI defines as source code hosted on
   GitHub.
4. Enter the name, description, and exact GitHub repository URL
   `https://github.com/enthouan/trello-mcp`.
5. Choose **Submit for Review**. The public client submits to
   `POST /api/mcp/servers/submit` and says public submissions are reviewed before
   becoming publicly visible.
6. Once a profile exists, choose **Claim** on that exact profile and authenticate
   with GitHub. The observed public client route is shaped as
   `/oauth/github/auth?returnPath=/mcp/servers/<namespace>/<slug>`; it is a client
   implementation detail, not a promised API.
7. Glama verifies that the GitHub account has **write or admin access** to the
   repository. Public documentation does not name the exact OAuth scopes or show
   the current consent text, so those details must be recorded from the actual
   consent screen before approval.
8. Inspect the authenticated Docker build-spec, Deploy, and **Make Release**
   controls without treating the public FAQ's suggested sequence as a verified
   acceptance contract. Sampled score pages distinguish a Glama release from a
   GitHub release and describe Claim → build spec → Deploy → Make Release, but the
   exact fields, required order, and relationship to acceptance remain unverified.
9. Verify inspectability, at least one detected tool, the public profile, schemas,
   annotations, score/checklist, security findings, Inspector behavior, install
   instructions, and API identity.

Steps 2 through 9 are external mutations or authenticated observations. They are
deliberately deferred. The public UI establishes a review stage, but does not
establish that every ordinary submission receives human review. The methodology
does explicitly reserve internal review for a `Malicious` security result.

### Repository-root `glama.json`

Glama's live server schema requires an object with a unique string array named
`maintainers`. It does not require `$schema`, require a non-empty array, constrain
GitHub username syntax, or prohibit additional properties. Use the practical,
explicit form:

```json
{
  "$schema": "https://glama.ai/mcp/schemas/server.json",
  "maintainers": ["enthouan"]
}
```

The [Glama `glama.json` guidance](https://glama.ai/blog/2025-07-08-what-is-glamajson)
says GitHub authentication can associate a personal repository, while an
organization-owned repository needs the root file. Because this repository is
personal, the file is not a documented absolute prerequisite. It is still
strongly recommended before submission: it makes intended ownership explicit,
is checked by the current quality UI, and avoids relying solely on account/repo
association. Do not add it as part of this audit.

## Similar names, different ownership mechanisms

| Mechanism | What it proves or enables | Applies now? |
| --- | --- | --- |
| GitHub OAuth | Verifies that the submitting/claiming account has write or admin access to the source repository. Exact OAuth scopes are not public. | Yes, during the later submission/claim. |
| Repository-root `glama.json` | Declares GitHub usernames permitted to maintain an open-source server profile using the live server schema. | Strongly recommended preparation; absent today. |
| Glama GitHub App | Lets the separate Hosting product connect a repository, read `glama.json` or a Dockerfile, build, deploy, and roll back. | No; Hosting is optional. |
| `/.well-known/glama.json` on a service domain | Claims an already-operated hosted connector using the connector schema and account-email maintainers. | No; this is not the repository-root server file and there is no operated endpoint. |
| GitHub release | Repository maintenance signal shown on score pages. The latest repository release is `v1.0.0`. | Already present, but not a Glama release. |
| Glama release | Authenticated Glama lifecycle object that public score-page guidance distinguishes from a GitHub release and places after configured build/deploy. Its exact required role is unverified. | Later external work; not created by this audit and not yet an acceptance requirement. |

## Repository readiness checklist

Status meanings: **Ready** is evidenced at the pinned source revision; **Prepare**
means a repository change or Glama-specific proof remains; **External** means it
can only be observed or performed in Glama later.

| Requirement | Status | Evidence and remaining work |
| --- | --- | --- |
| Public, reachable GitHub source | Ready | `https://github.com/enthouan/trello-mcp` is public, active, unarchived, and is the canonical remote. Refresh immediately before submission. |
| Clear purpose and identity | Ready | `README.md` identifies a self-hostable MCP server for Trello and clearly states that it is independent and unofficial. |
| Canonical URLs | Ready | Source is `https://github.com/enthouan/trello-mcp`; project documentation is `https://trello-mcp.com/`. |
| Install/run documentation | Ready | README documents the published image, local Docker build, source install, HTTP, stdio, health checks, client setup, verification, and usage examples. |
| Configuration contract | Ready | Required `TRELLO_API_KEY` and `TRELLO_TOKEN`; optional `MCP_AUTH_TOKEN` and `TRELLO_ATTACHMENT_UPLOAD_ROOT`; and supported rate/retry settings are documented in README, `.env.example`, and `docs/configuration.md`. `LOG_LEVEL=info` is the safe default. |
| README, LICENSE, support, privacy, security | Ready | Root README and MIT `LICENSE` exist; `SECURITY.md`, `PRIVACY.md`, and `SUPPORT.md` are linked. Current score pages say a missing license prevents installation. |
| Release and activity signals | Ready | GitHub [`v1.0.0`](https://github.com/enthouan/trello-mcp/releases/tag/v1.0.0) was published 2026-08-14, the [releases API](https://api.github.com/repos/enthouan/trello-mcp/releases?per_page=100) returned 13 published releases, and [PR #204](https://github.com/enthouan/trello-mcp/pull/204) merged to `main` on 2026-08-23. This dated evidence shows active maintenance and is separate from any Glama release. |
| Package discoverability metadata | Prepare | `package.json` has name, version, description, license, files, engines, scripts, and pinned package manager, but no `repository`, `homepage`, `bugs`, `keywords`, or `bin`. These are discoverability improvements, not documented Glama build blockers. |
| Reproducible source build | Prepare | Node is constrained to `>=24.0.0 <25.0.0`; Corepack pins `pnpm@10.34.1`; and `pnpm-lock.yaml` supports `corepack pnpm install --frozen-lockfile`. Glama's exact clone/build must still be reproduced with its chosen spec. |
| Dockerfile and commands | Ready locally; External on Glama | Root multi-stage Node 24 Dockerfile uses a frozen install, production prune, unprivileged runtime, health check, and `node dist/index.js`. Local image command: `docker build -t trello-mcp .`. Glama may use this file or infer one; confirm which it selects. |
| Transports and defaults | Ready locally; External on Glama | Runtime supports stdio and Streamable HTTP. Docker defaults to `TRANSPORT=http` on port 3000; `TRANSPORT=stdio` opens no listener, makes `PORT` irrelevant, and is the likely source-inspection mode. |
| Credential-independent startup | Prepare | Configuration requires non-empty Trello key/token strings, but startup does not validate them against Trello. Synthetic values work for generic Inspector discovery; prove the exact Glama path with outbound Trello access denied. |
| `tools/list` | Prepare | Existing Inspector documentation records 77 tools with synthetic credentials and no Trello discovery call. Re-run on the exact Glama build/run command and verify the full schemas. |
| `resources/list` and `prompts/list` | Prepare | No resources or prompts are intentionally registered. Record the exact protocol responses rather than assuming unsupported methods return empty lists. |
| Tool descriptions and input schemas | Ready for audit; Prepare for score | Every registered tool has a description and Zod-derived input schema; website contracts require described input properties. TDQS-specific quality still needs a full tool-by-tool review. |
| Tool behavior taxonomy | Ready locally; Prepare for metadata | Website contracts classify the 77 tools as 40 read, 31 write, and 6 permanent-delete. This taxonomy does not reach Glama as MCP annotations today. |
| Tool titles | Prepare | No tool title is registered. |
| Output schemas | Prepare | Handlers return JSON-serializable values wrapped as text; no MCP `outputSchema` is registered. |
| MCP annotations | Prepare | No `readOnlyHint`, `destructiveHint`, `idempotentHint`, or `openWorldHint` is registered. Website read/write/delete taxonomy is not MCP metadata. |
| Root `glama.json` | Prepare | Missing. Current score pages flag a missing or invalid file as a quality deficiency. Add and validate the minimal maintainer declaration before external submission. |
| Glama profile/claim | External | No exact profile exists; submit and claim only after preparation is approved. |
| Inspectability and tool detection | Prepare; External proof | Current score/checklist guidance treats an inspectable server and at least one detected tool as installation/distribution requirements. Do not represent `trello-mcp` as inspectable until its actual Glama build and discovery pass. |
| Glama build, release, score, and Inspector | External | No authenticated build, deploy, release, score, or Inspector session has occurred. Exact authenticated fields and any Make Release prerequisite must be verified before becoming acceptance requirements. |
| Hosted connector endpoint | Not applicable | The project is self-hosted and does not operate a canonical public MCP endpoint. |

The missing package fields are worth correcting for general discovery, but no
public Glama source observed in this audit declares them mandatory. They must not
be presented as submission blockers without new evidence.

## Build and live-introspection implications

Glama's [methodology](https://glama.ai/mcp/methodology) describes this source
pipeline:

1. clone and continuously synchronize the full Git history;
2. build a repository Dockerfile or an inferred Dockerfile;
3. run it in an isolated Firecracker microVM with ephemeral filesystem and
   network;
4. call MCP discovery methods including `tools/list`, `resources/list`, and
   `prompts/list`, retaining schemas and annotations;
5. analyze runtime behavior, publish the profile and findings, and repeat work on
   commits/rebuilds.

If a reproducible build fails, a profile may remain visible by direct URL while
Glama withholds it from search, categories, and recommendations. A successful
profile submission is therefore not proof of distribution readiness.

At the pinned source revision:

- Node must satisfy `>=24.0.0 <25.0.0`; Corepack uses `pnpm@10.34.1`.
- `corepack pnpm build` compiles TypeScript to `dist/`; `corepack pnpm start`
  runs the runtime command `node dist/index.js`; `docker build -t trello-mcp .`
  builds the root Dockerfile locally.
- Runtime supports stdio and Streamable HTTP. The Dockerfile defaults to
  `TRANSPORT=http` and port 3000. For child-process discovery,
  `TRANSPORT=stdio` avoids opening a listener, makes `PORT` unused, and sends
  structured logs to stderr. The exact mode Glama chooses is not public and must
  be observed.
- `LOG_LEVEL=info` is the default. HTTP deployments can opt into bearer
  authentication with `MCP_AUTH_TOKEN`; server-local attachment reads stay
  disabled unless `TRELLO_ATTACHMENT_UPLOAD_ROOT` is an absolute configured root.
- `TRELLO_API_KEY` and `TRELLO_TOKEN` must be non-empty at startup. Synthetic
  values such as `validation-only` satisfy schema validation.
- Server construction registers all 77 tools without contacting Trello. The
  `TrelloClient` performs network access only when a handler invokes
  `trello.request(...)`.
- Generic Inspector documentation already reports 77 tools over both source and
  Docker startup with synthetic credentials. That is supporting evidence, not a
  substitute for a network-denied Glama-compatible proof.
- No resources or prompts are intentionally registered.

The preparation run must fail closed if any discovery step tries to reach
`api.trello.com`. It must capture the exact build command, runtime command,
transport, environment-variable names, protocol responses, tool count, stderr,
exit state, and whether Glama needs a health check. Do not use real Trello
credentials or invoke any tool handler merely to prove enumeration.

The Docker Registry `tools.json` fallback is registry-specific generated
metadata. It is not evidence that Glama can build or introspect the server and
must not replace the live Glama-compatible test.

## Tool Definition Quality Score readiness

TDQS evaluates what an MCP client receives from `tools/list`, not runtime
correctness. Its exact inputs are tool name, optional title, description, input
schema, optional output schema, annotations, and sibling tool names
([pinned specification](https://github.com/glama-ai/tool-definition-quality-score/blob/c8c6b0c291466fe13e22dbfedcea0af1f1ca47b7/README.md#L51-L65)).

### Rubric and aggregation

| Dimension | Weight | What to demonstrate |
| --- | ---: | --- |
| Purpose Clarity | 25% | Specific verb, resource, and scope; distinguish siblings. |
| Usage Guidelines | 20% | State when to use it, when not to, and the better alternative. |
| Behavioral Transparency | 20% | Disclose consequential behavior beyond annotations: mutation, deletion, auth, filesystem/network effects, and constraints. |
| Parameter Semantics | 15% | Describe properties and enums in the schema rather than duplicating them vaguely in prose. |
| Conciseness & Structure | 10% | Front-load useful facts and avoid repetition. |
| Contextual Completeness | 10% | Supply the context appropriate to complexity and structured metadata. |

The [pinned rubric](https://github.com/glama-ai/tool-definition-quality-score/blob/c8c6b0c291466fe13e22dbfedcea0af1f1ca47b7/README.md#L112-L167)
gives a missing description 1.0/tier D, caps tautological Purpose Clarity at 2,
flags annotation contradictions, and records every dimension below 3 as a smell.
Per-property descriptions and enums improve Parameter Semantics, while an output
schema reduces how much return-shape explanation the prose description must carry.
Tiers are A at 3.5+, B at 3.0+ (the passing bar), C at 2.0+, D at 1.0+, and F
below 1.0
([tier definition](https://github.com/glama-ai/tool-definition-quality-score/blob/c8c6b0c291466fe13e22dbfedcea0af1f1ca47b7/README.md#L198-L220)).

Server definition quality is `0.6 × mean(TDQS) + 0.4 × minimum(TDQS)` and is
computed only when at least 80% of tools are scored. A single weak tool therefore
materially lowers the server score
([rollup](https://github.com/glama-ai/tool-definition-quality-score/blob/c8c6b0c291466fe13e22dbfedcea0af1f1ca47b7/README.md#L231-L245)).
The overall score is 70% definition quality and 30% server coherence. Coherence
equally evaluates disambiguation, naming consistency, tool-count appropriateness,
and completeness
([coherence](https://github.com/glama-ai/tool-definition-quality-score/blob/c8c6b0c291466fe13e22dbfedcea0af1f1ca47b7/README.md#L247-L268)).

### Current 77-tool risk assessment

Current strengths:

- all 77 names are deterministic, unique, and MCP-compatible;
- every tool has a non-empty description and input schema;
- input properties are generally described and enum values are explicit;
- the current website taxonomy records 40 read, 31 write, and 6 permanent-delete
  tools;
- domain naming is consistent and CRUD/lifecycle coverage is broad.

Current material gaps:

- no titles, output schemas, or MCP annotations reach `tools/list`;
- without annotations, descriptions carry the full TDQS behavioral-disclosure
  burden;
- 77 tools exceed TDQS's 50+ extreme-mismatch anchor for the tool-count
  appropriateness dimension, although the rubric is contextual rather than an
  automatic failure;
- dense sibling families may not always explain when to choose one operation over
  another;
- the minimum-weighted rollup makes the weakest single definition important.

Do not invent a numeric TDQS score before Glama evaluates the actual tool set.
Instead, review all 77 definitions deterministically and give extra scrutiny to:

- the six permanent-delete operations and their recoverable archive/remove
  alternatives;
- attachment upload, which deliberately reads a guarded local file and sends it
  to Trello;
- dense card/checklist/member/label sibling families;
- broad search and action-history tools;
- discriminated custom-field inputs;
- board creation's private default;
- all write operations for idempotency, reversibility, and external-side-effect
  wording.

For each tool, record name/title/description/input/output/annotations, schema
description coverage, siblings, expected read/write/delete/open-world behavior,
and rubric findings. Prefer accurate annotations, per-property descriptions,
enums, and output schemas over repetitive prose. Never add an annotation that
contradicts behavior: TDQS forces Behavioral Transparency to 1 and publishes an
`Annotation Contradiction` flag
([improvement guidance](https://github.com/glama-ai/tool-definition-quality-score/blob/c8c6b0c291466fe13e22dbfedcea0af1f1ca47b7/README.md#L343-L354)).

## Sandbox and security review mapping

Glama scans build/runtime behavior in addition to TDQS. The table maps its
published checks to current repository evidence without predicting a grade.
For open-source sandbox runs, the published checks include unrelated
credential-path access, undeclared outbound hosts, exfiltration-like payloads,
unrelated subprocesses, and writes outside the expected working directory. Glama
also publishes schema-drift and prompt-injection monitoring for hosted connectors;
that connector-specific wording is distinguished below rather than silently
promoted into a source-listing gate.

| Glama observation | Current repository behavior | Remaining proof |
| --- | --- | --- |
| Credential access | Secrets come from declared environment variables. Trello key/token, optional HTTP bearer token, and optional upload root are read only for their documented functions. | Confirm Glama injects only declared variables and no discovery output contains synthetic values. |
| Outbound network | Application source centralizes external network access in `src/trello/client.ts` at `https://api.trello.com/1`; no other external application egress path was found. The Docker health check separately fetches only its container-local `/health` endpoint. | Prove startup/discovery makes zero Trello requests; later functional validation must separately declare expected Trello egress. |
| Exfiltration-like payloads and logs | The Trello API key and token are added only to Trello request query parameters; `MCP_AUTH_TOKEN` is compared with an incoming authorization header. Logger redaction covers Trello credentials, authorization values, URLs, paths, and queries; stdio logging goes to stderr rather than the MCP protocol stream. | Inspect Glama findings and ensure no payload or log leaks a real or synthetic credential. |
| Filesystem reads/writes | Normal runtime reads package metadata. Attachment upload is disabled without an explicit root; when enabled, realpath and symlink containment restrict reads to that configured root. Production code has no filesystem writes. | Keep upload disabled for initial discovery; document the intentional file-to-Trello flow if later enabled. |
| Process spawning | No production subprocess or shell execution was found. | Confirm the built artifact exhibits the same behavior. |
| Working-directory writes | The service is stateless and has no application database or normal runtime write path. | Confirm the Glama container produces no unexplained writes. |
| Schema drift and prompt-injection patterns | Glama explicitly documents schema-drift and prompt-injection monitoring for hosted connectors. For open-source servers it confirms repeated commit/rebuild analysis plus schema/history capture. No MCP prompts are registered here, but Trello-originated JSON text remains untrusted. | Do not assume connector-only monitoring is a universal source-listing gate; inspect the actual open-source profile and never claim prompt-injection immunity. |
| Authentication and exposure | HTTP can require `MCP_AUTH_TOKEN`; stdio is process-local. Published Compose binds the host port to loopback by default. | Determine whether Glama uses stdio or HTTP and how any hosted endpoint is gated. |
| Offline validation | Normal Vitest coverage uses mocked or injected fetchers and no live Trello credentials or network calls. | Reuse a network-denied or mocked validation path for Glama-compatible discovery. |

The methodology distinguishes two outcomes:

- `Risky`: potentially dangerous behavior may remain publicly listed with its
  profile.
- `Malicious`: evidence enters internal review and may lead to maintainer contact
  or delisting.

There is no public numeric security-grade formula to precompute. Record actual
findings verbatim, map each to source/runtime evidence, remediate or explain it,
then trigger only the documented authenticated refresh mechanism.

## Indexing, review, scoring, and refresh lifecycle

Public evidence supports the following lifecycle, with some authenticated details
still intentionally unknown:

1. Ordinary ecosystem ingestion appears automated. Because Glama is a superset of
   the official MCP Registry, search for an automatically created exact-repository
   profile before submitting anything.
2. If still absent, submit the open-source repository for review. The Add Server
   UI promises review before public visibility, but does not document universal
   human approval.
3. Glama creates or updates a profile and verifies maintainer ownership through
   GitHub OAuth when claimed.
4. Glama reproduces the build and introspects protocol capabilities, recording
   complete tool schemas and annotations. Current score/checklist guidance treats
   inspectability and at least one detected tool as installation/distribution
   requirements; a missing LICENSE is an installation blocker.
5. Public score-page guidance distinguishes a Glama release from a GitHub release
   and shows Make Release after build/deploy. Authenticated build-spec, Deploy,
   Make Release, and install fields are unverified and must not become acceptance
   requirements until observed directly.
6. Glama runs TDQS/coherence and security analysis. Public profiles expose schema,
   score/checklist, behavioral information, history, and scan timing.
7. A failed reproducible build may leave a direct profile while withholding it
   from search, categories, and recommendations.
8. Glama periodically synchronizes source and repeats analysis after
   commits/rebuilds. Current public wording varies between commit-triggered
   reanalysis and at-least-daily synchronization; do not promise an exact SLA.
9. Claimed maintainers can use **Sync Server** in the admin UI. The exact rescan
   controls and timing must be observed during the authenticated run.
10. Changed tool definitions are rescored by input hash; unchanged scores are
    reused. Glama publishes per-dimension detail, flags, smells, and server rollups
    ([pinned lifecycle](https://github.com/glama-ai/tool-definition-quality-score/blob/c8c6b0c291466fe13e22dbfedcea0af1f1ca47b7/README.md#L388-L404)).

Score-page layouts can vary by profile state. Treat checklist text as a dated UI
observation: do not infer that a Glama release causes inspectability or that one
sampled sequence is a universal acceptance gate. Reproducible build,
introspection, inspectability, detected tools, and license expectations are
separate findings; the authenticated ordering remains to be recorded.

## Downstream issue ownership

Every remaining artifact and external action has one owner:

| Issue | Single responsibility boundary |
| --- | --- |
| [#64](https://github.com/enthouan/trello-mcp/issues/64) | Produce this evidence-pinned requirements audit, its deterministic documentation contract, generated website link, and the open-source-first decision. No Glama authentication or submission. |
| [#65](https://github.com/enthouan/trello-mcp/issues/65) | Add and validate root `glama.json`; close repository metadata gaps selected for submission; reproduce the exact build/start/discovery path without live Trello access; audit all 77 schemas, titles, output schemas, annotations, and TDQS/coherence risks; implement and test approved readiness changes. No external submission. |
| [#66](https://github.com/enthouan/trello-mcp/issues/66) | Refresh mutable requirements and duplicate search; review OAuth consent; submit/claim the exact repository; configure the authenticated build/deploy flow; create the Glama release if approved; verify profile, installability, Inspector, API identity, tool/resource/prompt schemas, score/checklist, security findings, sync/rescan behavior, and accepted-listing links. |

## Blockers and open questions

No blocker depends on making the repository public: it is already public. The
remaining blockers are preparation or authenticated observations:

- root `glama.json` is absent;
- exact Glama build/run behavior has not been reproduced with Trello egress
  denied;
- no tool title, output schema, or MCP annotations are registered;
- the 77-tool TDQS/coherence review has not been completed;
- exact GitHub OAuth scope names and consent text are not public;
- authenticated Add Server validation, Docker build-spec, Deploy, Make Release,
  Sync Server, and rescan controls have not been observed;
- public evidence does not prove that ordinary review is human;
- public wording does not establish one exact synchronization SLA;
- no public source establishes a numeric security-grade formula;
- it remains to observe how profile creation, inspectability, detected-tool state,
  build/deploy, scoring, installation, and any Glama release relate in the
  authenticated UI.

Before any external action, refresh the Glama pages/API/schema, verify the exact
repository is still absent, compare the live schema digest, pin the then-current
TDQS commit, and obtain explicit approval for the submission issue. Do not reuse
real Trello credentials for build or discovery validation.
