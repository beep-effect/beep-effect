/**
 * Deterministic canonical-memory review queue records.
 *
 * Both the legacy and canonical review paths write this document. There is no
 * Python model; the builder below is the contract.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Model, optionalNull, pg, UtcTimestamp } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/MemoryReview");

const awareInstant =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$/;

const nullableText = (column: string, description: string) =>
  S.OptionFromNullOr(S.String)
    .annotateKey({ description })
    .pipe(SchemaUtils.withNoneDefault, pg.text(), pg.columnName(column));

const factIdText = (value: unknown): string => {
  if (P.isString(value)) return Str.trim(value);
  if (P.isNumber(value) && Number.isFinite(value)) return String(value);
  if (value === true) return "True";
  if (value === false) return "False";
  return "";
};

const veracityText = (fact: { readonly [key: string]: S.Json }): O.Option<string> => {
  if (!P.hasProperty(fact, "veracity")) return O.none();
  const value = fact.veracity;
  if (value === null) return O.none();
  if (P.isString(value)) return O.some(value);
  return O.some(JSON.stringify(value));
};

/**
 * Review conflict that cannot be written.
 *
 * **Example** (Missing fact id)
 *
 * ```ts
 * import { MemoryReviewRejected } from "./MemoryReview.ts"
 *
 * const error = MemoryReviewRejected.make({ reason: "review conflict requires fact.id" })
 * console.log(error.reason) // "review conflict requires fact.id"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MemoryReviewRejected extends S.TaggedError<MemoryReviewRejected>()(
  "MemoryReviewRejected",
  {
    reason: S.String,
  },
  $I.annoteError<MemoryReviewRejected>("MemoryReviewRejected", {
    description: "A canonical memory review conflict could not be built.",
  }),
) {}

/**
 * Encoded form of {@link MemoryReviewRejected}.
 *
 * @see {@link MemoryReviewRejected} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryReviewRejected {
  export type Encoded = S.Codec.Encoded<typeof MemoryReviewRejected>;
}

/**
 * Stable review document written by legacy and canonical memory review paths.
 *
 * **Details**
 *
 * `authority`, `sourceItemRevision`, and `sourceContentHash` are omitted from
 * the Python document when they are null. This row stores those absences as
 * SQL null so the column stays present. `sourceCommitId` and
 * `sourceShortTermId` are always present and may be null. `veracity` keeps a
 * string as itself and stores any other JSON value as canonical JSON text.
 *
 * **Gotchas**
 *
 * Canonical authority (`canonical_memory`) requires a source commit, a revision
 * of at least 1, and a content hash. Other authorities may omit them.
 *
 * **Example** (Read a pending review)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { MemoryReviewConflict } from "./MemoryReview.ts"
 *
 * const review = MemoryReviewConflict.make({
 *   reviewId: "review:fact-1:",
 *   factId: "fact-1",
 *   candidate: { id: "fact-1" },
 *   conflictWith: [],
 *   impact: 0.5,
 *   status: "pending",
 *   permittedUses: ["answers_with_disclaimer"],
 *   referencedMemoryIds: ["fact-1"],
 * })
 * console.log(O.isNone(review.veracity)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryReviewConflict extends Model<MemoryReviewConflict>("MemoryReviewConflict")(
  {
    reviewId: S.String.annotateKey({ description: "Stable review id: review:{fact}:{revision?}{conflicts}." }).pipe(
      pg.text(),
      pg.columnName("review_id"),
    ),
    factId: S.String.annotateKey({ description: "Stripped fact id that anchors the review." }).pipe(
      pg.text(),
      pg.columnName("fact_id"),
    ),
    candidate: S.JsonObject.annotateKey({ description: "Original fact document under review." }).pipe(
      pg.jsonb(),
      pg.columnName("candidate"),
    ),
    conflictWith: S.Array(S.String)
      .annotateKey({ description: "Sorted unique conflicting memory ids." })
      .pipe(pg.jsonb(), pg.columnName("conflict_with")),
    veracity: nullableText("veracity", "Fact veracity. Null when the fact omitted it."),
    impact: S.Finite.annotateKey({ description: "Review impact, else fact importance, else 0.5." }).pipe(
      pg.doublePrecision(),
      pg.columnName("impact"),
    ),
    status: S.Literal("pending").annotateKey({ description: "Review queue status. New conflicts are pending." }).pipe(
      pg.text(),
      pg.columnName("status"),
    ),
    authority: optionalNull(S.String)
      .annotateKey({ description: "Review authority. Python omits this key when it is null." })
      .pipe(pg.text(), pg.columnName("authority")),
    sourceCommitId: nullableText("source_commit_id", "Source commit id. Always stored; null when unknown."),
    sourceItemRevision: optionalNull(S.Int)
      .annotateKey({ description: "Source item revision. Present only when the caller supplied one." })
      .pipe(pg.integer(), pg.columnName("source_item_revision")),
    sourceContentHash: optionalNull(S.String)
      .annotateKey({ description: "Source content hash. Present only when the caller supplied one." })
      .pipe(pg.text(), pg.columnName("source_content_hash")),
    sourceShortTermId: nullableText("source_short_term_id", "Short-term id that produced the fact. Null when unknown."),
    createdAt: UtcTimestamp.annotateKey({ description: "Aware instant the review was written." }).pipe(
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("created_at"),
    ),
    updatedAt: UtcTimestamp.annotateKey({ description: "Aware instant the review was written." }).pipe(
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("updated_at"),
    ),
    expiresAt: UtcTimestamp.annotateKey({ description: "Review expiry, now plus ttl hours." }).pipe(
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("expires_at"),
    ),
    permittedUses: S.Array(S.Literal("answers_with_disclaimer"))
      .annotateKey({ description: "Uses permitted while the conflict is pending." })
      .pipe(pg.jsonb(), pg.columnName("permitted_uses")),
    referencedMemoryIds: S.Array(S.String)
      .annotateKey({ description: "Sorted fact id plus conflicting ids." })
      .pipe(pg.jsonb(), pg.columnName("referenced_memory_ids")),
  },
  $I.annote("MemoryReviewConflict", {
    description: "Deterministic canonical-memory review queue record.",
  }),
) {}

/**
 * Encoded form of {@link MemoryReviewConflict}.
 *
 * @see {@link MemoryReviewConflict} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryReviewConflict {
  export type Encoded = S.Codec.Encoded<typeof MemoryReviewConflict>;
}

const requireAware = (now: DateTime.DateTime | string): Effect.Effect<DateTime.Utc, MemoryReviewRejected> => {
  if (P.isString(now)) {
    if (!S.is(S.String.check(S.isPattern(awareInstant)))(now)) {
      return Effect.fail(MemoryReviewRejected.make({ reason: "review conflict timestamp must be timezone-aware" }));
    }
    return DateTime.makeUnsafe(now).pipe(DateTime.toUtc, Effect.succeed);
  }
  return now.pipe(DateTime.toUtc, Effect.succeed);
};

/**
 * Build the stable document written by both legacy and canonical review paths.
 *
 * **Details**
 *
 * The review id is `review:{factId}:{rN:}{sorted conflicts}`. The revision
 * segment is included only for `canonical_memory`. Conflicts are stripped,
 * deduplicated, and sorted. Impact uses the argument, then `fact.importance`
 * when that is a finite number, then `0.5`. Expiry is `now` plus `ttlHours`,
 * defaulting to 72. `now` defaults to the current UTC instant and must carry
 * a zone when passed as a string.
 *
 * **Gotchas**
 *
 * A present null stays absent for authority, revision, and content hash. A
 * missing key is the same absence. Canonical authority rejects a missing
 * commit, a revision below 1, or a missing content hash.
 *
 * **Example** (Build a canonical conflict)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { buildMemoryReviewConflict } from "./MemoryReview.ts"
 *
 * const review = Effect.runSync(
 *   buildMemoryReviewConflict({
 *     fact: { id: "fact-1", importance: 0.25 },
 *     conflictWith: [" b ", "a", "a"],
 *     authority: "canonical_memory",
 *     sourceCommitId: "commit-1",
 *     sourceItemRevision: 2,
 *     sourceContentHash: "abc",
 *     now: "2020-01-02T03:04:05.000Z",
 *     ttlHours: 1,
 *   }),
 * )
 * console.log(review.reviewId) // "review:fact-1:r2:a,b"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const buildMemoryReviewConflict = Effect.fn("MemoryReview.buildMemoryReviewConflict")(function* (input: {
  readonly fact: { readonly [key: string]: S.Json };
  readonly conflictWith: ReadonlyArray<string>;
  readonly authority?: string | null;
  readonly sourceCommitId?: string | null;
  readonly sourceItemRevision?: number | null;
  readonly sourceContentHash?: string | null;
  readonly sourceShortTermId?: string | null;
  readonly impact?: number | null;
  readonly ttlHours?: number;
  readonly now?: DateTime.DateTime | string;
}) {
  const current = yield* requireAware(input.now ?? DateTime.nowUnsafe());
  const factId = factIdText(input.fact.id);
  if (Str.isEmpty(factId)) {
    return yield* MemoryReviewRejected.make({ reason: "review conflict requires fact.id" });
  }
  const authority = input.authority ?? null;
  const sourceCommitId = input.sourceCommitId ?? null;
  const sourceItemRevision = input.sourceItemRevision ?? null;
  const sourceContentHash = input.sourceContentHash ?? null;
  if (
    authority === "canonical_memory" &&
    (sourceCommitId === null ||
      Str.isEmpty(sourceCommitId) ||
      sourceItemRevision === null ||
      sourceItemRevision < 1 ||
      sourceContentHash === null ||
      Str.isEmpty(sourceContentHash))
  ) {
    return yield* MemoryReviewRejected.make({
      reason: "canonical review requires an exact source commit, revision, and content hash",
    });
  }
  const conflicts = A.sort(
    A.dedupe(
      A.filter(
        A.map(input.conflictWith, (value) => (P.isString(value) ? Str.trim(value) : "")),
        Str.isNonEmpty,
      ),
    ),
    Order.String,
  );
  const revisionSegment = authority === "canonical_memory" ? `r${sourceItemRevision}:` : "";
  const importance = input.fact.importance;
  const impact =
    input.impact !== undefined && input.impact !== null
      ? input.impact
      : P.isNumber(importance) && Number.isFinite(importance)
        ? importance
        : 0.5;
  const ttlHours = input.ttlHours ?? 72;
  const referencedMemoryIds = A.sort(A.dedupe([factId, ...conflicts]), Order.String);
  return MemoryReviewConflict.make({
    reviewId: `review:${factId}:${revisionSegment}${A.join(conflicts, ",")}`,
    factId,
    candidate: input.fact,
    conflictWith: conflicts,
    veracity: veracityText(input.fact),
    impact,
    status: "pending",
    authority: authority === null ? O.none() : O.some(authority),
    sourceCommitId: sourceCommitId === null ? O.none() : O.some(sourceCommitId),
    sourceItemRevision: sourceItemRevision === null ? O.none() : O.some(sourceItemRevision),
    sourceContentHash: sourceContentHash === null ? O.none() : O.some(sourceContentHash),
    sourceShortTermId:
      input.sourceShortTermId === undefined || input.sourceShortTermId === null
        ? O.none()
        : O.some(input.sourceShortTermId),
    createdAt: current,
    updatedAt: current,
    expiresAt: DateTime.add(current, { hours: ttlHours }),
    permittedUses: ["answers_with_disclaimer"],
    referencedMemoryIds,
  });
});
