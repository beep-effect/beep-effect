import { Model, make, makeRepository, VariantField } from "@beep/effect-drizzle";
import * as pg from "@beep/effect-drizzle/pg";
import * as sqlite from "@beep/effect-drizzle/sqlite";
import { sql } from "drizzle-orm";
import { Service } from "effect/Context";
import { succeed } from "effect/Effect";
import {
  Array,
  BigInt,
  Boolean,
  Date as DateSchema,
  decodeTo,
  Finite,
  Int,
  Literals,
  NullOr,
  String,
  Struct,
} from "effect/Schema";
import { transformOrFail } from "effect/SchemaGetter";
import { Model as EffectModel } from "effect/unstable/schema";
import { expect, it } from "tstyche";
import type { DefaultSqlExpr, DefaultValue, Dialect, References } from "@beep/effect-drizzle";
import type { Custom, Numeric, Timestamp, Varchar } from "@beep/effect-drizzle/pg";
import type { Effect, Success } from "effect/Effect";

type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type MutualExtends<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type ExpectAll<T extends { readonly [K in keyof T]: true }> = T;

const OrganizationId = Object.assign(Int, {
  tableName: "organization" as const,
  entityType: "Organization" as const,
});
const UserId = Object.assign(Int, {
  tableName: "user" as const,
  entityType: "User" as const,
});

declare const configuredDialect: Dialect;
const configuredKit = make(configuredDialect, () => ({ defaultColumns: { label: String } }));

class Organization extends Model<Organization>("Organization")({
  id: OrganizationId.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
  name: String.pipe(pg.text(), pg.unique()),
}) {}

class User extends Model<User>("User")({
  id: Int.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
  organizationId: OrganizationId.pipe(
    pg.integer(),
    pg.references(OrganizationId, { name: "user_organization_id_organization_id_fkey" })
  ),
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
  type Assertions = ExpectAll<{
    readonly assembly: Equal<typeof assembly.tables.organization, typeof assembly.tables.organization>;
    readonly configuredKit: Equal<
      keyof Pick<typeof configuredKit, "Entity" | "Model" | "Table">,
      "Entity" | "Model" | "Table"
    >;
    readonly id: Equal<(typeof userTable.$inferSelect)["id"], number>;
    readonly name: Equal<(typeof userTable.$inferSelect)["name"], string>;
    readonly status: Equal<(typeof userTable.$inferSelect)["status"], "draft" | "active">;
    readonly insert: {
      readonly organizationId: number;
      readonly name: string;
      readonly active: boolean;
    } extends typeof userTable.$inferInsert
      ? true
      : false;
  }>;

  expect<Assertions>().type.toBe<Assertions>();
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
  type Assertions = ExpectAll<{
    readonly kind: Equal<(typeof field.meta.column)["kind"], "varchar">;
    readonly length: Equal<(typeof field.meta.column)["length"], 80>;
    readonly unique: Equal<typeof field.meta.unique, true>;
    readonly hasDefault: Equal<typeof field.meta.hasDefault, true>;
    readonly referencedTable: Equal<(typeof User.sql.columns.organizationId.references)["tableName"], "organization">;
  }>;

  expect<Assertions>().type.toBe<Assertions>();
});

it("exports declaration-portable metadata and PostgreSQL column carriers", () => {
  type Assertions = ExpectAll<{
    readonly defaultSqlExpr: Equal<DefaultSqlExpr<string>["_tag"], "sqlExpr">;
    readonly defaultValue: Equal<DefaultValue<"draft">["value"], "draft">;
    readonly references: Equal<References<"organization", "id">["tableName"], "organization">;
    readonly custom: Equal<Custom<"vector(768)">["sqlType"], "vector(768)">;
    readonly numeric: Equal<Numeric["kind"], "numeric">;
    readonly timestamp: Equal<Timestamp<"date">["mode"], "date">;
    readonly varchar: Equal<Varchar<120>["length"], 120>;
  }>;

  expect<Assertions>().type.toBe<Assertions>();
});

it("infers dialect kits and their invariant fields", () => {
  const kit = make("pg", (columns) => ({
    defaultColumns: {
      createdAt: EffectModel.DateTimeInsert.pipe(columns.timestamp()),
      rowVersion: Int.pipe(columns.integer(), columns.default(1), columns.version()),
    },
  }));
  class Account extends kit.Entity<Account>("Account")({
    id: Int.pipe(kit.pg.integer(), kit.pg.identity("always"), kit.pg.primaryKey()),
    name: String,
  }) {}

  expect<typeof kit.pg.integer>().type.toBe<typeof pg.integer>();
  expect<(typeof Account.select)["Type"]>().type.toHaveProperty("createdAt");
  expect<(typeof Account.update)["Type"]>().type.toHaveProperty("rowVersion");
});

