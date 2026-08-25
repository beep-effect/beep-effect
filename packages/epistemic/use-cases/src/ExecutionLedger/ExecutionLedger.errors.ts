/**
 * Execution ledger port errors.
 *
 * The ledger is fail-closed by consumption, not by shape: `appendDecision`
 * failing with any of these is what the governed gate turns into a refusal, so
 * the error vocabulary stays small and total — a constraint the database
 * rejected by name, or an unavailable repository. No error here carries request
 * payload, for the same reason the ledger rows carry none.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { Defect, LiteralKit, SchemaUtils } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $EpistemicUseCasesId.create("ExecutionLedger/ExecutionLedger.errors");

/**
 * Operations the execution ledger port exposes.
 *
 * **Example** (Log appendDecision enum value)
 *
 * ```ts
 * import { ExecutionLedgerOperation } from "@beep/epistemic-use-cases/ExecutionLedger"
 *
 * console.log(ExecutionLedgerOperation.Enum.appendDecision)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExecutionLedgerOperation = LiteralKit([
  "appendDecision",
  "appendOutcome",
  "readDecisions",
  "readOutcomes",
  "readUnsettledAllowed",
]).pipe(
  $I.annoteSchema("ExecutionLedgerOperation", {
    description: "Closed domain of execution ledger port operations.",
  })
);

/**
 * Runtime type for {@link ExecutionLedgerOperation}.
 *
 * **Example** (Assign typed operation value)
 *
 * ```ts
 * import type { ExecutionLedgerOperation } from "@beep/epistemic-use-cases/ExecutionLedger"
 *
 * const operation: ExecutionLedgerOperation = "appendDecision"
 * console.log(operation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionLedgerOperation = typeof ExecutionLedgerOperation.Type;

const optionalDefect = (description: string) =>
  S.OptionFromOptionalKey(Defect({ includeStack: true }))
    .pipe(SchemaUtils.withNoneDefault)
    .annotateKey({
      description,
    });

/**
 * A ledger write the database rejected by constraint name.
 *
 * **Details**
 *
 * The append-only tables reject chain collisions, fabricated outcomes, and
 * shape violations by NAME — never by message prose — so the adapter maps the
 * name straight into this error and the caller branches on nothing weaker.
 *
 * **Example** (Build constraint violation error)
 *
 * ```ts
 * import { ExecutionLedgerConstraintViolation } from "@beep/epistemic-use-cases/ExecutionLedger"
 *
 * const error = ExecutionLedgerConstraintViolation.on("appendDecision", "epistemic_execution_decision_pk")
 * console.log(error.constraintName)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExecutionLedgerConstraintViolation extends S.TaggedError<ExecutionLedgerConstraintViolation>(
  $I`ExecutionLedgerConstraintViolation`
)(
  "ExecutionLedgerConstraintViolation",
  {
    constraintName: S.NonEmptyString.annotateKey({
      description: "Name of the database constraint that rejected the write.",
    }),
    operation: ExecutionLedgerOperation.annotateKey({
      description: "Ledger operation the constraint rejected.",
    }),
  },
  $I.annoteError<ExecutionLedgerConstraintViolation>("ExecutionLedgerConstraintViolation", {
    title: "Execution ledger constraint violation",
    description: "A ledger write was rejected by a named append-only constraint.",
  })
) {
  static readonly is = S.is(ExecutionLedgerConstraintViolation);

  /**
   * Build the violation for a named constraint rejection.
   *
   * **Example** (Build named constraint violation)
   *
   * ```ts
   * import { ExecutionLedgerConstraintViolation } from "@beep/epistemic-use-cases/ExecutionLedger"
   *
   * console.log(ExecutionLedgerConstraintViolation.on("appendOutcome", "epistemic_execution_outcome_pk")._tag)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static on(operation: ExecutionLedgerOperation, constraintName: string): ExecutionLedgerConstraintViolation {
    return ExecutionLedgerConstraintViolation.make({
      constraintName,
      operation,
    });
  }
}

/**
 * The execution ledger could not serve a request.
 *
 * **Example** (Create unavailable during error)
 *
 * ```ts
 * import { ExecutionLedgerUnavailable } from "@beep/epistemic-use-cases/ExecutionLedger"
 *
 * const error = ExecutionLedgerUnavailable.during("readDecisions", "read failed against epistemic_execution_decision")
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExecutionLedgerUnavailable extends S.TaggedError<ExecutionLedgerUnavailable>(
  $I`ExecutionLedgerUnavailable`
)(
  "ExecutionLedgerUnavailable",
  {
    cause: optionalDefect("Optional underlying driver defect captured when the ledger could not serve a request."),
    operation: ExecutionLedgerOperation.annotateKey({
      description: "Ledger operation that could not be served.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty ledger availability diagnostic.",
    }),
  },
  $I.annoteError<ExecutionLedgerUnavailable>("ExecutionLedgerUnavailable", {
    title: "Execution ledger unavailable",
    description: "The execution ledger could not serve the request.",
  })
) {
  static readonly is = S.is(ExecutionLedgerUnavailable);

  /**
   * Build the availability failure for an operation.
   *
   * **Example** (Build availability failure tag)
   *
   * ```ts
   * import { ExecutionLedgerUnavailable } from "@beep/epistemic-use-cases/ExecutionLedger"
   *
   * console.log(ExecutionLedgerUnavailable.during("appendDecision", "write failed")._tag)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static during(operation: ExecutionLedgerOperation, reason: string, cause?: unknown): ExecutionLedgerUnavailable {
    return ExecutionLedgerUnavailable.make({
      cause: O.fromUndefinedOr(cause),
      operation,
      reason,
    });
  }
}

/**
 * Union of execution ledger write failures.
 *
 * **Example** (Check error union membership)
 *
 * ```ts
 * import { ExecutionLedgerError, ExecutionLedgerUnavailable } from "@beep/epistemic-use-cases/ExecutionLedger"
 *
 * console.log(ExecutionLedgerError.is(ExecutionLedgerUnavailable.during("appendDecision", "write failed")))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ExecutionLedgerError = S.Union([ExecutionLedgerConstraintViolation, ExecutionLedgerUnavailable]).pipe(
  $I.annoteSchema("ExecutionLedgerError", {
    description: "Every failure an execution ledger write can produce.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ExecutionLedgerError}.
 *
 * **Example** (Type error handler parameter)
 *
 * ```ts
 * import type { ExecutionLedgerError } from "@beep/epistemic-use-cases/ExecutionLedger"
 *
 * const describe = (error: ExecutionLedgerError): string => error._tag
 * console.log(describe.length) // 1
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionLedgerError = typeof ExecutionLedgerError.Type;
