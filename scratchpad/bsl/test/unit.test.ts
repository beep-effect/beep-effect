/** Runtime proofs for @beep/effect-drizzle round three. */
import { describe, expect, it } from "bun:test";
import { defineRelations, getTableName } from "drizzle-orm";
import { getTableConfig, type PgColumn } from "drizzle-orm/pg-core";
import { catchTag, fail as failEffect, runSync, succeed } from "effect/Effect";
import { pipe } from "effect/Function";
import { String as StringOrder } from "effect/Order";
import { findFirst, head, sort } from "effect/Array";
import { equals } from "effect/Equal";
import {
  flatMap,
  fromUndefinedOr,
  getOrThrow,
  getOrThrowWith,
  getOrUndefined,
  isNone,
  none,
} from "effect/Option";
import { hasProperty } from "effect/Predicate";
import {
  Array as ArraySchema,
  Boolean as BooleanSchema,
  Date as DateSchema,
  Finite,
  FiniteFromString,
  NullOr,
  OptionFromNullOr,
  String as StringSchema,
  Struct as StructSchema,
  Union,
  Unknown as UnknownSchema,
  decodeUnknownSync,
  is,
  isLengthBetween,
  isMaxLength,
  isSchema,
  suspend,
} from "effect/Schema";
import { toEncoded } from "effect/SchemaAST";
import { makeEffect } from "effect/SchemaParser";
import { Model as EffectModel } from "effect/unstable/schema";
import * as Derive from "../src/pg/derive.ts";
import * as Field from "../src/core/Field.ts";
import * as PgColumnSchema from "../src/pg/Column.ts";
import * as pg from "../src/pg/index.ts";
import { Model, ModelInvariantError, VersionConflictError } from "../src/index.ts";
import {
  _arrayDepthFkMismatch,
  _badArrayCarrier,
  _badArrayDepth,
  _badArrayThenIdentity,
  _badArrayThenPrimaryKey,
  _badArrayThenVersion,
  _badBigintVersion,
  _badVariantVersion,
  _charWithMaximumOnly,
  _charWithWrongExactLength,
  _charWithoutExactRuntimeMirror,
  _compatibleVarchar,
  _defaultThenGenerated,
  _badEnumBroadString,
  _badGeneratedThenVersion,
  _badHandBuiltColumn,
  _badHandBuiltReference,
  _badIdentityThenVersion,
  _badVersionColumn,
  _badVersionThenGenerated,
  _badVersionThenIdentity,
  _badTimestampCorrelation,
  _charWithoutMaxLength,
  _badExtrasCallback,
  _entityFkMismatch,
  _enumValueMismatch,
  _generatedThenDefault,
  _incompatibleVarchar,
  _missingTarget,
  _nonUniqueForeignKey,
  _declarationNeedsExplicitColumn,
  _needsExplicitColumn,
  _nullablePrimaryKey,
  _reverseRelationCollision,
  _duplicatePhysicalTableNames,
  _pgCaseFoldColumnCollision,
  _pgDuplicateIndexNamespace,
  _pgDuplicateConstraintNamespace,
  _pgEmptyColumnName,
  _pgLongColumnName,
  _pgLongEnumLabel,
  _pgMultibyteColumnName,
  _pgNulEnum,
  _pgPhysicalColumnCollision,
  _pgTableEnumNamespaceCollision,
  _pgTruncationPrefixCollision,
  _pgByteaDefault,
  _pgDuplicateCompositeRuntime,
  _pgDuplicateExtrasNames,
  _pgEmptyModel,
  _pgInvalidFiniteDefault,
  _pgMultiplePrimaryKeys,
  _pgNulDefault,
  _pgNullableCompositePrimaryRuntime,
  _pgNumericPrecisionTooWide,
  _pgNumericScaleTooWide,
  _pgParameterizedCheck,
  _pgParameterizedDefault,
  _pgParameterizedGenerated,
  _pgParameterizedPartialIndex,
  _pgSetDefaultWithoutDefault,
  _pgSetNullNonNullable,
  _pgTooManyColumns,
  _pgTooManyIndexColumns,
  _pgVarcharTooWide,
  _repositoryColumnNameOverride,
  _repositoryNonUniqueLocator,
  _repositoryVersionLocator,
  _kitDefaultCollision,
  _badIdentityThenArray,
  _badPrimaryKeyThenArray,
  _badVersionThenArray,
  _scalarArrayFkMismatch,
  _twoPrimaryKeys,
  _twoVersions,
  _unboundedVarchar,
  _uuidTextFkMismatch,
  _runtimeArrayCarrierMismatch,
  _runtimeByteCarrierMismatch,
  _runtimeDateCarrierMismatch,
  _runtimeModeCarrierMismatch,
  _runtimeNumberCarrierMismatch,
  _runtimeObjectCarrierMismatch,
  _runtimeStringCarrierMismatch,
  auditSchema,
  ArrayRecord,
  AuditedRecord,
  effectDrizzleSchema,
  exactKeyResolutionSchema,
  dualOrgLinkSchema,
  ExplicitVariantModel,
  mechanicalTable,
  Organization,
  OrganizationId,
  pgEmptyEnumLabel,
  pgBoundedInteger,
  pgBoundedSmallint,
  pgCheckedNumeric,
  pgCheckedUuid,
  User,
  UserId,
  userTable,
  uniquePhysicalResolutionSchema,
} from "./fixtures.ts";

