import AxeBuilder from "@axe-core/playwright";
import {
  COPY_FAILURE_MESSAGE,
  PUBLIC_ROUTES,
  RESPONSIVE_VIEWPORTS,
} from "../support/site.js";
import {
  assertNoPageOverflow,
  expect,
  gotoLoaded,
  monitorBrowserProblems,
  test,
} from "./support.js";

test("dark theme meets color contrast across every public route", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() =>
    localStorage.setItem("starlight-theme", "dark"),
  );

  for (const route of PUBLIC_ROUTES) {
    await test.step(route, async () => {
      await gotoLoaded(page, route);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      const accessibility = await new AxeBuilder({ page })
        .withRules(["color-contrast"])
        .analyze();
      expect(
        accessibility.violations,
        `${route} has dark-theme contrast violations`,
      ).toEqual([]);
    });
  }
});

test("skip link and focus indicators work from the keyboard", async ({
  page,
}) => {
  await gotoLoaded(page, "/getting-started/");
  const skipLink = page.getByRole("link", { name: /skip to content/i });
  await expect(skipLink).toHaveAttribute("href", "#_top");

  let visibleKeyboardTarget = false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.keyboard.press("Tab");
    visibleKeyboardTarget = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return false;
      const bounds = active.getBoundingClientRect();
      return (
        active.matches(":focus-visible") &&
        bounds.width > 0 &&
        bounds.height > 0
      );
    });
    if (visibleKeyboardTarget) break;
  }
  expect(visibleKeyboardTarget, "Tab must reach a visible focus target").toBe(
    true,
  );

  await skipLink.focus();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#_top$/);
  await expect(page.locator("#_top")).toBeInViewport();
});

test("code blocks receive focus and successful native copy feedback wins", async ({
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
  await page.setViewportSize({ width: 320, height: 568 });
  await gotoLoaded(page, "/getting-started/");
  await expect(
    page.locator("main .expressive-code pre:visible").first(),
  ).toHaveAttribute("tabindex", "0");
  await page
    .getByRole("tab", { name: "HTTP · published image", exact: true })
    .click();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("astro:page-load")),
  );

  const pre = page.locator("main .expressive-code pre:visible").first();
  await expect(pre).toHaveAttribute("tabindex", "0");
  await pre.focus();
  await expect(pre).toBeFocused();
  expect(
    await pre.evaluate((element) => getComputedStyle(element).overflowX),
  ).toMatch(/auto|scroll/);

  const copyButton = page
    .locator('main button[title*="copy" i]:visible, main .copy button:visible')
    .first();
  const source = await copyButton.getAttribute("data-code");
  expect(source).toBeTruthy();
  const expectedCopy = (source ?? "").replaceAll("\u007f", "\n");
  const liveRegion = copyButton.locator("xpath=..").locator("[aria-live]");
  await copyButton.click();
  await expect(liveRegion.getByText("Copied!", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              __trelloMcpClipboard?: string;
            }
          ).__trelloMcpClipboard ?? "",
      ),
    )
    .toBe(expectedCopy);
  await page.waitForTimeout(1_100);
  await expect(liveRegion).not.toContainText(COPY_FAILURE_MESSAGE);
  await expect(copyButton).not.toHaveAttribute("data-copy-error", "true");
  await assertNoPageOverflow(page, "narrow code blocks");
  expect(problems, "Copy interaction emitted browser errors").toEqual([]);
});

