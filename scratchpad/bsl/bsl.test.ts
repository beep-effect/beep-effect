/** Runtime proofs for BSL round two. */
import { describe, expect, it } from "bun:test";
import { defineRelations, getTableName } from "drizzle-orm";
import { getTableConfig, type PgColumn } from "drizzle-orm/pg-core";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Model as EffectModel } from "effect/unstable/schema";
import * as Derive from "./derive.ts";
import * as Field from "./Field.ts";
import * as pg from "./pg.ts";
import {
  _compatibleVarchar,
  _defaultThenGenerated,
  _entityFkMismatch,
  _generatedThenDefault,
  _incompatibleVarchar,
  _missingTarget,
  _needsExplicitColumn,
  _nullablePrimaryKey,
  _twoPrimaryKeys,
  _unboundedVarchar,
  _uuidTextFkMismatch,
  bslSchema,
  ExplicitVariantModel,
  Organization,
  User,
  userTable,
} from "./fixtures.ts";

const userConfig = getTableConfig(userTable);

const column = (name: string): PgColumn => {
  const found = userConfig.columns.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`column '${name}' missing`);
  return found;
};

describe("toPgTable", () => {
  it("projects names, nullability, identities, defaults, and generation", () => {
    expect(getTableName(userTable)).toBe("user");
    expect(userConfig.columns.map((candidate) => candidate.name).sort()).toEqual(
      [
        "active",
        "bio",
        "created_at",
        "email",
        "id",
        "name",
        "org_id",
        "search_name",
        "settings",
        "status",
      ].sort()
    );
    expect(column("name").notNull).toBe(true);
    expect(column("bio").notNull).toBe(false);
    expect(column("id").primary).toBe(true);
    expect(column("id").generatedIdentity?.type).toBe("always");
    expect(column("created_at").hasDefault).toBe(true);
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
    expect(userConfig.indexes[0]?.config.name).toBe("user_email_idx");
    expect(userConfig.indexes[0]?.config.method).toBe("btree");
    expect(userConfig.indexes[0]?.config.where).toBeDefined();
    expect(userConfig.uniqueConstraints.map((constraint) => constraint.name)).toContain("user_org_email_unique");
    expect(userConfig.checks.map((check) => check.name)).toContain("user_email_check");

    const membershipConfig = getTableConfig(bslSchema.tables.membership);
    expect(membershipConfig.primaryKeys).toHaveLength(1);
    expect(membershipConfig.primaryKeys[0]?.name).toBe("membership_pk");
    expect(membershipConfig.primaryKeys[0]?.columns.map((candidate) => candidate.name)).toEqual([
      "organization_id",
      "user_id",
    ]);
  });
});

describe("variant truth table", () => {
  it("omits generated fields and makes defaults insert-optional", () => {
    expect(Object.keys(User.insert.fields)).not.toContain("id");
    expect(Object.keys(User.update.fields)).not.toContain("id");
    expect(Object.keys(User.insert.fields)).not.toContain("searchName");
    expect(Object.keys(User.update.fields)).not.toContain("searchName");
    expect(
      S.is(User.insert)({
        orgId: 1,
        email: "a@example.com",
        name: "A",
        bio: null,
        settings: { theme: "dark" },
        active: true,
      })
    ).toBe(true);
  });

  it("keeps identity-by-default present in update and optional in insert", () => {
    expect(Object.keys(Organization.insert.fields)).toContain("id");
    expect(Object.keys(Organization.update.fields)).toContain("id");
    expect(
      S.is(Organization.insert)({
        parentOrgId: null,
        slug: "root",
        name: "Root",
        code: "ROOT",
      })
    ).toBe(true);
    const organizationConfig = getTableConfig(bslSchema.tables.organization);
    expect(organizationConfig.columns.find((candidate) => candidate.name === "id")?.generatedIdentity?.type).toBe(
      "byDefault"
    );
  });

  it("preserves author-supplied VariantSchema.Field membership", () => {
    expect(Object.keys(ExplicitVariantModel.insert.fields)).toContain("value");
    expect(Object.keys(ExplicitVariantModel.update.fields)).toContain("value");
  });
});

