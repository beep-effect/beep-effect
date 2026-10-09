// The `IntegrityHash` brand: one concept covering the three textual integrity
// forms the kit meets.
//
//   - SRI form   `<algo>-<base64>`  — lockfiles' `ResolvedPackage.integrity`
//                                     and npm `package-lock` entries.
//   - Corepack   `<algo>.<hex>`     — package-json's `packageManager` pin, the
//                                     `name@version+sha512.<hex>` tail.
//   - Yarn       `<cachekey>/<hex>` — yarn Berry `yarn.lock` `checksum` values
//                                     (e.g. `10c0/<hex>`); a cache-versioned
//                                     SHA-512 that does not name its algorithm.
//
// A branded string plus its taxonomy statics (`algorithmOf`, `isSri`,
// `isCorepack`, `isYarnChecksum`) and a typed `decode`, mirroring
// `DependencySpecifier`'s shape.
//
// `CorepackIntegrityHash` is the one narrowing the kit needs: the pin tail
// `<name>@<version>+<integrity>` only ever carries the corepack form, and both
// schemas that model it (`PackageManagerPin` here, `@effected/package-json`'s
// `PackageManager`) consume that export rather than restricting the brand
// themselves. It also carries the bridge between the two textual forms the kit
// meets at the registry boundary: `CorepackIntegrityHash.FromSri` decodes
// npm's SRI `sha512-<base64>` (the shape `NpmRegistry.version()` returns)
// into the corepack `sha512.<hex>` form a `packageManager` pin carries.
//
// `SriIntegrityHash` is the sibling narrowing for the SRI form, for fields that
// only ever carry `<algo>-<base64>` — `@effected/workspaces`'
// `ConfigDependencySpec.integrity` (the legacy inline `configDependencies`
// integrity) is its first consumer.

import type * as Brand from "effect/Brand";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";

/**
 * A supported integrity hash algorithm.
 *
 * @remarks
 * `sha224` appears only in the corepack form — corepack's own transparent
 * default pins emit it (e.g. `yarn@4.x+sha224.<hex>`) — and never in SRI,
 * whose specification names only `sha256`/`sha384`/`sha512` (plus legacy
 * `sha1`).
 *
 * @public
 */
export type IntegrityAlgorithm = "sha1" | "sha224" | "sha256" | "sha384" | "sha512";

// SRI: `<algo>-<base64>` (optional `=` padding). No sha224 — the SRI spec
// does not include it.
const SRI_RE = /^(sha1|sha256|sha384|sha512)-[A-Za-z0-9+/]+={0,2}$/;
// Corepack: `<algo>.<lowercase-hex>`. sha224 is real and corepack-emitted:
// the transparent default pin for yarn Berry hashes with it.
const COREPACK_RE = /^(sha1|sha224|sha256|sha384|sha512)\.[0-9a-f]+$/;
// Yarn Berry: `<cachekey>/<lowercase-hex>`, e.g. `10c0/<hex>`. The cache key is
// a version marker (`<digits>c<digits>`), not an algorithm token.
const YARN_RE = /^[0-9]+(c[0-9]+)?\/[0-9a-f]+$/;

const isSri = (value: string): boolean => SRI_RE.test(value);
const isCorepack = (value: string): boolean => COREPACK_RE.test(value);
const isYarnChecksum = (value: string): boolean => YARN_RE.test(value);

/**
 * Whether a string is a valid integrity hash in the SRI (`<algo>-<base64>`),
 * corepack (`<algo>.<hex>`) or yarn (`<cachekey>/<hex>`) form.
 *
 * @public
 */
export const isValidIntegrityHash = (value: string): boolean =>
	isSri(value) || isCorepack(value) || isYarnChecksum(value);

// The algorithm is the prefix before the first `-` (SRI) or `.` (corepack). The
// yarn form does not name its algorithm, so it has none to read.
const algorithmOf = (value: string): O.Option<IntegrityAlgorithm> => {
	if (isSri(value)) return O.some(value.slice(0, value.indexOf("-")) as IntegrityAlgorithm);
	if (isCorepack(value)) return O.some(value.slice(0, value.indexOf(".")) as IntegrityAlgorithm);
	return O.none();
};

/**
 * Indicates that a string could not be parsed as a valid integrity hash.
 *
 * Raised by {@link IntegrityHash.decode}. The offending string is preserved on
 * `input`.
 *
 * @public
 */
