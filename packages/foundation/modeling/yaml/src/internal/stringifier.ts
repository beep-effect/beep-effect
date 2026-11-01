// YAML stringifier engine — converts JavaScript values and AST nodes to YAML
// text, including the canonical-output logic exercised by the
// yaml-test-suite byte-equality assertion family.
//
// Sync throughout; failures are thrown as `StringifyFailure`, which the
// public facade catches and materializes into the public error type. Implements configurable
// formatting with support for block/flow styles, scalar quoting rules, and
// round-trip preservation of AST node styles.

import { $YamlId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import { replaceWith } from "@beep/utils/Str";
import * as A from "effect/Array";
import { constant, dual, pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  CollectionStyle,
  QuoteCompat,
  QuoteStyle,
  ScalarChomp,
  ScalarStyle,
  YamlAlias,
  YamlMap,
  YamlPair,
  YamlScalar,
  YamlSeq,
} from "../YamlNode.ts";
import { MAX_NESTING_DEPTH } from "./composer/state.ts";
import { isPrimaryHandleTag, splitNamedHandle, tagPrefixFor } from "./composer/tags.ts";
import {
  foldRenderedScalar,
  hasInteriorTrailingWhitespace,
  hasNewlineSpacesTab,
  isControlChar,
  renderBlockFolded,
  renderBlockLiteral,
  renderSingleQuotedMultiline,
} from "./fold.ts";
import { IndentWidth } from "./options.ts";
import type { YamlNode } from "../YamlNode.ts";
import type { StringifyOptionsInput } from "./options.ts";
import type { RawDirective, RawYamlDocument } from "./raw-document.ts";

const $I = $YamlId.create("internal/stringifier");

const isYamlScalar = S.is(YamlScalar);
const isYamlMap = S.is(YamlMap);
const isYamlSeq = S.is(YamlSeq);
const isYamlAlias = S.is(YamlAlias);

/**
 * Thrown by the stringifier on its failure paths (circular references). The
 * facade catches this and materializes the public stringify error.
 *
 * **Example** (Inspect a circular-reference failure)
 *
 * ```ts
 * import { StringifyFailure } from "@beep/yaml/internal/stringifier"
 *
 * const failure = StringifyFailure.new("Circular reference detected")
 * console.log(failure.reason) // Circular reference detected
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class StringifyFailure extends S.TaggedError<StringifyFailure, { readonly brand: unique symbol }>(
  $I`StringifyFailure`
)(
  "StringifyFailure",
  {
    message: S.String.pipe(
      $I.annoteKey("StringifyFailure.message", { description: "The stringification failure message." })
    ),
    reason: S.String.pipe(
      $I.annoteKey("StringifyFailure.reason", { description: "The reason the value cannot be rendered." })
    ),
  },
  $I.annoteError<StringifyFailure>("StringifyFailure", { description: "A value that cannot be rendered as YAML." })
) {
  /**
   * Identifies this failure by its stable error name.
   *
   * **Example** (Read the StringifyFailure error name)
   *
   * ```ts
   * import { StringifyFailure } from "@beep/yaml/internal/stringifier"
   *
   * console.log(StringifyFailure.new("Circular reference detected").name) // StringifyFailure
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override readonly name = "StringifyFailure";
  /**
   * Creates a stringification failure whose message and reason both contain the supplied explanation.
   *
   * **Example** (Construct a failure with matching diagnostic fields)
   *
   * ```ts
   * import { StringifyFailure } from "@beep/yaml/internal/stringifier"
   *
   * const failure = StringifyFailure.new("Circular reference detected")
   * console.log(failure.message === failure.reason) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static new(reason: string): StringifyFailure {
    return StringifyFailure.make({ message: reason, reason });
  }
}

/**
 * Guards YAML rendering against values or ASTs that exceed the nesting limit.
 *
 * **Details**
 *
 * Thrown by the value-stringifier trio when its mutual recursion exceeds
 * {@link MAX_NESTING_DEPTH}. A deeply-nested acyclic value (e.g. a 50 000-deep
 * array) would otherwise overflow the call stack as an unhandled `RangeError`
 * defect; the facade catches this and materializes a fatal
 * `YamlStringifyError` (a `NestingDepthExceeded` diagnostic), keeping the
 * failure on the typed error channel — the stringify mirror of the composer's
 * nesting-depth guard.
 *
 * **Example** (Inspect the nesting-depth diagnostic)
 *
 * ```ts
 * import { StringifyDepthExceeded } from "@beep/yaml/internal/stringifier"
 *
 * console.log(StringifyDepthExceeded.new().message) // Nesting depth exceeded maximum of 256
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class StringifyDepthExceeded extends S.TaggedError<StringifyDepthExceeded, { readonly brand: unique symbol }>(
  $I`StringifyDepthExceeded`
)(
  "StringifyDepthExceeded",
  {
    message: S.String.pipe(
      $I.annoteKey("StringifyDepthExceeded.message", { description: "The nesting limit exceeded by the value or AST." })
    ),
  },
  $I.annoteError<StringifyDepthExceeded>("StringifyDepthExceeded", {
    description: "YAML rendering exceeded its nesting-depth limit.",
  })
) {
  /**
   * Identifies this failure by its stable error name.
   *
   * **Example** (Read the StringifyDepthExceeded error name)
   *
   * ```ts
   * import { StringifyDepthExceeded } from "@beep/yaml/internal/stringifier"
   *
   * console.log(StringifyDepthExceeded.new().name) // StringifyDepthExceeded
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override readonly name = "StringifyDepthExceeded";
  /**
   * Creates a nesting-depth failure with the shared YAML nesting limit in its message.
   *
   * **Example** (Construct a nesting-depth failure)
   *
   * ```ts
   * import { StringifyDepthExceeded } from "@beep/yaml/internal/stringifier"
   *
   * console.log(StringifyDepthExceeded.new().name) // StringifyDepthExceeded
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static new(): StringifyDepthExceeded {
    return StringifyDepthExceeded.make({ message: `Nesting depth exceeded maximum of ${MAX_NESTING_DEPTH}` });
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
const INDICATOR_CHARS = ":#{}[],&*?|-<>=!%@`\"'";

/**
 * Returns true if a string value would be mis-resolved as a non-string YAML type.
 *
 * **Details**
 *
 * Tests against all YAML 1.2 Core Schema type patterns (null, bool, int, float,
 * inf, nan). Any string matching these patterns must be quoted to preserve its
 * string identity during a parse round-trip.
 */
function wouldBeResolved(s: string): boolean {
  return matchesAny(CORE_SCHEMA_RES, s);
}

/** The YAML 1.2 Core Schema implicit-resolver patterns, in test order. */
const CORE_SCHEMA_RES: ReadonlyArray<RegExp> = [
  NULL_RE,
  TRUE_RE,
  FALSE_RE,
  OCT_RE,
  HEX_RE,
  INT_RE,
  INF_RE,
  NAN_RE,
  FLOAT_RE,
];

/** Whether any pattern in `patterns` matches `s` (short-circuits on the first hit). */
function matchesAny(patterns: ReadonlyArray<RegExp>, s: string): boolean {
  for (const re of patterns) {
    if (re.test(s)) return true;
  }
  return false;
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
  return matchesAny(YAML_11_RES, s);
}

/** The YAML 1.1 implicit-resolver delta patterns, in test order. */
const YAML_11_RES: ReadonlyArray<RegExp> = [BOOL_11_RE, INT_11_RE, FLOAT_11_RE, TIMESTAMP_11_RE];

/**
 * Returns true if a string requires quoting to be safely represented as a plain scalar.
 *
 * **Details**
 *
 * Checks multiple conditions beyond type-conflict detection: empty strings,
 * embedded newlines, leading indicator characters or whitespace, and inline
 * comment/mapping-value patterns (`: `, ` #`). This is the single gate that
 * decides whether a plain scalar is safe or must be wrapped in quotes.
 *
 * `quoteCompat` is strictly additive: `"yaml-1.1"` additionally quotes
 * strings a YAML 1.1 parser would coerce ({@link wouldBeResolved11}) and can
 * never un-quote anything the 1.2 rules require quoted.
 *
 * `inFlow` is additive too: inside a flow collection the flow indicators
 * `,[]{}` are plain-unsafe anywhere in the scalar (YAML 1.2 §7.3.3,
 * `ns-plain-safe(flow-in)` excludes `c-flow-indicator`), where block context
 * lets them through. Without it a plain `p, q` rendered into `[x, y]` reads
 * back as three items.
 */
const requiresQuoting: {
  (ignoreType?: boolean, quoteCompat?: QuoteCompat, inFlow?: boolean, plainTab?: boolean): (s: string) => boolean;
  (s: string, ignoreType?: boolean, quoteCompat?: QuoteCompat, inFlow?: boolean, plainTab?: boolean): boolean;
} = dual(
  (args) => P.isString(args[0]),
  (s: string, ignoreType?: boolean, quoteCompat?: QuoteCompat, inFlow?: boolean, plainTab?: boolean): boolean =>
    // Empty string must be quoted
    s === "" ||
    // Flow context: any flow indicator anywhere terminates or corrupts the
    // enclosing collection
    (inFlow === true && /[,[\]{}]/.test(s)) ||
    wouldBeCoerced(s, ignoreType === true, quoteCompat) ||
    hasUnsafeLeadingIndicator(s) ||
    hasAmbiguousPlainSyntax(s) ||
    hasUnplainableChar(s, plainTab === true)
);

/**
 * Whether `s` would be resolved as a non-string type (skipped when a tag
 * overrides resolution), including by the requested foreign dialect.
 */
function wouldBeCoerced(s: string, ignoreType: boolean, quoteCompat: QuoteCompat | undefined): boolean {
  if (ignoreType) return false;
  return wouldBeResolved(s) || (quoteCompat === "yaml-1.1" && wouldBeResolved11(s));
}

/**
 * Whether `s` starts with whitespace (space/tab) or with an indicator
 * character that cannot open a plain scalar. `:`, `?` and `-` only require
 * quoting when followed by whitespace or at end of string (`:foo`, `?bar`,
 * `-baz` are safe plain scalars); every other indicator (`#`, `{`, `}`, `[`,
 * `]`, …) always requires quoting at the start.
 */
function hasUnsafeLeadingIndicator(s: string): boolean {
  const first = Str.slice(0, 1)(s);
  if (first === " " || first === "\t") return true;
  if (!Str.includes(first)(INDICATOR_CHARS)) return false;
  if (first !== ":" && first !== "?" && first !== "-") return true;
  const second = s[1];
  return s.length === 1 || second === " " || second === "\t";
}

/**
 * Whether `s` carries syntax a plain scalar would misread: a document marker
 * prefix (`---`/`...`, ambiguous at line start), a mapping value indicator
 * (`: `, `:\t`, trailing `:`), a comment indicator (` #`, `\t#`), or trailing
 * whitespace (plain scalars lose it).
 */
function hasAmbiguousPlainSyntax(s: string): boolean {
  if (Str.startsWith("---")(s) || Str.startsWith("...")(s)) return true;
  if (Str.includes(": ")(s) || Str.includes(":\t")(s) || Str.endsWith(":")(s)) return true;
  if (Str.includes(" #")(s) || Str.includes("\t#")(s)) return true;
  const last = Str.slice(-1)(s);
  return last === " " || last === "\t";
}

/**
 * C0 control characters require quoting. `isControlChar` deliberately
 * excludes TAB (0x09) and CR (0x0D) for its other callers — the block-scalar
 * and single-quoted-multiline paths, where both are representable — so both
 * are tested explicitly here. A plain scalar cannot carry CR: the parser
 * normalises it away (silent data corruption on round-trip). An interior tab
 * is valid YAML 1.2 plain content, but some other YAML parsers reject it, so
 * it is quoted unless `plainTab` is set (the `"auto"` quote style, which
 * follows the `yaml` npm package and leaves it plain). A leading or trailing
 * tab, and a tab beside `#` or after `:`, are caught by the indicator and
 * ambiguity checks under either setting. Only single-line values reach this
 * point, so quoting on any TAB is safe for block styles.
 */
const plainUnsafe = /[\x00-\x09\x0b-\x1f]/;
const plainUnsafeExceptTab = /[\x00-\x08\x0b-\x1f]/;

function hasUnplainableChar(s: string, plainTab: boolean): boolean {
  const unsafe = plainTab ? plainUnsafeExceptTab : plainUnsafe;
  for (let i = 0; i < s.length; i++) {
    const ch = Str.slice(i, i + 1)(s);
    if (unsafe.test(ch)) return true;
  }
  return false;
}

/**
 * Returns true if the string contains any non-ASCII character (code point \> 0x7E).
 */
function hasNonAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (Str.slice(i, i + 1)(s) > "~") return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Scalar rendering
// ---------------------------------------------------------------------------

/**
 * Renders a string scalar using double-quote style.
 *
 * **Details**
 *
 * When `canonical` is true, non-ASCII characters are escaped as `\uXXXX`
 * (or `\UXXXXXXXX` for supplementary plane) and C0 control characters use
 * named escapes where YAML 1.2 defines them (`\b`, `\0`, `\a`, `\v`, `\e`).
 *
 * **Example** (Escape a line break in a quoted scalar)
 *
 * ```ts
 * import { renderDoubleQuoted } from "@beep/yaml/internal/stringifier"
 *
 * console.log(renderDoubleQuoted("hello\nworld")) // "hello\nworld"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export function renderDoubleQuoted(s: string, ...[canonical = false]: [canonical?: boolean]): string {
  const escaped = pipe(
    s,
    Str.replace(/\\/g, "\\\\"),
    Str.replace(/"/g, '\\"'),
    Str.replace(/\n/g, "\\n"),
    Str.replace(/\r/g, "\\r"),
    Str.replace(/\t/g, "\\t")
  );
  return `"${replaceWith(canonical ? CANONICAL_ESCAPED_CHAR : CONTROL_CHAR, escapeDoubleQuotedChar)(escaped)}"`;
}

/** The C0 controls `isControlChar` accepts; tab, LF and CR are already escaped by name. */
const CONTROL_CHAR = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;

/**
 * Canonical mode also escapes every code point above `~`. The `u` flag keeps a
 * well-formed surrogate pair together, so it escapes as one supplementary-plane
 * `\UXXXXXXXX`, while a lone surrogate escapes as `\uXXXX`.
 */
const CANONICAL_ESCAPED_CHAR = /[\x00-\x08\x0b\x0c\x0e-\x1f]|[^\x00-\x7e]/gu;

/** YAML 1.2 named escapes for the C0 controls that have one, keyed by code: NUL, BEL, BS, VT, FF, ESC. */
const NAMED_CONTROL_ESCAPES: Readonly<Record<number, string>> = {
  0: "\\0",
  7: "\\a",
  8: "\\b",
  11: "\\v",
  12: "\\f",
  27: "\\e",
};

/**
 * Escape one matched code point (`ch`, one or two UTF-16 units) for a
 * double-quoted scalar: C0 controls use YAML 1.2 named escapes where available,
 * otherwise `\xXX`; the canonical-mode matches above `~` escape as `\uXXXX` (or
 * `\UXXXXXXXX` for a supplementary-plane pair).
 */
function escapeDoubleQuotedChar(ch: string): string {
  const code = pipe(ch, Str.charCodeAt(0), O.getOrElse(constant(0)));
  if (isControlChar(code)) return NAMED_CONTROL_ESCAPES[code] ?? `\\x${Str.padStart(2, "0")(code.toString(16))}`;
  return ch.length === 2
    ? `\\U${Str.padStart(8, "0")(Str.toUpperCase(pipe(ch, Str.codePointAt(0), O.getOrElse(constant(code))).toString(16)))}`
    : `\\u${Str.padStart(4, "0")(Str.toUpperCase(code.toString(16)))}`;
}

/**
 * Renders a string scalar using single-quote style.
 *
 * **Example** (Escape an apostrophe in a quoted scalar)
 *
 * ```ts
 * import { renderSingleQuoted } from "@beep/yaml/internal/stringifier"
 *
 * console.log(renderSingleQuoted("it's YAML")) // 'it''s YAML'
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export function renderSingleQuoted(s: string): string {
  return `'${Str.replaceAll("'", "''")(s)}'`;
}

/**
 * The quote character the plain-scalar fallback uses for `s` under
 * `quoteStyle`: `"single"` and `"double"` name it outright, while `"auto"`
 * picks it per value like the `yaml` npm package's default (`singleQuote:
 * null`), single quotes for a value holding `"` and no `'` and double quotes
 * otherwise, so neither quote has to be escaped where one choice avoids it.
 *
 * **Example** (Pick the quote for a value under `auto`)
 *
 * ```ts
 * import { fallbackQuoteStyle } from "@beep/yaml/internal/stringifier"
 *
 * console.log(fallbackQuoteStyle('say "hi"', "auto")) // single
 * console.log(fallbackQuoteStyle("it's", "auto")) // double
 * console.log(fallbackQuoteStyle("it's", "single")) // single
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const fallbackQuoteStyle: {
  (quoteStyle: QuoteStyle): (s: string) => "single" | "double";
  (s: string, quoteStyle: QuoteStyle): "single" | "double";
} = dual(2, (s: string, quoteStyle: QuoteStyle): "single" | "double" =>
  QuoteStyle.match(quoteStyle, {
    single: () => "single" as const,
    double: () => "double" as const,
    auto: () => (Str.includes('"')(s) && !Str.includes("'")(s) ? ("single" as const) : ("double" as const)),
  })
);

const ParentPosition = LiteralKit(["block-map-value", "block-seq-item"]).pipe(
  $I.annoteSchema("ParentPosition", { description: "The block parent position that controls scalar header rendering." })
);
type ParentPosition = typeof ParentPosition.Type;

const StringRenderContext = S.Struct({
  s: S.String.pipe($I.annoteKey("StringRenderContext.s", { description: "The resolved scalar value to render." })),
  indent: S.String.pipe(
    $I.annoteKey("StringRenderContext.indent", { description: "Whitespace prepended to scalar continuation lines." })
  ),
  ignoreType: S.Boolean.pipe(
    $I.annoteKey("StringRenderContext.ignoreType", {
      description: "Whether an explicit tag prevents implicit type coercion.",
    })
  ),
  canonical: S.Boolean.pipe(
    $I.annoteKey("StringRenderContext.canonical", { description: "Whether canonical presentation rules apply." })
  ),
  explicitChomp: S.UndefinedOr(ScalarChomp).pipe(
    $I.annoteKey("StringRenderContext.explicitChomp", {
      description: "The source block chomping indicator, when present.",
    })
  ),
  parentPosition: S.UndefinedOr(ParentPosition).pipe(
    $I.annoteKey("StringRenderContext.parentPosition", {
      description: "The enclosing block entry position, when present.",
    })
  ),
  quoteStyle: QuoteStyle.pipe(
    $I.annoteKey("StringRenderContext.quoteStyle", { description: "The preferred quoting fallback for plain scalars." })
  ),
  fidelity: S.Boolean.pipe(
    $I.annoteKey("StringRenderContext.fidelity", {
      description: "Whether redundant source header indicators are preserved.",
    })
  ),
  fidelityIndent: S.UndefinedOr(S.Finite).pipe(
    $I.annoteKey("StringRenderContext.fidelityIndent", {
      description: "The source indentation indicator preserved in fidelity mode.",
    })
  ),
  quoteCompat: S.UndefinedOr(QuoteCompat).pipe(
    $I.annoteKey("StringRenderContext.quoteCompat", {
      description: "The optional foreign dialect whose implicit coercions require quoting.",
    })
  ),
  inFlow: S.Boolean.pipe(
    $I.annoteKey("StringRenderContext.inFlow", {
      description: "Whether flow collection syntax constrains scalar rendering.",
    })
  ),
}).pipe(
  $I.annoteSchema("StringRenderContext", { description: "Resolved presentation settings for one string scalar." })
);
type StringRenderContext = typeof StringRenderContext.Type;

const stringStyleRenderers: Record<ScalarStyle, (input: StringRenderContext) => string> = {
  plain: ({ s, ignoreType, quoteCompat, inFlow, canonical, quoteStyle }) => {
    if (requiresQuoting(s, ignoreType, quoteCompat, inFlow, quoteStyle === "auto")) {
      // A tab forces double-quoted under "single" and "double" — the
      // released conservative form, which escapes it as `\t`. CR and the
      // other controls never reach here: `mustDoubleQuoteString` already
      // double-quoted them. "auto" follows the `yaml` npm package instead,
      // which keeps a literal tab inside single quotes (valid YAML 1.2 on a
      // single line, and it reads back exactly). Backslashes are literal in
      // single-quoted YAML and do NOT need double-quoting.
      if (quoteStyle !== "auto" && Str.includes("\t")(s)) {
        return renderDoubleQuoted(s, canonical);
      }
      // Otherwise the caller's fallback preference decides: single-quoted
      // by default (the released byte-compatible form), double-quoted
      // when `quoteStyle` asks for it, and chosen per value under "auto".
      return fallbackQuoteStyle(s, quoteStyle) === "double" ? renderDoubleQuoted(s, canonical) : renderSingleQuoted(s);
    }
    return s;
  },
  "single-quoted": ({ s }) => renderSingleQuoted(s),
  "double-quoted": ({ s, canonical }) => renderDoubleQuoted(s, canonical),
  "block-literal": ({ s, indent, explicitChomp, parentPosition, fidelity, fidelityIndent, canonical }) =>
    O.getOrElse(renderBlockLiteral(s, indent, explicitChomp, parentPosition, fidelity, fidelityIndent), () =>
      renderDoubleQuoted(s, canonical)
    ),
  "block-folded": ({ s, indent, explicitChomp, fidelity, fidelityIndent, canonical }) =>
    O.getOrElse(renderBlockFolded(s, indent, fidelity ? explicitChomp : undefined, fidelityIndent), () =>
      renderDoubleQuoted(s, canonical)
    ),
};

/**
 * Renders a string value as a YAML scalar using the requested style.
 * Falls back to double-quoted if the requested style is unsafe for the value.
 *
 * **Details**
 *
 * Multi-line strings are routed to block styles regardless of the requested
 * style (except double-quoted). For single-line strings, plain style delegates
 * to {@link requiresQuoting} and falls back to `quoteStyle` (single-quoted by
 * default, double-quoted when the caller asked for it, chosen per value by
 * {@link fallbackQuoteStyle} under `"auto"`) — or to double-quoted
 * regardless when the value needs YAML escapes single quotes cannot express.
 * Block literal and block folded styles are always accepted for single-line
 * strings even though the output is unusual.
 */
const renderString: {
  (
    style: ScalarStyle,
    indent: string,
    ignoreType?: boolean,
    canonical?: boolean,
    explicitChomp?: ScalarChomp,
    parentPosition?: ParentPosition,
    quoteStyle?: QuoteStyle,
    explicitIndent?: number,
    quoteCompat?: QuoteCompat,
    inFlow?: boolean,
    nested?: boolean
  ): (s: string) => string;
  (
    s: string,
    style: ScalarStyle,
    indent: string,
    ignoreType?: boolean,
    canonical?: boolean,
    explicitChomp?: ScalarChomp,
    parentPosition?: ParentPosition,
    quoteStyle?: QuoteStyle,
    explicitIndent?: number,
    quoteCompat?: QuoteCompat,
    inFlow?: boolean,
    nested?: boolean
  ): string;
} = dual(
  (args) => P.isString(args[2]),
  (
    s: string,
    style: ScalarStyle,
    indent: string,
    ignoreTypeArg?: boolean,
    canonicalArg?: boolean,
    explicitChomp?: ScalarChomp,
    parentPosition?: ParentPosition,
    quoteStyle: QuoteStyle = "single",
    explicitIndent?: number,
    quoteCompat?: QuoteCompat,
    inFlowArg?: boolean,
    nestedArg?: boolean
  ): string => {
    const ignoreType = ignoreTypeArg === true;
    const canonical = canonicalArg === true;
    const inFlow = inFlowArg === true;
    const nested = nestedArg === true;
    // Fidelity mode (everything but canonical) re-emits the EXPLICIT header
    // indicators the source spelled — a redundant `+` keep-chomp or `|2`
    // indentation indicator is normalized away only under forceDefaultStyles.
    const fidelity = !canonical;
    const input: StringRenderContext = {
      s,
      indent,
      ignoreType,
      canonical,
      explicitChomp,
      parentPosition,
      quoteStyle,
      fidelity,
      fidelityIndent: fidelity ? explicitIndent : undefined,
      quoteCompat,
      inFlow,
    };
    if (mustDoubleQuoteString(s, style, inFlow)) return renderDoubleQuoted(s, canonical);
    return Str.includes("\n")(s) ? renderMultilineString(input, style, nested) : renderSingleLineString(input, style);
  }
);

const isBlockStyle = (style: ScalarStyle): boolean => style === "block-literal" || style === "block-folded";

/**
 * Whether `s` must be double-quoted under every requested style: flow
 * collections join rendered lines, so their scalars must keep newlines
 * escaped and cannot use block headers (mapping keys included); CR and
 * controls need escaping under every presentation style.
 */
const doubleQuoteRequired = /[\x00-\x08\x0b-\x1f]/;

function mustDoubleQuoteString(s: string, style: ScalarStyle, inFlow: boolean): boolean {
  if (inFlow && (Str.includes("\n")(s) || isBlockStyle(style))) return true;
  for (let i = 0; i < s.length; i++) {
    const ch = Str.slice(i, i + 1)(s);
    if (doubleQuoteRequired.test(ch)) return true;
  }
  return false;
}

/**
 * Whether a multi-line value cannot use a block or single-quoted rendering.
 *
 * **Details**
 *
 * A value of only spaces and newlines (no text/tab content) cannot be
 * represented faithfully by a block scalar — except when the source style is
 * already a block style (newline-only is a valid `|+` body). In canonical
 * mode, multi-line block content with trailing whitespace on an interior line
 * cannot round-trip cleanly (block scalars normalise it), and mixed leading
 * whitespace on a continuation line (space then tab) is ambiguous block
 * indentation. The helpers use imperative scans instead of regexes to avoid
 * polynomial-time matching on adversarial inputs.
 */
function multilineNeedsDoubleQuote(s: string, style: ScalarStyle, canonical: boolean): boolean {
  const blockStyle = isBlockStyle(style);
  if (!blockStyle && /^[\n ]*$/.test(s)) return true;
  return canonical && blockStyle && (hasInteriorTrailingWhitespace(s) || hasNewlineSpacesTab(s));
}

/** Multi-line strings prefer block styles. */
function renderMultilineString(input: StringRenderContext, style: ScalarStyle, nested: boolean): string {
  if (multilineNeedsDoubleQuote(input.s, style, input.canonical)) return renderDoubleQuoted(input.s, input.canonical);
  return multilineStyleRenderers[style](input, nested);
}

/**
 * Plain and single-quoted multi-line scalars render as a block literal, or —
 * in canonical mode — single-quoted with fold encoding, matching libyaml's
 * canonical form.
 */
const renderPlainMultiline = (input: StringRenderContext, nested: boolean): string =>
  input.canonical ? renderCanonicalMultiline(input, nested) : stringStyleRenderers["block-literal"](input);

const multilineStyleRenderers: Record<ScalarStyle, (input: StringRenderContext, nested: boolean) => string> = {
  plain: renderPlainMultiline,
  "single-quoted": renderPlainMultiline,
  "double-quoted": ({ s, canonical }) => renderDoubleQuoted(s, canonical),
  "block-literal": (input) => stringStyleRenderers["block-literal"](input),
  "block-folded": (input) => stringStyleRenderers["block-folded"](input),
};

function renderCanonicalMultiline({ s, indent, canonical }: StringRenderContext, nested: boolean): string {
  // A root-level closing quote is invalid inside a block collection, and
  // flow-quoted continuation whitespace is folded away by YAML readers.
  if ((nested && Str.endsWith("\n")(s)) || /\n[ \t]/.test(s)) return renderDoubleQuoted(s, canonical);
  return O.getOrElse(renderSingleQuotedMultiline(s, indent), () => renderDoubleQuoted(s, canonical));
}

function renderSingleLineString(input: StringRenderContext, style: ScalarStyle): string {
  const { s, canonical } = input;
  // In canonical mode, force double-quoted when string has non-ASCII chars
  // so they can be escaped as \uXXXX
  if (canonical && hasNonAscii(s)) return renderDoubleQuoted(s, true);
  // Empty strings in block styles should use quoted style instead
  if (s === "" && isBlockStyle(style)) return renderDoubleQuoted(s, canonical);
  return stringStyleRenderers[style](input);
}

/**
 * Returns true if the rendered text ends with an open-ended block scalar
 * (`|+` or `>+` keep-chomp). Such scalars consume any trailing blank lines
 * up to the next document marker, so an explicit `...` is required for the
 * reader to know where the value ends.
 *
 * **Details**
 *
 * Detects the most recent `|` or `>` indicator on a header line (matching
 * the form `|<digits>?<chomp>?$` after optional indent and node prefixes)
 * and returns true when the chomp indicator is `+`.
 */
function endsWithKeepChomp(rendered: string): boolean {
  const match = O.getOrNull(Str.match(/[|>][1-9]?[+-]?$|[|>][1-9]?[+-]?(?=\n)/g)(rendered));
  if (match === null) return false;
  const last = A.getUnsafe(match, match.length - 1);
  return Str.includes("+")(last);
}

// ---------------------------------------------------------------------------
// Number rendering
// ---------------------------------------------------------------------------

/**
 * Renders a number value as a YAML scalar string.
 *
 * **Details**
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
const detectCircular: {
  (value: object, seen: object[]): void;
  (seen: object[]): (value: object) => void;
} = dual(2, (value: object, seen: object[]): void => {
  if (A.some(seen, (ancestor) => ancestor === value)) {
    throw StringifyFailure.make({ message: "Circular reference detected", reason: "Circular reference detected" });
  }
});

// ---------------------------------------------------------------------------
// Core stringification
// ---------------------------------------------------------------------------

const StringifyContext = S.Struct({
  indent: IndentWidth.pipe(
    $I.annoteKey("StringifyContext.indent", { description: "The number of spaces per indentation level." })
  ),
  lineWidth: S.Finite.pipe(
    $I.annoteKey("StringifyContext.lineWidth", {
      description: "The preferred output width, with nonpositive values disabling folding.",
    })
  ),
  defaultScalarStyle: ScalarStyle.pipe(
    $I.annoteKey("StringifyContext.defaultScalarStyle", {
      description: "The presentation style for value-path string scalars.",
    })
  ),
  defaultCollectionStyle: CollectionStyle.pipe(
    $I.annoteKey("StringifyContext.defaultCollectionStyle", {
      description: "The default block or flow collection presentation.",
    })
  ),
  sortKeys: S.Boolean.pipe(
    $I.annoteKey("StringifyContext.sortKeys", { description: "Whether mapping entries are sorted lexically." })
  ),
  indentSequences: S.Boolean.pipe(
    $I.annoteKey("StringifyContext.indentSequences", {
      description: "Whether sequences under mappings receive an extra indentation level.",
    })
  ),
  quoteStyle: QuoteStyle.pipe(
    $I.annoteKey("StringifyContext.quoteStyle", { description: "The quoting fallback for plain scalars." })
  ),
  quoteCompat: S.UndefinedOr(QuoteCompat).pipe(
    $I.annoteKey("StringifyContext.quoteCompat", {
      description: "The optional foreign dialect whose coercions require quoting.",
    })
  ),
  forceDefaultStyles: S.Boolean.pipe(
    $I.annoteKey("StringifyContext.forceDefaultStyles", {
      description: "Whether canonical rendering replaces source presentation.",
    })
  ),
  seen: S.ObjectKeyword.pipe(
    S.Array,
    S.mutable,
    $I.annoteKey("StringifyContext.seen", {
      description: "The mutable ancestor stack scanned by reference for cycle detection.",
    })
  ),
  parentPosition: S.optionalKey(ParentPosition).pipe(
    $I.annoteKey("StringifyContext.parentPosition", {
      description: "The current node's enclosing block entry position.",
    })
  ),
  inFlow: S.Boolean.pipe(
    $I.annoteKey("StringifyContext.inFlow", { description: "Whether the current node is inside a flow collection." })
  ),
}).pipe(
  $I.annoteSchema("StringifyContext", {
    description: "Resolved stringify options and traversal state shared by recursive renderers.",
  })
);
type StringifyContext = typeof StringifyContext.Type;

/** Resolves optional stringify options into a fully-defaulted context. */
function createContext(options?: StringifyOptionsInput): StringifyContext {
  const o: Partial<StringifyOptionsInput> = options ?? {};
  return {
    indent: orDefault(o.indent, 2),
    // Default 0 = never wrap: byte-identical to the historic (inert) behavior.
    // Only a positive lineWidth opts a caller into column-based folding.
    lineWidth: orDefault(o.lineWidth, 0),
    defaultScalarStyle: orDefault(o.defaultScalarStyle, "plain"),
    defaultCollectionStyle: orDefault(o.defaultCollectionStyle, "block"),
    sortKeys: orDefault(o.sortKeys, false),
    indentSequences: orDefault(o.indentSequences, false),
    // Default "single" = the released fallback: byte-identical output for every
    // caller that does not opt into the `yaml`-npm-compatible double-quoted form.
    quoteStyle: orDefault(o.quoteStyle, "single"),
    // Default absent = no extra quoting: byte-identical output for every
    // caller not targeting a YAML 1.1 consumer.
    quoteCompat: o.quoteCompat,
    forceDefaultStyles: orDefault(o.forceDefaultStyles, false),
    seen: [],
    inFlow: orDefault(o.inFlow, false),
  };
}

/** `value`, or `fallback` when it is absent (nullish-coalescing semantics). */
const orDefault = <A>(value: A | undefined, fallback: A): A => value ?? fallback;

/**
 * Recursively stringifies a JavaScript value into YAML lines.
 *
 * **Details**
 *
 * Returns an array of lines with NO leading indentation — the caller is
 * responsible for prepending the appropriate indentation prefix to each line.
 * This avoids double-indentation when embedding nested collections.
 */
const stringifyLines: {
  (ctx: StringifyContext, depth: number, allowFold?: boolean): (value: unknown) => string[];
  (value: unknown, ctx: StringifyContext, depth: number, allowFold?: boolean): string[];
} = dual(
  (args) => P.isObjectKeyword(args[1]),
  (value: unknown, ctx: StringifyContext, depth: number, allowFold?: boolean): string[] => {
    // Depth guard: the value-stringifier trio (this fn, stringifyArrayLines and
    // stringifyObjectLines) is mutually recursive with no natural bound, so a
    // deeply-nested acyclic value would overflow the stack as a RangeError
    // defect. Cap at the shared MAX_NESTING_DEPTH and throw a typed internal
    // error the facade materializes into a YamlStringifyError.
    if (depth > MAX_NESTING_DEPTH)
      throw StringifyDepthExceeded.make({ message: `Nesting depth exceeded maximum of ${MAX_NESTING_DEPTH}` });
    if (P.isString(value)) return stringifyStringLines(value, ctx, depth, allowFold !== false);
    if (A.isArray(value)) return withAncestor(value, ctx, () => stringifyArrayLines(value, ctx, depth));
    // object (plain object / record)
    if (P.isObject(value)) return withAncestor(value, ctx, () => stringifyObjectLines(value, ctx, depth));
    return [renderPrimitiveValue(value)];
  }
);

/**
 * Render a non-string, non-collection value: null/undefined, booleans,
 * numbers, bigints (produced by the composer's safeParseInt for values
 * exceeding MAX_SAFE_INTEGER), and — as a fallback — anything else coerced to
 * a double-quoted string.
 */
function renderPrimitiveValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (P.isBoolean(value)) return value ? "true" : "false";
  if (P.isNumber(value)) return renderNumber(value);
  if (P.isBigInt(value)) return value.toString();
  return renderDoubleQuoted(String(value));
}

