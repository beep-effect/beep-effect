// The `JsoncFingerprint` facade: canonical JSON serialization (RFC 8785, the
// JSON Canonicalization Scheme) and SHA-256 content fingerprints over it.
//
// The pure core is the JCS emitter: compact output, object keys sorted by
// UTF-16 code units, ECMAScript number serialization, with the package's
// usual `Result` primitive / spanned `Effect` twin arrangement. Hashing is the
// one effectful edge: it requires core's `Crypto.Crypto` service and owns no
// backend, so consumers provide a `Crypto` layer at the application edge.
//
// This is a deliberately different contract from `Jsonc.stringify`:
// fingerprints must never silently alter the document, so every non-JSON
// value is a typed failure carrying the JSON-pointer path to fix.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import { flow, identity } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import type { PlatformError } from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";

const $I = $ScratchpadId.create("effected/jsonc/JsoncFingerprint");

/**
 * The public canonicalize-error code vocabulary, appearing as the `code`
 * field of {@link JsoncCanonicalizeError}.
 *
 * **Details**
 *
 * - `UnrepresentableValue`: an `undefined`, function or symbol anywhere in the
 *   value, an array hole, or a property getter that threw during the read.
 * - `BigIntValue`: a `bigint` anywhere.
 * - `NonFiniteNumber`: `NaN` or an infinity, which RFC 8785 forbids.
 * - `LoneSurrogate`: a string value or member key with an unpaired UTF-16
 *   surrogate; RFC 8785 requires I-JSON (well-formed Unicode) input.
 * - `NonPlainObject`: an object that is neither an array nor a plain object.
 *   `toJSON` methods are deliberately ignored; encode domain values to plain
 *   JSON first.
 * - `NestingDepthExceeded`: nesting past the hardening cap, which also
 *   intercepts cyclic values.
 * - `InvalidDigest`: the {@link JsoncDigest} given to a synchronous twin threw
 *   or returned something other than 32 bytes. The `path` is `""`.
 *
 * **Example** (Guard a code with the kit)
 *
 * ```ts
 * import { JsoncCanonicalizeErrorCode } from "@beep/scratchpad/effected/jsonc/index"
 *
 * console.log(JsoncCanonicalizeErrorCode.is.LoneSurrogate("LoneSurrogate")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsoncCanonicalizeErrorCode = LiteralKit([
  "UnrepresentableValue",
  "BigIntValue",
  "NonFiniteNumber",
  "LoneSurrogate",
  "NonPlainObject",
  "NestingDepthExceeded",
  "InvalidDigest",
]).annotate(
  $I.annote("JsoncCanonicalizeErrorCode", {
    description: "Why a value could not be canonicalized or fingerprinted.",
  })
);

/**
 * The union of all canonicalize-error code string literals.
 *
 * @see {@link JsoncCanonicalizeErrorCode} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncCanonicalizeErrorCode = typeof JsoncCanonicalizeErrorCode.Type;

/**
 * Canonicalization failure: a {@link JsoncCanonicalizeErrorCode}, the
 * JSON-pointer `path` to the offending value (`""` is the root) and a
 * human-readable `detail`.
 *
 * **Example** (Locate the offending member)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { JsoncFingerprint } from "@beep/scratchpad/effected/jsonc/index"
 *
 * const result = JsoncFingerprint.canonicalizeResult({ a: { b: undefined } })
 *
 * if (Result.isFailure(result)) {
 *   console.log(result.failure.code) // "UnrepresentableValue"
 *   console.log(result.failure.path) // "/a/b"
 * }
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsoncCanonicalizeError extends S.TaggedError<JsoncCanonicalizeError>($I.make("JsoncCanonicalizeError"))(
  "JsoncCanonicalizeError",
  {
    code: JsoncCanonicalizeErrorCode,
    path: S.String,
    detail: S.String,
  },
  $I.annoteError<JsoncCanonicalizeError>("JsoncCanonicalizeError", {
    description: "A value that has no RFC 8785 canonical form, located by JSON pointer.",
  })
) {
  /**
   * Render the code, the JSON-pointer path and the detail as one line.
   *
   * **Example** (Read the rendered message)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { JsoncFingerprint } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const result = JsoncFingerprint.canonicalizeResult({ n: 1n })
   *
   * console.log(Result.isFailure(result) && result.failure.message.includes('BigIntValue at "/n"')) // true
   * ```
   */
  override get message(): string {
    return `Canonical JSON serialization failed: ${this.code} at "${this.path}" — ${this.detail}`;
  }
}

