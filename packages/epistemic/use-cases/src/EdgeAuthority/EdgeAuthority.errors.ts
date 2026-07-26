/**
 * Edge authority typed errors.
 *
 * Every refusal the bitemporal edge repository can issue is one of three shapes:
 * a supersession that lost its race or named a version that is no longer the
 * head, a named database constraint that rejected the write, or a driver that
 * could not serve the request at all. Conflict is deliberately ONE error rather
 * than three, because the lock loser, the stale caller, and the writer the
 * database backstop caught are indistinguishable to the caller — all three must
 * re-read the head and decide again.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LogicalEdgeKey } from "@beep/epistemic-domain/values";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { PosInt } from "@beep/schema/Int";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $EpistemicUseCasesId.create("EdgeAuthority/EdgeAuthority.errors");

const EdgeAuthorityOperationBase = LiteralKit(["record", "supersede", "readAsOf", "readLatest"]);

/**
 * The bounded vocabulary of operations the edge authority repository exposes.
 * Naming the failing operation as a literal rather than a free-form string keeps
 * error handling exhaustive: a new operation cannot be reported without widening
 * this vocabulary first.
 *
 * @example
 * ```ts
 * import { EdgeAuthorityOperation } from "@beep/epistemic-use-cases/EdgeAuthority"
 * import * as S from "effect/Schema"
 *
 * const operation = S.decodeUnknownSync(EdgeAuthorityOperation)("supersede")
 * console.log(operation)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeAuthorityOperation = EdgeAuthorityOperationBase.pipe(
  $I.annoteSchema("EdgeAuthorityOperation", {
    description: "Bounded vocabulary of edge authority repository operations.",
  }),
  SchemaUtils.withLiteralKitStatics(EdgeAuthorityOperationBase)
);

/**
 * Runtime type for {@link EdgeAuthorityOperation}.
 *
 * @example
 * ```ts
 * import type { EdgeAuthorityOperation } from "@beep/epistemic-use-cases/EdgeAuthority"
 *
 * const operation = "readAsOf" satisfies EdgeAuthorityOperation
 * console.log(operation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeAuthorityOperation = typeof EdgeAuthorityOperation.Type;

const EdgeWriteOperationBase = LiteralKit(EdgeAuthorityOperationBase.pickOptions(["record", "supersede"]));

/**
 * The subset of {@link EdgeAuthorityOperation} that writes. Constraint violations
 * can only be raised by a write, so deriving the subset from the parent
 * vocabulary makes that fact type-level rather than commentary.
 *
 * @example
 * ```ts
 * import { EdgeWriteOperation } from "@beep/epistemic-use-cases/EdgeAuthority"
 * import * as S from "effect/Schema"
 *
 * const operation = S.decodeUnknownSync(EdgeWriteOperation)("record")
 * console.log(operation)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeWriteOperation = EdgeWriteOperationBase.pipe(
  $I.annoteSchema("EdgeWriteOperation", {
    description: "Subset of edge authority operations that write to the bitemporal edge store.",
  }),
  SchemaUtils.withLiteralKitStatics(EdgeWriteOperationBase)
);

/**
 * Runtime type for {@link EdgeWriteOperation}.
 *
 * @example
 * ```ts
 * import type { EdgeWriteOperation } from "@beep/epistemic-use-cases/EdgeAuthority"
 *
 * const operation = "supersede" satisfies EdgeWriteOperation
 * console.log(operation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeWriteOperation = typeof EdgeWriteOperation.Type;

const optionalDefect = (description: string) =>
  S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
    .pipe(SchemaUtils.withNoneDefault)
    .annotateKey({
      description,
    });

/**
 * Raised when a supersession cannot be applied to the version the caller named.
 *
 * The three rejection paths — losing the row lock to a concurrent writer,
 * naming a version that is no longer the open head, and being caught by a
 * database backstop such as the open-head unique index — collapse into this one
 * error on purpose: the caller's recovery is identical in each case, and
 * distinguishing them would leak the repository's locking strategy into the
 * contract. `observedVersion` is absent exactly when no open head could be read.
 *
 * @example
 * ```ts
 * import { SupersessionConflict } from "@beep/epistemic-use-cases/EdgeAuthority"
 * import { LogicalEdgeKey } from "@beep/epistemic-domain/values"
 * import { PosInt } from "@beep/schema/Int"
 * import * as O from "effect/Option"
 *
 * const key = LogicalEdgeKey.make("abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe")
 * const error = SupersessionConflict.staleVersion(key, PosInt.make(2), PosInt.make(3))
 *
 * console.log(O.getOrNull(error.observedVersion))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SupersessionConflict extends TaggedErrorClass<SupersessionConflict>($I`SupersessionConflict`)(
  "SupersessionConflict",
  {
    cause: optionalDefect("Optional underlying defect captured when a database backstop rejected the supersession."),
    expectedVersion: PosInt.annotateKey({
      description: "Version the caller believed was the open head when it issued the supersession.",
    }),
    logicalKey: LogicalEdgeKey.annotateKey({
      description: "Logical edge whose supersession was rejected.",
    }),
    observedVersion: PosInt.pipe(S.OptionFromNullOr, SchemaUtils.withNoneDefault).annotateKey({
      description: "Version actually found at the open head; absent when no open head could be read.",
    }),
  },
  $I.annote("SupersessionConflict", {
    title: "Supersession conflict",
    description: "A supersession could not be applied to the version the caller named.",
  })
) {
  static readonly is = S.is(SupersessionConflict);

  /**
   * Build the conflict for a caller whose `expectedVersion` disagrees with the
   * version actually locked at the open head.
   *
   * @example
   * ```ts
   * import { SupersessionConflict } from "@beep/epistemic-use-cases/EdgeAuthority"
   * import { LogicalEdgeKey } from "@beep/epistemic-domain/values"
   * import { PosInt } from "@beep/schema/Int"
   *
   * const key = LogicalEdgeKey.make("abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe")
   * console.log(SupersessionConflict.staleVersion(key, PosInt.make(1), PosInt.make(4))._tag)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static staleVersion(
    logicalKey: LogicalEdgeKey,
    expectedVersion: PosInt,
    observedVersion: PosInt
  ): SupersessionConflict {
    return SupersessionConflict.make({
      expectedVersion,
      logicalKey,
      observedVersion: O.some(observedVersion),
    });
  }

  /**
   * Build the conflict for a caller that found no open head to lock, because a
   * concurrent writer closed it first.
   *
   * @example
   * ```ts
   * import { SupersessionConflict } from "@beep/epistemic-use-cases/EdgeAuthority"
   * import { LogicalEdgeKey } from "@beep/epistemic-domain/values"
   * import { PosInt } from "@beep/schema/Int"
   * import * as O from "effect/Option"
   *
   * const key = LogicalEdgeKey.make("abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe")
   * console.log(O.isNone(SupersessionConflict.lockLoser(key, PosInt.make(1)).observedVersion))
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static lockLoser(logicalKey: LogicalEdgeKey, expectedVersion: PosInt): SupersessionConflict {
    return SupersessionConflict.make({ expectedVersion, logicalKey });
  }

  /**
   * Build the conflict for a write the database itself rejected — the open-head
   * unique index or the valid-interval exclusion constraint firing under a race
   * the application-side lock did not serialize. The driver defect is retained
   * so the backstop that fired can be identified after the fact.
   *
   * @example
   * ```ts
   * import { SupersessionConflict } from "@beep/epistemic-use-cases/EdgeAuthority"
   * import { LogicalEdgeKey } from "@beep/epistemic-domain/values"
   * import { PosInt } from "@beep/schema/Int"
   * import * as O from "effect/Option"
   *
   * const key = LogicalEdgeKey.make("abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe")
   * const error = SupersessionConflict.backstop(key, PosInt.make(2), new Error("epistemic_edge_open_head_idx"))
   *
   * console.log(O.isSome(error.cause))
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static backstop(logicalKey: LogicalEdgeKey, expectedVersion: PosInt, cause: unknown): SupersessionConflict {
    return SupersessionConflict.make({ cause: O.some(cause), expectedVersion, logicalKey });
  }
}

/**
 * Raised when a named database constraint rejected an edge write for a reason
 * that is not a supersession race — an unordered interval, an endpoint whose
 * kind and reference columns disagree, a dangling foreign key.
 *
 * The constraint is identified by NAME rather than by driver message prose,
 * because the name is the part of the contract the migration owns and tests can
 * assert.
 *
 * @example
 * ```ts
 * import { EdgeConstraintViolation } from "@beep/epistemic-use-cases/EdgeAuthority"
 *
 * const error = EdgeConstraintViolation.on("record", "epistemic_edge_valid_ordered")
 * console.log(error.constraintName)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EdgeConstraintViolation extends TaggedErrorClass<EdgeConstraintViolation>($I`EdgeConstraintViolation`)(
  "EdgeConstraintViolation",
  {
    constraintName: S.NonEmptyString.annotateKey({
      description: "Name of the database constraint that rejected the write.",
    }),
    operation: EdgeWriteOperation.annotateKey({
      description: "Write operation that was rejected.",
    }),
  },
  $I.annote("EdgeConstraintViolation", {
    title: "Edge constraint violation",
    description: "A named database constraint rejected a bitemporal edge write.",
  })
) {
  static readonly is = S.is(EdgeConstraintViolation);

  /**
   * Build the violation from the operation that was rejected and the constraint
   * name the driver reported.
   *
   * @example
   * ```ts
   * import { EdgeConstraintViolation } from "@beep/epistemic-use-cases/EdgeAuthority"
   *
   * console.log(EdgeConstraintViolation.on("supersede", "epistemic_edge_no_self_supersede").operation)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static on(operation: EdgeWriteOperation, constraintName: string): EdgeConstraintViolation {
    return EdgeConstraintViolation.make({ constraintName, operation });
  }
}

/**
 * Raised when the edge authority repository could not serve a request at all:
 * the connection is gone, the transaction was aborted by the driver, the query
 * failed for a reason that is neither a conflict nor a named constraint.
 *
 * @example
 * ```ts
 * import { EdgeRepositoryUnavailable } from "@beep/epistemic-use-cases/EdgeAuthority"
 *
 * const error = EdgeRepositoryUnavailable.during("readLatest", "database connection closed")
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EdgeRepositoryUnavailable extends TaggedErrorClass<EdgeRepositoryUnavailable>(
  $I`EdgeRepositoryUnavailable`
)(
  "EdgeRepositoryUnavailable",
  {
    cause: optionalDefect("Optional underlying driver defect captured when the repository could not serve a request."),
    operation: EdgeAuthorityOperation.annotateKey({
      description: "Repository operation that could not be served.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository availability diagnostic.",
    }),
  },
  $I.annote("EdgeRepositoryUnavailable", {
    title: "Edge repository unavailable",
    description: "The bitemporal edge repository could not serve the request.",
  })
) {
  static readonly is = S.is(EdgeRepositoryUnavailable);

  /**
   * Build the unavailability error for an operation, optionally retaining the
   * driver defect that produced it.
   *
   * @example
   * ```ts
   * import { EdgeRepositoryUnavailable } from "@beep/epistemic-use-cases/EdgeAuthority"
   * import * as O from "effect/Option"
   *
   * const error = EdgeRepositoryUnavailable.during("record", "insert failed", new Error("ECONNRESET"))
   * console.log(O.isSome(error.cause))
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static during(operation: EdgeAuthorityOperation, reason: string, cause?: unknown): EdgeRepositoryUnavailable {
    return EdgeRepositoryUnavailable.make({
      cause: O.fromUndefinedOr(cause),
      operation,
      reason,
    });
  }
}

/**
 * Union of every edge authority repository failure.
 *
 * @example
 * ```ts
 * import { EdgeAuthorityError, EdgeRepositoryUnavailable } from "@beep/epistemic-use-cases/EdgeAuthority"
 *
 * console.log(EdgeAuthorityError.is(EdgeRepositoryUnavailable.during("readAsOf", "maintenance")))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const EdgeAuthorityError = S.Union([
  SupersessionConflict,
  EdgeConstraintViolation,
  EdgeRepositoryUnavailable,
]).pipe(
  $I.annoteSchema("EdgeAuthorityError", {
    title: "Edge authority error",
    description: "Union of every edge authority repository failure.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link EdgeAuthorityError}.
 *
 * @example
 * ```ts
 * import { EdgeRepositoryUnavailable } from "@beep/epistemic-use-cases/EdgeAuthority"
 * import type { EdgeAuthorityError } from "@beep/epistemic-use-cases/EdgeAuthority"
 *
 * const error: EdgeAuthorityError = EdgeRepositoryUnavailable.during("readLatest", "maintenance")
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeAuthorityError = typeof EdgeAuthorityError.Type;
