import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Response, test } from "@playwright/test";

const DISCLAIMER =
  "trello-mcp is an independent, community-maintained project. It is not an official Trello or Atlassian product, service, or MCP implementation, and it is not affiliated with, endorsed by, or sponsored by Trello or Atlassian.";
const DEVELOPER_URL = "https://www.antoinemenard.com/";
const OFFICIAL_ENDPOINT = "https://mcp.trello.com/v1";
const ROADMAP_URL =
  "https://trello.com/b/GnKmvuHz/trello-mcp-enthouan-trello-mcp";
const CANONICAL_WEBSITE_URL = "https://trello-mcp.com/";
const CANONICAL_WEBSITE_ORIGIN = new URL(CANONICAL_WEBSITE_URL).origin;
const FOOTER_ATTRIBUTION =
  "trello-mcp is an open-source project released under the MIT License and maintained by Antoine Ménard.";
const FOOTER_DISCLAIMER =
  "It is not an official Trello or Atlassian product and is not affiliated with or endorsed by either company.";
const HERO_TITLE = "Manage Trello from your MCP client.";
const HERO_TAGLINE =
  "A self-hosted Model Context Protocol (MCP) server for existing Trello users. Find cards, organize lists, manage checklists, and coordinate projects from a server you run.";
const CLIENT_ICON_SOURCES = {
  claude: ["fab", "claude"],
  evidence: ["fas", "clipboard-check"],
  inspector: ["fas", "magnifying-glass"],
  openai: ["fab", "openai"],
  opencode: ["fas", "robot"],
  vscode: ["fas", "code"],
} as const;
const CATALOG_PREVIEW_CATEGORIES = [
  [
    "credentials",
    "Credential diagnostics",
    2,
    ["auth_whoami", "auth_token_info"],
  ],
  [
    "boards",
    "Boards",
    11,
    ["list_boards", "board_create", "board_get", "board_field_get"],
  ],
  [
    "workspaces",
    "Workspaces",
    5,
    [
      "list_workspaces",
      "workspace_get",
      "workspace_boards",
      "workspace_members",
    ],
  ],
  [
    "members",
    "Members",
    4,
    ["member_get", "member_boards", "member_cards", "member_workspaces"],
  ],
  [
    "lists",
    "Lists",
    7,
    ["list_get", "list_create", "list_update", "list_archive"],
  ],
  [
    "cards",
    "Cards",
    12,
    ["card_get", "card_board", "card_list", "card_create"],
  ],
  [
    "attachments",
    "Attachments",
    5,
    [
      "card_attachments",
      "card_attachment_get",
      "card_attachment_add_url",
      "card_attachment_upload",
    ],
  ],
  [
    "checklists",
    "Checklists",
    10,
    [
      "card_checklists",
      "card_checklist_create",
      "card_checklist_update",
      "card_checklist_delete",
    ],
  ],
  [
    "custom-fields",
    "Custom fields",
    5,
    [
      "card_custom_field_items",
      "card_custom_field_set",
      "card_custom_field_clear",
      "custom_field_get",
    ],
  ],
  [
    "card-members",
    "Card members",
    3,
    ["card_members", "card_member_add", "card_member_remove"],
  ],
  [
    "comments-activity",
    "Comments and card activity",
    4,
    [
      "card_comment_add",
      "card_comment_update",
      "card_comment_delete",
      "card_actions",
    ],
  ],
  [
    "labels",
    "Labels",
    7,
    ["card_labels", "label_get", "label_create", "label_update"],
  ],
  ["search", "Search", 2, ["search", "search_members"]],
] as const;

const publicRoutes = [
  "/",
  "/getting-started/",
  "/getting-started/docker/",
  "/getting-started/http/",
  "/getting-started/stdio/",
  "/getting-started/trello-api-key/",
  "/getting-started/clients/",
  "/getting-started/compatibility/",
  "/guides/how-it-works/",
  "/guides/workflows/",
  "/guides/security/",
  "/guides/operations/",
  "/guides/troubleshooting/",
  "/guides/faq/",
  "/reference/",
  "/reference/configuration/",
  "/reference/tools/",
  "/reference/api-coverage/",
  "/reference/contributing/",
  "/reference/reporting-issues/",
  "/reference/security-policy/",
  "/404.html",
] as const;

const publicDocumentMetadata = {
  "/": {
    title: "Self-hosted, auditable Trello MCP server",
    description:
      "A self-hosted, auditable Model Context Protocol server for broad Trello automation.",
  },
  "/getting-started/": {
    title: "Install and run",
    description:
      "Create Trello credentials, choose a transport and installation path, configure your MCP client, then verify the connection.",
  },
  "/getting-started/docker/": {
    title: "Docker Compose",
    description:
      "Run the published trello-mcp image as a loopback-published Compose service, or build the image locally.",
  },
  "/getting-started/http/": {
    title: "Streamable HTTP",
    description:
      "Connect an HTTP MCP client to trello-mcp on loopback and understand the wider-network boundary.",
  },
  "/getting-started/stdio/": {
    title: "stdio",
    description:
      "Let a local desktop MCP client launch trello-mcp as a child process without a network listener.",
  },
  "/getting-started/trello-api-key/": {
    title: "Trello API key",
    description:
      "Create a Trello app, generate an API key, authorize a token, store both credentials safely, and verify them with trello-mcp.",
  },
  "/getting-started/clients/": {
    title: "Set up your MCP client",
    description:
      "Configure trello-mcp over local stdio or Streamable HTTP in supported MCP clients.",
  },
  "/getting-started/compatibility/": {
    title: "Compatibility evidence",
    description:
      "Dated evidence for MCP client setup, transport connection, tool discovery, and live Trello validation.",
  },
  "/guides/how-it-works/": {
    title: "How it works",
    description:
      "Follow a tool call across the MCP client, trello-mcp, and the Trello REST API.",
  },
  "/guides/workflows/": {
    title: "Workflows",
    description:
      "Practical Trello workflows expressed through the MCP tool catalog.",
  },
  "/guides/operations/": {
    title: "Operate trello-mcp",
    description:
      "Upgrade, roll back, inspect, stop, and rotate credentials for a running trello-mcp deployment.",
  },
  "/guides/troubleshooting/": {
    title: "Troubleshooting",
    description:
      "Diagnose startup, transport, authentication, Docker, Trello API, rate-limit, and attachment failures safely.",
  },
  "/reference/": {
    title: "Reference",
    description:
      "Technical reference, contribution guidance, issue reporting, release resources, and security policies for trello-mcp.",
  },
  "/reference/configuration/": {
    title: "Configuration reference",
    description:
      "Every trello-mcp runtime and Compose setting, its default, and the boundary it controls.",
  },
  "/reference/tools/": {
    title: "Tool catalog",
    description:
      "Search 77 Trello MCP tools by category, behavior, name, purpose, and input.",
  },
  "/reference/api-coverage/": {
    title: "API coverage",
    description:
      "Supported, partially supported, deferred, and out-of-scope Trello REST API groups.",
  },
  "/reference/contributing/": {
    title: "Contributing",
    description:
      "Run the project checks, update canonical documentation, follow the Trello tool pattern, and prepare focused contributions safely.",
  },
  "/reference/reporting-issues/": {
    title: "Reporting issues and support",
    description:
      "Choose the right support channel and prepare a useful, sanitized trello-mcp bug report.",
  },
  "/reference/security-policy/": {
    title: "Security policy",
    description:
      "Supported versions, private vulnerability reporting, sensitive data handling, and threat-model boundaries for trello-mcp.",
  },
  "/guides/security/": {
    title: "Security and data flow",
    description:
      "Understand how trello-mcp handles credentials, Trello data, transports, logs, attachment uploads, and write operations.",
  },
  "/guides/faq/": {
    title: "FAQ",
    description:
      "Answers about trello-mcp hosting, credentials, transports, Trello access, destructive tools, privacy, support, and the official Trello MCP server.",
  },
} as const satisfies Record<
  Exclude<(typeof publicRoutes)[number], "/404.html">,
  { title: string; description: string }
>;

const primaryNavigation = [
  ["Install and run", "/getting-started/"],
  ["Trello API key", "/getting-started/trello-api-key/"],
  ["Set up your MCP client", "/getting-started/clients/"],
  ["Compatibility", "/getting-started/compatibility/"],
  ["Docker Compose", "/getting-started/docker/"],
  ["Streamable HTTP", "/getting-started/http/"],
  ["stdio", "/getting-started/stdio/"],
  ["How it works", "/guides/how-it-works/"],
  ["Workflows", "/guides/workflows/"],
  ["Security & Data", "/guides/security/"],
  ["Operations", "/guides/operations/"],
  ["Troubleshooting", "/guides/troubleshooting/"],
  ["FAQ", "/guides/faq/"],
  ["Overview", "/reference/"],
  ["Configuration", "/reference/configuration/"],
  ["Tool catalog", "/reference/tools/"],
  ["API coverage", "/reference/api-coverage/"],
  ["Contributing", "/reference/contributing/"],
  ["Reporting issues and support", "/reference/reporting-issues/"],
  ["Security policy", "/reference/security-policy/"],
] as const;

const responsiveViewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

function getClientPickerGrid(page: Page) {
  return page
    .locator("main .card-grid")
    .filter({ hasText: "Claude Desktop" })
    .filter({ hasText: "All compatibility evidence" })
    .first();
}

type BrowserProblem = {
  kind: "console" | "page" | "request" | "response";
  message: string;
};

function monitorBrowserProblems(
  page: Page,
  options: {
    allowConsole?: (message: string) => boolean;
    allowResponse?: (response: Response) => boolean;
  } = {},
) {
  const problems: BrowserProblem[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" && !options.allowConsole?.(message.text())) {
      problems.push({ kind: "console", message: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    problems.push({ kind: "page", message: error.message });
  });
  page.on("requestfailed", (request) => {
    problems.push({
      kind: "request",
      message: `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`,
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !options.allowResponse?.(response)) {
      problems.push({
        kind: "response",
        message: `${response.status()} ${response.request().method()} ${response.url()}`,
      });
    }
  });

  return problems;
}

async function gotoLoaded(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(
    response,
    `Navigation to ${route} did not return a response`,
  ).not.toBeNull();
  expect(
    response?.status(),
    `Navigation to ${route} did not succeed`,
  ).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  return response;
}

async function assertNoPageOverflow(page: Page, context: string) {
  const dimensions = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(
    dimensions.documentScrollWidth,
    `${context} has document-level horizontal overflow: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  expect(
    dimensions.bodyScrollWidth,
    `${context} has body-level horizontal overflow: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function assertHeadingAndLandmarkBasics(page: Page, route: string) {
  await expect(
    page.locator("main"),
    `${route} must have one main landmark`,
  ).toHaveCount(1);
  await expect(
    page.locator("header"),
    `${route} must have a page header`,
  ).toHaveCount(1);
  await expect(
    page.locator('header a[href="/"]'),
    `${route} must link back home`,
  ).toBeVisible();
  if (route !== "/" && route !== "/404.html") {
    expect(
      await page.locator("nav").count(),
      `${route} must expose navigation`,
    ).toBeGreaterThan(0);
  }

  const headings = await page
    .locator("main :is(h1, h2, h3, h4, h5, h6)")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const style = getComputedStyle(node);
          return style.display !== "none" && style.visibility !== "hidden";
        })
        .map((node) => ({
          level: Number(node.tagName.slice(1)),
          text: node.textContent?.trim() ?? "",
        })),
    );

  expect(headings, `${route} must have a visible heading`).not.toHaveLength(0);
  expect(headings[0]?.level, `${route} must begin with an h1`).toBe(1);
  expect(
    headings.filter(({ level }) => level === 1),
    `${route} must have exactly one h1`,
  ).toHaveLength(1);

  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];
    expect(
      (current?.level ?? 6) - (previous?.level ?? 1),
      `${route} skips a heading level between “${previous?.text}” and “${current?.text}”`,
    ).toBeLessThanOrEqual(1);
  }
}

test.describe("public production routes", () => {
  for (const route of publicRoutes) {
    test(`${route} renders without runtime or accessibility errors`, async ({
      page,
    }) => {
      const problems = monitorBrowserProblems(page);
      await gotoLoaded(page, route);

      if (route !== "/404.html") {
        const metadata = publicDocumentMetadata[route];
        const description = page.locator('meta[name="description"]');
        const canonical = page.locator('link[rel="canonical"]');
        const openGraphTitle = page.locator('meta[property="og:title"]');
        const openGraphDescription = page.locator(
          'meta[property="og:description"]',
        );
        const openGraphUrl = page.locator('meta[property="og:url"]');

        await expect(page).toHaveTitle(`${metadata.title} — trello-mcp`);
        await expect(description).toHaveCount(1);
        await expect(description).toHaveAttribute(
          "content",
          metadata.description,
        );
        await expect(canonical).toHaveCount(1);
        const canonicalHref = await canonical.getAttribute("href");
        expect(
          canonicalHref,
          `${route} must have a canonical URL`,
        ).toBeTruthy();
        const canonicalUrl = new URL(
          canonicalHref ?? "http://invalid.invalid/",
        );
        expect(canonicalUrl.origin).toBe(CANONICAL_WEBSITE_ORIGIN);
        expect(canonicalUrl.pathname).toBe(route);
        expect(canonicalUrl.search).toBe("");
        expect(canonicalUrl.hash).toBe("");
        await expect(openGraphTitle).toHaveAttribute("content", metadata.title);
        await expect(openGraphDescription).toHaveAttribute(
          "content",
          metadata.description,
        );
        await expect(openGraphUrl).toHaveCount(1);
        await expect(openGraphUrl).toHaveAttribute(
          "content",
          canonicalHref ?? "",
        );
      }

      await expect(page.locator("main")).toBeVisible();
      const projectFooter = page.locator("footer .project-footer");
      await expect(projectFooter).toBeVisible();
      await expect(projectFooter).toContainText(FOOTER_ATTRIBUTION);
      await expect(projectFooter).toContainText(FOOTER_DISCLAIMER);
      await assertNoPageOverflow(page, route);
      await assertHeadingAndLandmarkBasics(page, route);

      const images = await page.locator("img").evaluateAll((nodes) =>
        nodes.map((node) => {
          const image = node as HTMLImageElement;
          return {
            alt: image.getAttribute("alt"),
            complete: image.complete,
            naturalWidth: image.naturalWidth,
            src: image.currentSrc || image.src,
          };
        }),
      );
      expect(
        images.filter(({ alt }) => alt === null),
        `${route} contains images without alt attributes`,
      ).toEqual([]);
      expect(
        images.filter(
          ({ complete, naturalWidth }) => !complete || naturalWidth === 0,
        ),
        `${route} contains images that did not load`,
      ).toEqual([]);

      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const highImpactViolations = accessibility.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      );
      expect(
        highImpactViolations,
        `${route} has serious or critical accessibility violations:\n${JSON.stringify(
          highImpactViolations,
          null,
          2,
        )}`,
      ).toEqual([]);
      expect(problems, `${route} emitted browser errors`).toEqual([]);
    });
  }
});

