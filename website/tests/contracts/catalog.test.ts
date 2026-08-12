import { describe, expect, it } from "vitest";
import {
  CLIENT_SETUPS,
  type ClientSetup,
  INSTALL_METHODS,
  VERIFY_EXAMPLE,
} from "../../../docs/setup-recipes.js";
import { allTools } from "../../../src/trello/tools.js";
import {
  CATEGORY_COUNT,
  CATEGORY_ENTRIES,
  TOOL_COUNT,
} from "../../src/data/tool-catalog.js";
import {
  CATALOG_CATEGORY_COUNT,
  CATALOG_PREVIEW_CATEGORIES,
  CLIENT_ICON_SOURCES,
} from "../support/site.js";
import {
  anchorHrefs,
  attribute,
  elements,
  findById,
  normalizedText,
  normalizedVisibleText,
  readDist,
  readRoute,
  required,
} from "./html.js";

describe("runtime-backed tool catalog", () => {
  it("covers every registered tool exactly once with described inputs", () => {
    const catalogTools = CATEGORY_ENTRIES.flatMap(({ tools }) => tools);
    const runtimeNames = allTools.map(({ name }) => name).sort();
    const catalogNames = catalogTools.map(({ name }) => name).sort();

    expect(TOOL_COUNT).toBe(77);
    expect(CATEGORY_COUNT).toBe(CATALOG_CATEGORY_COUNT);
    expect(catalogTools).toHaveLength(TOOL_COUNT);
    expect(new Set(catalogNames).size).toBe(TOOL_COUNT);
    expect(catalogNames).toEqual(runtimeNames);
    for (const category of CATEGORY_ENTRIES) {
      expect(category.category).not.toBe("");
      expect(category.label).not.toBe("");
      expect(category.description).not.toBe("");
      expect(category.example).not.toBe("");
      for (const tool of category.tools) {
        expect(tool.description).not.toBe("");
        expect(tool.result).not.toBe("");
        expect(tool.scope).not.toBe("");
        expect(["read", "write", "delete"]).toContain(tool.behavior);
        for (const input of tool.inputs) {
          expect(input.name).not.toBe("");
          expect(input.description).not.toBe("");
          expect(typeof input.required).toBe("boolean");
        }
      }
    }
  });

  it("renders every category, card, behavior, and input into static HTML", async () => {
    const page = await readRoute("/reference/tools/");
    const catalog = elements(
      page.document,
      (element) => attribute(element, "data-tool-catalog") !== undefined,
    );
    const groups = elements(
      page.document,
      (element) => attribute(element, "data-tool-group") !== undefined,
    );
    const cards = elements(
      page.document,
      (element) => attribute(element, "data-tool-card") !== undefined,
    );

    expect(catalog).toHaveLength(1);
    const catalogRoot = required(catalog[0], "tool catalog root");
    expect(attribute(catalogRoot, "data-tool-count")).toBe(String(TOOL_COUNT));
    expect(groups).toHaveLength(CATEGORY_COUNT);
    expect(cards).toHaveLength(TOOL_COUNT);

    for (const category of CATEGORY_ENTRIES) {
      const group = required(
        groups.find(
          (candidate) =>
            attribute(candidate, "aria-labelledby") ===
            `tool-group-${category.category}`,
        ),
        `${category.category} tool group`,
      );
      const groupCards = elements(
        group,
        (element) => attribute(element, "data-tool-card") !== undefined,
      );
      expect(groupCards).toHaveLength(category.tools.length);
      expect(normalizedText(group)).toContain(category.label);
      expect(normalizedText(group)).toContain("Example prompt:");

      for (const tool of category.tools) {
        const card = required(
          groupCards.find(
            (candidate) => attribute(candidate, "data-tool-name") === tool.name,
          ),
          `${tool.name} tool card`,
        );
        expect(attribute(card, "data-category")).toBe(category.category);
        expect(attribute(card, "data-behavior")).toBe(tool.behavior);
        expect(normalizedText(card)).toContain(tool.description);
        expect(normalizedText(card)).toContain(tool.result);
        for (const input of tool.inputs) {
          expect(normalizedText(card)).toContain(input.name);
          expect(normalizedText(card)).toContain(input.description);
          expect(normalizedText(card)).toContain(
            input.required ? "Required" : "Optional",
          );
        }
      }
    }

    const cardCreate = required(
      cards.find(
        (candidate) => attribute(candidate, "data-tool-name") === "card_create",
      ),
      "card_create tool card",
    );
    expect(normalizedText(cardCreate)).toContain("2 required, 5 optional");
    expect(normalizedText(cardCreate)).toContain(
      "Destination list id where the new card should be created.",
    );
    const checklistUpdate = required(
      cards.find(
        (candidate) =>
          attribute(candidate, "data-tool-name") === "card_checklist_update",
      ),
      "card_checklist_update tool card",
    );
    expect(normalizedText(checklistUpdate)).toContain(
      "Provide at least one of name or pos.",
    );
  });

  it("keeps the homepage preview derived from canonical categories", async () => {
    const page = await readRoute("/");
    const preview = elements(
      page.document,
      (element) => attribute(element, "data-catalog-preview") !== undefined,
    );
    expect(preview).toHaveLength(1);
    const previewRoot = required(preview[0], "homepage catalog preview");
    expect(attribute(previewRoot, "data-tool-count")).toBe(String(TOOL_COUNT));
    expect(attribute(previewRoot, "data-category-count")).toBe(
      String(CATEGORY_COUNT),
    );

    for (const [
      category,
      label,
      count,
      toolNames,
    ] of CATALOG_PREVIEW_CATEGORIES) {
      const row = elements(
        previewRoot,
        (element) =>
          attribute(element, "data-catalog-preview-row") !== undefined &&
          attribute(element, "data-category") === category,
      );
      expect(row).toHaveLength(1);
      const rowRoot = required(row[0], `${category} preview row`);
      expect(normalizedText(rowRoot)).toContain(label);
      expect(normalizedText(rowRoot)).toContain(String(count));
      for (const toolName of toolNames)
        expect(normalizedText(rowRoot)).toContain(toolName);
      expect(anchorHrefs(rowRoot)).toContain(
        `/reference/tools/#tool-group-${category}`,
      );
    }
  });
});

