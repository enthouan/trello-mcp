import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import {
  CLIENT_DOCUMENTATION_ORDER,
  type ClientSetup,
  getClientSetup,
} from "../docs/setup-recipes.js";
import { allTools } from "../src/trello/tools.js";

const toolsStartMarker = "<!-- tools:start -->";
const toolsEndMarker = "<!-- tools:end -->";
const clientRecipesStartMarker = "<!-- client-recipes:start -->";
const clientRecipesEndMarker = "<!-- client-recipes:end -->";

const paths = {
  contributing: new URL("../CONTRIBUTING.md", import.meta.url),
  readme: new URL("../README.md", import.meta.url),
  securityPolicy: new URL("../SECURITY.md", import.meta.url),
  support: new URL("../SUPPORT.md", import.meta.url),
  apiCoverage: new URL("../docs/api-coverage.md", import.meta.url),
  clientCompatibility: new URL(
    "../docs/mcp-client-compatibility.md",
    import.meta.url,
  ),
  clientSetup: new URL("../docs/client-setup.md", import.meta.url),
  configuration: new URL("../docs/configuration.md", import.meta.url),
  howItWorks: new URL("../docs/how-it-works.md", import.meta.url),
  howItWorksRequestFlow: new URL(
    "../docs/assets/how-it-works/request-flow.svg",
    import.meta.url,
  ),
  operations: new URL("../docs/operations.md", import.meta.url),
  troubleshooting: new URL("../docs/troubleshooting.md", import.meta.url),
  trelloApiKey: new URL("../docs/trello-api-key.md", import.meta.url),
  workflows: new URL("../docs/workflows.md", import.meta.url),
  siteClients: new URL(
    "../website/src/content/docs/getting-started/clients.mdx",
    import.meta.url,
  ),
  siteHome: new URL("../website/src/content/docs/index.mdx", import.meta.url),
  siteTrelloApiKey: new URL(
    "../website/src/content/docs/getting-started/trello-api-key.mdx",
    import.meta.url,
  ),
  siteCompatibility: new URL(
    "../website/src/content/docs/getting-started/compatibility.mdx",
    import.meta.url,
  ),
  siteConfiguration: new URL(
    "../website/src/content/docs/reference/configuration.mdx",
    import.meta.url,
  ),
  siteContributing: new URL(
    "../website/src/content/docs/reference/contributing.md",
    import.meta.url,
  ),
  siteHowItWorks: new URL(
    "../website/src/content/docs/guides/how-it-works.mdx",
    import.meta.url,
  ),
  siteOperations: new URL(
    "../website/src/content/docs/guides/operations.md",
    import.meta.url,
  ),
  siteLegacyHowItWorks: new URL(
    "../website/src/content/docs/concepts/how-it-works.mdx",
    import.meta.url,
  ),
  siteSecurityPolicy: new URL(
    "../website/src/content/docs/reference/security-policy.md",
    import.meta.url,
  ),
  siteSupport: new URL(
    "../website/src/content/docs/reference/reporting-issues.mdx",
    import.meta.url,
  ),
  siteTroubleshooting: new URL(
    "../website/src/content/docs/guides/troubleshooting.mdx",
    import.meta.url,
  ),
  siteTools: new URL(
    "../website/src/content/docs/reference/tools.mdx",
    import.meta.url,
  ),
  siteWorkflows: new URL(
    "../website/src/content/docs/guides/workflows.mdx",
    import.meta.url,
  ),
  siteApiCoverage: new URL(
    "../website/src/content/docs/reference/api-coverage.mdx",
    import.meta.url,
  ),
  siteRequestFlow: new URL(
    "../website/public/request-flow.svg",
    import.meta.url,
  ),
};

type GeneratedFile = {
  contents: string;
  label: string;
  path: URL;
};

const obsoleteGeneratedFiles = [
  {
    label: "website/src/content/docs/concepts/how-it-works.mdx",
    path: paths.siteLegacyHowItWorks,
  },
  {
    label: "website/public/transport-chooser.svg",
    path: new URL("../website/public/transport-chooser.svg", import.meta.url),
  },
  ...[
    "clients/index.mdx",
    "clients/compatibility.md",
    "trello-api-key.mdx",
    "tools/index.mdx",
    "tools/api-coverage.md",
    "reference/support.md",
  ].map((relativePath) => ({
    label: `website/src/content/docs/${relativePath}`,
    path: new URL(
      `../website/src/content/docs/${relativePath}`,
      import.meta.url,
    ),
  })),
] as const;

const args = process.argv.slice(2);
const checkMode = args.length === 1 && args[0] === "--check";

if (args.length > 0 && !checkMode) {
  throw new Error("Usage: generate-tool-docs.ts [--check]");
}

