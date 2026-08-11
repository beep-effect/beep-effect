# Effect v4 schema levers for a schema-to-SQL DSL

## Scope and source state

This report is based on the vendored source under `.repos/effect`, not Effect v3 memory or the installed package. The workspace pins `effect` **4.0.0-beta.104** and `drizzle-orm` **1.0.0-rc.4-fb12281** (`package.json:184-187`), while the vendored Effect package declares **4.0.0-beta.105** (`.repos/effect/packages/effect/package.json:1-5`). That one-beta mismatch matters: the types and runtime behavior described below are the beta.105 subtree source requested as ground truth, while code compiled against the root dependency resolves beta.104 unless the workspace aliases the subtree.

Subtree provenance is not a single clean upstream commit at current `HEAD`:

- repository `HEAD`: `7de49674756e76cdd4fa3864a13cb6a38b79ffb1`;
- current `.repos/effect` Git tree: `b8b3d6265b2951f3cedb7ce1c5c48c93a9bdec33`;
- last commit with a proper subtree trailer: `d1dfc4b3c1b4e4838157a23086a5b1be72f59886`, recording `git-subtree-split: 931f5737490e54f682c473abdf4bf046ac9ffd34` and beta.103;
- commit `152b9908e5339d810b5923e8e65aaac62b846017` subsequently changed 281 files in `.repos/effect`, produced the current tree, and has no subtree trailer. No later commit changes the subtree.

The package's public exports include stable `./*` modules plus the `effect/unstable/schema` and `effect/unstable/sql` barrels (`.repos/effect/packages/effect/package.json:29-56`, published equivalents at `:71-98`). The canonical imports used below are therefore:

```ts
import * as S from "effect/Schema"
import * as AST from "effect/SchemaAST"
import * as Representation from "effect/SchemaRepresentation"
import * as Pipeable from "effect/Pipeable"
import { Model, VariantSchema } from "effect/unstable/schema"
import { SqlModel, SqlSchema } from "effect/unstable/sql"
```

The unstable barrels export those modules as namespaces (`.repos/effect/packages/effect/src/unstable/schema/index.ts:5-15`, `.repos/effect/packages/effect/src/unstable/sql/index.ts:5-40`). Direct paths such as `effect/unstable/schema/VariantSchema` also match the package's `./*` export, but the barrel is the source's own usage and is less coupled to file layout.

## 1. Core `effect/Schema` protocol

### 1.1 `Schema<T>`, `Codec<T, E, RD, RE>`, `Top`, and the full protocol

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:148-188`, `:742-803`, `:938-941`, `:1038-1043`

```ts
export interface Schema<out T> extends Top {
  readonly "Type": T
  readonly "Rebuild": Schema<T>
}

export interface Codec<out T, out E = T, out RD = never, out RE = never> extends Top {
  readonly "Type": T
  readonly "Encoded": E
  readonly "DecodingServices": RD
  readonly "EncodingServices": RE
  readonly "Rebuild": Codec<T, E, RD, RE>
}

export interface Top extends Bottom<
  unknown, unknown, unknown, unknown, AST.AST, Top, unknown, unknown,
  any, unknown, Mutability, Optionality, ConstructorDefault,
  Mutability, Optionality
> {}

export interface Constraint {
  readonly ast: AST.AST
  readonly Type: unknown
  readonly Encoded: unknown
  readonly DecodingServices: unknown
  readonly EncodingServices: unknown
  readonly "~type.make.in": unknown
  readonly "~type.optionality": Optionality
  readonly "~type.mutability": Mutability
  readonly "~type.constructor.default": ConstructorDefault
  readonly "~encoded.optionality": Optionality
  readonly "~encoded.mutability": Mutability
}
```

`Schema<T>` deliberately remembers only the decoded type. `Codec<T, E, RD, RE>` preserves both sides and their service requirements, while `Top` existentially erases everything. The actual schema protocol is `BottomWithoutNew`: in addition to `ast`, type/encoded views, modifiers, constructor input, and `Rebuild`, it extends `Pipeable` and exposes `annotate`, `annotateKey`, `check`, `rebuild`, `make`, `makeOption`, and `makeEffect` (`Schema.ts:148-188`, `:215-257`). `Constraint` is the lighter read-only bound; use it when a DSL only inspects a schema and does not call protocol methods.

**DSL use:** Make `Field<S extends S.Constraint, M>` retain the exact `S`, not merely `S.Schema<S["Type"]>` or `S.Top`. That preserves encoded type, modifier flags, services, and concrete schema identity for compatibility predicates. Accept `Constraint` in read-only compiler functions and require `Top` only where the compiler actually rebuilds or annotates.

### 1.2 `Rebuild` and the concrete static schema type

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:148-189`, `.repos/effect/packages/effect/src/internal/schema/schema.ts:49-77`

```ts
interface BottomWithoutNew<..., out Rebuild extends Top, ...> extends Pipeable.Pipeable {
  readonly ast: Ast
  readonly Rebuild: Rebuild
  annotate(...): this["Rebuild"]
  annotateKey(...): this["Rebuild"]
  check(...): this["Rebuild"]
  rebuild(ast: this["ast"]): this["Rebuild"]
}

export function make<S extends Schema.Constraint>(ast: S["ast"], options?: object): S
```

The runtime `make` stores the passed `options` and reuses them from `rebuild`; that is how specialized values retain properties such as `.fields`, `.members`, or `.schema`. `Rebuild` is therefore the type-level hook that keeps a concrete schema family after ordinary annotations/checks, although it does not make arbitrary annotations visible as a new generic parameter.

**DSL use:** A SQL combinator can preserve a wrapped schema's precise family by returning `Field<S["Rebuild"], NewMeta>` when it rebuilds an AST. Do not erase to `S.Schema<T>`: `S.Int` and other special schemas carry more useful static identity through `Rebuild` even when their decoded `Type` is just `number`.

### 1.3 `S.Struct` fields and independent type/encoded modifiers

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:3293-3435`, `:3444-3511`, `:3546-3548`

```ts
export declare namespace Struct {
  export type Fields = { readonly [x: PropertyKey]: Constraint }
  export type Type<F extends Fields> = View<F, "Type">
  export type Encoded<F extends Fields> = View<F, "Encoded">
  export type MakeIn<F extends Fields> = MakeInView<F>
}

export interface Struct<Fields extends Struct.Fields>
  extends BottomLazy<AST.Objects, Struct<Fields>> {
  readonly Type: Struct.Type<Fields>
  readonly Encoded: Struct.Encoded<Fields>
  readonly "~type.make.in": Struct.MakeIn<Fields>
  readonly fields: Fields
  mapFields<To extends Struct.Fields>(
    f: (fields: Fields) => To,
    options?: { readonly unsafePreserveChecks?: boolean }
  ): Struct<Simplify<Readonly<To>>>
}

export function Struct<const Fields extends Struct.Fields>(fields: Fields): Struct<Fields>
```

`Struct.Type` and `Struct.Encoded` compute optional and mutable keys independently from `~type.*` and `~encoded.*` flags (`Schema.ts:3302-3351`). Constructor input additionally makes fields optional when their type side is optional or constructor-defaulted (`:3412-3435`). `.fields` is the lossless, statically typed field map and should be preferred over reverse-engineering a `Struct` AST when available.

`mapFields` builds a fresh `AST.Objects`; it drops root annotations and, by default, checks. `unsafePreserveChecks` copies only checks and explicitly cannot prove that object-wide refinements remain valid (`Schema.ts:3474-3511`).

**DSL use:** Derive the Drizzle select/insert/update row types directly from the retained field map and each field's `Type`, `Encoded`, and modifier flags. Use `.fields` as the primary compiler input, with AST traversal as the runtime validation/backstop. If a SQL transformation maps fields, reattach any intentional root metadata explicitly rather than assuming `mapFields` preserved it.

### 1.4 Optional and mutable keys

**Import:** `effect/Schema` and `effect/SchemaAST`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:2363-2479`, `:2510-2565`; `.repos/effect/packages/effect/src/SchemaAST.ts:576-594`, `:3423-3469`, `:3571-3577`

```ts
export interface optionalKey<S extends Constraint> extends BottomLazy<...> {
  readonly "~type.optionality": "optional"
  readonly "~encoded.optionality": "optional"
  readonly schema: S
}
export const optionalKey: ...

export interface optional<S extends Constraint> extends optionalKey<UndefinedOr<S>> {}
export const optional = ... // optionalKey(UndefinedOr(self))

export interface mutableKey<S extends Constraint> extends BottomLazy<...> {
  readonly "~type.mutability": "mutable"
  readonly "~encoded.mutability": "mutable"
  readonly schema: S
}

export function AST.isOptional(ast: AST.AST): boolean
```

The modifiers live on `ast.context`: `Context` contains `isOptional`, `isMutable`, `constructorDefault`, and key-level `annotations`. `optionalKey` means an absent key but does not add `undefined` to the value; `optional` is exactly `optionalKey(UndefinedOr(S))`. Modifier functions also propagate through the last encoding link, allowing type-side and encoded-side projections to report different key semantics after transformations.

**DSL use:** Treat SQL `NULL`, SQL insert omission, and TypeScript optional keys as three separate axes. Use `AST.isOptional(AST.toEncoded(field.ast))` for whether a driver input key may be omitted, a `Null` union member for column nullability, and `context.constructorDefault`/explicit SQL metadata for defaultability. Never infer `NULL` from `optionalKey` alone.

