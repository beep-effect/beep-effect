import { Buffer } from "node:buffer";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import {
	CorepackIntegrityHash,
	IntegrityHash,
	InvalidIntegrityHashError,
	InvalidSriIntegrityHashError,
	PackageManagerPin,
	SriIntegrityHash,
} from "../../effected/npm/index.ts";

describe("IntegrityHash schema", () => {
	const sri = "sha512-tsPuRLBpQ2xk6+8HB4vP0Wq1v0EYlv6q6qz1oqTgU5U+lgY7Zp3Xf5sT2xM2mQ==";
	const corepack = "sha512.5be7cee7ff4d9c25bda31e3b5f6f3f9f2a";
	const yarn = "10c0/99a4b0f0e7991796b1e7e3f52dceb9137cae2a9dfc8fc0784a550dc4c558e15a";

	it.effect("accepts all three textual forms", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* Schema.decodeUnknownEffect(IntegrityHash)(sri), sri);
			assert.strictEqual(yield* Schema.decodeUnknownEffect(IntegrityHash)(corepack), corepack);
			assert.strictEqual(yield* Schema.decodeUnknownEffect(IntegrityHash)(yarn), yarn);
			assert.strictEqual(yield* Schema.decodeUnknownEffect(IntegrityHash)("sha1-abcd"), "sha1-abcd");
			assert.strictEqual(yield* Schema.decodeUnknownEffect(IntegrityHash)("sha256.deadbeef"), "sha256.deadbeef");
			assert.strictEqual(yield* Schema.decodeUnknownEffect(IntegrityHash)("9c0/deadbeef"), "9c0/deadbeef");
		}),
	);

	it.effect("rejects malformed hashes", () =>
		Effect.gen(function* () {
			for (const bad of ["", "md5-abcd", "sha512-", "sha512.NOTHEX", "sha512.", "abc", "sha999.deadbeef"]) {
				const error = yield* Effect.flip(Schema.decodeUnknownEffect(IntegrityHash)(bad));
				assert.strictEqual(error._tag, "SchemaError", bad);
			}
		}),
	);
});

describe("IntegrityHash statics", () => {
	it("classifies SRI vs corepack vs yarn", () => {
		assert.isTrue(IntegrityHash.isSri("sha512-abc/def+=="));
		assert.isTrue(IntegrityHash.isSri("sha512-YWJj"));
		assert.isFalse(IntegrityHash.isCorepack("sha512-YWJj"));
		assert.isTrue(IntegrityHash.isCorepack("sha512.abc"));
		assert.isFalse(IntegrityHash.isSri("sha512.abc"));
		// sha224 is corepack-only: corepack's transparent default yarn pin emits
		// it, and the SRI spec does not include it.
		assert.isTrue(IntegrityHash.isCorepack("sha224.877304e3c9e5b53431969ee2ca17ee44f366533b0da5a4ba9c2bd447"));
		assert.isFalse(IntegrityHash.isSri("sha224-YWJj"));
		assert.isTrue(IntegrityHash.isYarnChecksum("10c0/deadbeef"));
		assert.isTrue(IntegrityHash.isYarnChecksum("9c0/abc123"));
		assert.isFalse(IntegrityHash.isYarnChecksum("sha512-YWJj"));
		assert.isFalse(IntegrityHash.isSri("10c0/deadbeef"));
		assert.isFalse(IntegrityHash.isCorepack("10c0/deadbeef"));
		assert.isTrue(IntegrityHash.isValid("10c0/deadbeef"));
		assert.isFalse(IntegrityHash.isValid("nope"));
	});

	it("extracts the algorithm from the SRI and corepack forms, none from yarn", () => {
		assert.deepStrictEqual(IntegrityHash.algorithmOf("sha512-YWJj"), Option.some("sha512"));
		assert.deepStrictEqual(IntegrityHash.algorithmOf("sha1.abcd"), Option.some("sha1"));
		assert.deepStrictEqual(IntegrityHash.algorithmOf("sha256.deadbeef"), Option.some("sha256"));
		// The yarn form is a valid integrity hash but names no algorithm.
		assert.isTrue(Option.isNone(IntegrityHash.algorithmOf("10c0/deadbeef")));
		assert.isTrue(Option.isNone(IntegrityHash.algorithmOf("not-a-hash")));
	});

	it.effect("decode returns the branded value and fails typed on garbage", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* IntegrityHash.decode("sha512.abc"), "sha512.abc");
			const error = yield* Effect.flip(IntegrityHash.decode("garbage"));
			assert.instanceOf(error, InvalidIntegrityHashError);
			assert.strictEqual(error._tag, "InvalidIntegrityHashError");
			assert.strictEqual(error.input, "garbage");
		}),
	);
});

