import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { makeCitationCleanerOperation } from "@beep/law-practice-server/internal/Citation/CleanerOperation";
import {
  CitationCleaner,
  CitationCleanerFailure,
  CitationCleanerProduced,
  CitationEngineOperation,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as TestClock from "effect/testing/TestClock";
import { makeCitationCleanerRegistryHarness } from "./CitationCleanerRegistry.fixtures.ts";
import { makeCitationTestInvocationBinding, withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import type { CitationEngineFailure } from "@beep/law-practice-use-cases/server";

it.layer(BunCrypto.layer)("admitted cleaner operations", (it) => {
  it.effect("closes malformed/port failures and preserves interruption with admission release", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const h = yield* makeCitationCleanerRegistryHarness();
      const admission = yield* makeCitationOperationAdmission(limits);
      const cleaner = yield* makeCitationCleanerOperation(limits).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestInvocationBinding(limits, "clean").pipe(
            Effect.map((bind) => ({ ...stage, run: bind(stage.run), runOwned: bind(stage.runOwned) }))
          )
        ),
        Effect.provideService(CitationOperationAdmission, admission),
        Effect.provideService(CitationCleaner, h.registry.runtime)
      );
      const malformed = cleaner.run({});
      const closed: Effect.Effect<Effect.Success<typeof malformed>, CitationEngineFailure> = malformed;
      const invalid = yield* closed.pipe(Effect.flip);
      expect(invalid).toMatchObject({ _tag: "CitationInputError", operation: "clean" });
      h.hooks({
        open: Effect.fn("CleanerOperationTest.refuse")(() =>
          Effect.fail(CitationCleanerFailure.make({ reason: "callback-failed" }))
        ),
      });
      const refused = yield* cleaner.run({ text: "text", plan: "closed-port" }).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationInputError", operation: "clean" });
      const entered = yield* Deferred.make<void>();
      h.hooks({
        open: Effect.fn("CleanerOperationTest.block")(function* () {
          yield* Deferred.succeed(entered, undefined);
          return yield* Effect.never;
        }),
      });
      const pending = yield* cleaner.run({ text: "text", plan: "interrupted" }).pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      yield* Fiber.interrupt(pending);
      const exit = yield* Fiber.await(pending);
      const failed = Exit.isFailure(exit);
      assertTrue(failed);
      if (Exit.isFailure(exit)) {
        const interrupted = Cause.hasInterrupts(exit.cause);
        assertTrue(interrupted);
      }
      const state = yield* admission.snapshot;
      expect(state).toMatchObject({ active: 0, queued: 0 });
    })
  );
  it.effect("admits owned cleaner runs, preserving the issued handle and closing malformed requests", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const h = yield* makeCitationCleanerRegistryHarness();
      const admission = yield* makeCitationOperationAdmission(limits);
      const cleaner = yield* makeCitationCleanerOperation(limits).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestInvocationBinding(limits, "clean").pipe(
            Effect.map((bind) => ({ ...stage, run: bind(stage.run), runOwned: bind(stage.runOwned) }))
          )
        ),
        Effect.provideService(CitationOperationAdmission, admission),
        Effect.provideService(CitationCleaner, h.registry.runtime)
      );
      const value = yield* h.values.sourceText("ABCD");
      h.select([]);
      const owned = yield* cleaner.runOwned({ value, plan: "owned-admitted" });
      expect(owned.value).toBe(value);
      expect(owned.producedTextUtf16).toBe(4);
      const malformed = yield* cleaner.runOwned({ plan: "owned-malformed" }).pipe(Effect.flip);
      expect(malformed).toMatchObject({ _tag: "CitationInputError", operation: "clean" });
      const state = yield* admission.snapshot;
      expect(state).toEqual({ active: 0, queued: 0, closed: false });
    })
  );
  it.layer(TestClock.layer())("isolated clock: 62", (it) => {
    it.effect("shares admission across cleaner instances while nested plans reuse the outer permit and ledger", () =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const h = yield* makeCitationCleanerRegistryHarness();
        const admission = yield* makeCitationOperationAdmission(limits);
        const first = yield* makeCitationCleanerOperation(limits).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestInvocationBinding(limits, "clean").pipe(
              Effect.map((bind) => ({ ...stage, run: bind(stage.run), runOwned: bind(stage.runOwned) }))
            )
          ),
          Effect.provideService(CitationOperationAdmission, admission),
          Effect.provideService(CitationCleaner, h.registry.runtime)
        );
        const second = yield* makeCitationCleanerOperation(limits).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestInvocationBinding(limits, "clean").pipe(
              Effect.map((bind) => ({ ...stage, run: bind(stage.run), runOwned: bind(stage.runOwned) }))
            )
          ),
          Effect.provideService(CitationOperationAdmission, admission),
          Effect.provideService(CitationCleaner, h.registry.runtime)
        );
        const entered = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const key = yield* h.values.text("custom");
        const callback = yield* h.values.retainHost("nested-cleaner");
        const underscores = yield* h.values.text("underscores");
        yield* h.registry.set(key, callback);
        h.hooks({
          open: Effect.fn("CleanerOperationTest.open")(function* (plan) {
            const steps = plan === "outer" ? [key] : [underscores];
            let cursor = 0;
            return { next: Effect.sync(() => A.get(steps, cursor++)) };
          }),
          invoke: Effect.fn("CleanerOperationTest.nested")(function* (_fn, value, work) {
            yield* Deferred.succeed(entered, undefined);
            yield* Deferred.await(release);
            const result = yield* work.nested("inner", value);
            const citationResult1 = yield* h.values.getText(result);
            const text = yield* Effect.fromOption(citationResult1, () =>
              CitationCleanerFailure.make({ reason: "callback-failed" })
            );
            const charge = yield* work.reserveText(text.text.length);
            return CitationCleanerProduced.make({ value: result, charges: [charge] });
          }),
        });
        const boundary = {
          clock: yield* Clock.Clock,
          operation: CitationEngineOperation.Enum.clean,
          admission: O.some(admission),
        };
        const outer = yield* withCitationTestInvocation(
          first.run({ text: "a__b", plan: "outer" }),
          limits,
          boundary
        ).pipe(Effect.forkChild);
        yield* Deferred.await(entered);
        const queued = yield* withCitationTestInvocation(
          second.run({ text: "c__d", plan: "inner" }),
          limits,
          boundary
        ).pipe(Effect.forkChild);
        yield* TestClock.adjust(Duration.zero);
        const citationResult2 = yield* admission.snapshot;
        expect(citationResult2).toEqual({ active: 1, queued: 1, closed: false });
        yield* Deferred.succeed(release, undefined);
        const outerResult = yield* Fiber.join(outer);
        const nextResult = yield* Fiber.join(queued);
        const citationResult3 = yield* h.values.getText(outerResult.value);
        expect(O.getOrThrow(citationResult3).text).toBe("ab");
        expect(outerResult.producedTextUtf16).toBe(4);
        const citationResult4 = yield* h.values.getText(nextResult.value);
        expect(O.getOrThrow(citationResult4).text).toBe("cd");
        expect(nextResult.producedTextUtf16).toBe(2);
        const citationResult5 = yield* admission.snapshot;
        expect(citationResult5).toEqual({ active: 0, queued: 0, closed: false });
      })
    );
  });
});
