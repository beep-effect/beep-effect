/**
 * WebCrypto primitives for the webhook signature and the GitHub App JWT.
 *
 * Effect ships no HMAC or RSA signing module, so these use the platform's
 * `crypto.subtle` (present in the Lambda Node runtime and in Bun), never
 * `node:crypto`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Hex from "effect/encoding/Hex";
import { dual } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitHubAppAuthError } from "./RunnerFleet.errors.ts";

const textEncoder = new TextEncoder();

const encodeJwtHeader = S.encodeEffect(S.fromJsonString(S.Struct({ alg: S.String, typ: S.String })));
const encodeJwtClaims = S.encodeEffect(S.fromJsonString(S.Struct({ iat: S.Int, exp: S.Int, iss: S.String })));

/**
 * Lower-case hex HMAC-SHA256 of `body` under `secret`.
 *
 * **Example** (RFC 4231 test case 2)
 *
 * ```ts
 * import { hmacSha256Hex } from "@beep/alchemy-github-runners/WebCrypto"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runPromise(hmacSha256Hex("Jefe", "what do ya want for nothing?")))
 * ```
 *
 * @param secret - The HMAC key.
 * @param body - The signed bytes, as text.
 * @returns The hex digest.
 * @category utilities
 * @since 0.0.0
 */
export const hmacSha256Hex = Effect.fn("WebCrypto.hmacSha256Hex")(function* (secret: string, body: string) {
  const key = yield* Effect.promise(() =>
    crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  );
  const signature = yield* Effect.promise(() => crypto.subtle.sign("HMAC", key, textEncoder.encode(body)));
  return Hex.encode(new Uint8Array(signature));
});

/**
 * Compares two strings in time independent of where they first differ.
 *
 * **Example** (Compare signatures)
 *
 * ```ts
 * import { constantTimeEqual } from "@beep/alchemy-github-runners/WebCrypto"
 *
 * console.log(constantTimeEqual("sha256=ab", "sha256=ab")) // true
 * ```
 *
 * @param left - One string.
 * @param right - The other string.
 * @returns Whether they are equal.
 * @category utilities
 * @since 0.0.0
 */
export const constantTimeEqual: {
  (right: string): (left: string) => boolean;
  (left: string, right: string): boolean;
} = dual(2, (left: string, right: string): boolean => {
  const a = textEncoder.encode(left);
  const b = textEncoder.encode(right);
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
});

const derLength = (length: number): ReadonlyArray<number> =>
  length < 0x80
    ? [length]
    : length < 0x100
      ? [0x81, length]
      : length < 0x10000
        ? [0x82, length >> 8, length & 0xff]
        : [0x83, length >> 16, (length >> 8) & 0xff, length & 0xff];

const rsaAlgorithmIdentifier = [
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
];

/**
 * Wraps a PKCS#1 `RSAPrivateKey` DER in a PKCS#8 `PrivateKeyInfo`, the only private-key format WebCrypto imports; GitHub issues App keys as PKCS#1.
 *
 * **Example** (Wrap a DER key)
 *
 * ```ts
 * import { pkcs1ToPkcs8 } from "@beep/alchemy-github-runners/WebCrypto"
 *
 * console.log(pkcs1ToPkcs8(new Uint8Array([0x30, 0x00]))[0]) // 48
 * ```
 *
 * @param pkcs1 - The PKCS#1 DER bytes.
 * @returns The PKCS#8 DER bytes.
 * @category utilities
 * @since 0.0.0
 */
export const pkcs1ToPkcs8 = (pkcs1: Uint8Array): Uint8Array<ArrayBuffer> => {
  const octetString = [0x04, ...derLength(pkcs1.length), ...pkcs1];
  const body = [0x02, 0x01, 0x00, ...rsaAlgorithmIdentifier, ...octetString];
  return Uint8Array.from([0x30, ...derLength(body.length), ...body]);
};

const pemBody = (pem: string): string =>
  A.join(
    A.filter(Str.split(Str.trim(pem), /\r?\n/u), (line) => !Str.startsWith("-----")(Str.trim(line))),
    ""
  );

/**
 * Decodes a PEM private key (PKCS#1 or PKCS#8) into PKCS#8 DER.
 *
 * **Example** (Reject garbage)
 *
 * ```ts
 * import { pemToPkcs8 } from "@beep/alchemy-github-runners/WebCrypto"
 * import * as Result from "effect/Result"
 *
 * console.log(Result.isFailure(pemToPkcs8("not a key!"))) // true
 * ```
 *
 * @param pem - The PEM text.
 * @returns The PKCS#8 DER, or `GitHubAppAuthError`.
 * @category utilities
 * @since 0.0.0
 */
export const pemToPkcs8 = (pem: string): Result.Result<Uint8Array<ArrayBuffer>, GitHubAppAuthError> =>
  Result.mapError(Base64.decode(pemBody(pem)), () =>
    GitHubAppAuthError.make({ message: "App key is not valid PEM" })
  ).pipe(Result.map((der) => (Str.includes("BEGIN RSA PRIVATE KEY")(pem) ? pkcs1ToPkcs8(der) : Uint8Array.from(der))));

/**
 * Signs a GitHub App JWT: RS256, issued a minute in the past to absorb clock skew and valid nine minutes after that (GitHub allows ten).
 *
 * **Example** (Wire the signer)
 *
 * ```ts
 * import { signAppJwt } from "@beep/alchemy-github-runners/WebCrypto"
 *
 * console.log(typeof signAppJwt)
 * ```
 *
 * @param input - App id, PEM private key and the current time in seconds.
 * @returns The compact JWT.
 * @category utilities
 * @since 0.0.0
 */
export const signAppJwt = Effect.fn("WebCrypto.signAppJwt")(function* (input: {
  readonly appId: string;
  readonly privateKeyPem: string;
  readonly nowSeconds: number;
}) {
  const der = yield* Effect.fromResult(pemToPkcs8(input.privateKeyPem));
  const key = yield* Effect.tryPromise({
    try: () => crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]),
    catch: () => GitHubAppAuthError.make({ message: "App key is not an RSA private key" }),
  });
  const header = yield* encodeJwtHeader({ alg: "RS256", typ: "JWT" }).pipe(Effect.map(Base64Url.encode));
  const payload = yield* encodeJwtClaims({
    iat: input.nowSeconds - 60,
    exp: input.nowSeconds + 540,
    iss: input.appId,
  }).pipe(Effect.map(Base64Url.encode));
  const signingInput = `${header}.${payload}`;
  const signature = yield* Effect.promise(() =>
    crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, textEncoder.encode(signingInput))
  );
  return `${signingInput}.${Base64Url.encode(new Uint8Array(signature))}`;
});
