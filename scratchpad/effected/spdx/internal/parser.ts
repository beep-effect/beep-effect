import { License } from "../License.ts";
import { LicenseException } from "../LicenseException.ts";

/**
 * The maximum expression nesting depth the recursive-descent parser will
 * accept before it refuses the input.
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
 * @internal
 */
export const MAX_NESTING_DEPTH = 256;

/**
 * A raw, engine-level simple-expression leaf: a cataloged SPDX identifier with
 * the trailing `+` ("or later") marker, or a `LicenseRef`/`DocumentRef`
 * reference. This is the SPDX ABNF's `simple-expression`, and therefore the
 * shape a `WITH` clause may bind to. Emitted by the parser and materialized
 * into the public AST by the facade; carries no validation behavior of its own.
 *
 * @internal
 */
export type RawSimpleLicense =
	| { readonly kind: "license"; readonly id: string; readonly plus: boolean }
	| { readonly kind: "licenseRef"; readonly documentRef: string | undefined; readonly ref: string };

/**
 * The raw expression tree the parser emits. It is a plain-object mirror of the
 * public {@link SpdxExpression} AST, deliberately free of any Schema class so
 * the engine module carries no edge back to the facade (the cycle firewall):
 * the parser produces these records, the facade materializes the typed classes.
 *
 * @internal
 */
export type RawExpression =
	| RawSimpleLicense
	| { readonly kind: "with"; readonly license: RawSimpleLicense; readonly exception: string }
	| { readonly kind: "and"; readonly left: RawExpression; readonly right: RawExpression }
	| { readonly kind: "or"; readonly left: RawExpression; readonly right: RawExpression };

// ── Scanner ─────────────────────────────────────────────────────────────

// Token kinds as plain numeric constants — `const enum` is disallowed under
// `isolatedModules`, and a runtime `enum` would leak into the emit.
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

// idstring = 1*(ALPHA / DIGIT / "-" / "." ) — the SPDX Appendix IV character
// class. Checked by code point to avoid constructing a RegExp per character.
function isIdChar(code: number): boolean {
	return (
		(code >= 48 && code <= 57) || // 0-9
		(code >= 65 && code <= 90) || // A-Z
		(code >= 97 && code <= 122) || // a-z
		code === 46 || // .
		code === 45 // -
	);
}

/**
 * Scan an SPDX expression into a flat token stream. Iterative — no recursion,
 * so it cannot overflow the stack regardless of input length. Returns
 * `undefined` on the first unexpected character (or a `+` preceded by a space,
 * which SPDX forbids) rather than throwing, so malformed input flows through
 * the caller's typed error channel.
 */
function scan(source: string): ReadonlyArray<Token> | undefined {
	const tokens: Token[] = [];
	let i = 0;
	const n = source.length;
	while (i < n) {
		const code = source.charCodeAt(i);
		// Whitespace: SPDX permits only the ASCII space between tokens.
		if (code === 32) {
			i++;
			continue;
		}
		if (code === 40) {
			tokens.push({ type: TOKEN_OPEN_PAREN, value: "(" });
			i++;
			continue;
		}
		if (code === 41) {
			tokens.push({ type: TOKEN_CLOSE_PAREN, value: ")" });
			i++;
			continue;
		}
		if (code === 43) {
			// A `+` must abut its license id; a space before it is invalid.
			if (i > 0 && source.charCodeAt(i - 1) === 32) return undefined;
			tokens.push({ type: TOKEN_PLUS, value: "+" });
			i++;
			continue;
		}
		if (code === 58) {
			tokens.push({ type: TOKEN_COLON, value: ":" });
			i++;
			continue;
		}
		if (isIdChar(code)) {
			let j = i + 1;
			while (j < n && isIdChar(source.charCodeAt(j))) j++;
			const value = source.slice(i, j);
			i = j;
			// AND / OR / WITH are keywords only as whole tokens; a maximal
			// idstring run means an id merely containing them (e.g. the "or" in
			// `GPL-2.0-or-later`) is never mistaken for an operator.
			const upper = value.toUpperCase();
			if (upper === "AND") tokens.push({ type: TOKEN_AND, value });
			else if (upper === "OR") tokens.push({ type: TOKEN_OR, value });
			else if (upper === "WITH") tokens.push({ type: TOKEN_WITH, value });
			else tokens.push({ type: TOKEN_ID, value });
			continue;
		}
		// Unexpected character.
		return undefined;
	}
	return tokens;
}