export class InvalidIntegrityHashError extends S.TaggedError<InvalidIntegrityHashError>()(
	"InvalidIntegrityHashError",
	{
		/** The raw input string that failed validation. */
		input: S.String,
	},
) {
	override get message(): string {
		return `Invalid integrity hash "${this.input}": expected an SRI (<algo>-<base64>), corepack (<algo>.<hex>) or yarn (<cachekey>/<hex>) form`;
	}
}

/** Taxonomy statics attached to the `IntegrityHash` schema value. */
interface IntegrityHashStatics {
	/** Whether the hash is in SRI (`<algo>-<base64>`) form. */
	readonly isSri: (value: string) => boolean;
	/** Whether the hash is in corepack (`<algo>.<hex>`) form. */
	readonly isCorepack: (value: string) => boolean;
	/** Whether the hash is in yarn (`<cachekey>/<hex>`) form. */
	readonly isYarnChecksum: (value: string) => boolean;
	/** Whether the string is a valid integrity hash in any of the three forms. */
	readonly isValid: (value: string) => boolean;
	/**
	 * The algorithm prefix. `None` when the string is not a valid integrity
	 * hash, and also `None` for the yarn form, which does not name its algorithm.
	 */
	readonly algorithmOf: (value: string) => O.Option<IntegrityAlgorithm>;
	/** Validate a string, failing with a typed {@link InvalidIntegrityHashError}. */
	readonly decode: (input: string) => Effect.Effect<IntegrityHashBrand, InvalidIntegrityHashError>;
}

/**
 * The branded integrity-hash type: any string {@link (IntegrityHash:variable)}
 * validates.
 *
 * @public
 */
export type IntegrityHashBrand = string & Brand.Brand<"IntegrityHash">;

const brandedIntegrity = S.String.pipe(
	S.check(
		S.makeFilter((value) =>
			isValidIntegrityHash(value) ? undefined : "Expected an SRI, corepack or yarn integrity hash",
		),
	),
	S.brand("IntegrityHash"),
);

const decode = (input: string): Effect.Effect<IntegrityHashBrand, InvalidIntegrityHashError> =>
	S.decodeEffect(brandedIntegrity)(input).pipe(
		Effect.mapError(() => InvalidIntegrityHashError.make({ input })),
	);

/**
 * A subresource-integrity hash, covering the SRI (`sha512-<base64>`), corepack
 * (`sha512.<hex>`) and yarn (`10c0/<hex>`) textual forms, carrying taxonomy
 * statics (`IntegrityHash.algorithmOf` and friends). Use it as a schema for an
 * integrity field and reach for the statics to inspect a raw string.
 *
 * @public
 */
export const IntegrityHash = Object.assign(brandedIntegrity, {
	isSri,
	isCorepack,
	isYarnChecksum,
	isValid: isValidIntegrityHash,
	algorithmOf,
	decode,
} satisfies IntegrityHashStatics);

const corepackRestricted = brandedIntegrity.pipe(
	S.check(
		S.makeFilter((value) => (isCorepack(value) ? undefined : "Expected a corepack (<algo>.<hex>) integrity hash")),
	),
);

const sriRestricted = brandedIntegrity.pipe(
	S.check(
		S.makeFilter((value) => (isSri(value) ? undefined : "Expected an SRI (<algo>-<base64>) integrity hash")),
	),
);

/**
 * A subresource-integrity hash in the SRI `<algo>-<base64>` form only —
 * `sha512-<base64>` as pnpm and npm lockfiles record it, and as pnpm's inline
 * `configDependencies` integrity carries it. A corepack (`sha512.<hex>`) or yarn
 * (`10c0/<hex>`) hash, both valid {@link (IntegrityHash:variable)} values, fails
 * this schema.
 *
 * @remarks
 * The SRI counterpart of {@link (CorepackIntegrityHash:variable)}, with the same
 * posture: it decodes to the same {@link IntegrityHashBrand} as the
 * unrestricted schema (no second brand), so a value it accepts assigns anywhere
 * an `IntegrityHash` is expected.
 *
 * It validates SRI shape only: the digest is not base64-decoded or
 * length-checked. A value this schema accepts, such as `sha512-oldHash==`, can
 * therefore still fail `CorepackIntegrityHash.fromSri`, which decodes the
 * digest to hex.
 *
 * Reach for `IntegrityHash.isSri(value)` to ask the same question about a raw
 * string without decoding. Not to be confused with
 * {@link InvalidSriIntegrityHashError}, which reports a failed SRI → corepack
 * conversion, not a failed decode through this schema.
 *
 * @example
 * ```ts
 * import { SriIntegrityHash } from "./index.ts";
 * import { Schema } from "effect";
 *
 * const decode = Schema.decodeUnknownExit(SriIntegrityHash);
 *
 * decode("sha512-3q2+7w=="); // success
 * decode("sha512.deadbeef"); // failure — corepack form
 * ```
 *
 * @public
 */
