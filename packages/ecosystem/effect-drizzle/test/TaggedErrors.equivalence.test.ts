import { ModelInvariantError, VersionConflictError } from "@beep/effect-drizzle";
import * as pg from "@beep/effect-drizzle/pg";
import * as sqlite from "@beep/effect-drizzle/sqlite";
import { describe, expect, it } from "@effect/vitest";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { _needsExplicitColumn, _pgEmptyColumnName, _pgParameterizedDefault, _pgVarcharTooWide } from "./fixtures.ts";
import { SqliteOrganization, SqliteUser, sqliteKit } from "./sqlite-fixtures.ts";

const captureError = (run: () => unknown): unknown => {
  try {
    run();
    return undefined;
  } catch (error) {
    return error;
  }
};

const expectCapturedDeclaredEquivalence = (captured: unknown, equalFields: object, differentFields: object): void => {
  const constructor = P.hasProperty(captured, "constructor") ? captured.constructor : undefined;
  const make = P.hasProperty(constructor, "make") ? constructor.make : undefined;
  expect(S.isSchema(constructor)).toBe(true);
  expect(P.isFunction(make)).toBe(true);

  if (S.isSchema(constructor) && P.isFunction(make)) {
    const a = Reflect.apply(make, constructor, [equalFields]);
    const b = Reflect.apply(make, constructor, [equalFields]);
    const different = Reflect.apply(make, constructor, [differentFields]);
    const same = S.toEquivalence(constructor);
    expect(same(a, b)).toBe(true);
    expect(same(a, different)).toBe(false);
  }
};

const captureSqliteColumnInvariant = (): unknown => {
  const column = SqliteUser.sql.columns.organizationId;
  const dimensions = column.dimensions;
  Reflect.set(column, "dimensions", 1);
  const error = captureError(() =>
    sqliteKit.schema({ shared_organization: SqliteOrganization, shared_user: SqliteUser })
  );
  Reflect.set(column, "dimensions", dimensions);
  return error;
};

describe("effect-drizzle declared-field equivalence", () => {
  it("compares SqlExpressionError captured from public expression validation", () => {
    const captured = captureError(_pgParameterizedDefault);

    expectCapturedDeclaredEquivalence(
      captured,
      { message: "bound parameters", context: "default" },
      { message: "bound parameters", context: "generated" }
    );
  });

  it("compares DeriveColumnError captured from public derivation", () => {
    const captured = captureError(_needsExplicitColumn);

    expectCapturedDeclaredEquivalence(
      captured,
      { message: "explicit column required", fieldName: "createdAt", astTag: "Declaration" },
      { message: "explicit column required", fieldName: "updatedAt", astTag: "Declaration" }
    );
  });

  it("compares ModelInvariantError by fields", () => {
    const a = ModelInvariantError.make({ message: "invalid", fieldName: "id" });
    const b = ModelInvariantError.make({ message: "invalid", fieldName: "id" });
    const different = ModelInvariantError.make({ message: "invalid", fieldName: "version" });
    const same = S.toEquivalence(ModelInvariantError);

    expect(same(a, b)).toBe(true);
    expect(same(a, different)).toBe(false);
  });

  it("compares SqlNameError captured from public name validation", () => {
    const captured = captureError(_pgEmptyColumnName);

    expectCapturedDeclaredEquivalence(
      captured,
      { message: "invalid name", name: "bad", surface: "column" },
      { message: "invalid name", name: "other", surface: "column" }
    );
  });

  it("compares VersionConflictError by stable fields and ignores opaque id", () => {
    const a = VersionConflictError.make({ table: "users", id: { value: 1 }, expectedVersion: 2 });
    const b = VersionConflictError.make({ table: "users", id: { value: 1 }, expectedVersion: 2 });
    const different = VersionConflictError.make({ table: "users", id: { value: 1 }, expectedVersion: 3 });
    const differentId = VersionConflictError.make({ table: "users", id: { value: 99 }, expectedVersion: 2 });
    const same = S.toEquivalence(VersionConflictError);

    expect(same(a, b)).toBe(true);
    expect(same(a, different)).toBe(false);
    expect(same(a, differentId)).toBe(true);
  });

  it("compares PostgreSQL ColumnInvariantError captured from public column validation", () => {
    const captured = captureError(_pgVarcharTooWide);

    expectCapturedDeclaredEquivalence(captured, { message: "invalid column" }, { message: "different column" });
  });

  it("compares PostgreSQL TableExtraError by fields", () => {
    const a = pg.Table.TableExtraError.make({ message: "invalid extra" });
    const b = pg.Table.TableExtraError.make({ message: "invalid extra" });
    const different = pg.Table.TableExtraError.make({ message: "different extra" });
    const same = S.toEquivalence(pg.Table.TableExtraError);

    expect(same(a, b)).toBe(true);
    expect(same(a, different)).toBe(false);
  });

  it("compares PostgreSQL SchemaAssemblyError by fields", () => {
    const a = pg.SchemaAssemblyError.make({
      message: "missing target",
      sourceTable: "users",
      fieldName: "orgId",
      targetTable: "organizations",
    });
    const b = pg.SchemaAssemblyError.make({
      message: "missing target",
      sourceTable: "users",
      fieldName: "orgId",
      targetTable: "organizations",
    });
    const different = pg.SchemaAssemblyError.make({
      message: "missing target",
      sourceTable: "users",
      fieldName: "teamId",
      targetTable: "organizations",
    });
    const same = S.toEquivalence(pg.SchemaAssemblyError);

    expect(same(a, b)).toBe(true);
    expect(same(a, different)).toBe(false);
  });

  it("compares SQLite TableExtraError by fields", () => {
    const a = sqlite.Table.TableExtraError.make({ message: "invalid extra" });
    const b = sqlite.Table.TableExtraError.make({ message: "invalid extra" });
    const different = sqlite.Table.TableExtraError.make({ message: "different extra" });
    const same = S.toEquivalence(sqlite.Table.TableExtraError);

    expect(same(a, b)).toBe(true);
    expect(same(a, different)).toBe(false);
  });

  it("compares SQLite ColumnInvariantError captured from public schema assembly", () => {
    const captured = captureSqliteColumnInvariant();

    expectCapturedDeclaredEquivalence(captured, { message: "invalid column" }, { message: "different column" });
  });

  it("compares SQLite SchemaAssemblyError by fields", () => {
    const a = sqlite.SchemaAssemblyError.make({
      message: "missing target",
      sourceTable: "users",
      fieldName: "orgId",
      targetTable: "organizations",
    });
    const b = sqlite.SchemaAssemblyError.make({
      message: "missing target",
      sourceTable: "users",
      fieldName: "orgId",
      targetTable: "organizations",
    });
    const different = sqlite.SchemaAssemblyError.make({
      message: "missing target",
      sourceTable: "users",
      fieldName: "teamId",
      targetTable: "organizations",
    });
    const same = S.toEquivalence(sqlite.SchemaAssemblyError);

    expect(same(a, b)).toBe(true);
    expect(same(a, different)).toBe(false);
  });
});
