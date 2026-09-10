import * as NodeURL from "node:url";
import { Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import {
  Array as Arr,
  Cause,
  Clock,
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
const runtimePoolArgs = process.versions.bun === undefined ? [] : ["--pool=threads"];
const processClock = Effect.runSync(Clock.Clock);
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
  readonly report: string;
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
        })
      ),
    })
  )
);

const retainFixtureEvidence = Effect.fnUntraced(function* (
  directory: string,
  runtimeTest: string,
  readOutput: () => string,
  explicitEvidenceDirectory?: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configuredEvidence = yield* Config.option(Config.String("BEEP_VITEST_RUNTIME_EVIDENCE"));
  const evidenceDirectory = O.orElse(O.fromUndefinedOr(explicitEvidenceDirectory), () => configuredEvidence);
  // Registered after the temp directory: persist first on success, failure or
  // cancellation, then let the existing directory finalizer remove its files.
  if (O.isSome(evidenceDirectory)) {
    yield* Effect.addFinalizer((exit) =>
      Effect.gen(function* () {
        yield* fs.writeFileString(path.join(directory, "process-output.txt"), readOutput());
        const scopeExit = yield* encodeScopeExit({
          interrupted: Exit.hasInterrupts(exit),
        });
        yield* fs.writeFileString(path.join(directory, "scope-exit.json"), scopeExit);
        yield* fs.writeFileString(`${runtimeTest}.errors.jsonl`, rawErrorLines(readOutput()));
        yield* fs.makeDirectory(evidenceDirectory.value, { recursive: true });
        yield* fs.copy(directory, path.join(evidenceDirectory.value, path.basename(directory)));
      }).pipe(Effect.orDie)
    );
  }
});

const encodeProcessPhase = Schema.encodeEffect(
  Schema.fromJsonString(
    Schema.Struct({
      mode: Schema.String,
      trace: Schema.Boolean,
      ci: Schema.Boolean,
      phase: Schema.String,
      monotonicNanos: Schema.BigIntFromString,
      interrupted: Schema.Boolean,
    })
  )
);

