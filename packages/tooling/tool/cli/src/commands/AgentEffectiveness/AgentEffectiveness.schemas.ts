/**
 * Schema contracts for agent-effectiveness eval scoring.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import { A } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/AgentEffectiveness/AgentEffectiveness.schemas");

/**
 * Source of a scorer violation.
 *
 * **Example** (Check is.tsgo predicate)
 *
 * ```ts
 * import { AgentEffectivenessEvalViolationSource } from "@beep/repo-cli/commands/AgentEffectiveness"
 *
 * console.log(AgentEffectivenessEvalViolationSource.is.tsgo("tsgo"))
 * ```
 *
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
 * **Example** (Type completion source value)
 *
 * ```ts
 * import type { AgentEffectivenessEvalViolationSource } from "@beep/repo-cli/commands/AgentEffectiveness"
 *
 * const source: AgentEffectivenessEvalViolationSource = "completion"
 * console.log(source) // example value
 * ```
 *
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
 * **Example** (Make SkillOpt task manifest)
 *
 * ```ts
 * import { SkillOptTaskManifest } from "@beep/repo-cli/commands/AgentEffectiveness"
 *
 * const task = SkillOptTaskManifest.make({
 *   completion: { requiredExports: ["Contact"], requiredPatterns: [], forbiddenPatterns: [] },
 *   derivedFrom: [],
 *   entrypoint: "src/index.ts",
 *   fixture: "fixtures/contact",
 *   id: "contact-model",
 *   prompt: "Create a contact model.",
 *   ruleIds: []
 * })
 * console.log(task.id)
 * ```
 *
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
 * **Example** (Make scorer violation object)
 *
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
 *
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
 * **Example** (Verify breakdown is defined)
 *
 * ```ts
 * import { AgentEffectivenessEvalScoreBreakdown } from "@beep/repo-cli/commands/AgentEffectiveness/AgentEffectiveness.schemas"
 *
 * console.log(typeof AgentEffectivenessEvalScoreBreakdown !== "undefined") // true
 * ```
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
 * **Example** (Make score report object)
 *
 * ```ts
 * import { AgentEffectivenessEvalScoreBreakdown, AgentEffectivenessEvalScoreReport } from "@beep/repo-cli/commands/AgentEffectiveness"
 *
 * const report = AgentEffectivenessEvalScoreReport.make({
 *   breakdown: AgentEffectivenessEvalScoreBreakdown.make({ biome: 1, completion: 1, schemaFirst: 1, tsgo: 1 }),
 *   score: 1,
 *   taskId: "contact-model",
 *   violations: []
 * })
 * console.log(report.score)
 * ```
 *
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
 * **Example** (Verify record result defined)
 *
 * ```ts
 * import { AgentEffectivenessEvalRecordResult } from "@beep/repo-cli/commands/AgentEffectiveness/AgentEffectiveness.schemas"
 *
 * console.log(typeof AgentEffectivenessEvalRecordResult !== "undefined") // true
 * ```
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
 * **Example** (Decode task manifest JSON)
 *
 * ```ts
 * import { decodeTaskManifestJson } from "@beep/repo-cli/commands/AgentEffectiveness"
 * import { Effect } from "effect"
 *
 * const manifest = '{"id":"task","ruleIds":[],"derivedFrom":[],"prompt":"p","fixture":"fixture","entrypoint":"src/index.ts","completion":{}}'
 * console.log(Effect.isEffect(decodeTaskManifestJson(manifest)))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeTaskManifestJson: (text: string) => Effect.Effect<SkillOptTaskManifest, S.SchemaError> =
  taskManifestJsonCodec.decode;

const scoreReportJsonCodec = JsonStringCodec(AgentEffectivenessEvalScoreReport);

/**
 * Encode a score report as the fixed compact JSON output.
 *
 * **Example** (Encode score report JSON)
 *
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
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeAgentEffectivenessEvalScoreReportJson: (
  report: AgentEffectivenessEvalScoreReport
) => Effect.Effect<string, S.SchemaError> = scoreReportJsonCodec.encode;

const NonNegativeMeasure = S.Finite.check(S.isGreaterThanOrEqualTo(0));
const Count = S.Int.check(S.isGreaterThanOrEqualTo(0));

/**
 * Inputs that must stay fixed when comparing two convention variants.
 *
 * **Details**
 *
 * Digests identify the source snapshot, harness, environment, and safety policy.
 * They are declarations by the experiment runner, not independently verified
 * attestations. The task contains the prompt and deterministic completion rules.
 *
 * **Example** (Require a fixed acceptance suite)
 *
 * ```ts
 * import { AgentConventionControls } from "@beep/repo-cli/commands/AgentEffectiveness"
 * import * as S from "effect/Schema"
 *
 * const decodeChecks = S.decodeUnknownOption(AgentConventionControls.fields.acceptanceChecks)
 * console.log(decodeChecks(["check", "test"]))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentConventionControls extends S.Class<AgentConventionControls>($I`AgentConventionControls`)(
  {
    task: SkillOptTaskManifest,
    repositorySnapshot: Sha256Hex,
    harnessDigest: Sha256Hex,
    environmentDigest: Sha256Hex,
    safetyPolicyDigest: Sha256Hex,
    model: S.NonEmptyString,
    reasoningEffort: S.NonEmptyString,
    tokenBudget: Count,
    timeBudgetMs: NonNegativeMeasure,
    acceptanceChecks: S.NonEmptyArray(S.NonEmptyString),
  },
  $I.annote("AgentConventionControls", {
    description: "Declared task, model, safety, acceptance, runtime, and budget controls for a paired comparison.",
  })
) {}

/**
 * Content identities for the three independently variable convention surfaces.
 *
 * **Example** (Validate a guidance identity)
 *
 * ```ts
 * import { AgentConventionVariant } from "@beep/repo-cli/commands/AgentEffectiveness"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AgentConventionVariant.fields.guidance)("missing")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentConventionVariant extends S.Class<AgentConventionVariant>($I`AgentConventionVariant`)(
  { guidance: Sha256Hex, navigation: Sha256Hex, handoff: Sha256Hex },
  $I.annote("AgentConventionVariant", { description: "Content digests of guidance, navigation, and handoff inputs." })
) {}

const AcceptanceOutcome = LiteralKit(["passed", "failed", "not-run"]);

/**
 * Measurements retained separately from the existing deterministic scorer.
 *
 * **Details**
 *
 * Null means unmeasured, including defect and intervention counts. A missing
 * acceptance-check key is counted as not run. Durations are milliseconds and
 * tokens are provider-reported counts; missing measurements never become zero.
 *
 * **Example** (Represent unknown resource use)
 *
 * ```ts
 * import { AgentConventionMeasurements } from "@beep/repo-cli/commands/AgentEffectiveness"
 * import * as O from "effect/Option"
 *
 * const measurements = AgentConventionMeasurements.make({
 *   elapsedMs: 1200, inputTokens: O.none(), outputTokens: O.none(),
 *   introducedDefects: O.none(), humanInterventions: O.some(0), acceptance: { check: "passed" }
 * })
 * console.log(O.isNone(measurements.inputTokens)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentConventionMeasurements extends S.Class<AgentConventionMeasurements>($I`AgentConventionMeasurements`)(
  {
    elapsedMs: NonNegativeMeasure,
    inputTokens: S.OptionFromNullOr(Count),
    outputTokens: S.OptionFromNullOr(Count),
    introducedDefects: S.OptionFromNullOr(Count),
    humanInterventions: S.OptionFromNullOr(Count),
    acceptance: S.Record(S.NonEmptyString, AcceptanceOutcome),
  },
  $I.annote("AgentConventionMeasurements", {
    description: "Reported outcomes and resource measurements for one trial.",
  })
) {}

/**
 * Portable receipt combining existing eval output with declared experiment controls.
 *
 * **Gotchas**
 *
 * The comparison command reads receipts only. It does not execute an agent,
 * verify source digests, inspect raw transcripts, or authenticate measurements.
 * Keep sensitive prompts and source content out of publicly shared receipts.
 *
 * **Example** (Reject an incomplete receipt)
 *
 * ```ts
 * import { AgentConventionTrial } from "@beep/repo-cli/commands/AgentEffectiveness"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AgentConventionTrial)({ schemaVersion: "agent-convention-trial/v1" })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentConventionTrial extends S.Class<AgentConventionTrial>($I`AgentConventionTrial`)(
  {
    schemaVersion: S.Literal("agent-convention-trial/v1"),
    runId: S.NonEmptyString,
    pairId: S.NonEmptyString,
    controls: AgentConventionControls,
    variant: AgentConventionVariant,
    evaluation: AgentEffectivenessEvalScoreReport,
    measurements: AgentConventionMeasurements,
  },
  $I.annote("AgentConventionTrial", {
    description: "One independently identified run in a declared paired convention experiment.",
  })
) {}

const ConventionSurface = LiteralKit(["guidance", "navigation", "handoff"]);
const ComparisonRefusal = LiteralKit([
  "controls-differ",
  "pair-differs",
  "run-reused",
  "task-mismatch",
  "invalid-score",
  "surface-count",
]);

/**
 * Candidate-minus-baseline differences without an aggregate score or winner.
 *
 * **Example** (Keep a missing token difference unknown)
 *
 * ```ts
 * import { AgentConventionDifferences } from "@beep/repo-cli/commands/AgentEffectiveness"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownOption(AgentConventionDifferences.fields.inputTokens)(null))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentConventionDifferences extends S.Class<AgentConventionDifferences>($I`AgentConventionDifferences`)(
  {
    completion: S.Finite,
    schemaFirst: S.Finite,
    tsgo: S.Finite,
    biome: S.Finite,
    violationCount: S.Int,
    acceptancePassed: S.Int,
    acceptanceNotRun: S.Int,
    elapsedMs: S.Finite,
    inputTokens: S.OptionFromNullOr(S.Int),
    outputTokens: S.OptionFromNullOr(S.Int),
    introducedDefects: S.OptionFromNullOr(S.Int),
    humanInterventions: S.OptionFromNullOr(S.Int),
  },
  $I.annote("AgentConventionDifferences", {
    description: "Separate outcome and resource differences; null differences remain unmeasured.",
  })
) {}

/**
 * A checked pairing decision with the original receipts retained for inspection.
 *
 * **Details**
 *
 * Comparable means the declared controls match and exactly one convention
 * surface changed. A single pair is descriptive evidence, not a causal finding.
 *
 * **Example** (Inspect the report version contract)
 *
 * ```ts
 * import { AgentConventionComparison } from "@beep/repo-cli/commands/AgentEffectiveness"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AgentConventionComparison.fields.schemaVersion)("agent-convention-comparison/v1")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentConventionComparison extends S.Class<AgentConventionComparison>($I`AgentConventionComparison`)(
  {
    schemaVersion: S.Literal("agent-convention-comparison/v1"),
    baseline: AgentConventionTrial,
    candidate: AgentConventionTrial,
    result: S.TaggedUnion({
      Comparable: { changedSurface: ConventionSurface, differences: AgentConventionDifferences },
      Incomparable: { reasons: S.NonEmptyArray(ComparisonRefusal) },
    }),
  },
  $I.annote("AgentConventionComparison", {
    description: "Auditable paired comparison or an explicit refusal to compare unmatched inputs.",
  })
) {}
