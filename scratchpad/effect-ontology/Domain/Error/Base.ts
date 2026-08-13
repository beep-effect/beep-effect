/**
 * Shared error schemas for the effect-ontology experiment.
 *
 * @remarks
 * These schemas normalize recoverable error metadata before it reaches domain
 * logic. Error messages are non-empty, causes become `Option`, and operational
 * counts are finite non-negative integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { IRI, URI } from "@beep/rdf";
import type { TaggedErrorClassFromFields } from "@beep/schema";
import { FilePath, NonNegativeInt, SchemaUtils, TaggedErrorClass, URLStr } from "@beep/schema";
import type { Cause } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Base");

/**
 * Non-empty human-readable diagnostic carried by ontology errors.
 *
 * @example
 * ```ts
 * import { ErrorMessage } from "@effect-ontology/Error/Base.ts"
 *
 * const message = ErrorMessage.make("The ontology file could not be read.")
 * console.log(message)
 * ```
 *
 * @invariant The message contains at least one Unicode code point.
 * @category errors
 * @since 0.0.0
 */
export const ErrorMessage = S.NonEmptyString.annotate({
  toArbitrary: () => (fc) => fc.string({ minLength: 1, maxLength: 1_024 }),
}).pipe(
  $I.annoteSchema("ErrorMessage", {
    description: "Non-empty human-readable diagnostic carried by an ontology domain error.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime text accepted by {@link ErrorMessage}.
 *
 * @example
 * ```ts
 * import { ErrorMessage, type ErrorMessage as ErrorMessageValue } from "@effect-ontology/Error/Base.ts"
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
 * Canonical URL string with an explicit arbitrary for error metadata.
 *
 * @remarks
 * This preserves the repository's `URLStr` validation and supplies the
 * generator annotation needed by error-family property tests.
 *
 * @example
 * ```ts
 * import { ErrorUrl } from "@effect-ontology/Error/Base.ts"
 *
 * console.log(ErrorUrl.fromUnknown("https://example.com/image.png"))
 * ```
 *
 * @invariant The value is a non-empty string accepted by the platform URL parser.
 * @category errors
 * @since 0.0.0
 */
export const ErrorUrl = S.declare(URLStr.is).pipe(
  $I.annoteSchema("ErrorUrl", {
    description: "Canonical URL string used as ontology-error context.",
    toArbitrary: () => (fc) => fc.webUrl().map(URLStr.make),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime URL accepted by {@link ErrorUrl}.
 *
 * @example
 * ```ts
 * import { ErrorUrl, type ErrorUrl as ErrorUrlValue } from "@effect-ontology/Error/Base.ts"
 *
 * const url: ErrorUrlValue = ErrorUrl.fromUnknown("https://example.com")
 * console.log(url)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ErrorUrl = typeof ErrorUrl.Type;

/**
 * Optional canonical URL normalized from an absent object key.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalErrorUrl } from "@effect-ontology/Error/Base.ts"
 *
 * const url = OptionalErrorUrl.make(O.none())
 * console.log(O.isNone(url)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalErrorUrl = S.OptionFromNullishOr(ErrorUrl)
  .pipe(SchemaUtils.withNoneDefault)
  .annotate({
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(ErrorUrl)(fc).map(O.some)),
        terminal: none,
      };
    },
  })
  .pipe(
    $I.annoteSchema("OptionalErrorUrl", {
      description: "Optional canonical URL normalized to an Effect Option.",
    })
  );

/**
 * Runtime option decoded by {@link OptionalErrorUrl}.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalErrorUrl } from "@effect-ontology/Error/Base.ts"
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
 * Canonical RDF IRI with an explicit arbitrary for error metadata.
 *
 * @example
 * ```ts
 * import { ErrorIri } from "@effect-ontology/Error/Base.ts"
 *
 * console.log(ErrorIri.fromUnknown("https://example.com/ontology#Person"))
 * ```
 *
 * @invariant The value satisfies the repository's RFC 3987 IRI schema.
 * @category errors
 * @since 0.0.0
 */
export const ErrorIri = S.declare(IRI.is).pipe(
  $I.annoteSchema("ErrorIri", {
    description: "Canonical RFC 3987 IRI used as ontology-error context.",
    toArbitrary: () => (fc) => fc.webUrl().map(IRI.make),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime IRI accepted by {@link ErrorIri}.
 *
 * @example
 * ```ts
 * import { ErrorIri, type ErrorIri as ErrorIriValue } from "@effect-ontology/Error/Base.ts"
 *
 * const iri: ErrorIriValue = ErrorIri.fromUnknown("https://example.com/id")
 * console.log(iri)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ErrorIri = typeof ErrorIri.Type;

/**
 * Optional canonical RDF IRI normalized from an absent object key.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalErrorIri } from "@effect-ontology/Error/Base.ts"
 *
 * const iri = OptionalErrorIri.make(O.none())
 * console.log(O.isNone(iri)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalErrorIri = S.OptionFromNullishOr(ErrorIri)
  .pipe(SchemaUtils.withNoneDefault)
  .annotate({
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(ErrorIri)(fc).map(O.some)),
        terminal: none,
      };
    },
  })
  .pipe(
    $I.annoteSchema("OptionalErrorIri", {
      description: "Optional canonical RDF IRI normalized to an Effect Option.",
    })
  );

/**
 * Runtime option decoded by {@link OptionalErrorIri}.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalErrorIri } from "@effect-ontology/Error/Base.ts"
 *
 * const iri: OptionalErrorIri = O.none()
 * console.log(O.isNone(iri)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OptionalErrorIri = typeof OptionalErrorIri.Type;

/**
 * Canonical RFC 3986 URI with an explicit arbitrary for error metadata.
 *
 * @example
 * ```ts
 * import { ErrorUri } from "@effect-ontology/Error/Base.ts"
 *
 * console.log(ErrorUri.fromUnknown("https://example.com/ontology"))
 * ```
 *
 * @invariant The value satisfies the repository's RFC 3986 URI schema.
 * @category errors
 * @since 0.0.0
 */
export const ErrorUri = S.declare(URI.is).pipe(
  $I.annoteSchema("ErrorUri", {
    description: "Canonical RFC 3986 URI used as ontology-error context.",
    toArbitrary: () => (fc) => fc.webUrl().map(URI.make),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime URI accepted by {@link ErrorUri}.
 *
 * @example
 * ```ts
 * import { ErrorUri, type ErrorUri as ErrorUriValue } from "@effect-ontology/Error/Base.ts"
 *
 * const uri: ErrorUriValue = ErrorUri.fromUnknown("https://example.com/ontology")
 * console.log(uri)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ErrorUri = typeof ErrorUri.Type;

const decodeFilePath = S.decodeUnknownSync(FilePath);
const isFilePath = FilePath.pipe(S.is);

/**
 * Canonical file path with an explicit arbitrary for error metadata.
 *
 * @example
 * ```ts
 * import { ErrorFilePath } from "@effect-ontology/Error/Base.ts"
 *
 * console.log(ErrorFilePath.fromUnknown("data/ontology.ttl"))
 * ```
 *
 * @invariant The value is accepted by at least one supported path family and
 * contains a leaf segment.
 * @category errors
 * @since 0.0.0
 */
export const ErrorFilePath = S.declare(isFilePath).pipe(
  $I.annoteSchema("ErrorFilePath", {
    description: "Canonical filesystem path used as ontology-error context.",
    toArbitrary: () => (fc) =>
      fc.constantFrom("data/ontology.ttl", "/tmp/ontology.ttl", "fixtures/embeddings.bin").map(decodeFilePath),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime path accepted by {@link ErrorFilePath}.
 *
 * @example
 * ```ts
 * import { ErrorFilePath, type ErrorFilePath as ErrorPath } from "@effect-ontology/Error/Base.ts"
 *
 * const path: ErrorPath = ErrorFilePath.fromUnknown("data/ontology.ttl")
 * console.log(path)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ErrorFilePath = typeof ErrorFilePath.Type;

const ErrorDefect = S.Defect({ includeStack: true });

/**
 * Optional underlying defect normalized from an absent object key.
 *
 * @remarks
 * The encoded form may omit `cause`; the decoded form always contains an
 * `Option`, preventing `undefined` checks from leaking into error handlers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalErrorCause } from "@effect-ontology/Error/Base.ts"
 *
 * const cause = OptionalErrorCause.make(O.none())
 * console.log(O.isNone(cause)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalErrorCause = S.OptionFromNullishOr(ErrorDefect)
  .pipe(SchemaUtils.withNoneDefault)
  .annotate({
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(ErrorDefect)(fc).map(O.some)),
        terminal: none,
      };
    },
  })
  .pipe(
    $I.annoteSchema("OptionalErrorCause", {
      description: "Optional underlying defect normalized to an Effect Option.",
    })
  );

/**
 * Runtime option decoded by {@link OptionalErrorCause}.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalErrorCause } from "@effect-ontology/Error/Base.ts"
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
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalErrorMessage } from "@effect-ontology/Error/Base.ts"
 *
 * const text = OptionalErrorMessage.make(O.some("partial response"))
 * console.log(O.isSome(text)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalErrorMessage = S.OptionFromNullishOr(ErrorMessage)
  .pipe(SchemaUtils.withNoneDefault)
  .annotate({
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(ErrorMessage)(fc).map(O.some)),
        terminal: none,
      };
    },
  })
  .pipe(
    $I.annoteSchema("OptionalErrorMessage", {
      description: "Optional non-empty diagnostic text normalized to an Effect Option.",
    })
  );

/**
 * Runtime option decoded by {@link OptionalErrorMessage}.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalErrorMessage } from "@effect-ontology/Error/Base.ts"
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
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OptionalNonNegativeInt } from "@effect-ontology/Error/Base.ts"
 *
 * const count = S.decodeUnknownSync(OptionalNonNegativeInt)(3)
 * console.log(O.isSome(count)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalNonNegativeInt = S.OptionFromNullishOr(NonNegativeInt)
  .pipe(SchemaUtils.withNoneDefault)
  .annotate({
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(NonNegativeInt)(fc).map(O.some)),
        terminal: none,
      };
    },
  })
  .pipe(
    $I.annoteSchema("OptionalNonNegativeInt", {
      description: "Optional finite non-negative integer normalized to an Effect Option.",
    })
  );

/**
 * Runtime option decoded by {@link OptionalNonNegativeInt}.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalNonNegativeInt } from "@effect-ontology/Error/Base.ts"
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
 * Valid three-digit HTTP response status.
 *
 * @example
 * ```ts
 * import { HttpStatusCode } from "@effect-ontology/Error/Base.ts"
 *
 * console.log(HttpStatusCode.make(404))
 * ```
 *
 * @invariant The value is an integer from 100 through 599.
 * @category errors
 * @since 0.0.0
 */
export const HttpStatusCode = S.Int.check(
  S.isBetween(
    { minimum: 100, maximum: 599 },
    {
      identifier: $I`HttpStatusCodeRangeCheck`,
      title: "HTTP Status Code Range",
      description: "A three-digit HTTP response status from 100 through 599.",
      message: "HTTP status code must be an integer between 100 and 599.",
    }
  )
)
  .annotate({
    toArbitrary: () => (fc) => fc.integer({ min: 100, max: 599 }),
  })
  .pipe(
    S.brand("HttpStatusCode"),
    $I.annoteSchema("HttpStatusCode", {
      description: "Valid three-digit HTTP response status.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime status accepted by {@link HttpStatusCode}.
 *
 * @example
 * ```ts
 * import { HttpStatusCode, type HttpStatusCode as Status } from "@effect-ontology/Error/Base.ts"
 *
 * const status: Status = HttpStatusCode.make(503)
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type HttpStatusCode = typeof HttpStatusCode.Type;

/**
 * Optional HTTP response status normalized from an absent object key.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { OptionalHttpStatusCode } from "@effect-ontology/Error/Base.ts"
 *
 * const status = OptionalHttpStatusCode.make(O.none())
 * console.log(O.isNone(status)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalHttpStatusCode = S.OptionFromNullishOr(HttpStatusCode)
  .pipe(SchemaUtils.withNoneDefault)
  .annotate({
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(HttpStatusCode)(fc).map(O.some)),
        terminal: none,
      };
    },
  })
  .pipe(
    $I.annoteSchema("OptionalHttpStatusCode", {
      description: "Optional valid HTTP response status normalized to an Effect Option.",
    })
  );

/**
 * Runtime option decoded by {@link OptionalHttpStatusCode}.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalHttpStatusCode } from "@effect-ontology/Error/Base.ts"
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
 * @example
 * ```ts
 * import { Milliseconds } from "@effect-ontology/Error/Base.ts"
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
  toArbitrary: () => (fc) => fc.integer({ min: 0, max: 86_400_000 }).map(NonNegativeInt.make),
}).pipe(
  S.brand("Milliseconds"),
  $I.annoteSchema("Milliseconds", {
    description: "Finite non-negative integer duration measured in milliseconds.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime millisecond count accepted by {@link Milliseconds}.
 *
 * @example
 * ```ts
 * import { Milliseconds, type Milliseconds as MillisecondValue } from "@effect-ontology/Error/Base.ts"
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
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OptionalMilliseconds } from "@effect-ontology/Error/Base.ts"
 *
 * const retryAfter = S.decodeUnknownSync(OptionalMilliseconds)(250)
 * console.log(O.isSome(retryAfter)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OptionalMilliseconds = S.OptionFromNullishOr(Milliseconds)
  .pipe(SchemaUtils.withNoneDefault)
  .annotate({
    toArbitrary: () => (fc) => {
      const none = fc.constant(O.none());
      return {
        arbitrary: fc.oneof(none, S.toArbitrary(Milliseconds)(fc).map(O.some)),
        terminal: none,
      };
    },
  })
  .pipe(
    $I.annoteSchema("OptionalMilliseconds", {
      description: "Optional finite non-negative millisecond count normalized to an Effect Option.",
    })
  );

/**
 * Runtime option decoded by {@link OptionalMilliseconds}.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import type { OptionalMilliseconds } from "@effect-ontology/Error/Base.ts"
 *
 * const retryAfter: OptionalMilliseconds = O.none()
 * console.log(O.isNone(retryAfter)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OptionalMilliseconds = typeof OptionalMilliseconds.Type;

type OntologyTaggedError<Tag extends string, Fields extends S.Struct.Fields> = Cause.YieldableError &
  S.Schema.Type<S.TaggedStruct<Tag, Fields>>;

type OntologyErrorCodecStatics<Self> = {
  readonly is: (input: unknown) => input is Self;
  readonly fromUnknown: (input: unknown) => Self;
  readonly decodeOption: (input: unknown) => O.Option<Self>;
};

/**
 * Builds a schema-backed ontology error class with schema-derived capabilities.
 *
 * @remarks
 * `TaggedErrorClass` supplies class-safe arbitrary and equivalence annotations;
 * this helper keeps identity scoping and the structural self type consistent
 * across the experimental error families.
 *
 * @example
 * ```ts
 * import { $ScratchpadId } from "@beep/identity"
 * import * as S from "effect/Schema"
 * import { makeOntologyErrorClass } from "@effect-ontology/Error/Base.ts"
 *
 * const $I = $ScratchpadId.create("effect-ontology/example")
 * const ExampleError = makeOntologyErrorClass.make(
 *   $I`ExampleError`,
 *   "ExampleError",
 *   { message: S.NonEmptyString },
 *   $I.annote("ExampleError", { description: "Example typed failure." })
 * )
 *
 * console.log(ExampleError.make({ message: "failed" })._tag)
 * ```
 *
 * @param identifier - Stable identity-composer identifier used by schema tooling.
 * @param tag - Unique `_tag` discriminator used by Effect error handling.
 * @param fields - Schema-owned payload fields, excluding the generated `_tag`.
 * @param annotations - Identity and documentation annotations for the error class.
 * @returns A yieldable tagged-error constructor with schema-derived codecs,
 * guards, equivalence, and arbitrary generation.
 * @category constructors
 * @since 0.0.0
 */
export const makeOntologyErrorClass = {
  make: <const Tag extends string, const Fields extends S.Struct.Fields>(
    identifier: string,
    tag: Tag,
    fields: Fields,
    annotations: S.Annotations.Declaration<OntologyTaggedError<Tag, Fields>, readonly [S.TaggedStruct<Tag, Fields>]>
  ): TaggedErrorClassFromFields<OntologyTaggedError<Tag, Fields>, Tag, Fields> &
    OntologyErrorCodecStatics<OntologyTaggedError<Tag, Fields>> => {
    type Self = OntologyTaggedError<Tag, Fields>;
    const makeInstance = (input: S.Schema.Type<S.TaggedStruct<Tag, Fields>>): Self => ErrorClass.make(input as never);
    const ErrorClass = TaggedErrorClass<Self>(identifier)<Tag, Fields>(tag, fields, {
      ...annotations,
      toArbitrary:
        ([from]) =>
        () => ({
          arbitrary: from.arbitrary.map(makeInstance),
          terminal: from.terminal?.map(makeInstance),
        }),
    });
    const ServiceFreeErrorClass = ErrorClass as typeof ErrorClass & S.ConstraintDecoder<Self>;
    return SchemaUtils.withStatics(ErrorClass, () => ({
      is: S.is(ErrorClass),
      fromUnknown: S.decodeUnknownSync(ServiceFreeErrorClass),
      decodeOption: S.decodeUnknownOption(ServiceFreeErrorClass),
    }));
  },
};

/**
 * Root fallback error for failures without a more specific ontology tag.
 *
 * @remarks
 * Prefer a specific family error whenever the failed operation is known.
 * `BaseError` exists for compatibility with upstream fallback paths, not as a
 * nominal superclass for every domain error.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { BaseError } from "@effect-ontology/Error/Base.ts"
 *
 * const error = BaseError.make({
 *   message: "Unexpected ontology failure.",
 *   cause: O.none()
 * })
 * console.log(error._tag) // "BaseError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const BaseError = makeOntologyErrorClass.make(
  $I`BaseError`,
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
);

/**
 * Runtime value decoded by {@link BaseError}.
 *
 * @example
 * ```ts
 * import { BaseError, type BaseError as BaseErrorValue } from "@effect-ontology/Error/Base.ts"
 *
 * const error: BaseErrorValue = BaseError.make({ message: "Unknown failure." })
 * console.log(error._tag) // "BaseError"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BaseError = typeof BaseError.Type;

/**
 * Typed marker for a deliberately unfinished service method.
 *
 * @remarks
 * This error keeps incomplete experimental paths in the typed error channel.
 * It should disappear when the named method is implemented.
 *
 * @example
 * ```ts
 * import { NotImplemented } from "@effect-ontology/Error/Base.ts"
 *
 * const error = NotImplemented.make({
 *   message: "RDF-star export is not implemented.",
 *   service: "RdfWriter",
 *   method: "writeQuotedTriple"
 * })
 * console.log(error.service) // "RdfWriter"
 * ```
 *
 * @invariant `service`, `method`, and `message` are non-empty.
 * @category errors
 * @since 0.0.0
 */
export const NotImplemented = makeOntologyErrorClass.make(
  $I`NotImplemented`,
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
);

/**
 * Runtime value decoded by {@link NotImplemented}.
 *
 * @example
 * ```ts
 * import { NotImplemented, type NotImplemented as MissingCapability } from "@effect-ontology/Error/Base.ts"
 *
 * const error: MissingCapability = NotImplemented.make({
 *   message: "Export is unavailable.",
 *   service: "RdfWriter",
 *   method: "export"
 * })
 * console.log(error.method) // "export"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type NotImplemented = typeof NotImplemented.Type;

const BaseErrorDefinition = S.Union([BaseError, NotImplemented]).pipe(S.toTaggedUnion("_tag"));

/**
 * Tagged union of shared fallback and implementation-status errors.
 *
 * @example
 * ```ts
 * import { BaseDomainError, BaseError } from "@effect-ontology/Error/Base.ts"
 *
 * const error = BaseError.make({ message: "Unknown failure." })
 * const tag = BaseDomainError.match(error, {
 *   BaseError: () => "fallback",
 *   NotImplemented: () => "unfinished"
 * })
 * console.log(tag) // "fallback"
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
 * @example
 * ```ts
 * import { BaseError, type BaseDomainError } from "@effect-ontology/Error/Base.ts"
 *
 * const error: BaseDomainError = BaseError.make({ message: "Unknown failure." })
 * console.log(error._tag) // "BaseError"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BaseDomainError = typeof BaseDomainError.Type;
