import { $TomlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual, flow } from "effect/Function";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "../TomlDateTime.ts";
import { RawTomlError } from "./diagnostics.ts";
import { GuardExceeded, MAX_NESTING_DEPTH } from "./limits.ts";
import type { TomlStringifyErrorCodeRaw } from "./diagnostics.ts";

const $I = $TomlId.create("internal/stringifyValue");

class TomlStringifyInvariantError extends S.TaggedError<TomlStringifyInvariantError, { readonly brand: unique symbol }>(
  $I`TomlStringifyInvariantError`
)(
  "TomlStringifyInvariantError",
  {
    message: S.String.pipe(
      $I.annoteKey("TomlStringifyInvariantError.message", {
        description: "Explanation of the violated stringify engine invariant.",
      })
    ),
  },
  $I.annoteError<TomlStringifyInvariantError>("TomlStringifyInvariantError", {
    description: "An impossible state in the TOML value emitter.",
  })
) {}

const INT64_MIN = -(BigInt(2) ** BigInt(63));
const INT64_MAX = BigInt(2) ** BigInt(63) - BigInt(1);
const INT64_EXCLUSIVE_FLOAT_BOUND = 2 ** 63;

const BARE_KEY = /^[A-Za-z0-9_-]+$/;

type Path = ReadonlyArray<string | number>;

// decision: engine-diagnostic-boundary
const raise: {
  (code: TomlStringifyErrorCodeRaw, message: string): never;
  (message: string): (code: TomlStringifyErrorCodeRaw) => never;
} = dual(2, (code: TomlStringifyErrorCodeRaw, message: string): never => {
  throw RawTomlError.make({ code, message, offset: 0, length: 0 });
});

const guardContainerDepth = (depth: number): void => {
  if (depth > MAX_NESTING_DEPTH) {
    throw GuardExceeded.new("NestingDepthExceeded", MAX_NESTING_DEPTH, depth, 0);
  }
};

const renderPath = (path: Path): string => {
  if (path.length === 0) {
    return "(root)";
  }
  let out = "";
  for (const segment of path) {
    if (P.isNumber(segment)) {
      out += `[${segment}]`;
    } else {
      out += out === "" ? renderKey(segment) : `.${renderKey(segment)}`;
    }
  }
  return out;
};

const jsTypeName = (value: unknown): string => {
  if (value === null) {
    return "null";
  }
  if (!P.isObjectKeyword(value) || P.isFunction(value)) {
    return typeof value;
  }
  const name = Object.getPrototypeOf(value)?.constructor?.name;
  return P.isString(name) && name.length > 0 ? name : "object";
};

const STRING_ESCAPES: Readonly<Record<string, string>> = {
  "\u0000": "\\u0000",
  "\u0001": "\\u0001",
  "\u0002": "\\u0002",
  "\u0003": "\\u0003",
  "\u0004": "\\u0004",
  "\u0005": "\\u0005",
  "\u0006": "\\u0006",
  "\u0007": "\\u0007",
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\u000b": "\\u000B",
  "\f": "\\f",
  "\r": "\\r",
  "\u000e": "\\u000E",
  "\u000f": "\\u000F",
  "\u0010": "\\u0010",
  "\u0011": "\\u0011",
  "\u0012": "\\u0012",
  "\u0013": "\\u0013",
  "\u0014": "\\u0014",
  "\u0015": "\\u0015",
  "\u0016": "\\u0016",
  "\u0017": "\\u0017",
  "\u0018": "\\u0018",
  "\u0019": "\\u0019",
  "\u001a": "\\u001A",
  "\u001b": "\\u001B",
  "\u001c": "\\u001C",
  "\u001d": "\\u001D",
  "\u001e": "\\u001E",
  "\u001f": "\\u001F",
  '"': '\\"',
  "\\": "\\\\",
  "\u007f": "\\u007F",
};

const renderString = (value: string): string => {
  let out = '"';
  for (let i = 0; i < value.length; i++) {
    out += STRING_ESCAPES[Str.slice(i, i + 1)(value)] ?? value[i];
  }
  return `${out}"`;
};

