/** Cross-dialect domain-sharing and SQLite consumer fixtures. */

import { make, VariantField } from "@beep/effect-drizzle";
import { Table as SqliteTable } from "@beep/effect-drizzle/sqlite";
import { sql } from "drizzle-orm";
import { getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";
import {
  BigInt,
  brand,
  Date as DateSchema,
  Finite,
  Int,
  instanceOf,
  is,
  Literals,
  NullOr,
  OptionFromNullOr,
  String,
  Uint8Array as Uint8ArraySchema,
} from "effect/Schema";
import { Model as EffectModel } from "effect/unstable/schema";
import { makeRepository as makeSqlRepository } from "effect/unstable/sql/SqlModel";
import type { Top } from "effect/Schema";

function attachStatics<Self extends object, Statics extends object>(self: Self, statics: Statics): Self & Statics;
function attachStatics(self: object, statics: object): object {
  return Object.assign(self, statics);
}

const entityId = <const TableName extends string, const EntityType extends string, Sch extends Top>(
  schema: Sch,
  tableName: TableName,
  entityType: EntityType
): Sch & { readonly tableName: TableName; readonly entityType: EntityType } =>
  attachStatics(schema, { tableName, entityType });

/** Dialect-free id and status schemas bound independently by both kits. */
const SharedUserId = entityId(Finite.pipe(brand("SharedUserId")), "shared_user", "SharedUser");
const SharedOrganizationId = entityId(
  Finite.pipe(brand("SharedOrganizationId")),
  "shared_organization",
  "SharedOrganization"
);
const SharedStatus = Literals(["draft", "active"]).annotate({
  identifier: "@beep/effect-drizzle/test/SharedStatus",
  description: "Dialect-free status used by the cross-dialect symmetry fixture.",
});
const PlainString = String.annotate({
  identifier: "@beep/effect-drizzle/test/SqlitePlainString",
});

export const sqliteKit = make("sqlite", (sqlite) => ({
  defaultColumns: {
    createdAt: EffectModel.DateTimeInsert.pipe(sqlite.text()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(sqlite.text()),
    rowVersion: Int.pipe(sqlite.integer(), sqlite.default(1), sqlite.version()),
  },
  defaultExtras: (columns) => [
    // SQLite has no `using` index surface; checks and partial indexes are direct extras.
    SqliteTable.check(sql<boolean>`${columns.rowVersion} > 0`, "sqlite_row_version_positive"),
  ],
}));

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

export class SqlitePlainPrimary extends SqliteModel<SqlitePlainPrimary>("SqlitePlainPrimary")({
  id: Int.pipe(sqlite.integer(), sqlite.primaryKey()),
  name: PlainString,
}) {}

class SqliteMembership extends SqliteModel<SqliteMembership>("SharedMembership")(
  {
    organizationId: SharedOrganizationId,
    userId: SharedUserId,
    role: PlainString.pipe(sqlite.text(), sqlite.default("member")),
  },
  (columns) => [
    sqliteKit.Table.compositePrimaryKey("shared_membership_pk", [columns.organizationId, columns.userId]),
    sqliteKit.Table.index("shared_membership_role_idx", [columns.role], {
      where: sql<boolean>`${columns.role} <> ''`,
    }),
  ]
) {}

export const sqliteAssembly = sqliteKit.schema({
  shared_organization: SqliteOrganization,
  shared_user: SqliteUser,
  shared_membership: SqliteMembership,
});
export const { shared_membership, shared_organization, shared_user } = sqliteAssembly.tables;
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

const pgSymmetryKit = make("pg", (pg) => ({
  defaultColumns: {
    createdAt: EffectModel.DateTimeInsert.pipe(pg.timestamp()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(pg.timestamp()),
    rowVersion: Int.pipe(pg.integer(), pg.default(1), pg.version()),
  },
}));
const { pg } = pgSymmetryKit;

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

export const _sqliteBadVariantVersion = () =>
  VariantField({ select: Int, update: Int }).pipe(
    sqlite.integer(),
    // @ts-expect-error invariant: optimistic versions cannot override explicit variant membership
    sqlite.version()
  );

export const _sqliteDateJsonMode = () =>
  DateSchema.pipe(
    // @ts-expect-error invariant: SQLite JSON mode accepts only arrays and string-keyed records
    sqlite.text({ mode: "json" })
  );

export const _sqliteBytesJsonMode = () =>
  Uint8ArraySchema.pipe(
    // @ts-expect-error invariant: SQLite JSON mode rejects declaration-backed byte arrays
    sqlite.blob({ mode: "json" })
  );

export const _sqliteDateJsonModelMirror = _sqliteDateJsonMode;

export const _sqliteBareDeclaration = () => {
  class SqliteBareDeclaration extends SqliteModel<SqliteBareDeclaration>("SqliteBareDeclaration")({
    // @ts-expect-error invariant: declaration-backed objects do not derive SQLite JSON storage
    value: instanceOf(RegExp),
  }) {}
  return SqliteBareDeclaration;
};

export const _nullableSqliteVersion = () =>
  NullOr(Int).pipe(
    sqlite.integer(),
    // @ts-expect-error invariant: optimistic versions cannot be nullable
    sqlite.version()
  );

export const _nullableSqliteVersionModelMirror = _nullableSqliteVersion;

export const sqliteDedupedEnum = Literals(["draft", "draft", "active"]).pipe(sqlite.enum());
export const _sqliteNulEnum = () => Literals(["safe", "nul\0value"]).pipe(sqlite.enum());

const SqliteNonUniqueTargetId = entityId(Finite, "sqlite_non_unique_target", "SqliteNonUniqueTarget");
class SqliteNonUniqueTarget extends SqliteModel<SqliteNonUniqueTarget>("SqliteNonUniqueTarget")({
  id: Int.pipe(sqlite.integer()),
}) {}
class SqliteNonUniqueSource extends SqliteModel<SqliteNonUniqueSource>("SqliteNonUniqueSource")({
  targetId: Int.pipe(sqlite.integer(), sqlite.references(SqliteNonUniqueTargetId)),
}) {}
export const _sqliteNonUniqueForeignKey = () =>
  // @ts-expect-error invariant: foreign keys must target an inline primary-key or unique column
  sqliteKit.schema({
    sqlite_non_unique_target: SqliteNonUniqueTarget,
    sqlite_non_unique_source: SqliteNonUniqueSource,
  });

const SqliteUniqueIndexTargetId = entityId(Finite, "sqlite_unique_index_target", "SqliteUniqueIndexTarget");
class SqliteUniqueIndexTarget extends SqliteModel<SqliteUniqueIndexTarget>("SqliteUniqueIndexTarget")({
  id: Int.pipe(sqlite.integer(), sqlite.uniqueIndex()),
}) {}
class SqliteUniqueIndexSource extends SqliteModel<SqliteUniqueIndexSource>("SqliteUniqueIndexSource")({
  targetId: Int.pipe(sqlite.integer(), sqlite.references(SqliteUniqueIndexTargetId)),
}) {}
export const sqliteUniqueIndexForeignKeySchema = sqliteKit.schema({
  sqlite_unique_index_target: SqliteUniqueIndexTarget,
  sqlite_unique_index_source: SqliteUniqueIndexSource,
});

class SqliteAlphaUser extends SqliteModel<SqliteAlphaUser>("alpha/User")({ value: String }) {}
class SqliteBetaUser extends SqliteModel<SqliteBetaUser>("beta/User")({ value: String }) {}
export const _sqliteDuplicatePhysicalTableNames = () =>
  sqliteKit.schema({ alpha_user: SqliteAlphaUser, beta_user: SqliteBetaUser });

const SqliteResolutionTargetId = entityId(Finite, "sqlite_resolution_target", "SqliteResolutionTarget");
class SqliteResolutionTarget extends SqliteModel<SqliteResolutionTarget>("SqliteResolutionTarget")({
  id: Int.pipe(sqlite.integer(), sqlite.primaryKey()),
}) {}
class SqliteResolutionDecoy extends SqliteModel<SqliteResolutionDecoy>("SqliteResolutionDecoy")({
  id: Int.pipe(sqlite.integer(), sqlite.primaryKey()),
}) {}
class SqliteResolutionSource extends SqliteModel<SqliteResolutionSource>("SqliteResolutionSource")({
  targetId: Int.pipe(sqlite.integer(), sqlite.references(SqliteResolutionTargetId)),
}) {}

export const sqliteExactKeyResolutionSchema = sqliteKit.schema({
  sqlite_resolution_target: SqliteResolutionDecoy,
  physical_target: SqliteResolutionTarget,
  sqlite_resolution_source: SqliteResolutionSource,
});
export const sqliteUniquePhysicalResolutionSchema =
  // @ts-expect-error boundary: physical-name fallback is runtime-only until model statics preserve literals
  sqliteKit.schema({
    physical_target: SqliteResolutionTarget,
    sqlite_resolution_source: SqliteResolutionSource,
  });

export const _sqliteEmptyColumnName = () => {
  const name: string = "";
  return String.pipe(sqlite.columnName(name));
};
export const _sqliteNulColumnName = () => {
  const name: string = "nul\0name";
  return String.pipe(sqlite.columnName(name));
};
const SqliteNameFixtureString = String.annotate({ identifier: "SqliteWaveDNameFixtureString" });
export const _sqlitePhysicalColumnCollision = () => {
  class SqlitePhysicalColumnCollision extends SqliteModel<SqlitePhysicalColumnCollision>(
    "SqlitePhysicalColumnCollision"
  )({ userId: SqliteNameFixtureString, user_id: SqliteNameFixtureString }) {}
  return SqlitePhysicalColumnCollision;
};
export const _sqliteCaseFoldColumnCollision = () => {
  const uppercase: string = "FOO";
  class SqliteCaseFoldColumnCollision extends SqliteModel<SqliteCaseFoldColumnCollision>(
    "SqliteCaseFoldColumnCollision"
  )({
    first: SqliteNameFixtureString.pipe(sqlite.columnName("foo")),
    second: SqliteNameFixtureString.pipe(sqlite.columnName(uppercase)),
  }) {}
  return SqliteCaseFoldColumnCollision;
};
export const _sqliteDuplicateIndexNamespace = () => {
  class SqliteFirstIndexOwner extends SqliteModel<SqliteFirstIndexOwner>("SqliteFirstIndexOwner")(
    { value: SqliteNameFixtureString },
    (columns) => [SqliteTable.index("shared_namespace_idx", [columns.value])]
  ) {}
  class SqliteSecondIndexOwner extends SqliteModel<SqliteSecondIndexOwner>("SqliteSecondIndexOwner")(
    { value: SqliteNameFixtureString },
    (columns) => [SqliteTable.index("shared_namespace_idx", [columns.value])]
  ) {}
  return sqliteKit.schema({
    sqlite_first_index_owner: SqliteFirstIndexOwner,
    sqlite_second_index_owner: SqliteSecondIndexOwner,
  });
};
export const _sqliteDuplicateConstraintNamespace = () => {
  class SqliteFirstConstraintOwner extends SqliteModel<SqliteFirstConstraintOwner>("SqliteFirstConstraintOwner")(
    { value: SqliteNameFixtureString },
    (columns) => [SqliteTable.check("shared_namespace_check")(sql<boolean>`${columns.value} <> ''`)]
  ) {}
  class SqliteSecondConstraintOwner extends SqliteModel<SqliteSecondConstraintOwner>("SqliteSecondConstraintOwner")(
    { value: SqliteNameFixtureString },
    (columns) => [SqliteTable.check("shared_namespace_check")(sql<boolean>`${columns.value} <> ''`)]
  ) {}
  return sqliteKit.schema({
    sqlite_first_constraint_owner: SqliteFirstConstraintOwner,
    sqlite_second_constraint_owner: SqliteSecondConstraintOwner,
  });
};

const SqliteWaveEString = String.annotate({ identifier: "SqliteWaveEString" });
export const sqliteBoundedInteger = Int.pipe(sqlite.integer());
export const sqliteFiniteNumeric = Finite.pipe(sqlite.numeric({ mode: "number" }));
export const sqliteFiniteReal = Finite.pipe(sqlite.real());
class SqliteBareReal extends SqliteModel<SqliteBareReal>("SqliteBareReal")({
  value: Finite,
}) {}
export const sqliteBareRealRejectsNaN = !is(SqliteBareReal.insert)({ value: Number.NaN });
export const sqliteBoundedBigintNumeric = BigInt.pipe(sqlite.numeric({ mode: "bigint" }));
export const _sqliteNumericStringMode = () =>
  // @ts-expect-error invariant: NUMERIC string mode is representation-lossy; use text()
  SqliteWaveEString.pipe(sqlite.numeric({ mode: "string" }));

export const _sqliteInvalidFiniteDefault = () => {
  class InvalidFiniteDefault extends SqliteModel<InvalidFiniteDefault>("SqliteInvalidFiniteDefault")({
    value: Finite.pipe(sqlite.real(), sqlite.default(Number.NaN)),
  }) {}
  return InvalidFiniteDefault;
};
export const _sqliteNulDefault = () => {
  class NulDefault extends SqliteModel<NulDefault>("SqliteNulDefault")({
    value: SqliteWaveEString.pipe(sqlite.text(), sqlite.default("bad\0value")),
  }) {}
  return NulDefault;
};
export const _sqliteBlobDefault = () => {
  class BlobDefault extends SqliteModel<BlobDefault>("SqliteBlobDefault")({
    value: Uint8ArraySchema.pipe(sqlite.blob({ mode: "buffer" }), sqlite.default(new Uint8Array([0, 39, 255]))),
  }) {}
  return BlobDefault;
};

export const _sqliteParameterizedDefault = () => {
  class ParameterizedDefault extends SqliteModel<ParameterizedDefault>("SqliteParameterizedDefault")({
    value: SqliteWaveEString.pipe(sqlite.defaultExpr(sql<string>`${"active"}`)),
  }) {}
  return sqliteKit.toSqliteTable(ParameterizedDefault);
};
export const _sqliteParameterizedGenerated = () => {
  class ParameterizedGenerated extends SqliteModel<ParameterizedGenerated>("SqliteParameterizedGenerated")({
    source: SqliteWaveEString,
    value: SqliteWaveEString.pipe(sqlite.generated(sql<string>`${"active"}`)),
  }) {}
  return sqliteKit.toSqliteTable(ParameterizedGenerated);
};
export const _sqliteParameterizedCheck = () => {
  class ParameterizedCheck extends SqliteModel<ParameterizedCheck>("SqliteParameterizedCheck")(
    { value: SqliteWaveEString },
    () => [SqliteTable.check("sqlite_parameterized_check")(sql<boolean>`${1} > 0`)]
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(ParameterizedCheck));
};
export const _sqliteParameterizedPartialIndex = () => {
  class ParameterizedPartialIndex extends SqliteModel<ParameterizedPartialIndex>("SqliteParameterizedPartialIndex")(
    { value: SqliteWaveEString },
    (columns) => [
      SqliteTable.index("sqlite_parameterized_partial_idx", [columns.value], {
        where: sql<boolean>`${1} > 0`,
      }),
    ]
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(ParameterizedPartialIndex));
};

export const _sqliteDuplicateCompositeRuntime = () => {
  class DuplicateComposite extends SqliteModel<DuplicateComposite>("SqliteDuplicateComposite")(
    { one: Int, two: Int },
    (columns) => [
      // @ts-expect-error invariant: runtime mirror survives type suppression
      SqliteTable.compositeUnique("sqlite_duplicate_composite", [columns.one, columns.one]),
    ]
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(DuplicateComposite));
};
export const _sqliteNullableCompositePrimaryRuntime = () => {
  class NullableCompositePrimary extends SqliteModel<NullableCompositePrimary>("SqliteNullableCompositePrimary")(
    { one: NullOr(Int), two: Int },
    (columns) => [
      // @ts-expect-error invariant: runtime mirror survives type suppression
      SqliteTable.compositePrimaryKey("sqlite_nullable_composite_pk", [columns.one, columns.two]),
    ]
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(NullableCompositePrimary));
};
export const _sqliteMultiplePrimaryKeys = () => {
  class MultiplePrimaryKeys extends SqliteModel<MultiplePrimaryKeys>("SqliteMultiplePrimaryKeys")(
    { id: Int.pipe(sqlite.integer(), sqlite.primaryKey()), one: Int, two: Int },
    (columns) => [SqliteTable.compositePrimaryKey("sqlite_second_pk", [columns.one, columns.two])]
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(MultiplePrimaryKeys));
};
export const _sqliteDuplicateExtrasNames = () => {
  class DuplicateExtrasNames extends SqliteModel<DuplicateExtrasNames>("SqliteDuplicateExtrasNames")(
    { one: Int, two: Int },
    (columns) => [
      SqliteTable.compositeUnique("sqlite_same_extra", [columns.one, columns.two]),
      SqliteTable.check("sqlite_same_extra")(sql<boolean>`true`),
    ]
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(DuplicateExtrasNames));
};
export const _sqliteSetNullNonNullable = () => {
  class SetNullSource extends SqliteModel<SetNullSource>("SqliteSetNullSource")({
    // @ts-expect-error invariant: runtime model construction mirrors SET NULL validation
    targetId: SharedOrganizationId.pipe(
      sqlite.integer(),
      // @ts-expect-error invariant: SET NULL requires nullable encoded source
      sqlite.references({ id: SharedOrganizationId, options: { onDelete: "set null" } })
    ),
  }) {}
  // @ts-expect-error invariant: runtime schema assembly mirrors SET NULL validation
  return sqliteKit.schema({ shared_organization: SqliteOrganization, set_null_source: SetNullSource });
};
export const _sqliteSetDefaultWithoutDefault = () => {
  class SetDefaultSource extends SqliteModel<SetDefaultSource>("SqliteSetDefaultSource")({
    // @ts-expect-error invariant: runtime model construction mirrors SET DEFAULT validation
    targetId: SharedOrganizationId.pipe(
      sqlite.integer(),
      // @ts-expect-error invariant: SET DEFAULT requires a declared database default
      sqlite.references({ id: SharedOrganizationId, options: { onDelete: "set default" } })
    ),
  }) {}
  return sqliteKit.schema({
    shared_organization: SqliteOrganization,
    // @ts-expect-error invariant: runtime schema assembly mirrors SET DEFAULT validation
    set_default_source: SetDefaultSource,
  });
};

export const _sqliteEmptyModel = () => {
  class EmptyModel extends SqliteModel<EmptyModel>("SqliteEmptyModel")({}) {}
  return EmptyModel;
};
export const _sqliteGeneratedOnlyModel = () => {
  class GeneratedOnly extends SqliteModel<GeneratedOnly>("SqliteGeneratedOnly")({
    value: SqliteWaveEString.pipe(sqlite.generated(sql<string>`lower('x')`)),
  }) {}
  return GeneratedOnly;
};
export const _sqliteTooManyColumns = () => {
  const fields: Record<string, typeof SqliteWaveEString> = Object.fromEntries(
    globalThis.Array.from({ length: 2_001 }, (_, index) => [`field_${index}`, SqliteWaveEString])
  );
  // @ts-expect-error invariant: dynamic widened keys defer to the runtime model validator
  class TooManyColumns extends SqliteModel<TooManyColumns>("SqliteTooManyColumns")(fields) {}
  return TooManyColumns;
};
