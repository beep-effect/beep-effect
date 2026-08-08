/**
 * Postgres table projection: BSL model → real drizzle `pgTable`.
 *
 * The type side maps every field's resolved column spec + meta brands onto
 * rc4's actual builder classes (`PgBuilderBase`) wrapped in the `Set*` brand
 * intersections drizzle's model inference consumes. The runtime side is one
 * exhaustive dispatch producing real builders and delegating to the public
 * `pgTable` — so the result is query-builder- and drizzle-kit-equivalent to a
 * hand-written table.
 *
 * There is exactly ONE audited assertion (the dynamically-built builder record
 * → `BuildersOf<F>`), restoring the key/value correlation JavaScript object
 * construction erases; it is backed by the exhaustive dispatch and the type
 * fixtures.
 *
 * Round-one scope notes: DDL foreign keys are not emitted yet (references
 * metadata is recorded; emission needs cross-table wiring, arriving with the
 * `defineRelations` derivation), and per-column `unique()` is inline rather
 * than a named constraint.
 */
import { Str } from "@beep/utils";
import { type SQL, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  bytea,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type {
  PgBigInt53Builder,
  PgBigInt64Builder,
  PgBooleanBuilder,
  PgBuildColumns,
  PgByteaBuilder,
  PgDoublePrecisionBuilder,
  PgIntegerBuilder,
  PgJsonbBuilder,
  PgSerialBuilder,
  PgSmallIntBuilder,
  PgTableWithColumns,
  PgTextBuilder,
  PgTimestampBuilder,
  PgTimestampStringBuilder,
  PgUUIDBuilder,
  PgVarcharBuilder,
  Set$Type,
  SetHasDefault,
  SetHasGenerated,
  SetIdentity,
  SetIsPrimaryKey,
  SetNotNull,
} from "drizzle-orm/pg-core";
import * as Derive from "./derive.ts";
import * as Field from "./Field.ts";
import type * as Meta from "./Meta.ts";
import type * as PgColumn from "./PgColumn.ts";
import type { AnyModel, FieldsInput } from "./factory.ts";

// ---------------------------------------------------------------------------
// Type-level projection
// ---------------------------------------------------------------------------

type BuilderBase<C extends PgColumn.Spec> = C extends PgColumn.Varchar<number>
  ? PgVarcharBuilder
  : C extends PgColumn.Text
    ? PgTextBuilder
    : C extends PgColumn.Uuid
      ? PgUUIDBuilder
      : C extends PgColumn.Integer<"integer" | PgColumn.EntityIdIdent<string>>
        ? PgIntegerBuilder
        : C extends PgColumn.Smallint
          ? PgSmallIntBuilder
          : C extends PgColumn.Serial
            ? PgSerialBuilder
            : C extends PgColumn.Bigint<infer M>
              ? M extends "number"
                ? PgBigInt53Builder
                : PgBigInt64Builder
              : C extends PgColumn.DoublePrecision
                ? PgDoublePrecisionBuilder
                : C extends PgColumn.Bool
                  ? PgBooleanBuilder
                  : C extends PgColumn.Jsonb
                    ? PgJsonbBuilder
                    : C extends PgColumn.Timestamp<infer M>
                      ? M extends "date"
                        ? PgTimestampBuilder
                        : PgTimestampStringBuilder
                      : C extends PgColumn.Bytea
                        ? PgByteaBuilder
                        : never;

type NullableOf<I extends Field.Input> = null extends Field.EncodedOf<I> ? true : false;

type ApplyNotNull<B, Nullable extends boolean> = Nullable extends true ? B : SetNotNull<B>;
type ApplyPrimaryKey<B, M extends Meta.Meta> = M["primaryKey"] extends true ? SetIsPrimaryKey<B> : B;
type ApplyDefault<B, M extends Meta.Meta> = M["hasDefault"] extends true ? SetHasDefault<B> : B;
type ApplyGenerated<B, M extends Meta.Meta> = M["generated"] extends { readonly _tag: "sqlExpr" | "unsafeSql" }
  ? SetHasGenerated<B>
  : B;
type ApplyIdentity<B, M extends Meta.Meta> = M["identity"] extends "always" | "byDefault"
  ? SetIdentity<B, M["identity"]>
  : B;

/** The exact drizzle builder type a field compiles to. */
export type BuilderFor<I extends Field.Input> = ApplyPrimaryKey<
  ApplyIdentity<
    ApplyGenerated<
      ApplyDefault<
        ApplyNotNull<
          Set$Type<BuilderBase<Derive.ResolvedColumn<I>>, Exclude<Field.EncodedOf<I>, null>>,
          NullableOf<I>
        >,
        Field.MetaFrom<I>
      >,
      Field.MetaFrom<I>
    >,
    Field.MetaFrom<I>
  >,
  Field.MetaFrom<I>
>;

export type BuildersOf<F extends FieldsInput> = {
  readonly [K in keyof F & string]: BuilderFor<F[K]>;
};

/** The drizzle table type a BSL model projects to. */
export type TableOf<M extends AnyModel> = PgTableWithColumns<{
  name: string;
  schema: undefined;
  columns: PgBuildColumns<string, BuildersOf<M["bsl"]["fields"]>>;
  dialect: "pg";
}>;

// ---------------------------------------------------------------------------
// Runtime projection
// ---------------------------------------------------------------------------

/**
 * Minimal structural view of a pg builder's fluent surface. The abstract
 * `PgColumnBuilder` class is unusable as a working type (its `$default`
 * member's function parameter is contravariant per concrete data type), so
 * runtime code narrows to exactly the methods it calls — every concrete
 * builder satisfies this structurally.
 */
interface FluentPgBuilder {
  notNull(): FluentPgBuilder;
  primaryKey(): FluentPgBuilder;
  unique(name?: string): FluentPgBuilder;
  default(value: unknown): FluentPgBuilder;
  generatedAlwaysAs(value: SQL): FluentPgBuilder;
}

const applyIdentity = (
  builder: PgIntegerBuilder | PgSmallIntBuilder | PgBigInt53Builder | PgBigInt64Builder,
  kind: "always" | "byDefault"
): FluentPgBuilder =>
  kind === "always" ? builder.generatedAlwaysAsIdentity() : builder.generatedByDefaultAsIdentity();

const baseBuilder = (spec: PgColumn.Spec, name: string, identity: Meta.Identity): FluentPgBuilder => {
  switch (spec.kind) {
    case "text":
      return text(name);
    case "varchar":
      return varchar(name, { length: spec.length });
    case "uuid":
      return uuid(name);
    case "integer": {
      const b = integer(name);
      return identity === false ? b : applyIdentity(b, identity);
    }
    case "smallint": {
      const b = smallint(name);
      return identity === false ? b : applyIdentity(b, identity);
    }
    case "bigint": {
      const b = spec.mode === "number" ? bigint(name, { mode: "number" }) : bigint(name, { mode: "bigint" });
      return identity === false ? b : applyIdentity(b, identity);
    }
    case "serial":
      return serial(name);
    case "doublePrecision":
      return doublePrecision(name);
    case "boolean":
      return boolean(name);
    case "jsonb":
      return jsonb(name);
    case "timestamp":
      return spec.mode === "date"
        ? timestamp(name, { mode: "date", withTimezone: spec.withTimezone })
        : timestamp(name, { mode: "string", withTimezone: spec.withTimezone });
    case "bytea":
      return bytea(name);
  }
};

const buildColumn = (key: string, meta: Meta.Meta, nullable: boolean): FluentPgBuilder => {
  const spec = meta.column;
  if (spec === undefined) {
    throw Derive.DeriveColumnError.make({
      message: `Column for '${key}' was not resolved before projection.`,
      fieldName: key,
      astTag: "(resolved)",
    });
  }
  const name = meta.columnName ?? Str.snakeCase(key);
  let builder = baseBuilder(spec, name, meta.identity);
  if (!nullable) builder = builder.notNull();
  if (meta.primaryKey) builder = builder.primaryKey();
  if (meta.unique) builder = builder.unique();
  if (meta.default !== undefined) {
    switch (meta.default._tag) {
      case "value":
        builder = builder.default(meta.default.value);
        break;
      case "sqlExpr":
        builder = builder.default(meta.default.expression);
        break;
      case "now":
        builder = builder.default(sql`now()`);
        break;
      case "unsafeSql":
        builder = builder.default(sql.raw(meta.default.sql));
        break;
    }
  }
  if (meta.generated !== false && meta.generated._tag !== "identityAlways") {
    builder = builder.generatedAlwaysAs(
      meta.generated._tag === "sqlExpr" ? meta.generated.expression : sql.raw(meta.generated.sql)
    );
  }
  return builder;
};

/** Project a BSL model class into a fully-typed drizzle pg table. */
export const toPgTable = <M extends AnyModel>(model: M): TableOf<M> => {
  const builders: Record<string, FluentPgBuilder> = {};
  for (const key of Object.keys(model.bsl.fields)) {
    const f = Field.from(model.bsl.fields[key]!);
    const meta = model.bsl.columns[key]!;
    builders[key] = buildColumn(key, meta, Derive.isNullable(f.schema));
  }
  // Audited boundary: builders is keywise BuilderFor of the model's fields —
  // the exhaustive dispatch above implements exactly the BuilderFor
  // conditional type; JavaScript record construction erases the correlation.
  return pgTable(model.bsl.tableName, builders as unknown as BuildersOf<M["bsl"]["fields"]>) as TableOf<M>;
};
