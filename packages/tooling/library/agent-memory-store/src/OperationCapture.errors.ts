/**
 * Typed errors of op capture and of its apply helper.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { MemoryFilePath, NodeId } from "./NodeIdentity.models.ts";
import { ApplyRefusal, CaptureBaseRefusal, CaptureEditRefusal } from "./OperationCapture.models.ts";

const $I = $AgentMemoryStoreId.create("OperationCapture.errors");

/**
 * Capture refused one of the file edits it was handed.
 *
 * **Example** (Describe a refused edit)
 *
 * ```ts
 * import { CaptureEditRefusedError } from "@beep/agent-memory-store"
 *
 * const error = CaptureEditRefusedError.make({ path: "../escape.md", reason: "pathOutsideMemoryFiles" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CaptureEditRefusedError extends S.TaggedError<CaptureEditRefusedError, { readonly brand: unique symbol }>(
  $I`CaptureEditRefusedError`
)(
  "CaptureEditRefusedError",
  {
    path: S.String.annotateKey({ description: "Path the refused edit named." }),
    reason: CaptureEditRefusal.annotateKey({ description: "Why capture refused the edit." }),
  },
  $I.annoteError<CaptureEditRefusedError>("CaptureEditRefusedError", {
    description: "Op capture refused one of the file edits it was handed.",
  })
) {
  /**
   * Names the refused path and the reason.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { CaptureEditRefusedError } from "@beep/agent-memory-store"
   *
   * console.log(CaptureEditRefusedError.make({ path: "notes/new.md", reason: "unknownBaseFile" }).message)
   * ```
   *
   * @returns The human-readable failure message.
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Op capture refused the edit of ${this.path}: ${this.reason}`;
  }
}

/**
 * Capture refused the exported base: its files or nodes do not describe
 * exact, distinct file texts.
 *
 * **Example** (Describe a refused base)
 *
 * ```ts
 * import { CaptureBaseRefusedError, MemoryFilePath } from "@beep/agent-memory-store"
 *
 * const error = CaptureBaseRefusedError.make({ path: MemoryFilePath.make("notes/a.md"), reason: "digestMismatch" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CaptureBaseRefusedError extends S.TaggedError<CaptureBaseRefusedError, { readonly brand: unique symbol }>(
  $I`CaptureBaseRefusedError`
)(
  "CaptureBaseRefusedError",
  {
    path: MemoryFilePath.annotateKey({ description: "Base file the refusal is about." }),
    reason: CaptureBaseRefusal.annotateKey({ description: "Why capture refused the base." }),
  },
  $I.annoteError<CaptureBaseRefusedError>("CaptureBaseRefusedError", {
    description: "Op capture refused the exported base.",
  })
) {
  /**
   * Names the base file and the reason.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { CaptureBaseRefusedError, MemoryFilePath } from "@beep/agent-memory-store"
   *
   * console.log(
   *   CaptureBaseRefusedError.make({ path: MemoryFilePath.make("notes/a.md"), reason: "duplicateFile" }).message
   * )
   * ```
   *
   * @returns The human-readable failure message.
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Op capture refused the base file ${this.path}: ${this.reason}`;
  }
}

/**
 * The node id minter returned an id the base or the batch already holds.
 *
 * **Example** (Describe a colliding minted id)
 *
 * ```ts
 * import { MintedNodeIdCollisionError, NodeId } from "@beep/agent-memory-store"
 *
 * const error = MintedNodeIdCollisionError.make({ nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f") })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MintedNodeIdCollisionError extends S.TaggedError<
  MintedNodeIdCollisionError,
  { readonly brand: unique symbol }
>($I`MintedNodeIdCollisionError`)(
  "MintedNodeIdCollisionError",
  {
    nodeId: NodeId.annotateKey({ description: "The id the minter returned twice." }),
  },
  $I.annoteError<MintedNodeIdCollisionError>("MintedNodeIdCollisionError", {
    description: "The node id minter returned an id the base or the batch already holds.",
  })
) {
  /**
   * Names the colliding id.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { MintedNodeIdCollisionError, NodeId } from "@beep/agent-memory-store"
   *
   * console.log(
   *   MintedNodeIdCollisionError.make({ nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f") }).message
   * )
   * ```
   *
   * @returns The human-readable failure message.
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Op capture minted node id ${this.nodeId}, which the base or the batch already holds`;
  }
}

/**
 * Every error op capture can fail with.
 *
 * @category errors
 * @since 0.0.0
 */
export type OperationCaptureError = CaptureEditRefusedError | CaptureBaseRefusedError | MintedNodeIdCollisionError;

/**
 * The apply helper refused an operation of a batch.
 *
 * **Example** (Describe a refused operation)
 *
 * ```ts
 * import { NodeId, OperationApplyError } from "@beep/agent-memory-store"
 *
 * const error = OperationApplyError.make({
 *   nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   reason: "unknownNode",
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OperationApplyError extends S.TaggedError<OperationApplyError, { readonly brand: unique symbol }>(
  $I`OperationApplyError`
)(
  "OperationApplyError",
  {
    nodeId: NodeId.annotateKey({ description: "Node the refused operation named." }),
    reason: ApplyRefusal.annotateKey({ description: "Why the operation was refused." }),
  },
  $I.annoteError<OperationApplyError>("OperationApplyError", {
    description: "The op capture apply helper refused an operation of a batch.",
  })
) {
  /**
   * Names the node and the reason.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { NodeId, OperationApplyError } from "@beep/agent-memory-store"
   *
   * console.log(
   *   OperationApplyError.make({
   *     nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
   *     reason: "staleRevision",
   *   }).message
   * )
   * ```
   *
   * @returns The human-readable failure message.
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Applying an operation on node ${this.nodeId} failed: ${this.reason}`;
  }
}