it("preserves migrated PostgreSQL fixture compile contracts", () => {
  class MigratedOrganization extends Model<MigratedOrganization>("MigratedOrganization")({
    id: OrganizationId.pipe(pg.integer(), pg.identity("byDefault"), pg.primaryKey()),
    name: String,
  }) {}
  class MigratedUser extends Model<MigratedUser>("MigratedUser")({
    id: UserId.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
    orgId: OrganizationId,
    email: String.pipe(pg.varchar(320)),
    bio: NullOr(String),
    settings: Struct({ theme: String }),
    active: Boolean,
    status: Literals(["draft", "active"]).pipe(pg.enum("record_status"), pg.default("active")),
    source: Literals(["web", "api"]).pipe(pg.enum()),
    createdAt: EffectModel.DateTimeInsert.pipe(pg.timestamp()),
    searchName: String.pipe(pg.text(), pg.generated(sql<string>`lower(name)`)),
  }) {}
  const migratedUserTable = pg.toPgTable(MigratedUser);
  const kit = make("pg", (columns) => ({
    defaultColumns: {
      rowVersion: Int.pipe(columns.integer(), columns.default(1), columns.version()),
      updatedAt: EffectModel.DateTimeUpdate.pipe(columns.timestamp()),
      createdAt: EffectModel.DateTimeInsert.pipe(columns.timestamp()),
    },
  }));
  class Account extends kit.Entity<Account>("Account")({
    id: UserId.pipe(kit.pg.integer(), kit.pg.identity("always"), kit.pg.primaryKey()),
    name: String,
  }) {}
  class Bare extends kit.Model<Bare>("Bare")({ value: String }) {}
  class Mechanical extends Model<Mechanical>("Mechanical")({
    amount: String.pipe(pg.numeric(10, 2)),
    objectDate: DateSchema.pipe(pg.date({ mode: "date" })),
    largeSequence: Int.pipe(pg.bigserial("number")),
    nativeSequence: BigInt.pipe(pg.bigserial("bigint")),
  }) {}
  const mechanicalTable = pg.toPgTable(Mechanical);
  class ArrayContract extends Model<ArrayContract>("ArrayContract")({
    labels: Array(String).pipe(pg.array(String.pipe(pg.text()))),
    matrix: String.pipe(Array, Array, pg.array(String.pipe(pg.text()), "[][]"), pg.default([["seed"]])),
  }) {}
  const arrayTable = pg.toPgTable(ArrayContract);

  class CodecService extends Service<CodecService, { readonly normalize: (value: string) => string }>()(
    "@beep/effect-drizzle/typetests/CodecService"
  ) {}
  const ServiceString = String.pipe(
    decodeTo(String, {
      decode: transformOrFail((value) => CodecService.use((service) => succeed(service.normalize(value)))),
      encode: transformOrFail((value) => CodecService.use((service) => succeed(service.normalize(value)))),
    })
  );
  class ServiceRecord extends Model<ServiceRecord>("ServiceRecord")({
    id: Int.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
    value: ServiceString.pipe(pg.text()),
    rowVersion: Int.pipe(pg.integer(), pg.default(1), pg.version()),
  }) {}
  const repository = makeRepository(ServiceRecord, { spanPrefix: "ServiceRecord", idColumn: "id" });
  const curriedRepository = makeRepository({ spanPrefix: "ServiceRecord", idColumn: "id" })(ServiceRecord);

  type Select = typeof migratedUserTable.$inferSelect;
  type Insert = typeof migratedUserTable.$inferInsert;
  type UserInsert = (typeof MigratedUser.insert)["Type"];
  type UserUpdate = (typeof MigratedUser.update)["Type"];
  type UserJsonCreate = (typeof MigratedUser.jsonCreate)["Type"];
  type OrganizationInsert = (typeof MigratedOrganization.insert)["Type"];
  type OrganizationUpdate = (typeof MigratedOrganization.update)["Type"];
  type AccountSelect = (typeof Account)["Type"];
  type AccountInsert = (typeof Account.insert)["Type"];
  type AccountUpdate = (typeof Account.update)["Type"];
  type AccountJson = (typeof Account.json)["Type"];
  type MechanicalSelect = typeof mechanicalTable.$inferSelect;
  type MechanicalInsert = typeof mechanicalTable.$inferInsert;
  type ArraySelect = typeof arrayTable.$inferSelect;
  type ArrayInsert = typeof arrayTable.$inferInsert;
  type Repository = Success<typeof repository>;
  type CurriedRepository = Success<typeof curriedRepository>;
  type RepositoryInsert = ReturnType<Repository["insert"]>;
  type RepositoryRequirements =
    RepositoryInsert extends Effect<unknown, unknown, infer Requirements> ? Requirements : never;

  type MigratedPgContracts = ExpectAll<{
    readonly curriedRepositoryInference: Equal<CurriedRepository, Repository>;
    readonly selectId: Equal<Select["id"], number>;
    readonly selectEmail: Equal<Select["email"], string>;
    readonly selectBio: Equal<Select["bio"], string | null>;
    readonly selectSettings: MutualExtends<Select["settings"], { readonly theme: string }>;
    readonly selectActive: Equal<Select["active"], boolean>;
    readonly insertIdAbsent: Equal<"id" extends keyof Insert ? true : false, false>;
    readonly insertCreatedAtRequired: Equal<undefined extends Insert["createdAt"] ? true : false, false>;
    readonly insertEmailRequired: Equal<Insert["email"], string>;
    readonly variantInsertIdAbsent: Equal<"id" extends keyof UserInsert ? true : false, false>;
    readonly variantUpdateIdPresent: Equal<"id" extends keyof UserUpdate ? true : false, true>;
    readonly variantUpdateIdRequired: Equal<IsOptional<UserUpdate, "id">, false>;
    readonly variantDefaultOptional: IsOptional<UserInsert, "status">;
    readonly variantCreatedAtRequired: Equal<IsOptional<UserInsert, "createdAt">, false>;
    readonly variantUpdateEmailOptional: IsOptional<UserUpdate, "email">;
    readonly identityByDefaultInsertPresent: Equal<"id" extends keyof OrganizationInsert ? true : false, true>;
    readonly identityByDefaultInsertOptional: IsOptional<OrganizationInsert, "id">;
    readonly identityByDefaultUpdatePresent: Equal<"id" extends keyof OrganizationUpdate ? true : false, true>;
    readonly identityByDefaultUpdateOptional: IsOptional<OrganizationUpdate, "id">;
    readonly emailIsVarchar: Equal<(typeof MigratedUser)["sql"]["columns"]["email"]["column"]["ident"], "varchar">;
    readonly orgIdIdentity: Equal<
      (typeof MigratedUser)["sql"]["columns"]["orgId"]["column"]["ident"],
      'entityId<"organization">'
    >;
    readonly userIdIdentity: Equal<
      (typeof MigratedUser)["sql"]["columns"]["id"]["column"]["ident"],
      'entityId<"user">'
    >;
    readonly generatedJsonCreateAbsent: Equal<"searchName" extends keyof UserJsonCreate ? true : false, false>;
    readonly kitSelectCreatedAt: MutualExtends<
      AccountSelect["createdAt"],
      (typeof EffectModel.DateTimeInsert.schemas.select)["Type"]
    >;
    readonly kitSelectUpdatedAt: MutualExtends<
      AccountSelect["updatedAt"],
      (typeof EffectModel.DateTimeUpdate.schemas.select)["Type"]
    >;
    readonly kitSelectRowVersion: Equal<AccountSelect["rowVersion"], number>;
    readonly kitInsertUpdatedAtPresent: Equal<"updatedAt" extends keyof AccountInsert ? true : false, true>;
    readonly kitUpdateUpdatedAtPresent: Equal<"updatedAt" extends keyof AccountUpdate ? true : false, true>;
    readonly kitUpdateCreatedAtAbsent: Equal<"createdAt" extends keyof AccountUpdate ? true : false, false>;
    readonly kitInsertRowVersionOptional: IsOptional<AccountInsert, "rowVersion">;
    readonly kitUpdateRowVersionRequired: Equal<IsOptional<AccountUpdate, "rowVersion">, false>;
    readonly kitJsonRowVersionPresent: Equal<"rowVersion" extends keyof AccountJson ? true : false, true>;
    readonly bareModelOptsOutOfDefaults: Equal<"createdAt" extends keyof (typeof Bare)["Type"] ? true : false, false>;
    readonly literalEnumIdentity: Equal<
      (typeof MigratedUser)["sql"]["columns"]["status"]["column"]["ident"],
      "enum<record_status>"
    >;
    readonly derivedEnumIdentity: Equal<
      (typeof MigratedUser)["sql"]["columns"]["source"]["column"]["ident"],
      "enum<source>"
    >;
    readonly numericSelectCarrier: Equal<MechanicalSelect["amount"], string>;
    readonly dateSelectCarrier: Equal<MechanicalSelect["objectDate"], Date>;
    readonly bigserialSelectCarrier: Equal<MechanicalSelect["nativeSequence"], bigint>;
    readonly bigserialInsertOptional: IsOptional<MechanicalInsert, "largeSequence">;
    readonly arraySelectLabels: ArraySelect["labels"] extends ReadonlyArray<string> ? true : false;
    readonly arraySelectMatrix: ArraySelect["matrix"] extends ReadonlyArray<ReadonlyArray<string>> ? true : false;
    readonly arrayInsertMatrixOptional: IsOptional<ArrayInsert, "matrix">;
    readonly repositoryCarriesCodecServices: CodecService extends RepositoryRequirements ? true : false;
  }>;

  expect<MigratedPgContracts>().type.toBe<{ readonly [K in keyof MigratedPgContracts]: true }>();
});

