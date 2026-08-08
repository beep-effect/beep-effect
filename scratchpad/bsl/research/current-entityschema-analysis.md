# Current beep-effect20 entity/table modeling stack

Research snapshot: repository `beep-effect20`, branch `main`, HEAD `7de4967475`, inspected 2026-08-08. All conclusions below are about the live source at that revision, not older package documentation or a predecessor checkout.

## Executive finding: the current stack is newer than the mission premise

There are four layers in the live implementation:

1. `VariantSchema` is the generic variant engine. `Model` specializes it to six model variants: `select`, `insert`, `update`, `json`, `jsonCreate`, and `jsonUpdate` (`packages/foundation/modeling/schema/src/Model/Model.variants.ts:13-182`).
2. `EntitySchema` is the current schema/persistence facade. It binds field schemas to persistence descriptors, derives model variants from value strategies, attaches a typed `definition`, derives names, and validates encoded absence semantics (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:43-61`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:272-290`).
3. `BaseEntity` adds shared identity/audit fields and is the product-facing entity factory (`packages/shared/domain/src/entity/BaseEntity.ts:81-143`, `packages/shared/domain/src/entity/BaseEntity.ts:186-247`).
4. `EntityTable.pgTableFrom` projects an entity definition into a typed **Postgres** Drizzle table (`packages/drivers/drizzle/src/EntityTable.models.ts:213-224`, `packages/drivers/drizzle/src/EntityTable.models.ts:509-517`).

The older `DomainModel` remains exported, but live slice entities do not use it: the only direct package import found is its own test (`packages/foundation/modeling/schema/test/DomainModel.test.ts:2`), while the public barrel still exports it (`packages/foundation/modeling/schema/src/index.ts:112`). A live-source audit found 43 `extends BaseEntity.Class` declarations across 41 slice-domain files, but no direct slice use of `EntitySchema.ClassFactory` other than `BaseEntity` itself. This is important for successor design: the real compatibility target is `BaseEntity.Class` + `EntitySchema` + `EntityTable`, not a hypothetical `DomainModel.make` API.

Two other premise corrections are material:

- There is no `sqlMetadata` identifier anywhere under `packages/` at this revision. The current equivalent is a parallel `persisted` map of `PersistDescriptor`s (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:211-221`).
- The current type relation is **not completely uncorrelated**: `S.Int` cannot carry a `text`/varchar descriptor. It is, however, only correlated by broad encoded JavaScript carrier type. Any number-encoded schema may choose `entityId`, `int`, or `timestampMillis`; any string-encoded schema may choose `literal` or `text` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:505-534`). That prevents the most blatant mismatch while still failing to encode SQL-semantic distinctions.

