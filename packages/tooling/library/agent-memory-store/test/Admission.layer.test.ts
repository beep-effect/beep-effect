/**
 * The live admission layer, case by case. Labeller: the agent-memory-store-p2
 * admission lane, which wrote every fixture text in this file.
 *
 * Writers that race share one SQLite connection: the racing writer runs
 * inside the other admission's transaction, between its read and its append,
 * which is deterministic where two connections in one Bun process would stall
 * on the busy lock.
 */
import {
  Admission,
  AdmissionError,
  AdmissionOutcome,
  AdmissionResolverLineage,
  BaseExport,
  ConflictResolution,
  contentHashOf,
  HoldId,
  HoldNotOpenError,
  HoldResolved,
  HoldResolvedEvent,
  InsertPlacement,
  LineageId,
  LogCursor,
  MemoryFilePath,
  MemoryLog,
  MemoryLogError,
  MemoryLogLayer,
  makeAdmissionLayer,
  makeAdmissionTestLayer,
  makeMemorySqlClientLayer,
  NodeCreatedEvent,
  NodeId,
  NodeOperation,
  NodeRevisedEvent,
  NodeStatusChangedEvent,
  OperationBatch,
  RevisionId,
  revisionIdOf,
  StatusFields,
  StatusLifecycle,
  StatusTransition,
  StatusValue,
  TombstoneContentHash,
  WriteHeldEvent,
} from "@beep/agent-memory-store";
import { Sha256Hex } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import {
  insertEvent,
  isBunRuntime,
  replayNodeId,
  reviseEvent,
  TestPlatform,
  tempDirectory,
} from "./projector-support.ts";
import type { MemoryEvent, NodeKind, AdmissionOutcome as Outcome } from "@beep/agent-memory-store";

const pending = StatusValue.make("pending");
const active = StatusValue.make("active");
const complete = StatusValue.make("complete");
const statusFields = StatusFields.make({
  lifecycles: [StatusLifecycle.make({ field: "status", order: [pending, active, complete] })],
});

const writerA = LineageId.make("agent-memory-store-p2:writer-a");
const writerB = LineageId.make("agent-memory-store-p2:writer-b");
const notes = MemoryFilePath.make("notes.md");
const other = MemoryFilePath.make("other.md");
const bogusRevision = RevisionId.make("abababababababababababababababababababababababababababababababab");
const unknownHold = HoldId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e90");
const emptyFolder = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

const theirs = ConflictResolution.cases.theirs.make({ placement: O.none() });
const ours = ConflictResolution.cases.ours.make({});
const merged = (text: string) => ConflictResolution.cases.merged.make({ text, placement: O.none() });

const decodeCreated = S.decodeUnknownEffect(NodeCreatedEvent.payloadSchemaBinary);
const decodeRevised = S.decodeUnknownEffect(NodeRevisedEvent.payloadSchemaBinary);
const decodeStatusChanged = S.decodeUnknownEffect(NodeStatusChangedEvent.payloadSchemaBinary);
const decodeResolved = S.decodeUnknownEffect(HoldResolvedEvent.payloadSchemaBinary);
const encodeResolved = S.encodeUnknownEffect(HoldResolvedEvent.payloadSchemaBinary);

const statusRow = (status: string) => `| P2 Admission | ${status} |\n`;

const nodeIdOf = (index: number): NodeId => NodeId.make(replayNodeId(1_000_000 + index));

interface Seeded {
  readonly nodeId: NodeId;
  readonly revisionId: RevisionId;
}

type Log = MemoryLog["Service"];

const seedNodes = Effect.fnUntraced(function* (
  log: Log,
  filePath: MemoryFilePath,
  texts: A.NonEmptyReadonlyArray<string>,
  firstIndex: number,
  kind: NodeKind
) {
  const seeded: Array<Seeded> = [];
  const events: Array<MemoryEvent> = [];
  let after = O.none<NodeId>();
  for (const [index, text] of texts.entries()) {
    const nodeId = nodeIdOf(firstIndex + index);
    const { event, revisionId } = yield* insertEvent(nodeId, after, filePath, kind, text);
    events.push(event);
    seeded.push({ nodeId, revisionId });
    after = O.some(nodeId);
  }
  if (A.isArrayNonEmpty(events)) {
    yield* log.appendMany(events);
  }
  return seeded;
});

// One file of nodes, each after the previous, returned one per text.
const seedFile = <const Texts extends A.NonEmptyReadonlyArray<string>>(
  log: Log,
  filePath: MemoryFilePath,
  texts: Texts,
  firstIndex = 0
) =>
  Effect.map(
    seedNodes(log, filePath, texts, firstIndex, "paragraph"),
    (seeded) => seeded as unknown as { readonly [K in keyof Texts]: Seeded }
  );

const batch = (operations: A.NonEmptyReadonlyArray<NodeOperation>, author: LineageId) =>
  OperationBatch.make({
    base: BaseExport.make({ folderDigest: emptyFolder, files: [], cursor: LogCursor.make(0) }),
    operations,
    author,
  });

// Admits a batch and returns its outcomes, one per operation.
const admitAll = <const Operations extends A.NonEmptyReadonlyArray<NodeOperation>>(
  admission: Admission["Service"],
  operations: Operations,
  author: LineageId = writerA
) =>
  Effect.map(
    admission.admit(batch(operations, author)),
    (outcomes) => outcomes as unknown as { readonly [K in keyof Operations]: Outcome }
  );

const replace = (node: Seeded, expectedRevision: RevisionId, text: string) =>
  NodeOperation.cases.replace.make({ nodeId: node.nodeId, expectedRevision, text });

const remove = (node: Seeded) =>
  NodeOperation.cases.delete.make({ nodeId: node.nodeId, expectedRevision: node.revisionId });

const insert = (nodeId: NodeId, after: O.Option<NodeId>, text: string, filePath: MemoryFilePath = notes) =>
  NodeOperation.cases.insert.make({ nodeId, afterNodeId: after, filePath, kind: "listItem", text });

const setStatus = (node: Seeded, from: StatusValue, to: string) =>
  NodeOperation.cases.setStatus.make({
    nodeId: node.nodeId,
    expectedRevision: node.revisionId,
    transition: StatusTransition.make({ field: "status", from: O.some(from), to: StatusValue.make(to) }),
  });

// Admission and the memory log over a fresh in-memory database.
const fresh = Effect.fnUntraced(function* () {
  const context = yield* Layer.build(makeAdmissionTestLayer(statusFields));
  return { log: Context.get(context, MemoryLog), admission: Context.get(context, Admission) };
});

// A memory log and its SQL client, for admissions that share one connection.
const openLog = Effect.fnUntraced(function* (filename = ":memory:") {
  const context = yield* Layer.build(MemoryLogLayer.pipe(Layer.provideMerge(makeMemorySqlClientLayer({ filename }))));
  return { log: Context.get(context, MemoryLog), sql: Context.get(context, SqlClient.SqlClient) };
});

