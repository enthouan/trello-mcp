import { mkdir, readFile, writeFile } from "node:fs/promises";
import { allTools } from "../src/trello/tools.js";

const toolsStartMarker = "<!-- tools:start -->";
const toolsEndMarker = "<!-- tools:end -->";

const paths = {
  readme: new URL("../README.md", import.meta.url),
  apiCoverage: new URL("../docs/api-coverage.md", import.meta.url),
  clientCompatibility: new URL(
    "../docs/mcp-client-compatibility.md",
    import.meta.url,
  ),
  clientSetup: new URL("../docs/client-setup.md", import.meta.url),
  configuration: new URL("../docs/configuration.md", import.meta.url),
  howItWorks: new URL("../docs/how-it-works.md", import.meta.url),
  troubleshooting: new URL("../docs/troubleshooting.md", import.meta.url),
  trelloApiKey: new URL("../docs/trello-api-key.md", import.meta.url),
  workflows: new URL("../docs/workflows.md", import.meta.url),
  clientSetupTransportChooser: new URL(
    "../docs/assets/client-setup/transport-chooser.svg",
    import.meta.url,
  ),
  siteClients: new URL(
    "../website/src/content/docs/clients/index.mdx",
    import.meta.url,
  ),
  siteHome: new URL("../website/src/content/docs/index.mdx", import.meta.url),
  siteTrelloApiKey: new URL(
    "../website/src/content/docs/trello-api-key.mdx",
    import.meta.url,
  ),
  siteCompatibility: new URL(
    "../website/src/content/docs/clients/compatibility.md",
    import.meta.url,
  ),
  siteConfiguration: new URL(
    "../website/src/content/docs/reference/configuration.mdx",
    import.meta.url,
  ),
  siteHowItWorks: new URL(
    "../website/src/content/docs/concepts/how-it-works.mdx",
    import.meta.url,
  ),
  siteTroubleshooting: new URL(
    "../website/src/content/docs/guides/troubleshooting.mdx",
    import.meta.url,
  ),
  siteTools: new URL(
    "../website/src/content/docs/tools/index.mdx",
    import.meta.url,
  ),
  siteWorkflows: new URL(
    "../website/src/content/docs/guides/workflows.mdx",
    import.meta.url,
  ),
  siteApiCoverage: new URL(
    "../website/src/content/docs/tools/api-coverage.md",
    import.meta.url,
  ),
  siteTransportChooser: new URL(
    "../website/public/transport-chooser.svg",
    import.meta.url,
  ),
};

type GeneratedFile = {
  contents: string;
  label: string;
  path: URL;
};

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
  editUrl?: string | false,
  extraFrontmatter: readonly string[] = [],
): string {
  return [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    ...(editUrl === undefined
      ? []
      : [`editUrl: ${editUrl === false ? "false" : JSON.stringify(editUrl)}`]),
    ...extraFrontmatter,
    "---",
    "",
    body.trimEnd(),
    "",
  ].join("\n");
}

const siteLinkRewrites = new Map([
  ["api-coverage.md", "/tools/api-coverage/"],
  ["configuration.md", "/reference/configuration/"],
  ["how-it-works.md", "/concepts/how-it-works/"],
  ["troubleshooting.md", "/guides/troubleshooting/"],
  ["workflows.md", "/guides/workflows/"],
  ["mcp-client-compatibility.md", "/clients/compatibility/"],
  ["client-setup.md", "/clients/"],
  [
    "client-setup.md#mcp-inspector-and-manual-clients",
    "/clients/#mcp-inspector-and-manual-clients",
  ],
  ["trello-api-key.md", "/trello-api-key/"],
  [
    "../README.md#attachment-uploads",
    "/reference/configuration/#local-attachment-uploads",
  ],
  ["../README.md#environment", "/reference/configuration/"],
  ["../README.md#quick-start", "/get-started/"],
  ["../README.md#security-notes", "/security/"],
  ["../SECURITY.md", "/security/"],
  [
    "../CONTRIBUTING.md",
    "https://github.com/enthouan/trello-mcp/blob/main/CONTRIBUTING.md",
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
    "/get-started/docker/",
  ],
  [
    "../README.md#option-b-build-locally-from-source",
    "/get-started/docker/#local-docker-build",
  ],
  ["../README.md#live-trello-smoke-tests", "/project/#live-validation"],
  ["assets/client-setup/transport-chooser.svg", "/transport-chooser.svg"],
]);

const readmeUrl = "https://github.com/enthouan/trello-mcp/blob/main/README.md";
const githubEditBaseUrl = "https://github.com/enthouan/trello-mcp/edit/main";

