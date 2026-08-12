export const DISCLAIMER =
  "trello-mcp is an independent, community-maintained project. It is not an official Trello or Atlassian product, service, or MCP implementation, and it is not affiliated with, endorsed by, or sponsored by Trello or Atlassian.";
export const DEVELOPER_URL = "https://www.antoinemenard.com/";
export const OFFICIAL_ENDPOINT = "https://mcp.trello.com/v1";
export const ROADMAP_URL =
  "https://trello.com/b/GnKmvuHz/trello-mcp-enthouan-trello-mcp";
export const CANONICAL_WEBSITE_URL = "https://trello-mcp.com/";
export const CANONICAL_WEBSITE_ORIGIN = new URL(CANONICAL_WEBSITE_URL).origin;
export const FOOTER_ATTRIBUTION =
  "trello-mcp is an open-source project released under the MIT License and maintained by Antoine Ménard.";
export const FOOTER_DISCLAIMER =
  "It is not an official Trello or Atlassian product and is not affiliated with or endorsed by either company.";
export const COPY_FAILURE_MESSAGE =
  "Copy failed. Select the code and copy it manually.";
export const HERO_TITLE = "Manage Trello from your MCP client.";
export const HERO_TAGLINE =
  "A self-hosted Model Context Protocol (MCP) server for existing Trello users. Find cards, organize lists, manage checklists, and coordinate projects from a server you run.";

export const CLIENT_ICON_SOURCES = {
  claude: ["fab", "claude"],
  evidence: ["fas", "clipboard-check"],
  inspector: ["fas", "magnifying-glass"],
  openai: ["fab", "openai"],
  opencode: ["fas", "robot"],
  vscode: ["fas", "code"],
} as const;

export const CATALOG_CATEGORY_COUNT = 13;
export const CATALOG_PREVIEW_CATEGORIES = [
  [
    "boards",
    "Boards",
    11,
    ["list_boards", "board_create", "board_get", "board_field_get"],
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
  ["search", "Search", 2, ["search", "search_members"]],
] as const;

export const PUBLIC_ROUTES = [
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

export const PUBLIC_DOCUMENT_METADATA = {
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
  "/guides/security/": {
    title: "Security and data flow",
    description:
      "Understand how trello-mcp handles credentials, Trello data, transports, logs, attachment uploads, and write operations.",
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
  "/guides/faq/": {
    title: "FAQ",
    description:
      "Answers about trello-mcp hosting, credentials, transports, Trello access, destructive tools, privacy, support, and the official Trello MCP server.",
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
} as const satisfies Record<
  Exclude<(typeof PUBLIC_ROUTES)[number], "/404.html">,
  { title: string; description: string }
>;

export const PRIMARY_NAVIGATION = [
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

export const LEGACY_REDIRECTS = [
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

export const RESPONSIVE_VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

export const REPRESENTATIVE_ACCESSIBILITY_ROUTES = [
  "/",
  "/getting-started/",
  "/getting-started/clients/",
  "/guides/how-it-works/",
  "/guides/security/",
  "/reference/",
  "/reference/tools/",
  "/reference/reporting-issues/",
  "/404.html",
] as const;
