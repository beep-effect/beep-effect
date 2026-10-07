// The synchronous digest callback is tested against Node's real backend.
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { createHash } from "node:crypto";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { JsoncDigest } from "../../effected/jsonc/index.ts";
import {
  JsoncCanonicalizeError,
  JsoncCanonicalizeErrorCode,
  JsoncFingerprint,
  JsoncTextHashOptions,
} from "../../effected/jsonc/index.ts";

// A real SHA-256 backend over WebCrypto, wired through core's Crypto.make so
// the tests exercise the exact service contract consumers provide.
const CryptoTest = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
    digest: (algorithm, data) =>
      Effect.map(Effect.promise(() => globalThis.crypto.subtle.digest(algorithm, new Uint8Array(data))), (buffer) => new Uint8Array(buffer)),
  })
);

// The consumer-side platform binding the sync twins take. Node's Buffer is a
// Uint8Array, so no copy is needed.
const nodeDigest: JsoncDigest = (bytes) => createHash("sha256").update(bytes).digest();

const SHA256_HEX = /^[0-9a-f]{64}$/;

const failure = (value: unknown): JsoncCanonicalizeError => JsoncFingerprint.canonicalizeResult(value).pipe(Result.flip, Result.getOrThrow);

const failureOfResult = <E>(result: Result.Result<unknown, E>): E => result.pipe(Result.flip, Result.getOrThrow);

const decodeJson = S.decodeResult(S.fromJsonString(S.Unknown));

