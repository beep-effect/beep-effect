/**
 * Request and result schemas for the merge-time completion evidence provider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { MergeGateCheckRun } from "../Yeet/internal/MergeGate.schemas.ts";
import { GhBranchRule } from "../Yeet/internal/Settle.ts";
import {
  GoalRequiredCheckFact,
  GoalRequiredCheckSnapshot,
  GoalRuleEnforcement,
  GoalRuleEvaluationResult,
  GoalRuleSuiteResult,
} from "./Goals.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/CompletionEvidence.schemas");

/**
 * One GitHub check run on a commit, with its head and timing.
 *
 * **Details**
 *
 * This is the shape the completion observation already fetches from
 * `commits/<head>/check-runs?filter=all`. `filter=all` keeps reruns, so a
 * post-merge rerun cannot erase a pre-merge result.
 *
 * **Example** (Inspect the check-run head field)
 *
 * ```ts
 * import { GoalObservedCheckRun } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * console.log(GoalObservedCheckRun.fields.head_sha)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalObservedCheckRun extends S.Opaque<GoalObservedCheckRun, { readonly brand: unique symbol }>()(
  S.Struct({
    ...MergeGateCheckRun.fields,
    head_sha: S.NonEmptyString,
    started_at: S.OptionFromNullOr(S.DateTimeUtcFromString),
    completed_at: S.OptionFromNullOr(S.DateTimeUtcFromString),
  }).pipe(
    $I.annoteSchema("GoalObservedCheckRun", {
      description: "One GitHub check run on a commit, with its head and timing.",
    })
  )
) {}

/**
 * The merge facts the completion observation already holds when it asks for merge-time evidence.
 *
 * **Details**
 *
 * The provider takes the pull request's base ref, merge commit, merge time,
 * accepted head and the check runs the CLI already read. It reads only the
 * ruleset inventory, ruleset history and rule suite itself.
 *
 * **Example** (Inspect the request boundary)
 *
 * ```ts
 * import { GoalMergeTimeEvidenceRequest } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * console.log(GoalMergeTimeEvidenceRequest.fields.mergeCommit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalMergeTimeEvidenceRequest extends S.Opaque<
  GoalMergeTimeEvidenceRequest,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    base: S.NonEmptyString,
    mergeCommit: S.NonEmptyString,
    mergedAt: S.DateTimeUtcFromString,
    acceptedHead: S.NonEmptyString,
    checkRuns: S.Array(GoalObservedCheckRun),
  }).pipe(
    $I.annoteSchema("GoalMergeTimeEvidenceRequest", {
      description: "Merge facts and check runs the completion observation already holds.",
    })
  )
) {}

/**
 * The merge-time required-check inventory and the head-bound result of every required context.
 *
 * **Details**
 *
 * `requiredChecks` is absent only when no ruleset source could be read at all.
 * `facts` holds one entry per required context, in context order.
 *
 * **Example** (Inspect the evidence result)
 *
 * ```ts
 * import { GoalMergeTimeEvidence } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * console.log(GoalMergeTimeEvidence.fields.facts)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalMergeTimeEvidence extends S.Opaque<GoalMergeTimeEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    requiredChecks: S.Option(GoalRequiredCheckSnapshot),
    facts: S.Array(GoalRequiredCheckFact),
  }).pipe(
    $I.annoteSchema("GoalMergeTimeEvidence", {
      description: "Merge-time required-check inventory with one head-bound fact per required context.",
    })
  )
) {}

/**
 * Inputs to the pure completion-evidence verdict.
 *
 * **Example** (Inspect the verdict input)
 *
 * ```ts
 * import { GoalCompletionEvidenceInput } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * console.log(GoalCompletionEvidenceInput.fields.facts)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCompletionEvidenceInput extends S.Opaque<
  GoalCompletionEvidenceInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    acceptedHead: S.Option(S.NonEmptyString),
    mergeCommit: S.Option(S.NonEmptyString),
    requiredChecks: S.Option(GoalRequiredCheckSnapshot),
    facts: S.Array(GoalRequiredCheckFact),
  }).pipe(
    $I.annoteSchema("GoalCompletionEvidenceInput", {
      description: "Accepted head, merge commit, stored merge-time inventory and head-bound facts for the verdict.",
    })
  )
) {}

/**
 * Wire decoder for completion Pull observations shared by the live and fixture ports.
 *
 * **Example** (Inspect the completion Pull decoder)
 *
 * ```ts
 * import { GoalCompletionPull } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(GoalCompletionPull))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GoalCompletionPull extends S.Opaque<GoalCompletionPull, { readonly brand: unique symbol }>()(
  S.Struct({
    created_at: S.DateTimeUtcFromString,
    number: S.Int,
    merged: S.Boolean,
    merged_at: S.OptionFromNullOr(S.DateTimeUtcFromString),
    merge_commit_sha: S.OptionFromNullOr(S.NonEmptyString),
    head: S.Struct({ sha: S.NonEmptyString }),
    base: S.Struct({ ref: S.NonEmptyString, repo: S.Struct({ full_name: S.NonEmptyString }) }),
  }).pipe($I.annoteSchema("GoalCompletionPull", { description: "Completion Pull wire observation." }))
) {}
/**
 * Wire decoder for completion Commit observations shared by the live and fixture ports.
 *
 * **Example** (Inspect the completion Commit decoder)
 *
 * ```ts
 * import { GoalCompletionCommit } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(GoalCompletionCommit))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GoalCompletionCommit extends S.Opaque<GoalCompletionCommit, { readonly brand: unique symbol }>()(
  S.Struct({
    sha: S.NonEmptyString,
    parents: S.Array(S.Struct({ sha: S.NonEmptyString })),
    commit: S.Struct({ tree: S.Struct({ sha: S.NonEmptyString }) }),
  }).pipe($I.annoteSchema("GoalCompletionCommit", { description: "Completion Commit wire observation." }))
) {}
class GoalCompletionCheckPage extends S.Opaque<GoalCompletionCheckPage, { readonly brand: unique symbol }>()(
  S.Struct({ check_runs: S.Array(GoalObservedCheckRun) }).pipe(
    $I.annoteSchema("GoalCompletionCheckPage", { description: "One completion CheckPage wire observation." })
  )
) {}

/**
 * Wire decoder for completion CheckPages observations shared by the live and fixture ports.
 *
 * **Example** (Inspect the completion CheckPages decoder)
 *
 * ```ts
 * import { GoalCompletionCheckPages } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(GoalCompletionCheckPages))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalCompletionCheckPages = GoalCompletionCheckPage.pipe(
  S.Array,
  $I.annoteSchema("GoalCompletionCheckPages", { description: "Completion CheckPages wire observation." })
);
/**
 * Decoded completion CheckPages observation.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalCompletionCheckPages = typeof GoalCompletionCheckPages.Type;
class GoalCompletionTimelineEvent extends S.Opaque<GoalCompletionTimelineEvent, { readonly brand: unique symbol }>()(
  S.Struct({ event: S.String, created_at: S.optionalKey(S.DateTimeUtcFromString) }).pipe(
    $I.annoteSchema("GoalCompletionTimelineEvent", { description: "One completion TimelineEvent wire observation." })
  )
) {}

/**
 * Wire decoder for completion TimelinePages observations shared by the live and fixture ports.
 *
 * **Example** (Inspect the completion TimelinePages decoder)
 *
 * ```ts
 * import { GoalCompletionTimelinePages } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(GoalCompletionTimelinePages))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalCompletionTimelinePages = GoalCompletionTimelineEvent.pipe(
  S.Array,
  S.Array,
  $I.annoteSchema("GoalCompletionTimelinePages", { description: "Completion TimelinePages wire observation." })
);
/**
 * Decoded completion TimelinePages observation.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalCompletionTimelinePages = typeof GoalCompletionTimelinePages.Type;
/**
 * Wire decoder for completion RulesetListEntry observations shared by the live and fixture ports.
 *
 * **Example** (Inspect the completion RulesetListEntry decoder)
 *
 * ```ts
 * import { GoalCompletionRulesetListEntry } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(GoalCompletionRulesetListEntry))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GoalCompletionRulesetListEntry extends S.Opaque<
  GoalCompletionRulesetListEntry,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    id: S.Int,
    source_type: S.String,
    created_at: S.optionalKey(S.DateTimeUtcFromString),
  }).pipe(
    $I.annoteSchema("GoalCompletionRulesetListEntry", { description: "Completion RulesetListEntry wire observation." })
  )
) {}
/**
 * Wire decoder for completion RulesetList observations shared by the live and fixture ports.
 *
 * **Example** (Inspect the completion RulesetList decoder)
 *
 * ```ts
 * import { GoalCompletionRulesetList } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(GoalCompletionRulesetList))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalCompletionRulesetList = GoalCompletionRulesetListEntry.pipe(
  S.Array,
  S.Array,
  $I.annoteSchema("GoalCompletionRulesetList", { description: "Completion RulesetList wire observation." })
);
/**
 * Decoded completion RulesetList observation.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalCompletionRulesetList = typeof GoalCompletionRulesetList.Type;
class GoalCompletionRulesetHistoryEntry extends S.Opaque<
  GoalCompletionRulesetHistoryEntry,
  { readonly brand: unique symbol }
>()(
  S.Struct({ version_id: S.Int, updated_at: S.DateTimeUtcFromString }).pipe(
    $I.annoteSchema("GoalCompletionRulesetHistoryEntry", {
      description: "One completion RulesetHistoryEntry wire observation.",
    })
  )
) {}

/**
 * Wire decoder for completion RulesetHistory observations shared by the live and fixture ports.
 *
 * **Example** (Inspect the completion RulesetHistory decoder)
 *
 * ```ts
 * import { GoalCompletionRulesetHistory } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(GoalCompletionRulesetHistory))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalCompletionRulesetHistory = GoalCompletionRulesetHistoryEntry.pipe(
  S.Array,
  S.Array,
  $I.annoteSchema("GoalCompletionRulesetHistory", { description: "Completion RulesetHistory wire observation." })
);
/**
 * Decoded completion RulesetHistory observation.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalCompletionRulesetHistory = typeof GoalCompletionRulesetHistory.Type;
/**
 * Wire decoder for completion RulesetVersion observations shared by the live and fixture ports.
 *
 * **Example** (Inspect the completion RulesetVersion decoder)
 *
 * ```ts
 * import { GoalCompletionRulesetVersion } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(GoalCompletionRulesetVersion))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GoalCompletionRulesetVersion extends S.Opaque<
  GoalCompletionRulesetVersion,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    state: S.Struct({
      enforcement: S.String,
      target: S.String,
      conditions: S.Struct({ ref_name: S.Struct({ include: S.Array(S.String), exclude: S.Array(S.String) }) }),
      rules: S.Array(GhBranchRule),
    }),
  }).pipe(
    $I.annoteSchema("GoalCompletionRulesetVersion", { description: "Completion RulesetVersion wire observation." })
  )
) {}
class GoalCompletionRuleSuiteListEntry extends S.Opaque<
  GoalCompletionRuleSuiteListEntry,
  { readonly brand: unique symbol }
>()(
  S.Struct({ id: S.Int, ref: S.String, after_sha: S.String }).pipe(
    $I.annoteSchema("GoalCompletionRuleSuiteListEntry", {
      description: "One completion RuleSuiteListEntry wire observation.",
    })
  )
) {}

/**
 * Wire decoder for completion RuleSuiteList observations shared by the live and fixture ports.
 *
 * **Example** (Inspect the completion RuleSuiteList decoder)
 *
 * ```ts
 * import { GoalCompletionRuleSuiteList } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(GoalCompletionRuleSuiteList))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalCompletionRuleSuiteList = GoalCompletionRuleSuiteListEntry.pipe(
  S.Array,
  S.Array,
  $I.annoteSchema("GoalCompletionRuleSuiteList", { description: "Completion RuleSuiteList wire observation." })
);
/**
 * Decoded completion RuleSuiteList observation.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalCompletionRuleSuiteList = typeof GoalCompletionRuleSuiteList.Type;
const RuleEvaluation = S.Struct({
  rule_source: S.Struct({
    type: S.NonEmptyString,
    id: S.OptionFromOptionalNullOr(S.Int),
    name: S.OptionFromOptionalNullOr(S.String),
  }),
  enforcement: GoalRuleEnforcement,
  result: GoalRuleEvaluationResult,
  rule_type: S.NonEmptyString,
});
/**
 * Wire decoder for completion RuleSuite observations shared by the live and fixture ports.
 *
 * **Example** (Inspect the completion RuleSuite decoder)
 *
 * ```ts
 * import { GoalCompletionRuleSuite } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(GoalCompletionRuleSuite))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GoalCompletionRuleSuite extends S.Opaque<GoalCompletionRuleSuite, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int,
    ref: S.NonEmptyString,
    after_sha: S.NonEmptyString,
    pushed_at: S.DateTimeUtcFromString,
    result: GoalRuleSuiteResult,
    rule_evaluations: S.Array(RuleEvaluation),
  }).pipe($I.annoteSchema("GoalCompletionRuleSuite", { description: "Completion RuleSuite wire observation." }))
) {}

class GoalCompletionSuitePage extends S.Opaque<GoalCompletionSuitePage, { readonly brand: unique symbol }>()(
  S.Struct({ check_suites: S.Array(S.Struct({ created_at: S.DateTimeUtcFromString })) }).pipe(
    $I.annoteSchema("GoalCompletionSuitePage", { description: "One completion SuitePage wire observation." })
  )
) {}

/**
 * Wire decoder for completion SuitePages observations shared by the live and fixture ports.
 *
 * **Example** (Inspect the completion SuitePages decoder)
 *
 * ```ts
 * import { GoalCompletionSuitePages } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(GoalCompletionSuitePages))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalCompletionSuitePages = GoalCompletionSuitePage.pipe(
  S.Array,
  $I.annoteSchema("GoalCompletionSuitePages", { description: "Completion SuitePages wire observation." })
);
/**
 * Decoded completion SuitePages observation.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalCompletionSuitePages = typeof GoalCompletionSuitePages.Type;