function normalizeMarkdown(source: string): string {
  return source.replaceAll("\r\n", "\n");
}

function escapeTableCell(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\r\n", " ")
    .replaceAll("\n", " ");
}

function inputKeys(tool: (typeof allTools)[number]): string {
  if (!("shape" in tool.inputSchema)) {
    return "";
  }

  return Object.keys(tool.inputSchema.shape as Record<string, unknown>).join(
    ", ",
  );
}

function toolTable(): string {
  const rows = ["| Name | When to use | Key inputs |", "| --- | --- | --- |"];

  for (const tool of allTools) {
    rows.push(
      `| \`${escapeTableCell(tool.name)}\` | ${escapeTableCell(tool.description)} | ${escapeTableCell(inputKeys(tool))} |`,
    );
  }

  return rows.join("\n");
}

function replaceReadmeCatalog(readmeSource: string, table: string): string {
  const readme = normalizeMarkdown(readmeSource);
  const startCount = readme.split(toolsStartMarker).length - 1;
  const endCount = readme.split(toolsEndMarker).length - 1;

  if (startCount !== 1 || endCount !== 1) {
    throw new Error(
      `README.md must contain exactly one ${toolsStartMarker} and one ${toolsEndMarker}`,
    );
  }

  const start = readme.indexOf(toolsStartMarker);
  const end = readme.indexOf(toolsEndMarker, start);
  if (start > end) {
    throw new Error(
      `README.md must place ${toolsStartMarker} before ${toolsEndMarker}`,
    );
  }

  const catalog = [
    toolsStartMarker,
    `**${allTools.length} tools** are registered. Names, descriptions, and key inputs are generated from \`allTools\`.`,
    "",
    table,
    toolsEndMarker,
  ].join("\n");

  return `${readme.slice(0, start)}${catalog}${readme.slice(end + toolsEndMarker.length)}`;
}

function validateHomepageToolCount(homepageSource: string): string {
  const homepage = normalizeMarkdown(homepageSource);
  const importStatement =
    "import { TOOL_COUNT } from '../../data/tool-catalog.js';";
  const firstImport = homepage.indexOf(importStatement);
  const lastImport = homepage.lastIndexOf(importStatement);

  if (firstImport === -1 || firstImport !== lastImport) {
    throw new Error(
      "website/src/content/docs/index.mdx must import the runtime-backed TOOL_COUNT exactly once",
    );
  }

  return homepage;
}

