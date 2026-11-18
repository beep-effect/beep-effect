/**
 * WebCrypto primitives for the webhook signature.
 *
 * **Details**
 *
 * Effect ships no HMAC module, so these use the platform's
 * `crypto.subtle` (present in the Lambda Node runtime and in Bun), never
 * `node:crypto`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import { dual } from "effect/Function";

const textEncoder = new TextEncoder();

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
