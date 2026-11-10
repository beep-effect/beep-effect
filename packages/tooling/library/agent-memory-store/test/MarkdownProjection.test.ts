/**
 * The projector's in-memory fold: folding keeps the cursor in step with the
 * entries it applied, and a node folded again keeps its one place.
 *
 * The suite runs under Bun only (the SQLite driver imports `bun:sqlite`).
 */
import { LogCursor, MemoryFilePath, MemoryLog, MemoryLogTestLayer, NodeId } from "@beep/agent-memory-store";
import {
  applyEntries,
  fileNodes,
  joinText,
  makeProjection,
} from "@beep/agent-memory-store/internal/MarkdownProjection";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as EventJournal from "effect/eventlog/EventJournal";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { insertEvent, isBunRuntime, replayNodeId, TestPlatform } from "./projector-support.ts";

const notes = MemoryFilePath.make("notes.md");

// Three nodes of one file, committed to a fresh in-memory log.
const committedEntries = Effect.fnUntraced(function* () {
  const context = yield* Layer.build(MemoryLogTestLayer);
  const log = Context.get(context, MemoryLog);
  const first = NodeId.make(replayNodeId(1));
  const second = NodeId.make(replayNodeId(2));
  const third = NodeId.make(replayNodeId(3));
  const a = yield* insertEvent(first, O.none(), notes, "paragraph", "First.");
  const b = yield* insertEvent(second, O.some(first), notes, "gap", "\n\n");
  const c = yield* insertEvent(third, O.some(second), notes, "paragraph", "Third.\n");
  yield* log.appendMany([a.event, b.event, c.event]);
  return yield* log.entriesAfter(LogCursor.make(0));
});

describe.skipIf(!isBunRuntime)("MarkdownProjection fold (Bun runtime)", () => {
  it.layer(TestPlatform)("folding", (it) => {
    it.effect(
      "folding the same entries twice lists each node once and keeps the file text",
      Effect.fnUntraced(function* () {
        const entries = yield* committedEntries();
        const projection = makeProjection();
        yield* applyEntries(projection, entries);
        const once = fileNodes(projection, notes);
        yield* applyEntries(projection, entries);
        const twice = fileNodes(projection, notes);
        expect(A.map(twice, (node) => node.nodeId)).toEqual(A.map(once, (node) => node.nodeId));
        expect(once).toHaveLength(3);
        expect(joinText(twice)).toBe("First.\n\nThird.\n");
      })
    );

    it.effect(
      "a fold that stops at an entry it cannot decode leaves the cursor after the last folded entry, and resuming there completes the file",
      Effect.fnUntraced(function* () {
        const entries = yield* committedEntries();
        const damaged = A.map(entries, (entry, index) =>
          index === 1 ? EventJournal.Entry.make({ ...entry, payload: new Uint8Array([0xc1]) }) : entry
        );
        const projection = makeProjection();
        const failed = yield* Effect.flip(applyEntries(projection, damaged));
        expect(failed._tag).toBe("SchemaError");
        expect(projection.cursor).toBe(LogCursor.make(1));
        expect(joinText(fileNodes(projection, notes))).toBe("First.");

        yield* applyEntries(projection, A.drop(entries, projection.cursor));
        expect(projection.cursor).toBe(LogCursor.make(3));
        expect(A.map(fileNodes(projection, notes), (node) => node.text)).toEqual(["First.", "\n\n", "Third.\n"]);
      })
    );
  });
});
