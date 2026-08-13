import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test } from "./browser/support.js";

const routes = [
  { name: "home", path: "/" },
  { name: "getting-started", path: "/getting-started/" },
  { name: "clients", path: "/getting-started/clients/" },
  { name: "how-it-works", path: "/guides/how-it-works/" },
  { name: "tools", path: "/reference/tools/" },
] as const;

const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

test.describe("responsive visual QA matrix", () => {
  for (const viewport of viewports) {
    for (const theme of ["light", "dark"] as const) {
      for (const route of routes) {
        test(`${route.name} · ${theme} · ${viewport.name}`, async ({
          page,
        }, testInfo) => {
          await page.setViewportSize(viewport);
          await page.emulateMedia({ colorScheme: theme });
          await page.addInitScript((selectedTheme) => {
            localStorage.setItem("starlight-theme", selectedTheme);
          }, theme);
          await page.goto(route.path, { waitUntil: "networkidle" });
          await page.evaluate(() => document.fonts.ready);
          await page.locator("img").evaluateAll(async (images) => {
            await Promise.all(
              images.map(async (node) => {
                const image = node as HTMLImageElement;
                if (!image.complete) {
                  await new Promise<void>((resolve, reject) => {
                    image.addEventListener("load", () => resolve(), {
                      once: true,
                    });
                    image.addEventListener(
                      "error",
                      () =>
                        reject(new Error(`Image failed to load: ${image.src}`)),
                      { once: true },
                    );
                  });
                }
                await image.decode();
              }),
            );
          });
          await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            theme,
          );

          const screenshotPath = `website/artifacts/screenshots/${testInfo.project.name}/${viewport.name}/${theme}/${route.name}.png`;
          await mkdir(dirname(screenshotPath), { recursive: true });
          await page.screenshot({
            animations: "disabled",
            caret: "hide",
            fullPage: false,
            path: screenshotPath,
          });
        });
      }
    }
  }
});

test.describe("footer visual QA", () => {
  for (const viewport of viewports) {
    for (const theme of ["light", "dark"] as const) {
      test(`footer · ${theme} · ${viewport.name}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme: theme });
        await page.addInitScript((selectedTheme) => {
          localStorage.setItem("starlight-theme", selectedTheme);
        }, theme);
        await page.goto("/", { waitUntil: "networkidle" });
        await page.locator("footer .project-footer").scrollIntoViewIfNeeded();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        const screenshotPath = `website/artifacts/screenshots/${testInfo.project.name}/${viewport.name}/${theme}/footer.png`;
        await mkdir(dirname(screenshotPath), { recursive: true });
        await page.screenshot({
          animations: "disabled",
          caret: "hide",
          fullPage: false,
          path: screenshotPath,
        });
      });
    }
  }
});

test.describe("mobile repository navigation visual QA", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`repository navigation · ${theme} · mobile-390x844`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem("starlight-theme", selectedTheme);
      }, theme);
      await page.goto("/getting-started/", { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.locator("starlight-menu-button button").click();
      const repositoryLink = page.locator(
        "#starlight__sidebar [data-repository-navigation]:visible",
      );
      await expect(repositoryLink).toHaveAccessibleName(
        "trello-mcp source repository, 1.2K stars",
      );
      await repositoryLink.scrollIntoViewIfNeeded();

      const screenshotPath = `website/artifacts/screenshots/${testInfo.project.name}/mobile-390x844/${theme}/repository-navigation.png`;
      await mkdir(dirname(screenshotPath), { recursive: true });
      await page.screenshot({
        animations: "disabled",
        caret: "hide",
        fullPage: false,
        path: screenshotPath,
      });
    });
  }
});
