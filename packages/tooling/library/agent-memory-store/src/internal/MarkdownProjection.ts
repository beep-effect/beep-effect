/**
 * The in-memory fold of the memory log that the Markdown projector reads:
 * every node with its place in its file, the imported file records and the
 * imported folder digests.
 *
 * Decision `file-is-an-ordered-node-partition`: a file is the concatenation of
 * its live nodes in document order. `NodeCreated.after` names a node's
 * predecessor (absent opens the file); nodes naming the same predecessor are
 * ordered newest first by journal entry order; a retired node keeps its place
 * as a tombstone, so the nodes after it stay ordered.
 *
 * @internal
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as EventJournal from "effect/eventlog/EventJournal";
import { constVoid, dual } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import {
  FileImportedEvent,
  FolderImportedEvent,
  NodeCreatedEvent,
  NodeRetiredEvent,
  NodeRevisedEvent,
  NodeStatusChangedEvent,
} from "../NodeEvent.events.ts";
import { LogCursor, MemoryFilePath, NodeId, NodeKind, RevisionId } from "../NodeIdentity.models.ts";
import type { Sha256Hex } from "@beep/schema";
import type { Entry } from "effect/eventlog/EventJournal";
import type { LazyArg } from "effect/Function";
import type { FileImported } from "../NodeEvent.events.ts";

const $I = $AgentMemoryStoreId.create("internal/MarkdownProjection");

/** One node of the fold. */
export class ProjectedNode extends S.Opaque<ProjectedNode, { readonly brand: unique symbol }>()(
  S.Struct({
    after: S.Option(NodeId).annotateKey({ description: "Node this node follows; none when it opens its file." }),
    entryId: EventJournal.EntryId.annotateKey({ description: "Journal entry that created the node." }),
    filePath: MemoryFilePath.annotateKey({ description: "Memory file the node belongs to." }),
    kind: NodeKind.annotateKey({ description: "Markdown construct of the node." }),
    live: S.Boolean.annotateKey({ description: "False once the node is retired." }),
    nodeId: NodeId.annotateKey({ description: "The node." }),
    previousText: S.Option(S.String).annotateKey({
      description: "The node's text before its latest event; none when that event created it.",
    }),
    revisionId: RevisionId.annotateKey({ description: "The node's head revision." }),
    text: S.String.annotateKey({ description: "The current text; empty for a tombstone." }),
  }).pipe(
    $I.annoteSchema("ProjectedNode", {
      description: "One node of the projector's in-memory fold of the memory log.",
    })
  )
) {}

/** The fold, owned and mutated by one projector instance. */
export class Projection {
  /** Successors of each node, in commit order. */
  readonly children = MutableHashMap.empty<NodeId, Array<NodeId>>();
  /** Entries folded so far. */
  cursor: LogCursor = LogCursor.make(0);
  /** `FileImported` records by path. */
  readonly files = MutableHashMap.empty<MemoryFilePath, FileImported>();
  /** Digests of every imported folder. */
  readonly folders = MutableHashSet.empty<Sha256Hex>();
  readonly nodes = MutableHashMap.empty<NodeId, ProjectedNode>();
  /** Nodes that open each file, in commit order. */
  readonly roots = MutableHashMap.empty<MemoryFilePath, Array<NodeId>>();
}

/** An empty fold at cursor 0. */
export const makeProjection = (): Projection => new Projection();

const trusted = { disableChecks: true } as const;

/** The binary payload decoders of the node events, shared with the admission log. */
export const nodeEventDecoders = {
  created: S.decodeUnknownEffect(NodeCreatedEvent.payloadSchemaBinary),
  revised: S.decodeUnknownEffect(NodeRevisedEvent.payloadSchemaBinary),
  statusChanged: S.decodeUnknownEffect(NodeStatusChangedEvent.payloadSchemaBinary),
  retired: S.decodeUnknownEffect(NodeRetiredEvent.payloadSchemaBinary),
} as const;
const decodeFileImported = S.decodeUnknownEffect(FileImportedEvent.payloadSchemaBinary);
const decodeFolderImported = S.decodeUnknownEffect(FolderImportedEvent.payloadSchemaBinary);

// Lists `nodeId` under `key` once: a node folded again keeps its one place.
const pushTo = <K>(map: MutableHashMap.MutableHashMap<K, Array<NodeId>>, key: K, nodeId: NodeId): void => {
  O.match(MutableHashMap.get(map, key), {
    onNone: () => {
      MutableHashMap.set(map, key, [nodeId]);
    },
    onSome: (list) => {
      if (!A.contains(list, nodeId)) {
        list.push(nodeId);
      }
    },
  });
};

// A later event for a node replaces its record; the text it replaces becomes
// `previousText`, which `projectNode` turns into the edit's span.
const updateNode = (
  projection: Projection,
  nodeId: NodeId,
  change: { readonly live: boolean; readonly revisionId: RevisionId; readonly text: string }
): void => {
  O.map(MutableHashMap.get(projection.nodes, nodeId), (node) =>
    MutableHashMap.set(
      projection.nodes,
      nodeId,
      ProjectedNode.make({ ...node, ...change, previousText: O.some(node.text) }, trusted)
    )
  );
};

// A revision that keeps its node live: a NodeRevised or a NodeStatusChanged.
const liveRevision =
  (projection: Projection) =>
  (payload: { readonly nodeId: NodeId; readonly revisionId: RevisionId; readonly text: string }): LazyArg<void> =>
  () =>
    updateNode(projection, payload.nodeId, { live: true, revisionId: payload.revisionId, text: payload.text });

