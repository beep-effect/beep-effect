import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { BlobEnvelope } from "../BlobEnvelope.ts";
import type * as S from "effect/Schema";
import type { BlobEnvelopeError } from "../BlobEnvelope.ts";
import type { BlobStoreError, BlobStoreShape, StoredBlob } from "../BlobStore.ts";

// The envelope half of every `BlobStore` backend. A backend moves raw bytes
// under a key — an S3 object, an Actions-cache entry — and this module frames
// them on the way in and reads them back on the way out, so the `get` and
// `put` members are spelled once and only the transport differs.

/**
 * The `get` member over a backend's raw read: `Option.none()` is a miss, a
 * fetched envelope decodes through `schema`.
 *
 * **Example** (A store that always misses)
 *
 * ```ts
 * import { framedGet } from "@beep/github-actions/internal/storedBlob";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 *
 * const get = framedGet(() => Effect.succeedNone);
 * console.log(O.isNone(Effect.runSync(get("key", S.String)))) // true
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const framedGet = (
  fetch: (key: string) => Effect.Effect<O.Option<Uint8Array>, BlobStoreError>
): BlobStoreShape["get"] =>
  dual(
    2,
    Effect.fn("BlobStore.get")(function* <A, I>(key: string, schema: S.Codec<A, I>) {
      const bytes = yield* fetch(key);
      if (O.isNone(bytes)) {
        return O.none<StoredBlob<A>>();
      }
      return O.some(yield* Effect.fromResult(BlobEnvelope.decodeResult(bytes.value, schema)));
    })
  );

/**
 * The `put` member over a backend's raw write: the blob is framed through
 * `schema` before any byte moves, so an unencodable value never reaches the
 * store.
 *
 * **Example** (A store that discards writes)
 *
 * ```ts
 * import { framedPut } from "@beep/github-actions/internal/storedBlob";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const put = framedPut(() => Effect.void);
 * Effect.runSync(put("key", { metadata: "m", body: new Uint8Array([1]) }, S.String));
 * console.log("written") // written
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const framedPut = (
  write: (key: string, framed: Uint8Array) => Effect.Effect<void, BlobStoreError>
): BlobStoreShape["put"] =>
  dual(
    3,
    Effect.fn("BlobStore.put")(function* <A, I>(
      key: string,
      blob: StoredBlob<A>,
      schema: S.Codec<A, I>
    ): Effect.fn.Return<void, BlobStoreError | BlobEnvelopeError> {
      yield* write(key, yield* Effect.fromResult(BlobEnvelope.encodeResult(blob.metadata, blob.body, schema)));
    })
  );
