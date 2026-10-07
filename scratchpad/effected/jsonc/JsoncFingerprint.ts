import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { flow } from "effect/Function";
import { LiteralKit } from "@beep/schema/LiteralKit";
// The `JsoncFingerprint` facade: canonical JSON serialization (RFC 8785, JSON
// Canonicalization Scheme) and SHA-256 content fingerprints over it.
//
// The pure core is the JCS emitter — compact output, object keys sorted by
// UTF-16 code units, ES number serialization — with the package's usual
// `Result` primitive / spanned `Effect` twin arrangement. Hashing is the one
// effectful edge: it requires core's `Crypto.Crypto` service in `R` and owns
// no backend, so consumers provide `@effect/platform-node`'s
// `NodeCrypto.layer` (or any `Crypto` layer) at the application edge.
//
// This is a deliberately different contract from `Jsonc.stringify` (plain
// `JSON.stringify` semantics — nested unrepresentables dropped or nulled):
// fingerprints must never silently alter the document, so every non-JSON
// value is a typed failure carrying the JSON-pointer path to fix.

import type { PlatformError } from "effect";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Hex from "effect/encoding/Hex";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";

/**
 * The public canonicalize-error code vocabulary, appearing as the `code` field
 * of {@link JsoncCanonicalizeError}:
 *
 * - `UnrepresentableValue` — an `undefined`, function or symbol anywhere in
 *   the value. Unlike `Jsonc.stringify` (which follows `JSON.stringify`'s
 *   drop/null semantics for nested cases), canonicalization refuses to alter
 *   the document, so these fail typed at any position. Array holes read as
 *   `undefined` and fail here too, carrying the hole's index in `path`. A
 *   property getter that throws during the read also fails here, at the
 *   member's path — a benign getter's value canonicalizes normally, matching
 *   `JSON.stringify`'s accessor semantics.
 * - `BigIntValue` — a `bigint` (anywhere), which JSON cannot represent.
 * - `NonFiniteNumber` — `NaN`, `Infinity` or `-Infinity`, which RFC 8785
 *   forbids (`JSON.stringify` would silently rewrite them to `null`).
 * - `LoneSurrogate` — a string value or object member key containing an
 *   unpaired UTF-16 surrogate. RFC 8785 requires I-JSON (RFC 7493) input,
 *   which malformed Unicode is not (`JSON.stringify` would silently emit a
 *   `\udxxx` escape).
 * - `NonPlainObject` — an object that is neither an array nor a plain object
 *   (a `Date`, `Map`, class instance, …). `toJSON` methods are deliberately
 *   ignored; encode domain values to plain JSON (e.g. via `Schema`) first.
 * - `NestingDepthExceeded` — the value nests deeper than the package
 *   hardening cap, which also intercepts cyclic values before they can
 *   recurse forever.
 * - `InvalidDigest` — the {@link JsoncDigest} supplied to
 *   {@link JsoncFingerprint.hashResult} or
 *   {@link JsoncFingerprint.hashTextResult} threw, or returned something
 *   other than a 32-byte SHA-256 digest. The `path` is `""`: the failure is
 *   the caller's platform binding, not a position in the document.
 *
 * @public
 */
export const JsoncCanonicalizeErrorCode = LiteralKit([
	"UnrepresentableValue",
	"BigIntValue",
	"NonFiniteNumber",
	"LoneSurrogate",
	"NonPlainObject",
	"NestingDepthExceeded",
	"InvalidDigest",
]);

/**
 * The union of all canonicalize-error code string literals.
 *
 * @public
 */
export type JsoncCanonicalizeErrorCode = typeof JsoncCanonicalizeErrorCode.Type;

/**
 * Canonicalization failure: a `JsoncCanonicalizeErrorCode` naming the
 * failure mode, the JSON-pointer `path` to the offending value (`""` is the
 * document root) and a human-readable `detail`. Raised by
 * {@link JsoncFingerprint.canonicalize},
 * {@link JsoncFingerprint.canonicalizeResult},
 * {@link JsoncFingerprint.hash}, {@link JsoncFingerprint.hashResult} and
 * {@link JsoncFingerprint.hashTextResult}.
 *
 * @public
 */
