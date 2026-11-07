/**
 * Goal-packet manifest schemas (`GoalManifest` v2).
 *
 * **Details**
 *
 * Canonical schema surface for `goals/<slug>/ops/manifest.json`: the 5-state
 * lifecycle domain, the normalized phase-status domain, and the lenient
 * {@link GoalManifest} class whose decoder accepts every legacy wire shape
 * observed in the 2026-07-11 census (`initiative-manifest/v1`, `1.0.0`, and
 * version-less manifests) while typing exactly the fields the goals tooling
 * reads. Unknown manifest keys are ignored on decode so bespoke packet fields
 * keep their wire shape.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { ArchiveRecord, RetentionReason } from "./Archive.schemas.ts";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Goals/Goals.schemas");

/**
 * Canonical goal-packet lifecycle states.
 *
 * **Details**
 *
 * `active` packets are executing (and must carry a `GOAL.md` launcher),
 * `paused` packets are intentionally stopped with explicit resume conditions,
 * `completed-retained` packets shipped and remain as evidence, `superseded`
 * packets were replaced by a successor, and `reference` packets are retained
 * research or design precedent.
 *
 * **Example** (Narrow and enumerate lifecycle states)
 *
 * ```ts
 * import { GoalStatus } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(GoalStatus.is.active("active")) // true
 * console.log(GoalStatus.literals.length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalStatus = LiteralKit(["active", "paused", "completed-retained", "superseded", "reference"]).pipe(
  $I.annoteSchema("GoalStatus", {
    description: "Canonical 5-state goal-packet lifecycle domain.",
  })
);

/**
 * Canonical goal-packet lifecycle state.
 *
 * **Example** (Annotate a lifecycle value)
 *
 * ```ts
 * import type { GoalStatus } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const status: GoalStatus = "completed-retained"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalStatus = typeof GoalStatus.Type;

/**
 * Derived guard for {@link GoalStatus}.
 *
 * **Example** (Validate a lifecycle string)
 *
 * ```ts
 * import { isGoalStatus } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(isGoalStatus("paused")) // true
 * console.log(isGoalStatus("DONE")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isGoalStatus = S.is(GoalStatus);

/**
 * Canonical normalized phase statuses inside a goal manifest.
 *
 * **Details**
 *
 * `superseded` marks a phase whose work moved to another packet (record the
 * successor in a phase-level `supersededBy`); it is terminal for that packet
 * but deliberately not `complete`, so all-phases-complete checks stay honest.
 *
 * **Example** (Distinguish complete from superseded)
 *
 * ```ts
 * import { GoalPhaseStatus } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(GoalPhaseStatus.is.complete("complete")) // true
 * console.log(GoalPhaseStatus.is.superseded("superseded")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalPhaseStatus = LiteralKit(["pending", "in-progress", "complete", "superseded"]).pipe(
  $I.annoteSchema("GoalPhaseStatus", {
    description: "Canonical normalized goal-phase status domain (superseded = moved to another packet).",
  })
);

/**
 * Canonical normalized goal-phase status.
 *
 * **Example** (Annotate a phase status value)
 *
 * ```ts
 * import type { GoalPhaseStatus } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const status: GoalPhaseStatus = "in-progress"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalPhaseStatus = typeof GoalPhaseStatus.Type;

/**
 * Derived guard for {@link GoalPhaseStatus}.
 *
 * **Example** (Reject an unknown phase status)
 *
 * ```ts
 * import { isGoalPhaseStatus } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(isGoalPhaseStatus("pending")) // true
 * console.log(isGoalPhaseStatus("seeded")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isGoalPhaseStatus = S.is(GoalPhaseStatus);

/**
 * Known goal-manifest schema versions.
 *
 * **Details**
 *
 * `initiative-manifest/v2` is canonical; `initiative-manifest/v1` and `1.0.0`
 * are accepted legacy versions that surface an advisory upgrade finding in
 * `beep goals doctor`.
 *
 * **Example** (Recognize the canonical schema version)
 *
 * ```ts
 * import { GoalManifestSchemaVersion } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(GoalManifestSchemaVersion.is["initiative-manifest/v2"]("initiative-manifest/v2"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalManifestSchemaVersion = LiteralKit(["initiative-manifest/v2", "initiative-manifest/v1", "1.0.0"]).pipe(
  $I.annoteSchema("GoalManifestSchemaVersion", {
    description: "Known goal-manifest schema versions (v2 canonical, v1 and 1.0.0 legacy).",
  })
);

/**
 * Known goal-manifest schema version.
 *
 * **Example** (Annotate a manifest schema version)
 *
 * ```ts
 * import type { GoalManifestSchemaVersion } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const version: GoalManifestSchemaVersion = "initiative-manifest/v2"
 * console.log(version)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalManifestSchemaVersion = typeof GoalManifestSchemaVersion.Type;

/**
 * Distinguishes the final delivery PR from supporting work.
 *
 * **Example** (GoalPullRequestRole boundary)
 *
 * ```ts
 * import { GoalPullRequestRole } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalPullRequestRole.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalPullRequestRole = LiteralKit(["final", "supporting"]).pipe(
  $I.annoteSchema("GoalPullRequestRole", { description: "Distinguishes the final delivery PR from supporting work." })
);
/**
 * Distinguishes the final delivery PR from supporting work.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalPullRequestRole = typeof GoalPullRequestRole.Type;

/**
 * Names the evidence provider used to accept a goal.
 *
 * **Example** (GoalAcceptanceEvidenceKind boundary)
 *
 * ```ts
 * import { GoalAcceptanceEvidenceKind } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalAcceptanceEvidenceKind.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalAcceptanceEvidenceKind = LiteralKit([
  "hosted-required-checks",
  "yeet-verdict",
  "proof-fact",
  "packet-history",
]).pipe(
  $I.annoteSchema("GoalAcceptanceEvidenceKind", { description: "Names the evidence provider used to accept a goal." })
);
/**
 * Names the evidence provider used to accept a goal.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalAcceptanceEvidenceKind = typeof GoalAcceptanceEvidenceKind.Type;

/**
 * Names the independently observed GitHub merge workflow.
 *
 * **Example** (GoalMergeMethod boundary)
 *
 * ```ts
 * import { GoalMergeMethod } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalMergeMethod.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalMergeMethod = LiteralKit(["squash", "merge", "rebase"]).pipe(
  $I.annoteSchema("GoalMergeMethod", { description: "Names the independently observed GitHub merge workflow." })
);
/**
 * Names the independently observed GitHub merge workflow.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalMergeMethod = typeof GoalMergeMethod.Type;

/**
 * Separates affirmative completion, contrary facts, and missing observations.
 *
 * **Example** (GoalCompletionOutcome boundary)
 *
 * ```ts
 * import { GoalCompletionOutcome } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalCompletionOutcome.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalCompletionOutcome = LiteralKit(["verified", "unsatisfied", "unknown"]).pipe(
  $I.annoteSchema("GoalCompletionOutcome", {
    description: "Separates affirmative completion, contrary facts, and missing observations.",
  })
);
/**
 * Separates affirmative completion, contrary facts, and missing observations.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalCompletionOutcome = typeof GoalCompletionOutcome.Type;

/**
 * Attributes non-required failures without treating their conclusion as a waiver.
 *
 * **Example** (GoalRedAttribution boundary)
 *
 * ```ts
 * import { GoalRedAttribution } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalRedAttribution.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalRedAttribution = LiteralKit(["inherited", "introduced", "mixed", "unknown"]).pipe(
  $I.annoteSchema("GoalRedAttribution", {
    description: "Attributes non-required failures without treating their conclusion as a waiver.",
  })
);
/**
 * Attributes non-required failures without treating their conclusion as a waiver.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalRedAttribution = typeof GoalRedAttribution.Type;

/**
 * Declares one pull request by number and delivery role.
 *
 * **Example** (GoalPullRequestRef boundary)
 *
 * ```ts
 * import { GoalPullRequestRef } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalPullRequestRef.make({ number: 1429, role: "final" }).number)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalPullRequestRef extends S.Opaque<GoalPullRequestRef, { readonly brand: unique symbol }>()(
  S.Struct({ number: S.Int.check(S.isGreaterThan(0)), role: GoalPullRequestRole }).pipe(
    $I.annoteSchema("GoalPullRequestRef", { description: "Declares one pull request by number and delivery role." })
  )
) {}

/**
 * Points to acceptance evidence bound to a commit, with an explicit gating policy.
 *
 * **Example** (GoalAcceptanceEvidenceRef boundary)
 *
 * ```ts
 * import { GoalAcceptanceEvidenceRef } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalAcceptanceEvidenceRef.make({ kind: "hosted-required-checks", ref: "required", gating: true }).gating)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalAcceptanceEvidenceRef extends S.Opaque<GoalAcceptanceEvidenceRef, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: GoalAcceptanceEvidenceKind,
    ref: S.NonEmptyString,
    gating: S.Boolean.pipe(S.withDecodingDefaultKey(Effect.succeed(true))),
  }).pipe(
    $I.annoteSchema("GoalAcceptanceEvidenceRef", {
      description: "Points to acceptance evidence bound to a commit, with an explicit gating policy.",
    })
  )
) {}

/**
 * Records GitHub merge identity and tree without requiring squash-head ancestry.
 *
 * **Example** (GoalMergeResult boundary)
 *
 * ```ts
 * import { GoalMergeResult } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalMergeResult.fields.baseRef)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalMergeResult extends S.Opaque<GoalMergeResult, { readonly brand: unique symbol }>()(
  S.Struct({
    mergeCommit: S.NonEmptyString,
    tree: S.NonEmptyString,
    mergedAt: S.DateTimeUtcFromString,
    method: S.OptionFromNullOr(GoalMergeMethod),
    baseRef: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("GoalMergeResult", {
      description: "Records GitHub merge identity and tree without requiring squash-head ancestry.",
    })
  )
) {}

/**
 * Records the outcome and observed head of one acceptance reference.
 *
 * **Example** (GoalEvidenceCheck boundary)
 *
 * ```ts
 * import { GoalEvidenceCheck } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalEvidenceCheck.fields.outcome)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalEvidenceCheck extends S.Opaque<GoalEvidenceCheck, { readonly brand: unique symbol }>()(
  S.Struct({
    ref: GoalAcceptanceEvidenceRef,
    outcome: GoalCompletionOutcome,
    observedHead: S.OptionFromNullOr(S.NonEmptyString),
    detail: S.String,
  }).pipe(
    $I.annoteSchema("GoalEvidenceCheck", {
      description: "Records the outcome and observed head of one acceptance reference.",
    })
  )
) {}

/**
 * Names check conclusions without conflating pending observations and terminal failures.
 *
 * **Example** (Recognize pending checks)
 *
 * ```ts
 * import { GoalCheckConclusion } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalCheckConclusion.is.pending("pending"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalCheckConclusion = LiteralKit([
  "pending",
  "success",
  "failure",
  "neutral",
  "skipped",
  "cancelled",
  "timed_out",
  "action_required",
  "stale",
  "startup_failure",
  "unknown",
]).pipe(
  $I.annoteSchema("GoalCheckConclusion", {
    description: "GitHub check conclusion or explicit pending/unknown observation.",
  })
);
/**
 * A GitHub conclusion or explicit pending/unknown observation.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalCheckConclusion = typeof GoalCheckConclusion.Type;

/**
 * Names the GitHub record that supplied one merge-time completion fact.
 *
 * **Details**
 *
 * `rule-suite` is GitHub's evaluation of every rule source at the merge push,
 * `ruleset-version` is the ruleset history version effective at merge, and
 * `check-run` is a check result on the accepted head.
 *
 * **Example** (Enumerate fact sources)
 *
 * ```ts
 * import { GoalEvidenceFactSource } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalEvidenceFactSource.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalEvidenceFactSource = LiteralKit(["rule-suite", "ruleset-version", "check-run"]).pipe(
  $I.annoteSchema("GoalEvidenceFactSource", {
    description: "GitHub record that supplied one merge-time completion fact.",
  })
);
/**
 * GitHub record that supplied one merge-time completion fact.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalEvidenceFactSource = typeof GoalEvidenceFactSource.Type;

/**
 * Names why merge-time completion evidence stays unknown.
 *
 * **Details**
 *
 * Every gap blocks verification. `network-failure` is a failed GitHub read,
 * `rule-suite-unavailable` means GitHub kept no rule suite for the merge push
 * (rule-suite listing reaches back one month), and
 * `deleted-ruleset-unrecoverable` means the merge push evaluated a ruleset
 * whose history GitHub no longer serves.
 *
 * **Example** (Recognize a deleted-ruleset gap)
 *
 * ```ts
 * import { GoalCompletionEvidenceGap } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalCompletionEvidenceGap.is["deleted-ruleset-unrecoverable"]("deleted-ruleset-unrecoverable"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalCompletionEvidenceGap = LiteralKit([
  "network-failure",
  "inventory-unobserved",
  "rule-suite-unavailable",
  "deleted-ruleset-unrecoverable",
  "unsupported-rule-source",
  "inventory-mismatch",
  "partial-ruleset-reads",
  "required-check-unobserved",
]).pipe(
  $I.annoteSchema("GoalCompletionEvidenceGap", {
    description: "Reason merge-time completion evidence is incomplete and therefore unknown.",
  })
);
/**
 * Reason merge-time completion evidence is incomplete and therefore unknown.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalCompletionEvidenceGap = typeof GoalCompletionEvidenceGap.Type;

/**
 * Names GitHub's overall rule-suite result for one push.
 *
 * **Example** (Recognize a bypassed push)
 *
 * ```ts
 * import { GoalRuleSuiteResult } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalRuleSuiteResult.is.bypass("bypass"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalRuleSuiteResult = LiteralKit(["pass", "fail", "bypass"]).pipe(
  $I.annoteSchema("GoalRuleSuiteResult", { description: "GitHub's overall rule-suite result for one push." })
);
/**
 * GitHub's overall rule-suite result for one push.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalRuleSuiteResult = typeof GoalRuleSuiteResult.Type;

/**
 * Names GitHub's result for one evaluated rule.
 *
 * **Example** (Recognize a failed rule)
 *
 * ```ts
 * import { GoalRuleEvaluationResult } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalRuleEvaluationResult.is.fail("fail"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalRuleEvaluationResult = LiteralKit(["pass", "fail"]).pipe(
  $I.annoteSchema("GoalRuleEvaluationResult", { description: "GitHub's result for one evaluated rule." })
);
/**
 * GitHub's result for one evaluated rule.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalRuleEvaluationResult = typeof GoalRuleEvaluationResult.Type;

/**
 * Names how GitHub enforced one evaluated rule source.
 *
 * **Details**
 *
 * GitHub reports `deleted ruleset` for an evaluation whose ruleset was later deleted.
 *
 * **Example** (Recognize a deleted ruleset evaluation)
 *
 * ```ts
 * import { GoalRuleEnforcement } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalRuleEnforcement.is["deleted ruleset"]("deleted ruleset"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalRuleEnforcement = LiteralKit(["active", "evaluate", "deleted ruleset"]).pipe(
  $I.annoteSchema("GoalRuleEnforcement", { description: "How GitHub enforced one evaluated rule source." })
);
/**
 * How GitHub enforced one evaluated rule source.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalRuleEnforcement = typeof GoalRuleEnforcement.Type;

/**
 * Names what recovered ruleset history says about a rule source at merge.
 *
 * **Details**
 *
 * `unread` means no history was read (or none could be recovered). `gating`
 * means the version effective at merge was active and applied to the base
 * branch. `not-gating` means it was in evaluate mode, so it did not gate the
 * merge. `conflicting` means it was inactive, did not target branches, or did
 * not match the base branch, although GitHub evaluated it on that branch at the
 * push: the two GitHub records disagree, so the inventory is a mismatch.
 *
 * **Example** (Recognize a non-gating history)
 *
 * ```ts
 * import { GoalRuleSourceHistory } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalRuleSourceHistory.is["not-gating"]("not-gating"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalRuleSourceHistory = LiteralKit(["unread", "gating", "not-gating", "conflicting"]).pipe(
  $I.annoteSchema("GoalRuleSourceHistory", {
    description: "What recovered ruleset history says about a rule source at merge.",
  })
);
/**
 * What recovered ruleset history says about a rule source at merge.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalRuleSourceHistory = typeof GoalRuleSourceHistory.Type;

/**
 * Records one rule source GitHub evaluated at the merge push and the history version read for it.
 *
 * **Details**
 *
 * `requiredStatusChecks` is GitHub's own merge-time result for the source's
 * required-status-checks rule, absent when the source has no such rule.
 * `survives` says whether current ruleset enumeration still lists the source.
 * `version` is the ruleset history endpoint read for the merge time; it is
 * absent when no version could be recovered. `history` records whether that
 * version gated the merge, which overrides the push-time `deleted ruleset`
 * enforcement of a ruleset deleted since then.
 *
 * **Example** (Inspect a rule-source record)
 *
 * ```ts
 * import { GoalMergeTimeRuleSource } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalMergeTimeRuleSource.fields.version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalMergeTimeRuleSource extends S.Opaque<GoalMergeTimeRuleSource, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceType: S.NonEmptyString,
    rulesetId: S.OptionFromNullOr(S.Int),
    name: S.OptionFromNullOr(S.String),
    enforcement: GoalRuleEnforcement,
    requiredStatusChecks: S.OptionFromNullOr(GoalRuleEvaluationResult),
    survives: S.Boolean,
    version: S.OptionFromNullOr(S.NonEmptyString),
    history: GoalRuleSourceHistory.pipe(S.withConstructorDefault(Effect.succeed<GoalRuleSourceHistory>("unread"))),
  }).pipe(
    $I.annoteSchema("GoalMergeTimeRuleSource", {
      description: "One rule source GitHub evaluated at the merge push, with its merge-time history version.",
    })
  )
) {}

const GoalMergeTimeRuleSourceWire = S.toEncoded(
  S.Struct({
    ...GoalMergeTimeRuleSource.fields,
    history: S.optionalKey(GoalRuleSourceHistory),
  })
);

/**
 * Stored rule-source codec that reads receipts written before `history` existed.
 *
 * **Details**
 *
 * The earlier writer recorded a `version` only for a ruleset whose history
 * applied at merge, so a stored row with a version and no `history` decodes as
 * `gating` (failing closed: its failed required checks stay red). A row with
 * neither decodes as `unread`. Rows with `history` decode unchanged, and
 * encoding always writes `history`.
 *
 * **Example** (Decode a legacy row with a recovered version)
 *
 * ```ts
 * import { GoalMergeTimeRuleSourceRecord } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(GoalMergeTimeRuleSourceRecord)({
 *   sourceType: "ruleset",
 *   rulesetId: 999,
 *   name: null,
 *   enforcement: "deleted ruleset",
 *   requiredStatusChecks: "fail",
 *   survives: false,
 *   version: "repos/{owner}/{repo}/rulesets/999/history/1",
 * })
 * console.log(row.history) // "gating"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const GoalMergeTimeRuleSourceRecord = GoalMergeTimeRuleSourceWire.pipe(
  S.decodeTo(
    GoalMergeTimeRuleSource,
    SchemaTransformation.transform({
      decode: (wire): typeof GoalMergeTimeRuleSource.Encoded => ({
        ...wire,
        history: wire.history ?? (wire.version === null ? "unread" : "gating"),
      }),
      encode: (encoded) => encoded,
    })
  ),
  $I.annoteSchema("GoalMergeTimeRuleSourceRecord", {
    description: "Stored rule source; a legacy row with a recovered version and no history decodes as gating.",
  })
);

/**
 * Records GitHub's rule suite for the merge push: the complete rule-source inventory at merge.
 *
 * **Details**
 *
 * The rule suite lists every rule source GitHub evaluated for the push that
 * created the merge commit, including rulesets deleted since then. `afterSha`
 * must equal the merge commit for the inventory to bind to the merge.
 *
 * **Example** (Inspect the inventory source)
 *
 * ```ts
 * import { GoalMergeTimeInventory } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalMergeTimeInventory.fields.source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalMergeTimeInventory extends S.Opaque<GoalMergeTimeInventory, { readonly brand: unique symbol }>()(
  S.Struct({
    source: S.NonEmptyString,
    ruleSuiteId: S.Int,
    ref: S.NonEmptyString,
    afterSha: S.NonEmptyString,
    pushedAt: S.DateTimeUtcFromString,
    result: GoalRuleSuiteResult,
    ruleSources: S.Array(GoalMergeTimeRuleSourceRecord),
  }).pipe(
    $I.annoteSchema("GoalMergeTimeInventory", {
      description: "GitHub rule suite for the merge push, listing every evaluated rule source.",
    })
  )
) {}

/**
 * Records one required context's result bound to the accepted head, with its source.
 *
 * **Details**
 *
 * `checkRunId` is the newest run for the context on `head` that started before
 * merge. A context with no such run has no id, conclusion `unknown` and outcome
 * `unknown`; a run still pending at merge has conclusion `pending`.
 *
 * **Example** (Inspect a head-bound check fact)
 *
 * ```ts
 * import { GoalRequiredCheckFact } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalRequiredCheckFact.fields.head)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalRequiredCheckFact extends S.Opaque<GoalRequiredCheckFact, { readonly brand: unique symbol }>()(
  S.Struct({
    context: S.NonEmptyString,
    head: S.NonEmptyString,
    checkRunId: S.OptionFromNullOr(S.Finite),
    conclusion: GoalCheckConclusion,
    outcome: GoalCompletionOutcome,
    source: GoalEvidenceFactSource,
  }).pipe(
    $I.annoteSchema("GoalRequiredCheckFact", {
      description: "One required context's merge-time result bound to the accepted head.",
    })
  )
) {}

/**
 * Completion evidence that is complete and green at the accepted head.
 *
 * **Example** (Inspect the verified case)
 *
 * ```ts
 * import { GoalCompletionEvidenceVerified } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalCompletionEvidenceVerified.fields.facts)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCompletionEvidenceVerified extends S.Opaque<
  GoalCompletionEvidenceVerified,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("verified", { facts: S.Array(GoalRequiredCheckFact).check(S.isMinLength(1)) }).pipe(
    $I.annoteSchema("GoalCompletionEvidenceVerified", {
      description: "Every required fact is complete and green at the accepted head.",
    })
  )
) {}

/**
 * Completion evidence holding a known required red.
 *
 * **Details**
 *
 * `reds` are head-bound required check failures. `ruleSuiteRed` is true when
 * GitHub's merge-push rule suite itself failed an active required-status-checks rule.
 *
 * **Example** (Inspect the unsatisfied case)
 *
 * ```ts
 * import { GoalCompletionEvidenceUnsatisfied } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalCompletionEvidenceUnsatisfied.fields.ruleSuiteRed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCompletionEvidenceUnsatisfied extends S.Opaque<
  GoalCompletionEvidenceUnsatisfied,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("unsatisfied", { reds: S.Array(GoalRequiredCheckFact), ruleSuiteRed: S.Boolean }).pipe(
    $I.annoteSchema("GoalCompletionEvidenceUnsatisfied", {
      description: "A known required red: a head-bound required check failure or a failed merge-push rule suite.",
    })
  )
) {}

/**
 * Completion evidence that is missing or partial.
 *
 * **Example** (Inspect the unknown case)
 *
 * ```ts
 * import { GoalCompletionEvidenceUnknown } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalCompletionEvidenceUnknown.fields.gaps)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCompletionEvidenceUnknown extends S.Opaque<
  GoalCompletionEvidenceUnknown,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("unknown", { gaps: S.NonEmptyArray(GoalCompletionEvidenceGap) }).pipe(
    $I.annoteSchema("GoalCompletionEvidenceUnknown", {
      description: "Evidence is missing or partial; the gaps name each reason.",
    })
  )
) {}

/**
 * The merge-time completion evidence verdict: verified, unsatisfied or unknown.
 *
 * **Example** (Discriminate a verdict)
 *
 * ```ts
 * import { GoalCompletionEvidenceUnknown, GoalCompletionEvidenceVerdict } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * const verdict = GoalCompletionEvidenceUnknown.make({ gaps: ["network-failure"] })
 * console.log(GoalCompletionEvidenceVerdict.guards.unknown(verdict))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalCompletionEvidenceVerdict = S.Union([
  GoalCompletionEvidenceVerified,
  GoalCompletionEvidenceUnsatisfied,
  GoalCompletionEvidenceUnknown,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("GoalCompletionEvidenceVerdict", {
    description: "Merge-time completion evidence verdict: verified, unsatisfied or unknown.",
  })
);
/**
 * The merge-time completion evidence verdict.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalCompletionEvidenceVerdict = typeof GoalCompletionEvidenceVerdict.Type;

/**
 * Records historical required contexts, their ruleset versions and merge-time inventory completeness.
 *
 * **Details**
 *
 * Current ruleset enumeration omits rulesets deleted since merge, so it cannot
 * prove a complete inventory alone. `mergeTimeInventory` holds GitHub's rule
 * suite for the merge push, which lists every evaluated rule source including
 * deleted rulesets; `gaps` names everything that kept the inventory from being
 * complete. Older receipts decode with no rule suite, no gaps and
 * `inventoryComplete` false. Legacy snapshots used an all-or-nothing ruleset
 * reader, so an omitted `rulesetReadsComplete` defaults to true. The verdict
 * never trusts `inventoryComplete` alone: it re-derives completeness from the
 * stored rule suite.
 *
 * **Example** (Inspect required-check provenance)
 *
 * ```ts
 * import { GoalRequiredCheckSnapshot } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalRequiredCheckSnapshot.fields.sources)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalRequiredCheckSnapshot extends S.Opaque<GoalRequiredCheckSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    contexts: S.Array(S.NonEmptyString),
    sources: S.Array(S.NonEmptyString),
    effectiveAt: S.DateTimeUtcFromString,
    inventoryComplete: S.Boolean.pipe(S.withDecodingDefaultKey(Effect.succeed(false))),
    rulesetReadsComplete: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
    mergeTimeInventory: S.OptionFromNullOr(GoalMergeTimeInventory).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.withDecodingDefaultKey(Effect.succeed(null))
    ),
    gaps: ArrayKeyDefaultEmpty(GoalCompletionEvidenceGap),
  }).pipe(
    $I.annoteSchema("GoalRequiredCheckSnapshot", {
      description: "Historical required-context list with source version references and merge-time applicability.",
    })
  )
) {}

/**
 * Retains merge-time and final conclusions alongside independently attributed failures.
 *
 * **Example** (GoalNonRequiredRed boundary)
 *
 * ```ts
 * import { GoalNonRequiredRed } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalNonRequiredRed.fields.attribution)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalNonRequiredRed extends S.Opaque<GoalNonRequiredRed, { readonly brand: unique symbol }>()(
  S.Struct({
    lane: S.NonEmptyString,
    conclusionAtMerge: GoalCheckConclusion,
    conclusionFinal: GoalCheckConclusion,
    attribution: GoalRedAttribution,
  }).pipe(
    $I.annoteSchema("GoalNonRequiredRed", {
      description: "Retains merge-time and final conclusions alongside independently attributed failures.",
    })
  )
) {}

/**
 * Binds a derived completion observation to the repository, packet, declaration and accepted head.
 *
 * **Example** (GoalCompletionReceipt boundary)
 *
 * ```ts
 * import { GoalCompletionReceipt } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalCompletionReceipt.fields.schemaVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCompletionReceipt extends S.Opaque<GoalCompletionReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("goal-completion-receipt/v1"),
    repository: S.NonEmptyString,
    packet: S.NonEmptyString,
    declarationDigest: S.NonEmptyString,
    acceptedDeclarationDigest: S.OptionFromNullOr(S.NonEmptyString),
    requiredChecks: S.OptionFromNullOr(GoalRequiredCheckSnapshot).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.withDecodingDefaultKey(Effect.succeed(null))
    ),
    finalPullRequest: S.Int.check(S.isGreaterThan(0)),
    acceptedHead: S.OptionFromNullOr(S.NonEmptyString),
    merge: S.OptionFromNullOr(GoalMergeResult),
    evidence: S.Array(GoalEvidenceCheck),
    requiredCheckFacts: ArrayKeyDefaultEmpty(GoalRequiredCheckFact),
    nonRequiredReds: S.Array(GoalNonRequiredRed),
    subClaims: S.Array(GoalEvidenceCheck),
    outcome: GoalCompletionOutcome,
    verifiedAt: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("GoalCompletionReceipt", {
      description: "Binds a derived completion observation to the repository, packet, declaration and accepted head.",
    })
  )
) {}

/**
 * The declared completion gate of a goal packet.
 *
 * **Details**
 *
 * Uniform across every manifest in the census: a goal is not achieved until
 * its work ships as a PR driven to mergeable via yeet, unless the packet is
 * `grandfathered` (shipped before the gate was introduced on 2026-06-30).
 *
 * **Example** (Construct a yeet completion gate)
 *
 * ```ts
 * import { GoalCompletionGate } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const gate = GoalCompletionGate.make({
 *   operator: "yeet",
 *   requiresPullRequest: true,
 *   requiresMergeable: true,
 *   statement: "Ship via yeet.",
 *   grandfathered: false,
 * })
 * console.log(gate.operator)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCompletionGate extends S.Opaque<GoalCompletionGate, { readonly brand: unique symbol }>()(
  S.Struct({
    operator: S.String,
    requiresPullRequest: S.Boolean,
    requiresMergeable: S.Boolean,
    statement: S.String,
    grandfathered: S.Boolean,
    grandfatheredNote: S.optionalKey(S.String),
    pullRequests: S.optionalKey(
      S.Array(GoalPullRequestRef).check(
        S.makeFilter(
          (refs) => A.length(A.filter(refs, (ref) => ref.role === "final")) <= 1,
          $I.annote("OneFinalPullRequest", {
            title: "One final PR",
            description: "A goal declares at most one final delivery PR.",
            message: "At most one final PR is allowed",
          })
        )
      )
    ),
    acceptanceEvidence: GoalAcceptanceEvidenceRef.pipe(S.Array, S.optionalKey),
  }).pipe(
    $I.annoteSchema("GoalCompletionGate", {
      description: "Declared completion gate of a goal packet (yeet PR-to-mergeable unless grandfathered).",
    })
  )
) {}

/**
 * The identity block of a goal manifest.
 *
 * **Details**
 *
 * `id` and `status` are the required core; every other field is optional so
 * legacy manifests decode. Unknown keys (for example `supersededBy` or
 * `currentPhase` on some legacy packets) are ignored.
 *
 * **Example** (Construct a minimal identity block)
 *
 * ```ts
 * import { GoalInitiative } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const initiative = GoalInitiative.make({ id: "goals-doctor", status: "active" })
 * console.log(initiative.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalInitiative extends S.Opaque<GoalInitiative, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    packetId: S.optionalKey(S.String),
    status: GoalStatus,
    title: S.optionalKey(S.String),
    created: S.optionalKey(S.String),
    updated: S.optionalKey(S.String),
    packetAnchorDocument: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("GoalInitiative", {
      description: "Goal-manifest identity block: required id and canonical status plus optional metadata.",
    })
  )
) {}

/**
 * One phase entry inside a goal manifest.
 *
 * **Details**
 *
 * Phases appear both as arrays and as records keyed by phase name in legacy
 * manifests; both shapes share this entry schema. Only `status` is required.
 *
 * **Example** (Construct a pending phase entry)
 *
 * ```ts
 * import { GoalPhase } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const phase = GoalPhase.make({ status: "pending", id: "P0" })
 * console.log(phase.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalPhase extends S.Opaque<GoalPhase, { readonly brand: unique symbol }>()(
  S.Struct({
    status: GoalPhaseStatus,
    id: S.optionalKey(S.String),
    name: S.optionalKey(S.String),
    exit: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("GoalPhase", {
      description: "One goal-manifest phase entry with a normalized status.",
    })
  )
) {}

const CapabilitySegment = S.String.check(
  S.isPattern(
    /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
    $I.annote("CapabilitySegmentPatternCheck", {
      title: "Capability Segment Pattern",
      description: "Lowercase ASCII capability segment with internal single hyphens only.",
      message: "Expected a lowercase capability segment with internal single hyphens only",
    })
  ),
  S.isMaxLength(
    32,
    $I.annote("CapabilitySegmentLengthCheck", {
      title: "Capability Segment Length",
      description: "Capability namespace and name segments are at most 32 characters.",
      message: "Expected a capability segment with at most 32 characters",
    })
  )
).pipe(
  $I.annoteSchema("CapabilitySegment", {
    description: "One constrained namespace or name segment in a capability slug.",
  })
);

/**
 * Strict two-segment identifier for a durable capability.
 *
 * **Details**
 *
 * A capability names a durable product/infra ability, never a milestone or
 * task state:
 *
 * | Good | Bad (milestone/task prose) |
 * | --- | --- |
 * | `knowledge/doctor` | `p1/research-done` |
 * | `skills/warehouse` | `docs/pr-529` |
 * | `goals/graph` | `refactor/phase-3` |
 *
 * **Example** (Validate a capability slug)
 *
 * ```ts
 * import { CapabilitySlug } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CapabilitySlug)("knowledge/doctor")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CapabilitySlug = S.TemplateLiteral([CapabilitySegment, "/", CapabilitySegment])
  .check(
    S.isMaxLength(
      64,
      $I.annote("CapabilitySlugLengthCheck", {
        title: "Capability Slug Length",
        description: "A complete capability slug is at most 64 characters.",
        message: "Expected a capability slug with at most 64 characters",
      })
    )
  )
  .pipe(
    $I.annoteSchema("CapabilitySlug", {
      description: "Strict namespace/name identifier for a durable goal capability.",
    })
  );

/**
 * Strict two-segment capability identifier.
 *
 * **Example** (Annotate a capability value)
 *
 * ```ts
 * import type { CapabilitySlug } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const capability: CapabilitySlug = "goals/graph"
 * console.log(capability)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CapabilitySlug = typeof CapabilitySlug.Type;

/**
 * Derived guard for {@link CapabilitySlug}.
 *
 * **Example** (Reject a milestone-shaped slug)
 *
 * ```ts
 * import { isCapabilitySlug } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(isCapabilitySlug("skills/warehouse")) // true
 * console.log(isCapabilitySlug("P1/research-done")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isCapabilitySlug = S.is(CapabilitySlug);

const CapabilitySlugList = ArrayKeyDefaultEmpty(CapabilitySlug).pipe(
  $I.annoteSchema("CapabilitySlugList", {
    description: "Defaulted ordered declarations of goal capabilities.",
  })
);

const GoalManifestCapabilitySelfCycleCheck = S.makeFilter(
  (manifest: { readonly provides: ReadonlyArray<CapabilitySlug>; readonly requires: ReadonlyArray<CapabilitySlug> }) =>
    !A.some(manifest.provides, (capability) => A.contains(manifest.requires, capability)),
  $I.annote("GoalManifestCapabilitySelfCycleCheck", {
    title: "Goal Manifest Capability Self-Cycle",
    description: "A goal manifest cannot both provide and require the same capability.",
    message: "A goal manifest cannot list the same capability in both provides and requires (self-cycle)",
  })
);

/**
 * Declares the closeout to activate only after hosted readiness and merge proof.
 *
 * **Details**
 *
 * Keep initiative.status and lifecycle operative while this proposal and its
 * reflection ship in the final PR. A proposal is never completion evidence;
 * once its completion receipt verifies, `goals set-status` adopts it as a
 * {@link GoalCloseoutRecord}.
 *
 * **Example** (Propose closeout in the final PR)
 *
 * ```ts
 * import { GoalProposedCloseout } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * const proposal = GoalProposedCloseout.make({ status: "completed-retained", finalPullRequest: 1582 })
 * console.log(proposal.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalProposedCloseout extends S.Opaque<GoalProposedCloseout, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("completed-retained"),
    finalPullRequest: S.Int.check(S.isGreaterThan(0)),
  }).pipe(
    $I.annoteSchema("GoalProposedCloseout", {
      description: "Prospective final-PR closeout, separate from operative lifecycle and completion evidence.",
    })
  )
) {}

/**
 * Commits a verified closeout once `goals set-status` adopts its proposal.
 *
 * **Details**
 *
 * `goals set-status <slug> completed-retained` replaces a proposal with this
 * record only when the shared completion receipt for the proposed final PR
 * verifies. It keeps the final PR in the committed manifest, and the
 * completion declaration digest reads it exactly as it read the proposal, so
 * the receipt that verified the closeout still matches afterwards.
 *
 * **Example** (Record an adopted closeout)
 *
 * ```ts
 * import { GoalCloseoutRecord } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * const record = GoalCloseoutRecord.make({ status: "completed-retained", finalPullRequest: 1582 })
 * console.log(record.finalPullRequest) // 1582
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCloseoutRecord extends S.Opaque<GoalCloseoutRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("completed-retained"),
    finalPullRequest: S.Int.check(S.isGreaterThan(0)),
  }).pipe(
    $I.annoteSchema("GoalCloseoutRecord", {
      description: "Committed closeout adopted from a proposal whose completion receipt verified.",
    })
  )
) {}

/**
 * Whether this clone holds a verified completion receipt for a proposed closeout.
 *
 * **Details**
 *
 * `verified` means the clone-scoped receipt for the proposed final PR passed the
 * strict projection (merge facts, exact-head hosted evidence, readiness
 * verdict), so the proposal is the operative lifecycle here. `unverified` means
 * no such receipt is present in this clone: the manifest field stays operative.
 *
 * **Example** (Guard a verification token)
 *
 * ```ts
 * import { GoalCloseoutVerification } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalCloseoutVerification.is.verified("verified")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalCloseoutVerification = LiteralKit(["verified", "unverified"]).pipe(
  $I.annoteSchema("GoalCloseoutVerification", {
    description: "Whether a proposed closeout is backed by a verified clone-scoped completion receipt.",
  })
);

/**
 * Verification token of a proposed closeout in one clone.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalCloseoutVerification = typeof GoalCloseoutVerification.Type;

/**
 * Shows operative and proposed closeout separately in local session reports.
 *
 * **Details**
 *
 * `operativeStatus` is the projected lifecycle for this clone: the proposal's
 * status when a verified receipt exists, the manifest field otherwise.
 * `verification` names which of the two it is, so renderers never have to
 * compare the fields themselves.
 *
 * **Example** (Read the session projection fields)
 *
 * ```ts
 * import { GoalCloseoutView } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(GoalCloseoutView.fields.operativeStatus)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class GoalCloseoutView extends S.Opaque<GoalCloseoutView, { readonly brand: unique symbol }>()(
  S.Struct({
    packet: S.NonEmptyString,
    operativeStatus: GoalStatus,
    proposedCloseout: GoalProposedCloseout,
    verification: GoalCloseoutVerification,
  }).pipe(
    $I.annoteSchema("GoalCloseoutView", {
      description: "Local goal session view separating operative lifecycle from a prospective closeout.",
    })
  )
) {}

/**
 * Classifies a projected lifecycle against its proposal.
 *
 * **Example** (Classify a projected status)
 *
 * ```ts
 * import { GoalProposedCloseout, goalCloseoutVerification } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const proposal = GoalProposedCloseout.make({ status: "completed-retained", finalPullRequest: 7 })
 * console.log(goalCloseoutVerification(proposal, "completed-retained")) // "verified"
 * console.log(goalCloseoutVerification(proposal, "active")) // "unverified"
 * ```
 *
 * @param proposal - The manifest's proposed closeout.
 * @param operativeStatus - The lifecycle projected for this clone.
 * @returns `verified` when the projection adopted the proposal, `unverified` otherwise.
 * @category read-models
 * @since 0.0.0
 */
