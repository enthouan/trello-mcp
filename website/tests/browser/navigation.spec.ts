import { expect, test } from "@playwright/test";
import { REPOSITORY_URL } from "../../src/data/repository.js";
import {
  LEGACY_REDIRECTS,
  PRIMARY_NAVIGATION,
  PUBLIC_ROUTES,
} from "../support/site.js";
import {
  assertNoPageOverflow,
  gotoLoaded,
  monitorBrowserProblems,
} from "./support.js";

test("onboarding tabs support selection, synchronization, icons, and deep links", async ({
  page,
}) => {
  await gotoLoaded(page, "/getting-started/");
  const clientTabs = page.locator(
    'main starlight-tabs[data-sync-key="mcp-client"]',
  );
  const expectedClients = [
    ["Codex", "openai", "codex"],
    ["Claude Code", "claude", "claude-code"],
    ["Claude Desktop", "claude", "claude-desktop"],
    ["VS Code", "vscode", "vscode"],
    ["OpenCode", "opencode", "opencode"],
  ] as const;
  await expect(clientTabs.getByRole("tab")).toHaveText(
    expectedClients.map(([label]) => label),
  );
  for (const [index, [, icon]] of expectedClients.entries()) {
    const tab = clientTabs.getByRole("tab").nth(index);
    await expect(tab).toHaveAttribute("data-client-icon", icon);
    const mask = await tab.evaluate((element) => {
      const styles = getComputedStyle(element, "::before");
      return styles.getPropertyValue("-webkit-mask-image") || styles.maskImage;
    });
    expect(mask).toContain("data:image/svg+xml");
  }
  const tabGeometry = await clientTabs.getByRole("tab").evaluateAll((tabs) => {
    const tabList = tabs[0]?.closest<HTMLElement>('[role="tablist"]');
    return {
      clientWidth: tabList?.clientWidth ?? 0,
      scrollWidth: tabList?.scrollWidth ?? Number.POSITIVE_INFINITY,
      tops: tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)),
    };
  });
  expect(new Set(tabGeometry.tops).size).toBe(1);
  expect(tabGeometry.scrollWidth).toBeLessThanOrEqual(
    tabGeometry.clientWidth + 1,
  );

  const installTabs = page.locator(
    'main starlight-tabs[data-sync-key="install-method"]',
  );
  await expect(installTabs.getByRole("tab")).toHaveText([
    "Local stdio",
    "HTTP · published image",
    "HTTP · source build",
  ]);
  for (const label of [
    "Local stdio",
    "HTTP · published image",
    "HTTP · source build",
  ]) {
    await installTabs.getByRole("tab", { name: label, exact: true }).click();
    await expect(
      installTabs.locator(":scope > [role='tabpanel']:not([hidden])"),
    ).toBeVisible();
  }

  for (const [label, , hash] of expectedClients) {
    await page.goto(`/getting-started/#${hash}`, { waitUntil: "networkidle" });
    await expect(
      page.locator(
        'main starlight-tabs[data-sync-key="mcp-client"] [role="tab"][aria-selected="true"]',
      ),
    ).toHaveText(label);
  }

  await gotoLoaded(page, "/getting-started/clients/");
  for (const [label, id] of [
    ["Codex", "codex"],
    ["Claude Code", "claude-code"],
    ["Claude Desktop", "claude-desktop"],
    ["VS Code", "vs-code"],
    ["OpenCode", "opencode"],
    ["MCP Inspector and manual clients", "mcp-inspector-and-manual-clients"],
  ] as const) {
    await expect(
      page.getByRole("heading", { level: 2, name: label, exact: true }),
    ).toHaveAttribute("id", id);
  }

  const transportTabs = page.locator(
    'main starlight-tabs[data-sync-key="client-transport"]',
  );
  await expect(transportTabs).toHaveCount(5);
  await transportTabs
    .first()
    .getByRole("tab", { name: "Streamable HTTP", exact: true })
    .click();
  for (const tabs of await transportTabs.all()) {
    await expect(
      tabs.getByRole("tab", { name: "Streamable HTTP", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  }
  expect(
    await page.evaluate(() =>
      localStorage.getItem("starlight-synced-tabs__client-transport"),
    ),
  ).toBe("Streamable HTTP");
  await page.reload({ waitUntil: "networkidle" });
  await expect(
    page.locator(
      'main starlight-tabs[data-sync-key="client-transport"] [role="tab"][aria-selected="true"]',
    ),
  ).toHaveText(Array.from({ length: 5 }, () => "Streamable HTTP"));
});

test("onboarding remains usable without client-side enhancement", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    const response = await page.goto("/getting-started/", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    const setups = page.locator("[data-client-setups]");
    await expect(
      setups.locator(':scope > starlight-tabs[data-sync-key="mcp-client"]'),
    ).toBeHidden();
    const fallbacks = setups.locator('section[aria-labelledby^="no-script-"]');
    await expect(fallbacks).toHaveCount(5);
    await expect(fallbacks.locator("h3[id^='no-script-']")).toHaveText([
      "Codex",
      "Claude Code",
      "Claude Desktop",
      "VS Code",
      "OpenCode",
    ]);
    const guides = page.getByRole("navigation", {
      name: "Installation guides without JavaScript",
    });
    for (const [label, href] of [
      ["local stdio", "/getting-started/stdio/"],
      ["published-image HTTP", "/getting-started/docker/"],
      ["source-built HTTP", "/getting-started/http/"],
    ] as const) {
      await expect(
        guides.getByRole("link", { name: label, exact: true }),
      ).toHaveAttribute("href", href);
    }
  } finally {
    await context.close();
  }
});

