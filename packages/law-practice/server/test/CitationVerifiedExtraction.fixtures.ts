/** Authenticated input artifact through the complete live extraction path.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationDocumentStepContainers } from "@beep/law-practice-server/internal/Citation/DocumentCleanerProtocols";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationVerifiedExtraction } from "@beep/law-practice-server/internal/Citation/VerifiedExtraction";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { assertCitationNativeRange, citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import { assertCitationTokenizedExtractionRow } from "./CitationTokenizedExtraction.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

type Installed = Effect.Success<ReturnType<typeof installCitationDefaultConfigurationFixture>>;
type SourceRow = Installed["corpus"]["cases"][number];
type VerifiedResult = Effect.Success<
  ReturnType<Effect.Success<ReturnType<typeof makeCitationVerifiedExtraction>>["extract"]>
>;
const assertOutputEvidence = Effect.fnUntraced(function* (actual: VerifiedResult, row: SourceRow) {
  expect(actual.occurrences.unverified).toEqual([]);
  expect(actual.occurrences.unverifiedComponents).toEqual([]);
  expect(actual.occurrences.mentions).toHaveLength(row.expected.length);
  for (const [mention, expected] of A.zip(actual.occurrences.mentions, row.expected)) {
    yield* assertCitationNativeRange(actual.source.source.sourceText, expected.span, mention.anchor.anchor);
    const fullSpan = O.getOrThrow(A.findFirst(mention.components, (component) => component.name === "fullSpan"));
    yield* assertCitationNativeRange(actual.source.source.sourceText, expected.fullSpan, fullSpan.anchor.anchor);
    expect(mention.anchor.source).toEqual(actual.source.source.source);
  }
});
const assertManifestation = (actual: VerifiedResult, source: VerifiedSourceText, rawText: string, markup: boolean) => {
  expect(S.is(VerifiedSourceText)(actual.source.source)).toBe(true);
  expect(actual.source.parent).toEqual(source.source);
  expect(actual.source.source.source.sourceDigest).toBe(source.source.sourceDigest);
  expect(actual.source.source.source.normalizationVersion).toBe(source.source.normalizationVersion);
  if (markup) {
    expect(actual.source._tag).toBe("Derived");
    expect(actual.source.source.sourceText).not.toBe(rawText);
    expect(actual.source.source.source.textDigest).not.toBe(source.source.textDigest);
    expect(actual.source.source.source.extractor.name).toBe("citation-document-text");
  } else {
    expect(actual.source._tag).toBe("Unchanged");
    expect(actual.source.source).toBe(source);
  }
};
const inputForRow = Effect.fnUntraced(function* (
  unicode: Effect.Success<ReturnType<typeof makeCitationPythonUnicode>>,
  row: SourceRow
) {
  const markup = row.markup.bytes.length > 0;
  const rawText = yield* unicode.fromStorage(markup ? row.markup : row.plain);
  const source = yield* citationFixtureSourceProof(rawText.text);
  return {
    markup,
    rawText: rawText.text,
    source,
    request: {
      source,
      role: markup ? "markup" : "plain",
      cleanSteps: markup ? ["html"] : [],
      removeAmbiguous: row.removeAmbiguous,
    },
  };
});
/** No test-generated output evidence: the production composition derives it. */
export const replayCitationVerifiedExtraction = Effect.fn("VerifiedExtractionTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const { corpus, setup, defaultConfiguration, engineArtifact, translated, provided, adapter } =
    yield* installCitationDefaultConfigurationFixture(kind);
  const rows = A.filter(corpus.cases, (row) => full || A.contains([4, 26, 32], row.id));
  const config = { engineArtifact, extraction: defaultConfiguration };
  const context = Context.add(provided, CitationDocumentStepContainers, { create: adapter.create });
  const stage = yield* makeCitationVerifiedExtraction(setup.limits, setup.runtime, config).pipe(
    Effect.provideContext(context),
    DateTime.withCurrentZoneOffset(0)
  );
  const input = yield* citationFixtureSourceProof("eyecite");
  let ignored = 0;
  const shortcut = yield* stage.extract({
    source: input,
    role: "plain",
    get cleanSteps() {
      ignored++;
      return Symbol("ignored");
    },
  });
  expect(ignored).toBe(0);
  expect(shortcut.source._tag).toBe("Unchanged");
  expect(shortcut.source.source).toBe(input);
  expect(shortcut.occurrences.mentions).toEqual([]);
  expect(shortcut.occurrences.unverified).toHaveLength(1);
  const noChildren = yield* setup.observed.snapshot;
  expect(noChildren).toEqual({ spawned: 0, confirmed: 0 });
  const forged = yield* stage
    .extract({ source: { source: input.source, sourceText: "eyecite" }, role: "plain" })
    .pipe(Effect.flip);
  expect(forged).toMatchObject({ reason: "invalid-input" });
  const unicode = yield* makeCitationPythonUnicode(setup.limits).pipe(Effect.provideContext(provided));
  for (const row of rows) {
    const input = yield* inputForRow(unicode, row);
    const invocation = stage.extract(input.request);
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const actual = yield* closed;
    if (actual.semantic.raw.outcome._tag !== "Document") return yield* Effect.die("expected original Document branch");
    yield* assertCitationTokenizedExtractionRow(actual.semantic.raw.outcome.result.extraction, row, translated);
    assertManifestation(actual, input.source, input.rawText, input.markup);
    yield* assertOutputEvidence(actual, row);
    expect(actual.reservedUnits).toBe(actual.occurrences.reservedUnits);
    expect(actual.reservedUnits).toBeGreaterThan(actual.semantic.reservedUnits);
  }
  expect(rows).toHaveLength(full ? 36 : 3);
  yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
});
