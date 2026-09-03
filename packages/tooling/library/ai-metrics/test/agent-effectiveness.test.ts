import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import {
  Phoenix,
  PhoenixAnnotationWriteResult,
  PhoenixDatasetAppendResult,
  PhoenixDatasetCreateResult,
  PhoenixDatasetExamplesResult,
  PhoenixDatasetInfoResult,
  PhoenixDoctorResult,
  PhoenixExperimentInfoResult,
  PhoenixPromptReadResult,
  PhoenixPromptWriteResult,
} from "@beep/phoenix";
import {
  AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION,
  AgentEffectivenessAnnotationPlan,
  AgentEffectivenessAnnotationPlanInput,
  AgentEffectivenessDoctorInput,
  AgentEffectivenessPhoenixSyncInput,
  AgentEffectivenessPlannedAnnotation,
  AgentEffectivenessStatus,
  agentEffectivenessAnnotationPlanToJson,
  agentEffectivenessDatasetBundleToJson,
  ensureAiMetricsDerivedStorage,
  makeAgentEffectivenessAnnotationCheckReport,
  makeAgentEffectivenessAnnotationPlan,
  makeAgentEffectivenessDatasetBundle,
  makeAgentEffectivenessDoctorReport,
  makeAgentEffectivenessExperimentBundle,
  makeAgentEffectivenessPromptBundle,
  syncAgentEffectivenessPhoenix,
} from "@beep/repo-ai-metrics";
import { privacySafeSystemTempRoot } from "@beep/test-utils";
import { A, O, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, pipe } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import type { PhoenixSdkShape } from "@beep/phoenix";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory({
        directory: privacySafeSystemTempRoot(),
        prefix: "beep-agent-effectiveness-",
      });
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  );

const writeText = Effect.fn("AgentEffectivenessTest.writeText")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, content);
});

const seedScorecardWithCoverageGaps = Effect.fn("AgentEffectivenessTest.seedScorecardWithCoverageGaps")(function* (
  coverageGapsJson: string
) {
  const duckdb = yield* DuckDb;
  yield* ensureAiMetricsDerivedStorage;
  yield* duckdb.run(
    `INSERT OR REPLACE INTO ai_metrics_scorecards (
      scorecard_id,
      config_snapshot_id,
      window_start_epoch_ms,
      window_end_epoch_ms,
      total_score,
      outcome_score,
      flow_score,
      cost_score,
      task_count,
      label_count,
      benchmark_run_count,
      completion_ready,
      coverage_gaps_json
    ) VALUES (
      $scorecardId,
      $configSnapshotId,
      $windowStartEpochMillis,
      $windowEndEpochMillis,
      $totalScore,
      $outcomeScore,
      $flowScore,
      $costScore,
      $taskCount,
      $labelCount,
      $benchmarkRunCount,
      $completionReady,
      $coverageGapsJson
    )`,
    {
      benchmarkRunCount: 0,
      completionReady: false,
      configSnapshotId: "config-snapshot-test",
      costScore: 0,
      coverageGapsJson,
      flowScore: 0,
      labelCount: 0,
      outcomeScore: 0,
      scorecardId: "scorecard-test",
      taskCount: 1,
      totalScore: 0,
      windowEndEpochMillis: 2,
      windowStartEpochMillis: 1,
    }
  );
});

const seedOutcomeLabel = Effect.fn("AgentEffectivenessTest.seedOutcomeLabel")(function* ({
  labelId,
  labeledAtEpochMillis,
}: {
  readonly labelId: string;
  readonly labeledAtEpochMillis: number;
}) {
  const duckdb = yield* DuckDb;
  yield* ensureAiMetricsDerivedStorage;
  yield* duckdb.run(
    `INSERT OR REPLACE INTO ai_metrics_outcome_labels (
      label_id,
      agent_task_id,
      rating,
      passed,
      quality_gate,
      intervention_count,
      follow_up_fix,
      note,
      labeled_at_epoch_ms
    ) VALUES (
      $labelId,
      $agentTaskId,
      $rating,
      $passed,
      $qualityGate,
      $interventionCount,
      $followUpFix,
      $note,
      $labeledAtEpochMillis
    )`,
    {
      agentTaskId: "agent-task-relabeled",
      followUpFix: false,
      interventionCount: 0,
      labelId,
      labeledAtEpochMillis,
      note: null,
      passed: true,
      qualityGate: "passed",
      rating: 1,
    }
  );
});

const workerReportJson = `{
  "cleanup": { "deleteStatus": "completed", "stopStatus": "completed" },
  "otlp": { "status": "exported" },
  "workerEval": {
    "summary": { "completed": 2, "failed": 0, "selectedPackets": 2, "timedOut": 0 },
    "policyViolations": [{ "code": "missing-example" }]
  }
}`;

const workerReportJsonWithMultipleViolations = `{
  "cleanup": { "deleteStatus": "completed", "stopStatus": "completed" },
  "otlp": { "status": "exported" },
  "workerEval": {
    "summary": { "completed": 2, "failed": 0, "selectedPackets": 2, "timedOut": 0 },
    "policyViolations": [{ "code": "missing-example" }, { "code": "missing-since" }, { "code": "!!!" }]
  }
}`;