export const goalCloseoutVerification: {
  (operativeStatus: GoalStatus): (proposal: GoalProposedCloseout) => GoalCloseoutVerification;
  (proposal: GoalProposedCloseout, operativeStatus: GoalStatus): GoalCloseoutVerification;
} = dual(
  2,
  (proposal: GoalProposedCloseout, operativeStatus: GoalStatus): GoalCloseoutVerification =>
    operativeStatus === proposal.status ? "verified" : "unverified"
);

/**
 * Renders the derived operative status of a proposed closeout for operator surfaces.
 *
 * **Details**
 *
 * Every operator-facing surface that has the clone-scoped receipt at hand
 * (`session open`, `goals doctor`, `goals explain`) prints this one form, so a
 * verified proposal reads as `completed-retained (verified via #N, adoption pending)`
 * everywhere until `goals set-status` adopts it, and an unverified one never
 * hides that the field is still derived.
 *
 * **Example** (Render both verification states)
 *
 * ```ts
 * import { GoalCloseoutView, GoalProposedCloseout, renderGoalCloseoutView } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const proposedCloseout = GoalProposedCloseout.make({ status: "completed-retained", finalPullRequest: 7 })
 * const verified = GoalCloseoutView.make({
 *   packet: "demo",
 *   operativeStatus: "completed-retained",
 *   proposedCloseout,
 *   verification: "verified",
 * })
 * console.log(renderGoalCloseoutView(verified)) // "completed-retained (verified via #7, adoption pending)"
 * console.log(renderGoalCloseoutView(GoalCloseoutView.make({ ...verified, operativeStatus: "active", verification: "unverified" })))
 * // "completed-retained (proposed via #7, unverified)"
 * ```
 *
 * @param view - The clone-scoped closeout view.
 * @returns One line naming the derived status, its final PR and its verification.
 * @category formatting
 * @since 0.0.0
 */