/**
 * Options controlling {@link JsoncFingerprint.hashText}. Every field has a
 * schema default.
 *
 * **Details**
 *
 * `normalizeEol` normalizes `\r\n` and bare `\r` to `\n` before hashing, so
 * the same file content fingerprints identically across checkout line-ending
 * settings. Defaults to `false`: the bytes hashed are exactly the UTF-8
 * encoding of the text given.
 *
 * **Example** (Construct the normalizing options)
 *
 * ```ts
 * import { JsoncTextHashOptions } from "@beep/scratchpad/effected/jsonc/index"
 *
 * console.log(JsoncTextHashOptions.make({}).normalizeEol) // false
 * console.log(JsoncTextHashOptions.make({ normalizeEol: true }).normalizeEol) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsoncTextHashOptions extends S.Class<JsoncTextHashOptions>($I`JsoncTextHashOptions`)(
  {
    normalizeEol: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  },
  $I.annote("JsoncTextHashOptions", {
    description: "Line-ending normalization applied before hashing raw text.",
  })
) {}

/**
 * The synchronous SHA-256 implementation the `Result` twins hash through,
 * supplied by the consumer because this module assumes no runtime.
 *
 * **Details**
 *
 * The function must compute SHA-256 over exactly the bytes it is given. Its
 * 32-byte output width is checked and a wrong width fails typed with the
 * `InvalidDigest` code, but no check can catch a different 32-byte algorithm.
 * It may throw: the throw surfaces as an `InvalidDigest` failure carrying its
 * message, never as an escaping exception.
 *
 * @see {@link JsoncFingerprint.hashResult} for the synchronous value twin.
 * @category services
 * @since 0.0.0
 */
export type JsoncDigest = (bytes: Uint8Array) => Uint8Array;

// ── Internal: the JCS emitter ───────────────────────────────────────────────

type Emit = Result.Result<string, JsoncCanonicalizeError>;

const escapePointerSegment = flow(Str.replaceAll("~", "~0"), Str.replaceAll("/", "~1"));

const fail = (code: JsoncCanonicalizeErrorCode, path: string, detail: string): Emit =>
  Result.fail(JsoncCanonicalizeError.make({ code, path, detail }));

// RFC 8785 string and number serialization match `JSON.stringify` exactly:
// the two-character escapes, lowercase `\u00xx` escapes for the remaining
// control characters, and ECMAScript shortest round-trip numbers. The codec
// is total for the finite, well-formed scalars `emit` feeds it, so the
// failure side is an invariant violation rather than a reachable path.
const encodeScalar = S.encodeResult(S.fromJsonString(S.Union([S.String, S.Finite, S.Boolean, S.Null])));

const emitScalar = (value: string | number | boolean | null): string =>
  Result.getOrThrowWith(encodeScalar(value), identity);

// Member and element reads go through this guard. An accessor property is
// invoked, matching `JSON.stringify` semantics, but a getter that throws must
// not escape as a raw exception through the `canonicalizeResult` boundary.
const readProperty = (container: object, key: string | number, path: string): Result.Result<unknown, JsoncCanonicalizeError> =>
  Result.try({
    try: () => Reflect.get(container, key),
    catch: () =>
      JsoncCanonicalizeError.make({
        code: "UnrepresentableValue",
        path,
        detail: "the property getter for this value threw; getters must return plain JSON values",
      }),
  });