describe("PostgreSQL name invariants", () => {
  it("rejects empty, NUL, character-invalid, and over-63-byte names and labels", () => {
    expect(_pgEmptyColumnName).toThrow("must not be empty");
    expect(_pgLongColumnName).toThrow("63 UTF-8 bytes");
    expect(_pgMultibyteColumnName).toThrow("lowercase letters, digits, and underscores");
    expect(_pgNulEnum).toThrow("NUL (U+0000)");
    expect(_pgLongEnumLabel).toThrow("63 UTF-8 bytes");
    expect(pgEmptyEnumLabel.meta.column.values).toEqual(["", "active"]);
  });

  it("rejects snake-case, case-fold, truncation-prefix, and schema-global collisions", () => {
    expect(_pgPhysicalColumnCollision).toThrow("dialect normalization");
    expect(_pgCaseFoldColumnCollision).toThrow("dialect normalization");
    expect(_pgTruncationPrefixCollision).toThrow("dialect normalization");
    expect(_pgTruncationPrefixCollision).toThrow(pg.SchemaAssemblyError);
    expect(_pgDuplicateIndexNamespace).toThrow("Schema-global name");
    expect(_pgDuplicateIndexNamespace).toThrow(pg.SchemaAssemblyError);
    expect(_pgDuplicateConstraintNamespace).toThrow("Schema-global name");
    expect(_pgDuplicateConstraintNamespace).toThrow(pg.SchemaAssemblyError);
    expect(_pgTableEnumNamespaceCollision).toThrow("Schema-global name");
    expect(_pgTableEnumNamespaceCollision).toThrow(pg.SchemaAssemblyError);
  });
});

describe("PostgreSQL Wave E value and structure invariants", () => {
  it("injects closed scalar domains and multidimensional rectangularity", () => {
    expect(is(Field.from(pgBoundedInteger).schema)(2_147_483_648)).toBe(false);
    expect(is(Field.from(pgBoundedSmallint).schema)(32_768)).toBe(false);
    expect(is(Field.from(pgCheckedUuid).schema)("not-a-uuid")).toBe(false);
    expect(is(Field.from(pgCheckedNumeric).schema)("not-a-number")).toBe(false);
    expect(is(ArrayRecord.insert)({ labels: ["ok"], matrix: [["a"], ["b", "c"]] })).toBe(false);
  });

  it("rejects PostgreSQL type bounds and unsafe literal defaults", () => {
    expect(_pgVarcharTooWide).toThrow("10,485,760");
    expect(_pgNumericPrecisionTooWide).toThrow("1,000");
    expect(_pgNumericScaleTooWide).toThrow("1,000");
    expect(_pgInvalidFiniteDefault).toThrow("encoded schema");
    expect(_pgNulDefault).toThrow("NUL");
    expect(_pgByteaDefault).toThrow("unsafeDefaultSql");
  });

  it("structurally rejects parameters on every schema-expression surface", () => {
    expect(_pgParameterizedDefault).toThrow("bound parameters");
    expect(_pgParameterizedGenerated).toThrow("bound parameters");
    expect(_pgParameterizedCheck).toThrow("bound parameters");
    expect(_pgParameterizedPartialIndex).toThrow("bound parameters");
  });

  it("rejects invalid composite, primary-key, extras-name, and FK-action assembly", () => {
    expect(_pgDuplicateCompositeRuntime).toThrow("repeats a physical column");
    expect(_pgNullableCompositePrimaryRuntime).toThrow("nullable column");
    expect(_pgMultiplePrimaryKeys).toThrow("at most one primary key");
    expect(_pgDuplicateExtrasNames).toThrow("names must be unique");
    expect(_pgSetNullNonNullable).toThrow("SET NULL");
    expect(_pgSetDefaultWithoutDefault).toThrow("SET DEFAULT");
  });

  it("rejects empty and over-ceiling PostgreSQL structures", () => {
    expect(_pgEmptyModel).toThrow("1 through 1,600");
    expect(_pgTooManyColumns).toThrow("1 through 1,600");
    expect(_pgTooManyIndexColumns).toThrow("32-column index limit");
  });
});

