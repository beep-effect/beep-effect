/**
 * What admission reads from the memory log: one node's revisions and texts,
 * and the fold of every held write with whether it is still open.
 *
 * Decision `held-writes-are-log-events`: holds are `WriteHeld` and
 * `HoldResolved` events, so the hold fold is rebuilt from the log alone and a
 * fresh admission layer over the same database reads the same holds.
 *
 * @internal
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constVoid, dual } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  HoldResolvedEvent,
  NodeCreatedEvent,
  NodeRetiredEvent,
  NodeRevisedEvent,
  NodeStatusChangedEvent,
  WriteHeld,
  WriteHeldEvent,
} from "../NodeEvent.events.ts";
import { LogCursor, MemoryFilePath, NodeId, NodeKind, RevisionId } from "../NodeIdentity.models.ts";
import type { Entry } from "effect/eventlog/EventJournal";
import type { HoldId } from "../Admission.models.ts";
import type { MemoryLog } from "../MemoryLog.service.ts";

const $I = $AgentMemoryStoreId.create("internal/AdmissionLog");

const trusted = { disableChecks: true } as const;

/** One node as the log holds it. */
export class NodeState extends S.Opaque<NodeState, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: MemoryFilePath.annotateKey({ description: "Memory file the node belongs to." }),
    head: RevisionId.annotateKey({ description: "The node's one head revision." }),
    headText: S.Option(S.String).annotateKey({ description: "The head text; none when the node is retired." }),
    kind: NodeKind.annotateKey({ description: "Markdown construct of the node." }),
    nodeId: NodeId.annotateKey({ description: "The node." }),
    texts: S.Array(S.Tuple([RevisionId, S.Option(S.String)])).annotateKey({
      description: "Every revision of the node with its text, oldest first; none for a tombstone.",
    }),
  }).pipe(
    $I.annoteSchema("NodeState", {
      description: "One node as the memory log holds it, read by admission.",
    })
  )
) {}

/**
 * The text a node held at one of its revisions: none when the revision is
 * not the node's, some none when it is a tombstone.
 */
export const textAt: {
  (revisionId: RevisionId): (state: NodeState) => O.Option<O.Option<string>>;
  (state: NodeState, revisionId: RevisionId): O.Option<O.Option<string>>;
} = dual(
  2,
  (state: NodeState, revisionId: RevisionId): O.Option<O.Option<string>> =>
    O.map(
      A.findFirst(state.texts, ([revision]) => revision === revisionId),
      ([, text]) => text
    )
);

// One node event: the revision it produced and the text it left, plus the
// node's file and kind when the event created it.
interface Step {
  readonly place: O.Option<{ readonly filePath: MemoryFilePath; readonly kind: NodeKind }>;
  readonly revisionId: RevisionId;
  readonly text: O.Option<string>;
}

const decodeCreated = S.decodeUnknownEffect(NodeCreatedEvent.payloadSchemaBinary);
const decodeRevised = S.decodeUnknownEffect(NodeRevisedEvent.payloadSchemaBinary);
const decodeStatusChanged = S.decodeUnknownEffect(NodeStatusChangedEvent.payloadSchemaBinary);
const decodeRetired = S.decodeUnknownEffect(NodeRetiredEvent.payloadSchemaBinary);
const decodeWriteHeld = S.decodeUnknownEffect(WriteHeldEvent.payloadSchemaBinary);
const decodeHoldResolved = S.decodeUnknownEffect(HoldResolvedEvent.payloadSchemaBinary);

const liveStep = (payload: { readonly revisionId: RevisionId; readonly text: string }): Step => ({
  place: O.none(),
  revisionId: payload.revisionId,
  text: O.some(payload.text),
});

// `history` returns node events only, so an entry that is no creation,
// revision or status move is a retirement.
const stepOf = (entry: Entry): Effect.Effect<Step, S.SchemaError> =>
  Match.value(entry.event).pipe(
    Match.when(NodeCreatedEvent.tag, () =>
      Effect.map(decodeCreated(entry.payload), (payload) => ({
        place: O.some({ filePath: payload.filePath, kind: payload.kind }),
        revisionId: payload.revisionId,
        text: O.some(payload.text),
      }))
    ),
    Match.when(NodeRevisedEvent.tag, () => Effect.map(decodeRevised(entry.payload), liveStep)),
    Match.when(NodeStatusChangedEvent.tag, () => Effect.map(decodeStatusChanged(entry.payload), liveStep)),
    Match.orElse(() =>
      Effect.map(decodeRetired(entry.payload), (payload) => ({
        place: O.none(),
        revisionId: payload.revisionId,
        text: O.none<string>(),
      }))
    )
  );

