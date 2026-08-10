import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse, { type Flags } from "lighthouse";
import { throttling, userAgents } from "lighthouse/core/config/constants.js";

const host = process.env.LIGHTHOUSE_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.LIGHTHOUSE_PORT ?? "4321", 10);
const configuredBaseUrl = process.env.LIGHTHOUSE_BASE_URL;
const baseUrl = (configuredBaseUrl ?? `http://${host}:${port}`).replace(
  /\/$/,
  "",
);
const reportDirectory = resolve("website/artifacts/lighthouse");
const routes = [
  { name: "home", path: "/" },
  { name: "get-started", path: "/get-started/" },
  { name: "get-started-docker", path: "/get-started/docker/" },
  { name: "get-started-http", path: "/get-started/http/" },
  { name: "get-started-stdio", path: "/get-started/stdio/" },
  { name: "trello-api-key", path: "/trello-api-key/" },
  { name: "clients", path: "/clients/" },
  { name: "clients-compatibility", path: "/clients/compatibility/" },
  { name: "how-it-works", path: "/concepts/how-it-works/" },
  { name: "workflows", path: "/guides/workflows/" },
  { name: "troubleshooting", path: "/guides/troubleshooting/" },
  { name: "configuration", path: "/reference/configuration/" },
  { name: "tools", path: "/tools/" },
  { name: "tools-api-coverage", path: "/tools/api-coverage/" },
  { name: "security", path: "/security/" },
  { name: "faq", path: "/faq/" },
  { name: "project", path: "/project/" },
] as const;
const minimumScores = {
  accessibility: 1,
  "best-practices": 1,
  performance: 0.95,
  seo: 1,
} as const;

function startPreview(): ChildProcess {
  return spawn(
    "corepack",
    ["pnpm", "site:preview", "--host", host, "--port", String(port)],
    {
      cwd: resolve("."),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

async function assertPreviewPortAvailable() {
  await new Promise<void>((resolveAvailable, rejectUnavailable) => {
    const probe = createServer();
    probe.once("error", (error) => {
      rejectUnavailable(
        new Error(
          `Cannot start a fresh Lighthouse preview on ${host}:${port}.`,
          { cause: error },
        ),
      );
    });
    probe.listen({ host, port }, () => {
      probe.close((error) => {
        if (error) rejectUnavailable(error);
        else resolveAvailable();
      });
    });
  });
}

async function waitForServer(url: string, preview?: ChildProcess) {
  const deadline = Date.now() + 30_000;
  let lastError = "preview did not respond";

  while (Date.now() < deadline) {
    if (preview?.exitCode !== null && preview?.exitCode !== undefined) {
      throw new Error(
        `Site preview exited before Lighthouse started (code ${preview.exitCode}).`,
      );
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function stopPreview(preview?: ChildProcess) {
  if (!preview || preview.exitCode !== null) return;
  preview.kill("SIGTERM");
  await new Promise<void>((resolveExit) => {
    const timeout = setTimeout(() => {
      preview.kill("SIGKILL");
      resolveExit();
    }, 5_000);
    preview.once("exit", () => {
      clearTimeout(timeout);
      resolveExit();
    });
  });
}

async function auditRoute(url: string) {
  const chrome = await launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
    chromePath: chromium.executablePath(),
  });

  try {
    const flags: Flags = {
      disableStorageReset: false,
      emulatedUserAgent: userAgents.desktop,
      formFactor: "desktop",
      logLevel: "error",
      onlyCategories: Object.keys(minimumScores),
      output: "html",
      port: chrome.port,
      screenEmulation: {
        deviceScaleFactor: 1,
        disabled: false,
        height: 900,
        mobile: false,
        width: 1440,
      },
      throttling: throttling.desktopDense4G,
      throttlingMethod: "simulate",
    };

    return await lighthouse(url, flags);
  } finally {
    chrome.kill();
  }
}

async function main() {
  await mkdir(reportDirectory, { recursive: true });
  if (!configuredBaseUrl) await assertPreviewPortAvailable();
  const preview = configuredBaseUrl ? undefined : startPreview();

  preview?.stdout?.on("data", () => undefined);
  preview?.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));

  try {
    await waitForServer(baseUrl, preview);
    const failures: string[] = [];
    const summaries: Array<{
      route: string;
      scores: Record<string, number | null>;
      url: string;
    }> = [];
    for (const route of routes) {
      const url = new URL(
        route.path.replace(/^\//, ""),
        `${baseUrl}/`,
      ).toString();
      const result = await auditRoute(url);
      if (!result) throw new Error(`Lighthouse returned no result for ${url}.`);

      const htmlReport = Array.isArray(result.report)
        ? result.report[0]
        : result.report;
      if (!htmlReport)
        throw new Error(
          `Lighthouse did not produce an HTML report for ${url}.`,
        );
      await writeFile(
        resolve(reportDirectory, `${route.name}.html`),
        htmlReport,
      );

      const scores = Object.fromEntries(
        Object.entries(minimumScores).map(([category, minimum]) => {
          const score = result.lhr.categories[category]?.score;
          if (typeof score !== "number") {
            failures.push(
              `${route.name}: ${category} did not return a numeric score`,
            );
            return [category, null];
          }
          if (score < minimum) {
            failures.push(
              `${route.name}: ${category} scored ${Math.round(score * 100)}, expected ${Math.round(
                minimum * 100,
              )}`,
            );
          }
          return [category, Math.round(score * 100)];
        }),
      );
      summaries.push({ route: route.name, scores, url });
      process.stdout.write(`${route.name}: ${JSON.stringify(scores)}\n`);
    }

    await writeFile(
      resolve(reportDirectory, "summary.json"),
      `${JSON.stringify({ minimumScores, results: summaries }, null, 2)}\n`,
    );

    if (failures.length > 0) {
      throw new Error(
        `Lighthouse score gates failed:\n- ${failures.join("\n- ")}`,
      );
    }
  } finally {
    await stopPreview(preview);
  }
}

await main();
