/** Compile-time and runtime fixtures for BSL round two. */
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { sql } from "drizzle-orm";
import * as S from "effect/Schema";
import { Model, VariantField } from "./factory.ts";
import * as pg from "./pg.ts";
import { schema } from "./schema.ts";
import * as Table from "./TableExtras.ts";
import { toPgTable } from "./table.ts";

const $I = $ScratchpadId.create("bsl/fixtures");

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

export class User extends Model<User>($I`User`)(
  {
    id: UserId.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
    orgId: OrganizationId,
    email: S.String.check(S.isMaxLength(320)).pipe(
      pg.varchar(320),
      pg.unique()
    ),
    name: S.String,
    bio: S.NullOr(S.String),
    settings: S.Struct({ theme: S.String }),
    active: S.Boolean,
    status: S.String.pipe(pg.text(), pg.default("active")),
    createdAt: S.String.pipe(pg.timestamp(), pg.defaultNow()),
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
type OrganizationInsertVariant = (typeof Organization.insert)["Type"];
type OrganizationUpdateVariant = (typeof Organization.update)["Type"];

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
export type _insertCreatedAtOptional = Expect<
  Equal<undefined extends InsertRow["createdAt"] ? true : false, true>
>;
export type _insertEmailRequired = Expect<Equal<InsertRow["email"], string>>;
export type _variantInsertIdAbsent = Expect<
  Equal<"id" extends keyof UserInsertVariant ? true : false, false>
>;
export type _variantUpdateIdAbsent = Expect<
  Equal<"id" extends keyof UserUpdateVariant ? true : false, false>
>;
export type _variantDefaultOptional = Expect<
  IsOptional<UserInsertVariant, "status">
>;
export type _variantCreatedAtOptional = Expect<
  IsOptional<UserInsertVariant, "createdAt">
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
// @ts-expect-error invariant: generated identity-always keys are absent from update
export type _badUpdateIdShape = UserUpdateVariant["id"];
// @ts-expect-error invariant: generated expression keys are absent from insert
export type _badInsertGeneratedShape = UserInsertVariant["searchName"];
// @ts-expect-error invariant: generated expression keys are absent from update
export type _badUpdateGeneratedShape = UserUpdateVariant["searchName"];

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
