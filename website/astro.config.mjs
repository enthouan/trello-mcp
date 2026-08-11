import { URL } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { CANONICAL_WEBSITE_URL } from "./src/data/publication.js";
import { REPOSITORY_URL } from "./src/data/repository.js";

const socialImageUrl = new URL("social-card.png", CANONICAL_WEBSITE_URL).href;
/** @type {Array<{ tag: "meta"; attrs: Record<string, string> }>} */
const socialImageHead = [
  {
    tag: "meta",
    attrs: { property: "og:image", content: socialImageUrl },
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
    attrs: { property: "og:image:type", content: "image/png" },
  },
  {
    tag: "meta",
    attrs: { property: "og:image:width", content: "1200" },
  },
  {
    tag: "meta",
    attrs: { property: "og:image:height", content: "630" },
  },
  {
    tag: "meta",
    attrs: { name: "twitter:image", content: socialImageUrl },
  },
  {
    tag: "meta",
    attrs: {
      name: "twitter:image:alt",
      content: "trello-mcp — independent, self-hosted Trello MCP server",
    },
  },
];

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
  output: "static",
  site: CANONICAL_WEBSITE_URL,
  trailingSlash: "always",
  redirects: {
    "/get-started": "/getting-started/",
    "/get-started/docker": "/getting-started/docker/",
    "/get-started/http": "/getting-started/http/",
    "/get-started/stdio": "/getting-started/stdio/",
    "/trello-api-key": "/getting-started/trello-api-key/",
    "/clients": "/getting-started/clients/",
    "/clients/compatibility": "/getting-started/compatibility/",
    "/concepts/how-it-works": "/guides/how-it-works/",
    "/security": "/guides/security/",
    "/faq": "/guides/faq/",
    "/tools": "/reference/tools/",
    "/tools/api-coverage": "/reference/api-coverage/",
    "/reference/support": "/reference/reporting-issues/",
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
      titleDelimiter: "—",
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
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "/client-icons.css",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "robots",
            content: "index, follow",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "theme-color",
            content: "#0052cc",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:card",
            content: "summary_large_image",
          },
        },
        ...socialImageHead,
      ],
      customCss: ["./src/styles/custom.css"],
      routeMiddleware: "./src/starlightRouteData.ts",
      components: {
        Footer: "./src/components/Footer.astro",
      },
      social: [
        {
          icon: "github",
          label: "trello-mcp on GitHub",
          href: REPOSITORY_URL,
        },
      ],
      sidebar: [
        {
          label: "Get started",
          items: [
            { slug: "getting-started", label: "Install and run" },
            {
              slug: "getting-started/trello-api-key",
              label: "Trello API key",
            },
            {
              slug: "getting-started/clients",
              label: "Set up your MCP client",
            },
            {
              slug: "getting-started/compatibility",
              label: "Compatibility",
            },
            {
              slug: "getting-started/docker",
              label: "Docker Compose",
            },
            {
              slug: "getting-started/http",
              label: "Streamable HTTP",
            },
            { slug: "getting-started/stdio", label: "stdio" },
          ],
        },
        {
          label: "Guides",
          items: [
            { slug: "guides/how-it-works", label: "How it works" },
            { slug: "guides/workflows", label: "Workflows" },
            { slug: "guides/security", label: "Security & Data" },
            { slug: "guides/operations", label: "Operations" },
            {
              slug: "guides/troubleshooting",
              label: "Troubleshooting",
            },
            { slug: "guides/faq", label: "FAQ" },
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
            { slug: "reference/tools", label: "Tool catalog" },
            { slug: "reference/api-coverage", label: "API coverage" },
            { slug: "reference/contributing", label: "Contributing" },
            {
              slug: "reference/reporting-issues",
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
