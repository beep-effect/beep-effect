/** Authenticated input artifact through the complete live extraction path.
 * @internal @packageDocumentation @since 0.0.0
 */
import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationSourceExtraction } from "@beep/law-practice-server/internal/Citation/SourceExtraction";
import { makeCitationSourceRequestAdapter } from "@beep/law-practice-server/internal/Citation/SourceRequest";
import { makeCitationVerifiedExtraction } from "@beep/law-practice-server/internal/Citation/VerifiedExtraction";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { assertCitationNativeRange, citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import { assertCitationTokenizedExtractionRow } from "./CitationTokenizedExtraction.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

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
  row: SourceRow,
  limits: CitationEngineLimits
) {
  const markup = row.markup.bytes.length > 0;
  const rawText = yield* unicode.fromStorage(markup ? row.markup : row.plain);
  const source = yield* citationFixtureSourceProof(rawText.text);
  const adapter = yield* makeCitationSourceRequestAdapter(limits).pipe(
    Effect.provideService(
      SourceTextResolver,
      SourceTextResolver.of({
        resolve: Effect.fn("VerifiedExtractionTest.resolveSource")(() =>
          Effect.succeed(ResolvedSourceText.make({ identity: source.source, text: source.sourceText }))
        ),
      })
    )
  );
  const request = yield* adapter.prepare({
    source: source.source,
    sourceText: rawText.text,
    role: markup ? "markup" : "plain",
    cleanSteps: markup ? ["html"] : [],
    removeAmbiguous: row.removeAmbiguous,
  });
  return { markup, rawText: rawText.text, source: request.source, request };
});
const assertResolvedRequest = Effect.fnUntraced(function* (
  installed: Installed,
  input: Effect.Success<ReturnType<typeof inputForRow>>,
  expected: VerifiedResult,
  row: SourceRow
) {
  const { setup, defaultConfiguration, engineArtifact, provided, translated } = installed;
  let calls = 0;
  const resolver = SourceTextResolver.of({
    resolve: Effect.fn("SourceExtractionTest.resolveAdmittedSource")(() =>
      Effect.gen(function* () {
        calls++;
        const admitted = yield* setup.operation.snapshot;
        expect(admitted).toMatchObject({ active: 1, queued: 0 });
        return ResolvedSourceText.make({ identity: input.source.source, text: input.rawText });
      })
    ),
  });
  const stage = yield* makeCitationSourceExtraction(setup.limits, setup.runtime, {
    engineArtifact,
    extraction: defaultConfiguration,
  }).pipe(
    Effect.provideContext(provided),
    Effect.provideService(SourceTextResolver, resolver),
    DateTime.withCurrentZoneOffset(0)
  );
  const invocation = stage.extract({
    ...input.request,
    source: input.source.source,
    sourceText: input.rawText,
  });
  const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
  const actual = yield* closed;
  expect(calls).toBe(1);
  expect(actual.source).toEqual(expected.source);
  expect(actual.semantic.citations).toEqual(expected.semantic.citations);
  expect(actual.reservedUnits).toBe(expected.reservedUnits);
  if (actual.semantic.raw.outcome._tag !== "Document") return yield* Effect.die("expected resolved Document");
  yield* assertCitationTokenizedExtractionRow(actual.semantic.raw.outcome.result.extraction, row, translated);
  yield* assertOutputEvidence(actual, row);
  const beforeRefusal = yield* setup.observed.snapshot;
  const refused = yield* stage
    .extract({
      source: input.source.source,
      sourceText: "wrong",
      role: input.request.role,
    })
    .pipe(Effect.flip);
  expect(refused._tag).toBe("CitationInputError");
  const afterRefusal = yield* setup.observed.snapshot;
  expect(afterRefusal).toEqual(beforeRefusal);
  const released = yield* setup.operation.snapshot;
  expect(released).toMatchObject({ active: 0, queued: 0 });
});
/** No test-generated output evidence: the production composition derives it. */
export const replayCitationVerifiedExtraction = Effect.fn("VerifiedExtractionTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const installed = yield* installCitationDefaultConfigurationFixture(kind);
  const { corpus, setup, defaultConfiguration, engineArtifact, translated, provided } = installed;
  const rows = A.filter(corpus.cases, (row) => full || A.contains([4, 26, 32], row.id));
  const config = { engineArtifact, extraction: defaultConfiguration };
  const stage = yield* makeCitationVerifiedExtraction(setup.limits, setup.runtime, config).pipe(
    Effect.provideContext(provided),
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
    const input = yield* inputForRow(unicode, row, setup.limits).pipe(Effect.provideContext(provided));
    const invocation = stage.extract(input.request);
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const actual = yield* closed;
    if (actual.semantic.raw.outcome._tag !== "Document") return yield* Effect.die("expected original Document branch");
    yield* assertCitationTokenizedExtractionRow(actual.semantic.raw.outcome.result.extraction, row, translated);
    assertManifestation(actual, input.source, input.rawText, input.markup);
    yield* assertOutputEvidence(actual, row);
    expect(actual.reservedUnits).toBe(actual.occurrences.reservedUnits);
    expect(actual.reservedUnits).toBeGreaterThan(actual.semantic.reservedUnits);
    if (!full) yield* assertResolvedRequest(installed, input, actual, row);
  }
  expect(rows).toHaveLength(full ? 36 : 3);
  yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
});