const unsafeWorkerReportJson = `{
  "cleanup": { "deleteStatus": "completed", "stopStatus": "completed" },
  "otlp": { "status": "exported" },
  "workerEval": {
    "summary": { "completed": 2, "failed": 0, "selectedPackets": 2, "timedOut": 0 },
    "policyViolations": [{ "code": "API_KEY=oops" }]
  }
}`;

const runtimeLayer = (duckDbPath: string) =>
  Layer.mergeAll(
    NodeServices.layer,
    FetchHttpClient.layer,
    DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))
  );

type PhoenixAggregateOutcome = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>;

const phoenixInventoryHttpLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.gen(function* () {
      const url = HttpClientRequest.toUrl(request).pipe(
        O.map((value) => value.toString()),
        O.getOrElse(() => request.url)
      );
      const response =
        request.method === "POST" && url === "https://phoenix.test/graphql"
          ? Response.json({
              data: {
                datasetCount: 0,
                evaluatorCount: 0,
                projectCount: 1,
                projects: {
                  edges: [
                    {
                      node: {
                        hasTraces: true,
                        name: "beep-jsdoc-worker-eval",
                        recordCount: 12,
                        sessionAnnotationNames: [],
                        spanAnnotationNames: ["agent.loop.status"],
                        traceAnnotationsNames: ["agent.outcome"],
                        traceCount: 3,
                      },
                    },
                  ],
                },
                promptCount: 0,
                serverStatus: { insufficientStorage: false },
              },
            })
          : Response.json(
              { ok: true },
              {
                headers: {
                  "x-phoenix-server-version": "9.9.9-test",
                },
              }
            );

      return HttpClientResponse.fromWeb(request, response);
    })
  )
);

const phoenixRuntimeLayer = (duckDbPath: string) =>
  Layer.mergeAll(
    NodeServices.layer,
    phoenixInventoryHttpLayer,
    DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))
  );

// Inventory answers; the per-project aggregate query does not. This is the shape a
// large store actually presents -- identity is cheap, aggregates over the spans
// table are not -- and the doctor must still report Phoenix as reachable with the
// counts marked unmeasured rather than collapsing the whole section. The aggregate
// outcome is supplied per test so each can pick which way that query fails --
// rejected, undecodable, or unreachable -- because the section's message has to
// name the mode it actually hit rather than blaming all three on a timeout.
const phoenixAggregatesUnavailableHttpLayer = (aggregateOutcome: PhoenixAggregateOutcome) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.gen(function* () {
        const url = HttpClientRequest.toUrl(request).pipe(
          O.map((value) => value.toString()),
          O.getOrElse(() => request.url)
        );

        if (request.method !== "POST" || url !== "https://phoenix.test/graphql") {
          return HttpClientResponse.fromWeb(
            request,
            Response.json({ ok: true }, { headers: { "x-phoenix-server-version": "9.9.9-test" } })
          );
        }

        const body = yield* pipe(
          request.body._tag === "Uint8Array"
            ? Effect.succeed(new TextDecoder().decode(request.body.body))
            : Effect.succeed(""),
          Effect.orElseSucceed(() => "")
        );

        if (Str.includes("AgentEffectivenessPhoenixProjectStats")(body)) {
          return yield* aggregateOutcome(request);
        }

        return HttpClientResponse.fromWeb(
          request,
          Response.json({
            data: {
              datasetCount: 0,
              evaluatorCount: 0,
              projectCount: 1,
              projects: {
                edges: [
                  {
                    node: {
                      name: "beep-jsdoc-worker-eval",
                      sessionAnnotationNames: [],
                      spanAnnotationNames: ["agent.loop.status"],
                      traceAnnotationsNames: ["agent.outcome"],
                    },
                  },
                ],
              },
              promptCount: 0,
              serverStatus: { insufficientStorage: false },
            },
          })
        );
      })
    )
  );

// Phoenix rejects the aggregate query outright.
const phoenixAggregateRejected: PhoenixAggregateOutcome = (request) =>
  Effect.succeed(
    HttpClientResponse.fromWeb(
      request,
      Response.json({ errors: [{ message: "query exceeded row budget" }] }, { status: 500 })
    )
  );

// Phoenix answers 200 with a body the aggregate schema cannot decode: the node is
// missing every count field the query asked for.
const phoenixAggregateUndecodable: PhoenixAggregateOutcome = (request) =>
  Effect.succeed(
    HttpClientResponse.fromWeb(
      request,
      Response.json({ data: { projects: { edges: [{ node: { name: "beep-jsdoc-worker-eval" } }] } } })
    )
  );

// The aggregate request never reaches Phoenix at all.
const phoenixAggregateUnreachable: PhoenixAggregateOutcome = (request) =>
  Effect.fail(
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ description: "connection refused", request }),
    })
  );

