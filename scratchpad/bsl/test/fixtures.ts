/** Compile-time and runtime consumer fixtures. */
import { sql } from "drizzle-orm";
import { Service } from "effect/Context";
import { succeed } from "effect/Effect";
import type { Effect, Success } from "effect/Effect";
import {
  Array,
  BigInt,
  Boolean,
  Date as DateSchema,
  Finite,
  Int,
  Literals,
  NullOr,
  OptionFromNullOr,
  String,
  Struct,
  brand,
  decodeTo,
  isGreaterThan,
  isMaxLength,
  isMinLength,
} from "effect/Schema";
import type { Top } from "effect/Schema";
import { transformOrFail } from "effect/SchemaGetter";
import { Model as EffectModel } from "effect/unstable/schema";
import { SqlModel } from "effect/unstable/sql";
import { make, makeRepository, Model, VariantField } from "../src/index.ts";
import * as Field from "../src/core/Field.ts";
import * as Meta from "../src/core/Meta.ts";
import * as PgColumn from "../src/pg/Column.ts";
import * as pg from "../src/pg/index.ts";
import { schema, Table, toPgTable } from "../src/pg/index.ts";

const PosInt = Int.check(
  isGreaterThan(0, {
    identifier: "PosIntPositiveCheck",
    title: "Positive Integer",
    description: "Checks that a row version is a positive integer.",
    message: "Expected a positive integer.",
  }),
).annotate({
  identifier: "@beep/effect-drizzle/test/PosInt",
  description: "Positive integer used by kit row-version defaults.",
});

export const RecordStatus = Literals(["draft", "active"]).annotate({
  identifier: "@beep/effect-drizzle/test/RecordStatus",
  description: "Lifecycle status stored in the shared record_status enum.",
});
export const RecordSource = Literals(["web", "api"]).annotate({
  identifier: "@beep/effect-drizzle/test/RecordSource",
  description: "Creation source stored in a field-derived PostgreSQL enum.",
});

