/**
 * The adversarial replay behind AC-2 and AC-3: each run admits every writer of
 * the fixture (`admission-fixture.ts`) in a seeded order on a fresh store,
 * then exports, and an oracle that never reads admission's own judgment
 * checks the result.
 *
 * The loss oracle, independent of the admission code: a writer's submitted
 * text for a node is kept when (a) the final export holds exactly that text
 * for the node, or (b) a later admitted write by another lineage, whose base
 * held that text for the node, superseded it, or (c) `Admission.held` returns
 * a hold of that writer on that node whose `theirs` is the text and whose
 * other side is retrievable (`ours` present, or the node retired, or the
 * write is an insert, which has no other side). Anything else is a silent
 * loss. The oracle also counts as a loss a base node that no writer retired
 * but the export lacks, a base node no writer touched whose text changed, and
 * an exported text that no writer and no base ever held. Status moves are
 * checked against a sequential model of the lifecycle that the oracle runs
 * itself: a move to a value outside the lifecycle or behind the model's
 * current value must be refused with the matching code, every other move
 * must land, and the exported cell must hold the model's final value.
 *
 * Labeller: the agent-memory-store-p2 integration lane, which built the
 * fixture and this oracle.
 */
import {
  captureBatchVerified,
  replaceStatusValue,
  seededNodeIdMinter,
  statusValueIn,
  typeStatusMoves,
} from "@beep/agent-memory-store";
import { PosixPath } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { fixtureStatusFields, phaseStatus } from "./admission-fixture.ts";
import { writeSampleFolder } from "./fixtures/goals-markdown-sample.ts";
import { seededRandom } from "./projector-support.ts";
import { openWritingStore } from "./write-path-support.ts";
import type {
  AdmissionOutcome,
  BaseExport,
  HeldConflict,
  LineageId,
  NodeId,
  NodeOperation,
  OperationBatch,
  StatusValue,
} from "@beep/agent-memory-store";
import type { AdversarialFixture, FixtureCluster, FixtureWriter, Stratum } from "./admission-fixture.ts";

/** One writer's write as one run admitted it. */
export interface AdmittedFixtureWrite {
  readonly batch: OperationBatch;
  readonly cluster: FixtureCluster;
  readonly outcomes: ReadonlyArray<AdmissionOutcome>;
  readonly position: number;
  readonly writer: FixtureWriter;
}

/** What one run left: the base, the writes in admission order, the export, the disk and the holds. */
export interface ReplayRun {
  readonly base: BaseExport;
  readonly disk: ReadonlyArray<readonly [string, string]>;
  readonly exported: BaseExport;
  readonly held: ReadonlyArray<HeldConflict>;
  readonly seed: number;
  readonly writes: ReadonlyArray<AdmittedFixtureWrite>;
}

// Fisher-Yates over a seeded sequence.
const shuffled = <T>(items: ReadonlyArray<T>, seed: number): ReadonlyArray<T> => {
  const random = seededRandom(seed);
  const out = A.copy(items);
  for (let at = out.length - 1; at > 0; at -= 1) {
    const other = Math.floor(random() * (at + 1));
    const kept = out[at] as T;
    out[at] = out[other] as T;
    out[other] = kept;
  }
  return out;
};

/** One writer with the batch op capture submits for its edit. */
export interface CapturedWriter {
  readonly batch: OperationBatch;
  readonly cluster: FixtureCluster;
  readonly writer: FixtureWriter;
}

/** The replay's starting point: one imported database, its base and every writer's captured batch. */
export interface PreparedReplay {
  readonly base: BaseExport;
  readonly database: string;
  readonly fixture: AdversarialFixture;
  readonly root: PosixPath;
  readonly workspace: string;
  readonly writers: ReadonlyArray<CapturedWriter>;
}

