import * as NodeURL from "node:url";
import { Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import {
  Array as Arr,
  Cause,
  Config,
  Deferred,
  Effect,
  Exit,
  Fiber,
  FileSystem,
  Option as O,
  Path,
  Schema,
  Stream,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type * as PlatformError from "effect/PlatformError";

const packageRoot = NodeURL.fileURLToPath(new URL("..", import.meta.url));
const fixtureSource = NodeURL.fileURLToPath(
  new URL("./fixtures/vitest-instrumentation/runtime.test.ts.txt", import.meta.url)
);
const reporterSource = NodeURL.fileURLToPath(
  new URL("./fixtures/vitest-instrumentation/diagnostic-reporter.ts.txt", import.meta.url)
);
const fixtureDirectory = NodeURL.fileURLToPath(new URL("./fixtures/vitest-instrumentation", import.meta.url));
const vitestBin = NodeURL.fileURLToPath(new URL("../../../../../node_modules/vitest/vitest.mjs", import.meta.url));
const emptyString = (): string => "";
const rawErrorPrefix = "BEEP_VITEST_RAW_ERROR ";
const rawErrorLines = (output: string): string =>
  Arr.join(
    Arr.map(Arr.filter(Str.split("\n")(output), Str.startsWith(rawErrorPrefix)), Str.slice(rawErrorPrefix.length)),
    "\n"
  );

interface FixtureResult {
  readonly cleanup: string;
  readonly diagnostics: string;
  readonly exitCode: ChildProcessSpawner.ExitCode;
  readonly output: string;
  readonly phases: string;
}

const encodeScopeExit = Schema.encodeEffect(Schema.fromJsonString(Schema.Struct({ interrupted: Schema.Boolean })));
const decodeCleanup = Schema.decodeEffect(Schema.fromJsonString(Schema.String));

const decodePhases = Schema.decodeEffect(
  Schema.Array(
    Schema.fromJsonString(
      Schema.Struct({
        phase: Schema.String,
        monotonicNanos: Schema.BigIntFromString,
        aborted: Schema.Boolean,
      })
    )
  )
);

const decodeDiagnosticErrors = Schema.decodeEffect(
  Schema.fromJsonString(
    Schema.Struct({
      errors: Schema.Array(
        Schema.Struct({
          message: Schema.String,
          cause: Schema.Struct({ message: Schema.String }),
        })
      ),
    })
  )
);

const runFixture = (
  mode: string,
  options?: {
    readonly ci?: boolean;
    readonly trace?: boolean;
    readonly evidenceDirectory?: string;
    readonly beforeClose?: (directory: string) => Effect.Effect<void>;
  }
): Effect.Effect<
  FixtureResult,
  Error | PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: fixtureDirectory,
        prefix: `.runtime-${mode}-`,
      });
      const runtimeTest = path.join(directory, "runtime.test.ts");
      const cleanupPath = path.join(directory, "cleanup.txt");
      const resultPath = path.join(directory, "result.json");
      const reporterPath = path.join(directory, "diagnostic-reporter.ts");
      let output = emptyString();
      const configuredEvidence = yield* Config.option(Config.string("BEEP_VITEST_RUNTIME_EVIDENCE"));
      const evidenceDirectory = O.orElse(O.fromUndefinedOr(options?.evidenceDirectory), () => configuredEvidence);
      // Registered after the temp directory: persist first on success, failure or
      // cancellation, then let the existing directory finalizer remove its files.
      if (O.isSome(evidenceDirectory)) {
        yield* Effect.addFinalizer((exit) =>
          Effect.gen(function* () {
            yield* fs.writeFileString(path.join(directory, "process-output.txt"), output);
            const scopeExit = yield* encodeScopeExit({
              interrupted: Exit.hasInterrupts(exit),
            });
            yield* fs.writeFileString(path.join(directory, "scope-exit.json"), scopeExit);
            yield* fs.writeFileString(`${runtimeTest}.errors.jsonl`, rawErrorLines(output));
            yield* fs.makeDirectory(evidenceDirectory.value, { recursive: true });
            yield* fs.copy(directory, path.join(evidenceDirectory.value, path.basename(directory)));
          }).pipe(Effect.orDie)
        );
      }
      yield* fs
        .readFileString(reporterSource)
        .pipe(Effect.flatMap((source) => fs.writeFileString(reporterPath, source)));
      yield* fs.readFileString(fixtureSource).pipe(Effect.flatMap((source) => fs.writeFileString(runtimeTest, source)));

      const args = [
        vitestBin,
        "run",
        runtimeTest,
        "--pool=threads",
        "--root",
        packageRoot,
        "--reporter=json",
        `--reporter=${reporterPath}`,
        `--outputFile=${resultPath}`,
        ...(mode === "only" ? ["--allowOnly"] : []),
      ];
      const child = yield* ChildProcess.make(process.execPath, args, {
        cwd: packageRoot,
        extendEnv: true,
        env: {
          BEEP_INSTRUMENTED_IT_FIXTURE: mode,
          BEEP_TEST_TRACE: options?.trace === true ? "1" : "0",
          CI: options?.ci === true ? "true" : "false",
        },
        stdin: "ignore",
      });
      yield* child.all.pipe(
        Stream.decodeText(),
        Stream.runForEach((chunk) =>
          Effect.sync(() => {
            output = Str.concat(output, chunk);
          })
        )
      );
      const exitCode = yield* child.exitCode;
      const cleanup = yield* Effect.forEach(
        Arr.filter(Str.split("\n")(output), Str.startsWith("BEEP_VITEST_CLEANUP ")),
        (line) => decodeCleanup(Str.slice(20)(line))
      ).pipe(Effect.map(Arr.join("")));
      const phases = Arr.join(
        Arr.map(Arr.filter(Str.split("\n")(output), Str.startsWith("BEEP_VITEST_PHASE ")), Str.slice(18)),
        "\n"
      );
      yield* fs.writeFileString(cleanupPath, cleanup);
      yield* fs.writeFileString(`${cleanupPath}.phases.jsonl`, phases);
      const resultOutput = yield* fs
        .exists(resultPath)
        .pipe(Effect.flatMap((exists) => (exists ? fs.readFileString(resultPath) : Effect.succeed(""))));
      const diagnostics = rawErrorLines(output);
      if (options?.beforeClose !== undefined) yield* options.beforeClose(directory);
      return {
        cleanup,
        diagnostics,
        phases,
        exitCode,
        output: Str.concat(output, resultOutput),
      };
    })
  );

