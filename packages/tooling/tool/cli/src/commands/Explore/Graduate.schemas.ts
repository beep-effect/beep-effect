/**
 * Graduation-plan schemas for `beep explore graduate --plan`.
 *
 * **Details**
 *
 * Workstream E-3 of the knowledge-surface-automation initiative graduates an
 * exploration into goal packets with one reviewed plan. A pure compiler maps a
 * read-only {@link ExplorationSnapshot} plus a {@link GraduationRequest} to a
 * content-addressed {@link GraduationPlan}: one bootstrap
 * `MaterializationPlan` per child, a typed {@link ExplorationManifestEdit}, and
 * the refusals that make the plan fail closed. {@link GraduationReceipt} is the
 * shape the `--write` replay prints.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { GoalSlug, MaterializationPlan, MaterializationReceipt, PlanDigest } from "../Goals/Bootstrap.schemas.ts";
import { PacketEventBody, PacketEventTimestamp, PacketSlug } from "../Goals/PacketCore/PacketCore.schemas.ts";
import { ExplorationStage, ExplorationStatus } from "./Atlas.ts";

const $I = $RepoCliId.create("commands/Explore/Graduate.schemas");

const IsoDate = S.String.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}$/, {
    identifier: $I`GraduationTodayPatternCheck`,
    title: "Graduation Today Pattern",
    description: "An explicit ISO date (YYYY-MM-DD) input.",
    message: "Expected an explicit ISO date (YYYY-MM-DD)",
  })
).pipe($I.annoteSchema("GraduationIsoDate", { description: "Explicit ISO date stamped on graduation output." }));

/**
 * One child goal requested by `--goal <slug>=<title>`.
 *
 * **Details**
 *
 * The slug uses the goal-packet grammar (`GoalSlug`) because each child is
 * compiled by the bootstrap compiler, whose input already requires it.
 *
 * **Example** (Construct a child request)
 *
 * ```ts
 * import { GraduationChildInput } from "@beep/repo-cli/commands/Explore"
 *
 * const child = GraduationChildInput.make({ slug: "skill-contract-gates", title: "Skill Contract Gates" })
 * console.log(child.slug) // "skill-contract-gates"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraduationChildInput extends S.Class<GraduationChildInput>($I`GraduationChildInput`)(
  {
    slug: GoalSlug,
    title: S.NonEmptyString,
  },
  $I.annote("GraduationChildInput", { description: "One child goal packet a graduation creates." })
) {}

/**
 * Everything a graduation plan needs beyond the repository snapshot.
 *
 * **Details**
 *
 * `today` is explicit so a plan is a function of its inputs; the command
 * fills it from `--today` or the current date.
 *
 * **Example** (Construct a request with no children)
 *
 * ```ts
 * import { GraduationRequest } from "@beep/repo-cli/commands/Explore"
 *
 * const request = GraduationRequest.make({ children: [], today: "2026-10-13" })
 * console.log(request.children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraduationRequest extends S.Class<GraduationRequest>($I`GraduationRequest`)(
  {
    children: S.Array(GraduationChildInput),
    today: IsoDate,
  },
  $I.annote("GraduationRequest", { description: "Requested children and the explicit date of one graduation." })
) {}

/**
 * One packet already under `goals/`, with the exploration its manifest names.
 *
 * **Details**
 *
 * `provenanceExploration` is the raw `provenance.exploration` value
 * (`explorations/<slug>`); it is absent when the manifest is missing, does
 * not parse, or records no provenance. Provenance is the resume journal: it
 * separates this graduation's earlier children from a foreign packet.
 *
 * **Example** (Record a previously published child)
 *
 * ```ts
 * import { ExistingGoalPacket } from "@beep/repo-cli/commands/Explore"
 *
 * const packet = ExistingGoalPacket.make({
 *   slug: "skill-contract-kernel",
 *   provenanceExploration: "explorations/typed-agent-skill-contracts",
 * })
 * console.log(packet.provenanceExploration)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExistingGoalPacket extends S.Class<ExistingGoalPacket>($I`ExistingGoalPacket`)(
  {
    slug: S.String,
    provenanceExploration: S.optionalKey(S.String),
  },
  $I.annote("ExistingGoalPacket", {
    description: "One goal packet already on disk with the exploration its manifest provenance names.",
  })
) {}

/**
 * Read-only capture of one exploration and the goal fleet it graduates into.
 *
 * **Details**
 *
 * The reader only calls read members of `FileSystem`; once this value exists,
 * graduation planning is a pure function of it. `exists` is false when
 * `explorations/<slug>` is not a directory; `manifestText` and
 * `manifestDigest` are absent when `ops/manifest.json` cannot be read.
 *
 * **Example** (Capture a missing exploration)
 *
 * ```ts
 * import { ExplorationSnapshot } from "@beep/repo-cli/commands/Explore"
 *
 * const snapshot = ExplorationSnapshot.make({
 *   exploration: "missing-idea",
 *   manifestPath: "explorations/missing-idea/ops/manifest.json",
 *   exists: false,
 *   goals: [],
 * })
 * console.log(snapshot.exists) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExplorationSnapshot extends S.Class<ExplorationSnapshot>($I`ExplorationSnapshot`)(
  {
    exploration: PacketSlug,
    manifestPath: S.String,
    exists: S.Boolean,
    manifestText: S.optionalKey(S.String),
    manifestDigest: S.optionalKey(PlanDigest),
    goals: S.Array(ExistingGoalPacket),
  },
  $I.annote("ExplorationSnapshot", {
    description: "Read-only exploration manifest and goal fleet capture consumed by the pure graduation compiler.",
  })
) {}

/**
 * Why a graduation plan failed closed.
 *
 * **Example** (Recognize a foreign slug conflict)
 *
 * ```ts
 * import { GraduationConflictReason } from "@beep/repo-cli/commands/Explore"
 *
 * console.log(GraduationConflictReason.is["foreign-slug"]("foreign-slug")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GraduationConflictReason = LiteralKit([
  "exploration-not-found",
  "manifest-undecodable",
  "exploration-closed",
  "no-goals",
  "duplicate-child",
  "foreign-slug",
  "child-conflicted",
]).pipe(
  $I.annoteSchema("GraduationConflictReason", {
    description: "Why a graduation plan failed closed before any write.",
  })
);

/**
 * Decoded graduation conflict reason.
 *
 * @see {@link GraduationConflictReason} for the runtime schema and membership helpers.
 * @category type-level
 * @since 0.0.0
 */