const isPlainObject = (value: object): boolean => {
  const prototype: unknown = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const emitMembers = (
  container: object,
  keys: ReadonlyArray<string | number>,
  path: string,
  depth: number,
  render: (key: string | number, item: string) => string
): Result.Result<ReadonlyArray<string>, JsoncCanonicalizeError> =>
  Result.all(
    A.map(keys, (key) => {
      const memberPath = `${path}/${P.isString(key) ? escapePointerSegment(key) : key}`;
      return readProperty(container, key, memberPath).pipe(
        Result.flatMap((member) => emit(member, memberPath, depth + 1)),
        Result.map((item) => render(key, item))
      );
    })
  );

const emitArray = (value: ReadonlyArray<unknown>, path: string, depth: number): Emit =>
  // Indexed reads, never `map`: `map` skips holes, which must instead read as
  // `undefined` and fail typed at the hole's index.
  emitMembers(value, A.fromIterable(value.keys()), path, depth, (_, item) => item).pipe(
    Result.map((items) => `[${A.join(items, ",")}]`)
  );

const emitRecord = (value: { readonly [x: PropertyKey]: unknown }, path: string, depth: number): Emit => {
  if (!isPlainObject(value)) {
    return fail("NonPlainObject", path, "only arrays and plain objects canonicalize; encode domain values to plain JSON first");
  }
  // Member keys are strings too: an unpaired surrogate in a key is the same
  // RFC 8785 I-JSON violation as one in a value. Sorting by `<` compares
  // UTF-16 code units, the order RFC 8785 mandates.
  const keys = A.sort(R.keys(value), Order.String);
  const badKey = A.findFirst(keys, (key) => !key.isWellFormed());
  if (O.isSome(badKey)) {
    return fail(
      "LoneSurrogate",
      `${path}/${escapePointerSegment(badKey.value)}`,
      "object member key contains an unpaired surrogate; RFC 8785 requires well-formed Unicode"
    );
  }
  return emitMembers(value, keys, path, depth, (key, item) => `${emitScalar(String(key))}:${item}`).pipe(
    Result.map((members) => `{${A.join(members, ",")}}`)
  );
};

const emit = (value: unknown, path: string, depth: number): Emit => {
  if (P.isNull(value) || P.isBoolean(value)) {
    return Result.succeed(emitScalar(value));
  }
  if (P.isNumber(value)) {
    return S.is(S.Finite)(value)
      ? Result.succeed(emitScalar(value))
      : fail("NonFiniteNumber", path, "non-finite numbers have no canonical JSON representation");
  }
  if (P.isString(value)) {
    return value.isWellFormed()
      ? Result.succeed(emitScalar(value))
      : fail("LoneSurrogate", path, "string contains an unpaired surrogate; RFC 8785 requires well-formed Unicode");
  }
  if (P.isBigInt(value)) {
    return fail("BigIntValue", path, "bigint values cannot be represented in JSON");
  }
  if (!A.isArray(value) && !P.isObject(value)) {
    return fail("UnrepresentableValue", path, "undefined, function and symbol values have no JSON representation");
  }
  if (depth >= MAX_NESTING_DEPTH) {
    return fail("NestingDepthExceeded", path, `nesting exceeds ${MAX_NESTING_DEPTH} levels (a cyclic value also fails here)`);
  }
  return A.isArray(value) ? emitArray(value, path, depth) : emitRecord(value, path, depth);
};

const encoder = new TextEncoder();

// SHA-256 produces 32 bytes. The `Crypto.Crypto` path cannot return anything
// else; the caller-supplied `JsoncDigest` can, so the sync twins check it.
const SHA256_DIGEST_BYTES = 32;

const digestHexResult = (text: string, digest: JsoncDigest): Result.Result<string, JsoncCanonicalizeError> =>
  Result.try({
    try: () => digest(encoder.encode(text)),
    catch: (thrown) =>
      JsoncCanonicalizeError.make({
        code: "InvalidDigest",
        path: "",
        detail: `the supplied digest threw: ${P.isError(thrown) ? thrown.message : String(thrown)}`,
      }),
  }).pipe(
    Result.flatMap((bytes) =>
      bytes.length === SHA256_DIGEST_BYTES
        ? Result.succeed(Hex.encode(bytes))
        : fail("InvalidDigest", "", `the supplied digest returned ${bytes.length} bytes; SHA-256 produces ${SHA256_DIGEST_BYTES}`)
    )
  );

const digestHex = Effect.fnUntraced(function* (text: string) {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto.digest("SHA-256", encoder.encode(text));
  return Hex.encode(digest);
});

const normalizeEol = Str.replace(/\r\n?/g, "\n");

const prepareText = (text: string, options?: JsoncTextHashOptions): string =>
  (options ?? JsoncTextHashOptions.make({})).normalizeEol ? normalizeEol(text) : text;

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Static entry points for canonical JSON serialization (RFC 8785) and
 * SHA-256 content fingerprints. Not instantiable.
 *
 * **Details**
 *
 * Canonicalization is pure. The two hashing statics require core's
 * `Crypto.Crypto` service and own no backend; provide any `Crypto` layer at
 * the application edge. Their `Result` twins take the digest as a plain
 * function so a synchronous host hook can fingerprint at all.
 *
 * **Example** (Key order never matters)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { JsoncFingerprint } from "@beep/scratchpad/effected/jsonc/index"
 *
 * const a = JsoncFingerprint.canonicalizeResult({ b: 2, a: 1 })
 * const b = JsoncFingerprint.canonicalizeResult({ a: 1, b: 2 })
 *
 * console.log(Result.getOrThrow(a) === Result.getOrThrow(b)) // true
 * console.log(Result.getOrThrow(a)) // '{"a":1,"b":2}'
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export abstract class JsoncFingerprint {
  /**
   * Serialize a JSON value to its RFC 8785 canonical text, synchronously,
   * returning a `Result`.
   *
   * **Details**
   *
   * Compact output, object keys sorted by UTF-16 code units, ECMAScript
   * number serialization and `JSON.stringify` string escaping. Equal JSON
   * values canonicalize to equal strings. Unlike `Jsonc.stringify`, every
   * non-JSON value fails typed with the JSON-pointer path to fix: a
   * fingerprint of a silently altered document would be a lie.
   * {@link JsoncFingerprint.canonicalize} is defined in terms of this
   * function.
   *
   * **Example** (Canonicalize nested values)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { JsoncFingerprint } from "@beep/scratchpad/effected/jsonc/index"
   *
   * console.log(Result.getOrThrow(JsoncFingerprint.canonicalizeResult({ b: { d: 2, c: [1] }, a: null })))
   * // '{"a":null,"b":{"c":[1],"d":2}}'
   * ```
   *
   * @param value - The plain JSON value to serialize.
   * @returns The canonical JSON text, or a {@link JsoncCanonicalizeError}.
   */
  static canonicalizeResult(value: unknown): Result.Result<string, JsoncCanonicalizeError> {
    return emit(value, Str.empty, 0);
  }

  /**
   * Serialize a JSON value to its RFC 8785 canonical text.
   *
   * **Details**
   *
   * Fails with {@link JsoncCanonicalizeError} on any non-JSON value and on
   * nesting past the hardening cap. Defined in terms of
   * {@link JsoncFingerprint.canonicalizeResult}.
   *
   * **Example** (Canonicalize inside an Effect)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import { JsoncFingerprint } from "@beep/scratchpad/effected/jsonc/index"
   *
   * console.log(Effect.runSync(JsoncFingerprint.canonicalize([1, "x", true]))) // '[1,"x",true]'
   * ```
   *
   * @param value - The plain JSON value to serialize.
   */
  static readonly canonicalize = Effect.fn("JsoncFingerprint.canonicalize")((value: unknown) =>
    Effect.fromResult(JsoncFingerprint.canonicalizeResult(value))
  );

  /**
   * Normalize line endings for hashing: `\r\n` and bare `\r` become `\n`.
   *
   * **Details**
   *
   * Exactly the normalization {@link JsoncFingerprint.hashText} applies when
   * its `normalizeEol` option is set, exposed so split or inspect flows can
   * share it. Pure and total.
   *
   * **Example** (Normalize mixed endings)
   *
   * ```ts
   * import { JsoncFingerprint } from "@beep/scratchpad/effected/jsonc/index"
   *
   * console.log(JsoncFingerprint.normalizeEol("a\r\nb\rc\nd")) // "a\nb\nc\nd"
   * ```
   *
   * @param text - The text to normalize.
   * @returns The text with every line ending as `\n`.
   */
  static normalizeEol(text: string): string {
    return normalizeEol(text);
  }

  /**
   * The content fingerprint of a JSON value, computed synchronously through a
   * caller-supplied digest: the lowercase-hex SHA-256 of the UTF-8 bytes of
   * the value's RFC 8785 canonical serialization.
   *
   * **When to use**
   *
   * Use when there is no fiber to run {@link JsoncFingerprint.hash} in, such
   * as a bundler plugin's synchronous hook. The two agree byte for byte.
   *
   * **Example** (Fingerprint through WebCrypto-free SHA-256)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { JsoncFingerprint } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const digest = (bytes: Uint8Array): Uint8Array => new Uint8Array(32).fill(bytes.length)
   *
   * console.log(Result.getOrThrow(JsoncFingerprint.hashResult({ a: 1 }, digest)).length) // 64
   * ```
   *
   * @param value - The plain JSON value to fingerprint.
   * @param digest - The consumer's SHA-256 implementation.
   * @returns The 64-character lowercase-hex SHA-256, or a
   *   {@link JsoncCanonicalizeError} carrying the canonicalization failure or
   *   `InvalidDigest`.
   */
  static hashResult(value: unknown, digest: JsoncDigest): Result.Result<string, JsoncCanonicalizeError> {
    return Result.flatMap(JsoncFingerprint.canonicalizeResult(value), (text) => digestHexResult(text, digest));
  }

  /**
   * The content fingerprint of a JSON value: the lowercase-hex SHA-256 of
   * the UTF-8 bytes of its RFC 8785 canonical serialization.
   *
   * **Details**
   *
   * Values that differ only in object key order fingerprint identically.
   * Requires core's `Crypto.Crypto` service; the digest can fail with the
   * platform's `PlatformError`, passed through untranslated. The output is
   * exactly 64 lowercase hexadecimal characters with no algorithm prefix.
   *
   * **Example** (Fingerprint with a WebCrypto-backed service)
   *
   * ```ts
   * import * as Crypto from "effect/Crypto"
   * import * as Effect from "effect/Effect"
   * import { JsoncFingerprint } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const WebCrypto = Crypto.make({
   *   randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
   *   digest: (algorithm, data) =>
   *     Effect.map(Effect.promise(() => globalThis.crypto.subtle.digest(algorithm, new Uint8Array(data))), (buffer) => new Uint8Array(buffer)),
   * })
   *
   * const program = JsoncFingerprint.hash({ b: 2, a: 1 }).pipe(Effect.provideService(Crypto.Crypto, WebCrypto))
   *
   * Effect.runPromise(program).then((hex) => console.log(hex.length)) // 64
   * ```
   *
   * @param value - The plain JSON value to fingerprint.
   */
  static readonly hash = Effect.fn("JsoncFingerprint.hash")(
    (value: unknown): Effect.Effect<string, JsoncCanonicalizeError | PlatformError, Crypto.Crypto> =>
      Effect.flatMap(Effect.fromResult(JsoncFingerprint.canonicalizeResult(value)), digestHex)
  );

  /**
   * The content fingerprint of raw text, computed synchronously through a
   * caller-supplied digest, with the same opt-in line-ending normalization as
   * {@link JsoncFingerprint.hashText}.
   *
   * **Example** (Normalize before hashing)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { JsoncFingerprint, JsoncTextHashOptions } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const digest = (bytes: Uint8Array): Uint8Array => new Uint8Array(32).fill(bytes.length)
   * const options = JsoncTextHashOptions.make({ normalizeEol: true })
   *
   * const crlf = JsoncFingerprint.hashTextResult("a\r\nb", digest, options)
   * const lf = JsoncFingerprint.hashTextResult("a\nb", digest, options)
   *
   * console.log(Result.getOrThrow(crlf) === Result.getOrThrow(lf)) // true
   * ```
   *
   * @param text - The text content to fingerprint.
   * @param digest - The consumer's SHA-256 implementation.
   * @param options - Hash options; omitted fields take their defaults.
   * @returns The 64-character lowercase-hex SHA-256, or a
   *   {@link JsoncCanonicalizeError} carrying `InvalidDigest`.
   */
  static hashTextResult(
    text: string,
    digest: JsoncDigest,
    options?: JsoncTextHashOptions
  ): Result.Result<string, JsoncCanonicalizeError> {
    return digestHexResult(prepareText(text, options), digest);
  }

  /**
   * The content fingerprint of raw text: the lowercase-hex SHA-256 of its
   * UTF-8 bytes, with opt-in line-ending normalization.
   *
   * **Details**
   *
   * Requires core's `Crypto.Crypto` service. The output is exactly 64
   * lowercase hexadecimal characters with no algorithm prefix.
   *
   * **Example** (Hash text with a WebCrypto-backed service)
   *
   * ```ts
   * import * as Crypto from "effect/Crypto"
   * import * as Effect from "effect/Effect"
   * import { JsoncFingerprint, JsoncTextHashOptions } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const WebCrypto = Crypto.make({
   *   randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
   *   digest: (algorithm, data) =>
   *     Effect.map(Effect.promise(() => globalThis.crypto.subtle.digest(algorithm, new Uint8Array(data))), (buffer) => new Uint8Array(buffer)),
   * })
   *
   * const program = JsoncFingerprint.hashText("line one\r\nline two", JsoncTextHashOptions.make({ normalizeEol: true })).pipe(
   *   Effect.provideService(Crypto.Crypto, WebCrypto)
   * )
   *
   * Effect.runPromise(program).then((hex) => console.log(hex.length)) // 64
   * ```
   *
   * @param text - The text content to fingerprint.
   * @param options - Hash options; omitted fields take their defaults.
   */
  static readonly hashText = Effect.fn("JsoncFingerprint.hashText")(
    (text: string, options?: JsoncTextHashOptions): Effect.Effect<string, PlatformError, Crypto.Crypto> =>
      digestHex(prepareText(text, options))
  );
}