it.layer(NodeServices.layer, { timeout: "30 seconds" })("instrumented Vitest runtime", (layerIt) => {
  layerIt.effect("uses the body log and concrete name when the live watchdog interrupts a frozen TestClock", () =>
    Effect.gen(function* () {
      const result = yield* runFixture("watchdog", { trace: true });
      expect(result.exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      expect(result.output).toContain("TestHang");
      expect(result.output).toContain("watchdog concrete name");
      expect(result.output).toContain("distinctive-watchdog-log");
      expect(result.output).toContain("175ms watchdog");
      expect(result.cleanup).toContain("distinctive-watchdog-log");
      expect(result.cleanup).toContain("released\n");
      expect(result.cleanup).toContain("effect-vitest test start");
      expect(result.cleanup).toContain("outcome=failure");
    })
  );

  layerIt.effect("retains raw abort diagnostics before an interrupted fixture scope is removed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const evidenceDirectory = yield* fs.makeTempDirectoryScoped();
      const ready = yield* Deferred.make<string>();
      const fixture = yield* Effect.forkChild(
        runFixture("public-abort", {
          evidenceDirectory,
          beforeClose: (directory) => Deferred.succeed(ready, directory).pipe(Effect.andThen(Effect.never)),
        })
      );
      const directory = yield* Deferred.await(ready);
      expect(yield* fs.exists(directory)).toBe(true);
      yield* Fiber.interrupt(fixture);
      const exit = yield* Fiber.await(fixture);
      assertExitFailure(exit, Cause.interrupt(yield* Effect.fiberId));
      expect(yield* fs.exists(directory)).toBe(false);
      const retained = path.join(evidenceDirectory, path.basename(directory));
      const errors = yield* fs.readFileString(path.join(retained, "runtime.test.ts.errors.jsonl"));
      const phases = yield* fs.readFileString(path.join(retained, "cleanup.txt.phases.jsonl"));
      const scopeExit = yield* fs.readFileString(path.join(retained, "scope-exit.json"));
      expect(errors).toContain('"name":"Error"');
      expect(errors).toContain('"message":"Test timed out in 25ms.');
      expect(errors).toContain('"stack":');
      expect(phases).toContain('"phase":"abort"');
      expect(phases).toContain('"aborted":true');
      expect(phases).toContain('"reason":');
      expect(phases).toContain("Test timed out in 25ms");
      expect(phases).toContain('"phase":"finished"');
      expect(scopeExit).toBe('{"interrupted":true}');
      const phaseRecords = yield* decodePhases(Str.split("\n")(phases));
      expect(Arr.map(phaseRecords, ({ phase }) => phase)).toEqual(["beforeEach", "abort", "finished", "failed"]);
      expect(Arr.map(phaseRecords, ({ aborted }) => aborted)).toEqual([false, true, true, true]);
      for (const [previous, next] of Arr.zip(phaseRecords, Arr.drop(phaseRecords, 1))) {
        expect(next.monotonicNanos).toBeGreaterThanOrEqual(previous.monotonicNanos);
      }
      // Keep this interrupted-scope receipt in the same optional durable sink as
      // ordinary fixtures before this test's temporary evidence directory closes.
      const configuredEvidence = yield* Config.option(Config.string("BEEP_VITEST_RUNTIME_EVIDENCE"));
      if (O.isSome(configuredEvidence)) {
        yield* fs.copy(retained, path.join(configuredEvidence.value, path.basename(directory)));
      }
    })
  );

  layerIt.effect("keeps tiny positive budgets below the task timeout and honors disabled timeouts", () =>
    Effect.gen(function* () {
      const tiny = yield* runFixture("tiny-timeout");
      expect(tiny.exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      expect(tiny.output).toContain("TestHang");
      expect(tiny.output).toContain("12.5ms watchdog");

      const disabled = yield* runFixture("disabled-timeouts");
      expect(disabled.exitCode).toBe(ChildProcessSpawner.ExitCode(0));
      expect(disabled.output).not.toContain("TestHang");
    })
  );

  layerIt.effect("keeps concurrent each identities, timeouts, and last logs isolated", () =>
    Effect.gen(function* () {
      const result = yield* runFixture("concurrent-each");
      expect(result.exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      for (const evidence of ["case alpha", "case beta", "last-alpha", "last-beta", "155", "215"]) {
        expect(result.output).toContain(evidence);
      }
    })
  );

  layerIt.effect("gates lifecycle output while preserving trace success and failure outcomes", () =>
    Effect.gen(function* () {
      const traceOff = yield* runFixture("trace-success");
      expect(traceOff.exitCode).toBe(ChildProcessSpawner.ExitCode(0));
      expect(traceOff.cleanup).toContain("trace-body-success");
      expect(traceOff.cleanup).not.toContain("effect-vitest test start");
      expect(traceOff.cleanup).not.toContain("effect-vitest test end");

      const traceOn = yield* runFixture("trace-success", { trace: true });
      expect(traceOn.exitCode).toBe(ChildProcessSpawner.ExitCode(0));
      expect(traceOn.cleanup).toContain("effect-vitest test start");
      expect(traceOn.cleanup).toContain("effect-vitest test end");
      expect(traceOn.cleanup).toContain("outcome=success");
      expect(traceOn.cleanup).toContain("durationMillis=");

      const ciOn = yield* runFixture("trace-success", { ci: true });
      expect(ciOn.exitCode).toBe(ChildProcessSpawner.ExitCode(0));
      expect(ciOn.cleanup).toContain("effect-vitest test start");

      const failure = yield* runFixture("trace-failure", { trace: true });
      expect(failure.exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      expect(failure.output).toContain("preserved-failure");
      expect(failure.cleanup).toContain("effect-vitest test start");
      expect(failure.cleanup).toContain("effect-vitest test end");
      expect(failure.cleanup).toContain("outcome=failure");
      expect(failure.output).not.toContain("TestHang");
    })
  );

  layerIt.effect("preserves defects and interruption instead of converting them to TestHang", () =>
    Effect.gen(function* () {
      const results = yield* Effect.all(
        [runFixture("defect", { trace: true }), runFixture("interruption", { trace: true })],
        { concurrency: 2 }
      );
      expect(results[0].exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      expect(results[0].output).toContain("preserved-defect");
      expect(results[0].output).not.toContain("TestHang");
      expect(results[0].cleanup).toContain("outcome=failure");
      expect(results[1].exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      expect(results[1].output).toContain("preserves interruption");
      expect(results[1].output).not.toContain("TestHang");
      expect(results[1].cleanup).toContain("outcome=interrupted");
    })
  );

  layerIt.effect("runs live, excluded-TestEnv, and property callbacks through public registration", () =>
    Effect.gen(function* () {
      const results = yield* Effect.forEach(["live", "exclude-test-services", "property"], (mode) => runFixture(mode), {
        concurrency: 3,
      });
      for (const result of results) {
        expect(result.exitCode).toBe(ChildProcessSpawner.ExitCode(0));
      }
    })
  );

  layerIt.effect("uses one absolute deadline and one lifecycle for a complete property run", () =>
    Effect.gen(function* () {
      const result = yield* runFixture("property-deadline", { trace: true });
      expect(result.exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      expect(result.output).toContain("aggregate property deadline");
      expect(result.output).not.toContain("Test timed out in 180ms");
      expect(result.output).toContain("seed: 4242");
      expect(result.output).toContain("Shrunk");
      expect(result.diagnostics).toContain("Counterexample: [1]");
      expect(result.diagnostics).toContain("seed: 4242");
      expect(result.diagnostics).toContain("155ms watchdog");
      expect(result.phases).not.toContain('"aborted":true');
      expect(result.phases).toContain('"phase":"finished"');
      expect(result.phases).toContain('"phase":"failed"');
      const phaseRecords = yield* decodePhases(Str.split("\n")(result.phases));
      expect(Arr.every(phaseRecords, ({ aborted }) => !aborted)).toBe(true);
      for (const [previous, next] of Arr.zip(phaseRecords, Arr.drop(phaseRecords, 1))) {
        expect(next.monotonicNanos).toBeGreaterThanOrEqual(previous.monotonicNanos);
      }
      expect(result.cleanup.split("property-trial-released")).toHaveLength(4);
      expect(result.cleanup.split("effect-vitest test start")).toHaveLength(2);
      expect(result.cleanup.split("effect-vitest test end")).toHaveLength(2);
      expect(result.cleanup).toContain("outcome=failure");
      expect(result.cleanup).toContain("property-trial-");
      expect(result.cleanup).toContain("TestHang");
    })
  );

  layerIt.effect("charges setup to the stored property deadline before arming", () =>
    Effect.gen(function* () {
      const result = yield* runFixture("property-setup-budget", { trace: true });
      expect(result.exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      expect(result.cleanup).toContain("setup-consumed-40");
      expect(result.cleanup).toContain("setup-consumed-155");
      expect(result.cleanup).toContain("setup-40-body-");
      expect(result.cleanup).not.toContain("setup-40-completed");
      expect(result.cleanup).not.toContain("setup-155-body-");
      const records = yield* Effect.forEach(Str.split("\n")(Str.trim(result.diagnostics)), (line) =>
        decodeDiagnosticErrors(line)
      );
      expect(records).toHaveLength(2);
      for (const record of records) {
        expect(record.errors).toHaveLength(1);
        for (const error of record.errors) {
          expect(error.message).toContain("Property failed after 1 tests");
          expect(error.cause.message).toContain("155ms watchdog");
        }
      }
      expect(result.diagnostics).toContain("seed: 4242");
      expect(result.diagnostics).toContain("Shrunk 1 time(s)");
      expect(result.phases).not.toContain('"aborted":true');
      expect(result.cleanup.split("outcome=failure durationMillis=155")).toHaveLength(3);
      expect(result.cleanup.split("effect-vitest test start")).toHaveLength(3);
      expect(result.cleanup.split("effect-vitest test end")).toHaveLength(3);
    })
  );

  layerIt.effect("preserves a late raceFirst success and expires the following property trial", () =>
    Effect.gen(function* () {
      const result = yield* runFixture("property-late-success", { trace: true });
      expect(result.exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      expect(result.diagnostics).toContain("Property failed after 2 tests");
      expect(result.diagnostics).toContain("seed: 4242");
      expect(result.diagnostics).toContain("155ms watchdog");
      expect(result.phases).not.toContain('"aborted":true');
      expect(Arr.filter(Str.split("\n")(result.cleanup), (line) => line === '["late-body-completed"]')).toHaveLength(1);
      expect(result.cleanup.split("effect-vitest test start")).toHaveLength(2);
      expect(result.cleanup.split("effect-vitest test end")).toHaveLength(2);
      expect(result.cleanup).toContain("outcome=failure");
    })
  );

  layerIt.effect("isolates concurrent property deadlines after delayed layer setup", () =>
    Effect.gen(function* () {
      const result = yield* runFixture("concurrent-property-layer", { trace: true });
      expect(result.exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      for (const evidence of ["property alpha", "property beta"]) {
        expect(result.output).toContain(evidence);
      }
      for (const evidence of ["TestHang", "last-property-alpha", "last-property-beta"]) {
        expect(result.cleanup).toContain(evidence);
      }
    })
  );

  layerIt.effect("isolates overlapping property registrations with the same title and callback", () =>
    Effect.gen(function* () {
      const result = yield* runFixture("property-registration-identity", { trace: true });
      expect(result.exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      expect(result.output).toContain("Counterexample: [false]");
      expect(result.output).toContain('"numPassedTests":1');
      expect(result.output).toContain('"numFailedTests":1');
      expect(result.output).not.toContain("TestHang");
      expect(result.cleanup).toContain("identity-success-body");
      expect(result.cleanup).toContain("identity-failure-body");
      expect(Str.split(result.cleanup, "effect-vitest test start")).toHaveLength(3);
      expect(Str.split(result.cleanup, "effect-vitest test end")).toHaveLength(3);
      expect(Str.split(result.cleanup, "outcome=success")).toHaveLength(2);
      expect(Str.split(result.cleanup, "outcome=failure")).toHaveLength(2);
      expect(Str.split(result.cleanup, "identity-success-body").length).toBeGreaterThanOrEqual(3);
    })
  );

  layerIt.effect("resets property lifecycle, deadline, and last-log state for repeats and retries", () =>
    Effect.gen(function* () {
      const repeat = yield* runFixture("property-repeat-reset", { trace: true });
      expect(repeat.exitCode).not.toBe(ChildProcessSpawner.ExitCode(0));
      expect(repeat.cleanup).toContain('"timeoutMillis":75');
      expect(repeat.cleanup).toContain('"lastLogLine":{"_id":"Option","_tag":"None"}');
      expect(repeat.output).not.toContain("5e-324ms watchdog");
      expect(repeat.cleanup.split("effect-vitest test start")).toHaveLength(3);
      expect(repeat.cleanup.split("effect-vitest test end")).toHaveLength(3);

      const retry = yield* runFixture("property-retry-reset", { trace: true });
      expect(retry.exitCode, retry.output).toBe(ChildProcessSpawner.ExitCode(0));
      expect(retry.cleanup.split("effect-vitest test start")).toHaveLength(3);
      expect(retry.cleanup.split("effect-vitest test end")).toHaveLength(3);
      expect(retry.cleanup).toContain("retry-execution-1");
      expect(retry.cleanup).toContain("retry-execution-2");
    })
  );

  layerIt.effect("preserves public each collection titles, options, duplicates, and case execution", () =>
    Effect.gen(function* () {
      const result = yield* runFixture("each-titles");
      expect(result.exitCode, result.output).toBe(ChildProcessSpawner.ExitCode(0));
    })
  );

  layerIt.effect("preserves only selection through the real runner", () =>
    Effect.gen(function* () {
      const result = yield* runFixture("only");
      expect(result.exitCode, result.output).toBe(ChildProcessSpawner.ExitCode(0));
      expect(result.output).not.toContain("must-not-run");
      expect(result.cleanup).toContain("only-ran");
    })
  );
});
