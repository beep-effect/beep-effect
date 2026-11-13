/**
 * Op capture: turns "an agent edited memory files exported at base B" into
 * the `OperationBatch` of node operations against B that expresses the edit.
 *
 * **Details**
 *
 * Capture is pure over values: no file system, no log. Each edited file is
 * partitioned with {@link partition} and its nodes are aligned with the base
 * nodes of the same file by a minimal node diff (`effect/TextDiff`). A kept
 * node produces no operation; a changed node paired by position between kept
 * neighbours is a `replace` naming its base revision; every other edited node
 * is an `insert` and every other base node a `delete`. Applying the batch to
 * the base node list ({@link applyOperations}) yields exactly the edited
 * bytes, and the resulting node list is the partition of the edited text.
 * The ambiguous cases are recorded in decision
 * `op-capture-pairs-only-equal-count-runs`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { alignFile, joinBaseTexts } from "./internal/OperationCapture.align.ts";
import { sha256Hex } from "./NodeIdentity.digest.ts";
import { MemoryFilePath, NodeId } from "./NodeIdentity.models.ts";
import { NodeOperation, OperationBatch } from "./Operation.models.ts";
import {
  CaptureBaseRefusedError,
  CaptureEditRefusedError,
  MintedNodeIdCollisionError,
} from "./OperationCapture.errors.ts";
import { FileEdit } from "./OperationCapture.models.ts";
import type { LazyArg } from "effect/Function";
import type { LineageId } from "./Observation.events.ts";
import type { BaseExport, BaseFile, BaseNode } from "./Operation.models.ts";
import type { OperationCaptureError } from "./OperationCapture.errors.ts";

const isMemoryFilePath = S.is(MemoryFilePath);

const utf8 = new TextEncoder();

// One file capture works on: its path, its base nodes (none for a created
// file) and its edited text (empty for a removed file).
interface CaptureTarget {
  readonly nodes: ReadonlyArray<BaseNode>;
  readonly path: MemoryFilePath;
  readonly text: string;
}

const byPath: Order.Order<CaptureTarget> = Order.mapInput(Order.String, (target: CaptureTarget) => target.path);

// The base files by path and every node id the base holds, or the first
// reason the base does not describe exact, distinct file texts.
const indexBase = (
  base: BaseExport
): Result.Result<
  {
    readonly files: MutableHashMap.MutableHashMap<MemoryFilePath, BaseFile>;
    readonly ids: MutableHashSet.MutableHashSet<NodeId>;
  },
  CaptureBaseRefusedError
> => {
  const files = MutableHashMap.empty<MemoryFilePath, BaseFile>();
  const ids = MutableHashSet.empty<NodeId>();
  for (const file of base.files) {
    if (MutableHashMap.has(files, file.path)) {
      return Result.fail(CaptureBaseRefusedError.make({ path: file.path, reason: "duplicateFile" }));
    }
    MutableHashMap.set(files, file.path, file);
    let offset = 0;
    for (const node of file.nodes) {
      const { startChar, endChar, quote } = node.anchor.anchor;
      if (startChar !== offset || endChar !== offset + quote.length) {
        return Result.fail(CaptureBaseRefusedError.make({ path: file.path, reason: "anchorOutOfSequence" }));
      }
      if (MutableHashSet.has(ids, node.nodeId)) {
        return Result.fail(CaptureBaseRefusedError.make({ path: file.path, reason: "duplicateNodeId" }));
      }
      MutableHashSet.add(ids, node.nodeId);
      offset = endChar;
    }
  }
  return Result.succeed({ files, ids });
};

const refuse = (path: string, reason: CaptureEditRefusedError["reason"]) =>
  Result.fail(CaptureEditRefusedError.make({ path, reason }));

// The capture target of one edit, given the base file at its path.
const targetOf = (
  edit: FileEdit,
  path: MemoryFilePath,
  file: O.Option<BaseFile>
): Result.Result<CaptureTarget, CaptureEditRefusedError> =>
  FileEdit.match(edit, {
    edited: ({ text }): Result.Result<CaptureTarget, CaptureEditRefusedError> =>
      O.match(file, {
        onNone: () => refuse(path, "unknownBaseFile"),
        onSome: ({ nodes }) => Result.succeed({ path, nodes, text }),
      }),
    removed: (): Result.Result<CaptureTarget, CaptureEditRefusedError> =>
      O.match(file, {
        onNone: () => refuse(path, "unknownBaseFile"),
        onSome: ({ nodes }) => Result.succeed({ path, nodes, text: "" }),
      }),
    created: ({ text }): Result.Result<CaptureTarget, CaptureEditRefusedError> =>
      O.match(file, {
        onNone: () => Result.succeed({ path, nodes: [], text }),
        onSome: () => refuse(path, "baseFileExists"),
      }),
  });

const targetsOf = (
  edits: ReadonlyArray<FileEdit>,
  files: MutableHashMap.MutableHashMap<MemoryFilePath, BaseFile>
): Result.Result<ReadonlyArray<CaptureTarget>, CaptureEditRefusedError> => {
  const seen = MutableHashSet.empty<string>();
  const targets: Array<CaptureTarget> = [];
  for (const edit of edits) {
    const { path } = edit;
    if (!isMemoryFilePath(path)) {
      return refuse(path, "pathOutsideMemoryFiles");
    }
    if (MutableHashSet.has(seen, path)) {
      return refuse(path, "duplicateEdit");
    }
    MutableHashSet.add(seen, path);
    const target = targetOf(edit, path, MutableHashMap.get(files, path));
    if (Result.isFailure(target)) {
      return Result.fail(target.failure);
    }
    targets.push(target.success);
  }
  return Result.succeed(A.sort(targets, byPath));
};

// Appends the operations of one file to `operations`, minting an id for
// every insert; each insert follows the node the edited text puts before it.
const emitFile = (
  target: CaptureTarget,
  taken: MutableHashSet.MutableHashSet<NodeId>,
  mintNodeId: LazyArg<NodeId>,
  operations: Array<NodeOperation>
): O.Option<MintedNodeIdCollisionError> => {
  let after = O.none<NodeId>();
  for (const step of alignFile(target.nodes, target.text)) {
    const collision = Match.valueTags(step, {
      Keep: ({ base }) => {
        after = O.some(base.nodeId);
        return O.none();
      },
      Revise: ({ base, edited }) => {
        operations.push(
          NodeOperation.cases.replace.make({
            nodeId: base.nodeId,
            expectedRevision: base.revisionId,
            text: edited.text,
          })
        );
        after = O.some(base.nodeId);
        return O.none();
      },
      Retire: ({ base }) => {
        operations.push(NodeOperation.cases.delete.make({ nodeId: base.nodeId, expectedRevision: base.revisionId }));
        return O.none();
      },
      Insert: ({ edited }) => {
        const nodeId = mintNodeId();
        if (MutableHashSet.has(taken, nodeId)) {
          return O.some(MintedNodeIdCollisionError.make({ nodeId }));
        }
        MutableHashSet.add(taken, nodeId);
        operations.push(
          NodeOperation.cases.insert.make({
            nodeId,
            afterNodeId: after,
            filePath: target.path,
            kind: edited.kind,
            text: edited.text,
          })
        );
        after = O.some(nodeId);
        return O.none();
      },
    });
    if (O.isSome(collision)) {
      return collision;
    }
  }
  return O.none();
};

/**
 * Captures the node operations that turn an exported base into the edited
 * files.
 *
 * **Details**
 *
 * Edits are captured in path order, whatever order they come in, and a file
 * the edit leaves unchanged contributes nothing; the result is `none` when no
 * file changed. The batch for each file holds, in edited document order:
 *
 * - `replace { nodeId, expectedRevision, text }` for a changed node paired
 *   by position with a base node of the same kind; `expectedRevision` is the
 *   base revision.
 * - `delete { nodeId, expectedRevision }` for a base node the edit removed,
 *   moved or could not pair.
 * - `insert { nodeId, afterNodeId, filePath, kind, text }` for an edited node
 *   with no base node. `nodeId` comes from `mintNodeId`; `afterNodeId` is the
 *   node the edited text puts right before it: a kept or replaced base node,
 *   or the node minted by the previous insert, so an inserted run chains
 *   insert by insert. It is absent for a node that opens the file. An insert
 *   never follows a node the batch deletes.
 *
 * Apart from freshly minted ids the batch is a function of the inputs, so a
 * seeded minter ({@link seededNodeIdMinter}) makes it reproducible. Capture
 * trusts each `fileDigest`; {@link captureBatchVerified} checks them.
 *
 * **Example** (Capture a revised list item)
 *
 * ```ts
 * import {
 *   captureBatch,
 *   FileEdit,
 *   LineageId,
 *   seededNodeIdMinter,
 * } from "@beep/agent-memory-store"
 * import type { BaseExport } from "@beep/agent-memory-store"
 *
 * const capture = (base: BaseExport) =>
 *   captureBatch(
 *     base,
 *     [FileEdit.cases.edited.make({ path: "notes/decisions.md", text: "- one\n- deux\n" })],
 *     LineageId.make("session-42"),
 *     seededNodeIdMinter(1)
 *   )
 * console.log(capture)
 * ```
 *
 * @param base - The exported base the agent edited against.
 * @param edits - Each changed, created or removed file, at most one per path.
 * @param author - The lineage that wrote the edit.
 * @param mintNodeId - Mints the id of each inserted node.
 * @returns The batch, `none` when nothing changed, or the first refusal.
 * @category utilities
 * @since 0.0.0
 */
