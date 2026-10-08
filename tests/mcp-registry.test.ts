import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import {
  imageName,
  ownershipLabel,
  publishAndVerify,
  registryEntry,
  repairImageTags,
  repository,
  serverName,
  stableRelease,
  TransientRegistryLookupError,
  validateManifest,
  verifyImage,
  versionUrl,
} from "../scripts/lib/mcp-registry.js";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");
const rawManifest = JSON.parse(await read("server.json"));
const packageVersion = JSON.parse(await read("package.json")).version;
const schema = JSON.parse(
  await read("scripts/schemas/mcp-server-2025-12-11.schema.json"),
);
const manifest = validateManifest(rawManifest, packageVersion, schema);
const revision = "a".repeat(40);
const event = {
  eventName: "push",
  ref: `refs/tags/v${manifest.version}`,
  repository,
};
const apiPayload = (server: unknown = manifest, status = "active") => ({
  server,
  _meta: {
    "io.modelcontextprotocol.registry/official": {
      status,
      publishedAt: "2026-10-08T00:00:00Z",
    },
  },
});
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("official Registry release contract", () => {
  it("validates the manifest against the official schema and exact release version", () => {
    expect(
      validateManifest(rawManifest, packageVersion, schema, packageVersion),
    ).toEqual(rawManifest);
    expect(versionUrl(manifest)).toContain(
      "io.github.enthouan%2Ftrello-mcp/versions/",
    );
  });

  it.each([
    { eventName: "pull_request" },
    { eventName: "workflow_dispatch" },
    { eventName: "release" },
    { ref: "refs/heads/main" },
    { ref: "refs/tags/v1.2.3-rc.1" },
    { ref: "refs/tags/v1.2.3+build" },
    { ref: "refs/tags/v01.2.3" },
    { ref: "refs/tags/v1.2" },
    { repository: "someone/trello-mcp" },
  ])("does not publish for %j", (override) => {
    expect(stableRelease({ ...event, ...override })).toBeUndefined();
  });

  it("permits only a canonical stable tag push", () => {
    expect(stableRelease(event)).toBe(manifest.version);
  });

  it("rejects tag, package, and image version drift", () => {
    expect(() =>
      validateManifest(rawManifest, packageVersion, schema, "9.9.9"),
    ).toThrow("must agree");
    expect(() => validateManifest(rawManifest, "9.9.9", schema)).toThrow(
      "must agree",
    );
    const wrongImage = structuredClone(rawManifest);
    wrongImage.packages[0].identifier = `${imageName}:latest`;
    expect(() => validateManifest(wrongImage, packageVersion, schema)).toThrow(
      "must agree",
    );
  });

  it("rejects real credential values, HTTP transport, unexpected configuration, and invalid schema fields", () => {
    for (const mutate of [
      (value: typeof rawManifest) => {
        value.packages[0].environmentVariables[1].value = "credential-sentinel";
      },
      (value: typeof rawManifest) => {
        value.packages[0].environmentVariables[2].isSecret = false;
      },
      (value: typeof rawManifest) => {
        value.packages[0].transport.type = "streamable-http";
      },
      (value: typeof rawManifest) => {
        value.packages[0].environmentVariables.push({
          name: "PORT",
          value: "3000",
        });
      },
      (value: typeof rawManifest) => {
        value.websiteUrl = "not a URL";
      },
      (value: typeof rawManifest) => {
        value.description = "x".repeat(101);
      },
    ]) {
      const value = structuredClone(rawManifest);
      mutate(value);
      expect(() => validateManifest(value, packageVersion, schema)).toThrow();
    }
  });
});