/** Render a string value; block scalar header and body lines come back already split. */
function stringifyStringLines(value: string, ctx: StringifyContext, depth: number, allowFold: boolean): string[] {
  const indentStr = Str.repeat(ctx.indent)(" ");
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
    ctx.inFlow,
    depth > 0
  );
  // Column-based folding only fires in block contexts (not flow items, whose
  // lines are re-joined with spaces) and only for a positive lineWidth. The
  // folded continuation lines carry `indentStr`, which the block mapping /
  // sequence callers place inline just like a multi-line block scalar.
  const folded = allowFold && ctx.lineWidth > 0 ? foldRenderedScalar(rendered, indentStr, ctx.lineWidth) : rendered;
  return Str.split("\n")(folded);
}

/** Run `render` with `value` pushed on the cycle-detection ancestor stack. */
function withAncestor(value: object, ctx: StringifyContext, render: () => string[]): string[] {
  detectCircular(value, ctx.seen);
  ctx.seen.push(value);
  try {
    return render();
  } finally {
    ctx.seen.pop();
  }
}

/**
 * Whether a rendered value's continuation lines already carry their own
 * indent: block scalars (`|`/`>`) and folded/multi-line string scalars
 * (plain or double-quoted) put the first line inline and emit the rest as-is.
 */