export const renderGoalCloseoutView = (view: GoalCloseoutView): string =>
  GoalCloseoutVerification.is.verified(view.verification)
    ? `${view.proposedCloseout.status} (verified via #${view.proposedCloseout.finalPullRequest}, adoption pending)`
    : `${view.proposedCloseout.status} (proposed via #${view.proposedCloseout.finalPullRequest}, unverified)`;

/**
 * Renders a committed closeout record against its completion receipt for operator surfaces.
 *
 * **Details**
 *
 * A verified record prints `completed-retained (verified via #N)`; only a
 * committed record drops the `adoption pending` suffix a verified proposal carries.
 *
 * **Example** (Render both verification states)
 *
 * ```ts
 * import { GoalCloseoutRecord, renderGoalCloseoutRecordView } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const record = GoalCloseoutRecord.make({ status: "completed-retained", finalPullRequest: 7 })
 * console.log(renderGoalCloseoutRecordView(record, "verified")) // "completed-retained (verified via #7)"
 * console.log(renderGoalCloseoutRecordView(record, "unverified")) // "completed-retained (committed via #7, unverified)"
 * ```
 *
 * @param record - The manifest's committed closeout.
 * @param verification - Whether the matching completion receipt verifies.
 * @returns One line naming the committed status, its final PR and its verification.
 * @category formatting
 * @since 0.0.0
 */
