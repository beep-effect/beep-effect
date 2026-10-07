// The `Jsonc` facade: parsing, comment stripping, semantic equality and the
// flagship schema factories, plus the parse-error vocabulary they raise.
//
// `Jsonc` is a namespace of statics over the internal parser and the schema
// layer, not itself a schema class. `parse`/`parseTree` and schema decoding
// carry a real `JsoncParseError` channel; `stripComments`/`equals`/
// `equalsValue` are pure total functions.
//
// Cycle firewall: the internal parser returns raw error records and this
// module maps them into `JsoncParseErrorDetail` (deriving `line`/`character`
// from `offset`) and builds the aggregate `JsoncParseError`. The dependency
// edge runs facade to parser only.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import type { ParseFlags, RawParseError } from "./internal/parser.ts";
import { ParseCode, parseTree as parseTreeInternal, parseValue as parseValueInternal } from "./internal/parser.ts";
import { createScanner, SyntaxKind } from "./internal/scanner.ts";
import type { JsoncNode } from "./JsoncNode.ts";

const $I = $ScratchpadId.create("effected/jsonc/Jsonc");

/**
 * The public parse-error code vocabulary, appearing as the `code` field of
 * {@link JsoncParseErrorDetail}.
 *
 * **Example** (Guard a code with the kit)
 *
 * ```ts
 * import { JsoncParseErrorCode } from "@beep/scratchpad/effected/jsonc/index"
 *
 * console.log(JsoncParseErrorCode.is.CommaExpected("CommaExpected")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsoncParseErrorCode = LiteralKit(ParseCode.literals).annotate(
  $I.annote("JsoncParseErrorCode", {
    description: "The code of one recovered JSONC parse error.",
  })
);

/**
 * The union of all JSONC parse-error code string literals.
 *
 * @see {@link JsoncParseErrorCode} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncParseErrorCode = typeof JsoncParseErrorCode.Type;

/**
 * One recovered parse error: its code and its exact position as `offset` and
 * `length` plus zero-based `line` and `character`.
 *
 * **Example** (Read the first detail of a failed parse)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
 *
 * const result = Jsonc.parseResult('{ "a": }')
 *
 * if (Result.isFailure(result)) {
 *   console.log(result.failure.errors[0]?.code) // "ValueExpected"
 *   console.log(result.failure.errors[0]?.character) // 7
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsoncParseErrorDetail extends S.Class<JsoncParseErrorDetail>($I`JsoncParseErrorDetail`)(
  {
    code: JsoncParseErrorCode,
    offset: S.Natural,
    length: S.Natural,
    line: S.Natural,
    character: S.Natural,
  },
  $I.annote("JsoncParseErrorDetail", {
    description: "A recovered parse error with its offset, length, line and character.",
  })
) {}

/**
 * Error-recovery parse failure: aggregates every {@link JsoncParseErrorDetail}
 * encountered so a single failure reports the whole batch.
 *
 * **Details**
 *
 * Raised by {@link Jsonc.parse}, {@link Jsonc.parseTree} and the decode
 * direction of the schema factories. The `message` renders each position
 * 1-based (`line + 1:character + 1`) for human readers while the structured
 * detail fields stay 0-based, following the LSP convention.
 *
 * **Example** (Render the aggregate message)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
 *
 * const result = Jsonc.parseResult('{ "a": }')
 *
 * if (Result.isFailure(result)) {
 *   console.log(result.failure.message) // "JSONC parse failed with 1 error: ValueExpected at 1:8"
 * }
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsoncParseError extends S.TaggedError<JsoncParseError>($I.make("JsoncParseError"))(
  "JsoncParseError",
  {
    errors: S.Array(JsoncParseErrorDetail),
    input: S.String,
  },
  $I.annoteError<JsoncParseError>("JsoncParseError", {
    description: "Every parse error recovered from one JSONC document, with the source text.",
  })
) {
  /**
   * Render every recovered error as `code at line:character`, 1-based for
   * human readers.
   *
   * **Example** (Read the rendered summary)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const result = Jsonc.parseResult("[1 2]")
   *
   * console.log(Result.isFailure(result) && result.failure.message) // "JSONC parse failed with 1 error: CommaExpected at 1:4"
   * ```
   */
  override get message(): string {
    const count = this.errors.length;
    const summary = A.join(
      A.map(this.errors, (e) => `${e.code} at ${e.line + 1}:${e.character + 1}`),
      "; "
    );
    return `JSONC parse failed with ${count} error${count === 1 ? "" : "s"}: ${summary}`;
  }
}

