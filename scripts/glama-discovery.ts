// Non-publishing evidence capture. Does not read .env or call any tool handler.
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  ReadBuffer,
  serializeMessage,
} from "@modelcontextprotocol/sdk/shared/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  InitializeResultSchema,
  type JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";
import { allTools } from "../src/trello/tools.js";
import {
  assertNoSyntheticSecrets,
  inspectDiscovery,
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
const dockerEnv = {
  PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
  // Docker needs its existing local socket/context configuration, never forwarded
  // into the container. No Trello variables or NODE_OPTIONS are inherited.
  ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
};
const docker = async (args: string[]) =>
  (await exec("docker", args, { env: dockerEnv })).stdout;
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
        image as string,
      ];
const child = spawn(command, args, {
  env: mode === "source" ? config : dockerEnv,
  stdio: ["pipe", "pipe", "pipe"],
});
const buffer = new ReadBuffer();
const messages: JSONRPCMessage[] = [];
let stderr = "";
let stdout = "";
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
  send: async (message) => {
    child.stdin.write(serializeMessage(message));
  },
  close: async () => {
    child.stdin.end();
  },
};
child.on("error", () => {
  protocolError = true;
  transport.onerror?.(new Error("Discovery child failed to start."));
});
child.stdout.on("data", (chunk: Buffer) => {
  stdout += chunk.toString();
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
  stderr += chunk.toString();
});
child.on("close", () => transport.onclose?.());
const client = new Client({ name: "glama-readiness-check", version: "1" });
client.onerror = () => {
  protocolError = true;
};

try {
  await client.connect(transport, { timeout: 30_000 });
  const discovery = await inspectDiscovery(
    client,
    allTools.map(({ name }) => name),
    expectedVersion,
  );
  const initialize = messages.flatMap((message) => {
    if (!("result" in message)) return [];
    const parsed = InitializeResultSchema.safeParse(message.result);
    return parsed.success ? [parsed.data] : [];
  });
  if (initialize.length !== 1)
    throw new Error("Expected one initialize response.");
  let imageEvidence: unknown;
  let health: unknown;
  let filesystemChanges: string | undefined;
  if (mode === "image") {
    imageEvidence = JSON.parse(
      await docker([
        "image",
        "inspect",
        image as string,
        "--format",
        "{{json .}}",
      ]),
    );
    for (let attempt = 0; ; attempt++) {
      const state = JSON.parse(
        await docker([
          "inspect",
          "--format",
          "{{json .State.Health}}",
          container,
        ]),
      );
      if (state?.Status === "healthy") {
        health = state;
        break;
      }
      if (!state || state.Status === "unhealthy" || attempt >= 25)
        throw new Error("Image-defined stdio health did not pass.");
      await setTimeout(2_000);
    }
    filesystemChanges = await docker(["diff", container]);
    await docker(["stop", "--time", "5", container]);
  } else child.kill("SIGTERM");
  await Promise.race([
    exited,
    setTimeout(10_000, undefined, { ref: false }).then(() => {
      if (!exit) throw new Error("Discovery child did not exit cleanly.");
    }),
  ]);
  await client.close();
  for (const line of stdout.trim().split("\n")) {
    // Also reject unterminated/trailing output that ReadBuffer has not consumed.
    try {
      if (JSON.parse(line).jsonrpc !== "2.0") protocolError = true;
    } catch {
      protocolError = true;
    }
  }
  if (
    protocolError ||
    exit?.code !== 0 ||
    !stderr.includes("shutdown complete")
  )
    throw new Error("Discovery protocol or shutdown verification failed.");
  const evidence = {
    mode,
    transport: "stdio",
    environmentNames: Object.keys(config),
    expectedVersion,
    initialize: initialize[0],
    ...discovery,
    image: imageEvidence,
    health,
    filesystemChanges,
    stdoutProtocolOnly: !protocolError,
    stderr,
    exit,
  };
  serialized = JSON.stringify(evidence, null, 2);
  assertNoSyntheticSecrets(serialized + stdout, [
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
