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
import { LogCursor, NodeId, NodeKind, ReparseRefusedError } from "@beep/agent-memory-store";
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
import * as S from "effect/Schema";
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
// Revisions, retirements and inserts after a node, each, of every node kind
// the sample holds. `html` and `thematicBreak` nodes are the scarcest kinds in
// the sample (a handful of files hold them), which sets this floor; the
// common kinds take hundreds of each operation.
const PER_KIND_OPERATION_MIN = 3;
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
  O.exists(Exit.findErrorOption(exit), S.is(ReparseRefusedError));

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

type Counter = ReturnType<typeof counter>;
type Store = Effect.Success<ReturnType<typeof openStore>>;
type Picked = O.Option<readonly [number, ModelNode]>;

// The running tallies of the edit-confinement replay.
interface EditRun {
  edits: number;
  minted: number;
  outside: number;
  readonly perKind: Counter;
  readonly perOperation: Counter;
  projectChecks: number;
  projectMismatches: number;
  readonly random: () => number;
  readonly refusals: Counter;
}

// One file's edit within a round: the event to append and the span it touches.
interface FileEdit {
  readonly event: MemoryEvent;
  readonly touched: TouchedSpan;
}

// Rotate through every (kind, operation) pair of the kinds a file holds: slot
// k names kind k mod m and operation floor(k / m) mod 3, so each kind the file
// holds takes each operation and neither choice is tied to the other.
const planEdit = (
  live: ReadonlyArray<readonly [number, ModelNode]>,
  slot: number,
  random: () => number
): { readonly operation: Operation; readonly pick: Picked } => {
  const kinds = A.filter(NodeKind.literals, (kind) => A.some(live, ([, node]) => node.kind === kind));
  const width = Math.max(kinds.length, 1);
  const wanted = O.getOrElse(A.get(kinds, slot % width), () => "paragraph" as const);
  const planned = O.getOrElse(A.get(operations, Math.floor(slot / width) % operations.length), () => "insert" as const);
  const ofKind = A.filter(live, ([, node]) => node.kind === wanted);
  const pool = A.isReadonlyArrayNonEmpty(ofKind) ? ofKind : live;
  const pick = A.get(pool, Math.floor(random() * pool.length));
  const operation: Operation = O.isNone(pick) || (planned === "retire" && live.length <= 2) ? "insert" : planned;
  return { operation, pick };
};

// Insert after the picked node; one insert in ten goes to any position
// instead, tombstones, gaps and the top of the file included.
const applyInsert = Effect.fnUntraced(function* (
  run: EditRun,
  nodes: Array<ModelNode>,
  pick: Picked,
  path: MemoryFilePath,
  previous: string,
  serial: number
) {
  const anywhere = O.isNone(pick) || run.random() < 0.1;
  const position = anywhere
    ? Math.floor(run.random() * (nodes.length + 1))
    : O.match(pick, { onNone: () => 0, onSome: ([index]) => index + 1 });
  const after = O.map(A.get(nodes, position - 1), (node) => node.nodeId);
  const nodeId = NodeId.make(replayNodeId(run.minted));
  run.minted += 1;
  const kind = serial % 2 === 0 ? "paragraph" : "gap";
  const text = kind === "gap" ? "\n\n" : `Inserted note ${serial}.`;
  const insert = yield* insertEvent(nodeId, after, path, kind, text);
  // Newest first after the predecessor: the new node sits right after it.
  const start = modelText(A.take(nodes, position)).length;
  nodes.splice(position, 0, { kind, live: true, nodeId, revisionId: insert.revisionId, text });
  // An insert counts against the kind of the node it follows.
  const followed = O.getOrElse(
    O.map(pick, ([, node]) => node.kind),
    () => "top"
  );
  run.perKind.bump(anywhere ? "insert:anywhere" : `insert:${followed}`);
  const touched: TouchedSpan = { path, start, oldLength: 0, newText: text, previous, nodeId, operation: "insert" };
  return { event: insert.event, touched } satisfies FileEdit;
});

