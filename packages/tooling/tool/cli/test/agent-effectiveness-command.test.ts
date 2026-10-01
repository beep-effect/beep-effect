import {
  AgentEffectivenessAnnotationCheckReport,
  AgentEffectivenessDatasetBundle,
  AgentEffectivenessDoctorReport,
  AgentEffectivenessPhoenixSyncResult,
  AgentEffectivenessPromptBundle,
} from "@beep/repo-ai-metrics";
import { agentEffectivenessCommand } from "@beep/repo-cli/commands/AgentEffectiveness";
import { AgentConventionComparison } from "@beep/repo-cli/test/AgentEffectiveness";
import { it } from "@beep/test-runner";
import { fcRuns, privacySafeSystemTempRoot } from "@beep/test-utils";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Cause, ConfigProvider, Console, Effect, Exit, FileSystem, Path, pipe, Result, Runtime } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import { Command } from "effect/cli";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import baselineReceipt from "./fixtures/agent-effectiveness/comparison/baseline.json" with { type: "json" };
import candidateReceipt from "./fixtures/agent-effectiveness/comparison/candidate.json" with { type: "json" };

const temporaryDirectory = FileSystem.FileSystem.use((fs) =>
  Effect.acquireRelease(
    fs.makeTempDirectory({ directory: privacySafeSystemTempRoot(), prefix: "beep-agent-effectiveness-" }),
    (directory) => fs.remove(directory, { recursive: true, force: true }).pipe(Effect.orDie)
  )
);

const runAgentEffectivenessCommand = Command.runWith(agentEffectivenessCommand, { version: "0.0.0" });
const encodeFixture = S.encodeEffect(S.fromJsonString(S.Unknown));
const CommandTestLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    for (const [name, receipt] of [
      ["baseline.json", baselineReceipt],
      ["candidate.json", candidateReceipt],
    ] as const) {
      const target = yield* path.fromFileUrl(
        new URL("./fixtures/agent-effectiveness/comparison/" + name, import.meta.url)
      );
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.writeFileString(target, yield* encodeFixture(receipt));
    }
  })
).pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, MemoryFileSystem.layer)));
const decodeDoctorReport = S.decodeUnknownEffect(S.fromJsonString(AgentEffectivenessDoctorReport));
const decodeAnnotationCheckReport = S.decodeUnknownEffect(S.fromJsonString(AgentEffectivenessAnnotationCheckReport));
const decodeDatasetBundle = S.decodeUnknownEffect(S.fromJsonString(AgentEffectivenessDatasetBundle));
const decodePhoenixSyncResult = S.decodeUnknownEffect(S.fromJsonString(AgentEffectivenessPhoenixSyncResult));
const decodePromptBundle = S.decodeUnknownEffect(S.fromJsonString(AgentEffectivenessPromptBundle));
const decodeConventionComparison = S.decodeUnknownEffect(S.fromJsonString(AgentConventionComparison));
const decodeDoctorReportResult = S.decodeUnknownResult(S.fromJsonString(AgentEffectivenessDoctorReport));
const decodeAnnotationCheckReportResult = S.decodeUnknownResult(
  S.fromJsonString(AgentEffectivenessAnnotationCheckReport)
);
const decodePhoenixSyncResultResult = S.decodeUnknownResult(S.fromJsonString(AgentEffectivenessPhoenixSyncResult));
const decodePromptBundleResult = S.decodeUnknownResult(S.fromJsonString(AgentEffectivenessPromptBundle));
const encodeDoctorReportResult = S.encodeUnknownResult(S.fromJsonString(AgentEffectivenessDoctorReport));
const encodeAnnotationCheckReportResult = S.encodeUnknownResult(
  S.fromJsonString(AgentEffectivenessAnnotationCheckReport)
);
const encodePhoenixSyncResultResult = S.encodeUnknownResult(S.fromJsonString(AgentEffectivenessPhoenixSyncResult));
const encodePromptBundleResult = S.encodeUnknownResult(S.fromJsonString(AgentEffectivenessPromptBundle));
const DoctorReportArbitrary = Arbitrary.schema(AgentEffectivenessDoctorReport);
const AnnotationCheckReportArbitrary = Arbitrary.schema(AgentEffectivenessAnnotationCheckReport);
const PhoenixSyncResultArbitrary = Arbitrary.schema(AgentEffectivenessPhoenixSyncResult);
const PromptBundleArbitrary = Arbitrary.schema(AgentEffectivenessPromptBundle);

