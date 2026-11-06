/** Sealed original map/Document observations shared by geometry consumers.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationRegexInput } from "@beep/law-practice-server/internal/Citation/RegexInput";
import {
  CitationSpanDiffStep,
  CitationSpanOffsetEntry,
  CitationSpanOffsetSide,
} from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationSpanOffsets");
const Native = CitationNativeUnicodeHex;
const Tag = S.Struct({ text: Native, start: S.Natural, end: S.Natural });
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-span-offsets/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    dmp: S.tag("2.0.1"),
    producerSha256: S.tag("05cd5994d30bf9bb214aa5ba7599ed7d8cc933bf9089dac40b6a474294a5bc7b"),
    maps: S.Array(
      S.Struct({
        id: S.Natural,
        before: Native,
        after: Native,
        error: S.Null,
        steps: S.Array(CitationSpanDiffStep),
        entries: S.Array(CitationSpanOffsetEntry),
        queries: S.Array(
          S.Struct({
            position: S.Int,
            side: CitationSpanOffsetSide,
            value: S.NullOr(S.Int),
            error: S.NullOr(S.Literals(["IndexError"])),
          })
        ),
      })
    ).check(S.isBetweenLength(72, 72)),
    documents: S.Array(
      S.Struct({
        plain: Native,
        markup: Native,
        forwardMap: S.Natural,
        backwardMap: S.Natural,
        tags: S.Array(Tag),
        queries: S.Array(S.Struct({ position: S.Int, tags: S.Array(Tag) })),
        conversions: S.Array(S.Struct({ tag: Tag, text: Native, start: S.Int, end: S.Int })),
      })
    ).check(S.isBetweenLength(16, 16)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Original constructor entries, all bisect observations and real HTML document geometry; diff generation is not target-qualified.",
  })
);
export const readCitationSpanOffsetsCorpus = Effect.fn("SpanOffsetsTest.load")(function* () {
  const corpus = yield* readCitationOracleFixture(
    "span-offsets",
    "7f3ea888395629a5472de3ca0fc952db102ff3b918194ffab0cb1543b07f4223"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const input = yield* makeCitationRegexInput(limits);
  const plans = yield* Effect.forEach(
    corpus.maps,
    Effect.fn("SpanOffsetsTest.preparePlan")(function* (row) {
      const before = yield* input.prepareUnicode(row.before, () => Effect.void);
      const after = yield* input.prepareUnicode(row.after, () => Effect.void);
      return { before: before.layout, after: after.layout, steps: row.steps };
    })
  );
  return { corpus, limits, plans };
});
