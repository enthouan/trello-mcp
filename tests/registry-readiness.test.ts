import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const REGISTRY_REVISION = "8c773729f13f036da8c909be503fe433923a9aa2";
const REFRESHED_REGISTRY_REVISION = "49b643ce3fc73e6ee80bb962719b6e2990e3d397";
const REPOSITORY_REVISION = "d7c22c78223b60ccabe269ae3af2415957fed861";
const TRELLO_SOURCE_REVISION = "17679f1484e8e255e745dc9a291b9cd587f7a44f";
const GATEWAY_REVISION = "a34df45d4ec0e941a9853ad768c4f6cd818966b3";
const DOCKER_DOCS_REVISION = "858251609b8884594fd1de29c51155bc3024b260";

async function readinessAudit(): Promise<string> {
  return readFile(
    new URL("../docs/registry-readiness.md", import.meta.url),
    "utf8",
  );
}

async function compatibilityAudit(): Promise<string> {
  return readFile(
    new URL("../docs/mcp-client-compatibility.md", import.meta.url),
    "utf8",
  );
}

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(
      `Could not find readiness section from ${start} to ${end}.`,
    );
  }
  return source.slice(startIndex + start.length, endIndex);
}

function normalizeWhitespace(source: string): string {
  return source.replace(/\s+/g, " ").trim();
}

