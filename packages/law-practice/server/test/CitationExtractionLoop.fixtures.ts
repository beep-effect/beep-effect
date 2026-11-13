/** Actual original get_citations loop and object-order replay with owned workers.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import {
  CitationExtractionLoopConfiguration,
  makeCitationExtractionLoop,
} from "@beep/law-practice-server/internal/Citation/ExtractionLoop";
import { projectCitationExtractionSelection } from "@beep/law-practice-server/internal/Citation/ExtractionSelection";
import { CitationGeneratedReference } from "@beep/law-practice-server/internal/Citation/GeneratedReferences";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { readCitationCaseMetadataConfiguration } from "./CitationCaseMetadata.fixtures.ts";
import { installCitationFrozenMetadataRuntime } from "./CitationFrozenEditions.fixtures.ts";
import {
  installCitationHtmlGeometryFixture,
  prepareCitationOptionalHtmlGeometry,
} from "./CitationHtmlGeometryPreparation.fixtures.ts";
import { makeCitationTestInvocationBinding } from "./CitationInvocation.fixtures.ts";
import { readCitationJournalMetadataCorpus } from "./CitationJournalMetadata.fixtures.ts";
import { loadCitationLawMetadataFixtures } from "./CitationLawMetadata.fixtures.ts";
import { readCitationPinExtractionCorpus } from "./CitationPinExtraction.fixtures.ts";
import { readCitationGeneratedReferenceSource } from "./CitationReferenceNames.fixtures.ts";
import { readCitationReferenceTemplate } from "./CitationReferencePatterns.fixtures.ts";
import { readCitationReferenceTokenCorpus } from "./CitationReferenceToken.fixtures.ts";
import { assertCitationWorkerCompositionReleased, readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import {
  CitationCaseNameDocument,
  CitationNativeUnicodeHex,
  CitationTokenSeedHex,
  readCitationModelMetadata,
} from "./CitationTokenSeed.fixtures.ts";
import type {
  CitationExtractionLoopEntry,
  CitationExtractionLoopResult,
} from "@beep/law-practice-server/internal/Citation/ExtractionLoop";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationExtractionLoop");
const GeneratedNames = S.fromJsonString(S.Struct({ disallowedNames: S.Array(S.String) })).pipe(
  $I.annoteSchema("GeneratedNames", {
    description: "Existing source exclusion list for the loop's shared reference configuration.",
  })
);
const Model = S.Struct({
  kind: S.String,
  index: S.Int,
  token: CitationTokenSeedHex,
  metadata: S.Record(S.String, S.Union([S.Null, CitationNativeUnicodeHex, S.Int])),
  span: S.Tuple([S.Int, S.Int]),
  fullSpan: S.Tuple([S.Int, S.Int]),
  spanWithPincite: S.Tuple([S.Int, S.Int]),
  fullSpanStart: S.NullOr(S.Int),
  fullSpanEnd: S.NullOr(S.Int),
  year: S.NullOr(S.Int),
  editionGuess: S.NullOr(CitationEditionRef),
  documentAttached: S.Boolean,
});
const Corpus = S.fromJsonString(
  S.Struct({
    bindings: S.Array(S.Struct({ id: S.Natural, ref: CitationEditionRef })),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        plain: CitationNativeUnicodeHex,
        markup: CitationNativeUnicodeHex,
        words: CitationCaseNameDocument.fields.words,
        tokens: S.Array(S.Struct({ index: S.Int, token: CitationTokenSeedHex })),
        removeAmbiguous: S.Boolean,
        before: S.Array(Model),
        selected: S.Array(S.Natural),
        returned: S.Array(S.Natural),
        warnings: S.Array(S.Tuple([S.Natural, S.Natural])),
        expected: S.Array(Model),
        pinCiteOverrides: S.Array(
          S.Struct({
            index: S.Natural,
            pinCiteSpanStart: S.NullOr(S.Int),
            pinCiteSpanEnd: S.NullOr(S.Int),
            spanWithPincite: S.Tuple([S.Int, S.Int]),
          })
        ),
      })
    ),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original get_citations documents and complete pre/post-filter state with original identity indices.",
  })
);
// Construction comparisons also serve the separate legacy shortcut corpus.
// Pin-cite ranges are compared by the occurrence adapter against the v2 corpus.
type Expected = Omit<typeof Model.Type, "spanWithPincite">;
const isGenerated = S.is(CitationGeneratedReference);
export const assertCitationExtractionLoopModel = Effect.fn("ExtractionLoopTest.model")(function* (
  entry: CitationExtractionLoopEntry,
  expected: Expected,
  id: number
) {
  const model = entry.model;
  const state = isGenerated(model) ? model : model.outcome;
  const projected = yield* projectCitationExtractionSelection(id, model);
  expect(state._tag).toBe(expected.kind);
  expect(model.index).toBe(expected.index);
  expect(model.token).toEqual(expected.token);
  const metadata = yield* readCitationModelMetadata(state.metadata);
  expect(metadata).toEqual(expected.metadata);
  expect(projected.span).toEqual(expected.span);
  expect(projected.fullSpan).toEqual(expected.fullSpan);
  expect(state.fullSpanStart).toBe(expected.fullSpanStart);
  expect(state.fullSpanEnd).toBe(expected.fullSpanEnd);
  const year = "year" in state ? state.year : null;
  expect(year === null ? null : BigInt(year)).toEqual(expected.year === null ? null : BigInt(expected.year));
  expect("editionGuess" in state ? state.editionGuess : null).toBe(expected.editionGuess);
  expect(entry.documentAttached).toBe(expected.documentAttached);
});
/** Preserve original selected ids, warning pairs and returned-entry identity. */
export const assertCitationExtractionLoopSelection = Effect.fn("ExtractionLoopTest.selection")(function* (
  result: CitationExtractionLoopResult,
  row: Pick<(typeof Corpus.Type.cases)[number], "selected" | "warnings" | "expected" | "returned">
) {
  expect(result.selection.selected).toEqual(row.selected);
  expect(result.selection.warnings).toEqual(row.warnings);
  expect(result.citations).toHaveLength(row.expected.length);
  for (const [index, id] of A.map(row.returned, (id, index) => Tuple.make(index, id))) {
    expect(A.getUnsafe(result.citations, index)).toBe(A.getUnsafe(result.models, id));
  }
});
/** Install shared authenticated loop evidence, configuration and actual runtime. */
export const installCitationExtractionLoopFixture = Effect.fn("ExtractionLoopTest.install")(function* (
  kind: CitationNativeRuntimeKind
) {
  const corpus = yield* readCitationOracleFixture(
    "extraction-loop",
    "f068a21141db823055f6dbad6c79d9c0c996f300e7b76258ca26a92009f2f89b"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const cases = yield* readCitationCaseMetadataConfiguration();
  const laws = yield* loadCitationLawMetadataFixtures();
  const journals = yield* readCitationJournalMetadataCorpus();
  const reference = yield* readCitationReferenceTokenCorpus();
  const pin = yield* readCitationPinExtractionCorpus();
  const template = yield* readCitationReferenceTemplate();
  const names = yield* readCitationGeneratedReferenceSource().pipe(Effect.flatMap(S.decodeEffect(GeneratedNames)));
  const base = yield* installCitationFrozenMetadataRuntime(kind);
  const limits = { ...base.limits, concurrentOperations: 1 };
  const operation = yield* makeCitationOperationAdmission(limits).pipe(Effect.provideContext(base.provided));
  const setup = {
    ...base,
    limits,
    operation,
    provided: Context.add(base.provided, CitationOperationAdmission, operation),
  };
  const configuration = CitationExtractionLoopConfiguration.make({
    full: { editions: corpus.bindings, case: cases, law: laws.configuration, journal: journals.configuration },
    reference: {
      editions: corpus.bindings,
      pin: pin.configuration,
      names: cases.names,
      supra: reference.configuration.supra,
    },
    generated: { patterns: template.patterns, disallowedNames: names.disallowedNames },
  });
  const stage = yield* makeCitationExtractionLoop(limits, setup.runtime, configuration).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestInvocationBinding(limits).pipe(Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) })))
    ),
    Effect.provideContext(setup.provided),
    DateTime.withCurrentZoneOffset(0)
  );
  const geometry = yield* installCitationHtmlGeometryFixture(kind, setup);
  return { corpus, setup, configuration, stage, geometry };
});
/** Original corpus size; replay slices must cover every case. */
export const citationExtractionLoopCases = 36;
/** Replay one bounded slice of the real loop with a single operation permit and real native admission. */
export const replayCitationExtractionLoop = Effect.fn("ExtractionLoopTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  from: number,
  count: number
) {
  const { corpus, setup, configuration, stage, geometry } = yield* installCitationExtractionLoopFixture(kind);
  const { limits, operation } = setup;
  for (const row of A.take(A.drop(corpus.cases, from), count)) {
    const maps = yield* prepareCitationOptionalHtmlGeometry(geometry, row, row.markup.bytes.length > 0);
    const invocation = stage.extract({ ...row, geometry: maps });
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const result = yield* closed;
    if (row.id === 2) {
      const budget = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: result.reservedUnits - 1 });
      const tight = yield* makeCitationExtractionLoop(limits, setup.runtime, configuration).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestInvocationBinding(limits).pipe(
            Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
          )
        ),
        Effect.provideContext(Context.add(setup.provided, CitationTextBudget, budget)),
        DateTime.withCurrentZoneOffset(0)
      );
      const before = yield* setup.observed.snapshot;
      const refused = yield* tight.extract({ ...row, geometry: maps }).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
      const after = yield* setup.observed.snapshot;
      expect(after.spawned).toBeGreaterThan(before.spawned);
    }
    expect(result.models).toHaveLength(row.before.length);
    yield* Effect.forEach(
      result.models,
      (entry, id) => assertCitationExtractionLoopModel(entry, A.getUnsafe(row.before, id), id),
      {
        concurrency: 1,
        discard: true,
      }
    );
    yield* assertCitationExtractionLoopSelection(result, row);
    for (const [index, id] of A.map(row.returned, (id, index) => Tuple.make(index, id))) {
      const retained = A.getUnsafe(result.citations, index);
      yield* assertCitationExtractionLoopModel(retained, A.getUnsafe(row.expected, index), id);
    }
  }
  const counts = yield* setup.observed.snapshot;
  expect(counts.spawned).toBeGreaterThan(count);
  yield* assertCitationWorkerCompositionReleased(operation, setup.admission, setup.observed.snapshot, counts.spawned);
});
/** Pin the corpus size and the malformed-input refusal once per runtime. */
export const assertCitationExtractionLoopBoundary = Effect.fn("ExtractionLoopTest.boundary")(function* (
  kind: CitationNativeRuntimeKind
) {
  const { corpus, setup, stage } = yield* installCitationExtractionLoopFixture(kind);
  expect(corpus.cases).toHaveLength(citationExtractionLoopCases);
  const malformed = yield* stage.extract(null).pipe(Effect.flip);
  expect(malformed).toMatchObject({ _tag: "CitationExtractionLoopFailure", reason: "invalid-input" });
  const counts = yield* setup.observed.snapshot;
  yield* assertCitationWorkerCompositionReleased(
    setup.operation,
    setup.admission,
    setup.observed.snapshot,
    counts.spawned
  );
});
