import { EntityTable } from "@beep/drizzle";
import { $SchemaId } from "@beep/identity";
import * as EntitySchema from "@beep/schema/EntitySchema";
import * as Model from "@beep/schema/Model";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $SchemaId.create("EntityTable.test");

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
        indexHints: [EntitySchema.IndexHint.btree],
      }),
      name: EntitySchema.persist.text({
        indexHints: [EntitySchema.IndexHint.unique],
      }),
      optionalName: EntitySchema.persist.text({
        columnName: "optional_name",
      }),
      payload: EntitySchema.persist.jsonb({
        indexHints: [EntitySchema.IndexHint.gin],
      }),
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
      indexHints: [EntitySchema.IndexHint.btree],
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

const indexConfigNamed = (name: string) =>
  pipe(
    getTableConfig(Table).indexes,
    A.findFirst((indexConfig) => indexConfig.config.name === name)
  );

describe("EntityTable", () => {
  it("projects entity definitions to Drizzle table metadata", () => {
    const columns = EntityTable.columns(Table);
    const config = getTableConfig(Table);

    expect(Table.definition).toBe(Fixture.definition);
    expect(Table.entitySchema).toBe(Fixture);
    expect(config.name).toBe("fixture");
    expect(columns.id.name).toBe("id");
    expect(columns.id.primary).toBe(true);
    expect(columns.id.hasDefault).toBe(true);
    expect(columns.id.columnType).toBe("PgSerial");
    expect(columns.name.columnType).toBe("PgText");
    expect(columns.isActive.name).toBe("is_active");
    expect(columns.isActive.columnType).toBe("PgBoolean");
    expect(columns.optionalName.name).toBe("optional_name");
    expect(columns.optionalName.notNull).toBe(false);
    expect(columns.payload.columnType).toBe("PgJsonb");
    expect(columns.publicId.name).toBe("public_id");
    expect(columns.publicId.columnType).toBe("PgText");
    expect(columns.publicId.notNull).toBe(true);
    expect(columns.publicId.primary).toBe(false);
    expect(columns.rowVersion.name).toBe("row_version");
    expect(columns.rowVersion.columnType).toBe("PgInteger");
  });

  it("projects explicit Model helper fields from selected persistence schemas", () => {
    const columns = EntityTable.columns(ExplicitTable);

    expect(ExplicitTable.definition.fields.optionalName).toBe(ExplicitFixture.definition.fields.optionalName);
    expect(columns.binaryUuid.columnType).toBe("PgBytea");
    expect(columns.occurredAt.columnType).toBe("PgTimestamp");
    expect(columns.optionalName.name).toBe("optional_name");
    expect(columns.optionalName.notNull).toBe(false);
    expect(columns.payloadText.name).toBe("payload_text");
    expect(columns.payloadText.columnType).toBe("PgText");
    expect(columns.payloadText.notNull).toBe(true);
    expect(columns.secret.columnType).toBe("PgText");
  });

  it("builds supported indexes from schema-first hints", () => {
    const activeBtree = indexConfigNamed("fixture_is_active_btree_idx");
    const nameUnique = indexConfigNamed("fixture_name_unique_idx");
    const payloadGin = indexConfigNamed("fixture_payload_gin_idx");
    const publicIdUnique = indexConfigNamed("fixture_public_id_unique_idx");

    expect(O.getOrThrow(activeBtree).config.method).toBe("btree");
    expect(O.getOrThrow(activeBtree).config.columns[0]).toMatchObject({ name: "is_active" });
    expect(O.getOrThrow(nameUnique).config.unique).toBe(true);
    expect(O.getOrThrow(nameUnique).config.columns[0]).toMatchObject({ name: "name" });
    expect(O.getOrThrow(payloadGin).config.method).toBe("gin");
    expect(O.getOrThrow(payloadGin).config.columns[0]).toMatchObject({ name: "payload" });
    expect(O.getOrThrow(publicIdUnique).config.unique).toBe(true);
    expect(O.getOrThrow(publicIdUnique).config.columns[0]).toMatchObject({ name: "public_id" });
  });
});
