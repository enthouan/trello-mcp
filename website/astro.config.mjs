import { unified } from "@astrojs/markdown-remark";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

const repositoryUrl = "https://github.com/enthouan/trello-mcp";
const siteUrl = normalizeSiteUrl(process.env.SITE_URL);
const socialImageUrl = new URL("social-card.png", siteUrl).href;

function normalizeSiteUrl(value) {
  const configuredUrl = value?.trim();
  if (!configuredUrl && process.env.CI) {
    throw new Error(
      "SITE_URL must be configured for CI and deployment builds.",
    );
  }

  const siteUrl = new URL(configuredUrl || "http://localhost:4321");

  if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") {
    throw new Error("SITE_URL must use http or https.");
  }

  return siteUrl.href;
}

function makeScrollableTablesKeyboardAccessible() {
  return (tree) => {
    const visit = (node) => {
      if (!node || typeof node !== "object") return;

      if (node.type === "element" && node.tagName === "table") {
        node.properties ??= {};
        node.properties.tabIndex = 0;
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) visit(child);
      }
    };

    visit(tree);
  };
}

export default defineConfig({
  site: siteUrl,
  trailingSlash: "always",
  redirects: {
    "/concepts/how-it-works": "/guides/how-it-works/",
    "/project": "/reference/",
  },
  markdown: {
    processor: unified({
      rehypePlugins: [makeScrollableTablesKeyboardAccessible],
    }),
  },
  integrations: [
    starlight({
      title: "trello-mcp",
      description:
        "Documentation for trello-mcp, a self-hosted and auditable Model Context Protocol server for broad Trello automation.",
      favicon: "/favicon.svg?v=full-bleed-split-card",
      logo: {
        src: "./public/favicon.svg",
        alt: "",
        replacesTitle: false,
      },
      head: [
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: socialImageUrl,
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:alt",
            content: "trello-mcp — independent, self-hosted Trello MCP server",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:type",
            content: "image/png",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:width",
            content: "1200",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:height",
            content: "630",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: socialImageUrl,
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image:alt",
            content: "trello-mcp — independent, self-hosted Trello MCP server",
          },
        },
      ],
      customCss: ["./src/styles/custom.css"],
      components: {
        Footer: "./src/components/Footer.astro",
        PageSidebar: "./src/components/PageSidebar.astro",
      },
      social: [
        {
          icon: "github",
          label: "trello-mcp on GitHub",
          href: repositoryUrl,
        },
      ],
      sidebar: [
        {
          label: "Get started",
          items: [
            { slug: "get-started", label: "Install and run" },
            { slug: "trello-api-key", label: "Trello API Key" },
            { slug: "clients", label: "Set up your MCP client" },
            {
              slug: "clients/compatibility",
              label: "Compatibility",
            },
            { slug: "get-started/docker", label: "Docker Compose" },
            { slug: "get-started/http", label: "Streamable HTTP" },
            { slug: "get-started/stdio", label: "stdio" },
          ],
        },
        {
          label: "Guides",
          items: [
            { slug: "guides/how-it-works", label: "How it works" },
            { slug: "guides/workflows", label: "Workflows" },
            { slug: "security", label: "Security & Data" },
            {
              slug: "guides/troubleshooting",
              label: "Troubleshooting",
            },
            { slug: "faq", label: "FAQ" },
          ],
        },
        {
          label: "Reference",
          items: [
            { slug: "reference", label: "Overview" },
            {
              slug: "reference/configuration",
              label: "Configuration",
            },
            { slug: "tools", label: "Tool catalog" },
            { slug: "tools/api-coverage", label: "API coverage" },
            { slug: "reference/contributing", label: "Contributing" },
            {
              slug: "reference/support",
              label: "Reporting issues and support",
            },
            {
              slug: "reference/security-policy",
              label: "Security policy",
            },
          ],
        },
      ],
      lastUpdated: true,
      pagination: true,
      pagefind: true,
      credits: false,
    }),
  ],
});