// The replay's databases are scratch: no commit of them needs to survive a
// crash, so they skip the journal file and every fsync.
const scratch = Effect.fnUntraced(function* (context: Context.Context<SqlClient.SqlClient>) {
  const sql = Context.get(context, SqlClient.SqlClient);
  yield* sql`PRAGMA journal_mode = MEMORY`;
  yield* sql`PRAGMA synchronous = OFF`;
});

/**
 * Imports the fixture folder once and captures every writer's edit against
 * that import's base, exactly as `admitEdits` does (verified capture, then
 * status typing). Every run starts from a byte copy of this database, so the
 * node ids, revisions and therefore the captured batches are the same in
 * every run.
 */
export const prepareReplay = Effect.fnUntraced(function* (fixture: AdversarialFixture, workspace: string) {
  const root = PosixPath.make(`${workspace}/memory`);
  const database = `${workspace}/imported.db`;
  yield* writeSampleFolder(root, fixture.files);
  const base = yield* Effect.scoped(
    Effect.flatMap(openWritingStore({ filename: database, disableWAL: true }, fixtureStatusFields), (store) =>
      Effect.andThen(scratch(store.context), store.projector.importFolder(root))
    )
  );
  const writers: Array<CapturedWriter> = [];
  for (const [index, { cluster, writer }] of A.flatMap(fixture.clusters, (cluster) =>
    A.map(cluster.writers, (writer) => ({ cluster, writer }))
  ).entries()) {
    const captured = yield* captureBatchVerified(base, [writer.edit], writer.author, seededNodeIdMinter(index + 1));
    if (O.isSome(captured)) {
      writers.push({ batch: typeStatusMoves(captured.value, fixtureStatusFields), cluster, writer });
    }
  }
  return { base, database, fixture, root, workspace, writers } satisfies PreparedReplay;
});

/**
 * Runs the fixture once on a byte copy of the imported database: every writer
 * is admitted in the order seed `seed` draws, then the folder is exported.
 */
export const replayOnce = Effect.fnUntraced(function* (prepared: PreparedReplay, seed: number) {
  const fs = yield* FileSystem.FileSystem;
  const database = `${prepared.workspace}/run-${seed}.db`;
  yield* fs.copyFile(prepared.database, database);
  // The folder holds the imported bytes again, so the export fence of the copy passes.
  yield* writeSampleFolder(prepared.root, prepared.fixture.files);
  const store = yield* openWritingStore({ filename: database, disableWAL: true }, fixtureStatusFields);
  yield* scratch(store.context);
  const writes: Array<AdmittedFixtureWrite> = [];
  for (const [position, captured] of shuffled(prepared.writers, seed).entries()) {
    const outcomes = yield* store.admission.admit(captured.batch);
    writes.push({ ...captured, outcomes, position });
  }
  const exported = yield* store.projector.exportFolder(prepared.root);
  const held = yield* store.admission.held;
  const disk = yield* Effect.forEach(prepared.fixture.files, (file) =>
    Effect.map(fs.readFileString(`${prepared.root}/${file.path}`), (text) => [file.path, text] as const)
  );
  yield* fs.remove(database);
  return { base: prepared.base, disk, exported, held, seed, writes } satisfies ReplayRun;
}, Effect.scoped);

// --- The oracle ----------------------------------------------------------------

/** What the oracle found in one run. */
export interface RunVerdict {
  readonly backwardMoves: number;
  readonly backwardRejected: number;
  readonly contestedHeldWithBothTexts: number;
  readonly contestedNodes: number;
  readonly deleteVersusEditHeld: number;
  readonly exportMatchesDisk: boolean;
  readonly heldOperations: number;
  readonly landedOperations: number;
  readonly losses: ReadonlyArray<string>;
  readonly operations: number;
  readonly resolverNeededWrites: number;
  readonly statusConflicts: number;
  readonly statusHeld: number;
  readonly statusWrong: number;
  readonly structuralFloorWrites: number;
  readonly writes: number;
  readonly writesByStratum: ReadonlyArray<readonly [Stratum, number, number]>;
}

