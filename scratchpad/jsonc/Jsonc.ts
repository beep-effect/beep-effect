/**
 * The `Jsonc` facade: parsing, comment stripping, semantic equality and the
 * flagship schema factories, plus the parse-error vocabulary they raise.
 *
 * `Jsonc` is a namespace of statics over the internal parser and the schema
 * layer — not itself a schema class. `parse`/`parseTree` and schema decoding
 * carry a real `JsoncParseError` channel; `stripComments`/`equals`/`equalsValue`
 * are pure total functions.
 *
 * **Details**
 *
 * The internal parser returns raw error records (`{ code, offset, length }`).
 * This module maps them into `JsoncParseErrorDetail` — deriving
 * `line`/`character` from `offset` — and builds the aggregate
 * `JsoncParseError`. The dependency edge runs facade → parser only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import * as O from "@beep/utils/Option";
import { Effect, Option, Result, Schema, SchemaIssue, SchemaTransformation } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import type { ParseFlags, RawParseError } from "./internal/parser.ts";
import {
  JSONC_PARSE_ERROR_CODES,
  parseTree as parseTreeInternal,
  parseValue as parseValueInternal,
} from "./internal/parser.ts";
import type { SyntaxKind } from "./internal/scanner.ts";
import { createScanner } from "./internal/scanner.ts";
import type { JsoncNode } from "./JsoncNode.ts";

const $I = $ScratchpadId.create("jsonc/Jsonc");

/**
 * The single public parse-error code vocabulary, appearing as the `code` field
 * of {@link JsoncParseErrorDetail}.
 *
 * **Example** (Recognize a parse-error code)
 *
 * ```ts
 * import { JsoncParseErrorCode } from "@beep/scratchpad/jsonc";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(JsoncParseErrorCode)("ValueExpected")); // true
 * console.log(S.is(JsoncParseErrorCode)("NestingDepthExceeded")); // true
 * console.log(S.is(JsoncParseErrorCode)("not-a-code")); // false
 * ```
 *
 * @see {@link JsoncParseErrorDetail} for the per-span record that carries this code.
 * @public
 * @category constants
 * @since 0.0.0
 */
export const JsoncParseErrorCode = Schema.Literals(JSONC_PARSE_ERROR_CODES).pipe(
  $I.annoteSchema("JsoncParseErrorCode", {
    description: "The public JSONC parse-error code vocabulary carried by each JsoncParseErrorDetail.",
  })
);