const expectReportedExit = (exit: Exit.Exit<unknown, unknown>, exitCode = 1, reported = false) => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    const error = Cause.squash(exit.cause);
    expect(Runtime.getErrorExitCode(error)).toBe(exitCode);
    expect(Runtime.getErrorReported(error)).toBe(reported);
  }
};
const workerReportJson = `{
  "cleanup": { "deleteStatus": "completed", "stopStatus": "completed" },
  "otlp": { "status": "exported" },
  "workerEval": {
    "summary": { "completed": 1, "failed": 0, "selectedPackets": 1, "timedOut": 0 },
    "policyViolations": []
  }
}`;

const workerReportJsonWithSecretShapedPolicyCode = `{
  "cleanup": { "deleteStatus": "completed", "stopStatus": "completed" },
  "otlp": { "status": "exported" },
  "workerEval": {
    "summary": { "completed": 1, "failed": 0, "selectedPackets": 1, "timedOut": 0 },
    "policyViolations": [{ "code": "API_KEY=oops" }]
  }
}`;
const writeText = Effect.fn("AgentEffectivenessCommandTest.writeText")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, content);
});

const withPhoenixBaseUrlEnv = <A, E, R>(phoenixBaseUrl: string, use: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  use.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown({ BEEP_AGENT_EFFECTIVENESS_PHOENIX_BASE_URL: phoenixBaseUrl })
    )
  );

const lastLoggedLine = Effect.fn("AgentEffectivenessCommandTest.lastLoggedLine")(function* () {
  const last = pipe(yield* TestConsole.logLines, A.last);
  if (last._tag === "Some") {
    return last.value;
  }

  return "";
});