function withoutDocumentTitle(source: string, label: string): string {
  const normalized = normalizeMarkdown(source);
  const title = normalized.match(/^# [^\n]+\n/);
  if (!title) {
    throw new Error(`${label} must start with one level-one Markdown heading`);
  }

  return normalized.slice(title[0].length).replace(/^\n/, "").trimEnd();
}

function starlightPage(
  title: string,
  description: string,
  body: string,
  extraFrontmatter: readonly string[] = [],
): string {
  return [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    ...extraFrontmatter,
    "---",
    "",
    body.trimEnd(),
    "",
  ].join("\n");
}

const siteLinkRewrites = new Map([
  ["api-coverage.md", "/reference/api-coverage/"],
  ["configuration.md", "/reference/configuration/"],
  ["how-it-works.md", "/guides/how-it-works/"],
  ["operations.md", "/guides/operations/"],
  ["troubleshooting.md", "/guides/troubleshooting/"],
  ["workflows.md", "/guides/workflows/"],
  ["mcp-client-compatibility.md", "/getting-started/compatibility/"],
  ["client-setup.md", "/getting-started/clients/"],
  [
    "client-setup.md#mcp-inspector-and-manual-clients",
    "/getting-started/clients/#mcp-inspector-and-manual-clients",
  ],
  ["trello-api-key.md", "/getting-started/trello-api-key/"],
  [
    "../README.md#attachment-uploads",
    "/reference/configuration/#local-attachment-uploads",
  ],
  ["../README.md#environment", "/reference/configuration/"],
  ["../README.md#quick-start", "/getting-started/"],
  ["../README.md#security-notes", "/guides/security/"],
  ["SECURITY.md", "/reference/security-policy/"],
  ["./SECURITY.md", "/reference/security-policy/"],
  ["CONTRIBUTING.md", "/reference/contributing/"],
  ["./CONTRIBUTING.md", "/reference/contributing/"],
  ["SUPPORT.md", "/reference/reporting-issues/"],
  ["./SUPPORT.md", "/reference/reporting-issues/"],
  ["PRIVACY.md", "https://github.com/enthouan/trello-mcp/blob/main/PRIVACY.md"],
  [
    "./PRIVACY.md",
    "https://github.com/enthouan/trello-mcp/blob/main/PRIVACY.md",
  ],
  ["../SECURITY.md", "/reference/security-policy/"],
  ["../CONTRIBUTING.md", "/reference/contributing/"],
  ["../SUPPORT.md", "/reference/reporting-issues/"],
  [
    "../PRIVACY.md",
    "https://github.com/enthouan/trello-mcp/blob/main/PRIVACY.md",
  ],
  [
    "../docker-compose.yml",
    "https://github.com/enthouan/trello-mcp/blob/main/docker-compose.yml",
  ],
  [
    "../docker-compose.local.yml",
    "https://github.com/enthouan/trello-mcp/blob/main/docker-compose.local.yml",
  ],
  [
    "../README.md#option-a-run-the-published-docker-image",
    "/getting-started/docker/",
  ],
  [
    "../README.md#option-b-build-locally-from-source",
    "/getting-started/docker/#local-docker-build",
  ],
  ["../README.md#live-trello-smoke-tests", "/reference/#live-validation"],
  ["assets/how-it-works/request-flow.svg", "/request-flow.svg"],
]);

function rewriteSiteLinks(source: string, label: string): string {
  const rewrites = new Map(siteLinkRewrites);
  rewrites.set(
    "../README.md#3-connect-your-mcp-client",
    "/getting-started/clients/",
  );
  rewrites.set("../README.md#mcp-client-setup", "/getting-started/clients/");

  let rewritten = source;
  for (const [from, to] of rewrites) {
    rewritten = rewritten.replaceAll(`](${from})`, `](${to})`);
  }

  const unresolved = rewritten.match(
    /\]\((?:\.\.\/(?:README|SECURITY|CONTRIBUTING|SUPPORT|PRIVACY)\.md|(?:\.\/)?(?:SECURITY|CONTRIBUTING|SUPPORT|PRIVACY)\.md|\.\.\/docker-compose(?:\.local)?\.yml|(?:\.\/)?(?:api-coverage|client-setup|configuration|how-it-works|mcp-client-compatibility|operations|trello-api-key|troubleshooting|workflows)\.md|assets\/)[^)]*\)/,
  );
  if (unresolved) {
    throw new Error(
      `${label} contains an unmapped repository-relative link: ${unresolved[0]}`,
    );
  }

  return rewritten;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function withArchitectureFlow(source: string, label: string): string {
  let imageCount = 0;
  const wrapped = source.replace(
    /!\[[^\]\n]+\]\(\/request-flow\.svg\)/g,
    () => {
      imageCount += 1;
      return "<ArchitectureFlow />";
    },
  );

  if (imageCount !== 1) {
    throw new Error(
      `${label} must contain exactly one generated request-flow image`,
    );
  }

  return wrapped;
}

