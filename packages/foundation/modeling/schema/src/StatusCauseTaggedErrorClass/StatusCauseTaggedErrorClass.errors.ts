/**
 * Status and optional-cause tagged error class helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { withStatics } from "../SchemaUtils/index.ts";
import { StatusCauseFields, statusCauseInput } from "../StatusCauseError.ts";
import { TaggedErrorClass } from "../TaggedErrorClass/index.ts";
import type { TUnsafe } from "@beep/types";
import type { Struct } from "effect";
import type { TaggedErrorClassFromFields } from "../TaggedErrorClass/index.ts";

type StatusCauseTaggedErrorFields = S.Struct.Fields;
type StatusCauseTaggedErrorReservedField = "message" | "status" | "cause";
type StatusCauseTaggedErrorClassLike = (new (
  ...args: ReadonlyArray<TUnsafe.Any>
) => TUnsafe.Any) & {
  readonly Type: TUnsafe.Any;
  readonly fields: StatusCauseTaggedErrorFields;
  readonly "~type.parameters": readonly [S.Struct<StatusCauseTaggedErrorFields>];
  readonly extend: TUnsafe.Any;
};

type StatusCauseTaggedErrorStandardFields = typeof StatusCauseFields;

type StatusCauseTaggedErrorCombinedFields<Fields extends StatusCauseTaggedErrorFields> = Struct.Simplify<
  Struct.Assign<Fields, StatusCauseTaggedErrorStandardFields>
>;

type StatusCauseTaggedErrorNoReservedFields<Fields extends StatusCauseTaggedErrorFields> =
  Extract<keyof Fields, StatusCauseTaggedErrorReservedField> extends never ? Fields : never;

type StatusCauseTaggedErrorAnnotation<Self, Schema extends S.Top> = S.Annotations.Declaration<
  Self,
  readonly [Schema]
> & {
  readonly message?: never;
  readonly status?: never;
  readonly cause?: never;
};

type StatusCauseTaggedErrorNewInput<Fields extends StatusCauseTaggedErrorFields> = S.Schema.Type<
  S.Struct<StatusCauseTaggedErrorCombinedFields<Fields>>
>;

type StatusCauseTaggedErrorExtrasInput<Fields extends StatusCauseTaggedErrorFields> = Omit<
  StatusCauseTaggedErrorNewInput<Fields>,
  "message" | "status" | "cause"
>;

type StatusCauseTaggedErrorCtor<Error, Fields extends StatusCauseTaggedErrorFields> = new (
  input: StatusCauseTaggedErrorNewInput<Fields>
) => Error;
type StatusCauseTaggedErrorConstructorArgs<ErrorClass extends StatusCauseTaggedErrorClassLike> =
  ErrorClass extends new (...args: infer Args) => TUnsafe.Any ? Args : never;
type StatusCauseTaggedErrorInstance<ErrorClass extends StatusCauseTaggedErrorClassLike> = ErrorClass extends new (
  ...args: ReadonlyArray<TUnsafe.Any>
) => infer Instance
  ? Instance
  : never;

type StatusCauseTaggedErrorNew<Error, Fields extends StatusCauseTaggedErrorFields> = [keyof Fields] extends [never]
  ? {
      (cause: unknown, message: string, status: number): Error;
      (message: string, status: number): (cause: unknown) => Error;
    }
  : {
      (cause: unknown, message: string, status: number, extras: StatusCauseTaggedErrorExtrasInput<Fields>): Error;
      (message: string, status: number, extras: StatusCauseTaggedErrorExtrasInput<Fields>): (cause: unknown) => Error;
    };

type StatusCauseTaggedErrorMapError<Error, Fields extends StatusCauseTaggedErrorFields> = [keyof Fields] extends [never]
  ? {
      <A, E, R>(self: Effect.Effect<A, E, R>, message: string, status: number): Effect.Effect<A, Error, R>;
      (message: string, status: number): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, Error, R>;
    }
  : {
      <A, E, R>(
        self: Effect.Effect<A, E, R>,
        message: string,
        status: number,
        extras: StatusCauseTaggedErrorExtrasInput<Fields>
      ): Effect.Effect<A, Error, R>;
      (
        message: string,
        status: number,
        extras: StatusCauseTaggedErrorExtrasInput<Fields>
      ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, Error, R>;
    };

type StatusCauseTaggedErrorNoCause<Error, Fields extends StatusCauseTaggedErrorFields> = [keyof Fields] extends [never]
  ? (message: string, status: number) => Error
  : (message: string, status: number, extras: StatusCauseTaggedErrorExtrasInput<Fields>) => Error;

type StatusCauseTaggedErrorStatics<Error, Fields extends StatusCauseTaggedErrorFields> = {
  readonly new: StatusCauseTaggedErrorNew<Error, Fields>;
  readonly noCause: StatusCauseTaggedErrorNoCause<Error, Fields>;
  readonly mapError: StatusCauseTaggedErrorMapError<Error, Fields>;
};

type StatusCauseTaggedErrorMissingSelfGeneric<Usage extends string> =
  `Missing \`Self\` generic - use \`class Self extends ${Usage}<Self>(...)\``;

type StatusCauseTaggedErrorExtendMethod<
  Tag extends string,
  Fields extends StatusCauseTaggedErrorFields,
  ErrorClass extends StatusCauseTaggedErrorClassLike,
> = <Extended = never, Brand = {}>(
  identifier: string
) => <NewFields extends StatusCauseTaggedErrorFields>(
  fields: StatusCauseTaggedErrorNoReservedFields<NewFields>,
  annotations?: StatusCauseTaggedErrorAnnotation<
    Extended,
    S.Struct<Struct.Simplify<Struct.Assign<ErrorClass["~type.parameters"][0]["fields"], NewFields>>>
  >
) => [Extended] extends [never]
  ? StatusCauseTaggedErrorMissingSelfGeneric<"Base.extend">
  : StatusCauseTaggedErrorClassWithStatics<
      Extended,
      Tag,
      Struct.Simplify<Struct.Assign<Fields, NewFields>>,
      Brand,
      TaggedErrorClassFromFields<
        Extended,
        Tag,
        Struct.Simplify<Struct.Assign<StatusCauseTaggedErrorCombinedFields<Fields>, NewFields>>,
        Brand
      >
    >;

/**
 * Tagged error class returned by {@link StatusCauseTaggedErrorClass}, including dual status/cause helpers.
 *
 * **Example** (noCause via statics type)
 *
 * ```ts
 * import { $SchemaId } from "@beep/identity/packages"
 * import {
 *   StatusCauseTaggedErrorClass,
 *   type StatusCauseTaggedErrorClassWithStatics
 * } from "@beep/schema/StatusCauseTaggedErrorClass"
 *
 * const $I = $SchemaId.create("StatusCauseTaggedErrorClassWithStatics/example")
 *
 * class ExampleError extends StatusCauseTaggedErrorClass<ExampleError>($I`ExampleError`)(
 *   "ExampleError",
 *   $I.annote("ExampleError", {
 *     description: "An example HTTP-style failure."
 *   })
 * ) {}
 *
 * const fromClass = (
 *   errorClass: StatusCauseTaggedErrorClassWithStatics<ExampleError, "ExampleError", {}, {}>
 * ) => errorClass.noCause("Missing", 404)
 *
 * const error = fromClass(ExampleError)
 *
 * console.log(error)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type StatusCauseTaggedErrorClassWithStatics<
  Self,
  Tag extends string,
  Fields extends StatusCauseTaggedErrorFields,
  Brand,
  ErrorClass extends StatusCauseTaggedErrorClassLike = TaggedErrorClassFromFields<
    Self,
    Tag,
    StatusCauseTaggedErrorCombinedFields<Fields>,
    Brand
  >,
> = (new (
  ...args: StatusCauseTaggedErrorConstructorArgs<ErrorClass>
) => StatusCauseTaggedErrorInstance<ErrorClass>) &
  Omit<ErrorClass, "extend"> &
  StatusCauseTaggedErrorStatics<Self, Fields> & {
    readonly extend: StatusCauseTaggedErrorExtendMethod<Tag, Fields, ErrorClass>;
  };

/**
 * Factory returned by {@link StatusCauseTaggedErrorClass} after an identity namespace has been selected.
 *
 * **Example** (Factory type after identity)
 *
 * ```ts
 * import { $SchemaId } from "@beep/identity/packages"
 * import {
 *   StatusCauseTaggedErrorClass,
 *   type StatusCauseTaggedErrorClassFactory
 * } from "@beep/schema/StatusCauseTaggedErrorClass"
 *
 * const $I = $SchemaId.create("StatusCauseTaggedErrorClassFactory/example")
 *
 * class ExampleError extends StatusCauseTaggedErrorClass<ExampleError>($I`ExampleError`)(
 *   "ExampleError",
 *   $I.annote("ExampleError", {
 *     description: "An example HTTP-style failure built from a factory."
 *   })
 * ) {}
 *
 * const factory: StatusCauseTaggedErrorClassFactory<ExampleError> =
 *   StatusCauseTaggedErrorClass<ExampleError>($I`ExampleErrorFactory`)
 * const error = ExampleError.noCause("Missing", 404)
 *
 * console.log(factory)
 * console.log(error)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface StatusCauseTaggedErrorClassFactory<Self, Brand = {}> {
  <Tag extends string, const Fields extends StatusCauseTaggedErrorFields>(
    tag: Tag,
    fields: StatusCauseTaggedErrorNoReservedFields<Fields>,
    annotations?: StatusCauseTaggedErrorAnnotation<
      Self,
      S.TaggedStruct<Tag, StatusCauseTaggedErrorCombinedFields<Fields>>
    >
  ): StatusCauseTaggedErrorClassWithStatics<Self, Tag, Fields, Brand>;

  <Tag extends string>(
    tag: Tag,
    annotations?: StatusCauseTaggedErrorAnnotation<Self, S.TaggedStruct<Tag, StatusCauseTaggedErrorStandardFields>>
  ): StatusCauseTaggedErrorClassWithStatics<Self, Tag, {}, Brand>;
}

/**
 * Callable constructor for creating status-cause tagged error class factories.
 *
 * **Example** (Constructor type class creation)
 *
 * ```ts
 * import { $SchemaId } from "@beep/identity/packages"
 * import {
 *   StatusCauseTaggedErrorClass,
 *   type StatusCauseTaggedErrorClassConstructor
 * } from "@beep/schema/StatusCauseTaggedErrorClass"
 *
 * const $I = $SchemaId.create("StatusCauseTaggedErrorClassConstructor/example")
 * const makeStatusError: StatusCauseTaggedErrorClassConstructor = StatusCauseTaggedErrorClass
 *
 * class ExampleError extends makeStatusError<ExampleError>($I`ExampleError`)(
 *   "ExampleError",
 *   $I.annote("ExampleError", {
 *     description: "An example HTTP-style failure built through the constructor type."
 *   })
 * ) {}
 *
 * const error = ExampleError.noCause("Missing", 404)
 *
 * console.log(error)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export type StatusCauseTaggedErrorClassConstructor = <Self, Brand = {}>(
  identifier?: undefined | string
) => StatusCauseTaggedErrorClassFactory<Self, Brand>;

const hasExtraFields = (fields: StatusCauseTaggedErrorFields): boolean => !R.isEmptyReadonlyRecord(fields);

const isSchemaFields = (value: unknown): value is StatusCauseTaggedErrorFields =>
  P.isObject(value) && R.every(value as Readonly<Record<string, unknown>>, S.isSchema);

const combineStatusCauseTaggedErrorFields = <Fields extends StatusCauseTaggedErrorFields>(
  fields: Fields
): StatusCauseTaggedErrorCombinedFields<Fields> =>
  ({
    ...fields,
    ...StatusCauseFields,
  }) as StatusCauseTaggedErrorCombinedFields<Fields>;

const statusCauseTaggedErrorInput = <Fields extends StatusCauseTaggedErrorFields>(
  cause: unknown,
  message: string,
  status: number,
  extras?: StatusCauseTaggedErrorExtrasInput<Fields>
): StatusCauseTaggedErrorNewInput<Fields> =>
  ({
    ...extras,
    ...statusCauseInput(message, { status, cause }),
  }) as StatusCauseTaggedErrorNewInput<Fields>;

const makeStatusCauseTaggedErrorNew = <Error, Fields extends StatusCauseTaggedErrorFields>(
  fields: Fields
): StatusCauseTaggedErrorNew<Error, Fields> => {
  const hasExtras = hasExtraFields(fields);
  const build = dual(
    hasExtras ? 5 : 4,
    (
      ctor: StatusCauseTaggedErrorCtor<Error, Fields>,
      cause: unknown,
      message: string,
      status: number,
      extras?: StatusCauseTaggedErrorExtrasInput<Fields>
    ) => new ctor(statusCauseTaggedErrorInput<Fields>(cause, message, status, extras))
  ) as (
    ctor: StatusCauseTaggedErrorCtor<Error, Fields>,
    cause: unknown,
    message: string,
    status: number,
    extras?: StatusCauseTaggedErrorExtrasInput<Fields>
  ) => Error;

  return function (
    this: StatusCauseTaggedErrorCtor<Error, Fields>,
    causeOrMessage: unknown,
    messageOrStatus?: string | number,
    statusOrExtras?: number | StatusCauseTaggedErrorExtrasInput<Fields>,
    extras?: StatusCauseTaggedErrorExtrasInput<Fields>
  ): Error | ((cause: unknown) => Error) {
    if (hasExtras) {
      return arguments.length >= 4
        ? build(this, causeOrMessage, messageOrStatus as string, statusOrExtras as number, extras)
        : (cause: unknown) =>
            build(
              this,
              cause,
              causeOrMessage as string,
              messageOrStatus as number,
              statusOrExtras as StatusCauseTaggedErrorExtrasInput<Fields>
            );
    }

    return arguments.length >= 3
      ? build(this, causeOrMessage, messageOrStatus as string, statusOrExtras as number)
      : (cause: unknown) => build(this, cause, causeOrMessage as string, messageOrStatus as number);
  } as StatusCauseTaggedErrorNew<Error, Fields>;
};

const makeStatusCauseTaggedErrorMapError = <Error, Fields extends StatusCauseTaggedErrorFields>(
  fields: Fields
): StatusCauseTaggedErrorMapError<Error, Fields> => {
  const hasExtras = hasExtraFields(fields);
  const build = dual(
    hasExtras ? 5 : 4,
    <A, E, R>(
      ctor: StatusCauseTaggedErrorCtor<Error, Fields>,
      self: Effect.Effect<A, E, R>,
      message: string,
      status: number,
      extras?: StatusCauseTaggedErrorExtrasInput<Fields>
    ): Effect.Effect<A, Error, R> =>
      Effect.mapError(self, (cause) => new ctor(statusCauseTaggedErrorInput<Fields>(cause, message, status, extras)))
  ) as <A, E, R>(
    ctor: StatusCauseTaggedErrorCtor<Error, Fields>,
    self: Effect.Effect<A, E, R>,
    message: string,
    status: number,
    extras?: StatusCauseTaggedErrorExtrasInput<Fields>
  ) => Effect.Effect<A, Error, R>;

  return function <A, E, R>(
    this: StatusCauseTaggedErrorCtor<Error, Fields>,
    selfOrMessage: Effect.Effect<A, E, R> | string,
    messageOrStatus?: string | number,
    statusOrExtras?: number | StatusCauseTaggedErrorExtrasInput<Fields>,
    extras?: StatusCauseTaggedErrorExtrasInput<Fields>
  ): Effect.Effect<A, Error, R> | ((self: Effect.Effect<A, E, R>) => Effect.Effect<A, Error, R>) {
    if (hasExtras) {
      return arguments.length >= 4
        ? build(
            this,
            selfOrMessage as Effect.Effect<A, E, R>,
            messageOrStatus as string,
            statusOrExtras as number,
            extras
          )
        : (self: Effect.Effect<A, E, R>) =>
            build(
              this,
              self,
              selfOrMessage as string,
              messageOrStatus as number,
              statusOrExtras as StatusCauseTaggedErrorExtrasInput<Fields>
            );
    }

    return arguments.length >= 3
      ? build(this, selfOrMessage as Effect.Effect<A, E, R>, messageOrStatus as string, statusOrExtras as number)
      : (self: Effect.Effect<A, E, R>) => build(this, self, selfOrMessage as string, messageOrStatus as number);
  } as StatusCauseTaggedErrorMapError<Error, Fields>;
};

const makeStatusCauseTaggedErrorNoCause = <
  Error,
  Fields extends StatusCauseTaggedErrorFields,
>(): StatusCauseTaggedErrorNoCause<Error, Fields> =>
  function (
    this: StatusCauseTaggedErrorCtor<Error, Fields>,
    message: string,
    status: number,
    extras?: StatusCauseTaggedErrorExtrasInput<Fields>
  ): Error {
    return new this(statusCauseTaggedErrorInput<Fields>(undefined, message, status, extras));
  } as StatusCauseTaggedErrorNoCause<Error, Fields>;

const attachStatusCauseTaggedErrorStatics = <
  Self,
  Tag extends string,
  Fields extends StatusCauseTaggedErrorFields,
  Brand,
  ErrorClass extends StatusCauseTaggedErrorClassLike,
>(
  errorClass: ErrorClass,
  fields: Fields
): StatusCauseTaggedErrorClassWithStatics<Self, Tag, Fields, Brand, ErrorClass> => {
  const originalExtend = errorClass.extend as (
    this: StatusCauseTaggedErrorClassLike,
    identifier: string
  ) => (
    fields: StatusCauseTaggedErrorFields,
    annotations?: S.Annotations.Declaration<TUnsafe.Any, readonly [S.Struct<StatusCauseTaggedErrorFields>]>
  ) => StatusCauseTaggedErrorClassLike;
  const makeNew = makeStatusCauseTaggedErrorNew<Self, Fields>(fields);
  const noCause = makeStatusCauseTaggedErrorNoCause<Self, Fields>();
  const mapError = makeStatusCauseTaggedErrorMapError<Self, Fields>(fields);
  const staticTarget = (target: unknown): StatusCauseTaggedErrorClassLike =>
    P.isFunction(target) ? (target as StatusCauseTaggedErrorClassLike) : errorClass;
  const extendStatusCauseTaggedError = function (
    this: StatusCauseTaggedErrorClassLike | undefined,
    identifier: string
  ) {
    const target = this ?? errorClass;
    const extend = originalExtend.call(target, identifier);

    return (newFields: StatusCauseTaggedErrorFields, annotations?: TUnsafe.Any) => {
      const extended = extend(newFields, annotations);

      return attachStatusCauseTaggedErrorStatics(extended, {
        ...fields,
        ...newFields,
      } as StatusCauseTaggedErrorFields);
    };
  };

  return withStatics(errorClass, () => ({
    get new(): StatusCauseTaggedErrorNew<Self, Fields> {
      return makeNew.bind(staticTarget(this)) as unknown as StatusCauseTaggedErrorNew<Self, Fields>;
    },
    get noCause(): StatusCauseTaggedErrorNoCause<Self, Fields> {
      return noCause.bind(staticTarget(this)) as unknown as StatusCauseTaggedErrorNoCause<Self, Fields>;
    },
    get mapError(): StatusCauseTaggedErrorMapError<Self, Fields> {
      return mapError.bind(staticTarget(this)) as unknown as StatusCauseTaggedErrorMapError<Self, Fields>;
    },
    get extend(): StatusCauseTaggedErrorExtendMethod<Tag, Fields, ErrorClass> {
      return extendStatusCauseTaggedError.bind(staticTarget(this)) as unknown as StatusCauseTaggedErrorExtendMethod<
        Tag,
        Fields,
        ErrorClass
      >;
    },
  })) as StatusCauseTaggedErrorClassWithStatics<Self, Tag, Fields, Brand, ErrorClass>;
};

/**
 * Create a tagged error class that carries `message`, `status`, and optional defect `cause`.
 *
 * **Details**
 *
 * `StatusCauseTaggedErrorClass` is a pipe-friendly offshoot of {@link TaggedErrorClass}
 * for the existing {@link StatusCauseFields} shape. It attaches dual static
 * `new` and `mapError` helpers plus a `noCause` constructor for status-only
 * failures. Raw causes are normalized into `Option` values.
 *
 * **Example** (mapError and noCause helpers)
 *
 * ```ts
 * import { $SchemaId } from "@beep/identity/packages"
 * import { Effect, pipe } from "effect"
 * import { StatusCauseTaggedErrorClass } from "@beep/schema/StatusCauseTaggedErrorClass"
 *
 * const $I = $SchemaId.create("StatusCauseTaggedErrorClass/basic")
 *
 * class HttpError extends StatusCauseTaggedErrorClass<HttpError>($I`HttpError`)(
 *   "HttpError",
 *   $I.annote("HttpError", {
 *     description: "An HTTP failure with status and optional cause."
 *   })
 * ) {}
 *
 * const program = pipe(
 *   Effect.fail(new Error("unavailable")),
 *   HttpError.mapError("Request failed", 503)
 * )
 * const notFound = HttpError.noCause("Missing resource", 404)
 *
 * const exit = Effect.runSyncExit(program)
 * console.log(exit._tag)
 * console.log(notFound)
 * ```
 *
 * **Example** (Extra fields with new)
 *
 * ```ts
 * import { $SchemaId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 * import { StatusCauseTaggedErrorClass } from "@beep/schema/StatusCauseTaggedErrorClass"
 *
 * const $I = $SchemaId.create("StatusCauseTaggedErrorClass/with-extra-fields")
 *
 * class ProviderError extends StatusCauseTaggedErrorClass<ProviderError>($I`ProviderError`)(
 *   "ProviderError",
 *   {
 *     provider: S.String
 *   },
 *   $I.annote("ProviderError", {
 *     description: "A provider failure with status, cause, and provider context."
 *   })
 * ) {}
 *
 * const error = ProviderError.new("Provider failed", 502, {
 *   provider: "local"
 * })(new Error("unavailable"))
 *
 * console.log(error)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const StatusCauseTaggedErrorClass: StatusCauseTaggedErrorClassConstructor = (identifier?: undefined | string) =>
  ((tag: string, fieldsOrAnnotations?: TUnsafe.Any, annotations?: TUnsafe.Any) => {
    const hasFields = isSchemaFields(fieldsOrAnnotations);
    const fields = hasFields ? fieldsOrAnnotations : {};
    const taggedError = TaggedErrorClass<TUnsafe.Any, TUnsafe.Any>(identifier)(
      tag,
      combineStatusCauseTaggedErrorFields(fields),
      hasFields ? annotations : fieldsOrAnnotations
    );

    return attachStatusCauseTaggedErrorStatics(taggedError, fields);
  }) as TUnsafe.Any;
