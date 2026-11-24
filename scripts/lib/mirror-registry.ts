import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import {
  imageIdentity,
  imageVerificationInput,
  ownershipLabel,
  repository,
  serverName,
  verifyImageGraph,
} from "./mcp-registry.js";

export type MirrorIdentity = z.infer<typeof imageVerificationInput>;
const indexType = "application/vnd.oci.image.index.v1+json";
const manifestType = "application/vnd.oci.image.manifest.v1+json";
const endpoints = {
  "ghcr.io": ["https://ghcr.io", "https://ghcr.io/token?service=ghcr.io"],
  "docker.io": [
    "https://registry-1.docker.io",
    "https://auth.docker.io/token?service=registry.docker.io",
  ],
} as const;
const descriptor = z.object({
  digest: imageVerificationInput.shape.digest,
  size: z.number().int().nonnegative(),
  mediaType: z.string().min(1),
});
type Descriptor = z.infer<typeof descriptor>;
const indexSchema = z.object({
  schemaVersion: z.literal(2),
  mediaType: z.literal(indexType),
  subject: z.never().optional(),
  annotations: z.object({ [ownershipLabel]: z.literal(serverName) }),
  manifests: z
    .array(
      descriptor.extend({
        mediaType: z.literal(manifestType),
        annotations: z.record(z.string(), z.string()).optional(),
      }),
    )
    .min(1),
});
const manifestSchema = z.object({
  schemaVersion: z.literal(2),
  mediaType: z.literal(manifestType),
  subject: descriptor.optional(),
  config: descriptor,
  layers: z.array(descriptor).min(1),
});
const errorEnvelope = z.object({
  errors: z.array(z.object({ code: z.string() })).min(1),
});
type Sleep = (ms: number) => Promise<void>;

// Only a structured Distribution API absence can authorize copy/repair.
export class MissingContent extends Error {}
export class TransientRead extends Error {
  constructor(
    message: string,
    readonly retryAfterMs = 0,
  ) {
    super(message);
  }
}

// Neither response excerpts from JSON.parse nor arbitrary paths from Zod belong in job logs.
function reportReadError(error: unknown): never {
  if (error instanceof SyntaxError || error instanceof z.ZodError) {
    throw new Error("Malformed registry metadata.");
  }
  throw error;
}

async function retry<T>(operation: () => Promise<T>, sleep: Sleep): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof TransientRead) || attempt === 2)
        reportReadError(error);
      await sleep(Math.max(1_000 * 2 ** attempt, error.retryAfterMs));
    }
  }
}

async function get(fetcher: typeof fetch, url: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetcher(url, {
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
      ...init,
    });
  } catch {
    throw new TransientRead("Anonymous registry read interrupted.");
  }
  if ([408, 429].includes(response.status) || response.status >= 500) {
    await response.body?.cancel();
    const hint = response.headers.get("retry-after") ?? "";
    const wait = /^\d+$/.test(hint)
      ? Number(hint) * 1_000
      : Date.parse(hint) - Date.now();
    if (wait > 30_000)
      throw new Error(
        `Registry returned HTTP ${response.status}. Retry after the requested delay.`,
      );
    throw new TransientRead(
      `Registry returned HTTP ${response.status}.`,
      Number.isFinite(wait) ? wait : 0,
    );
  }
  return response;
}

async function responseJson(response: Response): Promise<unknown> {
  const bytes = await response.text().catch(() => {
    throw new TransientRead("Anonymous registry response interrupted.");
  });
  return JSON.parse(bytes);
}

export async function requirePublicHub(
  fetcher: typeof fetch = fetch,
  sleep: Sleep = delay,
) {
  await retry(async () => {
    const response = await get(
      fetcher,
      "https://hub.docker.com/v2/namespaces/enthouan/repositories/trello-mcp",
    );
    if (response.status !== 200)
      throw new Error(
        `Confirm public Docker Hub repository provisioning (HTTP ${response.status}).`,
      );
    z.object({
      namespace: z.literal("enthouan"),
      name: z.literal("trello-mcp"),
      is_private: z.literal(false),
    }).parse(await responseJson(response));
  }, sleep);
}

export class PublicRegistry {
  private token = "";
  private refreshAt = 0;

  constructor(
    readonly host: keyof typeof endpoints,
    private readonly fetcher: typeof fetch = fetch,
    private readonly sleep: Sleep = delay,
  ) {}

  private async pullToken() {
    if (Date.now() >= this.refreshAt) {
      const response = await get(
        this.fetcher,
        `${endpoints[this.host][1]}&scope=repository:${repository}:pull`,
      );
      if (response.status !== 200)
        throw new Error(
          `Anonymous registry authorization failed (HTTP ${response.status}).`,
        );
      const { token } = z
        .object({ token: z.string().min(1) })
        .parse(await responseJson(response));
      this.token = token;
      this.refreshAt = Date.now() + 45_000;
    }
    return this.token;
  }