describe("anonymous exact Registry lookup", () => {
  it("treats only HTTP 404 as absent", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply({}, 404));
    await expect(registryEntry(manifest, fetcher)).resolves.toBe("absent");
    expect(fetcher).toHaveBeenCalledWith(
      `${versionUrl(manifest)}?include_deleted=true`,
      expect.objectContaining({ redirect: "error" }),
    );
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty("headers");
  });

  it.each([401, 403, 408, 429, 500, 503])(
    "fails on HTTP %i instead of attempting publication",
    async (status) => {
      await expect(
        registryEntry(
          manifest,
          vi.fn<typeof fetch>().mockResolvedValue(reply({}, status)),
        ),
      ).rejects.toThrow(`HTTP ${status}`);
    },
  );

  it("matches all publisher metadata independently of JSON object key order", async () => {
    const reordered = Object.fromEntries(Object.entries(manifest).reverse());
    await expect(
      registryEntry(
        manifest,
        vi.fn<typeof fetch>().mockResolvedValue(reply(apiPayload(reordered))),
      ),
    ).resolves.toBe("identical");
  });

  it.each([
    { ...manifest, description: "Changed metadata" },
    { ...manifest, unexpected: "field" },
    { ...manifest, packages: [] },
  ])("fails closed on conflicting publisher metadata", async (other) => {
    await expect(
      registryEntry(
        manifest,
        vi.fn<typeof fetch>().mockResolvedValue(reply(apiPayload(other))),
      ),
    ).rejects.toThrow("Conflicting Registry metadata");
  });

  it("rejects malformed responses, non-active entries, and network errors", async () => {
    for (const body of [
      {},
      apiPayload(manifest, "deleted"),
      apiPayload(manifest, "deprecated"),
    ]) {
      await expect(
        registryEntry(
          manifest,
          vi.fn<typeof fetch>().mockResolvedValue(reply(body)),
        ),
      ).rejects.toThrow();
    }
    await expect(
      registryEntry(
        manifest,
        vi
          .fn<typeof fetch>()
          .mockRejectedValue(new Error("network unavailable")),
      ),
    ).rejects.toThrow(TransientRegistryLookupError);
  });

  it("distinguishes transient HTTP/body failures from invalid JSON", async () => {
    for (const status of [408, 429, 500, 503]) {
      await expect(
        registryEntry(manifest, async () => reply({}, status)),
      ).rejects.toThrow(TransientRegistryLookupError);
    }
    const interrupted = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error("connection lost"));
        },
      }),
    );
    await expect(
      registryEntry(manifest, async () => interrupted),
    ).rejects.toThrow(TransientRegistryLookupError);
    await expect(
      registryEntry(manifest, async () => new Response("invalid JSON")),
    ).rejects.toThrow(SyntaxError);
  });
});