// The corepack pin tail is the one place the kit meets the `<algo>.<hex>` form,
// and TWO schemas model it — `PackageManagerPin.integrity` here and
// `@effected/package-json`'s `PackageManager.integrity`. Both consume this
// export. The forms the wider brand accepts and this one must not are the
// point of the suite: an SRI or yarn hash in a pin tail is not a near-miss, it
// is a value that field can never legitimately hold.
describe("CorepackIntegrityHash", () => {
	const decode = Schema.decodeUnknownEffect(CorepackIntegrityHash);

	it.effect("accepts every corepack form, including corepack's own sha224 default pins", () =>
		Effect.gen(function* () {
			for (const good of [
				"sha512.deadbeef01",
				"sha256.0badf00d",
				"sha1.ac34549e6aa8e7ead463a7407e1c7390f61a6610",
				// corepack 0.34.0's own package.json pins yarn with a sha224 tail.
				"sha224.877304e3c9e5b53431969ee2ca17ee44f366533b0da5a4ba9c2bd447",
			]) {
				assert.strictEqual(yield* decode(good), good, good);
			}
		}),
	);

	it.effect("rejects the two other forms the IntegrityHash brand accepts", () =>
		Effect.gen(function* () {
			for (const wrongForm of ["sha512-tsPuRLBpQ2xk6+8HB4vP0Wq1v0EYlv6q6qz1oqTgU5U=", "10c0/deadbeef0123"]) {
				// The control: the unrestricted brand DOES accept it, so the failure
				// below is the restriction firing and not a malformed fixture.
				assert.strictEqual(yield* Schema.decodeUnknownEffect(IntegrityHash)(wrongForm), wrongForm, wrongForm);
				const error = yield* Effect.flip(decode(wrongForm));
				assert.strictEqual(error._tag, "SchemaError", wrongForm);
			}
		}),
	);

	it.effect("rejects malformed corepack-shaped hashes", () =>
		Effect.gen(function* () {
			// Uppercase hex, an unknown algorithm, an empty digest and an empty
			// string: each is rejected by the underlying brand or the restriction.
			for (const bad of ["sha512.DEADBEEF", "md5.deadbeef", "sha512.", "", "sha512"]) {
				const error = yield* Effect.flip(decode(bad));
				assert.strictEqual(error._tag, "SchemaError", bad);
			}
		}),
	);

	it.effect("decodes to the same brand as the unrestricted schema — no second brand", () =>
		Effect.gen(function* () {
			const restricted = yield* decode("sha512.deadbeef01");
			// Assignable in both directions at the type level (this line is the
			// assertion; it stops compiling if a second brand is introduced), and
			// equal at the value level.
			const wide: typeof IntegrityHash.Type = restricted;
			assert.strictEqual(wide, yield* Schema.decodeUnknownEffect(IntegrityHash)("sha512.deadbeef01"));
		}),
	);

	// The consolidation guard, and it has to be an IDENTITY assertion.
	//
	// `Schema.check` is erased from the built type, so a consumer that severs
	// this import type-checks; and a faithful private copy of the restriction
	// behaves identically, so the rejection matrix above passes too. Neither
	// `tsc` nor any behavioural test can see the re-fork. What discriminates is
	// the field schema's OBJECT IDENTITY: the pin's `integrity` field must be
	// this very schema, not one that merely agrees with it.
	it("PackageManagerPin.integrity IS this schema, not a copy that agrees with it", () => {
		// `Schema.optionalKey(X)` keeps `X` on `.schema`.
		assert.strictEqual(
			PackageManagerPin.fields.integrity.schema,
			CorepackIntegrityHash,
			"PackageManagerPin must consume the shared corepack schema, not re-derive the restriction",
		);
		// The control: the assertion discriminates. It is NOT satisfied by the
		// unrestricted brand, so it fails if the pin falls back to `IntegrityHash`
		// — the mutant a type error would never catch. (Widened to `unknown`: the
		// two schema values now carry DIFFERENT statics, so their types no longer
		// unify — the comparison is about runtime identity, not assignability.)
		assert.notStrictEqual<unknown>(PackageManagerPin.fields.integrity.schema, IntegrityHash);
	});
});

