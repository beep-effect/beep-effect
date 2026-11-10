/**
 * AC-8 nonempty-folder import and the projector's refusals, the second-import
 * rule, the memory-file rule and `projectNode`.
 *
 * The AC-8 cases import the frozen goals Markdown sample
 * (`fixtures/goals-markdown-sample.json.gz`, 172 files); the other cases use
 * small synthetic folders. Labeller: the agent-memory-store-p1 lane wrote
 * every fixture and expectation here; it is the only labeller.
 *
 * The suite runs under Bun only (the SQLite driver imports `bun:sqlite`).
 */
import {
  ConflictResolution,
  FolderImportedEvent,
  ForeignFolderError,
  HoldId,
  HoldResolved,
  isMemoryFilePath,
  LogCursor,
  MarkdownProjector,
  MemoryFilePath,
  makeMarkdownStoreSqliteLayer,
  NodeId,
  NodeOperation,
  ProjectionError,
  ReparseRefusedError,
  UnimportedFolderError,
  WriteHeld,
} from "@beep/agent-memory-store";
import { MarkdownEdit } from "@beep/markdown";
import { PosixPath } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { loadGoalsMarkdownSample, writeSampleFolder } from "./fixtures/goals-markdown-sample.ts";
import { author, staleRevision } from "./fixtures.ts";
import {
  createdNodes,
  fileSystemRunningFirst,
  insertEvent,
  isBunRuntime,
  makeSpy,
  openStore,
  replayNodeId,
  reviseEvent,
  snapshotFolder,
  spiedFileSystem,
  statusEvent,
  TestPlatform,
  tempDirectory,
  textOf,
} from "./projector-support.ts";

const writeFiles = Effect.fnUntraced(function* (root: string, files: ReadonlyArray<readonly [string, string]>) {
  const fs = yield* FileSystem.FileSystem;
  for (const [path, text] of files) {
    const target = `${root}/${path}`;
    const directory = O.match(Str.lastIndexOf("/")(target), {
      onNone: () => root,
      onSome: (cut) => Str.slice(0, cut)(target),
    });
    yield* fs.makeDirectory(directory, { recursive: true });
    yield* fs.writeFileString(target, text);
  }
});

const folderImportCount = (entries: ReadonlyArray<{ readonly event: string }>): number =>
  A.filter(entries, (entry) => entry.event === FolderImportedEvent.tag).length;

describe("isMemoryFilePath", () => {
  it("accepts .md paths and refuses other extensions and dot segments", () => {
    expect(isMemoryFilePath("MEMORY.md")).toBe(true);
    expect(isMemoryFilePath("notes/decisions.md")).toBe(true);
    expect(isMemoryFilePath("notes/decisions.txt")).toBe(false);
    expect(isMemoryFilePath("notes/README.MD")).toBe(false);
    expect(isMemoryFilePath(".git/notes.md")).toBe(false);
    expect(isMemoryFilePath("notes/.decisions.md.agent-memory-store-tmp")).toBe(false);
    expect(isMemoryFilePath("notes/.swap.md")).toBe(false);
    expect(isMemoryFilePath("../escape.md")).toBe(false);
    expect(isMemoryFilePath("/abs.md")).toBe(false);
    expect(isMemoryFilePath("notes//x.md")).toBe(false);
    expect(isMemoryFilePath("notes\\x.md")).toBe(false);
  });
});

