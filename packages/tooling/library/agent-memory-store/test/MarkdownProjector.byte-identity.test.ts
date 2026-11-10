/**
 * AC-1 byte identity, edit confinement and concurrent insertions on the
 * frozen goals Markdown sample.
 *
 * Fixture: `fixtures/goals-markdown-sample.json.gz`, 172 files (167 tracked
 * `goals/**` Markdown files in eleven structural strata plus 5 synthetic edge
 * files), 1,065,752 Markdown bytes, 386,973 bytes packed, sampled at commit
 * baf225131bd. Labeller: the agent-memory-store-p1 lane built the fixture,
 * chose its strata and wrote the edit generator; it is the only labeller.
 *
 * The suite runs under Bun only (the SQLite driver imports `bun:sqlite`).
 * Set `BEEP_TEST_AGENT_MEMORY_REPORT` to a file path to append the measured
 * numbers there; the tests assert them either way.
 */
import { LogCursor, NodeId, NodeKind } from "@beep/agent-memory-store";
import { MarkdownEdit } from "@beep/markdown";
import { PosixPath } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as EventJournal from "effect/eventlog/EventJournal";
import * as HashMap from "effect/HashMap";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { loadGoalsMarkdownSample, sampleBytes, writeSampleFolder } from "./fixtures/goals-markdown-sample.ts";
import {
  createdNodes,
  importedFiles,
  insertEvent,
  isBunRuntime,
  makeSpy,
  openStore,
  replayNodeId,
  report,
  retireEvent,
  reviseEvent,
  seededRandom,
  snapshotFolder,
  spiedFileSystem,
  TestPlatform,
  tempDirectory,
  textOf,
} from "./projector-support.ts";
import type { MemoryEvent, MemoryFilePath, RevisionId } from "@beep/agent-memory-store";
import type { EntryId } from "effect/eventlog/EventJournal";

// One node of the test's own model of a file.
interface ModelNode {
  readonly kind: NodeKind;
  readonly live: boolean;
  readonly nodeId: NodeId;
  readonly revisionId: RevisionId;
  readonly text: string;
}

type Model = MutableHashMap.MutableHashMap<MemoryFilePath, Array<ModelNode>>;

// One applied edit: the file before it and the span it replaced.
interface TouchedSpan {
  readonly newText: string;
  readonly nodeId: NodeId;
  readonly oldLength: number;
  readonly operation: Operation;
  readonly path: MemoryFilePath;
  readonly previous: string;
  readonly start: number;
}

type Operation = "revise" | "insert" | "retire";

const EDIT_TARGET = 3_000;
const PROJECT_NODE_STRIDE = 4;
const SEED = 20_261_110;
const operations: ReadonlyArray<Operation> = ["revise", "insert", "retire"];

const modelText = (nodes: ReadonlyArray<ModelNode>): string =>
  A.join(
    A.map(nodes, (node) => node.text),
    ""
  );

const nodesOf = (model: Model, path: MemoryFilePath): Array<ModelNode> =>
  O.getOrElse(MutableHashMap.get(model, path), () => {
    const nodes: Array<ModelNode> = [];
    MutableHashMap.set(model, path, nodes);
    return nodes;
  });

const isReparseRefusal = (exit: Exit.Exit<unknown, unknown>): boolean =>
  O.exists(
    Exit.findErrorOption(exit),
    (error) => P.hasProperty(error, "operation") && error.operation === "reparseCheck"
  );

const counter = () => {
  const counts = MutableHashMap.empty<string, number>();
  return {
    bump: (key: string) => MutableHashMap.set(counts, key, O.getOrElse(MutableHashMap.get(counts, key), () => 0) + 1),
    get: (key: string) => O.getOrElse(MutableHashMap.get(counts, key), () => 0),
    format: () =>
      A.join(
        A.map(
          counts.pipe(MutableHashMap.keys, A.fromIterable, A.sort(Order.String)),
          (key) => `${key} ${O.getOrElse(MutableHashMap.get(counts, key), () => 0)}`
        ),
        ", "
      ),
  };
};

