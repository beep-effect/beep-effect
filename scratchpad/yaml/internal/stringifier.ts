// YAML stringifier engine — converts JavaScript values and AST nodes to YAML
// text, including the canonical-output logic exercised by the
// yaml-test-suite byte-equality assertion family.
//
// Sync throughout; the two v3 `Effect.try` failure wrappers become the
// thrown `StringifyFailure`, which the public facade catches and
// materializes into the public error type. Implements configurable
// formatting with support for block/flow styles, scalar quoting rules, and
// round-trip preservation of AST node styles.

import type {
  CollectionStyle,
  QuoteCompat,
  QuoteStyle,
  ScalarStyle,
  YamlNode
} from "../YamlNode.ts";
import {
  YamlAlias,
  YamlMap,
  YamlPair,
  YamlScalar,
  YamlSeq
} from "../YamlNode.ts";
import {MAX_NESTING_DEPTH} from "./composer/state.ts";
import {
  foldRenderedScalar,
  hasInteriorTrailingWhitespace,
  hasNewlineSpacesTab,
  isControlChar,
  renderBlockFolded,
  renderBlockLiteral,
  renderSingleQuotedMultiline,
} from "./fold.ts";
import type {StringifyOptionsInput} from "./options.ts";
import type {RawDirective, RawYamlDocument} from "./raw-document.ts";

/**
 * Thrown by the stringifier on its failure paths (circular references). The
 * facade catches this and materializes the public stringify error.
 */
export class StringifyFailure extends Error {
	readonly reason: string;
	constructor(reason: string) {
		super(reason);
		this.name = "StringifyFailure";
		this.reason = reason;
	}
}

/**
 * Thrown by the value-stringifier trio when its mutual recursion exceeds
 * {@link MAX_NESTING_DEPTH}. A deeply-nested acyclic value (e.g. a 50 000-deep
 * array) would otherwise overflow the call stack as an unhandled `RangeError`
 * defect; the facade catches this and materializes a fatal
 * `YamlStringifyError` (a `NestingDepthExceeded` diagnostic), keeping the
 * failure on the typed error channel — the stringify mirror of the composer's
 * nesting-depth guard.
 */
export class StringifyDepthExceeded extends Error {
	constructor() {
		super(`Nesting depth exceeded maximum of ${MAX_NESTING_DEPTH}`);
		this.name = "StringifyDepthExceeded";
	}
}

/**
 * YAML 1.2 §8.1.3 caps an implicit block-mapping key: the `:` indicator must
 * appear at most 1024 characters after the start of the key. A key whose
 * RENDERED form (quotes and escapes count, the source scalar does not) is
 * longer than this must spill to explicit-key form (`? key` / `: value`) or
 * strict parsers reject the output. Matches the reference `yaml` package
 * (`stringifyPair`: `str.length > 1024`, block context only — flow contexts
 * never spill): a rendered key of exactly 1024 characters stays implicit.
 */
const IMPLICIT_KEY_MAX_LENGTH = 1024;

/**
 * Continuation-line padding for explicit-key compact notation. Structurally
 * the width of the `? ` / `: ` indicators — two columns — and deliberately
 * NOT `ctx.indent`: compact continuation lines must align with the first
 * item, which always starts two columns in, so any other pad silently
 * re-nests (or corrupts) the value on reparse once `indent !== 2`. This is a
 * recorded divergence from the reference `yaml` package, which pads these
 * lines with the configured indent and emits output its own strict parser
 * misreads or rejects at indent ≠ 2.
 */
const EXPLICIT_COMPACT_PAD = "  ";

// ---------------------------------------------------------------------------
// YAML 1.2 type-conflict detection
// ---------------------------------------------------------------------------

const NULL_RE = /^(?:null|Null|NULL|~)$/;
const TRUE_RE = /^(?:true|True|TRUE)$/;
const FALSE_RE = /^(?:false|False|FALSE)$/;
const INT_RE = /^[-+]?[0-9]+$/;
const OCT_RE = /^0o[0-7]+$/;
const HEX_RE = /^0x[\dA-Fa-f]+$/;
const FLOAT_RE = /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/;
const INF_RE = /^[-+]?\.(?:inf|Inf|INF)$/;
const NAN_RE = /^\.(?:nan|NaN|NAN)$/;

/**
 * YAML indicator characters that require quoting when appearing in plain scalars.
 */
const INDICATOR_CHARS = new Set([
	":",
	"#",
	"{",
	"}",
	"[",
	"]",
	",",
	"&",
	"*",
	"?",
	"|",
	"-",
	"<",
	">",
	"=",
	"!",
	"%",
	"@",
	"`",
	'"',
	"'",
]);

/**
 * Returns true if a string value would be mis-resolved as a non-string YAML type.
 *
 * Tests against all YAML 1.2 Core Schema type patterns (null, bool, int, float,
 * inf, nan). Any string matching these patterns must be quoted to preserve its
 * string identity during a parse round-trip.
 */
function wouldBeResolved(s: string): boolean {
	if (s === "") return true;
	if (NULL_RE.test(s)) return true;
	if (TRUE_RE.test(s)) return true;
	if (FALSE_RE.test(s)) return true;
	if (OCT_RE.test(s)) return true;
	if (HEX_RE.test(s)) return true;
	if (INT_RE.test(s)) return true;
	if (INF_RE.test(s)) return true;
	if (NAN_RE.test(s)) return true;
	return FLOAT_RE.test(s);

}

// ---------------------------------------------------------------------------
// YAML 1.1 type-conflict detection (`quoteCompat: "yaml-1.1"`)
// ---------------------------------------------------------------------------
//
// Implicit-resolver patterns from the YAML 1.1 type repository
// (yaml.org/type: bool.html, int.html, float.html, timestamp.html), covering
// what a 1.1 parser (js-yaml, PyYAML, libyaml) coerces that the 1.2 Core
// Schema above does not: the extended boolean spellings, underscore digit
// separators, base-2/8/16 integer forms, sexagesimal numbers and timestamps.
// Where the spec and lenient real-world resolvers differ slightly (optional
// exponent sign, colon-less timezone offsets, `0o` octals, the reference
// `yaml` package's 1.1-schema leading-zero decimal ints and one-digit
// date-only months/days) the patterns accept the union — over-quoting is the
// safe direction for a compat mode.

const BOOL_11_RE = /^(?:y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/;
// Base 2 / base 8 (legacy `0` and `0o` prefixes) / base 10 / base 16, all
// with `_` digit separators, plus base-60 (sexagesimal) integers. The decimal
// branch accepts leading zeros (`09`, `0_9`): the spec says `0|[1-9][0-9_]*`,
// but the reference `yaml` package's 1.1 schema resolves any `[0-9][0-9_]*`
// to an int, so the union keeps those quoted.
const INT_11_RE = /^[-+]?(?:0b[0-1_]+|0o?[0-7_]+|[0-9][0-9_]*|0x[0-9a-fA-F_]+|[1-9][0-9_]*(?::[0-5]?[0-9])+)$/;
// Decimal floats with `_` separators (dotted, dotless-exponent and
// leading-dot forms) and base-60 (sexagesimal) floats. A decimal point or an
// exponent is required — the 1.1 float grammar demands one, so bare digit
// runs are the int pattern's business, not this one's. The dotless-exponent
// form (`1e3`) and the optional exponent sign are js-yaml leniency;
// `.inf`/`.nan` are already caught by the 1.2 patterns above.
const FLOAT_11_RE =
	/^[-+]?(?:[0-9][0-9_]*(?:\.[0-9_]*(?:[eE][-+]?[0-9]+)?|[eE][-+]?[0-9]+)|\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*)$/;
// Date-only and full timestamp forms, both with 1-2 digit month/day, the full
// form with a `T`/`t` or whitespace separator and an optional fraction and
// timezone (`Z` or an offset, colon optional). The spec's date-only (ymd)
// branch is strictly two-digit; the reference `yaml` package's 1.1 schema
// also resolves `2024-1-15` to a date, so the union takes the lenient date
// part for both forms.
const TIMESTAMP_11_RE =
	/^[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?(?:(?:[Tt]|[ \t]+)[0-9][0-9]?:[0-9][0-9]:[0-9][0-9](?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9][0-9]?(?::?[0-9][0-9])?))?)?$/;

/**
 * Returns true if a string value would be resolved as a non-string type by a
 * YAML 1.1 parser. The delta over {@link wouldBeResolved}: null spellings are
 * identical in both editions (and already covered), so only the boolean,
 * integer, float and timestamp families are tested here.
 */
function wouldBeResolved11(s: string): boolean {
	if (BOOL_11_RE.test(s)) return true;
	if (INT_11_RE.test(s)) return true;
	if (FLOAT_11_RE.test(s)) return true;
	return TIMESTAMP_11_RE.test(s);

}

/**
 * Returns true if a string requires quoting to be safely represented as a plain scalar.
 *
 * Checks multiple conditions beyond type-conflict detection: empty strings,
 * embedded newlines, leading indicator characters or whitespace, and inline
 * comment/mapping-value patterns (`: `, ` #`). This is the single gate that
 * decides whether a plain scalar is safe or must be wrapped in quotes.
 *
 * `quoteCompat` is strictly additive: `"yaml-1.1"` additionally quotes
 * strings a YAML 1.1 parser would coerce ({@link wouldBeResolved11}) and can
 * never un-quote anything the 1.2 rules require quoted.
 */
function requiresQuoting(s: string, ignoreType = false, quoteCompat?: QuoteCompat): boolean {
	// Empty string must be quoted
	if (s === "") return true;
	// Contains newlines — use block literal instead
	if (s.includes("\n")) return true;
	// Would be resolved as a non-string type (skip when a tag overrides resolution)
	if (!ignoreType && wouldBeResolved(s)) return true;
	// Would be coerced by the requested foreign dialect (same tag exemption)
	if (!ignoreType && quoteCompat === "yaml-1.1" && wouldBeResolved11(s)) return true;
	// Starts with whitespace (space/tab)
	const first = s[0];
	if (first === " " || first === "\t") return true;
	// Check leading indicator characters
	if (first !== undefined && INDICATOR_CHARS.has(first)) {
		// ':', '?', '-' only require quoting when followed by whitespace or at end of string
		if (first === ":" || first === "?" || first === "-") {
			const second = s[1];
			if (s.length === 1 || second === " " || second === "\t") return true;
			// Otherwise these are safe as plain scalars (e.g., :foo, ?bar, -baz)
		} else {
			// All other indicator chars (#, {, }, [, ], etc.) always require quoting at start
			return true;
		}
	}
	// Starts with document marker prefix (--- or ...) — ambiguous at line start
	if (s.startsWith("---") || s.startsWith("...")) return true;
	// Contains ': ' (mapping value indicator with space) or ' #' (comment indicator)
	if (s.includes(": ") || s.includes(":\t") || s.endsWith(":")) return true;
	if (s.includes(" #") || s.includes("\t#")) return true;
	// Ends with whitespace (space/tab) — plain scalars lose trailing whitespace
	const last = s[s.length - 1];
	if (last === " " || last === "\t") return true;
	// C0 control characters require quoting. `isControlChar` deliberately
	// excludes TAB (0x09) and CR (0x0D) for its other callers — the block-scalar
	// and single-quoted-multiline paths, where both are representable — so both
	// are tested explicitly here. A plain scalar cannot carry either: CR is
	// normalised away by the parser (silent data corruption on round-trip) and
	// an interior tab produces text other YAML parsers reject. Only single-line
	// values reach this point (multi-line returns at the `\n` check above), so
	// quoting on any TAB is safe for block styles.
	for (let i = 0; i < s.length; i++) {
		const code = s.charCodeAt(i);
		if (code === 0x09 || code === 0x0d || isControlChar(code)) return true;
	}
	return false;
}

