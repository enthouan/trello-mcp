import { REPOSITORY_URL } from "../../src/data/repository.js";
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
  const githubAction = page.locator(".hero [data-github-action]");
  await expect(githubAction).toBeVisible();
  await expect(githubAction).toHaveAccessibleName("View on GitHub");
  await expect(githubAction).toHaveAttribute("href", REPOSITORY_URL);
  await expect(
    page.locator("header [data-repository-navigation]:visible"),
  ).toHaveAccessibleName("trello-mcp source repository, 1.2K stars");
  await assertNoPageOverflow(page, "WebKit desktop-light homepage");
  expect(problems, "WebKit homepage emitted browser errors").toEqual([]);
});
