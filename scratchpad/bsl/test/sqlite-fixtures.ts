/** Cross-dialect domain-sharing and SQLite consumer fixtures. */
import { sql } from "drizzle-orm";
import {
  Finite,
  Int,
  Literals,
  OptionFromNullOr,
  String,
  brand,
} from "effect/Schema";
import type { Top } from "effect/Schema";
import { Model as EffectModel } from "effect/unstable/schema";
import { makeRepository as makeSqlRepository } from "effect/unstable/sql/SqlModel";
import { make } from "../src/index.ts";
import * as Field from "../src/core/Field.ts";
import * as SqliteColumn from "../src/sqlite/Column.ts";
import * as SqliteTable from "../src/sqlite/extras.ts";

function attachStatics<Self extends object, Statics extends object>(
  self: Self,
  statics: Statics,
): Self & Statics;
function attachStatics(self: object, statics: object): object {
  return Object.assign(self, statics);
}

const entityId = <const TableName extends string, const EntityType extends string, Sch extends Top>(
  schema: Sch,
  tableName: TableName,
  entityType: EntityType,
): Sch & { readonly tableName: TableName; readonly entityType: EntityType } =>
  attachStatics(schema, { tableName, entityType });

/** Dialect-free id and status schemas bound independently by both kits. */
export const SharedUserId = entityId(Finite.pipe(brand("SharedUserId")), "shared_user", "SharedUser");
export const SharedOrganizationId = entityId(
  Finite.pipe(brand("SharedOrganizationId")),
  "shared_organization",
  "SharedOrganization",
);
export const SharedStatus = Literals(["draft", "active"]).annotate({
  identifier: "@beep/effect-drizzle/test/SharedStatus",
  description: "Dialect-free status used by the cross-dialect symmetry fixture.",
});
const PlainString = String.annotate({
  identifier: "@beep/effect-drizzle/test/SqlitePlainString",
});

export const sqliteKit = make({
  dialect: "sqlite",
  defaultColumns: (sqlite) => ({
    createdAt: EffectModel.DateTimeInsert.pipe(sqlite.text()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(sqlite.text()),
    rowVersion: Int.pipe(sqlite.integer(), sqlite.default(1), sqlite.version()),
  }),
  defaultExtras: (columns) => [
    // SQLite has no `using` index surface; checks and partial indexes are direct extras.
    SqliteTable.check(sql<boolean>`${columns.rowVersion} > 0`, "sqlite_row_version_positive"),
  ],
});

const { Entity: SqliteEntity, Model: SqliteModel, sqlite } = sqliteKit;

export class SqliteOrganization extends SqliteModel<SqliteOrganization>("SharedOrganization")({
  id: SharedOrganizationId.pipe(sqlite.integer(), sqlite.autoIncrement()),
  name: PlainString,
}) {}

export class SqliteUser extends SqliteEntity<SqliteUser>("SharedUser")({
  id: SharedUserId.pipe(sqlite.integer(), sqlite.autoIncrement()),
  organizationId: SharedOrganizationId,
  name: PlainString,
  nickname: OptionFromNullOr(PlainString),
  status: SharedStatus.pipe(sqlite.enum(), sqlite.default("active")),
}) {}

export class SqliteMembership extends SqliteModel<SqliteMembership>("SharedMembership")(
  {
    organizationId: SharedOrganizationId,
    userId: SharedUserId,
    role: PlainString.pipe(sqlite.text(), sqlite.default("member")),
  },
  (columns) => [
    sqliteKit.Table.compositePrimaryKey("shared_membership_pk", [
      columns.organizationId,
      columns.userId,
    ]),
    sqliteKit.Table.index("shared_membership_role_idx", [columns.role], {
      where: sql<boolean>`${columns.role} <> ''`,
    }),
  ],
) {}

export const sqliteAssembly = sqliteKit.schema({
  shared_organization: SqliteOrganization,
  shared_user: SqliteUser,
  shared_membership: SqliteMembership,
});
export const {
  shared_membership,
  shared_organization,
  shared_user,
} = sqliteAssembly.tables;
export const sqliteUserTable = sqliteKit.toSqliteTable(SqliteUser);
export const sqliteUserRepository = sqliteKit.Repository(SqliteUser, {
  spanPrefix: "SqliteUser",
  idColumn: "id",
});
export const sqliteNativeUserRepository = makeSqlRepository(SqliteUser, {
  tableName: SqliteUser.sql.tableName,
  spanPrefix: "SqliteUserNative",
  idColumn: "id",
});

export const pgSymmetryKit = make({
  dialect: "pg",
  defaultColumns: (pg) => ({
    createdAt: EffectModel.DateTimeInsert.pipe(pg.timestamp()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(pg.timestamp()),
    rowVersion: Int.pipe(pg.integer(), pg.default(1), pg.version()),
  }),
});
const { Entity: PgEntity, pg } = pgSymmetryKit;

export class PgSharedUser extends PgEntity<PgSharedUser>("SharedUserPg")({
  id: SharedUserId.pipe(pg.integer(), pg.identity(), pg.primaryKey()),
  organizationId: SharedOrganizationId,
  name: PlainString,
  nickname: OptionFromNullOr(PlainString),
  status: SharedStatus.pipe(pg.enum("shared_status"), pg.default("active")),
}) {}

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<_T extends true> = never;
type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;
type SqliteInsert = typeof sqliteUserTable.$inferInsert;
type SqliteUpdate = typeof SqliteUser.update.Type;

export type _sqliteDrizzleIdOptional = Expect<IsOptional<SqliteInsert, "id">>;
export type _sqliteVariantUpdateIdOptional = Expect<IsOptional<SqliteUpdate, "id">>;
export type _sqliteCreatedAtShared = Expect<
  Equal<
    SqliteUser["createdAt"],
    PgSharedUser["createdAt"]
  >
>;

export const _pgSpecInSqlite = () => {
  class PgSpecInSqlite extends SqliteModel<PgSpecInSqlite>("PgSpecInSqlite")({
    // @ts-expect-error invariant: PostgreSQL descriptors cannot enter SQLite models
    value: String.pipe(pg.text()),
  }) {}
  return PgSpecInSqlite;
};

export const _sqliteSpecInPg = () => {
  class SqliteSpecInPg extends pgSymmetryKit.Model<SqliteSpecInPg>("SqliteSpecInPg")({
    // @ts-expect-error invariant: SQLite descriptors cannot enter PostgreSQL models
    value: String.pipe(sqlite.text()),
  }) {}
  return SqliteSpecInPg;
};

export const _sqliteDimensions = () => {
  const field = Field.patch(String, {
    column: SqliteColumn.Text.make({ mode: "text" }),
    dimensions: 1,
  });
  class SqliteDimensions extends SqliteModel<SqliteDimensions>("SqliteDimensions")({
    // @ts-expect-error invariant: SQLite has no array dimensions
    value: field,
  }) {}
  return SqliteDimensions;
};

// @ts-expect-error invariant: absent SQLite capability is a missing export
export const _sqliteHasNoArray = sqlite.array;
