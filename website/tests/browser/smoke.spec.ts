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
    2,
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
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`homepage star count reserves stable ${viewport.name} action space`, async ({
    page,
  }) => {
    let releaseResponse = () => {};
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await page.route(REPOSITORY_API_URL, async (route) => {
      await responseGate;
      await fulfillRepositoryMetadata(route);
    });
    await page.setViewportSize(viewport);
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await page.evaluate(() => document.fonts.ready);

    const action = page.locator(".hero [data-github-action]");
    const actions = page.locator(".hero .actions");
    const getStarted = page.getByRole("link", {
      name: "Get started",
      exact: true,
    });
    const originalContentGeometry = () =>
      action.evaluate((element) => {
        const icon = element.querySelector(":scope > svg");
        const text = [...element.childNodes].find(
          (node) =>
            node.nodeType === Node.TEXT_NODE &&
            node.textContent?.includes("View on GitHub"),
        );
        if (!icon || !text) return null;

        const range = document.createRange();
        range.selectNodeContents(text);
        const iconBox = icon.getBoundingClientRect();
        const textBox = range.getBoundingClientRect();
        return {
          icon: { x: iconBox.x, y: iconBox.y },
          text: { x: textBox.x, y: textBox.y },
        };
      });
    const [
      actionBefore,
      actionsBefore,
      getStartedBefore,
      originalContentBefore,
    ] = await Promise.all([
      action.boundingBox(),
      actions.boundingBox(),
      getStarted.boundingBox(),
      originalContentGeometry(),
    ]);
    expect(actionBefore).not.toBeNull();
    expect(actionsBefore).not.toBeNull();
    expect(getStartedBefore).not.toBeNull();
    expect(originalContentBefore).not.toBeNull();

    releaseResponse();
    await expect(action.locator("[data-repository-star-count]")).toHaveText(
      "1.2K",
    );
    const [actionAfter, actionsAfter, getStartedAfter, originalContentAfter] =
      await Promise.all([
        action.boundingBox(),
        actions.boundingBox(),
        getStarted.boundingBox(),
        originalContentGeometry(),
      ]);
    expect(actionAfter).not.toBeNull();
    expect(actionsAfter).not.toBeNull();
    expect(getStartedAfter).not.toBeNull();
    expect(originalContentAfter).not.toBeNull();

    for (const property of ["x", "y", "width", "height"] as const) {
      expect(
        Math.abs(
          (actionAfter?.[property] ?? 0) - (actionBefore?.[property] ?? 0),
        ),
        `GitHub action ${property} shifted`,
      ).toBeLessThanOrEqual(1);
    }
    expect(
      Math.abs((actionsAfter?.height ?? 0) - (actionsBefore?.height ?? 0)),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((getStartedAfter?.x ?? 0) - (getStartedBefore?.x ?? 0)),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((getStartedAfter?.y ?? 0) - (getStartedBefore?.y ?? 0)),
    ).toBeLessThanOrEqual(1);
    for (const part of ["icon", "text"] as const) {
      for (const property of ["x", "y"] as const) {
        expect(
          Math.abs(
            (originalContentAfter?.[part][property] ?? 0) -
              (originalContentBefore?.[part][property] ?? 0),
          ),
          `GitHub action ${part} ${property} shifted`,
        ).toBeLessThanOrEqual(1);
      }
    }
    await assertNoPageOverflow(page, `${viewport.name} GitHub star count`);
  });
}

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
