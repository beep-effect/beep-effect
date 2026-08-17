/**
 * Persistent claim-conflict repository.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DrizzleError } from "@beep/drizzle";
import { $ScratchpadId } from "@beep/identity";
import { PostgresDrizzle } from "@beep/postgres";
import { NonNegativeInt } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import { UUID } from "@beep/schema/String";
import { aliasedTable, and, count, desc, eq, or } from "drizzle-orm";
import { Context, DateTime, Effect, Equal, Layer, Match, Order } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { ConflictActor, ConflictKind, ConflictsQuery, ConflictTransition } from "../Domain/Schema/Timeline.ts";
import type { ConflictInsertRow } from "./schema.ts";
import { Claims, Conflicts, claims, conflicts } from "./schema.ts";

const $I = $ScratchpadId.create("effect-ontology/Repository/Conflict");
const UUIDString = UUID.pipe(S.decodeTo(S.String));

const claimA = aliasedTable(claims, "conflict_claim_a");
const claimB = aliasedTable(claims, "conflict_claim_b");

const ConflictRecordDefinition = S.Struct({
  conflict: Conflicts.select,
  claimA: Claims.select,
  claimB: Claims.select,
});

/**
 * Persisted conflict with both competing claims.
 *
 * **Example** (Reject an incomplete joined record)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ConflictRecord } from "@effect-ontology/Repository/Conflict"
 *
 * console.log(S.is(ConflictRecord)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ConflictRecord = ConflictRecordDefinition.pipe(
  $I.annoteSchema("ConflictRecord", {
    description: "One persisted conflict joined to its canonical ordered claim pair.",
  })
);

/**
 * Runtime value decoded by {@link ConflictRecord}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConflictRecord = typeof ConflictRecord.Type;

const ConflictCounts = S.Struct({ total: NonNegativeInt, pending: NonNegativeInt }).pipe(
  $I.annoteSchema("ConflictCounts", {
    description: "Unpaginated total and pending conflict counts for one query scope.",
  })
);

const CountRow = S.Struct({ count: NonNegativeInt });

type ConflictComparableClaim = {
  readonly objectValue: string;
  readonly validFrom?: Date | null | undefined;
  readonly validTo?: Date | null | undefined;
};

class ConflictUpdate extends S.Class<ConflictUpdate>($I`ConflictUpdate`)(
  {
    status: S.Literals(["ignored", "resolved"]),
    resolutionStrategy: S.NullOr(S.String),
    acceptedClaimId: S.NullOr(UUIDString),
    resolvedBy: S.NonEmptyString,
    resolvedByFingerprint: S.NullOr(Sha256Hex.pipe(S.decodeTo(S.String))),
    resolvedAt: S.Date,
    resolutionNotes: S.NullOr(S.String),
  },
  $I.annote("ConflictUpdate", {
    description: "Validated terminal conflict-state columns written atomically by the repository.",
  })
) {}

/**
 * Signals that a persisted claim was paired with itself.
 *
 * **Example** (Inspect an equal-pair failure)
 *
 * ```ts
 * import { EqualConflictPairError } from "@effect-ontology/Repository/Conflict"
 *
 * const error = EqualConflictPairError.make({
 *   claimId: "00000000-0000-4000-8000-000000000011"
 * })
 *
 * console.log(error._tag) // "EqualConflictPairError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EqualConflictPairError extends S.TaggedError<EqualConflictPairError>($I`EqualConflictPairError`)(
  "EqualConflictPairError",
  { claimId: UUIDString },
  $I.annote("EqualConflictPairError", {
    description: "Conflict pair construction failed because both sides identify the same persisted claim.",
  })
) {}

const normalizeDecodedRows = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, DrizzleError, R> =>
  effect.pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("decodeRows", cause)));

const normalizeQueryError = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, DrizzleError, R> =>
  effect.pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)));

const decodeConflictRecords = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(ConflictRecord.pipe(S.Array, S.mutable))(rows));

const decodeConflictRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(Conflicts.select.pipe(S.Array, S.mutable))(rows));

const decodeCountRow = (rows: unknown) => normalizeDecodedRows(S.decodeUnknownEffect(S.Tuple([CountRow]))(rows));

/**
 * Canonicalize a pair of claim UUIDs for persistence.
 *
 * **Example** (Order a claim pair)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { canonicalConflictPair } from "@effect-ontology/Repository/Conflict"
 *
 * const program = Effect.gen(function* () {
 *   const pair = yield* canonicalConflictPair(
 *     "00000000-0000-4000-8000-000000000012",
 *     "00000000-0000-4000-8000-000000000011"
 *   )
 *
 *   console.log(pair)
 * })
 *
 * console.log(program)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const canonicalConflictPair: {
  (right: string): (left: string) => Effect.Effect<readonly [string, string], EqualConflictPairError>;
  (left: string, right: string): Effect.Effect<readonly [string, string], EqualConflictPairError>;
} = dual(
  2,
  Effect.fn("ConflictRepository.canonicalConflictPair")(function* (left: string, right: string) {
    if (Equal.equals(left, right)) return yield* EqualConflictPairError.make({ claimId: left });
    return Order.isLessThan(Order.String)(left, right) ? [left, right] : [right, left];
  })
);

/**
 * Detect the authoritative conflict kind for two competing claims.
 *
 * **Example** (Detect a position conflict)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { detectConflictKind } from "@effect-ontology/Repository/Conflict"
 *
 * const kind = detectConflictKind({ objectValue: "old" }, { objectValue: "new" })
 * console.log(O.getOrNull(kind)) // "position"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const detectConflictKind: {
  (right: ConflictComparableClaim): (left: ConflictComparableClaim) => O.Option<ConflictKind>;
  (left: ConflictComparableClaim, right: ConflictComparableClaim): O.Option<ConflictKind>;
} = dual(2, (left: ConflictComparableClaim, right: ConflictComparableClaim): O.Option<ConflictKind> => {
  if (Equal.equals(left.objectValue, right.objectValue)) {
    return O.none();
  }

  return O.match(
    O.all({
      leftStart: O.fromNullishOr(left.validFrom),
      leftEnd: O.fromNullishOr(left.validTo),
      rightStart: O.fromNullishOr(right.validFrom),
      rightEnd: O.fromNullishOr(right.validTo),
    }),
    {
      onNone: () => O.some("position"),
      onSome: ({ leftEnd, leftStart, rightEnd, rightStart }) =>
        DateTime.isLessThanOrEqualTo(DateTime.fromDateUnsafe(leftStart), DateTime.fromDateUnsafe(rightEnd)) &&
        DateTime.isGreaterThanOrEqualTo(DateTime.fromDateUnsafe(leftEnd), DateTime.fromDateUnsafe(rightStart))
          ? O.some("temporal")
          : O.some("position"),
    }
  );
});

const selectConflictRecords = (db: typeof PostgresDrizzle.Service, query: ConflictsQuery) => {
  const where = and(
    eq(conflicts.ontologyId, query.ontologyId),
    O.getOrUndefined(O.map(query.status, (status) => eq(conflicts.status, status))),
    O.getOrUndefined(O.map(query.subject, (subject) => eq(claimA.subjectIri, subject))),
    O.getOrUndefined(
      O.map(query.articleId, (articleId) => or(eq(claimA.articleId, articleId), eq(claimB.articleId, articleId)))
    )
  );

  return db
    .select({ conflict: conflicts, claimA, claimB })
    .from(conflicts)
    .innerJoin(claimA, eq(conflicts.claimAId, claimA.id))
    .innerJoin(claimB, eq(conflicts.claimBId, claimB.id))
    .where(where)
    .orderBy(desc(conflicts.detectedAt), desc(conflicts.id));
};

const selectConflictCount = (
  db: typeof PostgresDrizzle.Service,
  query: ConflictsQuery,
  status: O.Option<"pending" | "resolved" | "ignored">
) =>
  db
    .select({ count: count() })
    .from(conflicts)
    .innerJoin(claimA, eq(conflicts.claimAId, claimA.id))
    .innerJoin(claimB, eq(conflicts.claimBId, claimB.id))
    .where(
      and(
        eq(conflicts.ontologyId, query.ontologyId),
        O.getOrUndefined(O.map(status, (value) => eq(conflicts.status, value))),
        O.getOrUndefined(O.map(query.subject, (subject) => eq(claimA.subjectIri, subject))),
        O.getOrUndefined(
          O.map(query.articleId, (articleId) => or(eq(claimA.articleId, articleId), eq(claimB.articleId, articleId)))
        )
      )
    );

/**
 * Repository for detected conflict persistence, queries, counts, and terminal transitions.
 *
 * **Example** (Inspect the conflict service)
 *
 * ```ts
 * import { ConflictRepository } from "@effect-ontology/Repository/Conflict"
 *
 * console.log(ConflictRepository)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class ConflictRepository extends Context.Service<ConflictRepository>()($I`ConflictRepository`, {
  make: Effect.gen(function* () {
    const drizzle = yield* PostgresDrizzle;

    const get = Effect.fn("ConflictRepository.get")(function* (ontologyId: string, id: string) {
      const rows = yield* normalizeQueryError(
        drizzle
          .select({ conflict: conflicts, claimA, claimB })
          .from(conflicts)
          .innerJoin(claimA, eq(conflicts.claimAId, claimA.id))
          .innerJoin(claimB, eq(conflicts.claimBId, claimB.id))
          .where(and(eq(conflicts.ontologyId, ontologyId), eq(conflicts.id, id)))
          .limit(1)
      );
      return A.head(yield* decodeConflictRecords(rows));
    });

    const list = Effect.fn("ConflictRepository.list")(function* (query: ConflictsQuery) {
      const rows = yield* normalizeQueryError(
        selectConflictRecords(drizzle, query).limit(query.limit).offset(query.offset)
      );
      return yield* decodeConflictRecords(rows);
    });

    const counts = Effect.fn("ConflictRepository.counts")(function* (query: ConflictsQuery) {
      const totalQuery = selectConflictCount(drizzle, query, query.status);
      const pendingQuery = selectConflictCount(drizzle, query, O.some("pending"));
      const [[total], [pending]] = yield* Effect.all(
        [
          normalizeQueryError(totalQuery).pipe(Effect.flatMap(decodeCountRow)),
          normalizeQueryError(pendingQuery).pipe(Effect.flatMap(decodeCountRow)),
        ],
        { concurrency: "unbounded" }
      );
      return yield* S.decodeEffect(ConflictCounts)({ total: total.count, pending: pending.count }).pipe(
        Effect.mapError((cause) => DrizzleError.fromUnknown("decodeRows", cause))
      );
    });

    const recordDetected = Effect.fn("ConflictRepository.recordDetected")(function* (
      detected: Pick<ConflictInsertRow, "ontologyId" | "conflictType" | "claimAId" | "claimBId">
    ) {
      const [claimAId, claimBId] = yield* canonicalConflictPair(detected.claimAId, detected.claimBId);
      const rows = yield* normalizeQueryError(
        drizzle
          .insert(conflicts)
          .values({ ...detected, claimAId, claimBId })
          .onConflictDoNothing({
            target: [conflicts.ontologyId, conflicts.claimAId, conflicts.claimBId],
          })
          .returning()
      );
      return A.head(yield* decodeConflictRows(rows));
    });

    const transition = Effect.fn("ConflictRepository.transition")(function* (
      ontologyId: string,
      id: string,
      action: ConflictTransition,
      actor: ConflictActor
    ) {
      const now = DateTime.toDate(yield* DateTime.now);
      const existing = yield* get(ontologyId, id);
      if (O.isNone(existing) || !Equal.equals(existing.value.conflict.status, "pending")) {
        return O.none<ConflictRecord>();
      }

      const toUpdate: (transition: ConflictTransition) => ConflictUpdate = Match.type<ConflictTransition>().pipe(
        Match.when(
          { _tag: "ignore" },
          ({ notes }): ConflictUpdate =>
            ConflictUpdate.make({
              status: "ignored",
              resolutionStrategy: null,
              acceptedClaimId: null,
              resolvedBy: actor.principal,
              resolvedByFingerprint: O.getOrNull(actor.credentialFingerprint),
              resolvedAt: now,
              resolutionNotes: O.getOrNull(notes),
            })
        ),
        Match.when(
          { _tag: "resolve" },
          ({ acceptedClaim, notes, strategy }): ConflictUpdate =>
            ConflictUpdate.make({
              status: "resolved",
              resolutionStrategy: strategy,
              acceptedClaimId: Equal.equals(acceptedClaim, "claimA")
                ? existing.value.conflict.claimAId
                : existing.value.conflict.claimBId,
              resolvedBy: actor.principal,
              resolvedByFingerprint: O.getOrNull(actor.credentialFingerprint),
              resolvedAt: now,
              resolutionNotes: O.getOrNull(notes),
            })
        ),
        Match.exhaustive
      );
      const update = toUpdate(action);

      const updated = yield* normalizeQueryError(
        drizzle
          .update(conflicts)
          .set(update)
          .where(and(eq(conflicts.ontologyId, ontologyId), eq(conflicts.id, id), eq(conflicts.status, "pending")))
          .returning()
      );
      if (A.isReadonlyArrayEmpty(yield* decodeConflictRows(updated))) {
        return O.none<ConflictRecord>();
      }
      return yield* get(ontologyId, id);
    });

    return { counts, get, list, recordDetected, transition };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
