import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Response, test } from "@playwright/test";

const DISCLAIMER =
  "trello-mcp is an independent, community-maintained project. It is not an official Trello or Atlassian product, service, or MCP implementation, and it is not affiliated with, endorsed by, or sponsored by Trello or Atlassian.";
const OFFICIAL_ENDPOINT = "https://mcp.trello.com/v1";
const TRANSPORT_CHOOSER_ALT =
  "Transport chooser showing local stdio and service-oriented Streamable HTTP paths";

const publicRoutes = [
  "/",
  "/get-started/",
  "/clients/",
  "/clients/compatibility/",
  "/tools/",
  "/tools/api-coverage/",
  "/project/",
  "/404.html",
] as const;

const primaryNavigation = [
  ["Home", "/"],
  ["Get Started", "/get-started/"],
  ["Clients", "/clients/"],
  ["Tools", "/tools/"],
  ["Project", "/project/"],
] as const;

const responsiveViewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "ipad-portrait", width: 820, height: 1180 },
  { name: "ipad-landscape", width: 1180, height: 820 },
  { name: "mobile", width: 390, height: 844 },
  { name: "narrow-mobile", width: 360, height: 800 },
] as const;

type BrowserProblem = {
  kind: "console" | "page" | "request" | "response";
  message: string;
};

