import { execFile } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { z } from "zod";
import { allTools } from "../src/trello/tools.js";
import {
  imageName,
  parseReleaseTags,
  prepareImage,
  publishAndVerify,
  registryEntry,
  registryUrl,
  repairImageTags,
  stableRelease,
  validateManifest,
  verifyImage,
  versionUrl,
} from "./lib/mcp-registry.js";
import { discoverReleaseImage } from "./lib/release-discovery.js";

const exec = promisify(execFile);
const root = new URL("../", import.meta.url);
const json = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(path, root), "utf8"));
const packageVersion = z
  .object({ version: z.string() })
  .parse(await json("package.json")).version;
const releaseVersion = stableRelease({
  eventName: process.env.GITHUB_EVENT_NAME,
  ref: process.env.GITHUB_REF,
  repository: process.env.GITHUB_REPOSITORY,
});
const schema = z
  .record(z.string(), z.unknown())
  .parse(await json("scripts/schemas/mcp-server-2025-12-11.schema.json"));
const manifest = validateManifest(
  await json("server.json"),
  packageVersion,
  schema,
  releaseVersion,
);

async function output(name: string, value: string) {
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function releaseCommit(): Promise<string> {
  if (!releaseVersion)
    throw new Error(
      "Registry publishing requires a stable tag push in enthouan/trello-mcp.",
    );
  const revision = z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .parse(process.env.GITHUB_SHA);
  const head = (await exec("git", ["rev-parse", "HEAD"])).stdout.trim();
  if (
    (
      await exec("git", ["cat-file", "-t", `refs/tags/v${releaseVersion}`])
    ).stdout.trim() !== "tag"
  )
    throw new Error("Release tags must be annotated tag objects.");
  const tag = (
    await exec("git", ["rev-parse", `refs/tags/v${releaseVersion}^{commit}`])
  ).stdout.trim();
  if (head !== revision || tag !== revision)
    throw new Error("Checkout, release tag, and event commit must agree.");
  try {
    await exec("git", ["merge-base", "--is-ancestor", revision, "origin/main"]);
  } catch {
    throw new Error("The release commit must already belong to origin/main.");
  }
  return revision;
}

const runtimeExpectations = {
  version: manifest.version,
  names: allTools.map((tool) => tool.name),
};

async function requiredImage(revision: string): Promise<string> {
  const expected = z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .parse(process.env.IMAGE_DIGEST);
  const digest = await verifyImage(manifest, revision, expected);
  if (!digest)
    throw new Error("The exact versioned image is not publicly available.");
  return digest;
}

async function runPublisher(publisher: string, args: string[], phase: string) {
  try {
    await exec(publisher, args, { timeout: 120_000 });
  } catch (error) {
    const code = z
      .object({ code: z.union([z.string(), z.number()]).optional() })
      .safeParse(error);
    throw new Error(
      `Registry ${phase} failed (publisher exit ${code.success ? (code.data.code ?? "unknown") : "unknown"}). Inspect the exact public entry and follow docs/mcp-registry.md; captured authentication output is withheld.`,
    );
  }
}

async function main() {
  const command = process.argv[2];
  if (command === "check") {
    const dockerfile = await readFile(new URL("Dockerfile", root), "utf8");
    if (
      !dockerfile.includes(
        `LABEL io.modelcontextprotocol.server.name="${manifest.name}"`,
      )
    )
      throw new Error("Dockerfile lacks the required ownership label.");
    console.log(
      `Official schema and release manifest valid: ${manifest.name} ${manifest.version}`,
    );
  } else if (command === "prepare") {
    await output("stable", String(releaseVersion !== undefined));
    if (!releaseVersion) return;
    const revision = await releaseCommit();
    const digest = await prepareImage(manifest, revision);
    await output("exact-tag", `${imageName}:${manifest.version}`);
    await output("existing", String(digest !== undefined));
    await output("digest", digest ?? "");
    console.log(
      digest
        ? `Reusing verified release image ${digest}; no rebuild.`
        : "Exact Registry entry and release image are absent; a new build may proceed.",
    );
  } else if (command === "verify-image") {
    const revision = await releaseCommit();
    const digest = await requiredImage(revision);
    const runtime = await discoverReleaseImage(
      `${imageName}@${digest}`,
      runtimeExpectations,
    );
    const tagObject = (
      await exec("git", ["rev-parse", `refs/tags/v${releaseVersion}`])
    ).stdout.trim();
    await output("tag-object", tagObject);
    await output("revision", revision);
    await output("digest", digest);
    const evidence = `## Verified release image\n\n- Version: ${manifest.version}\n- Commit: ${revision}\n- Public image: ${imageName}@${digest}\n- Ownership, version, revision, maximum provenance, and SPDX SBOM verified on linux/amd64 and linux/arm64, bound to each platform digest.\n- Native ${runtime.platform} offline stdio initialization, ${runtime.toolCount}-tool discovery, and image-defined health check passed.\n`;
    console.log(evidence);
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, evidence);
  } else if (command === "repair-tags") {
    const revision = await releaseCommit();
    const digest = z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/)
      .parse(process.env.IMAGE_DIGEST);
    const results = await repairImageTags(manifest, revision, digest, {
      releaseTags: async () =>
        parseReleaseTags(
          (await exec("git", ["ls-remote", "--tags", "origin"])).stdout,
        ),
      publishAlias: async (tag, sourceDigest) => {
        // A single existing index source is copied verbatim, including attestations.
        await exec("docker", [
          "buildx",
          "imagetools",
          "create",
          "--tag",
          `${imageName}:${tag}`,
          `${imageName}@${sourceDigest}`,
        ]);
      },
    });
    const evidence = `## Release image aliases\n\n${results.map((result) => `- ${result}`).join("\n")}\n`;
    console.log(evidence);
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, evidence);
  } else if (command === "discover") {
    const image = z.string().min(1).parse(process.argv[3]);
    const runtime = await discoverReleaseImage(image, runtimeExpectations, {
      localOrTagged: true,
    });
    console.log(
      `Offline stdio discovery passed: ${runtime.toolCount} tools, image-defined health ${runtime.health}.`,
    );
  } else if (command === "verify") {
    if ((await registryEntry(manifest)) !== "identical")
      throw new Error("Exact Registry version is absent.");
    console.log(
      `Verified identical active Registry entry: ${versionUrl(manifest)}`,
    );
  } else if (command === "publish") {
    const revision = await releaseCommit();
    const publisher = z.string().min(1).parse(process.env.MCP_PUBLISHER);
    let digest = "";
    const outcome = await publishAndVerify({
      verifyArtifact: async () => {
        digest = await requiredImage(revision);
      },
      lookup: () => registryEntry(manifest),
      validate: () =>
        runPublisher(publisher, ["validate", "server.json"], "validation"),
      authenticate: async () => {
        // The official publisher obtains a short-lived GitHub Actions identity.
        // Do not print authentication output or persist it as an artifact.
        await runPublisher(
          publisher,
          ["login", "github-oidc", `--registry=${registryUrl}`],
          "OIDC authentication",
        );
      },
      publish: () =>
        runPublisher(publisher, ["publish", "server.json"], "publication"),
      sleep: async (milliseconds) => {
        await setTimeout(milliseconds);
      },
    });
    const evidence = `## Official MCP Registry\n\n- Result: ${outcome}; full publisher payload matches and status is active.\n- Version: ${manifest.version}\n- Commit: ${revision}\n- Image: ${imageName}@${digest}\n- Anonymous API: [exact version](${versionUrl(manifest)})\n- Image job passed stdio initialization and tools/list with networking disabled.\n`;
    console.log(evidence);
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, evidence);
  } else {
    throw new Error(
      "Use check, prepare, verify-image, repair-tags, discover <image>, verify, or publish.",
    );
  }
}

await main().catch((error: unknown) => {
  // Publisher failures can include authentication response bodies. Report only
  // exit status, never captured stdout/stderr or command environment.
  if (error instanceof Error && "cmd" in error) {
    console.error(
      "Release subprocess failed; verify the exact public entry and rerun the failed Registry job. Do not rebuild or replace the image.",
    );
  } else {
    console.error(
      error instanceof Error ? error.message : "Registry validation failed.",
    );
  }
  process.exitCode = 1;
});