### 1.5 `S.Class`: opaque decoded identity with transparent fields

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:13942-14035`, `:14045-14141`, `:14161-14206`, `:14285-14313`

```ts
export interface Class<
  Self,
  S extends Constraint & { readonly fields: Struct.Fields },
  Inherited
> extends BottomLazyWithoutNew<AST.Declaration, decodeTo<declareConstructor<...>, S>, ...> {
  readonly Type: Self
  readonly Encoded: S["Encoded"]
  readonly fields: S["fields"]
  new(...args: ...): S["Type"] & Inherited
  extend<Extended = never, Static = {}, Brand = {}>(identifier: string): { ... }
}

export const Class: {
  <Self = never, Brand = {}>(identifier: string): {
    <const Fields extends Struct.Fields>(fields: Fields, annotations?: ...): Class<Self, Struct<Fields>, Brand>
    <S extends Struct<Struct.Fields>>(schema: S, annotations?: ...): Class<Self, S, Brand>
  }
}
```

A class's decoded root is an opaque `AST.Declaration`, parameterized by the underlying struct AST, then connected to the struct through `decodeTo`. Runtime construction calls `struct.make`; static `.fields` is exactly the original field map. `.extend` merges fields and combines base/extension checks, while the outer class stays nominal through `Self` and a runtime class marker. The class protocol's `Rebuild` is the underlying `decodeTo<...>` schema rather than the class constructor, so calling `.annotate` or `.check` on the finished class returns a schema view without class statics such as `.fields`/`.extend`; supply class annotations/checks through the constructor/extension inputs when those statics must remain available.

If forced to inspect a class from AST only, `Declaration.typeParameters[0]` is its underlying struct. Prefer `.fields`; it avoids relying on the declaration's internal constructor annotation and remains fully typed.

**DSL use:** Accept model classes without sacrificing structural SQL derivation: use `Model.fields`/`.fields` for columns, preserve `Self` for select results, and use the underlying field codecs' `Encoded` forms for drivers. A class is a good domain boundary, but it should not itself be treated as a SQL scalar declaration.

### 1.6 `S.Opaque`: nominal type without a runtime wrapper

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:6394-6443`

```ts
export interface Opaque<Self, S extends Top, Brand> extends BottomLazyWithoutNew<...> {
  readonly Type: Self
  readonly Encoded: S["Encoded"]
  new(_: never): S["Type"] & Brand
}

export function Opaque<Self, Brand = {}>() {
  return <S extends Top>(schema: S): Opaque<Self, S, Brand> & Omit<S, keyof Top> => schema as any
}
```

`Opaque` is a zero-runtime cast: it returns the same schema object while replacing the public decoded type with `Self` and retaining the schema's non-protocol static members. Unlike `Class`, it adds no declaration layer or constructed instance. Its `Rebuild` is the underlying `S["Rebuild"]`, however, so a later protocol rebuild such as `.annotate` or `.check` is typed as the underlying schema and can discard the opaque `Self` view.

**DSL use:** Use `Opaque` when a nominal row or value type is desirable but SQL reflection should see the original `Struct`/scalar AST unchanged. Apply ordinary schema rebuilding before `Opaque`, or provide wrapper-aware combinators that reapply the cast, because post-opaque rebuilds lose the nominal type statically.

### 1.7 `S.suspend`, `S.brand`, `S.check`, and `S.refine`

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:5031-5079`, `:5100-5155`, `:5165-5209`; `.repos/effect/packages/effect/src/SchemaAST.ts:3012-3048`, `:3075-3158`

```ts
export function suspend<S extends Constraint>(f: () => S): suspend<S>

export function check<S extends Top>(
  ...checks: readonly [AST.Check<S["Type"]>, ...Array<AST.Check<S["Type"]>>]
): (self: S) => S["Rebuild"]

export function refine<S extends Constraint, T extends S["Type"]>(
  refinement: (value: S["Type"]) => value is T,
  annotations?: Annotations.Filter
): (schema: S) => refine<T, S>

export function brand<B extends string>(identifier: B):
  <S extends ConstraintRebuildable>(schema: S) => brand<S["Rebuild"], B>

export type AST.Check<T> = AST.Filter<T> | AST.FilterGroup<T>
```

`suspend` creates a memoized `AST.Suspend` thunk and is the recursive-schema escape hatch; `Suspend` rejects attached checks. `check` appends runtime checks without narrowing the TypeScript type. `refine` appends a guard filter and narrows the decoded type. `brand` narrows the decoded type and attaches a `brands` annotation but adds no runtime validation.

Checks are explicit objects: `Filter` has `_tag`, `run`, `annotations`, and `aborted`; `FilterGroup` has nested non-empty `checks` plus group annotations (`SchemaAST.ts:3075-3158`). This is much more inspectable than v3-era opaque refinements when a built-in check supplies representation metadata.

**DSL use:** Unwrap `Suspend` with cycle detection when compiling recursive JSON columns or named references. Use built-in check representation IDs as optional DDL hints, but never treat a custom `refine` closure as a portable SQL constraint unless the DSL adds its own explicit, persistable metadata. Brand affects nominal application types, not the SQL physical type.

### 1.8 Constructor and decoding defaults

**Import:** `effect/Schema`, `effect/SchemaAST`, `effect/SchemaGetter`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:5740-5795`, `:5809-6032`; `.repos/effect/packages/effect/src/SchemaAST.ts:3473-3485`; `.repos/effect/packages/effect/src/SchemaGetter.ts:64-91`, `:662-668`

```ts
export function withConstructorDefault<S extends Constraint & WithoutConstructorDefault>(
  defaultValue: Effect.Effect<S["~type.make.in"], SchemaIssue.Issue>
): (schema: S) => withConstructorDefault<S>

export function withDecodingDefaultKey<S extends Constraint, R = never>(
  defaultValue: Effect.Effect<S["Encoded"], SchemaError, R>,
  options?: { readonly encodingStrategy?: "omit" | "passthrough" }
): (self: S) => withDecodingDefaultKey<S, R>

export function withDecodingDefault<S extends Constraint, R = never>(
  defaultValue: Effect.Effect<S["Encoded"], SchemaError, R>,
  options?: DecodingDefaultOptions
): (self: S) => withDecodingDefault<S, R>
```

A constructor default is type-visible as `~type.constructor.default: "with-default"` and runtime-visible as `ast.context.constructorDefault: Link`; it affects only `make*`, not decoding or encoding. Decoding defaults instead build an optional encoded-side schema plus a `decodeTo` transformation whose `SchemaGetter.withDefault` is just a closure. `withDecodingDefaultKey` defaults only absent keys; `withDecodingDefault` defaults absent keys or present `undefined`; `withDecodingDefaultTypeKey` and `withDecodingDefaultType` accept decoded values instead (`Schema.ts:5883-5920`, `:5990-6032`).

There is no public semantic tag saying a transformation is a decoding default: `Getter` only exposes `run`, and `Transformation` exposes getter objects. Reflection can reliably recognize optional encoded keys but not distinguish the default from another optional transformation.

**DSL use:** Reflect constructor defaults only as application-construction behavior. Carry SQL `DEFAULT`/generated expressions explicitly in `Field` metadata; do not guess them from decoding transformations. The wrapper can also statically forbid incompatible combinations such as an application-only constructor default marked as a database-generated default.

## 2. AST introspection

### 2.1 The complete AST node algebra

**Import:** `effect/SchemaAST`
**Source:** `.repos/effect/packages/effect/src/SchemaAST.ts:45-77`, `:636-658`

```ts
export type AST =
  | Declaration | Null | Undefined | Void | Never | Unknown | Any
  | String | Number | Boolean | BigInt | Symbol | Literal | UniqueSymbol
  | ObjectKeyword | Enum | TemplateLiteral | Arrays | Objects | Union | Suspend

export abstract class Base {
  abstract readonly _tag: string
  readonly annotations: S.Annotations.Annotations | undefined
  readonly checks: Checks | undefined
  readonly encoding: Encoding | undefined
  readonly context: Context | undefined
}
```

Every node is discriminated by `_tag`; public guards exist for every variant, including `isDeclaration`, `isObjects`, `isUnion`, `isSuspend`, `isNull`, and `isEnum` (`SchemaAST.ts:76-380`). There is no exported general visitor. A compiler must switch on `_tag` and recurse through the fields described below.

**DSL use:** Build one exhaustive AST classifier with a `never` exhaustiveness check. Keep physical SQL type selection centralized there, rather than distributing ad-hoc `instanceof` or decoded-Type tests across column helpers.

### 2.2 Decoded side versus encoded side: `encoding`, `toType`, and `toEncoded`

**Import:** `effect/SchemaAST` and `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/SchemaAST.ts:401-432`, `:3619-3668`, `:3705-3711`; `.repos/effect/packages/effect/src/Schema.ts:2573-2649`

```ts
export class Link {
  readonly to: AST
  readonly transformation: Transformation<any, any, any, any> | Middleware<any, ...>
}
export type Encoding = readonly [Link, ...Array<Link>]

export const toType: <A extends AST>(ast: A) => A
export const toEncoded: (ast: AST) => AST // toType(flip(ast))

export const S.toType: ...
export const S.toEncoded: ...
```

