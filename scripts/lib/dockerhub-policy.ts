import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { type MirrorIdentity, MissingContent } from "./dockerhub-registry.js";
import {
  compareVersions,
  imageName,
  imageVerificationInput,
  repository,
  serverName,
  stableRelease,
  validateManifest,
} from "./mcp-registry.js";
import { releaseToolNames } from "./release-discovery.js";

type Git = (args: string[]) => string;
type Schema = Record<string, unknown>;
const main = "refs/remotes/origin/main";
const stableVersion = imageVerificationInput.shape.version;

function releaseFiles(revision: string, run: Git) {
  return {
    pkg: run(["show", `${revision}:package.json`]),
    manifest: run(["show", `${revision}:server.json`]),
  };
}

function releaseManifest(
  version: string,
  { pkg, manifest }: ReturnType<typeof releaseFiles>,
  schema: Schema,
) {
  return validateManifest(
    JSON.parse(manifest),
    z
      .object({ name: z.literal("trello-mcp"), version: z.string() })
      .parse(JSON.parse(pkg)).version,
    schema,
    version,
  );
}

export function selectedRelease(
  env: NodeJS.ProcessEnv,
  run: Git,
  schema: Schema,
  mode: "preview" | "discover" | "exact" | "latest" = "preview",
) {
  const ref = env.GITHUB_REF;
  const tag = env.RELEASE_TAG;
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.GITHUB_REPOSITORY !== repository ||
    !tag?.startsWith("v")
  )
    throw new Error("Expected an upstream stable release.");
  const identity = imageVerificationInput.parse({
    version: tag.slice(1),
    revision: env.RELEASE_COMMIT,
    digest: env.RELEASE_IMAGE_DIGEST,
  });
  const tagRef = `refs/tags/${tag}`;
  if (env.GITHUB_EVENT_NAME === "push") {
    const version = stableRelease({
      eventName: "push",
      repository: env.GITHUB_REPOSITORY,
      ref,
    });
    if (
      version !== identity.version ||
      env.GITHUB_SHA !== identity.revision ||
      env.GITHUB_WORKFLOW_REF !==
        `${repository}/.github/workflows/release.yml@${tagRef}`
    )
      throw new Error(
        "The verified image outputs must belong to this canonical stable tag push.",
      );
  } else if (
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    ref !== "refs/heads/main" ||
    env.GITHUB_WORKFLOW_REF !==
      `${repository}/.github/workflows/dockerhub.yml@${ref}`
  ) {
    throw new Error(
      "Mirror recovery must run the reviewed workflow from main.",
    );
  }
  if (
    run(["rev-parse", "HEAD"]) !== env.GITHUB_SHA ||
    run(["cat-file", "-t", tagRef]) !== "tag" ||
    run(["rev-parse", `${tagRef}^{commit}`]) !== identity.revision
  )
    throw new Error("Checkout, event, and annotated release tag disagree.");
  const tagObject = imageVerificationInput.shape.revision.parse(
    run(["rev-parse", tagRef]),
  );
  const firstRecoveryRead =
    env.GITHUB_EVENT_NAME === "workflow_dispatch" &&
    mode === "preview" &&
    !env.EXPECTED_TAG_OBJECT;
  if (!firstRecoveryRead && env.EXPECTED_TAG_OBJECT !== tagObject)
    throw new Error(
      "Selected annotated tag object changed or is missing from the verified job outputs.",
    );
  run(["merge-base", "--is-ancestor", "HEAD", main]);
  run(["merge-base", "--is-ancestor", identity.revision, main]);
  const manifest = releaseManifest(
    identity.version,
    releaseFiles(identity.revision, run),
    schema,
  );
  const tools = releaseToolNames(
    run(["show", `${identity.revision}:README.md`]),
  );
  return { ...identity, manifest, tools, tagObject };
}

