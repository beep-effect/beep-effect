/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A } from "@beep/utils";
import { dual } from "effect/Function";
import { pipeArguments } from "effect/Pipeable";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { Pipeable } from "effect/Pipeable";
import type * as AST from "effect/SchemaAST";
import type * as Struct_ from "effect/Struct";
/**
 * Runtime marker used to identify variant-aware struct values.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TypeId, make } from "@beep/schema/VariantSchema"
 *
 * const Variant = make({ variants: ["read", "write"], defaultVariant: "read" })
 * const struct = Variant.Struct({ id: S.String })
 * console.log(TypeId in struct) // true
 * ```
 *
 * @category type-ids
 * @since 0.0.0
 */
export const TypeId = "~effect/schema/VariantSchema";

const cacheSymbol = Symbol.for(`${TypeId}/cache`);

/**
 * Variant-aware struct descriptor used by `make`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { fields, make, type Struct } from "@beep/schema/VariantSchema"
 *
 * const Variant = make({ variants: ["read", "write"], defaultVariant: "read" })
 * const struct: Struct<{ readonly id: typeof S.String }> = Variant.Struct({ id: S.String })
 * console.log(Object.keys(fields(struct)))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface Struct<in out A extends Field.Fields> extends Pipeable {
  readonly [TypeId]: A;
  /** @internal */
  [cacheSymbol]?: Record<string, S.Top>;
}

/**
 * Guard for variant-aware struct descriptors.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { isStruct, make } from "@beep/schema/VariantSchema"
 *
 * const Variant = make({ variants: ["read", "write"], defaultVariant: "read" })
 * console.log(isStruct(Variant.Struct({ id: S.String }))) // true
 * ```
 *
 * @since 0.0.0
 * @category guards
 */
export const isStruct = (u: unknown): u is AnyStruct => P.hasProperty(u, TypeId);

/**
 * Type helpers for variant-aware struct descriptors.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { Struct } from "@beep/schema/VariantSchema"
 *
 * type Fields = Struct.Fields
 * console.log({ id: S.String } satisfies Fields)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export declare namespace Struct {
  /**
   * @since 0.0.0
   * @category models
   */
  export type Any = { readonly [TypeId]: unknown };

  /**
   * @since 0.0.0
   * @category models
   */
  export type Fields = {
    readonly [key: string]: S.Top | Field.Any | Struct.Any | undefined;
  };

  /**
   * @since 0.0.0
   * @category models
   */
  export type Validate<A, Variant extends string> = {
    readonly [K in keyof A]: A[K] extends { readonly [TypeId]: infer _ }
      ? Validate<A[K], Variant>
      : A[K] extends Field<infer Config>
        ? [keyof Config] extends [Variant]
          ? {}
          : "field must have valid variants"
        : {};
  };
}

const FieldTypeId = "~effect/schema/VariantSchema/Field";

/**
 * Variant-specific field descriptor.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { isField, make, type Field } from "@beep/schema/VariantSchema"
 *
 * const Variant = make({ variants: ["read", "write"], defaultVariant: "read" })
 * const field: Field<{ readonly read: typeof S.String }> = Variant.Field({ read: S.String })
 * console.log(isField(field))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface Field<in out A extends Field.Config> extends Pipeable {
  readonly schemas: A;
  readonly [FieldTypeId]: typeof FieldTypeId;
}

/**
 * Guard for variant-specific field descriptors.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { isField, make } from "@beep/schema/VariantSchema"
 *
 * const Variant = make({ variants: ["read", "write"], defaultVariant: "read" })
 * console.log(isField(Variant.Field({ write: S.String }))) // true
 * ```
 *
 * @since 0.0.0
 * @category guards
 */
