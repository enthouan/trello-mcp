# Website

The project website is an Astro Starlight documentation site kept separate from the MCP runtime.
Starlight provides maintained documentation navigation, search, responsive layouts, themes,
accessible code presentation, and content structure as the install and reference material grows.
Its dependencies live in the separate `website` workspace and remain outside the MCP runtime package
and production image. The `"private": true` setting in `website/package.json` prevents accidental
registry publication of that package; it does not require the GitHub repository to be private.

The sidebar is organized into **Get started**, **Guides**, and **Reference**. Canonical long-form
documentation remains under `docs/`, while `docs/setup-recipes.ts` is the typed source for client and
installation recipes. The website mirrors and tool documentation are generated deterministically;
update their canonical sources and run:

```bash
corepack pnpm docs:tools
corepack pnpm docs:check
```

Do not hand-edit generated documentation mirrors.

## Build and check

Run the website checks from the repository root:

```bash
corepack pnpm exec playwright install --with-deps chromium webkit
corepack pnpm website:check
```

`website:check` verifies generated documentation and the social image, runs Astro diagnostics, and
builds one production artifact. Fast Vitest contracts inspect that artifact for publication,
metadata, content, catalog, and source-correspondence guarantees. Focused Playwright files then
preview the same artifact for visitor behavior, accessibility, navigation, and responsive checks.
Screenshots and traces are retained on failure.

Run an individual stage when diagnosing a failure:

```bash
corepack pnpm website:og:check
corepack pnpm website:typecheck
corepack pnpm website:build
corepack pnpm website:contracts
corepack pnpm website:test
```

Both `website:contracts` and `website:test` build first when run directly. The internal
`website:contracts:run` and `website:test:run` stages intentionally reuse an existing `website/dist`
artifact and are composed by `website:check` to avoid duplicate builds.

The optional commands below are intended for substantial design or release review rather than the
normal pull-request gate:

```bash
corepack pnpm website:visual
corepack pnpm website:lighthouse
```

## Local development

Start the development server with:

```bash
corepack pnpm website:dev
```

Astro prints the selected loopback URL. To review the exact production output instead, build it and
run the preview server:

```bash
corepack pnpm website:build
corepack pnpm website:preview
```

## Social image

The committed Open Graph image is rendered from `og-image.html` with Chromium. Regenerate the PNG
and synchronization manifest after changing the template or renderer:

```bash
corepack pnpm website:og
```

`corepack pnpm website:og:check` verifies that the committed 1200 x 630 image matches its sources.

## Publication metadata

Every build targets the canonical origin `https://trello-mcp.com/`. Astro emits canonical and Open
Graph URLs, the sitemap, robots metadata, and absolute `llms.txt` links without a website environment
variable. Local development uses `corepack pnpm website:dev`; production and Cloudflare preview
deployments both use:

```bash
corepack pnpm website:build
```

Cloudflare Pages [automatically sends `X-Robots-Tag: noindex` on preview
deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/), so previews
can use the same canonical production artifact without becoming duplicate search results. Verify that
response header when configuring or changing the Cloudflare project.

Cloudflare copies `public/_redirects` and `public/_headers` into the built site. The redirect rules
provide HTTP redirects for moved documentation pages while Astro keeps portable HTML fallbacks. The
headers add conservative browser protections. Deployment remains a Cloudflare concern; repository CI
only builds and verifies the output.

Client marks are generated at build time from the pinned Font Awesome packages and emitted in
`client-icons.css`. The stylesheet carries the required Font Awesome Free license attribution; the
browser downloads no Font Awesome JavaScript, webfont, CDN resource, or individual icon file.
