import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { makeCitationRegexWorker } from "@beep/law-practice-server/internal/Citation/RegexWorker";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Scope from "effect/Scope";
import {
  makeCitationNativeManualClock,
  makeCitationNativeSleepClock,
  makeCitationNativeWallClock,
  makeCitationObservedSpawner,
  makeCitationRegexTestRuntime,
} from "./CitationNativeSpawner.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeExitCounts } from "./CitationNativeSpawner.fixtures.ts";

/** Shared actual runtime, controlled execution Clock and real cleanup observations. */
export const setupCitationRegexRuntime = Effect.fn("RegexWorkerTest.runtime")(function* (
  kind: CitationNativeRuntimeKind = "bun",
  producedTextUtf16?: number
) {
  const defaults = (yield* defaultCitationEnginePolicy).limits;
  const limits = {
    ...defaults,
    producedTextUtf16: producedTextUtf16 ?? defaults.producedTextUtf16,
    regexDeadline: Duration.millis(997),
  };
  const timer = yield* makeCitationNativeManualClock(limits.regexDeadline);
  const admission = yield* makeCitationNativeProcessAdmission(limits);
  const observed = yield* makeCitationObservedSpawner();
  const fs = yield* FileSystem.FileSystem;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-regex-worker-" });
  const runtime = yield* makeCitationRegexTestRuntime(kind, cwd);

  const context = Context.make(Clock.Clock, timer.clock).pipe(
    Context.add(CitationNativeProcessAdmission, admission),
    Context.add(ChildProcessSpawner, observed.spawner)
  );
  return { limits, timer, admission, observed, runtime, context };
});
/** Actual worker using the shared runtime and independent source bindings. */
export const setupCitationRegexWorker = Effect.fn("RegexWorkerTest.setup")(function* (
  bindings: unknown,
  kind: CitationNativeRuntimeKind = "bun",
  engineInput: unknown = "python-re"
) {
  const { limits, admission, observed, runtime, context } = yield* setupCitationRegexRuntime(kind);

  const worker = yield* makeCitationRegexWorker(limits, runtime, bindings, engineInput).pipe(
    Effect.provideContext(context)
  );
  return { worker, admission, observed };
});

/** Prove real child retirement and release of both composed admission owners. */
export const assertCitationWorkerCompositionReleased = Effect.fn("RegexWorkerTest.compositionReleased")(function* (
  operation: CitationOperationAdmission["Service"],
  admission: CitationNativeProcessAdmission["Service"],
  observed: Effect.Effect<CitationNativeExitCounts>,
  calls: number
) {
  const exits = yield* observed;
  expect(exits).toEqual({ spawned: calls, confirmed: calls });
  const operations = yield* operation.snapshot;
  expect(operations).toMatchObject({ active: 0, queued: 0 });
  const native = yield* admission.snapshot;
  expect(native).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
});

/** Release the captured manual deadline while the caller's sleep is disabled. */
export const assertCitationWorkerCapturedDeadline = Effect.fn("RegexWorkerTest.capturedDeadline")(function* <Value, E>(
  body: Effect.Effect<Value, E>,
  trigger: Effect.Effect<void>
) {
  const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
  const pending = yield* body.pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
  yield* trigger;
  const expired = yield* Fiber.join(pending).pipe(Effect.flip);
  expect(expired).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "extractDeadline" });
});

/** One explicit source calendar plus existing admission for metadata composition fixtures. */
export const makeCitationMetadataTestContext = Effect.fn("RegexWorkerTest.metadataContext")(function* (
  context: Effect.Success<ReturnType<typeof setupCitationRegexRuntime>>["context"],
  limits: CitationEngineLimits
) {
  const operation = yield* makeCitationOperationAdmission(limits).pipe(Effect.provideContext(context));
  const instant = yield* Effect.fromOption(DateTime.make("2026-11-03T00:00:00Z"));
  const epoch = DateTime.toEpochMillis(instant);
  const clock = yield* makeCitationNativeWallClock(epoch).pipe(Effect.provideContext(context));
  return {
    operation,
    context: context.pipe(Context.add(Clock.Clock, clock), Context.add(CitationOperationAdmission, operation)),
  };
});

/** Close the captured installation scope and prove rejection before any child. */
export const assertCitationWorkerClosedLifetime = Effect.fn("RegexWorkerTest.closedLifetime")(function* <Value, E>(
  scope: Scope.Closeable,
  body: Effect.Effect<Value, E>,
  observed: Effect.Effect<CitationNativeExitCounts>
) {
  yield* Scope.close(scope, Exit.void);
  const failure = yield* body.pipe(Effect.flip);
  expect(failure).toMatchObject({ reason: "closed" });
  const counts = yield* observed;
  expect(counts).toEqual({ spawned: 0, confirmed: 0 });
});