export const isField = (u: unknown): u is AnyField => P.hasProperty(u, FieldTypeId);
/**
 * Type helpers for variant-specific field descriptors.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { Field } from "@beep/schema/VariantSchema"
 *
 * type Config = Field.Config
 * console.log({ read: S.String } satisfies Config)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export declare namespace Field {
  /**
   * @since 0.0.0
   * @category models
   */
  export type Any = { readonly [FieldTypeId]: typeof FieldTypeId };

  /**
   * @since 0.0.0
   * @category models
   */
  export type Config = {
    readonly [key: string]: S.Top | undefined;
  };

  /**
   * @since 0.0.0
   * @category models
   */
  export type ConfigWithKeys<K extends string> = {
    readonly [P in K]?: S.Top;
  };

  /**
   * @since 0.0.0
   * @category models
   */
  export type Fields = {
    readonly [key: string]: S.Top | Field.Any | Struct.Any | undefined;
  };
}

type AnyStruct = Pipeable & {
  readonly [TypeId]: Struct.Fields;
};
type AnyField = Pipeable & {
  readonly schemas: Field.Config;
  readonly [FieldTypeId]: typeof FieldTypeId;
};
type CachedStruct = AnyStruct & {
  [cacheSymbol]?: Record<string, S.Top>;
};
type UnknownFunction = (...args: ReadonlyArray<unknown>) => unknown;
type ClassBase = {
  readonly [key: string | symbol]: unknown;
  readonly extend: (identifier: string) => (fields: S.Struct.Fields, annotations?: unknown) => ClassBase;
};
type VariantStructFields = Record<string, S.Top | undefined>;
type SchemaClassFactory = (identifier: string) => (schema: S.Top, annotations?: unknown) => ClassBase;

/**
 * Extracts the field map for a single variant from variant-aware fields.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { ExtractFields } from "@beep/schema/VariantSchema"
 *
 * type ReadFields = ExtractFields<"read", { readonly id: typeof S.String }>
 * console.log({ id: S.String } satisfies ReadFields)
 * ```
 *
 * @since 0.0.0
 * @category type-level
 */
export type ExtractFields<V extends string, Fields extends Struct.Fields, IsDefault = false> = {
  readonly [K in keyof Fields as [Fields[K]] extends [Field<infer Config>]
    ? V extends keyof Config
      ? K
      : never
    : K]: [Fields[K]] extends [Struct<infer _>]
    ? Extract<V, Fields[K], IsDefault>
    : [Fields[K]] extends [Field<infer Config>]
      ? [Config[V]] extends [S.Top]
        ? Config[V]
        : never
      : [Fields[K]] extends [S.Top]
        ? Fields[K]
        : never;
};

/**
 * Extracts a schema for one variant from a variant-aware struct.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { make, type Extract } from "@beep/schema/VariantSchema"
 *
 * const Variant = make({ variants: ["read", "write"], defaultVariant: "read" })
 * const struct = Variant.Struct({ id: S.String })
 * type ReadSchema = Extract<"read", typeof struct>
 * console.log(S.isSchema(Variant.extract(struct, "read") satisfies ReadSchema))
 * ```
 *
 * @since 0.0.0
 * @category type-level
 */
export type Extract<V extends string, A extends AnyStruct, IsDefault = false> = [A] extends [Struct<infer Fields>]
  ? IsDefault extends true
    ? [A] extends [S.Top]
      ? A
      : S.Struct<Struct_.Simplify<ExtractFields<V, Fields>>>
    : S.Struct<Struct_.Simplify<ExtractFields<V, Fields>>>
  : never;

