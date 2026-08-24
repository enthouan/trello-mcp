import { z } from "zod";
import type { ToolDefinition } from "../../src/utils/tool.js";

export const DOCKER_REGISTRY_EXCLUDED_TOOL_NAMES = [
  "card_attachment_upload",
] as const;

export type DockerRegistryToolArgument = {
  name: string;
  type: string;
  items?: { type: string };
  desc: string;
  optional?: true;
};

export type DockerRegistryTool = {
  name: string;
  description: string;
  arguments?: DockerRegistryToolArgument[];
};

type JsonSchema = {
  type?: unknown;
  properties?: Record<string, unknown>;
  required?: unknown;
  description?: unknown;
  items?: unknown;
};

function compareNames(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function objectValue(value: unknown, label: string): JsonSchema {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON Schema object.`);
  }
  return value as JsonSchema;
}

function descriptionWithoutArgumentBlock(description: string): string {
  const lines: string[] = [];
  for (const line of description.split("\n")) {
    if (line.trimStart().toLowerCase().startsWith("args:")) break;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

function argumentDescription(
  name: string,
  property: JsonSchema,
  toolDescription: string,
): string {
  if (
    typeof property.description === "string" &&
    property.description.trim() !== ""
  ) {
    return property.description.trim();
  }

  const prefix = `${name}:`;
  const fallback = toolDescription
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith(prefix.toLowerCase()))
    ?.slice(prefix.length)
    .trim();

  return nonEmpty(fallback, `Description for argument ${name}`);
}

function compactType(property: JsonSchema): string {
  return typeof property.type === "string" && property.type.trim() !== ""
    ? property.type
    : "string";
}

function compactItems(property: JsonSchema): { type: string } {
  const items =
    typeof property.items === "object" &&
    property.items !== null &&
    !Array.isArray(property.items)
      ? (property.items as JsonSchema)
      : undefined;

  return { type: items ? compactType(items) : "string" };
}

function inputJsonSchema(tool: ToolDefinition): JsonSchema {
  return z.toJSONSchema(tool.inputSchema, { io: "input" }) as JsonSchema;
}

function compactArguments(tool: ToolDefinition): DockerRegistryToolArgument[] {
  const inputSchema = inputJsonSchema(tool);
  const properties = inputSchema.properties ?? {};
  const required = new Set(
    Array.isArray(inputSchema.required)
      ? inputSchema.required.map((name) =>
          nonEmpty(name, `Required property name for tool ${tool.name}`),
        )
      : [],
  );
  const propertyNames = Object.keys(properties);
  const requiredNames = propertyNames
    .filter((name) => required.has(name))
    .sort(compareNames);
  const optionalNames = propertyNames
    .filter((name) => !required.has(name))
    .sort(compareNames);

  return [...requiredNames, ...optionalNames].map((name) => {
    const argumentName = nonEmpty(name, `Argument name for tool ${tool.name}`);
    const property = objectValue(
      properties[name],
      `Schema for argument ${tool.name}.${argumentName}`,
    );
    const type = nonEmpty(
      compactType(property),
      `Type for argument ${tool.name}.${argumentName}`,
    );
    const argument: DockerRegistryToolArgument = {
      name: argumentName,
      type,
      ...(type === "array" ? { items: compactItems(property) } : {}),
      desc: argumentDescription(argumentName, property, tool.description),
      ...(!required.has(argumentName) ? { optional: true as const } : {}),
    };

    nonEmpty(argument.desc, `Description for argument ${tool.name}.${name}`);
    if (argument.items) {
      nonEmpty(
        argument.items.type,
        `Item type for argument ${tool.name}.${name}`,
      );
    }
    return argument;
  });
}

export function selectDockerRegistryTools(
  tools: readonly ToolDefinition[],
): ToolDefinition[] {
  const seen = new Set<string>();
  for (const tool of tools) {
    const name = nonEmpty(tool.name, "Tool name");
    nonEmpty(tool.description, `Description for tool ${name}`);
    if (seen.has(name)) {
      throw new Error(`Duplicate tool name: ${name}`);
    }
    seen.add(name);
  }

  for (const excludedName of DOCKER_REGISTRY_EXCLUDED_TOOL_NAMES) {
    const matches = tools.filter((tool) => tool.name === excludedName).length;
    if (matches !== 1) {
      throw new Error(
        `Expected excluded tool ${excludedName} exactly once; found ${matches}.`,
      );
    }
  }

  const excluded = new Set<string>(DOCKER_REGISTRY_EXCLUDED_TOOL_NAMES);
  return tools
    .filter((tool) => !excluded.has(tool.name))
    .slice()
    .sort((left, right) => compareNames(left.name, right.name));
}

export function generateDockerRegistryTools(
  tools: readonly ToolDefinition[],
): DockerRegistryTool[] {
  return selectDockerRegistryTools(tools).map((tool) => {
    const name = nonEmpty(tool.name, "Tool name");
    const description = nonEmpty(
      descriptionWithoutArgumentBlock(tool.description),
      `Description for tool ${name}`,
    );
    const arguments_ = compactArguments(tool);

    return {
      name,
      description,
      ...(arguments_.length > 0 ? { arguments: arguments_ } : {}),
    };
  });
}

export function renderDockerRegistryTools(
  tools: readonly ToolDefinition[],
): string {
  return `${JSON.stringify(generateDockerRegistryTools(tools), null, 2)}\n`;
}
