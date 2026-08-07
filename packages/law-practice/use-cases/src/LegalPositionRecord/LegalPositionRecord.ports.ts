/**
 * Legal position record repository port: the append-and-read-only surface that
 * stored relations, recorded act frames, attempted power exercises, appended
 * corrections, and screened opposition candidates are written to and read back
 * from. The live implementation is provided in the law-practice server tier.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  ActFrame,
  CorrectionDelta,
  LegalOppositionCandidate,
  LegalPositionRelator,
  PowerExercise,
} from "@beep/law-practice-domain";
import { EffectSchema, Fn, LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ActFrameRecordScope, LegalPositionRecordScope } from "./LegalPositionRecord.values.ts";

const $I = $LawPracticeUseCasesId.create("LegalPositionRecord/LegalPositionRecord.ports");
const LegalPositionRecordOperationBase = LiteralKit([
  "recordRelator",
  "recordFrame",
  "recordExercise",
  "recordCorrection",
  "recordOppositionCandidate",
  "listRelators",
  "listFrames",
  "listExercises",
  "listCorrections",
  "listOppositionCandidates",
]);

/**
 * Bounded vocabulary of legal position record repository operations.
 *
 * **Details**
 *
 * Every member is either an append or a read. There is deliberately no update
 * and no delete member, so the vocabulary itself records that a legal position,
 * an interpretation, and an attempted act are never edited once written.
 *
 * **Example** (Narrow a repository operation)
 *
 * ```ts
 * import { LegalPositionRecordOperation } from "@beep/law-practice-use-cases/LegalPositionRecord"
 *
 * console.log(LegalPositionRecordOperation.is.recordExercise("recordExercise")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LegalPositionRecordOperation = LegalPositionRecordOperationBase.pipe(
  $I.annoteSchema("LegalPositionRecordOperation", {
    description: "Bounded vocabulary of append and read operations on the legal position record store.",
  }),
  SchemaUtils.withLiteralKitStatics(LegalPositionRecordOperationBase)
);

/**
 * Runtime type for {@link LegalPositionRecordOperation}.
 *
 * @see {@link LegalPositionRecordOperation} for the runtime schema and the append-only rule.
 * @category models
 * @since 0.0.0
 */
export type LegalPositionRecordOperation = typeof LegalPositionRecordOperation.Type;

