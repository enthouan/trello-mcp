import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import {
  imageName,
  ownershipLabel,
  publishAndVerify,
  registryEntry,
  repository,
  serverName,
  stableRelease,
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
      versionUrl(manifest),
      expect.objectContaining({ redirect: "error" }),
    );
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty("headers");
  });

  it.each([401, 403, 429, 500, 503])(
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
    ).rejects.toThrow("network unavailable");
  });
});

function imageFixture(
  options: {
    badLabel?: boolean;
    missingPlatform?: boolean;
    badIndex?: boolean;
    badVersion?: boolean;
    badRevision?: boolean;
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
      config: {
        User: "node",
        Cmd: ["node", "dist/index.js"],
        Labels: {
          ...(options.badLabel ? {} : { [ownershipLabel]: serverName }),
          "org.opencontainers.image.version": options.badVersion
            ? "0.0.0"
            : manifest.version,
          "org.opencontainers.image.revision": options.badRevision
            ? "b".repeat(40)
            : revision,
          "org.opencontainers.image.source": `https://github.com/${repository}`,
        },
      },
    });
    return {
      digest: store("manifests", { config: { digest: config } }),
      platform: { os: "linux", architecture },
    };
  });
  const digest = store("manifests", {
    annotations: options.badIndex ? {} : { [ownershipLabel]: serverName },
    manifests: platforms,
  });
  objects.set(
    `manifests/${manifest.version}`,
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
    ).toHaveLength(2);
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
  ])("rejects an existing invalid image: %j", async (options) => {
    const fixture = imageFixture(options);
    await expect(
      verifyImage(manifest, revision, undefined, fixture.fetcher),
    ).rejects.toThrow();
  });

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

describe("publication and recovery ordering", () => {
  const operations = () => ({
    verifyArtifact: vi.fn(async () => undefined),
    lookup: vi
      .fn<() => Promise<"absent" | "identical">>()
      .mockResolvedValue("identical"),
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
    }
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
    const image = workflow.jobs.image;
    const registry = workflow.jobs.registry;
    expect(registry.needs).toBe("image");
    expect(registry.if).toBe("needs.image.outputs.stable == 'true'");
    expect(registry.permissions).toEqual({
      contents: "read",
      "id-token": "write",
    });
    expect(image.permissions["id-token"]).toBeUndefined();
    for (const job of [image, registry]) {
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
});
