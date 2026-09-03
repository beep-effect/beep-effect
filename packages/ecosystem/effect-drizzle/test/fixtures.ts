/** Compile-time and runtime consumer fixtures. */

import { Model, make, makeRepository, VariantField } from "@beep/effect-drizzle";
import * as pg from "@beep/effect-drizzle/pg";
import { schema, Table, toPgTable } from "@beep/effect-drizzle/pg";
import { getColumnTable, getTableName, sql } from "drizzle-orm";
import { getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { head } from "effect/Array";
import { getOrThrow } from "effect/Option";
import {
  Array,
  BigInt,
  Boolean,
  brand,
  Date as DateSchema,
  Finite,
  Int,
  instanceOf,
  isGreaterThan,
  isLengthBetween,
  isMaxLength,
  isMinLength,
  Literals,
  NullOr,
  OptionFromNullOr,
  String,
  Struct,
  Uint8Array as Uint8ArraySchema,
  Union,
} from "effect/Schema";
import { Model as EffectModel } from "effect/unstable/schema";
import { SqlModel } from "effect/unstable/sql";
import type { Top } from "effect/Schema";

const PosInt = Int.check(
  isGreaterThan(0, {
    identifier: "PosIntPositiveCheck",
    title: "Positive Integer",
    description: "Checks that a row version is a positive integer.",
    message: "Expected a positive integer.",
  })
).annotate({
  identifier: "@beep/effect-drizzle/test/PosInt",
  description: "Positive integer used by kit row-version defaults.",
});

const RecordStatus = Literals(["draft", "active"]).annotate({
  identifier: "@beep/effect-drizzle/test/RecordStatus",
  description: "Lifecycle status stored in the shared record_status enum.",
});
const RecordSource = Literals(["web", "api"]).annotate({
  identifier: "@beep/effect-drizzle/test/RecordSource",
  description: "Creation source stored in a field-derived PostgreSQL enum.",
});

const auditKit = make("pg", (pg) => ({
  defaultColumns: {
    createdAt: EffectModel.DateTimeInsert.pipe(pg.timestamp()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(pg.timestamp()),
    rowVersion: PosInt.pipe(pg.integer(), pg.default(1), pg.version()),
  },
  defaultExtras: (columns) => {
    const name: string = `${getTableName(getColumnTable(columns.rowVersion))}_row_version_positive`;
    return [Table.check(sql<boolean>`${columns.rowVersion} > 0`, name)];
  },
}));

export class AuditedRecord extends auditKit.Entity<AuditedRecord>("AuditedRecord")(
  {
    name: String,
    status: RecordStatus.pipe(pg.enum("record_status")),
    source: RecordSource.pipe(pg.enum()),
    search: String.pipe(pg.unsafeCustom("tsvector")),
  },
  (columns) => [Table.check(sql<boolean>`${columns.name} <> ''`, "audited_record_name_non_empty")]
) {}

class NamedUniqueRecord extends Model<NamedUniqueRecord>("NamedUniqueRecord")(
  {
    email: String.pipe(pg.text()),
  },
  {
    description: "Fixture proving annotations and table extras can be supplied together.",
  },
  (columns) => [Table.uniqueIndex("named_unique_record_email_unique_idx", [columns.email])]
) {}

export const namedUniqueRecordTable = toPgTable(NamedUniqueRecord);

class ExtraCoverageRecord extends Model<ExtraCoverageRecord>("ExtraCoverageRecord")(
  {
    code: String.pipe(pg.text()),
    email: String.pipe(pg.text()),
  },
  (columns) => [
    Table.uniqueIndex("extra_coverage_record_email_unique_idx", [columns.email], {
      where: sql<boolean>`${columns.email} <> ''`,
    }),
    Table.unsafeCheckSql("extra_coverage_record_code_check", "code <> ''"),
  ]
) {}

export const extraCoverageRecordTable = toPgTable(ExtraCoverageRecord);

class AuditedEvent extends auditKit.Entity<AuditedEvent>("AuditedEvent")({
  label: String,
  status: RecordStatus.pipe(pg.enum("record_status")),
}) {}

class BareJunction extends auditKit.Model<BareJunction>("BareJunction")(
  {
    leftId: Int.pipe(pg.integer()),
    rightId: Int.pipe(pg.integer()),
  },
  (columns) => [Table.compositePrimaryKey("bare_junction_pk", [columns.leftId, columns.rightId])]
) {}

class MechanicalColumns extends Model<MechanicalColumns>("MechanicalColumns")({
  amount: String.pipe(pg.numeric({ precision: 10, scale: 2 })),
  calendarDate: String.pipe(pg.date()),
  objectDate: DateSchema.pipe(pg.date({ mode: "date" })),
  code: String.check(isLengthBetween(4, 4)).pipe(pg.char()),
  payload: Struct({ ok: Boolean }).pipe(pg.json()),
  score: Finite.pipe(pg.real()),
  largeSequence: Int.pipe(pg.bigserial("number")),
  nativeSequence: BigInt.pipe(pg.bigserial("bigint")),
  shortSequence: Int.pipe(pg.smallserial()),
}) {}

export const mechanicalTable = toPgTable(MechanicalColumns);

export const auditSchema = auditKit.schema({
  audited_record: AuditedRecord,
  audited_event: AuditedEvent,
  bare_junction: BareJunction,
});

const entityId = <const TableName extends string, const EntityType extends string, Sch extends Top>(
  id: Sch,
  tableName: TableName,
  entityType: EntityType
): Sch & { readonly tableName: TableName; readonly entityType: EntityType } =>
  attachStatics(id, { tableName, entityType });

function attachStatics<Self extends object, Statics extends object>(self: Self, statics: Statics): Self & Statics;
function attachStatics(self: object, statics: object): object {
  return Object.assign(self, statics);
}

export const UserId = entityId(Finite.pipe(brand("UserId")), "user", "User");
export const OrganizationId = entityId(Finite.pipe(brand("OrganizationId")), "organization", "Organization");
const NullableOrganizationId = entityId(NullOr(Finite.pipe(brand("OrganizationId"))), "organization", "Organization");

export class Organization extends Model<Organization>("Organization")(
  {
    id: OrganizationId.pipe(pg.integer(), pg.identity("byDefault"), pg.primaryKey()),
    parentOrgId: NullableOrganizationId.pipe(pg.references({ id: OrganizationId, options: { onDelete: "set null" } })),
    slug: String.check(isMaxLength(50)).pipe(pg.varchar(50)),
    name: String,
    code: String,
  },
  (t) => [
    Table.compositeUnique("organization_name_slug_unique", [t.name, t.slug]),
    Table.index("organization_slug_idx", [t.slug], {
      using: "btree",
      where: sql<boolean>`${t.slug} <> ''`,
    }),
    Table.check(sql<boolean>`${t.name} <> ''`, "organization_name_check"),
  ]
) {}

export class User extends auditKit.Entity<User>("User")(
  {
    id: UserId.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
    orgId: OrganizationId,
    email: String.check(isMaxLength(320)).pipe(pg.varchar(320), pg.unique()),
    name: String,
    bio: NullOr(String),
    nickname: OptionFromNullOr(String),
    settings: Struct({ theme: String }),
    active: Boolean,
    status: RecordStatus.pipe(pg.enum("record_status"), pg.default("active")),
    searchName: String.pipe(pg.text(), pg.generated(sql<string>`lower(name)`)),
  },
  (t) => [
    Table.compositeUnique("user_org_email_unique", [t.orgId, t.email]),
    Table.index("user_email_idx", [t.email], {
      using: "btree",
      where: sql<boolean>`${t.active} = true`,
    }),
    Table.check("user_email_check")(sql<boolean>`${t.email} <> ''`),
  ]
) {}

export const userRepository = SqlModel.makeRepository(User, {
  tableName: User.sql.tableName,
  spanPrefix: "User",
  idColumn: "id",
});

export const userOptimisticRepository = auditKit.Repository(User, {
  spanPrefix: "User",
  idColumn: "id",
});

class Membership extends Model<Membership>("Membership")(
  {
    organizationId: OrganizationId,
    userId: UserId,
    role: String.pipe(pg.text(), pg.default("member")),
  },
  (t) => [Table.compositePrimaryKey("membership_pk", [t.organizationId, t.userId])]
) {}

class DualOrgLink extends Model<DualOrgLink>("DualOrgLink")({
  primaryOrgId: OrganizationId,
  secondaryOrgId: OrganizationId,
}) {}

export class ArrayRecord extends Model<ArrayRecord>("ArrayRecord")({
  id: Int.pipe(pg.integer(), pg.identity("byDefault"), pg.primaryKey()),
  labels: Array(String).pipe(pg.array(String.pipe(pg.text())), pg.unique()),
  matrix: String.pipe(
    Array,
    Array,
    pg.array({ element: String.pipe(pg.text()), suffix: "[][]" }),
    pg.default([["seed"]])
  ),
}) {}

class EnumArrayRecord extends Model<EnumArrayRecord>("EnumArrayRecord")({
  statuses: Array(RecordStatus).pipe(pg.array(RecordStatus.pipe(pg.enum("record_status")))),
}) {}

export class ExplicitVariantModel extends Model<ExplicitVariantModel>("ExplicitVariantModel")({
  value: VariantField({
    select: String,
    insert: String,
    update: String,
  }).pipe(pg.text(), pg.generated(sql<string>`lower(value)`)),
}) {}

class UniqueTargetRef {
  static readonly tableName = "unique_target";
  static readonly entityType = "UniqueTarget";
}
class UniqueTarget extends Model<UniqueTarget>("UniqueTarget")({
  id: Int.pipe(pg.integer(), pg.uniqueIndex()),
}) {}
class UniqueSource extends Model<UniqueSource>("UniqueSource")({
  targetId: Int.pipe(pg.integer(), pg.references(UniqueTargetRef)),
}) {}

export const userTable = toPgTable(User);
export const effectDrizzleSchema = schema({
  user: User,
  organization: Organization,
  membership: Membership,
  array_record: ArrayRecord,
  enum_array_record: EnumArrayRecord,
  record_status: class EnumExportCollision extends Model<EnumExportCollision>("EnumExportCollision")({
    status: RecordStatus.pipe(pg.enum("record_status")),
    code: String.check(isLengthBetween(4, 4)).pipe(pg.char()),
  }) {},
  deduped_enum: class DedupedEnum extends Model<DedupedEnum>("DedupedEnum")({
    value: Literals(["draft", "draft", "active"]).pipe(pg.enum("deduped_status")),
  }) {},
  unique_target: UniqueTarget,
  unique_source: UniqueSource,
});

export const dualOrgLinkSchema = schema({
  organization: Organization,
  dual_org_link: DualOrgLink,
});

// Negative matrix: each assertion names the rejected invariant.

// @ts-expect-error invariant: text requires a string-encoded schema
const _badText = Finite.pipe(pg.text());
// @ts-expect-error invariant: integer requires a number-encoded schema
const _badInteger = String.pipe(pg.integer());
// @ts-expect-error invariant: bigint number-mode requires a number-encoded schema
const _badBigintNumber = BigInt.pipe(pg.bigint("number"));
// @ts-expect-error invariant: bytea requires a Uint8Array-encoded schema
const _badBytea = String.pipe(pg.bytea());

export const _runtimeStringCarrierMismatch = () => {
  class RuntimeStringCarrierMismatch extends Model<RuntimeStringCarrierMismatch>("RuntimeStringCarrierMismatch")({
    value: _badText,
  }) {}
  return RuntimeStringCarrierMismatch;
};
export const _runtimeNumberCarrierMismatch = () => {
  class RuntimeNumberCarrierMismatch extends Model<RuntimeNumberCarrierMismatch>("RuntimeNumberCarrierMismatch")({
    value: _badInteger,
  }) {}
  return RuntimeNumberCarrierMismatch;
};
export const _runtimeDateCarrierMismatch = () => {
  class RuntimeDateCarrierMismatch extends Model<RuntimeDateCarrierMismatch>("RuntimeDateCarrierMismatch")({
    value: _badDateString(),
  }) {}
  return RuntimeDateCarrierMismatch;
};
export const _runtimeByteCarrierMismatch = () => {
  class RuntimeByteCarrierMismatch extends Model<RuntimeByteCarrierMismatch>("RuntimeByteCarrierMismatch")({
    value: _badBytea,
  }) {}
  return RuntimeByteCarrierMismatch;
};
export const _runtimeObjectCarrierMismatch = () => {
  class RuntimeObjectCarrierMismatch extends Model<RuntimeObjectCarrierMismatch>("RuntimeObjectCarrierMismatch")({
    value: _badJson(),
  }) {}
  return RuntimeObjectCarrierMismatch;
};
export const _runtimeModeCarrierMismatch = () => {
  class RuntimeModeCarrierMismatch extends Model<RuntimeModeCarrierMismatch>("RuntimeModeCarrierMismatch")({
    value: _badBigintNumber,
  }) {}
  return RuntimeModeCarrierMismatch;
};
export const _runtimeArrayCarrierMismatch = () => {
  class RuntimeArrayCarrierMismatch extends Model<RuntimeArrayCarrierMismatch>("RuntimeArrayCarrierMismatch")({
    value: Array(Finite).pipe(
      // @ts-expect-error invariant: the array carrier must agree with its element descriptor
      pg.array(String.pipe(pg.text()))
    ),
  }) {}
  return RuntimeArrayCarrierMismatch;
};
export const _badEnumBroadString = () =>
  // @ts-expect-error invariant: pg.enum rejects broad string schemas
  String.pipe(pg.enum("bad_status"));
const _badDateString = () =>
  // @ts-expect-error invariant: string date mode requires a string-encoded schema
  DateSchema.pipe(pg.date());
const _badJson = () =>
  // @ts-expect-error invariant: json requires an object- or array-encoded schema
  String.pipe(pg.json());
export const _badArrayCarrier = () =>
  Array(Finite).pipe(
    // @ts-expect-error invariant: the outer array carrier must match its element declaration
    pg.array(String.pipe(pg.text()))
  );
export const _badArrayDepth = () =>
  Array(String).pipe(
    // @ts-expect-error invariant: declared dimensions must match the encoded array depth
    pg.array({ element: String.pipe(pg.text()), suffix: "[][]" })
  );
export const _badArrayThenPrimaryKey = () => {
  class BadArrayThenPrimaryKey extends Model<BadArrayThenPrimaryKey>("BadArrayThenPrimaryKey")({
    value: Array(String).pipe(
      pg.array(String.pipe(pg.text())),
      // @ts-expect-error invariant: array fields cannot be primary keys
      pg.primaryKey()
    ),
  }) {}
  return BadArrayThenPrimaryKey;
};
export const _badPrimaryKeyThenArray = () => {
  class BadPrimaryKeyThenArray extends Model<BadPrimaryKeyThenArray>("BadPrimaryKeyThenArray")({
    value: Array(String).pipe(
      pg.primaryKey(),
      // @ts-expect-error invariant: primary-key fields cannot become arrays
      pg.array(String.pipe(pg.text()))
    ),
  }) {}
  return BadPrimaryKeyThenArray;
};
export const _badArrayThenIdentity = () => {
  class BadArrayThenIdentity extends Model<BadArrayThenIdentity>("BadArrayThenIdentity")({
    value: Array(Int).pipe(
      pg.array(Int.pipe(pg.integer())),
      // @ts-expect-error invariant: array fields cannot use identity generation
      pg.identity()
    ),
  }) {}
  return BadArrayThenIdentity;
};
export const _badIdentityThenArray = () => {
  class BadIdentityThenArray extends Model<BadIdentityThenArray>("BadIdentityThenArray")({
    value: Int.pipe(
      pg.integer(),
      pg.identity(),
      // @ts-expect-error invariant: identity fields cannot become arrays
      pg.array(Int.pipe(pg.integer()))
    ),
  }) {}
  return BadIdentityThenArray;
};
export const _badArrayThenVersion = () => {
  class BadArrayThenVersion extends Model<BadArrayThenVersion>("BadArrayThenVersion")({
    value: Array(Int).pipe(
      pg.array(Int.pipe(pg.integer())),
      // @ts-expect-error invariant: array fields cannot be optimistic versions
      pg.version()
    ),
  }) {}
  return BadArrayThenVersion;
};
export const _badVersionThenArray = () => {
  class BadVersionThenArray extends Model<BadVersionThenArray>("BadVersionThenArray")({
    value: Int.pipe(
      pg.integer(),
      pg.version(),
      // @ts-expect-error invariant: version fields cannot become arrays
      pg.array(Int.pipe(pg.integer()))
    ),
  }) {}
  return BadVersionThenArray;
};
export const _badVersionColumn = () => {
  class BadVersionColumn extends Model<BadVersionColumn>("BadVersionColumn")({
    value: String.pipe(
      pg.text(),
      // @ts-expect-error invariant: optimistic versions require integer-family columns
      pg.version()
    ),
  }) {}
  return BadVersionColumn;
};
export const _badVersionThenIdentity = () => {
  class BadVersionThenIdentity extends Model<BadVersionThenIdentity>("BadVersionThenIdentity")({
    value: Int.pipe(
      pg.integer(),
      pg.version(),
      // @ts-expect-error invariant: version fields cannot use identity generation
      pg.identity()
    ),
  }) {}
  return BadVersionThenIdentity;
};
export const _badIdentityThenVersion = () => {
  class BadIdentityThenVersion extends Model<BadIdentityThenVersion>("BadIdentityThenVersion")({
    value: Int.pipe(
      pg.integer(),
      pg.identity(),
      // @ts-expect-error invariant: identity-generated fields cannot be versions
      pg.version()
    ),
  }) {}
  return BadIdentityThenVersion;
};
export const _badVersionThenGenerated = () => {
  class BadVersionThenGenerated extends Model<BadVersionThenGenerated>("BadVersionThenGenerated")({
    value: Int.pipe(
      pg.integer(),
      pg.version(),
      // @ts-expect-error invariant: version fields cannot be generated
      pg.unsafeGeneratedSql("1")
    ),
  }) {}
  return BadVersionThenGenerated;
};
export const _badGeneratedThenVersion = () => {
  class BadGeneratedThenVersion extends Model<BadGeneratedThenVersion>("BadGeneratedThenVersion")({
    value: Int.pipe(
      pg.integer(),
      pg.unsafeGeneratedSql("1"),
      // @ts-expect-error invariant: generated fields cannot be versions
      pg.version()
    ),
  }) {}
  return BadGeneratedThenVersion;
};

export const _badBigintVersion = () =>
  BigInt.pipe(
    pg.bigint("bigint"),
    // @ts-expect-error invariant: optimistic versions require number-encoded integer columns
    pg.version()
  );

export const _badVariantVersion = () =>
  VariantField({ select: Int, update: Int }).pipe(
    pg.integer(),
    // @ts-expect-error invariant: optimistic versions cannot override explicit variant membership
    pg.version()
  );
export const _charWithoutMaxLength = () => String.pipe(pg.char());
export const _charWithMaximumOnly = () => String.check(isMaxLength(4)).pipe(pg.char());
export const _charWithWrongExactLength = () => String.check(isLengthBetween(3, 3)).pipe(pg.char(4));

export const _badExtrasCallback = () => {
  class BadExtrasCallback extends Model<BadExtrasCallback>("BadExtrasCallback")(
    { value: String },
    // @ts-expect-error invariant: extras callbacks must return valid PostgreSQL extra nodes
    () => [{ _tag: "index", name: "", columns: [] }]
  ) {}
  return toPgTable(BadExtrasCallback);
};

export const _kitDefaultCollision = () => {
  class KitDefaultCollision extends auditKit.Entity<KitDefaultCollision>("KitDefaultCollision")({
    // @ts-expect-error invariant: kit default columns cannot be overridden
    createdAt: String.pipe(pg.timestamp()),
  }) {}
  return KitDefaultCollision;
};

export const _needsExplicitColumn = () => {
  class NeedsExplicitColumn extends Model<NeedsExplicitColumn>("NeedsExplicitColumn")({
    // @ts-expect-error invariant: Date declarations require explicit pg.timestamp metadata
    at: DateSchema,
  }) {}
  return NeedsExplicitColumn;
};

export const _declarationNeedsExplicitColumn = () => {
  class DeclarationNeedsExplicitColumn extends Model<DeclarationNeedsExplicitColumn>("DeclarationNeedsExplicitColumn")({
    // @ts-expect-error invariant: declaration-backed objects do not derive JSON storage
    value: instanceOf(RegExp),
  }) {}
  return DeclarationNeedsExplicitColumn;
};

export const _mixedExactCharWidths = () =>
  Union([String.check(isLengthBetween(2, 2)), String.check(isLengthBetween(3, 3))]).pipe(pg.char());

export const _mixedExactCharWidthsModelMirror = _mixedExactCharWidths;

class NamedRepositoryModel extends Model<NamedRepositoryModel>("NamedRepositoryModel")({
  id: Int.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
  displayName: String.pipe(pg.columnName("legacy_name")),
  rowVersion: Int.pipe(pg.integer(), pg.default(1), pg.version()),
}) {}

export const _repositoryVersionLocator = () => ({
  repository: makeRepository(User, {
    spanPrefix: "UserVersionLocator",
    // @ts-expect-error invariant: optimistic version fields cannot locate repository rows
    idColumn: "rowVersion",
  }),
});

export const _repositoryNonUniqueLocator = () => ({
  repository: makeRepository(User, {
    spanPrefix: "UserNonUniqueLocator",
    // @ts-expect-error invariant: repository locators must be primary-key or unique fields
    idColumn: "name",
  }),
});

class NullableUniqueRepositoryModel extends Model<NullableUniqueRepositoryModel>("NullableUniqueRepositoryModel")({
  email: NullOr(String).pipe(pg.text(), pg.unique()),
  rowVersion: Int.pipe(pg.integer(), pg.default(1), pg.version()),
}) {}

class UniqueIndexRepositoryModel extends Model<UniqueIndexRepositoryModel>("UniqueIndexRepositoryModel")({
  email: String.pipe(pg.text(), pg.uniqueIndex()),
  rowVersion: Int.pipe(pg.integer(), pg.default(1), pg.version()),
}) {}

export const _repositoryUniqueIndexLocator = () => ({
  repository: makeRepository({ spanPrefix: "UniqueIndexRepositoryModel", idColumn: "email" })(
    UniqueIndexRepositoryModel
  ),
});

export const _repositoryNullableUniqueLocator = () => ({
  repository: makeRepository(NullableUniqueRepositoryModel, {
    spanPrefix: "NullableUniqueRepositoryModel",
    // @ts-expect-error invariant: nullable unique fields cannot locate repository rows
    idColumn: "email",
  }),
});

export const _repositoryColumnNameOverride = () => ({
  repository: makeRepository(
    // @ts-expect-error invariant: repositories reject models with physical column-name overrides
    NamedRepositoryModel,
    { spanPrefix: "NamedRepositoryModel", idColumn: "id" }
  ),
});

export const _twoPrimaryKeys = () => {
  // @ts-expect-error invariant: multiple inline primary keys require a composite table node instead
  class TwoPrimaryKeys extends Model<TwoPrimaryKeys>("TwoPrimaryKeys")({
    one: Finite.pipe(pg.integer(), pg.primaryKey()),
    two: Finite.pipe(pg.integer(), pg.primaryKey()),
  }) {}
  return TwoPrimaryKeys;
};

export const _twoVersions = () => {
  // @ts-expect-error invariant: a model may declare at most one optimistic-version field
  class TwoVersions extends Model<TwoVersions>("TwoVersions")({
    leftVersion: Int.pipe(pg.integer(), pg.default(1), pg.version()),
    rightVersion: Int.pipe(pg.integer(), pg.default(1), pg.version()),
  }) {}
  return TwoVersions;
};

export const _nullablePgVersion = () =>
  NullOr(Int).pipe(
    pg.integer(),
    // @ts-expect-error invariant: optimistic versions cannot be nullable
    pg.version()
  );

export const _nullablePgVersionModelMirror = _nullablePgVersion;

export const _nullablePrimaryKey = () => {
  class NullablePrimaryKey extends Model<NullablePrimaryKey>("NullablePrimaryKey")({
    // @ts-expect-error invariant: nullable schemas cannot be primary keys
    id: NullOr(Finite).pipe(pg.integer(), pg.primaryKey()),
  }) {}
  return NullablePrimaryKey;
};

export const _defaultThenGenerated = () => {
  class DefaultThenGenerated extends Model<DefaultThenGenerated>("DefaultThenGenerated")({
    value: String.pipe(
      pg.text(),
      pg.default("x"),
      // @ts-expect-error invariant: default and generated are mutually exclusive
      pg.unsafeGeneratedSql("lower(value)")
    ),
  }) {}
  return DefaultThenGenerated;
};

export const _generatedThenDefault = () => {
  class GeneratedThenDefault extends Model<GeneratedThenDefault>("GeneratedThenDefault")({
    value: String.pipe(
      pg.text(),
      pg.unsafeGeneratedSql("lower(value)"),
      // @ts-expect-error invariant: generated and default are mutually exclusive
      pg.default("x")
    ),
  }) {}
  return GeneratedThenDefault;
};

export const _incompatibleVarchar = () => {
  class IncompatibleVarchar extends Model<IncompatibleVarchar>("IncompatibleVarchar")({
    value: String.check(isMaxLength(500)).check(isMinLength(1)).pipe(pg.varchar(50)),
  }) {}
  return IncompatibleVarchar;
};

export const _compatibleVarchar = () => {
  class CompatibleVarchar extends Model<CompatibleVarchar>("CompatibleVarchar")({
    value: String.check(isMaxLength(50)).pipe(pg.varchar(50)),
  }) {}
  return CompatibleVarchar;
};

export const _unboundedVarchar = () => {
  class UnboundedVarchar extends Model<UnboundedVarchar>("UnboundedVarchar")({
    value: String.pipe(pg.varchar(50)),
  }) {}
  return UnboundedVarchar;
};

const TextTargetId = entityId(String, "text_target", "TextTarget");
class TextTarget extends Model<TextTarget>("TextTarget")({
  id: TextTargetId.pipe(pg.text(), pg.primaryKey()),
}) {}
class UuidSource extends Model<UuidSource>("UuidSource")({
  targetId: TextTargetId.pipe(pg.uuid(), pg.references(TextTargetId)),
}) {}

export const _uuidTextFkMismatch = () =>
  // @ts-expect-error invariant: uuid and text SQL identities are not interchangeable
  schema({ text_target: TextTarget, uuid_source: UuidSource });

class WrongEntitySource extends Model<WrongEntitySource>("WrongEntitySource")({
  userId: OrganizationId.pipe(pg.references(UserId)),
}) {}

export const _entityFkMismatch = () =>
  // @ts-expect-error invariant: different EntityId SQL domains are not interchangeable
  schema({
    user: User,
    organization: Organization,
    wrong_entity_source: WrongEntitySource,
  });

const MissingId = entityId(Finite, "missing_table", "Missing");
class MissingSource extends Model<MissingSource>("MissingSource")({
  missingId: MissingId,
}) {}

export const _missingTarget = () =>
  // @ts-expect-error invariant: every reference target must be present in EffectDrizzle.schema
  schema({ missing_source: MissingSource });

const MismatchStatusOne = Literals(["draft", "active"]).annotate({
  identifier: "@beep/effect-drizzle/test/MismatchStatusOne",
  description: "First declaration used to prove enum assembly mismatch errors.",
});
const MismatchStatusTwo = Literals(["draft", "disabled"]).annotate({
  identifier: "@beep/effect-drizzle/test/MismatchStatusTwo",
  description: "Conflicting declaration used to prove enum assembly mismatch errors.",
});
class EnumShapeOne extends Model<EnumShapeOne>("EnumShapeOne")({
  status: MismatchStatusOne.pipe(pg.enum("mismatch_status")),
}) {}
class EnumShapeTwo extends Model<EnumShapeTwo>("EnumShapeTwo")({
  status: MismatchStatusTwo.pipe(pg.enum("mismatch_status")),
}) {}

export const _enumValueMismatch = () => schema({ enum_shape_one: EnumShapeOne, enum_shape_two: EnumShapeTwo });

const ArrayTextId = entityId(Array(String), "array_text_target", "ArrayTextTarget");
class ArrayTextTarget extends Model<ArrayTextTarget>("ArrayTextTarget")({
  id: ArrayTextId.pipe(pg.array(String.pipe(pg.text())), pg.unique()),
}) {}
class ScalarArraySource extends Model<ScalarArraySource>("ScalarArraySource")({
  targetId: String.pipe(pg.text(), pg.references(ArrayTextId)),
}) {}

export const _scalarArrayFkMismatch = () =>
  // @ts-expect-error invariant: scalar and array SQL identities are incompatible
  schema({
    array_text_target: ArrayTextTarget,
    scalar_array_source: ScalarArraySource,
  });

const MatrixTextId = entityId(String.pipe(Array, Array), "matrix_text_target", "MatrixTextTarget");
class MatrixTextTarget extends Model<MatrixTextTarget>("MatrixTextTarget")({
  id: MatrixTextId.pipe(pg.array({ element: String.pipe(pg.text()), suffix: "[][]" }), pg.unique()),
}) {}
class ShallowArraySource extends Model<ShallowArraySource>("ShallowArraySource")({
  targetId: Array(String).pipe(pg.array(String.pipe(pg.text())), pg.references(MatrixTextId)),
}) {}

export const _arrayDepthFkMismatch = () =>
  // @ts-expect-error invariant: foreign-key array depths must match
  schema({
    matrix_text_target: MatrixTextTarget,
    shallow_array_source: ShallowArraySource,
  });

const NonUniqueTargetId = entityId(Finite, "non_unique_target", "NonUniqueTarget");
class NonUniqueTarget extends Model<NonUniqueTarget>("NonUniqueTarget")({
  id: Int.pipe(pg.integer()),
}) {}
class NonUniqueSource extends Model<NonUniqueSource>("NonUniqueSource")({
  targetId: Int.pipe(pg.integer(), pg.references(NonUniqueTargetId)),
}) {}

export const _nonUniqueForeignKey = () =>
  // @ts-expect-error invariant: foreign keys must target an inline primary-key or unique column
  schema({ non_unique_target: NonUniqueTarget, non_unique_source: NonUniqueSource });

class AlphaUser extends Model<AlphaUser>("alpha/User")({ value: String }) {}
class BetaUser extends Model<BetaUser>("beta/User")({ value: String }) {}
export const _duplicatePhysicalTableNames = () => schema({ alpha_user: AlphaUser, beta_user: BetaUser });

const ResolutionTargetId = entityId(Finite, "resolution_target", "ResolutionTarget");
class ResolutionTarget extends Model<ResolutionTarget>("ResolutionTarget")({
  id: Int.pipe(pg.integer(), pg.primaryKey()),
}) {}
class ResolutionDecoy extends Model<ResolutionDecoy>("ResolutionDecoy")({
  id: Int.pipe(pg.integer(), pg.primaryKey()),
}) {}
class ResolutionSource extends Model<ResolutionSource>("ResolutionSource")({
  targetId: Int.pipe(
    pg.integer(),
    pg.references({
      id: ResolutionTargetId,
      options: { name: "resolution_source_target_id_resolution_target_id_fkey" },
    })
  ),
}) {}

export const exactKeyResolutionSchema = schema({
  resolution_target: ResolutionDecoy,
  physical_target: ResolutionTarget,
  resolution_source: ResolutionSource,
});

export const uniquePhysicalResolutionSchema =
  // @ts-expect-error boundary: physical-name fallback is runtime-only until model statics preserve literals
  schema({ physical_target: ResolutionTarget, resolution_source: ResolutionSource });

export const _pgNulEnum = () => Literals(["safe", "nul\0value"]).pipe(pg.enum("nul_status"));

const CollisionTargetId = entityId(Finite.pipe(brand("CollisionTargetId")), "collision_target", "CollisionTarget");
class CollisionTarget extends Model<CollisionTarget>("CollisionTarget")({
  id: CollisionTargetId.pipe(pg.integer(), pg.primaryKey()),
  collisionSources: String.pipe(brand("CollisionValue")),
}) {}
class CollisionSource extends Model<CollisionSource>("CollisionSource")({
  targetId: CollisionTargetId,
}) {}

export const _reverseRelationCollision = () =>
  schema({
    collision_target: CollisionTarget,
    collision_source: CollisionSource,
  });

export const _pgEmptyColumnName = () => {
  const name: string = "";
  return String.pipe(pg.columnName(name));
};
export const _pgLongColumnName = () => {
  const name: string = "a".repeat(64);
  return String.pipe(pg.columnName(name));
};
export const _pgMultibyteColumnName = () => {
  const name: string = `a${"é".repeat(32)}`;
  return String.pipe(pg.columnName(name));
};
export const _pgLongEnumLabel = () =>
  Literals(["😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀", ""]).pipe(pg.enum("long_label_status"));
export const pgEmptyEnumLabel = Literals(["", "active"]).pipe(pg.enum("empty_label_status"));
const NameFixtureString = String.annotate({ identifier: "WaveDNameFixtureString" });

export const _pgPhysicalColumnCollision = () => {
  class PhysicalColumnCollision extends Model<PhysicalColumnCollision>("PhysicalColumnCollision")({
    userId: NameFixtureString,
    user_id: NameFixtureString,
  }) {}
  return PhysicalColumnCollision;
};
export const _pgCaseFoldColumnCollision = () => {
  const uppercase: string = "FOO";
  class CaseFoldColumnCollision extends Model<CaseFoldColumnCollision>("CaseFoldColumnCollision")({
    first: NameFixtureString.pipe(pg.columnName("foo")),
    second: NameFixtureString.pipe(pg.columnName(uppercase)),
  }) {}
  return CaseFoldColumnCollision;
};

export const _pgTruncationPrefixCollision = () => {
  const prefix = "a".repeat(63);
  const fake = (tableName: string) => ({ sql: { tableName, fields: {}, columns: {}, extras: undefined } });
  return schema({ first: fake(`${prefix}x`), second: fake(`${prefix}y`) });
};

export const _pgDuplicateIndexNamespace = () => {
  class FirstIndexOwner extends Model<FirstIndexOwner>("FirstIndexOwner")({ value: NameFixtureString }, (columns) => [
    Table.index("shared_namespace_idx", [columns.value]),
  ]) {}
  class SecondIndexOwner extends Model<SecondIndexOwner>("SecondIndexOwner")(
    { value: NameFixtureString },
    (columns) => [Table.index("shared_namespace_idx", [columns.value])]
  ) {}
  return schema({ first_index_owner: FirstIndexOwner, second_index_owner: SecondIndexOwner });
};

export const _pgDuplicateConstraintNamespace = () => {
  class FirstConstraintOwner extends Model<FirstConstraintOwner>("FirstConstraintOwner")(
    { value: NameFixtureString },
    (columns) => [Table.check("shared_namespace_check")(sql<boolean>`${columns.value} <> ''`)]
  ) {}
  class SecondConstraintOwner extends Model<SecondConstraintOwner>("SecondConstraintOwner")(
    { value: NameFixtureString },
    (columns) => [Table.check("shared_namespace_check")(sql<boolean>`${columns.value} <> ''`)]
  ) {}
  return schema({
    first_constraint_owner: FirstConstraintOwner,
    second_constraint_owner: SecondConstraintOwner,
  });
};

export const _pgTableEnumNamespaceCollision = () => {
  class Status extends Model<Status>("Status")({ value: NameFixtureString }) {}
  class StatusOwner extends Model<StatusOwner>("StatusOwner")({
    value: Literals(["active"]).pipe(pg.enum("status")),
  }) {}
  return schema({ status: Status, status_owner: StatusOwner });
};

const WaveEString = String.annotate({ identifier: "WaveEString" });

export const pgBoundedInteger = Int.pipe(pg.integer());
export const pgBoundedSmallint = Int.pipe(pg.smallint());
export const pgCheckedUuid = String.pipe(pg.uuid());
export const pgCheckedNumeric = String.pipe(pg.numeric());

export const _pgVarcharTooWide = () => WaveEString.pipe(pg.varchar(10_485_761));
export const _pgNumericPrecisionTooWide = () => WaveEString.pipe(pg.numeric(1_001));
export const _pgNumericScaleTooWide = () => WaveEString.pipe(pg.numeric({ precision: 10, scale: 1_001 }));

export const _pgInvalidFiniteDefault = () => {
  class InvalidFiniteDefault extends Model<InvalidFiniteDefault>("InvalidFiniteDefault")({
    value: Finite.pipe(pg.real(), pg.default(Number.POSITIVE_INFINITY)),
  }) {}
  return InvalidFiniteDefault;
};

export const pgFiniteFloat = Finite.pipe(pg.doublePrecision());

export const _pgStandaloneGeneratedNameTooLong = () => {
  class StandaloneGeneratedNameValidationTable extends Model<StandaloneGeneratedNameValidationTable>(
    "StandaloneGeneratedNameValidationTable"
  )({
    individuallyValidLongUniqueColumnName: String.pipe(pg.text(), pg.unique()),
  }) {}
  return toPgTable(StandaloneGeneratedNameValidationTable);
};
export const _pgNulDefault = () => {
  class NulDefault extends Model<NulDefault>("NulDefault")({
    value: WaveEString.pipe(pg.text(), pg.default("bad\0value")),
  }) {}
  return NulDefault;
};
export const _pgByteaDefault = () => {
  class ByteaDefault extends Model<ByteaDefault>("ByteaDefault")({
    value: Uint8ArraySchema.pipe(pg.bytea(), pg.default(new Uint8Array([0, 39, 255]))),
  }) {}
  return ByteaDefault;
};

export const _pgParameterizedDefault = () => {
  class ParameterizedDefault extends Model<ParameterizedDefault>("ParameterizedDefault")({
    value: WaveEString.pipe(pg.defaultExpr(sql<string>`${"active"}`)),
  }) {}
  return toPgTable(ParameterizedDefault);
};
export const _pgParameterizedGenerated = () => {
  class ParameterizedGenerated extends Model<ParameterizedGenerated>("ParameterizedGenerated")({
    value: WaveEString.pipe(pg.generated(sql<string>`${"active"}`)),
  }) {}
  return toPgTable(ParameterizedGenerated);
};
export const _pgParameterizedCheck = () => {
  class ParameterizedCheck extends Model<ParameterizedCheck>("ParameterizedCheck")({ value: WaveEString }, () => [
    Table.check("parameterized_check")(sql<boolean>`${1} > 0`),
  ]) {}
  return ParameterizedCheck.pipe(toPgTable, getPgTableConfig);
};
export const _pgParameterizedPartialIndex = () => {
  class ParameterizedPartialIndex extends Model<ParameterizedPartialIndex>("ParameterizedPartialIndex")(
    { value: WaveEString },
    (columns) => [
      Table.index("parameterized_partial_idx", [columns.value], {
        where: sql<boolean>`${1} > 0`,
      }),
    ]
  ) {}
  return ParameterizedPartialIndex.pipe(toPgTable, getPgTableConfig);
};

export const _pgDuplicateCompositeRuntime = () => {
  class DuplicateComposite extends Model<DuplicateComposite>("DuplicateComposite")(
    { one: Int, two: Int },
    (columns) => [
      // @ts-expect-error invariant: runtime mirror survives type suppression
      Table.compositeUnique("duplicate_composite", [columns.one, columns.one]),
    ]
  ) {}
  return DuplicateComposite.pipe(toPgTable, getPgTableConfig);
};
export const _pgNullableCompositePrimaryRuntime = () => {
  class NullableCompositePrimary extends Model<NullableCompositePrimary>("NullableCompositePrimary")(
    { one: NullOr(Int), two: Int },
    (columns) => [
      // @ts-expect-error invariant: runtime mirror survives type suppression
      Table.compositePrimaryKey("nullable_composite_pk", [columns.one, columns.two]),
    ]
  ) {}
  return NullableCompositePrimary.pipe(toPgTable, getPgTableConfig);
};
export const _pgMultiplePrimaryKeys = () => {
  class MultiplePrimaryKeys extends Model<MultiplePrimaryKeys>("MultiplePrimaryKeys")(
    { id: Int.pipe(pg.integer(), pg.primaryKey()), one: Int, two: Int },
    (columns) => [Table.compositePrimaryKey("second_pk", [columns.one, columns.two])]
  ) {}
  return MultiplePrimaryKeys.pipe(toPgTable, getPgTableConfig);
};
export const _pgDuplicateExtrasNames = () => {
  class DuplicateExtrasNames extends Model<DuplicateExtrasNames>("DuplicateExtrasNames")(
    { one: Int, two: Int },
    (columns) => [
      Table.compositeUnique("same_extra", [columns.one, columns.two]),
      Table.check("same_extra")(sql<boolean>`true`),
    ]
  ) {}
  return DuplicateExtrasNames.pipe(toPgTable, getPgTableConfig);
};
export const _pgSetNullNonNullable = () => {
  class SetNullSource extends Model<SetNullSource>("SetNullSource")({
    targetId: OrganizationId.pipe(
      pg.integer(),
      // @ts-expect-error invariant: SET NULL requires nullable encoded source
      pg.references({ id: OrganizationId, options: { onDelete: "set null" } })
    ),
  }) {}
  // @ts-expect-error invariant: runtime schema assembly mirrors SET NULL validation
  return schema({ organization: Organization, set_null_source: SetNullSource });
};
export const _pgSetDefaultWithoutDefault = () => {
  class SetDefaultSource extends Model<SetDefaultSource>("SetDefaultSource")({
    targetId: OrganizationId.pipe(
      pg.integer(),
      // @ts-expect-error invariant: SET DEFAULT requires a declared database default
      pg.references({ id: OrganizationId, options: { onDelete: "set default" } })
    ),
  }) {}
  // @ts-expect-error invariant: runtime schema assembly mirrors SET DEFAULT validation
  return schema({ organization: Organization, set_default_source: SetDefaultSource });
};

export const _pgEmptyModel = () => {
  class EmptyModel extends Model<EmptyModel>("EmptyModel")({}) {}
  return EmptyModel;
};
export const _pgTooManyColumns = () => {
  const fields: Record<string, typeof WaveEString> = Object.fromEntries(
    globalThis.Array.from({ length: 1_601 }, (_, index) => [`field_${index}`, WaveEString])
  );
  // @ts-expect-error invariant: dynamic widened keys defer to the runtime model validator
  class TooManyColumns extends Model<TooManyColumns>("TooManyColumns")(fields) {}
  return TooManyColumns;
};
export const _pgTooManyIndexColumns = () => {
  const fields: Record<string, typeof WaveEString> = Object.fromEntries(
    globalThis.Array.from({ length: 33 }, (_, index) => [`field_${index}`, WaveEString])
  );
  class TooManyIndexColumns extends Model<TooManyIndexColumns>("TooManyIndexColumns")(
    // @ts-expect-error invariant: dynamic widened keys defer to the runtime model validator
    fields,
    (columns) => {
      const values = Object.values(columns);
      return [Table.index("too_many_index_columns", [getOrThrow(head(values)), ...values.slice(1)])];
    }
  ) {}
  return TooManyIndexColumns.pipe(toPgTable, getPgTableConfig);
};
