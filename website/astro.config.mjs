import { unified } from "@astrojs/markdown-remark";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

const repositoryUrl = "https://github.com/enthouan/trello-mcp";

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
  site: normalizeSiteUrl(process.env.SITE_URL),
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
      favicon: "/favicon.svg?v=split-card",
      logo: {
        src: "./public/favicon.svg",
        alt: "",
        replacesTitle: false,
      },
      customCss: ["./src/styles/custom.css"],
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
        { slug: "", label: "Home" },
        { slug: "get-started", label: "Get Started" },
        {
          label: "Clients",
          items: [
            { slug: "clients", label: "Overview" },
            {
              slug: "clients/compatibility",
              label: "Compatibility evidence",
            },
          ],
        },
        {
          label: "Tools",
          items: [
            { slug: "tools", label: "Tool catalog" },
            { slug: "tools/api-coverage", label: "API coverage" },
          ],
        },
        { slug: "project", label: "Project" },
      ],
      lastUpdated: true,
      pagination: true,
      pagefind: true,
      credits: false,
    }),
  ],
});
