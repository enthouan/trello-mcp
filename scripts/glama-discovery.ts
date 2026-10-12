// Non-publishing evidence capture. Does not read .env or call any tool handler.
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ReadBuffer } from "@modelcontextprotocol/sdk/shared/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  InitializeResultSchema,
  type JSONRPCMessage,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { allTools } from "../src/trello/tools.js";
import {
  assertMatchingInitialization,
  assertNoFilesystemChanges,
  assertNoSyntheticSecrets,
  decodeDiscoveryStderr,
  discoveryWriter,
  dockerClientEnvironment,
  inspectDiscovery,
  safeHealthEvidence,
  safeImageIdentity,
  validateProtocolStdout,
} from "./lib/mcp-discovery.js";

const exec = promisify(execFile);
const [mode, output, image] = process.argv.slice(2);
if (
  !output ||
  !["source", "image"].includes(mode ?? "") ||
  (mode === "image" && !image)
)
  throw new Error(
    "Usage: glama-discovery.ts source <output.json> | image <output.json> <image-reference>. Run from the matching source checkout.",
  );
// A failed validation must not leave an earlier success at this destination.
await rm(output, { force: true });
if (mode === "source" && process.platform !== "darwin")
  throw new Error(
    "Source isolation requires macOS sandbox-exec; use an isolated image on other hosts.",
  );

const config = {
  TRANSPORT: "stdio",
  LOG_LEVEL: "debug",
  TRELLO_API_KEY: "synthetic-glama-discovery-key",
  TRELLO_TOKEN: "synthetic-glama-discovery-token",
};
const expectedVersion = JSON.parse(
  await readFile(resolve("package.json"), "utf8"),
).version as string;
const container = `trello-mcp-65-${randomUUID()}`;
// Client settings select the operator's daemon; none are forwarded to the MCP
// process, container, or evidence. No Trello variables or NODE_OPTIONS are inherited.
const dockerEnv = dockerClientEnvironment(process.env);
const docker = async (args: string[]) =>
  (await exec("docker", args, { env: dockerEnv })).stdout;
// Resolve once before starting: a mutable tag can change while discovery runs.
// Inspect only identity fields; do not request image configuration values.
const imageEvidence =
  mode === "image"
    ? safeImageIdentity(
        JSON.parse(
          await docker([
            "image",
            "inspect",
            image as string,
            "--format",
            '{"Id":{{json .Id}},"Architecture":{{json .Architecture}},"Os":{{json .Os}}}',
          ]),
        ),
      )
    : undefined;
const command = mode === "source" ? "/usr/bin/sandbox-exec" : "docker";
const args =
  mode === "source"
    ? [
        "-p",
        "(version 1)(allow default)(deny network*)",
        process.execPath,
        resolve("dist/index.js"),
      ]
    : [
        "run",
        "-i",
        "--network=none",
        "--name",
        container,
        ...Object.entries(config).flatMap(([key, value]) => [
          "-e",
          `${key}=${value}`,
        ]),
        // Docker can inject proxies from client config even with an isolated
        // CLI environment. Clear both cases to exclude host proxy credentials.
        ...["http", "https", "ftp", "all", "no"].flatMap((name) => [
          "-e",
          `${name}_proxy=`,
          "-e",
          `${name.toUpperCase()}_PROXY=`,
        ]),
        imageEvidence?.Id as string,
      ];
const child = spawn(command, args, {
  env: mode === "source" ? config : dockerEnv,
  stdio: ["pipe", "pipe", "pipe"],
});
const buffer = new ReadBuffer();
const messages: JSONRPCMessage[] = [];
const stderrChunks: Buffer[] = [];
const stdoutChunks: Buffer[] = [];
let serialized = "";
let protocolError = false;
let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
const exited = new Promise<void>((done) =>
  child.once("close", (code, signal) => {
    exit = { code, signal };
    done();
  }),
);
const transport: Transport = {
  start: async () => {},
  send: discoveryWriter(child.stdin, (error) => {
    protocolError = true;
    transport.onerror?.(error);
  }),
  close: async () => {
    child.stdin.end();
  },
};
child.on("error", () => {
  protocolError = true;
  transport.onerror?.(new Error("Discovery child failed to start."));
});
child.stdout.on("data", (chunk: Buffer) => {
  stdoutChunks.push(chunk);
  try {
    buffer.append(chunk);
    for (
      let message = buffer.readMessage();
      message !== null;
      message = buffer.readMessage()
    ) {
      messages.push(message);
      transport.onmessage?.(message);
    }
  } catch {
    protocolError = true;
    transport.onerror?.(new Error("Non-protocol stdout during discovery."));
  }
});
child.stderr.on("data", (chunk: Buffer) => {
  stderrChunks.push(chunk);
});
child.on("close", () => transport.onclose?.());
const client = new Client({ name: "glama-readiness-check", version: "1" });
client.onerror = () => {
  protocolError = true;
};

