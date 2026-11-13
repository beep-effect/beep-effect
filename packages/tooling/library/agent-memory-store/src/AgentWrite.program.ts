/**
 * The agent write path as one composition: an agent edits files of an
 * exported base, op capture turns the edit into node operations against that
 * base, admission judges them store-side and the projector exports the log.
 *
 * **Details**
 *
 * The memory folder itself is only ever written by the projector: an agent
 * edits its own copy of the exported files and hands the edited texts over as
 * {@link FileEdit} values (decision `p2-write-path-is-capture-then-admit`).
 * The `memory` command family that drives this loop for an agent is P5.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { Admission } from "./Admission.service.ts";
import { AdmittedWrite, ExportedWrite } from "./AgentWrite.models.ts";
import { MarkdownProjector } from "./MarkdownProjector.service.ts";
import { captureBatchVerified } from "./OperationCapture.diff.ts";
import { typeStatusMoves } from "./OperationCapture.status.ts";
import type { PosixPath } from "@beep/schema";
import type { LazyArg } from "effect/Function";
import type { NodeId } from "./NodeIdentity.models.ts";
import type { LineageId } from "./Observation.events.ts";
import type { BaseExport } from "./Operation.models.ts";
import type { FileEdit } from "./OperationCapture.models.ts";
import type { StatusFields } from "./StatusField.models.ts";

/**
 * Captures an agent edit against its exported base and admits it.
 *
 * **Details**
 *
 * The edit is captured with `captureBatchVerified` (which refuses a base
 * whose node texts do not hash to the file digests it records), each status
 * token swap is submitted as a `setStatus` (`typeStatusMoves`) and the batch
 * goes to `Admission.admit`. An edit that changes nothing is not submitted.
 *
 * **Example** (Admit an agent edit)
 *
 * ```ts
 * import { admitEdits, FileEdit, LineageId, StatusFields, uuidV7NodeIdMinter } from "@beep/agent-memory-store"
 * import type { BaseExport } from "@beep/agent-memory-store"
 *
 * const write = (base: BaseExport) =>
 *   admitEdits(base, [FileEdit.cases.edited.make({ path: "notes.md", text: "# Notes\n" })], {
 *     author: LineageId.make("session-42"),
 *     statusFields: StatusFields.make({ lifecycles: [] }),
 *     mintNodeId: uuidV7NodeIdMinter,
 *   })
 * console.log(write)
 * ```
 *
 * @param base - The export the agent edited.
 * @param edits - The edited, created and removed files.
 * @param options - The writer's lineage, the status lifecycles and the node id minter for inserts.
 * @returns The submitted batch and one admission outcome per operation.
 * @category constructors
 * @since 0.0.0
 */
export const admitEdits = Effect.fn("AgentWrite.admitEdits")(function* (
  base: BaseExport,
  edits: ReadonlyArray<FileEdit>,
  options: {
    readonly author: LineageId;
    readonly statusFields: StatusFields;
    readonly mintNodeId: LazyArg<NodeId>;
  }
) {
  const admission = yield* Admission;
  const captured = yield* captureBatchVerified(base, edits, options.author, options.mintNodeId);
  if (O.isNone(captured)) {
    return AdmittedWrite.make({ batch: O.none(), outcomes: [] });
  }
  const batch = typeStatusMoves(captured.value, options.statusFields);
  const outcomes = yield* admission.admit(batch);
  return AdmittedWrite.make({ batch: O.some(batch), outcomes });
});

/**
 * Admits an agent edit and exports the memory folder from the log.
 *
 * **Details**
 *
 * Runs {@link admitEdits}, then `MarkdownProjector.exportFolder` on `root`,
 * so the folder holds every admitted write, and returns the new export as the
 * base of the next edit. Held writes are not in the export; they stay in
 * `Admission.held` with both texts until a resolver settles them.
 *
 * **Gotchas**
 *
 * A `removed` file edit retires the file's nodes but not the file: the export
 * writes it back as an empty file and the next base lists it, so a later edit
 * of that path is `edited`, and a `created` edit of it is refused with
 * `baseFileExists`.
 *
 * **Example** (Write an agent edit through to the memory folder)
 *
 * ```ts
 * import { FileEdit, LineageId, StatusFields, uuidV7NodeIdMinter, writeEdits } from "@beep/agent-memory-store"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import type { BaseExport } from "@beep/agent-memory-store"
 *
 * const write = (base: BaseExport) =>
 *   writeEdits(PosixPath.make("memory"), base, [FileEdit.cases.edited.make({ path: "notes.md", text: "# Notes\n" })], {
 *     author: LineageId.make("session-42"),
 *     statusFields: StatusFields.make({ lifecycles: [] }),
 *     mintNodeId: uuidV7NodeIdMinter,
 *   })
 * console.log(write)
 * ```
 *
 * @param root - The memory folder the log was imported from.
 * @param base - The export the agent edited.
 * @param edits - The edited, created and removed files.
 * @param options - The writer's lineage, the status lifecycles and the node id minter for inserts.
 * @returns The admitted write and the export that followed it.
 * @category constructors
 * @since 0.0.0
 */
export const writeEdits = Effect.fn("AgentWrite.writeEdits")(function* (
  root: PosixPath,
  base: BaseExport,
  edits: ReadonlyArray<FileEdit>,
  options: {
    readonly author: LineageId;
    readonly statusFields: StatusFields;
    readonly mintNodeId: LazyArg<NodeId>;
  }
) {
  const projector = yield* MarkdownProjector;
  const write = yield* admitEdits(base, edits, options);
  const exported = yield* projector.exportFolder(root);
  return ExportedWrite.make({ write, exported });
});