The root AST describes the decoded/type side; `Base.encoding` is a non-empty link chain toward the encoded representation. `AST.toType` recursively strips encoding transformations, while `AST.toEncoded` flips the chain and strips it, recursively handling declarations, arrays, objects, unions, and suspensions. The schema-level `S.toType` and `S.toEncoded` return schemas whose `Type` and `Encoded` agree with the selected side.

**DSL use:** SQL columns should normally classify `AST.toEncoded(field.ast)`, because database drivers consume the encoded representation. Retain a decoded projection in parallel for application semantics such as `Option`, brands, and class identity. This prevents mistakes such as mapping `S.DateTimeUtcFromDate` from its decoded `DateTime.Utc` declaration instead of its encoded JavaScript `Date`.

### 2.3 Structural nodes and exact recursion edges

**Import:** `effect/SchemaAST`
**Source:** `.repos/effect/packages/effect/src/SchemaAST.ts:679-701`, `:1135-1172`, `:1295-1311`, `:1677-1698`, `:1968-2046`, `:2091-2110`, `:2781-2800`, `:3012-3048`

```ts
class Declaration extends Base {
  readonly typeParameters: ReadonlyArray<AST>
  readonly encodingChecks: Checks | undefined
}
class TemplateLiteral extends Base { readonly parts: ReadonlyArray<AST> }
class Literal extends Base { readonly literal: LiteralValue }
class Arrays extends Base {
  readonly isMutable: boolean
  readonly elements: ReadonlyArray<AST>
  readonly rest: ReadonlyArray<AST>
  readonly encodingChecks: Checks | undefined
}
class PropertySignature { readonly name: PropertyKey; readonly type: AST }
class IndexSignature { readonly parameter: AST; readonly type: AST }
class Objects extends Base {
  readonly propertySignatures: ReadonlyArray<PropertySignature>
  readonly indexSignatures: ReadonlyArray<IndexSignature>
  readonly encodingChecks: Checks | undefined
}
class Union<A extends AST = AST> extends Base {
  readonly types: ReadonlyArray<A>
  readonly mode: "anyOf" | "oneOf"
  readonly encodingChecks: Checks | undefined
}
class Suspend extends Base { readonly thunk: () => AST }
```

`Declaration.typeParameters`, template `parts`, array `elements`/`rest`, object property/index signatures, union `types`, and the suspended `thunk()` are the traversal edges. `TemplateLiteral` also computes internal encoded parts by calling `toEncoded` on each part. `Enum` is distinct from literal unions and exposes `enums: ReadonlyArray<readonly [name, string | number]>` (`SchemaAST.ts:1042-1096`).

**DSL use:** The compiler can extract literal SQL enums from a single `Literal`, a `Union` whose flattened leaves are all `Literal`, or `Enum.enums`. Template literals are not finite enums unless every part is finite; otherwise use them as validation/check metadata or require an explicit SQL representation.

### 2.4 Field keys, optionality, mutability, and constructor defaults

**Import:** `effect/SchemaAST`
**Source:** `.repos/effect/packages/effect/src/SchemaAST.ts:560-595`, `:1955-1978`, `:3423-3485`, `:3571-3577`

```ts
export class Context {
  readonly isOptional: boolean
  readonly isMutable: boolean
  readonly constructorDefault: Link | undefined
  readonly annotations: S.Annotations.Key<unknown> | undefined
}

export function isOptional(ast: AST): boolean
```

An `Objects.propertySignatures[i]` has only `name` and `type`; all key modifiers are carried by the field type's `context`. `optionalKey` and `mutableKey` update that context, including the final encoded link. Constructor defaults also live in the same context as a transformation link.

**DSL use:** Read the modifier context from each selected side independently. A useful normalized field descriptor is `{ key, decodedAst, encodedAst, typeOptional, encodedOptional, mutable, constructorDefault, keyAnnotations }`; column nullability is a separate property computed from `encodedAst`.

### 2.5 Detecting SQL nullability and `NullOr`

**Import:** `effect/Schema`, `effect/SchemaAST`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:4962-5023`; `.repos/effect/packages/effect/src/SchemaAST.ts:53-74`, `:2781-2800`

```ts
export interface NullOr<S extends Constraint> extends Union<readonly [S, Null]> {}
export const NullOr = ... // Union([self, Null])
export interface NullishOr<S extends Constraint> extends Union<readonly [S, Null, Undefined]> {}
```

There is no dedicated `NullOr` AST node: it is a `Union` containing the singleton `Null` node. A robust detector should flatten nested unions and check for `_tag === "Null"` on the encoded side. `Undefined` is not SQL `NULL`; it normally signals omitted or invalid driver values and must be treated separately.

**DSL use:** Derive `.notNull()` only when the encoded-side union has no `Null` member. If a nullable union has multiple non-null physical families, require explicit metadata rather than choosing a column type from the first branch.

### 2.6 Detecting `Option`-valued fields

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:9556-9566`, `:9589-9650`, `:9679-9820`

```ts
export interface Option<A extends Constraint> extends declareConstructor<
  Option.Option<A["Type"]>, Option.Option<A["Encoded"]>, readonly [A], OptionIso<A>
> {
  readonly value: A
}

export function Option<A extends Constraint>(value: A): Option<A>
// Declaration annotation:
representation: { id: "effect/schema/Option", payload: null }

export function OptionFromNullOr<S extends Constraint>(schema: S): OptionFromNullOr<S>
export function OptionFromOptionalKey<S extends Constraint>(schema: S): OptionFromOptionalKey<S>
```

Direct `S.Option(A)` is a `Declaration` with a stable representation ID and a type parameter for `A`; the schema value also exposes `.value`. Conversion helpers such as `OptionFromNullOr` have decoded `Option` but encoded `T | null`, and optional helpers can encode `None` as a missing key.

**DSL use:** Detect application `Option` on the decoded side via `.value` when statically available or `Declaration` plus `declaration.annotations?.representation?.id === "effect/schema/Option"`. Read this declaration identity directly: generic `AST.resolve` can be redirected to a last check. Derive SQL nullability from the encoded side, not from the presence of `Option`: `OptionFromNullOr` is nullable, while a direct encoded `Option` is an opaque declaration unless a column codec is explicitly supplied.

### 2.7 Literal unions, enums, and template literals

**Import:** `effect/Schema`, `effect/SchemaAST`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:2770-2882`, `:4934-4934`; `.repos/effect/packages/effect/src/SchemaAST.ts:1042-1096`, `:1122-1172`, `:1295-1311`

```ts
export interface TemplateLiteral<Parts extends TemplateLiteral.Parts> extends ... {}
export function TemplateLiteral<const Parts extends TemplateLiteral.Parts>(parts: Parts): TemplateLiteral<Parts>

class Literal extends Base { readonly literal: LiteralValue }
class Enum extends Base { readonly enums: ReadonlyArray<readonly [string, string | number]> }
class TemplateLiteral extends Base { readonly parts: ReadonlyArray<AST> }
```

`TemplateLiteral` parts may be string, number, bigint, literal, nested template literal, or unions of valid parts. It represents a patterned string family, not necessarily a finite literal domain. `Literals([...])` lowers to literals/a union, while TypeScript enums retain the dedicated `Enum` shape.

**DSL use:** Use finite literal sets for dialect-native enums or `CHECK IN (...)`; use template literals for schema-time validation of identifiers, prefixed IDs, or SQL names, but do not synthesize a finite SQL enum from an open template. Metadata can explicitly select text/varchar storage while the schema keeps the stronger application pattern.

### 2.8 Brands and refinements/check constraints

**Import:** `effect/SchemaAST`, `effect/SchemaRepresentation`
**Source:** `.repos/effect/packages/effect/src/SchemaAST.ts:3054-3170`, `:3186-3269`, `:3309-3335`, `:3395-3400`; `.repos/effect/packages/effect/src/SchemaRepresentation.ts:19-38`, `:424-456`

```ts
export interface RepresentationAnnotation {
  readonly id: string
  readonly payload: S.Json
}
export interface CheckRepresentationAnnotation<X> extends RepresentationAnnotation {
  readonly schemas?: ReadonlyArray<X>
}

