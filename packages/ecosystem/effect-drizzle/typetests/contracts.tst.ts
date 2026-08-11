import { Model, make, VariantField } from "@beep/effect-drizzle";
import * as pg from "@beep/effect-drizzle/pg";
import * as sqlite from "@beep/effect-drizzle/sqlite";
import { sql } from "drizzle-orm";
import { Array, BigInt, Boolean, Finite, Int, Literals, NullOr, String } from "effect/Schema";
import { Model as EffectModel } from "effect/unstable/schema";
import { expect, it } from "tstyche";

const OrganizationId = Object.assign(Int, {
  tableName: "organization" as const,
  entityType: "Organization" as const,
});

class Organization extends Model<Organization>("Organization")({
  id: OrganizationId.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
  name: String.pipe(pg.text(), pg.unique()),
}) {}

class User extends Model<User>("User")({
  id: Int.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
  organizationId: OrganizationId.pipe(pg.integer(), pg.references(OrganizationId)),
  name: String.pipe(pg.varchar(120)),
  active: Boolean,
  status: Literals(["draft", "active"]).pipe(pg.enum("type_contract_status"), pg.default("draft")),
  rowVersion: Int.pipe(pg.integer(), pg.default(1), pg.version()),
}) {}

const userTable = pg.toPgTable(User);
const assembly = pg.schema({ organization: Organization, user: User });

declare const pgColumns: pg.Table.BoundColumns<{
  readonly one: typeof Int;
  readonly two: typeof Int;
  readonly value: typeof String;
}>;
declare const nullablePgColumns: pg.Table.BoundColumns<{
  readonly one: ReturnType<typeof NullOr<typeof Int>>;
  readonly two: typeof Int;
}>;
declare const sqliteColumns: sqlite.Table.BoundColumns<{
  readonly one: typeof String;
  readonly two: typeof String;
  readonly value: typeof String;
}>;

it("derives Drizzle select and insert contracts", () => {
  expect<typeof assembly.tables.organization>().type.toBe<typeof assembly.tables.organization>();
  expect<(typeof userTable.$inferSelect)["id"]>().type.toBe<number>();
  expect<(typeof userTable.$inferSelect)["name"]>().type.toBe<string>();
  expect<(typeof userTable.$inferSelect)["status"]>().type.toBe<"draft" | "active">();
  expect<typeof userTable.$inferInsert>().type.toBeAssignableFrom<{
    readonly organizationId: number;
    readonly name: string;
    readonly active: boolean;
  }>();
});

it("keeps generated and defaulted fields in the intended model variants", () => {
  type Insert = (typeof User.insert)["Type"];
  type Update = (typeof User.update)["Type"];

  expect<Insert>().type.not.toHaveProperty("id");
  expect<Insert>().type.toHaveProperty("name");
  expect<Insert>().type.toHaveProperty("status");
  expect<Update>().type.toHaveProperty("id");
  expect<Update>().type.toHaveProperty("rowVersion");

  const explicit = VariantField({ select: String, update: String });
  expect<(typeof explicit)["schemas"]>().type.toHaveProperty("select");
  expect<(typeof explicit)["schemas"]>().type.toHaveProperty("update");
  expect<(typeof explicit)["schemas"]>().type.not.toHaveProperty("insert");
});

it("preserves resolved metadata algebra", () => {
  const field = String.pipe(pg.varchar(80), pg.unique(), pg.default("guest"));
  expect<(typeof field.meta.column)["kind"]>().type.toBe<"varchar">();
  expect<(typeof field.meta.column)["length"]>().type.toBe<80>();
  expect<typeof field.meta.unique>().type.toBe<true>();
  expect<typeof field.meta.hasDefault>().type.toBe<true>();
  expect<(typeof User.sql.columns.organizationId.references)["tableName"]>().type.toBe<"organization">();
});

it("infers dialect kits and their invariant fields", () => {
  const kit = make({
    dialect: "pg",
    defaultColumns: (columns) => ({
      createdAt: EffectModel.DateTimeInsert.pipe(columns.timestamp()),
      rowVersion: Int.pipe(columns.integer(), columns.default(1), columns.version()),
    }),
  });
  class Account extends kit.Entity<Account>("Account")({
    id: Int.pipe(kit.pg.integer(), kit.pg.identity("always"), kit.pg.primaryKey()),
    name: String,
  }) {}

  expect<typeof kit.pg.integer>().type.toBe<typeof pg.integer>();
  expect<(typeof Account.select)["Type"]>().type.toHaveProperty("createdAt");
  expect<(typeof Account.update)["Type"]>().type.toHaveProperty("rowVersion");
});

