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
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
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
import type { CitationExtractionLoopEntry } from "@beep/law-practice-server/internal/Citation/ExtractionLoop";
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
      })
    ),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original get_citations documents and complete pre/post-filter state with original identity indices.",
  })
);
type Expected = typeof Model.Type;
const isGenerated = S.is(CitationGeneratedReference);
const assertModel = Effect.fn("ExtractionLoopTest.model")(function* (
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
/** Replay the real loop with a single operation permit and real native admission. */
export const replayCitationExtractionLoop = Effect.fn("ExtractionLoopTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const corpus = yield* readCitationOracleFixture(
    "extraction-loop",
    "938316acc08880fd464a9e91b89e45ee802ed4ef08d6c08656baaa925fa97f3e"
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
    Effect.provideContext(setup.provided),
    DateTime.withCurrentZoneOffset(0)
  );
  const geometry = yield* installCitationHtmlGeometryFixture(kind, setup);
  for (const row of corpus.cases) {
    const maps = yield* prepareCitationOptionalHtmlGeometry(geometry, row, row.markup.bytes.length > 0);
    const invocation = stage.extract({ ...row, geometry: maps });
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const result = yield* closed;
    if (row.id === 2) {
      const budget = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: result.reservedUnits - 1 });
      const tight = yield* makeCitationExtractionLoop(limits, setup.runtime, configuration).pipe(
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
    yield* Effect.forEach(result.models, (entry, id) => assertModel(entry, A.getUnsafe(row.before, id), id), {
      concurrency: 1,
      discard: true,
    });
    expect(result.selection.selected).toEqual(row.selected);
    expect(result.selection.warnings).toEqual(row.warnings);
    expect(result.citations).toHaveLength(row.expected.length);
    for (const [index, id] of A.map(row.returned, (id, index) => Tuple.make(index, id))) {
      const retained = A.getUnsafe(result.citations, index);
      expect(retained).toBe(A.getUnsafe(result.models, id));
      yield* assertModel(retained, A.getUnsafe(row.expected, index), id);
    }
  }
  expect(corpus.cases).toHaveLength(36);
  const malformed = yield* stage.extract(null).pipe(Effect.flip);
  expect(malformed).toMatchObject({ _tag: "CitationExtractionLoopFailure", reason: "invalid-input" });
  const counts = yield* setup.observed.snapshot;
  expect(counts.spawned).toBeGreaterThan(100);
  yield* assertCitationWorkerCompositionReleased(operation, setup.admission, setup.observed.snapshot, counts.spawned);
});
