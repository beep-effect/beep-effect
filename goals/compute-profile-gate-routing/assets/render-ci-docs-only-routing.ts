#!/usr/bin/env bun
/**
 * Regenerate the acceptance diagram with Graphviz and the repository SVG checks.
 *
 * Usage: bun goals/compute-profile-gate-routing/assets/render-ci-docs-only-routing.ts
 *
 * Reproduces the former Python renderer byte for byte: it parses `dot -Tsvg_inline`, drops
 * comments, adds the accessible title, and re-serializes with Python ElementTree's `indent`
 * and serialization rules, then runs Biome over the written file.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Element = {
  readonly tag: string;
  readonly attributes: Array<[string, string]>;
  readonly children: Array<Element>;
  text: string | null;
  tail: string | null;
};

const element = (tag: string, attributes: Array<[string, string]> = []): Element => ({
  tag,
  attributes,
  children: [],
  text: null,
  tail: null,
});

const decode = (raw: string): string =>
  raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[entity] ?? "";
  });

/** Parse the well-formed SVG dot emits, keeping text and tails as ElementTree does; comments vanish. */
const parse = (xml: string): Element => {
  const stack: Array<Element> = [];
  let root: Element | null = null;
  let last: Element | null = null; // the most recently closed child, whose tail receives text
  let index = 0;
  const appendText = (raw: string) => {
    const text = decode(raw);
    const parent = stack.at(-1);
    if (parent === undefined || text === "") return;
    if (last !== null) last.tail = (last.tail ?? "") + text;
    else parent.text = (parent.text ?? "") + text;
  };
  while (index < xml.length) {
    const open = xml.indexOf("<", index);
    if (open === -1) {
      appendText(xml.slice(index));
      break;
    }
    appendText(xml.slice(index, open));
    if (xml.startsWith("<!--", open)) {
      index = xml.indexOf("-->", open) + 3;
    } else if (xml.startsWith("<?", open)) {
      index = xml.indexOf("?>", open) + 2;
    } else if (xml.startsWith("<!", open)) {
      index = xml.indexOf(">", open) + 1;
    } else if (xml.startsWith("</", open)) {
      index = xml.indexOf(">", open) + 1;
      last = stack.pop() ?? null;
    } else {
      const close = xml.indexOf(">", open);
      const selfClosing = xml[close - 1] === "/";
      const body = xml.slice(open + 1, selfClosing ? close - 1 : close);
      const tag = body.match(/^[^\s/>]+/)?.[0] ?? "";
      const attributes: Array<[string, string]> = [];
      for (const match of body.slice(tag.length).matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        const name = match[1] ?? "";
        if (name === "xmlns" || name.startsWith("xmlns:")) {
          throw new Error(`Unsupported namespace declaration ${name}: ElementTree would rewrite prefixes`);
        }
        if (name.includes(":") && !name.startsWith("xml:")) {
          // dot's svg_inline emits xlink: attributes (tooltips, URLs) without declaring the prefix.
          throw new Error(`Unbound prefix in attribute ${name}`);
        }
        // XML attribute-value normalization turns literal tab, newline and carriage return into spaces.
        attributes.push([name, decode((match[2] ?? match[3] ?? "").replace(/[\t\n\r]/g, " "))]);
      }
      const child = element(tag, attributes);
      const parent = stack.at(-1);
      if (parent === undefined) root ??= child;
      else parent.children.push(child);
      stack.push(child);
      last = null;
      if (selfClosing) last = stack.pop() ?? null;
      index = close + 1;
    }
  }
  if (root === null) throw new Error("No root element in Graphviz output");
  return root;
};

const isBlank = (text: string | null): boolean => text === null || text.trim() === "";

/** ElementTree.indent(root, space="  "). */
const indent = (root: Element, space = "  ") => {
  const indentChildren = (parent: Element, level: number) => {
    const childIndentation = `\n${space.repeat(level + 1)}`;
    if (isBlank(parent.text)) parent.text = childIndentation;
    for (const child of parent.children) {
      if (child.children.length > 0) indentChildren(child, level + 1);
      if (isBlank(child.tail)) child.tail = childIndentation;
    }
    const lastChild = parent.children.at(-1);
    if (lastChild !== undefined && isBlank(lastChild.tail)) lastChild.tail = `\n${space.repeat(level)}`;
  };
  if (root.children.length > 0) indentChildren(root, 0);
};

const escapeText = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const escapeAttribute = (value: string): string =>
  escapeText(value)
    .replaceAll('"', "&quot;")
    .replaceAll("\r", "&#13;")
    .replaceAll("\n", "&#10;")
    .replaceAll("\t", "&#09;");

/** ElementTree.tostring(root, encoding="unicode") with short empty elements. */
const serialize = (node: Element): string => {
  const attributes = node.attributes.map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join("");
  const body =
    node.text || node.children.length > 0
      ? `<${node.tag}${attributes}>${node.text ? escapeText(node.text) : ""}${node.children.map(serialize).join("")}</${node.tag}>`
      : `<${node.tag}${attributes} />`;
  return body + (node.tail ? escapeText(node.tail) : "");
};

const setAttribute = (node: Element, name: string, value: string) => {
  const existing = node.attributes.find(([key]) => key === name);
  if (existing === undefined) node.attributes.push([name, value]);
  else existing[1] = value;
};

const assets = import.meta.dirname;
const source = join(assets, "ci-docs-only-routing.dot");
const output = join(assets, "ci-docs-only-routing.svg");

const dot = spawnSync("dot", ["-Tsvg_inline", source], { encoding: "utf8" });
if (dot.error !== undefined || dot.status !== 0) {
  process.stderr.write(dot.stderr ?? "");
  throw dot.error ?? new Error(`dot exited with status ${dot.status}`);
}
const root = parse(dot.stdout);
setAttribute(root, "xmlns", "http://www.w3.org/2000/svg");
setAttribute(root, "role", "img");
setAttribute(root, "aria-labelledby", "docs-routing-title");
const title = element("title", [["id", "docs-routing-title"]]);
title.text = "Documentation routing skips product checks and retains security and repository checks";
root.children.unshift(title);
indent(root);
writeFileSync(output, `${serialize(root)}\n`, "utf8");

const biome = spawnSync("bunx", ["biome", "check", "--write", output], {
  cwd: resolve(assets, "..", "..", ".."),
  stdio: "inherit",
});
if (biome.error !== undefined || biome.status !== 0) {
  throw biome.error ?? new Error(`biome exited with status ${biome.status}`);
}
