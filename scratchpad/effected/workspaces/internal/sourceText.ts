import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import * as MutableHashSet from "effect/MutableHashSet";
// The one lexer behind SourceBoundary: a single pass that tells code from
// comments and literals, so a scanner looking for real references never trips
// on prose, a string, template text or a regex body — and never lets a "/*"
// inside a string swallow real code behind it.
//
// Deliberately NOT a parser. It tracks exactly what decides whether a
// character is code: comments, the three quote forms, template substitutions
// nested to any depth, and regex literals by the classic previous-token rule.
// Parentheses are tracked so a `/` after the `)` of an `if`/`while`/`for`/
// `with` condition opens a regex while one after any other `)` divides; a `/`
// after a postfix `++`/`--` or a TypeScript non-null `!` divides.
// Keywords decide too, but only where they are keywords: a property name
// (`x.of`, `a?.return`) is always an operand, and the contextual `of` is a
// keyword only between a `for (` binding and its iterable, so a variable named
// `of` divides like any other.
// Documented misreads: a regex literal directly after a block-closing `}`
// reads as division, JSX text reads as code, and `yield`/`await` always read
// as keywords — right in module and strict code, where they are reserved,
// wrong only for a sloppy-mode script that names a variable either word.

const $I = $ScratchpadId.create("effected/workspaces/internal/sourceText");

/**
 * Describes a string literal, or a template literal with no substitutions, as written in the source.
 *
 * **Example** (Keep a literal raw)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { SourceLiteral } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * console.log(S.is(SourceLiteral)({ start: 7, value: "node:fs" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceLiteral = S.Struct({
	/** Offset of the opening quote. */
	start: S.Finite.annotateKey({ description: "The opening quote offset in original UTF-16 code units." }),
	/** The characters between the quotes, escapes left as written. */
	value: S.String.annotateKey({ description: "The characters between the quotes, with escapes left as written by the lexer." }),
}).pipe($I.annoteSchema("SourceLiteral", { description: "A plain-object literal payload retaining the original quote offset and raw text." }));
/**
 * Payload accepted by {@link SourceLiteral}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SourceLiteral = typeof SourceLiteral.Type;

/**
 * Represents one source text split into a comment-free view, a code-only view and its literals.
 *
 * **Details**
 *
 * Both strings have the input's exact length and line breaks.
 *
 * **Example** (Validate aligned lexer views)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { LexedSource, lex } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * console.log(S.is(LexedSource)(lex("process.pid"))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LexedSource = S.Struct({
	/** Comments blanked to spaces; every literal intact. */
	withoutComments: S.String.annotateKey({ description: "Comments blanked to spaces, with literals, original UTF-16 width and line breaks intact." }),
	/** Comments AND every literal's contents blanked: only code, plus quote and delimiter characters. */
	code: S.String.annotateKey({ description: "Comments and literal contents blanked, preserving original UTF-16 width, quotes, delimiters and line breaks." }),
	/** Every string literal and substitution-free template literal, in source order. */
	literals: S.Array(SourceLiteral).annotateKey({ description: "Raw strings and substitution-free templates in source order." }),
}).pipe($I.annoteSchema("LexedSource", { description: "Plain-object lexer views aligned with the original source and its ordered raw literals." }));
/**
 * Payload accepted by {@link LexedSource}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type LexedSource = typeof LexedSource.Type;

const IDENTIFIER = /[\p{ID_Continue}$\u200c\u200d]/u;
// Include malformed escapes in the raw token so they cannot expose a false
// shorter identifier. Cooking below accepts only identifier code points.
const IDENTIFIER_TOKEN = /(?:[\p{ID_Continue}$\u200c\u200d]|\\u\{[^}\s]*\}?|\\[^\s]?)+/gu;
const SPACE = /\s/;
const FLAG = /[a-z]/i;

/** Keywords after which a `/` opens a regex literal rather than a division. */
const REGEX_AFTER = MutableHashSet.fromIterable([
	"return",
	"typeof",
	"instanceof",
	"in",
	"of",
	"new",
	"delete",
	"void",
	"throw",
	"case",
	"do",
	"else",
	"yield",
	"await",
]);

