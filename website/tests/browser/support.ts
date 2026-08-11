import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Response } from "@playwright/test";

export function getClientPickerGrid(page: Page) {
  return page
    .locator("main .card-grid")
    .filter({ hasText: "Claude Desktop" })
    .filter({ hasText: "All compatibility evidence" })
    .first();
}

type BrowserProblem = {
  kind: "console" | "page" | "request" | "response";
  message: string;
};

export function monitorBrowserProblems(
  page: Page,
  options: {
    allowConsole?: (message: string) => boolean;
    allowResponse?: (response: Response) => boolean;
  } = {},
) {
  const problems: BrowserProblem[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" && !options.allowConsole?.(message.text())) {
      problems.push({ kind: "console", message: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    problems.push({ kind: "page", message: error.message });
  });
  page.on("requestfailed", (request) => {
    problems.push({
      kind: "request",
      message: `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`,
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !options.allowResponse?.(response)) {
      problems.push({
        kind: "response",
        message: `${response.status()} ${response.request().method()} ${response.url()}`,
      });
    }
  });

  return problems;
}

export async function gotoLoaded(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(
    response,
    `Navigation to ${route} did not return a response`,
  ).not.toBeNull();
  expect(
    response?.status(),
    `Navigation to ${route} did not succeed`,
  ).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  return response;
}

export async function assertNoPageOverflow(page: Page, context: string) {
  const dimensions = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(
    dimensions.documentScrollWidth,
    `${context} has document-level horizontal overflow: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  expect(
    dimensions.bodyScrollWidth,
    `${context} has body-level horizontal overflow: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

export async function assertHeadingAndLandmarkBasics(
  page: Page,
  route: string,
) {
  await expect(
    page.locator("main"),
    `${route} must have one main landmark`,
  ).toHaveCount(1);
  await expect(
    page.locator("header"),
    `${route} must have a page header`,
  ).toHaveCount(1);
  await expect(
    page.locator('header a[href="/"]'),
    `${route} must link back home`,
  ).toBeVisible();

  const headings = await page
    .locator("main :is(h1, h2, h3, h4, h5, h6)")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const style = getComputedStyle(node);
          return style.display !== "none" && style.visibility !== "hidden";
        })
        .map((node) => ({
          level: Number(node.tagName.slice(1)),
          text: node.textContent?.trim() ?? "",
        })),
    );

  expect(headings, `${route} must have a visible heading`).not.toHaveLength(0);
  expect(headings[0]?.level, `${route} must begin with an h1`).toBe(1);
  expect(
    headings.filter(({ level }) => level === 1),
    `${route} must have exactly one h1`,
  ).toHaveLength(1);
  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];
    expect(
      (current?.level ?? 6) - (previous?.level ?? 1),
      `${route} skips a heading level between “${previous?.text}” and “${current?.text}”`,
    ).toBeLessThanOrEqual(1);
  }
}

export async function assertNoSeriousAccessibilityViolations(
  page: Page,
  context: string,
) {
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const highImpactViolations = accessibility.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  );
  expect(
    highImpactViolations,
    `${context} has serious or critical accessibility violations:\n${JSON.stringify(highImpactViolations, null, 2)}`,
  ).toEqual([]);
}
