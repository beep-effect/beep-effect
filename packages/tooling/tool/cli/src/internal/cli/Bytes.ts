/**
 * Shared binary buffer helpers for repo-cli hashing and file adapters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";

/**
 * Re-view arbitrary bytes as a buffer backed by a plain `ArrayBuffer`.
 *
 * **When to use**
 *
 * Use when handing bytes to an API typed against `Uint8Array<ArrayBuffer>` —
 * `Crypto.digest` and `FileSystem.writeFile` both reject the `SharedArrayBuffer`
 * possibility that a bare `Uint8Array` carries in its type.
 *
 * **Gotchas**
 *
 * The bytes are copied, so mutating the result never writes through to the
 * input buffer.
 *
 * **Example** (Prepare bytes for a digest call)
 *
 * ```ts
 * import { asArrayBufferView } from "@beep/repo-cli/internal/cli/Bytes"
 *
 * const view = asArrayBufferView(new Uint8Array([1, 2, 3]))
 *
 * console.log(view.byteLength) // 3
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const asArrayBufferView = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => Uint8Array.from(bytes);

/**
 * Join byte chunks into one contiguous buffer in iteration order.
 *
 * **When to use**
 *
 * Use to assemble the framed byte stream a content digest is taken over, where
 * chunk order is part of the hashed contract.
 *
 * **Example** (Frame two chunks into one buffer)
 *
 * ```ts
 * import { concatBytes } from "@beep/repo-cli/internal/cli/Bytes"
 *
 * const joined = concatBytes([new Uint8Array([1, 2]), new Uint8Array([3])])
 *
 * console.log(joined.byteLength) // 3
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const concatBytes = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const output = new Uint8Array(A.reduce(chunks, 0, (size, chunk) => size + chunk.byteLength));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
};