const userConfig = getTableConfig(userTable);

const column = (name: string): PgColumn =>
  getOrThrowWith(
    findFirst(userConfig.columns, (candidate) => candidate.name === name),
    () => new Error(`column '${name}' missing`),
  );

const columnFrom = (columns: ReadonlyArray<PgColumn>, name: string): PgColumn =>
  getOrThrowWith(
    findFirst(columns, (candidate) => candidate.name === name),
    () => new Error(`column '${name}' missing`),
  );

const first = <A>(values: ReadonlyArray<A>, label: string): A =>
  getOrThrowWith(head(values), () => new Error(`${label} missing`));

describe("toPgTable", () => {
  it("projects names, nullability, identities, defaults, and generation", () => {
    expect(getTableName(userTable)).toBe("user");
    expect(
      sort(
        userConfig.columns.map((candidate) => candidate.name),
        StringOrder,
      ),
    ).toEqual(
      sort(
        [
          "active",
          "bio",
          "created_at",
          "email",
          "id",
          "name",
          "nickname",
          "org_id",
          "row_version",
          "search_name",
          "settings",
          "status",
          "updated_at",
        ],
        StringOrder,
      ),
    );
    expect(column("name").notNull).toBe(true);
    expect(column("bio").notNull).toBe(false);
    expect(column("id").primary).toBe(true);
    expect(fromUndefinedOr(column("id").generatedIdentity?.type).pipe(getOrUndefined)).toBe(
      "always",
    );
    expect(column("created_at").hasDefault).toBe(false);
    expect(column("status").default).toBe("active");
    expect(column("search_name").generated).toBeDefined();
  });

  it("maps every showcase kind to the installed pg builders", () => {
    expect(column("email").getSQLType()).toBe("varchar(320)");
    expect(column("settings").getSQLType()).toBe("jsonb");
    expect(column("active").getSQLType()).toBe("boolean");
    expect(column("id").getSQLType()).toBe("integer");
    expect(column("created_at").getSQLType()).toContain("timestamp");
  });

  it("emits table-level indexes, uniques, checks, and composite primary keys", () => {
    expect(userConfig.indexes).toHaveLength(1);
    const userIndex = first(userConfig.indexes, "user index");
    expect(userIndex.config.name).toBe("user_email_idx");
    expect(userIndex.config.method).toBe("btree");
    expect(userIndex.config.where).toBeDefined();
    expect(userConfig.uniqueConstraints.map((constraint) => constraint.name)).toContain(
      "user_org_email_unique",
    );
    expect(userConfig.checks.map((check) => check.name)).toContain("user_email_check");

    const membershipConfig = getTableConfig(effectDrizzleSchema.tables.membership);
    expect(membershipConfig.primaryKeys).toHaveLength(1);
    const membershipPrimaryKey = first(membershipConfig.primaryKeys, "membership primary key");
    expect(membershipPrimaryKey.name).toBe("membership_pk");
    expect(membershipPrimaryKey.columns.map((candidate) => candidate.name)).toEqual([
      "organization_id",
      "user_id",
    ]);
  });
});