it("pins public PostgreSQL diagnostic literals", () => {
  expect(String.pipe(pg.integer())).type.toRaiseError("pg.integer requires a number-encoded schema");
  expect(Int.pipe(pg.text())).type.toRaiseError("pg.text requires a string-encoded schema");
  expect(Int.pipe(pg.identity())).type.toRaiseError(
    "identity() requires an explicit integer-family column first (pg.integer/pg.smallint/pg.bigint) — bare number schemas derive doublePrecision"
  );
  expect(NullOr(Int).pipe(pg.integer(), pg.version())).type.toRaiseError("version() forbids a nullable schema");
  expect(OrganizationId.pipe(pg.integer(), pg.references(OrganizationId, { onDelete: "set null" }))).type.toRaiseError(
    "SET NULL references require a nullable encoded schema"
  );
});

it("pins public SQLite diagnostic literals", () => {
  expect(String.pipe(sqlite.integer())).type.toRaiseError("sqlite.integer requires a number-encoded schema");
  expect(Int.pipe(sqlite.text())).type.toRaiseError("sqlite.text requires a string-encoded schema");
  expect(Int.pipe(sqlite.version())).type.toRaiseError("version() requires sqlite.integer number mode");
  expect(
    OrganizationId.pipe(sqlite.integer(), sqlite.references(OrganizationId, { onDelete: "set default" }))
  ).type.toRaiseError("SET DEFAULT references require a declared database default");
});

it("pins PostgreSQL carrier and modifier diagnostics", () => {
  expect(Finite.pipe(pg.varchar(80))).type.toRaiseError("pg.varchar requires a string-encoded schema");
  expect(Finite.pipe(pg.uuid())).type.toRaiseError("pg.uuid requires a string-encoded schema");
  expect(String.pipe(pg.smallint())).type.toRaiseError("pg.smallint requires a number-encoded schema");
  expect(String.pipe(pg.doublePrecision())).type.toRaiseError("pg.doublePrecision requires a number-encoded schema");
  expect(Finite.pipe(pg.bigint("bigint"))).type.toRaiseError("pg.bigint('bigint') requires a bigint-encoded schema");
  expect(String.pipe(pg.serial())).type.toRaiseError("pg.serial requires a number-encoded schema");
  expect(String.pipe(pg.boolean())).type.toRaiseError("pg.boolean requires a boolean-encoded schema");
  expect(Boolean.pipe(pg.jsonb())).type.toRaiseError("pg.jsonb requires an object- or array-encoded schema");
  expect(Finite.pipe(pg.timestamp())).type.toRaiseError("pg.timestamp (string mode) requires a string-encoded schema");
  expect(String.pipe(pg.timestamp({ mode: "date" }))).type.toRaiseError(
    "pg.timestamp (date mode) requires a Date-encoded schema"
  );
  expect(String.pipe(pg.text(), pg.defaultNow())).type.toRaiseError(
    "defaultNow() requires an explicit pg.timestamp column first"
  );
  expect(String.pipe(pg.text(), pg.default(1))).type.toRaiseError(
    "default() value must match the field's encoded carrier"
  );
  expect(String.pipe(pg.text(), pg.defaultExpr(sql<number>`1`))).type.toRaiseError(
    "SQL expression carrier must equal the field's encoded carrier"
  );
  expect(String.pipe(pg.text(), pg.generated(sql<number>`1`))).type.toRaiseError(
    "SQL expression carrier must equal the field's encoded carrier"
  );
  expect(String.pipe(pg.text(), pg.identity())).type.toRaiseError(
    "identity() requires an explicit integer-family column first (pg.integer/pg.smallint/pg.bigint) — bare number schemas derive doublePrecision"
  );
  expect(NullOr(String).pipe(pg.text(), pg.primaryKey())).type.toRaiseError(
    "primaryKey() forbids a nullable schema — a primary key cannot admit null"
  );
  expect(Finite.pipe(pg.numeric())).type.toRaiseError("pg.numeric requires a string-encoded schema");
  expect(String.pipe(pg.date({ mode: "date" }))).type.toRaiseError(
    "pg.date (date mode) requires a Date-encoded schema"
  );
  expect(Finite.pipe(pg.char(2))).type.toRaiseError("pg.char requires a string-encoded schema");
  expect(String.pipe(pg.real())).type.toRaiseError("pg.real requires a number-encoded schema");
  expect(BigInt.pipe(pg.bigserial("number"))).type.toRaiseError(
    "pg.bigserial('number') requires a number-encoded schema"
  );
  expect(Int.pipe(pg.bigserial("bigint"))).type.toRaiseError("pg.bigserial('bigint') requires a bigint-encoded schema");
  expect(String.pipe(pg.smallserial())).type.toRaiseError("pg.smallserial requires a number-encoded schema");
  expect(Array(String).pipe(pg.array(String))).type.toRaiseError(
    "pg.array requires an element schema with an explicit base column combinator"
  );
});