describe("Docker MCP Registry readiness audit", () => {
  it("pins upstream evidence and the selected submission path", async () => {
    const audit = await readinessAudit();
    const pinnedRevisions = [
      ...audit.matchAll(
        /https:\/\/github\.com\/docker\/mcp-registry\/blob\/([0-9a-f]{40})\//g,
      ),
    ].map((match) => match[1]);

    expect(audit).toContain("Last verified: **2026-10-08**");
    expect(audit).toContain(
      "submit `trello-mcp` as a **Docker-built local server**",
    );
    expect(audit).toContain("`mcp/trello-mcp`");
    expect(audit).toContain("self-provided GHCR fallback");
    expect(audit).toContain("must define the pre-submission trust plan");
    expect(audit).toContain("actually produces after acceptance");
    expect(audit).toContain(REPOSITORY_REVISION);
    expect(audit).toContain(REFRESHED_REGISTRY_REVISION);
    expect(audit).toContain(TRELLO_SOURCE_REVISION);
    expect(audit).toContain(GATEWAY_REVISION);
    expect(audit).toContain(DOCKER_DOCS_REVISION);
    expect(pinnedRevisions.length).toBeGreaterThanOrEqual(15);
    expect(new Set(pinnedRevisions)).toEqual(new Set([REGISTRY_REVISION]));
    expect(audit).not.toContain(
      "https://github.com/docker/mcp-registry/blob/main/",
    );
  });

  it("records the finalized metadata evidence and refresh boundary", async () => {
    const audit = await readinessAudit();

    for (const marker of [
      "[`servers/trello-mcp/server.yaml`](../servers/trello-mcp/server.yaml)",
      "`https://trello-mcp.com/favicon.svg`",
      "`Content-Type: image/svg+xml`",
      "341-byte",
      "`required: true`",
      "`PORT` is intentionally omitted",
      "`task validate -- --name trello-mcp` both passed",
      "does not require `tools.json` for a local server",
    ]) {
      expect(audit).toContain(marker);
    }
    expect(audit).toMatch(
      /Issue #62 must refresh\s+the source pin\s+immediately before opening the external submission/,
    );
    expect(audit).toMatch(
      /#62 must\s+recheck the URL, content type, size, and bytes immediately before submission/,
    );
  });

  it("records the generated fallback profile and exact upstream evidence", async () => {
    const audit = await readinessAudit();

    for (const marker of [
      "[`servers/trello-mcp/tools.json`](../servers/trello-mcp/tools.json)",
      "[`scripts/generate-docker-registry-tools.ts`](../scripts/generate-docker-registry-tools.ts)",
      "`corepack pnpm registry:tools`",
      "`corepack pnpm registry:tools:check`",
      "runtime registry currently has 77 tools",
      "initial Docker profile has 76",
      "exactly `card_attachment_upload` excluded",
      "Zod's public `toJSONSchema` API in input mode",
      "lossy `string` fallback",
      "`76 tools found.`",
      "`TRELLO_API_KEY` and `TRELLO_TOKEN`\nabsent",
      "`CI=true pnpm prune --prod`",
    ]) {
      expect(audit).toContain(marker);
    }
  });

  it("keeps the initial runtime and credential mapping explicit", async () => {
    const audit = await readinessAudit();

    for (const marker of [
      "`TRANSPORT=stdio`",
      "`LOG_LEVEL=info`",
      "`TRELLO_API_KEY`",
      "`TRELLO_TOKEN`",
      "`api.trello.com:443`",
      "Do not include `PORT` or `MCP_AUTH_TOKEN`",
      "Do not expose `TRELLO_ATTACHMENT_UPLOAD_ROOT`",
      "exclude `card_attachment_upload` from the initial",
      "Do not expose rate-limit capacity",
      "task validate -- --name trello-mcp",
      "task build -- --tools trello-mcp",
      "task catalog -- trello-mcp",
      "docker mcp catalog create",
    ]) {
      expect(audit).toContain(marker);
    }
  });

  it("records the version-aware isolated Toolkit workflow and observations", async () => {
    const toolkit = normalizeWhitespace(
      section(
        await readinessAudit(),
        "### 4. Upstream validation and current Toolkit behavior — issue #60",
        "### 5. Review, trust planning, acceptance, and artifact verification",
      ),
    );

    for (const marker of [
      "Docker Desktop `4.88.0` build `237115`",
      "Desktop had updated to `4.88.1` build `237512`",
      "Docker CLI and Engine remained `29.7.2` with API `1.55`",
      "Docker MCP Toolkit/Gateway remained `v0.43.3`",
      "mcp/trello-mcp-issue-60-local:validation",
      "~/.docker/mcp/catalogs/trello-mcp-issue-60-local/catalog.yaml",
      "docker mcp profile create",
      "docker mcp tools --gateway-arg=--profile",
      "docker mcp profile remove",
      "docker mcp catalog remove",
      "Never use an unscoped catalog reset",
      "Canonical `allTools` | 77",
      "Registry `tools.json` | 76",
      "Toolkit profile | 76",
      "Source-only `card_attachment_upload`",
      "tested direct Gateway CLI path",
      "unauthenticated network probe, not a successful credentialed live workflow",
      "valid JSON-RPC responses",
      "logs stayed on stderr",
      "marked it unhealthy",
      "`--verify-signatures=false`",
      "approved positive call through the exact catalog remains pending",
      "Docker Desktop credential form",
      "- [ ] Confirm both required credential inputs directly in Docker Desktop",
      "does not claim byte or image digest identity",
      "explicit authorization was granted for the minimal read-only Gateway continuation",
      "No authenticated Gateway Trello request has run",
      "Final targeted cleanup of that continuation remains pending",
      "2026-10-08 refresh after rebase",
      "Docker Desktop `4.94.0` build `241994`",
      "CLI/Engine `29.8.2` with API `1.56`",
      "Toolkit/Gateway `v0.44.1`",
      "No authenticated Trello request completed during this October refresh",
    ]) {
      expect(toolkit).toContain(marker);
    }

    expect(toolkit).not.toContain("docker mcp catalog reset");
    expect(toolkit).not.toContain("task reset");
  });

  it("separates current offline evidence from pending owner acceptance", async () => {
    const audit = await readinessAudit();
    const refresh = normalizeWhitespace(
      section(
        audit,
        "#### 2026-10-08 refresh after rebase",
        "### 5. Review, trust planning, acceptance, and artifact verification",
      ),
    );

    for (const marker of [
      "changed only the two secret names to issue-specific dummy names",
      "76 Trello tools plus eight Gateway helpers",
      "five valid JSON-RPC messages and no invalid or partial lines",
      "At 108 seconds it was still running with four failed probes",
      "No unblocked control was run in October",
      "not the still-pending authenticated positive path",
      "Gateway left six run-created L7 proxy sidecars behind",
      "inventories match the October baseline",
      "Canonical secret values were never retrieved or changed",
      "intentionally retained for the owner's pending continuation",
      "- [ ] Confirm both required credential inputs directly in Docker Desktop",
    ]) {
      expect(refresh).toContain(marker);
    }

    const ownerSteps = normalizeWhitespace(
      section(
        audit,
        "## Owner steps to reach Docker Catalog publication",
        "[registry-readme]:",
      ),
    );
    for (const marker of [
      "if either canonical name already exists, do not overwrite it",
      "confirm the exact disposable validation board",
      "Stop the Gateway before removing only run-created secrets",
      "Start #62 with owner approval",
      "official MCP Registry publication do not themselves create the public Docker Catalog listing",
    ]) {
      expect(ownerSteps).toContain(marker);
    }
  });

  it("records Docker Toolkit as direct discovery but not live evidence", async () => {
    const compatibility = normalizeWhitespace(await compatibilityAudit());

    for (const marker of [
      "Last updated: 2026-10-08.",
      "| Docker MCP Toolkit/Gateway |",
      "Exactly 76 Trello tools were callable",
      "Live authorization is recorded, but no authenticated Gateway Trello request has run",
      "only `card_attachment_upload` omitted",
      "tested direct Gateway CLI path required `--block-network`",
      "not claimed to have byte or digest identity",
      "unauthenticated network probe, not a successful live workflow",
      "marked the stdio container unhealthy",
      "Docker Desktop UI confirmation remains pending",
      "2026-08-29 targeted cleanup restored the sanitized Toolkit inventory",
      "fresh 2026-08-30 profile remains active only for the authorized continuation",
    ]) {
      expect(compatibility).toContain(marker);
    }
  });

  it("keeps fallback identity, live calls, and trust sequencing safe", async () => {
    const audit = await readinessAudit();

    for (const marker of [
      "`ghcr.io/enthouan/trello-mcp@sha256:<digest>`",
      "a release tag alone",
      ".agents/skills/trello-mcp-live-validation/SKILL.md",
      "`TRELLO_LIVE_SMOKE=1`",
      "wait for post-acceptance inspection",
      "After #62 records upstream acceptance",
    ]) {
      expect(audit).toContain(marker);
    }
  });

  it("assigns every downstream artifact and external action once", async () => {
    const ownership = section(
      await readinessAudit(),
      "## Downstream issue ownership",
      "## Blockers and open questions",
    );

    const expected = [
      ["#58", "Create `server.yaml`"],
      ["#59", "Generate and test credential-independent `tools.json`"],
      ["#60", "Convert the local catalog"],
      ["#61", "Define the pre-submission trust plan"],
      ["#62", "Open and complete the external Docker MCP Registry submission"],
    ] as const;

    for (const [issue, responsibility] of expected) {
      expect(ownership.match(new RegExp(`\\[${issue}\\]`, "g"))).toHaveLength(
        1,
      );
      expect(ownership).toContain(responsibility);
    }
  });
});