export const captureBatch: {
  (
    edits: ReadonlyArray<FileEdit>,
    author: LineageId,
    mintNodeId: LazyArg<NodeId>
  ): (base: BaseExport) => Result.Result<O.Option<OperationBatch>, OperationCaptureError>;
  (
    base: BaseExport,
    edits: ReadonlyArray<FileEdit>,
    author: LineageId,
    mintNodeId: LazyArg<NodeId>
  ): Result.Result<O.Option<OperationBatch>, OperationCaptureError>;
} = dual(
  4,
  (
    base: BaseExport,
    edits: ReadonlyArray<FileEdit>,
    author: LineageId,
    mintNodeId: LazyArg<NodeId>
  ): Result.Result<O.Option<OperationBatch>, OperationCaptureError> =>
    Result.flatMap(indexBase(base), ({ files, ids }) =>
      Result.flatMap(
        targetsOf(edits, files),
        (targets): Result.Result<O.Option<OperationBatch>, OperationCaptureError> => {
          const operations: Array<NodeOperation> = [];
          for (const target of targets) {
            const collision = emitFile(target, ids, mintNodeId, operations);
            if (O.isSome(collision)) {
              return Result.fail(collision.value);
            }
          }
          return Result.succeed(
            A.isArrayNonEmpty(operations) ? O.some(OperationBatch.make({ base, operations, author })) : O.none()
          );
        }
      )
    )
);