export type Check<T> = Filter<T> | FilterGroup<T>
```

Built-in checks attach stable `annotations.representation = { id, payload }`. Examples include `effect/schema/isInt` with `null` payload (`Schema.ts:8201-8219`), numeric bounds with `minimum`, `maximum`, `exclusiveMinimum`, or `exclusiveMaximum` payloads (`Schema.ts:7872-8102`), `isMultipleOf` with `{ divisor }` (`:8149-8161`), and string/array length checks with `{ minLength }`, `{ maxLength }`, or both (`:8783-8803`, `:8869-8889`, `:8932-8960`). `isPattern` records `{ source, flags }` (`SchemaAST.ts:3247-3269`).

Brands are just `brands` annotations placed through `AST.annotate`. Because `annotate` writes to the last check when checks exist, a brand may live on a check rather than `Base.annotations`. A complete inspector must scan base annotations and every filter/filter-group annotation; `AST.resolve` intentionally reports only the currently resolved annotation layer.

`isMaxLength` applies to strings **and arrays**, so `varchar(n)` is valid only after the underlying encoded node is classified as `String`. Numeric bound checks can become SQL `CHECK` clauses only when their payload and physical numeric representation agree.

**DSL use:** Normalize built-in check IDs into optional column hints and DDL constraints, guarded by the encoded node family. Prefer your own explicit, typed SQL metadata for authoritative DDL; checks are valuable corroboration and can reject contradictions such as `varchar(50)` on a schema with `isMaxLength(100)` according to a chosen policy.

### 2.9 Defaults in the AST

**Import:** `effect/SchemaAST`
**Source:** `.repos/effect/packages/effect/src/SchemaAST.ts:576-594`, `:3473-3485`; `.repos/effect/packages/effect/src/SchemaGetter.ts:64-91`, `:662-668`

```ts
readonly context?: Context // Context.constructorDefault?: Link
readonly encoding?: readonly [Link, ...Array<Link>]
```

Constructor defaults have a first-class location but their actual effect is still behind a link/getter closure. Decoding defaults only appear as an encoding transformation plus encoded optionality, and no stable ID distinguishes them. Documentation annotations named `default` are descriptive metadata, not executable defaults.

**DSL use:** The runtime compiler may report `hasConstructorDefault` but should not serialize or execute its hidden effect as a database expression. Database default expressions, identities, sequences, generated columns, and update triggers belong in the DSL metadata generic and runtime value.

### 2.10 Recommended AST walk for a column compiler

**Import:** `effect/SchemaAST`, optionally `effect/SchemaRepresentation`
**Source:** traversal shapes cited in sections 2.1-2.9; encoded lowering at `.repos/effect/packages/effect/src/SchemaRepresentation.ts:675-703`

The safest compilation sequence is:

1. Start from the exact field schema object retained by the DSL or from `Struct.fields`/`Class.fields`; do not start from a class root declaration if `.fields` exists.
2. Compute `decodedAst = AST.toType(field.ast)` and `encodedAst = AST.toEncoded(field.ast)` once.
3. Read type/encoded optionality from the corresponding contexts. Read key annotations before unwrapping unions.
4. Flatten encoded unions; remove `Null` into a separate `nullable` bit and reject/handle `Undefined` separately. Require a single compatible remaining physical family.
5. Unwrap `Suspend.thunk()` with a `WeakSet`/reference cache. For `Declaration`, first inspect `declaration.annotations?.representation?.id` directly; otherwise require an explicit codec/SQL metadata or recurse only through a known declaration contract. Do not blindly assume every declaration's first type parameter is its storage type.
6. Classify `String`, `Number`, `Boolean`, `BigInt`, date encodings, `Literal`/`Enum`, `Arrays`/`Objects` (usually JSON/blob), and dialect-specific explicit metadata.
7. Flatten all checks, including nested `FilterGroup`, and merge only recognized representation IDs whose payloads validate.
8. Cross-check the runtime AST result against the wrapper's static compatibility result. A disagreement should be a construction/compilation error, never a silent fallback.

`Representation.toRepresentation(ast)` or `S.toRepresentation(schema)` is a second useful IR: it lowers the encoded side by default, normalizes checks to structural `Filter`/`FilterGroup` objects, and introduces references for recursion (`SchemaRepresentation.ts:400-456`, `:675-703`). It is public and explicitly compiler-extensible. Direct AST inspection retains live contexts and transformations; representation documents are better for deterministic snapshots, caching, and a later DDL compiler stage.

**DSL use:** Implement AST reflection as validation and default inference behind the statically typed `Field<S, Meta>` API. The wrapper should be the source of authoritative SQL intent; the AST compiler supplies safe defaults, derives nullability, and catches metadata/schema contradictions.

## 3. Annotations: capabilities, visibility, and loss boundaries

### 3.1 Schema-level, encoded-side, and key-level annotations

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:620-721`, `:16051-16067`

```ts
export function annotate<S extends Top>(annotations: Annotations.Bottom<...>):
  (self: S) => S["Rebuild"]

export function annotateEncoded<S extends Top>(annotations: Annotations.Bottom<...>):
  (self: S) => S["Rebuild"]

export function annotateKey<S extends Top>(annotations: Annotations.Key<S["Type"]>):
  (self: S) => S["Rebuild"]

export function resolveAnnotations<S extends Constraint>(schema: S):
  Annotations.Bottom<...> | undefined

export function resolveAnnotationsKey<S extends Constraint>(schema: S):
  Annotations.Key<S["Type"]> | undefined
```

`annotate` targets the decoded/current node; `annotateEncoded` flips, annotates the encoded side, and flips back. `annotateKey` writes to `ast.context.annotations`, which describes the field's position rather than its value. The two public readers intentionally follow those storage locations.

**DSL use:** If annotations are used at all for SQL, put physical representation metadata on the encoded side and name/comment/column-position metadata at key level. Always read with the matching resolver; `ast.annotations` alone misses checked schemas and key annotations.

### 3.2 Resolution semantics: the last check wins

**Import:** `effect/SchemaAST` and `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/SchemaAST.ts:3309-3317`, `:4023-4063`; `.repos/effect/packages/effect/src/internal/schema/annotations.ts:5-12`

```ts
export function annotate<A extends AST>(ast: A, annotations: S.Annotations.Annotations): A {
  if (ast.checks) {
    const last = ast.checks[ast.checks.length - 1]
    return replaceChecks(ast, [..., last.annotate(annotations)])
  }
  // merge into ast.annotations
}

export const resolve: (ast: AST) => S.Annotations.Annotations | undefined
// implementation: ast.checks ? ast.checks[ast.checks.length - 1].annotations : ast.annotations
```

Annotations are not globally merged across a node and all of its checks. Once checks exist, `.annotate` writes onto the last check, and `resolve` reads only that last check. Appending another check later can make prior resolved annotations invisible, though the earlier check still contains them and a deep inspector can recover them.

**DSL use:** Do not make correctness-critical SQL metadata depend on `resolveAnnotations`. If annotations supplement the wrapper, attach them after all schema checks and test every rebuilding path; for diagnostics, scan all check layers so hidden brands/metadata can be reported.

### 3.3 Custom annotation keys

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:16081-16126`

```ts
export declare namespace Annotations {
  export interface Annotations {
    readonly [x: string]: unknown
  }
}

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly version?: readonly [number, number, number] | undefined
    }
  }
}
```

Custom keys are string-keyed module augmentation, not `ServiceMap.Key` values and not a public unique-symbol registry. Augmentation gives a typed **value lookup** at a known key, but `.annotate(...)` still returns `S["Rebuild"]`; the actual annotation literal/value does not become a generic parameter on the resulting schema.

**DSL use:** An annotation can provide runtime interoperability (`sql: { ... }`) and typed reads, but it cannot make `S.Int.annotate({ sql: varchar(...) })` fail at compile time based on that metadata. A generic wrapper is required for the requested schema/metadata compatibility and dialect-aware return types.

### 3.4 Annotation preservation/loss matrix

**Import:** `effect/Schema`, `effect/SchemaAST`, `effect/unstable/schema`
**Source:** `.repos/effect/packages/effect/src/internal/schema/schema.ts:49-77`; `.repos/effect/packages/effect/src/Schema.ts:3499-3511`, `:5550-5577`, `:14161-14206`; `.repos/effect/packages/effect/src/unstable/schema/VariantSchema.ts:201-253`, `:435-459`

| Operation | What happens to annotations | Consequence for SQL metadata |
|---|---|---|
| `.pipe(...)` alone | Merely calls functions through `pipeArguments`; no inherent loss. | Judge the combinator, not `pipe`. |
| `.annotate(...)` / `.check(...)` on an ordinary schema | `rebuild` reuses the schema's runtime options/static members. | Specialized schema members survive, but resolved annotation layer can move to the last check. |
| `S.compose` / `S.decodeTo` | Result root is `to.ast`; `from.ast` is reachable through an encoding link. | Decoded-side resolution sees target metadata; source metadata is only visible on the encoded path/after `toEncoded`. |
| `S.toType` / `S.toEncoded` | Select and recursively rebuild one side. | Metadata on the other side is not visible in the selected AST; use the correct side deliberately. |
| `Struct.mapFields` | Fresh `AST.Objects`; root annotations are not copied; checks only with unsafe option. | Field annotations survive if field schemas are reused; root SQL metadata does not. |
| `VariantSchema.extract` | Iterates stored fields and creates a fresh `S.Struct(fields)`. | Reused field schemas retain their annotations/context; wrapper/container annotations do not exist or are lost. |
| `S.Class(identifier)(struct)` | Underlying `struct.ast` becomes declaration type parameter and encoded source; class annotations live on declaration. The class `Rebuild` is an ordinary `decodeTo` schema. | `.fields` is safest before rebuilding; post-class `.annotate`/`.check` loses class statics even though the schema still has decoded `Self`. |
| `VariantSchema.Class` | Extracts default struct, then calls `S.Class(identifier)(schema.fields, annotations)`, not with `schema`. | Any default struct root annotation/check is dropped; field schema metadata survives. |
| Variant class statics | Each extracted variant is annotated with `{ id, title }`. | `id` is only an arbitrary custom key, not the built-in `identifier`; do not use it as a stable schema ID. |
| `S.Opaque` | Initially returns the same schema object, but its `Rebuild` is the underlying schema's `Rebuild`. | Runtime AST is unchanged; later `.annotate`/`.check` can lose the opaque `Self` type statically. |

**DSL use:** Keep authoritative SQL metadata in a wrapper that survives all supported combinators by construction. Optionally mirror a serializable subset into an encoded or key annotation for tooling, but regenerate that mirror from the wrapper rather than treating AST annotations as the source of truth.

### 3.5 Wrapper objects versus annotations: Effect's own `VariantSchema.Field` pattern

**Import:** `effect/unstable/schema` (`VariantSchema`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/VariantSchema.ts:97-150`, `:571-594`

