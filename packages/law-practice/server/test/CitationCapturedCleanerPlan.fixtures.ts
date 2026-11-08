/** Actual captured custom cleaner through public extraction, original eyecite
 * test_AnnotateTest.py straighten_quotes behavior (BSD-2-Clause).
 * @internal @packageDocumentation @since 0.0.0
 */
import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { CitationCleanerProtocols } from "@beep/law-practice-server/internal/Citation/CleanerRegistry";
import {
  CitationCleanerValues,
  makeCitationCleanerValues,
} from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { makeCitationDocumentServicesFromValues } from "@beep/law-practice-server/internal/Citation/DocumentServices";
import { CitationDocumentInputProtocols } from "@beep/law-practice-server/internal/Citation/InputDocument";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import {
  CitationAnnotationReplacement,
  CitationCleanerFailure,
  CitationCleanerObject,
  CitationCleanerProduced,
  CitationEngineAnnotationInput,
  CitationEngineCleanerPlan,
  CitationEngineSourcePairInput,
  CitationExtractionCleanerPlans,
  CitationInputError,
  CitationPythonUnicodeStorage,
} from "@beep/law-practice-use-cases/server";
import { CitationOracleOperations } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { readCitationCanonicalAnnotations } from "./CitationCanonicalAnnotation.fixtures.ts";
import { compareCitationCanonicalModel } from "./CitationCanonicalModel.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { makeCitationHtmlTestRuntime } from "./CitationNativeSpawner.fixtures.ts";
import { assertCitationMentionRanges, citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationCleanerTextCharge } from "@beep/law-practice-use-cases/server";

const planName = "original-straighten-quotes/v1";
const failed = () => CitationCleanerFailure.make({ reason: "callback-failed" });
const installHost = Effect.fn("CapturedCleanerTest.host")(function* (values: CitationCleanerValues["Service"]) {
  const fn = yield* values.retainHost(Symbol("straighten_quotes"));
  const steps = yield* values.retainHost(Symbol("straighten_quotes_list"));
  const calls = yield* Ref.make(0);
  const shouldFail = yield* Ref.make(false);
  const cleaner = CitationCleanerProtocols.of({
    hash: Effect.fn("CapturedCleanerTest.hash")(function* (value) {
      if (value !== fn) return yield* failed();
      return BigInt(42);
    }),
    equal: Effect.fn("CapturedCleanerTest.equal")((left, right) => Effect.succeed(left === right)),
    callable: Effect.fn("CapturedCleanerTest.callable")((value) => Effect.succeed(value === fn)),
    invoke: Effect.fn("CapturedCleanerTest.invoke")(function* (callable, input, work) {
      expect(callable).toBe(fn);
      yield* Ref.update(calls, (count) => count + 1);
      if (yield* Ref.get(shouldFail)) return yield* failed();
      const text = yield* values.getText(input).pipe(Effect.flatMap(Effect.fromOption(failed)));
      const charges = A.empty<CitationCleanerTextCharge>();
      const units = Str.length(text.text);
      if (units > 0) {
        const charge = yield* work.reserveText(units);
        charges.push(charge);
      }
      // The original callback is a literal one-character replacement. Its
      // implementation never reads a source oracle outcome or expected model.
      const result = yield* values.sourceText(Str.replaceAll("’", "'")(text.text));
      return CitationCleanerProduced.make({ value: result, charges });
    }),
    open: Effect.fn("CapturedCleanerTest.open")(function* (name) {
      if (name !== planName) return yield* failed();
      const done = yield* Ref.make(false);
      return { next: Ref.getAndSet(done, true).pipe(Effect.map((wasDone) => (wasDone ? O.none() : O.some(fn)))) };
    }),
  });
  const document = CitationDocumentInputProtocols.of({
    truth: Effect.fn("CapturedCleanerTest.truth")(function* (value) {
      if (value !== steps) return yield* failed();
      return true;
    }),
    containsHtml: Effect.fn("CapturedCleanerTest.contains")(function* (value) {
      if (value !== steps) return yield* failed();
      return false;
    }),
    insertSourceHtml: Effect.fn("CapturedCleanerTest.insert")(() => Effect.fail(failed())),
    plan: Effect.fn("CapturedCleanerTest.plan")(function* (value) {
      if (value !== steps) return yield* failed();
      return planName;
    }),
    warnHtmlAdded: Effect.fail(failed()),
  });
  const plans = CitationExtractionCleanerPlans.of({
    resolve: Effect.fn("CapturedCleanerTest.resolve")(function* (name) {
      if (name === planName) return steps;
      if (name === "forged") return CitationCleanerObject.make({ slot: steps.slot });
      return yield* failed();
    }),
  });
  return { cleaner, document, plans, calls, shouldFail };
});