describe("variant truth table", () => {
  it("keeps identity row locators in update and omits generated expressions", () => {
    expect(Object.keys(User.insert.fields)).not.toContain("id");
    expect(Object.keys(User.update.fields)).toContain("id");
    expect(Object.keys(User.insert.fields)).not.toContain("searchName");
    expect(Object.keys(User.update.fields)).not.toContain("searchName");
    const insert = runSync(
      makeEffect(User.insert)({
        orgId: OrganizationId.make(1),
        email: "a@example.com",
        name: "A",
        bio: null,
        nickname: none(),
        settings: { theme: "dark" },
        active: true,
        rowVersion: 1,
      }),
    );
    const update = runSync(
      makeEffect(User.update)({
        id: UserId.make(1),
        rowVersion: 1,
      }),
    );
    const { rowVersion: _rowVersion, ...withoutVersion } = update;
    expect(is(User.insert)(insert)).toBe(true);
    expect(is(User.update)(update)).toBe(true);
    expect(is(User.update)(withoutVersion)).toBe(false);
    expect(is(User.update)({})).toBe(false);
    expect(Object.keys(User.jsonCreate.fields)).not.toContain("searchName");
  });

  it("keeps identity-by-default present in update and optional in insert", () => {
    expect(Object.keys(Organization.insert.fields)).toContain("id");
    expect(Object.keys(Organization.update.fields)).toContain("id");
    expect(
      is(Organization.insert)({
        parentOrgId: null,
        slug: "root",
        name: "Root",
        code: "ROOT",
      }),
    ).toBe(true);
    const organizationConfig = getTableConfig(effectDrizzleSchema.tables.organization);
    expect(
      flatMap(
        findFirst(organizationConfig.columns, (candidate) => candidate.name === "id"),
        (candidate) => fromUndefinedOr(candidate.generatedIdentity?.type),
      ).pipe(getOrUndefined),
    ).toBe("byDefault");
  });

  it("preserves author-supplied VariantSchema.Field membership", () => {
    expect(Object.keys(ExplicitVariantModel.insert.fields)).toContain("value");
    expect(Object.keys(ExplicitVariantModel.update.fields)).toContain("value");
  });
});

describe("kit write strategies", () => {
  it("injects defaults while preserving Effect variant membership", () => {
    expect(Object.keys(AuditedRecord.fields)).toEqual(
      expect.arrayContaining([
        "createdAt",
        "updatedAt",
        "rowVersion",
        "name",
        "status",
        "source",
        "search",
      ]),
    );
    expect(Object.keys(AuditedRecord.update.fields)).not.toContain("createdAt");
    expect(Object.keys(AuditedRecord.insert.fields)).toContain("updatedAt");
    expect(Object.keys(AuditedRecord.update.fields)).toContain("updatedAt");
    expect(Object.keys(AuditedRecord.update.fields)).toContain("rowVersion");
    expect(Object.keys(AuditedRecord.json.fields)).toContain("rowVersion");
    expect(AuditedRecord.sql.columns.createdAt.column.kind).toBe("timestamp");
    expect(AuditedRecord.sql.columns.updatedAt.column.kind).toBe("timestamp");
  });

  it("constructs insert payloads through Overrideable constructor defaults", () => {
    const constructed = runSync(
      makeEffect(AuditedRecord.insert)({
        name: "Round Three",
        status: "draft",
        source: "api",
        search: "round three",
      }),
    );
    expect(constructed.createdAt).toBeDefined();
    expect(constructed.updatedAt).toBeDefined();
    expect(hasProperty(constructed, "rowVersion")).toBe(false);
  });

  it("rejects kit default collisions at compile time and runtime", () => {
    expect(_kitDefaultCollision).toThrow("kit default column");
  });

  it("emits default extras before model extras", () => {
    const config = getTableConfig(auditSchema.tables.audited_record);
    expect(config.checks.map((check) => check.name)).toEqual([
      "audited_record_row_version_positive",
      "audited_record_name_non_empty",
    ]);
  });
});

describe("enum and custom columns", () => {
  it("shares enum instances across assembly tables", () => {
    const recordConfig = getTableConfig(auditSchema.tables.audited_record);
    const eventConfig = getTableConfig(auditSchema.tables.audited_event);
    const recordStatus = columnFrom(recordConfig.columns, "status");
    const eventStatus = columnFrom(eventConfig.columns, "status");
    expect(recordStatus.getSQLType()).toBe("record_status");
    expect(columnFrom(recordConfig.columns, "source").getSQLType()).toBe("source");
    expect(hasProperty(recordStatus, "enum") ? recordStatus.enum : undefined).toBe(
      auditSchema.enums.record_status,
    );
    expect(hasProperty(eventStatus, "enum") ? eventStatus.enum : undefined).toBe(
      auditSchema.enums.record_status,
    );
  });

  it("rejects non-literal schemas and conflicting enum declarations", () => {
    expect(_badEnumBroadString).toThrow("finite non-empty union");
    expect(_enumValueMismatch).toThrow("incompatible values");
    expect(_pgNulEnum).toThrow("NUL (U+0000)");
    expect(effectDrizzleSchema.enums.deduped_status.enumValues).toEqual(["draft", "active"]);
  });

  it("compiles unsafe custom SQL types verbatim", () => {
    const config = getTableConfig(auditSchema.tables.audited_record);
    expect(columnFrom(config.columns, "search").getSQLType()).toBe("tsvector");
  });
});