/** Declaration keywords: the word after one is a binding name, so a `for (const of of xs)` binding named `of` is not the keyword. */
const DECLARATIONS = MutableHashSet.fromIterable(["const", "let", "var", "using"]);

/** Keywords whose parenthesized condition may be followed directly by a statement, so a `/` after its `)` opens a regex. */
const CONTROL = MutableHashSet.fromIterable(["if", "while", "for", "with"]);

/** Objects a member access on which still reaches a global. */
const GLOBAL_OBJECTS = MutableHashSet.fromIterable(["globalThis", "global", "window", "self"]);

/**
 * Reads complete raw identifier tokens, including escaped and malformed continuations.
 *
 * **Example** (Retain an escaped token's raw width)
 *
 * ```ts
 * import { identifierTokens } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * for (const token of identifierTokens("stdout.wr\\u0069te")) console.log(token.index, token[0]);
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const identifierTokens = (code: string): IterableIterator<RegExpExecArray> => code.matchAll(IDENTIFIER_TOKEN);

/**
 * Reads a complete raw identifier beginning exactly at a UTF-16 offset.
 *
 * **Example** (Read an escaped identifier)
 *
 * ```ts
 * import { identifierAt } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * console.log(identifierAt("x.stdout", 2)) // stdout
 * console.log(identifierAt(1)("x.stdout")) // undefined
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const identifierAt: {
	(at: number): (code: string) => string | undefined;
	(code: string, at: number): string | undefined;
} = dual(2, (code: string, at: number): string | undefined => {
	const first = identifierTokens(code.slice(at)).next();
	return first.done === true || first.value.index !== 0 ? undefined : first.value[0];
});

/**
 * Tests whether `char` can continue an identifier.
 *
 * **Example** (Recognize identifier continuations)
 *
 * ```ts
 * import { isIdentifierChar } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * console.log(isIdentifierChar("$")) // true
 * console.log(isIdentifierChar(undefined)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isIdentifierChar = (char: string | undefined): boolean => char !== undefined && IDENTIFIER.test(char);

/**
 * Reads a complete code point starting at a UTF-16 offset, for string and lexer-buffer lookups.
 *
 * **Example** (Read a surrogate pair from text and a lexer buffer)
 *
 * ```ts
 * import { codePointAt } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * console.log(codePointAt("a😀", 1)) // 😀
 * console.log(codePointAt(1)(["a", "\uD83D", "\uDE00"])) // 😀
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const codePointAt: {
	(at: number): (text: string | ReadonlyArray<string>) => string | undefined;
	(text: string | ReadonlyArray<string>, at: number): string | undefined;
} = dual(2, (text: string | ReadonlyArray<string>, at: number): string | undefined => {
	const first = text[at];
	const second = text[at + 1];
	return first !== undefined && second !== undefined && /[\uD800-\uDBFF]/u.test(first) && /[\uDC00-\uDFFF]/u.test(second)
		? first + second
		: first;
});

/**
 * Reads a complete code point ending just before a UTF-16 offset.
 *
 * **Example** (Read the code point before a boundary)
 *
 * ```ts
 * import { codePointBefore } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * console.log(codePointBefore("a😀", 3)) // 😀
 * console.log(codePointBefore(0)("a😀")) // undefined
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const codePointBefore: {
	(at: number): (text: string | ReadonlyArray<string>) => string | undefined;
	(text: string | ReadonlyArray<string>, at: number): string | undefined;
} = dual(2, (text: string | ReadonlyArray<string>, at: number): string | undefined => {
	const last = text[at - 1];
	const first = text[at - 2];
	return first !== undefined && last !== undefined && /[\uD800-\uDBFF]/u.test(first) && /[\uDC00-\uDFFF]/u.test(last)
		? first + last
		: last;
});

/** The four ECMAScript line terminators. */
const isLineTerminator = (char: string | undefined): boolean =>
	char === "\n" || char === "\r" || char === "\u2028" || char === "\u2029";

