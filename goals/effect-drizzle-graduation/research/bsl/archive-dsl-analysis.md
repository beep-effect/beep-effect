# Forensic analysis of the archived Effect v3 SQL DSL

## Scope and bottom line

This report analyzes the final tree at `BSL-drizzle` in `/home/elpresidank/YeeBois/projects/beep-effect-BSL-drizzle`. All `file:line` citations below are relative to that archive root. The dependency snapshot is Effect `^3.19.13`, `@effect/experimental` `^0.58.0`, `@effect/sql` `^0.49.0`, and Drizzle ORM `^0.45.1` (`package.json:109`, `package.json:172-180`, `package.json:367-370`).

The experiment found a genuinely useful center: an Effect Schema remained the field definition, a symbol-keyed `ColumnDef` traveled with it, `@effect/sql/Model` variant fields were preserved, and a mapped output type projected encoded field types into a Drizzle `PgTable`. The best ideas are the single field source of truth, encoded-side nullability, and variant-aware database/API views (`packages/common/schema/src/integrations/sql/dsl/types.ts:853-888`, `packages/common/schema/src/integrations/sql/dsl/types.ts:1026-1053`, `packages/common/schema/src/integrations/sql/dsl/adapters/drizzle.ts:116-140`).

The final archive is nevertheless a proof of concept, not a sound end-to-end SQL modeler. Several headline guarantees are only return-type decorations over runtime values created anyway; the forward adapter synthesizes its precise return through an accumulator assertion; `InferSelectModel` proof was explicitly removed; defaults are recorded but never emitted; `number` becomes PostgreSQL `integer`; bigint and timestamp builder modes disagree with their advertised types; relations and dialect abstraction are absent; and substantial derivation/invariant tests were deleted or commented out (`packages/common/schema/test/integrations/sql/dsl/field-model-comprehensive.test.ts:682-687`, `packages/common/schema/src/integrations/sql/dsl/adapters/drizzle.ts:214-241`, `packages/common/schema/src/integrations/sql/dsl/adapters/drizzle.ts:287-309`, `packages/common/schema/test/integrations/sql/dsl/drizzle-typed-columns.test.ts:339-353`, `packages/common/schema/src/integrations/sql/dsl/relations.ts:1`).

Two assumptions in the mission statement need correction:

- The final source does **not** contain an Opaque type or an `Opaque` API. It constructs an `S.Class`, adds SQL statics, and returns it through `UnsafeAny` (`packages/common/schema/src/integrations/sql/dsl/Model.ts:459-497`).
- There is no `never & { ... }` “never-brand” in the final source. The incompatibility mechanism is a normal branded interface returned by a conditional type. It prevents use where a `Schema` is required, but the invalid call itself still runs and produces a real DSL field (`packages/common/schema/src/integrations/sql/dsl/types.ts:125-150`, `packages/common/schema/test/integrations/sql/dsl/field-model-comprehensive.test.ts:682-687`).

### Verification status

The test sources contain 200 active `it(...)` cases across the five nonempty suites plus 60 commented-out cases in `field-model-comprehensive.test.ts`. I could not establish a green current run: `bun test packages/common/schema/test/integrations/sql/dsl` stopped before discovery because `bunfig.toml` preloads an absent historical test-preload file (`bunfig.toml:24-25`). Consequently, “worked” below means implemented and covered by active source tests, not freshly executed successfully. The strongest Drizzle model-inference assertions were intentionally omitted because project-reference declaration builds did not resolve the conditional types (`packages/common/schema/test/integrations/sql/dsl/drizzle-typed-columns.test.ts:339-353`).

## 1. Complete API surface inventory

### `index.ts`

The public barrel is only 16 lines (`packages/common/schema/src/integrations/sql/dsl/index.ts:1-16`):

| Export | Signature / source | Semantics |
|---|---|---|
| `toDrizzle` | Re-export from the historical adapters/drizzle module. | Forward conversion from a DSL model to a PostgreSQL Drizzle table. |
| `DSL` | `export * as DSL from "./combinators"`. | Namespace containing the pipe combinators. |
| `deriveColumnType`, `deriveSchemaColumnType` | Re-export from the historical derive-column-type module. | Runtime AST-to-column-type derivation and its schema wrapper. |
| Every export from `errors.ts` | `export * from "./errors"`. | Tagged validation/derivation errors. |
| `DSLField`, `DSLVariantField`, `Field`, `SchemaColumnError` | Selected re-exports from `Field.ts`. | Field factory and its principal public types. |
| Every export from `literals.ts` | `export * from "./literals"`. | `ModelVariant` and `ColumnType`. |
| `ExtractColumnsType`, `ExtractPrimaryKeys`, `Model`, `ModelClass`, `ModelStatics` | Selected re-exports from `Model.ts`. | Model constructor and model metadata types. |
| `isNullable`, `isSchemaTypeNullable` | Re-export from `nullability.ts`. | Runtime encoded/decoded AST nullability inspection. |
| Every export from `types.ts` | `export * from "./types"`. | The full type-level and column-definition surface. |
| Every export from `validate.ts` | `export * from "./validate"`. | Effectful and synchronous validators. |

Notably, `adapters/drizzle-to-effect-schema.ts` is **not** re-exported, and neither are `DateSchemaId`, `BigIntSchemaId`, or `extractASTFromInput`, because the barrel selects only two exports from `derive-column-type.ts` and selected exports from `Field.ts` (`packages/common/schema/src/integrations/sql/dsl/index.ts:3-5`).

### `Field.ts`

Exports are at `packages/common/schema/src/integrations/sql/dsl/Field.ts:35-304`.

| Export | Signature | Semantics |
|---|---|---|
| `extractASTFromInput` | `(input: S.Schema.All \| VariantSchema.Field<VariantSchema.Field.Config>) => AST.AST` | For variant fields, takes `schemas.select`, falls back to the first schema with an AST, and throws `MissingVariantSchemaError` if none exists; otherwise returns the schema AST (`Field.ts:35-66`). |
| `DSLField`, `DSLVariantField`, `SchemaColumnError` | Type re-exports from `types.ts`. | Backward-compatible import location (`Field.ts:68-69`). |
| `ExtractColumnType<C>` | `C extends { type: infer T extends ColumnType.Type } ? T : "string"` | Extracts an explicit type or defaults statically to `string`; it is unused by the implementation (`Field.ts:71-76`). |
| `SchemaConfiguratorWithSchema<Schema>` | `<const C extends Partial<ColumnDef> = {}>(config?: FieldConfig<C>) => C extends { type: ColumnType.Type } ? ValidateSchemaColumn<Encoded<Schema>, C["type"], DSLField<..., ExactColumnDef<C>>> : DSLField<..., DerivedColumnDefFromSchema<Schema, C>>` | Curried plain-schema configurator; explicit types are compatibility-checked, omitted types are statically derived (`Field.ts:82-111`). |
| `LocalVariantConfiguratorWithSchema<VC>` | `<const C extends Partial<ColumnDef> = {}>(config?: FieldConfig<C>) => C extends { type: ColumnType.Type } ? ValidateSchemaColumn<ExtractVariantSelectEncoded<VC>, C["type"], DSLVariantField<VC, ExactColumnDef<C>>> : DSLVariantField<VC, DerivedColumnDefFromSchema<ExtractVariantSelectSchema<VC>, C>>` | Same operation for a variant field, using its `select` schema (`Field.ts:113-127`). |
| `ExperimentalVariantConfiguratorWithSchema<VC>` | Same signature as the local configurator. | Documented separately for `@effect/experimental`, but both overloads use the same imported `@effect/experimental/VariantSchema.Field` type, so the distinction is nominally redundant (`Field.ts:129-143`, `Field.ts:212-234`). |
| `Field(schema)` | `function Field<Schema extends S.Schema.All>(schema: Schema): SchemaConfiguratorWithSchema<Schema>` | First curried overload for ordinary Effect schemas (`Field.ts:195`). |
| `Field(variantField)` | Two overloads returning the two configurator aliases above. | Accepts `M.Generated`, `M.Sensitive`, `M.GeneratedByApp`, `M.FieldOption`, and compatible variant fields (`Field.ts:212-234`). |
| `Field` implementation | `<A,I,R>(input: S.Schema<A,I,R> \| VariantSchema.Field<...>) => <const C extends Partial<ColumnDef> = {}>(config?: FieldConfig<C>) => DSLField<...> \| DSLVariantField<...> \| SchemaColumnError<...>` | Derives/normalizes metadata, runtime-checks auto-increment type only on this construction path, clones variant fields while preserving their prototype, and annotates ordinary schemas (`Field.ts:240-304`). |

### `Model.ts`

Exports are at `packages/common/schema/src/integrations/sql/dsl/Model.ts:41-498`.

| Export | Signature | Semantics |
|---|---|---|
| `ExtractColumnsType<Fields>` | Mapped type from every key to the `ColumnDef` carried by `DSLVariantField`/`DSLField`, otherwise `ColumnDef<"string", false, false, false>` | Produces the static `columns` record, but silently types unwrapped schemas/variant fields as string columns (`Model.ts:39-50`). |
| `ExtractPrimaryKeys<Fields>` | Mapped/filtering type yielding a union of keys whose metadata has `primaryKey: true` | Computes key names as a union; the public model return does not use it and exposes `readonly string[]` instead (`Model.ts:52-66`, `Model.ts:438-444`). |
| `ModelClass`, `ModelStatics` | Type re-exports from `types.ts` | Compatibility import location (`Model.ts:68-69`). |
| `Model` | `<Self = never>(identifier: string) => <const Fields extends DSL.Fields>(fields: Fields, annotations?: S.Annotations.Schema<Self>) => [Self] extends [never] ? MissingSelfGeneric<...> : ModelClassWithVariants<Self, Fields, string, ExtractColumnsType<Fields>, readonly string[], typeof identifier>` | Validates fields synchronously, derives a snake-case table name, builds an `S.Class` from the select variant, attaches table/column/PK/original-field statics, and defines six lazy variant getters (`Model.ts:431-498`). |

