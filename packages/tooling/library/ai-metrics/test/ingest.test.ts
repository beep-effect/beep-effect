import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import {
  AGENT_EFFECTIVENESS_PHOENIX_PROJECT,
  AgentEffectivenessAnnotationValue,
  AgentSession,
  AgentTurn,
  AiMetricsBenchmarkCaseInput,
  AiMetricsBenchmarkRunInput,
  AiMetricsConfigSnapshotInput,
  AiMetricsDeployTarget,
  AiMetricsDerivedStorageWriteInput,
  AiMetricsDerivedTranscriptRecord,
  AiMetricsForwarderInput,
  AiMetricsForwarderOtlpExport,
  AiMetricsForwarderTimerInput,
  AiMetricsInstallDoctorInput,
  AiMetricsInstallInput,
  AiMetricsLabelQueueInput,
  AiMetricsMirrorBundleInput,
  AiMetricsOtlpAttributeValue,
  AiMetricsOtlpEndpointSpec,
  AiMetricsOtlpExportError,
  AiMetricsOtlpExportInput,
  AiMetricsOtlpSpanProjection,
  AiMetricsOtlpSpanProjectionBatch,
  AiMetricsOtlpSpanSender,
  AiMetricsOutcomeLabelInput,
  AiMetricsParquetExportMode,
  AiMetricsPrivacyMode,
  AiMetricsQualityGateStatus,
  AiMetricsRawArchiveObject,
  AiMetricsRetentionEnforcementPolicy,
  AiMetricsRetentionMutationResult,
  AiMetricsRetentionRestoreDrillInput,
  AiMetricsRetentionSelector,
  AiMetricsSourceDiscoveryInput,
  AiMetricsTool,
  AiMetricsTranscriptSource,
  AiMetricsTranscriptTextSummaryInput,
  AiMetricsWeeklyReportInput,
  addAiMetricsOutcomeLabel,
  aiMetricsInstallApplyDryRunToJson,
  aiMetricsInstallDoctorToJson,
  aiMetricsInstallPlanToJson,
  aiMetricsRetentionEnforcementToJson,
  buildAiMetricsMirrorBundle,
  ClaudeTranscriptLine,
  CodexTranscriptLine,
  configSnapshotToJson,
  decryptEncryptedRawArchiveEnvelope,
  discoverAiMetricsSources,
  enforceAiMetricsRetentionPolicy,
  ensureAiMetricsDerivedStorage,
  forwarderRunResultToJson,
  forwarderTimerPlanToJson,
  generateAiMetricsWeeklyReport,
  HookPulseV1,
  hashPrivateIdentifier,
  hashPublicTextSha256,
  listAiMetricsBenchmarkCases,
  listAiMetricsRetentionInventory,
  locateLatestAiMetricsMirrorBundle,
  ModelCall,
  makeAiMetricsConfigSnapshot,
  makeAiMetricsInstallApplyDryRunResult,
  makeAiMetricsInstallDoctorResult,
  makeAiMetricsInstallPlan,
  makeAiMetricsInstallSpec,
  makeAiMetricsPrivacyCheckResult,
  makeAiMetricsSourceAttribution,
  markAiMetricsOtlpTurnsExported,
  OpenClawTranscriptLine,
  otlpExportResultToJson,
  privacyCheckToJson,
  queueAiMetricsLabels,
  readAiMetricsOtlpSpanProjections,
  readEncryptedRawArchiveEnvelope,
  recordAiMetricsBenchmarkRun,
  renderAiMetricsForwarderTimerPlan,
  renderAiMetricsLocalPhoenixCompose,
  runAiMetricsForwarder,
  runAiMetricsOtlpExport,
  runAiMetricsOtlpProjectionBatchExport,
  runAiMetricsRetentionCompact,
  runAiMetricsRetentionDelete,
  runAiMetricsRetentionRestoreDrill,
  sourceDiscoveryToJson,
  summarizeTranscriptText,
  summaryToJson,
  ToolInvocation,
  TranscriptIngestSummary,
  upsertAiMetricsBenchmarkCase,
  writeAiMetricsConfigSnapshotArtifacts,
  writeAiMetricsDerivedStorage,
} from "@beep/repo-ai-metrics";
import { NonEmptyTrimmedStr } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { expect, it, layer } from "@effect/vitest";
import {
  Clock,
  DateTime,
  Effect,
  Encoding,
  Equal,
  Exit,
  Fiber,
  FileSystem,
  Layer,
  Order,
  Path,
  pipe,
  Redacted,
  Ref,
} from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import { FastCheck as fc, TestClock } from "effect/testing";

const expectSchemaMakeToFail = (run: () => unknown, messagePart: string): void => {
  const formatIssue = SchemaIssue.makeFormatterDefault();
  try {
    run();
  } catch (error) {
    if (P.hasProperty(error, "cause") && SchemaIssue.isIssue(error.cause)) {
      expect(formatIssue(error.cause)).toContain(messagePart);
      return;
    }
    throw error;
  }
  expect.unreachable("expected schema construction to throw");
};

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  );

const writeText = Effect.fn("AiMetricsTest.writeText")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, content);
});

const makeGitRoot = Effect.fn("AiMetricsTest.makeGitRoot")(function* (repoRoot: string) {
  const path = yield* Path.Path;
  yield* writeText(path.join(repoRoot, ".git/HEAD"), "ref: refs/heads/main\n");
  yield* writeText(path.join(repoRoot, ".git/refs/heads/main"), `${pipe("a", Str.repeat(40))}\n`);
  yield* writeText(
    path.join(repoRoot, ".git/config"),
    '[remote "origin"]\n\turl = git@github.com:beep-effect/beep-effect.git\n'
  );
});

const relativeSnapshotPaths = (files: ReadonlyArray<{ readonly relativePath: string }>): ReadonlyArray<string> =>
  pipe(
    files,
    A.map((file) => file.relativePath),
    A.sort(Order.String)
  );

const sqlString = (value: string): string => `'${pipe(value, Str.replace(/'/gu, "''"))}'`;
const AI_METRICS_LONG_TEST_TIMEOUT = 90_000;

// Delivery is injected so the export path can be driven without a live collector, and
// so a rejected delivery can be reproduced deterministically. Pointing the real proto
// exporter at a dead port would work but costs ~3s of retry backoff per assertion.
const recordingSpanSender = (
  delivered: Ref.Ref<ReadonlyArray<ReadonlyArray<AiMetricsOtlpSpanProjection>>>
): Layer.Layer<AiMetricsOtlpSpanSender> =>
  Layer.succeed(AiMetricsOtlpSpanSender)(
    AiMetricsOtlpSpanSender.of({
      send: Effect.fn("AiMetricsOtlpSpanSender.send")(
        (_input: AiMetricsOtlpExportInput, projections: ReadonlyArray<AiMetricsOtlpSpanProjection>) =>
          Ref.update(delivered, A.append(projections))
      ),
    })
  );

const rejectingSpanSender: Layer.Layer<AiMetricsOtlpSpanSender> = Layer.succeed(AiMetricsOtlpSpanSender)(
  AiMetricsOtlpSpanSender.of({
    send: Effect.fn("AiMetricsOtlpSpanSender.send")(() =>
      Effect.fail(
        AiMetricsOtlpExportError.make({
          cause: { exportResultCode: 1 },
          message: "The AI metrics OTLP collector did not accept the exported spans.",
        })
      )
    ),
  })
);

const succeedingThenRejectingSpanSender = (calls: Ref.Ref<number>): Layer.Layer<AiMetricsOtlpSpanSender> =>
  Layer.succeed(
    AiMetricsOtlpSpanSender,
    AiMetricsOtlpSpanSender.of({
      send: Effect.fn("AiMetricsOtlpSpanSender.send")(function* () {
        const call = yield* Ref.getAndUpdate(calls, (value) => value + 1);
        if (call === 0) {
          return;
        }
        return yield* AiMetricsOtlpExportError.make({
          cause: { exportResultCode: 1 },
          message: "The AI metrics OTLP collector did not accept the exported spans.",
        });
      }),
    })
  );

const retryableThenSucceedingSpanSender = (calls: Ref.Ref<number>): Layer.Layer<AiMetricsOtlpSpanSender> =>
  Layer.succeed(
    AiMetricsOtlpSpanSender,
    AiMetricsOtlpSpanSender.of({
      send: Effect.fn("test.retryableThenSucceedingSpanSender.send")(function* () {
        const call = yield* Ref.updateAndGet(calls, (count) => count + 1);
        if (call === 1) {
          return yield* AiMetricsOtlpExportError.make({
            cause: new Error("Export failed with retryable status"),
            message: "The AI metrics OTLP collector did not accept the exported spans.",
          });
        }
      }),
    })
  );

const spanIdsByName = (
  projections: ReadonlyArray<AiMetricsOtlpSpanProjection>,
  spanName: string
): ReadonlyArray<string> =>
  pipe(
    projections,
    A.filter((projection) => projection.spanName === spanName),
    A.map((projection) => projection.spanId)
  );

const assertEncodeDecodeRoundTrip = <A>(
  law: {
    readonly arbitrary: fc.Arbitrary<A>;
    readonly decode: (input: unknown) => A;
    readonly encode: (value: A) => unknown;
    readonly equivalent: (self: A, that: A) => boolean;
  },
  options?: { readonly numRuns?: number }
): void => {
  fc.assert(
    fc.property(law.arbitrary, (value) => {
      const decoded = law.decode(law.encode(value));

      return Equal.equals(decoded, value) || law.equivalent(decoded, value);
    }),
    fcRuns(options?.numRuns ?? 12)
  );
};

const transcriptTextSummaryInputLaw = {
  arbitrary: S.toArbitrary(AiMetricsTranscriptTextSummaryInput)(fc),
  decode: S.decodeUnknownSync(AiMetricsTranscriptTextSummaryInput),
  encode: S.encodeUnknownSync(AiMetricsTranscriptTextSummaryInput),
  equivalent: S.toEquivalence(AiMetricsTranscriptTextSummaryInput),
};
const agentSessionLaw = {
  arbitrary: S.toArbitrary(AgentSession)(fc),
  decode: S.decodeUnknownSync(AgentSession),
  encode: S.encodeUnknownSync(AgentSession),
  equivalent: S.toEquivalence(AgentSession),
};
const isAgentSession = S.is(AgentSession);
const AgentSessionSchemaProperty = fc.property(S.toArbitrary(AgentSession)(fc), (session) => isAgentSession(session));
const agentTurnLaw = {
  arbitrary: S.toArbitrary(AgentTurn)(fc),
  decode: S.decodeUnknownSync(AgentTurn),
  encode: S.encodeUnknownSync(AgentTurn),
  equivalent: S.toEquivalence(AgentTurn),
};
const codexTranscriptLineLaw = {
  arbitrary: S.toArbitrary(CodexTranscriptLine)(fc),
  decode: S.decodeUnknownSync(CodexTranscriptLine),
  encode: S.encodeUnknownSync(CodexTranscriptLine),
  equivalent: S.toEquivalence(CodexTranscriptLine),
};
const claudeTranscriptLineLaw = {
  arbitrary: S.toArbitrary(ClaudeTranscriptLine)(fc),
  decode: S.decodeUnknownSync(ClaudeTranscriptLine),
  encode: S.encodeUnknownSync(ClaudeTranscriptLine),
  equivalent: S.toEquivalence(ClaudeTranscriptLine),
};
const openClawTranscriptLineLaw = {
  arbitrary: S.toArbitrary(OpenClawTranscriptLine)(fc),
  decode: S.decodeUnknownSync(OpenClawTranscriptLine),
  encode: S.encodeUnknownSync(OpenClawTranscriptLine),
  equivalent: S.toEquivalence(OpenClawTranscriptLine),
};
const transcriptIngestSummaryLaw = {
  arbitrary: S.toArbitrary(TranscriptIngestSummary)(fc),
  decode: S.decodeUnknownSync(TranscriptIngestSummary),
  encode: S.encodeUnknownSync(TranscriptIngestSummary),
  equivalent: S.toEquivalence(TranscriptIngestSummary),
};
const otlpAttributeValueLaw = {
  arbitrary: S.toArbitrary(AiMetricsOtlpAttributeValue)(fc),
  decode: S.decodeUnknownSync(AiMetricsOtlpAttributeValue),
  encode: S.encodeUnknownSync(AiMetricsOtlpAttributeValue),
  equivalent: S.toEquivalence(AiMetricsOtlpAttributeValue),
};
const forwarderOtlpExportLaw = {
  arbitrary: S.toArbitrary(AiMetricsForwarderOtlpExport)(fc),
  decode: S.decodeUnknownSync(AiMetricsForwarderOtlpExport),
  encode: S.encodeUnknownSync(AiMetricsForwarderOtlpExport),
  equivalent: S.toEquivalence(AiMetricsForwarderOtlpExport),
};
const effectivenessAnnotationValueLaw = {
  arbitrary: S.toArbitrary(AgentEffectivenessAnnotationValue)(fc),
  decode: S.decodeUnknownSync(AgentEffectivenessAnnotationValue),
  encode: S.encodeUnknownSync(AgentEffectivenessAnnotationValue),
  equivalent: S.toEquivalence(AgentEffectivenessAnnotationValue),
};
const retentionMutationResultLaw = {
  arbitrary: S.toArbitrary(AiMetricsRetentionMutationResult)(fc),
  decode: S.decodeUnknownSync(AiMetricsRetentionMutationResult),
  encode: S.encodeUnknownSync(AiMetricsRetentionMutationResult),
  equivalent: S.toEquivalence(AiMetricsRetentionMutationResult),
};
const nonEmptyTrimmedStringLaw = {
  arbitrary: S.toArbitrary(NonEmptyTrimmedStr)(fc),
  decode: S.decodeUnknownSync(NonEmptyTrimmedStr),
  encode: S.encodeUnknownSync(NonEmptyTrimmedStr),
  equivalent: S.toEquivalence(NonEmptyTrimmedStr),
};

const phoenixService = <A extends { readonly tool: string }>(spec: { readonly services: ReadonlyArray<A> }) =>
  pipe(
    spec.services,
    A.findFirst((service) => service.tool === AiMetricsTool.Enum.phoenix)
  );

it("derives valid agent sessions from the schema", () => fc.assert(AgentSessionSchemaProperty, fcRuns(12)));

it("rejects impossible line and measurement values at construction", () => {
  expect(() =>
    AgentTurn.make({
      eventName: "event_msg",
      lineNumber: 0,
      sourceKind: "codex",
      sourcePathHash: "source",
    })
  ).toThrow();
  expect(() =>
    ModelCall.make({
      callId: "call-1",
      latencyMs: O.some(-1),
      model: "synthetic-model",
      provider: "synthetic-provider",
      totalTokens: O.some(0),
    })
  ).toThrow();
  expect(() =>
    ToolInvocation.make({
      durationMs: O.some(1.5),
      exitCode: O.some(0),
      toolName: "synthetic-tool",
      toolRunId: "tool-1",
    })
  ).toThrow();
});

