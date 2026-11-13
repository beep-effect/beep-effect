#!/usr/bin/env bun
/**
 * One-off extractor for the vendored GFM conformance corpora.
 *
 * Run by hand, never by CI and never by the test suite, with
 * `bun run generate:gfm-corpora` (or `bun run scripts/extract-gfm-corpora.ts`
 * from this package). It reads the pinned `.repos/cmark-gfm/test/` checkout;
 * pass `--cmark-gfm <dir>` to read another checkout of the same ref.
 *
 * The example-block scanner is a line-for-line port of upstream
 * `test/spec_tests.py`'s `get_tests` and `--dump-tests` path (the tool
 * `commonmark/spec_tests.py` also used to generate
 * `data/conformance/commonmark/spec.json`), so the output is byte-identical to
 * the former Python extractor that shelled out to it.
 *
 * Two corpora are produced:
 *
 * - `data/conformance/gfm/spec-extensions.json`: the examples embedded in
 *   `spec.txt` whose section header ends in "(extension)", selected with
 *   upstream's case-insensitive section-regex filter `\(extension\)$`.
 *   Upstream drops every example block marked "example disabled" before the
 *   filter sees it, so the two disabled "Task list items (extension)"
 *   examples are not part of this corpus (see VENDORED.md).
 * - `data/conformance/gfm/extensions.json`: every example in
 *   `extensions.txt`, with no section filter; it includes the only official
 *   footnote corpus.
 *
 * Both are written with the exact field set `data/conformance/commonmark/spec.json`
 * carries (`markdown`, `html`, `example`, `start_line`, `end_line`,
 * `section`), in Python `json.dumps(indent=2)` form: two-space indent and
 * ASCII-only output with `\uXXXX` escapes. Upstream's per-example
 * `extensions` flag array is dropped.
 *
 * @since 0.0.0
 */

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

/**
 * One conformance example, in the `data/conformance/commonmark/spec.json` field order.
 *
 * @since 0.0.0
 */
export const GfmExample = S.Struct({
  markdown: S.String,
  html: S.String,
  example: S.Int,
  start_line: S.Int,
  end_line: S.Int,
  section: S.String,
});

/**
 * The decoded type of {@link GfmExample}.
 *
 * @since 0.0.0
 */
export type GfmExample = typeof GfmExample.Type;

const CorpusJson = S.fromJsonString(S.Array(GfmExample), { space: 2 });
const encodeCorpus = S.encodeEffect(CorpusJson);

const FENCE = Str.repeat(32)("`");
const EXAMPLE_FENCE = `${FENCE} example`;
const HEADER = /^#+ /;
const HEADERS = /#+ /g;

// Python's str.strip() whitespace set (str.isspace): unlike JS \s it includes \x1c-\x1f and U+0085
// and excludes U+FEFF.
const PY_SPACE = "[\\t\\n\\v\\f\\r \\x1c-\\x1f\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]";
const pyStrip = Str.replace(new RegExp(`^${PY_SPACE}+|${PY_SPACE}+$`, "g"), "");

// Lines with their "\n" terminators, as Python iterates a file opened with newline="\n".
const linesOf = (text: string): ReadonlyArray<string> =>
  pipe(
    Str.match(/[^\n]*\n|[^\n]+$/g)(text),
    O.getOrElse((): ReadonlyArray<string> => [])
  );

type ScanState = {
  readonly mode: 0 | 1 | 2;
  readonly lineNumber: number;
  readonly startLine: number;
  readonly exampleNumber: number;
  readonly flags: ReadonlyArray<string>;
  readonly markdown: string;
  readonly html: string;
  readonly section: string;
  readonly examples: ReadonlyArray<GfmExample>;
};

const initialState: ScanState = {
  mode: 0,
  lineNumber: 0,
  startLine: 0,
  exampleNumber: 0,
  flags: [],
  markdown: "",
  html: "",
  section: "",
  examples: [],
};

const untab = Str.replaceAll("→", "\t");

