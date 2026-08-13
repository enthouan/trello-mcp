import {
  REPOSITORY_API_URL,
  REPOSITORY_URL,
} from "../../src/data/repository.js";
import {
  FOOTER_ATTRIBUTION,
  FOOTER_DISCLAIMER,
  HERO_TAGLINE,
  HERO_TITLE,
  REPRESENTATIVE_ACCESSIBILITY_ROUTES,
  ROADMAP_URL,
} from "../support/site.js";
import {
  assertHeadingAndLandmarkBasics,
  assertNoPageOverflow,
  assertNoSeriousAccessibilityViolations,
  expect,
  fulfillRepositoryMetadata,
  getClientPickerGrid,
  gotoLoaded,
  monitorBrowserProblems,
  test,
} from "./support.js";

test.describe("representative production routes", () => {
  for (const route of REPRESENTATIVE_ACCESSIBILITY_ROUTES) {
    test(`${route} renders accessibly without browser errors`, async ({
      page,
    }) => {
      const problems = monitorBrowserProblems(page);
      await gotoLoaded(page, route);

      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("footer .project-footer")).toContainText(
        FOOTER_ATTRIBUTION,
      );
      await expect(page.locator("footer .project-footer")).toContainText(
        FOOTER_DISCLAIMER,
      );
      await assertHeadingAndLandmarkBasics(page, route);
      await assertNoPageOverflow(page, route);

      const images = await page.locator("img").evaluateAll((nodes) =>
        nodes.map((node) => {
          const image = node as HTMLImageElement;
          return {
            alt: image.getAttribute("alt"),
            complete: image.complete,
            naturalWidth: image.naturalWidth,
          };
        }),
      );
      expect(images.filter(({ alt }) => alt === null)).toEqual([]);
      expect(
        images.filter(
          ({ complete, naturalWidth }) => !complete || !naturalWidth,
        ),
      ).toEqual([]);
      await assertNoSeriousAccessibilityViolations(page, route);
      expect(problems, `${route} emitted browser errors`).toEqual([]);
    });
  }
});

test("project footer keeps navigation beside the name and full-width copy below", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoLoaded(page, "/");

  const footer = page.locator("footer .project-footer");
  const bar = footer.locator(":scope > .project-footer__bar");
  const about = footer.locator(":scope > .project-footer__about");
  const projectName = bar.getByRole("link", {
    name: "trello-mcp",
    exact: true,
  });
  const navigation = bar.getByRole("navigation", {
    name: "Documentation links",
  });

  await expect(projectName).toBeVisible();
  await expect(navigation).toBeVisible();
  await expect(about).toContainText(FOOTER_ATTRIBUTION);
  await expect(about).toContainText(FOOTER_DISCLAIMER);
  await expect(footer.getByRole("link", { name: "Edit page" })).toHaveCount(0);

  for (const [name, href] of [
    ["Reference", "/reference/"],
    ["Roadmap", ROADMAP_URL],
    ["Help", "/reference/reporting-issues/"],
    ["Security & Data", "/guides/security/"],
    ["GitHub", REPOSITORY_URL],
  ] as const) {
    await expect(
      navigation.getByRole("link", { name, exact: true }),
    ).toHaveAttribute("href", href);
  }

  const [barBox, nameBox, navigationBox, aboutBox] = await Promise.all([
    bar.boundingBox(),
    projectName.boundingBox(),
    navigation.boundingBox(),
    about.boundingBox(),
  ]);
  expect(barBox).not.toBeNull();
  expect(nameBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(aboutBox).not.toBeNull();
  expect(Math.abs((nameBox?.y ?? 0) - (navigationBox?.y ?? 0))).toBeLessThan(8);
  expect(navigationBox?.x ?? 0).toBeGreaterThan(
    (nameBox?.x ?? 0) + (nameBox?.width ?? 0),
  );
  expect(aboutBox?.y ?? 0).toBeGreaterThanOrEqual(
    (barBox?.y ?? 0) + (barBox?.height ?? 0),
  );
  expect(Math.abs((aboutBox?.width ?? 0) - (barBox?.width ?? 0))).toBeLessThan(
    2,
  );

  const inlineLink = about.getByRole("link", {
    name: "Antoine Ménard",
    exact: true,
  });
  expect(
    await inlineLink.evaluate(
      (element) => getComputedStyle(element).textDecorationLine,
    ),
  ).toContain("underline");
  await inlineLink.hover();
  await expect
    .poll(() =>
      inlineLink.evaluate(
        (element) => getComputedStyle(element).textDecorationLine,
      ),
    )
    .toBe("none");

  await page.setViewportSize({ width: 390, height: 844 });
  const [mobileBar, mobileAbout, overflow] = await Promise.all([
    bar.boundingBox(),
    about.boundingBox(),
    footer.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    })),
  ]);
  expect(mobileBar).not.toBeNull();
  expect(mobileAbout).not.toBeNull();
  expect(mobileAbout?.y ?? 0).toBeGreaterThanOrEqual(
    (mobileBar?.y ?? 0) + (mobileBar?.height ?? 0),
  );
  expect(
    Math.abs((mobileAbout?.width ?? 0) - (mobileBar?.width ?? 0)),
  ).toBeLessThan(2);
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  await assertNoPageOverflow(page, "mobile project footer");
});