function withOwnershipCardGrid(source: string, label: string): string {
  const heading = "## Who owns what\n\n";
  const headingCount = source.split(heading).length - 1;
  if (headingCount !== 1) {
    throw new Error(`${label} must contain exactly one Who owns what section`);
  }

  const sectionStart = source.indexOf(heading) + heading.length;
  const nextHeading = source.indexOf("\n## ", sectionStart);
  if (nextHeading < 0) {
    throw new Error(`${label} must place another section after Who owns what`);
  }

  const section = source.slice(sectionStart, nextHeading).trim();
  const cards = [
    ...section.matchAll(/### ([^\n]+)\n\n([\s\S]*?)(?=\n\n### |$)/g),
  ];
  const expectedTitles = ["MCP client", "trello-mcp", "Trello"];
  if (
    cards.length !== expectedTitles.length ||
    cards.some((match, index) => match[1] !== expectedTitles[index]) ||
    cards.map((match) => match[0]).join("\n\n") !== section
  ) {
    throw new Error(
      `${label} must define MCP client, trello-mcp, and Trello ownership cards`,
    );
  }

  const cardGrid = [
    "<CardGrid>",
    ...cards.flatMap((match) => [
      `  <Card title="${escapeHtmlAttribute(match[1] ?? "")}">`,
      indentTabContent((match[2] ?? "").trim()),
      "  </Card>",
    ]),
    "</CardGrid>",
  ].join("\n");

  return `${source.slice(0, sectionStart)}${cardGrid}\n${source.slice(nextHeading)}`;
}

function withMdxComponentImport(
  source: string,
  components: readonly string[],
): string {
  return [
    "import {",
    ...components.map((component) => `  ${component},`),
    '} from "@astrojs/starlight/components";',
    "",
    source,
  ].join("\n");
}

function blockquoteToAside(
  source: string,
  title: string,
  type: "caution" | "danger" | "note",
  label: string,
): string {
  const lines = source.split("\n");
  const firstLinePrefix = `> **${title}.** `;
  const startIndexes = lines.flatMap((line, index) =>
    line.startsWith(firstLinePrefix) ? [index] : [],
  );

  if (startIndexes.length !== 1) {
    throw new Error(
      `${label} must contain exactly one blockquote titled ${JSON.stringify(title)}`,
    );
  }

  const start = startIndexes[0];
  if (start === undefined) {
    throw new Error(`${label} could not locate ${JSON.stringify(title)}`);
  }

  let end = start;
  while (end < lines.length && lines[end]?.startsWith(">")) {
    end += 1;
  }

  const quoteLines = lines
    .slice(start, end)
    .map((line) => line.replace(/^> ?/, ""));
  const firstQuoteLine = quoteLines[0];
  if (!firstQuoteLine?.startsWith(`**${title}.** `)) {
    throw new Error(
      `${label} has an invalid ${JSON.stringify(title)} blockquote`,
    );
  }
  quoteLines[0] = firstQuoteLine.slice(`**${title}.** `.length);

  lines.splice(
    start,
    end - start,
    `:::${type}[${title}]`,
    ...quoteLines,
    ":::",
  );
  return lines.join("\n");
}

function withStepsAfterHeading(
  source: string,
  heading: string,
  expectedItems: number,
  label: string,
): string {
  const headingMarker = `## ${heading}\n`;
  const headingCount = source.split(headingMarker).length - 1;
  if (headingCount !== 1) {
    throw new Error(
      `${label} must contain exactly one ordered procedure under ${JSON.stringify(heading)}`,
    );
  }

  const headingStart = source.indexOf(headingMarker);
  const headingEnd = headingStart + headingMarker.length;
  const sectionEnd = source.indexOf("\n## ", headingEnd);
  const listMarker = "\n1. ";
  const listMarkerStart = source.indexOf(listMarker, headingEnd);
  if (
    listMarkerStart < 0 ||
    (sectionEnd >= 0 && listMarkerStart >= sectionEnd)
  ) {
    throw new Error(
      `${label} must contain an ordered procedure under ${JSON.stringify(heading)}`,
    );
  }

  const listStart = listMarkerStart + 1;
  const remainingLines = source.slice(listStart).split("\n");
  let lastContentLine = -1;
  let itemCount = 0;

  for (let index = 0; index < remainingLines.length; index += 1) {
    const line = remainingLines[index] ?? "";
    if (/^\d+\. /.test(line)) {
      itemCount += 1;
      lastContentLine = index;
      continue;
    }
    if (line === "" || /^ {2,}\S/.test(line)) {
      if (line !== "") {
        lastContentLine = index;
      }
      continue;
    }
    break;
  }

  if (itemCount !== expectedItems || lastContentLine < 0) {
    throw new Error(
      `${label} must contain ${expectedItems} ordered items under ${JSON.stringify(heading)}; found ${itemCount}`,
    );
  }

  const list = remainingLines.slice(0, lastContentLine + 1).join("\n");
  const listEnd = listStart + list.length;
  return [
    source.slice(0, listStart),
    "<Steps>\n\n",
    list,
    "\n\n</Steps>",
    source.slice(listEnd),
  ].join("");
}

type ClientTransportTabs = {
  endMarker: string;
  httpHeading: string;
  stdioHeading: string;
};

function indentTabContent(source: string): string {
  return source
    .split("\n")
    .map((line) => (line === "" ? "" : `    ${line}`))
    .join("\n");
}

function withClientTransportTabs(source: string, label: string): string {
  const tabGroups: readonly ClientTransportTabs[] = [
    {
      stdioHeading: "Claude Code over stdio",
      httpHeading: "Claude Code over Streamable HTTP",
      endMarker: "Run `claude mcp list`",
    },
    {
      stdioHeading: "Codex over stdio",
      httpHeading: "Codex over Streamable HTTP",
      endMarker: "Run `codex mcp list`",
    },
    {
      stdioHeading: "VS Code over stdio",
      httpHeading: "VS Code over Streamable HTTP",
      endMarker: "Run **MCP: List Servers**",
    },
    {
      stdioHeading: "OpenCode over stdio",
      httpHeading: "OpenCode over Streamable HTTP",
      endMarker: "OpenCode's documentation",
    },
    {
      stdioHeading: "Inspect stdio",
      httpHeading: "Inspect Streamable HTTP",
      endMarker: "Both commands print",
    },
  ];

  let transformed = source;
  for (const group of tabGroups) {
    const stdioMarker = `### ${group.stdioHeading}\n\n`;
    const httpMarker = `\n\n### ${group.httpHeading}\n\n`;
    const endMarker = `\n\n${group.endMarker}`;
    const stdioCount = transformed.split(stdioMarker).length - 1;
    const httpCount = transformed.split(httpMarker).length - 1;
    if (stdioCount !== 1 || httpCount !== 1) {
      throw new Error(
        `${label} must contain one ${JSON.stringify(group.stdioHeading)} and one ${JSON.stringify(group.httpHeading)} section`,
      );
    }

    const groupStart = transformed.indexOf(stdioMarker);
    const stdioStart = groupStart + stdioMarker.length;
    const httpHeadingStart = transformed.indexOf(httpMarker, stdioStart);
    const httpStart = httpHeadingStart + httpMarker.length;
    const groupEnd = transformed.indexOf(endMarker, httpStart);
    if (httpHeadingStart < 0 || groupEnd < 0) {
      throw new Error(
        `${label} could not determine the boundaries for ${JSON.stringify(group.stdioHeading)}`,
      );
    }

    const stdioContent = transformed.slice(stdioStart, httpHeadingStart).trim();
    const httpContent = transformed.slice(httpStart, groupEnd).trim();
    const tabs = [
      '<Tabs syncKey="client-transport">',
      '  <TabItem label="Local stdio">',
      indentTabContent(stdioContent),
      "  </TabItem>",
      "",
      '  <TabItem label="Streamable HTTP">',
      indentTabContent(httpContent),
      "  </TabItem>",
      "</Tabs>",
    ].join("\n");

    transformed = `${transformed.slice(0, groupStart)}${tabs}${transformed.slice(groupEnd)}`;
  }

  return transformed;
}

function fencedRecipe(language: string, code: string): string {
  return [`\`\`\`${language}`, code, "```"].join("\n");
}

function clientDocumentationSection(client: ClientSetup): string {
  const { documentation } = client;
  const sections = [
    `## ${documentation.heading}`,
    "",
    documentation.introduction,
    "",
  ];

  if (documentation.stdioHeading) {
    sections.push(`### ${documentation.stdioHeading}`, "");
  }
  sections.push(fencedRecipe(client.language, client.code));
  if (documentation.afterStdio) {
    sections.push("", documentation.afterStdio);
  }

  if (client.http) {
    if (!documentation.httpHeading || documentation.afterHttp === undefined) {
      throw new Error(
        `${client.key} must document its Streamable HTTP configuration`,
      );
    }
    sections.push(
      "",
      `### ${documentation.httpHeading}`,
      "",
      fencedRecipe(client.http.language, client.http.code),
    );
    if (documentation.afterHttp) {
      sections.push("", documentation.afterHttp);
    }
  } else if (
    documentation.httpHeading !== undefined ||
    documentation.afterHttp !== undefined
  ) {
    throw new Error(
      `${client.key} documents Streamable HTTP without an HTTP recipe`,
    );
  }

  return sections.join("\n").trimEnd();
}

function generatedClientRecipeBlock(): string {
  const sections = CLIENT_DOCUMENTATION_ORDER.map((key) =>
    clientDocumentationSection(getClientSetup(key)),
  );
  return [
    clientRecipesStartMarker,
    "<!-- Generated from docs/setup-recipes.ts by scripts/generate-tool-docs.ts. -->",
    "",
    sections.join("\n\n"),
    "",
    clientRecipesEndMarker,
  ].join("\n");
}

function replaceClientRecipeBlock(source: string): string {
  const normalized = normalizeMarkdown(source);
  const startCount = normalized.split(clientRecipesStartMarker).length - 1;
  const endCount = normalized.split(clientRecipesEndMarker).length - 1;
  if (startCount !== 1 || endCount !== 1) {
    throw new Error(
      `docs/client-setup.md must contain exactly one ${clientRecipesStartMarker} and one ${clientRecipesEndMarker}`,
    );
  }

  const start = normalized.indexOf(clientRecipesStartMarker);
  const end = normalized.indexOf(clientRecipesEndMarker, start);
  if (start > end) {
    throw new Error(
      `docs/client-setup.md must place ${clientRecipesStartMarker} before ${clientRecipesEndMarker}`,
    );
  }

  return `${normalized.slice(0, start)}${generatedClientRecipeBlock()}${normalized.slice(end + clientRecipesEndMarker.length)}`;
}

function credentialSiteBody(source: string): string {
  const label = "docs/trello-api-key.md";
  let body = blockquoteToAside(
    source,
    "This guide sends you to Trello",
    "note",
    label,
  );
  body = blockquoteToAside(
    body,
    "The token is broad account access",
    "caution",
    label,
  );
  body = withStepsAfterHeading(body, "Create the credentials", 7, label);
  body = withStepsAfterHeading(body, "Revoke or replace a token", 4, label);

  const createHeading = "## Create the credentials\n\n";
  const createHeadingCount = body.split(createHeading).length - 1;
  if (createHeadingCount !== 1) {
    throw new Error(`${label} must contain one Create the credentials heading`);
  }
  body = body.replace(
    createHeading,
    [
      createHeading.trimEnd(),
      "",
      '<LinkButton href="https://trello.com/apps/admin" variant="primary" icon="external">',
      "  Open Trello App Admin Portal",
      "</LinkButton>",
      "",
      "",
    ].join("\n"),
  );

  return withMdxComponentImport(body, ["LinkButton", "Steps"]);
}

function clientsSiteBody(source: string): string {
  const label = "docs/client-setup.md";
  const markerCount = [clientRecipesStartMarker, clientRecipesEndMarker].filter(
    (marker) => source.includes(marker),
  ).length;
  if (markerCount !== 2) {
    throw new Error(
      `${label} must contain its generated client recipe marker block`,
    );
  }
  let body = source
    .replace(
      `${clientRecipesStartMarker}\n<!-- Generated from docs/setup-recipes.ts by scripts/generate-tool-docs.ts. -->\n\n`,
      "",
    )
    .replace(`\n${clientRecipesEndMarker}`, "");
  body = withClientTransportTabs(body, label);
  body = withStepsAfterHeading(body, "Verify the connection safely", 4, label);
  return withMdxComponentImport(body, ["Steps", "TabItem", "Tabs"]);
}

function configurationSiteBody(source: string): string {
  return blockquoteToAside(
    source,
    "Keep configuration private",
    "caution",
    "docs/configuration.md",
  );
}

function howItWorksSiteBody(source: string): string {
  const label = "docs/how-it-works.md";
  let body = withArchitectureFlow(source, label);
  body = blockquoteToAside(
    body,
    "The MCP client is part of the trust boundary",
    "caution",
    label,
  );
  body = withStepsAfterHeading(body, "Request lifecycle", 8, label);
  body = withOwnershipCardGrid(body, label);
  body = withStepsAfterHeading(body, "HTTP sessions", 5, label);
  return [
    'import ArchitectureFlow from "../../../components/ArchitectureFlow.astro";',
    "",
    withMdxComponentImport(body, ["Card", "CardGrid", "Steps"]),
  ].join("\n");
}

function troubleshootingSiteBody(source: string): string {
  const label = "docs/troubleshooting.md";
  let body = blockquoteToAside(
    source,
    "Sanitize before sharing",
    "danger",
    label,
  );
  body = withStepsAfterHeading(body, "First checks", 5, label);
  return withMdxComponentImport(body, ["Steps"]);
}

function workflowsSiteBody(source: string): string {
  const label = "docs/workflows.md";
  let body = blockquoteToAside(
    source,
    "Client approval is not a server guarantee",
    "caution",
    label,
  );
  body = blockquoteToAside(
    body,
    "Keep the safety boundary visible",
    "caution",
    label,
  );
  for (const heading of [
    "The five-stage pattern",
    "Summarize a board without changing it",
    "Create and organize a card",
    "Move or archive completed work",
    "Review activity before adding a comment",
    "Set or clear a custom field",
    "Attach a URL or a server-local file",
  ]) {
    body = withStepsAfterHeading(body, heading, 5, label);
  }
  return withMdxComponentImport(body, ["Steps"]);
}

function supportSiteBody(source: string): string {
  const stepsHeading = "## Prepare a useful report\n\n";
  const nextHeading = "\n\n## Security reports";
  if (!source.includes(stepsHeading) || !source.includes(nextHeading)) {
    throw new Error(
      "SUPPORT.md must preserve the Prepare a useful report and Security reports sections",
    );
  }

  const withSteps = source
    .replace(stepsHeading, `${stepsHeading}<Steps>\n\n`)
    .replace(nextHeading, `\n\n</Steps>${nextHeading}`);

  return [
    'import { Aside, Steps } from "@astrojs/starlight/components";',
    "",
    '<Aside type="caution" title="Sanitize every report">',
    "  Never include Trello API keys, Trello tokens, MCP bearer tokens, authorization headers, credential-bearing URLs, private Trello data, raw environment output, or unredacted logs in a public issue, discussion, screenshot, or reproduction.",
    "</Aside>",
    "",
    withSteps,
  ].join("\n");
}

async function readOptional(path: URL): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function expectedFiles(): Promise<GeneratedFile[]> {
  const [
    contributing,
    readme,
    apiCoverage,
    clientCompatibility,
    clientSetup,
    configuration,
    howItWorks,
    howItWorksRequestFlow,
    operations,
    securityPolicy,
    siteHome,
    support,
    troubleshooting,
    trelloApiKey,
    workflows,
  ] = await Promise.all([
    readFile(paths.contributing, "utf8"),
    readFile(paths.readme, "utf8"),
    readFile(paths.apiCoverage, "utf8"),
    readFile(paths.clientCompatibility, "utf8"),
    readFile(paths.clientSetup, "utf8"),
    readFile(paths.configuration, "utf8"),
    readFile(paths.howItWorks, "utf8"),
    readFile(paths.howItWorksRequestFlow, "utf8"),
    readFile(paths.operations, "utf8"),
    readFile(paths.securityPolicy, "utf8"),
    readFile(paths.siteHome, "utf8"),
    readFile(paths.support, "utf8"),
    readFile(paths.troubleshooting, "utf8"),
    readFile(paths.trelloApiKey, "utf8"),
    readFile(paths.workflows, "utf8"),
  ]);

  if (!howItWorks.includes("](assets/how-it-works/request-flow.svg)")) {
    throw new Error(
      "docs/how-it-works.md must reference assets/how-it-works/request-flow.svg",
    );
  }

  const generatedClientSetup = replaceClientRecipeBlock(clientSetup);
  const table = toolTable();
  const clients = starlightPage(
    "Set up your MCP client",
    "Configure trello-mcp over local stdio or Streamable HTTP in supported MCP clients.",
    clientsSiteBody(
      rewriteSiteLinks(
        withoutDocumentTitle(generatedClientSetup, "docs/client-setup.md"),
        "docs/client-setup.md",
      ),
    ),
  );

  const files: GeneratedFile[] = [
    {
      path: paths.readme,
      label: "README.md",
      contents: replaceReadmeCatalog(readme, table),
    },
    {
      path: paths.clientSetup,
      label: "docs/client-setup.md",
      contents: generatedClientSetup,
    },
    {
      path: paths.siteHome,
      label: "website/src/content/docs/index.mdx",
      contents: validateHomepageToolCount(siteHome),
    },
    {
      path: paths.siteTrelloApiKey,
      label: "website/src/content/docs/getting-started/trello-api-key.mdx",
      contents: starlightPage(
        "Trello API key",
        "Create a Trello app, generate an API key, authorize a token, store both credentials safely, and verify them with trello-mcp.",
        credentialSiteBody(
          rewriteSiteLinks(
            withoutDocumentTitle(trelloApiKey, "docs/trello-api-key.md"),
            "docs/trello-api-key.md",
          ),
        ),
      ),
    },
    {
      path: paths.siteClients,
      label: "website/src/content/docs/getting-started/clients.mdx",
      contents: clients,
    },
    {
      path: paths.siteCompatibility,
      label: "website/src/content/docs/getting-started/compatibility.mdx",
      contents: starlightPage(
        "Compatibility evidence",
        "Dated evidence for MCP client setup, transport connection, tool discovery, and live Trello validation.",
        rewriteSiteLinks(
          withoutDocumentTitle(
            clientCompatibility,
            "docs/mcp-client-compatibility.md",
          ),
          "docs/mcp-client-compatibility.md",
        ),
      ),
    },
    {
      path: paths.siteHowItWorks,
      label: "website/src/content/docs/guides/how-it-works.mdx",
      contents: starlightPage(
        "How it works",
        "Follow a tool call across the MCP client, trello-mcp, and the Trello REST API.",
        howItWorksSiteBody(
          rewriteSiteLinks(
            withoutDocumentTitle(howItWorks, "docs/how-it-works.md"),
            "docs/how-it-works.md",
          ),
        ),
      ),
    },
    {
      path: paths.siteWorkflows,
      label: "website/src/content/docs/guides/workflows.mdx",
      contents: starlightPage(
        "Workflows",
        "Practical Trello workflows expressed through the MCP tool catalog.",
        workflowsSiteBody(
          rewriteSiteLinks(
            withoutDocumentTitle(workflows, "docs/workflows.md"),
            "docs/workflows.md",
          ),
        ),
      ),
    },
    {
      path: paths.siteOperations,
      label: "website/src/content/docs/guides/operations.md",
      contents: starlightPage(
        "Operate trello-mcp",
        "Upgrade, roll back, inspect, stop, and rotate credentials for a running trello-mcp deployment.",
        rewriteSiteLinks(
          withoutDocumentTitle(operations, "docs/operations.md"),
          "docs/operations.md",
        ),
      ),
    },
    {
      path: paths.siteTroubleshooting,
      label: "website/src/content/docs/guides/troubleshooting.mdx",
      contents: starlightPage(
        "Troubleshooting",
        "Diagnose startup, transport, authentication, Docker, Trello API, rate-limit, and attachment failures safely.",
        troubleshootingSiteBody(
          rewriteSiteLinks(
            withoutDocumentTitle(troubleshooting, "docs/troubleshooting.md"),
            "docs/troubleshooting.md",
          ),
        ),
      ),
    },
    {
      path: paths.siteConfiguration,
      label: "website/src/content/docs/reference/configuration.mdx",
      contents: starlightPage(
        "Configuration reference",
        "Every trello-mcp runtime and Compose setting, its default, and the boundary it controls.",
        configurationSiteBody(
          rewriteSiteLinks(
            withoutDocumentTitle(configuration, "docs/configuration.md"),
            "docs/configuration.md",
          ),
        ),
      ),
    },
    {
      path: paths.siteContributing,
      label: "website/src/content/docs/reference/contributing.md",
      contents: starlightPage(
        "Contributing",
        "Run the project checks, update canonical documentation, follow the Trello tool pattern, and prepare focused contributions safely.",
        rewriteSiteLinks(
          withoutDocumentTitle(contributing, "CONTRIBUTING.md"),
          "CONTRIBUTING.md",
        ),
      ),
    },
    {
      path: paths.siteSupport,
      label: "website/src/content/docs/reference/reporting-issues.mdx",
      contents: starlightPage(
        "Reporting issues and support",
        "Choose the right support channel and prepare a useful, sanitized trello-mcp bug report.",
        supportSiteBody(
          rewriteSiteLinks(
            withoutDocumentTitle(support, "SUPPORT.md"),
            "SUPPORT.md",
          ),
        ),
      ),
    },
    {
      path: paths.siteSecurityPolicy,
      label: "website/src/content/docs/reference/security-policy.md",
      contents: starlightPage(
        "Security policy",
        "Supported versions, private vulnerability reporting, sensitive data handling, and threat-model boundaries for trello-mcp.",
        rewriteSiteLinks(
          withoutDocumentTitle(securityPolicy, "SECURITY.md"),
          "SECURITY.md",
        ),
      ),
    },
    {
      path: paths.siteTools,
      label: "website/src/content/docs/reference/tools.mdx",
      contents: starlightPage(
        "Tool catalog",
        `Search ${allTools.length} Trello MCP tools by category, behavior, name, purpose, and input.`,
        [
          'import ToolCatalog from "../../../components/ToolCatalog.astro";',
          'import { CATEGORY_COUNT, TOOL_COUNT } from "../../../data/tool-catalog.js";',
          "",
          "The server exposes **{TOOL_COUNT} tools across {CATEGORY_COUNT} focused areas**. Names, descriptions, and input definitions come directly from the same `allTools` entries and Zod schemas used by the server. Category, behavior, scope, and result labels are curated for this reference and checked to cover every registered tool exactly once.",
          "",
          "“Read only” means the tool does not intentionally change Trello. “Writes data” covers creates, updates, assignments, moves, and reversible state changes. “Permanent delete” identifies calls that remove a Trello resource rather than archive or detach it. Tool handlers return JSON-serializable data to the MCP client.",
          "",
          "Search by tool name, purpose, result, or input, or narrow the catalog by category and behavior. Every tool has a direct link. Example prompts use placeholder names and contain no credentials or account data.",
          "",
          "<ToolCatalog />",
          "",
          "For supported and deferred Trello REST endpoint families, see [API coverage](/reference/api-coverage/).",
        ].join("\n"),
      ),
    },
    {
      path: paths.siteApiCoverage,
      label: "website/src/content/docs/reference/api-coverage.mdx",
      contents: starlightPage(
        "API coverage",
        "Supported, partially supported, deferred, and out-of-scope Trello REST API groups.",
        rewriteSiteLinks(
          withoutDocumentTitle(apiCoverage, "docs/api-coverage.md"),
          "docs/api-coverage.md",
        ),
      ),
    },
  ];

  files.push({
    path: paths.siteRequestFlow,
    label: "website/public/request-flow.svg",
    contents: howItWorksRequestFlow,
  });

  return files;
}

async function checkFiles(files: GeneratedFile[]): Promise<void> {
  const problems: string[] = [];

  for (const file of files) {
    const current = await readOptional(file.path);
    if (current === undefined) {
      problems.push(`missing: ${file.label}`);
    } else if (current !== file.contents) {
      problems.push(`stale: ${file.label}`);
    }
  }

  for (const file of obsoleteGeneratedFiles) {
    if ((await readOptional(file.path)) !== undefined) {
      problems.push(`obsolete: ${file.label}`);
    }
  }

  if (problems.length === 0) {
    console.log("Generated documentation is current.");
    return;
  }

  for (const problem of problems) {
    console.error(problem);
  }
  console.error("Run `corepack pnpm docs:tools` to regenerate documentation.");
  process.exitCode = 1;
}

async function writeFiles(files: GeneratedFile[]): Promise<void> {
  for (const file of files) {
    const current = await readOptional(file.path);
    if (current === file.contents) {
      continue;
    }

    await mkdir(new URL(".", file.path), { recursive: true });
    await writeFile(file.path, file.contents);
    console.log(`updated: ${file.label}`);
  }

  for (const file of obsoleteGeneratedFiles) {
    try {
      await unlink(file.path);
      console.log(`removed: ${file.label}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

const files = await expectedFiles();
if (checkMode) {
  await checkFiles(files);
} else {
  await writeFiles(files);
}