export const SriIntegrityHash: S.brand<S.String, "IntegrityHash"> = sriRestricted;

// --- The SRI → corepack bridge ---------------------------------------------
//
// npm's registry (and every lockfile) speaks the SRI form `sha512-<base64>`;
// a `packageManager` pin speaks corepack's `sha512.<hex>`. The conversion is
// mechanical — base64 → lowercase hex, `-` → `.` — but every consumer that
// hand-rolls it re-decides the same edge cases (quoted JSON tokens, non-sha512
// algorithms, sloppy base64), so the bridge lives here, once, as a codec.

// Why this is hand-rolled rather than core's `effect/encoding/Base64`, which this package
// already uses elsewhere (`PackageTarball`, `RegistryCredential`): the two
// disagree in both directions, and for an integrity value the disagreement is
// load-bearing:
//
//   Base64.decode("QQ==")     -> [65]
//   Base64.decode("QR==")     -> [65]   non-zero trailing bits
//   Base64.decode("QV==")     -> [65]   ditto
//   Base64.decode("QQ=\r\n=") -> [65]   CRLF stripped silently
//   Base64.decode("QQ")       -> fail  "Length must be a multiple of 4"
//
// Core accepts three spellings of one digest and tolerates embedded CRLF, so
// two `integrity` strings that differ as text can decode to identical bytes —
// precisely the ambiguity an integrity check exists to deny. Core is also
// *stricter* where this codec is deliberately lenient: it rejects the unpadded
// form. Neither direction is a drop-in. Do not "fix" this to `Base64`.
//
// Canonical base64 alphabet; index = 6-bit value.
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_INVALID = 0xff;
const BASE64_INDEX = (() => {
	const table = new Uint8Array("z".charCodeAt(0) + 1);
	table.fill(BASE64_INVALID);
	for (let index = 0; index < BASE64_ALPHABET.length; index += 1) {
		table[BASE64_ALPHABET.charCodeAt(index)] = index;
	}
	return table;
})();

// Decode canonical base64 to bytes without a runtime dependency. `Buffer` is
// Node-only AND lenient — it silently drops invalid characters and truncates —
// and lenience is exactly what an integrity conversion must not have.
// `undefined` for anything non-canonical: a length no base64 output has
// (remainder 1), padding that does not match the body length, a character
// outside the alphabet, an interior `=`, or non-zero trailing bits (a second
// spelling of the same bytes; npm emits only the canonical one).
const decodeBase64 = (value: string): ReadonlyArray<number> | undefined => {
	const firstPad = value.indexOf("=");
	const body = firstPad === -1 ? value : value.slice(0, firstPad);
	const padding = firstPad === -1 ? "" : value.slice(firstPad);
	if (padding !== "" && padding !== "=" && padding !== "==") return undefined;
	const remainder = body.length % 4;
	if (body.length === 0 || remainder === 1) return undefined;
	if (padding.length > 0 && padding.length !== (4 - remainder) % 4) return undefined;
	let buffer = 0;
	let bits = 0;
	const bytes: Array<number> = [];
	for (let index = 0; index < body.length; index += 1) {
		const code = body.charCodeAt(index);
		if (code >= BASE64_INDEX.length) return undefined;
		const sextet = BASE64_INDEX[code];
		if (sextet === undefined || sextet === BASE64_INVALID) return undefined;
		buffer = (buffer << 6) | sextet;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			bytes.push((buffer >>> bits) & 0xff);
		}
	}
	if ((buffer & ((1 << bits) - 1)) !== 0) return undefined;
	return bytes;
};

// Canonical (padded) base64 of a byte sequence — the exact inverse of
// `decodeBase64`, used by the codec's encode direction.
const encodeBase64 = (bytes: ReadonlyArray<number>): string => {
	let out = "";
	for (let index = 0; index < bytes.length; index += 3) {
		const b0 = bytes[index] ?? 0;
		const b1 = bytes[index + 1];
		const b2 = bytes[index + 2];
		const buffer = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
		out += BASE64_ALPHABET.charAt((buffer >>> 18) & 0x3f);
		out += BASE64_ALPHABET.charAt((buffer >>> 12) & 0x3f);
		out += b1 === undefined ? "=" : BASE64_ALPHABET.charAt((buffer >>> 6) & 0x3f);
		out += b2 === undefined ? "=" : BASE64_ALPHABET.charAt(buffer & 0x3f);
	}
	return out;
};

