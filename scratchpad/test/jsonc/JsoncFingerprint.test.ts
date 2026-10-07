// The synchronous digest callback is explicitly tested against Node's real backend.
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { createHash } from "node:crypto";
import { assert, describe, it } from "@effect/vitest";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { JsoncDigest } from "@beep/scratchpad/effected/jsonc/index";
import { JsoncCanonicalizeError, JsoncFingerprint, JsoncTextHashOptions } from "@beep/scratchpad/effected/jsonc/index";

// A real SHA-256 backend over WebCrypto (Node 20+), wired through core's
// Crypto.make so the tests exercise the exact service contract consumers
// provide (e.g. NodeCrypto.layer from @effect/platform-node).
const cryptoTest = Crypto.make({
		randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
		digest: (algorithm, data) =>
			Effect.promise(() => globalThis.crypto.subtle.digest(algorithm, new Uint8Array(data))).pipe(
				Effect.map((buffer) => new Uint8Array(buffer)),
			),
	});

// The consumer-side platform binding the sync twins take, written exactly as
// the JsoncDigest docs tell a Node consumer to write it. Node's Buffer IS a
// Uint8Array, so no copy is needed.
const nodeDigest: JsoncDigest = (bytes) => createHash("sha256").update(bytes).digest();

const provideCrypto = <A, E>(effect: Effect.Effect<A, E, Crypto.Crypto>): Effect.Effect<A, E> =>
	Effect.provideService(effect, Crypto.Crypto, cryptoTest);