const phoenixAggregatesUnavailableRuntimeLayer = (duckDbPath: string, aggregateOutcome: PhoenixAggregateOutcome) =>
  Layer.mergeAll(
    NodeServices.layer,
    phoenixAggregatesUnavailableHttpLayer(aggregateOutcome),
    DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))
  );

const phoenixWriteSdk = (
  calls: {
    readonly annotations: Array<string>;
    readonly appends: Array<string>;
    readonly datasets: Array<string>;
    readonly experiments: Array<string>;
    readonly prompts: Array<string>;
  },
  options: {
    readonly datasetLookupFailure?: Error;
    readonly existingDatasetNames?: ReadonlyArray<string>;
  } = {}
): PhoenixSdkShape => ({
  addAnnotation: (input) => {
    calls.annotations.push(input.name);
    return Promise.resolve(
      PhoenixAnnotationWriteResult.make({
        annotationId: `annotation:${input.name}`,
        name: input.name,
        targetId: input.targetId,
        targetKind: input.targetKind,
      })
    );
  },
  appendDatasetExamples: (input) => {
    calls.appends.push(input.dataset.value);
    return Promise.resolve(
      PhoenixDatasetAppendResult.make({
        datasetId: `dataset:${input.dataset.value}`,
        versionId: "version-id",
      })
    );
  },
  createDataset: (input) => {
    calls.datasets.push(input.name);
    return Promise.resolve(PhoenixDatasetCreateResult.make({ datasetId: `dataset:${input.name}` }));
  },
  createExperiment: (input) => {
    const experimentId = input.experimentName ?? `experiment:${input.datasetId}`;
    calls.experiments.push(experimentId);
    return Promise.resolve(
      PhoenixExperimentInfoResult.make({
        datasetId: input.datasetId,
        datasetVersionId: input.datasetVersionId ?? "latest",
        exampleCount: 1,
        experimentId,
        failedRunCount: 0,
        metadata: input.experimentMetadata,
        missingRunCount: 0,
        projectName: null,
        repetitions: input.repetitions,
        successfulRunCount: 1,
      })
    );
  },
  createPrompt: (input) => {
    calls.prompts.push(input.name);
    return Promise.resolve(
      PhoenixPromptWriteResult.make({
        name: input.name,
        promptVersionId: `prompt-version:${input.name}`,
      })
    );
  },
  doctor: () =>
    Promise.resolve(
      PhoenixDoctorResult.make({
        baseUrl: "https://phoenix.test",
        message: "Phoenix is reachable.",
        status: "passed",
        version: "1.2.3",
      })
    ),
  getDatasetExamples: () =>
    Promise.resolve(
      PhoenixDatasetExamplesResult.make({
        examples: [],
        versionId: "version-id",
      })
    ),
  getDatasetInfo: (selector) => {
    const forcedFailure = O.fromUndefinedOr(options.datasetLookupFailure);
    if (O.isSome(forcedFailure)) {
      return Promise.reject(forcedFailure.value);
    }

    const existing = pipe(
      options.existingDatasetNames ?? [],
      A.findFirst((name) => name === selector.value)
    );
    if (O.isNone(existing)) {
      return Promise.reject(new Error(`Dataset with name ${selector.value} not found`));
    }

    return Promise.resolve(
      PhoenixDatasetInfoResult.make({
        datasetId: `dataset:${selector.value}`,
        description: null,
        metadata: {},
        name: selector.value,
      })
    );
  },
  getExperimentInfo: (experimentId) =>
    Promise.resolve(
      PhoenixExperimentInfoResult.make({
        datasetId: "dataset-id",
        datasetVersionId: "version-id",
        exampleCount: 1,
        experimentId,
        failedRunCount: 0,
        missingRunCount: 0,
        repetitions: 1,
        successfulRunCount: 1,
      })
    ),
  getPrompt: () =>
    Promise.resolve(
      PhoenixPromptReadResult.make({
        exists: true,
        promptVersionId: "prompt-version-id",
      })
    ),
});