const hexOfBytes = (bytes: ReadonlyArray<number>): string =>
	bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");

const bytesOfHex = (hex: string): ReadonlyArray<number> => {
	const bytes: Array<number> = [];
	for (let index = 0; index < hex.length; index += 2) {
		bytes.push(Number.parseInt(hex.slice(index, index + 2), 16));
	}
	return bytes;
};

const SHA512_SRI_PREFIX = "sha512-";
const SHA512_COREPACK_PREFIX = "sha512.";
// A sha512 digest is always 64 bytes. An SRI value with any other payload
// length cannot be a sha512 digest, and converting it would mint a pin
// corepack rejects at install time — fail typed here instead.
const SHA512_DIGEST_BYTES = 64;
const COREPACK_SHA512_RE = /^sha512\.[0-9a-f]{128}$/;

// One layer of surrounding double quotes is tolerated and unwrapped:
// registry-adjacent tooling sometimes hands over the raw JSON token
// (`"sha512-…"`) rather than the decoded string.
const unwrapJsonQuotes = (value: string): string =>
	value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;

// SRI `sha512-<base64>` → corepack `sha512.<hex>`; `undefined` when the input
// is not a canonical sha512 SRI hash carrying a 64-byte digest. Deliberately
// one-way: an already-corepack-form input does NOT pass through — silently
// accepting it would let a caller feed pins back in and mask a wiring bug.
const corepackOfSri = (input: string): string | undefined => {
	const value = unwrapJsonQuotes(input);
	if (!value.startsWith(SHA512_SRI_PREFIX)) return undefined;
	const bytes = decodeBase64(value.slice(SHA512_SRI_PREFIX.length));
	if (bytes === undefined || bytes.length !== SHA512_DIGEST_BYTES) return undefined;
	return `${SHA512_COREPACK_PREFIX}${hexOfBytes(bytes)}`;
};

// corepack `sha512.<128-hex>` → canonical SRI `sha512-<base64>`. `undefined`
// for the corepack forms SRI cannot carry (sha224, a truncated digest).
const sriOfCorepack = (value: string): string | undefined =>
	COREPACK_SHA512_RE.test(value)
		? `${SHA512_SRI_PREFIX}${encodeBase64(bytesOfHex(value.slice(SHA512_COREPACK_PREFIX.length)))}`
		: undefined;

// The codec: decode converts and then validates through the corepack-restricted
// schema, so the result carries the same brand every other integrity field
// uses; encode is the exact inverse (canonical padded base64, no re-quoting).
const corepackFromSri: S.Codec<IntegrityHashBrand, string> = S.String.pipe(
	S.decodeTo(
		corepackRestricted,
		SchemaTransformation.transformEffect<string, string>({
			decode: (input) => {
				const corepack = corepackOfSri(input);
				return corepack === undefined
					? Effect.fail(
							new SchemaIssue.InvalidValue(
								{ message: `Expected an SRI sha512-<base64> integrity hash carrying a 64-byte digest, got "${input}"` },
								input,
							),
						)
					: Effect.succeed(corepack);
			},
			encode: (value) => {
				const sri = sriOfCorepack(value);
				return sri === undefined
					? Effect.fail(
							new SchemaIssue.InvalidValue(
								{ message: `Expected a corepack sha512.<128-hex-digit> integrity hash, got "${value}"` },
								value,
							),
						)
					: Effect.succeed(sri);
			},
		}),
	),
);

/**
 * Indicates that a string could not be converted from npm's SRI form to the
 * corepack integrity form.
 *
 * Raised by {@link (CorepackIntegrityHash:variable)}'s `fromSri`. The offending
 * string is preserved on `input`. Only a canonical `sha512-<base64>` value
 * carrying a 64-byte digest converts — corepack pins accept nothing weaker
 * than sha512, so a sha256/sha1 SRI hash, malformed base64, a wrong-length
 * digest and an already-corepack-form input all raise this error.
 *
 * @public
 */