it("preserves migrated SQLite fixture compile contracts", () => {
  const sqliteKit = make("sqlite", (columns) => ({
    defaultColumns: {
      createdAt: EffectModel.DateTimeInsert.pipe(columns.text()),
    },
  }));
  class SqliteUser extends sqliteKit.Entity<SqliteUser>("SqliteUser")({
    id: Int.pipe(sqliteKit.sqlite.integer(), sqliteKit.sqlite.autoIncrement()),
    name: String,
  }) {}
  class SqlitePlainPrimary extends sqliteKit.Model<SqlitePlainPrimary>("SqlitePlainPrimary")({
    id: Int.pipe(sqliteKit.sqlite.integer(), sqliteKit.sqlite.primaryKey()),
    name: String,
  }) {}
  const sqliteUserTable = sqliteKit.toSqliteTable(SqliteUser);
  const sqlitePlainPrimaryTable = sqliteKit.toSqliteTable(SqlitePlainPrimary);
  const pgKit = make("pg", (columns) => ({
    defaultColumns: {
      createdAt: EffectModel.DateTimeInsert.pipe(columns.timestamp()),
    },
  }));
  class PgUser extends pgKit.Entity<PgUser>("PgUser")({ id: Int.pipe(pgKit.pg.integer()), name: String }) {}

  type MigratedSqliteContracts = ExpectAll<{
    readonly sqliteDrizzleIdOptional: IsOptional<typeof sqliteUserTable.$inferInsert, "id">;
    readonly sqliteVariantUpdateIdOptional: IsOptional<(typeof SqliteUser.update)["Type"], "id">;
    readonly sqlitePlainPrimaryVariantIdOptional: IsOptional<(typeof SqlitePlainPrimary.insert)["Type"], "id">;
    readonly sqlitePlainPrimaryDrizzleIdOptional: IsOptional<typeof sqlitePlainPrimaryTable.$inferInsert, "id">;
    readonly sqliteCreatedAtShared: MutualExtends<SqliteUser["createdAt"], PgUser["createdAt"]>;
  }>;

  expect<MigratedSqliteContracts>().type.toBe<{ readonly [K in keyof MigratedSqliteContracts]: true }>();
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
  expect(Int.pipe(pg.references(OrganizationId, { name: "Bad Foreign Key" }))).type.toRaiseError(
    "pg.references constraint name must be a valid PostgreSQL identifier"
  );
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
  expect(make("pg", () => ({ defaultColumns: { "bad key": String } }))).type.toRaiseError(
    "model field derives an invalid PostgreSQL column name"
  );
  expect(pg.Table.compositeUnique("duplicate_composite", [pgColumns.one, pgColumns.one])).type.toRaiseError(
    "table extras cannot repeat a column"
  );
  expect(
    pg.Table.compositePrimaryKey("nullable_composite_pk", [nullablePgColumns.one, nullablePgColumns.two])
  ).type.toRaiseError("composite primary-key columns cannot be nullable");
  expect(
    Model("CallbackGood")({ one: String, two: String }, (columns) => [
      pg.Table.index("callback_good_idx", [columns.one]),
    ])
  ).type.not.toRaiseError();
  expect(
    Model("CallbackMissingField")({ one: String, two: String }, (columns) => [
      pg.Table.index("callback_bad_idx", [columns.missing]),
    ])
  ).type.toRaiseError();
  expect(pg.Table.compositeUnique("callback_bad_unique", [pgColumns.one])).type.toRaiseError();
  expect(pg.Table.compositePrimaryKey("callback_bad_pk", [pgColumns.one])).type.toRaiseError();
  expect(pg.Table.check("callback_bad_check")("one <> ''")).type.toRaiseError();
  expect(pg.Table.index("callback_bad_where", [pgColumns.one], { where: "one <> ''" })).type.toRaiseError();

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
  expect(make("sqlite", () => ({ defaultColumns: { "bad key": String } }))).type.toRaiseError(
    "model field derives an invalid SQLite column name"
  );
});

it("pins the intentionally absent SQLite array surface", () => {
  expect(sqlite.array).type.toRaiseError();
});