describe("JsoncFingerprint", () => {
	describe("canonicalizeResult (RFC 8785 vectors)", () => {
		it("serializes the RFC 8785 section 3.2.3 structure vector byte-for-byte", () => {
			// The RFC's input JSON, decoded into the equivalent runtime value:
			// numbers [333333333.33333329, 1E30, 4.50, 2e-3, 1e-27], the
			// escape-heavy string (Euro sign, "$", U+000F, LF, "A'B", quote,
			// two backslashes, quote, solidus) and the three literals.
			const shiftIn = String.fromCharCode(0x0f);
			const input = {
				numbers: [Number("333333333.33333329"), 1e30, 4.5, 0.002, 1e-27],
				string: ["\u20ac$", shiftIn, "\n", "A'B", '"', "\\", "\\", '"', "/"].join(""),
				literals: [null, true, false],
			};
			// The expected canonical text, assembled around an explicit
			// backslash so no source-level escape ambiguity can creep in:
			// "\u20ac$\u000f\nA'B\"\\\\\"/" with the Euro sign raw (JCS never
			// escapes above U+001F) and U+000F as a lowercase \u escape.
			const b = "\\";
			const expectedString = `"\u20ac$${b}u000f${b}nA'B${b}"${b}${b}${b}${b}${b}"/"`;
			const expected = `{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":${expectedString}}`;
			const result = JsoncFingerprint.canonicalizeResult(input);
			assert.isTrue(Result.isSuccess(result));
			assert.strictEqual(Result.getOrThrow(result), expected);
		});

		it("sorts object keys by UTF-16 code units per the RFC 8785 section 3.2.3 ordering vector", () => {
			const c80 = String.fromCharCode(0x80);
			const input = {
				"\u20ac": "Euro Sign",
				"\r": "Carriage Return",
				"\ufb33": "Hebrew Letter Dalet With Dagesh",
				"1": "One",
				"\u{1f600}": "Emoji: Grinning Face",
				[c80]: "Control",
				"\u00f6": "Latin Small Letter O With Diaeresis",
			};
			// U+1F600 (surrogate pair D83D DE00) sorts BEFORE U+FB33 - the
			// code-unit ordering the RFC pins against code-point ordering.
			// U+0080 is emitted raw: only C0 controls are escaped.
			const b = "\\";
			const expected = `{"${b}r":"Carriage Return","1":"One","${c80}":"Control","\u00f6":"Latin Small Letter O With Diaeresis","\u20ac":"Euro Sign","\u{1f600}":"Emoji: Grinning Face","\ufb33":"Hebrew Letter Dalet With Dagesh"}`;
			const result = JsoncFingerprint.canonicalizeResult(input);
			assert.isTrue(Result.isSuccess(result));
			assert.strictEqual(Result.getOrThrow(result), expected);
		});

		it("serializes numbers with ECMAScript shortest round-trip form", () => {
			const cases: ReadonlyArray<readonly [number, string]> = [
				[0, "0"],
				[-0, "0"],
				[1, "1"],
				[-1.5, "-1.5"],
				[0.000001, "0.000001"],
				[1e-7, "1e-7"],
				[1e21, "1e+21"],
				[5e-324, "5e-324"],
				[9007199254740991, "9007199254740991"],
				[Number("333333333.33333329"), "333333333.3333333"],
			];
			for (const [value, expected] of cases) {
				assert.strictEqual(Result.getOrThrow(JsoncFingerprint.canonicalizeResult(value)), expected);
			}
		});

		it("escapes strings exactly as JSON.stringify does", () => {
			// Two-character escapes for the named controls, lowercase \u00xx
			// escapes for the remaining C0 controls, everything else literal.
			const nul = String.fromCharCode(0x00);
			const us = String.fromCharCode(0x1f);
			const input = `\b\t\n\f\r${nul}${us}"\\/ok`;
			const b = "\\";
			const expected = `"${b}b${b}t${b}n${b}f${b}r${b}u0000${b}u001f${b}"${b}${b}/ok"`;
			assert.strictEqual(Result.getOrThrow(JsoncFingerprint.canonicalizeResult(input)), expected);
		});

		it("emits compact output with sorted keys at every level", () => {
			const result = JsoncFingerprint.canonicalizeResult({ b: { d: 2, c: [1, { z: 0, a: 0 }] }, a: null });
			assert.strictEqual(Result.getOrThrow(result), '{"a":null,"b":{"c":[1,{"a":0,"z":0}],"d":2}}');
		});

		it("round-trips: parsing the canonical text recovers the value, and re-canonicalizing is identity", () => {
			const input = { b: [1, 2.5, "x", null, true], a: { nested: { deep: "value" } }, c: "" };
			const canonical = Result.getOrThrow(JsoncFingerprint.canonicalizeResult(input));
			assert.deepStrictEqual(JSON.parse(canonical), input);
			assert.strictEqual(Result.getOrThrow(JsoncFingerprint.canonicalizeResult(JSON.parse(canonical))), canonical);
		});

		it("accepts null-prototype objects as plain objects", () => {
			const bare = Object.create(null) as Record<string, unknown>;
			bare.a = 1;
			assert.strictEqual(Result.getOrThrow(JsoncFingerprint.canonicalizeResult(bare)), '{"a":1}');
		});
	});

	describe("canonicalize typed failures", () => {
		const failure = (value: unknown): JsoncCanonicalizeError => {
			const result = JsoncFingerprint.canonicalizeResult(value);
			assert.isTrue(Result.isFailure(result));
			if (Result.isFailure(result)) {
				return result.failure;
			}
			throw new Error("unreachable");
		};

		it("rejects undefined, functions and symbols anywhere, with the JSON-pointer path", () => {
			const top = failure(undefined);
			assert.strictEqual(top.code, "UnrepresentableValue");
			assert.strictEqual(top.path, "");

			const nested = failure({ a: { b: undefined } });
			assert.strictEqual(nested.code, "UnrepresentableValue");
			assert.strictEqual(nested.path, "/a/b");

			const inArray = failure([() => 0]);
			assert.strictEqual(inArray.code, "UnrepresentableValue");
			assert.strictEqual(inArray.path, "/0");

			assert.strictEqual(failure(Symbol("s")).code, "UnrepresentableValue");
		});

		it("rejects an explicit undefined array member at its index", () => {
			const error = failure([undefined]);
			assert.strictEqual(error.code, "UnrepresentableValue");
			assert.strictEqual(error.path, "/0");
		});

		it("rejects sparse array holes typed at the hole's index, never emitting invalid JSON", () => {
			// `Array.prototype.map` would skip holes: new Array(2) would emit
			// "[,]" (invalid JSON) and a one-hole array "[]" (colliding with the
			// empty array). Holes must instead fail like explicit undefined.
			const allHoles = failure(new Array(2));
			assert.strictEqual(allHoles.code, "UnrepresentableValue");
			assert.strictEqual(allHoles.path, "/0");

			const middleHole: Array<number> = new Array(3);
			middleHole[0] = 1;
			middleHole[2] = 3;
			const middle = failure(middleHole);
			assert.strictEqual(middle.code, "UnrepresentableValue");
			assert.strictEqual(middle.path, "/1");

			const nested = failure([0, new Array(1)]);
			assert.strictEqual(nested.code, "UnrepresentableValue");
			assert.strictEqual(nested.path, "/1/0");
		});

		it("rejects lone surrogates in string values, per RFC 8785 I-JSON well-formedness", () => {
			// JSON.stringify would silently emit "\ud800" and report success.
			const high = failure("\uD800");
			assert.strictEqual(high.code, "LoneSurrogate");
			assert.strictEqual(high.path, "");

			const low = failure({ s: "a\uDC00" });
			assert.strictEqual(low.code, "LoneSurrogate");
			assert.strictEqual(low.path, "/s");
		});

		it("rejects lone surrogates in object member keys, with the member's path", () => {
			const error = failure({ "k\uD800": 1 });
			assert.strictEqual(error.code, "LoneSurrogate");
			assert.strictEqual(error.path, "/k\uD800");
		});

		it("accepts well-formed surrogate pairs in values and keys", () => {
			const result = JsoncFingerprint.canonicalizeResult({ "\u{1f600}": "\u{1f600}" });
			assert.isTrue(Result.isSuccess(result));
			assert.strictEqual(Result.getOrThrow(result), '{"\u{1f600}":"\u{1f600}"}');
		});

		it("rejects bigint values", () => {
			const error = failure({ n: 1n });
			assert.strictEqual(error.code, "BigIntValue");
			assert.strictEqual(error.path, "/n");
		});

		it("rejects non-finite numbers instead of nulling them", () => {
			assert.strictEqual(failure(Number.NaN).code, "NonFiniteNumber");
			assert.strictEqual(failure([Number.POSITIVE_INFINITY]).code, "NonFiniteNumber");
			assert.strictEqual(failure({ x: Number.NEGATIVE_INFINITY }).path, "/x");
		});

		it("rejects non-plain objects and ignores toJSON", () => {
			assert.strictEqual(failure(DateTime.makeUnsafe(0).pipe(DateTime.toDateUtc)).code, "NonPlainObject");
			assert.strictEqual(failure({ when: new Map() }).path, "/when");
		});

		it("escapes ~ and / in JSON-pointer path segments", () => {
			const error = failure({ "a/b": { "x~y": Number.NaN } });
			assert.strictEqual(error.path, "/a~1b/x~0y");
		});

		it("fails typed when an object member getter throws, at the member's path", () => {
			// A raw getter exception must not escape canonicalizeResult as a
			// defect — the malformed-input-fails-typed policy covers the read.
			const root: Record<string, unknown> = {};
			Object.defineProperty(root, "boom", {
				enumerable: true,
				get() {
					throw new Error("hostile getter");
				},
			});
			const error = failure(root);
			assert.strictEqual(error.code, "UnrepresentableValue");
			assert.strictEqual(error.path, "/boom");
			assert.include(error.detail, "getter");

			const inner: Record<string, unknown> = {};
			Object.defineProperty(inner, "b", {
				enumerable: true,
				get() {
					throw new Error("hostile nested getter");
				},
			});
			const nested = failure({ a: inner });
			assert.strictEqual(nested.code, "UnrepresentableValue");
			assert.strictEqual(nested.path, "/a/b");
		});

		it("fails typed when an array index getter throws, at the element's index", () => {
			const items: Array<number> = [1, 2];
			Object.defineProperty(items, 1, {
				get() {
					throw new Error("hostile index getter");
				},
			});
			const error = failure(items);
			assert.strictEqual(error.code, "UnrepresentableValue");
			assert.strictEqual(error.path, "/1");
			assert.include(error.detail, "getter");
		});

		it("still canonicalizes benign getters, matching JSON.stringify accessor semantics", () => {
			const value: Record<string, unknown> = { a: 1 };
			Object.defineProperty(value, "b", { enumerable: true, get: () => 2 });
			const result = JsoncFingerprint.canonicalizeResult(value);
			assert.isTrue(Result.isSuccess(result));
			assert.strictEqual(Result.getOrThrow(result), '{"a":1,"b":2}');
		});

		it("fails typed on cyclic values via the depth cap", () => {
			const cyclic: Record<string, unknown> = {};
			cyclic.self = cyclic;
			assert.strictEqual(failure(cyclic).code, "NestingDepthExceeded");
		});

		it("fails typed on deeply nested input, never as a stack overflow", () => {
			let deep: unknown = 1;
			for (let i = 0; i < 20000; i++) {
				deep = [deep];
			}
			assert.strictEqual(failure(deep).code, "NestingDepthExceeded");
		});

		it.effect("the Effect twin fails with the same error", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(JsoncFingerprint.canonicalize({ a: undefined }));
				assert.instanceOf(error, JsoncCanonicalizeError);
				assert.strictEqual(error._tag, "JsoncCanonicalizeError");
				assert.strictEqual(error.code, "UnrepresentableValue");
				assert.strictEqual(error.path, "/a");
				assert.include(error.message, "UnrepresentableValue");
			}),
		);
	});

	describe("hashText", () => {
		it.effect("matches the known-answer SHA-256 vectors", () =>
			provideCrypto(
				Effect.gen(function* () {
					assert.strictEqual(
						yield* JsoncFingerprint.hashText(""),
						"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
					);
					assert.strictEqual(
						yield* JsoncFingerprint.hashText("abc"),
						"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
					);
				}),
			),
		);

		it.effect("hashes the UTF-8 bytes verbatim by default", () =>
			provideCrypto(
				Effect.gen(function* () {
					const crlf = yield* JsoncFingerprint.hashText("a\r\nb");
					const lf = yield* JsoncFingerprint.hashText("a\nb");
					assert.notStrictEqual(crlf, lf);
				}),
			),
		);

		it.effect("normalizes CRLF and bare CR to LF when normalizeEol is set", () =>
			provideCrypto(
				Effect.gen(function* () {
					const options = JsoncTextHashOptions.make({ normalizeEol: true });
					const crlf = yield* JsoncFingerprint.hashText("a\r\nb\rc", options);
					const lf = yield* JsoncFingerprint.hashText("a\nb\nc", options);
					assert.strictEqual(crlf, lf);
				}),
			),
		);
	});

	describe("hash", () => {
		it.effect("fingerprints the canonical serialization — key order never matters", () =>
			provideCrypto(
				Effect.gen(function* () {
					const a = yield* JsoncFingerprint.hash({ b: 2, a: [1, { y: 0, x: 0 }] });
					const b = yield* JsoncFingerprint.hash({ a: [1, { x: 0, y: 0 }], b: 2 });
					assert.strictEqual(a, b);
					assert.match(a, /^[0-9a-f]{64}$/);
				}),
			),
		);

		it.effect("emits the sbom Sha256Digest format: exactly 64 lowercase hex characters, no prefix", () =>
			provideCrypto(
				Effect.gen(function* () {
					// Mirrors @effected/sbom's SHA256_RE (/^[0-9a-f]{64}$/) without
					// taking the forbidden pure-tier → integrated-tier edge: the
					// digest must decode through sbom's Sha256Digest downstream.
					const sbomSha256Re = /^[0-9a-f]{64}$/;
					const fromValue = yield* JsoncFingerprint.hash({ subject: "artifact" });
					const fromText = yield* JsoncFingerprint.hashText("artifact bytes");
					assert.match(fromValue, sbomSha256Re);
					assert.match(fromText, sbomSha256Re);
					assert.notMatch(fromValue, /^sha256:/i);
					assert.notMatch(fromText, /^sha256:/i);
				}),
			),
		);

		it.effect("agrees with hashText over the canonical text", () =>
			provideCrypto(
				Effect.gen(function* () {
					const value = { b: 1, a: [2, "x"] };
					const direct = yield* JsoncFingerprint.hash(value);
					const viaText = yield* JsoncFingerprint.hashText(yield* JsoncFingerprint.canonicalize(value));
					assert.strictEqual(direct, viaText);
				}),
			),
		);

		it.effect("hashes exactly the canonical bytes", () =>
			provideCrypto(
				Effect.gen(function* () {
					// canonicalize({b: 2, a: 1}) is '{"a":1,"b":2}'; the
					// fingerprint is the SHA-256 of exactly those 13 ASCII bytes.
					assert.strictEqual(
						yield* JsoncFingerprint.hash({ b: 2, a: 1 }),
						yield* JsoncFingerprint.hashText('{"a":1,"b":2}'),
					);
				}),
			),
		);

		it.effect("propagates canonicalization failures typed", () =>
			provideCrypto(
				Effect.gen(function* () {
					const error = yield* Effect.flip(JsoncFingerprint.hash({ bad: undefined }));
					assert.instanceOf(error, JsoncCanonicalizeError);
					if (S.is(JsoncCanonicalizeError)(error)) {
						assert.strictEqual(error.path, "/bad");
					}
				}),
			),
		);
	});

	describe("normalizeEol", () => {
		it("converts CRLF and bare CR to LF and touches nothing else", () => {
			assert.strictEqual(JsoncFingerprint.normalizeEol("a\r\nb\rc\nd"), "a\nb\nc\nd");
			assert.strictEqual(JsoncFingerprint.normalizeEol("no line endings"), "no line endings");
			assert.strictEqual(JsoncFingerprint.normalizeEol(""), "");
		});
	});

	describe("hashResult / hashTextResult (synchronous, caller-supplied digest)", () => {
		it.effect("agrees with hash byte for byte, with no fiber in sight", () =>
			provideCrypto(
				Effect.gen(function* () {
					// Deliberately key-disordered and nested, so agreement
					// covers the canonical serialization and not just the
					// digest of a flat scalar.
					const value = { b: 2, a: [1, { y: 0, x: "\u20ac" }], c: null };
					const async = yield* JsoncFingerprint.hash(value);
					const sync = JsoncFingerprint.hashResult(value, nodeDigest);
					assert.deepStrictEqual(sync, Result.succeed(async));
					assert.match(async, /^[0-9a-f]{64}$/);
				}),
			),
		);

		it.effect("agrees with hashText byte for byte, normalizeEol included", () =>
			provideCrypto(
				Effect.gen(function* () {
					const options = JsoncTextHashOptions.make({ normalizeEol: true });
					const text = "line one\r\nline two\rline three";
					assert.deepStrictEqual(
						JsoncFingerprint.hashTextResult(text, nodeDigest),
						Result.succeed(yield* JsoncFingerprint.hashText(text)),
					);
					assert.deepStrictEqual(
						JsoncFingerprint.hashTextResult(text, nodeDigest, options),
						Result.succeed(yield* JsoncFingerprint.hashText(text, options)),
					);
					// The two option settings must NOT agree: without this the
					// pair above would pass even if normalizeEol were ignored.
					assert.notStrictEqual(
						Result.getOrThrow(JsoncFingerprint.hashTextResult(text, nodeDigest)),
						Result.getOrThrow(JsoncFingerprint.hashTextResult(text, nodeDigest, options)),
					);
				}),
			),
		);

		it("matches the known-answer SHA-256 vectors", () => {
			assert.deepStrictEqual(
				JsoncFingerprint.hashTextResult("", nodeDigest),
				Result.succeed("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
			);
			assert.deepStrictEqual(
				JsoncFingerprint.hashTextResult("abc", nodeDigest),
				Result.succeed("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"),
			);
		});

		it("propagates canonicalization failures unchanged, with the JSON-pointer path", () => {
			const failure = JsoncFingerprint.hashResult({ a: { b: undefined } }, nodeDigest);
			assert.isTrue(Result.isFailure(failure));
			if (Result.isFailure(failure)) {
				assert.instanceOf(failure.failure, JsoncCanonicalizeError);
				assert.strictEqual(failure.failure.code, "UnrepresentableValue");
				assert.strictEqual(failure.failure.path, "/a/b");
			}
		});

		it("fails typed with InvalidDigest when the supplied digest is not 32 bytes wide", () => {
			// A SHA-1 binding, the realistic mistake: 20 bytes, would have
			// emitted a plausible-looking 40-character hex string.
			const sha1: JsoncDigest = (bytes) => createHash("sha1").update(bytes).digest();
			for (const failure of [
				JsoncFingerprint.hashResult({ a: 1 }, sha1),
				JsoncFingerprint.hashTextResult("abc", sha1),
			]) {
				assert.isTrue(Result.isFailure(failure));
				if (Result.isFailure(failure)) {
					assert.strictEqual(failure.failure.code, "InvalidDigest");
					assert.strictEqual(failure.failure.path, "");
					assert.include(failure.failure.detail, "20 bytes");
				}
			}
		});

		it("fails typed with InvalidDigest when the supplied digest throws", () => {
			// The realistic binding mistake, thrown by Node itself rather than
			// by a hand-written stub: an algorithm name OpenSSL does not know.
			// The `assert.throws` is the precondition — without it this test
			// would pass vacuously the day the name became valid, which is not
			// hypothetical: "sha-256" (hyphenated) IS accepted by this Node.
			// Escaping, the throw would crash the synchronous host these twins
			// exist to be called from.
			const unknownAlgorithm: JsoncDigest = (bytes) => createHash("sha256x").update(bytes).digest();
			assert.throws(() => createHash("sha256x"));
			for (const failure of [
				JsoncFingerprint.hashResult({ a: 1 }, unknownAlgorithm),
				JsoncFingerprint.hashTextResult("abc", unknownAlgorithm),
			]) {
				assert.isTrue(Result.isFailure(failure));
				if (Result.isFailure(failure)) {
					assert.strictEqual(failure.failure.code, "InvalidDigest");
					assert.strictEqual(failure.failure.path, "");
					assert.include(failure.failure.detail, "threw");
				}
			}
		});

		it("hashes the bytes it was given, not a re-encoding of them", () => {
			// The digest sees the UTF-8 encoding of the canonical text and
			// nothing else — proven by computing the expected answer from the
			// canonical string independently.
			const value = { \u00e9: "\u20ac" };
			const canonical = Result.getOrThrow(JsoncFingerprint.canonicalizeResult(value));
			const expected = createHash("sha256").update(new TextEncoder().encode(canonical)).digest("hex");
			assert.deepStrictEqual(JsoncFingerprint.hashResult(value, nodeDigest), Result.succeed(expected));
		});
	});
});