/**
 * The union of all JSONC parse-error code string literals.
 *
 * @see {@link JsoncParseErrorCode} for the runtime literals schema.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type JsoncParseErrorCode = typeof JsoncParseErrorCode.Type;

/**
 * One recovered parse error: its `JsoncParseErrorCode` and its exact
 * position (`offset`/`length`, plus zero-based `line`/`character`). A single
 * {@link JsoncParseError} reports a batch of these.
 *
 * **Example** (Construct a per-span diagnostic)
 *
 * ```ts
 * import { JsoncParseErrorDetail } from "@beep/scratchpad/jsonc";
 *
 * const detail = JsoncParseErrorDetail.make({
 *   code: "ValueExpected",
 *   offset: 2,
 *   length: 3,
 *   line: 0,
 *   character: 2,
 * });
 *
 * console.log(detail.code); // "ValueExpected"
 * console.log(`${detail.line}:${detail.character}`); // 0:2
 * ```
 *
 * @see {@link JsoncParseError} for the aggregate that batches these details.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JsoncParseErrorDetail extends Schema.Class<JsoncParseErrorDetail>($I`JsoncParseErrorDetail`)(
  {
    code: JsoncParseErrorCode,
    offset: Schema.Finite,
    length: Schema.Finite,
    line: Schema.Finite,
    character: Schema.Finite,
  },
  $I.annote("JsoncParseErrorDetail", {
    description: "One recovered JSONC parse error with its code and exact source position.",
  })
) {}

/**
 * Error-recovery parse failure: aggregates every {@link JsoncParseErrorDetail}
 * encountered, so a single failure reports the whole batch. Raised by
 * {@link Jsonc.parse}, {@link Jsonc.parseTree} and the decode direction of the
 * schema factories.
 *
 * **Gotchas**
 *
 * Any recovered value or tree from the internal parser is discarded: callers
 * expecting Microsoft jsonc-parser `{ value, errors }` or a partial
 * {@link JsoncNode} on failure get neither. Inspect `errors` (and `input`) on
 * this tagged failure. `line`/`character` are derived from `offset` in this
 * facade, not the scanner. {@link Jsonc.equals} and {@link Jsonc.equalsValue}
 * treat any parse error as `false` rather than comparing recovery artifacts.
 *
 * **Example** (Read the aggregate failure)
 *
 * ```ts
 * import { Jsonc } from "@beep/scratchpad/jsonc";
 * import { Result } from "effect";
 *
 * const bad = Jsonc.parseResult("{ bad }");
 * if (Result.isFailure(bad)) {
 *   console.log(bad.failure._tag); // "JsoncParseError"
 *   console.log(bad.failure.errors.length > 0); // true
 * }
 * ```
 *
 * @see {@link JsoncParseErrorDetail} for per-span codes and derived line/character.
 * @see {@link Jsonc.parseResult} for the Result twin that raises this error.
 * @see {@link parseValue} for the internal recovery pair the public API does not expose.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JsoncParseError extends Schema.TaggedError<JsoncParseError>($I`JsoncParseError`)(
  "JsoncParseError",
  {
    errors: Schema.Array(JsoncParseErrorDetail),
    input: Schema.String,
  },
  $I.annote("JsoncParseError", {
    description: "Aggregate JSONC parse failure carrying every recovered JsoncParseErrorDetail.",
  })
) {
  /**
   * One-line summary of every recovered span: count, then `code at line:character`
   * joined with `"; "`.
   *
   * **Example** (Read the aggregate parse message)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Result } from "effect";
   *
   * const bad = Jsonc.parseResult("{ bad }");
   * if (Result.isFailure(bad)) {
   *   console.log(bad.failure.message.includes("JSONC parse failed")); // true
   *   console.log(bad.failure.message.includes("at ")); // true
   * }
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    const count = this.errors.length;
    const summary = this.errors.map((e) => `${e.code} at ${e.line}:${e.character}`).join("; ");
    return `JSONC parse failed with ${count} error${count === 1 ? "" : "s"}: ${summary}`;
  }
}

/**
 * Options controlling parse behavior. All fields are omissible.
 *
 * - `disallowComments` — reject line and block comments as a parse error
 *   instead of the JSONC default of allowing them. Defaults to `false`.
 * - `allowTrailingComma` — accept a trailing comma before a closing `}`/`]`.
 *   Defaults to `true` — the deliberate JSONC-convention default, differing
 *   from Microsoft's parser (which defaults to `false`).
 * - `allowEmptyContent` — treat empty or whitespace/comment-only input as
 *   valid, yielding `Option.none()` from {@link Jsonc.parseTree} instead of a
 *   `ValueExpected` parse error. Defaults to `false`.
 *
 * **Example** (Reject comments)
 *
 * ```ts
 * import { Jsonc, JsoncParseOptions } from "@beep/scratchpad/jsonc";
 * import { Result } from "effect";
 *
 * const options = JsoncParseOptions.make({ disallowComments: true });
 * const bad = Jsonc.parseResult('{ "port": 3000 // dev\n }', options);
 *
 * console.log(options.disallowComments); // true
 * console.log(Result.isFailure(bad)); // true
 * ```
 *
 * @see {@link Jsonc.parseResult} for the parser these options control.
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class JsoncParseOptions extends Schema.Class<JsoncParseOptions>($I`JsoncParseOptions`)(
  {
    disallowComments: Schema.optionalKey(Schema.Boolean),
    allowTrailingComma: Schema.optionalKey(Schema.Boolean),
    allowEmptyContent: Schema.optionalKey(Schema.Boolean),
  },
  $I.annote("JsoncParseOptions", {
    description: "Omissible JSONC parse knobs for comments, trailing commas, and empty content.",
  })
) {}

/**
 * The public stringify-error code vocabulary, appearing as the `code` field of
 * {@link JsoncStringifyError}:
 *
 * - `CircularReference` — the value contains a reference cycle, so no finite
 *   JSON text exists for it.
 * - `BigIntValue` — the value contains a `bigint` (anywhere, top-level or
 *   nested), which JSON cannot represent.
 * - `TopLevelUnrepresentable` — the top-level value (`undefined`, a function
 *   or a symbol) serializes to no output at all.
 *
 * **Example** (Recognize a stringify-error code)
 *
 * ```ts
 * import { JsoncStringifyErrorCode } from "@beep/scratchpad/jsonc";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(JsoncStringifyErrorCode)("BigIntValue")); // true
 * console.log(S.is(JsoncStringifyErrorCode)("CircularReference")); // true
 * ```
 *
 * @see {@link JsoncStringifyError} for the tagged error that carries this code.
 * @public
 * @category constants
 * @since 0.0.0
 */
export const JsoncStringifyErrorCode = Schema.Literals([
  "CircularReference",
  "BigIntValue",
  "TopLevelUnrepresentable",
]).pipe(
  $I.annoteSchema("JsoncStringifyErrorCode", {
    description: "The public JSONC stringify-error code vocabulary carried by JsoncStringifyError.",
  })
);

