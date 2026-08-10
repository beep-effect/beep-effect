/** Cross-dialect domain-sharing and SQLite consumer fixtures. */
import { sql } from "drizzle-orm";
import { getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";
import {
  BigInt,
  Finite,
  Int,
  Literals,
  NullOr,
  OptionFromNullOr,
  String,
  Uint8Array as Uint8ArraySchema,
  brand,
} from "effect/Schema";
import type { Top } from "effect/Schema";
import { Model as EffectModel } from "effect/unstable/schema";
import { makeRepository as makeSqlRepository } from "effect/unstable/sql/SqlModel";
import { make, VariantField } from "../src/index.ts";
import * as Field from "../src/core/Field.ts";
import * as Meta from "../src/core/Meta.ts";
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

export class SqlitePlainPrimary extends SqliteModel<SqlitePlainPrimary>(
  "SqlitePlainPrimary",
)({
  id: Int.pipe(sqlite.integer(), sqlite.primaryKey()),
  name: PlainString,
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
export const sqlitePlainPrimaryTable = sqliteKit.toSqliteTable(SqlitePlainPrimary);
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
type SqlitePlainPrimaryInsert = typeof SqlitePlainPrimary.insert.Type;
type SqlitePlainPrimaryDrizzleInsert = typeof sqlitePlainPrimaryTable.$inferInsert;

export type _sqliteDrizzleIdOptional = Expect<IsOptional<SqliteInsert, "id">>;
export type _sqliteVariantUpdateIdOptional = Expect<IsOptional<SqliteUpdate, "id">>;
export type _sqlitePlainPrimaryVariantIdOptional = Expect<
  IsOptional<SqlitePlainPrimaryInsert, "id">
>;
export type _sqlitePlainPrimaryDrizzleIdOptional = Expect<
  IsOptional<SqlitePlainPrimaryDrizzleInsert, "id">
>;
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

export const _sqliteBadVariantVersion = () =>
  VariantField({ select: Int, update: Int }).pipe(
    sqlite.integer(),
    // @ts-expect-error invariant: optimistic versions cannot override explicit variant membership
    sqlite.version(),
  );

export const _sqliteMalformedCorrelatedSpec = () => {
  const field = Field.make(
    String,
    Meta.merge(Meta.empty, {
      column: {
        _tag: "text",
        dialect: "sqlite",
        kind: "blob",
        ident: "text",
        mode: "text",
      },
    }),
  );
  class SqliteMalformedCorrelatedSpec extends SqliteModel<SqliteMalformedCorrelatedSpec>(
    "SqliteMalformedCorrelatedSpec",
  )({
    // @ts-expect-error invariant: malformed hand-built descriptors are outside the model domain
    value: field,
  }) {}
  return SqliteMalformedCorrelatedSpec;
};

export const _sqliteMissingEnumValues = () => {
  const field = Field.make(
    String,
    Meta.merge(Meta.empty, {
      column: {
        _tag: "enum",
        dialect: "sqlite",
        kind: "enum",
        ident: "text",
      },
    }),
  );
  class SqliteMissingEnumValues extends SqliteModel<SqliteMissingEnumValues>(
    "SqliteMissingEnumValues",
  )({
    // @ts-expect-error invariant: malformed hand-built descriptors are outside the model domain
    value: field,
  }) {}
  return SqliteMissingEnumValues;
};

export const sqliteDedupedEnum = Literals(["draft", "draft", "active"]).pipe(sqlite.enum());
export const _sqliteNulEnum = () =>
  Literals(["safe", "nul\0value"]).pipe(sqlite.enum());

const SqliteNonUniqueTargetId = entityId(
  Finite,
  "sqlite_non_unique_target",
  "SqliteNonUniqueTarget",
);
class SqliteNonUniqueTarget extends SqliteModel<SqliteNonUniqueTarget>(
  "SqliteNonUniqueTarget",
)({ id: Int.pipe(sqlite.integer()) }) {}
class SqliteNonUniqueSource extends SqliteModel<SqliteNonUniqueSource>(
  "SqliteNonUniqueSource",
)({
  targetId: Int.pipe(sqlite.integer(), sqlite.references(SqliteNonUniqueTargetId)),
}) {}
export const _sqliteNonUniqueForeignKey = () =>
  // @ts-expect-error invariant: foreign keys must target an inline primary-key or unique column
  sqliteKit.schema({
    sqlite_non_unique_target: SqliteNonUniqueTarget,
    sqlite_non_unique_source: SqliteNonUniqueSource,
  });

class SqliteAlphaUser extends SqliteModel<SqliteAlphaUser>("alpha/User")({ value: String }) {}
class SqliteBetaUser extends SqliteModel<SqliteBetaUser>("beta/User")({ value: String }) {}
export const _sqliteDuplicatePhysicalTableNames = () =>
  sqliteKit.schema({ alpha_user: SqliteAlphaUser, beta_user: SqliteBetaUser });

const SqliteResolutionTargetId = entityId(
  Finite,
  "sqlite_resolution_target",
  "SqliteResolutionTarget",
);
class SqliteResolutionTarget extends SqliteModel<SqliteResolutionTarget>(
  "SqliteResolutionTarget",
)({ id: Int.pipe(sqlite.integer(), sqlite.primaryKey()) }) {}
class SqliteResolutionDecoy extends SqliteModel<SqliteResolutionDecoy>(
  "SqliteResolutionDecoy",
)({ id: Int.pipe(sqlite.integer(), sqlite.primaryKey()) }) {}
class SqliteResolutionSource extends SqliteModel<SqliteResolutionSource>(
  "SqliteResolutionSource",
)({
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

// @ts-expect-error invariant: absent SQLite capability is a missing export
export const _sqliteHasNoArray = sqlite.array;

// Wave D compile-time name fixtures: every public SQLite naming surface.
export const _sqliteInvalidColumnNameType = () => String.pipe(
  // @ts-expect-error invariant: explicit column names use the cheap SQL-name prefix
  sqlite.columnName("Bad Name"),
);
export const _sqliteInvalidColumnNameUnionType = (name: "valid_name" | "BadName") => String.pipe(
  // @ts-expect-error invariant: one invalid literal conservatively rejects the whole name union
  sqlite.columnName(name),
);
export const _sqliteInvalidIndexNameType = (columns: SqliteTable.BoundColumns<{ value: typeof String }>) =>
  // @ts-expect-error invariant: index names use the cheap SQL-name prefix
  SqliteTable.index("Bad.Index", [columns.value]);
export const _sqliteInvalidUniqueNameType = (columns: SqliteTable.BoundColumns<{ one: typeof String; two: typeof String }>) =>
  // @ts-expect-error invariant: composite unique names use the cheap SQL-name prefix
  SqliteTable.compositeUnique("Bad Unique", [columns.one, columns.two]);
export const _sqliteInvalidPrimaryNameType = (columns: SqliteTable.BoundColumns<{ one: typeof String; two: typeof String }>) =>
  // @ts-expect-error invariant: composite primary-key names use the cheap SQL-name prefix
  SqliteTable.compositePrimaryKey("Bad-Pk", [columns.one, columns.two]);
export const _sqliteInvalidCheckNameType = () =>
  // @ts-expect-error invariant: check names use the cheap SQL-name prefix
  SqliteTable.check("Bad Check")(sql<boolean>`true`);
export const _sqliteInvalidModelNameType = () =>
  // @ts-expect-error invariant: model identifiers cheaply corroborate their derived table name
  SqliteModel("Bad Model");
export const _sqliteInvalidKitNameType = () => make({
  dialect: "sqlite",
  // @ts-expect-error invariant: kit default field keys derive valid physical names
  defaultColumns: () => ({ "bad key": String }),
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
    "SqlitePhysicalColumnCollision",
  )({ userId: SqliteNameFixtureString, user_id: SqliteNameFixtureString }) {}
  return SqlitePhysicalColumnCollision;
};
export const _sqliteCaseFoldColumnCollision = () => {
  const uppercase: string = "FOO";
  class SqliteCaseFoldColumnCollision extends SqliteModel<SqliteCaseFoldColumnCollision>(
    "SqliteCaseFoldColumnCollision",
  )({
    first: SqliteNameFixtureString.pipe(sqlite.columnName("foo")),
    second: Field.patch(SqliteNameFixtureString, { columnName: uppercase }),
  }) {}
  return SqliteCaseFoldColumnCollision;
};
export const _sqliteDuplicateIndexNamespace = () => {
  class SqliteFirstIndexOwner extends SqliteModel<SqliteFirstIndexOwner>("SqliteFirstIndexOwner")(
    { value: SqliteNameFixtureString },
    (columns) => [SqliteTable.index("shared_namespace_idx", [columns.value])],
  ) {}
  class SqliteSecondIndexOwner extends SqliteModel<SqliteSecondIndexOwner>("SqliteSecondIndexOwner")(
    { value: SqliteNameFixtureString },
    (columns) => [SqliteTable.index("shared_namespace_idx", [columns.value])],
  ) {}
  return sqliteKit.schema({
    sqlite_first_index_owner: SqliteFirstIndexOwner,
    sqlite_second_index_owner: SqliteSecondIndexOwner,
  });
};
export const _sqliteDuplicateConstraintNamespace = () => {
  class SqliteFirstConstraintOwner extends SqliteModel<SqliteFirstConstraintOwner>(
    "SqliteFirstConstraintOwner",
  )(
    { value: SqliteNameFixtureString },
    (columns) => [
      SqliteTable.check("shared_namespace_check")(sql<boolean>`${columns.value} <> ''`),
    ],
  ) {}
  class SqliteSecondConstraintOwner extends SqliteModel<SqliteSecondConstraintOwner>(
    "SqliteSecondConstraintOwner",
  )(
    { value: SqliteNameFixtureString },
    (columns) => [
      SqliteTable.check("shared_namespace_check")(sql<boolean>`${columns.value} <> ''`),
    ],
  ) {}
  return sqliteKit.schema({
    sqlite_first_constraint_owner: SqliteFirstConstraintOwner,
    sqlite_second_constraint_owner: SqliteSecondConstraintOwner,
  });
};

const SqliteWaveEString = String.annotate({ identifier: "SqliteWaveEString" });
export const sqliteBoundedInteger = Int.pipe(sqlite.integer());
export const sqliteFiniteNumeric = Finite.pipe(sqlite.numeric({ mode: "number" }));
export const sqliteBoundedBigintNumeric = BigInt.pipe(sqlite.numeric({ mode: "bigint" }));
export const _sqliteNumericStringMode = () =>
  // @ts-expect-error invariant: NUMERIC string mode is representation-lossy; use text()
  SqliteWaveEString.pipe(sqlite.numeric({ mode: "string" }));

export const _sqliteInvalidFiniteDefault = () => {
  class InvalidFiniteDefault extends SqliteModel<InvalidFiniteDefault>(
    "SqliteInvalidFiniteDefault",
  )({ value: Finite.pipe(sqlite.real(), sqlite.default(Number.NaN)) }) {}
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
    value: Uint8ArraySchema.pipe(
      sqlite.blob({ mode: "buffer" }),
      sqlite.default(new Uint8Array([0, 39, 255])),
    ),
  }) {}
  return BlobDefault;
};

export const _sqliteParameterizedDefault = () => {
  class ParameterizedDefault extends SqliteModel<ParameterizedDefault>(
    "SqliteParameterizedDefault",
  )({ value: SqliteWaveEString.pipe(sqlite.defaultExpr(sql<string>`${"active"}`)) }) {}
  return sqliteKit.toSqliteTable(ParameterizedDefault);
};
export const _sqliteParameterizedGenerated = () => {
  class ParameterizedGenerated extends SqliteModel<ParameterizedGenerated>(
    "SqliteParameterizedGenerated",
  )({
    source: SqliteWaveEString,
    value: SqliteWaveEString.pipe(sqlite.generated(sql<string>`${"active"}`)),
  }) {}
  return sqliteKit.toSqliteTable(ParameterizedGenerated);
};
export const _sqliteParameterizedCheck = () => {
  class ParameterizedCheck extends SqliteModel<ParameterizedCheck>("SqliteParameterizedCheck")(
    { value: SqliteWaveEString },
    () => [SqliteTable.check("sqlite_parameterized_check")(sql<boolean>`${1} > 0`)],
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(ParameterizedCheck));
};
export const _sqliteParameterizedPartialIndex = () => {
  class ParameterizedPartialIndex extends SqliteModel<ParameterizedPartialIndex>(
    "SqliteParameterizedPartialIndex",
  )(
    { value: SqliteWaveEString },
    (columns) => [
      SqliteTable.index("sqlite_parameterized_partial_idx", [columns.value], {
        where: sql<boolean>`${1} > 0`,
      }),
    ],
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(ParameterizedPartialIndex));
};

export const _sqliteDuplicateCompositeRuntime = () => {
  class DuplicateComposite extends SqliteModel<DuplicateComposite>(
    "SqliteDuplicateComposite",
  )(
    { one: Int, two: Int },
    (columns) => [
      // @ts-expect-error invariant: runtime mirror survives type suppression
      SqliteTable.compositeUnique("sqlite_duplicate_composite", [columns.one, columns.one]),
    ],
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(DuplicateComposite));
};
export const _sqliteNullableCompositePrimaryRuntime = () => {
  class NullableCompositePrimary extends SqliteModel<NullableCompositePrimary>(
    "SqliteNullableCompositePrimary",
  )(
    { one: NullOr(Int), two: Int },
    (columns) => [
      // @ts-expect-error invariant: runtime mirror survives type suppression
      SqliteTable.compositePrimaryKey("sqlite_nullable_composite_pk", [columns.one, columns.two]),
    ],
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(NullableCompositePrimary));
};
export const _sqliteMultiplePrimaryKeys = () => {
  class MultiplePrimaryKeys extends SqliteModel<MultiplePrimaryKeys>(
    "SqliteMultiplePrimaryKeys",
  )(
    { id: Int.pipe(sqlite.integer(), sqlite.primaryKey()), one: Int, two: Int },
    (columns) => [
      SqliteTable.compositePrimaryKey("sqlite_second_pk", [columns.one, columns.two]),
    ],
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(MultiplePrimaryKeys));
};
export const _sqliteDuplicateExtrasNames = () => {
  class DuplicateExtrasNames extends SqliteModel<DuplicateExtrasNames>(
    "SqliteDuplicateExtrasNames",
  )(
    { one: Int, two: Int },
    (columns) => [
      SqliteTable.compositeUnique("sqlite_same_extra", [columns.one, columns.two]),
      SqliteTable.check("sqlite_same_extra")(sql<boolean>`true`),
    ],
  ) {}
  return getSqliteTableConfig(sqliteKit.toSqliteTable(DuplicateExtrasNames));
};
export const _sqliteSetNullNonNullableType = () =>
  SharedOrganizationId.pipe(
    sqlite.integer(),
    // @ts-expect-error invariant: SET NULL requires nullable encoded source
    sqlite.references(SharedOrganizationId, { onDelete: "set null" }),
  );
export const _sqliteSetDefaultWithoutDefaultType = () =>
  SharedOrganizationId.pipe(
    sqlite.integer(),
    // @ts-expect-error invariant: SET DEFAULT requires a declared database default
    sqlite.references(SharedOrganizationId, { onDelete: "set default" }),
  );
export const _sqliteSetNullNonNullable = () => {
  const targetId = Field.patch(SharedOrganizationId.pipe(sqlite.integer()), {
    references: {
      tableName: SharedOrganizationId.tableName,
      columnName: "id",
      onDelete: "set null",
      onUpdate: undefined,
    },
  });
  class SetNullSource extends SqliteModel<SetNullSource>("SqliteSetNullSource")({
    targetId,
  }) {}
  return sqliteKit.schema({ shared_organization: SqliteOrganization, set_null_source: SetNullSource });
};
export const _sqliteSetDefaultWithoutDefault = () => {
  const targetId = Field.patch(SharedOrganizationId.pipe(sqlite.integer()), {
    references: {
      tableName: SharedOrganizationId.tableName,
      columnName: "id",
      onDelete: "set default",
      onUpdate: undefined,
    },
  });
  class SetDefaultSource extends SqliteModel<SetDefaultSource>("SqliteSetDefaultSource")({
    targetId,
  }) {}
  return sqliteKit.schema({
    shared_organization: SqliteOrganization,
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
    globalThis.Array.from({ length: 2_001 }, (_, index) => [`field_${index}`, SqliteWaveEString]),
  );
  // @ts-expect-error invariant: dynamic widened keys defer to the runtime model validator
  class TooManyColumns extends SqliteModel<TooManyColumns>("SqliteTooManyColumns")(fields) {}
  return TooManyColumns;
};
