/**
 * Candor record repository port: the append-and-read-only surface that
 * citation events, attorney dispositions, and information-disclosure facts are
 * written to and read back from. The live implementation is provided in the
 * law-practice server tier.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { CandorDisposition, IdsSubmissionFact, PatentCitationEvent } from "@beep/law-practice-domain";
import { EffectSchema, Fn, LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CandorFilingScope } from "../CandorPolicy/CandorPolicy.values.ts";

const $I = $LawPracticeUseCasesId.create("CandorRecord/CandorRecord.ports");
const CandorRecordOperationBase = LiteralKit([
  "recordEvent",
  "recordDisposition",
  "recordSubmissionFact",
  "listEvents",
  "listDispositions",
  "listSubmissionFacts",
]);

/**
 * Bounded vocabulary of candor record repository operations.
 *
 * **Details**
 *
 * Every member is either an append or a read. There is deliberately no update
 * and no delete member, so the vocabulary itself records that a filed decision
 * is never edited.
 *
 * **Example** (Narrow a repository operation)
 *
 * ```ts
 * import { CandorRecordOperation } from "@beep/law-practice-use-cases/CandorRecord"
 *
 * console.log(CandorRecordOperation.is.recordDisposition("recordDisposition")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandorRecordOperation = CandorRecordOperationBase.pipe(
  $I.annoteSchema("CandorRecordOperation", {
    description: "Bounded vocabulary of append and read operations on the candor record store.",
  }),
  SchemaUtils.withLiteralKitStatics(CandorRecordOperationBase)
);

/**
 * Runtime type for {@link CandorRecordOperation}.
 *
 * @see {@link CandorRecordOperation} for the runtime schema and the append-only rule.
 * @category models
 * @since 0.0.0
 */
export type CandorRecordOperation = typeof CandorRecordOperation.Type;

