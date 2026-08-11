import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { type DefaultTreeAdapterMap, parse } from "parse5";

export type HtmlNode = DefaultTreeAdapterMap["node"];
export type HtmlElement = DefaultTreeAdapterMap["element"];
export type HtmlDocument = DefaultTreeAdapterMap["document"];

export const repositoryRoot = fileURLToPath(
  new URL("../../..", import.meta.url),
);

export function routeOutputPath(route: string): URL {
  if (route === "/") {
    return new URL("../../dist/index.html", import.meta.url);
  }
  if (route.endsWith(".html")) {
    return new URL(`../../dist${route}`, import.meta.url);
  }
  return new URL(`../../dist${route}index.html`, import.meta.url);
}

export async function readRoute(route: string) {
  const source = await readFile(routeOutputPath(route), "utf8");
  return { document: parse(source), source };
}

export async function readDist(
  path: string,
  encoding: BufferEncoding = "utf8",
) {
  return readFile(new URL(`../../dist/${path}`, import.meta.url), encoding);
}

export async function readDistBuffer(path: string) {
  return readFile(new URL(`../../dist/${path}`, import.meta.url));
}

export function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Missing required ${label}`);
  return value;
}

export function elements(
  root: HtmlNode,
  predicate: (element: HtmlElement) => boolean = () => true,
): HtmlElement[] {
  const matches: HtmlElement[] = [];
  const visit = (node: HtmlNode) => {
    if ("tagName" in node && predicate(node)) matches.push(node);
    if ("childNodes" in node) {
      for (const child of node.childNodes) visit(child);
    }
    if ("content" in node) visit(node.content);
  };
  visit(root);
  return matches;
}

export function attribute(element: HtmlElement, name: string) {
  return element.attrs.find((candidate) => candidate.name === name)?.value;
}

export function hasClass(element: HtmlElement, className: string) {
  return attribute(element, "class")?.split(/\s+/).includes(className) ?? false;
}

export function textContent(node: HtmlNode): string {
  if ("value" in node && node.nodeName === "#text") return node.value;
  if (!("childNodes" in node)) return "";
  return node.childNodes.map(textContent).join("");
}

export function normalizedText(node: HtmlNode) {
  return textContent(node).replace(/\s+/g, " ").trim();
}

export function visibleText(node: HtmlNode): string {
  if ("value" in node && node.nodeName === "#text") return node.value;
  if ("tagName" in node) {
    if (["script", "style", "svg", "template"].includes(node.tagName))
      return "";
    if (node.tagName === "br") return " ";
  }
  if (!("childNodes" in node)) return "";
  return node.childNodes.map(visibleText).join(" ");
}

export function normalizedVisibleText(node: HtmlNode) {
  return visibleText(node).replace(/\s+/g, " ").trim();
}

export function findByAttribute(
  root: HtmlNode,
  tagName: string,
  attributeName: string,
  value?: string,
) {
  return elements(
    root,
    (element) =>
      element.tagName === tagName &&
      attribute(element, attributeName) !== undefined &&
      (value === undefined || attribute(element, attributeName) === value),
  );
}

export function findById(root: HtmlNode, id: string) {
  return elements(root, (element) => attribute(element, "id") === id);
}

export function metadataContent(
  document: HtmlDocument,
  attributeName: "name" | "property",
  attributeValue: string,
) {
  const matches = elements(
    document,
    (element) =>
      element.tagName === "meta" &&
      attribute(element, attributeName) === attributeValue,
  );
  return matches.map((element) => attribute(element, "content"));
}

export function linkHref(document: HtmlDocument, rel: string) {
  return elements(
    document,
    (element) =>
      element.tagName === "link" &&
      attribute(element, "rel")?.split(/\s+/).includes(rel) === true,
  ).map((element) => attribute(element, "href"));
}

export function anchorHrefs(root: HtmlNode) {
  return findByAttribute(root, "a", "href")
    .map((element) => attribute(element, "href"))
    .filter((href): href is string => href !== undefined);
}