const textsOf = (exportOf: Pick<BaseExport, "files">): MutableHashMap.MutableHashMap<NodeId, string> =>
  MutableHashMap.fromIterable(
    A.flatMap(exportOf.files, (file) => A.map(file.nodes, (node) => [node.nodeId, node.anchor.anchor.quote] as const))
  );

const textOf = (operation: NodeOperation): O.Option<string> =>
  operation.op === "replace" || operation.op === "insert" ? O.some(operation.text) : O.none();

const isHeld = (outcome: AdmissionOutcome): boolean => outcome.outcome === "held";

const codesOf = (outcome: AdmissionOutcome): ReadonlyArray<string> =>
  outcome.outcome === "held" || outcome.outcome === "rejected"
    ? A.map(outcome.violations, (violation) => violation.code)
    : [];

const structural = (outcome: AdmissionOutcome): boolean =>
  A.some(codesOf(outcome), (code) => code === "deleteVersusEdit" || code === "insertUnderDeletedAnchor");

const positionIn = (value: StatusValue): number =>
  O.getOrElse(
    A.findFirstIndex(phaseStatus.order, (at) => at === value),
    () => -1
  );

const sameText = O.makeEquivalence((self: string, that: string) => self === that);

// The node operations of the run in admission order, with their outcomes.
interface Judged {
  readonly author: LineageId;
  // The text the writer's base exported for the node, when it had one.
  readonly baseText: O.Option<string>;
  readonly operation: NodeOperation;
  readonly outcome: O.Option<AdmissionOutcome>;
  readonly position: number;
}

const judgedOf = (run: ReplayRun): ReadonlyArray<Judged> => {
  // Every write of a run edits one base; its texts are read once per base.
  let lastBase: OperationBatch["base"] = run.base;
  let lastTexts = textsOf(run.base);
  const baseTextsOf = (base: OperationBatch["base"]) => {
    if (base !== lastBase) {
      lastBase = base;
      lastTexts = textsOf(base);
    }
    return lastTexts;
  };
  return A.flatMap(run.writes, (write) =>
    A.map(write.batch.operations, (operation, index) => ({
      author: write.writer.author,
      baseText: MutableHashMap.get(baseTextsOf(write.batch.base), operation.nodeId),
      operation,
      outcome: A.get(write.outcomes, index),
      position: write.position,
    }))
  );
};

// Whether a later write by another lineage landed on the node from a base that held `text` for it.
const supersededBy = (judged: ReadonlyArray<Judged>, write: Judged, text: string): boolean =>
  A.some(
    judged,
    (later) =>
      later.position > write.position &&
      later.author !== write.author &&
      later.operation.nodeId === write.operation.nodeId &&
      O.exists(later.outcome, (outcome) => outcome.outcome === "landed") &&
      O.contains(later.baseText, text)
  );

// Whether `held` keeps the writer's text for the node with its other side retrievable.
const heldWithBothTexts = (
  run: ReplayRun,
  final: MutableHashMap.MutableHashMap<NodeId, string>,
  write: Judged,
  text: string
): boolean =>
  A.some(
    run.held,
    (conflict) =>
      conflict.nodeId === write.operation.nodeId &&
      conflict.author === write.author &&
      O.contains(conflict.theirs, text) &&
      (write.operation.op === "insert" || O.isSome(conflict.ours) || !MutableHashMap.has(final, write.operation.nodeId))
  );

// What the sequential lifecycle model of one node has counted so far, and the
// node's current value under that model.
interface StatusTally {
  readonly backward: number;
  readonly backwardRejected: number;
  readonly heldMoves: number;
  readonly value: O.Option<StatusValue>;
  readonly wrong: number;
}

const oneIf = (condition: boolean): number => (condition ? 1 : 0);