export class JsoncCanonicalizeError extends S.TaggedError<JsoncCanonicalizeError>()("JsoncCanonicalizeError", {
	code: JsoncCanonicalizeErrorCode,
	path: S.String,
	detail: S.String,
}) {
	override get message(): string {
		return `Canonical JSON serialization failed: ${this.code} at "${this.path}" — ${this.detail}`;
	}
}

/**
 * Options controlling {@link JsoncFingerprint.hashText}. All fields are
 * omissible.
 *
 * - `normalizeEol` — normalize `\r\n` and bare `\r` line endings to `\n`
 *   before hashing, so the same file content fingerprints identically across
 *   checkout line-ending settings. Defaults to `false` — by default the bytes
 *   hashed are exactly the UTF-8 encoding of the text given.
 *
 * @public
 */
export class JsoncTextHashOptions extends S.Class<JsoncTextHashOptions>("JsoncTextHashOptions")({
	normalizeEol: S.optionalKey(S.Boolean),
}) {}

// ── Internal: the JCS emitter ───────────────────────────────────────────────

const escapePointerSegment = flow(Str.replaceAll("~", "~0"), Str.replaceAll("/", "~1"));

const encodePrimitive = S.encodeResult(S.fromJsonString(S.Union([S.String, S.Finite, S.Boolean, S.Null])));

const readProperty = (container: object, key: string | number, path: string): Result.Result<unknown, JsoncCanonicalizeError> =>
  Result.try({
    try: () => Reflect.get(container, key),
    catch: () => JsoncCanonicalizeError.make({
      code: "UnrepresentableValue", path,
      detail: "the property getter for this value threw; getters must return plain JSON values",
    }),
  });

const emit = (value: unknown, path: string, depth: number): Result.Result<string, JsoncCanonicalizeError> =>
  Result.gen(function* () {
    if (P.isNull(value) || P.isBoolean(value) || P.isNumber(value) || P.isString(value)) {
      if (P.isNumber(value) && !S.is(S.Finite)(value)) {
        return yield* Result.fail(JsoncCanonicalizeError.make({ code: "NonFiniteNumber", path,
          detail: "non-finite numbers have no canonical JSON representation" }));
      }
      if (P.isString(value) && !value.isWellFormed()) {
        return yield* Result.fail(JsoncCanonicalizeError.make({ code: "LoneSurrogate", path,
          detail: "string contains an unpaired surrogate; RFC 8785 requires well-formed Unicode" }));
      }
      return yield* encodePrimitive(value).pipe(Result.mapError((error) =>
        JsoncCanonicalizeError.make({ code: "UnrepresentableValue", path, detail: error.message })));
    }
    if (P.isBigInt(value)) {
      return yield* Result.fail(JsoncCanonicalizeError.make({ code: "BigIntValue", path,
        detail: "bigint values cannot be represented in JSON" }));
    }
    if (!P.isObjectKeyword(value)) {
      return yield* Result.fail(JsoncCanonicalizeError.make({ code: "UnrepresentableValue", path,
        detail: "undefined, function and symbol values have no JSON representation" }));
    }
    if (depth >= MAX_NESTING_DEPTH) {
      return yield* Result.fail(JsoncCanonicalizeError.make({ code: "NestingDepthExceeded", path,
        detail: `nesting exceeds ${MAX_NESTING_DEPTH} levels (a cyclic value also fails here)` }));
    }
    if (A.isArray(value)) {
      const items: Array<string> = [];
      for (let index = 0; index < value.length; index++) {
        const itemPath = `${path}/${index}`;
        const item = yield* readProperty(value, index, itemPath);
        items.push(yield* emit(item, itemPath, depth + 1));
      }
      return `[${A.join(items, ",")}]`;
    }
    const prototype: unknown = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return yield* Result.fail(JsoncCanonicalizeError.make({ code: "NonPlainObject", path,
        detail: "only arrays and plain objects canonicalize; encode domain values to plain JSON first" }));
    }
    const keys = A.sort(Reflect.ownKeys(value).filter(P.isString).filter((key) =>
      Reflect.getOwnPropertyDescriptor(value, key)?.enumerable === true), Order.String);
    const members: Array<string> = [];
    for (const key of keys) {
      const memberPath = `${path}/${escapePointerSegment(key)}`;
      if (!key.isWellFormed()) {
        return yield* Result.fail(JsoncCanonicalizeError.make({ code: "LoneSurrogate", path: memberPath,
          detail: "object member key contains an unpaired surrogate; RFC 8785 requires well-formed Unicode" }));
      }
      const keyText = yield* encodePrimitive(key).pipe(Result.mapError((error) =>
        JsoncCanonicalizeError.make({ code: "UnrepresentableValue", path: memberPath, detail: error.message })));
      const member = yield* readProperty(value, key, memberPath);
      members.push(`${keyText}:${yield* emit(member, memberPath, depth + 1)}`);
    }
    return `{${A.join(members, ",")}}`;
  });