// The model of every file after import: NodeCreated events in commit order,
// which for an import is document order within each file.
const modelFromLog = Effect.fnUntraced(function* (entries: ReadonlyArray<EventJournal.Entry>) {
  const created = yield* createdNodes(entries);
  const model: Model = MutableHashMap.empty();
  for (const [, payload] of created) {
    nodesOf(model, payload.filePath).push({
      kind: payload.kind,
      live: true,
      nodeId: payload.nodeId,
      revisionId: payload.revisionId,
      text: payload.text,
    });
  }
  return model;
});

// Insert `line` before the last line of a multi-line node, or append it.
const beforeLastLine = (text: string, line: string): string =>
  O.match(Str.lastIndexOf("\n")(text), {
    onNone: () => `${text} ${line}`,
    onSome: (cut) => `${Str.slice(0, cut)(text)}\n${line}${Str.slice(cut)(text)}`,
  });

// A kind-preserving revision of a node's text, so most edits keep their parse.
const revisedText = (node: ModelNode, serial: number): string =>
  NodeKind.match(node.kind, {
    gap: () => `${node.text}\n`,
    codeFence: () => beforeLastLine(node.text, `edit ${serial}`),
    frontmatter: () => beforeLastLine(node.text, `edit: "${serial}"`),
    thematicBreak: () => (node.text === "* * *" ? "- - -" : "* * *"),
    html: () => `${node.text}<!-- edit ${serial} -->`,
    heading: () => `${node.text} edit ${serial}`,
    paragraph: () => `${node.text} edit ${serial}`,
    listItem: () => `${node.text} edit ${serial}`,
    tableRow: () => `${node.text} edit ${serial}`,
  });

// The export differs from the previous bytes only inside the touched span.
const isConfined = (exported: string, edit: TouchedSpan): boolean =>
  Str.slice(0, edit.start)(exported) === Str.slice(0, edit.start)(edit.previous) &&
  Str.slice(edit.start + edit.newText.length)(exported) === Str.slice(edit.start + edit.oldLength)(edit.previous) &&
  Str.slice(edit.start, edit.start + edit.newText.length)(exported) === edit.newText;