export const auditKit = make({
  dialect: "pg",
  defaultColumns: (pg) => ({
    createdAt: EffectModel.DateTimeInsert.pipe(pg.timestamp()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(pg.timestamp()),
    rowVersion: PosInt.pipe(pg.integer(), pg.default(1), pg.version()),
  }),
  defaultExtras: (columns) => [
    Table.check(sql<boolean>`${columns.rowVersion} > 0`, "kit_row_version_positive"),
  ],
});

export class AuditedRecord extends auditKit.Entity<AuditedRecord>("AuditedRecord")(
  {
    name: String,
    status: RecordStatus.pipe(pg.enum("record_status")),
    source: RecordSource.pipe(pg.enum()),
    search: String.pipe(pg.unsafeCustom("tsvector")),
  },
  (columns) => [Table.check(sql<boolean>`${columns.name} <> ''`, "audited_record_name_non_empty")],
) {}

export class AuditedEvent extends auditKit.Entity<AuditedEvent>("AuditedEvent")({
  label: String,
  status: RecordStatus.pipe(pg.enum("record_status")),
}) {}

export class BareJunction extends auditKit.Model<BareJunction>("BareJunction")(
  {
    leftId: Int.pipe(pg.integer()),
    rightId: Int.pipe(pg.integer()),
  },
  (columns) => [Table.compositePrimaryKey("bare_junction_pk", [columns.leftId, columns.rightId])],
) {}

export class MechanicalColumns extends Model<MechanicalColumns>("MechanicalColumns")({
  amount: String.pipe(pg.numeric(10, 2)),
  calendarDate: String.pipe(pg.date()),
  objectDate: DateSchema.pipe(pg.date({ mode: "date" })),
  code: String.check(isMaxLength(4)).pipe(pg.char()),
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
  entityType: EntityType,
): Sch & { readonly tableName: TableName; readonly entityType: EntityType } =>
  attachStatics(id, { tableName, entityType });

function attachStatics<Self extends object, Statics extends object>(
  self: Self,
  statics: Statics,
): Self & Statics;
function attachStatics(self: object, statics: object): object {
  return Object.assign(self, statics);
}

export const UserId = entityId(Finite.pipe(brand("UserId")), "user", "User");
export const OrganizationId = entityId(
  Finite.pipe(brand("OrganizationId")),
  "organization",
  "Organization",
);
export const NullableOrganizationId = entityId(
  NullOr(Finite.pipe(brand("OrganizationId"))),
  "organization",
  "Organization",
);

export class Organization extends Model<Organization>("Organization")(
  {
    id: OrganizationId.pipe(pg.integer(), pg.identity("byDefault"), pg.primaryKey()),
    parentOrgId: NullableOrganizationId.pipe(
      pg.references(OrganizationId, { onDelete: "set null" }),
    ),
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
  ],
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
  ],
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

// @effect-diagnostics deterministicKeys:off
class CodecService extends Service<
  CodecService,
  { readonly normalize: (value: string) => string }
>()("@beep/effect-drizzle/test/fixtures/CodecService") {}

const ServiceString = String.pipe(
  decodeTo(String, {
    decode: transformOrFail((value) =>
      CodecService.use((service) => succeed(service.normalize(value))),
    ),
    encode: transformOrFail((value) =>
      CodecService.use((service) => succeed(service.normalize(value))),
    ),
  }),
);

class ServiceCodecRecord extends Model<ServiceCodecRecord>("ServiceCodecRecord")({
  id: Int.pipe(pg.integer(), pg.identity("always"), pg.primaryKey()),
  value: ServiceString.pipe(pg.text()),
  rowVersion: PosInt.pipe(pg.integer(), pg.default(1), pg.version()),
}) {}

const serviceCodecRepository = makeRepository(ServiceCodecRecord, {
  spanPrefix: "ServiceCodecRecord",
  idColumn: "id",
});

export const _repositoryNeedsVersion = auditKit.Repository(
  // @ts-expect-error invariant: optimistic repositories require one version marker
  Organization,
  { spanPrefix: "Organization", idColumn: "id" },
);

export class Membership extends Model<Membership>("Membership")(
  {
    organizationId: OrganizationId,
    userId: UserId,
    role: String.pipe(pg.text(), pg.default("member")),
  },
  (t) => [Table.compositePrimaryKey("membership_pk", [t.organizationId, t.userId])],
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
    pg.array(String.pipe(pg.text()), "[][]"),
    pg.default([["seed"]]),
  ),
}) {}

export class EnumArrayRecord extends Model<EnumArrayRecord>("EnumArrayRecord")({
  statuses: Array(RecordStatus).pipe(pg.array(RecordStatus.pipe(pg.enum("record_status")))),
}) {}

export class ExplicitVariantModel extends Model<ExplicitVariantModel>("ExplicitVariantModel")({
  value: VariantField({
    select: String,
    insert: String,
    update: String,
  }).pipe(pg.text(), pg.generated(sql<string>`lower(value)`)),
}) {}

export const userTable = toPgTable(User);
export const effectDrizzleSchema = schema({
  user: User,
  organization: Organization,
  membership: Membership,
  array_record: ArrayRecord,
  enum_array_record: EnumArrayRecord,
});

export const dualOrgLinkSchema = schema({
  organization: Organization,
  dual_org_link: DualOrgLink,
});

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type MutualExtends<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
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
type ArraySelectRow = (typeof effectDrizzleSchema.tables.array_record)["$inferSelect"];
type ArrayInsertRow = (typeof effectDrizzleSchema.tables.array_record)["$inferInsert"];
type ServiceRepository = Success<typeof serviceCodecRepository>;
type ServiceInsert = ReturnType<ServiceRepository["insert"]>;
type ServiceInsertRequirements =
  ServiceInsert extends Effect<unknown, unknown, infer Requirements> ? Requirements : never;

