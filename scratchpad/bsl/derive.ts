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
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { thunkFalse, thunkTrue } from "@beep/utils";
import { flow, Match, Struct } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as AST from "effect/SchemaAST";
import { VariantSchema } from "effect/unstable/schema";
import type * as Field from "./Field.ts";
import * as PgColumn from "./PgColumn.ts";

const $I = $ScratchpadId.create("bsl/derive");

/**
 * Error raised when an encoded schema AST cannot determine one SQL column.
 *
 * **Example** (Construct a derivation error)
 *
 * ```ts
 * import { DeriveColumnError } from "./derive.ts"
 *
 * const error = DeriveColumnError.make({ message: "ambiguous", fieldName: "value", astTag: "Union" })
 * console.log(error._tag) // "DeriveColumnError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DeriveColumnError extends TaggedErrorClass<DeriveColumnError>(
  $I`DeriveColumnError`
)(
  "DeriveColumnError",
  {
    message: S.String,
    fieldName: S.String,
    astTag: S.String,
  },
  $I.annote("DeriveColumnError", {
    description:
      "A bare schema field's column could not be derived from its encoded AST.",
  })
) {}

type EntityIdLikeShape = {
  readonly tableName: string;
  readonly entityType: string;
};

const isNonEmptyString = S.is(S.NonEmptyString);

/**
 * Structural contract for the statics carried by EntityId schemas.
 *
 * **Details**
 *
 * Number-encoded EntityId fields derive integer columns and automatic
 * foreign-key references.
 *
 * **Example** (Recognize EntityId statics)
 *
 * ```ts
 * import { EntityIdLike } from "./derive.ts"
 *
 * console.log(EntityIdLike.is({ tableName: "user", entityType: "User" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EntityIdLike = S.declare<EntityIdLikeShape>(
  (input): input is EntityIdLikeShape =>
    P.hasProperty(input, "tableName") &&
    isNonEmptyString(input.tableName) &&
    P.hasProperty(input, "entityType") &&
    isNonEmptyString(input.entityType)
).pipe(
  $I.annoteSchema("EntityIdLike", {
    description: "Static identity metadata carried by an EntityId schema.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded static identity metadata recognized by {@link EntityIdLike}.
 *
 * @category models
 * @since 0.0.0
 */
export type EntityIdLike = typeof EntityIdLike.Type;

/**
 * Tests unknown input for the EntityId static metadata contract.
 *
 * **Example** (Reject incomplete metadata)
 *
 * ```ts
 * import { isEntityIdLike } from "./derive.ts"
 *
 * console.log(isEntityIdLike({ tableName: "user" })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isEntityIdLike = EntityIdLike.is;

// ---------------------------------------------------------------------------
// Type-level derivation
// ---------------------------------------------------------------------------

type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Select-side schema type of an input; variant fields contribute `select`.
 *
 * @category models
 * @since 0.0.0
 */
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
 *
 * @category models
 * @since 0.0.0
 */
export type Derived<I extends Field.Input> = SelectSchemaOf<
  Field.SchemaFrom<I>
> extends EntityIdLike & {
  readonly tableName: infer TableName extends string;
}
  ? [Exclude<Field.EncodedOf<I>, null>] extends [number]
    ? PgColumn.Integer<PgColumn.EntityIdIdent<TableName>>
    : never
  : DeriveFromEncoded<Exclude<Field.EncodedOf<I>, null>>;

/**
 * Column descriptor an input resolves to: explicit metadata wins, then derivation.
 *
 * @category models
 * @since 0.0.0
 */
export type ResolvedColumn<I extends Field.Input> =
  Field.MetaFrom<I>["column"] extends PgColumn.Spec
    ? Field.MetaFrom<I>["column"]
    : Derived<I>;

// ---------------------------------------------------------------------------
// Runtime derivation (mirrors the type-level policy exactly)
// ---------------------------------------------------------------------------

