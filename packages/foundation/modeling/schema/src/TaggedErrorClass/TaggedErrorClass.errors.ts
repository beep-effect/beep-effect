/**
 * Typed tagged error class wrappers over Effect Schema classes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import type { TUnsafe } from "@beep/types";
import type { Cause, Struct } from "effect";

type TaggedErrorFields = S.Struct.Fields;
type TaggedErrorStruct = S.Struct<TaggedErrorFields>;
type TaggedErrorCause<Brand> = Cause.YieldableError & Brand;
type TaggedErrorClassLike = (new (
  ...args: ReadonlyArray<TUnsafe.Any>
) => TUnsafe.Any) & {
  readonly Type: TUnsafe.Any;
  readonly fields: TaggedErrorFields;
  readonly "~type.parameters": readonly [TaggedErrorStruct];
};

type TaggedStructFromFields<Tag extends string, Fields extends TaggedErrorFields> = S.TaggedStruct<Tag, Fields>;
type TaggedStructFromSchema<Tag extends string, Schema extends TaggedErrorStruct> = S.Struct<
  Struct.Simplify<
    {
      readonly _tag: S.tag<Tag>;
    } & Schema["fields"]
  >
>;

type TaggedErrorBase<Self, Schema extends TaggedErrorStruct, Brand> = S.Class<Self, Schema, TaggedErrorCause<Brand>>;

type TaggedErrorSchema<ErrorClass extends TaggedErrorClassLike> = ErrorClass["~type.parameters"] extends readonly [
  infer Schema extends TaggedErrorStruct,
]
  ? Schema
  : never;
type TaggedErrorSelf<ErrorClass extends TaggedErrorClassLike> = ErrorClass["Type"];

type TaggedErrorExtendedSchema<ErrorClass extends TaggedErrorClassLike, NewFields extends TaggedErrorFields> = S.Struct<
  Struct.Simplify<Struct.Assign<TaggedErrorSchema<ErrorClass>["fields"], NewFields>>
>;

type TaggedErrorMissingSelfGeneric<Usage extends string> =
  `Missing \`Self\` generic - use \`class Self extends ${Usage}<Self>(...)\``;

type TaggedErrorInheritStaticMembers<ClassType, Static> = ClassType &
  Pick<Static, Exclude<keyof Static, keyof ClassType>>;
type TaggedErrorConstructorArgs<ErrorClass extends TaggedErrorClassLike> = ErrorClass extends new (
  ...args: infer Args
) => TUnsafe.Any
  ? Args
  : never;
type TaggedErrorInstance<ErrorClass extends TaggedErrorClassLike> = ErrorClass extends new (
  ...args: ReadonlyArray<TUnsafe.Any>
) => infer Instance
  ? Instance
  : never;

/**
 * Input type for constructing a tagged error, omitting the discriminator `_tag`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaggedErrorClass, type TaggedErrorNewInput } from "@beep/schema/TaggedErrorClass"
 *
 * class NotFound extends TaggedErrorClass<NotFound>()("NotFound", {
 *   message: S.String
 * }) {}
 *
 * const input: TaggedErrorNewInput<typeof NotFound> = {
 *   message: "User not found"
 * }
 * const error = NotFound.make(input)
 *
 * console.log(error)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TaggedErrorNewInput<ErrorClass extends TaggedErrorClassLike> = Omit<
  S.Schema.Type<TaggedErrorSchema<ErrorClass>>,
  "_tag"
>;

type TaggedErrorExtendMethod<ErrorClass extends TaggedErrorClassLike> = <Extended = never, Static = {}, Brand = {}>(
  identifier: string
) => <NewFields extends TaggedErrorFields>(
  fields: NewFields,
  annotations?: S.Annotations.Declaration<Extended, readonly [TaggedErrorExtendedSchema<ErrorClass, NewFields>]>
) => [Extended] extends [never]
  ? TaggedErrorMissingSelfGeneric<"Base.extend">
  : TaggedErrorInheritStaticMembers<
      TaggedErrorClassWithExtend<
        S.Class<Extended, TaggedErrorExtendedSchema<ErrorClass, NewFields>, TaggedErrorSelf<ErrorClass> & Brand>
      >,
      Static
    >;

/**
 * A tagged error class with constructor input inferred from the schema and a typed `extend(...)` API.
 *
 * @since 0.0.0
 * @category models
 */
type TaggedErrorClassWithExtend<ErrorClass extends TaggedErrorClassLike> = (new (
  ...args: TaggedErrorConstructorArgs<ErrorClass>
) => TaggedErrorInstance<ErrorClass>) &
  Omit<ErrorClass, "extend"> & {
    extend: TaggedErrorExtendMethod<ErrorClass>;
  };

