/**
 * The agent write path end to end: exportFolder gives a base, agents edit
 * their copies of the exported files, op capture turns each edit into node
 * operations against that base, admission judges them and the projector
 * exports the log back into the memory folder. Labeller: the
 * agent-memory-store-p2 integration lane, which wrote every fixture text in
 * this file. The suite runs under Bun only (the SQLite driver imports
 * `bun:sqlite`).
 */
import {
  Admission,
  admitEdits,
  CaptureEditRefusedError,
  FileEdit,
  LineageId,
  MarkdownProjector,
  StatusFields,
  StatusLifecycle,
  StatusValue,
  seededNodeIdMinter,
  writeEdits,
} from "@beep/agent-memory-store";
import { PosixPath } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { isBunRuntime, TestPlatform, tempDirectory } from "./projector-support.ts";
import { memoryWritingStoreLayer } from "./write-path-support.ts";
import type { AdmissionOutcome } from "@beep/agent-memory-store";

const statusFields = StatusFields.make({
  lifecycles: [
    StatusLifecycle.make({
      field: "status",
      order: [StatusValue.make("pending"), StatusValue.make("in-progress"), StatusValue.make("complete")],
    }),
  ],
});

const writerA = LineageId.make("agent-memory-store-p2:write-path-a");
const writerB = LineageId.make("agent-memory-store-p2:write-path-b");

const notes = A.join(
  [
    "# Notes\n",
    "\n",
    "First paragraph, as exported.\n",
    "\n",
    "Second paragraph, as exported.\n",
    "\n",
    "| Phase | Status |\n",
    "| --- | --- |\n",
    "| P2 Admission | pending |\n",
  ],
  ""
);

const edited = (from: string, to: string) =>
  FileEdit.cases.edited.make({ path: "notes.md", text: Str.replace(from, to)(notes) });

const outcomeKinds = (outcomes: ReadonlyArray<AdmissionOutcome>) => A.map(outcomes, (outcome) => outcome.outcome);

// A memory folder holding `notes.md`, imported into the block's fresh store.
const importedNotes = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const projector = yield* MarkdownProjector;
  const workspace = yield* tempDirectory("beep-write-path-");
  const root = PosixPath.make(`${workspace}/memory`);
  yield* fs.makeDirectory(root, { recursive: true });
  yield* fs.writeFileString(`${root}/notes.md`, notes);
  const base = yield* projector.importFolder(root);
  return { base, fs, root };
});

const options = (author: LineageId, seed: number) => ({ author, statusFields, mintNodeId: seededNodeIdMinter(seed) });

// Each block gets its own store: a store imports one folder once.
const freshStore = () => Layer.mergeAll(TestPlatform, memoryWritingStoreLayer(statusFields));

