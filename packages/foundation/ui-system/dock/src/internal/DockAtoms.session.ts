/**
 * Headless Effect Atom session for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { Cause, Context, Effect, Exit, FiberSet, Layer, MutableRef, Semaphore } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import { AsyncResult, AtomRegistry, Reactivity } from "effect/unstable/reactivity";
import {
  DockAtomFeedFailure,
  DockAtomFeedSuccess,
  DockAtomOperation,
  DockMutationCompleted,
  DockSnapshotSaved,
} from "../Dock.protocol.ts";
import type { Atom } from "effect/unstable/reactivity";
import type { DockAtomFeedEntry, DockAtomOperationOutcome, DockAtomSessionError } from "../Dock.protocol.ts";

export { DockAtomSessionError } from "../Dock.protocol.ts";

import { thunkEffectVoid } from "@beep/utils";
import { DockMutationResult } from "../Dock.outcomes.ts";
import { DockEngine, DockSnapshotStore, requireSnapshot } from "../DockEngine.service.ts";
import type { DockMutationOutcome } from "../Dock.outcomes.ts";
import type { DockWorkspace } from "../Dock.tree.ts";

const $I = $DockId.create("DockAtoms.session");

/** Shared reactivity key for persisted dock snapshots. */
export const SNAPSHOT_REACTIVITY_KEY = "dockview-snapshot";

interface DockAtomSessionShape {
  readonly awaitIdle: Effect.Effect<void>;
  readonly submitUnsafe: (operation: DockAtomOperation) => void;
}

/** Per-registry capability that serializes every stateful session operation. */
export class DockAtomSession extends Context.Service<DockAtomSession, DockAtomSessionShape>()($I`DockAtomSession`) {}

/**
 * Constructs the session layer bound to one dock atom graph.
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDockAtomSessionLayer = (
  stateAtom: Atom.Writable<DockWorkspace>,
  operationResultAtom: Atom.Writable<AsyncResult.AsyncResult<DockAtomOperationOutcome, DockAtomSessionError>>,
  operationFeedAtom: Atom.Writable<ReadonlyArray<DockAtomFeedEntry>>
): Layer.Layer<
  DockAtomSession,
  never,
  AtomRegistry.AtomRegistry | Reactivity.Reactivity | DockEngine | DockSnapshotStore
> =>
  Layer.effect(
    DockAtomSession,
    Effect.gen(function* () {
      const registry = yield* AtomRegistry.AtomRegistry;
      const reactivity = yield* Reactivity.Reactivity;
      const engine = yield* DockEngine;
      const store = yield* DockSnapshotStore;
      const mutationGate = yield* Semaphore.make(1);
      const fibers = yield* FiberSet.make<void, never>();
      const runFork = yield* FiberSet.runtime(fibers)<never>();
      const latestSubmission = MutableRef.make(0);

      const appendFeed = (entry: DockAtomFeedEntry): Effect.Effect<void> =>
        Effect.sync(() => registry.update(operationFeedAtom, A.append(entry)));

      const publishMutation = Effect.fn("DockAtomSession.publishMutation")(function* (outcome: DockMutationOutcome) {
        yield* DockMutationResult.match(outcome.result, {
          Changed: (changed) => Effect.sync(() => registry.set(stateAtom, changed.state)),
          Unchanged: thunkEffectVoid,
        });
        return DockMutationCompleted.make({
          outcome,
        });
      });

      const runOperation = Effect.fn("DockAtomSession.runOperation")((operation: DockAtomOperation) =>
        DockAtomOperation.match(operation, {
          dispatchCommand: ({ envelope }) =>
            engine.transition(registry.get(stateAtom), envelope).pipe(Effect.flatMap(publishMutation)),
          dispatchUnknownCommand: ({ input }) =>
            engine.decodeCommand(input).pipe(
              Effect.flatMap((envelope) => engine.transition(registry.get(stateAtom), envelope)),
              Effect.flatMap(publishMutation)
            ),
          saveSnapshot: Effect.fn("DockAtomSession.saveSnapshot")(function* () {
            const snapshot = yield* engine.encodeSnapshot(registry.get(stateAtom));
            yield* store.save(snapshot);
            yield* reactivity.invalidate([SNAPSHOT_REACTIVITY_KEY]);
            return DockSnapshotSaved.make({
              snapshot,
            });
          }),
          restoreSnapshot: Effect.fn("DockAtomSession.restoreSnapshot")(function* ({ request }) {
            const snapshot = yield* requireSnapshot(yield* store.load);
            const outcome = yield* engine.restore(registry.get(stateAtom), snapshot, request);
            return yield* publishMutation(outcome);
          }),
        })
      );

      const submitUnsafe = (operation: DockAtomOperation): void => {
        const submission = MutableRef.incrementAndGet(latestSubmission);
        const previous = registry.get(operationResultAtom);
        registry.set(operationResultAtom, AsyncResult.waiting(previous));

        runFork(
          mutationGate
            .withPermit(
              runOperation(operation).pipe(
                Effect.exit,
                Effect.tap(
                  Exit.match({
                    onFailure: (cause) =>
                      O.match(Cause.findErrorOption(cause), {
                        onNone: thunkEffectVoid,
                        onSome: (error) =>
                          appendFeed(
                            DockAtomFeedFailure.make({
                              submission: NonNegativeInt.make(submission),
                              operationKind: operation.kind,
                              error,
                            })
                          ),
                      }),
                    onSuccess: (outcome) =>
                      appendFeed(
                        DockAtomFeedSuccess.make({
                          submission: NonNegativeInt.make(submission),
                          operationKind: operation.kind,
                          outcome,
                        })
                      ),
                  })
                ),
                Effect.tap(
                  Exit.match({
                    onFailure: (cause) =>
                      Effect.logError("dock operation failed").pipe(
                        Effect.annotateLogs({
                          submission,
                          operationKind: operation.kind,
                          cause: Cause.pretty(cause),
                        })
                      ),
                    onSuccess: (outcome) =>
                      Effect.logInfo("dock operation completed").pipe(
                        Effect.annotateLogs({
                          submission,
                          operationKind: operation.kind,
                          outcomeKind: outcome.kind,
                        })
                      ),
                  })
                )
              )
            )
            .pipe(
              Effect.flatMap((exit) =>
                Bool.match(Eq.equals(submission, MutableRef.get(latestSubmission)), {
                  onTrue: () =>
                    Effect.sync(() =>
                      registry.set(operationResultAtom, AsyncResult.fromExitWithPrevious(exit, O.some(previous)))
                    ),
                  onFalse: thunkEffectVoid,
                })
              )
            )
        );
      };

      return DockAtomSession.of({
        awaitIdle: FiberSet.awaitEmpty(fibers),
        submitUnsafe,
      });
    }).pipe(Effect.withSpan("DockAtomSession.make"))
  );
