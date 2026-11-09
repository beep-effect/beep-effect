import {
  ContentHash,
  FolderImported,
  FolderImportedEvent,
  LineageId,
  MemoryEvents,
  MemoryLogSchema,
  NodeCreated,
  NodeCreatedEvent,
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
  StatusTransition,
  StatusValue,
  TombstoneContentHash,
} from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { anchor, contentHash, filePath, folderDigest, nodeId, revisionA, revisionB } from "./fixtures.ts";

const revisedHash = ContentHash.make("5555555555555555555555555555555555555555555555555555555555555555");

describe("NodeEvent events", () => {
  it.effect(
    "exposes every memory event tag through the log schema",
    Effect.fnUntraced(function* () {
      expect(MemoryLogSchema.groups).toEqual([MemoryEvents]);
      expect(A.sort(R.keys(MemoryEvents.events), Order.String)).toEqual([
        "FolderImported",
        "NodeCreated",
        "NodeRetired",
        "NodeRevised",
        "NodeStatusChanged",
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
            anchor,
            filePath,
          })
        )
      ).toBe(nodeId);
      expect(
        NodeRevisedEvent.primaryKey(
          NodeRevised.make({ nodeId, revisionId: revisionB, parents: [revisionA], contentHash, text: "A new fact." })
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
          })
        )
      ).toBe(nodeId);
      expect(
        NodeRetiredEvent.primaryKey(NodeRetired.make({ nodeId, revisionId: revisionB, parents: [revisionA] }))
      ).toBe(nodeId);
    })
  );

  it.effect(
    "keys a folder import on the folder digest",
    Effect.fnUntraced(function* () {
      const imported = FolderImported.make({ folderDigest, fileCount: 2, nodeCount: 7 });
      expect(FolderImportedEvent.primaryKey(imported)).toBe(folderDigest);
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
        anchor,
        filePath,
      });
      const codec = NodeCreatedEvent.payloadSchemaBinary;
      const bytes = yield* S.encodeEffect(codec)(payload);
      const decoded = yield* S.decodeEffect(codec)(bytes);
      expect(decoded).toEqual(payload);
    })
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
        anchor,
        filePath,
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
      });
      const retired = NodeRetired.make({ nodeId, revisionId: revisionB, parents: [created.revisionId] });

      const createdPreimage = revisionPreimage(created.nodeId, [], created.contentHash);
      const statusPreimage = revisionPreimage(statusChanged.nodeId, statusChanged.parents, statusChanged.contentHash);
      const retiredPreimage = revisionPreimage(retired.nodeId, retired.parents, TombstoneContentHash);

      expect(A.dedupe([createdPreimage, statusPreimage, retiredPreimage])).toHaveLength(3);
      expect(TombstoneContentHash).not.toBe(contentHash);
    })
  );
});