// Revise or retire the picked node in place.
const applyChange = Effect.fnUntraced(function* (
  run: EditRun,
  nodes: Array<ModelNode>,
  [index, node]: readonly [number, ModelNode],
  operation: Operation,
  path: MemoryFilePath,
  previous: string,
  serial: number
) {
  const start = modelText(A.take(nodes, index)).length;
  const text = operation === "revise" ? revisedText(node, serial) : "";
  const written =
    operation === "revise"
      ? yield* reviseEvent(node.nodeId, node.revisionId, text)
      : yield* retireEvent(node.nodeId, node.revisionId);
  nodes[index] = { ...node, live: operation === "revise", revisionId: written.revisionId, text };
  run.perKind.bump(`${operation}:${node.kind}`);
  const touched: TouchedSpan = {
    path,
    start,
    oldLength: node.text.length,
    newText: text,
    previous,
    nodeId: node.nodeId,
    operation,
  };
  return { event: written.event, touched } satisfies FileEdit;
});

// One edit of one file, chosen by the round's rotation slot.
const editFile = Effect.fnUntraced(function* (run: EditRun, model: Model, path: MemoryFilePath, slot: number) {
  const nodes = nodesOf(model, path);
  const previous = modelText(nodes);
  const live = A.filter(
    A.map(nodes, (node, index) => [index, node] as const),
    ([, node]) => node.live && Str.isNonEmpty(node.text)
  );
  const { operation, pick } = planEdit(live, slot, run.random);
  const serial = run.edits;
  const edit =
    operation === "insert" || O.isNone(pick)
      ? yield* applyInsert(run, nodes, pick, path, previous, serial)
      : yield* applyChange(run, nodes, pick.value, operation, path, previous, serial);
  run.perOperation.bump(operation);
  run.edits += 1;
  return edit;
});

// projectNode turns the same event into a raw-slice edit of the previous
// bytes, or refuses it when the reparse check fails.
const projectOutcome = Effect.fnUntraced(function* (store: Store, edit: TouchedSpan, exported: string) {
  const projected = yield* Effect.exit(store.projector.projectNode(edit.nodeId));
  if (Exit.isSuccess(projected)) {
    return MarkdownEdit.applyAll(edit.previous, [projected.value]) === exported ? "match" : "mismatch";
  }
  return isReparseRefusal(projected) ? "refused" : "mismatch";
});

// Check one touched span against the export. projectNode partitions the file
// twice, so only every fourth edit is cross-checked through it.
const checkEdit = Effect.fnUntraced(function* (
  run: EditRun,
  store: Store,
  model: Model,
  diskText: HashMap.HashMap<string, string>,
  edit: TouchedSpan,
  stride: number
) {
  const exported = O.getOrElse(HashMap.get(diskText, edit.path), () => "");
  if (!isConfined(exported, edit) || exported !== modelText(nodesOf(model, edit.path))) {
    run.outside += 1;
  }
  if (stride % PROJECT_NODE_STRIDE !== 0) {
    return;
  }
  const outcome = yield* projectOutcome(store, edit, exported);
  run.projectChecks += 1;
  if (outcome === "mismatch") {
    run.projectMismatches += 1;
  }
  if (outcome === "refused") {
    run.refusals.bump(edit.operation);
  }
});

// One round: every file takes one edit, the edits commit together, the folder
// is exported once and every touched span is checked.
const editRound = Effect.fnUntraced(function* (
  run: EditRun,
  store: Store,
  model: Model,
  paths: ReadonlyArray<MemoryFilePath>,
  folder: string,
  round: number
) {
  const edits = yield* Effect.forEach(
    A.map(paths, (path, index) => [index, path] as const),
    ([fileIndex, path]) => editFile(run, model, path, round + fileIndex)
  );
  const events = A.map(edits, (edit) => edit.event);
  yield* A.match(events, { onEmpty: () => Effect.void, onNonEmpty: store.log.appendMany });
  yield* store.projector.exportFolder(PosixPath.make(folder));
  const disk = yield* snapshotFolder(folder);
  const diskText = HashMap.fromIterable(A.map(disk, (file) => [file.path, textOf(file.bytes)] as const));
  yield* Effect.forEach(
    A.map(edits, (edit, index) => [index, edit.touched] as const),
    ([touchedIndex, touched]) => checkEdit(run, store, model, diskText, touched, round + touchedIndex),
    { discard: true }
  );
});

type InsertPair = readonly [NodeId, NodeId];

