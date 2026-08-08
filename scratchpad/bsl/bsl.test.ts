/**
 * Runtime proofs for the BSL experiment: real drizzle table metadata, the
 * derivation classifier, and the model statics.
 */
import { describe, expect, it } from "bun:test";
import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as S from "effect/Schema";
import * as Derive from "./derive.ts";
import { _needsExplicitColumn, _twoPrimaryKeys, User, userTable } from "./fixtures.ts";

const config = getTableConfig(userTable);
const column = (name: string) => {
  const found = config.columns.find((c) => c.name === name);
  if (found === undefined) throw new Error(`column '${name}' missing`);
  return found;
};

describe("toPgTable", () => {
  it("derives the table name from the identifier", () => {
    expect(getTableName(userTable)).toBe("user");
  });

  it("snake-cases column names from field keys", () => {
    expect(column("org_id")).toBeDefined();
    expect(column("created_at")).toBeDefined();
    expect(config.columns.map((c) => c.name).sort()).toEqual(
      ["active", "bio", "created_at", "email", "id", "name", "org_id", "settings"].sort()
    );
  });

  it("derives notNull from the encoded AST", () => {
    expect(column("name").notNull).toBe(true);
    expect(column("bio").notNull).toBe(false);
    expect(column("org_id").notNull).toBe(true);
  });

  it("applies primary key, identity, unique, and defaults", () => {
    expect(column("id").primary).toBe(true);
    expect(column("id").generatedIdentity?.type).toBe("always");
    expect(column("email").isUnique).toBe(true);
    expect(column("created_at").hasDefault).toBe(true);
  });

  it("maps column kinds onto real pg builders", () => {
    expect(column("email").getSQLType()).toBe("varchar(320)");
    expect(column("settings").getSQLType()).toBe("jsonb");
    expect(column("active").getSQLType()).toBe("boolean");
    expect(column("id").getSQLType()).toBe("integer");
    expect(column("created_at").getSQLType()).toContain("timestamp");
  });
});

describe("derivation", () => {
  it("classifies bare carriers", () => {
    expect(Derive.classify(S.String, "s")).toEqual({ column: { kind: "text" }, nullable: false });
    expect(Derive.classify(S.Boolean, "b")).toEqual({ column: { kind: "boolean" }, nullable: false });
    expect(Derive.classify(S.NullOr(S.String), "n")).toEqual({ column: { kind: "text" }, nullable: true });
    expect(Derive.classify(S.Struct({ a: S.String }), "j")).toEqual({
      column: { kind: "jsonb" },
      nullable: false,
    });
  });

  it("refuses ambiguous encodings loudly", () => {
    expect(() => Derive.classify(S.Unknown, "u")).toThrow();
    expect(() => Derive.classify(S.Union([S.String, S.Finite]), "mixed")).toThrow();
  });

  it("mirrors the compile-time model invariants at runtime", () => {
    expect(_needsExplicitColumn).toThrow();
    expect(_twoPrimaryKeys).toThrow();
  });
});

describe("model statics", () => {
  it("carries resolved bsl metadata", () => {
    expect(User.bsl.tableName).toBe("user");
    expect(User.bsl.columns["email"]?.column?.kind).toBe("varchar");
    expect(User.bsl.columns["orgId"]?.references?.tableName).toBe("organization");
    expect(User.bsl.columns["id"]?.references).toBeUndefined();
  });

  it("exposes the six variant statics", () => {
    expect(User.insert).toBeDefined();
    expect(User.update).toBeDefined();
    expect(User.json).toBeDefined();
    expect(User.jsonCreate).toBeDefined();
    expect(User.jsonUpdate).toBeDefined();
  });
});