// Newer releases may use a later Registry schema. Their stable coordinates
// reserve latest before their image or GitHub Release is available.
function matchesNewerRelease(
  version: string,
  files: ReturnType<typeof releaseFiles>,
) {
  try {
    const pkg = z
      .object({ name: z.string(), version: z.string() })
      .parse(JSON.parse(files.pkg));
    if (pkg.name !== "trello-mcp" || pkg.version !== version) return false;
    const manifest = z
      .object({
        name: z.string(),
        version: z.string(),
        packages: z.array(
          z.object({ registryType: z.string(), identifier: z.string() }),
        ),
      })
      .parse(JSON.parse(files.manifest));
    return (
      manifest.name === serverName &&
      manifest.version === version &&
      manifest.packages.some(
        (entry) =>
          entry.registryType === "oci" &&
          entry.identifier === `${imageName}:${version}`,
      )
    );
  } catch {
    throw new Error(
      `Cannot determine release coordinates for newer annotated tag v${version}.`,
    );
  }
}

// Observe tag deletions and moves without changing the checkout's original
// annotated tag object. Tag creation reserves latest before image publication.
export function freshReleases(
  selected: MirrorIdentity,
  run: Git,
): ReadonlyMap<string, string> {
  const prefix = "refs/mirror/tags/";
  run([
    "fetch",
    "--atomic",
    "--prune",
    "--no-tags",
    "--no-recurse-submodules",
    `https://github.com/${repository}.git`,
    `+refs/heads/main:${main}`,
    `+refs/tags/v*:${prefix}v*`,
  ]);
  run(["merge-base", "--is-ancestor", "HEAD", main]);
  const refs = run([
    "for-each-ref",
    `--merged=${main}`,
    "--format=%(refname:strip=3) %(objecttype) %(*objecttype) %(*objectname)",
    prefix,
  ]);
  const releases = new Map<string, string>();
  for (const line of refs.split("\n")) {
    const match = /^v(\S+) tag commit ([a-f0-9]{40})$/.exec(line);
    const version = match?.[1];
    const revision = match?.[2];
    if (!version || !revision || !stableVersion.safeParse(version).success)
      continue;
    if (compareVersions(version, selected.version) > 0) {
      // Old or mistagged commits can lack release metadata. Git failures and
      // unreadable objects are inconclusive, so let those errors stop the run.
      if (
        run([
          "ls-tree",
          "--name-only",
          revision,
          "package.json",
          "server.json",
        ]) !== "package.json\nserver.json"
      )
        continue;
      if (!matchesNewerRelease(version, releaseFiles(revision, run))) continue;
    }
    releases.set(version, revision);
  }
  if (
    releases.get(selected.version) !== selected.revision ||
    run(["rev-parse", `${prefix}v${selected.version}`]) !==
      run(["rev-parse", `refs/tags/v${selected.version}`])
  )
    throw new Error(
      "Selected remote annotated tag is missing, changed, or outside protected main.",
    );
  return releases;
}

type Dependencies = {
  releases: () => ReadonlyMap<string, string>;
  tagDigest: (tag: string) => Promise<string | null>;
  identity: (digest: string) => Promise<MirrorIdentity>;
  verify: () => Promise<unknown>;
  sleep?: (ms: number) => Promise<void>;
};

type Plan = {
  action: "copy" | "repair" | "verified" | "preserve";
  previous: string | null;
  detail: string;
};

function newestRelease(
  selected: MirrorIdentity,
  releases: ReadonlyMap<string, string>,
): string {
  if (releases.get(selected.version) !== selected.revision)
    throw new Error("Selected remote tag disappeared or moved.");
  let newest = selected.version;
  for (const version of releases.keys())
    if (compareVersions(version, newest) > 0) newest = version;
  return newest;
}

