import { describe, expect, it } from "vitest";
import {
  formatRepositoryStarCount,
  formatRepositoryStarCountLabel,
  isRepositoryStarCount,
  REPOSITORY_API_URL,
  REPOSITORY_URL,
} from "../../src/data/repository.js";
import { TOOL_COUNT } from "../../src/data/tool-catalog.js";
import {
  DISCLAIMER,
  HERO_TAGLINE,
  HERO_TITLE,
  LEGACY_REDIRECTS,
  OFFICIAL_ENDPOINT,
  PRIMARY_NAVIGATION,
  ROADMAP_URL,
} from "../support/site.js";
import {
  anchorHrefs,
  attribute,
  elements,
  findById,
  hasClass,
  normalizedText,
  normalizedVisibleText,
  readRoute,
  required,
} from "./html.js";

function headingTexts(
  document: Awaited<ReturnType<typeof readRoute>>["document"],
  level: number,
) {
  return elements(document, (element) => element.tagName === `h${level}`).map(
    normalizedText,
  );
}

function routeText(result: Awaited<ReturnType<typeof readRoute>>) {
  return normalizedVisibleText(result.document);
}

const OFFICIAL_REST_GROUPS = [
  "Actions",
  "Applications",
  "Batch",
  "Boards",
  "Cards",
  "Checklists",
  "CustomFields",
  "Emoji",
  "Enterprises",
  "Labels",
  "Lists",
  "Members",
  "Notifications",
  "Organizations",
  "Plugins",
  "Search",
  "Tokens",
  "Webhooks",
] as const;

describe("independent-project and support content", () => {
  it("shows the independent-project notice only where intended", async () => {
    for (const route of ["/", "/getting-started/"]) {
      const page = await readRoute(route);
      const asides = elements(
        page.document,
        (element) =>
          element.tagName === "aside" &&
          attribute(element, "aria-label") ===
            "Independent integration for Trello",
      );
      expect(routeText(page)).toContain(DISCLAIMER);
      expect(routeText(page)).not.toContain(OFFICIAL_ENDPOINT);
      expect(asides).toHaveLength(1);
      expect(
        hasClass(
          required(asides[0], `${route} project notice`),
          "starlight-aside--note",
        ),
      ).toBe(true);
      expect(anchorHrefs(page.document)).toContain("https://trello.com/mcp");
    }

    for (const route of [
      "/getting-started/clients/",
      "/getting-started/trello-api-key/",
    ]) {
      const page = await readRoute(route);
      expect(routeText(page)).not.toContain(DISCLAIMER);
      expect(routeText(page)).not.toContain(OFFICIAL_ENDPOINT);
      expect(routeText(page)).not.toContain("developed by Antoine Ménard");
    }

    expect(routeText(await readRoute("/guides/faq/"))).toContain(
      OFFICIAL_ENDPOINT,
    );
    const reference = await readRoute("/reference/");
    expect(routeText(reference)).not.toContain(OFFICIAL_ENDPOINT);
    expect(anchorHrefs(reference.document)).toContain(
      "https://support.atlassian.com/trello/docs/connect-trello-to-ai-assistants-with-trello-mcp/",
    );
  });

  it("keeps generated contribution, issue, and security policy guidance complete", async () => {
    const contributing = await readRoute("/reference/contributing/");
    const reporting = await readRoute("/reference/reporting-issues/");
    const security = await readRoute("/reference/security-policy/");

    for (const marker of [
      "corepack pnpm website:check",
      "corepack pnpm docs:tools",
      "corepack pnpm registry:tools",
      "corepack pnpm registry:tools:check",
      "Do not post Trello API keys",
      "vX.Y.Z",
      "annotated",
      "post-merge main Release workflow succeeds",
      "merged origin/main release commit",
      "Docker MCP Registry readiness audit",
      "Glama MCP registry readiness audit",
      "Star on GitHub",
    ]) {
      expect(routeText(contributing)).toContain(marker);
    }
    expect(anchorHrefs(contributing.document)).toContain(
      "https://github.com/enthouan/trello-mcp/blob/main/docs/registry-readiness.md",
    );
    expect(anchorHrefs(contributing.document)).toContain(
      "https://github.com/enthouan/trello-mcp/blob/main/docs/glama-readiness.md",
    );
    for (const marker of [
      "Sanitize every report",
      "Check the focused documentation first",
      "Security reports",
      "short non-sensitive public summary",
      "Do not include vulnerability details",
      "Support boundaries",
      "Open an issue",
      "Star on GitHub",
    ]) {
      expect(routeText(reporting)).toContain(marker);
    }
    expect(anchorHrefs(reporting.document)).toContain(
      `${REPOSITORY_URL}/issues/new/choose`,
    );
    for (const marker of [
      "Reporting A Vulnerability",
      "Do not post secrets",
      "Supported Versions",
      "Threat Model Basics",
      "v1.0 is the current stable release line",
    ]) {
      expect(routeText(security)).toContain(marker);
    }
    expect(routeText(security)).not.toContain("pre-1.0");
  });
});

