/**
 * Schema for native `ArrayBuffer` values.
 *
 * Use this module when a boundary carries raw binary buffers (file contents,
 * crypto material, transferable payloads) and the model should keep the native
 * `ArrayBuffer` while remaining JSON-serializable.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Effect, Encoding, Result, SchemaIssue, SchemaTransformation } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";

const $I = $SchemaId.create("ArrayBuffer");

const NotDetached = S.makeFilter<globalThis.ArrayBuffer>((buffer) => buffer.detached !== true, {
  identifier: $I`NotDetachedCheck`,
  title: "Attached ArrayBuffer",
  description:
    "A detached ArrayBuffer has transferred its memory elsewhere: byteLength reads 0 and constructing any view over it throws.",
  expected: "an ArrayBuffer that has not been detached",
  message: "Expected an ArrayBuffer that has not been detached by transfer",
});

const Base64String = S.String.annotate({
  expected: "a base64 encoded string that will be decoded as an ArrayBuffer",
  format: "byte",
  contentEncoding: "base64",
});

const arrayBufferFromBase64String = SchemaTransformation.transformOrFail<globalThis.ArrayBuffer, string>({
  decode: (encoded, options) =>
    Result.match(Encoding.decodeBase64(encoded), {
      onFailure: (error) => Effect.fail(new SchemaIssue.InvalidValue({ message: error.message }, encoded, options)),
      onSuccess: (bytes) => Effect.succeed(bytes.slice().buffer),
    }),
  encode: (buffer) => Effect.succeed(Encoding.encodeBase64(new globalThis.Uint8Array(buffer))),
});

const byteEquivalence = (self: globalThis.ArrayBuffer, that: globalThis.ArrayBuffer): boolean =>
  self === that ||
  (self.detached !== true &&
    that.detached !== true &&
    Eq.equals(new globalThis.Uint8Array(self), new globalThis.Uint8Array(that)));

/**
 * Schema that validates native `ArrayBuffer` instances.
 *
 * **Details**
 *
 * Beyond the `instanceof` check, decoding rejects detached buffers: a buffer
 * that has transferred its memory away (via `transfer()` or a transferable
 * `postMessage`) still passes `instanceof` but reads `byteLength` 0 and throws
 * when any view is constructed over it. Derived equivalence compares content
 * bytes rather than references, and the derived JSON codec represents the
 * buffer as a base64 encoded string.
 *
 * **Gotchas**
 *
 * `SharedArrayBuffer` is not accepted; it fails the `instanceof` check by
 * design. Wrap shared memory in a dedicated schema if a boundary needs it.
 *
 * **Example** (Decode a live ArrayBuffer)
 *
 * ```ts import.meta.vitest name="Decode a live ArrayBuffer"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { ArrayBuf } from "@beep/schema/ArrayBuffer"
 *
 * const value = await Effect.runPromise(S.decodeEffect(ArrayBuf)(new ArrayBuffer(8)))
 * value.byteLength // => 8
 * ```
 *
 * **Example** (Round-trip JSON as base64)
 *
 * ```ts import.meta.vitest name="Round-trip JSON as base64"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { ArrayBuf } from "@beep/schema/ArrayBuffer"
 *
 * const codec = S.toCodecJson(ArrayBuf)
 * const encoded = await Effect.runPromise(S.encodeEffect(codec)(new Uint8Array([104, 105]).buffer))
 * encoded // => "aGk="
 * ```
 *
 * @invariant Values are ArrayBuffer instances that have not been detached.
 * @category validation
 * @since 0.0.0
 */
export const ArrayBuf = S.instanceOf(globalThis.ArrayBuffer, {
  expected: "ArrayBuffer",
  toArbitrary: () => (fc) => fc.uint8Array().map((bytes) => bytes.slice().buffer),
  toCodecJson: () => S.link<globalThis.ArrayBuffer>()(Base64String, arrayBufferFromBase64String),
})
  .check(NotDetached)
  // toEquivalence must be annotated after the check: equivalence derivation
  // resolves annotations from the last check, so a declaration-level
  // annotation is shadowed once checks are attached.
  .annotate({ toEquivalence: () => byteEquivalence })
  .pipe(
    $I.annoteSchema("ArrayBuf", {
      description: "A native ArrayBuffer that has not been detached, represented in JSON as a base64 encoded string.",
    })
  );

/**
 * Type-level value inferred from {@link ArrayBuf}.
 *
 * This is the native `ArrayBuffer` type; the schema adds no branding, so the
 * alias exists to keep the schema/type same-name convention.
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayBuf = typeof ArrayBuf.Type;

/**
 * Schema-backed guard for {@link ArrayBuf}.
 *
 * **Details**
 *
 * The guard applies the full schema semantics, so detached buffers and
 * `SharedArrayBuffer` values are rejected along with non-buffer input.
 *
 * **Example** (Narrow unknown binary input)
 *
 * ```ts import.meta.vitest name="Narrow unknown binary input"
 * import { isArrayBuf } from "@beep/schema/ArrayBuffer"
 *
 * isArrayBuf(new ArrayBuffer(4)) // => true
 * isArrayBuf(new Uint8Array(4)) // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isArrayBuf = S.is(ArrayBuf);
