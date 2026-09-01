import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import playwrightConfig from "../../playwright.config.js";
import { CANONICAL_WEBSITE_URL } from "../../src/data/publication.js";
import {
  REPOSITORY_API_URL,
  REPOSITORY_URL,
} from "../../src/data/repository.js";

const repositoryFile = (path: string) =>
  new URL(`../../../${path}`, import.meta.url);
const websiteFile = (path: string) => new URL(`../../${path}`, import.meta.url);

async function source(url: URL) {
  return readFile(url, "utf8");
}

async function directoryEntries(url: URL) {
  try {
    return await readdir(url);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

describe("website package and command boundaries", () => {
  it("keeps website dependencies in a non-publishable workspace", async () => {
    const rootPackage = JSON.parse(
      await source(repositoryFile("package.json")),
    ) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      files: string[];
    };
    const websitePackage = JSON.parse(
      await source(websiteFile("package.json")),
    ) as {
      name: string;
      private: boolean;
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const workspace = await source(repositoryFile("pnpm-workspace.yaml"));
    const websiteReadme = await source(websiteFile("README.md"));

    expect(websitePackage).toMatchObject({
      name: "trello-mcp-website",
      private: true,
      scripts: {
        dev: "cross-env ASTRO_DEV_BACKGROUND=0 astro dev",
        build: "astro build",
        preview: "cross-env ASTRO_PREVIEW_BACKGROUND=0 astro preview",
        typecheck: "astro check --minimumFailingSeverity warning",
      },
    });
    expect(websitePackage.devDependencies).toMatchObject({
      "@astrojs/check": "0.9.10",
      "@astrojs/markdown-remark": "7.2.4",
      "@astrojs/starlight": "0.41.10",
      "@fortawesome/free-brands-svg-icons": "7.3.1",
      "@fortawesome/free-solid-svg-icons": "7.3.1",
      astro: "7.2.9",
      "cross-env": "10.1.0",
      sharp: "0.35.4",
      typescript: "6.0.3",
    });
    expect(workspace).toMatch(/^packages:\n\s+- website\s*$/);
    expect(rootPackage.files).toEqual([
      "dist",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
    ]);

    const runtimePackages = { ...rootPackage.dependencies };
    for (const packageName of [
      "astro",
      "@astrojs/starlight",
      "@astrojs/check",
      "@playwright/test",
      "lighthouse",
    ]) {
      expect(runtimePackages).not.toHaveProperty(packageName);
    }
    expect(rootPackage.devDependencies).toMatchObject({
      "@playwright/test": "1.62.1",
      parse5: "8.0.1",
      typescript: "7.0.2",
      vitest: "4.1.11",
    });
    expect(websitePackage.devDependencies.typescript).toBe("6.0.3");
    expect(websiteReadme).toMatch(
      /The `"private": true` setting in `website\/package\.json` prevents accidental\s+registry publication/,
    );
    expect(websiteReadme).toMatch(
      /remain outside the MCP runtime package\s+and production image/,
    );
    expect(websiteReadme).toContain(
      "it does not require the GitHub repository to be private",
    );
  });

  it("builds once in the aggregate check and supports build-first standalone QA", async () => {
    const rootPackage = JSON.parse(
      await source(repositoryFile("package.json")),
    ) as {
      scripts: Record<string, string>;
    };
    const scripts = rootPackage.scripts;

    expect(scripts["website:contracts:run"]).toBe(
      "vitest run --config vitest.website.config.ts",
    );
    expect(scripts["website:test:run"]).toBe(
      "playwright test --config website/playwright.config.ts",
    );
    expect(scripts["website:contracts"]).toBe(
      "pnpm docs:check && pnpm website:og:check && pnpm website:build && pnpm website:contracts:run",
    );
    expect(scripts["website:test"]).toBe(
      "pnpm website:build && pnpm website:test:run",
    );
    expect(scripts["website:visual"]).toBe(
      "pnpm website:build && pnpm website:visual:run",
    );
    expect(scripts["website:lighthouse"]).toBe(
      "pnpm website:build && tsx website/scripts/lighthouse.ts",
    );
    expect(scripts["website:check"]).toBe(
      "pnpm docs:check && pnpm website:og:check && pnpm website:typecheck && pnpm website:build && pnpm website:contracts:run && pnpm website:test:run",
    );
    expect(scripts["website:check"]?.match(/website:build/g)).toHaveLength(1);
    expect(scripts["website:contracts:run"]).not.toContain("build");
    expect(scripts["website:test:run"]).not.toContain("build");

    const playwrightConfigSource = await source(
      websiteFile("playwright.config.ts"),
    );
    expect(playwrightConfigSource).toContain("website:preview");
    expect(playwrightConfigSource).not.toContain("website:build");
    expect(playwrightConfigSource).not.toContain(
      "PLAYWRIGHT_USE_EXISTING_BUILD",
    );

    const browserProjects = playwrightConfig.projects ?? [];
    const chromium = browserProjects.find(({ name }) => name === "chromium");
    const webkit = browserProjects.find(
      ({ name }) => name === "webkit-desktop-light",
    );
    expect(browserProjects.map(({ name }) => name)).toEqual([
      "chromium",
      "webkit-desktop-light",
    ]);
    expect(chromium?.testIgnore).toEqual(/webkit-smoke\.spec\.ts$/);
    expect(webkit?.testMatch).toEqual(/webkit-smoke\.spec\.ts$/);
    expect(webkit?.use).toMatchObject({
      colorScheme: "light",
      defaultBrowserType: "webkit",
    });
  });

  it("keeps pull-request CI validation-only and delegates to the aggregate check", async () => {
    const workflow = await source(
      repositoryFile(".github/workflows/build-and-test.yml"),
    );
    const dockerignore = await source(repositoryFile(".dockerignore"));

    expect(workflow).toContain("pnpm website:check");
    expect(
      workflow.match(
        /actions\/setup-node@[0-9a-f]{40} # v7\.0\.0\n\s+with:\n\s+node-version-file: \.nvmrc\n\s+cache: pnpm/g,
      ),
    ).toHaveLength(2);
    expect(workflow).toContain(
      "pnpm exec playwright install --with-deps chromium webkit",
    );
    expect(workflow.match(/version: 10\.34\.1/g)).toHaveLength(2);
    expect(
      workflow.match(
        /actions\/checkout@[0-9a-f]{40} # v7\.0\.1\n\s+with:\n\s+fetch-depth: 0/g,
      ),
    ).toHaveLength(1);
    expect(workflow).toMatch(
      /name: website-qa[\s\S]*website\/playwright-report\/[\s\S]*website\/test-results\/[\s\S]*retention-days: 14/,
    );
    expect(workflow).toMatch(
      /check:\n\s+if: always\(\)\n\s+needs: \[test, website\][\s\S]*TEST_RESULT: \$\{\{ needs\.test\.result \}\}[\s\S]*WEBSITE_RESULT: \$\{\{ needs\.website\.result \}\}[\s\S]*test "\$TEST_RESULT" = success[\s\S]*test "\$WEBSITE_RESULT" = success/,
    );
    expect(workflow).toMatch(
      /docker:\n\s+if: github\.event_name == 'pull_request'[\s\S]*docker compose --env-file \.env\.example config --quiet[\s\S]*docker compose --env-file \.env\.example -f docker-compose\.local\.yml config --quiet[\s\S]*platforms: linux\/amd64,linux\/arm64[\s\S]*push: false[\s\S]*outputs: type=cacheonly/,
    );
    expect(dockerignore.split(/\r?\n/)).toEqual(
      expect.arrayContaining(["website", "pnpm-workspace.yaml"]),
    );
    for (const marker of [
      "pnpm website:visual",
      "pnpm website:lighthouse",
      "actions/cache@",
      "cache-dependency-path:",
      "PLAYWRIGHT_BROWSERS_PATH",
      "ms-playwright",
      "deploy-website",
      "cloudflare/wrangler-action",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "pages deploy",
    ]) {
      expect(workflow).not.toContain(marker);
    }
  });
});

describe("canonical publication source contracts", () => {
  it("uses one canonical origin without publication-mode variables", async () => {
    const publication = await source(websiteFile("src/data/publication.ts"));
    const astroConfig = await source(websiteFile("astro.config.mjs"));
    const robots = await source(websiteFile("src/pages/robots.txt.ts"));
    const llms = await source(websiteFile("src/pages/llms.txt.ts"));
    const contributing = await source(repositoryFile("CONTRIBUTING.md"));
    const websiteReadme = await source(websiteFile("README.md"));

    expect(CANONICAL_WEBSITE_URL).toBe("https://trello-mcp.com/");
    expect(publication).toContain("CANONICAL_WEBSITE_URL");
    expect(astroConfig).toContain("site: CANONICAL_WEBSITE_URL");
    expect(robots).toContain("CANONICAL_WEBSITE_URL");
    expect(llms).toContain("new URL(pathname, site).href");
    for (const text of [
      publication,
      astroConfig,
      robots,
      llms,
      contributing,
      websiteReadme,
    ]) {
      expect(text).not.toMatch(
        /\b(?:SITE_URL|WEBSITE_BASE_URL|WEBSITE_PUBLICATION_MODE|site:build:production)\b/,
      );
    }
    expect(contributing).toContain(
      "Cloudflare Pages should run `corepack pnpm website:build`",
    );
    expect(contributing).toMatch(
      /no website environment\s+variable is required/,
    );
    expect(websiteReadme).toContain(CANONICAL_WEBSITE_URL);
    expect(websiteReadme).toContain("X-Robots-Tag: noindex");
  });

  it("keeps repository links and image metadata centralized", async () => {
    const repository = await source(websiteFile("src/data/repository.ts"));
    const astroConfig = await source(websiteFile("astro.config.mjs"));
    const footer = await source(websiteFile("src/components/Footer.astro"));
    const repositoryLink = await source(
      websiteFile("src/components/RepositoryLink.astro"),
    );
    const repositorySocialLink = await source(
      websiteFile("src/components/RepositorySocialLink.astro"),
    );
    const llms = await source(websiteFile("src/pages/llms.txt.ts"));

    expect(REPOSITORY_URL).toBe("https://github.com/enthouan/trello-mcp");
    expect(repository).toContain("REPOSITORY_URL");
    for (const text of [
      astroConfig,
      footer,
      repositoryLink,
      repositorySocialLink,
      llms,
    ]) {
      expect(text).toContain("REPOSITORY_URL");
      expect(text).not.toContain(`const repositoryUrl = "${REPOSITORY_URL}"`);
    }
    expect(astroConfig).toContain('href: "/client-icons.css"');
  });

  it("keeps the browser-only GitHub metadata enhancement private and deterministic", async () => {
    const repository = await source(websiteFile("src/data/repository.ts"));
    const astroConfig = await source(websiteFile("astro.config.mjs"));
    const repositorySocialLink = await source(
      websiteFile("src/components/RepositorySocialLink.astro"),
    );
    const homepage = await source(websiteFile("src/content/docs/index.mdx"));
    const browserSupport = await source(
      websiteFile("tests/browser/support.ts"),
    );
    const lighthouse = await source(websiteFile("scripts/lighthouse.ts"));
    const privacy = await source(repositoryFile("PRIVACY.md"));

    expect(REPOSITORY_API_URL).toBe(
      "https://api.github.com/repos/enthouan/trello-mcp",
    );
    expect(repository).toContain("new URL(REPOSITORY_URL)");
    expect(repository).not.toContain(
      "https://api.github.com/repos/enthouan/trello-mcp",
    );
    expect(astroConfig).toContain(
      'SocialIcons: "./src/components/RepositorySocialLink.astro"',
    );
    expect(astroConfig).toContain('label: "trello-mcp source repository"');
    expect(repositorySocialLink).toContain("config.social");
    expect(repositorySocialLink).toContain("data-repository-navigation");
    expect(repositorySocialLink).toContain('<Icon name="star" />');
    expect(repositorySocialLink).toContain("fetch(REPOSITORY_API_URL");
    expect(repositorySocialLink).toContain('credentials: "omit"');
    expect(repositorySocialLink).toContain('referrerPolicy: "no-referrer"');
    expect(repositorySocialLink).toContain("globalThis.sessionStorage");
    expect(repositorySocialLink).toContain("storage.setItem(CACHE_KEY");
    expect(repositorySocialLink).toContain(
      "document.querySelectorAll<HTMLAnchorElement>",
    );
    expect(repositorySocialLink).not.toMatch(
      /Authorization|github_pat_|gh[pousr]_/i,
    );
    expect(homepage).not.toContain("RepositoryStarCount");
    expect(homepage).not.toContain("RepositorySocialLink");
    expect(browserSupport).toContain("page.route(REPOSITORY_API_URL");
    expect(lighthouse).toMatch(
      /blockedUrlPatterns: \[`\$\{REPOSITORY_API_URL\}\*`\]/,
    );
    for (const marker of [
      "your browser may make one best-effort, unauthenticated request",
      "IP address",
      "user agent",
      "Origin/CORS information",
      'credentials: "omit"',
      'referrerPolicy: "no-referrer"',
      "no project GitHub credential",
      "An attempt marker is stored in `sessionStorage` before the request starts",
      "do not cause repeated GitHub requests during the current browser session",
    ]) {
      expect(privacy).toContain(marker);
    }
  });
});

describe("distribution and generated-source safety", () => {
  it("pins the current v1.0 release surfaces without erasing release history", async () => {
    const readme = await source(repositoryFile("README.md"));
    const security = await source(repositoryFile("SECURITY.md"));
    const configuration = await source(repositoryFile("docs/configuration.md"));
    const changelog = await source(repositoryFile("CHANGELOG.md"));

    expect(readme).toContain(
      "The smoke flow validates representative v1.0 workflows:",
    );
    expect(readme).not.toContain(
      "The smoke flow validates representative pre-1.0 coverage:",
    );
    expect(security).toContain(
      "`trello-mcp` v1.0 is the current stable release line.",
    );
    expect(security).not.toContain("pre-1.0");
    expect(configuration.match(/TRELLO_MCP_IMAGE_TAG=1\.0\.0/g)).toHaveLength(
      2,
    );
    expect(configuration).not.toContain("TRELLO_MCP_IMAGE_TAG=0.9.0");
    expect(changelog).toContain("## v1.0.0");
    expect(changelog).toContain("## v0.9.0");
  });

  it("keeps documented container publishing on loopback and OCI metadata current", async () => {
    const readme = await source(repositoryFile("README.md"));
    const releaseWorkflow = await source(
      repositoryFile(".github/workflows/release.yml"),
    );

    expect(readme).not.toContain("docker run --rm -p 3000:3000");
    expect(
      readme.match(/docker run --rm -p 127\.0\.0\.1:3000:3000/g),
    ).toHaveLength(2);
    expect(readme).toContain("docker compose up -d --wait --wait-timeout 120");
    expect(readme).toContain("ghcr.io/enthouan/trello-mcp");
    expect(readme).toContain("[trello-mcp.com](https://trello-mcp.com/)");
    expect(releaseWorkflow).toContain(
      "org.opencontainers.image.url=$" +
        "{{ github.server_url }}/$" +
        "{{ github.repository }}",
    );
    expect(releaseWorkflow).not.toContain("trello-mcp.antoinemenard.com");
  });

  it("uses package-generated icons without checked-in client SVG assets", async () => {
    const customCss = await source(websiteFile("src/styles/custom.css"));
    const iconEndpoint = await source(
      websiteFile("src/pages/client-icons.css.ts"),
    );

    await expect(
      directoryEntries(websiteFile("public/client-icons")),
    ).resolves.toEqual([]);
    expect(customCss).not.toMatch(/\/client-icons\/[^)]+\.svg/);
    expect(iconEndpoint).toContain("@fortawesome/free-brands-svg-icons");
    expect(iconEndpoint).toContain("@fortawesome/free-solid-svg-icons");
    expect(iconEndpoint).toContain("Font Awesome Free 7.3.1");
  });

  it("keeps canonical documentation generation and freshness in the QA gate", async () => {
    const generator = await source(
      repositoryFile("scripts/generate-tool-docs.ts"),
    );
    const packageSource = JSON.parse(
      await source(repositoryFile("package.json")),
    ) as {
      scripts: Record<string, string>;
    };
    const readme = await source(repositoryFile("README.md"));
    const contributing = await source(repositoryFile("CONTRIBUTING.md"));

    expect(packageSource.scripts["docs:check"]).toContain("--check");
    expect(
      packageSource.scripts["website:check"]?.startsWith("pnpm docs:check"),
    ).toBe(true);
    for (const sourcePath of [
      "CONTRIBUTING.md",
      "SUPPORT.md",
      "SECURITY.md",
      "docs/client-setup.md",
      "docs/mcp-client-compatibility.md",
      "docs/operations.md",
    ]) {
      expect(generator).toContain(sourcePath);
    }
    for (const outputPath of [
      "reference/contributing.mdx",
      "reference/reporting-issues.mdx",
      "reference/security-policy.md",
      "getting-started/clients.mdx",
      "getting-started/compatibility.mdx",
      "guides/operations.md",
    ]) {
      expect(generator).toContain(outputPath);
    }
    expect(readme).toContain(
      "legitimate checked-in generated documentation mirrors",
    );
    expect(contributing).toContain(
      "post-merge `main` Release workflow succeeds",
    );
    expect(contributing).toMatch(/annotated\s+`vX\.Y\.Z` tag/);
    expect(contributing).toContain("merged `origin/main` release commit");
  });
});
