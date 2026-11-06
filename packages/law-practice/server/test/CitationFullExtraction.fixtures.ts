/** Original full-citation constructor, selected class and final model state.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { projectCitationExtractionSelection } from "@beep/law-practice-server/internal/Citation/ExtractionSelection";
import { makeCitationFullExtraction } from "@beep/law-practice-server/internal/Citation/FullExtraction";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { readCitationCaseMetadataConfiguration } from "./CitationCaseMetadata.fixtures.ts";
import { makeCitationParallelAssertion } from "./CitationExtractionSelection.fixtures.ts";
import { installCitationFrozenMetadataRuntime } from "./CitationFrozenEditions.fixtures.ts";
import { readCitationJournalMetadataCorpus } from "./CitationJournalMetadata.fixtures.ts";
import { loadCitationLawMetadataFixtures } from "./CitationLawMetadata.fixtures.ts";
import { assertCitationWorkerCompositionReleased, readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import {
  CitationCaseNameDocument,
  CitationNativeUnicodeHex,
  CitationTokenSeedHex,
  readCitationModelMetadata,
} from "./CitationTokenSeed.fixtures.ts";
import type { CitationFullExtractionOutcome } from "@beep/law-practice-server/internal/Citation/FullExtraction";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationFullExtraction");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-full-extraction/v1"),
    bindings: S.Array(S.Struct({ id: S.Natural, ref: CitationEditionRef })).check(S.isBetweenLength(7, 7)),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        index: S.Int,
        words: CitationCaseNameDocument.fields.words,
        token: CitationTokenSeedHex,
        calls: S.Array(S.String),
        expected: S.Struct({
          kind: S.Literals(["FullCaseCitation", "FullLawCitation", "FullJournalCitation"]),
          metadata: S.Record(S.String, S.Union([S.Null, CitationNativeUnicodeHex, S.Int])),
          year: S.NullOr(S.Int),
          span: S.Tuple([S.Int, S.Int]),
          fullSpanStart: S.NullOr(S.Int),
          fullSpanEnd: S.NullOr(S.Int),
          fullSpan: S.Tuple([S.Int, S.Int]),
          editionGuess: S.NullOr(CitationEditionRef),
        }),
      })
    ).check(S.isBetweenLength(15, 15)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Actual original full-citation construction from tokenized Documents across all three source families.",
  })
);
const install = Effect.fn("FullExtractionTest.install")(function* (kind: CitationNativeRuntimeKind) {
  const corpus = yield* readCitationOracleFixture(
    "full-extraction",
    "a303ae5063b50d3af5344aefd0e43826412e932265778f7a46936af058c93b1c"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const cases = yield* readCitationCaseMetadataConfiguration();
  const laws = yield* loadCitationLawMetadataFixtures();
  const journals = yield* readCitationJournalMetadataCorpus();
  const setup = yield* installCitationFrozenMetadataRuntime(kind);
  const provided = setup.provided;
  const configuration = {
    editions: corpus.bindings,
    case: cases,
    law: laws.configuration,
    journal: journals.configuration,
  };
  const stage = yield* makeCitationFullExtraction(setup.limits, setup.runtime, configuration).pipe(
    Effect.provideContext(provided),
    DateTime.withCurrentZoneOffset(0)
  );
  return { corpus, setup, stage };
});
/** Every case/law/journal constructor vector executes on each actual runtime. */
export const replayCitationFullExtraction = Effect.fn("FullExtractionTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const { corpus, setup, stage } = yield* install(kind);
  const assertParallel = yield* makeCitationParallelAssertion();
  for (const row of corpus.cases) {
    const invocation = stage.extract({ ...row, geometry: O.none() });
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const result = yield* closed;
    yield* assertParallel(result);
    const selection = yield* projectCitationExtractionSelection(row.id, result);
    expect(selection.span).toEqual(row.expected.span);
    expect(selection.fullSpan).toEqual(row.expected.fullSpan);
    expect(result.outcome._tag).toBe(row.expected.kind);
    expect(result.index).toBe(row.index);
    expect([result.token.start, result.token.end]).toEqual(row.expected.span);
    const state: CitationFullExtractionOutcome = result.outcome;
    const metadata = yield* readCitationModelMetadata(state.metadata);
    expect(metadata, `${kind}:${row.id}:metadata`).toEqual(row.expected.metadata);
    expect(state.year === null ? null : BigInt(state.year)).toEqual(
      row.expected.year === null ? null : BigInt(row.expected.year)
    );
    expect(state.fullSpanStart).toBe(row.expected.fullSpanStart);
    expect(state.fullSpanEnd).toBe(row.expected.fullSpanEnd);
    expect(state.editionGuess).toBe(row.expected.editionGuess);
  }
  const source = A.getUnsafe(corpus.cases, 0);
  const incoherent = yield* stage
    .extract({ ...source, token: { ...source.token, data: null }, geometry: O.none() })
    .pipe(Effect.flip);
  expect(incoherent).toMatchObject({ _tag: "CitationFullExtractionFailure", reason: "invalid-input" });
  const unknown = yield* stage
    .extract({ ...source, token: { ...source.token, exact: [], variation: [] }, geometry: O.none() })
    .pipe(Effect.flip);
  expect(unknown).toMatchObject({ _tag: "CitationTokenDispatchFailure", reason: "unknown-source" });
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, 91);
});
