/**
 * Wink runtime errors.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $WinkId } from "@beep/identity";
import { Defect, SchemaUtils } from "@beep/schema";
import { Inspectable } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $WinkId.create("Wink/WinkErrors");

const renderCause = (cause: unknown): string => Inspectable.toStringUnknown(cause);
const getTextOption = (options: { readonly text?: string | undefined } | string): O.Option<string> =>
  O.fromNullishOr(P.isString(options) ? options : options.text);
const getEntityNameOption = (options: { readonly entityName?: string | undefined } | string): O.Option<string> =>
  O.fromNullishOr(P.isString(options) ? options : options.entityName);

/**
 * Typed failure for initializing or reading from the wink runtime.
 *
 * **Example** (Create engine error from cause)
 *
 * ```ts
 * import { WinkEngineError } from "@beep/wink"
 *
 * const error = WinkEngineError.fromCause(new Error("missing model"), "initialize")
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WinkEngineError extends S.TaggedError<WinkEngineError>($I`WinkEngineError`)(
  "WinkEngineError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
    operation: S.String,
  },
  $I.annoteError<WinkEngineError>("WinkEngineError", {
    description: "Failure raised while creating or accessing the wink-nlp runtime.",
  })
) {
  /**
   * Create a runtime error from an unknown cause.
   *
   * @param cause - The underlying failure or defect.
   * @param operation - The wink runtime operation that failed.
   * @returns A typed wink runtime error value.
   */
  static readonly fromCause: {
    (cause: unknown, operation: string): WinkEngineError;
    (operation: string): (cause: unknown) => WinkEngineError;
  } = dual(
    2,
    (cause: unknown, operation: string): WinkEngineError =>
      WinkEngineError.make({
        cause,
        message: `Wink runtime ${operation} failed: ${renderCause(cause)}`,
        operation,
      })
  );
}

/**
 * Typed failure for wink document reads, token collection, and token counts.
 *
 * **Example** (Create tokenization error with text)
 *
 * ```ts
 * import { WinkTokenizationError } from "@beep/wink"
 *
 * const error = WinkTokenizationError.fromCause(new Error("bad input"), "tokens", {
 *   text: "raw text"
 * })
 *
 * console.log(error.text._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WinkTokenizationError extends S.TaggedError<WinkTokenizationError>($I`WinkTokenizationError`)(
  "WinkTokenizationError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
    operation: S.String,
    text: S.OptionFromOptionalKey(S.String),
  },
  $I.annoteError<WinkTokenizationError>("WinkTokenizationError", {
    description: "Failure raised while tokenizing text with wink-nlp.",
  })
) {
  /**
   * Create a tokenization error from an unknown cause.
   *
   * @param cause - The underlying failure or defect.
   * @param operation - The wink tokenization operation that failed.
   * @param options - Additional tokenization failure detail.
   * @returns A typed wink tokenization error value.
   */
  static readonly fromCause: {
    (cause: unknown, operation: string, options: { readonly text?: string | undefined }): WinkTokenizationError;
    (operation: string, options: { readonly text?: string | undefined }): (cause: unknown) => WinkTokenizationError;
    (cause: unknown, operation: string, text: string): WinkTokenizationError;
  } = dual(
    3,
    (cause: unknown, operation: string, options: { readonly text?: string | undefined }): WinkTokenizationError =>
      WinkTokenizationError.make({
        cause,
        message: `Wink tokenization ${operation} failed: ${renderCause(cause)}`,
        operation,
        text: getTextOption(options),
      })
  );
}

/**
 * Typed failure for learning or updating wink custom entity patterns.
 *
 * **Example** (Create entity error with name)
 *
 * ```ts
 * import { WinkEntityError } from "@beep/wink"
 *
 * const error = WinkEntityError.fromCause(new Error("invalid pattern"), "learnCustomEntities", {
 *   entityName: "ProductName"
 * })
 *
 * console.log(error.entityName._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WinkEntityError extends S.TaggedError<WinkEntityError>($I`WinkEntityError`)(
  "WinkEntityError",
  {
    cause: Defect({ includeStack: true }),
    entityName: S.OptionFromOptionalKey(S.String),
    message: S.String,
    operation: S.String,
  },
  $I.annoteError<WinkEntityError>("WinkEntityError", {
    description: "Failure raised while learning or managing wink custom entities.",
  })
) {
  /**
   * Create an entity-learning error from an unknown cause.
   *
   * @param cause - The underlying failure or defect.
   * @param operation - The wink entity operation that failed.
   * @param options - Additional entity failure detail.
   * @returns A typed wink entity error value.
   */
  static readonly fromCause: {
    (cause: unknown, operation: string, options: { readonly entityName?: string | undefined }): WinkEntityError;
    (operation: string, options: { readonly entityName?: string | undefined }): (cause: unknown) => WinkEntityError;
    (cause: unknown, operation: string, entityName: string): WinkEntityError;
  } = dual(
    3,
    (cause: unknown, operation: string, options: { readonly entityName?: string | undefined }): WinkEntityError =>
      WinkEntityError.make({
        cause,
        entityName: getEntityNameOption(options),
        message: `Wink entity ${operation} failed: ${renderCause(cause)}`,
        operation,
      })
  );
}

/**
 * Tagged schema union for all wink runtime failures exposed by this module.
 *
 * **Example** (Check error against WinkError union)
 *
 * ```ts
 * import { WinkEngineError, WinkError } from "@beep/wink"
 *
 * const error = WinkEngineError.fromCause(new Error("missing model"), "initialize")
 *
 * console.log(WinkError.is(error))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const WinkError = S.Union([WinkEngineError, WinkEntityError, WinkTokenizationError]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("WinkError", {
    description: "Union of wink runtime errors.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type-level companion for the {@link WinkError} schema union.
 *
 * **Example** (Assign WinkError schema type)
 *
 * ```ts
 * import { WinkError } from "@beep/wink"
 * import type { WinkError as WinkErrorSchema } from "@beep/wink"
 *
 * const schema: WinkErrorSchema = WinkError
 * console.log(typeof schema)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type WinkError = typeof WinkError;