function imageFixture(
  options: {
    badLabel?: boolean;
    missingPlatform?: boolean;
    badIndex?: boolean;
    badVersion?: boolean;
    badRevision?: boolean;
    version?: string;
    revision?: string;
    missingAttestation?: boolean;
    missingSbom?: boolean;
    minimumProvenance?: boolean;
    emptyBuildConfig?: boolean;
    wrongBuildType?: boolean;
    wrongSubject?: boolean;
    wrongReference?: boolean;
    wrongManifestSubject?: boolean;
    badSbom?: boolean;
    corruptLayer?: boolean;
    legacyAttestation?: boolean;
    provenanceV1?: boolean;
  } = {},
) {
  const objects = new Map<string, string>();
  const store = (kind: string, value: unknown) => {
    const body = JSON.stringify(value);
    const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
    objects.set(`${kind}/${digest}`, body);
    return digest;
  };
  const platforms = (
    options.missingPlatform ? ["amd64"] : ["amd64", "arm64"]
  ).map((architecture) => {
    const config = store("blobs", {
      architecture,
      os: "linux",
      config: {
        User: "node",
        Cmd: ["node", "dist/index.js"],
        Labels: {
          ...(options.badLabel ? {} : { [ownershipLabel]: serverName }),
          "org.opencontainers.image.version": options.badVersion
            ? "0.0.0"
            : (options.version ?? manifest.version),
          "org.opencontainers.image.revision": options.badRevision
            ? "b".repeat(40)
            : (options.revision ?? revision),
          "org.opencontainers.image.source": `https://github.com/${repository}`,
        },
      },
    });
    return {
      digest: store("manifests", { config: { digest: config } }),
      platform: { os: "linux", architecture },
    };
  });
  const attestations = platforms.flatMap((platform, index) => {
    if (options.missingAttestation && index === 1) return [];
    const statement = (
      predicateType: string,
      predicate: Record<string, unknown>,
    ) => {
      const digest = store("blobs", {
        _type: "https://in-toto.io/Statement/v1",
        subject: [
          {
            name: "_",
            digest: {
              sha256: options.wrongSubject
                ? "e".repeat(64)
                : platform.digest.slice(7),
            },
          },
        ],
        predicateType,
        predicate,
      });
      if (options.corruptLayer) objects.set(`blobs/${digest}`, "{}");
      return {
        digest,
        mediaType: "application/vnd.in-toto+json",
        annotations: { "in-toto.io/predicate-type": predicateType },
      };
    };
    const build = {
      buildType: "https://mobyproject.org/buildkit@v1",
      ...(options.minimumProvenance
        ? {}
        : {
            buildConfig: {
              llbDefinition: options.emptyBuildConfig
                ? []
                : [{ id: "step0", op: {} }],
            },
          }),
    };
    const provenance = options.provenanceV1
      ? {
          buildDefinition: {
            buildType: options.wrongBuildType
              ? build.buildType
              : "https://github.com/moby/buildkit/blob/master/docs/attestations/slsa-definitions.md",
            internalParameters: { buildConfig: build.buildConfig },
          },
        }
      : build;
    const layers = [
      statement(
        `https://slsa.dev/provenance/${options.provenanceV1 ? "v1" : "v0.2"}`,
        provenance,
      ),
    ];
    if (!options.missingSbom)
      layers.push(
        statement("https://spdx.dev/Document", {
          SPDXID: options.badSbom ? "invalid" : "SPDXRef-DOCUMENT",
          spdxVersion: "SPDX-2.3",
          packages: [{ name: "node" }],
        }),
      );
    return [
      {
        digest: store("manifests", {
          layers,
          ...(options.legacyAttestation
            ? {}
            : {
                artifactType:
                  "application/vnd.docker.attestation.manifest.v1+json",
                subject: {
                  digest: options.wrongManifestSubject
                    ? `sha256:${"f".repeat(64)}`
                    : platform.digest,
                },
              }),
        }),
        platform: { os: "unknown", architecture: "unknown" },
        annotations: {
          "vnd.docker.reference.type": "attestation-manifest",
          "vnd.docker.reference.digest": options.wrongReference
            ? `sha256:${"e".repeat(64)}`
            : platform.digest,
        },
      },
    ];
  });
  const digest = store("manifests", {
    annotations: options.badIndex ? {} : { [ownershipLabel]: serverName },
    manifests: [...platforms, ...attestations],
  });
  objects.set(
    `manifests/${options.version ?? manifest.version}`,
    objects.get(`manifests/${digest}`) ?? "",
  );
  const fetcher = vi.fn<typeof fetch>(async (url) => {
    const value = String(url);
    if (value.startsWith("https://ghcr.io/token?"))
      return reply({ token: "anonymous-pull-token" });
    const path = value.replace(`https://ghcr.io/v2/${repository}/`, "");
    const body = objects.get(path);
    return body ? new Response(body) : reply({}, 404);
  });
  return { fetcher, digest, objects };
}

