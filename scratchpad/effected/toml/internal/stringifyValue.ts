// The canonical TOML document emitter over plain JavaScript values — the
// encode side of the value pipeline. Layout contract: within a table,
// non-table pairs emit first (document order), then sub-tables as
// `[dotted.header]` sections depth-first, then arrays whose every element is
// a plain object as `[[dotted.header]]` sections; a blank line precedes every
// header line except at document start.
//
// Error carriers per the engine firewall: RawTomlError for value errors
// (UnsupportedValue, IntegerOutOfRange, CircularReference — offsets 0, there
// is no source text) and GuardExceeded for the nesting-depth cap. ONLY the
// public facade catches them.

import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "../TomlDateTime.ts";
import type { TomlStringifyErrorCodeRaw } from "./diagnostics.ts";
import { RawTomlError } from "./diagnostics.ts";
import { GuardExceeded, MAX_NESTING_DEPTH } from "./limits.ts";

const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;
// 2^63 as a float is exact (a power of two); anything >= it overflows int64.
const INT64_FLOAT_BOUND = 2 ** 63;

const BARE_KEY = /^[A-Za-z0-9_-]+$/;

/** Error path segments: keys are strings, array indices are numbers. */
type Path = ReadonlyArray<string | number>;

const raise = (code: TomlStringifyErrorCodeRaw, message: string): never => {
	throw new RawTomlError({ code, message, offset: 0, length: 0 });
};

const guardDepth = (depth: number): void => {
	if (depth > MAX_NESTING_DEPTH) {
		throw new GuardExceeded("NestingDepthExceeded", MAX_NESTING_DEPTH, depth, 0);
	}
};

/** Render an error path for diagnostics: dotted keys, bracketed indices. */
const renderPath = (path: Path): string => {
	if (path.length === 0) {
		return "(root)";
	}
	let out = "";
	for (const segment of path) {
		if (typeof segment === "number") {
			out += `[${segment}]`;
		} else {
			out += out === "" ? renderKey(segment) : `.${renderKey(segment)}`;
		}
	}
	return out;
};

/** The JS type name for an UnsupportedValue message. */
const jsTypeName = (value: unknown): string => {
	if (value === null) {
		return "null";
	}
	if (typeof value !== "object") {
		return typeof value;
	}
	const name = Object.getPrototypeOf(value)?.constructor?.name;
	return typeof name === "string" && name.length > 0 ? name : "object";
};

/** A basic single-line string: `"` `\` and control characters escaped. */
const renderString = (value: string): string => {
	let out = '"';
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code === 0x22) {
			out += '\\"';
		} else if (code === 0x5c) {
			out += "\\\\";
		} else if (code === 0x08) {
			out += "\\b";
		} else if (code === 0x09) {
			out += "\\t";
		} else if (code === 0x0a) {
			out += "\\n";
		} else if (code === 0x0c) {
			out += "\\f";
		} else if (code === 0x0d) {
			out += "\\r";
		} else if (code < 0x20 || code === 0x7f) {
			out += `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;
		} else {
			out += value[i];
		}
	}
	return `${out}"`;
};

/** A key: bare when it matches the bare-key grammar, else basic-quoted. */
export const renderKey = (key: string): string => (BARE_KEY.test(key) ? key : renderString(key));

/** A dotted header path, quoting per-segment by the key rule. */
const renderHeaderPath = (path: ReadonlyArray<string>): string => path.map(renderKey).join(".");

/**
 * A `number`: integral values inside the int64 range emit as decimal integers
 * (a JS `1.0` is indistinguishable from `1` — every JS emitter shares this
 * divergence); `-0` emits as `-0.0`; integral values outside the int64 range
 * emit as floats so they round-trip instead of overflowing at parse time;
 * non-integral values emit as the shortest round-trip decimal with a
 * guaranteed `.` or `e`; the specials emit as `inf`/`-inf`/`nan`.
 */
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
	if (Number.isInteger(value) && value >= -INT64_FLOAT_BOUND && value < INT64_FLOAT_BOUND) {
		return String(value);
	}
	const text = String(value);
	return /[.eE]/.test(text) ? text : `${text}.0`;
};

const isTomlDateTime = (
	value: unknown,
): value is TomlLocalDate | TomlLocalDateTime | TomlLocalTime | TomlOffsetDateTime =>
	value instanceof TomlOffsetDateTime ||
	value instanceof TomlLocalDateTime ||
	value instanceof TomlLocalDate ||
	value instanceof TomlLocalTime;

/** Plain objects only (null-prototype included) — never arrays or class instances. */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
};

/** Scalar rendering; `undefined` means "not a scalar" (arrays/objects/rejects). */
const renderScalar = (value: unknown, path: Path): string | undefined => {
	switch (typeof value) {
		case "string":
			return renderString(value);
		case "boolean":
			return value ? "true" : "false";
		case "number":
			return renderNumber(value);
		case "bigint": {
			if (value < INT64_MIN || value > INT64_MAX) {
				raise("IntegerOutOfRange", `integer ${value} at ${renderPath(path)} is outside the 64-bit signed range`);
			}
			return value.toString();
		}
		default: {
			if (isTomlDateTime(value)) {
				return value.toString();
			}
			return undefined;
		}
	}
};