const traceCases = [
  { name: "trace-off", mode: "trace-success", ci: "false", trace: "0" },
  { name: "trace-on", mode: "trace-success", ci: "false", trace: "1" },
  { name: "trace-ci", mode: "trace-success", ci: "true", trace: "0" },
  { name: "trace-failure", mode: "trace-failure", ci: "false", trace: "1" },
];
const encodeConfig = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const prepareRuntimeFixtures = Effect.fnUntraced(function* (directory: string, mode: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const source = yield* fs.readFileString(fixtureSource);
  yield* fs.writeFileString(path.join(directory, "runtime.test.ts"), source);
  if (mode !== "trace-matrix") return [];
  const projects = yield* Effect.forEach(traceCases, (entry) =>
    Effect.gen(function* () {
      const projectDirectory = path.join(directory, entry.name);
      yield* fs.makeDirectory(projectDirectory);
      const fixture = path.join(projectDirectory, "runtime.test.ts");
      yield* fs.writeFileString(fixture, source);
      return {
        extends: true,
        test: {
          name: entry.name,
          root: projectDirectory,
          include: [fixture],
          isolate: true,
          maxWorkers: 1,
          env: {
            BEEP_INSTRUMENTED_IT_FIXTURE: entry.mode,
            CI: entry.ci,
            BEEP_TEST_TRACE: entry.trace,
            BEEP_TRACE_CASE: entry.name,
          },
        },
      };
    })
  );
  const config = yield* encodeConfig({ test: { maxWorkers: 1, projects } });
  const base = yield* encodeConfig(path.join(packageRoot, "vitest.config.ts"));
  const configPath = path.join(directory, "trace.config.ts");
  yield* fs.writeFileString(
    configPath,
    `import { defineConfig, mergeConfig } from "vitest/config";\nimport base from ${base};\nexport default mergeConfig(base, defineConfig(${config}));\n`
  );
  return ["--config", configPath];
});

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
      yield* retainFixtureEvidence(directory, runtimeTest, () => output, options?.evidenceDirectory);
      let processPhases = emptyString();
      const recordProcessPhase = Effect.fnUntraced(function* (phase: string, interrupted = false) {
        const line = yield* encodeProcessPhase({
          mode,
          trace: options?.trace === true,
          ci: options?.ci === true,
          phase,
          monotonicNanos: yield* processClock.monotonicTimeNanos,
          interrupted,
        });
        processPhases = Str.concat(processPhases, `${line}\n`);
        yield* fs.writeFileString(path.join(directory, "process-phases.jsonl"), processPhases);
      });
      yield* Effect.addFinalizer((exit) =>
        recordProcessPhase("scope-close", Exit.hasInterrupts(exit)).pipe(Effect.orDie)
      );
      yield* recordProcessPhase("prepared");
      yield* fs
        .readFileString(reporterSource)
        .pipe(Effect.flatMap((source) => fs.writeFileString(reporterPath, source)));
      const projectArgs = yield* prepareRuntimeFixtures(directory, mode);

      const args = [
        vitestBin,
        "run",
        directory,
        ...runtimePoolArgs,
        ...projectArgs,
        "--root",
        packageRoot,
        "--reporter=json",
        `--reporter=${reporterPath}`,
        `--outputFile=${resultPath}`,
        ...(mode === "only" ? ["--allowOnly"] : []),
      ];
      yield* recordProcessPhase("spawn");
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
      let receivedOutput = false;
      yield* child.all.pipe(
        Stream.decodeText(),
        Stream.runForEach(
          Effect.fnUntraced(function* (chunk) {
            output = Str.concat(output, chunk);
            if (!receivedOutput) {
              receivedOutput = true;
              yield* recordProcessPhase("first-output");
            }
          })
        )
      );
      yield* recordProcessPhase("drain");
      const exitCode = yield* child.exitCode;
      yield* recordProcessPhase("exit");
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
        report: resultOutput,
      };
    })
  );

