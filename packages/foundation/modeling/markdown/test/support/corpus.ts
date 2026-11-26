/**
 * Test data loaders for the vendored CommonMark, GFM and mdast conformance
 * corpora.
 *
 * The corpora live under `data/conformance/` (see the VENDORED.md beside each
 * one) and are exported as `@beep/markdown/conformance/*` JSON subpaths for
 * other workspace packages. Inside this package Vite's glob import inlines
 * their raw text at transform time, so loading them needs no filesystem.
 *
 * - `commonmark/spec.json`: one entry per embedded CommonMark 0.31.2 spec
 *   example.
 * - `gfm/spec-extensions.json` and `gfm/extensions.json`: the
 *   extension-section examples from cmark-gfm's `spec.txt` and the full
 *   `extensions.txt` corpus (including the only official footnote examples).
 * - `mdast/<name>.md` and `mdast/<name>.json`: source and reference tree
 *   pairs from `mdast-util-from-markdown`.
 */

import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const CONFORMANCE_ROOT = "../../data/conformance/";

const specCorpora = import.meta.glob<string>("../../data/conformance/{commonmark,gfm}/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
});

const mdastSources = import.meta.glob<string>("../../data/conformance/mdast/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const mdastTrees = import.meta.glob<string>("../../data/conformance/mdast/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
});

const conformanceText = (files: Record<string, string>, relative: string): string =>
  O.getOrThrowWith(R.get(files, `${CONFORMANCE_ROOT}${relative}`), () => new Error(`no conformance file ${relative}`));

/**
 * A single spec conformance example. Upstream's `start_line`/`end_line` are
 * dropped at decode time because nothing under `test/` consumes them.
 */
export class SpecExample extends S.Opaque<SpecExample, { readonly brand: unique symbol }>()(
  S.Struct({
    example: S.Finite,
    html: S.String,
    markdown: S.String,
    section: S.String,
  })
) {}

const decodeExamples = SpecExample.pipe(S.Array, S.fromJsonString, S.decodeResult);
const decodeTree = S.Unknown.pipe(S.fromJsonString, S.decodeResult);

const loadExamples = (relative: string): ReadonlyArray<SpecExample> =>
  Result.getOrThrow(decodeExamples(conformanceText(specCorpora, relative)));

/**
 * Load the 652-example CommonMark 0.31.2 conformance corpus from the
 * vendored `spec.json` fixture.
 */
export const loadSpecExamples = (): ReadonlyArray<SpecExample> => loadExamples("commonmark/spec.json");

/**
 * Load the 22-example GFM extension-section conformance corpus (Tables,
 * Strikethrough, Autolinks, Disallowed Raw HTML) from the vendored
 * `spec-extensions.json` fixture. See `gfm/VENDORED.md` for the extraction
 * method and the discrepancy against the P2 plan's 24-example estimate (the
 * "Task list items (extension)" section's two examples are marked disabled
 * upstream and excluded).
 */
export const loadGfmSpecExtensionExamples = (): ReadonlyArray<SpecExample> => loadExamples("gfm/spec-extensions.json");

/**
 * Load the 30-example `extensions.txt` conformance corpus (Tables,
 * Strikethroughs, Autolinks, HTML tag filter, Footnotes, Interop, Task
 * lists; the only official footnote corpus) from the vendored
 * `extensions.json` fixture.
 */
export const loadGfmExtensionsExamples = (): ReadonlyArray<SpecExample> => loadExamples("gfm/extensions.json");

class MdastFixturePair extends S.Opaque<MdastFixturePair, { readonly brand: unique symbol }>()(
  S.Struct({
    markdown: S.String,
    name: S.String,
    tree: S.Unknown,
  })
) {}

const MDAST_ROOT = `${CONFORMANCE_ROOT}mdast/`;

const isFixtureSource = (path: string): boolean => path !== `${MDAST_ROOT}VENDORED.md`;

/**
 * Load the 27 position-complete `.md`/`.json` interop fixture pairs vendored
 * from `mdast-util-from-markdown@2.0.3` (see `mdast/VENDORED.md`). Each pair
 * carries the fixture's markdown source and the reference mdast tree the
 * upstream utility produces for it, positions included.
 */
export const loadMdastFixturePairs = (): ReadonlyArray<MdastFixturePair> =>
  pipe(
    R.keys(mdastSources),
    A.filter(isFixtureSource),
    A.map(Str.slice(MDAST_ROOT.length, -".md".length)),
    A.sort(Order.String),
    A.map((name) =>
      MdastFixturePair.make({
        name,
        markdown: conformanceText(mdastSources, `mdast/${name}.md`),
        tree: Result.getOrThrow(decodeTree(conformanceText(mdastTrees, `mdast/${name}.json`))),
      })
    )
  );