const extract: {
  <V extends string, const IsDefault extends boolean = false>(
    variant: V,
    options?: {
      readonly isDefault?: IsDefault | undefined;
    }
  ): <A extends AnyStruct>(self: A) => Extract<V, A, IsDefault>;
  <V extends string, A extends AnyStruct, const IsDefault extends boolean = false>(
    self: A,
    variant: V,
    options?: {
      readonly isDefault?: IsDefault | undefined;
    }
  ): Extract<V, A, IsDefault>;
} = dual(
  (args) => isStruct(args[0]),
  <V extends string, A extends AnyStruct>(
    self: A,
    variant: V,
    options?: {
      readonly isDefault?: boolean | undefined;
    }
  ): Extract<V, A> => {
    const cachedSelf = self as CachedStruct;
    const cache = cachedSelf[cacheSymbol] ?? (cachedSelf[cacheSymbol] = {});
    const cacheKey = options?.isDefault === true ? "__default" : variant;
    if (cache[cacheKey] !== undefined) {
      return cache[cacheKey] as Extract<V, A>;
    }
    const fields: VariantStructFields = {};
    for (const key of R.keys(self[TypeId])) {
      const value = self[TypeId][key];
      if (isStruct(value)) {
        if (options?.isDefault === true && S.isSchema(value)) {
          fields[key] = value;
        } else {
          fields[key] = extract(value, variant);
        }
      } else if (isField(value)) {
        if (variant in value.schemas) {
          fields[key] = value.schemas[variant];
        }
      } else if (S.isSchema(value)) {
        fields[key] = value;
      }
    }
    return (cache[cacheKey] = S.Struct(fields as S.Struct.Fields) as Extract<V, A>);
  }
);