/**
 * Lexes `text` once into its comment-free view, its code-only view and its literals.
 *
 * **Example** (Inspect aligned views and raw literals)
 *
 * ```ts
 * import { lex } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * const text = 'const x = "hi"; // note';
 * const lexed = lex(text);
 * console.log(lexed.withoutComments === 'const x = "hi";        ') // true
 * console.log(lexed.code === 'const x = "  ";        ') // true
 * console.log(lexed.literals[0]?.value) // hi
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const lex = (text: string): LexedSource => {
	const kept: Array<string> = [];
	const code: Array<string> = [];
	const literals: Array<SourceLiteral> = [];
	// One brace-depth counter per open template substitution, innermost last.
	const substitutions: Array<number> = [];
	// One entry per open `(`: the if/while/for/with keyword whose condition it opened, if any.
	const parens: Array<string | undefined> = [];
	// Offsets in the code view of every `)` that closed such a condition.
	const controlCloses = MutableHashSet.empty<number>();
	const length = text.length;
	let i = 0;

	const blank = (char: string): string => (isLineTerminator(char) ? char : " ");
	/** Emit one input character: `keep` for the comment-free view, `live` for the code view. */
	const emit = (char: string, keep: boolean, live: boolean): void => {
		kept.push(keep ? char : blank(char));
		code.push(live ? char : blank(char));
	};

	/** The last non-space offset in the code view at or before `from`; `-1` when there is none. */
	const lastCode = (from: number): number => {
		let j = from;
		while (j >= 0 && SPACE.test(code.slice(j, j + 1).join(""))) j--;
		return j;
	};

	/** The identifier ending at code offset `end`, or `""`. */
	const wordAt = (end: number): string => {
		let start = end;
		while (start >= 0 && isIdentifierChar(codePointBefore(code, start + 1)))
			start -= O.getOrThrow(O.fromUndefinedOr(codePointBefore(code, start + 1))).length;
		return code.slice(start + 1, end + 1).join("");
	};

	/**
	 * Whether the code at offset `j` ends a binding a `for...of` head iterates
	 * into: a destructuring pattern, or a name that is neither a declaration
	 * keyword nor itself a keyword (`for (x in of / 2)` divides).
	 */
	const endsBinding = (j: number): boolean => {
		const char = code.slice(j, j + 1).join("");
		if (char === "]" || char === "}") return true;
		return isIdentifierChar(codePointBefore(code, j + 1)) && !MutableHashSet.has(DECLARATIONS, wordAt(j)) && !isRegexKeyword(j);
	};

	/** Whether the identifier ending at code offset `j` is a keyword after which a `/` opens a regex. */
	const isRegexKeyword = (j: number): boolean => {
		const word = wordAt(j);
		if (!MutableHashSet.has(REGEX_AFTER, word)) return false;
		const before = lastCode(j - word.length);
		// A property name (`x.of`, `a?.return`) is never a keyword; a spread (`...new`) still is.
		if (code[before] === "." && !(code[before - 1] === "." && code[before - 2] === ".")) return false;
		// `of` is contextual: the keyword only between a `for (` binding and its iterable.
		if (word === "of") return parens.at(-1) === "for" && before >= 0 && endsBinding(before);
		return true;
	};

	/** Whether the code at offset `j` ends an operand (a value a postfix operator or a `/` division can follow). */
	const endsOperand = (j: number): boolean => {
		const char = code[j] ?? "";
		return (char === ")" && !MutableHashSet.has(controlCloses, j)) || char === "]" || (isIdentifierChar(codePointBefore(code, j + 1)) && !isRegexKeyword(j));
	};

	/** Whether a `/` here opens a regex, judged by the last code token. */
	const regexAllowed = (): boolean => {
		const j = lastCode(code.length - 1);
		if (j < 0) return true;
		const last = code.slice(j, j + 1).join("");
		if (isIdentifierChar(codePointBefore(code, j + 1))) return isRegexKeyword(j);
		// Postfix assertions may be repeated or separated from their operand by comments or spaces.
		if (last === "!") {
			let operand = lastCode(j - 1);
			while (code[operand] === "!") operand = lastCode(operand - 1);
			return !endsOperand(operand);
		}
		// `i++` / `i--` is a postfix update: an operand, so `/` divides.
		if ((last === "+" || last === "-") && code[j - 1] === last) return !endsOperand(lastCode(j - 2));
		if (last === ")") return MutableHashSet.has(controlCloses, j);
		return !"]}\"'`".includes(last);
	};

	/** The if/while/for/with keyword whose condition the `(` about to be emitted opens, if any. */
	const opensCondition = (): string | undefined => {
		const j = lastCode(code.length - 1);
		if (j < 0 || !isIdentifierChar(codePointBefore(code, j + 1))) return undefined;
		let word = wordAt(j);
		let end = j - word.length;
		// `for await (`: the keyword sits one word further back.
		if (word === "await") {
			end = lastCode(end);
			word = end < 0 ? "" : wordAt(end);
			end -= word.length;
		}
		return MutableHashSet.has(CONTROL, word) && code[lastCode(end)] !== "." ? word : undefined;
	};

	/** Consume a regex literal at `i` if one closes on this line; `false` leaves `i` untouched. */
	const regex = (): boolean => {
		let j = i + 1;
		let inClass = false;
		for (; j < length; j++) {
			const char = text.charAt(j);
			if (isLineTerminator(char)) return false;
			if (char === "\\") {
				j++;
				continue;
			}
			if (inClass) {
				if (char === "]") inClass = false;
			} else if (char === "[") {
				inClass = true;
			} else if (char === "/") {
				break;
			}
		}
		if (j >= length) return false;
		emit("/", true, true);
		for (let k = i + 1; k < j; k++) emit(text.charAt(k), true, false);
		emit("/", true, true);
		i = j + 1;
		while (i < length && FLAG.test(text.charAt(i))) {
			emit(text.charAt(i), true, true);
			i++;
		}
		return true;
	};

	/** Consume a `"` or `'` string starting at `i`. An unterminated one stops at the line break. */
	const string = (quote: string): void => {
		const start = i;
		emit(quote, true, true);
		i++;
		while (i < length) {
			const char = text.charAt(i);
			if (char === "\\") {
				emit(char, true, false);
				i++;
				if (i < length) {
					const escaped = text[i];
					emit(text.charAt(i), true, false);
					i++;
					if (escaped === "\r" && text[i] === "\n") {
						emit("\n", true, false);
						i++;
					}
				}
				continue;
			}
			if (char === quote) {
				emit(char, true, true);
				i++;
				literals.push({ start, value: text.slice(start + 1, i - 1) });
				return;
			}
			if (char === "\n" || char === "\r") return;
			emit(char, true, false);
			i++;
		}
	};

	/** Consume template text up to its closing backtick or the next `${`. */
	const templateText = (): "end" | "substitution" | "eof" => {
		while (i < length) {
			const char = text.charAt(i);
			if (char === "\\") {
				emit(char, true, false);
				i++;
				if (i < length) {
					const escaped = text[i];
					emit(text.charAt(i), true, false);
					i++;
					if (escaped === "\r" && text[i] === "\n") {
						emit("\n", true, false);
						i++;
					}
				}
				continue;
			}
			if (char === "`") {
				emit(char, true, true);
				i++;
				return "end";
			}
			if (char === "$" && text[i + 1] === "{") {
				emit("$", true, true);
				emit("{", true, true);
				i += 2;
				return "substitution";
			}
			emit(char, true, false);
			i++;
		}
		return "eof";
	};

	if (text.startsWith("#!")) {
		while (i < length && !isLineTerminator(text[i])) {
			emit(text.charAt(i), false, false);
			i++;
		}
	}

	while (i < length) {
		const char = text.charAt(i);
		const next = text[i + 1];
		if (char === "/" && next === "/") {
			while (i < length && !isLineTerminator(text[i])) {
				emit(text.charAt(i), false, false);
				i++;
			}
		} else if (char === "/" && next === "*") {
			const close = text.indexOf("*/", i + 2);
			const end = close === -1 ? length : close + 2;
			while (i < end) {
				emit(text.charAt(i), false, false);
				i++;
			}
		} else if (char === '"' || char === "'") {
			string(char);
		} else if (char === "`") {
			const start = i;
			emit(char, true, true);
			i++;
			const stop = templateText();
			if (stop === "end") literals.push({ start, value: text.slice(start + 1, i - 1) });
			else if (stop === "substitution") substitutions.push(0);
		} else if (char === "/" && regexAllowed() && regex()) {
			// consumed by regex()
		} else if (char === "(") {
			parens.push(opensCondition());
			emit(char, true, true);
			i++;
		} else if (char === ")") {
			if (parens.pop() !== undefined) MutableHashSet.add(controlCloses, code.length);
			emit(char, true, true);
			i++;
		} else if (char === "{") {
			const depth = substitutions.at(-1);
			if (depth !== undefined) substitutions[substitutions.length - 1] = depth + 1;
			emit(char, true, true);
			i++;
		} else if (char === "}") {
			const depth = substitutions.at(-1);
			emit(char, true, true);
			i++;
			if (depth === 0) {
				substitutions.pop();
				if (templateText() === "substitution") substitutions.push(0);
			} else if (depth !== undefined) {
				substitutions[substitutions.length - 1] = depth - 1;
			}
		} else {
			emit(char, true, true);
			i++;
		}
	}
	return { withoutComments: kept.join(""), code: code.join(""), literals };
};

