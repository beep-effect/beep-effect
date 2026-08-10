/** Runtime and projector proofs for the SQLite dialect. */
import { describe, expect, it } from "bun:test";
import { defineRelations, getTableName, is as isDrizzleEntity, SQL } from "drizzle-orm";
import { getTableConfig, SQLiteDialect } from "drizzle-orm/sqlite-core";
import { findFirst } from "effect/Array";
import { getOrThrowWith } from "effect/Option";
import { Boolean, Finite, NullOr, String, Struct, is, suspend } from "effect/Schema";
import * as SqliteColumn from "../src/sqlite/Column.ts";
import * as SqliteDerive from "../src/sqlite/derive.ts";
import { SchemaAssemblyError as SqliteSchemaAssemblyError } from "../src/sqlite/index.ts";
import {
  _pgSpecInSqlite,
  _sqliteBadVariantVersion,
  _sqliteBareDeclaration,
  _sqliteBlobDefault,
  _sqliteBytesJsonMode,
  _sqliteDateJsonMode,
  _sqliteDateJsonModelMirror,
  _sqliteDimensions,
  _sqliteDuplicatePhysicalTableNames,
  _sqliteCaseFoldColumnCollision,
  _sqliteDuplicateIndexNamespace,
  _sqliteDuplicateConstraintNamespace,
  _sqliteEmptyColumnName,
  _sqliteMalformedCorrelatedSpec,
  _sqliteMissingEnumValues,
  _sqliteNonUniqueForeignKey,
  _sqliteNulEnum,
  _sqliteNulColumnName,
  _sqlitePhysicalColumnCollision,
  _sqliteSpecInPg,
  _sqliteDuplicateCompositeRuntime,
  _sqliteDuplicateExtrasNames,
  _sqliteEmptyModel,
  _sqliteGeneratedOnlyModel,
  _sqliteInvalidFiniteDefault,
  _sqliteMultiplePrimaryKeys,
  _sqliteNulDefault,
  _sqliteNullableCompositePrimaryRuntime,
  _sqliteNumericStringMode,
  _nullableSqliteVersion,
  _nullableSqliteVersionModelMirror,
  _sqliteParameterizedCheck,
  _sqliteParameterizedDefault,
  _sqliteParameterizedGenerated,
  _sqliteParameterizedPartialIndex,
  _sqliteSetDefaultWithoutDefault,
  _sqliteSetNullNonNullable,
  _sqliteTooManyColumns,
  sqliteAssembly,
  sqliteBoundedBigintNumeric,
  sqliteBoundedInteger,
  sqliteDedupedEnum,
  sqliteExactKeyResolutionSchema,
  sqliteKit,
  sqliteFiniteNumeric,
  sqliteFiniteReal,
  sqliteBareRealRejectsNaN,
  sqliteUserTable,
  sqliteUniquePhysicalResolutionSchema,
  SqlitePlainPrimary,
  SqliteUser,
} from "./sqlite-fixtures.ts";

describe("SQLite name invariants", () => {
  it("rejects empty and NUL identifiers plus normalized column collisions", () => {
    expect(_sqliteEmptyColumnName).toThrow("must not be empty");
    expect(_sqliteNulColumnName).toThrow("NUL (U+0000)");
    expect(_sqlitePhysicalColumnCollision).toThrow("dialect normalization");
    expect(_sqliteCaseFoldColumnCollision).toThrow("dialect normalization");
  });

  it("rejects duplicate index names in the schema-global namespace", () => {
    expect(_sqliteDuplicateIndexNamespace).toThrow("Schema-global name");
    expect(_sqliteDuplicateIndexNamespace).toThrow(SqliteSchemaAssemblyError);
    expect(_sqliteDuplicateConstraintNamespace).toThrow("Schema-global name");
    expect(_sqliteDuplicateConstraintNamespace).toThrow(SqliteSchemaAssemblyError);
  });
});

