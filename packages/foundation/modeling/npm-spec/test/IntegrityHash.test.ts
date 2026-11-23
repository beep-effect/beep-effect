import * as NodeBuffer from "node:buffer";
import {
  CorepackIntegrityHash,
  IntegrityHash,
  InvalidIntegrityHashError,
  InvalidSriIntegrityHashError,
  SriIntegrityHash,
} from "@beep/npm-spec/IntegrityHash";
import { PackageManagerPin } from "@beep/npm-spec/PackageManagerPin";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const corepack0340OwnYarnPinSha224Tail = "sha224.877304e3c9e5b53431969ee2ca17ee44f366533b0da5a4ba9c2bd447";

describe("IntegrityHash schema", () => {
  const sri = "sha512-tsPuRLBpQ2xk6+8HB4vP0Wq1v0EYlv6q6qz1oqTgU5U+lgY7Zp3Xf5sT2xM2mQ==";
  const corepack = "sha512.5be7cee7ff4d9c25bda31e3b5f6f3f9f2a";
  const yarn = "10c0/99a4b0f0e7991796b1e7e3f52dceb9137cae2a9dfc8fc0784a550dc4c558e15a";

  it.effect("accepts all three textual forms", () =>
    Effect.gen(function* () {
      const value1 = yield* S.decodeEffect(IntegrityHash)(sri);
      assert.strictEqual(value1, sri);
      const value2 = yield* S.decodeEffect(IntegrityHash)(corepack);
      assert.strictEqual(value2, corepack);
      const value3 = yield* S.decodeEffect(IntegrityHash)(yarn);
      assert.strictEqual(value3, yarn);
      const value4 = yield* S.decodeEffect(IntegrityHash)("sha1-abcd");
      assert.strictEqual(value4, "sha1-abcd");
      const value5 = yield* S.decodeEffect(IntegrityHash)("sha256.deadbeef");
      assert.strictEqual(value5, "sha256.deadbeef");
      const value6 = yield* S.decodeEffect(IntegrityHash)("9c0/deadbeef");
      assert.strictEqual(value6, "9c0/deadbeef");
    })
  );

  it.effect("rejects malformed hashes", () =>
    Effect.gen(function* () {
      for (const bad of ["", "md5-abcd", "sha512-", "sha512.NOTHEX", "sha512.", "abc", "sha999.deadbeef"]) {
        const error = yield* Effect.flip(S.decodeEffect(IntegrityHash)(bad));
        assert.strictEqual(error._tag, "SchemaError", bad);
      }
    })
  );
});

describe("IntegrityHash statics", () => {
  it("classifies SRI vs corepack vs yarn", () => {
    assert.isTrue(IntegrityHash.isSri("sha512-abc/def+=="));
    assert.isTrue(IntegrityHash.isSri("sha512-YWJj"));
    assert.isFalse(IntegrityHash.isCorepack("sha512-YWJj"));
    assert.isTrue(IntegrityHash.isCorepack("sha512.abc"));
    assert.isFalse(IntegrityHash.isSri("sha512.abc"));
    assert.isTrue(
      IntegrityHash.isCorepack(corepack0340OwnYarnPinSha224Tail),
      "sha224 is corepack-only: corepack's transparent default yarn pin emits it"
    );
    assert.isFalse(IntegrityHash.isSri("sha224-YWJj"), "the SRI spec does not include sha224");
    assert.isTrue(IntegrityHash.isYarnChecksum("10c0/deadbeef"));
    assert.isTrue(IntegrityHash.isYarnChecksum("9c0/abc123"));
    assert.isFalse(IntegrityHash.isYarnChecksum("sha512-YWJj"));
    assert.isFalse(IntegrityHash.isSri("10c0/deadbeef"));
    assert.isFalse(IntegrityHash.isCorepack("10c0/deadbeef"));
    assert.isTrue(IntegrityHash.isValid("10c0/deadbeef"));
    assert.isFalse(IntegrityHash.isValid("nope"));
  });

  it("extracts the algorithm from the SRI and corepack forms, none from yarn", () => {
    assertSome(IntegrityHash.algorithmOf("sha512-YWJj"), "sha512");
    assertSome(IntegrityHash.algorithmOf("sha1.abcd"), "sha1");
    assertSome(IntegrityHash.algorithmOf("sha256.deadbeef"), "sha256");
    assertNone(IntegrityHash.algorithmOf("10c0/deadbeef"));
    assertNone(IntegrityHash.algorithmOf("not-a-hash"));
  });

  it.effect("decode returns the branded value and fails typed on garbage", () =>
    Effect.gen(function* () {
      const decoded7 = yield* IntegrityHash.decode("sha512.abc");
      assert.strictEqual(decoded7, "sha512.abc");
      const error = yield* Effect.flip(IntegrityHash.decode("garbage"));
      assert.instanceOf(error, InvalidIntegrityHashError);
      assert.strictEqual(error._tag, "InvalidIntegrityHashError");
      assert.strictEqual(error.input, "garbage");
    })
  );
});