const scanLine = (state: ScanState, line: string): ScanState => {
  const lineNumber = state.lineNumber + 1;
  const stripped = pyStrip(line);
  const next = { ...state, lineNumber };
  if (Str.startsWith(EXAMPLE_FENCE)(stripped)) {
    return {
      ...next,
      mode: 1,
      flags: A.filter(Str.split(Str.slice(EXAMPLE_FENCE.length)(stripped), /\s+/), Str.isNonEmpty),
    };
  }
  if (stripped === FENCE) {
    const exampleNumber = state.exampleNumber + 1;
    const example: GfmExample = {
      markdown: untab(state.markdown),
      html: untab(state.html),
      example: exampleNumber,
      start_line: state.startLine,
      end_line: lineNumber,
      section: state.section,
    };
    return {
      ...next,
      mode: 0,
      exampleNumber,
      startLine: 0,
      markdown: "",
      html: "",
      examples: A.contains(state.flags, "disabled") ? state.examples : A.append(state.examples, example),
    };
  }
  if (stripped === ".") {
    return { ...next, mode: 2 };
  }
  if (state.mode === 1) {
    return {
      ...next,
      startLine: state.startLine === 0 ? lineNumber - 1 : state.startLine,
      markdown: state.markdown + line,
    };
  }
  if (state.mode === 2) {
    return { ...next, html: state.html + line };
  }
  return HEADER.test(line) ? { ...next, section: pyStrip(Str.replace(HEADERS, "")(line)) } : next;
};

/**
 * Scan a cmark spec file into its enabled examples, as upstream
 * `spec_tests.py`'s `get_tests` does.
 *
 * **Example** (Scan one example)
 *
 * ```ts
 * import { getTests } from "../scripts/extract-gfm-corpora.ts"
 *
 * const fence = "`".repeat(32)
 * const spec = `## Tables (extension)\n\n${fence} example\na→b\n.\n<p>a\tb</p>\n${fence}\n`
 * console.log(getTests(spec)[0]?.section) // "Tables (extension)"
 * ```
 *
 * @since 0.0.0
 */
export const getTests = (spec: string): ReadonlyArray<GfmExample> =>
  A.reduce(linesOf(spec), initialState, scanLine).examples;

/**
 * Keep the examples whose section matches a case-insensitive pattern, as
 * upstream's `--pattern` filter does.
 *
 * @since 0.0.0
 */
export const filterSections =
  (pattern: string) =>
  (examples: ReadonlyArray<GfmExample>): ReadonlyArray<GfmExample> => {
    const section = new RegExp(pattern, "i");
    return A.filter(examples, (example) => section.test(example.section));
  };

// Python json.dumps(ensure_ascii=True): every non-ASCII UTF-16 code unit as a lowercase \uXXXX escape.
const asciiOnly = (json: string): string =>
  A.join(
    A.map(Str.split(json, ""), (unit) => {
      const code = O.getOrElse(Str.charCodeAt(0)(unit), () => 0);
      return code > 0x7f ? `\\u${Str.padStart(4, "0")(code.toString(16))}` : unit;
    }),
    ""
  );

/**
 * Render a corpus exactly as Python `json.dumps(examples, indent=2) + "\n"`.
 *
 * @since 0.0.0
 */
export const renderCorpus = (examples: ReadonlyArray<GfmExample>) =>
  Effect.map(encodeCorpus(examples), (json) => `${asciiOnly(json)}\n`);

const summarize = (label: string, examples: ReadonlyArray<GfmExample>): string =>
  A.join(
    [
      `${label}: ${examples.length} examples`,
      ...A.map(
        A.dedupe(A.map(examples, (example) => example.section)),
        (section) => `  ${section}: ${A.length(A.filter(examples, (example) => example.section === section))}`
      ),
    ],
    "\n"
  );

const cmarkGfmArgument = (argv: ReadonlyArray<string>): O.Option<string> =>
  pipe(
    A.findFirstIndex(argv, (argument) => argument === "--cmark-gfm"),
    O.flatMap((index) => A.get(argv, index + 1))
  );

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");
  const cmarkGfm = O.getOrElse(cmarkGfmArgument(process.argv), () => path.join(repoRoot, ".repos", "cmark-gfm"));
  const fixturesDir = path.join(import.meta.dirname, "..", "data", "conformance", "gfm");
  yield* fs.makeDirectory(fixturesDir, { recursive: true });

  const specText = yield* fs.readFileString(path.join(cmarkGfm, "test", "spec.txt"));
  const specExtensions = filterSections("\\(extension\\)$")(getTests(specText));
  const specExtensionsJson = yield* renderCorpus(specExtensions);
  yield* fs.writeFileString(path.join(fixturesDir, "spec-extensions.json"), specExtensionsJson);
  yield* Console.log(summarize("spec-extensions.json", specExtensions));

  const extensionsText = yield* fs.readFileString(path.join(cmarkGfm, "test", "extensions.txt"));
  const extensions = getTests(extensionsText);
  const extensionsJson = yield* renderCorpus(extensions);
  yield* fs.writeFileString(path.join(fixturesDir, "extensions.json"), extensionsJson);
  yield* Console.log(summarize("extensions.json", extensions));
});

if (import.meta.main) {
  NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
}