export const renderGoalCloseoutRecordView: {
  (verification: GoalCloseoutVerification): (record: GoalCloseoutRecord) => string;
  (record: GoalCloseoutRecord, verification: GoalCloseoutVerification): string;
} = dual(2, (record: GoalCloseoutRecord, verification: GoalCloseoutVerification): string =>
  GoalCloseoutVerification.is.verified(verification)
    ? `${record.status} (verified via #${record.finalPullRequest})`
    : `${record.status} (committed via #${record.finalPullRequest}, unverified)`
);

/**
 * Renders a proposed closeout from the committed manifest alone.
 *
 * **Details**
 *
 * The generated `goals/INDEX.md` must stay byte-identical across clones, and the
 * completion receipt is clone-scoped, so the index never consults it: this form
 * states only what the manifest commits to.
 *
 * **Example** (Render the committed proposal)
 *
 * ```ts
 * import { GoalProposedCloseout, renderGoalProposedCloseout } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const proposal = GoalProposedCloseout.make({ status: "completed-retained", finalPullRequest: 7 })
 * console.log(renderGoalProposedCloseout(proposal)) // "proposed completed-retained via #7"
 * ```
 *
 * @param proposal - The manifest's proposed closeout.
 * @returns The receipt-free rendering of the proposal.
 * @category formatting
 * @since 0.0.0
 */
