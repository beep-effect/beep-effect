/**
 * Cause-backed tagged error class helpers for schema-derived domain failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { withStatics } from "../SchemaUtils/index.ts";
import { TaggedErrorClass } from "../TaggedErrorClass/index.ts";
import type { Struct } from "effect";
import type { TaggedErrorClassFromFields } from "../TaggedErrorClass/index.ts";

type CauseTaggedErrorFields = S.Struct.Fields;
type CauseTaggedErrorReservedField = "message" | "cause";
type CauseTaggedErrorRawExtend = (
  this: CauseTaggedErrorLike,
  identifier: string
) => (
  fields: CauseTaggedErrorFields,
  annotations?: S.Annotations.Declaration<unknown, readonly [S.Struct<CauseTaggedErrorFields>]>
) => CauseTaggedErrorLike;
type CauseTaggedErrorLike = (new (
  ...args: ReadonlyArray<never>
) => unknown) & {
  readonly Type: unknown;
  readonly fields: CauseTaggedErrorFields;
  readonly "~type.parameters": readonly [S.Struct<CauseTaggedErrorFields>];
  readonly extend: unknown;
};

type CauseTaggedErrorStandardFields = {
  readonly message: typeof S.String;
  readonly cause: S.Defect;
};

type CauseTaggedErrorCombinedFields<Fields extends CauseTaggedErrorFields> = Struct.Simplify<
  Struct.Assign<Fields, CauseTaggedErrorStandardFields>
>;

type CauseTaggedErrorNoReservedFields<Fields extends CauseTaggedErrorFields> =
  Extract<keyof Fields, CauseTaggedErrorReservedField> extends never ? Fields : never;

type CauseTaggedErrorAnnotation<Self, Schema extends S.Top> = S.Annotations.Declaration<Self, readonly [Schema]> & {
  readonly message?: never;
  readonly cause?: never;
};

type CauseTaggedErrorNewInput<Fields extends CauseTaggedErrorFields> = S.Schema.Type<
  S.Struct<CauseTaggedErrorCombinedFields<Fields>>
>;

type CauseTaggedErrorExtrasInput<Fields extends CauseTaggedErrorFields> = S.Schema.Type<S.Struct<Fields>>;

type CauseTaggedErrorCtor<Error, Fields extends CauseTaggedErrorFields> = new (
  input: CauseTaggedErrorNewInput<Fields>
) => Error;
type CauseTaggedErrorConstructorArgs<ErrorClass extends CauseTaggedErrorLike> = ErrorClass extends new (
  ...args: infer Args
) => unknown
  ? Args
  : never;
type CauseTaggedErrorInstance<ErrorClass extends CauseTaggedErrorLike> = ErrorClass extends new (
  ...args: ReadonlyArray<never>
) => infer Instance
  ? Instance
  : never;

type CauseTaggedErrorNew<Error, Fields extends CauseTaggedErrorFields> = [keyof Fields] extends [never]
  ? {
      (cause: unknown, message: string): Error;
      (message: string): (cause: unknown) => Error;
    }
  : {
      (cause: unknown, message: string, extras: CauseTaggedErrorExtrasInput<Fields>): Error;
      (message: string, extras: CauseTaggedErrorExtrasInput<Fields>): (cause: unknown) => Error;
    };

type CauseTaggedErrorMapError<Error, Fields extends CauseTaggedErrorFields> = [keyof Fields] extends [never]
  ? {
      <A, E, R>(self: Effect.Effect<A, E, R>, message: string): Effect.Effect<A, Error, R>;
      (message: string): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, Error, R>;
    }
  : {
      <A, E, R>(
        self: Effect.Effect<A, E, R>,
        message: string,
        extras: CauseTaggedErrorExtrasInput<Fields>
      ): Effect.Effect<A, Error, R>;
      (
        message: string,
        extras: CauseTaggedErrorExtrasInput<Fields>
      ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, Error, R>;
    };

type CauseTaggedErrorStatics<Error, Fields extends CauseTaggedErrorFields> = {
  readonly new: CauseTaggedErrorNew<Error, Fields>;
  readonly mapError: CauseTaggedErrorMapError<Error, Fields>;
};

type CauseTaggedErrorMissingSelfGeneric<Usage extends string> =
  `Missing \`Self\` generic - use \`class Self extends ${Usage}<Self>(...)\``;

type CauseTaggedErrorExtendMethod<
  Tag extends string,
  Fields extends CauseTaggedErrorFields,
  ErrorClass extends CauseTaggedErrorLike,
> = <Extended = never, Brand = {}>(
  identifier: string
) => <NewFields extends CauseTaggedErrorFields>(
  fields: CauseTaggedErrorNoReservedFields<NewFields>,
  annotations?: CauseTaggedErrorAnnotation<
    Extended,
    S.Struct<Struct.Simplify<Struct.Assign<ErrorClass["~type.parameters"][0]["fields"], NewFields>>>
  >
) => [Extended] extends [never]
  ? CauseTaggedErrorMissingSelfGeneric<"Base.extend">
  : CauseTaggedErrorWithStatics<
      Extended,
      Tag,
      Struct.Simplify<Struct.Assign<Fields, NewFields>>,
      Brand,
      TaggedErrorClassFromFields<
        Extended,
        Tag,
        Struct.Simplify<Struct.Assign<CauseTaggedErrorCombinedFields<Fields>, NewFields>>,
        Brand
      >
    >;

/**
 * Tagged error class returned by {@link CauseTaggedError}, including dual construction helpers.
 *
 * @example
 * ```ts
 * import { $SchemaId } from "@beep/identity/packages"
 * import { CauseTaggedError, type CauseTaggedErrorWithStatics } from "@beep/schema/CauseTaggedError"
 *
 * const $I = $SchemaId.create("CauseTaggedErrorWithStatics/example")
 *
 * class ExampleError extends CauseTaggedError<ExampleError>($I`ExampleError`)(
 *   "ExampleError",
 *   $I.annote("ExampleError", {
 *     description: "An example failure with a required cause."
 *   })
 * ) {}
 *
 * const fromClass = (
 *   errorClass: CauseTaggedErrorWithStatics<ExampleError, "ExampleError", {}, {}>
 * ) => errorClass.new("Example failed")(new Error("cause"))
 *
 * const error = fromClass(ExampleError)
 *
 * console.log(error)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CauseTaggedErrorWithStatics<
  Self,
  Tag extends string,
  Fields extends CauseTaggedErrorFields,
  Brand,
  ErrorClass extends CauseTaggedErrorLike = TaggedErrorClassFromFields<
    Self,
    Tag,
    CauseTaggedErrorCombinedFields<Fields>,
    Brand
  >,
> = (new (
  ...args: CauseTaggedErrorConstructorArgs<ErrorClass>
) => CauseTaggedErrorInstance<ErrorClass>) &
  Omit<ErrorClass, "extend"> &
  CauseTaggedErrorStatics<Self, Fields> & {
    readonly extend: CauseTaggedErrorExtendMethod<Tag, Fields, ErrorClass>;
  };

/**
 * Factory returned by {@link CauseTaggedError} after an identity namespace has been selected.
 *
 * @example
 * ```ts
 * import { $SchemaId } from "@beep/identity/packages"
 * import { CauseTaggedError, type CauseTaggedErrorFactory } from "@beep/schema/CauseTaggedError"
 *
 * const $I = $SchemaId.create("CauseTaggedErrorFactory/example")
 *
 * class ExampleError extends CauseTaggedError<ExampleError>($I`ExampleError`)(
 *   "ExampleError",
 *   $I.annote("ExampleError", {
 *     description: "An example failure built from a factory."
 *   })
 * ) {}
 *
 * const factory: CauseTaggedErrorFactory<ExampleError> = CauseTaggedError<ExampleError>($I`ExampleErrorFactory`)
 * const error = ExampleError.new("Example failed")(new Error("cause"))
 *
 * console.log(factory)
 * console.log(error)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface CauseTaggedErrorFactory<Self, Brand = {}> {
  <Tag extends string, const Fields extends CauseTaggedErrorFields>(
    tag: Tag,
    fields: CauseTaggedErrorNoReservedFields<Fields>,
    annotations?: CauseTaggedErrorAnnotation<Self, S.TaggedStruct<Tag, CauseTaggedErrorCombinedFields<Fields>>>
  ): CauseTaggedErrorWithStatics<Self, Tag, Fields, Brand>;

  <Tag extends string>(
    tag: Tag,
    annotations?: CauseTaggedErrorAnnotation<Self, S.TaggedStruct<Tag, CauseTaggedErrorStandardFields>>
  ): CauseTaggedErrorWithStatics<Self, Tag, {}, Brand>;
}

/**
 * Callable constructor for creating cause-tagged error class factories.
 *
 * @example
 * ```ts
 * import { $SchemaId } from "@beep/identity/packages"
 * import { CauseTaggedError, type CauseTaggedErrorConstructor } from "@beep/schema/CauseTaggedError"
 *
 * const $I = $SchemaId.create("CauseTaggedErrorConstructor/example")
 * const makeCauseTaggedError: CauseTaggedErrorConstructor = CauseTaggedError
 *
 * class ExampleError extends makeCauseTaggedError<ExampleError>($I`ExampleError`)(
 *   "ExampleError",
 *   $I.annote("ExampleError", {
 *     description: "An example failure built through the constructor type."
 *   })
 * ) {}
 *
 * const error = ExampleError.new("Example failed")(new Error("cause"))
 *
 * console.log(error)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export type CauseTaggedErrorConstructor = <Self, Brand = {}>(
  identifier?: undefined | string
) => CauseTaggedErrorFactory<Self, Brand>;

type UnsafeCauseTaggedErrorFactory = CauseTaggedErrorFactory<unknown, unknown>;
type UnsafeTaggedErrorFactory = (
  tag: string,
  fields: CauseTaggedErrorFields,
  annotations?: unknown
) => CauseTaggedErrorLike;

const CauseTaggedErrorStandardFields = {
  message: S.String,
  cause: S.Defect({ includeStack: true }),
} satisfies CauseTaggedErrorStandardFields;

const hasExtraFields = (fields: CauseTaggedErrorFields): boolean => !R.isEmptyReadonlyRecord(fields);

const isSchemaFields = (value: unknown): value is CauseTaggedErrorFields =>
  P.isObject(value) && R.every({ ...value }, S.isSchema);

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);
const decodeCauseTaggedErrorMessage = (input: unknown) =>
  Result.getOrThrowWith(S.decodeUnknownResult(S.String)(input), schemaIssueToError);

const makeCauseTaggedErrorExtrasDecoder = <Fields extends CauseTaggedErrorFields>(
  fields: Fields
): ((input: unknown) => CauseTaggedErrorExtrasInput<Fields>) => {
  class ExtrasShape extends S.Class<ExtrasShape>("CauseTaggedErrorExtras")(fields as S.Struct.Fields) {}
  const isExtras = S.is(ExtrasShape);

  return (input) => {
    if (isExtras(input)) {
      return input as CauseTaggedErrorExtrasInput<Fields>;
    }

    return input as CauseTaggedErrorExtrasInput<Fields>;
  };
};

const combineCauseTaggedErrorFields = <Fields extends CauseTaggedErrorFields>(
  fields: Fields
): CauseTaggedErrorCombinedFields<Fields> =>
  ({
    ...fields,
    ...CauseTaggedErrorStandardFields,
  }) as CauseTaggedErrorCombinedFields<Fields>;

const causeTaggedErrorInput = <Fields extends CauseTaggedErrorFields>(
  cause: unknown,
  message: string,
  extras?: CauseTaggedErrorExtrasInput<Fields>
): CauseTaggedErrorNewInput<Fields> =>
  ({
    ...extras,
    message,
    cause,
  }) as CauseTaggedErrorNewInput<Fields>;

const makeCauseTaggedErrorNew = <Error, Fields extends CauseTaggedErrorFields>(
  fields: Fields
): CauseTaggedErrorNew<Error, Fields> => {
  const hasExtras = hasExtraFields(fields);
  const decodeExtras = makeCauseTaggedErrorExtrasDecoder(fields);
  const build = dual<
    (
      cause: unknown,
      message: string,
      extras?: CauseTaggedErrorExtrasInput<Fields>
    ) => (ctor: CauseTaggedErrorCtor<Error, Fields>) => Error,
    (
      ctor: CauseTaggedErrorCtor<Error, Fields>,
      cause: unknown,
      message: string,
      extras?: CauseTaggedErrorExtrasInput<Fields>
    ) => Error
  >(
    hasExtras ? 4 : 3,
    (
      ctor: CauseTaggedErrorCtor<Error, Fields>,
      cause: unknown,
      message: string,
      extras?: CauseTaggedErrorExtrasInput<Fields>
    ) => new ctor(causeTaggedErrorInput<Fields>(cause, message, extras))
  );

  return function (
    this: CauseTaggedErrorCtor<Error, Fields>,
    causeOrMessage: unknown,
    messageOrExtras?: string | CauseTaggedErrorExtrasInput<Fields>,
    extras?: CauseTaggedErrorExtrasInput<Fields>
  ): Error | ((cause: unknown) => Error) {
    if (hasExtras) {
      return arguments.length >= 3
        ? build(this, causeOrMessage, decodeCauseTaggedErrorMessage(messageOrExtras), decodeExtras(extras))
        : (cause: unknown) =>
            build(this, cause, decodeCauseTaggedErrorMessage(causeOrMessage), decodeExtras(messageOrExtras));
    }

    return arguments.length >= 2
      ? build(this, causeOrMessage, decodeCauseTaggedErrorMessage(messageOrExtras))
      : (cause: unknown) => build(this, cause, decodeCauseTaggedErrorMessage(causeOrMessage));
  } as CauseTaggedErrorNew<Error, Fields>;
};

const makeCauseTaggedErrorMapError = <Error, Fields extends CauseTaggedErrorFields>(
  fields: Fields
): CauseTaggedErrorMapError<Error, Fields> => {
  const hasExtras = hasExtraFields(fields);
  const decodeExtras = makeCauseTaggedErrorExtrasDecoder(fields);
  const build = dual<
    <A, E, R>(
      self: Effect.Effect<A, E, R>,
      message: string,
      extras?: CauseTaggedErrorExtrasInput<Fields>
    ) => (ctor: CauseTaggedErrorCtor<Error, Fields>) => Effect.Effect<A, Error, R>,
    <A, E, R>(
      ctor: CauseTaggedErrorCtor<Error, Fields>,
      self: Effect.Effect<A, E, R>,
      message: string,
      extras?: CauseTaggedErrorExtrasInput<Fields>
    ) => Effect.Effect<A, Error, R>
  >(
    hasExtras ? 4 : 3,
    <A, E, R>(
      ctor: CauseTaggedErrorCtor<Error, Fields>,
      self: Effect.Effect<A, E, R>,
      message: string,
      extras?: CauseTaggedErrorExtrasInput<Fields>
    ): Effect.Effect<A, Error, R> =>
      Effect.mapError(self, (cause) => new ctor(causeTaggedErrorInput<Fields>(cause, message, extras)))
  );

  return function <A, E, R>(
    this: CauseTaggedErrorCtor<Error, Fields>,
    selfOrMessage: Effect.Effect<A, E, R> | string,
    messageOrExtras?: string | CauseTaggedErrorExtrasInput<Fields>,
    extras?: CauseTaggedErrorExtrasInput<Fields>
  ): Effect.Effect<A, Error, R> | ((self: Effect.Effect<A, E, R>) => Effect.Effect<A, Error, R>) {
    if (hasExtras) {
      return arguments.length >= 3 && !P.isString(selfOrMessage)
        ? build(this, selfOrMessage, decodeCauseTaggedErrorMessage(messageOrExtras), decodeExtras(extras))
        : (self: Effect.Effect<A, E, R>) =>
            build(this, self, decodeCauseTaggedErrorMessage(selfOrMessage), decodeExtras(messageOrExtras));
    }

    return arguments.length >= 2 && !P.isString(selfOrMessage)
      ? build(this, selfOrMessage, decodeCauseTaggedErrorMessage(messageOrExtras))
      : (self: Effect.Effect<A, E, R>) => build(this, self, decodeCauseTaggedErrorMessage(selfOrMessage));
  } as CauseTaggedErrorMapError<Error, Fields>;
};

const attachCauseTaggedErrorStatics = <
  Self,
  Tag extends string,
  Fields extends CauseTaggedErrorFields,
  Brand,
  ErrorClass extends CauseTaggedErrorLike,
>(
  errorClass: ErrorClass,
  fields: Fields
): CauseTaggedErrorWithStatics<Self, Tag, Fields, Brand, ErrorClass> => {
  const originalExtend = errorClass.extend as CauseTaggedErrorRawExtend;
  const makeNew = makeCauseTaggedErrorNew<Self, Fields>(fields);
  const mapError = makeCauseTaggedErrorMapError<Self, Fields>(fields);
  const staticTarget = (target: unknown): CauseTaggedErrorLike =>
    P.isFunction(target) ? (target as CauseTaggedErrorLike) : errorClass;
  const extendCauseTaggedError = function (this: CauseTaggedErrorLike | undefined, identifier: string) {
    const target = this ?? errorClass;
    const extend = originalExtend.call(target, identifier);

    return (
      newFields: CauseTaggedErrorFields,
      annotations?: S.Annotations.Declaration<unknown, readonly [S.Struct<CauseTaggedErrorFields>]>
    ) => {
      const extended = extend(newFields, annotations);

      return attachCauseTaggedErrorStatics(extended, {
        ...fields,
        ...newFields,
      });
    };
  };

  return withStatics(errorClass, () => ({
    get new(): CauseTaggedErrorNew<Self, Fields> {
      return makeNew.bind(staticTarget(this)) as unknown as CauseTaggedErrorNew<Self, Fields>;
    },
    get mapError(): CauseTaggedErrorMapError<Self, Fields> {
      return mapError.bind(staticTarget(this)) as unknown as CauseTaggedErrorMapError<Self, Fields>;
    },
    get extend(): CauseTaggedErrorExtendMethod<Tag, Fields, ErrorClass> {
      return extendCauseTaggedError.bind(staticTarget(this)) as unknown as CauseTaggedErrorExtendMethod<
        Tag,
        Fields,
        ErrorClass
      >;
    },
  })) as unknown as CauseTaggedErrorWithStatics<Self, Tag, Fields, Brand, ErrorClass>;
};

/**
 * Create a tagged error class that always carries a `message` and required defect `cause`.
 *
 * `CauseTaggedError` is a pipe-friendly offshoot of {@link TaggedErrorClass}.
 * It prepends `message: S.String` and `cause: S.Defect({ includeStack: true })` to every
 * generated class and attaches dual static `new` and `mapError` helpers.
 *
 * @example
 * ```ts
 * import { $SchemaId } from "@beep/identity/packages"
 * import { Effect, pipe } from "effect"
 * import { CauseTaggedError } from "@beep/schema/CauseTaggedError"
 *
 * const $I = $SchemaId.create("CauseTaggedError/basic")
 *
 * class DomainError extends CauseTaggedError<DomainError>($I`DomainError`)(
 *   "DomainError",
 *   $I.annote("DomainError", {
 *     description: "A domain failure with a message and defect cause."
 *   })
 * ) {}
 *
 * const program = pipe(
 *   Effect.fail("raw failure"),
 *   DomainError.mapError("Domain operation failed")
 * )
 *
 * const exit = Effect.runSyncExit(program)
 * console.log(exit._tag)
 * ```
 *
 * @example
 * ```ts
 * import { $SchemaId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 * import { CauseTaggedError } from "@beep/schema/CauseTaggedError"
 *
 * const $I = $SchemaId.create("CauseTaggedError/with-extra-fields")
 *
 * class OperationError extends CauseTaggedError<OperationError>($I`OperationError`)(
 *   "OperationError",
 *   {
 *     operation: S.String
 *   },
 *   $I.annote("OperationError", {
 *     description: "An operation failure with structured context."
 *   })
 * ) {}
 *
 * const error = OperationError.new("Operation failed", {
 *   operation: "load-profile"
 * })(new Error("database unavailable"))
 *
 * console.log(error)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const CauseTaggedError = ((identifier?: undefined | string) => {
  const taggedErrorFactory = TaggedErrorClass<unknown, unknown>(identifier) as unknown as UnsafeTaggedErrorFactory;

  return ((tag: string, fieldsOrAnnotations?: unknown, annotations?: unknown) => {
    if (isSchemaFields(fieldsOrAnnotations)) {
      const taggedError = taggedErrorFactory(tag, combineCauseTaggedErrorFields(fieldsOrAnnotations), annotations);

      return attachCauseTaggedErrorStatics(taggedError, fieldsOrAnnotations);
    }

    const fields = {};
    const taggedError = taggedErrorFactory(tag, combineCauseTaggedErrorFields(fields), fieldsOrAnnotations);

    return attachCauseTaggedErrorStatics(taggedError, fields);
  }) as unknown as UnsafeCauseTaggedErrorFactory;
}) as unknown as CauseTaggedErrorConstructor;
