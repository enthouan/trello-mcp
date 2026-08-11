import { expect, test } from "@playwright/test";
import { HERO_TITLE } from "../support/site.js";
import {
  assertNoPageOverflow,
  gotoLoaded,
  monitorBrowserProblems,
} from "./support.js";

test("homepage loads without runtime or layout errors", async ({ page }) => {
  const problems = monitorBrowserProblems(page);

  await gotoLoaded(page, "/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    HERO_TITLE,
  );
  await expect(
    page.getByRole("link", { name: "Get started", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View on GitHub", exact: true }),
  ).toBeVisible();
  await assertNoPageOverflow(page, "WebKit desktop-light homepage");
  expect(problems, "WebKit homepage emitted browser errors").toEqual([]);
});