describe("SriIntegrityHash", () => {
	const decode = Schema.decodeUnknownEffect(SriIntegrityHash);

	it.effect("accepts every SRI algorithm, including base64 carrying + and /", () =>
		Effect.gen(function* () {
			for (const good of [
				"sha512-m35mtvgU4nbE8ZHd4EFqKu5jJeQY0gPUYHzKTno57JT/QeHzM9RRLNQsIcG0npsFYBxJfJ1tC/NH4zEWc2gdxQ==",
				"sha512-6GbxZtliXuGHKFzJGFkqqNAbZzErb42XvCLdnr29KVR3OwvwU+D1MxNPpfzKOkde/TlM/KLsciuNqqmCSS/Yag==",
				"sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC",
				"sha256-tsPuRLBpQ2xk6+8HB4vP0Wq1v0EYlv6q6qz1oqTgU5U=",
				"sha1-rAaRyuqI5+rUBqc0B+HHOQ9hZhA=",
			]) {
				assert.strictEqual(yield* decode(good), good, good);
			}
		}),
	);

	it.effect("rejects the two other forms the IntegrityHash brand accepts", () =>
		Effect.gen(function* () {
			for (const wrongForm of ["sha512.deadbeef01", "10c0/deadbeef0123"]) {
				// The control: the unrestricted brand DOES accept it, so the failure
				// below is the restriction firing and not a malformed fixture.
				assert.strictEqual(yield* Schema.decodeUnknownEffect(IntegrityHash)(wrongForm), wrongForm, wrongForm);
				const error = yield* Effect.flip(decode(wrongForm));
				assert.strictEqual(error._tag, "SchemaError", wrongForm);
			}
		}),
	);

	it.effect("rejects malformed SRI-shaped hashes", () =>
		Effect.gen(function* () {
			// sha224 is not an SRI algorithm; md5 is unknown; empty digest; a
			// space in the base64; empty string.
			for (const bad of ["sha224-3q2+7w==", "md5-3q2+7w==", "sha512-", "sha512-not base64", ""]) {
				const error = yield* Effect.flip(decode(bad));
				assert.strictEqual(error._tag, "SchemaError", bad);
			}
		}),
	);

	it.effect("decodes to the same brand as the unrestricted schema — no second brand", () =>
		Effect.gen(function* () {
			const input = "sha256-tsPuRLBpQ2xk6+8HB4vP0Wq1v0EYlv6q6qz1oqTgU5U=";
			const restricted = yield* decode(input);
			const wide: typeof IntegrityHash.Type = restricted;
			assert.strictEqual(wide, yield* Schema.decodeUnknownEffect(IntegrityHash)(input));
		}),
	);

	it("is a distinct schema from both the unrestricted brand and the corepack narrowing", () => {
		assert.notStrictEqual<unknown>(SriIntegrityHash, IntegrityHash);
		assert.notStrictEqual<unknown>(SriIntegrityHash, CorepackIntegrityHash);
	});
});

