import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  freshReleases,
  planMirrorTag,
  publishMirrorTag,
  selectedRelease,
} from "./lib/docker-hub-mirror.js";
import {
  imageName,
  imageVerificationInput,
  repository,
} from "./lib/mcp-registry.js";
import {
  type MirrorIdentity,
  PublicRegistry,
  requirePublicHub,
} from "./lib/mirror-registry.js";
import { discoverReleaseImage } from "./lib/release-discovery.js";
import schema from "./schemas/mcp-server-2025-12-11.schema.json" with {
  type: "json",
};

const destination = `docker.io/${repository}`;
const git = (args: string[]) =>
  execFileSync("git", args, {
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
    stdio: "pipe",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_TERMINAL_PROMPT: "0",
    },
  }).trimEnd();

type Run = (
  file: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  input?: string,
) => boolean;
const regctl: Run = (file, args, env, input) => {
  const result = spawnSync(file, args, {
    env,
    input,
    stdio: ["pipe", "ignore", "ignore"],
    timeout: 10 * 60_000,
  });
  return result.status === 0 && !result.error;
};

// Only the login process receives the token on stdin. Neither git, regctl nor
// the offline container inherits the publisher environment.
export async function copyImage(
  identity: MirrorIdentity,
  tag: string,
  env: NodeJS.ProcessEnv,
  guard: () => Promise<void>,
  run: Run = regctl,
) {
  const { version, digest } = imageVerificationInput.parse(identity);
  assert(tag === version || tag === "latest", "Unexpected Docker Hub tag");
  assert(
    env.DOCKERHUB_CONFIRMED_REPOSITORY === destination,
    "Confirm the public Docker Hub repository in the mirror environment",
  );
  assert(
    env.DOCKERHUB_USERNAME === "enthouan" &&
      env.DOCKERHUB_TOKEN &&
      env.MIRROR_TEMP,
    "Configure the mirror publisher and pinned regctl",
  );
  const file = join(env.MIRROR_TEMP, "regctl");
  const directory = mkdtempSync(join(env.MIRROR_TEMP, "auth-"));
  const isolated = {
    PATH: env.PATH,
    HOME: directory,
    DOCKER_CONFIG: directory,
    REGCTL_CONFIG: join(directory, "regctl.json"),
  };
  try {
    assert(
      run(
        file,
        ["config", "set", "--docker-cred=false", "--docker-cert=false"],
        isolated,
      ),
      "regctl isolation failed",
    );
    assert(
      run(
        file,
        [
          "registry",
          "login",
          "docker.io",
          "--user",
          env.DOCKERHUB_USERNAME,
          "--pass-stdin",
        ],
        isolated,
        env.DOCKERHUB_TOKEN,
      ),
      "Docker Hub login failed",
    );
    await guard();
    return run(
      file,
      [
        "image",
        "copy",
        "--force-recursive",
        `${imageName}@${digest}`,
        `${destination}:${tag}`,
      ],
      isolated,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function report(line: string) {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n\n`);
}

async function mirror(mode: string | undefined) {
  assert(
    mode === "preview" ||
      mode === "discover" ||
      mode === "exact" ||
      mode === "latest",
    "Invalid mirror operation",
  );
  const selected = selectedRelease(process.env, git, schema, mode);
  const { version, revision, digest } = selected;
  const identity = { version, revision, digest };
  const source = new PublicRegistry("ghcr.io");
  const hub = new PublicRegistry("docker.io");
  const releases = () => freshReleases(selected, git);
  const discovery = async (repositoryName: string) => {
    const evidence = await discoverReleaseImage(`${repositoryName}@${digest}`, {
      version,
      names: selected.tools,
    });
    report(
      `${repositoryName}@${digest} native ${evidence.platform} discovery: ${evidence.toolCount} tools, image health ${evidence.health}.`,
    );
  };
  const verify = async (registry: PublicRegistry, name: string) => {
    const evidence = await registry.verify(identity);
    report(
      `${name}@${digest} verified anonymously including configurations, layers and per-platform SBOM/provenance: ${evidence.platforms.map((p) => `${p.platform} ${p.digest}`).join(", ")}.`,
    );
  };
  report(
    `v${version}, commit ${revision}, index ${digest}. Workflow ${process.env.GITHUB_WORKFLOW_REF}, implementation ${git(["rev-parse", "HEAD"])}, run ${process.env.GITHUB_RUN_ID}, attempt ${process.env.GITHUB_RUN_ATTEMPT}.`,
  );
  releases();
  assert(
    (await source.tagDigest(version)) === digest,
    "Exact GHCR tag differs from the verified release digest",
  );
  if (mode === "preview") {
    await verify(source, imageName);
    if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch")
      await discovery(imageName);
  }
  await requirePublicHub();
  if (mode === "discover") {
    assert(
      (await hub.tagDigest(version)) === digest,
      "Exact Docker Hub tag changed before discovery",
    );
    await discovery(destination);
    return;
  }
  const deps = {
    releases,
    tagDigest: (tag: string) => hub.tagDigest(tag),
    identity: (value: string) => hub.identity(value),
    verify: () => verify(hub, destination),
  };
  if (mode === "preview") {
    for (const tag of [version, "latest"]) {
      const plan = await planMirrorTag(tag, identity, deps);
      report(
        `${destination}:${tag} — ${plan.action} (${plan.detail}). Current digest: ${plan.previous ?? "absent"}.`,
      );
    }
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `tag-object=${selected.tagObject}\n`,
      );
    return;
  }
  report(
    await publishMirrorTag(
      mode === "exact" ? version : "latest",
      identity,
      deps,
      (tag, guard) => copyImage(identity, tag, process.env, guard),
    ),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    await mirror(process.argv[2]);
  } catch (error) {
    console.error(
      "Docker Hub mirror failed.",
      error instanceof Error ? error.message : "Unknown error",
    );
    process.exitCode = 1;
  }
}