/**
 * Captures a batch like {@link captureBatch}, after checking that the node
 * texts of every base file an edit names hash to the file's recorded digest.
 *
 * **Details**
 *
 * A mismatch fails with `CaptureBaseRefusedError` (`digestMismatch`): the
 * base no longer describes the bytes the agent was given, so no batch written
 * against it can be trusted.
 *
 * **Example** (Capture against a verified base)
 *
 * ```ts
 * import { captureBatchVerified, FileEdit, LineageId, uuidV7NodeIdMinter } from "@beep/agent-memory-store"
 * import type { BaseExport } from "@beep/agent-memory-store"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const program = (base: BaseExport) =>
 *   captureBatchVerified(
 *     base,
 *     [FileEdit.cases.removed.make({ path: "notes/old.md" })],
 *     LineageId.make("session-42"),
 *     uuidV7NodeIdMinter
 *   ).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(program)
 * ```
 *
 * @param base - The exported base the agent edited against.
 * @param edits - Each changed, created or removed file, at most one per path.
 * @param author - The lineage that wrote the edit.
 * @param mintNodeId - Mints the id of each inserted node.
 * @returns The batch, `none` when nothing changed, or the first refusal.
 * @category utilities
 * @since 0.0.0
 */
export const captureBatchVerified = Effect.fnUntraced(function* (
  base: BaseExport,
  edits: ReadonlyArray<FileEdit>,
  author: LineageId,
  mintNodeId: LazyArg<NodeId>
) {
  const named = MutableHashSet.fromIterable(A.map(edits, (edit) => edit.path));
  for (const file of base.files) {
    if (MutableHashSet.has(named, file.path)) {
      const digest = yield* sha256Hex(utf8.encode(joinBaseTexts(file.nodes)));
      if (digest !== file.fileDigest) {
        return yield* CaptureBaseRefusedError.make({ path: file.path, reason: "digestMismatch" });
      }
    }
  }
  return yield* Effect.fromResult(captureBatch(base, edits, author, mintNodeId));
});

/**
 * A node id minter that returns UUIDv7 strings from `globalThis.crypto`.
 *
 * **Details**
 *
 * The ids are the same shape the projector mints on import. Use it for real
 * captures; use {@link seededNodeIdMinter} where a test needs the batch to be
 * reproducible.
 *
 * **Example** (Mint a node id)
 *
 * ```ts
 * import { uuidV7NodeIdMinter } from "@beep/agent-memory-store"
 *
 * console.log(uuidV7NodeIdMinter())
 * ```
 *
 * @returns A fresh node id.
 * @category utilities
 * @since 0.0.0
 */
export const uuidV7NodeIdMinter: LazyArg<NodeId> = () => NodeId.make(SecureRandom.uuidV7Unsafe());

const hex32 = (value: number): string => Str.padStart(8, "0")((value >>> 0).toString(16));

/**
 * A deterministic node id minter: the same seed mints the same sequence of
 * UUIDv4-shaped ids.
 *
 * **Details**
 *
 * The sequence comes from a mulberry32 generator, so it is reproducible and
 * not secret. Each minter has its own state.
 *
 * **Example** (Mint reproducible node ids)
 *
 * ```ts
 * import { seededNodeIdMinter } from "@beep/agent-memory-store"
 *
 * const first = seededNodeIdMinter(7)
 * const second = seededNodeIdMinter(7)
 * console.log(first() === second()) // true
 * ```
 *
 * @param seed - The generator seed.
 * @returns A minter of node ids.
 * @category utilities
 * @since 0.0.0
 */
export const seededNodeIdMinter = (seed: number): LazyArg<NodeId> => {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
  return () => {
    const hex = `${hex32(next())}${hex32(next())}${hex32(next())}${hex32(next())}`;
    const part = (start: number, end: number): string => Str.slice(start, end)(hex);
    return NodeId.make(`${part(0, 8)}-${part(8, 12)}-4${part(13, 16)}-8${part(17, 20)}-${part(20, 32)}`);
  };
};
