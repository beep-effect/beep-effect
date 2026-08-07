/**
 * Agent-effectiveness command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $RepoCliId } from "@beep/identity";
import { Phoenix, PhoenixConfigInput } from "@beep/phoenix";
import {
  AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION,
  AgentEffectivenessAnnotationPlanInput,
  AgentEffectivenessDoctorInput,
  AgentEffectivenessPhoenixSyncInput,
  AgentEffectivenessStatus,
  AiMetricsDeployTarget,
  agentEffectivenessAnnotationCheckReportToJson,
  agentEffectivenessAnnotationPlanToJson,
  agentEffectivenessDatasetBundleToJson,
  agentEffectivenessDoctorReportToJson,
  agentEffectivenessExperimentBundleToJson,
  agentEffectivenessPhoenixSyncResultToJson,
  agentEffectivenessPromptBundleToJson,
  DEFAULT_AGENT_EFFECTIVENESS_WORKER_EVAL_REPORT_PATH,
  makeAgentEffectivenessAnnotationCheckReport,
  makeAgentEffectivenessAnnotationPlan,
  makeAgentEffectivenessDatasetBundle,
  makeAgentEffectivenessDoctorReport,
  makeAgentEffectivenessExperimentBundle,
  makeAgentEffectivenessPromptBundle,
  syncAgentEffectivenessPhoenix,
} from "@beep/repo-ai-metrics";
import { A } from "@beep/utils";
import { Config, Console, DateTime, Effect, flow, Layer, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { aiMetricsDataRootFlag as dataRootFlag, jsonFlag } from "../../internal/cli/Flags.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { resolveDataRoot } from "../AIMetrics/AIMetrics.config.ts";
import { runAgentEffectivenessEvalScoreCommand } from "./internal/EvalScorer.ts";
import type {
  AgentEffectivenessAnnotationCheckReport,
  AgentEffectivenessAnnotationPlan,
  AgentEffectivenessDatasetBundle,
  AgentEffectivenessDoctorReport,
  AgentEffectivenessError,
  AgentEffectivenessExperimentBundle,
  AgentEffectivenessPhoenixSyncResult,
  AgentEffectivenessPromptBundle,
} from "@beep/repo-ai-metrics";
import type { Scope } from "effect";
import type { HttpClient } from "effect/unstable/http";

const $I = $RepoCliId.create("commands/AgentEffectiveness/AgentEffectiveness.command");

const agentEffectivenessPhoenixBaseUrlEnvVar = "BEEP_AGENT_EFFECTIVENESS_PHOENIX_BASE_URL";
const defaultAgentEffectivenessPhoenixBaseUrl = "https://dankserver.tailc7c348.ts.net:8447";
const agentEffectivenessPhoenixBaseUrlConfig = Config.string(agentEffectivenessPhoenixBaseUrlEnvVar).pipe(
  Config.withDefault(defaultAgentEffectivenessPhoenixBaseUrl)
);

const noPhoenixFlag = Flag.boolean("no-phoenix").pipe(
  Flag.withDescription("Skip live Phoenix probes and report Phoenix as unavailable")
);
const targetFlag = Flag.choiceWithValue("target", [
  ["local", AiMetricsDeployTarget.Enum.local],
  ["dankserver", AiMetricsDeployTarget.Enum.dankserver],
]).pipe(
  Flag.withDefault(AiMetricsDeployTarget.Enum.dankserver),
  Flag.withDescription("Agent-effectiveness evidence target")
);
const phoenixBaseUrlFlag = Flag.string("phoenix-base-url").pipe(
  Flag.withFallbackConfig(agentEffectivenessPhoenixBaseUrlConfig),
  Flag.withDescription(`Read-only Phoenix base URL, or ${agentEffectivenessPhoenixBaseUrlEnvVar}`)
);
const workerEvalReportFlag = Flag.string("worker-eval-report").pipe(
  Flag.withDefault(DEFAULT_AGENT_EFFECTIVENESS_WORKER_EVAL_REPORT_PATH),
  Flag.withDescription("JSDoc worker-eval report or initiative manifest path")
);
const writeFlag = Flag.boolean("write").pipe(
  Flag.withDescription("Perform live Phoenix writes instead of the default dry-run")
);
const evalFixtureDirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("SkillOpt fixture copy directory to score")
);
const evalTaskManifestFlag = Flag.file("task", { mustExist: true }).pipe(
  Flag.withDescription("SkillOpt task manifest JSON path")
);
const evalRecordFlag = Flag.boolean("record").pipe(
  Flag.withDescription("Record the score as an ai-metrics BenchmarkRun row")
);
const confirmPhoenixWriteFlag = Flag.string("confirm-phoenix-write").pipe(
  Flag.withDescription(
    `Confirmation token required for live Phoenix writes: ${AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION}`
  ),
  Flag.optional
);

const runAgentEffectivenessProgram = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<void, E, R> =>
  effect.pipe(Effect.asVoid);

const provideAgentEffectivenessLayers: {
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    dataRoot: string
  ): Effect.Effect<A, E, Path.Path | Exclude<Exclude<R, DuckDb | HttpClient.HttpClient>, Scope.Scope>>;
  (
    dataRoot: string
  ): <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Path.Path | Exclude<Exclude<R, DuckDb | HttpClient.HttpClient>, Scope.Scope>>;
} = dual(
  2,
  Effect.fn("AgentEffectiveness.provideLayers")(function* <A, E, R>(effect: Effect.Effect<A, E, R>, dataRoot: string) {
    const path = yield* Path.Path;
    const duckDbPath = path.resolve(dataRoot, "derived", "ai-metrics.duckdb");
    return yield* Effect.scoped(
      Layer.build(
        Layer.mergeAll(
          DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath })),
          FetchHttpClient.layer
        )
      ).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
    );
  })
);

const provideAgentEffectivenessPhoenixLayers: {
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    dataRoot: string,
    phoenixBaseUrl: string
  ): Effect.Effect<A, E, Path.Path | Exclude<Exclude<R, DuckDb | HttpClient.HttpClient | Phoenix>, Scope.Scope>>;
  (
    dataRoot: string,
    phoenixBaseUrl: string
  ): <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Path.Path | Exclude<Exclude<R, DuckDb | HttpClient.HttpClient | Phoenix>, Scope.Scope>>;
} = dual(
  3,
  Effect.fn("AgentEffectiveness.providePhoenixLayers")(function* <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    dataRoot: string,
    phoenixBaseUrl: string
  ) {
    const path = yield* Path.Path;
    const duckDbPath = path.resolve(dataRoot, "derived", "ai-metrics.duckdb");
    return yield* Effect.scoped(
      Layer.build(
        Layer.mergeAll(
          DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath })),
          FetchHttpClient.layer,
          Phoenix.makeLayer(PhoenixConfigInput.make({ baseUrl: phoenixBaseUrl }))
        )
      ).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
    );
  })
);

const renderDoctorReport: {
  (report: AgentEffectivenessDoctorReport, json: boolean): Effect.Effect<void, AgentEffectivenessError>;
  (json: boolean): (report: AgentEffectivenessDoctorReport) => Effect.Effect<void, AgentEffectivenessError>;
} = dual(
  2,
  Effect.fn("AgentEffectiveness.renderDoctorReport")(function* (report: AgentEffectivenessDoctorReport, json: boolean) {
    if (json) {
      yield* Console.log(yield* agentEffectivenessDoctorReportToJson(report));
      return;
    }
    yield* printLines([
      `agent-effectiveness doctor: status=${report.summary.status}`,
      `phoenix: ${report.phoenix.status} ${report.phoenix.message}`,
      `ai-metrics: ${report.aiMetrics.status} ${report.aiMetrics.message}`,
      `jsdoc-worker-eval: ${report.jsdocWorkerEval.status} ${report.jsdocWorkerEval.message}`,
    ]);
  })
);

const renderAnnotationPlan: {
  (plan: AgentEffectivenessAnnotationPlan, json: boolean): Effect.Effect<void, AgentEffectivenessError>;
  (json: boolean): (plan: AgentEffectivenessAnnotationPlan) => Effect.Effect<void, AgentEffectivenessError>;
} = dual(
  2,
  Effect.fn("AgentEffectiveness.renderAnnotationPlan")(function* (
    plan: AgentEffectivenessAnnotationPlan,
    json: boolean
  ) {
    if (json) {
      yield* Console.log(yield* agentEffectivenessAnnotationPlanToJson(plan));
      return;
    }

    yield* printLines([
      `agent-effectiveness annotations plan: status=${plan.summary.status}`,
      `planned annotations: ${plan.annotations.length}`,
      `mutation policy: ${plan.mutationPolicy}`,
    ]);
  })
);

const renderAnnotationCheck: {
  (report: AgentEffectivenessAnnotationCheckReport, json: boolean): Effect.Effect<void, AgentEffectivenessError>;
  (json: boolean): (report: AgentEffectivenessAnnotationCheckReport) => Effect.Effect<void, AgentEffectivenessError>;
} = dual(
  2,
  Effect.fn("AgentEffectiveness.renderAnnotationCheck")(function* (
    report: AgentEffectivenessAnnotationCheckReport,
    json: boolean
  ) {
    if (json) {
      yield* agentEffectivenessAnnotationCheckReportToJson(report).pipe(Effect.tap(Console.log));
      return;
    }

    yield* printLines([
      `agent-effectiveness annotations check: status=${report.status}`,
      `checked annotations: ${report.annotationCount}`,
      `findings: ${report.findings.length}`,
    ]);
  })
);

const renderDatasetBundle: {
  (bundle: AgentEffectivenessDatasetBundle, json: boolean): Effect.Effect<void, AgentEffectivenessError>;
  (json: boolean): (bundle: AgentEffectivenessDatasetBundle) => Effect.Effect<void, AgentEffectivenessError>;
} = dual(
  2,
  Effect.fn("AgentEffectiveness.renderDatasetBundle")(function* (
    bundle: AgentEffectivenessDatasetBundle,
    json: boolean
  ) {
    if (json) {
      yield* agentEffectivenessDatasetBundleToJson(bundle).pipe(Effect.tap(Console.log));
      return;
    }

    yield* printLines([
      `agent-effectiveness datasets: ${bundle.datasets.length}`,
      `project: ${bundle.projectName}`,
      `examples: ${pipe(
        bundle.datasets,
        A.reduce(0, (total, dataset) => total + dataset.examples.length)
      )}`,
    ]);
  })
);

const renderPromptBundle: {
  (bundle: AgentEffectivenessPromptBundle, json: boolean): Effect.Effect<void, AgentEffectivenessError>;
  (json: boolean): (bundle: AgentEffectivenessPromptBundle) => Effect.Effect<void, AgentEffectivenessError>;
} = dual(
  2,
  Effect.fn("AgentEffectiveness.renderPromptBundle")(function* (bundle: AgentEffectivenessPromptBundle, json: boolean) {
    if (json) {
      yield* agentEffectivenessPromptBundleToJson(bundle).pipe(Effect.tap(Console.log));
      return;
    }

    yield* printLines([`agent-effectiveness prompts: ${bundle.prompts.length}`, `project: ${bundle.projectName}`]);
  })
);

const renderExperimentBundle: {
  (bundle: AgentEffectivenessExperimentBundle, json: boolean): Effect.Effect<void, AgentEffectivenessError>;
  (json: boolean): (bundle: AgentEffectivenessExperimentBundle) => Effect.Effect<void, AgentEffectivenessError>;
} = dual(
  2,
  Effect.fn("AgentEffectiveness.renderExperimentBundle")(function* (
    bundle: AgentEffectivenessExperimentBundle,
    json: boolean
  ) {
    if (json) {
      yield* agentEffectivenessExperimentBundleToJson(bundle).pipe(Effect.tap(Console.log));
      return;
    }

    yield* printLines([
      `agent-effectiveness experiments: ${bundle.experiments.length}`,
      `project: ${bundle.projectName}`,
    ]);
  })
);

const renderPhoenixSyncResult: {
  (result: AgentEffectivenessPhoenixSyncResult, json: boolean): Effect.Effect<void, AgentEffectivenessError>;
  (json: boolean): (result: AgentEffectivenessPhoenixSyncResult) => Effect.Effect<void, AgentEffectivenessError>;
} = dual(
  2,
  Effect.fn("AgentEffectiveness.renderPhoenixSyncResult")(function* (
    result: AgentEffectivenessPhoenixSyncResult,
    json: boolean
  ) {
    if (json) {
      yield* agentEffectivenessPhoenixSyncResultToJson(result).pipe(Effect.tap(Console.log));
      return;
    }

    yield* printLines([
      `agent-effectiveness phoenix sync: status=${result.status}`,
      `dry-run: ${result.dryRun}`,
      `mutation policy: ${result.mutationPolicy}`,
      `datasets: ${result.datasetCount}`,
      `prompts: ${result.promptCount}`,
      `experiments: ${result.experimentCount}`,
      `annotations: ${result.annotationCount}`,
      `skipped annotations: ${result.skippedAnnotationCount}`,
    ]);
  })
);

class MakeDoctorProgramOptions extends S.Class<MakeDoctorProgramOptions>($I`MakeDoctorProgramOptions`)(
  {
    dataRoot: S.Option(S.String),
    json: S.Boolean,
    noPhoenix: S.Boolean,
    phoenixBaseUrl: S.String,
    target: AiMetricsDeployTarget,
    workerEvalReportPath: S.String,
  },
  $I.annote("MakeDoctorProgramOptions", {
    description: "Options for making an agent effectiveness doctor program.",
  })
) {}

// Every doctor-shaped handler resolves the same data root, builds the same
// `AgentEffectivenessDoctorInput`, and provides the same layers around whatever it derives
// from that input; only the derivation and the rendering tail differ.
const runDoctorInputProgram = Effect.fn("AgentEffectiveness.runDoctorInputProgram")(function* <A, E, R>(
  { dataRoot, noPhoenix, phoenixBaseUrl, target, workerEvalReportPath }: MakeDoctorProgramOptions,
  derive: (input: AgentEffectivenessDoctorInput) => Effect.Effect<A, E, R>
) {
  const resolvedDataRoot = yield* resolveDataRoot(dataRoot, target);
  return yield* pipe(
    AgentEffectivenessDoctorInput.make({
      dataRoot: resolvedDataRoot,
      noPhoenix,
      phoenixBaseUrl,
      target,
      workerEvalReportPath,
    }),
    derive,
    provideAgentEffectivenessLayers(resolvedDataRoot)
  );
});

const deriveAnnotationPlan = flow(AgentEffectivenessAnnotationPlanInput.new, makeAgentEffectivenessAnnotationPlan);

const makeDoctorProgram = Effect.fn("AgentEffectiveness.makeDoctorProgram")(function* (
  options: MakeDoctorProgramOptions
) {
  const report = yield* runDoctorInputProgram(options, makeAgentEffectivenessDoctorReport);
  return yield* renderDoctorReport(report, options.json);
});

const makeAnnotationPlanProgram = Effect.fn("AgentEffectiveness.makeAnnotationPlanProgram")(function* (
  options: MakeDoctorProgramOptions
) {
  const plan = yield* runDoctorInputProgram(options, deriveAnnotationPlan);
  return yield* renderAnnotationPlan(plan, options.json);
});

const makeAnnotationCheckProgram = Effect.fn("AgentEffectiveness.makeAnnotationCheckProgram")(function* (
  options: MakeDoctorProgramOptions
) {
  const plan = yield* runDoctorInputProgram(options, deriveAnnotationPlan);
  const report = makeAgentEffectivenessAnnotationCheckReport(plan);
  yield* renderAnnotationCheck(report, options.json);
  return yield* AgentEffectivenessStatus.is.failed(report.status)
    ? failWithReportedExit("agent-effectiveness annotations check failed.")
    : Effect.void;
});

const makeDatasetBundleProgram = Effect.fn("AgentEffectiveness.makeDatasetBundleProgram")(function* (
  options: MakeDoctorProgramOptions
) {
  const report = yield* runDoctorInputProgram(options, makeAgentEffectivenessDoctorReport);
  return yield* renderDatasetBundle(makeAgentEffectivenessDatasetBundle(report), options.json);
});

const makePromptBundleProgram = Effect.fn("AgentEffectiveness.makePromptBundleProgram")(function* (
  params: MakeDoctorProgramOptions
) {
  return yield* pipe(
    DateTime.now,
    Effect.map(DateTime.formatIso),
    Effect.map(makeAgentEffectivenessPromptBundle),
    Effect.flatMap(renderPromptBundle(params.json))
  );
});

const makeExperimentBundleProgram = Effect.fn("AgentEffectiveness.makeExperimentBundleProgram")(function* (
  options: MakeDoctorProgramOptions
) {
  const report = yield* runDoctorInputProgram(options, makeAgentEffectivenessDoctorReport);
  return yield* pipe(
    report,
    makeAgentEffectivenessDatasetBundle,
    makeAgentEffectivenessExperimentBundle,
    renderExperimentBundle(options.json)
  );
});

class MakePhoenixSyncProgramOptions extends MakeDoctorProgramOptions.extend<MakePhoenixSyncProgramOptions>(
  $I`MakePhoenixSyncProgramOptions`
)(
  {
    confirmPhoenixWrite: S.Option(S.String),
    write: S.Boolean,
  },
  $I.annote("MakePhoenixSyncProgramOptions", {
    description: "Options for the AgentEffectiveness.makePhoenixSyncProgram function",
  })
) {}

const makePhoenixSyncProgram = Effect.fn("AgentEffectiveness.makePhoenixSyncProgram")(function* ({
  confirmPhoenixWrite,
  dataRoot,
  json,
  noPhoenix,
  phoenixBaseUrl,
  target,
  workerEvalReportPath,
  write,
}: MakePhoenixSyncProgramOptions) {
  const resolvedDataRoot = yield* resolveDataRoot(dataRoot, target);
  const makePhoenixSyncInput = pipe(
    confirmPhoenixWrite,
    O.match({
      onNone: () => AgentEffectivenessPhoenixSyncInput.new({ dryRun: !write }),
      onSome: (confirmToken) => AgentEffectivenessPhoenixSyncInput.new({ confirmToken, dryRun: !write }),
    })
  );

  return yield* pipe(
    AgentEffectivenessDoctorInput.make({
      dataRoot: resolvedDataRoot,
      noPhoenix,
      phoenixBaseUrl,
      target,
      workerEvalReportPath,
    }),
    AgentEffectivenessAnnotationPlanInput.new,
    makePhoenixSyncInput,
    syncAgentEffectivenessPhoenix,
    provideAgentEffectivenessPhoenixLayers(resolvedDataRoot, phoenixBaseUrl),
    Effect.tap(renderPhoenixSyncResult(json)),
    Effect.flatMap((result) =>
      AgentEffectivenessStatus.is.failed(result.status)
        ? failWithReportedExit("agent-effectiveness phoenix sync failed.")
        : Effect.void
    )
  );
});

class MakeEvalScoreProgramOptions extends S.Class<MakeEvalScoreProgramOptions>($I`MakeEvalScoreProgramOptions`)(
  {
    dataRoot: S.Option(S.String),
    dir: S.String,
    json: S.Boolean,
    record: S.Boolean,
    taskPath: S.String,
  },
  $I.annote("MakeEvalScoreProgramOptions", {
    description: "Eval scorer flags before the AI metrics data root is resolved.",
  })
) {}

// `evals score` carries no `--target` flag, so the fallback rung is always the
// workstation's XDG store rather than a deploy target's server-owned root.
const makeEvalScoreProgram = Effect.fn("AgentEffectiveness.makeEvalScoreProgram")(function* ({
  dataRoot,
  dir,
  json,
  record,
  taskPath,
}: MakeEvalScoreProgramOptions) {
  return yield* runAgentEffectivenessEvalScoreCommand({
    dataRoot: yield* resolveDataRoot(dataRoot, AiMetricsDeployTarget.Enum.local),
    dir,
    json,
    record,
    taskPath,
  });
});

const doctorCommand = Command.make(
  "doctor",
  {
    dataRoot: dataRootFlag,
    json: jsonFlag,
    noPhoenix: noPhoenixFlag,
    phoenixBaseUrl: phoenixBaseUrlFlag,
    target: targetFlag,
    workerEvalReportPath: workerEvalReportFlag,
  },
  flow(makeDoctorProgram, runAgentEffectivenessProgram)
).pipe(Command.withDescription("Render the local no-mutation agent-effectiveness trust gate"));

const annotationsPlanCommand = Command.make(
  "plan",
  {
    dataRoot: dataRootFlag,
    json: jsonFlag,
    noPhoenix: noPhoenixFlag,
    phoenixBaseUrl: phoenixBaseUrlFlag,
    target: targetFlag,
    workerEvalReportPath: workerEvalReportFlag,
  },
  flow(makeAnnotationPlanProgram, runAgentEffectivenessProgram)
).pipe(Command.withDescription("Render a sanitized local-only Phoenix annotation plan"));

const annotationsCheckCommand = Command.make(
  "check",
  {
    dataRoot: dataRootFlag,
    json: jsonFlag,
    noPhoenix: noPhoenixFlag,
    phoenixBaseUrl: phoenixBaseUrlFlag,
    target: targetFlag,
    workerEvalReportPath: workerEvalReportFlag,
  },
  flow(makeAnnotationCheckProgram, runAgentEffectivenessProgram)
).pipe(Command.withDescription("Check a local annotation plan for schema and privacy safety"));

const annotationsCommand = Command.make("annotations", {}, () =>
  printLines(["Agent-effectiveness annotation commands:", "- plan", "- check"])
).pipe(
  Command.withDescription("Plan and check local-only agent-effectiveness annotations"),
  Command.withSubcommands([annotationsPlanCommand, annotationsCheckCommand])
);

const datasetsBundleCommand = Command.make(
  "bundle",
  {
    dataRoot: dataRootFlag,
    json: jsonFlag,
    noPhoenix: noPhoenixFlag,
    phoenixBaseUrl: phoenixBaseUrlFlag,
    target: targetFlag,
    workerEvalReportPath: workerEvalReportFlag,
  },
  flow(makeDatasetBundleProgram, runAgentEffectivenessProgram)
).pipe(Command.withDescription("Render the sanitized Phoenix dataset bundle"));

const datasetsCommand = Command.make("datasets", {}, () =>
  printLines(["Agent-effectiveness dataset commands:", "- bundle"])
).pipe(
  Command.withDescription("Build repo-owned Phoenix dataset specs"),
  Command.withSubcommands([datasetsBundleCommand])
);

const promptsBundleCommand = Command.make(
  "bundle",
  {
    dataRoot: dataRootFlag,
    json: jsonFlag,
    noPhoenix: noPhoenixFlag,
    phoenixBaseUrl: phoenixBaseUrlFlag,
    target: targetFlag,
    workerEvalReportPath: workerEvalReportFlag,
  },
  flow(makePromptBundleProgram, runAgentEffectivenessProgram)
).pipe(Command.withDescription("Render the repo-owned Phoenix prompt bundle"));

const promptsCommand = Command.make("prompts", {}, () =>
  printLines(["Agent-effectiveness prompt commands:", "- bundle"])
).pipe(
  Command.withDescription("Build repo-owned Phoenix prompt specs"),
  Command.withSubcommands([promptsBundleCommand])
);

const experimentsBundleCommand = Command.make(
  "bundle",
  {
    dataRoot: dataRootFlag,
    json: jsonFlag,
    noPhoenix: noPhoenixFlag,
    phoenixBaseUrl: phoenixBaseUrlFlag,
    target: targetFlag,
    workerEvalReportPath: workerEvalReportFlag,
  },
  flow(makeExperimentBundleProgram, runAgentEffectivenessProgram)
).pipe(Command.withDescription("Render deterministic Phoenix experiment specs"));

const experimentsCommand = Command.make("experiments", {}, () =>
  printLines(["Agent-effectiveness experiment commands:", "- bundle"])
).pipe(
  Command.withDescription("Build deterministic Phoenix experiment specs"),
  Command.withSubcommands([experimentsBundleCommand])
);

const phoenixSyncCommand = Command.make(
  "sync",
  {
    confirmPhoenixWrite: confirmPhoenixWriteFlag,
    dataRoot: dataRootFlag,
    json: jsonFlag,
    noPhoenix: noPhoenixFlag,
    phoenixBaseUrl: phoenixBaseUrlFlag,
    target: targetFlag,
    workerEvalReportPath: workerEvalReportFlag,
    write: writeFlag,
  },
  flow(makePhoenixSyncProgram, runAgentEffectivenessProgram)
).pipe(Command.withDescription("Dry-run or confirmed-write agent-effectiveness specs to Phoenix"));

const phoenixCommand = Command.make("phoenix", {}, () =>
  printLines(["Agent-effectiveness Phoenix commands:", "- sync"])
).pipe(Command.withDescription("Guarded Phoenix sync workflow"), Command.withSubcommands([phoenixSyncCommand]));

const evalsScoreCommand = Command.make(
  "score",
  {
    dataRoot: dataRootFlag,
    dir: evalFixtureDirFlag,
    json: jsonFlag,
    record: evalRecordFlag,
    taskPath: evalTaskManifestFlag,
  },
  flow(makeEvalScoreProgram, runAgentEffectivenessProgram)
).pipe(Command.withDescription("Score a SkillOpt eval fixture with completion and repo-law checks"));

const evalsCommand = Command.make("evals", {}, () =>
  printLines(["Agent-effectiveness eval commands:", "- score"])
).pipe(Command.withDescription("Run SkillOpt eval scorer commands"), Command.withSubcommands([evalsScoreCommand]));

/**
 * Root of the `agent-effectiveness` command tree: doctor, annotations, bundles, and evals.
 *
 * **Details**
 *
 * Invoked with no subcommand it prints the available subcommands rather than
 * doing work. Subcommands that read the metrics store take `--data-root`, which
 * falls back to `BEEP_AI_METRICS_DATA_ROOT` and then to the XDG state store, so
 * they address the same store the collector writes.
 *
 * **Example** (Mounting the command tree in a CLI entrypoint)
 *
 * ```ts
 * import { agentEffectivenessCommand } from "@beep/repo-cli/commands/AgentEffectiveness/index"
 * import { Effect } from "effect"
 * import { Command } from "effect/unstable/cli"
 *
 * const run = Command.run(agentEffectivenessCommand, { version: "0.0.0" })
 *
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const agentEffectivenessCommand = Command.make("agent-effectiveness", {}, () =>
  printLines([
    "Agent-effectiveness commands:",
    "- doctor",
    "- annotations plan",
    "- annotations check",
    "- datasets bundle",
    "- prompts bundle",
    "- experiments bundle",
    "- evals score",
    "- phoenix sync",
  ])
).pipe(
  Command.withDescription("Inspect and sync AI-agent effectiveness evidence"),
  Command.withSubcommands([
    doctorCommand,
    annotationsCommand,
    datasetsCommand,
    promptsCommand,
    experimentsCommand,
    evalsCommand,
    phoenixCommand,
  ])
);
