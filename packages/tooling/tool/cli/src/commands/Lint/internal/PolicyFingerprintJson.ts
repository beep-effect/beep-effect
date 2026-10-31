/**
 * JSON edits for the policy fingerprint writer, laid out the way the
 * repository's Biome JSON formatter prints them.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, Str } from "@beep/utils";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as jsonc from "jsonc-parser";

const FORMATTING = { formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" } } as const;
// The repository's Biome JSON line width.
const JSON_LINE_WIDTH = 80;

const isScalar = (value: unknown) => !P.isObject(value) || value === null;

// A trailing comma counts toward the width of the line it ends.
const trailingWidth = (index: number, length: number) => (index === length - 1 ? 0 : 1);

const renderArray = (values: ReadonlyArray<unknown>, indent: string, column: number, trailing: number): string => {
  if (A.isReadonlyArrayEmpty(values)) return "[]";
  const inner = `${indent}  `;
  const inline = `[${A.join(
    A.map(values, (item) => renderJson(item, inner, inner.length, 1)),
    ", "
  )}]`;
  if (A.every(values, isScalar) && column + inline.length + trailing <= JSON_LINE_WIDTH) return inline;
  const lines = A.map(
    values,
    (item, index) => `${inner}${renderJson(item, inner, inner.length, trailingWidth(index, values.length))}`
  );
  return `[\n${A.join(lines, ",\n")}\n${indent}]`;
};

const renderObject = (record: Readonly<Record<string, unknown>>, indent: string): string => {
  const entries = R.toEntries(record);
  if (A.isReadonlyArrayEmpty(entries)) return "{}";
  const lines = A.map(entries, ([key, member], index) => {
    const prefix = `${indent}  ${JSON.stringify(key)}: `;
    return `${prefix}${renderJson(member, `${indent}  `, prefix.length, trailingWidth(index, entries.length))}`;
  });
  return `{\n${A.join(lines, ",\n")}\n${indent}}`;
};

// Objects expanded; an array of scalars inline when it fits the line width
// (counting the comma that follows it), otherwise one element per line.
const renderJson = (value: unknown, indent: string, column: number, trailing: number): string => {
  if (A.isArray(value)) return renderArray(value, indent, column, trailing);
  if (P.isObject(value) && value !== null) return renderObject(value as Readonly<Record<string, unknown>>, indent);
  return JSON.stringify(value);
};

/**
 * Render a whole JSON document the way the repository's Biome formatter prints it.
 *
 * **Example** (Render a short array inline)
 *
 * ```ts
 * import { renderJsonDocument } from "@beep/repo-cli/test/Lint"
 *
 * console.log(renderJsonDocument({ a: ["x", "y"] })) // {\n  "a": ["x", "y"]\n}
 * ```
 *
 * @param value - Any JSON-compatible value, typically an encoded schema value.
 * @returns The formatted document, without a trailing newline.
 * @internal
 * @category rendering
 * @since 0.0.0
 */
export const renderJsonDocument = (value: unknown): string => renderJson(value, "", 0, 0);

/**
 * An insertion index after the last owned property that sorts before `key`,
 * so generated properties stay grouped and ordered.
 *
 * @param owned - Whether a property belongs to the generated group.
 * @returns A callback taking the inserted key and returning a `jsonc` insertion-index callback.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const insertAfterOwned =
  (owned: (property: string) => boolean) =>
  (key: string) =>
  (properties: Array<string>): number =>
    O.match(
      A.findLastIndex(properties, (property) => owned(property) && property <= key),
      { onNone: () => properties.length, onSome: (index) => index + 1 }
    );

/** One {@link modifyJson} edit. */
interface JsonEdit {
  readonly insertion?: ((properties: Array<string>) => number) | undefined;
  readonly path: jsonc.JSONPath;
  readonly text: string;
  readonly value: unknown;
}

// Re-lay the node at `path` out the way Biome would print it.
const relayout = (text: string, path: jsonc.JSONPath, value: unknown): string => {
  const tree = jsonc.parseTree(text);
  const node = tree === undefined ? undefined : jsonc.findNodeAtLocation(tree, path);
  if (node === undefined) return text;
  const before = Str.slice(0, node.offset)(text);
  const start = O.match(Str.lastIndexOf("\n")(before), { onNone: () => 0, onSome: (index) => index + 1 });
  const indent = O.getOrElse(
    O.map(Str.match(/^ */)(Str.slice(start)(before)), (match) => match[0]),
    () => ""
  );
  const after = Str.slice(node.offset + node.length)(text);
  const trailing = Str.startsWith(",")(Str.trimStart(after)) ? 1 : 0;
  return `${before}${renderJson(value, indent, node.offset - start, trailing)}${after}`;
};

/**
 * Set (or with `undefined`, remove) the value at a JSON path, keeping every
 * other byte of the document, and lay the written value out as Biome would.
 *
 * @param edit - The document text, property path, new value (`undefined`
 *   removes the property) and, for a new property, where it goes among its siblings.
 * @returns The edited document.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const modifyJson = ({ text, path, value, insertion }: JsonEdit): string => {
  const options = insertion === undefined ? FORMATTING : { ...FORMATTING, getInsertionIndex: insertion };
  const next = jsonc.applyEdits(text, jsonc.modify(text, path, value, options));
  return value === undefined ? next : relayout(next, path, value);
};
