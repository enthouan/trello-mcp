import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  freshReleases,
  planMirrorTag,
  publishMirrorTag,
  selectedRelease,
} from "../scripts/lib/docker-hub-mirror.js";
import {
  type MirrorIdentity,
  MissingContent,
} from "../scripts/lib/mirror-registry.js";

const repo = "enthouan/trello-mcp";
const upstream = `https://github.com/${repo}.git`;
const version = "1.10.0";
const revision = "a".repeat(40);
const digest = `sha256:${"0".repeat(64)}`;
const selected = { version, revision, digest };
const older = {
  version: "1.9.9",
  revision: "b".repeat(40),
  digest: `sha256:${"1".repeat(64)}`,
};
const newer = {
  version: "2.0.0",
  revision: "c".repeat(40),
  digest: `sha256:${"2".repeat(64)}`,
};
const releaseEnv = {
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: repo,
  GITHUB_EVENT_NAME: "push",
  GITHUB_WORKFLOW_REF: `${repo}/.github/workflows/release.yml@refs/tags/v${version}`,
  GITHUB_REF: `refs/tags/v${version}`,
  GITHUB_SHA: revision,
  EXPECTED_TAG_OBJECT: revision,
  RELEASE_TAG: `v${version}`,
  RELEASE_COMMIT: revision,
  RELEASE_IMAGE_DIGEST: digest,
};
const recovery = {
  ...releaseEnv,
  EXPECTED_TAG_OBJECT: "",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_WORKFLOW_REF: `${repo}/.github/workflows/docker-hub-mirror.yml@refs/heads/main`,
  GITHUB_SHA: newer.revision,
};
const schema = JSON.parse(
  readFileSync(
    new URL(
      "../scripts/schemas/mcp-server-2025-12-11.schema.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const currentManifest = JSON.parse(
  readFileSync(new URL("../server.json", import.meta.url), "utf8"),
);
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
function manifest(ver: string) {
  return JSON.stringify({
    ...currentManifest,
    version: ver,
    packages: [
      { ...currentManifest.packages[0], identifier: `ghcr.io/${repo}:${ver}` },
    ],
  });
}

function mockGit(head: string) {
  return vi.fn((args: string[]): string => {
    switch (args[0]) {
      case "rev-parse":
        return args[1] === "HEAD" ? head : revision;
      case "cat-file":
        return "tag";
      case "merge-base":
        return "";
      case "show":
        if (args[1] === `${revision}:package.json`)
          return JSON.stringify({ name: "trello-mcp", version });
        if (args[1] === `${revision}:server.json`) return manifest(version);
        if (args[1] === `${revision}:README.md`) return readme;
    }
    throw new Error("Unexpected git command");
  });
}

describe("mirror release selection", () => {
  it("consumes the verified digest and commit only on the canonical stable release workflow", () => {
    const git = mockGit(revision);
    expect(selectedRelease(releaseEnv, git, schema)).toMatchObject({
      ...selected,
      tools: expect.arrayContaining(["card_attachment_upload"]),
    });
    for (const override of [
      { GITHUB_ACTIONS: "false" },
      { EXPECTED_TAG_OBJECT: "" },
      { EXPECTED_TAG_OBJECT: older.revision },
      { GITHUB_REPOSITORY: "fork/trello-mcp" },
      { GITHUB_EVENT_NAME: "pull_request" },
      { GITHUB_EVENT_NAME: "workflow_dispatch" },
      { GITHUB_REF: "refs/heads/main" },
      { GITHUB_WORKFLOW_REF: "untrusted-workflow" },
      { RELEASE_TAG: "latest" },
      { RELEASE_TAG: "v1.0.0-rc.1" },
      { RELEASE_TAG: "v1.0.0+foo" },
      { RELEASE_TAG: "v1.00.0" },
      { RELEASE_IMAGE_DIGEST: "latest" },
      { RELEASE_COMMIT: "HEAD" },
      { RELEASE_COMMIT: older.revision },
      { GITHUB_REF: "refs/tags/v1.2.3" },
      { GITHUB_SHA: older.revision },
    ])
      expect(() =>
        selectedRelease({ ...releaseEnv, ...override }, git, schema),
      ).toThrow();
  });

  it("runs the reviewed main ref and reads historical release files only as data", () => {
    const git = mockGit(newer.revision);
    expect(selectedRelease(recovery, git, schema).version).toBe(version);
    expect(() => selectedRelease(recovery, git, schema, "exact")).toThrow(
      /tag object/,
    );
    expect(
      selectedRelease(
        { ...recovery, EXPECTED_TAG_OBJECT: revision },
        git,
        schema,
        "latest",
      ).tagObject,
    ).toBe(revision);
    for (const file of ["README.md", "server.json", "package.json"])
      expect(git).toHaveBeenCalledWith(["show", `${revision}:${file}`]);
    for (const commit of ["HEAD", revision])
      expect(git).toHaveBeenCalledWith([
        "merge-base",
        "--is-ancestor",
        commit,
        "refs/remotes/origin/main",
      ]);
    expect(() =>
      selectedRelease(
        { ...recovery, GITHUB_REF: "refs/heads/other" },
        git,
        schema,
      ),
    ).toThrow();
    expect(() =>
      selectedRelease(
        { ...recovery, GITHUB_WORKFLOW_REF: releaseEnv.GITHUB_WORKFLOW_REF },
        git,
        schema,
      ),
    ).toThrow();
    expect(() =>
      selectedRelease(recovery, mockGit(older.revision), schema),
    ).toThrow();
    expect(
      selectedRelease(
        { ...recovery, EXPECTED_TAG_OBJECT: revision },
        git,
        schema,
      ).tagObject,
    ).toBe(revision);
    expect(() =>
      selectedRelease(
        { ...recovery, EXPECTED_TAG_OBJECT: older.revision },
        git,
        schema,
      ),
    ).toThrow(/tag object changed/);
    for (const [command, arg, value] of [
      ["cat-file", "-t", "commit"],
      ["rev-parse", `refs/tags/v${version}^{commit}`, older.revision],
      ["show", `${revision}:server.json`, manifest(older.version)],
      [
        "show",
        `${revision}:package.json`,
        '{"name":"trello-mcp","version":"1.2.3"}',
      ],
      ["show", `${revision}:README.md`, "unrecognized catalog"],
    ])
      expect(() =>
        selectedRelease(
          recovery,
          (args) =>
            args[0] === command && args[1] === arg
              ? (value as string)
              : git(args),
          schema,
        ),
      ).toThrow();
  });

  it("refreshes protected main and private annotated tag refs including deletions and retags", {
    timeout: 30_000,
  }, () => {
    const dir = mkdtempSync(join(tmpdir(), "trello-mirror-git-"));
    const remote = join(dir, "upstream");
    const clone = join(dir, "checkout");
    const run = (cwd: string, args: string[]) =>
      execFileSync(
        "git",
        [
          "-c",
          "user.name=Test",
          "-c",
          "user.email=test@example.org",
          "-c",
          "tag.gpgsign=false",
          "-c",
          "commit.gpgsign=false",
          ...args,
        ],
        {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            PATH: process.env.PATH,
            GIT_CONFIG_NOSYSTEM: "1",
            GIT_CONFIG_GLOBAL: "/dev/null",
          },
        },
      ).trimEnd();
    const remoteGit = (...args: string[]) => run(remote, args);
    const local = (args: string[]) =>
      run(
        clone,
        args.map((arg) => (arg === upstream ? remote : arg)),
      );
    const makeRelease = (ver: string, metadata = manifest(ver)) => {
      writeFileSync(
        join(remote, "package.json"),
        JSON.stringify({ name: "trello-mcp", version: ver }),
      );
      writeFileSync(join(remote, "server.json"), metadata);
      remoteGit("add", "package.json", "server.json");
      remoteGit("commit", "-m", ver);
      remoteGit("tag", "-a", `v${ver}`, "-m", ver);
      return remoteGit("rev-parse", "HEAD");
    };
    try {
      run(dir, ["init", "-b", "main", remote]);
      const commit = makeRelease(version);
      const target = { ...selected, revision: commit };
      run(dir, ["clone", remote, clone]);
      const futureManifest = {
        ...JSON.parse(manifest(newer.version)),
        $schema:
          "https://static.modelcontextprotocol.io/schemas/2027-01-01/server.schema.json",
        title: "Trello MCP Server",
      };
      const latestCommit = makeRelease(
        newer.version,
        JSON.stringify(futureManifest),
      );
      remoteGit("tag", "v20.0.0");
      remoteGit("tag", "-a", "v30.0.0", "-m", "mismatched metadata");
      remoteGit("checkout", "-b", "off-main");
      makeRelease("40.0.0");
      remoteGit("checkout", "main");
      expect(freshReleases(target, local)).toEqual(
        new Map([
          [version, commit],
          [newer.version, latestCommit],
        ]),
      );
      const unfamiliar = "3.0.0";
      makeRelease(
        unfamiliar,
        JSON.stringify({
          version: unfamiliar,
          distribution: { image: "unknown" },
        }),
      );
      expect(() => freshReleases(target, local)).toThrow(
        /Cannot determine release coordinates/,
      );
      remoteGit("tag", "-d", `v${unfamiliar}`);
      remoteGit("tag", "-d", `v${version}`);
      expect(() => freshReleases(target, local)).toThrow(
        /remote annotated tag/,
      );
      remoteGit("tag", `v${version}`, commit);
      expect(() => freshReleases(target, local)).toThrow(
        /remote annotated tag/,
      );
      remoteGit(
        "tag",
        "-fa",
        `v${version}`,
        commit,
        "-m",
        "new tag object on same commit",
      );
      expect(() => freshReleases(target, local)).toThrow(
        /remote annotated tag/,
      );
      remoteGit(
        "tag",
        "-fa",
        `v${version}`,
        latestCommit,
        "-m",
        "moved commit",
      );
      expect(() => freshReleases(target, local)).toThrow(
        /remote annotated tag/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function fixture() {
  const tags = new Map<string, string>();
  const releases = new Map([
    [version, revision],
    [older.version, older.revision],
  ]);
  const deps = {
    releases: vi.fn(() => releases),
    tagDigest: vi.fn(async (tag: string) => tags.get(tag) ?? null),
    identity: vi.fn(async (hash: string): Promise<MirrorIdentity> => {
      const known = [selected, older, newer].find(
        (image) => image.digest === hash,
      );
      if (!known) throw new Error("Invalid alias identity");
      return known;
    }),
    verify: vi.fn(async (): Promise<unknown> => ({ digest })),
    sleep: vi.fn(async (_ms: number) => {}),
  };
  const copy = vi.fn(async (tag: string) => {
    tags.set(tag, digest);
    return true;
  });
  const authenticate = vi.fn(async () => {});
  const writer = async (tag: string, guard: () => Promise<void>) => {
    await authenticate();
    await guard();
    return copy(tag);
  };
  return { tags, releases, deps, copy, authenticate, writer };
}

describe("Docker Hub publication policy", () => {
  it("copies an absent exact tag once, then anonymously verifies and reuses it", async () => {
    const { deps, copy, writer } = fixture();
    expect((await planMirrorTag(version, selected, deps)).action).toBe("copy");
    await expect(
      publishMirrorTag(version, selected, deps, writer),
    ).resolves.toContain("copied and verified");
    await expect(
      publishMirrorTag(version, selected, deps, writer),
    ).resolves.toContain("reused");
    expect(copy).toHaveBeenCalledTimes(1);
    expect(deps.verify).toHaveBeenCalledTimes(2);
  });

  it("repairs only confirmed missing content behind the same exact index, including missing platform manifests", async () => {
    const { tags, deps, copy, writer } = fixture();
    tags.set(version, digest);
    deps.verify.mockRejectedValueOnce(new MissingContent("child missing"));
    await expect(
      publishMirrorTag(version, selected, deps, writer),
    ).resolves.toContain(digest);
    expect(deps.identity).not.toHaveBeenCalled();
    expect(copy).toHaveBeenCalledOnce();
    for (const error of [
      "authentication",
      "digest mismatch",
      "ambiguous 404",
      "rate limit",
    ]) {
      deps.verify.mockRejectedValueOnce(new Error(error));
      await expect(
        publishMirrorTag(version, selected, deps, writer),
      ).rejects.toThrow(error);
    }
    tags.set(version, older.digest);
    await expect(
      publishMirrorTag(version, selected, deps, writer),
    ).rejects.toThrow(/Immutable conflict/);
    expect(copy).toHaveBeenCalledOnce();
  });

  it("allows preview of an interrupted graph shared by exact and latest, then repairs exact first", async () => {
    const { tags, deps, copy, writer } = fixture();
    tags.set(version, digest);
    tags.set("latest", digest);
    deps.verify.mockRejectedValueOnce(new MissingContent("layer missing"));
    expect((await planMirrorTag("latest", selected, deps)).action).toBe(
      "repair",
    );
    deps.verify.mockRejectedValueOnce(new MissingContent("layer missing"));
    await expect(
      publishMirrorTag("latest", selected, deps, writer),
    ).rejects.toThrow(/exact image graph/);
    deps.verify.mockRejectedValueOnce(new MissingContent("layer missing"));
    await publishMirrorTag(version, selected, deps, writer);
    await publishMirrorTag("latest", selected, deps, writer);
    expect(copy.mock.calls).toEqual([[version]]);
  });

  it("reconciles uncertain writes with bounded public reads and no duplicate writes", async () => {
    const { tags, deps, copy, writer } = fixture();
    copy.mockImplementationOnce(async (tag) => {
      tags.set(tag, digest);
      return false;
    });
    deps.verify.mockRejectedValueOnce(
      new MissingContent("replica still missing layer"),
    );
    await expect(
      publishMirrorTag(version, selected, deps, writer),
    ).resolves.toContain("uncertain copy response");
    expect(copy).toHaveBeenCalledOnce();
    tags.clear();
    copy.mockResolvedValueOnce(false);
    await expect(
      publishMirrorTag(version, selected, deps, writer),
    ).rejects.toThrow(/remains unconfirmed/);
    expect(copy).toHaveBeenCalledTimes(2);
    expect(deps.sleep).toHaveBeenCalledTimes(5);
    copy.mockImplementationOnce(async (tag) => {
      tags.set(tag, older.digest);
      return false;
    });
    await expect(
      publishMirrorTag(version, selected, deps, writer),
    ).rejects.toThrow(/Conflicting Docker Hub read-back/);
    expect(copy).toHaveBeenCalledTimes(3);
  });

  it("blocks changed or missing release refs, destination races, and failed reads before writing", async () => {
    const { deps, copy, writer } = fixture();
    for (const tags of [new Map(), new Map([[version, older.revision]])]) {
      deps.releases
        .mockReturnValueOnce(new Map([[version, revision]]))
        .mockReturnValueOnce(tags);
      await expect(
        publishMirrorTag(version, selected, deps, writer),
      ).rejects.toThrow(/moved/);
    }
    deps.tagDigest
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(older.digest);
    await expect(
      publishMirrorTag(version, selected, deps, writer),
    ).rejects.toThrow(/Destination changed/);
    deps.tagDigest.mockRejectedValueOnce(new Error("public read denied"));
    await expect(
      publishMirrorTag(version, selected, deps, writer),
    ).rejects.toThrow(/denied/);
    expect(copy).not.toHaveBeenCalled();
  });

  it("advances latest numerically only after its exact destination matches", async () => {
    const { tags, deps, copy, writer } = fixture();
    tags.set("latest", older.digest);
    tags.set(older.version, older.digest);
    expect((await planMirrorTag("latest", selected, deps)).action).toBe("copy");
    await expect(
      publishMirrorTag("latest", selected, deps, writer),
    ).rejects.toThrow(/Exact Docker Hub tag/);
    tags.set(version, digest);
    await expect(
      publishMirrorTag("latest", selected, deps, writer),
    ).resolves.toContain(digest);
    expect(copy).toHaveBeenCalledOnce();
    await expect(
      publishMirrorTag("latest", selected, deps, writer),
    ).resolves.toContain("reused");
    tags.delete(version);
    await expect(
      publishMirrorTag("latest", selected, deps, writer),
    ).rejects.toThrow(/Exact Docker Hub tag/);
    expect(copy).toHaveBeenCalledOnce();
  });

  it("preserves a newer tag arriving during login and a newer destination during a backfill", async () => {
    const { tags, releases, deps, copy, writer, authenticate } = fixture();
    tags.set(version, digest);
    authenticate.mockImplementationOnce(async () => {
      releases.set(newer.version, newer.revision);
    });
    await expect(
      publishMirrorTag("latest", selected, deps, writer),
    ).resolves.toContain("owns latest");
    tags.set("latest", newer.digest);
    tags.set(newer.version, newer.digest);
    releases.delete(newer.version);
    await expect(
      publishMirrorTag("latest", selected, deps, writer),
    ).resolves.toContain("already identifies newer");
    expect(copy).not.toHaveBeenCalled();
  });

  it("rejects conflicting older aliases, even when a newer remote tag reserves latest", async () => {
    const { tags, releases, deps, copy, writer } = fixture();
    tags.set(version, digest);
    tags.set("latest", older.digest);
    releases.set(newer.version, newer.revision);
    await expect(
      publishMirrorTag("latest", selected, deps, writer),
    ).rejects.toThrow(/differs from its exact/);
    tags.set(older.version, older.digest);
    releases.set(older.version, newer.revision);
    await expect(
      publishMirrorTag("latest", selected, deps, writer),
    ).rejects.toThrow(/conflicting Git/);
    expect(copy).not.toHaveBeenCalled();
  });
});
