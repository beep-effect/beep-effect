import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { makeCitationRegexWorker } from "@beep/law-practice-server/internal/Citation/RegexWorker";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import {
  makeCitationNativeManualClock,
  makeCitationObservedSpawner,
  makeCitationRegexTestRuntime,
} from "./CitationNativeSpawner.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

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

  return { limits, timer, admission, observed, runtime };
});
/** Actual worker using the shared runtime and independent source bindings. */
export const setupCitationRegexWorker = Effect.fn("RegexWorkerTest.setup")(function* (
  bindings: unknown,
  kind: CitationNativeRuntimeKind = "bun",
  engineInput: unknown = "python-re"
) {
  const { limits, timer, admission, observed, runtime } = yield* setupCitationRegexRuntime(kind);

  const worker = yield* makeCitationRegexWorker(limits, runtime, bindings, engineInput).pipe(
    Effect.provideService(Clock.Clock, timer.clock),
    Effect.provideService(CitationNativeProcessAdmission, admission),
    Effect.provideService(ChildProcessSpawner, observed.spawner)
  );
  return { worker, admission, observed };
});