describe("mechanical column kinds", () => {
  const config = getTableConfig(mechanicalTable);
  const mechanicalColumn = (name: string): PgColumn => columnFrom(config.columns, name);

  it("compiles numeric, date, char, json, and real descriptors", () => {
    expect(mechanicalColumn("amount").getSQLType()).toBe("numeric(10, 2)");
    expect(mechanicalColumn("calendar_date").getSQLType()).toBe("date");
    expect(mechanicalColumn("object_date").getSQLType()).toBe("date");
    expect(mechanicalColumn("code").getSQLType()).toBe("char(4)");
    expect(mechanicalColumn("payload").getSQLType()).toBe("json");
    expect(mechanicalColumn("score").getSQLType()).toBe("real");
  });

  it("compiles bigserial and smallserial defaults", () => {
    expect(mechanicalColumn("large_sequence").getSQLType()).toBe("bigserial");
    expect(mechanicalColumn("native_sequence").getSQLType()).toBe("bigserial");
    expect(mechanicalColumn("short_sequence").getSQLType()).toBe("smallserial");
    expect(mechanicalColumn("large_sequence").hasDefault).toBe(true);
    expect(mechanicalColumn("short_sequence").hasDefault).toBe(true);
  });

  it("requires exact char lengths in derive, verify, inject, and model-mirror modes", () => {
    expect(_charWithoutMaxLength).toThrow("isLengthBetween");
    expect(_charWithMaximumOnly).toThrow("isLengthBetween");
    expect(_charWithWrongExactLength).toThrow("exact schema length");
    expect(_charWithoutExactRuntimeMirror).toThrow("exact matching schema length");
    expect(
      Field.from(StringSchema.check(isLengthBetween(3, 3)).pipe(pg.char())).meta.column,
    ).toEqual({
      _tag: "char",
      dialect: "pg",
      kind: "char",
      ident: "char",
      length: 3,
    });
    const injected = Field.from(StringSchema.pipe(pg.char(4)));
    expect(is(injected.schema)("ABCD")).toBe(true);
    expect(is(injected.schema)("A")).toBe(false);
  });
});

describe("PostgreSQL arrays", () => {
  const config = getTableConfig(effectDrizzleSchema.tables.array_record);
  const arrayColumn = (name: string): PgColumn => columnFrom(config.columns, name);

  it("projects scalar builders once with dimensions, defaults, unique, and enum support", () => {
    expect(arrayColumn("labels").getSQLType()).toBe("text");
    expect(arrayColumn("labels").dimensions).toBe(1);
    expect(arrayColumn("labels").isUnique).toBe(true);
    expect(arrayColumn("matrix").getSQLType()).toBe("text");
    expect(arrayColumn("matrix").dimensions).toBe(2);
    expect(arrayColumn("matrix").default).toEqual([["seed"]]);
    const enumConfig = getTableConfig(effectDrizzleSchema.tables.enum_array_record);
    const statuses = columnFrom(enumConfig.columns, "statuses");
    expect(statuses.getSQLType()).toBe("record_status");
    expect(statuses.dimensions).toBe(1);
  });

  it("keeps bare array and object schemas on the existing jsonb derivation", () => {
    expect(Derive.classify(ArraySchema(StringSchema), "bareArray")).toEqual({
      column: { _tag: "jsonb", dialect: "pg", kind: "jsonb", ident: "jsonb" },
      nullable: false,
    });
    expect(ArrayRecord.sql.columns.labels.column.ident).toBe("text");
    expect(ArrayRecord.sql.columns.labels.dimensions).toBe(1);
  });

  it("rejects carrier, depth, and write-strategy mismatches at runtime", () => {
    expect(_badArrayCarrier).toThrow("does not match");
    expect(_badArrayDepth).toThrow("ReadonlyArray");
    expect(_badArrayThenPrimaryKey).toThrow("Array field");
    expect(_badPrimaryKeyThenArray).toThrow("incompatible");
    expect(_badArrayThenIdentity).toThrow("Array field");
    expect(_badIdentityThenArray).toThrow("incompatible");
    expect(_badArrayThenVersion).toThrow("Array field");
    expect(_badVersionThenArray).toThrow("incompatible");
  });

  it("rejects scalar-array and array-depth foreign keys", () => {
    expect(_scalarArrayFkMismatch).toThrow("array<text,1>");
    expect(_arrayDepthFkMismatch).toThrow("array<text,1>");
  });
});

