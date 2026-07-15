/**
 * Context services for the Dockview POC transition and persistence boundaries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { Context, Effect, Layer, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { DockCommandEnvelope } from "./Dock.commands.ts";
import { DockInputError, DockSnapshotMissing } from "./Dock.errors.ts";
import { reduceDockCommand, restoreDockWorkspace, validateWorkspace } from "./Dock.reducer.ts";
import { DockSnapshot } from "./Dock.tree.ts";
import type { RestoreSnapshotRequest } from "./Dock.commands.ts";
import type { DockInvariantViolation, DockPersistenceError, DockTransitionError } from "./Dock.errors.ts";
import type { DockMutationOutcome } from "./Dock.outcomes.ts";
import type { DockWorkspace } from "./Dock.tree.ts";

const $I = $DockId.create("DockEngine.service");

const DockSnapshotJson = S.fromJsonString(DockSnapshot);

const decodeCommand = Effect.fn("DockEngine.decodeCommand")(function* (input: unknown) {
  return yield* S.decodeUnknownEffect(DockCommandEnvelope)(input).pipe(
    Effect.mapError((cause) =>
      DockInputError.make({
        boundary: "command",
        message: cause.message,
      })
    )
  );
});

const encodeSnapshot = Effect.fn("DockEngine.encodeSnapshot")(function* (state: DockWorkspace) {
  yield* validateWorkspace(state);
  return yield* S.encodeEffect(DockSnapshotJson)(DockSnapshot.make({ workspace: state })).pipe(
    Effect.mapError((cause) =>
      DockInputError.make({
        boundary: "snapshot",
        message: cause.message,
      })
    )
  );
});

const decodeSnapshotInput = Effect.fn("DockEngine.decodeSnapshotInput")(function* (input: string) {
  const snapshot = yield* S.decodeUnknownEffect(DockSnapshotJson)(input).pipe(
    Effect.mapError((cause) =>
      DockInputError.make({
        boundary: "snapshot",
        message: cause.message,
      })
    )
  );
  return snapshot.workspace;
});

const decodeSnapshot = Effect.fn("DockEngine.decodeSnapshot")(function* (input: string) {
  const state = yield* decodeSnapshotInput(input);
  return yield* validateWorkspace(state);
});

/**
 * Service contract for decoding, encoding, restoring, and transitioning dock state.
 *
 * @example
 * ```ts
 * import { DockEngine, DockEngineLive, GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView } from "@beep/dock"
 * import type { DockEngineShape } from "@beep/dock"
 * import { Effect } from "effect"
 *
 * const encode = (engine: DockEngineShape, workspace: PopulatedWorkspace) => engine.encodeSnapshot(workspace)
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel }) })
 * const snapshot = Effect.runSync(Effect.gen(function* () {
 *   const engine = yield* DockEngine
 *   return yield* encode(engine, workspace)
 * }).pipe(Effect.provide(DockEngineLive)))
 * console.log(snapshot.includes("panel-one"))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface DockEngineShape {
  readonly decodeCommand: (input: unknown) => Effect.Effect<DockCommandEnvelope, DockInputError>;
  readonly decodeSnapshot: (input: string) => Effect.Effect<DockWorkspace, DockInputError | DockInvariantViolation>;
  readonly encodeSnapshot: (state: DockWorkspace) => Effect.Effect<string, DockInputError | DockInvariantViolation>;
  readonly restore: (
    current: DockWorkspace,
    input: string,
    request: RestoreSnapshotRequest
  ) => Effect.Effect<DockMutationOutcome, DockInputError | DockInvariantViolation>;
  readonly transition: (
    state: DockWorkspace,
    envelope: DockCommandEnvelope
  ) => Effect.Effect<DockMutationOutcome, DockTransitionError>;
}

/**
 * Stateless dock transition capability consumed by the Atom runtime.
 *
 * Alternate layers can add policy, authorization, collaboration, or remote
 * execution without changing the atom graph.
 */
