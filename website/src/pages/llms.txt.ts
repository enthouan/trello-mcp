import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { REPOSITORY_URL } from "../data/repository.js";

export const prerender = true;

function routeForEntry(id: string) {
  const withoutIndex = id.replace(/(?:^|\/)index$/, "");
  return withoutIndex ? `${withoutIndex}/` : "";
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error("Astro.site must be configured to generate llms.txt");
  }

  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const href = (path: string) => {
    const pathname = `${base}${path}`.replace(/\/{2,}/g, "/");
    return new URL(pathname, site).href;
  };

  const entries = await getCollection("docs");
  const pages = entries
    .map((entry) => ({
      description: entry.data.description?.trim(),
      title: entry.data.title,
      url: href(routeForEntry(entry.id)),
    }))
    .sort((left, right) => left.url.localeCompare(right.url));

  const body = [
    "# trello-mcp",
    "",
    "> A self-hosted, auditable Model Context Protocol server for broad Trello automation.",
    "",
    "trello-mcp is an independent, community-maintained project. It is not an official Trello or Atlassian product, service, or MCP implementation, and it is not affiliated with, endorsed by, or sponsored by Trello or Atlassian.",
    "",
    "## Documentation",
    "",
    ...pages.flatMap(({ description, title, url }) => [
      `- [${title}](${url})${description ? `: ${description}` : ""}`,
    ]),
    "",
    "## Source",
    "",
    `- [GitHub repository](${REPOSITORY_URL})`,
    "- [Official Trello MCP](https://trello.com/mcp), hosted at https://mcp.trello.com/v1",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