describe("schema assembly", () => {
  it("emits direct and self-referential foreign keys", () => {
    const userForeignKeys = getTableConfig(effectDrizzleSchema.tables.user).foreignKeys;
    const organizationForeignKeys = getTableConfig(
      effectDrizzleSchema.tables.organization,
    ).foreignKeys;
    expect(userForeignKeys).toHaveLength(1);
    const userForeignKey = first(userForeignKeys, "user foreign key");
    const userReference = userForeignKey.reference();
    expect(first(userReference.columns, "user reference column").name).toBe("org_id");
    expect(first(userReference.foreignColumns, "user referenced column").name).toBe("id");
    expect(organizationForeignKeys).toHaveLength(1);
    const organizationForeignKey = first(organizationForeignKeys, "organization foreign key");
    expect(
      first(organizationForeignKey.reference().columns, "organization reference column").name,
    ).toBe("parent_org_id");
    expect(organizationForeignKey.onDelete).toBe("set null");
  });

  it("feeds its config to installed defineRelations and derives optionality", () => {
    expect(() =>
      defineRelations(effectDrizzleSchema.tables, effectDrizzleSchema.relationsConfig),
    ).not.toThrow();
    const userRelations = effectDrizzleSchema.relations.user?.relations;
    const organizationRelations = effectDrizzleSchema.relations.organization?.relations;
    expect(
      hasProperty(userRelations, "org") && hasProperty(userRelations.org, "optional")
        ? userRelations.org.optional
        : undefined,
    ).toBe(false);
    expect(
      hasProperty(organizationRelations, "parentOrg") &&
        hasProperty(organizationRelations.parentOrg, "optional")
        ? organizationRelations.parentOrg.optional
        : undefined,
    ).toBe(true);
    expect(hasProperty(organizationRelations, "users")).toBe(true);
    expect(hasProperty(organizationRelations, "childOrgs")).toBe(true);
    expect(hasProperty(organizationRelations, "usersThroughMembership")).toBe(true);
    expect(hasProperty(userRelations, "organizationsThroughMembership")).toBe(true);
  });

  it("disambiguates multiple reverse edges by the source relation field", () => {
    const relations = dualOrgLinkSchema.relations.organization?.relations;
    expect(hasProperty(relations, "dualOrgLinksByPrimaryOrg")).toBe(true);
    expect(hasProperty(relations, "dualOrgLinksBySecondaryOrg")).toBe(true);
  });

  it("throws tagged errors for missing and incompatible targets", () => {
    expect(_missingTarget).toThrow("missing_table");
    expect(_uuidTextFkMismatch).toThrow("uuid");
    expect(_entityFkMismatch).toThrow('entityId<"organization">');
    expect(_reverseRelationCollision).toThrow("collides");
    expect(_nonUniqueForeignKey).toThrow("primary-key or unique column");
    expect(_nonUniqueForeignKey).toThrow(pg.SchemaAssemblyError);
    expect(_duplicatePhysicalTableNames).toThrow("Physical table name 'user'");
    expect(_duplicatePhysicalTableNames).toThrow(pg.SchemaAssemblyError);
  });

  it("resolves exact registry keys before unique physical-name fallbacks", () => {
    const exact = first(
      getTableConfig(exactKeyResolutionSchema.tables.resolution_source).foreignKeys,
      "exact-key foreign key",
    ).reference();
    const physical = first(
      getTableConfig(uniquePhysicalResolutionSchema.tables.resolution_source).foreignKeys,
      "physical-name foreign key",
    ).reference();
    expect(getTableName(exact.foreignTable)).toBe("resolution_decoy");
    expect(getTableName(physical.foreignTable)).toBe("resolution_target");
  });

  it("provides collision-proof Drizzle export keys", () => {
    expect(effectDrizzleSchema.drizzleSchema["enum:record_status"]).toBe(
      effectDrizzleSchema.enums.record_status,
    );
    expect(effectDrizzleSchema.drizzleSchema["table:record_status"]).toBe(
      effectDrizzleSchema.tables.record_status,
    );
  });
});