/**
 * The synchronous SHA-256 implementation {@link JsoncFingerprint.hashResult}
 * and {@link JsoncFingerprint.hashTextResult} hash through, supplied by the
 * consumer because this package imports no `node:*` and assumes no runtime.
 *
 * Node's built-in satisfies it with a one-line wrapper:
 *
 * ```ts
 * import { createHash } from "node:crypto";
 * import type { JsoncDigest } from "@effected/jsonc";
 *
 * const digest: JsoncDigest = (bytes) => createHash("sha256").update(bytes).digest();
 * ```
 *
 * The platform binding is entirely the caller's — the same shape
 * `@effected/tsconfig-json`'s `TsconfigLoaderSyncOptions` uses. The function
 * **must** compute SHA-256 over exactly the bytes it is given: the digest's
 * 32-byte length is checked (a wrong-length return fails typed with the
 * `InvalidDigest` code), but no check can catch a different 32-byte
 * algorithm, and the 64-lowercase-hex output guarantee is only as good as
 * what is passed here.
 *
 * It **may throw** — an unsupported algorithm name, a crypto backend refusing
 * to work in this environment. The throw surfaces as an `InvalidDigest`
 * failure carrying its message in `detail`, never as an escaping exception:
 * these twins exist to be called from synchronous host hooks, and crashing
 * one over a platform-binding mistake would defeat the point.
 *
 * @public
 */
export type JsoncDigest = (bytes: Uint8Array) => Uint8Array;

const encoder = new TextEncoder();

// SHA-256 produces 32 bytes. The `Crypto.Crypto` path cannot return anything
// else; the caller-supplied `JsoncDigest` can, so the sync twins check it
// rather than quietly emitting a digest of the wrong width under a contract
// that promises 64 hex characters.
const SHA256_DIGEST_BYTES = 32;

const digestHexResult = (text: string, digest: JsoncDigest): Result.Result<string, JsoncCanonicalizeError> => {
	// A caller's platform binding can fail two ways, and both must arrive as a
	// `Result`: the digest can THROW (`createHash("sha-256")` — hyphenated —
	// throws `ERR_CRYPTO_UNKNOWN_DIGEST` on Node), and it can return the wrong
	// width. An escaping exception would cross the `Result` contract and crash
	// the synchronous host these twins exist to serve, so the call is wrapped
	// exactly as `TsconfigLoaderSync` wraps the consumer's `readFile`.
	let bytes: Uint8Array;
	try {
		bytes = digest(encoder.encode(text));
	} catch (thrown) {
		return Result.fail(
			JsoncCanonicalizeError.make({
				code: "InvalidDigest",
				path: "",
				detail: `the supplied digest threw: ${thrown instanceof Error ? thrown.message : String(thrown)}`,
			}),
		);
	}
	if (bytes.length !== SHA256_DIGEST_BYTES) {
		return Result.fail(
			JsoncCanonicalizeError.make({
				code: "InvalidDigest",
				path: "",
				detail: `the supplied digest returned ${String(bytes.length)} bytes; SHA-256 produces ${SHA256_DIGEST_BYTES}`,
			}),
		);
	}
	return Result.succeed(Hex.encode(bytes));
};

