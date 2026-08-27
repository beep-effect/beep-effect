/**
 * The `JsoncFingerprint` facade: canonical JSON serialization (RFC 8785, JSON
 * Canonicalization Scheme) and SHA-256 content fingerprints over it.
 *
 * The pure core is the JCS emitter — compact output, object keys sorted by
 * UTF-16 code units, ES number serialization — with the package's usual
 * `Result` primitive / spanned `Effect` twin arrangement. Hashing is the one
 * effectful edge: it requires core's `Crypto.Crypto` service in `R` and owns
 * no backend, so consumers provide `@effect/platform-node`'s
 * `NodeCrypto.layer` (or any `Crypto` layer) at the application edge.
 *
 * This is a deliberately different contract from `Jsonc.stringify` (plain
 * `JSON.stringify` semantics — nested unrepresentables dropped or nulled):
 * fingerprints must never silently alter the document, so every non-JSON
 * value is a typed failure carrying the JSON-pointer path to fix.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import type { PlatformError } from "effect";
import { Crypto, Effect, Encoding, Result, Schema } from "effect";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";

const $I = $ScratchpadId.create("jsonc/JsoncFingerprint");

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
 *
 * **Example** (Recognize a canonicalize-error code)
 *
 * ```ts
 * import { JsoncCanonicalizeErrorCode } from "@beep/scratchpad/jsonc";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(JsoncCanonicalizeErrorCode)("UnrepresentableValue")); // true
 * console.log(S.is(JsoncCanonicalizeErrorCode)("NonFiniteNumber")); // true
 * ```
 *
 * @see {@link JsoncCanonicalizeError} for the tagged error that carries this code.
 * @public
 * @category constants
 * @since 0.0.0
 */
export const JsoncCanonicalizeErrorCode = Schema.Literals([
	"UnrepresentableValue",
	"BigIntValue",
	"NonFiniteNumber",
	"LoneSurrogate",
	"NonPlainObject",
	"NestingDepthExceeded",
]).pipe(
	$I.annoteSchema("JsoncCanonicalizeErrorCode", {
		description: "The public canonicalize-error code vocabulary carried by JsoncCanonicalizeError.",
	}),
);

