import { hmacSha256Hex, pemToPkcs8, pkcs1ToPkcs8, signAppJwt } from "@beep/alchemy-github-runners/WebCrypto";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Result from "effect/Result";
import * as Str from "effect/String";

const pem = ({ label, der }: { readonly label: string; readonly der: Uint8Array }) =>
  `-----BEGIN ${label}-----\n${Base64.encode(der)}\n-----END ${label}-----\n`;

const generateKey = Effect.gen(function* () {
  const pair = yield* Effect.promise(() =>
    crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"]
    )
  );
  const exported = yield* Effect.promise(() => crypto.subtle.exportKey("pkcs8", pair.privateKey));
  return { pair, pkcs8: new Uint8Array(exported) };
});

// PKCS#8 for RSA is SEQUENCE { version, algorithm, OCTET STRING { PKCS#1 } }:
// the PKCS#1 key is the content of the last top-level element.
const pkcs1Of = (pkcs8: Uint8Array): Uint8Array => {
  const octet = pkcs8.indexOf(0x04, 20);
  const lengthByte = pkcs8[octet + 1] ?? 0;
  const lengthBytes = (lengthByte & 0x80) !== 0 ? lengthByte & 0x7f : 0;
  return pkcs8.slice(octet + 2 + lengthBytes);
};

describe("hmacSha256Hex", () => {
  it.effect("matches the RFC 4231 test case 2 vector", () =>
    Effect.gen(function* () {
      const mac = yield* hmacSha256Hex("Jefe", "what do ya want for nothing?");
      expect(mac).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
    })
  );
});

describe("App JWT", () => {
  it.effect("wraps a PKCS#1 key into the exact PKCS#8 WebCrypto exported", () =>
    Effect.gen(function* () {
      const { pkcs8 } = yield* generateKey;
      expect(pkcs1ToPkcs8(pkcs1Of(pkcs8))).toStrictEqual(pkcs8);
      const decoded = pemToPkcs8(pem({ label: "RSA PRIVATE KEY", der: pkcs1Of(pkcs8) }));
      expect(Result.getOrThrow(decoded)).toStrictEqual(pkcs8);
    })
  );

  it.effect("signs an RS256 JWT with the App id as issuer that the public key verifies", () =>
    Effect.gen(function* () {
      const { pair, pkcs8 } = yield* generateKey;
      const jwt = yield* signAppJwt({
        appId: "123456",
        privateKeyPem: pem({ label: "RSA PRIVATE KEY", der: pkcs1Of(pkcs8) }),
        nowSeconds: 1_000_000,
      });
      const [header = "", claims = "", signature = ""] = Str.split(jwt, ".");
      expect(Result.getOrThrow(Base64Url.decodeString(claims))).toBe('{"iat":999940,"exp":1000540,"iss":"123456"}');
      expect(Result.getOrThrow(Base64Url.decodeString(header))).toBe('{"alg":"RS256","typ":"JWT"}');
      const verified = yield* Effect.promise(() =>
        crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          pair.publicKey,
          Uint8Array.from(Result.getOrThrow(Base64Url.decode(signature))),
          new TextEncoder().encode(`${header}.${claims}`)
        )
      );
      expect(verified).toBe(true);
    })
  );

  it.effect("fails with GitHubAppAuthError on a key that is not RSA", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        signAppJwt({
          appId: "1",
          privateKeyPem: pem({ label: "PRIVATE KEY", der: new Uint8Array([1, 2, 3]) }),
          nowSeconds: 0,
        })
      );
      expect(error._tag).toBe("GitHubAppAuthError");
    })
  );
});