The current system also does not produce `S.Opaque` entities. Entity classes are constructed through `S.Class`; no `Opaque`/`S.Opaque` use exists in the inspected modeling stack. The nominal pieces are `S.Class` instances plus branded entity-id values (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:374-435`, `packages/shared/domain/src/entity/EntityId.ts:89-145`).

## 1. Model, DomainModel, and EntitySchema

### 1.1 `Model/` complete public API inventory

`packages/foundation/modeling/schema/src/Model/index.ts` is a pure barrel and re-exports every symbol from the six implementation files (`packages/foundation/modeling/schema/src/Model/index.ts:14-39`).

#### `Model.codecs.ts`

The only API is `JsonFromString`, which uses text JSON for database variants and the original schema for JSON API variants (`packages/foundation/modeling/schema/src/Model/Model.codecs.ts:29-37`, `packages/foundation/modeling/schema/src/Model/Model.codecs.ts:62-72`):

```ts
export interface JsonFromString<S extends S.Top>
  extends VariantSchema.Field<{
    readonly select: S.fromJsonString<S>;
    readonly insert: S.fromJsonString<S>;
    readonly update: S.fromJsonString<S>;
    readonly json: S;
    readonly jsonCreate: S;
    readonly jsonUpdate: S;
  }> {}

export const JsonFromString = <S extends S.Top>(schema: S): JsonFromString<S> => {
  const parsed = schema.pipe(S.toCodecJson, S.fromJsonString) as TUnsafe.Any;
  // ...Field({ select/insert/update: parsed, json/jsonCreate/jsonUpdate: schema })
};
```

The assertion at line 63 is one of the live type-safety escape hatches.

#### `Model.datetime.ts`

The date/time API is:

| Export | Trimmed signature / variant shape | Source |
|---|---|---|
| `Date` | `const Date = S.String.pipe(S.decodeTo(S.DateTimeUtc, ...))` | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:33-41` |
| `Date` type | `type Date = typeof Date.Type` | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:59` |
| `DateWithNow` | `Overridable(Date, { defaultValue: Effect.map(DateTime.now, DateTime.removeTime) })` | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:75-77` |
| `DateTimeWithNow` | `Overridable(S.DateTimeUtcFromString, { defaultValue: DateTime.now })` | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:93-95` |
| `DateTimeFromDateWithNow` | `Overridable(S.DateTimeUtcFromDate, { defaultValue: DateTime.now })` | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:111-113` |
| `DateTimeFromNumberWithNow` | `Overridable(S.DateTimeUtcFromMillis, { defaultValue: DateTime.now })` | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:129-131` |
| `DateTimeInsert` | `Field<{ select: DateTimeUtcFromString; insert: Overridable<DateTimeUtcFromString>; json: DateTimeUtcFromString }>` | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:148-182` |
| `DateTimeInsertFromDate` | select/insert are `DateTimeUtcFromDate`; JSON is `DateTimeUtcFromString` | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:199-233` |
| `DateTimeInsertFromNumber` | select/insert/JSON use `DateTimeUtcFromMillis` | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:250-284` |
| `DateTimeUpdate` | string-backed select; overridable insert and update; string JSON | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:301-338` |
| `DateTimeUpdateFromDate` | date-backed select/insert/update; string JSON | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:355-392` |
| `DateTimeUpdateFromNumber` | millis-backed select/insert/update/JSON | `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:409-446` |

The three insert helpers expose no `update`, `jsonCreate`, or `jsonUpdate`; the update helpers expose both database write variants but still omit both JSON write variants (`packages/foundation/modeling/schema/src/Model/Model.datetime.ts:148-153`, `packages/foundation/modeling/schema/src/Model/Model.datetime.ts:301-307`).

#### `Model.fields.ts`

These are the general variant combinators:

| Export | Exact variant membership | Source |
|---|---|---|
| `Generated<S>` / `Generated(schema)` | `select`, `update`, `json`; omitted from `insert` | `packages/foundation/modeling/schema/src/Model/Model.fields.ts:32-37`, `packages/foundation/modeling/schema/src/Model/Model.fields.ts:62-67` |
| `GeneratedByApp<S>` / constructor | `select`, `insert`, `update`, `json`; omitted from JSON writes | `packages/foundation/modeling/schema/src/Model/Model.fields.ts:85-91`, `packages/foundation/modeling/schema/src/Model/Model.fields.ts:114-120` |
| `GeneratedByAppOnInsert<S>` / constructor | `select`, `insert`, `json`; omitted from update and JSON writes | `packages/foundation/modeling/schema/src/Model/Model.fields.ts:140-145`, `packages/foundation/modeling/schema/src/Model/Model.fields.ts:169-174` |
| `Sensitive<S>` / `Sensitive(schema)` | `select`, `insert`, `update`; excluded from every JSON variant | `packages/foundation/modeling/schema/src/Model/Model.fields.ts:192-197`, `packages/foundation/modeling/schema/src/Model/Model.fields.ts:220-225` |
| `optionalOption<S>` / constructor | decodes `optionalKey(NullOr<S>)` to `Option<S.Type>` | `packages/foundation/modeling/schema/src/Model/Model.fields.ts:245-274` |
| `FieldOption<S>` | DB variants use `S.OptionFromNullOr`; JSON variants use `optionalOption` | `packages/foundation/modeling/schema/src/Model/Model.fields.ts:299-307` |
| `FieldOption(field)` | accepts a plain schema or existing variant field and evolves every present variant | `packages/foundation/modeling/schema/src/Model/Model.fields.ts:330-349` |

The two Option implementations contain the second and third broad assertions in `Model/`: the optional transformation is cast to `TUnsafe.Any`, and the fully generic `fieldEvolve` result is cast to `TUnsafe.Any` (`packages/foundation/modeling/schema/src/Model/Model.fields.ts:264-274`, `packages/foundation/modeling/schema/src/Model/Model.fields.ts:330-349`).

#### `Model.sqlite.ts`

SQLite support is one standalone variant field (`packages/foundation/modeling/schema/src/Model/Model.sqlite.ts:25-61`):

```ts
export interface BooleanSqlite
  extends VariantSchema.Field<{
    readonly select: S.BooleanFromBit;
    readonly insert: S.BooleanFromBit;
    readonly update: S.BooleanFromBit;
    readonly json: S.Boolean;
    readonly jsonCreate: S.Boolean;
    readonly jsonUpdate: S.Boolean;
  }> {}

export const BooleanSqlite: BooleanSqlite = Field({ /* same mapping */ });
```

It is not integrated with the current `EntityTable` projector, whose table type hard-codes `dialect: "pg"` (`packages/drivers/drizzle/src/EntityTable.models.ts:213-224`). This is a disconnected dialect-specific codec, not dialect-aware narrowing.

#### `Model.uuid.ts`

The UUID API uses branded binary values (`packages/foundation/modeling/schema/src/Model/Model.uuid.ts:30-36`, `packages/foundation/modeling/schema/src/Model/Model.uuid.ts:52-110`):

```ts
export interface UuidV4Insert<B extends string>
  extends VariantSchema.Field<{
    readonly select: S.brand<S.instanceOf<Uint8Array<ArrayBuffer>>, B>;
    readonly insert: Overridable<S.brand<S.instanceOf<Uint8Array<ArrayBuffer>>, B>>;
    readonly update: S.brand<S.instanceOf<Uint8Array<ArrayBuffer>>, B>;
    readonly json: S.brand<S.instanceOf<Uint8Array<ArrayBuffer>>, B>;
  }> {}

export const Uint8Array: S.instanceOf<Uint8Array<ArrayBuffer>> = /* assertion */;
export const UuidV4WithGenerate = <B extends string>(schema: ...): Overridable<...> => ...;
export const UuidV4Insert = <const B extends string>(schema: ...): UuidV4Insert<B> => ...;
```

`UuidV4WithGenerate` supplies an `Effect.sync` constructor default using `Uuid.v4` (`packages/foundation/modeling/schema/src/Model/Model.uuid.ts:74-79`).

#### `Model.variants.ts`

The module specializes `VariantSchema.make` with this exact fixed family (`packages/foundation/modeling/schema/src/Model/Model.variants.ts:13-182`):

```ts
const modelVariants = ["select", "insert", "update", "json", "jsonCreate", "jsonUpdate"] as const;

const { Class, Field, FieldExcept, FieldOnly, Struct, Union, extract, fieldEvolve } =
  VariantSchema.make({ variants: modelVariants, defaultVariant: "select" });
```

Its complete public surface is:

- `Class`, `Field`, `FieldExcept`, `FieldOnly`, `Struct`, `Union`, `extract`, and `fieldEvolve`, re-exported from the specialized API (`packages/foundation/modeling/schema/src/Model/Model.variants.ts:321-456`).
- `Any`, requiring a schema with `.fields`, `.insert`, `.update`, `.json`, `.jsonCreate`, and `.jsonUpdate` (`packages/foundation/modeling/schema/src/Model/Model.variants.ts:201-208`).
- `VariantsDatabase = "select" | "insert" | "update"`, `VariantsJson = "json" | "jsonCreate" | "jsonUpdate"`, `Variant`, and `DefaultVariant = "select"` (`packages/foundation/modeling/schema/src/Model/Model.variants.ts:225-276`).
- `ClassShape<Self, Fields, Static = {}, Inherited = {}>`, which combines the class core and inherited static members (`packages/foundation/modeling/schema/src/Model/Model.variants.ts:278-317`).
- `fields(self)`, exposing the raw variant-aware field record (`packages/foundation/modeling/schema/src/Model/Model.variants.ts:475-476`).
- `Override(value)`, `Overridable` and misspelling-compatible `Overrideable` interfaces/constructors (`packages/foundation/modeling/schema/src/Model/Model.variants.ts:497-575`).

### 1.2 How the variant factory actually builds classes

The underlying API contract is defined by `MakeApi` (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:530-607`):

```ts
type MakeApi<Variants extends string, Default extends Variants> = {
  readonly Struct: <const A extends Struct.Fields>(fields: A & Struct.Validate<A, Variants>) => Struct<A>;
  readonly Field: <const A extends Field.ConfigWithKeys<Variants>>(config: A & ...) => Field<A>;
  readonly FieldOnly: <const Keys extends ReadonlyArray<Variants>>(keys: Keys) =>
    <S extends S.Top>(schema: S) => Field<{ readonly [K in Keys[number]]: S }>;
  readonly FieldExcept: <const Keys extends ReadonlyArray<Variants>>(keys: Keys) =>
    <S extends S.Top>(schema: S) => Field<{ readonly [K in Exclude<Variants, Keys[number]>]: S }>;
  readonly fieldEvolve: { /* data-first and data-last overloads */ };
  readonly Class: <Self = never>(identifier: string) =>
    <const Fields extends StructInput>(fields: ..., annotations?: ...) => ClassShape<...>;
  readonly Union: <const Members extends ReadonlyArray<AnyStruct>>(members: Members) => Union<...>;
  readonly extract: { /* data-first and data-last overloads */ };
};
```

`Struct` and `Field` both implement `Pipeable`, so field combinators compose with `.pipe(...)` (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:54-58`, `packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:143-146`, `packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:753-768`). `fieldEvolve` accepts either a plain schema or a variant field; a plain schema is first expanded to every variant, then only the requested variant schemas are mapped (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:718-731`).

`extract` walks the field record. Plain schemas are present in all variants; `Field` values are present only where their `schemas` record has the requested key; nested `Struct`s recurse. Results are cached per variant and built as `S.Struct` (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:247-260`, `packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:289-337`).

The class path is a runtime augmentation of `S.Class`, not an opaque-class constructor:

```ts
const ClassFactory = S.Class as unknown as SchemaClassFactory;
// ...
const schema = extract(variantStruct, options.defaultVariant, { isDefault: true });
const Base = ClassFactory(identifier)(schema, annotations);
return attachClass(Base, identifier, variantStruct, Base.extend);
```

`attachClass` places the variant-field record on the class, replaces `mapFields` and `extend`, and defines a schema static for each configured variant (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:626-693`). The resulting class contract includes `extend`, readonly `.fields`, static `.make`, `mapFields`, and a constructor (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:374-435`). The implementation closes with a second double assertion to `MakeApi` (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:740-750`).

### 1.3 Defaults: constructor behavior, not persistence defaults

The reusable default factory is `Overridable` (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.overridable.ts:49-66`, `packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.overridable.ts:89-110`):

```ts
export const Overridable: {
  <S extends S.Top & S.WithoutConstructorDefault>(options: {
    readonly defaultValue: Effect.Effect<S["~type.make.in"]>;
  }): (schema: S) => Overridable<S>;
  <S extends S.Top & S.WithoutConstructorDefault>(schema: S, options: {
    readonly defaultValue: Effect.Effect<S["~type.make.in"]>;
  }): Overridable<S>;
} = dual(2, (schema, options) =>
  schema.pipe(
    S.decodeTo(S.toType(schema).pipe(S.brand("Override"))),
    S.withConstructorDefault(Effect.map(options.defaultValue, Override))
  ) as Overridable<S>
);
```

The default comes from `S.withConstructorDefault`: it affects `.make(...)` input and can be bypassed with the `Override` brand. It is not a database `DEFAULT`, and the Drizzle projection emits no default clause. Date/time and UUID helpers merely package this constructor behavior (`packages/foundation/modeling/schema/src/Model/Model.datetime.ts:75-131`, `packages/foundation/modeling/schema/src/Model/Model.uuid.ts:74-79`).

### 1.4 `DomainModel.ts`: exact role and limitations

`DomainModel` is an older reusable `Model.Class` base with these fields (`packages/foundation/modeling/schema/src/DomainModel.ts:36-45`):

```ts
export const defaultFields = {
  createdAt: Model.DateTimeInsertFromNumber,
  updatedAt: Model.DateTimeUpdateFromNumber,
  deletedAt: Model.FieldOption(S.DateTimeUtcFromMillis),
  createdBy: Model.FieldOption(S.String),
  updatedBy: Model.FieldOption(S.String),
  deletedBy: Model.FieldOption(S.String),
  version: Model.Generated(NonNegativeInt),
  source: Model.FieldOption(S.String),
} as const;

export class DomainModel extends Model.Class<DomainModel>($I`DomainModel`)(defaultFields, annotations) {}
```

It deliberately has no id (`packages/foundation/modeling/schema/src/DomainModel.ts:15-21`). It has no persistence descriptors, entity metadata, table projection contract, or `make` factory function of its own. It only inherits the class-level `.make`/`.extend` behavior from `Model.Class` (`packages/foundation/modeling/schema/src/DomainModel.ts:47-74`). A successor may remove or isolate this layer with low product blast radius, but the public export and its test are still compatibility surfaces (`packages/foundation/modeling/schema/src/index.ts:112`, `packages/foundation/modeling/schema/test/DomainModel.test.ts:2-63`).

### 1.5 Current `EntitySchema` public API inventory

The live entity facade is split into seven implementation files plus a barrel:

- `EntitySchema.fields.ts`: `Fields`, `EntityVariantFieldInput`, `EntityFieldInput`, `EntityFieldInputs`, `SelectedFieldOf`, and `SelectedFieldsOf` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.fields.ts:26-140`). A field may be a plain `S.Top` or a `VariantSchema.Field` with a required `select` schema (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.fields.ts:52-92`).
- `EntitySchema.persist.ts`: `StorageKind`, `ValueStrategy`/`PersistStrategy`, `IndexHintKind`, `IndexHint`, `EncodedAbsenceKind`, `PersistOptions`, `PersistDescriptor`, the runtime descriptor schema/statics, correlation types, and persisted-map types (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:29-647`).
- `EntitySchema.definition.ts`: `Definition`, encoded/decoded shape types, naming types, `ClassInput`, `defineClassInput`, strategy-to-variant types, `EntityClass`, merge helpers, and `assignEntityParts` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:43-526`).
- `EntitySchema.constructors.ts`: `persist.*`, `DateTimeFromMillis`, `int`, `literal`, `tableNameFromIdentifier`, and dual `columnNameFor` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.constructors.ts:19-171`).
- `EntitySchema.factory.ts`: `ClassFactory` type/value and `getDefinition` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:60-87`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:579-627`).
- `EntitySchema.shape.ts`: two typed errors, `EncodedFieldShape`, `encodedAstFor`, `encodedFieldShape`, dual `selectedRowFieldShape`, `isEncodedNullable`, and `isEncodedOptional` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.shape.ts:63-102`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.shape.ts:197-383`).
- `EntitySchema.shared.ts`: `$I` and `DefinitionAnnotationKey = "@beep/schema/EntitySchema/definition"` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.shared.ts:25-41`).
- `EntitySchema.index.ts`: re-exports the seven modules (`packages/foundation/modeling/schema/src/EntitySchema/index.ts:1-46`).

