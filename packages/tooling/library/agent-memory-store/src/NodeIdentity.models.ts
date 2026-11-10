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
 * Store-minted opaque node identifier: a UUID string assigned once and never
 * derived from content.
 *
 * **Details**
 *
 * The store's import and capture steps mint the id, and admission refuses one
 * the log already holds (decision `file-is-an-ordered-node-partition`).
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
    description: "Store-minted opaque UUID identifier for a memory node, never derived from content.",
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

// One or more `/`-separated segments, none empty and none starting with `.`,
// the last ending in `.md`.
const MEMORY_FILE_PATH_PATTERN = /^(?:[^/.][^/]*\/)*[^/.][^/]*\.md$/;

/**
 * POSIX path of a memory file, relative to the imported memory folder.
 *
 * **Details**
 *
 * Decision `memory-files-are-md-files-outside-dot-segments`: the path is
 * relative, ends in `.md`, and every segment is non-empty and does not start
 * with `.`. So an absolute path, a `..` segment, a hidden folder such as
 * `.git`, the projector's own temporary files and a non-Markdown file are not
 * memory file paths, and every event payload, store row and projection that
 * carries one refuses them at decode. Backslashes are refused by `PosixPath`.
 *
 * **Example** (Check memory file paths)
 *
 * ```ts
 * import { MemoryFilePath } from "@beep/agent-memory-store"
 * import * as S from "effect/Schema"
 *
 * console.log(MemoryFilePath.make("notes/decisions.md"))
 * console.log(S.is(MemoryFilePath)("../escape.md")) // false
 * console.log(S.is(MemoryFilePath)(".git/notes.md")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryFilePath = PosixPath.check(
  S.isPattern(MEMORY_FILE_PATH_PATTERN, {
    expected: "a relative .md path whose segments are non-empty and do not start with '.'",
  })
).pipe(
  $I.annoteSchema("MemoryFilePath", {
    description:
      "Relative POSIX path of a Markdown memory file inside the imported memory folder, with no empty or dot-prefixed segment.",
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
 * Position in the memory log on this replica: how many entries it has
 * committed.
 *
 * **Details**
 *
 * The store numbers entries in the order it commits them, starting at 1, so a
 * cursor of `n` names "the first `n` entries" and `0` names the empty log. An
 * export records the cursor it reflects, and a projection reads the entries
 * after its last cursor instead of the whole log (decision
 * `memory-log-checks-parents-in-the-journal-transaction`).
 *
 * **Gotchas**
 *
 * A cursor is not a journal entry id. Entry ids are creation-time UUIDs, and a
 * remote replay can commit an older id after a newer one, so only the commit
 * position is safe to resume from. Positions are local to one replica and are
 * never compared across replicas.
 *
 * **Example** (Brand a log cursor)
 *
 * ```ts
 * import { LogCursor } from "@beep/agent-memory-store"
 *
 * const cursor = LogCursor.make(42)
 * console.log(cursor)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LogCursor = S.Natural.pipe(
  S.brand("LogCursor"),
  $I.annoteSchema("LogCursor", {
    description: "Number of entries this replica has committed to the memory log; 0 names the empty log.",
  })
);

/**
 * Runtime type for {@link LogCursor}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type LogCursor = typeof LogCursor.Type;

/**
 * Markdown construct a memory node is cut from.
 *
 * **Details**
 *
 * Decision `granularity-row-and-list-item`: list items and table rows are
 * nodes, a fenced code block is one node, and headings and paragraphs are
 * single nodes. Decision `file-is-an-ordered-node-partition`: a `gap` node
 * holds the bytes between two content nodes (blank lines and separators), so
 * every byte of a memory file belongs to exactly one node. Gap nodes are never
 * indexed for recall and never deduplicated.
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
  "gap",
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
 * sorted ascending without repeats, so the JSON form is canonical.
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
    parents: S.Array(RevisionId).annotateKey({ description: "Distinct parent revisions, sorted ascending." }),
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
 * Parents are deduplicated and sorted ascending before encoding, so the
 * result depends on the set of parents, not on the order or repetition the
 * caller supplies them in. P1 hashes the returned string with
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
        parents: A.sort(A.dedupe(parents), Order.String),
        contentHash,
      })
    )
  )
);