/**
 * Returns the raw field map stored on a variant-aware struct.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { fields, make } from "@beep/schema/VariantSchema"
 *
 * const Variant = make({ variants: ["read", "write"], defaultVariant: "read" })
 * console.log(Object.keys(fields(Variant.Struct({ id: S.String }))))
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const fields = <A extends AnyStruct>(self: A): A[typeof TypeId] => self[TypeId];

/**
 * Variant-aware schema class shape produced by `make().Class`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { make } from "@beep/schema/VariantSchema"
 *
 * const Variant = make({ variants: ["read", "write"], defaultVariant: "read" })
 * class Account extends Variant.Class<Account>("Account")({ id: S.String }) {}
 * console.log(S.isSchema(Account.read))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface Class<
  Self,
  Fields extends Struct.Fields,
  S extends S.Top & {
    readonly fields: S.Struct.Fields;
  },
  Variants extends string = string,
  Default extends Variants = Variants,
  Inherited = {},
> extends S.BottomWithoutNew<
      Self,
      S["Encoded"],
      S["DecodingServices"],
      S["EncodingServices"],
      AST.Declaration,
      S.decodeTo<S.declareConstructor<Self, S["Encoded"], readonly [S], S["Iso"]>, S>,
      S["~type.make.in"],
      S["Iso"],
      readonly [S],
      Self,
      S["~type.mutability"],
      S["~type.optionality"],
      S["~type.constructor.default"],
      S["~encoded.mutability"],
      S["~encoded.optionality"]
    >,
    Struct<Struct_.Simplify<Fields>> {
  extend<Extended = never, Static = {}, InheritedBrand = {}>(
    identifier: string
  ): <const NewFields extends StructInput>(
    fields: StructArgument<NewFields, Variants>,
    annotations?: ClassAnnotations<Extended, Default, MergeFields<Fields, StructInputFields<NewFields>>> | undefined
  ) => ClassShape<
    Extended,
    Variants,
    Default,
    MergeFields<Fields, StructInputFields<NewFields>>,
    Static,
    Self & InheritedBrand
  >;

  readonly fields: S["fields"];

  make<Args extends Array<unknown>, X>(this: { new (...args: Args): X }, ...args: Args): X;

  mapFields<To extends Struct.Fields>(
    f: (fields: Struct_.Simplify<Fields>) => To,
    options?:
      | {
          readonly unsafePreserveChecks?: boolean | undefined;
        }
      | undefined
  ): Struct<Struct_.Simplify<Readonly<To>>>;
  new (
    props: S["~type.make.in"],
    options?:
      | {
          readonly disableChecks?: boolean;
        }
      | undefined
  ): S["Type"] & Inherited;
}

type MissingSelfGeneric<Params extends string = ""> =
  `Missing \`Self\` generic - use \`class Self extends Class<Self>()(${Params}{ ... })\``;

type StructInput = Struct.Fields | AnyStruct;

type StructInputFields<A extends StructInput> =
  A extends Struct<infer Fields> ? Fields : A extends Struct.Fields ? A : never;

type StructArgument<A extends StructInput, Variants extends string> = A extends AnyStruct
  ? A
  : A & Struct.Validate<A, Variants>;

type MergeFields<Defaults extends Struct.Fields, Fields extends Struct.Fields> = Struct_.Simplify<
  Omit<Defaults, keyof Fields> & Fields
>;

type ClassAnnotations<Self, Default extends string, Fields extends Struct.Fields> = S.Annotations.Declaration<
  Self,
  readonly [S.Struct<ExtractFields<Default, Fields, true>>]
>;

type ClassVariantStatics<Variants extends string, Default extends Variants, Fields extends Struct.Fields> = {
  readonly [V in Variants]: Extract<V, Struct<Fields>, V extends Default ? true : false>;
};

type InheritStaticMembers<C, Static> = C & Pick<Static, Exclude<keyof Static, keyof C>>;

type ClassShape<
  Self,
  Variants extends string,
  Default extends Variants,
  Fields extends Struct.Fields,
  Static = {},
  Inherited = {},
> = [Self] extends [never]
  ? MissingSelfGeneric
  : InheritStaticMembers<
      Class<Self, Fields, S.Struct<ExtractFields<Default, Fields, true>>, Variants, Default, Inherited> &
        ClassVariantStatics<Variants, Default, Fields>,
      Static
    >;

/**
 * Variant-aware union schema with per-variant schema projections.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { make } from "@beep/schema/VariantSchema"
 *
 * const Variant = make({ variants: ["read", "write"], defaultVariant: "read" })
 * const Account = Variant.Struct({ id: S.String })
 * const union = Variant.Union([Account])
 * console.log(S.isSchema(union))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface Union<Members extends ReadonlyArray<AnyStruct>>
  extends S.Union<{
    readonly [K in keyof Members]: [Members[K]] extends [S.Top] ? Members[K] : never;
  }> {}

/**
 * Type helpers for variant-aware union schemas.
 *
 * @example
 * ```ts
 * import { make } from "@beep/schema/VariantSchema"
 *
 * const Variant = make({ variants: ["read", "write"], defaultVariant: "read" })
 * const Account = Variant.Struct({})
 * console.log(Object.keys(Variant.Union([Account])))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export declare namespace Union {
  /**
   * @since 0.0.0
   * @category models
   */
  export type Variants<Members extends ReadonlyArray<AnyStruct>, Variants extends string> = {
    readonly [Variant in Variants]: S.Union<{
      [K in keyof Members]: Extract<Variant, Members[K]>;
    }>;
  };
}