test("primary navigation reaches every public documentation section", async ({
  page,
}) => {
  for (const [label, route] of PRIMARY_NAVIGATION) {
    await test.step(label, async () => {
      await gotoLoaded(page, "/getting-started/");
      const link = page
        .locator(`#starlight__sidebar a[href="${route}"]:visible`)
        .first();
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(
        new RegExp(`${route.replaceAll("/", "\\/")}(?:#.*)?$`),
      );
      await expect(page.locator("main h1")).toBeVisible();
    });
  }
  await gotoLoaded(page, "/");
  await expect(
    page.getByRole("link", { name: "View on GitHub", exact: true }),
  ).toHaveAttribute("href", REPOSITORY_URL);
});

test("legacy routes navigate to their canonical destinations", async ({
  page,
}) => {
  for (const [legacyRoute, canonicalRoute, heading] of LEGACY_REDIRECTS) {
    await page.goto(`${legacyRoute}/`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(
      new RegExp(`${canonicalRoute.replaceAll("/", "\\/")}$`),
    );
    await expect(page.locator("main h1")).toHaveText(heading);
  }
});

test("mobile menu is keyboard operable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoLoaded(page, "/getting-started/");

  const menu = page.locator("starlight-menu-button").first();
  const button = menu.locator("button");
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  const toolsLink = page
    .locator('#starlight__sidebar a[href="/reference/tools/"]:visible')
    .first();
  await toolsLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/reference\/tools\/$/);
});

test("theme selection persists across navigation and reload", async ({
  page,
}) => {
  await gotoLoaded(page, "/");
  const themeSelect = page
    .locator(
      'starlight-theme-select select:visible, select[aria-label*="theme" i]:visible',
    )
    .first();
  await expect(themeSelect).toBeVisible();

  for (const theme of ["dark", "light"] as const) {
    await themeSelect.selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.getByRole("link", { name: "Get started", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await gotoLoaded(page, "/");
  }
});

test("Pagefind returns a tool result", async ({ page }) => {
  const problems = monitorBrowserProblems(page);
  await gotoLoaded(page, "/");
  const searchButton = page
    .locator("site-search button:visible, button[data-open-modal]:visible")
    .first();
  await searchButton.click();
  const searchInput = page
    .locator(".pagefind-ui__search-input:visible")
    .first();
  await expect(searchInput).toBeFocused();
  await searchInput.fill("card_create");
  const result = page
    .locator('.pagefind-ui__result-link[href^="/reference/tools/"]:visible')
    .first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/reference\/tools\//);
  expect(problems, "Pagefind emitted browser errors").toEqual([]);
});

test("all internal links, fragments, and runtime assets resolve", async ({
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(120_000);
  expect(baseURL).toBeTruthy();
  const base = new URL(baseURL ?? "http://127.0.0.1:4321");
  const internalFragments = new Set<string>();
  const internalUrls = new Set<string>();
  const assetUrls = new Set<string>();
  const obsoletePaths = new Set(LEGACY_REDIRECTS.map(([route]) => `${route}/`));

  for (const route of PUBLIC_ROUTES) {
    await test.step(`collect ${route}`, async () => {
      await gotoLoaded(page, route);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) =>
          links.map((link) => (link as HTMLAnchorElement).href),
        );
      for (const href of hrefs) {
        const url = new URL(href);
        if (url.origin !== base.origin) continue;
        expect(
          obsoletePaths.has(url.pathname),
          `${route} links to ${url.pathname}`,
        ).toBe(false);
        if (url.hash) internalFragments.add(url.toString());
        url.hash = "";
        internalUrls.add(url.toString());
      }

      const assets = await page
        .locator(
          'img[src], script[src], source[src], link[rel="stylesheet"][href]',
        )
        .evaluateAll((elements) =>
          elements.flatMap((element) => {
            const value =
              element.getAttribute("src") ?? element.getAttribute("href");
            return value ? [new URL(value, document.baseURI).href] : [];
          }),
        );
      for (const asset of assets) {
        if (new URL(asset).origin === base.origin) assetUrls.add(asset);
      }

      const missingLocalFragments = await page
        .locator('a[href^="#"]')
        .evaluateAll((links) =>
          links
            .map((link) => (link as HTMLAnchorElement).hash.slice(1))
            .filter(Boolean)
            .filter((id) => !document.getElementById(decodeURIComponent(id))),
        );
      expect(
        missingLocalFragments,
        `${route} has broken local fragments`,
      ).toEqual([]);
    });
  }

  for (const url of new Set([...internalUrls, ...assetUrls])) {
    const response = await request.get(url, { failOnStatusCode: false });
    expect(
      response.status(),
      `${url} returned ${response.status()}`,
    ).toBeLessThan(400);
  }
  for (const url of internalFragments) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    expect(
      await page.evaluate(() => {
        const id = decodeURIComponent(location.hash.slice(1));
        return Boolean(id && document.getElementById(id));
      }),
      `${url} points to a missing fragment`,
    ).toBe(true);
  }
});

test("unknown routes return a real 404 page", async ({ page }) => {
  const missingPath = "/this-page-intentionally-does-not-exist";
  const problems = monitorBrowserProblems(page, {
    allowConsole: (message) => message.includes("404 (Not Found)"),
    allowResponse: (response) =>
      response.status() === 404 &&
      new URL(response.url()).pathname === missingPath,
  });

  await gotoLoaded(page, "/404.html");
  await expect(page.locator("main h1")).toHaveText("404");
  await expect(page.locator("main")).toContainText(/page not found/i);

  const response = await page.goto(missingPath, { waitUntil: "networkidle" });
  expect(response?.status()).toBe(404);
  await expect(page.locator("body")).toContainText(/not found/i);
  expect(
    problems.filter(({ kind }) => kind !== "console"),
    "404 emitted errors",
  ).toEqual([]);
  await assertNoPageOverflow(page, "real 404 response");
});
