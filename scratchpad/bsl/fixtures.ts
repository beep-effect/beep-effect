/** Compile-time and runtime fixtures for BSL round two. */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { sql } from "drizzle-orm";
import * as S from "effect/Schema";
import { Model as EffectModel } from "effect/unstable/schema";
import { SqlModel } from "effect/unstable/sql";
import { Model, VariantField } from "./factory.ts";
import { make } from "./kit.ts";
import * as pg from "./pg.ts";
import { schema } from "./schema.ts";
import * as Table from "./TableExtras.ts";
import { toPgTable } from "./table.ts";

const $I = $ScratchpadId.create("bsl/fixtures");

const PosInt = S.Int.check(
  S.isGreaterThan(0, {
    identifier: $I`PosIntPositiveCheck`,
    title: "Positive Integer",
    description: "Checks that a row version is a positive integer.",
    message: "Expected a positive integer.",
  })
).pipe(
  $I.annoteSchema("PosInt", {
    description: "Positive integer used by kit row-version defaults.",
  })
);

export const RecordStatus = LiteralKit(["draft", "active"]).pipe(
  $I.annoteSchema("RecordStatus", {
    description: "Lifecycle status stored in the shared record_status enum.",
  })
);
export const RecordSource = LiteralKit(["web", "api"]).pipe(
  $I.annoteSchema("RecordSource", {
    description: "Creation source stored in a field-derived PostgreSQL enum.",
  })
);