The root constructor is (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:579-592`):

```ts
export const ClassFactory =
  (identifier: string) =>
  <const FieldMap extends EntityFieldInputs,
   const Persisted extends PersistedFor<FieldMap>,
   const TableName extends string = string,
   const EntityId extends EntityIdLike | undefined = undefined>(
    input: ClassInput<FieldMap, Persisted, TableName, EntityId>,
    annotations?: SchemaAnnotations
  ): ClassFactory<TypeShape<FieldMap>, FieldMap, Persisted, TableName, EntityId> => ...;
```

The returned class also owns an inheritable `.Class<Child>(identifier)(input, annotations)` factory. Its type merges base/child fields and persistence maps and preserves the parent instance type as inherited state (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:60-87`).

The attached definition is the stable metadata nucleus (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:43-61`):

```ts
export type Definition<...> = {
  readonly fields: SelectedFieldMap;
  readonly inputFields: FieldMap;
  readonly persisted: Persisted;
  readonly tableName: TableName;
  readonly variantFields: VariantFieldsFor<FieldMap, Persisted>;
} & (EntityId extends EntityIdLike ? { readonly entityId: EntityId } : { readonly entityId?: never });
```

`normalizeDefinition` selects each field's `select` schema, derives variant fields, and picks the table name in this order: explicit `input.tableName`, `input.entityId.tableName`, then snake-case of the identifier's final path segment (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:272-290`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.constructors.ts:120-141`). It attaches the same definition as a static and as an AST annotation; `getDefinition` prefers a matching annotation and falls back to the static (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:293-340`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:614-627`).

### 1.6 How persistence metadata attaches, and exactly how it is correlated

Persistence metadata is not stored on each schema node. Authors provide a second key-correlated object:

```ts
export type ClassInput<
  FieldMap extends EntityFieldInputs,
  Persisted extends PersistedFor<FieldMap>,
  ...
> = {
  readonly entityId?: EntityId;
  readonly fields: FieldMap;
  readonly persisted: CheckedPersistedFor<FieldMap, Persisted>;
  readonly tableName?: TableName;
};
```

(`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:211-221`). `PersistedFor` requires one descriptor for every field key, while `CheckedPersistedFor` rejects extra keys (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:597-650`). This gives key-level correlation but forces the parallel `fields`/`persisted` declaration.

All descriptor constructors share one generic, independent metadata shape (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:306-367`):

```ts
export type PersistOptions<
  Strategy extends PersistStrategy = "provided",
  ColumnName extends string | undefined = string | undefined,
  IndexHints extends ReadonlyArray<IndexHint> | undefined = undefined,
> = {
  readonly columnName?: ColumnName;
  readonly indexHints?: IndexHints;
  readonly valueStrategy?: Strategy;
};

export type PersistDescriptor<
  TStorageKind extends StorageKind = StorageKind,
  TValueStrategy extends PersistStrategy = PersistStrategy,
  TColumnName extends string | undefined = string | undefined,
  TIndexHints extends ReadonlyArray<IndexHint> | undefined = ReadonlyArray<IndexHint> | undefined,
> = /* shape carrying those four dimensions */;
```

This is the exact source of the remaining non-correlation: `PersistDescriptor` itself has no schema parameter. Correlation is imposed one level later by `PersistDescriptorFor<Schema>` and is based only on `Schema`'s **encoded carrier** (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:505-559`):

```ts
type NumericStorage<Encoded> =
  NonNullish<Encoded> extends number
    ? PersistDescriptor<"entityId" | "int" | "timestampMillis">
    : never;

type TextStorage<Encoded> =
  NonNullish<Encoded> extends string
    ? PersistDescriptor<"literal" | "text">
    : never;

export type PersistDescriptorFor<Schema extends S.Top> =
  Schema["~encoded.optionality"] extends "optional" ? never
    : [S.Codec.DecodingServices<Schema>] extends [never]
      ? [S.Codec.EncodingServices<Schema>] extends [never]
        ? PersistDescriptorForEncoded<S.Codec.Encoded<Schema>>
        : never
      : never;
```

Consequences:

- `S.Int + persist.text()` is rejected, so the old “integer with varchar metadata” failure is fixed (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:508-517`).
- `S.Int + persist.entityId()` and `S.Int + persist.timestampMillis()` are accepted because all three encode as `number`. A successor should correlate nominal/semantic schema families, not merely primitive carriers (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:508-534`).
- `IndexHint` is storage-neutral, and `PersistOptions` accepts any hint array for every constructor. Invalid combinations are filtered at runtime, not rejected at the authoring site (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:162-217`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:306-314`).
- The runtime `PersistDescriptor.Any` erases all correlations back to `{ storageKind: StorageKind; valueStrategy: PersistStrategy; ... }` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:384-396`).

The current storage vocabulary is fixed to nine logical kinds: `blob`, `bool`, `entityId`, `int`, `jsonb`, `literal`, `text`, `timestampDate`, and `timestampMillis` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:29-43`). The lifecycle vocabulary is also fixed to nine strategies (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:78-92`). This is enough for current ordinary entities but cannot describe numeric widths, decimals, arrays, enums, geometric/range/vector types, dialect-native JSON differences, generated expressions, arbitrary database defaults, or user-defined types.

### 1.7 Variant derivation from persistence strategy

The type-level mapping is explicit (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:264-287`):