### `literals.ts`

Exports are at `packages/common/schema/src/integrations/sql/dsl/literals.ts:10-67`.

| Export | Signature | Semantics |
|---|---|---|
| `ModelVariant` | `BS.StringLiteralKit("select", "insert", "update", "json", "jsonCreate", "jsonUpdate")` | Runtime schema/kit for the six model projections (`literals.ts:10-21`). |
| `ModelVariant.Type` | `typeof ModelVariant.Type` | Union of those six literals (`literals.ts:23-25`). |
| `ColumnType` | `BS.StringLiteralKit("string", "number", "integer", "boolean", "datetime", "uuid", "json", "bigint")` | Dialect-neutral-looking but PostgreSQL-oriented logical column discriminator (`literals.ts:27-40`). |
| `ColumnType.thunks` | `{ readonly [K in ColumnType.Type]: LazyArg<ColumnType.Type> }` | Prebuilt lazy literal returns for AST matching (`literals.ts:41-48`). |
| `ColumnType.parameterize` | `{ readonly [K in ColumnType.Type]: { readonly type: K } }` | Prebuilt literal-preserving partial column definitions for combinators (`literals.ts:50-62`). |
| `ColumnType.Type` | `typeof ColumnType.Type` | Union of the eight logical types (`literals.ts:65-67`). |

### `types.ts`

This is the full exported surface of the historical common-schema SQL DSL types module.

#### Compatibility and derivation types

| Export | Signature | Semantics |
|---|---|---|
| `ColumnTypeToTS<T>` | Conditional mapping: string/uuid→`string`; number/integer→`number`; boolean→`boolean`; datetime→`string \| Date`; json→`object \| unknown[] \| Record<string, unknown>`; bigint→`bigint` | Declared logical-column to TS compatibility mapping (`types.ts:16-34`). |
| `TSToColumnTypes<T>` | Conditional reverse mapping for `Date`, arrays, objects, string, number, boolean, bigint | Used only to populate diagnostics (`types.ts:36-61`). |
| `StripNullable<T>` | `T extends null \| undefined ? never : T` | Distributively removes nullish members (`types.ts:63-69`). |
| `IsSchemaColumnCompatible<SchemaEncoded, ColType>` | Nested conditional returning `true`/`false` | Checks the schema **encoded** type against an explicit logical column, after null stripping (`types.ts:71-104`). |
| `PrettyPrintType<T>` | Conditional literal name: `string`, `number`, `boolean`, `Date`, `Array`, `object`, or `unknown` | Coarse type-name formatter for diagnostics (`types.ts:106-123`). |
| `SchemaColumnError<SchemaEncoded, ColType>` | Interface with `_tag`, `_brand`, a template-literal `message`, `schemaType`, `columnType`, and `allowedColumnTypes` | Error-shaped return type for incompatible explicit metadata; it is not a runtime error value and not a `never` intersection (`types.ts:125-138`). |
| `ValidateSchemaColumn<SchemaEncoded, ColType, ResultType>` | `IsSchemaColumnCompatible<...> extends true ? ResultType : SchemaColumnError<...>` | Selects the usable field type or diagnostic type (`types.ts:140-150`). |
| `ExtractVariantSelectEncoded<VC>` | Extracts `I` from `VC.select` when it is a `Schema` or `PropertySignature`, else `unknown` | Supplies compatibility checks for variant fields (`types.ts:152-166`). |
| `ExtractVariantSelectSchema<VC>` | Returns `VC.select` when it is a `Schema` or `PropertySignature`, else `unknown` | Supplies class-identity derivation for variant fields (`types.ts:168-186`). |
| `DeriveColumnTypeFromEncoded<I>` | Conditional mapping of encoded TS type to `ColumnType.Type` | Fallback type derivation with explicit `any`/`unknown` detection and null stripping (`types.ts:192-257`). |
| `DeriveColumnTypeFromSchema<Schema>` | `DeriveColumnTypeFromSchemaInner<UnwrapNullable<Schema>>` | Attempts more precise inference through schema class identity and wrapper recursion (`types.ts:263-399`). |
| `DerivedColumnDefFromSchema<Schema,C>` | `{ type: DeriveColumnTypeFromSchema<Schema>; primaryKey: ...; unique: ...; autoIncrement: ...; defaultValue: ... }` | Normalized metadata type when the caller omitted `column.type` (`types.ts:434-450`). |

#### Column-definition schemas and records

Each exported schema class is a tagged member discriminated by `type`; all have optional/defaulted `primaryKey` and `unique`, while only integer and bigint schema members expose `autoIncrement` (`types.ts:452-489`).

| Export | Signature / members | Semantics |
|---|---|---|
| `StringColumnDefSchema` | Tagged schema for `type: "string"` plus flags and a `defaultValueSchema(S.String)` branch | Runtime string-column definition (`types.ts:491-499`). |
| `StringColumnDefSchema.Type`, `.Encoded`, `.Generic<PK,U>` | Static schema types and literal-preserving generic interface | Typed views of the string member (`types.ts:501-517`). |
| `NumberColumnDefSchema` | Same shape for `type: "number"`, with `defaultValueSchema(S.Number)` | Runtime number-column definition (`types.ts:520-528`). |
| `NumberColumnDefSchema.Type`, `.Encoded`, `.Generic<PK,U>` | Static views | Number member types (`types.ts:530-546`). |
| `IntegerColumnDefSchema` | Tagged integer member with optional integer default and `autoIncrement` | Runtime integer-column definition (`types.ts:549-557`). |
| `IntegerColumnDefSchema.Type`, `.Encoded`, `.Generic<PK,U,AI>` | Static views | Integer member types (`types.ts:559-580`). |
| `BooleanColumnDefSchema` | Tagged boolean member with `defaultValueSchema(S.Boolean)` | Runtime boolean-column definition (`types.ts:583-591`). |
| `BooleanColumnDefSchema.Type`, `.Encoded`, `.Generic<PK,U>` | Static views | Boolean member types (`types.ts:593-608`). |
| `DatetimeColumnDefSchema` | Tagged datetime member using `defaultValueSchema(BS.DateTimeUtcFromAllAcceptable)` | Runtime datetime-column definition (`types.ts:611-619`). |
| `DatetimeColumnDefSchema.Type`, `.Encoded`, `.Generic<PK,U>` | Static views | Datetime member types (`types.ts:621-636`). |
| `UuidColumnDefSchema` | Tagged UUID member using `defaultValueSchema(S.UUID)` | Runtime UUID-column definition (`types.ts:639-647`). |
| `UuidColumnDefSchema.Type`, `.Encoded`, `.Generic<PK,U>` | Static views | UUID member types (`types.ts:649-664`). |
| `JsonColumnDefSchema` | Tagged JSON member using `defaultValueSchema(BS.Json)` | Runtime JSON-column definition (`types.ts:667-675`). |
| `JsonColumnDefSchema.Type`, `.Encoded`, `.Generic<PK,U>` | Static views | JSON member types (`types.ts:677-692`). |
| `BigintColumnDefSchema` | Tagged bigint member using `defaultValueSchema(S.BigIntFromSelf)` and supporting `autoIncrement` | Runtime bigint-column definition (`types.ts:695-703`). |
| `BigintColumnDefSchema.Type`, `.Encoded`, `.Generic<PK,U,AI>` | Static views | Bigint member types (`types.ts:705-726`). |
| `ColumnDefSchema` | `S.Union` of all eight schema classes | Runtime discriminated schema for column metadata (`types.ts:729-742`). |
| `ColumnDefSchema.Type`, `.Encoded` | Schema-derived union types | Decoded/encoded forms (`types.ts:744-746`). |
| `ColumnDefSchema.GenericMap<PK,U,AI>` | Map from each `ColumnType` to its member `Generic` interface | Avoids forcing phantom `AI` parameters on members that do not support it (`types.ts:748-768`). |
| `ColumnDefSchema.Generic<T,PK,U,AI>` | `GenericMap<PK,U,AI>[T]` | Gives a precise member for literal `T`, or a union for the full discriminator (`types.ts:770-804`). |
| `ColumnDefSchema.SupportsAutoIncrement<T>` | `T extends "integer" \| "bigint" ? true : false` | Static capability predicate; unused elsewhere (`types.ts:806-810`). |
| `ColumnDef<ColType,PK,U,AI>` | Broad interface with `type`, optional flags, and `defaultValue?: string \| (() => string)` | The actual constraint used by `Field`, combinators, models, and adapter (`types.ts:813-826`). |
| `ColumnDef.Any` | Non-generic broad shape | Namespace alias for unknown literal parameters; unused (`types.ts:828-836`). |
| `ExactColumnDef<C>` | Normalizes omitted flags to `false`, omitted default to `undefined`, omitted type to the full `ColumnType.Type` union | Literal-preserving metadata result (`types.ts:838-847`). |
| `FieldConfig<C>` | `{ readonly column?: C }` | Wrapper accepted by `Field(schema)(config)` (`types.ts:849-851`). |

There is an important split: the rich schema union has per-column scalar default schemas, but the broad `ColumnDef` used by the actual DSL only permits a string or string thunk; neither `Field` nor the combinators decodes metadata through `ColumnDefSchema` (`types.ts:452-461`, `types.ts:491-725`, `types.ts:813-826`, `Field.ts:249-256`). Worse, `defaultValueSchema` tests `F.isFunction(u)` while declaring the predicate as `u is A`, so an accepted function is statically masqueraded as the scalar schema type rather than typed as `() => A` (`types.ts:452-461`).

#### Metadata, fields, variants, and models

