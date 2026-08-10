/** Runtime and projector proofs for the SQLite dialect. */
import { describe, expect, it } from "bun:test";
import { defineRelations, getTableName, is as isDrizzleEntity, SQL } from "drizzle-orm";
import { getTableConfig, SQLiteDialect } from "drizzle-orm/sqlite-core";
import { findFirst } from "effect/Array";
import { getOrThrowWith } from "effect/Option";
import { Boolean, Finite, String, Struct } from "effect/Schema";
import * as SqliteColumn from "../src/sqlite/Column.ts";
import * as SqliteDerive from "../src/sqlite/derive.ts";
import {
  _pgSpecInSqlite,
  _sqliteDimensions,
  _sqliteSpecInPg,
  sqliteAssembly,
  sqliteKit,
  sqliteUserTable,
  SqliteUser,
} from "./sqlite-fixtures.ts";

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
  });

  it("rejects cross-dialect descriptors and array dimensions at runtime", () => {
    expect(_pgSpecInSqlite).toThrow("foreign SQLite column descriptor");
    expect(_sqliteSpecInPg).toThrow("foreign PostgreSQL column descriptor");
    expect(_sqliteDimensions).toThrow("cannot carry array dimensions");
  });
});

describe("SQLite relations", () => {
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
