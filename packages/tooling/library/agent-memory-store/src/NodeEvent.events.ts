/**
 * Node events of the agent memory log, defined on `effect/eventlog`.
 *
 * **Details**
 *
 * Decision `memory-log-on-effect-eventlog`: node events are typed events in
 * one event group keyed by `NodeId`. No compaction is registered for them, so
 * the log stays Layer 2's exact record.
 *
 * Decision `file-is-an-ordered-node-partition`: the log alone rebuilds every
 * memory file. A file is the concatenation of its live nodes' texts in
 * document order, `NodeCreated.after` records that order, and `gap` nodes
 * hold the bytes between content nodes.
 *
 * Decision `held-writes-are-log-events`: a held write and its resolution are
 * `WriteHeld` and `HoldResolved` events, keyed by `HoldId`.
 *
 * Every event names the lineage that wrote it, so the log holds provenance
 * for each revision.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as Event from "effect/eventlog/Event";
import * as EventGroup from "effect/eventlog/EventGroup";
import * as EventLog from "effect/eventlog/EventLog";
import * as S from "effect/Schema";
import { ConflictResolution, HoldId, MemoryGateViolation } from "./Admission.models.ts";
import { HoldNotOpenError, StaleParentsError, UnplacedNodeError } from "./AgentMemoryStore.errors.ts";
import { ContentHash, MemoryFilePath, NodeId, NodeKind, RevisionId } from "./NodeIdentity.models.ts";
import { LineageId } from "./Observation.events.ts";
import { NodeOperation } from "./Operation.models.ts";
import { OccurrenceAnchor } from "./SpanAnchor.models.ts";
import { StatusTransition } from "./StatusLifecycle.models.ts";

const $I = $AgentMemoryStoreId.create("NodeEvent.events");

/**
 * Payload of the event that admits a new node.
 *
 * **Details**
 *
 * `after` places the node in its file: it follows the named node, or opens
 * the file when `after` is absent. Nodes that name the same predecessor are
 * ordered newest first by journal entry order (creation time, then entry id
 * bytes, which is the same on every replica), so the later insert sits next
 * to the predecessor. A retired node keeps its place as a tombstone, so the
 * nodes that follow it stay ordered. `anchor` is import provenance: the span
 * of the imported file the node was read from. A node an agent wrote has no
 * anchor; its provenance is its `author`. The anchor never decides order.
 *
 * **Example** (Read the fields of a node creation)
 *
 * ```ts
 * import { NodeCreated } from "@beep/agent-memory-store"
 *
 * console.log(NodeCreated.fields.anchor)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class NodeCreated extends S.Opaque<NodeCreated, { readonly brand: unique symbol }>()(
  S.Struct({
    nodeId: NodeId.annotateKey({ description: "Store-minted identity of the new node." }),
    kind: NodeKind.annotateKey({ description: "Markdown construct of the node." }),
    contentHash: ContentHash.annotateKey({ description: "Hash of the node's normalized text." }),
    revisionId: RevisionId.annotateKey({ description: "Root revision of the node." }),
    text: S.String.annotateKey({ description: "Exact node text." }),
    anchor: S.OptionFromOptionalKey(OccurrenceAnchor).annotateKey({
      description: "Span of the imported file the node was read from; absent for a node an agent wrote.",
    }),
    filePath: MemoryFilePath.annotateKey({ description: "Memory file the node belongs to." }),
    after: S.OptionFromOptionalKey(NodeId).annotateKey({
      description: "Node this node follows in its file; absent when it opens the file.",
    }),
    author: LineageId.annotateKey({ description: "Lineage that wrote the node." }),
  }).pipe(
    $I.annoteSchema("NodeCreated", {
      description: "Payload of the event that admits a new node.",
    })
  )
) {}

/**
 * Payload of the event that records a new revision of a node's text.
 *
 * **Example** (Read the fields of a node revision)
 *
 * ```ts
 * import { NodeRevised } from "@beep/agent-memory-store"
 *
 * console.log(NodeRevised.fields.parents)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class NodeRevised extends S.Opaque<NodeRevised, { readonly brand: unique symbol }>()(
  S.Struct({
    nodeId: NodeId.annotateKey({ description: "Revised node." }),
    revisionId: RevisionId.annotateKey({ description: "Revision this event produces." }),
    parents: S.NonEmptyArray(RevisionId).annotateKey({ description: "Revisions this revision follows." }),
    contentHash: ContentHash.annotateKey({ description: "Hash of the new normalized text." }),
    text: S.String.annotateKey({ description: "New node text." }),
    author: LineageId.annotateKey({ description: "Lineage that wrote the revision." }),
  }).pipe(
    $I.annoteSchema("NodeRevised", {
      description: "Payload of the event that records a new revision of a node's text.",
    })
  )
) {}

/**
 * Payload of the event that moves a node's typed status field.
 *
 * **Details**
 *
 * A typed status field is part of the node text (a frontmatter key, a table
 * cell or a list-item marker), so a status move is a text revision tagged with
 * the transition it made. The event carries every input of its revision id:
 * `revisionId` is `hash(nodeId, parents, contentHash)` over its own fields, and
 * `parents` names the revision it supersedes, which keeps the per-node
 * compare-and-set chain that `setStatus`'s `expectedRevision` relies on.
 *
 * **Example** (Read the fields of a status change)
 *
 * ```ts
 * import { NodeStatusChanged } from "@beep/agent-memory-store"
 *
 * console.log(NodeStatusChanged.fields.transition)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class NodeStatusChanged extends S.Opaque<NodeStatusChanged, { readonly brand: unique symbol }>()(
  S.Struct({
    nodeId: NodeId.annotateKey({ description: "Node holding the status field." }),
    revisionId: RevisionId.annotateKey({ description: "Revision this event produces." }),
    parents: S.NonEmptyArray(RevisionId).annotateKey({ description: "Revisions this revision follows." }),
    contentHash: ContentHash.annotateKey({ description: "Hash of the node's normalized text after the move." }),
    text: S.String.annotateKey({ description: "Node text with the status field moved." }),
    transition: StatusTransition.annotateKey({ description: "Admitted status change." }),
    author: LineageId.annotateKey({ description: "Lineage that moved the status." }),
  }).pipe(
    $I.annoteSchema("NodeStatusChanged", {
      description: "Payload of the event that moves a node's typed status field.",
    })
  )
) {}

/**
 * Payload of the event that retires a node.
 *
 * **Details**
 *
 * A retirement writes a tombstone revision. It has no text, so its revision
 * id is `hash(nodeId, parents, TombstoneContentHash)`: every input is either a
 * field of the event or that fixed constant.
 *
 * **Example** (Read the fields of a node retirement)
 *
 * ```ts
 * import { NodeRetired } from "@beep/agent-memory-store"
 *
 * console.log(NodeRetired.fields.revisionId)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class NodeRetired extends S.Opaque<NodeRetired, { readonly brand: unique symbol }>()(
  S.Struct({
    nodeId: NodeId.annotateKey({ description: "Retired node." }),
    revisionId: RevisionId.annotateKey({ description: "Tombstone revision this event produces." }),
    parents: S.NonEmptyArray(RevisionId).annotateKey({ description: "Revisions the tombstone follows." }),
    author: LineageId.annotateKey({ description: "Lineage that retired the node." }),
  }).pipe(
    $I.annoteSchema("NodeRetired", {
      description: "Payload of the event that retires a node.",
    })
  )
) {}

/**
 * Payload of the bootstrap event recorded when a memory folder is imported.
 *
 * **Details**
 *
 * AC-8: the projector refuses to write over a folder whose digest the log has
 * no `FolderImported` record for.
 *
 * **Example** (Record a folder import)
 *
 * ```ts
 * import { FolderImported, LineageId } from "@beep/agent-memory-store"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const imported = FolderImported.make({
 *   folderDigest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   fileCount: 3,
 *   nodeCount: 42,
 *   author: LineageId.make("session-42"),
 * })
 * console.log(imported.nodeCount)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class FolderImported extends S.Opaque<FolderImported, { readonly brand: unique symbol }>()(
  S.Struct({
    folderDigest: Sha256Hex.annotateKey({ description: "SHA-256 over the imported folder." }),
    fileCount: S.Natural.annotateKey({ description: "Number of files imported." }),
    nodeCount: S.Natural.annotateKey({ description: "Number of nodes imported." }),
    author: LineageId.annotateKey({ description: "Lineage that ran the import." }),
  }).pipe(
    $I.annoteSchema("FolderImported", {
      description: "Payload of the bootstrap event recorded when a memory folder is imported.",
    })
  )
) {}

/**
 * Payload of the event recorded for each file of an imported memory folder.
 *
 * **Details**
 *
 * The file's bytes are not stored here: they are the concatenation of the
 * file's nodes, which the same import batch creates. `fileDigest` lets a
 * rebuild prove it reproduced the imported bytes (AC-1), and the event is the
 * only record of a file that has no nodes.
 *
 * **Example** (Record an imported file)
 *
 * ```ts
 * import { FileImported, LineageId, MemoryFilePath } from "@beep/agent-memory-store"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const imported = FileImported.make({
 *   filePath: MemoryFilePath.make("notes/decisions.md"),
 *   fileDigest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   nodeCount: 12,
 *   author: LineageId.make("session-42"),
 * })
 * console.log(imported.nodeCount)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class FileImported extends S.Opaque<FileImported, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: MemoryFilePath.annotateKey({ description: "Imported memory file." }),
    fileDigest: Sha256Hex.annotateKey({ description: "SHA-256 of the imported file bytes." }),
    nodeCount: S.Natural.annotateKey({ description: "Number of nodes the file was cut into, gaps included." }),
    author: LineageId.annotateKey({ description: "Lineage that ran the import." }),
  }).pipe(
    $I.annoteSchema("FileImported", {
      description: "Payload of the event recorded for each file of an imported memory folder.",
    })
  )
) {}

/**
 * Payload of the event that records a held write.
 *
 * **Details**
 *
 * Decision `held-writes-are-log-events`: the log is the sole authority, so a
 * write waiting on a resolver is a fact in it. `operation` is the write
 * exactly as submitted, which keeps the agent's text; `headRevision` names the
 * revision the log held for the node, which keeps the other text. It is
 * absent when the log holds no revision for the node, as for a held insert.
 *
 * **Example** (Read the fields of a held write)
 *
 * ```ts
 * import { WriteHeld } from "@beep/agent-memory-store"
 *
 * console.log(WriteHeld.fields.holdId)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class WriteHeld extends S.Opaque<WriteHeld, { readonly brand: unique symbol }>()(
  S.Struct({
    holdId: HoldId.annotateKey({ description: "Store-minted identity of the hold." }),
    operation: NodeOperation.annotateKey({ description: "The write exactly as the agent submitted it." }),
    author: LineageId.annotateKey({ description: "Lineage that submitted the held write." }),
    headRevision: S.OptionFromOptionalKey(RevisionId).annotateKey({
      description: "Revision the log held for the node when the write was held.",
    }),
    violations: S.NonEmptyArray(MemoryGateViolation).annotateKey({ description: "Findings that held the write." }),
  }).pipe(
    $I.annoteSchema("WriteHeld", {
      description: "Payload of the event that records a held write.",
    })
  )
) {}

/**
 * Payload of the event that settles a held write.
 *
 * **Details**
 *
 * `revisionId` names the revision the resolution produced, written in the
 * same batch as this event on the node's heads at resolve time. It is absent
 * when the resolver kept what the log holds, because that writes no revision;
 * a hold the node has moved on without is closed the same way.
 *
 * **Example** (Read the fields of a hold resolution)
 *
 * ```ts
 * import { HoldResolved } from "@beep/agent-memory-store"
 *
 * console.log(HoldResolved.fields.resolution)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class HoldResolved extends S.Opaque<HoldResolved, { readonly brand: unique symbol }>()(
  S.Struct({
    holdId: HoldId.annotateKey({ description: "Hold this event settles." }),
    resolution: ConflictResolution.annotateKey({ description: "The resolver's choice." }),
    author: LineageId.annotateKey({ description: "Lineage that resolved the hold." }),
    revisionId: S.OptionFromOptionalKey(RevisionId).annotateKey({
      description: "Revision the resolution produced; absent when the logged text was kept.",
    }),
  }).pipe(
    $I.annoteSchema("HoldResolved", {
      description: "Payload of the event that settles a held write.",
    })
  )
) {}

/**
 * Event definition that admits a new node, keyed on the `NodeId` string.
 *
 * **Details**
 *
 * The four node event definitions declare `StaleParentsError` as their error
 * schema, so the handler that enforces the per-node compare-and-set can fail
 * with it and the typed failure reaches the caller of the log write.
 * `NodeCreated` also declares `UnplacedNodeError`: its handler refuses a
 * predecessor that is not a node of the same file.
 *
 * **Example** (Read the event tag)
 *
 * ```ts
 * import { NodeCreatedEvent } from "@beep/agent-memory-store"
 *
 * console.log(NodeCreatedEvent.tag) // "NodeCreated"
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const NodeCreatedEvent = Event.make({
  tag: "NodeCreated",
  primaryKey: (payload: NodeCreated) => payload.nodeId,
  payload: NodeCreated,
  error: S.Union([StaleParentsError, UnplacedNodeError]),
});

/**
 * Event definition that records a new revision of a node's text, keyed on the `NodeId` string.
 *
 * **Example** (Read the event tag)
 *
 * ```ts
 * import { NodeRevisedEvent } from "@beep/agent-memory-store"
 *
 * console.log(NodeRevisedEvent.tag) // "NodeRevised"
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const NodeRevisedEvent = Event.make({
  tag: "NodeRevised",
  primaryKey: (payload: NodeRevised) => payload.nodeId,
  payload: NodeRevised,
  error: StaleParentsError,
});

/**
 * Event definition that moves a node's typed status field, keyed on the `NodeId` string.
 *
 * **Example** (Read the event tag)
 *
 * ```ts
 * import { NodeStatusChangedEvent } from "@beep/agent-memory-store"
 *
 * console.log(NodeStatusChangedEvent.tag) // "NodeStatusChanged"
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const NodeStatusChangedEvent = Event.make({
  tag: "NodeStatusChanged",
  primaryKey: (payload: NodeStatusChanged) => payload.nodeId,
  payload: NodeStatusChanged,
  error: StaleParentsError,
});

/**
 * Event definition that retires a node, keyed on the `NodeId` string.
 *
 * **Example** (Read the event tag)
 *
 * ```ts
 * import { NodeRetiredEvent } from "@beep/agent-memory-store"
 *
 * console.log(NodeRetiredEvent.tag) // "NodeRetired"
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const NodeRetiredEvent = Event.make({
  tag: "NodeRetired",
  primaryKey: (payload: NodeRetired) => payload.nodeId,
  payload: NodeRetired,
  error: StaleParentsError,
});

/**
 * Event definition that records a folder import, keyed on the folder digest.
 *
 * **Example** (Read the event tag)
 *
 * ```ts
 * import { FolderImportedEvent } from "@beep/agent-memory-store"
 *
 * console.log(FolderImportedEvent.tag) // "FolderImported"
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const FolderImportedEvent = Event.make({
  tag: "FolderImported",
  primaryKey: (payload: FolderImported) => payload.folderDigest,
  payload: FolderImported,
});

/**
 * Event definition that records one imported file, keyed on the file path.
 *
 * **Example** (Read the event tag)
 *
 * ```ts
 * import { FileImportedEvent } from "@beep/agent-memory-store"
 *
 * console.log(FileImportedEvent.tag) // "FileImported"
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const FileImportedEvent = Event.make({
  tag: "FileImported",
  primaryKey: (payload: FileImported) => payload.filePath,
  payload: FileImported,
});

/**
 * Event definition that records a held write, keyed on the `HoldId` string.
 *
 * **Example** (Read the event tag)
 *
 * ```ts
 * import { WriteHeldEvent } from "@beep/agent-memory-store"
 *
 * console.log(WriteHeldEvent.tag) // "WriteHeld"
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const WriteHeldEvent = Event.make({
  tag: "WriteHeld",
  primaryKey: (payload: WriteHeld) => payload.holdId,
  payload: WriteHeld,
});

/**
 * Event definition that settles a held write, keyed on the `HoldId` string.
 *
 * **Details**
 *
 * It declares `HoldNotOpenError` as its error schema, so the handler can
 * refuse a resolution of a hold that is unknown or already resolved inside
 * the journal transaction.
 *
 * **Example** (Read the event tag)
 *
 * ```ts
 * import { HoldResolvedEvent } from "@beep/agent-memory-store"
 *
 * console.log(HoldResolvedEvent.tag) // "HoldResolved"
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const HoldResolvedEvent = Event.make({
  tag: "HoldResolved",
  primaryKey: (payload: HoldResolved) => payload.holdId,
  payload: HoldResolved,
  error: HoldNotOpenError,
});

/**
 * Event group of the agent memory log.
 *
 * **Details**
 *
 * Node events key on the `NodeId` string, `FolderImported` on the folder
 * digest, `FileImported` on the file path, and the hold events on the
 * `HoldId` string. No compaction is registered: the log is Layer 2's exact
 * record.
 *
 * **Example** (Count the memory event definitions)
 *
 * ```ts
 * import { MemoryEvents } from "@beep/agent-memory-store"
 *
 * console.log(MemoryEvents.events)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const MemoryEvents = EventGroup.empty
  .add(NodeCreatedEvent)
  .add(NodeRevisedEvent)
  .add(NodeStatusChangedEvent)
  .add(NodeRetiredEvent)
  .add(FolderImportedEvent)
  .add(FileImportedEvent)
  .add(WriteHeldEvent)
  .add(HoldResolvedEvent);

/**
 * Tagged payload of any memory log event: `{ _tag, payload }`.
 *
 * @category events
 * @since 0.0.0
 */
export type MemoryEvent = Event.TaggedPayload<EventGroup.Events<typeof MemoryEvents>>;

/**
 * Event log schema the memory log writes through.
 *
 * **Gotchas**
 *
 * This value is an `EventLog.Schema` (the group registry `EventLog` is built
 * from), not an `effect/Schema` codec, so the repo's no-`Schema`-suffix rule
 * for schema constants does not apply to its name.
 *
 * **Example** (Read the memory log groups)
 *
 * ```ts
 * import { MemoryLogSchema } from "@beep/agent-memory-store"
 *
 * console.log(MemoryLogSchema.groups.length)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const MemoryLogSchema = EventLog.schema(MemoryEvents);
