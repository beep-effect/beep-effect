import { ResolvedSourceText, SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
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
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as References from "effect/References";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture, buildCitationEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
// One engine at a time: each case runs real extractions on real native workers against the
// declared 50 s `operationDeadline` on a real clock. Four engines at once on a 4-vCPU hosted
// runner pushed one extraction past it (`CitationSafetyLimitExceeded`, `operationDeadline`).
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
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
              const closedExtract = yield* engine.extract(extractionInput).pipe(Effect.flip);
              expect(closedExtract).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
              const closedResolve = yield* engine.resolve(resolutionInput).pipe(Effect.flip);
              expect(closedResolve).toMatchObject({ _tag: "CitationInputError", operation: "resolve" });
              const closedAnnotate = yield* engine.annotate(annotationInput).pipe(Effect.flip);
              expect(closedAnnotate).toMatchObject({ _tag: "CitationAnnotationError" });
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

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { concurrent: false })(
  "engine deadline admission ordering",
  (it) => {
    it.layer(TestClock.layer())("manual clock", (it) => {
      for (const kind of ["bun", "node"] as const) {
        for (const [method, releasePermit] of [
          ["extract", false],
          ["annotate", false],
          ["clean", false],
          ["resolve", false],
          ["extract", true],
        ] as const) {
          it.effect(
            `counts queue wait against the ${kind} ${method} deadline (${releasePermit ? "queue plus work" : "queued refusal"})`,
            () =>
              Effect.gen(function* () {
                const installed = yield* installCitationDefaultConfigurationFixture(kind);
                const clock = yield* Clock.Clock;
                const limits = {
                  ...installed.setup.limits,
                  concurrentOperations: 1,
                  queuedOperations: 1,
                  extractDeadline: Duration.seconds(releasePermit ? 10 : 1),
                  annotateDeadline: Duration.seconds(1),
                  cleanDeadline: Duration.seconds(1),
                  resolveDeadline: Duration.seconds(1),
                  queueDeadline: Duration.seconds(5),
                  operationDeadline: Duration.seconds(30),
                };
                const operation = yield* makeCitationOperationAdmission(limits);
                const provided = installed.provided.pipe(
                  Context.add(Clock.Clock, clock),
                  Context.add(CitationOperationAdmission, operation)
                );
                const setup = { ...installed.setup, limits, operation, provided };
                const entered = yield* Deferred.make<void>();
                const release = yield* Deferred.make<void>();
                const working = yield* Deferred.make<void>();
                const proof = yield* citationFixtureSourceProof("deadline probe");
                let refuseStage = false;
                const resolver = SourceTextResolver.of({
                  resolve: Effect.fn("EngineDeadlineTest.resolve")(function* () {
                    if (refuseStage)
                      return yield* SourceTextResolverError.new("source-unavailable", "controlled stage refusal");
                    if (!releasePermit) return yield* Effect.never;
                    yield* Deferred.succeed(working, undefined);
                    yield* Effect.sleep(Duration.millis(9500));
                    return yield* SourceTextResolverError.new("source-unavailable", "controlled refusal after work");
                  }),
                });
                const { engine } = yield* buildCitationEngineFixture({ ...installed, setup, provided }, resolver);
                let logs = A.empty<unknown>();
                const logger = Logger.make((entry) => {
                  logs = A.append(logs, entry.message);
                });
                const capture = yield* Layer.build(Logger.layer([logger]));
                const holder = yield* operation
                  .run("extract", Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release))))
                  .pipe(Effect.forkChild);
                yield* Deferred.await(entered);
                const request = yield* S.decodeEffect(CitationEngineSourcePairInput)({
                  plain: { source: proof.source, sourceText: proof.sourceText },
                  cleanSteps: [],
                });
                const slot = { source: proof.source, sourceText: proof.sourceText };
                const annotation = yield* S.decodeEffect(CitationEngineAnnotationInput)({
                  plain: slot,
                  replacements: [],
                });
                const steps = yield* installed.adapter.create({ kind: "list", names: ["underscores"] });
                const plan = yield* installed.adapter.document.plan(steps);
                const clean = yield* S.decodeEffect(CitationEngineCleanInput)({ ...slot, plan });
                const resolution = CitationEngineResolutionInput.make({ ...slot, mentions: [] });
                const calls = {
                  extract: engine.extract(request).pipe(Effect.asVoid),
                  annotate: engine.annotate(annotation).pipe(Effect.asVoid),
                  clean: engine.clean(clean).pipe(Effect.asVoid),
                  resolve: engine.resolve(resolution).pipe(Effect.asVoid),
                };
                const pending = yield* calls[method].pipe(
                  Effect.provideContext(capture),
                  Effect.provideService(References.MinimumLogLevel, "Debug"),
                  Effect.forkChild
                );
                yield* Effect.repeat(operation.snapshot, { until: (state) => state.queued === 1 });
                if (releasePermit) {
                  yield* TestClock.adjust(Duration.millis(800));
                  yield* Deferred.succeed(release, undefined);
                  yield* Fiber.join(holder);
                  yield* Deferred.await(working);
                  yield* TestClock.adjust(Duration.millis(9200));
                } else {
                  yield* TestClock.adjust(Duration.seconds(1));
                }
                const failure = yield* Fiber.join(pending).pipe(Effect.flip);
                expect(failure).toMatchObject({
                  _tag: "CitationSafetyLimitExceeded",
                  operation: method,
                  limit: `${method}Deadline`,
                });
                if (method === "extract" || method === "annotate") {
                  expect(
                    A.filter(
                      logs,
                      (message) =>
                        A.isArray(message) &&
                        A.contains(
                          message,
                          `Citation ${method === "extract" ? "extraction" : "annotation"} boundary refused`
                        )
                    )
                  ).toHaveLength(1);
                }
                const state = yield* operation.snapshot;
                expect(state).toMatchObject({ active: releasePermit ? 0 : 1, queued: 0 });
                yield* Deferred.succeed(release, undefined);
                yield* Fiber.join(holder);
                if (method === "extract" || method === "annotate") {
                  refuseStage = true;
                  const refusal = calls[method];
                  const refused = yield* refusal.pipe(
                    Effect.provideContext(capture),
                    Effect.provideService(References.MinimumLogLevel, "Debug"),
                    Effect.flip
                  );
                  expect(refused).toMatchObject({
                    _tag: "CitationPrerequisiteError",
                    operation: method,
                    dependency: "source-evidence",
                  });
                  expect(
                    A.filter(
                      logs,
                      (message) =>
                        A.isArray(message) &&
                        A.contains(
                          message,
                          `Citation ${method === "extract" ? "extraction" : "annotation"} boundary refused`
                        )
                    )
                  ).toHaveLength(2);
                }
                const observed = yield* setup.observed.snapshot;
                expect(observed).toEqual({ spawned: 0, confirmed: 0 });
              }),
            { timeout: 60000 }
          );
        }
      }
    });
  }
);