// ── Parser ──────────────────────────────────────────────────────────────

/**
 * Parse an SPDX license expression into a {@link RawExpression} tree, or
 * `undefined` when the input is not a valid expression.
 *
 * A hardened, recursive-descent parser over the {@link scan} token stream,
 * following `spdx-expression-parse`'s operator precedence (`WITH` binds
 * tightest, then `AND`, then `OR`). It **never throws**: every malformation —
 * an unknown identifier, an unbalanced parenthesis, a dangling `AND`/`OR`, a
 * `WITH` without a known exception, or nesting past {@link MAX_NESTING_DEPTH} —
 * returns `undefined`, which the facade materializes into the package's typed
 * error. A single shared depth counter, incremented at each recursive entry and
 * released in `finally`, caps the recursion so hostile nesting is rejected
 * cleanly rather than overflowing the stack.
 *
 * @internal
 */
export function parse(input: string): RawExpression | undefined {
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
			pos++; // consume OR
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
			pos++; // consume AND
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
				pos++; // consume (
				const inner = parseOr();
				if (inner === undefined) return undefined;
				if (peek()?.type !== TOKEN_CLOSE_PAREN) return undefined;
				pos++; // consume )
				return inner;
			}
			return parseLicenseLike();
		} finally {
			depth--;
		}
	}

	// A simple expression (`LICENSE ["+"]` or a `LicenseRef`/`DocumentRef`
	// reference), optionally followed by `WITH <exception>` — the ABNF's
	// `simple-expression` and `with-expression`. Only a cataloged id may carry
	// the `+` marker; a `+` after a reference is left unconsumed and rejected by
	// the caller's trailing-token check, matching the oracle. Non-recursive, so
	// it needs no depth guard of its own.
	function parseLicenseLike(): RawExpression | undefined {
		const head = peek();
		if (head === undefined || head.type !== TOKEN_ID) return undefined;
		const value = head.value;
		let license: RawSimpleLicense;

		if (value.startsWith(DOCUMENT_REF_PREFIX)) {
			// DocumentRef-<idstring> ":" LicenseRef-<idstring>
			pos++; // consume DocumentRef- idstring
			if (peek()?.type !== TOKEN_COLON) return undefined;
			pos++; // consume :
			const refToken = peek();
			if (refToken === undefined || refToken.type !== TOKEN_ID || !refToken.value.startsWith(LICENSE_REF_PREFIX)) {
				return undefined;
			}
			const full = `${value}:${refToken.value}`;
			if (!License.isLicenseRef(full)) return undefined;
			pos++; // consume LicenseRef- idstring
			license = {
				kind: "licenseRef",
				documentRef: value.slice(DOCUMENT_REF_PREFIX.length),
				ref: refToken.value.slice(LICENSE_REF_PREFIX.length),
			};
		} else if (value.startsWith(LICENSE_REF_PREFIX)) {
			// Bare LicenseRef-<idstring>
			if (!License.isLicenseRef(value)) return undefined;
			pos++; // consume LicenseRef- idstring
			license = { kind: "licenseRef", documentRef: undefined, ref: value.slice(LICENSE_REF_PREFIX.length) };
		} else {
			// A cataloged SPDX license id, optionally `+`.
			if (!License.isKnownId(value)) return undefined;
			pos++; // consume license id
			let plus = false;
			if (peek()?.type === TOKEN_PLUS) {
				pos++; // consume +
				plus = true;
			}
			license = { kind: "license", id: value, plus };
		}

		if (peek()?.type === TOKEN_WITH) {
			pos++; // consume WITH
			const exceptionToken = peek();
			if (
				exceptionToken === undefined ||
				exceptionToken.type !== TOKEN_ID ||
				!LicenseException.isKnownId(exceptionToken.value)
			) {
				return undefined;
			}
			pos++; // consume exception id
			return { kind: "with", license, exception: exceptionToken.value };
		}
		return license;
	}

	const node = parseOr();
	// A valid parse consumes every token; leftover tokens mean trailing garbage.
	if (node === undefined || pos !== tokens.length) return undefined;
	return node;
}