export type _selectId = Expect<Equal<SelectRow["id"], number>>;
export type _selectEmail = Expect<Equal<SelectRow["email"], string>>;
export type _selectBio = Expect<Equal<SelectRow["bio"], string | null>>;
export type _selectSettings = Expect<
  MutualExtends<SelectRow["settings"], { readonly theme: string }>
>;
export type _selectActive = Expect<Equal<SelectRow["active"], boolean>>;
export type _insertIdAbsent = Expect<Equal<"id" extends keyof InsertRow ? true : false, false>>;
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
export type _variantUpdateIdRequired = Expect<Equal<IsOptional<UserUpdateVariant, "id">, false>>;
export type _variantDefaultOptional = Expect<IsOptional<UserInsertVariant, "status">>;
export type _variantCreatedAtRequired = Expect<
  Equal<IsOptional<UserInsertVariant, "createdAt">, false>
>;
export type _variantUpdateEmailOptional = Expect<IsOptional<UserUpdateVariant, "email">>;
export type _identityByDefaultInsertPresent = Expect<
  Equal<"id" extends keyof OrganizationInsertVariant ? true : false, true>
>;
export type _identityByDefaultInsertOptional = Expect<IsOptional<OrganizationInsertVariant, "id">>;
export type _identityByDefaultUpdatePresent = Expect<
  Equal<"id" extends keyof OrganizationUpdateVariant ? true : false, true>
>;
export type _identityByDefaultUpdateOptional = Expect<IsOptional<OrganizationUpdateVariant, "id">>;
export type _emailIsVarchar = Expect<
  Equal<(typeof User)["sql"]["columns"]["email"]["column"]["ident"], "varchar">
>;
export type _orgIdIdentity = Expect<
  Equal<(typeof User)["sql"]["columns"]["orgId"]["column"]["ident"], 'entityId<"organization">'>
>;
export type _userIdIdentity = Expect<
  Equal<(typeof User)["sql"]["columns"]["id"]["column"]["ident"], 'entityId<"user">'>
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
export type _kitSelectRowVersion = Expect<Equal<AuditedSelectVariant["rowVersion"], number>>;
export type _kitInsertUpdatedAtPresent = Expect<
  Equal<"updatedAt" extends keyof AuditedInsertVariant ? true : false, true>
>;
export type _kitUpdateUpdatedAtPresent = Expect<
  Equal<"updatedAt" extends keyof AuditedUpdateVariant ? true : false, true>
>;
export type _kitUpdateCreatedAtAbsent = Expect<
  Equal<"createdAt" extends keyof AuditedUpdateVariant ? true : false, false>
>;
export type _kitInsertRowVersionOptional = Expect<IsOptional<AuditedInsertVariant, "rowVersion">>;
export type _kitUpdateRowVersionRequired = Expect<
  Equal<IsOptional<AuditedUpdateVariant, "rowVersion">, false>
>;
export type _kitJsonRowVersionPresent = Expect<
  Equal<"rowVersion" extends keyof AuditedJsonVariant ? true : false, true>
>;
export type _bareModelOptsOutOfDefaults = Expect<
  Equal<"createdAt" extends keyof BareJunctionSelectVariant ? true : false, false>
>;
export type _literalEnumIdentity = Expect<
  Equal<
    (typeof AuditedRecord)["sql"]["columns"]["status"]["column"]["ident"],
    "enum<record_status>"
  >
>;
export type _derivedEnumIdentity = Expect<
  Equal<(typeof AuditedRecord)["sql"]["columns"]["source"]["column"]["ident"], "enum<source>">
>;
export type _numericSelectCarrier = Expect<Equal<MechanicalSelectRow["amount"], string>>;
export type _dateSelectCarrier = Expect<Equal<MechanicalSelectRow["objectDate"], Date>>;
export type _bigserialSelectCarrier = Expect<Equal<MechanicalSelectRow["nativeSequence"], bigint>>;
export type _bigserialInsertOptional = Expect<IsOptional<MechanicalInsertRow, "largeSequence">>;
export type _arraySelectLabels = Expect<
  ArraySelectRow["labels"] extends ReadonlyArray<string> ? true : false