describe("client and installation recipe correspondence", () => {
  it("renders shared client recipes in the quick setup and detailed guide", async () => {
    const quick = await readRoute("/getting-started/");
    const detailed = await readRoute("/getting-started/clients/");
    const quickText = normalizedVisibleText(quick.document);
    const detailedText = normalizedVisibleText(detailed.document);
    const clientSetupRoot = elements(
      quick.document,
      (element) => attribute(element, "data-client-setups") !== undefined,
    );
    expect(clientSetupRoot).toHaveLength(1);

    for (const client of CLIENT_SETUPS as readonly ClientSetup[]) {
      const headingId = client.key === "vscode" ? "vs-code" : client.key;
      expect(findById(detailed.document, headingId)).toHaveLength(1);
      expect(quickText).toContain(client.label);
      expect(quickText).toContain(client.description);
      expect(quickText).toContain(client.configLocation);
      expect(detailedText).toContain(client.documentation.heading);
      expect(anchorHrefs(detailed.document)).toContain(client.docsUrl);
      for (const marker of ["TRANSPORT", "trello"]) {
        expect(client.code).toContain(marker);
        expect(quickText).toContain(marker);
        expect(detailedText).toContain(marker);
      }
      if (client.http) {
        expect(client.http.code).toContain("http://127.0.0.1:3000/mcp");
        expect(detailedText).toContain("http://127.0.0.1:3000/mcp");
      } else {
        expect(client.httpUnavailableNote).toBeDefined();
        expect(detailedText).toContain(client.httpUnavailableNote ?? "");
      }
    }
    expect(quick.source.match(/aria-labelledby="no-script-/g)).toHaveLength(
      CLIENT_SETUPS.length,
    );
  });

  it("renders every install method from shared setup data", async () => {
    const page = await readRoute("/getting-started/");
    const text = normalizedText(page.document);
    for (const method of INSTALL_METHODS) {
      expect(text).toContain(method.label);
      expect(text).toContain(method.title);
      expect(anchorHrefs(page.document)).toContain(`/${method.href}`);
      for (const marker of method.key === "stdio"
        ? ["TRANSPORT", "stdio", "/absolute/path/to/trello-mcp/dist/index.js"]
        : ["127.0.0.1", "docker compose"]) {
        expect(method.code).toContain(marker);
        expect(text).toContain(marker);
      }
    }
    expect(JSON.parse(VERIFY_EXAMPLE)).toEqual({
      id: "member-id",
      username: "your-username",
      fullName: "Your Name",
    });
  });

  it("keeps client icons package-generated and mapped to semantic keys", async () => {
    const css = await readDist("client-icons.css");
    for (const [name, [prefix, iconName]] of Object.entries(
      CLIENT_ICON_SOURCES,
    )) {
      expect(css).toContain(`/* ${name}: ${prefix} ${iconName} */`);
      expect(css).toContain(`--client-icon-${name}:`);
    }
    expect(css.match(/data:image\/svg\+xml/g)).toHaveLength(6);
    expect(css).not.toContain("/client-icons/");
  });
});