/**
 * Whether the identifier ending just before `after` is an object-literal key or
 * a type member (`{ process: 1 }`, `interface I { process?: string }`): the
 * previous code character (at `before`) is `{`, `,` or `;` and the next one is
 * `:` or `?:`. A ternary branch (`ok ? process : x`) follows `?`, so it still counts.
 */
const isPropertyKey = (code: string, before: number, after: number): boolean => {
	if (before < 0 || !"{,;".includes(code.charAt(before))) return false;
	let k = after;
	while (k < code.length && SPACE.test(code.charAt(k))) k++;
	if (code[k] === "?") {
		k++;
		while (k < code.length && SPACE.test(code.charAt(k))) k++;
	}
	return code[k] === ":";
};

/**
 * Finds offsets where `name` is referenced in lexed `code` as a free identifier, a
 * member of a global object, or a spread operand.
 *
 * **Details**
 *
 * A member of another object
 * (`child.process`), a longer identifier, a private field and an object-literal
 * key or type member are not counted.
 *
 * **Example** (Select free and global references)
 *
 * ```ts
 * import { lex, references } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * const code = lex("process; child.process; globalThis.process").code;
 * console.log(references(code, "process").join(",")) // 0,35
 * console.log(references("process")(lex("({ process: 1 })").code).length) // 0
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const references: {
	(name: string): (code: string) => ReadonlyArray<number>;
	(code: string, name: string): ReadonlyArray<number>;
} = dual(2, (code: string, name: string): ReadonlyArray<number> => {
	const found: Array<number> = [];
	for (const token of identifierTokens(code)) {
		if (cookIdentifier(token[0]) !== name) continue;
		const at = token.index;
		const after = at + token[0].length;
		if (code[at - 1] === "#") continue;
		let j = at - 1;
		while (j >= 0 && SPACE.test(code.charAt(j))) j--;
		if (code[j] !== ".") {
			if (!isPropertyKey(code, j, after)) found.push(at);
			continue;
		}
		if (code[j - 1] === "." && code[j - 2] === ".") {
			found.push(at);
			continue;
		}
		let end = code[j - 1] === "?" ? j - 2 : j - 1;
		while (end >= 0 && SPACE.test(code.charAt(end))) end--;
		if (isGlobalReceiver(code, end)) found.push(at);
	}
	return found;
});

/** Raw start of the identifier ending immediately before `end`, including Unicode escapes. */
const identifierStartBefore = (code: string, end: number): number => {
	let start = end;
	while (start > 0) {
		const point = codePointBefore(code, start);
		if (point !== undefined && isIdentifierChar(point)) {
			start -= point.length;
		} else if (code[start - 1] === "\\") {
			start--;
		} else if (code[start - 1] === "}") {
			const opening = code.lastIndexOf("\\u{", start - 1);
			if (opening < 0 || !/^[^\s{}]*$/u.test(code.slice(opening + 3, start - 1))) break;
			start = opening;
		} else if (code[start - 1] === "{" && code.slice(start - 3, start - 1) === "\\u") {
			start -= 3;
		} else {
			break;
		}
	}
	return start;
};