describe.skipIf(!isBunRuntime)("agent write path (Bun runtime)", () => {
  it.layer(freshStore(), { timeout: "60 seconds" })("two writers on different nodes", (it) => {
    it.effect(
      "two agents starting from one base and editing different nodes of one file both land, and the export holds both edits byte for byte",
      Effect.fnUntraced(function* () {
        const { base, fs, root } = yield* importedNotes();
        const admission = yield* Admission;
        const editA = edited("First paragraph, as exported.", "First paragraph, revised by writer A.");
        const editB = edited("Second paragraph, as exported.", "Second paragraph, revised by writer B.");

        const first = yield* writeEdits(root, base, [editA], options(writerA, 1));
        const second = yield* writeEdits(root, base, [editB], options(writerB, 2));

        expect(outcomeKinds(first.write.outcomes)).toEqual(["landed"]);
        expect(outcomeKinds(second.write.outcomes)).toEqual(["landed"]);
        const expected = Str.replace(
          "Second paragraph, as exported.",
          "Second paragraph, revised by writer B."
        )(Str.replace("First paragraph, as exported.", "First paragraph, revised by writer A.")(notes));
        const onDisk = yield* fs.readFileString(`${root}/notes.md`);
        expect(onDisk).toBe(expected);
        const exportedText = A.join(
          A.flatMap(second.exported.files, (file) => A.map(file.nodes, (node) => node.anchor.anchor.quote)),
          ""
        );
        expect(exportedText).toBe(expected);
        const held = yield* admission.held;
        expect(held).toEqual([]);
      }),
      { timeout: 60_000 }
    );
  });

  it.layer(freshStore(), { timeout: "60 seconds" })("typed status moves", (it) => {
    it.effect(
      "a status cell edit is submitted as a typed status move and judged against the log head",
      Effect.fnUntraced(function* () {
        const { base, fs, root } = yield* importedNotes();
        const admission = yield* Admission;
        const complete = yield* writeEdits(root, base, [edited("| pending |", "| complete |")], options(writerA, 3));
        // Writer B moves the same cell forward from the same base, but the log
        // already holds a later value: the lifecycle guard refuses the move.
        const behind = yield* writeEdits(root, base, [edited("| pending |", "| in-progress |")], options(writerB, 4));

        assertSome(
          O.map(complete.write.batch, (batch) => A.map(batch.operations, (operation) => operation.op)),
          ["setStatus"]
        );
        expect(outcomeKinds(complete.write.outcomes)).toEqual(["landed"]);
        expect(outcomeKinds(behind.write.outcomes)).toEqual(["rejected"]);
        expect(
          A.flatMap(behind.write.outcomes, (outcome) =>
            outcome.outcome === "rejected" ? A.map(outcome.violations, (violation) => violation.code) : []
          )
        ).toEqual(["backwardStatusMove"]);
        const onDisk = yield* fs.readFileString(`${root}/notes.md`);
        expect(onDisk).toBe(Str.replace("| pending |", "| complete |")(notes));
        const held = yield* admission.held;
        expect(held).toEqual([]);
      }),
      { timeout: 60_000 }
    );
  });

  it.layer(freshStore(), { timeout: "60 seconds" })("one contested node", (it) => {
    it.effect(
      "a contested node is held with both texts and the export keeps the text that landed first",
      Effect.fnUntraced(function* () {
        const { base, fs, root } = yield* importedNotes();
        const admission = yield* Admission;
        const textA = "First paragraph, revised by writer A.";
        const textB = "First paragraph, revised by writer B.";
        yield* writeEdits(root, base, [edited("First paragraph, as exported.", textA)], options(writerA, 5));
        const contested = yield* writeEdits(
          root,
          base,
          [edited("First paragraph, as exported.", textB)],
          options(writerB, 6)
        );

        expect(outcomeKinds(contested.write.outcomes)).toEqual(["held"]);
        const onDisk = yield* fs.readFileString(`${root}/notes.md`);
        expect(onDisk).toBe(Str.replace("First paragraph, as exported.", textA)(notes));
        const held = yield* admission.held;
        deepStrictEqual(
          A.map(held, (conflict) => [conflict.ours, conflict.theirs]),
          [[O.some(textA), O.some(textB)]]
        );
      }),
      { timeout: 60_000 }
    );
  });

  it.layer(freshStore(), { timeout: "60 seconds" })("removed and empty created files", (it) => {
    it.effect(
      "a removed file stays as an empty file that is edited again, never created; an empty created file is refused",
      Effect.fnUntraced(function* () {
        const { base, fs, root } = yield* importedNotes();
        const removed = yield* writeEdits(
          root,
          base,
          [FileEdit.cases.removed.make({ path: "notes.md" })],
          options(writerA, 8)
        );
        const emptied = yield* fs.readFileString(`${root}/notes.md`);
        const emptyCreated = yield* Effect.flip(
          admitEdits(removed.exported, [FileEdit.cases.created.make({ path: "new.md", text: "" })], options(writerA, 9))
        );
        const recreated = yield* Effect.flip(
          admitEdits(
            removed.exported,
            [FileEdit.cases.created.make({ path: "notes.md", text: notes })],
            options(writerA, 10)
          )
        );
        const refilled = yield* writeEdits(
          root,
          removed.exported,
          [FileEdit.cases.edited.make({ path: "notes.md", text: notes })],
          options(writerA, 11)
        );

        expect(A.every(removed.write.outcomes, (outcome) => outcome.outcome === "landed")).toBe(true);
        expect(A.map(removed.exported.files, (file) => [file.path, file.nodes.length])).toEqual([["notes.md", 0]]);
        assertInstanceOf(emptyCreated, CaptureEditRefusedError);
        expect(emptyCreated.reason).toBe("emptyCreatedFile");
        assertInstanceOf(recreated, CaptureEditRefusedError);
        expect(recreated.reason).toBe("baseFileExists");
        expect(emptied).toBe("");
        expect(A.every(refilled.write.outcomes, (outcome) => outcome.outcome === "landed")).toBe(true);
        const onDisk = yield* fs.readFileString(`${root}/notes.md`);
        expect(onDisk).toBe(notes);
      }),
      { timeout: 60_000 }
    );
  });

  it.layer(freshStore(), { timeout: "60 seconds" })("an unchanged edit", (it) => {
    it.effect(
      "an edit that changes nothing submits no batch",
      Effect.fnUntraced(function* () {
        const { base } = yield* importedNotes();
        const unchanged = yield* admitEdits(
          base,
          [FileEdit.cases.edited.make({ path: "notes.md", text: notes })],
          options(writerA, 7)
        );
        assertNone(unchanged.batch);
        expect(unchanged.outcomes).toEqual([]);
      }),
      { timeout: 60_000 }
    );
  });
});