// A typed move from `current` to `to`: outside the lifecycle it must be
// refused as such, behind `current` it must be rejected as backward, and
// otherwise it must land and becomes the model's value.
const judgeMove = (
  tally: StatusTally,
  current: StatusValue,
  to: StatusValue,
  outcome: AdmissionOutcome
): StatusTally => {
  const target = positionIn(to);
  if (target < 0) {
    return { ...tally, wrong: tally.wrong + oneIf(!A.contains(codesOf(outcome), "statusOutsideLifecycle")) };
  }
  if (target < positionIn(current)) {
    const refused = outcome.outcome === "rejected" && A.contains(codesOf(outcome), "backwardStatusMove");
    return {
      ...tally,
      backward: tally.backward + 1,
      backwardRejected: tally.backwardRejected + oneIf(refused),
      wrong: tally.wrong + oneIf(!refused),
    };
  }
  return { ...tally, value: O.some(to), wrong: tally.wrong + oneIf(outcome.outcome !== "landed") };
};

// One move of the model: a move that is no typed status move, has no
// outcome or starts from no lifecycle value is wrong.
const stepStatus = (tally: StatusTally, move: Judged): StatusTally => {
  const to = move.operation.op === "setStatus" ? move.operation.transition.to : undefined;
  const outcome = O.getOrUndefined(move.outcome);
  if (to === undefined || outcome === undefined || O.isNone(tally.value)) {
    return { ...tally, wrong: tally.wrong + 1 };
  }
  return judgeMove({ ...tally, heldMoves: tally.heldMoves + oneIf(isHeld(outcome)) }, tally.value.value, to, outcome);
};

// The sequential lifecycle model of the status moves of one node.
const statusVerdict = (
  final: MutableHashMap.MutableHashMap<NodeId, string>,
  baseTexts: MutableHashMap.MutableHashMap<NodeId, string>,
  nodeId: NodeId,
  moves: ReadonlyArray<Judged>
) => {
  const baseText = O.getOrElse(MutableHashMap.get(baseTexts, nodeId), () => "");
  const from = statusValueIn(phaseStatus, baseText);
  const start: StatusTally = { backward: 0, backwardRejected: 0, heldMoves: 0, value: from, wrong: 0 };
  const tally = A.reduce(moves, start, stepStatus);
  const expected = O.map(O.all([from, tally.value]), ([start, end]) => replaceStatusValue(baseText, start, end));
  return {
    wrong: tally.wrong + oneIf(!sameText(expected, MutableHashMap.get(final, nodeId))),
    backward: tally.backward,
    backwardRejected: tally.backwardRejected,
    heldMoves: tally.heldMoves,
  };
};

type Texts = MutableHashMap.MutableHashMap<NodeId, string>;

// What one run's oracle reads: its export and base texts and its judged operations.
interface Oracle {
  readonly baseTexts: Texts;
  readonly final: Texts;
  readonly judged: ReadonlyArray<Judged>;
  readonly run: ReplayRun;
}

// The judged operations of one kind, by node, in admission order.
const byNode = (judged: ReadonlyArray<Judged>, op: NodeOperation["op"]) => {
  const grouped = MutableHashMap.empty<NodeId, Array<Judged>>();
  for (const write of A.filter(judged, (candidate) => candidate.operation.op === op)) {
    const writes = O.getOrElse(MutableHashMap.get(grouped, write.operation.nodeId), (): Array<Judged> => []);
    writes.push(write);
    MutableHashMap.set(grouped, write.operation.nodeId, writes);
  }
  return grouped;
};

// The node ids the judged operations of one kind touch.
const nodesWith = (judged: ReadonlyArray<Judged>, op: NodeOperation["op"]) =>
  MutableHashSet.fromIterable(
    A.flatMap(judged, (write) => (write.operation.op === op ? [write.operation.nodeId] : []))
  );