describe("CorepackIntegrityHash, the pin-tail schema both pin fields consume: an SRI or yarn hash there is never a near-miss", () => {
  const decode = S.decodeUnknownEffect(CorepackIntegrityHash);

  it.effect("accepts every corepack form, including corepack's own sha224 default pins", () =>
    Effect.gen(function* () {
      for (const good of [
        "sha512.deadbeef01",
        "sha256.0badf00d",
        "sha1.ac34549e6aa8e7ead463a7407e1c7390f61a6610",
        corepack0340OwnYarnPinSha224Tail,
      ]) {
        const decoded8 = yield* decode(good);
        assert.strictEqual(decoded8, good, good);
      }
    })
  );

  it.effect("rejects the two other forms the IntegrityHash brand accepts", () =>
    Effect.gen(function* () {
      for (const wrongForm of ["sha512-tsPuRLBpQ2xk6+8HB4vP0Wq1v0EYlv6q6qz1oqTgU5U=", "10c0/deadbeef0123"]) {
        const value9 = yield* S.decodeEffect(IntegrityHash)(wrongForm);
        assert.strictEqual(
          value9,
          wrongForm,
          `control: the unrestricted brand accepts ${wrongForm}, so the rejection below is the restriction firing, not a malformed fixture`
        );
        const error = yield* Effect.flip(decode(wrongForm));
        assert.strictEqual(error._tag, "SchemaError", wrongForm);
      }
    })
  );

  it.effect(
    "rejects malformed corepack-shaped hashes: uppercase hex, an unknown algorithm, an empty digest, an empty string",
    () =>
      Effect.gen(function* () {
        for (const bad of ["sha512.DEADBEEF", "md5.deadbeef", "sha512.", "", "sha512"]) {
          const error = yield* Effect.flip(decode(bad));
          assert.strictEqual(error._tag, "SchemaError", bad);
        }
      })
  );

  it.effect("decodes to the same brand as the unrestricted schema — no second brand", () =>
    Effect.gen(function* () {
      const restricted = yield* decode("sha512.deadbeef01");
      const stopsCompilingIfASecondBrandAppears: typeof IntegrityHash.Type = restricted;
      const value10 = yield* S.decodeEffect(IntegrityHash)("sha512.deadbeef01");
      assert.strictEqual(stopsCompilingIfASecondBrandAppears, value10, "equal at the value level too");
    })
  );

  it("PackageManagerPin.integrity IS this schema, not a copy that agrees with it", () => {
    const schemaInsideOptionalKey = PackageManagerPin.fields.integrity.schema;
    assert.strictEqual(
      schemaInsideOptionalKey,
      CorepackIntegrityHash,
      "PackageManagerPin must consume the shared corepack schema, not re-derive the restriction"
    );
    assert.notStrictEqual<unknown>(
      schemaInsideOptionalKey,
      IntegrityHash,
      "control: a fallback to the unrestricted IntegrityHash fails this identity check, a mutant no type error catches (compared as unknown: the two schemas carry different statics, so this is runtime identity, not assignability)"
    );
  });
});

