/**
 * Deterministic scoring helpers for agent-effectiveness evals.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { flow, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  AgentEffectivenessEvalScoreBreakdown,
  AgentEffectivenessEvalScoreReport,
  AgentEffectivenessEvalViolation,
} from "../AgentEffectiveness.schemas.ts";
import type { SkillOptTaskManifest } from "../AgentEffectiveness.schemas.ts";

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/EvalScoring");
const SCORE_FORMAT_DIGITS = 6;

class LawComponentScores extends S.Class<LawComponentScores>($I`LawComponentScores`)(
  {
    biome: S.Finite,
    schemaFirst: S.Finite,
    tsgo: S.Finite,
  },
  $I.annote("LawComponentScores", {
    description: "Scores for one eval task, one law lane.",
  })
) {}

/**
 * Completion-lane score for one eval task: the fraction of required skill
 * steps satisfied, paired with the violations that reduced it.
 *
 * **Example** (Make full completion result)
 *
 * ```ts
 * import { CompletionResult } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScoring"
 *
 * const result = CompletionResult.make({ fraction: 1, violations: [] })
 * ```
 *
 * @category scoring
 * @since 0.0.0
 */
export class CompletionResult extends S.Class<CompletionResult>($I`CompletionResult`)(
  {
    fraction: S.Finite,
    violations: S.Array(AgentEffectivenessEvalViolation),
  },
  $I.annote("CompletionResult", {
    description: "Result of a completion.",
  })
) {}

/**
 * Law-evaluation violations for one eval task, grouped by the schema-first,
 * tsgo, and biome lanes.
 *
 * **Example** (Make empty law evaluation)
 *
 * ```ts
 * import { LawEvaluation } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScoring"
 *
 * const evaluation = LawEvaluation.make({ schemaFirst: [], tsgo: [], biome: [] })
 * ```
 *
 * @category scoring
 * @since 0.0.0
 */
export class LawEvaluation extends S.Class<LawEvaluation>($I`LawEvaluation`)(
  {
    schemaFirst: S.Array(AgentEffectivenessEvalViolation),
    tsgo: S.Array(AgentEffectivenessEvalViolation),
    biome: S.Array(AgentEffectivenessEvalViolation),
  },
  $I.annote("LawEvaluation", {
    description: "Result of a law evaluation.",
  })
) {}

/**
 * Resolve the primary rule id for a skill-opt task, falling back to
 * `"completion"` when the task declares no rule ids.
 *
 * **Example** (Resolve primary rule id)
 *
 * ```ts
 * import { firstRuleId } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScoring"
 *
 * declare const task: Parameters<typeof firstRuleId>[0]
 * const ruleId: string = firstRuleId(task)
 * ```
 *
 * @param task - The skill-opt task manifest whose declared `ruleIds` are inspected.
 * @returns The first declared rule id, or `"completion"` when the task lists none.
 * @category scoring
 * @since 0.0.0
 */
export const firstRuleId = (task: SkillOptTaskManifest): string =>
  pipe(
    task.ruleIds,
    A.head,
    O.getOrElse(() => "completion")
  );

/**
 * Round a raw score to the report's fixed six-digit precision.
 *
 * **Example** (Round score six digits)
 *
 * ```ts
 * import { roundScore } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScoring"
 *
 * roundScore(0.5833349) // 0.583335
 * ```
 *
 * @param value - The raw, unrounded score to normalize for the report.
 * @returns The score rounded to the report's fixed six-digit precision.
 * @category scoring
 * @since 0.0.0
 */
export const roundScore = (value: number): number => globalThis.Number(value.toFixed(SCORE_FORMAT_DIGITS));

const scoreOrder = Order.combine(
  Order.mapInput(Order.String, (violation: AgentEffectivenessEvalViolation) => violation.source),
  Order.combine(
    Order.mapInput(Order.String, (violation: AgentEffectivenessEvalViolation) => violation.file),
    Order.combine(
      Order.mapInput(Order.Number, (violation: AgentEffectivenessEvalViolation) => violation.line),
      Order.combine(
        Order.mapInput(Order.String, (violation: AgentEffectivenessEvalViolation) => violation.ruleId),
        Order.mapInput(Order.String, (violation: AgentEffectivenessEvalViolation) => violation.message)
      )
    )
  )
);