// About four in five of every third node of every file is a predecessor, gap
// nodes included; no two positions share one. Each predecessor gets one insert
// from each writer.
const concurrentInserts = Effect.fnUntraced(function* (
  model: Model,
  paths: ReadonlyArray<MemoryFilePath>,
  random: () => number
) {
  const firsts: Array<MemoryEvent> = [];
  const seconds: Array<MemoryEvent> = [];
  const pairs = MutableHashMap.empty<NodeId, InsertPair>();
  let minted = 0;
  for (const path of paths) {
    for (const [index, node] of A.map(nodesOf(model, path), (node, index) => [index, node] as const)) {
      if (index % 3 !== 0 || random() < 0.2) {
        continue;
      }
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
  return { firsts, seconds, pairs };
});

// Check one exported file against the model with every insert pair placed
// right after its predecessor.
const verifyPairs = (
  nodes: ReadonlyArray<ModelNode>,
  exported: string,
  pairs: MutableHashMap.MutableHashMap<NodeId, InsertPair>,
  pairText: (pair: InsertPair) => string
): { readonly failures: number; readonly matches: boolean; readonly positions: number } => {
  let positions = 0;
  let failures = 0;
  for (const [index, node] of A.map(nodes, (node, index) => [index, node] as const)) {
    const pair = MutableHashMap.get(pairs, node.nodeId);
    if (O.isNone(pair)) {
      continue;
    }
    positions += 1;
    // The predecessor, both inserts newest first, then its original
    // successor: nothing between them was dropped or moved.
    const successor = O.getOrElse(
      O.map(A.get(nodes, index + 1), (next) => next.text),
      () => ""
    );
    if (!Str.includes(`${node.text}${pairText(pair.value)}${successor}`)(exported)) {
      failures += 1;
    }
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
  return { failures, matches: exported === expected, positions };
};

describe.skipIf(!isBunRuntime)("MarkdownProjector AC-1 (Bun runtime)", () => {
  it.layer(TestPlatform)("goals Markdown sample", (it) => {
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
      }),
      { timeout: 120_000 }
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
        const sampleKinds = model.pipe(
          MutableHashMap.values,
          A.fromIterable,
          A.flatMap((nodes) => A.map(nodes, (node) => node.kind)),
          A.dedupe
        );
        // Every file takes one edit per round; the empty file takes inserts at the top.
        const paths = A.sort(
          A.map(sample.files, (file) => file.path as MemoryFilePath),
          Order.String
        );

        const run: EditRun = {
          edits: 0,
          minted: 0,
          outside: 0,
          perKind: counter(),
          perOperation: counter(),
          projectChecks: 0,
          projectMismatches: 0,
          random: seededRandom(SEED),
          refusals: counter(),
        };
        let round = 0;
        while (run.edits < EDIT_TARGET) {
          yield* editRound(run, store, model, paths, folder, round);
          round += 1;
        }
        const { edits, outside, perKind, perOperation, projectChecks, projectMismatches, refusals } = run;

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
        // Every node kind of the sample was revised, retired and inserted
        // after, by the node actually touched, gap nodes included.
        expect(A.sort(sampleKinds, Order.String)).toEqual(A.sort(NodeKind.literals, Order.String));
        const thin = A.filter(
          A.flatMap(sampleKinds, (kind) => A.map(operations, (operation) => `${operation}:${kind}`)),
          (key) => perKind.get(key) < PER_KIND_OPERATION_MIN
        );
        expect(thin).toEqual([]);
      }),
      { timeout: 120_000 }
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

        const { firsts, seconds, pairs } = yield* concurrentInserts(model, paths, seededRandom(SEED + 1));
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
        const pairText = (pair: InsertPair): string =>
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
          const exported = O.getOrElse(HashMap.get(diskText, path), () => "");
          const verified = verifyPairs(nodesOf(model, path), exported, pairs, pairText);
          positions += verified.positions;
          failures += verified.failures;
          if (!verified.matches) {
            fileMismatches.push(path);
          }
        }

        yield* report(`AC-1 concurrent insertions: ${failures}/${positions} read as deletions or misplaced`);
        expect(positions).toBeGreaterThanOrEqual(1_000);
        expect(failures).toBe(0);
        expect(fileMismatches).toEqual([]);
      }),
      { timeout: 120_000 }
    );
  });
});
