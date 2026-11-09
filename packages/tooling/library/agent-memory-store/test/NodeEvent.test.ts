import {
  ConflictResolution,
  ContentHash,
  FileImported,
  FileImportedEvent,
  FolderImported,
  FolderImportedEvent,
  HoldNotOpenError,
  HoldResolved,
  HoldResolvedEvent,
  LineageId,
  MemoryEvents,
  MemoryLogSchema,
  NodeCreated,
  NodeCreatedEvent,
  NodeOperation,
  NodeRetired,
  NodeRetiredEvent,
  NodeRevised,
  NodeRevisedEvent,
  NodeStatusChanged,
  NodeStatusChangedEvent,
  ObservationEvent,
  ObservationEvents,
  ObservedEvent,
  revisionPreimage,
  StaleParentsError,
  StatusTransition,
  StatusValue,
  TombstoneContentHash,
  WriteHeld,
  WriteHeldEvent,
} from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  anchor,
  author,
  contentHash,
  filePath,
  folderDigest,
  holdId,
  nodeId,
  otherNodeId,
  revisionA,
  revisionB,
  staleRevision,
} from "./fixtures.ts";

const writeHeldEquivalence = S.toEquivalence(WriteHeld);
const holdResolvedEquivalence = S.toEquivalence(HoldResolved);
const revisedHash = ContentHash.make("5555555555555555555555555555555555555555555555555555555555555555");

