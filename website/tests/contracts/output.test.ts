import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { REPOSITORY_URL } from "../../src/data/repository.js";
import {
  CANONICAL_WEBSITE_ORIGIN,
  CANONICAL_WEBSITE_URL,
  DISCLAIMER,
  FOOTER_ATTRIBUTION,
  FOOTER_DISCLAIMER,
  LEGACY_REDIRECTS,
  OFFICIAL_ENDPOINT,
  PUBLIC_DOCUMENT_METADATA,
  PUBLIC_ROUTES,
} from "../support/site.js";
import {
  anchorHrefs,
  attribute,
  elements,
  findByAttribute,
  findById,
  linkHref,
  metadataContent,
  normalizedText,
  readDist,
  readDistBuffer,
  readRoute,
  required,
} from "./html.js";

describe("production route contracts", () => {
  for (const route of PUBLIC_ROUTES) {
    it(`${route} is generated with the public shell`, async () => {
      const { document, source } = await readRoute(route);
      const main = elements(document, (element) => element.tagName === "main");
      const h1 = elements(
        document,
        (element) =>
          element.tagName === "h1" && attribute(element, "id") === "_top",
      );

      expect(main).toHaveLength(1);
      expect(h1).toHaveLength(1);
      expect(source).not.toContain("Edit page");
      expect(normalizedText(document)).toContain(FOOTER_ATTRIBUTION);
      expect(normalizedText(document)).toContain(FOOTER_DISCLAIMER);

      const runtimeAssets = elements(document, (element) =>
        ["img", "script", "source"].includes(element.tagName),
      )
        .flatMap((element) => [
          attribute(element, "src"),
          attribute(element, "srcset"),
        ])
        .filter((value): value is string => value !== undefined);
      expect(
        runtimeAssets.filter((value) => /^https?:\/\//.test(value)),
      ).toEqual([]);

      if (route === "/404.html") return;
      const metadata = PUBLIC_DOCUMENT_METADATA[route];
      const titles = elements(
        document,
        (element) => element.tagName === "title",
      ).map(normalizedText);
      const canonical = linkHref(document, "canonical");

      expect(titles[0]).toBe(`${metadata.title} — trello-mcp`);
      expect(metadataContent(document, "name", "description")).toEqual([
        metadata.description,
      ]);
      expect(metadataContent(document, "property", "og:title")).toEqual([
        metadata.title,
      ]);
      expect(metadataContent(document, "property", "og:description")).toEqual([
        metadata.description,
      ]);
      expect(canonical).toHaveLength(1);

      const canonicalUrl = new URL(canonical[0] ?? "http://invalid.invalid/");
      expect(canonicalUrl.origin).toBe(CANONICAL_WEBSITE_ORIGIN);
      expect(canonicalUrl.pathname).toBe(route);
      expect(canonicalUrl.search).toBe("");
      expect(canonicalUrl.hash).toBe("");
      expect(metadataContent(document, "property", "og:url")).toEqual([
        canonicalUrl.href,
      ]);
    });
  }

  it("keeps the generated 404 out of search and canonical indexing", async () => {
    const { document } = await readRoute("/404.html");
    expect(metadataContent(document, "name", "robots")).toEqual([
      "noindex, nofollow",
    ]);
    expect(linkHref(document, "canonical")).toEqual([]);
    expect(metadataContent(document, "property", "og:url")).toEqual([]);
  });
});

describe("SEO and machine-readable publication output", () => {
  it("emits complete homepage social metadata and WebSite JSON-LD", async () => {
    const { document } = await readRoute("/");
    expect(metadataContent(document, "name", "theme-color")).toEqual([
      "#0052cc",
    ]);
    expect(metadataContent(document, "property", "og:type")).toEqual([
      "website",
    ]);
    expect(metadataContent(document, "property", "og:image")).toEqual([
      `${CANONICAL_WEBSITE_URL}social-card.png`,
    ]);
    expect(metadataContent(document, "name", "twitter:image")).toEqual([
      `${CANONICAL_WEBSITE_URL}social-card.png`,
    ]);
    expect(metadataContent(document, "property", "og:image:type")).toEqual([
      "image/png",
    ]);
    expect(metadataContent(document, "property", "og:image:width")).toEqual([
      "1200",
    ]);
    expect(metadataContent(document, "property", "og:image:height")).toEqual([
      "630",
    ]);
    expect(metadataContent(document, "property", "og:image:alt")).toEqual([
      "trello-mcp — independent, self-hosted Trello MCP server",
    ]);

    const structuredData = findByAttribute(
      document,
      "script",
      "type",
      "application/ld+json",
    );
    expect(structuredData).toHaveLength(1);
    expect(
      JSON.parse(
        normalizedText(required(structuredData[0], "homepage JSON-LD")),
      ),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "trello-mcp",
      url: CANONICAL_WEBSITE_URL,
      description:
        "A self-hosted, auditable Model Context Protocol server for broad Trello automation.",
    });
  });

  it("keeps document pages as articles without homepage JSON-LD", async () => {
    const { document } = await readRoute("/getting-started/");
    expect(metadataContent(document, "property", "og:type")).toEqual([
      "article",
    ]);
    expect(
      findByAttribute(document, "script", "type", "application/ld+json"),
    ).toHaveLength(0);
  });

  it("keeps the generated social image and manifest deterministic", async () => {
    const image = await readDistBuffer("social-card.png");
    const manifest = JSON.parse(
      await readFile(
        new URL("../../og-image.manifest.json", import.meta.url),
        "utf8",
      ),
    ) as {
      height: number;
      imageSha256: string;
      schemaVersion: number;
      sourceSha256: string;
      width: number;
    };
    const source = await readFile(
      new URL("../../og-image.html", import.meta.url),
      "utf8",
    );

    expect(image.subarray(1, 4).toString()).toBe("PNG");
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      width: 1200,
      height: 630,
    });
    expect(manifest.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.imageSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(source).toContain("data-social-card");
    expect(source).toContain("Manage Trello from");
    expect(source).toContain("your MCP client.");
    expect(source).toContain("Self-hosted, auditable Trello automation.");
    expect(source).toContain("Independent community project");
    expect(source).toContain("--og-accent: #0052cc;");
    expect(source).toContain('<svg viewBox="0 0 64 64"');
    expect(source).not.toContain("<img");
  });

  it("publishes robots, sitemap, and llms.txt from canonical routes", async () => {
    const robots = await readDist("robots.txt");
    const sitemapIndex = await readDist("sitemap-index.xml");
    const sitemap = await readDist("sitemap-0.xml");
    const llms = await readDist("llms.txt");

    expect(robots.trimEnd().split("\n").slice(0, 2)).toEqual([
      "User-agent: *",
      "Allow: /",
    ]);
    expect(robots).not.toContain("Disallow:");
    expect(robots.match(/^Sitemap: /gm)).toHaveLength(1);
    expect(robots).toContain(`${CANONICAL_WEBSITE_URL}sitemap-index.xml`);
    expect(sitemapIndex).toContain(`${CANONICAL_WEBSITE_URL}sitemap-0.xml`);

    const documentLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1] ?? "http://invalid.invalid/"),
    );
    expect(new Set(documentLocations.map(({ href }) => href)).size).toBe(
      documentLocations.length,
    );
    expect(documentLocations.map(({ pathname }) => pathname).sort()).toEqual(
      Object.keys(PUBLIC_DOCUMENT_METADATA).sort(),
    );
    expect(sitemap).not.toContain("/404");

    expect(llms).toContain("# trello-mcp");
    expect(llms).toContain(`\n${DISCLAIMER}\n`);
    expect(llms).toContain(`- [GitHub repository](${REPOSITORY_URL})`);
    expect(llms).toContain(
      `- [Official Trello MCP](https://trello.com/mcp), hosted at ${OFFICIAL_ENDPOINT}`,
    );
    for (const route of Object.keys(PUBLIC_DOCUMENT_METADATA)) {
      expect(llms).toContain(`${CANONICAL_WEBSITE_URL}${route.slice(1)}`);
    }
    expect(llms).not.toMatch(/\]\(\//);
    expect(llms).not.toContain("undefined");
    expect(llms.toLowerCase()).not.toMatch(
      /antoine ménard|antoinemenard\.com|generated by (?:codex|claude)|developed by (?:codex|claude)|co-authored-by:/,
    );
  });
});