| `valueStrategy` | Derived `Model` helper | Effective write behavior |
|---|---|---|
| `generatedOnInsert` | `Model.Generated` | omitted from insert; present on update |
| `incrementedOnWrite` | `Model.Generated` | omitted from insert; present on update |
| `defaultedOnInsert` | timestamp-specific insert helper, else `GeneratedByApp` | constructor default for timestamps; JSON create omitted |
| `updatedOnWrite` | timestamp-specific update helper, else `GeneratedByApp` | insert/update accepted internally; JSON writes omitted |
| `computedByServiceOnInsert` | `GeneratedByAppOnInsert` | internal insert only, immutable thereafter |
| `providedByContext`, `derived`, `computedByService` | `GeneratedByApp` | DB variants present; JSON writes omitted |
| `provided` | original field | present in all variants unless author supplied an explicit variant field |

The runtime mapping mirrors this table (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:342-387`). If an author supplies a `Model.Field` explicitly, the factory preserves it but validates that its variant membership agrees with the descriptor strategy (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:173-260`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:389-418`). That explicit-helper escape hatch is useful and should survive.

### 1.8 Nullability/absence derivation

Nullability is derived from the **encoded** AST, not from manually supplied SQL flags. `encodedAstFor` calls `AST.toEncoded(field.ast)`; `encodedFieldShape` then combines AST union members with `AST.isOptional` and returns `allowsNull`, `allowsUndefined`, `isOptional`, `isAmbiguous`, and a nine-way `absenceKind` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.shape.ts:253-319`).

The classifier recognizes null, undefined/void, unions, suspensions, JSON declarations, and known required `Date`/`Uint8Array` declarations. Unknown declaration forms are marked ambiguous (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.shape.ts:120-171`). `selectedRowFieldShape` rejects ambiguous declarations, optional keys, and any encoded `undefined`; persisted selected rows must represent SQL absence with `null` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.shape.ts:337-349`).

The Drizzle projector uses the same rule at runtime and a parallel type-level `null extends Encoded` check. Generated ids become primary keys; otherwise nullable schemas remain nullable and all other columns receive `.notNull()` (`packages/drivers/drizzle/src/EntityTable.models.ts:63-114`, `packages/drivers/drizzle/src/EntityTable.models.ts:257-272`). This is one of the strongest pieces of the current design: the domain schema is the source of nullability truth.

## 2. Entity ids and model integration

### 2.1 Value and brand structure

The storage-neutral base is an integer codec constrained to 1 through 2,147,483,647 and branded `EntityIdValue` (`packages/shared/domain/src/entity/EntityId.ts:89-106`):

```ts
export const EntityIdValue = PosInt.check(
  S.isBetween({ minimum: 1, maximum: 2_147_483_647 }, ...)
).pipe(S.brand("EntityIdValue"), ..., SchemaUtils.withCodecStatics);

export type EntityIdValue = typeof EntityIdValue.Type;
export type EntityIdValueFor<TBrand extends string> = BrandNS.Branded<EntityIdValue, TBrand>;
```

Each concrete id adds a second brand at the decoded type level while retaining `number` as its encoded representation (`packages/shared/domain/src/entity/EntityId.ts:124-145`, `packages/shared/domain/src/entity/EntityId.ts:402-410`).

### 2.2 Deterministic metadata factory

`EntityId.factory` has data-first and data-last overloads and returns a slice-scoped `Maker` (`packages/shared/domain/src/entity/EntityId.ts:453-471`):

```ts
type Maker<Slice extends string> = <const Name extends string,
  const Overrides extends OptionsInput | undefined = undefined>(
  name: Name,
  overrides?: Overrides
) => EntityId<Slice, Name, ResolvedTableName<...>, ResolvedResource<...>,
                ResolvedEntityType<...>, ResolvedBrand<...>>;

type Factory = {
  <const Slice extends string>(slice: Slice, identity: IdentityComposer<string>): Maker<Slice>;
  (identity: IdentityComposer<string>): <const Slice extends string>(slice: Slice) => Maker<Slice>;
};
```

Defaults are literal-preserving:

- table: `` `${Slice}_${Name}` `` (`packages/shared/domain/src/entity/EntityId.ts:206`);
- resource: `` `${Slice}.${Name}` `` (`packages/shared/domain/src/entity/EntityId.ts:223`);
- entity type: Pascal-cased slice + name (`packages/shared/domain/src/entity/EntityId.ts:225-243`);
- brand: `` `${EntityType}Id` `` (`packages/shared/domain/src/entity/EntityId.ts:260`).

`Options` permits constrained overrides for brand, description, entity type, resource, and table name, representing missing values as `Option.none` defaults (`packages/shared/domain/src/entity/EntityId.ts:163-189`). `buildDefinition` resolves those values once into a schema-class `Definition` (`packages/shared/domain/src/entity/EntityId.ts:332-383`, `packages/shared/domain/src/entity/EntityId.ts:520-555`).

The finished codec carries these statics (`packages/shared/domain/src/entity/EntityId.ts:402-427`):

```ts
type EntityIdStatics<...> = {
  readonly brand: TBrand;
  readonly definition: DefinitionFor<...>;
  readonly entityType: TEntityType;
  readonly equivalence: EntityIdEquivalence<TBrand>;
  readonly resource: TResource;
  readonly slice: Slice;
  readonly tableName: TTableName;
};
```

The factory's final construction does require a cast from the dynamically branded schema to the literal-resolved codec type (`packages/shared/domain/src/entity/EntityId.ts:576-607`, especially line 597).

### 2.3 How models consume ids

`EntitySchema.EntityIdLike` deliberately asks for only a number codec plus `Type`, `entityType`, and `tableName` statics (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:499-503`). `BaseEntity.Class` tightens this to the full `EntityId.Any`, then adds:

- `entityType: S.Literal<Entity["entityType"]>`;
- `id: Entity`;
- `publicId: PublicEntityId<Entity>` (`packages/shared/domain/src/entity/BaseEntity.ts:38-64`).

The persistence strategies are fixed: discriminator is derived, id is generated on insert, and public id is computed by the service on insert and unique (`packages/shared/domain/src/entity/BaseEntity.ts:44-52`, `packages/shared/domain/src/entity/BaseEntity.ts:153-166`). The entity id's own `tableName` is forced into the class input, making id definition and table definition agree (`packages/shared/domain/src/entity/BaseEntity.ts:186-215`).

`PublicEntityId.factory` derives a template-literal public id from `entityId.tableName` and adds another entity-specific brand; its dynamic schema assembly currently needs `as unknown as PublicEntityIdSchema<...>` (`packages/shared/domain/src/entity/PublicEntityId.ts:217-238`). `EntityRefFor<Entity>` depends on `Entity["entityType"]` and `Entity["Type"]`, and its constructors take an `EntityId.Any` plus the branded id value (`packages/shared/domain/src/entity/EntityRef.ts:130-142`, `packages/shared/domain/src/entity/EntityRef.ts:181-206`).

Thus EntityId is not a cosmetic brand. It is the common source for row id type, discriminator, table name, public-id prefix, authorization resource, equivalence, and typed polymorphic references.

## 3. Table modeling and Drizzle projection

### 3.1 `packages/shared/tables/src/table/`: no current `Table.make`

The current directory is only a compatibility facade:

```ts
// packages/shared/tables/src/table/Table.ts
export { EntityTable } from "@beep/drizzle";

// packages/shared/tables/src/table/index.ts
export * as Table from "./Table.ts";
```

(`packages/shared/tables/src/table/Table.ts:1-15`, `packages/shared/tables/src/table/index.ts:1-14`). There is no `Table.make` in this live source. A successor need not preserve a nonexistent API; the compatibility surface is the `Table.EntityTable` namespace re-export and direct `@beep/drizzle` use.

### 3.2 What `EntityTable.pgTableFrom` does

`TableFor<Entity>` is a Drizzle `PgTableWithColumns` whose name and column map are derived from the entity definition. It hard-codes `schema: undefined` and `dialect: "pg"`, then adds `.definition` and `.entitySchema` metadata (`packages/drivers/drizzle/src/EntityTable.models.ts:213-224`).

Column families map as follows (`packages/drivers/drizzle/src/EntityTable.models.ts:77-99`, `packages/drivers/drizzle/src/EntityTable.models.ts:275-320`):

| storage kind | Postgres builder |
|---|---|
| `blob` | `bytea` |
| `bool` | `boolean` |
| `entityId` | `serial` when generated-on-insert, otherwise `integer` |
| `int` | `integer` |
| `jsonb` | `jsonb` |
| `literal`, `text` | `text` |
| `timestampDate` | `timestamp(..., { mode: "date" })` |
| `timestampMillis` | `bigint(..., { mode: "number" })` |

`ColumnBuilderMapFor` maps each persisted field key to the builder selected from that descriptor and the encoded type of the corresponding selected schema (`packages/drivers/drizzle/src/EntityTable.models.ts:141-179`). `columnsFor` iterates `definition.persisted`, looks up `definition.fields[key]`, applies type and nullability, and returns the builder map (`packages/drivers/drizzle/src/EntityTable.models.ts:323-342`).

`pgTableFrom` itself is deliberately small (`packages/drivers/drizzle/src/EntityTable.models.ts:509-517`):

```ts
export const pgTableFrom = <const Entity extends EntitySchema.EntityClass.Any>(
  entity: Entity
): TableFor<Entity> => {
  const definition = EntitySchema.getDefinition(entity);
  const table = pgTable(
    definition.tableName,
    () => columnsFor(definition),
    (columns) => indexesFor(definition.tableName, definition, columns)
  );
  return attachTableMetadata(table, definition, entity);
};
```

`columns = getColumns` is also public (`packages/drivers/drizzle/src/EntityTable.models.ts:519-556`).

### 3.3 Column names: derived capability, mostly manual usage

The type and runtime both derive snake-case when no override is supplied:

```ts
export type ColumnNameFor<Key extends string, Descriptor extends PersistDescriptor> =
  Descriptor extends { readonly columnName: infer ColumnName extends string }
    ? ColumnName
    : SnakeCase<Key>;

descriptor.columnName ?? Str.snakeCase(key)
```

(`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:189-193`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.constructors.ts:158-171`). Therefore “column names must be written by hand” is no longer an API requirement.

