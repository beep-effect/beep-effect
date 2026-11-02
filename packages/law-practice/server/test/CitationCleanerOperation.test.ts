import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as TestClock from "effect/testing/TestClock";
import { CitationOperationAdmission, makeCitationOperationAdmission } from "../src/internal/Citation/Admission.ts";
import { makeCitationCleanerOperation } from "../src/internal/Citation/CleanerOperation.ts";
import {
  CitationCleanerFailure,
  CitationCleanerProduced,
  CitationCleanerRuntime,
} from "../src/internal/Citation/CleanerPipeline.ts";
import { makeCitationCleanerRegistryHarness } from "./CitationCleanerRegistry.fixtures.ts";

it.layer(BunCrypto.layer)("admitted cleaner operations", (it) => {
  it.effect("shares admission across cleaner instances while nested plans reuse the outer permit and ledger", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const h = yield* makeCitationCleanerRegistryHarness();
      const admission = yield* makeCitationOperationAdmission(limits);
      const first = yield* makeCitationCleanerOperation(limits).pipe(
        Effect.provideService(CitationOperationAdmission, admission),
        Effect.provideService(CitationCleanerRuntime, h.registry.runtime)
      );
      const second = yield* makeCitationCleanerOperation(limits).pipe(
        Effect.provideService(CitationOperationAdmission, admission),
        Effect.provideService(CitationCleanerRuntime, h.registry.runtime)
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
          const text = yield* Effect.fromOption(yield* h.values.getText(result), () =>
            CitationCleanerFailure.make({ reason: "callback-failed" })
          );
          const charge = yield* work.reserveText(text.text.length);
          return CitationCleanerProduced.make({ value: result, charges: [charge] });
        }),
      });
      const outer = yield* first.run({ text: "a__b", plan: "outer" }).pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      const queued = yield* second.run({ text: "c__d", plan: "inner" }).pipe(Effect.forkChild);
      yield* TestClock.adjust(Duration.zero);
      expect(yield* admission.snapshot).toEqual({ active: 1, queued: 1, closed: false });
      yield* Deferred.succeed(release, undefined);
      const outerResult = yield* Fiber.join(outer);
      const nextResult = yield* Fiber.join(queued);
      expect(O.getOrThrow(yield* h.values.getText(outerResult.value)).text).toBe("ab");
      expect(outerResult.producedTextUtf16).toBe(4);
      expect(O.getOrThrow(yield* h.values.getText(nextResult.value)).text).toBe("cd");
      expect(nextResult.producedTextUtf16).toBe(2);
      expect(yield* admission.snapshot).toEqual({ active: 0, queued: 0, closed: false });
    })
  );
});
