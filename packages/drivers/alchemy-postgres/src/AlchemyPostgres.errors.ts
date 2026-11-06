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
import { O } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $AlchemyPostgresId.create("AlchemyPostgres.errors");

const decodeMessageOption = S.decodeUnknownOption(S.NonEmptyString);
const getErrorMessage = (value: unknown): O.Option<string> =>
  value instanceof Error ? decodeMessageOption(value.message) : O.none();

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
    table: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Driver table the operation was working on, when known." })
    ),
    cause: S.OptionFromOptionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    ).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Original SQL or runtime defect when one was available." })
    ),
    message: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Non-empty message extracted from the originating failure." })
    ),
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
      message: getErrorMessage(cause),
    });
}
