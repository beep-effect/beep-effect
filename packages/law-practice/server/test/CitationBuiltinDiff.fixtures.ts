/** Independently sealed original CPython/eyecite builtin edit observations.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSpanDiffStep } from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationBuiltinDiff");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-builtin-diff/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    difflibSha256: S.tag("0c6afc23568d55b3e9ac914f9c5361e3033e778aa5b58d3cc82835fc5c638679"),
    producerSha256: S.tag("cacfe9e3bda0d6341317dcbdba03182eb89399d09314877a7a3652440f3e3b92"),
    annotations: S.Array(
      S.Struct({
        id: S.Natural,
        plain: CitationNativeUnicodeHex,
        source: CitationNativeUnicodeHex,
        start: S.Natural,
        end: S.Natural,
        useDmp: S.Boolean,
        output: S.NullOr(CitationNativeUnicodeHex),
        error: S.NullOr(S.String),
      })
    ).check(S.isBetweenLength(10, 10)),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        origin: S.Literals(["short-binary", "unicode-control", "long-no-autojunk", "seeded-mixed"]),
        before: CitationNativeUnicodeHex,
        after: CitationNativeUnicodeHex,
        steps: S.Array(CitationSpanDiffStep),
      })
    ).check(S.isBetweenLength(4231, 4231)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original builtin diff outcomes; target code is not used to generate expectations.",
  })
);
/** Authenticate the original producer and all 4,231 observed edit sequences.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const readCitationBuiltinDiffCorpus = Effect.fn("BuiltinDiffTest.read")(function* () {
  const raw = yield* readCitationOracleFixture(
    "builtin-diff",
    "3b8cb9c95fd5b9525c585b9d05ab2e10cdb6b6c774c91dbfcae2100307c6bc11"
  );
  return yield* S.decodeEffect(Corpus)(raw);
});