describe("schema assembly", () => {
  it("emits direct and self-referential foreign keys", () => {
    const userForeignKeys = getTableConfig(bslSchema.tables.user).foreignKeys;
    const organizationForeignKeys = getTableConfig(bslSchema.tables.organization).foreignKeys;
    expect(userForeignKeys).toHaveLength(1);
    expect(userForeignKeys[0]?.reference().columns[0]?.name).toBe("org_id");
    expect(userForeignKeys[0]?.reference().foreignColumns[0]?.name).toBe("id");
    expect(organizationForeignKeys).toHaveLength(1);
    expect(organizationForeignKeys[0]?.reference().columns[0]?.name).toBe("parent_org_id");
    expect(organizationForeignKeys[0]?.onDelete).toBe("set null");
  });

  it("feeds its config to installed defineRelations and derives optionality", () => {
    expect(() => defineRelations(bslSchema.tables, bslSchema.relationsConfig)).not.toThrow();
    const userRelations = bslSchema.relations.user?.relations;
    const organizationRelations = bslSchema.relations.organization?.relations;
    expect(
      P.hasProperty(userRelations, "org") && P.hasProperty(userRelations.org, "optional")
        ? userRelations.org.optional
        : undefined
    ).toBe(false);
    expect(
      P.hasProperty(organizationRelations, "parentOrg") &&
        P.hasProperty(organizationRelations.parentOrg, "optional")
        ? organizationRelations.parentOrg.optional
        : undefined
    ).toBe(true);
  });

  it("throws tagged errors for missing and incompatible targets", () => {
    expect(_missingTarget).toThrow("missing_table");
    expect(_uuidTextFkMismatch).toThrow("uuid");
    expect(_entityFkMismatch).toThrow('entityId<"organization">');
  });
});

describe("schema corroboration and invariants", () => {
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
    expect(() => Derive.classify(S.Union([S.String, S.Finite]), "mixed")).toThrow();
    expect(_needsExplicitColumn).toThrow();
    expect(_twoPrimaryKeys).toThrow();
    expect(_nullablePrimaryKey).toThrow();
    expect(_defaultThenGenerated).toThrow();
    expect(_generatedThenDefault).toThrow();
  });
});

describe("varchar authoring modes", () => {
  it("derives the length from the schema's isMaxLength check", () => {
    const derived = Field.from(S.String.check(S.isMaxLength(320)).pipe(pg.varchar()));
    expect(derived.meta.column).toEqual({ kind: "varchar", ident: "varchar", length: 320 });
  });

  it("takes the tightest bound when several maxLength checks exist", () => {
    const derived = Field.from(S.String.check(S.isMaxLength(100)).check(S.isMaxLength(64)).pipe(pg.varchar()));
    expect(derived.meta.column).toEqual({ kind: "varchar", ident: "varchar", length: 64 });
  });

  it("refuses derive mode when no maxLength check exists", () => {
    expect(() => S.String.pipe(pg.varchar())).toThrow("isMaxLength");
  });

  it("injects isMaxLength into unbounded plain schemas so domain and DDL agree", () => {
    const injected = Field.from(S.String.pipe(pg.varchar(50)));
    const accepts = S.is(injected.schema as S.Top);
    expect(accepts("x".repeat(50))).toBe(true);
    expect(accepts("x".repeat(51))).toBe(false);
    expect(injected.schema.pipe(Derive.maxLengths)).toEqual([50]);
  });

  it("verifies instead of double-injecting when the schema already carries a bound", () => {
    const verified = Field.from(S.String.check(S.isMaxLength(50)).pipe(pg.varchar(80)));
    expect(verified.schema.pipe(Derive.maxLengths)).toEqual([50]);
    expect(verified.meta.column).toEqual({ kind: "varchar", ident: "varchar", length: 80 });
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
