import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { allTools } from "../src/trello/tools.js";

const audit = await readFile(
  new URL("../docs/glama-readiness.md", import.meta.url),
  "utf8",
);

describe("Glama readiness evidence", () => {
  it("dates mutable observations and pins a single TDQS revision", () => {
    expect(audit).toMatch(/Last verified: \*\*\d{4}-\d{2}-\d{2}\*\*/);
    const revisions = [
      ...audit.matchAll(
        /https:\/\/github\.com\/glama-ai\/tool-definition-quality-score\/blob\/([0-9a-f]{40})\//g,
      ),
    ].map((match) => match[1]);
    expect(revisions.length).toBeGreaterThan(0);
    expect(new Set(revisions).size).toBe(1);
    expect(audit).toMatch(/ghcr\.io\/enthouan\/trello-mcp@sha256:[0-9a-f]{64}/);
  });

  it("audits every registered tool exactly once, including local upload", () => {
    const names = [...audit.matchAll(/^\| `([a-z_]+)` \|/gm)].map(
      (match) => match[1],
    );
    expect(names.sort()).toEqual(allTools.map(({ name }) => name).sort());
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("card_attachment_upload");
  });

  it("keeps independent external milestones and excludes private receipt data", () => {
    const externalRecord = audit
      .split("## External validation record\n")[1]
      ?.split("\n## Pinned evidence")[0];
    expect(externalRecord).toBeDefined();
    const acceptanceChecklist = externalRecord
      ?.split("### Acceptance checklist\n")[1]
      ?.split("\n### ")[0];
    expect(acceptanceChecklist).toBeDefined();
    const milestones = [
      ...(acceptanceChecklist ?? "").matchAll(/^\| ([^|]+) \| ([^|]+) \|/gm),
    ].map((match) => match[1]?.trim());
    expect(milestones).toEqual([
      "Milestone",
      "---",
      "Submission",
      "Maintainer ownership",
      "Build and MCP introspection",
      "Public listing",
      "Glama Inspector",
      "Quality/security findings",
      "Search visibility",
    ]);
    expect(externalRecord).not.toMatch(
      /mail\.google\.com|Message-ID:|Authentication-Results:|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\/private\/tmp\//i,
    );
  });

  it("links preparation, external validation, and the separately owned gaps", () => {
    for (const issue of [64, 65, 66, 182, 206])
      expect(audit).toContain(
        `https://github.com/enthouan/trello-mcp/issues/${issue}`,
      );
    expect(audit).toContain("scripts/glama-discovery.ts");
    expect(audit).toContain("--network=none");
    expect(audit).toContain("(deny network*)");
    expect(audit).toContain("-32601");
    expect(audit).not.toMatch(/!\[[^\]]*\]\(https:\/\/glama\.ai\//);
  });
});