// Every text some writer submitted, by node.
const writtenTexts = (judged: ReadonlyArray<Judged>) => {
  const written = MutableHashMap.empty<NodeId, MutableHashSet.MutableHashSet<string>>();
  for (const write of judged) {
    const texts = O.getOrElse(MutableHashMap.get(written, write.operation.nodeId), () =>
      MutableHashSet.empty<string>()
    );
    O.map(textOf(write.operation), (text) => MutableHashSet.add(texts, text));
    MutableHashMap.set(written, write.operation.nodeId, texts);
  }
  return written;
};

// Every writer's text: in the export, superseded or held with both texts.
const writerLosses = ({ final, judged, run }: Oracle): ReadonlyArray<string> =>
  A.flatMap(judged, (write) =>
    O.match(textOf(write.operation), {
      onNone: (): ReadonlyArray<string> => [],
      onSome: (text) =>
        O.contains(MutableHashMap.get(final, write.operation.nodeId), text) ||
        supersededBy(judged, write, text) ||
        heldWithBothTexts(run, final, write, text)
          ? []
          : [`${write.author} ${write.operation.op} ${write.operation.nodeId}`],
    })
  );

// Base nodes: kept unless retired, unchanged unless written.
const baseNodeLosses = (
  { baseTexts, final, judged }: Oracle,
  written: ReturnType<typeof writtenTexts>
): ReadonlyArray<string> => {
  const retired = nodesWith(judged, "delete");
  const losses: Array<string> = [];
  for (const [nodeId, baseText] of baseTexts) {
    const exported = MutableHashMap.get(final, nodeId);
    if (O.isNone(exported) && !MutableHashSet.has(retired, nodeId)) {
      losses.push(`base node ${nodeId} missing`);
    }
    if (O.isSome(exported) && !MutableHashMap.has(written, nodeId) && exported.value !== baseText) {
      losses.push(`base node ${nodeId} changed with no writer`);
    }
  }
  return losses;
};

// Whether `text` is the base text of a moved status cell with its token at
// some lifecycle value.
const isStatusForm = (
  baseTexts: Texts,
  moved: MutableHashSet.MutableHashSet<NodeId>,
  nodeId: NodeId,
  text: string
): boolean =>
  MutableHashSet.has(moved, nodeId) &&
  O.exists(MutableHashMap.get(baseTexts, nodeId), (baseText) =>
    O.exists(statusValueIn(phaseStatus, baseText), (from) =>
      A.some(phaseStatus.order, (value) => replaceStatusValue(baseText, from, value) === text)
    )
  );

// Exported texts: each one some base or some writer held. A status cell may
// also hold its base text with the token moved to another lifecycle value.
const exportedLosses = (
  { baseTexts, final, judged }: Oracle,
  written: ReturnType<typeof writtenTexts>
): ReadonlyArray<string> => {
  const moved = nodesWith(judged, "setStatus");
  const losses: Array<string> = [];
  for (const [nodeId, text] of final) {
    const fromBase = O.contains(MutableHashMap.get(baseTexts, nodeId), text);
    const fromWriter = O.exists(MutableHashMap.get(written, nodeId), (texts) => MutableHashSet.has(texts, text));
    if (!fromBase && !fromWriter && !isStatusForm(baseTexts, moved, nodeId, text)) {
      losses.push(`exported node ${nodeId} holds a text nobody wrote`);
    }
  }
  return losses;
};

// Whether every writer of a contested node whose text the export lacks has a
// hold with the exported text as `ours` and its own text as `theirs`, and
// exactly one writer's text was exported.
const contestedHeld = ({ final, run }: Oracle, nodeId: NodeId, writes: ReadonlyArray<Judged>): boolean => {
  const exported = MutableHashMap.get(final, nodeId);
  const others = A.filter(writes, (write) => !O.exists(exported, (text) => O.contains(textOf(write.operation), text)));
  const bothKept = A.every(others, (write) =>
    A.some(
      run.held,
      (conflict) =>
        conflict.nodeId === nodeId &&
        conflict.author === write.author &&
        O.isSome(conflict.ours) &&
        sameText(conflict.ours, exported) &&
        sameText(conflict.theirs, textOf(write.operation))
    )
  );
  return others.length === writes.length - 1 && bothKept;
};