const openAdmission = Effect.fnUntraced(function* (log: Log, sql: SqlClient.SqlClient, fields = statusFields) {
  const context = yield* Layer.build(
    makeAdmissionLayer(fields).pipe(
      Layer.provide(Layer.mergeAll(Layer.succeed(MemoryLog, log), Layer.succeed(SqlClient.SqlClient, sql)))
    )
  );
  return Context.get(context, Admission);
});

type Injected = Effect.Effect<unknown, AdmissionError | HoldNotOpenError>;

// The log with `inject` run once, right after the first `history` read of
// `nodeId` returns: another writer commits between this admission's judgment
// and its append.
const injectAfterHistory = (log: Log, nodeId: NodeId, inject: Injected): Log => {
  let waiting = true;
  return MemoryLog.of({
    ...log,
    history: Effect.fn("MemoryLog.history")(function* (id: NodeId) {
      const entries = yield* log.history(id);
      if (id === nodeId && waiting) {
        waiting = false;
        yield* Effect.orDie(inject);
      }
      return entries;
    }),
  });
};

// The log with `inject` run once, right after the first `entriesAfter` read returns.
const injectAfterEntries = (log: Log, inject: Injected): Log => {
  let waiting = true;
  return MemoryLog.of({
    ...log,
    entriesAfter: Effect.fn("MemoryLog.entriesAfter")(function* (cursor: LogCursor) {
      const entries = yield* log.entriesAfter(cursor);
      if (waiting) {
        waiting = false;
        yield* Effect.orDie(inject);
      }
      return entries;
    }),
  });
};

const broken = Effect.fail(MemoryLogError.fromUnknown("injected", new Error("injected log failure")));
const unreadable = (log: Log): Log =>
  MemoryLog.of({
    ...log,
    history: Effect.fn("MemoryLog.history")(() => broken),
    entriesAfter: Effect.fn("MemoryLog.entriesAfter")(() => broken),
  });
const unwritable = (log: Log): Log =>
  MemoryLog.of({
    ...log,
    append: Effect.fn("MemoryLog.append")(() => broken),
    appendMany: Effect.fn("MemoryLog.appendMany")(() => broken),
  });

// The heads of a node, its latest event's tag, and the text and author that
// event left (none for a retirement).
const headOf = Effect.fnUntraced(function* (log: Log, nodeId: NodeId) {
  const history = yield* log.history(nodeId);
  const heads = yield* log.heads(nodeId);
  const last = yield* Effect.fromOption(A.last(history));
  if (last.event === NodeRevisedEvent.tag) {
    const payload = yield* decodeRevised(last.payload);
    return { event: last.event, heads, text: O.some(payload.text), author: O.some(payload.author) };
  }
  if (last.event === NodeStatusChangedEvent.tag) {
    const payload = yield* decodeStatusChanged(last.payload);
    return { event: last.event, heads, text: O.some(payload.text), author: O.some(payload.author) };
  }
  return { event: last.event, heads, text: O.none<string>(), author: O.none<LineageId>() };
});

const createdOf = Effect.fnUntraced(function* (log: Log, nodeId: NodeId) {
  const history = yield* log.history(nodeId);
  const first = yield* Effect.fromOption(A.head(history));
  return yield* decodeCreated(first.payload);
});

const revisionAfter = Effect.fnUntraced(function* (nodeId: NodeId, parent: RevisionId, text: string) {
  const contentHash = yield* contentHashOf(text);
  return yield* revisionIdOf(nodeId, [parent], contentHash);
});

const rootRevision = Effect.fnUntraced(function* (nodeId: NodeId, text: string) {
  const contentHash = yield* contentHashOf(text);
  return yield* revisionIdOf(nodeId, [], contentHash);
});

const tombstoneAfter = (nodeId: NodeId, parent: RevisionId) => revisionIdOf(nodeId, [parent], TombstoneContentHash);

const kindsOf = (outcomes: ReadonlyArray<Outcome>) => A.map(outcomes, (outcome) => outcome.outcome);

const codesOf = (outcome: Outcome): ReadonlyArray<string> =>
  AdmissionOutcome.match(outcome, {
    landed: () => [],
    deferred: () => [],
    held: (held) => A.map(held.violations, (finding) => finding.code),
    rejected: (rejected) => A.map(rejected.violations, (finding) => finding.code),
  });

const pathsOf = (outcome: Outcome): ReadonlyArray<string> =>
  AdmissionOutcome.match(outcome, {
    landed: () => [],
    deferred: () => [],
    held: (held) => A.map(held.violations, (finding) => finding.violation.path),
    rejected: (rejected) => A.map(rejected.violations, (finding) => finding.violation.path),
  });

const landedRevision = (outcome: Outcome): RevisionId =>
  AdmissionOutcome.match(outcome, {
    landed: (landed) => landed.revisionId,
    deferred: () => bogusRevision,
    held: () => bogusRevision,
    rejected: () => bogusRevision,
  });

const heldOf = O.liftPredicate(AdmissionOutcome.guards.held);

const holdIdOf = (outcome: Outcome): HoldId =>
  O.getOrElse(
    O.map(heldOf(outcome), (held) => held.holdId),
    () => unknownHold
  );

describe("hold resolutions in the journal", () => {
  it.effect.prop(
    "a HoldResolved payload, as resolve appends it, round-trips through the journal codec admission reads it with",
    [Arbitrary.schema(HoldResolved)],
    ([resolved]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeResolved(resolved);
        const decoded = yield* decodeResolved(encoded);
        expect(decoded).toEqual(resolved);
      }),
    { arbitrary: { runs: 50 } }
  );
});