/**
 * Context service for the stateless dock transition kernel.
 *
 * @example
 * ```ts
 * import { DockEngine, DockEngineLive, GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView } from "@beep/dock"
 * import { Effect } from "effect"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel }) })
 * const snapshot = Effect.runSync(Effect.gen(function* () {
 *   const engine = yield* DockEngine
 *   return yield* engine.encodeSnapshot(workspace)
 * }).pipe(Effect.provide(DockEngineLive)))
 * console.log(snapshot.includes("panel-one"))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DockEngine extends Context.Service<DockEngine, DockEngineShape>()($I`DockEngine`) {}

const makeDockEngine = Effect.succeed(
  DockEngine.of({
    transition: reduceDockCommand,
    decodeCommand,
    encodeSnapshot,
    decodeSnapshot,
    restore: Effect.fn("DockEngine.restore")(function* (current, input, request) {
      const restored = yield* decodeSnapshotInput(input);
      return yield* restoreDockWorkspace(current, restored, request);
    }),
  })
).pipe(Effect.withSpan("DockEngine.make"));

/**
 * Default deterministic layer for the dock transition kernel.
 *
 * @example
 * ```ts
 * import { DockEngine, DockEngineLive, GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView } from "@beep/dock"
 * import { Effect } from "effect"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel }) })
 * const snapshot = Effect.runSync(Effect.gen(function* () {
 *   const engine = yield* DockEngine
 *   return yield* engine.encodeSnapshot(workspace)
 * }).pipe(Effect.provide(DockEngineLive)))
 * console.log(snapshot.includes("Panel One"))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DockEngineLive = Layer.effect(DockEngine, makeDockEngine);

/**
 * Replaceable snapshot persistence port contract.
 *
 * @example
 * ```ts
 * import type { DockSnapshotStoreShape } from "@beep/dock"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const store: DockSnapshotStoreShape = {
 *   load: Effect.succeed(O.some("snapshot-one")),
 *   save: () => Effect.void
 * }
 * const loaded = Effect.runSync(store.save("snapshot-two").pipe(Effect.andThen(store.load)))
 * console.log(O.getOrElse(loaded, () => "missing"))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface DockSnapshotStoreShape {
  readonly load: Effect.Effect<O.Option<string>, DockPersistenceError>;
  readonly save: (snapshot: string) => Effect.Effect<void, DockPersistenceError>;
}

/**
 * Context service for replaceable snapshot persistence.
 *
 * @example
 * ```ts
 * import { DockSnapshotStore, makeDockSnapshotStoreMemory } from "@beep/dock"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const store = yield* DockSnapshotStore
 *   yield* store.save("snapshot-one")
 *   return yield* store.load
 * }).pipe(Effect.provide(makeDockSnapshotStoreMemory()))
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DockSnapshotStore extends Context.Service<DockSnapshotStore, DockSnapshotStoreShape>()(
  $I`DockSnapshotStore`
) {}

/**
 * Creates an isolated in-memory snapshot-store layer.
 *
 * @example
 * ```ts
 * import { makeDockSnapshotStoreMemory } from "@beep/dock"
 * import { DockSnapshotStore } from "@beep/dock"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const loaded = Effect.runSync(Effect.gen(function* () {
 *   const store = yield* DockSnapshotStore
 *   yield* store.save("snapshot-two")
 *   return yield* store.load
 * }).pipe(Effect.provide(makeDockSnapshotStoreMemory(O.some("snapshot-one")))))
 * console.log(O.getOrElse(loaded, () => "missing"))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDockSnapshotStoreMemory = (initial: O.Option<string> = O.none()): Layer.Layer<DockSnapshotStore> =>
  Layer.effect(
    DockSnapshotStore,
    Effect.gen(function* () {
      const snapshot = yield* Ref.make(initial);
      return DockSnapshotStore.of({
        load: Ref.get(snapshot),
        save: Effect.fn("DockSnapshotStore.save")(function* (value) {
          yield* Ref.set(snapshot, O.some(value));
        }),
      });
    }).pipe(Effect.withSpan("DockSnapshotStore.makeMemory"))
  );

/**
 * Resolves a loaded snapshot or fails with typed absence.
 *
 * @example
 * ```ts
 * import { requireSnapshot } from "@beep/dock"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const snapshot = Effect.runSync(requireSnapshot(O.some("snapshot")))
 * console.log(snapshot)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const requireSnapshot = Effect.fn("DockSnapshotStore.requireSnapshot")((snapshot: O.Option<string>) =>
  Effect.fromOption(snapshot, () =>
    DockSnapshotMissing.make({
      message: "No persisted dock snapshot is available.",
    })
  )
);
