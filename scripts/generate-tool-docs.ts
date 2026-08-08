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
  clientSetupTransportChooser: new URL(
    "../docs/assets/client-setup/transport-chooser.svg",
    import.meta.url,
  ),
  siteClients: new URL(
    "../website/src/content/docs/clients/index.md",
    import.meta.url,
  ),
  siteCompatibility: new URL(
    "../website/src/content/docs/clients/compatibility.md",
    import.meta.url,
  ),
  siteTools: new URL(
    "../website/src/content/docs/tools/index.md",
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
): string {
  return [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    "---",
    "",
    body.trimEnd(),
    "",
  ].join("\n");
}

const siteLinkRewrites = new Map([
  ["mcp-client-compatibility.md", "/clients/compatibility/"],
  ["client-setup.md", "/clients/"],
  [
    "../README.md#option-a-run-the-published-docker-image",
    "/get-started/#docker-streamable-http",
  ],
  [
    "../README.md#option-b-build-locally-from-source",
    "/get-started/#local-stdio",
  ],
  ["../README.md#live-trello-smoke-tests", "/project/#live-validation"],
  ["assets/client-setup/transport-chooser.svg", "/transport-chooser.svg"],
]);

const readmeUrl = "https://github.com/enthouan/trello-mcp/blob/main/README.md";

const independentProjectNotice = [
  ":::caution[Independent project]",
  "trello-mcp is an independent, community-maintained project. It is not an official Trello or Atlassian product, service, or MCP implementation, and it is not affiliated with, endorsed by, or sponsored by Trello or Atlassian.",
  "",
  "Trello's [official MCP server](https://trello.com/mcp) is available at `https://mcp.trello.com/v1`.",
  ":::",
].join("\n");

function withIndependentProjectNotice(body: string): string {
  return `${independentProjectNotice}\n\n${body}`;
}

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
    /\]\((?:\.\.\/README\.md|(?:\.\/)?(?:client-setup|mcp-client-compatibility)\.md|assets\/client-setup\/)[^)]*\)/,
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
        `    <img src="/transport-chooser.svg" alt="${escapeHtmlAttribute(altText)}" width="1200" height="600">`,
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
    "Clients",
    "Start with a transport path and review dated MCP client compatibility evidence.",
    withIndependentProjectNotice(body),
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
  ] = await Promise.all([
    readFile(paths.readme, "utf8"),
    readFile(paths.apiCoverage, "utf8"),
    readFile(paths.clientCompatibility, "utf8"),
    readOptional(paths.clientSetup),
    readOptional(paths.clientSetupTransportChooser),
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
        "Clients",
        "Configure trello-mcp over local stdio or Streamable HTTP in supported MCP clients.",
        withIndependentProjectNotice(
          withTransportChooserFigure(
            rewriteSiteLinks(
              withoutDocumentTitle(clientSetup, "docs/client-setup.md"),
              "docs/client-setup.md",
              true,
            ),
            "docs/client-setup.md",
          ),
        ),
      )
    : fallbackClientsPage(clientCompatibility);

  const files: GeneratedFile[] = [
    {
      path: paths.readme,
      label: "README.md",
      contents: replaceReadmeCatalog(readme, table),
    },
    {
      path: paths.siteClients,
      label: "website/src/content/docs/clients/index.md",
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
      ),
    },
    {
      path: paths.siteTools,
      label: "website/src/content/docs/tools/index.md",
      contents: starlightPage(
        "Tools",
        `Search the ${allTools.length} MCP tools generated from the registered trello-mcp tool surface.`,
        [
          `The server exposes **${allTools.length} MCP tools**. This catalog shares its names, descriptions, and key inputs with the README and is generated directly from \`allTools\`.`,
          "",
          "## Tool catalog",
          "",
          table,
          "",
          "For supported and deferred Trello REST endpoint families, see [API coverage](/tools/api-coverage/).",
        ].join("\n"),
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