export const auditKit = make({
  dialect: "pg",
  defaultColumns: (pg) => ({
    createdAt: EffectModel.DateTimeInsert.pipe(pg.timestamp()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(pg.timestamp()),
    rowVersion: PosInt.pipe(pg.integer(), pg.default(1), pg.version()),
  }),
  defaultExtras: (columns) => [
    Table.check(
      sql<boolean>`${columns.rowVersion} > 0`,
      "kit_row_version_positive"
    ),
  ],
});

export class AuditedRecord extends auditKit.Entity<AuditedRecord>(
  $I`AuditedRecord`
)(
  {
    name: S.String,
    status: RecordStatus.pipe(pg.enum("record_status")),
    source: RecordSource.pipe(pg.enum()),
    search: S.String.pipe(pg.unsafeCustom("tsvector")),
  },
  (columns) => [
    Table.check(
      sql<boolean>`${columns.name} <> ''`,
      "audited_record_name_non_empty"
    ),
  ]
) {}

export class AuditedEvent extends auditKit.Entity<AuditedEvent>(
  $I`AuditedEvent`
)({
  label: S.String,
  status: RecordStatus.pipe(pg.enum("record_status")),
}) {}

export class BareJunction extends auditKit.Model<BareJunction>(
  $I`BareJunction`
)(
  {
    leftId: S.Int.pipe(pg.integer()),
    rightId: S.Int.pipe(pg.integer()),
  },
  (columns) => [
    Table.compositePrimaryKey("bare_junction_pk", [
      columns.leftId,
      columns.rightId,
    ]),
  ]
) {}

export class MechanicalColumns extends Model<MechanicalColumns>(
  $I`MechanicalColumns`
)({
  amount: S.String.pipe(pg.numeric(10, 2)),
  calendarDate: S.String.pipe(pg.date()),
  objectDate: S.Date.pipe(pg.date({ mode: "date" })),
  code: S.String.check(S.isMaxLength(4)).pipe(pg.char()),
  payload: S.Struct({ ok: S.Boolean }).pipe(pg.json()),
  score: S.Finite.pipe(pg.real()),
  largeSequence: S.Int.pipe(pg.bigserial("number")),
  nativeSequence: S.BigInt.pipe(pg.bigserial("bigint")),
  shortSequence: S.Int.pipe(pg.smallserial()),
}) {}

export const mechanicalTable = toPgTable(MechanicalColumns);

export const auditSchema = auditKit.schema({
  audited_record: AuditedRecord,
  audited_event: AuditedEvent,
  bare_junction: BareJunction,
});

const entityId = <
  const TableName extends string,
  const EntityType extends string,
  Sch extends S.Top
>(
  id: Sch,
  tableName: TableName,
  entityType: EntityType
) => id.pipe(SchemaUtils.withStatics(() => ({ tableName, entityType })));

export const UserId = entityId(
  S.Finite.pipe(S.brand("UserId")),
  "user",
  "User"
);
export const OrganizationId = entityId(
  S.Finite.pipe(S.brand("OrganizationId")),
  "organization",
  "Organization"
);
export const NullableOrganizationId = entityId(
  S.NullOr(S.Finite.pipe(S.brand("OrganizationId"))),
  "organization",
  "Organization"
);

export class Organization extends Model<Organization>($I`Organization`)(
  {
    id: OrganizationId.pipe(
      pg.integer(),
      pg.identity("byDefault"),
      pg.primaryKey()
    ),
    parentOrgId: NullableOrganizationId.pipe(
      pg.references(OrganizationId, { onDelete: "set null" })
    ),
    slug: S.String.check(S.isMaxLength(50)).pipe(pg.varchar(50)),
    name: S.String,
    code: S.String,
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

export class User extends auditKit.Entity<User>($I`User`)(
  {
    id: UserId.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
    orgId: OrganizationId,
    email: S.String.check(S.isMaxLength(320)).pipe(
      pg.varchar(320),
      pg.unique()
    ),
    name: S.String,
    bio: S.NullOr(S.String),
    nickname: S.OptionFromNullOr(S.String),
    settings: S.Struct({ theme: S.String }),
    active: S.Boolean,
    status: RecordStatus.pipe(pg.enum("record_status"), pg.default("active")),
    searchName: S.String.pipe(
      pg.text(),
      pg.generated(sql<string>`lower(name)`)
    ),
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
  tableName: User.bsl.tableName,
  spanPrefix: "User",
  idColumn: "id",
});

export const userOptimisticRepository = auditKit.Repository(User, {
  spanPrefix: "User",
  idColumn: "id",
});

export const _repositoryNeedsVersion = auditKit.Repository(
  // @ts-expect-error invariant: optimistic repositories require one version marker
  Organization,
  { spanPrefix: "Organization", idColumn: "id" }
);

export class Membership extends Model<Membership>($I`Membership`)(
  {
    organizationId: OrganizationId,
    userId: UserId,
    role: S.String.pipe(pg.text(), pg.default("member")),
  },
  (t) => [
    Table.compositePrimaryKey("membership_pk", [t.organizationId, t.userId]),
  ]
) {}

export class ExplicitVariantModel extends Model<ExplicitVariantModel>(
  $I`ExplicitVariantModel`
)({
  value: VariantField({
    select: S.String,
    insert: S.String,
    update: S.String,
  }).pipe(pg.text(), pg.generated(sql<string>`lower(value)`)),
}) {}

export const userTable = toPgTable(User);
export const bslSchema = schema({
  user: User,
  organization: Organization,
  membership: Membership,
});

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false;
type MutualExtends<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
type Expect<_T extends true> = never;
type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;

type SelectRow = typeof userTable.$inferSelect;
type InsertRow = typeof userTable.$inferInsert;
type UserInsertVariant = (typeof User.insert)["Type"];
type UserUpdateVariant = (typeof User.update)["Type"];
type UserJsonCreateVariant = (typeof User.jsonCreate)["Type"];
type OrganizationInsertVariant = (typeof Organization.insert)["Type"];
type OrganizationUpdateVariant = (typeof Organization.update)["Type"];
type AuditedSelectVariant = (typeof AuditedRecord)["Type"];
type AuditedInsertVariant = (typeof AuditedRecord.insert)["Type"];
type AuditedUpdateVariant = (typeof AuditedRecord.update)["Type"];
type AuditedJsonVariant = (typeof AuditedRecord.json)["Type"];
type BareJunctionSelectVariant = (typeof BareJunction)["Type"];
type MechanicalSelectRow = typeof mechanicalTable.$inferSelect;
type MechanicalInsertRow = typeof mechanicalTable.$inferInsert;

export type _selectId = Expect<Equal<SelectRow["id"], number>>;
export type _selectEmail = Expect<Equal<SelectRow["email"], string>>;
export type _selectBio = Expect<Equal<SelectRow["bio"], string | null>>;
export type _selectSettings = Expect<
  MutualExtends<SelectRow["settings"], { readonly theme: string }>
>;
export type _selectActive = Expect<Equal<SelectRow["active"], boolean>>;
export type _insertIdAbsent = Expect<
  Equal<"id" extends keyof InsertRow ? true : false, false>
>;
export type _insertCreatedAtRequired = Expect<
  Equal<undefined extends InsertRow["createdAt"] ? true : false, false>
>;
export type _insertEmailRequired = Expect<Equal<InsertRow["email"], string>>;
export type _variantInsertIdAbsent = Expect<
  Equal<"id" extends keyof UserInsertVariant ? true : false, false>
>;
export type _variantUpdateIdPresent = Expect<
  Equal<"id" extends keyof UserUpdateVariant ? true : false, true>
>;
export type _variantUpdateIdRequired = Expect<
  Equal<IsOptional<UserUpdateVariant, "id">, false>
>;
export type _variantDefaultOptional = Expect<
  IsOptional<UserInsertVariant, "status">
>;
export type _variantCreatedAtRequired = Expect<
  Equal<IsOptional<UserInsertVariant, "createdAt">, false>
>;
export type _variantUpdateEmailOptional = Expect<
  IsOptional<UserUpdateVariant, "email">
>;
export type _identityByDefaultInsertPresent = Expect<
  Equal<"id" extends keyof OrganizationInsertVariant ? true : false, true>
>;
export type _identityByDefaultInsertOptional = Expect<
  IsOptional<OrganizationInsertVariant, "id">
>;
export type _identityByDefaultUpdatePresent = Expect<
  Equal<"id" extends keyof OrganizationUpdateVariant ? true : false, true>
>;
export type _identityByDefaultUpdateOptional = Expect<
  IsOptional<OrganizationUpdateVariant, "id">
>;
export type _emailIsVarchar = Expect<
  Equal<(typeof User)["bsl"]["columns"]["email"]["column"]["ident"], "varchar">
>;
export type _orgIdIdentity = Expect<
  Equal<
    (typeof User)["bsl"]["columns"]["orgId"]["column"]["ident"],
    'entityId<"organization">'
  >
>;
export type _userIdIdentity = Expect<
  Equal<
    (typeof User)["bsl"]["columns"]["id"]["column"]["ident"],
    'entityId<"user">'
  >
>;
export type _generatedJsonCreateAbsent = Expect<
  Equal<"searchName" extends keyof UserJsonCreateVariant ? true : false, false>
>;
export type _kitSelectCreatedAt = Expect<
  MutualExtends<
    AuditedSelectVariant["createdAt"],
    (typeof EffectModel.DateTimeInsert.schemas.select)["Type"]
  >
>;
export type _kitSelectUpdatedAt = Expect<
  MutualExtends<
    AuditedSelectVariant["updatedAt"],
    (typeof EffectModel.DateTimeUpdate.schemas.select)["Type"]
  >
>;
export type _kitSelectRowVersion = Expect<
  Equal<AuditedSelectVariant["rowVersion"], number>
>;
export type _kitInsertUpdatedAtPresent = Expect<
  Equal<"updatedAt" extends keyof AuditedInsertVariant ? true : false, true>
>;
export type _kitUpdateUpdatedAtPresent = Expect<
  Equal<"updatedAt" extends keyof AuditedUpdateVariant ? true : false, true>
>;
export type _kitUpdateCreatedAtAbsent = Expect<
  Equal<"createdAt" extends keyof AuditedUpdateVariant ? true : false, false>
>;
export type _kitInsertRowVersionOptional = Expect<
  IsOptional<AuditedInsertVariant, "rowVersion">
>;
export type _kitUpdateRowVersionRequired = Expect<
  Equal<IsOptional<AuditedUpdateVariant, "rowVersion">, false>
>;
export type _kitJsonRowVersionPresent = Expect<
  Equal<"rowVersion" extends keyof AuditedJsonVariant ? true : false, true>
>;
export type _bareModelOptsOutOfDefaults = Expect<
  Equal<
    "createdAt" extends keyof BareJunctionSelectVariant ? true : false,
    false
  >
>;
export type _literalEnumIdentity = Expect<
  Equal<
    (typeof AuditedRecord)["bsl"]["columns"]["status"]["column"]["ident"],
    "enum<record_status>"
  >
>;
export type _derivedEnumIdentity = Expect<
  Equal<
    (typeof AuditedRecord)["bsl"]["columns"]["source"]["column"]["ident"],
    "enum<source>"
  >
>;
export type _numericSelectCarrier = Expect<
  Equal<MechanicalSelectRow["amount"], string>
>;
export type _dateSelectCarrier = Expect<
  Equal<MechanicalSelectRow["objectDate"], Date>
>;
export type _bigserialSelectCarrier = Expect<
  Equal<MechanicalSelectRow["nativeSequence"], bigint>
>;
export type _bigserialInsertOptional = Expect<
  IsOptional<MechanicalInsertRow, "largeSequence">
>;

// Negative matrix: each assertion names the rejected invariant.

// @ts-expect-error invariant: varchar requires a string-encoded schema
export const _badVarchar = () => S.Finite.pipe(pg.varchar(80));
// @ts-expect-error invariant: text requires a string-encoded schema
export const _badText = S.Finite.pipe(pg.text());
// @ts-expect-error invariant: uuid requires a string-encoded schema
export const _badUuid = S.Finite.pipe(pg.uuid());
// @ts-expect-error invariant: integer requires a number-encoded schema
export const _badInteger = S.String.pipe(pg.integer());
// @ts-expect-error invariant: smallint requires a number-encoded schema
export const _badSmallint = S.String.pipe(pg.smallint());
// @ts-expect-error invariant: doublePrecision requires a number-encoded schema
export const _badDouble = S.String.pipe(pg.doublePrecision());
// @ts-expect-error invariant: bigint bigint-mode requires a bigint-encoded schema
export const _badBigintBig = S.Finite.pipe(pg.bigint("bigint"));
// @ts-expect-error invariant: bigint number-mode requires a number-encoded schema
export const _badBigintNumber = S.BigInt.pipe(pg.bigint("number"));
// @ts-expect-error invariant: serial requires a number-encoded schema
export const _badSerial = S.String.pipe(pg.serial());
// @ts-expect-error invariant: boolean requires a boolean-encoded schema
export const _badBoolean = S.String.pipe(pg.boolean());
// @ts-expect-error invariant: jsonb requires an object- or array-encoded schema
export const _badJsonb = S.Boolean.pipe(pg.jsonb());
// @ts-expect-error invariant: bytea requires a Uint8Array-encoded schema
export const _badBytea = S.String.pipe(pg.bytea());
// @ts-expect-error invariant: timestamp string mode requires a string-encoded schema
export const _badTimestampString = S.Finite.pipe(pg.timestamp());
// @ts-expect-error invariant: timestamp date mode requires a Date-encoded schema
export const _badTimestampDate = S.String.pipe(pg.timestamp({ mode: "date" }));
// @ts-expect-error invariant: defaultNow requires an explicit timestamp column
export const _badDefaultNow = S.String.pipe(pg.text(), pg.defaultNow());
// @ts-expect-error invariant: a default value must match the encoded carrier
export const _badDefaultValue = S.String.pipe(pg.text(), pg.default(1));
export const _badDefaultExpr = S.String.pipe(
  pg.text(),
  // @ts-expect-error invariant: a typed default expression carrier must match the field
  pg.defaultExpr(sql<number>`1`)
);
export const _badGeneratedExpr = S.String.pipe(
  pg.text(),
  // @ts-expect-error invariant: a generated expression carrier must match the field
  pg.generated(sql<number>`1`)
);
// @ts-expect-error invariant: identity requires an explicit integer-family column
export const _badIdentityMissingColumn = S.Finite.pipe(pg.identity());
// @ts-expect-error invariant: identity rejects non-integer column families
export const _badIdentityText = S.String.pipe(pg.text(), pg.identity());
export const _badNullablePk = S.NullOr(S.String).pipe(
  pg.text(),
  // @ts-expect-error invariant: nullable schemas cannot be primary keys
  pg.primaryKey()
);
// @ts-expect-error invariant: generated identity-always keys are absent from insert
export type _badInsertIdShape = UserInsertVariant["id"];
// @ts-expect-error invariant: identity-always row locators are required in update
export const _badUpdateMissingId: UserUpdateVariant = {};
// @ts-expect-error invariant: generated expression keys are absent from insert
export type _badInsertGeneratedShape = UserInsertVariant["searchName"];
// @ts-expect-error invariant: generated expression keys are absent from update
export type _badUpdateGeneratedShape = UserUpdateVariant["searchName"];
// @ts-expect-error invariant: generated expression keys are absent from jsonCreate
export type _badJsonCreateGeneratedShape = UserJsonCreateVariant["searchName"];
export const _badEnumBroadString = () =>
  // @ts-expect-error invariant: pg.enum rejects broad string schemas
  S.String.pipe(pg.enum("bad_status"));
export const _badNumeric = () =>
  // @ts-expect-error invariant: numeric requires a string-encoded schema
  S.Finite.pipe(pg.numeric());
export const _badDateString = () =>
  // @ts-expect-error invariant: string date mode requires a string-encoded schema
  S.Date.pipe(pg.date());
export const _badDateObject = () =>
  // @ts-expect-error invariant: Date mode requires a Date-encoded schema
  S.String.pipe(pg.date({ mode: "date" }));
export const _badChar = () =>
  // @ts-expect-error invariant: char requires a string-encoded schema
  S.Finite.pipe(pg.char(2));
export const _badJson = () =>
  // @ts-expect-error invariant: json requires an object- or array-encoded schema
  S.String.pipe(pg.json());
export const _badReal = () =>
  // @ts-expect-error invariant: real requires a number-encoded schema
  S.String.pipe(pg.real());
export const _badBigserialNumber = () =>
  // @ts-expect-error invariant: number-mode bigserial requires a number schema
  S.BigInt.pipe(pg.bigserial("number"));
export const _badBigserialBigint = () =>
  // @ts-expect-error invariant: bigint-mode bigserial requires a bigint schema
  S.Int.pipe(pg.bigserial("bigint"));
export const _badSmallserial = () =>
  // @ts-expect-error invariant: smallserial requires a number-encoded schema
  S.String.pipe(pg.smallserial());
export const _badVersionColumn = () => {
  class BadVersionColumn extends Model<BadVersionColumn>(
    $I`BadVersionColumn`
  )({
    value: S.String.pipe(
      pg.text(),
      // @ts-expect-error invariant: optimistic versions require integer-family columns
      pg.version()
    ),
  }) {}
  return BadVersionColumn;
};
export const _badVersionThenIdentity = () => {
  class BadVersionThenIdentity extends Model<BadVersionThenIdentity>(
    $I`BadVersionThenIdentity`
  )({
    value: S.Int.pipe(
      pg.integer(),
      pg.version(),
      // @ts-expect-error invariant: version fields cannot use identity generation
      pg.identity()
    ),
  }) {}
  return BadVersionThenIdentity;
};
export const _badIdentityThenVersion = () => {
  class BadIdentityThenVersion extends Model<BadIdentityThenVersion>(
    $I`BadIdentityThenVersion`
  )({
    value: S.Int.pipe(
      pg.integer(),
      pg.identity(),
      // @ts-expect-error invariant: identity-generated fields cannot be versions
      pg.version()
    ),
  }) {}
  return BadIdentityThenVersion;
};
export const _badVersionThenGenerated = () => {
  class BadVersionThenGenerated extends Model<BadVersionThenGenerated>(
    $I`BadVersionThenGenerated`
  )({
    value: S.Int.pipe(
      pg.integer(),
      pg.version(),
      // @ts-expect-error invariant: version fields cannot be generated
      pg.unsafeGeneratedSql("1")
    ),
  }) {}
  return BadVersionThenGenerated;
};
export const _badGeneratedThenVersion = () => {
  class BadGeneratedThenVersion extends Model<BadGeneratedThenVersion>(
    $I`BadGeneratedThenVersion`
  )({
    value: S.Int.pipe(
      pg.integer(),
      pg.unsafeGeneratedSql("1"),
      // @ts-expect-error invariant: generated fields cannot be versions
      pg.version()
    ),
  }) {}
  return BadGeneratedThenVersion;
};
export const _charWithoutMaxLength = () => S.String.pipe(pg.char());

export const _kitDefaultCollision = () => {
  class KitDefaultCollision extends auditKit.Entity<KitDefaultCollision>(
    $I`KitDefaultCollision`
  )({
    // @ts-expect-error invariant: kit default columns cannot be overridden
    createdAt: S.String.pipe(pg.timestamp()),
  }) {}
  return KitDefaultCollision;
};

export class CallbackTyping extends Model<CallbackTyping>($I`CallbackTyping`)(
  { one: S.String, two: S.String },
  (t) => [
    Table.index("callback_good_idx", [t.one]),
    // @ts-expect-error invariant: extras callbacks expose only declared fields
    Table.index("callback_bad_idx", [t.missing]),
    // @ts-expect-error invariant: composite unique requires at least two columns
    Table.compositeUnique("callback_bad_unique", [t.one]),
    // @ts-expect-error invariant: composite primary key requires at least two columns
    Table.compositePrimaryKey("callback_bad_pk", [t.one]),
    // @ts-expect-error invariant: checks require typed SQL, never a bare string
    Table.check("callback_bad_check")("one <> ''"),
    // @ts-expect-error invariant: partial index predicates require typed SQL
    Table.index("callback_bad_where", [t.one], { where: "one <> ''" }),
  ]
) {}

export const _needsExplicitColumn = () => {
  class NeedsExplicitColumn extends Model<NeedsExplicitColumn>(
    $I`NeedsExplicitColumn`
  )({
    // @ts-expect-error invariant: Date declarations require explicit pg.timestamp metadata
    at: S.Date,
  }) {}
  return NeedsExplicitColumn;
};

export const _twoPrimaryKeys = () => {
  // @ts-expect-error invariant: multiple inline primary keys require a composite table node instead
  class TwoPrimaryKeys extends Model<TwoPrimaryKeys>($I`TwoPrimaryKeys`)({
    one: S.Finite.pipe(pg.integer(), pg.primaryKey()),
    two: S.Finite.pipe(pg.integer(), pg.primaryKey()),
  }) {}
  return TwoPrimaryKeys;
};

export const _twoVersions = () => {
  // @ts-expect-error invariant: a model may declare at most one optimistic-version field
  class TwoVersions extends Model<TwoVersions>($I`TwoVersions`)({
    leftVersion: S.Int.pipe(pg.integer(), pg.default(1), pg.version()),
    rightVersion: S.Int.pipe(pg.integer(), pg.default(1), pg.version()),
  }) {}
  return TwoVersions;
};

export const _nullablePrimaryKey = () => {
  class NullablePrimaryKey extends Model<NullablePrimaryKey>(
    $I`NullablePrimaryKey`
  )({
    // @ts-expect-error invariant: nullable schemas cannot be primary keys
    id: S.NullOr(S.Finite).pipe(pg.integer(), pg.primaryKey()),
  }) {}
  return NullablePrimaryKey;
};

export const _defaultThenGenerated = () => {
  class DefaultThenGenerated extends Model<DefaultThenGenerated>(
    $I`DefaultThenGenerated`
  )({
    value: S.String.pipe(
      pg.text(),
      pg.default("x"),
      // @ts-expect-error invariant: default and generated are mutually exclusive
      pg.unsafeGeneratedSql("lower(value)")
    ),
  }) {}
  return DefaultThenGenerated;
};

export const _generatedThenDefault = () => {
  class GeneratedThenDefault extends Model<GeneratedThenDefault>(
    $I`GeneratedThenDefault`
  )({
    value: S.String.pipe(
      pg.text(),
      pg.unsafeGeneratedSql("lower(value)"),
      // @ts-expect-error invariant: generated and default are mutually exclusive
      pg.default("x")
    ),
  }) {}
  return GeneratedThenDefault;
};

export const _incompatibleVarchar = () => {
  class IncompatibleVarchar extends Model<IncompatibleVarchar>(
    $I`IncompatibleVarchar`
  )({
    value: S.String.check(S.isMaxLength(500))
      .check(S.isMinLength(1))
      .pipe(pg.varchar(50)),
  }) {}
  return IncompatibleVarchar;
};

export const _compatibleVarchar = () => {
  class CompatibleVarchar extends Model<CompatibleVarchar>(
    $I`CompatibleVarchar`
  )({
    value: S.String.check(S.isMaxLength(50)).pipe(pg.varchar(50)),
  }) {}
  return CompatibleVarchar;
};

export const _unboundedVarchar = () => {
  class UnboundedVarchar extends Model<UnboundedVarchar>($I`UnboundedVarchar`)({
    value: S.String.pipe(pg.varchar(50)),
  }) {}
  return UnboundedVarchar;
};

const TextTargetId = entityId(S.String, "text_target", "TextTarget");
class TextTarget extends Model<TextTarget>($I`TextTarget`)({
  id: TextTargetId.pipe(pg.text(), pg.primaryKey()),
}) {}
class UuidSource extends Model<UuidSource>($I`UuidSource`)({
  targetId: TextTargetId.pipe(pg.uuid(), pg.references(TextTargetId)),
}) {}

export const _uuidTextFkMismatch = () =>
  // @ts-expect-error invariant: uuid and text SQL identities are not interchangeable
  schema({ text_target: TextTarget, uuid_source: UuidSource });

class WrongEntitySource extends Model<WrongEntitySource>($I`WrongEntitySource`)(
  {
    userId: OrganizationId.pipe(pg.references(UserId)),
  }
) {}

export const _entityFkMismatch = () =>
  // @ts-expect-error invariant: different EntityId SQL domains are not interchangeable
  schema({
    user: User,
    organization: Organization,
    wrong_entity_source: WrongEntitySource,
  });

const MissingId = entityId(S.Finite, "missing_table", "Missing");
class MissingSource extends Model<MissingSource>($I`MissingSource`)({
  missingId: MissingId,
}) {}

export const _missingTarget = () =>
  // @ts-expect-error invariant: every reference target must be present in Bsl.schema
  schema({ missing_source: MissingSource });

const MismatchStatusOne = LiteralKit(["draft", "active"]).pipe(
  $I.annoteSchema("MismatchStatusOne", {
    description:
      "First declaration used to prove enum assembly mismatch errors.",
  })
);
const MismatchStatusTwo = LiteralKit(["draft", "disabled"]).pipe(
  $I.annoteSchema("MismatchStatusTwo", {
    description:
      "Conflicting declaration used to prove enum assembly mismatch errors.",
  })
);
class EnumShapeOne extends Model<EnumShapeOne>($I`EnumShapeOne`)({
  status: MismatchStatusOne.pipe(pg.enum("mismatch_status")),
}) {}
class EnumShapeTwo extends Model<EnumShapeTwo>($I`EnumShapeTwo`)({
  status: MismatchStatusTwo.pipe(pg.enum("mismatch_status")),
}) {}

export const _enumValueMismatch = () =>
  schema({ enum_shape_one: EnumShapeOne, enum_shape_two: EnumShapeTwo });
