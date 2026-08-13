import { HERO_TITLE } from "../support/site.js";
import {
  assertNoPageOverflow,
  expect,
  gotoLoaded,
  monitorBrowserProblems,
  test,
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
  await expect(page.locator(".hero [data-github-action]")).toBeVisible();
  await assertNoPageOverflow(page, "WebKit desktop-light homepage");
  expect(problems, "WebKit homepage emitted browser errors").toEqual([]);
});
