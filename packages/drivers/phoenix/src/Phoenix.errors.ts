/**
 * Typed technical errors for the Phoenix driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PhoenixId } from "@beep/identity";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { thunkUndefined } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $PhoenixId.create("Phoenix.errors");

/**
 * Driver operation names surfaced in {@link PhoenixError} diagnostics.
 *
 * @example
 * ```ts
 * import { PhoenixOperation } from "@beep/phoenix"
 *
 * console.log(PhoenixOperation.Enum.createDataset)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PhoenixOperation = LiteralKit([
  "addAnnotation",
  "appendDatasetExamples",
  "createDataset",
  "createExperiment",
  "createPrompt",
  "doctor",
  "getDatasetExamples",
  "getDatasetInfo",
  "getExperimentInfo",
  "getPrompt",
  "init",
]).pipe(
  $I.annoteSchema("PhoenixOperation", {
    description: "Phoenix driver operation names used in technical error diagnostics.",
  })
);

/**
 * Type for {@link PhoenixOperation}.
 *
 * @example
 * ```ts
 * import { PhoenixOperation } from "@beep/phoenix"
 *
 * const operation: PhoenixOperation = "createDataset"
 * console.log(PhoenixOperation.is.createDataset(operation))
 * // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type PhoenixOperation = typeof PhoenixOperation.Type;

/**
 * Technical error reasons emitted by the Phoenix driver.
 *
 * @example
 * ```ts
 * import { PhoenixErrorReason } from "@beep/phoenix"
 *
 * console.log(PhoenixErrorReason.Enum.transport)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PhoenixErrorReason = LiteralKit(["config", "response decoding", "transport"]).pipe(
  $I.annoteSchema("PhoenixErrorReason", {
    description: "Redacted technical error reasons emitted by the Phoenix driver.",
  })
);

/**
 * Type for {@link PhoenixErrorReason}.
 *
 * @example
 * ```ts
 * import { PhoenixErrorReason } from "@beep/phoenix"
 *
 * const reason: PhoenixErrorReason = "transport"
 * console.log(PhoenixErrorReason.is.transport(reason))
 * // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type PhoenixErrorReason = typeof PhoenixErrorReason.Type;

/**
 * Options used when constructing Phoenix driver errors.
 *
 * @example
 * ```ts
 * import { PhoenixErrorOptions } from "@beep/phoenix"
 *
 * const options = PhoenixErrorOptions.make({ cause: "network" })
 * console.log(options)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PhoenixErrorOptions extends S.Class<PhoenixErrorOptions>($I`PhoenixErrorOptions`)(
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })).annotateKey({
      description: "Optional failure cause converted to a redacted diagnostic label.",
    }),
  },
  $I.annote("PhoenixErrorOptions", {
    description: "Options for configuring PhoenixError instances, including optional redacted cause data.",
  })
) {}

class PhoenixErrorOperationOptionsInput extends S.Class<PhoenixErrorOperationOptionsInput>(
  $I`PhoenixErrorOperationOptionsInput`
)(
  {
    cause: S.optionalKey(S.Unknown).annotateKey({
      description: "Unknown operation failure cause accepted by PhoenixError.operation.",
    }),
  },
  $I.annote("PhoenixErrorOperationOptionsInput", {
    description: "Operation error constructor input before redacted cause-label extraction.",
  })
) {}

/**
 * Technical failure raised by the Phoenix driver boundary.
 *
 * @example
 * ```ts
 * import { PhoenixError } from "@beep/phoenix"
 *
 * const error = PhoenixError.operation("doctor", "transport")
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PhoenixError extends TaggedErrorClass<PhoenixError>($I`PhoenixError`)(
  "PhoenixError",
  {
    cause: S.optionalKey(S.String).annotateKey({
      description: "Redacted diagnostic label derived from the original failure cause.",
    }),
    operation: PhoenixOperation.annotateKey({
      description: "Phoenix driver operation that failed.",
    }),
    reason: PhoenixErrorReason.annotateKey({
      description: "Technical failure reason for the Phoenix operation.",
    }),
  },
  $I.annote("PhoenixError", {
    description: "Redacted technical failure raised by the Phoenix driver boundary.",
  })
) {
  /**
   * Create a Phoenix driver error scoped to one operation.
   *
   * @example
   * ```ts
   * import { PhoenixError } from "@beep/phoenix"
   *
   * const error = PhoenixError.operation("createDataset", "transport", { cause: "offline" })
   * console.log(error.reason)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly operation: {
    (
      operation: PhoenixOperation,
      reason: PhoenixErrorReason,
      options?: PhoenixErrorOptions | { readonly cause?: unknown }
    ): PhoenixError;
    (
      reason: PhoenixErrorReason,
      options?: PhoenixErrorOptions | { readonly cause?: unknown }
    ): (operation: PhoenixOperation) => PhoenixError;
  } = dual(
    (args) => args.length >= 2 && S.is(PhoenixOperation)(args[0]),
    (
      operation: PhoenixOperation,
      reason: PhoenixErrorReason,
      options: PhoenixErrorOptions | { readonly cause?: unknown } = {}
    ): PhoenixError => {
      const operationOptions = PhoenixErrorOperationOptionsInput.make(options);
      return PhoenixError.make({
        operation,
        reason,
        ...O.getSomesStruct({
          cause: causeFromUnknown(operationOptions.cause),
        }),
      });
    }
  );
}

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication
const readProperty = (value: unknown, key: PropertyKey): O.Option<unknown> => {
  if (!P.isObject(value)) {
    return O.none();
  }

  return O.fromUndefinedOr(
    Result.getOrElse(
      Result.try(() => Reflect.get(value, key)),
      thunkUndefined
    )
  );
};

const readString = (value: unknown, key: PropertyKey): O.Option<string> =>
  O.filter(readProperty(value, key), P.isString);

const causeFromUnknown = (cause: unknown): O.Option<string> =>
  P.isUndefined(cause)
    ? O.none()
    : O.firstSomeOf([
        readString(cause, "_tag"),
        readString(cause, "message"),
        readString(cause, "name"),
        P.isString(cause) ? O.some("String") : O.none(),
      ]);
