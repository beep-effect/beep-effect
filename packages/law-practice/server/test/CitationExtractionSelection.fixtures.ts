/** Direct original filtering corpus, including native surrogate distinctions.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { CitationCaseMetadataFields } from "@beep/law-practice-server/internal/Citation/CaseMetadata";
import {
  CitationExtractionSelectionEntry,
  makeCitationExtractionSelection,
} from "@beep/law-practice-server/internal/Citation/ExtractionSelection";
import {
  CitationFullExtractionResult,
  inheritCitationParallelCase,
} from "@beep/law-practice-server/internal/Citation/FullExtraction";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationExtractionSelection");
const Row = S.Struct({
  ...CitationExtractionSelectionEntry.fields,
  matched: CitationNativeUnicodeHex,
  parenthetical: S.NullOr(CitationNativeUnicodeHex),
}).pipe(
  $I.annoteSchema("Row", { description: "Original object selection facts with lossless native fixture storage." })
);
const ParallelState = S.Struct({
  plaintiff: S.NullOr(CitationNativeUnicodeHex),
  defendant: S.NullOr(CitationNativeUnicodeHex),
  yearText: S.NullOr(CitationNativeUnicodeHex),
  year: S.NullOr(S.Int),
  fullSpanStart: S.NullOr(S.Int),
  fullSpanEnd: S.NullOr(S.Int),
  editionPresent: S.Boolean,
}).pipe(
  $I.annoteSchema("ParallelState", {
    description: "Observed original parallel inheritance state; other fields remain unchanged.",
  })
);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-extraction-selection/v1"),
    parallel: S.Array(S.Struct({ previous: ParallelState, before: ParallelState, after: ParallelState })).check(
      S.isBetweenLength(16, 16)
    ),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        name: S.String,
        input: S.Array(Row),
        selected: S.Array(S.Natural),
        disambiguated: S.Array(S.Natural),
        warnings: S.Array(S.Tuple([S.Natural, S.Natural])),
      })
    ).check(S.isBetweenLength(148, 148)),
  })
).pipe(
  $I.annoteSchema("Corpus", { description: "Direct pinned-source filtering and reporter-disambiguation outcomes." })
);
/** Replay all original final-selection branches using captured production owners.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationExtractionSelection = Effect.fn("ExtractionSelectionTest.replay")(function* () {
  const corpus = yield* readCitationOracleFixture(
    "extraction-selection",
    "0b3f8384253f42427484e0ce7c92b9c659a69d2c18ab0cbaddac4ed4d6a85df4"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const owner = yield* makeCitationOperationAdmission(limits);
  const service = yield* makeCitationExtractionSelection(limits).pipe(
    Effect.provideService(CitationOperationAdmission, owner)
  );
  for (const row of corpus.cases) {
    const actual = yield* service.select(row.input);
    expect(actual, row.name).toEqual({
      selected: row.selected,
      disambiguated: row.disambiguated,
      warnings: row.warnings,
    });
  }
  const source = A.getUnsafe(corpus.cases, 1).input;
  const duplicate = yield* service.select([A.getUnsafe(source, 0), A.getUnsafe(source, 0)]).pipe(Effect.flip);
  expect(duplicate).toMatchObject({ _tag: "CitationExtractionSelectionFailure", reason: "duplicate-id" });
  const bounded = yield* makeCitationExtractionSelection({ ...limits, candidates: 1 }).pipe(
    Effect.provideService(CitationOperationAdmission, owner)
  );
  const candidateRefusal = yield* bounded.select(source).pipe(Effect.flip);
  expect(candidateRefusal).toMatchObject({
    _tag: "CitationSafetyLimitExceeded",
    limit: "candidates",
  });
  const tight = yield* makeCitationExtractionSelection({ ...limits, resolutionIterations: 1 }).pipe(
    Effect.provideService(CitationOperationAdmission, owner)
  );
  const workRefusal = yield* tight.select(source).pipe(Effect.flip);
  expect(workRefusal).toMatchObject({
    _tag: "CitationSafetyLimitExceeded",
    limit: "resolutionIterations",
  });
  const snapshot = yield* owner.snapshot;
  expect(snapshot).toMatchObject({ active: 0, queued: 0 });
});

/** Bind the original parallel transitions once and replay them on constructed full models.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationParallelAssertion = Effect.fn("ExtractionSelectionTest.parallel")(function* () {
  const corpus = yield* readCitationOracleFixture(
    "extraction-selection",
    "0b3f8384253f42427484e0ce7c92b9c659a69d2c18ab0cbaddac4ed4d6a85df4"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  return Effect.fn("ExtractionSelectionTest.inherit")(function* (seed: CitationFullExtractionResult) {
    const state = seed.outcome;
    if (state._tag !== "FullCaseCitation") return;
    const make = (input: typeof ParallelState.Type) =>
      CitationFullExtractionResult.make({
        ...seed,
        outcome: {
          ...state,
          fullSpanStart: input.fullSpanStart,
          fullSpanEnd: input.fullSpanEnd,
          year: input.year,
          metadata: CitationCaseMetadataFields.make({
            ...state.metadata,
            plaintiff: input.plaintiff,
            defendant: input.defendant,
            year: input.yearText,
          }),
        },
      });
    for (const row of corpus.parallel) {
      const previous = make(row.previous);
      const current = make(row.before);
      const actual = yield* inheritCitationParallelCase(current, previous);
      const expected = make(row.after);
      expect(actual).toEqual(expected);
      expect(previous).toEqual(make(row.previous));
      expect(current).toEqual(make(row.before));
      expect(actual.token).toBe(current.token);
    }
  });
});
