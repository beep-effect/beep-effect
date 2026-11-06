/** Raw source to semantic values using the complete original extraction catalog.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { Citation } from "@beep/law-practice-domain/values";
import { CitationDocumentStepContainers } from "@beep/law-practice-server/internal/Citation/DocumentCleanerProtocols";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationSemanticExtraction } from "@beep/law-practice-server/internal/Citation/SemanticExtraction";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { installCitationDocumentExtractionFixture } from "./CitationDocumentExtraction.fixtures.ts";
import { citationExtractionRawRequest } from "./CitationExtractionEntry.fixtures.ts";
import { makeCitationOccurrenceTestAdapter } from "./CitationOccurrenceProjection.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
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
  ReturnType<typeof installCitationDocumentExtractionFixture>
>["corpus"]["cases"][number]["expected"][number];
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
});
const semanticTextUnits = Effect.fnUntraced(function* (unicode: Unicode, original: SourceRow) {
  let units = 0;
  for (const value of [...R.values(original.token.groups), ...R.values(original.metadata)]) {
    if (value === null || typeof value === "number") continue;
    units += (yield* unicode.fromStorage(value)).utf16Units;
  }
  return units;
});
const assertSemanticDocument = Effect.fnUntraced(function* (
  unicode: Unicode,
  citations: ReadonlyArray<Citation>,
  expected: ReadonlyArray<SourceRow>
) {
  expect(citations).toHaveLength(expected.length);
  const amounts = yield* Effect.forEach(
    A.zip(citations, expected),
    Effect.fnUntraced(function* ([citation, original]) {
      yield* assertSemanticSource(unicode, citation, original);
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
  const { corpus, setup, configuration, translated, provided, adapter } =
    yield* installCitationDocumentExtractionFixture(kind);
  const rows = A.filter(corpus.cases, (row) => full || A.contains([4, 14, 18, 20, 22, 26, 32], row.id));
  const fs = yield* FileSystem.FileSystem;
  const vocabulary = yield* fs.readFileString(
    NodeURL.fileURLToPath(new URL("../assets/citation/semantic-editions.json", import.meta.url))
  );
  const config = {
    extraction: configuration,
    semantic: { vocabulary, editions: configuration.extraction.loop.full.editions },
  };
  const context = Context.add(provided, CitationDocumentStepContainers, { create: adapter.create });
  const install = (limits: typeof setup.limits, input = config) =>
    makeCitationSemanticExtraction(limits, setup.runtime, input).pipe(
      Effect.provideContext(context),
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
    const request = yield* citationExtractionRawRequest(unicode, row);
    const invocation = stage.extract(request);
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const result = yield* closed;
    if (result.raw.outcome._tag !== "Document") return yield* Effect.die("expected original Document branch");
    yield* assertCitationTokenizedExtractionRow(result.raw.outcome.result.extraction, row, translated);
    const projectedUnits = yield* assertSemanticDocument(unicode, result.citations, row.expected);
    expect(result.reservedUnits).toBe(result.raw.reservedUnits + projectedUnits);
    yield* occurrences.verify(unicode, result, row);
  }
  expect(rows).toHaveLength(full ? 36 : 7);
  yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
});
