/**
 * Diagnostics extracted from an unknown failure for errors that carry an
 * optional `cause` and an optional `message`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const decodeMessage = S.decodeUnknownOption(S.NonEmptyString);

const errorMessage: (cause: unknown) => O.Option<string> = flow(
  O.liftPredicate(P.isError),
  O.flatMap((error) => decodeMessage(error.message))
);

/**
 * Optional non-empty `message` field extracted from an originating failure.
 *
 * **Details**
 *
 * Pair it with `optionalDefect` for the `cause` field and fill both from
 * {@link defectDiagnostics}. A missing key decodes to `None`, and the
 * constructor defaults it to `None`.
 *
 * **Example** (Declare an optional message field)
 *
 * ```ts import.meta.vitest name="Default the message field to none"
 * import { optionalDefectMessage } from "@beep/schema/SchemaUtils/defectDiagnostics"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const Failure = S.Struct({ message: optionalDefectMessage("Message of the failure.") })
 * O.isNone(Failure.make({}).message) // => true
 * ```
 *
 * @param description - Field description attached to the property key.
 * @returns The optional message field schema.
 * @category utilities
 * @since 0.0.0
 */
export const optionalDefectMessage = (description: string) =>
  S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
    description,
  });

/**
 * Splits an unknown failure into the `cause` and `message` options an error
 * built from `optionalDefect` and {@link optionalDefectMessage} expects.
 *
 * **Details**
 *
 * `cause` is the failure itself when one was supplied. `message` is the
 * failure's message when it is an `Error` with a non-empty message.
 *
 * **Example** (Read the diagnostics of a thrown error)
 *
 * ```ts import.meta.vitest name="Extract the message of an Error"
 * import { defectDiagnostics } from "@beep/schema/SchemaUtils/defectDiagnostics"
 * import * as O from "effect/Option"
 *
 * O.getOrUndefined(defectDiagnostics(new Error("disk full")).message) // => "disk full"
 * O.isNone(defectDiagnostics(undefined).cause) // => true
 * ```
 *
 * @param cause - The failure to inspect, or `undefined` when there was none.
 * @returns The optional cause and message of the failure.
 * @category utilities
 * @since 0.0.0
 */
export const defectDiagnostics = (
  cause: unknown
): { readonly cause: O.Option<unknown>; readonly message: O.Option<string> } => ({
  cause: O.fromUndefinedOr(cause),
  message: errorMessage(cause),
});