export type GraduationConflictReason = typeof GraduationConflictReason.Type;

/**
 * One refusal recorded by the graduation compiler.
 *
 * **Example** (Construct a duplicate-child conflict)
 *
 * ```ts
 * import { GraduationConflict } from "@beep/repo-cli/commands/Explore"
 *
 * const conflict = GraduationConflict.make({
 *   reason: "duplicate-child",
 *   child: "skill-contract-gates",
 *   message: 'Child "skill-contract-gates" is requested more than once.',
 * })
 * console.log(conflict.reason) // "duplicate-child"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraduationConflict extends S.Class<GraduationConflict>($I`GraduationConflict`)(
  {
    reason: GraduationConflictReason,
    child: S.optionalKey(S.String),
    message: S.String,
  },
  $I.annote("GraduationConflict", { description: "One reason a graduation plan failed closed." })
) {}

/**
 * Typed edit of the exploration's `ops/manifest.json`.
 *
 * **Details**
 *
 * The edit sets `status`, `stage`, and `updated`, and appends `appendGoals`
 * to `links.goals`. `preImageDigest` pins the exact manifest bytes the plan
 * was compiled against, so the later writer refuses a manifest that moved.
 *
 * **Example** (Construct the graduation edit)
 *
 * ```ts
 * import { ExplorationManifestEdit } from "@beep/repo-cli/commands/Explore"
 *
 * const edit = ExplorationManifestEdit.make({
 *   path: "explorations/typed-agent-skill-contracts/ops/manifest.json",
 *   preImageDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   status: "graduated",
 *   stage: "graduate",
 *   updated: "2026-10-13",
 *   appendGoals: ["goals/skill-contract-gates"],
 * })
 * console.log(edit.appendGoals.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExplorationManifestEdit extends S.Class<ExplorationManifestEdit>($I`ExplorationManifestEdit`)(
  {
    path: S.String,
    preImageDigest: PlanDigest,
    status: ExplorationStatus,
    stage: ExplorationStage,
    updated: IsoDate,
    appendGoals: S.Array(S.String),
  },
  $I.annote("ExplorationManifestEdit", {
    description: "Hash-pinned status, stage, updated, and links.goals edit of an exploration manifest.",
  })
) {}

/**
 * A requested child that already exists with this exploration's provenance.
 *
 * **Example** (Record an already-published child)
 *
 * ```ts
 * import { GraduationPublishedChild } from "@beep/repo-cli/commands/Explore"
 *
 * const child = GraduationPublishedChild.make({ slug: "skill-contract-gates", packetPath: "goals/skill-contract-gates" })
 * console.log(child.packetPath) // "goals/skill-contract-gates"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraduationPublishedChild extends S.Class<GraduationPublishedChild>($I`GraduationPublishedChild`)(
  {
    slug: S.String,
    packetPath: S.String,
  },
  $I.annote("GraduationPublishedChild", {
    description: "A requested child an earlier run of the same graduation already published.",
  })
) {}

/**
 * Content address of one compiled graduation plan.
 *
 * **Example** (Validate a graduation plan id)
 *
 * ```ts
 * import { GraduationPlanId } from "@beep/repo-cli/commands/Explore"
 * import * as S from "effect/Schema"
 *
 * console.log(
 *   S.is(GraduationPlanId)(
 *     "graduation-plan/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   )
 * ) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GraduationPlanId = S.String.check(
  S.isPattern(/^graduation-plan\/v1:[0-9a-f]{64}$/, {
    identifier: $I`GraduationPlanIdPatternCheck`,
    title: "Graduation Plan Id Pattern",
    description: "graduation-plan/v1: followed by a lowercase SHA-256 hex digest.",
    message: "Expected graduation-plan/v1: followed by a lowercase SHA-256 hex digest",
  })
).pipe($I.annoteSchema("GraduationPlanId", { description: "Content address of one compiled graduation plan." }));

/**
 * Decoded graduation plan id.
 *
 * @see {@link GraduationPlanId} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type GraduationPlanId = typeof GraduationPlanId.Type;

/**
 * `graduation-plan/v1`: the complete, content-addressed intent of one graduation.
 *
 * **Details**
 *
 * `children` holds one bootstrap plan per child still to publish, in request
 * order. `alreadyPublished` lists requested children that exist with this
 * exploration's provenance. `explorationEdit` is absent only when the
 * manifest could not be read or decoded. `planId` digests the children's plan
 * ids and the encoded edit, so a reviewed id names exactly one outcome.
 *
 * **Example** (Inspect the plan constructor)
 *
 * ```ts
 * import { GraduationPlan } from "@beep/repo-cli/commands/Explore"
 *
 * console.log(typeof GraduationPlan.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraduationPlan extends S.Class<GraduationPlan>($I`GraduationPlan`)(
  {
    schemaVersion: S.tag("graduation-plan/v1"),
    planId: GraduationPlanId,
    exploration: S.String,
    children: S.Array(MaterializationPlan),
    explorationEdit: S.optionalKey(ExplorationManifestEdit),
    alreadyPublished: S.Array(GraduationPublishedChild),
    conflicts: S.Array(GraduationConflict),
  },
  $I.annote("GraduationPlan", { description: "Deterministic, content-addressed intent of one exploration graduation." })
) {}

/**
 * What a `--write` replay did with one requested child.
 *
 * **Example** (Recognize an already-published outcome)
 *
 * ```ts
 * import { GraduationChildOutcome } from "@beep/repo-cli/commands/Explore"
 *
 * console.log(GraduationChildOutcome.is["already-published"]("already-published")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GraduationChildOutcome = LiteralKit(["published", "already-published"]).pipe(
  $I.annoteSchema("GraduationChildOutcome", {
    description: "Whether a graduation write published a child or found it already published.",
  })
);

/**
 * Decoded graduation child outcome.
 *
 * @see {@link GraduationChildOutcome} for the runtime schema and membership helpers.
 * @category type-level
 * @since 0.0.0
 */