test("homepage actions, marks, and hover feedback remain visitor-observable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoLoaded(page, "/");

  const title = page.locator("main h1");
  const heroMark = page.locator(".hero > .hero-html img");
  await expect(title).toHaveAccessibleName(HERO_TITLE);
  await expect(page.locator(".hero .tagline")).toHaveText(HERO_TAGLINE);
  await expect(heroMark).toBeVisible();
  await expect(heroMark).toHaveAttribute("alt", "trello-mcp split-card mark");

  const actions = page.locator(".hero .actions a.sl-link-button");
  await expect(actions).toHaveCount(2);
  await expect(actions.nth(0)).toHaveAttribute("href", "/getting-started/");
  await expect(actions.nth(1)).toHaveAttribute("href", REPOSITORY_URL);
  await expect(actions.nth(1).locator("svg[aria-hidden='true']")).toHaveCount(
    1,
  );

  for (const theme of ["light", "dark"] as const) {
    await page.locator("html").evaluate((element, value) => {
      element.dataset.theme = value;
    }, theme);
    for (const action of await actions.all()) {
      const before = await action.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          background: styles.backgroundColor,
          boxShadow: styles.boxShadow,
          fontWeight: Number.parseInt(styles.fontWeight, 10),
          top: element.getBoundingClientRect().top,
        };
      });
      await action.hover();
      await expect
        .poll(() =>
          action.evaluate((element) => getComputedStyle(element).boxShadow),
        )
        .not.toBe(before.boxShadow);
      const after = await action.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        top: element.getBoundingClientRect().top,
        transform: getComputedStyle(element).transform,
      }));
      expect(before.fontWeight).toBeGreaterThanOrEqual(700);
      expect(after.background).toBe(before.background);
      expect(after.top).toBeCloseTo(before.top, 2);
      expect(after.transform).toBe("none");
      await title.hover();
    }
  }
});

for (const viewport of [
  { name: "wide desktop", width: 1440, height: 900 },
  { name: "navigation breakpoint", width: 800, height: 900 },
] as const) {
  test(`repository count reserves stable ${viewport.name} header space`, async ({
    page,
  }) => {
    let releaseResponse = () => {};
    let markRequestStarted = () => {};
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    await page.route(REPOSITORY_API_URL, async (route) => {
      markRequestStarted();
      await responseGate;
      await fulfillRepositoryMetadata(route);
    });
    await page.setViewportSize(viewport);
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await requestStarted;
    await page.evaluate(() => document.fonts.ready);

    const action = page.locator("header [data-repository-navigation]:visible");
    const search = page.locator("header site-search button:visible");
    const theme = page.locator("header starlight-theme-select select:visible");
    const countSlot = action.locator("[data-repository-star-slot]");
    await expect(countSlot).toHaveCSS("visibility", "hidden");
    const [actionBefore, searchBefore, themeBefore] = await Promise.all([
      action.boundingBox(),
      search.boundingBox(),
      theme.boundingBox(),
    ]);
    expect(actionBefore).not.toBeNull();
    expect(searchBefore).not.toBeNull();
    expect(themeBefore).not.toBeNull();

    releaseResponse();
    await expect(countSlot).toHaveText("1.2K");
    await expect(countSlot).toHaveCSS("visibility", "visible");
    const [actionAfter, searchAfter, themeAfter] = await Promise.all([
      action.boundingBox(),
      search.boundingBox(),
      theme.boundingBox(),
    ]);
    expect(actionAfter).not.toBeNull();
    expect(searchAfter).not.toBeNull();
    expect(themeAfter).not.toBeNull();

    for (const [name, before, after] of [
      ["repository link", actionBefore, actionAfter],
      ["search control", searchBefore, searchAfter],
      ["theme control", themeBefore, themeAfter],
    ] as const) {
      for (const property of ["x", "y", "width", "height"] as const) {
        expect(
          Math.abs((after?.[property] ?? 0) - (before?.[property] ?? 0)),
          `${name} ${property} changed`,
        ).toBeLessThanOrEqual(1);
      }
    }
    expect(actionAfter?.x ?? 0).toBeGreaterThanOrEqual(
      (searchAfter?.x ?? 0) + (searchAfter?.width ?? 0) - 1,
    );
    expect(themeAfter?.x ?? 0).toBeGreaterThanOrEqual(
      (actionAfter?.x ?? 0) + (actionAfter?.width ?? 0) - 1,
    );
    await assertNoPageOverflow(page, `${viewport.name} repository count`);
  });
}

