import { readFile, writeFile } from "node:fs/promises";
import { allTools } from "../src/trello/tools.js";
import { renderDockerRegistryTools } from "./lib/docker-registry-tools.js";

const artifact = new URL("../servers/trello-mcp/tools.json", import.meta.url);
const args = process.argv.slice(2);
const checkMode = args.length === 1 && args[0] === "--check";

if (args.length > 0 && !checkMode) {
  throw new Error("Usage: generate-docker-registry-tools.ts [--check]");
}

const expected = renderDockerRegistryTools(allTools);

if (checkMode) {
  let current: string | undefined;
  try {
    current = await readFile(artifact, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (current !== expected) {
    console.error(
      "servers/trello-mcp/tools.json is stale. Run `corepack pnpm registry:tools` to regenerate it.",
    );
    process.exitCode = 1;
  } else {
    console.log("Docker MCP Registry tools.json is current.");
  }
} else {
  await writeFile(artifact, expected);
  console.log("updated: servers/trello-mcp/tools.json");
}