function monitorBrowserProblems(
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

async function gotoLoaded(page: Page, route: string) {
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

async function assertNoPageOverflow(page: Page, context: string) {
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

async function assertHeadingAndLandmarkBasics(page: Page, route: string) {
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
  if (route !== "/" && route !== "/404.html") {
    expect(
      await page.locator("nav").count(),
      `${route} must expose navigation`,
    ).toBeGreaterThan(0);
  }

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

test.describe("public production routes", () => {
  for (const route of publicRoutes) {
    test(`${route} renders without runtime or accessibility errors`, async ({
      page,
    }) => {
      const problems = monitorBrowserProblems(page);
      await gotoLoaded(page, route);

      await expect(page.locator("main")).toBeVisible();
      await assertNoPageOverflow(page, route);
      await assertHeadingAndLandmarkBasics(page, route);

      const images = await page.locator("img").evaluateAll((nodes) =>
        nodes.map((node) => {
          const image = node as HTMLImageElement;
          return {
            alt: image.getAttribute("alt"),
            complete: image.complete,
            naturalWidth: image.naturalWidth,
            src: image.currentSrc || image.src,
          };
        }),
      );
      expect(
        images.filter(({ alt }) => alt === null),
        `${route} contains images without alt attributes`,
      ).toEqual([]);
      expect(
        images.filter(
          ({ complete, naturalWidth }) => !complete || naturalWidth === 0,
        ),
        `${route} contains images that did not load`,
      ).toEqual([]);

      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const highImpactViolations = accessibility.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      );
      expect(
        highImpactViolations,
        `${route} has serious or critical accessibility violations:\n${JSON.stringify(
          highImpactViolations,
          null,
          2,
        )}`,
      ).toEqual([]);
      expect(problems, `${route} emitted browser errors`).toEqual([]);
    });
  }
});

test("required independent-project language and official alternative are exact", async ({
  page,
}) => {
  for (const route of ["/", "/get-started/", "/clients/"]) {
    await test.step(route, async () => {
      await gotoLoaded(page, route);
      const main = page.locator("main");
      await expect(main.getByText(DISCLAIMER, { exact: true })).toBeVisible();
      await expect(
        main.getByText(OFFICIAL_ENDPOINT, { exact: true }),
      ).toBeVisible();

      const officialLink = main
        .locator('a[href="https://trello.com/mcp"]')
        .first();
      await expect(officialLink).toBeVisible();
      await expect(officialLink).not.toHaveText("");
      await expect(officialLink).toHaveAttribute(
        "href",
        "https://trello.com/mcp",
      );
    });
  }
});

test("primary navigation reaches every top-level route", async ({ page }) => {
  for (const [label, route] of primaryNavigation) {
    await test.step(label, async () => {
      await gotoLoaded(page, "/get-started/");
      const link = page
        .locator(`#starlight__sidebar a[href="${route}"]:visible`)
        .first();
      await expect(
        link,
        `${label} must be visible in primary navigation`,
      ).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(
        new RegExp(`${route.replaceAll("/", "\\/")}(?:#.*)?$`),
      );
      await expect(page.locator("main h1")).toBeVisible();
    });
  }

  await gotoLoaded(page, "/");
  const githubLink = page
    .getByRole("link", { name: "View on GitHub", exact: true })
    .first();
  await expect(githubLink).toHaveAttribute(
    "href",
    "https://github.com/enthouan/trello-mcp",
  );
});

test("native mobile menu is keyboard operable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoLoaded(page, "/get-started/");

  const menu = page.locator("starlight-menu-button").first();
  const menuButton = menu.locator("button");
  await expect(menuButton).toBeVisible();
  await menuButton.focus();
  await expect(menuButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");

  const toolsLink = page
    .locator('#starlight__sidebar a[href="/tools/"]:visible')
    .first();
  await expect(toolsLink).toBeVisible();
  await toolsLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tools\/$/);
  await expect(page.locator("main h1")).toBeVisible();
});

test("native theme control applies and persists light and dark modes", async ({
  page,
}) => {
  await gotoLoaded(page, "/");
  const themeSelect = page
    .locator(
      'starlight-theme-select select:visible, select[name="theme"]:visible, select[aria-label*="theme" i]:visible',
    )
    .first();
  await expect(themeSelect).toBeVisible();

  for (const theme of ["dark", "light"] as const) {
    await themeSelect.selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  }
});

test("original site mark and blue accent load in both themes", async ({
  page,
  request,
}) => {
  await gotoLoaded(page, "/");

  const siteTitle = page.locator("header a.site-title").first();
  await expect(siteTitle).toBeVisible();
  await expect(siteTitle).toHaveAccessibleName("trello-mcp");
  const mark = siteTitle.locator("img");
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute("alt", "");
  await expect(mark).toHaveAttribute("width", "64");
  await expect(mark).toHaveAttribute("height", "64");

  const heroTitle = page.locator(".hero h1[data-page-title]");
  await expect(heroTitle).toBeVisible();
  await expect(heroTitle).toHaveAccessibleName("trello-mcp");
  const heroMark = heroTitle.locator(".hero-title-mark");
  await expect(heroMark).toBeVisible();
  await expect(heroMark).toHaveAttribute("src", "/favicon.svg");
  await expect(heroMark).toHaveAttribute("alt", "");
  await expect(heroMark).toHaveAttribute("aria-hidden", "true");
  await expect(heroMark).toHaveAttribute("width", "64");
  await expect(heroMark).toHaveAttribute("height", "64");
  const heroText = heroTitle.locator(".hero-title-text");
  await expect(heroText).toHaveText("trello-mcp");
  await expect(
    heroTitle.locator(".hero-title-mark + .hero-title-text"),
  ).toHaveCount(1);
  const [heroMarkBox, heroTextBox] = await Promise.all([
    heroMark.boundingBox(),
    heroText.boundingBox(),
  ]);
  expect(heroMarkBox).not.toBeNull();
  expect(heroTextBox).not.toBeNull();
  expect((heroMarkBox?.x ?? 0) + (heroMarkBox?.width ?? 0)).toBeLessThan(
    heroTextBox?.x ?? 0,
  );

  const markSource = await mark.getAttribute("src");
  expect(markSource, "Header mark must have a source").toBeTruthy();
  const markResponse = await request.get(markSource ?? "", {
    failOnStatusCode: false,
  });
  expect(markResponse.status(), "Header mark must resolve").toBe(200);
  expect(markResponse.headers()["content-type"]).toContain("image/svg+xml");

  const favicon = page.locator('link[rel="shortcut icon"]');
  await expect(favicon).toHaveAttribute("href", "/favicon.svg?v=split-card");
  const faviconHref = await favicon.getAttribute("href");
  const faviconResponse = await request.get(faviconHref ?? "", {
    failOnStatusCode: false,
  });
  expect(faviconResponse.status(), "Favicon must resolve").toBe(200);
  const faviconSource = (await faviconResponse.text()).toLowerCase();
  expect(faviconSource).toContain("trello-mcp split-card mark");
  expect(faviconSource).toContain("#0052cc");
  expect(faviconSource).not.toContain("lineargradient");
  expect(faviconSource.match(/<rect\b/g)).toHaveLength(3);
  expect(faviconSource.match(/fill="#fff"/g)).toHaveLength(2);
  expect(faviconSource).not.toContain("<path");
  expect(faviconSource).not.toContain("<circle");

  for (const [theme, expectedAccent] of [
    ["light", "rgb(0, 82, 204)"],
    ["dark", "rgb(87, 157, 255)"],
  ] as const) {
    await test.step(theme, async () => {
      await page.locator("html").evaluate((element, selectedTheme) => {
        element.dataset.theme = selectedTheme;
      }, theme);
      const accent = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--sl-color-accent)";
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      });
      expect(accent).toBe(expectedAccent);
    });
  }
});

