/**
 * SHA-256 digests behind the node identity schemas: file digests, content
 * hashes and revision ids.
 *
 * **Details**
 *
 * Every digest runs through the `effect/crypto/Digest` service, so a caller
 * chooses the implementation (`Digest.layerWebCrypto` in the live projector).
 * A content hash is the SHA-256 of the node's exact UTF-8 text: P1 applies no
 * normalization, which is normalization version `"1"` of the import anchor
 * (decision `content-hash-is-the-exact-node-text-in-p1`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Sha256Hex } from "@beep/schema";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { ContentHash, RevisionId, revisionPreimage } from "./NodeIdentity.models.ts";
import type { NodeId } from "./NodeIdentity.models.ts";

const utf8 = new TextEncoder();

/**
 * Hashes bytes into a lowercase SHA-256 hex digest.
 *
 * **Example** (Hash the empty byte string)
 *
 * ```ts
 * import { sha256Hex } from "@beep/agent-memory-store"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const program = sha256Hex(new Uint8Array()).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(program)
 * ```
 *
 * @param bytes - The bytes to hash.
 * @returns The SHA-256 digest as lowercase hex.
 * @category utilities
 * @since 0.0.0
 */
export const sha256Hex = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const digest = yield* Digest.Digest;
  const hex = yield* digest.digestHex(Digest.sha256, bytes);
  return Sha256Hex.make(hex);
});

/**
 * Hashes a node's text into its {@link ContentHash}.
 *
 * **Details**
 *
 * The hash covers the exact UTF-8 bytes of the text; P1 normalizes nothing.
 *
 * **Example** (Hash a node text)
 *
 * ```ts
 * import { contentHashOf } from "@beep/agent-memory-store"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const program = contentHashOf("A fact.").pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(program)
 * ```
 *
 * @param text - The exact text of a memory node, hashed as UTF-8 bytes.
 * @returns The content hash of the text.
 * @category utilities
 * @since 0.0.0
 */
export const contentHashOf = Effect.fnUntraced(function* (text: string) {
  const hex = yield* sha256Hex(utf8.encode(text));
  return ContentHash.make(hex);
});

/**
 * Computes a {@link RevisionId}: the SHA-256 of the canonical
 * {@link revisionPreimage} of the node, its parents and its content hash.
 *
 * **Example** (Compute the root revision of a node)
 *
 * ```ts
 * import { ContentHash, NodeId, revisionIdOf } from "@beep/agent-memory-store"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const program = revisionIdOf(
 *   NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   [],
 *   ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * ).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(program)
 * ```
 *
 * @param nodeId - The node the revision belongs to.
 * @param parents - The parent revisions, in any order.
 * @param contentHash - SHA-256 of the revision's text.
 * @returns The SHA-256 of the canonical preimage.
 * @category utilities
 * @since 0.0.0
 */
export const revisionIdOf = Effect.fnUntraced(function* (
  nodeId: NodeId,
  parents: ReadonlyArray<RevisionId>,
  contentHash: ContentHash
) {
  const hex = yield* sha256Hex(utf8.encode(revisionPreimage(nodeId, parents, contentHash)));
  return RevisionId.make(hex);
});