it.layer(CommandTestLayer, { concurrent: false, timeout: "10 seconds" })("agent-effectiveness command", (it) => {
  describe("comparable convention receipts", () => {
    it.effect("compares declared convention receipts through CLI flags", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const baseline = yield* path.fromFileUrl(
          new URL("./fixtures/agent-effectiveness/comparison/baseline.json", import.meta.url)
        );
        const candidate = yield* path.fromFileUrl(
          new URL("./fixtures/agent-effectiveness/comparison/candidate.json", import.meta.url)
        );
        yield* runAgentEffectivenessCommand([
          "evals",
          "compare",
          "--baseline",
          baseline,
          "--candidate",
          candidate,
          "--fail-incomparable",
        ]);
        const report = yield* decodeConventionComparison(yield* lastLoggedLine());
        expect(report.result).toMatchObject({ _tag: "Comparable", changedSurface: "navigation" });
        expect(report.baseline.runId).not.toBe(report.candidate.runId);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("incomparable convention receipts", () => {
    it.effect("prints an incomparable report before applying the optional CLI failure gate", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const baseline = yield* path.fromFileUrl(
          new URL("./fixtures/agent-effectiveness/comparison/baseline.json", import.meta.url)
        );
        const args = ["evals", "compare", "--baseline", baseline, "--candidate", baseline];
        yield* runAgentEffectivenessCommand(args);
        const report = yield* decodeConventionComparison(yield* lastLoggedLine());
        expect(report.result).toEqual({ _tag: "Incomparable", reasons: ["run-reused", "surface-count"] });
        expectReportedExit(
          yield* Effect.exit(runAgentEffectivenessCommand(A.append(args, "--fail-incomparable"))),
          1,
          true
        );
        const gatedReport = yield* decodeConventionComparison(yield* lastLoggedLine());
        expect(gatedReport).toEqual(report);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("malformed convention receipts", () => {
    it.effect("refuses a malformed convention receipt without printing a partial report", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped({
          directory: privacySafeSystemTempRoot(),
          prefix: "beep-agent-convention-",
        });
        const malformed = path.join(tmpDir, "malformed-trial.json");
        yield* writeText(malformed, "{ invalid JSON");
        const exit = yield* Effect.exit(
          runAgentEffectivenessCommand(["evals", "compare", "--baseline", malformed, "--candidate", malformed])
        );
        expectReportedExit(exit, 1, true);
        expect(yield* TestConsole.logLines).toEqual([]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  it.effect.prop(
    "round-trips schema-derived report data through JSON command boundaries",
    [DoctorReportArbitrary, AnnotationCheckReportArbitrary, PhoenixSyncResultArbitrary, PromptBundleArbitrary],
    ([doctorReport, annotationCheckReport, phoenixSyncResult, promptBundle]) =>
      Effect.sync(() => {
        const encodedDoctorReport = Result.getOrThrow(encodeDoctorReportResult(doctorReport));
        const decodedDoctorReport = Result.getOrThrow(decodeDoctorReportResult(encodedDoctorReport));
        expect(Result.getOrThrow(encodeDoctorReportResult(decodedDoctorReport))).toBe(encodedDoctorReport);

        const encodedAnnotationCheckReport = Result.getOrThrow(
          encodeAnnotationCheckReportResult(annotationCheckReport)
        );
        const decodedAnnotationCheckReport = Result.getOrThrow(
          decodeAnnotationCheckReportResult(encodedAnnotationCheckReport)
        );
        expect(Result.getOrThrow(encodeAnnotationCheckReportResult(decodedAnnotationCheckReport))).toBe(
          encodedAnnotationCheckReport
        );

        const encodedPhoenixSyncResult = Result.getOrThrow(encodePhoenixSyncResultResult(phoenixSyncResult));
        const decodedPhoenixSyncResult = Result.getOrThrow(decodePhoenixSyncResultResult(encodedPhoenixSyncResult));
        expect(Result.getOrThrow(encodePhoenixSyncResultResult(decodedPhoenixSyncResult))).toBe(
          encodedPhoenixSyncResult
        );

        const encodedPromptBundle = Result.getOrThrow(encodePromptBundleResult(promptBundle));
        const decodedPromptBundle = Result.getOrThrow(decodePromptBundleResult(encodedPromptBundle));
        expect(Result.getOrThrow(encodePromptBundleResult(decodedPromptBundle))).toBe(encodedPromptBundle);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect("emits report-only doctor JSON with offline Phoenix", () =>
    Effect.gen(function* () {
      const tmpDir = yield* temporaryDirectory;

      const path = yield* Path.Path;
      const dataRoot = path.join(tmpDir, "metrics");
      const workerReportPath = path.join(tmpDir, "worker-eval.json");
      yield* writeText(workerReportPath, workerReportJson);

      yield* runAgentEffectivenessCommand([
        "doctor",
        "--data-root",
        dataRoot,
        "--worker-eval-report",
        workerReportPath,
        "--no-phoenix",
        "--json",
      ]);

      const output = yield* lastLoggedLine();
      const report = yield* decodeDoctorReport(output);
      expect(report.phoenix.status).toBe("unavailable");
      expect(report.jsdocWorkerEval.completedPackets).toBe(1);
      expect(process.exitCode ?? 0).toBe(0);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("uses the Phoenix base URL from Config when the flag is omitted", () =>
    Effect.gen(function* () {
      const tmpDir = yield* temporaryDirectory;

      const path = yield* Path.Path;
      const dataRoot = path.join(tmpDir, "metrics");
      const phoenixBaseUrl = "https://phoenix.example.test";
      const workerReportPath = path.join(tmpDir, "worker-eval.json");
      yield* writeText(workerReportPath, workerReportJson);

      yield* withPhoenixBaseUrlEnv(
        phoenixBaseUrl,
        runAgentEffectivenessCommand([
          "doctor",
          "--data-root",
          dataRoot,
          "--worker-eval-report",
          workerReportPath,
          "--no-phoenix",
          "--json",
        ])
      );

      const output = yield* lastLoggedLine();
      const report = yield* decodeDoctorReport(output);
      expect(report.phoenix.baseUrl).toBe(phoenixBaseUrl);
      expect(process.exitCode ?? 0).toBe(0);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("emits report-only annotation check JSON", () =>
    Effect.gen(function* () {
      const tmpDir = yield* temporaryDirectory;

      const path = yield* Path.Path;
      const dataRoot = path.join(tmpDir, "metrics");
      const workerReportPath = path.join(tmpDir, "worker-eval.json");
      yield* writeText(workerReportPath, workerReportJson);

      yield* runAgentEffectivenessCommand([
        "annotations",
        "check",
        "--data-root",
        dataRoot,
        "--worker-eval-report",
        workerReportPath,
        "--no-phoenix",
        "--json",
      ]);

      const output = yield* lastLoggedLine();
      const report = yield* decodeAnnotationCheckReport(output);
      expect(report.status).toBe("passed");
      expect(report.annotationCount).toBeGreaterThan(0);
      expect(process.exitCode ?? 0).toBe(0);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("sets a failing process exit code when annotation check findings are present", () =>
    Effect.gen(function* () {
      const tmpDir = yield* temporaryDirectory;

      const path = yield* Path.Path;
      const dataRoot = path.join(tmpDir, "metrics");
      const workerReportPath = path.join(tmpDir, "worker-eval.json");
      yield* writeText(workerReportPath, workerReportJsonWithSecretShapedPolicyCode);

      const exit = yield* Effect.exit(
        runAgentEffectivenessCommand([
          "annotations",
          "check",
          "--data-root",
          dataRoot,
          "--worker-eval-report",
          workerReportPath,
          "--no-phoenix",
          "--json",
        ])
      );

      const output = yield* lastLoggedLine();
      const report = yield* decodeAnnotationCheckReport(output);
      expectReportedExit(exit);
      expect(report.status).toBe("failed");
      expect(
        pipe(
          report.findings,
          A.map((finding) => finding.code)
        )
      ).toContain("secret-shaped-value");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("emits sanitized Phoenix dataset bundle JSON", () =>
    Effect.gen(function* () {
      const tmpDir = yield* temporaryDirectory;

      const path = yield* Path.Path;
      const dataRoot = path.join(tmpDir, "metrics");
      const workerReportPath = path.join(tmpDir, "worker-eval.json");
      yield* writeText(workerReportPath, workerReportJson);

      yield* runAgentEffectivenessCommand([
        "datasets",
        "bundle",
        "--data-root",
        dataRoot,
        "--worker-eval-report",
        workerReportPath,
        "--no-phoenix",
        "--json",
      ]);

      const output = yield* lastLoggedLine();
      const bundle = yield* decodeDatasetBundle(output);
      expect(bundle.datasets.length).toBe(5);
      expect(output).not.toContain("draftJsDoc");
      expect(output).not.toContain("@example");
      expect(process.exitCode ?? 0).toBe(0);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("emits static Phoenix prompt bundle JSON without doctor inputs", () =>
    Effect.gen(function* () {
      yield* temporaryDirectory;

      yield* runAgentEffectivenessCommand(["prompts", "bundle", "--json"]);

      const output = yield* lastLoggedLine();
      const bundle = yield* decodePromptBundle(output);
      expect(bundle.prompts.length).toBe(2);
      expect(bundle.projectName).toBe("beep-agent-effectiveness");
      expect(process.exitCode ?? 0).toBe(0);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("defaults Phoenix sync to dry-run JSON", () =>
    Effect.gen(function* () {
      const tmpDir = yield* temporaryDirectory;

      const path = yield* Path.Path;
      const dataRoot = path.join(tmpDir, "metrics");
      const workerReportPath = path.join(tmpDir, "worker-eval.json");
      yield* writeText(workerReportPath, workerReportJson);

      yield* runAgentEffectivenessCommand([
        "phoenix",
        "sync",
        "--data-root",
        dataRoot,
        "--worker-eval-report",
        workerReportPath,
        "--no-phoenix",
        "--json",
      ]);

      const output = yield* lastLoggedLine();
      const result = yield* decodePhoenixSyncResult(output);
      expect(result.status).toBe("passed");
      expect(result.dryRun).toBe(true);
      expect(result.datasetCount).toBe(5);
      expect(result.promptCount).toBe(2);
      expect(result.experimentCount).toBe(5);
      expect(result.writtenDatasetIds).toEqual([]);
      expect(process.exitCode ?? 0).toBe(0);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
});
