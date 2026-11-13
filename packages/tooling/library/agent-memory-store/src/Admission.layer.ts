/**
 * Live store-side admission over the memory log: per-operation per-node
 * compare-and-set, the P2 three-way merge, held writes as log events and
 * typed status fields with the lifecycle guard.
 *
 * **Details**
 *
 * {@link makeAdmissionLayer} provides {@link Admission} over {@link MemoryLog}
 * and the `SqlClient` the log writes through.
 *
 * - `admit` judges each operation of a batch on its own node and returns one
 *   outcome per operation in batch order. Each operation is judged and
 *   appended inside one SQL transaction, which on SQLite holds the write lock
 *   (`BEGIN IMMEDIATE`), so no other writer commits between an operation's
 *   judgment and its append; the log's own compare-and-set still refuses a
 *   stale append with `StaleParentsError`, and the operation is then judged
 *   again against the new heads (decision `admission-judges-each-operation-in-one-transaction`).
 * - The merge rule (decision `p2-three-way-merge-is-whole-node`): when the
 *   node moved on since the writer's revision, the write lands only when the
 *   log's text is still the base text; it changes nothing when both sides hold
 *   the same text or the writer left the base text unchanged; anything else is
 *   held with both texts. No text is ever merged character by character.
 * - A status move (`setStatus`) is a typed last-writer field (decision
 *   `typed-status-fields-are-whole-token-values`): it is judged against the
 *   log head, never the writer's base or the transition's `from`, and never
 *   held for concurrency; a forward move lands, an equal one changes nothing
 *   and a backward one is rejected with `backwardStatusMove`.
 * - `held` rebuilds the open holds from the log's `WriteHeld` and
 *   `HoldResolved` events, and `resolve` settles one with `ours`, `theirs` or
 *   `merged` on the node's heads at resolve time (decision
 *   `held-writes-are-log-events`). A `theirs` or `merged` resolution of a
 *   write whose node moved on to another text since the hold is not applied:
 *   the write is held again on the current head under a new hold id, so a
 *   resolution never overwrites a text its resolver was not shown (decision
 *   `resolve-re-holds-a-write-whose-node-moved-since-the-hold`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { constTrue } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as SqlClient from "effect/sql/SqlClient";
import { AdmissionOutcome, ConflictResolution, HeldConflict, HoldId } from "./Admission.models.ts";
import { Admission } from "./Admission.service.ts";
import { AdmissionError, HoldNotOpenError, StaleParentsError } from "./AgentMemoryStore.errors.ts";
import {
  catchUpHolds,
  holdClosedAfter,
  makeHoldFold,
  openHold,
  openHolds,
  readNodeState,
  textAt,
} from "./internal/AdmissionLog.ts";
import { finding, Plan, threeWay } from "./internal/AdmissionPlan.ts";
import { MemoryLog } from "./MemoryLog.service.ts";
import {
  HoldResolved,
  NodeCreated,
  NodeRetired,
  NodeRevised,
  NodeStatusChanged,
  WriteHeld,
} from "./NodeEvent.events.ts";
import { contentHashOf, revisionIdOf } from "./NodeIdentity.digest.ts";
import { TombstoneContentHash } from "./NodeIdentity.models.ts";
import { LineageId } from "./Observation.events.ts";
import { NodeOperation } from "./Operation.models.ts";
import { lifecycleOf, replaceStatusValue, statusValueIn } from "./StatusField.models.ts";
import { lifecycleAllows, StatusTransition } from "./StatusLifecycle.models.ts";
import type { MemoryGateViolation } from "./Admission.models.ts";
import type { HoldRecord, NodeState } from "./internal/AdmissionLog.ts";
import type { MemoryEvent } from "./NodeEvent.events.ts";
import type { LogCursor, NodeId, RevisionId } from "./NodeIdentity.models.ts";
import type { InsertPlacement, OperationBatch } from "./Operation.models.ts";
import type { StatusFields } from "./StatusField.models.ts";
import type { StatusLifecycle } from "./StatusLifecycle.models.ts";

/**
 * Lineage `resolve` writes its `HoldResolved` events and merged texts under.
 *
 * **Details**
 *
 * The `Admission.resolve` contract names no resolver, so the store records
 * one fixed lineage for the resolution itself (decision
 * `resolutions-are-written-under-a-fixed-resolver-lineage`). A `theirs`
 * resolution writes the held text under the lineage that submitted it; a
 * `merged` text is the resolver's and is written under this lineage.
 *
 * **Example** (Read the resolver lineage)
 *
 * ```ts
 * import { AdmissionResolverLineage } from "@beep/agent-memory-store"
 *
 * console.log(AdmissionResolverLineage) // "agent-memory-store:resolve"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AdmissionResolverLineage: LineageId = LineageId.make("agent-memory-store:resolve");

type InsertOperation = typeof NodeOperation.cases.insert.Type;
type SetStatusOperation = typeof NodeOperation.cases.setStatus.Type;

// What a replace, delete or status move names: a node and the revision the
// writer edited against.
interface RevisionTarget {
  readonly expectedRevision: RevisionId;
  readonly nodeId: NodeId;
}

const isStaleParents = S.is(StaleParentsError);
const isHoldNotOpen = S.is(HoldNotOpenError);

const failure = (operation: string, nodeId: O.Option<NodeId>) => (cause: unknown) =>
  AdmissionError.make({ ...AdmissionError.fromUnknown(operation, cause), nodeId });

const landed = (nodeId: NodeId, revisionId: RevisionId) => AdmissionOutcome.cases.landed.make({ nodeId, revisionId });

const rejected = (violation: MemoryGateViolation) => AdmissionOutcome.cases.rejected.make({ violations: [violation] });

const refuse = (input: Parameters<typeof finding>[0]) => Effect.succeed(Plan.Refuse({ violation: finding(input) }));

const keep = (state: NodeState) => Effect.succeed(Plan.Keep({ nodeId: state.nodeId, revisionId: state.head }));

// The agent's text of an operation; a delete and a status move carry none.
const theirsOf = (operation: NodeOperation): O.Option<string> =>
  NodeOperation.match(operation, {
    replace: (replace) => O.some(replace.text),
    insert: (insert) => O.some(insert.text),
    delete: () => O.none(),
    setStatus: () => O.none(),
  });

// A write to a retired node: held with no logged text.
const heldRetired = (state: NodeState, message: string) =>
  Effect.succeed(
    Plan.Hold({
      headRevision: O.some(state.head),
      ours: O.none(),
      violation: finding({ code: "deleteVersusEdit", nodeId: state.nodeId, path: "nodeId", message }),
    })
  );

const make = Effect.fnUntraced(function* (statusFields: StatusFields) {
  const log = yield* MemoryLog;
  const sql = yield* SqlClient.SqlClient;
  const digest = yield* Digest.Digest;
  const random = yield* SecureRandom.SecureRandom;
  const lock = yield* Semaphore.make(1);
  const fold = makeHoldFold();

  const nodeState = (nodeId: NodeId) => readNodeState(log, nodeId);

  const hashed = <A, E>(effect: Effect.Effect<A, E, Digest.Digest>) =>
    Effect.provideService(effect, Digest.Digest, digest);

  const revisionOf = Effect.fnUntraced(function* (state: NodeState, text: string) {
    const contentHash = yield* hashed(contentHashOf(text));
    const revisionId = yield* hashed(revisionIdOf(state.nodeId, [state.head], contentHash));
    return { contentHash, revisionId };
  });

  const revise = Effect.fnUntraced(function* (state: NodeState, text: string, author: LineageId) {
    const { contentHash, revisionId } = yield* revisionOf(state, text);
    return Plan.Write({
      nodeId: state.nodeId,
      revisionId,
      event: {
        _tag: "NodeRevised",
        payload: NodeRevised.make({
          nodeId: state.nodeId,
          revisionId,
          parents: [state.head],
          contentHash,
          text,
          author,
        }),
      },
    });
  });

  const moveStatus = Effect.fnUntraced(function* (
    state: NodeState,
    text: string,
    transition: StatusTransition,
    author: LineageId
  ) {
    const { contentHash, revisionId } = yield* revisionOf(state, text);
    return Plan.Write({
      nodeId: state.nodeId,
      revisionId,
      event: {
        _tag: "NodeStatusChanged",
        payload: NodeStatusChanged.make({
          nodeId: state.nodeId,
          revisionId,
          parents: [state.head],
          contentHash,
          text,
          transition,
          author,
        }),
      },
    });
  });

  const retire = Effect.fnUntraced(function* (state: NodeState, author: LineageId) {
    const revisionId = yield* hashed(revisionIdOf(state.nodeId, [state.head], TombstoneContentHash));
    return Plan.Write({
      nodeId: state.nodeId,
      revisionId,
      event: {
        _tag: "NodeRetired",
        payload: NodeRetired.make({ nodeId: state.nodeId, revisionId, parents: [state.head], author }),
      },
    });
  });

  const create = Effect.fnUntraced(function* (
    insert: InsertOperation,
    after: O.Option<NodeId>,
    text: string,
    author: LineageId
  ) {
    const contentHash = yield* hashed(contentHashOf(text));
    const revisionId = yield* hashed(revisionIdOf(insert.nodeId, [], contentHash));
    return Plan.Write({
      nodeId: insert.nodeId,
      revisionId,
      event: {
        _tag: "NodeCreated",
        payload: NodeCreated.make({
          nodeId: insert.nodeId,
          kind: insert.kind,
          contentHash,
          revisionId,
          text,
          anchor: O.none(),
          filePath: insert.filePath,
          after,
          author,
        }),
      },
    });
  });

  // The lifecycle a status move names, when its field has one and its target
  // value is in it.
  const lifecycleFor = (setStatus: SetStatusOperation): Result.Result<StatusLifecycle, MemoryGateViolation> =>
    O.match(lifecycleOf(statusFields, setStatus.transition.field), {
      onNone: () =>
        Result.fail(
          finding({
            code: "statusOutsideLifecycle",
            nodeId: setStatus.nodeId,
            path: "transition.field",
            message: `No lifecycle is declared for the status field ${setStatus.transition.field}.`,
          })
        ),
      onSome: (lifecycle) =>
        A.contains(lifecycle.order, setStatus.transition.to)
          ? Result.succeed(lifecycle)
          : Result.fail(
              finding({
                code: "statusOutsideLifecycle",
                nodeId: setStatus.nodeId,
                path: "transition.to",
                message: `${setStatus.transition.to} is not a value of the ${lifecycle.field} lifecycle.`,
              })
            ),
    });

  // The lifecycle guard: the move is judged against the value the head text
  // holds, never the writer's base or the transition's `from`.
  const statusPlan = (
    lifecycle: StatusLifecycle,
    setStatus: SetStatusOperation,
    state: NodeState,
    text: string,
    author: LineageId
  ) =>
    O.match(statusValueIn(lifecycle, text), {
      onNone: () =>
        refuse({
          code: "statusOutsideLifecycle",
          nodeId: state.nodeId,
          path: "nodeId",
          message: `The node text holds no single value of the ${lifecycle.field} lifecycle.`,
        }),
      onSome: (current) => {
        const transition = StatusTransition.make({
          field: lifecycle.field,
          from: O.some(current),
          to: setStatus.transition.to,
        });
        return current === transition.to
          ? keep(state)
          : lifecycleAllows(lifecycle, transition)
            ? moveStatus(state, replaceStatusValue(text, current, transition.to), transition, author)
            : refuse({
                code: "backwardStatusMove",
                nodeId: state.nodeId,
                path: "transition.to",
                message: `The log holds ${current}; moving it to ${transition.to} goes backward.`,
              });
      },
    });

  // An insert: refused when its id is taken or its predecessor is no node of
  // its file; held when its predecessor never reached the log, or, when
  // `holdUnderRetired`, when its predecessor is retired.
  const insertPlan = Effect.fnUntraced(function* (
    insert: InsertOperation,
    after: O.Option<NodeId>,
    text: string,
    author: LineageId,
    isMissing: (nodeId: NodeId) => boolean,
    holdUnderRetired: boolean
  ) {
    const own = yield* nodeState(insert.nodeId);
    if (O.isSome(own)) {
      return Plan.Refuse({
        violation: finding({
          code: "nodeIdAlreadyExists",
          nodeId: insert.nodeId,
          path: "nodeId",
          message: "The log already holds this node id.",
        }),
      });
    }
    if (O.isNone(after)) {
      return yield* create(insert, after, text, author);
    }
    const predecessor = yield* nodeState(after.value);
    if (O.isNone(predecessor)) {
      return isMissing(after.value)
        ? Plan.Hold({
            headRevision: O.none(),
            ours: O.none(),
            violation: finding({
              code: "insertAfterMissingNode",
              nodeId: insert.nodeId,
              path: "afterNodeId",
              message: "The node this insert follows never reached the log.",
            }),
          })
        : Plan.Refuse({
            violation: finding({
              code: "unknownNode",
              nodeId: insert.nodeId,
              path: "afterNodeId",
              message: "The log never held the node this insert follows.",
            }),
          });
    }
    if (predecessor.value.filePath !== insert.filePath) {
      return Plan.Refuse({
        violation: finding({
          code: "unknownNode",
          nodeId: insert.nodeId,
          path: "afterNodeId",
          message: "The node this insert follows belongs to another file.",
        }),
      });
    }
    if (holdUnderRetired && O.isNone(predecessor.value.headText)) {
      return Plan.Hold({
        headRevision: O.none(),
        ours: O.none(),
        violation: finding({
          code: "insertUnderDeletedAnchor",
          nodeId: insert.nodeId,
          path: "afterNodeId",
          message: "The node this insert follows was retired.",
        }),
      });
    }
    return yield* create(insert, after, text, author);
  });

  // A replace, delete or status move: refused when its node or expected
  // revision is unknown, held when its node is an insert of the same batch
  // that did not land, otherwise judged by `then` with the base text.
  const onKnownRevision = Effect.fnUntraced(function* (
    target: RevisionTarget,
    missing: MutableHashSet.MutableHashSet<NodeId>,
    then: (state: NodeState, base: O.Option<string>) => Effect.Effect<Plan>
  ) {
    const state = yield* nodeState(target.nodeId);
    if (O.isNone(state)) {
      return MutableHashSet.has(missing, target.nodeId)
        ? Plan.Hold({
            headRevision: O.none(),
            ours: O.none(),
            violation: finding({
              code: "insertAfterMissingNode",
              nodeId: target.nodeId,
              path: "nodeId",
              message: "The insert of this batch that creates the node did not land.",
            }),
          })
        : Plan.Refuse({
            violation: finding({
              code: "unknownNode",
              nodeId: target.nodeId,
              path: "nodeId",
              message: "The log never held this node.",
            }),
          });
    }
    const base = textAt(state.value, target.expectedRevision);
    if (O.isNone(base)) {
      return Plan.Refuse({
        violation: finding({
          code: "unknownRevision",
          nodeId: target.nodeId,
          path: "expectedRevision",
          message: "The expected revision was never a revision of this node.",
        }),
      });
    }
    return yield* then(state.value, base.value);
  });

  const judge = (author: LineageId, missing: MutableHashSet.MutableHashSet<NodeId>) =>
    NodeOperation.match({
      replace: (replace) =>
        onKnownRevision(replace, missing, (state, base) =>
          O.match(state.headText, {
            onNone: () => heldRetired(state, "The node was retired; this write revises it."),
            onSome: (ours) =>
              threeWay<Effect.Effect<Plan>>(
                { base, ours, theirs: replace.text },
                {
                  keepOurs: () => keep(state),
                  takeTheirs: () => revise(state, replace.text, author),
                  contested: () =>
                    Effect.succeed(
                      Plan.Hold({
                        headRevision: O.some(state.head),
                        ours: O.some(ours),
                        violation: finding({
                          code: "staleExpectedRevision",
                          nodeId: state.nodeId,
                          path: "expectedRevision",
                          message: "The node moved on since the expected revision and both sides changed its text.",
                        }),
                      })
                    ),
                }
              ),
          })
        ),
      insert: (insert) =>
        insertPlan(
          insert,
          insert.afterNodeId,
          insert.text,
          author,
          (nodeId) => MutableHashSet.has(missing, nodeId),
          true
        ),
      delete: (remove) =>
        onKnownRevision(remove, missing, (state, base) =>
          O.match(state.headText, {
            onNone: () => keep(state),
            onSome: (ours) =>
              O.contains(base, ours)
                ? retire(state, author)
                : Effect.succeed(
                    Plan.Hold({
                      headRevision: O.some(state.head),
                      ours: O.some(ours),
                      violation: finding({
                        code: "deleteVersusEdit",
                        nodeId: state.nodeId,
                        path: "expectedRevision",
                        message: "The node was revised since the expected revision; this write retires it.",
                      }),
                    })
                  ),
          })
        ),
      setStatus: (setStatus) =>
        Result.match(lifecycleFor(setStatus), {
          onFailure: (violation) => Effect.succeed(Plan.Refuse({ violation })),
          onSuccess: (lifecycle) =>
            onKnownRevision(setStatus, missing, (state) =>
              O.match(state.headText, {
                onNone: () => heldRetired(state, "The node was retired; this write moves its status."),
                onSome: (text) => statusPlan(lifecycle, setStatus, state, text, author),
              })
            ),
        }),
    });

  // Appends a held write as a `WriteHeld` under a store-minted hold id, after
  // `before` in the same journal transaction.
  const holdWrite = Effect.fnUntraced(function* (
    operation: NodeOperation,
    author: LineageId,
    hold: Extract<Plan, { readonly _tag: "Hold" }>,
    before: ReadonlyArray<MemoryEvent>
  ) {
    const uuid = yield* random.uuidV7();
    const holdId = HoldId.make(uuid);
    const violations = A.of(hold.violation);
    yield* log.appendMany(
      A.append(before, {
        _tag: "WriteHeld",
        payload: WriteHeld.make({ holdId, operation, author, headRevision: hold.headRevision, violations }),
      })
    );
    return AdmissionOutcome.cases.held.make({
      holdId,
      nodeId: operation.nodeId,
      ours: hold.ours,
      theirs: theirsOf(operation),
      violations,
    });
  });

  // Carries out an `admit` plan: a write is appended alone, a hold as a
  // `WriteHeld`.
  const admitPlan = (operation: NodeOperation, author: LineageId) =>
    Plan.$match({
      Write: ({ event, nodeId, revisionId }) => Effect.as(log.append(event), landed(nodeId, revisionId)),
      Keep: ({ nodeId, revisionId }) => Effect.succeed(landed(nodeId, revisionId)),
      Refuse: ({ violation }) => Effect.succeed(rejected(violation)),
      Hold: (hold) => holdWrite(operation, author, hold, []),
    });

  // One operation, judged and appended in one transaction; a stale append is
  // judged again against the heads that beat it.
  const admitOne = (operation: NodeOperation, author: LineageId, missing: MutableHashSet.MutableHashSet<NodeId>) =>
    sql
      .withTransaction(
        judge(
          author,
          missing
        )(operation).pipe(
          Effect.flatMap(admitPlan(operation, author)),
          Effect.retry({ times: 2, while: isStaleParents })
        )
      )
      .pipe(Effect.mapError(failure("admit", O.some(operation.nodeId))));

  const admit = Effect.fn("Admission.admit")(function* (batch: OperationBatch) {
    // Inserts of this batch that did not land, so later operations that
    // depend on them are held rather than refused.
    const missing = MutableHashSet.empty<NodeId>();
    const outcomes: Array<AdmissionOutcome> = [];
    for (const operation of batch.operations) {
      const outcome = yield* admitOne(operation, batch.author, missing);
      if (NodeOperation.guards.insert(operation) && outcome.outcome !== "landed") {
        MutableHashSet.add(missing, operation.nodeId);
      }
      outcomes.push(outcome);
    }
    return outcomes;
  });

  const catchUp = lock.withPermit(catchUpHolds(log, fold));

  // The read model of one hold: `ours` is the text the log held at the hold.
  const conflictOf = Effect.fnUntraced(function* (record: HoldRecord) {
    const { held } = record;
    const state = yield* nodeState(held.operation.nodeId);
    const ours = O.flatMap(O.all([state, held.headRevision]), ([node, revision]) => O.flatten(textAt(node, revision)));
    return HeldConflict.make({
      holdId: held.holdId,
      operation: held.operation,
      author: held.author,
      nodeId: held.operation.nodeId,
      headRevision: held.headRevision,
      ours,
      theirs: theirsOf(held.operation),
      since: record.since,
      violations: held.violations,
    });
  });

  const held = catchUp.pipe(
    Effect.flatMap(() => Effect.forEach(openHolds(fold), conflictOf)),
    Effect.mapError(failure("held", O.none())),
    Effect.withSpan("Admission.held")
  );

  // A replace, delete or status move resolved on the node's current head.
  const onCurrent = Effect.fnUntraced(function* (nodeId: NodeId, then: (state: NodeState) => Effect.Effect<Plan>) {
    const state = yield* nodeState(nodeId);
    if (O.isNone(state)) {
      return Plan.Refuse({
        violation: finding({
          code: "unknownNode",
          nodeId,
          path: "nodeId",
          message: "The log holds no node to write the resolution on.",
        }),
      });
    }
    return yield* then(state.value);
  });

  // A held status move applied with `theirs`: the lifecycle guard runs again
  // on the node's current head, under the resolving layer's lifecycles.
  const replayStatus = (setStatus: SetStatusOperation, state: NodeState, author: LineageId) =>
    Result.match(lifecycleFor(setStatus), {
      onFailure: (violation) => Effect.succeed(Plan.Refuse({ violation })),
      onSuccess: (lifecycle) =>
        O.match(state.headText, {
          onNone: () =>
            refuse({
              code: "statusOutsideLifecycle",
              nodeId: state.nodeId,
              path: "nodeId",
              message: "The node is retired and holds no status value.",
            }),
          onSome: (text) => statusPlan(lifecycle, setStatus, state, text, author),
        }),
    });

  // Whether the node moved on to another text since the hold, so a resolution
  // written now would replace a text the hold never showed its resolver. A
  // hold that recorded no head showed no text: its node had not reached the
  // log, so a node that holds a text now has moved.
  const movedSince = (record: HoldRecord, state: NodeState): boolean =>
    !Equal.equals(
      O.flatMap(record.held.headRevision, (revision) => O.flatten(textAt(state, revision))),
      state.headText
    );

  // Runs `then` when the node still holds the text the hold recorded; when it
  // moved on, the write is held again on the current head with that text as
  // `ours`, and the resolution is not applied.
  const unmoved = (record: HoldRecord, state: NodeState, then: () => Effect.Effect<Plan>) =>
    movedSince(record, state)
      ? Effect.succeed(
          Plan.Hold({
            headRevision: O.some(state.head),
            ours: state.headText,
            violation: finding({
              code: NodeOperation.guards.delete(record.held.operation) ? "deleteVersusEdit" : "staleExpectedRevision",
              nodeId: state.nodeId,
              path: "expectedRevision",
              message: "The node moved on since the write was held; it is held again on the current head.",
            }),
          })
        )
      : then();

  // What `theirs` (no merged text) or `merged` writes for a held write, judged
  // on the node as the log holds it now. A merged text replaces the held
  // write's text and is the resolver's; `theirs` writes under the held
  // write's author.
  const settlePlan = (record: HoldRecord, mergedText: O.Option<string>, placement: O.Option<InsertPlacement>) => {
    const { held: write } = record;
    const author = O.isSome(mergedText) ? AdmissionResolverLineage : write.author;
    return NodeOperation.match(write.operation, {
      insert: (insert) =>
        insertPlan(
          insert,
          O.match(placement, { onNone: () => insert.afterNodeId, onSome: (place) => place.afterNodeId }),
          O.getOrElse(mergedText, () => insert.text),
          author,
          constTrue,
          false
        ),
      replace: (replace) =>
        onCurrent(replace.nodeId, (state) =>
          unmoved(record, state, () =>
            revise(
              state,
              O.getOrElse(mergedText, () => replace.text),
              author
            )
          )
        ),
      delete: (remove) =>
        onCurrent(remove.nodeId, (state) =>
          unmoved(record, state, () =>
            O.match(mergedText, {
              onNone: () => retire(state, author),
              onSome: (text) => revise(state, text, author),
            })
          )
        ),
      // A status move rewrites only the status token of the current text, so
      // `theirs` needs no unmoved head; a merged text replaces the whole text.
      setStatus: (setStatus) =>
        onCurrent(setStatus.nodeId, (state) =>
          O.match(mergedText, {
            onSome: (text) => unmoved(record, state, () => revise(state, text, author)),
            onNone: () => replayStatus(setStatus, state, author),
          })
        ),
    });
  };

  const settled = (holdId: HoldId, resolution: ConflictResolution, revisionId: O.Option<RevisionId>): MemoryEvent => ({
    _tag: "HoldResolved",
    payload: HoldResolved.make({ holdId, resolution, author: AdmissionResolverLineage, revisionId }),
  });

  // Carries out a `resolve` plan: a write lands with the `HoldResolved` that
  // settles the hold, in one journal transaction; a refusal or a renewed hold
  // on the same head appends nothing and leaves the hold open; a hold on a
  // head that moved since closes this hold and holds the write again under a
  // new hold id, in one journal transaction.
  const resolvePlan = (record: HoldRecord, resolution: ConflictResolution) =>
    Plan.$match({
      Write: ({ event, nodeId, revisionId }) =>
        Effect.as(
          log.appendMany([event, settled(record.held.holdId, resolution, O.some(revisionId))]),
          landed(nodeId, revisionId)
        ),
      Keep: ({ nodeId, revisionId }) =>
        Effect.as(log.append(settled(record.held.holdId, resolution, O.none())), landed(nodeId, revisionId)),
      Refuse: ({ violation }) => Effect.succeed(rejected(violation)),
      Hold: (hold) =>
        Equal.equals(hold.headRevision, record.held.headRevision)
          ? Effect.succeed(
              AdmissionOutcome.cases.held.make({
                holdId: record.held.holdId,
                nodeId: record.held.operation.nodeId,
                ours: hold.ours,
                theirs: theirsOf(record.held.operation),
                violations: [hold.violation],
              })
            )
          : holdWrite(record.held.operation, record.held.author, hold, [
              settled(record.held.holdId, resolution, O.none()),
            ]),
    });

  // `ours` keeps what the log holds: the hold closes and the held write ends
  // rejected by the resolver.
  const keepOurs = (record: HoldRecord, resolution: ConflictResolution) =>
    Effect.as(
      log.append(settled(record.held.holdId, resolution, O.none())),
      rejected(
        finding({
          code: "heldConflict",
          nodeId: record.held.operation.nodeId,
          path: "resolution",
          message: "The resolver kept the log's text; the held write was not applied.",
        })
      )
    );

  const settle = (record: HoldRecord, resolution: ConflictResolution) =>
    ConflictResolution.match(resolution, {
      ours: () => keepOurs(record, resolution),
      theirs: (theirs) =>
        Effect.flatMap(settlePlan(record, O.none(), theirs.placement), resolvePlan(record, resolution)),
      merged: (merged) =>
        Effect.flatMap(settlePlan(record, O.some(merged.text), merged.placement), resolvePlan(record, resolution)),
    });

  // Fails when a `HoldResolved` for the hold committed after `cursor`: another
  // resolver closed it since the fold read it open. Run inside the resolve
  // transaction, which holds the write lock, so it cannot close afterwards.
  const stillOpen = Effect.fnUntraced(function* (holdId: HoldId, cursor: LogCursor) {
    const closed = yield* holdClosedAfter(log, cursor, holdId);
    if (closed) {
      return yield* HoldNotOpenError.make({ holdId });
    }
  });

  const resolve = Effect.fn("Admission.resolve")(function* (holdId: HoldId, resolution: ConflictResolution) {
    yield* catchUp.pipe(Effect.mapError(failure("resolve", O.none())));
    const record = openHold(fold, holdId);
    const cursor = fold.cursor;
    if (O.isNone(record)) {
      return yield* HoldNotOpenError.make({ holdId });
    }
    const open = record.value;
    // The hold is checked open again inside the transaction, so a re-judgment
    // that appends nothing never answers for a hold another resolver closed;
    // the log also refuses a HoldResolved for a closed hold, so of two
    // resolvers exactly one settles it.
    return yield* sql
      .withTransaction(Effect.andThen(stillOpen(holdId, cursor), settle(open, resolution)))
      .pipe(
        Effect.mapError((error) =>
          isHoldNotOpen(error) ? error : failure("resolve", O.some(open.held.operation.nodeId))(error)
        )
      );
  });

  return Admission.of({ admit, held, resolve });
});

/**
 * Live {@link Admission} over {@link MemoryLog} and the `SqlClient` the log
 * writes through.
 *
 * **Details**
 *
 * `statusFields` are the status lifecycles the layer applies (decision
 * `status-values-are-manifest-data`): a `setStatus` operation names its field
 * and admission reads the field's value from the node's head text as one
 * whole token (decision `typed-status-fields-are-whole-token-values`).
 *
 * Outcomes per operation, in batch order:
 *
 * - `landed`: the write is in the log at `revisionId`, or changed nothing
 *   because the node already holds it (the head revision, no event appended).
 * - `held`: the write is a `WriteHeld` event under a store-minted `HoldId`,
 *   with finding `staleExpectedRevision` (both sides changed the text),
 *   `deleteVersusEdit`, `insertUnderDeletedAnchor` or `insertAfterMissingNode`.
 * - `rejected`: `unknownNode`, `unknownRevision`, `nodeIdAlreadyExists`,
 *   `statusOutsideLifecycle` or `backwardStatusMove`.
 *
 * P2 never returns `deferred`: exact-hash deferral arrives with P3.
 *
 * **Example** (Compose admission over a memory log)
 *
 * ```ts
 * import { makeAdmissionLayer, MemoryLogLayer, makeMemorySqlClientLayer, StatusFields } from "@beep/agent-memory-store"
 * import * as Layer from "effect/Layer"
 *
 * const store = makeAdmissionLayer(StatusFields.make({ lifecycles: [] })).pipe(
 *   Layer.provideMerge(MemoryLogLayer),
 *   Layer.provide(makeMemorySqlClientLayer({ filename: ":memory:" }))
 * )
 * console.log(store)
 * ```
 *
 * @param statusFields - The status lifecycles admission applies.
 * @returns A layer providing admission over the memory log and its SQL client.
 * @category layers
 * @since 0.0.0
 */
export const makeAdmissionLayer = (
  statusFields: StatusFields
): Layer.Layer<Admission, never, MemoryLog | SqlClient.SqlClient> =>
  Layer.effect(Admission, make(statusFields)).pipe(
    Layer.provide(Layer.mergeAll(Digest.layerWebCrypto, SecureRandom.layerWebCrypto))
  );