function rewriteSiteLinks(
  source: string,
  label: string,
  hasClientSetup: boolean,
): string {
  const rewrites = new Map(siteLinkRewrites);
  rewrites.set(
    "../README.md#3-connect-your-mcp-client",
    hasClientSetup ? "/clients/" : `${readmeUrl}#3-connect-your-mcp-client`,
  );
  rewrites.set(
    "../README.md#mcp-client-setup",
    hasClientSetup ? "/clients/" : `${readmeUrl}#mcp-client-setup`,
  );

  let rewritten = source;
  for (const [from, to] of rewrites) {
    rewritten = rewritten.replaceAll(`](${from})`, `](${to})`);
  }

  const unresolved = rewritten.match(
    /\]\((?:\.\.\/(?:README|SECURITY|CONTRIBUTING)\.md|\.\.\/docker-compose(?:\.local)?\.yml|(?:\.\/)?(?:api-coverage|client-setup|configuration|how-it-works|mcp-client-compatibility|trello-api-key|troubleshooting|workflows)\.md|assets\/client-setup\/)[^)]*\)/,
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

function withTransportChooserFigure(source: string, label: string): string {
  let imageCount = 0;
  const wrapped = source.replace(
    /!\[([^\]\n]+)\]\(\/transport-chooser\.svg\)/g,
    (_match, altText: string) => {
      imageCount += 1;
      return [
        '<figure class="transport-chooser" data-transport-chooser>',
        '  <div class="transport-chooser__viewport" data-transport-chooser-scroll role="region" aria-label="Transport chooser diagram" tabindex="0">',
        `    <img src="/transport-chooser.svg" alt="${escapeHtmlAttribute(altText)}" width="1200" height="600" />`,
        "  </div>",
        "  <figcaption>",
        '    Scroll horizontally when needed to compare both paths. <a href="/transport-chooser.svg">Open the full-size diagram</a>.',
        "  </figcaption>",
        "</figure>",
      ].join("\n");
    },
  );

  if (imageCount !== 1) {
    throw new Error(
      `${label} must contain exactly one generated transport chooser image`,
    );
  }

  return wrapped;
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
      stdioHeading: "OpenCode V2 over stdio",
      httpHeading: "OpenCode V2 over Streamable HTTP",
      endMarker: "OpenCode's V2 documentation",
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
  let body = withTransportChooserFigure(source, label);
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
  let body = blockquoteToAside(
    source,
    "The MCP client is part of the trust boundary",
    "caution",
    label,
  );
  body = withStepsAfterHeading(body, "Request lifecycle", 8, label);
  body = withStepsAfterHeading(body, "HTTP sessions", 5, label);
  return withMdxComponentImport(body, ["Steps"]);
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

function compatibilityIntroduction(source: string): string {
  const body = withoutDocumentTitle(source, "docs/mcp-client-compatibility.md");
  const firstParagraph = body.split(/\n\n+/)[0];
  if (!firstParagraph || firstParagraph.startsWith("#")) {
    throw new Error(
      "docs/mcp-client-compatibility.md must start with an introductory paragraph",
    );
  }

  return firstParagraph.replaceAll("\n", " ");
}

