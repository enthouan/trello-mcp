import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const host = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const port = process.env.PLAYWRIGHT_PORT ?? "4321";
const localBaseUrl = `http://${host}:${port}`;
const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? localBaseUrl).replace(
  /\/$/,
  "",
);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const visualQa =
  process.env.VISUAL_QA === "1" ||
  process.argv.some((argument) => argument.endsWith("visual.spec.ts"));

export default defineConfig({
  testDir: "./tests",
  testMatch: visualQa ? ["visual.spec.ts"] : ["browser/**/*.spec.ts"],
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { open: "never", outputFolder: "./playwright-report" }],
      ]
    : [
        ["list"],
        ["html", { open: "never", outputFolder: "./playwright-report" }],
      ],
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    colorScheme: "light",
    locale: "en-US",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    ...(visualQa
      ? [
          {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : [
          {
            name: "chromium",
            testIgnore: /webkit-smoke\.spec\.ts$/,
            use: { ...devices["Desktop Chrome"] },
          },
          {
            name: "webkit-desktop-light",
            testMatch: /webkit-smoke\.spec\.ts$/,
            use: {
              ...devices["Desktop Safari"],
              colorScheme: "light" as const,
            },
          },
        ]),
  ],
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: `corepack pnpm website:preview --host ${host} --port ${port}`,
          cwd: repositoryRoot,
          reuseExistingServer: false,
          timeout: 120_000,
          url: localBaseUrl,
        },
      }),
});