describe("SriIntegrityHash", () => {
  const decode = S.decodeUnknownEffect(SriIntegrityHash);

  it.effect("accepts every SRI algorithm, including base64 carrying + and /", () =>
    Effect.gen(function* () {
      for (const good of [
        "sha512-m35mtvgU4nbE8ZHd4EFqKu5jJeQY0gPUYHzKTno57JT/QeHzM9RRLNQsIcG0npsFYBxJfJ1tC/NH4zEWc2gdxQ==",
        "sha512-6GbxZtliXuGHKFzJGFkqqNAbZzErb42XvCLdnr29KVR3OwvwU+D1MxNPpfzKOkde/TlM/KLsciuNqqmCSS/Yag==",
        "sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC",
        "sha256-tsPuRLBpQ2xk6+8HB4vP0Wq1v0EYlv6q6qz1oqTgU5U=",
        "sha1-rAaRyuqI5+rUBqc0B+HHOQ9hZhA=",
      ]) {
        const decoded11 = yield* decode(good);
        assert.strictEqual(decoded11, good, good);
      }
    })
  );

  it.effect("rejects the two other forms the IntegrityHash brand accepts", () =>
    Effect.gen(function* () {
      for (const wrongForm of ["sha512.deadbeef01", "10c0/deadbeef0123"]) {
        const value12 = yield* S.decodeEffect(IntegrityHash)(wrongForm);
        assert.strictEqual(
          value12,
          wrongForm,
          `control: the unrestricted brand accepts ${wrongForm}, so the rejection below is the restriction firing, not a malformed fixture`
        );
        const error = yield* Effect.flip(decode(wrongForm));
        assert.strictEqual(error._tag, "SchemaError", wrongForm);
      }
    })
  );

  it.effect(
    "rejects malformed SRI-shaped hashes: sha224 (not an SRI algorithm), unknown md5, an empty digest, a space in the base64, an empty string",
    () =>
      Effect.gen(function* () {
        for (const bad of ["sha224-3q2+7w==", "md5-3q2+7w==", "sha512-", "sha512-not base64", ""]) {
          const error = yield* Effect.flip(decode(bad));
          assert.strictEqual(error._tag, "SchemaError", bad);
        }
      })
  );

  it.effect("decodes to the same brand as the unrestricted schema — no second brand", () =>
    Effect.gen(function* () {
      const input = "sha256-tsPuRLBpQ2xk6+8HB4vP0Wq1v0EYlv6q6qz1oqTgU5U=";
      const restricted = yield* decode(input);
      const wide: typeof IntegrityHash.Type = restricted;
      const value13 = yield* S.decodeEffect(IntegrityHash)(input);
      assert.strictEqual(wide, value13);
    })
  );

  it("is a distinct schema from both the unrestricted brand and the corepack narrowing", () => {
    assert.notStrictEqual<unknown>(SriIntegrityHash, IntegrityHash);
    assert.notStrictEqual<unknown>(SriIntegrityHash, CorepackIntegrityHash);
  });
});