describe("JsoncFingerprint", () => {
  describe("schemas", () => {
    it("exposes the code kit, the error class and the hash options", () => {
      assert.isTrue(JsoncCanonicalizeErrorCode.is.InvalidDigest("InvalidDigest"));
      assert.strictEqual(JsoncCanonicalizeErrorCode.literals.length, 7);
      const error = JsoncCanonicalizeError.make({ code: "BigIntValue", path: "/n", detail: "d" });
      assert.isTrue(S.is(JsoncCanonicalizeError)(error));
      assert.strictEqual(error.message, 'Canonical JSON serialization failed: BigIntValue at "/n" — d');
      assert.deepStrictEqual({ ...JsoncTextHashOptions.make({}) }, { normalizeEol: false });
    });
  });

  describe("canonicalizeResult (RFC 8785 vectors)", () => {
    it("serializes the RFC 8785 section 3.2.3 structure vector byte-for-byte", () => {
      const shiftIn = String.fromCharCode(0x0f);
      const input = {
        numbers: [Number("333333333.33333329"), 1e30, 4.5, 0.002, 1e-27],
        string: ["€$", shiftIn, "\n", "A'B", '"', "\\", "\\", '"', "/"].join(""),
        literals: [null, true, false],
      };
      const b = "\\";
      const expectedString = `"€$${b}u000f${b}nA'B${b}"${b}${b}${b}${b}${b}"/"`;
      assertSuccess(
        JsoncFingerprint.canonicalizeResult(input),
        `{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":${expectedString}}`
      );
    });

    // Regression: the port built array indices with A.makeBy, which yields at
    // least one index, so every empty array failed (upstream handles []).
    it("canonicalizes empty arrays at the top level and nested", () => {
      assertSuccess(JsoncFingerprint.canonicalizeResult([]), "[]");
      assertSuccess(JsoncFingerprint.canonicalizeResult({ a: [], b: [[], {}] }), '{"a":[],"b":[[],{}]}');
    });

    it("sorts object keys by UTF-16 code units per the RFC 8785 ordering vector", () => {
      const c80 = String.fromCharCode(0x80);
      const input = {
        "€": "Euro Sign",
        "\r": "Carriage Return",
        "דּ": "Hebrew Letter Dalet With Dagesh",
        "1": "One",
        "\u{1f600}": "Emoji: Grinning Face",
        [c80]: "Control",
        "ö": "Latin Small Letter O With Diaeresis",
      };
      const b = "\\";
      assertSuccess(
        JsoncFingerprint.canonicalizeResult(input),
        `{"${b}r":"Carriage Return","1":"One","${c80}":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","\u{1f600}":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}`
      );
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
        assertSuccess(JsoncFingerprint.canonicalizeResult(value), expected);
      }
    });

    it("escapes strings exactly as JSON.stringify does", () => {
      const nul = String.fromCharCode(0x00);
      const us = String.fromCharCode(0x1f);
      const b = "\\";
      assertSuccess(JsoncFingerprint.canonicalizeResult(`\b\t\n\f\r${nul}${us}"\\/ok`), `"${b}b${b}t${b}n${b}f${b}r${b}u0000${b}u001f${b}"${b}${b}/ok"`);
    });

    it("emits compact output with sorted keys at every level and round-trips", () => {
      assertSuccess(JsoncFingerprint.canonicalizeResult({ b: { d: 2, c: [1, { z: 0, a: 0 }] }, a: null }), '{"a":null,"b":{"c":[1,{"a":0,"z":0}],"d":2}}');
      const input = { b: [1, 2.5, "x", null, true], a: { nested: { deep: "value" } }, c: "" };
      const canonical = Result.getOrThrow(JsoncFingerprint.canonicalizeResult(input));
      assertSuccess(decodeJson(canonical), input);
      assertSuccess(JsoncFingerprint.canonicalizeResult(Result.getOrThrow(decodeJson(canonical))), canonical);
    });

    it("accepts null-prototype objects as plain objects", () => {
      const bare: Record<string, unknown> = Object.create(null);
      bare["a"] = 1;
      assertSuccess(JsoncFingerprint.canonicalizeResult(bare), '{"a":1}');
    });
  });

  describe("canonicalize typed failures", () => {
    it("rejects undefined, functions and symbols anywhere, with the JSON-pointer path", () => {
      assert.deepStrictEqual([failure(undefined).code, failure(undefined).path], ["UnrepresentableValue", ""]);
      assert.deepStrictEqual([failure({ a: { b: undefined } }).code, failure({ a: { b: undefined } }).path], ["UnrepresentableValue", "/a/b"]);
      assert.deepStrictEqual([failure([() => 0]).code, failure([() => 0]).path], ["UnrepresentableValue", "/0"]);
      assert.strictEqual(failure(Symbol("s")).code, "UnrepresentableValue");
    });

    it("rejects sparse array holes typed at the hole's index, never emitting invalid JSON", () => {
      assert.strictEqual(failure(new Array(2)).path, "/0");
      const middleHole: Array<number> = new Array(3);
      middleHole[0] = 1;
      middleHole[2] = 3;
      assert.strictEqual(failure(middleHole).path, "/1");
      assert.strictEqual(failure([0, new Array(1)]).path, "/1/0");
    });

    it("rejects lone surrogates in values and member keys", () => {
      assert.deepStrictEqual([failure("\uD800").code, failure("\uD800").path], ["LoneSurrogate", ""]);
      assert.strictEqual(failure({ s: "a\uDC00" }).path, "/s");
      assert.deepStrictEqual([failure({ "k\uD800": 1 }).code, failure({ "k\uD800": 1 }).path], ["LoneSurrogate", "/k\uD800"]);
      assertSuccess(JsoncFingerprint.canonicalizeResult({ "\u{1f600}": "\u{1f600}" }), '{"\u{1f600}":"\u{1f600}"}');
    });

    it("rejects bigints and non-finite numbers", () => {
      assert.deepStrictEqual([failure({ n: 1n }).code, failure({ n: 1n }).path], ["BigIntValue", "/n"]);
      assert.strictEqual(failure(Number.NaN).code, "NonFiniteNumber");
      assert.strictEqual(failure([Number.POSITIVE_INFINITY]).code, "NonFiniteNumber");
      assert.strictEqual(failure({ x: Number.NEGATIVE_INFINITY }).path, "/x");
    });

    it("rejects non-plain objects and ignores toJSON", () => {
      assert.strictEqual(failure(DateTime.makeUnsafe(0).pipe(DateTime.toDateUtc)).code, "NonPlainObject");
      assert.strictEqual(failure({ when: new Map() }).path, "/when");
      assert.strictEqual(failure({ toJSON: () => 1 }).code, "UnrepresentableValue");
    });

    it("escapes ~ and / in JSON-pointer path segments", () => {
      assert.strictEqual(failure({ "a/b": { "x~y": Number.NaN } }).path, "/a~1b/x~0y");
    });

    it("fails typed when a getter throws, at the member's path, and still reads benign getters", () => {
      const root: Record<string, unknown> = {};
      Object.defineProperty(root, "boom", {
        enumerable: true,
        get() {
          throw new Error("hostile getter");
        },
      });
      assert.deepStrictEqual([failure(root).code, failure(root).path], ["UnrepresentableValue", "/boom"]);
      assert.include(failure(root).detail, "getter");
      const items: Array<number> = [1, 2];
      Object.defineProperty(items, 1, {
        get() {
          throw new Error("hostile index getter");
        },
      });
      assert.strictEqual(failure(items).path, "/1");
      const benign: Record<string, unknown> = { a: 1 };
      Object.defineProperty(benign, "b", { enumerable: true, get: () => 2 });
      assertSuccess(JsoncFingerprint.canonicalizeResult(benign), '{"a":1,"b":2}');
    });

    it("fails typed on cyclic and deeply nested values via the depth cap", () => {
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      assert.strictEqual(failure(cyclic).code, "NestingDepthExceeded");
      let deep: unknown = 1;
      for (let i = 0; i < 20000; i++) {
        deep = [deep];
      }
      assert.strictEqual(failure(deep).code, "NestingDepthExceeded");
    });

    it.effect("the Effect twin fails with the same error", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(JsoncFingerprint.canonicalize({ a: undefined }));
        assert.deepStrictEqual(error, failure({ a: undefined }));
        assert.include(error.message, 'UnrepresentableValue at "/a"');
        assert.strictEqual(yield* JsoncFingerprint.canonicalize([1, "x", true]), '[1,"x",true]');
      })
    );
  });

  describe("normalizeEol", () => {
    it("converts CRLF and bare CR to LF and touches nothing else", () => {
      assert.strictEqual(JsoncFingerprint.normalizeEol("a\r\nb\rc\nd"), "a\nb\nc\nd");
      assert.strictEqual(JsoncFingerprint.normalizeEol("no line endings"), "no line endings");
      assert.strictEqual(JsoncFingerprint.normalizeEol(""), "");
    });
  });

  it.layer(CryptoTest)("hash and hashText with a Crypto layer", (it) => {
    it.effect("hashText matches the known-answer SHA-256 vectors", () =>
      Effect.gen(function* () {
        assert.strictEqual(yield* JsoncFingerprint.hashText(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        assert.strictEqual(yield* JsoncFingerprint.hashText("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
      })
    );

    it.effect("hashText hashes the bytes verbatim unless normalizeEol is set", () =>
      Effect.gen(function* () {
        assert.notStrictEqual(yield* JsoncFingerprint.hashText("a\r\nb"), yield* JsoncFingerprint.hashText("a\nb"));
        const options = JsoncTextHashOptions.make({ normalizeEol: true });
        assert.strictEqual(yield* JsoncFingerprint.hashText("a\r\nb\rc", options), yield* JsoncFingerprint.hashText("a\nb\nc", options));
      })
    );

    it.effect("hash fingerprints the canonical serialization: key order never matters", () =>
      Effect.gen(function* () {
        const a = yield* JsoncFingerprint.hash({ b: 2, a: [1, { y: 0, x: 0 }] });
        const b = yield* JsoncFingerprint.hash({ a: [1, { x: 0, y: 0 }], b: 2 });
        assert.strictEqual(a, b);
        assert.match(a, SHA256_HEX);
        assert.strictEqual(yield* JsoncFingerprint.hash({ b: 2, a: 1 }), yield* JsoncFingerprint.hashText('{"a":1,"b":2}'));
      })
    );

    it.effect("hash propagates canonicalization failures typed", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(JsoncFingerprint.hash({ bad: undefined }));
        assert.deepStrictEqual(error, failure({ bad: undefined }));
      })
    );

    it.effect("the synchronous twins agree with the Effect forms byte for byte", () =>
      Effect.gen(function* () {
        const value = { b: 2, a: [1, { y: 0, x: "€" }], c: null };
        assertSuccess(JsoncFingerprint.hashResult(value, nodeDigest), yield* JsoncFingerprint.hash(value));
        const options = JsoncTextHashOptions.make({ normalizeEol: true });
        const text = "line one\r\nline two\rline three";
        assertSuccess(JsoncFingerprint.hashTextResult(text, nodeDigest), yield* JsoncFingerprint.hashText(text));
        assertSuccess(JsoncFingerprint.hashTextResult(text, nodeDigest, options), yield* JsoncFingerprint.hashText(text, options));
        assert.notStrictEqual(
          Result.getOrThrow(JsoncFingerprint.hashTextResult(text, nodeDigest)),
          Result.getOrThrow(JsoncFingerprint.hashTextResult(text, nodeDigest, options))
        );
      })
    );
  });

  describe("hashResult / hashTextResult (synchronous, caller-supplied digest)", () => {
    it("matches the known-answer SHA-256 vectors", () => {
      assertSuccess(JsoncFingerprint.hashTextResult("", nodeDigest), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
      assertSuccess(JsoncFingerprint.hashTextResult("abc", nodeDigest), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    });

    it("propagates canonicalization failures unchanged", () => {
      assertFailure(JsoncFingerprint.hashResult({ a: { b: undefined } }, nodeDigest), failure({ a: { b: undefined } }));
    });

    it("fails typed with InvalidDigest when the digest is not 32 bytes wide", () => {
      const sha1: JsoncDigest = (bytes) => createHash("sha1").update(bytes).digest();
      for (const result of [JsoncFingerprint.hashResult({ a: 1 }, sha1), JsoncFingerprint.hashTextResult("abc", sha1)]) {
        const error = failureOfResult(result);
        assert.strictEqual(error.code, "InvalidDigest");
        assert.strictEqual(error.path, "");
        assert.include(error.detail, "20 bytes");
      }
    });

    it("fails typed with InvalidDigest when the digest throws an Error or a plain value", () => {
      const unknownAlgorithm: JsoncDigest = (bytes) => createHash("sha256x").update(bytes).digest();
      assert.throws(() => createHash("sha256x"));
      const plain: JsoncDigest = () => {
        throw "boom";
      };
      for (const result of [
        JsoncFingerprint.hashResult({ a: 1 }, unknownAlgorithm),
        JsoncFingerprint.hashTextResult("abc", unknownAlgorithm),
        JsoncFingerprint.hashTextResult("abc", plain),
      ]) {
        const error = failureOfResult(result);
        assert.strictEqual(error.code, "InvalidDigest");
        assert.include(error.detail, "threw");
      }
      assert.include(failureOfResult(JsoncFingerprint.hashTextResult("abc", plain)).detail, "boom");
    });

    it("hashes the UTF-8 bytes of the canonical text and nothing else", () => {
      const value = { é: "€" };
      const canonical = Result.getOrThrow(JsoncFingerprint.canonicalizeResult(value));
      const expected = createHash("sha256").update(new TextEncoder().encode(canonical)).digest("hex");
      assertSuccess(JsoncFingerprint.hashResult(value, nodeDigest), expected);
      assert.match(expected, SHA256_HEX);
    });
  });
});