test("project footer preserves Starlight metadata and matches the reference layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoLoaded(page, "/");

  const footer = page.locator("footer.site-footer");
  const projectFooter = footer.locator(".project-footer");
  const bar = projectFooter.locator(":scope > .project-footer__bar");
  const about = projectFooter.locator(":scope > .project-footer__about");
  const projectName = bar.getByRole("link", {
    name: "trello-mcp",
    exact: true,
  });
  const links = bar.getByRole("navigation", {
    name: "Documentation links",
  });

  await expect(footer.getByRole("link", { name: "Edit page" })).toHaveCount(0);
  await expect(projectFooter).toContainText(FOOTER_ATTRIBUTION);
  await expect(projectFooter).toContainText(FOOTER_DISCLAIMER);
  await expect(projectFooter).toContainText(
    "Generated with Astro using the Starlight documentation theme.",
  );
  expect(
    await projectFooter
      .locator(":scope > *")
      .evaluateAll((elements) =>
        elements.map((element) =>
          [...element.classList].find((className) =>
            className.startsWith("project-footer__"),
          ),
        ),
      ),
  ).toEqual(["project-footer__bar", "project-footer__about"]);

  const expectedLinks = [
    ["trello-mcp", "/"],
    ["Antoine Ménard", DEVELOPER_URL],
    ["Trello", "https://trello.com/"],
    ["Atlassian", "https://www.atlassian.com/"],
    ["Astro", "https://astro.build/"],
    ["Starlight", "https://starlight.astro.build/"],
  ] as const;
  for (const [name, href] of expectedLinks) {
    await expect(
      projectFooter.getByRole("link", { name, exact: true }),
    ).toHaveAttribute("href", href);
  }

  const footerInlineLink = projectFooter.getByRole("link", {
    name: "Antoine Ménard",
    exact: true,
  });
  expect(
    await footerInlineLink.evaluate(
      (element) => getComputedStyle(element).textDecorationLine,
    ),
  ).toContain("underline");
  await footerInlineLink.hover();
  await expect
    .poll(() =>
      footerInlineLink.evaluate(
        (element) => getComputedStyle(element).textDecorationLine,
      ),
    )
    .toBe("none");

  for (const [name, href] of [
    ["Reference", "/reference/"],
    ["Roadmap", ROADMAP_URL],
    ["Help", "/reference/reporting-issues/"],
    ["Security & Data", "/guides/security/"],
    ["GitHub", "https://github.com/enthouan/trello-mcp"],
  ] as const) {
    await expect(
      links.getByRole("link", { name, exact: true }),
    ).toHaveAttribute("href", href);
  }

  const desktopLayout = await projectFooter.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      columns: styles.gridTemplateColumns,
      borderTopStyle: styles.borderTopStyle,
    };
  });
  expect(desktopLayout.columns.split(" ")).toHaveLength(1);
  expect(desktopLayout.borderTopStyle).toBe("solid");

  const barLayout = await bar.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      display: styles.display,
      justifyContent: styles.justifyContent,
      flexWrap: styles.flexWrap,
    };
  });
  expect(barLayout).toEqual({
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
  });

  const [desktopBar, desktopName, desktopAbout, desktopLinks, aboutMaxWidth] =
    await Promise.all([
      bar.boundingBox(),
      projectName.boundingBox(),
      about.boundingBox(),
      links.boundingBox(),
      about.evaluate((element) => getComputedStyle(element).maxWidth),
    ]);
  expect(desktopBar).not.toBeNull();
  expect(desktopName).not.toBeNull();
  expect(desktopAbout).not.toBeNull();
  expect(desktopLinks).not.toBeNull();
  expect(aboutMaxWidth).toBe("none");
  expect(desktopLinks?.x ?? 0).toBeGreaterThan(
    (desktopName?.x ?? 0) + (desktopName?.width ?? 0),
  );
  expect(desktopAbout?.y ?? 0).toBeGreaterThanOrEqual(
    (desktopBar?.y ?? 0) + (desktopBar?.height ?? 0),
  );
  expect(
    Math.abs((desktopAbout?.width ?? 0) - (desktopBar?.width ?? 0)),
  ).toBeLessThan(2);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await projectFooter.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  const mobileBarLayout = await bar.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(mobileLayout.columns.split(" ")).toHaveLength(1);
  expect(mobileLayout.scrollWidth).toBeLessThanOrEqual(
    mobileLayout.clientWidth + 1,
  );
  expect(mobileBarLayout.scrollWidth).toBeLessThanOrEqual(
    mobileBarLayout.clientWidth + 1,
  );

  const [mobileBar, mobileAbout, mobileLinks] = await Promise.all([
    bar.boundingBox(),
    about.boundingBox(),
    links.boundingBox(),
  ]);
  expect(mobileBar).not.toBeNull();
  expect(mobileAbout).not.toBeNull();
  expect(mobileLinks).not.toBeNull();
  expect(mobileAbout?.y ?? 0).toBeGreaterThanOrEqual(
    (mobileBar?.y ?? 0) + (mobileBar?.height ?? 0),
  );
  expect(
    Math.abs((mobileAbout?.width ?? 0) - (mobileBar?.width ?? 0)),
  ).toBeLessThan(2);
  await assertNoPageOverflow(page, "project footer at 390px");
});

test("required attribution, independent-project language, and official alternative are exact", async ({
  page,
}) => {
  for (const route of ["/", "/getting-started/"]) {
    await test.step(`${route} displays the required notice`, async () => {
      await gotoLoaded(page, route);
      const main = page.locator("main");
      await expect(main.getByText(DISCLAIMER, { exact: true })).toBeVisible();
      await expect(main).not.toContainText(OFFICIAL_ENDPOINT);
      await expect(
        main.locator('aside[aria-label="Independent integration for Trello"]'),
      ).toHaveClass(/starlight-aside--note/);
      const officialLink = main
        .locator('a[href="https://trello.com/mcp"]')
        .first();
      await expect(officialLink).toBeVisible();
      await expect(officialLink).not.toHaveText("");
    });
  }

  for (const route of [
    "/getting-started/clients/",
    "/getting-started/trello-api-key/",
  ]) {
    await test.step(`${route} has no duplicate project banner`, async () => {
      await gotoLoaded(page, route);
      const main = page.locator("main");
      await expect(main).not.toContainText(DISCLAIMER);
      await expect(
        main.locator(
          'aside[aria-label="Independent integration for Trello"], aside[aria-label="Independent project"]',
        ),
      ).toHaveCount(0);
      await expect(
        main.locator('a[href="https://trello.com/mcp"]'),
      ).toHaveCount(0);
      await expect(main).not.toContainText(OFFICIAL_ENDPOINT);
      await expect(main).not.toContainText("developed by Antoine Ménard");
    });
  }

  await gotoLoaded(page, "/guides/faq/");
  await expect(page.locator("main")).toContainText(OFFICIAL_ENDPOINT);
  await expect(page.locator("main")).not.toContainText(
    "developed by Antoine Ménard",
  );

  await gotoLoaded(page, "/reference/");
  await expect(page.locator("main")).not.toContainText(OFFICIAL_ENDPOINT);
  await expect(
    page.locator(
      'main a[href="https://support.atlassian.com/trello/docs/connect-trello-to-ai-assistants-with-trello-mcp/"]',
    ),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    "developed by Antoine Ménard",
  );
});