| Export | Signature | Semantics |
|---|---|---|
| `ColumnMetaSymbol` and its type alias | `unique symbol = Symbol.for($I\`column-meta\`)` | Cross-module key for column metadata (`types.ts:853-855`). |
| `VariantFieldSymbol` and its type alias | `unique symbol = Symbol.for($I\`variant-field\`)` | Marker distinguishing cloned DSL variant fields (`types.ts:857-859`). |
| `DSLField<A,I,R,C>` | `extends S.Schema<A,I,R> { readonly [ColumnMetaSymbol]: C }` | Effect Schema plus column metadata (`types.ts:861-867`). |
| `WithColumnDef` | Curried and uncurried call signatures attaching a `ColumnDef` to a schema | Declared helper type; no exported value implements it (`types.ts:869-877`). |
| `DSLVariantField<A,C>` | `extends VariantSchema.Field<A>` plus both symbols | Variant field plus column metadata (`types.ts:879-888`). |
| `DSL.Fields` | String-indexed union of schemas, property signatures, DSL fields, DSL variant fields, raw variant fields, or `undefined` | Broad model-field constraint; uses `any` to retain practical inference (`types.ts:890-913`). |
| `isDSLVariantField` | `<A,C>(u: unknown): u is DSLVariantField<A,C>` | Checks object shape and `VariantFieldSymbol === true` (`types.ts:915-925`). |
| `FieldResult<Input,C>` | Conditional mapping from variant field/schema/property signature to the corresponding DSL wrapper | Declared general result helper; unused by `Field` overloads (`types.ts:927-946`). |
| `ExtractVariantFields<V,Fields>` | Key-remapped mapped type using `ShouldIncludeField` and `ExtractFieldSchema` | Produces fields present in one model variant (`types.ts:952-965`). |
| `ShouldIncludeField<V,F>` | Tuple-wrapped conditional over DSL/raw variant fields | Prevents unwanted distributivity and retains only configured variants; ordinary fields return `true` (`types.ts:967-985`). |
| `ExtractFieldSchema<V,F>` | Tuple-wrapped conditional extracting `Config[V]`, or reconstructing a plain `S.Schema<A,I,R>` | Converts each retained field wrapper back into a schema/property signature (`types.ts:987-1018`). |
| `SelectVariantFields<Fields>` | `S.Simplify<ExtractVariantFields<"select", Fields>>` | Base-class field set (`types.ts:1020-1026`). |
| `ModelClassWithVariants<Self,Fields,TName,Columns,PK,Id>` | Extends `ModelClass` and adds `select`, `insert`, `update`, `json`, `jsonCreate`, `jsonUpdate` structs | Static six-view model contract (`types.ts:1028-1054`). |
| `ModelClass<Self,...>` | Extends `S.Schema<Self, Struct.Encoded<Select...>, Struct.Context<Select...>>` and `ModelStatics`; constructible from select fields | Model class/schema contract (`types.ts:1056-1084`). |
| `ModelStatics<TName,Columns,PK,Id,Fields>` | `{ tableName; columns; primaryKey; identifier; _fields }` | SQL metadata and original fields attached to the model class (`types.ts:1086-1104`). |
| `ExtractEncodedType<F>` | Conditional extraction of select-variant/schema/property-signature encoded type | Supplies the intended Drizzle `.$type<T>()` payload (`types.ts:1110-1153`). |
| `ExtractEncodedTypes<Fields>` | Mapped record `{ [K in keyof Fields]: ExtractEncodedType<Fields[K]> }` | Bulk encoded-type projection; unused by the adapter (`types.ts:1155-1162`). |

### `combinators.ts`

All combinators accept a plain schema or an existing `DSLField`, preserve `A/I/R`, merge literal metadata, and attach it by annotation and direct symbol property (`packages/common/schema/src/integrations/sql/dsl/combinators.ts:53-140`).

| Export | Signature | Semantics |
|---|---|---|
| `uuid` | `<A,I,R,C extends ColumnDef = never>(self: Schema<A,I,R> \| DSLField<A,I,R,C>) => ValidateSchemaColumn<I,"uuid",DSLField<...,MergeColumnDef<...,{type:"uuid"}>>>` | Sets PostgreSQL UUID logical type (`combinators.ts:166-172`). |
| `string` | Same pattern with `"string"` | Sets text logical type (`combinators.ts:188-194`). |
| `integer` | Same pattern with `"integer"` | Sets integer logical type (`combinators.ts:210-216`). |
| `number` | Same pattern with `"number"` | Sets number logical type (`combinators.ts:232-238`). |
| `boolean` | Same pattern with `"boolean"` | Sets boolean logical type (`combinators.ts:254-260`). |
| `json` | Same pattern with `"json"` | Sets JSONB logical type (`combinators.ts:281-287`). |
| `datetime` | Same pattern with `"datetime"` | Sets timestamp logical type (`combinators.ts:303-309`). |
| `primaryKey` | `<A,I,R,C=never>(self) => DSLField<...,MergeColumnDef<...,{primaryKey:true}>>` | Marks primary key (`combinators.ts:329-332`). |
| `unique` | Same pattern with `{ unique: true }` | Marks unique (`combinators.ts:348-351`). |
| `autoIncrement` | Same pattern with `{ autoIncrement: true }` | Marks auto-increment, with no static restriction to integer/bigint (`combinators.ts:369-372`). |
| `defaultValue` | `<A,I,R,C=never>(value: string \| (() => string)) => (self) => DSLField<...,MergeColumnDef<...,{defaultValue: typeof value}>>` | Records a raw SQL-ish default string/thunk; the forward adapter never applies it (`combinators.ts:405-410`, `adapters/drizzle.ts:232-241`). |

There is no `bigint` type-setting combinator. The header example mentions `DSL.nullable`, but no such export exists (`combinators.ts:19-24`, `combinators.ts:142-410`).

### `derive-column-type.ts`

| Export | Signature | Semantics |
|---|---|---|
| `deriveColumnType` | `(ast: AST.AST, visited: WeakSet<AST.AST> = new WeakSet()) => ColumnType.Type` | Exhaustive AST walker over encoded structure; throws `UnsupportedColumnTypeError` for unrepresentable standalone types (`derive-column-type.ts:35-198`). |
| `DateSchemaId` / `.Type` | Literal kit over `Date`, `DateFromString`, `DateTimeUtc`, `DateTimeUtcFromSelf` | Recognizes transformation identifiers as datetime (`derive-column-type.ts:266-279`). |
| `BigIntSchemaId` / `.Type` | Literal kit over `BigInt`, `BigIntFromString` | Recognizes transformation identifiers as bigint (`derive-column-type.ts:281-289`). |
| `deriveSchemaColumnType` | `(schema: { readonly ast: AST.AST }) => ColumnType.Type` | Convenience wrapper (`derive-column-type.ts:408-432`). |

### `nullability.ts`

| Export | Signature | Semantics |
|---|---|---|
| `isNullable` | `(ast: AST.AST, side: "from" \| "to" = "from", visited = new WeakSet()) => boolean` | Exhaustive AST walk: direct undefined/void/null are nullable, any nullable union member makes the union nullable, refinements/suspends recurse, and transforms follow the chosen side (`nullability.ts:34-101`). |
| `isSchemaTypeNullable` | `(schema: { readonly ast: AST.AST }, side: "from" \| "to" = "from") => boolean` | Schema convenience wrapper (`nullability.ts:103-115`). |

### `errors.ts`

| Export | Signature / payload | Semantics |
|---|---|---|
| `ErrorSeverity` / `.Type` | Literal kit `"error" \| "warning"` | Shared severity schema (`errors.ts:20-34`). |
| `DSLValidationErrorBase` | Interface with message/code/severity/path and optional expected/received/suggestion | Documentation/common structural contract (`errors.ts:36-53`). |
| `AutoIncrementTypeError` | Tagged error plus `fieldName`, `actualType` | `INV-SQL-AI-001` (`errors.ts:69-82`). |
| `IdentifierTooLongError` | Tagged error plus identifier/length/maxLength | PostgreSQL identifier limit (`errors.ts:84-98`). |
| `InvalidIdentifierCharsError` | Tagged error plus identifier/invalidChars | Unquoted identifier syntax (`errors.ts:100-117`). |
| `NullablePrimaryKeyError` | Tagged error plus fieldName | Primary-key/schema-nullability conflict (`errors.ts:119-131`). |
| `MissingVariantSchemaError` | Tagged error plus availableSchemaKeys | Variant field had no usable schema AST (`errors.ts:137-152`). |
| `UnsupportedColumnTypeError` | Tagged error plus schemaType/reason | AST cannot map to a column (`errors.ts:154-173`). |
| `EmptyModelIdentifierError` | Tagged common fields | Empty identifier (`errors.ts:179-193`). |
| `MultipleAutoIncrementError` | Tagged error plus modelName/autoIncrementFields | DSL policy limiting a model to one auto-increment field (`errors.ts:195-211`). |
| `ModelValidationAggregateError` | Tagged error plus modelName/errorCount/`errors: S.Array(S.Unknown)` | Synchronous model-construction aggregate (`errors.ts:213-234`). |
| `DSLValidationError` | Union of all nine concrete errors, including aggregate | Exhaustive TS error union (`errors.ts:236-255`). |
| `DSLValidationErrorSchema` | `S.Union(...)` of eight non-aggregate classes | Runtime schema, accidentally omitting `ModelValidationAggregateError` (`errors.ts:257-271`). |

### `validate.ts`