const violationKey = (violation: AgentEffectivenessEvalViolation): string =>
  `${violation.source}\u0000${violation.ruleId}\u0000${violation.file}\u0000${violation.line}\u0000${violation.message}`;

/**
 * Deduplicate violations by identity and sort them into the report's stable
 * source/file/line/rule/message order.
 *
 * **Example** (Sort empty violations)
 *
 * ```ts
 * import { sortViolations } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScoring"
 *
 * const ordered = sortViolations([])
 * ```
 *
 * @category scoring
 * @since 0.0.0
 */
export const sortViolations: (
  violations: ReadonlyArray<AgentEffectivenessEvalViolation>
) => ReadonlyArray<AgentEffectivenessEvalViolation> = flow(
  A.dedupeWith((left, right) => violationKey(left) === violationKey(right)),
  A.sort(scoreOrder)
);

/**
 * Map a component's violation count to a deterministic [0, 1] law score.
 *
 * The scorer uses monotone reciprocal decay: `1 / (1 + violations)`.
 * One finding maps to `0.5`, two findings to `0.333333`, and zero findings to
 * `1`. The mapping is deterministic, bounded, and gives every additional
 * violation diminishing but nonzero penalty.
 *
 * @param violationCount - Number of violations the component reported.
 * @returns Component score in `[0, 1]`.
 * @category scoring
 * @since 0.0.0
 */
export const lawComponentScore = (violationCount: number): number => roundScore(1 / (1 + violationCount));

/**
 * Aggregate law components by arithmetic mean.
 *
 * Schema-first lint, tsgo diagnostics, and biome diagnostics each first use
 * {@link lawComponentScore}; `law_frac` is the deterministic arithmetic mean
 * of those three component scores.
 *
 * @param scores - Schema-first, tsgo, and Biome component scores.
 * @returns Mean law fraction in `[0, 1]`.
 * @category scoring
 * @since 0.0.0
 */
const aggregateLawFraction = ({ biome, schemaFirst, tsgo }: LawComponentScores): number =>
  roundScore((schemaFirst + tsgo + biome) / 3);

/**
 * Build the final score report from completion and law evaluations.
 *
 * The contract formula is fixed as `score = completion_frac * law_frac`.
 * `law_frac` is the arithmetic mean of schema-first, tsgo, and biome
 * component scores, where each component is `1 / (1 + violations)`.
 *
 * @param task - Task manifest the fixture was scored against.
 * @param completion - Completion-check outcome for the fixture.
 * @param law - Law-component violation sets for the fixture.
 * @returns Deterministic score report with breakdown and sorted violations.
 * @category scoring
 * @since 0.0.0
 */
const buildAgentEffectivenessEvalScoreReport = (
  task: SkillOptTaskManifest,
  completion: CompletionResult,
  law: LawEvaluation
): AgentEffectivenessEvalScoreReport => {
  const schemaFirst = lawComponentScore(A.length(law.schemaFirst));
  const tsgo = lawComponentScore(A.length(law.tsgo));
  const biome = lawComponentScore(A.length(law.biome));
  const lawFraction = aggregateLawFraction({ biome, schemaFirst, tsgo });
  const violations = sortViolations([...completion.violations, ...law.schemaFirst, ...law.tsgo, ...law.biome]);
  return AgentEffectivenessEvalScoreReport.make({
    taskId: task.id,
    score: roundScore(completion.fraction * lawFraction),
    breakdown: AgentEffectivenessEvalScoreBreakdown.make({
      completion: completion.fraction,
      schemaFirst,
      tsgo,
      biome,
    }),
    violations,
  });
};

/**
 * Internal score-report builder functions used by the eval scorer facade.
 *
 * **Example** (Aggregate law fraction)
 *
 * ```ts
 * import { EvalScoring } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScoring"
 *
 * console.log(EvalScoring.aggregateLawFraction({ schemaFirst: 1, tsgo: 0.5, biome: 0.25 })) // 0.583333
 * ```
 *
 * @category scoring
 * @since 0.0.0
 */
export const EvalScoring = {
  aggregateLawFraction,
  buildAgentEffectivenessEvalScoreReport,
} as const;