const digestHex = Effect.fn("JsoncFingerprint.digestHex")(function* (text: string) {
		const crypto = yield* Crypto.Crypto;
		const digest = yield* crypto.digest("SHA-256", encoder.encode(text));
		return Hex.encode(digest);
	});

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Static entry points for canonical JSON serialization (RFC 8785, the JSON
 * Canonicalization Scheme) and SHA-256 content fingerprints. Not instantiable.
 *
 * Canonicalization is pure; the two hashing statics require core's
 * `Crypto.Crypto` service in `R` and own no backend — provide
 * `@effect/platform-node`'s `NodeCrypto.layer` (or any `Crypto` layer, e.g.
 * one built with `Crypto.make` over WebCrypto) at the application edge.
 *
 * @example
 * ```ts
 * import { JsoncFingerprint } from "@effected/jsonc";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   // Key order never matters: both values fingerprint identically.
 *   const a = yield* JsoncFingerprint.hash({ b: 2, a: 1 });
 *   const b = yield* JsoncFingerprint.hash({ a: 1, b: 2 });
 *   return a === b; // true
 * });
 * // Provide a Crypto layer at the edge, e.g. NodeCrypto.layer from
 * // "@effect/platform-node".
 * ```
 *
 * @public
 */
export abstract class JsoncFingerprint {

	/**
	 * Serialize a JSON value to its RFC 8785 canonical text, synchronously,
	 * returning a `Result` instead of an `Effect`: compact output (no
	 * whitespace), object keys sorted lexicographically by UTF-16 code units,
	 * ECMAScript number serialization and `JSON.stringify` string escaping.
	 * Equal JSON values canonicalize to equal strings.
	 *
	 * Unlike {@link Jsonc.stringify} — which follows `JSON.stringify`'s
	 * documented drop/null semantics for nested unrepresentables — every
	 * non-JSON value fails typed here, carrying the JSON-pointer path to fix:
	 * a fingerprint of a silently altered document would be a lie.
	 *
	 * @remarks
	 * {@link JsoncFingerprint.canonicalize} is defined in terms of this
	 * function; the two never diverge. Reach for the `Effect` variant inside
	 * Effect code — it carries the `JsoncFingerprint.canonicalize` tracing
	 * span — and for this one at synchronous boundaries.
	 *
	 * @example
	 * ```ts
	 * import { JsoncFingerprint } from "@effected/jsonc";
	 * import { Result } from "effect";
	 *
	 * const ok = JsoncFingerprint.canonicalizeResult({ b: 2, a: 1 });
	 * if (Result.isSuccess(ok)) {
	 *   console.log(ok.success); // => '{"a":1,"b":2}'
	 * }
	 *
	 * const bad = JsoncFingerprint.canonicalizeResult({ a: { b: undefined } });
	 * if (Result.isFailure(bad)) {
	 *   console.log(bad.failure.code); // => "UnrepresentableValue"
	 *   console.log(bad.failure.path); // => "/a/b"
	 * }
	 * ```
	 *
	 * @param value - The plain JSON value (`null`, booleans, finite numbers,
	 *   strings, arrays, plain objects) to serialize.
	 * @returns A `Result` succeeding with the canonical JSON text, or failing
	 *   with a {@link JsoncCanonicalizeError}.
	 */
	static canonicalizeResult(value: unknown): Result.Result<string, JsoncCanonicalizeError> {
		return emit(value, "", 0);
	}

	/**
	 * Serialize a JSON value to its RFC 8785 canonical text. Fails with
	 * {@link JsoncCanonicalizeError} on any non-JSON value (`undefined`,
	 * functions, symbols, `bigint`, non-finite numbers, strings or member keys
	 * with unpaired surrogates, non-plain objects) and
	 * on nesting past the hardening cap (which also intercepts cycles).
	 * Defined in terms of {@link JsoncFingerprint.canonicalizeResult} —
	 * synchronous callers can use that variant directly.
	 *
	 * @param value - The plain JSON value to serialize.
	 * @returns An `Effect` that succeeds with the canonical JSON text, or
	 *   fails with a {@link JsoncCanonicalizeError}.
	 */
	static readonly canonicalize = Effect.fn("JsoncFingerprint.canonicalize")((value: unknown) =>
		Effect.fromResult(JsoncFingerprint.canonicalizeResult(value)),
	);