it("pins public SQL-name and table-extra diagnostics", () => {
  expect(String.pipe(pg.columnName("Bad Name"))).type.toRaiseError("pg.columnName requires a lowercase SQL identifier");
  expect(Literals(["ok"]).pipe(pg.enum("Bad-Enum"))).type.toRaiseError(
    "pg.enum name must be a lowercase SQL identifier"
  );
  expect(pg.Table.index("Bad.Index", [pgColumns.value])).type.toRaiseError(
    "Table.index name must be a lowercase SQL identifier"
  );
  expect(pg.Table.compositeUnique("Bad Unique", [pgColumns.one, pgColumns.two])).type.toRaiseError(
    "Table.compositeUnique name must be a lowercase SQL identifier"
  );
  expect(pg.Table.compositePrimaryKey("Bad-Pk", [pgColumns.one, pgColumns.two])).type.toRaiseError(
    "Table.compositePrimaryKey name must be a lowercase SQL identifier"
  );
  expect(pg.Table.check("Bad Check")(sql<boolean>`true`)).type.toRaiseError(
    "Table.check name must be a lowercase SQL identifier"
  );
  expect(Model("Bad Model")).type.toRaiseError("Model identifier derives an invalid PostgreSQL table name");
  expect(make({ dialect: "pg", defaultColumns: () => ({ "bad key": String }) })).type.toRaiseError(
    "model field derives an invalid PostgreSQL column name"
  );
  expect(pg.Table.compositeUnique("duplicate_composite", [pgColumns.one, pgColumns.one])).type.toRaiseError(
    "table extras cannot repeat a column"
  );
  expect(
    pg.Table.compositePrimaryKey("nullable_composite_pk", [nullablePgColumns.one, nullablePgColumns.two])
  ).type.toRaiseError("composite primary-key columns cannot be nullable");

  expect(String.pipe(sqlite.columnName("Bad Name"))).type.toRaiseError(
    "sqlite.columnName requires a lowercase SQL identifier"
  );
  expect(sqlite.Table.index("Bad.Index", [sqliteColumns.value])).type.toRaiseError(
    "Table.index name must be a lowercase SQL identifier"
  );
  expect(sqlite.Table.compositeUnique("Bad Unique", [sqliteColumns.one, sqliteColumns.two])).type.toRaiseError(
    "Table.compositeUnique name must be a lowercase SQL identifier"
  );
  expect(sqlite.Table.compositePrimaryKey("Bad-Pk", [sqliteColumns.one, sqliteColumns.two])).type.toRaiseError(
    "Table.compositePrimaryKey name must be a lowercase SQL identifier"
  );
  expect(sqlite.Table.check("Bad Check")(sql<boolean>`true`)).type.toRaiseError(
    "Table.check name must be a lowercase SQL identifier"
  );
  expect(sqlite.Model("Bad Model")).type.toRaiseError("Model identifier derives an invalid SQLite table name");
  expect(make({ dialect: "sqlite", defaultColumns: () => ({ "bad key": String }) })).type.toRaiseError(
    "model field derives an invalid SQLite column name"
  );
});

it("pins the intentionally absent SQLite array surface", () => {
  expect(sqlite.array).type.toRaiseError();
});
