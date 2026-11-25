/**
 * Checked-append projections and explicit interval-law violations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ValidTime } from "./Claim/index.ts";
import { ClaimId } from "./ClaimCore.schema.ts";

const $I = $EpistemicsId.create("ClaimLog.schema");

/**
 * The partition, dependency and time projection of an immutable core.
 *
 * **Example** (Read the projection fields)
 *
 * ```ts
 * import { ClaimLogEntry } from "@beep/epistemics/ClaimLog.schema"
 * console.log(ClaimLogEntry.fields.knowledgeStart)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ClaimLogEntry extends S.Opaque<ClaimLogEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    claim: ClaimId,
    scope: S.Union([S.String, S.Finite]),
    logicalKey: S.NonEmptyString,
    supersedes: S.OptionFromOptionalKey(ClaimId),
    derivedFrom: CanonicalHashSet(ClaimId),
    knowledgeStart: S.DateTimeUtcFromMillis,
    generatedAt: S.DateTimeUtcFromMillis,
    valid: ValidTime,
  }).pipe(
    $I.annoteSchema("ClaimLogEntry", { description: "A core's append-law projection; generation end is explicit." })
  )
) {}

/**
 * Stable ordered refusals for every invalid append prefix.
 *
 * **Example** (Describe a duplicate)
 *
 * ```ts
 * import { ClaimId } from "@beep/epistemics/ClaimCore.schema"
 * import { ClaimLogViolation } from "@beep/epistemics/ClaimLog.schema"
 * console.log(ClaimLogViolation.cases.DuplicateId.make({ claim: ClaimId.make("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimLogViolation = S.TaggedUnion({
  DuplicateId: { claim: ClaimId },
  CoreKeyMismatch: { claim: ClaimId },
  SupersessionFork: { superseded: ClaimId, superseders: CanonicalHashSet(ClaimId) },
  SupersededMissing: { claim: ClaimId, superseded: ClaimId },
  PredecessorNotEarlier: { claim: ClaimId, superseded: ClaimId },
  SupersededAcrossPartitions: { claim: ClaimId, superseded: ClaimId },
  StartsBeforeSuperseded: { claim: ClaimId, superseded: ClaimId },
  StartsBeforeGeneration: { claim: ClaimId },
  KnowledgeStartRegression: { claim: ClaimId, previous: ClaimId },
  ParentMissing: { claim: ClaimId, parent: ClaimId },
  ParentStartsLater: { claim: ClaimId, parent: ClaimId },
  ValidTimeOverlap: { left: ClaimId, right: ClaimId },
}).pipe(
  $I.annoteSchema("ClaimLogViolation", {
    description: "An append-prefix law violation with implicated claim ids only.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ClaimLogViolation = typeof ClaimLogViolation.Type;

/**
 * A lawful extended log or refusal with the original log retained.
 *
 * **Example** (Build an empty appended log)
 *
 * ```ts
 * import { AppendResult } from "@beep/epistemics/ClaimLog.schema"
 * console.log(AppendResult.cases.Appended.make({ log: [] })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AppendResult = S.TaggedUnion({
  Appended: { log: S.Array(ClaimLogEntry) },
  Refused: { log: S.Array(ClaimLogEntry), violations: S.NonEmptyArray(ClaimLogViolation) },
}).pipe(
  $I.annoteSchema("AppendResult", { description: "An immutable append result; refusal preserves the original log." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type AppendResult = typeof AppendResult.Type;

/**
 * Half-open knowledge bounds, including legal equal-start supersessions.
 *
 * **Example** (Represent an open interval)
 *
 * ```ts
 * import { ClaimKnowledgeInterval } from "@beep/epistemics/ClaimLog.schema"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * console.log(ClaimKnowledgeInterval.make({ start: DateTime.makeUnsafe(0), end: O.none() }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ClaimKnowledgeInterval extends S.Opaque<ClaimKnowledgeInterval, { readonly brand: unique symbol }>()(
  S.Struct({ start: S.DateTimeUtcFromMillis, end: S.OptionFromOptionalKey(S.DateTimeUtcFromMillis) })
    .check(
      S.makeFilter(
        ({ start, end }: { readonly start: DateTime.Utc; readonly end: O.Option<DateTime.Utc> }) =>
          !O.exists(end, (upper) => DateTime.isLessThan(upper, start)),
        $I.annote("ClaimKnowledgeIntervalOrder", {
          description: "Knowledge order: an explicit end never precedes the start; equal bounds stay legal.",
          message: "Expected the knowledge end to be no earlier than its start.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("ClaimKnowledgeInterval", {
        description: "A claim's half-open knowledge interval ending at its explicit superseder.",
      })
    )
) {}
