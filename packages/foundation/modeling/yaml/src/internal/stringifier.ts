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

// decision: explicit-key-spill
const IMPLICIT_KEY_MAX_LENGTH = 1024;
const EXPLICIT_COMPACT_PAD = "  ";

const NULL_RE = /^(?:null|Null|NULL|~)$/;
const TRUE_RE = /^(?:true|True|TRUE)$/;
const FALSE_RE = /^(?:false|False|FALSE)$/;
const INT_RE = /^[-+]?[0-9]+$/;
const OCT_RE = /^0o[0-7]+$/;
const HEX_RE = /^0x[\dA-Fa-f]+$/;
const FLOAT_RE = /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/;
const INF_RE = /^[-+]?\.(?:inf|Inf|INF)$/;
const NAN_RE = /^\.(?:nan|NaN|NAN)$/;

const INDICATOR_CHARS = ":#{}[],&*?|-<>=!%@`\"'";

function wouldCoreSchemaResolveAsNonString(s: string): boolean {
  return matchesAny(CORE_SCHEMA_IMPLICIT_RESOLVERS_IN_TEST_ORDER, s);
}

const CORE_SCHEMA_IMPLICIT_RESOLVERS_IN_TEST_ORDER: ReadonlyArray<RegExp> = [
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

function matchesAny(patterns: ReadonlyArray<RegExp>, s: string): boolean {
  for (const re of patterns) {
    if (re.test(s)) return true;
  }
  return false;
}

// decision: yaml-1-1-compat-quotes-the-union
const BOOL_11_RE = /^(?:y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/;
const INT_11_RE = /^[-+]?(?:0b[0-1_]+|0o?[0-7_]+|[0-9][0-9_]*|0x[0-9a-fA-F_]+|[1-9][0-9_]*(?::[0-5]?[0-9])+)$/;
const FLOAT_11_RE =
  /^[-+]?(?:[0-9][0-9_]*(?:\.[0-9_]*(?:[eE][-+]?[0-9]+)?|[eE][-+]?[0-9]+)|\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*)$/;
const TIMESTAMP_11_RE =
  /^[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?(?:(?:[Tt]|[ \t]+)[0-9][0-9]?:[0-9][0-9]:[0-9][0-9](?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9][0-9]?(?::?[0-9][0-9])?))?)?$/;

/**
 * Returns true if a string value would be resolved as a non-string type by a
 * YAML 1.1 parser.
 *
 * **Details**
 *
 * The delta over the YAML 1.2 Core Schema patterns: null spellings are
 * identical in both editions (and already covered there), so only the
 * boolean, integer, float and timestamp families are tested here.
 *
 * **Example** (Spot YAML 1.1 coercions)
 *
 * ```ts
 * import { wouldBeResolved11 } from "@beep/yaml/internal/stringifier"
 *
 * console.log(wouldBeResolved11("on"), wouldBeResolved11("1:30"), wouldBeResolved11("redis")) // true true false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export function wouldBeResolved11(s: string): boolean {
  return matchesAny(YAML_11_RES, s);
}

const FLOAT_11_REFERENCE_RE = /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$|^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/;
const SEXAGESIMAL_11_REFERENCE_RE = /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+(?:\.[0-9_]*)?$/;

const YAML_11_RES: ReadonlyArray<RegExp> = [
  BOOL_11_RE,
  INT_11_RE,
  FLOAT_11_RE,
  FLOAT_11_REFERENCE_RE,
  SEXAGESIMAL_11_REFERENCE_RE,
  TIMESTAMP_11_RE,
];

const C_FLOW_INDICATOR_UNSAFE_IN_FLOW_PLAIN_SECTION_7_3_3 = /[,[\]{}]/;

const requiresQuoting: {
  (ignoreType?: boolean, quoteCompat?: QuoteCompat, inFlow?: boolean, plainTab?: boolean): (s: string) => boolean;
  (s: string, ignoreType?: boolean, quoteCompat?: QuoteCompat, inFlow?: boolean, plainTab?: boolean): boolean;
} = dual(
  (args) => P.isString(args[0]),
  (s: string, ignoreType?: boolean, quoteCompat?: QuoteCompat, inFlow?: boolean, plainTab?: boolean): boolean =>
    s === "" ||
    (inFlow === true && C_FLOW_INDICATOR_UNSAFE_IN_FLOW_PLAIN_SECTION_7_3_3.test(s)) ||
    wouldBeCoerced(s, ignoreType === true, quoteCompat) ||
    hasUnsafeLeadingIndicator(s) ||
    hasAmbiguousPlainSyntax(s) ||
    hasUnplainableChar(s, plainTab === true)
);

function wouldBeCoerced(s: string, tagOverridesResolution: boolean, quoteCompat: QuoteCompat | undefined): boolean {
  if (tagOverridesResolution) return false;
  return wouldCoreSchemaResolveAsNonString(s) || (quoteCompat === "yaml-1.1" && wouldBeResolved11(s));
}

function hasUnsafeLeadingIndicator(s: string): boolean {
  const first = Str.slice(0, 1)(s);
  if (first === " " || first === "\t") return true;
  if (!Str.includes(first)(INDICATOR_CHARS)) return false;
  const opensPlainUnlessFollowedByWhitespace = first === ":" || first === "?" || first === "-";
  if (!opensPlainUnlessFollowedByWhitespace) return true;
  const second = s[1];
  return s.length === 1 || second === " " || second === "\t";
}

function hasAmbiguousPlainSyntax(s: string): boolean {
  const documentMarkerPrefixAmbiguousAtLineStart = Str.startsWith("---")(s) || Str.startsWith("...")(s);
  if (documentMarkerPrefixAmbiguousAtLineStart) return true;
  const mappingValueIndicator = Str.includes(": ")(s) || Str.includes(":\t")(s) || Str.endsWith(":")(s);
  if (mappingValueIndicator) return true;
  const commentIndicator = Str.includes(" #")(s) || Str.includes("\t#")(s);
  if (commentIndicator) return true;
  const last = Str.slice(-1)(s);
  const trailingWhitespacePlainScalarsLose = last === " " || last === "\t";
  return trailingWhitespacePlainScalarsLose;
}

// decision: quote-fallback-defaults
const c0ExceptLfSoTabAndNormalisedCrAreQuoted = /[\x00-\x09\x0b-\x1f]/;
const c0ExceptLfAndTab = /[\x00-\x08\x0b-\x1f]/;

function hasUnplainableChar(s: string, plainTab: boolean): boolean {
  const unsafe = plainTab ? c0ExceptLfAndTab : c0ExceptLfSoTabAndNormalisedCrAreQuoted;
  for (let i = 0; i < s.length; i++) {
    const ch = Str.slice(i, i + 1)(s);
    if (unsafe.test(ch)) return true;
  }
  return false;
}

function hasNonAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (Str.slice(i, i + 1)(s) > "~") return true;
  }
  return false;
}

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
  return `"${replaceWith(canonical ? CANONICAL_ESCAPED_CODE_POINT_SURROGATE_PAIR_AWARE : C0_NOT_ALREADY_ESCAPED_BY_NAME, escapeDoubleQuotedChar)(escaped)}"`;
}

const C0_NOT_ALREADY_ESCAPED_BY_NAME = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;

const CANONICAL_ESCAPED_CODE_POINT_SURROGATE_PAIR_AWARE = /[\x00-\x08\x0b\x0c\x0e-\x1f]|[^\x00-\x7e]/gu;

const YAML_1_2_NAMED_C0_ESCAPES_BY_CODE: Readonly<Record<number, string>> = {
  0: "\\0",
  7: "\\a",
  8: "\\b",
  11: "\\v",
  12: "\\f",
  27: "\\e",
};

function escapeDoubleQuotedChar(ch: string): string {
  const code = pipe(ch, Str.charCodeAt(0), O.getOrElse(constant(0)));
  if (isControlChar(code))
    return YAML_1_2_NAMED_C0_ESCAPES_BY_CODE[code] ?? `\\x${Str.padStart(2, "0")(code.toString(16))}`;
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
 * picks it per value like the `yaml` npm package's default
 * (`singleQuote: null`), single quotes for a value holding `"` and no `'` and double quotes
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
      // decision: quote-fallback-defaults
      if (quoteStyle !== "auto" && Str.includes("\t")(s)) {
        return renderDoubleQuoted(s, canonical);
      }
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
    // decision: block-scalar-header-emission
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

const crOrC0EscapedUnderEveryStyle = /[\x00-\x08\x0b-\x1f]/;

function mustDoubleQuoteString(s: string, style: ScalarStyle, inFlow: boolean): boolean {
  const flowJoinsRenderedLinesSoNoNewlineOrBlockHeader = inFlow && (Str.includes("\n")(s) || isBlockStyle(style));
  if (flowJoinsRenderedLinesSoNoNewlineOrBlockHeader) return true;
  for (let i = 0; i < s.length; i++) {
    const ch = Str.slice(i, i + 1)(s);
    if (crOrC0EscapedUnderEveryStyle.test(ch)) return true;
  }
  return false;
}

// decision: canonical-mode-libyaml-scalars
function multilineNeedsDoubleQuote(s: string, style: ScalarStyle, canonical: boolean): boolean {
  const blockStyle = isBlockStyle(style);
  const spacesAndNewlinesOnlyFitOnlyASourceBlockStyle = /^[\n ]*$/.test(s);
  if (!blockStyle && spacesAndNewlinesOnlyFitOnlyASourceBlockStyle) return true;
  return canonical && blockStyle && (hasInteriorTrailingWhitespace(s) || hasNewlineSpacesTab(s));
}

function renderMultilineString(input: StringRenderContext, style: ScalarStyle, nested: boolean): string {
  if (multilineNeedsDoubleQuote(input.s, style, input.canonical)) return renderDoubleQuoted(input.s, input.canonical);
  return multilineStyleRenderers[style](input, nested);
}

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
  if ((nested && Str.endsWith("\n")(s)) || /\n[ \t]/.test(s)) return renderDoubleQuoted(s, canonical);
  return O.getOrElse(renderSingleQuotedMultiline(s, indent), () => renderDoubleQuoted(s, canonical));
}

function renderSingleLineString(input: StringRenderContext, style: ScalarStyle): string {
  const { s, canonical } = input;
  if (canonical && hasNonAscii(s)) return renderDoubleQuoted(s, true);
  if (s === "" && isBlockStyle(style)) return renderDoubleQuoted(s, canonical);
  return stringStyleRenderers[style](input);
}

function endsWithKeepChomp(rendered: string): boolean {
  const match = O.getOrNull(Str.match(/[|>][1-9]?[+-]?$|[|>][1-9]?[+-]?(?=\n)/g)(rendered));
  if (match === null) return false;
  const last = A.getUnsafe(match, match.length - 1);
  return Str.includes("+")(last);
}

function renderNumber(n: number): string {
  if (Number.isNaN(n)) return ".nan";
  if (n === Number.POSITIVE_INFINITY) return ".inf";
  if (n === Number.NEGATIVE_INFINITY) return "-.inf";
  return String(n);
}

const detectCircular: {
  (value: object, seen: object[]): void;
  (seen: object[]): (value: object) => void;
} = dual(2, (value: object, seen: object[]): void => {
  if (A.some(seen, (ancestor) => ancestor === value)) {
    throw StringifyFailure.make({ message: "Circular reference detected", reason: "Circular reference detected" });
  }
});

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

// decision: quote-fallback-defaults
function createContext(options?: StringifyOptionsInput): StringifyContext {
  const o: Partial<StringifyOptionsInput> = options ?? {};
  return {
    indent: orDefault(o.indent, 2),
    lineWidth: orDefault(o.lineWidth, 0),
    defaultScalarStyle: orDefault(o.defaultScalarStyle, "plain"),
    defaultCollectionStyle: orDefault(o.defaultCollectionStyle, "block"),
    sortKeys: orDefault(o.sortKeys, false),
    indentSequences: orDefault(o.indentSequences, false),
    quoteStyle: orDefault(o.quoteStyle, "single"),
    quoteCompat: o.quoteCompat,
    forceDefaultStyles: orDefault(o.forceDefaultStyles, false),
    seen: [],
    inFlow: orDefault(o.inFlow, false),
  };
}

const orDefault = <A>(value: A | undefined, fallback: A): A => value ?? fallback;

const stringifyUnindentedLines: {
  (ctx: StringifyContext, depth: number, allowFold?: boolean): (value: unknown) => string[];
  (value: unknown, ctx: StringifyContext, depth: number, allowFold?: boolean): string[];
} = dual(
  (args) => P.isObjectKeyword(args[1]),
  (value: unknown, ctx: StringifyContext, depth: number, allowFold?: boolean): string[] => {
    if (depth > MAX_NESTING_DEPTH)
      throw StringifyDepthExceeded.make({ message: `Nesting depth exceeded maximum of ${MAX_NESTING_DEPTH}` });
    if (P.isString(value)) return stringifyStringLines(value, ctx, depth, allowFold !== false);
    if (A.isArray(value)) return withAncestor(value, ctx, () => stringifyArrayLines(value, ctx, depth));
    if (P.isObject(value)) return withAncestor(value, ctx, () => stringifyObjectLines(value, ctx, depth));
    return [renderPrimitiveValue(value)];
  }
);

function renderPrimitiveValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (P.isBoolean(value)) return value ? "true" : "false";
  if (P.isNumber(value)) return renderNumber(value);
  if (P.isBigInt(value)) return value.toString();
  return renderDoubleQuoted(String(value));
}

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
  const foldsOnlyInBlockContextWithPositiveWidth = allowFold && ctx.lineWidth > 0;
  const folded = foldsOnlyInBlockContextWithPositiveWidth
    ? foldRenderedScalar(rendered, indentStr, ctx.lineWidth)
    : rendered;
  return Str.split("\n")(folded);
}

function withAncestor(value: object, ctx: StringifyContext, render: () => string[]): string[] {
  detectCircular(value, ctx.seen);
  ctx.seen.push(value);
  try {
    return render();
  } finally {
    ctx.seen.pop();
  }
}

const continuationLinesAlreadyIndented = (first: string, value: unknown): boolean =>
  Str.startsWith("|")(first) || Str.startsWith(">")(first) || P.isString(value);

const stringifyArrayLines: {
  (arr: unknown[], ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (arr: unknown[]) => string[];
} = dual(3, (arr: unknown[], ctx: StringifyContext, depth: number): string[] => {
  if (arr.length === 0) {
    return ["[]"];
  }

  if (ctx.defaultCollectionStyle === "flow") {
    const flowCtx: StringifyContext = { ...ctx, inFlow: true };
    const items = A.map(arr, (item) => A.join(stringifyUnindentedLines(item, flowCtx, depth + 1, false), " "));
    return [`[${A.join(items, ", ")}]`];
  }

  const pad = Str.repeat(ctx.indent)(" ");
  const lines: string[] = [];
  for (const item of arr) {
    pushBlockSeqItem(lines, item, stringifyUnindentedLines(item, ctx, depth + 1), pad);
  }
  return lines;
});

function pushBlockSeqItem(lines: string[], item: unknown, itemLines: ReadonlyArray<string>, pad: string): void {
  const first = A.getUnsafe(itemLines, 0);
  lines.push(`- ${first}`);
  const asIs = continuationLinesAlreadyIndented(first, item);
  for (let i = 1; i < itemLines.length; i++) {
    const line = A.getUnsafe(itemLines, i);
    lines.push(asIs ? line : `${pad}${line}`);
  }
}

function mustStartBelowKeyColon(value: unknown): boolean {
  if (A.isArray(value) && value.length > 0) return true;
  if (P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value) && R.keys(value).length > 0) return true;
  return false;
}

const stringifyObjectLines: {
  (obj: Record<string, unknown>, ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (obj: Record<string, unknown>) => string[];
} = dual(3, (obj: Record<string, unknown>, ctx: StringifyContext, depth: number): string[] => {
  const keys = ctx.sortKeys ? A.sort(R.keys(obj), Order.String) : R.keys(obj);
  if (keys.length === 0) {
    return ["{}"];
  }
  if (ctx.defaultCollectionStyle === "flow") return [renderFlowObject(obj, keys, ctx, depth)];
  const pad = Str.repeat(ctx.indent)(" ");
  const lines: string[] = [];
  for (const k of keys) {
    pushBlockObjectEntry(lines, k, obj[k], ctx, depth, pad);
  }
  return lines;
});

// decision: quote-fallback-defaults
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
    const valStr = A.join(stringifyUnindentedLines(obj[k], flowCtx, depth + 1, false), " ");
    return `${keyStr}: ${valStr}`;
  });
  // biome-ignore lint/plugin/no-hand-rolled-canonical-json: census E11, renderer: YAML flow mapping, not JSON
  return `{${A.join(pairs, ", ")}}`;
}

const renderSingleLineBlockKey = (k: string, ctx: StringifyContext): string =>
  Str.includes("\n")(k) ? renderDoubleQuoted(k, ctx.forceDefaultStyles) : renderPlainKey(k, ctx, false);

function pushBlockObjectEntry(
  lines: string[],
  k: string,
  val: unknown,
  ctx: StringifyContext,
  depth: number,
  pad: string
): void {
  const keyStr = renderSingleLineBlockKey(k, ctx);
  const valLines = stringifyUnindentedLines(val, ctx, depth + 1);
  if (keyStr.length > IMPLICIT_KEY_MAX_LENGTH) {
    pushExplicitObjectEntry(lines, keyStr, val, valLines);
  } else if (valLines.length === 1 && !mustStartBelowKeyColon(val)) {
    lines.push(`${keyStr}: ${valLines[0]}`);
  } else {
    pushBlockObjectValue(lines, keyStr, val, valLines, ctx, pad);
  }
}

function pushExplicitObjectEntry(lines: string[], keyStr: string, val: unknown, valLines: ReadonlyArray<string>): void {
  lines.push(`? ${keyStr}`);
  const first = A.getUnsafe(valLines, 0);
  lines.push(`: ${first}`);
  const asIs = continuationLinesAlreadyIndented(first, val);
  for (let i = 1; i < valLines.length; i++) {
    const line = A.getUnsafe(valLines, i);
    lines.push(asIs || line === "" ? line : `${EXPLICIT_COMPACT_PAD}${line}`);
  }
}

function pushBlockObjectValue(
  lines: string[],
  keyStr: string,
  val: unknown,
  valLines: ReadonlyArray<string>,
  ctx: StringifyContext,
  pad: string
): void {
  const first = A.getUnsafe(valLines, 0);
  if (continuationLinesAlreadyIndented(first, val)) {
    lines.push(`${keyStr}: ${first}`);
    pushAll(lines, valLines.slice(1));
    return;
  }
  lines.push(`${keyStr}:`);
  const nonEmptySeqIsCompactUnlessIndentSequences = A.isArray(val) && val.length > 0;
  for (const vl of valLines) {
    const blankBodyLineStaysUnpaddedSoNoTrailingWhitespace = vl === "";
    lines.push(
      !nonEmptySeqIsCompactUnlessIndentSequences ||
        (ctx.indentSequences && !blankBodyLineStaysUnpaddedSoNoTrailingWhitespace)
        ? `${pad}${vl}`
        : vl
    );
  }
}

const YAML_TAG_PREFIX = "tag:yaml.org,2002:";

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

const canonicalTagUri = (uri: string): string =>
  Str.startsWith(YAML_TAG_PREFIX)(uri) ? `!!${Str.slice(YAML_TAG_PREFIX.length)(uri)}` : `!<${uri}>`;

const normalizeTag: {
  (tag: string, tagMap: MutableHashMap.MutableHashMap<string, string>): string;
  (tagMap: MutableHashMap.MutableHashMap<string, string>): (tag: string) => string;
} = dual(2, (tag: string, tagMap: MutableHashMap.MutableHashMap<string, string>): string => {
  if (Str.startsWith("!<")(tag) && Str.endsWith(">")(tag)) return normalizeVerbatimTag(tag);
  if (Str.startsWith("!!")(tag)) return normalizeSecondaryTag(tag, tagMap);
  return O.getOrElse(resolveHandleTag(tag, tagMap), () => tag);
});

function normalizeVerbatimTag(tag: string): string {
  const uri = Str.slice(2, -1)(tag);
  if (Str.startsWith(YAML_TAG_PREFIX)(uri)) return `!!${Str.slice(YAML_TAG_PREFIX.length)(uri)}`;
  return Str.startsWith("!")(uri) ? uri : tag;
}

const normalizeSecondaryTag = (tag: string, tagMap: MutableHashMap.MutableHashMap<string, string>): string =>
  O.match(
    O.filter(tagPrefixFor(tagMap, "!!"), (prefix) => prefix !== YAML_TAG_PREFIX),
    {
      onNone: () => tag,
      onSome: (customPrefix) => `!<${customPrefix}${Str.slice(2)(tag)}>`,
    }
  );

function resolveHandleTag(tag: string, tagMap: MutableHashMap.MutableHashMap<string, string>): O.Option<string> {
  const named = O.flatMap(splitNamedHandle(tag), ([handle, suffix]) =>
    O.map(tagPrefixFor(tagMap, handle), (prefix) => canonicalTagUri(prefix + suffix))
  );
  if (O.isSome(named) || !isPrimaryHandleTag(tag)) return named;
  return O.map(tagPrefixFor(tagMap, "!"), (prefix) => canonicalTagUri(prefix + Str.slice(1)(tag)));
}

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

const uncommentedFields = (node: YamlScalar | YamlMap | YamlSeq) => ({
  ...O.getSomesStruct({
    tag: O.fromUndefinedOr(node.tag),
    anchor: O.fromUndefinedOr(node.anchor),
    sourceMultiline: O.fromUndefinedOr(node.sourceMultiline),
  }),
  offset: node.offset,
  length: node.length,
});

const scalarFormFields = (node: YamlScalar) =>
  O.getSomesStruct({
    chomp: O.fromUndefinedOr(node.chomp),
    blockIndent: O.fromUndefinedOr(node.blockIndent),
    raw: O.fromUndefinedOr(node.raw),
  });

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

const stringifyNodeLines: {
  (node: YamlNode, ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (node: YamlNode) => string[];
} = dual(3, (node: YamlNode, ctx: StringifyContext, depth: number): string[] => {
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

const stringifyScalarNodeLines: {
  (node: YamlScalar, ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (node: YamlScalar) => string[];
} = dual(3, (node: YamlScalar, ctx: StringifyContext, depth: number): string[] => {
  const isEmpty = isEmptySourceScalar(node);
  if (isEmpty && rendersAsMetadataOnly(node)) {
    return [scalarMetadataOnly(node)];
  }
  const lines = renderScalarNodeValueLines(node, ctx, depth, isEmpty);
  lines[0] = prefixAnchorBeforeTag(A.getUnsafe(lines, 0), node);
  return lines;
});

const isNonEmptyText = (text: string | undefined): text is string => text !== undefined && text !== "";

const isEmptySourceScalar = (node: YamlScalar): boolean =>
  node.length === 0 && (node.value === null || node.value === undefined || node.value === "");

const rendersAsMetadataOnly = (node: YamlScalar): boolean => {
  const tagFixesTheEmptyNodesValue = isNonEmptyText(node.tag);
  const anchorAloneReadsNullSoAnchoredEmptyStringKeepsItsQuotes =
    isNonEmptyText(node.anchor) && P.isNullish(node.value);
  return tagFixesTheEmptyNodesValue || anchorAloneReadsNullSoAnchoredEmptyStringKeepsItsQuotes;
};

function scalarMetadataOnly(node: YamlScalar): string {
  const parts: string[] = [];
  if (isNonEmptyText(node.tag)) parts.push(node.tag);
  if (isNonEmptyText(node.anchor)) parts.push(`&${node.anchor}`);
  return A.join(parts, " ");
}

function prefixAnchorBeforeTag(first: string, node: YamlScalar): string {
  const tagged = isNonEmptyText(node.tag) ? `${node.tag} ${first}` : first;
  return isNonEmptyText(node.anchor) ? `&${node.anchor} ${tagged}` : tagged;
}

// decision: canonical-mode-libyaml-scalars
function renderScalarNodeValueLines(
  node: YamlScalar,
  ctx: StringifyContext,
  depth: number,
  isEmpty: boolean
): string[] {
  const val = node.value;
  if (!P.isString(val)) return [renderNonStringScalarKeepingSourceNumeral(node, isEmpty)];
  const tagMakesTypeConflictQuotingUnnecessary = isNonEmptyText(node.tag);
  return Str.split("\n")(
    renderString(
      val,
      node.style,
      Str.repeat(ctx.indent)(" "),
      tagMakesTypeConflictQuotingUnnecessary,
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

function renderNonStringScalarKeepingSourceNumeral(node: YamlScalar, isEmpty: boolean): string {
  const val = node.value;
  if (val === null || val === undefined) return isEmpty ? "" : "null";
  if ((P.isNumber(val) || P.isBigInt(val)) && node.raw !== undefined) return node.raw;
  return renderPrimitiveValue(val);
}

const MERGE_KEY = "<<";

// decision: plain-merge-key-stays-plain
function isPlainMergeKey(node: YamlNode | null | undefined): boolean {
  return (
    isYamlScalar(node) &&
    node.value === MERGE_KEY &&
    (node.style ?? "plain") === "plain" &&
    node.tag === undefined &&
    node.anchor === undefined
  );
}

const stringifyMappingKeyLines: {
  (node: YamlNode, ctx: StringifyContext, depth: number): string[];
  (ctx: StringifyContext, depth: number): (node: YamlNode) => string[];
} = dual(3, (node: YamlNode, ctx: StringifyContext, depth: number): string[] => {
  if (isPlainMergeKey(node)) return [MERGE_KEY];
  return stringifyNodeLines(node, ctx, depth);
});

// decision: comments-on-nodes
function unescapeCommentLine(line: string): string {
  return /^ +$/.test(line) ? Str.slice(0, -1)(line) : line;
}

function commentBlockLines(comment: string): string[] {
  return A.map(Str.split("\n")(comment), (l) => (l === "" ? "" : `#${unescapeCommentLine(l)}`));
}

const withHeaderComment: {
  (rendered: string, comment: string): string;
  (comment: string): (rendered: string) => string;
} = dual(2, (rendered: string, comment: string): string => {
  const nl = O.getOrElse(constant(-1))(Str.indexOf("\n")(rendered));
  return nl === -1
    ? `${rendered}${renderTrailingComment(comment)}`
    : `${Str.slice(0, nl)(rendered)}${renderTrailingComment(comment)}${Str.slice(nl)(rendered)}`;
});

function pairLeading(pair: YamlPair): string | undefined {
  return pair.key.commentBefore;
}

function pairTrailing(pair: YamlPair): string | undefined {
  return (pair.value ?? pair.key).comment;
}

function pairSpaceBefore(pair: YamlPair): boolean | undefined {
  return pair.key.spaceBefore;
}

const entryTrailing: {
  (pair: YamlPair, ctx: StringifyContext): string | undefined;
  (ctx: StringifyContext): (pair: YamlPair) => string | undefined;
} = dual(2, (pair: YamlPair, ctx: StringifyContext): string | undefined => {
  if (pair.key.comment !== undefined) return pair.key.comment;
  const owner = pair.value ?? pair.key;
  if (rendersAcrossLines(owner, ctx)) return undefined;
  return owner.comment;
});

const rendersAcrossLines: {
  (node: YamlNode, ctx: StringifyContext): boolean;
  (ctx: StringifyContext): (node: YamlNode) => boolean;
} = dual(2, (node: YamlNode, ctx: StringifyContext): boolean => {
  if (!(isYamlMap(node) || isYamlSeq(node))) return false;
  if (node.items.length === 0) return false;
  const style = ctx.forceDefaultStyles ? ctx.defaultCollectionStyle : node.style;
  if (style === "block" || node.sourceMultiline === true) return true;
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

function renderTrailingComment(comment: string): string {
  const flat = pipe(Str.split("\n")(comment), A.map(unescapeCommentLine), A.join(" "));
  return ` #${flat}`;
}

// decision: explicit-key-spill
const pushExplicitKeyValueLines: {
  (lines: string[], valNode: YamlNode | null, ctx: StringifyContext, depth: number, pad: string): number;
  (valNode: YamlNode | null, ctx: StringifyContext, depth: number, pad: string): (lines: string[]) => number;
} = dual(5, (lines: string[], valNode: YamlNode | null, ctx: StringifyContext, depth: number, pad: string): number => {
  if (valNode === null) {
    lines.push(":");
    return lines.length - 1;
  }
  const valLines = stringifyNodeLines(valNode, ctx, depth + 1);
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

const collectionStyleOf = (node: YamlMap | YamlSeq, ctx: StringifyContext): CollectionStyle =>
  ctx.forceDefaultStyles ? ctx.defaultCollectionStyle : node.style;

const isBlockCollectionNode = (node: YamlMap | YamlSeq, ctx: StringifyContext): boolean =>
  node.items.length > 0 && collectionStyleOf(node, ctx) === "block";

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

const pushPadded = (target: Array<string>, source: ReadonlyArray<string>, pad: string): void => {
  for (const line of source) target.push(line === "" ? "" : `${pad}${line}`);
};

const pushLeadingCommentsPaddingEveryLine = (
  target: Array<string>,
  ...[leading, pad]: [leading: string | undefined, pad: string]
): void => {
  if (leading === undefined) return;
  for (const cl of commentBlockLines(leading)) target.push(`${pad}${cl}`);
};

const pairKeySeparator = (key: YamlNode): " :" | ":" => {
  const keyIsAnchoredOrTaggedEmpty =
    isYamlScalar(key) &&
    key.length === 0 &&
    (key.value === null || key.value === undefined || key.value === "") &&
    (key.anchor !== undefined || key.tag !== undefined);
  const aliasNameWouldAbsorbColon = isYamlAlias(key);
  return aliasNameWouldAbsorbColon || keyIsAnchoredOrTaggedEmpty ? " :" : ":";
};

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

const pushAll = (target: Array<string>, source: ReadonlyArray<string>): void => {
  for (const line of source) target.push(line);
};

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

const withMetadataPrefix = (rendered: string, node: YamlMap | YamlSeq): string => {
  const prefix = buildMetadataPrefix(node.tag, node.anchor);
  return prefix !== undefined && prefix !== "" ? `${prefix} ${rendered}` : rendered;
};

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

type FlowEntry = {
  readonly lines: ReadonlyArray<string>;
  readonly leading: string | undefined;
  readonly trailing: string | undefined;
  readonly spaceBefore: boolean;
  readonly sourceCommentedUngated: boolean;
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
    sourceCommentedUngated:
      pairLeading(pair) !== undefined || pairTrailing(pair) !== undefined || pairSpaceBefore(pair) === true,
  };
}

const seqFlowEntry = (item: YamlNode, lines: ReadonlyArray<string>, emitComments: boolean): FlowEntry => ({
  lines,
  leading: emitComments ? item.commentBefore : undefined,
  trailing: emitComments ? item.comment : undefined,
  spaceBefore: emitComments && item.spaceBefore === true,
  sourceCommentedUngated: item.commentBefore !== undefined || item.comment !== undefined || item.spaceBefore === true,
});

// decision: comments-on-nodes
function renderFlowCollectionLines(
  node: YamlMap | YamlSeq,
  entries: ReadonlyArray<FlowEntry>,
  ctx: StringifyContext,
  open: string,
  close: string
): string[] {
  const oneEntryPerLineSoHashCannotSwallowBracket =
    !ctx.forceDefaultStyles &&
    (A.some(entries, (entry) => entry.sourceCommentedUngated) ||
      (node.comment !== undefined && node.sourceMultiline === true));
  if (oneEntryPerLineSoHashCannotSwallowBracket || A.some(entries, (entry) => entry.lines.length > 1)) {
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
  if (keyStr.length > IMPLICIT_KEY_MAX_LENGTH) {
    pushSpilledKeyPair(lines, keyStr, pair, ctx, depth, pad);
    return;
  }
  const head = `${keyStr}${pairKeySeparator(pair.key)}`;
  if (pair.value === null) {
    pushNullValuePair(lines, head, pair, node, ctx);
    return;
  }
  pushBlockMapValue(lines, head, pair, pair.value, ctx, depth, pad);
}

function isComplexKey(key: YamlNode): boolean {
  if (isYamlMap(key) || isYamlSeq(key)) return key.items.length > 0;
  return isYamlScalar(key) && ((P.isString(key.value) && Str.includes("\n")(key.value)) || isBlockStyle(key.style));
}

function pushComplexKeyPair(lines: string[], pair: YamlPair, ctx: StringifyContext, depth: number, pad: string): void {
  const keyLines = stringifyNodeLines(pair.key, ctx, depth + 1);
  const first = A.getUnsafe(keyLines, 0);
  lines.push(`? ${first}`);
  const explicitKeyLineIdx = lines.length - 1;
  const contPad = explicitKeyContinuationPad(first, pair.key);
  for (let k = 1; k < keyLines.length; k++) {
    lines.push(`${contPad}${keyLines[k]}`);
  }
  const inlineIdx = pushExplicitKeyValueLines(lines, pair.value, ctx, depth, pad);
  const keyIdx = keyLines.length === 1 ? explicitKeyLineIdx : -1;
  appendTrailingComment(lines, ctx, inlineIdx >= 0 ? inlineIdx : keyIdx, entryTrailing(pair, ctx));
}

function explicitKeyContinuationPad(first: string, key: YamlNode): string {
  const firstTokens = A.filter(Str.split(/\s+/)(Str.trim(first)), Boolean);
  const firstIsMetaOnly =
    firstTokens.length > 0 && A.every(firstTokens, (t) => Str.startsWith("&")(t) || Str.startsWith("!")(t));
  const keyIsBlockScalar = isYamlScalar(key) && isBlockStyle(key.style);
  return firstIsMetaOnly || keyIsBlockScalar ? "" : EXPLICIT_COMPACT_PAD;
}

// decision: canonical-mode-libyaml-scalars
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

function pushNullValuePair(lines: string[], head: string, pair: YamlPair, node: YamlMap, ctx: StringifyContext): void {
  lines.push(needsExplicitNull(pair.key, node, ctx) ? `${head} null` : head);
  appendTrailingComment(lines, ctx, lines.length - 1, entryTrailing(pair, ctx));
}

function needsExplicitNull(key: YamlNode, node: YamlMap, ctx: StringifyContext): boolean {
  const isRootFlowMap = ctx.parentPosition === undefined && node.style === "flow" && node.sourceMultiline === true;
  return ctx.forceDefaultStyles && isRootFlowMap && isYamlScalar(key) && key.style === "plain" && key.length > 0;
}

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

function pushCollectionValueHead(v: MapValueEmit, valNode: YamlMap | YamlSeq): number {
  const meta = buildMetadataPrefix(valNode.tag, valNode.anchor);
  const hasMeta = isNonEmptyText(meta);
  v.lines.push(hasMeta ? `${v.head} ${meta}` : v.head);
  appendTrailingComment(v.lines, v.ctx, v.lines.length - 1, entryTrailing(v.pair, v.ctx));
  const leadingValueLinesConsumedByMetadata = hasMeta ? 1 : 0;
  return leadingValueLinesConsumedByMetadata;
}

function pushBlockSeqMapValue(v: MapValueEmit, valNode: YamlSeq): void {
  const startIdx = pushCollectionValueHead(v, valNode);
  const compactUnlessIndentSequencesItemPad = v.ctx.indentSequences ? v.pad : "";
  if (v.valLeading !== undefined) {
    for (const cl of commentBlockLines(v.valLeading)) v.lines.push(`${compactUnlessIndentSequencesItemPad}${cl}`);
  }
  pushPadded(v.lines, v.valLines.slice(startIdx), compactUnlessIndentSequencesItemPad);
}

function pushNestedBlockMapValue(v: MapValueEmit, valNode: YamlMap): void {
  const startIdx = pushCollectionValueHead(v, valNode);
  pushLeadingCommentsPaddingEveryLine(v.lines, v.valLeading, v.pad);
  pushPadded(v.lines, v.valLines.slice(startIdx), v.pad);
}

// decision: comments-on-nodes
function pushSingleLineMapValue(v: MapValueEmit, only: string): void {
  const keyOwnComment = v.ctx.forceDefaultStyles ? undefined : v.pair.key.comment;
  if (v.valLeading === undefined && keyOwnComment === undefined) {
    v.lines.push(only === "" ? v.head : `${v.head} ${only}`);
    appendTrailingComment(v.lines, v.ctx, v.lines.length - 1, entryTrailing(v.pair, v.ctx));
    return;
  }
  v.lines.push(v.head);
  appendTrailingComment(v.lines, v.ctx, v.lines.length - 1, keyOwnComment);
  pushLeadingCommentsPaddingEveryLine(v.lines, v.valLeading, v.pad);
  v.lines.push(only === "" ? "" : `${v.pad}${only}`);
  appendTrailingComment(v.lines, v.ctx, v.lines.length - 1, v.valNode.comment);
}

function pushMultiLineMapValue(v: MapValueEmit): void {
  const first = A.getUnsafe(v.valLines, 0);
  const { isBlockScalarHeader, isInlineQuoted } = inlineScalarShape(first, v.valNode);
  if (isBlockScalarHeader || isInlineQuoted) {
    pushInlineScalarMapValue(v, first, isBlockScalarHeader);
    return;
  }
  v.lines.push(v.head);
  appendTrailingComment(v.lines, v.ctx, v.lines.length - 1, entryTrailing(v.pair, v.ctx));
  pushLeadingCommentsPaddingEveryLine(v.lines, v.valLeading, v.pad);
  pushPadded(v.lines, v.valLines, v.pad);
}

function pushInlineScalarMapValue(v: MapValueEmit, first: string, isBlockScalarHeader: boolean): void {
  if (v.valLeading !== undefined) {
    v.lines.push(v.head);
    pushPadded(v.lines, commentBlockLines(v.valLeading), v.pad);
    pushSpilledScalarValue(v, first, entryTrailing(v.pair, v.ctx));
    return;
  }
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
  appendTrailingComment(
    v.lines,
    v.ctx,
    isBlockScalarHeader ? headerIdx : v.lines.length - 1,
    entryTrailing(v.pair, v.ctx)
  );
}

function pushSpilledScalarValue(v: MapValueEmit, first: string, comment: string | undefined): void {
  const spilledIdx = v.lines.length;
  v.lines.push(`${v.pad}${first}`);
  pushAll(v.lines, v.valLines.slice(1));
  appendTrailingComment(v.lines, v.ctx, spilledIdx, comment);
}

const buildMetadataPrefix: {
  (tag: string | undefined, anchor: string | undefined): string | undefined;
  (anchor: string | undefined): (tag: string | undefined) => string | undefined;
} = dual(2, (tag: string | undefined, anchor: string | undefined): string | undefined => {
  if (!(tag !== undefined && tag !== "") && !(anchor !== undefined && anchor !== "")) return undefined;
  const anchorBeforeTagParts: string[] = [];
  if (anchor !== undefined && anchor !== "") anchorBeforeTagParts.push(`&${anchor}`);
  if (tag !== undefined && tag !== "") anchorBeforeTagParts.push(tag);
  return A.join(anchorBeforeTagParts, " ");
});

function stripScalarMetadataPrefix(line: string): string {
  let i = 0;
  for (let next = metadataTokenEnd(line, i); next > i; next = metadataTokenEnd(line, i)) {
    i = next;
  }
  return Str.slice(i)(line);
}

function metadataTokenEnd(line: string, i: number): number {
  if (i >= line.length) return i;
  const ch = line[i];
  if (ch !== "&" && ch !== "!") return i;
  const j = skipNonBlank(line, i + 1);
  const noCompleteTokenStartsHere = j >= line.length || j === i + 1;
  if (noCompleteTokenStartsHere) return i;
  return skipBlank(line, j);
}

function skipNonBlank(line: string, j: number): number {
  let k = j;
  while (k < line.length && line[k] !== " " && line[k] !== "\t") k++;
  return k;
}

function skipBlank(line: string, j: number): number {
  let k = j;
  while (k < line.length && (line[k] === " " || line[k] === "\t")) k++;
  return k;
}

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
  const pad = Str.repeat(ctx.indent)(" ");
  const lines: string[] = [];
  const itemCtx: StringifyContext = { ...ctx, parentPosition: "block-seq-item" };
  for (const item of items) {
    pushBlockSeqNodeItem(lines, item, itemCtx, depth, pad);
  }
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
  appendTrailingComment(lines, itemCtx, pushSeqItemLines(lines, item, itemLines, pad), item.comment);
}

const dashLine = (first: string): string => (first === "" ? "-" : `- ${first}`);

// decision: comments-on-nodes
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
  const result = A.join(stringifyUnindentedLines(value, ctx, 0), "\n");
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
  const docComment = ctx.forceDefaultStyles ? undefined : commentBlockText(doc.commentBefore);
  const contents =
    ctx.forceDefaultStyles && doc.contents !== null
      ? normalizeNodeTags(stripNodeComments(doc.contents), buildTagMap(doc.directives))
      : doc.contents;
  if (contents === null) return stringifyEmptyDocument(doc, ctx, docComment, finalNewline);
  return prependDocComment(docComment, stringifyDocumentBody(doc, contents, ctx, finalNewline));
}

const commentBlockText = (comment: string | undefined): string | undefined =>
  comment !== undefined ? A.join(commentBlockLines(comment), "\n") : undefined;

const prependDocComment = (docComment: string | undefined, text: string): string =>
  isNonEmptyText(docComment) ? `${docComment}\n${text}` : text;

const applyFinalNewline = (out: string, finalNewline: boolean): string =>
  finalNewline ? out : Str.replace(/\n$/, "")(out);

// decision: document-comment-scopes
function stringifyEmptyDocument(
  doc: RawYamlDocument,
  ctx: StringifyContext,
  docComment: string | undefined,
  finalNewline: boolean
): string {
  if (ctx.forceDefaultStyles) return canonicalEmptyDocument(doc, finalNewline);
  if (hasEmptyDocumentFraming(doc, docComment)) {
    return applyFinalNewline(framedEmptyDocument(doc, docComment), finalNewline);
  }
  return finalNewline ? "null\n" : "null";
}

// decision: canonical-mode-libyaml-scalars
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
  const bodyKeepsNewlineBeforeMarkerOrTrailer = finalNewline || docEndFull !== "";
  const body = bodyKeepsNewlineBeforeMarkerOrTrailer ? `${rendered}\n` : rendered;
  const docEnd = docEndFull === "" ? docEndFull : applyFinalNewline(docEndFull, finalNewline);
  // decision: document-comment-scopes
  const rootLeadingText = ctx.forceDefaultStyles ? undefined : commentBlockText(contents.commentBefore);
  const rootLeading = rootLeadingText === undefined ? "" : `${rootLeadingText}\n`;
  return doc.hasDocumentStart
    ? frameAfterDocumentStart(contents, body, docEnd, rootLeading)
    : `${rootLeading}${body}${docEnd}`;
}

// decision: document-comment-scopes
function withRootHeaderComment(result: string, contents: YamlNode, ctx: StringifyContext): string {
  if (ctx.forceDefaultStyles || !isYamlScalar(contents) || !isBlockStyle(contents.style)) return result;
  return contents.comment === undefined ? result : withHeaderComment(result, contents.comment);
}

function documentEndText(doc: RawYamlDocument, contents: YamlNode, ctx: StringifyContext, result: string): string {
  const docEndMarker = doc.hasDocumentEnd || needsCanonicalTerminator(doc, contents, ctx, result) ? "...\n" : "";
  const docCommentAfter = ctx.forceDefaultStyles ? undefined : commentBlockText(doc.comment);
  return docCommentAfter !== undefined ? `${docEndMarker}${docCommentAfter}\n` : docEndMarker;
}

// decision: canonical-mode-libyaml-scalars
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

function isTerminatedRootScalar(contents: YamlNode): boolean {
  if (!isYamlScalar(contents) || contents.style !== "plain") return false;
  const anchoredUntagged = contents.anchor !== undefined && !isNonEmptyText(contents.tag);
  const directiveLikeMultiline =
    contents.sourceMultiline === true && P.isString(contents.value) && / %[A-Z]/.test(contents.value);
  return anchoredUntagged || directiveLikeMultiline;
}

function frameAfterDocumentStart(contents: YamlNode, body: string, docEnd: string, rootLeading: string): string {
  const metaStr = rootMetadataPrefix(contents);
  if (metaStr !== undefined) {
    const sep = isYamlMap(contents) || isYamlSeq(contents) ? "\n" : " ";
    const bodyClean = stripRootMetadata(body, metaStr);
    return `--- ${metaStr}${rootLeading === "" ? sep : `\n${rootLeading}`}${bodyClean}${docEnd}`;
  }
  if (isYamlScalar(contents) && rootLeading === "") return `--- ${body}${docEnd}`;
  return `---\n${rootLeading}${body}${docEnd}`;
}

const rootMetadataPrefix = (contents: YamlNode): string | undefined =>
  buildMetadataPrefix("tag" in contents ? contents.tag : undefined, "anchor" in contents ? contents.anchor : undefined);

function stripRootMetadata(body: string, metaStr: string): string {
  const metaLinePrefix = `${metaStr}\n`;
  if (Str.startsWith(metaLinePrefix)(body)) return Str.slice(metaLinePrefix.length)(body);
  const metaInlinePrefix = `${metaStr} `;
  return Str.startsWith(metaInlinePrefix)(body) ? Str.slice(metaInlinePrefix.length)(body) : body;
}
