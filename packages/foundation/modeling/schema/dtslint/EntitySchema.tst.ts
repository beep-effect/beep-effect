import { $SchemaId } from "@beep/identity";
import * as EntitySchema from "@beep/schema/EntitySchema";
import * as Model from "@beep/schema/Model";
import * as S from "effect/Schema";
import { Model as UpstreamModel } from "effect/unstable/schema";
import { describe, expect, it } from "tstyche";
import type * as O from "effect/Option";

const $I = $SchemaId.create("EntitySchema.dtslint");

const FixtureIdSchema = S.Int.pipe(S.brand("FixtureId"));

const FixtureId = Object.assign(FixtureIdSchema, {
  brand: "FixtureId",
  entityType: "Fixture",
  resource: "fixture",
  tableName: "fixture",
}) as typeof FixtureIdSchema & {
  readonly brand: "FixtureId";
  readonly entityType: "Fixture";
  readonly resource: "fixture";
  readonly tableName: "fixture";
};

const fields = {
  id: FixtureId,
  name: S.String,
  optionalName: S.String.pipe(S.OptionFromNullOr),
  payload: S.Record(S.String, S.Unknown),
  rowVersion: EntitySchema.int,
} as const;

const persisted = {
  id: EntitySchema.persist.entityId({
    valueStrategy: "generatedOnInsert",
  }),
  name: EntitySchema.persist.text({
    indexHints: [EntitySchema.IndexHint.unique],
  }),
  optionalName: EntitySchema.persist.text({
    columnName: "optional_name",
  }),
  payload: EntitySchema.persist.jsonb(),
  rowVersion: EntitySchema.persist.int({
    columnName: "row_version",
    valueStrategy: "incrementedOnWrite",
  }),
} as const;

const optionalKeyFields = {
  maybe: S.optionalKey(S.String),
} as const;

const optionalKeyPersisted: EntitySchema.PersistedFor<typeof optionalKeyFields> = {
  // @ts-expect-error!
  maybe: EntitySchema.persist.text(),
};

const optionalOptionFields = {
  parentId: Model.optionalOption(FixtureId),
} as const;

const optionalOptionPersisted: EntitySchema.PersistedFor<typeof optionalOptionFields> = {
  // @ts-expect-error!
  parentId: EntitySchema.persist.entityId(),
};

declare const servicefulField: S.Codec<string, string, "Service", never>;

const servicefulFields = {
  value: servicefulField,
} as const;

const servicefulPersisted: EntitySchema.PersistedFor<typeof servicefulFields> = {
  // @ts-expect-error!
  value: EntitySchema.persist.text(),
};

const BinaryUuid = Model.Uint8Array.pipe(S.brand("BinaryUuid"));

const explicitFields = {
  appCode: Model.GeneratedByApp(S.String),
  binaryUuid: Model.UuidV4Insert(BinaryUuid),
  createdAt: Model.DateTimeInsertFromNumber,
  generatedValue: Model.Generated(S.String),
  happenedAt: Model.DateTimeInsertFromDate,
  insertCode: Model.GeneratedByAppOnInsert(S.String),
  optionalName: Model.FieldOption(S.String),
  payloadText: Model.JsonFromString(
    S.Struct({
      enabled: S.Boolean,
    })
  ),
  secret: Model.Sensitive(S.String),
  updatedAt: Model.DateTimeUpdateFromNumber,
} as const;

const explicitPersisted = {
  appCode: EntitySchema.persist.text({
    valueStrategy: "providedByContext",
  }),
  binaryUuid: EntitySchema.persist.blob({
    valueStrategy: "defaultedOnInsert",
  }),
  createdAt: EntitySchema.persist.timestampMillis({
    valueStrategy: "defaultedOnInsert",
  }),
  generatedValue: EntitySchema.persist.text({
    valueStrategy: "generatedOnInsert",
  }),
  happenedAt: EntitySchema.persist.timestampDate({
    valueStrategy: "defaultedOnInsert",
  }),
  insertCode: EntitySchema.persist.text({
    valueStrategy: "computedByServiceOnInsert",
  }),
  optionalName: EntitySchema.persist.text(),
  payloadText: EntitySchema.persist.text(),
  secret: EntitySchema.persist.text(),
  updatedAt: EntitySchema.persist.timestampMillis({
    valueStrategy: "updatedOnWrite",
  }),
} as const satisfies EntitySchema.PersistedFor<typeof explicitFields>;

const insertOnlyFields = {
  value: Model.FieldOnly(["insert"])(S.String),
} as const;

// @ts-expect-error!
type MissingSelectPersisted = EntitySchema.PersistedFor<typeof insertOnlyFields>;

const jsonTextFields = {
  payload: Model.JsonFromString(
    S.Struct({
      enabled: S.Boolean,
    })
  ),
} as const;

const jsonTextPersisted: EntitySchema.PersistedFor<typeof jsonTextFields> = {
  // @ts-expect-error!
  payload: EntitySchema.persist.jsonb(),
};

const upstreamFields = {
  createdAt: UpstreamModel.DateTimeInsertFromNumber,
  payloadText: UpstreamModel.JsonFromString(
    S.Struct({
      enabled: S.Boolean,
    })
  ),
} as const;

const upstreamPersisted = {
  createdAt: EntitySchema.persist.timestampMillis({
    valueStrategy: "defaultedOnInsert",
  }),
  payloadText: EntitySchema.persist.text(),
} as const satisfies EntitySchema.PersistedFor<typeof upstreamFields>;