layer(NodeServices.layer)("@beep/repo-ai-metrics", (it) => {
  it.effect(
    "summarizes Codex JSONL and counts rejected lines",
    Effect.fn(function* () {
      const content = pipe(
        [
          '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z","payload":{"id":"s1"}}',
          '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","payload":{"message":"ran"}}',
          "not-json",
        ],
        A.join("\n")
      );

      const summary = yield* summarizeTranscriptText({
        content,
        hashSalt: O.none(),
        sourceKind: AiMetricsTranscriptSource.Enum.codex,
        sourcePath: "codex.jsonl",
      });

      expect(summary.sourceKind).toBe("codex");
      expect(summary.totalLines).toBe(3);
      expect(summary.acceptedEvents).toBe(2);
      expect(summary.rejectedLines).toBe(1);
      expect(summary.eventNames).toEqual(["event_msg", "session_meta"]);
      expect(summary.firstTimestamp).toEqual(O.some("2026-05-05T10:00:00Z"));
      expect(summary.lastTimestamp).toEqual(O.some("2026-05-05T10:01:00Z"));
      expect(summary.sourcePathHash).not.toBe("codex.jsonl");
      const encoded = yield* summaryToJson(summary);
      expect(encoded).toContain('"firstTimestamp":"2026-05-05T10:00:00Z"');
      expect(encoded).toContain('"lastTimestamp":"2026-05-05T10:01:00Z"');
    })
  );

  it.effect(
    "summarizes Claude JSONL with missing type",
    Effect.fn(function* () {
      const content = '{"sessionId":"claude-session","timestamp":"2026-05-05T11:00:00Z","message":{"role":"user"}}';

      const summary = yield* summarizeTranscriptText({
        content,
        hashSalt: O.none(),
        sourceKind: AiMetricsTranscriptSource.Enum.claude,
        sourcePath: "claude.jsonl",
      });

      expect(summary.acceptedEvents).toBe(1);
      expect(summary.eventNames).toEqual(["message"]);
      expect(summary.sourcePathHash).not.toBe("claude.jsonl");
    })
  );

  it("preserves crispened schema wire shapes and arbitrary round trips", () => {
    expect(CodexTranscriptLine.encodeJsonSync(CodexTranscriptLine.make({ type: "event_msg" }))).toBe(
      '{"type":"event_msg"}'
    );
    expect(ClaudeTranscriptLine.encodeJsonSync(ClaudeTranscriptLine.make({ type: O.some("message") }))).toBe(
      '{"type":"message"}'
    );
    expect(OpenClawTranscriptLine.encodeJsonSync(OpenClawTranscriptLine.make({ event: O.some("message") }))).toBe(
      '{"event":"message"}'
    );

    assertEncodeDecodeRoundTrip(transcriptTextSummaryInputLaw);
    assertEncodeDecodeRoundTrip(agentSessionLaw, { numRuns: 8 });
    assertEncodeDecodeRoundTrip(agentTurnLaw, { numRuns: 8 });
    assertEncodeDecodeRoundTrip(codexTranscriptLineLaw, { numRuns: 8 });
    assertEncodeDecodeRoundTrip(claudeTranscriptLineLaw, { numRuns: 8 });
    assertEncodeDecodeRoundTrip(openClawTranscriptLineLaw, { numRuns: 8 });
    assertEncodeDecodeRoundTrip(transcriptIngestSummaryLaw, { numRuns: 8 });
    assertEncodeDecodeRoundTrip(otlpAttributeValueLaw);
    assertEncodeDecodeRoundTrip(forwarderOtlpExportLaw);
    assertEncodeDecodeRoundTrip(effectivenessAnnotationValueLaw);
    assertEncodeDecodeRoundTrip(retentionMutationResultLaw);
    assertEncodeDecodeRoundTrip(nonEmptyTrimmedStringLaw);
  });

  it.effect(
    "normalizes Codex attribution metadata before hashing",
    Effect.fn(function* () {
      const hashSalt = O.some("test-salt");
      const attribution = yield* makeAiMetricsSourceAttribution({
        content:
          '{"type":"session_meta","payload":{"id":" session-1 ","parent_session_id":"   ","source":{"subagent":{"agent_nickname":"   ","agent_role":" reviewer ","parent_thread_id":" thread-1 "}}}}',
        hashSalt,
        relativePath: "subagents/session-1.jsonl",
        sourceKind: AiMetricsTranscriptSource.Enum.codex,
        sourcePath: "/repo/.codex/sessions/subagents/session-1.jsonl",
      });

      expect(attribution.sourceRole).toBe("subagent");
      expect(attribution.agentNicknameHash).toEqual(O.none());
      expect(attribution.parentSessionIdHash).toEqual(O.none());
      expect(attribution.agentRoleHash).toEqual(O.some(yield* hashPrivateIdentifier("reviewer", hashSalt)));
      expect(attribution.parentThreadIdHash).toEqual(O.some(yield* hashPrivateIdentifier("thread-1", hashSalt)));
      expect(attribution.sessionIdHash).toEqual(O.some(yield* hashPrivateIdentifier("session-1", hashSalt)));
    })
  );

  it.effect(
    "runs durable ingest with encrypted raw archive, DuckDB projection, and Parquet export",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          yield* makeGitRoot(repoRoot);
          const dataRoot = path.join(tmpDir, "metrics");
          const codexRoot = path.join(homeDir, ".codex/sessions");
          const claudeRoot = path.join(homeDir, ".claude/projects/repo");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          const rawArchiveKey = Redacted.make(Encoding.encodeBase64(new Uint8Array(32).fill(7)));
          const hookSessionId = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
          const hookCwd = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
          const now = yield* Clock.currentTimeMillis;
          const hookPulseJson = (hookEvent: "SessionStart" | "Stop", epochMilliseconds: number) =>
            HookPulseV1.decodeEffect({
              schemaVersion: "hook-pulse/v1",
              ts: DateTime.formatIso(DateTime.makeUnsafe({ epochMilliseconds })),
              sessionId: hookSessionId,
              agentKind: "claude-code",
              hookEvent,
              cwd: hookCwd,
              notifierRev: "desktop-ntfy-1",
              instrumentClass: "production",
              evidenceTier: "derived",
              waitReason: "none",
            }).pipe(Effect.flatMap(HookPulseV1.encodeJsonEffect));

          yield* writeText(
            path.join(codexRoot, "codex.jsonl"),
            pipe(
              [
                '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z","payload":{"id":"s1"}}',
                '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","payload":{"message":"SECRET_TOKEN=secret-value"}}',
              ],
              A.join("\n")
            )
          );
          yield* writeText(
            path.join(claudeRoot, "claude.jsonl"),
            '{"type":"assistant","timestamp":"2026-05-05T10:02:00Z","message":{"content":"done"}}'
          );
          yield* writeText(
            path.join(
              homeDir,
              `.local/state/beep/agent-evidence/hook-events/hook-pulse-2026-09-03-${hookSessionId}.ndjson`
            ),
            `${yield* hookPulseJson("SessionStart", now - 1_000)}\n${yield* hookPulseJson("Stop", now)}\n`
          );
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "# Test agent guide\n");

          yield* Effect.gen(function* () {
            const result = yield* runAiMetricsForwarder(
              AiMetricsForwarderInput.make({
                claudeProjectsRoot: O.some(claudeRoot),
                codexSessionsRoot: O.some(codexRoot),
                dataRoot: O.some(dataRoot),
                hashSalt: O.some("test-salt"),
                homeDir,
                includeAll: true,
                rawArchiveKey,
                repoRoot,
                target: AiMetricsDeployTarget.Enum.local,
              })
            );

            expect(result.sourceFileCount).toBe(2);
            expect(result.archiveObjectCount).toBe(2);
            expect(result.turnCount).toBe(3);
            expect(result.hookPulseLeaseReplay).toEqual(
              O.some(
                expect.objectContaining({
                  acceptedSessionCount: 1,
                  enumeratedFileCount: 1,
                  openLeaseCount: 1,
                  sessionCount: 1,
                  tombstonedSessionCount: 0,
                })
              )
            );
            expect(
              yield* fs.exists(path.join(dataRoot, "telemetry-v2/session-leases/active", `${hookSessionId}.json`))
            ).toBe(true);
            expect(result.sourceCoverage).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  candidateFileCount: 1,
                  includedFileCount: 1,
                  sourceKind: "codex",
                }),
                expect.objectContaining({
                  candidateFileCount: 1,
                  includedFileCount: 1,
                  sourceKind: "claude",
                }),
              ])
            );
            expect(yield* forwarderRunResultToJson(result)).toContain(result.ingestRunId);
            expect(result.parquetExportMode).toBe("snapshot");
            const parquetExportDir = result.parquetExportDir;
            expect(O.isSome(parquetExportDir)).toBe(true);
            if (O.isNone(parquetExportDir)) {
              return;
            }
            expect(yield* fs.exists(path.join(parquetExportDir.value, "ai_metrics_turns.parquet"))).toBe(true);
            expect(yield* fs.exists(path.join(dataRoot, "config-snapshots/latest.json"))).toBe(true);

            const duckdb = yield* DuckDb;
            const turnRows = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_turns");
            expect(turnRows).toEqual([{ count: "3" }]);
            const sourceRoleRows = yield* duckdb.query(
              "SELECT source_role AS sourceRole FROM ai_metrics_sessions ORDER BY source_kind"
            );
            expect(sourceRoleRows).toEqual([{ sourceRole: "primary" }, { sourceRole: "primary" }]);
            const archiveRows = yield* duckdb.query(
              "SELECT archive_path FROM ai_metrics_raw_archive_objects WHERE source_kind = 'codex'"
            );
            const archivePath = globalThis.String(archiveRows[0]?.archive_path ?? "");
            const archiveText = yield* fs.readFileString(archivePath);
            expect(archiveText).not.toContain("secret-value");

            const envelope = yield* readEncryptedRawArchiveEnvelope(archivePath);
            const plaintext = yield* decryptEncryptedRawArchiveEnvelope({
              envelope,
              rawArchiveKey,
            });
            expect(plaintext).toContain("secret-value");
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "supports disabled and latest-only Parquet export modes",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const dataRoot = path.join(tmpDir, "metrics");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          const sourcePath = path.join(tmpDir, "home/.codex/sessions/codex.jsonl");
          const content = '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z"}';

          yield* writeText(path.join(tmpDir, "repo", "AGENTS.md"), "# Test agent guide\n");

          yield* Effect.gen(function* () {
            const summary = yield* summarizeTranscriptText({
              content,
              hashSalt: O.some("test-salt"),
              sourceKind: AiMetricsTranscriptSource.Enum.codex,
              sourcePath,
            });
            const privacy = yield* makeAiMetricsPrivacyCheckResult({
              content,
              hashSalt: O.some("test-salt"),
              sourcePath,
              summary,
            });
            const installSpec = yield* makeAiMetricsInstallSpec(
              AiMetricsInstallInput.make({
                dataRoot: O.some(dataRoot),
                target: AiMetricsDeployTarget.Enum.local,
              })
            );
            const configSnapshot = yield* makeAiMetricsConfigSnapshot(
              AiMetricsConfigSnapshotInput.make({
                repoRoot: path.join(tmpDir, "repo"),
              })
            );
            const record = AiMetricsDerivedTranscriptRecord.make({
              archiveObject: AiMetricsRawArchiveObject.make({
                algorithm: "AES-256-GCM",
                archiveObjectId: "raw-1111111111111111111111111111111111111111111111111111111111111111",
                archivePath: path.join(dataRoot, "raw/codex/raw-content-addressed-object.json"),
                created: false,
                encryptedAtEpochMillis: 1,
                plaintextContentHash: "2222222222222222222222222222222222222222222222222222222222222222",
                sourceKind: AiMetricsTranscriptSource.Enum.codex,
                sourcePathHash: summary.sourcePathHash,
              }),
              privacy,
            });
            const baseInput = {
              configSnapshot: configSnapshot.snapshot,
              records: [record],
              repoRootHash: "repo-root-hash",
              startedAtEpochMillis: 1,
              storage: installSpec.storage,
              target: AiMetricsDeployTarget.Enum.local,
            };

            const disabled = yield* writeAiMetricsDerivedStorage(
              AiMetricsDerivedStorageWriteInput.make({
                ...baseInput,
                ingestRunId: "forwarder-none",
                parquetExportMode: AiMetricsParquetExportMode.Enum.none,
              })
            );
            expect(disabled.parquetExportMode).toBe("none");
            expect(disabled.parquetExportDir).toEqual(O.none());
            expect(disabled.parquetTables).toEqual([]);
            expect(yield* fs.exists(path.join(dataRoot, "derived/parquet"))).toBe(false);

            const latest = yield* writeAiMetricsDerivedStorage(
              AiMetricsDerivedStorageWriteInput.make({
                ...baseInput,
                ingestRunId: "forwarder-latest",
                parquetExportMode: AiMetricsParquetExportMode.Enum.latest,
              })
            );
            expect(latest.parquetExportMode).toBe("latest");
            expect(latest.parquetExportDir).toEqual(O.some(path.join(dataRoot, "derived/parquet/latest")));
            expect(yield* fs.exists(path.join(dataRoot, "derived/parquet/latest/ai_metrics_turns.parquet"))).toBe(true);

            yield* writeText(path.join(dataRoot, "derived/parquet/latest/stale.tmp"), "stale\n");
            yield* writeAiMetricsDerivedStorage(
              AiMetricsDerivedStorageWriteInput.make({
                ...baseInput,
                ingestRunId: "forwarder-latest-2",
                parquetExportMode: AiMetricsParquetExportMode.Enum.latest,
              })
            );
            expect(yield* fs.exists(path.join(dataRoot, "derived/parquet/latest/stale.tmp"))).toBe(false);
            expect(yield* fs.exists(path.join(dataRoot, "derived/parquet/forwarder-latest-2"))).toBe(false);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "applies maxFiles per source instead of starving lower-recency sources globally",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          yield* makeGitRoot(repoRoot);
          const dataRoot = path.join(tmpDir, "metrics");
          const codexRoot = path.join(homeDir, ".codex/sessions");
          const claudeRoot = path.join(homeDir, ".claude/projects/repo");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          const rawArchiveKey = Redacted.make(Encoding.encodeBase64(new Uint8Array(32).fill(9)));

          yield* writeText(
            path.join(codexRoot, "codex-a.jsonl"),
            '{"type":"event_msg","timestamp":"2026-05-05T10:00:00Z"}'
          );
          yield* writeText(
            path.join(codexRoot, "codex-b.jsonl"),
            '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z"}'
          );
          yield* writeText(
            path.join(claudeRoot, "claude-a.jsonl"),
            '{"type":"assistant","timestamp":"2026-05-05T10:02:00Z"}'
          );
          yield* writeText(
            path.join(claudeRoot, "claude-b.jsonl"),
            '{"type":"assistant","timestamp":"2026-05-05T10:03:00Z"}'
          );
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "# Test agent guide\n");

          yield* Effect.gen(function* () {
            const result = yield* runAiMetricsForwarder(
              AiMetricsForwarderInput.make({
                claudeProjectsRoot: O.some(claudeRoot),
                codexSessionsRoot: O.some(codexRoot),
                dataRoot: O.some(dataRoot),
                hashSalt: O.some("test-salt"),
                homeDir,
                includeAll: true,
                maxFiles: 1,
                rawArchiveKey,
                repoRoot,
                target: AiMetricsDeployTarget.Enum.local,
              })
            );

            expect(result.sourceFileCount).toBe(2);
            expect(result.sourceCoverage).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  candidateFileCount: 2,
                  includedFileCount: 1,
                  limitedByMaxFiles: true,
                  sourceKind: "codex",
                }),
                expect.objectContaining({
                  candidateFileCount: 2,
                  includedFileCount: 1,
                  limitedByMaxFiles: true,
                  sourceKind: "claude",
                }),
              ])
            );
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    }),
    AI_METRICS_LONG_TEST_TIMEOUT
  );

  it.effect(
    "retains repeated derived ingest runs for the same source records",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const dataRoot = path.join(tmpDir, "metrics");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          const sourcePath = path.join(tmpDir, "home/.codex/sessions/codex.jsonl");
          const content = [
            '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z"}',
            '{"type":"event_msg","timestamp":"2026-05-05T10:02:00Z"}',
          ].join("\n");

          yield* writeText(path.join(tmpDir, "repo", "AGENTS.md"), "# Test agent guide\n");

          yield* Effect.gen(function* () {
            const summary = yield* summarizeTranscriptText({
              content,
              hashSalt: O.some("test-salt"),
              sourceKind: AiMetricsTranscriptSource.Enum.codex,
              sourcePath,
            });
            const privacy = yield* makeAiMetricsPrivacyCheckResult({
              content,
              hashSalt: O.some("test-salt"),
              sourcePath,
              summary,
            });
            const installSpec = yield* makeAiMetricsInstallSpec(
              AiMetricsInstallInput.make({
                dataRoot: O.some(dataRoot),
                target: AiMetricsDeployTarget.Enum.local,
              })
            );
            const configSnapshot = yield* makeAiMetricsConfigSnapshot(
              AiMetricsConfigSnapshotInput.make({
                repoRoot: path.join(tmpDir, "repo"),
              })
            );
            const record = AiMetricsDerivedTranscriptRecord.make({
              archiveObject: AiMetricsRawArchiveObject.make({
                algorithm: "AES-256-GCM",
                archiveObjectId: "raw-1111111111111111111111111111111111111111111111111111111111111111",
                archivePath: path.join(dataRoot, "raw/codex/raw-content-addressed-object.json"),
                created: false,
                encryptedAtEpochMillis: 1,
                plaintextContentHash: "2222222222222222222222222222222222222222222222222222222222222222",
                sourceKind: AiMetricsTranscriptSource.Enum.codex,
                sourcePathHash: summary.sourcePathHash,
              }),
              privacy,
            });
            const baseInput = {
              configSnapshot: configSnapshot.snapshot,
              records: [record],
              repoRootHash: "repo-root-hash",
              startedAtEpochMillis: 1,
              storage: installSpec.storage,
              target: AiMetricsDeployTarget.Enum.local,
            };

            yield* writeAiMetricsDerivedStorage(
              AiMetricsDerivedStorageWriteInput.make({
                ...baseInput,
                ingestRunId: "forwarder-1",
              })
            );
            yield* writeAiMetricsDerivedStorage(
              AiMetricsDerivedStorageWriteInput.make({
                ...baseInput,
                ingestRunId: "forwarder-2",
              })
            );
            yield* writeText(path.join(tmpDir, "repo", "AGENTS.md"), "# Changed agent guide\n");
            const changedConfigSnapshot = yield* makeAiMetricsConfigSnapshot(
              AiMetricsConfigSnapshotInput.make({
                repoRoot: path.join(tmpDir, "repo"),
              })
            );
            yield* writeAiMetricsDerivedStorage(
              AiMetricsDerivedStorageWriteInput.make({
                ...baseInput,
                configSnapshot: changedConfigSnapshot.snapshot,
                ingestRunId: "forwarder-3",
                startedAtEpochMillis: 2,
              })
            );

            const duckdb = yield* DuckDb;
            const runRows = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_ingest_runs");
            const runArchiveCounts = yield* duckdb.query(
              "SELECT archive_object_count::integer AS archiveObjectCount FROM ai_metrics_ingest_runs ORDER BY ingest_run_id"
            );
            const sourceRows = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_source_files");
            const archiveRows = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_raw_archive_objects");
            const agentTaskRows = yield* duckdb.query(
              "SELECT count(*) AS count, count(DISTINCT config_snapshot_id)::integer AS configSnapshotCount FROM ai_metrics_agent_tasks"
            );
            const sessionRows = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_sessions");
            const turnRows = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_turns");
            const turnLineage = yield* duckdb.query(
              "SELECT DISTINCT ingest_run_id AS ingestRunId FROM ai_metrics_turns"
            );

            expect(runRows).toEqual([{ count: "3" }]);
            expect(runArchiveCounts).toEqual([
              { archiveObjectCount: 0 },
              { archiveObjectCount: 0 },
              { archiveObjectCount: 0 },
            ]);
            expect(sourceRows).toEqual([{ count: "3" }]);
            expect(archiveRows).toEqual([{ count: "3" }]);
            expect(agentTaskRows).toEqual([{ configSnapshotCount: 2, count: "2" }]);
            // Sessions collapse for the same reason turns do: `agent_session_id` is
            // content-addressed now, so three runs over one transcript own one row, not
            // three. Note sourceRows/archiveRows below stay at 3 -- those ids still embed
            // the run id by design, and if they moved this change hit more than intended.
            expect(sessionRows).toEqual([{ count: "1" }]);
            // Three runs over two byte-identical turns must yield TWO rows. The old
            // per-run identity duplicated each turn and grew the store to 5.43M rows
            // over ~516K distinct raw_event_hash across 1,222 runs.
            expect(turnRows).toEqual([{ count: "2" }]);
            // ...and it must retain the FIRST run's id. The OTLP export selects
            // `WHERE ingest_run_id = <this run>`, so if a re-ingest rewrote this to the
            // current run, every previously-seen turn would be re-exported to Phoenix
            // on every run even though the table had stopped growing. Retaining
            // first-seen lineage is what makes the export incremental.
            expect(turnLineage).toEqual([{ ingestRunId: "forwarder-1" }]);

            // A run can commit turns and then die before its OTLP export. Because
            // ingestion is idempotent, the retry no longer re-mints those rows under a
            // new run id -- so if the exporter scoped itself to "this run", the
            // committed turns would be stranded and never reach Phoenix. Export state
            // is tracked on its own watermark for exactly that reason.
            const phoenix = phoenixService(installSpec);
            expect(O.isSome(phoenix)).toBe(true);
            if (O.isNone(phoenix)) {
              return;
            }
            const exportInput = AiMetricsOtlpExportInput.make({
              duckDbPath,
              endpoint: phoenix.value.otlp,
              target: AiMetricsDeployTarget.Enum.local,
            });

            // Un-exported turns are visible even though they belong to forwarder-1 and
            // the latest run is forwarder-3.
            const pending = yield* readAiMetricsOtlpSpanProjections;
            expect(pending.turnIds.length).toBe(2);

            // Span identity is content-addressed, so re-reading identical content yields
            // byte-identical ids. That is what lets Phoenix's uq_spans_span_id collapse a
            // redelivery instead of storing a second copy -- and it is why correctness no
            // longer depends on the watermark being perfectly accurate.
            const rereadPending = yield* readAiMetricsOtlpSpanProjections;
            expect(spanIdsByName(rereadPending.projections, "ai_metrics.agent.turn")).toEqual(
              spanIdsByName(pending.projections, "ai_metrics.agent.turn")
            );
            expect(spanIdsByName(rereadPending.projections, "ai_metrics.agent.session")).toEqual(
              spanIdsByName(pending.projections, "ai_metrics.agent.session")
            );

            // Ids are hex of the right width, never the all-zero id the OTLP wire format
            // reads as "absent" -- a span carrying one is dropped rather than stored.
            const turnProjections = pipe(
              pending.projections,
              A.filter((projection) => projection.spanName === "ai_metrics.agent.turn")
            );
            const sessionProjections = pipe(
              pending.projections,
              A.filter((projection) => projection.spanName === "ai_metrics.agent.session")
            );
            expect(turnProjections.length).toBe(2);
            expect(sessionProjections.length, "session projection count").toBe(1);
            const turnSpan = pipe(turnProjections, A.head, O.getOrThrow);
            const sessionSpan = pipe(sessionProjections, A.head, O.getOrThrow);
            expect(turnSpan.traceId).toMatch(/^[0-9a-f]{32}$/u);
            expect(turnSpan.spanId).toMatch(/^[0-9a-f]{16}$/u);
            expect(turnSpan.traceId).not.toBe(Str.repeat(32)("0"));
            expect(turnSpan.spanId).not.toBe(Str.repeat(16)("0"));
            // Turns hang off their session span and share its trace, so one agent session
            // reads as one trace in Phoenix rather than as unrelated roots.
            expect(turnSpan.traceId).toBe(sessionSpan.traceId);
            expect(O.getOrThrow(turnSpan.parentSpanId)).toBe(sessionSpan.spanId);
            expect(O.isNone(sessionSpan.parentSpanId)).toBe(true);

            // A rejected delivery must leave the watermark open. Without the failure
            // short-circuiting the mark, these turns would be recorded as exported after
            // never reaching the collector -- silently lost, which is the failure mode a
            // watermark is supposed to prevent.
            const rejectedExit = yield* runAiMetricsOtlpExport(exportInput).pipe(
              provideScopedLayer(rejectingSpanSender),
              Effect.exit
            );
            expect(Exit.isFailure(rejectedExit)).toBe(true);
            const afterRejectedExport = yield* readAiMetricsOtlpSpanProjections;
            expect(afterRejectedExport.turnIds).toEqual(pending.turnIds);

            // Reproduce the review-found boundary exactly: more than 512 distinct
            // sessions used to put an entire session-only prefix on the wire. An
            // accepted first request then marked zero turns, so the next retry rebuilt
            // and resent the identical prefix forever.
            yield* duckdb.run(
              `INSERT INTO ai_metrics_sessions
                 (agent_session_id, agent_task_id, ingest_run_id, source_kind,
                  source_path_hash, source_role, session_id_hash,
                  parent_session_id_hash, parent_thread_id_hash, forked_from_id_hash,
                  thread_spawn, agent_role_hash, agent_nickname_hash, started_at,
                  config_snapshot_id)
               SELECT 'review-session-' || range::VARCHAR, agent_task_id, ingest_run_id,
                      source_kind, 'review-source-' || range::VARCHAR, source_role,
                      session_id_hash, parent_session_id_hash, parent_thread_id_hash,
                      forked_from_id_hash, thread_spawn, agent_role_hash,
                      agent_nickname_hash, started_at, config_snapshot_id
               FROM (SELECT * FROM ai_metrics_sessions LIMIT 1), range(512)`
            );
            yield* duckdb.run(
              `INSERT INTO ai_metrics_turns
                 (turn_id, ingest_run_id, agent_session_id, source_kind,
                  source_path_hash, source_role, line_number, event_name,
                  raw_event_hash, timestamp, otlp_exported_at_epoch_ms)
               SELECT 'review-turn-' || range::VARCHAR, ingest_run_id,
                      'review-session-' || range::VARCHAR, source_kind,
                      'review-source-' || range::VARCHAR, source_role, 1, event_name,
                      'review-raw-' || range::VARCHAR, timestamp, NULL
               FROM (SELECT * FROM ai_metrics_turns LIMIT 1), range(512)`
            );
            const beforePartialExport = yield* readAiMetricsOtlpSpanProjections;
            expect(beforePartialExport.turnIds.length, "production-shaped pending turn count").toBe(514);

            // A later chunk can fail after Phoenix has acknowledged an earlier one. The
            // acknowledged prefix must stay closed or every retry refills the collector
            // queue with that prefix and permanently starves the remaining turns.
            const senderCalls = yield* Ref.make(0);
            const partialExit = yield* runAiMetricsOtlpExport(exportInput).pipe(
              provideScopedLayer(succeedingThenRejectingSpanSender(senderCalls)),
              Effect.exit
            );
            expect(Exit.isFailure(partialExit)).toBe(true);
            const afterPartialExport = yield* readAiMetricsOtlpSpanProjections;
            expect(afterPartialExport.turnIds.length, "partial checkpoint turn count").toBe(258);
            const remainingTurnSpanIds = spanIdsByName(afterPartialExport.projections, "ai_metrics.agent.turn");

            // The forwarder exports through runAiMetricsOtlpExport, which reads and
            // delivers as one unit, so that entry point must close the watermark itself.
            // With marking only in the standalone export command, nothing would ever be
            // marked and every forwarder run would re-emit the whole store.
            const delivered = yield* Ref.make<ReadonlyArray<ReadonlyArray<AiMetricsOtlpSpanProjection>>>([]);
            const exported = yield* runAiMetricsOtlpExport(exportInput).pipe(
              provideScopedLayer(recordingSpanSender(delivered))
            );
            expect(exported.turnSpanCount, "remaining export turn count").toBe(258);

            const afterSuccessfulExport = yield* readAiMetricsOtlpSpanProjections;
            expect(afterSuccessfulExport.turnIds).toEqual([]);
            expect(afterSuccessfulExport.projections).toEqual([]);

            // A second forwarder run over unchanged content therefore delivers nothing.
            const secondExport = yield* runAiMetricsOtlpExport(exportInput).pipe(
              provideScopedLayer(recordingSpanSender(delivered))
            );
            expect(secondExport.turnSpanCount).toBe(0);
            expect(secondExport.spanCount).toBe(0);

            // Exactly one delivery carried spans, and it carried the ids read before it.
            const deliveries = yield* Ref.get(delivered);
            expect(A.map(deliveries, (batch) => batch.length)).toEqual([512, 3]);
            expect(spanIdsByName(A.flatten(deliveries), "ai_metrics.agent.turn")).toEqual(remainingTurnSpanIds);

            // Marking is safe to call with an empty batch.
            yield* markAiMetricsOtlpTurnsExported([]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    }),
    AI_METRICS_LONG_TEST_TIMEOUT
  );

  it.effect(
    "records labels, benchmark results, and a weekly config-impact report without raw text",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          yield* makeGitRoot(repoRoot);
          const dataRoot = path.join(tmpDir, "metrics");
          const reportDir = path.join(dataRoot, "reports");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          const rawArchiveKey = Redacted.make(Encoding.encodeBase64(new Uint8Array(32).fill(17)));

          yield* writeText(
            path.join(homeDir, ".codex/sessions/codex.jsonl"),
            pipe(
              [
                '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}',
                '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","message":"private benchmark prompt"}',
              ],
              A.join("\n")
            )
          );
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "# Test agent guide\n");

          yield* Effect.gen(function* () {
            const forwarder = yield* runAiMetricsForwarder(
              AiMetricsForwarderInput.make({
                codexSessionsRoot: O.some(path.join(homeDir, ".codex/sessions")),
                dataRoot: O.some(dataRoot),
                hashSalt: O.some("test-salt"),
                homeDir,
                includeAll: true,
                rawArchiveKey,
                repoRoot,
                target: AiMetricsDeployTarget.Enum.local,
              })
            );
            const queue = yield* queueAiMetricsLabels(
              AiMetricsLabelQueueInput.make({
                limit: 10,
                target: AiMetricsDeployTarget.Enum.local,
                windowEndEpochMillis: 4_102_444_800_000,
                windowStartEpochMillis: 0,
              })
            );
            const firstTask = A.head(queue.items);
            expect(O.isSome(firstTask)).toBe(true);
            if (O.isNone(firstTask)) {
              return;
            }
            const label = yield* addAiMetricsOutcomeLabel(
              AiMetricsOutcomeLabelInput.make({
                agentTaskId: firstTask.value.agentTaskId,
                followUpFix: false,
                interventionCount: 1,
                note: O.some("OPENAI_API_KEY=secret-scorecard-fixture"),
                passed: true,
                qualityGate: AiMetricsQualityGateStatus.Enum.passed,
                rating: 5,
              })
            );
            const benchmarkCase = yield* upsertAiMetricsBenchmarkCase(
              AiMetricsBenchmarkCaseInput.make({
                benchmarkCaseId: "case-p4",
                expectedChecks: ["bun run check"],
                promptHash: "prompt-hash-only",
                promptRef: O.some("benchmarks/case-p4.md"),
                title: "P4 report proof",
              })
            );
            const benchmarkRun = yield* recordAiMetricsBenchmarkRun(
              AiMetricsBenchmarkRunInput.make({
                benchmarkCaseId: benchmarkCase.benchmarkCaseId,
                configSnapshotId: forwarder.configSnapshotId,
                elapsedMs: 1200,
                note: O.some("passed without raw prompt"),
                passed: true,
                qualityGate: AiMetricsQualityGateStatus.Enum.passed,
              })
            );
            const report = yield* generateAiMetricsWeeklyReport(
              AiMetricsWeeklyReportInput.make({
                reportDir,
                target: AiMetricsDeployTarget.Enum.local,
                windowEndEpochMillis: 4_102_444_800_000,
                windowStartEpochMillis: 0,
              })
            );
            const listedCases = yield* listAiMetricsBenchmarkCases;
            const reportJson = yield* fs.readFileString(report.jsonPath);
            const reportMarkdown = yield* fs.readFileString(report.markdownPath);

            expect(queue.items).toHaveLength(1);
            expect(O.getOrThrow(label.note)).toContain("[REDACTED]");
            expect(benchmarkRun.passed).toBe(true);
            expect(listedCases.cases).toHaveLength(1);
            expect(report.document.scores).toHaveLength(1);
            expect(report.document.scores[0]?.scorecard.completionReady).toBe(true);
            expect(reportJson).toContain(forwarder.configSnapshotId);
            expect(reportJson).not.toContain("private benchmark prompt");
            expect(reportJson).not.toContain("secret-scorecard-fixture");
            expect(reportJson).not.toContain(tmpDir);
            expect(reportMarkdown).toContain("AI Metrics Weekly Config-Impact Report");
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    }),
    AI_METRICS_LONG_TEST_TIMEOUT
  );

  it.effect(
    "resolves the dankserver install target",
    Effect.fn(function* () {
      const spec = yield* makeAiMetricsInstallSpec(
        AiMetricsInstallInput.make({
          defaultTool: AiMetricsTool.Enum.phoenix,
          hashSaltSecretRef: O.some("op://TBK/ai-metrics/hash-salt"),
          privacyMode: AiMetricsPrivacyMode.Enum.encrypted_raw_redacted_ui,
          rawArchiveKeySecretRef: O.some("op://TBK/ai-metrics/raw-archive-key"),
          target: AiMetricsDeployTarget.Enum.dankserver,
        })
      );

      expect(spec.stackName).toBe("beep-ai-metrics-dankserver");
      expect(spec.storage.dataRoot).toBe("/srv/data/ai-metrics");
      expect(spec.defaultScoreWeights.outcome).toBe(0.7);
      expect(
        pipe(
          spec.services,
          A.map((service) => service.tool)
        )
      ).toEqual(["langfuse", "phoenix", "opik"]);
      const phoenix = phoenixService(spec);
      expect(O.isSome(phoenix)).toBe(true);
      if (O.isNone(phoenix)) {
        return;
      }
      expect(phoenix.value.image).toBe("arizephoenix/phoenix:latest");
      expect(phoenix.value.otlp.traceUrl).toBe("https://dankserver.tailc7c348.ts.net:8447/v1/traces");
      expect(phoenix.value.publicUrl).toBe("https://dankserver.tailc7c348.ts.net:8447");
      expect(O.getOrThrow(spec.hashSaltSecretRef)).toBe("op://TBK/ai-metrics/hash-salt");
      expect(
        pipe(
          spec.plannedCommands,
          A.some(
            P.every([
              Str.includes("ai-metrics otlp export --target dankserver"),
              Str.includes("--data-root /srv/data/ai-metrics"),
              Str.includes("--otlp-base-url https://dankserver.tailc7c348.ts.net:8447"),
              Str.includes("--hash-salt-secret-ref 'op://TBK/ai-metrics/hash-salt'"),
              Str.includes("--raw-archive-key-secret-ref 'op://TBK/ai-metrics/raw-archive-key'"),
            ])
          )
        )
      ).toBe(true);
      expect(spec.plannedCommands).toEqual(
        expect.arrayContaining([
          expect.stringContaining("ai-metrics label queue --target dankserver --data-root /srv/data/ai-metrics"),
          expect.stringContaining("ai-metrics report weekly --target dankserver --data-root /srv/data/ai-metrics"),
        ])
      );
      // Every planned command an operator copy-pastes must survive the CLI's
      // absolute-path gate; `forwarder timer` rejects a relative root outright.
      expect(
        pipe(
          spec.plannedCommands,
          A.filter(Str.includes("--data-root")),
          A.filter(P.not(Str.includes("--data-root /")))
        )
      ).toEqual([]);
    })
  );

  it.effect(
    "builds typed P5a install plan, doctor, and dry-run apply contracts",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          const install = AiMetricsInstallInput.make({
            hashSaltSecretRef: O.some("op://TBK/ai-metrics/hash-salt"),
            rawArchiveKeySecretRef: O.some("op://TBK/ai-metrics/raw-archive-key"),
            target: AiMetricsDeployTarget.Enum.dankserver,
          });

          yield* writeText(
            path.join(homeDir, ".codex/sessions/2026/05/05/codex-session.jsonl"),
            '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}\n'
          );

          const discovery = yield* discoverAiMetricsSources(
            AiMetricsSourceDiscoveryInput.make({
              hashSalt: O.some("test-salt"),
              homeDir,
              includeAll: true,
              repoRoot,
              target: AiMetricsDeployTarget.Enum.local,
            })
          );
          const plan = yield* makeAiMetricsInstallPlan(install);
          const doctor = yield* makeAiMetricsInstallDoctorResult(
            AiMetricsInstallDoctorInput.make({
              install,
              sourceDiscovery: O.some(discovery),
            })
          );
          const apply = yield* makeAiMetricsInstallApplyDryRunResult(install);
          const planJson = yield* aiMetricsInstallPlanToJson(plan);
          const doctorJson = yield* aiMetricsInstallDoctorToJson(doctor);
          const applyJson = yield* aiMetricsInstallApplyDryRunToJson(apply);

          expect(plan.dryRunOnly).toBe(true);
          expect(plan.steps).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                command: "cd infra && pulumi preview --stack beep-ai-metrics-dankserver",
                stepId: "backend.phoenix.plan",
              }),
            ])
          );
          expect(doctor.status).toBe("warning");
          expect(doctor.availableSourceCount).toBe(1);
          expect(apply.dryRun).toBe(true);
          expect(planJson).toContain("backend.phoenix.plan");
          expect(doctorJson).toContain("sources.available");
          expect(applyJson).toContain("CLI install apply is dry-run-only");
          expect(planJson).not.toContain(tmpDir);
          expect(doctorJson).not.toContain(tmpDir);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "renders a workstation forwarder timer with lock, retry, status, and journal commands",
    Effect.fn(function* () {
      const plan = renderAiMetricsForwarderTimerPlan(
        AiMetricsForwarderTimerInput.make({
          command: [
            "/home/example/.bun/bin/bun",
            "run",
            "beep",
            "ai-metrics",
            "forwarder",
            "run",
            "--target",
            "dankserver",
            "--data-root",
            ".beep/ai-metrics",
            "--otlp",
            "--json",
          ],
          hashSaltSecretRef: O.some("op://TBK/ai-metrics/hash-salt"),
          intervalMinutes: 15,
          lockPath: "%t/beep-ai-metrics-forwarder.lock",
          rawArchiveKeySecretRef: O.some("op://TBK/ai-metrics/raw-archive-key"),
          statusPath: ".beep/ai-metrics/forwarder/status/latest.json",
          workingDirectory: "/repo/beep-effect",
        })
      );
      const json = yield* forwarderTimerPlanToJson(plan);

      expect(plan.serviceUnit).toContain("flock -n");
      expect(plan.serviceUnit).toContain('"status":"failed"');
      expect(plan.serviceUnit).toContain("json.dumps");
      expect(plan.serviceUnit).toContain('decode("utf-8","replace")');
      expect(plan.serviceUnit).toContain("pins the Bun executable path");
      expect(plan.serviceUnit).toContain("'/home/example/.bun/bin/bun'");
      expect(plan.serviceUnit).toMatch(/exit_code=0; > .*latest\.json\.stderr\.tmp.*; if flock -n/su);
      expect(plan.serviceUnit).not.toContain("sed 's/");
      expect(plan.serviceUnit).toContain("StartLimitBurst=3\nStartLimitIntervalSec=30m\n\n[Service]");
      expect(plan.serviceUnit).toContain("Restart=on-failure");
      expect(plan.timerUnit).toContain("OnUnitInactiveSec=15m");
      expect(plan.statusPath).toBe(".beep/ai-metrics/forwarder/status/latest.json");
      expect(plan.installCommands).toEqual(expect.arrayContaining([expect.stringContaining("journalctl --user")]));
      expect(plan.installCommands).toEqual(
        expect.arrayContaining([
          expect.stringContaining("beep-ai-metrics-forwarder.service"),
          expect.stringContaining("beep-ai-metrics-forwarder.timer"),
          expect.stringContaining("BEEP_AI_METRICS_HASH_SALT=%s"),
          expect.stringContaining("BEEP_AI_METRICS_RAW_ARCHIVE_KEY=%s"),
        ])
      );
      expect(json).not.toContain("base64-32-byte-key");
    })
  );

  it.effect(
    "sanitizes timer unit fields and shell-quotes command arguments",
    Effect.fn(function* () {
      const plan = renderAiMetricsForwarderTimerPlan(
        AiMetricsForwarderTimerInput.make({
          command: ["/bin/bun", "run", "beep", "--data-root", "/tmp/metrics; touch /tmp/pwn"],
          intervalMinutes: 15,
          lockPath: "%t/beep-ai-metrics-forwarder.lock",
          serviceName: "beep\nmalicious.service",
          statusPath: ".beep/ai-metrics/forwarder/status/latest.json",
          workingDirectory: "/repo/beep-effect\nEnvironment=OWNED=1",
        })
      );

      expect(plan.serviceUnitName).toBe("beep-malicious.service.service");
      expect(plan.timerUnitName).toBe("beep-malicious.service.timer");
      expect(plan.serviceUnit).toContain("WorkingDirectory=/repo/beep-effect Environment=OWNED=1");
      expect(plan.serviceUnit).not.toContain("\nEnvironment=OWNED=1");
      expect(plan.serviceUnit).toContain("--data-root");
      expect(plan.serviceUnit).toContain("/tmp/metrics; touch /tmp/pwn");
    })
  );

  it.effect(
    "rejects relative timer executable paths",
    Effect.fn(function* () {
      expectSchemaMakeToFail(
        () =>
          AiMetricsForwarderTimerInput.make({
            command: ["bun", "run", "beep"],
            lockPath: "%t/beep-ai-metrics-forwarder.lock",
            statusPath: ".beep/ai-metrics/forwarder/status/latest.json",
            workingDirectory: "/repo/beep-effect",
          }),
        "absolute executable path"
      );
    })
  );

  it.effect(
    "adds Phoenix OTLP contracts and renders a dedicated local compose file",
    Effect.fn(function* () {
      const spec = yield* makeAiMetricsInstallSpec(
        AiMetricsInstallInput.make({
          dataRoot: O.some("/srv/data/ai-metrics"),
        })
      );
      const phoenix = phoenixService(spec);
      expect(O.isSome(phoenix)).toBe(true);
      if (O.isNone(phoenix)) {
        return;
      }
      const compose = yield* renderAiMetricsLocalPhoenixCompose(spec);

      expect(phoenix.value.internalUrl).toBe("http://127.0.0.1:6006");
      expect(phoenix.value.otlp.traceUrl).toBe("http://127.0.0.1:6006/v1/traces");
      expect(phoenix.value.otlp.signalScope).toBe("traces_only");
      expect(compose).toBe(`name: beep-ai-metrics-local
services:
  ai-metrics-phoenix:
    container_name: beep-ai-metrics-phoenix
    environment:
      PHOENIX_WORKING_DIR: /data
    image: arizephoenix/phoenix:latest
    ports:
      - 127.0.0.1:6006:6006
    restart: unless-stopped
    volumes:
      - phoenix_data:/data
volumes:
  phoenix_data: {}
`);
    })
  );

  it.effect(
    "allows the Phoenix image to be overridden by the install input",
    Effect.fn(function* () {
      const spec = yield* makeAiMetricsInstallSpec(
        AiMetricsInstallInput.make({
          dataRoot: O.some("/srv/data/ai-metrics"),
          phoenixImage: "arizephoenix/phoenix:latest-p5b",
        })
      );
      const compose = yield* renderAiMetricsLocalPhoenixCompose(spec);

      const phoenix = phoenixService(spec);
      expect(O.isSome(phoenix)).toBe(true);
      if (O.isNone(phoenix)) {
        return;
      }
      expect(phoenix.value.image).toBe("arizephoenix/phoenix:latest-p5b");
      expect(compose).toContain("image: arizephoenix/phoenix:latest-p5b");
    })
  );

  it.effect(
    "projects derived DuckDB rows into redacted OpenInference metadata spans",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const dataRoot = path.join(tmpDir, "metrics");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          const sourcePath = path.join(tmpDir, "home/.claude/projects/repo/claude.jsonl");
          const content = pipe(
            [
              '{"type":"user","timestamp":"2026-05-05T10:00:00Z","message":{"content":"private-input"}}',
              '{"type":"assistant","timestamp":"2026-05-05T10:00:30Z","message":{"content":"private-model-output"}}',
              '{"type":"tool_result","timestamp":"2026-05-05T10:01:00Z","message":{"content":"private-output"}}',
            ],
            A.join("\n")
          );

          yield* writeText(path.join(tmpDir, "repo", "AGENTS.md"), "# Test agent guide\n");

          yield* Effect.gen(function* () {
            const summary = yield* summarizeTranscriptText({
              content,
              hashSalt: O.some("test-salt"),
              sourceKind: AiMetricsTranscriptSource.Enum.claude,
              sourcePath,
            });
            const privacy = yield* makeAiMetricsPrivacyCheckResult({
              content,
              hashSalt: O.some("test-salt"),
              sourcePath,
              summary,
            });
            const installSpec = yield* makeAiMetricsInstallSpec(
              AiMetricsInstallInput.make({
                dataRoot: O.some(dataRoot),
                target: AiMetricsDeployTarget.Enum.local,
              })
            );
            const configSnapshot = yield* makeAiMetricsConfigSnapshot(
              AiMetricsConfigSnapshotInput.make({
                repoRoot: path.join(tmpDir, "repo"),
              })
            );
            const record = AiMetricsDerivedTranscriptRecord.make({
              archiveObject: AiMetricsRawArchiveObject.make({
                algorithm: "AES-256-GCM",
                archiveObjectId: "raw-1111111111111111111111111111111111111111111111111111111111111111",
                archivePath: path.join(dataRoot, "raw/codex/raw-content-addressed-object.json"),
                created: true,
                encryptedAtEpochMillis: 1,
                plaintextContentHash: "2222222222222222222222222222222222222222222222222222222222222222",
                sourceKind: AiMetricsTranscriptSource.Enum.claude,
                sourcePathHash: summary.sourcePathHash,
              }),
              privacy,
            });
            yield* writeAiMetricsDerivedStorage(
              AiMetricsDerivedStorageWriteInput.make({
                configSnapshot: configSnapshot.snapshot,
                ingestRunId: "forwarder-otlp",
                records: [record],
                repoRootHash: "repo-root-hash",
                startedAtEpochMillis: 1,
                storage: installSpec.storage,
                target: AiMetricsDeployTarget.Enum.local,
              })
            );

            const phoenix = phoenixService(installSpec);
            expect(O.isSome(phoenix)).toBe(true);
            if (O.isNone(phoenix)) {
              return;
            }
            const input = AiMetricsOtlpExportInput.make({
              duckDbPath,
              endpoint: phoenix.value.otlp,
              target: AiMetricsDeployTarget.Enum.local,
            });
            const delivered = yield* Ref.make<ReadonlyArray<ReadonlyArray<AiMetricsOtlpSpanProjection>>>([]);
            const batch = yield* readAiMetricsOtlpSpanProjections;
            const result = yield* runAiMetricsOtlpExport(input).pipe(
              provideScopedLayer(recordingSpanSender(delivered))
            );
            const pipeableResult = yield* pipe(
              input,
              runAiMetricsOtlpProjectionBatchExport(batch),
              provideScopedLayer(recordingSpanSender(delivered))
            );
            const json = yield* otlpExportResultToJson(result);

            expect(batch.sessionSpanCount).toBe(1);
            expect(batch.turnSpanCount).toBe(3);
            expect(batch.projections).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  attributes: expect.objectContaining({
                    "ai_metrics.source_role": "primary",
                    "openinference.span.kind": "AGENT",
                  }),
                  spanName: "ai_metrics.agent.session",
                }),
                expect.objectContaining({
                  attributes: expect.objectContaining({
                    "ai_metrics.event_name": "assistant",
                    "openinference.span.kind": "LLM",
                  }),
                  spanName: "ai_metrics.agent.turn",
                }),
                expect.objectContaining({
                  attributes: expect.objectContaining({
                    "ai_metrics.event_name": "tool_result",
                    "ai_metrics.tool_name": "tool_result",
                    "openinference.span.kind": "TOOL",
                    "tool.name": "tool_result",
                  }),
                  spanName: "ai_metrics.agent.turn",
                }),
              ])
            );
            expect(result.spanCount).toBe(4);
            expect(pipeableResult).toEqual(result);
            // The result no longer carries an ingest run id -- the export drains every
            // pending turn regardless of which run committed it, so a run id would have
            // described the request rather than the batch. Counts are what it reports now.
            expect(json).toContain('"spanCount":4');
            expect(json).not.toContain("forwarder-otlp");
            expect(json).not.toContain("private-input");
            expect(json).not.toContain("private-model-output");
            expect(json).not.toContain("private-output");
            expect(json).not.toContain(tmpDir);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "rejects non-local install specs without a hash salt secret reference",
    Effect.fn(function* () {
      const error = yield* Effect.flip(
        makeAiMetricsInstallSpec(
          AiMetricsInstallInput.make({
            target: AiMetricsDeployTarget.Enum.dankserver,
          })
        )
      );

      expect(error.message).toContain("non-local installs require hashSaltSecretRef");
    })
  );

  it.effect(
    "rejects non-local forwarder runs without a resolved hash salt value",
    Effect.fn(function* () {
      const error = yield* Effect.flip(
        runAiMetricsForwarder(
          AiMetricsForwarderInput.make({
            dataRoot: O.some("/srv/data/ai-metrics"),
            hashSaltSecretRef: O.some("op://TBK/ai-metrics/hash-salt"),
            homeDir: "/tmp/home",
            rawArchiveKey: Redacted.make(Encoding.encodeBase64(new Uint8Array(32).fill(1))),
            rawArchiveKeySecretRef: O.some("op://TBK/ai-metrics/raw-archive-key"),
            repoRoot: "/tmp/repo",
            target: AiMetricsDeployTarget.Enum.dankserver,
          })
        ).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))))
      );

      expect(error.message).toContain("non-local forwarder runs require a resolved hash salt value");
    })
  );

  it.effect(
    "falls back unknown transcript type metadata to bounded event names",
    Effect.fn(function* () {
      const summary = yield* summarizeTranscriptText({
        content: '{"type":"sk-secretfixture","timestamp":"2026-05-05T10:00:00Z"}',
        hashSalt: O.some("test-salt"),
        sourceKind: AiMetricsTranscriptSource.Enum.codex,
        sourcePath: "codex.jsonl",
      });

      expect(summary.eventNames).toEqual(["event"]);
    })
  );

  it.effect(
    "builds a privacy proof without exposing raw prompt, output, path, or secret text",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const sourcePath = path.join(tmpDir, "codex-session.jsonl");
          const content = pipe(
            [
              '{"type":"user_message","timestamp":"2026-05-05T12:00:00Z","message":"please refactor the billing flow","OPENAI_API_KEY":"sk-secretfixture"}',
              '{"type":"assistant_message","timestamp":"2026-05-05T12:01:00Z","content":"done with private output"}',
            ],
            A.join("\n")
          );
          const summary = yield* summarizeTranscriptText({
            content,
            hashSalt: O.some("test-salt"),
            sourceKind: AiMetricsTranscriptSource.Enum.codex,
            sourcePath,
          });
          const result = yield* makeAiMetricsPrivacyCheckResult({
            content,
            hashSalt: O.some("test-salt"),
            sourcePath,
            summary,
          });
          const json = yield* privacyCheckToJson(result);

          expect(result.hashSaltStatus).toBe("provided");
          expect(result.redaction.safeForDerivedUi).toBe(false);
          expect(result.redaction.excludedRawTextFieldCount).toBeGreaterThan(0);
          expect(result.redaction.openAiKeyCount).toBe(1);
          expect(result.sanitized.rawEventEnvelopes).toHaveLength(2);
          expect(json).not.toContain("please refactor");
          expect(json).not.toContain("private output");
          expect(json).not.toContain("sk-secretfixture");
          expect(json).not.toContain(tmpDir);
          expect(json).not.toContain(sourcePath);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "preserves Codex subagent attribution as hashed derived metadata",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const dataRoot = path.join(tmpDir, "metrics");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          const sourcePath = path.join(tmpDir, "home/.codex/sessions/subagent.jsonl");
          const content = pipe(
            [
              '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z","payload":{"id":"child-session","source":{"subagent":{"thread_spawn":true,"parent_thread_id":"parent-thread","agent_role":"worker","agent_nickname":"worker-one"}}}}',
              '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z"}',
            ],
            A.join("\n")
          );

          yield* writeText(path.join(tmpDir, "repo", "AGENTS.md"), "# Test agent guide\n");

          yield* Effect.gen(function* () {
            const summary = yield* summarizeTranscriptText({
              content,
              hashSalt: O.some("test-salt"),
              sourceKind: AiMetricsTranscriptSource.Enum.codex,
              sourcePath,
            });
            const privacy = yield* makeAiMetricsPrivacyCheckResult({
              content,
              hashSalt: O.some("test-salt"),
              sourcePath,
              summary,
            });
            const installSpec = yield* makeAiMetricsInstallSpec(
              AiMetricsInstallInput.make({
                dataRoot: O.some(dataRoot),
                target: AiMetricsDeployTarget.Enum.local,
              })
            );
            const configSnapshot = yield* makeAiMetricsConfigSnapshot(
              AiMetricsConfigSnapshotInput.make({
                repoRoot: path.join(tmpDir, "repo"),
              })
            );

            expect(privacy.sanitized.sourceRole).toBe("subagent");
            expect(O.getOrThrow(privacy.sanitized.threadSpawn)).toBe(true);
            expect(privacy.sanitized.sessionIdHash).not.toBe("child-session");
            expect(privacy.sanitized.parentThreadIdHash).not.toBe("parent-thread");
            expect(privacy.sanitized.agentRoleHash).not.toBe("worker");
            expect(privacy.sanitized.rawEventEnvelopes[0]?.sourceRole).toBe("subagent");

            yield* writeAiMetricsDerivedStorage(
              AiMetricsDerivedStorageWriteInput.make({
                configSnapshot: configSnapshot.snapshot,
                ingestRunId: "forwarder-subagent",
                records: [
                  AiMetricsDerivedTranscriptRecord.make({
                    archiveObject: AiMetricsRawArchiveObject.make({
                      algorithm: "AES-256-GCM",
                      archiveObjectId: "raw-3333333333333333333333333333333333333333333333333333333333333333",
                      archivePath: path.join(dataRoot, "raw/codex/raw-subagent.json"),
                      created: false,
                      encryptedAtEpochMillis: 1,
                      plaintextContentHash: "4444444444444444444444444444444444444444444444444444444444444444",
                      sourceKind: AiMetricsTranscriptSource.Enum.codex,
                      sourcePathHash: summary.sourcePathHash,
                    }),
                    privacy,
                  }),
                ],
                repoRootHash: "repo-root-hash",
                startedAtEpochMillis: 1,
                storage: installSpec.storage,
                target: AiMetricsDeployTarget.Enum.local,
              })
            );

            const duckdb = yield* DuckDb;
            const sessionRows = yield* duckdb.query(
              `SELECT agent_nickname_hash AS agentNicknameHash,
                      parent_session_id_hash AS parentSessionIdHash,
                      parent_thread_id_hash AS parentThreadIdHash,
                      source_role AS sourceRole,
                      thread_spawn AS threadSpawn
                 FROM ai_metrics_sessions`
            );
            const turnRows = yield* duckdb.query("SELECT DISTINCT source_role AS sourceRole FROM ai_metrics_turns");

            expect(sessionRows).toEqual([
              expect.objectContaining({
                agentNicknameHash: O.getOrNull(privacy.sanitized.agentNicknameHash),
                parentSessionIdHash: null,
                parentThreadIdHash: O.getOrNull(privacy.sanitized.parentThreadIdHash),
                sourceRole: "subagent",
                threadSpawn: true,
              }),
            ]);
            expect(turnRows).toEqual([{ sourceRole: "subagent" }]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "backfills P6a readiness and source-role columns for existing DuckDB rows",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const duckDbPath = path.join(tmpDir, "ai-metrics.duckdb");

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* duckdb.run("CREATE TABLE ai_metrics_source_files (source_file_id VARCHAR PRIMARY KEY)");
            yield* duckdb.run("INSERT INTO ai_metrics_source_files (source_file_id) VALUES ('source-1')");
            yield* duckdb.run("CREATE TABLE ai_metrics_agent_tasks (agent_task_id VARCHAR PRIMARY KEY)");
            yield* duckdb.run("INSERT INTO ai_metrics_agent_tasks (agent_task_id) VALUES ('task-1')");
            yield* duckdb.run("CREATE TABLE ai_metrics_sessions (session_run_id VARCHAR PRIMARY KEY)");
            yield* duckdb.run("INSERT INTO ai_metrics_sessions (session_run_id) VALUES ('session-1')");
            yield* duckdb.run("CREATE TABLE ai_metrics_turns (turn_id VARCHAR PRIMARY KEY)");
            yield* duckdb.run("INSERT INTO ai_metrics_turns (turn_id) VALUES ('turn-1')");
            yield* duckdb.run("CREATE TABLE ai_metrics_scorecards (scorecard_id VARCHAR PRIMARY KEY)");
            yield* duckdb.run("INSERT INTO ai_metrics_scorecards (scorecard_id) VALUES ('scorecard-1')");

            yield* ensureAiMetricsDerivedStorage;

            const sourceRows = yield* duckdb.query(
              "SELECT source_role AS sourceRole FROM ai_metrics_source_files WHERE source_file_id = 'source-1'"
            );
            const scorecardRows = yield* duckdb.query(
              "SELECT completion_ready AS completionReady, coverage_gaps_json AS coverageGapsJson FROM ai_metrics_scorecards WHERE scorecard_id = 'scorecard-1'"
            );

            expect(sourceRows).toEqual([{ sourceRole: "primary" }]);
            expect(scorecardRows).toEqual([{ completionReady: false, coverageGapsJson: "[]" }]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "deduplicates legacy agent task ids during derived storage migration",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const duckDbPath = path.join(tmpDir, "ai-metrics.duckdb");

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            const legacyTaskId = `agent-task-${yield* hashPublicTextSha256("agent-task\u0000codex\u0000source-hash")}`;
            const currentTaskId = `agent-task-${yield* hashPublicTextSha256(
              "agent-task\u0000snapshot-1\u0000codex\u0000primary\u0000source-hash"
            )}`;
            yield* duckdb.run(
              `CREATE TABLE ai_metrics_agent_tasks (
                agent_task_id VARCHAR PRIMARY KEY,
                title VARCHAR NOT NULL,
                source_kind VARCHAR NOT NULL,
                source_path_hash VARCHAR NOT NULL,
                source_role VARCHAR NOT NULL,
                repo_root_hash VARCHAR NOT NULL,
                config_snapshot_id VARCHAR NOT NULL,
                created_at_epoch_ms DOUBLE NOT NULL,
                first_seen_at VARCHAR,
                last_seen_at VARCHAR
              )`
            );
            yield* duckdb.run(
              `INSERT INTO ai_metrics_agent_tasks (
                agent_task_id,
                title,
                source_kind,
                source_path_hash,
                source_role,
                repo_root_hash,
                config_snapshot_id,
                created_at_epoch_ms,
                first_seen_at,
                last_seen_at
              ) VALUES (
                $legacyTaskId,
                'legacy task',
                'codex',
                'source-hash',
                'primary',
                'repo-hash',
                'snapshot-1',
                1,
                NULL,
                NULL
              ), (
                $currentTaskId,
                'current task',
                'codex',
                'source-hash',
                'primary',
                'repo-hash',
                'snapshot-1',
                2,
                NULL,
                NULL
              )`,
              { currentTaskId, legacyTaskId }
            );
            yield* duckdb.run(
              "CREATE TABLE ai_metrics_sessions (agent_session_id VARCHAR PRIMARY KEY, agent_task_id VARCHAR)"
            );
            yield* duckdb.run(
              "INSERT INTO ai_metrics_sessions (agent_session_id, agent_task_id) VALUES ('session-legacy', $legacyTaskId)",
              { legacyTaskId }
            );
            yield* duckdb.run(
              `CREATE TABLE ai_metrics_outcome_labels (
                label_id VARCHAR PRIMARY KEY,
                agent_task_id VARCHAR NOT NULL,
                rating DOUBLE NOT NULL,
                passed BOOLEAN NOT NULL,
                quality_gate VARCHAR NOT NULL,
                intervention_count INTEGER NOT NULL,
                follow_up_fix BOOLEAN NOT NULL,
                labeled_at_epoch_ms DOUBLE NOT NULL
              )`
            );
            yield* duckdb.run(
              `INSERT INTO ai_metrics_outcome_labels (
                label_id,
                agent_task_id,
                rating,
                passed,
                quality_gate,
                intervention_count,
                follow_up_fix,
                labeled_at_epoch_ms
              ) VALUES (
                'label-legacy',
                $legacyTaskId,
                4,
                TRUE,
                'passed',
                0,
                FALSE,
                1
              )`,
              { legacyTaskId }
            );

            yield* ensureAiMetricsDerivedStorage;

            const taskRows = yield* duckdb.query(
              `SELECT agent_task_id AS "agentTaskId"
               FROM ai_metrics_agent_tasks
               ORDER BY agent_task_id`
            );
            const migrationRows = yield* duckdb.query(
              `SELECT migration_id AS "migrationId"
               FROM ai_metrics_schema_migrations
               WHERE migration_id = 'ai-metrics-agent-task-id-v2'`
            );
            const sessionRows = yield* duckdb.query(
              `SELECT agent_task_id AS "agentTaskId"
               FROM ai_metrics_sessions
               WHERE agent_session_id = 'session-legacy'`
            );
            const labelRows = yield* duckdb.query(
              `SELECT agent_task_id AS "agentTaskId"
               FROM ai_metrics_outcome_labels
               WHERE label_id = 'label-legacy'`
            );

            expect(taskRows).toEqual([{ agentTaskId: currentTaskId }]);
            expect(sessionRows).toEqual([{ agentTaskId: currentTaskId }]);
            expect(labelRows).toEqual([{ agentTaskId: currentTaskId }]);
            expect(migrationRows).toEqual([{ migrationId: "ai-metrics-agent-task-id-v2" }]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "backfills archive run object ids for upgraded derived stores",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const duckDbPath = path.join(tmpDir, "ai-metrics.duckdb");

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* duckdb.run(
              `CREATE TABLE ai_metrics_raw_archive_objects (
                archive_object_id VARCHAR PRIMARY KEY,
                ingest_run_id VARCHAR NOT NULL,
                source_kind VARCHAR NOT NULL,
                source_path_hash VARCHAR NOT NULL,
                plaintext_content_hash VARCHAR NOT NULL,
                archive_path VARCHAR NOT NULL,
                algorithm VARCHAR NOT NULL,
                encrypted_at_epoch_ms DOUBLE NOT NULL
              )`
            );
            yield* duckdb.run(
              `INSERT INTO ai_metrics_raw_archive_objects (
                archive_object_id,
                ingest_run_id,
                source_kind,
                source_path_hash,
                plaintext_content_hash,
                archive_path,
                algorithm,
                encrypted_at_epoch_ms
              ) VALUES (
                'archive-object-legacy',
                'ingest-1',
                'codex',
                'source-hash',
                'plaintext-hash',
                '/tmp/archive.json',
                'AES-256-GCM',
                1
              )`
            );

            yield* ensureAiMetricsDerivedStorage;

            const archiveRows = yield* duckdb.query(
              `SELECT archive_run_object_id AS "archiveRunObjectId"
               FROM ai_metrics_raw_archive_objects
               WHERE archive_object_id = 'archive-object-legacy'`
            );

            expect(archiveRows).toEqual([
              {
                archiveRunObjectId: `archive-object-${yield* hashPublicTextSha256(
                  "archive-object\u0000ingest-1\u0000archive-object-legacy"
                )}`,
              },
            ]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "backfills the OTLP export watermark without burying the last turn-bearing run",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const duckDbPath = path.join(tmpDir, "ai-metrics.duckdb");

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            // A store written under the old duplicating scheme: turns carry no watermark
            // column at all, so the column migration adds it as NULL and the backfill runs.
            yield* duckdb.run(
              `CREATE TABLE ai_metrics_turns (
                turn_id VARCHAR PRIMARY KEY,
                ingest_run_id VARCHAR NOT NULL,
                agent_session_id VARCHAR NOT NULL,
                source_kind VARCHAR NOT NULL,
                source_path_hash VARCHAR NOT NULL,
                source_role VARCHAR NOT NULL,
                line_number INTEGER NOT NULL,
                event_name VARCHAR NOT NULL,
                raw_event_hash VARCHAR NOT NULL,
                timestamp VARCHAR
              )`
            );
            yield* duckdb.run(
              `CREATE TABLE ai_metrics_ingest_runs (
                ingest_run_id VARCHAR PRIMARY KEY,
                target VARCHAR NOT NULL,
                config_snapshot_id VARCHAR NOT NULL,
                config_hash VARCHAR NOT NULL,
                started_at_epoch_ms DOUBLE NOT NULL,
                completed_at_epoch_ms DOUBLE NOT NULL,
                source_file_count INTEGER NOT NULL,
                archive_object_count INTEGER NOT NULL,
                turn_count INTEGER NOT NULL
              )`
            );
            yield* Effect.forEach(
              [
                { ingestRunId: "run-old", startedAt: 1 },
                { ingestRunId: "run-last-with-turns", startedAt: 2 },
                // A discovery pass that found nothing new. It is the newest run, but it
                // committed no turns, so it must not shadow run-last-with-turns.
                { ingestRunId: "run-empty-latest", startedAt: 3 },
              ],
              Effect.fnUntraced(function* (run) {
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_ingest_runs VALUES (
                     $ingestRunId, 'local', 'snapshot', 'hash', $startedAt, $startedAt, 0, 0, 0
                   )`,
                  run
                );
              }),
              { discard: true }
            );
            yield* Effect.forEach(
              [
                { ingestRunId: "run-old", turnId: "turn-old" },
                { ingestRunId: "run-last-with-turns", turnId: "turn-at-risk" },
              ],
              Effect.fnUntraced(function* (turn) {
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_turns VALUES (
                     $turnId, $ingestRunId, 'session-1', 'codex', 'source-hash', 'primary', 1, 'event', 'raw-hash', NULL
                   )`,
                  turn
                );
              }),
              { discard: true }
            );

            yield* ensureAiMetricsDerivedStorage;

            const watermarks = yield* duckdb.query(
              `SELECT turn_id AS "turnId", otlp_exported_at_epoch_ms AS "exportedAt"
               FROM ai_metrics_turns
               ORDER BY turn_id`
            );

            // run-old was rescued under the old scheme by the runs that followed it, so
            // marking it costs nothing. run-last-with-turns had no such rescue -- if it
            // died before exporting, nothing came after it -- so its turns stay pending.
            // v1 buries it, because run-empty-latest shadows it; v2 reopens it. The net
            // effect on a fresh store is the corrected behaviour.
            expect(watermarks).toEqual([
              { exportedAt: null, turnId: "turn-at-risk" },
              { exportedAt: 0, turnId: "turn-old" },
            ]);

            const migrationRows = yield* duckdb.query(
              `SELECT migration_id AS "migrationId"
               FROM ai_metrics_schema_migrations
               WHERE migration_id LIKE 'ai-metrics-otlp-export-watermark-%'
               ORDER BY migration_id`
            );
            expect(migrationRows).toEqual([
              { migrationId: "ai-metrics-otlp-export-watermark-v1" },
              { migrationId: "ai-metrics-otlp-export-watermark-v2" },
            ]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "delivers projections to a real OTLP endpoint as chunked protobuf",
    Effect.fn(function* () {
      yield* Effect.acquireUseRelease(
        Effect.sync(() => {
          const requests: Array<{
            readonly body: string;
            readonly contentType: string;
          }> = [];
          const server = Bun.serve({
            // Continuation-passing rather than `async`/`await`: this repo represents async
            // control flow with Effect, and a bare `async function` here trips the
            // check:tsgo:tests Effect diagnostic. `Bun.serve` accepts a `Promise<Response>`
            // either way. Body is captured as latin1 so protobuf's length-delimited string
            // fields stay byte-addressable for the resource assertion below.
            fetch: (request) =>
              request.arrayBuffer().then((buffer) => {
                A.appendInPlace(requests, {
                  body: Buffer.from(buffer).toString("latin1"),
                  contentType: request.headers.get("content-type") ?? "",
                });
                const rejecting = Str.includes("reject")(new URL(request.url).pathname);
                return new Response(null, { status: rejecting ? 415 : 200 });
              }),
            hostname: "127.0.0.1",
            port: 0,
          });
          return { requests, server };
        }),
        Effect.fnUntraced(function* ({ requests, server }) {
          const endpointFor = (path: string) =>
            AiMetricsOtlpEndpointSpec.make({
              baseUrl: `http://127.0.0.1:${server.port}`,
              protocol: "http/protobuf",
              resourceAttributes: { "beep.test": "otlp-wire" },
              signalScope: "traces_only",
              traceUrl: `http://127.0.0.1:${server.port}${path}`,
            });
          const inputFor = (path: string) =>
            AiMetricsOtlpExportInput.make({
              duckDbPath: "unused.duckdb",
              endpoint: endpointFor(path),
              target: AiMetricsDeployTarget.Enum.local,
            });
          // 1200 spans crosses the 512-span chunk boundary twice. A drain can carry tens of
          // thousands of turns, and one request that large is the backpressure collapse this
          // work exists to prevent -- the retired BatchSpanProcessor used to chunk for us.
          const projections = A.makeBy(1200, (index) =>
            AiMetricsOtlpSpanProjection.make({
              attributes: {
                "ai_metrics.line_number": index + 1,
                "openinference.span.kind": "CHAIN",
              },
              parentSpanId: O.some("aabbccddeeff0011"),
              spanId: Str.padStart(16, "0")(globalThis.String(index + 1)),
              spanName: "ai_metrics.agent.turn",
              traceId: "0123456789abcdef0123456789abcdef",
            })
          );
          const batch = AiMetricsOtlpSpanProjectionBatch.make({
            projections,
            sessionSpanCount: 0,
            turnIds: [],
            turnSpanCount: projections.length,
          });

          // The live sender, not a stub: real ReadableSpan construction through the real
          // protobuf exporter. Protobuf is not a preference -- Phoenix answers OTLP/JSON
          // with HTTP 415, which is also what the rejection path below asserts.
          const exported = yield* runAiMetricsOtlpProjectionBatchExport(inputFor("/v1/traces"), batch).pipe(
            provideScopedLayer(AiMetricsOtlpSpanSender.layer)
          );

          expect(exported.spanCount).toBe(1200);
          expect(requests.length).toBe(3);
          expect(A.every(requests, (request) => request.contentType === "application/x-protobuf")).toBe(true);

          // Phoenix routes spans into a project by this resource attribute. Without it every
          // writer lands in `default` together, which is why AGENT_EFFECTIVENESS_PHOENIX_PROJECT
          // named a project that never existed. Asserted on the wire, and pinned to the constant
          // the reader queries for, so the two cannot drift apart silently.
          expect(AGENT_EFFECTIVENESS_PHOENIX_PROJECT).toBe("beep-agent-effectiveness");
          expect(
            A.every(
              requests,
              (request) =>
                Str.includes("openinference.project.name")(request.body) &&
                Str.includes(AGENT_EFFECTIVENESS_PHOENIX_PROJECT)(request.body)
            )
          ).toBe(true);

          const retryCalls = yield* Ref.make(0);
          const retryFiber = yield* runAiMetricsOtlpProjectionBatchExport(
            inputFor("/v1/traces"),
            AiMetricsOtlpSpanProjectionBatch.make({
              projections: A.take(projections, 1),
              sessionSpanCount: 0,
              turnIds: [],
              turnSpanCount: 1,
            })
          ).pipe(provideScopedLayer(retryableThenSucceedingSpanSender(retryCalls)), Effect.forkChild);
          yield* TestClock.adjust("2 seconds");
          const retried = yield* Fiber.join(retryFiber);

          expect(retried.spanCount).toBe(1);
          expect(yield* Ref.get(retryCalls)).toBe(2);

          // A collector that rejects the batch must surface as a typed failure, never a
          // silent success. That confirmation is the whole reason delivery moved off
          // fire-and-forget span emission.
          const rejected = yield* runAiMetricsOtlpProjectionBatchExport(inputFor("/v1/traces-reject"), batch).pipe(
            provideScopedLayer(AiMetricsOtlpSpanSender.layer),
            Effect.flip
          );

          expect(rejected.message).toContain("did not accept the exported spans");
        }),
        ({ server }) => Effect.promise(() => server.stop(true))
      );
    }),
    AI_METRICS_LONG_TEST_TIMEOUT
  );

  it.effect(
    "keeps a session row whose turns outlive the run that last touched it",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const dataRoot = path.join(tmpDir, "metrics");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          yield* fs.makeDirectory(path.dirname(duckDbPath), {
            recursive: true,
          });

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* ensureAiMetricsDerivedStorage;

            // A content-addressed session row carries the run that LAST wrote it, which is
            // not necessarily the newest run: an out-of-order ingest (a backfill, or clock
            // skew between hosts) can leave an early-completing run as the last writer.
            // Once that happens, "this session belongs to that run" stops being true, and
            // pruning by run id alone would delete the row while its other turns live on.
            yield* Effect.forEach(
              [
                { completedAt: 100, ingestRunId: "run-late" },
                { completedAt: 1, ingestRunId: "run-early" },
              ],
              Effect.fnUntraced(function* (run) {
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_ingest_runs VALUES (
                     $ingestRunId, 'local', 'snapshot', 'hash', $completedAt, $completedAt, 0, 0, 1
                   )`,
                  run
                );
              }),
              { discard: true }
            );
            yield* duckdb.run(
              `INSERT INTO ai_metrics_sessions (
                 agent_session_id, ingest_run_id, source_kind, source_path_hash, source_role, config_snapshot_id
               ) VALUES ('session-shared', 'run-early', 'codex', 'shared-transcript', 'primary', 'snapshot')`
            );
            yield* Effect.forEach(
              [
                {
                  ingestRunId: "run-early",
                  lineNumber: 1,
                  turnId: "turn-early",
                },
                { ingestRunId: "run-late", lineNumber: 2, turnId: "turn-late" },
              ],
              Effect.fnUntraced(function* (turn) {
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_turns (
                     turn_id, ingest_run_id, agent_session_id, source_kind, source_path_hash,
                     source_role, line_number, event_name, raw_event_hash, timestamp
                   ) VALUES (
                     $turnId, $ingestRunId, 'session-shared', 'codex', 'shared-transcript',
                     'primary', $lineNumber, 'event', $turnId, NULL
                   )`,
                  turn
                );
              }),
              { discard: true }
            );
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));

          // Prune only run-early.
          yield* runAiMetricsRetentionDelete(
            AiMetricsRetentionSelector.make({
              beforeEpochMillis: O.some(50),
              dataRoot,
            }),
            false
          );

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            const sessions = yield* duckdb.query(
              `SELECT agent_session_id AS "agentSessionId" FROM ai_metrics_sessions`
            );
            const turns = yield* duckdb.query(`SELECT turn_id AS "turnId" FROM ai_metrics_turns ORDER BY turn_id`);

            // turn-late survives the prune, so its session must survive with it. The
            // exporter joins ai_metrics_sessions INNER: drop the row and turn-late leaves
            // every future export silently, with its watermark still open forever.
            expect(turns).toEqual([{ turnId: "turn-late" }]);
            expect(sessions).toEqual([{ agentSessionId: "session-shared" }]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));

          // ...and the row must not then leak. It is still tagged with run-early, which is
          // already gone, so a prune scoped to the current run set would never match it
          // again once its last turn goes -- an empty session row surviving forever and
          // pinning its agent task alive through the task GC.
          yield* runAiMetricsRetentionDelete(
            AiMetricsRetentionSelector.make({
              beforeEpochMillis: O.some(200),
              dataRoot,
            }),
            false
          );

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            const turns = yield* duckdb.query(`SELECT turn_id AS "turnId" FROM ai_metrics_turns`);
            const sessions = yield* duckdb.query(
              `SELECT agent_session_id AS "agentSessionId" FROM ai_metrics_sessions`
            );

            expect(turns).toEqual([]);
            expect(sessions).toEqual([]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "collapses a legacy session row onto one that already carries the content id",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const duckDbPath = path.join(tmpDir, "ai-metrics.duckdb");

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* ensureAiMetricsDerivedStorage;

            const contentSessionId = yield* hashPublicTextSha256("session\u0000codex\u0000mixed-transcript").pipe(
              Effect.map((digest) => `session-${digest}`)
            );
            const legacySessionId = yield* hashPublicTextSha256(
              "session\u0000run-old\u0000codex\u0000mixed-transcript"
            ).pipe(Effect.map((digest) => `session-${digest}`));

            // A store caught mid-transition: one row already minted under the new content
            // key by a post-upgrade ingest, and one still holding the old per-run key. The
            // migration's other collision branch -- legacy sibling versus legacy sibling --
            // never reaches this shape, and getting it wrong violates the primary key.
            yield* Effect.forEach(
              [
                {
                  agentSessionId: contentSessionId,
                  ingestRunId: "run-new",
                  turnId: "turn-new",
                },
                {
                  agentSessionId: legacySessionId,
                  ingestRunId: "run-old",
                  turnId: "turn-old",
                },
              ],
              Effect.fnUntraced(function* (row) {
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_sessions (
                     agent_session_id, ingest_run_id, source_kind, source_path_hash, source_role, config_snapshot_id
                   ) VALUES ($agentSessionId, $ingestRunId, 'codex', 'mixed-transcript', 'primary', 'snapshot')`,
                  {
                    agentSessionId: row.agentSessionId,
                    ingestRunId: row.ingestRunId,
                  }
                );
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_turns (
                     turn_id, ingest_run_id, agent_session_id, source_kind, source_path_hash,
                     source_role, line_number, event_name, raw_event_hash, timestamp
                   ) VALUES (
                     $turnId, $ingestRunId, $agentSessionId, 'codex', 'mixed-transcript',
                     'primary', 1, 'event', $turnId, NULL
                   )`,
                  row
                );
              }),
              { discard: true }
            );
            yield* duckdb.run(
              `DELETE FROM ai_metrics_schema_migrations
               WHERE migration_id = 'ai-metrics-agent-session-id-v2'`
            );

            yield* ensureAiMetricsDerivedStorage;

            const sessions = yield* duckdb.query(
              `SELECT agent_session_id AS "agentSessionId" FROM ai_metrics_sessions`
            );
            const turns = yield* duckdb.query(
              `SELECT turn_id AS "turnId", agent_session_id AS "agentSessionId"
               FROM ai_metrics_turns ORDER BY turn_id`
            );

            // The legacy row loses to the row that already holds the content id, and its
            // turn follows -- no primary-key violation, and nothing orphaned behind the
            // exporter's INNER join.
            expect(sessions).toEqual([{ agentSessionId: contentSessionId }]);
            expect(turns).toEqual([
              { agentSessionId: contentSessionId, turnId: "turn-new" },
              { agentSessionId: contentSessionId, turnId: "turn-old" },
            ]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "collapses per-run session rows and repoints their turns",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const duckDbPath = path.join(tmpDir, "ai-metrics.duckdb");

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* ensureAiMetricsDerivedStorage;

            // Ids exactly as the previous release minted them: rowId("session", [runId,
            // kind, pathHash]) => `session-${sha256("session\0<parts joined by \0>")}`.
            const legacySessionId = (ingestRunId: string) =>
              hashPublicTextSha256(`session\u0000${ingestRunId}\u0000codex\u0000grown-transcript`).pipe(
                Effect.map((digest) => `session-${digest}`)
              );
            const expectedSessionId = yield* hashPublicTextSha256("session\u0000codex\u0000grown-transcript").pipe(
              Effect.map((digest) => `session-${digest}`)
            );

            // One transcript, ingested across three runs as it grew. Turns are INSERT OR
            // IGNORE, so each turn froze onto whichever run first saw its line.
            yield* Effect.forEach(
              [
                { ingestRunId: "run-1", lineNumber: 1, turnId: "turn-1" },
                { ingestRunId: "run-2", lineNumber: 2, turnId: "turn-2" },
                { ingestRunId: "run-3", lineNumber: 3, turnId: "turn-3" },
              ],
              Effect.fnUntraced(function* (row) {
                const agentSessionId = yield* legacySessionId(row.ingestRunId);
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_sessions (
                     agent_session_id, ingest_run_id, source_kind, source_path_hash, source_role, config_snapshot_id
                   ) VALUES ($agentSessionId, $ingestRunId, 'codex', 'grown-transcript', 'primary', 'snapshot')`,
                  { agentSessionId, ingestRunId: row.ingestRunId }
                );
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_turns (
                     turn_id, ingest_run_id, agent_session_id, source_kind, source_path_hash,
                     source_role, line_number, event_name, raw_event_hash, timestamp
                   ) VALUES (
                     $turnId, $ingestRunId, $agentSessionId, 'codex', 'grown-transcript',
                     'primary', $lineNumber, 'event', $turnId, NULL
                   )`,
                  {
                    agentSessionId,
                    ingestRunId: row.ingestRunId,
                    lineNumber: row.lineNumber,
                    turnId: row.turnId,
                  }
                );
              }),
              { discard: true }
            );
            // A different transcript must be left alone.
            yield* duckdb.run(
              `INSERT INTO ai_metrics_sessions (
                 agent_session_id, ingest_run_id, source_kind, source_path_hash, source_role, config_snapshot_id
               ) VALUES ('session-untouched', 'run-1', 'claude', 'other-transcript', 'primary', 'snapshot')`
            );
            yield* duckdb.run(
              `DELETE FROM ai_metrics_schema_migrations
               WHERE migration_id = 'ai-metrics-agent-session-id-v2'`
            );

            yield* ensureAiMetricsDerivedStorage;

            const sessions = yield* duckdb.query(
              `SELECT agent_session_id AS "agentSessionId" FROM ai_metrics_sessions ORDER BY agent_session_id`
            );
            const turns = yield* duckdb.query(
              `SELECT turn_id AS "turnId", agent_session_id AS "agentSessionId"
               FROM ai_metrics_turns ORDER BY turn_id`
            );

            // Three rows collapse to one, and every turn follows it. Repointing the turns
            // before deleting the losers is what keeps them reachable: the exporter joins
            // ai_metrics_sessions INNER, so an orphaned turn is dropped silently forever.
            expect(sessions).toEqual([{ agentSessionId: expectedSessionId }, { agentSessionId: "session-untouched" }]);
            expect(turns).toEqual([
              { agentSessionId: expectedSessionId, turnId: "turn-1" },
              { agentSessionId: expectedSessionId, turnId: "turn-2" },
              { agentSessionId: expectedSessionId, turnId: "turn-3" },
            ]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "reopens turns a store already buried under the shipped watermark backfill",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const duckDbPath = path.join(tmpDir, "ai-metrics.duckdb");

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* ensureAiMetricsDerivedStorage;

            // A store that already ran the watermark backfill as it shipped, and was left
            // holding the bug: the newest turn-bearing run was marked because a zero-turn
            // discovery pass shadowed it. The ledger records migration ids, not their SQL,
            // so rewriting v1 in place could never reach this store -- only a new id can.
            yield* Effect.forEach(
              [
                { ingestRunId: "run-old", startedAt: 1 },
                { ingestRunId: "run-last-with-turns", startedAt: 2 },
                { ingestRunId: "run-empty-latest", startedAt: 3 },
              ],
              Effect.fnUntraced(function* (run) {
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_ingest_runs VALUES (
                     $ingestRunId, 'local', 'snapshot', 'hash', $startedAt, $startedAt, 0, 0, 0
                   )`,
                  run
                );
              }),
              { discard: true }
            );
            // Both already marked with the backfill sentinel, exactly as the shipped v1
            // would have left them.
            yield* Effect.forEach(
              [
                { ingestRunId: "run-old", turnId: "turn-old" },
                { ingestRunId: "run-last-with-turns", turnId: "turn-buried" },
              ],
              Effect.fnUntraced(function* (turn) {
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_turns (
                     turn_id, ingest_run_id, agent_session_id, source_kind, source_path_hash,
                     source_role, line_number, event_name, raw_event_hash, timestamp,
                     otlp_exported_at_epoch_ms
                   ) VALUES (
                     $turnId, $ingestRunId, 'session-1', 'codex', 'source-hash',
                     'primary', 1, 'event', $turnId, NULL, 0
                   )`,
                  turn
                );
              }),
              { discard: true }
            );
            // v1 stays on the ledger and v2 comes off it: a store upgraded from the
            // release that shipped v1 alone. v1 is skipped by id from here on no matter
            // what its SQL says, which is the whole reason a second migration is needed.
            yield* duckdb.run(
              `DELETE FROM ai_metrics_schema_migrations
               WHERE migration_id = 'ai-metrics-otlp-export-watermark-v2'`
            );
            const beforeUpgrade = yield* duckdb.query(
              `SELECT migration_id AS "migrationId"
               FROM ai_metrics_schema_migrations
               WHERE migration_id LIKE 'ai-metrics-otlp-export-watermark-%'`
            );
            expect(beforeUpgrade).toEqual([{ migrationId: "ai-metrics-otlp-export-watermark-v1" }]);

            yield* ensureAiMetricsDerivedStorage;

            const watermarks = yield* duckdb.query(
              `SELECT turn_id AS "turnId", otlp_exported_at_epoch_ms AS "exportedAt"
               FROM ai_metrics_turns
               ORDER BY turn_id`
            );

            // v2 reopens only the newest backfilled run. run-old stays marked: it was
            // rescued under the old duplicating scheme, so its content did reach Phoenix.
            expect(watermarks).toEqual([
              { exportedAt: null, turnId: "turn-buried" },
              { exportedAt: 0, turnId: "turn-old" },
            ]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "exports from a store that predates the watermark column without an intervening ingest",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const duckDbPath = path.join(tmpDir, "ai-metrics.duckdb");

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            // `ai_metrics_turns` as written by the previous release: no
            // `otlp_exported_at_epoch_ms`. The export query filters on that column, so
            // the standalone `ai-metrics otlp export` command has to migrate the store
            // itself -- the forwarder only migrates as a side effect of ingesting.
            yield* duckdb.run(
              `CREATE TABLE ai_metrics_turns (
                turn_id VARCHAR PRIMARY KEY,
                ingest_run_id VARCHAR NOT NULL,
                agent_session_id VARCHAR NOT NULL,
                source_kind VARCHAR NOT NULL,
                source_path_hash VARCHAR NOT NULL,
                source_role VARCHAR NOT NULL,
                line_number INTEGER NOT NULL,
                event_name VARCHAR NOT NULL,
                raw_event_hash VARCHAR NOT NULL,
                timestamp VARCHAR
              )`
            );
            yield* duckdb.run(
              `INSERT INTO ai_metrics_turns VALUES (
                'turn-pending', 'run-1', 'session-1', 'codex', 'source-hash', 'primary', 1, 'event', 'raw-hash', NULL
              )`
            );
            yield* ensureAiMetricsDerivedStorage;
            yield* duckdb.run(
              `INSERT INTO ai_metrics_ingest_runs VALUES (
                'run-1', 'local', 'snapshot', 'hash', 1, 1, 0, 0, 1
              )`
            );
            yield* duckdb.run(
              `INSERT INTO ai_metrics_sessions (
                agent_session_id, ingest_run_id, source_kind, source_path_hash, source_role, config_snapshot_id
              ) VALUES ('session-1', 'run-1', 'codex', 'source-hash', 'primary', 'snapshot')`
            );
            // Re-open on a store whose turns column set is current but whose watermark is
            // still NULL, then drop the column again to reproduce the true legacy shape.
            yield* duckdb.run("ALTER TABLE ai_metrics_turns DROP COLUMN otlp_exported_at_epoch_ms");
            yield* duckdb.run("DELETE FROM ai_metrics_schema_migrations");

            const installSpec = yield* makeAiMetricsInstallSpec(
              AiMetricsInstallInput.make({
                dataRoot: O.some(path.join(tmpDir, "metrics")),
                target: AiMetricsDeployTarget.Enum.local,
              })
            );
            const phoenix = phoenixService(installSpec);
            expect(O.isSome(phoenix)).toBe(true);
            if (O.isNone(phoenix)) {
              return;
            }

            const delivered = yield* Ref.make<ReadonlyArray<ReadonlyArray<AiMetricsOtlpSpanProjection>>>([]);
            const exported = yield* runAiMetricsOtlpExport(
              AiMetricsOtlpExportInput.make({
                duckDbPath,
                endpoint: phoenix.value.otlp,
                target: AiMetricsDeployTarget.Enum.local,
              })
            ).pipe(provideScopedLayer(recordingSpanSender(delivered)));

            expect(exported.turnSpanCount).toBe(1);
            expect(exported.sessionSpanCount).toBe(1);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "keeps one transcript on one trace across ingest runs",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const duckDbPath = path.join(tmpDir, "ai-metrics.duckdb");

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            // Schema first, so the one-time watermark backfill is already recorded and
            // the rows inserted below stay pending.
            yield* ensureAiMetricsDerivedStorage;

            // One transcript, ingested twice as it grew. `agent_session_id` embeds the
            // ingest run, so the same file owns two session rows -- the exact shape that
            // fragmented a session into one trace per run when identity was seeded from
            // that column.
            yield* Effect.forEach(
              [
                {
                  agentSessionId: "session-run-1",
                  ingestRunId: "run-1",
                  lineNumber: 1,
                  turnId: "turn-1",
                },
                {
                  agentSessionId: "session-run-2",
                  ingestRunId: "run-2",
                  lineNumber: 2,
                  turnId: "turn-2",
                },
              ],
              Effect.fnUntraced(function* (row) {
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_ingest_runs VALUES (
                     $ingestRunId, 'local', 'snapshot', 'hash', $lineNumber, $lineNumber, 0, 0, 1
                   )`,
                  { ingestRunId: row.ingestRunId, lineNumber: row.lineNumber }
                );
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_sessions (
                     agent_session_id, ingest_run_id, source_kind, source_path_hash, source_role, config_snapshot_id
                   ) VALUES ($agentSessionId, $ingestRunId, 'codex', 'same-transcript-hash', 'primary', 'snapshot')`,
                  {
                    agentSessionId: row.agentSessionId,
                    ingestRunId: row.ingestRunId,
                  }
                );
                yield* duckdb.run(
                  `INSERT INTO ai_metrics_turns (
                     turn_id, ingest_run_id, agent_session_id, source_kind, source_path_hash,
                     source_role, line_number, event_name, raw_event_hash, timestamp
                   ) VALUES (
                     $turnId, $ingestRunId, $agentSessionId, 'codex', 'same-transcript-hash',
                     'primary', $lineNumber, 'event', $turnId, NULL
                   )`,
                  row
                );
              }),
              { discard: true }
            );

            const installSpec = yield* makeAiMetricsInstallSpec(
              AiMetricsInstallInput.make({
                dataRoot: O.some(path.join(tmpDir, "metrics")),
                target: AiMetricsDeployTarget.Enum.local,
              })
            );
            const phoenix = phoenixService(installSpec);
            expect(O.isSome(phoenix)).toBe(true);
            if (O.isNone(phoenix)) {
              return;
            }

            const batch = yield* readAiMetricsOtlpSpanProjections;

            // Both turns land on one trace under one session span, even though they were
            // ingested under different runs and carry different `agent_session_id`s.
            const traceIds = pipe(
              batch.projections,
              A.map((projection) => projection.traceId),
              A.dedupe
            );
            expect(traceIds.length).toBe(1);
            expect(batch.turnSpanCount).toBe(2);

            // And exactly one session span. Emitting one per session row would put two
            // spans carrying the same content-addressed span id in a single OTLP request.
            expect(batch.sessionSpanCount).toBe(1);
            const sessionSpanIds = spanIdsByName(batch.projections, "ai_metrics.agent.session");
            expect(sessionSpanIds.length).toBe(1);
            const turnParents = pipe(
              batch.projections,
              A.filter((projection) => projection.spanName === "ai_metrics.agent.turn"),
              A.map((projection) => O.getOrThrow(projection.parentSpanId)),
              A.dedupe
            );
            expect(turnParents).toEqual(sessionSpanIds);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "reports derived UI as safe when secret-shaped values are absent",
    Effect.fn(function* () {
      const content = '{"type":"session_meta","timestamp":"2026-05-05T12:00:00Z"}';
      const summary = yield* summarizeTranscriptText({
        content,
        hashSalt: O.some("test-salt"),
        sourceKind: AiMetricsTranscriptSource.Enum.codex,
        sourcePath: "codex.jsonl",
      });
      const result = yield* makeAiMetricsPrivacyCheckResult({
        content,
        hashSalt: O.some("test-salt"),
        sourcePath: "codex.jsonl",
        summary,
      });

      expect(result.redaction.safeForDerivedUi).toBe(true);
    })
  );

  it.effect(
    "snapshots repo-owned agent config while excluding vendored and generated roots",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          yield* writeText(path.join(tmpDir, ".codex/config.toml"), 'model = "gpt-5"\n');
          yield* writeText(path.join(tmpDir, ".claude/settings.json"), '{"hooks":[]}\n');
          yield* writeText(path.join(tmpDir, ".aiassistant/rules/agent-instructions.md"), "agent rules\n");
          yield* writeText(path.join(tmpDir, "AGENTS.md"), "root agent guide\n");
          yield* writeText(path.join(tmpDir, "packages/demo/AGENTS.md"), "nested guide\n");
          yield* writeText(path.join(tmpDir, ".repos/effect-v4/AGENTS.md"), "vendored guide\n");
          yield* writeText(path.join(tmpDir, "node_modules/pkg/CLAUDE.md"), "dependency guide\n");

          const snapshotDir = path.join(tmpDir, ".beep/ai-metrics/config-snapshots");
          const result = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot: tmpDir }));
          yield* writeAiMetricsConfigSnapshotArtifacts({
            outputDir: snapshotDir,
            result,
          });
          const again = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot: tmpDir }));
          const json = yield* configSnapshotToJson(result);

          expect(relativeSnapshotPaths(result.files)).toEqual([
            ".aiassistant/rules/agent-instructions.md",
            ".claude/settings.json",
            ".codex/config.toml",
            "AGENTS.md",
            "packages/demo/AGENTS.md",
          ]);
          expect(result.snapshot.includedPaths).toEqual(relativeSnapshotPaths(result.files));
          expect(result.snapshot.changedPaths).toEqual(relativeSnapshotPaths(result.files));
          expect(result.snapshot.configHash).toBe(again.snapshot.configHash);
          expect(json).not.toContain(".repos/effect-v4/AGENTS.md");
          expect(json).not.toContain("node_modules/pkg/CLAUDE.md");
          expect(yield* fs.exists(path.join(snapshotDir, "latest.json.tmp"))).toBe(false);

          yield* writeText(path.join(tmpDir, ".codex/config.toml"), 'model = "gpt-5.1"\n');
          const changed = yield* makeAiMetricsConfigSnapshot(
            AiMetricsConfigSnapshotInput.make({
              previousSnapshotPath: O.some(path.join(snapshotDir, "latest.json")),
              repoRoot: tmpDir,
            })
          );
          expect(changed.snapshot.configHash).not.toBe(result.snapshot.configHash);
          expect(changed.snapshot.changedPaths).toEqual([".codex/config.toml"]);
          expect(changed.diff.modifiedPaths).toEqual([".codex/config.toml"]);
          expect(O.getOrThrow(changed.snapshot.previousSnapshotId)).toBe(result.snapshot.snapshotId);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "reads legacy config snapshots without a diff field as previous state",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          yield* writeText(path.join(tmpDir, "AGENTS.md"), "current agent guide\n");
          yield* writeText(
            path.join(tmpDir, ".beep/ai-metrics/config-snapshots/latest.json"),
            // TODO(effect-native-migration): model schema
            yield* UnknownFromJsonString.encodeUnknownEffect({
              excludedDirectoryNames: [],
              fileCount: 1,
              files: [
                {
                  contentHash: "legacy-hash",
                  relativePath: "AGENTS.md",
                  sizeBytes: 18,
                },
              ],
              snapshot: {
                changedPaths: ["AGENTS.md"],
                configHash: "legacy-hash",
                includedPaths: ["AGENTS.md"],
                label: "repo-local-agent-config",
                snapshotId: "config-legacy",
              },
            })
          );

          const result = yield* makeAiMetricsConfigSnapshot(
            AiMetricsConfigSnapshotInput.make({
              previousSnapshotPath: O.some(path.join(tmpDir, ".beep/ai-metrics/config-snapshots/latest.json")),
              repoRoot: tmpDir,
            })
          );

          expect(O.getOrThrow(result.snapshot.previousSnapshotId)).toBe("config-legacy");
          expect(result.diff.modifiedPaths).toEqual(["AGENTS.md"]);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "fails malformed previous config snapshots instead of treating them as first-run state",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          yield* writeText(path.join(tmpDir, "AGENTS.md"), "root agent guide\n");
          yield* writeText(path.join(tmpDir, ".beep/ai-metrics/config-snapshots/latest.json"), "{not-json");

          const error = yield* Effect.flip(
            makeAiMetricsConfigSnapshot(
              AiMetricsConfigSnapshotInput.make({
                previousSnapshotPath: O.some(path.join(tmpDir, ".beep/ai-metrics/config-snapshots/latest.json")),
                repoRoot: tmpDir,
              })
            )
          );

          expect(error.message).toContain("Failed to decode previous AI metrics config snapshot artifact");
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "does not advance the latest config snapshot pointer until a forwarder run succeeds",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          yield* makeGitRoot(repoRoot);
          const dataRoot = path.join(tmpDir, "metrics");
          const codexRoot = path.join(homeDir, ".codex/sessions");

          yield* writeText(
            path.join(codexRoot, "codex.jsonl"),
            '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z"}'
          );
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "# Test agent guide\n");
          yield* writeText(path.join(dataRoot, "raw"), "block archive directory creation\n");

          const error = yield* Effect.flip(
            runAiMetricsForwarder(
              AiMetricsForwarderInput.make({
                codexSessionsRoot: O.some(codexRoot),
                dataRoot: O.some(dataRoot),
                hashSalt: O.some("test-salt"),
                homeDir,
                includeAll: true,
                rawArchiveKey: Redacted.make(Encoding.encodeBase64(new Uint8Array(32).fill(11))),
                repoRoot,
                target: AiMetricsDeployTarget.Enum.local,
              })
            ).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))))
          );
          const snapshotDir = path.join(dataRoot, "config-snapshots");
          const snapshotFiles = yield* fs.readDirectory(snapshotDir);

          expect(error.message).toContain("Failed to write encrypted AI metrics raw archive object");
          expect(yield* fs.exists(path.join(snapshotDir, "latest.json"))).toBe(false);
          expect(A.some(snapshotFiles, Str.endsWith(".json"))).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "discovers Codex, Claude, and OpenClaw sources without exposing private paths or service secrets",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          const claudeProjectName = pipe(repoRoot, Str.replace(/[/\\]/gu, "-"));
          const openClawUnitPath = path.join(homeDir, ".config/systemd/user/openclaw-gateway.service");

          yield* writeText(
            path.join(homeDir, ".codex/sessions/2026/05/05/codex-session.jsonl"),
            '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}\n'
          );
          yield* writeText(
            path.join(homeDir, ".claude/projects", claudeProjectName, "claude-session.jsonl"),
            '{"sessionId":"claude-session","timestamp":"2026-05-05T11:00:00Z"}\n'
          );
          yield* writeText(openClawUnitPath, "[Service]\nEnvironment=OPENCLAW_GATEWAY_TOKEN=super-secret-token\n");

          const result = yield* discoverAiMetricsSources(
            AiMetricsSourceDiscoveryInput.make({
              claudeProjectsRoot: O.none(),
              codexSessionsRoot: O.none(),
              hashSalt: O.some("test-salt"),
              homeDir,
              includeAll: true,
              maxFileBytes: O.none(),
              openClawUnitPath: O.some(openClawUnitPath),
              repoRoot,
              sinceEpochMillis: O.none(),
            })
          );
          const json = yield* sourceDiscoveryToJson(result);

          expect(result.hashSaltStatus).toBe("provided");
          expect(result.discoveredFileCount).toBe(3);
          expect(result.sources).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                fileCount: 1,
                sourceKind: "codex",
                status: "available",
              }),
              expect.objectContaining({
                fileCount: 1,
                sourceKind: "claude",
                status: "available",
              }),
              expect.objectContaining({
                fileCount: 1,
                sourceKind: "openclaw",
                status: "available",
              }),
            ])
          );
          expect(json).toContain("gateway_metadata");
          expect(json).not.toContain(tmpDir);
          expect(json).not.toContain("super-secret-token");
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "does not read Claude transcript bodies during source attribution",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          const claudeRoot = path.join(homeDir, ".claude/projects/repo");
          const claudePath = path.join(claudeRoot, "claude-unreadable.jsonl");
          yield* writeText(claudePath, '{"sessionId":"claude-session","timestamp":"2026-05-05T11:00:00Z"}\n');
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "root agent guide\n");
          yield* fs.chmod(claudePath, 0);

          const result = yield* discoverAiMetricsSources(
            AiMetricsSourceDiscoveryInput.make({
              claudeProjectsRoot: O.some(claudeRoot),
              hashSalt: O.some("test-salt"),
              homeDir,
              includeAll: true,
              repoRoot,
            })
          );
          yield* fs.chmod(claudePath, 0o600).pipe(Effect.ignore);
          const claude = pipe(
            result.sources,
            A.findFirst((source) => source.sourceKind === AiMetricsTranscriptSource.Enum.claude)
          );

          expect(O.isSome(claude)).toBe(true);
          if (O.isNone(claude)) {
            return;
          }
          expect(claude.value.candidateFileCount).toBe(1);
          expect(claude.value.includedFileCount).toBe(1);
          expect(claude.value.files[0]?.sourceRole).toBe("primary");
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "skips transcript files that become unreadable during source discovery",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          const codexRoot = path.join(homeDir, ".codex/sessions");
          const readablePath = path.join(codexRoot, "readable.jsonl");
          const unreadablePath = path.join(codexRoot, "unreadable.jsonl");
          yield* writeText(readablePath, '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}\n');
          yield* writeText(unreadablePath, '{"type":"session_meta","timestamp":"2026-05-05T10:01:00Z"}\n');
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "root agent guide\n");
          yield* fs.chmod(unreadablePath, 0);

          const result = yield* discoverAiMetricsSources(
            AiMetricsSourceDiscoveryInput.make({
              codexSessionsRoot: O.some(codexRoot),
              hashSalt: O.some("test-salt"),
              homeDir,
              includeAll: true,
              repoRoot,
            })
          );
          yield* fs.chmod(unreadablePath, 0o600).pipe(Effect.ignore);
          const codex = pipe(
            result.sources,
            A.findFirst((source) => source.sourceKind === AiMetricsTranscriptSource.Enum.codex)
          );

          expect(O.isSome(codex)).toBe(true);
          if (O.isNone(codex)) {
            return;
          }
          expect(codex.value.candidateFileCount).toBe(2);
          expect(codex.value.includedFileCount).toBe(1);
          expect(codex.value.limitedByMaxFiles).toBe(false);
          expect(result.discoveredFileCount).toBe(1);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "skips oversized transcript files during source discovery",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          const codexRoot = path.join(homeDir, ".codex/sessions");
          yield* writeText(
            path.join(codexRoot, "small.jsonl"),
            '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}\n'
          );
          yield* writeText(
            path.join(codexRoot, "large.jsonl"),
            `{"type":"session_meta","timestamp":"2026-05-05T10:01:00Z","payload":"${pipe("x", Str.repeat(512))}"}\n`
          );
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "root agent guide\n");

          const result = yield* discoverAiMetricsSources(
            AiMetricsSourceDiscoveryInput.make({
              claudeProjectsRoot: O.none(),
              codexSessionsRoot: O.some(codexRoot),
              hashSalt: O.some("test-salt"),
              homeDir,
              includeAll: true,
              maxFileBytes: O.some(128),
              openClawUnitPath: O.none(),
              repoRoot,
              sinceEpochMillis: O.none(),
            })
          );
          const codex = pipe(
            result.sources,
            A.findFirst((source) => source.sourceKind === AiMetricsTranscriptSource.Enum.codex)
          );

          expect(result.maxFileBytes).toEqual(O.some(128));
          expect(O.isSome(codex)).toBe(true);
          if (O.isNone(codex)) {
            return;
          }
          expect(codex.value.candidateFileCount).toBe(1);
          expect(codex.value.files).toHaveLength(1);
          expect(codex.value.files[0]?.sizeBytes).toBeLessThanOrEqual(128);
          expect(codex.value.sizeExcludedFileCount).toBe(1);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "streams Codex attribution until a parsed session_meta line is present",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          const codexRoot = path.join(homeDir, ".codex/sessions");
          const decoy = `{"payload":{"message":"not metadata session_meta ${pipe("x", Str.repeat(70_000))}"},"timestamp":"2026-05-05T10:00:00Z","type":"event_msg"}`;
          const actual =
            '{"payload":{"id":"child-session","source":{"subagent":{"agent_nickname":"worker-one","agent_role":"worker","parent_thread_id":"parent-thread","thread_spawn":true}}},"timestamp":"2026-05-05T10:01:00Z","type":"session_meta"}';
          yield* writeText(path.join(codexRoot, "codex-subagent.jsonl"), `${decoy}\n${actual}\n`);
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "root agent guide\n");

          const result = yield* discoverAiMetricsSources(
            AiMetricsSourceDiscoveryInput.make({
              codexSessionsRoot: O.some(codexRoot),
              hashSalt: O.some("test-salt"),
              homeDir,
              includeAll: true,
              repoRoot,
            })
          );
          const codex = pipe(
            result.sources,
            A.findFirst((source) => source.sourceKind === AiMetricsTranscriptSource.Enum.codex)
          );

          expect(O.isSome(codex)).toBe(true);
          if (O.isNone(codex)) {
            return;
          }
          expect(codex.value.files).toHaveLength(1);
          expect(O.isSome(codex.value.files[0]?.agentRoleHash ?? O.none())).toBe(true);
          expect(codex.value.files[0]?.sourceRole).toBe("subagent");
          expect(O.getOrThrow(codex.value.files[0]?.threadSpawn ?? O.none())).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "uses caller-relative paths for Claude source role attribution",
    Effect.fn(function* () {
      const content = '{"sessionId":"claude-session","timestamp":"2026-05-05T11:00:00Z"}';
      const primarySummary = yield* summarizeTranscriptText({
        content,
        hashSalt: O.some("test-salt"),
        sourceKind: AiMetricsTranscriptSource.Enum.claude,
        sourcePath: "/tmp/subagents/workspace/claude.jsonl",
      });
      const primary = yield* makeAiMetricsPrivacyCheckResult({
        content,
        hashSalt: O.some("test-salt"),
        sourcePath: "/tmp/subagents/workspace/claude.jsonl",
        summary: primarySummary,
      });
      const subagent = yield* makeAiMetricsPrivacyCheckResult({
        content,
        hashSalt: O.some("test-salt"),
        relativePath: O.some("subagents/claude.jsonl"),
        sourcePath: "/tmp/workspace/subagents/claude.jsonl",
        summary: primarySummary,
      });

      expect(primary.sanitized.sourceRole).toBe("primary");
      expect(subagent.sanitized.sourceRole).toBe("subagent");
    })
  );

  it.effect(
    "builds a sanitized P7 mirror bundle without raw archive paths",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          yield* makeGitRoot(repoRoot);
          const dataRoot = path.join(tmpDir, "metrics");
          const codexRoot = path.join(homeDir, ".codex/sessions");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          const rawArchiveKey = Redacted.make(Encoding.encodeBase64(new Uint8Array(32).fill(5)));

          yield* writeText(
            path.join(codexRoot, "codex.jsonl"),
            pipe(
              [
                '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z","payload":{"id":"s1"}}',
                '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","payload":{"message":"SECRET_TOKEN=secret-value"}}',
              ],
              A.join("\n")
            )
          );
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "# Test agent guide\n");

          yield* runAiMetricsForwarder(
            AiMetricsForwarderInput.make({
              codexSessionsRoot: O.some(codexRoot),
              dataRoot: O.some(dataRoot),
              hashSalt: O.some("test-salt"),
              homeDir,
              includeAll: true,
              rawArchiveKey,
              repoRoot,
              target: AiMetricsDeployTarget.Enum.local,
            })
          ).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));

          const bundle = yield* buildAiMetricsMirrorBundle(
            AiMetricsMirrorBundleInput.make({
              dataRoot,
              remoteRoot: "/srv/data/ai-metrics/p7-derived-mirror",
              target: AiMetricsDeployTarget.Enum.dankserver,
            })
          );
          const manifestText = yield* fs.readFileString(bundle.manifestPath);
          const statusText = yield* fs.readFileString(bundle.statusPath);
          const sourceFileColumns = yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            const rows = yield* duckdb.query(
              `DESCRIBE SELECT * FROM read_parquet(${sqlString(
                path.join(bundle.parquetDir, "ai_metrics_source_files.parquet")
              )})`
            );
            return A.map(rows, (row) => globalThis.String(row.column_name));
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))));
          const labelColumns = yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            const rows = yield* duckdb.query(
              `DESCRIBE SELECT * FROM read_parquet(${sqlString(
                path.join(bundle.parquetDir, "ai_metrics_outcome_labels.parquet")
              )})`
            );
            return A.map(rows, (row) => globalThis.String(row.column_name));
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))));

          expect(bundle.manifest.privacyProof.safe).toBe(true);
          expect(bundle.manifest.omittedTables).toContain("ai_metrics_raw_archive_objects");
          expect(bundle.manifest.includedTables).not.toContain("ai_metrics_raw_archive_objects");
          expect(yield* locateLatestAiMetricsMirrorBundle(dataRoot)).toBe(bundle.bundleDir);
          expect(yield* fs.exists(path.join(bundle.parquetDir, "ai_metrics_ingest_runs.parquet"))).toBe(true);
          expect(yield* fs.exists(path.join(bundle.parquetDir, "ai_metrics_raw_archive_objects.parquet"))).toBe(false);
          expect(yield* fs.exists(path.join(bundle.bundleDir, "mirror.duckdb"))).toBe(false);
          expect(bundle.mirrorDuckDbPath).not.toContain(bundle.bundleDir);
          expect(yield* fs.exists(bundle.mirrorDuckDbPath)).toBe(false);
          expect(sourceFileColumns).toContain("source_path_hash");
          expect(sourceFileColumns).not.toContain("archive_path");
          expect(labelColumns).toContain("note_hash");
          expect(labelColumns).not.toContain("note");
          expect(manifestText).not.toContain(dataRoot);
          expect(manifestText).not.toContain("secret-value");
          expect(statusText).not.toContain(dataRoot);
          expect(statusText).not.toContain("secret-value");
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "lists retained inventory and replays a restore drill into disposable derived storage",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          yield* makeGitRoot(repoRoot);
          const dataRoot = path.join(tmpDir, "metrics");
          const codexRoot = path.join(homeDir, ".codex/sessions");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          const rawArchiveKey = Redacted.make(Encoding.encodeBase64(new Uint8Array(32).fill(6)));
          const restoreRoot = path.join(tmpDir, "restore");

          yield* writeText(
            path.join(codexRoot, "codex.jsonl"),
            '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","payload":{"message":"restore me"}}'
          );
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "# Test agent guide\n");

          yield* runAiMetricsForwarder(
            AiMetricsForwarderInput.make({
              codexSessionsRoot: O.some(codexRoot),
              dataRoot: O.some(dataRoot),
              hashSalt: O.some("test-salt"),
              homeDir,
              includeAll: true,
              rawArchiveKey,
              repoRoot,
              target: AiMetricsDeployTarget.Enum.local,
            })
          ).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));

          yield* writeText(path.join(dataRoot, "reports/weekly.md"), "# report\n");

          const selector = AiMetricsRetentionSelector.make({
            beforeEpochMillis: O.some(4_102_444_800_000),
            dataRoot,
          });
          const inventory = yield* listAiMetricsRetentionInventory(selector);
          const drill = yield* runAiMetricsRetentionRestoreDrill(
            AiMetricsRetentionRestoreDrillInput.make({
              hashSalt: O.some("test-salt"),
              maxObjects: 1,
              rawArchiveKey,
              restoreRoot,
              selector,
            })
          );

          expect(inventory.selectedRawArchiveObjectCount).toBe(1);
          expect(inventory.selectedDerivedExportCount).toBe(1);
          expect(inventory.selectedReportCount).toBe(1);
          expect(drill.hashMatches).toBe(true);
          expect(drill.replayedObjectCount).toBe(1);
          expect(drill.transcriptTextPrinted).toBe(false);
          expect(yield* fs.exists(drill.derivedDuckDbPath)).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "enforces preventive Parquet snapshot retention without deleting latest exports",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const dataRoot = path.join(tmpDir, "metrics");
          const parquetRoot = path.join(dataRoot, "derived/parquet");
          const oldSnapshot = path.join(parquetRoot, "forwarder-old/ai_metrics_turns.parquet");
          const newSnapshot = path.join(parquetRoot, "forwarder-new/ai_metrics_turns.parquet");
          const latestExport = path.join(parquetRoot, "latest/ai_metrics_turns.parquet");

          yield* writeText(oldSnapshot, "old\n");
          yield* writeText(newSnapshot, "new\n");
          yield* writeText(latestExport, "latest\n");

          const dryRun = yield* enforceAiMetricsRetentionPolicy(
            AiMetricsRetentionEnforcementPolicy.make({
              dataRoot,
              dryRun: true,
              maxSnapshotExports: 0,
            })
          );
          const dryRunJson = yield* aiMetricsRetentionEnforcementToJson(dryRun);
          expect(dryRun.deletedDerivedExportCount).toBe(2);
          expect(dryRun.dryRun).toBe(true);
          expect(dryRunJson).toContain("beep.ai_metrics.retention_enforcement.v1");
          expect(yield* fs.exists(path.join(parquetRoot, "forwarder-old"))).toBe(true);

          const applied = yield* enforceAiMetricsRetentionPolicy(
            AiMetricsRetentionEnforcementPolicy.make({
              dataRoot,
              dryRun: false,
              maxSnapshotExports: 0,
            })
          );
          expect(applied.deletedDerivedExportCount).toBe(2);
          expect(applied.keptDerivedExportCount).toBe(0);
          expect(yield* fs.exists(path.join(parquetRoot, "forwarder-old"))).toBe(false);
          expect(yield* fs.exists(path.join(parquetRoot, "forwarder-new"))).toBe(false);
          expect(yield* fs.exists(path.join(parquetRoot, "latest"))).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "keeps the newest N Parquet snapshots and prunes the rest (default forwarder run self-prune)",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const dataRoot = path.join(tmpDir, "metrics");
          const parquetRoot = path.join(dataRoot, "derived/parquet");
          const forwarderCount = (entries: ReadonlyArray<string>): number =>
            A.length(A.filter(entries, Str.startsWith("forwarder-")));

          yield* writeText(path.join(parquetRoot, "forwarder-1/ai_metrics_turns.parquet"), "one\n");
          yield* writeText(path.join(parquetRoot, "forwarder-2/ai_metrics_turns.parquet"), "two\n");
          yield* writeText(path.join(parquetRoot, "forwarder-3/ai_metrics_turns.parquet"), "three\n");
          yield* writeText(path.join(parquetRoot, "latest/ai_metrics_turns.parquet"), "latest\n");

          const dryRun = yield* enforceAiMetricsRetentionPolicy(
            AiMetricsRetentionEnforcementPolicy.make({
              dataRoot,
              dryRun: true,
              maxSnapshotExports: 2,
            })
          );
          expect(dryRun.deletedDerivedExportCount).toBe(1);
          expect(dryRun.keptDerivedExportCount).toBe(2);
          expect(forwarderCount(yield* fs.readDirectory(parquetRoot))).toBe(3);

          const applied = yield* enforceAiMetricsRetentionPolicy(
            AiMetricsRetentionEnforcementPolicy.make({
              dataRoot,
              dryRun: false,
              maxSnapshotExports: 2,
            })
          );
          expect(applied.deletedDerivedExportCount).toBe(1);
          expect(applied.keptDerivedExportCount).toBe(2);
          expect(forwarderCount(yield* fs.readDirectory(parquetRoot))).toBe(2);
          expect(yield* fs.exists(path.join(parquetRoot, "latest"))).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "fails restore drills when retained plaintext hashes do not match",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          yield* makeGitRoot(repoRoot);
          const dataRoot = path.join(tmpDir, "metrics");
          const codexRoot = path.join(homeDir, ".codex/sessions");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          const rawArchiveKey = Redacted.make(Encoding.encodeBase64(new Uint8Array(32).fill(7)));
          const restoreRoot = path.join(tmpDir, "restore");

          yield* writeText(
            path.join(codexRoot, "codex.jsonl"),
            '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","payload":{"message":"verify me"}}'
          );
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "# Test agent guide\n");

          yield* runAiMetricsForwarder(
            AiMetricsForwarderInput.make({
              codexSessionsRoot: O.some(codexRoot),
              dataRoot: O.some(dataRoot),
              hashSalt: O.some("test-salt"),
              homeDir,
              includeAll: true,
              rawArchiveKey,
              repoRoot,
              target: AiMetricsDeployTarget.Enum.local,
            })
          ).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
          const originalArchivePath = yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            const rows = yield* duckdb.query("SELECT archive_path FROM ai_metrics_raw_archive_objects LIMIT 1");
            return globalThis.String(rows[0]?.archive_path);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* duckdb.run(
              `UPDATE ai_metrics_raw_archive_objects SET archive_path = ${sqlString(path.join(tmpDir, "outside.json"))}`
            );
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));

          const selector = AiMetricsRetentionSelector.make({
            beforeEpochMillis: O.some(4_102_444_800_000),
            dataRoot,
          });
          const invalidPathExit = yield* Effect.exit(
            runAiMetricsRetentionRestoreDrill(
              AiMetricsRetentionRestoreDrillInput.make({
                hashSalt: O.some("test-salt"),
                maxObjects: 1,
                rawArchiveKey,
                restoreRoot,
                selector,
              })
            )
          );
          expect(Exit.isFailure(invalidPathExit)).toBe(true);

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* duckdb.run(
              `UPDATE ai_metrics_raw_archive_objects
                  SET archive_path = ${sqlString(originalArchivePath)},
                      plaintext_content_hash = 'mismatch'`
            );
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
          const exit = yield* Effect.exit(
            runAiMetricsRetentionRestoreDrill(
              AiMetricsRetentionRestoreDrillInput.make({
                hashSalt: O.some("test-salt"),
                maxObjects: 1,
                rawArchiveKey,
                restoreRoot,
                selector,
              })
            )
          );

          expect(Exit.isFailure(exit)).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "supports explicit-window compact and delete drills on disposable data roots",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          yield* makeGitRoot(repoRoot);
          const dataRoot = path.join(tmpDir, "metrics");
          const codexRoot = path.join(homeDir, ".codex/sessions");
          const duckDbPath = path.join(dataRoot, "derived/ai-metrics.duckdb");
          const rawArchiveKey = Redacted.make(Encoding.encodeBase64(new Uint8Array(32).fill(8)));
          const beforeEpochMillis = 4_102_444_800_000;

          yield* writeText(
            path.join(codexRoot, "codex.jsonl"),
            '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","payload":{"message":"delete me"}}'
          );
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "# Test agent guide\n");

          yield* runAiMetricsForwarder(
            AiMetricsForwarderInput.make({
              codexSessionsRoot: O.some(codexRoot),
              dataRoot: O.some(dataRoot),
              hashSalt: O.some("test-salt"),
              homeDir,
              includeAll: true,
              rawArchiveKey,
              repoRoot,
              target: AiMetricsDeployTarget.Enum.local,
            })
          ).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));

          yield* writeText(path.join(dataRoot, "reports/weekly.md"), "# report\n");

          const agentTaskId = yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            const rows = yield* duckdb.query("SELECT agent_task_id FROM ai_metrics_agent_tasks LIMIT 1");
            return globalThis.String(rows[0]?.agent_task_id);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* duckdb.run(
              `INSERT INTO ai_metrics_outcome_labels (
                label_id,
                agent_task_id,
                rating,
                passed,
                quality_gate,
                intervention_count,
                follow_up_fix,
                note,
                labeled_at_epoch_ms
              ) VALUES
                ('inside-window-label', ${sqlString(agentTaskId)}, 1, true, 'ok', 0, false, NULL, ${
                  beforeEpochMillis - 1
                }),
                ('outside-window-label', ${sqlString(agentTaskId)}, 1, true, 'ok', 0, false, NULL, ${
                  beforeEpochMillis + 1
                })`
            );
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));

          const selector = AiMetricsRetentionSelector.make({
            beforeEpochMillis: O.some(beforeEpochMillis),
            dataRoot,
          });
          const compactResult = yield* runAiMetricsRetentionCompact(selector, false);
          expect(compactResult.dryRun).toBe(false);
          expect(compactResult.deletedDerivedExportCount).toBe(1);
          expect(compactResult.deletedReportCount).toBe(1);
          expect(yield* fs.exists(path.join(dataRoot, "derived/parquet"))).toBe(true);
          expect(yield* fs.exists(path.join(dataRoot, "reports/weekly.md"))).toBe(false);

          const deleteResult = yield* runAiMetricsRetentionDelete(selector, false).pipe(
            provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath })))
          );
          expect(deleteResult.dryRun).toBe(false);
          expect(deleteResult.deletedRawArchiveObjectCount).toBe(1);
          const rawFiles = yield* fs.readDirectory(path.join(dataRoot, "raw/codex"));
          expect(rawFiles).toEqual([]);
          const tableCounts = yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            const ingestRuns = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_ingest_runs");
            const sourceFiles = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_source_files");
            const rawArchiveObjects = yield* duckdb.query(
              "SELECT count(*) AS count FROM ai_metrics_raw_archive_objects"
            );
            const agentTasks = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_agent_tasks");
            const labels = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_outcome_labels");
            const sessions = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_sessions");
            const turns = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_turns");
            return {
              agentTasks: globalThis.Number(agentTasks[0]?.count),
              ingestRuns: globalThis.Number(ingestRuns[0]?.count),
              labels: globalThis.Number(labels[0]?.count),
              rawArchiveObjects: globalThis.Number(rawArchiveObjects[0]?.count),
              sessions: globalThis.Number(sessions[0]?.count),
              sourceFiles: globalThis.Number(sourceFiles[0]?.count),
              turns: globalThis.Number(turns[0]?.count),
            };
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
          expect(tableCounts).toEqual({
            agentTasks: 1,
            ingestRuns: 0,
            labels: 1,
            rawArchiveObjects: 0,
            sessions: 0,
            sourceFiles: 0,
            turns: 0,
          });

          const labelOnlySelector = AiMetricsRetentionSelector.make({
            dataRoot,
            sinceEpochMillis: O.some(beforeEpochMillis),
            untilEpochMillis: O.some(beforeEpochMillis + 2),
          });
          const labelOnlyDelete = yield* runAiMetricsRetentionDelete(labelOnlySelector, false).pipe(
            provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath })))
          );
          expect(labelOnlyDelete.deletedRawArchiveObjectCount).toBe(0);
          const labelOnlyCounts = yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            const agentTasks = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_agent_tasks");
            const labels = yield* duckdb.query("SELECT count(*) AS count FROM ai_metrics_outcome_labels");
            return {
              agentTasks: globalThis.Number(agentTasks[0]?.count),
              labels: globalThis.Number(labels[0]?.count),
            };
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))));
          expect(labelOnlyCounts).toEqual({ agentTasks: 0, labels: 0 });
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );
});