test("installation guidance names the image, recommends reproducible tags, and links source-built HTTP correctly", async ({
  page,
}) => {
  await gotoLoaded(page, "/getting-started/docker/");
  const main = page.locator("main");

  await expect(
    main.getByRole("heading", {
      name: "Install and distribution",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    main.getByText("ghcr.io/enthouan/trello-mcp", { exact: true }).first(),
  ).toBeVisible();

  const tagTable = main.locator("table").filter({ hasText: "sha-<commit>" });
  await expect(tagTable).toContainText(
    "Pins one exact release. This is the recommended choice for reproducible deployments.",
  );
  await expect(tagTable).toContainText(
    "Follows the current main branch build and can change whenever main publishes.",
  );
  await expect(main).toContainText(
    "Set TRELLO_MCP_IMAGE_TAG to an exact published X.Y.Z release before starting.",
  );
  await expect(
    main.locator("pre").filter({
      hasText: "Select-String -Path .env -Pattern '^TRELLO_MCP_IMAGE_TAG=",
    }),
  ).toBeVisible();
  const publishedPowerShell = main
    .locator('pre[data-language="powershell"]')
    .filter({
      hasText: "docker compose up -d --wait --wait-timeout 120",
    });
  await expect(publishedPowerShell).toContainText(
    "^TRELLO_API_KEY=(?!replace-me$).+$",
  );
  await expect(publishedPowerShell).toContainText(
    "^TRELLO_TOKEN=(?!replace-me$).+$",
  );
  await expect(
    main.getByRole("heading", { name: "Windows PowerShell", exact: true }),
  ).toBeVisible();

  await expect(
    main.getByRole("heading", { name: "Local Docker build", exact: true }),
  ).toBeVisible();
  await expect(
    main.locator("pre").filter({
      hasText: "docker compose -f docker-compose.local.yml up --build",
    }),
  ).toBeVisible();
  for (const localUrl of [
    "http://127.0.0.1:3000/mcp",
    "http://127.0.0.1:3000/healthz",
    "http://127.0.0.1:3000/readyz",
  ]) {
    await expect(
      main.getByText(localUrl, { exact: true }).first(),
    ).toBeVisible();
  }
  await expect(main).not.toContainText("http://localhost:3000");

  await gotoLoaded(page, "/getting-started/http/");
  const sourceBuildPowerShell = page
    .locator('main pre[data-language="powershell"]')
    .filter({
      hasText:
        "docker compose -f docker-compose.local.yml up --build -d --wait --wait-timeout 120",
    });
  await expect(sourceBuildPowerShell).toContainText(
    "^TRELLO_API_KEY=(?!replace-me$).+$",
  );
  await expect(sourceBuildPowerShell).toContainText(
    "^TRELLO_TOKEN=(?!replace-me$).+$",
  );

  await gotoLoaded(page, "/getting-started/clients/");
  await expect(
    page.getByRole("link", { name: "local Docker build", exact: true }),
  ).toHaveAttribute("href", "/getting-started/docker/#local-docker-build");
});

test("README publishing, canonical website builds, local QA, and OCI metadata stay on the documented safe defaults", async () => {
  const [
    readme,
    releaseWorkflow,
    buildWorkflow,
    contributing,
    websiteReadme,
    packageSource,
    websitePackageSource,
    workspaceSource,
    astroConfig,
    robotsSource,
    publicationSource,
    cloudflareHeaders,
  ] = await Promise.all([
    readFile(new URL("../../README.md", import.meta.url), "utf8"),
    readFile(
      new URL("../../.github/workflows/release.yml", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../.github/workflows/build-and-test.yml", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../../CONTRIBUTING.md", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../../package.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../../pnpm-workspace.yaml", import.meta.url), "utf8"),
    readFile(new URL("../astro.config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/robots.txt.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/data/publication.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/_headers", import.meta.url), "utf8"),
  ]);
  const packageScripts = (
    JSON.parse(packageSource) as { scripts: Record<string, string> }
  ).scripts;
  const websitePackage = JSON.parse(websitePackageSource) as {
    name: string;
    private: boolean;
    scripts: Record<string, string>;
  };

  expect(readme).not.toContain("docker run --rm -p 3000:3000");
  expect(
    readme.match(/docker run --rm -p 127\.0\.0\.1:3000:3000/g),
  ).toHaveLength(2);
  expect(readme).toContain("docker compose up -d --wait --wait-timeout 120");
  expect(readme).toContain(
    "docker compose -f docker-compose.local.yml up --build -d --wait --wait-timeout 120",
  );
  expect(readme).toContain("[trello-mcp.com](https://trello-mcp.com/)");
  for (const route of [
    "/getting-started/",
    "/getting-started/trello-api-key/",
    "/getting-started/clients/",
    "/reference/tools/",
    "/reference/api-coverage/",
    "/guides/security/",
    "/guides/operations/",
    "/guides/troubleshooting/",
  ]) {
    expect(readme).toContain(`${CANONICAL_WEBSITE_ORIGIN}${route}`);
  }
  expect(releaseWorkflow).toContain(
    `org.opencontainers.image.url=\${{ github.server_url }}/\${{ github.repository }}`,
  );
  expect(releaseWorkflow).not.toContain("trello-mcp.antoinemenard.com");
  expect(
    buildWorkflow.match(/actions\/checkout@v7\n\s+with:\n\s+fetch-depth: 0/g),
  ).toHaveLength(1);
  expect(packageScripts["website:dev"]).toBe("pnpm --dir website dev");
  expect(packageScripts["website:build"]).toBe("pnpm --dir website build");
  expect(packageScripts["website:preview"]).toBe("pnpm --dir website preview");
  expect(websitePackage).toMatchObject({
    name: "trello-mcp-website",
    private: true,
    scripts: {
      dev: "ASTRO_DEV_BACKGROUND=0 astro dev",
      build: "astro build",
      preview: "ASTRO_PREVIEW_BACKGROUND=0 astro preview",
      typecheck: "astro check --minimumFailingSeverity warning",
    },
  });
  expect(websitePackage).toHaveProperty("devDependencies", {
    "@astrojs/check": "0.9.10",
    "@astrojs/markdown-remark": "7.2.2",
    "@astrojs/starlight": "0.41.7",
    "@fortawesome/free-brands-svg-icons": "7.3.1",
    "@fortawesome/free-solid-svg-icons": "7.3.1",
    astro: "7.2.0",
    sharp: "0.35.3",
    typescript: "6.0.3",
  });
  expect(workspaceSource).toMatch(/^packages:\n\s+- website\s*$/);
  for (const deprecatedScript of [
    "site:dev",
    "site:build",
    "site:build:production",
    "site:preview",
  ]) {
    expect(packageScripts).not.toHaveProperty(deprecatedScript);
  }
  expect(astroConfig).toContain("site: CANONICAL_WEBSITE_URL");
  expect(astroConfig).not.toContain("PageSidebar");
  expect(robotsSource).toContain("CANONICAL_WEBSITE_URL");
  expect(publicationSource.trim()).toBe(
    `export const CANONICAL_WEBSITE_URL = "${CANONICAL_WEBSITE_URL}";`,
  );
  for (const source of [astroConfig, robotsSource, publicationSource]) {
    expect(source).not.toMatch(
      /node:process|WEBSITE_(?:BASE_URL|PUBLICATION_MODE)/,
    );
  }
  for (const command of [
    "pnpm docs:check",
    "pnpm site:og:check",
    "pnpm site:check",
    "pnpm website:build",
    "pnpm site:test",
  ]) {
    expect(buildWorkflow).toContain(command);
  }
  for (const deploymentMarker of [
    "deploy-website",
    "cloudflare/wrangler-action",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "SITE_URL",
    "WEBSITE_BASE_URL",
    "WEBSITE_PUBLICATION_MODE",
    "site:build:production",
    "pnpm site:visual",
    "pnpm site:lighthouse",
    "playwright install --with-deps chromium webkit",
    "pages deploy",
  ]) {
    expect(buildWorkflow).not.toContain(deploymentMarker);
  }
  expect(buildWorkflow).toContain(
    "PLAYWRIGHT_USE_EXISTING_BUILD=1 pnpm site:test",
  );
  expect(contributing).toContain(
    [
      "corepack pnpm website:build",
      "corepack pnpm exec playwright install --with-deps chromium",
      "corepack pnpm site:test",
    ].join("\n"),
  );
  expect(contributing).toContain(
    "Cloudflare Pages should run `corepack pnpm website:build`",
  );
  expect(contributing).toMatch(/no website environment\s+variable is required/);
  expect(contributing).not.toMatch(
    /WEBSITE_(?:BASE_URL|PUBLICATION_MODE)|SITE_URL|site:build:production/,
  );
  expect(contributing).toContain(
    "Run `corepack pnpm site:visual` for the smaller desktop/mobile",
  );
  expect(contributing).toContain(
    "`corepack pnpm site:lighthouse` when a release or",
  );
  for (const command of [
    "corepack pnpm docs:tools",
    "corepack pnpm docs:check",
    "corepack pnpm site:og:check",
    "corepack pnpm site:check",
    "corepack pnpm website:build",
    "corepack pnpm site:test",
    "corepack pnpm website:dev",
    "corepack pnpm website:preview",
  ]) {
    expect(websiteReadme).toContain(command);
  }
  expect(websiteReadme).toContain(CANONICAL_WEBSITE_URL);
  expect(websiteReadme).toContain("X-Robots-Tag: noindex");
  expect(websiteReadme).toContain("public/_redirects");
  expect(websiteReadme).toContain("public/_headers");
  expect(websiteReadme).not.toMatch(
    /WEBSITE_(?:BASE_URL|PUBLICATION_MODE)|SITE_URL|site:build:production/,
  );
  expect(cloudflareHeaders.trim()).toBe(
    [
      "/*",
      "  X-Content-Type-Options: nosniff",
      "  Referrer-Policy: strict-origin-when-cross-origin",
      "  X-Frame-Options: DENY",
      "  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    ].join("\n"),
  );
  expect(cloudflareHeaders).not.toContain("Content-Security-Policy");
});

test("transport guides preserve Trello-specific runtime and security boundaries", async ({
  page,
}) => {
  await gotoLoaded(page, "/getting-started/docker/");
  const dockerGuide = page.locator("main");
  await expect(dockerGuide).toContainText("127.0.0.1:3000:3000");
  await expect(dockerGuide).toContainText("TRELLO_MCP_IMAGE_TAG");
  await expect(dockerGuide).toContainText("ghcr.io/enthouan/trello-mcp");
  await expect(dockerGuide).toContainText(
    "docker compose -f docker-compose.local.yml up --build",
  );
  await expect(dockerGuide).toContainText("auth_whoami");

  await gotoLoaded(page, "/getting-started/http/");
  const httpGuide = page.locator("main");
  await expect(httpGuide).toContainText(
    "Direct Node.js HTTP is not loopback-constrained",
  );
  await expect(httpGuide).toContainText("MCP_AUTH_TOKEN");
  await expect(httpGuide).toContainText("terminate TLS at a reverse proxy");
  await expect(httpGuide).toContainText(
    "trello-mcp does not implement that option",
  );
  expect(
    (await httpGuide.locator("pre").allTextContents()).join("\n"),
  ).not.toContain("HOST=127.0.0.1");
  await expect(httpGuide).not.toContainText("MCP_ALLOWED_ORIGINS");
  await expect(httpGuide).not.toContainText(
    "refuses an unauthenticated non-loopback bind",
  );

  await gotoLoaded(page, "/getting-started/stdio/");
  const stdioGuide = page.locator("main");
  await expect(stdioGuide).toContainText("No network listener is opened");
  await expect(stdioGuide).toContainText("TRANSPORT=stdio");
  await expect(stdioGuide).toContainText("TRELLO_API_KEY");
  await expect(stdioGuide).toContainText("TRELLO_TOKEN");
  await expect(stdioGuide).toContainText(
    "/absolute/path/to/trello-mcp/dist/index.js",
  );
});

test("the onboarding overview preserves prior deep links and points to the split guides", async ({
  page,
}) => {
  const legacyAnchors = [
    "before-you-begin",
    "install-and-distribution",
    "docker-streamable-http",
    "local-docker-build",
    "local-stdio",
    "connect-a-client",
    "verify-safely",
    "next-steps",
  ] as const;

  await gotoLoaded(page, "/getting-started/");
  for (const anchor of legacyAnchors) {
    await expect(page.locator(`#${anchor}`)).toHaveCount(1);
  }

  for (const [name, href] of [
    ["Docker Compose", "/getting-started/docker/"],
    ["Streamable HTTP", "/getting-started/http/"],
    ["stdio", "/getting-started/stdio/"],
  ] as const) {
    await expect(
      page.getByRole("link", { name, exact: true }).last(),
    ).toHaveAttribute("href", href);
  }

  for (const anchor of legacyAnchors) {
    await page.goto(`/getting-started/#${anchor}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(`#${anchor}`)).toHaveCount(1);
  }
});

test("onboarding uses native client and installation tabs", async ({
  page,
}) => {
  await gotoLoaded(page, "/getting-started/");
  const clientTabs = page.locator(
    'main starlight-tabs[data-sync-key="mcp-client"]',
  );
  await expect(clientTabs).toHaveCount(1);
  await expect(clientTabs.getByRole("tab")).toHaveText([
    "Codex",
    "Claude Code",
    "Claude Desktop",
    "VS Code",
    "OpenCode",
  ]);
  const quickClientIcons = [
    "openai",
    "claude",
    "claude",
    "vscode",
    "opencode",
  ] as const;
  for (const [index, icon] of quickClientIcons.entries()) {
    const tab = clientTabs.getByRole("tab").nth(index);
    await expect(tab).toHaveAttribute("data-client-icon", icon);
    const renderedIcon = await tab.evaluate((element) => {
      const styles = getComputedStyle(element, "::before");
      return {
        content: styles.content,
        maskImage:
          styles.getPropertyValue("-webkit-mask-image") || styles.maskImage,
      };
    });
    expect(renderedIcon.content).not.toBe("none");
    expect(renderedIcon.maskImage).toContain("data:image/svg+xml");
    expect(renderedIcon.maskImage).not.toContain("/client-icons/");
  }

  const quickClientLayout = await clientTabs
    .getByRole("tab")
    .evaluateAll((tabs) => {
      const tabList = tabs[0]?.closest<HTMLElement>('[role="tablist"]');
      return {
        clientWidth: tabList?.clientWidth ?? 0,
        nowrap: tabs.every(
          (tab) => getComputedStyle(tab).whiteSpace === "nowrap",
        ),
        scrollWidth: tabList?.scrollWidth ?? Number.POSITIVE_INFINITY,
        topPositions: tabs.map((tab) =>
          Math.round(tab.getBoundingClientRect().top),
        ),
      };
    });
  expect(new Set(quickClientLayout.topPositions).size).toBe(1);
  expect(quickClientLayout.nowrap).toBe(true);
  expect(quickClientLayout.scrollWidth).toBeLessThanOrEqual(
    quickClientLayout.clientWidth + 1,
  );

  const installTabs = page.locator(
    'main starlight-tabs[data-sync-key="install-method"]',
  );
  await expect(installTabs).toHaveCount(1);
  await expect(installTabs.getByRole("tab")).toHaveText([
    "Local stdio",
    "HTTP · published image",
    "HTTP · source build",
  ]);
  for (const [label, href, expectedCommands] of [
    ["Local stdio", "/getting-started/stdio/", ['TRANSPORT": "stdio']],
    [
      "HTTP · published image",
      "/getting-started/docker/",
      [
        "Set TRELLO_API_KEY to a non-placeholder value",
        "Set TRELLO_TOKEN to a non-placeholder value",
        "Set TRELLO_MCP_IMAGE_TAG to an exact published X.Y.Z release",
        "docker compose up -d --wait --wait-timeout 120",
        "curl -fsS http://127.0.0.1:3000/healthz",
        "curl -fsS http://127.0.0.1:3000/readyz",
      ],
    ],
    [
      "HTTP · source build",
      "/getting-started/http/",
      [
        "Set TRELLO_API_KEY to a non-placeholder value",
        "Set TRELLO_TOKEN to a non-placeholder value",
        "docker compose -f docker-compose.local.yml up --build -d --wait --wait-timeout 120",
        "curl -fsS http://127.0.0.1:3000/healthz",
        "curl -fsS http://127.0.0.1:3000/readyz",
      ],
    ],
  ] as const) {
    await installTabs.getByRole("tab", { name: label, exact: true }).click();
    const activePanel = installTabs.locator(
      ":scope > [role='tabpanel']:not([hidden])",
    );
    await expect(activePanel).toBeVisible();
    for (const command of expectedCommands) {
      await expect(activePanel.locator("pre")).toContainText(command);
    }
    await expect(
      installTabs.getByRole("link", {
        name: new RegExp(`complete ${label} guide`, "i"),
      }),
    ).toHaveAttribute("href", href);
  }

  await page.goto("/getting-started/#codex", { waitUntil: "networkidle" });
  await expect(
    page.locator(
      'main starlight-tabs[data-sync-key="mcp-client"] [role="tab"][aria-selected="true"]',
    ),
  ).toHaveText("Codex");
  for (const [hash, label] of [
    ["vscode", "VS Code"],
    ["opencode", "OpenCode"],
  ] as const) {
    await page.goto(`/getting-started/#${hash}`, { waitUntil: "networkidle" });
    await expect(
      page.locator(
        'main starlight-tabs[data-sync-key="mcp-client"] [role="tab"][aria-selected="true"]',
      ),
    ).toHaveText(label);
  }

  await gotoLoaded(page, "/getting-started/clients/");
  const clientHeadings = [
    ["Codex", "codex"],
    ["Claude Code", "claude-code"],
    ["Claude Desktop", "claude-desktop"],
    ["VS Code", "vs-code"],
    ["OpenCode", "opencode"],
    ["MCP Inspector and manual clients", "mcp-inspector-and-manual-clients"],
  ] as const;
  await expect(
    page.locator(
      `main ${clientHeadings.map(([, id]) => `h2#${id}`).join(", main ")}`,
    ),
  ).toHaveText(clientHeadings.map(([name]) => name));
  for (const [name, id] of clientHeadings) {
    const heading = page.getByRole("heading", { level: 2, name, exact: true });
    await expect(heading).toHaveAttribute("id", id);
    await expect(heading).toHaveAccessibleName(name);

    const renderedIcon = await heading.evaluate((element) => {
      const styles = getComputedStyle(element, "::before");
      return {
        content: styles.content,
        height: Number.parseFloat(styles.height),
        maskImage:
          styles.getPropertyValue("-webkit-mask-image") || styles.maskImage,
        width: Number.parseFloat(styles.width),
      };
    });
    expect(renderedIcon.content).not.toBe("none");
    expect(renderedIcon.width).toBeGreaterThan(0);
    expect(renderedIcon.height).toBeGreaterThan(0);
    expect(renderedIcon.maskImage).toContain("data:image/svg+xml");
    expect(renderedIcon.maskImage).not.toContain("/client-icons/");
  }

  const transportTabs = page.locator(
    'main starlight-tabs[data-sync-key="client-transport"]',
  );
  await expect(transportTabs).toHaveCount(5);
  await expect(transportTabs.getByRole("tab")).toHaveText([
    "Local stdio",
    "Streamable HTTP",
    "Local stdio",
    "Streamable HTTP",
    "Local stdio",
    "Streamable HTTP",
    "Local stdio",
    "Streamable HTTP",
    "Local stdio",
    "Streamable HTTP",
  ]);

  await transportTabs
    .first()
    .getByRole("tab", { name: "Streamable HTTP", exact: true })
    .click();
  for (const tabs of await transportTabs.all()) {
    await expect(
      tabs.getByRole("tab", { name: "Streamable HTTP", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      tabs.getByRole("tab", { name: "Local stdio", exact: true }),
    ).toHaveAttribute("aria-selected", "false");
    await expect(
      tabs.locator(":scope > [role='tabpanel']:not([hidden])"),
    ).toBeVisible();
  }
  expect(
    await page.evaluate(() =>
      localStorage.getItem("starlight-synced-tabs__client-transport"),
    ),
  ).toBe("Streamable HTTP");

  await page.reload({ waitUntil: "networkidle" });
  await expect(
    page.locator(
      'main starlight-tabs[data-sync-key="client-transport"] [role="tab"][aria-selected="true"]',
    ),
  ).toHaveText([
    "Streamable HTTP",
    "Streamable HTTP",
    "Streamable HTTP",
    "Streamable HTTP",
    "Streamable HTTP",
  ]);

  const verificationSteps = page
    .locator("main ol.sl-steps")
    .filter({ hasText: "Confirm the client reports" });
  await expect(verificationSteps).toHaveCount(1);
  await expect(verificationSteps.locator(":scope > li")).toHaveCount(4);
});

test("compatibility evidence keeps the shared client order", async ({
  page,
}) => {
  await gotoLoaded(page, "/getting-started/compatibility/");

  await expect(
    page.locator("main table").first().locator("tbody tr > td:first-child"),
  ).toHaveText([
    "Codex CLI",
    "Claude Code",
    "Claude Desktop",
    "VS Code",
    "OpenCode",
    "MCP Inspector",
  ]);
  await expect(page.locator("main h3")).toHaveText([
    "Codex",
    "Claude Code",
    "Claude Desktop",
    "VS Code",
    "OpenCode",
    "MCP Inspector",
  ]);
});

test("removed client branding and version labels stay out of the public setup docs", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/getting-started/",
    "/getting-started/clients/",
    "/getting-started/compatibility/",
  ]) {
    await gotoLoaded(page, route);
    await expect(page.locator("main")).not.toContainText(/\bCursor\b/);
    await expect(page.locator("main")).not.toContainText(/OpenCode V\d/i);
  }
});

test("onboarding remains complete without client-side enhancement", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    const response = await page.goto("/getting-started/", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    const clientSetups = page.locator("[data-client-setups]");
    const enhancedTabs = clientSetups.locator(
      ':scope > starlight-tabs[data-sync-key="mcp-client"]',
    );
    await expect(enhancedTabs).toHaveCount(1);
    await expect(enhancedTabs).toBeHidden();
    const fallbackSections = clientSetups.locator(
      'section[aria-labelledby^="no-script-"]',
    );
    await expect(fallbackSections).toHaveCount(5);
    await expect(fallbackSections.locator("h3[id^='no-script-']")).toHaveText([
      "Codex",
      "Claude Code",
      "Claude Desktop",
      "VS Code",
      "OpenCode",
    ]);
    await expect(
      fallbackSections.getByText("Protect the Trello credentials:", {
        exact: true,
      }),
    ).toHaveCount(5);
    await expect(
      page.getByRole("heading", { name: "Codex", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "OpenCode", exact: true }),
    ).toBeVisible();
    const fallbackGuides = page.getByRole("navigation", {
      name: "Installation guides without JavaScript",
    });
    for (const [name, href] of [
      ["local stdio", "/getting-started/stdio/"],
      ["published-image HTTP", "/getting-started/docker/"],
      ["source-built HTTP", "/getting-started/http/"],
    ] as const) {
      await expect(
        fallbackGuides.getByRole("link", { name, exact: true }),
      ).toHaveAttribute("href", href);
    }
  } finally {
    await context.close();
  }
});

test("onboarding follows the dependency order and shows a sanitized verification result", async ({
  page,
}) => {
  await gotoLoaded(page, "/getting-started/");
  const main = page.locator("main");
  const headings = await main.locator("h2").allTextContents();
  const expectedOrder = [
    "Prerequisites",
    "Common path",
    "Choose a transport, then an installation",
    "Configure your client",
    "Next",
  ];
  expect(headings.filter((heading) => expectedOrder.includes(heading))).toEqual(
    expectedOrder,
  );

  await expect(
    page.getByRole("complementary", { name: "Protect Streamable HTTP" }),
  ).toBeVisible();
  const verificationExample = main.locator("figure").filter({
    hasText: "Sanitized example response",
  });
  await expect(verificationExample.first()).toContainText('"id": "member-id"');
  await expect(verificationExample.first()).toContainText(
    '"username": "your-username"',
  );
  await expect(verificationExample.first()).not.toContainText(
    /TRELLO_(?:API_KEY|TOKEN)|MCP_AUTH_TOKEN|Authorization/i,
  );
});

test("homepage uses descriptive SEO and complete social metadata", async ({
  page,
  request,
}) => {
  await gotoLoaded(page, "/");

  await expect(page).toHaveTitle(
    "Self-hosted, auditable Trello MCP server — trello-mcp",
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#0052cc",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "A self-hosted, auditable Model Context Protocol server for broad Trello automation.",
  );
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute("href", CANONICAL_WEBSITE_URL);
  const canonicalHref = await canonical.getAttribute("href");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "website",
  );

  const structuredData = page.locator('script[type="application/ld+json"]');
  await expect(structuredData).toHaveCount(1);
  const websiteSchema = JSON.parse((await structuredData.textContent()) ?? "");
  expect(websiteSchema).toEqual({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "trello-mcp",
    url: canonicalHref,
    description:
      "A self-hosted, auditable Model Context Protocol server for broad Trello automation.",
  });

  const openGraphImage = page.locator('meta[property="og:image"]');
  const twitterImage = page.locator('meta[name="twitter:image"]');
  await expect(openGraphImage).toHaveAttribute(
    "content",
    `${CANONICAL_WEBSITE_URL}social-card.png`,
  );
  await expect(twitterImage).toHaveAttribute(
    "content",
    `${CANONICAL_WEBSITE_URL}social-card.png`,
  );
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute(
    "content",
    "image/png",
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
    "content",
    "1200",
  );
  await expect(
    page.locator('meta[property="og:image:height"]'),
  ).toHaveAttribute("content", "630");
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    "content",
    "trello-mcp — independent, self-hosted Trello MCP server",
  );

  const socialImageUrl = await openGraphImage.getAttribute("content");
  expect(socialImageUrl, "Open Graph image URL must be present").toBeTruthy();
  expect(await twitterImage.getAttribute("content")).toBe(socialImageUrl);
  const socialImagePath = new URL(
    socialImageUrl ?? "http://localhost/social-card.png",
  ).pathname;
  const socialImageResponse = await request.get(socialImagePath, {
    failOnStatusCode: false,
  });
  expect(socialImageResponse.status(), "Social image must resolve").toBe(200);
  expect(socialImageResponse.headers()["content-type"]).toContain("image/png");
  const socialImageBytes = await socialImageResponse.body();
  expect(socialImageBytes.subarray(1, 4).toString()).toBe("PNG");
  expect(socialImageBytes.readUInt32BE(16)).toBe(1200);
  expect(socialImageBytes.readUInt32BE(20)).toBe(630);

  const socialSource = await readFile(
    new URL("../og-image.html", import.meta.url),
    "utf8",
  );
  expect(socialSource).toContain("data-social-card");
  expect(socialSource).toContain("Manage Trello from");
  expect(socialSource).toContain("your MCP client.");
  expect(socialSource).toContain("Self-hosted, auditable Trello automation.");
  expect(socialSource).toContain("Independent community project");
  expect(socialSource).not.toContain("trello-mcp.com");
  expect(socialSource).toContain("--og-accent: #0052cc;");
  expect(socialSource).toContain('<svg viewBox="0 0 64 64"');
  expect(socialSource).not.toContain("<img");

  const socialManifest = JSON.parse(
    await readFile(
      new URL("../og-image.manifest.json", import.meta.url),
      "utf8",
    ),
  ) as { height: number; schemaVersion: number; width: number };
  expect(socialManifest).toMatchObject({
    schemaVersion: 1,
    width: 1200,
    height: 630,
  });

  await gotoLoaded(page, "/getting-started/");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "article",
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
    0,
  );
});

test("client icons are generated locally from Font Awesome", async ({
  request,
}) => {
  const response = await request.get("/client-icons.css", {
    failOnStatusCode: false,
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/css");

  const css = await response.text();
  expect(css).toContain("Font Awesome Free 7.3.1");
  expect(css).toContain("CC BY 4.0");
  expect(css).toContain("https://fontawesome.com/license/free");
  expect(css.match(/data:image\/svg\+xml/g) ?? []).toHaveLength(6);
  expect(css).not.toMatch(/url\(["']?https?:/);

  for (const [name, [prefix, iconName]] of Object.entries(
    CLIENT_ICON_SOURCES,
  )) {
    expect(css).toContain(`/* ${name}: ${prefix} ${iconName} */`);
    expect(css).toContain(`--client-icon-${name}:`);

    const legacyResponse = await request.get(`/client-icons/${name}.svg`, {
      failOnStatusCode: false,
    });
    expect(legacyResponse.status()).toBe(404);
  }
});

test("homepage keeps two hero actions and exposes setup, workflows, clients, and trust evidence", async ({
  page,
}) => {
  await gotoLoaded(page, "/");

  const heroTitle = page.locator("main h1");
  await expect(heroTitle).toHaveAccessibleName(HERO_TITLE);
  const heroTitleBreak = heroTitle.locator("br");
  await expect(heroTitleBreak).toHaveCount(1);
  expect(
    await heroTitleBreak.evaluate(
      (element) => element.previousSibling?.textContent,
    ),
  ).toBe("Manage Trello");
  expect(
    await heroTitleBreak.evaluate(
      (element) => element.nextSibling?.textContent,
    ),
  ).toBe("from your MCP client.");
  await expect(page.locator(".hero .tagline")).toHaveText(HERO_TAGLINE);
  const inlineTextLink = page.getByRole("link", {
    name: "Trello MCP",
    exact: true,
  });
  expect(
    await inlineTextLink.evaluate(
      (element) => getComputedStyle(element).textDecorationLine,
    ),
  ).toContain("underline");
  await inlineTextLink.hover();
  await expect
    .poll(() =>
      inlineTextLink.evaluate(
        (element) => getComputedStyle(element).textDecorationLine,
      ),
    )
    .toBe("none");
  const heroActions = page.locator(".hero .actions a.sl-link-button");
  await expect(heroActions).toHaveCount(2);
  const getStartedAction = heroActions.nth(0);
  await expect(getStartedAction).toHaveText("Get started");
  await expect(getStartedAction).toHaveAttribute("href", "/getting-started/");
  const githubAction = heroActions.nth(1);
  await expect(githubAction).toHaveText("View on GitHub");
  await expect(githubAction).toHaveClass(/secondary/);
  await expect(githubAction).toHaveAttribute("data-github-action", "true");
  await expect(githubAction).toHaveAttribute("rel", "external");
  await expect(githubAction).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(githubAction.locator("svg")).toHaveCount(1);
  await expect(githubAction.locator("svg")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  const githubActionMarkup = await githubAction.evaluate(
    (element) => element.innerHTML,
  );
  expect(githubActionMarkup.indexOf("<svg")).toBeLessThan(
    githubActionMarkup.indexOf("View on GitHub"),
  );

  for (const [theme, expectedHoverRing] of [
    ["light", "rgb(0, 82, 204)"],
    ["dark", "rgb(87, 157, 255)"],
  ] as const) {
    await page.locator("html").evaluate((element, nextTheme) => {
      element.dataset.theme = nextTheme;
    }, theme);
    const [getStartedActionStyle, githubActionStyle] = await Promise.all([
      getStartedAction.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          backgroundColor: styles.backgroundColor,
          fontWeight: styles.fontWeight,
        };
      }),
      githubAction.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor,
          borderRadius: styles.borderRadius,
          color: styles.color,
          fontWeight: styles.fontWeight,
        };
      }),
    ]);
    expect(getStartedActionStyle.fontWeight).toBe("700");
    expect(githubActionStyle.backgroundColor).toBe("rgb(24, 23, 23)");
    expect(githubActionStyle.color).toBe("rgb(255, 255, 255)");
    expect(githubActionStyle.fontWeight).toBe("700");
    expect(Number.parseFloat(githubActionStyle.borderRadius)).toBeGreaterThan(
      1_000,
    );
    expect(githubActionStyle.borderColor).not.toBe("rgba(0, 0, 0, 0)");

    for (const [action, expectedBackground] of [
      [getStartedAction, getStartedActionStyle.backgroundColor],
      [githubAction, githubActionStyle.backgroundColor],
    ] as const) {
      await action.hover();
      await expect
        .poll(() =>
          action.evaluate((element) => getComputedStyle(element).boxShadow),
        )
        .toContain(`${expectedHoverRing} 0px 0px 0px 5px`);
      await expect
        .poll(() =>
          action.evaluate((element) => getComputedStyle(element).transform),
        )
        .toBe("none");
      await expect
        .poll(() =>
          action.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          ),
        )
        .toBe(expectedBackground);
      await heroTitle.hover();
    }
  }

  for (const title of [
    "77 catalog-backed tools",
    "Choose your trust boundary",
    "Trello secrets stay out of prompts",
    "Archive before delete",
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("link", { name: "See all 77 tools", exact: true }),
  ).toHaveAttribute("href", "/reference/tools/");
  await expect(page.locator("main")).toContainText(
    "Wider HTTP access must be deliberate and protected",
  );
  await expect(page.locator("main")).not.toContainText("Local by default");
  await expect(page.locator("main")).toContainText(
    "MCP client approval remains the enforcement boundary",
  );

  const cardExampleHeading = page.getByRole("heading", {
    name: "Let your MCP client create a Trello card for you",
  });
  await expect(cardExampleHeading).toBeVisible();
  const cardExamplePrompt = page
    .locator("main figure")
    .filter({ hasText: "Card creation example prompt" });
  await expect(cardExamplePrompt).toContainText("Show me my Trello boards.");
  await expect(cardExamplePrompt).toContainText("wait for my confirmation");
  await expect(page.locator("main")).toContainText(
    "passes the selected boardId to board_lists",
  );
  await expect(page.locator("main")).toContainText(
    "the client proposes card_create",
  );
  const cardExampleCodeGeometry = await cardExamplePrompt
    .locator("pre")
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(cardExampleCodeGeometry.scrollWidth).toBeLessThanOrEqual(
    cardExampleCodeGeometry.clientWidth + 1,
  );

  const cardExampleOrder = await page.locator("main").evaluate((main) => {
    const proofGrid = main.querySelector(".card-grid");
    const cardExample = main.querySelector(
      "#let-your-mcp-client-create-a-trello-card-for-you",
    );
    const clientPicker = main.querySelector("#pick-your-mcp-client");
    const useful = main.querySelector("#useful-by-design");
    if (!proofGrid || !cardExample || !clientPicker || !useful) {
      return false;
    }

    return (
      Boolean(
        proofGrid.compareDocumentPosition(cardExample) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ) &&
      Boolean(
        cardExample.compareDocumentPosition(clientPicker) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ) &&
      Boolean(
        clientPicker.compareDocumentPosition(useful) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      )
    );
  });
  expect(cardExampleOrder).toBe(true);

  const writeCaution = page.getByRole("complementary", {
    name: "Before approving a write",
  });
  await expect(writeCaution).toContainText("auth_whoami");
  await expect(writeCaution).toContainText(
    "use a disposable board for trial mutations",
  );

  await expect(
    page.getByRole("heading", { name: "Choose how to run trello-mcp" }),
  ).toHaveCount(0);
  await expect(page.locator("main starlight-tabs")).toHaveCount(0);

  for (const workflow of [
    "Find and summarize work",
    "Create and organize cards",
    "Coordinate with collaborators",
    "Track the details",
  ]) {
    await expect(page.getByText(workflow, { exact: true })).toBeVisible();
  }
  for (const toolChain of [
    "search → card_get → card_actions",
    "list_boards → board_lists → card_create → card_move",
    "card_members → card_member_add → card_comment_add",
    "card_checklists → card_checklist_item_create → card_custom_field_set",
  ]) {
    await expect(page.getByText(toolChain, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("link", { name: "Follow the workflow guide", exact: true }),
  ).toHaveAttribute("href", "/guides/workflows/");

  await expect(page.getByText("OpenCode", { exact: true })).toBeVisible();
  await expect(page.getByText("VS Code", { exact: true })).toBeVisible();
  const clientEvidenceCards = getClientPickerGrid(page);
  const clientCases = [
    [
      "Codex",
      "openai",
      "/getting-started/clients/#codex",
      "Connection and complete tool discovery tested — local stdio and authenticated Streamable HTTP. No live Trello workflow was run.",
    ],
    [
      "Claude Code",
      "claude",
      "/getting-started/clients/#claude-code",
      "Connection and complete tool discovery tested — local stdio and authenticated Streamable HTTP. No live Trello workflow was run.",
    ],
    [
      "Claude Desktop",
      "claude",
      "/getting-started/clients/#claude-desktop",
      "Connection and tool discovery tested — local stdio. No live Trello workflow was run.",
    ],
    [
      "VS Code",
      "vscode",
      "/getting-started/clients/#vs-code",
      "Configuration reviewed — user-profile stdio with password inputs and authenticated Streamable HTTP setup. No dated client run or live Trello call is claimed.",
    ],
    [
      "OpenCode",
      "opencode",
      "/getting-started/clients/#opencode",
      "Configuration reviewed — local stdio and authenticated Streamable HTTP setup. No dated client run or live Trello call is claimed.",
    ],
    [
      "All compatibility evidence",
      "evidence",
      "/getting-started/compatibility/",
      "See the dated environment, test boundaries, limitations, and live-validation status behind every client claim.",
    ],
  ] as const;
  await expect(
    clientEvidenceCards.locator(":scope > .sl-link-card"),
  ).toHaveCount(6);
  await expect(
    clientEvidenceCards.locator(":scope > .sl-link-card .title"),
  ).toHaveText(clientCases.map(([clientName]) => clientName));

  for (const [clientName, iconName, href, description] of clientCases) {
    const clientCard = clientEvidenceCards
      .locator(":scope > .sl-link-card")
      .filter({ hasText: clientName });
    const clientLink = clientCard.getByRole("link", {
      name: clientName,
      exact: true,
    });
    await expect(clientLink).toHaveAttribute("data-client-icon", iconName);
    await expect(clientLink).toHaveAttribute("href", href);
    await expect(clientCard.locator(".description")).toHaveText(description);

    const iconStyle = await clientLink.locator(".title").evaluate((element) => {
      const styles = getComputedStyle(element, "::before");
      const maskImages = [
        styles.maskImage,
        styles.getPropertyValue("-webkit-mask-image"),
      ];
      return {
        fontSize: getComputedStyle(element).fontSize,
        height: styles.height,
        maskImage:
          maskImages.find((value) => value && value !== "none") ?? "none",
        width: styles.width,
      };
    });
    expect(Number.parseFloat(iconStyle.width)).toBeGreaterThan(0);
    expect(Number.parseFloat(iconStyle.height)).toBeGreaterThan(0);
    expect(Number.parseFloat(iconStyle.width)).toBeCloseTo(
      Number.parseFloat(iconStyle.fontSize),
      1,
    );
    expect(iconStyle.maskImage).toContain("data:image/svg+xml");
    expect(iconStyle.maskImage).not.toContain("/client-icons/");
  }

  await expect(clientEvidenceCards).not.toContainText(/all \d+ tools/);
  await expect(clientEvidenceCards).not.toContainText(/exactly \d+ tools/);
  const clientHelper = page
    .locator("main p")
    .filter({ hasText: "Need another client or deployment route?" });
  await expect(clientHelper).toContainText(
    "Need another client or deployment route?",
  );
  await expect(
    clientHelper.getByRole("link", { name: "complete client setup guide" }),
  ).toHaveAttribute("href", "/getting-started/clients/");
  await expect(
    clientHelper.getByRole("link", { name: "different deployment path" }),
  ).toHaveAttribute("href", "/getting-started/");
  await expect(
    page.locator('main a[href="/getting-started/trello-api-key/"]').first(),
  ).toContainText("Trello API key and token");
  await expect(
    page.locator('main a[href="/guides/security/"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('main a[href="/guides/faq/"]').first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Why run this community server?" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Know when to use it" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Know where to go next" }),
  ).toHaveCount(0);
  const serviceComparison = page.locator("main table").filter({
    hasText: "Official Trello MCP",
  });
  await expect(serviceComparison).toHaveCount(1);
  await expect(serviceComparison.locator("thead th")).toHaveText([
    "Decision",
    "trello-mcp community server",
    "Official Trello MCP",
  ]);
  await expect(serviceComparison.locator("tbody tr")).toHaveCount(5);
  await expect(serviceComparison).toContainText(
    "Trello runs the cloud service",
  );
  await expect(serviceComparison).toContainText("OAuth 2.0 consent");
  await expect(serviceComparison).toContainText(
    "Each connection supports one authorized Workspace at launch",
  );
  await expect(serviceComparison).toContainText(
    "does not support permanent destructive deletes",
  );
  await expect(page.locator("main")).toContainText(
    "Comparison last checked August 10, 2026",
  );
  const roadmapLink = page.getByRole("link", {
    name: "public trello-mcp roadmap",
    exact: true,
  });
  await expect(roadmapLink).toHaveAttribute("href", ROADMAP_URL);
  await expect(page.locator("main")).toContainText("is itself a Trello board");
  await expect(
    page.locator(
      'main a[href="https://support.atlassian.com/trello/docs/connect-trello-to-ai-assistants-with-trello-mcp/"]',
    ),
  ).toHaveText("Trello’s official MCP documentation");
  for (const [name, href] of [
    ["Security & Data", "/guides/security/"],
    ["Configuration", "/reference/configuration/"],
    ["Troubleshooting", "/guides/troubleshooting/"],
    ["FAQ", "/guides/faq/"],
  ] as const) {
    await expect(
      page.locator("main").getByRole("link", { name, exact: true }).last(),
    ).toHaveAttribute("href", href);
  }
});

test("homepage previews the canonical searchable tool catalog", async ({
  page,
}) => {
  await gotoLoaded(page, "/");

  const heading = page.getByRole("heading", {
    name: "One canonical, searchable tool catalog",
  });
  await expect(heading).toBeVisible();

  const preview = page.locator("[data-catalog-preview]");
  await expect(preview).toHaveCount(1);
  await expect(preview).toHaveAttribute("data-tool-count", "77");
  await expect(preview).toHaveAttribute(
    "data-category-count",
    String(CATALOG_PREVIEW_CATEGORIES.length),
  );
  await expect(preview).toContainText("MCP method: tools/list");
  await expect(preview).toContainText(
    "77 tools loaded from the project catalog",
  );
  await expect(preview.locator("svg")).toHaveCount(1);

  const rows = preview.locator("[data-catalog-preview-row]");
  await expect(rows).toHaveCount(CATALOG_PREVIEW_CATEGORIES.length);
  for (const [
    category,
    label,
    count,
    toolNames,
  ] of CATALOG_PREVIEW_CATEGORIES) {
    const row = preview.locator(
      `[data-catalog-preview-row][data-category="${category}"]`,
    );
    await expect(row).toHaveCount(1);
    const categoryLink = row.getByRole("link", { name: label, exact: true });
    await expect(categoryLink).toHaveAttribute(
      "href",
      `/reference/tools/#tool-group-${category}`,
    );
    await expect(row.locator("dd strong")).toHaveText(String(count));
    for (const toolName of toolNames) {
      await expect(row.locator("dd")).toContainText(toolName);
    }
  }

  await expect(preview.locator("figcaption")).toHaveText(
    "Generated from the same registered tools and schemas as the server. It contains no credentials or Trello account data.",
  );

  for (const [theme, expected] of [
    [
      "light",
      {
        background: "rgb(255, 255, 255)",
        color: "rgb(23, 43, 77)",
        colorScheme: "light",
        surface: "rgb(237, 245, 255)",
      },
    ],
    [
      "dark",
      {
        background: "rgb(12, 22, 36)",
        color: "rgb(238, 246, 255)",
        colorScheme: "dark",
        surface: "rgb(22, 36, 58)",
      },
    ],
  ] as const) {
    await page.locator("html").evaluate((element, nextTheme) => {
      element.dataset.theme = nextTheme;
    }, theme);
    const [previewStyle, barBackground] = await Promise.all([
      preview.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          background: styles.backgroundColor,
          color: styles.color,
          colorScheme: styles.colorScheme,
        };
      }),
      preview
        .locator(".catalog-preview__bar")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    ]);
    expect(previewStyle).toEqual({
      background: expected.background,
      color: expected.color,
      colorScheme: expected.colorScheme,
    });
    expect(barBackground).toBe(expected.surface);
  }

  await expect(
    page.getByRole("link", { name: "Browse all 77 tools", exact: true }),
  ).toHaveAttribute("href", "/reference/tools/");
  await expect(
    page.getByRole("link", { name: "API coverage matrix", exact: true }),
  ).toHaveCount(0);

  const sectionOrder = await page.locator("main").evaluate((main) => {
    const automation = main.querySelector("#useful-by-design");
    const catalog = main.querySelector(
      "#one-canonical-searchable-tool-catalog",
    );
    const next = main.querySelector("#know-when-to-use-it");
    if (!automation || !catalog || !next) return false;
    return (
      Boolean(
        automation.compareDocumentPosition(catalog) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ) &&
      Boolean(
        catalog.compareDocumentPosition(next) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      )
    );
  });
  expect(sectionOrder).toBe(true);

  await page.setViewportSize({ width: 320, height: 568 });
  const previewGeometry = await preview.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(previewGeometry.scrollWidth).toBeLessThanOrEqual(
    previewGeometry.clientWidth + 1,
  );
  await assertNoPageOverflow(page, "homepage catalog preview");
});

test("homepage proof and client cards match the reference grids at desktop and mobile sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoLoaded(page, "/");

  const proofGrid = page.locator(".card-grid").first();
  const proofCards = proofGrid.locator(":scope > article.card");
  await expect(proofCards).toHaveCount(4);
  await expect(proofGrid.locator("svg.icon")).toHaveCount(4);

  const desktopLayout = await proofGrid.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      columns: styles.gridTemplateColumns.split(" ").length,
      gap: styles.gap,
    };
  });
  expect(desktopLayout).toEqual({ columns: 2, gap: "24px" });

  const clientGrid = getClientPickerGrid(page);
  const clientCards = clientGrid.locator(":scope > .sl-link-card");
  await expect(clientCards).toHaveCount(6);
  const desktopClientLayout = await clientGrid.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      columns: styles.gridTemplateColumns.split(" ").length,
      gap: styles.gap,
    };
  });
  expect(desktopClientLayout).toEqual({ columns: 2, gap: "24px" });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await proofGrid.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      columns: styles.gridTemplateColumns.split(" ").length,
      gap: styles.gap,
    };
  });
  expect(mobileLayout).toEqual({ columns: 1, gap: "16px" });
  const mobileClientLayout = await clientGrid.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      columns: styles.gridTemplateColumns.split(" ").length,
      gap: styles.gap,
    };
  });
  expect(mobileClientLayout).toEqual({ columns: 1, gap: "16px" });

  for (const card of await proofCards.all()) {
    const bounds = await card.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(15);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(375);
  }

  for (const card of await clientCards.all()) {
    const bounds = await card.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(15);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(375);
    const geometry = await card.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  }

  const evidenceCard = clientCards.filter({
    hasText: "All compatibility evidence",
  });
  const [evidenceStack, evidenceArrow] = await Promise.all([
    evidenceCard.locator(".stack").boundingBox(),
    evidenceCard.locator("svg.icon").boundingBox(),
  ]);
  expect(evidenceStack).not.toBeNull();
  expect(evidenceArrow).not.toBeNull();
  expect(
    (evidenceStack?.x ?? 0) + (evidenceStack?.width ?? 0),
  ).toBeLessThanOrEqual((evidenceArrow?.x ?? 0) + 1);
  await assertNoPageOverflow(page, "homepage proof cards at 390px");
});

