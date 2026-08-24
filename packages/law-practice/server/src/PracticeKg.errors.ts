/**
 * Typed failures for practice knowledge-graph projection builds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("PracticeKg.errors");

const PracticeKgProjectionErrorFields = {
  message: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
const PracticeKgProjectionErrorEquivalenceFields = {
  message: PracticeKgProjectionErrorFields.message,
  // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
} satisfies S.Struct.Fields;
const samePracticeKgProjectionErrorFields = S.toEquivalence(
  S.TaggedStruct("PracticeKgProjectionError", PracticeKgProjectionErrorEquivalenceFields)
);
const samePracticeKgProjectionError = (self: PracticeKgProjectionError, that: PracticeKgProjectionError): boolean =>
  samePracticeKgProjectionErrorFields(self, that);

/**
 * Failure raised while projecting a practice knowledge-graph bundle.
 *
 * **Gotchas**
 *
 * This is the single failure type on the projection lane: filesystem, DuckDB,
 * PGlite, and schema-decoding failures are all mapped onto it through
 * {@link PracticeKgProjectionError.mapError}, with the original cause retained.
 * A partial bundle left on disk is not cleaned up when this is raised — rerun
 * with `overwrite` rather than trusting what is there.
 *
 * **Example** (Catch and recover message)
 *
 * ```ts
 * import { PracticeKgProjectionError } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 *
 * const failing = Effect.gen(function* () {
 *   return yield* PracticeKgProjectionError.make({
 *     message: "Graph bundle already exists; pass --overwrite to replace it."
 *   })
 * })
 *
 * const recovered = failing.pipe(
 *   Effect.catchTag("PracticeKgProjectionError", (error) => Effect.succeed(error.message))
 * )
 *
 * Effect.runPromise(recovered).then(console.log)
 * // "Graph bundle already exists; pass --overwrite to replace it."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PracticeKgProjectionError extends S.TaggedError<PracticeKgProjectionError>($I`PracticeKgProjectionError`)(
  "PracticeKgProjectionError",
  PracticeKgProjectionErrorFields,
  $I.annoteClass<
    S.declare<PracticeKgProjectionError>,
    readonly [S.TaggedStruct<"PracticeKgProjectionError", typeof PracticeKgProjectionErrorFields>]
  >("PracticeKgProjectionError", {
    description: "A failure raised while projecting a deterministic practice knowledge-graph bundle.",

    toEquivalence: () => samePracticeKgProjectionError,
  })
) {
  /**
   * Construct a projection error from an original cause and message.
   *
   * **Details**
   *
   * The data-last form takes the message first so it can be partially applied at
   * the call site that knows what was being attempted, and applied later to
   * whatever cause surfaces.
   *
   * **Example** (Direct and deferred construction)
   *
   * ```ts
   * import { PracticeKgProjectionError } from "@beep/law-practice-server"
   *
   * const direct = PracticeKgProjectionError.new(new Error("EACCES"), "Failed writing graph bundle manifest.")
   * const deferred = PracticeKgProjectionError.new("Failed writing graph bundle manifest.")
   *
   * console.log(direct.message) // "Failed writing graph bundle manifest."
   * console.log(deferred(new Error("EACCES")).message) // "Failed writing graph bundle manifest."
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly new: {
    (cause: unknown, message: string): PracticeKgProjectionError;
    (message: string): (cause: unknown) => PracticeKgProjectionError;
  } = dual(
    2,
    (cause: unknown, message: string): PracticeKgProjectionError => PracticeKgProjectionError.make({ cause, message })
  );

  /**
   * Map any failure on an effect onto a projection error carrying the given message.
   *
   * **Details**
   *
   * This is how every foreign failure — filesystem, DuckDB, PGlite, schema
   * decoding — enters the projection lane's single error type. The original
   * failure is preserved as the `cause`, so the message describes the step that
   * was attempted rather than replacing the underlying diagnostic.
   *
   * **Example** (Map foreign failure)
   *
   * ```ts
   * import { PracticeKgProjectionError } from "@beep/law-practice-server"
   * import { Effect } from "effect"
   *
   * const described = Effect.fail(new Error("ENOENT")).pipe(
   *   PracticeKgProjectionError.mapError("Failed reading extract children root."),
   *   Effect.catchTag("PracticeKgProjectionError", (error) => Effect.succeed(error.message))
   * )
   *
   * Effect.runPromise(described).then(console.log) // "Failed reading extract children root."
   * ```
   *
   * @category error-handling
   * @since 0.0.0
   */
  static readonly mapError = Err.mapToError(this.new);
}
