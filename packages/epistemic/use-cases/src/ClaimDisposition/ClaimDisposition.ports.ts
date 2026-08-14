/**
 * Claim disposition repository port: the append-only surface durable claim
 * resolutions are written to and read back from. The live implementation is
 * provided in the epistemic server tier.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Context } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import type * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import type { Effect } from "effect";

const $I = $EpistemicUseCasesId.create("ClaimDisposition/ClaimDisposition.ports");

const ClaimDispositionOperationBase = LiteralKit(["record", "listByClaim"]);

/**
 * Bounded vocabulary of claim disposition repository operations.
 *
 * **Example** (Decode operation with Schema)
 *
 * ```ts
 * import { ClaimDispositionOperation } from "@beep/epistemic-use-cases/ClaimDisposition"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(ClaimDispositionOperation)("record"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimDispositionOperation = ClaimDispositionOperationBase.pipe(
  $I.annoteSchema("ClaimDispositionOperation", {
    description: "Bounded vocabulary of claim disposition repository operations.",
  }),
  SchemaUtils.withLiteralKitStatics(ClaimDispositionOperationBase)
);

/**
 * Runtime type for {@link ClaimDispositionOperation}.
 *
 * **Example** (Satisfy operation type check)
 *
 * ```ts
 * import type { ClaimDispositionOperation } from "@beep/epistemic-use-cases/ClaimDisposition"
 *
 * const operation = "listByClaim" satisfies ClaimDispositionOperation
 * console.log(operation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimDispositionOperation = typeof ClaimDispositionOperation.Type;

/**
 * Raised when the claim disposition repository could not serve a request.
 *
 * **Details**
 *
 * Persisting a rejection is not optional bookkeeping: a rejected claim that
 * failed to record its disposition is indistinguishable from a claim nobody ever
 * gated, so this failure is typed and propagated rather than logged and dropped.
 *
 * **Example** (Create unavailability error)
 *
 * ```ts
 * import { ClaimDispositionRepositoryUnavailable } from "@beep/epistemic-use-cases/ClaimDisposition"
 *
 * const error = ClaimDispositionRepositoryUnavailable.during("record", "database connection closed")
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ClaimDispositionRepositoryUnavailable extends S.TaggedError<ClaimDispositionRepositoryUnavailable>(
  $I`ClaimDispositionRepositoryUnavailable`
)(
  "ClaimDispositionRepositoryUnavailable",
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Optional underlying driver defect captured when the repository could not serve a request.",
      }),
    operation: ClaimDispositionOperation.annotateKey({
      description: "Repository operation that could not be served.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository availability diagnostic.",
    }),
  },
  $I.annote("ClaimDispositionRepositoryUnavailable", {
    title: "Claim disposition repository unavailable",
    description: "The claim disposition repository could not serve the request.",
  })
) {
  static readonly is = S.is(ClaimDispositionRepositoryUnavailable);

  /**
   * Build the unavailability error for an operation, optionally retaining the
   * driver defect that produced it.
   *
   * **Example** (Build error with cause)
   *
   * ```ts
   * import { ClaimDispositionRepositoryUnavailable } from "@beep/epistemic-use-cases/ClaimDisposition"
   * import * as O from "effect/Option"
   *
   * const error = ClaimDispositionRepositoryUnavailable.during("record", "insert failed", new Error("ECONNRESET"))
   * console.log(O.isSome(error.cause))
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static during(
    operation: ClaimDispositionOperation,
    reason: string,
    cause?: unknown
  ): ClaimDispositionRepositoryUnavailable {
    return ClaimDispositionRepositoryUnavailable.make({
      cause: O.fromUndefinedOr(cause),
      operation,
      reason,
    });
  }
}

/**
 * Service shape for the claim disposition repository. The surface is append and
 * read only: a disposition that has been recorded is never edited, because
 * revising it would erase the decision it exists to remember. A claim's later
 * resolution is a new disposition, and the earlier one becomes `superseded`.
 *
 * **Example** (Implement repository shape)
 *
 * ```ts
 * import type { ClaimDispositionRepositoryShape } from "@beep/epistemic-use-cases/ClaimDisposition"
 * import { Effect } from "effect"
 *
 * const shape: ClaimDispositionRepositoryShape = {
 *   listByClaim: () => Effect.succeed([]),
 *   record: (disposition) => Effect.succeed(disposition)
 * }
 *
 * console.log(typeof shape.record)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export interface ClaimDispositionRepositoryShape {
  readonly listByClaim: (
    claimId: Epistemic.CandidateClaimId
  ) => Effect.Effect<ReadonlyArray<ClaimDisposition>, ClaimDispositionRepositoryUnavailable>;
  readonly record: (
    disposition: ClaimDisposition
  ) => Effect.Effect<ClaimDisposition, ClaimDispositionRepositoryUnavailable>;
}

/**
 * Claim disposition repository service tag.
 *
 * **Example** (Provide repository service)
 *
 * ```ts
 * import { ClaimDispositionRepository } from "@beep/epistemic-use-cases/ClaimDisposition"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const repository = yield* ClaimDispositionRepository
 *   return typeof repository.listByClaim === "function"
 * }).pipe(
 *   Effect.provideService(
 *     ClaimDispositionRepository,
 *     ClaimDispositionRepository.of({
 *       listByClaim: () => Effect.succeed([]),
 *       record: (disposition) => Effect.succeed(disposition)
 *     })
 *   )
 * )
 *
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class ClaimDispositionRepository extends Context.Service<
  ClaimDispositionRepository,
  ClaimDispositionRepositoryShape
>()($I`ClaimDispositionRepository`) {}