/**
 * Options controlling parse behavior. Every field has a schema default, so
 * `JsoncParseOptions.make({})` is the JSONC convention.
 *
 * **Details**
 *
 * - `disallowComments`: reject line and block comments as a parse error.
 *   Defaults to `false`.
 * - `allowTrailingComma`: accept a trailing comma before a closing `}` or
 *   `]`. Defaults to `true`, the deliberate JSONC-convention default.
 * - `allowEmptyContent`: treat empty or whitespace/comment-only input as
 *   valid, yielding `O.none()` from {@link Jsonc.parseTree} instead of a
 *   `ValueExpected` error. Defaults to `false`.
 *
 * **Example** (Reject comments)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { Jsonc, JsoncParseOptions } from "@beep/scratchpad/effected/jsonc/index"
 *
 * const strict = JsoncParseOptions.make({ disallowComments: true })
 *
 * console.log(strict.allowTrailingComma) // true
 * console.log(Result.isFailure(Jsonc.parseResult("1 // note", strict))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsoncParseOptions extends S.Class<JsoncParseOptions>($I`JsoncParseOptions`)(
  {
    disallowComments: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    allowTrailingComma: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
    allowEmptyContent: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  },
  $I.annote("JsoncParseOptions", {
    description: "Comment, trailing-comma and empty-content behaviour of the JSONC parser.",
  })
) {}

/**
 * The public stringify-error code vocabulary, appearing as the `code` field of
 * {@link JsoncStringifyError}.
 *
 * **Details**
 *
 * - `CircularReference`: the value contains a reference cycle.
 * - `BigIntValue`: the value contains a `bigint` anywhere.
 * - `TopLevelUnrepresentable`: the top-level value (`undefined`, a function
 *   or a symbol) serializes to no output at all.
 * - `SerializationFailed`: serialization threw for another reason, typically
 *   a `toJSON` method or getter that threw.
 *
 * **Example** (Guard a code with the kit)
 *
 * ```ts
 * import { JsoncStringifyErrorCode } from "@beep/scratchpad/effected/jsonc/index"
 *
 * console.log(JsoncStringifyErrorCode.is.BigIntValue("BigIntValue")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsoncStringifyErrorCode = LiteralKit([
  "CircularReference",
  "BigIntValue",
  "TopLevelUnrepresentable",
  "SerializationFailed",
]).annotate(
  $I.annote("JsoncStringifyErrorCode", {
    description: "Why a value could not be serialized to JSON text.",
  })
);

/**
 * The union of all JSONC stringify-error code string literals.
 *
 * @see {@link JsoncStringifyErrorCode} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncStringifyErrorCode = typeof JsoncStringifyErrorCode.Type;

/**
 * Options controlling stringify behavior. Every field has a schema default.
 *
 * **Details**
 *
 * - `tabSize`: indent width in spaces when `insertSpaces` is `true`. Defaults
 *   to `2`; `0` produces compact single-line output.
 * - `insertSpaces`: indent with spaces when `true`, one tab when `false`.
 *   Defaults to `true`.
 *
 * **Example** (Emit compact JSON)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { Jsonc, JsoncStringifyOptions } from "@beep/scratchpad/effected/jsonc/index"
 *
 * const compact = JsoncStringifyOptions.make({ tabSize: 0 })
 *
 * console.log(Result.getOrThrow(Jsonc.stringifyResult({ a: [1] }, compact))) // '{"a":[1]}'
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsoncStringifyOptions extends S.Class<JsoncStringifyOptions>($I`JsoncStringifyOptions`)(
  {
    tabSize: S.Natural.pipe(S.withConstructorDefault(Effect.succeed(2)), S.withDecodingDefaultKey(Effect.succeed(2))),
    insertSpaces: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
  },
  $I.annote("JsoncStringifyOptions", {
    description: "Indentation settings for JSON emission.",
  })
) {}

/**
 * Stringification failure: a {@link JsoncStringifyErrorCode} naming the
 * failure mode, a human-readable `detail` and the offending `value`.
 *
 * **Details**
 *
 * Raised by {@link Jsonc.stringify}, {@link Jsonc.stringifyResult} and the
 * encode direction of the schema factories.
 *
 * **Example** (Classify a bigint failure)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
 *
 * const result = Jsonc.stringifyResult({ n: 1n })
 *
 * if (Result.isFailure(result)) {
 *   console.log(result.failure.code) // "BigIntValue"
 * }
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsoncStringifyError extends S.TaggedError<JsoncStringifyError>($I.make("JsoncStringifyError"))(
  "JsoncStringifyError",
  {
    code: JsoncStringifyErrorCode,
    detail: S.String,
    value: S.Unknown,
  },
  $I.annoteError<JsoncStringifyError>("JsoncStringifyError", {
    description: "A value that could not be serialized to JSON text, with the reason.",
  })
) {
  /**
   * Render the failure code and the engine's detail as one line.
   *
   * **Example** (Read the rendered message)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const result = Jsonc.stringifyResult(undefined)
   *
   * console.log(Result.isFailure(result) && result.failure.message.startsWith("JSONC stringify failed: TopLevelUnrepresentable")) // true
   * ```
   */
  override get message(): string {
    return `JSONC stringify failed: ${this.code} — ${this.detail}`;
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

const toFlags = (options?: JsoncParseOptions): ParseFlags => options ?? JsoncParseOptions.make({});

const lineChar = (text: string, offset: number): { readonly line: number; readonly character: number } => {
  let line = 0;
  let lineStart = 0;
  const limit = Math.min(offset, text.length);
  for (let i = 0; i < limit; i++) {
    const ch = text.charCodeAt(i);
    if (ch === 0x0d && i + 1 < text.length && text.charCodeAt(i + 1) === 0x0a) {
      i++;
    }
    // LS and PS count as line breaks in the scanner; stay aligned so error
    // positions after them are correct.
    if (ch === 0x0a || ch === 0x0d || ch === 0x2028 || ch === 0x2029) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, character: offset - lineStart };
};

const toDetails = (text: string, errors: ReadonlyArray<RawParseError>): ReadonlyArray<JsoncParseErrorDetail> =>
  A.map(errors, (e) => JsoncParseErrorDetail.make({ ...e, ...lineChar(text, e.offset) }));

const aggregate = (text: string, errors: ReadonlyArray<RawParseError>): O.Option<JsoncParseError> =>
  A.isReadonlyArrayNonEmpty(errors)
    ? O.some(JsoncParseError.make({ errors: toDetails(text, errors), input: text }))
    : O.none();

const deepEqual = (a: unknown, b: unknown, depth: number): boolean => {
  if (a === b) {
    return true;
  }
  // Over-deep comparison (reachable through `equalsValue`, whose value side is
  // caller-supplied): treat as unequal rather than overflowing the stack.
  if (depth >= MAX_NESTING_DEPTH) {
    return false;
  }
  if (A.isArray(a) || A.isArray(b)) {
    return (
      A.isArray(a) &&
      A.isArray(b) &&
      a.length === b.length &&
      A.every(A.zip(a, b), ([x, y]) => deepEqual(x, y, depth + 1))
    );
  }
  if (P.isObject(a) && P.isObject(b)) {
    const aKeys = R.keys(a);
    return aKeys.length === R.keys(b).length && A.every(aKeys, (key) => R.has(b, key) && deepEqual(a[key], b[key], depth + 1));
  }
  return false;
};

const isComment = S.is(SyntaxKind.pick(["LineComment", "BlockComment"]));

const isUnrepresentable = (value: unknown): boolean => P.isUndefined(value) || P.isFunction(value) || P.isSymbol(value);

// ── Bound codec ─────────────────────────────────────────────────────────────

/**
 * A domain codec pre-bound to its two directions, returned by
 * {@link Jsonc.bind}: the composed `schema` plus `decode` and `encode`
 * functions derived from it once.
 *
 * @see {@link Jsonc.bind} for the constructor.
 * @category services
 * @since 0.0.0
 */
export interface JsoncBoundCodec<T, RD = never, RE = never> {
  /** The composed codec decoding a JSONC `string` straight into `T`. */
  readonly schema: S.Codec<T, string, RD, RE>;
  /** Decode JSONC text into a validated `T`. */
  readonly decode: (text: string) => Effect.Effect<T, S.SchemaError, RD>;
  /** Encode a `T` back to JSON text with a two-space indent. */
  readonly encode: (value: T) => Effect.Effect<string, S.SchemaError, RE>;
}

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Static entry points for JSONC parsing, comment stripping, semantic equality
 * and the schema factories. Not instantiable.
 *
 * **Example** (Parse a commented document)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
 *
 * console.log(Result.getOrThrow(Jsonc.parseResult('{ "port": 3000 // dev\n }'))) // { port: 3000 }
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export abstract class Jsonc {
  /**
   * Parse JSONC into a plain JavaScript value, synchronously, returning a
   * `Result`.
   *
   * **When to use**
   *
   * Use at synchronous boundaries such as a plain config loader or a build
   * script. Inside Effect code reach for {@link Jsonc.parse}, which carries a
   * tracing span and is defined in terms of this function.
   *
   * **Details**
   *
   * Error-recovery parsing: every parse error is collected and the failure
   * side carries one aggregate {@link JsoncParseError}. The success value is
   * `unknown`.
   *
   * **Example** (Succeed and fail synchronously)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * console.log(Result.getOrThrow(Jsonc.parseResult("[1, 2, ]"))) // [1, 2]
   * console.log(Result.isFailure(Jsonc.parseResult("{ bad }"))) // true
   * ```
   *
   * @param text - The JSONC source to parse.
   * @param options - Parse options; omitted fields take their defaults.
   * @returns The decoded value, or the aggregate {@link JsoncParseError}.
   */
  static parseResult(text: string, options?: JsoncParseOptions): Result.Result<unknown, JsoncParseError> {
    const { value, errors } = parseValueInternal(text, toFlags(options));
    return O.match(aggregate(text, errors), {
      onNone: () => Result.succeed(value),
      onSome: Result.fail,
    });
  }

  /**
   * Parse JSONC into a plain JavaScript value.
   *
   * **Details**
   *
   * Collects every parse error and fails once with the aggregate
   * {@link JsoncParseError}. Defined in terms of {@link Jsonc.parseResult}.
   *
   * **Example** (Parse inside an Effect)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const program = Jsonc.parse('{ "a": [1, 2] }')
   *
   * console.log(Effect.runSync(program)) // { a: [1, 2] }
   * ```
   *
   * @param text - The JSONC source to parse.
   * @param options - Parse options; omitted fields take their defaults.
   */
  static readonly parse = Effect.fn("Jsonc.parse")((text: string, options?: JsoncParseOptions) =>
    Effect.fromResult(Jsonc.parseResult(text, options))
  );

  /**
   * Parse JSONC into an immutable {@link JsoncNode} AST, synchronously,
   * returning a `Result`.
   *
   * **Details**
   *
   * `O.none()` for empty input when `allowEmptyContent` is set; the aggregate
   * {@link JsoncParseError} for malformed input. {@link Jsonc.parseTree} is
   * defined in terms of this function.
   *
   * **Example** (Read the root node type)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as Result from "effect/Result"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const root = Result.getOrThrow(Jsonc.parseTreeResult('{ "port": 3000 }'))
   *
   * console.log(O.map(root, (node) => node.type)) // Option.some("object")
   * ```
   *
   * @param text - The JSONC source to parse.
   * @param options - Parse options; omitted fields take their defaults.
   * @returns `O.some(root)`, `O.none()` for empty input, or the aggregate
   *   {@link JsoncParseError}.
   */
  static parseTreeResult(text: string, options?: JsoncParseOptions): Result.Result<O.Option<JsoncNode>, JsoncParseError> {
    const { root, errors } = parseTreeInternal(text, toFlags(options));
    return O.match(aggregate(text, errors), {
      onNone: () => Result.succeed(root),
      onSome: Result.fail,
    });
  }

  /**
   * Parse JSONC into an immutable {@link JsoncNode} AST.
   *
   * **Details**
   *
   * `O.none()` for empty input when `allowEmptyContent` is set; the aggregate
   * {@link JsoncParseError} for malformed input. Defined in terms of
   * {@link Jsonc.parseTreeResult}.
   *
   * **Example** (Walk to a nested value)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import * as O from "effect/Option"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const program = Effect.map(Jsonc.parseTree('{ "a": [10, 20] }'), (root) =>
   *   O.flatMap(root, (node) => node.find(["a", 1]))
   * )
   *
   * console.log(O.map(Effect.runSync(program), (node) => node.value)) // Option.some(20)
   * ```
   *
   * @param text - The JSONC source to parse.
   * @param options - Parse options; omitted fields take their defaults.
   */
  static readonly parseTree = Effect.fn("Jsonc.parseTree")((text: string, options?: JsoncParseOptions) =>
    Effect.fromResult(Jsonc.parseTreeResult(text, options))
  );

  /**
   * Stringify a plain JavaScript value as JSON text, synchronously, returning
   * a `Result`.
   *
   * **Details**
   *
   * With default options the output is a two-space-indented document. Nested
   * `undefined`, functions and symbols follow `JSON.stringify` semantics:
   * dropped from objects, `null` in arrays. The failure channel classifies
   * cycles, `bigint` values, a top-level value with no representation and any
   * other serialization failure (such as a throwing `toJSON`).
   * {@link Jsonc.stringify} is defined in terms of this function.
   *
   * **Gotchas**
   *
   * JSONC comments live in the document and edit layer. Value-level
   * stringification never emits them.
   *
   * **Example** (Emit and classify)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * console.log(Result.getOrThrow(Jsonc.stringifyResult({ port: 3000 }))) // '{\n  "port": 3000\n}'
   *
   * const bad = Jsonc.stringifyResult(0n)
   * console.log(Result.isFailure(bad) && bad.failure.code) // "BigIntValue"
   * ```
   *
   * @param value - The plain JavaScript value to stringify.
   * @param options - Stringify options; omitted fields take their defaults.
   * @returns The JSON text, or a {@link JsoncStringifyError}.
   */
  static stringifyResult(value: unknown, options?: JsoncStringifyOptions): Result.Result<string, JsoncStringifyError> {
    if (isUnrepresentable(value)) {
      return Result.fail(
        JsoncStringifyError.make({
          code: "TopLevelUnrepresentable",
          detail: "the top-level value (undefined, a function or a symbol) has no JSON representation",
          value,
        })
      );
    }
    const resolved = options ?? JsoncStringifyOptions.make({});
    const space = resolved.insertSpaces ? resolved.tabSize : "\t";
    // The replacer runs ahead of serialization and classifies the failure the
    // codec is about to report: the codec itself only knows "not JSON".
    let code: JsoncStringifyErrorCode = JsoncStringifyErrorCode.Enum.SerializationFailed;
    let ancestors = A.empty<object>();
    const codec = S.fromJsonString(S.Unknown, {
      space,
      replacer: function (this: unknown, _key: string, current: unknown): unknown {
        if (P.isBigInt(current)) {
          code = JsoncStringifyErrorCode.Enum.BigIntValue;
        } else if (P.isObjectKeyword(current)) {
          ancestors = A.reverse(A.dropWhile(A.reverse(ancestors), (ancestor) => ancestor !== this));
          if (A.some(ancestors, (ancestor) => ancestor === current)) {
            code = JsoncStringifyErrorCode.Enum.CircularReference;
          }
          ancestors = A.append(ancestors, current);
        }
        return current;
      },
    });
    return S.encodeResult(codec)(value).pipe(
      Result.mapError((error) => JsoncStringifyError.make({ code, detail: error.message, value }))
    );
  }

  /**
   * Stringify a plain JavaScript value as JSON text.
   *
   * **Details**
   *
   * Fails with {@link JsoncStringifyError} on cycles, `bigint` values, a
   * top-level value with no JSON representation and any other serialization
   * failure. Defined in terms of {@link Jsonc.stringifyResult}.
   *
   * **Example** (Stringify inside an Effect)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * console.log(Effect.runSync(Jsonc.stringify([1, 2]))) // '[\n  1,\n  2\n]'
   * ```
   *
   * @param value - The plain JavaScript value to stringify.
   * @param options - Stringify options; omitted fields take their defaults.
   */
  static readonly stringify = Effect.fn("Jsonc.stringify")((value: unknown, options?: JsoncStringifyOptions) =>
    Effect.fromResult(Jsonc.stringifyResult(value, options))
  );

  /**
   * Remove all comments from JSONC, producing valid JSON.
   *
   * **Details**
   *
   * Pass `replaceCh` (for example `" "`) to replace each comment character
   * instead of deleting it, keeping every offset stable; line breaks inside
   * block comments are kept either way. Pure and total.
   *
   * **Example** (Strip and blank out comments)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * console.log(Jsonc.stripComments('{ "a": 1 /* c *\/ }')) // '{ "a": 1  }'
   * console.log(Jsonc.stripComments('{ "a": 1 /* c *\/ }', " ")) // '{ "a": 1         }'
   * ```
   *
   * @param text - The JSONC source to strip.
   * @param replaceCh - Optional single character replacing each stripped
   *   comment character; when omitted, comments are deleted and offsets shift.
   * @returns The comment-free text.
   */
  static stripComments(text: string, replaceCh?: string): string {
    const scanner = createScanner(text);
    let parts = A.empty<string>();
    let lastOffset = 0;
    let kind = scanner.scan();
    while (kind !== "EOF") {
      if (isComment(kind)) {
        const offset = scanner.getTokenOffset();
        const length = scanner.getTokenLength();
        parts = A.append(parts, text.substring(lastOffset, offset));
        if (P.isString(replaceCh)) {
          const comment = text.substring(offset, offset + length);
          parts = A.append(parts, Str.replace(/[^\n\r]/g, replaceCh)(comment));
        }
        lastOffset = offset + length;
      }
      kind = scanner.scan();
    }
    return A.join(A.append(parts, text.substring(lastOffset)), Str.empty);
  }

  /**
   * Compare two JSONC strings for semantic equality.
   *
   * **Details**
   *
   * Comments, whitespace, formatting and object key order are ignored; array
   * order is significant. Malformed input is never equal to anything. Pure
   * and total.
   *
   * **Example** (Ignore formatting and key order)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * console.log(Jsonc.equals('{ "a": 1, "b": 2 } // c', '{"b":2,"a":1}')) // true
   * console.log(Jsonc.equals("[1, 2]", "[2, 1]")) // false
   * ```
   *
   * @param a - The first JSONC source.
   * @param b - The second JSONC source.
   * @returns `true` when both sources decode to structurally equal values.
   */
  static equals(a: string, b: string): boolean {
    const ra = parseValueInternal(a, toFlags());
    const rb = parseValueInternal(b, toFlags());
    return A.isReadonlyArrayEmpty(ra.errors) && A.isReadonlyArrayEmpty(rb.errors) && deepEqual(ra.value, rb.value, 0);
  }

  /**
   * Compare a JSONC string against an existing JavaScript value with the same
   * semantics as {@link Jsonc.equals}.
   *
   * **Example** (Compare against a value)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * console.log(Jsonc.equalsValue('{ "port": 3000 }', { port: 3000 })) // true
   * console.log(Jsonc.equalsValue("{ bad }", {})) // false
   * ```
   *
   * @param text - The JSONC source to decode and compare.
   * @param value - The plain JavaScript value to compare against.
   * @returns `true` when `text` decodes to a value structurally equal to `value`.
   */
  static equalsValue(text: string, value: unknown): boolean {
    const r = parseValueInternal(text, toFlags());
    return A.isReadonlyArrayEmpty(r.errors) && deepEqual(r.value, value, 0);
  }

  /**
   * A codec from JSONC text to `unknown`, decoding with the given options.
   *
   * **Details**
   *
   * Encoding is {@link Jsonc.stringifyResult} with default options, so
   * comments do not survive a round trip; a {@link JsoncStringifyError} on the
   * encode side surfaces as a schema issue. Each call returns a fresh schema,
   * so bind the result to a constant; for the default options use
   * {@link Jsonc.JsoncFromString}.
   *
   * **Example** (Decode strictly)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   * import { Jsonc, JsoncParseOptions } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const Strict = Jsonc.fromString(JsoncParseOptions.make({ allowTrailingComma: false }))
   *
   * console.log(Result.isFailure(S.decodeResult(Strict)("[1,]"))) // true
   * ```
   *
   * @param options - Parse options controlling the decode direction.
   * @returns A codec decoding JSONC text to `unknown`.
   */
  static fromString(options?: JsoncParseOptions): S.Codec<unknown, string> {
    const flags = toFlags(options);
    return S.String.pipe(
      S.decodeTo(
        S.Unknown,
        SchemaTransformation.transformEffect({
          decode: (input: string) => {
            const { value, errors } = parseValueInternal(input, flags);
            return O.match(aggregate(input, errors), {
              onNone: () => Effect.succeed(value),
              onSome: (error) => Effect.fail(new SchemaIssue.InvalidValue({ message: error.message }, input)),
            });
          },
          encode: (value: unknown) =>
            Effect.fromResult(Jsonc.stringifyResult(value)).pipe(
              Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, value))
            ),
        })
      )
    );
  }

  /**
   * The zero-config codec from JSONC text to `unknown`:
   * {@link Jsonc.fromString} with default options, pre-bound so the common
   * case needs no memoization discipline.
   *
   * **Example** (Decode with the default options)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * console.log(Result.getOrThrow(S.decodeResult(Jsonc.JsoncFromString)('{ "k": 42 // c\n}'))) // { k: 42 }
   * ```
   */
  static readonly JsoncFromString: S.Codec<unknown, string> = Jsonc.fromString();

  /**
   * Compose {@link Jsonc.fromString} with a target schema, yielding a codec
   * that decodes JSONC straight into a validated domain value.
   *
   * **Details**
   *
   * Each call composes a fresh schema; bind the result to a constant.
   *
   * **Example** (Decode into a domain struct)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const Config = S.Struct({ port: S.Finite })
   * const ConfigFromJsonc = Jsonc.schema(Config)
   *
   * console.log(Result.getOrThrow(S.decodeResult(ConfigFromJsonc)('{ "port": 3000 // dev\n }'))) // { port: 3000 }
   * ```
   *
   * @param target - The domain schema decoded values must satisfy.
   * @param options - Parse options controlling the JSONC decode step.
   * @returns A codec decoding JSONC text straight into `T`.
   */
  static schema<T, E, RD = never, RE = never>(
    target: S.Codec<T, E, RD, RE>,
    options?: JsoncParseOptions
  ): S.Codec<T, string, RD, RE> {
    return Jsonc.fromString(options).pipe(S.decodeTo(target));
  }

  /**
   * Bind a target schema to the JSONC codec once, yielding the composed
   * schema plus pre-derived `decode` and `encode` directions.
   *
   * **Details**
   *
   * Binds the plain form only: default {@link JsoncParseOptions} on decode and
   * default stringify options on encode. Both directions fail with
   * `S.SchemaError`, and the target's service requirements flow through.
   *
   * **Example** (Round-trip a config)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import * as S from "effect/Schema"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const config = Jsonc.bind(S.Struct({ port: S.Finite }))
   *
   * const program = Effect.gen(function* () {
   *   const value = yield* config.decode('{ "port": 3000 // dev\n }')
   *   return yield* config.encode(value)
   * })
   *
   * console.log(Effect.runSync(program)) // '{\n  "port": 3000\n}'
   * ```
   *
   * @param target - The domain schema decoded values must satisfy.
   * @returns The composed schema and its two pre-bound directions.
   */
  static bind<T, E, RD = never, RE = never>(target: S.Codec<T, E, RD, RE>): JsoncBoundCodec<T, RD, RE> {
    const schema = Jsonc.schema(target);
    return {
      schema,
      decode: S.decodeEffect(schema),
      encode: S.encodeEffect(schema),
    };
  }
}
