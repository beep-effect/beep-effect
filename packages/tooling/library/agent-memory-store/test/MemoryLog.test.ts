/**
 * Live memory log over `effect/eventlog` and `@beep/sqlite`.
 *
 * The driver imports `bun:sqlite`, so the suite runs under Bun only and is
 * skipped under Node; run it with `bunx --bun vitest`. Every test builds its
 * own database: `MemoryLogTestLayer` opens a fresh `":memory:"` database per
 * build, and the file-backed tests use a scoped temporary directory.
 */
import {
  ConflictResolution,
  ContentHash,
  FolderImported,
  HoldId,
  HoldNotOpenError,
  HoldResolved,
  LogCursor,
  MemoryFilePath,
  MemoryLog,
  MemoryLogError,
  MemoryLogTestLayer,
  makeMemoryLogSqliteLayer,
  NodeCreated,
  NodeId,
  NodeOperation,
  NodeRetired,
  NodeRevised,
  RevisionId,
  StaleParentsError,
  UnplacedNodeError,
  WriteHeld,
} from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { author, contentHash, filePath, folderDigest, staleRevision } from "./fixtures.ts";
import { TestPlatform } from "./projector-support.ts";
import type { MemoryEvent } from "@beep/agent-memory-store";

const isBunRuntime = P.isNotUndefined(process.versions.bun);

const nodeA = NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e01");
const nodeB = NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e02");
const unknownNode = NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e03");
const absentNode = NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e04");
const holdA = HoldId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6ea1");
const unknownHold = HoldId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6ea2");

const revision = (digit: string): RevisionId => RevisionId.make(Str.repeat(64)(digit));
const r1 = revision("1");
const r2 = revision("2");
const r3 = revision("3");
const r4 = revision("4");

const created = (nodeId: NodeId, revisionId: RevisionId): MemoryEvent => ({
  _tag: "NodeCreated",
  payload: NodeCreated.make({
    nodeId,
    kind: "paragraph",
    contentHash,
    revisionId,
    text: "A synthetic fact.\n",
    anchor: O.none(),
    filePath,
    after: O.none(),
    author,
  }),
});

const revised = (
  nodeId: NodeId,
  revisionId: RevisionId,
  parents: A.NonEmptyReadonlyArray<RevisionId>
): MemoryEvent => ({
  _tag: "NodeRevised",
  payload: NodeRevised.make({
    nodeId,
    revisionId,
    parents: A.copy(parents),
    contentHash: ContentHash.make(Str.repeat(64)("a")),
    text: "A revised synthetic fact.\n",
    author,
  }),
});

const retired = (
  nodeId: NodeId,
  revisionId: RevisionId,
  parents: A.NonEmptyReadonlyArray<RevisionId>
): MemoryEvent => ({
  _tag: "NodeRetired",
  payload: NodeRetired.make({ nodeId, revisionId, parents: A.copy(parents), author }),
});

const folderImported: MemoryEvent = {
  _tag: "FolderImported",
  payload: FolderImported.make({ folderDigest, fileCount: 1, nodeCount: 2, author }),
};

const writeHeld = (holdId: HoldId, nodeId: NodeId): MemoryEvent => ({
  _tag: "WriteHeld",
  payload: WriteHeld.make({
    holdId,
    operation: NodeOperation.cases.delete.make({ nodeId, expectedRevision: r1 }),
    author,
    headRevision: O.some(r2),
    violations: [staleRevision],
  }),
});

const holdResolved = (holdId: HoldId): MemoryEvent => ({
  _tag: "HoldResolved",
  payload: HoldResolved.make({
    holdId,
    resolution: ConflictResolution.cases.ours.make({}),
    author,
    revisionId: O.none(),
  }),
});

const entryShape = A.map((entry: { readonly event: string; readonly primaryKey: string }) => [
  entry.event,
  entry.primaryKey,
]);

const tempDatabase = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "beep-memory-log-" });
  return path.join(directory, "memory.db");
});

const openLog = Effect.fnUntraced(function* (filename: string) {
  const context = yield* Layer.build(makeMemoryLogSqliteLayer({ filename }));
  return Context.get(context, MemoryLog);
});

// Each call builds MemoryLogTestLayer in the test's scope: a fresh in-memory database.
const freshLog = Effect.fnUntraced(function* () {
  const context = yield* Layer.build(MemoryLogTestLayer);
  return Context.get(context, MemoryLog);
});

