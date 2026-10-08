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

export async function registryEntry(
  manifest: Manifest,
  fetcher: Fetcher = fetch,
): Promise<"absent" | "identical"> {
  const response = await request(fetcher, versionUrl(manifest));
  if (response.status === 404) return "absent";
  if (response.status !== 200)
    throw new Error(`Registry lookup failed: HTTP ${response.status}.`);
  const body = z
    .object({
      server: z.unknown(),
      _meta: z.object({
        "io.modelcontextprotocol.registry/official": z.object({
          status: z.literal("active"),
        }),
      }),
    })
    .parse(await response.json());
  // Compare every publisher field; ignore only the separate Registry-managed envelope.
  if (!isDeepStrictEqual(body.server, manifest)) {
    throw new Error(
      `Conflicting Registry metadata for ${manifest.name} ${manifest.version}; do not overwrite it.`,
    );
  }
  return "identical";
}

const descriptor = z.object({ digest: digestSchema });
const indexSchema = z.object({
  annotations: z.record(z.string(), z.string()).optional(),
  manifests: z.array(
    descriptor.extend({
      platform: z.object({ os: z.string(), architecture: z.string() }),
    }),
  ),
});

// Anonymous GHCR reads prove that the Registry and unauthenticated clients can
// access the image. Authenticated docker inspection alone cannot establish that.
export async function verifyImage(
  manifest: Manifest,
  revision: string,
  expectedDigest?: string,
  fetcher: Fetcher = fetch,
): Promise<string | undefined> {
  if (!/^[a-f0-9]{40}$/.test(revision))
    throw new Error("Expected an exact release commit SHA.");
  if (expectedDigest !== undefined) digestSchema.parse(expectedDigest);
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
  }
  return image.digest;
}

export async function publishAndVerify(options: {
  verifyArtifact: () => Promise<void>;
  lookup: () => Promise<"absent" | "identical">;
  publish: () => Promise<void>;
  sleep: (milliseconds: number) => Promise<void>;
}): Promise<"published" | "already published"> {
  await options.verifyArtifact();
  if ((await options.lookup()) === "identical") return "already published";
  let publishError: unknown;
  try {
    await options.publish();
  } catch (error) {
    // A request can succeed remotely even when the CLI loses its connection.
    publishError = error;
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    if ((await options.lookup()) === "identical") return "published";
    if (attempt < 5) await options.sleep(5_000);
  }
  if (publishError) throw publishError;
  throw new Error(
    "Registry publication was not visible at the exact version URL after verification; rerun the failed job.",
  );
}