describe("public immutable image verification", () => {
  it("verifies both image architectures, ownership, revision, and digest", async () => {
    const fixture = imageFixture();
    await expect(
      verifyImage(manifest, revision, fixture.digest, fixture.fetcher),
    ).resolves.toBe(fixture.digest);
    expect(
      fixture.fetcher.mock.calls.filter(([url]) =>
        String(url).includes("/blobs/"),
      ),
    ).toHaveLength(6);
  });

  it("returns absence only for a missing top-level version manifest", async () => {
    const fixture = imageFixture();
    fixture.objects.delete(`manifests/${manifest.version}`);
    await expect(
      verifyImage(manifest, revision, undefined, fixture.fetcher),
    ).resolves.toBeUndefined();
  });

  it.each([
    { badLabel: true },
    { badIndex: true },
    { missingPlatform: true },
    { badRevision: true },
    { badVersion: true },
    { missingAttestation: true },
    { missingSbom: true },
    { minimumProvenance: true },
    { minimumProvenance: true, provenanceV1: true },
    { emptyBuildConfig: true },
    { wrongBuildType: true, provenanceV1: true },
    { wrongSubject: true },
    { wrongReference: true },
    { wrongManifestSubject: true },
    { badSbom: true },
    { corruptLayer: true },
  ])("rejects an existing invalid image: %j", async (options) => {
    const fixture = imageFixture(options);
    await expect(
      verifyImage(manifest, revision, undefined, fixture.fetcher),
    ).rejects.toThrow();
  });

  it.each([{ legacyAttestation: true }, { provenanceV1: true }])(
    "accepts valid BuildKit attestation formats: %j",
    async (options) => {
      const fixture = imageFixture(options);
      await expect(
        verifyImage(manifest, revision, fixture.digest, fixture.fetcher),
      ).resolves.toBe(fixture.digest);
    },
  );

  it("rejects a changed image digest and damaged referenced blobs", async () => {
    const fixture = imageFixture();
    await expect(
      verifyImage(
        manifest,
        revision,
        `sha256:${"0".repeat(64)}`,
        fixture.fetcher,
      ),
    ).rejects.toThrow("digest");
    const blob = [...fixture.objects.keys()].find((key) =>
      key.startsWith("blobs/"),
    );
    if (!blob) throw new Error("Missing fixture blob");
    fixture.objects.set(blob, "{}");
    await expect(
      verifyImage(manifest, revision, undefined, fixture.fetcher),
    ).rejects.toThrow("digest");
  });

  it("does not interpret token or registry failures as an absent image", async () => {
    await expect(
      verifyImage(
        manifest,
        revision,
        undefined,
        vi.fn<typeof fetch>().mockResolvedValue(reply({}, 403)),
      ),
    ).rejects.toThrow("HTTP 403");
    const fixture = imageFixture();
    fixture.fetcher
      .mockImplementationOnce(async () => reply({ token: "anonymous" }))
      .mockImplementationOnce(async () => reply({}, 500));
    await expect(
      verifyImage(manifest, revision, undefined, fixture.fetcher),
    ).rejects.toThrow("HTTP 500");
  });
});

