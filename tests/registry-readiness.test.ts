import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const REGISTRY_REVISION = "fd36a38a452e54a166a6cd3413ba2ff726361d24";

async function readinessAudit(): Promise<string> {
  return readFile(
    new URL("../docs/registry-readiness.md", import.meta.url),
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

describe("Docker MCP Registry readiness audit", () => {
  it("pins upstream evidence and the selected submission path", async () => {
    const audit = await readinessAudit();
    const pinnedRevisions = [
      ...audit.matchAll(
        /https:\/\/github\.com\/docker\/mcp-registry\/blob\/([0-9a-f]{40})\//g,
      ),
    ].map((match) => match[1]);

    expect(audit).toContain("Last verified: **2026-08-15**");
    expect(audit).toContain(
      "submit `trello-mcp` as a **Docker-built local server**",
    );
    expect(audit).toContain("`mcp/trello-mcp`");
    expect(audit).toContain("self-provided GHCR fallback");
    expect(audit).toContain("must define the pre-submission trust plan");
    expect(audit).toContain("actually produces after acceptance");
    expect(pinnedRevisions.length).toBeGreaterThanOrEqual(15);
    expect(new Set(pinnedRevisions)).toEqual(new Set([REGISTRY_REVISION]));
    expect(audit).not.toContain(
      "https://github.com/docker/mcp-registry/blob/main/",
    );
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
      "docker mcp catalog reset",
    ]) {
      expect(audit).toContain(marker);
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
      ["#60", "Import the local catalog"],
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