// Decodes one entry's payload and returns what folding it does to the
// projection, so the caller applies it in step with the cursor.
const entryStep = (projection: Projection, entry: Entry): Effect.Effect<LazyArg<void>, S.SchemaError> =>
  Match.value(entry.event).pipe(
    // The log refuses a second NodeCreated for a node, so each node is created
    // once here.
    Match.when(NodeCreatedEvent.tag, () =>
      Effect.map(nodeEventDecoders.created(entry.payload), (payload) => () => {
        MutableHashMap.set(
          projection.nodes,
          payload.nodeId,
          ProjectedNode.make(
            {
              after: payload.after,
              entryId: entry.id,
              filePath: payload.filePath,
              kind: payload.kind,
              live: true,
              nodeId: payload.nodeId,
              previousText: O.none(),
              revisionId: payload.revisionId,
              text: payload.text,
            },
            trusted
          )
        );
        O.match(payload.after, {
          onNone: () => pushTo(projection.roots, payload.filePath, payload.nodeId),
          onSome: (after) => pushTo(projection.children, after, payload.nodeId),
        });
      })
    ),
    Match.when(NodeRevisedEvent.tag, () =>
      Effect.map(nodeEventDecoders.revised(entry.payload), liveRevision(projection))
    ),
    Match.when(NodeStatusChangedEvent.tag, () =>
      Effect.map(nodeEventDecoders.statusChanged(entry.payload), liveRevision(projection))
    ),
    Match.when(NodeRetiredEvent.tag, () =>
      Effect.map(
        nodeEventDecoders.retired(entry.payload),
        (payload) => () =>
          updateNode(projection, payload.nodeId, { live: false, revisionId: payload.revisionId, text: "" })
      )
    ),
    Match.when(FileImportedEvent.tag, () =>
      Effect.map(decodeFileImported(entry.payload), (payload) => () => {
        MutableHashMap.set(projection.files, payload.filePath, payload);
      })
    ),
    Match.when(FolderImportedEvent.tag, () =>
      Effect.map(decodeFolderImported(entry.payload), (payload) => () => {
        MutableHashSet.add(projection.folders, payload.folderDigest);
      })
    ),
    // Held writes and their resolutions place nothing; their revisions arrive
    // as node events.
    Match.orElse(() => Effect.succeed(constVoid))
  );

/**
 * Folds entries committed after the projection's cursor, in commit order, and
 * advances the cursor past each one as it is folded.
 *
 * Each entry's change and its cursor step run with no yield between them, so
 * an interruption or a payload that fails to decode leaves the cursor right
 * after the last folded entry and the next fold starts there.
 */
export const applyEntries = Effect.fnUntraced(function* (projection: Projection, entries: ReadonlyArray<Entry>) {
  for (const entry of entries) {
    const step = yield* entryStep(projection, entry);
    step();
    projection.cursor = LogCursor.make(projection.cursor + 1);
  }
});

// Newest first by journal entry order: creation time, then entry id bytes.
const newestFirst: Order.Order<ProjectedNode> = Order.mapInput(
  Order.flip(EventJournal.EntryIdOrder),
  (node: ProjectedNode) => node.entryId
);

// The nodes of `ids` that belong to `filePath`, ordered oldest first so that
// pushing them onto the walk stack leaves the newest on top.
const stackOrder = (
  projection: Projection,
  ids: ReadonlyArray<NodeId>,
  filePath: MemoryFilePath
): ReadonlyArray<ProjectedNode> =>
  A.reverse(
    A.sort(
      A.filter(
        A.getSomes(A.map(ids, (nodeId) => MutableHashMap.get(projection.nodes, nodeId))),
        (node) => node.filePath === filePath
      ),
      newestFirst
    )
  );

/**
 * The nodes of one file in document order, tombstones included.
 *
 * **Details**
 *
 * A pre-order walk of the predecessor tree: a node, then the nodes naming it
 * as predecessor newest first, each followed by its own successors. Only
 * nodes of the file are visited. The memory log refuses a `NodeCreated` whose
 * predecessor is unknown or in another file (`UnplacedNodeError`), so every
 * node the log holds is reached from its file's roots.
 */
export const fileNodes: {
  (filePath: MemoryFilePath): (projection: Projection) => ReadonlyArray<ProjectedNode>;
  (projection: Projection, filePath: MemoryFilePath): ReadonlyArray<ProjectedNode>;
} = dual(2, (projection: Projection, filePath: MemoryFilePath): ReadonlyArray<ProjectedNode> => {
  const ordered: Array<ProjectedNode> = [];
  const stack: Array<ProjectedNode> = [
    ...stackOrder(projection, O.getOrElse(MutableHashMap.get(projection.roots, filePath), A.empty<NodeId>), filePath),
  ];
  let node = stack.pop();
  while (node !== undefined) {
    ordered.push(node);
    stack.push(
      ...stackOrder(
        projection,
        O.getOrElse(MutableHashMap.get(projection.children, node.nodeId), A.empty<NodeId>),
        filePath
      )
    );
    node = stack.pop();
  }
  return ordered;
});

/** Every memory file the log knows, by import record or by node, sorted by path. */
export const filePaths = (projection: Projection): ReadonlyArray<MemoryFilePath> => {
  const paths = MutableHashSet.empty<MemoryFilePath>();
  for (const filePath of MutableHashMap.keys(projection.files)) {
    MutableHashSet.add(paths, filePath);
  }
  for (const filePath of MutableHashMap.keys(projection.roots)) {
    MutableHashSet.add(paths, filePath);
  }
  return A.sort(A.fromIterable(paths), Order.String);
};

/** The file text: the live node texts concatenated in document order. */
export const joinText = (nodes: ReadonlyArray<ProjectedNode>): string =>
  A.join(
    A.map(nodes, (node) => node.text),
    ""
  );