describe("Cloudflare-static publication contracts", () => {
  it("copies security headers exactly", async () => {
    expect((await readDist("_headers")).trim()).toBe(
      [
        "/*",
        "  X-Content-Type-Options: nosniff",
        "  Referrer-Policy: strict-origin-when-cross-origin",
        "  X-Frame-Options: DENY",
        "  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()",
      ].join("\n"),
    );
  });

  it("copies permanent redirects and keeps local fallback pages noindex", async () => {
    const redirects = await readDist("_redirects");
    expect(redirects.trim().split("\n")).toEqual(
      LEGACY_REDIRECTS.flatMap(([legacyRoute, canonicalRoute]) => [
        `${legacyRoute} ${canonicalRoute} 301`,
        `${legacyRoute}/ ${canonicalRoute} 301`,
      ]),
    );

    for (const [legacyRoute, canonicalRoute] of LEGACY_REDIRECTS) {
      const { document, source } = await readRoute(`${legacyRoute}/`);
      expect(source).toContain('http-equiv="refresh"');
      expect(source).toContain(`content="0;url=${canonicalRoute}"`);
      expect(metadataContent(document, "name", "robots")).toEqual(["noindex"]);
      expect(linkHref(document, "canonical")).toEqual([
        `${CANONICAL_WEBSITE_URL}${canonicalRoute.slice(1)}`,
      ]);
    }
  });
});