>;
export type _arraySelectMatrix = Expect<
  ArraySelectRow["matrix"] extends ReadonlyArray<ReadonlyArray<string>> ? true : false
>;
export type _arrayInsertMatrixOptional = Expect<IsOptional<ArrayInsertRow, "matrix">>;
export type _repositoryCarriesCodecServices = Expect<
  CodecService extends ServiceInsertRequirements ? true : false
>;

// Negative matrix: each assertion names the rejected invariant.

// @ts-expect-error invariant: varchar requires a string-encoded schema
export const _badVarchar = () => Finite.pipe(pg.varchar(80));
// @ts-expect-error invariant: text requires a string-encoded schema
export const _badText = Finite.pipe(pg.text());
// @ts-expect-error invariant: uuid requires a string-encoded schema
export const _badUuid = Finite.pipe(pg.uuid());
// @ts-expect-error invariant: integer requires a number-encoded schema
export const _badInteger = String.pipe(pg.integer());
// @ts-expect-error invariant: smallint requires a number-encoded schema
export const _badSmallint = String.pipe(pg.smallint());
// @ts-expect-error invariant: doublePrecision requires a number-encoded schema
export const _badDouble = String.pipe(pg.doublePrecision());
// @ts-expect-error invariant: bigint bigint-mode requires a bigint-encoded schema
export const _badBigintBig = Finite.pipe(pg.bigint("bigint"));
// @ts-expect-error invariant: bigint number-mode requires a number-encoded schema
export const _badBigintNumber = BigInt.pipe(pg.bigint("number"));
// @ts-expect-error invariant: serial requires a number-encoded schema
export const _badSerial = String.pipe(pg.serial());
// @ts-expect-error invariant: boolean requires a boolean-encoded schema
export const _badBoolean = String.pipe(pg.boolean());
// @ts-expect-error invariant: jsonb requires an object- or array-encoded schema
export const _badJsonb = Boolean.pipe(pg.jsonb());
// @ts-expect-error invariant: bytea requires a Uint8Array-encoded schema
export const _badBytea = String.pipe(pg.bytea());
// @ts-expect-error invariant: timestamp string mode requires a string-encoded schema
export const _badTimestampString = Finite.pipe(pg.timestamp());
// @ts-expect-error invariant: timestamp date mode requires a Date-encoded schema
export const _badTimestampDate = String.pipe(pg.timestamp({ mode: "date" }));
// @ts-expect-error invariant: defaultNow requires an explicit timestamp column
export const _badDefaultNow = String.pipe(pg.text(), pg.defaultNow());
// @ts-expect-error invariant: a default value must match the encoded carrier
export const _badDefaultValue = String.pipe(pg.text(), pg.default(1));
export const _badDefaultExpr = String.pipe(
  pg.text(),
  // @ts-expect-error invariant: a typed default expression carrier must match the field
  pg.defaultExpr(sql<number>`1`),
);
export const _badGeneratedExpr = String.pipe(
  pg.text(),
  // @ts-expect-error invariant: a generated expression carrier must match the field
  pg.generated(sql<number>`1`),
);
// @ts-expect-error invariant: identity requires an explicit integer-family column
export const _badIdentityMissingColumn = Finite.pipe(pg.identity());
// @ts-expect-error invariant: identity rejects non-integer column families
export const _badIdentityText = String.pipe(pg.text(), pg.identity());
export const _badNullablePk = NullOr(String).pipe(
  pg.text(),
  // @ts-expect-error invariant: nullable schemas cannot be primary keys
  pg.primaryKey(),
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
  String.pipe(pg.enum("bad_status"));
export const _badNumeric = () =>
  // @ts-expect-error invariant: numeric requires a string-encoded schema
  Finite.pipe(pg.numeric());
export const _badDateString = () =>
  // @ts-expect-error invariant: string date mode requires a string-encoded schema
  DateSchema.pipe(pg.date());
export const _badDateObject = () =>
  // @ts-expect-error invariant: Date mode requires a Date-encoded schema
  String.pipe(pg.date({ mode: "date" }));
export const _badChar = () =>
  // @ts-expect-error invariant: char requires a string-encoded schema
  Finite.pipe(pg.char(2));
export const _badJson = () =>
  // @ts-expect-error invariant: json requires an object- or array-encoded schema
  String.pipe(pg.json());
export const _badReal = () =>
  // @ts-expect-error invariant: real requires a number-encoded schema
  String.pipe(pg.real());
export const _badBigserialNumber = () =>
  // @ts-expect-error invariant: number-mode bigserial requires a number schema
  BigInt.pipe(pg.bigserial("number"));
export const _badBigserialBigint = () =>
  // @ts-expect-error invariant: bigint-mode bigserial requires a bigint schema
  Int.pipe(pg.bigserial("bigint"));
export const _badSmallserial = () =>
  // @ts-expect-error invariant: smallserial requires a number-encoded schema
  String.pipe(pg.smallserial());
export const _badArrayCarrier = () =>
  Array(Finite).pipe(
    // @ts-expect-error invariant: the outer array carrier must match its element declaration
    pg.array(String.pipe(pg.text())),
  );
export const _badArrayDepth = () =>
  Array(String).pipe(
    // @ts-expect-error invariant: declared dimensions must match the encoded array depth
    pg.array(String.pipe(pg.text()), "[][]"),
  );
export const _badArrayBareElement = () =>
  Array(String).pipe(
    // @ts-expect-error invariant: array elements require an explicit base column combinator
    pg.array(String),
  );
export const _badArrayThenPrimaryKey = () => {
  class BadArrayThenPrimaryKey extends Model<BadArrayThenPrimaryKey>("BadArrayThenPrimaryKey")({
    value: Array(String).pipe(
      pg.array(String.pipe(pg.text())),
      // @ts-expect-error invariant: array fields cannot be primary keys
      pg.primaryKey(),
    ),
  }) {}
  return BadArrayThenPrimaryKey;
};
export const _badPrimaryKeyThenArray = () => {
  class BadPrimaryKeyThenArray extends Model<BadPrimaryKeyThenArray>("BadPrimaryKeyThenArray")({
    value: Array(String).pipe(
      pg.primaryKey(),
      // @ts-expect-error invariant: primary-key fields cannot become arrays
      pg.array(String.pipe(pg.text())),
    ),
  }) {}
  return BadPrimaryKeyThenArray;
};
export const _badArrayThenIdentity = () => {
  class BadArrayThenIdentity extends Model<BadArrayThenIdentity>("BadArrayThenIdentity")({
    value: Array(Int).pipe(
      pg.array(Int.pipe(pg.integer())),
      // @ts-expect-error invariant: array fields cannot use identity generation
      pg.identity(),
    ),
  }) {}
  return BadArrayThenIdentity;
};
export const _badIdentityThenArray = () => {
  class BadIdentityThenArray extends Model<BadIdentityThenArray>("BadIdentityThenArray")({
    value: Field.patch(Array(Int), {
      column: PgColumn.Integer.make({ ident: "integer" }),
    }).pipe(
      pg.identity(),
      // @ts-expect-error invariant: identity fields cannot become arrays
      pg.array(Int.pipe(pg.integer())),
    ),
  }) {}
  return BadIdentityThenArray;
};
export const _badArrayThenVersion = () => {
  class BadArrayThenVersion extends Model<BadArrayThenVersion>("BadArrayThenVersion")({
    value: Array(Int).pipe(
      pg.array(Int.pipe(pg.integer())),
      // @ts-expect-error invariant: array fields cannot be optimistic versions
      pg.version(),
    ),
  }) {}
  return BadArrayThenVersion;
};
export const _badVersionThenArray = () => {
  class BadVersionThenArray extends Model<BadVersionThenArray>("BadVersionThenArray")({
    value: Field.patch(Array(Int), {
      column: PgColumn.Integer.make({ ident: "integer" }),
    }).pipe(
      pg.version(),
      // @ts-expect-error invariant: version fields cannot become arrays
      pg.array(Int.pipe(pg.integer())),
    ),
  }) {}
  return BadVersionThenArray;
};
export const _badVersionColumn = () => {
  class BadVersionColumn extends Model<BadVersionColumn>("BadVersionColumn")({
    value: String.pipe(
      pg.text(),
      // @ts-expect-error invariant: optimistic versions require integer-family columns
      pg.version(),
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
      pg.identity(),
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
      pg.version(),
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
      pg.unsafeGeneratedSql("1"),
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
      pg.version(),
    ),
  }) {}
  return BadGeneratedThenVersion;
};
export const _charWithoutMaxLength = () => String.pipe(pg.char());

export const _badTimestampCorrelation = () =>
  PgColumn.Timestamp.make({
    // @ts-expect-error invariant: timestamp identity must agree with withTimezone
    ident: "timestamp",
    mode: "string",
    withTimezone: true,
  });

export const _badHandBuiltColumn = () => {
  const field = Field.make(
    String,
    Meta.merge(Meta.empty, {
      column: {
        _tag: "text",
        dialect: "pg",
        kind: "text",
        // @ts-expect-error invariant: hand-built column descriptors require string identities
        ident: 1,
      },
    }),
  );
  class BadHandBuiltColumn extends Model<BadHandBuiltColumn>("BadHandBuiltColumn")({
    // @ts-expect-error invariant: the hand-built field is deliberately outside the validated model domain
    value: field,
  }) {}
  return BadHandBuiltColumn;
};

export const _badHandBuiltReference = () => {
  const field = Field.make(
    String,
    Meta.merge(Meta.empty, {
      references: {
        tableName: "target",
        columnName: "id",
        // @ts-expect-error invariant: hand-built reference actions use the FkAction domain
        onDelete: "explode",
        onUpdate: undefined,
      },
    }),
  );
  class BadHandBuiltReference extends Model<BadHandBuiltReference>("BadHandBuiltReference")({
    // @ts-expect-error invariant: the hand-built field is deliberately outside the validated model domain
    value: field,
  }) {}
  return BadHandBuiltReference;
};

export const _badExtrasCallback = () => {
  class BadExtrasCallback extends Model<BadExtrasCallback>("BadExtrasCallback")(
    { value: String },
    // @ts-expect-error invariant: extras callbacks must return valid PostgreSQL extra nodes
    () => [{ _tag: "index", name: "", columns: [] }],
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

export class CallbackTyping extends Model<CallbackTyping>("CallbackTyping")(
  { one: String, two: String },
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
  ],
) {}

export const _needsExplicitColumn = () => {
  class NeedsExplicitColumn extends Model<NeedsExplicitColumn>("NeedsExplicitColumn")({
    // @ts-expect-error invariant: Date declarations require explicit pg.timestamp metadata
    at: DateSchema,
  }) {}
  return NeedsExplicitColumn;
};

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
      pg.unsafeGeneratedSql("lower(value)"),
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
      pg.default("x"),
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

export const _enumValueMismatch = () =>
  schema({ enum_shape_one: EnumShapeOne, enum_shape_two: EnumShapeTwo });

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
  id: MatrixTextId.pipe(pg.array(String.pipe(pg.text()), "[][]"), pg.unique()),
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

const CollisionTargetId = entityId(
  Finite.pipe(brand("CollisionTargetId")),
  "collision_target",
  "CollisionTarget",
);
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
