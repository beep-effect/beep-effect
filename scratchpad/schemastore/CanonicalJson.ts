/**
 * Deterministic JSON text for committed SchemaStore files.
 *
 * Object keys stay in insertion order, line endings are LF, and every
 * document ends with a trailing newline so committed schema files are
 * byte-stable across runs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Effect, Match, Result, Schema } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";

const $I = $ScratchpadId.create("schemastore/CanonicalJson");

class InvalidCanonicalJsonIndent extends Schema.TaggedError<InvalidCanonicalJsonIndent>($I`InvalidCanonicalJsonIndent`)(
  "InvalidCanonicalJsonIndent",
  { indent: Schema.Finite }
) {}

/**
 * Indicates that a value reachable from the serialization input is not a
 * JSON value: `undefined`, a function, a symbol, a `bigint`, a non-finite
 * number, or an object that is neither an array nor a plain object.
 *
 * Raised by {@link CanonicalJson.serialize}. Unlike `JSON.stringify` — which
 * silently drops `undefined` members and rewrites `NaN`/`Infinity` to
 * `null` — canonical serialization refuses to alter the document, so every
 * non-JSON value is a typed failure carrying the path to fix.
 *
 * **Example** (Refuse undefined instead of dropping it)
 *
 * ```ts
 * import { CanonicalJson, NonJsonValueError } from "@beep/scratchpad/schemastore"
 * import { Result } from "effect"
 *
 * const failed = CanonicalJson.serializeResult({ missing: undefined })
 *
 * console.log(Result.isFailure(failed) && failed.failure instanceof NonJsonValueError)
 * // => true
 * if (Result.isFailure(failed) && failed.failure instanceof NonJsonValueError) {
 *   console.log(failed.failure.found)
 *   // => "undefined"
 * }
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class NonJsonValueError extends Schema.TaggedError<NonJsonValueError>($I`NonJsonValueError`)(
  "NonJsonValueError",
  {
    /** JSON pointer to the offending value (`""` is the document root). */
    path: Schema.String,
    /** The `typeof`/structural description of the rejected value. */
    found: Schema.String,
  },
  $I.annote("NonJsonValueError", {
    description:
      "Raised when canonical JSON serialization reaches a non-JSON value such as undefined, NaN, bigint, or a non-plain object.",
  })
) {
  /**
   * Operator-facing sentence naming the non-JSON kind and JSON pointer.
   *
   * **Example** (Read found kind and path)
   *
   * ```ts
   * import { NonJsonValueError } from "@beep/scratchpad/schemastore"
   *
   * const error = NonJsonValueError.make({ path: "/missing", found: "undefined" })
   * console.log(error.message)
   * // => 'Non-JSON value (undefined) at "/missing"'
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `Non-JSON value (${this.found}) at "${this.path}"`;
  }
}

/**
 * Indicates that the serialization input nests deeper than the package's
 * hardening cap (256 levels), which also intercepts cyclic values before
 * they can recurse forever.
 *
 * Raised by {@link CanonicalJson.serialize}.
 *
 * **Example** (Construct the depth-cap error)
 *
 * ```ts
 * import { JsonDepthExceededError } from "@beep/scratchpad/schemastore"
 *
 * const error = JsonDepthExceededError.make({ path: "", maxDepth: 256 })
 *
 * console.log(error._tag)
 * // => "JsonDepthExceededError"
 * console.log(error.maxDepth)
 * // => 256
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JsonDepthExceededError extends Schema.TaggedError<JsonDepthExceededError>($I`JsonDepthExceededError`)(
  "JsonDepthExceededError",
  {
    /** JSON pointer to the node where the cap was hit. */
    path: Schema.String,
    /** The nesting cap that was exceeded. */
    maxDepth: Schema.Finite,
  },
  $I.annote("JsonDepthExceededError", {
    description:
      "Raised when canonical JSON serialization nests past the 256-level hardening cap, including cyclic values.",
  })
) {
  /**
   * Operator-facing sentence naming the nesting cap and JSON pointer.
   *
   * **Example** (Read the cap from the message)
   *
   * ```ts
   * import { JsonDepthExceededError } from "@beep/scratchpad/schemastore"
   *
   * const error = JsonDepthExceededError.make({ path: "", maxDepth: 256 })
   * console.log(error.message)
   * // => 'JSON nesting exceeds 256 levels at ""'
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `JSON nesting exceeds ${this.maxDepth} levels at "${this.path}"`;
  }
}

/**
 * Union of the failures {@link CanonicalJson.serialize} can raise.
 *
 * @see {@link CanonicalJson.serialize} for the Effect form that fails with this union.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalJsonError = NonJsonValueError | JsonDepthExceededError;

/**
 * Options for {@link CanonicalJson.serialize}.
 *
 * **Example** (Construct space-indentation options)
 *
 * ```ts
 * import { CanonicalJsonOptions } from "@beep/scratchpad/schemastore"
 *
 * const options = CanonicalJsonOptions.make({ indent: 2 })
 * console.log(options.indent) // 2
 * ```
 *
 * @see {@link CanonicalJson.serialize} for the serializer these options configure.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CanonicalJsonOptions = Schema.Struct({
  /**
   * Indentation unit: `"tab"` (the default, matching the repo formatter
   * convention the extraction source committed its files under) or a
   * space count — a non-negative integer (`0` emits multi-line output
   * with no leading indentation). Counts above 10 are honored as given,
   * deliberately diverging from `JSON.stringify`'s silent clamp to 10.
   * A negative or fractional count is a wiring mistake and throws (the
   * serializer alters nothing silently — not even its own options).
   */
  indent: Schema.optionalKey(Schema.Union([Schema.Literal("tab"), Schema.Finite])),
}).pipe(
  $I.annoteSchema("CanonicalJsonOptions", {
    description: "Canonical JSON indentation configuration.",
  })
);

