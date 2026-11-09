/**
 * Markdown projector contract: the Layer 1 projection between the log and
 * memory files on disk.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type { MarkdownEdit } from "@beep/markdown";
import type { PosixPath } from "@beep/schema";
import type * as Effect from "effect/Effect";
import type { ProjectionError, UnimportedFolderError } from "./AgentMemoryStore.errors.ts";
import type { NodeId } from "./NodeIdentity.models.ts";
import type { BaseExport } from "./Operation.models.ts";

const $I = $AgentMemoryStoreId.create("MarkdownProjector.service");

/**
 * Imports memory folders into the log and projects the log back to Markdown.
 *
 * **Details**
 *
 * - `importFolder` records a folder in the log and returns its base. It cuts
 *   every file into an ordered partition of nodes, `gap` nodes included, so
 *   the log alone reproduces each file's bytes (decision
 *   `file-is-an-ordered-node-partition`). A failed import leaves the folder
 *   untouched (AC-8).
 * - `exportFolder` writes the log's current state to the folder and returns
 *   the base agents edit against; bytes outside touched node spans are
 *   preserved exactly (AC-1). A folder the log has not imported fails with
 *   the typed refusal `UnimportedFolderError` before anything is written, so
 *   no existing file is replaced or emptied (AC-8); `ProjectionError` is
 *   reserved for I/O and decoding failures.
 * - `projectNode` returns the raw-slice edit that brings one node's span in
 *   its file up to the log. Its precondition is that the node's folder was
 *   imported; otherwise it fails with `UnimportedFolderError` as well.
 *
 * **Example** (Export a memory folder)
 *
 * ```ts
 * import { MarkdownProjector } from "@beep/agent-memory-store"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const projector = yield* MarkdownProjector
 *   return yield* projector.exportFolder(PosixPath.make("memory"))
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MarkdownProjector extends Context.Service<
  MarkdownProjector,
  {
    readonly importFolder: (root: PosixPath) => Effect.Effect<BaseExport, ProjectionError>;
    readonly exportFolder: (root: PosixPath) => Effect.Effect<BaseExport, ProjectionError | UnimportedFolderError>;
    readonly projectNode: (nodeId: NodeId) => Effect.Effect<MarkdownEdit, ProjectionError | UnimportedFolderError>;
  }
>()($I`MarkdownProjector`) {}