/**
 * The union of all JSONC stringify-error code string literals.
 *
 * @see {@link JsoncStringifyErrorCode} for the runtime literals schema.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type JsoncStringifyErrorCode = typeof JsoncStringifyErrorCode.Type;

/**
 * Options controlling stringify behavior. All fields are omissible; the
 * vocabulary matches `JsoncFormattingOptions`.
 *
 * - `tabSize` — the indent width in spaces when `insertSpaces` is `true`.
 *   Defaults to `2`; `0` produces compact single-line output.
 * - `insertSpaces` — indent with spaces (`tabSize` of them) when `true`, or a
 *   single tab character when `false`. Defaults to `true`.
 *
 * **Example** (Request compact output)
 *
 * ```ts
 * import { Jsonc, JsoncStringifyOptions } from "@beep/scratchpad/jsonc";
 * import { Result } from "effect";
 *
 * const options = JsoncStringifyOptions.make({ tabSize: 0 });
 * const text = Result.getOrThrow(Jsonc.stringifyResult({ port: 3000 }, options));
 *
 * console.log(options.tabSize); // 0
 * console.log(text); // {"port":3000}
 * ```
 *
 * @see {@link Jsonc.stringifyResult} for the encoder these options control.
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class JsoncStringifyOptions extends Schema.Class<JsoncStringifyOptions>($I`JsoncStringifyOptions`)(
  {
    tabSize: Schema.optionalKey(Schema.Finite),
    insertSpaces: Schema.optionalKey(Schema.Boolean),
  },
  $I.annote("JsoncStringifyOptions", {
    description: "Omissible JSONC stringify knobs matching JsoncFormattingOptions indent vocabulary.",
  })
) {}

/**
 * Stringification failure: a `JsoncStringifyErrorCode` naming the
 * failure mode, a human-readable `detail` (the engine's message for thrown
 * cases — on V8 the circular-reference message includes the offending property
 * path), and the offending `value`. Raised by {@link Jsonc.stringify},
 * {@link Jsonc.stringifyResult} and the encode direction of the schema
 * factories.
 *
 * **Example** (Catch a bigint stringify failure)
 *
 * ```ts
 * import { Jsonc } from "@beep/scratchpad/jsonc";
 * import { Result } from "effect";
 *
 * const bad = Jsonc.stringifyResult(0n);
 * if (Result.isFailure(bad)) {
 *   console.log(bad.failure._tag); // "JsoncStringifyError"
 *   console.log(bad.failure.code); // "BigIntValue"
 * }
 * ```
 *
 * @see {@link JsoncStringifyErrorCode} for the failure-mode vocabulary.
 * @see {@link Jsonc.stringifyResult} for the Result twin that raises this error.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JsoncStringifyError extends Schema.TaggedError<JsoncStringifyError>($I`JsoncStringifyError`)(
  "JsoncStringifyError",
  {
    code: JsoncStringifyErrorCode,
    detail: Schema.String,
    value: Schema.Unknown,
  },
  $I.annote("JsoncStringifyError", {
    description: "JSONC stringify failure naming the mode, engine detail, and offending value.",
  })
) {
  /**
   * One-line summary of the failure mode and engine `detail`.
   *
   * **Example** (Read a bigint stringify message)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Result } from "effect";
   *
   * const bad = Jsonc.stringifyResult(0n);
   * if (Result.isFailure(bad)) {
   *   console.log(bad.failure.message.includes("BigIntValue")); // true
   * }
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `JSONC stringify failed: ${this.code} — ${this.detail}`;
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

const toFlags = (options?: JsoncParseOptions): ParseFlags =>
  options === undefined
    ? {}
    : O.getSomesStruct({
        disallowComments: O.fromUndefinedOr(options.disallowComments),
        allowTrailingComma: O.fromUndefinedOr(options.allowTrailingComma),
        allowEmptyContent: O.fromUndefinedOr(options.allowEmptyContent),
      });

const lineChar = (text: string, offset: number): { line: number; character: number } => {
  let line = 0;
  let lineStart = 0;
  const limit = Math.min(offset, text.length);
  for (let i = 0; i < limit; i++) {
    const ch = text.charCodeAt(i);
    if (ch === 0x0a) {
      line++;
      lineStart = i + 1;
    } else if (ch === 0x0d) {
      if (i + 1 < text.length && text.charCodeAt(i + 1) === 0x0a) {
        i++;
      }
      line++;
      lineStart = i + 1;
    } else if (ch === 0x2028 || ch === 0x2029) {
      // LS/PS count as line breaks in the scanner; stay aligned so error
      // positions after them are correct.
      line++;
      lineStart = i + 1;
    }
  }
  return { line, character: offset - lineStart };
};

const toDetails = (text: string, errors: ReadonlyArray<RawParseError>): ReadonlyArray<JsoncParseErrorDetail> =>
  errors.map((e) => {
    const { line, character } = lineChar(text, e.offset);
    return JsoncParseErrorDetail.make({ code: e.code, offset: e.offset, length: e.length, line, character });
  });

const deepEqual = (a: unknown, b: unknown, depth = 0): boolean => {
  if (a === b) return true;
  // Over-deep comparison (reachable via `equalsValue`, whose `value` side is
  // an arbitrary caller-supplied structure): treat as unequal rather than
  // recursing past the cap and overflowing the stack as a defect. Values
  // produced by the parser are already bounded to the same depth.
  if (depth >= MAX_NESTING_DEPTH) return false;
  if (a === null || b === null) return false;
  if (P.isString(a) !== P.isString(b) || P.isNumber(a) !== P.isNumber(b) || P.isBoolean(a) !== P.isBoolean(b)) {
    return false;
  }

  if (A.isArray(a)) {
    if (!A.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i], depth + 1)) return false;
    }
    return true;
  }
  if (A.isArray(b)) return false;

  if (P.isObjectKeyword(a) && P.isObjectKeyword(b)) {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = R.keys(aObj);
    const bKeys = R.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!R.has(bObj, key) || !deepEqual(aObj[key], bObj[key], depth + 1)) return false;
    }
    return true;
  }

  return false;
};

// ── Bound codec ─────────────────────────────────────────────────────────────

/**
 * A domain codec pre-bound to its two directions, returned by
 * {@link Jsonc.bind}: the composed `schema` (what {@link Jsonc.schema}
 * returns) plus `decode` and `encode` functions derived from it once, so
 * callers need no generic `Schema` machinery at the use site.
 *
 * @see {@link Jsonc.bind} for the factory that returns this codec.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface JsoncBoundCodec<T, RD = never, RE = never> {
  /** The composed codec decoding a JSONC `string` straight into `T`. */
  readonly schema: Schema.Codec<T, string, RD, RE>;
  /** Decode JSONC text into a validated `T`. */
  readonly decode: (text: string) => Effect.Effect<T, Schema.SchemaError, RD>;
  /** Encode a `T` back to JSON text (default 2-space indent). */
  readonly encode: (value: T) => Effect.Effect<string, Schema.SchemaError, RE>;
}

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Static entry points for JSONC parsing, editing-adjacent utilities and the
 * schema factories. Not instantiable.
 *
 * **Details**
 *
 * {@link Jsonc.parse} is the Effect twin of {@link Jsonc.parseResult};
 * {@link Jsonc.parseTree} of {@link Jsonc.parseTreeResult};
 * {@link Jsonc.stringify} of {@link Jsonc.stringifyResult}. Reach for the
 * Effect variant inside Effect code (it carries a tracing span) and the Result
 * variant at synchronous boundaries. {@link Jsonc.stripComments} is a separate
 * offset-sensitive transform — omit `replaceCh` only when no later offset is
 * used.
 *
 * **Gotchas**
 *
 * A `"__proto__"` object member from {@link Jsonc.parse} / {@link Jsonc.parseResult}
 * is defined as an own data property (`Object.defineProperty`), matching
 * `JSON.parse` — it never mutates `Object.prototype`.
 *
 * **Example** (Parse JSONC with a line comment)
 *
 * ```ts
 * import { Jsonc } from "@beep/scratchpad/jsonc";
 * import { Effect } from "effect";
 *
 * const value = Effect.runSync(Jsonc.parse('{ "port": 3000 // dev\n }'));
 *
 * console.log(value); // { port: 3000 }
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export class Jsonc {
  private constructor() {}

  /**
   * Parse JSONC into a plain JavaScript value, synchronously, returning a
   * `Result` instead of an `Effect`. Same error-recovery semantics as
   * {@link Jsonc.parse}: every parse error is collected and the failure side
   * carries one aggregate {@link JsoncParseError}. Pure — parsing is
   * fundamentally synchronous, so non-Effect consumers (a plain config
   * loader, a build script) can call this directly instead of wrapping
   * `Effect.runSync(Effect.result(Jsonc.parse(text)))`.
   *
   * **Details**
   *
   * {@link Jsonc.parse} is defined in terms of this function; the two never
   * diverge. Reach for the Effect variant inside Effect code — it carries
   * the `Jsonc.parse` tracing span — and for this one at synchronous
   * boundaries.
   *
   * **Gotchas**
   *
   * When `errors.length > 0` this fails with {@link JsoncParseError} and
   * discards any recovered value the internal parser produced.
   *
   * **Example** (Inspect success and aggregate failure)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Result } from "effect";
   *
   * const ok = Jsonc.parseResult('{ "port": 3000 // dev\n }');
   * if (Result.isSuccess(ok)) {
   *   console.log(ok.success); // { port: 3000 }
   * }
   *
   * const bad = Jsonc.parseResult("{ bad }");
   * if (Result.isFailure(bad)) {
   *   console.log(bad.failure._tag); // "JsoncParseError"
   * }
   * ```
   *
   * @param text - The JSONC source to parse.
   * @param options - Optional {@link JsoncParseOptions}; defaults apply for
   *   omitted fields.
   * @see {@link JsoncParseError} for the aggregate failure that drops recovered values.
   */
  static parseResult(text: string, options?: JsoncParseOptions): Result.Result<unknown, JsoncParseError> {
    const { value, errors } = parseValueInternal(text, toFlags(options));
    if (errors.length > 0) {
      return Result.fail(JsoncParseError.make({ errors: toDetails(text, errors), input: text }));
    }
    return Result.succeed(value);
  }

  /**
   * Parse JSONC into a plain JavaScript value. Error-recovery parsing:
   * collects every parse error and fails once with the aggregate
   * {@link JsoncParseError}. Returns `unknown`, never `any`. Defined in terms
   * of {@link Jsonc.parseResult} — synchronous callers can use that variant
   * directly.
   *
   * **Gotchas**
   *
   * Any recovered value is discarded on failure. See {@link JsoncParseError}.
   *
   * @param text - The JSONC source to parse.
   * @param options - Optional {@link JsoncParseOptions}; defaults apply for
   *   omitted fields.
   * @see {@link JsoncParseError} for the aggregate failure that drops recovered values.
   */
  static readonly parse = Effect.fn("Jsonc.parse")((text: string, options?: JsoncParseOptions) =>
    Effect.fromResult(Jsonc.parseResult(text, options))
  );

  /**
   * Parse JSONC into an immutable {@link JsoncNode} AST, synchronously,
   * returning a `Result` instead of an `Effect`. `Option.none()` for empty
   * input (with `allowEmptyContent`); the aggregate {@link JsoncParseError}
   * for malformed input. Pure — parsing is fundamentally synchronous, so
   * non-Effect consumers (a plain config loader, a build script) can call
   * this directly instead of wrapping
   * `Effect.runSync(Effect.result(Jsonc.parseTree(text)))`.
   *
   * **Details**
   *
   * {@link Jsonc.parseTree} is defined in terms of this function; the two
   * never diverge. Reach for the Effect variant inside Effect code — it
   * carries the `Jsonc.parseTree` tracing span — and for this one at
   * synchronous boundaries.
   *
   * **Gotchas**
   *
   * When `errors.length > 0` this fails with {@link JsoncParseError} and
   * discards any recovered {@link JsoncNode}.
   *
   * **Example** (Inspect a tree or the aggregate failure)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Result } from "effect";
   * import * as O from "effect/Option";
   *
   * const ok = Jsonc.parseTreeResult('{ "port": 3000 // dev\n }');
   * if (Result.isSuccess(ok) && O.isSome(ok.success)) {
   *   console.log(ok.success.value.type); // "object"
   * }
   *
   * const bad = Jsonc.parseTreeResult("{ bad }");
   * if (Result.isFailure(bad)) {
   *   console.log(bad.failure._tag); // "JsoncParseError"
   * }
   * ```
   *
   * @param text - The JSONC source to parse.
   * @param options - Optional {@link JsoncParseOptions}; defaults apply for
   *   omitted fields.
   * @see {@link JsoncParseError} for the aggregate failure that drops recovered trees.
   */
  static parseTreeResult(
    text: string,
    options?: JsoncParseOptions
  ): Result.Result<Option.Option<JsoncNode>, JsoncParseError> {
    const { root, errors } = parseTreeInternal(text, toFlags(options));
    if (errors.length > 0) {
      return Result.fail(JsoncParseError.make({ errors: toDetails(text, errors), input: text }));
    }
    return Result.succeed(root !== undefined ? Option.some(root) : Option.none());
  }

  /**
   * Parse JSONC into an immutable {@link JsoncNode} AST. `Option.none()` for
   * empty input (with `allowEmptyContent`); the aggregate
   * {@link JsoncParseError} for malformed input. Defined in terms of
   * {@link Jsonc.parseTreeResult} — synchronous callers can use that variant
   * directly.
   *
   * **Gotchas**
   *
   * Any recovered tree is discarded on failure. See {@link JsoncParseError}.
   *
   * @param text - The JSONC source to parse.
   * @param options - Optional {@link JsoncParseOptions}; defaults apply for
   *   omitted fields.
   * @see {@link JsoncParseError} for the aggregate failure that drops recovered trees.
   */
  static readonly parseTree = Effect.fn("Jsonc.parseTree")((text: string, options?: JsoncParseOptions) =>
    Effect.fromResult(Jsonc.parseTreeResult(text, options))
  );

  /**
   * Stringify a plain JavaScript value as JSON text, synchronously, returning
   * a `Result` instead of an `Effect`. With no options the output is
   * byte-identical to `JSON.stringify(value, null, 2)`.
   *
   * Plain JSON emission: JSONC comments exist only in the document/edit layer
   * (`JsoncNode`, `JsoncEdit`, `JsoncFormatter`), so no comment survives — or
   * can be produced by — value-level stringification.
   *
   * Nested unrepresentable values follow `JSON.stringify`'s documented
   * semantics: `undefined`, functions and symbols are dropped from objects and
   * become `null` in arrays. The typed failure channel covers only the cases
   * where output would be absent or an exception thrown — see
   * `JsoncStringifyErrorCode`. A throwing `toJSON` method or getter is
   * caller code failing and rethrows as a defect, never a typed error.
   *
   * **Details**
   *
   * {@link Jsonc.stringify} is defined in terms of this function; the two
   * never diverge. Reach for the Effect variant inside Effect code — it
   * carries the `Jsonc.stringify` tracing span — and for this one at
   * synchronous boundaries.
   *
   * **Example** (Stringify success and bigint failure)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Result } from "effect";
   *
   * const ok = Jsonc.stringifyResult({ port: 3000 });
   * if (Result.isSuccess(ok)) {
   *   console.log(ok.success); // '{\n  "port": 3000\n}'
   * }
   *
   * const bad = Jsonc.stringifyResult(0n);
   * if (Result.isFailure(bad)) {
   *   console.log(bad.failure.code); // "BigIntValue"
   * }
   * ```
   *
   * @param value - The plain JavaScript value to stringify.
   * @param options - Optional {@link JsoncStringifyOptions}; defaults apply
   *   for omitted fields.
   * @see {@link JsoncStringifyError} for circular, bigint and top-level failures.
   */
  static stringifyResult(value: unknown, options?: JsoncStringifyOptions): Result.Result<string, JsoncStringifyError> {
    const space = options?.insertSpaces === false ? "\t" : (options?.tabSize ?? 2);
    let text: string | undefined;
    try {
      text = JSON.stringify(value, null, space);
    } catch (defect) {
      // Classify the two exceptions JSON.stringify documents. The message
      // patterns cover V8 ("circular structure", "serialize a BigInt"), JSC
      // ("cyclic structures", "serialize BigInt") and SpiderMonkey ("cyclic
      // object value", "BigInt value can't be serialized"); anything else —
      // including a throwing `toJSON` or getter — is caller code failing and
      // rethrows as a genuine defect.
      if (defect instanceof TypeError) {
        if (/circular|cyclic/i.test(defect.message)) {
          return Result.fail(JsoncStringifyError.make({ code: "CircularReference", detail: defect.message, value }));
        }
        if (/bigint/i.test(defect.message)) {
          return Result.fail(JsoncStringifyError.make({ code: "BigIntValue", detail: defect.message, value }));
        }
      }
      throw defect;
    }
    if (text === undefined) {
      return Result.fail(
        JsoncStringifyError.make({
          code: "TopLevelUnrepresentable",
          detail: "the top-level value (undefined, a function or a symbol) has no JSON representation",
          value,
        })
      );
    }
    return Result.succeed(text);
  }

  /**
   * Stringify a plain JavaScript value as JSON text. With no options the
   * output is byte-identical to `JSON.stringify(value, null, 2)`. Fails with
   * {@link JsoncStringifyError} on circular references, `bigint` values and a
   * top-level value with no JSON representation; nested `undefined`, functions
   * and symbols follow `JSON.stringify`'s documented semantics (dropped from
   * objects, `null` in arrays). Comments are a document/edit-layer concern —
   * value-level stringification never emits them. Defined in terms of
   * {@link Jsonc.stringifyResult} — synchronous callers can use that variant
   * directly.
   *
   * @param value - The plain JavaScript value to stringify.
   * @param options - Optional {@link JsoncStringifyOptions}; defaults apply
   *   for omitted fields.
   * @see {@link Jsonc.stringifyResult} for the synchronous Result twin.
   */
  static readonly stringify = Effect.fn("Jsonc.stringify")((value: unknown, options?: JsoncStringifyOptions) =>
    Effect.fromResult(Jsonc.stringifyResult(value, options))
  );

  /**
   * Remove all comments from JSONC, producing valid JSON. Pass a `replaceCh`
   * (e.g. `" "`) to replace each comment character instead of deleting it,
   * keeping all offsets stable (line breaks inside block comments are kept).
   * Pure and total.
   *
   * **Gotchas**
   *
   * Omit `replaceCh` only when no later offset is used. Pass a single
   * character (typically `" "`) to keep {@link JsoncEdit} and
   * {@link JsoncParseErrorDetail} offsets valid against the result; a
   * multi-character `replaceCh` is typed as `string` but expands offsets.
   * Block-comment `\n`/`\r` stay even when replacing; LS/PS (`U+2028` /
   * `U+2029`) are replaced. `//` inside strings is not stripped because the
   * scanner tokenizes strings whole.
   *
   * **Example** (Preserve offsets vs shift)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   *
   * const text = '{ "a": 1 // c\n }';
   * const shifted = Jsonc.stripComments(text);
   * const preserved = Jsonc.stripComments(text, " ");
   *
   * console.log(shifted.length === text.length); // false
   * console.log(preserved.length === text.length); // true
   * console.log(preserved.indexOf('"a"') === text.indexOf('"a"')); // true
   * ```
   *
   * @param text - The JSONC source to strip.
   * @param replaceCh - Optional single character replacing each stripped
   *   comment character (offset-preserving); when omitted, comments are
   *   deleted outright and offsets shift.
   * @see {@link JsoncEdit} for edits that assume original document offsets.
   * @see {@link Jsonc.parse} when the goal is a value rather than JSON text.
   */
  static stripComments(text: string, replaceCh?: string): string {
    const scanner = createScanner(text);
    const parts: string[] = [];
    let lastOffset = 0;
    let kind: SyntaxKind;

    do {
      kind = scanner.scan();
      const offset = scanner.getTokenOffset();
      const length = scanner.getTokenLength();

      if (kind === "LineComment" || kind === "BlockComment") {
        if (lastOffset < offset) {
          parts.push(text.substring(lastOffset, offset));
        }
        if (replaceCh !== undefined) {
          for (let i = 0; i < length; i++) {
            const ch = text.charCodeAt(offset + i);
            parts.push(ch === 0x0a || ch === 0x0d ? text[offset + i] : replaceCh);
          }
        }
        lastOffset = offset + length;
      }
    } while (kind !== "EOF");

    if (lastOffset < text.length) {
      parts.push(text.substring(lastOffset));
    }

    return parts.join("");
  }

  /**
   * Compare two JSONC strings for semantic equality: comments, whitespace,
   * formatting and object key order are ignored; array order is significant.
   * Malformed input is never equal to anything — parse errors on either side
   * yield `false` rather than comparing recovery-parser artifacts. Pure and
   * total.
   *
   * **Gotchas**
   *
   * Past {@link MAX_NESTING_DEPTH} the shared walker returns `false` rather
   * than overflowing. Parser-produced JSONC never reaches the cap, so both
   * operands of this method are already bounded.
   *
   * **Example** (Ignore comments, reject malformed input)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   *
   * console.log(Jsonc.equals('{ "a": 1 }', '{ "a": 1 // c\n }')); // true
   * console.log(Jsonc.equals("{ bad }", "{}")); // false
   * ```
   *
   * @param a - The first JSONC source.
   * @param b - The second JSONC source.
   * @returns `true` when `a` and `b` decode to structurally equal values.
   * @see {@link MAX_NESTING_DEPTH} for the shared walker depth cap that parser-produced JSONC never reaches.
   * @since 0.0.0
   */
  static equals(a: string, b: string): boolean {
    const ra = parseValueInternal(a, {});
    const rb = parseValueInternal(b, {});
    if (ra.errors.length > 0 || rb.errors.length > 0) {
      return false;
    }
    return deepEqual(ra.value, rb.value);
  }

  /**
   * Compare a JSONC string against an existing JavaScript value with the same
   * semantics as {@link Jsonc.equals}: malformed `text` yields `false`. Pure
   * and total.
   *
   * **Gotchas**
   *
   * Past {@link MAX_NESTING_DEPTH} comparison returns `false` rather than
   * overflowing. Parser-produced JSONC never reaches the cap; a hand-built
   * `value` nested past it is silently unequal to itself.
   *
   * **Example** (Compare JSONC text to a value)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   *
   * console.log(Jsonc.equalsValue('{ "port": 3000 // dev\n }', { port: 3000 })); // true
   * console.log(Jsonc.equalsValue("{ bad }", {})); // false
   * ```
   *
   * @param text - The JSONC source to decode and compare.
   * @param value - The plain JavaScript value to compare against.
   * @returns `true` when `text` decodes to a value structurally equal to
   *   `value`.
   * @see {@link MAX_NESTING_DEPTH} for the comparison depth cap that a hand-built value can exceed.
   * @since 0.0.0
   */
  static equalsValue(text: string, value: unknown): boolean {
    const r = parseValueInternal(text, {});
    if (r.errors.length > 0) {
      return false;
    }
    return deepEqual(r.value, value);
  }

  /**
   * A `Schema<unknown, string>` decoding JSONC with the given `options`
   * (defaults when omitted). Encoding is {@link Jsonc.stringifyResult} with
   * default options (2-space indent, byte-identical to
   * `JSON.stringify(value, null, 2)`), so comments do not survive a
   * round-trip encode; a {@link JsoncStringifyError} on the encode side
   * surfaces as a schema issue.
   *
   * **Details**
   *
   * Schema-producing: each call returns a fresh schema whose derivation caches
   * are not shared across calls. Bind the result to a `const` on hot paths;
   * for the default-options case use {@link Jsonc.JsoncFromString}.
   *
   * **Example** (Decode JSONC through the unknown codec)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Effect } from "effect";
   * import * as S from "effect/Schema";
   *
   * const JsoncUnknown = Jsonc.fromString();
   * const value = Effect.runSync(S.decodeUnknownEffect(JsoncUnknown)('{ "port": 3000 // dev\n }'));
   *
   * console.log(value); // { port: 3000 }
   * ```
   *
   * @param options - Optional {@link JsoncParseOptions} controlling the
   *   decode direction.
   * @see {@link Jsonc.schema} for composing this codec with a domain schema.
   * @since 0.0.0
   */
  static fromString(options?: JsoncParseOptions): Schema.Codec<unknown, string> {
    const flags = toFlags(options);
    return Schema.String.pipe(
      Schema.decodeTo(
        Schema.Unknown,
        SchemaTransformation.transformOrFail({
          decode: (input: string) => {
            const { value, errors } = parseValueInternal(input, flags);
            if (errors.length > 0) {
              const aggregate = JsoncParseError.make({ errors: toDetails(input, errors), input });
              return Effect.fail(new SchemaIssue.InvalidValue({ message: aggregate.message }, input));
            }
            return Effect.succeed(value);
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
   * The zero-config `Schema<unknown, string>` — `Jsonc.fromString()` with
   * default options, pre-bound so the common case needs no memoization
   * discipline.
   */
  static readonly JsoncFromString: Schema.Codec<unknown, string> = Jsonc.fromString();

  /**
   * Compose {@link Jsonc.fromString} with a target schema, yielding a
   * `Schema<A, string>` that decodes JSONC straight into a validated domain
   * value — the reason an Effect-native JSONC library exists.
   *
   * **Details**
   *
   * Schema-producing: bind the result to a `const` on hot paths (see
   * {@link Jsonc.fromString}).
   *
   * **Example** (Decode JSONC into a struct)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Effect } from "effect";
   * import * as S from "effect/Schema";
   *
   * const Config = S.Struct({ port: S.Number });
   * const ConfigFromJsonc = Jsonc.schema(Config);
   * const config = Effect.runSync(S.decodeUnknownEffect(ConfigFromJsonc)('{ "port": 3000 // dev\n }'));
   *
   * console.log(config.port); // 3000
   * ```
   *
   * @param target - The domain schema decoded values must satisfy.
   * @param options - Optional {@link JsoncParseOptions} controlling the JSONC
   *   decode step.
   * @see {@link Jsonc.bind} for pre-derived decode/encode directions.
   * @since 0.0.0
   */
  static schema<T, E, RD = never, RE = never>(
    target: Schema.Codec<T, E, RD, RE>,
    options?: JsoncParseOptions
  ): Schema.Codec<T, string, RD, RE> {
    // The double-cast is sound: `fromString` decodes to `Schema.Unknown`, whose
    // decoded type is `unknown` — precisely the decode-input any `target` codec
    // accepts. Re-typing `target`'s Encoded from `E` to `unknown` lets the two
    // compose; the resulting codec decodes `string -> T`, which the outer cast
    // restates. The runtime is untouched — only the Encoded type parameter is
    // widened, and `Schema.Unknown` accepts every value at runtime.
    return Jsonc.fromString(options).pipe(
      Schema.decodeTo(target as unknown as Schema.Codec<T, unknown, RD, RE>)
    ) as unknown as Schema.Codec<T, string, RD, RE>;
  }

  /**
   * Bind a target schema to the JSONC codec once, yielding the composed
   * schema plus pre-derived `decode`/`encode` directions — the
   * {@link Jsonc.schema} composition without the generic `Schema` machinery
   * at every use site. Binds the plain form only: default
   * {@link JsoncParseOptions} on decode, default stringify options on encode.
   *
   * Both directions fail with `Schema.SchemaError`, exactly as
   * `Schema.decodeEffect`/`Schema.encodeEffect` over {@link Jsonc.schema}
   * would; the target's decoding/encoding service requirements flow through.
   *
   * **Details**
   *
   * Schema-producing: each call composes a fresh schema and derives both
   * directions from it. Bind the result to a `const` — that single binding is
   * the point.
   *
   * **Example** (Bind decode and encode once)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Effect } from "effect";
   * import * as S from "effect/Schema";
   *
   * const Config = S.Struct({ port: S.Number });
   * const config = Jsonc.bind(Config);
   * const value = Effect.runSync(config.decode('{ "port": 3000 // dev\n }'));
   * const text = Effect.runSync(config.encode(value));
   *
   * console.log(value.port); // 3000
   * console.log(text.includes('"port"')); // true
   * ```
   *
   * @param target - The domain schema decoded values must satisfy.
   * @see {@link JsoncBoundCodec} for the returned decode/encode pair.
   */
  static bind<T, E, RD = never, RE = never>(target: Schema.Codec<T, E, RD, RE>): JsoncBoundCodec<T, RD, RE> {
    const schema = Jsonc.schema(target);
    return {
      schema,
      decode: Schema.decodeEffect(schema),
      encode: Schema.encodeEffect(schema),
    };
  }
}
