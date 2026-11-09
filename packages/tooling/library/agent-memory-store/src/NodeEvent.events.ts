/**
 * Node events of the agent memory log, defined on `effect/eventlog`.
 *
 * **Details**
 *
 * Decision `memory-log-on-effect-eventlog`: node events are typed events in
 * one event group keyed by `NodeId`. No compaction is registered for them, so
 * the log stays Layer 2's exact record.
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
import { ContentHash, MemoryFilePath, NodeId, NodeKind, RevisionId } from "./NodeIdentity.models.ts";
import { OccurrenceAnchor } from "./SpanAnchor.models.ts";
import { StatusTransition } from "./StatusLifecycle.models.ts";

const $I = $AgentMemoryStoreId.create("NodeEvent.events");

/**
 * Payload of the event that admits a new node.
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
    anchor: OccurrenceAnchor.annotateKey({ description: "Span of the node in its source file." }),
    filePath: MemoryFilePath.annotateKey({ description: "Memory file the node belongs to." }),
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
 * import { FolderImported } from "@beep/agent-memory-store"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const imported = FolderImported.make({
 *   folderDigest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   fileCount: 3,
 *   nodeCount: 42,
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
  }).pipe(
    $I.annoteSchema("FolderImported", {
      description: "Payload of the bootstrap event recorded when a memory folder is imported.",
    })
  )
) {}

/**
 * Event definition that admits a new node, keyed on the `NodeId` string.
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
 * Event group of the agent memory log.
 *
 * **Details**
 *
 * Node events key on the `NodeId` string; `FolderImported` keys on the folder
 * digest. No compaction is registered: the log is Layer 2's exact record.
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
  .add(FolderImportedEvent);

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
