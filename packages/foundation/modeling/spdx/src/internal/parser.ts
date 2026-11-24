import { $SpdxId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { License } from "../License.ts";
import { LicenseException } from "../LicenseException.ts";

const $I = $SpdxId.create("internal/parser");

const RawLicense = S.Struct({
  kind: S.tag("license").pipe($I.annoteKey("RawLicense.kind", { description: "Cataloged license variant." })),
  id: S.String.pipe($I.annoteKey("RawLicense.id", { description: "The SPDX short identifier." })),
  plus: S.Boolean.pipe(
    $I.annoteKey("RawLicense.plus", { description: "Whether the trailing or-later marker is present." })
  ),
}).pipe($I.annoteSchema("RawLicense", { description: "A plain-object cataloged license leaf emitted by the parser." }));

const RawLicenseRef = S.Struct({
  kind: S.tag("licenseRef").pipe($I.annoteKey("RawLicenseRef.kind", { description: "License reference variant." })),
  documentRef: S.UndefinedOr(S.String).pipe(
    $I.annoteKey("RawLicenseRef.documentRef", {
      description: "The document idstring, or undefined for a local reference; the key is required.",
    })
  ),
  ref: S.String.pipe(
    $I.annoteKey("RawLicenseRef.ref", { description: "The license reference idstring without its prefix." })
  ),
}).pipe(
  $I.annoteSchema("RawLicenseRef", {
    description: "A plain-object local or document-scoped license reference emitted by the parser.",
  })
);

const RawSimpleLicense = S.Union([RawLicense, RawLicenseRef]).pipe(
  $I.annoteSchema("RawSimpleLicense", { description: "A simple SPDX expression to which a WITH clause may bind." })
);

const RawWith = S.Struct({
  kind: S.tag("with").pipe($I.annoteKey("RawWith.kind", { description: "License exception variant." })),
  license: RawSimpleLicense.pipe(
    $I.annoteKey("RawWith.license", { description: "The simple expression qualified by the exception." })
  ),
  exception: S.String.pipe($I.annoteKey("RawWith.exception", { description: "The SPDX exception identifier." })),
}).pipe(
  $I.annoteSchema("RawWith", { description: "A plain-object WITH clause restricted to a simple license operand." })
);

const RawAnd = S.Struct({
  kind: S.tag("and").pipe($I.annoteKey("RawAnd.kind", { description: "Conjunction variant." })),
  left: S.suspend((): S.Codec<RawExpression> => RawExpression).pipe(
    $I.annoteKey("RawAnd.left", { description: "The left expression operand." })
  ),
  right: S.suspend((): S.Codec<RawExpression> => RawExpression).pipe(
    $I.annoteKey("RawAnd.right", { description: "The right expression operand." })
  ),
}).pipe($I.annoteSchema("RawAnd", { description: "A plain-object conjunction of two raw expressions." }));

const RawOr = S.Struct({
  kind: S.tag("or").pipe($I.annoteKey("RawOr.kind", { description: "Disjunction variant." })),
  left: S.suspend((): S.Codec<RawExpression> => RawExpression).pipe(
    $I.annoteKey("RawOr.left", { description: "The left expression operand." })
  ),
  right: S.suspend((): S.Codec<RawExpression> => RawExpression).pipe(
    $I.annoteKey("RawOr.right", { description: "The right expression operand." })
  ),
}).pipe($I.annoteSchema("RawOr", { description: "A plain-object disjunction of two raw expressions." }));

/**
 * The schema for the parser's recursive plain-object expression tree.
 *
 * **Details**
 *
 * Describes the parser-to-facade contract without constructing public AST
 * classes. A WITH operand must be simple; reference leaves require the
 * documentRef key even when its value is undefined.
 *
 * **Example** (Validate a parsed raw tree)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { parse, RawExpression } from "@beep/spdx/internal/parser"
 *
 * console.log(S.is(RawExpression)(parse("MIT AND Apache-2.0"))) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const RawExpression: S.Codec<RawExpression> = S.Union([RawSimpleLicense, RawWith, RawAnd, RawOr]).pipe(
  $I.annoteSchema("RawExpression", { description: "The recursive plain-object expression tree emitted by the parser." })
);

/**
 * The maximum expression nesting depth the recursive-descent parser will
 * accept before it refuses the input.
 *
 * **Details**
 *
 * This is the input-hardening cap: without it, adversarial input such as
 * thousands of nested parentheses (`"(".repeat(5000) + …`) or a pathological
 * `AND`/`OR` chain would exhaust the JavaScript call stack and surface a
 * `RangeError` as an unhandled defect. The counter is incremented at every
 * recursive entry point and checked here, so it bounds both the parser's own
 * recursion and — because the emitted tree can be no deeper than the recursion
 * that built it — the depth of every subsequent walk of the AST
 * (materialization and `toString`). Set to the kit-wide `MAX_NESTING_DEPTH`.
 *
 * **Example** (Inspect the parser depth cap)
 *
 * ```ts
 * import { MAX_NESTING_DEPTH } from "@beep/spdx/internal/parser"
 *
 * console.log(MAX_NESTING_DEPTH) // 256
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const MAX_NESTING_DEPTH = 256;

/**
 * A raw, engine-level simple-expression leaf: a cataloged SPDX identifier with
 * the trailing `+` ("or later") marker, or a `LicenseRef`/`DocumentRef`
 * reference.
 *
 * **Details**
 *
 * This is the SPDX ABNF's `simple-expression`, and therefore the
 * shape a `WITH` clause may bind to. Emitted by the parser and materialized
 * into the public AST by the facade; carries no validation behavior of its own.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type RawSimpleLicense = typeof RawSimpleLicense.Type;

/**
 * The raw expression tree the parser emits.
 *
 * **Details**
 *
 * It is a plain-object mirror of the
 * public {@link SpdxExpression} AST, deliberately free of any Schema class so
 * the engine module carries no edge back to the facade (the cycle firewall):
 * the parser produces these records, the facade materializes the typed classes.
 * Only the recursive branches need an explicit type anchor; the leaf and WITH
 * shapes are derived from their schemas.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type RawExpression =
  | RawSimpleLicense
  | typeof RawWith.Type
  | { readonly kind: "and"; readonly left: RawExpression; readonly right: RawExpression }
  | { readonly kind: "or"; readonly left: RawExpression; readonly right: RawExpression };

// decision: parser-undefined-rejection-numeric-tokens
const TOKEN_OPEN_PAREN = 0;
const TOKEN_CLOSE_PAREN = 1;
const TOKEN_PLUS = 2;
const TOKEN_COLON = 3;
const TOKEN_AND = 4;
const TOKEN_OR = 5;
const TOKEN_WITH = 6;
const TOKEN_ID = 7;

type TokenType =
  | typeof TOKEN_OPEN_PAREN
  | typeof TOKEN_CLOSE_PAREN
  | typeof TOKEN_PLUS
  | typeof TOKEN_COLON
  | typeof TOKEN_AND
  | typeof TOKEN_OR
  | typeof TOKEN_WITH
  | typeof TOKEN_ID;

interface Token {
  readonly type: TokenType;
  readonly value: string;
}

const DOCUMENT_REF_PREFIX = "DocumentRef-";
const LICENSE_REF_PREFIX = "LicenseRef-";

const SPDX_IDSTRING_CHAR = /^[0-9A-Za-z.-]$/;
function isIdChar(char: string): boolean {
  return SPDX_IDSTRING_CHAR.test(char);
}

const ONLY_TOKEN_SEPARATOR_ASCII_SPACE = " ";
const REJECTED_INDEX = -1;

function scan(source: string): ReadonlyArray<Token> | undefined {
  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    if (source[i] === ONLY_TOKEN_SEPARATOR_ASCII_SPACE) {
      i++;
      continue;
    }
    const next = scanToken(source, i, tokens);
    if (next === REJECTED_INDEX) return undefined;
    i = next;
  }
  return tokens;
}

const OPEN_PAREN_TOKEN: Token = { type: TOKEN_OPEN_PAREN, value: "(" };
const CLOSE_PAREN_TOKEN: Token = { type: TOKEN_CLOSE_PAREN, value: ")" };
const PLUS_TOKEN: Token = { type: TOKEN_PLUS, value: "+" };
const COLON_TOKEN: Token = { type: TOKEN_COLON, value: ":" };

function punctuationToken(char: string): Token | undefined {
  if (char === "(") return OPEN_PAREN_TOKEN;
  if (char === ")") return CLOSE_PAREN_TOKEN;
  if (char === "+") return PLUS_TOKEN;
  if (char === ":") return COLON_TOKEN;
  return undefined;
}

function scanToken(source: string, i: number, tokens: Token[]): number {
  const char = Str.slice(i, i + 1)(source);
  const plusDetachedFromItsId = char === "+" && i > 0 && source[i - 1] === ONLY_TOKEN_SEPARATOR_ASCII_SPACE;
  if (plusDetachedFromItsId) return REJECTED_INDEX;
  const punctuation = punctuationToken(char);
  if (punctuation !== undefined) {
    tokens.push(punctuation);
    return i + 1;
  }
  if (!isIdChar(char)) return REJECTED_INDEX;
  return scanMaximalIdStringAfterIdChar(source, i, tokens);
}

function scanMaximalIdStringAfterIdChar(source: string, i: number, tokens: Token[]): number {
  const n = source.length;
  let j = i + 1;
  while (j < n && isIdChar(Str.slice(j, j + 1)(source))) j++;
  const wholeToken = Str.slice(i, j)(source);
  tokens.push({ type: keywordType(Str.toUpperCase(wholeToken)), value: wholeToken });
  return j;
}

function keywordType(upper: string): TokenType {
  if (upper === "AND") return TOKEN_AND;
  if (upper === "OR") return TOKEN_OR;
  if (upper === "WITH") return TOKEN_WITH;
  return TOKEN_ID;
}

function parseOrUndefined(input: string): RawExpression | undefined {
  const tokens = scan(input);
  if (tokens === undefined) return undefined;

  let pos = 0;
  let depth = 0;

  const peek = (): Token | undefined => (pos < tokens.length ? tokens[pos] : undefined);

  function parseOr(): RawExpression | undefined {
    if (depth >= MAX_NESTING_DEPTH) return undefined;
    depth++;
    try {
      const left = parseAnd();
      if (left === undefined) return undefined;
      if (peek()?.type !== TOKEN_OR) return left;
      pos++;
      const right = parseOr();
      if (right === undefined) return undefined;
      return { kind: "or", left, right };
    } finally {
      depth--;
    }
  }

  function parseAnd(): RawExpression | undefined {
    if (depth >= MAX_NESTING_DEPTH) return undefined;
    depth++;
    try {
      const left = parseAtom();
      if (left === undefined) return undefined;
      if (peek()?.type !== TOKEN_AND) return left;
      pos++;
      const right = parseAnd();
      if (right === undefined) return undefined;
      return { kind: "and", left, right };
    } finally {
      depth--;
    }
  }

  function parseAtom(): RawExpression | undefined {
    if (depth >= MAX_NESTING_DEPTH) return undefined;
    depth++;
    try {
      if (peek()?.type === TOKEN_OPEN_PAREN) {
        pos++;
        const inner = parseOr();
        if (inner === undefined) return undefined;
        if (peek()?.type !== TOKEN_CLOSE_PAREN) return undefined;
        pos++;
        return inner;
      }
      return parseNonRecursiveSimpleOrWithExpression();
    } finally {
      depth--;
    }
  }

  function parseNonRecursiveSimpleOrWithExpression(): RawExpression | undefined {
    const head = peek();
    if (head === undefined || head.type !== TOKEN_ID) return undefined;
    const license = parseSimpleLicense(head.value);
    if (license === undefined) return undefined;
    if (peek()?.type !== TOKEN_WITH) return license;
    return parseWithException(license);
  }

  function parseSimpleLicense(value: string): RawSimpleLicense | undefined {
    if (Str.startsWith(DOCUMENT_REF_PREFIX)(value)) return parseDocumentLicenseRef(value);
    if (Str.startsWith(LICENSE_REF_PREFIX)(value)) return parseBareLicenseRef(value);
    return parseCatalogedLicense(value);
  }

  function parseDocumentLicenseRef(value: string): RawSimpleLicense | undefined {
    pos++;
    if (peek()?.type !== TOKEN_COLON) return undefined;
    pos++;
    const refToken = peek();
    if (refToken === undefined || refToken.type !== TOKEN_ID || !Str.startsWith(LICENSE_REF_PREFIX)(refToken.value)) {
      return undefined;
    }
    const full = `${value}:${refToken.value}`;
    if (!License.isLicenseRef(full)) return undefined;
    pos++;
    return {
      kind: "licenseRef",
      documentRef: Str.slice(DOCUMENT_REF_PREFIX.length)(value),
      ref: Str.slice(LICENSE_REF_PREFIX.length)(refToken.value),
    };
  }

  function parseBareLicenseRef(value: string): RawSimpleLicense | undefined {
    if (!License.isLicenseRef(value)) return undefined;
    pos++;
    return { kind: "licenseRef", documentRef: undefined, ref: Str.slice(LICENSE_REF_PREFIX.length)(value) };
  }

  function parseCatalogedLicense(value: string): RawSimpleLicense | undefined {
    if (!License.isKnownId(value)) return undefined;
    pos++;
    const plus = peek()?.type === TOKEN_PLUS;
    if (plus) pos++;
    return { kind: "license", id: value, plus };
  }

  function parseWithException(license: RawSimpleLicense): RawExpression | undefined {
    pos++;
    const exceptionToken = peek();
    if (
      exceptionToken === undefined ||
      exceptionToken.type !== TOKEN_ID ||
      !LicenseException.isKnownId(exceptionToken.value)
    ) {
      return undefined;
    }
    pos++;
    return { kind: "with", license, exception: exceptionToken.value };
  }

  const node = parseOr();
  const trailingTokensLeft = pos !== tokens.length;
  if (node === undefined || trailingTokensLeft) return undefined;
  return node;
}

/**
 * Parse an SPDX license expression into a {@link RawExpression} tree, or
 * `Option.none()` when the input is not a valid expression.
 *
 * **Details**
 *
 * A hardened, recursive-descent parser over the {@link scan} token stream,
 * following `spdx-expression-parse`'s operator precedence (`WITH` binds
 * tightest, then `AND`, then `OR`). It **never throws**: every malformation —
 * an unknown identifier, an unbalanced parenthesis, a dangling `AND`/`OR`, a
 * `WITH` without a known exception, or nesting past {@link MAX_NESTING_DEPTH} —
 * yields `Option.none()`, which the facade materializes into the package's typed
 * error. A single shared depth counter, incremented at each recursive entry and
 * released in `finally`, caps the recursion so hostile nesting is rejected
 * cleanly rather than overflowing the stack.
 *
 * **Example** (Inspect operator precedence)
 *
 * ```ts
 * import { parse } from "@beep/spdx/internal/parser"
 * import * as O from "effect/Option"
 *
 * const expression = O.getOrThrow(parse("MIT OR Apache-2.0 AND BSD-3-Clause"))
 * console.log(expression.kind) // or
 * console.log(expression.kind === "or" && expression.right.kind) // and
 * ```
 *
 * **Example** (Reject malformed and deeply nested input)
 *
 * ```ts
 * import { MAX_NESTING_DEPTH, parse } from "@beep/spdx/internal/parser"
 * import * as O from "effect/Option"
 *
 * const nested = "(".repeat(MAX_NESTING_DEPTH) + "MIT" + ")".repeat(MAX_NESTING_DEPTH)
 * console.log(O.isNone(parse("MIT AND"))) // true
 * console.log(O.isNone(parse(nested))) // true
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export function parse(input: string): O.Option<RawExpression> {
  return O.fromUndefinedOr(parseOrUndefined(input));
}
