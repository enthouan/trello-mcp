import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  ownershipLabel,
  repository,
  serverName,
} from "../scripts/lib/mcp-registry.js";
import {
  MissingContent,
  PublicRegistry,
  requirePublicHub,
  TransientRead,
} from "../scripts/lib/mirror-registry.js";

const version = "1.0.5";
const revision = "a".repeat(40);
const indexType = "application/vnd.oci.image.index.v1+json";
const manifestType = "application/vnd.oci.image.manifest.v1+json";
const configType = "application/vnd.oci.image.config.v1+json";
const hash = (bytes: Uint8Array) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

interface Options {
  legacy?: boolean;
  emptyInventory?: boolean;
  minMode?: boolean;
  wrongSubject?: boolean;
  wrongManifestSubject?: boolean;
  sizeOffset?: number;
  wrongOwner?: boolean;
  badEntrypoint?: boolean;
  mismatchedPlatform?: boolean;
}

// Preserve whitespace in metadata and non-UTF8 bytes in filesystem layers.
function graph(
  options: Options = {},
  host: "ghcr.io" | "docker.io" = "docker.io",
) {
  const objects = new Map<string, Buffer<ArrayBuffer>>();
  const put = (kind: string, mediaType: string, body: unknown) => {
    const bytes =
      body instanceof Uint8Array
        ? Buffer.from(body)
        : Buffer.from(`${JSON.stringify(body, null, 2)}\n`);
    const digest = hash(bytes);
    objects.set(`${kind}/${digest}`, bytes);
    return { digest, mediaType, size: bytes.length };
  };
  const manifests = [];
  const platforms = [];
  for (const architecture of ["amd64", "arm64"]) {
    const platform = { os: "linux", architecture };
    const labels = {
      [ownershipLabel]: options.wrongOwner ? "other" : serverName,
      "org.opencontainers.image.source": `https://github.com/${repository}`,
      "org.opencontainers.image.version": version,
      "org.opencontainers.image.revision":
        options.mismatchedPlatform && architecture === "arm64"
          ? "b".repeat(40)
          : revision,
    };
    const config = put("blobs", configType, {
      ...platform,
      config: {
        Labels: labels,
        User: "node",
        Entrypoint: options.badEntrypoint
          ? ["/bin/sh"]
          : ["docker-entrypoint.sh"],
        WorkingDir: "/app",
        Cmd: ["node", "dist/index.js"],
      },
    });
    const layer = put(
      "blobs",
      "application/vnd.oci.image.layer.v1.tar+gzip",
      Buffer.from([255, 0, 254, architecture.length]),
    );
    const runtime = put("manifests", manifestType, {
      schemaVersion: 2,
      mediaType: manifestType,
      config,
      layers: [{ ...layer, size: layer.size + (options.sizeOffset ?? 0) }],
    });
    manifests.push({ ...runtime, platform });
    platforms.push({
      platform: `linux/${architecture}`,
      digest: runtime.digest,
    });
    const statement = (predicateType: string, predicate: unknown) => ({
      ...put("blobs", "application/vnd.in-toto+json", {
        _type: "https://in-toto.io/Statement/v0.1",
        subject: [
          {
            name: "platform",
            digest: {
              sha256: options.wrongSubject
                ? "b".repeat(64)
                : runtime.digest.slice(7),
            },
          },
        ],
        predicateType,
        predicate,
      }),
      annotations: { "in-toto.io/predicate-type": predicateType },
    });
    const buildConfig = {
      llbDefinition: options.minMode ? [] : [{ id: "step1" }],
    };
    const sbom = statement("https://spdx.dev/Document", {
      SPDXID: "SPDXRef-DOCUMENT",
      spdxVersion: "SPDX-2.3",
      packages: options.emptyInventory ? [] : [{ name: "node" }],
    });
    const provenance = options.legacy
      ? statement("https://slsa.dev/provenance/v0.2", {
          buildType: "https://mobyproject.org/buildkit@v1",
          buildConfig,
        })
      : statement("https://slsa.dev/provenance/v1", {
          buildDefinition: {
            buildType:
              "https://github.com/moby/buildkit/blob/master/docs/attestations/slsa-definitions.md",
            internalParameters: { buildConfig },
          },
        });
    const attest = put("manifests", manifestType, {
      schemaVersion: 2,
      mediaType: manifestType,
      config: put(
        "blobs",
        options.legacy ? configType : "application/vnd.oci.empty.v1+json",
        {},
      ),
      layers: [
        sbom,
        provenance,
        statement("https://example.invalid/extra-attestation", {
          build: "test",
        }),
        put("blobs", "application/octet-stream", Buffer.from([0, 248])),
      ],
      ...(!options.legacy && {
        subject: options.wrongManifestSubject ? manifests[0] : runtime,
        artifactType: "application/vnd.docker.attestation.manifest.v1+json",
      }),
    });
    manifests.push({
      ...attest,
      platform: { os: "unknown", architecture: "unknown" },
      annotations: {
        "vnd.docker.reference.type": "attestation-manifest",
        "vnd.docker.reference.digest": runtime.digest,
      },
    });
  }
  const { digest } = put("manifests", indexType, {
    mediaType: indexType,
    schemaVersion: 2,
    annotations: { [ownershipLabel]: serverName },
    manifests,
  });
  const bytes = objects.get(`manifests/${digest}`);
  if (!bytes) throw new Error("Missing fixture index.");
  objects.set(`manifests/${version}`, bytes);
  const request = vi.fn<typeof fetch>(async (url, init) => {
    const target = new URL(String(url));
    if (target.pathname === "/token") {
      expect(target.hostname).toBe(
        host === "ghcr.io" ? host : "auth.docker.io",
      );
      expect(target.searchParams.get("scope")).toBe(
        `repository:${repository}:pull`,
      );
      expect(init?.headers).toBeUndefined();
      return Response.json({ token: "anonymous-pull" });
    }
    expect(target.hostname).toBe(
      host === "ghcr.io" ? host : "registry-1.docker.io",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer anonymous-pull",
    );
    const key = target.pathname.slice(`/v2/${repository}/`.length);
    const data = objects.get(key);
    return data
      ? new Response(data, { headers: { "docker-content-digest": hash(data) } })
      : Response.json(
          {
            errors: [
              {
                code: key.startsWith("blobs/")
                  ? "BLOB_UNKNOWN"
                  : "MANIFEST_UNKNOWN",
              },
            ],
          },
          { status: 404 },
        );
  });
  return {
    objects,
    request,
    registry: new PublicRegistry(host, request),
    expected: { version, revision, digest },
    platforms,
  };
}

