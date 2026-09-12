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

const readString = (cursor: Cursor): string => {
  const text = cursor.text;
  let index = cursor.index + 1;
  let start = index;
  let out = "";
  while (true) {
    const code = text.charCodeAt(index);
    if (Number.isNaN(code)) {
      cursor.index = index;
      return cursor.fail("Unterminated string");
    }
    if (code === QUOTATION_MARK) {
      cursor.index = index + 1;
      return out + text.slice(start, index);
    }
    if (code === REVERSE_SOLIDUS) {
      out += text.slice(start, index);
      const escape = text.charCodeAt(index + 1);
      if (escape === LATIN_SMALL_U) {
        const hex = text.slice(index + 2, index + 6);
        if (!unicodeEscapePattern.test(hex)) {
          cursor.index = index;
          return cursor.fail("Invalid unicode escape sequence");
        }
        out += String.fromCharCode(Number.parseInt(hex, 16));
        index += 6;
      } else {
        out += O.getOrElse(HashMap.get(singleCharacterEscapes, escape), () => {
          cursor.index = index;
          return cursor.fail("Invalid escape sequence");
        });
        index += 2;
      }
      start = index;
      continue;
    }
    if (code < SPACE) {
      cursor.index = index;
      return cursor.fail(`Unescaped control character ${describeCharacter(code)} in string`);
    }
    index += 1;
  }
};

const readArray = (cursor: Cursor): ReadonlyArray<unknown> => {
  cursor.enter();
  cursor.index += 1;
  const items = A.empty<unknown>();
  cursor.skipWhitespace();
  if (cursor.peek() === RIGHT_BRACKET) {
    cursor.index += 1;
    cursor.leave();
    return items;
  }
  while (true) {
    A.appendInPlace(items, readValue(cursor));
    cursor.skipWhitespace();
    const code = cursor.peek();
    if (code === COMMA) {
      cursor.index += 1;
      continue;
    }
    if (code === RIGHT_BRACKET) {
      cursor.index += 1;
      cursor.leave();
      return items;
    }
    return cursor.fail("Expected , or ] after array element");
  }
};

const readObject = (cursor: Cursor): Record<string, unknown> => {
  cursor.enter();
  cursor.index += 1;
  const out: Record<string, unknown> = {};
  cursor.skipWhitespace();
  if (cursor.peek() === RIGHT_BRACE) {
    cursor.index += 1;
    cursor.leave();
    return out;
  }
  while (true) {
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
    assignOwnProperty(out, key, readValue(cursor));
    cursor.skipWhitespace();
    const code = cursor.peek();
    if (code === COMMA) {
      cursor.index += 1;
      continue;
    }
    if (code === RIGHT_BRACE) {
      cursor.index += 1;
      cursor.leave();
      return out;
    }
    return cursor.fail("Expected , or } after property value");
  }
};

const readValue = (cursor: Cursor): unknown => {
  cursor.skipWhitespace();
  const code = cursor.peek();
  switch (code) {
    case LEFT_BRACE:
      return readObject(cursor);
    case LEFT_BRACKET:
      return readArray(cursor);
    case QUOTATION_MARK:
      return readString(cursor);
    case LATIN_SMALL_T:
      return readLiteral(cursor, "true", true);
    case LATIN_SMALL_F:
      return readLiteral(cursor, "false", false);
    case LATIN_SMALL_N:
      return readLiteral(cursor, "null", null);
    default:
      if (code === HYPHEN_MINUS || isDigit(code)) {
        return readNumber(cursor);
      }
      return cursor.fail(
        Number.isNaN(code) ? "Unexpected end of JSON text" : `Unexpected character ${describeCharacter(code)}`
      );
  }
};

const isJsonTextSyntaxError = S.is(JsonTextSyntaxError);

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
    let escaped = false;
    let end = index + 1;
    while (end < Str.length(text)) {
      const code = text.charCodeAt(end);
      if (code === REVERSE_SOLIDUS) {
        escaped = true;
        end += 2;
        continue;
      }
      if (code === QUOTATION_MARK) {
        break;
      }
      end += 1;
    }
    if (end >= Str.length(text)) {
      return false;
    }
    if (escaped) {
      let next = end + 1;
      while (isWhitespace(text.charCodeAt(next))) {
        next += 1;
      }
      if (text.charCodeAt(next) === COLON) {
        return true;
      }
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
export const readJsonText = (text: string): Result.Result<unknown, JsonTextSyntaxError> => {
  if (hasEscapedPropertyKey(text)) {
    return readStrict(text);
  }
  try {
    // Native parsing is only unsafe for escaped property keys, and this text has none.
    return Result.succeed(JSON.parse(text));
  } catch {
    // Re-read strictly so the failure carries a position instead of a host-specific message.
    return readStrict(text);
  }
};

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
 * import * as Schema from "effect/Schema"
 *
 * const codec = fromJsonText(Schema.Record(Schema.String, Schema.Boolean))
 * const encoded = Schema.encodeSync(codec)({ "\n": true })
 * console.log(Schema.decodeSync(codec)(encoded)) // { "\n": true }
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const fromJsonText = <Target extends S.Constraint>(schema: Target): S.decodeTo<Target, S.String> =>
  JsonText.pipe(S.decodeTo(schema, { decode: decodeJsonTextGetter, encode: SchemaGetter.stringifyJson() }));
