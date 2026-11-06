/** Direct original non-full constructors through one captured operation.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { projectCitationExtractionSelection } from "@beep/law-practice-server/internal/Citation/ExtractionSelection";
import {
  CitationReferenceTokenConfiguration,
  makeCitationReferenceTokenExtraction,
} from "@beep/law-practice-server/internal/Citation/ReferenceTokenExtraction";
import { CitationTokenDispatchBindings } from "@beep/law-practice-server/internal/Citation/TokenDispatch";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { readCitationCaseMetadataConfiguration } from "./CitationCaseMetadata.fixtures.ts";
import { installCitationFrozenMetadataRuntime } from "./CitationFrozenEditions.fixtures.ts";
import {
  installCitationHtmlGeometryFixture,
  prepareCitationOptionalHtmlGeometry,
} from "./CitationHtmlGeometryPreparation.fixtures.ts";
import { readCitationPinExtractionCorpus } from "./CitationPinExtraction.fixtures.ts";
import { assertCitationWorkerCompositionReleased, readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import {
  CitationCaseNameDocument,
  CitationNativeUnicodeHex,
  CitationTokenSeedHex,
  readCitationModelMetadata,
} from "./CitationTokenSeed.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationReferenceTokenOutcome } from "@beep/law-practice-server/internal/Citation/ReferenceTokenExtraction";

const $I = $LawPracticeServerId.create("test/CitationReferenceToken");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-reference-token/v1"),
    configuration: S.Struct({
      supra: S.Struct({
        ...CitationReferenceTokenConfiguration.fields.supra.fields,
        pattern: CitationNativeUnicodeHex,
      }),
    }),
    editionBindings: S.Array(S.Struct({ id: S.Natural, ref: CitationEditionRef })),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        index: S.Int,
        words: CitationCaseNameDocument.fields.words,
        token: CitationTokenSeedHex,
        plain: CitationNativeUnicodeHex,
        markup: S.NullOr(CitationNativeUnicodeHex),
        calls: S.Array(S.String),
        error: S.Null,
        expected: S.Struct({
          kind: S.Literals(["ShortCaseCitation", "IdCitation", "SupraCitation", "UnknownCitation"]),
          metadata: S.Record(S.String, S.Union([S.Null, CitationNativeUnicodeHex, S.Int])),
          span: S.Tuple([S.Int, S.Int]),
          spanEnd: S.NullOr(S.Int),
          fullSpanStart: S.NullOr(S.Int),
          fullSpanEnd: S.NullOr(S.Int),
          fullSpan: S.Tuple([S.Int, S.Int]),
          year: S.Int.pipe(S.NullOr, S.optionalKey),
          editionGuess: CitationEditionRef.pipe(S.NullOr, S.optionalKey),
        }),
      })
    ).check(S.isBetweenLength(24, 24)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Actual original short/Id./supra/unknown state and token contexts, including source-created optional fields.",
  })
);
const install = Effect.fn("ReferenceTokenTest.install")(function* (kind: CitationNativeRuntimeKind) {
  const corpus = yield* readCitationOracleFixture(
    "reference-token",
    "86dac62c3e85b1de5327dcafd03f4ff3e241b1d013bda00542df149c6867c0b7"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const cases = yield* readCitationCaseMetadataConfiguration();
  const pin = yield* readCitationPinExtractionCorpus();
  const setup = yield* installCitationFrozenMetadataRuntime(kind);
  const provided = setup.provided;
  const prepare = yield* installCitationHtmlGeometryFixture(kind, { ...setup, provided });
  const editions: CitationTokenDispatchBindings = yield* S.decodeEffect(CitationTokenDispatchBindings)(
    corpus.editionBindings
  );
  const stage = yield* makeCitationReferenceTokenExtraction(setup.limits, setup.runtime, {
    pin: pin.configuration,
    names: cases.names,
    editions,
    supra: corpus.configuration.supra,
  }).pipe(Effect.provideContext(provided), DateTime.withCurrentZoneOffset(0));
  return { corpus, setup, prepare, stage };
});
type Row = (typeof Corpus.Type.cases)[number];
const assertReferenceYear = (state: CitationReferenceTokenOutcome, expectedRow: Row["expected"]) => {
  expect(P.hasProperty(state, "year")).toBe(P.hasProperty(expectedRow, "year"));
  if (state._tag === "ShortCaseCitation") {
    const expected = expectedRow.year === null || expectedRow.year === undefined ? null : BigInt(expectedRow.year);
    expect(state.year === null ? null : BigInt(state.year)).toEqual(expected);
    expect(state.editionGuess).toBe(expectedRow.editionGuess);
  }
};
const assertRow = Effect.fn("ReferenceTokenTest.row")(function* (
  installed: Effect.Success<ReturnType<typeof install>>,
  row: Row
) {
  const geometry =
    row.markup === null
      ? O.none()
      : yield* prepareCitationOptionalHtmlGeometry(installed.prepare, { plain: row.plain, markup: row.markup }, true);
  const invocation = installed.stage.extract({ ...row, geometry });
  const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
  const result = yield* closed;
  const selection = yield* projectCitationExtractionSelection(row.id, result);
  expect(selection.span).toEqual(row.expected.span);
  expect(selection.fullSpan).toEqual(row.expected.fullSpan);
  const state = result.outcome;
  const metadata = yield* readCitationModelMetadata(state.metadata);
  expect(state._tag).toBe(row.expected.kind);
  expect(metadata, `metadata:${row.id}`).toEqual(row.expected.metadata);
  expect(state.spanEnd).toBe(row.expected.spanEnd);
  expect(state.fullSpanStart).toBe(row.expected.fullSpanStart);
  expect(state.fullSpanEnd).toBe(row.expected.fullSpanEnd);
  expect([result.token.start, state.spanEnd ?? result.token.end]).toEqual(row.expected.span);
  expect([state.fullSpanStart ?? result.token.start, state.fullSpanEnd ?? state.spanEnd ?? result.token.end]).toEqual(
    row.expected.fullSpan
  );
  assertReferenceYear(state, row.expected);
});
/** Every captured branch executes on both runtimes; HTML names use connected geometry. */
export const replayCitationReferenceToken = Effect.fn("ReferenceTokenTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const installed = yield* install(kind);
  for (const row of installed.corpus.cases) yield* assertRow(installed, row);
  expect(installed.corpus.cases).toHaveLength(24);
  const row = A.getUnsafe(installed.corpus.cases, 0);
  const refused = yield* installed.stage
    .extract({ ...row, token: { ...row.token, kind: "CitationToken", short: false }, geometry: O.none() })
    .pipe(Effect.flip);
  expect(refused).toMatchObject({ _tag: "CitationReferenceTokenFailure", reason: "not-reference-token" });
  yield* assertCitationWorkerCompositionReleased(
    installed.setup.operation,
    installed.setup.admission,
    installed.setup.observed.snapshot,
    94
  );
});