/** Replay the original custom callable input through the real configured Layer,
 * then prove unknown/forged plan refusal and public callback-error redaction.
 * Host hash values are controlled fixture inputs, not native hash attestation.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCapturedCleanerPlan = Effect.fn("CapturedCleanerTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const corpus = yield* readCitationOracleFixture(
    "operation-cases",
    "ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1"
  ).pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(CitationOracleOperations))));
  const id = "tests.test_AnnotateTest.AnnotateTest.test_annotate::tests/test_AnnotateTest.py:241:24:get_citations::16";
  const row = yield* Effect.fromOption(A.findFirst(corpus.cases, (row) => row.id === id));
  if (row.operation !== "get_citations") return yield* Effect.die("Expected original extraction");
  const body = row.payload.value;
  if (body.outcome.kind !== "success") return yield* Effect.die("Expected original successful custom cleaner");
  expect(body.input.clean_steps).toEqual([
    {
      callable: "tests.test_AnnotateTest.AnnotateTest.test_annotate.<locals>.straighten_quotes",
      line: 12,
      path: "tests/test_AnnotateTest.py",
      sourceSha256: "f9d2f4d06e154a10d33952c07152348c9105bdb32b1eae2f84b1c9cbd5f31aec",
    },
  ]);
  expect(body.input.markup_text).toBe("");
  expect(body.input.remove_ambiguous).toBe(false);
  const installed = yield* installCitationDefaultConfigurationFixture(kind);
  const values = yield* makeCitationCleanerValues(installed.setup.limits);
  const host = yield* installHost(values);
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-captured-plan-" });
  const htmlRuntime = yield* makeCitationHtmlTestRuntime(kind, directory);
  const hostContext = installed.provided.pipe(
    Context.add(CitationCleanerValues, values),
    Context.add(CitationCleanerProtocols, host.cleaner),
    Context.add(CitationDocumentInputProtocols, host.document)
  );
  const services = yield* makeCitationDocumentServicesFromValues(installed.setup.limits, htmlRuntime).pipe(
    Effect.provideContext(hostContext)
  );
  expect(services.values).toBe(values);
  const proof = yield* citationFixtureSourceProof(body.input.plain_text);
  const sources = yield* Ref.make<ReadonlyArray<typeof proof>>([proof]);
  const resolver = SourceTextResolver.of({
    resolve: Effect.fn("CapturedCleanerTest.source")(function* (request) {
      const state = yield* installed.setup.operation.snapshot;
      expect(state).toMatchObject({ active: 1, queued: 0 });
      const available = yield* Ref.get(sources);
      const selected = yield* Effect.fromOption(
        A.findFirst(available, (candidate) => candidate.source.textDigest === request.identity.textDigest)
      ).pipe(Effect.orDie);
      return ResolvedSourceText.make({ identity: selected.source, text: selected.sourceText });
    }),
  });
  const provided = Context.merge(installed.provided, services.context).pipe(
    Context.add(CitationExtractionCleanerPlans, host.plans)
  );
  const { engine } = yield* buildCitationEngineFixture({ ...installed, provided }, resolver);
  const input = (plan: string) =>
    CitationEngineSourcePairInput.make({
      plain: { source: proof.source, sourceText: proof.sourceText },
      markup: null,
      cleanSteps: CitationEngineCleanerPlan.make({ plan }),
      container: "list",
      removeAmbiguous: false,
    });
  const result = yield* engine.extract(input(planName));
  expect(result.source._tag).toBe("Derived");
  expect(result.source.parent).toEqual(proof.source);
  expect(result.source.source.sourceText).toBe(body.stages.document.plainText);
  expect(result.citations).toHaveLength(body.outcome.value.length);
  for (const [index, original] of body.outcome.value.entries()) {
    yield* compareCitationCanonicalModel(A.getUnsafe(result.citations, index), original, id);
    yield* assertCitationMentionRanges(
      result.source.source.sourceText,
      A.getUnsafe(result.document.mentions, index),
      original
    );
  }
  expect(result.diagnostics.unverified).toEqual([]);
  expect(result.diagnostics.unverifiedComponents).toEqual([]);
  yield* Ref.update(sources, (current) => A.append(current, result.source.source));
  const annotations = yield* readCitationCanonicalAnnotations();
  const originalAnnotation = yield* Effect.fromOption(A.findFirst(annotations, (row) => row.ordinal === 16));
  expect(originalAnnotation.id).toBe(
    "tests.test_AnnotateTest.AnnotateTest.test_annotate::tests/test_AnnotateTest.py:261:16:caseDeclaration::16"
  );
  expect(originalAnnotation.input.source_text).toBe(body.input.plain_text);
  expect(originalAnnotation.input.document.fields.plain_text).toBe(result.source.source.sourceText);
  expect(originalAnnotation.input.annotate_kwargs).toEqual({});
  const tuples = A.map(result.document.mentions, (mention, index) => {
    const anchor = mention.anchor.anchor;
    const plain = result.source.source.sourceText;
    const start = A.fromIterable(Str.slice(0, anchor.startChar)(plain)).length;
    const end = A.fromIterable(Str.slice(0, anchor.endChar)(plain)).length;
    return Tuple.make(Tuple.make(start, end), `<${index}>`, `</${index}>`);
  });
  expect(tuples).toEqual(originalAnnotation.input.annotations);
  const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
  const annotated = yield* engine.annotate(
    CitationEngineAnnotationInput.make({
      plain: { source: result.source.source.source, sourceText: result.source.source.sourceText },
      markup: { source: proof.source, sourceText: proof.sourceText },
      mode: "unchecked",
      useDmp: true,
      replacements: A.map(tuples, ([range, before, after]) =>
        CitationAnnotationReplacement.make({ start: range[0], end: range[1], before: word(before), after: word(after) })
      ),
    })
  );
  const unicode = yield* makeCitationPythonUnicode(installed.setup.limits);
  const expected = yield* unicode.fromText(originalAnnotation.expected);
  expect(annotated.text).toEqual(expected.storage);
  const calls1 = yield* Ref.get(host.calls);
  expect(calls1).toBe(1);
  for (const name of ["unknown", "forged"]) {
    const error = yield* Effect.flip(engine.extract(input(name)));
    expect(error).toEqual(CitationInputError.make({ operation: "extract" }));
  }
  const calls2 = yield* Ref.get(host.calls);
  expect(calls2).toBe(1);
  yield* Ref.set(host.shouldFail, true);
  const callbackError = yield* Effect.flip(engine.extract(input(planName)));
  expect(callbackError).toEqual(CitationInputError.make({ operation: "extract" }));
  const calls3 = yield* Ref.get(host.calls);
  expect(calls3).toBe(2);
  const counts = yield* installed.setup.observed.snapshot;
  expect(counts.confirmed).toBe(counts.spawned);
  const state = yield* installed.setup.operation.snapshot;
  expect(state).toMatchObject({ active: 0, queued: 0 });
});
