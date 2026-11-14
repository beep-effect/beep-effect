import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { CitationCleanerValues } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { makeCitationHtmlDiscoveryRunner } from "@beep/law-practice-server/internal/Citation/HtmlDiscovery";
import {
  CitationInvocation,
  CitationInvocationPolicy,
  openCitationInvocation,
} from "@beep/law-practice-server/internal/Citation/Invocation";
import {
  CitationCleaner,
  CitationCleanerFailure,
  CitationCleanerTextCharge,
  CitationCleanerWorkSnapshot,
  CitationEngineCleanInput,
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { citationNativeNodeTestPlatform } from "./CitationNativeSpawner.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationCleanerWork } from "@beep/law-practice-use-cases/server";

const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
// A host owns its ledger and tickets when it calls the closed port directly.
const hostWork = (maximum: number): CitationCleanerWork => {
  let produced = 0;
  const reserveText = Effect.fn("NativeLaneCleanerTest.hostReserve")(function* (units: number) {
    if (units <= 0 || units > maximum - produced)
      return yield* CitationSafetyLimitExceeded.make({ operation: "clean", limit: "producedTextUtf16" });
    produced += units;
    return CitationCleanerTextCharge.make({ units });
  });
  return {
    reserveText,
    nested: Effect.fn("NativeLaneCleanerTest.hostNested")(() =>
      Effect.fail(CitationCleanerFailure.make({ reason: "unknown-step" }))
    ),
    snapshot: Effect.sync(() => CitationCleanerWorkSnapshot.make({ producedTextUtf16: produced, closed: false })),
    withTextCapacity: Effect.fn("NativeLaneCleanerTest.hostCapacity")(function* (produce) {
      const result = yield* produce(maximum - produced);
      const charges = result.units === 0 ? [] : [yield* reserveText(result.units)];
      return { value: result.value, charges };
    }),
  };
};
it.layer(
  process.versions.bun === undefined
    ? citationNativeNodeTestPlatform
    : Layer.merge(citationTokenizerTestLayer, BunCrypto.layer),
  { excludeTestServices: true, concurrent: false, timeout: "30 seconds" }
)("cleaner boundary native authority", (it) => {
  for (const kind of ["bun", "node"] as const) {
    it.effect(
      `runs engine HTML clean, a direct host call, and regex before HTML on ${kind}`,
      () =>
        Effect.gen(function* () {
          const installed = yield* installCitationDefaultConfigurationFixture(kind);
          const { setup, adapter, provided } = installed;
          const originalAcquire = setup.admission.acquire;
          let acquisitions = 0;
          let maximumUnits = 0;
          const acquire = Effect.fn("NativeLaneCleanerTest.observeAdmission")(function* (
            operation: Parameters<typeof originalAcquire>[0]
          ) {
            const lease = yield* originalAcquire(operation);
            const snapshot = yield* setup.admission.snapshot;
            acquisitions++;
            maximumUnits = Math.max(maximumUnits, snapshot.active);
            return lease;
          });
          Reflect.set(setup.admission, "acquire", acquire);
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              Reflect.set(setup.admission, "acquire", originalAcquire);
            })
          );
          const proof = yield* citationFixtureSourceProof("<p>Example</p>");
          const resolver = SourceTextResolver.of({
            resolve: Effect.fn("NativeLaneCleanerTest.source")(() =>
              Effect.succeed(ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText }))
            ),
          });
          const { engine } = yield* buildCitationEngineFixture(installed, resolver);
          const steps = yield* adapter.create({ kind: "list", names: ["html"] });
          const plan = yield* adapter.document.plan(steps);
          const request = yield* S.decodeEffect(CitationEngineCleanInput)({
            source: proof.source,
            sourceText: proof.sourceText,
            plan,
          });
          const clean = yield* engine.clean(request);
          expect(O.getOrThrow(clean.text)).toEqual(word("Example"));
          const afterEngine = yield* setup.admission.snapshot;
          expect(afterEngine).toMatchObject({ active: 0, quarantined: 0 });
          const engineCounts = yield* setup.observed.snapshot;
          expect(engineCounts).toEqual({ spawned: 1, confirmed: 1 });
          const cleaner = Context.get(provided, CitationCleaner);
          const values = Context.get(provided, CitationCleanerValues);
          const work = hostWork(setup.limits.producedTextUtf16);
          const name = yield* values.builtinName("html");
          const callable = yield* cleaner.get(name, work);
          const source = yield* cleaner.fromText(proof.sourceText);
          const host = yield* cleaner.invoke(callable, source, work);
          const hostText = yield* values.getUnicode(host.value);
          expect(O.getOrThrow(hostText).storage).toEqual(word("Example"));
          const afterHost = yield* setup.admission.snapshot;
          expect(afterHost).toMatchObject({ active: 0, quarantined: 0 });
          const discovery = yield* makeCitationHtmlDiscoveryRunner(
            setup.limits,
            setup.runtime,
            installed.defaultConfiguration.extraction.document.discovery
          ).pipe(Effect.provideContext(provided));
          // Deliberately reverse the built-in order through a direct-stage invocation.
          yield* openCitationInvocation(
            CitationInvocationPolicy.make({
              limits: setup.limits,
              operation: "extract",
              deadlineStarts: "before-admission",
            }),
            Effect.gen(function* () {
              const invocation = yield* CitationInvocation;
              yield* discovery.placeholder(word(proof.sourceText));
              const before = yield* invocation.lane.snapshot;
              expect(before).toMatchObject({ started: 1, confirmed: 1, acquired: true, unitsAcquired: 1 });
              const cleaned = yield* invocation.lane.yieldTo(
                cleaner.invoke(callable, source, hostWork(setup.limits.producedTextUtf16))
              );
              const text = yield* values.getUnicode(cleaned.value);
              expect(O.getOrThrow(text).storage).toEqual(word("Example"));
              const after = yield* invocation.lane.snapshot;
              expect(after).toMatchObject({ started: 1, confirmed: 1, acquired: false, unitsAcquired: 1 });
            })
          ).pipe(Effect.provideContext(provided));
          expect(acquisitions).toBe(4);
          expect(maximumUnits).toBe(1);
          const final = yield* setup.observed.snapshot;
          expect(final).toEqual({ spawned: 4, confirmed: 4 });
          const maximum = yield* setup.observed.maximumAlive;
          expect(maximum).toBe(1);
          const released = yield* setup.admission.snapshot;
          expect(released).toMatchObject({ active: 0, queued: 0, quarantined: 0 });
        }),
      { timeout: 120000 }
    );
  }
});