function fallbackClientsPage(compatibilitySource: string): string {
  const evidenceSummary = compatibilityIntroduction(compatibilitySource)
    .replace(/^This page records /, "The compatibility record documents ")
    .replace(/^This record /, "The compatibility record ");

  const body = [
    "Choose a server connection path in [Get started](/get-started/), then use the dated evidence below to understand what has and has not been exercised in named MCP clients.",
    "",
    evidenceSummary,
    "",
    "[Read the compatibility evidence →](/clients/compatibility/)",
  ].join("\n");

  return starlightPage(
    "Set up your MCP client",
    "Start with a transport path and review dated MCP client compatibility evidence.",
    body,
    `${githubEditBaseUrl}/docs/mcp-client-compatibility.md`,
  );
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
    readme,
    apiCoverage,
    clientCompatibility,
    clientSetup,
    clientSetupTransportChooser,
    configuration,
    howItWorks,
    siteHome,
    troubleshooting,
    trelloApiKey,
    workflows,
  ] = await Promise.all([
    readFile(paths.readme, "utf8"),
    readFile(paths.apiCoverage, "utf8"),
    readFile(paths.clientCompatibility, "utf8"),
    readOptional(paths.clientSetup),
    readOptional(paths.clientSetupTransportChooser),
    readFile(paths.configuration, "utf8"),
    readFile(paths.howItWorks, "utf8"),
    readFile(paths.siteHome, "utf8"),
    readFile(paths.troubleshooting, "utf8"),
    readFile(paths.trelloApiKey, "utf8"),
    readFile(paths.workflows, "utf8"),
  ]);

  const hasClientSetup = clientSetup !== undefined;
  const hasTransportChooser = clientSetupTransportChooser !== undefined;
  if (hasClientSetup !== hasTransportChooser) {
    throw new Error(
      "docs/client-setup.md and docs/assets/client-setup/transport-chooser.svg must either both exist or both be absent",
    );
  }
  if (
    clientSetup &&
    !clientSetup.includes("](assets/client-setup/transport-chooser.svg)")
  ) {
    throw new Error(
      "docs/client-setup.md must reference assets/client-setup/transport-chooser.svg",
    );
  }

  const table = toolTable();
  const clients = clientSetup
    ? starlightPage(
        "Set up your MCP client",
        "Configure trello-mcp over local stdio or Streamable HTTP in supported MCP clients.",
        clientsSiteBody(
          rewriteSiteLinks(
            withoutDocumentTitle(clientSetup, "docs/client-setup.md"),
            "docs/client-setup.md",
            true,
          ),
        ),
        `${githubEditBaseUrl}/docs/client-setup.md`,
      )
    : fallbackClientsPage(clientCompatibility);

  const files: GeneratedFile[] = [
    {
      path: paths.readme,
      label: "README.md",
      contents: replaceReadmeCatalog(readme, table),
    },
    {
      path: paths.siteHome,
      label: "website/src/content/docs/index.mdx",
      contents: validateHomepageToolCount(siteHome),
    },
    {
      path: paths.siteTrelloApiKey,
      label: "website/src/content/docs/trello-api-key.mdx",
      contents: starlightPage(
        "Trello API Key",
        "Create a Trello app, generate an API key, authorize a token, store both credentials safely, and verify them with trello-mcp.",
        credentialSiteBody(
          rewriteSiteLinks(
            withoutDocumentTitle(trelloApiKey, "docs/trello-api-key.md"),
            "docs/trello-api-key.md",
            hasClientSetup,
          ),
        ),
        `${githubEditBaseUrl}/docs/trello-api-key.md`,
      ),
    },
    {
      path: paths.siteClients,
      label: "website/src/content/docs/clients/index.mdx",
      contents: clients,
    },
    {
      path: paths.siteCompatibility,
      label: "website/src/content/docs/clients/compatibility.md",
      contents: starlightPage(
        "Compatibility evidence",
        "Dated evidence for MCP client setup, transport connection, tool discovery, and live Trello validation.",
        rewriteSiteLinks(
          withoutDocumentTitle(
            clientCompatibility,
            "docs/mcp-client-compatibility.md",
          ),
          "docs/mcp-client-compatibility.md",
          hasClientSetup,
        ),
        `${githubEditBaseUrl}/docs/mcp-client-compatibility.md`,
      ),
    },
    {
      path: paths.siteHowItWorks,
      label: "website/src/content/docs/concepts/how-it-works.mdx",
      contents: starlightPage(
        "How it works",
        "Follow a tool call across the MCP client, trello-mcp, and the Trello REST API.",
        howItWorksSiteBody(
          rewriteSiteLinks(
            withoutDocumentTitle(howItWorks, "docs/how-it-works.md"),
            "docs/how-it-works.md",
            hasClientSetup,
          ),
        ),
        `${githubEditBaseUrl}/docs/how-it-works.md`,
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
            hasClientSetup,
          ),
        ),
        `${githubEditBaseUrl}/docs/workflows.md`,
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
            hasClientSetup,
          ),
        ),
        `${githubEditBaseUrl}/docs/troubleshooting.md`,
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
            hasClientSetup,
          ),
        ),
        `${githubEditBaseUrl}/docs/configuration.md`,
      ),
    },
    {
      path: paths.siteTools,
      label: "website/src/content/docs/tools/index.mdx",
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
          "Search by tool name, purpose, result, or input, or narrow the catalog by category and behavior. Every tool name is a permanent link. Example prompts use placeholder names and contain no credentials or account data.",
          "",
          "<ToolCatalog />",
          "",
          "For supported and deferred Trello REST endpoint families, see [API coverage](/tools/api-coverage/).",
        ].join("\n"),
        false,
        ["tableOfContents: false"],
      ),
    },
    {
      path: paths.siteApiCoverage,
      label: "website/src/content/docs/tools/api-coverage.md",
      contents: starlightPage(
        "API coverage",
        "Supported, partially supported, deferred, and out-of-scope Trello REST API groups.",
        rewriteSiteLinks(
          withoutDocumentTitle(apiCoverage, "docs/api-coverage.md"),
          "docs/api-coverage.md",
          hasClientSetup,
        ),
        `${githubEditBaseUrl}/docs/api-coverage.md`,
      ),
    },
  ];

  if (clientSetupTransportChooser !== undefined) {
    files.push({
      path: paths.siteTransportChooser,
      label: "website/public/transport-chooser.svg",
      contents: clientSetupTransportChooser,
    });
  }

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
}

const files = await expectedFiles();
if (checkMode) {
  await checkFiles(files);
} else {
  await writeFiles(files);
}
