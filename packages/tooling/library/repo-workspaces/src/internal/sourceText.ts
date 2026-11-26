import { $RepoWorkspacesId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoWorkspacesId.create("internal/sourceText");

/**
 * Describes a string literal, or a template literal with no substitutions, as written in the source.
 *
 * **Example** (Keep a literal raw)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { SourceLiteral } from "@beep/repo-workspaces/internal/sourceText";
 *
 * console.log(S.is(SourceLiteral)({ start: 7, value: "node:fs" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SourceLiteral extends S.Opaque<SourceLiteral, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Offset of the opening quote. */
    start: S.Finite.pipe(
      $I.annoteKey("SourceLiteral.start", { description: "The opening quote offset in original UTF-16 code units." })
    ),
    /** The characters between the quotes, escapes left as written. */
    value: S.String.pipe(
      $I.annoteKey("SourceLiteral.value", {
        description: "The characters between the quotes, with escapes left as written by the lexer.",
      })
    ),
  }).pipe(
    $I.annoteSchema("SourceLiteral", {
      description: "A literal payload retaining the original quote offset and raw text.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SourceLiteral {
  /**
   * The plain, unbranded encoded shape of a {@link SourceLiteral}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SourceLiteral.Encoded;
}

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
 * import { LexedSource, lex } from "@beep/repo-workspaces/internal/sourceText";
 *
 * console.log(S.is(LexedSource)(lex("process.pid"))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LexedSource extends S.Opaque<LexedSource, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Comments blanked to spaces; every literal intact. */
    withoutComments: S.String.pipe(
      $I.annoteKey("LexedSource.withoutComments", {
        description: "Comments blanked to spaces, with literals, original UTF-16 width and line breaks intact.",
      })
    ),
    /** Comments AND every literal's contents blanked: only code, plus quote and delimiter characters. */
    code: S.String.pipe(
      $I.annoteKey("LexedSource.code", {
        description:
          "Comments and literal contents blanked, preserving original UTF-16 width, quotes, delimiters and line breaks.",
      })
    ),
    /** Every string literal and substitution-free template literal, in source order. */
    literals: S.Array(SourceLiteral).pipe(
      $I.annoteKey("LexedSource.literals", {
        description: "Raw strings and substitution-free templates in source order.",
      })
    ),
  }).pipe(
    $I.annoteSchema("LexedSource", {
      description: "Lexer views aligned with the original source and its ordered raw literals.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LexedSource {
  /**
   * The plain, unbranded encoded shape of a {@link LexedSource}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof LexedSource.Encoded;
}

const IDENTIFIER = /[\p{ID_Continue}$\u200c\u200d]/u;
const IDENTIFIER_NAME = /^(?:[\p{ID_Continue}$\u200c\u200d])+$/u;
const IDENTIFIER_TOKEN = /(?:[\p{ID_Continue}$\u200c\u200d]|\\u\{[^}\s]*\}?|\\[^\s]?)+/gu;
const UNICODE_ESCAPE = /(\\u(?:[\dA-Fa-f]{4}|\{[\dA-Fa-f]+\}))/u;
const STRING_ESCAPE =
  /(\\(?:\r\n|[\n\r\u2028\u2029]|x[\da-f]{2}|u[\da-f]{4}|u\{[\da-f]+\}|[0-3][0-7]{0,2}|[4-7][0-7]?|.))/iu;
const SPACE = /\s/;
const FLAG = /[a-z]/i;
const HIGH_SURROGATE = /[\uD800-\uDBFF]/u;
const LOW_SURROGATE = /[\uDC00-\uDFFF]/u;

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

const DECLARATIONS = MutableHashSet.fromIterable(["const", "let", "var", "using"]);

const CONTROL = MutableHashSet.fromIterable(["if", "while", "for", "with"]);

const GLOBAL_OBJECTS = MutableHashSet.fromIterable(["globalThis", "global", "window", "self"]);

/**
 * Reads the UTF-16 unit at an offset, or `""` outside the text (a negative offset included).
 *
 * **Example** (Read a unit and an out-of-range offset)
 *
 * ```ts
 * import { unitAt } from "@beep/repo-workspaces/internal/sourceText";
 *
 * console.log(unitAt("ab", 1)) // b
 * console.log(unitAt("ab", -1) === "") // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const unitAt: {
  (at: number): (text: string) => string;
  (text: string, at: number): string;
} = dual(2, (text: string, at: number): string => (at < 0 ? "" : Str.slice(at, at + 1)(text)));

/**
 * Finds the last offset at or before `from` that is not whitespace; `-1` when there is none.
 *
 * **Example** (Step back over spaces)
 *
 * ```ts
 * import { skipSpaceBack } from "@beep/repo-workspaces/internal/sourceText";
 *
 * console.log(skipSpaceBack("a  ", 2)) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const skipSpaceBack: {
  (from: number): (code: string) => number;
  (code: string, from: number): number;
} = dual(2, (code: string, from: number): number => {
  let j = from;
  while (j >= 0 && SPACE.test(unitAt(code, j))) j--;
  return j;
});

/**
 * Finds the first offset at or after `from` that is not whitespace; the text's length when there is none.
 *
 * **Example** (Step forward over spaces)
 *
 * ```ts
 * import { skipSpaceForward } from "@beep/repo-workspaces/internal/sourceText";
 *
 * console.log(skipSpaceForward("a  b", 1)) // 3
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const skipSpaceForward: {
  (from: number): (code: string) => number;
  (code: string, from: number): number;
} = dual(2, (code: string, from: number): number => {
  let k = from;
  while (k < code.length && SPACE.test(unitAt(code, k))) k++;
  return k;
});

const cookMatches = (text: string, oneCaptureGroup: RegExp, cook: (match: string) => string): string =>
  A.join(
    A.map(Str.split(oneCaptureGroup)(text), (part, index) => (index % 2 === 1 ? cook(part) : part)),
    ""
  );

/**
 * Reads complete raw identifier tokens, including escaped and malformed continuations.
 *
 * **Example** (Retain an escaped token's raw width)
 *
 * ```ts
 * import { identifierTokens } from "@beep/repo-workspaces/internal/sourceText";
 *
 * for (const token of identifierTokens("stdout.wr\\u0069te")) console.log(token.index, token[0]);
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const identifierTokens = (code: string): ReadonlyArray<RegExpExecArray> => {
  const tokens: Array<RegExpExecArray> = [];
  const pattern = new RegExp(IDENTIFIER_TOKEN);
  for (let token = pattern.exec(code); token !== null; token = pattern.exec(code)) tokens.push(token);
  return tokens;
};

/**
 * Reads a complete raw identifier beginning exactly at a UTF-16 offset.
 *
 * **Example** (Read an escaped identifier)
 *
 * ```ts
 * import { identifierAt } from "@beep/repo-workspaces/internal/sourceText";
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
  const pattern = new RegExp(IDENTIFIER_TOKEN.source, "uy");
  pattern.lastIndex = at;
  return pattern.exec(code)?.[0];
});

/**
 * Tests whether `char` can continue an identifier.
 *
 * **Example** (Recognize identifier continuations)
 *
 * ```ts
 * import { isIdentifierChar } from "@beep/repo-workspaces/internal/sourceText";
 *
 * console.log(isIdentifierChar("$")) // true
 * console.log(isIdentifierChar(undefined)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isIdentifierChar = (char: string | undefined): char is string =>
  char !== undefined && IDENTIFIER.test(char);

/**
 * Reads a complete code point starting at a UTF-16 offset, for string and lexer-buffer lookups.
 *
 * **Example** (Read a surrogate pair from text and a lexer buffer)
 *
 * ```ts
 * import { codePointAt } from "@beep/repo-workspaces/internal/sourceText";
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
  return first !== undefined && second !== undefined && HIGH_SURROGATE.test(first) && LOW_SURROGATE.test(second)
    ? first + second
    : first;
});

/**
 * Reads a complete code point ending just before a UTF-16 offset.
 *
 * **Example** (Read the code point before a boundary)
 *
 * ```ts
 * import { codePointBefore } from "@beep/repo-workspaces/internal/sourceText";
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
  return first !== undefined && last !== undefined && HIGH_SURROGATE.test(first) && LOW_SURROGATE.test(last)
    ? first + last
    : last;
});

const isLineTerminator = (char: string | undefined): boolean =>
  char === "\n" || char === "\r" || char === "\u2028" || char === "\u2029";

const classStateAfter = (inClass: boolean, char: string): boolean => (inClass ? char !== "]" : char === "[");

class Lexer {
  readonly kept: Array<string> = [];
  readonly code: Array<string> = [];
  readonly literals: Array<SourceLiteral.Encoded> = [];
  readonly substitutions: Array<number> = [];
  readonly parens: Array<string | undefined> = [];
  readonly controlCloses = MutableHashSet.empty<number>();
  readonly text: string;
  readonly length: number;
  i = 0;

  constructor(text: string) {
    this.text = text;
    this.length = text.length;
  }

  run(): LexedSource {
    if (Str.startsWith("#!")(this.text)) this.lineComment();
    while (this.i < this.length) this.step();
    return LexedSource.make({
      withoutComments: A.join(this.kept, ""),
      code: A.join(this.code, ""),
      literals: this.literals,
    });
  }

  at(at: number): string {
    return unitAt(this.text, at);
  }

  codeAt(at: number): string {
    return O.getOrElse(A.get(this.code, at), () => "");
  }

  emit(char: string, keepInCommentFreeView: boolean, keepInCodeView: boolean): void {
    const blank = isLineTerminator(char) ? char : " ";
    this.kept.push(keepInCommentFreeView ? char : blank);
    this.code.push(keepInCodeView ? char : blank);
  }

  plain(char: string): void {
    this.emit(char, true, true);
    this.i++;
  }

  step(): void {
    const char = this.at(this.i);
    if (char === "/") this.slash();
    else if (char === '"' || char === "'") this.string(char);
    else if (char === "`") this.template();
    else this.punctuation(char);
  }

  slash(): void {
    const next = this.at(this.i + 1);
    if (next === "/") this.lineComment();
    else if (next === "*") this.blockComment();
    else if (!(this.regexAllowed() && this.regex())) this.plain("/");
  }

  punctuation(char: string): void {
    if (char === "(") this.openParen();
    else if (char === ")") this.closeParen();
    else if (char === "{") this.openBrace();
    else if (char === "}") this.closeBrace();
    else this.plain(char);
  }

  lineComment(): void {
    while (this.i < this.length && !isLineTerminator(this.at(this.i))) {
      this.emit(this.at(this.i), false, false);
      this.i++;
    }
  }

  blockComment(): void {
    const body = this.i + 2;
    const end = O.match(Str.indexOf("*/")(Str.slice(body)(this.text)), {
      onNone: () => this.length,
      onSome: (offset) => body + offset + 2,
    });
    while (this.i < end) {
      this.emit(this.at(this.i), false, false);
      this.i++;
    }
  }

  openParen(): void {
    this.parens.push(this.opensCondition());
    this.plain("(");
  }

  closeParen(): void {
    if (this.parens.pop() !== undefined) MutableHashSet.add(this.controlCloses, this.code.length);
    this.plain(")");
  }

  openBrace(): void {
    const depth = A.last(this.substitutions);
    if (O.isSome(depth)) this.substitutions[this.substitutions.length - 1] = depth.value + 1;
    this.plain("{");
  }

  closeBrace(): void {
    const depth = A.last(this.substitutions);
    this.plain("}");
    if (O.isNone(depth)) return;
    if (depth.value > 0) {
      this.substitutions[this.substitutions.length - 1] = depth.value - 1;
      return;
    }
    this.substitutions.pop();
    if (this.templateText() === "substitution") this.substitutions.push(0);
  }

  template(): void {
    const start = this.i;
    this.plain("`");
    const stop = this.templateText();
    if (stop === "end") this.literals.push({ start, value: Str.slice(start + 1, this.i - 1)(this.text) });
    else if (stop === "substitution") this.substitutions.push(0);
  }

  lastCode(from: number): number {
    let j = from;
    while (j >= 0 && SPACE.test(this.codeAt(j))) j--;
    return j;
  }

  wordAt(end: number): string {
    let start = end;
    let point = codePointBefore(this.code, start + 1);
    while (start >= 0 && isIdentifierChar(point)) {
      start -= point.length;
      point = codePointBefore(this.code, start + 1);
    }
    return pipe(this.code, A.take(end + 1), A.drop(start + 1), A.join(""));
  }

  isSpread(j: number): boolean {
    return this.codeAt(j - 1) === "." && this.codeAt(j - 2) === ".";
  }

  endsBinding(j: number): boolean {
    const char = this.codeAt(j);
    if (char === "]" || char === "}") return true;
    return (
      isIdentifierChar(codePointBefore(this.code, j + 1)) &&
      !MutableHashSet.has(DECLARATIONS, this.wordAt(j)) &&
      !this.isRegexKeyword(j)
    );
  }

  isRegexKeyword(j: number): boolean {
    const word = this.wordAt(j);
    if (!MutableHashSet.has(REGEX_AFTER, word)) return false;
    const before = this.lastCode(j - word.length);
    if (this.codeAt(before) === "." && !this.isSpread(before)) return false;
    if (word === "of") return O.contains(A.last(this.parens), "for") && before >= 0 && this.endsBinding(before);
    return true;
  }

  endsOperand(j: number): boolean {
    const char = this.codeAt(j);
    if (char === ")") return !MutableHashSet.has(this.controlCloses, j);
    return char === "]" || (isIdentifierChar(codePointBefore(this.code, j + 1)) && !this.isRegexKeyword(j));
  }

  regexAfterBang(j: number): boolean {
    let operand = this.lastCode(j - 1);
    while (this.codeAt(operand) === "!") operand = this.lastCode(operand - 1);
    return !this.endsOperand(operand);
  }

  regexAllowed(): boolean {
    const j = this.lastCode(this.code.length - 1);
    if (j < 0) return true;
    const last = this.codeAt(j);
    if (isIdentifierChar(codePointBefore(this.code, j + 1))) return this.isRegexKeyword(j);
    if (last === "!") return this.regexAfterBang(j);
    if ((last === "+" || last === "-") && this.codeAt(j - 1) === last) return !this.endsOperand(this.lastCode(j - 2));
    if (last === ")") return MutableHashSet.has(this.controlCloses, j);
    return !Str.includes(last)("]}\"'`");
  }

  conditionWord(j: number): readonly [word: string, before: number] {
    const word = this.wordAt(j);
    const end = j - word.length;
    if (word !== "await") return [word, end];
    const back = this.lastCode(end);
    const outer = back < 0 ? "" : this.wordAt(back);
    return [outer, back - outer.length];
  }

  opensCondition(): string | undefined {
    const j = this.lastCode(this.code.length - 1);
    if (j < 0 || !isIdentifierChar(codePointBefore(this.code, j + 1))) return undefined;
    const [word, end] = this.conditionWord(j);
    return MutableHashSet.has(CONTROL, word) && this.codeAt(this.lastCode(end)) !== "." ? word : undefined;
  }

  regexEnd(): number {
    let inClass = false;
    for (let j = this.i + 1; j < this.length; j++) {
      const char = this.at(j);
      if (isLineTerminator(char)) return -1;
      if (char === "/" && !inClass) return j;
      if (char === "\\") j++;
      inClass = classStateAfter(inClass, char);
    }
    return -1;
  }

  regex(): boolean {
    const end = this.regexEnd();
    if (end < 0) return false;
    this.emit("/", true, true);
    for (let k = this.i + 1; k < end; k++) this.emit(this.at(k), true, false);
    this.emit("/", true, true);
    this.i = end + 1;
    while (this.i < this.length && FLAG.test(this.at(this.i))) this.plain(this.at(this.i));
    return true;
  }

  escape(): void {
    this.emit("\\", true, false);
    this.i++;
    if (this.i >= this.length) return;
    const escaped = this.at(this.i);
    this.emit(escaped, true, false);
    this.i++;
    if (escaped === "\r" && this.at(this.i) === "\n") {
      this.emit("\n", true, false);
      this.i++;
    }
  }

  string(quote: string): void {
    const start = this.i;
    this.plain(quote);
    while (this.i < this.length) {
      const char = this.at(this.i);
      if (char === "\\") {
        this.escape();
        continue;
      }
      if (char === quote) {
        this.closeString(start, quote);
        return;
      }
      if (char === "\n" || char === "\r") return;
      this.emit(char, true, false);
      this.i++;
    }
  }

  closeString(start: number, quote: string): void {
    this.plain(quote);
    this.literals.push({ start, value: Str.slice(start + 1, this.i - 1)(this.text) });
  }

  templateText(): "end" | "substitution" | "eof" {
    while (this.i < this.length) {
      const char = this.at(this.i);
      if (char === "\\") {
        this.escape();
        continue;
      }
      if (char === "`") return this.closeTemplate();
      if (char === "$" && this.at(this.i + 1) === "{") return this.openSubstitution();
      this.emit(char, true, false);
      this.i++;
    }
    return "eof";
  }

  closeTemplate(): "end" {
    this.plain("`");
    return "end";
  }

  openSubstitution(): "substitution" {
    this.plain("$");
    this.plain("{");
    return "substitution";
  }
}

