import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import { CATEGORY_ENTRIES } from "./data/tool-catalog.js";

const WEBSITE_NAME = "trello-mcp";

export const onRequest = defineRouteMiddleware(async (context, next) => {
  await next();

  const route = context.locals.starlightRoute;
  if (route.id === "404") {
    route.head = route.head.flatMap((entry) => {
      if (entry.tag === "link" && entry.attrs?.rel === "canonical") return [];
      if (entry.tag === "meta" && entry.attrs?.property === "og:url") return [];
      if (entry.tag === "meta" && entry.attrs?.name === "robots") {
        return [
          {
            ...entry,
            attrs: { ...entry.attrs, content: "noindex, nofollow" },
          },
        ];
      }
      return [entry];
    });
    return;
  }

  if (route.id === "reference/tools" && route.toc) {
    const categorySlugs = new Set(
      CATEGORY_ENTRIES.map(({ category }) => `tool-group-${category}`),
    );

    route.toc.items = [
      ...route.toc.items.filter(({ slug }) => !categorySlugs.has(slug)),
      ...CATEGORY_ENTRIES.map(({ category, label }) => ({
        depth: 2,
        slug: `tool-group-${category}`,
        text: label,
        children: [],
      })),
    ];
  }

  if (route.entry.id !== "") {
    return;
  }

  const canonicalHref = route.head.find(
    (entry) => entry.tag === "link" && entry.attrs?.rel === "canonical",
  )?.attrs?.href;

  route.head = route.head.map((entry) => {
    if (entry.tag !== "meta" || entry.attrs?.property !== "og:type") {
      return entry;
    }
    return {
      ...entry,
      attrs: { ...entry.attrs, content: "website" },
    };
  });

  if (typeof canonicalHref === "string") {
    const schema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: WEBSITE_NAME,
      url: canonicalHref,
      description: route.entry.data.description,
    };

    route.head.push({
      tag: "script",
      attrs: { type: "application/ld+json" },
      content: JSON.stringify(schema).replaceAll("<", "\\u003c"),
    });
  }
});