const checkCircular = (value: object, ancestors: Set<object>, path: Path): void => {
	if (ancestors.has(value)) {
		raise("CircularReference", `circular reference at ${renderPath(path)}`);
	}
};

/** One value as an inline fragment: scalars, inline arrays, inline tables. */
const renderInline = (value: unknown, path: Path, depth: number, ancestors: Set<object>): string => {
	// Guard on container DESCENT only, never on a scalar leaf — mirroring the
	// parse side, which checks parseArray/parseInlineTable at the opening
	// bracket and never guards the leaf. Guarding the leaf too would give
	// stringify a one-level tighter effective bound than parse: a value parsed
	// at exactly MAX_NESTING_DEPTH containers with a non-empty innermost
	// element would fail to re-emit.
	const scalar = renderScalar(value, path);
	if (scalar !== undefined) {
		return scalar;
	}
	if (Array.isArray(value)) {
		guardDepth(depth);
		checkCircular(value, ancestors, path);
		ancestors.add(value);
		const items = value.map((item, index) => renderInline(item, [...path, index], depth + 1, ancestors));
		ancestors.delete(value);
		return `[${items.join(", ")}]`;
	}
	if (isPlainObject(value)) {
		guardDepth(depth);
		checkCircular(value, ancestors, path);
		ancestors.add(value);
		const parts = Object.keys(value).map(
			(key) => `${renderKey(key)} = ${renderInline(value[key], [...path, key], depth + 1, ancestors)}`,
		);
		ancestors.delete(value);
		return parts.length === 0 ? "{}" : `{ ${parts.join(", ")} }`;
	}
	return raise("UnsupportedValue", `unsupported ${jsTypeName(value)} value at ${renderPath(path)}`);
};

/**
 * Render a single value as an inline TOML fragment (scalars, arrays and
 * objects all inline). The single-value seam the document modify entry point
 * rides on.
 */
export const renderInlineValue = (value: unknown): string => renderInline(value, [], 0, new Set());

/** A table's entries split into the three layout groups, document order kept. */
interface Classified {
	readonly pairs: Array<string>;
	readonly tables: Array<string>;
	readonly arrayTables: Array<string>;
}

const classify = (table: Record<string, unknown>): Classified => {
	const pairs: Array<string> = [];
	const tables: Array<string> = [];
	const arrayTables: Array<string> = [];
	for (const key of Object.keys(table)) {
		const value = table[key];
		if (isPlainObject(value)) {
			tables.push(key);
		} else if (Array.isArray(value) && value.length > 0 && value.every(isPlainObject)) {
			arrayTables.push(key);
		} else {
			pairs.push(key);
		}
	}
	return { pairs, tables, arrayTables };
};

/** Push a header line, preceded by a blank line except at document start. */
const pushHeader = (lines: Array<string>, header: string): void => {
	if (lines.length > 0) {
		lines.push("");
	}
	lines.push(header);
};

/**
 * Emit one table's body: pairs, then sub-table sections, then
 * array-of-tables sections. `headerPath` carries the dotted section path
 * (strings only); `errorPath` additionally carries array indices.
 */
const emitTable = (
	table: Record<string, unknown>,
	headerPath: ReadonlyArray<string>,
	errorPath: Path,
	lines: Array<string>,
	depth: number,
	ancestors: Set<object>,
): void => {
	guardDepth(depth);
	checkCircular(table, ancestors, errorPath);
	ancestors.add(table);
	const { pairs, tables, arrayTables } = classify(table);
	for (const key of pairs) {
		lines.push(`${renderKey(key)} = ${renderInline(table[key], [...errorPath, key], depth + 1, ancestors)}`);
	}
	for (const key of tables) {
		pushHeader(lines, `[${renderHeaderPath([...headerPath, key])}]`);
		emitTable(
			table[key] as Record<string, unknown>,
			[...headerPath, key],
			[...errorPath, key],
			lines,
			depth + 1,
			ancestors,
		);
	}
	for (const key of arrayTables) {
		const array = table[key] as Array<Record<string, unknown>>;
		checkCircular(array, ancestors, [...errorPath, key]);
		ancestors.add(array);
		for (let index = 0; index < array.length; index++) {
			pushHeader(lines, `[[${renderHeaderPath([...headerPath, key])}]]`);
			emitTable(array[index], [...headerPath, key], [...errorPath, key, index], lines, depth + 1, ancestors);
		}
		ancestors.delete(array);
	}
	ancestors.delete(table);
};

/**
 * Stringify a plain value as a canonical TOML document. The root must be a
 * plain object (a TOML document is a table); an empty root emits the empty
 * string, anything else ends with `newline`.
 */
export const stringifyValue = (value: unknown, newline: string): string => {
	if (!isPlainObject(value)) {
		return raise(
			"UnsupportedValue",
			`unsupported ${jsTypeName(value)} value at ${renderPath([])} — a TOML document is a table`,
		);
	}
	const lines: Array<string> = [];
	emitTable(value, [], [], lines, 0, new Set());
	return lines.length === 0 ? "" : `${lines.join(newline)}${newline}`;
};