/**
 * The union of all canonicalize-error code string literals.
 *
 * @see {@link JsoncCanonicalizeErrorCode} for the runtime literals schema.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type JsoncCanonicalizeErrorCode = typeof JsoncCanonicalizeErrorCode.Type;

/**
 * Canonicalization failure: a `JsoncCanonicalizeErrorCode` naming the
 * failure mode, the JSON-pointer `path` to the offending value (`""` is the
 * document root) and a human-readable `detail`. Raised by
 * {@link JsoncFingerprint.canonicalize},
 * {@link JsoncFingerprint.canonicalizeResult} and
 * {@link JsoncFingerprint.hash}.
 *
 * **Example** (Construct a path-bearing canonicalize error)
 *
 * ```ts
 * import { JsoncCanonicalizeError } from "@beep/scratchpad/jsonc";
 *
 * const error = JsoncCanonicalizeError.make({
 *   code: "UnrepresentableValue",
 *   path: "/a/b",
 *   detail: "undefined values have no JSON representation",
 * });
 *
 * console.log(error._tag); // "JsoncCanonicalizeError"
 * console.log(error.path); // "/a/b"
 * ```
 *
 * @see {@link JsoncCanonicalizeErrorCode} for the failure-mode vocabulary.
 * @see {@link JsoncFingerprint.canonicalizeResult} for the Result twin that raises this error.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JsoncCanonicalizeError extends Schema.TaggedError<JsoncCanonicalizeError>($I`JsoncCanonicalizeError`)(
	"JsoncCanonicalizeError",
	{
		code: JsoncCanonicalizeErrorCode,
		path: Schema.String,
		detail: Schema.String,
	},
	$I.annote("JsoncCanonicalizeError", {
		description: "Canonical JSON serialization failure naming the mode, JSON-pointer path, and detail.",
	}),
) {
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
 * **Example** (Enable line-ending normalization)
 *
 * ```ts
 * import { JsoncTextHashOptions } from "@beep/scratchpad/jsonc";
 *
 * const options = JsoncTextHashOptions.make({ normalizeEol: true });
 *
 * console.log(options.normalizeEol); // true
 * ```
 *
 * @see {@link JsoncFingerprint.hashText} for the hasher these options control.
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class JsoncTextHashOptions extends Schema.Class<JsoncTextHashOptions>($I`JsoncTextHashOptions`)(
	{
		normalizeEol: Schema.optionalKey(Schema.Boolean),
	},
	$I.annote("JsoncTextHashOptions", {
		description: "Omissible hashText knobs; normalizeEol rewrites CR/CRLF to LF before hashing.",
	}),
) {}

// ── Internal: the JCS emitter ───────────────────────────────────────────────

// Throw carrier so the single recursive emitter can surface a typed error
// from arbitrary depth without threading Results through the walk. Caught and
// converted at the `canonicalizeResult` boundary; never escapes the module.
class CanonicalizeFailure {
  readonly error: JsoncCanonicalizeError;
	constructor(error: JsoncCanonicalizeError) {
    this.error = error;
  }
}

const escapePointerSegment = (segment: string): string => segment.replace(/~/g, "~0").replace(/\//g, "~1");

// RFC 8785 §3.2.3: object members sort by the UTF-16 code units of their
// (unescaped) keys — exactly what `<` on JS strings compares.
const compareCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// Member and element reads go through this guard. An accessor property is
// invoked, matching `JSON.stringify` semantics — a benign getter's value
// canonicalizes normally — but a getter that throws must not escape as a raw
// exception through the `canonicalizeResult` boundary: it fails typed at the
// member's JSON-pointer path instead. The `try` wraps ONLY the property read,
// never the recursive `emit` of the value it produced, so a
// `CanonicalizeFailure` from deeper in the walk cannot be caught (and
// re-labelled) here.
const readProperty = (container: object, key: string | number, path: string): unknown => {
	try {
		return (container as Record<string | number, unknown>)[key];
	} catch {
		throw new CanonicalizeFailure(
			JsoncCanonicalizeError.make({
				code: "UnrepresentableValue",
				path,
				detail: "the property getter for this value threw; getters must return plain JSON values",
			}),
		);
	}
};

const emit = (value: unknown, path: string, depth: number): string => {
	if (value === null) {
		return "null";
	}
	switch (typeof value) {
		case "boolean":
			return value ? "true" : "false";
		case "number": {
			if (!Number.isFinite(value)) {
				throw new CanonicalizeFailure(
					JsoncCanonicalizeError.make({
						code: "NonFiniteNumber",
						path,
						detail: `${String(value)} has no canonical JSON representation`,
					}),
				);
			}
			// RFC 8785 §3.2.2.3 number serialization is ECMAScript's shortest
			// round-trip number-to-string under JSON's grammar — exactly what
			// `JSON.stringify` emits for a finite number.
			return JSON.stringify(value);
		}
		case "string":
			// RFC 8785 requires I-JSON (RFC 7493) input: well-formed Unicode
			// only. `JSON.stringify` would silently emit a `\udxxx` escape for
			// an unpaired surrogate; a fingerprint of malformed text is a lie.
			if (!value.isWellFormed()) {
				throw new CanonicalizeFailure(
					JsoncCanonicalizeError.make({
						code: "LoneSurrogate",
						path,
						detail: "string contains an unpaired surrogate; RFC 8785 requires well-formed Unicode",
					}),
				);
			}
			// RFC 8785 §3.2.2.2 string serialization matches `JSON.stringify`:
			// the two-character escapes, `\u00xx` lowercase-hex escapes for the
			// remaining control characters, everything else literal.
			return JSON.stringify(value);
		case "bigint":
			throw new CanonicalizeFailure(
				JsoncCanonicalizeError.make({
					code: "BigIntValue",
					path,
					detail: "bigint values cannot be represented in JSON",
				}),
			);
		case "object":
			break;
		default:
			// undefined, function, symbol.
			throw new CanonicalizeFailure(
				JsoncCanonicalizeError.make({
					code: "UnrepresentableValue",
					path,
					detail: `${typeof value} values have no JSON representation`,
				}),
			);
	}
	if (depth >= MAX_NESTING_DEPTH) {
		throw new CanonicalizeFailure(
			JsoncCanonicalizeError.make({
				code: "NestingDepthExceeded",
				path,
				detail: `nesting exceeds ${MAX_NESTING_DEPTH} levels (a cyclic value also fails here)`,
			}),
		);
	}
	if (Array.isArray(value)) {
		// Indexed iteration, not `Array.prototype.map`: `map` skips holes, so a
		// sparse array would emit `[,]`-shaped non-JSON (or silently collapse a
		// hole away). Reading `value[index]` turns each hole into `undefined`,
		// which fails typed above with the hole's JSON-pointer path — the same
		// policy as an explicit `undefined` member.
		const items: Array<string> = [];
		for (let index = 0; index < value.length; index++) {
			const itemPath = `${path}/${index}`;
			items.push(emit(readProperty(value, index, itemPath), itemPath, depth + 1));
		}
		return `[${items.join(",")}]`;
	}
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) {
		throw new CanonicalizeFailure(
			JsoncCanonicalizeError.make({
				code: "NonPlainObject",
				path,
				detail: "only arrays and plain objects canonicalize; encode domain values to plain JSON first",
			}),
		);
	}
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record).sort(compareCodeUnits);
	return `{${keys
		.map((key) => {
			const memberPath = `${path}/${escapePointerSegment(key)}`;
			// Member keys are strings too: an unpaired surrogate in a key is the
			// same RFC 8785 I-JSON violation as one in a value.
			if (!key.isWellFormed()) {
				throw new CanonicalizeFailure(
					JsoncCanonicalizeError.make({
						code: "LoneSurrogate",
						path: memberPath,
						detail: "object member key contains an unpaired surrogate; RFC 8785 requires well-formed Unicode",
					}),
				);
			}
			return `${JSON.stringify(key)}:${emit(readProperty(record, key, memberPath), memberPath, depth + 1)}`;
		})
		.join(",")}}`;
};

const encoder = new TextEncoder();

const digestHex = (text: string): Effect.Effect<string, PlatformError.PlatformError, Crypto.Crypto> =>
	Effect.gen(function* () {
		const crypto = yield* Crypto.Crypto;
		const digest = yield* crypto.digest("SHA-256", encoder.encode(text));
		return Encoding.encodeHex(digest);
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
 * **Details**
 *
 * `hash` and `hashText` require `Crypto.Crypto` in `R` and are not shown as
 * runnable examples here. Canonicalization is the pure core: equal JSON
 * values (key order ignored) emit equal strings, which is what a later hash
 * would digest.
 *
 * **Example** (Canonicalize key order)
 *
 * ```ts
 * import { JsoncFingerprint } from "@beep/scratchpad/jsonc";
 * import { Result } from "effect";
 *
 * const left = JsoncFingerprint.canonicalizeResult({ b: 2, a: 1 });
 * const right = JsoncFingerprint.canonicalizeResult({ a: 1, b: 2 });
 *
 * console.log(Result.getOrThrow(left)); // {"a":1,"b":2}
 * console.log(Result.getOrThrow(left) === Result.getOrThrow(right)); // true
 * ```
 *
 * @see {@link Jsonc.stringify} for drop/null JSON emission, which this API refuses.
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class JsoncFingerprint {
	private constructor() {}

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
	 * **Details**
	 *
	 * {@link JsoncFingerprint.canonicalize} is defined in terms of this
	 * function; the two never diverge. Reach for the Effect variant inside
	 * Effect code — it carries the `JsoncFingerprint.canonicalize` tracing
	 * span — and for this one at synchronous boundaries.
	 *
	 * **Example** (Canonicalize success and an unrepresentable nested value)
	 *
	 * ```ts
	 * import { JsoncFingerprint } from "@beep/scratchpad/jsonc";
	 * import { Result } from "effect";
	 *
	 * const ok = JsoncFingerprint.canonicalizeResult({ b: 2, a: 1 });
	 * if (Result.isSuccess(ok)) {
	 *   console.log(ok.success); // {"a":1,"b":2}
	 * }
	 *
	 * const bad = JsoncFingerprint.canonicalizeResult({ a: { b: undefined } });
	 * if (Result.isFailure(bad)) {
	 *   console.log(bad.failure.code); // "UnrepresentableValue"
	 *   console.log(bad.failure.path); // "/a/b"
	 * }
	 * ```
	 *
	 * @param value - The plain JSON value (`null`, booleans, finite numbers,
	 *   strings, arrays, plain objects) to serialize.
	 * @see {@link JsoncCanonicalizeError} for path-bearing typed failures.
	 */
	static canonicalizeResult(value: unknown): Result.Result<string, JsoncCanonicalizeError> {
		try {
			return Result.succeed(emit(value, "", 0));
		} catch (failure) {
			if (failure instanceof CanonicalizeFailure) {
				return Result.fail(failure.error);
			}
			throw failure;
		}
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
	 * The content fingerprint of raw text: the lowercase-hex SHA-256 of its
	 * UTF-8 bytes, with opt-in line-ending normalization (`\r\n`/`\r` → `\n`)
	 * for file content that must fingerprint identically across checkout
	 * line-ending settings.
	 *
	 * Requires core's `Crypto.Crypto` service — provide
	 * `@effect/platform-node`'s `NodeCrypto.layer` (or any `Crypto` layer) at
	 * the application edge.
	 *
	 * The output format is a guarantee: exactly 64 lowercase hexadecimal
	 * characters, with no `sha256:` (or other) algorithm prefix — the digest
	 * vocabulary `@effected/sbom`'s `Sha256Digest` schema decodes, so
	 * fingerprints flow into attestation subjects downstream without this
	 * package taking any edge on `sbom`.
	 *
	 * **Details**
	 *
	 * `R` includes `Crypto.Crypto`. Provide a Crypto layer at the application
	 * edge before running; this method is composition, not a synchronous hash.
	 *
	 * @param text - The text content to fingerprint.
	 * @param options - Optional {@link JsoncTextHashOptions}; defaults apply
	 *   for omitted fields.
	 * @see {@link JsoncTextHashOptions} for opt-in line-ending normalization.
	 * @see {@link JsoncFingerprint.normalizeEol} for the shared EOL rewrite.
	 */
	static readonly hashText = Effect.fn("JsoncFingerprint.hashText")(
		(text: string, options?: JsoncTextHashOptions): Effect.Effect<string, PlatformError.PlatformError, Crypto.Crypto> =>
			digestHex(options?.normalizeEol === true ? JsoncFingerprint.normalizeEol(text) : text),
	);
}
