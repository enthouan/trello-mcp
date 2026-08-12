import { expect, test } from "@playwright/test";
import { CATALOG_PREVIEW_CATEGORIES } from "../support/site.js";
import { assertNoPageOverflow, gotoLoaded } from "./support.js";

test("tool catalog filters by search, category, and behavior", async ({
  page,
}) => {
  await gotoLoaded(page, "/reference/tools/");
  const catalog = page.locator("[data-tool-catalog]");
  const search = page.getByRole("searchbox", { name: "Search tools" });
  const category = page.getByRole("combobox", { name: "Category" });
  const behavior = page.getByRole("combobox", { name: "Behavior" });
  const status = catalog.getByRole("status");
  const reset = catalog.getByRole("button", { name: "Reset" });

  await expect(catalog.locator("[data-catalog-controls]")).toBeVisible();
  await search.fill("filePath");
  await expect(status).toHaveText("1 of 77 tools shown");
  await expect(catalog.locator("[data-tool-card]:visible")).toHaveCount(1);
  await expect(
    catalog.locator('[data-tool-name="card_attachment_upload"]'),
  ).toBeVisible();

  await reset.click();
  await category.selectOption("checklists");
  await expect(status).toHaveText("10 of 77 tools shown");
  await expect(catalog.locator("[data-tool-card]:visible")).toHaveCount(10);

  await reset.click();
  await behavior.selectOption("write");
  await expect(status).toHaveText("37 of 77 tools shown");
  await expect(catalog.locator('[data-tool-name="card_create"]')).toBeVisible();
  await expect(catalog.locator('[data-tool-name="card_get"]')).toBeHidden();

  await reset.click();
  await behavior.selectOption("delete");
  await expect(status).toHaveText("6 of 77 tools shown");
  await expect(
    catalog.getByText("Permanent delete", { exact: true }),
  ).toHaveCount(6);

  await reset.click();
  await search.fill("no-such-trello-tool-or-input");
  await expect(status).toHaveText("0 of 77 tools shown");
  await expect(catalog.locator("[data-catalog-empty]")).toBeVisible();

  await reset.click();
  await page.goto("/reference/tools/#card_create", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator('[data-tool-name="card_create"]')).toBeVisible();
  await expect(page).toHaveURL(/\/reference\/tools\/#card_create$/);
});

test("tool inputs expand from keyboard and remain complete without JavaScript", async ({
  browser,
  page,
}) => {
  await gotoLoaded(page, "/reference/tools/");
  const details = page
    .locator('[data-tool-name="card_create"]')
    .locator("details.tool-inputs");
  const summary = details.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await expect(details).toContainText("2 required, 5 optional");
  await expect(details).toContainText(
    "Destination list id where the new card should be created.",
  );

  const context = await browser.newContext({ javaScriptEnabled: false });
  const noScriptPage = await context.newPage();
  try {
    const response = await noScriptPage.goto("/reference/tools/", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(noScriptPage.locator("[data-tool-card]")).toHaveCount(77);
    await expect(noScriptPage.locator("[data-tool-group]")).toHaveCount(13);
    await expect(noScriptPage.locator("[data-catalog-controls]")).toBeHidden();
    await expect(
      noScriptPage.locator('[data-tool-name="card_create"]'),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("catalog filters and expanded cards fit 390px and 320px viewports", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 568 });
      await gotoLoaded(page, "/reference/tools/");
      const catalog = page.locator("[data-tool-catalog]");
      const controls = catalog.locator("[data-catalog-controls]");
      await page
        .getByRole("searchbox", { name: "Search tools" })
        .fill("filePath");
      const card = catalog.locator('[data-tool-name="card_attachment_upload"]');
      const summary = card.locator("details.tool-inputs summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(card.locator("details.tool-inputs")).toHaveAttribute(
        "open",
        "",
      );

      for (const element of [controls, card]) {
        const bounds = await element.evaluate((node) => {
          const box = node.getBoundingClientRect();
          return {
            clientWidth: node.clientWidth,
            left: box.left,
            right: box.right,
            scrollWidth: node.scrollWidth,
          };
        });
        expect(bounds.left).toBeGreaterThanOrEqual(-1);
        expect(bounds.right).toBeLessThanOrEqual(width + 1);
        expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
      }
      expect(
        await summary.evaluate(
          (element) => element.getBoundingClientRect().height,
        ),
      ).toBeGreaterThanOrEqual(44);
      await assertNoPageOverflow(page, `catalog at ${width}px`);
    });
  }
});

test("catalog uses parallel cards on a wide content area", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoLoaded(page, "/reference/tools/#tool-group-cards");
  const cards = page.locator(
    '[aria-labelledby="tool-group-cards"] [data-tool-card]',
  );
  const [first, second] = await Promise.all([
    cards.nth(0).boundingBox(),
    cards.nth(1).boundingBox(),
  ]);
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(Math.abs((first?.y ?? 0) - (second?.y ?? 0))).toBeLessThan(2);
  expect(second?.x ?? 0).toBeGreaterThan(
    (first?.x ?? 0) + (first?.width ?? 0) - 2,
  );
});

test("homepage catalog preview links categories and reflows at 320px", async ({
  page,
}) => {
  await gotoLoaded(page, "/");
  const preview = page.locator("[data-catalog-preview]");
  for (const [category, label] of CATALOG_PREVIEW_CATEGORIES) {
    await expect(
      preview.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("href", `/reference/tools/#tool-group-${category}`);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  const geometry = await preview.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  await assertNoPageOverflow(page, "homepage catalog preview at 320px");
});
