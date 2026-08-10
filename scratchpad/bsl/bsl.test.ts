/** Runtime proofs for BSL round three. */
import { describe, expect, it } from "bun:test";
import { defineRelations, getTableName } from "drizzle-orm";
import { getTableConfig, type PgColumn } from "drizzle-orm/pg-core";
import { Effect, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as AST from "effect/SchemaAST";
import * as SchemaParser from "effect/SchemaParser";
import { Model as EffectModel } from "effect/unstable/schema";
import * as Derive from "./derive.ts";
import * as Field from "./Field.ts";
import * as PgColumnSchema from "./PgColumn.ts";
import * as pg from "./pg.ts";
import {
  _arrayDepthFkMismatch,
  _badArrayCarrier,
  _badArrayDepth,
  _badArrayThenIdentity,
  _badArrayThenPrimaryKey,
  _badArrayThenVersion,
  _compatibleVarchar,
  _defaultThenGenerated,
  _badEnumBroadString,
  _badGeneratedThenVersion,
  _badIdentityThenVersion,
  _badVersionColumn,
  _badVersionThenGenerated,
  _badVersionThenIdentity,
  _charWithoutMaxLength,
  _entityFkMismatch,
  _enumValueMismatch,
  _generatedThenDefault,
  _incompatibleVarchar,
  _missingTarget,
  _needsExplicitColumn,
  _nullablePrimaryKey,
  _reverseRelationCollision,
  _kitDefaultCollision,
  _badIdentityThenArray,
  _badPrimaryKeyThenArray,
  _badVersionThenArray,
  _scalarArrayFkMismatch,
  _twoPrimaryKeys,
  _twoVersions,
  _unboundedVarchar,
  _uuidTextFkMismatch,
  auditSchema,
  ArrayRecord,
  AuditedRecord,
  bslSchema,
  dualOrgLinkSchema,
  ExplicitVariantModel,
  mechanicalTable,
  Organization,
  OrganizationId,
  User,
  UserId,
  userTable,
} from "./fixtures.ts";

const userConfig = getTableConfig(userTable);

const column = (name: string): PgColumn =>
  O.getOrThrowWith(
    A.findFirst(userConfig.columns, (candidate) => candidate.name === name),
    () => new Error(`column '${name}' missing`)
  );

const columnFrom = (columns: ReadonlyArray<PgColumn>, name: string): PgColumn =>
  O.getOrThrowWith(
    A.findFirst(columns, (candidate) => candidate.name === name),
    () => new Error(`column '${name}' missing`)
  );

const first = <A>(values: ReadonlyArray<A>, label: string): A =>
  O.getOrThrowWith(A.head(values), () => new Error(`${label} missing`));

describe("toPgTable", () => {
  it("projects names, nullability, identities, defaults, and generation", () => {
    expect(getTableName(userTable)).toBe("user");
    expect(
      A.sort(
        A.map(userConfig.columns, (candidate) => candidate.name),
        Order.String
      )
    ).toEqual(
      A.sort(
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
        Order.String
      )
    );
    expect(column("name").notNull).toBe(true);
    expect(column("bio").notNull).toBe(false);
    expect(column("id").primary).toBe(true);
    expect(
      O.fromUndefinedOr(column("id").generatedIdentity?.type).pipe(
        O.getOrUndefined
      )
    ).toBe("always");
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
    expect(
      A.map(userConfig.uniqueConstraints, (constraint) => constraint.name)
    ).toContain("user_org_email_unique");
    expect(A.map(userConfig.checks, (check) => check.name)).toContain(
      "user_email_check"
    );

    const membershipConfig = getTableConfig(bslSchema.tables.membership);
    expect(membershipConfig.primaryKeys).toHaveLength(1);
    const membershipPrimaryKey = first(
      membershipConfig.primaryKeys,
      "membership primary key"
    );
    expect(membershipPrimaryKey.name).toBe("membership_pk");
    expect(
      A.map(membershipPrimaryKey.columns, (candidate) => candidate.name)
    ).toEqual(["organization_id", "user_id"]);
  });
});

describe("variant truth table", () => {
  it("keeps identity row locators in update and omits generated expressions", () => {
    expect(R.keys(User.insert.fields)).not.toContain("id");
    expect(R.keys(User.update.fields)).toContain("id");
    expect(R.keys(User.insert.fields)).not.toContain("searchName");
    expect(R.keys(User.update.fields)).not.toContain("searchName");
    const insert = Effect.runSync(
      SchemaParser.makeEffect(User.insert)({
        orgId: OrganizationId.make(1),
        email: "a@example.com",
        name: "A",
        bio: null,
        nickname: O.none(),
        settings: { theme: "dark" },
        active: true,
        rowVersion: 1,
      })
    );
    const update = Effect.runSync(
      SchemaParser.makeEffect(User.update)({
        id: UserId.make(1),
        rowVersion: 1,
      })
    );
    const { rowVersion: _rowVersion, ...withoutVersion } = update;
    expect(S.is(User.insert)(insert)).toBe(true);
    expect(S.is(User.update)(update)).toBe(true);
    expect(S.is(User.update)(withoutVersion)).toBe(false);
    expect(S.is(User.update)({})).toBe(false);
    expect(R.keys(User.jsonCreate.fields)).not.toContain("searchName");
  });

  it("keeps identity-by-default present in update and optional in insert", () => {
    expect(R.keys(Organization.insert.fields)).toContain("id");
    expect(R.keys(Organization.update.fields)).toContain("id");
    expect(
      S.is(Organization.insert)({
        parentOrgId: null,
        slug: "root",
        name: "Root",
        code: "ROOT",
      })
    ).toBe(true);
    const organizationConfig = getTableConfig(bslSchema.tables.organization);
    expect(
      O.flatMap(
        A.findFirst(
          organizationConfig.columns,
          (candidate) => candidate.name === "id"
        ),
        (candidate) => O.fromUndefinedOr(candidate.generatedIdentity?.type)
      ).pipe(O.getOrUndefined)
    ).toBe("byDefault");
  });

  it("preserves author-supplied VariantSchema.Field membership", () => {
    expect(R.keys(ExplicitVariantModel.insert.fields)).toContain("value");
    expect(R.keys(ExplicitVariantModel.update.fields)).toContain("value");
  });
});

describe("kit write strategies", () => {
  it("injects defaults while preserving Effect variant membership", () => {
    expect(R.keys(AuditedRecord.fields)).toEqual(
      expect.arrayContaining([
        "createdAt",
        "updatedAt",
        "rowVersion",
        "name",
        "status",
        "source",
        "search",
      ])
    );
    expect(R.keys(AuditedRecord.update.fields)).not.toContain("createdAt");
    expect(R.keys(AuditedRecord.insert.fields)).toContain("updatedAt");
    expect(R.keys(AuditedRecord.update.fields)).toContain("updatedAt");
    expect(R.keys(AuditedRecord.update.fields)).toContain("rowVersion");
    expect(R.keys(AuditedRecord.json.fields)).toContain("rowVersion");
    expect(AuditedRecord.bsl.columns.createdAt.column.kind).toBe("timestamp");
    expect(AuditedRecord.bsl.columns.updatedAt.column.kind).toBe("timestamp");
  });

  it("constructs insert payloads through Overrideable constructor defaults", () => {
    const constructed = Effect.runSync(
      SchemaParser.makeEffect(AuditedRecord.insert)({
        name: "Round Three",
        status: "draft",
        source: "api",
        search: "round three",
      })
    );
    expect(constructed.createdAt).toBeDefined();
    expect(constructed.updatedAt).toBeDefined();
    expect(P.hasProperty(constructed, "rowVersion")).toBe(false);
  });

  it("rejects kit default collisions at compile time and runtime", () => {
    expect(_kitDefaultCollision).toThrow("kit default column");
  });

  it("emits default extras before model extras", () => {
    const config = getTableConfig(auditSchema.tables.audited_record);
    expect(A.map(config.checks, (check) => check.name)).toEqual([
      "kit_row_version_positive",
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
    expect(columnFrom(recordConfig.columns, "source").getSQLType()).toBe(
      "source"
    );
    expect(
      P.hasProperty(recordStatus, "enum") ? recordStatus.enum : undefined
    ).toBe(auditSchema.enums.record_status);
    expect(
      P.hasProperty(eventStatus, "enum") ? eventStatus.enum : undefined
    ).toBe(auditSchema.enums.record_status);
  });

  it("rejects non-literal schemas and conflicting enum declarations", () => {
    expect(_badEnumBroadString).toThrow("finite non-empty union");
    expect(_enumValueMismatch).toThrow("incompatible values");
  });

  it("compiles unsafe custom SQL types verbatim", () => {
    const config = getTableConfig(auditSchema.tables.audited_record);
    expect(columnFrom(config.columns, "search").getSQLType()).toBe("tsvector");
  });
});

describe("mechanical column kinds", () => {
  const config = getTableConfig(mechanicalTable);
  const mechanicalColumn = (name: string): PgColumn =>
    columnFrom(config.columns, name);

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

  it("reuses varchar's char length derivation and refusal policy", () => {
    expect(_charWithoutMaxLength).toThrow("isMaxLength");
    expect(
      Field.from(S.String.check(S.isMaxLength(3)).pipe(pg.char())).meta.column
    ).toEqual({ kind: "char", ident: "char", length: 3 });
  });
});

describe("PostgreSQL arrays", () => {
  const config = getTableConfig(bslSchema.tables.array_record);
  const arrayColumn = (name: string): PgColumn =>
    columnFrom(config.columns, name);

  it("projects scalar builders once with dimensions, defaults, unique, and enum support", () => {
    expect(arrayColumn("labels").getSQLType()).toBe("text");
    expect(arrayColumn("labels").dimensions).toBe(1);
    expect(arrayColumn("labels").isUnique).toBe(true);
    expect(arrayColumn("matrix").getSQLType()).toBe("text");
    expect(arrayColumn("matrix").dimensions).toBe(2);
    expect(arrayColumn("matrix").default).toEqual([["seed"]]);
    const enumConfig = getTableConfig(bslSchema.tables.enum_array_record);
    const statuses = columnFrom(enumConfig.columns, "statuses");
    expect(statuses.getSQLType()).toBe("record_status");
    expect(statuses.dimensions).toBe(1);
  });

  it("keeps bare array and object schemas on the existing jsonb derivation", () => {
    expect(Derive.classify(S.Array(S.String), "bareArray")).toEqual({
      column: { kind: "jsonb", ident: "jsonb" },
      nullable: false,
    });
    expect(ArrayRecord.bsl.columns.labels.column.ident).toBe("text");
    expect(ArrayRecord.bsl.columns.labels.dimensions).toBe(1);
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
    const userForeignKeys = getTableConfig(bslSchema.tables.user).foreignKeys;
    const organizationForeignKeys = getTableConfig(
      bslSchema.tables.organization
    ).foreignKeys;
    expect(userForeignKeys).toHaveLength(1);
    const userForeignKey = first(userForeignKeys, "user foreign key");
    const userReference = userForeignKey.reference();
    expect(first(userReference.columns, "user reference column").name).toBe(
      "org_id"
    );
    expect(
      first(userReference.foreignColumns, "user referenced column").name
    ).toBe("id");
    expect(organizationForeignKeys).toHaveLength(1);
    const organizationForeignKey = first(
      organizationForeignKeys,
      "organization foreign key"
    );
    expect(
      first(
        organizationForeignKey.reference().columns,
        "organization reference column"
      ).name
    ).toBe("parent_org_id");
    expect(organizationForeignKey.onDelete).toBe("set null");
  });

  it("feeds its config to installed defineRelations and derives optionality", () => {
    expect(() =>
      defineRelations(bslSchema.tables, bslSchema.relationsConfig)
    ).not.toThrow();
    const userRelations = bslSchema.relations.user?.relations;
    const organizationRelations = bslSchema.relations.organization?.relations;
    expect(
      P.hasProperty(userRelations, "org") &&
        P.hasProperty(userRelations.org, "optional")
        ? userRelations.org.optional
        : undefined
    ).toBe(false);
    expect(
      P.hasProperty(organizationRelations, "parentOrg") &&
        P.hasProperty(organizationRelations.parentOrg, "optional")
        ? organizationRelations.parentOrg.optional
        : undefined
    ).toBe(true);
    expect(P.hasProperty(organizationRelations, "users")).toBe(true);
    expect(P.hasProperty(organizationRelations, "childOrgs")).toBe(true);
    expect(
      P.hasProperty(organizationRelations, "usersThroughMembership")
    ).toBe(true);
    expect(
      P.hasProperty(userRelations, "organizationsThroughMembership")
    ).toBe(true);
  });

  it("disambiguates multiple reverse edges by the source relation field", () => {
    const relations = dualOrgLinkSchema.relations.organization?.relations;
    expect(P.hasProperty(relations, "dualOrgLinksByPrimaryOrg")).toBe(true);
    expect(P.hasProperty(relations, "dualOrgLinksBySecondaryOrg")).toBe(true);
  });

  it("throws tagged errors for missing and incompatible targets", () => {
    expect(_missingTarget).toThrow("missing_table");
    expect(_uuidTextFkMismatch).toThrow("uuid");
    expect(_entityFkMismatch).toThrow('entityId<"organization">');
    expect(_reverseRelationCollision).toThrow("collides");
  });
});

describe("schema corroboration and invariants", () => {
  it("colocates AST derivation and Drizzle compilation with column specs", () => {
    expect(
      PgColumnSchema.Spec.fromSchemaAST(AST.toEncoded(S.String.ast)).pipe(
        O.getOrThrow
      )
    ).toEqual(PgColumnSchema.Text.make({}));
    expect(
      PgColumnSchema.Spec.fromSchemaAST(AST.toEncoded(S.Date.ast)).pipe(
        O.isNone
      )
    ).toBe(true);
    expect(
      typeof PgColumnSchema.Text.toDrizzleBuilder(
        PgColumnSchema.Text.make({}),
        "body"
      ).notNull
    ).toBe("function");
    expect(
      typeof pipe(
        PgColumnSchema.Varchar.make({ length: 80 }),
        PgColumnSchema.Spec.toDrizzleBuilder("summary")
      ).notNull
    ).toBe("function");
    expect(
      typeof PgColumnSchema.Spec.toDrizzleBuilder(
        PgColumnSchema.Varchar.make({ length: 80 }),
        "summary"
      ).notNull
    ).toBe("function");
  });

  it("scans maxLength checks without mutating the schema", () => {
    expect(_incompatibleVarchar).toThrow("maxLength 500");
    expect(_compatibleVarchar).not.toThrow();
    expect(_unboundedVarchar).not.toThrow();
    expect(S.String.pipe(Derive.maxLengths)).toEqual([]);
  });

  it("classifies bare carriers with SQL identities", () => {
    expect(Derive.classify(S.String, "s")).toEqual({
      column: { kind: "text", ident: "text" },
      nullable: false,
    });
    expect(Derive.classify(S.Boolean, "b")).toEqual({
      column: { kind: "boolean", ident: "boolean" },
      nullable: false,
    });
    expect(Derive.classify(S.NullOr(S.String), "n")).toEqual({
      column: { kind: "text", ident: "text" },
      nullable: true,
    });
    expect(Derive.classify(S.Struct({ a: S.String }), "j")).toEqual({
      column: { kind: "jsonb", ident: "jsonb" },
      nullable: false,
    });
  });

  it("refuses ambiguous encodings and mirrors model invariants at runtime", () => {
    expect(() => Derive.classify(S.Unknown, "u")).toThrow();
    expect(() =>
      Derive.classify(S.Union([S.String, S.Finite]), "mixed")
    ).toThrow();
    expect(_needsExplicitColumn).toThrow();
    expect(_twoPrimaryKeys).toThrow();
    expect(_twoVersions).toThrow("optimistic-version fields");
    expect(_badVersionColumn).toThrow("integer-family column");
    expect(_badVersionThenIdentity).toThrow("identity or generated");
    expect(_badIdentityThenVersion).toThrow("identity or generated");
    expect(_badVersionThenGenerated).toThrow("identity or generated");
    expect(_badGeneratedThenVersion).toThrow("identity or generated");
    expect(_nullablePrimaryKey).toThrow();
    expect(_defaultThenGenerated).toThrow();
    expect(_generatedThenDefault).toThrow();
  });
});

describe("varchar authoring modes", () => {
  it("derives the length from the schema's isMaxLength check", () => {
    const derived = Field.from(
      S.String.check(S.isMaxLength(320)).pipe(pg.varchar())
    );
    expect(derived.meta.column).toEqual({
      kind: "varchar",
      ident: "varchar",
      length: 320,
    });
  });

  it("takes the tightest bound when several maxLength checks exist", () => {
    const derived = Field.from(
      S.String.check(S.isMaxLength(100))
        .check(S.isMaxLength(64))
        .pipe(pg.varchar())
    );
    expect(derived.meta.column).toEqual({
      kind: "varchar",
      ident: "varchar",
      length: 64,
    });
  });

  it("refuses derive mode when no maxLength check exists", () => {
    expect(() => S.String.pipe(pg.varchar())).toThrow("isMaxLength");
  });

  it("injects isMaxLength into unbounded plain schemas so domain and DDL agree", () => {
    const injected = Field.from(S.String.pipe(pg.varchar(50)));
    if (!S.isSchema(injected.schema)) {
      throw new Error(
        "varchar injection unexpectedly produced a variant field"
      );
    }
    const accepts = S.is(injected.schema);
    expect(accepts("x".repeat(50))).toBe(true);
    expect(accepts("x".repeat(51))).toBe(false);
    expect(injected.schema.pipe(Derive.maxLengths)).toEqual([50]);
  });

  it("injects varchar bounds on the encoded side of transformed schemas", () => {
    const injected = Field.from(S.FiniteFromString.pipe(pg.varchar(2)));
    if (!S.isSchema(injected.schema)) {
      throw new Error(
        "varchar injection unexpectedly produced a variant field"
      );
    }
    expect(S.decodeUnknownSync(injected.schema)("42")).toBe(42);
    expect(() => S.decodeUnknownSync(injected.schema)("123")).toThrow();
    expect(injected.schema.pipe(Derive.maxLengths)).toEqual([2]);
  });

  it("verifies instead of double-injecting when the schema already carries a bound", () => {
    const verified = Field.from(
      S.String.check(S.isMaxLength(50)).pipe(pg.varchar(80))
    );
    expect(verified.schema.pipe(Derive.maxLengths)).toEqual([50]);
    expect(verified.meta.column).toEqual({
      kind: "varchar",
      ident: "varchar",
      length: 80,
    });
  });
});

describe("Option paved road", () => {
  it("derives nullable columns from OptionFromNullOr and effect FieldOption", () => {
    expect(Derive.classify(S.OptionFromNullOr(S.String), "opt")).toEqual({
      column: { kind: "text", ident: "text" },
      nullable: true,
    });
    expect(Derive.classify(EffectModel.FieldOption(S.String), "opt2")).toEqual({
      column: { kind: "text", ident: "text" },
      nullable: true,
    });
  });
});
