import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { makeCitationAnnotationEntry } from "@beep/law-practice-server/internal/Citation/AnnotationEntry";
import {
  CitationInvocation,
  CitationInvocationPolicy,
  openCitationInvocation,
} from "@beep/law-practice-server/internal/Citation/Invocation";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { CitationAnnotationReplacement, CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { installCitationAnnotationEntryFixture } from "./CitationAnnotationEntry.fixtures.ts";
import { makeCitationEngineProbe } from "./CitationEngineProbe.fixtures.ts";
import { citationNativeNodeTestPlatform } from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
it.layer(
  process.versions.bun === undefined
    ? citationNativeNodeTestPlatform
    : Layer.merge(citationTokenizerTestLayer, BunCrypto.layer),
  { excludeTestServices: true, concurrent: false, timeout: "30 seconds" }
)("real markup lane composition", (it) => {
  for (const kind of ["bun", "node"] as const) {
    for (const concurrency of [1, 2]) {
      it.effect(
        `interleaves regex, Diff and Xml on ${kind} with ${concurrency} admitted requests`,
        () =>
          Effect.gen(function* () {
            const setup = yield* installCitationAnnotationEntryFixture(kind);
            const limits = {
              ...setup.limits,
              concurrentOperations: concurrency,
              concurrentRegexProcesses: concurrency,
            };
            const admission = yield* makeCitationNativeProcessAdmission(limits);
            const operation = yield* makeCitationOperationAdmission(limits);
            const context = setup.provided.pipe(
              Context.add(CitationNativeProcessAdmission, admission),
              Context.add(CitationOperationAdmission, operation)
            );
            const stage = yield* makeCitationAnnotationEntry(limits, setup.runtime, setup.configuration).pipe(
              Effect.provideContext(context)
            );
            const run = openCitationInvocation(
              CitationInvocationPolicy.make({ limits, operation: "annotate", deadlineStarts: "before-admission" }),
              Effect.gen(function* () {
                const invocation = yield* CitationInvocation;
                const result = yield* stage.annotate({
                  mode: "skip",
                  plain: word("foo 1 U.S. 1 bar"),
                  source: word("foo <i>1 U.S. 1</i> bar"),
                  replacements: [
                    CitationAnnotationReplacement.make({ start: 0, end: 16, before: word("["), after: word("]") }),
                  ],
                });
                expect(result.text).toEqual(word("[foo <i>1 U.S. 1</i> bar]"));
                const receipt = yield* invocation.lane.snapshot;
                expect(receipt.started).toBe(3);
                expect(receipt.confirmed).toBe(receipt.started);
                expect(receipt.unitsAcquired).toBe(1);
              })
            ).pipe(Effect.provideContext(context));
            const probe = yield* makeCitationEngineProbe(setup.observed.snapshot);
            const measured = yield* probe.measure(Effect.all(concurrency === 1 ? [run] : [run, run], { concurrency }));
            expect(measured.counts.nativeProcesses).toBe(3 * concurrency);
            expect(measured.counts.nativeProcessOwners).toBe(concurrency);
            expect(measured.counts.nativeLaneUnits).toBe(concurrency);
            expect(measured.counts.diffXmlWorkerConstructions).toBe(2 * concurrency);
            const maximum = yield* setup.observed.maximumAlive;
            expect(maximum).toBe(concurrency);
            const counts = yield* setup.observed.snapshot;
            expect(counts.spawned).toBe(3 * concurrency);
            expect(counts.confirmed).toBe(counts.spawned);
            const released = yield* admission.snapshot;
            expect(released).toMatchObject({ active: 0, quarantined: 0, queued: 0 });
          }),
        { timeout: 120000 }
      );
    }
  }
});