export const renderGoalProposedCloseout = (proposal: GoalProposedCloseout): string =>
  `proposed ${proposal.status} via #${proposal.finalPullRequest}`;

// Proposed and committed closeouts both need a non-grandfathered gate with
// gating Yeet readiness evidence and no other declared final PR.
const closeoutGateAdmits = (gate: GoalCompletionGate, finalPullRequest: number): boolean =>
  !gate.grandfathered &&
  A.some(gate.acceptanceEvidence ?? [], (ref) => ref.kind === "yeet-verdict" && ref.gating) &&
  !O.exists(
    A.findFirst(gate.pullRequests ?? [], (ref) => ref.role === "final"),
    (ref) => ref.number !== finalPullRequest
  );

const GoalProposedCloseoutCheck = S.makeFilter(
  (manifest: {
    readonly initiative: GoalInitiative;
    readonly completionGate: GoalCompletionGate;
    readonly proposedCloseout?: GoalProposedCloseout;
  }) => {
    const proposal = manifest.proposedCloseout;
    if (proposal === undefined) return true;
    return (
      (manifest.initiative.status === "active" || manifest.initiative.status === "paused") &&
      closeoutGateAdmits(manifest.completionGate, proposal.finalPullRequest)
    );
  },
  $I.annote("GoalProposedCloseoutCheck", {
    title: "Prospective Closeout Identity",
    description: "A closeout proposal retains active or paused operative status and matches any declared final PR.",
    message:
      "Proposed closeout requires active/paused status, a non-grandfathered gate and a matching final PR and gating Yeet readiness evidence",
  })
);