describe.skipIf(!isBunRuntime)("MemoryLog live layer (Bun runtime)", () => {
  it.effect(
    "a NodeCreated placed after a node of another file or after an unknown node fails with UnplacedNodeError and appends nothing",
    Effect.fnUntraced(function* () {
      const log = yield* freshLog();
      yield* log.append(created(nodeA, r1));
      const cursor = yield* log.cursor;
      const otherFile = MemoryFilePath.make("notes/other.md");
      const after = (nodeId: NodeId, revisionId: RevisionId, predecessor: NodeId, path: MemoryFilePath) => {
        const event = created(nodeId, revisionId);
        return event._tag === "NodeCreated"
          ? { ...event, payload: NodeCreated.make({ ...event.payload, filePath: path, after: O.some(predecessor) }) }
          : event;
      };

      const crossFile = yield* Effect.flip(log.append(after(nodeB, r2, nodeA, otherFile)));
      expect(crossFile).toBeInstanceOf(UnplacedNodeError);
      expect(crossFile).toMatchObject({ nodeId: nodeB, filePath: otherFile, after: nodeA });
      assertSome(S.is(UnplacedNodeError)(crossFile) ? crossFile.afterFilePath : O.none(), filePath);

      // A refused event rolls back its whole batch, earlier events included.
      const missing = yield* Effect.flip(
        log.appendMany([after(nodeB, r2, nodeA, filePath), after(unknownNode, r3, absentNode, filePath)])
      );
      expect(missing).toMatchObject({ _tag: "UnplacedNodeError", nodeId: unknownNode, after: absentNode });
      assertNone(S.is(UnplacedNodeError)(missing) ? missing.afterFilePath : O.some(filePath));
      const unchanged = yield* log.cursor;
      const headsB = yield* log.heads(nodeB);
      expect(unchanged).toBe(cursor);
      expect(headsB).toEqual([]);

      // A predecessor created earlier in the same batch places the node.
      yield* log.appendMany([after(nodeB, r2, nodeA, filePath), after(unknownNode, r3, nodeB, filePath)]);
      const placed = yield* log.heads(unknownNode);
      expect(placed).toEqual([r3]);
    })
  );

  it.effect(
    "append then heads: a created node has its root revision as head and a revision replaces it",
    Effect.fnUntraced(function* () {
      const log = yield* freshLog();
      const empty = yield* log.heads(nodeA);
      expect(empty).toEqual([]);

      yield* log.append(created(nodeA, r1));
      const root = yield* log.heads(nodeA);
      expect(root).toEqual([r1]);

      yield* log.append(revised(nodeA, r2, [r1]));
      const next = yield* log.heads(nodeA);
      const unknown = yield* log.heads(unknownNode);
      expect(next).toEqual([r2]);
      expect(unknown).toEqual([]);
    })
  );

  it.effect(
    "stale parents rejected: a revision naming a superseded or unknown head fails with StaleParentsError",
    Effect.fnUntraced(function* () {
      const log = yield* freshLog();
      yield* log.appendMany([created(nodeA, r1), revised(nodeA, r2, [r1])]);

      const stale = yield* Effect.flip(log.append(revised(nodeA, r3, [r1])));
      expect(stale).toBeInstanceOf(StaleParentsError);
      expect(stale).toMatchObject({ nodeId: nodeA, parents: [r1], heads: [r2] });

      const unknown = yield* Effect.flip(log.append(retired(unknownNode, r3, [r1])));
      expect(unknown).toMatchObject({ _tag: "StaleParentsError", nodeId: unknownNode, heads: [] });

      const heads = yield* log.heads(nodeA);
      const cursor = yield* log.cursor;
      expect(heads).toEqual([r2]);
      expect(cursor).toBe(LogCursor.make(2));
    })
  );

  it.effect(
    "NodeCreated on an existing node rejected with the node's heads",
    Effect.fnUntraced(function* () {
      const log = yield* freshLog();
      yield* log.append(created(nodeA, r1));

      const error = yield* Effect.flip(log.append(created(nodeA, r2)));
      expect(error).toBeInstanceOf(StaleParentsError);
      expect(error).toMatchObject({ nodeId: nodeA, parents: [], heads: [r1] });

      const heads = yield* log.heads(nodeA);
      expect(heads).toEqual([r1]);
    })
  );

  it.effect(
    "a batch where a later event depends on an earlier one in the same batch lands",
    Effect.fnUntraced(function* () {
      const log = yield* freshLog();
      yield* log.appendMany([created(nodeA, r1), revised(nodeA, r2, [r1]), retired(nodeA, r3, [r2])]);

      const heads = yield* log.heads(nodeA);
      const cursor = yield* log.cursor;
      expect(heads).toEqual([r3]);
      expect(cursor).toBe(LogCursor.make(3));
    })
  );

  it.effect(
    "a batch with one stale event commits nothing: heads, cursor and entries are unchanged",
    Effect.fnUntraced(function* () {
      const log = yield* freshLog();
      yield* log.append(created(nodeA, r1));
      const before = yield* log.entriesAfter(LogCursor.make(0));

      const error = yield* Effect.flip(
        log.appendMany([
          created(nodeB, r4),
          folderImported,
          writeHeld(holdA, nodeA),
          revised(nodeA, r2, [r1]),
          revised(nodeA, r3, [r1]),
        ])
      );
      expect(error).toMatchObject({ _tag: "StaleParentsError", nodeId: nodeA, parents: [r1], heads: [r2] });

      const headsA = yield* log.heads(nodeA);
      const headsB = yield* log.heads(nodeB);
      const cursor = yield* log.cursor;
      const after = yield* log.entriesAfter(LogCursor.make(0));
      expect(headsA).toEqual([r1]);
      expect(headsB).toEqual([]);
      expect(cursor).toBe(LogCursor.make(1));
      expect(entryShape(after)).toEqual(entryShape(before));

      // The hold of the failed batch never opened either.
      const notOpen = yield* Effect.flip(log.append(holdResolved(holdA)));
      expect(notOpen).toBeInstanceOf(HoldNotOpenError);
    })
  );

  it.effect(
    "HoldResolved on an unknown hold is rejected, an open hold resolves once, and a second resolve is rejected",
    Effect.fnUntraced(function* () {
      const log = yield* freshLog();
      const unknown = yield* Effect.flip(log.append(holdResolved(unknownHold)));
      expect(unknown).toBeInstanceOf(HoldNotOpenError);
      expect(unknown).toMatchObject({ holdId: unknownHold });

      yield* log.append(writeHeld(holdA, nodeA));
      yield* log.append(holdResolved(holdA));

      const closed = yield* Effect.flip(log.append(holdResolved(holdA)));
      expect(closed).toBeInstanceOf(HoldNotOpenError);
      expect(closed).toMatchObject({ holdId: holdA });

      // A repeated WriteHeld for a settled hold does not reopen it.
      yield* log.append(writeHeld(holdA, nodeA));
      const stillClosed = yield* Effect.flip(log.append(holdResolved(holdA)));
      expect(stillClosed).toBeInstanceOf(HoldNotOpenError);

      const cursor = yield* log.cursor;
      expect(cursor).toBe(LogCursor.make(3));
    })
  );

  it.effect(
    "cursor counts committed entries and entriesAfter reads them in commit order",
    Effect.fnUntraced(function* () {
      const log = yield* freshLog();
      const emptyCursor = yield* log.cursor;
      const emptyLog = yield* log.entriesAfter(LogCursor.make(0));
      expect(emptyCursor).toBe(LogCursor.make(0));
      expect(emptyLog).toEqual([]);

      yield* log.append(folderImported);
      yield* log.append(created(nodeA, r1));
      yield* log.append(created(nodeB, r2));
      yield* log.appendMany([revised(nodeB, r3, [r2]), writeHeld(holdA, nodeA)]);

      const cursor = yield* log.cursor;
      const all = yield* log.entriesAfter(LogCursor.make(0));
      const tail = yield* log.entriesAfter(LogCursor.make(3));
      const none = yield* log.entriesAfter(LogCursor.make(5));
      expect(cursor).toBe(LogCursor.make(5));
      expect(entryShape(all)).toEqual([
        ["FolderImported", folderDigest],
        ["NodeCreated", nodeA],
        ["NodeCreated", nodeB],
        ["NodeRevised", nodeB],
        ["WriteHeld", holdA],
      ]);
      expect(entryShape(tail)).toEqual([
        ["NodeRevised", nodeB],
        ["WriteHeld", holdA],
      ]);
      expect(none).toEqual([]);
    })
  );

  it.effect(
    "history reads only the entries keyed by one node, oldest first",
    Effect.fnUntraced(function* () {
      const log = yield* freshLog();
      yield* log.append(folderImported);
      yield* log.append(created(nodeA, r1));
      yield* log.append(created(nodeB, r2));
      yield* log.append(writeHeld(holdA, nodeA));
      yield* log.append(revised(nodeA, r3, [r1]));
      yield* log.append(retired(nodeB, r4, [r2]));
      yield* log.append(retired(nodeA, r4, [r3]));

      const historyA = yield* log.history(nodeA);
      const historyB = yield* log.history(nodeB);
      const historyUnknown = yield* log.history(unknownNode);
      expect(entryShape(historyA)).toEqual([
        ["NodeCreated", nodeA],
        ["NodeRevised", nodeA],
        ["NodeRetired", nodeA],
      ]);
      expect(entryShape(historyB)).toEqual([
        ["NodeCreated", nodeB],
        ["NodeRetired", nodeB],
      ]);
      expect(historyUnknown).toEqual([]);
    })
  );

  it.layer(TestPlatform)("database files", (it) => {
    it.effect(
      "two connections to one database file both try the same compare-and-set and exactly one wins",
      Effect.fnUntraced(function* () {
        const filename = yield* tempDatabase;
        const first = yield* openLog(filename);
        const second = yield* openLog(filename);

        yield* first.append(created(nodeA, r1));
        // Both connections observe the same head before either writes.
        const seenByFirst = yield* first.heads(nodeA);
        const seenBySecond = yield* second.heads(nodeA);
        expect(seenByFirst).toEqual([r1]);
        expect(seenBySecond).toEqual([r1]);

        const exits = yield* Effect.all(
          [Effect.exit(first.append(revised(nodeA, r2, [r1]))), Effect.exit(second.append(revised(nodeA, r3, [r1])))],
          { concurrency: "unbounded" }
        );
        const wins = A.filter(exits, Exit.isSuccess);
        const losses = A.getSomes(A.map(exits, Exit.findErrorOption));
        expect(wins).toHaveLength(1);
        expect(losses).toHaveLength(1);
        // The loser either waited for the winner's commit and saw its head, or
        // timed out on the write lock; both are typed and commit nothing.
        expect(A.every(losses, S.is(S.Union([StaleParentsError, MemoryLogError])))).toBe(true);

        const winner = Exit.isSuccess(exits[0]) ? r2 : r3;
        const headsFirst = yield* first.heads(nodeA);
        const headsSecond = yield* second.heads(nodeA);
        const cursorFirst = yield* first.cursor;
        const cursorSecond = yield* second.cursor;
        expect(headsFirst).toEqual([winner]);
        expect(headsSecond).toEqual([winner]);
        expect(cursorFirst).toBe(LogCursor.make(2));
        expect(cursorSecond).toBe(LogCursor.make(2));

        // Sequentially, a connection that names the replaced head is refused.
        const stale = yield* Effect.flip(second.append(revised(nodeA, r4, [r1])));
        expect(stale).toMatchObject({ _tag: "StaleParentsError", heads: [winner] });
      })
    );

    it.effect(
      "a database write lock held by another connection fails the append with MemoryLogError and commits nothing",
      Effect.fnUntraced(function* () {
        const filename = yield* tempDatabase;
        const driver = yield* Effect.promise(() => import("@beep/sqlite"));
        const holderContext = yield* Layer.build(driver.makeLayer({ filename }));
        const holder = Context.get(holderContext, SqlClient.SqlClient);
        const logContext = yield* Layer.build(makeMemoryLogSqliteLayer({ filename, busyTimeout: 0 }));
        const log = Context.get(logContext, MemoryLog);

        yield* holder.unsafe("BEGIN IMMEDIATE");
        const error = yield* Effect.flip(log.append(created(nodeA, r1)));
        yield* holder.unsafe("COMMIT");
        expect(error).toBeInstanceOf(MemoryLogError);
        expect(error).toMatchObject({ operation: "append" });

        const cursor = yield* log.cursor;
        expect(cursor).toBe(LogCursor.make(0));
        yield* log.append(created(nodeA, r1));
        const heads = yield* log.heads(nodeA);
        expect(heads).toEqual([r1]);
      })
    );

    it.effect(
      "reopening the database file preserves heads, cursor and entries",
      Effect.fnUntraced(function* () {
        const filename = yield* tempDatabase;
        const before = yield* Effect.scoped(
          Effect.gen(function* () {
            const log = yield* openLog(filename);
            yield* log.appendMany([created(nodeA, r1), revised(nodeA, r2, [r1]), writeHeld(holdA, nodeA)]);
            yield* log.append(created(nodeB, r3));
            const entries = yield* log.entriesAfter(LogCursor.make(0));
            return entryShape(entries);
          })
        );

        const log = yield* openLog(filename);
        const headsA = yield* log.heads(nodeA);
        const headsB = yield* log.heads(nodeB);
        const cursor = yield* log.cursor;
        const entries = yield* log.entriesAfter(LogCursor.make(0));
        const historyA = yield* log.history(nodeA);
        expect(headsA).toEqual([r2]);
        expect(headsB).toEqual([r3]);
        expect(cursor).toBe(LogCursor.make(4));
        expect(entryShape(entries)).toEqual(before);
        expect(entryShape(historyA)).toEqual([
          ["NodeCreated", nodeA],
          ["NodeRevised", nodeA],
        ]);

        // The reopened tables still enforce the compare-and-set and the open hold.
        const stale = yield* Effect.flip(log.append(revised(nodeA, r4, [r1])));
        expect(stale).toBeInstanceOf(StaleParentsError);
        yield* log.append(holdResolved(holdA));
        yield* log.append(revised(nodeA, r4, [r2]));
        const reopenedCursor = yield* log.cursor;
        expect(reopenedCursor).toBe(LogCursor.make(6));
      })
    );
  });
});