	/**
	 * Normalize line endings for hashing: `\r\n` and bare `\r` become `\n`.
	 * Pure and total — exactly the normalization
	 * {@link JsoncFingerprint.hashText} applies when its `normalizeEol` option
	 * is set, exposed so split/inspect flows can share it.
	 *
	 * @param text - The text to normalize.
	 * @returns The text with all line endings as `\n`.
	 */
	static normalizeEol(text: string): string {
		return text.replace(/\r\n?/g, "\n");
	}

	/**
	 * The content fingerprint of a JSON value, computed synchronously through
	 * a caller-supplied digest and returned as a `Result` instead of an
	 * `Effect`: the lowercase-hex SHA-256 of the UTF-8 bytes of the value's
	 * RFC 8785 canonical serialization.
	 *
	 * Byte-for-byte the same answer {@link JsoncFingerprint.hash} gives, for
	 * callers with no fiber to run one in — a bundler plugin's synchronous
	 * hook, a cache `read`/`write` invoked from inside a host's sync
	 * callback. Hashing is the one place the package cannot stay pure on its
	 * own, so the caller binds the platform: pass a {@link JsoncDigest}
	 * wrapping `node:crypto`'s `createHash` (or any SHA-256 implementation),
	 * exactly as a `Crypto` layer is provided at the edge for the `Effect`
	 * variant.
	 *
	 * @example
	 * ```ts
	 * import { createHash } from "node:crypto";
	 * import { JsoncFingerprint } from "@effected/jsonc";
	 * import { Result } from "effect";
	 *
	 * const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest();
	 *
	 * const fingerprint = JsoncFingerprint.hashResult({ b: 2, a: 1 }, digest);
	 * if (Result.isSuccess(fingerprint)) {
	 *   console.log(fingerprint.success); // 64 lowercase hex characters
	 * }
	 * ```
	 *
	 * @param value - The plain JSON value to fingerprint.
	 * @param digest - The consumer's SHA-256 implementation; see
	 *   {@link JsoncDigest}.
	 * @returns A `Result` succeeding with the 64-character lowercase-hex
	 *   SHA-256, or failing with a {@link JsoncCanonicalizeError} — the same
	 *   canonicalization failures {@link JsoncFingerprint.canonicalizeResult}
	 *   raises, plus `InvalidDigest` if `digest` threw or returned a
	 *   wrong-width result.
	 */
	static hashResult(value: unknown, digest: JsoncDigest): Result.Result<string, JsoncCanonicalizeError> {
		return Result.flatMap(JsoncFingerprint.canonicalizeResult(value), (text) => digestHexResult(text, digest));
	}

	/**
	 * The content fingerprint of a JSON value: the lowercase-hex SHA-256 of
	 * the UTF-8 bytes of its RFC 8785 canonical serialization. Values that
	 * differ only in object key order fingerprint identically; any non-JSON
	 * value fails with the same typed errors as
	 * {@link JsoncFingerprint.canonicalize}.
	 *
	 * Requires core's `Crypto.Crypto` service — provide
	 * `@effect/platform-node`'s `NodeCrypto.layer` (or any `Crypto` layer) at
	 * the application edge. The digest itself can fail with the platform's
	 * `PlatformError`, passed through untranslated.
	 * Synchronous callers with no fiber to run this in reach for
	 * {@link JsoncFingerprint.hashResult} instead, supplying their own
	 * digest; the two agree byte for byte.
	 *
	 * The output format is a guarantee: exactly 64 lowercase hexadecimal
	 * characters, with no `sha256:` (or other) algorithm prefix — the digest
	 * vocabulary `@effected/sbom`'s `Sha256Digest` schema decodes, so
	 * fingerprints flow into attestation subjects downstream without this
	 * package taking any edge on `sbom`.
	 *
	 * @param value - The plain JSON value to fingerprint.
	 * @returns An `Effect` requiring `Crypto.Crypto` that succeeds with the
	 *   64-character lowercase-hex SHA-256, or fails with a
	 *   {@link JsoncCanonicalizeError} (or the platform's `PlatformError`).
	 */
	static readonly hash = Effect.fn("JsoncFingerprint.hash")(
		(value: unknown): Effect.Effect<string, JsoncCanonicalizeError | PlatformError.PlatformError, Crypto.Crypto> =>
			Effect.flatMap(Effect.fromResult(JsoncFingerprint.canonicalizeResult(value)), digestHex),
	);

