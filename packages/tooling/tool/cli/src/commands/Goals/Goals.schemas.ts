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
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
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
export class GoalPullRequestRef extends S.Class<GoalPullRequestRef>($I`GoalPullRequestRef`)(
  { number: S.Int.check(S.isGreaterThan(0)), role: GoalPullRequestRole },
  $I.annote("GoalPullRequestRef", { description: "Declares one pull request by number and delivery role." })
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
export class GoalAcceptanceEvidenceRef extends S.Class<GoalAcceptanceEvidenceRef>($I`GoalAcceptanceEvidenceRef`)(
  {
    kind: GoalAcceptanceEvidenceKind,
    ref: S.NonEmptyString,
    gating: S.Boolean.pipe(S.withDecodingDefault(Effect.succeed(true))),
  },
  $I.annote("GoalAcceptanceEvidenceRef", {
    description: "Points to acceptance evidence bound to a commit, with an explicit gating policy.",
  })
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
export class GoalMergeResult extends S.Class<GoalMergeResult>($I`GoalMergeResult`)(
  {
    mergeCommit: S.NonEmptyString,
    tree: S.NonEmptyString,
    mergedAt: S.DateTimeUtcFromString,
    method: S.OptionFromNullOr(GoalMergeMethod),
    baseRef: S.NonEmptyString,
  },
  $I.annote("GoalMergeResult", {
    description: "Records GitHub merge identity and tree without requiring squash-head ancestry.",
  })
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
export class GoalEvidenceCheck extends S.Class<GoalEvidenceCheck>($I`GoalEvidenceCheck`)(
  {
    ref: GoalAcceptanceEvidenceRef,
    outcome: GoalCompletionOutcome,
    observedHead: S.OptionFromNullOr(S.NonEmptyString),
    detail: S.String,
  },
  $I.annote("GoalEvidenceCheck", { description: "Records the outcome and observed head of one acceptance reference." })
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
 * Records the historical required contexts and the immutable GitHub ruleset versions supplying them.
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
export class GoalRequiredCheckSnapshot extends S.Class<GoalRequiredCheckSnapshot>($I`GoalRequiredCheckSnapshot`)(
  { contexts: S.Array(S.NonEmptyString), sources: S.Array(S.NonEmptyString), effectiveAt: S.DateTimeUtcFromString },
  $I.annote("GoalRequiredCheckSnapshot", {
    description: "Historical required-context list with source version references and merge-time applicability.",
  })
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
export class GoalNonRequiredRed extends S.Class<GoalNonRequiredRed>($I`GoalNonRequiredRed`)(
  {
    lane: S.NonEmptyString,
    conclusionAtMerge: GoalCheckConclusion,
    conclusionFinal: GoalCheckConclusion,
    attribution: GoalRedAttribution,
  },
  $I.annote("GoalNonRequiredRed", {
    description: "Retains merge-time and final conclusions alongside independently attributed failures.",
  })
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
export class GoalCompletionReceipt extends S.Class<GoalCompletionReceipt>($I`GoalCompletionReceipt`)(
  {
    schemaVersion: S.Literal("goal-completion-receipt/v1"),
    repository: S.NonEmptyString,
    packet: S.NonEmptyString,
    declarationDigest: S.NonEmptyString,
    acceptedDeclarationDigest: S.OptionFromNullOr(S.NonEmptyString),
    requiredChecks: S.OptionFromNullOr(GoalRequiredCheckSnapshot).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.withDecodingDefault(Effect.succeed(null))
    ),
    finalPullRequest: S.Int.check(S.isGreaterThan(0)),
    acceptedHead: S.OptionFromNullOr(S.NonEmptyString),
    merge: S.OptionFromNullOr(GoalMergeResult),
    evidence: S.Array(GoalEvidenceCheck),
    nonRequiredReds: S.Array(GoalNonRequiredRed),
    subClaims: S.Array(GoalEvidenceCheck),
    outcome: GoalCompletionOutcome,
    verifiedAt: S.DateTimeUtcFromString,
  },
  $I.annote("GoalCompletionReceipt", {
    description: "Binds a derived completion observation to the repository, packet, declaration and accepted head.",
  })
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
export class GoalCompletionGate extends S.Class<GoalCompletionGate>($I`GoalCompletionGate`)(
  {
    operator: S.String,
    requiresPullRequest: S.Boolean,
    requiresMergeable: S.Boolean,
    statement: S.String,
    grandfathered: S.Boolean,
    grandfatheredNote: S.optionalKey(S.String),
    pullRequests: S.optionalKey(
      S.Array(GoalPullRequestRef).check(
        S.makeFilter((refs) => A.length(A.filter(refs, (ref) => ref.role === "final")) <= 1, {
          identifier: $I`OneFinalPullRequest`,
          title: "One final PR",
          description: "A goal declares at most one final delivery PR.",
          message: "At most one final PR is allowed",
        })
      )
    ),
    acceptanceEvidence: GoalAcceptanceEvidenceRef.pipe(S.Array, S.optionalKey),
  },
  $I.annote("GoalCompletionGate", {
    description: "Declared completion gate of a goal packet (yeet PR-to-mergeable unless grandfathered).",
  })
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
export class GoalInitiative extends S.Class<GoalInitiative>($I`GoalInitiative`)(
  {
    id: S.String,
    packetId: S.optionalKey(S.String),
    status: GoalStatus,
    title: S.optionalKey(S.String),
    created: S.optionalKey(S.String),
    updated: S.optionalKey(S.String),
    packetAnchorDocument: S.optionalKey(S.String),
  },
  $I.annote("GoalInitiative", {
    description: "Goal-manifest identity block: required id and canonical status plus optional metadata.",
  })
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
export class GoalPhase extends S.Class<GoalPhase>($I`GoalPhase`)(
  {
    status: GoalPhaseStatus,
    id: S.optionalKey(S.String),
    name: S.optionalKey(S.String),
    exit: S.optionalKey(S.String),
  },
  $I.annote("GoalPhase", {
    description: "One goal-manifest phase entry with a normalized status.",
  })
) {}

const CapabilitySegment = S.String.check(
  S.isPattern(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, {
    identifier: $I`CapabilitySegmentPatternCheck`,
    title: "Capability Segment Pattern",
    description: "Lowercase ASCII capability segment with internal single hyphens only.",
    message: "Expected a lowercase capability segment with internal single hyphens only",
  }),
  S.isMaxLength(32, {
    identifier: $I`CapabilitySegmentLengthCheck`,
    title: "Capability Segment Length",
    description: "Capability namespace and name segments are at most 32 characters.",
    message: "Expected a capability segment with at most 32 characters",
  })
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
    S.isMaxLength(64, {
      identifier: $I`CapabilitySlugLengthCheck`,
      title: "Capability Slug Length",
      description: "A complete capability slug is at most 64 characters.",
      message: "Expected a capability slug with at most 64 characters",
    })
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

const CapabilitySlugList = S.Array(CapabilitySlug).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<CapabilitySlug>())),
  S.withDecodingDefault(Effect.succeed(A.empty<CapabilitySlug>())),
  $I.annoteSchema("CapabilitySlugList", {
    description: "Defaulted ordered declarations of goal capabilities.",
  })
);

const GoalManifestCapabilitySelfCycleCheck = S.makeFilter(
  (manifest: { readonly provides: ReadonlyArray<CapabilitySlug>; readonly requires: ReadonlyArray<CapabilitySlug> }) =>
    !A.some(manifest.provides, (capability) => A.contains(manifest.requires, capability)),
  {
    identifier: $I`GoalManifestCapabilitySelfCycleCheck`,
    title: "Goal Manifest Capability Self-Cycle",
    description: "A goal manifest cannot both provide and require the same capability.",
    message: "A goal manifest cannot list the same capability in both provides and requires (self-cycle)",
  }
);

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
export class GoalManifest extends S.Class<GoalManifest>($I`GoalManifest`)(
  S.Struct({
    initiative: GoalInitiative,
    completionGate: GoalCompletionGate,
    schemaVersion: S.optionalKey(GoalManifestSchemaVersion),
    lifecycle: S.optionalKey(GoalStatus),
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
    provides: CapabilitySlugList,
    requires: CapabilitySlugList,
  }).check(GoalManifestCapabilitySelfCycleCheck),
  $I.annote("GoalManifest", {
    description: "Canonical goal-packet manifest with defaulted capability edges and legacy wire compatibility.",
  })
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
  if (manifest.completionGate.pullRequests !== undefined) return manifest.completionGate.pullRequests;
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