EntitySchema.defineClassInput({
  fields: {
    name: S.String,
  },
  persisted: {
    name: EntitySchema.persist.text(),
    // @ts-expect-error!
    extra: EntitySchema.persist.text(),
  },
});

const Fixture = EntitySchema.ClassFactory($I`Fixture`)(
  {
    entityId: FixtureId,
    fields,
    persisted,
    tableName: "fixture",
  },
  $I.annote("Fixture", {
    description: "Fixture schema-first entity.",
  })
);

const ExplicitFixture = EntitySchema.ClassFactory($I`ExplicitFixture`)({
  fields: explicitFields,
  persisted: explicitPersisted,
  tableName: "explicit_fixture",
});

const UpstreamFixture = EntitySchema.ClassFactory($I`UpstreamFixture`)({
  fields: upstreamFields,
  persisted: upstreamPersisted,
  tableName: "upstream_fixture",
});

describe("EntitySchema types", () => {
  it("preserves definition and descriptor literals", () => {
    expect<typeof Fixture.definition.tableName>().type.toBe<"fixture">();
    expect<typeof Fixture.definition.entityId.entityType>().type.toBe<"Fixture">();
    expect<typeof Fixture.definition.persisted.id.storageKind>().type.toBe<"entityId">();
    expect<typeof Fixture.definition.persisted.id.valueStrategy>().type.toBe<"generatedOnInsert">();
    expect<typeof Fixture.definition.persisted.name.storageKind>().type.toBe<"text">();
    expect<(typeof Fixture.definition.persisted.name.indexHints)[0]["kind"]>().type.toBe<"unique">();
    expect<typeof Fixture.definition.persisted.optionalName.columnName>().type.toBe<"optional_name">();
    expect<typeof Fixture.definition.persisted.payload.storageKind>().type.toBe<"jsonb">();
    expect<typeof Fixture.definition.persisted.rowVersion.valueStrategy>().type.toBe<"incrementedOnWrite">();
  });

  it("preserves decoded and encoded shapes", () => {
    expect<EntitySchema.TypeShape<typeof fields>["optionalName"]>().type.toBe<O.Option<string>>();
    expect<EntitySchema.EncodedShape<typeof fields>["optionalName"]>().type.toBe<string | null>();
    expect<EntitySchema.ColumnNameFor<"rowVersion", typeof persisted.rowVersion>>().type.toBe<"row_version">();
    expect<
      EntitySchema.ColumnNameFor<"defaultName", EntitySchema.PersistDescriptor<"text", "provided", undefined>>
    >().type.toBe<"default_name">();
  });

  it("derives generated model variants", () => {
    expect<"id">().type.not.toBeAssignableTo<keyof S.Schema.Type<typeof Fixture.insert>>();
    expect<"rowVersion">().type.not.toBeAssignableTo<keyof S.Schema.Type<typeof Fixture.insert>>();
    expect<"name">().type.toBeAssignableTo<keyof S.Schema.Type<typeof Fixture.insert>>();
    expect<S.Schema.Type<typeof Fixture>["optionalName"]>().type.toBe<O.Option<string>>();
  });

  it("extracts selected fields from explicit Model helpers", () => {
    expect<typeof ExplicitFixture.definition.tableName>().type.toBe<"explicit_fixture">();
    expect<typeof ExplicitFixture.definition.inputFields.optionalName>().type.toBe<
      typeof explicitFields.optionalName
    >();
    expect<typeof ExplicitFixture.definition.variantFields.optionalName>().type.toBe<
      typeof explicitFields.optionalName
    >();
    expect<typeof ExplicitFixture.definition.fields.optionalName>().type.toBe<
      typeof explicitFields.optionalName.schemas.select
    >();
    expect<EntitySchema.TypeShape<typeof explicitFields>["optionalName"]>().type.toBe<O.Option<string>>();
    expect<EntitySchema.EncodedShape<typeof explicitFields>["optionalName"]>().type.toBe<string | null>();
    expect<EntitySchema.EncodedShape<typeof explicitFields>["payloadText"]>().type.toBe<string>();
    expect<EntitySchema.EncodedShape<typeof explicitFields>["happenedAt"]>().type.toBe<Date>();
    expect<"insertCode">().type.toBeAssignableTo<keyof S.Schema.Type<typeof ExplicitFixture.insert>>();
    expect<"insertCode">().type.not.toBeAssignableTo<keyof S.Schema.Type<typeof ExplicitFixture.update>>();
    expect<"insertCode">().type.toBeAssignableTo<keyof S.Schema.Type<typeof ExplicitFixture.json>>();
    expect<"insertCode">().type.not.toBeAssignableTo<keyof S.Schema.Type<typeof ExplicitFixture.jsonCreate>>();
    expect<"secret">().type.not.toBeAssignableTo<keyof S.Schema.Type<typeof ExplicitFixture.json>>();
    expect<"appCode">().type.not.toBeAssignableTo<keyof S.Schema.Type<typeof ExplicitFixture.jsonCreate>>();
    expect<"payloadText">().type.toBeAssignableTo<keyof S.Schema.Type<typeof ExplicitFixture.jsonCreate>>();
    expect<typeof UpstreamFixture.definition.inputFields.createdAt>().type.toBe<
      typeof UpstreamModel.DateTimeInsertFromNumber
    >();
    expect<EntitySchema.EncodedShape<typeof upstreamFields>["payloadText"]>().type.toBe<string>();
  });
});

void optionalKeyPersisted;
void optionalOptionPersisted;
void servicefulPersisted;
void jsonTextPersisted;
void (null as unknown as MissingSelectPersisted);
