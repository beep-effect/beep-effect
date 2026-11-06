/** Primitive request replay, original early return and captured cleaner ports.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationDocumentStepContainers } from "@beep/law-practice-server/internal/Citation/DocumentCleanerProtocols";
import { makeCitationExtractionEntry } from "@beep/law-practice-server/internal/Citation/ExtractionEntry";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { installCitationDocumentExtractionFixture } from "./CitationDocumentExtraction.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import { assertCitationTokenizedExtractionRow } from "./CitationTokenizedExtraction.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

type SourceRow = Effect.Success<ReturnType<typeof installCitationDocumentExtractionFixture>>["corpus"]["cases"][number];
const rawRequest = Effect.fn("ExtractionEntryTest.request")(function* (
  unicode: Effect.Success<ReturnType<typeof makeCitationPythonUnicode>>,
  row: SourceRow
) {
  const hasMarkup = row.markup.bytes.length > 0;
  const plain = yield* unicode.fromStorage(row.plain);
  const markup = yield* unicode.fromStorage(row.markup);
  return {
    plain: hasMarkup ? null : plain.text,
    markup: hasMarkup ? markup.text : null,
    cleanSteps: hasMarkup ? ["html"] : [],
    removeAmbiguous: row.removeAmbiguous,
  };
});
/** Full and smoke both install the complete tokenizer and actual native cleaners. */
export const replayCitationExtractionEntry = Effect.fn("ExtractionEntryTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const { corpus, setup, configuration, translated, provided, adapter, values } =
    yield* installCitationDocumentExtractionFixture(kind);
  const entryContext = Context.add(provided, CitationDocumentStepContainers, { create: adapter.create });
  const install = (limits: typeof setup.limits) =>
    makeCitationExtractionEntry(limits, setup.runtime, configuration).pipe(
      Effect.provideContext(entryContext),
      DateTime.withCurrentZoneOffset(0)
    );
  const stage = yield* install(setup.limits);
  const other = yield* install(setup.limits);
  let ignored = 0;
  const before = yield* setup.observed.snapshot;
  const issued = yield* values.snapshot;
  const first = yield* stage.extract({
    plain: "eyecite",
    get markup() {
      ignored++;
      return Symbol("ignored markup");
    },
    get cleanSteps() {
      ignored++;
      return Symbol("ignored steps");
    },
    get removeAmbiguous() {
      ignored++;
      return Symbol("ignored mode");
    },
  });
  const second = yield* other.extract({ plain: "eyecite" });
  expect(first.outcome._tag).toBe("Shortcut");
  expect(second.outcome).toBe(first.outcome);
  expect(first.reservedUnits).toBe(0);
  expect(ignored).toBe(0);
  const after = yield* setup.observed.snapshot;
  expect(after).toEqual(before);
  const issuance = yield* values.snapshot;
  expect(issuance).toEqual(issued);
  const limited = yield* install({ ...setup.limits, sourceUtf16: 3 });
  const refused = yield* limited.extract({ plain: "eyecite" }).pipe(Effect.flip);
  expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "sourceUtf16" });
  const empty = yield* stage.extract({}).pipe(Effect.flip);
  expect(empty).toMatchObject({
    _tag: "CitationDocumentInputFailure",
    reason: "empty-input",
    sourceError: "ValueError",
  });
  const missingSteps = yield* stage.extract({ markup: "<p>Text</p>" }).pipe(Effect.flip);
  expect(missingSteps).toMatchObject({
    _tag: "CitationDocumentInputFailure",
    reason: "source-protocol",
    sourceError: "TypeError",
  });
  const unicode = yield* makeCitationPythonUnicode(setup.limits).pipe(Effect.provideContext(provided));
  const rows = A.filter(corpus.cases, (row) => full || A.contains([0, 4, 18, 20, 32], row.id));
  for (const row of rows) {
    const request = yield* rawRequest(unicode, row);
    const invocation = stage.extract(request);
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const result = yield* closed;
    if (result.outcome._tag !== "Document") return yield* Effect.die("expected original Document branch");
    yield* assertCitationTokenizedExtractionRow(result.outcome.result.extraction, row, translated);
    expect(result.reservedUnits).toBe(result.outcome.result.reservedUnits);
  }
  expect(rows).toHaveLength(full ? 36 : 5);
  const malformed = yield* stage.extract({ plain: 5 }).pipe(Effect.flip);
  expect(malformed).toMatchObject({ _tag: "CitationExtractionEntryFailure", reason: "invalid-input" });
  yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
});
