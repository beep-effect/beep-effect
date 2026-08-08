/**
 * Postgres column spec algebra.
 *
 * A discriminated union describing WHICH drizzle pg builder a column compiles
 * to, with each member carrying its literal config. `toDrizzle` maps every
 * member onto the matching `drizzle-orm/pg-core` builder both at the type
 * level (`PgBuilderBase`) and at runtime — one exhaustive dispatch each,
 * cross-checked by fixtures.
 *
 * Round-one vocabulary covers the column kinds the current EntityTable
 * projector emits plus the ones the fixtures need; extending it is mechanical
 * (add a member, extend both dispatches — the compiler enforces both).
 */

/** PostgreSQL storage identity, distinct from the TypeScript carrier. */
export type DbIdent =
  | "text"
  | "varchar"
  | "uuid"
  | "integer"
  | "smallint"
  | "bigint"
  | "doublePrecision"
  | "boolean"
  | "jsonb"
  | "timestamp"
  | "timestamptz"
  | "bytea"
  | `entityId<"${string}">`;

/** SQL identity used by a number-encoded EntityId belonging to `TableName`. */
export type EntityIdIdent<TableName extends string> = `entityId<"${TableName}">`;

export interface Text {
  readonly kind: "text";
  readonly ident: "text";
}

export interface Varchar<L extends number = number> {
  readonly kind: "varchar";
  readonly ident: "varchar";
  readonly length: L;
}

export interface Uuid {
  readonly kind: "uuid";
  readonly ident: "uuid";
}

export interface Integer<I extends "integer" | EntityIdIdent<string> = "integer"> {
  readonly kind: "integer";
  readonly ident: I;
}

export interface Smallint {
  readonly kind: "smallint";
  readonly ident: "smallint";
}

export interface Bigint<M extends "number" | "bigint" = "number" | "bigint"> {
  readonly kind: "bigint";
  readonly ident: "bigint";
  readonly mode: M;
}

export interface Serial {
  readonly kind: "serial";
  readonly ident: "integer";
}

export interface DoublePrecision {
  readonly kind: "doublePrecision";
  readonly ident: "doublePrecision";
}

export interface Bool {
  readonly kind: "boolean";
  readonly ident: "boolean";
}

export interface Jsonb {
  readonly kind: "jsonb";
  readonly ident: "jsonb";
}

export interface Timestamp<
  M extends "date" | "string" = "date" | "string",
  TZ extends boolean = boolean,
> {
  readonly kind: "timestamp";
  readonly ident: TZ extends true ? "timestamptz" : "timestamp";
  readonly mode: M;
  readonly withTimezone: TZ;
}

export interface Bytea {
  readonly kind: "bytea";
  readonly ident: "bytea";
}

export type Spec =
  | Text
  | Varchar
  | Uuid
  | Integer<"integer" | EntityIdIdent<string>>
  | Smallint
  | Bigint
  | Serial
  | DoublePrecision
  | Bool
  | Jsonb
  | Timestamp
  | Bytea;

export type Kind = Spec["kind"];

/** The structural PostgreSQL identity carried by a column spec. */
export type IdentOf<C extends Spec> = C["ident"];

/** Bidirectional literal equality used by foreign-key validation. */
export type IdentEquals<A extends Spec, B extends Spec> = [IdentOf<A>] extends [IdentOf<B>]
  ? [IdentOf<B>] extends [IdentOf<A>]
    ? true
    : false
  : false;

/** Column kinds that may carry pg identity generation. */
export type IdentityKind = "integer" | "smallint" | "bigint";

/** The TS carrier type a spec stores, used to cross-check schema Encoded compatibility. */
export type CarrierOf<C extends Spec> = C extends Text | Varchar | Uuid
  ? string
  : C extends Integer<"integer" | EntityIdIdent<string>> | Smallint | Serial | DoublePrecision
    ? number
    : C extends Bigint<infer M>
      ? M extends "number"
        ? number
        : bigint
      : C extends Bool
        ? boolean
        : C extends Timestamp<infer M>
          ? M extends "date"
            ? Date
            : string
          : C extends Jsonb
            ? object
            : C extends Bytea
              ? Uint8Array
              : never;

/** Runtime mirror of {@link CarrierOf}, used while assembling foreign keys. */
export type CarrierTag = "string" | "number" | "bigint" | "boolean" | "object" | "date" | "bytes";

export const carrierTag = (spec: Spec): CarrierTag => {
  switch (spec.kind) {
    case "text":
    case "varchar":
    case "uuid":
      return "string";
    case "integer":
    case "smallint":
    case "serial":
    case "doublePrecision":
      return "number";
    case "bigint":
      return spec.mode;
    case "boolean":
      return "boolean";
    case "jsonb":
      return "object";
    case "timestamp":
      return spec.mode;
    case "bytea":
      return "bytes";
  }
};