describe("NodeEvent events", () => {
  it.effect(
    "exposes every memory event tag through the log schema",
    Effect.fnUntraced(function* () {
      expect(MemoryLogSchema.groups).toEqual([MemoryEvents]);
      expect(A.sort(R.keys(MemoryEvents.events), Order.String)).toEqual([
        "FileImported",
        "FolderImported",
        "HoldResolved",
        "NodeCreated",
        "NodeRetired",
        "NodeRevised",
        "NodeStatusChanged",
        "WriteHeld",
      ]);
    })
  );

  it.effect(
    "keys every node event on the node id string",
    Effect.fnUntraced(function* () {
      expect(
        NodeCreatedEvent.primaryKey(
          NodeCreated.make({
            nodeId,
            kind: "paragraph",
            contentHash,
            revisionId: revisionA,
            text: "A fact.",
            anchor: O.some(anchor),
            filePath,
            after: O.none(),
            author,
          })
        )
      ).toBe(nodeId);
      expect(
        NodeRevisedEvent.primaryKey(
          NodeRevised.make({
            nodeId,
            revisionId: revisionB,
            parents: [revisionA],
            contentHash,
            text: "A new fact.",
            author,
          })
        )
      ).toBe(nodeId);
      expect(
        NodeStatusChangedEvent.primaryKey(
          NodeStatusChanged.make({
            nodeId,
            revisionId: revisionB,
            parents: [revisionA],
            contentHash,
            text: "status: active",
            transition: StatusTransition.make({ field: "status", from: O.none(), to: StatusValue.make("active") }),
            author,
          })
        )
      ).toBe(nodeId);
      expect(
        NodeRetiredEvent.primaryKey(NodeRetired.make({ nodeId, revisionId: revisionB, parents: [revisionA], author }))
      ).toBe(nodeId);
    })
  );

  it.effect(
    "admits an agent-written node without an import anchor and declares the stale-parents refusal",
    Effect.fnUntraced(function* () {
      const written = NodeCreated.make({
        nodeId,
        kind: "gap",
        contentHash,
        revisionId: revisionA,
        text: "\n\n",
        anchor: O.none(),
        filePath,
        after: O.some(otherNodeId),
        author,
      });
      const bytes = yield* S.encodeEffect(NodeCreatedEvent.payloadSchemaBinary)(written);
      const decoded = yield* S.decodeEffect(NodeCreatedEvent.payloadSchemaBinary)(bytes);
      expect(decoded).toEqual(written);

      expect(
        A.map([NodeCreatedEvent, NodeRevisedEvent, NodeStatusChangedEvent, NodeRetiredEvent], (event) => event.error)
      ).toEqual([StaleParentsError, StaleParentsError, StaleParentsError, StaleParentsError]);
    })
  );

  it.effect(
    "keys a folder import on the folder digest",
    Effect.fnUntraced(function* () {
      const imported = FolderImported.make({ folderDigest, fileCount: 2, nodeCount: 7, author });
      expect(FolderImportedEvent.primaryKey(imported)).toBe(folderDigest);
    })
  );

  it.effect(
    "keys a file import on the file path",
    Effect.fnUntraced(function* () {
      const imported = FileImported.make({ filePath, fileDigest: folderDigest, nodeCount: 0, author });
      expect(FileImportedEvent.primaryKey(imported)).toBe(filePath);
    })
  );

  it.effect(
    "keys a held write and its resolution on the hold id and round-trips both through the binary codec",
    Effect.fnUntraced(function* () {
      const held = WriteHeld.make({
        holdId,
        operation: NodeOperation.cases.delete.make({ nodeId, expectedRevision: revisionA }),
        author,
        headRevision: O.some(revisionB),
        violations: [staleRevision],
      });
      const resolved = HoldResolved.make({
        holdId,
        resolution: ConflictResolution.cases.ours.make({}),
        author,
        revisionId: O.none(),
      });
      expect(WriteHeldEvent.primaryKey(held)).toBe(holdId);
      expect(HoldResolvedEvent.primaryKey(resolved)).toBe(holdId);
      expect(HoldResolvedEvent.error).toBe(HoldNotOpenError);

      const heldBytes = yield* S.encodeEffect(WriteHeldEvent.payloadSchemaBinary)(held);
      const heldDecoded = yield* S.decodeEffect(WriteHeldEvent.payloadSchemaBinary)(heldBytes);
      expect(heldDecoded).toEqual(held);
      const resolvedBytes = yield* S.encodeEffect(HoldResolvedEvent.payloadSchemaBinary)(resolved);
      const resolvedDecoded = yield* S.decodeEffect(HoldResolvedEvent.payloadSchemaBinary)(resolvedBytes);
      expect(resolvedDecoded).toEqual(resolved);
    })
  );

  it.effect(
    "round-trips a node creation through the binary payload codec",
    Effect.fnUntraced(function* () {
      const payload = NodeCreated.make({
        nodeId,
        kind: "listItem",
        contentHash,
        revisionId: revisionA,
        text: "- A fact.",
        anchor: O.some(anchor),
        filePath,
        after: O.some(otherNodeId),
        author,
      });
      const codec = NodeCreatedEvent.payloadSchemaBinary;
      const bytes = yield* S.encodeEffect(codec)(payload);
      const decoded = yield* S.decodeEffect(codec)(bytes);
      expect(decoded).toEqual(payload);
    })
  );

  it.effect.prop(
    "round-trips arbitrary held writes and keys each on its hold id",
    [Arbitrary.schema(WriteHeld)],
    ([held]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(WriteHeld)(held);
        const decoded = yield* S.decodeEffect(WriteHeld)(encoded);
        assertTrue(writeHeldEquivalence(decoded, held));
        expect(WriteHeldEvent.primaryKey(decoded)).toBe(held.holdId);
      }),
    { arbitrary: { runs: 50 } }
  );

  it.effect.prop(
    "round-trips arbitrary hold resolutions",
    [Arbitrary.schema(HoldResolved)],
    ([resolved]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(HoldResolved)(resolved);
        const decoded = yield* S.decodeEffect(HoldResolved)(encoded);
        assertTrue(holdResolvedEquivalence(decoded, resolved));
      }),
    { arbitrary: { runs: 50 } }
  );

  it.effect(
    "keys observations on the node id",
    Effect.fnUntraced(function* () {
      const observation = ObservationEvent.make({
        kind: "read",
        nodeId,
        lineage: LineageId.make("session-42"),
        at: DateTime.makeUnsafe(0),
      });
      expect(ObservedEvent.primaryKey(observation)).toBe(nodeId);
      expect(R.keys(ObservationEvents.events)).toEqual(["Observed"]);
    })
  );

  it.effect(
    "carries every input of each node event's revision id in its own fields",
    Effect.fnUntraced(function* () {
      const created = NodeCreated.make({
        nodeId,
        kind: "paragraph",
        contentHash,
        revisionId: revisionA,
        text: "status: draft",
        anchor: O.some(anchor),
        filePath,
        after: O.some(otherNodeId),
        author,
      });
      const statusChanged = NodeStatusChanged.make({
        nodeId,
        revisionId: revisionB,
        parents: [created.revisionId],
        contentHash: revisedHash,
        text: "status: active",
        transition: StatusTransition.make({
          field: "status",
          from: O.some(StatusValue.make("draft")),
          to: StatusValue.make("active"),
        }),
        author,
      });
      const retired = NodeRetired.make({ nodeId, revisionId: revisionB, parents: [created.revisionId], author });

      const createdPreimage = revisionPreimage(created.nodeId, [], created.contentHash);
      const statusPreimage = revisionPreimage(statusChanged.nodeId, statusChanged.parents, statusChanged.contentHash);
      const retiredPreimage = revisionPreimage(retired.nodeId, retired.parents, TombstoneContentHash);

      expect(A.dedupe([createdPreimage, statusPreimage, retiredPreimage])).toHaveLength(3);
      expect(TombstoneContentHash).not.toBe(contentHash);
    })
  );
});