const decodeTraceObservation = Schema.decodeEffect(
  Schema.fromJsonString(
    Schema.Struct({
      case: Schema.String,
      ci: Schema.Boolean,
      trace: Schema.String,
      cleanup: Schema.String,
    })
  )
);
const decodeTraceReport = Schema.decodeEffect(
  Schema.fromJsonString(
    Schema.Struct({
      numTotalTests: Schema.Finite,
      testResults: Schema.Array(
        Schema.Struct({
          name: Schema.String,
          assertionResults: Schema.Array(
            Schema.Struct({
              status: Schema.String,
              failureMessages: Schema.Array(Schema.String),
            })
          ),
        })
      ),
    })
  )
);
const runTraceMatrix = Effect.fnUntraced(function* () {
  const result = yield* runFixture("trace-matrix");
  const observations = yield* Effect.forEach(
    Arr.filter(Str.split("\n")(result.output), Str.startsWith("BEEP_TRACE_OBSERVATION ")),
    (line) => decodeTraceObservation(Str.slice(23)(line))
  );
  const report = yield* decodeTraceReport(result.report);
  expect(report.numTotalTests).toBe(4);
  expect(observations).toHaveLength(4);
  const observationFor = Effect.fnUntraced(function* (name: string) {
    const observation = yield* Effect.fromOption(Arr.findFirst(observations, (value) => value.case === name));
    const configuration = yield* Effect.fromOption(Arr.findFirst(traceCases, (value) => value.name === name));
    const project = yield* Effect.fromOption(
      Arr.findFirst(report.testResults, (value) => Str.includes(`/${name}/`)(value.name))
    );
    expect(project.assertionResults).toHaveLength(1);
    expect(observation.ci).toBe(configuration.ci === "true");
    expect(observation.trace).toBe(configuration.trace);
    const assertion = yield* Effect.fromOption(Arr.head(project.assertionResults));
    expect(assertion.status).toBe(name === "trace-failure" ? "failed" : "passed");
    return {
      cleanup: observation.cleanup,
      output: Arr.join(assertion.failureMessages, "\n"),
      exitCode: ChildProcessSpawner.ExitCode(assertion.status === "passed" ? 0 : 1),
    };
  });
  return yield* Effect.all({
    traceOff: observationFor("trace-off"),
    traceOn: observationFor("trace-on"),
    ciOn: observationFor("trace-ci"),
    failure: observationFor("trace-failure"),
  });
});

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
      const processPhases = yield* fs.readFileString(path.join(retained, "process-phases.jsonl"));
      for (const phase of ["prepared", "spawn", "first-output", "drain", "exit", "scope-close"]) {
        expect(processPhases).toContain(`"phase":"${phase}"`);
      }
      expect(processPhases).toContain('"interrupted":true');
      const phaseRecords = yield* decodePhases(Str.split("\n")(phases));
      expect(Arr.map(phaseRecords, ({ phase }) => phase)).toEqual(["beforeEach", "abort", "finished", "failed"]);
      expect(Arr.map(phaseRecords, ({ aborted }) => aborted)).toEqual([false, true, true, true]);
      for (const [previous, next] of Arr.zip(phaseRecords, Arr.drop(phaseRecords, 1))) {
        expect(next.monotonicNanos).toBeGreaterThanOrEqual(previous.monotonicNanos);
      }
      // Keep this interrupted-scope receipt in the same optional durable sink as
      // ordinary fixtures before this test's temporary evidence directory closes.
      const configuredEvidence = yield* Config.option(Config.String("BEEP_VITEST_RUNTIME_EVIDENCE"));
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
      expect(tiny.cleanup).toContain("tiny body released\n");

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
      expect(result.cleanup).toContain("alpha expired while beta remained active");
      expect(result.output).toContain(
        'Instrumented test "isolated concurrent cases > case alpha" exceeded its 155ms watchdog. Last log: last-alpha'
      );
      expect(result.output).toContain(
        'Instrumented test "isolated concurrent cases > case beta" exceeded its 215ms watchdog. Last log: last-beta'
      );
    })
  );

  layerIt.effect("gates lifecycle output while preserving trace success and failure outcomes", () =>
    Effect.gen(function* () {
      const { traceOff, traceOn, ciOn, failure } = yield* runTraceMatrix();
      expect(traceOff.exitCode).toBe(ChildProcessSpawner.ExitCode(0));
      expect(traceOff.cleanup).toContain("trace-body-success");
      expect(traceOff.cleanup).not.toContain("effect-vitest test start");
      expect(traceOff.cleanup).not.toContain("effect-vitest test end");

      expect(traceOn.exitCode).toBe(ChildProcessSpawner.ExitCode(0));
      expect(traceOn.cleanup).toContain("effect-vitest test start");
      expect(traceOn.cleanup).toContain("effect-vitest test end");
      expect(traceOn.cleanup).toContain("outcome=success");
      expect(traceOn.cleanup).toContain("durationMillis=");

      expect(ciOn.exitCode).toBe(ChildProcessSpawner.ExitCode(0));
      expect(ciOn.cleanup).toContain("effect-vitest test start");

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
      expect(result.output).toContain('Replay: [0,\\"4242\\"');
      expect(result.output).toContain("Shrunk");
      expect(result.diagnostics).toContain("Shrunk input: [1]");
      expect(result.diagnostics).toContain('Replay: [0,\\"4242\\"');
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
          expect(error.message).toContain("Property falsified after 1 run(s)");
          expect(error.message).toContain("155ms watchdog");
        }
      }
      expect(result.diagnostics).toContain('Replay: [0,\\"4242\\"');
      expect(result.diagnostics).toContain("and 1 shrink(s)");
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
      expect(result.diagnostics).toContain("Property falsified after 2 run(s)");
      expect(result.diagnostics).toContain('Replay: [0,\\"4242\\"');
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
      expect(result.output).toContain("Shrunk input: [false]");
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
