import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverReleaseImage,
  releaseToolNames,
} from "../scripts/lib/release-discovery.js";
import { allTools } from "../src/trello/tools.js";

const launches = vi.hoisted(() => [] as StdioServerParameters[]);
vi.mock("@modelcontextprotocol/sdk/client/stdio.js", async (importOriginal) => {
  const sdk =
    await importOriginal<
      typeof import("@modelcontextprotocol/sdk/client/stdio.js")
    >();
  return {
    ...sdk,
    StdioClientTransport: class extends sdk.StdioClientTransport {
      constructor(params: StdioServerParameters) {
        super(params);
        launches.push(params);
      }
    },
  };
});

const catalog = await readFile(
  new URL("../README.md", import.meta.url),
  "utf8",
);
const image = `docker.io/enthouan/trello-mcp@sha256:${"1".repeat(64)}`;
const expected = { version: "0.3.1", names: ["lookup", "read"] };

afterEach(() => {
  launches.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("historical discovery expectations", () => {
  it("reads the full generated runtime catalog as data", () => {
    expect(releaseToolNames(catalog.replaceAll("\n", "\r\n"))).toEqual(
      allTools.map((tool) => tool.name),
    );
    expect(releaseToolNames(catalog)).toContain("card_attachment_upload");
    const small =
      "<!-- tools:start -->\n**2 tools** are registered.\n\n| Name | When to use | Key inputs |\n| --- | --- | --- |\n| `custom` | x | y |\n| `old` | x | z |\n<!-- tools:end -->";
    expect(releaseToolNames(small)).toEqual(["custom", "old"]);
  });
  it.each([
    catalog.replace("<!-- tools:end -->", ""),
    `${catalog}\n<!-- tools:end -->`,
    catalog.replace(/\*\*\d+ tools\*\*/, "**1 tools**"),
    catalog.replace("| `card_attachment_upload` |", "| `auth_whoami` |"),
    catalog.replace("| `auth_whoami` |", "| broken |"),
  ])("rejects missing, ambiguous or malformed catalogs", (data) => {
    expect(() => releaseToolNames(data)).toThrow(/release README tool/);
  });
});

function setup() {
  vi.spyOn(Client.prototype, "connect").mockResolvedValue();
  vi.spyOn(Client.prototype, "getServerVersion").mockReturnValue({
    name: "trello-mcp",
    version: expected.version,
  });
  const listTools = vi.spyOn(Client.prototype, "listTools").mockResolvedValue({
    tools: expected.names.map((name) => ({
      name,
      inputSchema: { type: "object" },
    })),
  });
  const docker = vi.fn(
    async (args: string[], env: Record<string, string>): Promise<string> => {
      expect(env.DOCKERHUB_TOKEN).toBeUndefined();
      const config = JSON.parse(
        await readFile(join(env.DOCKER_CONFIG ?? "", "config.json"), "utf8"),
      );
      expect(config).toEqual({ auths: { "unused.invalid": {} } });
      if (args[0] === "version") return "linux/amd64";
      if (args[0] === "inspect") return "healthy";
      return "";
    },
  );
  const sleep = vi.fn(async () => {});
  return {
    docker,
    dockerEndpoint: vi.fn(async () => "unix:///tmp/desktop-docker.sock"),
    sleep,
    listTools,
  };
}

describe("anonymous native release discovery", () => {
  it("pulls the immutable image anonymously and exercises offline stdio discovery and Docker health", async () => {
    const ops = setup();
    vi.stubEnv("DOCKERHUB_TOKEN", "synthetic-publisher-token");
    vi.stubEnv("DOCKER_CONFIG", "/unused/publisher/config");
    vi.stubEnv("DOCKER_CONTEXT", "publisher");
    vi.stubEnv("DOCKER_AUTH_CONFIG", "synthetic-publisher-credentials");
    const result = await discoverReleaseImage(image, expected, {
      operations: ops,
    });
    expect(result).toEqual({
      platform: "linux/amd64",
      toolCount: 2,
      health: "healthy",
    });
    const launch = launches[0];
    expect(launch?.command).toBe("docker");
    const name = launch?.args?.[(launch?.args?.indexOf("--name") ?? -1) + 1];
    expect(name).toMatch(/^trello-mcp-registry-[a-f0-9-]+$/);
    expect(launch?.args).toEqual([
      "run",
      "--rm",
      "-i",
      "--network=none",
      "--platform",
      "linux/amd64",
      "--pull=never",
      "--name",
      name,
      "-e",
      "TRANSPORT=stdio",
      "-e",
      "TRELLO_API_KEY=synthetic-offline-api-key",
      "-e",
      "TRELLO_TOKEN=synthetic-offline-token",
      image,
    ]);
    expect(launch?.env?.DOCKERHUB_TOKEN).toBeUndefined();
    expect(launch?.env?.DOCKER_AUTH_CONFIG).toBeUndefined();
    expect(launch?.env?.DOCKER_CONTEXT).toBeUndefined();
    expect(launch?.env?.DOCKER_HOST).toBe("unix:///tmp/desktop-docker.sock");
    expect(ops.docker.mock.calls.map(([args]) => args)).toEqual([
      ["version", "--format", "{{.Server.Os}}/{{.Server.Arch}}"],
      ["pull", "--platform", "linux/amd64", image],
      ["inspect", "--format", "{{.State.Health.Status}}", name],
      ["rm", "-f", name],
    ]);
    expect(
      ops.docker.mock.calls.every(
        ([, env]) => env.DOCKER_CONFIG === launch?.env?.DOCKER_CONFIG,
      ),
    ).toBe(true);
    await expect(access(launch?.env?.DOCKER_CONFIG ?? "")).rejects.toThrow();
  });
  it("refuses a remote context before starting or pulling an image", async () => {
    const ops = setup();
    ops.dockerEndpoint.mockResolvedValue("ssh://remote.example");
    await expect(
      discoverReleaseImage(image, expected, { operations: ops }),
    ).rejects.toThrow(/local Docker daemon/);
    expect(ops.docker).not.toHaveBeenCalled();
  });
  it.each([
    ["unix:///tmp/custom/socket", image],
    ["unix:///tmp/custom/socket", "private/registry-image:cached"],
    ["ssh://test-daemon", "local:smoke"],
  ])("preserves manual Docker context and cached %s %s", async (host, ref) => {
    const ops = setup();
    vi.stubEnv("DOCKER_CONTEXT", "custom-context");
    vi.stubEnv("DOCKER_CONFIG", "/unused/caller/config");
    vi.stubEnv("DOCKER_AUTH_CONFIG", "synthetic caller auth");
    vi.stubEnv("DOCKER_DEFAULT_PLATFORM", "linux/arm64");
    vi.stubEnv("DOCKER_HOST", host);
    ops.docker.mockImplementation(async (args, env) => {
      expect(env).toMatchObject({
        DOCKER_CONFIG: "/unused/caller/config",
        DOCKER_HOST: host,
        DOCKER_CONTEXT: "custom-context",
        DOCKER_AUTH_CONFIG: "synthetic caller auth",
        DOCKER_DEFAULT_PLATFORM: "linux/arm64",
      });
      if (args[0] === "version") return "linux/amd64";
      if (args[0] === "inspect") return "healthy";
      return "";
    });
    await expect(
      discoverReleaseImage(ref, expected, {
        localOrTagged: true,
        operations: ops,
      }),
    ).resolves.toMatchObject({ toolCount: 2, health: "healthy" });
    expect(ops.dockerEndpoint).not.toHaveBeenCalled();
    expect(ops.docker.mock.calls.map(([args]) => args[0])).toEqual([
      "version",
      "inspect",
      "rm",
    ]);
    expect(launches[0]?.args).not.toContain("--platform");
    expect(launches[0]?.args).not.toContain("--pull=never");
    expect(launches[0]?.env?.DOCKER_CONFIG).toBe("/unused/caller/config");
  });
  it.each([true, false])(
    "reconciles a failed cleanup only with confirmed container absence (%s)",
    async (absent) => {
      const ops = setup();
      ops.docker.mockImplementation(async (args) => {
        if (args[0] === "version") return "linux/amd64";
        if (args[0] === "inspect") return "healthy";
        if (args[0] === "rm") throw new Error("cleanup failed");
        if (args[0] === "ps") return absent ? "" : "still-running";
        return "";
      });
      const runtime = discoverReleaseImage(image, expected, {
        operations: ops,
      });
      if (absent)
        await expect(runtime).resolves.toMatchObject({ health: "healthy" });
      else await expect(runtime).rejects.toThrow(/remove/);
      expect(ops.docker.mock.lastCall?.[0][4]).toMatch(
        /^name=\^\/trello-mcp-registry-[0-9a-f-]+\$$/,
      );
      await expect(
        access(launches[0]?.env?.DOCKER_CONFIG ?? ""),
      ).rejects.toThrow();
    },
  );
  it.each([
    "docker.io/enthouan/trello-mcp:latest",
    "redis",
    "-e",
    "ghcr.io/other/trello-mcp@sha256:bad",
  ])("rejects a mutable or foreign release source", async (value) => {
    const ops = setup();
    await expect(
      discoverReleaseImage(value, expected, { operations: ops }),
    ).rejects.toThrow(/canonical image digest/);
    expect(ops.docker).not.toHaveBeenCalled();
  });
  it.each([
    "name",
    "version",
    "missing",
    "extra",
    "health",
    "pagination",
  ] as const)(
    "rejects a %s mismatch and cleans up the container and config",
    async (failure) => {
      const ops = setup();
      if (failure === "name" || failure === "version")
        vi.mocked(Client.prototype.getServerVersion).mockReturnValue({
          name: "trello-mcp",
          version: expected.version,
          [failure]: "other",
        });
      if (failure === "missing") ops.listTools.mockResolvedValue({ tools: [] });
      if (failure === "extra")
        ops.listTools.mockResolvedValue({
          tools: [...expected.names, "unexpected"].map((name) => ({
            name,
            inputSchema: { type: "object" },
          })),
        });
      if (failure === "pagination")
        ops.listTools.mockResolvedValue({ tools: [], nextCursor: "same" });
      if (failure === "health")
        ops.docker.mockImplementation(async (args) =>
          args[0] === "version"
            ? "linux/amd64"
            : args[0] === "inspect"
              ? "unhealthy"
              : "",
        );
      await expect(
        discoverReleaseImage(image, expected, { operations: ops }),
      ).rejects.toThrow(/Container|health check|pagination/);
      expect(ops.docker.mock.lastCall?.[0].slice(0, 2)).toEqual(["rm", "-f"]);
      await expect(
        access(launches[0]?.env?.DOCKER_CONFIG ?? ""),
      ).rejects.toThrow();
    },
  );
});