test("security and FAQ pages state operational boundaries without overclaiming", async ({
  page,
}) => {
  await gotoLoaded(page, "/guides/security/");
  await expect(page.locator("main h1")).toHaveText("Security and data flow");
  await expect(page.locator("main")).toContainText(
    "does not currently provide a universal read-only mode",
  );
  await expect(page.locator("main")).toContainText(
    "This repository does not collect deployment telemetry",
  );
  const dataPath = page.locator("main pre").filter({ hasText: "MCP client" });
  await expect(dataPath).toContainText("your trello-mcp deployment");
  await expect(dataPath).toContainText("Trello REST API");
  const saferUseSteps = page
    .locator("main ol.sl-steps")
    .filter({ hasText: "Start with the read-only" });
  await expect(saferUseSteps).toHaveCount(1);
  await expect(saferUseSteps.locator(":scope > li")).toHaveCount(6);

  await gotoLoaded(page, "/guides/faq/");
  await expect(page.locator("main h1")).toHaveText("FAQ");
  await expect(page.locator("main")).toContainText(
    "There is no universal server-side read-only mode or confirmation gate.",
  );
  await expect(
    page.getByRole("link", { name: "side-by-side comparison", exact: true }),
  ).toHaveAttribute("href", "/#know-when-to-use-it");
  await expect(page.locator("main table")).toHaveCount(0);
  await expect(
    page.locator('main a[href="https://trello.com/mcp"]').first(),
  ).toBeVisible();
});