/**
 * The node as the log holds it, or none when the log never held it.
 *
 * Every node keeps one head (decision
 * `memory-log-checks-parents-in-the-journal-transaction`), so the head is the
 * revision of the node's latest event.
 */
export const readNodeState = Effect.fnUntraced(function* (log: MemoryLog["Service"], nodeId: NodeId) {
  const entries = yield* log.history(nodeId);
  const steps = yield* Effect.forEach(entries, stepOf);
  return O.map(O.all({ place: A.findFirst(steps, (step) => step.place), last: A.last(steps) }), ({ place, last }) =>
    NodeState.make(
      {
        filePath: place.filePath,
        head: last.revisionId,
        headText: last.text,
        kind: place.kind,
        nodeId,
        texts: A.map(steps, (step) => [step.revisionId, step.text] as const),
      },
      trusted
    )
  );
});

/** One held write as the log records it. */
export class HoldRecord extends S.Opaque<HoldRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    held: WriteHeld.annotateKey({ description: "The WriteHeld payload." }),
    since: S.DateTimeUtc.annotateKey({ description: "Journal time of the hold." }),
  }).pipe(
    $I.annoteSchema("HoldRecord", {
      description: "One held write as the memory log records it, read by admission.",
    })
  )
) {}

/** The fold of every hold, owned and mutated by one admission layer. */
export class HoldFold {
  /** Holds a `HoldResolved` settled. */
  readonly closed = MutableHashSet.empty<HoldId>();
  cursor: LogCursor = LogCursor.make(0);
  readonly holds = MutableHashMap.empty<HoldId, HoldRecord>();
  /** Hold ids in commit order. */
  readonly order: Array<HoldId> = [];
}

/** The hold `holdId` names, while it is open. */
export const openHold: {
  (holdId: HoldId): (fold: HoldFold) => O.Option<HoldRecord>;
  (fold: HoldFold, holdId: HoldId): O.Option<HoldRecord>;
} = dual(
  2,
  (fold: HoldFold, holdId: HoldId): O.Option<HoldRecord> =>
    MutableHashSet.has(fold.closed, holdId) ? O.none() : MutableHashMap.get(fold.holds, holdId)
);

/** Every open hold, in commit order. */
export const openHolds = (fold: HoldFold): ReadonlyArray<HoldRecord> =>
  A.getSomes(A.map(fold.order, (holdId) => openHold(fold, holdId)));

/** An empty hold fold at cursor 0. */
export const makeHoldFold = (): HoldFold => new HoldFold();

// Decodes one entry and returns what folding it does to the holds; entries
// other than hold events change nothing.
const holdStep = (fold: HoldFold, entry: Entry): Effect.Effect<() => void, S.SchemaError> =>
  Match.value(entry.event).pipe(
    Match.when(WriteHeldEvent.tag, () =>
      Effect.map(decodeWriteHeld(entry.payload), (held) => () => {
        MutableHashMap.set(fold.holds, held.holdId, HoldRecord.make({ held, since: entry.createdAt }, trusted));
        fold.order.push(held.holdId);
      })
    ),
    Match.when(HoldResolvedEvent.tag, () =>
      Effect.map(decodeHoldResolved(entry.payload), (resolved) => () => {
        MutableHashSet.add(fold.closed, resolved.holdId);
      })
    ),
    Match.orElse(() => Effect.succeed(constVoid))
  );

/**
 * Folds the entries committed after the fold's cursor, advancing the cursor
 * past each one as it is folded, so a failed decode resumes where it stopped.
 */
export const catchUpHolds = Effect.fnUntraced(function* (log: MemoryLog["Service"], fold: HoldFold) {
  const entries = yield* log.entriesAfter(fold.cursor);
  for (const entry of entries) {
    const step = yield* holdStep(fold, entry);
    step();
    fold.cursor = LogCursor.make(fold.cursor + 1);
  }
});
