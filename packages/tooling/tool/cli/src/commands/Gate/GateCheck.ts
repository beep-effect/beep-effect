/**
 * The `check` gate of one package, the program behind every generated
 * package `check` script (`beep-cli gate run check`) and behind
 * `beep-cli check` in a package directory.
 *
 * **Details**
 *
 * The unbuilt-reference probe runs first. When referenced projects have no
 * declaration index, the gate records one TS6305 item per missing index
 * (the console folds them to one cause line with the build command) and
 * exits 1 without starting a compiler. Otherwise it runs the package's
 * `beep:check`, keeps its whole output for the raw log, turns the compiler
 * output into gate events, writes the record, prints the console for the
 * audience and exits with the compiler's code.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { PACKAGE_CHECK_GATE_SCRIPT } from "@beep/repo-cli-kit/package-scripts/CheckGate";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { inputFingerprint, locatePackage } from "@beep/repo-gate-record/PackageLocation";
import { makeRunId } from "@beep/repo-gate-record/RunId";
import {
  CheckRun,
  CompilerRun,
  compilerEvents,
  UnbuiltProbe,
  UnbuiltReference,
  unbuiltReferenceEvents,
} from "@beep/repo-gate-run/TypeCheckAdapter";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { makeDeclarationIndexCache, missingReferenceOutputs, unbuiltReferenceLine } from "../Quality/CheckProbe.ts";
import {
  captureRun,
  consoleSettings,
  EventRun,
  exitWithTool,
  GateNotAPackage,
  GateServicesConfig,
  GateToolExit,
  recordEventRun,
} from "./GateRuntime.ts";
import type { AudienceFlagInput } from "@beep/cli-kit/CliAudience";
import type { GateEvent } from "@beep/gate-report/GateEvent";
import type { PackageLocation } from "@beep/repo-gate-record/PackageLocation";
import type { MissingReferenceOutput } from "../Quality/CheckProbe.ts";

type ToolOutcome = {
  readonly exitCode: number;
  readonly log: Uint8Array;
  readonly events: (run: CheckRun) => ReadonlyArray<GateEvent>;
};

const encoder = new TextEncoder();

const probeOutcome = (
  location: PackageLocation,
  missing: A.NonEmptyReadonlyArray<MissingReferenceOutput>
): ToolOutcome => ({
  exitCode: 1,
  log: encoder.encode(`${unbuiltReferenceLine(location.subject)(missing)}\n`),
  events: (run) =>
    unbuiltReferenceEvents(
      UnbuiltProbe.make({
        run,
        missing: A.map(missing, (entry) =>
          UnbuiltReference.make({ reference: entry.reference, declarationFile: entry.declarationFile })
        ),
      })
    ),
});

const compilerOutcome = Effect.fnUntraced(function* (dir: string) {
  const captured = yield* captureRun({ command: "bun", args: ["run", PACKAGE_CHECK_GATE_SCRIPT], cwd: dir });
  const output = new TextDecoder().decode(captured.output);
  return {
    exitCode: captured.exitCode,
    log: captured.output,
    events: (run: CheckRun) => compilerEvents(CompilerRun.make({ run, exitCode: captured.exitCode, output })),
  } satisfies ToolOutcome;
});

const runTool = Effect.fnUntraced(function* (dir: string, location: PackageLocation) {
  const cache = yield* makeDeclarationIndexCache;
  const missing = yield* missingReferenceOutputs(dir, { name: location.subject, dir }, cache);
  return yield* A.match(missing, {
    onEmpty: () => compilerOutcome(dir),
    onNonEmpty: (entries) => Effect.succeed(probeOutcome(location, entries)),
  });
});

/**
 * Locate the package a directory is, or fail with {@link GateNotAPackage}.
 *
 * **Example** (Require a package)
 *
 * ```ts
 * import { requirePackage } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(requirePackage("/repo/packages/a"))) // true
 * ```
 *
 * @param dir - The absolute package directory.
 * @returns Its location.
 * @category use-cases
 * @since 0.0.0
 */
export const requirePackage = Effect.fn("Gate.requirePackage")(function* (dir: string) {
  const located = yield* locatePackage(dir);
  return yield* Effect.fromOption(located).pipe(Effect.mapError(() => GateNotAPackage.make({ dir })));
});

/**
 * Run the `check` gate of the package in `dir`, print its console and fail
 * with the compiler's exit code when it is not zero.
 *
 * **Example** (Check a package)
 *
 * ```ts
 * import { runCheckGate } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 *
 * const program = runCheckGate("/repo/packages/foundation/modeling/glob", { audience: [], human: [], agent: [], ci: [] })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param dir - The absolute package directory.
 * @param flags - The audience flags given, if any.
 * @returns Succeeds when the compiler exited 0.
 * @category use-cases
 * @since 0.0.0
 */
export const runCheckGate = Effect.fn("Gate.runCheckGate")(function* (dir: string, flags: AudienceFlagInput) {
  const location = yield* requirePackage(dir);
  const settings = yield* consoleSettings(flags);
  const runId = yield* makeRunId;
  const startedAt = yield* DateTime.now;
  const fingerprint = yield* inputFingerprint(runId);
  const outcome = yield* runTool(dir, location);
  const finishedAt = yield* DateTime.now;
  const run = CheckRun.make({
    runId,
    subject: location.subject,
    startedAt,
    durationMs: Duration.toMillis(DateTime.distance(startedAt, finishedAt)),
    inputFingerprint: fingerprint,
  });
  const result = yield* recordEventRun(GateServicesConfig.make({ repoRoot: location.repoRoot, settings }))(
    EventRun.make({
      target: RecordTarget.cases.PackageTarget.make({ packageDir: location.packageDir, gate: "check" }),
      events: outcome.events(run),
      exitCode: outcome.exitCode,
      output: outcome.log,
    })
  );
  return yield* exitWithTool(
    GateToolExit.make({ gate: "check", subject: location.subject, exitCode: result.exitCode })
  );
});