/**
 * Return the select-side schema used as the database representation.
 *
 * **Example** (Select a plain schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { selectSchemaOf } from "./derive.ts"
 *
 * console.log(selectSchemaOf(S.String) === S.String) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const selectSchemaOf = (schema: Field.AnySchema): S.Top => {
  if (VariantSchema.isField(schema)) {
    const select: unknown = schema.schemas["select"];
    if (S.isSchema(select)) return select;
    throw DeriveColumnError.make({
      message:
        "Variant field has no select schema; the select variant is the database row representation.",
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

/**
 * Derive `{ column, nullable }` for a field input from its encoded AST.
 * Explicit metadata should be consulted first; this is the bare-schema path
 * and the nullability oracle for both paths.
 *
 * **Example** (Classify a nullable string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { classify } from "./derive.ts"
 *
 * console.log(classify(S.NullOr(S.String), "bio").nullable) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const classify = (
  schema: Field.AnySchema,
  fieldName: string
): Classified => {
  const select = selectSchemaOf(schema);
  const encoded = AST.toEncoded(select.ast);
  const members = P.isTagged(encoded, "Union") ? encoded.types : A.of(encoded);
  const invalidAbsence = A.findFirst(
    members,
    P.or(P.isTagged("Undefined"), P.isTagged("Void"))
  );
  if (O.isSome(invalidAbsence)) {
    fail(
      fieldName,
      invalidAbsence.value._tag,
      "Encoded 'undefined' cannot reach a SQL row; represent absence as null."
    );
  }
  const nullable = A.some(members, P.isTagged("Null"));
  const rest = A.filter(members, P.not(P.isTagged("Null")));

  if (A.isArrayEmpty(rest)) {
    fail(
      fieldName,
      encoded._tag,
      "Only null remains after stripping; provide explicit column metadata."
    );
  }

  if (isEntityIdLike(select)) {
    const allNumbers = A.every(rest, P.isTagged("Number"));
    if (allNumbers) {
      return {
        column: PgColumn.Integer.make({
          ident: `entityId<"${select.tableName}">`,
        }),
        nullable,
      };
    }
  }

  const specs = A.map(rest, (member) =>
    O.getOrElse(PgColumn.Spec.fromSchemaAST(member), () =>
      fail(
        fieldName,
        member._tag,
        `Encoded AST node '${member._tag}' does not derive a column; provide explicit metadata (e.g. pg.timestamp, pg.integer).`
      )
    )
  );
  const first = A.head(specs).pipe(
    O.getOrElse(() =>
      fail(
        fieldName,
        encoded._tag,
        "No encoded members remain after null stripping."
      )
    )
  );
  const agree = A.every(specs, P.Struct({ kind: Eq.equals(first.kind) }));
  if (!agree) {
    fail(
      fieldName,
      "Union",
      `Union members derive different columns (${A.join(
        A.map(specs, (spec) => spec.kind),
        ", "
      )}); provide explicit metadata.`
    );
  }
  return { column: first, nullable };
};

/**
 * Test nullability of a field input's encoded select representation.
 *
 * **Example** (Detect encoded nullability)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { isNullable } from "./derive.ts"
 *
 * console.log(isNullable(S.NullOr(S.String))) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isNullable = flow(
  selectSchemaOf,
  flow(Struct.get("ast"), AST.toEncoded),
  Match.type<AST.AST>().pipe(
    Match.withReturnType<boolean>(),
    Match.tags({
      Union: P.Struct({
        types: A.some(P.isTagged("Null")),
      }),
      Null: thunkTrue,
    }),
    Match.orElse(thunkFalse)
  )
);

const stringLiteralsFromAST = (
  node: AST.AST,
  visited: ReadonlyArray<AST.Suspend> = A.empty()
): O.Option<ReadonlyArray<string>> =>
  Match.type<AST.AST>().pipe(
    Match.withReturnType<O.Option<ReadonlyArray<string>>>(),
    Match.tags({
      Literal: ({ literal }) =>
        P.isString(literal) ? O.some(A.of(literal)) : O.none(),
      Null: () => O.some(A.empty()),
      Enum: ({ enums }) =>
        A.every(enums, ([, value]) => P.isString(value))
          ? O.some(
              A.getSomes(
                A.map(enums, ([, value]) =>
                  P.isString(value) ? O.some(value) : O.none()
                )
              )
            )
          : O.none(),
      Union: ({ types }) =>
        A.reduce(
          types,
          O.some<ReadonlyArray<string>>(A.empty()),
          (values, member) =>
            O.flatMap(values, (current) =>
              O.map(stringLiteralsFromAST(member, visited), (next) =>
                A.appendAll(current, next)
              )
            )
        ),
      Suspend: (suspend) =>
        A.some(visited, Eq.equals(suspend))
          ? O.none()
          : stringLiteralsFromAST(suspend.thunk(), A.append(visited, suspend)),
    }),
    Match.orElse(() => O.none())
  )(node);

/**
 * Collect a finite non-empty union of encoded string literals.
 *
 * **Details**
 *
 * Nullable literal schemas are accepted after stripping `null`; broad strings,
 * templates, and mixed literal families return `None`.
 *
 * **Example** (Collect enum values)
 *
 * ```ts
 * import { LiteralKit } from "@beep/schema"
 * import { stringLiteralValues } from "./derive.ts"
 *
 * console.log(stringLiteralValues(LiteralKit(["draft", "active"])).pipe)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const stringLiteralValues = (
  schema: Field.AnySchema
): O.Option<readonly [string, ...string[]]> =>
  O.flatMap(
    stringLiteralsFromAST(AST.toEncoded(selectSchemaOf(schema).ast)),
    (values) =>
      A.match(values, {
        onEmpty: O.none,
        onNonEmpty: O.some,
      })
  );

const maxLengthFromCheck = (
  check: AST.Check<unknown>
): ReadonlyArray<number> => {
  const representation = check.annotations?.representation;
  const current =
    representation?.id === "effect/schema/isMaxLength" &&
    P.hasProperty(representation.payload, "maxLength") &&
    P.isNumber(representation.payload.maxLength)
      ? A.of(representation.payload.maxLength)
      : A.empty<number>();
  return P.isTagged(check, "FilterGroup")
    ? A.appendAll(current, A.flatMap(check.checks, maxLengthFromCheck))
    : current;
};

const collectMaxLengths: {
  (visited: ReadonlyArray<AST.AST>): (node: AST.AST) => ReadonlyArray<number>;
  (node: AST.AST, visited: ReadonlyArray<AST.AST>): ReadonlyArray<number>;
} = dual(
  2,
  (node: AST.AST, visited: ReadonlyArray<AST.AST>): ReadonlyArray<number> => {
    if (A.some(visited, Eq.equals(node))) return A.empty();
    const nextVisited = A.append(visited, node);
    const collectNested = collectMaxLengths(nextVisited);
    const checks = O.fromUndefinedOr(node.checks).pipe(
      O.map(A.flatMap(maxLengthFromCheck)),
      O.getOrElse(A.empty<number>)
    );
    const encodings = O.fromUndefinedOr(node.encoding).pipe(
      O.map(A.flatMap((link) => collectNested(link.to))),
      O.getOrElse(A.empty<number>)
    );
    const nested = Match.type<AST.AST>().pipe(
      Match.withReturnType<ReadonlyArray<number>>(),
      Match.tags({
        Union: ({ types }) => A.flatMap(types, collectNested),
        Suspend: (suspend) => collectNested(suspend.thunk()),
        Declaration: ({ typeParameters }) =>
          A.flatMap(typeParameters, collectNested),
      }),
      Match.orElse(A.empty<number>)
    )(node);
    return A.appendAll(A.appendAll(checks, encodings), nested);
  }
);

/**
 * Collect every installed `S.isMaxLength` bound on the encoded select schema.
 *
 * **Example** (Read a maximum length)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { maxLengths } from "./derive.ts"
 *
 * console.log(maxLengths(S.String.check(S.isMaxLength(50)))) // [50]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const maxLengths = flow(
  selectSchemaOf,
  flow(Struct.get("ast"), AST.toEncoded),
  collectMaxLengths(A.empty())
);