| Export | Signature | Semantics |
|---|---|---|
| `validateAutoIncrementType` | `(fieldName, def) => Effect<void, AutoIncrementTypeError>` | Requires integer/bigint when AI is true (`validate.ts:78-114`). |
| `validateIdentifierLength` | `(identifier, context) => Effect<void, IdentifierTooLongError>` | Checks JS string length ≤63 (`validate.ts:116-154`). |
| `validateIdentifierChars` | `(identifier, context) => Effect<void, InvalidIdentifierCharsError>` | Checks the unquoted PostgreSQL regex (`validate.ts:156-206`). |
| `validatePrimaryKeyNonNullable` | `(fieldName, isPrimaryKey, isNullableField) => Effect<void, NullablePrimaryKeyError>` | Rejects a nullable PK when the caller supplies correct nullability (`validate.ts:208-244`). |
| `validateModelIdentifier` | `(identifier) => Effect<void, EmptyModelIdentifierError>` | Rejects empty model names (`validate.ts:250-280`). |
| `validateSingleAutoIncrement` | `(modelName, columns) => Effect<void, MultipleAutoIncrementError>` | Enforces the DSL’s one-AI policy (`validate.ts:282-330`). |
| `validateField` | `(fieldName, def, isNullableField = false) => Effect<void, ReadonlyArray<DSLValidationError>>` | Runs the four field validators and accumulates failures (`validate.ts:336-373`). |
| `validateModel` | `(modelName, columns) => Effect<void, ReadonlyArray<DSLValidationError>>` | Accumulates model and per-column checks, but hard-codes every field’s nullability to false (`validate.ts:375-433`). |
| `validateFieldSync` | Same inputs; returns `Right<void> \| Left<ReadonlyArray<DSLValidationError>>` | `Effect.runSync` wrapper (`validate.ts:439-458`). |
| `validateModelSync` | `(modelName, columns) => Right<void> \| Left<ReadonlyArray<DSLValidationError>>` | Sync model-validator wrapper (`validate.ts:460-477`). |
| `isValidationFailure<E>` | `(result: Right<void> \| Left<E>) => result is Left<E>` | `_tag === "Left"` guard (`validate.ts:479-486`). |

### `adapters/drizzle.ts`

| Export | Signature | Semantics |
|---|---|---|
| `toDrizzle` | `<TName,Columns,PK,Id,Fields,M extends ModelStatics<...>>(model: M) => PgTableWithColumns<{ name: M["tableName"]; schema: undefined; columns: BuildColumns<M["tableName"], DrizzleTypedBuildersFor<M["columns"],M["_fields"]>,"pg">; dialect:"pg" }>` | Builds a PostgreSQL table, one builder per metadata entry, using the original fields for nullability and intended encoded typing (`adapters/drizzle.ts:249-310`). |

### `adapters/drizzle-to-effect-schema.ts`

| Export | Signature | Semantics |
|---|---|---|
| `JsonValue` | `S.Union(String, Number, Boolean, Null, Record<String,Unknown>, Array<Unknown>) satisfies S.Schema<JsonValue>` | Deliberately nonrecursive JSON schema to reduce inference cost (`adapters/drizzle-to-effect-schema.ts:51-65`). |
| `createInsertSchema` | `<TTable extends Drizzle.Table,TRefine extends TableRefine<TTable> = {}>(table, refine?) => BuildInsertSchema<TTable,TRefine>` | Maps Drizzle columns to Effect schemas, then makes nullable columns optional+null and defaulted columns optional (`adapters/drizzle-to-effect-schema.ts:121-161`). |
| `createSelectSchema` | Same generics, returning `BuildSelectSchema<TTable,TRefine>` | Maps columns and wraps non-not-null columns in `S.NullOr` (`adapters/drizzle-to-effect-schema.ts:163-205`). |

These functions are orphaned: no source/test references exist outside this file, and the public barrel does not expose them (`index.ts:1-16`).

### `relations.ts`

No exports. Its only line is a commented `ColumnDef` import (`packages/common/schema/src/integrations/sql/dsl/relations.ts:1`).

## 2. Type-level design in depth

### 2.1 Logical column types, but no dialect model

The logical universe is eight string literals: `string`, `number`, `integer`, `boolean`, `datetime`, `uuid`, `json`, and `bigint` (`literals.ts:27-40`). There is no exported or internal `Dialect` type. Dialect is instead embedded in behavior:

- Forward generation imports only `drizzle-orm/pg-core`, returns `dialect: "pg"`, applies PostgreSQL’s 63-character identifier policy, and maps to PG builders (`adapters/drizzle.ts:11-22`, `adapters/drizzle.ts:281-286`, `validate.ts:55-72`).
- Reverse generation recognizes PostgreSQL, MySQL, and SQLite column classes, but only for a few string/date/array details (`adapters/drizzle-to-effect-schema.ts:1-4`, `adapters/drizzle-to-effect-schema.ts:219-257`).

Thus the vocabulary is not a portable SQL algebra; it is a small PG projection with a partially multi-dialect reverse mapper.

### 2.2 Compatibility: the best diagnostic trick, and its limits

The core conditional is verbatim:

```ts
export type ValidateSchemaColumn<SchemaEncoded, ColType extends ColumnType.Type, ResultType> = IsSchemaColumnCompatible<
  SchemaEncoded,
  ColType
> extends true
  ? ResultType
  : SchemaColumnError<SchemaEncoded, ColType>;
```

(`types.ts:145-150`)

The error is intentionally readable in editor hovers:

```ts
export interface SchemaColumnError<SchemaEncoded, ColType extends ColumnType.Type> {
  readonly _tag: "SchemaColumnTypeError";
  readonly _brand: "SchemaColumnTypeError";
  readonly message: `Schema encoded type '${PrettyPrintType<SchemaEncoded>}' is incompatible with column type '${ColType}'. Allowed column types for this schema: ${TSToColumnTypes<SchemaEncoded>}`;
  readonly schemaType: SchemaEncoded;
  readonly columnType: ColType;
  readonly allowedColumnTypes: TSToColumnTypes<SchemaEncoded>;
}
```

(`types.ts:131-138`)

This is clever because an invalid `Field(...)` no longer satisfies `DSL.Fields`, so using it in a model produces a localized structural error. It is not a compile error at the call site and not an impossible/`never` value. Active tests deliberately create such values, assert their error-shaped static type, and confirm the real metadata exists at runtime through `as unknown as` (`drizzle-typed-columns.test.ts:245-287`, `field-model-comprehensive.test.ts:682-687`).

The final source’s most meaningful `never` use is instead a sentinel for “no prior metadata”; tuple wrapping avoids distributing over unions:

```ts
type ResolveColumnDef<Schema, C> = [C] extends [never] ? DerivedDefaultColumnDef<Schema> : C;
```

(`combinators.ts:61-69`). Key remapping later also uses `never` to omit fields from variants (`types.ts:960-965`). Neither construct is a never-brand.

The compatibility matrix has concrete holes:

- `bigint` is omitted from `IsSchemaColumnCompatible`, so any **explicit** `type: "bigint"` is statically rejected even for a bigint-encoded schema; only omitted/derived bigint works (`types.ts:82-104`, `types.ts:228-257`).
- String schemas are accepted for `uuid` and `datetime`, numbers for `integer`, and no UUID/date/integer refinement property is required. This is storage-shape compatibility, not semantic SQL compatibility (`types.ts:82-103`).
- `TSToColumnTypes<T>` does not strip nullish members. Compatibility can accept `string | null`, while the diagnostic’s `allowedColumnTypes` becomes `never` (`types.ts:42-61`, `types.ts:82-104`, `types.ts:131-138`).
- JSON accepts only object/array encoded types, although JSON primitives are legitimate and the reverse adapter’s `JsonValue` includes them (`types.ts:100-103`, `adapters/drizzle-to-effect-schema.ts:51-65`).
- `PrettyPrintType` is intentionally coarse and reports branded strings as `string`, unions frequently as `unknown`, and bigint as `unknown` (`types.ts:111-123`).

### 2.3 `any`/`unknown` detection and schema identity

The fallback derivation contains a good defensive TypeScript trick:

```ts
type IsAny<T> = 0 extends 1 & T ? true : false;

type IsUnknown<T> = IsAny<T> extends true ? false : unknown extends T ? true : false;
```

(`types.ts:192-205`)

This prevents `any` from matching every later conditional and maps both top types to JSON before stripping nullish members (`types.ts:228-257`). The schema-level path first tries known class identities and then recurses through filters/refinements/transforms:

```ts
type DeriveColumnTypeFromSchemaSpecific<Schema, A> =
  Schema extends typeof S.Int
    ? "integer"
    : Schema extends typeof S.Positive
      ? "number"
      : Schema extends typeof S.Negative
        ? "number"
        : Schema extends typeof S.NonPositive
          ? "number"
          : Schema extends typeof S.NonNegative
            ? "number"
            : Schema extends typeof S.UUID
              ? "uuid"
              : Schema extends typeof S.ULID
                ? "uuid"
                : Schema extends typeof S.DateFromString
                  ? "datetime"
                  : Schema extends typeof S.Date
                    ? "datetime"
                    : Schema extends typeof S.DateTimeUtc
                      ? "datetime"
                      : Schema extends typeof S.DateTimeUtcFromSelf
                        ? "datetime"
                        : Schema extends typeof S.BigInt
                          ? "bigint"
                          : Schema extends typeof S.BigIntFromSelf
                            ? "bigint"
                            : Schema extends S.filter<infer Inner>
                              ? DeriveColumnTypeFromSchemaInner<Inner>
                              : Schema extends S.refine<infer _A2, infer From>
                                ? DeriveColumnTypeFromSchemaInner<From>
                                : Schema extends S.transform<infer From, infer _To>
                                  ? DeriveColumnTypeFromSchemaInner<From>
                                  : Schema extends S.transformOrFail<infer From, infer _To, infer _R2>
                                    ? DeriveColumnTypeFromSchemaInner<From>
                                    : DeriveFromTypeParameter<A>;
```

(`types.ts:355-399`)

