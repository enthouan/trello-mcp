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
      favicon: "/favicon.svg?v=staggered-cards",
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
      },
      editLink: {
        baseUrl: `${repositoryUrl}/edit/main/website/`,
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
            { slug: "get-started/docker", label: "Docker Compose" },
            { slug: "get-started/http", label: "Streamable HTTP" },
            { slug: "get-started/stdio", label: "stdio" },
            {
              slug: "clients/compatibility",
              label: "Compatibility",
            },
          ],
        },
        {
          label: "Concepts",
          items: [{ slug: "concepts/how-it-works", label: "How it works" }],
        },
        {
          label: "Guides",
          items: [
            { slug: "guides/workflows", label: "Workflows" },
            { slug: "security", label: "Security and data flow" },
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
            {
              slug: "reference/configuration",
              label: "Configuration",
            },
            { slug: "tools", label: "Tool catalog" },
            { slug: "tools/api-coverage", label: "API coverage" },
          ],
        },
        {
          label: "Project",
          items: [{ slug: "project", label: "Overview" }],
        },
      ],
      lastUpdated: true,
      pagination: true,
      pagefind: true,
      credits: false,
    }),
  ],
});