test("dark theme meets color contrast across every public route", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("starlight-theme", "dark");
  });

  for (const route of publicRoutes) {
    await test.step(route, async () => {
      await gotoLoaded(page, route);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      const accessibility = await new AxeBuilder({ page })
        .withRules(["color-contrast"])
        .analyze();
      expect(
        accessibility.violations,
        `${route} has dark-theme color contrast violations:\n${JSON.stringify(
          accessibility.violations,
          null,
          2,
        )}`,
      ).toEqual([]);
    });
  }
});

test("production Pagefind search returns a tool result", async ({ page }) => {
  const problems = monitorBrowserProblems(page);
  await gotoLoaded(page, "/");
  const searchButton = page
    .locator(
      'site-search button:visible, button[data-open-modal]:visible, button[aria-label*="search" i]:visible',
    )
    .first();
  await expect(searchButton).toBeVisible();
  await searchButton.click();

  await expect(
    page.locator('dialog[open], [role="dialog"]:visible').first(),
  ).toBeVisible();
  const searchInput = page
    .locator(".pagefind-ui__search-input:visible")
    .first();
  await expect(searchInput).toBeFocused();
  await searchInput.fill("card_create");

  const result = page
    .locator(
      ".pagefind-ui__result-link:visible, [data-pagefind-ui] a[href]:visible",
    )
    .first();
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("href", /\/tools\//);
  await result.click();
  await expect(page).toHaveURL(/\/tools\//);
  await page.waitForLoadState("networkidle");
  expect(problems, "Pagefind search emitted browser errors").toEqual([]);
});

test("all internal links and images resolve", async ({
  page,
  request,
  baseURL,
}) => {
  expect(baseURL, "Playwright baseURL must be configured").toBeTruthy();
  const base = new URL(baseURL ?? "http://127.0.0.1:4321");
  const internalUrls = new Set<string>();

  for (const route of publicRoutes) {
    await test.step(`collect ${route}`, async () => {
      await gotoLoaded(page, route);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) =>
          links.map((link) => (link as HTMLAnchorElement).href),
        );

      for (const href of hrefs) {
        const url = new URL(href);
        if (url.origin === base.origin) {
          url.hash = "";
          internalUrls.add(url.toString());
        }
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
        `${route} contains broken same-page fragments`,
      ).toEqual([]);
    });
  }

  for (const url of internalUrls) {
    await test.step(url, async () => {
      const response = await request.get(url, { failOnStatusCode: false });
      expect(
        response.status(),
        `${url} returned ${response.status()}`,
      ).toBeLessThan(400);
    });
  }
});

