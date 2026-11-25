/**
 * Schemas for the lane-reds parcel: the per-checkout inbox rows and proof
 * jobs it reduces from, and the red item it serves.
 *
 * **Details**
 *
 * The inputs mirror the yeet inbox (`.beep/inbox`) and proof-job records
 * (`.beep/yeet/jobs`) the repo CLI reads, decoded here so this library never
 * imports the CLI. Only fields the reducer reads are declared. A checkout is
 * named by its lane (the checkout directory's base name), never its path, and
 * every summary is built from structured fields, never a comment body.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PalantiriId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { Freshness } from "./Freshness.ts";

const $I = $PalantiriId.create("LaneReds.models");

/**
 * The kinds of yeet inbox row, the same spellings the inbox writes.
 *
 * **Example** (Narrow an inbox row kind)
 *
 * ```ts
 * import { InboxRowKind } from "@beep/palantiri/LaneReds.models"
 *
 * console.log(InboxRowKind.is["check-failed"]("check-failed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InboxRowKind = LiteralKit([
  "check-failed",
  "sibling-collision",
  "review-thread",
  "base-drift",
  "base-conflict",
  "pr-comment",
  "local-shard-failed",
  "pr-merge-ready",
  "proof-job-finished",
]).pipe($I.annoteSchema("InboxRowKind", { description: "Kind of one yeet inbox row." }));

/**
 * @category models
 * @since 0.0.0
 */
export type InboxRowKind = typeof InboxRowKind.Type;