/**
 * Lexes `text` once into its comment-free view, its code-only view and its literals.
 *
 * **Example** (Inspect aligned views and raw literals)
 *
 * ```ts
 * import { lex } from "@beep/repo-workspaces/internal/sourceText";
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
export const lex = (text: string): LexedSource => new Lexer(text).run();

const isSpreadAt = (code: string, j: number): boolean => unitAt(code, j - 1) === "." && unitAt(code, j - 2) === ".";

const receiverEnd = (code: string, dot: number): number =>
  skipSpaceBack(code, unitAt(code, dot - 1) === "?" ? dot - 2 : dot - 1);

const isPropertyKey = (code: string, before: number, after: number): boolean => {
  if (before < 0 || !Str.includes(unitAt(code, before))("{,;")) return false;
  let k = skipSpaceForward(code, after);
  if (unitAt(code, k) === "?") k = skipSpaceForward(code, k + 1);
  return unitAt(code, k) === ":";
};

const cooksTo = (raw: string, name: string): boolean => O.contains(cookIdentifier(raw), name);

const isReference = (code: string, token: RegExpExecArray, name: string): boolean => {
  const at = token.index;
  if (!cooksTo(token[0], name) || unitAt(code, at - 1) === "#") return false;
  const j = skipSpaceBack(code, at - 1);
  if (unitAt(code, j) !== ".") return !isPropertyKey(code, j, at + token[0].length);
  return isSpreadAt(code, j) || isGlobalReceiver(code, receiverEnd(code, j));
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
 * import { lex, references } from "@beep/repo-workspaces/internal/sourceText";
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
} = dual(
  2,
  (code: string, name: string): ReadonlyArray<number> =>
    pipe(
      identifierTokens(code),
      A.filter((token) => isReference(code, token, name)),
      A.map((token) => token.index)
    )
);

const braceEscapeStart = (code: string, start: number): number =>
  O.match(Str.lastIndexOf("\\u{")(Str.slice(0, start + 2)(code)), {
    onNone: () => start,
    onSome: (opening) => (/^[^\s{}]*$/u.test(Str.slice(opening + 3, start - 1)(code)) ? opening : start),
  });

const unitStartBefore = (code: string, start: number): number => {
  if (start <= 0) return start;
  const point = codePointBefore(code, start);
  if (isIdentifierChar(point)) return start - point.length;
  const previous = unitAt(code, start - 1);
  if (previous === "\\") return start - 1;
  if (previous === "}") return braceEscapeStart(code, start);
  return previous === "{" && Str.slice(start - 3, start - 1)(code) === "\\u" ? start - 3 : start;
};

const identifierStartBefore = (code: string, end: number): number => {
  let start = end;
  let next = unitStartBefore(code, start);
  while (next < start) {
    start = next;
    next = unitStartBefore(code, start);
  }
  return start;
};

const isGlobalObject = (raw: string): boolean =>
  O.exists(cookIdentifier(raw), (receiver) => MutableHashSet.has(GLOBAL_OBJECTS, receiver));

const isGlobalReceiver = (code: string, end: number): boolean => {
  let cursor = end;
  while (cursor >= 0) {
    const start = identifierStartBefore(code, cursor + 1);
    if (!isGlobalObject(Str.slice(start, cursor + 1)(code))) return false;
    const before = skipSpaceBack(code, start - 1);
    if (unitAt(code, before) === "#") return false;
    if (unitAt(code, before) !== "." || isSpreadAt(code, before)) return true;
    cursor = receiverEnd(code, before);
  }
  return false;
};

const wordEndingAt = (code: string, end: number): string => {
  const j = skipSpaceBack(code, end);
  const start = identifierStartBefore(code, j + 1);
  const mark = unitAt(code, skipSpaceBack(code, start - 1));
  return mark === "." || mark === "#" ? "" : O.getOrElse(cookIdentifier(Str.slice(start, j + 1)(code)), () => "");
};

const cookUnicodeEscape = (escape: string): string => {
  const digits = unitAt(escape, 2) === "{" ? Str.slice(3, -1)(escape) : Str.slice(2)(escape);
  const point = Number.parseInt(digits, 16);
  return point <= 0x10ffff ? String.fromCodePoint(point) : escape;
};

/**
 * Cooks Unicode identifier escapes; malformed or non-identifier escapes match no name.
 *
 * **Example** (Cook a Unicode member spelling)
 *
 * ```ts
 * import * as O from "effect/Option";
 * import { cookIdentifier } from "@beep/repo-workspaces/internal/sourceText";
 *
 * console.log(O.getOrUndefined(cookIdentifier("wr\\u0069te"))) // write
 * console.log(O.isNone(cookIdentifier("\\u0020"))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const cookIdentifier = (raw: string): O.Option<string> =>
  O.liftPredicate(cookMatches(raw, UNICODE_ESCAPE, cookUnicodeEscape), (cooked) => IDENTIFIER_NAME.test(cooked));

const STRING_ESCAPES: Readonly<Record<string, string>> = {
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
};

const cookStringEscape = (escape: string): string => {
  const value = Str.slice(1)(escape);
  const head = unitAt(value, 0);
  if (isLineTerminator(head)) return "";
  if (head === "x") return String.fromCharCode(Number.parseInt(Str.slice(1)(value), 16));
  if (head === "u") return cookUnicodeEscape(escape);
  if (/^[0-7]/u.test(value)) return String.fromCharCode(Number.parseInt(value, 8));
  return O.getOrElse(R.get(STRING_ESCAPES, value), () => value);
};

const cookSpecifier = (raw: string): string =>
  cookMatches(Str.replace(/\r\n?/gu, "\n")(raw), STRING_ESCAPE, cookStringEscape);

const isCallArgument = (code: string, literal: SourceLiteral, paren: number): boolean => {
  const end = skipSpaceBack(code, paren - 1);
  const optional = unitAt(code, end) === "." && unitAt(code, end - 1) === "?";
  const callee = wordEndingAt(code, optional ? end - 2 : end);
  if (callee !== "require" && (optional || callee !== "import")) return false;
  const close = unitAt(code, skipSpaceForward(code, literal.start + literal.value.length + 2));
  return close === ")" || close === ",";
};

const isSpecifierLiteral = (code: string, literal: SourceLiteral): boolean => {
  const j = skipSpaceBack(code, literal.start - 1);
  if (unitAt(code, j) === "(") return isCallArgument(code, literal, j);
  const keyword = wordEndingAt(code, j);
  return keyword === "from" || keyword === "import";
};

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
 * import { lex, specifierLiterals } from "@beep/repo-workspaces/internal/sourceText";
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
  pipe(
    lexed.literals,
    A.filter((literal) => isSpecifierLiteral(lexed.code, literal)),
    A.map((literal) => SourceLiteral.make({ start: literal.start, value: cookSpecifier(literal.value) }))
  );

/**
 * Builds a lookup from an offset in `text` to its 1-based line and UTF-16 column.
 *
 * **Example** (Locate text after a CRLF line break)
 *
 * ```ts
 * import { locate } from "@beep/repo-workspaces/internal/sourceText";
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