const continuesInline = (first: string, value: unknown): boolean =>
  Str.startsWith("|")(first) || Str.startsWith(">")(first) || P.isString(value);

/**
 * Stringifies a JavaScript array into YAML sequence lines (no leading indent).
 */
const stringifyArrayLines: {
  (arr: unknown[], ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (arr: unknown[]) => string[];
} = dual(3, (arr: unknown[], ctx: StringifyContext, depth: number): string[] => {
  if (arr.length === 0) {
    return ["[]"];
  }

  if (ctx.defaultCollectionStyle === "flow") {
    // Flow items are re-joined with spaces, so folding must not run here.
    const flowCtx: StringifyContext = { ...ctx, inFlow: true };
    const items = A.map(arr, (item) => A.join(stringifyLines(item, flowCtx, depth + 1, false), " "));
    return [`[${A.join(items, ", ")}]`];
  }

  // Block style — each item rendered relative to depth 0
  const pad = Str.repeat(ctx.indent)(" ");
  const lines: string[] = [];
  for (const item of arr) {
    pushBlockSeqItem(lines, item, stringifyLines(item, ctx, depth + 1), pad);
  }
  return lines;
});

/**
 * Push one block-sequence item: the first line goes inline after `-`;
 * continuation lines are emitted as-is for block/multi-line string scalars,
 * or indented one level for a nested mapping or sequence.
 */
function pushBlockSeqItem(lines: string[], item: unknown, itemLines: ReadonlyArray<string>, pad: string): void {
  const first = A.getUnsafe(itemLines, 0);
  lines.push(`- ${first}`);
  const asIs = continuesInline(first, item);
  for (let i = 1; i < itemLines.length; i++) {
    const line = A.getUnsafe(itemLines, i);
    lines.push(asIs ? line : `${pad}${line}`);
  }
}

/**
 * Returns true when a value is a non-empty block collection (object or array
 * with block style). Such values must never be placed inline after a key colon
 * in a block mapping — they must always start on the next line.
 */
function isBlockCollection(value: unknown): boolean {
  if (A.isArray(value) && value.length > 0) return true;
  if (P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value) && R.keys(value).length > 0) return true;
  return false;
}

/**
 * Stringifies a JavaScript object into YAML mapping lines (no leading indent).
 */