/**
 * Tagged error class type derived from a fields object.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaggedErrorClass, type TaggedErrorClassFromFields } from "@beep/schema/TaggedErrorClass"
 *
 * class NotFound extends TaggedErrorClass<NotFound>()("NotFound", {
 *   message: S.String
 * }) {}
 *
 * type NotFoundClass = TaggedErrorClassFromFields<
 *   NotFound,
 *   "NotFound",
 *   { readonly message: typeof S.String }
 * >
 *
 * const fromClass = (errorClass: NotFoundClass) => new errorClass({ message: "User not found" })
 * const error = fromClass(NotFound)
 *
 * console.log(error)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TaggedErrorClassFromFields<
  Self,
  Tag extends string,
  Fields extends TaggedErrorFields,
  Brand = {},
> = TaggedErrorClassWithExtend<TaggedErrorBase<Self, TaggedStructFromFields<Tag, Fields>, Brand>>;

/**
 * Tagged error class type derived from a struct schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaggedErrorClass, type TaggedErrorClassFromSchema } from "@beep/schema/TaggedErrorClass"
 *
 * const NotFoundFields = S.Struct({
 *   message: S.String
 * })
 *
 * class NotFound extends TaggedErrorClass<NotFound>()("NotFound", NotFoundFields) {}
 *
 * type NotFoundClass = TaggedErrorClassFromSchema<NotFound, "NotFound", typeof NotFoundFields>
 *
 * const fromClass = (errorClass: NotFoundClass) => new errorClass({ message: "User not found" })
 * const error = fromClass(NotFound)
 *
 * console.log(error)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TaggedErrorClassFromSchema<
  Self,
  Tag extends string,
  Schema extends TaggedErrorStruct,
  Brand = {},
> = TaggedErrorClassWithExtend<TaggedErrorBase<Self, TaggedStructFromSchema<Tag, Schema>, Brand>>;

/**
 * Factory interface returned by {@link TaggedErrorClass} that accepts a tag, fields, and optional annotations.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaggedErrorClass, type TaggedErrorClassFactory } from "@beep/schema/TaggedErrorClass"
 *
 * class NotFound extends TaggedErrorClass<NotFound>()("NotFound", {
 *   message: S.String
 * }) {}
 *
 * const factory: TaggedErrorClassFactory<NotFound> = TaggedErrorClass<NotFound>()
 * const SameShapeError = factory("SameShapeError", {
 *   message: S.String
 * })
 * const original = NotFound.make({ message: "User not found" })
 * const error = new SameShapeError({ message: "User not found" })
 *
 * console.log(original)
 * console.log(error)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface TaggedErrorClassFactory<Self, Brand = {}> {
  <Tag extends string, const Fields extends TaggedErrorFields>(
    tag: Tag,
    fields: Fields,
    annotations?: S.Annotations.Declaration<Self, readonly [TaggedStructFromFields<Tag, Fields>]>
  ): TaggedErrorClassFromFields<Self, Tag, Fields, Brand>;

  <Tag extends string, Schema extends TaggedErrorStruct>(
    tag: Tag,
    schema: Schema,
    annotations?: S.Annotations.Declaration<Self, readonly [TaggedStructFromSchema<Tag, Schema>]>
  ): TaggedErrorClassFromSchema<Self, Tag, Schema, Brand>;
}

/**
 * Callable constructor type for building tagged error classes.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TaggedErrorClass, type TaggedErrorClassConstructor } from "@beep/schema/TaggedErrorClass"
 *
 * const makeTaggedErrorClass: TaggedErrorClassConstructor = TaggedErrorClass
 *
 * class NotFound extends makeTaggedErrorClass<NotFound>()("NotFound", {
 *   message: S.String
 * }) {}
 *
 * const error = NotFound.make({ message: "User not found" })
 *
 * console.log(error)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export type TaggedErrorClassConstructor = <Self, Brand = {}>(
  identifier?: undefined | string
) => TaggedErrorClassFactory<Self, Brand>;

type UnsafeTaggedErrorClassFactory = TaggedErrorClassFactory<TUnsafe.Any, TUnsafe.Any>;

/**
 * Create a tagged error class with `_tag` discrimination and constructor input inferred from the schema.
 *
 * Wraps `S.TaggedErrorClass` and automatically prepends a `_tag` field while
 * preserving a typed `extend(...)` API for derived tagged error classes.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Effect } from "effect"
 * import { TaggedErrorClass } from "@beep/schema"
 *
 * class NotFound extends TaggedErrorClass<NotFound>()("NotFound", {
 *   message: S.String
 * }) {}
 *
 * const err = NotFound.make({ message: "User not found" })
 *
 * const program = Effect.fail(err)
 *
 * const exit = Effect.runSyncExit(program)
 * console.log(exit._tag)
 * ```
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Effect } from "effect"
 * import { TaggedErrorClass } from "@beep/schema"
 *
 * class DbError extends TaggedErrorClass<DbError>()("DbError", {
 *   query: S.String
 * }) {}
 *
 * const program = Effect.try({
 *   try: () => "ok",
 *   catch: () => DbError.make({ query: "select 1" })
 * })
 *
 * const value = Effect.runSync(program)
 * console.log(value)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const TaggedErrorClass: TaggedErrorClassConstructor = (identifier?: undefined | string) =>
  ((
    tagValue: string,
    schema: TaggedErrorFields | TaggedErrorStruct,
    annotations?: S.Annotations.Declaration<TUnsafe.Any, readonly [TaggedErrorStruct]>
  ) => {
    // Tagged errors extend `Error`, so effect's `Data.Error` machinery captures
    // transient stack metadata (`stack`/`line`/`column`/`sourceURL`/...) as
    // enumerable own properties. The structural equivalence derived by
    // `S.toEquivalence` includes those, so two errors with IDENTICAL schema
    // fields are never equivalent across construction sites (e.g. `make` vs
    // `decode`) — which breaks every schema round-trip property test. Derive the
    // equivalence from the DECLARED FIELDS only (each via its own schema), so
    // `S.toEquivalence(ThisError)` is stack-independent and round-trip-safe.
    // Only the derived equivalence changes; `Equal.equals`/`Hash` (identity and
    // keying) are untouched.
    const fieldsStruct = S.isSchema(schema) ? (schema as TaggedErrorStruct) : S.Struct(schema as TaggedErrorFields);
    const withFieldEquivalence = {
      ...(annotations ?? {}),
      toEquivalence: () => S.toEquivalence(fieldsStruct as never),
    };
    return S.TaggedErrorClass<TUnsafe.Any, TUnsafe.Any>(identifier)(
      tagValue,
      schema as never,
      withFieldEquivalence as never
    );
  }) as unknown as UnsafeTaggedErrorClassFactory;
