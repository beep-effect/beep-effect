/**
 * SHA-256 digests of the bytes a pack loader reads, per digest unit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as Str from "effect/String";

const codePoints = (text: string): ReadonlyArray<number> => A.getSomes(A.map(A.fromIterable(text), Str.codePointAt(0)));

const byCodePoint: Order.Order<string> = Order.mapInput(A.makeOrder(Order.Number), codePoints);

/**
 * The lowercase hex SHA-256 of a byte array.
 *
 * @category utilities
 * @since 0.0.0
 */
export const sha256Hex = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const digest = yield* Digest.Digest;
  return yield* digest.digestHex(Digest.sha256, bytes);
});

/**
 * The SHA-256 of the UTF-8 lines `<path>\t<sha256>\n`, one per
 * `[path, sha256]` entry of a `tree` unit, sorted by path in code point order.
 *
 * @category utilities
 * @since 0.0.0
 */
export const treeDigest = (entries: ReadonlyArray<readonly [path: string, sha256: string]>) =>
  pipe(
    A.sort(
      entries,
      Order.mapInput(byCodePoint, ([path]: readonly [string, string]) => path)
    ),
    A.map(([path, sha256]) => `${path}\t${sha256}\n`),
    A.join(""),
    (lines) => sha256Hex(new TextEncoder().encode(lines))
  );