describe("installation and onboarding content", () => {
  it("keeps image, exact-tag, loopback, and source-build guidance", async () => {
    const docker = await readRoute("/getting-started/docker/");
    const http = await readRoute("/getting-started/http/");
    const stdio = await readRoute("/getting-started/stdio/");
    const clients = await readRoute("/getting-started/clients/");

    for (const marker of [
      "Install and distribution",
      "ghcr.io/enthouan/trello-mcp",
      "Pins one exact release",
      "Follows the current main branch build",
      "Set TRELLO_MCP_IMAGE_TAG to an exact published X.Y.Z release",
      "Local Docker build",
      "docker compose -f docker-compose.local.yml up --build",
      "http://127.0.0.1:3000/mcp",
      "http://127.0.0.1:3000/healthz",
      "http://127.0.0.1:3000/readyz",
      "Windows PowerShell",
      "auth_whoami",
    ]) {
      expect(routeText(docker)).toContain(marker);
    }
    expect(routeText(docker)).not.toContain("http://localhost:3000");

    for (const marker of [
      "Direct Node.js HTTP is not loopback-constrained",
      "MCP_AUTH_TOKEN",
      "terminate TLS at a reverse proxy",
      "trello-mcp does not implement that option",
      "docker compose -f docker-compose.local.yml up --build",
    ]) {
      expect(routeText(http)).toContain(marker);
    }
    expect(routeText(http)).not.toContain("MCP_ALLOWED_ORIGINS");
    expect(routeText(http)).not.toContain(
      "refuses an unauthenticated non-loopback bind",
    );

    for (const marker of [
      "No network listener is opened",
      "TRANSPORT=stdio",
      "TRELLO_API_KEY",
      "TRELLO_TOKEN",
      "/absolute/path/to/trello-mcp/dist/index.js",
    ]) {
      expect(routeText(stdio)).toContain(marker);
    }
    expect(anchorHrefs(clients.document)).toContain(
      "/getting-started/docker/#local-docker-build",
    );
  });

  it("preserves legacy anchors, dependency order, and no-JavaScript fallbacks", async () => {
    const page = await readRoute("/getting-started/");
    for (const anchor of [
      "before-you-begin",
      "install-and-distribution",
      "docker-streamable-http",
      "local-docker-build",
      "local-stdio",
      "connect-a-client",
      "verify-safely",
      "next-steps",
    ]) {
      expect(findById(page.document, anchor)).toHaveLength(1);
    }
    for (const href of [
      "/getting-started/docker/",
      "/getting-started/http/",
      "/getting-started/stdio/",
    ]) {
      expect(anchorHrefs(page.document)).toContain(href);
    }

    const orderedHeadings = [
      "Prerequisites",
      "Common path",
      "Choose a transport, then an installation",
      "Configure your client",
      "Next",
    ];
    expect(
      headingTexts(page.document, 2).filter((heading) =>
        orderedHeadings.includes(heading),
      ),
    ).toEqual(orderedHeadings);
    expect(page.source.match(/aria-labelledby="no-script-/g)).toHaveLength(5);
    expect(page.source).toContain("Installation guides without JavaScript");
    expect(page.source).toContain("member-id");
    expect(page.source).toContain("your-username");
    expect(page.source).not.toMatch(
      /(?:TRELLO_API_KEY|TRELLO_TOKEN|MCP_AUTH_TOKEN)[^<\n]{0,32}[a-f0-9]{32,64}/i,
    );
  });

  it("keeps compatibility evidence ordered and stale branding absent", async () => {
    const compatibility = await readRoute("/getting-started/compatibility/");
    const expectedOrder = [
      "Codex",
      "Claude Code",
      "Claude Desktop",
      "VS Code",
      "OpenCode",
      "MCP Inspector",
    ];
    expect(
      headingTexts(compatibility.document, 3).filter((heading) =>
        expectedOrder.includes(heading),
      ),
    ).toEqual(expectedOrder);

    for (const route of [
      "/",
      "/getting-started/",
      "/getting-started/clients/",
      "/getting-started/compatibility/",
    ]) {
      const text = routeText(await readRoute(route));
      expect(text).not.toMatch(/\bCursor\b/);
      expect(text).not.toMatch(/OpenCode V\d/i);
    }
    const compatibilityText = routeText(compatibility);
    expect(compatibilityText).not.toMatch(
      /owner-approved assumption|issue branch|\basdf\b|Homebrew/i,
    );
  });
});

describe("homepage and reference content", () => {
  it("keeps the homepage actions, trust evidence, clients, and roadmap", async () => {
    const page = await readRoute("/");
    const text = routeText(page);
    const hrefs = anchorHrefs(page.document);
    const githubAction = required(
      elements(
        page.document,
        (element) =>
          element.tagName === "a" &&
          attribute(element, "data-github-action") !== undefined,
      )[0],
      "homepage GitHub action",
    );
    const repositoryNavigation = required(
      elements(
        page.document,
        (element) =>
          element.tagName === "a" &&
          attribute(element, "data-repository-navigation") !== undefined,
      )[0],
      "repository navigation link",
    );

    expect(text).toContain(HERO_TITLE);
    expect(text).toContain(HERO_TAGLINE);
    for (const label of [
      "Get started",
      "View on GitHub",
      "77 catalog-backed tools",
      "Choose your trust boundary",
      "Trello secrets stay out of prompts",
      "Archive before delete",
      "Let your MCP client create a Trello card for you",
      "Pick your MCP client",
      "One canonical, searchable tool catalog",
      "Independent integration for Trello",
      "public trello-mcp roadmap",
    ]) {
      expect(text).toContain(label);
    }
    for (const href of [
      "/getting-started/",
      REPOSITORY_URL,
      ROADMAP_URL,
      "/reference/tools/",
      "/getting-started/clients/",
    ]) {
      expect(hrefs).toContain(href);
    }
    expect(attribute(githubAction, "href")).toBe(REPOSITORY_URL);
    expect(attribute(githubAction, "rel")).toBe("external");
    expect(attribute(githubAction, "referrerpolicy")).toBe("no-referrer");
    expect(attribute(githubAction, "aria-label")).toBeUndefined();
    expect(normalizedText(githubAction)).toBe("View on GitHub");
    expect(
      elements(
        githubAction,
        (element) =>
          attribute(element, "data-repository-star-slot") !== undefined,
      ),
    ).toHaveLength(0);
    expect(attribute(repositoryNavigation, "href")).toBe(REPOSITORY_URL);
    expect(attribute(repositoryNavigation, "rel")).toBe("me external");
    expect(attribute(repositoryNavigation, "referrerpolicy")).toBe(
      "no-referrer",
    );
    expect(attribute(repositoryNavigation, "aria-label")).toBe(
      "trello-mcp source repository",
    );
    expect(attribute(repositoryNavigation, "data-repository-label")).toBe(
      "trello-mcp source repository",
    );
    const starSlot = required(
      elements(
        repositoryNavigation,
        (element) =>
          attribute(element, "data-repository-star-slot") !== undefined,
      )[0],
      "reserved repository star slot",
    );
    expect(attribute(starSlot, "aria-hidden")).toBe("true");
    expect(
      elements(
        starSlot,
        (element) =>
          attribute(element, "data-repository-star-value") !== undefined,
      ),
    ).toHaveLength(1);
    expect(
      elements(
        page.document,
        (element) =>
          attribute(element, "data-repository-star-count") !== undefined,
      ),
    ).toHaveLength(0);

    const docsPage = await readRoute("/getting-started/");
    expect(
      elements(
        docsPage.document,
        (element) =>
          element.tagName === "a" &&
          attribute(element, "data-repository-navigation") !== undefined,
      ),
    ).toHaveLength(2);
  });

  it("validates and compactly formats only usable repository star counts", () => {
    expect(REPOSITORY_API_URL).toBe(
      "https://api.github.com/repos/enthouan/trello-mcp",
    );
    for (const value of [0, 1, 1_234]) {
      expect(isRepositoryStarCount(value)).toBe(true);
    }
    for (const value of [
      -0,
      -1,
      1.5,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      "1234",
      null,
      undefined,
    ]) {
      expect(isRepositoryStarCount(value)).toBe(false);
    }
    expect(formatRepositoryStarCount(0)).toBe("0");
    expect(formatRepositoryStarCount(1_234)).toBe("1.2K");
    expect(formatRepositoryStarCountLabel(0)).toBe("0 stars");
    expect(formatRepositoryStarCountLabel(1)).toBe("1 star");
    expect(formatRepositoryStarCountLabel(1_234)).toBe("1.2K stars");
  });

  it("keeps security, FAQ, reference, and credential boundaries explicit", async () => {
    const security = routeText(await readRoute("/guides/security/"));
    const faq = routeText(await readRoute("/guides/faq/"));
    const reference = await readRoute("/reference/");
    const credentials = await readRoute("/getting-started/trello-api-key/");
    const configuration = await readRoute("/reference/configuration/");

    for (const marker of [
      "Trello API key and token",
      "MCP_AUTH_TOKEN",
      "TRELLO_ATTACHMENT_UPLOAD_ROOT",
      "permanent deletion",
      "redact",
      "security boundary",
    ]) {
      expect(security).toContain(marker);
    }
    for (const marker of [
      "official hosted MCP server",
      OFFICIAL_ENDPOINT,
      "self-hosted",
      "credentials",
      "permanently delete",
      "Comparison last checked August 10, 2026",
      "Each connection supports one authorized Workspace at launch",
    ]) {
      expect(faq).toContain(marker);
    }
    for (const marker of [
      "Open source and independently maintained",
      "MIT licensed",
      "Self-hostable",
      "Node 24",
      "Releases",
      "changelog",
      "Issues",
      "public roadmap",
      "Documentation contracts",
      "v1.0 public baseline",
    ]) {
      expect(routeText(reference)).toContain(marker);
    }
    expect(routeText(reference)).toContain(
      "trello-mcp is an independent, community-maintained project.",
    );
    expect(routeText(reference)).not.toContain("Pre-1.0");
    expect(anchorHrefs(reference.document)).toContain(REPOSITORY_URL);
    expect(anchorHrefs(reference.document)).toContain(ROADMAP_URL);
    expect(anchorHrefs(reference.document)).toContain(
      "https://support.atlassian.com/trello/docs/connect-trello-to-ai-assistants-with-trello-mcp/",
    );
    expect(
      configuration.source.match(/TRELLO_MCP_IMAGE_TAG=1\.0\.0/g),
    ).toHaveLength(2);
    expect(configuration.source).not.toContain("TRELLO_MCP_IMAGE_TAG=0.9.0");

    for (const marker of [
      "TRELLO_API_KEY",
      "TRELLO_TOKEN",
      "MCP_AUTH_TOKEN",
      "Open Trello App Admin Portal",
      "The token is broad account access",
      "auth_whoami",
      "auth_token_info",
      "your-api-key",
      "your-token",
    ]) {
      expect(routeText(credentials)).toContain(marker);
    }
    expect(routeText(credentials)).not.toContain("https://localhost");
    expect(anchorHrefs(credentials.document)).toContain(
      "https://trello.com/apps/admin",
    );
  });
});

describe("long-form operational content", () => {
  const contentMarkers = {
    "/guides/how-it-works/": [
      "The MCP client is part of the trust boundary",
      "Who owns what",
      "Choose the process boundary",
      "accepts connections on internal port 3000",
      "sessionful Streamable HTTP",
      "Mcp-Session-Id",
      "TrelloClient",
      "source of truth",
    ],
    "/guides/workflows/": [
      "Client approval is not a server guarantee",
      "Summarize a board without changing it",
      "Create and organize a card",
      "Move or archive completed work",
      "Review activity before adding a comment",
      "Set or clear a custom field",
      "Attach a URL or a server-local file",
      "Prefer archive tools for recoverable cleanup",
    ],
    "/guides/operations/": [
      "Before a change",
      "Inspect a running service",
      "Upgrade the published image",
      "Roll back",
      "Rotate credentials",
      "Stop or remove the service",
      "State, backup, and retention",
      "docker compose pull trello-mcp",
      "docker compose down",
      "Do not add -v as a routine shutdown step",
      "The server has no application database",
    ],
    "/guides/troubleshooting/": [
      "Sanitize before sharing",
      "Streamable HTTP",
      "Docker Compose",
      "Trello API errors and permissions",
      "Attachment upload paths",
      "Prepare a sanitized issue report",
      "/healthz",
      "/readyz",
      "HTTP 401",
      "HTTP 403",
      "HTTP 404",
      "HTTP 429",
    ],
    "/reference/configuration/": [
      "Keep configuration private",
      "TRELLO_API_KEY",
      "TRELLO_TOKEN",
      "MCP_AUTH_TOKEN",
      "TRELLO_ATTACHMENT_UPLOAD_ROOT",
      "TRELLO_RATE_LIMIT_CAPACITY",
      "TRELLO_RETRY_MAX_ATTEMPTS",
      "TRELLO_MCP_HOST_BIND_IP",
      "TRELLO_MCP_IMAGE_TAG",
      "Current Compose limitation",
      "Adding the variable to .env alone therefore does not enable local uploads",
    ],
  } as const;

  for (const [route, markers] of Object.entries(contentMarkers)) {
    it(`${route} preserves its operational boundaries`, async () => {
      const text = routeText(await readRoute(route));
      for (const marker of markers) expect(text).toContain(marker);
      expect(text).not.toContain("MCP_ALLOWED_ORIGINS");
    });
  }
});

describe("information architecture output", () => {
  it("keeps the three sidebar groups and canonical pagination order", async () => {
    const page = await readRoute("/getting-started/");
    const sidebar = required(
      findById(page.document, "starlight__sidebar")[0],
      "Starlight sidebar",
    );
    const links = elements(
      sidebar,
      (element) =>
        element.tagName === "a" && attribute(element, "href") !== undefined,
    ).map((element) => [normalizedText(element), attribute(element, "href")]);

    for (const expected of PRIMARY_NAVIGATION) {
      expect(links).toContainEqual([...expected]);
    }
    expect(normalizedText(sidebar)).not.toContain("Concepts");
    expect(normalizedText(sidebar)).not.toContain("Project");

    const expectedPagination = [
      ["/getting-started/", "next", "/getting-started/trello-api-key/"],
      ["/getting-started/clients/", "next", "/getting-started/compatibility/"],
      ["/getting-started/compatibility/", "next", "/getting-started/docker/"],
      ["/getting-started/http/", "prev", "/getting-started/docker/"],
      ["/getting-started/http/", "next", "/getting-started/stdio/"],
      ["/getting-started/stdio/", "next", "/guides/how-it-works/"],
    ] as const;
    for (const [route, rel, href] of expectedPagination) {
      const document = (await readRoute(route)).document;
      const matches = elements(
        document,
        (element) =>
          element.tagName === "a" &&
          attribute(element, "rel") === rel &&
          attribute(element, "href") === href,
      );
      expect(matches).toHaveLength(1);
    }
  });

  it("keeps complete API coverage scope, statuses, groups, and legacy anchors", async () => {
    const page = await readRoute("/reference/api-coverage/");
    const detailedGroupNames = [
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
    const text = routeText(page);
    for (const marker of [
      `all ${TOOL_COUNT} tools currently registered through allTools`,
      "The v1.0 release provides broad Trello workflow coverage",
      "not a one-to-one Trello REST proxy",
      "The v1.0 scope intentionally excludes Enterprise administration",
    ]) {
      expect(text).toContain(marker);
    }

    const tables = elements(
      page.document,
      (element) => element.tagName === "table",
    );
    const firstColumn = (table: (typeof tables)[number]) =>
      elements(table, (element) => element.tagName === "tr")
        .slice(1)
        .map((row) =>
          normalizedText(
            required(
              elements(row, (element) => element.tagName === "td")[0],
              "table row first cell",
            ),
          ),
        );
    const headers = (table: (typeof tables)[number]) =>
      elements(table, (element) => element.tagName === "th").map(
        normalizedText,
      );
    const statusLegend = required(
      tables.find(
        (table) => headers(table).slice(0, 2).join("|") === "Status|Meaning",
      ),
      "API coverage status legend",
    );
    expect(firstColumn(statusLegend)).toEqual([
      "✅ Supported",
      "🟡 Partially supported",
      "⏳ Deferred",
      "🚫 Not planned",
    ]);
    const coverageMatrix = required(
      tables.find((table) => headers(table)[0] === "Trello REST API group"),
      "top-level API coverage matrix",
    );
    expect(firstColumn(coverageMatrix)).toEqual(OFFICIAL_REST_GROUPS);

    expect(headingTexts(page.document, 3)).toEqual(detailedGroupNames);
    expect(routeText(page)).not.toContain("API Group:");
    for (const groupName of detailedGroupNames) {
      expect(
        findById(page.document, `api-group-${groupName.toLowerCase()}`),
      ).toHaveLength(1);
    }
  });

  it("keeps every legacy route mapped to its canonical destination", () => {
    expect(LEGACY_REDIRECTS).toHaveLength(14);
    expect(new Set(LEGACY_REDIRECTS.map(([route]) => route)).size).toBe(
      LEGACY_REDIRECTS.length,
    );
  });
});