/** Require every receiver in the chain to be a global object, ending at a free or spread reference. */
const isGlobalReceiver = (code: string, end: number): boolean => {
	while (end >= 0) {
		const start = identifierStartBefore(code, end + 1);
		const receiver = cookIdentifier(code.slice(start, end + 1));
		if (receiver === undefined || !MutableHashSet.has(GLOBAL_OBJECTS, receiver)) return false;
		let before = start - 1;
		while (before >= 0 && SPACE.test(code.charAt(before))) before--;
		if (code[before] === "#") return false;
		if (code[before] !== "." || (code[before - 1] === "." && code[before - 2] === ".")) return true;
		end = code[before - 1] === "?" ? before - 2 : before - 1;
		while (end >= 0 && SPACE.test(code.charAt(end))) end--;
	}
	return false;
};

/** The cooked identifier ending at or before `end`; empty for member calls or invalid escapes. */
const wordEndingAt = (code: string, end: number): string => {
	let j = end;
	while (j >= 0 && SPACE.test(code.charAt(j))) j--;
	const start = identifierStartBefore(code, j + 1);
	let before = start - 1;
	while (before >= 0 && SPACE.test(code.charAt(before))) before--;
	return code[before] === "." || code[before] === "#" ? "" : cookIdentifier(code.slice(start, j + 1)) ?? "";
};