describe.skipIf(!isBunRuntime)("MarkdownProjector AC-8 (Bun runtime)", () => {
  it.layer(TestPlatform)("memory folders", (it) => {
    it.effect(
      "AC-8 nonempty-folder import: every file is imported before any projection, the folder is untouched, and the re-export is byte-identical",
      Effect.fnUntraced(function* () {
        const sample = yield* loadGoalsMarkdownSample;
        const workspace = yield* tempDirectory("beep-ac8-import-");
        const folder = `${workspace}/memory`;
        yield* writeSampleFolder(folder, sample.files);
        const before = yield* snapshotFolder(folder);

        const spy = makeSpy();
        const store = yield* openStore(`${workspace}/memory.db`, spiedFileSystem(spy));
        const imported = yield* store.projector.importFolder(PosixPath.make(folder));
        const afterImport = yield* snapshotFolder(folder);
        const entries = yield* store.log.entriesAfter(LogCursor.make(0));

        // The import wrote nothing and recorded every file before any export ran.
        expect(spy.writes).toBe(0);
        expect(afterImport).toEqual(before);
        expect(imported.files).toHaveLength(sample.files.length);
        expect(folderImportCount(entries)).toBe(1);
        assertSome(
          O.map(A.last(entries), (entry) => entry.event),
          FolderImportedEvent.tag
        );

        const exported = yield* store.projector.exportFolder(PosixPath.make(folder));
        const afterExport = yield* snapshotFolder(folder);
        expect(spy.writes).toBe(0);
        expect(afterExport).toEqual(before);
        expect(exported.folderDigest).toBe(imported.folderDigest);
      }),
      { timeout: 60_000 }
    );

    it.effect(
      "AC-8 failed import inside the journal transaction: an abort part-way leaves every file byte-identical and the log without the folder",
      Effect.fnUntraced(function* () {
        const sample = yield* loadGoalsMarkdownSample;
        const workspace = yield* tempDirectory("beep-ac8-abort-");
        const folder = `${workspace}/memory`;
        yield* writeSampleFolder(folder, sample.files);
        const before = yield* snapshotFolder(folder);
        const store = yield* openStore(`${workspace}/memory.db`);

        // Abort the import's journal transaction on its 5,000th committed entry.
        yield* store.sql.unsafe(`
          CREATE TRIGGER inject_import_failure BEFORE INSERT ON agent_memory_order
          WHEN NEW.sequence = 5000
          BEGIN SELECT RAISE(ABORT, 'injected import failure'); END`);
        const error = yield* Effect.flip(store.projector.importFolder(PosixPath.make(folder)));
        expect(error).toBeInstanceOf(ProjectionError);
        expect(error).toMatchObject({ operation: "importFolder" });

        const after = yield* snapshotFolder(folder);
        const cursor = yield* store.log.cursor;
        const entries = yield* store.log.entriesAfter(LogCursor.make(0));
        expect(after).toEqual(before);
        expect(cursor).toBe(LogCursor.make(0));
        expect(folderImportCount(entries)).toBe(0);

        // With nothing claimed, the projector still refuses the folder, and a
        // retry once the fault is gone imports it.
        const refused = yield* Effect.flip(store.projector.exportFolder(PosixPath.make(folder)));
        expect(refused).toBeInstanceOf(UnimportedFolderError);
        yield* store.sql.unsafe("DROP TRIGGER inject_import_failure");
        const retried = yield* store.projector.importFolder(PosixPath.make(folder));
        expect(retried.files).toHaveLength(sample.files.length);
      }),
      { timeout: 60_000 }
    );

    it.effect(
      "AC-8 failed import while reading the folder: a read failure part-way leaves every file byte-identical and the log empty",
      Effect.fnUntraced(function* () {
        const sample = yield* loadGoalsMarkdownSample;
        const workspace = yield* tempDirectory("beep-ac8-read-");
        const folder = `${workspace}/memory`;
        yield* writeSampleFolder(folder, sample.files);
        const before = yield* snapshotFolder(folder);
        const spy = makeSpy();
        spy.failReadAt = O.some(Math.floor(sample.files.length / 2));
        const store = yield* openStore(`${workspace}/memory.db`, spiedFileSystem(spy));

        const error = yield* Effect.flip(store.projector.importFolder(PosixPath.make(folder)));
        expect(error).toBeInstanceOf(ProjectionError);
        const after = yield* snapshotFolder(folder);
        const cursor = yield* store.log.cursor;
        expect(after).toEqual(before);
        expect(cursor).toBe(LogCursor.make(0));
        expect(spy.writes).toBe(0);
      }),
      { timeout: 60_000 }
    );

    it.effect(
      "AC-8 export refusal: exportFolder on a folder the log has not imported fails with UnimportedFolderError and replaces or empties no file",
      Effect.fnUntraced(function* () {
        const sample = yield* loadGoalsMarkdownSample;
        const workspace = yield* tempDirectory("beep-ac8-refuse-");
        const folder = `${workspace}/memory`;
        yield* writeSampleFolder(folder, sample.files);
        const before = yield* snapshotFolder(folder);
        const spy = makeSpy();
        const store = yield* openStore(`${workspace}/memory.db`, spiedFileSystem(spy));

        // An empty log has imported nothing, so even an existing folder is refused.
        const empty = yield* Effect.flip(store.projector.exportFolder(PosixPath.make(folder)));
        expect(empty).toBeInstanceOf(UnimportedFolderError);
        assertSome(S.is(UnimportedFolderError)(empty) ? empty.root : O.none(), PosixPath.make(folder));
        expect(spy.writes + spy.renames).toBe(0);
        const snapshot1 = yield* snapshotFolder(folder);
        expect(snapshot1).toEqual(before);

        // Once the log holds this folder, a different folder is still refused:
        // one file shares a path with an imported file but not its bytes, one
        // matches an imported file exactly.
        yield* store.projector.importFolder(PosixPath.make(folder));
        const other = `${workspace}/other`;
        const shared = O.getOrThrow(A.findFirst(sample.files, (file) => file.text.length > 0));
        yield* writeFiles(other, [
          [shared.path, `${shared.text}\nA line this log never imported.\n`],
          ["MEMORY.md", "# Another repository's index\n"],
        ]);
        const otherBefore = yield* snapshotFolder(other);
        const foreign = yield* Effect.flip(store.projector.exportFolder(PosixPath.make(other)));
        expect(foreign).toBeInstanceOf(UnimportedFolderError);
        expect(spy.writes + spy.renames).toBe(0);
        const snapshot2 = yield* snapshotFolder(other);
        expect(snapshot2).toEqual(otherBefore);

        const exact = `${workspace}/exact`;
        yield* writeFiles(exact, [
          [shared.path, shared.text],
          ["MEMORY.md", "# Another repository's index\n"],
        ]);
        const exactBefore = yield* snapshotFolder(exact);
        const partial = yield* Effect.flip(store.projector.exportFolder(PosixPath.make(exact)));
        expect(partial).toBeInstanceOf(UnimportedFolderError);
        expect(spy.writes + spy.renames).toBe(0);
        const snapshot3 = yield* snapshotFolder(exact);
        expect(snapshot3).toEqual(exactBefore);

        // A different folder whose only memory file matches an imported file
        // byte for byte is still not the imported folder: the fence is bound
        // to the folder, so nothing is replaced and no file is created.
        const copy = `${workspace}/copy`;
        yield* writeFiles(copy, [[shared.path, shared.text]]);
        const copyBefore = yield* snapshotFolder(copy);
        const copied = yield* Effect.flip(store.projector.exportFolder(PosixPath.make(copy)));
        expect(copied).toBeInstanceOf(UnimportedFolderError);
        expect(spy.writes + spy.renames).toBe(0);
        const snapshot5 = yield* snapshotFolder(copy);
        expect(snapshot5).toEqual(copyBefore);
      }),
      { timeout: 60_000 }
    );
  });
});

