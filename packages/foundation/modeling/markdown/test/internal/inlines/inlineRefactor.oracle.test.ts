import { identity } from "effect/Function";
// The differentials that pin the inline pass across its complexity
// refactors (wave 2d review correction 10): `processEmphasis`, the
// close-bracket handler, the reference grammar, and the GFM autolink-literal
// scanners were each split by their natural seams, and none of them may
// change behaviour.
//
// Two kinds of oracle:
//
// - commonmark.js 0.31.2, the reference implementation this engine ports,
//   over seeded fast-check sources dense in the constructs each refactor
//   touched: delimiter runs beside astral punctuation, symbols and letters
//   (the trigger-table re-keying reads one UTF-16 unit, half of an astral
//   character), link and image brackets, and reference definitions.
// - The engine itself before the refactors, for GFM, which commonmark.js does
//   not implement: SHA-256 digests of the materialized phrasing nodes over a
//   20,000-source seeded corpus, recorded from the pre-refactor engine.
//   The GFM expectation includes the #2137 corrections to escaped email
//   recognition and URL destinations; see writer-differential-w2d3.md for
//   the source-by-source audit. The CommonMark expectation is unchanged.
//   The corpus (`inlineCorpus.ts`) is generated without any engine code, so the
//   same sources reach every version.

import { Markdown } from "@beep/markdown/Markdown";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { renderHtml } from "../../support/htmlWriter.ts";
import { normalizeHtml } from "../../support/normalizeHtml.ts";
import { renderOracleHtml } from "../../support/oracle.ts";
import { inlineCorpus } from "./inlineCorpus.ts";
import type { MarkdownDialect } from "@beep/markdown/Markdown";

const UnknownJson = S.fromJsonString(S.Unknown);

/** Our HTML for `markdown`, or `undefined` when a hardening guard tripped. */
const renderOurs = (markdown: string): string | undefined => {
  const result = Markdown.parseResult(markdown, { dialect: "commonmark" });
  return Result.isFailure(result) ? undefined : normalizeHtml(renderHtml(result.success));
};

/** The oracle's one known defect, corrected exactly as `oracle.property.test.ts` does. */
const renderOracle = (markdown: string): string =>
  Str.replaceAll("<p></p>", "")(normalizeHtml(renderOracleHtml(markdown)));

const agreesWithOracle = (markdown: string): boolean => {
  const ours = renderOurs(markdown);
  // A guard trip is a legitimate outcome the oracle does not model.
  if (ours !== undefined) {
    assert.strictEqual(
      ours,
      renderOracle(markdown),
      `disagreement on input:\n${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(markdown), identity)}`
    );
  }
  return true;
};

const sourceOf = (tokens: ReadonlyArray<string>) =>
  S.Literals(tokens).pipe(
    S.Array,
    Arbitrary.schema,
    Arbitrary.map((parts) => A.join(parts, ""))
  );

const seeded = { arbitrary: { runs: 10_000, size: 24, seed: 20_261_022 } };

/**
 * Delimiter runs beside every class of flanking neighbour.
 *
 * **Details**
 *
 * Astral neighbours here are letters only. commonmark.js classifies
 * flanking by UTF-16 unit, so beside an astral punctuation mark or symbol it
 * sees half a surrogate pair and disagrees with the spec, which classifies
 * code points — the divergence `emphasis-astral.test.ts` pins. Astral
 * punctuation and symbols are covered by the pre-refactor digest below.
 */
const emphasisSources = sourceOf([
  "*",
  "**",
  "***",
  "_",
  "__",
  "___",
  "a",
  "b",
  " ",
  "!",
  ".",
  "é",
  "—",
  "€",
  "¡",
  "𝐀",
  "\\*",
  "`",
  "[",
  "]",
  "(",
  ")",
  "\n",
]);

/**
 * Brackets, destinations, titles and reference labels, with a definition to
 * resolve against. No raw HTML: commonmark.js's renderer writes an inline
 * tag inside an image's `alt` unescaped, which is not a parse difference.
 */
const linkSources = sourceOf([
  "[",
  "]",
  "![",
  "(",
  ")",
  "/u",
  " ",
  '"t"',
  "'t'",
  "x",
  "*",
  "_",
  "\\",
  "\\]",
  "\n",
  "[a]",
  "[A]",
  "[]",
  "[^a]",
]).pipe(Arbitrary.map((body) => `[a]: /def "d"\n\n${body}\n`));

/** Reference definitions: labels, bare and braced destinations with nested parens, titles, line ends. */
const definitionSources = sourceOf([
  "/u",
  "<u v>",
  "<",
  "(",
  ")",
  "\\(",
  "\\",
  '"',
  "'",
  " ",
  "t",
  "(t)",
  "\n",
  "*",
]).pipe(Arbitrary.map((tail) => `[a]:${tail}\n\n[a] [b]\n`));

describe("inline refactor differential: commonmark.js 0.31.2", () => {
  it.prop(
    "emphasis pairing agrees, astral neighbours included",
    [emphasisSources],
    ([markdown]) => agreesWithOracle(markdown),
    seeded
  );

  it.prop("link and image closing agrees", [linkSources], ([markdown]) => agreesWithOracle(markdown), seeded);

  it.prop("reference definitions agree", [definitionSources], ([markdown]) => agreesWithOracle(markdown), seeded);
});

/** SHA-256 of every source's materialized phrasing nodes under `dialect`. */
const corpusDigest = (dialect: MarkdownDialect) =>
  Effect.promise(() => {
    const outputs = A.map(inlineCorpus({ seed: 20_261_022, count: 20_000 }), (source) => {
      const result = Markdown.parsePhrasingResult(source, { dialect });
      return Result.isFailure(result)
        ? "guard"
        : Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(result.success), identity);
    });
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(A.join(outputs, "\u0000")));
  }).pipe(Effect.map((digest) => Hex.encode(new Uint8Array(digest))));

describe("inline refactor differential: the pre-refactor engine", () => {
  it.effect("reproduces the audited GFM phrasing trees after the #2137 corrections", () =>
    Effect.gen(function* () {
      const corpusDigest1 = yield* corpusDigest("gfm");
      assert.strictEqual(corpusDigest1, "6f438e5c32819cc1e10d304588ccc8c6062d1c56c1e355ddca461535f34b174d");
    })
  );

  it.effect("reproduces every CommonMark phrasing tree of the seeded corpus", () =>
    Effect.gen(function* () {
      const corpusDigest2 = yield* corpusDigest("commonmark");
      assert.strictEqual(corpusDigest2, "af1831ef2fd95386b38bab705668f23880861e80a8c2f2cf0a155bbdc910714a");
    })
  );
});
