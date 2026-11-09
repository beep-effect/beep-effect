/**
 * Node identity schemas for the agent memory store: the store-minted `NodeId`,
 * the content and revision hashes, the node kind vocabulary and the canonical
 * revision preimage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { LiteralKit, PosixPath, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $AgentMemoryStoreId.create("NodeIdentity.models");

/**
 * Store-minted opaque node identifier: a UUID string assigned once, at
 * admission, and never derived from content.
 *
 * **Details**
 *
 * Content can change under a stable `NodeId`; the content and revision hashes
 * track those changes. Construct trusted values with `NodeId.make` and decode
 * untrusted input with `S.decodeUnknownEffect(NodeId)`.
 *
 * **Example** (Mint a node identifier)
 *
 * ```ts
 * import { NodeId } from "@beep/agent-memory-store"
 *
 * const nodeId = NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f")
 * console.log(nodeId)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NodeId = S.String.check(S.isUUID()).pipe(
  S.brand("NodeId"),
  $I.annoteSchema("NodeId", {
    description: "Store-minted opaque UUID identifier for a memory node, assigned at admission.",
  })
);

/**
 * Runtime type for {@link NodeId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NodeId = typeof NodeId.Type;

/**
 * SHA-256 hex digest of a node's normalized text.
 *
 * **Details**
 *
 * Two nodes with the same `ContentHash` hold the same normalized text; exact
 * duplicates defer to the existing node (decision `dedupe-exact-defer-near-flag`).
 *
 * **Example** (Brand a content hash)
 *
 * ```ts
 * import { ContentHash } from "@beep/agent-memory-store"
 *
 * const hash = ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * console.log(hash.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContentHash = Sha256Hex.pipe(
  S.brand("ContentHash"),
  $I.annoteSchema("ContentHash", {
    description: "SHA-256 hex digest of a memory node's normalized text.",
  })
);

/**
 * Runtime type for {@link ContentHash}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContentHash = typeof ContentHash.Type;

/**
 * Fixed content hash every tombstone revision is identified with.
 *
 * **Details**
 *
 * A retirement has no text, so its revision id is
 * `hash(NodeId, parents, TombstoneContentHash)`. The value is the SHA-256 of
 * the sentinel `agent-memory-store:tombstone`, which keeps a tombstone apart
 * from a revision to empty text and from any revision of the same parents
 * that keeps the live content.
 *
 * **Example** (Read the tombstone hash)
 *
 * ```ts
 * import { TombstoneContentHash } from "@beep/agent-memory-store"
 *
 * console.log(TombstoneContentHash)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TombstoneContentHash: ContentHash = ContentHash.make(
  "b3274febe66abf81104187b31229b7623530214c3ec613ed920d0f8bcc7009ff"
);

/**
 * SHA-256 hex digest identifying one revision of a node.
 *
 * **Details**
 *
 * A revision id is `hash(NodeId, parents sorted ascending, ContentHash)`: the
 * SHA-256 of {@link revisionPreimage}. Equal inputs always produce the same
 * revision id, so concurrent writers that reach the same content from the same
 * parents converge on one revision.
 *
 * **Example** (Brand a revision id)
 *
 * ```ts
 * import { RevisionId } from "@beep/agent-memory-store"
 *
 * const revision = RevisionId.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * console.log(revision)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RevisionId = Sha256Hex.pipe(
  S.brand("RevisionId"),
  $I.annoteSchema("RevisionId", {
    description: "SHA-256 hex digest of hash(NodeId, sorted parent revisions, ContentHash).",
  })
);

/**
 * Runtime type for {@link RevisionId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RevisionId = typeof RevisionId.Type;

/**
 * Encoded companion types for {@link RevisionId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RevisionId {
  /**
   * Wire form of a revision id: a lowercase 64-character hex string.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RevisionId.Encoded;
}

/**
 * POSIX path of a memory file, relative to the imported memory folder.
 *
 * **Example** (Brand a memory file path)
 *
 * ```ts
 * import { MemoryFilePath } from "@beep/agent-memory-store"
 *
 * const path = MemoryFilePath.make("notes/decisions.md")
 * console.log(path)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryFilePath = PosixPath.check(S.isNonEmpty()).pipe(
  $I.annoteSchema("MemoryFilePath", {
    description: "Non-empty POSIX path of a memory file relative to the imported memory folder.",
  })
);

/**
 * Runtime type for {@link MemoryFilePath}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MemoryFilePath = typeof MemoryFilePath.Type;

/**
 * Markdown construct a memory node is cut from.
 *
 * **Details**
 *
 * Decision `granularity-row-and-list-item`: list items and table rows are
 * nodes, a fenced code block is one node, and headings and paragraphs are
 * single nodes.
 *
 * **Example** (Check a node kind)
 *
 * ```ts
 * import { NodeKind } from "@beep/agent-memory-store"
 *
 * console.log(NodeKind.is.listItem("listItem"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NodeKind = LiteralKit([
  "heading",
  "paragraph",
  "listItem",
  "tableRow",
  "codeFence",
  "frontmatter",
  "thematicBreak",
  "html",
]).pipe(
  $I.annoteSchema("NodeKind", {
    description: "Markdown construct a memory node is cut from.",
  })
);

/**
 * Runtime type for {@link NodeKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NodeKind = typeof NodeKind.Type;

/**
 * Canonical preimage record hashed into a {@link RevisionId}.
 *
 * **Details**
 *
 * Field order is fixed (`nodeId`, `parents`, `contentHash`) and `parents` is
 * sorted ascending, so the JSON form is canonical.
 *
 * **Example** (Construct a revision preimage)
 *
 * ```ts
 * import { ContentHash, NodeId, RevisionPreimage } from "@beep/agent-memory-store"
 *
 * const preimage = RevisionPreimage.make({
 *   nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   parents: [],
 *   contentHash: ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 * })
 * console.log(preimage.parents.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RevisionPreimage extends S.Opaque<RevisionPreimage, { readonly brand: unique symbol }>()(
  S.Struct({
    nodeId: NodeId.annotateKey({ description: "Node whose revision is being identified." }),
    parents: S.Array(RevisionId).annotateKey({ description: "Parent revisions, sorted ascending." }),
    contentHash: ContentHash.annotateKey({ description: "Hash of the revision's normalized text." }),
  }).pipe(
    $I.annoteSchema("RevisionPreimage", {
      description: "Canonical preimage record hashed into a RevisionId.",
    })
  )
) {}

const encodeRevisionPreimage = S.encodeResult(S.fromJsonString(RevisionPreimage));

/**
 * Builds the canonical JSON preimage of a revision id.
 *
 * **Details**
 *
 * Parents are sorted ascending before encoding, so the result does not depend
 * on the order the caller supplies them in. P1 hashes the returned string with
 * `effect/crypto/Digest` SHA-256 to obtain the {@link RevisionId}.
 *
 * **Gotchas**
 *
 * The inputs are already-validated branded values, so encoding cannot fail; a
 * failure would be a defect and is thrown as the underlying schema error.
 *
 * **Example** (Build a parent-order independent preimage)
 *
 * ```ts
 * import { ContentHash, NodeId, revisionPreimage } from "@beep/agent-memory-store"
 *
 * const preimage = revisionPreimage(
 *   NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   [],
 *   ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * )
 * console.log(preimage)
 * ```
 *
 * @param nodeId - The node the revision belongs to.
 * @param parents - The parent revisions, in any order.
 * @param contentHash - The hash of the revision's normalized text.
 * @returns The canonical JSON preimage string.
 * @category utilities
 * @since 0.0.0
 */
export const revisionPreimage: {
  (parents: ReadonlyArray<RevisionId>, contentHash: ContentHash): (nodeId: NodeId) => string;
  (nodeId: NodeId, parents: ReadonlyArray<RevisionId>, contentHash: ContentHash): string;
} = dual(3, (nodeId: NodeId, parents: ReadonlyArray<RevisionId>, contentHash: ContentHash): string =>
  Result.getOrThrow(
    encodeRevisionPreimage(
      RevisionPreimage.make({
        nodeId,
        parents: A.sort(parents, Order.String),
        contentHash,
      })
    )
  )
);
