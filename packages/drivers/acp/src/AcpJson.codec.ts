/**
 * JSON text codec for the ACP wire boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as R from "@beep/utils/Record";
import * as Effect from "effect/Effect";
import { constant, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Str from "effect/String";

const $I = $AcpId.create("json");

const QUOTATION_MARK = '"';
const REVERSE_SOLIDUS = "\\";
const SOLIDUS = "/";
const COLON = ":";
const COMMA = ",";
const LEFT_BRACE = "{";
const RIGHT_BRACE = "}";
const LEFT_BRACKET = "[";
const RIGHT_BRACKET = "]";
const HYPHEN_MINUS = "-";
const DIGIT_ZERO = "0";
const DIGIT_NINE = "9";
const SPACE = " ";
const CHARACTER_TABULATION = "\t";
const LINE_FEED = "\n";
const CARRIAGE_RETURN = "\r";
const LATIN_SMALL_B = "b";
const LATIN_SMALL_F = "f";
const LATIN_SMALL_N = "n";
const LATIN_SMALL_R = "r";
const LATIN_SMALL_T = "t";
const LATIN_SMALL_U = "u";
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

const isWhitespace = (code: string | undefined): boolean =>
  code === SPACE || code === LINE_FEED || code === CARRIAGE_RETURN || code === CHARACTER_TABULATION;
const isDigit = (code: string | undefined): boolean => code !== undefined && code >= DIGIT_ZERO && code <= DIGIT_NINE;
const describeCharacter = (code: string): string =>
  `U+${pipe(O.getOrElse(Str.charCodeAt(0)(code), constant(0)).toString(16), Str.toUpperCase, Str.padStart(4, "0"))}`;

/**
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
export class JsonTextSyntaxError extends S.TaggedError<JsonTextSyntaxError, { readonly brand: unique symbol }>(
  $I`JsonTextSyntaxError`
)(
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

  peek(): string | undefined {
    return this.text[this.index];
  }

  fail(reason: string): never {
    throw JsonTextSyntaxError.make({ position: this.index, reason });
  }

  skipWhitespace(): void {
    while (isWhitespace(this.text[this.index])) {
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

const readEscapeSequence = (cursor: Cursor, index: number): readonly [decoded: string, next: number] => {
  const text = cursor.text;
  const escape = text[index + 1];
  if (escape === LATIN_SMALL_U) {
    const hex = pipe(text, Str.slice(index + 2, index + 6));
    if (!unicodeEscapePattern.test(hex)) {
      cursor.index = index;
      return cursor.fail("Invalid unicode escape sequence");
    }
    return [String.fromCharCode(Number.parseInt(hex, 16)), index + 6];
  }
  return O.match(escape === undefined ? O.none() : HashMap.get(singleCharacterEscapes, escape), {
    onNone: () => {
      cursor.index = index;
      return cursor.fail("Invalid escape sequence");
    },
    onSome: (decoded) => [decoded, index + 2],
  });
};

const ensureStringCharacter = (cursor: Cursor, index: number, code: string | undefined): void => {
  if (code === undefined || code < SPACE) {
    cursor.index = index;
    cursor.fail(
      code === undefined ? "Unterminated string" : `Unescaped control character ${describeCharacter(code)} in string`
    );
  }
};

const readString = (cursor: Cursor): string => {
  const text = cursor.text;
  let index = cursor.index + 1;
  let start = index;
  let out = "";
  while (true) {
    const code = text[index];
    if (code === QUOTATION_MARK) {
      cursor.index = index + 1;
      return out + pipe(text, Str.slice(start, index));
    }
    if (code === REVERSE_SOLIDUS) {
      const [decoded, next] = readEscapeSequence(cursor, index);
      out += pipe(text, Str.slice(start, index)) + decoded;
      index = next;
      start = next;
      continue;
    }
    ensureStringCharacter(cursor, index, code);
    index += 1;
  }
};

const readSeparator = (cursor: Cursor, closing: string, expected: string): boolean => {
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
    R.setOwnProperty(out, key, readValue(cursor));
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
  return O.match(code === undefined ? O.none() : HashMap.get(valueReaders, code), {
    onNone: () =>
      cursor.fail(
        code === undefined ? "Unexpected end of JSON text" : `Unexpected character ${describeCharacter(code)}`
      ),
    onSome: (read) => read(cursor),
  });
};

const isJsonTextSyntaxError = S.is(JsonTextSyntaxError);
const decodeNativeJsonText = S.decodeResult(S.fromJsonString(S.Unknown));

const readStrict = (text: string): Result.Result<unknown, JsonTextSyntaxError> => {
  const cursor = new Cursor(text);
  return Result.try(() => {
    const value = readValue(cursor);
    cursor.skipWhitespace();
    if (cursor.index < Str.length(text)) {
      return cursor.fail("Unexpected trailing content after JSON value");
    }
    return value;
  }).pipe(
    Result.match({
      onSuccess: Result.succeed,
      onFailure: (error) => (isJsonTextSyntaxError(error) ? Result.fail(error) : Result.getOrThrow(Result.fail(error))),
    })
  );
};

const scanString = (text: string, start: number): readonly [end: number, escaped: boolean] => {
  let escaped = false;
  let end = start + 1;
  while (end < Str.length(text)) {
    const code = text[end];
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
  while (isWhitespace(text[next])) {
    next += 1;
  }
  return text[next] === COLON;
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
  let index = 0;
  while (index < Str.length(text)) {
    if (text[index] !== QUOTATION_MARK) {
      index += 1;
      continue;
    }
    const [end, escaped] = scanString(text, index);
    if (end === -1) {
      return false;
    }
    if (escaped && isPropertyKeyEnd(text, end)) {
      return true;
    }
    index = end + 1;
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
 * preserved, numbers go through `Number`). A text the native parser rejects is read again by the
 * strict reader, so the failure carries a position instead of a host-specific message.
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
        onSuccess: Result.succeed,
        onFailure: () => readStrict(text),
      });

const JsonText = S.String.annotate({
  expected: "a JSON text",
  contentMediaType: "application/json",
});

const decodeJsonTextGetter = SchemaGetter.transformEffect<unknown, string>((input, options) =>
  Result.match(readJsonText(input), {
    onFailure: (error) =>
      Effect.fail(new SchemaIssue.InvalidValue({ expected: "a JSON text", message: error.message }, input, options)),
    onSuccess: Effect.succeed,
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