describe("schema corroboration and invariants", () => {
  it("colocates AST derivation and Drizzle compilation with column specs", () => {
    expect(PgColumnSchema.Spec.fromSchemaAST(toEncoded(StringSchema.ast)).pipe(getOrThrow)).toEqual(
      PgColumnSchema.Text.make({}),
    );
    expect(PgColumnSchema.Spec.fromSchemaAST(toEncoded(DateSchema.ast)).pipe(isNone)).toBe(true);
    expect(
      typeof PgColumnSchema.Text.toDrizzleBuilder(PgColumnSchema.Text.make({}), "body").notNull,
    ).toBe("function");
    expect(
      typeof pipe(
        PgColumnSchema.Varchar.make({ length: 80 }),
        PgColumnSchema.Spec.toDrizzleBuilder("summary"),
      ).notNull,
    ).toBe("function");
    expect(
      typeof PgColumnSchema.Spec.toDrizzleBuilder(
        PgColumnSchema.Varchar.make({ length: 80 }),
        "summary",
      ).notNull,
    ).toBe("function");
  });

  it("scans maxLength checks without mutating the schema", () => {
    expect(_incompatibleVarchar).toThrow("maxLength 500");
    expect(_compatibleVarchar).not.toThrow();
    expect(_unboundedVarchar).not.toThrow();
    expect(StringSchema.pipe(Derive.maxLengths)).toEqual([]);
  });

  it("classifies bare carriers with SQL identities", () => {
    expect(Derive.classify(StringSchema, "s")).toEqual({
      column: { _tag: "text", dialect: "pg", kind: "text", ident: "text" },
      nullable: false,
    });
    expect(Derive.classify(BooleanSchema, "b")).toEqual({
      column: { _tag: "boolean", dialect: "pg", kind: "boolean", ident: "boolean" },
      nullable: false,
    });
    expect(Derive.classify(NullOr(StringSchema), "n")).toEqual({
      column: { _tag: "text", dialect: "pg", kind: "text", ident: "text" },
      nullable: true,
    });
    expect(Derive.classify(StructSchema({ a: StringSchema }), "j")).toEqual({
      column: { _tag: "jsonb", dialect: "pg", kind: "jsonb", ident: "jsonb" },
      nullable: false,
    });
    expect(Derive.classify(ArraySchema(StringSchema), "a")).toEqual({
      column: { _tag: "jsonb", dialect: "pg", kind: "jsonb", ident: "jsonb" },
      nullable: false,
    });
    expect(Derive.classify(suspend(() => NullOr(StringSchema)), "lazy")).toEqual({
      column: { _tag: "text", dialect: "pg", kind: "text", ident: "text" },
      nullable: true,
    });
    class SuspendedNullableModel extends Model<SuspendedNullableModel>(
      "SuspendedNullableModel",
    )({ value: suspend(() => NullOr(StringSchema)) }) {}
    expect(SuspendedNullableModel.sql.columns.value.column.kind).toBe("text");
  });

  it("corroborates every safe explicit PostgreSQL carrier at model construction", () => {
    expect(_runtimeStringCarrierMismatch).toThrow("encodes number");
    expect(_runtimeNumberCarrierMismatch).toThrow("encodes string");
    expect(_runtimeDateCarrierMismatch).toThrow("encodes date");
    expect(_runtimeByteCarrierMismatch).toThrow("encodes string");
    expect(_runtimeObjectCarrierMismatch).toThrow("encodes string");
    expect(_runtimeModeCarrierMismatch).toThrow("encodes bigint");
    expect(_runtimeArrayCarrierMismatch).toThrow("encodes number[1]");
  });

  it("refuses ambiguous encodings and mirrors model invariants at runtime", () => {
    expect(() => Derive.classify(UnknownSchema, "u")).toThrow();
    expect(() => Derive.classify(Union([StringSchema, Finite]), "mixed")).toThrow();
    expect(_needsExplicitColumn).toThrow();
    expect(_twoPrimaryKeys).toThrow();
    expect(_twoVersions).toThrow("optimistic-version fields");
    expect(_badVersionColumn).toThrow("number-encoded integer-family");
    expect(_badVersionThenIdentity).toThrow("identity or generated");
    expect(_badIdentityThenVersion).toThrow("identity or generated");
    expect(_badVersionThenGenerated).toThrow("identity or generated");
    expect(_badGeneratedThenVersion).toThrow("identity or generated");
    expect(_badBigintVersion).toThrow("number-encoded integer-family");
    expect(_badVariantVersion).toThrow("explicit VariantSchema.Field");
    expect(_nullablePrimaryKey).toThrow();
    expect(_defaultThenGenerated).toThrow();
    expect(_generatedThenDefault).toThrow();
    expect(_declarationNeedsExplicitColumn).toThrow("Declaration");
  });

  it("rejects unsafe optimistic repository construction synchronously", () => {
    expect(_repositoryVersionLocator).toThrow("cannot be the optimistic-version field");
    expect(_repositoryNonUniqueLocator).toThrow("primary-key or unique field");
    expect(_repositoryColumnNameOverride).toThrow("columnName override on 'displayName'");
  });

  it("validates plain descriptors at their remaining author-input seams", () => {
    expect(_badTimestampCorrelation).toThrow("Timestamp identity must agree with withTimezone");
    expect(_badHandBuiltColumn).toThrow("invalid or foreign PostgreSQL column descriptor");
    expect(_badHandBuiltReference).toThrow("invalid reference descriptor");
    expect(() => getTableConfig(_badExtrasCallback())).toThrow(
      "must return valid PostgreSQL extra nodes",
    );
  });
});