The ordering recognizes special refinements/transforms before generic wrapper recursion and checks primitive types before `object`, preserving branded primitive behavior (`types.ts:343-432`). But Effect schemas are structurally typed, and this precision did not stabilize through all wrappers/build modes. Five major derivation sections—refinements, transformations, unions, variant fields, and branded types—are commented out in the comprehensive test (`field-model-comprehensive.test.ts:77-157`, `field-model-comprehensive.test.ts:163-214`, `field-model-comprehensive.test.ts:284-380`, `field-model-comprehensive.test.ts:428-570`, `field-model-comprehensive.test.ts:571-649`). The remaining bigint variant test admits that wrappers lose schema identity statically (`field-model-comprehensive.test.ts:975-978`).

### 2.4 Tagged column definitions: sound idea, disconnected implementation

`ColumnDefSchema` uses two factories: non-AI members simply do not contain `autoIncrement`, while integer/bigint members do (`types.ts:467-489`). Its mapped lookup is a strong way to preserve member-specific arity:

```ts
export type GenericMap<PrimaryKey extends boolean, Unique extends boolean, AutoIncrement extends boolean> = {
  readonly string: StringColumnDefSchema.Generic<PrimaryKey, Unique>;
  readonly number: NumberColumnDefSchema.Generic<PrimaryKey, Unique>;
  readonly integer: IntegerColumnDefSchema.Generic<PrimaryKey, Unique, AutoIncrement>;
  readonly boolean: BooleanColumnDefSchema.Generic<PrimaryKey, Unique>;
  readonly datetime: DatetimeColumnDefSchema.Generic<PrimaryKey, Unique>;
  readonly uuid: UuidColumnDefSchema.Generic<PrimaryKey, Unique>;
  readonly json: JsonColumnDefSchema.Generic<PrimaryKey, Unique>;
  readonly bigint: BigintColumnDefSchema.Generic<PrimaryKey, Unique, AutoIncrement>;
};

export type Generic<
  T extends ColumnType.Type = ColumnType.Type,
  PrimaryKey extends boolean = boolean,
  Unique extends boolean = boolean,
  AutoIncrement extends boolean = boolean,
> = GenericMap<PrimaryKey, Unique, AutoIncrement>[T];
```

(`types.ts:759-804`)

However, the actual field pipeline uses the separate broad `ColumnDef` interface, never parses `ColumnDefSchema`, and permits `autoIncrement` for every discriminator (`types.ts:813-826`, `Field.ts:249-256`, `combinators.ts:115-140`). `SupportsAutoIncrement` is unused. Therefore the strongest tagged-union invariant is dead code in the final design.

An earlier commit (`9620c36b46`) gave non-integer `Generic` members `readonly autoIncrement?: undefined`; the final commit (`2a0b9db8d3`) removed those properties and replaced richer `ColumnConfig`/`AnyColumnDef` types with the broad `ColumnDef`. The evolution moved from stronger member-level exclusion toward easier generic composition.

### 2.5 Metadata correlation with the field schema

Correlation exists in four layers:

1. `DSLField<A,I,R,C>` intersects schema behavior and symbol metadata in one type (`types.ts:861-867`).
2. Explicit `column.type` is checked against encoded `I`; implicit type is derived from the schema type (`Field.ts:98-111`).
3. Variant fields check/derive from `select`, the database-row view (`Field.ts:121-143`).
4. `ExtractEncodedType` later recovers the encoded type from the original field for Drizzle (`types.ts:1110-1153`).

Correlation fails or weakens in several places:

- The runtime implementation returns a DSL field even when overload typing says `SchemaColumnError`; no runtime schema/column compatibility validation occurs (`Field.ts:240-304`, `field-model-comprehensive.test.ts:682-687`).
- Direct properties and AST annotations duplicate the same metadata, creating two sources that `Model.getColumnDef` reads in priority order (`Field.ts:296-304`, `Model.ts:97-120`).
- Fields without DSL metadata silently become string columns both statically and at runtime, regardless of schema (`Model.ts:41-50`, `Model.ts:88-120`).
- The model’s `columns` return type is inferred from wrappers, but the model implementation crosses three `UnsafeAny` boundaries (`Model.ts:459-469`, `Model.ts:497`).
- Variant-select schema identity can degrade to a broad type, as acknowledged by the tests (`field-model-comprehensive.test.ts:975-978`).
- The adapter’s generic `EncodedType` is not inferable from `columnBuilder` arguments because `field` is only `DSL.Fields[string]`; the call therefore does not construct the mapped encoded type. The final accumulator assertion supplies the desired builder map after the fact (`adapters/drizzle.ts:214-218`, `adapters/drizzle.ts:292-309`).

### 2.6 Variant extraction type trick

Key remapping plus tuple-wrapped conditionals is another part worth keeping:

```ts
export type ExtractVariantFields<V extends ModelVariant.Type, Fields extends DSL.Fields> = {
  readonly [K in keyof Fields as ShouldIncludeField<V, Fields[K]> extends true ? K : never]: ExtractFieldSchema<
    V,
    Fields[K]
  >;
};
```

(`types.ts:960-965`)

`ShouldIncludeField` uses `[F] extends [...]` to suppress distributive behavior, checks the DSL wrapper first, then raw VariantSchema fields, and includes ordinary schemas in every view (`types.ts:967-985`). `ExtractFieldSchema` guards `V extends keyof Config` before indexing, avoiding unsafe indexed access (`types.ts:987-1018`). This is clean type-level modeling, even though the runtime bridge needs assertions.

### 2.7 Nullability derivation

The design correctly chose encoded-side nullability: SQL stores the schema’s `from` representation. `isNullable` handles `UndefinedKeyword`, `VoidKeyword`, null literals, unions, refinements, suspends, and the selected side of transformations, with a `WeakSet` cycle guard (`nullability.ts:7-38`, `nullability.ts:39-100`). The adapter separately computes type-level nullability with `null extends T` / `undefined extends T`, then applies `NotNull` unless the column is nullable or serial; primary keys force `NotNull` (`adapters/drizzle.ts:64-81`). Runtime generation walks the original field AST and applies `.notNull()` on the same principle (`adapters/drizzle.ts:146-205`, `adapters/drizzle.ts:232-241`).

The gaps are important:

- The doc claims `S.optional(S)` is detected, but `isNullable` accepts only `AST.AST` and has no property-signature case. Callers extract only `psAst.type` / `psAst.from.type` and ignore the property signature’s optional flag (`nullability.ts:14-24`, `nullability.ts:43-99`, `adapters/drizzle.ts:146-160`).
- The standalone `validateModel` has no fields/AST input and explicitly passes `false` for every field, so it cannot enforce nullable-PK conflicts (`validate.ts:387-413`). `Model.ts` has a second, private validation implementation that does inspect ASTs (`Model.ts:297-327`).
- `deriveColumnType` filters null but not undefined from unions, so implicit `S.UndefinedOr`/`S.NullishOr` derivation throws even though `isNullable` recognizes them; this mismatch is recorded in commented tests (`derive-column-type.ts:350-390`, `field-model-comprehensive.test.ts:319-339`).
- A repeated/circular AST encountered through the `WeakSet` returns non-nullable in `isNullable` but JSON in type derivation, conservative choices that can conceal nullability/type information (`nullability.ts:39-41`, `derive-column-type.ts:61-64`).

### 2.8 Runtime AST column derivation

`deriveColumnType` exhaustively handles all Effect v3 AST tags. Keywords map to primitives/JSON, refinements inspect UUID/ULID/Int schema IDs, transformations inspect date/bigint identifiers and otherwise recurse into `from`, declarations recognize known self types, suspensions resolve lazily, and unsupported standalone types throw tagged errors (`derive-column-type.ts:61-198`, `derive-column-type.ts:245-332`). Unions remove null, special-case homogeneous string/number literals, deduplicate member results, and fall back to JSON for heterogeneous results (`derive-column-type.ts:334-402`).

Concrete mismatches remain:

- The documentation says number literals map to integer, but a single numeric `Literal` maps through `P.isNumber` to `number`; only a union of numeric literals maps to `integer` (`derive-column-type.ts:41-50`, `derive-column-type.ts:208-230`, `derive-column-type.ts:379-384`).
- Undefined union members are not filtered and cause an error (`derive-column-type.ts:117-129`, `derive-column-type.ts:350-390`).
- Date/bigint transform recognition depends on string identifier annotations, making it version-sensitive (`derive-column-type.ts:266-312`).
- Unknown declarations and mixed unions silently become JSON, which is safe as a catch-all but loses intentional SQL representation (`derive-column-type.ts:319-331`, `derive-column-type.ts:386-401`).

## 3. Ergonomics as built: verbatim test usage

The following are verbatim snippets. “Model LOC” counts the physical class-definition span, including comments inside it where noted.

### 3.1 Minimal model, implicit type, derived table name — 3 model LOC

```ts
class TestModel extends Model<TestModel>("TestModel")({
  id: Field(S.String)({ column: { primaryKey: true } }),
}) {}
const table = toDrizzle(TestModel);
expect(table).toBeDefined();
expect(getTableName(table)).toBe("test_model");
```

(`field-model-comprehensive.test.ts:33-38`)

This is terse: three lines define a one-field model, and the column type/table name are derived. It still repeats `TestModel` as the self generic and identifier string.

### 3.2 Pipe combinators — 6 model LOC for four fields

```ts
class User extends Model<User>("User")({
  id: S.String.pipe(DSL.uuid, DSL.primaryKey),
  email: S.String.pipe(DSL.string, DSL.unique),
  age: S.Int.pipe(DSL.integer),
  active: S.Boolean.pipe(DSL.boolean),
}) {}
```

(`combinators.test.ts:266-271`)

This is the best ergonomic surface: one line per field and no nested `column` object. It is also where invalid AI combinations can bypass `Field`’s runtime check.

### 3.3 Full combinator model with defaults/nullability — 10 model LOC for seven fields