/**
 * Raised when the legal position record repository could not serve a request.
 *
 * **When to use**
 *
 * Use when an append or a read cannot be completed. Both directions matter: an
 * exercise that failed to record is indistinguishable from an act nobody
 * attempted, and a read that quietly returned nothing would let a reader
 * conclude a position has no lineage when the lineage was simply unreachable.
 *
 * **Example** (Report an append failure with its driver cause)
 *
 * ```ts
 * import { LegalPositionRecordRepositoryUnavailable } from "@beep/law-practice-use-cases/LegalPositionRecord"
 * import * as O from "effect/Option"
 *
 * const error = LegalPositionRecordRepositoryUnavailable.during(
 *   "recordExercise",
 *   "insert failed",
 *   new Error("ECONNRESET")
 * )
 * console.log(O.isSome(error.cause)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LegalPositionRecordRepositoryUnavailable extends TaggedErrorClass<LegalPositionRecordRepositoryUnavailable>(
  $I`LegalPositionRecordRepositoryUnavailable`
)(
  "LegalPositionRecordRepositoryUnavailable",
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Optional underlying driver defect captured when the repository could not serve a request.",
      }),
    operation: LegalPositionRecordOperation.annotateKey({
      description: "Repository operation that could not be served.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository availability diagnostic.",
    }),
  },
  $I.annote("LegalPositionRecordRepositoryUnavailable", {
    title: "Legal position record repository unavailable",
    description: "The legal position record repository could not serve the request.",
  })
) {
  /**
   * Build the unavailability error for an operation, optionally retaining the
   * driver defect that produced it.
   *
   * **Example** (Retain the driver defect)
   *
   * ```ts
   * import { LegalPositionRecordRepositoryUnavailable } from "@beep/law-practice-use-cases/LegalPositionRecord"
   *
   * const error = LegalPositionRecordRepositoryUnavailable.during("listRelators", "select failed")
   * console.log(error.operation) // "listRelators"
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
    operation: LegalPositionRecordOperation,
    reason: string,
    cause?: unknown
  ): LegalPositionRecordRepositoryUnavailable =>
    LegalPositionRecordRepositoryUnavailable.make({
      cause: O.fromUndefinedOr(cause),
      operation,
      reason,
    });
}

/**
 * Service shape for the legal position record repository.
 *
 * **When to use**
 *
 * Use as the durable seam behind everything the legal position runtime records
 * and everything a reader of that runtime reads.
 *
 * **Details**
 *
 * The surface is append and read only in every variant, and each kind has its
 * own reason. A stored relation is never edited because superseding it is a new
 * record and the correlative and opposite readings are derived views that are
 * never written at all. A frame is never edited because a second reading of the
 * same provision is a different interpreter's, or the same interpreter's later
 * one, and both are facts worth keeping. An exercise is never edited because it
 * records an attempt, and a determination made about that attempt afterwards is
 * its own record. A correction is never edited because revising it appends a
 * further delta naming the one it supersedes. A candidate is never edited
 * because a second party's priority basis and a later verdict-family assignment
 * are appended rather than merged in. The database enforces the same rule with
 * append-only triggers, so a caller that tries anyway fails loudly rather than
 * silently rewriting history.
 *
 * **Gotchas**
 *
 * Reads come back by `id` ascending, which is the order the records were
 * appended and nothing else. It is not a ranking, and for candidates in
 * particular it must never be read as one: the pair inside a candidate is an
 * unordered set of two, and `PriorityBasis` ships no order, no score, and no
 * comparison, so precedence between two positions is unreachable rather than
 * merely discouraged.
 *
 * **Example** (Build an empty in-memory repository)
 *
 * ```ts
 * import { LegalPositionRecordRepositoryShape } from "@beep/law-practice-use-cases/LegalPositionRecord"
 * import { Effect } from "effect"
 *
 * const repository = LegalPositionRecordRepositoryShape.make({
 *   listCorrections: () => Effect.succeed([]),
 *   listExercises: () => Effect.succeed([]),
 *   listFrames: () => Effect.succeed([]),
 *   listOppositionCandidates: () => Effect.succeed([]),
 *   listRelators: () => Effect.succeed([]),
 *   recordCorrection: (correction) => Effect.succeed(correction),
 *   recordExercise: (exercise) => Effect.succeed(exercise),
 *   recordFrame: (frame) => Effect.succeed(frame),
 *   recordOppositionCandidate: (candidate) => Effect.succeed(candidate),
 *   recordRelator: (relator) => Effect.succeed(relator),
 * })
 *
 * console.log(typeof repository.recordRelator) // "function"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class LegalPositionRecordRepositoryShape extends S.Class<LegalPositionRecordRepositoryShape>(
  $I`LegalPositionRecordRepositoryShape`
)(
  {
    listCorrections: Fn({
      input: ActFrameRecordScope,
      output: EffectSchema<ReadonlyArray<CorrectionDelta>, LegalPositionRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Read every appended correction to one tenant-scoped act frame.",
    }),
    listExercises: Fn({
      input: ActFrameRecordScope,
      output: EffectSchema<ReadonlyArray<PowerExercise>, LegalPositionRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Read every recorded attempt made under one tenant-scoped act frame.",
    }),
    listFrames: Fn({
      input: LegalPositionRecordScope,
      output: EffectSchema<ReadonlyArray<ActFrame>, LegalPositionRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Read every recorded act frame for one organization.",
    }),
    listOppositionCandidates: Fn({
      input: LegalPositionRecordScope,
      output: EffectSchema<ReadonlyArray<LegalOppositionCandidate>, LegalPositionRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Read every screened opposition candidate for one organization, in append order only.",
    }),
    listRelators: Fn({
      input: LegalPositionRecordScope,
      output: EffectSchema<ReadonlyArray<LegalPositionRelator>, LegalPositionRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Read every stored advantage-side relation for one organization.",
    }),
    recordCorrection: Fn({
      input: CorrectionDelta,
      output: EffectSchema<CorrectionDelta, LegalPositionRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Append one correction; revising it appends a further delta naming this one.",
    }),
    recordExercise: Fn({
      input: PowerExercise,
      output: EffectSchema<PowerExercise, LegalPositionRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Append one attempted exercise, whether or not it was determined to have taken effect.",
    }),
    recordFrame: Fn({
      input: ActFrame,
      output: EffectSchema<ActFrame, LegalPositionRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Append one interpreter's reading of a norm as an act.",
    }),
    recordOppositionCandidate: Fn({
      input: LegalOppositionCandidate,
      output: EffectSchema<LegalOppositionCandidate, LegalPositionRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Append one screened candidate; a basis or a verdict family recorded later is its own row.",
    }),
    recordRelator: Fn({
      input: LegalPositionRelator,
      output: EffectSchema<LegalPositionRelator, LegalPositionRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Append one stored advantage-side relation; no derived view is ever written.",
    }),
  },
  $I.annote("LegalPositionRecordRepositoryShape", {
    description: "Append-and-read-only service shape over the durable legal position record store.",
  })
) {}

/**
 * Legal position record repository service tag.
 *
 * **Details**
 *
 * The law-practice server tier satisfies this with a Drizzle-backed layer and
 * an in-memory sibling for database-free proofs.
 *
 * **Example** (Read through the repository tag)
 *
 * ```ts
 * import {
 *   LegalPositionRecordRepository,
 *   LegalPositionRecordRepositoryShape,
 *   LegalPositionRecordScope
 * } from "@beep/law-practice-use-cases/LegalPositionRecord"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const repository = yield* LegalPositionRecordRepository
 *   return yield* repository.listRelators(
 *     LegalPositionRecordScope.make({ orgId: Shared.OrganizationId.make(1) })
 *   )
 * }).pipe(
 *   Effect.provideService(
 *     LegalPositionRecordRepository,
 *     LegalPositionRecordRepositoryShape.make({
 *       listCorrections: () => Effect.succeed([]),
 *       listExercises: () => Effect.succeed([]),
 *       listFrames: () => Effect.succeed([]),
 *       listOppositionCandidates: () => Effect.succeed([]),
 *       listRelators: () => Effect.succeed([]),
 *       recordCorrection: (correction) => Effect.succeed(correction),
 *       recordExercise: (exercise) => Effect.succeed(exercise),
 *       recordFrame: (frame) => Effect.succeed(frame),
 *       recordOppositionCandidate: (candidate) => Effect.succeed(candidate),
 *       recordRelator: (relator) => Effect.succeed(relator),
 *     })
 *   )
 * )
 *
 * Effect.runPromise(program).then((relators) => console.log(relators))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class LegalPositionRecordRepository extends Context.Service<
  LegalPositionRecordRepository,
  LegalPositionRecordRepositoryShape
>()($I`LegalPositionRecordRepository`) {}
