/**
 * Column derivation for bare schema fields.
 *
 * Policy (deliberately identical at the type level and at runtime — the v3
 * experiment's fatal flaw was two derivation algorithms that disagreed):
 *
 * - EntityId-like schemas (statics `tableName` + `entityType`, number-encoded)
 *   derive `integer`.
 * - Unambiguous carriers derive directly: string → text, boolean → boolean,
 *   bigint → bigint, object/array → jsonb.
 * - `number` derives `doublePrecision` — v4 checks are not type-visible, so
 *   `S.Int` cannot be distinguished from `S.Number` statically; integer
 *   columns are explicit (`pg.integer()`).
 * - Declarations (Date, Uint8Array, Option, …), heterogeneous unions, and
 *   everything else DO NOT derive: explicit column metadata is required.
 *   Ambiguity is a loud error, never a silent fallback.
 *
 * Nullability never derives a column: `Null` union members are stripped (they
 * feed `.notNull()` instead), and an encoded `Undefined` is rejected — SQL
 * absence must be represented as `null` in selected rows.
 */
import { $ScratchpadId } from "@beep/identity";
import { TaggedErrorClass } from "@beep/schema";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as AST from "effect/SchemaAST";
import { VariantSchema } from "effect/unstable/schema";
import type * as Field from "./Field.ts";
import type * as PgColumn from "./PgColumn.ts";

const $I = $ScratchpadId.create("bsl/derive");

export class DeriveColumnError extends TaggedErrorClass<DeriveColumnError>($I`DeriveColumnError`)(
  "DeriveColumnError",
  {
    message: S.String,
    fieldName: S.String,
    astTag: S.String,
  },
  $I.annote("DeriveColumnError", {
    description: "A bare schema field's column could not be derived from its encoded AST.",
  })
) {}

/**
 * Structural contract for EntityId schemas (matches the statics every
 * `EntityId.factory` codec carries). Number-encoded EntityId fields derive
 * `integer` columns and, at the factory level, a foreign-key reference.
 */
export interface EntityIdLike {
  readonly tableName: string;
  readonly entityType: string;
}

export const isEntityIdLike = (u: unknown): u is EntityIdLike =>
  P.hasProperty(u, "tableName") &&
  P.isString(u.tableName) &&
  P.hasProperty(u, "entityType") &&
  P.isString(u.entityType);

// ---------------------------------------------------------------------------
// Type-level derivation
// ---------------------------------------------------------------------------

type IsAny<T> = 0 extends 1 & T ? true : false;

/** The select-side schema of an Input's schema (variant fields contribute `select`). */
export type SelectSchemaOf<Sch> = Sch extends VariantSchema.Field<infer Config>
  ? Config extends { readonly select: infer Sel }
    ? Sel
    : never
  : Sch;

type DeriveFromEncoded<E> = IsAny<E> extends true
  ? never
  : [E] extends [never]
    ? never
    : [E] extends [string]
      ? PgColumn.Text
      : [E] extends [boolean]
        ? PgColumn.Bool
        : [E] extends [bigint]
          ? PgColumn.Bigint<"bigint">
          : [E] extends [number]
            ? PgColumn.DoublePrecision
            : [E] extends [Date]
              ? never // Declarations require explicit metadata (pg.timestamp)
              : [E] extends [Uint8Array]
                ? never // explicit pg.bytea
                : [E] extends [object]
                  ? PgColumn.Jsonb
                  : never;

/**
 * The column spec a bare Input derives, or `never` when derivation is
 * ambiguous and explicit metadata is required.
 */
export type Derived<I extends Field.Input> =
  SelectSchemaOf<Field.SchemaFrom<I>> extends EntityIdLike & { readonly tableName: infer TableName extends string }
    ? [Exclude<Field.EncodedOf<I>, null>] extends [number]
      ? PgColumn.Integer<PgColumn.EntityIdIdent<TableName>>
      : never
    : DeriveFromEncoded<Exclude<Field.EncodedOf<I>, null>>;

/** The column spec an Input resolves to: explicit metadata wins, else derivation. */
export type ResolvedColumn<I extends Field.Input> =
  Field.MetaFrom<I>["column"] extends PgColumn.Spec ? Field.MetaFrom<I>["column"] : Derived<I>;

// ---------------------------------------------------------------------------
// Runtime derivation (mirrors the type-level policy exactly)
// ---------------------------------------------------------------------------