const stringifyObjectLines: {
  (obj: Record<string, unknown>, ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (obj: Record<string, unknown>) => string[];
} = dual(3, (obj: Record<string, unknown>, ctx: StringifyContext, depth: number): string[] => {
  const keys = ctx.sortKeys ? A.sort(R.keys(obj), Order.String) : R.keys(obj);
  if (keys.length === 0) {
    return ["{}"];
  }
  if (ctx.defaultCollectionStyle === "flow") return [renderFlowObject(obj, keys, ctx, depth)];
  // Block style
  const pad = Str.repeat(ctx.indent)(" ");
  const lines: string[] = [];
  for (const k of keys) {
    pushBlockObjectEntry(lines, k, obj[k], ctx, depth, pad);
  }
  return lines;
});

/**
 * Mapping keys render plain-styled, so they take the same `quoteStyle`
 * fallback as plain values — a key like `@types/acorn` requires quoting and
 * must honor the caller's preference, not a hardcoded single quote.
 */
const renderPlainKey = (k: string, ctx: StringifyContext, inFlow: boolean): string =>
  renderString(k, "plain", "", false, false, undefined, undefined, ctx.quoteStyle, undefined, ctx.quoteCompat, inFlow);

function renderFlowObject(
  obj: Record<string, unknown>,
  keys: ReadonlyArray<string>,
  ctx: StringifyContext,
  depth: number
): string {
  const flowCtx: StringifyContext = { ...ctx, inFlow: true };
  const pairs = A.map(keys, (k) => {
    const keyStr = renderPlainKey(k, ctx, true);
    // Flow values are re-joined with spaces, so folding must not run here.
    const valStr = A.join(stringifyLines(obj[k], flowCtx, depth + 1, false), " ");
    return `${keyStr}: ${valStr}`;
  });
  return `{${A.join(pairs, ", ")}}`;
}

/**
 * Render a block mapping key — must be single-line for block mappings, so
 * multiline keys use double-quoted style with `\n` escapes.
 */
const renderBlockKey = (k: string, ctx: StringifyContext): string =>
  Str.includes("\n")(k) ? renderDoubleQuoted(k, ctx.forceDefaultStyles) : renderPlainKey(k, ctx, false);

function pushBlockObjectEntry(
  lines: string[],
  k: string,
  val: unknown,
  ctx: StringifyContext,
  depth: number,
  pad: string
): void {
  const keyStr = renderBlockKey(k, ctx);
  const valLines = stringifyLines(val, ctx, depth + 1);
  // Rendered key past the implicit-key limit: spill to explicit-key form
  // (`? key` / `: value`), value in compact notation on the `:` line —
  // the shape the reference `yaml` package emits (and pnpm 11 lockfile
  // snapshot keys exercise). `indentSequences` deliberately does not
  // reach the explicit-key branch (see the node-path complex-key branch).
  if (keyStr.length > IMPLICIT_KEY_MAX_LENGTH) {
    pushExplicitObjectEntry(lines, keyStr, val, valLines);
  } else if (valLines.length === 1 && !isBlockCollection(val)) {
    // Scalar or empty/flow collection — safe to place inline
    lines.push(`${keyStr}: ${valLines[0]}`);
  } else {
    pushBlockObjectValue(lines, keyStr, val, valLines, ctx, pad);
  }
}

/**
 * Explicit-key entry: block scalar headers and folded/multi-line string
 * scalars keep their continuation lines as-is; a nested block collection
 * uses compact notation — first line on the colon line, the rest padded two
 * columns to align with it (structural, never ctx.indent).
 */
function pushExplicitObjectEntry(lines: string[], keyStr: string, val: unknown, valLines: ReadonlyArray<string>): void {
  lines.push(`? ${keyStr}`);
  const first = A.getUnsafe(valLines, 0);
  lines.push(`: ${first}`);
  const asIs = continuesInline(first, val);
  for (let i = 1; i < valLines.length; i++) {
    const line = A.getUnsafe(valLines, i);
    lines.push(asIs || line === "" ? line : `${EXPLICIT_COMPACT_PAD}${line}`);
  }
}

/**
 * Block mapping value that cannot sit inline: a block scalar header or a
 * folded/multi-line string goes on the key line; a block sequence uses
 * compact notation (no extra indent) by default, one indent level when
 * `indentSequences` is set (the `yaml` npm package's default presentation);
 * a nested block mapping is indented one level. Empty lines (block scalar
 * bodies) inside a sequence value are never padded — no trailing whitespace.
 */
function pushBlockObjectValue(
  lines: string[],
  keyStr: string,
  val: unknown,
  valLines: ReadonlyArray<string>,
  ctx: StringifyContext,
  pad: string
): void {
  const first = A.getUnsafe(valLines, 0);
  if (continuesInline(first, val)) {
    lines.push(`${keyStr}: ${first}`);
    pushAll(lines, valLines.slice(1));
    return;
  }
  lines.push(`${keyStr}:`);
  const seqValue = A.isArray(val) && val.length > 0;
  for (const vl of valLines) {
    lines.push(!seqValue || (ctx.indentSequences && vl !== "") ? `${pad}${vl}` : vl);
  }
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
function buildTagMap(directives: ReadonlyArray<RawDirective>): MutableHashMap.MutableHashMap<string, string> {
  const map = MutableHashMap.empty<string, string>();
  for (const d of directives) {
    if (d.name === "TAG" && d.parameters.length >= 2) {
      const entry6 = A.getUnsafe(d.parameters, 0);
      const entry7 = A.getUnsafe(d.parameters, 1);
      MutableHashMap.set(map, entry6, entry7);
    }
  }
  return map;
}

/** A resolved tag URI in canonical form: `!!suffix` for a standard YAML tag, verbatim `!<uri>` otherwise. */
const canonicalTagUri = (uri: string): string =>
  Str.startsWith(YAML_TAG_PREFIX)(uri) ? `!!${Str.slice(YAML_TAG_PREFIX.length)(uri)}` : `!<${uri}>`;

/**
 * Normalize a tag for canonical output.
 *
 * **Details**
 *
 * - Resolves custom handles using the tag map from directives
 * - Abbreviates `tag:yaml.org,2002:XXX` URIs to `!!XXX`
 * - Simplifies verbatim `!<!XXX>` to `!XXX`
 * - Expands non-standard `!!` redefinitions to verbatim form
 */
const normalizeTag: {
  (tag: string, tagMap: MutableHashMap.MutableHashMap<string, string>): string;
  (tagMap: MutableHashMap.MutableHashMap<string, string>): (tag: string) => string;
} = dual(2, (tag: string, tagMap: MutableHashMap.MutableHashMap<string, string>): string => {
  if (Str.startsWith("!<")(tag) && Str.endsWith(">")(tag)) return normalizeVerbatimTag(tag);
  if (Str.startsWith("!!")(tag)) return normalizeSecondaryTag(tag, tagMap);
  // Non-specific tag (! alone) or no matching handle stays as written.
  return O.getOrElse(resolveHandleTag(tag, tagMap), () => tag);
});

/**
 * Verbatim tag `!<uri>`: a standard YAML tag abbreviates to `!!shorthand`, a
 * local verbatim tag `!<!foo>` becomes `!foo`, a non-standard URI stays verbatim.
 */
function normalizeVerbatimTag(tag: string): string {
  const uri = Str.slice(2, -1)(tag);
  if (Str.startsWith(YAML_TAG_PREFIX)(uri)) return `!!${Str.slice(YAML_TAG_PREFIX.length)(uri)}`;
  return Str.startsWith("!")(uri) ? uri : tag;
}

/**
 * Secondary handle `!!suffix`: a `!!` redefined to a non-standard prefix
 * expands to verbatim; the standard `!!` is already canonical.
 */
const normalizeSecondaryTag = (tag: string, tagMap: MutableHashMap.MutableHashMap<string, string>): string =>
  O.match(
    O.filter(tagPrefixFor(tagMap, "!!"), (prefix) => prefix !== YAML_TAG_PREFIX),
    {
      onNone: () => tag,
      onSome: (customPrefix) => `!<${customPrefix}${Str.slice(2)(tag)}>`,
    }
  );

/**
 * Resolve a named handle (`!name!suffix`) or, failing that, a primary handle
 * (`!suffix`, non-empty suffix) against the directive tag map.
 */
function resolveHandleTag(tag: string, tagMap: MutableHashMap.MutableHashMap<string, string>): O.Option<string> {
  const named = O.flatMap(splitNamedHandle(tag), ([handle, suffix]) =>
    O.map(tagPrefixFor(tagMap, handle), (prefix) => canonicalTagUri(prefix + suffix))
  );
  if (O.isSome(named) || !isPrimaryHandleTag(tag)) return named;
  return O.map(tagPrefixFor(tagMap, "!"), (prefix) => canonicalTagUri(prefix + Str.slice(1)(tag)));
}

/** A node's span, anchor, comment triple and multi-line flag, with its tag normalized against `tagMap`. */
const retaggedFields = (
  node: YamlScalar | YamlMap | YamlSeq,
  tagMap: MutableHashMap.MutableHashMap<string, string>
) => ({
  ...(node.tag !== undefined && node.tag !== "" ? { tag: normalizeTag(node.tag, tagMap) } : {}),
  ...O.getSomesStruct({
    anchor: O.fromUndefinedOr(node.anchor),
    commentBefore: O.fromUndefinedOr(node.commentBefore),
    comment: O.fromUndefinedOr(node.comment),
    spaceBefore: O.fromUndefinedOr(node.spaceBefore),
    sourceMultiline: O.fromUndefinedOr(node.sourceMultiline),
  }),
  offset: node.offset,
  length: node.length,
});

/** A node's span, tag, anchor and multi-line flag, without its comment triple. */
const uncommentedFields = (node: YamlScalar | YamlMap | YamlSeq) => ({
  ...O.getSomesStruct({
    tag: O.fromUndefinedOr(node.tag),
    anchor: O.fromUndefinedOr(node.anchor),
    sourceMultiline: O.fromUndefinedOr(node.sourceMultiline),
  }),
  offset: node.offset,
  length: node.length,
});

/** A scalar's block-header and source-form fields: chomp, explicit indent and raw text. */
const scalarFormFields = (node: YamlScalar) =>
  O.getSomesStruct({
    chomp: O.fromUndefinedOr(node.chomp),
    blockIndent: O.fromUndefinedOr(node.blockIndent),
    raw: O.fromUndefinedOr(node.raw),
  });

/**
 * Recursively normalizes tags on all AST nodes using document directives.
 */
const normalizeNodeTags: {
  (node: YamlNode, tagMap: MutableHashMap.MutableHashMap<string, string>): YamlNode;
  (tagMap: MutableHashMap.MutableHashMap<string, string>): (node: YamlNode) => YamlNode;
} = dual(2, (node: YamlNode, tagMap: MutableHashMap.MutableHashMap<string, string>): YamlNode => {
  if (isYamlScalar(node)) {
    return YamlScalar.make({
      value: node.value,
      style: node.style,
      ...retaggedFields(node, tagMap),
      ...scalarFormFields(node),
    });
  }
  if (isYamlMap(node)) {
    return YamlMap.make({
      items: A.map(node.items, (pair) =>
        YamlPair.make({
          key: normalizeNodeTags(pair.key, tagMap),
          value: pair.value !== null ? normalizeNodeTags(pair.value, tagMap) : null,
        })
      ),
      style: node.style,
      ...retaggedFields(node, tagMap),
    });
  }
  if (isYamlSeq(node)) {
    return YamlSeq.make({
      items: A.map(node.items, normalizeNodeTags(tagMap)),
      style: node.style,
      ...retaggedFields(node, tagMap),
    });
  }
  return node;
});

// ---------------------------------------------------------------------------
// Comment stripping (for canonical output)
// ---------------------------------------------------------------------------

/**
 * Recursively strips all comment fields from AST nodes.
 * **Details**
 *
 * Used when forceDefaultStyles is true to produce canonical output.
 * **Example** (Remove a scalar comment while retaining its value)
 *
 * ```ts
 * import { stripNodeComments } from "@beep/yaml/internal/stringifier"
 * import { YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const node = YamlScalar.make({
 *   value: "hello", style: "plain", offset: 0, length: 5, comment: " note"
 * })
 * const stripped = stripNodeComments(node)
 * console.log(stripped.comment) // undefined
 * ```
 * @category formatting
 * @since 0.0.0
 */
export function stripNodeComments(node: YamlNode, ...[depth = 0]: [depth?: number]): YamlNode {
  if (depth > MAX_NESTING_DEPTH)
    throw StringifyDepthExceeded.make({ message: `Nesting depth exceeded maximum of ${MAX_NESTING_DEPTH}` });
  if (isYamlScalar(node)) {
    return YamlScalar.make({
      value: node.value,
      style: node.style,
      ...uncommentedFields(node),
      ...scalarFormFields(node),
    });
  }
  if (isYamlMap(node)) {
    return YamlMap.make({
      items: A.map(node.items, (pair) =>
        YamlPair.make({
          key: stripNodeComments(pair.key, depth + 1),
          value: pair.value !== null ? stripNodeComments(pair.value, depth + 1) : null,
        })
      ),
      style: node.style,
      ...uncommentedFields(node),
    });
  }
  if (isYamlSeq(node)) {
    return YamlSeq.make({
      items: A.map(node.items, (item) => stripNodeComments(item, depth + 1)),
      style: node.style,
      ...uncommentedFields(node),
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
const stringifyNodeLines: {
  (node: YamlNode, ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (node: YamlNode) => string[];
} = dual(3, (node: YamlNode, ctx: StringifyContext, depth: number): string[] => {
  // Depth guard, symmetric to the value-path trio: the node-path stringifier
  // (this fn plus its map/seq helpers) is mutually recursive with no natural
  // bound, so a synthetic AST nested deeper than the composer's cap would
  // overflow the stack as a RangeError defect on a public boundary
  // (YamlDocument.stringify / YamlDocument.schema encode). Parsed ASTs are
  // composer-bounded to MAX_NESTING_DEPTH and never trip this; only hand-built
  // deep trees do.
  if (depth > MAX_NESTING_DEPTH)
    throw StringifyDepthExceeded.make({ message: `Nesting depth exceeded maximum of ${MAX_NESTING_DEPTH}` });

  if (isYamlScalar(node)) {
    return stringifyScalarNodeLines(node, ctx, depth);
  }
  if (isYamlMap(node)) {
    return stringifyMapNodeLines(node, ctx, depth);
  }
  if (isYamlSeq(node)) {
    return stringifySeqNodeLines(node, ctx, depth);
  }
  return [`*${node.name}`];
});

/**
 * Stringifies a YamlScalar node into lines, using the node's style metadata.
 */
const stringifyScalarNodeLines: {
  (node: YamlScalar, ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (node: YamlScalar) => string[];
} = dual(3, (node: YamlScalar, ctx: StringifyContext, depth: number): string[] => {
  // Empty scalar (zero-length in source) with tag or anchor: render just tag/anchor
  const isEmpty = isEmptySourceScalar(node);
  if (isEmpty && (isNonEmptyText(node.tag) || isNonEmptyText(node.anchor))) {
    return [scalarMetadataOnly(node)];
  }
  const lines = renderScalarNodeValueLines(node, ctx, depth, isEmpty);
  lines[0] = prefixScalarMetadata(A.getUnsafe(lines, 0), node);
  return lines;
});

/** True for a defined, non-empty tag/anchor string. */
const isNonEmptyText = (text: string | undefined): text is string => text !== undefined && text !== "";

/** A zero-length source scalar with no value (null, undefined or the empty string). */
const isEmptySourceScalar = (node: YamlScalar): boolean =>
  node.length === 0 && (node.value === null || node.value === undefined || node.value === "");

/** The `tag &anchor` rendering of an empty scalar that carries only metadata. */
function scalarMetadataOnly(node: YamlScalar): string {
  const parts: string[] = [];
  if (isNonEmptyText(node.tag)) parts.push(node.tag);
  if (isNonEmptyText(node.anchor)) parts.push(`&${node.anchor}`);
  return A.join(parts, " ");
}

/** Prepend tag first, then anchor, so the final output reads `&anchor !!tag value`. */
function prefixScalarMetadata(first: string, node: YamlScalar): string {
  const tagged = isNonEmptyText(node.tag) ? `${node.tag} ${first}` : first;
  return isNonEmptyText(node.anchor) ? `&${node.anchor} ${tagged}` : tagged;
}

/** Render a scalar node's value (no metadata) using its style metadata. */
function renderScalarNodeValueLines(
  node: YamlScalar,
  ctx: StringifyContext,
  depth: number,
  isEmpty: boolean
): string[] {
  const val = node.value;
  if (!P.isString(val)) return [renderNonStringScalarNode(node, isEmpty)];
  // When forcing default styles, the node's original style is kept for
  // multiline strings (block-literal vs block-folded vs double-quoted) since
  // the canonical output retains scalar presentation style. When a tag is
  // present, type-conflict quoting is unnecessary.
  return Str.split("\n")(
    renderString(
      val,
      node.style,
      Str.repeat(ctx.indent)(" "),
      isNonEmptyText(node.tag),
      ctx.forceDefaultStyles,
      node.chomp,
      ctx.parentPosition,
      ctx.quoteStyle,
      node.blockIndent,
      ctx.quoteCompat,
      ctx.inFlow,
      depth > 0
    )
  );
}

/**
 * Render a non-string scalar value. A zero-length empty scalar without
 * tag/anchor renders as the empty string. Numbers and bigints prefer the
 * source representation when available so non-canonical numeric formats
 * (hex `0xFFEEBB`, trailing zeros `450.00`) survive the round-trip.
 */
function renderNonStringScalarNode(node: YamlScalar, isEmpty: boolean): string {
  const val = node.value;
  if (val === null || val === undefined) return isEmpty ? "" : "null";
  if ((P.isNumber(val) || P.isBigInt(val)) && node.raw !== undefined) return node.raw;
  return renderPrimitiveValue(val);
}

/** The YAML merge key. */
const MERGE_KEY = "<<";

/**
 * True when a mapping key must be emitted plain because quoting it would
 * change what the document means.
 *
 * **Details**
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
    isYamlScalar(node) &&
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
const stringifyMappingKeyLines: {
  (node: YamlNode, ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (node: YamlNode) => string[];
} = dual(3, (node: YamlNode, ctx: StringifyContext, depth: number): string[] => {
  if (isPlainMergeKey(node)) return [MERGE_KEY];
  return stringifyNodeLines(node, ctx, depth);
});

/**
 * Undo the capture-side escape on one stored comment line: a spaces-only
 * slice was stored with one extra trailing space so it cannot collide with
 * `""`, the embedded-blank-line encoding (see `rawCommentText`).
 */
function unescapeCommentLine(line: string): string {
  return /^ +$/.test(line) ? Str.slice(0, -1)(line) : line;
}

/**
 * Render a stored comment block, one output line per stored line. Stored
 * text is the RAW post-`#` slice (reference parity) with spaces-only lines
 * carrying one escape space: `""` is an embedded blank line; any other line
 * renders as `#` + the unescaped slice (`" "` → `#`, `"  "` → `# `).
 */
function commentBlockLines(comment: string): string[] {
  return A.map(Str.split("\n")(comment), (l) => (l === "" ? "" : `#${unescapeCommentLine(l)}`));
}

/**
 * Splice a trailing comment onto the FIRST line of an already-rendered node —
 * for a block scalar, the header line, which is the one line of the scalar
 * that legally carries a `#` comment.
 */
const withHeaderComment: {
  (rendered: string, comment: string): string;
  (comment: string): (rendered: string) => string;
} = dual(2, (rendered: string, comment: string): string => {
  const nl = O.getOrElse(constant(-1))(Str.indexOf("\n")(rendered));
  return nl === -1
    ? `${rendered}${renderTrailingComment(comment)}`
    : `${Str.slice(0, nl)(rendered)}${renderTrailingComment(comment)}${Str.slice(nl)(rendered)}`;
});

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
 * **Details**
 *
 * A collection's `comment` field carries its TERMINAL comment run — the
 * own-line comments after its last entry — and the collection emits those
 * itself, after that last entry. Only when the collection renders on a single
 * line (inline flow, `a: {b: 1} # t`) is its `comment` the entry's trailing
 * comment. Reading it unconditionally emits the same comment twice: once on
 * the entry's line and again as the terminal run.
 */
const entryTrailing: {
  (pair: YamlPair, ctx: StringifyContext): string | undefined;
  (ctx: StringifyContext): (pair: YamlPair) => string | undefined;
} = dual(2, (pair: YamlPair, ctx: StringifyContext): string | undefined => {
  // The KEY carries a trailing comment only when the value renders below it,
  // so the key owns its line and the comment stays where it was written
  // (`push: # only main`). A comment on its own line above the value is that
  // value's `commentBefore` and keeps its own line — the two source shapes
  // are different bytes and stay that way.
  if (pair.key.comment !== undefined) return pair.key.comment;
  const owner = pair.value ?? pair.key;
  if (rendersAcrossLines(owner, ctx)) return undefined;
  return owner.comment;
});

/**
 * True when `node` renders across more than one line, so its own `comment` is
 * a terminal run rather than something that can sit on the entry's line.
 */
const rendersAcrossLines: {
  (node: YamlNode, ctx: StringifyContext): boolean;
  (ctx: StringifyContext): (node: YamlNode) => boolean;
} = dual(2, (node: YamlNode, ctx: StringifyContext): boolean => {
  if (!(isYamlMap(node) || isYamlSeq(node))) return false;
  if (node.items.length === 0) return false;
  const style = ctx.forceDefaultStyles ? ctx.defaultCollectionStyle : node.style;
  if (style === "block" || node.sourceMultiline === true) return true;
  // A flow collection carrying INNER comments is emitted one entry per line —
  // a `#` between the brackets would swallow the closing one. The collection's
  // OWN comment is not such a case: it renders after the closing bracket, so
  // it neither swallows anything nor forces the layout, and `a: {b: 1} # t`
  // stays on one line. Canonical mode emits no comments at all.
  return isYamlMap(node)
    ? A.some(
        node.items,
        (p) => pairLeading(p) !== undefined || (p.value ?? p.key).comment !== undefined || pairSpaceBefore(p) === true
      )
    : A.some(
        node.items,
        (item) => item.commentBefore !== undefined || item.comment !== undefined || item.spaceBefore === true
      );
});

/** Render a trailing comment for appending after content on the same line. */
function renderTrailingComment(comment: string): string {
  const flat = pipe(Str.split("\n")(comment), A.map(unescapeCommentLine), A.join(" "));
  return ` #${flat}`;
}

/**
 * Emits the `: value` line(s) of an explicit-key block-mapping entry, in
 * compact notation where the value admits it (first line on the colon line,
 * continuation lines indented to align). Shared by the complex-key branch and
 * the implicit-key length spill; `indentSequences` deliberately does not reach
 * this branch (sequence values always align compactly under `: `).
 *
 * **Details**
 *
 * Returns the `lines` index that can safely carry the pair's trailing
 * comment (the line where an inline value ends), or `-1` when no line is
 * safe (a compact block collection or a block-scalar header).
 */
const pushExplicitKeyValueLines: {
  (lines: string[], valNode: YamlNode | null, ctx: StringifyContext, depth: number, pad: string): number;
  (valNode: YamlNode | null, ctx: StringifyContext, depth: number, pad: string): (lines: string[]) => number;
} = dual(5, (lines: string[], valNode: YamlNode | null, ctx: StringifyContext, depth: number, pad: string): number => {
  if (valNode === null) {
    lines.push(":");
    return lines.length - 1;
  }
  const valLines = stringifyNodeLines(valNode, ctx, depth + 1);
  // The value node's OWN leading comment needs a line of its own above
  // the value, which none of the compact spellings below can give it — take
  // the non-compact `:` form so the comment block sits at the value's indent.
  // Every sibling branch of the block-mapping stringifier already does this;
  // the explicit-key branch dropped the comment instead. Aliases are included:
  // they carry the comment triple like every other node class.
  const valueLeading = !ctx.forceDefaultStyles ? valNode.commentBefore : undefined;
  if (valueLeading !== undefined) {
    const colonIdx = lines.length;
    lines.push(":");
    pushPadded(lines, commentBlockLines(valueLeading), pad);
    pushPadded(lines, valLines, pad);
    return colonIdx;
  }
  return valLines.length === 1
    ? pushExplicitSingleLineValue(lines, valNode, A.getUnsafe(valLines, 0), ctx, pad)
    : pushExplicitMultiLineValue(lines, valNode, valLines, ctx, pad);
});

/** The collection style a node renders with: the default under forceDefaultStyles, its own otherwise. */
const collectionStyleOf = (node: YamlMap | YamlSeq, ctx: StringifyContext): CollectionStyle =>
  ctx.forceDefaultStyles ? ctx.defaultCollectionStyle : node.style;

/** A non-empty collection that renders in block style. */
const isBlockCollectionNode = (node: YamlMap | YamlSeq, ctx: StringifyContext): boolean =>
  node.items.length > 0 && collectionStyleOf(node, ctx) === "block";

/**
 * A one-line explicit-key value goes on the colon line — except a one-pair
 * block map, which needs its own indented line: compact `: k: v` is
 * flattened into two pairs by the composer after an explicit key.
 */
function pushExplicitSingleLineValue(
  lines: string[],
  valNode: YamlNode,
  only: string,
  ctx: StringifyContext,
  pad: string
): number {
  if (isYamlMap(valNode) && isBlockCollectionNode(valNode, ctx)) {
    const colonIdx = lines.length;
    lines.push(":", `${pad}${only}`);
    return colonIdx;
  }
  lines.push(`: ${only}`);
  return lines.length - 1;
}

/**
 * A multi-line explicit-key value: block scalar headers and multi-line quoted
 * scalars (bare or after an optional `&anchor` / `!tag` prefix) stay inline;
 * a block sequence or block mapping uses compact notation — first line on the
 * colon line, the rest padded two columns to align with it (structural, never
 * ctx.indent); anything else goes below a bare `:`.
 */
function pushExplicitMultiLineValue(
  lines: string[],
  valNode: YamlNode,
  valLines: ReadonlyArray<string>,
  ctx: StringifyContext,
  pad: string
): number {
  const first = A.getUnsafe(valLines, 0);
  const { isBlockScalarHeader, isInlineQuoted } = inlineScalarShape(first, valNode);
  if (isBlockScalarHeader || isInlineQuoted) {
    const headerIdx = lines.length;
    lines.push(`: ${first}`);
    pushAll(lines, valLines.slice(1));
    // A block scalar's header line, or a multi-line quoted scalar's closing
    // line, is where this entry's trailing comment belongs — the caller owns
    // placing it, exactly as for every other value shape.
    return isBlockScalarHeader ? headerIdx : lines.length - 1;
  }
  if (Str.startsWith("-")(first) || (isYamlMap(valNode) && isBlockCollectionNode(valNode, ctx))) {
    lines.push(`: ${first}`);
    pushPadded(lines, valLines.slice(1), EXPLICIT_COMPACT_PAD);
    return -1;
  }
  const colonIdx = lines.length;
  lines.push(":");
  pushPadded(lines, valLines, pad);
  return colonIdx;
}

/** Push `source` onto `target`, prefixing every non-empty line with `pad`. */
const pushPadded = (target: Array<string>, source: ReadonlyArray<string>, pad: string): void => {
  for (const line of source) target.push(line === "" ? "" : `${pad}${line}`);
};

/** Push a value's leading comment block at `pad` (every line, blank ones included). */
const pushLeadingComments = (
  target: Array<string>,
  ...[leading, pad]: [leading: string | undefined, pad: string]
): void => {
  if (leading === undefined) return;
  for (const cl of commentBlockLines(leading)) target.push(`${pad}${cl}`);
};

/**
 * The key/value separator for a pair: alias keys need a space before the
 * colon so the alias name does not absorb the `:`, and so do empty scalar
 * keys whose only rendering is an anchor or tag (e.g. `&a` or `!!str`).
 */
const pairKeySeparator = (key: YamlNode): " :" | ":" => {
  const keyIsAnchoredOrTaggedEmpty =
    isYamlScalar(key) &&
    key.length === 0 &&
    (key.value === null || key.value === undefined || key.value === "") &&
    (key.anchor !== undefined || key.tag !== undefined);
  return isYamlAlias(key) || keyIsAnchoredOrTaggedEmpty ? " :" : ":";
};

/**
 * How a rendered value's first line starts, after an optional `&anchor` /
 * `!tag` prefix: a block scalar header (`|` / `>`), or — for a scalar node —
 * a multi-line single-quoted scalar. Either keeps its first line inline.
 */
const inlineScalarShape = (
  first: string,
  node: YamlNode
): { readonly isBlockScalarHeader: boolean; readonly isInlineQuoted: boolean } => {
  const firstStripped = stripScalarMetadataPrefix(first);
  return {
    isBlockScalarHeader: Str.startsWith("|")(firstStripped) || Str.startsWith(">")(firstStripped),
    isInlineQuoted: isYamlScalar(node) && Str.startsWith("'")(firstStripped),
  };
};

/** Push `source` onto `target` unchanged. */
const pushAll = (target: Array<string>, source: ReadonlyArray<string>): void => {
  for (const line of source) target.push(line);
};

/** Push a multi-line flow entry at `pad`, its last line carrying `suffix` (separator and trailing comment). */
const pushFlowEntryLines = (
  target: Array<string>,
  ...[entryLines, pad, suffix]: [entryLines: ReadonlyArray<string>, pad: string, suffix: string]
): void => {
  for (let li = 0; li < entryLines.length; li++) {
    const line = A.getUnsafe(entryLines, li);
    const lineSuffix = li === entryLines.length - 1 ? suffix : "";
    target.push(line === "" ? "" : `${pad}${line}${lineSuffix}`);
  }
};

/** `rendered` behind the collection's anchor/tag prefix, when it has one. */
const withMetadataPrefix = (rendered: string, node: YamlMap | YamlSeq): string => {
  const prefix = buildMetadataPrefix(node.tag, node.anchor);
  return prefix !== undefined && prefix !== "" ? `${prefix} ${rendered}` : rendered;
};

/**
 * Close a block collection's lines: its own trailing comment as own-line
 * comment lines after the last entry (when comments are emitted), and its
 * anchor/tag on its own line before the content.
 */
const finishBlockCollectionLines = (
  lines: Array<string>,
  ...[node, emitComments]: [node: YamlMap | YamlSeq, emitComments: boolean]
): Array<string> => {
  if (emitComments && node.comment !== undefined) pushAll(lines, commentBlockLines(node.comment));
  const prefix = buildMetadataPrefix(node.tag, node.anchor);
  if (prefix !== undefined && prefix !== "") lines.unshift(prefix);
  return lines;
};

const pairKeyOrder = Order.mapInput(Order.String, (pair: YamlPair) =>
  isYamlScalar(pair.key) ? String(pair.key.value) : ""
);

/**
 * Stringifies a YamlMap node into lines, using the node's collection style.
 */
const stringifyMapNodeLines: {
  (node: YamlMap, ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (node: YamlMap) => string[];
} = dual(3, (node: YamlMap, ctx: StringifyContext, depth: number): string[] => {
  const items = ctx.sortKeys ? A.sort(node.items, pairKeyOrder) : node.items;
  if (items.length === 0) {
    return [withMetadataPrefix("{}", node)];
  }
  if (collectionStyleOf(node, ctx) === "flow") {
    const flowCtx: StringifyContext = { ...ctx, inFlow: true };
    const entries = A.map(items, (pair) => mapFlowEntry(pair, flowCtx, depth, !ctx.forceDefaultStyles));
    return renderFlowCollectionLines(node, entries, ctx, "{", "}");
  }
  return stringifyBlockMapLines(node, items, ctx, depth);
});

/**
 * One rendered flow-collection entry with its comment slots, already gated
 * on whether comments are emitted; `commented` records (ungated) whether the
 * source entry carried any comment or blank line.
 */
type FlowEntry = {
  readonly lines: ReadonlyArray<string>;
  readonly leading: string | undefined;
  readonly trailing: string | undefined;
  readonly spaceBefore: boolean;
  readonly commented: boolean;
};

function mapFlowEntry(pair: YamlPair, flowCtx: StringifyContext, depth: number, emitComments: boolean): FlowEntry {
  const keyLines = stringifyMappingKeyLines(pair.key, flowCtx, depth + 1);
  const valLines = pair.value !== null ? stringifyNodeLines(pair.value, flowCtx, depth + 1) : ["null"];
  const sep = pairKeySeparator(pair.key);
  return {
    lines: Str.split(`${A.join(keyLines, "\n")}${sep} ${A.join(valLines, "\n")}`, "\n"),
    leading: emitComments ? pairLeading(pair) : undefined,
    trailing: emitComments ? (pair.key.comment ?? pairTrailing(pair)) : undefined,
    spaceBefore: emitComments && pairSpaceBefore(pair) === true,
    commented: pairLeading(pair) !== undefined || pairTrailing(pair) !== undefined || pairSpaceBefore(pair) === true,
  };
}

const seqFlowEntry = (item: YamlNode, lines: ReadonlyArray<string>, emitComments: boolean): FlowEntry => ({
  lines,
  leading: emitComments ? item.commentBefore : undefined,
  trailing: emitComments ? item.comment : undefined,
  spaceBefore: emitComments && item.spaceBefore === true,
  commented: item.commentBefore !== undefined || item.comment !== undefined || item.spaceBefore === true,
});

/**
 * Render a flow collection: inline (`{a: 1, b: 2}` / `[a, b]`) unless an
 * entry carries comments (or the collection's own comment came from a
 * multi-line source) or renders across lines — then one entry per line, so a
 * `#` between the brackets cannot swallow the closing one.
 */
function renderFlowCollectionLines(
  node: YamlMap | YamlSeq,
  entries: ReadonlyArray<FlowEntry>,
  ctx: StringifyContext,
  open: string,
  close: string
): string[] {
  const flowHasComments =
    !ctx.forceDefaultStyles &&
    (A.some(entries, (entry) => entry.commented) || (node.comment !== undefined && node.sourceMultiline === true));
  if (flowHasComments || A.some(entries, (entry) => entry.lines.length > 1)) {
    return renderMultilineFlowLines(node, entries, ctx, open, close);
  }
  const inline = A.map(entries, (entry) => A.join(entry.lines, ""));
  return [withMetadataPrefix(`${open}${A.join(inline, ", ")}${close}`, node)];
}

function renderMultilineFlowLines(
  node: YamlMap | YamlSeq,
  entries: ReadonlyArray<FlowEntry>,
  ctx: StringifyContext,
  open: string,
  close: string
): string[] {
  const flowPad = Str.repeat(ctx.indent)(" ");
  const flowPrefix = buildMetadataPrefix(node.tag, node.anchor);
  const flowLines: string[] = [isNonEmptyText(flowPrefix) ? `${flowPrefix} ${open}` : open];
  for (let fi = 0; fi < entries.length; fi++) {
    pushFlowEntry(flowLines, A.getUnsafe(entries, fi), flowPad, fi < entries.length - 1 ? "," : "");
  }
  if (!ctx.forceDefaultStyles && !ctx.inFlow && node.comment !== undefined) {
    pushPadded(flowLines, commentBlockLines(node.comment), flowPad);
  }
  flowLines.push(close);
  return flowLines;
}

function pushFlowEntry(flowLines: string[], entry: FlowEntry, flowPad: string, comma: string): void {
  if (entry.spaceBefore) flowLines.push("");
  if (entry.leading !== undefined) pushPadded(flowLines, commentBlockLines(entry.leading), flowPad);
  const trailing = entry.trailing !== undefined ? renderTrailingComment(entry.trailing) : "";
  pushFlowEntryLines(flowLines, entry.lines, flowPad, `${comma}${trailing}`);
}

/** Append a trailing comment to `lines[idx]` (flattened to one line); `-1` or canonical mode drops it. */
function appendTrailingComment(lines: string[], ctx: StringifyContext, idx: number, comment: string | undefined): void {
  if (ctx.forceDefaultStyles || comment === undefined || idx < 0) return;
  lines[idx] = `${lines[idx]}${renderTrailingComment(comment)}`;
}

function stringifyBlockMapLines(
  node: YamlMap,
  items: ReadonlyArray<YamlPair>,
  ctx: StringifyContext,
  depth: number
): string[] {
  const pad = Str.repeat(ctx.indent)(" ");
  const lines: string[] = [];
  for (const pair of items) {
    pushBlockMapPair(lines, pair, node, ctx, depth, pad);
  }
  // The mapping's own trailing comment: own-line comment lines after the
  // last entry, at the entries' indent; anchor/tag on its own line before.
  return finishBlockCollectionLines(lines, node, !ctx.forceDefaultStyles);
}

function pushBlockMapPair(
  lines: string[],
  pair: YamlPair,
  node: YamlMap,
  ctx: StringifyContext,
  depth: number,
  pad: string
): void {
  const emitComments = !ctx.forceDefaultStyles;
  if (emitComments && pairSpaceBefore(pair) === true) lines.push("");
  const leading = emitComments ? pairLeading(pair) : undefined;
  if (leading !== undefined) pushAll(lines, commentBlockLines(leading));
  if (isComplexKey(pair.key)) {
    pushComplexKeyPair(lines, pair, ctx, depth, pad);
    return;
  }
  const keyStr = resolveBlockKeyText(pair.key, node, ctx, depth);
  // Rendered key past the implicit-key limit: spill to explicit-key form
  // (`? key` / `: value`) so strict parsers accept the output — the
  // reference `yaml` package's behaviour. The check runs on the rendered
  // key (quotes count), and only in block context (flow returned above).
  if (keyStr.length > IMPLICIT_KEY_MAX_LENGTH) {
    pushSpilledKeyPair(lines, keyStr, pair, ctx, depth, pad);
    return;
  }
  // Alias keys need a space before the colon to avoid the alias name
  // absorbing the `:`. Empty scalar keys whose only rendering is an
  // anchor or tag (e.g. `&a` or `!!str`) need the same disambiguation.
  const head = `${keyStr}${pairKeySeparator(pair.key)}`;
  if (pair.value === null) {
    pushNullValuePair(lines, head, pair, node, ctx);
    return;
  }
  pushBlockMapValue(lines, head, pair, pair.value, ctx, depth, pad);
}

/**
 * Explicit `? key\n: value` syntax is required when:
 * - Key is a non-empty YamlMap or YamlSeq (mapping-as-key always uses `? `
 *   so the inner pair's `:` is not confused with the outer pair's `:`; its
 *   block-rendered form cannot be inlined safely). Empty collections render
 *   as `[]` / `{}` on one line and CAN be implicit (M2N8/01: `[]: x`).
 * - Key is a scalar whose value contains a newline (cannot be expressed as
 *   an implicit `key: value` line in block form)
 * - Key is a block-style scalar (block-literal/block-folded) whose header
 *   introduces a multi-line scalar
 */
function isComplexKey(key: YamlNode): boolean {
  if (isYamlMap(key) || isYamlSeq(key)) return key.items.length > 0;
  return isYamlScalar(key) && ((P.isString(key.value) && Str.includes("\n")(key.value)) || isBlockStyle(key.style));
}

function pushComplexKeyPair(lines: string[], pair: YamlPair, ctx: StringifyContext, depth: number, pad: string): void {
  const keyLines = stringifyNodeLines(pair.key, ctx, depth + 1);
  const first = A.getUnsafe(keyLines, 0);
  // Emit "? " followed by the key
  lines.push(`? ${first}`);
  const explicitKeyLineIdx = lines.length - 1;
  const contPad = explicitKeyContinuationPad(first, pair.key);
  for (let k = 1; k < keyLines.length; k++) {
    lines.push(`${contPad}${keyLines[k]}`);
  }
  // Emit ": " followed by the value. A single-line key can carry the
  // pair's trailing comment when the value line cannot; a multi-line
  // key cannot (the comment would land inside the key content), so
  // the comment is dropped there.
  const inlineIdx = pushExplicitKeyValueLines(lines, pair.value, ctx, depth, pad);
  const keyIdx = keyLines.length === 1 ? explicitKeyLineIdx : -1;
  appendTrailingComment(lines, ctx, inlineIdx >= 0 ? inlineIdx : keyIdx, entryTrailing(pair, ctx));
}

/**
 * When the first key line is just metadata (`&anchor` and/or `!tag`), the
 * continuation lines are the actual collection content and should be emitted
 * without an extra indent — they sit at the same level as `?` (compact form).
 * Block-style scalar keys (`|`/`>`) already bake their own indent into the
 * rendered continuation lines, so no extra pad is needed. Otherwise pad
 * continuation lines two columns to align with the first line after `? `
 * (structural, never ctx.indent — see EXPLICIT_COMPACT_PAD).
 */
function explicitKeyContinuationPad(first: string, key: YamlNode): string {
  const firstTokens = A.filter(Str.split(/\s+/)(Str.trim(first)), Boolean);
  const firstIsMetaOnly =
    firstTokens.length > 0 && A.every(firstTokens, (t) => Str.startsWith("&")(t) || Str.startsWith("!")(t));
  const keyIsBlockScalar = isYamlScalar(key) && isBlockStyle(key.style);
  return firstIsMetaOnly || keyIsBlockScalar ? "" : EXPLICIT_COMPACT_PAD;
}

/**
 * The rendered implicit key. 5T43: in canonical mode, drop quotes from a
 * quoted key whose content is a simple identifier when the source map was a
 * SINGLE-line flow collection. The quotes were structurally needed in flow
 * source (e.g. `"key":value` cannot be `key:value` because flow tokens are
 * delimiter-tight) but in the converted block form an unquoted plain key is
 * unambiguous. Restricted to identifier-style content (alphanumeric +
 * underscore, no spaces) so multi-word quoted keys like `"single line"` are
 * kept (9BXH).
 */
function resolveBlockKeyText(key: YamlNode, node: YamlMap, ctx: StringifyContext, depth: number): string {
  return canonicalUnquotedKey(key, node, ctx) ?? A.join(stringifyMappingKeyLines(key, ctx, depth + 1), " ");
}

function canonicalUnquotedKey(key: YamlNode, node: YamlMap, ctx: StringifyContext): string | undefined {
  if (!ctx.forceDefaultStyles || node.style !== "flow" || node.sourceMultiline === true) return undefined;
  if (!isYamlScalar(key) || !isQuotedScalarStyle(key.style) || !P.isString(key.value)) return undefined;
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key.value) ? key.value : undefined;
}

const isQuotedScalarStyle = (style: ScalarStyle): boolean => style === "single-quoted" || style === "double-quoted";

function pushSpilledKeyPair(
  lines: string[],
  keyStr: string,
  pair: YamlPair,
  ctx: StringifyContext,
  depth: number,
  pad: string
): void {
  lines.push(`? ${keyStr}`);
  const spillKeyLineIdx = lines.length - 1;
  const inlineIdx = pushExplicitKeyValueLines(lines, pair.value, ctx, depth, pad);
  appendTrailingComment(lines, ctx, inlineIdx >= 0 ? inlineIdx : spillKeyLineIdx, entryTrailing(pair, ctx));
}

/**
 * A pair without a value renders `key:`. 4ABK: when the document ROOT is a
 * multi-line flow map AND the pair has a non-empty plain key, emit
 * `key: null` instead so the null is unambiguous in canonical (block) form.
 * Restricted to root via `ctx.parentPosition === undefined` so nested flow
 * maps (8KB6: flow inside a block-seq item) keep `key:`. Single-line flow
 * root keeps `key:` too — only multi-line flow root triggers the
 * explicit-null form.
 */
function pushNullValuePair(lines: string[], head: string, pair: YamlPair, node: YamlMap, ctx: StringifyContext): void {
  lines.push(needsExplicitNull(pair.key, node, ctx) ? `${head} null` : head);
  appendTrailingComment(lines, ctx, lines.length - 1, entryTrailing(pair, ctx));
}

function needsExplicitNull(key: YamlNode, node: YamlMap, ctx: StringifyContext): boolean {
  const isRootFlowMap = ctx.parentPosition === undefined && node.style === "flow" && node.sourceMultiline === true;
  return ctx.forceDefaultStyles && isRootFlowMap && isYamlScalar(key) && key.style === "plain" && key.length > 0;
}

/** The pieces of a block-mapping entry whose value is being emitted after `head` (`key:`). */
type MapValueEmit = {
  readonly lines: string[];
  readonly head: string;
  readonly pair: YamlPair;
  readonly valNode: YamlNode;
  readonly valLines: ReadonlyArray<string>;
  readonly valLeading: string | undefined;
  readonly ctx: StringifyContext;
  readonly pad: string;
};

function pushBlockMapValue(
  lines: string[],
  head: string,
  pair: YamlPair,
  valNode: YamlNode,
  ctx: StringifyContext,
  depth: number,
  pad: string
): void {
  const valCtx: StringifyContext = { ...ctx, parentPosition: "block-map-value" };
  const v: MapValueEmit = {
    lines,
    head,
    pair,
    valNode,
    valLines: stringifyNodeLines(valNode, valCtx, depth + 1),
    // A value node's own leading comment block, or undefined.
    valLeading: ctx.forceDefaultStyles ? undefined : valNode.commentBefore,
    ctx,
    pad,
  };
  if (isYamlSeq(valNode) && isBlockCollectionNode(valNode, ctx)) {
    pushBlockSeqMapValue(v, valNode);
    return;
  }
  if (isYamlMap(valNode) && isBlockCollectionNode(valNode, ctx)) {
    pushNestedBlockMapValue(v, valNode);
    return;
  }
  if (v.valLines.length === 1) {
    pushSingleLineMapValue(v, A.getUnsafe(v.valLines, 0));
    return;
  }
  pushMultiLineMapValue(v);
}

/**
 * Push the key line of a block collection value, carrying the collection's
 * anchor/tag (dropped from its own first line) and the entry's trailing
 * comment; returns how many leading value lines that metadata consumed.
 */
function pushCollectionValueHead(v: MapValueEmit, valNode: YamlMap | YamlSeq): number {
  const meta = buildMetadataPrefix(valNode.tag, valNode.anchor);
  const hasMeta = isNonEmptyText(meta);
  v.lines.push(hasMeta ? `${v.head} ${meta}` : v.head);
  appendTrailingComment(v.lines, v.ctx, v.lines.length - 1, entryTrailing(v.pair, v.ctx));
  return hasMeta ? 1 : 0;
}

/**
 * Block sequence as mapping value: compact notation (no extra indent) by
 * default; one indent level when `indentSequences` is set (the `yaml` npm
 * package's default presentation). Empty lines (block scalar bodies) are
 * never padded — no trailing whitespace. The sequence's own leading comment
 * sits at the items' indent.
 */
function pushBlockSeqMapValue(v: MapValueEmit, valNode: YamlSeq): void {
  const startIdx = pushCollectionValueHead(v, valNode);
  const itemPad = v.ctx.indentSequences ? v.pad : "";
  if (v.valLeading !== undefined) {
    for (const cl of commentBlockLines(v.valLeading)) v.lines.push(`${itemPad}${cl}`);
  }
  pushPadded(v.lines, v.valLines.slice(startIdx), itemPad);
}

/** Non-empty block mapping as value: put on next line with indent. */
function pushNestedBlockMapValue(v: MapValueEmit, valNode: YamlMap): void {
  const startIdx = pushCollectionValueHead(v, valNode);
  pushLeadingComments(v.lines, v.valLeading, v.pad);
  pushPadded(v.lines, v.valLines.slice(startIdx), v.pad);
}

/**
 * A one-line value sits on the key line (an empty value renders `key:` with
 * no trailing space) — unless it renders BELOW the key, for either of two
 * reasons: it has a leading comment block that needs the line above it, or
 * the key itself carries a trailing comment — which in this model means the
 * value was written below in the first place. Hoisting it back onto the key
 * line would put two comments on one line and silently drop one of them.
 * Each node's trailing comment goes on that node's OWN line: routing the key
 * line through `entryTrailing` reached past an absent key comment to the
 * VALUE's, printing it on the key line and skipping the value's own —
 * `a:\n  # lead\n  1 # vc\n` lost the line it was written on.
 */
function pushSingleLineMapValue(v: MapValueEmit, only: string): void {
  const keyOwnComment = v.ctx.forceDefaultStyles ? undefined : v.pair.key.comment;
  if (v.valLeading === undefined && keyOwnComment === undefined) {
    v.lines.push(only === "" ? v.head : `${v.head} ${only}`);
    appendTrailingComment(v.lines, v.ctx, v.lines.length - 1, entryTrailing(v.pair, v.ctx));
    return;
  }
  v.lines.push(v.head);
  appendTrailingComment(v.lines, v.ctx, v.lines.length - 1, keyOwnComment);
  pushLeadingComments(v.lines, v.valLeading, v.pad);
  v.lines.push(only === "" ? "" : `${v.pad}${only}`);
  appendTrailingComment(v.lines, v.ctx, v.lines.length - 1, v.valNode.comment);
}

/**
 * A multi-line value: block scalar headers and multi-line quoted scalars
 * (after the optional `&anchor` / `!tag` prefix the scalar renderer may add)
 * keep their first line on the key line; non-empty block maps were handled
 * before, so anything else is a multiline flow collection below the key.
 */
function pushMultiLineMapValue(v: MapValueEmit): void {
  const first = A.getUnsafe(v.valLines, 0);
  const { isBlockScalarHeader, isInlineQuoted } = inlineScalarShape(first, v.valNode);
  if (isBlockScalarHeader || isInlineQuoted) {
    pushInlineScalarMapValue(v, first, isBlockScalarHeader);
    return;
  }
  v.lines.push(v.head);
  appendTrailingComment(v.lines, v.ctx, v.lines.length - 1, entryTrailing(v.pair, v.ctx));
  pushLeadingComments(v.lines, v.valLeading, v.pad);
  pushPadded(v.lines, v.valLines, v.pad);
}

function pushInlineScalarMapValue(v: MapValueEmit, first: string, isBlockScalarHeader: boolean): void {
  // The value has its own leading block, which needs the line above the
  // value — so the value spills off the key line and the header goes with
  // it, keeping one comment per line.
  if (v.valLeading !== undefined) {
    v.lines.push(v.head);
    pushPadded(v.lines, commentBlockLines(v.valLeading), v.pad);
    pushSpilledScalarValue(v, first, entryTrailing(v.pair, v.ctx));
    return;
  }
  // The KEY's own comment and a block scalar's header comment both want
  // the key line, because the header is emitted there. Give each a
  // line: the key keeps its own, and the header spills to an indented
  // line of its own (`a: # pair` / `  | # hdr` / `  body`).
  const keyComment = v.ctx.forceDefaultStyles ? undefined : v.pair.key.comment;
  const scalarComment = isBlockScalarHeader && isYamlScalar(v.valNode) ? v.valNode.comment : undefined;
  if (keyComment !== undefined && scalarComment !== undefined) {
    v.lines.push(v.head);
    appendTrailingComment(v.lines, v.ctx, v.lines.length - 1, keyComment);
    pushSpilledScalarValue(v, first, scalarComment);
    return;
  }
  const headerIdx = v.lines.length;
  v.lines.push(`${v.head} ${first}`);
  pushAll(v.lines, v.valLines.slice(1));
  // The entry's trailing comment goes on the line its VALUE ends on:
  // for a block scalar that is the header line (`key: | # c`, the one
  // line of a block scalar that legally carries a `#`), for a
  // multi-line quoted scalar its closing line. A block scalar's
  // "header comment" and the entry's trailing comment are the same
  // field on the same node under the node-level model, so there is no
  // arbitration between them left to do.
  appendTrailingComment(
    v.lines,
    v.ctx,
    isBlockScalarHeader ? headerIdx : v.lines.length - 1,
    entryTrailing(v.pair, v.ctx)
  );
}

/** Emit an inline scalar value on its own indented line below the key, its first line carrying `comment`. */
function pushSpilledScalarValue(v: MapValueEmit, first: string, comment: string | undefined): void {
  const spilledIdx = v.lines.length;
  v.lines.push(`${v.pad}${first}`);
  pushAll(v.lines, v.valLines.slice(1));
  appendTrailingComment(v.lines, v.ctx, spilledIdx, comment);
}

/**
 * Builds a metadata prefix string from tag and anchor.
 * Returns the combined prefix or undefined if neither is present.
 */
const buildMetadataPrefix: {
  (tag: string | undefined, anchor: string | undefined): string | undefined;
  (anchor: string | undefined): (tag: string | undefined) => string | undefined;
} = dual(2, (tag: string | undefined, anchor: string | undefined): string | undefined => {
  if (!(tag !== undefined && tag !== "") && !(anchor !== undefined && anchor !== "")) return undefined;
  // Canonical ordering: &anchor !!tag (anchor before tag)
  const parts: string[] = [];
  if (anchor !== undefined && anchor !== "") parts.push(`&${anchor}`);
  if (tag !== undefined && tag !== "") parts.push(tag);
  return A.join(parts, " ");
});

/**
 * Strips a leading run of `&anchor`/`!tag` metadata tokens (each followed by
 * whitespace) from a rendered scalar line and returns the remainder. Used to
 * detect quoted/block scalar style after the optional metadata prefix that
 * `stringifyScalarNodeLines` may prepend to the first output line.
 */
function stripScalarMetadataPrefix(line: string): string {
  let i = 0;
  for (let next = metadataTokenEnd(line, i); next > i; next = metadataTokenEnd(line, i)) {
    i = next;
  }
  return Str.slice(i)(line);
}

/**
 * The offset just past the `&anchor`/`!tag` token at `i` and its trailing
 * whitespace, or `i` itself when no complete metadata token starts there (a
 * bare indicator, or a token running to the end of the line).
 */
function metadataTokenEnd(line: string, i: number): number {
  if (i >= line.length) return i;
  const ch = line[i];
  if (ch !== "&" && ch !== "!") return i;
  const j = skipNonBlank(line, i + 1);
  if (j >= line.length || j === i + 1) return i;
  return skipBlank(line, j);
}

/** The first offset at or after `j` holding a space or tab (or the line end). */
function skipNonBlank(line: string, j: number): number {
  let k = j;
  while (k < line.length && line[k] !== " " && line[k] !== "\t") k++;
  return k;
}

/** The first offset at or after `j` holding neither a space nor a tab (or the line end). */
function skipBlank(line: string, j: number): number {
  let k = j;
  while (k < line.length && (line[k] === " " || line[k] === "\t")) k++;
  return k;
}

/**
 * Stringifies a YamlSeq node into lines, using the node's collection style.
 */
const stringifySeqNodeLines: {
  (node: YamlSeq, ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (node: YamlSeq) => string[];
} = dual(3, (node: YamlSeq, ctx: StringifyContext, depth: number): string[] => {
  const items = [...node.items];
  if (items.length === 0) {
    return [withMetadataPrefix("[]", node)];
  }
  if (collectionStyleOf(node, ctx) === "flow") {
    const flowCtx: StringifyContext = { ...ctx, inFlow: true };
    const emitComments = !ctx.forceDefaultStyles;
    const entries = A.map(items, (item) =>
      seqFlowEntry(item, stringifyNodeLines(item, flowCtx, depth + 1), emitComments)
    );
    return renderFlowCollectionLines(node, entries, ctx, "[", "]");
  }
  // Block style
  const pad = Str.repeat(ctx.indent)(" ");
  const lines: string[] = [];
  const itemCtx: StringifyContext = { ...ctx, parentPosition: "block-seq-item" };
  for (const item of items) {
    pushBlockSeqNodeItem(lines, item, itemCtx, depth, pad);
  }
  // The sequence's own trailing comment: own-line comment lines after the
  // last item, at the items' indent; anchor/tag on its own line before.
  return finishBlockCollectionLines(lines, node, !ctx.forceDefaultStyles);
});

function pushBlockSeqNodeItem(
  lines: string[],
  item: YamlNode,
  itemCtx: StringifyContext,
  depth: number,
  pad: string
): void {
  const emitComments = !itemCtx.forceDefaultStyles;
  if (emitComments && item.spaceBefore === true) lines.push("");
  if (emitComments && item.commentBefore !== undefined) pushAll(lines, commentBlockLines(item.commentBefore));
  const itemLines = stringifyNodeLines(item, itemCtx, depth + 1);
  // Append the item's trailing comment to the line that can carry it.
  appendTrailingComment(lines, itemCtx, pushSeqItemLines(lines, item, itemLines, pad), item.comment);
}

/** A block-sequence dash line; an empty value is just `-` with no trailing space. */
const dashLine = (first: string): string => (first === "" ? "-" : `- ${first}`);

/**
 * Push one block-sequence item and return the index of the line that
 * carries its trailing comment. Block scalar headers and multi-line quoted
 * scalars (when the item is itself a YamlScalar) place their first line
 * inline after `- `, with continuation lines emitted as-is — detection
 * allows an optional `&anchor` / `!tag` prefix the scalar renderer may have
 * added. A block scalar's HEADER line legally carries the trailing comment
 * (`- | # c`); a multi-line quoted scalar closes on its last line, which
 * carries it instead. A nested mapping or sequence indents its continuation
 * lines by one level and keeps the comment on the dash line.
 */
function pushSeqItemLines(lines: string[], item: YamlNode, itemLines: ReadonlyArray<string>, pad: string): number {
  const first = A.getUnsafe(itemLines, 0);
  if (itemLines.length === 1) {
    lines.push(dashLine(first));
    return lines.length - 1;
  }
  const { isBlockScalarHeader, isInlineQuoted } = inlineScalarShape(first, item);
  if (isBlockScalarHeader || isInlineQuoted) {
    const headerIdx = lines.length;
    lines.push(`- ${first}`);
    pushAll(lines, itemLines.slice(1));
    return isBlockScalarHeader ? headerIdx : lines.length - 1;
  }
  lines.push(dashLine(first));
  const dashLineIdx = lines.length - 1;
  pushPadded(lines, itemLines.slice(1), pad);
  return dashLineIdx;
}

// ---------------------------------------------------------------------------
// Engine entry points
// ---------------------------------------------------------------------------

/**
 * Converts a JavaScript value into a YAML text string.
 *
 * **Details**
 *
 * Handles all primitive types, arrays, and plain objects. Special numbers
 * (`Infinity`, `-Infinity`, `NaN`) are rendered as `.inf`, `-.inf`, and
 * `.nan` respectively. Circular references throw {@link StringifyFailure}.
 *
 * **Example** (Render a mapping without a final newline)
 *
 * ```ts
 * import { StringifyOptionsInput } from "@beep/yaml/internal/options"
 * import { stringifyValue } from "@beep/yaml/internal/stringifier"
 *
 * console.log(stringifyValue({ greeting: "hello" }, StringifyOptionsInput.make({ finalNewline: false }))) // greeting: hello
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export function stringifyValue(value: unknown, ...[options]: [options?: StringifyOptionsInput]): string {
  const ctx = createContext(options);
  const result = A.join(stringifyLines(value, ctx, 0), "\n");
  return (options?.finalNewline ?? true) ? `${result}\n` : result;
}

/**
 * Converts a composed YAML document AST into a YAML text string, preserving
 * the style metadata encoded in each AST node.
 *
 * **Details**
 *
 * Scalar nodes use their `style` field to control rendering; collection
 * nodes use their `style` field (`"block"` or `"flow"`). Nodes without an
 * explicit style fall back to the defaults in `options`.
 *
 * **Example** (Preserve a flow sequence in a composed document)
 *
 * ```ts
 * import { StringifyOptionsInput } from "@beep/yaml/internal/options"
 * import { RawYamlDocument } from "@beep/yaml/internal/raw-document"
 * import { stringifyDocument } from "@beep/yaml/internal/stringifier"
 * import { YamlScalar, YamlSeq } from "@beep/yaml/YamlNode"
 *
 * const doc = RawYamlDocument.make({
 *   contents: YamlSeq.make({
 *     items: [YamlScalar.make({ value: "hello", style: "plain", offset: 1, length: 5 })],
 *     style: "flow", offset: 0, length: 7
 *   }),
 *   errors: [], warnings: [], directives: [],
 *   hasDocumentStart: false, hasDocumentEnd: false, hasDocumentStartTab: false
 * })
 * console.log(stringifyDocument(doc, StringifyOptionsInput.make({ finalNewline: false }))) // [hello]
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export function stringifyDocument(doc: RawYamlDocument, ...[options]: [options?: StringifyOptionsInput]): string {
  const ctx = createContext(options);
  const finalNewline = options?.finalNewline ?? true;
  // Multi-line document comments render one `# ` line per stored line.
  const docComment = ctx.forceDefaultStyles ? undefined : commentBlockText(doc.commentBefore);
  // Strip comments and normalize tags when producing canonical output
  const contents =
    ctx.forceDefaultStyles && doc.contents !== null
      ? normalizeNodeTags(stripNodeComments(doc.contents), buildTagMap(doc.directives))
      : doc.contents;
  if (contents === null) return stringifyEmptyDocument(doc, ctx, docComment, finalNewline);
  return prependDocComment(docComment, stringifyDocumentBody(doc, contents, ctx, finalNewline));
}

/** A stored comment block rendered as `#` lines joined by newlines, or undefined. */
const commentBlockText = (comment: string | undefined): string | undefined =>
  comment !== undefined ? A.join(commentBlockLines(comment), "\n") : undefined;

/** `text` behind the document's leading comment block, when it has a non-empty one. */
const prependDocComment = (docComment: string | undefined, text: string): string =>
  isNonEmptyText(docComment) ? `${docComment}\n${text}` : text;

/** Trim the output's final newline unless `finalNewline` asks to keep it. */
const applyFinalNewline = (out: string, finalNewline: boolean): string =>
  finalNewline ? out : Str.replace(/\n$/, "")(out);

function stringifyEmptyDocument(
  doc: RawYamlDocument,
  ctx: StringifyContext,
  docComment: string | undefined,
  finalNewline: boolean
): string {
  if (ctx.forceDefaultStyles) return canonicalEmptyDocument(doc, finalNewline);
  // An empty document still renders its framing and document comments —
  // `---\n...\n# tail\n` must keep its markers and trailing block. Only
  // a fully bare empty document falls back to the `null` body.
  if (hasEmptyDocumentFraming(doc, docComment)) {
    return applyFinalNewline(framedEmptyDocument(doc, docComment), finalNewline);
  }
  return finalNewline ? "null\n" : "null";
}

/**
 * Empty document in canonical mode: emit --- for doc-start markers.
 * Bare ... (no doc-start, no content) produces empty output.
 */
function canonicalEmptyDocument(doc: RawYamlDocument, finalNewline: boolean): string {
  if (!doc.hasDocumentStart) return "";
  return applyFinalNewline(`---\n${doc.hasDocumentEnd ? "...\n" : ""}`, finalNewline);
}

const hasEmptyDocumentFraming = (doc: RawYamlDocument, docComment: string | undefined): boolean =>
  docComment !== undefined || doc.comment !== undefined || doc.hasDocumentStart === true || doc.hasDocumentEnd === true;

function framedEmptyDocument(doc: RawYamlDocument, docComment: string | undefined): string {
  const parts: string[] = [];
  if (docComment !== undefined) parts.push(`${docComment}\n`);
  if (doc.hasDocumentStart) parts.push("---\n");
  if (doc.hasDocumentEnd) parts.push("...\n");
  if (doc.comment !== undefined) parts.push(`${A.join(commentBlockLines(doc.comment), "\n")}\n`);
  return A.join(parts, "");
}

function stringifyDocumentBody(
  doc: RawYamlDocument,
  contents: YamlNode,
  ctx: StringifyContext,
  finalNewline: boolean
): string {
  const result = A.join(stringifyNodeLines(contents, ctx, 0), "\n");
  const rendered = withRootHeaderComment(result, contents, ctx);
  const docEndFull = documentEndText(doc, contents, ctx, result);
  // `finalNewline` governs the very end of the OUTPUT, not internal
  // separators: when a `...` marker or trailing comment block follows the
  // body, the body keeps its newline (gluing the marker onto the last
  // content line would change the document's meaning — `a: 1...`) and the
  // option trims the trailing newline of the marker/comment block instead.
  const body = finalNewline || docEndFull !== "" ? `${rendered}\n` : rendered;
  const docEnd = docEndFull === "" ? docEndFull : applyFinalNewline(docEndFull, finalNewline);
  // A header comment sitting AFTER the `---` marker leads the ROOT NODE, and
  // the root is the one position with no parent to emit a node's leading
  // block for it — the same missing-slot shape as the root block-scalar
  // header. Emit it on the marker's far side.
  // Not gated on the marker: a marker-LESS header over a scalar or empty
  // collection root is stored the same way (a non-empty collection takes it
  // on its first entry instead), and gating dropped it entirely.
  const rootLeadingText = ctx.forceDefaultStyles ? undefined : commentBlockText(contents.commentBefore);
  const rootLeading = rootLeadingText === undefined ? "" : `${rootLeadingText}\n`;
  return doc.hasDocumentStart
    ? frameAfterDocumentStart(contents, body, docEnd, rootLeading)
    : `${rootLeading}${body}${docEnd}`;
}

/**
 * A block scalar at the DOCUMENT ROOT carries its captured header comment on
 * the header line, exactly as the pair, seq-item and explicit-key paths do.
 * Splicing before `body` is formed covers the bare, `---` and tag/anchor
 * return branches alike; unlike those three paths the root has no competing
 * pair-level comment, so the one header slot is never contested. Canonical
 * mode stays comment-free.
 */
function withRootHeaderComment(result: string, contents: YamlNode, ctx: StringifyContext): string {
  if (ctx.forceDefaultStyles || !isYamlScalar(contents) || !isBlockStyle(contents.style)) return result;
  return contents.comment === undefined ? result : withHeaderComment(result, contents.comment);
}

/**
 * The `...` marker (when needed) followed by the document's TRAILING comment
 * block, which renders after the content and after the marker when present;
 * canonical mode stays comment-free.
 */
function documentEndText(doc: RawYamlDocument, contents: YamlNode, ctx: StringifyContext, result: string): string {
  const docEndMarker = doc.hasDocumentEnd || needsCanonicalTerminator(doc, contents, ctx, result) ? "...\n" : "";
  const docCommentAfter = ctx.forceDefaultStyles ? undefined : commentBlockText(doc.comment);
  return docCommentAfter !== undefined ? `${docEndMarker}${docCommentAfter}\n` : docEndMarker;
}

/**
 * In canonical mode, an explicit `...` end marker is required when:
 * - The final emitted scalar uses keep-chomp (`|+` or `>+`) — without it the
 *   reader cannot tell where the open-ended block scalar ends.
 * - K54U: the source was `---<TAB>scalar` — libyaml's canonical emitter is
 *   conservative when a tab follows `---`, since downstream tooling that
 *   re-tokenises might mis-handle the tab.
 * - An explicit `---` introduces a plain root scalar that is anchored
 *   (see {@link isTerminatedRootScalar}).
 */
function needsCanonicalTerminator(
  doc: RawYamlDocument,
  contents: YamlNode,
  ctx: StringifyContext,
  result: string
): boolean {
  if (!ctx.forceDefaultStyles) return false;
  return (
    endsWithKeepChomp(result) ||
    doc.hasDocumentStartTab === true ||
    (doc.hasDocumentStart && isTerminatedRootScalar(contents))
  );
}

/**
 * A plain root scalar after `---` that needs `...`: an anchored, untagged
 * scalar — the marker binds the anchor to a definite node identity so
 * trailing content isn't absorbed into the scalar value — or (XLQ9) a
 * multi-line scalar whose folded value contains a `%`-introduced
 * directive-like substring (e.g. "scalar %YAML 1.2"), so a follow-on parser
 * cannot re-interpret the trailing `%XXX` as a directive. libyaml's canonical
 * emitter is conservative here; other multi-line plain roots (3MYT, EX5H,
 * EXG3) without a `%` continuation render without `...`.
 */
function isTerminatedRootScalar(contents: YamlNode): boolean {
  if (!isYamlScalar(contents) || contents.style !== "plain") return false;
  const anchoredUntagged = contents.anchor !== undefined && !isNonEmptyText(contents.tag);
  const directiveLikeMultiline =
    contents.sourceMultiline === true && P.isString(contents.value) && / %[A-Z]/.test(contents.value);
  return anchoredUntagged || directiveLikeMultiline;
}

/**
 * Frame the body after an explicit `---`: root tag/anchor metadata moves onto
 * the marker line (canonical ordering `&anchor !!tag`), an untagged scalar
 * root sits inline after the marker, and everything else starts below it.
 */
function frameAfterDocumentStart(contents: YamlNode, body: string, docEnd: string, rootLeading: string): string {
  const metaStr = rootMetadataPrefix(contents);
  if (metaStr !== undefined) {
    const sep = isYamlMap(contents) || isYamlSeq(contents) ? "\n" : " ";
    const bodyClean = stripRootMetadata(body, metaStr);
    return `--- ${metaStr}${rootLeading === "" ? sep : `\n${rootLeading}`}${bodyClean}${docEnd}`;
  }
  // No tag/anchor — inline scalars after ---
  if (isYamlScalar(contents) && rootLeading === "") return `--- ${body}${docEnd}`;
  return `---\n${rootLeading}${body}${docEnd}`;
}

/** The root node's `&anchor !!tag` prefix, or undefined when it carries neither. */
const rootMetadataPrefix = (contents: YamlNode): string | undefined =>
  buildMetadataPrefix("tag" in contents ? contents.tag : undefined, "anchor" in contents ? contents.anchor : undefined);

/**
 * Strip the root's tag/anchor prefix (already prepended by
 * stringifyNodeLines) from the body: on its own line for block collections,
 * inline otherwise.
 */
function stripRootMetadata(body: string, metaStr: string): string {
  const metaLinePrefix = `${metaStr}\n`;
  if (Str.startsWith(metaLinePrefix)(body)) return Str.slice(metaLinePrefix.length)(body);
  const metaInlinePrefix = `${metaStr} `;
  return Str.startsWith(metaInlinePrefix)(body) ? Str.slice(metaInlinePrefix.length)(body) : body;
}