It remains the dominant authoring habit. A live grep found 242 `columnName:` properties alongside 267 `EntitySchema.persist.*(...)` calls under slice/shared domain source. The representative entities below show redundant overrides such as `content: "content"`, `role: "role"`, and `legalName: "legal_name"`, all identical to automatic derivation. The successor should make overrides exceptional and use the field key as the default physical-name source.

### 3.4 Indexes and missing relational/DDL concepts

The only index hints are `btree`, `gin`, `hash`, `lookup`, and `unique` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:162-217`). Projection creates only one-column indexes. `lookup` becomes an ordinary index and is suppressed when the same field also has `btree`; invalid hint/storage combinations are silently filtered (`packages/drivers/drizzle/src/EntityTable.models.ts:344-437`). The public JSDoc explicitly says unsupported hints are ignored (`packages/drivers/drizzle/src/EntityTable.models.ts:472-479`).

No entity descriptor expresses foreign keys, references, relations, composite indexes, partial indexes, exclusion constraints, checks, generated expressions, triggers, schemas/namespaces, or table policies. The projector only calls `.primaryKey()` for generated entity ids and only derives indexes from one field at a time (`packages/drivers/drizzle/src/EntityTable.models.ts:243-272`, `packages/drivers/drizzle/src/EntityTable.models.ts:394-437`). This explains the raw-SQL split documented in the hack catalog.

## 4. Representative entity/table pairs

The table module itself is no longer duplicated column-by-column. Duplication now lives inside each entity: every logical field key appears once under `fields` and again under `persisted`, often with a third spelling as `columnName`. The corresponding table is usually one projection call.

### 4.1 Shared Organization

Verbatim model excerpt (`packages/shared/domain/src/entities/Organization/Organization.model.ts:33-65`):

```ts
export class Model extends BaseEntity.Class<Model>($I`Model`)(
  Shared.OrganizationId,
  {
    fields: {
      legalName: S.NonEmptyString,
      licenseTier: LicenseTier,
      name: S.NonEmptyString,
      parentOrgId: M.FieldOption(Shared.OrganizationId),
      settings: Settings,
      slug: Slug,
    },
    persisted: {
      legalName: EntitySchema.persist.text({
        columnName: "legal_name",
      }),
      licenseTier: EntitySchema.persist.literal({
        columnName: "license_tier",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      name: EntitySchema.persist.text(),
      parentOrgId: EntitySchema.persist.entityId({
        columnName: "parent_org_id",
      }),
      settings: EntitySchema.persist.jsonb(),
      slug: EntitySchema.persist.text({
        indexHints: [EntitySchema.IndexHint.unique],
      }),
    },
  },
  $I.annote("Model", {
    description: "Shared-kernel organization entity used as the tenant root concept.",
  })
) {}
```

Verbatim table declaration (`packages/shared/tables/src/entities/Organization/Organization.table.ts:8-33`):

```ts
import { EntityTable } from "@beep/drizzle";
import { Organization } from "@beep/shared-domain/entities";

export const Table = EntityTable.pgTableFrom(Organization.Model);
```

The good ergonomics are the reusable base factory and one-line table. The waste is the parallel key map and redundant `legal_name`, `license_tier`, and `parent_org_id` spellings.

### 4.2 Workspace Message

Verbatim model excerpt (`packages/workspace/domain/src/entities/Message/Message.model.ts:68-106`):

```ts
export class Message extends BaseEntity.Class<Message>($I`Message`)(
  WorkspaceIdentity.MessageId,
  {
    fields: {
      content: Document.annotateKey({
        description: "Md-aligned message document content.",
      }),
      role: MessageRole.annotateKey({
        description: "Author role for the workspace message.",
      }),
      threadId: WorkspaceIdentity.ThreadId.annotateKey({
        description: "Thread containing the message.",
      }),
      turnId: WorkspaceIdentity.TurnId.annotateKey({
        description: "Turn that owns the message content.",
      }),
    },
    persisted: {
      content: EntitySchema.persist.jsonb({
        columnName: "content",
      }),
      role: EntitySchema.persist.literal({
        columnName: "role",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      threadId: EntitySchema.persist.entityId({
        columnName: "thread_id",
        indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
      }),
      turnId: EntitySchema.persist.entityId({
        columnName: "turn_id",
        indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
      }),
    },
  },
  $I.annote("Message", {
    description: "Md-aligned message content in a workspace turn.",
  })
) {}
```

Verbatim table declaration (`packages/workspace/tables/src/entities/Message/Message.table.ts:8-28`):

```ts
import { EntityTable } from "@beep/drizzle";
import { Message } from "@beep/workspace-domain/entities/Message";

export const Table = EntityTable.pgTableFrom(Message);
```

`content: "content"` and `role: "role"` are pure redundancy. `threadId` and `turnId` demonstrate that snake-case derivation already has enough information to remove their manual names.

### 4.3 Documents SyncOperation

This larger entity exposes the scaling problem. Verbatim field excerpt (`packages/documents/domain/src/entities/SyncOperation/SyncOperation.model.ts:192-235`):

```ts
export class SyncOperation extends BaseEntity.Class<SyncOperation>($I`SyncOperation`)(
  SyncOperationId,
  {
    fields: {
      attemptCount: NonNegativeInt.annotateKey({
        description: "Number of push attempts already made for this operation.",
      }),
      idempotencyKey: S.NonEmptyString.annotateKey({
        description: "Unique key deduplicating replays of the same push operation.",
      }),
      inputContentDigest: DocumentContentDigest.pipe(S.OptionFromNullOr).annotateKey({
        description: "Digest of the local content captured when the operation was queued; none for folders.",
      }),
      inputGeneration: NonNegativeInt.annotateKey({
        description: "Local generation counter captured when the operation was queued.",
      }),
      lastError: S.NonEmptyString.pipe(S.OptionFromNullOr).annotateKey({
        description: "Most recent attempt failure message; none while the operation is healthy.",
      }),
      operationType: SyncOperationType.annotateKey({
        description: "Kind of push performed against the DMS mirror.",
      }),
      provider: DmsProvider.annotateKey({
        description: "DMS provider targeted by the push operation.",
      }),
      status: SyncOperationStatus.annotateKey({
        description: "Outbox lifecycle status of the operation.",
      }),
      syncItemId: Documents.SyncItemId.annotateKey({
        description: "Sync-tracking row this operation pushes for.",
      }),
      targetName: S.NonEmptyString.annotateKey({
        description: "Remote item name to apply with this operation.",
      }),
      targetParentRelPath: VaultRelPath.pipe(S.OptionFromNullOr).annotateKey({
        description: "Vault-relative path of the intended remote parent folder; none targets the mirror root.",
      }),
      targetRelPath: VaultRelPath.annotateKey({
        description: "Intended vault-relative path of the item after this operation.",
      }),
      workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
        description: "Workspace whose vault produced the push operation.",
      }),
    },
```

Verbatim persistence excerpt (`packages/documents/domain/src/entities/SyncOperation/SyncOperation.model.ts:236-280`):

```ts
    persisted: {
      attemptCount: EntitySchema.persist.int({
        columnName: "attempt_count",
      }),
      idempotencyKey: EntitySchema.persist.text({
        columnName: "idempotency_key",
        indexHints: [EntitySchema.IndexHint.unique],
      }),
      inputContentDigest: EntitySchema.persist.text({
        columnName: "input_content_digest",
      }),
      inputGeneration: EntitySchema.persist.int({
        columnName: "input_generation",
      }),
      lastError: EntitySchema.persist.text({
        columnName: "last_error",
      }),
      operationType: EntitySchema.persist.literal({
        columnName: "operation_type",
      }),
      provider: EntitySchema.persist.literal({
        columnName: "provider",
      }),
      status: EntitySchema.persist.literal({
        columnName: "status",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      syncItemId: EntitySchema.persist.entityId({
        columnName: "sync_item_id",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      targetName: EntitySchema.persist.text({
        columnName: "target_name",
      }),
      targetParentRelPath: EntitySchema.persist.text({
        columnName: "target_parent_rel_path",
      }),
      targetRelPath: EntitySchema.persist.text({
        columnName: "target_rel_path",
      }),
      workspaceId: EntitySchema.persist.entityId({
        columnName: "workspace_id",
        indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
      }),
    },
```

Verbatim table exports (`packages/documents/tables/src/entities/SyncOperation/SyncOperation.table.ts:9-54`):

```ts
import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import { EntityTable } from "@beep/drizzle";

export const syncOperationTable = EntityTable.pgTableFrom(DomainSyncOperation.SyncOperation);
export const SYNC_OPERATION_TABLE_NAME = syncOperationTable.definition.tableName;
```

All 13 field keys are repeated under `persisted`, and all 13 derived column names are written explicitly. The table module adds no column duplication; it consumes the metadata as designed.

## 5. Hack and widening catalog

### 5.1 Exact `as any`, `as unknown as`, and suppression audit

Within the inspected production modeling stack (`Model`, `DomainModel`, `EntitySchema`, `VariantSchema`, shared entity primitives, and `EntityTable.models.ts`):

- Exact `as any`: none found.
- `@ts-expect-error` / `@ts-ignore`: none found.
- `as unknown as` occurrences:
  - generic descriptor object to `PersistDescriptor`: `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.constructors.ts:35`;
  - normalized definition to conditional `Definition`: `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:290`;
  - `Model.Class` to a narrowed entity factory function: `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:430-433`;
  - inherited `.extend` to its narrowed entity signature: `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:457-468`;
  - `S.Class` to internal `SchemaClassFactory`: `packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:636`;
  - returned object to `MakeApi`: `packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:740-750`;
  - public-id template schema to `PublicEntityIdSchema`: `packages/shared/domain/src/entity/PublicEntityId.ts:217-227`.

Additional broad or boundary assertions that widen/repair inference:

- `TUnsafe.Any` in JSON text projection: `packages/foundation/modeling/schema/src/Model/Model.codecs.ts:62-64`.
- `TUnsafe.Any` in the optional-key transformation and `FieldOption`: `packages/foundation/modeling/schema/src/Model/Model.fields.ts:264-274`, `packages/foundation/modeling/schema/src/Model/Model.fields.ts:330-349`.
- child definition asserted to its merged conditional type: `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:540-549`.
- generic variant-field result assertion: `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:383-387`.
- accumulated variant map assertion: `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:406-418`.
- Drizzle builder, base column, and map boundary assertions: `packages/drivers/drizzle/src/EntityTable.models.ts:252-255`, `packages/drivers/drizzle/src/EntityTable.models.ts:300-320`, `packages/drivers/drizzle/src/EntityTable.models.ts:334-342`.
- concrete EntityId branded codec assertion: `packages/shared/domain/src/entity/EntityId.ts:590-607`.

Some assertions are legitimate library-boundary repair, but their concentration at class inheritance, variant extraction, and descriptor construction shows where the current type representation fights TypeScript. A successor should make the field schema and SQL descriptor one correlated value so it does not have to reconstruct that relation across parallel generic maps.

### 5.2 Type widening built into public types

The most consequential widening points are not spelled `as any`:

- `PersistDescriptor.Any` erases the storage/strategy/index relation (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:384-396`).
- `PersistedMap = Readonly<Record<string, PersistDescriptor>>` loses the relation to any field map until later generics restore it (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:601-618`).
- `EntityIdLike` reduces the richer EntityId contract to unknown decoded `Type` plus two strings (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:483-503`).
- `EntitySchema.Definition` defaults every type parameter to broad maps/strings and an optional broad id (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:43-61`).
- `EntityTable` intentionally aliases the descriptor to the broad discriminated union before matching it (`packages/drivers/drizzle/src/EntityTable.models.ts:73-75`).

### 5.3 db-admin workarounds and raw-SQL split

The db-admin package has no `as any`, `as unknown as`, or TypeScript suppression in `src`. Its hacks are architectural and manual.

**Flat re-export registry.** Drizzle Kit only scans top-level table values, so every migratable table is manually re-exported from one giant file. The source explicitly warns that grouped `DbSchema` objects are invisible and that exporting a table schedules its migration (`packages/_internal/db-admin/src/schema.ts:1-12`). The file begins a long sequence of aliases such as:

```ts
export const architectureLabWorkItemTable: typeof ArchitectureLabDbSchema.workItem =
  ArchitectureLabDbSchema.workItem;
```

(`packages/_internal/db-admin/src/schema.ts:51-81`; the pattern continues through the file). Candidate tables must be manually excluded to avoid suppressing future `CREATE` migrations (`packages/_internal/db-admin/src/schema.ts:10-12`). This is registry duplication downstream of incomplete discoverability.

**Unknown schema payload plus duplicated table-name list.** Migration targets deliberately type the Drizzle schema as `S.Unknown`, then carry a separate `NonEmptyArray` of table names (`packages/_internal/db-admin/src/migrations/ArchitectureLab.ts:53-99`):

```ts
const DrizzleMigrationSchema = S.Unknown.pipe(/* "Opaque imported Drizzle table-schema object" */);

export class DbAdminMigrationTarget extends S.Class<DbAdminMigrationTarget>(...)(
  {
    drizzleSchema: DrizzleMigrationSchema,
    name: MigrationTargetName,
    schemaName: PostgresSchemaName,
    tables: S.NonEmptyArray(MigrationTableName),
  },
  ...
) {}
```

Some targets at least derive names from `.definition.tableName`, as the edge target does (`packages/_internal/db-admin/src/migrations/EpistemicEdge.ts:35-49`). Raw tables cannot do that, so the execution-ledger target imports manually maintained name constants (`packages/_internal/db-admin/src/migrations/EpistemicExecutionLedger.ts:9-14`, `packages/_internal/db-admin/src/migrations/EpistemicExecutionLedger.ts:39-46`).

**Raw SQL owns important invariants.** The edge target documents ordered-interval checks, endpoint-kind checks, a GiST exclusion constraint, and a partial unique index as migration-only (`packages/_internal/db-admin/src/migrations/EpistemicEdge.ts:13-22`). The execution ledger likewise leaves composite keys/FKs, checks, and immutable-row triggers to raw SQL (`packages/_internal/db-admin/src/migrations/EpistemicExecutionLedger.ts:16-26`). Table modules repeat the same limitation for contradiction and evidence-verification tables (`packages/epistemic/tables/src/entities/Contradiction/Contradiction.table.ts:15-22`, `packages/epistemic/tables/src/entities/EvidenceVerification/EvidenceVerification.table.ts:10-17`).

**Append-only entities bypass the whole stack.** `ExecutionRecord.table.ts` is the clearest workaround. It explains that `BaseEntity` would lie by adding update vocabulary, while Drizzle cannot express the required checks/FKs/triggers, so both tables are raw `pgTable` declarations (`packages/epistemic/tables/src/values/ExecutionRecord/ExecutionRecord.table.ts:1-17`). Column names and `$type` links are then written manually (`packages/epistemic/tables/src/values/ExecutionRecord/ExecutionRecord.table.ts:83-97`, `packages/epistemic/tables/src/values/ExecutionRecord/ExecutionRecord.table.ts:129-135`). The physical outcome table even has a constraint-supporting `decision_verdict` column deliberately absent from the TypeScript projection (`packages/epistemic/tables/src/values/ExecutionRecord/ExecutionRecord.table.ts:99-115`).

These are not incidental migration quirks. They identify missing successor concepts: entity lifecycle policy, composite/natural keys, FKs, checks, partial/exclusion indexes, triggers or explicit raw-DDL extensions, and a typed migration schema registry.

## 6. Compatibility surface and actual downstream dependencies

### 6.1 Entity class shape

Downstream code can and does depend on an entity class being all of the following:

- a decodable/encodable Effect schema and constructible class (`EntityClass` combines `S.ConstraintCodec` and `Model.ClassShape`: `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:350-360`);
- a six-variant namespace: the statics are required by `Model.Any` and materialized by the variant factory (`packages/foundation/modeling/schema/src/Model/Model.variants.ts:201-208`, `packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:674-682`);
- a class with `.fields`, `.make`, `.extend`, and `.mapFields` (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:401-434`);
- a class with `.definition` containing fields, input fields, persistence descriptors, table name, variants, and usually EntityId (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:43-61`).

Production repositories use these statics directly. `ProviderInstance.repo.ts` encodes with `.insert` and reads `definition.entityId.entityType` (`packages/agents/server/src/ProviderInstance/ProviderInstance.repo.ts:35-36`, `packages/agents/server/src/ProviderInstance/ProviderInstance.repo.ts:65`). Entity `.make(...)` is used in repository/use-case construction, for example `SyncOperation.make(...)` (`packages/documents/server/src/entities/SyncOperation/SyncOperation.repo.ts:164`) and claim disposition construction (`packages/epistemic/use-cases/src/ClaimDisposition/ClaimDisposition.commands.ts:112`).

`.fields` is also composition input, not just documentation. Claim-disposition command schemas spread both `BaseEntity.fields` and `ClaimDisposition.fields` (`packages/epistemic/use-cases/src/ClaimDisposition/ClaimDisposition.commands.ts:64-74`). The successor must expose a schema-field view suitable for `S.Struct` composition even if its internal field representation changes.

The less-used JSON/update statics are still public and test-locked. EntitySchema tests assert derived `insert`, `update`, `json`, `jsonCreate`, and `jsonUpdate` shapes and acceptance of explicit `Model` fields (`packages/foundation/modeling/schema/test/EntitySchema.test.ts:187-269`). Removing or renaming them would be a migration, not a transparent implementation replacement.

### 6.2 Base factory syntax and invariant fields

The dominant declaration form is:

```ts
export class X extends BaseEntity.Class<X>(identifier)(
  EntityId,
  { fields: {...}, persisted: {...} },
  annotations
) {}
```

It automatically adds the eight shared audit/context fields (`packages/shared/domain/src/entity/BaseEntity.ts:81-90`) plus `entityType`, generated integer `id`, and unique public id (`packages/shared/domain/src/entity/BaseEntity.ts:147-166`). A truly drop-in successor must either preserve this curried factory signature and exact resultant fields or provide a mechanical codemod for all 43 declarations.

The fixed update-oriented BaseEntity shape is not universal. Append-only tables currently bypass it because `rowVersion`, `updatedAt`, and `updatedByPrincipal` would misrepresent the domain (`packages/epistemic/tables/src/values/ExecutionRecord/ExecutionRecord.table.ts:5-13`). A successor should preserve reusable base factories while allowing different invariant profiles, such as mutable audited, append-only ledger, or natural-key value table.

### 6.3 EntityId surface

Adoptability requires preserving either the existing `EntityId` object shape or a migration adapter for:

- encoded `number`, entity-specific branded decoded `Type`, and schema behavior (`packages/shared/domain/src/entity/EntityId.ts:89-145`, `packages/shared/domain/src/entity/EntityId.ts:402-410`);
- `brand`, `definition`, `entityType`, `equivalence`, `resource`, `slice`, and `tableName` statics (`packages/shared/domain/src/entity/EntityId.ts:412-427`);
- type-level default strings and override inference (`packages/shared/domain/src/entity/EntityId.ts:206-260`, `packages/shared/domain/src/entity/EntityId.ts:369-383`);
- compatibility with `PublicEntityId`, `EntityRef`, and `BaseEntity.Class` (`packages/shared/domain/src/entity/PublicEntityId.ts:217-238`, `packages/shared/domain/src/entity/EntityRef.ts:130-142`, `packages/shared/domain/src/entity/BaseEntity.ts:186-215`).

### 6.4 Table surface

Current consumers can depend on:

- `EntityTable.pgTableFrom(Entity)` and `EntityTable.columns(table)` (`packages/drivers/drizzle/src/EntityTable.models.ts:509-556`);
- `EntityTable.TableFor`, `ColumnBuilderFor`, and `ColumnBuilderMapFor` types (`packages/drivers/drizzle/src/EntityTable.models.ts:116-224`);
- ordinary Drizzle table behavior plus attached `.definition` and `.entitySchema` (`packages/drivers/drizzle/src/EntityTable.models.ts:213-224`, `packages/drivers/drizzle/src/EntityTable.models.ts:439-470`);
- package-specific export names. Examples include `Organization.Table`, `Message.Table`, and `syncOperationTable`, plus constants derived from `.definition.tableName` (`packages/shared/tables/src/entities/Organization/Organization.table.ts:33`, `packages/workspace/tables/src/entities/Message/Message.table.ts:28`, `packages/documents/tables/src/entities/SyncOperation/SyncOperation.table.ts:33-54`);
- grouped `DbSchema` objects and db-admin's flat top-level re-exports (`packages/_internal/db-admin/src/schema.ts:19-49`, `packages/_internal/db-admin/src/schema.ts:51-81`).

The successor may freely replace the projector internals, but table objects and export topology must remain stable during incremental adoption.

### 6.5 What can change with comparatively low compatibility cost

- The non-existent current `Table.make` API does not need emulation (`packages/shared/tables/src/table/Table.ts:8-15`).
- `DomainModel` internals can change behind an adapter because product slices use `BaseEntity`, not `DomainModel` (`packages/foundation/modeling/schema/src/DomainModel.ts:69-74`, `packages/foundation/modeling/schema/test/DomainModel.test.ts:2-63`).
- Manual `columnName` entries can be removed without changing generated names where they equal `snake_case(fieldKey)` (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.constructors.ts:158-171`).
- Descriptor implementation types, AST annotation layout, and current casts can change if `getDefinition` and the projector are updated atomically (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:614-627`).
- The fixed storage/index representation can be replaced behind compatibility constructors such as `persist.text()` and `IndexHint.unique`.

## What to preserve

Ranked by product value and migration leverage:

1. **Schema/class as the domain truth, with generated variants and reusable constructors.** The current `S.Class` result, `.make`, inheritance, and six variant statics are broadly useful and already consumed (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:374-435`, `packages/foundation/modeling/schema/src/Model/Model.variants.ts:201-208`). Preserve the behavior even if the successor uses a new field node internally.
2. **EntityId integration and literal-preserving metadata.** One declaration currently aligns branded row ids, entity discriminators, physical table names, public-id prefixes, resources, and refs (`packages/shared/domain/src/entity/EntityId.ts:369-427`, `packages/shared/domain/src/entity/BaseEntity.ts:147-215`). Do not split those truths apart.
3. **Encoded-AST nullability derivation and selected-row validation.** It prevents undefined/missing-key representations from leaking into SQL rows and drives Drizzle `.notNull()` automatically (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.shape.ts:307-349`, `packages/drivers/drizzle/src/EntityTable.models.ts:257-272`).
4. **Value-strategy-driven variant derivation.** `generatedOnInsert`, `updatedOnWrite`, service-computed values, and provided values produce useful insert/update/JSON surfaces without hand-maintaining six schemas (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:264-287`).
5. **Pipeable variant-aware field combinators and the explicit `Model.Field` escape hatch.** They compose, preserve per-variant codecs, and allow exceptional schemas while runtime checks enforce compatibility (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:718-731`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:173-260`).
6. **Reusable base factories.** `BaseEntity.Class` proves that invariant field families can be packaged once and inherited (`packages/shared/domain/src/entity/BaseEntity.ts:81-143`, `packages/shared/domain/src/entity/BaseEntity.ts:186-247`). Generalize this into profiles rather than deleting the pattern.
7. **One-line typed table projection with source metadata attached.** `EntityTable.pgTableFrom` eliminates a second handwritten column model and keeps a reverse link to the entity definition (`packages/drivers/drizzle/src/EntityTable.models.ts:439-517`).

## What to kill

Ranked by harm and successor opportunity:

1. **The parallel `fields`/`persisted` maps and routine handwritten column names.** They repeat every key and account for most current entity boilerplate despite existing automatic name derivation (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:211-221`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.constructors.ts:158-171`). Persistence should be a pipeable, schema-correlated field combinator whose default column name comes from the enclosing key.
2. **Carrier-type-only SQL correlation.** `number -> entityId | int | timestampMillis` and `string -> literal | text` are too broad to state SQL invariants (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:505-534`). A successor must correlate nominal schema capabilities, column family, encoded driver type, default strategy, and dialect.
3. **Storage-neutral index hints that silently disappear.** Invalid `gin`/scalar and scalar/JSON combinations should be authoring-time errors; unsupported hints must not be filtered without a diagnostic (`packages/drivers/drizzle/src/EntityTable.models.ts:351-392`, `packages/drivers/drizzle/src/EntityTable.models.ts:472-479`).
4. **The tiny closed DDL vocabulary.** Nine storage kinds and five single-column hints cannot express the constraints already required by real tables (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts:29-43`, `packages/_internal/db-admin/src/migrations/EpistemicEdge.ts:18-22`). Add composite/natural primary keys, foreign keys/relations, checks, unique/composite/partial/exclusion indexes, generated/default expressions, and explicit extension points.
5. **Postgres hard-coding without dialect-aware types.** `TableFor` literally fixes `dialect: "pg"`, while the only SQLite support is a disconnected Boolean field (`packages/drivers/drizzle/src/EntityTable.models.ts:213-224`, `packages/foundation/modeling/schema/src/Model/Model.sqlite.ts:25-61`). Dialect choice should narrow available columns/indexes/constraints at the type level.
6. **One universal mutable BaseEntity profile.** It forces append-only domains to bypass the system and handwrite physical tables (`packages/epistemic/tables/src/values/ExecutionRecord/ExecutionRecord.table.ts:5-13`). Keep factories, but introduce explicit lifecycle/base profiles.
7. **db-admin's untyped schema target and manual flat registry.** `S.Unknown` plus duplicated table-name arrays and a giant alias barrel prevent definition-driven discovery (`packages/_internal/db-admin/src/migrations/ArchitectureLab.ts:53-99`, `packages/_internal/db-admin/src/schema.ts:1-12`).
8. **The duplicate legacy `DomainModel` path as a peer architecture.** Preserve an adapter if external consumers exist, but do not evolve two entity systems (`packages/foundation/modeling/schema/src/DomainModel.ts:36-74`, `packages/foundation/modeling/schema/src/index.ts:112`).
9. **Type reconstruction by double assertion.** The repeated `as unknown as` bridges are symptoms of metadata being assembled after schemas/classes rather than represented as one typed field node (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:272-290`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.factory.ts:421-468`).

## Adoption constraints

A genuinely drop-in successor, or its compatibility adapter, must satisfy all of the following:

1. Preserve the dominant declaration result: an Effect schema class with constructor/new behavior, `.make`, `.fields`, `.extend`, `.mapFields`, and `select`/`insert`/`update`/`json`/`jsonCreate`/`jsonUpdate` statics (`packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:374-435`, `packages/foundation/modeling/schema/src/Model/Model.variants.ts:201-208`).
2. Preserve `BaseEntity.Class<Child>(identifier)(EntityId, input, annotations)` or provide a mechanical migration for 43 current declarations. Preserve the exact shared fields and their variant visibility until consumers migrate (`packages/shared/domain/src/entity/BaseEntity.ts:81-133`, `packages/shared/domain/src/entity/BaseEntity.ts:186-215`).
3. Accept existing plain schemas and explicit `Model.Field` inputs. Existing helpers such as `FieldOption`, `Sensitive`, generated/date fields, `JsonFromString`, and UUID variants cannot become invalid overnight (`packages/foundation/modeling/schema/src/Model/Model.fields.ts:32-349`, `packages/foundation/modeling/schema/src/Model/Model.codecs.ts:29-72`).
4. Preserve EntityId's branded decoded value, number encoding, statics, literal inference, and factory override semantics. `BaseEntity`, `PublicEntityId`, `EntityRef`, authorization resources, and table naming all consume them (`packages/shared/domain/src/entity/EntityId.ts:402-471`, `packages/shared/domain/src/entity/PublicEntityId.ts:217-238`).
5. Expose a definition/metadata view equivalent to current `.definition.fields`, `.inputFields`, `.persisted`, `.variantFields`, `.tableName`, and `.entityId`, at least through an adapter (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:43-61`). Repositories, table projection, migration targets, tests, and documentation read it.
6. Keep current generated physical names stable. Removing redundant overrides is safe only when the successor produces the same snake-case strings and respects true legacy overrides (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts:189-193`, `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.constructors.ts:158-171`). Schema migration must be explicit for any changed name.
7. Preserve `EntityTable.pgTableFrom`, its ordinary Drizzle `PgTableWithColumns` result, typed columns, `.definition`, `.entitySchema`, and `EntityTable.columns`, or place a source-compatible adapter at `@beep/drizzle` (`packages/drivers/drizzle/src/EntityTable.models.ts:213-224`, `packages/drivers/drizzle/src/EntityTable.models.ts:439-556`).
8. Preserve package table exports and grouped `DbSchema` shapes during incremental conversion. db-admin and applications import those symbols, not an abstract registry (`packages/_internal/db-admin/src/schema.ts:19-49`, `packages/shared/tables/src/entities/Organization/Organization.table.ts:33`).
9. Preserve encoded-AST SQL absence semantics. A successor must continue rejecting selected-row optional/undefined/ambiguous schemas and must derive `.notNull()` from the encoded side, not the decoded `Option` type (`packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.shape.ts:307-349`, `packages/drivers/drizzle/src/EntityTable.models.ts:257-272`).
10. Offer explicit escape hatches for constraints or lifecycle shapes not yet modeled, but make them visible in definition metadata and proof. Current silent raw-SQL ownership is necessary for real tables but invisible to the entity/table type (`packages/_internal/db-admin/src/migrations/EpistemicEdge.ts:18-22`, `packages/epistemic/tables/src/values/ExecutionRecord/ExecutionRecord.table.ts:5-17`).
11. Stage dialect support through typed projectors. The current Postgres projector can remain an adapter, but new SQLite/Postgres builders must narrow storage/index/constraint choices by dialect rather than sharing an unchecked universal descriptor (`packages/drivers/drizzle/src/EntityTable.models.ts:213-224`).
12. Do not promise compatibility with `Table.make` as though it were current. Preserve the actual namespace re-export, and target `EntityTable.pgTableFrom` (`packages/shared/tables/src/table/Table.ts:8-15`, `packages/shared/tables/src/table/index.ts:8-14`).

The shortest viable successor path is therefore not a wholesale replacement of class/variant behavior. It is a new, dialect-parameterized **field node** that owns the Effect schema, variant policy, physical column family, naming override, indexes/constraints, and relation metadata as one correlated value; adapters can then derive the existing `fields`, `persisted`, class statics, `.definition`, and `EntityTable.pgTableFrom` surface while entities migrate one field at a time.
