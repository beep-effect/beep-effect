/**
 * The `test` gate of one package on the repo CLI task path: run the
 * package's test script with its output captured, then print the console
 * from the record the Vitest adapter wrote. When the run left no fresh
 * record (the tool failed before the adapter ran, or the package's Vitest
 * config does not register it), the gate records the run itself from the
 * captured output, which reduces to an errored item carrying the log
 * excerpt.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GateEvent } from "@beep/gate-report/GateEvent";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { inputFingerprint } from "@beep/repo-gate-record/PackageLocation";
import { makeRunId } from "@beep/repo-gate-record/RunId";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { requirePackage } from "./GateCheck.ts";
import {
  captureRun,
  consoleSettings,
  EventRun,
  exitWithTool,
  GateServicesConfig,
  GateToolExit,
  recordEventRun,
  renderStoredRecord,
} from "./GateRuntime.ts";
import type { AudienceFlagInput } from "@beep/cli-kit/CliAudience";
import type { PackageLocation } from "@beep/repo-gate-record/PackageLocation";
import type { ConsoleSettings } from "@beep/repo-gate-run/GateConsole";
import type { runCheckGate } from "./GateCheck.ts";
import type { CapturedRun } from "./GateRuntime.ts";

const freshRecord = Effect.fnUntraced(function* (
  location: PackageLocation,
  target: RecordTarget,
  startedAt: DateTime.Utc
) {
  const store = yield* GateRecordStore.make(location.repoRoot);
  const record = yield* Effect.option(store.readRecord(target));
  return O.filter(record, (found) => DateTime.isGreaterThanOrEqualTo(found.generatedAt, startedAt));
});

const recordCapturedRun = Effect.fnUntraced(function* (input: {
  readonly location: PackageLocation;
  readonly target: RecordTarget;
  readonly settings: ConsoleSettings;
  readonly startedAt: DateTime.Utc;
  readonly captured: CapturedRun;
}) {
  const runId = yield* makeRunId;
  const finishedAt = yield* DateTime.now;
  const events = [
    GateEvent.cases.RunStarted.make({
      runId,
      gate: "test",
      subject: input.location.subject,
      itemKind: "test",
      startedAt: input.startedAt,
      inputFingerprint: yield* inputFingerprint(runId),
    }),
    GateEvent.cases.RunFinished.make({
      durationMs: Duration.toMillis(DateTime.distance(input.startedAt, finishedAt)),
      reason: input.captured.exitCode === 0 ? "passed" : "failed",
      exitCode: O.some(input.captured.exitCode),
    }),
  ];
  yield* recordEventRun(GateServicesConfig.make({ repoRoot: input.location.repoRoot, settings: input.settings }))(
    EventRun.make({
      target: input.target,
      events,
      exitCode: input.captured.exitCode,
      output: input.captured.output,
      subject: O.some(input.location.subject),
    })
  );
});

/**
 * Run the `test` gate of the package in `dir`, print its console and fail
 * with the test script's exit code when it is not zero.
 *
 * **Gotchas**
 *
 * Only a record the adapter generated at or after the run started counts; an older record
 * belongs to an earlier run.
 *
 * **Example** (Test a package)
 *
 * ```ts
 * import { runTestGate } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 *
 * const program = runTestGate("/repo/packages/foundation/modeling/glob", "beep:test", [], { audience: [], human: [], agent: [], ci: [] })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param dir - The absolute package directory.
 * @param script - The package script that runs the tests (`beep:test` on the task path).
 * @param args - Arguments for that script.
 * @param flags - The audience flags given, if any.
 * @returns Succeeds when the test script exited 0.
 * @category use-cases
 * @since 0.0.0
 */
export const runTestGate = Effect.fn("Gate.runTestGate")(function* (
  dir: string,
  script: string,
  args: ReadonlyArray<string>,
  flags: AudienceFlagInput
) {
  const location = yield* requirePackage(dir);
  const settings = yield* consoleSettings(flags);
  const target = RecordTarget.cases.PackageTarget.make({ packageDir: location.packageDir, gate: "test" });
  const startedAt = yield* DateTime.now;
  const captured = yield* captureRun({ command: "bun", args: ["run", script, ...args], cwd: dir });
  const fresh = yield* freshRecord(location, target, startedAt);
  yield* O.match(fresh, {
    onSome: () => Effect.asVoid(renderStoredRecord(location.repoRoot, target, settings)),
    onNone: () => recordCapturedRun({ location, target, settings, startedAt, captured }),
  });
  return yield* exitWithTool(
    GateToolExit.make({ gate: "test", subject: location.subject, exitCode: captured.exitCode })
  );
});

/**
 * Every way a package gate on the task path can fail: the tool's own
 * non-zero exit, and what can stop a gate before it prints.
 *
 * @category errors
 * @since 0.0.0
 */
export type PackageGateError =
  | Effect.Error<ReturnType<typeof runTestGate>>
  | Effect.Error<ReturnType<typeof runCheckGate>>;
