import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-server/internal/Citation/PythonHash";
import { makeCitationRegexWorker } from "@beep/law-practice-server/internal/Citation/RegexWorker";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationTokenContextInput } from "@beep/law-practice-server/internal/Citation/TokenContext";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
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
import * as Str from "effect/String";
import {
  makeCitationNativeManualClock,
  makeCitationNativeSleepClock,
  makeCitationNativeWallClock,
  makeCitationObservedSpawner,
  makeCitationRegexTestRuntime,
} from "./CitationNativeSpawner.fixtures.ts";
import type { CitationPublicationMetadataConfiguration } from "@beep/law-practice-server/internal/Citation/MetadataComposition";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeExitCounts } from "./CitationNativeSpawner.fixtures.ts";

/** Shared actual runtime, controlled execution Clock and real cleanup observations. */
export const setupCitationRegexRuntime = Effect.fn("RegexWorkerTest.runtime")(function* (
  kind: CitationNativeRuntimeKind = "bun",
  producedTextUtf16?: number,
  patternUtf16?: number
) {
  const defaults = (yield* defaultCitationEnginePolicy).limits;
  const limits = {
    ...defaults,
    producedTextUtf16: producedTextUtf16 ?? defaults.producedTextUtf16,
    patternUtf16: patternUtf16 ?? defaults.patternUtf16,
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
/** Shared actual runtime plus operation lifetime, invocation budget and optional captured deadline. */
const setupCitationMetadataRuntime = Effect.fn("RegexWorkerTest.metadataRuntime")(function* (
  kind: CitationNativeRuntimeKind,
  maximum?: number,
  enclosing = false,
  controlled = false
) {
  const setup = yield* setupCitationRegexRuntime(kind, maximum);
  const limits = controlled === true ? { ...setup.limits, extractDeadline: Duration.millis(997) } : setup.limits;
  const operation = yield* makeCitationOperationAdmission(limits).pipe(Effect.provideContext(setup.context));
  const budget = yield* makeCitationTextBudget(limits);
  const context = Context.add(setup.context, CitationOperationAdmission, operation);
  const provided = enclosing === true ? Context.add(context, CitationTextBudget, budget) : context;
  return { ...setup, limits, operation, budget, provided };
});
/** Install a fresh source-bound fixture stage through the same existing runtime owners. */
export const makeCitationMetadataFixtureInstaller =
  <Stage, StageError, StageEnv>(
    factory: (policy: unknown, runtime: unknown, configuration: unknown) => Effect.Effect<Stage, StageError, StageEnv>
  ) =>
  <
    Corpus extends { readonly configuration: typeof CitationPublicationMetadataConfiguration.Encoded },
    LoadError,
    LoadEnv,
  >(
    load: Effect.Effect<Corpus, LoadError, LoadEnv>
  ) =>
    Effect.fn("RegexWorkerTest.installMetadataFixture")(function* (
      kind: CitationNativeRuntimeKind,
      maximum?: number,
      enclosing = false,
      controlled = false
    ) {
      const corpus = yield* load;
      const setup = yield* setupCitationMetadataRuntime(kind, maximum, enclosing, controlled);
      const configuration = { ...corpus.configuration };
      const stage = yield* factory(setup.limits, setup.runtime, configuration).pipe(
        Effect.provideContext(setup.provided)
      );
      return { ...setup, corpus, configuration, stage };
    });
/** One large native word for pre-worker captured deadline controls. */
export const citationMetadataDeadlineText = () =>
  CitationTokenContextInput.fields.words.value.make({
    kind: "Text",
    data: CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(Str.repeat(65536)("x")) }),
  });
/** Actual worker using the shared runtime and independent source bindings. */
export const setupCitationRegexWorker = Effect.fn("RegexWorkerTest.setup")(function* (
  bindings: unknown,
  kind: CitationNativeRuntimeKind = "bun",
  engineInput: unknown = "python-re",
  patternUtf16?: number
) {
  const { limits, admission, observed, runtime, context } = yield* setupCitationRegexRuntime(
    kind,
    undefined,
    patternUtf16
  );

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
/** Observe both independent native exit acknowledgement and released capacity. */
export const assertCitationRegexRuntimeReleased = Effect.fn("RegexWorkerTest.runtimeReleased")(function* (
  admission: CitationNativeProcessAdmission["Service"],
  observed: Effect.Effect<CitationNativeExitCounts>,
  calls: number
) {
  yield* observed.pipe(Effect.map((counts) => expect(counts).toEqual({ spawned: calls, confirmed: calls })));
  yield* admission.snapshot.pipe(
    Effect.map((state) => expect(state).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 }))
  );
});
/** Budget refusal must still independently retire the expected native children. */
export const assertCitationMetadataRefusal = Effect.fn("RegexWorkerTest.metadataRefusal")(function* <Value, E>(
  body: Effect.Effect<Value, E>,
  operation: CitationOperationAdmission["Service"],
  admission: CitationNativeProcessAdmission["Service"],
  observed: Effect.Effect<CitationNativeExitCounts>,
  calls: number
) {
  const failure = yield* body.pipe(Effect.flip);
  expect(failure).toMatchObject({ limit: "producedTextUtf16" });
  yield* assertCitationWorkerCompositionReleased(operation, admission, observed, calls);
});
/** Prime a captured enclosing budget and retain its exact refusal counter. */
export const assertCitationMetadataEnclosingRefusal = Effect.fn("RegexWorkerTest.enclosingRefusal")(function* <
  Value,
  E,
>(body: Effect.Effect<Value, E>, budget: CitationTextBudget["Service"], prime: number, expected: number) {
  yield* budget.reserve(prime);
  const failure = yield* body.pipe(Effect.flip);
  expect(failure).toMatchObject({ limit: "producedTextUtf16" });
  const used = yield* budget.snapshot;
  expect(used).toBe(expected);
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
/** Reuse the existing closed operation, captured timer and independent exit assertions. */
export const assertCitationMetadataFixtureLifetime = Effect.fn("RegexWorkerTest.metadataFixtureLifetime")(function* <
  Input extends object,
  Value,
  E,
  InstallError,
  Env,
>(
  install: (
    kind: CitationNativeRuntimeKind,
    maximum?: number,
    enclosing?: boolean,
    controlled?: boolean
  ) => Effect.Effect<
    {
      readonly corpus: { readonly cases: ReadonlyArray<{ readonly request: Input }> };
      readonly stage: { readonly apply: (raw: unknown) => Effect.Effect<Value, E> };
      readonly observed: { readonly snapshot: Effect.Effect<CitationNativeExitCounts> };
      readonly timer: { readonly trigger: Effect.Effect<void> };
    },
    InstallError,
    Env
  >,
  ordinal: number,
  words: unknown
) {
  const scope = yield* Scope.make();
  const closed = yield* install("bun").pipe(Effect.provideService(Scope.Scope, scope));
  const row = yield* Effect.fromOption(A.get(closed.corpus.cases, ordinal));
  yield* assertCitationWorkerClosedLifetime(scope, closed.stage.apply(row.request), closed.observed.snapshot);
  const timed = yield* install("bun", undefined, false, true);
  yield* assertCitationWorkerCapturedDeadline(timed.stage.apply({ ...row.request, words }), timed.timer.trigger);
  const observed = yield* timed.observed.snapshot;
  expect(observed).toEqual({ spawned: 0, confirmed: 0 });
});