describe("anonymous mirror content verification", () => {
  it.each(["ghcr.io", "docker.io"] as const)(
    "reads the entire original graph by raw digest and size on %s",
    async (host) => {
      for (const legacy of [true, false]) {
        const { registry, request, objects, expected, platforms } = graph(
          { legacy },
          host,
        );
        expect(await registry.tagDigest(version)).toBe(expected.digest);
        expect(await registry.identity(expected.digest)).toEqual(expected);
        expect(
          (await registry.verify(expected)).platforms.map(
            ({ platform, digest }) => ({ platform, digest }),
          ),
        ).toEqual(platforms);
        const reads = request.mock.calls
          .map(([url]) => String(url).split(`/v2/${repository}/`)[1])
          .filter(Boolean);
        expect(new Set(reads)).toEqual(new Set(objects.keys()));
        expect(await registry.tagDigest("latest")).toBeNull();
      }
    },
  );

  it("distinguishes a matching index with a missing descendant from an absent tag", async () => {
    for (const key of graph().objects.keys()) {
      if (!key.includes("sha256:")) continue;
      const { objects, registry, expected } = graph();
      objects.delete(key);
      expect(await registry.tagDigest(version)).toBe(expected.digest);
      await expect(registry.verify(expected)).rejects.toBeInstanceOf(
        MissingContent,
      );
    }
  });

  it("rejects corrupted filesystem bytes even with a matching size and self-consistent response header", async () => {
    const { registry, expected, objects } = graph();
    const layer = [...objects.values()].find((value) => value[0] === 255);
    if (!layer) throw new Error("Missing sample layer");
    layer[0] = 254;
    await expect(registry.verify(expected)).rejects.toThrow("digest mismatch");
  });

  it.each<Options>([
    { sizeOffset: 1 },
    { sizeOffset: -1 },
    { emptyInventory: true },
    { minMode: true },
    { wrongSubject: true },
    { wrongManifestSubject: true },
    { wrongOwner: true },
    { badEntrypoint: true },
    { mismatchedPlatform: true },
  ])("rejects invalid release content %o", async (options) => {
    const { registry, expected } = graph(options);
    await expect(registry.verify(expected)).rejects.toThrow();
  });

  it.each([401, 403, 404, 200])(
    "rejects ambiguous or malformed responses (HTTP %i)",
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ token: "anonymous" }))
        .mockResolvedValueOnce(new Response("malformed", { status }));
      await expect(
        new PublicRegistry("docker.io", request).tagDigest(version),
      ).rejects.toThrow();
      expect(request).toHaveBeenCalledTimes(2);
    },
  );

  it("sanitizes malformed anonymous authorization responses", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("sensitive-token-endpoint-response"));
    await expect(
      new PublicRegistry("docker.io", request).tagDigest(version),
    ).rejects.toThrow(/^Malformed registry metadata\.$/);
  });

  it("requires independent anonymous Hub confirmation for an empty Distribution namespace", async () => {
    for (const visible of [true, false]) {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ token: "anonymous" }))
        .mockResolvedValueOnce(
          Response.json(
            { errors: [{ code: "NAME_UNKNOWN" }] },
            { status: 404 },
          ),
        )
        .mockResolvedValueOnce(
          Response.json({
            namespace: "enthouan",
            name: "trello-mcp",
            is_private: !visible,
          }),
        );
      const read = new PublicRegistry("docker.io", request).tagDigest(version);
      if (visible) await expect(read).resolves.toBeNull();
      else await expect(read).rejects.toThrow();
      expect(request.mock.calls.at(-1)?.[0]).toBe(
        "https://hub.docker.com/v2/namespaces/enthouan/repositories/trello-mcp",
      );
    }
    await expect(
      requirePublicHub(async () => new Response(null, { status: 404 })),
    ).rejects.toThrow("provisioning");
  });

  it.each([429, 503, "network"])(
    "bounds retries of %s without authorizing writes",
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ token: "anonymous" }));
      if (typeof status === "number")
        request.mockImplementation(
          async () =>
            new Response(null, { status, headers: { "retry-after": "3" } }),
        );
      else request.mockRejectedValue(new Error("network interrupted"));
      const sleep = vi.fn(async (_ms: number) => {});
      await expect(
        new PublicRegistry("docker.io", request, sleep).tagDigest(version),
      ).rejects.toThrow(TransientRead);
      expect(sleep.mock.calls.flat()).toEqual(
        status === "network" ? [1000, 2000] : [3000, 3000],
      );
      expect(request).toHaveBeenCalledTimes(4);
    },
  );

  it("defers long Retry-After responses to a later attempt", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { "retry-after": "120" } }),
      );
    const sleep = vi.fn(async (_ms: number) => {});
    await expect(
      new PublicRegistry("docker.io", request, sleep).tagDigest(version),
    ).rejects.toThrow("requested delay");
    expect(sleep).not.toHaveBeenCalled();
  });
});
