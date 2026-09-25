/**
 * AI-metrics recording for agent-effectiveness eval scoring.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import {
  AiMetricsBenchmarkCaseInput,
  AiMetricsBenchmarkRunInput,
  AiMetricsConfigSnapshotInput,
  AiMetricsQualityGateStatus,
  aiMetricsDerivedDuckDbPath,
  HarnessFingerprintInput,
  HarnessFingerprintParts,
  harnessFingerprintFromParts,
  hashPublicTextSha256,
  makeAiMetricsConfigSnapshot,
  makeHarnessFingerprint,
  recordAiMetricsBenchmarkRun,
  upsertAiMetricsBenchmarkCase,
  withAiMetricsDuckDb,
} from "@beep/repo-ai-metrics";
import { findRepoRoot } from "@beep/repo-utils";
import { Clock, Effect, FileSystem, flow, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AgentEffectivenessEvalScorerError } from "../AgentEffectiveness.errors.ts";
import {
  AgentEffectivenessEvalRecordResult,
  AgentEffectivenessEvalScoreReport,
  SkillOptTaskManifest,
} from "../AgentEffectiveness.schemas.ts";

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/EvalRecord");
const normalizePathSeparators = Str.replaceAll("\\", "/");
const normalizeRelativePath: (value: string) => string = flow(normalizePathSeparators, Str.replace(/^\.\//, ""));

const recordNote = (report: AgentEffectivenessEvalScoreReport): string =>
  `skillopt scorer score=${report.score} completion=${report.breakdown.completion} schemaFirst=${report.breakdown.schemaFirst} tsgo=${report.breakdown.tsgo} biome=${report.breakdown.biome}`;

class RecordAgentEffectivenessEvalScoreOptions extends S.Class<RecordAgentEffectivenessEvalScoreOptions>(
  $I`RecordAgentEffectivenessEvalScoreOptions`
)(
  {
    dataRoot: S.String,
    dir: S.String,
    elapsedMs: S.Finite,
    modelId: S.Option(S.NonEmptyString),
    reasoningEffort: S.Option(S.NonEmptyString),
    report: AgentEffectivenessEvalScoreReport,
    task: SkillOptTaskManifest,
    taskPath: S.String,
  },
  $I.annote("RecordAgentEffectivenessEvalScoreOptions", {
    description: "Options for recording an agent effectiveness eval score.",
  })
) {}

const candidateSkillRoots = [".agents", ".claude"];
const encodeCandidateSkillListing = S.encodeEffect(S.fromJsonString(S.Array(S.Tuple([S.String, S.String]))));

/**
 * Digest every file under `<dir>/.agents/skills` and `<dir>/.claude/skills`.
 *
 * **Details**
 *
 * Files are listed recursively, keyed by their dir-relative path, sorted, and
 * content-hashed; the digest hashes that sorted `(path, contentSha256)`
 * listing. No candidate file under either root yields `Option.none()`. Raw
 * skill content is never persisted.
 */
const candidateSkillDigest = Effect.fn("AgentEffectivenessEvalScorer.candidateSkillDigest")(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const perRoot = yield* Effect.forEach(
    candidateSkillRoots,
    Effect.fnUntraced(function* (root: string) {
      const skillsDir = path.join(dir, root, "skills");
      if (!(yield* fs.exists(skillsDir))) {
        return A.empty<readonly [string, string]>();
      }
      const names = yield* fs.readDirectory(skillsDir, { recursive: true });
      const files = yield* Effect.filter(names, (name) =>
        fs.stat(path.join(skillsDir, name)).pipe(Effect.map((info) => info.type === "File"))
      );
      return yield* Effect.forEach(A.sort(files, Order.String), (name) =>
        fs.readFileString(path.join(skillsDir, name)).pipe(
          Effect.flatMap(hashPublicTextSha256),
          Effect.map((digest) => [normalizeRelativePath(`${root}/skills/${name}`), digest] as const)
        )
      );
    })
  );
  const listing = A.flatten(perRoot);
  if (A.isReadonlyArrayEmpty(listing)) {
    return O.none<string>();
  }
  return O.some(yield* hashPublicTextSha256(yield* encodeCandidateSkillListing(listing)));
});

/**
 * Fingerprint repository guidance plus the candidate skills injected into a
 * rollout directory, and name the scorer configuration after it.
 *
 * **Details**
 *
 * The result is `skillopt-scorer-<fingerprintId>` for a `HarnessFingerprint`
 * of model, reasoning effort, and harness-surface hash. The repository
 * snapshot is rooted at `repoRoot`, so a SkillOpt candidate injected under
 * `<dir>/.agents/skills` or `<dir>/.claude/skills` would be invisible to it;
 * when either root holds files, their sorted content digest is folded into
 * the fingerprint's `harnessSessionHash`. A directory without candidate
 * skills keeps the repository fingerprint unchanged. Unreadable candidate
 * files fail rather than hash as absent.
 *
 * **Example** (Identifying an external rollout's configuration)
 *
 * ```ts
 * import { evalConfigurationId } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const id = evalConfigurationId("/repo", "/rollouts/task-1", O.some("opus"), O.some("medium"))
 * console.log(Effect.isEffect(id)) // true
 * ```
 *
 * @internal
 * @param repoRoot - Repository whose shared guidance the scorer observes.
 * @param dir - Rollout directory that may hold injected candidate skills.
 * @param modelId - Recorded rollout model, if known.
 * @param reasoningEffort - Recorded rollout effort, if known.
 * @returns The content-addressed scorer configuration identity.
 * @category utilities
 * @since 0.0.0
 */
