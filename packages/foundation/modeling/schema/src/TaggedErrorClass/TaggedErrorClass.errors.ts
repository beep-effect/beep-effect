/**
 * Typed tagged error class wrappers over Effect Schema classes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SchemaAST as AST, Struct } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import type { TUnsafe } from "@beep/types";
import type { Cause } from "effect";

type TaggedErrorFields = S.Struct.Fields;
type TaggedErrorStruct = S.Struct<TaggedErrorFields>;
type TaggedErrorCause<Brand> = Cause.YieldableError & Brand;
type TaggedErrorClassInput = {
  readonly "~type.make.in": unknown;
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

type TaggedErrorInputWithoutTag<Input> = Input extends void ? Input : Omit<Input, "_tag">;

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
export type TaggedErrorNewInput<ErrorClass extends TaggedErrorClassInput> = TaggedErrorInputWithoutTag<
  ErrorClass["~type.make.in"]
>;

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
> = TaggedErrorBase<Self, TaggedStructFromFields<Tag, Fields>, Brand>;

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
> = TaggedErrorBase<Self, TaggedStructFromSchema<Tag, Schema>, Brand>;

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
type UnsafeTaggedErrorAnnotations = S.Annotations.Declaration<TUnsafe.Any, readonly [TaggedErrorStruct]>;
type UnsafeTaggedErrorToEquivalence = NonNullable<UnsafeTaggedErrorAnnotations["toEquivalence"]>;
type UnsafeTaggedErrorEquivalence = ReturnType<UnsafeTaggedErrorToEquivalence>;
type UnsafeTaggedErrorExtend = (
  this: UnsafeTaggedErrorClass,
  identifier: string
) => (
  schema: TaggedErrorFields | TaggedErrorStruct,
  annotations?: UnsafeTaggedErrorAnnotations
) => UnsafeTaggedErrorClass;

interface UnsafeTaggedErrorClass {
  readonly extend: UnsafeTaggedErrorExtend;
  readonly fields: TaggedErrorFields;
  new (...args: ReadonlyArray<TUnsafe.Any>): TUnsafe.Any;
}

const isTaggedErrorStruct = (schema: TaggedErrorFields | TaggedErrorStruct): schema is TaggedErrorStruct =>
  S.isSchema(schema);

const taggedErrorFields = (schema: TaggedErrorFields | TaggedErrorStruct): TaggedErrorFields =>
  isTaggedErrorStruct(schema) ? schema.fields : schema;

const taggedErrorToEquivalence = (schema: TaggedErrorStruct): UnsafeTaggedErrorToEquivalence | undefined =>
  AST.resolve(schema.ast)?.toEquivalence as UnsafeTaggedErrorToEquivalence | undefined;

const withFieldEquivalence = (
  schema: TaggedErrorFields | TaggedErrorStruct,
  annotations?: UnsafeTaggedErrorAnnotations,
  schemaToEquivalence: UnsafeTaggedErrorToEquivalence | undefined = isTaggedErrorStruct(schema)
    ? taggedErrorToEquivalence(schema)
    : undefined
): UnsafeTaggedErrorAnnotations =>
  annotations?.toEquivalence === undefined
    ? {
        ...annotations,
        toEquivalence:
          schemaToEquivalence ?? (() => S.toEquivalence(isTaggedErrorStruct(schema) ? schema : S.Struct(schema))),
      }
    : annotations;

const fieldsToEquivalence = (fields: TaggedErrorFields): UnsafeTaggedErrorEquivalence =>
  (withFieldEquivalence(fields).toEquivalence as () => UnsafeTaggedErrorEquivalence)();

const combineExtensionEquivalence = (
  inheritedEquivalence: UnsafeTaggedErrorEquivalence,
  extensionSchema: TaggedErrorFields | TaggedErrorStruct
): UnsafeTaggedErrorToEquivalence => {
  const extensionToEquivalence = withFieldEquivalence(extensionSchema).toEquivalence as UnsafeTaggedErrorToEquivalence;

  return (typeParameters) => {
    const extensionEquivalence = extensionToEquivalence(typeParameters);

    return (self, that) => inheritedEquivalence(self, that) && extensionEquivalence(self, that);
  };
};

const preserveFieldEquivalenceOnExtend = (errorClass: UnsafeTaggedErrorClass): UnsafeTaggedErrorClass => {
  const originalExtend = errorClass.extend;
  const extendWithFieldEquivalence: UnsafeTaggedErrorExtend = function (identifier) {
    const extend = originalExtend.call(this, identifier);

    return (schema, annotations) => {
      const extensionFields = taggedErrorFields(schema);
      const extensionKeys = Reflect.ownKeys(extensionFields);
      // A class-level comparator cannot be decomposed safely after a field is
      // replaced. Compare untouched inherited fields structurally and let the
      // extension schema own every replacement.
      const inheritedEquivalence = (
        A.some(extensionKeys, (key) => Reflect.has(this.fields, key))
          ? fieldsToEquivalence(Struct.omit(this.fields, extensionKeys))
          : S.toEquivalence(this as never)
      ) as UnsafeTaggedErrorEquivalence;

      return preserveFieldEquivalenceOnExtend(
        extend(
          schema,
          withFieldEquivalence(
            {
              ...this.fields,
              ...extensionFields,
            },
            annotations,
            combineExtensionEquivalence(inheritedEquivalence, schema)
          )
        )
      );
    };
  };

  Reflect.defineProperty(errorClass, "extend", {
    configurable: true,
    enumerable: false,
    value: extendWithFieldEquivalence,
    writable: true,
  });

  return errorClass;
};

/**
 * Create a tagged error class with `_tag` discrimination and constructor input inferred from the schema.
 *
 * Delegates class construction and extension to `S.TaggedErrorClass`. The
 * local delta is a declared-field equivalence fallback that ignores transient
 * `Error` metadata, follows recursive `extend(...)` calls, and yields to an
 * explicit caller-supplied `toEquivalence` annotation.
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
    const errorClass = S.TaggedErrorClass<TUnsafe.Any, TUnsafe.Any>(identifier)(
      tagValue,
      schema as never,
      withFieldEquivalence(schema, annotations) as never
    );

    return preserveFieldEquivalenceOnExtend(errorClass);
  }) as unknown as UnsafeTaggedErrorClassFactory;
