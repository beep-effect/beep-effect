/**
 * Shared error schemas for the effect-ontology experiment.
 *
 * **Details**
 *
 * * These schemas normalize recoverable error metadata before it reaches domain
 * logic. Error messages are non-empty, causes become `Option`, and operational
 * counts are finite non-negative integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { NonNegativeInt, SchemaUtils, URLStr } from "@beep/schema";
import { HttpStatusCode } from "@beep/schema/HttpStatus";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Base");

/**
 * Non-empty human-readable diagnostic carried by ontology errors.
 *
 * **Example** (Use ErrorMessage)
 * ```ts
 * import { ErrorMessage } from "@effect-ontology/Error/Base"
 *
 * const message = ErrorMessage.make("The ontology file could not be read.")
 * console.log(message)
 * ```
 *
 * @invariant The message contains at least one Unicode code point.
 * @category errors
 * @since 0.0.0
 */
export const ErrorMessage = S.NonEmptyString.pipe(
  $I.annoteSchema("ErrorMessage", {
    toArbitrary: () => (fc) => fc.string({ minLength: 1, maxLength: 1_024 }),
    description: "Non-empty human-readable diagnostic carried by an ontology domain error.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Runtime text accepted by {@link ErrorMessage}.
 *
 * **Example** (Use ErrorMessage)
 * ```ts
 * import { ErrorMessage, type ErrorMessage as ErrorMessageValue } from "@effect-ontology/Error/Base"
 *
 * const message: ErrorMessageValue = ErrorMessage.make("Validation failed.")
 * console.log(message.length > 0) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ErrorMessage = typeof ErrorMessage.Type;

/**
 * Optional canonical URL normalized from an absent object key.
 *
 * **Example** (Use OptionalErrorUrl)
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalErrorUrl } from "@effect-ontology/Error/Base"
 *
 * const url = OptionalErrorUrl.make(O.none())
 * console.log(O.isNone(url)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalErrorUrl = S.OptionFromNullishOr(URLStr).pipe(
  SchemaUtils.withNoneDefault,
  $I.annoteSchema("OptionalErrorUrl", {
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(URLStr)(fc).map(O.some)),
        terminal: none,
      };
    },
    description: "Optional canonical URL normalized to an Effect Option.",
  })
);

/**
 * Runtime option decoded by {@link OptionalErrorUrl}.
 *
 * **Example** (Use OptionalErrorUrl)
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalErrorUrl } from "@effect-ontology/Error/Base"
 *
 * const url: OptionalErrorUrl = O.none()
 * console.log(O.isNone(url)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OptionalErrorUrl = typeof OptionalErrorUrl.Type;

/**
 * Optional canonical RDF IRI normalized from an absent object key.
 *
 * **Example** (Use OptionalErrorIri)
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalErrorIri } from "@effect-ontology/Error/Base"
 *
 * const iri = OptionalErrorIri.make(O.none())
 * console.log(O.isNone(iri)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalErrorIri = S.OptionFromNullishOr(IRI).pipe(
  SchemaUtils.withNoneDefault,
  $I.annoteSchema("OptionalErrorIri", {
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(IRI)(fc).map(O.some)),
        terminal: none,
      };
    },
    description: "Optional canonical RDF IRI normalized to an Effect Option.",
  })
);

/**
 * Runtime option decoded by {@link OptionalErrorIri}.
 *
 * **Example** (Use OptionalErrorIri)
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalErrorIri } from "@effect-ontology/Error/Base"
 *
 * const iri: OptionalErrorIri = O.none()
 * console.log(O.isNone(iri)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OptionalErrorIri = typeof OptionalErrorIri.Type;

const ErrorDefect = S.Defect({ includeStack: true });

/**
 * Optional underlying defect normalized from an absent object key.
 *
 * **Details**
 *
 * * The encoded form may omit `cause`; the decoded form always contains an
 * `Option`, preventing `undefined` checks from leaking into error handlers.
 *
 * **Example** (Use OptionalErrorCause)
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalErrorCause } from "@effect-ontology/Error/Base"
 *
 * const cause = OptionalErrorCause.make(O.none())
 * console.log(O.isNone(cause)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalErrorCause = S.OptionFromNullishOr(ErrorDefect).pipe(
  SchemaUtils.withNoneDefault,
  $I.annoteSchema("OptionalErrorCause", {
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(ErrorDefect)(fc).map(O.some)),
        terminal: none,
      };
    },
    description: "Optional underlying defect normalized to an Effect Option.",
  })
);

/**
 * Runtime option decoded by {@link OptionalErrorCause}.
 *
 * **Example** (Use OptionalErrorCause)
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalErrorCause } from "@effect-ontology/Error/Base"
 *
 * const cause: OptionalErrorCause = O.none()
 * console.log(O.isNone(cause)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OptionalErrorCause = typeof OptionalErrorCause.Type;

/**
 * Optional non-empty diagnostic text normalized from an absent object key.
 *
 * **Example** (Use OptionalErrorMessage)
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalErrorMessage } from "@effect-ontology/Error/Base"
 *
 * const text = OptionalErrorMessage.make(O.some("partial response"))
 * console.log(O.isSome(text)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalErrorMessage = S.OptionFromNullishOr(ErrorMessage).pipe(
  SchemaUtils.withNoneDefault,
  $I.annoteSchema("OptionalErrorMessage", {
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(ErrorMessage)(fc).map(O.some)),
        terminal: none,
      };
    },
    description: "Optional non-empty diagnostic text normalized to an Effect Option.",
  })
);

/**
 * Runtime option decoded by {@link OptionalErrorMessage}.
 *
 * **Example** (Use OptionalErrorMessage)
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalErrorMessage } from "@effect-ontology/Error/Base"
 *
 * const text: OptionalErrorMessage = O.none()
 * console.log(O.isNone(text)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OptionalErrorMessage = typeof OptionalErrorMessage.Type;

/**
 * Optional finite non-negative integer normalized from an absent object key.
 *
 * **Example** (Use OptionalNonNegativeInt)
 * ```ts
 * import * as O from "effect/Option"
 * import { NonNegativeInt } from "@beep/schema"
 * import { OptionalNonNegativeInt } from "@effect-ontology/Error/Base"
 *
 * const count = OptionalNonNegativeInt.make(O.some(NonNegativeInt.make(3)))
 * console.log(O.isSome(count)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalNonNegativeInt = S.OptionFromNullishOr(NonNegativeInt).pipe(
  SchemaUtils.withNoneDefault,
  $I.annoteSchema("OptionalNonNegativeInt", {
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(NonNegativeInt)(fc).map(O.some)),
        terminal: none,
      };
    },
    description: "Optional finite non-negative integer normalized to an Effect Option.",
  })
);

/**
 * Runtime option decoded by {@link OptionalNonNegativeInt}.
 *
 * **Example** (Use OptionalNonNegativeInt)
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalNonNegativeInt } from "@effect-ontology/Error/Base"
 *
 * const count: OptionalNonNegativeInt = O.none()
 * console.log(O.isNone(count)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OptionalNonNegativeInt = typeof OptionalNonNegativeInt.Type;

/**
 * Optional HTTP response status normalized from an absent object key.
 *
 * **Example** (Use OptionalHttpStatusCode)
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalHttpStatusCode } from "@effect-ontology/Error/Base"
 *
 * const status = OptionalHttpStatusCode.make(O.none())
 * console.log(O.isNone(status)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalHttpStatusCode = S.OptionFromNullishOr(HttpStatusCode).pipe(
  SchemaUtils.withNoneDefault,

  $I.annoteSchema("OptionalHttpStatusCode", {
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(HttpStatusCode)(fc).map(O.some)),
        terminal: none,
      };
    },
    description: "Optional valid HTTP response status normalized to an Effect Option.",
  })
);

/**
 * Runtime option decoded by {@link OptionalHttpStatusCode}.
 *
 * **Example** (Use OptionalHttpStatusCode)
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalHttpStatusCode } from "@effect-ontology/Error/Base"
 *
 * const status: OptionalHttpStatusCode = O.none()
 * console.log(O.isNone(status)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OptionalHttpStatusCode = typeof OptionalHttpStatusCode.Type;

/**
 * Finite non-negative millisecond count used by timeout and retry errors.
 *
 * **Example** (Use Milliseconds)
 * ```ts
 * import { Milliseconds } from "@effect-ontology/Error/Base"
 *
 * const timeout = Milliseconds.make(1_500)
 * console.log(timeout) // 1500
 * ```
 *
 * @invariant The value is a finite integer greater than or equal to zero.
 * @category errors
 * @since 0.0.0
 */
export const Milliseconds = NonNegativeInt.annotate({
  toArbitrary: () => (fc) =>
    fc
      .integer({
        min: 0,
        max: 86_400_000,
      })
      .map(NonNegativeInt.make),
}).pipe(
  S.brand("Milliseconds"),
  $I.annoteSchema("Milliseconds", {
    description: "Finite non-negative integer duration measured in milliseconds.",
  })
);

/**
 * Runtime millisecond count accepted by {@link Milliseconds}.
 *
 * **Example** (Use Milliseconds)
 * ```ts
 * import { Milliseconds, type Milliseconds as MillisecondValue } from "@effect-ontology/Error/Base"
 *
 * const timeout: MillisecondValue = Milliseconds.make(500)
 * console.log(timeout) // 500
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Milliseconds = typeof Milliseconds.Type;

/**
 * Optional millisecond count normalized from an absent object key.
 *
 * **Example** (Use OptionalMilliseconds)
 * ```ts
 * import * as O from "effect/Option"
 * import { Milliseconds, OptionalMilliseconds } from "@effect-ontology/Error/Base"
 *
 * const retryAfter = OptionalMilliseconds.make(O.some(Milliseconds.make(250)))
 * console.log(O.isSome(retryAfter)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalMilliseconds = S.OptionFromNullishOr(Milliseconds).pipe(
  SchemaUtils.withNoneDefault,
  $I.annoteSchema("OptionalMilliseconds", {
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(Milliseconds)(fc).map(O.some)),
        terminal: none,
      };
    },
    description: "Optional finite non-negative millisecond count normalized to an Effect Option.",
  })
);

/**
 * Runtime option decoded by {@link OptionalMilliseconds}.
 *
 * **Example** (Use OptionalMilliseconds)
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalMilliseconds } from "@effect-ontology/Error/Base"
 *
 * const retryAfter: OptionalMilliseconds = O.none()
 * console.log(O.isNone(retryAfter)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OptionalMilliseconds = typeof OptionalMilliseconds.Type;

/**
 * Root fallback error for failures without a more specific ontology tag.
 *
 * **Details**
 *
 * * Prefer a specific family error whenever the failed operation is known.
 * `BaseError` exists for compatibility with upstream fallback paths, not as a
 * nominal superclass for every domain error.
 *
 * **Example** (Use BaseError)
 * ```ts
 * import { BaseError } from "@effect-ontology/Error/Base"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(BaseError)({
 *   _tag: "BaseError",
 *   message: "Unexpected ontology failure.",
 *   cause: O.none()
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BaseError extends S.TaggedError<BaseError>($I`BaseError`)(
  "BaseError",
  {
    message: ErrorMessage.annotateKey({
      description: "Stable human-readable description of the fallback failure.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional defect that triggered the fallback failure.",
    }),
  },
  $I.annote("BaseError", {
    description: "Fallback ontology-domain failure used when no more precise error tag applies.",
  })
) {}

/**
 * Typed marker for a deliberately unfinished service method.
 *
 * **Details**
 *
 * * This error keeps incomplete experimental paths in the typed error channel.
 * It should disappear when the named method is implemented.
 *
 * **Example** (Use NotImplemented)
 * ```ts
 * import { NotImplemented } from "@effect-ontology/Error/Base"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(NotImplemented)({
 *   _tag: "NotImplemented",
 *   message: "RDF-star export is not implemented.",
 *   service: "RdfWriter",
 *   method: "writeQuotedTriple"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @invariant `service`, `method`, and `message` are non-empty.
 * @category errors
 * @since 0.0.0
 */
export class NotImplemented extends S.TaggedError<NotImplemented>($I`NotImplemented`)(
  "NotImplemented",
  {
    message: ErrorMessage.annotateKey({
      description: "Explanation of the missing capability.",
    }),
    service: S.NonEmptyString.annotateKey({
      description: "Service that owns the unfinished method.",
    }),
    method: S.NonEmptyString.annotateKey({
      description: "Unfinished service method.",
    }),
  },
  $I.annote("NotImplemented", {
    description: "Typed marker for an intentionally unfinished service method.",
  })
) {}

const BaseErrorDefinition = S.Union([BaseError, NotImplemented]).pipe(S.toTaggedUnion("_tag"));

/**
 * Tagged union of shared fallback and implementation-status errors.
 *
 * **Example** (Use BaseDomainError)
 * ```ts
 * import { BaseDomainError } from "@effect-ontology/Error/Base"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(BaseDomainError)({
 *   _tag: "BaseError", message: "Unknown failure." })
 * const tag = O.map(error, (value) => BaseDomainError.match(value, {
 *   BaseError: () => "fallback",
 *   NotImplemented: () => "unfinished"
 * }))
 * console.log(O.getOrElse(tag, () => "invalid")) // "fallback"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const BaseDomainError = BaseErrorDefinition.pipe(
  $I.annoteSchema("BaseDomainError", {
    description: "Tagged union of shared fallback and implementation-status errors.",
    toArbitrary: () => S.toArbitrary(BaseErrorDefinition),
  })
);

/**
 * Runtime value decoded by {@link BaseDomainError}.
 *
 * **Example** (Use BaseDomainError)
 * ```ts
 * import { BaseError, type BaseDomainError } from "@effect-ontology/Error/Base"
 *
 * const error: BaseDomainError = BaseError.make({ message: "Unknown failure." })
 * console.log(error._tag) // "BaseError"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BaseDomainError = typeof BaseDomainError.Type;
