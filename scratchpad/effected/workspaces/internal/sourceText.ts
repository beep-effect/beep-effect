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

/** A string literal, or a template literal with no substitutions, as written in the source. */
export interface SourceLiteral {
	/** Offset of the opening quote. */
	readonly start: number;
	/** The characters between the quotes, escapes left as written. */
	readonly value: string;
}

/** One source text, split three ways. Both strings have the input's exact length and line breaks. */
export interface LexedSource {
	/** Comments blanked to spaces; every literal intact. */
	readonly withoutComments: string;
	/** Comments AND every literal's contents blanked: only code, plus quote and delimiter characters. */
	readonly code: string;
	/** Every string literal and substitution-free template literal, in source order. */
	readonly literals: ReadonlyArray<SourceLiteral>;
}

const IDENTIFIER = /[\p{ID_Continue}$\u200c\u200d]/u;
const SPACE = /\s/;
const FLAG = /[a-z]/i;

/** Keywords after which a `/` opens a regex literal rather than a division. */
const REGEX_AFTER = new Set([
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
const DECLARATIONS = new Set(["const", "let", "var", "using"]);

/** Keywords whose parenthesized condition may be followed directly by a statement, so a `/` after its `)` opens a regex. */
const CONTROL = new Set(["if", "while", "for", "with"]);

/** Objects a member access on which still reaches a global. */
const GLOBAL_OBJECTS = new Set(["globalThis", "global", "window", "self"]);

/** Whether `char` can continue an identifier. */
export const isIdentifierChar = (char: string | undefined): boolean => char !== undefined && IDENTIFIER.test(char);

/** Lex `text` once into its comment-free view, its code-only view and its literals. */
export const lex = (text: string): LexedSource => {
	const kept: Array<string> = [];
	const code: Array<string> = [];
	const literals: Array<SourceLiteral> = [];
	// One brace-depth counter per open template substitution, innermost last.
	const substitutions: Array<number> = [];
	// One entry per open `(`: the if/while/for/with keyword whose condition it opened, if any.
	const parens: Array<string | undefined> = [];
	// Offsets in the code view of every `)` that closed such a condition.
	const controlCloses = new Set<number>();
	const length = text.length;
	let i = 0;

	const blank = (char: string): string => (char === "\n" || char === "\r" ? char : " ");
	/** Emit one input character: `keep` for the comment-free view, `live` for the code view. */
	const emit = (char: string, keep: boolean, live: boolean): void => {
		kept.push(keep ? char : blank(char));
		code.push(live ? char : blank(char));
	};

	/** The last non-space offset in the code view at or before `from`; `-1` when there is none. */
	const lastCode = (from: number): number => {
		let j = from;
		while (j >= 0 && SPACE.test(code[j] ?? "")) j--;
		return j;
	};

	/** The identifier ending at code offset `end`, or `""`. */
	const wordAt = (end: number): string => {
		let start = end;
		while (start >= 0 && isIdentifierChar(code[start])) start--;
		return code.slice(start + 1, end + 1).join("");
	};

	/**
	 * Whether the code at offset `j` ends a binding a `for...of` head iterates
	 * into: a destructuring pattern, or a name that is neither a declaration
	 * keyword nor itself a keyword (`for (x in of / 2)` divides).
	 */
	const endsBinding = (j: number): boolean => {
		const char = code[j] ?? "";
		if (char === "]" || char === "}") return true;
		return isIdentifierChar(char) && !DECLARATIONS.has(wordAt(j)) && !isRegexKeyword(j);
	};

	/** Whether the identifier ending at code offset `j` is a keyword after which a `/` opens a regex. */
	const isRegexKeyword = (j: number): boolean => {
		const word = wordAt(j);
		if (!REGEX_AFTER.has(word)) return false;
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
		return char === ")" || char === "]" || (isIdentifierChar(char) && !isRegexKeyword(j));
	};

	/** Whether a `/` here opens a regex, judged by the last code token. */
	const regexAllowed = (): boolean => {
		const j = lastCode(code.length - 1);
		if (j < 0) return true;
		const last = code[j] ?? "";
		if (isIdentifierChar(last)) return isRegexKeyword(j);
		// `x!` is a TypeScript non-null assertion: an operand, so `/` divides.
		if (last === "!") return !endsOperand(j - 1);
		// `i++` / `i--` is a postfix update: an operand, so `/` divides.
		if ((last === "+" || last === "-") && code[j - 1] === last) return !endsOperand(lastCode(j - 2));
		if (last === ")") return controlCloses.has(j);
		return !"]}\"'`".includes(last);
	};

	/** The if/while/for/with keyword whose condition the `(` about to be emitted opens, if any. */
	const opensCondition = (): string | undefined => {
		const j = lastCode(code.length - 1);
		if (j < 0 || !isIdentifierChar(code[j])) return undefined;
		let word = wordAt(j);
		let end = j - word.length;
		// `for await (`: the keyword sits one word further back.
		if (word === "await") {
			end = lastCode(end);
			word = end < 0 ? "" : wordAt(end);
			end -= word.length;
		}
		return CONTROL.has(word) && code[lastCode(end)] !== "." ? word : undefined;
	};

	/** Consume a regex literal at `i` if one closes on this line; `false` leaves `i` untouched. */
	const regex = (): boolean => {
		let j = i + 1;
		let inClass = false;
		for (; j < length; j++) {
			const char = text[j] ?? "";
			if (char === "\n" || char === "\r") return false;
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
		for (let k = i + 1; k < j; k++) emit(text[k] ?? "", true, false);
		emit("/", true, true);
		i = j + 1;
		while (i < length && FLAG.test(text[i] ?? "")) {
			emit(text[i] ?? "", true, true);
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
			const char = text[i] ?? "";
			if (char === "\\") {
				emit(char, true, false);
				i++;
				if (i < length) {
					emit(text[i] ?? "", true, false);
					i++;
				}
				continue;
			}
			if (char === quote) {
				emit(char, true, true);
				i++;
				literals.push({ start, value: text.slice(start + 1, i - 1) });
				return;
			}
			if (char === "\n") return;
			emit(char, true, false);
			i++;
		}
	};

	/** Consume template text up to its closing backtick or the next `${`. */
	const templateText = (): "end" | "substitution" | "eof" => {
		while (i < length) {
			const char = text[i] ?? "";
			if (char === "\\") {
				emit(char, true, false);
				i++;
				if (i < length) {
					emit(text[i] ?? "", true, false);
					i++;
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
		while (i < length && text[i] !== "\n") {
			emit(text[i] ?? "", false, false);
			i++;
		}
	}

	while (i < length) {
		const char = text[i] ?? "";
		const next = text[i + 1];
		if (char === "/" && next === "/") {
			while (i < length && text[i] !== "\n") {
				emit(text[i] ?? "", false, false);
				i++;
			}
		} else if (char === "/" && next === "*") {
			const close = text.indexOf("*/", i + 2);
			const end = close === -1 ? length : close + 2;
			while (i < end) {
				emit(text[i] ?? "", false, false);
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
			if (parens.pop() !== undefined) controlCloses.add(code.length);
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
	if (before < 0 || !"{,;".includes(code[before] ?? "")) return false;
	let k = after;
	while (k < code.length && SPACE.test(code[k] ?? "")) k++;
	if (code[k] === "?") {
		k++;
		while (k < code.length && SPACE.test(code[k] ?? "")) k++;
	}
	return code[k] === ":";
};

/**
 * Offsets where `name` is referenced in lexed `code` as a free identifier, a
 * member of a global object, or a spread operand. A member of any other object
 * (`child.process`), a longer identifier, a private field and an object-literal
 * key or type member are not.
 */
export const references = (code: string, name: string): ReadonlyArray<number> => {
	const found: Array<number> = [];
	for (let at = code.indexOf(name); at !== -1; at = code.indexOf(name, at + name.length)) {
		const before = code[at - 1];
		if (isIdentifierChar(before) || before === "#" || isIdentifierChar(code[at + name.length])) continue;
		let j = at - 1;
		while (j >= 0 && SPACE.test(code[j] ?? "")) j--;
		if (code[j] !== ".") {
			if (!isPropertyKey(code, j, at + name.length)) found.push(at);
			continue;
		}
		if (code[j - 1] === "." && code[j - 2] === ".") {
			found.push(at);
			continue;
		}
		let end = code[j - 1] === "?" ? j - 2 : j - 1;
		while (end >= 0 && SPACE.test(code[end] ?? "")) end--;
		let start = end;
		while (start >= 0 && isIdentifierChar(code[start])) start--;
		if (GLOBAL_OBJECTS.has(code.slice(start + 1, end + 1))) found.push(at);
	}
	return found;
};

/** The identifier ending at or before `end` (skipping whitespace); `""` when it is itself a member access. */
const wordEndingAt = (code: string, end: number): string => {
	let j = end;
	while (j >= 0 && SPACE.test(code[j] ?? "")) j--;
	let start = j;
	while (start >= 0 && isIdentifierChar(code[start])) start--;
	return code[start] === "." ? "" : code.slice(start + 1, j + 1);
};

/**
 * The literals that are module specifiers: after `from` or `import`, or the
 * whole first argument of `import(` or `require(` (followed by `)` or `,`, so
 * `import("./x" + name)` is not read as `"./x"`).
 */
export const specifierLiterals = (lexed: LexedSource): ReadonlyArray<SourceLiteral> =>
	lexed.literals.filter((literal) => {
		let j = literal.start - 1;
		while (j >= 0 && SPACE.test(lexed.code[j] ?? "")) j--;
		if (lexed.code[j] === "(") {
			const callee = wordEndingAt(lexed.code, j - 1);
			if (callee !== "import" && callee !== "require") return false;
			let k = literal.start + literal.value.length + 2;
			while (k < lexed.code.length && SPACE.test(lexed.code[k] ?? "")) k++;
			return lexed.code[k] === ")" || lexed.code[k] === ",";
		}
		const keyword = wordEndingAt(lexed.code, j);
		return keyword === "from" || keyword === "import";
	});

/** A lookup from an offset in `text` to its 1-based line and UTF-16 column. */
export const locate = (text: string): ((offset: number) => { readonly line: number; readonly column: number }) => {
	const starts: Array<number> = [0];
	for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
	return (offset) => {
		let low = 0;
		let high = starts.length - 1;
		while (low < high) {
			const middle = (low + high + 1) >> 1;
			if ((starts[middle] ?? 0) <= offset) low = middle;
			else high = middle - 1;
		}
		return { line: low + 1, column: offset - (starts[low] ?? 0) + 1 };
	};
};
