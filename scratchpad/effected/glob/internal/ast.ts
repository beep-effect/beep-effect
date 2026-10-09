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
//    non-integer cap is a wiring bug and dies as an InvalidCap defect.
// The shared option types come from the extracted types leaf (upstream let
// ast.ts and index.ts import each other circularly; noImportCycles forbids
// it here). The debug/inspect id plumbing is kept for diffability.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { parseClass } from "./braceExpressions.ts";
import { GuardExceeded, MAX_EXTGLOB_RECURSION, MAX_NESTING_DEPTH, assertCap } from "./limits.ts";
import type { EngineOptions, MMRegExp } from "./types.ts";
import { unescape as unescapePattern } from "./unescape.ts";

const $I = $ScratchpadId.create("effected/glob/internal/ast");

/**
 * An invariant violation in the internal extglob syntax tree.
 *
 * **Example** (Inspect an invariant violation)
 *
 * ```ts
 * import { ASTError } from "@beep/scratchpad/effected/glob/internal/ast"
 *
 * const error = ASTError.make({ message: "Invalid extglob child" })
 * console.log(error.message) // Invalid extglob child
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ASTError extends S.TaggedError<ASTError>($I`ASTError`)("ASTError", {
	message: S.String.annotateKey({ description: "The violated invariant in the extglob syntax tree." }),
}, $I.annote("ASTError", {
	title: "Extglob syntax tree invariant violation",
	description: "An internal syntax-tree operation encountered an invalid extglob structure.",
})) {}

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
 * The five operators that introduce an extended glob expression.
 *
 * **Details**
 *
 * The operators represent negation, optional matching, one-or-more repetitions,
 * zero-or-more repetitions, and exactly one alternative, respectively.
 *
 * **Example** (Recognize an extglob operator)
 *
 * ```ts
 * import { ExtglobType } from "@beep/scratchpad/effected/glob/internal/ast"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ExtglobType)("@")) // true
 * console.log(S.is(ExtglobType)("x")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtglobType = LiteralKit(["!", "?", "+", "*", "@"]).annotate($I.annote("ExtglobType", {
	title: "Extended glob operator",
	description: "The negation, optional, one-or-more, zero-or-more and exactly-one extglob operators.",
}));
/**
 * An operator accepted by the extended-glob syntax tree.
 *
 * @see {@link ExtglobType} for the runtime operator schema.
 * @category type-level
 * @since 0.0.0
 */
export type ExtglobType = typeof ExtglobType.Type;
const isExtglobType = S.is(ExtglobType);
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
const adoptionMap = HashMap.fromIterable<ExtglobType, Array<ExtglobType>>([
	["!", ["@"]],
	["?", ["?", "@"]],
	["@", ["@"]],
	["*", ["*", "+", "?", "@"]],
	["+", ["+", "@"]],
]);

// nested extglobs that can be adopted in, but with the addition of
// a blank '' element.
const adoptionWithSpaceMap = HashMap.fromIterable<ExtglobType, Array<ExtglobType>>([
	["!", ["?"]],
	["@", ["?"]],
	["+", ["?", "*"]],
]);

// union of the previous two maps
const adoptionAnyMap = HashMap.fromIterable<ExtglobType, Array<ExtglobType>>([
	["!", ["?", "@"]],
	["?", ["?", "@"]],
	["@", ["?", "@"]],
	["*", ["*", "+", "?", "@"]],
	["+", ["+", "@", "?", "*"]],
]);

// Extglobs that can take over their parent if they are the only child
// the key is parent, value maps child to resulting extglob parent type
// '@' is omitted because it's a special case. An `@` extglob with a single
// member can always be usurped by that subpattern.
const usurpMap = HashMap.fromIterable<ExtglobType, HashMap.HashMap<ExtglobType | null, ExtglobType | null>>([
	["!", HashMap.fromIterable<ExtglobType | null, ExtglobType | null>([["!", "@"]])],
	[
		"?",
		HashMap.fromIterable<ExtglobType | null, ExtglobType | null>([
			["*", "*"],
			["+", "*"],
		]),
	],
	[
		"@",
		HashMap.fromIterable<ExtglobType | null, ExtglobType | null>([
			["!", "!"],
			["?", "?"],
			["@", "@"],
			["*", "*"],
			["+", "+"],
		]),
	],
	[
		"+",
		HashMap.fromIterable<ExtglobType | null, ExtglobType | null>([
			["?", "*"],
			["*", "*"],
		]),
	],
]);