test("Reference overview preserves project resources, policies, sources, and official distinction", async ({
  page,
}) => {
  await gotoLoaded(page, "/reference/");
  const main = page.locator("main");
  await expect(main.locator("h1")).toHaveText("Reference");
  await expect(main.locator("#technical-reference")).toHaveCount(1);
  await expect(main.locator("#repository-policies")).toHaveCount(1);
  await expect(main.locator("#documentation-contracts")).toHaveCount(1);
  await expect(main).toContainText("Canonical long-form documentation remains");
  await expect(main).toContainText("corepack pnpm docs:tools");
  await expect(main).toContainText(DISCLAIMER);
  await expect(main).not.toContainText(OFFICIAL_ENDPOINT);
  await expect(
    main.getByRole("complementary", {
      name: "Pre-1.0, with documented contracts",
    }),
  ).toBeVisible();

  for (const [name, href] of [
    ["View the source repository", "https://github.com/enthouan/trello-mcp"],
    ["Releases", "https://github.com/enthouan/trello-mcp/releases"],
    [
      "changelog",
      "https://github.com/enthouan/trello-mcp/blob/main/CHANGELOG.md",
    ],
    ["Issues", "https://github.com/enthouan/trello-mcp/issues"],
    ["public roadmap", ROADMAP_URL],
    ["MIT License", "https://github.com/enthouan/trello-mcp/blob/main/LICENSE"],
    ["llms.txt", "/llms.txt"],
    ["Operations", "/guides/operations/"],
    ["Contributing", "/reference/contributing/"],
    ["Reporting issues and support", "/reference/reporting-issues/"],
    ["Security policy", "/reference/security-policy/"],
    [
      "Trello MCP documentation",
      "https://support.atlassian.com/trello/docs/connect-trello-to-ai-assistants-with-trello-mcp/",
    ],
  ] as const) {
    const link = main.getByRole("link", { name, exact: true }).first();
    await expect(link).toBeVisible();
    const actualHref = await link.getAttribute("href");
    expect(new URL(actualHref ?? "", page.url()).href).toBe(
      new URL(href, page.url()).href,
    );
  }
});