/**
 * Returns true if the string contains any non-ASCII character (code point \> 0x7E).
 */
function hasNonAscii(s: string): boolean {
	for (let i = 0; i < s.length; i++) {
		if (s.charCodeAt(i) > 0x7e) return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Scalar rendering
// ---------------------------------------------------------------------------

/**
 * Renders a string scalar using double-quote style.
 *
 * When `canonical` is true, non-ASCII characters are escaped as `\uXXXX`
 * (or `\UXXXXXXXX` for supplementary plane) and C0 control characters use
 * named escapes where YAML 1.2 defines them (`\b`, `\0`, `\a`, `\v`, `\e`).
 */
export function renderDoubleQuoted(s: string, canonical = false): string {
	let escaped = s
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t");
	let result = "";
	for (let i = 0; i < escaped.length; i++) {
		const code = escaped.charCodeAt(i);
		if (isControlChar(code)) {
			// Use YAML 1.2 named escapes where available
			if (code === 0x00) {
				result += "\\0";
			} else if (code === 0x07) {
				result += "\\a";
			} else if (code === 0x08) {
				result += "\\b";
			} else if (code === 0x0b) {
				result += "\\v";
			} else if (code === 0x0c) {
				result += "\\f";
			} else if (code === 0x1b) {
				result += "\\e";
			} else {
				result += `\\x${code.toString(16).padStart(2, "0")}`;
			}
		} else if (canonical && code > 0x7e) {
			// In canonical mode, escape non-ASCII characters
			// Check for surrogate pairs (supplementary plane characters)
			if (code >= 0xd800 && code <= 0xdbff && i + 1 < escaped.length) {
				const low = escaped.charCodeAt(i + 1);
				if (low >= 0xdc00 && low <= 0xdfff) {
					const cp = (code - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
					result += `\\U${cp.toString(16).toUpperCase().padStart(8, "0")}`;
					i++; // skip low surrogate
					continue;
				}
			}
			result += `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;
		} else {
			result += escaped[i];
		}
	}
	escaped = result;
	return `"${escaped}"`;
}

/**
 * Renders a string scalar using single-quote style.
 */
export function renderSingleQuoted(s: string): string {
	return `'${s.replace(/'/g, "''")}'`;
}

/**
 * Renders a string value as a YAML scalar using the requested style.
 * Falls back to double-quoted if the requested style is unsafe for the value.
 *
 * Multi-line strings are routed to block styles regardless of the requested
 * style (except double-quoted). For single-line strings, plain style delegates
 * to {@link requiresQuoting} and falls back to `quoteStyle` (single-quoted by
 * default, double-quoted when the caller asked for it) — or to double-quoted
 * regardless when the value needs YAML escapes single quotes cannot express.
 * Block literal and block folded styles are always accepted for single-line
 * strings even though the output is unusual.
 */
function renderString(
	s: string,
	style: ScalarStyle,
	indent: string,
	ignoreType = false,
	canonical = false,
	explicitChomp?: "strip" | "clip" | "keep",
	parentPosition?: "block-map-value" | "block-seq-item",
	quoteStyle: QuoteStyle = "single",
	explicitIndent?: number,
	quoteCompat?: QuoteCompat,
): string {
	// Fidelity mode (everything but canonical) re-emits the EXPLICIT header
	// indicators the source spelled — a redundant `+` keep-chomp or `|2`
	// indentation indicator is normalized away only under forceDefaultStyles.
	const fidelity = !canonical;
	const fidelityIndent = fidelity ? explicitIndent : undefined;
	if (s.includes("\n")) {
		// If the value contains C0 control chars (except tab) or carriage
		// returns, block styles can't represent them — use double-quoted
		let hasControl = false;
		for (let i = 0; i < s.length; i++) {
			const code = s.charCodeAt(i);
			if (isControlChar(code) || code === 0x0d) {
				hasControl = true;
				break;
			}
		}
		if (hasControl) return renderDoubleQuoted(s, canonical);
		// If the value is only spaces and newlines (no text/tab content),
		// block scalars can't represent it faithfully — use double-quoted.
		// Exception: when the original style is block-literal with keep-chomp
		// content (newline-only is a valid `|+` body), preserve block style.
		if (/^[\n ]*$/.test(s) && style !== "block-literal" && style !== "block-folded") {
			return renderDoubleQuoted(s, canonical);
		}
		// In canonical mode, multi-line block content with trailing whitespace
		// on an interior line cannot round-trip cleanly — block scalars normalise
		// such whitespace. Single-line content with only trailing whitespace
		// (e.g. `\t\n`) is tolerated by block style. Uses imperative scans
		// instead of regexes to avoid polynomial-time matching on adversarial
		// inputs containing many trailing newlines.
		if (canonical && (style === "block-literal" || style === "block-folded")) {
			if (hasInteriorTrailingWhitespace(s)) {
				return renderDoubleQuoted(s, canonical);
			}
			// Mixed leading whitespace on a continuation line (space then tab)
			// produces ambiguous indentation in block style; switch to DQ.
			if (hasNewlineSpacesTab(s)) {
				return renderDoubleQuoted(s, canonical);
			}
		}
		// Multi-line: prefer block styles
		if (style === "block-literal")
			return renderBlockLiteral(s, indent, explicitChomp, parentPosition, fidelity, fidelityIndent);
		if (style === "block-folded")
			return renderBlockFolded(s, indent, fidelity ? explicitChomp : undefined, fidelityIndent);
		// In canonical mode, prefer single-quoted with fold encoding for plain
		// and single-quoted multi-line scalars — matches libyaml canonical form.
		if (style === "plain" || style === "single-quoted") {
			if (canonical) {
				const sq = renderSingleQuotedMultiline(s, indent);
				if (sq !== null) return sq;
			}
			return renderBlockLiteral(s, indent, explicitChomp, parentPosition, fidelity, fidelityIndent);
		}
		return renderDoubleQuoted(s, canonical);
	}
	// In canonical mode, force double-quoted when string has non-ASCII chars
	// so they can be escaped as \uXXXX
	if (canonical && hasNonAscii(s)) {
		return renderDoubleQuoted(s, true);
	}
	// Empty strings in block styles should use quoted style instead
	if (s === "" && (style === "block-literal" || style === "block-folded")) {
		return renderDoubleQuoted(s, canonical);
	}
	switch (style) {
		case "plain":
			if (requiresQuoting(s, ignoreType, quoteCompat)) {
				// Chars needing YAML escapes (tab, CR, control chars) force
				// double-quoted under either quoteStyle — single quotes cannot
				// express them. Backslashes are literal in single-quoted YAML
				// and do NOT need double-quoting.
				if (s.includes("\t") || s.includes("\r")) {
					return renderDoubleQuoted(s, canonical);
				}
				for (let i = 0; i < s.length; i++) {
					if (isControlChar(s.charCodeAt(i))) return renderDoubleQuoted(s, canonical);
				}
				// Otherwise the caller's fallback preference decides: single-quoted
				// by default (the released byte-compatible form), double-quoted
				// when `quoteStyle` asks for it.
				return quoteStyle === "double" ? renderDoubleQuoted(s, canonical) : renderSingleQuoted(s);
			}
			return s;
		case "single-quoted":
			return renderSingleQuoted(s);
		case "double-quoted":
			return renderDoubleQuoted(s, canonical);
		case "block-literal":
			return renderBlockLiteral(s, indent, explicitChomp, parentPosition, fidelity, fidelityIndent);
		case "block-folded":
			return renderBlockFolded(s, indent, fidelity ? explicitChomp : undefined, fidelityIndent);
	}
}

/**
 * Returns true if the rendered text ends with an open-ended block scalar
 * (`|+` or `>+` keep-chomp). Such scalars consume any trailing blank lines
 * up to the next document marker, so an explicit `...` is required for the
 * reader to know where the value ends.
 *
 * Detects the most recent `|` or `>` indicator on a header line (matching
 * the form `|<digits>?<chomp>?$` after optional indent and node prefixes)
 * and returns true when the chomp indicator is `+`.
 */
function endsWithKeepChomp(rendered: string): boolean {
	const match = rendered.match(/[|>][1-9]?[+-]?$|[|>][1-9]?[+-]?(?=\n)/g);
	if (!match) return false;
	const last = match[match.length - 1];
	return last.includes("+");
}

// ---------------------------------------------------------------------------
// Number rendering
// ---------------------------------------------------------------------------

/**
 * Renders a number value as a YAML scalar string.
 *
 * Maps JavaScript special number values to their YAML 1.2 Core Schema
 * equivalents: `NaN` becomes `.nan`, positive infinity becomes `.inf`,
 * and negative infinity becomes `-.inf`. All other numbers use
 * `String(n)` which produces valid YAML integer or float literals.
 */
function renderNumber(n: number): string {
	if (Number.isNaN(n)) return ".nan";
	if (n === Number.POSITIVE_INFINITY) return ".inf";
	if (n === Number.NEGATIVE_INFINITY) return "-.inf";
	return String(n);
}

// ---------------------------------------------------------------------------
// Circular reference detection
// ---------------------------------------------------------------------------

/**
 * Detects circular references by tracking the object ancestor chain.
 */
function detectCircular(value: unknown, seen: Set<object>): void {
	if (value !== null && typeof value === "object") {
		if (seen.has(value)) {
			throw new StringifyFailure("Circular reference detected");
		}
	}
}

// ---------------------------------------------------------------------------
// Core stringification
// ---------------------------------------------------------------------------

interface StringifyContext {
	indent: number;
	lineWidth: number;
	defaultScalarStyle: ScalarStyle;
	defaultCollectionStyle: CollectionStyle;
	sortKeys: boolean;
	indentSequences: boolean;
	/** Fallback quote style for plain scalars that require quoting. */
	quoteStyle: QuoteStyle;
	/** Foreign dialect whose implicit coercions additionally force quoting. */
	quoteCompat: QuoteCompat | undefined;
	forceDefaultStyles: boolean;
	seen: Set<object>;
	/**
	 * Position of the current node within its parent. Used by canonical-mode
	 * stringifier rules that need to differentiate "block-map value position"
	 * from "block-seq item position" (e.g., K858 explicit indent indicator
	 * for empty keep-chomp scalars only fires under block-map values).
	 */
	parentPosition?: "block-map-value" | "block-seq-item";
}

/** Resolves optional stringify options into a fully-defaulted context. */
function createContext(options?: StringifyOptionsInput): StringifyContext {
	return {
		indent: options?.indent ?? 2,
		// Default 0 = never wrap: byte-identical to the historic (inert) behavior.
		// Only a positive lineWidth opts a caller into column-based folding.
		lineWidth: options?.lineWidth ?? 0,
		defaultScalarStyle: options?.defaultScalarStyle ?? "plain",
		defaultCollectionStyle: options?.defaultCollectionStyle ?? "block",
		sortKeys: options?.sortKeys ?? false,
		indentSequences: options?.indentSequences ?? false,
		// Default "single" = the released fallback: byte-identical output for every
		// caller that does not opt into the `yaml`-npm-compatible double-quoted form.
		quoteStyle: options?.quoteStyle ?? "single",
		// Default absent = no extra quoting: byte-identical output for every
		// caller not targeting a YAML 1.1 consumer.
		quoteCompat: options?.quoteCompat,
		forceDefaultStyles: options?.forceDefaultStyles ?? false,
		seen: new Set(),
	};
}

/**
 * Recursively stringifies a JavaScript value into YAML lines.
 *
 * Returns an array of lines with NO leading indentation — the caller is
 * responsible for prepending the appropriate indentation prefix to each line.
 * This avoids double-indentation when embedding nested collections.
 */
function stringifyLines(value: unknown, ctx: StringifyContext, depth: number, allowFold = true): string[] {
	// Depth guard: the value-stringifier trio (this fn, stringifyArrayLines and
	// stringifyObjectLines) is mutually recursive with no natural bound, so a
	// deeply-nested acyclic value would overflow the stack as a RangeError
	// defect. Cap at the shared MAX_NESTING_DEPTH and throw a typed internal
	// error the facade materializes into a YamlStringifyError.
	if (depth > MAX_NESTING_DEPTH) throw new StringifyDepthExceeded();

	// null / undefined
	if (value === null || value === undefined) return ["null"];

	// boolean
	if (typeof value === "boolean") return [value ? "true" : "false"];

	// number
	if (typeof value === "number") return [renderNumber(value)];

	// bigint — produced by the composer's safeParseInt for values exceeding MAX_SAFE_INTEGER
	if (typeof value === "bigint") return [value.toString()];

	// string
	if (typeof value === "string") {
		// For block scalars the header line and body lines are already split
		const indentStr = " ".repeat(ctx.indent);
		const rendered = renderString(
			value,
			ctx.defaultScalarStyle,
			indentStr,
			false,
			ctx.forceDefaultStyles,
			undefined,
			undefined,
			ctx.quoteStyle,
			undefined,
			ctx.quoteCompat,
		);
		// Column-based folding only fires in block contexts (not flow items, whose
		// lines are re-joined with spaces) and only for a positive lineWidth. The
		// folded continuation lines carry `indentStr`, which the block mapping /
		// sequence callers place inline just like a multi-line block scalar.
		const folded = allowFold && ctx.lineWidth > 0 ? foldRenderedScalar(rendered, indentStr, ctx.lineWidth) : rendered;
		return folded.split("\n");
	}

	// array
	if (Array.isArray(value)) {
		detectCircular(value, ctx.seen);
		ctx.seen.add(value as object);
		try {
			return stringifyArrayLines(value, ctx, depth);
		} finally {
			ctx.seen.delete(value as object);
		}
	}

	// object (plain object / record)
	if (typeof value === "object") {
		detectCircular(value, ctx.seen);
		ctx.seen.add(value as object);
		try {
			return stringifyObjectLines(value as Record<string, unknown>, ctx, depth);
		} finally {
			ctx.seen.delete(value as object);
		}
	}

	// Fallback: coerce to string and quote
	return [renderDoubleQuoted(String(value))];
}

/**
 * Stringifies a JavaScript array into YAML sequence lines (no leading indent).
 */
function stringifyArrayLines(arr: unknown[], ctx: StringifyContext, depth: number): string[] {
	if (arr.length === 0) {
		return ["[]"];
	}

	if (ctx.defaultCollectionStyle === "flow") {
		// Flow items are re-joined with spaces, so folding must not run here.
		const items = arr.map((item) => stringifyLines(item, ctx, depth + 1, false).join(" "));
		return [`[${items.join(", ")}]`];
	}

	// Block style — each item rendered relative to depth 0
	const pad = " ".repeat(ctx.indent);
	const lines: string[] = [];
	for (const item of arr) {
		const itemLines = stringifyLines(item, ctx, depth + 1);
		if (itemLines.length === 1) {
			lines.push(`- ${itemLines[0]}`);
		} else {
			// First line of a block scalar goes on the same line as `-`
			const first = itemLines[0];
			// Block scalars (`|`/`>`) and folded/multi-line string scalars (plain or
			// double-quoted, whose continuation lines already carry their indent)
			// put the first line inline after `-` and emit continuations as-is.
			if (first.startsWith("|") || first.startsWith(">") || typeof item === "string") {
				lines.push(`- ${first}`);
				for (let i = 1; i < itemLines.length; i++) {
					lines.push(itemLines[i]);
				}
			} else {
				// Nested mapping or sequence — indent continuation lines by one level
				lines.push(`- ${itemLines[0]}`);
				for (let i = 1; i < itemLines.length; i++) {
					lines.push(`${pad}${itemLines[i]}`);
				}
			}
		}
	}
	return lines;
}

/**
 * Returns true when a value is a non-empty block collection (object or array
 * with block style). Such values must never be placed inline after a key colon
 * in a block mapping — they must always start on the next line.
 */
function isBlockCollection(value: unknown, ctx: StringifyContext): boolean {
	if (ctx.defaultCollectionStyle === "flow") return false;
	if (Array.isArray(value) && value.length > 0) return true;
	return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;

}

/**
 * Stringifies a JavaScript object into YAML mapping lines (no leading indent).
 */
function stringifyObjectLines(obj: Record<string, unknown>, ctx: StringifyContext, depth: number): string[] {
	const keys = Object.keys(obj);
	if (keys.length === 0) {
		return ["{}"];
	}

	if (ctx.sortKeys) {
		keys.sort();
	}

	// Mapping keys render plain-styled, so they take the same `quoteStyle`
	// fallback as plain values — a key like `@types/acorn` requires quoting and
	// must honor the caller's preference, not a hardcoded single quote.
	const renderPlainKey = (k: string): string =>
		renderString(k, "plain", "", false, false, undefined, undefined, ctx.quoteStyle, undefined, ctx.quoteCompat);

	if (ctx.defaultCollectionStyle === "flow") {
		const pairs = keys.map((k) => {
			const keyStr = renderPlainKey(k);
			// Flow values are re-joined with spaces, so folding must not run here.
			const valStr = stringifyLines(obj[k], ctx, depth + 1, false).join(" ");
			return `${keyStr}: ${valStr}`;
		});
		return [`{${pairs.join(", ")}}`];
	}

	// Helper: render a mapping key — must be single-line for block mappings,
	// so multiline keys use double-quoted style with \n escapes
	const renderKey = (k: string): string =>
		k.includes("\n") ? renderDoubleQuoted(k, ctx.forceDefaultStyles) : renderPlainKey(k);

	// Block style
	const pad = " ".repeat(ctx.indent);
	const lines: string[] = [];
	for (const k of keys) {
		const keyStr = renderKey(k);
		const val = obj[k];
		const valLines = stringifyLines(val, ctx, depth + 1);

		// Rendered key past the implicit-key limit: spill to explicit-key form
		// (`? key` / `: value`), value in compact notation on the `:` line —
		// the shape the reference `yaml` package emits (and pnpm 11 lockfile
		// snapshot keys exercise). `indentSequences` deliberately does not
		// reach the explicit-key branch (see the node-path complex-key branch).
		if (keyStr.length > IMPLICIT_KEY_MAX_LENGTH) {
			lines.push(`? ${keyStr}`);
			if (valLines.length === 1) {
				lines.push(`: ${valLines[0]}`);
			} else if (valLines[0].startsWith("|") || valLines[0].startsWith(">") || typeof val === "string") {
				// Block scalar header or folded/multi-line string scalar:
				// continuation lines already carry their own indent.
				lines.push(`: ${valLines[0]}`);
				for (let i = 1; i < valLines.length; i++) {
					lines.push(valLines[i]);
				}
			} else {
				// Nested block collection — compact notation: first line on the
				// colon line, the rest padded two columns to align with it
				// (structural, never ctx.indent).
				lines.push(`: ${valLines[0]}`);
				for (let i = 1; i < valLines.length; i++) {
					lines.push(valLines[i] === "" ? valLines[i] : `${EXPLICIT_COMPACT_PAD}${valLines[i]}`);
				}
			}
			continue;
		}

		if (valLines.length === 1 && !isBlockCollection(val, ctx)) {
			// Scalar or empty/flow collection — safe to place inline
			lines.push(`${keyStr}: ${valLines[0]}`);
		} else {
			const first = valLines[0];
			if (first.startsWith("|") || first.startsWith(">") || typeof val === "string") {
				// Block scalar header, or a folded/multi-line string scalar (plain or
				// double-quoted, continuation lines already indented): first line on
				// the key line, continuation lines emitted as-is.
				lines.push(`${keyStr}: ${first}`);
				for (let i = 1; i < valLines.length; i++) {
					lines.push(valLines[i]);
				}
			} else if (Array.isArray(val) && val.length > 0) {
				// Block sequence as mapping value: compact notation (no extra indent)
				// by default; one indent level when `indentSequences` is set (the
				// `yaml` npm package's default presentation). Empty lines (block
				// scalar bodies) are never padded — no trailing whitespace.
				lines.push(`${keyStr}:`);
				for (const vl of valLines) {
					lines.push(ctx.indentSequences && vl !== "" ? `${pad}${vl}` : vl);
				}
			} else {
				// Nested block mapping: key on its own line, value indented
				lines.push(`${keyStr}:`);
				for (const vl of valLines) {
					lines.push(`${pad}${vl}`);
				}
			}
		}
	}
	return lines;
}

// ---------------------------------------------------------------------------
// Tag normalization (for canonical output)
// ---------------------------------------------------------------------------

/** Standard YAML 1.2 secondary tag prefix. */
const YAML_TAG_PREFIX = "tag:yaml.org,2002:";

/**
 * Build a tag resolution map from document directives.
 * Maps tag handles (e.g., "!!", "!e!") to their URI prefixes.
 */
function buildTagMap(directives: ReadonlyArray<RawDirective>): Map<string, string> {
	const map = new Map<string, string>();
	for (const d of directives) {
		if (d.name === "TAG" && d.parameters.length >= 2) {
			map.set(d.parameters[0], d.parameters[1]);
		}
	}
	return map;
}

/**
 * Normalize a tag for canonical output.
 *
 * - Resolves custom handles using the tag map from directives
 * - Abbreviates `tag:yaml.org,2002:XXX` URIs to `!!XXX`
 * - Simplifies verbatim `!<!XXX>` to `!XXX`
 * - Expands non-standard `!!` redefinitions to verbatim form
 */
function normalizeTag(tag: string, tagMap: Map<string, string>): string {
	// Verbatim tag: !<uri>
	if (tag.startsWith("!<") && tag.endsWith(">")) {
		const uri = tag.slice(2, -1);
		// If it's a standard YAML tag, abbreviate to !!shorthand
		if (uri.startsWith(YAML_TAG_PREFIX)) {
			return `!!${uri.slice(YAML_TAG_PREFIX.length)}`;
		}
		// Local verbatim tag !<!foo> → !foo
		if (uri.startsWith("!")) {
			return uri;
		}
		// Non-standard URI — keep verbatim
		return tag;
	}

	// Secondary handle: !!suffix
	if (tag.startsWith("!!")) {
		const customPrefix = tagMap.get("!!");
		if (customPrefix && customPrefix !== YAML_TAG_PREFIX) {
			// !! was redefined to non-standard prefix — expand to verbatim
			return `!<${customPrefix}${tag.slice(2)}>`;
		}
		// Standard !! — already canonical
		return tag;
	}

	// Named handle: !name!suffix
	const namedMatch = tag.match(/^(![\w-]*!)(.*)$/);
	if (namedMatch) {
		const handle = namedMatch[1];
		const suffix = namedMatch[2] ?? "";
		const prefix = tagMap.get(handle);
		if (prefix) {
			const uri = prefix + suffix;
			// Check if resolved URI is a standard YAML tag
			if (uri.startsWith(YAML_TAG_PREFIX)) {
				return `!!${uri.slice(YAML_TAG_PREFIX.length)}`;
			}
			// Non-standard — expand to verbatim
			return `!<${uri}>`;
		}
	}

	// Primary handle: !suffix (non-empty suffix)
	if (tag.startsWith("!") && tag.length > 1 && !tag.startsWith("!!")) {
		const prefix = tagMap.get("!");
		if (prefix) {
			const uri = prefix + tag.slice(1);
			// Check if resolved URI is a standard YAML tag
			if (uri.startsWith(YAML_TAG_PREFIX)) {
				return `!!${uri.slice(YAML_TAG_PREFIX.length)}`;
			}
			// Non-standard — expand to verbatim
			return `!<${uri}>`;
		}
	}

	// Non-specific tag (! alone) or no matching handle
	return tag;
}

/**
 * Recursively normalizes tags on all AST nodes using document directives.
 */
function normalizeNodeTags(node: YamlNode, tagMap: Map<string, string>): YamlNode {
	if (node instanceof YamlScalar) {
		return new YamlScalar({
			value: node.value,
			style: node.style,
			...(node.tag ? { tag: normalizeTag(node.tag, tagMap) } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
			...(node.commentBefore !== undefined ? { commentBefore: node.commentBefore } : {}),
			...(node.comment !== undefined ? { comment: node.comment } : {}),
			...(node.spaceBefore !== undefined ? { spaceBefore: node.spaceBefore } : {}),
			...(node.chomp !== undefined ? { chomp: node.chomp } : {}),
			...(node.blockIndent !== undefined ? { blockIndent: node.blockIndent } : {}),
			...(node.raw !== undefined ? { raw: node.raw } : {}),
			...(node.sourceMultiline !== undefined ? { sourceMultiline: node.sourceMultiline } : {}),
			offset: node.offset,
			length: node.length,
		});
	}
	if (node instanceof YamlMap) {
		return new YamlMap({
			items: node.items.map(
				(pair) =>
					new YamlPair({
						key: normalizeNodeTags(pair.key, tagMap),
						value: pair.value ? normalizeNodeTags(pair.value, tagMap) : null,
					}),
			),
			style: node.style,
			...(node.tag ? { tag: normalizeTag(node.tag, tagMap) } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
			...(node.commentBefore !== undefined ? { commentBefore: node.commentBefore } : {}),
			...(node.comment !== undefined ? { comment: node.comment } : {}),
			...(node.spaceBefore !== undefined ? { spaceBefore: node.spaceBefore } : {}),
			...(node.sourceMultiline !== undefined ? { sourceMultiline: node.sourceMultiline } : {}),
			offset: node.offset,
			length: node.length,
		});
	}
	if (node instanceof YamlSeq) {
		return new YamlSeq({
			items: node.items.map((item) => normalizeNodeTags(item, tagMap)),
			style: node.style,
			...(node.tag ? { tag: normalizeTag(node.tag, tagMap) } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
			...(node.commentBefore !== undefined ? { commentBefore: node.commentBefore } : {}),
			...(node.comment !== undefined ? { comment: node.comment } : {}),
			...(node.spaceBefore !== undefined ? { spaceBefore: node.spaceBefore } : {}),
			...(node.sourceMultiline !== undefined ? { sourceMultiline: node.sourceMultiline } : {}),
			offset: node.offset,
			length: node.length,
		});
	}
	return node;
}

// ---------------------------------------------------------------------------
// Comment stripping (for canonical output)
// ---------------------------------------------------------------------------

/**
 * Recursively strips all comment fields from AST nodes.
 * Used when forceDefaultStyles is true to produce canonical output.
 */
export function stripNodeComments(node: YamlNode): YamlNode {
	if (node instanceof YamlScalar) {
		return new YamlScalar({
			value: node.value,
			style: node.style,
			...(node.tag !== undefined ? { tag: node.tag } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
			...(node.chomp !== undefined ? { chomp: node.chomp } : {}),
			...(node.blockIndent !== undefined ? { blockIndent: node.blockIndent } : {}),
			...(node.raw !== undefined ? { raw: node.raw } : {}),
			...(node.sourceMultiline !== undefined ? { sourceMultiline: node.sourceMultiline } : {}),
			offset: node.offset,
			length: node.length,
		});
	}
	if (node instanceof YamlMap) {
		return new YamlMap({
			items: node.items.map(
				(pair) =>
					new YamlPair({
						key: stripNodeComments(pair.key),
						value: pair.value ? stripNodeComments(pair.value) : null,
					}),
			),
			style: node.style,
			...(node.tag !== undefined ? { tag: node.tag } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
			...(node.sourceMultiline !== undefined ? { sourceMultiline: node.sourceMultiline } : {}),
			offset: node.offset,
			length: node.length,
		});
	}
	if (node instanceof YamlSeq) {
		return new YamlSeq({
			items: node.items.map(stripNodeComments),
			style: node.style,
			...(node.tag !== undefined ? { tag: node.tag } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
			...(node.sourceMultiline !== undefined ? { sourceMultiline: node.sourceMultiline } : {}),
			offset: node.offset,
			length: node.length,
		});
	}
	return node;
}

// ---------------------------------------------------------------------------
// AST node stringification
// ---------------------------------------------------------------------------

/**
 * Stringifies a YAML AST node into lines (no leading indent), respecting
 * style metadata from the node.
 */
function stringifyNodeLines(node: YamlNode, ctx: StringifyContext, depth: number): string[] {
	// Depth guard, symmetric to the value-path trio: the node-path stringifier
	// (this fn plus its map/seq helpers) is mutually recursive with no natural
	// bound, so a synthetic AST nested deeper than the composer's cap would
	// overflow the stack as a RangeError defect on a public boundary
	// (YamlDocument.stringify / YamlDocument.schema encode). Parsed ASTs are
	// composer-bounded to MAX_NESTING_DEPTH and never trip this; only hand-built
	// deep trees do.
	if (depth > MAX_NESTING_DEPTH) throw new StringifyDepthExceeded();

	if (node instanceof YamlScalar) {
		return stringifyScalarNodeLines(node, ctx);
	}
	if (node instanceof YamlMap) {
		return stringifyMapNodeLines(node, ctx, depth);
	}
	if (node instanceof YamlSeq) {
		return stringifySeqNodeLines(node, ctx, depth);
	}
	if (node instanceof YamlAlias) {
		return [`*${node.name}`];
	}
	return ["null"];
}

/**
 * Stringifies a YamlScalar node into lines, using the node's style metadata.
 */
function stringifyScalarNodeLines(node: YamlScalar, ctx: StringifyContext): string[] {
	// When forcing default styles, preserve the node's original style for multiline
	// strings (block-literal vs block-folded vs double-quoted) since the canonical
	// output retains scalar presentation style even in normalized form.
  const style: ScalarStyle = node.style ?? ctx.defaultScalarStyle;
	const val = node.value;

	// Empty scalar (zero-length in source) with tag or anchor: render just tag/anchor
	const isEmpty = node.length === 0 && (val === null || val === undefined || val === "");
	if (isEmpty && (node.tag || node.anchor)) {
		const parts: string[] = [];
		if (node.tag) parts.push(node.tag);
		if (node.anchor) parts.push(`&${node.anchor}`);
		return [parts.join(" ")];
	}

	let lines: string[];
	if (val === null || val === undefined) {
		// Empty scalar (zero-length) without tag/anchor renders as empty string
		if (isEmpty) {
			lines = [""];
		} else {
			lines = ["null"];
		}
	} else if (typeof val === "boolean") {
		lines = [val ? "true" : "false"];
	} else if (typeof val === "number") {
		// Prefer the source representation when available so non-canonical
		// numeric formats (hex `0xFFEEBB`, trailing zeros `450.00`) survive
		// the round-trip.
		lines = [node.raw !== undefined ? node.raw : renderNumber(val)];
	} else if (typeof val === "string") {
		// When a tag is present, type-conflict quoting is unnecessary
		const rendered = renderString(
			val,
			style,
			" ".repeat(ctx.indent),
			!!node.tag,
			ctx.forceDefaultStyles,
			node.chomp,
			ctx.parentPosition,
			ctx.quoteStyle,
			node.blockIndent,
			ctx.quoteCompat,
		);
		lines = rendered.split("\n");
	} else {
		lines = [renderDoubleQuoted(String(val))];
	}
	// Prepend tag first, then anchor, so the final output reads &anchor !!tag value
	if (node.tag) {
		lines[0] = `${node.tag} ${lines[0]}`;
	}
	if (node.anchor) {
		lines[0] = `&${node.anchor} ${lines[0]}`;
	}
	return lines;
}

/** The YAML merge key. */
const MERGE_KEY = "<<";

/**
 * True when a mapping key must be emitted plain because quoting it would
 * change what the document means.
 *
 * The merge key is the only scalar in this position where the plain and
 * quoted forms resolve to different YAML types: a plain `<<` key resolves to
 * `tag:yaml.org,2002:merge` and splices the aliased mapping into its parent,
 * while `'<<'` is an ordinary string key that merges nothing. The difference
 * is silent — the document still parses and still round-trips — so re-emitting
 * a merge key quoted is a semantic rewrite of the kind the fidelity obligation
 * forbids.
 *
 * Deliberately narrow. It fires only on a plain-styled scalar carrying no tag
 * and no anchor, so an author's explicitly quoted `'<<'` (a literal string key
 * they meant) and any tagged key keep the form they were written in. A key
 * with no style at all counts as plain: an unstyled `<<` built by hand can
 * only have been meant as a merge key, and preserving that meaning outranks
 * normalizing its presentation.
 */
function isPlainMergeKey(node: YamlNode | null | undefined): boolean {
	return (
		node instanceof YamlScalar &&
		node.value === MERGE_KEY &&
		(node.style ?? "plain") === "plain" &&
		node.tag === undefined &&
		node.anchor === undefined
	);
}

/**
 * Renders a mapping key, honoring the keys that must stay plain before
 * falling back to ordinary node rendering. Both the flow and the block
 * mapping branches route through here so the two cannot disagree.
 */
function stringifyMappingKeyLines(node: YamlNode, ctx: StringifyContext, depth: number): string[] {
	if (isPlainMergeKey(node)) return [MERGE_KEY];
	return stringifyNodeLines(node, ctx, depth);
}

/**
 * Undo the capture-side escape on one stored comment line: a spaces-only
 * slice was stored with one extra trailing space so it cannot collide with
 * `""`, the embedded-blank-line encoding (see `rawCommentText`).
 */
function unescapeCommentLine(line: string): string {
	return /^ +$/.test(line) ? line.slice(0, -1) : line;
}

/**
 * Render a stored comment block, one output line per stored line. Stored
 * text is the RAW post-`#` slice (reference parity) with spaces-only lines
 * carrying one escape space: `""` is an embedded blank line; any other line
 * renders as `#` + the unescaped slice (`" "` → `#`, `"  "` → `# `).
 */
function commentBlockLines(comment: string): string[] {
	return comment.split("\n").map((l) => (l === "" ? "" : `#${unescapeCommentLine(l)}`));
}

/**
 * Splice a trailing comment onto the FIRST line of an already-rendered node —
 * for a block scalar, the header line, which is the one line of the scalar
 * that legally carries a `#` comment.
 */
function withHeaderComment(rendered: string, comment: string): string {
	const nl = rendered.indexOf("\n");
	return nl === -1
		? `${rendered}${renderTrailingComment(comment)}`
		: `${rendered.slice(0, nl)}${renderTrailingComment(comment)}${rendered.slice(nl)}`;
}

/**
 * The leading comment block of a mapping entry. Under the node-level comment
 * model it lives on the entry's KEY node, not on the pair.
 */
function pairLeading(pair: YamlPair): string | undefined {
	return pair.key.commentBefore;
}

/**
 * The trailing comment of a mapping entry: it belongs to whichever node owns
 * the entry's last line — the value when there is one, otherwise the key. For
 * a block-scalar value that line is the HEADER line, which is why a block
 * scalar's header comment needs no separate concept.
 */
function pairTrailing(pair: YamlPair): string | undefined {
	return (pair.value ?? pair.key).comment;
}

/** True when a blank line preceded the entry (recorded on its KEY node). */
function pairSpaceBefore(pair: YamlPair): boolean | undefined {
	return pair.key.spaceBefore;
}

/**
 * The trailing comment to place on an entry's own line, given how its value
 * actually rendered.
 *
 * A collection's `comment` field carries its TERMINAL comment run — the
 * own-line comments after its last entry — and the collection emits those
 * itself, after that last entry. Only when the collection renders on a single
 * line (inline flow, `a: {b: 1} # t`) is its `comment` the entry's trailing
 * comment. Reading it unconditionally emits the same comment twice: once on
 * the entry's line and again as the terminal run.
 */
function entryTrailing(pair: YamlPair, ctx: StringifyContext): string | undefined {
	// The KEY carries a trailing comment only when the value renders below it,
	// so the key owns its line and the comment stays where it was written
	// (`push: # only main`). A comment on its own line above the value is that
	// value's `commentBefore` and keeps its own line — the two source shapes
	// are different bytes and stay that way.
	if (pair.key.comment !== undefined) return pair.key.comment;
	const owner = pair.value ?? pair.key;
	if (rendersAcrossLines(owner, ctx)) return undefined;
	return owner.comment;
}

/**
 * True when `node` renders across more than one line, so its own `comment` is
 * a terminal run rather than something that can sit on the entry's line.
 */
function rendersAcrossLines(node: YamlNode, ctx: StringifyContext): boolean {
	if (!(node instanceof YamlMap || node instanceof YamlSeq)) return false;
	if (node.items.length === 0) return false;
	const style = ctx.forceDefaultStyles ? ctx.defaultCollectionStyle : (node.style ?? ctx.defaultCollectionStyle);
	if (style === "block" || node.sourceMultiline === true) return true;
	// A flow collection carrying INNER comments is emitted one entry per line —
	// a `#` between the brackets would swallow the closing one. The collection's
	// OWN comment is not such a case: it renders after the closing bracket, so
	// it neither swallows anything nor forces the layout, and `a: {b: 1} # t`
	// stays on one line. Canonical mode emits no comments at all.
	if (ctx.forceDefaultStyles) return false;
	return node instanceof YamlMap
		? node.items.some(
				(p) => pairLeading(p) !== undefined || (p.value ?? p.key).comment !== undefined || pairSpaceBefore(p) === true,
			)
		: node.items.some(
				(item) => item.commentBefore !== undefined || item.comment !== undefined || item.spaceBefore === true,
			);
}

/** Render a trailing comment for appending after content on the same line. */
function renderTrailingComment(comment: string): string {
	const flat = comment.split("\n").map(unescapeCommentLine).join(" ");
	return ` #${flat}`;
}

/**
 * Emits the `: value` line(s) of an explicit-key block-mapping entry, in
 * compact notation where the value admits it (first line on the colon line,
 * continuation lines indented to align). Shared by the complex-key branch and
 * the implicit-key length spill; `indentSequences` deliberately does not reach
 * this branch (sequence values always align compactly under `: `).
 *
 * Returns the `lines` index that can safely carry the pair's trailing
 * comment (the line where an inline value ends), or `-1` when no line is
 * safe (a compact block collection or a block-scalar header).
 */
function pushExplicitKeyValueLines(
	lines: string[],
	valNode: YamlNode | null,
	ctx: StringifyContext,
	depth: number,
	pad: string,
): number {
	if (!valNode) {
		lines.push(":");
		return lines.length - 1;
	}
	const valLines = stringifyNodeLines(valNode, ctx, depth + 1);
	// #348: the value node's OWN leading comment needs a line of its own above
	// the value, which none of the compact spellings below can give it — take
	// the non-compact `:` form so the comment block sits at the value's indent.
	// Every sibling branch of the block-mapping stringifier already does this;
	// the explicit-key branch dropped the comment instead. Aliases are included:
	// they carry the comment triple like every other node class.
	const valueLeading = !ctx.forceDefaultStyles ? valNode.commentBefore : undefined;
	if (valueLeading !== undefined) {
		const colonIdx = lines.length;
		lines.push(":");
		for (const cl of commentBlockLines(valueLeading)) lines.push(cl === "" ? "" : `${pad}${cl}`);
		for (const vl of valLines) lines.push(vl === "" ? "" : `${pad}${vl}`);
		return colonIdx;
	}
	if (valLines.length === 1) {
		lines.push(`: ${valLines[0]}`);
		return lines.length - 1;
	}
	const first = valLines[0];
	// Detect block scalar headers and multi-line quoted scalars,
	// either bare or after an optional `&anchor` / `!tag` prefix.
	const firstStripped = stripScalarMetadataPrefix(first);
	const isBlockScalarHeader = firstStripped.startsWith("|") || firstStripped.startsWith(">");
	const valIsScalar = valNode instanceof YamlScalar;
	const isInlineQuoted = valIsScalar && (firstStripped.startsWith("'") || firstStripped.startsWith('"'));
	if (isBlockScalarHeader || isInlineQuoted) {
		const headerIdx = lines.length;
		lines.push(`: ${first}`);
		for (let v = 1; v < valLines.length; v++) {
			lines.push(valLines[v]);
		}
		// A block scalar's header line, or a multi-line quoted scalar's closing
		// line, is where this entry's trailing comment belongs — the caller owns
		// placing it, exactly as for every other value shape.
		return isBlockScalarHeader ? headerIdx : lines.length - 1;
	}
	if (first.startsWith("-")) {
		// Block sequence value — compact notation: first item on the colon
		// line, remaining items padded two columns to align with it
		// (structural, never ctx.indent).
		lines.push(`: ${first}`);
		for (let v = 1; v < valLines.length; v++) {
			lines.push(valLines[v] === "" ? "" : `${EXPLICIT_COMPACT_PAD}${valLines[v]}`);
		}
		return -1;
	}
	const valIsBlockMap =
		valNode instanceof YamlMap &&
		valNode.items.length > 0 &&
		(ctx.forceDefaultStyles ? ctx.defaultCollectionStyle : (valNode.style ?? ctx.defaultCollectionStyle)) === "block";
	if (valIsBlockMap) {
		// Block mapping value — compact notation: first pair on the colon
		// line, remaining pairs padded two columns to align with it
		// (structural, never ctx.indent).
		lines.push(`: ${first}`);
		for (let v = 1; v < valLines.length; v++) {
			lines.push(valLines[v] === "" ? "" : `${EXPLICIT_COMPACT_PAD}${valLines[v]}`);
		}
		return -1;
	}
	const colonIdx = lines.length;
	lines.push(":");
	for (const vl of valLines) {
		lines.push(vl === "" ? "" : `${pad}${vl}`);
	}
	return colonIdx;
}

/**
 * Stringifies a YamlMap node into lines, using the node's collection style.
 */
function stringifyMapNodeLines(node: YamlMap, ctx: StringifyContext, depth: number): string[] {
	const style: CollectionStyle = ctx.forceDefaultStyles
		? ctx.defaultCollectionStyle
		: (node.style ?? ctx.defaultCollectionStyle);
	let items = [...node.items];
	if (ctx.sortKeys) {
		items = items.sort((a, b) => {
			const ka = a.key instanceof YamlScalar ? String(a.key.value) : "";
			const kb = b.key instanceof YamlScalar ? String(b.key.value) : "";
			return ka < kb ? -1 : ka > kb ? 1 : 0;
		});
	}

	if (items.length === 0) {
		let line = "{}";
		const emptyPrefix = buildMetadataPrefix(node.tag, node.anchor);
		if (emptyPrefix) line = `${emptyPrefix} ${line}`;
		return [line];
	}

	if (style === "flow") {
		const flowPrefix = buildMetadataPrefix(node.tag, node.anchor);
		// Mirrors `rendersAcrossLines`: inner comments force the layout, and so
		// does a terminal run that was written INSIDE the braces. A trailing
		// comment written after the closing brace does not — it renders past
		// the closer and the entry keeps its single line.
		const flowHasComments =
			!ctx.forceDefaultStyles &&
			(items.some(
				(p) => pairLeading(p) !== undefined || pairTrailing(p) !== undefined || pairSpaceBefore(p) === true,
			) ||
				(node.comment !== undefined && node.sourceMultiline === true));
		if (flowHasComments) {
			// Comment-carrying flow mapping: one entry per line (multi-line
			// flow layout), so a `#` comment cannot swallow the closing brace.
			const flowPad = " ".repeat(ctx.indent);
			const flowLines: string[] = [flowPrefix ? `${flowPrefix} {` : "{"];
			for (let fi = 0; fi < items.length; fi++) {
				const pair = items[fi] as YamlPair;
				if (pairSpaceBefore(pair) === true) flowLines.push("");
				const flowLeading = pairLeading(pair);
				if (flowLeading !== undefined) {
					// An embedded blank line (`""`) stays unpadded — padding it
					// would emit a whitespace-only line.
					for (const cl of commentBlockLines(flowLeading)) flowLines.push(cl === "" ? "" : `${flowPad}${cl}`);
				}
				const keyStr = pair.key ? stringifyMappingKeyLines(pair.key, ctx, depth + 1).join(" ") : "null";
				const valStr = pair.value ? stringifyNodeLines(pair.value, ctx, depth + 1).join(" ") : "null";
				const comma = fi < items.length - 1 ? "," : "";
				const flowTrailing = pairTrailing(pair);
				const trailing = flowTrailing !== undefined ? renderTrailingComment(flowTrailing) : "";
				flowLines.push(`${flowPad}${keyStr}: ${valStr}${comma}${trailing}`);
			}
			if (node.comment !== undefined) {
				for (const cl of commentBlockLines(node.comment)) flowLines.push(cl === "" ? "" : `${flowPad}${cl}`);
			}
			flowLines.push("}");
			return flowLines;
		}
		const pairs = items.map((pair) => {
			const keyStr = pair.key ? stringifyMappingKeyLines(pair.key, ctx, depth + 1).join(" ") : "null";
			const valStr = pair.value ? stringifyNodeLines(pair.value, ctx, depth + 1).join(" ") : "null";
			return `${keyStr}: ${valStr}`;
		});
		let line = `{${pairs.join(", ")}}`;
		if (flowPrefix) line = `${flowPrefix} ${line}`;
		return [line];
	}

	// Block style
	const pad = " ".repeat(ctx.indent);
	const emitComments = !ctx.forceDefaultStyles;
	const lines: string[] = [];
	/** Append a pair's trailing comment to `lines[idx]` (flattened to one line); `-1` drops it. */
	const appendTrailing = (idx: number, comment: string | undefined): void => {
		if (!emitComments || comment === undefined || idx < 0 || idx >= lines.length) return;
		lines[idx] = `${lines[idx]}${renderTrailingComment(comment)}`;
	};
	/** A value node's own leading comment block, or undefined. */
	const valueLeading = (valNode: YamlNode): string | undefined => (emitComments ? valNode.commentBefore : undefined);
	for (const pair of items) {
		if (emitComments && pairSpaceBefore(pair) === true) lines.push("");
		const leading = emitComments ? pairLeading(pair) : undefined;
		// The key's own trailing comment is set only when the value renders below
		// it; the value's own is whatever trails the value on the value's line.
		const keyOwnComment = emitComments ? pair.key.comment : undefined;
		const valueOwnComment = emitComments && pair.value !== null ? pair.value.comment : undefined;
		if (leading !== undefined) {
			for (const cl of commentBlockLines(leading)) lines.push(cl);
		}
		// Explicit `? key\n: value` syntax is required when:
		// - Key is a YamlMap (mapping-as-key always uses `? ` so the inner
		//   pair's `:` is not confused with the outer pair's `:`)
		// - Key is a YamlSeq whose rendered form spans multiple lines (block
		//   style or multi-line flow). Single-line flow seqs (e.g. empty
		//   `[]`) can be implicit `[]: value` (M2N8/01).
		// - Key is a scalar whose value contains a newline (cannot be expressed
		//   as an implicit `key: value` line in block form)
		// - Key is a block-style scalar (block-literal/block-folded) whose
		//   header introduces a multi-line scalar
		const keyIsScalarWithNewline =
			pair.key instanceof YamlScalar &&
			((typeof pair.key.value === "string" && pair.key.value.includes("\n")) ||
				pair.key.style === "block-literal" ||
				pair.key.style === "block-folded");
		// A non-empty collection (YamlMap or YamlSeq) used as a key forces
		// explicit `? ` form because its block-rendered representation cannot
		// be inlined safely. Empty collections render as `[]` / `{}` on one
		// line and CAN be implicit (M2N8/01: `[]: x`).
		const keyIsNonEmptyCollection =
			(pair.key instanceof YamlMap || pair.key instanceof YamlSeq) && pair.key.items.length > 0;
		const isComplexKey = keyIsNonEmptyCollection || keyIsScalarWithNewline;
		if (isComplexKey) {
			const keyLines = stringifyNodeLines(pair.key, ctx, depth + 1);
			// Emit "? " followed by the key
			lines.push(`? ${keyLines[0]}`);
			const explicitKeyLineIdx = lines.length - 1;
			// When the first key line is just metadata (`&anchor` and/or `!tag`),
			// the continuation lines are the actual collection content and should
			// be emitted without an extra indent — they sit at the same level as
			// `?` (compact form). Block-style scalar keys (`|`/`>`) already bake
			// their own indent into the rendered continuation lines, so no extra
			// pad is needed. Otherwise pad continuation lines two columns to
			// align with the first line after `? ` (structural, never
			// ctx.indent — see EXPLICIT_COMPACT_PAD).
			const firstTokens = keyLines[0].trim().split(/\s+/).filter(Boolean);
			const firstIsMetaOnly =
				firstTokens.length > 0 && firstTokens.every((t) => t.startsWith("&") || t.startsWith("!"));
			const keyIsBlockScalar =
				pair.key instanceof YamlScalar && (pair.key.style === "block-literal" || pair.key.style === "block-folded");
			const contPad = firstIsMetaOnly || keyIsBlockScalar ? "" : EXPLICIT_COMPACT_PAD;
			for (let k = 1; k < keyLines.length; k++) {
				lines.push(`${contPad}${keyLines[k]}`);
			}
			// Emit ": " followed by the value. A single-line key can carry the
			// pair's trailing comment when the value line cannot; a multi-line
			// key cannot (the comment would land inside the key content), so
			// the comment is dropped there.
			const inlineIdx = pushExplicitKeyValueLines(lines, pair.value, ctx, depth, pad);
			appendTrailing(
				inlineIdx >= 0 ? inlineIdx : keyLines.length === 1 ? explicitKeyLineIdx : -1,
				entryTrailing(pair, ctx),
			);
			continue;
		}

		// 5T43: in canonical mode, drop quotes from a quoted key whose content
		// is a simple identifier when the source map was a SINGLE-line flow
		// collection. The quotes were structurally needed in flow source
		// (e.g. `"key":value` cannot be `key:value` because flow tokens are
		// delimiter-tight) but in the converted block form an unquoted plain
		// key is unambiguous. Restricted to identifier-style content
		// (alphanumeric+underscore, no spaces) so multi-word quoted keys
		// like `"single line"` are kept (9BXH).
		let resolvedKeyStr: string;
		if (
			ctx.forceDefaultStyles &&
			node.style === "flow" &&
			node.sourceMultiline !== true &&
			pair.key instanceof YamlScalar &&
			(pair.key.style === "single-quoted" || pair.key.style === "double-quoted") &&
			typeof pair.key.value === "string" &&
			/^[A-Za-z_][A-Za-z0-9_]*$/.test(pair.key.value)
		) {
			resolvedKeyStr = pair.key.value;
		} else {
			resolvedKeyStr = pair.key ? stringifyMappingKeyLines(pair.key, ctx, depth + 1).join(" ") : "null";
		}
		const keyStr = resolvedKeyStr;
		// Rendered key past the implicit-key limit: spill to explicit-key form
		// (`? key` / `: value`) so strict parsers accept the output — the
		// reference `yaml` package's behaviour. The check runs on the rendered
		// key (quotes count), and only in block context (flow returned above).
		if (keyStr.length > IMPLICIT_KEY_MAX_LENGTH) {
			lines.push(`? ${keyStr}`);
			const spillKeyLineIdx = lines.length - 1;
			const inlineIdx = pushExplicitKeyValueLines(lines, pair.value, ctx, depth, pad);
			appendTrailing(inlineIdx >= 0 ? inlineIdx : spillKeyLineIdx, entryTrailing(pair, ctx));
			continue;
		}
		// Alias keys need a space before the colon to avoid the alias name
		// absorbing the `:`. Empty scalar keys whose only rendering is an
		// anchor or tag (e.g. `&a` or `!!str`) need the same disambiguation.
		const keyIsAnchoredOrTaggedEmpty =
			pair.key instanceof YamlScalar &&
			pair.key.length === 0 &&
			(pair.key.value === null || pair.key.value === undefined || pair.key.value === "") &&
			(pair.key.anchor !== undefined || pair.key.tag !== undefined);
		const sep = pair.key instanceof YamlAlias || keyIsAnchoredOrTaggedEmpty ? " :" : ":";
		const valNode = pair.value;
		if (!valNode) {
			// 4ABK: when the document ROOT is a multi-line flow map AND the
			// pair has a non-empty plain key, emit `key: null` rather than
			// `key:` so the null is unambiguous in canonical (block) form.
			// Restricted to root via `ctx.parentPosition === undefined` so
			// nested flow maps (8KB6: flow inside a block-seq item) keep
			// `key:`. Single-line flow root keeps `key:` too — only
			// multi-line flow root triggers the explicit-null form.
			const isPlainKey = pair.key instanceof YamlScalar && pair.key.style === "plain";
			const keyIsNonEmpty = pair.key instanceof YamlScalar && pair.key.length > 0;
			const isRootFlowMap = ctx.parentPosition === undefined && node.style === "flow" && node.sourceMultiline === true;
			if (ctx.forceDefaultStyles && isRootFlowMap && isPlainKey && keyIsNonEmpty) {
				lines.push(`${keyStr}${sep} null`);
			} else {
				lines.push(`${keyStr}${sep}`);
			}
			appendTrailing(lines.length - 1, entryTrailing(pair, ctx));
			continue;
		}
		const valCtx: StringifyContext = { ...ctx, parentPosition: "block-map-value" };
		const valLines = stringifyNodeLines(valNode, valCtx, depth + 1);
		const valLeading = valueLeading(valNode);
		const isBlockSeqValue =
			valNode instanceof YamlSeq &&
			valNode.items.length > 0 &&
			(ctx.forceDefaultStyles ? ctx.defaultCollectionStyle : (valNode.style ?? ctx.defaultCollectionStyle)) === "block";
		if (isBlockSeqValue) {
			// Block sequence as mapping value: compact notation (no extra indent)
			// by default; one indent level when `indentSequences` is set (the
			// `yaml` npm package's default presentation). Empty lines (block
			// scalar bodies) are never padded — no trailing whitespace.
			// If seq has metadata (anchor/tag), place it on the key line
			const seqMeta = buildMetadataPrefix(valNode.tag, valNode.anchor);
			const startIdx = seqMeta ? 1 : 0; // skip metadata line if present
			lines.push(seqMeta ? `${keyStr}${sep} ${seqMeta}` : `${keyStr}${sep}`);
			appendTrailing(lines.length - 1, entryTrailing(pair, ctx));
			if (valLeading !== undefined) {
				// The sequence's own leading comment sits at the items' indent.
				for (const cl of commentBlockLines(valLeading)) {
					lines.push(ctx.indentSequences ? `${pad}${cl}` : cl);
				}
			}
			for (let i = startIdx; i < valLines.length; i++) {
				const vl = valLines[i];
				lines.push(ctx.indentSequences && vl !== "" ? `${pad}${vl}` : vl);
			}
		} else if (
			valNode instanceof YamlMap &&
			valNode.items.length > 0 &&
			(ctx.forceDefaultStyles ? ctx.defaultCollectionStyle : (valNode.style ?? ctx.defaultCollectionStyle)) === "block"
		) {
			// Non-empty block mapping as value: put on next line with indent
			const mapMeta = buildMetadataPrefix(valNode.tag, valNode.anchor);
			const startIdx = mapMeta ? 1 : 0;
			lines.push(mapMeta ? `${keyStr}${sep} ${mapMeta}` : `${keyStr}${sep}`);
			appendTrailing(lines.length - 1, entryTrailing(pair, ctx));
			if (valLeading !== undefined) {
				for (const cl of commentBlockLines(valLeading)) lines.push(`${pad}${cl}`);
			}
			for (let i = startIdx; i < valLines.length; i++) {
				lines.push(valLines[i] === "" ? "" : `${pad}${valLines[i]}`);
			}
		} else if (valLines.length === 1 && (valLeading !== undefined || keyOwnComment !== undefined)) {
			// The value renders BELOW the key, for either of two reasons: it has a
			// leading comment block that needs the line above it, or the key itself
			// carries a trailing comment — which in this model means the value was
			// written below in the first place. Hoisting it back onto the key line
			// would put two comments on one line and silently drop one of them.
			// Each node's trailing comment goes on that node's OWN line. Routing
			// the key line through `entryTrailing` reached past an absent key
			// comment to the VALUE's, printing it on the key line and skipping
			// the value's own — `a:\n  # lead\n  1 # vc\n` lost the line it was
			// written on.
			lines.push(`${keyStr}${sep}`);
			appendTrailing(lines.length - 1, keyOwnComment);
			if (valLeading !== undefined) {
				for (const cl of commentBlockLines(valLeading)) lines.push(`${pad}${cl}`);
			}
			lines.push(valLines[0] === "" ? "" : `${pad}${valLines[0]}`);
			appendTrailing(lines.length - 1, valueOwnComment);
		} else if (valLines.length === 1) {
			// Empty value: `key:` with no trailing space
			lines.push(valLines[0] === "" ? `${keyStr}${sep}` : `${keyStr}${sep} ${valLines[0]}`);
			appendTrailing(lines.length - 1, entryTrailing(pair, ctx));
		} else {
			const first = valLines[0];
			// Detect block scalar headers and multi-line quoted scalars after the
			// optional `&anchor` / `!tag` prefix that the scalar renderer may add.
			const firstStripped = stripScalarMetadataPrefix(first);
			const isBlockScalarHeader = firstStripped.startsWith("|") || firstStripped.startsWith(">");
			const valIsScalar = valNode instanceof YamlScalar;
			const isInlineQuoted = valIsScalar && (firstStripped.startsWith("'") || firstStripped.startsWith('"'));
			if (isBlockScalarHeader || isInlineQuoted) {
				if (valLeading !== undefined) {
					// The value has its own leading block, which needs the line above
					// the value — so the value spills off the key line and the header
					// goes with it, keeping one comment per line.
					lines.push(`${keyStr}${sep}`);
					for (const cl of commentBlockLines(valLeading)) lines.push(cl === "" ? "" : `${pad}${cl}`);
					const spilledIdx = lines.length;
					lines.push(`${pad}${first}`);
					for (let i = 1; i < valLines.length; i++) {
						lines.push(valLines[i]);
					}
					appendTrailing(isBlockScalarHeader ? spilledIdx : lines.length - 1, entryTrailing(pair, ctx));
					continue;
				}
				// The KEY's own comment and a block scalar's header comment both want
				// the key line, because the header is emitted there. Give each a
				// line: the key keeps its own, and the header spills to an indented
				// line of its own (`a: # pair` / `  | # hdr` / `  body`).
				const keyComment = !ctx.forceDefaultStyles ? pair.key.comment : undefined;
				const scalarComment = isBlockScalarHeader && valNode instanceof YamlScalar ? valNode.comment : undefined;
				if (keyComment !== undefined && scalarComment !== undefined) {
					lines.push(`${keyStr}${sep}`);
					appendTrailing(lines.length - 1, keyComment);
					const spilledIdx = lines.length;
					lines.push(`${pad}${first}`);
					for (let i = 1; i < valLines.length; i++) {
						lines.push(valLines[i]);
					}
					appendTrailing(spilledIdx, scalarComment);
					continue;
				}
				const headerIdx = lines.length;
				lines.push(`${keyStr}${sep} ${first}`);
				for (let i = 1; i < valLines.length; i++) {
					lines.push(valLines[i]);
				}
				// The entry's trailing comment goes on the line its VALUE ends on:
				// for a block scalar that is the header line (`key: | # c`, the one
				// line of a block scalar that legally carries a `#`), for a
				// multi-line quoted scalar its closing line. A block scalar's
				// "header comment" and the entry's trailing comment are the same
				// field on the same node under the node-level model, so there is no
				// arbitration between them left to do.
				appendTrailing(isBlockScalarHeader ? headerIdx : lines.length - 1, entryTrailing(pair, ctx));
			} else {
				// Check if this is a block map value with metadata prefix
				const isBlockMapValue =
					valNode instanceof YamlMap &&
					(ctx.forceDefaultStyles ? ctx.defaultCollectionStyle : (valNode.style ?? ctx.defaultCollectionStyle)) ===
						"block";
				const mapMeta = isBlockMapValue ? buildMetadataPrefix(valNode.tag, valNode.anchor) : undefined;
				if (mapMeta) {
					// Place metadata on key line, skip metadata line in valLines
					lines.push(`${keyStr}${sep} ${mapMeta}`);
					appendTrailing(lines.length - 1, entryTrailing(pair, ctx));
					for (let i = 1; i < valLines.length; i++) {
						lines.push(valLines[i] === "" ? "" : `${pad}${valLines[i]}`);
					}
				} else {
					lines.push(`${keyStr}${sep}`);
					appendTrailing(lines.length - 1, entryTrailing(pair, ctx));
					if (valLeading !== undefined) {
						for (const cl of commentBlockLines(valLeading)) lines.push(`${pad}${cl}`);
					}
					for (const vl of valLines) {
						lines.push(vl === "" ? "" : `${pad}${vl}`);
					}
				}
			}
		}
	}
	// The mapping's own trailing comment: own-line comment lines after the
	// last entry, at the entries' indent.
	if (emitComments && node.comment !== undefined) {
		for (const cl of commentBlockLines(node.comment)) lines.push(cl);
	}
	// Anchor/tag on block collections: place on own line before content
	const prefix = buildMetadataPrefix(node.tag, node.anchor);
	if (prefix) {
		lines.unshift(prefix);
	}
	return lines;
}

/**
 * Builds a metadata prefix string from tag and anchor.
 * Returns the combined prefix or undefined if neither is present.
 */
function buildMetadataPrefix(tag: string | undefined, anchor: string | undefined): string | undefined {
	if (!tag && !anchor) return undefined;
	// Canonical ordering: &anchor !!tag (anchor before tag)
	const parts: string[] = [];
	if (anchor) parts.push(`&${anchor}`);
	if (tag) parts.push(tag);
	return parts.join(" ");
}

/**
 * Strips a leading run of `&anchor`/`!tag` metadata tokens (each followed by
 * whitespace) from a rendered scalar line and returns the remainder. Used to
 * detect quoted/block scalar style after the optional metadata prefix that
 * `stringifyScalarNodeLines` may prepend to the first output line.
 */
function stripScalarMetadataPrefix(line: string): string {
	let i = 0;
	while (i < line.length) {
		const ch = line[i];
		if (ch !== "&" && ch !== "!") break;
		let j = i + 1;
		while (j < line.length && line[j] !== " " && line[j] !== "\t") j++;
		if (j >= line.length || j === i + 1) break;
		while (j < line.length && (line[j] === " " || line[j] === "\t")) j++;
		i = j;
	}
	return line.slice(i);
}

/**
 * Stringifies a YamlSeq node into lines, using the node's collection style.
 */
function stringifySeqNodeLines(node: YamlSeq, ctx: StringifyContext, depth: number): string[] {
	const style: CollectionStyle = ctx.forceDefaultStyles
		? ctx.defaultCollectionStyle
		: (node.style ?? ctx.defaultCollectionStyle);
	const items = [...node.items];

	if (items.length === 0) {
		let line = "[]";
		const emptyPrefix = buildMetadataPrefix(node.tag, node.anchor);
		if (emptyPrefix) line = `${emptyPrefix} ${line}`;
		return [line];
	}

	const emitComments = !ctx.forceDefaultStyles;
	const itemFields = (
		item: YamlNode,
	): { commentBefore?: string; comment?: string; spaceBefore?: boolean } | undefined => {
		if (!emitComments) return undefined;
		if (item.commentBefore === undefined && item.comment === undefined && item.spaceBefore !== true) return undefined;
		return item;
	};

	if (style === "flow") {
		const flowPrefix = buildMetadataPrefix(node.tag, node.anchor);
		// Mirrors `rendersAcrossLines`: inner comments force the layout, and so
		// does a terminal run that was written INSIDE the brackets. A trailing
		// comment written after the closing bracket does not — it renders past
		// the closer and the entry keeps its single line.
		const flowHasComments =
			emitComments &&
			(items.some((it) => itemFields(it) !== undefined) ||
				(node.comment !== undefined && node.sourceMultiline === true));
		if (flowHasComments) {
			// Comment-carrying flow sequence: one entry per line (multi-line
			// flow layout), so a `#` comment cannot swallow the closing bracket.
			const flowPad = " ".repeat(ctx.indent);
			const flowLines: string[] = [flowPrefix ? `${flowPrefix} [` : "["];
			for (let fi = 0; fi < items.length; fi++) {
				const item = items[fi] as YamlNode;
				const fields = itemFields(item);
				if (fields?.spaceBefore === true) flowLines.push("");
				if (fields?.commentBefore !== undefined) {
					// An embedded blank line (`""`) stays unpadded — padding it
					// would emit a whitespace-only line.
					for (const cl of commentBlockLines(fields.commentBefore)) flowLines.push(cl === "" ? "" : `${flowPad}${cl}`);
				}
				const itemStr = stringifyNodeLines(item, ctx, depth + 1).join(" ");
				const comma = fi < items.length - 1 ? "," : "";
				const trailing = fields?.comment !== undefined ? renderTrailingComment(fields.comment) : "";
				flowLines.push(`${flowPad}${itemStr}${comma}${trailing}`);
			}
			if (node.comment !== undefined) {
				for (const cl of commentBlockLines(node.comment)) flowLines.push(cl === "" ? "" : `${flowPad}${cl}`);
			}
			flowLines.push("]");
			return flowLines;
		}
		const parts = items.map((item) => stringifyNodeLines(item, ctx, depth + 1).join(" "));
		let line = `[${parts.join(", ")}]`;
		if (flowPrefix) line = `${flowPrefix} ${line}`;
		return [line];
	}

	// Block style
	const pad = " ".repeat(ctx.indent);
	const lines: string[] = [];
	const itemCtx: StringifyContext = { ...ctx, parentPosition: "block-seq-item" };
	for (const item of items) {
		const fields = itemFields(item);
		if (fields?.spaceBefore === true) lines.push("");
		if (fields?.commentBefore !== undefined) {
			for (const cl of commentBlockLines(fields.commentBefore)) lines.push(cl);
		}
		/** Append the item's trailing comment to `lines[idx]`; `-1` drops it. */
		const appendItemTrailing = (idx: number): void => {
			if (fields?.comment === undefined || idx < 0 || idx >= lines.length) return;
			lines[idx] = `${lines[idx]}${renderTrailingComment(fields.comment)}`;
		};
		const itemLines = stringifyNodeLines(item, itemCtx, depth + 1);
		if (itemLines.length === 1) {
			// Empty value: just `-` with no trailing space
			lines.push(itemLines[0] === "" ? "-" : `- ${itemLines[0]}`);
			appendItemTrailing(lines.length - 1);
		} else {
			const first = itemLines[0];
			// Block scalar headers and multi-line quoted scalars (when the item is
			// itself a YamlScalar) place their first line inline after `- `, with
			// continuation lines emitted as-is. Detection allows an optional
			// `&anchor` / `!tag` prefix that the scalar renderer may have added.
			const firstStripped = stripScalarMetadataPrefix(first);
			const itemIsScalar = item instanceof YamlScalar;
			const isBlockScalarHeader = firstStripped.startsWith("|") || firstStripped.startsWith(">");
			const isInlineScalar =
				isBlockScalarHeader || (itemIsScalar && (firstStripped.startsWith("'") || firstStripped.startsWith('"')));
			if (isInlineScalar) {
				const headerIdx = lines.length;
				lines.push(`- ${first}`);
				for (let i = 1; i < itemLines.length; i++) {
					lines.push(itemLines[i]);
				}
				// #341: a block scalar's HEADER line legally carries the item's
				// trailing comment (`- | # c`); a multi-line quoted scalar closes
				// on its last line, which carries it instead.
				appendItemTrailing(isBlockScalarHeader ? headerIdx : lines.length - 1);
			} else {
				// Nested mapping or sequence — indent continuation lines by one level
				lines.push(first === "" ? "-" : `- ${first}`);
				const dashLineIdx = lines.length - 1;
				for (let i = 1; i < itemLines.length; i++) {
					lines.push(itemLines[i] === "" ? "" : `${pad}${itemLines[i]}`);
				}
				appendItemTrailing(dashLineIdx);
			}
		}
	}
	// The sequence's own trailing comment: own-line comment lines after the
	// last item, at the items' indent.
	if (emitComments && node.comment !== undefined) {
		for (const cl of commentBlockLines(node.comment)) lines.push(cl);
	}
	// Anchor/tag on block sequences: place on own line before content
	const prefix = buildMetadataPrefix(node.tag, node.anchor);
	if (prefix) {
		lines.unshift(prefix);
	}
	return lines;
}

// ---------------------------------------------------------------------------
// Engine entry points
// ---------------------------------------------------------------------------

/**
 * Converts a JavaScript value into a YAML text string.
 *
 * Handles all primitive types, arrays, and plain objects. Special numbers
 * (`Infinity`, `-Infinity`, `NaN`) are rendered as `.inf`, `-.inf`, and
 * `.nan` respectively. Circular references throw {@link StringifyFailure}.
 */
export function stringifyValue(value: unknown, options?: StringifyOptionsInput): string {
	const ctx = createContext(options);
	const result = stringifyLines(value, ctx, 0).join("\n");
	return (options?.finalNewline ?? true) ? `${result}\n` : result;
}

/**
 * Converts a composed YAML document AST into a YAML text string, preserving
 * the style metadata encoded in each AST node.
 *
 * Scalar nodes use their `style` field to control rendering; collection
 * nodes use their `style` field (`"block"` or `"flow"`). Nodes without an
 * explicit style fall back to the defaults in `options`.
 */
export function stringifyDocument(doc: RawYamlDocument, options?: StringifyOptionsInput): string {
	const ctx = createContext(options);
	const finalNewline = options?.finalNewline ?? true;

	// Strip comments and normalize tags when producing canonical output
	let contents = doc.contents;
	const docCommentRaw = ctx.forceDefaultStyles ? undefined : doc.commentBefore;
	// Multi-line document comments render one `# ` line per stored line.
	const docComment = docCommentRaw !== undefined ? commentBlockLines(docCommentRaw).join("\n") : undefined;
	if (ctx.forceDefaultStyles && contents) {
		contents = stripNodeComments(contents);
		const tagMap = buildTagMap(doc.directives);
		contents = normalizeNodeTags(contents, tagMap);
	}

	if (contents === null) {
		if (ctx.forceDefaultStyles) {
			// Empty document in canonical mode: emit --- for doc-start markers.
			// Bare ... (no doc-start, no content) produces empty output.
			if (doc.hasDocumentStart) {
				const docEnd = doc.hasDocumentEnd ? "...\n" : "";
				return `---\n${docEnd}`;
			}
			return "";
		}
		// An empty document still renders its framing and document comments —
		// `---\n...\n# tail\n` must keep its markers and trailing block. Only
		// a fully bare empty document falls back to the `null` body.
		if (
			docComment !== undefined ||
      doc.comment !== undefined || doc.hasDocumentStart || doc.hasDocumentEnd
		) {
			const parts: string[] = [];
			if (docComment !== undefined) parts.push(`${docComment}\n`);
			if (doc.hasDocumentStart) parts.push("---\n");
			if (doc.hasDocumentEnd) parts.push("...\n");
			if (doc.comment !== undefined) parts.push(`${commentBlockLines(doc.comment).join("\n")}\n`);
			const out = parts.join("");
			return finalNewline ? out : out.replace(/\n$/, "");
		}
		return finalNewline ? "null\n" : "null";
	}

	const result = stringifyNodeLines(contents, ctx, 0).join("\n");

	// #349: a block scalar at the DOCUMENT ROOT carries its captured header
	// comment on the header line, exactly as the pair, seq-item and
	// explicit-key paths do (#341). Splicing before `body` is formed covers the
	// bare, `---` and tag/anchor return branches alike; unlike those three
	// paths the root has no competing pair-level comment, so the one header
	// slot is never contested. Canonical mode stays comment-free.
	const rootHeaderComment =
		!ctx.forceDefaultStyles &&
		contents instanceof YamlScalar &&
		(contents.style === "block-literal" || contents.style === "block-folded")
			? contents.comment
			: undefined;
	const rendered = rootHeaderComment === undefined ? result : withHeaderComment(result, rootHeaderComment);

	// In canonical mode, an explicit `...` end marker is required when:
	// - The final emitted scalar uses keep-chomp (`|+` or `>+`) — without it
	//   the reader cannot tell where the open-ended block scalar ends.
	// - The root is an anchored plain scalar with explicit `---` — `...`
	//   binds the anchor to a definite node identity so trailing content
	//   isn't absorbed into the scalar value.
	const needsTerminatorForKeepChomp = ctx.forceDefaultStyles && endsWithKeepChomp(result);
	const needsTerminatorForAnchoredPlainScalar =
		ctx.forceDefaultStyles &&
		doc.hasDocumentStart &&
		contents instanceof YamlScalar &&
		contents.style === "plain" &&
		contents.anchor !== undefined &&
		!contents.tag;
	// XLQ9: a multi-line plain scalar root whose folded value contains
	// a `%`-introduced directive-like substring (e.g. "scalar %YAML 1.2")
	// needs `...` so a follow-on parser cannot re-interpret the trailing
	// `%XXX` as a directive in some other YAML stream context. libyaml's
	// canonical emitter is conservative here. Other multi-line plain
	// roots (3MYT, EX5H, EXG3) without a `%` continuation render
	// without `...`.
	const looksLikeDirectiveContinuation =
		contents instanceof YamlScalar && typeof contents.value === "string" && / %[A-Z]/.test(contents.value);
	const needsTerminatorForMultilinePlainScalar =
		ctx.forceDefaultStyles &&
		doc.hasDocumentStart &&
		contents instanceof YamlScalar &&
		contents.style === "plain" &&
		contents.sourceMultiline === true &&
		looksLikeDirectiveContinuation;
	// K54U: `---<TAB>scalar` source needs `...` terminator. libyaml's
	// canonical emitter is conservative when a tab follows `---` —
	// downstream tooling that re-tokenises might mis-handle the tab,
	// so the explicit document-end marker keeps things unambiguous.
	const needsTerminatorForDocStartTab = ctx.forceDefaultStyles && doc.hasDocumentStartTab;
	const docEndMarker =
		doc.hasDocumentEnd ||
		needsTerminatorForKeepChomp ||
		needsTerminatorForAnchoredPlainScalar ||
		needsTerminatorForMultilinePlainScalar ||
		needsTerminatorForDocStartTab
			? "...\n"
			: "";
	// The document's TRAILING comment block renders after the content (and
	// after the `...` marker when present); canonical mode stays comment-free.
	const docCommentAfter =
		ctx.forceDefaultStyles || doc.comment === undefined ? undefined : commentBlockLines(doc.comment).join("\n");
	const docEndFull = docCommentAfter !== undefined ? `${docEndMarker}${docCommentAfter}\n` : docEndMarker;
	// `finalNewline` governs the very end of the OUTPUT, not internal
	// separators: when a `...` marker or trailing comment block follows the
	// body, the body keeps its newline (gluing the marker onto the last
	// content line would change the document's meaning — `a: 1...`) and the
	// option trims the trailing newline of the marker/comment block instead.
	const body = finalNewline || docEndFull !== "" ? `${rendered}\n` : rendered;
	const docEnd = finalNewline || docEndFull === "" ? docEndFull : docEndFull.replace(/\n$/, "");

	// A header comment sitting AFTER the `---` marker leads the ROOT NODE, and
	// the root is the one position with no parent to emit a node's leading
	// block for it — the same missing-slot shape as the root block-scalar
	// header (#349). Emit it on the marker's far side.
	// Not gated on the marker: a marker-LESS header over a scalar or empty
	// collection root is stored the same way (a non-empty collection takes it
	// on its first entry instead), and gating dropped it entirely.
	const rootLeading =
		!ctx.forceDefaultStyles && true && contents.commentBefore !== undefined
			? `${commentBlockLines(contents.commentBefore).join("\n")}\n`
			: "";

	if (doc.hasDocumentStart) {
		const rootTag = contents && "tag" in contents ? contents.tag : undefined;
		const rootAnchor = contents && "anchor" in contents ? contents.anchor : undefined;
		const isCollection = contents instanceof YamlMap || contents instanceof YamlSeq;
		const isScalar = contents instanceof YamlScalar;

		if (rootTag || rootAnchor) {
			// Build metadata prefix — canonical ordering: &anchor !!tag
			const metaParts: string[] = [];
			if (rootAnchor) metaParts.push(`&${rootAnchor}`);
			if (rootTag) metaParts.push(rootTag);
			const metaStr = metaParts.join(" ");

			// Strip tag/anchor prefix from body (already prepended by stringifyNodeLines)
			let bodyClean = body;
			// For block collections, the metadata is on its own line
			const metaLinePrefix = `${metaStr}\n`;
			const metaInlinePrefix = `${metaStr} `;
			if (bodyClean.startsWith(metaLinePrefix)) {
				bodyClean = bodyClean.slice(metaLinePrefix.length);
			} else if (bodyClean.startsWith(metaInlinePrefix)) {
				bodyClean = bodyClean.slice(metaInlinePrefix.length);
			}

			const docStart = `--- ${metaStr}`;
			const sep = isCollection ? "\n" : " ";
			const metaBody = rootLeading === "" ? `${sep}${bodyClean}` : `\n${rootLeading}${bodyClean}`;
			return docComment ? `${docComment}\n${docStart}${metaBody}${docEnd}` : `${docStart}${metaBody}${docEnd}`;
		}

		// No tag/anchor — inline scalars after ---
		if (isScalar && rootLeading === "") {
			return docComment ? `${docComment}\n--- ${body}${docEnd}` : `--- ${body}${docEnd}`;
		}
		const afterMarker = `---\n${rootLeading}${body}${docEnd}`;
		return docComment ? `${docComment}\n${afterMarker}` : afterMarker;
	}
	const plain = `${rootLeading}${body}${docEnd}`;
	return docComment ? `${docComment}\n${plain}` : plain;
}