/**
 * Decoded canonical JSON serialization options.
 *
 * @see {@link CanonicalJsonOptions} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalJsonOptions = typeof CanonicalJsonOptions.Type;

// Internal throw carrier so the single recursive emitter can surface either
// typed error from arbitrary depth without threading Results through the walk.
class SerializeFailure {
  readonly error: CanonicalJsonError;

  constructor(error: CanonicalJsonError) {
    this.error = error;
  }
}

const escapePointerSegment = (segment: string): string => segment.replace(/~/g, "~0").replace(/\//g, "~1");

/**
 * Deterministic, canonical JSON text: the package's owned serializer, so a
 * consumer never shells out to an external formatter to produce a stable
 * committed schema file.
 *
 * The canonical form is fully specified: object keys in insertion order
 * (document assembly owns meaningful ordering — keys are never sorted),
 * every array element and object member on its own line, the configured
 * indent (tab by default), `"` string escaping exactly as `JSON.stringify`
 * produces it, LF line endings and a single trailing newline. Equal inputs
 * serialize to equal bytes.
 *
 * Values that are not JSON fail typed rather than being silently rewritten
 * (see {@link NonJsonValueError}); nesting past the hardening cap — which
 * includes cyclic values — fails with {@link JsonDepthExceededError}.
 *
 * **Gotchas**
 *
 * A negative or fractional `indent` throws a bare `Error` (a wiring mistake,
 * not {@link CanonicalJsonError}). Counts above 10 are honored, unlike
 * `JSON.stringify`'s silent clamp. Keys are never sorted. `undefined`,
 * `NaN`, `Infinity`, bigint, function, and non-plain objects fail typed
 * instead of being rewritten.
 *
 * **Example** (Preserve insertion order and trailing newline)
 *
 * ```ts
 * import { CanonicalJson } from "@beep/scratchpad/schemastore"
 * import { Result } from "effect"
 *
 * const text = CanonicalJson.serializeResult({ b: 1, a: 2 })
 *
 * console.log(Result.isSuccess(text) ? text.success : text.failure)
 * // => "{\n\t\"b\": 1,\n\t\"a\": 2\n}\n"
 * ```
 *
 * @throws A negative or fractional `indent` throws `Error` because option
 * validation is a wiring mistake, not a document-data failure.
 * @see {@link StoreDocument.serializeResult} for the document wrapper that uses this engine.
 * @see {@link NonJsonValueError} for the typed refusal of non-JSON values.
 * @see {@link JsonDepthExceededError} for the typed depth/cycle failure.
 * @public
 * @category encoding
 * @since 0.0.0
 */
