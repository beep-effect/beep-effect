import { ResolvedSourceText, SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import { captureCitationMentionReceiptData } from "@beep/law-practice-server/internal/Citation/Mention";
import { CitationNativeProcessRuntime } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { CitationEngineDefaultConfiguration } from "@beep/law-practice-server/layer";
import {
  CitationAnnotationReplacement,
  CitationEngineAnnotationInput,
  CitationEngineCleanInput,
  CitationEngineResolutionInput,
  CitationEngineSourcePairInput,
  CitationPythonUnicodeStorage,
} from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture, buildCitationEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "four-operation engine Layer",
  (it) => {
    for (const [kind, assembly] of [
      ["bun", "captured"],
      ["node", "captured"],
      ["bun", "default"],
      ["node", "default"],
    ] as const) {
      it.effect(
        `captures ${assembly} owners and executes all four operations on ${kind}`,
        () =>
          Effect.gen(function* () {
            const installed = yield* installCitationDefaultConfigurationFixture(kind);
            const { setup } = installed;
            let operation = setup.operation;
            const proof = yield* citationFixtureSourceProof("Foo v. Bar, 1 U.S. 1 (2000). Id. at 2.");
            const slot = { source: proof.source, sourceText: proof.sourceText };
            let sourceCalls = 0;
            const resolver = SourceTextResolver.of({
              resolve: Effect.fn("EngineLayerTest.resolve")(function* () {
                const state = yield* operation.snapshot;
                expect(state).toMatchObject({ active: 1, queued: 0 });
                sourceCalls++;
                return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
              }),
            });
            const originalDeadline = Duration.toMillis(setup.limits.cleanDeadline);
            const engineScope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
            const built =
              assembly === "default"
                ? yield* buildCitationDefaultEngineFixture(installed, resolver).pipe(
                    Effect.provideService(Scope.Scope, engineScope)
                  )
                : yield* buildCitationEngineFixture(installed, resolver).pipe(
                    Effect.map((result) => ({
                      ...result,
                      operation: setup.operation,
                      admission: setup.admission,
                      adapter: installed.adapter,
                    }))
                  );
            const { engine, configuration, adapter } = built;
            operation = built.operation;
            if (assembly === "default") {
              expect(operation).not.toBe(setup.operation);
              expect(built.admission).not.toBe(setup.admission);
            }
            expect(Reflect.set(configuration.limits.cleanDeadline.value, "millis", 1)).toBe(true);
            expect(Reflect.set(configuration.runtime, "workerFile", "changed-after-installation")).toBe(true);
            const late = SourceTextResolver.of({
              resolve: Effect.fn("EngineLayerTest.late")(() =>
                Effect.fail(SourceTextResolverError.new("source-unavailable", "later resolver must be ignored"))
              ),
            });
            const steps = yield* adapter.create({ kind: "list", names: ["underscores"] });
            const plan = yield* adapter.document.plan(steps);
            const cleanInput = yield* S.decodeEffect(CitationEngineCleanInput)({ ...slot, plan });
            const cleaned = yield* engine.clean(cleanInput).pipe(Effect.provideService(SourceTextResolver, late));
            expect(O.getOrThrow(cleaned.text)).toEqual(word(proof.sourceText));
            expect(Duration.toMillis(cleaned.report.limits.cleanDeadline)).toBe(originalDeadline);
            const extractionInput = yield* S.decodeEffect(CitationEngineSourcePairInput)({
              plain: slot,
              cleanSteps: [],
            });
            const extracted = yield* engine
              .extract(extractionInput)
              .pipe(Effect.provideService(SourceTextResolver, late));
            expect(extracted.document.mentions).toHaveLength(2);
            expect(extracted.document.authorities).toHaveLength(1);
            const resolutionInput = CitationEngineResolutionInput.make({
              ...slot,
              mentions: A.map(extracted.document.mentions, captureCitationMentionReceiptData),
            });
            const resolved = yield* engine
              .resolve(resolutionInput)
              .pipe(Effect.provideService(SourceTextResolver, late));
            expect(resolved.document).toEqual(extracted.document);
            const annotationInput = yield* S.decodeEffect(CitationEngineAnnotationInput)({
              plain: slot,
              replacements: [
                CitationAnnotationReplacement.make({
                  start: 12,
                  end: 20,
                  before: word("<cite>"),
                  after: word("</cite>"),
                }),
              ],
            });
            const annotated = yield* engine
              .annotate(annotationInput)
              .pipe(Effect.provideService(SourceTextResolver, late));
            expect(annotated.text).toEqual(word("Foo v. Bar, <cite>1 U.S. 1</cite> (2000). Id. at 2."));
            expect(
              A.map([cleaned.report, extracted.report, resolved.report, annotated.report], (report) => report.operation)
            ).toEqual(["clean", "extract", "resolve", "annotate"]);
            expect(sourceCalls).toBe(4);
            yield* assertCitationWorkerCompositionObserved(built.operation, built.admission, setup.observed.snapshot);
            if ("build" in built) {
              const before = yield* setup.observed.snapshot;
              const mixed = CitationEngineDefaultConfiguration.make({
                ...built.configuration,
                runtime: CitationNativeProcessRuntime.make({
                  ...built.configuration.runtime,
                  kind: kind === "bun" ? "node" : "bun",
                }),
              });
              const mixedFailure = yield* built.build(mixed).pipe(Effect.flip);
              expect(mixedFailure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
              const missing = CitationEngineDefaultConfiguration.make({
                ...built.configuration,
                assets: { ...built.configuration.assets, parserCatalog: "missing-default-parser-catalog" },
              });
              const missingFailure = yield* built.build(missing).pipe(Effect.flip);
              expect(missingFailure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
              const valid = CitationEngineDefaultConfiguration.make({
                ...built.configuration,
                limits: { ...built.configuration.limits, cleanDeadline: Duration.millis(originalDeadline) },
              });
              const limited = CitationEngineDefaultConfiguration.make({
                ...valid,
                limits: { ...valid.limits, authorities: 4 },
              });
              const capacityFailure = yield* built.build(limited).pipe(Effect.flip);
              expect(capacityFailure).toMatchObject({
                _tag: "CitationSafetyLimitExceeded",
                operation: "extract",
                limit: "authorities",
              });
              const path = yield* Path.Path;
              const htmlFailure = yield* built.build(valid).pipe(
                Effect.provideService(Path.Path, {
                  ...path,
                  // Keep ordinary asset resolution intact; the HTML worker receives
                  // the platform's real BadArgument for a non-file URL.
                  fromFileUrl: Effect.fn("EngineLayerTest.htmlPath")((url: URL) =>
                    path.fromFileUrl(
                      Str.includes("/citation-html/")(url.pathname)
                        ? new URL("https://example.invalid/not-a-file")
                        : url
                    )
                  ),
                }),
                Effect.flip
              );
              expect(htmlFailure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
              const after = yield* setup.observed.snapshot;
              expect(after).toEqual(before);
              expect(sourceCalls).toBe(4);
              yield* Scope.close(engineScope, Exit.void);
              const closed = yield* engine.clean(cleanInput).pipe(Effect.flip);
              expect(closed).toMatchObject({ _tag: "CitationInputError", operation: "clean" });
              expect(sourceCalls).toBe(4);
              const operationState = yield* built.operation.snapshot;
              const nativeState = yield* built.admission.snapshot;
              expect(operationState).toMatchObject({ active: 0, queued: 0, closed: true });
              expect(nativeState).toMatchObject({ active: 0, regexActive: 0, queued: 0, quarantined: 0, closed: true });
            }
          }),
        { timeout: 180000 }
      );
    }
  }
);

const PropertyType = S.toType(CitationEngineCleanInput);
const PropertyJson = CitationEngineCleanInput.pipe(S.toCodecJson, S.fromJsonString);
const propertyEquivalent = S.toEquivalence(PropertyType);
it.effect.prop(
  "preserves clean request defaults and ordered step selections through JSON",
  { value: Arbitrary.schema(PropertyType) },
  ({ value }) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(PropertyJson)(value);
      const decoded = yield* S.decodeEffect(PropertyJson)(encoded);
      expect(propertyEquivalent(value, decoded)).toBe(true);
    }),
  { arbitrary: fcRuns(100) }
);
