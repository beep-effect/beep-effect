/** Raw source to semantic values using the complete original extraction catalog.
 * @internal @packageDocumentation @since 0.0.0
 */
import { Citation } from "@beep/law-practice-domain/values";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationSemanticExtraction } from "@beep/law-practice-server/internal/Citation/SemanticExtraction";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { invokeCitationRawExtraction } from "./CitationExtractionEntry.fixtures.ts";
import { makeCitationOccurrenceTestAdapter } from "./CitationOccurrenceProjection.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import { makeCitationVocabularyAssertion } from "./CitationSemanticVocabulary.fixtures.ts";
import { assertCitationTokenizedExtractionRow } from "./CitationTokenizedExtraction.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const encodeCitation = S.encodeEffect(Citation);
const sourceTypes = R.fromEntries<readonly [string, string]>([
  ["FullCaseCitation", "case"],
  ["ShortCaseCitation", "shortFormCase"],
  ["FullLawCitation", "law"],
  ["FullJournalCitation", "journal"],
  ["IdCitation", "id"],
  ["SupraCitation", "supra"],
  ["ReferenceCitation", "reference"],
  ["UnknownCitation", "unknown"],
]);
type Unicode = Effect.Success<ReturnType<typeof makeCitationPythonUnicode>>;
type SourceRow = Effect.Success<
  ReturnType<typeof installCitationDefaultConfigurationFixture>
>["corpus"]["cases"][number]["expected"][number];
type SourceBindings = Effect.Success<
  ReturnType<typeof installCitationDefaultConfigurationFixture>
>["corpus"]["bindings"];
const metadataNames = R.fromEntries<readonly [string, string]>([
  ["pin_cite", "pinCite"],
  ["antecedent_guess", "antecedentGuess"],
  ["extra", "additionalText"],
  ["resolved_case_name", "caseName"],
  ["resolved_case_name_short", "shortCaseName"],
]);
/** Project the semantic court representation to the original label comparison.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const projectCitationSemanticMetadata = Effect.fn("SemanticExtractionTest.projectMetadata")(function* (
  citation: Citation
) {
  const encoded = yield* encodeCitation(citation);
  let actual: S.JsonObject = encoded.metadata;
  if (citation.type === "case" || citation.type === "shortFormCase") {
    const court = O.map(citation.metadata.court, (value) => (value.status === "known" ? value.id : value.value));
    actual = R.set<string, S.Json, string, S.Json>(actual, "court", O.getOrNull(court));
  }
  return actual;
});
const assertSemanticMetadata = Effect.fn("SemanticExtractionTest.metadata")(function* (
  unicode: Unicode,
  citation: Citation,
  original: SourceRow
) {
  const metadata = yield* Effect.forEach(
    A.filter(R.toEntries(original.metadata), ([key]) => !A.contains(["pin_cite_span_start", "pin_cite_span_end"], key)),
    Effect.fnUntraced(function* ([key, value]) {
      if (typeof value === "number") return yield* Effect.die("unexpected numeric semantic metadata observation");
      const text = value === null ? null : (yield* unicode.fromStorage(value)).text;
      return Tuple.make(
        O.getOrElse(R.get(metadataNames, key), () => key),
        text
      );
    }),
    { concurrency: 1 }
  );
  const actual = yield* projectCitationSemanticMetadata(citation);
  expect(actual, `${original.kind} original metadata`).toEqual(R.fromEntries(metadata));
});
const assertSemanticPublication = Effect.fn("SemanticExtractionTest.publication")(function* (
  citation: Citation,
  original: SourceRow,
  bindings: SourceBindings
) {
  const encoded = yield* encodeCitation(citation);
  if (!("publication" in encoded)) return;
  const expected = A.map(
    A.appendAll(original.token.exact, original.token.variation),
    (id) => A.getUnsafe(bindings, id).ref
  );
  const actual =
    encoded.type === "case" || encoded.type === "shortFormCase"
      ? A.map(encoded.publication.editions, (edition) => edition.edition)
      : encoded.publication.editions;
  expect(actual, `${original.kind} candidate editions`).toEqual(expected);
  expect(encoded.publication.selectedEdition, `${original.kind} selected edition`).toBe(original.editionGuess);
});
const assertSemanticSource = Effect.fnUntraced(function* (unicode: Unicode, citation: Citation, original: SourceRow) {
  const encoded = yield* encodeCitation(citation);
  expect(encoded.type).toBe(O.getOrThrow(R.get(sourceTypes, original.kind)));
  const components = yield* Effect.forEach(
    R.toEntries(original.token.groups),
    Effect.fnUntraced(function* ([key, value]) {
      const text = value === null ? null : (yield* unicode.fromStorage(value)).text;
      return Tuple.make(key, text);
    }),
    { concurrency: 1 }
  );
  expect(encoded.components).toEqual(R.fromEntries(components));
  yield* assertSemanticMetadata(unicode, citation, original);
});
const semanticTextUnits = Effect.fnUntraced(function* (unicode: Unicode, original: SourceRow) {
  let units = 0;
  for (const value of [...R.values(original.token.groups), ...R.values(original.metadata)]) {
    if (value === null || typeof value === "number") continue;
    units += (yield* unicode.fromStorage(value)).utf16Units;
  }
  return units;
});
/** Compare semantic kind, token components, every represented metadata field
 * and selected edition with original observations. Court labels are compared
 * through their known id or preserved unmapped text; coordinate metadata stays
 * outside this semantic comparison. Candidate editions use original fixture
 * references; public reporter/court vocabulary mapping needs separate proof.
 * @internal @category testing @since 0.0.0
 */