export class CanonicalJson {
  private constructor() {}

  /**
   * Serializes `value` to canonical JSON text. Pure and synchronous — the
   * primitive form; {@link CanonicalJson.serialize} is the same engine
   * behind a span.
   *
   * **Example** (Preserve insertion order and trailing newline)
   *
   * ```ts
   * import { CanonicalJson } from "@beep/scratchpad/schemastore"
   * import { Result } from "effect"
   *
   * const text = CanonicalJson.serializeResult({ b: 1, a: 2 })
   *
   * console.log(Result.isSuccess(text) ? text.success : text.failure)
   * // => "{\n\t\"b\": 1,\n\t\"a\": 2\n}\n"
   * ```
   *
   * @since 0.0.0
   */
  static serializeResult(value: unknown, options?: CanonicalJsonOptions): Result.Result<string, CanonicalJsonError> {
    const unit = options?.indent === undefined || options.indent === "tab" ? "\t" : indentUnit(options.indent);
    try {
      return Result.succeed(`${emit(value, "", 0, unit)}\n`);
    } catch (cause) {
      if (cause instanceof SerializeFailure) {
        return Result.fail(cause.error);
      }
      throw cause;
    }
  }

  /**
   * Effect form of {@link CanonicalJson.serializeResult}, adding only the
   * `CanonicalJson.serialize` span. Defined in terms of the `Result`
   * primitive — synchronous callers can use that variant directly.
   */
  static readonly serialize = Effect.fn("CanonicalJson.serialize")(
    (value: unknown, options?: CanonicalJsonOptions): Effect.Effect<string, CanonicalJsonError> =>
      Effect.fromResult(CanonicalJson.serializeResult(value, options))
  );
}

// A numeric indent must be a non-negative integer: `" ".repeat` throws a
// bare RangeError on negatives and silently floors fractions — both are
// wiring mistakes (an option, not document data), so they throw with a
// message naming the contract rather than failing typed or being rewritten.
const indentUnit = (indent: number): string => {
  if (!Number.isInteger(indent) || indent < 0) {
    throw InvalidCanonicalJsonIndent.make({ indent });
  }
  return " ".repeat(indent);
};

const emit = (value: unknown, path: string, depth: number, unit: string): string => {
  if (value === null) {
    return "null";
  }
  const primitive = Match.value(value).pipe(
    Match.when(P.isBoolean, (value) => (value ? "true" : "false")),
    Match.when(P.isNumber, (value) => {
      if (!Number.isFinite(value)) {
        throw new SerializeFailure(NonJsonValueError.make({ path, found: String(value) }));
      }
      return JSON.stringify(value);
    }),
    Match.when(P.isString, (value) => JSON.stringify(value)),
    Match.when(P.isObjectKeyword, () => undefined),
    Match.orElse((value) => {
      const found = Match.value(value).pipe(
        Match.when(P.isUndefined, () => "undefined"),
        Match.when(P.isBigInt, () => "bigint"),
        Match.when(P.isSymbol, () => "symbol"),
        Match.when(P.isFunction, () => "function"),
        Match.orElse(() => "unknown")
      );
      throw new SerializeFailure(NonJsonValueError.make({ path, found }));
    })
  );
  if (primitive !== undefined) return primitive;
  if (depth >= MAX_NESTING_DEPTH) {
    throw new SerializeFailure(JsonDepthExceededError.make({ path, maxDepth: MAX_NESTING_DEPTH }));
  }
  const indent = unit.repeat(depth + 1);
  const closing = unit.repeat(depth);
  if (A.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((item, index) => `${indent}${emit(item, `${path}/${index}`, depth + 1, unit)}`);
    return `[\n${items.join(",\n")}\n${closing}]`;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new SerializeFailure(NonJsonValueError.make({ path, found: "non-plain object" }));
  }
  const entries = R.toEntries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return "{}";
  }
  const members = entries.map(
    ([key, member]) =>
      `${indent}${JSON.stringify(key)}: ${emit(member, `${path}/${escapePointerSegment(key)}`, depth + 1, unit)}`
  );
  return `{\n${members.join(",\n")}\n${closing}}`;
};