describe("SQLite Wave E value and structure invariants", () => {
  it("keeps only faithful NUMERIC modes and injects their value domains", () => {
    expect(_sqliteNumericStringMode).toThrow();
    expect(is(sqliteBoundedInteger.schema)(1.5)).toBe(false);
    expect(is(sqliteFiniteNumeric.schema)(Number.POSITIVE_INFINITY)).toBe(false);
    expect(is(sqliteBoundedBigintNumeric.schema)(9_223_372_036_854_775_808n)).toBe(false);
    expect(is(sqliteFiniteReal.schema)(Number.NaN)).toBe(false);
    expect(sqliteBareRealRejectsNaN).toBe(true);
  });

  it("rejects invalid defaults and parameterized schema expressions", () => {
    expect(_sqliteInvalidFiniteDefault).toThrow("encoded schema");
    expect(_sqliteNulDefault).toThrow("NUL");
    expect(_sqliteBlobDefault).toThrow("unsafeDefaultSql");
    expect(_sqliteParameterizedDefault).toThrow("bound parameters");
    expect(_sqliteParameterizedGenerated).toThrow("bound parameters");
    expect(_sqliteParameterizedCheck).toThrow("bound parameters");
    expect(_sqliteParameterizedPartialIndex).toThrow("bound parameters");
  });

  it("rejects invalid composites, PKs, extras names, and referential actions", () => {
    expect(_sqliteDuplicateCompositeRuntime).toThrow("repeats a physical column");
    expect(_sqliteNullableCompositePrimaryRuntime).toThrow("nullable column");
    expect(_sqliteMultiplePrimaryKeys).toThrow("at most one primary key");
    expect(_sqliteDuplicateExtrasNames).toThrow("names must be unique");
    expect(_sqliteSetNullNonNullable).toThrow("SET NULL");
    expect(_sqliteSetDefaultWithoutDefault).toThrow("SET DEFAULT");
  });

  it("rejects empty, generated-only, and over-ceiling SQLite models", () => {
    expect(_sqliteEmptyModel).toThrow("1 through 2,000");
    expect(_sqliteGeneratedOnlyModel).toThrow("non-generated column");
    expect(_sqliteTooManyColumns).toThrow("1 through 2,000");
  });
});

const config = getTableConfig(sqliteUserTable);
const column = (name: string) =>
  getOrThrowWith(
    findFirst(config.columns, (candidate) => candidate.name === name),
    () => new Error(`SQLite column '${name}' missing`),
  );

describe("SQLite projection", () => {
  it("projects storage classes, names, defaults, and AUTOINCREMENT", () => {
    const id = column("id");
    expect(getTableName(sqliteUserTable)).toBe("shared_user");
    expect(id.getSQLType()).toBe("integer");
    expect(id.primary).toBe(true);
    expect("autoIncrement" in id ? id.autoIncrement : false).toBe(true);
    expect(column("status").getSQLType()).toBe("text");
    expect(column("status").default).toBe("active");
    expect(column("created_at").getSQLType()).toBe("text");
    expect(column("updated_at").getSQLType()).toBe("text");
  });

  it("emits enum and kit checks plus SQLite partial indexes", () => {
    expect(config.checks.map((current) => current.name)).toEqual(
      expect.arrayContaining([
        "shared_user_status_enum_check",
        "sqlite_row_version_positive",
      ]),
    );
    const membership = getTableConfig(sqliteAssembly.tables.shared_membership);
    expect(membership.primaryKeys).toHaveLength(1);
    expect(membership.indexes).toHaveLength(1);
    expect(membership.indexes[0]?.config.where).toBeDefined();
  });

  it("renders sqlite.defaultNow() as an ISO-text strftime expression", () => {
    class SqliteDefaultNow extends sqliteKit.Model<SqliteDefaultNow>("SqliteDefaultNow")({
      createdAt: String.annotate({ identifier: "SqliteDefaultNowText" }).pipe(
        sqliteKit.sqlite.text(),
        sqliteKit.sqlite.defaultNow(),
      ),
    }) {}
    const table = sqliteKit.toSqliteTable(SqliteDefaultNow);
    const defaultValue = getTableConfig(table).columns[0]?.default;
    if (!isDrizzleEntity(defaultValue, SQL)) {
      throw new Error("sqlite.defaultNow() did not project a SQL expression");
    }
    expect(new SQLiteDialect().sqlToQuery(defaultValue).sql).toContain(
      "strftime('%Y-%m-%dT%H:%M:%fZ','now')",
    );
  });
});