// Contested nodes: two writers, two different replace texts for one node.
const contestedCounts = (oracle: Oracle) => {
  let contestedNodes = 0;
  let contestedHeldWithBothTexts = 0;
  for (const [nodeId, writes] of byNode(oracle.judged, "replace")) {
    const texts = A.dedupe(A.getSomes(A.map(writes, (write) => textOf(write.operation))));
    if (writes.length >= 2 && texts.length >= 2) {
      contestedNodes += 1;
      contestedHeldWithBothTexts += oneIf(contestedHeld(oracle, nodeId, writes));
    }
  }
  return { contestedNodes, contestedHeldWithBothTexts };
};

// Status moves, node by node in admission order.
const statusCounts = ({ baseTexts, final, judged }: Oracle) => {
  const statusMoves = byNode(judged, "setStatus");
  let statusWrong = 0;
  let backwardMoves = 0;
  let backwardRejected = 0;
  let statusHeld = 0;
  for (const [nodeId, moves] of statusMoves) {
    const verdict = statusVerdict(final, baseTexts, nodeId, moves);
    statusWrong += verdict.wrong;
    backwardMoves += verdict.backward;
    backwardRejected += verdict.backwardRejected;
    statusHeld += verdict.heldMoves;
  }
  return {
    backwardMoves,
    backwardRejected,
    statusConflicts: MutableHashMap.size(statusMoves),
    statusHeld,
    statusWrong,
  };
};

// Whether every file on disk holds exactly the joined texts of its exported nodes.
const exportMatchesDisk = (run: ReplayRun): boolean =>
  A.every(run.disk, ([path, text]) =>
    O.exists(
      A.findFirst(run.exported.files, (file) => file.path === path),
      (file) =>
        A.join(
          A.map(file.nodes, (node) => node.anchor.anchor.quote),
          ""
        ) === text
    )
  );

const holdsAny = (write: AdmittedFixtureWrite): boolean => A.some(write.outcomes, isHeld);

// Per stratum, in first-admission order: its writes and those with a held operation.
const writesByStratum = (run: ReplayRun): RunVerdict["writesByStratum"] =>
  A.map(A.dedupe(A.map(run.writes, (write) => write.cluster.stratum)), (stratum) => {
    const inStratum = A.filter(run.writes, (write) => write.cluster.stratum === stratum);
    return [stratum, inStratum.length, A.filter(inStratum, holdsAny).length] as const;
  });

/** Checks one run with the oracle. */
export const verdictOf = (run: ReplayRun): RunVerdict => {
  const oracle: Oracle = { baseTexts: textsOf(run.base), final: textsOf(run.exported), judged: judgedOf(run), run };
  const written = writtenTexts(oracle.judged);
  const outcomes = A.flatMap(run.writes, (write) => write.outcomes);
  return {
    ...contestedCounts(oracle),
    ...statusCounts(oracle),
    deleteVersusEditHeld: A.filter(outcomes, (outcome) => A.contains(codesOf(outcome), "deleteVersusEdit")).length,
    exportMatchesDisk: exportMatchesDisk(run),
    heldOperations: A.filter(outcomes, isHeld).length,
    landedOperations: A.filter(outcomes, (outcome) => outcome.outcome === "landed").length,
    losses: [...writerLosses(oracle), ...baseNodeLosses(oracle, written), ...exportedLosses(oracle, written)],
    operations: oracle.judged.length,
    resolverNeededWrites: A.filter(run.writes, holdsAny).length,
    structuralFloorWrites: A.filter(run.writes, (write) => A.some(write.outcomes, structural)).length,
    writes: run.writes.length,
    writesByStratum: writesByStratum(run),
  };
};
