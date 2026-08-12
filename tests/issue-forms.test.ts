import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const templatesDirectory = new URL(
  "../.github/ISSUE_TEMPLATE/",
  import.meta.url,
);
const formNames = [
  "bug_report.yml",
  "documentation.yml",
  "feature_request.yml",
] as const;
const allowedFieldTypes = new Set([
  "markdown",
  "input",
  "textarea",
  "dropdown",
  "checkboxes",
  "upload",
]);
const fieldIdPattern = /^[A-Za-z0-9_-]+$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a YAML mapping.`);
  }
  return value as Record<string, unknown>;
}

async function template(name: string): Promise<Record<string, unknown>> {
  return record(
    parse(await readFile(new URL(name, templatesDirectory), "utf8")),
    name,
  );
}

function nonEmptyString(value: unknown, label: string): string {
  expect(value, label).toEqual(expect.any(String));
  const result = String(value);
  expect(result.trim(), label).not.toBe("");
  return result;
}

function stringArray(value: unknown, label: string): string[] {
  expect(Array.isArray(value), label).toBe(true);
  return (value as unknown[]).map((entry, index) =>
    nonEmptyString(entry, `${label} item ${index + 1}`),
  );
}

function validateOptions(
  value: unknown,
  label: string,
  objectOptions: boolean,
): void {
  expect(Array.isArray(value), label).toBe(true);
  expect((value as unknown[]).length, label).toBeGreaterThan(0);

  const optionLabels = (value as unknown[]).map((option, index) => {
    if (!objectOptions) {
      return nonEmptyString(option, `${label} item ${index + 1}`);
    }

    const entry = record(option, `${label} item ${index + 1}`);
    const optionLabel = nonEmptyString(
      entry.label,
      `${label} item ${index + 1} label`,
    );
    if (entry.required !== undefined) {
      expect(typeof entry.required).toBe("boolean");
    }
    return optionLabel;
  });

  expect(new Set(optionLabels).size, `${label} must be unique`).toBe(
    optionLabels.length,
  );
}

describe("GitHub issue forms", () => {
  it("parses the complete template set with unique field ids", async () => {
    const files = (await readdir(templatesDirectory))
      .filter((file) => /\.ya?ml$/i.test(file))
      .sort();
    expect(files).toEqual([
      "bug_report.yml",
      "config.yml",
      "documentation.yml",
      "feature_request.yml",
    ]);

    for (const name of formNames) {
      const form = await template(name);
      nonEmptyString(form.name, `${name} name`);
      nonEmptyString(form.description, `${name} description`);
      nonEmptyString(form.title, `${name} title`);
      stringArray(form.labels, `${name} labels`);
      expect(Array.isArray(form.body)).toBe(true);
      expect((form.body as unknown[]).length).toBeGreaterThan(0);

      const ids: string[] = [];
      const labels: string[] = [];
      let inputFieldCount = 0;
      for (const [index, value] of (form.body as unknown[]).entries()) {
        const field = record(value, `${name} body item ${index + 1}`);
        const fieldLabel = `${name} body item ${index + 1}`;
        const type = nonEmptyString(field.type, `${fieldLabel} type`);
        expect(allowedFieldTypes.has(type), `${fieldLabel} type`).toBe(true);
        const attributes = record(field.attributes, `${fieldLabel} attributes`);

        if (type === "markdown") {
          nonEmptyString(attributes.value, `${fieldLabel} value`);
          expect(field.id, `${fieldLabel} markdown id`).toBeUndefined();
        } else {
          inputFieldCount += 1;
          const id = nonEmptyString(field.id, `${fieldLabel} id`);
          expect(id, `${fieldLabel} id`).toMatch(fieldIdPattern);
          ids.push(id);
          labels.push(nonEmptyString(attributes.label, `${fieldLabel} label`));

          if (type === "dropdown") {
            validateOptions(attributes.options, `${fieldLabel} options`, false);
          } else if (type === "checkboxes") {
            validateOptions(attributes.options, `${fieldLabel} options`, true);
          }

          if (field.validations !== undefined) {
            const validations = record(
              field.validations,
              `${fieldLabel} validations`,
            );
            if (validations.required !== undefined) {
              expect(typeof validations.required).toBe("boolean");
            }
          }
        }
      }
      expect(inputFieldCount).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("keeps intake paths distinct and blank issues disabled", async () => {
    const config = await template("config.yml");
    expect(config.blank_issues_enabled).toBe(false);
    expect(Array.isArray(config.contact_links)).toBe(true);
    expect((config.contact_links as unknown[]).length).toBeGreaterThan(0);
    for (const [index, value] of (
      config.contact_links as unknown[]
    ).entries()) {
      const link = record(value, `contact link ${index + 1}`);
      nonEmptyString(link.name, `contact link ${index + 1} name`);
      const url = nonEmptyString(link.url, `contact link ${index + 1} url`);
      expect(() => new URL(url)).not.toThrow();
      expect(new URL(url).protocol).toBe("https:");
      nonEmptyString(link.about, `contact link ${index + 1} about`);
    }

    const forms = await Promise.all(formNames.map(template));
    expect(forms.map((form) => form.name)).toEqual([
      "Bug report",
      "Documentation issue",
      "Feature request",
    ]);
    expect(forms.flatMap((form) => form.labels as string[])).toEqual([
      "bug",
      "documentation",
      "enhancement",
    ]);
  });

  it("keeps the security fallback aligned across public intake guidance", async () => {
    const [support, security, bug, config] = await Promise.all([
      readFile(new URL("../SUPPORT.md", import.meta.url), "utf8"),
      readFile(new URL("../SECURITY.md", import.meta.url), "utf8"),
      readFile(new URL("bug_report.yml", templatesDirectory), "utf8"),
      readFile(new URL("config.yml", templatesDirectory), "utf8"),
    ]);

    for (const source of [support, security, bug, config]) {
      expect(source).toMatch(/short[^\n]*non-sensitive/i);
      expect(source).toMatch(/private reporting path|private reporting/i);
    }
    expect(support).toContain("Do not include vulnerability details");
    expect(bug).toContain("leave unrelated optional fields blank");
  });
});
