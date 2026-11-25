/**
 * The completed record of one activity run: its start-time facts, the
 * entities it generated, when it ended and how it ended.
 *
 * **Details**
 *
 * `id` is the `activity/v1` id minted from `start` alone (decision
 * 2026-11-19-p0-activity-id-minted-at-start), so `generated`, `ended` and
 * `outcome` stay outside the id. {@link verifyActivityRecord} re-mints the id
 * from `start` and refuses a record whose id does not match.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $JsoncId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { ActivityId, ContentHash } from "@beep/schema/ContentHash";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { ActivityStart, mintActivityId } from "./ActivityStart.ts";
import type * as Digest from "effect/crypto/Digest";
import type { PreimageMintError } from "./Mint.ts";

const $I = $JsoncId.create("ActivityRecord");

/**
 * How an attributed run ended: `completed` on success, `failed` on a typed
 * failure. A defect or an interruption records no activity.
 *
 * **Example** (Check an outcome)
 *
 * ```ts import.meta.vitest name="Check an outcome"
 * import { ActivityOutcome } from "@beep/jsonc/ActivityRecord"
 *
 * ActivityOutcome.is.failed("failed") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActivityOutcome = LiteralKit(["completed", "failed"]).pipe(
  $I.annoteSchema("ActivityOutcome", { description: "How an attributed activity run ended." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ActivityOutcome = typeof ActivityOutcome.Type;

/**
 * One `prov:Activity`: the id minted from its start, the start-time facts,
 * what it generated, when it ended and how.
 *
 * **Details**
 *
 * The record never ends before it starts, and a failed run generated nothing.
 *
 * **Example** (Record a completed run)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { IRI } from "@beep/identity/Iri"
 * import { ActivityId, ContentHash } from "@beep/schema/ContentHash"
 * import { ActivityPin, ActivityStart } from "@beep/jsonc/ActivityStart"
 * import { ActivityRecord } from "@beep/jsonc/ActivityRecord"
 *
 * const start = ActivityStart.make({
 *   operation: IRI.make("https://example.org/ops/extract"),
 *   pin: ActivityPin.cases.Engine.make({ engine: "langextract", edition: "1.0.0" }),
 *   promptDigest: O.none(),
 *   used: HashSet.empty(),
 *   started: DateTime.makeUnsafe(0),
 * })
 * const record = ActivityRecord.make({
 *   id: ActivityId.make(ContentHash.make(`sha256:${"0".repeat(64)}`)),
 *   start,
 *   generated: HashSet.empty(),
 *   ended: DateTime.makeUnsafe(5),
 *   outcome: "completed",
 * })
 *
 * console.log(record.outcome) // "completed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActivityRecord extends S.Opaque<ActivityRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    id: ActivityId,
    start: ActivityStart,
    generated: CanonicalHashSet(ContentHash).annotateKey({ description: "Content entities the run generated." }),
    ended: S.DateTimeUtcFromMillis.annotateKey({ description: "When the run ended, in epoch milliseconds." }),
    outcome: ActivityOutcome,
  })
    .check(
      S.makeFilter(
        (record: { readonly start: ActivityStart; readonly ended: DateTime.Utc }) =>
          DateTime.isLessThanOrEqualTo(record.start.started, record.ended),
        $I.annote("ActivityRecordOrderCheck", {
          title: "Activity Record Order",
          description: "An activity never ends before it starts.",
          message: "Expected start.started to be no later than ended.",
        })
      ),
      S.makeFilter(
        (record: { readonly generated: HashSet.HashSet<ContentHash>; readonly outcome: ActivityOutcome }) =>
          ActivityOutcome.is.completed(record.outcome) || HashSet.isEmpty(record.generated),
        $I.annote("ActivityRecordFailedGeneratesNothingCheck", {
          title: "Failed Activity Generates Nothing",
          description: "A failed activity run generated no entity.",
          message: "Expected generated to be empty when outcome is failed.",
        })
      )
    )
    .pipe($I.annoteSchema("ActivityRecord", { description: "The completed record of one activity run." }))
) {}

/**
 * Why {@link verifyActivityRecord} refused a record.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts import.meta.vitest name="Check a refusal reason"
 * import { ActivityRecordInvalidReason } from "@beep/jsonc/ActivityRecord"
 *
 * ActivityRecordInvalidReason.is["id-mismatch"]("id-mismatch") // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ActivityRecordInvalidReason = LiteralKit(["id-mismatch"]).pipe(
  $I.annoteSchema("ActivityRecordInvalidReason", { description: "Why an activity record failed verification." })
);

/**
 * @category errors
 * @since 0.0.0
 */
export type ActivityRecordInvalidReason = typeof ActivityRecordInvalidReason.Type;

/**
 * **Example** (Build a refusal)
 *
 * ```ts import.meta.vitest name="Build a refusal"
 * import { ActivityRecordInvalid } from "@beep/jsonc/ActivityRecord"
 *
 * ActivityRecordInvalid.make({ reason: "id-mismatch" }).reason // => "id-mismatch"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ActivityRecordInvalid extends S.TaggedError<ActivityRecordInvalid, { readonly brand: unique symbol }>(
  $I.make("ActivityRecordInvalid")
)(
  "ActivityRecordInvalid",
  { reason: ActivityRecordInvalidReason },
  $I.annoteError<ActivityRecordInvalid>("ActivityRecordInvalid", {
    description: "An activity record whose id does not match its start.",
  })
) {}

/**
 * Re-mint a record's id from its start and refuse it when the ids differ.
 *
 * **Example** (Verify a record)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import { verifyActivityRecord, type ActivityRecord } from "@beep/jsonc/ActivityRecord"
 *
 * const check = (record: ActivityRecord) =>
 *   verifyActivityRecord(record).pipe(Effect.provide(Digest.layerWebCrypto))
 *
 * console.log(check)
 * ```
 *
 * @param record - The record to verify.
 * @category validation
 * @since 0.0.0
 */
export const verifyActivityRecord = Effect.fn("ActivityRecord.verify")(function* (
  record: ActivityRecord
): Effect.fn.Return<ActivityRecord, ActivityRecordInvalid | PreimageMintError, Digest.Digest> {
  const id = yield* mintActivityId(record.start);
  if (!Equal.equals(id, record.id)) return yield* ActivityRecordInvalid.make({ reason: "id-mismatch" });
  return record;
});
