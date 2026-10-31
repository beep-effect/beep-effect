/**
 * A table of contents over a document's headings: the entries (text, slug,
 * depth, duplicate ordinal) and their rendering as a nested bullet list of
 * `[title](#slug)` links, in the shape `markdown-toc` produces.
 *
 * **Details**
 *
 * Entries come from `MarkdownDocument.headings`, so headings nested in
 * blockquotes and list items count, in document order. When the document
 * carries the TOC marker (an HTML comment whose text is `toc`; see
 * `MarkdownToc.marker`), only the headings that start after the line
 * following the block that holds the last marker are listed; a document
 * without one lists every heading. Duplicate headings (same text once
 * lower-cased) are numbered from their second occurrence on, so their slugs
 * stay distinct. Rendering indents each entry by its depth above the
 * shallowest listed heading, two spaces per level by default, and drops
 * entries deeper than `maxDepth` (six, so nothing by default).
 *
 * **Gotchas**
 *
 * The marker is matched in the source of any paragraph, heading, raw HTML
 * or code block, as `markdown-toc` does, so a code block that quotes the
 * marker also moves the boundary (the examples below build it from parts for
 * that reason: a docgen page is itself TOC input). The slug and title of a heading
 * that opens with a `[text](` link come from that link's text, not the whole
 * heading. Heading text is read as written: a tab inside a heading becomes
 * `--` in the slug, where `markdown-toc`'s parser expanded it to spaces
 * first.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $MarkdownId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { MarkdownDocument } from "./MarkdownDocument.ts";
import { BulletChar, HeadingDepth } from "./MarkdownNode.ts";
import { HeadingSlug, MarkdownSlug } from "./MarkdownSlug.ts";
import type { MarkdownParseError } from "./Markdown.ts";
import type { MarkdownNode } from "./MarkdownNode.ts";

const $I = $MarkdownId.create("MarkdownToc");

const Ordinal = S.Int.pipe(S.check(S.isGreaterThanOrEqualTo(0)));

/**
 * One table-of-contents entry: a heading's content as written, its anchor
 * slug, its depth, its position among the document's headings and how many
 * earlier headings share its text.
 *
 * **Example** (Read the entries of a short document)
 *
 * ```ts
 * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
 * import { MarkdownToc } from "@beep/markdown/MarkdownToc";
 * import * as Effect from "effect/Effect";
 *
 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\n## Usage\n\n## Usage\n"));
 * const entries = MarkdownToc.entries(doc);
 * console.log(entries.map((entry) => entry.slug).join(" ")) // title usage usage-1
 * console.log(entries[2]?.occurrence) // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TocEntry extends S.Opaque<TocEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.pipe(
      $I.annoteKey("TocEntry.text", {
        description: "The heading content as written in the source, its lines joined by MarkdownSlug.headingLine",
      })
    ),
    slug: HeadingSlug.pipe($I.annoteKey("TocEntry.slug", { description: "The anchor slug the entry links to" })),
    depth: HeadingDepth.pipe($I.annoteKey("TocEntry.depth", { description: "The heading depth, 1 to 6" })),
    index: Ordinal.pipe(
      $I.annoteKey("TocEntry.index", {
        description: "Zero-based position of the heading among all of the document's headings, listed or not",
      })
    ),
    occurrence: Ordinal.pipe(
      $I.annoteKey("TocEntry.occurrence", {
        description: "How many earlier listed headings share this heading's lower-cased text; 0 for the first",
      })
    ),
  }).pipe(
    $I.annoteSchema("TocEntry", {
      description:
        "One table-of-contents entry: heading text as written, anchor slug, depth, document-wide heading index and duplicate ordinal.",
    })
  )
) {}

/**
 * Rendering options for {@link MarkdownToc.renderEntries}: the bullet
 * character, the indentation unit, the deepest heading listed and whether
 * entries are links. Every field is optional; an explicit `undefined` is
 * rejected.
 *
 * **Example** (Render plain-text entries with asterisks)
 *
 * ```ts
 * import { MarkdownToc, TocOptions } from "@beep/markdown/MarkdownToc";
 * import * as Result from "effect/Result";
 *
 * const options = TocOptions.make({ bullet: "*", linkify: false });
 * console.log(Result.getOrThrow(MarkdownToc.renderResult("# A\n\n## B\n", options))) // * A\n  * B
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TocOptions extends S.Opaque<TocOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    bullet: S.optionalKey(BulletChar).pipe(
      $I.annoteKey("TocOptions.bullet", { description: "The list bullet of every entry; `-` by default" })
    ),
    indent: S.optionalKey(S.String).pipe(
      $I.annoteKey("TocOptions.indent", {
        description:
          "The indentation unit repeated once per depth level below the shallowest entry; two spaces by default",
      })
    ),
    maxDepth: S.optionalKey(HeadingDepth).pipe(
      $I.annoteKey("TocOptions.maxDepth", { description: "The deepest heading depth still listed; 6 by default" })
    ),
    linkify: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("TocOptions.linkify", {
        description: "Whether an entry renders as a `[title](#slug)` link (the default) or as its text as written",
      })
    ),
  }).pipe(
    $I.annoteSchema("TocOptions", {
      description:
        "Table-of-contents rendering options: bullet character, indentation unit, deepest listed depth, linkify.",
    })
  )
) {}

/**
 * The plain input shape of {@link TocOptions}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TocOptions {
  /**
   * Plain rendering options; every field optional.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly bullet?: BulletChar;
    readonly indent?: string;
    readonly linkify?: boolean;
    readonly maxDepth?: HeadingDepth;
  }
}

const TOC_MARKER = /<!--[ \t]*toc[ \t]*-->/;

// The blocks whose source `markdown-toc` tests for the marker: a paragraph or
// heading (its `inline` token), raw HTML and code (indented or fenced).
const isMarkerHolderType = S.is(S.Literals(["paragraph", "heading", "html", "code"]));

const nodeSource = (document: MarkdownDocument, node: MarkdownNode): string =>
  Str.slice(node.position.start.offset, node.position.end.offset)(document.source);

const byEndLine = Order.mapInput(Order.Number, (node: MarkdownNode) => node.position.end.line);

// The last line of the last block holding a marker. An inline `html` node
// inside a paragraph matches beside its paragraph; the maximum keeps the
// paragraph's own end line. Mirrors `markdown-toc`'s `tocstart`.
const markerBoundary = (document: MarkdownDocument): O.Option<number> =>
  A.match(
    document.findAll((node) => isMarkerHolderType(node.type) && TOC_MARKER.test(nodeSource(document, node))),
    {
      onEmpty: O.none<number>,
      onNonEmpty: (holders) => O.some(A.max(holders, byEndLine).position.end.line),
    }
  );

const byDepth = Order.mapInput(Order.Number, (entry: TocEntry) => entry.depth);

/**
 * The table-of-contents facade: {@link MarkdownToc.entries} lists a parsed
 * document's headings, {@link MarkdownToc.renderEntries} renders a list, and
 * {@link MarkdownToc.render} / {@link MarkdownToc.renderResult} do both from
 * source.
 *
 * **Example** (Render the TOC of a module page)
 *
 * ```ts
 * import { MarkdownToc } from "@beep/markdown/MarkdownToc";
 * import * as Effect from "effect/Effect";
 *
 * const marker = ["<!--", "toc", "-->"].join(" ");
 * const source = `## Intro\n\n${marker}\n\n# models\n\n## Point\n\n## Point\n`;
 * console.log(Effect.runSync(MarkdownToc.render(source, { bullet: "-" })))
 * // - [models](#models)
 * //   - [Point](#point)
 * //   - [Point](#point-1)
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export abstract class MarkdownToc {
  /**
   * The marker a document places where its table of contents goes: an HTML
   * comment whose text is `toc`, with optional spaces or tabs inside.
   *
   * **Example** (Test for the marker)
   *
   * ```ts
   * import { MarkdownToc } from "@beep/markdown/MarkdownToc";
   *
   * console.log(MarkdownToc.marker.test(["<!--", "toc", "-->"].join("  "))) // true
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly marker: RegExp = TOC_MARKER;

  /**
   * The entries of a parsed document: every heading that starts after the
   * line following the marker's block (every heading when there is no
   * marker), in document order, with duplicate ordinals and slugs assigned.
   *
   * **Details**
   *
   * `index` counts all headings in the document, listed or not, so an entry
   * can be traced back to `document.headings`. `occurrence` counts earlier
   * listed headings with the same lower-cased text. The text is the heading
   * as written with its lines joined (`MarkdownSlug.headingLine`), so a
   * multi-line setext heading counts with its one-line twin. The slug is
   * `MarkdownSlug.slugify` of that text, so a heading opening with a
   * `[text](` link slugs its link text.
   *
   * **Example** (Headings before the marker are not listed)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import { MarkdownToc } from "@beep/markdown/MarkdownToc";
   * import * as Effect from "effect/Effect";
   *
   * const marker = ["<!--", "toc", "-->"].join(" ");
   * const doc = Effect.runSync(MarkdownDocument.parse(`# Intro\n\n${marker}\n\n## Usage\n`));
   * console.log(MarkdownToc.entries(doc).map((entry) => `${entry.index}:${entry.slug}`).join(" ")) // 1:usage
   * ```
   *
   * @param document - A parsed document.
   * @returns The entries, in document order.
   * @category utilities
   * @since 0.0.0
   */
  static readonly entries = (document: MarkdownDocument): ReadonlyArray<TocEntry> => {
    const boundary = markerBoundary(document);
    const listed = A.filter(
      A.map(document.headings, (heading, index) => ({ heading, index })),
      ({ heading }) => O.isNone(boundary) || heading.node.position.start.line > boundary.value + 1
    );
    const [, entries] = A.mapAccum(listed, HashMap.empty<string, number>(), (seen, { heading, index }) => {
      const text = MarkdownSlug.headingLine(document.headingSource(heading.node));
      const key = Str.toLowerCase(text);
      const occurrence = O.match(HashMap.get(seen, key), { onNone: () => 0, onSome: (count) => count + 1 });
      const entry = TocEntry.make({
        text,
        slug: MarkdownSlug.slugify(text, occurrence),
        depth: heading.depth,
        index,
        occurrence,
      });
      return [HashMap.set(seen, key, occurrence), entry];
    });
    return entries;
  };

  /**
   * Render entries as a nested bullet list, one line per entry, joined with
   * `\n` and without a trailing newline (`""` for no entries).
   *
   * **Details**
   *
   * An entry is indented `indent` once per depth level below the shallowest
   * entry (computed before `maxDepth` drops any), then `bullet`, a space, and
   * either `[title](#slug)` — the title from `MarkdownSlug.titleize`, the
   * anchor from `MarkdownSlug.anchor` — or, with `linkify: false`, the text
   * as written.
   *
   * **Example** (Deeper headings indent under the shallowest)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import { MarkdownToc } from "@beep/markdown/MarkdownToc";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("## A\n\n### B\n\n#### C\n"));
   * console.log(MarkdownToc.renderEntries(MarkdownToc.entries(doc), { maxDepth: 3 }))
   * // - [A](#a)
   * //   - [B](#b)
   * ```
   *
   * @param entries - Entries from {@link MarkdownToc.entries}.
   * @param options - Rendering options; see {@link TocOptions}.
   * @returns The rendered list.
   * @category utilities
   * @since 0.0.0
   */
  static readonly renderEntries = (entries: ReadonlyArray<TocEntry>, options?: TocOptions.Encoded): string => {
    const bullet = options?.bullet ?? "-";
    const indent = options?.indent ?? "  ";
    const maxDepth = options?.maxDepth ?? 6;
    const linkify = options?.linkify ?? true;
    const shallowest = A.match(entries, {
      onEmpty: () => 0,
      onNonEmpty: (nonEmpty) => A.min(nonEmpty, byDepth).depth,
    });
    const lines = A.map(
      A.filter(entries, (entry) => entry.depth <= maxDepth),
      (entry) =>
        `${Str.repeat(entry.depth - shallowest)(indent)}${bullet} ${
          linkify ? `[${MarkdownSlug.titleize(entry.text)}](${MarkdownSlug.anchor(entry.slug)})` : entry.text
        }`
    );
    return A.join(lines, "\n");
  };

  /**
   * Parse `source` and render its table of contents, as a `Result`.
   *
   * **Details**
   *
   * The parse is the default GFM dialect with frontmatter capture on, so an
   * opening `---`/`+++`/`---json` block contributes no heading (CommonMark
   * would otherwise read a multi-line YAML block closed by `---` as a setext
   * heading). To list headings from a document parsed differently, use
   * {@link MarkdownToc.entries} on it.
   *
   * **Example** (Render synchronously)
   *
   * ```ts
   * import { MarkdownToc } from "@beep/markdown/MarkdownToc";
   * import * as Result from "effect/Result";
   *
   * console.log(Result.getOrThrow(MarkdownToc.renderResult("# One\n\n## Two\n"))) // - [One](#one)\n  - [Two](#two)
   * ```
   *
   * @param source - The markdown source.
   * @param options - Rendering options; see {@link TocOptions}.
   * @returns The rendered list, or the parse failure.
   * @category utilities
   * @since 0.0.0
   */
  static readonly renderResult = (
    source: string,
    options?: TocOptions.Encoded
  ): Result.Result<string, MarkdownParseError> =>
    Result.map(MarkdownDocument.parseResult(source, { frontmatter: true }), (document) =>
      MarkdownToc.renderEntries(MarkdownToc.entries(document), options)
    );

  /**
   * Parse `source` and render its table of contents, as an `Effect`. Defined
   * in terms of {@link MarkdownToc.renderResult}.
   *
   * **Example** (Render inside an Effect program)
   *
   * ```ts
   * import { MarkdownToc } from "@beep/markdown/MarkdownToc";
   * import * as Effect from "effect/Effect";
   *
   * console.log(Effect.runSync(MarkdownToc.render("# One\n\n## Two\n", { bullet: "*" }))) // * [One](#one)\n  * [Two](#two)
   * ```
   *
   * @param source - The markdown source.
   * @param options - Rendering options; see {@link TocOptions}.
   * @returns An `Effect` that succeeds with the rendered list, or fails with
   *   `MarkdownParseError`.
   * @category utilities
   * @since 0.0.0
   */
  static readonly render = Effect.fn("MarkdownToc.render")(
    (source: string, options?: TocOptions.Encoded): Effect.Effect<string, MarkdownParseError> =>
      Effect.fromResult(MarkdownToc.renderResult(source, options))
  );
}