describe('CorepackIntegrityHash.FromSri, the one sanctioned SRI to corepack conversion, on a real pair: both spellings of the sha512 digest of "hello"', () => {
  const sriBase64 = "m3HSJL1i83hdltRq0+o9czGb+8KJDKra4t/3JRlnPKcjI8PZm6XBHXx6zG4UuMXaDEZjR1wuXDre9G9zvN7AQw==";
  const sri = `sha512-${sriBase64}`;
  const corepack =
    "sha512.9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043";

  const decode = S.decodeUnknownEffect(CorepackIntegrityHash.FromSri);
  const encode = S.encodeUnknownEffect(CorepackIntegrityHash.FromSri);

  it.effect("converts a known SRI value to the corepack form", () =>
    Effect.gen(function* () {
      const converted = yield* decode(sri);
      assert.strictEqual(converted, corepack);
      assert.strictEqual(
        converted,
        `sha512.${NodeBuffer.Buffer.from(sriBase64, "base64").toString("hex")}`,
        "independent oracle: hex derived here from the base64 bytes, not copied from the fixture, so a transposed fixture cannot vouch for itself"
      );
      assert.isTrue(IntegrityHash.isCorepack(converted));
      const value14 = yield* S.decodeEffect(CorepackIntegrityHash)(converted);
      assert.strictEqual(value14, converted);
    })
  );

  it.effect("tolerates one layer of JSON quotes around the input and unwraps it", () =>
    Effect.gen(function* () {
      const decoded15 = yield* decode(`"${sri}"`);
      assert.strictEqual(decoded15, corepack);
      const error = yield* Effect.flip(decode(`"${sri}`));
      assert.strictEqual(
        error._tag,
        "SchemaError",
        "only one layer, and only a matched pair: a lone quote is malformed"
      );
    })
  );

  it.effect("accepts the unpadded canonical spelling", () =>
    Effect.gen(function* () {
      const decoded16 = yield* decode(`sha512-${Str.slice(0, -2)(sriBase64)}`);
      assert.strictEqual(decoded16, corepack);
    })
  );

  it.effect("rejects non-sha512 SRI hashes — corepack accepts nothing weaker", () =>
    Effect.gen(function* () {
      for (const bad of [`sha256-${sriBase64}`, `sha1-${sriBase64}`, `sha384-${sriBase64}`]) {
        const value17 = yield* S.decodeEffect(IntegrityHash)(bad);
        assert.strictEqual(
          value17,
          bad,
          `control: the wide brand accepts ${bad}, so the rejection below is the sha512 restriction firing, not a malformed fixture`
        );
        const error = yield* Effect.flip(decode(bad));
        assert.strictEqual(error._tag, "SchemaError", bad);
      }
      const error = yield* Effect.flip(decode("garbage"));
      assert.strictEqual(error._tag, "SchemaError");
    })
  );

  it.effect(
    "rejects an already-corepack-form input — the conversion is one-way from SRI, so a pin fed back in surfaces a wiring bug",
    () =>
      Effect.gen(function* () {
        const value18 = yield* S.decodeEffect(CorepackIntegrityHash)(corepack);
        assert.strictEqual(
          value18,
          corepack,
          "control: the corepack schema accepts the value, so the rejection below is the one-way rule, not an invalid fixture"
        );
        const error = yield* Effect.flip(decode(corepack));
        assert.strictEqual(error._tag, "SchemaError");
      })
  );

  it.effect("rejects malformed and non-canonical base64", () =>
    Effect.gen(function* () {
      for (const [whyRejected, bad] of [
        [
          "a valid base64 payload that is not a 64-byte digest: the wide brand accepts it, and the bridge must not mint a pin corepack rejects at install",
          "sha512-YWJj",
        ],
        ["an empty digest", "sha512-"],
        ["a length no base64 output has (remainder 1)", `sha512-${Str.repeat(85)("A")}`],
        [
          "padding that does not match the body length: lenient decoders accept it, the canonical form ends `==`",
          `sha512-${Str.slice(0, -1)(sriBase64)}`,
        ],
        [
          "an interior `=`: it leaves non-`=` characters in the padding, which never matches the expected padding",
          `sha512-${Str.slice(0, -4)(sriBase64)}=${Str.slice(-4)(sriBase64)}`,
        ],
        ["a character outside the base64 alphabet", "sha512-ab!c"],
        [
          "non-zero trailing bits: `Qx==` decodes to the same byte as `Qw==` under a lenient decoder, a second spelling npm never emits",
          `sha512-${Str.slice(0, -3)(sriBase64)}x==`,
        ],
      ] as const) {
        const error = yield* Effect.flip(decode(bad));
        assert.strictEqual(error._tag, "SchemaError", whyRejected);
      }
    })
  );

  it.effect("fromSri is the Effect convenience: same conversion, typed error", () =>
    Effect.gen(function* () {
      const fromSri19 = yield* CorepackIntegrityHash.fromSri(sri);
      assert.strictEqual(fromSri19, corepack);
      const fromSri20 = yield* CorepackIntegrityHash.fromSri(`"${sri}"`);
      assert.strictEqual(fromSri20, corepack);
      const error = yield* Effect.flip(CorepackIntegrityHash.fromSri(`sha256-${sriBase64}`));
      assert.instanceOf(error, InvalidSriIntegrityHashError);
      assert.strictEqual(error._tag, "InvalidSriIntegrityHashError");
      assert.strictEqual(error.input, `sha256-${sriBase64}`);
    })
  );

  it.effect("encodes back to the canonical padded SRI spelling", () =>
    Effect.gen(function* () {
      const encoded = yield* encode(corepack);
      assert.strictEqual(encoded, sri);
      const decoded24 = yield* decode(`"${sri}"`);
      const encoded21 = yield* encode(decoded24);
      assert.strictEqual(
        encoded21,
        sri,
        "a value decoded from the quoted spelling re-encodes unquoted: quote tolerance is decode-side lenience, not a remembered wire form"
      );
    })
  );

  it.effect("encode fails typed for corepack hashes SRI cannot carry", () =>
    Effect.gen(function* () {
      for (const bad of [corepack0340OwnYarnPinSha224Tail, "sha512.deadbeef"]) {
        const value22 = yield* S.decodeEffect(CorepackIntegrityHash)(bad);
        assert.strictEqual(
          value22,
          bad,
          `control: ${bad} is a valid CorepackIntegrityHash, yet not a 64-byte sha512 digest SRI can carry`
        );
        const error = yield* Effect.flip(encode(bad));
        assert.strictEqual(error._tag, "SchemaError", bad);
      }
    })
  );
});

describe("SriIntegrityHash validates shape, not the digest", () => {
  it.effect("accepts a digest CorepackIntegrityHash.fromSri then rejects", () =>
    Effect.gen(function* () {
      const value = "sha512-oldHash==";
      const decoded = S.decodeExit(SriIntegrityHash)(value);
      assert.isTrue(decoded._tag === "Success", "shape-valid SRI is accepted");
      const converted = yield* Effect.flip(CorepackIntegrityHash.fromSri(value));
      assert.strictEqual(converted._tag, "InvalidSriIntegrityHashError");
    })
  );
});

describe("IntegrityHash properties", () => {
  it.effect.prop("every SRI integrity hash is also accepted by the umbrella schema", [SriIntegrityHash], ([sri]) =>
    Effect.gen(function* () {
      const value23 = yield* S.decodeEffect(IntegrityHash)(sri);
      assert.strictEqual(value23, sri);
      IntegrityHash.algorithmOf(sri).pipe(O.isSome, assertTrue);
    })
  );
});