test("the Starlight 404 is explicit and unknown routes return 404", async ({
  page,
}) => {
  const missingPath = "/this-page-intentionally-does-not-exist";
  const problems = monitorBrowserProblems(page, {
    allowConsole: (message) =>
      message ===
      "Failed to load resource: the server responded with a status of 404 (Not Found)",
    allowResponse: (response) =>
      response.status() === 404 &&
      new URL(response.url()).pathname === missingPath,
  });

  await gotoLoaded(page, "/404.html");
  await expect(page.locator("main h1")).toHaveText("404");
  await expect(page.locator("main")).toContainText(/page not found/i);
  await expect(page.locator('header a[href="/"]')).toBeVisible();

  const response = await page.goto(missingPath, { waitUntil: "networkidle" });

  expect(response?.status()).toBe(404);
  await expect(page.locator("body")).toContainText(/not found/i);
  const unexpectedProblems = problems.filter(
    ({ kind, message }) =>
      kind !== "console" ||
      !/^Failed to load resource:.*404 \(Not Found\)$/.test(message),
  );
  expect(
    unexpectedProblems,
    "404 page emitted unexpected browser errors",
  ).toEqual([]);
});

test("skip link and focus indicators work from the keyboard", async ({
  page,
}) => {
  await gotoLoaded(page, "/get-started/");
  const skipLink = page.getByRole("link", { name: /skip to content/i });

  await expect(skipLink).toHaveAttribute("href", "#_top");

  let keyboardFocus: {
    focusVisible: boolean;
    height: number;
    width: number;
  } | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.keyboard.press("Tab");
    const candidate = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return null;
      const bounds = active.getBoundingClientRect();
      return {
        focusVisible: active.matches(":focus-visible"),
        height: bounds.height,
        width: bounds.width,
      };
    });
    if (
      candidate?.focusVisible &&
      candidate.height > 0 &&
      candidate.width > 0
    ) {
      keyboardFocus = candidate;
      break;
    }
  }
  expect(keyboardFocus, "Tab must reach a visible focus target").not.toBeNull();

  await skipLink.focus();
  await expect(skipLink).toBeVisible();
  await expect(skipLink).toBeFocused();
  const skipTarget = await skipLink.getAttribute("href");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${skipTarget}$`));
  await expect(page.locator(skipTarget ?? "#_top")).toBeInViewport();
});

test("code blocks copy successfully and contain their own overflow", async ({
  page,
}) => {
  const problems = monitorBrowserProblems(page);
  await page.addInitScript(() => {
    const state = { value: "" };
    Object.defineProperty(globalThis, "__trelloMcpClipboard", {
      configurable: true,
      get: () => state.value,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          state.value = value;
        },
      },
    });
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoLoaded(page, "/get-started/");

  const codeBlocks = page.locator("main pre");
  expect(await codeBlocks.count()).toBeGreaterThan(0);
  const codeGeometry = await codeBlocks.evaluateAll((blocks) =>
    blocks.map((block) => {
      const bounds = block.getBoundingClientRect();
      return {
        clientWidth: block.clientWidth,
        left: bounds.left,
        overflowX: getComputedStyle(block).overflowX,
        right: bounds.right,
        scrollWidth: block.scrollWidth,
      };
    }),
  );
  for (const geometry of codeGeometry) {
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(361);
    expect(["auto", "scroll"]).toContain(geometry.overflowX);
    expect(geometry.scrollWidth).toBeGreaterThanOrEqual(geometry.clientWidth);
  }
  await assertNoPageOverflow(page, "narrow Get Started code blocks");

  const copyButton = page
    .locator(
      'main button[title*="copy" i]:visible, main button[aria-label*="copy" i]:visible, main .copy button:visible',
    )
    .first();
  await expect(copyButton).toBeVisible();
  const source = (await codeBlocks.first().innerText()).trim();
  await copyButton.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (globalThis as typeof globalThis & { __trelloMcpClipboard?: string })
            .__trelloMcpClipboard ?? "",
      ),
    )
    .toContain(source);
  expect(problems, "Copy interaction emitted browser errors").toEqual([]);
});

test("transport chooser stays legible and scrolls internally when present", async ({
  page,
  request,
}) => {
  const assetResponse = await request.get("/transport-chooser.svg", {
    failOnStatusCode: false,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoLoaded(page, "/clients/");

  const figure = page.locator("figure[data-transport-chooser]");
  if (assetResponse.status() === 404) {
    await expect(figure).toHaveCount(0);
    return;
  }

  expect(assetResponse.status(), "Transport chooser asset must resolve").toBe(
    200,
  );
  expect(assetResponse.headers()["content-type"]).toContain("image/svg+xml");

  await expect(figure).toBeVisible();
  const image = figure.getByRole("img", { name: TRANSPORT_CHOOSER_ALT });
  await expect(image).toHaveAttribute("src", "/transport-chooser.svg");
  await expect(image).toHaveAttribute("width", "1200");
  await expect(image).toHaveAttribute("height", "600");

  const caption = figure.locator("figcaption");
  await expect(caption).toContainText(
    "Scroll horizontally when needed to compare both paths.",
  );
  const fullSizeLink = caption.getByRole("link", {
    name: "Open the full-size diagram",
    exact: true,
  });
  await expect(fullSizeLink).toHaveAttribute("href", "/transport-chooser.svg");
  const fullSizeResponse = await request.get(
    (await fullSizeLink.getAttribute("href")) ?? "",
    { failOnStatusCode: false },
  );
  expect(fullSizeResponse.status(), "Full-size chooser link must resolve").toBe(
    200,
  );

  for (const viewport of [
    { width: 1440, height: 900, scrolls: false },
    { width: 1180, height: 820, scrolls: false },
    { width: 820, height: 1180, scrolls: true },
    { width: 390, height: 844, scrolls: true },
    { width: 360, height: 800, scrolls: true },
  ]) {
    await test.step(`${viewport.width}px`, async () => {
      await page.setViewportSize(viewport);
      await gotoLoaded(page, "/clients/");

      const scrollRegion = page.getByRole("region", {
        name: "Transport chooser diagram",
      });
      await expect(scrollRegion).toBeVisible();
      await expect(scrollRegion).toHaveAttribute("tabindex", "0");
      const geometry = await scrollRegion.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const chooserImage = element.querySelector("img");
        return {
          clientWidth: element.clientWidth,
          imageWidth: chooserImage?.getBoundingClientRect().width ?? 0,
          left: bounds.left,
          overflowX: getComputedStyle(element).overflowX,
          right: bounds.right,
          scrollWidth: element.scrollWidth,
        };
      });

      expect(["auto", "scroll"]).toContain(geometry.overflowX);
      if (viewport.scrolls) {
        expect(geometry.imageWidth).toBeGreaterThanOrEqual(1023);
        expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
      } else {
        expect(geometry.imageWidth).toBeLessThanOrEqual(
          geometry.clientWidth + 1,
        );
        expect(geometry.scrollWidth).toBeLessThanOrEqual(
          geometry.clientWidth + 1,
        );
      }
      expect(geometry.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(viewport.width + 1);
      await assertNoPageOverflow(
        page,
        `transport chooser at ${viewport.width}px`,
      );

      if (viewport.scrolls) {
        await scrollRegion.evaluate((element) => {
          element.scrollLeft = 0;
        });
        await scrollRegion.focus();
        await expect(scrollRegion).toBeFocused();
        await page.keyboard.press("ArrowRight");
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              );
            }),
        );
        if (
          (await scrollRegion.evaluate((element) => element.scrollLeft)) === 0
        ) {
          await page.keyboard.press("Alt+ArrowRight");
        }
        await expect
          .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0);
      }
    });
  }
});

test("mobile tool catalog keeps its table internally scrollable and keyboard operable", async ({
  page,
}) => {
  for (const width of [390, 360]) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await gotoLoaded(page, "/tools/");

      const table = page.locator("main table").first();
      await expect(table).toBeVisible();
      await expect(table).toHaveAttribute("tabindex", "0");
      await expect(table.locator("thead th")).toHaveText([
        "Name",
        "When to use",
        "Key inputs",
      ]);

      const geometry = await table.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          clientWidth: element.clientWidth,
          left: bounds.left,
          overflowX: getComputedStyle(element).overflowX,
          right: bounds.right,
          scrollWidth: element.scrollWidth,
        };
      });
      expect(["auto", "scroll"]).toContain(geometry.overflowX);
      expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
      expect(geometry.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(width + 1);
      await assertNoPageOverflow(page, `tool table at ${width}px`);

      await table.evaluate((element) => {
        element.scrollLeft = 0;
      });
      await table.focus();
      await expect(table).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      if ((await table.evaluate((element) => element.scrollLeft)) === 0) {
        // Safari also documents Option+Arrow as its larger directional scroll.
        await page.keyboard.press("Alt+ArrowRight");
      }
      await expect
        .poll(() => table.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);

      await table.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      const lastHeaderExposure = await table.evaluate((element) => {
        const tableBounds = element.getBoundingClientRect();
        const lastHeader = element.querySelector("thead th:last-child");
        if (!lastHeader) return 0;
        const headerBounds = lastHeader.getBoundingClientRect();
        return Math.max(
          0,
          Math.min(tableBounds.right, headerBounds.right) -
            Math.max(tableBounds.left, headerBounds.left),
        );
      });
      expect(lastHeaderExposure).toBeGreaterThan(24);
    });
  }
});

test("reduced-motion preference suppresses nonessential motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoLoaded(page, "/");

  const motion = await page.evaluate(() => {
    const parseDuration = (value: string) =>
      value
        .split(",")
        .map((part) => part.trim())
        .map((part) =>
          part.endsWith("ms")
            ? Number.parseFloat(part)
            : Number.parseFloat(part) * 1000,
        )
        .filter(Number.isFinite);
    const movingElements = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0;
      })
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          animation: style.animationName,
          animationDuration: Math.max(
            0,
            ...parseDuration(style.animationDuration),
          ),
          element: element.tagName.toLowerCase(),
          transitionDuration: Math.max(
            0,
            ...parseDuration(style.transitionDuration),
          ),
        };
      })
      .filter(
        ({ animation, animationDuration, transitionDuration }) =>
          (animation !== "none" && animationDuration > 1) ||
          transitionDuration > 1,
      );

    return {
      matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
      movingElements,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    };
  });

  expect(motion.matches).toBe(true);
  expect(motion.scrollBehavior).not.toBe("smooth");
  expect(
    motion.movingElements,
    "Reduced motion leaves animated visible elements",
  ).toEqual([]);
});

test("mobile controls meet the WCAG 2.2 minimum touch-target size", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoLoaded(page, "/get-started/");

  const menu = page.locator("starlight-menu-button").first();
  await menu.locator("button").click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");

  const undersizedTargets = await page
    .locator(
      "button:visible, select:visible, summary:visible, nav a[href]:visible, a.sl-link-button:visible",
    )
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            height: Math.round(bounds.height * 10) / 10,
            label:
              element.getAttribute("aria-label") ??
              element.textContent?.trim().slice(0, 80) ??
              "",
            tag: element.tagName.toLowerCase(),
            width: Math.round(bounds.width * 10) / 10,
          };
        })
        .filter(({ height, width }) => height < 24 || width < 24),
    );

  expect(
    undersizedTargets,
    `Mobile controls smaller than 24×24 CSS pixels: ${JSON.stringify(undersizedTargets, null, 2)}`,
  ).toEqual([]);
});

test("pages reflow without horizontal overflow at a 200% zoom equivalent", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // At 200% browser zoom, a 1440×900 display exposes roughly a 720×450 CSS-pixel
  // viewport. Using that viewport is portable across Chromium and WebKit, unlike
  // engine-private zoom controls, and exercises the same responsive reflow.
  await page.setViewportSize({ width: 720, height: 450 });

  for (const route of publicRoutes) {
    await test.step(route, async () => {
      await gotoLoaded(page, route);
      await expect(page.locator("main h1")).toBeVisible();
      await assertNoPageOverflow(page, `${route} at a 200% zoom equivalent`);
    });
  }
});

test.describe("responsive horizontal overflow", () => {
  for (const viewport of responsiveViewports) {
    test(`${viewport.name} contains every public route`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);

      for (const route of publicRoutes) {
        await test.step(route, async () => {
          await gotoLoaded(page, route);
          await assertNoPageOverflow(
            page,
            `${route} at ${viewport.width}×${viewport.height}`,
          );
        });
      }
    });
  }
});