type MakeApi<Variants extends string, Default extends Variants> = {
  readonly Struct: <const A extends Struct.Fields>(fields: A & Struct.Validate<A, Variants>) => Struct<A>;
  readonly Field: <const A extends Field.ConfigWithKeys<Variants>>(
    config: A & { readonly [K in Exclude<keyof A, Variants>]: never }
  ) => Field<A>;
  readonly FieldOnly: <const Keys extends ReadonlyArray<Variants>>(
    keys: Keys
  ) => <S extends S.Top>(schema: S) => Field<{ readonly [K in Keys[number]]: S }>;
  readonly FieldExcept: <const Keys extends ReadonlyArray<Variants>>(
    keys: Keys
  ) => <S extends S.Top>(schema: S) => Field<{ readonly [K in Exclude<Variants, Keys[number]>]: S }>;
  readonly fieldEvolve: {
    <
      Self extends AnyField | S.Top,
      const Mapping extends Self extends Field<infer S>
        ? { readonly [K in keyof S]?: (variant: S[K]) => S.Top }
        : { readonly [K in Variants]?: (variant: Self) => S.Top },
    >(
      f: Mapping
    ): (self: Self) => Field<
      Self extends Field<infer S>
        ? {
            readonly [K in keyof S]: K extends keyof Mapping
              ? Mapping[K] extends UnknownFunction
                ? ReturnType<Mapping[K]>
                : S[K]
              : S[K];
          }
        : {
            readonly [K in Variants]: K extends keyof Mapping
              ? Mapping[K] extends UnknownFunction
                ? ReturnType<Mapping[K]>
                : Self
              : Self;
          }
    >;
    <
      Self extends AnyField | S.Top,
      const Mapping extends Self extends Field<infer S>
        ? {
            readonly [K in keyof S]?: (variant: S[K]) => S.Top;
          }
        : { readonly [K in Variants]?: (variant: Self) => S.Top },
    >(
      self: Self,
      f: Mapping
    ): Field<
      Self extends Field<infer S>
        ? {
            readonly [K in keyof S]: K extends keyof Mapping
              ? Mapping[K] extends UnknownFunction
                ? ReturnType<Mapping[K]>
                : S[K]
              : S[K];
          }
        : {
            readonly [K in Variants]: K extends keyof Mapping
              ? Mapping[K] extends UnknownFunction
                ? ReturnType<Mapping[K]>
                : Self
              : Self;
          }
    >;
  };
  readonly Class: <Self = never>(
    identifier: string
  ) => <const Fields extends StructInput>(
    fields: StructArgument<Fields, Variants>,
    annotations?: ClassAnnotations<Self, Default, StructInputFields<Fields>> | undefined
  ) => ClassShape<Self, Variants, Default, StructInputFields<Fields>>;
  readonly Union: <const Members extends ReadonlyArray<AnyStruct>>(
    members: Members
  ) => Union<Members> & Union.Variants<Members, Variants>;
  readonly extract: {
    <V extends Variants>(variant: V): <A extends AnyStruct>(self: A) => Extract<V, A, V extends Default ? true : false>;
    <V extends Variants, A extends AnyStruct>(self: A, variant: V): Extract<V, A, V extends Default ? true : false>;
  };
};

