import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test } from "@playwright/test";

const routes = [
  { name: "home", path: "/" },
  { name: "get-started", path: "/get-started/" },
  { name: "get-started-docker", path: "/get-started/docker/" },
  { name: "get-started-http", path: "/get-started/http/" },
  { name: "get-started-stdio", path: "/get-started/stdio/" },
  { name: "trello-api-key", path: "/trello-api-key/" },
  { name: "clients", path: "/clients/" },
  { name: "clients-compatibility", path: "/clients/compatibility/" },
  { name: "how-it-works", path: "/guides/how-it-works/" },
  { name: "workflows", path: "/guides/workflows/" },
  { name: "security", path: "/security/" },
  { name: "troubleshooting", path: "/guides/troubleshooting/" },
  { name: "faq", path: "/faq/" },
  { name: "reference", path: "/reference/" },
  { name: "configuration", path: "/reference/configuration/" },
  { name: "tools", path: "/tools/" },
  { name: "tools-api-coverage", path: "/tools/api-coverage/" },
  { name: "contributing", path: "/reference/contributing/" },
  { name: "support", path: "/reference/support/" },
  { name: "security-policy", path: "/reference/security-policy/" },
] as const;

const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "ipad-portrait-768x1024", width: 768, height: 1024 },
  { name: "ipad-landscape-1024x768", width: 1024, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "narrow-mobile-320x568", width: 320, height: 568 },
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
  for (const viewport of [viewports[0], viewports[4]] as const) {
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