/**
 * Render a key bare when it matches the bare-key grammar, else basic-quoted.
 *
 * **Example** (Quote a key containing spaces)
 *
 * ```ts
 * import { renderKey } from "@beep/toml/internal/stringifyValue"
 *
 * console.log(renderKey("server port")) // "server port"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderKey = (key: string): string => (BARE_KEY.test(key) ? key : renderString(key));

const renderHeaderPath: (path: ReadonlyArray<string>) => string = flow(A.map(renderKey), A.join("."));

const renderNumber = (value: number): string => {
  if (Number.isNaN(value)) {
    return "nan";
  }
  if (value === Number.POSITIVE_INFINITY) {
    return "inf";
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return "-inf";
  }
  if (Object.is(value, -0)) {
    return "-0.0";
  }
  if (Number.isInteger(value) && value >= -INT64_EXCLUSIVE_FLOAT_BOUND && value < INT64_EXCLUSIVE_FLOAT_BOUND) {
    return String(value);
  }
  const text = String(value);
  return /[.eE]/.test(text) ? text : `${text}.0`;
};

const isTomlDateTime = S.is(S.Union([TomlOffsetDateTime, TomlLocalDateTime, TomlLocalDate, TomlLocalTime]));

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!P.isObjectKeyword(value) || P.isFunction(value) || A.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const renderScalar = Match.fn((value: unknown, _path: Path) => value).pipe(
  Match.when(P.isString, renderString),
  Match.when(P.isBoolean, (value) => (value ? "true" : "false")),
  Match.when(P.isNumber, renderNumber),
  Match.when(P.isBigInt, (value, _input, path) => {
    if (value < INT64_MIN || value > INT64_MAX) {
      raise("IntegerOutOfRange", `integer ${value} at ${renderPath(path)} is outside the 64-bit signed range`);
    }
    return value.toString();
  }),
  Match.when(isTomlDateTime, (value) => value.toString()),
  Match.orElse(() => undefined)
);

const checkCircular: {
  (value: object, ancestors: ReadonlyArray<object>, path: Path): void;
  (ancestors: ReadonlyArray<object>, path: Path): (value: object) => void;
} = dual(3, (value: object, ancestors: ReadonlyArray<object>, path: Path): void => {
  if (A.some(ancestors, (ancestor) => ancestor === value)) {
    raise("CircularReference", `circular reference at ${renderPath(path)}`);
  }
});

const renderInline: {
  (value: unknown, path: Path, depth: number, ancestors: ReadonlyArray<object>): string;
  (path: Path, depth: number, ancestors: ReadonlyArray<object>): (value: unknown) => string;
} = dual(4, (value: unknown, path: Path, depth: number, ancestors: ReadonlyArray<object>): string => {
  if (A.isArray(value)) {
    guardContainerDepth(depth);
    checkCircular(value, ancestors, path);
    const nextAncestors = [...ancestors, value];
    const items = A.map(value, (item, index) => renderInline(item, [...path, index], depth + 1, nextAncestors));
    return `[${A.join(items, ", ")}]`;
  }
  if (isPlainObject(value)) {
    guardContainerDepth(depth);
    checkCircular(value, ancestors, path);
    const nextAncestors = [...ancestors, value];
    const parts = A.map(
      R.keys(value),
      (key) => `${renderKey(key)} = ${renderInline(value[key], [...path, key], depth + 1, nextAncestors)}`
    );
    return parts.length === 0 ? "{}" : `{ ${A.join(parts, ", ")} }`;
  }
  const scalar = renderScalar(value, path);
  if (scalar !== undefined) {
    return scalar;
  }
  return raise("UnsupportedValue", `unsupported ${jsTypeName(value)} value at ${renderPath(path)}`);
});

/**
 * Render a single value as an inline TOML fragment (scalars, arrays and
 * objects all inline).
 *
 * **Details**
 *
 * The single-value seam the document modify entry point rides on.
 *
 * **Example** (Render an inline table with an array)
 *
 * ```ts
 * import { renderInlineValue } from "@beep/toml/internal/stringifyValue"
 *
 * console.log(renderInlineValue({ ports: [8080, 8081] })) // { ports = [8080, 8081] }
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderInlineValue = (value: unknown): string => renderInline(value, [], 0, []);

interface Classified {
  readonly arrayTables: Array<string>;
  readonly pairs: Array<string>;
  readonly tables: Array<string>;
}

const partitionTableLayoutGroups = (table: Record<string, unknown>): Classified => {
  const pairs: Array<string> = [];
  const tables: Array<string> = [];
  const arrayTables: Array<string> = [];
  for (const key of R.keys(table)) {
    const value = table[key];
    if (isPlainObject(value)) {
      tables.push(key);
    } else if (A.isArray(value) && value.length > 0 && A.every(value, isPlainObject)) {
      arrayTables.push(key);
    } else {
      pairs.push(key);
    }
  }
  return { pairs, tables, arrayTables };
};

const pushHeader: {
  (lines: Array<string>, header: string): void;
  (header: string): (lines: Array<string>) => void;
} = dual(2, (lines: Array<string>, header: string): void => {
  if (lines.length > 0) {
    lines.push("");
  }
  lines.push(header);
});

const emitSubTable = (
  value: unknown,
  key: string,
  headerPath: ReadonlyArray<string>,
  errorPath: Path,
  lines: Array<string>,
  depth: number,
  tableAncestors: ReadonlyArray<object>
): void => {
  pushHeader(lines, `[${renderHeaderPath([...headerPath, key])}]`);
  if (!isPlainObject(value)) {
    raise("UnsupportedValue", `unsupported ${jsTypeName(value)} value at ${renderPath([...errorPath, key])}`);
  }
  emitTable(value, [...headerPath, key], [...errorPath, key], lines, depth + 1, tableAncestors);
};

const emitArrayTables = (
  array: unknown,
  key: string,
  headerPath: ReadonlyArray<string>,
  errorPath: Path,
  lines: Array<string>,
  depth: number,
  tableAncestors: ReadonlyArray<object>
): void => {
  if (!A.isArray(array) || !A.every(array, isPlainObject)) {
    raise("UnsupportedValue", `unsupported ${jsTypeName(array)} value at ${renderPath([...errorPath, key])}`);
  }
  checkCircular(array, tableAncestors, [...errorPath, key]);
  const arrayAncestors = [...tableAncestors, array];
  for (let index = 0; index < array.length; index++) {
    pushHeader(lines, `[[${renderHeaderPath([...headerPath, key])}]]`);
    const element = array[index];
    if (element === undefined) {
      throw TomlStringifyInvariantError.make({ message: "missing array-table element" });
    }
    emitTable(element, [...headerPath, key], [...errorPath, key, index], lines, depth + 1, arrayAncestors);
  }
};

const emitTable: {
  (
    table: Record<string, unknown>,
    headerPath: ReadonlyArray<string>,
    errorPath: Path,
    lines: Array<string>,
    depth: number,
    ancestors: ReadonlyArray<object>
  ): void;
  (
    headerPath: ReadonlyArray<string>,
    errorPath: Path,
    lines: Array<string>,
    depth: number,
    ancestors: ReadonlyArray<object>
  ): (table: Record<string, unknown>) => void;
} = dual(
  6,
  (
    table: Record<string, unknown>,
    headerPath: ReadonlyArray<string>,
    errorPath: Path,
    lines: Array<string>,
    depth: number,
    ancestors: ReadonlyArray<object>
  ): void => {
    guardContainerDepth(depth);
    checkCircular(table, ancestors, errorPath);
    const tableAncestors = [...ancestors, table];
    const { pairs, tables, arrayTables } = partitionTableLayoutGroups(table);
    for (const key of pairs) {
      lines.push(`${renderKey(key)} = ${renderInline(table[key], [...errorPath, key], depth + 1, tableAncestors)}`);
    }
    for (const key of tables) {
      emitSubTable(table[key], key, headerPath, errorPath, lines, depth, tableAncestors);
    }
    for (const key of arrayTables) {
      emitArrayTables(table[key], key, headerPath, errorPath, lines, depth, tableAncestors);
    }
  }
);

/**
 * Stringify a plain value as a canonical TOML document.
 *
 * **Details**
 *
 * An empty root emits the empty string; anything else ends with `newline`.
 *
 * **Gotchas**
 *
 * The root must be a plain object (a TOML document is a table).
 *
 * **Example** (Emit a document with a trailing newline)
 *
 * ```ts
 * import { stringifyValue } from "@beep/toml/internal/stringifyValue"
 *
 * console.log(JSON.stringify(stringifyValue({ port: 8080 }, "\n"))) // "port = 8080\n"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const stringifyValue: {
  (value: unknown, newline: string): string;
  (newline: string): (value: unknown) => string;
} = dual(2, (value: unknown, newline: string): string => {
  if (!isPlainObject(value)) {
    return raise(
      "UnsupportedValue",
      `unsupported ${jsTypeName(value)} value at ${renderPath([])} — a TOML document is a table`
    );
  }
  const lines: Array<string> = [];
  emitTable(value, [], [], lines, 0, []);
  return lines.length === 0 ? "" : `${A.join(lines, newline)}${newline}`;
});