test("repository count reserves stable mobile menu space", async ({ page }) => {
  let releaseResponse = () => {};
  let markRequestStarted = () => {};
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve;
  });
  await page.route(REPOSITORY_API_URL, async (route) => {
    markRequestStarted();
    await responseGate;
    await fulfillRepositoryMetadata(route);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/getting-started/", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);
  await requestStarted;
  await page.evaluate(() => document.fonts.ready);
  await page.locator("starlight-menu-button button").click();

  const preferences = page.locator(".mobile-preferences:visible");
  const action = preferences.locator("[data-repository-navigation]");
  const theme = preferences.locator("starlight-theme-select select");
  const countSlot = action.locator("[data-repository-star-slot]");
  await expect(countSlot).toHaveCSS("visibility", "hidden");
  const [preferencesBefore, actionBefore, themeBefore] = await Promise.all([
    preferences.boundingBox(),
    action.boundingBox(),
    theme.boundingBox(),
  ]);

  releaseResponse();
  await expect(countSlot).toHaveText("1.2K");
  await expect(countSlot).toHaveCSS("visibility", "visible");
  const [preferencesAfter, actionAfter, themeAfter] = await Promise.all([
    preferences.boundingBox(),
    action.boundingBox(),
    theme.boundingBox(),
  ]);

  for (const [name, before, after] of [
    ["preferences", preferencesBefore, preferencesAfter],
    ["repository link", actionBefore, actionAfter],
    ["theme control", themeBefore, themeAfter],
  ] as const) {
    expect(before, `${name} before loading`).not.toBeNull();
    expect(after, `${name} after loading`).not.toBeNull();
    for (const property of ["x", "y", "width", "height"] as const) {
      expect(
        Math.abs((after?.[property] ?? 0) - (before?.[property] ?? 0)),
        `${name} ${property} changed`,
      ).toBeLessThanOrEqual(1);
    }
  }
  expect(themeAfter?.x ?? 0).toBeGreaterThanOrEqual(
    (actionAfter?.x ?? 0) + (actionAfter?.width ?? 0) - 1,
  );
  await assertNoPageOverflow(page, "mobile menu repository count");
});

test("homepage proof and client cards reflow without clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoLoaded(page, "/");

  const proofGrid = page.locator(".card-grid").first();
  const proofCards = proofGrid.locator(":scope > article.card");
  const clientGrid = getClientPickerGrid(page);
  const clientCards = clientGrid.locator(":scope > .sl-link-card");
  await expect(proofCards).toHaveCount(4);
  await expect(clientCards).toHaveCount(6);
  const [firstProof, secondProof, firstClient, secondClient] =
    await Promise.all([
      proofCards.nth(0).boundingBox(),
      proofCards.nth(1).boundingBox(),
      clientCards.nth(0).boundingBox(),
      clientCards.nth(1).boundingBox(),
    ]);
  expect(Math.abs((firstProof?.y ?? 0) - (secondProof?.y ?? 0))).toBeLessThan(
    2,
  );
  expect(Math.abs((firstClient?.y ?? 0) - (secondClient?.y ?? 0))).toBeLessThan(
    2,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  for (const cards of [proofCards, clientCards]) {
    const boxes = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          clientWidth: element.clientWidth,
          left: box.left,
          right: box.right,
          scrollWidth: element.scrollWidth,
        };
      }),
    );
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(-1);
      expect(box.right).toBeLessThanOrEqual(391);
      expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);
    }
  }
  await assertNoPageOverflow(page, "homepage cards at 390px");
});
