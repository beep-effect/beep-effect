/**
 * Headless Effect Atom session for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { Cause, Context, Effect, Exit, FiberSet, Layer, MutableRef, Semaphore } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import { AsyncResult, Atom, AtomRegistry, Reactivity } from "effect/unstable/reactivity";
import {
  type DockAtomFeedEntry,
  DockAtomFeedFailure,
  DockAtomFeedSuccess,
  DockAtomOperation,
  type DockAtomOperationOutcome,
  type DockAtomSessionError,
  DockMutationCompleted,
  DockSnapshotSaved,
} from "./DockAtomProtocol.ts";

export { DockAtomSessionError } from "./DockAtomProtocol.ts";

import {
  DockEngine,
  DockEngineLive,
  DockSnapshotStore,
  makeDockSnapshotStoreMemory,
  requireSnapshot,
} from "./DockEngine.ts";
import { type DockMutationOutcome, DockMutationResult, DockWorkspace, type GroupId, type PanelId } from "./Domain.ts";
import { validateWorkspace } from "./Reducer.ts";

const $I = $ScratchpadId.create("dockview/poc/DockAtoms");
const SNAPSHOT_REACTIVITY_KEY = "dockview-snapshot";

interface DockAtomSessionShape {
  readonly awaitIdle: Effect.Effect<void>;
  readonly submitUnsafe: (operation: DockAtomOperation) => void;
}

/** Per-registry capability that serializes every stateful session operation. */
class DockAtomSession extends Context.Service<DockAtomSession, DockAtomSessionShape>()($I`DockAtomSession`) {}

/** Console logging layer installed into every isolated POC Atom factory. */
export const DockAtomObservabilityLive: Layer.Layer<never> = Logger.layer([Logger.consolePretty()]);

const makeDockAtomSessionLayer = (
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
          Unchanged: () => Effect.void,
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
                        onNone: () => Effect.void,
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
                  onFalse: () => Effect.void,
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

const makeDockAtomGraph = <E>(
  initial: DockWorkspace,
  servicesLayer: Layer.Layer<DockEngine | DockSnapshotStore, E>
) => {
  const factory = Atom.context({
    memoMap: Layer.makeMemoMapUnsafe(),
  });
  factory.addGlobalLayer(DockAtomObservabilityLive);

  const stateAtom = Atom.make(initial).pipe(Atom.keepAlive);
  const operationResultAtom = Atom.make<AsyncResult.AsyncResult<DockAtomOperationOutcome, DockAtomSessionError>>(
    AsyncResult.initial()
  ).pipe(Atom.keepAlive);
  const operationFeedAtom = Atom.make<ReadonlyArray<DockAtomFeedEntry>>([]).pipe(Atom.keepAlive);
  const operationFeed = Atom.readable((get) => get(operationFeedAtom)).pipe(Atom.keepAlive);
  const sessionLayer = makeDockAtomSessionLayer(stateAtom, operationResultAtom, operationFeedAtom).pipe(
    Layer.provideMerge(servicesLayer)
  );
  const runtime = factory(sessionLayer);

  /** Read-only authoritative workspace projection. */
  const workspaceAtom = Atom.readable((get) => get(stateAtom)).pipe(Atom.keepAlive);

  /** All panels in tree order. */
  const panelsAtom = Atom.map(workspaceAtom, DockWorkspace.panels);

  /** Number of non-empty tab groups. */
  const groupCountAtom = Atom.map(workspaceAtom, DockWorkspace.groupCount);

  /** Per-panel projection without component-local state. */
  const panelAtom = Atom.family((panelId: PanelId) => Atom.map(workspaceAtom, DockWorkspace.findPanel(panelId)));

  /** Per-group projection without component-local state. */
  const tabsAtom = Atom.family((groupId: GroupId) => Atom.map(workspaceAtom, DockWorkspace.findTabs(groupId)));

  /** Selected panel projection for one group. */
  const activePanelAtom = Atom.family((groupId: GroupId) =>
    Atom.map(workspaceAtom, DockWorkspace.findActivePanel(groupId))
  );

  /** Service-backed persisted snapshot query. */
  const persistedSnapshotAtom = runtime
    .atom(DockSnapshotStore.use((store) => store.load))
    .pipe(factory.withReactivity([SNAPSHOT_REACTIVITY_KEY]), Atom.keepAlive);

  const registry = AtomRegistry.make();
  const releaseRuntime = registry.mount(runtime);
  const releasePersistence = registry.mount(persistedSnapshotAtom);

  const disposeBase = (): void => {
    releasePersistence();
    releaseRuntime();
    registry.dispose();
  };

  return {
    registry,
    runtime,
    operationResultAtom,
    operationFeedAtom: operationFeed,
    workspaceAtom,
    panelsAtom,
    groupCountAtom,
    panelAtom,
    tabsAtom,
    activePanelAtom,
    persistedSnapshotAtom,
    disposeBase,
  };
};

/**
 * Creates a validated, isolated Atom session from a fully provided service
 * layer. Layer construction failures remain typed in the returned Effect.
 */
export const makeDockAtomsWith = <E>(
  servicesLayer: Layer.Layer<DockEngine | DockSnapshotStore, E>,
  initial: DockWorkspace = DockWorkspace.empty
) =>
  validateWorkspace(initial).pipe(
    Effect.flatMap((validated) => {
      const graph = makeDockAtomGraph(validated, servicesLayer);
      return AtomRegistry.getResult(graph.registry, graph.runtime, { suspendOnWaiting: true }).pipe(
        Effect.map((context) => {
          const session = Context.get(context, DockAtomSession);

          /**
           * The only stateful operation lane. Writes submit synchronously into
           * the Context-owned Effect runtime; reads expose the latest typed
           * `AsyncResult` for host adapters.
           */
          const operationAtom = Atom.writable(
            (get) => get(graph.operationResultAtom),
            (_ctx, operation: DockAtomOperation) => session.submitUnsafe(operation)
          ).pipe(Atom.keepAlive);
          const releaseOperations = graph.registry.mount(operationAtom);

          /** Releases the one-registry session and every service scope it owns. */
          const dispose = (): void => {
            releaseOperations();
            graph.disposeBase();
          };

          return {
            registry: graph.registry,
            runtime: graph.runtime,
            workspaceAtom: graph.workspaceAtom,
            panelsAtom: graph.panelsAtom,
            groupCountAtom: graph.groupCountAtom,
            panelAtom: graph.panelAtom,
            tabsAtom: graph.tabsAtom,
            activePanelAtom: graph.activePanelAtom,
            awaitIdle: session.awaitIdle,
            operationAtom,
            operationFeedAtom: graph.operationFeedAtom,
            persistedSnapshotAtom: graph.persistedSnapshotAtom,
            dispose,
          };
        }),
        Effect.onError(() => Effect.sync(graph.disposeBase))
      );
    }),
    Effect.withSpan("DockAtoms.makeWith")
  );

/** Creates a validated Atom session with the live engine and isolated memory store. */
export const makeDockAtoms = (initial: DockWorkspace = DockWorkspace.empty) =>
  makeDockAtomsWith(Layer.mergeAll(DockEngineLive, makeDockSnapshotStoreMemory()), initial);
