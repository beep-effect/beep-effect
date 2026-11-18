/**
 * Test keys: an RSA keypair generated per run and formatted as PEM. The PEM
 * marker is assembled from parts so no key-shaped literal sits in source.
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";

const pemMarker = (edge: "BEGIN" | "END", label: string) => `-----${edge} ${label}-----`;

/** Formats DER bytes as a PEM block with the given label. */
const toPem = ({ label, der }: { readonly label: string; readonly der: Uint8Array }): string =>
  A.join([pemMarker("BEGIN", label), Base64.encode(der), pemMarker("END", label), ""], "\n");

/** The PKCS #8 private-key label, assembled at runtime. */
const pkcs8Label = A.join(["PRIVATE", "KEY"], " ");

/** A fresh 2048-bit RSASSA-PKCS1-v1_5 private key as a PKCS #8 PEM; never persisted. */
export const generatePrivateKeyPem = Effect.gen(function* () {
  const pair = yield* Effect.promise(() =>
    crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"]
    )
  );
  const der = yield* Effect.promise(() => crypto.subtle.exportKey("pkcs8", pair.privateKey));
  return toPem({ label: pkcs8Label, der: new Uint8Array(der) });
});