test("rejected clipboard writes announce one temporary failure after Astro navigation", async ({
  page,
}) => {
  const problems = monitorBrowserProblems(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Clipboard write rejected", "NotAllowedError");
        },
      },
    });
    Object.defineProperty(Document.prototype, "execCommand", {
      configurable: true,
      value: () => false,
    });
  });
  await gotoLoaded(page, "/getting-started/");

  const pre = page.locator("main .expressive-code pre:visible").first();
  await pre.evaluate((element) => element.removeAttribute("tabindex"));
  await page.evaluate(() => {
    document.dispatchEvent(new Event("astro:page-load"));
    document.dispatchEvent(new Event("astro:page-load"));
  });
  await expect(pre).toHaveAttribute("tabindex", "0");

  const copyButton = page
    .locator('main button[title*="copy" i]:visible, main .copy button:visible')
    .first();
  const liveRegion = copyButton.locator("xpath=..").locator("[aria-live]");
  await copyButton.click();
  const failure = liveRegion.locator(".feedback.copy-error");
  await expect(failure).toHaveCount(1);
  await expect(failure).toHaveText(COPY_FAILURE_MESSAGE);
  await expect(failure).toBeVisible();
  await expect(copyButton).toHaveAttribute("data-copy-error", "true");
  await expect(failure).toHaveCount(0, { timeout: 6_000 });
  await expect(copyButton).not.toHaveAttribute("data-copy-error", "true");
  expect(problems, "Rejected copy interaction emitted browser errors").toEqual(
    [],
  );
});

test("request-flow diagram is accessible, theme-aware, and scrolls internally", async ({
  page,
}) => {
  await gotoLoaded(page, "/guides/how-it-works/");
  const figure = page.locator("figure[data-request-flow]");
  await expect(
    figure.getByRole("img", { name: "How a trello-mcp tool call travels" }),
  ).toBeVisible();
  await expect(
    figure.getByRole("link", {
      name: "Open the full-size diagram",
      exact: true,
    }),
  ).toHaveAttribute("href", "/request-flow.svg");

  const themeColors: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    await page.locator("html").evaluate((element, value) => {
      element.dataset.theme = value;
    }, theme);
    themeColors.push(
      await figure
        .locator(".canvas")
        .evaluate((element) => getComputedStyle(element).fill),
    );
  }
  expect(new Set(themeColors).size).toBe(2);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await gotoLoaded(page, "/guides/how-it-works/");
    const region = page.getByRole("region", {
      name: "Trello MCP request flow diagram",
    });
    await expect(region).toHaveAttribute("tabindex", "0");
    const geometry = await region.evaluate((element) => ({
      clientWidth: element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
      scrollWidth: element.scrollWidth,
    }));
    expect(geometry.overflowX).toMatch(/auto|scroll/);
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    await assertNoPageOverflow(page, `request flow at ${viewport.width}px`);
    if (viewport.width === 320) {
      await region.focus();
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => region.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
    }
  }
});

test("reduced-motion preference suppresses nonessential motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoLoaded(page, "/");
  const motion = await page.evaluate(() => {
    const milliseconds = (value: string) =>
      value
        .split(",")
        .map((part) =>
          part.trim().endsWith("ms")
            ? Number.parseFloat(part)
            : Number.parseFloat(part) * 1_000,
        );
    return [...document.querySelectorAll("body *")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      })
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          Math.max(0, ...milliseconds(style.animationDuration)) > 1 ||
          Math.max(0, ...milliseconds(style.transitionDuration)) > 1
        );
      })
      .map((element) => element.tagName.toLowerCase());
  });
  expect(motion).toEqual([]);
});

test("mobile controls meet the WCAG 2.2 minimum touch-target size", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoLoaded(page, "/getting-started/");
  const menu = page.locator("starlight-menu-button").first();
  await menu.locator("button").click();
  const undersized = await page
    .locator(
      "button:visible, select:visible, summary:visible, nav a[href]:visible, a.sl-link-button:visible",
    )
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            height: bounds.height,
            label:
              element.getAttribute("aria-label") ?? element.textContent?.trim(),
            width: bounds.width,
          };
        })
        .filter(({ height, width }) => height < 24 || width < 24),
    );
  expect(undersized).toEqual([]);
});

test("all pages reflow at a 200%-zoom equivalent", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 720, height: 450 });
  for (const route of PUBLIC_ROUTES) {
    await gotoLoaded(page, route);
    await assertNoPageOverflow(page, `${route} at 200%-zoom equivalent`);
  }
});

test.describe("responsive horizontal overflow", () => {
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`${viewport.name} contains every public route`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      for (const route of PUBLIC_ROUTES) {
        await gotoLoaded(page, route);
        await assertNoPageOverflow(
          page,
          `${route} at ${viewport.width}×${viewport.height}`,
        );
      }
    });
  }
});