describe.skipIf(!isBunRuntime)("Admission layer (Bun runtime)", () => {
  it.layer(TestPlatform)("admit", (it) => {
    it.effect(
      "lands a write whose node is still at the revision it names: revise, insert and retire",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, gap, beta] = yield* seedFile(log, notes, ["Alpha.\n", "\n", "Beta.\n"]);
        const added = nodeIdOf(10);
        const top = nodeIdOf(11);

        const outcomes = yield* admitAll(admission, [
          replace(alpha, alpha.revisionId, "Alpha two.\n"),
          insert(added, O.some(beta.nodeId), "- New.\n"),
          insert(top, O.none(), "Top.\n"),
          remove(gap),
        ]);

        const revised = yield* revisionAfter(alpha.nodeId, alpha.revisionId, "Alpha two.\n");
        const created = yield* rootRevision(added, "- New.\n");
        const opened = yield* rootRevision(top, "Top.\n");
        const retired = yield* tombstoneAfter(gap.nodeId, gap.revisionId);
        expect(kindsOf(outcomes)).toEqual(["landed", "landed", "landed", "landed"]);
        expect(A.map(outcomes, landedRevision)).toEqual([revised, created, opened, retired]);
        const alphaHead = yield* headOf(log, alpha.nodeId);
        expect(alphaHead.heads).toEqual([revised]);
        assertSome(alphaHead.text, "Alpha two.\n");
        assertSome(alphaHead.author, writerA);
        const gapHead = yield* headOf(log, gap.nodeId);
        expect(gapHead.event).toBe("NodeRetired");
        const creation = yield* createdOf(log, added);
        assertSome(creation.after, beta.nodeId);
        expect(creation.filePath).toBe(notes);
        assertNone(creation.anchor);
      })
    );

    it.effect(
      "changes nothing when the write asks for what the node already holds",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, beta] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n"]);
        yield* admitAll(admission, [remove(beta)], writerB);
        const before = yield* log.cursor;
        const tombstone = yield* tombstoneAfter(beta.nodeId, beta.revisionId);

        const outcomes = yield* admitAll(admission, [replace(alpha, alpha.revisionId, "Alpha.\n"), remove(beta)]);

        const after = yield* log.cursor;
        expect(A.map(outcomes, landedRevision)).toEqual([alpha.revisionId, tombstone]);
        expect(after).toBe(before);
      })
    );

    it.effect(
      "takes the writer's text on the new head when the node moved on but its text is back at the base",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, beta] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n"]);
        const [alphaAway, betaAway] = yield* admitAll(
          admission,
          [replace(alpha, alpha.revisionId, "Alpha away.\n"), replace(beta, beta.revisionId, "Beta away.\n")],
          writerB
        );
        const [alphaBack, betaBack] = yield* admitAll(
          admission,
          [replace(alpha, landedRevision(alphaAway), "Alpha.\n"), replace(beta, landedRevision(betaAway), "Beta.\n")],
          writerB
        );

        const [revised, retired] = yield* admitAll(admission, [
          replace(alpha, alpha.revisionId, "Alpha changed.\n"),
          remove(beta),
        ]);

        const expectedRevised = yield* revisionAfter(alpha.nodeId, landedRevision(alphaBack), "Alpha changed.\n");
        const expectedRetired = yield* tombstoneAfter(beta.nodeId, landedRevision(betaBack));
        expect(landedRevision(revised)).toBe(expectedRevised);
        expect(landedRevision(retired)).toBe(expectedRetired);
        const alphaHead = yield* headOf(log, alpha.nodeId);
        assertSome(alphaHead.text, "Alpha changed.\n");
      })
    );

    it.effect(
      "keeps the log's text when both writers wrote the same text or the writer left the base text unchanged",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, beta] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n"]);
        const [alphaB, betaB] = yield* admitAll(
          admission,
          [replace(alpha, alpha.revisionId, "Same.\n"), replace(beta, beta.revisionId, "Beta by B.\n")],
          writerB
        );
        const before = yield* log.cursor;

        const outcomes = yield* admitAll(admission, [
          replace(alpha, alpha.revisionId, "Same.\n"),
          replace(beta, beta.revisionId, "Beta.\n"),
        ]);

        const after = yield* log.cursor;
        expect(A.map(outcomes, landedRevision)).toEqual([landedRevision(alphaB), landedRevision(betaB)]);
        expect(after).toBe(before);
        const betaHead = yield* headOf(log, beta.nodeId);
        assertSome(betaHead.text, "Beta by B.\n");
      })
    );

    it.effect(
      "AC-2 contested revise: holds a write when both writers changed one node, with both texts, dropping neither",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha] = yield* seedFile(log, notes, ["Alpha.\n"]);
        const [byB] = yield* admitAll(admission, [replace(alpha, alpha.revisionId, "Alpha by B.\n")], writerB);
        const operation = replace(alpha, alpha.revisionId, "Alpha by A.\n");

        const [outcome] = yield* admitAll(admission, [operation]);

        expect(codesOf(outcome)).toEqual(["staleExpectedRevision"]);
        const held = yield* Effect.fromOption(heldOf(outcome));
        assertSome(held.ours, "Alpha by B.\n");
        assertSome(held.theirs, "Alpha by A.\n");
        const head = yield* headOf(log, alpha.nodeId);
        expect(head.heads).toEqual([landedRevision(byB)]);
        assertSome(head.text, "Alpha by B.\n");
        const holds = yield* admission.held;
        const conflict = yield* Effect.fromOption(A.head(holds));
        expect(holds).toHaveLength(1);
        expect(conflict.holdId).toBe(held.holdId);
        expect(conflict.nodeId).toBe(alpha.nodeId);
        expect(conflict.operation).toEqual(operation);
        expect(conflict.author).toBe(writerA);
        assertSome(conflict.headRevision, landedRevision(byB));
        assertSome(conflict.ours, "Alpha by B.\n");
        assertSome(conflict.theirs, "Alpha by A.\n");
        expect(conflict.violations).toEqual(held.violations);
      })
    );

    it.effect(
      "AC-3 delete-versus-edit: holds a retire of a revised node and an edit of a retired node, in either order",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, beta, gamma] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n", statusRow("pending")]);
        yield* admitAll(
          admission,
          [replace(alpha, alpha.revisionId, "Alpha by B.\n"), remove(beta), remove(gamma)],
          writerB
        );

        const outcomes = yield* admitAll(admission, [
          remove(alpha),
          replace(beta, beta.revisionId, "Beta by A.\n"),
          setStatus(gamma, pending, "active"),
        ]);

        expect(A.map(outcomes, codesOf)).toEqual([["deleteVersusEdit"], ["deleteVersusEdit"], ["deleteVersusEdit"]]);
        const [retireHeld, editHeld, statusHeld] = outcomes;
        const retire = yield* Effect.fromOption(heldOf(retireHeld));
        const edit = yield* Effect.fromOption(heldOf(editHeld));
        const status = yield* Effect.fromOption(heldOf(statusHeld));
        assertSome(retire.ours, "Alpha by B.\n");
        assertNone(retire.theirs);
        assertNone(edit.ours);
        assertSome(edit.theirs, "Beta by A.\n");
        assertNone(status.ours);
        assertNone(status.theirs);
        const alphaHead = yield* headOf(log, alpha.nodeId);
        assertSome(alphaHead.text, "Alpha by B.\n");
        const betaHead = yield* headOf(log, beta.nodeId);
        expect(betaHead.event).toBe("NodeRetired");
        const holds = yield* admission.held;
        expect(holds).toHaveLength(3);
      })
    );

    it.effect(
      "AC-3 insert under a deleted anchor: holds an insert whose predecessor was retired",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [, beta] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n"]);
        yield* admitAll(admission, [remove(beta)], writerB);
        const added = nodeIdOf(20);

        const [outcome] = yield* admitAll(admission, [insert(added, O.some(beta.nodeId), "- Under Beta.\n")]);

        expect(codesOf(outcome)).toEqual(["insertUnderDeletedAnchor"]);
        const held = yield* Effect.fromOption(heldOf(outcome));
        expect(held.nodeId).toBe(added);
        assertNone(held.ours);
        assertSome(held.theirs, "- Under Beta.\n");
        const history = yield* log.history(added);
        expect(history).toEqual([]);
      })
    );

    it.effect(
      "holds what depends on an insert of the same batch that did not land, and lands what depends on one that did",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, beta] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n"]);
        yield* admitAll(admission, [remove(beta)], writerB);
        const first = nodeIdOf(30);
        const second = nodeIdOf(31);
        const third = nodeIdOf(32);
        const fourth = nodeIdOf(33);
        const thirdRoot = yield* rootRevision(third, "- Third.\n");

        const outcomes = yield* admitAll(admission, [
          insert(first, O.some(beta.nodeId), "- First.\n"),
          insert(second, O.some(first), "- Second.\n"),
          replace({ nodeId: first, revisionId: alpha.revisionId }, alpha.revisionId, "- First, revised.\n"),
          insert(third, O.some(alpha.nodeId), "- Third.\n"),
          insert(fourth, O.some(third), "\n"),
          replace({ nodeId: third, revisionId: thirdRoot }, thirdRoot, "- Third, revised.\n"),
        ]);

        expect(kindsOf(outcomes)).toEqual(["held", "held", "held", "landed", "landed", "landed"]);
        expect(A.map(outcomes, codesOf)).toEqual([
          ["insertUnderDeletedAnchor"],
          ["insertAfterMissingNode"],
          ["insertAfterMissingNode"],
          [],
          [],
          [],
        ]);
        expect(A.map(outcomes, pathsOf)).toEqual([["afterNodeId"], ["afterNodeId"], ["nodeId"], [], [], []]);
        const thirdHead = yield* headOf(log, third);
        assertSome(thirdHead.text, "- Third, revised.\n");
      })
    );

    it.effect(
      "rejects what the store must refuse: an unknown node or revision, a taken id and a misplaced insert",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha] = yield* seedFile(log, notes, ["Alpha.\n"]);
        const [elsewhere] = yield* seedFile(log, other, ["Other.\n"], 5);
        const before = yield* log.cursor;

        const outcomes = yield* admitAll(admission, [
          replace({ nodeId: nodeIdOf(40), revisionId: alpha.revisionId }, alpha.revisionId, "Nowhere.\n"),
          replace(alpha, bogusRevision, "Alpha.\n"),
          insert(alpha.nodeId, O.none(), "Again.\n"),
          insert(nodeIdOf(41), O.some(nodeIdOf(42)), "After nothing.\n"),
          insert(nodeIdOf(43), O.some(elsewhere.nodeId), "Into the wrong file.\n"),
        ]);

        const after = yield* log.cursor;
        expect(kindsOf(outcomes)).toEqual(["rejected", "rejected", "rejected", "rejected", "rejected"]);
        expect(A.map(outcomes, codesOf)).toEqual([
          ["unknownNode"],
          ["unknownRevision"],
          ["nodeIdAlreadyExists"],
          ["unknownNode"],
          ["unknownNode"],
        ]);
        expect(after).toBe(before);
      })
    );

    it.effect(
      "judges each operation on its own node: one contested node never blocks the rest of the batch",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, beta] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n"]);
        yield* admitAll(admission, [replace(alpha, alpha.revisionId, "Alpha by B.\n")], writerB);

        const outcomes = yield* admitAll(admission, [
          replace(alpha, alpha.revisionId, "Alpha by A.\n"),
          replace(beta, beta.revisionId, "Beta by A.\n"),
          insert(nodeIdOf(50), O.some(beta.nodeId), "- After Beta.\n"),
        ]);

        expect(kindsOf(outcomes)).toEqual(["held", "landed", "landed"]);
      })
    );

    it.effect(
      "AC-2 race: two admissions racing on one node end with one admitted and one held, never two admitted or one lost",
      Effect.fnUntraced(function* () {
        const { log, sql } = yield* openLog();
        const [alpha] = yield* seedFile(log, notes, ["Alpha.\n"]);
        const first = yield* openAdmission(log, sql);
        let won = O.none<Outcome>();
        const racer = Effect.map(admitAll(first, [replace(alpha, alpha.revisionId, "Alpha by A.\n")]), ([outcome]) => {
          won = O.some(outcome);
        });
        // The second admission reads the node, then the first commits, then the
        // second appends on the revision it read: the log refuses the append
        // and the second judges again against the first one's head.
        const second = yield* openAdmission(injectAfterHistory(log, alpha.nodeId, racer), sql);

        const [outcome] = yield* admitAll(second, [replace(alpha, alpha.revisionId, "Alpha by B.\n")], writerB);

        const winner = yield* Effect.fromOption(won);
        expect(winner.outcome).toBe("landed");
        const held = yield* Effect.fromOption(heldOf(outcome));
        assertSome(held.ours, "Alpha by A.\n");
        assertSome(held.theirs, "Alpha by B.\n");
        const history = yield* log.history(alpha.nodeId);
        expect(A.map(history, (entry) => entry.event)).toEqual(["NodeCreated", "NodeRevised"]);
        const head = yield* headOf(log, alpha.nodeId);
        assertSome(head.text, "Alpha by A.\n");
        const holds = yield* first.held;
        expect(A.map(holds, (conflict) => conflict.holdId)).toEqual([held.holdId]);
      })
    );
  });

  it.layer(TestPlatform)("typed status fields", (it) => {
    it.effect(
      "lands a forward status move on the log head and rewrites only the status token",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [row] = yield* seedFile(log, notes, [statusRow("pending")]);

        const [outcome] = yield* admitAll(admission, [setStatus(row, pending, "active")]);

        const head = yield* headOf(log, row.nodeId);
        expect(head.heads).toEqual([landedRevision(outcome)]);
        expect(head.event).toBe(NodeStatusChangedEvent.tag);
        assertSome(head.text, statusRow("active"));
        const history = yield* log.history(row.nodeId);
        const moved = yield* Effect.fromOption(A.last(history));
        const payload = yield* decodeStatusChanged(moved.payload);
        expect(payload.transition).toEqual(
          StatusTransition.make({ field: "status", from: O.some(pending), to: active })
        );
      })
    );

    it.effect(
      "treats a move to the status the log holds as idempotent",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [row] = yield* seedFile(log, notes, [statusRow("active")]);
        const before = yield* log.cursor;

        const [outcome] = yield* admitAll(admission, [setStatus(row, active, "active")]);

        const after = yield* log.cursor;
        expect(landedRevision(outcome)).toBe(row.revisionId);
        expect(after).toBe(before);
      })
    );

    it.effect(
      "AC-3 lifecycle guard: rejects every backward status move against the log head",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [activeRow, completeRow, laterRow] = yield* seedFile(
          log,
          notes,
          [statusRow("active"), statusRow("complete"), statusRow("complete")],
          60
        );

        const outcomes = yield* admitAll(admission, [
          setStatus(activeRow, active, "pending"),
          setStatus(completeRow, complete, "pending"),
          setStatus(laterRow, complete, "active"),
        ]);

        expect(A.map(outcomes, codesOf)).toEqual([
          ["backwardStatusMove"],
          ["backwardStatusMove"],
          ["backwardStatusMove"],
        ]);
        const activeHead = yield* headOf(log, activeRow.nodeId);
        const completeHead = yield* headOf(log, completeRow.nodeId);
        const laterHead = yield* headOf(log, laterRow.nodeId);
        expect([activeHead.heads, completeHead.heads, laterHead.heads]).toEqual([
          [activeRow.revisionId],
          [completeRow.revisionId],
          [laterRow.revisionId],
        ]);
      })
    );

    it.effect(
      "the lifecycle guard reads the log head, not the writer's base",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [row] = yield* seedFile(log, notes, [statusRow("pending")]);
        yield* admitAll(admission, [setStatus(row, pending, "complete")], writerB);

        // Forward from the writer's base (pending), backward from the head (complete).
        const [outcome] = yield* admitAll(admission, [setStatus(row, pending, "active")]);

        expect(codesOf(outcome)).toEqual(["backwardStatusMove"]);
        const head = yield* headOf(log, row.nodeId);
        assertSome(head.text, statusRow("complete"));
      })
    );

    it.effect(
      "AC-3 typed status conflicts: concurrent forward moves resolve to the furthest state with no holds, in every order",
      Effect.fnUntraced(function* () {
        const { log, sql } = yield* openLog();
        const rows = yield* seedFile(
          log,
          notes,
          [statusRow("pending"), statusRow("pending"), statusRow("pending"), statusRow("pending")],
          70
        );
        const [nearFirst, farFirst, racedNear, racedFar] = rows;
        const admission = yield* openAdmission(log, sql);

        // Sequential, both from one base: near then far, and far then near.
        yield* admitAll(
          admission,
          [setStatus(nearFirst, pending, "active"), setStatus(farFirst, pending, "complete")],
          writerB
        );
        const sequential = yield* admitAll(admission, [
          setStatus(nearFirst, pending, "complete"),
          setStatus(farFirst, pending, "active"),
        ]);

        // Raced: the other writer commits between this writer's read and its append.
        const nearRacer = yield* openAdmission(
          injectAfterHistory(
            log,
            racedNear.nodeId,
            admitAll(admission, [setStatus(racedNear, pending, "active")], writerB)
          ),
          sql
        );
        const [nearRaced] = yield* admitAll(nearRacer, [setStatus(racedNear, pending, "complete")]);
        const farRacer = yield* openAdmission(
          injectAfterHistory(
            log,
            racedFar.nodeId,
            admitAll(admission, [setStatus(racedFar, pending, "complete")], writerB)
          ),
          sql
        );
        const [farRaced] = yield* admitAll(farRacer, [setStatus(racedFar, pending, "active")]);

        expect(kindsOf(sequential)).toEqual(["landed", "rejected"]);
        expect(nearRaced.outcome).toBe("landed");
        expect(codesOf(farRaced)).toEqual(["backwardStatusMove"]);
        const heads = yield* Effect.forEach(rows, (row) => headOf(log, row.nodeId));
        expect(A.map(heads, (head) => head.text)).toEqual(A.map(rows, () => O.some(statusRow("complete"))));
        const holds = yield* admission.held;
        expect(holds).toEqual([]);
      })
    );

    it.effect(
      "rejects a status move outside the lifecycle, of an undeclared field or on a node with no single status value",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [row, plain, twice] = yield* seedFile(log, notes, [
          statusRow("pending"),
          "No status here.\n",
          "| active | pending |\n",
        ]);
        const undeclared = NodeOperation.cases.setStatus.make({
          nodeId: row.nodeId,
          expectedRevision: row.revisionId,
          transition: StatusTransition.make({ field: "phase", from: O.none(), to: StatusValue.make("P3") }),
        });

        const outcomes = yield* admitAll(admission, [
          setStatus(row, pending, "archived"),
          undeclared,
          setStatus(plain, pending, "active"),
          setStatus(twice, pending, "complete"),
        ]);

        expect(A.map(outcomes, codesOf)).toEqual([
          ["statusOutsideLifecycle"],
          ["statusOutsideLifecycle"],
          ["statusOutsideLifecycle"],
          ["statusOutsideLifecycle"],
        ]);
        expect(A.map(outcomes, pathsOf)).toEqual([["transition.to"], ["transition.field"], ["nodeId"], ["nodeId"]]);
      })
    );
    it.effect(
      "moves a status whose lifecycle values span words and overlap, and rejects a backward move to one",
      Effect.fnUntraced(function* () {
        const { log, sql } = yield* openLog();
        const notStarted = StatusValue.make("not started");
        const started = StatusValue.make("started");
        const fields = StatusFields.make({
          lifecycles: [StatusLifecycle.make({ field: "status", order: [notStarted, started, complete] })],
        });
        const admission = yield* openAdmission(log, sql, fields);
        const [row] = yield* seedFile(log, notes, [statusRow("not started")]);

        const [forward] = yield* admitAll(admission, [setStatus(row, notStarted, "started")]);
        const [backward] = yield* admitAll(admission, [setStatus(row, notStarted, "not started")]);

        expect(forward.outcome).toBe("landed");
        expect(codesOf(backward)).toEqual(["backwardStatusMove"]);
        const head = yield* headOf(log, row.nodeId);
        assertSome(head.text, statusRow("started"));
      })
    );
  });

  it.layer(TestPlatform)("held and resolve", (it) => {
    it.effect(
      "rebuilds the open holds from the log alone: a fresh layer over the same database reads the same holds",
      Effect.fnUntraced(function* () {
        const workspace = yield* tempDirectory("beep-admission-holds-");
        const database = `${workspace}/memory.db`;
        const firstStore = yield* openLog(database);
        const first = yield* openAdmission(firstStore.log, firstStore.sql);
        const [alpha, beta] = yield* seedFile(firstStore.log, notes, ["Alpha.\n", "Beta.\n"]);
        yield* admitAll(first, [replace(alpha, alpha.revisionId, "Alpha by B.\n"), remove(beta)], writerB);
        const outcomes = yield* admitAll(first, [
          replace(alpha, alpha.revisionId, "Alpha by A.\n"),
          insert(nodeIdOf(80), O.some(beta.nodeId), "- Under Beta.\n"),
        ]);
        const holds = yield* first.held;

        const secondStore = yield* openLog(database);
        const second = yield* openAdmission(secondStore.log, secondStore.sql);
        const rebuilt = yield* second.held;

        expect(rebuilt).toEqual(holds);
        expect(A.map(rebuilt, (conflict) => conflict.holdId)).toEqual(A.map(outcomes, holdIdOf));
        const [edit, placed] = rebuilt;
        assertSome(edit?.ours ?? O.none(), "Alpha by B.\n");
        assertNone(placed?.ours ?? O.some("unexpected"));
        assertNone(placed?.headRevision ?? O.some(bogusRevision));

        yield* first.resolve(holdIdOf(outcomes[0]), ours);
        const after = yield* second.held;
        expect(A.map(after, (conflict) => conflict.holdId)).toEqual([holdIdOf(outcomes[1])]);
      }),
      { timeout: 30_000 }
    );

    it.effect(
      "resolve ours keeps the log's text and closes the hold; a closed or unknown hold is not open",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha] = yield* seedFile(log, notes, ["Alpha.\n"]);
        const [byB] = yield* admitAll(admission, [replace(alpha, alpha.revisionId, "Alpha by B.\n")], writerB);
        const [outcome] = yield* admitAll(admission, [replace(alpha, alpha.revisionId, "Alpha by A.\n")]);
        const holdId = holdIdOf(outcome);

        const resolved = yield* admission.resolve(holdId, ours);

        expect(codesOf(resolved)).toEqual(["heldConflict"]);
        const head = yield* headOf(log, alpha.nodeId);
        expect(head.heads).toEqual([landedRevision(byB)]);
        const holds = yield* admission.held;
        expect(holds).toEqual([]);
        const again = yield* Effect.flip(admission.resolve(holdId, ours));
        assertInstanceOf(again, HoldNotOpenError);
        const unknown = yield* Effect.flip(admission.resolve(unknownHold, ours));
        assertInstanceOf(unknown, HoldNotOpenError);
      })
    );

    it.effect(
      "resolve theirs writes the held text on the node's current heads, never on the stale revision; merged writes the resolver's text",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, beta] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n"]);
        const [alphaB] = yield* admitAll(
          admission,
          [replace(alpha, alpha.revisionId, "Alpha by B.\n"), replace(beta, beta.revisionId, "Beta by B.\n")],
          writerB
        );
        const heldWrites = yield* admitAll(admission, [
          replace(alpha, alpha.revisionId, "Alpha by A.\n"),
          replace(beta, beta.revisionId, "Beta by A.\n"),
        ]);

        const theirsOutcome = yield* admission.resolve(holdIdOf(heldWrites[0]), theirs);
        const mergedOutcome = yield* admission.resolve(holdIdOf(heldWrites[1]), merged("Beta by A and B.\n"));

        const expected = yield* revisionAfter(alpha.nodeId, landedRevision(alphaB), "Alpha by A.\n");
        expect(landedRevision(theirsOutcome)).toBe(expected);
        const alphaHead = yield* headOf(log, alpha.nodeId);
        assertSome(alphaHead.text, "Alpha by A.\n");
        assertSome(alphaHead.author, writerA);
        const betaHead = yield* headOf(log, beta.nodeId);
        assertSome(betaHead.text, "Beta by A and B.\n");
        assertSome(betaHead.author, AdmissionResolverLineage);
        expect(betaHead.heads).toEqual([landedRevision(mergedOutcome)]);
        const entries = yield* log.entriesAfter(LogCursor.make(0));
        const resolutions = yield* Effect.forEach(
          A.filter(entries, (entry) => entry.event === HoldResolvedEvent.tag),
          (entry) => decodeResolved(entry.payload)
        );
        deepStrictEqual(
          A.map(resolutions, (resolution) => resolution.revisionId),
          [O.some(landedRevision(theirsOutcome)), O.some(landedRevision(mergedOutcome))]
        );
        expect(A.map(resolutions, (resolution) => resolution.author)).toEqual([
          AdmissionResolverLineage,
          AdmissionResolverLineage,
        ]);
        const holds = yield* admission.held;
        expect(holds).toEqual([]);
      })
    );

    it.effect(
      "resolve holds a write again when its node moved to another text since the hold, so no resolution overwrites a text its resolver was not shown",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, beta, gamma, delta] = yield* seedFile(log, notes, [
          "Alpha.\n",
          "Beta.\n",
          statusRow("pending"),
          "Delta.\n",
        ]);
        const landedByB = yield* admitAll(
          admission,
          [
            replace(alpha, alpha.revisionId, "Alpha by B.\n"),
            replace(beta, beta.revisionId, "Beta by B.\n"),
            remove(gamma),
            replace(delta, delta.revisionId, "Delta by B.\n"),
          ],
          writerB
        );
        const heldWrites = yield* admitAll(admission, [
          replace(alpha, alpha.revisionId, "Alpha by A.\n"),
          remove(beta),
          setStatus(gamma, pending, "active"),
          replace(delta, delta.revisionId, "Delta by A.\n"),
        ]);
        // Two holds on one node: the first resolution moves the node under the second.
        const [secondOnDelta] = yield* admitAll(
          admission,
          [replace(delta, delta.revisionId, "Delta by C.\n")],
          LineageId.make("agent-memory-store-p2:writer-c")
        );
        // Another writer lands on each held node after the hold opened.
        const writerD = LineageId.make("agent-memory-store-p2:writer-d");
        const movedOn = yield* admitAll(
          admission,
          [
            replace(alpha, landedRevision(landedByB[0]), "Alpha by D, keep me.\n"),
            replace(beta, landedRevision(landedByB[1]), "Beta by D, keep me.\n"),
          ],
          writerD
        );
        // The retired status row is revived outside admission.
        const revival = yield* reviseEvent(gamma.nodeId, landedRevision(landedByB[2]), statusRow("blocked"));
        yield* log.append(revival.event);
        const before = yield* admission.held;

        const alphaTheirs = yield* admission.resolve(holdIdOf(heldWrites[0]), theirs);
        const betaTheirs = yield* admission.resolve(holdIdOf(heldWrites[1]), theirs);
        const gammaMerged = yield* admission.resolve(holdIdOf(heldWrites[2]), merged(statusRow("active")));
        yield* admission.resolve(holdIdOf(heldWrites[3]), theirs);
        const deltaSecond = yield* admission.resolve(holdIdOf(secondOnDelta), theirs);

        // The hold read model still shows the text the hold recorded.
        assertSome(before[0]?.ours ?? O.none(), "Alpha by B.\n");
        // Every write whose node moved is held again under a new hold, with the current text as ours.
        const reheld = [alphaTheirs, betaTheirs, gammaMerged, deltaSecond];
        expect(kindsOf(reheld)).toEqual(["held", "held", "held", "held"]);
        expect(A.map(reheld, codesOf)).toEqual([
          ["staleExpectedRevision"],
          ["deleteVersusEdit"],
          ["staleExpectedRevision"],
          ["staleExpectedRevision"],
        ]);
        deepStrictEqual(
          A.map(reheld, (outcome) => heldOf(outcome).pipe(O.flatMap((held) => held.ours))),
          [
            O.some("Alpha by D, keep me.\n"),
            O.some("Beta by D, keep me.\n"),
            O.some(statusRow("blocked")),
            O.some("Delta by A.\n"),
          ]
        );
        expect(holdIdOf(alphaTheirs)).not.toBe(holdIdOf(heldWrites[0]));
        // Nothing was overwritten: each node still holds the text that moved it on.
        const heads = yield* Effect.forEach([alpha, beta, gamma, delta], (node) => headOf(log, node.nodeId));
        deepStrictEqual(
          A.map(heads, (head) => head.text),
          [
            O.some("Alpha by D, keep me.\n"),
            O.some("Beta by D, keep me.\n"),
            O.some(statusRow("blocked")),
            O.some("Delta by A.\n"),
          ]
        );
        const open = yield* admission.held;
        expect(A.map(open, (conflict) => conflict.holdId)).toEqual(A.map(reheld, holdIdOf));
        assertSome(open[0]?.ours ?? O.none(), "Alpha by D, keep me.\n");
        assertSome(open[0]?.headRevision ?? O.none(), landedRevision(movedOn[0]));
        // The old hold is closed; the new one resolves on the head its resolver was shown.
        const closed = yield* Effect.flip(admission.resolve(holdIdOf(heldWrites[0]), theirs));
        assertInstanceOf(closed, HoldNotOpenError);
        const settled = yield* admission.resolve(holdIdOf(alphaTheirs), merged("Alpha by A and D.\n"));
        const expected = yield* revisionAfter(alpha.nodeId, landedRevision(movedOn[0]), "Alpha by A and D.\n");
        expect(landedRevision(settled)).toBe(expected);
      })
    );

    it.effect(
      "resolve settles a held delete and a held edit of a retired node: theirs retires or revives, merged keeps a text",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, beta, gamma] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n", "Gamma.\n"]);
        yield* admitAll(
          admission,
          [
            replace(alpha, alpha.revisionId, "Alpha by B.\n"),
            replace(beta, beta.revisionId, "Beta by B.\n"),
            remove(gamma),
          ],
          writerB
        );
        const heldWrites = yield* admitAll(admission, [
          remove(alpha),
          remove(beta),
          replace(gamma, gamma.revisionId, "Gamma by A.\n"),
        ]);

        yield* admission.resolve(holdIdOf(heldWrites[0]), theirs);
        yield* admission.resolve(holdIdOf(heldWrites[1]), merged("Beta, kept.\n"));
        yield* admission.resolve(holdIdOf(heldWrites[2]), theirs);

        const alphaHead = yield* headOf(log, alpha.nodeId);
        const betaHead = yield* headOf(log, beta.nodeId);
        const gammaHead = yield* headOf(log, gamma.nodeId);
        expect(alphaHead.event).toBe("NodeRetired");
        assertSome(betaHead.text, "Beta, kept.\n");
        assertSome(gammaHead.text, "Gamma by A.\n");
      })
    );

    it.effect(
      "resolve places a held insert: after its retired anchor, held again while its predecessor is missing, or where the resolver says",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [, beta] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n"]);
        yield* admitAll(admission, [remove(beta)], writerB);
        const underAnchor = nodeIdOf(90);
        const afterMissing = nodeIdOf(91);
        const heldWrites = yield* admitAll(admission, [
          insert(underAnchor, O.some(beta.nodeId), "- Under Beta.\n"),
          insert(afterMissing, O.some(underAnchor), "- After that.\n"),
        ]);
        const missingHold = holdIdOf(heldWrites[1]);

        // Its predecessor has not landed: held again under the same hold.
        const again = yield* admission.resolve(missingHold, theirs);
        yield* admission.resolve(holdIdOf(heldWrites[0]), theirs);
        const placed = yield* admission.resolve(
          missingHold,
          ConflictResolution.cases.merged.make({
            text: "- At the top.\n",
            placement: O.some(InsertPlacement.make({ afterNodeId: O.none() })),
          })
        );

        expect(holdIdOf(again)).toBe(missingHold);
        expect(codesOf(again)).toEqual(["insertAfterMissingNode"]);
        const under = yield* createdOf(log, underAnchor);
        assertSome(under.after, beta.nodeId);
        const top = yield* createdOf(log, afterMissing);
        assertNone(top.after);
        expect(top.text).toBe("- At the top.\n");
        expect(landedRevision(placed)).toBe(top.revisionId);
        const holds = yield* admission.held;
        expect(holds).toEqual([]);
      })
    );

    it.effect(
      "resolve of a held status move re-runs the lifecycle guard on the current head",
      Effect.fnUntraced(function* () {
        const { log, sql } = yield* openLog();
        const admission = yield* openAdmission(log, sql);
        const rows = yield* seedFile(log, notes, [
          statusRow("pending"),
          statusRow("pending"),
          statusRow("pending"),
          statusRow("pending"),
        ]);
        const [kept, moved, rewritten, undeclared] = rows;
        yield* admitAll(admission, [remove(kept), remove(moved), remove(rewritten), remove(undeclared)], writerB);
        const heldMoves = yield* admitAll(admission, [
          setStatus(kept, pending, "active"),
          setStatus(moved, pending, "active"),
          setStatus(rewritten, pending, "active"),
          setStatus(undeclared, pending, "active"),
        ]);

        // A retired node holds no status value: refused, and the hold stays open.
        const refused = yield* admission.resolve(holdIdOf(heldMoves[0]), theirs);

        // Revive three nodes outside admission, one already at the target value.
        const revivals = [
          [kept, statusRow("active")],
          [moved, statusRow("pending")],
          [undeclared, statusRow("pending")],
        ] as const;
        for (const [row, text] of revivals) {
          const head = yield* headOf(log, row.nodeId);
          const parent = yield* Effect.fromOption(A.head(head.heads));
          const { event } = yield* reviseEvent(row.nodeId, parent, text);
          yield* log.append(event);
        }
        const unchanged = yield* admission.resolve(holdIdOf(heldMoves[0]), theirs);
        const forward = yield* admission.resolve(holdIdOf(heldMoves[1]), theirs);
        const replaced = yield* admission.resolve(holdIdOf(heldMoves[2]), merged(statusRow("complete")));
        const withoutLifecycle = yield* openAdmission(log, sql, StatusFields.make({ lifecycles: [] }));
        const unknownField = yield* withoutLifecycle.resolve(holdIdOf(heldMoves[3]), theirs);

        expect(codesOf(refused)).toEqual(["statusOutsideLifecycle"]);
        const keptHead = yield* headOf(log, kept.nodeId);
        expect([landedRevision(unchanged)]).toEqual(keptHead.heads);
        const movedHead = yield* headOf(log, moved.nodeId);
        expect([landedRevision(forward)]).toEqual(movedHead.heads);
        expect(movedHead.event).toBe(NodeStatusChangedEvent.tag);
        assertSome(movedHead.text, statusRow("active"));
        const rewrittenHead = yield* headOf(log, rewritten.nodeId);
        expect([landedRevision(replaced)]).toEqual(rewrittenHead.heads);
        assertSome(rewrittenHead.text, statusRow("complete"));
        expect(codesOf(unknownField)).toEqual(["statusOutsideLifecycle"]);
        const holds = yield* admission.held;
        expect(A.map(holds, (conflict) => conflict.holdId)).toEqual([holdIdOf(heldMoves[3])]);
        const entries = yield* log.entriesAfter(LogCursor.make(0));
        const resolutions = yield* Effect.forEach(
          A.filter(entries, (entry) => entry.event === HoldResolvedEvent.tag),
          (entry) => decodeResolved(entry.payload)
        );
        assertNone(resolutions[0]?.revisionId ?? O.some(bogusRevision));
      })
    );

    it.effect(
      "resolve of a write held on a node that never reached the log refuses theirs and closes with ours",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, beta] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n"]);
        yield* admitAll(admission, [remove(beta)], writerB);
        const missing = nodeIdOf(95);
        const [, dependent] = yield* admitAll(admission, [
          insert(missing, O.some(beta.nodeId), "- x\n"),
          replace({ nodeId: missing, revisionId: alpha.revisionId }, alpha.revisionId, "- y\n"),
        ]);
        const holdId = holdIdOf(dependent);

        const refused = yield* admission.resolve(holdId, theirs);
        const closed = yield* admission.resolve(holdId, ours);

        expect(codesOf(refused)).toEqual(["unknownNode"]);
        expect(codesOf(closed)).toEqual(["heldConflict"]);
      })
    );

    it.effect(
      "resolve holds a dependent write again once the insert it depends on is created, showing that insert's text",
      Effect.fnUntraced(function* () {
        const { log, admission } = yield* fresh();
        const [alpha, beta] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n"]);
        yield* admitAll(admission, [remove(beta)], writerB);
        const created = nodeIdOf(98);
        const [insertHold, dependentHold] = yield* admitAll(admission, [
          insert(created, O.some(beta.nodeId), "- x\n"),
          replace({ nodeId: created, revisionId: alpha.revisionId }, alpha.revisionId, "- y\n"),
        ]);

        const placed = yield* admission.resolve(holdIdOf(insertHold), theirs);
        const reheld = yield* admission.resolve(holdIdOf(dependentHold), theirs);
        const applied = yield* admission.resolve(holdIdOf(reheld), theirs);

        expect(codesOf(reheld)).toEqual(["staleExpectedRevision"]);
        assertSome(heldOf(reheld).pipe(O.flatMap((held) => held.ours)), "- x\n");
        const expected = yield* revisionAfter(created, landedRevision(placed), "- y\n");
        expect(landedRevision(applied)).toBe(expected);
        const holds = yield* admission.held;
        expect(holds).toEqual([]);
      })
    );

    it.effect(
      "two resolvers cannot both settle one hold",
      Effect.fnUntraced(function* () {
        const { log, sql } = yield* openLog();
        const first = yield* openAdmission(log, sql);
        const [alpha] = yield* seedFile(log, notes, ["Alpha.\n"]);
        const [byB] = yield* admitAll(first, [replace(alpha, alpha.revisionId, "Alpha by B.\n")], writerB);
        const [outcome] = yield* admitAll(first, [replace(alpha, alpha.revisionId, "Alpha by A.\n")]);
        const holdId = holdIdOf(outcome);
        // The second resolver reads the hold as open, then the first settles it.
        const second = yield* openAdmission(injectAfterEntries(log, first.resolve(holdId, ours)), sql);

        const error = yield* Effect.flip(second.resolve(holdId, theirs));

        assertInstanceOf(error, HoldNotOpenError);
        const entries = yield* log.entriesAfter(LogCursor.make(0));
        expect(A.filter(entries, (entry) => entry.event === HoldResolvedEvent.tag)).toHaveLength(1);
        expect(A.filter(entries, (entry) => entry.event === WriteHeldEvent.tag)).toHaveLength(1);
        const head = yield* headOf(log, alpha.nodeId);
        expect(head.heads).toEqual([landedRevision(byB)]);
      })
    );
    it.effect(
      "a resolve whose re-judgment appends nothing fails with HoldNotOpenError when another resolver closed the hold meanwhile",
      Effect.fnUntraced(function* () {
        const { log, sql } = yield* openLog();
        const first = yield* openAdmission(log, sql);
        const [, beta] = yield* seedFile(log, notes, ["Alpha.\n", "Beta.\n"]);
        yield* admitAll(first, [remove(beta)], writerB);
        const underAnchor = nodeIdOf(96);
        const heldWrites = yield* admitAll(first, [
          insert(underAnchor, O.some(beta.nodeId), "- Under Beta.\n"),
          insert(nodeIdOf(97), O.some(underAnchor), "- After that.\n"),
        ]);
        const anchorHold = holdIdOf(heldWrites[0]);
        const missingHold = holdIdOf(heldWrites[1]);

        // Re-judged as held again (its predecessor is still missing) after another resolver closed it.
        const heldAgain = yield* openAdmission(injectAfterEntries(log, first.resolve(missingHold, ours)), sql);
        const heldError = yield* Effect.flip(heldAgain.resolve(missingHold, theirs));
        // Re-judged as refused (its node now exists) after another resolver created it.
        const refused = yield* openAdmission(injectAfterEntries(log, first.resolve(anchorHold, theirs)), sql);
        const refusedError = yield* Effect.flip(refused.resolve(anchorHold, theirs));

        assertInstanceOf(heldError, HoldNotOpenError);
        expect(heldError.holdId).toBe(missingHold);
        assertInstanceOf(refusedError, HoldNotOpenError);
        expect(refusedError.holdId).toBe(anchorHold);
        const holds = yield* first.held;
        expect(holds).toEqual([]);
      })
    );
  });

  it.layer(TestPlatform)("failures", (it) => {
    it.effect(
      "log failures surface as typed AdmissionErrors, never as outcomes",
      Effect.fnUntraced(function* () {
        const { log, sql } = yield* openLog();
        const admission = yield* openAdmission(log, sql);
        const [alpha] = yield* seedFile(log, notes, ["Alpha.\n"]);
        yield* admitAll(admission, [replace(alpha, alpha.revisionId, "Alpha by B.\n")], writerB);
        const [outcome] = yield* admitAll(admission, [replace(alpha, alpha.revisionId, "Alpha by A.\n")]);
        const holdId = holdIdOf(outcome);
        const blind = yield* openAdmission(unreadable(log), sql);
        const mute = yield* openAdmission(unwritable(log), sql);

        const admitError = yield* Effect.flip(admitAll(blind, [replace(alpha, alpha.revisionId, "x\n")]));
        const heldError = yield* Effect.flip(blind.held);
        const resolveReadError = yield* Effect.flip(blind.resolve(holdId, ours));
        const appendError = yield* Effect.flip(admitAll(mute, [insert(nodeIdOf(99), O.none(), "x\n")]));
        const resolveWriteError = yield* Effect.flip(mute.resolve(holdId, theirs));

        assertInstanceOf(admitError, AdmissionError);
        expect(admitError.operation).toBe("admit");
        assertSome(admitError.nodeId, alpha.nodeId);
        assertInstanceOf(heldError, AdmissionError);
        expect(heldError.operation).toBe("held");
        assertInstanceOf(resolveReadError, AdmissionError);
        expect(resolveReadError.operation).toBe("resolve");
        assertNone(resolveReadError.nodeId);
        assertInstanceOf(appendError, AdmissionError);
        expect(appendError.operation).toBe("admit");
        assertInstanceOf(resolveWriteError, AdmissionError);
        assertSome(resolveWriteError.nodeId, alpha.nodeId);
        const holds = yield* admission.held;
        expect(holds).toHaveLength(1);
      })
    );
  });
});
