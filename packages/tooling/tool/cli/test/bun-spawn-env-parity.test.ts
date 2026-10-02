import { $RepoCliId } from "@beep/identity/packages";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Config, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("test/bun-spawn-env-parity");
// Third-party JSON reporter boundary; no Vitest internal result model is imported.
const ConformanceReport = S.Struct({
  success: S.Boolean,
  numTotalTests: S.Finite,
  numPassedTests: S.Finite,
  numFailedTests: S.Finite,
  testResults: S.Array(
    S.Struct({
      message: S.String,
      assertionResults: S.Array(
        S.Struct({
          fullName: S.String,
          failureMessages: S.Array(S.String),
        })
      ),
    })
  ),
}).annotate(
  $I.annote("ConformanceReport", {
    description: "Required outcomes of the isolated twenty-case spawn environment fixture.",
  })
);
const isNonEmptyExecutable = S.is(S.NonEmptyString);
const executablePathDelimiter = process.platform === "win32" ? ";" : ":";
const nodeExecutableName = process.platform === "win32" ? "node.exe" : "node";

// bunx --bun places a node -> bun shim before the host PATH. Probe candidates
// instead of trusting names, npm_node_execpath, NODE, or the outer process.execPath.
const hostNodeExecutable = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const searchPath = yield* Config.String("PATH");
  for (const directory of Str.split(executablePathDelimiter)(searchPath)) {
    const candidate = path.join(directory, nodeExecutableName);
    if (!(yield* fs.exists(candidate))) {
      continue;
    }
    const probe = yield* StepExec.runCaptured({
      command: candidate,
      args: ["-p", 'process.versions.bun === undefined ? process.execPath : ""'],
      source: "stdout",
      bound: StepExec.OutputBound.make({
        maxChars: 4096,
        truncatedNotice: "[output truncated]",
      }),
      timeout: "5 seconds",
    });
    const executable = Str.trim(probe.output);
    if (probe.exitCode === 0 && isNonEmptyExecutable(executable)) {
      return executable;
    }
  }
  return yield* Effect.die("No host Node executable found on PATH; Bun's node shim cannot qualify Node parity.");
}).pipe(Effect.withSpan("SpawnEnvParity.hostNodeExecutable"));

const decodeReport = S.decodeUnknownEffect(S.fromJsonString(ConformanceReport));

it.layer(NodeServices.layer, {
  excludeTestServices: true,
  timeout: "30 seconds",
})((it) => {
  for (const runtime of ["node", "bun"]) {
    it.effect(`preserves spawn environment replacement under ${runtime}`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = path.join(import.meta.dirname, "fixtures", "bun-spawn-env");
        const vitest = yield* path.fromFileUrl(new URL("vitest.mjs", import.meta.resolve("vitest/package.json")));
        const outputRoot = yield* fs.makeTempDirectoryScoped({
          prefix: "spawn-env-parity-",
        });
        const reportPath = path.join(outputRoot, "report.json");
        const result = yield* StepExec.runCaptured({
          command: runtime === "node" ? yield* hostNodeExecutable : runtime,
          args: [
            vitest,
            "run",
            "--config",
            path.join(fixture, "vitest.config.ts"),
            "--reporter=json",
            "--outputFile",
            reportPath,
          ],
          cwd: fixture,
          source: "all",
          bound: StepExec.OutputBound.make({
            maxChars: 16_384,
            truncatedNotice: "[output truncated]",
          }),
          timeout: "30 seconds",
          env: {
            BEEP_PARITY_PARENT: "synthetic-parent",
            BEEP_PARITY_WITNESS: "synthetic-unmentioned-parent",
            BEEP_PARITY_CHILD: undefined,
            BEEP_PARITY_RUNTIME: runtime,
            CI: "true",
            BEEP_VITEST_DOCTEST: undefined,
            BEEP_FC_NUM_RUNS: undefined,
            BEEP_FC_SEED: undefined,
            VITEST_COVERAGE_REPORT_ONLY: undefined,
            VITEST_COVERAGE_RATCHET: undefined,
          },
          extendEnv: true,
        });
        expect(yield* fs.exists(reportPath), result.output).toBe(true);
        const reportText = yield* fs.readFileString(reportPath);
        const report = yield* decodeReport(reportText);
        const failures = A.flatMap(report.testResults, (suite) => [
          suite.message,
          ...A.flatMap(suite.assertionResults, (test) =>
            A.map(test.failureMessages, (message) => `${test.fullName}: ${message}`)
          ),
        ]);
        const failureContext = Str.takeLeft(16_384)(`${result.output}\n${A.join(failures, "\n")}`);
        expect(result.exitCode, failureContext).toBe(0);
        expect(report.success).toBe(true);
        expect(report.numTotalTests).toBe(20);
        expect(report.numPassedTests).toBe(20);
        expect(report.numFailedTests).toBe(0);
      })
    );
  }
});