const GoalCloseoutRecordCheck = S.makeFilter(
  (manifest: {
    readonly initiative: GoalInitiative;
    readonly completionGate: GoalCompletionGate;
    readonly proposedCloseout?: GoalProposedCloseout;
    readonly closeout?: GoalCloseoutRecord;
  }) => {
    const record = manifest.closeout;
    if (record === undefined) return true;
    return (
      manifest.initiative.status === record.status &&
      manifest.proposedCloseout === undefined &&
      closeoutGateAdmits(manifest.completionGate, record.finalPullRequest)
    );
  },
  $I.annote("GoalCloseoutRecordCheck", {
    title: "Committed Closeout Identity",
    description:
      "A committed closeout matches the declared status, replaces its proposal and matches any declared final PR.",
    message:
      "Committed closeout requires completed-retained status, no proposal, a non-grandfathered gate, gating Yeet readiness evidence and a matching final PR",
  })
);

/**
 * Renders a committed closeout record for the generated portfolio index.
 *
 * **Example** (Render the committed record)
 *
 * ```ts
 * import { GoalCloseoutRecord, renderGoalCloseoutRecord } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const record = GoalCloseoutRecord.make({ status: "completed-retained", finalPullRequest: 7 })
 * console.log(renderGoalCloseoutRecord(record)) // "completed-retained via #7"
 * ```
 *
 * @param record - The manifest's committed closeout.
 * @returns The committed status and its final PR.
 * @category formatting
 * @since 0.0.0
 */
