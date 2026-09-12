/**
 * JSON text codec for the ACP wire boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Str from "effect/String";

const $I = $AcpId.create("json");

// UTF-16 code units of the JSON structural, whitespace, and escape characters (RFC 8259).
const QUOTATION_MARK = 0x22;
const REVERSE_SOLIDUS = 0x5c;
const SOLIDUS = 0x2f;
const COLON = 0x3a;
const COMMA = 0x2c;
const LEFT_BRACE = 0x7b;
const RIGHT_BRACE = 0x7d;
const LEFT_BRACKET = 0x5b;
const RIGHT_BRACKET = 0x5d;
const HYPHEN_MINUS = 0x2d;
const DIGIT_ZERO = 0x30;
const DIGIT_NINE = 0x39;
const SPACE = 0x20;
const CHARACTER_TABULATION = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const LATIN_SMALL_B = 0x62;
const LATIN_SMALL_F = 0x66;
const LATIN_SMALL_N = 0x6e;
const LATIN_SMALL_R = 0x72;
const LATIN_SMALL_T = 0x74;
const LATIN_SMALL_U = 0x75;
const MAX_DEPTH = 1024;
const numberPattern = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
const unicodeEscapePattern = /^[0-9a-fA-F]{4}$/;
const singleCharacterEscapes = HashMap.make(
  [QUOTATION_MARK, '"'],
  [REVERSE_SOLIDUS, "\\"],
  [SOLIDUS, "/"],
  [LATIN_SMALL_B, "\b"],
  [LATIN_SMALL_F, "\f"],
  [LATIN_SMALL_N, "\n"],
  [LATIN_SMALL_R, "\r"],
  [LATIN_SMALL_T, "\t"]
);

const isWhitespace = (code: number): boolean =>
  code === SPACE || code === LINE_FEED || code === CARRIAGE_RETURN || code === CHARACTER_TABULATION;
const isDigit = (code: number): boolean => code >= DIGIT_ZERO && code <= DIGIT_NINE;
const describeCharacter = (code: number): string => `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;

/**
 * Failure raised when a JSON text does not satisfy the JSON grammar.
 *
 * **Example** (Describe a syntax failure)
 *
 * ```ts
 * import { JsonTextSyntaxError } from "@beep/acp/json"
 *
 * const error = JsonTextSyntaxError.make({ position: 3, reason: "Expected , or ] after array element" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsonTextSyntaxError extends S.TaggedError<JsonTextSyntaxError>($I`JsonTextSyntaxError`)(
  "JsonTextSyntaxError",
  {
    position: S.Int.annotateKey({
      description: "Zero-based UTF-16 offset at which reading stopped.",
    }),
    reason: S.String.annotateKey({
      description: "Human-readable description of the violated JSON grammar rule.",
    }),
  },
  $I.annoteError<JsonTextSyntaxError>("JsonTextSyntaxError", {
    description: "Failure raised when a JSON text does not satisfy the JSON grammar.",
  })
) {
  override get message() {
    return `Invalid JSON text at position ${this.position}: ${this.reason}`;
  }
}

class Cursor {
  readonly text: string;
  index = 0;
  depth = 0;

  constructor(text: string) {
    this.text = text;
  }

  peek(): number {
    return this.text.charCodeAt(this.index);
  }

  fail(reason: string): never {
    throw JsonTextSyntaxError.make({ position: this.index, reason });
  }

  skipWhitespace(): void {
    while (isWhitespace(this.text.charCodeAt(this.index))) {
      this.index += 1;
    }
  }

  enter(): void {
    this.depth += 1;
    if (this.depth > MAX_DEPTH) {
      this.fail(`Nesting depth exceeds ${MAX_DEPTH}`);
    }
  }

  leave(): void {
    this.depth -= 1;
  }
}

const assignOwnProperty = (target: Record<string, unknown>, key: string, value: unknown): void => {
  if (key === "__proto__") {
    Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
  } else {
    target[key] = value;
  }
};

const readLiteral = <A>(cursor: Cursor, literal: string, value: A): A => {
  if (!Str.startsWith(literal, cursor.index)(cursor.text)) {
    return cursor.fail(`Expected ${literal}`);
  }
  cursor.index += Str.length(literal);
  return value;
};

const readNumber = (cursor: Cursor): number => {
  numberPattern.lastIndex = cursor.index;
  return O.match(O.fromNullishOr(numberPattern.exec(cursor.text)), {
    onNone: () => cursor.fail("Invalid number"),
    onSome: ([token]) => {
      cursor.index += Str.length(token);
      return Number(token);
    },
  });
};

// Reads the escape sequence starting at the reverse solidus at `index`; returns the decoded text
// and the index just past the sequence.
const readEscapeSequence = (cursor: Cursor, index: number): readonly [decoded: string, next: number] => {
  const text = cursor.text;
  const escape = text.charCodeAt(index + 1);
  if (escape === LATIN_SMALL_U) {
    const hex = text.slice(index + 2, index + 6);
    if (!unicodeEscapePattern.test(hex)) {
      cursor.index = index;
      return cursor.fail("Invalid unicode escape sequence");
    }
    return [String.fromCharCode(Number.parseInt(hex, 16)), index + 6];
  }
  return O.match(HashMap.get(singleCharacterEscapes, escape), {
    onNone: () => {
      cursor.index = index;
      return cursor.fail("Invalid escape sequence");
    },
    onSome: (decoded) => [decoded, index + 2],
  });
};

// Rejects the end of text and unescaped control characters inside a string.
const ensureStringCharacter = (cursor: Cursor, index: number, code: number): void => {
  if (Number.isNaN(code) || code < SPACE) {
    cursor.index = index;
    cursor.fail(
      Number.isNaN(code) ? "Unterminated string" : `Unescaped control character ${describeCharacter(code)} in string`
    );
  }
};

const readString = (cursor: Cursor): string => {
  const text = cursor.text;
  let index = cursor.index + 1;
  let start = index;
  let out = "";
  while (true) {
    const code = text.charCodeAt(index);
    if (code === QUOTATION_MARK) {
      cursor.index = index + 1;
      return out + text.slice(start, index);
    }
    if (code === REVERSE_SOLIDUS) {
      const [decoded, next] = readEscapeSequence(cursor, index);
      out += text.slice(start, index) + decoded;
      index = next;
      start = next;
      continue;
    }
    ensureStringCharacter(cursor, index, code);
    index += 1;
  }
};

// Consumes the separator after an element; returns whether `closing` ended the collection.
const readSeparator = (cursor: Cursor, closing: number, expected: string): boolean => {
  cursor.skipWhitespace();
  const code = cursor.peek();
  if (code === COMMA || code === closing) {
    cursor.index += 1;
    return code === closing;
  }
  return cursor.fail(expected);
};

const readArray = (cursor: Cursor): ReadonlyArray<unknown> => {
  cursor.enter();
  cursor.index += 1;
  const items = A.empty<unknown>();
  cursor.skipWhitespace();
  let closed = cursor.peek() === RIGHT_BRACKET;
  if (closed) {
    cursor.index += 1;
  }
  while (!closed) {
    A.appendInPlace(items, readValue(cursor));
    closed = readSeparator(cursor, RIGHT_BRACKET, "Expected , or ] after array element");
  }
  cursor.leave();
  return items;
};

const readMemberKey = (cursor: Cursor): string => {
  cursor.skipWhitespace();
  if (cursor.peek() !== QUOTATION_MARK) {
    return cursor.fail("Expected string property key");
  }
  const key = readString(cursor);
  cursor.skipWhitespace();
  if (cursor.peek() !== COLON) {
    return cursor.fail("Expected : after property key");
  }
  cursor.index += 1;
  return key;
};

const readObject = (cursor: Cursor): Record<string, unknown> => {
  cursor.enter();
  cursor.index += 1;
  const out: Record<string, unknown> = {};
  cursor.skipWhitespace();
  let closed = cursor.peek() === RIGHT_BRACE;
  if (closed) {
    cursor.index += 1;
  }
  while (!closed) {
    const key = readMemberKey(cursor);
    assignOwnProperty(out, key, readValue(cursor));
    closed = readSeparator(cursor, RIGHT_BRACE, "Expected , or } after property value");
  }
  cursor.leave();
  return out;
};

const valueReaders = HashMap.make(
  [LEFT_BRACE, (cursor: Cursor): unknown => readObject(cursor)],
  [LEFT_BRACKET, (cursor: Cursor): unknown => readArray(cursor)],
  [QUOTATION_MARK, (cursor: Cursor): unknown => readString(cursor)],
  [LATIN_SMALL_T, (cursor: Cursor): unknown => readLiteral(cursor, "true", true)],
  [LATIN_SMALL_F, (cursor: Cursor): unknown => readLiteral(cursor, "false", false)],
  [LATIN_SMALL_N, (cursor: Cursor): unknown => readLiteral(cursor, "null", null)]
);

const readValue = (cursor: Cursor): unknown => {
  cursor.skipWhitespace();
  const code = cursor.peek();
  if (code === HYPHEN_MINUS || isDigit(code)) {
    return readNumber(cursor);
  }
  return O.match(HashMap.get(valueReaders, code), {
    onNone: () =>
      cursor.fail(
        Number.isNaN(code) ? "Unexpected end of JSON text" : `Unexpected character ${describeCharacter(code)}`
      ),
    onSome: (read) => read(cursor),
  });
};

const isJsonTextSyntaxError = S.is(JsonTextSyntaxError);
const decodeNativeJsonText = S.decodeResult(S.fromJsonString(S.Unknown));

const readStrict = (text: string): Result.Result<unknown, JsonTextSyntaxError> => {
  const cursor = new Cursor(text);
  try {
    const value = readValue(cursor);
    cursor.skipWhitespace();
    if (cursor.index < Str.length(text)) {
      return cursor.fail("Unexpected trailing content after JSON value");
    }
    return Result.succeed(value);
  } catch (error) {
    if (isJsonTextSyntaxError(error)) {
      return Result.fail(error);
    }
    throw error;
  }
};

// Finds the closing quotation mark of the string opened at `start`; returns its index (or -1 when
// the string is unterminated) and whether the string contains an escape sequence.
const scanString = (text: string, start: number): readonly [end: number, escaped: boolean] => {
  let escaped = false;
  let end = start + 1;
  while (end < Str.length(text)) {
    const code = text.charCodeAt(end);
    if (code === QUOTATION_MARK) {
      return [end, escaped];
    }
    escaped = escaped || code === REVERSE_SOLIDUS;
    end += code === REVERSE_SOLIDUS ? 2 : 1;
  }
  return [-1, escaped];
};

const isPropertyKeyEnd = (text: string, end: number): boolean => {
  let next = end + 1;
  while (isWhitespace(text.charCodeAt(next))) {
    next += 1;
  }
  return text.charCodeAt(next) === COLON;
};

/**
 * Reports whether a JSON text contains an object property key with an escape sequence.
 *
 * **Details**
 *
 * The scan walks the text string by string: a string followed by optional whitespace and a colon
 * is a property key, and a key that contains a reverse solidus needs the strict reader. Strings in
 * value position are skipped, so escapes inside values never trigger the slow path.
 *
 * **Gotchas**
 *
 * The answer is only meaningful for texts that satisfy the JSON grammar; for any other text both
 * reader paths reject the input anyway.
 *
 * **Example** (Distinguish escaped keys from escaped values)
 *
 * ```ts
 * import { hasEscapedPropertyKey } from "@beep/acp/json"
 *
 * console.log(hasEscapedPropertyKey('{"\\n":true}')) // true
 * console.log(hasEscapedPropertyKey('{"line":"\\n"}')) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasEscapedPropertyKey = (text: string): boolean => {
  let index = text.indexOf('"');
  while (index !== -1) {
    const [end, escaped] = scanString(text, index);
    if (end === -1) {
      return false;
    }
    if (escaped && isPropertyKeyEnd(text, end)) {
      return true;
    }
    index = text.indexOf('"', end + 1);
  }
  return false;
};

/**
 * Reads a JSON text into a value without trusting the host parser for escaped property keys.
 *
 * **Details**
 *
 * V8 12.8 through 13.7 (Node 24, Electron 36 and 37) builds objects in `JSON.parse` through
 * existing map transitions: for each property it compares the raw source characters of the key,
 * truncated to the decoded length, against the transition keys of the current map and reuses a
 * matching transition key without decoding the escape sequence. After any object shaped
 * `{ "a": …, "\\": … }` has been materialised, the text `{"a":0,"\n":1}` therefore decodes with a
 * `"\\"` key. Texts without an escaped property key cannot hit that path and are parsed natively;
 * every other text is read by the strict reader in this module, which mirrors `JSON.parse`
 * semantics (last duplicate key wins, `__proto__` becomes an own property, lone surrogates are
 * preserved, numbers go through `Number`).
 *
 * **Gotchas**
 *
 * The strict reader bounds nesting at 1024 levels and reports deeper texts as a syntax failure,
 * while native parsing accepts deeper nesting for texts without escaped keys.
 *
 * **Example** (Read a text with an escaped key)
 *
 * ```ts
 * import { readJsonText } from "@beep/acp/json"
 * import * as Result from "effect/Result"
 *
 * const parsed = readJsonText('{"\\n":true}')
 * console.log(Result.isSuccess(parsed)) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const readJsonText = (text: string): Result.Result<unknown, JsonTextSyntaxError> =>
  hasEscapedPropertyKey(text)
    ? readStrict(text)
    : Result.match(decodeNativeJsonText(text), {
        // Native parsing is only unsafe for escaped property keys, and this text has none.
        onSuccess: Result.succeed,
        // Re-read strictly so the failure carries a position instead of a host-specific message.
        onFailure: () => readStrict(text),
      });

const JsonText = S.String.annotate({
  expected: "a JSON text",
  contentMediaType: "application/json",
});

const decodeJsonTextGetter = SchemaGetter.onSome<unknown, string>((input, options) =>
  Result.match(readJsonText(input), {
    onFailure: (error) =>
      Effect.fail(new SchemaIssue.InvalidValue({ expected: "a JSON text", message: error.message }, input, options)),
    onSuccess: Effect.succeedSome,
  })
);

/**
 * Builds a schema that decodes a JSON text with {@link readJsonText} before applying `schema`.
 *
 * **When to use**
 *
 * Use as the ACP replacement for `Schema.fromJsonString` wherever a JSON text can carry
 * `_meta` or extension keys with escape sequences, so decoding does not depend on the host
 * `JSON.parse` bug described on {@link readJsonText}. Encoding still uses `JSON.stringify`.
 *
 * **Example** (Round-trip a record with an escaped key)
 *
 * ```ts
 * import { fromJsonText } from "@beep/acp/json"
 * import * as S from "effect/Schema"
 *
 * const codec = fromJsonText(S.Record(S.String, S.Boolean))
 * const encoded = S.encodeSync(codec)({ "\n": true })
 * console.log(S.decodeSync(codec)(encoded)) // { "\n": true }
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const fromJsonText = <Target extends S.Constraint>(schema: Target): S.decodeTo<Target, S.String> =>
  JsonText.pipe(S.decodeTo(schema, { decode: decodeJsonTextGetter, encode: SchemaGetter.stringifyJson() }));