describe.skipIf(!isBunRuntime)("MarkdownProjector AC-1 (Bun runtime)", () => {
  it.layer(TestPlatform, { timeout: "120 seconds" })("goals Markdown sample", (it) => {
    it.effect(
      "AC-1 byte identity: import then export reproduces every byte of every sample file, and a rebuild from the log alone matches every FileImported digest",
      Effect.fnUntraced(function* () {
        const sample = yield* loadGoalsMarkdownSample;
        expect(sample.files).toHaveLength(172);
        expect(sampleBytes(sample.files)).toBe(1_065_752);

        const workspace = yield* tempDirectory("beep-ac1-identity-");
        const folder = `${workspace}/memory`;
        const database = `${workspace}/memory.db`;
        yield* writeSampleFolder(folder, sample.files);
        const before = yield* snapshotFolder(folder);

        const spy = makeSpy();
        const store = yield* openStore(database, spiedFileSystem(spy));
        const imported = yield* store.projector.importFolder(PosixPath.make(folder));
        const exported = yield* store.projector.exportFolder(PosixPath.make(folder));
        const after = yield* snapshotFolder(folder);

        // Export over the imported folder writes nothing: every file already matches.
        expect(spy.writes).toBe(0);
        expect(spy.renames).toBe(0);
        expect(after).toEqual(before);
        expect(exported.folderDigest).toBe(imported.folderDigest);
        expect(A.map(exported.files, (file) => file.path)).toEqual(A.map(before, (file) => file.path));

        // Rebuild from the log alone: a fresh projector over the same database,
        // exporting into an empty folder.
        const rebuilt = `${workspace}/rebuilt`;
        const fresh = yield* openStore(database);
        const rebuiltBase = yield* fresh.projector.exportFolder(PosixPath.make(rebuilt));
        const rebuiltFiles = yield* snapshotFolder(rebuilt);
        const entries = yield* fresh.log.entriesAfter(LogCursor.make(0));
        const records = yield* importedFiles(entries);

        const sourceBytes = HashMap.fromIterable(A.map(before, (file) => [file.path, file.bytes] as const));
        const identical = A.filter(rebuiltFiles, (file) =>
          O.exists(HashMap.get(sourceBytes, file.path), (bytes) => Buffer.compare(bytes, file.bytes) === 0)
        );
        const recordDigests = HashMap.fromIterable(
          A.map(records, (record) => [record.filePath, record.fileDigest] as const)
        );
        const digestMatches = A.filter(rebuiltBase.files, (file) =>
          O.exists(HashMap.get(recordDigests, file.path), (digest) => digest === file.fileDigest)
        );
        const emptyRecord = A.findFirst(records, (record) => record.filePath === "synthetic/empty.md");

        yield* report(`AC-1 byte identity: ${identical.length}/${rebuiltFiles.length} rebuilt files identical`);
        expect(rebuiltFiles).toHaveLength(172);
        expect(identical).toHaveLength(172);
        expect(records).toHaveLength(172);
        expect(digestMatches).toHaveLength(172);
        expect(rebuiltBase.folderDigest).toBe(imported.folderDigest);
        // The empty file has its record and its rebuilt empty file.
        assertSome(
          O.map(emptyRecord, (record) => record.nodeCount),
          0
        );
      })
    );

    it.effect(
      `AC-1 edit confinement: at least ${EDIT_TARGET} node edits (revise, insert, retire) across every node kind change the export only inside the touched node's span`,
      Effect.fnUntraced(function* () {
        const sample = yield* loadGoalsMarkdownSample;
        const workspace = yield* tempDirectory("beep-ac1-edits-");
        const folder = `${workspace}/memory`;
        yield* writeSampleFolder(folder, sample.files);
        const store = yield* openStore(`${workspace}/memory.db`);
        yield* store.projector.importFolder(PosixPath.make(folder));
        const imported = yield* store.log.entriesAfter(LogCursor.make(0));
        const model = yield* modelFromLog(imported);
        // Every file takes one edit per round; the empty file takes inserts at the top.
        const paths = A.sort(
          A.map(sample.files, (file) => file.path as MemoryFilePath),
          Order.String
        );

        const random = seededRandom(SEED);
        const perKind = counter();
        const perOperation = counter();
        const refusals = counter();
        let edits = 0;
        let outside = 0;
        let projectChecks = 0;
        let projectMismatches = 0;
        let minted = 0;
        let round = 0;

        while (edits < EDIT_TARGET) {
          const events: Array<MemoryEvent> = [];
          const touched: Array<TouchedSpan> = [];
          for (const [fileIndex, path] of A.map(paths, (path, index) => [index, path] as const)) {
            const nodes = nodesOf(model, path);
            const previous = modelText(nodes);
            const live = A.filter(
              A.map(nodes, (node, index) => [index, node] as const),
              ([, node]) => node.live && Str.isNonEmpty(node.text)
            );
            // Rotate the target kind so every kind present in the file is edited.
            const wanted = O.getOrElse(
              A.get(NodeKind.literals, (round + fileIndex) % NodeKind.literals.length),
              () => "paragraph" as const
            );
            const ofKind = A.filter(live, ([, node]) => node.kind === wanted);
            const pool = A.isReadonlyArrayNonEmpty(ofKind) ? ofKind : live;
            const planned = O.getOrElse(
              A.get(operations, (round + fileIndex) % operations.length),
              () => "insert" as const
            );
            const pick = A.get(pool, Math.floor(random() * pool.length));
            const operation: Operation =
              O.isNone(pick) || (planned === "retire" && live.length <= 2) ? "insert" : planned;
            const serial = edits;

            if (operation === "insert" || O.isNone(pick)) {
              // Insert after a random node of any kind, tombstones and gaps
              // included, or at the top of the file.
              const position = Math.floor(random() * (nodes.length + 1));
              const after = O.map(A.get(nodes, position - 1), (node) => node.nodeId);
              const nodeId = NodeId.make(replayNodeId(minted));
              minted += 1;
              const kind = serial % 2 === 0 ? "paragraph" : "gap";
              const text = kind === "gap" ? "\n\n" : `Inserted note ${serial}.`;
              const insert = yield* insertEvent(nodeId, after, path, kind, text);
              events.push(insert.event);
              // Newest first after the predecessor: the new node sits right after it.
              const start = modelText(A.take(nodes, position)).length;
              nodes.splice(position, 0, { kind, live: true, nodeId, revisionId: insert.revisionId, text });
              touched.push({ path, start, oldLength: 0, newText: text, previous, nodeId, operation });
              perKind.bump(wanted);
            } else {
              const [index, node] = pick.value;
              const start = modelText(A.take(nodes, index)).length;
              const text = operation === "revise" ? revisedText(node, serial) : "";
              const written =
                operation === "revise"
                  ? yield* reviseEvent(node.nodeId, node.revisionId, text)
                  : yield* retireEvent(node.nodeId, node.revisionId);
              events.push(written.event);
              nodes[index] = { ...node, live: operation === "revise", revisionId: written.revisionId, text };
              touched.push({
                path,
                start,
                oldLength: node.text.length,
                newText: text,
                previous,
                nodeId: node.nodeId,
                operation,
              });
              perKind.bump(node.kind);
            }
            perOperation.bump(operation);
            edits += 1;
          }

          yield* A.match(events, { onEmpty: () => Effect.void, onNonEmpty: store.log.appendMany });
          yield* store.projector.exportFolder(PosixPath.make(folder));
          const disk = yield* snapshotFolder(folder);
          const diskText = HashMap.fromIterable(A.map(disk, (file) => [file.path, textOf(file.bytes)] as const));

          for (const [touchedIndex, edit] of A.map(touched, (edit, index) => [index, edit] as const)) {
            const exported = O.getOrElse(HashMap.get(diskText, edit.path), () => "");
            if (!isConfined(exported, edit) || exported !== modelText(nodesOf(model, edit.path))) {
              outside += 1;
            }
            // projectNode turns the same event into a raw-slice edit of the
            // previous bytes, or refuses it when the reparse check fails. It
            // partitions the file twice, so every fourth edit is cross-checked.
            if ((round + touchedIndex) % PROJECT_NODE_STRIDE === 0) {
              const projected = yield* Effect.exit(store.projector.projectNode(edit.nodeId));
              projectChecks += 1;
              if (Exit.isSuccess(projected)) {
                if (MarkdownEdit.applyAll(edit.previous, [projected.value]) !== exported) {
                  projectMismatches += 1;
                }
              } else if (isReparseRefusal(projected)) {
                refusals.bump(edit.operation);
              } else {
                projectMismatches += 1;
              }
            }
          }
          round += 1;
        }

        const bound = 3 / edits;
        const refused = refusals.get("revise") + refusals.get("insert") + refusals.get("retire");
        yield* report(
          `AC-1 edit confinement: n=${edits} edits in ${round} rounds, ${outside} outside the span, 3/n=${bound}; ` +
            `projectNode checked ${projectChecks}, ${projectMismatches} mismatches, ${refused} reparse refusals (${refusals.format()}); ` +
            `per kind ${perKind.format()}; per operation ${perOperation.format()}`
        );
        expect(edits).toBeGreaterThanOrEqual(EDIT_TARGET);
        expect(outside).toBe(0);
        expect(bound).toBeLessThanOrEqual(0.001);
        expect(projectMismatches).toBe(0);
        expect(projectChecks).toBeGreaterThanOrEqual(edits / PROJECT_NODE_STRIDE - 1);
        // Every node kind took edits, gap nodes included.
        expect(A.filter(NodeKind.literals, (kind) => perKind.get(kind) === 0)).toEqual([]);
      })
    );

    it.effect(
      "AC-1 concurrent insertions: two inserts written against one base by two connections and naming the same predecessor both appear, newest first, and neither reads as a deletion (0/n)",
      Effect.fnUntraced(function* () {
        const sample = yield* loadGoalsMarkdownSample;
        const workspace = yield* tempDirectory("beep-ac1-concurrent-");
        const folder = `${workspace}/memory`;
        const database = `${workspace}/memory.db`;
        yield* writeSampleFolder(folder, sample.files);
        const first = yield* openStore(database);
        const second = yield* openStore(database);
        yield* first.projector.importFolder(PosixPath.make(folder));
        const cursor = yield* first.log.cursor;
        const imported = yield* first.log.entriesAfter(LogCursor.make(0));
        const model = yield* modelFromLog(imported);
        const paths = model.pipe(MutableHashMap.keys, A.fromIterable, A.sort(Order.String));

        // About four in five of every third node of every file is a
        // predecessor, gap nodes included; no two positions share one.
        const random = seededRandom(SEED + 1);
        const firsts: Array<MemoryEvent> = [];
        const seconds: Array<MemoryEvent> = [];
        const pairs = MutableHashMap.empty<NodeId, readonly [NodeId, NodeId]>();
        let minted = 0;
        for (const path of paths) {
          for (const [index, node] of A.map(nodesOf(model, path), (node, index) => [index, node] as const)) {
            if (index % 3 === 0 && random() >= 0.2) {
              const left = NodeId.make(replayNodeId(minted));
              const right = NodeId.make(replayNodeId(minted + 1));
              minted += 2;
              const leftInsert = yield* insertEvent(left, O.some(node.nodeId), path, "paragraph", `Left ${minted}.`);
              const rightInsert = yield* insertEvent(right, O.some(node.nodeId), path, "paragraph", `Right ${minted}.`);
              firsts.push(leftInsert.event);
              seconds.push(rightInsert.event);
              MutableHashMap.set(pairs, node.nodeId, [left, right]);
            }
          }
        }
        // Both writers build their inserts against the same base before either
        // commits. The appends then commit one after the other: bun:sqlite waits
        // for a busy lock synchronously, so two connections in one process that
        // interleave inside a transaction would block the thread that holds it.
        yield* A.match(firsts, { onEmpty: () => Effect.void, onNonEmpty: first.log.appendMany });
        yield* A.match(seconds, { onEmpty: () => Effect.void, onNonEmpty: second.log.appendMany });

        // The decision orders same-predecessor nodes newest first by journal
        // entry order, so the expected files come from the committed entry ids.
        const appended = yield* first.log.entriesAfter(cursor);
        const inserted = yield* createdNodes(appended);
        const entryOf = HashMap.fromIterable(
          A.map(inserted, ([entry, payload]) => [payload.nodeId, entry.id] as const)
        );
        const insertedText = HashMap.fromIterable(
          A.map(inserted, ([, payload]) => [payload.nodeId, payload.text] as const)
        );
        const newestFirst = Order.mapInput(
          Order.flip(EventJournal.EntryIdOrder),
          (nodeId: NodeId): EntryId => O.getOrThrow(HashMap.get(entryOf, nodeId))
        );
        const pairText = (pair: readonly [NodeId, NodeId]): string =>
          A.join(
            A.map(A.sort(pair, newestFirst), (nodeId) => O.getOrThrow(HashMap.get(insertedText, nodeId))),
            ""
          );

        yield* first.projector.exportFolder(PosixPath.make(folder));
        const disk = yield* snapshotFolder(folder);
        const diskText = HashMap.fromIterable(A.map(disk, (file) => [file.path, textOf(file.bytes)] as const));

        let positions = 0;
        let failures = 0;
        const fileMismatches: Array<MemoryFilePath> = [];
        for (const path of paths) {
          const nodes = nodesOf(model, path);
          const exported = O.getOrElse(HashMap.get(diskText, path), () => "");
          for (const [index, node] of A.map(nodes, (node, index) => [index, node] as const)) {
            O.map(MutableHashMap.get(pairs, node.nodeId), (pair) => {
              positions += 1;
              // The predecessor, both inserts newest first, then its original
              // successor: nothing between them was dropped or moved.
              const successor = O.getOrElse(
                O.map(A.get(nodes, index + 1), (next) => next.text),
                () => ""
              );
              if (!Str.includes(`${node.text}${pairText(pair)}${successor}`)(exported)) {
                failures += 1;
              }
            });
          }
          const expected = A.join(
            A.map(nodes, (node) =>
              O.match(MutableHashMap.get(pairs, node.nodeId), {
                onNone: () => node.text,
                onSome: (pair) => `${node.text}${pairText(pair)}`,
              })
            ),
            ""
          );
          if (exported !== expected) {
            fileMismatches.push(path);
          }
        }

        yield* report(`AC-1 concurrent insertions: ${failures}/${positions} read as deletions or misplaced`);
        expect(positions).toBeGreaterThanOrEqual(1_000);
        expect(failures).toBe(0);
        expect(fileMismatches).toEqual([]);
      })
    );
  });
});
