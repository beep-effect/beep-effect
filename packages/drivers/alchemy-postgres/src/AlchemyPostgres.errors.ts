/**
 * Typed failures of the Postgres `Platform` driver for `@alchemy.run/domain`.
 *
 * **Details**
 *
 * Every failure names the driver operation that failed and, when known, the
 * table it was working on. Native causes travel as defects so callers can log
 * them without matching on third-party shapes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyPostgresId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { O, P, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $AlchemyPostgresId.create("AlchemyPostgres.errors");

const nonEmptyMessage = O.liftPredicate(Str.isNonEmpty);
const messageOf = (cause: unknown): O.Option<string> =>
  O.fromNullishOr(cause).pipe(
    O.filter(P.isError),
    O.flatMap((error) => nonEmptyMessage(error.message))
  );

/** An optional diagnostic field: `Option` in the type, absent key when encoded, `None` by default. */
const optionalDiagnostic = <Schema extends S.Top>(schema: Schema, description: string) =>
  S.OptionFromOptionalKey(schema).pipe(S.withConstructorDefault(Effect.succeedNone), S.annotateKey({ description }));

/**
 * Driver operation a failure belongs to.
 *
 * **Example** (Guard an operation name)
 *
 * ```ts
 * import { AlchemyPostgresOperation } from "@beep/alchemy-postgres/AlchemyPostgres.errors"
 *
 * console.log(AlchemyPostgresOperation.is.commit("commit")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AlchemyPostgresOperation = LiteralKit([
  "migrate",
  "claim",
  "commit",
  "schedule",
  "unschedule",
  "read",
  "deliver",
  "receive",
  "append",
  "backfill",
  "listen",
]).pipe(
  $I.annoteSchema("AlchemyPostgresOperation", {
    description: "Driver operation of the Postgres alchemy Platform that a failure belongs to.",
  })
);

/**
 * Type-level member of {@link AlchemyPostgresOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type AlchemyPostgresOperation = typeof AlchemyPostgresOperation.Type;

/**
 * Technical failure of the Postgres alchemy Platform driver.
 *
 * **Example** (Wrap an unknown cause)
 *
 * ```ts
 * import { AlchemyPostgresError } from "@beep/alchemy-postgres/AlchemyPostgres.errors"
 *
 * const error = AlchemyPostgresError.fromUnknown("commit", new Error("deadlock detected"), "alchemy_aggregate_event")
 * console.log(error.operation) // "commit"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AlchemyPostgresError extends S.TaggedError<AlchemyPostgresError, { readonly brand: unique symbol }>(
  $I`AlchemyPostgresError`
)(
  "AlchemyPostgresError",
  {
    operation: AlchemyPostgresOperation.annotateKey({
      description: "Driver operation that failed.",
    }),
    table: optionalDiagnostic(S.NonEmptyString, "Driver table the operation was working on, when known."),
    cause: optionalDiagnostic(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent)),
      "Original SQL or runtime defect when one was available."
    ),
    message: optionalDiagnostic(S.NonEmptyString, "Non-empty message extracted from the originating failure."),
  },
  $I.annoteError<AlchemyPostgresError>("AlchemyPostgresError", {
    description: "Technical failure of the Postgres alchemy Platform driver, scoped to one operation.",
  })
) {
  /**
   * Builds an error from an unknown cause.
   *
   * @since 0.0.0
   */
  static readonly fromUnknown = (
    operation: AlchemyPostgresOperation,
    cause?: unknown,
    table?: string
  ): AlchemyPostgresError =>
    AlchemyPostgresError.make({
      operation,
      table: O.fromNullishOr(table),
      cause: O.fromNullishOr(cause),
      message: messageOf(cause),
    });
}
