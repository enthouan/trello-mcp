import { readFile, writeFile } from "node:fs/promises";
import { authTools } from "../src/trello/auth.js";
import { boardTools } from "../src/trello/boards.js";
import { cardTools } from "../src/trello/cards.js";
import { customFieldTools } from "../src/trello/custom-fields.js";
import { labelTools } from "../src/trello/labels.js";
import { listTools } from "../src/trello/lists.js";
import { searchTools } from "../src/trello/search.js";

const readmePath = new URL("../README.md", import.meta.url);
const readme = await readFile(readmePath, "utf8");
const rows = ["| Name | When to use | Key inputs |", "| --- | --- | --- |"];

for (const tool of [
  ...authTools,
  ...boardTools,
  ...listTools,
  ...cardTools,
  ...labelTools,
  ...customFieldTools,
  ...searchTools,
]) {
  const keys =
    "shape" in tool.inputSchema
      ? Object.keys(tool.inputSchema.shape as Record<string, unknown>).join(
          ", ",
        )
      : "";
  rows.push(`| \`${tool.name}\` | ${tool.description} | ${keys} |`);
}

const next = readme.replace(
  /<!-- tools:start -->[\s\S]*<!-- tools:end -->/,
  `<!-- tools:start -->\n${rows.join("\n")}\n<!-- tools:end -->`,
);
await writeFile(readmePath, next);