	/**
	 * The content fingerprint of raw text, computed synchronously through a
	 * caller-supplied digest and returned as a `Result` instead of an
	 * `Effect`: the lowercase-hex SHA-256 of its UTF-8 bytes, with the same
	 * opt-in line-ending normalization {@link JsoncFingerprint.hashText}
	 * applies.
	 *
	 * Byte-for-byte the same answer `hashText` gives, for callers with no
	 * fiber to run one in. The caller binds the platform by passing a
	 * {@link JsoncDigest}; see {@link JsoncFingerprint.hashResult}.
	 *
	 * @param text - The text content to fingerprint.
	 * @param digest - The consumer's SHA-256 implementation; see
	 *   {@link JsoncDigest}.
	 * @param options - Optional {@link JsoncTextHashOptions}; defaults apply
	 *   for omitted fields.
	 * @returns A `Result` succeeding with the 64-character lowercase-hex
	 *   SHA-256, or failing with a {@link JsoncCanonicalizeError} carrying
	 *   the `InvalidDigest` code if `digest` threw or returned a wrong-width
	 *   result.
	 */
	static hashTextResult(
		text: string,
		digest: JsoncDigest,
		options?: JsoncTextHashOptions,
	): Result.Result<string, JsoncCanonicalizeError> {
		return digestHexResult(options?.normalizeEol === true ? JsoncFingerprint.normalizeEol(text) : text, digest);
	}

	/**
	 * The content fingerprint of raw text: the lowercase-hex SHA-256 of its
	 * UTF-8 bytes, with opt-in line-ending normalization (`\r\n`/`\r` → `\n`)
	 * for file content that must fingerprint identically across checkout
	 * line-ending settings.
	 *
	 * Requires core's `Crypto.Crypto` service — provide
	 * `@effect/platform-node`'s `NodeCrypto.layer` (or any `Crypto` layer) at
	 * the application edge.
	 * Synchronous callers reach for
	 * {@link JsoncFingerprint.hashTextResult} instead, supplying their own
	 * digest; the two agree byte for byte.
	 *
	 * The output format is a guarantee: exactly 64 lowercase hexadecimal
	 * characters, with no `sha256:` (or other) algorithm prefix — the digest
	 * vocabulary `@effected/sbom`'s `Sha256Digest` schema decodes, so
	 * fingerprints flow into attestation subjects downstream without this
	 * package taking any edge on `sbom`.
	 *
	 * @example
	 * ```ts
	 * import { JsoncFingerprint, JsoncTextHashOptions } from "@effected/jsonc";
	 * import { Effect } from "effect";
	 *
	 * const program = Effect.gen(function* () {
	 *   const options = JsoncTextHashOptions.make({ normalizeEol: true });
	 *   const a = yield* JsoncFingerprint.hashText("line one\r\nline two", options);
	 *   const b = yield* JsoncFingerprint.hashText("line one\nline two", options);
	 *   return a === b; // true
	 * });
	 * ```
	 *
	 * @param text - The text content to fingerprint.
	 * @param options - Optional {@link JsoncTextHashOptions}; defaults apply
	 *   for omitted fields.
	 * @returns An `Effect` requiring `Crypto.Crypto` that succeeds with the
	 *   64-character lowercase-hex SHA-256, or fails with the platform's
	 *   `PlatformError` if the digest itself fails.
	 */
	static readonly hashText = Effect.fn("JsoncFingerprint.hashText")(
		(text: string, options?: JsoncTextHashOptions): Effect.Effect<string, PlatformError.PlatformError, Crypto.Crypto> =>
			digestHex(options?.normalizeEol === true ? JsoncFingerprint.normalizeEol(text) : text),
	);
}
