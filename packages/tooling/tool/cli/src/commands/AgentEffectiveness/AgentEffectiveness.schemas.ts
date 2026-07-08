/**
 * Schema contracts for agent-effectiveness eval scoring.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.js";

const $I = $RepoCliId.create("commands/AgentEffectiveness/AgentEffectiveness.schemas");

/**
 * Source of a scorer violation.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessEvalViolationSource } from "@beep/repo-cli/commands/AgentEffectiveness"
 *
 * console.log(AgentEffectivenessEvalViolationSource.is.tsgo("tsgo"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessEvalViolationSource = LiteralKit(["schema-first", "tsgo", "biome", "completion"]).pipe(
  $I.annoteSchema("AgentEffectivenessEvalViolationSource", {
    description: "Bounded sources emitted in SkillOpt eval scorer violations.",
  })
);

/**
 * Source of a scorer violation.
 *
 * @example
 * ```ts
 * import type { AgentEffectivenessEvalViolationSource } from "@beep/repo-cli/commands/AgentEffectiveness"
 *
 * const source: AgentEffectivenessEvalViolationSource = "completion"
 * console.log(source)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type AgentEffectivenessEvalViolationSource = typeof AgentEffectivenessEvalViolationSource.Type;

/**
 * Declarative checks a rollout must satisfy: required exported symbol names
 * plus required/forbidden source regexes from the task manifest.
 *
 * @category models
 * @since 0.0.0
 */
class SkillOptTaskCompletionCriteria extends S.Class<SkillOptTaskCompletionCriteria>(
  $I`SkillOptTaskCompletionCriteria`
)(
  {
    requiredExports: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    requiredPatterns: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    forbiddenPatterns: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
  },
  $I.annote("SkillOptTaskCompletionCriteria", {
    description: "Declarative deterministic completion checks from a SkillOpt task manifest.",
  })
) {}

/**
 * SkillOpt task weighting block retained from the manifest contract.
 *
 * @category models
 * @since 0.0.0
 */
class SkillOptTaskWeights extends S.Class<SkillOptTaskWeights>($I`SkillOptTaskWeights`)(
  {
    completion: S.Finite,
    law: S.Finite,
  },
  $I.annote("SkillOptTaskWeights", {
    description: "Manifest weighting metadata retained for compatibility; scorer formula remains contract-fixed.",
  })
) {}

/**
 * SkillOpt task manifest consumed by the scorer.
 *
 * @example
 * ```ts
 * import type { SkillOptTaskManifest } from "@beep/repo-cli/commands/AgentEffectiveness"
 *
 * declare const task: SkillOptTaskManifest
 * console.log(task.id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SkillOptTaskManifest extends S.Class<SkillOptTaskManifest>($I`SkillOptTaskManifest`)(
  {
    id: S.String,
    ruleIds: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    derivedFrom: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    prompt: S.String,
    fixture: S.String,
    entrypoint: S.String,
    completion: SkillOptTaskCompletionCriteria,
    weights: S.optionalKey(SkillOptTaskWeights),
  },
  $I.annote("SkillOptTaskManifest", {
    description: "SkillOpt eval task manifest with deterministic completion criteria.",
  })
) {}

/**
 * One scorer violation in the fixed P2/P3 contract shape.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessEvalViolation } from "@beep/repo-cli/commands/AgentEffectiveness"
 *
 * const violation = AgentEffectivenessEvalViolation.make({
 *   source: "completion",
 *   ruleId: "completion",
 *   file: "src/Contact.ts",
 *   line: 1,
 *   message: "Missing export Contact"
 * })
 * console.log(violation.source)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessEvalViolation extends S.Class<AgentEffectivenessEvalViolation>(
  $I`AgentEffectivenessEvalViolation`
)(
  {
    source: AgentEffectivenessEvalViolationSource,
    ruleId: S.String,
    file: S.String,
    line: S.Finite,
    message: S.String,
  },
  $I.annote("AgentEffectivenessEvalViolation", {
    description: "Normalized SkillOpt eval scorer violation.",
  })
) {}

/**
 * Fixed scorer output breakdown.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessEvalScoreBreakdown extends S.Class<AgentEffectivenessEvalScoreBreakdown>(
  $I`AgentEffectivenessEvalScoreBreakdown`
)(
  {
    completion: S.Finite,
    schemaFirst: S.Finite,
    tsgo: S.Finite,
    biome: S.Finite,
  },
  $I.annote("AgentEffectivenessEvalScoreBreakdown", {
    description: "Scorer component fractions in the fixed contract output.",
  })
) {}

/**
 * Fixed scorer JSON report.
 *
 * @example
 * ```ts
 * import type { AgentEffectivenessEvalScoreReport } from "@beep/repo-cli/commands/AgentEffectiveness"
 *
 * declare const report: AgentEffectivenessEvalScoreReport
 * console.log(report.score)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessEvalScoreReport extends S.Class<AgentEffectivenessEvalScoreReport>(
  $I`AgentEffectivenessEvalScoreReport`
)(
  {
    taskId: S.String,
    score: S.Finite,
    breakdown: AgentEffectivenessEvalScoreBreakdown,
    violations: S.Array(AgentEffectivenessEvalViolation),
  },
  $I.annote("AgentEffectivenessEvalScoreReport", {
    description: "Machine-readable SkillOpt eval score report emitted by agent-effectiveness evals score.",
  })
) {}

/**
 * Result of recording a scorer report in ai-metrics.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessEvalRecordResult extends S.Class<AgentEffectivenessEvalRecordResult>(
  $I`AgentEffectivenessEvalRecordResult`
)(
  {
    benchmarkRunId: S.String,
    benchmarkCaseId: S.String,
  },
  $I.annote("AgentEffectivenessEvalRecordResult", {
    description: "Identifiers written by --record after a SkillOpt eval scorer run.",
  })
) {}

const taskManifestJsonCodec = JsonStringCodec(SkillOptTaskManifest);

/**
 * Decode a SkillOpt task manifest JSON string.
 *
 * @example
 * ```ts
 * import { decodeTaskManifestJson } from "@beep/repo-cli/commands/AgentEffectiveness"
 * import { Effect } from "effect"
 *
 * const manifest = '{"id":"task","ruleIds":[],"derivedFrom":[],"prompt":"p","fixture":"fixture","entrypoint":"src/index.ts","completion":{}}'
 * console.log(Effect.isEffect(decodeTaskManifestJson(manifest)))
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const decodeTaskManifestJson: (text: string) => Effect.Effect<SkillOptTaskManifest, S.SchemaError> =
  taskManifestJsonCodec.decode;

const scoreReportJsonCodec = JsonStringCodec(AgentEffectivenessEvalScoreReport);

/**
 * Encode a score report as the fixed compact JSON output.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessEvalScoreBreakdown, AgentEffectivenessEvalScoreReport, encodeAgentEffectivenessEvalScoreReportJson } from "@beep/repo-cli/commands/AgentEffectiveness"
 * import { Effect } from "effect"
 *
 * const report = AgentEffectivenessEvalScoreReport.make({
 *   taskId: "task",
 *   score: 1,
 *   breakdown: AgentEffectivenessEvalScoreBreakdown.make({ completion: 1, schemaFirst: 1, tsgo: 1, biome: 1 }),
 *   violations: []
 * })
 * console.log(Effect.isEffect(encodeAgentEffectivenessEvalScoreReportJson(report)))
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeAgentEffectivenessEvalScoreReportJson: (
  report: AgentEffectivenessEvalScoreReport
) => Effect.Effect<string, S.SchemaError> = scoreReportJsonCodec.encode;