/**
 * Raised when the candor record repository could not serve a request.
 *
 * **When to use**
 *
 * Use when an append or a read cannot be completed. Both directions
 * matter: an event that failed to record is indistinguishable from an event
 * nobody ever observed, and a read that quietly returned nothing would let the
 * gate report "not blocked" for a filing it never checked.
 *
 * **Example** (Report an append failure with its driver cause)
 *
 * ```ts
 * import { CandorRecordRepositoryUnavailable } from "@beep/law-practice-use-cases/CandorRecord"
 * import * as O from "effect/Option"
 *
 * const error = CandorRecordRepositoryUnavailable.during(
 *   "recordDisposition",
 *   "insert failed",
 *   new Error("ECONNRESET")
 * )
 * console.log(O.isSome(error.cause)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CandorRecordRepositoryUnavailable extends TaggedErrorClass<CandorRecordRepositoryUnavailable>(
  $I`CandorRecordRepositoryUnavailable`
)(
  "CandorRecordRepositoryUnavailable",
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Optional underlying driver defect captured when the repository could not serve a request.",
      }),
    operation: CandorRecordOperation.annotateKey({
      description: "Repository operation that could not be served.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository availability diagnostic.",
    }),
  },
  $I.annote("CandorRecordRepositoryUnavailable", {
    title: "Candor record repository unavailable",
    description: "The candor record repository could not serve the request.",
  })
) {
  /**
   * Build the unavailability error for an operation, optionally retaining the
   * driver defect that produced it.
   *
   * **Example** (Retain the driver defect)
   *
   * ```ts
   * import { CandorRecordRepositoryUnavailable } from "@beep/law-practice-use-cases/CandorRecord"
   *
   * const error = CandorRecordRepositoryUnavailable.during("listEvents", "select failed")
   * console.log(error.operation) // "listEvents"
   * ```
   *
   * @param operation - Repository operation that could not be served.
   * @param reason - Non-empty availability diagnostic.
   * @param cause - Optional underlying driver defect.
   * @returns The typed repository-unavailable failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly during = (
    operation: CandorRecordOperation,
    reason: string,
    cause?: unknown
  ): CandorRecordRepositoryUnavailable =>
    CandorRecordRepositoryUnavailable.make({
      cause: O.fromUndefinedOr(cause),
      operation,
      reason,
    });
}

/**
 * Service shape for the candor record repository.
 *
 * **When to use**
 *
 * Use as the durable seam behind everything the candor gate reads and
 * everything a recording surface writes.
 *
 * **Details**
 *
 * The surface is append and read only in every variant. A recorded event is
 * never edited because a later observation is a new event; a recorded
 * disposition is never edited because revising it would erase the decision it
 * exists to remember; and a recorded submission fact is never edited because a
 * supplement or correction is its own act with its own operative date. The
 * database enforces the same rule with append-only triggers, so a caller that
 * tries anyway fails loudly rather than silently rewriting history.
 *
 * **Gotchas**
 *
 * Every read is keyed by one exact tenant-scoped filing. Nothing here matches
 * across representations: USPTO's series/serial number cannot supply ST.13's
 * filing-year field, so inventing equality would corrupt the filing scope.
 *
 * **Example** (Build an empty in-memory repository)
 *
 * ```ts
 * import { CandorRecordRepositoryShape } from "@beep/law-practice-use-cases/CandorRecord"
 * import { Effect } from "effect"
 *
 * const repository = CandorRecordRepositoryShape.make({
 *   listDispositions: () => Effect.succeed([]),
 *   listEvents: () => Effect.succeed([]),
 *   listSubmissionFacts: () => Effect.succeed([]),
 *   recordDisposition: (disposition) => Effect.succeed(disposition),
 *   recordEvent: (event) => Effect.succeed(event),
 *   recordSubmissionFact: (fact) => Effect.succeed(fact),
 * })
 *
 * console.log(typeof repository.recordEvent) // "function"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class CandorRecordRepositoryShape extends S.Class<CandorRecordRepositoryShape>($I`CandorRecordRepositoryShape`)(
  {
    listDispositions: Fn({
      input: CandorFilingScope,
      output: EffectSchema<ReadonlyArray<CandorDisposition>, CandorRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Read every recorded attorney disposition for one exact tenant-scoped filing.",
    }),
    listEvents: Fn({
      input: CandorFilingScope,
      output: EffectSchema<ReadonlyArray<PatentCitationEvent>, CandorRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Read every recorded patent citation event for one exact tenant-scoped filing.",
    }),
    listSubmissionFacts: Fn({
      input: CandorFilingScope,
      output: EffectSchema<ReadonlyArray<IdsSubmissionFact>, CandorRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Read every recorded information-disclosure submission fact for one exact filing.",
    }),
    recordDisposition: Fn({
      input: CandorDisposition,
      output: EffectSchema<CandorDisposition, CandorRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Append one attorney disposition; revision and withdrawal append superseding records.",
    }),
    recordEvent: Fn({
      input: PatentCitationEvent,
      output: EffectSchema<PatentCitationEvent, CandorRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Append one observed patent citation event.",
    }),
    recordSubmissionFact: Fn({
      input: IdsSubmissionFact,
      output: EffectSchema<IdsSubmissionFact, CandorRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Append one information-disclosure submission act with its own operative date.",
    }),
  },
  $I.annote("CandorRecordRepositoryShape", {
    description: "Append-and-read-only service shape over durable candor records for one filing.",
  })
) {}

/**
 * Candor record repository service tag.
 *
 * **Details**
 *
 * The law-practice server tier satisfies this with a Drizzle-backed layer; the
 * candor gate's narrow read seam is derived from it rather than duplicating it.
 *
 * **Example** (Read through the repository tag)
 *
 * ```ts
 * import { CandorRecordRepository, CandorRecordRepositoryShape } from "@beep/law-practice-use-cases/CandorRecord"
 * import { CandorFilingScope } from "@beep/law-practice-use-cases/CandorPolicy"
 * import { CitingApplicationIdentity, UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const repository = yield* CandorRecordRepository
 *   return yield* repository.listEvents(
 *     CandorFilingScope.make({
 *       citingApplication: CitingApplicationIdentity.make({
 *         applicationNumber: UsptoNormalizedApplicationNumber.make("16138242"),
 *         kind: "UsptoNormalized",
 *       }),
 *       orgId: Shared.OrganizationId.make(1),
 *     })
 *   )
 * }).pipe(
 *   Effect.provideService(
 *     CandorRecordRepository,
 *     CandorRecordRepositoryShape.make({
 *       listDispositions: () => Effect.succeed([]),
 *       listEvents: () => Effect.succeed([]),
 *       listSubmissionFacts: () => Effect.succeed([]),
 *       recordDisposition: (disposition) => Effect.succeed(disposition),
 *       recordEvent: (event) => Effect.succeed(event),
 *       recordSubmissionFact: (fact) => Effect.succeed(fact),
 *     })
 *   )
 * )
 *
 * Effect.runPromise(program).then((events) => console.log(events))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class CandorRecordRepository extends Context.Service<CandorRecordRepository, CandorRecordRepositoryShape>()(
  $I`CandorRecordRepository`
) {}