try {
  await client.connect(transport, { timeout: 30_000 });
  const initialize = messages.flatMap((message) => {
    if (!("result" in message)) return [];
    const parsed = InitializeResultSchema.safeParse(message.result);
    return parsed.success ? [parsed.data] : [];
  });
  const initialization = initialize[0];
  if (initialize.length !== 1 || !initialization)
    throw new Error("Expected one initialize response.");
  assertMatchingInitialization(initialization, expectedVersion);
  const discovery = await inspectDiscovery(
    client,
    allTools.map(({ name, description, inputSchema }) =>
      ToolSchema.parse({
        name,
        description,
        // The SDK publishes this default for ordinary, non-task handlers.
        execution: { taskSupport: "forbidden" },
        inputSchema: z.toJSONSchema(inputSchema, {
          io: "input",
          target: "draft-7",
        }),
      }),
    ),
    expectedVersion,
  );
  let health: unknown;
  let filesystemChanges: string | undefined;
  if (mode === "image") {
    for (let attempt = 0; ; attempt++) {
      const rawHealth = await docker([
        "inspect",
        "--format",
        "{{json .State.Health}}",
        container,
      ]);
      assertNoSyntheticSecrets(rawHealth, [
        config.TRELLO_API_KEY,
        config.TRELLO_TOKEN,
      ]);
      const state = safeHealthEvidence(JSON.parse(rawHealth));
      if (state?.Status === "healthy") {
        health = state;
        break;
      }
      if (!state || state.Status === "unhealthy" || attempt >= 25)
        throw new Error("Image-defined stdio health did not pass.");
      await setTimeout(2_000);
    }
    filesystemChanges = await docker(["diff", container]);
    assertNoFilesystemChanges(filesystemChanges);
    await docker(["stop", "--time", "5", container]);
    filesystemChanges = await docker(["diff", container]);
    assertNoFilesystemChanges(filesystemChanges);
  } else child.kill("SIGTERM");
  await Promise.race([
    exited,
    setTimeout(10_000, undefined, { ref: false }).then(() => {
      if (!exit) throw new Error("Discovery child did not exit cleanly.");
    }),
  ]);
  await client.close();
  const stdout = validateProtocolStdout(Buffer.concat(stdoutChunks));
  const stderr = decodeDiscoveryStderr(stderrChunks);
  if (
    protocolError ||
    exit?.code !== 0 ||
    !stderr.text.includes("shutdown complete")
  )
    throw new Error("Discovery protocol or shutdown verification failed.");
  const evidence = {
    mode,
    transport: "stdio",
    environmentNames: Object.keys(config),
    ...(mode === "image"
      ? { dockerClientEnvironmentNames: Object.keys(dockerEnv) }
      : {}),
    expectedVersion,
    initialize: initialization,
    ...discovery,
    image: imageEvidence,
    health,
    filesystemChanges,
    stdoutProtocolOnly: !protocolError,
    stderr: { bytes: stderr.bytes, shutdownComplete: true },
    exit,
  };
  serialized = JSON.stringify(evidence, null, 2);
  assertNoSyntheticSecrets(serialized + stdout + stderr.text, [
    config.TRELLO_API_KEY,
    config.TRELLO_TOKEN,
  ]);
} finally {
  if (mode === "image") {
    await docker(["rm", "-f", container]);
  } else if (!exit) {
    child.kill("SIGKILL");
    await exited;
  }
}
if (
  mode === "image" &&
  (await docker(["ps", "-aq", "--filter", `name=^/${container}$`])).trim()
)
  throw new Error("Temporary discovery container remains.");
await writeFile(output, `${serialized}\n`);
console.log(
  `Offline ${mode} discovery passed: ${allTools.length} tools; full schemas saved; clean shutdown and cleanup.`,
);
