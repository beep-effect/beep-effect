/** Shared pinned cold-template corpus; no target-derived expected values.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPythonSliceBounds } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationAnnotationTemplate");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-annotation-wrap/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("3845e015f477bfdaabc2f80ca02e9cbbe0f4be2bfbf0fdbda08ec25e940a4e44"),
    templateParserSha256: S.tag("4748e39c77d6dc14f81af80e68a62ad99031a8182d5e0b219a6666d0cfb1626f"),
    cacheState: S.tag("cold-per-case"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        source: CitationNativeUnicodeHex,
        before: CitationNativeUnicodeHex,
        after: CitationNativeUnicodeHex,
        matches: S.Array(S.Struct(CitationPythonSliceBounds.fields)),
        warnings: S.Array(S.Literal("DeprecationWarning")),
        result: S.TaggedUnion({
          Success: { text: CitationNativeUnicodeHex },
          Failure: { kind: S.Literals(["error", "IndexError"]), message: CitationNativeUnicodeHex },
        }),
      })
    ).check(S.isBetweenLength(1320, 1320)),
  })
);
const CorpusCodec = Corpus.pipe(
  $I.annoteSchema("Corpus", {
    description: "Cold original wrapping outputs and failures with independently observed tag ranges.",
  })
);
/** @internal @category testing @since 0.0.0 */
export const readCitationAnnotationWrapCorpus = readCitationOracleFixture(
  "annotation-wrap",
  "c2b7516115dc68b4e929ccb7f2de3caab9b787b884738ba2b43d3e11e520d35e"
).pipe(Effect.flatMap(S.decodeEffect(CorpusCodec)));
