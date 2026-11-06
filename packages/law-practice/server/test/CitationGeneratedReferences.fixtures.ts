/** Original direct pin-reference construction through actual owned regex workers.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { projectCitationExtractionSelection } from "@beep/law-practice-server/internal/Citation/ExtractionSelection";
import {
  CitationGeneratedReferenceInput,
  makeCitationGeneratedReferences,
} from "@beep/law-practice-server/internal/Citation/GeneratedReferences";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { readCitationGeneratedReferenceSource } from "./CitationReferenceNames.fixtures.ts";
import {
  CitationReferenceSourceNames,
  citationReferenceMetadataFromSource,
  readCitationReferenceTemplate,
} from "./CitationReferencePatterns.fixtures.ts";
import {
  assertCitationWorkerCompositionReleased,
  setupCitationMetadataRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex, readCitationModelMetadata } from "./CitationTokenSeed.fixtures.ts";
import type { CitationGeneratedReferencesResult } from "@beep/law-practice-server/internal/Citation/GeneratedReferences";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationGeneratedReferences");
const Corpus = S.fromJsonString(
  S.Struct({
    disallowedNames: S.Array(S.String),
    cases: S.Array(
      S.Struct({
        mode: S.Literals(["pin", "combined", "markup"]),
        plain: CitationNativeUnicodeHex,
        citation: S.Struct({
          span: S.Tuple([S.Int, CitationGeneratedReferenceInput.fields.offset]),
          metadata: CitationReferenceSourceNames,
        }),
        expected: S.Array(
          S.Struct({
            kind: S.tag("ReferenceCitation"),
            index: S.tag(0),
            tokenKind: S.tag("CaseReferenceToken"),
            token: CitationNativeUnicodeHex,
            tokenStart: S.Int,
            tokenEnd: S.Int,
            spanStart: S.Int,
            spanEnd: S.Int,
            fullSpanStart: S.Int,
            fullSpanEnd: S.Int,
            span: S.Tuple([S.Int, S.Int]),
            fullSpan: S.Tuple([S.Int, S.Int]),
            metadata: S.Record(S.String, S.Union([S.Null, CitationNativeUnicodeHex, S.Int])),
            documentAttached: S.tag(false),
          })
        ),
      })
    ),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual original generated references with complete native model state and source point spans.",
  })
);
/** Replay every direct original pin-reference constructor on an actual runtime.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationGeneratedReferences = Effect.fn("GeneratedReferencesTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const corpus = yield* readCitationGeneratedReferenceSource().pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const template = yield* readCitationReferenceTemplate();
  const setup = yield* setupCitationMetadataRuntime(kind, undefined, false, true, 8192);
  const stage = yield* makeCitationGeneratedReferences(setup.limits, setup.runtime, {
    patterns: template.patterns,
    disallowedNames: corpus.disallowedNames,
  }).pipe(Effect.provideContext(setup.provided));
  const rows = A.filter(corpus.cases, (row) => row.mode === "pin");
  for (const row of rows) {
    const invocation = stage.pincited({
      plain: row.plain,
      offset: row.citation.span[1],
      metadata: citationReferenceMetadataFromSource(row.citation.metadata),
    });
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const result: CitationGeneratedReferencesResult = yield* closed;
    expect(result.references).toHaveLength(row.expected.length);
    for (const [index, reference] of A.map(result.references, (reference, index) => Tuple.make(index, reference))) {
      const original = A.getUnsafe(row.expected, index);
      const metadata = yield* readCitationModelMetadata(reference.metadata);
      expect(metadata).toEqual(original.metadata);
      expect(reference._tag).toBe(original.kind);
      expect(reference.token.kind).toBe(original.tokenKind);
      expect(reference.token.data).toEqual(original.token);
      expect([reference.token.start, reference.token.end]).toEqual([original.tokenStart, original.tokenEnd]);
      expect([reference.spanStart, reference.spanEnd, reference.fullSpanStart, reference.fullSpanEnd]).toEqual([
        original.spanStart,
        original.spanEnd,
        original.fullSpanStart,
        original.fullSpanEnd,
      ]);
      expect(reference.index).toBe(original.index);
      expect(reference.documentAttached).toBe(original.documentAttached);
      const selection = yield* projectCitationExtractionSelection(index, reference);
      expect(selection.span).toEqual(original.span);
      expect(selection.fullSpan).toEqual(original.fullSpan);
      expect(selection.hasEdition).toBe(false);
    }
  }
  expect(rows).toHaveLength(101);
  const multiple = yield* Effect.fromOption(A.findFirst(rows, (row) => row.expected.length > 1));
  const tight = yield* makeCitationGeneratedReferences({ ...setup.limits, candidates: 1 }, setup.runtime, {
    patterns: template.patterns,
    disallowedNames: corpus.disallowedNames,
  }).pipe(Effect.provideContext(setup.provided));
  const refused = yield* tight
    .pincited({
      plain: multiple.plain,
      offset: multiple.citation.span[1],
      metadata: citationReferenceMetadataFromSource(multiple.citation.metadata),
    })
    .pipe(Effect.flip);
  expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "candidates" });
  const malformed = yield* stage.pincited(null).pipe(Effect.flip);
  expect(malformed).toMatchObject({ _tag: "CitationGeneratedReferenceFailure", reason: "invalid-input" });
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, 65);
});
