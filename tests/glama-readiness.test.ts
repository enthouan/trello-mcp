import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const LAST_VERIFIED = "2026-08-23";
const TRELLO_SOURCE_REVISION = "00a5915e2d0888ec0b65c75728f8e11b2becf35a";
const TDQS_REVISION = "c8c6b0c291466fe13e22dbfedcea0af1f1ca47b7";
const GLAMA_SERVER_SCHEMA_SHA256 =
  "7f652273293b658bcf9156646745c3aa9c42edcbd179ee126361e462814f1508";

async function readinessAudit(): Promise<string> {
  return readFile(
    new URL("../docs/glama-readiness.md", import.meta.url),
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

describe("Glama MCP registry readiness audit", () => {
  it("pins the evidence snapshot and open-source-first decision", async () => {
    const audit = await readinessAudit();
    const pinnedTdqsRevisions = [
      ...audit.matchAll(
        /https:\/\/github\.com\/glama-ai\/tool-definition-quality-score\/blob\/([0-9a-f]{40})\//g,
      ),
    ].map((match) => match[1]);

    expect(LAST_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TRELLO_SOURCE_REVISION).toMatch(/^[0-9a-f]{40}$/);
    expect(TDQS_REVISION).toMatch(/^[0-9a-f]{40}$/);
    expect(GLAMA_SERVER_SCHEMA_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(audit).toContain(`Last verified: **${LAST_VERIFIED}**`);
    expect(audit).toContain(TRELLO_SOURCE_REVISION);
    expect(audit).toContain(TDQS_REVISION);
    expect(audit).toContain(GLAMA_SERVER_SCHEMA_SHA256);
    expect(audit).toContain(
      "Pursue a **Glama open-source MCP server listing first**",
    );
    expect(audit).toContain(
      "Do not treat Glama Hosting, the Glama Gateway, or a hosted connector as listing",
    );
    expect(audit).toContain(
      "Glama describes its directory as a superset of the official MCP Registry",
    );
    expect(pinnedTdqsRevisions.length).toBeGreaterThan(0);
    expect(new Set(pinnedTdqsRevisions)).toEqual(new Set([TDQS_REVISION]));
    expect(audit).not.toContain(
      "https://github.com/glama-ai/tool-definition-quality-score/blob/main/",
    );
  });

  it("records the exact public lookup and the no-external-action boundary", async () => {
    const audit = await readinessAudit();

    for (const marker of [
      "GET /v1/servers?query=enthouan&first=100",
      "/mcp/servers/enthouan/trello-mcp",
      "/api/mcp/v1/servers/enthouan/trello-mcp",
      "returned HTTP 404",
      "POST /api/mcp/servers/submit",
      "Submit for Review",
      "write or admin access",
      "Exact OAuth scopes are not public",
      "claim an automatically ingested exact match instead of creating a duplicate",
    ]) {
      expect(audit).toContain(marker);
    }
    expect(audit).toMatch(
      /no existing profile to claim and no duplicate to\s+reconcile/,
    );
    expect(audit).toMatch(
      /no Glama authentication, OAuth consent, submission,\s+claim, GitHub App installation, build-spec change, deployment, Glama release,/,
    );
    expect(audit).toMatch(
      /It used no real\s+Trello credentials and made no live Trello API calls\./,
    );
  });

  it("keeps server, hosting, connector, and release ownership distinct", async () => {
    const audit = await readinessAudit();
    const mechanisms = section(
      audit,
      "## Similar names, different ownership mechanisms",
      "## Repository readiness checklist",
    );

    for (const marker of [
      "GitHub OAuth",
      "Repository-root `glama.json`",
      "Glama GitHub App",
      "`/.well-known/glama.json` on a service domain",
      "GitHub release",
      "Glama release",
      "not the repository-root server file",
    ]) {
      expect(mechanisms).toContain(marker);
    }
    expect(audit).toContain("not a documented absolute prerequisite");
    expect(audit).toContain("strongly recommended before submission");

    const configMatch = audit.match(
      /```json\n(\{\n {2}"\$schema": "https:\/\/glama\.ai\/mcp\/schemas\/server\.json",\n {2}"maintainers": \["enthouan"\]\n\})\n```/,
    );
    expect(configMatch?.[1]).toBeDefined();
    expect(JSON.parse(configMatch?.[1] ?? "{}")).toEqual({
      $schema: "https://glama.ai/mcp/schemas/server.json",
      maintainers: ["enthouan"],
    });
  });

  it("covers build, introspection, and TDQS readiness without inventing scores", async () => {
    const audit = await readinessAudit();

    for (const marker of [
      "`README.md`",
      "MIT `LICENSE`",
      "Root multi-stage Node 24 Dockerfile",
      "is public, active, unarchived",
      "`https://trello-mcp.com/`",
      "`>=24.0.0 <25.0.0`",
      "`pnpm@10.34.1`",
      "`docker build -t trello-mcp .`",
      "`node dist/index.js`",
      "`TRANSPORT=stdio`",
      "Streamable HTTP",
      "`LOG_LEVEL=info`",
      "makes `PORT` unused",
      "`TRELLO_API_KEY`",
      "`TRELLO_TOKEN`",
      "`MCP_AUTH_TOKEN`",
      "`TRELLO_ATTACHMENT_UPLOAD_ROOT`",
      "`tools/list`",
      "`resources/list`",
      "`prompts/list`",
      "all 77 tools",
      "40 read, 31 write, and 6 permanent-delete",
      "an inspectable server and at least one detected tool",
      "a missing LICENSE is an installation blocker",
      "outbound Trello access denied",
      "No tool title is registered",
      "no MCP `outputSchema` is registered",
      "No `readOnlyHint`, `destructiveHint`, `idempotentHint`, or `openWorldHint`",
      "Purpose Clarity",
      "Usage Guidelines",
      "Behavioral Transparency",
      "Parameter Semantics",
      "Conciseness & Structure",
      "Contextual Completeness",
      "B at 3.0+ (the passing bar)",
      "0.6 × mean(TDQS) + 0.4 × minimum(TDQS)",
      "70% definition quality and 30% server coherence",
      "Do not invent a numeric TDQS score",
      "six permanent-delete operations",
    ]) {
      expect(audit).toContain(marker);
    }
    expect(audit).toMatch(
      /output\s+schema reduces how much return-shape explanation/,
    );
    expect(audit).toMatch(
      /must not become acceptance\s+requirements until observed directly/,
    );
  });

  it("maps sandbox checks and preserves Risky versus Malicious review semantics", async () => {
    const audit = await readinessAudit();
    const safety = section(
      audit,
      "## Sandbox and security review mapping",
      "## Indexing, review, scoring, and refresh lifecycle",
    );

    for (const marker of [
      "Credential access",
      "Secrets come from declared environment variables",
      "Outbound network",
      "undeclared outbound hosts",
      "Exfiltration-like payloads",
      "Logger redaction covers Trello credentials, authorization values",
      "stdio logging goes to stderr",
      "Filesystem reads/writes",
      "realpath and symlink containment",
      "Process spawning",
      "No production subprocess or shell execution",
      "Working-directory writes",
      "Schema drift and prompt-injection patterns",
      "explicitly documents schema-drift and prompt-injection monitoring for hosted connectors",
      "Normal Vitest coverage uses mocked or injected fetchers",
      "`https://api.trello.com/1`",
      "Keep upload disabled for initial discovery",
      "`Risky`",
      "may remain publicly listed",
      "`Malicious`",
      "internal review",
      "no public numeric security-grade formula",
    ]) {
      expect(safety).toContain(marker);
    }
    expect(safety).toMatch(/unrelated\s+credential-path access/);
    expect(audit).not.toMatch(/TRELLO_(?:API_KEY|TOKEN)=\S+/);
  });

  it("assigns the audit, preparation, and external submission exactly once", async () => {
    const ownership = section(
      await readinessAudit(),
      "## Downstream issue ownership",
      "## Blockers and open questions",
    );
    const expected = [
      ["#64", "Produce this evidence-pinned requirements audit"],
      ["#65", "Add and validate root `glama.json`"],
      ["#66", "submit/claim the exact repository"],
    ] as const;

    for (const [issue, responsibility] of expected) {
      expect(ownership.match(new RegExp(`\\[${issue}\\]`, "g"))).toHaveLength(
        1,
      );
      expect(ownership).toContain(responsibility);
    }
  });
});