describe("SQLite derivation and family invariants", () => {
  it("derives the widest lossless number storage and SQLite-native boolean/JSON modes", () => {
    expect(SqliteDerive.classify(Finite.annotate({ identifier: "FreshFinite" }), "score").column).toEqual(
      SqliteColumn.Real.make({}),
    );
    expect(SqliteDerive.classify(Boolean, "active").column).toEqual(
      SqliteColumn.Integer.make({ mode: "boolean", ident: "integer" }),
    );
    expect(SqliteDerive.classify(Struct({ name: String }), "payload").column).toEqual(
      SqliteColumn.Text.make({ mode: "json" }),
    );
    expect(SqliteDerive.classify(suspend(() => NullOr(String)), "lazy")).toEqual({
      column: SqliteColumn.Text.make({ mode: "text" }),
      nullable: true,
    });
    class SuspendedNullableSqlite extends sqliteKit.Model<SuspendedNullableSqlite>(
      "SuspendedNullableSqlite",
    )({ value: suspend(() => NullOr(String)) }) {}
    expect(SuspendedNullableSqlite.sql.columns.value.column.kind).toBe("text");
  });

  it("rejects cross-dialect descriptors and array dimensions at runtime", () => {
    expect(_pgSpecInSqlite).toThrow("foreign SQLite column descriptor");
    expect(_sqliteSpecInPg).toThrow("foreign PostgreSQL column descriptor");
    expect(_sqliteDimensions).toThrow("cannot carry array dimensions");
    expect(_sqliteMalformedCorrelatedSpec).toThrow("invalid or foreign SQLite column descriptor");
    expect(_sqliteMissingEnumValues).toThrow("invalid or foreign SQLite column descriptor");
    expect(_sqliteBadVariantVersion).toThrow("explicit VariantSchema.Field");
    expect(_sqliteDateJsonMode).toThrow("array- or record-encoded schema");
    expect(_sqliteDateJsonModelMirror).toThrow("array- or record-encoded schema");
    expect(_sqliteBytesJsonMode).toThrow("array- or record-encoded schema");
    expect(_sqliteBareDeclaration).toThrow("Declaration");
    expect(_nullableSqliteVersion).toThrow("nullable schema");
    expect(_nullableSqliteVersionModelMirror).toThrow("cannot be nullable");
    expect(_sqliteNulEnum).toThrow("NUL (U+0000)");
    expect(sqliteDedupedEnum.meta.column.values).toEqual(["draft", "active"]);
    expect(_sqliteNonUniqueForeignKey).toThrow("primary-key or unique column");
    expect(_sqliteNonUniqueForeignKey).toThrow(SqliteSchemaAssemblyError);
    expect(_sqliteDuplicatePhysicalTableNames).toThrow("Physical table name 'user'");
    expect(_sqliteDuplicatePhysicalTableNames).toThrow(SqliteSchemaAssemblyError);
  });

  it("matches SQLite INTEGER PRIMARY KEY rowid omission on both insert surfaces", () => {
    expect(is(SqlitePlainPrimary.insert)({ name: "rowid assigned by SQLite" })).toBe(true);
  });
});

describe("SQLite relations", () => {
  it("resolves exact registry keys before unique physical-name fallbacks", () => {
    const exact = getTableConfig(
      sqliteExactKeyResolutionSchema.tables.sqlite_resolution_source,
    ).foreignKeys[0]?.reference();
    const physical = getTableConfig(
      sqliteUniquePhysicalResolutionSchema.tables.sqlite_resolution_source,
    ).foreignKeys[0]?.reference();
    expect(exact === undefined ? undefined : getTableName(exact.foreignTable)).toBe(
      "sqlite_resolution_decoy",
    );
    expect(physical === undefined ? undefined : getTableName(physical.foreignTable)).toBe(
      "sqlite_resolution_target",
    );
  });

  it("wires forward, reverse, and through relations with generic defineRelations", () => {
    expect(() => defineRelations(sqliteAssembly.tables, sqliteAssembly.relationsConfig)).not.toThrow();
    const users = sqliteAssembly.relations.shared_user?.relations;
    const organizations = sqliteAssembly.relations.shared_organization?.relations;
    expect(users && "organization" in users).toBe(true);
    expect(users && "sharedOrganizationsThroughSharedMembership" in users).toBe(true);
    expect(organizations && "sharedUsers" in organizations).toBe(true);
    expect(organizations && "sharedUsersThroughSharedMembership" in organizations).toBe(true);
    expect(Object.keys(SqliteUser.update.fields)).toContain("id");
  });
});