test("generated policy pages preserve canonical guidance and internal reporting routes", async ({
  page,
}) => {
  const policyPages = [
    {
      route: "/reference/contributing/",
      title: "Contributing",
      headings: ["Local checks", "Documentation website", "Pull requests"],
    },
    {
      route: "/reference/reporting-issues/",
      title: "Reporting issues and support",
      headings: [
        "Choose the right channel",
        "Prepare a useful report",
        "Security reports",
        "Support boundaries",
      ],
    },
    {
      route: "/reference/security-policy/",
      title: "Security policy",
      headings: [
        "Supported Versions",
        "Reporting A Vulnerability",
        "Sensitive Data",
      ],
    },
  ] as const;

  for (const policy of policyPages) {
    await gotoLoaded(page, policy.route);
    const main = page.locator("main");
    await expect(main.locator("h1")).toHaveText(policy.title);
    await expect(main.locator("h1")).toHaveCount(1);
    for (const heading of policy.headings) {
      await expect(
        main.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.locator(
        'starlight-toc nav[aria-labelledby="starlight__on-this-page"]',
      ),
    ).toBeVisible();

    if (policy.route === "/reference/reporting-issues/") {
      await expect(
        main.getByRole("complementary", { name: "Sanitize every report" }),
      ).toBeVisible();
      const reportSteps = main
        .locator("ol.sl-steps")
        .filter({ hasText: "Check the focused documentation first" });
      await expect(reportSteps).toHaveCount(1);
      await expect(reportSteps.locator(":scope > li")).toHaveCount(5);
    }
  }

  for (const route of [
    "/reference/contributing/",
    "/reference/reporting-issues/",
  ]) {
    await gotoLoaded(page, route);
    await expect(
      page
        .locator("main .sl-markdown-content")
        .getByRole("link", { name: "SECURITY.md", exact: true })
        .first(),
    ).toBeVisible();
  }
});

test("Trello API credential guide follows the current official flow and separates secrets", async ({
  page,
}) => {
  await gotoLoaded(page, "/getting-started/trello-api-key/");

  await expect(page.locator("main h1")).toHaveText("Trello API key");
  await expect(page.locator("main")).toContainText("App Admin Portal");
  await expect(page.locator("main")).toContainText("Generate a new API Key");
  await expect(page.locator("main")).toContainText("Token link");
  await expect(page.locator("main")).toContainText("requested permissions");
  await expect(page.locator("main")).toContainText("access duration");
  await expect(page.locator("main")).toContainText("Allow");
  await expect(page.locator("main")).toContainText(
    "The token is broad account access",
  );
  await expect(page.locator("main")).toContainText(
    "one hour, one day, 30 days, or without a scheduled expiration",
  );
  await expect(page.locator("main")).toContainText(
    "until it expires or is revoked",
  );
  await expect(page.locator("main")).not.toContainText(
    "remains active until it is disabled",
  );
  await expect(page.locator("main")).toContainText("auth_whoami");
  await expect(page.locator("main")).toContainText("auth_token_info");
  await expect(page.locator("main")).not.toContainText("https://localhost");

  await expect(
    page.locator('main aside[aria-label="This guide sends you to Trello"]'),
  ).toHaveClass(/starlight-aside--note/);
  await expect(
    page.locator('main aside[aria-label="The token is broad account access"]'),
  ).toHaveClass(/starlight-aside--caution/);

  const credentialSteps = page.locator("main ol.sl-steps");
  await expect(credentialSteps).toHaveCount(2);
  await expect(credentialSteps.nth(0).locator(":scope > li")).toHaveCount(7);
  await expect(credentialSteps.nth(1).locator(":scope > li")).toHaveCount(4);

  const portalButton = page.getByRole("link", {
    name: "Open Trello App Admin Portal",
    exact: true,
  });
  await expect(portalButton).toHaveAttribute(
    "href",
    "https://trello.com/apps/admin",
  );
  await expect(portalButton).toHaveClass(/primary/);

  await expect(
    page.locator('main a[href="https://trello.com/apps/admin"]').first(),
  ).toBeVisible();
  await expect(
    page.locator(
      'main a[href="https://support.atlassian.com/trello/docs/getting-started-with-trello-rest-api/"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      'main a[href="https://support.atlassian.com/trello/docs/revoking-a-trello-token/"]',
    ),
  ).toBeVisible();

  const credentialTable = page.locator("main table").first();
  await expect(credentialTable.locator("thead th")).toHaveText([
    "Setting",
    "Issued by",
    "Purpose",
    "Handling",
  ]);
  await expect(credentialTable.locator("tbody tr")).toHaveCount(3);
  await expect(credentialTable).toContainText("TRELLO_API_KEY");
  await expect(credentialTable).toContainText("TRELLO_TOKEN");
  await expect(credentialTable).toContainText("MCP_AUTH_TOKEN");

  const environmentExample = page
    .locator("main pre")
    .filter({ hasText: "TRELLO_API_KEY" });
  await expect(environmentExample).toContainText("TRELLO_API_KEY=your-api-key");
  await expect(environmentExample).toContainText("TRELLO_TOKEN=your-token");
});

test("robots.txt points crawlers to a complete public sitemap", async ({
  request,
}) => {
  const robotsResponse = await request.get("/robots.txt", {
    failOnStatusCode: false,
  });
  expect(robotsResponse.status()).toBe(200);
  expect(robotsResponse.headers()["content-type"]).toContain("text/plain");

  const robotsBody = await robotsResponse.text();
  const robotsLines = robotsBody.trimEnd().split("\n");
  expect(robotsLines.slice(0, 2)).toEqual(["User-agent: *", "Allow: /"]);
  expect(robotsBody).not.toContain("Disallow:");

  const sitemapDeclarations = robotsLines.filter((line) =>
    line.startsWith("Sitemap: "),
  );
  expect(sitemapDeclarations).toHaveLength(1);
  const sitemapIndexUrl = new URL(
    sitemapDeclarations[0]?.slice("Sitemap: ".length) ??
      "http://invalid.invalid/",
  );
  expect(sitemapIndexUrl.origin).toBe(CANONICAL_WEBSITE_ORIGIN);
  expect(sitemapIndexUrl.pathname).toBe("/sitemap-index.xml");
  expect(sitemapIndexUrl.search).toBe("");
  expect(sitemapIndexUrl.hash).toBe("");

  const sitemapIndexResponse = await request.get(sitemapIndexUrl.pathname, {
    failOnStatusCode: false,
  });
  expect(sitemapIndexResponse.status()).toBe(200);
  expect(sitemapIndexResponse.headers()["content-type"]).toMatch(
    /^(?:application|text)\/xml(?:;|$)/,
  );
  const sitemapIndexBody = await sitemapIndexResponse.text();
  const sitemapLocations = [
    ...sitemapIndexBody.matchAll(/<loc>([^<]+)<\/loc>/g),
  ].map((match) => match[1] ?? "");
  expect(sitemapLocations).toHaveLength(1);

  const sitemapUrl = new URL(sitemapLocations[0] ?? "http://invalid.invalid/");
  expect(sitemapUrl.origin).toBe(sitemapIndexUrl.origin);
  expect(sitemapUrl.pathname).toBe("/sitemap-0.xml");

  const sitemapResponse = await request.get(sitemapUrl.pathname, {
    failOnStatusCode: false,
  });
  expect(sitemapResponse.status()).toBe(200);
  expect(sitemapResponse.headers()["content-type"]).toMatch(
    /^(?:application|text)\/xml(?:;|$)/,
  );
  const sitemapBody = await sitemapResponse.text();
  const documentLocations = [
    ...sitemapBody.matchAll(/<loc>([^<]+)<\/loc>/g),
  ].map((match) => new URL(match[1] ?? "http://invalid.invalid/"));

  expect(new Set(documentLocations.map(({ href }) => href)).size).toBe(
    documentLocations.length,
  );
  for (const url of documentLocations) {
    expect(url.origin).toBe(sitemapIndexUrl.origin);
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
  }
  expect(documentLocations.map(({ pathname }) => pathname).sort()).toEqual(
    Object.keys(publicDocumentMetadata).sort(),
  );
  expect(sitemapBody).not.toContain("/404");
  for (const legacyRoute of [
    "/get-started/",
    "/trello-api-key/",
    "/clients/",
    "/concepts/how-it-works/",
    "/security/",
    "/faq/",
    "/tools/",
    "/reference/support/",
    "/project/",
  ]) {
    expect(sitemapBody).not.toContain(
      `${CANONICAL_WEBSITE_URL}${legacyRoute.slice(1)}`,
    );
  }
});

test("llms.txt is generated from the public documentation collection", async ({
  request,
}) => {
  const response = await request.get("/llms.txt", {
    failOnStatusCode: false,
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");

  const body = await response.text();
  expect(body).toContain("# trello-mcp");
  expect(body).toContain(
    `- [Install and run](${CANONICAL_WEBSITE_URL}getting-started/)`,
  );
  expect(body).toContain(`\n${DISCLAIMER}\n`);
  expect(body).toContain(
    `- [Official Trello MCP](https://trello.com/mcp), hosted at ${OFFICIAL_ENDPOINT}`,
  );
  expect(body).toContain("/getting-started/");
  expect(body).toContain("/getting-started/docker/");
  expect(body).toContain("/getting-started/http/");
  expect(body).toContain("/getting-started/stdio/");
  expect(body).toContain("/getting-started/trello-api-key/");
  expect(body).toContain("/getting-started/clients/");
  expect(body).toContain("/guides/how-it-works/");
  expect(body).toContain("/guides/workflows/");
  expect(body).toContain("/guides/operations/");
  expect(body).toContain("/guides/troubleshooting/");
  expect(body).toContain("/reference/");
  expect(body).toContain("/reference/configuration/");
  expect(body).toContain("/reference/contributing/");
  expect(body).toContain("/reference/reporting-issues/");
  expect(body).toContain("/reference/security-policy/");
  expect(body).toContain("/reference/tools/");
  expect(body).toContain("/guides/security/");
  expect(body).toContain("/guides/faq/");
  for (const legacyRoute of [
    "get-started/",
    "clients/",
    "trello-api-key/",
    "concepts/how-it-works/",
    "security/",
    "faq/",
    "tools/",
    "reference/support/",
    "project/",
  ]) {
    expect(body).not.toContain(`${CANONICAL_WEBSITE_URL}${legacyRoute}`);
  }
  expect(body).not.toMatch(/\]\(\//);
  expect(body).not.toContain("undefined");

  const normalizedBody = body.toLowerCase();
  for (const attribution of [
    "antoine ménard",
    "antoinemenard.com",
    "generated by codex",
    "generated by claude",
    "developed by codex",
    "developed by claude",
    "co-authored-by:",
  ]) {
    expect(normalizedBody).not.toContain(attribution);
  }
});

test("public documentation does not expose edit-page links", async ({
  page,
}) => {
  for (const route of Object.keys(publicDocumentMetadata)) {
    await gotoLoaded(page, route);
    await expect(page.getByRole("link", { name: "Edit page" })).toHaveCount(0);
  }
});

test("guide, workflow, troubleshooting, and configuration pages cover their operational boundaries", async ({
  page,
}) => {
  await gotoLoaded(page, "/guides/how-it-works/");
  await expect(page.locator("main h1")).toHaveText("How it works");
  await expect(
    page.getByRole("complementary", {
      name: "The MCP client is part of the trust boundary",
    }),
  ).toBeVisible();
  await expect(page.locator("main ol.sl-steps")).toHaveCount(2);
  await expect(page.locator("[data-request-flow]")).toHaveCount(1);
  await expect(
    page.getByRole("img", {
      name: "How a trello-mcp tool call travels",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Who owns what" }),
  ).toBeVisible();
  const ownershipCards = page.locator("main .card-grid").first();
  await expect(ownershipCards.locator(":scope > article.card")).toHaveCount(3);
  await expect(ownershipCards.locator(".title")).toHaveText([
    "MCP client",
    "trello-mcp",
    "Trello",
  ]);
  await expect(
    page.getByRole("heading", { name: "Choose the process boundary" }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText(
    "sessionful Streamable HTTP",
  );
  await expect(page.locator("main")).toContainText("Mcp-Session-Id");
  await expect(page.locator("main")).toContainText("TrelloClient");
  await expect(page.locator("main")).toContainText("source of truth");
  await expect(page.locator("main")).not.toContainText("HTTP is stateless");
  await expect(page.locator("main")).not.toContainText("MCP_ALLOWED_ORIGINS");

  await gotoLoaded(page, "/guides/workflows/");
  await expect(page.locator("main h1")).toHaveText("Workflows");
  await expect(
    page.getByRole("complementary", {
      name: "Client approval is not a server guarantee",
    }),
  ).toBeVisible();
  await expect(page.locator("main ol.sl-steps")).toHaveCount(7);
  for (const heading of [
    "Summarize a board without changing it",
    "Create and organize a card",
    "Move or archive completed work",
    "Review activity before adding a comment",
    "Set or clear a custom field",
    "Attach a URL or a server-local file",
  ]) {
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.locator("main ol.sl-steps").first().locator("strong"),
  ).toHaveText(["Discover.", "Inspect.", "Propose.", "Approve.", "Verify."]);
  await expect(page.locator("main")).toContainText(
    "server does not add a universal preview",
  );
  await expect(
    page.getByRole("complementary", {
      name: "Keep the safety boundary visible",
    }),
  ).toContainText("Prefer archive tools for recoverable cleanup");

  await gotoLoaded(page, "/guides/operations/");
  await expect(page.locator("main h1")).toHaveText("Operate trello-mcp");
  for (const heading of [
    "Before a change",
    "Inspect a running service",
    "Upgrade the published image",
    "Roll back",
    "Rotate credentials",
    "Stop or remove the service",
    "State, backup, and retention",
    "Upgrade a source or stdio installation",
  ]) {
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
  for (const operationalBoundary of [
    "docker compose pull trello-mcp",
    "docker compose up -d --wait --wait-timeout 120",
    "docker compose up -d --force-recreate --wait --wait-timeout 120",
    "docker compose down",
    "Do not add -v as a routine shutdown step",
    "The server has no application database",
    "TRELLO_ATTACHMENT_UPLOAD_ROOT",
  ]) {
    await expect(page.locator("main")).toContainText(operationalBoundary);
  }

  await gotoLoaded(page, "/guides/troubleshooting/");
  await expect(page.locator("main h1")).toHaveText("Troubleshooting");
  await expect(
    page.getByRole("complementary", { name: "Sanitize before sharing" }),
  ).toBeVisible();
  await expect(page.locator("main ol.sl-steps")).toHaveCount(1);
  for (const heading of [
    "stdio",
    "Streamable HTTP",
    "Docker Compose",
    "Trello API errors and permissions",
    "Attachment upload paths",
    "Prepare a sanitized issue report",
  ]) {
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
  for (const diagnostic of [
    "/healthz",
    "/readyz",
    "Mcp-Session-Id",
    "HTTP 401",
    "HTTP 403",
    "HTTP 404",
    "HTTP 429",
  ]) {
    await expect(page.locator("main")).toContainText(diagnostic);
  }
  await expect(page.locator("main")).toContainText(
    "current Compose files do not pass",
  );

  await gotoLoaded(page, "/reference/configuration/");
  await expect(page.locator("main h1")).toHaveText("Configuration reference");
  await expect(
    page.getByRole("complementary", { name: "Keep configuration private" }),
  ).toBeVisible();
  const applicabilityTable = page.locator("main table").first();
  await expect(applicabilityTable.locator("thead th")).toHaveText([
    "Setting",
    "Direct stdio",
    "Direct Streamable HTTP",
    "Current Docker Compose files",
  ]);
  for (const setting of [
    "TRELLO_API_KEY",
    "TRELLO_TOKEN",
    "TRANSPORT",
    "PORT",
    "LOG_LEVEL",
    "MCP_AUTH_TOKEN",
    "TRELLO_ATTACHMENT_UPLOAD_ROOT",
    "TRELLO_RATE_LIMIT_CAPACITY",
    "TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS",
    "TRELLO_RETRY_MAX_ATTEMPTS",
    "TRELLO_RETRY_BASE_DELAY_MS",
    "TRELLO_RETRY_MAX_DELAY_MS",
    "TRELLO_MCP_HOST_BIND_IP",
    "TRELLO_MCP_HOST_PORT",
    "TRELLO_MCP_IMAGE_TAG",
    "TRELLO_MCP_NETWORK",
  ]) {
    await expect(page.locator("main")).toContainText(setting);
  }
  await expect(
    page.getByRole("heading", { name: "Current Compose limitation" }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText(
    "Adding the variable to .env alone therefore does not enable local uploads",
  );
  await expect(page.locator("main")).not.toContainText("MCP_ALLOWED_ORIGINS");
  await expect(page.locator("main")).not.toContainText("HOST=127.0.0.1");
});

test("tool catalog groups every runtime tool and exposes searchable input metadata", async ({
  page,
}) => {
  await gotoLoaded(page, "/reference/tools/");

  await expect(page.locator("main h1")).toHaveText("Tool catalog");
  const catalog = page.locator("[data-tool-catalog]");
  await expect(catalog).toHaveAttribute("data-tool-count", "77");
  await expect(catalog.locator("[data-tool-card]")).toHaveCount(77);
  await expect(catalog.locator("[data-tool-group]")).toHaveCount(13);

  const expectedGroups = [
    ["Credential diagnostics", 2],
    ["Boards", 11],
    ["Workspaces", 5],
    ["Members", 4],
    ["Lists", 7],
    ["Cards", 12],
    ["Attachments", 5],
    ["Checklists", 10],
    ["Custom fields", 5],
    ["Card members", 3],
    ["Comments and card activity", 4],
    ["Labels", 7],
    ["Search", 2],
  ] as const;

  const tableOfContents = page.locator(
    'starlight-toc nav[aria-labelledby="starlight__on-this-page"]',
  );
  await expect(tableOfContents).toBeVisible();
  await expect(tableOfContents.getByRole("link")).toHaveText([
    "Overview",
    ...expectedGroups.map(([heading]) => heading),
  ]);

  for (const [heading, count] of expectedGroups) {
    const group = catalog.locator("[data-tool-group]").filter({
      has: page.getByRole("heading", { name: heading, exact: true }),
    });
    await expect(group).toHaveCount(1);
    await expect(group.locator("[data-tool-card]")).toHaveCount(count);
    await expect(group.getByLabel(`${count} tools`)).toBeVisible();
    await expect(group).toContainText("Example prompt:");
  }

  const cardCreate = catalog.locator('[data-tool-name="card_create"]');
  await expect(cardCreate).toHaveAttribute("data-category", "cards");
  await expect(cardCreate).toHaveAttribute("data-behavior", "write");
  await expect(
    cardCreate.getByText("Writes data", { exact: true }),
  ).toBeVisible();
  await expect(cardCreate.locator(".tool-meta")).toContainText(
    "created card object",
  );

  const inputDetails = cardCreate.locator("details.tool-inputs");
  await expect(inputDetails.locator("summary")).toContainText(
    "2 required, 5 optional",
  );
  await inputDetails.locator("summary").click();
  await expect(inputDetails).toHaveAttribute("open", "");
  await expect(
    inputDetails.locator("dt").filter({ hasText: "listId" }),
  ).toContainText("Required");
  await expect(
    inputDetails.locator("dt").filter({ hasText: "desc" }),
  ).toContainText("Optional");
  await expect(inputDetails).toContainText(
    "Destination list id where the new card should be created.",
  );

  await expect(
    catalog.locator('[data-tool-name="card_checklist_update"]'),
  ).toContainText("Provide at least one of name or pos.");

  const search = page.getByRole("searchbox", { name: "Search tools" });
  const category = page.getByRole("combobox", { name: "Category" });
  const behavior = page.getByRole("combobox", { name: "Behavior" });
  const status = catalog.getByRole("status");
  const reset = catalog.getByRole("button", { name: "Reset" });

  await search.fill("filePath");
  await expect(status).toHaveText("1 of 77 tools shown");
  await expect(catalog.locator("[data-tool-card]:visible")).toHaveCount(1);
  await expect(
    catalog.locator('[data-tool-name="card_attachment_upload"]'),
  ).toBeVisible();

  await reset.click();
  await expect(status).toHaveText("77 of 77 tools shown");
  await category.selectOption("checklists");
  await expect(status).toHaveText("10 of 77 tools shown");
  await expect(catalog.locator("[data-tool-card]:visible")).toHaveCount(10);

  await reset.click();
  await behavior.selectOption("write");
  await expect(status).toHaveText("37 of 77 tools shown");
  await expect(catalog.locator("[data-tool-card]:visible")).toHaveCount(37);
  await expect(cardCreate).toBeVisible();
  await expect(catalog.locator('[data-tool-name="card_delete"]')).toBeVisible();
  await expect(catalog.locator('[data-tool-name="card_get"]')).toBeHidden();

  await reset.click();
  await behavior.selectOption("delete");
  await expect(status).toHaveText("6 of 77 tools shown");
  await expect(catalog.locator("[data-tool-card]:visible")).toHaveCount(6);
  await expect(
    catalog.getByText("Permanent delete", { exact: true }),
  ).toHaveCount(6);

  await reset.click();
  await search.fill("no-such-trello-tool-or-input");
  await expect(status).toHaveText("0 of 77 tools shown");
  await expect(
    catalog.getByText("No tools match those filters.", { exact: false }),
  ).toBeVisible();

  await reset.click();
  await expect(status).toHaveText("77 of 77 tools shown");
  await page.goto("/reference/tools/#card_create", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator('[data-tool-name="card_create"]')).toBeVisible();
  await expect(page).toHaveURL(/\/tools\/#card_create$/);
});

test("tool catalog remains complete without client-side enhancement", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    const response = await page.goto("/reference/tools/", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-tool-card]")).toHaveCount(77);
    await expect(page.locator("[data-tool-group]")).toHaveCount(13);
    await expect(page.locator("[data-catalog-controls]")).toBeHidden();
    await expect(page.locator('[data-tool-name="card_create"]')).toBeVisible();
  } finally {
    await context.close();
  }
});

test("API coverage uses concise group headings and preserves legacy deep links", async ({
  page,
}) => {
  await gotoLoaded(page, "/reference/api-coverage/#api-group-actions");

  const groupNames = [
    "Actions",
    "Boards",
    "Cards",
    "Checklists",
    "CustomFields",
    "Lists",
    "Members",
    "Organizations",
    "Tokens",
  ];
  await expect(page.locator("main h3")).toHaveText(groupNames);
  await expect(page.locator("main")).not.toContainText("API Group:");

  for (const groupName of groupNames) {
    const legacyId = `api-group-${groupName.toLowerCase()}`;
    await expect(page.locator(`#${legacyId}`)).toHaveCount(1);
  }
});

test("primary navigation reaches every top-level route", async ({ page }) => {
  for (const [label, route] of primaryNavigation) {
    await test.step(label, async () => {
      await gotoLoaded(page, "/getting-started/");
      const link = page
        .locator(`#starlight__sidebar a[href="${route}"]:visible`)
        .first();
      await expect(
        link,
        `${label} must be visible in primary navigation`,
      ).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(
        new RegExp(`${route.replaceAll("/", "\\/")}(?:#.*)?$`),
      );
      await expect(page.locator("main h1")).toBeVisible();
    });
  }

  await gotoLoaded(page, "/");
  const githubLink = page
    .getByRole("link", { name: "View on GitHub", exact: true })
    .first();
  await expect(githubLink).toHaveAttribute(
    "href",
    "https://github.com/enthouan/trello-mcp",
  );
});

test("legacy documentation routes redirect to canonical destinations", async ({
  page,
  request,
}) => {
  const redirects = [
    ["/get-started", "/getting-started/", "Install and run"],
    ["/get-started/docker", "/getting-started/docker/", "Docker Compose"],
    ["/get-started/http", "/getting-started/http/", "Streamable HTTP"],
    ["/get-started/stdio", "/getting-started/stdio/", "stdio"],
    ["/trello-api-key", "/getting-started/trello-api-key/", "Trello API key"],
    ["/clients", "/getting-started/clients/", "Set up your MCP client"],
    [
      "/clients/compatibility",
      "/getting-started/compatibility/",
      "Compatibility evidence",
    ],
    ["/concepts/how-it-works", "/guides/how-it-works/", "How it works"],
    ["/security", "/guides/security/", "Security and data flow"],
    ["/faq", "/guides/faq/", "FAQ"],
    ["/tools", "/reference/tools/", "Tool catalog"],
    ["/tools/api-coverage", "/reference/api-coverage/", "API coverage"],
    [
      "/reference/support",
      "/reference/reporting-issues/",
      "Reporting issues and support",
    ],
    ["/project", "/reference/", "Reference"],
  ] as const;
  const cloudflareRedirects = await readFile(
    new URL("../public/_redirects", import.meta.url),
    "utf8",
  );
  expect(cloudflareRedirects.trim().split("\n")).toEqual(
    redirects.flatMap(([legacyRoute, canonicalRoute]) => [
      `${legacyRoute} ${canonicalRoute} 301`,
      `${legacyRoute}/ ${canonicalRoute} 301`,
    ]),
  );

  for (const [legacyRoute, canonicalRoute] of redirects) {
    const redirectResponse = await request.get(`${legacyRoute}/`, {
      failOnStatusCode: false,
    });
    expect(redirectResponse.status()).toBe(200);
    const redirectBody = await redirectResponse.text();
    expect(redirectBody).toContain('http-equiv="refresh"');
    expect(redirectBody).toContain(`content="0;url=${canonicalRoute}"`);
    expect(redirectBody).toContain('name="robots" content="noindex"');
  }

  for (const [legacyRoute, canonicalRoute, heading] of redirects.filter(
    ([route]) =>
      [
        "/get-started",
        "/clients",
        "/concepts/how-it-works",
        "/security",
        "/tools",
        "/reference/support",
        "/project",
      ].includes(route),
  )) {
    await page.goto(`${legacyRoute}/`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(
      new RegExp(`${canonicalRoute.replaceAll("/", "\\/")}$`),
    );
    await expect(page.locator("main h1")).toHaveText(heading);
  }
});

test("sidebar exposes exactly the requested three-group information architecture", async ({
  page,
}) => {
  await gotoLoaded(page, "/getting-started/");
  const sidebar = page.locator("#starlight__sidebar");
  const groups = sidebar.locator("ul.top-level > li > details");
  const expectedGroups = [
    {
      label: "Get started",
      items: [
        ["Install and run", "/getting-started/"],
        ["Trello API key", "/getting-started/trello-api-key/"],
        ["Set up your MCP client", "/getting-started/clients/"],
        ["Compatibility", "/getting-started/compatibility/"],
        ["Docker Compose", "/getting-started/docker/"],
        ["Streamable HTTP", "/getting-started/http/"],
        ["stdio", "/getting-started/stdio/"],
      ],
    },
    {
      label: "Guides",
      items: [
        ["How it works", "/guides/how-it-works/"],
        ["Workflows", "/guides/workflows/"],
        ["Security & Data", "/guides/security/"],
        ["Operations", "/guides/operations/"],
        ["Troubleshooting", "/guides/troubleshooting/"],
        ["FAQ", "/guides/faq/"],
      ],
    },
    {
      label: "Reference",
      items: [
        ["Overview", "/reference/"],
        ["Configuration", "/reference/configuration/"],
        ["Tool catalog", "/reference/tools/"],
        ["API coverage", "/reference/api-coverage/"],
        ["Contributing", "/reference/contributing/"],
        ["Reporting issues and support", "/reference/reporting-issues/"],
        ["Security policy", "/reference/security-policy/"],
      ],
    },
  ] as const;

  await expect(groups).toHaveCount(expectedGroups.length);
  for (const [index, expectedGroup] of expectedGroups.entries()) {
    const group = groups.nth(index);
    await expect(group.locator(":scope > summary .large")).toHaveText(
      expectedGroup.label,
    );
    const links = group.locator(":scope > ul > li > a");
    await expect(links).toHaveText(expectedGroup.items.map(([label]) => label));
    expect(
      await links.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("href")),
      ),
    ).toEqual(expectedGroup.items.map(([, href]) => href));
  }
  await expect(sidebar).not.toContainText("Concepts");
  await expect(sidebar).not.toContainText("Project");

  const next = page.locator('footer a[rel="next"]');
  await expect(next).toHaveAttribute(
    "href",
    "/getting-started/trello-api-key/",
  );
  await expect(next).toContainText("Trello API key");

  await gotoLoaded(page, "/getting-started/clients/");
  await expect(page.locator("main h1")).toHaveText("Set up your MCP client");
  await expect(page.locator('footer a[rel="next"]')).toHaveAttribute(
    "href",
    "/getting-started/compatibility/",
  );

  await gotoLoaded(page, "/getting-started/compatibility/");
  await expect(page.locator('footer a[rel="next"]')).toHaveAttribute(
    "href",
    "/getting-started/docker/",
  );

  await gotoLoaded(page, "/getting-started/http/");
  await expect(page.locator('footer a[rel="prev"]')).toHaveAttribute(
    "href",
    "/getting-started/docker/",
  );
  await expect(page.locator('footer a[rel="next"]')).toHaveAttribute(
    "href",
    "/getting-started/stdio/",
  );

  await gotoLoaded(page, "/getting-started/stdio/");
  await expect(page.locator('footer a[rel="next"]')).toHaveAttribute(
    "href",
    "/guides/how-it-works/",
  );
});

test("native mobile menu is keyboard operable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoLoaded(page, "/getting-started/");

  const menu = page.locator("starlight-menu-button").first();
  const menuButton = menu.locator("button");
  await expect(menuButton).toBeVisible();
  await menuButton.focus();
  await expect(menuButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");

  const toolsLink = page
    .locator('#starlight__sidebar a[href="/reference/tools/"]:visible')
    .first();
  await expect(toolsLink).toBeVisible();
  await toolsLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tools\/$/);
  await expect(page.locator("main h1")).toBeVisible();
});

test("native theme control applies and persists light and dark modes", async ({
  page,
}) => {
  await gotoLoaded(page, "/");
  const themeSelect = page
    .locator(
      'starlight-theme-select select:visible, select[name="theme"]:visible, select[aria-label*="theme" i]:visible',
    )
    .first();
  await expect(themeSelect).toBeVisible();

  for (const theme of ["dark", "light"] as const) {
    await themeSelect.selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  }
});

test("documentation pages inherit Starlight's native content width", async ({
  page,
}) => {
  const customCss = await readFile(
    new URL("../src/styles/custom.css", import.meta.url),
    "utf8",
  );
  expect(customCss).not.toMatch(/--sl-content-width\s*:/);

  await gotoLoaded(page, "/getting-started/");
  const contentWidth = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--sl-content-width")
      .trim(),
  );
  expect(contentWidth).toBe("45rem");
});

test("site marks, reference hero styling, and theme palette load in both themes", async ({
  page,
  request,
}) => {
  await gotoLoaded(page, "/");

  const siteTitle = page.locator("header a.site-title").first();
  await expect(siteTitle).toBeVisible();
  await expect(siteTitle).toHaveAccessibleName("trello-mcp");
  const siteTitleTypography = await siteTitle.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      fontFamily: styles.fontFamily,
      fontSize: styles.fontSize,
      letterSpacing: Number.parseFloat(styles.letterSpacing),
    };
  });
  expect(siteTitleTypography.fontSize).toBe("24px");
  expect(siteTitleTypography.fontFamily).toContain("monospace");
  expect(siteTitleTypography.letterSpacing).toBeCloseTo(-0.84, 2);
  const mark = siteTitle.locator("img");
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute("alt", "");
  await expect(mark).toHaveAttribute("width", "64");
  await expect(mark).toHaveAttribute("height", "64");

  const heroTitle = page.locator(".hero h1[data-page-title]");
  await expect(heroTitle).toBeVisible();
  await expect(heroTitle).toHaveAccessibleName(HERO_TITLE);
  const heroMark = page.locator(".hero > .hero-html img");
  await expect(heroMark).toBeVisible();
  await expect(heroMark).toHaveAttribute(
    "src",
    "/favicon.svg?v=full-bleed-split-card",
  );
  await expect(heroMark).toHaveAttribute("alt", "trello-mcp split-card mark");
  await expect(heroMark).toHaveAttribute("width", "400");
  await expect(heroMark).toHaveAttribute("height", "400");
  const [heroMarkBox, heroTitleBox] = await Promise.all([
    heroMark.boundingBox(),
    heroTitle.boundingBox(),
  ]);
  expect(heroMarkBox).not.toBeNull();
  expect(heroTitleBox).not.toBeNull();
  expect(heroMarkBox?.x ?? 0).toBeGreaterThan(
    (heroTitleBox?.x ?? 0) + (heroTitleBox?.width ?? 0),
  );
  expect(heroMarkBox?.width ?? 0).toBeGreaterThan(300);

  const [heroTitleMetrics, heroTaglineMetrics, primaryButtonRadius] =
    await Promise.all([
      heroTitle.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          fontSize: styles.fontSize,
          lineCount: Math.round(
            element.getBoundingClientRect().height /
              Number.parseFloat(styles.lineHeight),
          ),
        };
      }),
      page.locator(".hero .tagline").evaluate((element) => {
        const styles = getComputedStyle(element);
        return Math.round(
          element.getBoundingClientRect().height /
            Number.parseFloat(styles.lineHeight),
        );
      }),
      page
        .locator(".hero .actions a.sl-link-button")
        .first()
        .evaluate((element) => getComputedStyle(element).borderRadius),
    ]);
  expect(heroTitleMetrics.fontSize).toBe("64px");
  expect(heroTitleMetrics.lineCount).toBe(2);
  expect(heroTaglineMetrics).toBe(3);
  expect(Number.parseFloat(primaryButtonRadius)).toBeGreaterThan(1_000);

  const markSource = await mark.getAttribute("src");
  expect(markSource, "Header mark must have a source").toBeTruthy();
  const markResponse = await request.get(markSource ?? "", {
    failOnStatusCode: false,
  });
  expect(markResponse.status(), "Header mark must resolve").toBe(200);
  expect(markResponse.headers()["content-type"]).toContain("image/svg+xml");

  const favicon = page.locator('link[rel="shortcut icon"]');
  await expect(favicon).toHaveAttribute(
    "href",
    "/favicon.svg?v=full-bleed-split-card",
  );
  const faviconHref = await favicon.getAttribute("href");
  const faviconResponse = await request.get(faviconHref ?? "", {
    failOnStatusCode: false,
  });
  expect(faviconResponse.status(), "Favicon must resolve").toBe(200);
  const faviconSource = (await faviconResponse.text()).toLowerCase();
  expect(faviconSource).toContain("trello-mcp split-card mark");
  expect(faviconSource).toContain("#0052cc");
  expect(faviconSource).not.toContain("lineargradient");
  expect(faviconSource.match(/<rect\b/g)).toHaveLength(3);
  expect(faviconSource.match(/fill="#fff"/g)).toHaveLength(2);
  expect(faviconSource).toContain(
    '<rect width="64" height="64" rx="14" fill="#0052cc"',
  );
  expect(faviconSource).toContain(
    'x="11.43" y="11.43" width="18.29" height="28.57" rx="4.57"',
  );
  expect(faviconSource).toContain(
    'x="34.29" y="24" width="18.29" height="28.57" rx="4.57"',
  );
  expect(faviconSource).not.toContain("<path");
  expect(faviconSource).not.toContain("<circle");

  for (const [theme, expectedAccent] of [
    ["light", "rgb(0, 82, 204)"],
    ["dark", "rgb(87, 157, 255)"],
  ] as const) {
    await test.step(theme, async () => {
      await page.locator("html").evaluate((element, selectedTheme) => {
        element.dataset.theme = selectedTheme;
      }, theme);
      const accent = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--sl-color-accent)";
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      });
      expect(accent).toBe(expectedAccent);
    });
  }

  await page.locator("html").evaluate((element) => {
    element.dataset.theme = "light";
  });
  const daytimePalette = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      background: getComputedStyle(document.body).backgroundColor,
      canvas: rootStyle.getPropertyValue("--sl-color-black").trim(),
      hairline: rootStyle.getPropertyValue("--sl-color-gray-6").trim(),
      surface: rootStyle.getPropertyValue("--sl-color-gray-7").trim(),
    };
  });
  expect(daytimePalette).toEqual({
    background: "rgb(248, 251, 255)",
    canvas: "#f8fbff",
    hairline: "#e2eaf5",
    surface: "#f1f6ff",
  });
});

