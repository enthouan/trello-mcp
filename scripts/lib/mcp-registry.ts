import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv-provider.js";
import { z } from "zod";

export const registryUrl = "https://registry.modelcontextprotocol.io";
export const repository = "enthouan/trello-mcp";
export const serverName = "io.github.enthouan/trello-mcp";
export const imageName = `ghcr.io/${repository}`;
export const ownershipLabel = "io.modelcontextprotocol.server.name";
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const description = z.string().min(1).max(100);
const secret = (name: string) =>
  z.strictObject({
    name: z.literal(name),
    description,
    isRequired: z.literal(true),
    isSecret: z.literal(true),
    format: z.literal("string"),
  });

const manifestSchema = z.strictObject({
  $schema: z.literal(
    "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  ),
  name: z.literal(serverName),
  title: z.literal("trello-mcp"),
  description: description.regex(
    /independent.*community-maintained.*not an official Trello or Atlassian/i,
  ),
  version: z.string().regex(stableVersion),
  repository: z.strictObject({
    url: z.literal(`https://github.com/${repository}`),
    source: z.literal("github"),
    id: z.literal("1256352869"),
  }),
  websiteUrl: z.literal("https://trello-mcp.com/"),
  packages: z.tuple([
    z.strictObject({
      registryType: z.literal("oci"),
      identifier: z.string(),
      transport: z.strictObject({ type: z.literal("stdio") }),
      environmentVariables: z.tuple([
        z.strictObject({
          name: z.literal("TRANSPORT"),
          description,
          value: z.literal("stdio"),
        }),
        secret("TRELLO_API_KEY"),
        secret("TRELLO_TOKEN"),
      ]),
    }),
  ]),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type ReleaseEvent = {
  eventName?: string | undefined;
  ref?: string | undefined;
  repository?: string | undefined;
};

export function stableRelease(event: ReleaseEvent): string | undefined {
  if (event.eventName !== "push" || event.repository !== repository) return;
  const version = event.ref?.replace(/^refs\/tags\/v/, "");
  if (
    event.ref?.startsWith("refs/tags/v") &&
    stableVersion.test(version ?? "")
  ) {
    return version;
  }
}

export function validateManifest(
  input: unknown,
  packageVersion: string,
  schema: Record<string, unknown>,
  tagVersion?: string,
): Manifest {
  const official = new AjvJsonSchemaValidator().getValidator(schema)(input);
  if (!official.valid)
    throw new Error(`Official manifest schema: ${official.errorMessage}`);
  const manifest = manifestSchema.parse(input);
  if (
    manifest.version !== packageVersion ||
    (tagVersion !== undefined && manifest.version !== tagVersion) ||
    manifest.packages[0].identifier !== `${imageName}:${manifest.version}`
  ) {
    throw new Error(
      "Release tag, package.json, server.json, and exact image version must agree.",
    );
  }
  return manifest;
}

export function versionUrl(manifest: Manifest): string {
  return `${registryUrl}/v0.1/servers/${encodeURIComponent(manifest.name)}/versions/${encodeURIComponent(manifest.version)}`;
}

type Fetcher = typeof fetch;
const request = (
  fetcher: Fetcher,
  url: string,
  headers?: Record<string, string>,
) =>
  fetcher(url, {
    ...(headers && { headers }),
    signal: AbortSignal.timeout(30_000),
    redirect: "error",
  });

export class TransientRegistryLookupError extends Error {}

export async function registryEntry(
  manifest: Manifest,
  fetcher: Fetcher = fetch,
): Promise<"absent" | "identical"> {
  let response: Response;
  try {
    // Deleted versions must not look absent and trigger an attempted republish.
    response = await request(
      fetcher,
      `${versionUrl(manifest)}?include_deleted=true`,
    );
  } catch {
    throw new TransientRegistryLookupError(
      "Registry lookup failed: network request did not complete.",
    );
  }
  if (response.status === 404) return "absent";
  if (
    response.status === 408 ||
    response.status === 429 ||
    response.status >= 500
  )
    throw new TransientRegistryLookupError(
      `Registry lookup failed: HTTP ${response.status}.`,
    );
  if (response.status !== 200)
    throw new Error(`Registry lookup failed: HTTP ${response.status}.`);
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new TransientRegistryLookupError(
      "Registry lookup failed: response body did not complete.",
    );
  }
  const body = z
    .object({
      server: z.unknown(),
      _meta: z.object({
        "io.modelcontextprotocol.registry/official": z.object({
          status: z.literal("active"),
        }),
      }),
    })
    .parse(JSON.parse(text));
  // Compare every publisher field; ignore only the separate Registry-managed envelope.
  if (!isDeepStrictEqual(body.server, manifest)) {
    throw new Error(
      `Conflicting Registry metadata for ${manifest.name} ${manifest.version}; do not overwrite it.`,
    );
  }
  return "identical";
}

const descriptor = z.object({ digest: digestSchema });
const annotations = z.record(z.string(), z.string()).optional();
const indexSchema = z.object({
  annotations,
  manifests: z.array(
    descriptor.extend({
      platform: z.object({ os: z.string(), architecture: z.string() }),
      annotations,
    }),
  ),
});

// Anonymous GHCR reads prove that the Registry and unauthenticated clients can
// access the image. Authenticated docker inspection alone cannot establish that.
async function imageReader(fetcher: Fetcher) {
  const tokenResponse = await request(
    fetcher,
    `https://ghcr.io/token?service=ghcr.io&scope=repository:${repository}:pull`,
  );
  if (!tokenResponse.ok)
    throw new Error(
      `Anonymous GHCR token request failed: HTTP ${tokenResponse.status}.`,
    );
  const { token } = z
    .object({ token: z.string().min(1) })
    .parse(await tokenResponse.json());
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept:
      "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json",
  };
  const base = `https://ghcr.io/v2/${repository}`;
  async function readObject(
    path: string,
    digest?: string,
    allowAbsent = false,
  ) {
    // Blob endpoints redirect to GHCR's public CDN; auth is only sent to GHCR.
    const response = await fetcher(`${base}/${path}`, {
      headers,
      signal: AbortSignal.timeout(30_000),
      redirect: "follow",
    });
    if (response.status === 404 && allowAbsent) return undefined;
    if (!response.ok)
      throw new Error(
        `GHCR ${path.startsWith("blobs/") ? "configuration" : "manifest"} read failed: HTTP ${response.status}.`,
      );
    const bytes = await response.text();
    const actualDigest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    const advertisedDigest = response.headers.get("docker-content-digest");
    if (
      (digest && digest !== actualDigest) ||
      (advertisedDigest && advertisedDigest !== actualDigest)
    ) {
      throw new Error(
        "GHCR content digest does not match the expected immutable artifact.",
      );
    }
    return { digest: actualDigest, body: JSON.parse(bytes) as unknown };
  }
  return readObject;
}

export async function verifyImage(
  manifest: Manifest,
  revision: string,
  expectedDigest?: string,
  fetcher: Fetcher = fetch,
): Promise<string | undefined> {
  if (!/^[a-f0-9]{40}$/.test(revision))
    throw new Error("Expected an exact release commit SHA.");
  if (expectedDigest !== undefined) digestSchema.parse(expectedDigest);
  const readObject = await imageReader(fetcher);
  const image = await readObject(
    `manifests/${manifest.version}`,
    expectedDigest,
    true,
  );
  if (!image) return undefined;
  const index = indexSchema.parse(image.body);
  if (index.annotations?.[ownershipLabel] !== serverName)
    throw new Error("Image index lacks the MCP ownership annotation.");
  for (const architecture of ["amd64", "arm64"]) {
    const candidates = index.manifests.filter(
      (entry) =>
        entry.platform.os === "linux" &&
        entry.platform.architecture === architecture,
    );
    if (candidates.length !== 1)
      throw new Error(`Expected exactly one linux/${architecture} image.`);
    const platform = candidates[0];
    if (!platform) throw new Error("Missing image platform.");
    const platformImage = await readObject(
      `manifests/${platform.digest}`,
      platform.digest,
    );
    const configDigest = z
      .object({ config: descriptor })
      .parse(platformImage?.body).config.digest;
    const configObject = await readObject(
      `blobs/${configDigest}`,
      configDigest,
    );
    const config = z
      .object({
        architecture: z.literal(architecture),
        os: z.literal("linux"),
        config: z.object({
          Labels: z.record(z.string(), z.string()),
          Cmd: z.array(z.string()),
          User: z.literal("node"),
        }),
      })
      .parse(configObject?.body).config;
    for (const [key, value] of Object.entries({
      [ownershipLabel]: serverName,
      "org.opencontainers.image.version": manifest.version,
      "org.opencontainers.image.revision": revision,
      "org.opencontainers.image.source": `https://github.com/${repository}`,
    })) {
      if (config.Labels[key] !== value)
        throw new Error(`linux/${architecture} image has conflicting ${key}.`);
    }
    if (!isDeepStrictEqual(config.Cmd, ["node", "dist/index.js"]))
      throw new Error(
        "Image command does not match the stdio installation contract.",
      );
    await verifyAttestations(index, platform.digest, readObject);
  }
  return image.digest;
}

type ReadImageObject = Awaited<ReturnType<typeof imageReader>>;
const record = z.record(z.string(), z.unknown());
const provenanceTypes = [
  "https://slsa.dev/provenance/v0.2",
  "https://slsa.dev/provenance/v1",
];
const spdxType = "https://spdx.dev/Document";

async function verifyAttestations(
  index: z.infer<typeof indexSchema>,
  platformDigest: string,
  readObject: ReadImageObject,
) {
  const attestations = index.manifests.filter(
    (entry) =>
      entry.annotations?.["vnd.docker.reference.type"] ===
        "attestation-manifest" &&
      entry.annotations["vnd.docker.reference.digest"] === platformDigest,
  );
  let provenance = 0;
  let sbom = 0;
  for (const entry of attestations) {
    if (
      entry.platform.os !== "unknown" ||
      entry.platform.architecture !== "unknown"
    )
      throw new Error("Attestation descriptors must not be runnable images.");
    const artifact = await readObject(
      `manifests/${entry.digest}`,
      entry.digest,
    );
    const attestation = z
      .object({
        artifactType: z
          .literal("application/vnd.docker.attestation.manifest.v1+json")
          .optional(),
        subject: descriptor.optional(),
        layers: z.array(
          descriptor.extend({ mediaType: z.string(), annotations }),
        ),
      })
      .parse(artifact?.body);
    if (
      (attestation.subject && attestation.subject.digest !== platformDigest) ||
      (attestation.artifactType && !attestation.subject)
    )
      throw new Error(
        "Attestation manifest subject does not match its image platform.",
      );
    for (const layer of attestation.layers) {
      if (layer.mediaType !== "application/vnd.in-toto+json") continue;
      const blob = await readObject(`blobs/${layer.digest}`, layer.digest);
      const statement = z
        .object({
          _type: z.enum([
            "https://in-toto.io/Statement/v0.1",
            "https://in-toto.io/Statement/v1",
          ]),
          subject: z
            .array(z.object({ digest: z.object({ sha256: z.string() }) }))
            .min(1),
          predicateType: z.string(),
          predicate: record,
        })
        .parse(blob?.body);
      const advertised = layer.annotations?.["in-toto.io/predicate-type"];
      if (advertised && advertised !== statement.predicateType)
        throw new Error("Attestation predicate differs from its descriptor.");
      if (
        !statement.subject.every(
          (subject) => `sha256:${subject.digest.sha256}` === platformDigest,
        )
      )
        throw new Error(
          "Attestation statement subject does not match its image platform.",
        );
      if (provenanceTypes.includes(statement.predicateType)) {
        const v1 = statement.predicateType.endsWith("/v1");
        const definition = v1
          ? record.parse(statement.predicate.buildDefinition)
          : statement.predicate;
        const buildConfig = v1
          ? record.parse(definition.internalParameters).buildConfig
          : definition.buildConfig;
        const buildType = v1
          ? "https://github.com/moby/buildkit/blob/master/docs/attestations/slsa-definitions.md"
          : "https://mobyproject.org/buildkit@v1";
        if (
          definition.buildType !== buildType ||
          !z
            .object({ llbDefinition: z.array(record).min(1) })
            .safeParse(buildConfig).success
        )
          throw new Error(
            "Expected maximum BuildKit provenance with build configuration.",
          );
        provenance++;
      } else if (statement.predicateType === spdxType) {
        z.object({
          SPDXID: z.literal("SPDXRef-DOCUMENT"),
          spdxVersion: z.string().regex(/^SPDX-2\./),
          packages: z.array(record).min(1),
        }).parse(statement.predicate);
        sbom++;
      }
    }
  }
  if (provenance !== 1 || sbom !== 1)
    throw new Error(
      "Each image platform requires one maximum provenance statement and one SPDX SBOM.",
    );
}

function compareVersions(left: string, right: string): number {
  if (!stableVersion.test(left) || !stableVersion.test(right))
    throw new Error("Expected canonical stable image versions.");
  const a = left.split(".").map(BigInt);
  const b = right.split(".").map(BigInt);
  for (let index = 0; index < 3; index++) {
    const x = a[index];
    const y = b[index];
    if (x !== undefined && y !== undefined && x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

async function imageIdentity(body: unknown, readObject: ReadImageObject) {
  const index = indexSchema.parse(body);
  const identities = [];
  for (const architecture of ["amd64", "arm64"]) {
    const platforms = index.manifests.filter(
      (entry) =>
        entry.platform.os === "linux" &&
        entry.platform.architecture === architecture,
    );
    if (platforms.length !== 1 || !platforms[0])
      throw new Error("Invalid alias image platforms.");
    const platform = await readObject(
      `manifests/${platforms[0].digest}`,
      platforms[0].digest,
    );
    const config = z
      .object({ config: descriptor })
      .parse(platform?.body).config;
    const object = await readObject(`blobs/${config.digest}`, config.digest);
    const labels = z
      .object({
        config: z.object({ Labels: z.record(z.string(), z.string()) }),
      })
      .parse(object?.body).config.Labels;
    if (
      labels["org.opencontainers.image.source"] !==
      `https://github.com/${repository}`
    )
      throw new Error("Alias image belongs to an unexpected source.");
    identities.push({
      version: z.string().parse(labels["org.opencontainers.image.version"]),
      revision: z
        .string()
        .regex(/^[a-f0-9]{40}$/)
        .parse(labels["org.opencontainers.image.revision"]),
    });
  }
  if (!identities[0] || !isDeepStrictEqual(identities[0], identities[1]))
    throw new Error(
      "Alias image platforms have conflicting release identities.",
    );
  return identities[0];
}

// Called under repository-wide Release concurrency: alias writes have no CAS
// API, so two release runs must never race their read/compare/write sequence.
export async function repairImageTags(
  manifest: Manifest,
  revision: string,
  digest: string,
  options: {
    // Fresh remote annotated tag names, without refs/tags/ or ^{}.
    releaseTags: string[];
    publishAlias: (tag: string, digest: string) => Promise<void>;
  },
  fetcher: Fetcher = fetch,
): Promise<string[]> {
  if ((await verifyImage(manifest, revision, digest, fetcher)) !== digest)
    throw new Error(
      "Cannot repair aliases without the verified exact release image.",
    );
  if (!options.releaseTags.includes(`v${manifest.version}`))
    throw new Error("The release tag must still exist on the remote.");
  const readObject = await imageReader(fetcher);
  const minor = manifest.version.split(".").slice(0, 2).join(".");
  const newerTags = options.releaseTags
    .filter((tag) => tag.startsWith("v"))
    .map((tag) => tag.slice(1))
    .filter(
      (version) =>
        stableVersion.test(version) &&
        version.startsWith(`${minor}.`) &&
        compareVersions(version, manifest.version) > 0,
    );
  const results: string[] = [];
  for (const alias of [`sha-${revision}`, minor]) {
    const current = await readObject(`manifests/${alias}`, undefined, true);
    if (alias === minor && newerTags.length > 0) {
      results.push(
        `${alias}: unchanged; a newer release tag owns this minor line`,
      );
      continue;
    }
    if (current?.digest === digest) {
      results.push(`${alias}: verified ${digest}`);
      continue;
    }
    if (current) {
      const identity = await imageIdentity(current.body, readObject);
      if (alias === minor) {
        if (!identity.version.startsWith(`${minor}.`))
          throw new Error(
            "Minor alias points outside the expected release line.",
          );
        if (compareVersions(identity.version, manifest.version) > 0) {
          // Also protect against a newer published image whose Git tag was
          // removed or was not visible when the remote refs were enumerated.
          await readObject(`manifests/${identity.version}`, current.digest);
          results.push(`${alias}: preserved newer ${identity.version}`);
          continue;
        }
      } else if (identity.revision !== revision) {
        throw new Error("Commit alias points to a different source revision.");
      }
    }
    await options.publishAlias(alias, digest);
    await readObject(`manifests/${alias}`, digest);
    results.push(`${alias}: repaired and verified ${digest}`);
  }
  // Alias repair must never change the exact version tag.
  await readObject(`manifests/${manifest.version}`, digest);
  return results;
}

export async function publishAndVerify(options: {
  verifyArtifact: () => Promise<void>;
  lookup: () => Promise<"absent" | "identical">;
  validate: () => Promise<void>;
  authenticate: () => Promise<void>;
  publish: () => Promise<void>;
  sleep: (milliseconds: number) => Promise<void>;
}): Promise<"published" | "already published"> {
  await options.verifyArtifact();
  if ((await options.lookup()) === "identical") return "already published";
  await options.validate();
  await options.authenticate();
  let publishError: unknown;
  try {
    await options.publish();
  } catch (error) {
    // A request can succeed remotely even when the CLI loses its connection.
    publishError = error;
  }
  let lookupError: TransientRegistryLookupError | undefined;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      if ((await options.lookup()) === "identical") return "published";
      lookupError = undefined;
    } catch (error) {
      // Retry only transient reads after the single write; preflight errors,
      // conflicts, inactive entries, and malformed responses still fail closed.
      if (!(error instanceof TransientRegistryLookupError)) throw error;
      lookupError = error;
    }
    if (attempt < 5) await options.sleep(5_000);
  }
  if (lookupError)
    throw new Error(
      `Registry publication could not be confirmed: ${lookupError.message} Rerun the failed Registry job.`,
    );
  if (publishError) throw publishError;
  throw new Error(
    "Registry publication was not visible at the exact version URL after verification; rerun the failed job.",
  );
}
