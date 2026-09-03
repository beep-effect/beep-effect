/**
 * Shared type-level and runtime SQL naming invariants.
 *
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import { String as StringSchema, TaggedError } from "effect/Schema";
import { declaredFieldsEquivalence } from "./declaredFieldsEquivalence.ts";

/**
 * Compile-time diagnostic carrier exposed by SQL naming validation.
 * @category type-level
 * @since 0.0.0
 */
interface BslTypeError<Message extends string> {
  readonly "~effect-drizzle.error": Message;
}

type LowerStart =
  | "_"
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

type NameViolation =
  | `${string}${" " | "\t" | "\n" | "\r"}${string}`
  | `${string}${"'" | '"' | "-" | "."}${string}`
  | `${string}\0${string}`
  | `${string}_`;

/**
 * Cached, message-free predicate used by public SQL-name validation types.
 * @category type-level
 * @since 0.0.0
 */
type IsValidSqlName<Name extends string> = string extends Name
  ? true
  : Name extends unknown
    ? Lowercase<Name> extends Name
      ? Name extends `${LowerStart}${string}`
        ? Name extends NameViolation
          ? false
          : true
        : false
      : false
    : false;

/**
 * Adds a surface-specific diagnostic without changing the validation cache key.
 * @category type-level
 * @since 0.0.0
 */
export type ValidateSqlName<Name extends string, Message extends string> = string extends Name
  ? unknown
  : IsValidSqlName<Name> extends true
    ? unknown
    : BslTypeError<Message>;

type IdentifierTail<Identifier extends string> = Identifier extends `${string}/${infer Tail}` ? Tail : Identifier;

/**
 * Validates the lowercase approximation of a model's derived table name.
 * @category type-level
 * @since 0.0.0
 */
export type ValidateDerivedSqlName<Identifier extends string, Message extends string> = string extends Identifier
  ? unknown
  : ValidateSqlName<Lowercase<IdentifierTail<Identifier>>, Message>;

/**
 * Runtime SQL-name validation failure.
 * @internal
 * @category errors
 * @since 0.0.0
 */
class SqlNameError extends TaggedError<SqlNameError>("@beep/effect-drizzle/SqlNameError")(
  "SqlNameError",
  {
    message: StringSchema,
    name: StringSchema,
    surface: StringSchema,
  },
  {
    description: "A SQL identifier or enum label violates a dialect naming invariant.",
    toEquivalence: (typeParameters) => declaredFieldsEquivalence<SqlNameError>(typeParameters),
  }
) {}

/**
 * SQL dialects with naming rules implemented by this module.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type Dialect = "pg" | "sqlite";

const encoder = new TextEncoder();

/**
 * UTF-8 byte length used by PostgreSQL NAMEDATALEN checks.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
const utf8ByteLength = (value: string): number => encoder.encode(value).byteLength;

/**
 * Return the complete runtime identifier violation, if any.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const sqlNameIssue: {
  (dialect: Dialect): (name: string) => string | undefined;
  (name: string, dialect: Dialect): string | undefined;
} = dual(2, (name: string, dialect: Dialect): string | undefined => {
  if (name.length === 0) return "must not be empty";
  if (name.includes("\0")) return "must not contain NUL (U+0000)";
  if (!/^[_a-z][_a-z0-9]*$/.test(name) || name.endsWith("_")) {
    return "must start with '_' or a lowercase letter, contain only lowercase letters, digits, and underscores, and not end with '_'";
  }
  if (dialect === "pg" && utf8ByteLength(name) > 63) return "must be at most 63 UTF-8 bytes";
  return undefined;
});

/**
 * Return the PostgreSQL enum-label violation, preserving the valid empty label.
 * @internal
 * @category validation
 * @since 0.0.0
 */
const pgEnumLabelIssue = (label: string): string | undefined => {
  if (label.includes("\0")) return "must not contain NUL (U+0000)";
  return utf8ByteLength(label) > 63 ? "must be at most 63 UTF-8 bytes" : undefined;
};

const pgTruncationPrefix = (name: string): string => {
  let prefix = "";
  for (const character of name) {
    const candidate = `${prefix}${character}`;
    if (utf8ByteLength(candidate) > 63) return prefix;
    prefix = candidate;
  }
  return prefix;
};

/**
 * Database-comparison key after dialect folding and PostgreSQL byte truncation.
 * @internal
 * @category normalization
 * @since 0.0.0
 */
const canonicalSqlName = (name: string, dialect: Dialect): string => {
  const folded = name.toLowerCase();
  return dialect === "pg" ? pgTruncationPrefix(folded) : folded;
};

/**
 * Throw the shared tagged name error for a runtime identifier violation.
 * @internal
 * @category assertions
 * @since 0.0.0
 */
export const assertSqlName: {
  (dialect: Dialect, surface: string): (name: string) => void;
  (name: string, dialect: Dialect, surface: string): void;
} = dual(3, (name: string, dialect: Dialect, surface: string): void => {
  const issue = sqlNameIssue(name, dialect);
  if (issue !== undefined) {
    throw SqlNameError.make({ message: `${surface} '${name}' ${issue}.`, name, surface });
  }
});

/**
 * Throw the shared tagged name error for a PostgreSQL enum-label violation.
 * @internal
 * @category assertions
 * @since 0.0.0
 */
export const assertPgEnumLabel = (label: string): void => {
  const issue = pgEnumLabelIssue(label);
  if (issue !== undefined) {
    throw SqlNameError.make({
      message: `PostgreSQL enum label '${label}' ${issue}.`,
      name: label,
      surface: "enum label",
    });
  }
};

/**
 * One collision after dialect normalization.
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface SqlNameCollision {
  readonly canonical: string;
  readonly firstOwner: string;
  readonly name: string;
  readonly secondOwner: string;
}

type SqlNameEntries = ReadonlyArray<readonly [owner: string, name: string]>;

/**
 * Find the first case-fold, snake-case, or PostgreSQL truncation-prefix collision.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const findSqlNameCollision: {
  (dialect: Dialect): (entries: SqlNameEntries) => SqlNameCollision | undefined;
  (entries: SqlNameEntries, dialect: Dialect): SqlNameCollision | undefined;
} = dual(2, (entries: SqlNameEntries, dialect: Dialect): SqlNameCollision | undefined => {
  const seen = new Map<string, readonly [owner: string, name: string]>();
  for (const [owner, name] of entries) {
    const canonical = canonicalSqlName(name, dialect);
    const previous = seen.get(canonical);
    if (previous !== undefined) {
      return {
        firstOwner: previous[0],
        secondOwner: owner,
        name,
        canonical,
      };
    }
    seen.set(canonical, [owner, name]);
  }
  return undefined;
});

/**
 * Validate names and reject their normalized dialect collision keys.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const assertUniqueSqlNames: {
  (dialect: Dialect, surface: string): (entries: SqlNameEntries) => void;
  (entries: SqlNameEntries, dialect: Dialect, surface: string): void;
} = dual(3, (entries: SqlNameEntries, dialect: Dialect, surface: string): void => {
  const collision = findSqlNameCollision(entries, dialect);
  if (collision !== undefined) {
    throw SqlNameError.make({
      message: `${surface} '${collision.secondOwner}' collides with '${collision.firstOwner}' after dialect normalization to '${collision.canonical}'.`,
      name: collision.name,
      surface,
    });
  }
  entries.forEach(([, name]) => assertSqlName(name, dialect, surface));
});
