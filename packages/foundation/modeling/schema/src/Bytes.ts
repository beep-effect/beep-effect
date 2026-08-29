/**
 * Branded schema for protobuf `bytes` values.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Bytes");

const bytesMaximumLength = 4_294_967_295;

const BytesLength = S.makeFilter<globalThis.Uint8Array<ArrayBufferLike>>(
  (value) => value.byteLength <= bytesMaximumLength,
  {
    identifier: $I`BytesLengthCheck`,
    title: "Protobuf bytes Length",
    description: "A protobuf bytes value is length-delimited by an unsigned 32-bit length.",
    expected: "a length-delimited protobuf bytes value",
    message: "Expected protobuf bytes with length less than or equal to 4294967295",
  }
);

/**
 * Branded schema for protobuf `bytes` values.
 *
 * **Details**
 *
 * Protobufjs reads `bytes` as `Uint8Array` and writes `bytes` from
 * `Uint8Array` or base64 strings. This schema models the decoded binary value
 * as a branded `Uint8Array`.
 *
 * **Example** (Decode Uint8Array bytes)
 *
 * ```ts import.meta.vitest name="Decode Uint8Array bytes"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Bytes } from "@beep/schema/Bytes"
 *
 * const value = await Effect.runPromise(S.decodeUnknownEffect(Bytes)(new Uint8Array([1, 2, 3])))
 * value.byteLength // => 3
 * ```
 *
 * @invariant Values are Uint8Array instances with protobuf length-delimited size.
 * @category validation
 * @since 0.0.0
 */
export const Bytes = S.Uint8Array.annotate({
  toArbitrary: () => (fc) => fc.uint8Array(),
})
  .check(BytesLength)
  .pipe(
    S.brand("Bytes"),
    $I.annoteSchema("Bytes", {
      description: "A protobuf bytes value represented as a branded Uint8Array.",
    })
  );

/**
 * Type-level value inferred from {@link Bytes}.
 *
 * **Example** (Narrow unknown to Bytes)
 *
 * ```ts import.meta.vitest name="Narrow unknown to Bytes"
 * import * as S from "effect/Schema"
 * import { Bytes } from "@beep/schema/Bytes"
 * import type { Bytes as BytesValue } from "@beep/schema/Bytes"
 *
 * const input: unknown = new Uint8Array([1, 2, 3])
 * if (S.is(Bytes)(input)) {
 *   const value: BytesValue = input
 *   value.byteLength // => 3
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Bytes = typeof Bytes.Type;