describe.skipIf(!isBunRuntime)("MarkdownProjector import rules and projectNode (Bun runtime)", () => {
  it.layer(TestPlatform)("synthetic folders", (it) => {
    it.effect(
      "a second import of the imported folder appends nothing and returns the current base; a foreign folder is refused",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-reimport-");
        const folder = `${workspace}/memory`;
        yield* writeFiles(folder, [
          ["MEMORY.md", "# Index\n\n- [Decisions](notes/decisions.md)\n"],
          ["notes/decisions.md", "Paragraph one.\n\nParagraph two.\n"],
        ]);
        const store = yield* openStore(`${workspace}/memory.db`);
        const first = yield* store.projector.importFolder(PosixPath.make(folder));
        const second = yield* store.projector.importFolder(PosixPath.make(folder));
        expect(second.cursor).toBe(first.cursor);
        expect(second.folderDigest).toBe(first.folderDigest);
        const entries = yield* store.log.entriesAfter(LogCursor.make(0));
        expect(folderImportCount(entries)).toBe(1);

        const other = `${workspace}/other`;
        yield* writeFiles(other, [["MEMORY.md", "# Someone else's index\n"]]);
        const refused = yield* Effect.flip(store.projector.importFolder(PosixPath.make(other)));
        expect(refused).toBeInstanceOf(ForeignFolderError);
        expect(refused).toMatchObject({ root: other });
        const cursor = yield* store.log.cursor;
        expect(cursor).toBe(first.cursor);
      })
    );

    it.effect(
      "a first import that loses the race to the same folder's import returns that import's base and appends nothing",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-import-race-same-");
        const folder = `${workspace}/memory`;
        yield* writeFiles(folder, [["MEMORY.md", "# Index\n\n- one\n"]]);
        const database = `${workspace}/memory.db`;
        const winner = yield* openStore(database);
        // The loser catches up on an empty log; the winner's import commits
        // before the loser's first read, so the loser appends a second first import.
        let won = O.none<{ readonly cursor: LogCursor; readonly folderDigest: string }>();
        const loser = yield* openStore(
          database,
          fileSystemRunningFirst(
            Effect.map(winner.projector.importFolder(PosixPath.make(folder)), (base) => {
              won = O.some(base);
            })
          )
        );
        const lost = yield* loser.projector.importFolder(PosixPath.make(folder));
        assertSome(
          O.map(won, (base) => [base.cursor, base.folderDigest]),
          [lost.cursor, lost.folderDigest]
        );
        const entries = yield* loser.log.entriesAfter(LogCursor.make(0));
        expect(folderImportCount(entries)).toBe(1);
        const created = yield* createdNodes(entries);
        expect(created).toHaveLength(4);

        yield* loser.projector.exportFolder(PosixPath.make(folder));
        const files = yield* snapshotFolder(folder);
        expect(A.map(files, (file) => textOf(file.bytes))).toEqual(["# Index\n\n- one\n"]);
      })
    );

    it.effect(
      "a first import that loses the race to another folder's import fails with ForeignFolderError",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-import-race-other-");
        const mine = `${workspace}/mine`;
        const theirs = `${workspace}/theirs`;
        yield* writeFiles(mine, [["MEMORY.md", "# Mine\n"]]);
        yield* writeFiles(theirs, [["MEMORY.md", "# Theirs\n"]]);
        const database = `${workspace}/memory.db`;
        const winner = yield* openStore(database);
        const loser = yield* openStore(
          database,
          fileSystemRunningFirst(winner.projector.importFolder(PosixPath.make(mine)))
        );
        const refused = yield* Effect.flip(loser.projector.importFolder(PosixPath.make(theirs)));
        expect(refused).toBeInstanceOf(ForeignFolderError);
        expect(refused).toMatchObject({ root: theirs });
        const entries = yield* loser.log.entriesAfter(LogCursor.make(0));
        expect(folderImportCount(entries)).toBe(1);
      })
    );

    it.effect(
      "a folder of more files than one fence insert holds is recorded whole: its second import returns the base",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-import-chunks-");
        const folder = `${workspace}/memory`;
        yield* writeFiles(
          folder,
          A.makeBy(301, (index) => [`notes/note-${index}.md`, `Note ${index}.\n`] as const)
        );
        const store = yield* openStore(`${workspace}/memory.db`);
        const first = yield* store.projector.importFolder(PosixPath.make(folder));
        expect(first.files).toHaveLength(301);
        const known = yield* store.sql.unsafe<{ readonly rows: number }>(
          "SELECT COUNT(*) AS rows FROM agent_memory_folder_files"
        );
        expect(known).toEqual([{ rows: 301 }]);
        const second = yield* store.projector.importFolder(PosixPath.make(folder));
        expect(second.folderDigest).toBe(first.folderDigest);
        expect(second.cursor).toBe(first.cursor);
      })
    );

    it.effect(
      "a log entry whose file path breaks the memory-file rule fails export with ProjectionError before anything is written",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-export-escape-");
        const folder = `${workspace}/memory`;
        yield* writeFiles(folder, [["MEMORY.md", "# Memory\n"]]);
        const database = `${workspace}/memory.db`;
        const store = yield* openStore(database);
        yield* store.projector.importFolder(PosixPath.make(folder));
        const insert = yield* insertEvent(
          NodeId.make(replayNodeId(1)),
          O.none(),
          MemoryFilePath.make("aa/escape.md"),
          "paragraph",
          "Escaped."
        );
        yield* store.log.append(insert.event);
        // Rewrite the committed payload in place, the way a writer that skips
        // the schema or a damaged database would: the path now leaves the folder.
        yield* store.sql.unsafe(
          "UPDATE agent_memory_journal SET payload = CAST(replace(CAST(payload AS TEXT), 'aa/escape.md', '../escape.md') AS BLOB) WHERE event = 'NodeCreated'"
        );
        const before = yield* snapshotFolder(workspace);

        const fresh = yield* openStore(database);
        const refused = yield* Effect.flip(fresh.projector.exportFolder(PosixPath.make(folder)));
        expect(refused).toBeInstanceOf(ProjectionError);
        expect(refused).toMatchObject({ operation: "exportFolder" });
        const after = yield* snapshotFolder(workspace);
        expect(A.map(after, (file) => file.path)).toEqual(A.map(before, (file) => file.path));
        expect(A.some(after, (file) => Str.endsWith("escape.md")(file.path))).toBe(false);
      })
    );

    it.effect(
      "a foreign folder whose only memory file matches an imported file byte for byte is refused by export and by import",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-foreign-copy-");
        const mine = `${workspace}/mine`;
        const theirs = `${workspace}/theirs`;
        yield* writeFiles(mine, [
          ["MEMORY.md", "# Memory\n"],
          ["notes.md", "Private note.\n"],
        ]);
        yield* writeFiles(theirs, [["MEMORY.md", "# Memory\n"]]);
        const store = yield* openStore(`${workspace}/memory.db`);
        yield* store.projector.importFolder(PosixPath.make(mine));
        const entries = yield* store.log.entriesAfter(LogCursor.make(0));
        const created = yield* createdNodes(entries);
        const heading = O.getOrThrow(A.findFirst(created, ([, node]) => node.text === "# Memory"))[1];
        const revise = yield* reviseEvent(heading.nodeId, heading.revisionId, "# Memory of repo A");
        yield* store.log.append(revise.event);

        const before = yield* snapshotFolder(theirs);
        const exported = yield* Effect.flip(store.projector.exportFolder(PosixPath.make(theirs)));
        expect(exported).toBeInstanceOf(UnimportedFolderError);
        const imported = yield* Effect.flip(store.projector.importFolder(PosixPath.make(theirs)));
        expect(imported).toBeInstanceOf(ForeignFolderError);
        const after = yield* snapshotFolder(theirs);
        expect(after).toEqual(before);

        // The imported folder itself still exports, under any spelling of its path.
        yield* store.projector.exportFolder(PosixPath.make(`${workspace}/theirs/../mine`));
        const projected = yield* snapshotFolder(mine);
        expect(A.map(projected, (file) => textOf(file.bytes))).toEqual(["# Memory of repo A\n", "Private note.\n"]);
      })
    );

    it.effect(
      "only .md files outside dot segments are imported; other files are never read into the log or written",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-memory-files-");
        const folder = `${workspace}/memory`;
        yield* writeFiles(folder, [
          ["MEMORY.md", "# Index\n"],
          ["notes/a.md", "A.\n"],
          ["notes/scratch.txt", "not memory\n"],
          ["notes/UPPER.MD", "not memory either\n"],
          [".hidden/secret.md", "hidden\n"],
        ]);
        const before = yield* snapshotFolder(folder);
        const store = yield* openStore(`${workspace}/memory.db`);
        const base = yield* store.projector.importFolder(PosixPath.make(folder));
        expect(A.map(base.files, (file) => file.path)).toEqual(["MEMORY.md", "notes/a.md"]);
        yield* store.projector.exportFolder(PosixPath.make(folder));
        const snapshot4 = yield* snapshotFolder(folder);
        expect(snapshot4).toEqual(before);
      })
    );

    it.effect(
      "an empty memory folder imports with a FolderImported record and re-exports nothing",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-empty-folder-");
        const folder = `${workspace}/memory`;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(folder, { recursive: true });
        const store = yield* openStore(`${workspace}/memory.db`);
        const base = yield* store.projector.importFolder(PosixPath.make(folder));
        expect(base.files).toEqual([]);
        expect(base.cursor).toBe(LogCursor.make(1));
        const exported = yield* store.projector.exportFolder(PosixPath.make(folder));
        expect(exported.files).toEqual([]);
      })
    );

    it.effect(
      "a missing folder or a file that is not UTF-8 fails the import with ProjectionError and appends nothing",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-bad-import-");
        const store = yield* openStore(`${workspace}/memory.db`);
        const missing = yield* Effect.flip(store.projector.importFolder(PosixPath.make(`${workspace}/absent`)));
        expect(missing).toBeInstanceOf(ProjectionError);

        const fs = yield* FileSystem.FileSystem;
        const folder = `${workspace}/memory`;
        yield* fs.makeDirectory(folder, { recursive: true });
        yield* fs.writeFile(`${folder}/broken.md`, new Uint8Array([0x23, 0x20, 0xff, 0xfe, 0x0a]));
        const broken = yield* Effect.flip(store.projector.importFolder(PosixPath.make(folder)));
        expect(broken).toBeInstanceOf(ProjectionError);
        assertSome(S.is(ProjectionError)(broken) ? broken.path : O.none(), MemoryFilePath.make("broken.md"));
        const cursor = yield* store.log.cursor;
        expect(cursor).toBe(LogCursor.make(0));
      })
    );

    it.effect(
      "projectNode returns the raw-slice edit of a revision and of an insert, which brings the file up to the export",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-project-node-");
        const folder = `${workspace}/memory`;
        const text = "# Notes\n\n- one\n- two\n\nClosing paragraph.\n";
        yield* writeFiles(folder, [["notes.md", text]]);
        const store = yield* openStore(`${workspace}/memory.db`);
        yield* store.projector.importFolder(PosixPath.make(folder));
        const entries = yield* store.log.entriesAfter(LogCursor.make(0));
        const created = yield* createdNodes(entries);
        const two = O.getOrThrow(A.findFirst(created, ([, node]) => node.text === "- two"))[1];

        const revise = yield* reviseEvent(two.nodeId, two.revisionId, "- two, revised");
        yield* store.log.append(revise.event);
        const edit = yield* store.projector.projectNode(two.nodeId);
        expect(edit).toEqual(
          MarkdownEdit.make({ offset: O.getOrThrow(Str.indexOf("- two")(text)), length: 5, content: "- two, revised" })
        );
        const revised = MarkdownEdit.applyAll(text, [edit]);
        yield* store.projector.exportFolder(PosixPath.make(folder));
        const afterRevise = yield* snapshotFolder(folder);
        expect(A.map(afterRevise, (file) => textOf(file.bytes))).toEqual([revised]);

        const gap = NodeId.make(replayNodeId(1));
        const item = NodeId.make(replayNodeId(2));
        const gapInsert = yield* insertEvent(gap, O.some(two.nodeId), two.filePath, "gap", "\n");
        const itemInsert = yield* insertEvent(item, O.some(gap), two.filePath, "listItem", "- three");
        yield* store.log.appendMany([gapInsert.event, itemInsert.event]);
        const insertion = yield* store.projector.projectNode(item);
        const offset = O.getOrThrow(Str.indexOf("- two, revised")(revised)) + "- two, revised".length + 1;
        expect(insertion).toEqual(MarkdownEdit.make({ offset, length: 0, content: "- three" }));
        yield* store.projector.exportFolder(PosixPath.make(folder));
        const afterInsert = yield* snapshotFolder(folder);
        expect(A.map(afterInsert, (file) => textOf(file.bytes))).toEqual([
          "# Notes\n\n- one\n- two, revised\n- three\n\nClosing paragraph.\n",
        ]);
      })
    );

    it.effect(
      "a root spelled with a trailing slash names the same folder, and a directory named like a memory file is not read as one",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-root-spelling-");
        const folder = `${workspace}/memory`;
        yield* writeFiles(folder, [
          ["top.md", "Top note.\n"],
          ["archive.md/inner.md", "Inner note.\n"],
        ]);
        const store = yield* openStore(`${workspace}/memory.db`);
        const imported = yield* store.projector.importFolder(PosixPath.make(`${folder}/`));
        expect(A.map(imported.files, (file) => file.path)).toEqual(["archive.md/inner.md", "top.md"]);

        const copy = `${workspace}/copy/`;
        const exported = yield* store.projector.exportFolder(PosixPath.make(copy));
        expect(exported.folderDigest).toBe(imported.folderDigest);
        const copied = yield* snapshotFolder(copy);
        expect(A.map(copied, (file) => [file.path, textOf(file.bytes)])).toEqual([
          ["archive.md/inner.md", "Inner note.\n"],
          ["top.md", "Top note.\n"],
        ]);
      })
    );

    it.effect(
      "a file the parser rejects imports as one paragraph node and exports byte for byte",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-import-unparsed-");
        const folder = `${workspace}/memory`;
        const deep = `${Str.repeat(300)("> ")}deep\n`;
        yield* writeFiles(folder, [["deep.md", deep]]);
        const store = yield* openStore(`${workspace}/memory.db`);
        yield* store.projector.importFolder(PosixPath.make(folder));
        const entries = yield* store.log.entriesAfter(LogCursor.make(0));
        const created = yield* createdNodes(entries);
        expect(A.map(created, ([, node]) => [node.kind, node.text])).toEqual([["paragraph", deep]]);

        const copy = `${workspace}/copy`;
        yield* store.projector.exportFolder(PosixPath.make(copy));
        const copied = yield* snapshotFolder(copy);
        expect(A.map(copied, (file) => textOf(file.bytes))).toEqual([deep]);
      })
    );

    it.effect(
      "a NodeStatusChanged event rewrites its node in the export and projectNode, and a held write with its resolution changes nothing",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-project-status-");
        const folder = `${workspace}/memory`;
        yield* writeFiles(folder, [["tasks.md", "# Tasks\n\nstatus: active\n"]]);
        const store = yield* openStore(`${workspace}/memory.db`);
        yield* store.projector.importFolder(PosixPath.make(folder));
        const entries = yield* store.log.entriesAfter(LogCursor.make(0));
        const created = yield* createdNodes(entries);
        const status = O.getOrThrow(A.findFirst(created, ([, node]) => node.text === "status: active"))[1];

        const moved = yield* statusEvent(status.nodeId, status.revisionId, "status: completed", "active", "completed");
        const holdId = HoldId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6eb1");
        yield* store.log.appendMany([
          moved.event,
          {
            _tag: "WriteHeld",
            payload: WriteHeld.make({
              holdId,
              operation: NodeOperation.cases.delete.make({
                nodeId: status.nodeId,
                expectedRevision: status.revisionId,
              }),
              author,
              headRevision: O.some(moved.revisionId),
              violations: [staleRevision],
            }),
          },
          {
            _tag: "HoldResolved",
            payload: HoldResolved.make({
              holdId,
              resolution: ConflictResolution.cases.ours.make({}),
              author,
              revisionId: O.none(),
            }),
          },
        ]);

        const edit = yield* store.projector.projectNode(status.nodeId);
        expect(MarkdownEdit.applyAll("# Tasks\n\nstatus: active\n", [edit])).toBe("# Tasks\n\nstatus: completed\n");
        yield* store.projector.exportFolder(PosixPath.make(folder));
        const files = yield* snapshotFolder(folder);
        expect(A.map(files, (file) => textOf(file.bytes))).toEqual(["# Tasks\n\nstatus: completed\n"]);
      })
    );

    it.effect(
      "makeMarkdownStoreSqliteLayer opens the log and the projector on one database file: an import there re-exports byte for byte",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-markdown-store-layer-");
        const folder = `${workspace}/memory`;
        yield* writeFiles(folder, [["MEMORY.md", "# Memory\n\n- one\n- two\n"]]);
        const context = yield* Layer.build(makeMarkdownStoreSqliteLayer({ filename: `${workspace}/memory.db` }));
        const projector = Context.get(context, MarkdownProjector);
        const imported = yield* projector.importFolder(PosixPath.make(folder));
        const copy = `${workspace}/copy`;
        const exported = yield* projector.exportFolder(PosixPath.make(copy));
        expect(exported.folderDigest).toBe(imported.folderDigest);
        const copied = yield* snapshotFolder(copy);
        expect(A.map(copied, (file) => textOf(file.bytes))).toEqual(["# Memory\n\n- one\n- two\n"]);
      })
    );

    it.effect(
      "projectNode refuses with ReparseRefusedError an edit that changes how a neighbouring node parses",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-project-refuse-");
        const folder = `${workspace}/memory`;
        yield* writeFiles(folder, [["notes.md", "First paragraph.\n\nSecond paragraph.\n"]]);
        const store = yield* openStore(`${workspace}/memory.db`);
        yield* store.projector.importFolder(PosixPath.make(folder));
        const entries = yield* store.log.entriesAfter(LogCursor.make(0));
        const created = yield* createdNodes(entries);
        const separator = O.getOrThrow(A.findFirst(created, ([, node]) => node.text === "\n\n"))[1];

        // One newline joins the two paragraphs into one.
        const revise = yield* reviseEvent(separator.nodeId, separator.revisionId, "\n");
        yield* store.log.append(revise.event);
        const refused = yield* Effect.flip(store.projector.projectNode(separator.nodeId));
        expect(refused).toBeInstanceOf(ReparseRefusedError);
        expect(refused).toMatchObject({ nodeId: separator.nodeId, path: separator.filePath, disturbed: [0, 2] });
      })
    );

    it.effect(
      "projectNode fails with UnimportedFolderError when the log holds the node but no folder import, and with ProjectionError for an unknown node",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-project-unimported-");
        const store = yield* openStore(`${workspace}/memory.db`);
        const unknown = yield* Effect.flip(store.projector.projectNode(NodeId.make(replayNodeId(9))));
        expect(unknown).toBeInstanceOf(ProjectionError);

        const nodeId = NodeId.make(replayNodeId(1));
        const insert = yield* insertEvent(nodeId, O.none(), MemoryFilePath.make("notes/a.md"), "paragraph", "A fact.");
        yield* store.log.append(insert.event);
        const refused = yield* Effect.flip(store.projector.projectNode(nodeId));
        expect(refused).toBeInstanceOf(UnimportedFolderError);
        // projectNode names no folder, so the refusal names none.
        const named = S.is(UnimportedFolderError)(refused)
          ? O.orElse(refused.root, () => O.map(refused.folderDigest, String))
          : O.some("not an UnimportedFolderError");
        assertNone(named);
      })
    );
  });
});
