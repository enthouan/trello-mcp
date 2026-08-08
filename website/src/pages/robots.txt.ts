import type { APIRoute } from "astro";

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    throw new Error("Astro.site must be configured to generate robots.txt.");
  }

  const sitemapUrl = new URL("sitemap-index.xml", site);
  const body = [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${sitemapUrl.href}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