/**
 * Creates a variant schema API for a fixed set of variant names.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { make } from "@beep/schema/VariantSchema"
 *
 * const Variant = make({ variants: ["read", "write"], defaultVariant: "read" })
 * const Account = Variant.Struct({ id: S.String, notes: Variant.FieldOnly(["write"])(S.String) })
 * console.log(Object.keys(Variant.extract(Account, "write").fields))
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const make = <const Variants extends ReadonlyArray<string>, const Default extends Variants[number]>(options: {
  readonly variants: Variants;
  readonly defaultVariant: Default;
}): MakeApi<Variants[number], Default> => {
  const normalizeStruct = (fields: StructInput): AnyStruct => (isStruct(fields) ? fields : Struct(fields));
  const mergeVariantStructs = (base: AnyStruct, fields: StructInput): AnyStruct =>
    Struct({
      ...base[TypeId],
      ...normalizeStruct(fields)[TypeId],
    });
  const ClassFactory = S.Class as unknown as SchemaClassFactory;
  const attachClass = (
    base: ClassBase,
    identifier: string,
    variantStruct: AnyStruct,
    baseExtend: ClassBase["extend"]
  ) => {
    Object.defineProperty(base, TypeId, {
      value: variantStruct[TypeId],
      configurable: true,
    });
    Object.defineProperty(base, "mapFields", {
      value: function (
        this: AnyStruct,
        f: (fields: Struct.Fields) => Struct.Fields,
        _options?:
          | {
              readonly unsafePreserveChecks?: boolean | undefined;
            }
          | undefined
      ) {
        return Struct(f(this[TypeId]));
      },
      configurable: true,
    });
    Object.defineProperty(base, "extend", {
      value: function (this: AnyStruct, childIdentifier: string) {
        return (fields: StructInput, annotations?: unknown) => {
          const childStruct = mergeVariantStructs(Struct(this[TypeId]), fields);
          const schema = extract(childStruct, options.defaultVariant, {
            isDefault: true,
          });
          const child = baseExtend.call(this, childIdentifier)(schema.fields, annotations);
          return attachClass(child, childIdentifier, childStruct, child.extend);
        };
      },
      configurable: true,
    });
    for (const variant of options.variants) {
      Object.defineProperty(base, variant, {
        value: extract(variantStruct, variant).annotate({
          id: `${identifier}.${variant}`,
          title: `${identifier}.${variant}`,
        }),
        configurable: true,
      });
    }
    return base;
  };
  function Class<Self>(identifier: string) {
    return (fields: StructInput, annotations?: ClassAnnotations<Self, Default, StructInputFields<typeof fields>>) => {
      const variantStruct = normalizeStruct(fields);
      const schema = extract(variantStruct, options.defaultVariant, {
        isDefault: true,
      });
      const Base = ClassFactory(identifier)(schema, annotations);
      return attachClass(Base, identifier, variantStruct, Base.extend);
    };
  }
  function FieldOnly<const Keys extends ReadonlyArray<Variants[number]>>(keys: Keys) {
    return <S extends S.Top>(schema: S) => {
      const obj: Record<string, S> = {};
      for (const key of keys) {
        obj[key] = schema;
      }
      return Field(obj);
    };
  }
  function FieldExcept<const Keys extends ReadonlyArray<Variants[number]>>(keys: Keys) {
    return <S extends S.Top>(schema: S) => {
      const obj: Record<string, S> = {};
      for (const variant of options.variants) {
        if (!A.contains(keys, variant)) {
          obj[variant] = schema;
        }
      }
      return Field(obj);
    };
  }
  function UnionVariants(members: ReadonlyArray<AnyStruct>) {
    return Union(members, options.variants);
  }
  const fieldEvolve = dual(
    2,
    (self: AnyField | S.Top, f: Record<string, (schema: S.Top | undefined) => S.Top | undefined>): AnyField => {
      const field = isField(self)
        ? self
        : Field(R.fromEntries(A.map(options.variants, (variant) => [variant, self] as const)));
      const evolved: Record<string, S.Top | undefined> = {};
      for (const key of R.keys(field.schemas)) {
        const evolve = f[key];
        const schema = field.schemas[key];
        evolved[key] = evolve === undefined ? schema : evolve(schema);
      }
      return Field(evolved);
    }
  );
  const extractVariants = dual(
    2,
    (self: AnyStruct, variant: string): S.Top =>
      extract(self, variant, {
        isDefault: variant === options.defaultVariant,
      })
  );
  return {
    Struct,
    Field,
    FieldOnly,
    FieldExcept,
    Class,
    Union: UnionVariants,
    fieldEvolve,
    // fieldFromKey,
    extract: extractVariants,
  } as unknown as MakeApi<Variants[number], Default>;
};

const Struct = <const A extends Field.Fields>(fields: A): Struct<A> =>
  ({
    [TypeId]: fields,
    pipe() {
      return pipeArguments(this, arguments);
    },
  }) satisfies Struct<A>;

const Field = <const A extends Field.Config>(schemas: A): Field<A> =>
  ({
    schemas,
    [FieldTypeId]: FieldTypeId,
    pipe() {
      return pipeArguments(this, arguments);
    },
  }) satisfies Field<A>;

const Union = <Members extends ReadonlyArray<AnyStruct>, Variants extends ReadonlyArray<string>>(
  members: Members,
  variants: Variants
) => {
  const VariantUnion = S.Union(A.filter(members, (member): member is Members[number] & S.Top => S.isSchema(member)));
  for (const variant of variants) {
    Object.defineProperty(VariantUnion, variant, {
      value: S.Union(A.map(members, (member) => extract(member, variant))),
    });
  }
  return VariantUnion;
};