```ts
class User extends Model<User>("User")({
  id: S.String.pipe(DSL.uuid, DSL.primaryKey),
  email: S.String.pipe(DSL.string, DSL.unique),
  username: S.String.pipe(DSL.string, DSL.unique),
  age: S.Int.pipe(DSL.integer),
  isActive: S.Boolean.pipe(DSL.boolean, DSL.defaultValue("true")),
  // Nullability is derived from S.NullOr - no need for DSL.nullable
  bio: S.NullOr(S.String).pipe(DSL.string),
  createdAt: S.String.pipe(DSL.datetime, DSL.defaultValue("now()")),
}) {}
```

(`combinators.test.ts:451-460`)

The declaration is compact, but the defaults are strings with SQL-expression conventions rather than typed values, and the adapter ignores them.

### 3.4 Explicit all-type model plus Drizzle derivation — 10 model LOC for eight fields

```ts
class CompleteModel extends Model<CompleteModel>("CompleteModel")({
  id: Field(S.String)({ column: { type: "uuid", primaryKey: true } }),
  name: Field(S.String)({ column: { type: "string" } }),
  count: Field(S.Int)({ column: { type: "integer" } }),
  score: Field(S.Number)({ column: { type: "number" } }),
  active: Field(S.Boolean)({ column: { type: "boolean" } }),
  metadata: Field(S.Struct({ key: S.String }))({ column: { type: "json" } }),
  createdAt: Field(M.Generated(S.String))({ column: { type: "datetime" } }),
  secret: Field(M.Sensitive(S.String))({ column: { type: "string" } }),
}) {}
const table = toDrizzle(CompleteModel);
```

(`drizzle-typed-columns.test.ts:410-420`)

This is one line per field, but syntactically heavy: `Field(schema)({ column: { ... } })` adds two call layers and a nested object to every field.

### 3.5 Nearly inference-only comprehensive model — 22 physical / 12 code LOC for ten fields

```ts
class CompleteModel extends Model<CompleteModel>("CompleteModel")({
  // Primary key with autoIncrement
  _rowId: Field(M.Generated(S.Int))({ column: { primaryKey: true, autoIncrement: true } }),
  // UUID
  id: Field(M.GeneratedByApp(S.UUID))({ column: { unique: true } }),
  // String
  name: Field(S.String)({}),
  // Integer
  count: Field(S.Int)({}),
  // Number
  score: Field(S.Number)({}),
  // Boolean
  active: Field(S.Boolean)({}),
  // DateTime
  createdAt: Field(M.Generated(S.Date))({}),
  // JSON
  metadata: Field(S.Struct({ key: S.String }))({}),
  // Sensitive
  secret: Field(M.Sensitive(S.String))({}),
  // Optional
  optional: Field(M.FieldOption(S.Number))({}),
}) {}
```

(`field-model-comprehensive.test.ts:769-790`)

Ignoring explanatory comments, this reaches one code line per field plus class/open/close. Empty `({})` remains visual noise; `Field(schema)()` was supported and tested but not used here (`field-model-comprehensive.test.ts:995-998`).

### 3.6 Variant construction and extraction — 12 physical / 7 code model LOC

```ts
class ComplexUser extends Model<ComplexUser>("ComplexUser")({
  // Database-generated ID (excluded from insert)
  _rowId: Field(M.Generated(S.Int))({ column: { type: "integer", primaryKey: true, autoIncrement: true } }),
  // App-generated UUID (required for insert, excluded from jsonCreate/jsonUpdate)
  id: Field(M.GeneratedByApp(S.String))({ column: { type: "uuid", unique: true } }),
  // Standard field (all variants)
  email: Field(S.String)({ column: { type: "string", unique: true } }),
  // Sensitive field (excluded from json variants)
  passwordHash: Field(M.Sensitive(S.String))({ column: { type: "string" } }),
  // Optional field with null support - nullability derived from M.FieldOption
  bio: Field(M.FieldOption(S.String))({ column: { type: "string" } }),
}) {}
```

(`variant-integration.test.ts:649-660`)

The corresponding extraction assertions are plain static access:

```ts
expect(hasField(ComplexUser.insert.fields, "_rowId")).toBe(false);
expect(hasField(ComplexUser.insert.fields, "id")).toBe(true);
expect(hasField(ComplexUser.insert.fields, "email")).toBe(true);
expect(hasField(ComplexUser.insert.fields, "passwordHash")).toBe(true);
expect(hasField(ComplexUser.insert.fields, "bio")).toBe(true);

// Verify json variant (no passwordHash)
expect(hasField(ComplexUser.json.fields, "_rowId")).toBe(true);
expect(hasField(ComplexUser.json.fields, "id")).toBe(true);
expect(hasField(ComplexUser.json.fields, "email")).toBe(true);
expect(hasField(ComplexUser.json.fields, "passwordHash")).toBe(false);
expect(hasField(ComplexUser.json.fields, "bio")).toBe(true);
```

(`variant-integration.test.ts:677-689`)

The as-built API is therefore reasonably terse in combinator form, moderately noisy in `Field` form, and especially strong in how variant projections are accessed. The self-generic plus repeated identifier, empty second call, untyped SQL defaults, and inability to name a physical column separately are the main ergonomic costs.

## 4. Integration mechanics

### 4.1 Bridge to Effect v3 `Model` / `VariantSchema`

`Field.ts` imports `@effect/experimental/VariantSchema`; the tests supply helpers from `@effect/sql/Model`, whose fields satisfy the experimental `VariantSchema.Field` protocol (`Field.ts:1-28`, `variant-integration.test.ts:5-11`). For a variant input, `Field`:

1. derives metadata from the `select` schema;
2. creates an object with the original prototype to keep `Pipeable` behavior;
3. copies properties and the `schemas` map;
4. attaches `ColumnMetaSymbol` and `VariantFieldSymbol` (`Field.ts:273-290`).

`Model` creates a fresh six-variant `VariantSchema.make`, translates DSL variant fields by copying their `schemas`, passes raw compatible fields through the same conversion, and wraps ordinary schemas in `FieldOnly(...allSixVariants)` (`Model.ts:353-408`). It then builds `VS.Struct`, extracts the `select` schema for the base `S.Class`, and defines lazy cached accessors for each variant with identifiers such as `User.insert` (`Model.ts:454-495`).

The mechanism works conceptually and active tests cover Generated exclusion, Sensitive exclusion, GeneratedByApp behavior, FieldOption nullability, lazy identity, decoding, and Drizzle conversion (`variant-integration.test.ts:31-278`, `variant-integration.test.ts:299-526`). But construction relies on `variantFields as UnsafeAny`, `S.Class<UnsafeAny>`, and `BaseClass as UnsafeAny` (`Model.ts:459-469`, `Model.ts:497`), while the section labeled “Type-level verification” performs only runtime key assertions (`variant-integration.test.ts:719-758`).

### 4.2 Forward Drizzle generation and actual type strength

The intended type pipeline is elegant:

```ts
type DrizzleTypedBuilderFor<Name extends string, Col extends ColumnDef, EncodedType> = Apply$Type<
  ApplyAutoincrement<
    ApplyHasDefault<
      ApplyPrimaryKey<
        ApplyNotNull<
          DrizzleBaseBuilderFor<Name, Col["type"], Col extends { autoIncrement: true } ? true : false>,
          Col,
          EncodedType
        >,
        Col
      >,
      Col
    >,
    Col
  >,
  EncodedType
>;

type DrizzleTypedBuildersFor<Columns extends Record<string, ColumnDef>, Fields extends DSL.Fields> = {
  [K in keyof Columns & keyof Fields & string]: DrizzleTypedBuilderFor<K, Columns[K], ExtractEncodedType<Fields[K]>>;
};
```

(`adapters/drizzle.ts:116-140`)

It models `notNull`, primary key, default, autoincrement, and `.$type<EncodedType>()` in the builder type. Runtime generation matches on the eight column discriminators, applies `.primaryKey()`, `.unique()`, AST-derived `.notNull()`, and `.$type<T>()` (`adapters/drizzle.ts:214-241`).

The output is less trustworthy than the signature:

- `columnBuilder<ColumnName, EncodedType>` has no argument from which `EncodedType` can be inferred; `field` is the broad `DSL.Fields[string]`. Calls therefore do not construct the field-specific encoded type (`adapters/drizzle.ts:214-218`, `adapters/drizzle.ts:292-295`).
- The reduce seed is asserted to the complete `DrizzleTypedBuildersFor` mapped type, and `pgTable` is returned under an explicit `PgTableWithColumns` return annotation. This is the decisive bridge, not inference from each builder (`adapters/drizzle.ts:272-309`).
- The test suite expressly omits `InferSelectModel` assertions because these conditionals failed to resolve through declarations/project references (`drizzle-typed-columns.test.ts:339-353`). Most active adapter tests only assert table/column existence (`drizzle-typed-columns.test.ts:31-160`, `drizzle-typed-columns.test.ts:357-454`).
- `.$type<T>()` is static only and cannot correct runtime serialization (`adapters/drizzle.ts:208-213`).

Runtime mapping bugs/gaps:

- Logical `number` uses `pg.integer`, contradicting its documentation as double precision and rejecting/rounding the `S.Number` value domain at the database boundary (`adapters/drizzle.ts:44-62`, `adapters/drizzle.ts:219-229`, `combinators.ts:218-238`).
- `datetime` calls `pg.timestamp(name)` in default Date mode even when the schema encodes a string; `.$type<string>` changes only TypeScript’s view (`adapters/drizzle.ts:55-57`, `adapters/drizzle.ts:226`, `adapters/drizzle.ts:239-241`, `node_modules/drizzle-orm/pg-core/columns/timestamp.d.ts:65-67`).
- The bigint type maps to `PgBigInt53BuilderInitial` (number mode) while runtime uses `{ mode: "bigint" }`, whose installed overload returns `PgBigInt64BuilderInitial`; the model type and builder implementation disagree (`adapters/drizzle.ts:11-21`, `adapters/drizzle.ts:60-62`, `adapters/drizzle.ts:229`, `node_modules/drizzle-orm/pg-core/columns/bigint.d.ts:43-44`).
- Integer AI becomes `serial`; bigint AI remains ordinary `bigint`, even though type-level modifiers mark it defaulted/autoincrementing (`adapters/drizzle.ts:224`, `adapters/drizzle.ts:229`, `adapters/drizzle.ts:93-104`).
- `defaultValue` affects only type-level `HasDefault`; runtime never calls `.default`, `.defaultNow`, or an SQL expression API (`adapters/drizzle.ts:91-97`, `adapters/drizzle.ts:232-241`).
- There is no length/precision/scale/enum/array/custom type, index, FK/reference, check, generated column, schema namespace, identity options, or relation support (`types.ts:815-826`, `relations.ts:1`).

### 4.3 Reverse Drizzle-to-Effect derivation

The reverse file maps Drizzle static column metadata to schema types (`ColumnSchema`) and runtime column instances to concrete schemas (`mapColumnToSchema`). It handles enums, custom→`Any`, JSON, PG arrays, number/bigint/boolean/date/string, UUID, PG timestamp/date modes, and max length for PG/MySQL/SQLite character types (`adapters/drizzle-to-effect-schema.ts:12-49`, `adapters/drizzle-to-effect-schema.ts:207-269`). Insert schemas make nullable columns optional+null and defaulted not-null columns optional; select schemas add null only (`adapters/drizzle-to-effect-schema.ts:79-118`, `adapters/drizzle-to-effect-schema.ts:151-204`).

It was not finished:

- It is not in `index.ts` and has no tests or external references (`index.ts:1-16`).
- Its core types use `S.Schema<any>` for custom/fallback/refinements and the functions return asserted `S.Struct` types (`adapters/drizzle-to-effect-schema.ts:15-49`, `adapters/drizzle-to-effect-schema.ts:67-77`, `adapters/drizzle-to-effect-schema.ts:142-160`, `adapters/drizzle-to-effect-schema.ts:188-204`).
- `BuildInsertSchema<TTable,TRefine>` and `BuildSelectSchema` intersect field schemas with the **refine argument types**, not the resolved output of refinement functions, so function refinements are not represented accurately (`adapters/drizzle-to-effect-schema.ts:67-77`, `adapters/drizzle-to-effect-schema.ts:106-118`).
- Static/runtime date mappings disagree: `ColumnSchema` describes PG timestamp/date Date-mode with encoded `string`, while runtime returns `S.DateFromSelf` (`adapters/drizzle-to-effect-schema.ts:31-40`, `adapters/drizzle-to-effect-schema.ts:234-241`).
- The “non-recursive” JSON schema admits arbitrary nested values via `Unknown`, so it is not a strict JSON validator (`adapters/drizzle-to-effect-schema.ts:51-65`).
- Many Drizzle features and column subclasses fall back to `S.Any`, losing constraints and sometimes the base type (`adapters/drizzle-to-effect-schema.ts:219-264`).

## 5. Honest weakness inventory

### 5.1 Every requested unsafe construct in `src`

There are 12 literal `as any` assertions, no `as unknown as`, and no `@ts-expect-error`/`@ts-ignore` in the final DSL source.

| File:line(s) | Unsafe construct | Purpose/effect |
|---|---|---|
| `combinators.ts:120` | `(self as any)[ColumnMetaSymbol]` | Reads metadata from plain schema or DSL field without a narrowing guard. |
| `combinators.ts:172,194,216,238,260,287,309` | each type-setting combinator ends `as any` | Forces the runtime annotated schema into the conditional `ValidateSchemaColumn` result, including error-shaped invalid returns. |
| `adapters/drizzle-to-effect-schema.ts:142,188` | `schemaEntries as any` | Feeds a broad mutable record to refinement callbacks. |
| `adapters/drizzle-to-effect-schema.ts:160,204` | `S.Struct(schemaEntries) as any` | Forces dynamic struct construction into the generic return types. |

There is one `as unknown as` in a **test**, intentionally proving that an invalid static combination still has metadata at runtime (`field-model-comprehensive.test.ts:682-687`).

Equivalent unsafe boundaries not matching the requested spellings are also material:

- `Model.ts` uses `UnsafeTypes.UnsafeAny` for `VS.Struct`, the `S.Class` self type, and the returned class (`Model.ts:459-469`, `Model.ts:497`).
- `types.ts` admits `any` throughout `DSL.Fields` and variant extraction (`types.ts:897-913`, `types.ts:975-1011`).
- The reverse adapter has pervasive `S.Schema<any>`, `column: any`, and `PgArray<any, any>` (`adapters/drizzle-to-effect-schema.ts:15-49`, `adapters/drizzle-to-effect-schema.ts:67-72`, `adapters/drizzle-to-effect-schema.ts:207-227`).
- The forward adapter uses a mapped-record assertion at `adapters/drizzle.ts:297-303`; it is safer-looking syntax but bears most of the same proof burden as `as any`.
- `Field.ts` casts the normalized config, cloned variant, schema input, and annotated output into their desired generic forms (`Field.ts:249-256`, `Field.ts:290-304`).

### 5.2 Invariants: advertised versus actually enforced

| Invariant | Type level | Runtime | Weakness |
|---|---|---|---|
| Schema encoded type compatible with explicit column type | `ValidateSchemaColumn` returns `SchemaColumnError` (`types.ts:82-150`). | Not checked; metadata is still attached (`Field.ts:249-304`). | Error at downstream use, not at call; bigint branch missing; semantic refinements are loose. |
| AI only on integer/bigint | Inert `ColumnDefSchema` member shape and unused `SupportsAutoIncrement`; broad `ColumnDef` permits all (`types.ts:467-489`, `types.ts:799-826`). | `Field` config throws; exported validator checks; combinator does not and private model validation omits the type check (`Field.ts:258-270`, `combinators.ts:369-372`, `Model.ts:224-245`). | `S.String.pipe(DSL.autoIncrement)` can reach adapter generation. |
| At most one AI per model | None. | Both standalone validator and private model validator enforce it (`validate.ts:295-330`, `Model.ts:224-245`). | Described as PostgreSQL necessity, but implemented as DSL policy; no dialect capability model. |
| PK is nonnullable | Adapter types force `NotNull`; no compile-time rejection (`adapters/drizzle.ts:75-81`). | Private `Model` checks AST; standalone `validateModel` hard-codes false nullability (`Model.ts:297-327`, `validate.ts:406-414`). | Two validator implementations disagree; optional property flag is missed. |
| Valid/nonempty identifiers | None beyond `string`. | Regex/length/empty checks (`validate.ts:128-206`, `validate.ts:262-280`). | Limit is documented as bytes but implemented as JS string length; logic is PostgreSQL-only (`errors.ts:84-88`, `validate.ts:128-147`). |
| Self generic supplied | `MissingSelfGeneric` diagnostic literal (`Model.ts:71-72`, `Model.ts:431-445`). | N/A. | Useful editor message, but requires repeating class name plus identifier. |
| Variant exclusion | Key-remapped mapped types (`types.ts:960-1018`). | VariantSchema extraction (`Model.ts:353-408`). | Model construction erases through `UnsafeAny`; tests labeled type-level assert runtime keys only. |
| Defaults reflected in insert typing | `HasDefault` modifier when metadata has a default (`adapters/drizzle.ts:91-97`). | Never emitted to Drizzle (`adapters/drizzle.ts:232-241`). | Static insert optionality can claim a database default that does not exist. |

### 5.3 Naming and dialect gaps

`ColumnDef` has no physical `name`; the field object key is passed directly to every PG builder (`types.ts:815-826`, `adapters/drizzle.ts:287-295`). A user wanting snake-case DB columns therefore has to use snake-case domain property keys or accept camelCase physical columns. Conversely, table names are always produced by a simple Pascal/camel-to-snake regex, with no manual override; the TODO explicitly asks to remove this automatic policy in favor of a parameter (`Model.ts:35-37`, `Model.ts:451-452`, `todos.md:1`). The naive conversion also splits acronyms letter by letter.

No dialect parameter connects column capability, identifier rules, or builder output. Forward generation is PG-only, reverse recognition is partly PG/MySQL/SQLite, and validation always applies PG naming rules (`adapters/drizzle.ts:22`, `adapters/drizzle.ts:281-286`, `adapters/drizzle-to-effect-schema.ts:1-4`, `validate.ts:55-72`).

### 5.4 Unfinished/dead areas

- `relations.ts` is one commented import (`relations.ts:1`).
- TODOs request manual table naming, relation support, model-level extra config, and a model factory for default audit fields (`todos.md:1-4`).
- `ColumnDefSchema`, all eight schema member classes, `ColumnDefSchema.SupportsAutoIncrement`, `WithColumnDef`, `FieldResult`, `ExtractColumnType`, `ExtractPrimaryKeys`, `ExtractEncodedTypes`, and `ColumnDef.Any` have no consumers outside their declarations/exports (`types.ts:491-847`, `types.ts:869-877`, `types.ts:927-946`, `types.ts:1155-1162`, `Field.ts:71-76`, `Model.ts:52-66`).
- `validate.ts` duplicates substantial private logic in `Model.ts` instead of being the model constructor’s source of truth (`validate.ts:1-17`, `Model.ts:144-347`).
- `DSLValidationErrorSchema` omits the aggregate error that `DSLValidationError` includes (`errors.ts:225-271`).
- `poc.test.ts` is empty. Five broad portions of `field-model-comprehensive.test.ts` are commented, including the most delicate type-derivation cases (`field-model-comprehensive.test.ts:77-214`, `field-model-comprehensive.test.ts:284-649`).
- The active Drizzle tests avoid the core end-consumer type (`InferSelectModel`) and mostly check existence (`drizzle-typed-columns.test.ts:31-160`, `drizzle-typed-columns.test.ts:339-454`).

