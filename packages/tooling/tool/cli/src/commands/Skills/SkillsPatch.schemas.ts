/**
 * Plan and receipt schemas for `beep skills patch add` and
 * `beep skills patch label`.
 *
 * **Details**
 *
 * Both commands follow the lock-write discipline the rest of the warehouse
 * uses: without `--expect` they only report a digest-sealed plan; with the
 * reviewed `planDigest` they recompute it, refuse on any difference, and
 * publish through a staged rename that re-checks the lock bytes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  SkillEffective,
  SkillGitRevision,
  SkillPatch,
  SkillPatches,
  SkillPatchLabel,
} from "@beep/ai-sync/Skills.schemas";
import { SkillsLockWrittenFile } from "@beep/ai-sync/SkillsLock.schemas";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Skills/SkillsPatch.schemas");

/**
 * What a patch-series command did with its plan.
 *
 * **Details**
 *
 * `planned`: no `--expect` was given, so the plan was only reported.
 * `written`: the plan was published. `already-current`: the lock already
 * holds what the plan would write, so nothing was written.
 *
 * **Example** (Check an outcome)
 *
 * ```ts
 * import { SkillPatchPlanOutcome } from "@beep/repo-cli/commands/Skills/SkillsPatch.schemas"
 *
 * console.log(SkillPatchPlanOutcome.is.planned("planned")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillPatchPlanOutcome = LiteralKit(["planned", "written", "already-current"]).pipe(
  $I.annoteSchema("SkillPatchPlanOutcome", {
    description: "Whether a patch-series command only planned, wrote, or found the lock already current.",
  })
);

/**
 * What a patch-series command did with its plan.
 *
 * **Example** (Annotate an outcome)
 *
 * ```ts
 * import type { SkillPatchPlanOutcome } from "@beep/repo-cli/commands/Skills/SkillsPatch.schemas"
 *
 * const outcome: SkillPatchPlanOutcome = "written"
 * console.log(outcome)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillPatchPlanOutcome = typeof SkillPatchPlanOutcome.Type;

/**
 * A digest-sealed `skills patch add` plan and what the run did with it.
 *
 * **Details**
 *
 * `added` lists the new patches, one per hand-edited file, numbered after the
 * existing series and labelled `temporary-drift` until a review classifies
 * them (B8). `patches` is the whole new series block and `effective` the new
 * effective block; both are sealed into `planDigest` with the lock's SHA-256,
 * the skill, and its pin. `lock` is present only when the outcome is
 * `written`.
 *
 * **Example** (Inspect the constructor)
 *
 * ```ts
 * import { SkillPatchAddReceipt } from "@beep/repo-cli/commands/Skills/SkillsPatch.schemas"
 *
 * console.log(typeof SkillPatchAddReceipt.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillPatchAddReceipt extends S.Opaque<SkillPatchAddReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("skills-patch-add-plan/v1"),
    planDigest: Sha256Hex,
    lockSha256: Sha256Hex,
    skill: S.String,
    sourceRevision: SkillGitRevision,
    added: S.Array(SkillPatch),
    patches: SkillPatches,
    effective: SkillEffective,
    outcome: SkillPatchPlanOutcome,
    lock: S.OptionFromOptionalKey(SkillsLockWrittenFile),
  }).pipe(
    $I.annoteSchema("SkillPatchAddReceipt", {
      description: "A digest-sealed plan that turns a hand edit of vendored output into new patches, and its outcome.",
    })
  )
) {}

/**
 * One patch whose lock label the ledger moves.
 *
 * **Example** (Record a relabel)
 *
 * ```ts
 * import { SkillPatchLabelChange } from "@beep/repo-cli/commands/Skills/SkillsPatch.schemas"
 *
 * const change = SkillPatchLabelChange.make({
 *   patch: ".agents/skill-patches/oracle/0001-skill-md.patch",
 *   from: "temporary-drift",
 *   to: "policy",
 *   fromDropCondition: "Drop when upstream contains an equivalent change.",
 *   toDropCondition: "Never: a repo rule replayed on every bump (B42).",
 * })
 * console.log(change.to) // "policy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillPatchLabelChange extends S.Opaque<SkillPatchLabelChange, { readonly brand: unique symbol }>()(
  S.Struct({
    patch: S.String,
    from: SkillPatchLabel,
    to: SkillPatchLabel,
    fromDropCondition: S.String,
    toDropCondition: S.String,
  }).pipe(
    $I.annoteSchema("SkillPatchLabelChange", {
      description:
        "A patch whose lock label moves to the label its ledger classifications agree on, with its drop condition before and after.",
    })
  )
) {}

/**
 * Why a patch keeps its lock label for now.
 *
 * **Details**
 *
 * `unclassified`: at least one of its hunks has no labelled `keep`.
 * `mixed`: its hunks were kept under different labels, so the patch must be
 * split before one label fits. `dropped`: a hunk was decided `drop`, so the
 * patch must change before it is relabelled.
 *
 * **Example** (Check a pending reason)
 *
 * ```ts
 * import { SkillPatchLabelPendingReason } from "@beep/repo-cli/commands/Skills/SkillsPatch.schemas"
 *
 * console.log(SkillPatchLabelPendingReason.is.mixed("mixed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillPatchLabelPendingReason = LiteralKit(["unclassified", "mixed", "dropped"]).pipe(
  $I.annoteSchema("SkillPatchLabelPendingReason", {
    description: "Why a patch keeps its label: unclassified hunks, disagreeing labels, or a dropped hunk.",
  })
);

/**
 * Why a patch keeps its lock label for now.
 *
 * **Example** (Annotate a pending reason)
 *
 * ```ts
 * import type { SkillPatchLabelPendingReason } from "@beep/repo-cli/commands/Skills/SkillsPatch.schemas"
 *
 * const reason: SkillPatchLabelPendingReason = "unclassified"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillPatchLabelPendingReason = typeof SkillPatchLabelPendingReason.Type;

/**
 * One patch whose label the ledger cannot settle yet.
 *
 * **Example** (Record a pending patch)
 *
 * ```ts
 * import { SkillPatchLabelPending } from "@beep/repo-cli/commands/Skills/SkillsPatch.schemas"
 *
 * const pending = SkillPatchLabelPending.make({
 *   patch: ".agents/skill-patches/oracle/0002-agents-openai-yaml.patch",
 *   reason: "unclassified",
 * })
 * console.log(pending.reason) // "unclassified"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillPatchLabelPending extends S.Opaque<SkillPatchLabelPending, { readonly brand: unique symbol }>()(
  S.Struct({
    patch: S.String,
    reason: SkillPatchLabelPendingReason,
  }).pipe(
    $I.annoteSchema("SkillPatchLabelPending", {
      description: "A patch that keeps its current label and why.",
    })
  )
) {}

/**
 * A digest-sealed `skills patch label` plan and what the run did with it.
 *
 * **Details**
 *
 * `changes` moves each patch whose hunks were all kept under one label in
 * the ledger to that label; `pending` names every patch the ledger cannot
 * settle. `planDigest` seals the lock's SHA-256, the skill, and the changes.
 * Labels are not part of the patch-set or effective hashes, so a relabel
 * never touches the installed trees.
 *
 * **Example** (Inspect the constructor)
 *
 * ```ts
 * import { SkillPatchLabelReceipt } from "@beep/repo-cli/commands/Skills/SkillsPatch.schemas"
 *
 * console.log(typeof SkillPatchLabelReceipt.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillPatchLabelReceipt extends S.Opaque<SkillPatchLabelReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("skills-patch-label-plan/v1"),
    planDigest: Sha256Hex,
    lockSha256: Sha256Hex,
    skill: S.String,
    changes: S.Array(SkillPatchLabelChange),
    pending: S.Array(SkillPatchLabelPending),
    outcome: SkillPatchPlanOutcome,
    lock: S.OptionFromOptionalKey(SkillsLockWrittenFile),
  }).pipe(
    $I.annoteSchema("SkillPatchLabelReceipt", {
      description: "A digest-sealed plan that moves patch labels to the ledger's classifications, and its outcome.",
    })
  )
) {}