```ts
export interface Field<in out A extends Field.Config> extends Pipeable {
  readonly [FieldTypeId]: typeof FieldTypeId
  readonly schemas: A
}

export type Field.Config = {
  readonly [key: string]: S.Top | undefined
}
```

Effect itself uses a wrapper when a field needs type-visible configuration: `A` stores the exact per-variant schema map both statically and at runtime, and the object is pipeable. Extraction then computes a new field map from `A`. This is the closest upstream precedent for `SqlField<Schema, Meta>`.

**DSL use:** Define `Field<S, M>` with runtime `schema` and `meta`, phantom-preserving generic members, and an invariant brand/TypeId. Make every combinator return an exact new `Field<S2, M2>`; use annotations only as an optional projection. This is the only examined mechanism that supports compile-time nonsense rejection such as `S.Int` plus varchar metadata.

## 4. `VariantSchema`: full extension surface

### 4.1 `Struct`, `Field`, extraction, and `ExtractFields`

**Import:** `effect/unstable/schema` (`VariantSchema`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/VariantSchema.ts:38-44`, `:75-81`, `:105-150`, `:176-253`

```ts
export interface Struct<in out A extends Field.Fields> extends Pipeable {
  readonly [TypeId]: A
}

export interface Field<in out A extends Field.Config> extends Pipeable {
  readonly [FieldTypeId]: typeof FieldTypeId
  readonly schemas: A
}

export type ExtractFields<V extends string, Fields extends Struct.Fields, IsDefault = false> = {
  readonly [K in keyof Fields as
    [Fields[K]] extends [Field<infer Config>] ? V extends keyof Config ? K : never : K
  ]:
    [Fields[K]] extends [Struct<infer _>] ? Extract<V, Fields[K], IsDefault> :
    [Fields[K]] extends [Field<infer Config>] ?
      [Config[V]] extends [S.Top] ? Config[V] : never :
    [Fields[K]] extends [S.Top] ? Fields[K] : never
}

export type Extract<V extends string, A extends Struct<any>, IsDefault = false> =
  [A] extends [Struct<infer Fields>] ?
    IsDefault extends true ?
      [A] extends [S.Top] ? A : S.Struct<Simplify<ExtractFields<V, Fields>>> :
      S.Struct<Simplify<ExtractFields<V, Fields>>> :
    never
```

Plain schemas appear in every variant; a `Field<Config>` appears only when the variant is a key in `Config` and its value is a schema; nested variant structs recurse. The `IsDefault` special case preserves a nested value that is already both a variant struct and a schema instead of re-extracting it. Runtime extraction follows the same branches and caches each result, then creates a fresh `S.Struct(fields)`.

**DSL use:** Either embed `SqlField` inside each `VariantSchema.Field` schema value or define a parallel factory whose extraction understands both variant and SQL wrappers. The type-level key-remapping pattern is directly reusable for select/insert/update/json column sets.

### 4.2 Factory signature and custom variants

**Import:** `effect/unstable/schema` (`VariantSchema`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/VariantSchema.ts:339-434`

The declaration below is verbatim through the implementation's opening `=> {`; only the function body is omitted.

```ts
export const make = <
  const Variants extends ReadonlyArray<string>,
  const Default extends Variants[number]
>(options: {
  readonly variants: Variants
  readonly defaultVariant: Default
}): {
  readonly Struct: <const A extends Struct.Fields>(
    fields: A & Struct.Validate<A, Variants[number]>
  ) => Struct<A>

  readonly Field: <const A extends Field.ConfigWithKeys<Variants[number]>>(
    config: A & { readonly [K in Exclude<keyof A, Variants[number]>]: never }
  ) => Field<A>

  readonly FieldOnly: <const Keys extends ReadonlyArray<Variants[number]>>(
    keys: Keys
  ) => <S extends Schema.Top>(
    schema: S
  ) => Field<{ readonly [K in Keys[number]]: S }>
  readonly FieldExcept: <const Keys extends ReadonlyArray<Variants[number]>>(
    keys: Keys
  ) => <S extends Schema.Top>(
    schema: S
  ) => Field<{ readonly [K in Exclude<Variants[number], Keys[number]>]: S }>
  readonly fieldEvolve: {
    <
      Self extends Field<any> | Schema.Top,
      const Mapping extends (Self extends Field<infer S> ? { readonly [K in keyof S]?: (variant: S[K]) => Schema.Top }
        : { readonly [K in Variants[number]]?: (variant: Self) => Schema.Top })
    >(f: Mapping): (self: Self) => Field<
      Self extends Field<infer S> ? {
          readonly [K in keyof S]: K extends keyof Mapping
            ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K]
            : S[K]
        } :
        {
          readonly [K in Variants[number]]: K extends keyof Mapping
            ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : Self
            : Self
        }
    >
    <
      Self extends Field<any> | Schema.Top,
      const Mapping extends (Self extends Field<infer S> ? {
          readonly [K in keyof S]?: (variant: S[K]) => Schema.Top
        }
        : { readonly [K in Variants[number]]?: (variant: Self) => Schema.Top })
    >(self: Self, f: Mapping): Field<
      Self extends Field<infer S> ? {
          readonly [K in keyof S]: K extends keyof Mapping
            ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : S[K]
            : S[K]
        } :
        {
          readonly [K in Variants[number]]: K extends keyof Mapping
            ? Mapping[K] extends (arg: any) => any ? ReturnType<Mapping[K]> : Self
            : Self
        }
    >
  }
  readonly Class: <Self = never>(
    identifier: string
  ) => <const Fields extends Struct.Fields>(
    fields: Fields & Struct.Validate<Fields, Variants[number]>,
    annotations?:
      | Schema.Annotations.Declaration<Self, readonly [Schema.Struct<ExtractFields<Default, Fields, true>>]>
      | undefined
  ) => [Self] extends [never] ? MissingSelfGeneric
    :
      & Class<
        Self,
        Fields,
        Schema.Struct<ExtractFields<Default, Fields, true>>
      >
      & {
        readonly [V in Variants[number]]: Extract<V, Struct<Fields>>
      }
  readonly Union: <const Members extends ReadonlyArray<Struct<any>>>(
    members: Members
  ) => Union<Members, Default> & Union.Variants<Members, Variants[number]>
  readonly extract: {
    <V extends Variants[number]>(
      variant: V
    ): <A extends Struct<any>>(self: A) => Extract<V, A, V extends Default ? true : false>
    <V extends Variants[number], A extends Struct<any>>(
      self: A,
      variant: V
    ): Extract<V, A, V extends Default ? true : false>
  }
} => {
```

`make` is the official extension point: variant names and the default are const-generic, invalid variant keys are rejected, and all returned helpers close over that exact union. Nothing in `Model` is privileged; it is simply one instantiation of this factory.

**DSL use:** Create a BSL factory with exactly the operation variants required by table derivation, for example `select`, `insert`, `update`, and JSON/API variants. If update fields should default to optional, implement that as explicit `fieldEvolve`/factory policy—current `Model` does not do it automatically.

### 4.3 `FieldOnly`, `FieldExcept`, `fieldEvolve`, and `extract`

**Import:** `effect/unstable/schema` (`VariantSchema`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/VariantSchema.ts:359-404`, `:425-433`, `:462-503`

```ts
readonly FieldOnly: <const Keys extends ReadonlyArray<Variants[number]>>(
  keys: Keys
) => <S extends Schema.Top>(schema: S) => Field<{ readonly [K in Keys[number]]: S }>

readonly FieldExcept: <const Keys extends ReadonlyArray<Variants[number]>>(
  keys: Keys
) => <S extends Schema.Top>(schema: S) =>
  Field<{ readonly [K in Exclude<Variants[number], Keys[number]>]: S }>

readonly extract: {
  <V extends Variants[number]>(variant: V):
    <A extends Struct<any>>(self: A) => Extract<V, A, V extends Default ? true : false>
  <V extends Variants[number], A extends Struct<any>>(self: A, variant: V):
    Extract<V, A, V extends Default ? true : false>
}
```

The complete, verbatim `fieldEvolve` overload pair is reproduced in the factory signature immediately above; it is not shortened here.

`FieldOnly` copies a schema into exactly the listed variants; `FieldExcept` copies it into every configured variant except the listed set. `fieldEvolve` accepts either a plain schema (first expanded to all variants) or an existing `Field`, then evolves only mapped variants while preserving exact return types. `extract` marks the configured default variant with `IsDefault = true`.

**DSL use:** Express generated columns, read-only columns, JSON redaction, insert defaults, and update omission with these combinators. Add BSL-specific evolvers whose input/output signatures also update SQL metadata—for example `nullable` changes both `S` and `Meta["notNull"]`, while `generatedAlways` removes insert/update variants.

### 4.4 `VariantSchema.Class` and `Union`

**Import:** `effect/unstable/schema` (`VariantSchema`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/VariantSchema.ts:270-336`, `:405-424`, `:435-460`, `:596-613`

```ts
export interface Class<Self, Fields extends Struct.Fields, S extends Schema.Top & { readonly fields: S.Struct.Fields }>
  extends Schema.Class<Self, S, {}>, Struct<Simplify<Fields>> {
  readonly fields: S["fields"]
}

export interface Union<Members extends ReadonlyArray<Struct<any>>, Default extends string = string>
  extends Schema.Union<{ readonly [K in keyof Members]: Extract<Default, Members[K], true> }> {}
```

The class is the schema for the default variant and receives a static property for every variant. Runtime construction extracts the default struct but passes only `schema.fields` into `S.Class`, then annotates every variant struct with `id` and `title`. `Union` makes a union for the default and static union schemas for each configured variant.

**DSL use:** A BSL model class can expose `select`, `insert`, `update`, and JSON schemas while still being accepted by Effect SQL repositories. Preserve SQL wrapper metadata in a separate static map or wrapper-aware variant struct, because extraction produces ordinary `S.Struct` instances and cannot retain arbitrary container metadata by itself.

### 4.5 `Overrideable`

**Import:** `effect/unstable/schema` (`VariantSchema`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/VariantSchema.ts:523-569`

```ts
export const Override = <A>(value: A): A & Brand<"Override"> => value as any

export interface Overrideable<S extends S.Top & S.WithoutConstructorDefault> extends S.BottomLazy<...> {
  readonly Type: S["Type"] & Brand<"Override">
  readonly "~type.make": (S["Type"] & Brand<"Override">) | undefined
  readonly "~type.constructor.default": "with-default"
}

export const Overrideable = <S extends S.Top & S.WithoutConstructorDefault>(
  schema: S,
  options: { readonly defaultValue: Effect.Effect<S["~type.make.in"]> }
): Overrideable<S>
```

`Overrideable` composes a branded decoded type with a constructor default. It distinguishes an explicit override from an omitted constructor value but is not a database-generated/default marker.

**DSL use:** Reuse it for application-generated timestamps/UUIDs in model construction, but pair it with explicit SQL generation metadata. The DSL should state whether the application, database, or both may generate a value.

## 5. `Model`: exact beta.105 variants and helpers

### 5.1 Factory, variants, and compatibility shape

**Import:** `effect/unstable/schema` (`Model`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/Model.ts:25-69`, `:71-178`

```ts
const { Class, Field, FieldExcept, FieldOnly, Struct, Union, extract, fieldEvolve } =
  VariantSchema.make({
    variants: ["select", "insert", "update", "json", "jsonCreate", "jsonUpdate"],
    defaultVariant: "select"
  })

export type Any = S.Top & {
  readonly fields: S.Struct.Fields
  readonly insert: S.Top
  readonly update: S.Top
  readonly json: S.Top
  readonly jsonCreate: S.Top
  readonly jsonUpdate: S.Top
}
```

`Model.Class`, `Struct`, `Field`, `FieldOnly`, `FieldExcept`, `fieldEvolve`, `extract`, and `Union` are the unmodified products of `VariantSchema.make`. Plain schema fields are therefore present unchanged in **all six variants**. There is no implicit “ID required, every other update field optional” algorithm in beta.105.

**DSL use:** Make the derived BSL model satisfy `Model.Any` if it should plug into `SqlModel`. Add update optionality and operation-specific constraints explicitly in the BSL factory so the type computation reflects the desired SQL API rather than relying on an upstream behavior that does not exist.

### 5.2 Generated fields and sensitive fields

**Import:** `effect/unstable/schema` (`Model`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/Model.ts:190-294`

```ts
export interface GeneratedByDb<S extends Schema.Top> extends VariantSchema.Field<{
  readonly select: S
  readonly json: S
}> {}
export const GeneratedByDb = <S extends Schema.Top>(schema: S): GeneratedByDb<S> => ...

export interface GeneratedByApp<S extends Schema.Top> extends VariantSchema.Field<{
  readonly select: S
  readonly insert: S
  readonly update: S
  readonly json: S
}> {}

export interface Sensitive<S extends Schema.Top> extends VariantSchema.Field<{
  readonly select: S
  readonly insert: S
  readonly update: S
}> {}
```

The requested `Generated` name is **absent** in this checkout; beta.105 calls it `GeneratedByDb`. Database-generated fields exist only in select/read JSON. Application-generated fields also exist in insert/update but are hidden from JSON create/update. Sensitive fields exist only in database variants.

**DSL use:** Map `GeneratedByDb` to database identity/default/generated metadata and omit it from write variants. Do not use `GeneratedByApp` as evidence of a SQL default; it says only which schema variants include the value.

### 5.3 `FieldOption` and JSON optionality

**Import:** `effect/unstable/schema` (`Model`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/Model.ts:296-375`

```ts
export interface FieldOption<S extends Schema.Top> extends VariantSchema.Field<{
  readonly select: S.OptionFromNullOr<S>
  readonly insert: S.OptionFromNullOr<S>
  readonly update: S.OptionFromNullOr<S>
  readonly json: optionalOption<S>
  readonly jsonCreate: optionalOption<S>
  readonly jsonUpdate: optionalOption<S>
}> {}

export const FieldOption: <Field extends VariantSchema.Field<any> | S.Top>(self: Field) => ...
```

Database variants use required keys whose encoded values are nullable and whose decoded values are `Option`. JSON variants additionally allow a missing key. This helper is “optional” in the application sense, but insert/update database keys are still required unless another combinator changes them.

**DSL use:** Derive `.notNull(false)` from the encoded `NullOr` in each database variant, while retaining `Option` in decoded row types. If nullable insert/update keys should be omittable, apply a separate optional-key policy.

### 5.4 `BooleanSqlite`

**Import:** `effect/unstable/schema` (`Model`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/Model.ts:377-409`

```ts
export interface BooleanSqlite extends VariantSchema.Field<{
  readonly select: S.BooleanFromBit
  readonly insert: S.BooleanFromBit
  readonly update: S.BooleanFromBit
  readonly json: S.Boolean
  readonly jsonCreate: S.Boolean
  readonly jsonUpdate: S.Boolean
}> {}
```

This is a concrete example of dialect-aware storage: database variants encode booleans as `0 | 1`, while JSON variants use booleans. It does not select a Drizzle builder; it only supplies the codecs.

**DSL use:** Mirror this structure for dialect-specific SQL columns, but make dialect support a metadata generic so an invalid PostgreSQL-only/SQLite-only builder is rejected statically. The encoded AST then validates the selected physical representation.

### 5.5 Insert/update timestamps

**Import:** `effect/unstable/schema` (`Model`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/Model.ts:478-678`

```ts
export interface DateTimeInsert extends VariantSchema.Field<{
  readonly select: S.DateTimeUtcFromString
  readonly insert: VariantSchema.Overrideable<S.DateTimeUtcFromString>
  readonly json: S.DateTimeUtcFromString
}> {}

export interface DateTimeUpdate extends VariantSchema.Field<{
  readonly select: S.DateTimeUtcFromString
  readonly insert: VariantSchema.Overrideable<S.DateTimeUtcFromString>
  readonly update: VariantSchema.Overrideable<S.DateTimeUtcFromString>
  readonly json: S.DateTimeUtcFromString
}> {}
```

`DateTimeInsert` is absent from update; `DateTimeUpdate` has a current-time constructor default in both insert and update. `FromDate` variants use `Date` for the database encoding and ISO string for JSON; `FromNumber` variants use milliseconds (`Model.ts:510-572`, `:609-678`). These defaults are application constructor behavior, not SQL `DEFAULT CURRENT_TIMESTAMP` or an update trigger.

**DSL use:** Use these helpers for repository request codecs if desired, but require explicit metadata before deriving database defaults/triggers. The SQL DSL can offer parallel helpers such as `dbTimestamp({ defaultNow: true, onUpdateNow: true })` whose static metadata and Drizzle builder agree.

### 5.6 JSON stored as text

**Import:** `effect/unstable/schema` (`Model`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/Model.ts:680-720`

```ts
export interface JsonFromString<S extends Schema.Top> extends VariantSchema.Field<{
  readonly select: S.fromJsonString<S>
  readonly insert: S.fromJsonString<S>
  readonly update: S.fromJsonString<S>
  readonly json: S
  readonly jsonCreate: S
  readonly jsonUpdate: S
}> {}

export const JsonFromString = <S extends Schema.Top>(schema: S): JsonFromString<S> => {
  const parsed = S.fromJsonString(S.toCodecJson(schema))
  return Field({ select: parsed, insert: parsed, update: parsed, ... })
}
```

This is the only general JSON field helper in the examined Model file. It canonicalizes the nested schema to JSON, then stores that JSON as text for database variants. There are no separate beta.105 exports named `Json`, `JsonCreate`, or `JsonUpdate` field helpers; those are variant schema properties.

**DSL use:** Offer explicit physical choices—text JSON, native JSON, native JSONB—while reusing `S.toCodecJson` for application encoding. Do not infer a dialect's native JSON column solely from an `Objects` AST.

### 5.7 `Model.Class` behavior and the critical update-policy trap

**Import:** `effect/unstable/schema` (`Model`)
**Source:** `.repos/effect/packages/effect/src/unstable/schema/Model.ts:25-37`, `.repos/effect/packages/effect/src/unstable/schema/VariantSchema.ts:176-253`; test evidence `.repos/effect/packages/effect/test/unstable/schema/VariantSchema.test.ts:86-134`

`Model.Class` is exactly the class factory from section 4. Its default schema is select, and the other five static variants are fresh extracted structs. The upstream tests verify field inclusion, SQLite boolean database/JSON encoding, and constructor-only override defaults; they do not implement a global partial-update transform.

**DSL use:** Define the BSL's update contract deliberately. For a repository that requires the primary key and makes all mutable fields optional, the factory must build exactly that schema, excluding generated/immutable fields and applying `optionalKey` to the remainder.

## 6. `effect/unstable/sql` compatibility

### 6.1 `SqlSchema`: encoded requests, decoded rows

**Import:** `effect/unstable/sql` (`SqlSchema`)
**Source:** `.repos/effect/packages/effect/src/unstable/sql/SqlSchema.ts:33-48`, `:65-105`, `:115-171`

```ts
export const findAll = <Req extends S.Constraint, Res extends S.Constraint, E, R>(options: {
  readonly Request: Req
  readonly Result: Res
  readonly execute: (request: Req["Encoded"]) => Effect<ReadonlyArray<unknown>, E, R>
}) => (request: Req["Type"]): Effect<Array<Res["Type"]>, ...>

export const findOne = <Req extends S.Constraint, Res extends S.Constraint, E, R>(options: {
  readonly Request: Req
  readonly Result: Res
  readonly execute: (request: Req["Encoded"]) => Effect<ReadonlyArray<unknown>, E, R>
}) => (request: Req["Type"]): Effect<Res["Type"], ...>
```

All helpers encode an application request before invoking SQL and decode unknown result rows through the result schema. Variants also cover non-empty arrays, void results, and optional first rows. This establishes the actual boundary contract: request `Type` for callers, request `Encoded` for the SQL driver, unknown driver rows, result `Type` after decoding.

**DSL use:** Ensure the generated Drizzle row/parameter shape matches the variant schema's `Encoded`, not its `Type`. Use `SqlSchema` around derived statements so branded values, `Option`, dates, and other application types remain outside the driver layer.

### 6.2 `SqlModel.makeRepository` and `makeResolvers`

**Import:** `effect/unstable/sql` (`SqlModel`)
**Source:** `.repos/effect/packages/effect/src/unstable/sql/SqlModel.ts:33-77`, `:89-220`, `:230-274`

```ts
export const makeRepository = <
  S extends Model.Any,
  Id extends keyof S["Type"] & keyof S["update"]["Type"] & keyof S["fields"],
  SoftDelete extends keyof S["fields"] = never
>(Model: S, options: {
  readonly tableName: string
  readonly spanPrefix: string
  readonly idColumn: Id
  readonly softDeleteColumn?: SoftDelete
}): Effect<{ insert; insertVoid; update; updateVoid; findById; delete }, never, SqlClient>

export const makeResolvers = <S extends Model.Any, Id extends ..., SoftDelete extends ...>(
  Model: S,
  options: ...
): Effect<..., never, SqlClient | Scope>
```

The repository uses `Model.insert` as request schema and `Model` as result for inserts; `Model.update` similarly drives updates. The ID must be present in the select type, update type, and original fields. The helpers consume schema variants and generate SQL strings through `SqlClient`; they do not derive Drizzle table definitions or DDL.

`makeResolvers` follows the same schema contract for batched request resolvers, but its beta.105 return surface contains insert, insert-void, find-by-ID, and delete resolvers—there is no update resolver in that factory. Neither helper consumes `json`, `jsonCreate`, or `jsonUpdate`.

**DSL use:** Make the generated model structurally satisfy `Model.Any`, keep the ID in the update variant, and preserve service requirements. The Drizzle-table derivation can be an independent artifact attached to the same model class; Effect repositories can continue consuming its schema variants.

## 7. Pipeability and type-preserving wrapper combinators

### 7.1 `Pipeable`, `pipeArguments`, prototypes, and classes

**Import:** `effect/Pipeable`
**Source:** `.repos/effect/packages/effect/src/Pipeable.ts:44-75`, `:564-629`, `:646-675`

```ts
export interface Pipeable {
  pipe<A>(this: A): A
  pipe<A, B>(this: A, ab: (_: A) => B): B
  pipe<A, B, C>(this: A, ab: (_: A) => B, bc: (_: B) => C): C
  // overloads continue for longer pipelines
}

export const pipeArguments = <A>(self: A, args: IArguments): unknown
export const Prototype: Pipeable
export const Class: new() => Pipeable
export const Mixin: <TBase extends new(...args: any[]) => any>(klass: TBase) =>
  TBase & PipeableConstructor
```

`pipeArguments` applies the passed unary functions in order; the overloads on `Pipeable` propagate each function's return type. It does not itself preserve or transform any wrapper generic—the combinator signature does that work. Effect's `VariantSchema` uses tiny object prototypes whose `pipe` delegates to `pipeArguments` (`VariantSchema.ts:571-594`).

**DSL use:** Implement `SqlField<S, M>` as a small immutable pipeable value with a TypeId, `schema`, and `meta`. Give every combinator an exact generic mapping, for example `varchar<N>() => <S extends StringCompatible, M>(field: Field<S, M>) => Field<S, M & Varchar<N>>`; the runtime method can be the standard one-line `pipeArguments` delegation.

### 7.2 Dual data-first/data-last APIs

**Import:** `effect/Function`
**Source:** `.repos/effect/packages/effect/src/Function.ts:102-157`

```ts
export const dual: {
  <DataLast extends (...args: any[]) => any, DataFirst extends (...args: any[]) => any>(
    arity: Parameters<DataFirst>["length"],
    body: DataFirst
  ): DataLast & DataFirst
  <DataLast extends ..., DataFirst extends ...>(
    isDataFirst: (args: IArguments) => boolean,
    body: DataFirst
  ): DataLast & DataFirst
}
```

`dual` returns the intersection of deliberately declared data-last and data-first signatures. `VariantSchema.extract` uses a predicate because its arities overlap; `fieldEvolve` uses numeric arity two.

**DSL use:** Declare both signatures before calling `dual`; do not rely on inference through an `any` implementation. This lets `field.pipe(sql.varchar(50))` and `sql.varchar(field, 50)` produce the identical transformed `Field<S2, M2>` type.

### 7.3 Higher-kinded record mapping with `Struct.Lambda`

**Import:** `effect/Struct`
**Source:** `.repos/effect/packages/effect/src/Struct.ts:587-665`

```ts
export interface Lambda {
  readonly "~lambda.in": unknown
  readonly "~lambda.out": unknown
}
export type Apply<L extends Lambda, V> =
  (L & { readonly "~lambda.in": V })["~lambda.out"]
export const lambda = <L extends (a: any) => any>(f: ...): L => f as any
```

This is Effect's type-level-function mechanism for mapping heterogeneous records without collapsing every value to one common type. Schema's own optional/mutable helpers use this pattern.

**DSL use:** Use a `Struct.Lambda` when evolving every field in a model while retaining each key's concrete `S` and `Meta`—for example, an update transform that optionalizes only mutable, non-generated columns. Ordinary `(field: Field<any, any>) => ...` callbacks will erase precisely the information the DSL needs.

## 8. Additional useful levers

### 8.1 `SchemaRepresentation` as a compiler IR

**Import:** `effect/SchemaRepresentation` or `S.toRepresentation`
**Source:** `.repos/effect/packages/effect/src/SchemaRepresentation.ts:19-38`, `:395-456`, `:675-703`; `.repos/effect/packages/effect/src/Schema.ts:14804-14817`

```ts
export type Representation =
  Declaration | Reference | Suspend | Null | Undefined | Void | Never | Unknown | Any |
  String | Number | Boolean | BigInt | Symbol | Literal | UniqueSymbol |
  ObjectKeyword | Enum | TemplateLiteral | Arrays | Objects | Union

export interface Document {
  readonly representation: Representation
  readonly references: References
}

export function toRepresentation(ast: AST.AST): Document
export function S.toRepresentation(schema: S.Constraint): Document
```

Representation documents lower the encoded side by default and replace executable checks with open `{ id, payload, schemas? }` descriptions when available. They also model `Reference`, making recursive inputs easier to snapshot or cache. Applying `AST.toType` first produces a decoded-side representation.

**DSL use:** Consider compiling `Field` metadata plus an encoded `Representation.Document` into an internal SQL column IR. This separates Effect traversal from dialect-specific Drizzle construction and makes compiler fixtures deterministic.

### 8.2 Canonical codecs: `toCodecJson`, `toCodecIso`, `toCodecStringTree`

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:14931-14970`, `:15083-15118`, `:15135-15171`

```ts
export function toCodecJson<S extends Constraint>(schema: S): toCodecJson<S>
export function toCodecIso<S extends Constraint>(schema: S): Codec<S["Type"], S["Iso"]>
export function toCodecStringTree<S extends Constraint>(schema: S): toCodecStringTree<S>
```

`toCodecJson` derives a JSON encoded form and follows declaration `toCodecJson`/`toCodec` annotations; opaque declarations without one fall back to unknown JSON and may still fail at runtime. `toCodecIso` targets the schema's intermediate `Iso`; `toCodecStringTree` stringifies leaves while preserving tree structure. This checkout has no public symbols named `Serializer` or `typeCodec`; these are the relevant beta.105 replacements.

**DSL use:** Use `toCodecJson` for text/native JSON columns and snapshots, `toCodecIso` for an explicit intermediate representation, and never infer SQL scalar compatibility merely because a value can be converted to JSON.

### 8.3 `toTaggedUnion`

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:6215-6218`, `:6250-6308`

```ts
export type toTaggedUnion<Tag extends PropertyKey, Members extends readonly ...[]> =
  Union<Members> & TaggedUnionUtils<Tag, Members>

export function toTaggedUnion<const Tag extends PropertyKey>(tag: Tag):
  <const Members extends readonly ...[]>(self: Union<Members>) => toTaggedUnion<Tag, Members>
```

The function walks sentinels and `Object.assign`s `cases`, `discriminants`, guards, and match helpers onto the **same union object**. It does not replace the AST.

**DSL use:** Use tagged unions for closed polymorphic JSON payloads or table-strategy metadata. Because AST identity is unchanged, the SQL compiler can still inspect the original union; it must nevertheless require an explicit storage strategy for heterogeneous variants.

### 8.4 Arbitrary and equivalence derivation

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:14563-14581`, `:14796-14798`

```ts
export function toArbitrary<S extends Constraint>(schema: S): FastCheck.Arbitrary<S["Type"]>
export function toEquivalence<T>(schema: Schema<T>): Equivalence.Equivalence<T>
```

These derive generators and equality from the schema and recognized annotations/checks. They do not derive SQL, but they are strong proof tools for codecs and round trips.

**DSL use:** Property-test `Type -> Encoded -> driver row -> decoded Type` and compare decoded rows with schema equivalence. Generate values at boundary checks such as nullable, max-length, integer ranges, and variants.

### 8.5 Standard Schema and JSON Schema interoperability

**Import:** `effect/Schema`
**Source:** `.repos/effect/packages/effect/src/Schema.ts:1270-1317`, `:1349-1373`, `:14829-14919`

```ts
export function toStandardSchemaV1<S extends ConstraintDecoder<unknown>>(schema: S):
  S & StandardSchemaV1<unknown, S["Type"]>
export function toStandardJSONSchemaV1<S extends Constraint>(schema: S): ...
export function toJsonSchemaDocument(schema: Constraint, options?: ToJsonSchemaOptions): ...
```

Standard Schema functions add interop properties to the same schema value. JSON Schema generation can whitelist custom string annotations with `includeAnnotationKey`, but it is best-effort and declarations may lower approximately. This is documentation/tooling interop, not a source for exact SQL physical types.

**DSL use:** Export validation contracts and selected `x-sql-*` annotation mirrors if useful, while keeping the typed wrapper/SQL IR authoritative. Never round-trip through JSON Schema to derive the table.

## 9. Recommended BSL architecture from these levers

The upstream mechanisms point to a two-source, one-compiler design:

```ts
interface Field<
  S extends Schema.Constraint,
  M extends SqlMeta,
  Variants extends VariantConfig = DefaultVariants
> extends Pipeable.Pipeable {
  readonly schema: S
  readonly meta: M
  readonly variants: Variants
  readonly [FieldTypeId]: {
    readonly schema: S
    readonly meta: M
    readonly variants: Variants
  }
}
```

- The exact schema generic is the source of `Type`, `Encoded`, services, and a static compatibility witness.
- The exact metadata generic is the source of dialect, column family, length/precision, generation, keys, references, and Drizzle builder/result narrowing.
- The runtime schema AST is the source of encoded physical defaults, nullability, modifiers, and recognized constraints; it validates the generic contract.
- A custom `VariantSchema.make` instance computes operation schemas. SQL metadata must either remain in the field wrappers until table compilation or be stored in a parallel static map keyed exactly like `.fields`.
- Compilation first produces a dialect-neutral SQL IR, then constructs the dialect-specific Drizzle table. This keeps Effect AST reflection independent from Drizzle's rc churn.

For static compatibility, model schema families explicitly. A constraint based only on decoded `Type` cannot distinguish `S.Int` from an arbitrary refined `number`, and a concrete schema can be erased by user annotation. Prefer constructors that capture the exact input `S` and compute an allowed `ColumnMetaFor<S, Dialect>`; use runtime encoded-AST validation as the final soundness check.

## Top 10 levers ranked

1. **`VariantSchema.make` plus `ExtractFields`** — the ready-made const-generic engine for select/insert/update/json field-set computation.
2. **A `VariantSchema.Field`-style `Field<S, Meta>` wrapper** — the only examined pattern that carries runtime metadata and type-visible phantom information without annotation erasure.
3. **`Struct.fields` / `Class.fields`** — the lossless, typed entry point for column derivation; avoids declaration reverse-engineering.
4. **`AST.toEncoded` paired with `AST.toType`** — the decisive separation between database driver representation and application/domain representation.
5. **`AST.Context` plus encoded `Null` union detection** — independent derivation of omission, mutability/default context, and SQL nullability.
6. **Check `representation.id`/`payload` and `SchemaRepresentation`** — stable constraint identities suitable for optional varchar/range/check inference and a deterministic compiler IR.
7. **Exact `Codec<T, E, RD, RE>`/`Constraint` generics** — preserves driver types and service requirements through the DSL and repository boundaries.
8. **`Model.Any` plus `SqlModel`/`SqlSchema` contracts** — a precise compatibility target for generated variants: application request `Type`, SQL request `Encoded`, decoded result `Type`.
9. **`Pipeable.pipeArguments`, `dual`, and `Struct.Lambda`** — the idioms needed for ergonomic combinators that transform runtime state and exact static metadata together.
10. **`S.Opaque`, canonical codecs, arbitrary/equivalence** — low-loss nominal models, explicit JSON/text encodings, and strong end-to-end proof tools.

## Traps/gotchas

1. **Version split:** root compilation is pinned to beta.104 while the requested subtree source declares beta.105. Prove any prototype against the actual dependency or align the versions first.
2. **Subtree provenance is non-canonical:** current tree `b8b3d...` was introduced without a subtree trailer; `931f573...` is only the last recorded split, not an exact identity for the current source.
3. **`Schema<T>` erases encoded and concrete information.** Use the exact `S extends Constraint` generic; avoid accepting/returning only `Schema<number>` for column classification.
4. **Annotations are not phantom types.** Module augmentation types a string-keyed read, but `.annotate` returns the same `Rebuild`; it cannot reject incompatible metadata at compile time.
5. **Resolved annotations are last-check annotations.** Appending a later check can hide previously resolved SQL metadata or brands. Direct `ast.annotations` is also insufficient.
6. **`annotate` and `annotateKey` are different stores.** Value annotations resolve through the node/check; key annotations live in `ast.context.annotations`.
7. **`compose`/`decodeTo` changes the visible root.** Source annotations remain on the encoded path, but decoded-side resolution sees the target. Always choose the side explicitly.
8. **`Struct.mapFields` loses root annotations and usually checks.** `unsafePreserveChecks` does not preserve annotations and cannot establish refinement validity after a field change.
9. **`VariantSchema.extract` makes a fresh `S.Struct`.** Individual field schema metadata survives; wrapper/container metadata does not.
10. **`VariantSchema.Class` passes `schema.fields`, not `schema`, to `S.Class`.** Default-struct root annotations/checks are not preserved. Its variant `{ id, title }` annotation uses a custom `id`, not built-in `identifier`.
11. **Plain `Model` fields appear in every variant.** Beta.105 does not automatically make update fields optional or apply CRUD conventions beyond the explicit helpers.
12. **`Generated` is not present.** The current name is `GeneratedByDb`; do not write against an older API.
13. **`FieldOption` is nullable, not necessarily omittable in database writes.** DB insert/update variants use required `OptionFromNullOr` keys.
14. **Constructor defaults are not SQL defaults.** They run only in `make*`; decoding defaults are opaque getter closures and are not reliably reflectable.
15. **`Option` does not imply SQL `NULL`.** Derive nullability from the encoded side. Direct `S.Option` is a declaration; `OptionFromNullOr` encodes a nullable union.
16. **`Undefined` is not `NULL`.** Keep absent keys, explicit `undefined`, and database nullability separate.
17. **Class roots are declarations.** Use `.fields`; if AST-only, a known class declaration's first type parameter is the struct, but arbitrary declarations have no such universal meaning.
18. **Finished classes are not rebuild-stable class values.** Their `Rebuild` is an ordinary `decodeTo` schema, so post-class `.annotate`/`.check` loses `.fields`, `.extend`, and variant statics.
19. **`Suspend` needs cycle protection and cannot carry checks.** Never recurse through `thunk()` without memoization/reference handling.
20. **A generic refinement closure is not portable SQL.** Only recognized built-in representation IDs or explicit DSL metadata can safely become DDL.
21. **Length checks apply to strings and arrays.** Confirm the encoded node is `String` before inferring `varchar(n)`.
22. **Literal/template/union schemas need a storage policy.** Open template literals and heterogeneous unions do not determine a single SQL column family.
23. **`toRepresentation` defaults to the encoded side.** Apply `AST.toType` first when a decoded representation is intended.
24. **`toCodecJson` is total at construction, not proof of lossless SQL storage.** Opaque declarations can fall back to unknown JSON and still fail at runtime.
25. **No public `Serializer` or `typeCodec` exists in this beta.105 source.** Use `toCodecJson`, `toCodecIso`, `toCodecStringTree`, `toType`, and `toEncoded`.
26. **Pipeability does not preserve generics by magic.** `pipeArguments` only applies functions; every SQL combinator must declare the precise `Field<S, M> -> Field<S2, M2>` type transformation.
27. **`S.Opaque` is zero-runtime but not rebuild-stable.** Its `Rebuild` points at the underlying schema, so annotate/check before applying `Opaque` or deliberately rewrap it.
28. **Drizzle and Effect versions are both prerelease-pinned.** Hide Drizzle rc-specific builder mechanics behind a dialect-neutral SQL IR so schema reflection and metadata types do not churn with each rc.