export const evalConfigurationId = Effect.fn("AgentEffectivenessEvalScorer.configurationId")(function* (
  repoRoot: string,
  dir: string,
  modelId: O.Option<string>,
  reasoningEffort: O.Option<string>
) {
  const configSnapshot = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot })).pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to snapshot agent configuration."))
  );
  const repoFingerprint = yield* makeHarnessFingerprint(
    HarnessFingerprintInput.make({ modelId, reasoningEffort, snapshot: configSnapshot })
  ).pipe(Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to derive harness fingerprint.")));
  const candidate = yield* candidateSkillDigest(dir).pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to hash injected candidate skills."))
  );
  const fingerprint = yield* O.match(candidate, {
    onNone: () => Effect.succeed(repoFingerprint),
    onSome: (digest) =>
      hashPublicTextSha256(`skillopt-candidate-skills-v1\n${repoFingerprint.harnessSessionHash}\n${digest}`).pipe(
        Effect.flatMap((harnessSessionHash) =>
          harnessFingerprintFromParts(
            HarnessFingerprintParts.make({
              modelId: repoFingerprint.modelId,
              reasoningEffort: repoFingerprint.reasoningEffort,
              harnessSessionHash,
              harnessBaselineHash: repoFingerprint.harnessBaselineHash,
            })
          )
        ),
        Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to fold candidate skills into fingerprint."))
      ),
  });
  return `skillopt-scorer-${fingerprint.fingerprintId}`;
});

/**
 * Record a score report as an ai-metrics BenchmarkRun row.
 *
 * The task prompt body is never persisted; it is represented only by
 * `hashPublicTextSha256(task.prompt)` and the manifest path is retained as
 * `promptRef`.
 *
 * `configSnapshotId` is {@link evalConfigurationId}: a harness fingerprint of
 * the repository guidance and any candidate skills injected under `dir`. It
 * changes when the candidate skill, harness surfaces, model, or reasoning
 * effort change, never when the score changes.
 *
 * @category services
 * @since 0.0.0
 */
export const recordAgentEffectivenessEvalScore = Effect.fn("AgentEffectivenessEvalScorer.record")(function* ({
  dataRoot,
  dir,
  elapsedMs,
  modelId,
  reasoningEffort,
  report,
  task,
  taskPath,
}: RecordAgentEffectivenessEvalScoreOptions): Effect.fn.Return<
  AgentEffectivenessEvalRecordResult,
  AgentEffectivenessEvalScorerError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to locate repository root."))
  );
  const duckDbPath = path.resolve(repoRoot, aiMetricsDerivedDuckDbPath(dataRoot));
  yield* fs.makeDirectory(path.dirname(duckDbPath), { recursive: true }).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError("Failed to prepare ai-metrics derived data root.", {
        file: path.dirname(duckDbPath),
      })
    )
  );
  const promptHash = yield* hashPublicTextSha256(task.prompt).pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to hash SkillOpt task prompt."))
  );
  const configSnapshotId = yield* evalConfigurationId(repoRoot, dir, modelId, reasoningEffort);
  const recordedAtEpochMillis = yield* Clock.currentTimeMillis;

  const run = yield* pipe(
    upsertAiMetricsBenchmarkCase(
      AiMetricsBenchmarkCaseInput.make({
        benchmarkCaseId: task.id,
        expectedChecks: [
          "bun run beep lint schema-first",
          `tsgo -p ${task.fixture}/tsconfig.json --pretty false --noEmit`,
          `biome check ${task.fixture} --reporter=json`,
        ],
        promptHash,
        promptRef: O.some(normalizeRelativePath(taskPath)),
        title: task.id,
      })
    ),
    Effect.flatMap(() =>
      recordAiMetricsBenchmarkRun(
        AiMetricsBenchmarkRunInput.make({
          benchmarkCaseId: task.id,
          configSnapshotId,
          elapsedMs,
          note: O.some(recordNote(report)),
          passed: report.score >= 0.999,
          qualityGate:
            report.score >= 0.999 ? AiMetricsQualityGateStatus.Enum.passed : AiMetricsQualityGateStatus.Enum.failed,
          recordedAtEpochMillis,
        })
      )
    ),
    withAiMetricsDuckDb(duckDbPath),
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to record ai-metrics BenchmarkRun."))
  );

  return AgentEffectivenessEvalRecordResult.make({
    benchmarkRunId: run.benchmarkRunId,
    benchmarkCaseId: run.benchmarkCaseId,
  });
});