describe("production asset safety", () => {
  it("ships the local project mark and accessible request-flow diagram", async () => {
    const favicon = await readDist("favicon.svg");
    const requestFlow = await readDist("request-flow.svg");

    expect(favicon).toContain("trello-mcp split-card mark");
    expect(favicon.toLowerCase()).toContain("#0052cc");
    expect(favicon.match(/<rect\b/g)).toHaveLength(3);
    expect(favicon.match(/fill="#fff"/g)).toHaveLength(2);
    expect(favicon).not.toContain("<script");
    expect(favicon).not.toMatch(/<(?:image|use)\b[^>]+href=["']https?:/i);

    for (const marker of [
      "How a trello-mcp tool call travels",
      "Local stdio · Sessionful HTTP",
      "holds Trello API key + token",
      "Trello remains the source of truth",
      "@media (prefers-color-scheme: dark)",
    ]) {
      expect(requestFlow).toContain(marker);
    }
    await expect(readDist("transport-chooser.svg")).rejects.toThrow();
  });

  it("generates local Font Awesome client masks without legacy SVG requests", async () => {
    const css = await readDist("client-icons.css");
    expect(css).toContain("Font Awesome Free 7.3.1");
    expect(css).toContain("CC BY 4.0");
    expect(css).toContain("https://fontawesome.com/license/free");
    expect(css.match(/data:image\/svg\+xml/g)).toHaveLength(6);
    expect(css).not.toMatch(/url\(["']?https?:/);
    for (const name of [
      "claude",
      "evidence",
      "inspector",
      "openai",
      "opencode",
      "vscode",
    ]) {
      expect(css).toContain(`--client-icon-${name}:`);
    }
  });

  it("contains no analytics, remote runtime assets, or secret-like values", async () => {
    const routeSources = await Promise.all(
      PUBLIC_ROUTES.map((route) => readRoute(route)),
    );
    const combined = routeSources.map(({ source }) => source).join("\n");

    expect(combined).not.toMatch(
      /googletagmanager|google-analytics|plausible\.io|posthog|segment\.com|mixpanel|hotjar/i,
    );
    expect(combined).not.toMatch(
      /(?:TRELLO_API_KEY|TRELLO_TOKEN|MCP_AUTH_TOKEN)[^<\n]{0,32}[a-f0-9]{32,64}/i,
    );
  });

  it("keeps every internal top-level target in the generated artifact", async () => {
    const { document } = await readRoute("/");
    expect(anchorHrefs(document)).toContain("/getting-started/");
    for (const route of PUBLIC_ROUTES.filter(
      (route) => route !== "/404.html",
    )) {
      expect(findById((await readRoute(route)).document, "_top")).toHaveLength(
        1,
      );
    }
  });
});