/** The select-side schema of a field input's schema at runtime. */
export const selectSchemaOf = (schema: Field.AnySchema): S.Top => {
  if (VariantSchema.isField(schema)) {
    const select: unknown = (schema as VariantSchema.Field<any>).schemas["select"];
    if (P.hasProperty(select, "ast")) {
      return select as S.Top;
    }
    throw DeriveColumnError.make({
      message: "Variant field has no select schema; the select variant is the database row representation.",
      fieldName: "(unknown)",
      astTag: "VariantField",
    });
  }
  return schema;
};

interface Classified {
  readonly column: PgColumn.Spec;
  readonly nullable: boolean;
}

const fail = (fieldName: string, astTag: string, message: string): never => {
  throw DeriveColumnError.make({ message, fieldName, astTag });
};

const classifyNode = (node: AST.AST, fieldName: string, visited: WeakSet<object>): PgColumn.Spec => {
  switch (node._tag) {
    case "String":
    case "TemplateLiteral":
      return { kind: "text", ident: "text" };
    case "Boolean":
      return { kind: "boolean", ident: "boolean" };
    case "BigInt":
      return { kind: "bigint", ident: "bigint", mode: "bigint" };
    case "Number":
      return { kind: "doublePrecision", ident: "doublePrecision" };
    case "Literal": {
      const literal = node.literal;
      if (P.isString(literal)) return { kind: "text", ident: "text" };
      if (P.isNumber(literal)) return { kind: "doublePrecision", ident: "doublePrecision" };
      if (P.isBoolean(literal)) return { kind: "boolean", ident: "boolean" };
      return fail(fieldName, node._tag, `Literal of type ${typeof literal} cannot derive a column.`);
    }
    case "Enum":
      return { kind: "text", ident: "text" };
    case "Objects":
    case "Arrays":
      return { kind: "jsonb", ident: "jsonb" };
    case "Suspend": {
      if (visited.has(node)) {
        return fail(fieldName, node._tag, "Recursive schema cycle; provide explicit column metadata.");
      }
      visited.add(node);
      return classifyNode(node.thunk(), fieldName, visited);
    }
    default:
      return fail(
        fieldName,
        node._tag,
        `Encoded AST node '${node._tag}' does not derive a column; provide explicit metadata (e.g. pg.timestamp, pg.integer).`
      );
  }
};

/**
 * Derive `{ column, nullable }` for a field input from its encoded AST.
 * Explicit metadata should be consulted first; this is the bare-schema path
 * and the nullability oracle for both paths.
 */
export const classify = (schema: Field.AnySchema, fieldName: string): Classified => {
  const select = selectSchemaOf(schema);
  const encoded = AST.toEncoded(select.ast);
  const visited = new WeakSet<object>();

  const members: Array<AST.AST> = encoded._tag === "Union" ? [...encoded.types] : [encoded];
  let nullable = false;
  const rest: Array<AST.AST> = [];
  for (const member of members) {
    if (member._tag === "Null") {
      nullable = true;
    } else if (member._tag === "Undefined" || member._tag === "Void") {
      fail(fieldName, member._tag, "Encoded 'undefined' cannot reach a SQL row; represent absence as null.");
    } else {
      rest.push(member);
    }
  }
  if (rest.length === 0) {
    fail(fieldName, encoded._tag, "Only null remains after stripping; provide explicit column metadata.");
  }

  if (isEntityIdLike(select)) {
    const allNumbers = rest.every((member) => member._tag === "Number");
    if (allNumbers) {
      return {
        column: { kind: "integer", ident: `entityId<"${select.tableName}">` },
        nullable,
      };
    }
  }

  const specs = rest.map((member) => classifyNode(member, fieldName, visited));
  const first = specs[0]!;
  const agree = specs.every((spec) => spec.kind === first.kind);
  if (!agree) {
    fail(
      fieldName,
      "Union",
      `Union members derive different columns (${specs.map((spec) => spec.kind).join(", ")}); provide explicit metadata.`
    );
  }
  return { column: first, nullable };
};

/** Nullability of a field input's encoded select representation. */
export const isNullable = (schema: Field.AnySchema): boolean => {
  const select = selectSchemaOf(schema);
  const encoded = AST.toEncoded(select.ast);
  if (encoded._tag !== "Union") return encoded._tag === "Null";
  return encoded.types.some((member) => member._tag === "Null");
};
