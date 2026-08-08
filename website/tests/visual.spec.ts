import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test } from "@playwright/test";

const routes = [
  { name: "home", path: "/" },
  { name: "get-started", path: "/get-started/" },
  { name: "clients", path: "/clients/" },
  { name: "tools", path: "/tools/" },
  { name: "project", path: "/project/" },
] as const;

const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "ipad-portrait-820x1180", width: 820, height: 1180 },
  { name: "ipad-landscape-1180x820", width: 1180, height: 820 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "narrow-mobile-360x800", width: 360, height: 800 },
] as const;

test.describe("responsive visual QA matrix", () => {
  test.skip(
    process.env.VISUAL_QA !== "1",
    "Run with `corepack pnpm site:visual`.",
  );

  for (const viewport of viewports) {
    for (const theme of ["light", "dark"] as const) {
      for (const route of routes) {
        test(`${route.name} · ${theme} · ${viewport.name}`, async ({
          page,
        }) => {
          await page.setViewportSize(viewport);
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

          const screenshotPath = `website/artifacts/screenshots/${viewport.name}/${theme}/${route.name}.png`;
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
