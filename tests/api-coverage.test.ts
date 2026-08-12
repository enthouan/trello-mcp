import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { allTools } from "../src/trello/tools.js";

const OFFICIAL_REST_GROUPS = [
  "Actions",
  "Applications",
  "Batch",
  "Boards",
  "Cards",
  "Checklists",
  "CustomFields",
  "Emoji",
  "Enterprises",
  "Labels",
  "Lists",
  "Members",
  "Notifications",
  "Organizations",
  "Plugins",
  "Search",
  "Tokens",
  "Webhooks",
] as const;

async function canonicalCoverage() {
  return readFile(new URL("../docs/api-coverage.md", import.meta.url), "utf8");
}

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Could not find coverage section from ${start} to ${end}.`);
  }
  return source.slice(startIndex + start.length, endIndex);
}

describe("canonical Trello REST API coverage", () => {
  it("documents every registered MCP tool", async () => {
    const coverage = await canonicalCoverage();
    expect(coverage).toContain(
      `all ${allTools.length} tools currently registered through \`allTools\``,
    );
    const documentedNames = new Set(
      [...coverage.matchAll(/`([a-z][a-z0-9_]+)`/g)].map((match) => match[1]),
    );
    const registeredNames = allTools.map(({ name }) => name);

    expect(new Set(registeredNames).size).toBe(registeredNames.length);
    expect(
      registeredNames.filter((name) => !documentedNames.has(name)),
    ).toEqual([]);
  });

  it("lists each official REST API group once in the top-level matrix", async () => {
    const coverage = await canonicalCoverage();
    const matrix = section(
      coverage,
      "## Coverage Matrix",
      "## Detailed Coverage By Group",
    );
    const documentedGroups = [
      ...matrix.matchAll(
        /^\| \[([^\]]+)\]\(https:\/\/developer\.atlassian\.com\/cloud\/trello\/rest\/api-group-[^)]+\/\) \|/gm,
      ),
    ].map((match) => match[1]);

    expect(documentedGroups).toEqual(OFFICIAL_REST_GROUPS);
    expect(new Set(documentedGroups).size).toBe(OFFICIAL_REST_GROUPS.length);
  });
});