/**
 * Cooks Unicode identifier escapes; malformed or non-identifier escapes match no name.
 *
 * **Example** (Cook a Unicode member spelling)
 *
 * ```ts
 * import { cookIdentifier } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * console.log(cookIdentifier("wr\\u0069te")) // write
 * console.log(cookIdentifier("\\u0020")) // undefined
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const cookIdentifier = (raw: string): string | undefined => {
	const cooked = raw.replace(/\\u(?:[\dA-Fa-f]{4}|\{[\dA-Fa-f]+\})/gu, (escape) => {
		const point = Number.parseInt(escape[2] === "{" ? escape.slice(3, -1) : escape.slice(2), 16);
		return point <= 0x10ffff ? String.fromCodePoint(point) : escape;
	});
	return /^(?:[\p{ID_Continue}$\u200c\u200d])+$/u.test(cooked) ? cooked : undefined;
};

const STRING_ESCAPES: Readonly<Record<string, string>> = {
	b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v",
};

/** Cook string escapes without evaluating source; the lexer's raw literal and offsets stay intact. */
const cookSpecifier = (raw: string): string => raw.replace(/\r\n?/gu, "\n").replace(
	/\\(?:\r\n|[\n\r\u2028\u2029]|x[\da-f]{2}|u[\da-f]{4}|u\{[\da-f]+\}|[0-3][0-7]{0,2}|[4-7][0-7]?|.)/giu,
	(escape) => {
		const value = escape.slice(1);
		if (isLineTerminator(value[0])) return "";
		if (Str.startsWith("x")(value)) return String.fromCharCode(Number.parseInt(value.slice(1), 16));
		if (Str.startsWith("u")(value)) {
			const point = Number.parseInt(value[1] === "{" ? value.slice(2, -1) : value.slice(1), 16);
			return point <= 0x10ffff ? String.fromCodePoint(point) : escape;
		}
		if (/^[0-7]/u.test(value)) return String.fromCharCode(Number.parseInt(value, 8));
		return O.getOrElse(R.get(STRING_ESCAPES, value), () => value);
	},
);

