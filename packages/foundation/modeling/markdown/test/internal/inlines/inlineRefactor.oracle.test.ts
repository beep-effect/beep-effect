import { identity } from "effect/Function";
// decision: inline-refactor-differentials

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

const renderOurs = (markdown: string): string | undefined => {
  const result = Markdown.parseResult(markdown, { dialect: "commonmark" });
  return Result.isFailure(result) ? undefined : normalizeHtml(renderHtml(result.success));
};

// decision: oracle-empty-paragraph-corrected
const renderOracle = (markdown: string): string =>
  Str.replaceAll("<p></p>", "")(normalizeHtml(renderOracleHtml(markdown)));

const agreesWithOracle = (markdown: string): boolean => {
  const ours = renderOurs(markdown);
  // decision: commonmark-js-differential-oracle
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