// Patterns that get prepended to bind to the start of either the
// entire string, or just a single path portion, to prevent dots
// and/or traversal patterns, when needed.
// Exts don't need the ^ or / bit, because the root binds that already.
const startNoTraversal = "(?!(?:^|/)\\.\\.?(?:$|/))";
const startNoDot = "(?!\\.)";

// characters that indicate a start of pattern needs the "no dots" bit,
// because a dot *might* be matched. ( is not in the list, because in
// the case of a child extglob, it will handle the prevention itself.
const addPatternStart = HashSet.make("[", ".");
// cases where traversal is A-OK, no dot prevention needed
const justDots = HashSet.make("..", ".");
const reSpecials = HashSet.fromIterable("().*{}+?[]^$\\!");
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
		throw GuardExceeded.fromReason("NestingDepthExceeded", MAX_NESTING_DEPTH, depth);
	}
};

let ID = 0;
/**
 * Represents a glob path portion as literal pieces and nested extended-glob alternatives.
 *
 * **Details**
 *
 * Parsing builds a syntax tree before regular-expression generation.
 * Negative extglobs incorporate the following pieces of their enclosing patterns
 * so that regular-expression lookaheads preserve glob negation semantics.
 *
 * **Example** (Compile an extended glob)
 *
 * ```ts
 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
 *
 * const tree = AST.fromGlob("@(cat|dog)")
 * const pattern = tree.toMMPattern()
 * console.log(pattern instanceof RegExp && pattern.test("cat")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AST {
	/**
	 * Identifies the extglob operator, with `null` for a sequence of pattern pieces.
	 *
	 * **Example** (Inspect a sequence node)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * console.log(AST.fromGlob("cat").type) // null
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	type: ExtglobType | null;
	/**
	 * References the root that owns shared options and negation bookkeeping.
	 *
	 * **Example** (Read options inherited from the root)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const root = new AST(null, undefined, { dot: true })
	 * const child = new AST("@", root)
	 * console.log(child.options === root.options) // true
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	readonly #root: AST;

	// #hasMagic and #toString are assigned undefined to reset them, so they are
	// declared `| undefined` rather than optional (exactOptionalPropertyTypes).
	/**
	 * Caches whether this node requires glob-aware regular-expression matching.
	 *
	 * **Example** (Resolve the cached magic state)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const tree = AST.fromGlob("*")
	 * tree.toRegExpSource()
	 * console.log(tree.hasMagic) // true
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	#hasMagic: boolean | undefined;
	/**
	 * Tracks whether generated character-class source requires the Unicode flag.
	 *
	 * **Example** (Inspect the Unicode requirement of a literal)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * console.log(AST.fromGlob("cat").toRegExpSource()[3]) // false
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	#uflag = false;
	/**
	 * Stores literal sequence pieces or the alternative nodes of an extglob.
	 *
	 * **Example** (Append a sequence piece)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const tree = new AST(null)
	 * tree.push("cat")
	 * console.log(tree.toString()) // cat
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	#parts: Array<string | AST> = [];
	/**
	 * References the enclosing node, or remains undefined for a root.
	 *
	 * **Example** (Measure distance to an enclosing root)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const root = new AST(null)
	 * console.log(new AST("@", root).depth) // 1
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	#parent: AST | undefined;
	/**
	 * Records the insertion position within the enclosing node for boundary and negation handling.
	 *
	 * **Example** (Inspect a leading child boundary)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const root = new AST(null)
	 * const child = new AST("@", root)
	 * root.push(child)
	 * console.log(child.isStart()) // true
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	#parentIndex: number;
	/**
	 * Shares the root registry of negative extglobs awaiting tail completion.
	 *
	 * **Example** (Compile a registered negative extglob)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const pattern = AST.fromGlob("!(cat)").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("dog")) // true
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	#negs: Array<AST>;
	/**
	 * Records whether the root has completed its negative-extglob tails.
	 *
	 * **Example** (Generate negation source twice)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const tree = AST.fromGlob("!(cat)")
	 * const first = tree.toRegExpSource()[0]
	 * console.log(tree.toRegExpSource()[0] === first) // true
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	#filledNegs = false;
	/**
	 * Stores the options object shared with the root and all sibling nodes.
	 *
	 * **Example** (Read root matching options)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * console.log(AST.fromGlob("*", { dot: true }).options.dot) // true
	 * ```
	 *
	 * @category configuration
	 * @since 0.0.0
	 */
	#options: EngineOptions;
	/**
	 * Caches the reconstructed pattern until a structural transformation clears it.
	 *
	 * **Example** (Read the reconstructed pattern twice)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const tree = AST.fromGlob("@(cat|dog)")
	 * console.log(tree.toString() === tree.toString()) // true
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	#toString: string | undefined;
	// set to true if it's an extglob with no children
	// (which really means one child of '')
	/**
	 * Marks an extglob with no children, representing one empty alternative.
	 *
	 * **Example** (Compile an empty negative extglob)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const pattern = AST.fromGlob("!()").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("x")) // true
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	#emptyExt = false;
	/**
	 * Identifies this node in the internal inspection output.
	 *
	 * **Details**
	 *
	 * Each constructed node receives the next identifier from the module counter.
	 *
	 * **Example** (Compare node identities)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const first = new AST(null)
	 * const second = new AST(null)
	 * console.log(second.id > first.id) // true
	 * ```
	 *
	 * @category identifiers
	 * @since 0.0.0
	 */
	id = ++ID;

	/**
	 * Reports how many parent edges separate this node from its root.
	 *
	 * **Details**
	 *
	 * A root node has depth zero.
	 *
	 * **Example** (Measure a child depth)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const root = new AST(null)
	 * const child = new AST("@", root)
	 * console.log(child.depth) // 1
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get depth(): number {
		return (this.#parent?.depth ?? -1) + 1;
	}

	/**
	 * Provides structural metadata for Node.js custom inspection of a syntax-tree node.
	 *
	 * **Example** (Inspect a root with Node utilities)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 * import { inspect } from "node:util"
	 *
	 * const rendered = inspect(AST.fromGlob("cat"))
	 * console.log(rendered.includes("partsLength: 1")) // true
	 * ```
	 *
	 * @category diagnostics
	 * @since 0.0.0
	 */
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

	/**
	 * Creates an empty sequence or extglob node attached to an optional parent.
	 *
	 * **Details**
	 *
	 * Children share the root options and its registry of negative extglobs.
	 * A non-null operator marks the node as magical immediately.
	 *
	 * **Example** (Construct a child operator)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const root = new AST(null, undefined, { dot: true })
	 * const child = new AST("@", root)
	 * console.log(child.options.dot) // true
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
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

	/**
	 * Reports known glob magic in this node or its nested extglobs.
	 *
	 * **Gotchas**
	 *
	 * Literal-piece wildcard detection is deferred until regular-expression source
	 * is generated, so the result can be undefined before that step.
	 *
	 * **Example** (Observe deferred wildcard detection)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const tree = AST.fromGlob("*")
	 * console.log(tree.hasMagic) // undefined
	 * tree.toRegExpSource()
	 * console.log(tree.hasMagic) // true
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
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
	/**
	 * Reconstructs the glob pattern represented by this node.
	 *
	 * **Details**
	 *
	 * Sequence pieces are concatenated; extglob alternatives are joined with a pipe
	 * and enclosed by their operator and parentheses. The result is cached.
	 *
	 * **Example** (Reconstruct an alternative pattern)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * console.log(AST.fromGlob("@(cat|dog)").toString()) // @(cat|dog)
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	toString(): string {
		if (this.#toString !== undefined) return this.#toString;
		if (this.type === null) {
			this.#toString = this.#parts.map((p) => String(p)).join("");
		} else {
			this.#toString = `${this.type}(${this.#parts.map((p) => String(p)).join("|")})`;
		}
		return this.#toString;
	}

	/**
	 * Completes negative-extglob alternatives with the following pieces of enclosing sequences.
	 *
	 * **Details**
	 *
	 * Only the root may perform this step; calling it on a child throws ASTError.
	 * Completion is performed once, after caching the original pattern string.
	 *
	 * **Example** (Preserve a suffix after negation)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const pattern = AST.fromGlob("!(cat)z").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("dogz")) // true
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	#fillNegs() {
		if (this !== this.#root) throw ASTError.make({ message: "should only call on root" });
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
							throw ASTError.make({ message: "string part in extglob AST??" });
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

	/**
	 * Appends non-empty literal pieces or children belonging to this node.
	 *
	 * **Gotchas**
	 *
	 * An AST child must have this node as its parent; otherwise an ASTError is thrown.
	 * Appending does not clear an already cached string representation, so append
	 * before calling toString.
	 *
	 * **Example** (Append a literal piece)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const tree = new AST(null)
	 * tree.push("cat", "")
	 * console.log(tree.toString()) // cat
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	push(...parts: Array<string | AST>) {
		for (const p of parts) {
			if (p === "") continue;
			if (!P.isString(p) && !(p instanceof AST && p.#parent === this)) {
				throw ASTError.make({ message: `invalid part: ${p}` });
			}
			this.#parts.push(p);
		}
	}

	/**
	 * Serializes node pieces and extglob operators into nested arrays with boundary markers.
	 *
	 * **Details**
	 *
	 * Sequence starts receive an empty-array marker. Pattern ends receive an
	 * empty-object marker; negation tails also receive that marker after they are filled.
	 * Extglob nodes begin their array with their operator.
	 *
	 * **Example** (Serialize a literal root)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * console.log(JSON.stringify(AST.fromGlob("cat").toJSON())) // [[],"cat",{}]
	 * ```
	 *
	 * @category serialization
	 * @since 0.0.0
	 */
	toJSON() {
		const ret: Array<unknown> =
			this.type === null
				? this.#parts.slice().map((p) => (P.isString(p) ? p : p.toJSON()))
				: [this.type, ...this.#parts.map((p) => {
					if (P.isString(p)) throw ASTError.make({ message: "p.toJSON is not a function" });
					return p.toJSON();
				})];
		if (this.isStart() && this.type === null) ret.unshift([]);
		if (this.isEnd() && (this === this.#root || (this.#root.#filledNegs && this.#parent?.type === "!"))) {
			ret.push({});
		}
		return ret;
	}

	/**
	 * Checks whether this node can occupy the beginning of its enclosing pattern.
	 *
	 * **Details**
	 *
	 * A root is always a start. A child can also be a start when all preceding
	 * siblings are negative extglobs and its parent is a start.
	 *
	 * **Example** (Identify a root start)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * console.log(AST.fromGlob("cat").isStart()) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
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

	/**
	 * Checks whether this node reaches the end of its enclosing pattern.
	 *
	 * **Details**
	 *
	 * A root and a direct child of a negative extglob count as ends. Other nodes
	 * depend on their parent boundary and, for extglobs, their position among siblings.
	 *
	 * **Example** (Identify a root end)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * console.log(AST.fromGlob("cat").isEnd()) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	isEnd(): boolean {
		if (this.#root === this) return true;
		if (this.#parent?.type === "!") return true;
		if (this.#parent?.isEnd() !== true) return false;
		if (this.type === null) return this.#parent?.isEnd();
		// if not root, it'll always have a parent
		const pl = this.#parent !== undefined ? this.#parent.#parts.length : 0;
		return this.#parentIndex === pl - 1;
	}

	/**
	 * Copies a literal piece or clones a subtree into this node.
	 *
	 * **Details**
	 *
	 * Subtrees are cloned with this node as their parent. Recursive copying is
	 * guarded by the structural nesting-depth limit.
	 *
	 * **Example** (Copy a subtree into a sequence)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const target = new AST(null)
	 * target.copyIn(AST.fromGlob("cat"))
	 * console.log(target.toString()) // cat
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	copyIn(part: AST | string, depth = 0) {
		guardDepth(depth);
		if (P.isString(part)) this.push(part);
		else this.push(part.clone(this, depth + 1));
	}

	/**
	 * Copies this node and its descendants under a supplied parent.
	 *
	 * **Details**
	 *
	 * The clone inherits its new root options. Recursive cloning and copying are
	 * guarded by the structural nesting-depth limit.
	 *
	 * **Example** (Clone beneath a new root)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const parent = new AST(null)
	 * const cloned = AST.fromGlob("cat").clone(parent)
	 * parent.push(cloned)
	 * console.log(parent.toString()) // cat
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	clone(parent: AST, depth = 0): AST {
		guardDepth(depth);
		const c = new AST(this.type, parent);
		for (const p of this.#parts) {
			c.copyIn(p, depth + 1);
		}
		return c;
	}

	/**
	 * Accumulates literal pieces and nested extglobs while tracking structural and operator depth.
	 *
	 * **Example** (Parse nested alternatives)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * console.log(AST.fromGlob("@(cat|@(dog|fox))").toString()) // @(cat|@(dog|fox))
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
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
				opt.noext !== true && isExtglobType(c) && str.charAt(i) === "(" && (extDepth <= maxDepth || ast.#canAdoptType(c));
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

	/**
	 * Checks whether a nested extglob can be flattened by adding an empty alternative.
	 *
	 * **Example** (Compile optional alternatives under repetition)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const pattern = AST.fromGlob("+(?(cat))").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("cat")) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	#canAdoptWithSpace(child?: AST | string): child is AST & {
		type: null;
	} {
		return this.#canAdopt(child, adoptionWithSpaceMap);
	}

	/**
	 * Checks whether a sole nested extglob has an operator that this node can absorb.
	 *
	 * **Example** (Compile compatible nested operators)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const pattern = AST.fromGlob("+(+(cat|dog))").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("catdog")) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	#canAdopt(
		child?: AST | string,
		map: HashMap.HashMap<ExtglobType, Array<ExtglobType>> = adoptionMap,
	): child is AST & {
		type: null;
	} {
		if ((child === undefined || child === "") || !P.isObjectKeyword(child) || P.isFunction(child) || child.type !== null || child.#parts.length !== 1 || this.type === null) {
			return false;
		}
		const gc = child.#parts[0];
		if ((gc === undefined || gc === "") || !P.isObjectKeyword(gc) || P.isFunction(gc) || gc.type === null) {
			return false;
		}
		return this.#canAdoptType(gc.type, map);
	}

	/**
	 * Checks whether an operator is compatible with this node under an adoption map.
	 *
	 * **Example** (Compile exactly-one alternatives under repetition)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const pattern = AST.fromGlob("+(@(cat|dog))").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("catdog")) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	#canAdoptType(c: string, map: HashMap.HashMap<ExtglobType, Array<ExtglobType>> = adoptionAnyMap): c is ExtglobType {
		return this.type !== null && isExtglobType(c) && O.exists(HashMap.get(map, this.type), (types) => types.includes(c));
	}

	/**
	 * Adds an empty alternative to a nested operator before adopting its alternatives.
	 *
	 * **Example** (Retain optional alternatives during flattening)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const pattern = AST.fromGlob("@(?(cat)|dog)").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("dog")) // true
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	#adoptWithSpace(
		child: AST & {
			type: null;
		},
		index: number,
	) {
		const gc = child.#parts[0];
		if (!(gc instanceof AST) || !isExtglobAST(gc)) return;
		const blank = new AST(null, gc, this.options);
		blank.#parts.push("");
		gc.push(blank);
		this.#adopt(child, index);
	}

	/**
	 * Replaces a nested sequence wrapper with its extglob alternatives and reparents them.
	 *
	 * **Details**
	 *
	 * Adoption clears the cached string representation and updates child parents.
	 *
	 * **Example** (Flatten repeated nested alternatives)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const tree = AST.fromGlob("+(+(cat|dog)|fox)")
	 * tree.toRegExpSource()
	 * console.log(tree.toString()) // +(cat|dog|fox)
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	#adopt(
		child: AST & {
			type: null;
		},
		index: number,
	) {
		const gc = child.#parts[0];
		if (!(gc instanceof AST) || !isExtglobAST(gc)) return;
		this.#parts.splice(index, 1, ...gc.#parts);
		for (const p of gc.#parts) {
			if (P.isObjectKeyword(p) && !P.isFunction(p)) p.#parent = this;
		}
		this.#toString = undefined;
	}

	/**
	 * Checks whether a sole nested operator can replace this node according to the usurp map.
	 *
	 * **Example** (Compile nested optional repetition)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const pattern = AST.fromGlob("?(+(cat))").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("catcat")) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	#canUsurpType(c: string): boolean {
		return this.type !== null && isExtglobType(c) && O.exists(HashMap.get(usurpMap, this.type), (types) => HashMap.has(types, c));
	}

	/**
	 * Checks whether a sole sequence child wraps an operator that can replace this node.
	 *
	 * **Example** (Compile a sole nested alternative)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const pattern = AST.fromGlob("@(*(cat))").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("catcat")) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	#canUsurp(child?: AST | string): child is AST & {
		type: null;
	} {
		if (
			(child === undefined || child === "") ||
			!P.isObjectKeyword(child) || P.isFunction(child) ||
			child.type !== null ||
			child.#parts.length !== 1 ||
			this.type === null ||
			this.#parts.length !== 1
		) {
			return false;
		}
		const gc = child.#parts[0];
		if ((gc === undefined || gc === "") || !P.isObjectKeyword(gc) || P.isFunction(gc) || gc.type === null) {
			return false;
		}
		return this.#canUsurpType(gc.type);
	}

	/**
	 * Replaces this node operator and alternatives with those of a compatible sole descendant.
	 *
	 * **Details**
	 *
	 * Replacement clears the cached string representation and empty-extglob marker.
	 *
	 * **Example** (Collapse optional repetition)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const tree = AST.fromGlob("?(+(cat))")
	 * tree.toRegExpSource()
	 * console.log(tree.toString()) // *(cat)
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	#usurp(child: AST & { type: null }) {
		if (this.type === null) return;
		const m = HashMap.get(usurpMap, this.type);
		const gc = child.#parts[0];
		if (!(gc instanceof AST) || !isExtglobAST(gc)) return;
		const nt = O.getOrUndefined(O.flatMap(m, (types) => HashMap.get(types, gc.type)));
		if (nt === undefined || nt === null) return;
		this.#parts = gc.#parts;
		for (const p of this.#parts) {
			if (P.isObjectKeyword(p) && !P.isFunction(p)) {
				p.#parent = this;
			}
		}
		this.type = nt;
		this.#toString = undefined;
		this.#emptyExt = false;
	}

	/**
	 * Parses a glob path portion into a root syntax tree.
	 *
	 * **Details**
	 *
	 * Compatible nested extglobs can be coalesced during parsing. An unfinished
	 * extglob is retained as literal text.
	 *
	 * **Gotchas**
	 *
	 * A supplied maxExtglobRecursion must be a valid non-negative integer cap.
	 * Exceeding that cap degrades further non-coalescible extglobs to literal text.
	 * The independent structural nesting-depth guard throws GuardExceeded for
	 * excessive nesting, including nesting that could otherwise be coalesced.
	 *
	 * **Example** (Parse an extended-glob alternative)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * console.log(AST.fromGlob("@(cat|dog)").toString()) // @(cat|dog)
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	static fromGlob(pattern: string, options: EngineOptions = {}): AST {
		if (options.maxExtglobRecursion !== undefined) {
			assertCap("maxExtglobRecursion", options.maxExtglobRecursion);
		}
		const ast = new AST(null, undefined, options);
		AST.#parseAST(pattern, ast, 0, options, 0, 0);
		return ast;
	}

	// returns the regular expression if there's magic, or the unescaped
	// string if not.
	/**
	 * Produces a regular expression for magic patterns or an unescaped literal for plain patterns.
	 *
	 * **Details**
	 *
	 * Calling this method on a child delegates to its root. Regular expressions are
	 * anchored and carry the original glob and generated source in metadata.
	 * Case-insensitive matching can require a regular expression even without glob
	 * magic, unless nocaseMagicOnly restricts that behavior.
	 *
	 * **Example** (Compile both literal and wildcard patterns)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * console.log(AST.fromGlob("cat").toMMPattern()) // cat
	 * const pattern = AST.fromGlob("c*").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("cat")) // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
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
			this.#hasMagic ||
			(this.#options.nocase === true && this.#options.nocaseMagicOnly !== true && glob.toUpperCase() !== glob.toLowerCase());
		if (!anyMagic) {
			return body;
		}

		const flags = (this.#options.nocase === true ? "i" : "") + (uflag ? "u" : "");
		const pattern: MMRegExp = new RegExp(`^${re}$`, flags);
		pattern._src = re;
		pattern._glob = glob;
		return pattern;
	}

	/**
	 * Exposes the root options shared by every node in this tree.
	 *
	 * **Details**
	 *
	 * The returned options object is the same object supplied to the root; it is
	 * not copied.
	 *
	 * **Example** (Read shared dot matching options)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const tree = AST.fromGlob("*", { dot: true })
	 * console.log(tree.options.dot) // true
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get options(): EngineOptions {
		return this.#options;
	}

	// returns the string match, the regexp source, whether there's magic
	// in the regexp (so a regular expression is required) and whether or
	// not the uflag is needed for the regular expression (for posix classes)
	/**
	 * Generates regular-expression source and matching metadata for this node.
	 *
	 * **Details**
	 *
	 * The tuple contains regular-expression source, the unescaped body, whether
	 * glob magic requires a regular expression, and whether POSIX character classes
	 * require the Unicode flag. allowDot overrides the root dot option.
	 * Root generation flattens compatible extglobs and fills negative-extglob tails
	 * before assembling source.
	 *
	 * **Gotchas**
	 *
	 * Source generation can mutate the tree through flattening and negation-tail
	 * completion. Recursive generation is guarded by the structural nesting-depth limit.
	 *
	 * **Example** (Inspect literal source metadata)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const [source, body, hasMagic, unicode] = AST.fromGlob("cat").toRegExpSource()
	 * console.log(JSON.stringify([source, body, hasMagic, unicode])) // ["cat","cat",false,false]
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	toRegExpSource(allowDot?: boolean, depth = 0): [re: string, body: string, hasMagic: boolean, uflag: boolean] {
		// Port note 2: depth guard on the toRegExpSource <-> #partsToRegExp
		// mutual recursion.
		guardDepth(depth);
		const dot = allowDot ?? (this.#options.dot === true);
		if (this.#root === this) {
			this.#flatten();
			this.#fillNegs();
		}
		if (this.type === null) {
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
					const firstPart = this.#parts[0];
					const dotTravAllowed = this.#parts.length === 1 && P.isString(firstPart) && HashSet.has(justDots, firstPart);
					if (!dotTravAllowed) {
						const aps = addPatternStart;
						// check if we have a possibility of matching . or ..,
						// and prevent that.
						const needNoTrav =
							// dots are allowed, and the pattern starts with [ or .
							(dot && HashSet.has(aps, src.charAt(0))) ||
							// the pattern starts with \., and then [ or .
							(src.startsWith("\\.") && HashSet.has(aps, src.charAt(2))) ||
							// the pattern starts with \.\., and then [ or .
							(src.startsWith("\\.\\.") && HashSet.has(aps, src.charAt(4)));
						// no need to prevent dots if it can't match a dot, or if a
						// sub-pattern will be preventing it anyway.
						const needNoDot = !dot && allowDot !== true && HashSet.has(aps, src.charAt(0));

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
		let body = this.#partsToRegExp(dot, depth);

		if (this.isStart() && this.isEnd() && body === "" && this.type !== "!") {
			// invalid extglob, has to at least be *something* present, if it's
			// the entire path portion.
			const s = this.toString();
			this.#parts = [s];
			this.type = null;
			this.#hasMagic = undefined;
			return [s, unescapePattern(this.toString()), false, false];
		}

		let bodyDotAllowed =
			!repeated || allowDot === true || dot
				? ""
				: this.#partsToRegExp(true, depth);
		if (bodyDotAllowed === body) {
			bodyDotAllowed = "";
		}
		if (bodyDotAllowed !== "") {
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
							: this.type === "+" && bodyDotAllowed !== ""
								? ")"
								: this.type === "*" && bodyDotAllowed !== ""
									? ")?"
									: `)${this.type}`;
			final = start + body + close;
		}
		this.#hasMagic = this.#hasMagic === true;
		return [final, unescapePattern(body), this.#hasMagic, this.#uflag];
	}

	/**
	 * Flattens compatible nested operators through adoption and replacement passes.
	 *
	 * **Details**
	 *
	 * Each operator is flattened for at most ten passes. Recursive traversal
	 * is guarded by the structural nesting-depth limit.
	 *
	 * **Example** (Flatten nested exactly-one alternatives)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const tree = AST.fromGlob("@(cat|@(dog|fox))")
	 * tree.toRegExpSource()
	 * console.log(tree.toString()) // @(cat|dog|fox)
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	#flatten(depth = 0) {
		// Port note 3: tree-depth guard alongside the kept 10-pass width cap.
		guardDepth(depth);
		if (this.type === null) {
			for (const p of this.#parts) {
				if (P.isObjectKeyword(p) && !P.isFunction(p)) {
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
					if (P.isObjectKeyword(c) && !P.isFunction(c)) {
						c.#flatten(depth + 1);
						if (this.#canAdopt(c)) {
							done = false;
							this.#adopt(c, i);
						} else if (this.#canAdoptWithSpace(c)) {
							done = false;
							this.#adoptWithSpace(c, i);
						} else if (this.#canUsurp(c)) {
							done = false;
							this.#usurp(c);
						}
					}
				}
			} while (!done && ++iterations < 10);
		}
		this.#toString = undefined;
	}

	/**
	 * Joins extglob alternatives into regular-expression source while collecting Unicode requirements.
	 *
	 * **Details**
	 *
	 * Alternatives must be AST nodes; a string alternative throws ASTError.
	 * Empty alternatives are filtered when this node spans the entire pattern.
	 *
	 * **Example** (Match an extglob alternative)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const pattern = AST.fromGlob("@(cat|dog)").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("dog")) // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	#partsToRegExp(dot: boolean, depth: number) {
		return this.#parts
			.map((p) => {
				// extglob ASTs should only contain parent ASTs
				if (P.isString(p)) {
					throw ASTError.make({ message: "string type in extglob ast??" });
				}
				// can ignore hasMagic, because extglobs are already always magic
				const [re, _, _hasMagic, uflag] = p.toRegExpSource(dot, depth + 1);
				this.#uflag = this.#uflag || uflag;
				return re;
			})
			.filter((p) => !(this.isStart() && this.isEnd()) || p !== "")
			.join("|");
	}

	/**
	 * Converts literal glob pieces, wildcards and character classes into regular-expression source.
	 *
	 * **Details**
	 *
	 * Consecutive stars coalesce into one wildcard. A wildcard covering an entire
	 * path portion can be required to match at least one character. Escapes and
	 * POSIX character classes are handled while the magic and Unicode flags are collected.
	 *
	 * **Example** (Compile a wildcard piece)
	 *
	 * ```ts
	 * import { AST } from "@beep/scratchpad/effected/glob/internal/ast"
	 *
	 * const pattern = AST.fromGlob("c?t").toMMPattern()
	 * console.log(pattern instanceof RegExp && pattern.test("cat")) // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
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
				re += (HashSet.has(reSpecials, c) ? "\\" : "") + c;
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
				if (consumed !== 0 && !Number.isNaN(consumed)) {
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