export class InvalidSriIntegrityHashError extends S.TaggedError<InvalidSriIntegrityHashError>()(
	"InvalidSriIntegrityHashError",
	{
		/** The raw input string that failed conversion. */
		input: S.String,
	},
) {
	override get message(): string {
		return `Invalid SRI integrity hash "${this.input}": expected a sha512-<base64> value carrying a 64-byte digest (corepack accepts only sha512)`;
	}
}

const fromSri = (input: string): Effect.Effect<IntegrityHashBrand, InvalidSriIntegrityHashError> =>
	S.decodeEffect(corepackFromSri)(input).pipe(
		Effect.mapError(() => InvalidSriIntegrityHashError.make({ input })),
	);

/** Conversion statics attached to the `CorepackIntegrityHash` schema value. */
interface CorepackIntegrityHashStatics {
	/**
	 * Codec between npm's SRI `sha512-<base64>` form (the encoded side) and the
	 * corepack `sha512.<hex>` form (the decoded side). Decoding tolerates one
	 * layer of surrounding JSON quotes and fails typed on any non-sha512
	 * algorithm, malformed base64, a digest that is not 64 bytes, and an input
	 * already in corepack form (the conversion is one-way from SRI). Encoding
	 * emits the canonical padded SRI spelling.
	 */
	readonly FromSri: S.Codec<IntegrityHashBrand, string>;
	/**
	 * Convert npm's SRI `sha512-<base64>` form to the corepack `sha512.<hex>`
	 * form, failing with a typed {@link InvalidSriIntegrityHashError}. The
	 * `Effect` convenience over the `FromSri` codec.
	 */
	readonly fromSri: (input: string) => Effect.Effect<IntegrityHashBrand, InvalidSriIntegrityHashError>;
}

/**
 * A subresource-integrity hash in the corepack `<algo>.<hex>` form only —
 * `sha512.deadbeef`, and corepack's own sha224 default pins
 * (`sha224.877304e3…`). An SRI (`sha512-<base64>`) or yarn (`10c0/<hex>`) hash,
 * both valid {@link (IntegrityHash:variable)} values, fails this schema.
 *
 * The schema value also carries the SRI bridge: the `FromSri` codec decodes
 * npm's `sha512-<base64>` form (what `NpmRegistry.version()` returns, with one
 * layer of JSON quotes tolerated) into the corepack form, and `fromSri` is its
 * `Effect` convenience, failing with a typed
 * {@link InvalidSriIntegrityHashError}. The conversion is deliberately one-way
 * and sha512-only — corepack pins accept nothing weaker, so a sha256/sha1 SRI
 * hash fails typed rather than minting a pin corepack would reject.
 *
 * @remarks
 * The corepack pin tail (`<name>@<version>+<integrity>`) is the one place the
 * kit meets this form, and two schemas name it: `PackageManagerPin.integrity`
 * here and `@effected/package-json`'s `PackageManager.integrity`. Both consume
 * **this** schema, so a value validated by one is accepted by the other.
 *
 * It decodes to the same {@link IntegrityHashBrand} the unrestricted schema
 * does, so a corepack-validated value assigns anywhere an `IntegrityHash` is
 * expected; there is no second brand. A `Schema.check` is erased from the built
 * type, so this schema and the unrestricted one are the same declared type.
 * Reach for `IntegrityHash.isCorepack(value)` to ask the same question about a
 * raw string without decoding.
 *
 * @privateRemarks
 * Sharing is not type-enforced: a consumer that quietly reverts to a private
 * copy of the restriction compiles clean and, if the copy is faithful, passes
 * every rejection test. What sees a re-fork is **object identity**, so each
 * consumer's suite asserts its field schema IS this export
 * (`PackageManagerPin.fields.integrity.schema === CorepackIntegrityHash`, and
 * `PackageManager.fields.integrity.value === CorepackIntegrityHash` on the
 * `@effected/package-json` side), each with a control against the unrestricted
 * brand. Do not replace those with a behavioural test, which cannot fail.
 *
 * @example
 * ```ts
 * import { CorepackIntegrityHash } from "./index.ts";
 * import { Schema } from "effect";
 *
 * const decode = Schema.decodeUnknownExit(CorepackIntegrityHash);
 *
 * decode("sha512.deadbeef"); // success
 * decode("sha512-3q2+7w=="); // failure — SRI form
 * ```
 *
 * @public
 */
export const CorepackIntegrityHash = Object.assign(corepackRestricted, {
	FromSri: corepackFromSri,
	fromSri,
} satisfies CorepackIntegrityHashStatics);