describe("tagged errors", () => {
  it("supports structural equality, make construction, and catchTag", () => {
    const left = ModelInvariantError.make({
      message: "invalid field",
      fieldName: "value",
    });
    const right = ModelInvariantError.make({
      message: "invalid field",
      fieldName: "value",
    });
    expect(equals(left, right)).toBe(true);

    const recovered = runSync(
      failEffect(
        VersionConflictError.make({
          table: "user",
          id: 1,
          expectedVersion: 2,
        }),
      ).pipe(catchTag("VersionConflictError", () => succeed("recovered"))),
    );
    expect(recovered).toBe("recovered");
  });
});

describe("varchar authoring modes", () => {
  it("derives the length from the schema's isMaxLength check", () => {
    const derived = Field.from(StringSchema.check(isMaxLength(320)).pipe(pg.varchar()));
    expect(derived.meta.column).toEqual({
      _tag: "varchar",
      dialect: "pg",
      kind: "varchar",
      ident: "varchar",
      length: 320,
    });
  });

  it("takes the tightest bound when several maxLength checks exist", () => {
    const derived = Field.from(
      StringSchema.check(isMaxLength(100)).check(isMaxLength(64)).pipe(pg.varchar()),
    );
    expect(derived.meta.column).toEqual({
      _tag: "varchar",
      dialect: "pg",
      kind: "varchar",
      ident: "varchar",
      length: 64,
    });
  });

  it("refuses derive mode when no maxLength check exists", () => {
    expect(() => StringSchema.pipe(pg.varchar())).toThrow("isMaxLength");
  });

  it("injects isMaxLength into unbounded plain schemas so domain and DDL agree", () => {
    const injected = Field.from(StringSchema.pipe(pg.varchar(50)));
    if (!isSchema(injected.schema)) {
      throw new Error("varchar injection unexpectedly produced a variant field");
    }
    const accepts = is(injected.schema);
    expect(accepts("x".repeat(50))).toBe(true);
    expect(accepts("x".repeat(51))).toBe(false);
    expect(injected.schema.pipe(Derive.maxLengths)).toEqual([50]);
  });

  it("injects varchar bounds on the encoded side of transformed schemas", () => {
    const injected = Field.from(FiniteFromString.pipe(pg.varchar(2)));
    if (!isSchema(injected.schema)) {
      throw new Error("varchar injection unexpectedly produced a variant field");
    }
    expect(decodeUnknownSync(injected.schema)("42")).toBe(42);
    expect(() => decodeUnknownSync(injected.schema)("123")).toThrow();
    expect(injected.schema.pipe(Derive.maxLengths)).toEqual([2]);
  });

  it("verifies instead of double-injecting when the schema already carries a bound", () => {
    const verified = Field.from(StringSchema.check(isMaxLength(50)).pipe(pg.varchar(80)));
    expect(verified.schema.pipe(Derive.maxLengths)).toEqual([50]);
    expect(verified.meta.column).toEqual({
      _tag: "varchar",
      dialect: "pg",
      kind: "varchar",
      ident: "varchar",
      length: 80,
    });
  });
});

describe("Option paved road", () => {
  it("derives nullable columns from OptionFromNullOr and effect FieldOption", () => {
    expect(Derive.classify(OptionFromNullOr(StringSchema), "opt")).toEqual({
      column: { _tag: "text", dialect: "pg", kind: "text", ident: "text" },
      nullable: true,
    });
    expect(Derive.classify(EffectModel.FieldOption(StringSchema), "opt2")).toEqual({
      column: { _tag: "text", dialect: "pg", kind: "text", ident: "text" },
      nullable: true,
    });
  });
});