### 5.5 Other correctness risks

- The broad `ColumnDef.defaultValue` type disagrees with the rich `ColumnDefSchema` default types and with the field’s schema type; defaults are not correlated with field `I` (`types.ts:452-461`, `types.ts:491-725`, `types.ts:815-826`).
- `defaultValueSchema` accepts functions using a false type predicate `u is A`, so its runtime function branch is represented statically as the scalar `A`, not `() => A` (`types.ts:452-461`).
- Default strings are accepted as arbitrary strings, conflating literal defaults with SQL expressions (`combinators.ts:378-410`).
- Plain schemas/raw variant fields without `Field` metadata default to string rather than deriving from their schema (`Model.ts:41-50`, `Model.ts:88-120`).
- Runtime column derivation and static schema derivation are separate algorithms and already document mismatches around wrappers, literals, and variants (`derive-column-type.ts:35-58`, `types.ts:275-399`, `field-model-comprehensive.test.ts:924-933`, `field-model-comprehensive.test.ts:975-978`).
- The error aggregate stores its children as `S.Unknown`, weakening serializable tagged-error structure (`errors.ts:225-233`).
- Mutable `WeakSet` traversal shared across a union treats any repeated AST object as a cycle (`derive-column-type.ts:61-64`, `derive-column-type.ts:386-390`; `nullability.ts:34-41`, `nullability.ts:61-65`).

## 6. Evolution from `git log`

`git log -- packages/common/schema/src/integrations/sql/dsl` shows a three-day burst and five commits:

1. **`55678a6a16` — 2025-12-26, “saving dsl design work.”** Added a single 208-line `dsl.ts` plus barrel export. This was a generic database-field configuration vocabulary: primitive/type schemas, validation hooks, reference/on-delete metadata, transform hooks, field-name override, sorting/index flags, and other ambitions. It had no `Field`/`Model`/Drizzle derivation pipeline yet.
2. **`2f0b57b18a` — 2025-12-27, “beep specific language.”** Deleted `dsl.ts` and introduced `Field.ts`, `Model.ts`, `types.ts`, the PG adapter, and the first large variant/typed-column/POC tests (2,696 insertions, 209 deletions in this path). This is the architectural pivot to “Effect schema + attached SQL metadata + model variants.”
3. **`5fbe690524` — 2025-12-28, “updated deps made hella progress on DSL.”** Added the AST derivation, nullability, combinators, tagged errors, Effect validators, reverse adapter, literals, TODO/relations stubs, and comprehensive/invariant tests. This was the maximum feature expansion (5,711 insertions, 352 deletions in source/tests).
4. **`9620c36b46` — 2025-12-28, “saving.”** Expanded `types.ts` heavily, especially precise schema-derived types and tagged column-definition generics (750 insertions, 215 deletions across the path). Non-AI generic members explicitly used `autoIncrement?: undefined` at this point.
5. **`2a0b9db8d3` — 2025-12-28, “saving.”** Simplified/reformatted the type layer, replaced richer config/base types with broad `ColumnDef`, removed the `autoIncrement?: undefined` member guards, deleted `derive-column-type.test.ts`, `invariants/sql-standard.test.ts`, and the POC body, and commented much of the comprehensive derivation suite (724 insertions, 1,895 deletions in source/tests). The archive ends in a smaller but less proven state.

The story is therefore not monotonic hardening. It moved from broad database metadata, to a focused Effect/VariantSchema/Drizzle architecture, to a rich invariant experiment, then ended with simplification that removed some of the strongest constraints and tests.

## 7. Verdict for the Effect v4 + Drizzle rc5 rebuild

### Keep, ranked

1. **Schema field as the single semantic source, with encoded-side SQL projection.** This is the foundational win: `A/I/R` remain intact and storage typing is based on `I`, not decoded application `A` (`types.ts:865-867`, `types.ts:1110-1153`). In v4, make the SQL node a schema-attached, versioned annotation with one authoritative read path.
2. **Variant-aware fields and six model projections.** The integration with Generated/Sensitive/GeneratedByApp/FieldOption removes duplicated insert/select/API schemas and has clear runtime semantics (`Model.ts:353-408`, `types.ts:1028-1053`). Port it against v4’s actual Model/variant primitives without cloning opaque objects or using `UnsafeAny`.
3. **Key-remapped, tuple-wrapped variant extraction.** `ExtractVariantFields` / `ShouldIncludeField` / `ExtractFieldSchema` is the cleanest type-level trick in the archive and should survive almost verbatim conceptually (`types.ts:960-1018`).
4. **Readable diagnostic result types for invalid field metadata.** The template-literal `SchemaColumnError` is excellent editor UX (`types.ts:125-150`). Improve it into an uninhabitable branded diagnostic or constrain the input so the error occurs at the configuration argument—not as a callable result that exists at runtime.
5. **AST-derived encoded nullability with transform-side selection and cycle protection.** The idea is correct and handles `FieldOption` naturally (`nullability.ts:34-100`, `adapters/drizzle.ts:163-205`). Rebuild it around v4 AST APIs, explicitly handle property-signature optionality, and share one derivation result between validation and adapters.
6. **A discriminated column algebra with capability-specific members.** `ColumnDefSchema.GenericMap` avoids phantom parameters and can model valid features by construction (`types.ts:729-810`). Make this the actual configuration accepted by fields; do not keep a broader parallel `ColumnDef` that erases its constraints.
7. **Typed builder-modifier composition.** `ApplyNotNull` → `ApplyPrimaryKey` → `ApplyHasDefault` → `ApplyAutoincrement` → `$Type` is a useful specification of desired Drizzle output (`adapters/drizzle.ts:64-132`). In the rebuild, each runtime builder function must return the same generic it claims, with compile fixtures over `InferSelectModel` and `InferInsertModel` from emitted declarations.
8. **Tagged, serializable validation errors.** Effect errors with stable codes, paths, expected/received, and suggestions are worth retaining (`errors.ts:45-63`, `errors.ts:69-234`). Use one validator implementation and make the aggregate schema recursively type its members.

### Kill or replace, ranked

1. **Kill synthetic output typing by accumulator/return assertion.** If field-specific `EncodedType` is not inferable in the runtime builder call, the adapter has not proven its output (`adapters/drizzle.ts:214-218`, `adapters/drizzle.ts:287-309`). Use a typed fold/helper whose key, field, metadata, and builder stay correlated, and test generated `.d.ts` consumption.
2. **Kill the parallel broad `ColumnDef`.** It disconnects the live API from `ColumnDefSchema`, re-allows invalid AI combinations, narrows defaults incorrectly, and creates dead code (`types.ts:729-847`). One dialect-indexed discriminated definition should serve runtime schema, config, derivation, and adapter.
3. **Kill “invalid call returns an error interface but constructs a field.”** It is surprising and unsound (`types.ts:131-150`, `field-model-comprehensive.test.ts:682-687`). Reject at the config parameter or return an actual validated Result/Effect if runtime dynamic configuration is allowed.
4. **Kill raw string defaults.** They are neither schema-correlated nor emitted, and conflate values with SQL (`combinators.ts:378-410`, `adapters/drizzle.ts:232-241`). Model `Default.value(encodedValue)`, `Default.sql(SQL)`, dialect functions such as `now`, and application-generated values separately.
5. **Kill automatic physical naming as the only option.** Preserve a domain property key separately from `columnName` and require/allow an explicit `tableName`; do not make users encode physical names into model keys (`Model.ts:35-37`, `Model.ts:451-452`, `adapters/drizzle.ts:287-295`, `todos.md:1`).
6. **Kill duplicated runtime/static derivation and duplicated validators.** One normalized intermediate representation should be produced once, with static types mirroring it and runtime validation consuming it (`derive-column-type.ts:35-198`, `types.ts:275-450`, `validate.ts:1-17`, `Model.ts:144-347`).
7. **Kill silent string/JSON fallbacks for unknown cases in strict mode.** Plain fields becoming strings and unsupported declarations/unions becoming JSON hide modeling errors (`Model.ts:88-120`, `derive-column-type.ts:319-331`, `derive-column-type.ts:386-401`). Require explicit overrides when derivation is ambiguous; optionally offer a permissive mode separately.
8. **Replace the universal eight-type vocabulary with a dialect-indexed capability algebra.** PostgreSQL rc5 builders, SQLite/MySQL differences, serial/identity behavior, timestamp modes, numeric precision, arrays/enums/custom types, identifier policy, indexes/FKs/checks, and relations cannot be faithfully expressed by the current union (`literals.ts:27-40`, `adapters/drizzle.ts:44-62`, `relations.ts:1`).
9. **Do not revive the reverse adapter in its current form.** Either make forward derivation the product and omit reverse generation, or rebuild reverse generation as a separate, tested package with dialect-specific exhaustive mappings. The orphaned `S.Any`-heavy implementation gives a false sense of completeness (`adapters/drizzle-to-effect-schema.ts:12-49`, `adapters/drizzle-to-effect-schema.ts:207-264`, `index.ts:1-16`).

### Recommended rebuild shape

A v4 rebuild should normalize every field into a single internal value roughly equivalent to `{ propertyKey, columnName, schema, selectSchema, encodedNullability, dialectColumn, constraints, default, generation, variants }`. A dialect interpreter should validate and build the exact Drizzle rc5 column while retaining the field key/type correlation. Model construction should consume that same normalized value for variants, errors, table metadata, and generated migrations. Acceptance should include negative compile fixtures, runtime DDL snapshots, and a separate-package declaration-consumer fixture proving `InferSelectModel` and `InferInsertModel`; the v3 archive’s own test comments show that source-local `expectTypeOf` is not sufficient (`drizzle-typed-columns.test.ts:339-353`).
