import {
  REPOSITORY_API_URL,
  REPOSITORY_URL,
} from "../../src/data/repository.js";
import {
  LEGACY_REDIRECTS,
  PRIMARY_NAVIGATION,
  PUBLIC_ROUTES,
} from "../support/site.js";
import {
  assertNoPageOverflow,
  expect,
  fulfillRepositoryMetadata,
  gotoLoaded,
  monitorBrowserProblems,
  test,
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
  await expect(page.locator(".hero [data-github-action]")).toHaveAttribute(
    "href",
    REPOSITORY_URL,
  );
});

test("homepage GitHub action renders, formats, and session-caches the star count", async ({
  page,
}) => {
  let requestCount = 0;
  let requestHeaders: Record<string, string> = {};
  await page.route(REPOSITORY_API_URL, async (route) => {
    requestCount += 1;
    requestHeaders = route.request().headers();
    await fulfillRepositoryMetadata(route);
  });

  await gotoLoaded(page, "/");

  const action = page.locator(".hero [data-github-action]");
  const count = action.locator("[data-repository-star-count]");
  await expect(action).toHaveAttribute("href", REPOSITORY_URL);
  await expect(action).toHaveAttribute("rel", "external");
  await expect(action).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(action).toHaveAccessibleName("View on GitHub, 1.2K stars");
  await expect(count).toHaveText("1.2K");
  await expect(count).toHaveAttribute("aria-hidden", "true");
  await expect(count.locator("svg")).toHaveAttribute("aria-hidden", "true");
  expect(requestHeaders).not.toHaveProperty("authorization");
  expect(requestHeaders).not.toHaveProperty("cookie");
  expect(requestHeaders).not.toHaveProperty("referer");

  let reachedAction = false;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await page.keyboard.press("Tab");
    reachedAction = await action.evaluate(
      (element) => document.activeElement === element,
    );
    if (reachedAction) break;
  }
  expect(reachedAction, "Tab must reach the GitHub action").toBe(true);
  expect(
    await action.evaluate(
      (element) => getComputedStyle(element).outlineStyle !== "none",
    ),
  ).toBe(true);

  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("trello-mcp:repository-star-count"),
    ),
  ).toBe("1234");
  await page.reload({ waitUntil: "networkidle" });
  await expect(action).toHaveAccessibleName("View on GitHub, 1.2K stars");
  await expect(count).toHaveText("1.2K");
  expect(requestCount).toBe(1);
});

test("homepage GitHub action silently falls back for unavailable repository metadata", async ({
  browser,
}) => {
  for (const scenario of [
    "non-2xx",
    "network",
    "malformed-json",
    "invalid-count",
  ] as const) {
    await test.step(scenario, async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      let requestCount = 0;
      const runtimeErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      await page.route(REPOSITORY_API_URL, async (route) => {
        requestCount += 1;
        if (scenario === "network") {
          await route.abort("failed");
        } else if (scenario === "non-2xx") {
          await fulfillRepositoryMetadata(
            route,
            { message: "rate limited" },
            429,
          );
        } else if (scenario === "malformed-json") {
          await fulfillRepositoryMetadata(route, "{");
        } else {
          await fulfillRepositoryMetadata(route, { stargazers_count: 1.5 });
        }
      });

      try {
        await gotoLoaded(page, "/");
        const action = page.locator(".hero [data-github-action]");
        await expect(action).toHaveAccessibleName("View on GitHub");
        await expect(action).toHaveAttribute("href", REPOSITORY_URL);
        await expect(
          action.locator("[data-repository-star-count]"),
        ).toHaveCount(0);
        expect(requestCount).toBe(1);
        expect(
          await page.evaluate(() =>
            sessionStorage.getItem("trello-mcp:repository-star-count"),
          ),
        ).toBe("attempted");
        await page.reload({ waitUntil: "networkidle" });
        await expect(action).toHaveAccessibleName("View on GitHub");
        await expect(
          action.locator("[data-repository-star-count]"),
        ).toHaveCount(0);
        expect(requestCount).toBe(1);
        const unexpectedErrors = runtimeErrors.filter((message) => {
          if (
            scenario === "non-2xx" &&
            message.includes("status of 429 (Too Many Requests)")
          ) {
            return false;
          }
          if (
            scenario === "network" &&
            message.includes("Failed to load resource: net::ERR_FAILED")
          ) {
            return false;
          }
          return true;
        });
        expect(unexpectedErrors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
});

test("homepage GitHub action remains useful without JavaScript or browser storage", async ({
  browser,
}) => {
  const noScriptContext = await browser.newContext({
    javaScriptEnabled: false,
  });
  const noScriptPage = await noScriptContext.newPage();
  let noScriptRequests = 0;
  await noScriptPage.route(REPOSITORY_API_URL, async (route) => {
    noScriptRequests += 1;
    await fulfillRepositoryMetadata(route);
  });

  try {
    const response = await noScriptPage.goto("/", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    const action = noScriptPage.locator(".hero [data-github-action]");
    await expect(action).toHaveAccessibleName("View on GitHub");
    await expect(action).toHaveAttribute("href", REPOSITORY_URL);
    await expect(action.locator("[data-repository-star-count]")).toHaveCount(0);
    expect(noScriptRequests).toBe(0);
  } finally {
    await noScriptContext.close();
  }

  const noStorageContext = await browser.newContext();
  await noStorageContext.addInitScript(() => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    });
  });
  const noStoragePage = await noStorageContext.newPage();
  let noStorageRequests = 0;
  await noStoragePage.route(REPOSITORY_API_URL, async (route) => {
    noStorageRequests += 1;
    await fulfillRepositoryMetadata(route);
  });

  try {
    await gotoLoaded(noStoragePage, "/");
    const action = noStoragePage.locator(".hero [data-github-action]");
    await expect(action).toHaveAccessibleName("View on GitHub");
    await expect(action).toHaveAttribute("href", REPOSITORY_URL);
    await expect(action.locator("[data-repository-star-count]")).toHaveCount(0);
    expect(noStorageRequests).toBe(0);
  } finally {
    await noStorageContext.close();
  }
});

test("homepage GitHub action records the attempt before a slow request settles", async ({
  page,
}) => {
  let requestCount = 0;
  let releaseResponse = () => {};
  let markRequestStarted = () => {};
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve;
  });
  await page.route(REPOSITORY_API_URL, async (route) => {
    requestCount += 1;
    markRequestStarted();
    await responseGate;
    try {
      await fulfillRepositoryMetadata(route);
    } catch {
      // Navigating away intentionally discards the in-flight request.
    }
  });

  try {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await requestStarted;
    expect(requestCount).toBe(1);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("trello-mcp:repository-star-count"),
      ),
    ).toBe("attempted");

    await page.goto("/getting-started/", { waitUntil: "domcontentloaded" });
    await gotoLoaded(page, "/");
    const action = page.locator(".hero [data-github-action]");
    await expect(action).toHaveAccessibleName("View on GitHub");
    await expect(action.locator("[data-repository-star-count]")).toHaveCount(0);
    expect(requestCount).toBe(1);
  } finally {
    releaseResponse();
  }
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