export type GraduationChildOutcome = typeof GraduationChildOutcome.Type;

/**
 * One child row of a graduation receipt.
 *
 * **Example** (Record an already-published child)
 *
 * ```ts
 * import { GraduationChildReceipt } from "@beep/repo-cli/commands/Explore"
 *
 * const row = GraduationChildReceipt.make({ slug: "skill-contract-gates", outcome: "already-published" })
 * console.log(row.outcome) // "already-published"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraduationChildReceipt extends S.Class<GraduationChildReceipt>($I`GraduationChildReceipt`)(
  {
    slug: S.String,
    outcome: GraduationChildOutcome,
    receipt: S.optionalKey(MaterializationReceipt),
  },
  $I.annote("GraduationChildReceipt", {
    description: "One child's materialization receipt, or its already-published outcome.",
  })
) {}

/**
 * `graduation-receipt/v1`: what a `--write` replay of a reviewed graduation did.
 *
 * **Details**
 *
 * Printed, not persisted. Children are listed already-published first, then
 * published in request order. The manifest digests bracket the exploration
 * edit, which is applied after every child. `eventsAppended` counts the
 * `ops/events/` events the write appended (0 for a manifest-only exploration).
 *
 * **Example** (Inspect the receipt constructor)
 *
 * ```ts
 * import { GraduationReceipt } from "@beep/repo-cli/commands/Explore"
 *
 * console.log(typeof GraduationReceipt.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraduationReceipt extends S.Class<GraduationReceipt>($I`GraduationReceipt`)(
  {
    schemaVersion: S.tag("graduation-receipt/v1"),
    planId: GraduationPlanId,
    exploration: S.String,
    children: S.Array(GraduationChildReceipt),
    manifestBeforeDigest: PlanDigest,
    manifestAfterDigest: PlanDigest,
    eventsAppended: S.Int,
  },
  $I.annote("GraduationReceipt", {
    description: "What a --write replay of a reviewed graduation plan published and edited.",
  })
) {}

/**
 * Path segments of the pending-graduation-events sidecar below an exploration.
 *
 * **Example** (Read the sidecar segments)
 *
 * ```ts
 * import { GRADUATION_PENDING_SEGMENTS } from "@beep/repo-cli/commands/Explore"
 *
 * console.log(GRADUATION_PENDING_SEGMENTS) // ["ops", ".graduation-pending.json"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GRADUATION_PENDING_SEGMENTS = ["ops", ".graduation-pending.json"] as const;

/**
 * `graduation-pending/v1`: stream events a graduation owes an opted-in exploration.
 *
 * **Details**
 *
 * Written atomically to `ops/.graduation-pending.json` before the manifest
 * flips, and removed once the events and the trace land (E19). It records the
 * manifest digest the flip produces, the pre-image status and stage (the E18
 * genesis fields), the event timestamp, and the event bodies planned against
 * the stream at staging time. `explore graduate --resume-events` replays it
 * after a crash between the manifest write and the append.
 *
 * **Example** (Construct a pending record)
 *
 * ```ts
 * import { GraduationPendingEvents } from "@beep/repo-cli/commands/Explore"
 *
 * const pending = GraduationPendingEvents.make({
 *   planId: "graduation-plan/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   exploration: "demo",
 *   manifestPath: "explorations/demo/ops/manifest.json",
 *   manifestAfterDigest: "1".repeat(64),
 *   previousStatus: "active",
 *   previousStage: "decompose",
 *   at: "2026-10-14T00:00:00.000Z",
 *   events: [{ type: "stage-entered", stage: "graduate", ordinal: 6 }],
 * })
 * console.log(pending.events.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraduationPendingEvents extends S.Class<GraduationPendingEvents>($I`GraduationPendingEvents`)(
  {
    schemaVersion: S.tag("graduation-pending/v1"),
    planId: GraduationPlanId,
    exploration: PacketSlug,
    manifestPath: S.String,
    manifestAfterDigest: PlanDigest,
    previousStatus: ExplorationStatus,
    previousStage: ExplorationStage,
    at: PacketEventTimestamp,
    events: S.Array(PacketEventBody),
  },
  $I.annote("GraduationPendingEvents", {
    description:
      "Stream events an interrupted graduation still owes an opted-in exploration, pinned to the graduated manifest.",
  })
) {}

/**
 * `graduation-resume-receipt/v1`: what `explore graduate --resume-events` appended.
 *
 * **Example** (Construct a resume receipt)
 *
 * ```ts
 * import { GraduationResumeReceipt } from "@beep/repo-cli/commands/Explore"
 *
 * const receipt = GraduationResumeReceipt.make({
 *   planId: "graduation-plan/v1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   exploration: "demo",
 *   eventsAppended: 2,
 * })
 * console.log(receipt.eventsAppended) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraduationResumeReceipt extends S.Class<GraduationResumeReceipt>($I`GraduationResumeReceipt`)(
  {
    schemaVersion: S.tag("graduation-resume-receipt/v1"),
    planId: GraduationPlanId,
    exploration: S.String,
    eventsAppended: S.Int,
  },
  $I.annote("GraduationResumeReceipt", {
    description: "Events a --resume-events recovery appended for an interrupted graduation.",
  })
) {}