  private async read(
    kind: "blobs" | "manifests",
    ref: string,
    json: boolean,
    size?: number,
  ) {
    const isDigest = imageVerificationInput.shape.digest.safeParse(ref).success;
    return retry(async () => {
      const response = await get(
        this.fetcher,
        `${endpoints[this.host][0]}/v2/${repository}/${kind}/${ref}`,
        {
          headers: {
            Authorization: `Bearer ${await this.pullToken()}`,
            Accept:
              kind === "manifests" ? `${indexType}, ${manifestType}` : "*/*",
          },
          // Fetch strips Authorization on cross-origin blob storage redirects.
          redirect: kind === "blobs" ? "follow" : "error",
        },
      );
      if (response.status === 404 && !response.redirected) {
        const { errors } = errorEnvelope.parse(await responseJson(response));
        const code = kind === "blobs" ? "BLOB_UNKNOWN" : "MANIFEST_UNKNOWN";
        if (
          this.host === "docker.io" &&
          kind === "manifests" &&
          !isDigest &&
          errors.every((e) => e.code === "NAME_UNKNOWN")
        ) {
          // A provisioned, empty Hub repository may have no Distribution namespace yet.
          await requirePublicHub(this.fetcher, this.sleep);
        } else if (!errors.every((e) => e.code === code)) {
          throw new Error("Ambiguous registry 404.");
        }
        throw new MissingContent(`${this.host} missing ${kind}/${ref}.`);
      }
      if (response.status !== 200 || !response.body)
        throw new Error(
          `Anonymous ${kind} read failed (HTTP ${response.status}).`,
        );
      const hash = createHash("sha256");
      const chunks: Uint8Array[] = [];
      let length = 0;
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read().catch(() => {
            throw new TransientRead("Registry content stream interrupted.");
          });
          if (done) break;
          length += value.byteLength;
          if (json && length > 128 * 1024 * 1024) {
            await reader.cancel();
            throw new Error(
              "Registry JSON object exceeds the metadata read limit.",
            );
          }
          if (size !== undefined && length > size) {
            await reader.cancel();
            throw new Error("Registry descriptor size mismatch.");
          }
          hash.update(value);
          if (json) chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const digest = `sha256:${hash.digest("hex")}`;
      const header = response.headers.get("docker-content-digest");
      if (
        (isDigest && ref !== digest) ||
        (header !== null && header !== digest)
      )
        throw new Error("Registry content digest mismatch.");
      if (size !== undefined && size !== length)
        throw new Error("Registry descriptor size mismatch.");
      return {
        digest,
        body: json
          ? (JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown)
          : undefined,
      };
    }, this.sleep);
  }

  private async index(ref: string) {
    const index = await this.read("manifests", ref, true);
    const parsed = indexSchema.safeParse(index.body);
    if (!parsed.success) throw new Error("Invalid release index.");
    const descriptors = parsed.data.manifests;
    if (
      new Set(descriptors.map((entry) => entry.digest)).size !==
      descriptors.length
    ) {
      throw new Error("Duplicate release index descriptor.");
    }
    return { ...index, descriptors };
  }

  // A matching tag may point to an incomplete graph. Look up only its index here.
  async tagDigest(ref: string): Promise<string | null> {
    if (ref !== "latest") imageVerificationInput.shape.version.parse(ref);
    try {
      return (await this.index(ref)).digest;
    } catch (error) {
      if (error instanceof MissingContent) return null;
      throw error;
    }
  }

  // The shared semantic verifier follows manifests, runtime configs and statements.
  // Resolve those references by descriptor; also stream everything else in complete mode.
  private graphReader(
    entries: z.infer<typeof indexSchema>["manifests"],
    complete: boolean,
  ) {
    const blobs = new Map<string, Descriptor>();
    return async (path: string, digest?: string) => {
      if (path === `blobs/${digest}` && digest) {
        const desc = blobs.get(digest);
        if (!desc) throw new Error("Unreferenced image blob.");
        const blob = await this.read("blobs", digest, true, desc.size);
        // Alias identity reads only runtime configs; also require the Trello owner.
        if (!complete)
          z.object({
            config: z.object({
              Labels: z.object({ [ownershipLabel]: z.literal(serverName) }),
            }),
          }).parse(blob.body);
        return blob;
      }
      const entry = entries.find((e) => e.digest === digest);
      if (!entry || path !== `manifests/${entry.digest}`)
        throw new Error("Unreferenced image manifest.");
      const manifest = await this.read(
        "manifests",
        entry.digest,
        true,
        entry.size,
      );
      const { config, layers, subject } = manifestSchema.parse(manifest.body);
      const attestation =
        entry.annotations?.["vnd.docker.reference.type"] ===
        "attestation-manifest";
      if (
        subject &&
        (!attestation ||
          !entries.some(
            (e) =>
              e.digest === subject.digest &&
              e.size === subject.size &&
              e.mediaType === subject.mediaType,
          ))
      ) {
        throw new Error("Conflicting OCI manifest subject descriptor.");
      }
      for (const desc of [config, ...layers]) {
        const other = blobs.get(desc.digest);
        if (other && other.size !== desc.size)
          throw new Error("Conflicting descriptor sizes.");
        blobs.set(desc.digest, desc);
      }
      if (complete) {
        if (attestation)
          await this.read("blobs", config.digest, true, config.size);
        for (const layer of layers) {
          if (
            !attestation ||
            layer.mediaType !== "application/vnd.in-toto+json"
          ) {
            await this.read("blobs", layer.digest, false, layer.size);
          }
        }
      }
      return manifest;
    };
  }

  async identity(digest: string): Promise<MirrorIdentity> {
    imageVerificationInput.shape.digest.parse(digest);
    const index = await this.index(digest);
    const labels = await imageIdentity(
      index.body,
      this.graphReader(index.descriptors, false),
    ).catch(reportReadError);
    return imageVerificationInput.parse({ digest, ...labels });
  }

  async verify(expected: MirrorIdentity) {
    const { digest, version, revision } =
      imageVerificationInput.parse(expected);
    const index = await this.index(digest);
    return verifyImageGraph(
      version,
      revision,
      index,
      this.graphReader(index.descriptors, true),
    ).catch(reportReadError);
  }
}