export async function planMirrorTag(
  tag: string,
  selected: MirrorIdentity,
  deps: Dependencies,
): Promise<Plan> {
  if (tag !== selected.version && tag !== "latest")
    throw new Error("Unexpected mirror tag.");
  const releases = deps.releases();
  const newest = newestRelease(selected, releases);
  const previous = await deps.tagDigest(tag);
  const reserved = tag === "latest" && newest !== selected.version;
  const preserve: Plan = {
    action: "preserve",
    previous,
    detail: `v${newest} owns latest`,
  };
  if (previous === null)
    return reserved
      ? preserve
      : { action: "copy", previous, detail: "tag is absent" };
  if (previous === selected.digest) {
    try {
      await deps.verify();
      return reserved
        ? preserve
        : { action: "verified", previous, detail: "complete graph verified" };
    } catch (error) {
      if (!(error instanceof MissingContent)) throw error;
      // Preview must be able to reach the exact repair step even when both
      // tags already point at the same incomplete index.
      return reserved
        ? preserve
        : { action: "repair", previous, detail: error.message };
    }
  }
  if (tag !== "latest")
    throw new Error(`Immutable conflict at exact Docker Hub tag ${tag}.`);
  const prior = await deps.identity(previous);
  if (
    prior.digest !== previous ||
    (await deps.tagDigest(prior.version)) !== previous
  )
    throw new Error("Existing latest differs from its exact Docker Hub tag.");
  const order = compareVersions(prior.version, selected.version);
  if (order === 0)
    throw new Error(
      "Existing latest conflicts with the selected exact release.",
    );
  const priorRevision = releases.get(prior.version);
  // A newer exact image also protects against a rollback if its Git tag disappeared.
  if (
    priorRevision !== prior.revision &&
    (priorRevision !== undefined || order < 0)
  )
    throw new Error("Existing latest has conflicting Git release identity.");
  if (reserved) return preserve;
  if (order > 0)
    return {
      action: "preserve",
      previous,
      detail: `latest already identifies newer v${prior.version}`,
    };
  return { action: "copy", previous, detail: `advance from v${prior.version}` };
}

class LatestReserved extends Error {}

async function confirmExact(selected: MirrorIdentity, deps: Dependencies) {
  if ((await deps.tagDigest(selected.version)) !== selected.digest)
    throw new Error("Exact Docker Hub tag changed before latest publication.");
}

async function confirmedPlan(
  tag: string,
  selected: MirrorIdentity,
  plan: Plan,
  deps: Dependencies,
) {
  if (tag === "latest") await confirmExact(selected, deps);
  if ((await deps.tagDigest(tag)) !== plan.previous)
    throw new Error(`${tag} changed during verification.`);
  if (plan.action === "preserve")
    return `${tag} preserved at ${plan.previous ?? "absent"}: ${plan.detail}.`;
  return `${tag} verified at ${selected.digest}; complete existing image reused.`;
}

export async function publishMirrorTag(
  tag: string,
  selected: MirrorIdentity,
  deps: Dependencies,
  copy: (tag: string, beforeWrite: () => Promise<void>) => Promise<boolean>,
): Promise<string> {
  const plan = await planMirrorTag(tag, selected, deps);
  if (tag === "latest" && plan.action === "repair")
    throw new Error(
      "The exact image graph must be repaired before publishing latest.",
    );
  if (plan.action === "preserve" || plan.action === "verified")
    return confirmedPlan(tag, selected, plan, deps);

  let acknowledged: boolean;
  try {
    // The copier calls this after publisher login, immediately before regctl writes.
    acknowledged = await copy(tag, async () => {
      const newest = newestRelease(selected, deps.releases());
      if (tag === "latest") {
        if (newest !== selected.version) throw new LatestReserved();
        await confirmExact(selected, deps);
      }
      if ((await deps.tagDigest(tag)) !== plan.previous)
        throw new Error(
          "Destination changed before write. Inspect the mirror and retry.",
        );
    });
  } catch (error) {
    if (!(error instanceof LatestReserved)) throw error;
    const current = await planMirrorTag(tag, selected, deps);
    if (current.action !== "preserve")
      throw new Error(
        "Latest ownership changed during verification. Inspect and retry.",
      );
    return confirmedPlan(tag, selected, current, deps);
  }
  // A lost copy response can follow a committed tag. Only repeat public reads.
  for (let attempt = 0; attempt < 5; attempt++) {
    const observed = await deps.tagDigest(tag);
    if (observed === selected.digest) {
      try {
        await deps.verify();
        if ((await deps.tagDigest(tag)) !== selected.digest)
          throw new Error(`${tag} changed during verification.`);
        return `${tag} ${acknowledged ? "copied and verified" : "verified after an uncertain copy response"} at ${selected.digest}.`;
      } catch (error) {
        if (!(error instanceof MissingContent)) throw error;
      }
    } else if (observed !== null && observed !== plan.previous) {
      throw new Error(`Conflicting Docker Hub read-back for ${tag}.`);
    }
    if (attempt < 4) await (deps.sleep ?? setTimeout)(1000 * 2 ** attempt);
  }
  throw new Error(
    `Copy of ${tag} remains unconfirmed. Inspect the destination and retry only the mirror.`,
  );
}