export const assertCitationSemanticDocument = Effect.fn("SemanticExtractionTest.assertDocument")(function* (
  unicode: Unicode,
  citations: ReadonlyArray<Citation>,
  expected: ReadonlyArray<SourceRow>,
  bindings: SourceBindings
) {
  expect(citations).toHaveLength(expected.length);
  const amounts = yield* Effect.forEach(
    A.zip(citations, expected),
    Effect.fnUntraced(function* ([citation, original]) {
      yield* assertSemanticSource(unicode, citation, original);
      yield* assertSemanticPublication(citation, original, bindings);
      return yield* semanticTextUnits(unicode, original);
    }),
    { concurrency: 1 }
  );
  return A.reduce(amounts, 0, (sum, amount) => sum + amount);
});
/** Source-backed smoke/full compositions share one permit and cumulative budget. */
export const replayCitationSemanticExtraction = Effect.fn("SemanticExtractionTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const {
    corpus,
    setup,
    defaultConfiguration: config,
    translated,
    provided,
  } = yield* installCitationDefaultConfigurationFixture(kind);
  const assertVocabulary = yield* makeCitationVocabularyAssertion();
  const rows = A.filter(corpus.cases, (row) => full || A.contains([4, 14, 18, 20, 22, 26, 32], row.id));
  const install = (limits: typeof setup.limits, input = config) =>
    makeCitationSemanticExtraction(limits, setup.runtime, input).pipe(
      Effect.provideContext(provided),
      DateTime.withCurrentZoneOffset(0)
    );
  const stage = yield* install(setup.limits);
  const occurrences = yield* makeCitationOccurrenceTestAdapter(setup, provided);
  const mismatch = yield* install(setup.limits, { ...config, semantic: { ...config.semantic, editions: [] } }).pipe(
    Effect.flip
  );
  expect(mismatch).toMatchObject({ reason: "invalid-configuration" });
  let ignored = 0;
  const shortcut = yield* stage.extract({
    plain: "eyecite",
    get markup() {
      ignored++;
      return Symbol("ignored");
    },
  });
  expect(ignored).toBe(0);
  expect(shortcut.citations).toHaveLength(1);
  expect(shortcut.raw.reservedUnits).toBe(0);
  expect(shortcut.reservedUnits).toBeGreaterThan(0);
  yield* occurrences.shortcut(shortcut);
  const tooSmall = yield* install({ ...setup.limits, producedTextUtf16: shortcut.reservedUnits - 1 });
  const refused = yield* tooSmall.extract({ plain: "eyecite" }).pipe(Effect.flip);
  expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
  const exact = yield* install({ ...setup.limits, producedTextUtf16: shortcut.reservedUnits });
  const permitted = yield* exact.extract({ plain: "eyecite" });
  expect(permitted.reservedUnits).toBe(shortcut.reservedUnits);
  const before = yield* setup.observed.snapshot;
  expect(before).toEqual({ spawned: 0, confirmed: 0 });
  const unicode = yield* makeCitationPythonUnicode(setup.limits).pipe(Effect.provideContext(provided));
  for (const row of rows) {
    const result = yield* invokeCitationRawExtraction(stage.extract, unicode, row);
    if (result.raw.outcome._tag !== "Document") return yield* Effect.die("expected original Document branch");
    yield* assertCitationTokenizedExtractionRow(result.raw.outcome.result.extraction, row, translated);
    const projectedUnits = yield* assertCitationSemanticDocument(
      unicode,
      result.citations,
      row.expected,
      corpus.bindings
    );
    yield* assertVocabulary(unicode, result.citations, row.expected);
    expect(result.reservedUnits).toBe(result.raw.reservedUnits + projectedUnits);
    yield* occurrences.verify(unicode, result, row);
  }
  expect(rows).toHaveLength(full ? 36 : 7);
  yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
});