// The SRI → corepack bridge: npm's registry speaks `sha512-<base64>`, a
// `packageManager` pin speaks `sha512.<hex>`, and this codec is the one
// sanctioned conversion between them. The fixture is a REAL pair — both
// spellings of the 64-byte sha512 digest of "hello" — and the suite re-derives
// the hex from the base64 bytes independently, so a transposed fixture cannot
// vouch for itself.
describe("CorepackIntegrityHash.FromSri", () => {
	const sriBase64 = "m3HSJL1i83hdltRq0+o9czGb+8KJDKra4t/3JRlnPKcjI8PZm6XBHXx6zG4UuMXaDEZjR1wuXDre9G9zvN7AQw==";
	const sri = `sha512-${sriBase64}`;
	const corepack =
		"sha512.9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043";

	const decode = Schema.decodeUnknownEffect(CorepackIntegrityHash.FromSri);
	const encode = Schema.encodeUnknownEffect(CorepackIntegrityHash.FromSri);

	it.effect("converts a known SRI value to the corepack form", () =>
		Effect.gen(function* () {
			const converted = yield* decode(sri);
			assert.strictEqual(converted, corepack);
			// The independent oracle: the same hex, derived from the base64 bytes
			// here in the test rather than copied from the fixture.
			assert.strictEqual(converted, `sha512.${Buffer.from(sriBase64, "base64").toString("hex")}`);
			// The result is corepack-form and decodes through the shared schema.
			assert.isTrue(IntegrityHash.isCorepack(converted));
			assert.strictEqual(yield* Schema.decodeUnknownEffect(CorepackIntegrityHash)(converted), converted);
		}),
	);

	it.effect("tolerates one layer of JSON quotes around the input and unwraps it", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* decode(`"${sri}"`), corepack);
			// Only ONE layer, and only a matched pair: a lone quote is malformed.
			const error = yield* Effect.flip(decode(`"${sri}`));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("accepts the unpadded canonical spelling", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* decode(`sha512-${sriBase64.slice(0, -2)}`), corepack);
		}),
	);

	it.effect("rejects non-sha512 SRI hashes — corepack accepts nothing weaker", () =>
		Effect.gen(function* () {
			for (const bad of [`sha256-${sriBase64}`, `sha1-${sriBase64}`, `sha384-${sriBase64}`]) {
				// The control: the wide brand DOES accept these, so the failure below
				// is the sha512 restriction firing, not a malformed fixture.
				assert.strictEqual(yield* Schema.decodeUnknownEffect(IntegrityHash)(bad), bad, bad);
				const error = yield* Effect.flip(decode(bad));
				assert.strictEqual(error._tag, "SchemaError", bad);
			}
			const error = yield* Effect.flip(decode("garbage"));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("rejects an already-corepack-form input — the conversion is one-way from SRI", () =>
		Effect.gen(function* () {
			// The control: the corepack schema itself accepts the value, so the
			// rejection below is the one-way rule, not an invalid fixture.
			assert.strictEqual(yield* Schema.decodeUnknownEffect(CorepackIntegrityHash)(corepack), corepack);
			const error = yield* Effect.flip(decode(corepack));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("rejects malformed and non-canonical base64", () =>
		Effect.gen(function* () {
			for (const bad of [
				// A valid base64 payload that is not a 64-byte digest (the wide brand
				// accepts this spelling; the bridge must not mint a bad pin from it).
				"sha512-YWJj",
				// Empty payload.
				"sha512-",
				// A length no base64 output has (remainder 1).
				`sha512-${"A".repeat(85)}`,
				// Padding that does not match the body length (lenient decoders
				// accept this; the canonical form ends `==`).
				`sha512-${sriBase64.slice(0, -1)}`,
				// Interior `=`.
				`sha512-${sriBase64.slice(0, -4)}=${sriBase64.slice(-4)}`,
				// A character outside the alphabet.
				"sha512-ab!c",
				// Non-zero trailing bits: `Qx==` decodes to the same byte as `Qw==`
				// under a lenient decoder but is not the canonical spelling npm emits.
				`sha512-${sriBase64.slice(0, -3)}x==`,
			]) {
				const error = yield* Effect.flip(decode(bad));
				assert.strictEqual(error._tag, "SchemaError", bad);
			}
		}),
	);

	it.effect("fromSri is the Effect convenience: same conversion, typed error", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* CorepackIntegrityHash.fromSri(sri), corepack);
			assert.strictEqual(yield* CorepackIntegrityHash.fromSri(`"${sri}"`), corepack);
			const error = yield* Effect.flip(CorepackIntegrityHash.fromSri(`sha256-${sriBase64}`));
			assert.instanceOf(error, InvalidSriIntegrityHashError);
			assert.strictEqual(error._tag, "InvalidSriIntegrityHashError");
			assert.strictEqual(error.input, `sha256-${sriBase64}`);
		}),
	);

	it.effect("encodes back to the canonical padded SRI spelling", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* encode(corepack), sri);
			// A value decoded from the quoted spelling re-encodes UNQUOTED: the
			// quote tolerance is decode-side lenience, not a remembered wire form.
			assert.strictEqual(yield* encode(yield* decode(`"${sri}"`)), sri);
		}),
	);

	it.effect("encode fails typed for corepack hashes SRI cannot carry", () =>
		Effect.gen(function* () {
			// Both are valid CorepackIntegrityHash values — the control below
			// proves it — but neither is a 64-byte sha512 digest.
			for (const bad of ["sha224.877304e3c9e5b53431969ee2ca17ee44f366533b0da5a4ba9c2bd447", "sha512.deadbeef"]) {
				assert.strictEqual(yield* Schema.decodeUnknownEffect(CorepackIntegrityHash)(bad), bad, bad);
				const error = yield* Effect.flip(encode(bad));
				assert.strictEqual(error._tag, "SchemaError", bad);
			}
		}),
	);
});

describe("SriIntegrityHash validates shape, not the digest", () => {
	it.effect("accepts a digest CorepackIntegrityHash.fromSri then rejects", () =>
		Effect.gen(function* () {
			const value = "sha512-oldHash==";
			const decoded = Schema.decodeUnknownExit(SriIntegrityHash)(value);
			assert.isTrue(decoded._tag === "Success", "shape-valid SRI is accepted");
			const converted = yield* Effect.flip(CorepackIntegrityHash.fromSri(value));
			assert.strictEqual(converted._tag, "InvalidSriIntegrityHashError");
		}),
	);
});
