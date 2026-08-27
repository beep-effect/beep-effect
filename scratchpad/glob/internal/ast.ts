/**
 * Extglob AST compiler for nested `! ? + * @` operators.
 *
 * **Details**
 *
 * `#parseAST` has a structural depth backstop at `MAX_NESTING_DEPTH`
 * independent of `maxExtglobRecursion`. A long `@(@(@` chain that overflows
 * real minimatch 10.2.5 throws `NestingDepthExceeded`. Over-limit
 * `maxExtglobRecursion` still degrades to a literal instead of throwing.
 *
 * Ported from minimatch@10.2.5. Copyright Isaac Z. Schlueter and Contributors.
 * License: BlueOak-1.0.0.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
// Copyright: Isaac Z. Schlueter and Contributors
// License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
//
// Port notes, five changes from upstream:
// 1. #parseAST gains a STRUCTURAL depth backstop at MAX_NESTING_DEPTH,
//    independent of maxExtglobRecursion. Upstream increments its extDepth
//    counter only for non-coalescible nestings (depthAdd = 0 on adoption),
//    so a long @(@(@(... chain recurses unboundedly at DEFAULT options —
//    verified: real minimatch 10.2.5 dies with RangeError (stack overflow)
//    on "@(".repeat(20000) + "a" + ")".repeat(20000), which is under its own
//    64KB cap. The backstop throws GuardExceeded("NestingDepthExceeded").
//    The maxExtglobRecursion cap and its degrade-to-literal on-limit
//    behavior are otherwise kept exactly.
// 2. toRegExpSource / #partsToRegExp thread a depth counter through their
//    mutual recursion, guarded at MAX_NESTING_DEPTH (defensive: reachable
//    only if construction produced a deeper tree than the parse backstop
//    permits, i.e. programmer error, but the guard keeps it typed).
// 3. #flatten gains a tree-depth guard alongside the kept 10-pass width cap.
// 4. clone/copyIn thread a depth counter (they run during #fillNegs for `!`
//    extglobs), guarded at MAX_NESTING_DEPTH.
// 5. maxExtglobRecursion is validated by assertCap at fromGlob — a NaN or
//    non-integer cap is a schema-backed invariant defect.
// The shared option types come from the extracted types leaf (upstream let
// ast.ts and index.ts import each other circularly; noImportCycles forbids
// it here). The debug/inspect id plumbing is kept for diffability.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseClass } from "./braceExpressions.ts";
import {
	GlobInvariantError,
	GuardExceeded,
	MAX_EXTGLOB_RECURSION,
	MAX_NESTING_DEPTH,
	assertCap,
} from "./limits.ts";
import { MMRegExp } from "./types.ts";
import type { EngineOptions } from "./types.ts";
import { unescape as unescapePattern } from "./unescape.ts";

const $I = $ScratchpadId.create("glob/internal/ast");

const ExtglobTypeBase = LiteralKit(["!", "?", "+", "*", "@"]);

// classes [] are handled by the parseClass method
// for positive extglobs, we sub-parse the contents, and combine,
// with the appropriate regexp close.
// for negative extglobs, we sub-parse the contents, but then
// have to include the rest of the pattern, then the parent, etc.,
// as the thing that cannot be because RegExp negative lookaheads
// are different from globs.
//
// So for example:
// a@(i|w!(x|y)z|j)b => ^a(i|w((!?(x|y)zb).*)z|j)b$
//   1   2 3   4 5 6      1   2    3   46      5 6
//
// Assembling the extglob requires not just the negated patterns themselves,
// but also anything following the negative patterns up to the boundary
// of the current pattern, plus anything following in the parent pattern.
//
// So, first, we parse the string into an AST of extglobs, without turning
// anything into regexps yet.
//
// ['a', {@ [['i'], ['w', {!['x', 'y']}, 'z'], ['j']]}, 'b']
//
// Then, for all the negative extglobs, we append whatever comes after in
// each parent as their tail
//
// ['a', {@ [['i'], ['w', {!['x', 'y'], 'z', 'b'}, 'z'], ['j']]}, 'b']
//
// Lastly, we turn each of these pieces into a regexp, and join
//
//                                 v----- .* because there's more following,
//                                 v    v  otherwise, .+ because it must be
//                                 v    v  *something* there.
// ['^a', {@ ['i', 'w(?:(!?(?:x|y).*zb$).*)z', 'j' ]}, 'b$']
//   copy what follows into here--^^^^^
// ['^a', '(?:i|w(?:(?!(?:x|y).*zb$).*)z|j)', 'b$']
// ['^a(?:i|w(?:(?!(?:x|y).*zb$).*)z|j)b$']

/**
 * The five extglob operators: `!` none, `?` optional, `+` one-or-more,
 * `*` any, and `@` exactly one of the listed alternatives.
 *
 * **Example** (Recognize an extglob operator)
 *
 * ```ts
 * import { ExtglobType } from "../../glob/internal/ast.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ExtglobType)("+")) // true
 * console.log(S.is(ExtglobType)("{")) // false
 * ```
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const ExtglobType = ExtglobTypeBase.pipe(
	$I.annoteSchema("ExtglobType", {
		description: "Operator vocabulary supported by minimatch extglob expressions.",
	}),
	SchemaUtils.withLiteralKitStatics(ExtglobTypeBase),
);

/**
 * Decoded extglob operator produced by {@link ExtglobType}.
 *
 * **Example** (Declare an extglob operator)
 *
 * ```ts
 * import type { ExtglobType } from "../../glob/internal/ast.ts"
 *
 * const operator = "+" satisfies ExtglobType
 * console.log(operator) // "+"
 * ```
 *
 * @see {@link ExtglobType} for the runtime schema and guard helpers.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ExtglobType = typeof ExtglobType.Type;

const isExtglobType: (c: unknown) => c is ExtglobType = S.is(ExtglobType);
const isExtglobAST = (c: AST): c is AST & { type: ExtglobType } => isExtglobType(c.type);

// Map of which extglob types can adopt the children of a nested extglob
//
// anything but ! can adopt a matching type:
// +(a|+(b|c)|d) => +(a|b|c|d)
// *(a|*(b|c)|d) => *(a|b|c|d)
// @(a|@(b|c)|d) => @(a|b|c|d)
// ?(a|?(b|c)|d) => ?(a|b|c|d)
//
// * can adopt anything, because 0 or repetition is allowed
// + can adopt @, because 1 or repetition is allowed
// + and @ CANNOT adopt *, because 0 would be allowed
// + and @ CANNOT adopt ?, because 0 would be allowed
// ? can adopt @, because 0 or 1 is allowed
// ? and @ CANNOT adopt * or +, because >1 would be allowed
// ! CANNOT adopt ! (nothing else can either)
// ! can adopt @
// ! CANNOT adopt *, +, or ?
type AdoptionMap = Readonly<Record<ExtglobType, ReadonlyArray<ExtglobType>>>;

const adoptionMap: AdoptionMap = {
	"!": ["@"],
	"?": ["?", "@"],
	"@": ["@"],
	"*": ["*", "+", "?", "@"],
	"+": ["+", "@"],
};

// nested extglobs that can be adopted in, but with the addition of
// a blank '' element.
const adoptionWithSpaceMap: AdoptionMap = {
	"!": ["?"],
	"?": [],
	"@": ["?"],
	"*": [],
	"+": ["?", "*"],
};

// union of the previous two maps
const adoptionAnyMap: AdoptionMap = {
	"!": ["?", "@"],
	"?": ["?", "@"],
	"@": ["?", "@"],
	"*": ["*", "+", "?", "@"],
	"+": ["+", "@", "?", "*"],
};

// Extglobs that can take over their parent if they are the only child
// the key is parent, value maps child to resulting extglob parent type
// '@' is omitted because it's a special case. An `@` extglob with a single
// member can always be usurped by that subpattern.
type UsurpMap = Readonly<Partial<Record<ExtglobType, Readonly<Partial<Record<ExtglobType, ExtglobType>>>>>>;

const usurpMap: UsurpMap = {
	"!": { "!": "@" },
	"?": { "*": "*", "+": "*" },
	"@": { "!": "!", "?": "?", "@": "@", "*": "*", "+": "+" },
	"+": { "?": "*", "*": "*" },
};

// Patterns that get prepended to bind to the start of either the
// entire string, or just a single path portion, to prevent dots
// and/or traversal patterns, when needed.
// Exts don't need the ^ or / bit, because the root binds that already.
const startNoTraversal = "(?!(?:^|/)\\.\\.?(?:$|/))";
const startNoDot = "(?!\\.)";

// characters that indicate a start of pattern needs the "no dots" bit,
// because a dot *might* be matched. ( is not in the list, because in
// the case of a child extglob, it will handle the prevention itself.
const addPatternStart = LiteralKit(["[", "."]).annotate(
	$I.annote("PatternStartCharacter", {
		description: "Pattern-leading characters that can match a dot or traversal segment.",
	}),
);
// cases where traversal is A-OK, no dot prevention needed
const justDots = LiteralKit(["..", "."]).annotate(
	$I.annote("TraversalLiteral", {
		description: "Literal path portions allowed to represent dot traversal exactly.",
	}),
);
const isPatternStart = S.is(addPatternStart);
const isTraversalLiteral = S.is(justDots);
const reSpecials = "().*{}+?[]^$\\!";
const regExpEscape = (s: string): string => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

// any single thing other than /
const qmark = "[^/]";

// * => any number of characters
const star = `${qmark}*?`;
// use + when we need to ensure that *something* matches, because the * is
// the only thing in the path portion.
const starNoEmpty = `${qmark}+?`;

const guardDepth = (depth: number): void => {
	if (depth > MAX_NESTING_DEPTH) {
		throw GuardExceeded.make({ reason: "NestingDepthExceeded", limit: MAX_NESTING_DEPTH, actual: depth });
	}
};

let ID = 0;
/**
 * Extglob tree minimatch compiles into a regular expression source.
 *
 * **Gotchas**
 *
 * Over-limit `maxExtglobRecursion` degrades nested extglobs to literals — it
 * does not throw. `MAX_NESTING_DEPTH` is the structural throw
 * (`NestingDepthExceeded`) for hostile `@(@(@` chains. Globstar over-cap is
 * a silent false `false`; brace-budget over-cap throws
 * `ExpansionBudgetExceeded`.
 *
 * **Example** (Compile a shallow extglob)
 *
 * ```ts
 * import { AST } from "../../glob/internal/ast.ts"
 *
 * const ast = AST.fromGlob("+(js|ts)")
 * const pattern = ast.toMMPattern()
 * console.log(ast.toString()) // "+(js|ts)"
 * console.log(pattern instanceof RegExp && pattern.test("ts")) // true
 * console.log(pattern instanceof RegExp && pattern.test("tsx")) // false
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class AST {
	type: ExtglobType | null;
	readonly #root: AST;

	// #hasMagic and #toString are assigned undefined to reset them, so they are
	// declared `| undefined` rather than optional (exactOptionalPropertyTypes).
	#hasMagic: boolean | undefined;
	#uflag = false;
	#parts: Array<string | AST> = [];
	#parent: AST | undefined;
	readonly #parentIndex: number;
	#negs: Array<AST>;
	#filledNegs = false;
	#options: EngineOptions;
	#toString: string | undefined;
	// set to true if it's an extglob with no children
	// (which really means one child of '')
	#emptyExt = false;
	id = ++ID;

	get depth(): number {
		return (this.#parent?.depth ?? -1) + 1;
	}

	[Symbol.for("nodejs.util.inspect.custom")]() {
		return {
			"@@type": "AST",
			id: this.id,
			type: this.type,
			root: this.#root.id,
			parent: this.#parent?.id,
			depth: this.depth,
			partsLength: this.#parts.length,
			parts: this.#parts,
		};
	}

	constructor(type: ExtglobType | null, parent?: AST, options: EngineOptions = {}) {
		this.type = type;
		// extglobs are inherently magical
		if (type !== null) this.#hasMagic = true;
		this.#parent = parent;
		this.#root = this.#parent !== undefined ? this.#parent.#root : this;
		this.#options = this.#root === this ? options : this.#root.#options;
		this.#negs = this.#root === this ? [] : this.#root.#negs;
		if (type === "!" && !this.#root.#filledNegs) this.#negs.push(this);
		this.#parentIndex = this.#parent !== undefined ? this.#parent.#parts.length : 0;
	}

	get hasMagic(): boolean | undefined {
		if (this.#hasMagic !== undefined) return this.#hasMagic;
		for (const p of this.#parts) {
			if (P.isString(p)) continue;
			if (p.type !== null || p.hasMagic === true) {
				this.#hasMagic = true;
				return this.#hasMagic;
			}
		}
		// note: will be undefined until we generate the regexp src and find out
		return this.#hasMagic;
	}

	// reconstructs the pattern
	toString(): string {
		if (this.#toString !== undefined) return this.#toString;
		if (this.type === null) {
			this.#toString = this.#parts.map((p) => String(p)).join("");
		} else {
			this.#toString = `${this.type}(${this.#parts.map((p) => String(p)).join("|")})`;
		}
		return this.#toString;
	}

	#fillNegs() {
		if (this !== this.#root) {
			throw GlobInvariantError.make({ operation: "AST.fillNegs", detail: "fillNegs must be called on the root" });
		}
		if (this.#filledNegs) return this;

		// call toString() once to fill this out
		this.toString();
		this.#filledNegs = true;
		let n: AST | undefined = this.#negs.pop();
		while (n !== undefined) {
			if (n.type !== "!") {
				n = this.#negs.pop();
				continue;
			}
			// walk up the tree, appending everthing that comes AFTER parentIndex
			let p: AST | undefined = n;
			let pp = p.#parent;
			while (pp !== undefined) {
				for (let i = p.#parentIndex + 1; pp.type === null && i < pp.#parts.length; i++) {
					for (const part of n.#parts) {
						if (P.isString(part)) {
							throw GlobInvariantError.make({
								operation: "AST.fillNegs",
								detail: "negative extglob contained a string part",
							});
						}
						const source = pp.#parts[i];
						if (source !== undefined) part.copyIn(source);
					}
				}
				p = pp;
				pp = p.#parent;
			}
			n = this.#negs.pop();
		}
		return this;
	}

	push(...parts: Array<string | AST>) {
		for (const p of parts) {
			if (p === "") continue;
			if (!P.isString(p) && !(p instanceof AST && p.#parent === this)) {
				throw GlobInvariantError.make({ operation: "AST.push", detail: `invalid AST part: ${String(p)}` });
			}
			this.#parts.push(p);
		}
	}

	toJSON() {
		const ret: Array<unknown> =
			this.type === null
				? this.#parts.slice().map((p) => (P.isString(p) ? p : p.toJSON()))
				: [this.type, ...this.#parts.map((p) => (p as AST).toJSON())];
		if (this.isStart() && this.type === null) ret.unshift([]);
		if (this.isEnd() && (this === this.#root || (this.#root.#filledNegs && this.#parent?.type === "!"))) {
			ret.push({});
		}
		return ret;
	}

	isStart(): boolean {
		if (this.#root === this) return true;
		if (this.#parent?.isStart() !== true) return false;
		if (this.#parentIndex === 0) return true;
		// if everything AHEAD of this is a negation, then it's still the "start"
		const p = this.#parent;
		for (let i = 0; i < this.#parentIndex; i++) {
			const pp = p.#parts[i];
			if (!(pp instanceof AST && pp.type === "!")) {
				return false;
			}
		}
		return true;
	}

	isEnd(): boolean {
		if (this.#root === this) return true;
		if (this.#parent?.type === "!") return true;
		if (this.#parent?.isEnd() !== true) return false;
		if (this.type === null) return this.#parent?.isEnd() === true;
		// if not root, it'll always have a parent
		const pl = this.#parent !== undefined ? this.#parent.#parts.length : 0;
		return this.#parentIndex === pl - 1;
	}

	copyIn(part: AST | string, depth = 0) {
		guardDepth(depth);
		if (P.isString(part)) this.push(part);
		else this.push(part.clone(this, depth + 1));
	}

	clone(parent: AST, depth = 0): AST {
		guardDepth(depth);
		const c = new AST(this.type, parent);
		for (const p of this.#parts) {
			c.copyIn(p, depth + 1);
		}
		return c;
	}

	static #parseAST(
		str: string,
		ast: AST,
		pos: number,
		opt: EngineOptions,
		extDepth: number,
		structDepth: number,
	): number {
		// Structural backstop (port note 1): actual recursion depth, counted on
		// EVERY descent, unlike extDepth which adoption resets.
		guardDepth(structDepth);
		const maxDepth = opt.maxExtglobRecursion ?? MAX_EXTGLOB_RECURSION;
		let escaping = false;
		let inBrace = false;
		let braceStart = -1;
		let braceNeg = false;
		if (ast.type === null) {
			// outside of a extglob, append until we find a start
			let i = pos;
			let acc = "";
			while (i < str.length) {
				const c = str.charAt(i++);
				// still accumulate escapes at this point, but we do ignore
				// starts that are escaped
				if (escaping || c === "\\") {
					escaping = !escaping;
					acc += c;
					continue;
				}

				if (inBrace) {
					if (i === braceStart + 1) {
						if (c === "^" || c === "!") {
							braceNeg = true;
						}
					} else if (c === "]" && !(i === braceStart + 2 && braceNeg)) {
						inBrace = false;
					}
					acc += c;
					continue;
				}
				if (c === "[") {
					inBrace = true;
					braceStart = i;
					braceNeg = false;
					acc += c;
					continue;
				}

				// we don't have to check for adoption here, because that's
				// done at the other recursion point.
				const doRecurse = opt.noext !== true && isExtglobType(c) && str.charAt(i) === "(" && extDepth <= maxDepth;
				if (doRecurse) {
					ast.push(acc);
					acc = "";
					const ext = new AST(c, ast);
					i = AST.#parseAST(str, ext, i, opt, extDepth + 1, structDepth + 1);
					ast.push(ext);
					continue;
				}
				acc += c;
			}
			ast.push(acc);
			return i;
		}

		// some kind of extglob, pos is at the (
		// find the next | or )
		let i = pos + 1;
		let part = new AST(null, ast);
		const parts: Array<AST> = [];
		let acc = "";
		while (i < str.length) {
			const c = str.charAt(i++);
			// still accumulate escapes at this point, but we do ignore
			// starts that are escaped
			if (escaping || c === "\\") {
				escaping = !escaping;
				acc += c;
				continue;
			}

			if (inBrace) {
				if (i === braceStart + 1) {
					if (c === "^" || c === "!") {
						braceNeg = true;
					}
				} else if (c === "]" && !(i === braceStart + 2 && braceNeg)) {
					inBrace = false;
				}
				acc += c;
				continue;
			}
			if (c === "[") {
				inBrace = true;
				braceStart = i;
				braceNeg = false;
				acc += c;
				continue;
			}

			const doRecurse =
				opt.noext !== true &&
				isExtglobType(c) &&
				str.charAt(i) === "(" &&
				(extDepth <= maxDepth || ast.#canAdoptType(c));
			if (doRecurse) {
				const depthAdd = ast.#canAdoptType(c) ? 0 : 1;
				part.push(acc);
				acc = "";
				const ext = new AST(c, part);
				part.push(ext);
				i = AST.#parseAST(str, ext, i, opt, extDepth + depthAdd, structDepth + 1);
				continue;
			}
			if (c === "|") {
				part.push(acc);
				acc = "";
				parts.push(part);
				part = new AST(null, ast);
				continue;
			}
			if (c === ")") {
				if (acc === "" && ast.#parts.length === 0) {
					ast.#emptyExt = true;
				}
				part.push(acc);
				acc = "";
				ast.push(...parts, part);
				return i;
			}
			acc += c;
		}

		// unfinished extglob
		// if we got here, it was a malformed extglob! not an extglob, but
		// maybe something else in there.
		ast.type = null;
		ast.#hasMagic = undefined;
		ast.#parts = [str.substring(pos - 1)];
		return i;
	}

	#canAdoptWithSpace(child?: AST | string): child is AST & {
		type: null;
		parts: [AST & { type: ExtglobType }];
	} {
		return this.#canAdopt(child, adoptionWithSpaceMap);
	}

	#canAdopt(
		child?: AST | string,
		map: AdoptionMap = adoptionMap,
	): child is AST & {
		type: null;
		parts: [AST & { type: ExtglobType }];
	} {
		if (!(child instanceof AST) || child.type !== null || child.#parts.length !== 1 || this.type === null) {
			return false;
		}
		const gc = child.#parts[0];
		if (!(gc instanceof AST) || gc.type === null) {
			return false;
		}
		return (this as AST & { type: ExtglobType }).#canAdoptType(gc.type, map);
	}

	#canAdoptType(c: string, map: AdoptionMap = adoptionAnyMap): c is ExtglobType {
		return isExtglobType(c) && A.contains(map[this.type as ExtglobType], c);
	}

	#adoptWithSpace(
		this: AST & { type: ExtglobType },
		child: AST & {
			type: null;
		},
		index: number,
	) {
		const gc = child.#parts[0] as AST & { type: ExtglobType };
		const blank = new AST(null, gc, this.options);
		blank.#parts.push("");
		gc.push(blank);
		this.#adopt(child, index);
	}

	#adopt(
		child: AST & {
			type: null;
		},
		index: number,
	) {
		const gc = child.#parts[0] as AST & { type: ExtglobType };
		this.#parts.splice(index, 1, ...gc.#parts);
		for (const p of gc.#parts) {
			if (p instanceof AST) p.#parent = this;
		}
		this.#toString = undefined;
	}

	#canUsurpType(c: string): boolean {
		const m = usurpMap[this.type as ExtglobType];
		return isExtglobType(c) && m?.[c] !== undefined;
	}

	#canUsurp(child?: AST | string): child is AST & {
		type: null;
		parts: [AST & { type: ExtglobType }];
	} {
		if (
			!(child instanceof AST) ||
			child.type !== null ||
			child.#parts.length !== 1 ||
			this.type === null ||
			this.#parts.length !== 1
		) {
			return false;
		}
		const gc = child.#parts[0];
		if (!(gc instanceof AST) || gc.type === null) {
			return false;
		}
		return (this as AST & { type: ExtglobType }).#canUsurpType(gc.type);
	}

	#usurp(this: AST & { type: ExtglobType }, child: AST & { type: null }) {
		const m = usurpMap[this.type as ExtglobType];
		const gc = child.#parts[0] as AST & { type: ExtglobType };
		const nt = m?.[gc.type];
		if (nt === undefined || nt === null) return;
		this.#parts = gc.#parts;
		for (const p of this.#parts) {
			if (p instanceof AST) {
				p.#parent = this;
			}
		}
		(this as AST).type = nt;
		this.#toString = undefined;
		this.#emptyExt = false;
	}

	static fromGlob(pattern: string, options: EngineOptions = {}): AST {
		if (options.maxExtglobRecursion !== undefined) {
			assertCap(options.maxExtglobRecursion, "maxExtglobRecursion");
		}
		const ast = new AST(null, undefined, options);
		AST.#parseAST(pattern, ast, 0, options, 0, 0);
		return ast;
	}

	// returns the regular expression if there's magic, or the unescaped
	// string if not.
	toMMPattern(): MMRegExp | string {
		// should only be called on root
		if (this !== this.#root) return this.#root.toMMPattern();
		const glob = this.toString();
		const [re, body, hasMagic, uflag] = this.toRegExpSource();
		// if we're in nocase mode, and not nocaseMagicOnly, then we do
		// still need a regular expression if we have to case-insensitively
		// match capital/lowercase characters.
		const anyMagic =
				hasMagic ||
				this.#hasMagic === true ||
				(this.#options.nocase === true &&
					this.#options.nocaseMagicOnly !== true &&
					glob.toUpperCase() !== glob.toLowerCase());
		if (!anyMagic) {
			return body;
		}

		const flags = (this.#options.nocase === true ? "i" : "") + (uflag ? "u" : "");
		return new MMRegExp(re, flags, glob);
	}

	get options(): EngineOptions {
		return this.#options;
	}

	// returns the string match, the regexp source, whether there's magic
	// in the regexp (so a regular expression is required) and whether or
	// not the uflag is needed for the regular expression (for posix classes)
	toRegExpSource(allowDot?: boolean, depth = 0): [re: string, body: string, hasMagic: boolean, uflag: boolean] {
		// Port note 2: depth guard on the toRegExpSource <-> #partsToRegExp
		// mutual recursion.
		guardDepth(depth);
		const dot = allowDot ?? this.#options.dot === true;
		if (this.#root === this) {
			this.#flatten();
			this.#fillNegs();
		}
		if (!isExtglobAST(this)) {
			const noEmpty = this.isStart() && this.isEnd() && !this.#parts.some((s) => !P.isString(s));
			const src = this.#parts
				.map((p) => {
					const [re, _, hasMagic, uflag] =
						P.isString(p) ? AST.#parseGlob(p, this.#hasMagic, noEmpty) : p.toRegExpSource(allowDot, depth + 1);
					this.#hasMagic = this.#hasMagic || hasMagic;
					this.#uflag = this.#uflag || uflag;
					return re;
				})
				.join("");

			let start = "";
			if (this.isStart()) {
				if (P.isString(this.#parts[0])) {
					// this is the string that will match the start of the pattern,
					// so we need to protect against dots and such.

					// '.' and '..' cannot match unless the pattern is that exactly,
					// even if it starts with . or dot:true is set.
					const dotTravAllowed = this.#parts.length === 1 && isTraversalLiteral(this.#parts[0]);
					if (!dotTravAllowed) {
						// check if we have a possibility of matching . or ..,
						// and prevent that.
						const needNoTrav =
							// dots are allowed, and the pattern starts with [ or .
							(dot && isPatternStart(src.charAt(0))) ||
							// the pattern starts with \., and then [ or .
							(src.startsWith("\\.") && isPatternStart(src.charAt(2))) ||
							// the pattern starts with \.\., and then [ or .
							(src.startsWith("\\.\\.") && isPatternStart(src.charAt(4)));
						// no need to prevent dots if it can't match a dot, or if a
						// sub-pattern will be preventing it anyway.
						const needNoDot = !dot && allowDot !== true && isPatternStart(src.charAt(0));

						start = needNoTrav ? startNoTraversal : needNoDot ? startNoDot : "";
					}
				}
			}

			// append the "end of path portion" pattern to negation tails
			let end = "";
			if (this.isEnd() && this.#root.#filledNegs && this.#parent?.type === "!") {
				end = "(?:$|\\/)";
			}
			const final = start + src + end;
			this.#hasMagic = this.#hasMagic === true;
			return [final, unescapePattern(src), this.#hasMagic, this.#uflag];
		}

		// We need to calculate the body *twice* if it's a repeat pattern
		// at the start, once in nodot mode, then again in dot mode, so a
		// pattern like *(?) can match 'x.y'

		const repeated = this.type === "*" || this.type === "+";
		// some kind of extglob
		const start = this.type === "!" ? "(?:(?!(?:" : "(?:";
		let body = (this as AST & { type: ExtglobType }).#partsToRegExp(dot, depth);

		if (this.isStart() && this.isEnd() && body.length === 0 && this.type !== "!") {
			// invalid extglob, has to at least be *something* present, if it's
			// the entire path portion.
			const s = this.toString();
			const me = this as AST;
			me.#parts = [s];
			me.type = null;
			me.#hasMagic = undefined;
			return [s, unescapePattern(this.toString()), false, false];
		}

		let bodyDotAllowed =
			!repeated || allowDot === true || dot
				? ""
				: (this as AST & { type: ExtglobType }).#partsToRegExp(true, depth);
		if (bodyDotAllowed === body) {
			bodyDotAllowed = "";
		}
		if (bodyDotAllowed.length > 0) {
			body = `(?:${body})(?:${bodyDotAllowed})*?`;
		}

		// an empty !() is exactly equivalent to a starNoEmpty
		let final = "";
		if (this.type === "!" && this.#emptyExt) {
			final = (this.isStart() && !dot ? startNoDot : "") + starNoEmpty;
		} else {
			const close =
				this.type === "!"
					? // !() must match something,but !(x) can match ''
							`))${this.isStart() && !dot && allowDot !== true ? startNoDot : ""}${star})`
					: this.type === "@"
						? ")"
						: this.type === "?"
							? ")?"
							: this.type === "+" && bodyDotAllowed.length > 0
								? ")"
								: this.type === "*" && bodyDotAllowed.length > 0
									? ")?"
									: `)${this.type}`;
			final = start + body + close;
		}
		this.#hasMagic = this.#hasMagic === true;
		return [final, unescapePattern(body), this.#hasMagic, this.#uflag];
	}

	#flatten(depth = 0) {
		// Port note 3: tree-depth guard alongside the kept 10-pass width cap.
		guardDepth(depth);
		if (!isExtglobAST(this)) {
			for (const p of this.#parts) {
				if (p instanceof AST) {
					p.#flatten(depth + 1);
				}
			}
		} else {
			// do up to 10 passes to flatten as much as possible
			let iterations = 0;
			let done = false;
			do {
				done = true;
				for (let i = 0; i < this.#parts.length; i++) {
					const c = this.#parts[i];
					if (c instanceof AST) {
						c.#flatten(depth + 1);
						if (this.#canAdopt(c)) {
							done = false;
							this.#adopt(c, i);
						} else if (this.#canAdoptWithSpace(c)) {
							done = false;
							(this as AST & { type: ExtglobType }).#adoptWithSpace(c, i);
						} else if (this.#canUsurp(c)) {
							done = false;
							(this as AST & { type: ExtglobType }).#usurp(c);
						}
					}
				}
			} while (!done && ++iterations < 10);
		}
		this.#toString = undefined;
	}

	#partsToRegExp(this: AST & { type: ExtglobType }, dot: boolean, depth: number) {
		return this.#parts
			.map((p) => {
				// extglob ASTs should only contain parent ASTs
				if (P.isString(p)) {
					throw GlobInvariantError.make({
						operation: "AST.partsToRegExp",
						detail: "extglob AST contained a string part",
					});
				}
				// can ignore hasMagic, because extglobs are already always magic
				const [re, _, _hasMagic, uflag] = p.toRegExpSource(dot, depth + 1);
				this.#uflag = this.#uflag || uflag;
				return re;
			})
			.filter((p) => !(this.isStart() && this.isEnd()) || p.length > 0)
			.join("|");
	}

	static #parseGlob(
		glob: string,
		hasMagicInput: boolean | undefined,
		noEmpty = false,
	): [re: string, body: string, hasMagic: boolean, uflag: boolean] {
		let hasMagic = hasMagicInput;
		let escaping = false;
		let re = "";
		let uflag = false;
		// multiple stars that aren't globstars coalesce into one *
		let inStar = false;
		for (let i = 0; i < glob.length; i++) {
			const c = glob.charAt(i);
			if (escaping) {
				escaping = false;
				re += (Str.includes(c)(reSpecials) ? "\\" : "") + c;
				continue;
			}
			if (c === "*") {
				if (inStar) continue;
				inStar = true;
				re += noEmpty && /^[*]+$/.test(glob) ? starNoEmpty : star;
				hasMagic = true;
				continue;
			}
			inStar = false;
			if (c === "\\") {
				if (i === glob.length - 1) {
					re += "\\\\";
				} else {
					escaping = true;
				}
				continue;
			}
			if (c === "[") {
				const [src, needUflag, consumed, magic] = parseClass(glob, i);
				if (consumed !== 0) {
					re += src;
					uflag = uflag || needUflag;
					i += consumed - 1;
					hasMagic = hasMagic || magic;
					continue;
				}
			}
			if (c === "?") {
				re += qmark;
				hasMagic = true;
				continue;
			}
			re += regExpEscape(c);
		}
		return [re, unescapePattern(glob), hasMagic === true, uflag];
	}
}
