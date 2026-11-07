/** Sealed original-source default diff corpus shared by host and worker proof. */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSpanDiffStep } from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationDiffCorpus");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-diff-kernel/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("bf50ad197844b344e70de692d8b0bfb142e76e56b28c98b09e20cc6c91927d6a"),
    maps: S.Array(
      S.Struct({
        before: CitationNativeUnicodeHex,
        after: CitationNativeUnicodeHex,
        steps: S.Array(CitationSpanDiffStep),
      })
    ).check(S.isBetweenLength(1005, 1005)),
  })
).pipe(
  $I.annoteSchema("Corpus", { description: "Sealed original default-diff edit sequences over native source points." })
);
export const readCitationDiffCorpus = Effect.fn("DiffCorpusTest.load")(() =>
  readCitationOracleFixture("diff-kernel", "24470daeb7bbc4b8166867e8071d3a2a85b9a35b4e595c0a0b7c3429a67b0dda").pipe(
    Effect.flatMap(S.decodeEffect(Corpus))
  )
);
