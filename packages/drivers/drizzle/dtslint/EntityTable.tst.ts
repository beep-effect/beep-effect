import { EntityTable } from "@beep/drizzle";
import { $SchemaId } from "@beep/identity";
import * as EntitySchema from "@beep/schema/EntitySchema";
import * as Model from "@beep/schema/Model";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";

const $I = $SchemaId.create("EntityTable.dtslint");

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

const Fixture = EntitySchema.ClassFactory($I`Fixture`)(
  {
    entityId: FixtureId,
    fields: {
      id: FixtureId,
      isActive: S.Boolean,
      name: S.String,
      optionalName: S.String.pipe(S.OptionFromNullOr),
      payload: S.Record(S.String, S.Unknown),
      publicId: S.String,
      rowVersion: EntitySchema.int,
    },
    persisted: {
      id: EntitySchema.persist.entityId({
        valueStrategy: "generatedOnInsert",
      }),
      isActive: EntitySchema.persist.bool({
        columnName: "is_active",
      }),
      name: EntitySchema.persist.text(),
      optionalName: EntitySchema.persist.text({
        columnName: "optional_name",
      }),
      payload: EntitySchema.persist.jsonb(),
      publicId: EntitySchema.persist.text({
        columnName: "public_id",
        indexHints: [EntitySchema.IndexHint.unique],
        valueStrategy: "computedByServiceOnInsert",
      }),
      rowVersion: EntitySchema.persist.int({
        columnName: "row_version",
        valueStrategy: "incrementedOnWrite",
      }),
    },
    tableName: "fixture",
  },
  $I.annote("Fixture", {
    description: "Fixture schema-first table projection entity.",
  })
);

const Table = EntityTable.pgTableFrom(Fixture);
const Columns = EntityTable.columns(Table);

const BinaryUuid = Model.Uint8Array.pipe(S.brand("BinaryUuid"));

const ExplicitFixture = EntitySchema.ClassFactory($I`ExplicitFixture`)({
  fields: {
    binaryUuid: Model.UuidV4Insert(BinaryUuid),
    occurredAt: Model.DateTimeInsertFromDate,
    optionalName: Model.FieldOption(S.String),
    payloadText: Model.JsonFromString(
      S.Struct({
        enabled: S.Boolean,
      })
    ),
    secret: Model.Sensitive(S.String),
  },
  persisted: {
    binaryUuid: EntitySchema.persist.blob({
      valueStrategy: "defaultedOnInsert",
    }),
    occurredAt: EntitySchema.persist.timestampDate({
      valueStrategy: "defaultedOnInsert",
    }),
    optionalName: EntitySchema.persist.text({
      columnName: "optional_name",
    }),
    payloadText: EntitySchema.persist.text({
      columnName: "payload_text",
    }),
    secret: EntitySchema.persist.text(),
  },
  tableName: "explicit_fixture",
});

const ExplicitTable = EntityTable.pgTableFrom(ExplicitFixture);
const ExplicitColumns = EntityTable.columns(ExplicitTable);

describe("EntityTable types", () => {
  it("preserves table definition metadata", () => {
    expect<typeof Table.definition.tableName>().type.toBe<"fixture">();
    expect<typeof Table.definition.entityId.entityType>().type.toBe<"Fixture">();
    expect<typeof Table.definition.persisted.id.storageKind>().type.toBe<"entityId">();
    expect<typeof Table.definition.persisted.id.valueStrategy>().type.toBe<"generatedOnInsert">();
    expect<typeof Table.definition.persisted.publicId.valueStrategy>().type.toBe<"computedByServiceOnInsert">();
    expect<typeof Table.definition.persisted.payload.storageKind>().type.toBe<"jsonb">();
    expect<typeof Table.entitySchema>().type.toBe<typeof Fixture>();
  });

  it("derives table column metadata types", () => {
    expect<typeof Columns.id.name>().type.toBe<string>();
    expect<typeof Columns.isActive.name>().type.toBe<string>();
    expect<typeof Columns.optionalName.name>().type.toBe<string>();
    expect<typeof Columns.payload.name>().type.toBe<string>();
    expect<typeof Columns.publicId.name>().type.toBe<string>();
    expect<typeof ExplicitColumns.occurredAt.name>().type.toBe<string>();
    expect<typeof ExplicitTable.definition.persisted.occurredAt.storageKind>().type.toBe<"timestampDate">();
    expect<typeof ExplicitTable.definition.persisted.payloadText.storageKind>().type.toBe<"text">();
  });
});