export const renderGoalCloseoutRecord = (record: GoalCloseoutRecord): string =>
  `${record.status} via #${record.finalPullRequest}`;

/**
 * Packet-relative path of one registered goal ops script.
 *
 * **Details**
 *
 * The path starts with `ops/` and every segment starts with a letter, digit,
 * underscore or hyphen, so `..`, hidden files and absolute spellings never
 * decode: a registered script always lies inside the packet's `ops/` tree.
 *
 * **Example** (Validate an ops script path)
 *
 * ```ts
 * import { GoalOpsScriptPath } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GoalOpsScriptPath)("ops/bench.ts")) // true
 * console.log(S.is(GoalOpsScriptPath)("ops/../SPEC.md")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalOpsScriptPath = S.String.check(
  S.isPattern(
    /^ops(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/,
    $I.annote("GoalOpsScriptPathPatternCheck", {
      title: "Goal Ops Script Path Pattern",
      description: "A packet-relative path under ops/ whose segments never start with a dot.",
      message: "Expected a packet-relative path under ops/ with no dot-leading segment",
    })
  )
).pipe(
  $I.annoteSchema("GoalOpsScriptPath", {
    description: "Packet-relative path of one registered goal ops script, always inside ops/.",
  })
);

/**
 * One registered goal ops script: its packet-relative path and purpose.
 *
 * **Details**
 *
 * `opsScripts` on {@link GoalManifest} lists every script a packet keeps under
 * `ops/` (differentials, oracles, corpora, benches). When a manifest declares
 * the list, `beep goals doctor` checks it both ways: every listed path exists
 * and every `*.ts` file under `ops/` is listed. Files under a dot-leading
 * segment (`ops/.scratch/`) are hidden scratch space and are not checked; a
 * `*.ts` whose path {@link GoalOpsScriptPath} rejects is reported as
 * `ops-script-unregistrable`, fixed by renaming it.
 *
 * **Example** (Register an ops script)
 *
 * ```ts
 * import { GoalOpsScript } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const script = GoalOpsScript.make({
 *   path: "ops/markdown-bench.ts",
 *   purpose: "Counts parser operations for the markdown promotion bench.",
 * })
 * console.log(script.path) // "ops/markdown-bench.ts"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalOpsScript extends S.Opaque<GoalOpsScript, { readonly brand: unique symbol }>()(
  S.Struct({
    path: GoalOpsScriptPath,
    purpose: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("GoalOpsScript", {
      description: "One registered goal ops script with its packet-relative path and one-line purpose.",
    })
  )
) {}

/**
 * Packet-relative path of one projected research report, always inside `research/`.
 *
 * **Details**
 *
 * `researchReports` on {@link GoalManifest} is a generated projection of the
 * packet's `research/` directory: every regular file at any depth whose path
 * has no dot-leading segment (`research/.scratch/x.md` and `.gitkeep` are
 * hidden), sorted and deduplicated. The pattern mirrors
 * {@link GoalOpsScriptPath}; entries that name anything outside `research/`
 * belong in `researchReferences`, which stays hand-maintained.
 *
 * **Example** (Check a projected path)
 *
 * ```ts
 * import { GoalResearchReportPath } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GoalResearchReportPath)("research/SOURCES.md")) // true
 * console.log(S.is(GoalResearchReportPath)("../../explorations/x/RESEARCH.md")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalResearchReportPath = S.String.check(
  S.isPattern(
    /^research(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/,
    $I.annote("GoalResearchReportPathPatternCheck", {
      title: "Goal Research Report Path Pattern",
      description: "A packet-relative path under research/ whose segments never start with a dot.",
      message: "Expected a packet-relative path under research/ with no dot-leading segment",
    })
  )
).pipe(
  $I.annoteSchema("GoalResearchReportPath", {
    description: "Packet-relative path of one projected research report, always inside research/.",
  })
);

/**
 * Whether a string is a projected research report path.
 *
 * **Example** (Split manifest entries)
 *
 * ```ts
 * import { isGoalResearchReportPath } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(isGoalResearchReportPath("research/evidence/run.json")) // true
 * console.log(isGoalResearchReportPath("history/p1-report.md")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isGoalResearchReportPath = S.is(GoalResearchReportPath);

/**
 * Canonical goal-packet manifest (`initiative-manifest/v2`).
 *
 * **Details**
 *
 * The decoder is deliberately lenient: only `initiative` (id + canonical
 * status) and `completionGate` are required, matching the documented packet
 * standard, while every typed optional field accepts the post-migration wire
 * shapes. Unknown top-level keys are accepted but stripped from decoded output,
 * so raw callers must retain the parsed JSON when they need bespoke fields.
 * `researchReports` is a generated projection of `research/` (see
 * {@link GoalResearchReportPath}; written by `beep goals manifest --write`),
 * while `researchReferences` lists hand-maintained pointers to research that
 * lives outside the packet.
 *
 * **Example** (Construct a minimal v2 manifest)
 *
 * ```ts
 * import { GoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const manifest = GoalManifest.make({
 *   initiative: { id: "goals-doctor", status: "active" },
 *   completionGate: {
 *     operator: "yeet",
 *     requiresPullRequest: true,
 *     requiresMergeable: true,
 *     statement: "Ship via yeet.",
 *     grandfathered: false,
 *   },
 * })
 * console.log(manifest.initiative.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalManifest extends S.Opaque<GoalManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    initiative: GoalInitiative,
    completionGate: GoalCompletionGate,
    schemaVersion: S.optionalKey(GoalManifestSchemaVersion),
    lifecycle: S.optionalKey(GoalStatus),
    proposedCloseout: S.optionalKey(GoalProposedCloseout),
    closeout: S.optionalKey(GoalCloseoutRecord),
    mergedPullRequest: S.optionalKey(S.Int.check(S.isGreaterThan(0))),
    mergedPullRequests: S.Int.check(S.isGreaterThan(0)).pipe(S.Array, S.optionalKey),
    packetPath: S.optionalKey(S.String),
    executionCapable: S.optionalKey(S.Boolean),
    reflectionRequired: S.optionalKey(S.Boolean),
    mission: S.NullOr(S.String).pipe(S.optionalKey),
    statusNote: S.optionalKey(S.String),
    blockedBy: S.Array(S.String).pipe(S.optionalKey),
    supersededBy: S.optionalKey(S.String),
    supersededNote: S.optionalKey(S.String),
    claimedBy: S.optionalKey(S.String),
    claimedAt: S.optionalKey(S.String),
    discoveredFrom: S.optionalKey(S.String),
    phases: S.Union([S.Array(GoalPhase), S.Record(S.String, GoalPhase)]).pipe(S.optionalKey),
    opsScripts: S.Array(GoalOpsScript).pipe(S.optionalKey),
    researchReports: S.Array(S.String).pipe(S.optionalKey),
    researchReferences: S.Array(S.String).pipe(S.optionalKey),
    archive: S.optionalKey(ArchiveRecord),
    retentionReason: S.optionalKey(RetentionReason),
    provides: CapabilitySlugList,
    requires: CapabilitySlugList,
  })
    .check(GoalManifestCapabilitySelfCycleCheck, GoalProposedCloseoutCheck, GoalCloseoutRecordCheck)
    .pipe(
      $I.annoteSchema("GoalManifest", {
        description: "Canonical goal-packet manifest with defaulted capability edges and legacy wire compatibility.",
      })
    )
) {}

/**
 * Decode an unknown parsed JSON value as a {@link GoalManifest}.
 *
 * **Example** (Build the decode effect for a parsed value)
 *
 * ```ts
 * import { decodeGoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(decodeGoalManifest({})))
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeGoalManifest: {
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<GoalManifest, S.SchemaError>;
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<GoalManifest, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(GoalManifest));

/**
 * Normalizes legacy PR references in memory while preserving every manifest on disk.
 *
 * **Example** (Use the normalizer)
 *
 * ```ts
 * import { goalPullRequestRefs } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * console.log(typeof goalPullRequestRefs)
 * ```
 *
 * @param manifest - Decoded manifest whose optional legacy PR fields are retained.
 * @returns Declared references, or a legacy final reference with supporting PRs.
 * @category normalization
 * @since 0.0.0
 */
export const goalPullRequestRefs = (manifest: GoalManifest): ReadonlyArray<GoalPullRequestRef> => {
  const closing = manifest.proposedCloseout ?? manifest.closeout;
  if (manifest.completionGate.pullRequests !== undefined) {
    const refs = manifest.completionGate.pullRequests;
    if (closing === undefined || A.some(refs, (ref) => ref.role === "final")) return refs;
    return A.prepend(refs, GoalPullRequestRef.make({ number: closing.finalPullRequest, role: "final" }));
  }
  if (closing !== undefined) return [GoalPullRequestRef.make({ number: closing.finalPullRequest, role: "final" })];
  const numbers = manifest.mergedPullRequests ?? [];
  const final = O.orElse(O.fromUndefinedOr(manifest.mergedPullRequest), () => A.last(numbers));
  return O.match(final, {
    onNone: A.empty<GoalPullRequestRef>,
    onSome: (number) =>
      A.prepend(
        A.map(
          A.filter(numbers, (value) => value !== number),
          (value) => GoalPullRequestRef.make({ number: value, role: "supporting" })
        ),
        GoalPullRequestRef.make({ number, role: "final" })
      ),
  });
};
