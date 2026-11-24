import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

const exec = promisify(execFile);
const releaseImage =
  /^(ghcr\.io|docker\.io)\/enthouan\/trello-mcp@sha256:[0-9a-f]{64}$/;
type Expectations = { version: string; names: readonly string[] };

export function releaseToolNames(readme: string): string[] {
  const normalized = readme.replaceAll("\r\n", "\n");
  const parts = normalized.split(/^<!-- tools:(?:start|end) -->$/m);
  const section = parts[1];
  if (
    parts.length !== 3 ||
    !section ||
    !normalized.includes(`<!-- tools:start -->${section}<!-- tools:end -->`)
  )
    throw new Error(
      "Missing or ambiguous generated release README tool catalog.",
    );
  const lines = section.trim().split("\n");
  const count = /^\*\*([1-9][0-9]*) tools\*\* are registered\./.exec(
    lines[0] ?? "",
  );
  if (
    !count ||
    lines[1] !== "" ||
    lines[2] !== "| Name | When to use | Key inputs |" ||
    lines[3] !== "| --- | --- | --- |"
  )
    throw new Error("Invalid generated release README tool catalog.");
  const names = lines.slice(4).map((line) => {
    const match = /^\| `([a-zA-Z0-9_.-]+)` \| .+ \| .* \|$/.exec(line);
    if (!match?.[1]) throw new Error("Malformed release README tool row.");
    return match[1];
  });
  if (names.length !== Number(count[1]) || new Set(names).size !== names.length)
    throw new Error("Incomplete or duplicate release README tool catalog.");
  return names;
}

async function docker(args: string[], env: Record<string, string>) {
  try {
    return (
      await exec("docker", args, {
        env,
        timeout: args[0] === "pull" ? 180_000 : 15_000,
      })
    ).stdout.trim();
  } catch {
    throw new Error(`Docker ${args[0]} failed during release discovery.`);
  }
}

// Selecting a fresh DOCKER_CONFIG also resets the active context. Resolve only
// its daemon address before isolation, so a Desktop or rootless socket is
// preserved. Context inspection is local metadata and performs no image pull.
function contextEnvironment() {
  const env = getDefaultEnvironment();
  for (const key of [
    "DOCKER_CONFIG",
    "DOCKER_CONTEXT",
    "DOCKER_HOST",
    "DOCKER_TLS_VERIFY",
    "DOCKER_CERT_PATH",
    "DOCKER_TLS",
  ]) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

async function dockerEndpoint() {
  return docker(
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    contextEnvironment(),
  );
}

const operations = { docker, dockerEndpoint, sleep: (ms: number) => sleep(ms) };

async function removeContainer(
  ops: typeof operations,
  env: Record<string, string>,
  container: string,
) {
  try {
    await ops.docker(["rm", "-f", container], env);
  } catch {
    // --rm may already have removed it when the transport closed.
    const remaining = await ops.docker(
      ["ps", "--all", "--quiet", "--filter", `name=^/${container}$`],
      env,
    );
    if (remaining)
      throw new Error("Could not remove the offline discovery container.");
  }
}

// The default path accepts only an immutable mirror or GHCR release. The
// existing manual discover command also supports locally built images.
export async function discoverReleaseImage(
  image: string,
  expected: Expectations,
  options: { localOrTagged?: boolean; operations?: typeof operations } = {},
) {
  if (
    options.localOrTagged
      ? !/^[^\s-][^\s]*$/.test(image)
      : !releaseImage.test(image)
  )
    throw new Error("Release discovery requires a canonical image digest.");
  const ops = options.operations ?? operations;
  const container = `trello-mcp-registry-${randomUUID()}`;
  let env = contextEnvironment();
  let config: string | undefined;
  try {
    if (options.localOrTagged) {
      // Preserve Docker's configured daemon, credential store, platform and
      // normal cached-image behavior for the general-purpose discover command.
      for (const key of ["DOCKER_AUTH_CONFIG", "DOCKER_DEFAULT_PLATFORM"]) {
        const value = process.env[key];
        if (value) env[key] = value;
      }
    } else {
      const host = await ops.dockerEndpoint();
      if (!host.startsWith("unix:///") && !host.startsWith("npipe:////./pipe/"))
        throw new Error(
          "Offline release discovery requires a local Docker daemon socket.",
        );
      config = await mkdtemp(join(tmpdir(), "trello-mcp-discovery-"));
      env = {
        ...getDefaultEnvironment(),
        DOCKER_CONFIG: config,
        DOCKER_HOST: host,
      };
      // Nonempty AuthConfigs suppresses automatic native helper discovery.
      await writeFile(
        join(config, "config.json"),
        JSON.stringify({ auths: { "unused.invalid": {} } }),
        { mode: 0o600 },
      );
    }
    const platform = await ops.docker(
      ["version", "--format", "{{.Server.Os}}/{{.Server.Arch}}"],
      env,
    );
    if (config) {
      z.enum(["linux/amd64", "linux/arm64"]).parse(platform);
      await ops.docker(["pull", "--platform", platform, image], env);
    }
    const transport = new StdioClientTransport({
      command: "docker",
      args: [
        "run",
        "--rm",
        "-i",
        "--network=none",
        ...(config ? ["--platform", platform, "--pull=never"] : []),
        "--name",
        container,
        "-e",
        "TRANSPORT=stdio",
        "-e",
        "TRELLO_API_KEY=synthetic-offline-api-key",
        "-e",
        "TRELLO_TOKEN=synthetic-offline-token",
        image,
      ],
      env,
      stderr: "pipe",
    });
    transport.stderr?.on("data", () => undefined);
    const client = new Client({
      name: "trello-mcp-registry-check",
      version: "1.0.0",
    });
    try {
      await client.connect(transport, { timeout: 30_000 }).catch(() => {
        throw new Error("Offline MCP initialization failed.");
      });
      const server = client.getServerVersion();
      if (server?.name !== "trello-mcp" || server.version !== expected.version)
        throw new Error("Container MCP identity differs from the release.");
      const names: string[] = [];
      const cursors = new Set<string>();
      let cursor: string | undefined;
      do {
        const page = await client
          .listTools(cursor ? { cursor } : undefined, { timeout: 10_000 })
          .catch(() => {
            throw new Error("Offline MCP tools/list failed.");
          });
        names.push(...page.tools.map((tool) => tool.name));
        cursor = page.nextCursor;
        if (cursor !== undefined) {
          if (!cursor || cursors.has(cursor) || cursors.size >= 100)
            throw new Error("Invalid release tool pagination.");
          cursors.add(cursor);
        }
      } while (cursor !== undefined);
      if (
        JSON.stringify(names.sort()) !==
        JSON.stringify([...expected.names].sort())
      )
        throw new Error(
          "Container tool discovery differs from the release source.",
        );
      for (let attempt = 0; attempt <= 25; attempt++) {
        const status = z
          .enum(["starting", "healthy", "unhealthy"])
          .parse(
            await ops.docker(
              ["inspect", "--format", "{{.State.Health.Status}}", container],
              env,
            ),
          );
        if (status === "healthy")
          return { platform, toolCount: names.length, health: status };
        if (status === "unhealthy" || attempt === 25) break;
        await ops.sleep(2_000);
      }
      throw new Error(
        "The stdio container did not pass its image-defined health check.",
      );
    } finally {
      try {
        await client.close();
        await transport.close();
      } finally {
        await removeContainer(ops, env, container);
      }
    }
  } finally {
    if (config) await rm(config, { recursive: true, force: true });
  }
}