test("dark theme meets color contrast across every public route", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await page.addInitScript(() => {
    localStorage.setItem("starlight-theme", "dark");
  });

  for (const route of publicRoutes) {
    await test.step(route, async () => {
      await gotoLoaded(page, route);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      const accessibility = await new AxeBuilder({ page })
        .withRules(["color-contrast"])
        .analyze();
      expect(
        accessibility.violations,
        `${route} has dark-theme color contrast violations:\n${JSON.stringify(
          accessibility.violations,
          null,
          2,
        )}`,
      ).toEqual([]);
    });
  }
});

test("production Pagefind search returns a tool result", async ({ page }) => {
  const problems = monitorBrowserProblems(page);
  await gotoLoaded(page, "/");
  const searchButton = page
    .locator(
      'site-search button:visible, button[data-open-modal]:visible, button[aria-label*="search" i]:visible',
    )
    .first();
  await expect(searchButton).toBeVisible();
  await searchButton.click();

  await expect(
    page.locator('dialog[open], [role="dialog"]:visible').first(),
  ).toBeVisible();
  const searchInput = page
    .locator(".pagefind-ui__search-input:visible")
    .first();
  await expect(searchInput).toBeFocused();
  await searchInput.fill("card_create");

  const result = page
    .locator(
      '.pagefind-ui__result-link[href^="/reference/tools/"]:visible, [data-pagefind-ui] a[href^="/reference/tools/"]:visible',
    )
    .first();
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("href", /\/tools\//);
  await result.click();
  await expect(page).toHaveURL(/\/tools\//);
  await page.waitForLoadState("networkidle");
  expect(problems, "Pagefind search emitted browser errors").toEqual([]);
});

test("all internal links and images resolve", async ({
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(120_000);

  expect(baseURL, "Playwright baseURL must be configured").toBeTruthy();
  const base = new URL(baseURL ?? "http://127.0.0.1:4321");
  const internalFragments = new Set<string>();
  const internalUrls = new Set<string>();
  const obsoletePaths = new Set(["/concepts/how-it-works/", "/project/"]);

  for (const route of publicRoutes) {
    await test.step(`collect ${route}`, async () => {
      await gotoLoaded(page, route);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) =>
          links.map((link) => (link as HTMLAnchorElement).href),
        );

      for (const href of hrefs) {
        const url = new URL(href);
        if (url.origin === base.origin) {
          expect(
            obsoletePaths.has(url.pathname),
            `${route} links to obsolete route ${url.pathname}`,
          ).toBe(false);
          if (url.hash) internalFragments.add(url.toString());
          url.hash = "";
          internalUrls.add(url.toString());
        }
      }

      const missingLocalFragments = await page
        .locator('a[href^="#"]')
        .evaluateAll((links) =>
          links
            .map((link) => (link as HTMLAnchorElement).hash.slice(1))
            .filter(Boolean)
            .filter((id) => !document.getElementById(decodeURIComponent(id))),
        );
      expect(
        missingLocalFragments,
        `${route} contains broken same-page fragments`,
      ).toEqual([]);
    });
  }

  for (const url of internalUrls) {
    await test.step(url, async () => {
      const response = await request.get(url, { failOnStatusCode: false });
      expect(
        response.status(),
        `${url} returned ${response.status()}`,
      ).toBeLessThan(400);
    });
  }

  for (const url of internalFragments) {
    await test.step(url, async () => {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const targetExists = await page.evaluate(() => {
        const id = decodeURIComponent(window.location.hash.slice(1));
        return Boolean(id && document.getElementById(id));
      });
      expect(targetExists, `${url} points to a missing fragment`).toBe(true);
    });
  }
});

test("the Starlight 404 is explicit and unknown routes return 404", async ({
  page,
}) => {
  const missingPath = "/this-page-intentionally-does-not-exist";
  const problems = monitorBrowserProblems(page, {
    allowConsole: (message) =>
      message ===
      "Failed to load resource: the server responded with a status of 404 (Not Found)",
    allowResponse: (response) =>
      response.status() === 404 &&
      new URL(response.url()).pathname === missingPath,
  });

  await gotoLoaded(page, "/404.html");
  await expect(page.locator("main h1")).toHaveText("404");
  await expect(page.locator("main")).toContainText(/page not found/i);
  await expect(page.locator('header a[href="/"]')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);

  const response = await page.goto(missingPath, { waitUntil: "networkidle" });

  expect(response?.status()).toBe(404);
  await expect(page.locator("body")).toContainText(/not found/i);
  const unexpectedProblems = problems.filter(
    ({ kind, message }) =>
      kind !== "console" ||
      !/^Failed to load resource:.*404 \(Not Found\)$/.test(message),
  );
  expect(
    unexpectedProblems,
    "404 page emitted unexpected browser errors",
  ).toEqual([]);
});

test("skip link and focus indicators work from the keyboard", async ({
  page,
}) => {
  await gotoLoaded(page, "/getting-started/");
  const skipLink = page.getByRole("link", { name: /skip to content/i });

  await expect(skipLink).toHaveAttribute("href", "#_top");

  let keyboardFocus: {
    focusVisible: boolean;
    height: number;
    width: number;
  } | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.keyboard.press("Tab");
    const candidate = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return null;
      const bounds = active.getBoundingClientRect();
      return {
        focusVisible: active.matches(":focus-visible"),
        height: bounds.height,
        width: bounds.width,
      };
    });
    if (
      candidate?.focusVisible &&
      candidate.height > 0 &&
      candidate.width > 0
    ) {
      keyboardFocus = candidate;
      break;
    }
  }
  expect(keyboardFocus, "Tab must reach a visible focus target").not.toBeNull();

  await skipLink.focus();
  await expect(skipLink).toBeVisible();
  await expect(skipLink).toBeFocused();
  const skipTarget = await skipLink.getAttribute("href");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${skipTarget}$`));
  await expect(page.locator(skipTarget ?? "#_top")).toBeInViewport();
});

test("code blocks copy successfully and contain their own overflow", async ({
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
  await page
    .getByRole("tab", { name: "HTTP · published image", exact: true })
    .click();

  const codeBlocks = page.locator("main pre");
  expect(await codeBlocks.count()).toBeGreaterThan(0);
  const codeGeometry = await codeBlocks.evaluateAll((blocks) =>
    blocks.map((block) => {
      const bounds = block.getBoundingClientRect();
      return {
        clientWidth: block.clientWidth,
        left: bounds.left,
        overflowX: getComputedStyle(block).overflowX,
        right: bounds.right,
        scrollWidth: block.scrollWidth,
      };
    }),
  );
  for (const geometry of codeGeometry) {
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(321);
    expect(["auto", "scroll"]).toContain(geometry.overflowX);
    expect(geometry.scrollWidth).toBeGreaterThanOrEqual(geometry.clientWidth);
  }
  await assertNoPageOverflow(page, "narrow Get Started code blocks");

  const copyButton = page
    .locator(
      'main button[title*="copy" i]:visible, main button[aria-label*="copy" i]:visible, main .copy button:visible',
    )
    .first();
  await expect(copyButton).toBeVisible();
  const copySource = await copyButton.getAttribute("data-code");
  expect(copySource, "Copy control must expose its source code").toBeTruthy();
  const expectedCopy = (copySource ?? "").replaceAll("\u007f", "\n");
  expect(expectedCopy).toContain("docker compose up -d --wait");
  await copyButton.click();
  const normalizeCopiedCode = (value: string) =>
    value
      .replaceAll("\r\n", "\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
  await expect
    .poll(async () =>
      normalizeCopiedCode(
        await page.evaluate(
          () =>
            (
              globalThis as typeof globalThis & {
                __trelloMcpClipboard?: string;
              }
            ).__trelloMcpClipboard ?? "",
        ),
      ),
    )
    .toEqual(normalizeCopiedCode(expectedCopy));
  expect(problems, "Copy interaction emitted browser errors").toEqual([]);
});

test("request flow diagram is accessible, theme-aware, and scrolls internally", async ({
  page,
  request,
}) => {
  const assetResponse = await request.get("/request-flow.svg", {
    failOnStatusCode: false,
  });
  expect(assetResponse.status(), "Request flow asset must resolve").toBe(200);
  expect(assetResponse.headers()["content-type"]).toContain("image/svg+xml");
  const assetSource = await assetResponse.text();
  expect(assetSource).toContain("How a trello-mcp tool call travels");
  expect(assetSource).toContain("Local stdio · Sessionful HTTP");
  expect(assetSource).toContain("holds Trello API key + token");
  expect(assetSource).toContain("Trello remains the source of truth");
  expect(assetSource).toContain("@media (prefers-color-scheme: dark)");
  const legacyAsset = await request.get("/transport-chooser.svg", {
    failOnStatusCode: false,
  });
  expect(legacyAsset.status()).toBe(404);

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoLoaded(page, "/guides/how-it-works/");

  const figure = page.locator("figure[data-request-flow]");

  await expect(figure).toBeVisible();
  await expect(
    figure.getByRole("img", { name: "How a trello-mcp tool call travels" }),
  ).toBeVisible();
  const fullSizeLink = figure.getByRole("link", {
    name: "Open the full-size diagram",
    exact: true,
  });
  await expect(fullSizeLink).toHaveAttribute("href", "/request-flow.svg");
  const fullSizeResponse = await request.get(
    (await fullSizeLink.getAttribute("href")) ?? "",
    { failOnStatusCode: false },
  );
  expect(fullSizeResponse.status(), "Full-size diagram link must resolve").toBe(
    200,
  );

  const themeColors: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    await page.locator("html").evaluate((element, nextTheme) => {
      element.dataset.theme = nextTheme;
    }, theme);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    themeColors.push(
      await figure
        .locator(".canvas")
        .evaluate((element) => getComputedStyle(element).fill),
    );
  }
  expect(themeColors).toEqual(["rgb(248, 251, 255)", "rgb(12, 22, 36)"]);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await test.step(`${viewport.width}px`, async () => {
      await page.setViewportSize(viewport);
      await gotoLoaded(page, "/guides/how-it-works/");

      const scrollRegion = page.getByRole("region", {
        name: "Trello MCP request flow diagram",
      });
      await expect(scrollRegion).toBeVisible();
      await expect(scrollRegion).toHaveAttribute("tabindex", "0");
      const geometry = await scrollRegion.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const diagram = element.querySelector("svg");
        return {
          clientWidth: element.clientWidth,
          diagramWidth: diagram?.getBoundingClientRect().width ?? 0,
          left: bounds.left,
          overflowX: getComputedStyle(element).overflowX,
          right: bounds.right,
          scrollWidth: element.scrollWidth,
        };
      });

      expect(["auto", "scroll"]).toContain(geometry.overflowX);
      expect(geometry.diagramWidth).toBeGreaterThanOrEqual(831);
      expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
      expect(geometry.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(viewport.width + 1);
      await assertNoPageOverflow(page, `request flow at ${viewport.width}px`);

      if (viewport.width === 320) {
        await scrollRegion.evaluate((element) => {
          element.scrollLeft = 0;
        });
        await scrollRegion.focus();
        await expect(scrollRegion).toBeFocused();
        await page.keyboard.press("ArrowRight");
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              );
            }),
        );
        await expect
          .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0);
      }
    });
  }

  await gotoLoaded(page, "/getting-started/clients/");
  await expect(page.locator("[data-transport-chooser]")).toHaveCount(0);
});

test("mobile tool catalog keeps filters and expanded input cards within the viewport", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 568 });
      await gotoLoaded(page, "/reference/tools/");

      const catalog = page.locator("[data-tool-catalog]");
      const controls = catalog.locator("[data-catalog-controls]");
      await expect(controls).toBeVisible();
      await expect(controls.locator("label")).toHaveCount(3);

      await page
        .getByRole("searchbox", { name: "Search tools" })
        .fill("filePath");
      await expect(catalog.getByRole("status")).toHaveText(
        "1 of 77 tools shown",
      );

      const card = catalog.locator('[data-tool-name="card_attachment_upload"]');
      await expect(card).toBeVisible();
      const details = card.locator("details.tool-inputs");
      const summary = details.locator("summary");
      await summary.focus();
      await expect(summary).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(details).toHaveAttribute("open", "");
      await expect(details).toContainText("filePath");
      await expect(details).toContainText(
        "Server-side file path to upload. Relative paths resolve inside TRELLO_ATTACHMENT_UPLOAD_ROOT; absolute paths must also be inside that root.",
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

      const controlLayout = await controls.evaluate((element) => ({
        columns:
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
        searchHeight:
          element.querySelector("input")?.getBoundingClientRect().height ?? 0,
      }));
      const summaryHeight = await summary.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      expect(controlLayout.columns).toBe(1);
      expect(controlLayout.searchHeight).toBeGreaterThanOrEqual(44);
      expect(summaryHeight).toBeGreaterThanOrEqual(44);
      await assertNoPageOverflow(page, `tool cards at ${width}px`);
    });
  }
});

test("tool catalog uses two-column cards when the content area is wide enough", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoLoaded(page, "/reference/tools/#tool-group-cards");

  const cards = page.locator(
    '[aria-labelledby="tool-group-cards"] [data-tool-card]',
  );
  const [firstBox, secondBox] = await Promise.all([
    cards.nth(0).boundingBox(),
    cards.nth(1).boundingBox(),
  ]);
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(Math.abs((firstBox?.y ?? 0) - (secondBox?.y ?? 0))).toBeLessThan(2);
  expect(secondBox?.x ?? 0).toBeGreaterThan(
    (firstBox?.x ?? 0) + (firstBox?.width ?? 0) - 2,
  );
  await assertNoPageOverflow(page, "desktop tool cards");
});

test("reduced-motion preference suppresses nonessential motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoLoaded(page, "/");

  const motion = await page.evaluate(() => {
    const parseDuration = (value: string) =>
      value
        .split(",")
        .map((part) => part.trim())
        .map((part) =>
          part.endsWith("ms")
            ? Number.parseFloat(part)
            : Number.parseFloat(part) * 1000,
        )
        .filter(Number.isFinite);
    const movingElements = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0;
      })
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          animation: style.animationName,
          animationDuration: Math.max(
            0,
            ...parseDuration(style.animationDuration),
          ),
          element: element.tagName.toLowerCase(),
          transitionDuration: Math.max(
            0,
            ...parseDuration(style.transitionDuration),
          ),
        };
      })
      .filter(
        ({ animation, animationDuration, transitionDuration }) =>
          (animation !== "none" && animationDuration > 1) ||
          transitionDuration > 1,
      );

    return {
      linkButtonTransitionDuration: Math.max(
        0,
        ...parseDuration(
          getComputedStyle(
            document.querySelector(".sl-link-button") ?? document.body,
          ).transitionDuration,
        ),
      ),
      matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
      movingElements,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    };
  });

  expect(motion.matches).toBe(true);
  expect(motion.linkButtonTransitionDuration).toBe(0);
  expect(motion.scrollBehavior).not.toBe("smooth");
  expect(
    motion.movingElements,
    "Reduced motion leaves animated visible elements",
  ).toEqual([]);
});

test("mobile controls meet the WCAG 2.2 minimum touch-target size", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoLoaded(page, "/getting-started/");

  const menu = page.locator("starlight-menu-button").first();
  await menu.locator("button").click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");

  const undersizedTargets = await page
    .locator(
      "button:visible, select:visible, summary:visible, nav a[href]:visible, a.sl-link-button:visible",
    )
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            height: Math.round(bounds.height * 10) / 10,
            label:
              element.getAttribute("aria-label") ??
              element.textContent?.trim().slice(0, 80) ??
              "",
            tag: element.tagName.toLowerCase(),
            width: Math.round(bounds.width * 10) / 10,
          };
        })
        .filter(({ height, width }) => height < 24 || width < 24),
    );

  expect(
    undersizedTargets,
    `Mobile controls smaller than 24×24 CSS pixels: ${JSON.stringify(undersizedTargets, null, 2)}`,
  ).toEqual([]);
});

test("pages reflow without horizontal overflow at a 200% zoom equivalent", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // At 200% browser zoom, a 1440×900 display exposes roughly a 720×450 CSS-pixel
  // viewport. Using that viewport avoids engine-private zoom controls and
  // exercises the same responsive reflow in the Chromium PR gate.
  await page.setViewportSize({ width: 720, height: 450 });

  for (const route of publicRoutes) {
    await test.step(route, async () => {
      await gotoLoaded(page, route);
      await expect(page.locator("main h1")).toBeVisible();
      await assertNoPageOverflow(page, `${route} at a 200% zoom equivalent`);
    });
  }
});

test.describe("responsive horizontal overflow", () => {
  for (const viewport of responsiveViewports) {
    test(`${viewport.name} contains every public route`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);

      for (const route of publicRoutes) {
        await test.step(route, async () => {
          await gotoLoaded(page, route);
          await assertNoPageOverflow(
            page,
            `${route} at ${viewport.width}×${viewport.height}`,
          );
        });
      }
    });
  }
});