/**
 * Enforcement tier of an inbox row: P0 denies, P1 injects, P2 surfaces at
 * session start.
 *
 * **Example** (Narrow a severity)
 *
 * ```ts
 * import { InboxSeverity } from "@beep/palantiri/LaneReds.models"
 *
 * console.log(InboxSeverity.is.P0("P0")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InboxSeverity = LiteralKit(["P0", "P1", "P2"]).pipe(
  $I.annoteSchema("InboxSeverity", { description: "Enforcement tier of one yeet inbox row." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type InboxSeverity = typeof InboxSeverity.Type;

/**
 * One yeet inbox row as a parcel reads it: kind, tier, pull request, a
 * summary built from the row's structured fields, when it was observed, and
 * whether it is acknowledged or superseded by a newer head.
 *
 * **Example** (Make an inbox row input)
 *
 * ```ts
 * import { InboxRowInput } from "@beep/palantiri/LaneReds.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const row = InboxRowInput.make({
 *   kind: "check-failed",
 *   severity: "P0",
 *   prNumber: O.some(1817),
 *   summary: "Check / Coverage FAILURE",
 *   observedAt: O.some(DateTime.makeUnsafe("2026-10-15T12:00:00Z")),
 *   acked: false,
 *   superseded: false
 * })
 * console.log(row.kind) // "check-failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InboxRowInput extends S.Opaque<InboxRowInput, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: InboxRowKind,
    severity: InboxSeverity,
    prNumber: S.OptionFromNullOr(S.Int),
    summary: S.String,
    observedAt: S.OptionFromNullOr(S.DateTimeUtcFromString),
    acked: S.Boolean,
    superseded: S.Boolean,
  }).pipe(
    $I.annoteSchema("InboxRowInput", {
      description: "One yeet inbox row: kind, tier, pull request, summary, observation time, ack and liveness.",
    })
  )
) {}

/**
 * One detached proof job as a parcel reads it.
 *
 * **Details**
 *
 * `failed` is `true` when the job recorded a failure verdict or terminated
 * without one for any reason but a cancel; `reason` names which (`failure`,
 * `timeout`, `oom-killed`, ...). `endedAt` is when it settled.
 *
 * **Example** (Make a proof job input)
 *
 * ```ts
 * import { ProofJobInput } from "@beep/palantiri/LaneReds.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const job = ProofJobInput.make({
 *   branch: "feat/x",
 *   prNumber: O.none(),
 *   failed: true,
 *   reason: "timeout",
 *   submittedAt: DateTime.makeUnsafe("2026-10-15T11:00:00Z"),
 *   endedAt: O.some(DateTime.makeUnsafe("2026-10-15T11:30:00Z"))
 * })
 * console.log(job.failed) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofJobInput extends S.Opaque<ProofJobInput, { readonly brand: unique symbol }>()(
  S.Struct({
    branch: S.String,
    prNumber: S.OptionFromNullOr(S.Int),
    failed: S.Boolean,
    reason: S.String,
    submittedAt: S.DateTimeUtcFromString,
    endedAt: S.OptionFromNullOr(S.DateTimeUtcFromString),
  }).pipe(
    $I.annoteSchema("ProofJobInput", {
      description: "One proof job: branch, pull request, whether it failed and why, and when it ran.",
    })
  )
) {}

/**
 * **Details**
 *
 * `inboxReadable` is `false` when the inbox file exists but could not be
 * read; `skippedLines` counts inbox lines that did not decode. `jobs` is
 * `None` when the job records could not be listed.
 *
 * **Example** (Make an empty checkout input)
 *
 * ```ts
 * import { LaneCheckoutInput } from "@beep/palantiri/LaneReds.models"
 * import * as O from "effect/Option"
 *
 * const checkout = LaneCheckoutInput.make({
 *   lane: "palantiri-parcels-p2",
 *   branch: O.some("feat/palantiri-parcels-p2"),
 *   inboxReadable: true,
 *   skippedLines: 0,
 *   rows: [],
 *   jobs: O.some([])
 * })
 * console.log(checkout.lane) // "palantiri-parcels-p2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LaneCheckoutInput extends S.Opaque<LaneCheckoutInput, { readonly brand: unique symbol }>()(
  S.Struct({
    lane: S.String,
    branch: S.OptionFromNullOr(S.String),
    inboxReadable: S.Boolean,
    skippedLines: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    rows: S.Array(InboxRowInput),
    jobs: ProofJobInput.pipe(S.Array, S.OptionFromNullOr),
  }).pipe(
    $I.annoteSchema("LaneCheckoutInput", {
      description: "One checkout's lane, branch, inbox rows and proof jobs, with their read accounting.",
    })
  )
) {}

/**
 * What the lane-reds source port serves: every checkout it read.
 *
 * **Example** (Make an input)
 *
 * ```ts
 * import { LaneRedsInput } from "@beep/palantiri/LaneReds.models"
 *
 * console.log(LaneRedsInput.make({ checkouts: [] }).checkouts.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LaneRedsInput extends S.Opaque<LaneRedsInput, { readonly brand: unique symbol }>()(
  S.Struct({ checkouts: S.Array(LaneCheckoutInput) }).pipe(
    $I.annoteSchema("LaneRedsInput", { description: "The checkouts the lane-reds parcel reduces from." })
  )
) {}

/**
 * **Details**
 *
 * Base drift (always P2) and the observation rows (`pr-merge-ready`,
 * `proof-job-finished`) are news, not reds, so they are not kinds here.
 *
 * **Example** (Narrow a red kind)
 *
 * ```ts
 * import { LaneRedKind } from "@beep/palantiri/LaneReds.models"
 *
 * console.log(LaneRedKind.is["proof-job-failed"]("proof-job-failed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LaneRedKind = LiteralKit([
  "check-failed",
  "sibling-collision",
  "review-thread",
  "base-conflict",
  "pr-comment",
  "local-shard-failed",
  "proof-job-failed",
]).pipe(
  $I.annoteSchema("LaneRedKind", {
    description: "An inbox row kind that asks for work, or a failed proof job.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type LaneRedKind = typeof LaneRedKind.Type;

/**
 * **Details**
 *
 * `freshness` is the item's own: `Fresh` when it was observed within the
 * parcel's 10-minute bound, `Unknown{stale}` when older (nothing re-observed
 * it, so it may already be fixed).
 *
 * **Example** (Make a red)
 *
 * ```ts
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import { LaneRed } from "@beep/palantiri/LaneReds.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const at = DateTime.makeUnsafe("2026-10-15T12:00:00Z")
 * const red = LaneRed.make({
 *   kind: "check-failed",
 *   severity: "P0",
 *   prNumber: O.some(1817),
 *   lane: "palantiri-parcels-p2",
 *   branch: O.none(),
 *   summary: "Check / Coverage FAILURE",
 *   observedAt: O.some(at),
 *   freshness: Freshness.cases.Fresh.make({ asOf: at })
 * })
 * console.log(red._tag) // "LaneRed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LaneRed extends S.Opaque<LaneRed, { readonly brand: unique symbol }>()(
  S.TaggedStruct("LaneRed", {
    kind: LaneRedKind,
    severity: S.Literals(["P0", "P1"]),
    prNumber: S.OptionFromNullOr(S.Int),
    lane: S.String,
    branch: S.OptionFromNullOr(S.String),
    summary: S.String,
    observedAt: S.OptionFromNullOr(S.DateTimeUtcFromString),
    freshness: Freshness,
  }).pipe(
    $I.annoteSchema("LaneRed", {
      description: "One open P0 or P1 red in one lane: kind, pull request, summary and observation freshness.",
    })
  )
) {}