describe("release image alias recovery", () => {
  const setup = () => {
    const fixture = imageFixture();
    const publishAlias = vi.fn(async (tag: string, digest: string) => {
      const body = fixture.objects.get(`manifests/${digest}`);
      if (!body) throw new Error("Unknown source digest");
      fixture.objects.set(`manifests/${tag}`, body);
    });
    const options = { releaseTags: [`v${manifest.version}`], publishAlias };
    const repair = () =>
      repairImageTags(
        manifest,
        revision,
        fixture.digest,
        options,
        fixture.fetcher,
      );
    const addAlias = (tag: string, other: ReturnType<typeof imageFixture>) => {
      for (const [key, value] of other.objects) {
        if (key !== `manifests/${manifest.version}`)
          fixture.objects.set(key, value);
      }
      fixture.objects.set(
        `manifests/${tag}`,
        other.objects.get(`manifests/${other.digest}`) ?? "",
      );
    };
    return { fixture, publishAlias, options, repair, addAlias };
  };

  it("repairs missing aliases from the existing index and is a verified no-op on rerun", async () => {
    const context = setup();
    const exact = context.fixture.objects.get(`manifests/${manifest.version}`);
    await context.repair();
    expect(context.publishAlias.mock.calls).toEqual([
      [`sha-${revision}`, context.fixture.digest],
      ["1.0", context.fixture.digest],
    ]);
    expect(context.fixture.objects.get(`manifests/${manifest.version}`)).toBe(
      exact,
    );
    context.publishAlias.mockClear();
    await context.repair();
    expect(context.publishAlias).not.toHaveBeenCalled();
  });

  it("recovers after only one alias was written", async () => {
    const context = setup();
    context.publishAlias
      .mockImplementationOnce(async (tag, digest) => {
        context.fixture.objects.set(
          `manifests/${tag}`,
          context.fixture.objects.get(`manifests/${digest}`) ?? "",
        );
      })
      .mockRejectedValueOnce(new Error("registry unavailable"));
    await expect(context.repair()).rejects.toThrow("registry unavailable");
    expect(context.fixture.objects.has(`manifests/sha-${revision}`)).toBe(true);
    expect(context.fixture.objects.has("manifests/1.0")).toBe(false);
    context.publishAlias.mockClear();
    await context.repair();
    expect(context.publishAlias).toHaveBeenCalledExactlyOnceWith(
      "1.0",
      context.fixture.digest,
    );
  });

  it("repairs a stale minor and a same-commit main-build alias", async () => {
    const context = setup();
    context.addAlias(
      "1.0",
      imageFixture({ version: "1.0.2", revision: "b".repeat(40) }),
    );
    context.addAlias(`sha-${revision}`, imageFixture({ version: "latest" }));
    await context.repair();
    expect(context.publishAlias).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    "preserves the minor line for a newer remote release (alias present: %s)",
    async (present) => {
      const context = setup();
      context.options.releaseTags.push("v1.0.10");
      if (present)
        context.addAlias(
          "1.0",
          imageFixture({ version: "1.0.10", revision: "b".repeat(40) }),
        );
      const before = context.fixture.objects.get("manifests/1.0");
      await context.repair();
      expect(context.fixture.objects.get("manifests/1.0")).toBe(before);
      expect(context.publishAlias).toHaveBeenCalledExactlyOnceWith(
        `sha-${revision}`,
        context.fixture.digest,
      );
    },
  );

  it("also preserves a newer published minor if its remote Git tag is missing", async () => {
    const context = setup();
    context.addAlias(
      "1.0",
      imageFixture({ version: "1.0.10", revision: "b".repeat(40) }),
    );
    const results = await context.repair();
    expect(results).toContain("1.0: preserved newer 1.0.10");
    expect(context.publishAlias).toHaveBeenCalledTimes(1);
  });

  it("ignores prereleases, non-release tags, and other minor lines for minor ownership", async () => {
    const context = setup();
    context.options.releaseTags.push(
      "v1.0.10-rc.1",
      "1.0.10",
      "v1.1.0",
      "v2.0.0",
    );
    await context.repair();
    expect(context.publishAlias).toHaveBeenCalledTimes(2);
  });

  it("fails before alias writes when the exact artifact or remote tag is missing", async () => {
    const context = setup();
    context.options.releaseTags = [];
    await expect(context.repair()).rejects.toThrow("still exist");
    context.fixture.objects.delete(`manifests/${manifest.version}`);
    await expect(context.repair()).rejects.toThrow("verified exact");
    expect(context.publishAlias).not.toHaveBeenCalled();
  });

  it("rejects a commit alias from another revision and an unconfirmed write", async () => {
    const context = setup();
    context.addAlias(
      `sha-${revision}`,
      imageFixture({ version: "latest", revision: "b".repeat(40) }),
    );
    await expect(context.repair()).rejects.toThrow("different source revision");
    expect(context.publishAlias).not.toHaveBeenCalled();
    context.fixture.objects.delete(`manifests/sha-${revision}`);
    context.publishAlias.mockImplementation(async () => undefined);
    await expect(context.repair()).rejects.toThrow("HTTP 404");
  });
});

describe("publication and recovery ordering", () => {
  const operations = () => ({
    verifyArtifact: vi.fn(async () => undefined),
    lookup: vi
      .fn<() => Promise<"absent" | "identical">>()
      .mockResolvedValue("identical"),
    validate: vi.fn(async () => undefined),
    authenticate: vi.fn(async () => undefined),
    publish: vi.fn(async () => undefined),
    sleep: vi.fn(async () => undefined),
  });

  it("skips authentication and publishing only after image and complete payload verification", async () => {
    const ops = operations();
    await expect(publishAndVerify(ops)).resolves.toBe("already published");
    expect(ops.verifyArtifact.mock.invocationCallOrder[0]).toBeLessThan(
      ops.lookup.mock.invocationCallOrder[0] ?? 0,
    );
    expect(ops.publish).not.toHaveBeenCalled();
    expect(ops.validate).not.toHaveBeenCalled();
    expect(ops.authenticate).not.toHaveBeenCalled();
  });

  it("publishes an absent entry only after verifying the image, then verifies production", async () => {
    const ops = operations();
    ops.lookup.mockResolvedValueOnce("absent").mockResolvedValueOnce("absent");
    await expect(publishAndVerify(ops)).resolves.toBe("published");
    expect(ops.verifyArtifact.mock.invocationCallOrder[0]).toBeLessThan(
      ops.publish.mock.invocationCallOrder[0] ?? 0,
    );
    expect(ops.lookup.mock.invocationCallOrder[1]).toBeGreaterThan(
      ops.publish.mock.invocationCallOrder[0] ?? 0,
    );
    expect(ops.lookup.mock.invocationCallOrder[0]).toBeLessThan(
      ops.validate.mock.invocationCallOrder[0] ?? 0,
    );
    expect(ops.validate.mock.invocationCallOrder[0]).toBeLessThan(
      ops.authenticate.mock.invocationCallOrder[0] ?? 0,
    );
    expect(ops.authenticate.mock.invocationCallOrder[0]).toBeLessThan(
      ops.publish.mock.invocationCallOrder[0] ?? 0,
    );
    expect(ops.publish).toHaveBeenCalledTimes(1);
    expect(ops.sleep).toHaveBeenCalledWith(5_000);
  });

  it("does not publish if image verification, lookup, or conflict checking fails", async () => {
    for (const failure of ["image", "Registry conflict", "Registry HTTP 500"]) {
      const ops = operations();
      if (failure === "image")
        ops.verifyArtifact.mockRejectedValue(new Error(failure));
      else ops.lookup.mockRejectedValue(new Error(failure));
      await expect(publishAndVerify(ops)).rejects.toThrow(failure);
      expect(ops.publish).not.toHaveBeenCalled();
      expect(ops.authenticate).not.toHaveBeenCalled();
    }
  });

  it.each(["validate", "authenticate"] as const)(
    "stops without a write or reconciliation if %s fails",
    async (operation) => {
      const ops = operations();
      ops.lookup.mockResolvedValueOnce("absent");
      ops[operation].mockRejectedValue(new Error(`${operation} failed`));
      await expect(publishAndVerify(ops)).rejects.toThrow(
        `${operation} failed`,
      );
      expect(ops.publish).not.toHaveBeenCalled();
      expect(ops.lookup).toHaveBeenCalledTimes(1);
      if (operation === "validate")
        expect(ops.authenticate).not.toHaveBeenCalled();
    },
  );

  it("fails closed on a transient preflight error without authenticating", async () => {
    const ops = operations();
    ops.lookup.mockImplementation(() =>
      registryEntry(manifest, async () => reply({}, 503)),
    );
    await expect(publishAndVerify(ops)).rejects.toThrow("HTTP 503");
    expect(ops.authenticate).not.toHaveBeenCalled();
    expect(ops.publish).not.toHaveBeenCalled();
    expect(ops.sleep).not.toHaveBeenCalled();
  });

  it.each([429, 503, "network"])(
    "retries a transient %s read after publishing only once",
    async (failure) => {
      const ops = operations();
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(reply(apiPayload()));
      fetcher.mockResolvedValueOnce(reply({}, 404));
      if (typeof failure === "number")
        fetcher.mockResolvedValueOnce(reply({}, failure));
      else fetcher.mockRejectedValueOnce(new Error("network unavailable"));
      ops.lookup.mockImplementation(() => registryEntry(manifest, fetcher));
      await expect(publishAndVerify(ops)).resolves.toBe("published");
      expect(ops.publish).toHaveBeenCalledTimes(1);
      expect(ops.sleep).toHaveBeenCalledExactlyOnceWith(5_000);
    },
  );

  it.each([
    { status: 401, body: {} },
    { status: 403, body: {} },
    { status: 200, body: {} },
    { status: 200, body: apiPayload(manifest, "deleted") },
    { status: 200, body: apiPayload({ ...manifest, description: "Changed" }) },
  ])(
    "never retries a permanent or conflicting read: %j",
    async ({ status, body }) => {
      const ops = operations();
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(reply({}, 404))
        .mockResolvedValueOnce(reply(body, status));
      ops.lookup.mockImplementation(() => registryEntry(manifest, fetcher));
      await expect(publishAndVerify(ops)).rejects.toThrow();
      expect(ops.publish).toHaveBeenCalledTimes(1);
      expect(ops.sleep).not.toHaveBeenCalled();
      expect(ops.lookup).toHaveBeenCalledTimes(2);
    },
  );

  it("does not republish a deleted exact version during preflight", async () => {
    const ops = operations();
    ops.lookup.mockImplementation(() =>
      registryEntry(manifest, async () =>
        reply(apiPayload(manifest, "deleted")),
      ),
    );
    await expect(publishAndVerify(ops)).rejects.toThrow();
    expect(ops.authenticate).not.toHaveBeenCalled();
    expect(ops.publish).not.toHaveBeenCalled();
  });

  it("bounds transient read retries without repeating the publication", async () => {
    const ops = operations();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(reply({}, 404))
      .mockResolvedValue(reply({}, 503));
    ops.lookup.mockImplementation(() => registryEntry(manifest, fetcher));
    await expect(publishAndVerify(ops)).rejects.toThrow(
      "could not be confirmed: Registry lookup failed: HTTP 503",
    );
    expect(ops.publish).toHaveBeenCalledTimes(1);
    expect(ops.lookup).toHaveBeenCalledTimes(7);
    expect(ops.sleep).toHaveBeenCalledTimes(5);
  });

  it("recovers a lost publish response only when the public payload matches", async () => {
    const ops = operations();
    ops.lookup.mockResolvedValueOnce("absent");
    ops.publish.mockRejectedValue(new Error("connection lost"));
    await expect(publishAndVerify(ops)).resolves.toBe("published");
  });

  it("fails boundedly if publication never becomes visible", async () => {
    const ops = operations();
    ops.lookup.mockResolvedValue("absent");
    await expect(publishAndVerify(ops)).rejects.toThrow("not visible");
    expect(ops.publish).toHaveBeenCalledTimes(1);
    expect(ops.sleep).toHaveBeenCalledTimes(5);
    ops.publish.mockRejectedValue(new Error("publisher failed"));
    await expect(publishAndVerify(ops)).rejects.toThrow("publisher failed");
  });
});

describe("release workflow safety", () => {
  const expression = (value: string) => `$${`{{ ${value} }}`}`;
  it("checks the exact commit, guards immutable images, and publishes only after image verification", async () => {
    const workflow = parse(await read(".github/workflows/release.yml"));
    expect(workflow.on.pull_request).toBeUndefined();
    expect(workflow.on.push.tags).toEqual(["v*.*.*"]);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
    expect(workflow.concurrency.group).toBe(
      `release-${expression("github.repository")}`,
    );
    const image = workflow.jobs.image;
    const registry = workflow.jobs.registry;
    const policy = workflow.jobs["release-policy"];
    expect(policy.permissions).toEqual({ contents: "read" });
    expect(image.needs).toBe("release-policy");
    expect(registry.needs).toBe("image");
    expect(registry.if).toBe("needs.image.outputs.stable == 'true'");
    expect(registry.permissions).toEqual({
      contents: "read",
      "id-token": "write",
    });
    expect(image.permissions["id-token"]).toBeUndefined();
    for (const job of [policy, image, registry]) {
      expect(job.steps[0].with).toMatchObject({
        ref: expression("github.sha"),
        "fetch-depth": 0,
        "persist-credentials": false,
      });
    }
    const prepare = image.steps.findIndex(
      (step: { id?: string }) => step.id === "release",
    );
    const build = image.steps.findIndex(
      (step: { id?: string }) => step.id === "build",
    );
    const verify = image.steps.findIndex(
      (step: { id?: string }) => step.id === "verify",
    );
    expect(prepare).toBeLessThan(build);
    expect(build).toBeLessThan(verify);
    expect(image.steps[build].if).toBe(
      "steps.release.outputs.existing != 'true'",
    );
    expect(image.steps[build].with).toMatchObject({
      sbom: true,
      provenance: "mode=max",
      tags: expression(
        "steps.release.outputs.exact-tag || steps.meta.outputs.tags",
      ),
    });
    expect(image.steps.at(-1).run).toBe("pnpm registry:release repair-tags");
    expect(image.steps.at(-1).env.IMAGE_DIGEST).toBe(
      expression("steps.verify.outputs.digest"),
    );
    expect(image.steps[verify].run).toBe("pnpm registry:release verify-image");
    expect(image.outputs.digest).toBe(
      expression("steps.verify.outputs.digest"),
    );
    const publish = registry.steps.find(
      (step: { run?: string }) => step.run === "pnpm registry:release publish",
    );
    expect(publish.env.IMAGE_DIGEST).toBe(
      expression("needs.image.outputs.digest"),
    );
    const cleanup = registry.steps.at(-1);
    expect(cleanup.if).toBe("always()");
    expect(cleanup.run).toBe('rm -f "$HOME/.config/mcp-publisher/token.json"');
  });

  it("runs the actual read-only policy against fresh main, older main, and an unmerged commit", async () => {
    const workflow = parse(await read(".github/workflows/release.yml"));
    const gate = workflow.jobs["release-policy"].steps[1];
    expect(gate.if).toBe("startsWith(github.ref, 'refs/tags/')");
    const directory = await mkdtemp(join(tmpdir(), "trello-registry-policy-"));
    const git = (...args: string[]) =>
      execFileSync(
        "git",
        [
          "-c",
          "core.hooksPath=/dev/null",
          "-c",
          "commit.gpgsign=false",
          ...args,
        ],
        { cwd: directory, encoding: "utf8", stdio: "pipe", timeout: 10_000 },
      ).trim();
    try {
      git("init", "--initial-branch=main");
      git("config", "user.name", "Registry Test");
      git("config", "user.email", "registry-test@example.invalid");
      git("commit", "--allow-empty", "-m", "Initial main commit");
      const older = git("rev-parse", "HEAD");
      git("switch", "-c", "unmerged");
      git("commit", "--allow-empty", "-m", "Unmerged commit");
      const unmerged = git("rev-parse", "HEAD");
      git("switch", "main");
      git("commit", "--allow-empty", "-m", "Current main commit");
      const current = git("rev-parse", "HEAD");
      git("remote", "add", "origin", directory);
      git("update-ref", "refs/remotes/origin/main", older);
      let number = 0;
      const runGate = (sha: string, annotated = true, eventSha = sha) => {
        const tag = `v9.8.${number++}`;
        git(
          "-c",
          "tag.gpgSign=false",
          "tag",
          ...(annotated ? ["-a", "-m", "Fixture"] : []),
          tag,
          sha,
        );
        return execFileSync("bash", ["-c", gate.run], {
          cwd: directory,
          env: {
            ...process.env,
            GITHUB_SHA: eventSha,
            GITHUB_REF: `refs/tags/${tag}`,
          },
          stdio: "pipe",
          timeout: 10_000,
        });
      };
      expect(() => runGate(current)).not.toThrow();
      expect(git("rev-parse", "origin/main")).toBe(current);
      expect(() => runGate(older)).not.toThrow();
      expect(() => runGate(unmerged)).toThrow("already on protected main");
      expect(() => runGate(current, false)).toThrow("annotated tag objects");
      expect(() => runGate(older, true, current)).toThrow(
        "event commit must agree",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