/**
 * Extracts cooked literals that are module specifiers, retaining their opening-quote offsets.
 *
 * **Details**
 *
 * Matches literals after `from` or `import`, or the
 * whole first argument of `import(`, `require(` or `require?.(` (followed by `)` or `,`, so
 * `import("./x" + name)` is not read as `"./x"`).
 *
 * **Example** (Extract a cooked module specifier)
 *
 * ```ts
 * import { lex, specifierLiterals } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * const lexed = lex('import "node:\\u0066s"; import("./x" + name);');
 * const specifiers = specifierLiterals(lexed);
 * console.log(specifiers[0]?.value) // node:fs
 * console.log(specifiers[0]?.start) // 7
 * console.log(specifiers.length) // 1
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const specifierLiterals = (lexed: LexedSource): ReadonlyArray<SourceLiteral> =>
	lexed.literals.filter((literal) => {
		let j = literal.start - 1;
		while (j >= 0 && SPACE.test(lexed.code.charAt(j))) j--;
		if (lexed.code[j] === "(") {
			let end = j - 1;
			while (end >= 0 && SPACE.test(lexed.code.charAt(end))) end--;
			const optional = lexed.code[end] === "." && lexed.code[end - 1] === "?";
			const callee = wordEndingAt(lexed.code, optional ? end - 2 : end);
			if (callee !== "require" && (optional || callee !== "import")) return false;
			let k = literal.start + literal.value.length + 2;
			while (k < lexed.code.length && SPACE.test(lexed.code.charAt(k))) k++;
			return lexed.code[k] === ")" || lexed.code[k] === ",";
		}
		const keyword = wordEndingAt(lexed.code, j);
		return keyword === "from" || keyword === "import";
	}).map((literal) => ({ start: literal.start, value: cookSpecifier(literal.value) }));

/**
 * Builds a lookup from an offset in `text` to its 1-based line and UTF-16 column.
 *
 * **Example** (Locate text after a CRLF line break)
 *
 * ```ts
 * import { locate } from "@beep/scratchpad/effected/workspaces/internal/sourceText";
 *
 * const position = locate("a\r\n😀x")(5);
 * console.log(position.line) // 2
 * console.log(position.column) // 3
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const locate = (text: string): ((offset: number) => { readonly line: number; readonly column: number }) => {
	const starts: Array<number> = [0];
	for (let i = 0; i < text.length; i++) {
		if (!isLineTerminator(text[i])) continue;
		if (text[i] === "\r" && text[i + 1] === "\n") i++;
		starts.push(i + 1);
	}
	return (offset) => {
		let low = 0;
		let high = starts.length - 1;
		while (low < high) {
			const middle = (low + high + 1) >> 1;
			if (O.getOrThrow(O.fromUndefinedOr(starts[middle])) <= offset) low = middle;
			else high = middle - 1;
		}
		return { line: low + 1, column: offset - O.getOrThrow(O.fromUndefinedOr(starts[low])) + 1 };
	};
};