describe("@beep/repo-ai-metrics agent-effectiveness", () => {
  it.effect("reports unavailable evidence as data instead of failing", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const report = yield* makeAgentEffectivenessDoctorReport(
            AgentEffectivenessDoctorInput.make({
              dataRoot,
              noPhoenix: true,
              workerEvalReportPath: path.join(tmpDir, "missing-worker-report.json"),
            })
          );

          expect(report.phoenix.status).toBe(AgentEffectivenessStatus.Enum.unavailable);
          expect(report.aiMetrics.status).toBe(AgentEffectivenessStatus.Enum.unavailable);
          expect(report.jsdocWorkerEval.status).toBe(AgentEffectivenessStatus.Enum.unavailable);
          expect(report.summary.status).toBe(AgentEffectivenessStatus.Enum.warning);
        }).pipe(provideScopedLayer(runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb"))));
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("decodes the live Phoenix trace annotation field shape", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const report = yield* makeAgentEffectivenessDoctorReport(
            AgentEffectivenessDoctorInput.make({
              dataRoot,
              noPhoenix: false,
              phoenixBaseUrl: "https://phoenix.test",
              workerEvalReportPath: path.join(tmpDir, "missing-worker-report.json"),
            })
          );

          expect(report.phoenix.status).toBe(AgentEffectivenessStatus.Enum.passed);
          expect(report.phoenix.projectCount).toBe(1);
          expect(O.getOrUndefined(report.phoenix.version)).toBe("9.9.9-test");
          expect(report.phoenix.projects[0]?.traceAnnotationNames).toEqual(["agent.outcome"]);
        }).pipe(provideScopedLayer(phoenixRuntimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb"))));
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("keeps Phoenix readable when the per-project aggregates do not return", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const report = yield* makeAgentEffectivenessDoctorReport(
            AgentEffectivenessDoctorInput.make({
              dataRoot,
              noPhoenix: false,
              phoenixBaseUrl: "https://phoenix.test",
              workerEvalReportPath: path.join(tmpDir, "missing-worker-report.json"),
            })
          );

          // Reachable, not `unavailable`: one slow aggregate must not take the section down.
          expect(report.phoenix.projectCount).toBe(1);
          expect(O.getOrUndefined(report.phoenix.version)).toBe("9.9.9-test");
          expect(report.phoenix.projects[0]?.name).toBe("beep-jsdoc-worker-eval");
          // Cheap identity fields still populate.
          expect(report.phoenix.projects[0]?.traceAnnotationNames).toEqual(["agent.outcome"]);
          // Aggregates report as not-measured rather than as zero or false, so the
          // report cannot be misread as "Phoenix has no traces".
          expect(
            pipe(
              A.head(report.phoenix.projects),
              O.flatMap((project) => project.hasTraces),
              O.isNone
            )
          ).toBe(true);
          expect(
            pipe(
              A.head(report.phoenix.projects),
              O.flatMap((project) => project.recordCount),
              O.isNone
            )
          ).toBe(true);
          expect(
            pipe(
              A.head(report.phoenix.projects),
              O.flatMap((project) => project.traceCount),
              O.isNone
            )
          ).toBe(true);
          expect(Str.includes("unmeasured")(report.phoenix.message)).toBe(true);
          // The message must name the mode it actually hit. Reporting a rejected
          // query as a timeout sends an operator after store size instead of the
          // server's own refusal.
          expect(Str.includes("HTTP 500")(report.phoenix.message)).toBe(true);
          expect(Str.includes("budget")(report.phoenix.message)).toBe(false);
        }).pipe(
          provideScopedLayer(
            phoenixAggregatesUnavailableRuntimeLayer(
              path.join(tmpDir, "metrics/derived/ai-metrics.duckdb"),
              phoenixAggregateRejected
            )
          )
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("distinguishes an undecodable aggregate response from a rejected one", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const report = yield* makeAgentEffectivenessDoctorReport(
            AgentEffectivenessDoctorInput.make({
              dataRoot,
              noPhoenix: false,
              phoenixBaseUrl: "https://phoenix.test",
              workerEvalReportPath: path.join(tmpDir, "missing-worker-report.json"),
            })
          );

          expect(report.phoenix.projectCount).toBe(1);
          expect(
            pipe(
              A.head(report.phoenix.projects),
              O.flatMap((project) => project.traceCount),
              O.isNone
            )
          ).toBe(true);
          expect(Str.includes("could not be decoded")(report.phoenix.message)).toBe(true);
          // A 200 carrying an unreadable body is not a rejection and not a timeout.
          expect(Str.includes("HTTP")(report.phoenix.message)).toBe(false);
          expect(Str.includes("budget")(report.phoenix.message)).toBe(false);
        }).pipe(
          provideScopedLayer(
            phoenixAggregatesUnavailableRuntimeLayer(
              path.join(tmpDir, "metrics/derived/ai-metrics.duckdb"),
              phoenixAggregateUndecodable
            )
          )
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("reports an aggregate query that never reached Phoenix as unreachable", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const report = yield* makeAgentEffectivenessDoctorReport(
            AgentEffectivenessDoctorInput.make({
              dataRoot,
              noPhoenix: false,
              phoenixBaseUrl: "https://phoenix.test",
              workerEvalReportPath: path.join(tmpDir, "missing-worker-report.json"),
            })
          );

          // The inventory still answered, so the section stays readable rather
          // than collapsing to `unavailable`.
          expect(report.phoenix.projectCount).toBe(1);
          expect(
            pipe(
              A.head(report.phoenix.projects),
              O.flatMap((project) => project.traceCount),
              O.isNone
            )
          ).toBe(true);
          expect(Str.includes("could not be reached")(report.phoenix.message)).toBe(true);
          expect(Str.includes("budget")(report.phoenix.message)).toBe(false);
          expect(Str.includes("HTTP")(report.phoenix.message)).toBe(false);
        }).pipe(
          provideScopedLayer(
            phoenixAggregatesUnavailableRuntimeLayer(
              path.join(tmpDir, "metrics/derived/ai-metrics.duckdb"),
              phoenixAggregateUnreachable
            )
          )
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("resolves the default worker-eval manifest to the latest raw report", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const initiativeRoot = path.join(tmpDir, "jsdoc-worker-eval");
          const manifestPath = path.join(initiativeRoot, "ops", "manifest.json");
          const rawReportPath = path.join(initiativeRoot, "history", "outputs", "latest-worker-eval.json");
          yield* writeText(rawReportPath, workerReportJson);
          yield* writeText(
            manifestPath,
            `{
              "evidence": [
                { "raw": "history/outputs/older-worker-eval.json" },
                { "raw": "history/outputs/latest-worker-eval.json" }
              ]
            }`
          );

          const report = yield* makeAgentEffectivenessDoctorReport(
            AgentEffectivenessDoctorInput.make({
              dataRoot,
              noPhoenix: true,
              workerEvalReportPath: manifestPath,
            })
          );

          expect(report.jsdocWorkerEval.reportPath).toBe(rawReportPath);
          expect(report.jsdocWorkerEval.completedPackets).toBe(2);
          expect(report.jsdocWorkerEval.policyViolationCodes).toEqual(["missing-example"]);
        }).pipe(provideScopedLayer(runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb"))));
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("plans sanitized worker annotations without draft JSDoc bodies", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const workerReportPath = path.join(tmpDir, "worker-eval.json");
          yield* writeText(workerReportPath, workerReportJson);

          const plan = yield* makeAgentEffectivenessAnnotationPlan(
            AgentEffectivenessAnnotationPlanInput.make({
              doctor: AgentEffectivenessDoctorInput.make({
                dataRoot,
                noPhoenix: true,
                workerEvalReportPath: workerReportPath,
              }),
            })
          );
          const json = yield* agentEffectivenessAnnotationPlanToJson(plan);
          const check = makeAgentEffectivenessAnnotationCheckReport(plan);

          expect(json).not.toContain("draftJsDoc");
          expect(json).not.toContain("@example");
          expect(check.status).toBe(AgentEffectivenessStatus.Enum.passed);
          expect(
            pipe(
              plan.annotations,
              A.some((annotation) => annotation.name === "worker.policy_violation")
            )
          ).toBe(true);
        }).pipe(provideScopedLayer(runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb"))));
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("disambiguates multi-entry scorecard and worker annotation ids", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const workerReportPath = path.join(tmpDir, "worker-eval.json");
          yield* writeText(workerReportPath, workerReportJsonWithMultipleViolations);
          yield* writeText(path.join(dataRoot, "derived", ".keep"), "");
          yield* seedScorecardWithCoverageGaps(`["no_labels","no_benchmark_runs"]`);

          const plan = yield* makeAgentEffectivenessAnnotationPlan(
            AgentEffectivenessAnnotationPlanInput.make({
              doctor: AgentEffectivenessDoctorInput.make({
                dataRoot,
                noPhoenix: true,
                workerEvalReportPath: workerReportPath,
              }),
            })
          );
          const annotationIds = pipe(
            plan.annotations,
            A.map((annotation) => annotation.annotationId)
          );
          const gapIds = pipe(
            plan.annotations,
            A.filter((annotation) => annotation.name === "scorecard.gap"),
            A.map((annotation) => annotation.annotationId)
          );
          const workerViolationIds = pipe(
            plan.annotations,
            A.filter((annotation) => annotation.name === "worker.policy_violation"),
            A.map((annotation) => annotation.annotationId)
          );

          expect(A.length(annotationIds)).toBe(A.length(A.dedupe(annotationIds)));
          expect(gapIds).toEqual([
            "ai-metrics:scorecard:scorecard-test:scorecard.gap:no_labels",
            "ai-metrics:scorecard:scorecard-test:scorecard.gap:no_benchmark_runs",
          ]);
          expect(workerViolationIds).toEqual([
            "jsdoc-worker-eval:worker-report:jsdoc-worker-eval-latest:worker.policy_violation:missing-example",
            "jsdoc-worker-eval:worker-report:jsdoc-worker-eval-latest:worker.policy_violation:missing-since",
            "jsdoc-worker-eval:worker-report:jsdoc-worker-eval-latest:worker.policy_violation:value",
          ]);
        }).pipe(provideScopedLayer(runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb"))));
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("disambiguates relabeled task annotations by label id", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          yield* writeText(path.join(dataRoot, "derived", ".keep"), "");
          yield* seedOutcomeLabel({
            labeledAtEpochMillis: 1,
            labelId: "label-first",
          });
          yield* seedOutcomeLabel({
            labeledAtEpochMillis: 2,
            labelId: "label-second",
          });

          const plan = yield* makeAgentEffectivenessAnnotationPlan(
            AgentEffectivenessAnnotationPlanInput.make({
              doctor: AgentEffectivenessDoctorInput.make({
                dataRoot,
                noPhoenix: true,
                workerEvalReportPath: path.join(tmpDir, "missing-worker-report.json"),
              }),
            })
          );
          const labelIds = pipe(
            plan.annotations,
            A.filter((annotation) => annotation.targetRef === "agent-task-relabeled"),
            A.map((annotation) => annotation.annotationId)
          );
          const check = makeAgentEffectivenessAnnotationCheckReport(plan);

          expect(check.status).toBe(AgentEffectivenessStatus.Enum.passed);
          expect(A.length(labelIds)).toBe(8);
          expect(A.length(labelIds)).toBe(A.length(A.dedupe(labelIds)));
          expect(labelIds).toEqual([
            "ai-metrics:agent-task:agent-task-relabeled:agent.outcome.passed:label-second",
            "ai-metrics:agent-task:agent-task-relabeled:agent.outcome.rating:label-second",
            "ai-metrics:agent-task:agent-task-relabeled:agent.interventions:label-second",
            "ai-metrics:agent-task:agent-task-relabeled:agent.follow_up_fix:label-second",
            "ai-metrics:agent-task:agent-task-relabeled:agent.outcome.passed:label-first",
            "ai-metrics:agent-task:agent-task-relabeled:agent.outcome.rating:label-first",
            "ai-metrics:agent-task:agent-task-relabeled:agent.interventions:label-first",
            "ai-metrics:agent-task:agent-task-relabeled:agent.follow_up_fix:label-first",
          ]);
        }).pipe(provideScopedLayer(runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb"))));
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("builds sanitized Phoenix dataset, prompt, and experiment bundles", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const workerReportPath = path.join(tmpDir, "worker-eval.json");
          yield* writeText(workerReportPath, workerReportJson);

          const plan = yield* makeAgentEffectivenessAnnotationPlan(
            AgentEffectivenessAnnotationPlanInput.make({
              doctor: AgentEffectivenessDoctorInput.make({
                dataRoot,
                noPhoenix: true,
                workerEvalReportPath: workerReportPath,
              }),
            })
          );
          const datasetBundle = makeAgentEffectivenessDatasetBundle(plan.doctor);
          const promptBundle = makeAgentEffectivenessPromptBundle(plan.generatedAt);
          const experimentBundle = makeAgentEffectivenessExperimentBundle(datasetBundle);
          const datasetJson = yield* agentEffectivenessDatasetBundleToJson(datasetBundle);

          expect(
            pipe(
              datasetBundle.datasets,
              A.map((dataset) => dataset.kind)
            )
          ).toEqual([
            "agent-loop-health",
            "agent-outcomes",
            "agent-config-snapshots",
            "source-coverage",
            "jsdoc-worker-model-suitability",
          ]);
          expect(promptBundle.prompts.length).toBe(2);
          expect(experimentBundle.experiments.length).toBe(datasetBundle.datasets.length);
          expect(datasetJson).not.toContain("draftJsDoc");
          expect(datasetJson).not.toContain("@example");
        }).pipe(provideScopedLayer(runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb"))));
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("keeps Phoenix sync dry-run by default and writes only with confirmation", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        const calls = {
          annotations: A.empty<string>(),
          appends: A.empty<string>(),
          datasets: A.empty<string>(),
          experiments: A.empty<string>(),
          prompts: A.empty<string>(),
        };
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const workerReportPath = path.join(tmpDir, "worker-eval.json");
          const annotationPlan = AgentEffectivenessAnnotationPlanInput.make({
            doctor: AgentEffectivenessDoctorInput.make({
              dataRoot,
              noPhoenix: true,
              workerEvalReportPath: workerReportPath,
            }),
          });
          yield* writeText(workerReportPath, workerReportJson);

          const dryRun = yield* syncAgentEffectivenessPhoenix(
            AgentEffectivenessPhoenixSyncInput.make({ annotationPlan })
          );
          const blocked = yield* syncAgentEffectivenessPhoenix(
            AgentEffectivenessPhoenixSyncInput.make({
              annotationPlan,
              dryRun: false,
            })
          );
          const written = yield* syncAgentEffectivenessPhoenix(
            AgentEffectivenessPhoenixSyncInput.make({
              annotationPlan,
              confirmToken: AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION,
              dryRun: false,
            })
          );

          expect(dryRun.dryRun).toBe(true);
          expect(dryRun.datasetCount).toBe(5);
          expect(dryRun.promptCount).toBe(2);
          expect(dryRun.experimentCount).toBe(5);
          expect(dryRun.writtenDatasetIds).toEqual([]);
          expect(blocked.status).toBe(AgentEffectivenessStatus.Enum.failed);
          expect(written.status).toBe(AgentEffectivenessStatus.Enum.passed);
          expect(written.writtenDatasetIds.length).toBe(5);
          expect(written.writtenPromptVersionIds.length).toBe(2);
          expect(written.writtenExperimentIds.length).toBe(5);
          expect(written.annotationCount).toBe(0);
          expect(written.skippedAnnotationCount).toBeGreaterThan(0);
          expect(calls.datasets.length).toBe(5);
          expect(calls.appends.length).toBe(0);
          expect(calls.prompts.length).toBe(2);
          expect(calls.experiments.length).toBe(5);
          expect(calls.annotations.length).toBe(0);
        }).pipe(
          provideScopedLayer(
            Layer.mergeAll(
              runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb")),
              Phoenix.makeLayerWithSdk(phoenixWriteSdk(calls))
            )
          )
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("appends examples when Phoenix datasets already exist", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        const calls = {
          annotations: A.empty<string>(),
          appends: A.empty<string>(),
          datasets: A.empty<string>(),
          experiments: A.empty<string>(),
          prompts: A.empty<string>(),
        };
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const workerReportPath = path.join(tmpDir, "worker-eval.json");
          const annotationPlan = AgentEffectivenessAnnotationPlanInput.make({
            doctor: AgentEffectivenessDoctorInput.make({
              dataRoot,
              noPhoenix: true,
              workerEvalReportPath: workerReportPath,
            }),
          });
          yield* writeText(workerReportPath, workerReportJson);

          const result = yield* syncAgentEffectivenessPhoenix(
            AgentEffectivenessPhoenixSyncInput.make({
              annotationPlan,
              confirmToken: AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION,
              dryRun: false,
            })
          );

          expect(result.status).toBe(AgentEffectivenessStatus.Enum.passed);
          expect(result.writtenDatasetIds.length).toBe(5);
          expect(result.writtenExperimentIds).toEqual([]);
          expect(calls.datasets).toEqual([]);
          expect(calls.appends).toEqual([
            "agent-loop-health-v1",
            "agent-outcomes-v1",
            "agent-config-snapshots-v1",
            "source-coverage-v1",
            "jsdoc-worker-model-suitability-v1",
          ]);
          expect(calls.prompts.length).toBe(2);
          expect(calls.experiments).toEqual([]);
          expect(calls.annotations).toEqual([]);
        }).pipe(
          provideScopedLayer(
            Layer.mergeAll(
              runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb")),
              Phoenix.makeLayerWithSdk(
                phoenixWriteSdk(calls, {
                  existingDatasetNames: [
                    "agent-loop-health-v1",
                    "agent-outcomes-v1",
                    "agent-config-snapshots-v1",
                    "source-coverage-v1",
                    "jsdoc-worker-model-suitability-v1",
                  ],
                })
              )
            )
          )
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("does not create datasets when Phoenix dataset lookup transport fails", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        const calls = {
          annotations: A.empty<string>(),
          appends: A.empty<string>(),
          datasets: A.empty<string>(),
          experiments: A.empty<string>(),
          prompts: A.empty<string>(),
        };
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const workerReportPath = path.join(tmpDir, "worker-eval.json");
          const annotationPlan = AgentEffectivenessAnnotationPlanInput.make({
            doctor: AgentEffectivenessDoctorInput.make({
              dataRoot,
              noPhoenix: true,
              workerEvalReportPath: workerReportPath,
            }),
          });
          yield* writeText(workerReportPath, workerReportJson);

          const error = yield* pipe(
            syncAgentEffectivenessPhoenix(
              AgentEffectivenessPhoenixSyncInput.make({
                annotationPlan,
                confirmToken: AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION,
                dryRun: false,
              })
            ),
            Effect.flip
          );

          expect(error.message).toBe("Failed to sync agent-effectiveness datasets to Phoenix.");
          expect(calls.appends).toEqual([]);
          expect(calls.datasets).toEqual([]);
          expect(calls.prompts).toEqual([]);
          expect(calls.experiments).toEqual([]);
          expect(calls.annotations).toEqual([]);
        }).pipe(
          provideScopedLayer(
            Layer.mergeAll(
              runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb")),
              Phoenix.makeLayerWithSdk(
                phoenixWriteSdk(calls, {
                  datasetLookupFailure: new Error("connect ECONNREFUSED 127.0.0.1:4040"),
                })
              )
            )
          )
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("rejects forbidden private content in planned annotations", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const basePlan = yield* makeAgentEffectivenessAnnotationPlan(
            AgentEffectivenessAnnotationPlanInput.make({
              doctor: AgentEffectivenessDoctorInput.make({
                dataRoot,
                noPhoenix: true,
                workerEvalReportPath: path.join(tmpDir, "missing-worker-report.json"),
              }),
            })
          );
          const plan = AgentEffectivenessAnnotationPlan.make({
            annotations: [
              AgentEffectivenessPlannedAnnotation.make({
                annotationId: "bad",
                metadata: { path: "/home/test-operator/private.txt" },
                name: "agent.outcome.note",
                optimization: "minimize",
                source: "ai-metrics",
                targetKind: "agent-task",
                targetRef: "task",
                value: "api_key=oops",
              }),
              AgentEffectivenessPlannedAnnotation.make({
                annotationId: "bad",
                metadata: {},
                name: "agent.outcome.note",
                optimization: "minimize",
                source: "ai-metrics",
                targetKind: "agent-task",
                targetRef: "task-duplicate",
                value: "safe",
              }),
            ],
            doctor: basePlan.doctor,
            generatedAt: basePlan.generatedAt,
            mutationPolicy: basePlan.mutationPolicy,
            schemaVersion: basePlan.schemaVersion,
            summary: basePlan.summary,
          });

          const report = makeAgentEffectivenessAnnotationCheckReport(plan);
          expect(report.status).toBe(AgentEffectivenessStatus.Enum.failed);
          expect(
            pipe(
              report.findings,
              A.map((finding) => finding.code)
            )
          ).toContain("private-home-path");
          expect(
            pipe(
              report.findings,
              A.map((finding) => finding.code)
            )
          ).toContain("secret-shaped-value");
          expect(
            pipe(
              report.findings,
              A.map((finding) => finding.code)
            )
          ).toContain("duplicate-annotation-id");
        }).pipe(provideScopedLayer(runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb"))));
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("rejects forbidden private content in the embedded doctor report", () =>
    withTempDirectory(
      Effect.fnUntraced(
        function* (tmpDir) {
          void tmpDir;
          const plan = yield* makeAgentEffectivenessAnnotationPlan(
            AgentEffectivenessAnnotationPlanInput.make({
              doctor: AgentEffectivenessDoctorInput.make({
                dataRoot: "/home/beep-private/metrics",
                noPhoenix: true,
                workerEvalReportPath: "/home/beep-private/worker-eval.json",
              }),
            })
          );

          const report = makeAgentEffectivenessAnnotationCheckReport(plan);

          expect(report.status).toBe(AgentEffectivenessStatus.Enum.failed);
          expect(
            pipe(
              report.findings,
              A.map((finding) => finding.annotationId)
            )
          ).toContain("plan.doctor.dataRoot");
          expect(
            pipe(
              report.findings,
              A.map((finding) => finding.code)
            )
          ).toContain("private-home-path");
        },
        (effect, tmpDir) => effect.pipe(provideScopedLayer(runtimeLayer(`${tmpDir}/metrics/derived/ai-metrics.duckdb`)))
      )
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("blocks confirmed Phoenix sync when annotation privacy checks fail", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        const calls = {
          annotations: A.empty<string>(),
          appends: A.empty<string>(),
          datasets: A.empty<string>(),
          experiments: A.empty<string>(),
          prompts: A.empty<string>(),
        };
        yield* Effect.gen(function* () {
          const dataRoot = path.join(tmpDir, "metrics");
          const workerReportPath = path.join(tmpDir, "worker-eval.json");
          const annotationPlan = AgentEffectivenessAnnotationPlanInput.make({
            doctor: AgentEffectivenessDoctorInput.make({
              dataRoot,
              noPhoenix: true,
              workerEvalReportPath: workerReportPath,
            }),
          });
          yield* writeText(workerReportPath, unsafeWorkerReportJson);

          const blocked = yield* syncAgentEffectivenessPhoenix(
            AgentEffectivenessPhoenixSyncInput.make({
              annotationPlan,
              confirmToken: AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION,
              dryRun: false,
            })
          );

          expect(blocked.status).toBe(AgentEffectivenessStatus.Enum.failed);
          expect(blocked.mutationPolicy).toBe("blocked-annotation-check-failed");
          expect(calls.appends).toEqual([]);
          expect(calls.datasets).toEqual([]);
          expect(calls.prompts).toEqual([]);
          expect(calls.experiments).toEqual([]);
          expect(calls.annotations).toEqual([]);
        }).pipe(
          provideScopedLayer(
            Layer.mergeAll(
              runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb")),
              Phoenix.makeLayerWithSdk(phoenixWriteSdk(calls))
            )
          )
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("blocks confirmed Phoenix sync when the embedded doctor report contains private paths", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        const calls = {
          annotations: A.empty<string>(),
          appends: A.empty<string>(),
          datasets: A.empty<string>(),
          experiments: A.empty<string>(),
          prompts: A.empty<string>(),
        };
        yield* Effect.gen(function* () {
          const annotationPlan = AgentEffectivenessAnnotationPlanInput.make({
            doctor: AgentEffectivenessDoctorInput.make({
              dataRoot: "/home/alice/.beep/ai-metrics",
              noPhoenix: true,
              workerEvalReportPath: path.join(tmpDir, "missing-worker-report.json"),
            }),
          });

          const blocked = yield* syncAgentEffectivenessPhoenix(
            AgentEffectivenessPhoenixSyncInput.make({
              annotationPlan,
              confirmToken: AGENT_EFFECTIVENESS_PHOENIX_WRITE_CONFIRMATION,
              dryRun: false,
            })
          );

          expect(blocked.status).toBe(AgentEffectivenessStatus.Enum.failed);
          expect(blocked.mutationPolicy).toBe("blocked-annotation-check-failed");
          expect(calls.appends).toEqual([]);
          expect(calls.datasets).toEqual([]);
          expect(calls.prompts).toEqual([]);
          expect(calls.experiments).toEqual([]);
          expect(calls.annotations).toEqual([]);
        }).pipe(
          provideScopedLayer(
            Layer.mergeAll(
              runtimeLayer(path.join(tmpDir, "metrics/derived/ai-metrics.duckdb")),
              Phoenix.makeLayerWithSdk(phoenixWriteSdk(calls))
            )
          )
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
});
