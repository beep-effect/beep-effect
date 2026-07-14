/**
 * Context services for the Dockview POC transition and persistence boundaries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { Context, Effect, Layer, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { DockInvariantViolation, DockTransitionError } from "./Domain.ts";
import {
  DockCommandEnvelope,
  DockInputError,
  type DockMutationOutcome,
  type DockPersistenceError,
  DockSnapshot,
  DockSnapshotMissing,
  type DockWorkspace,
  type RestoreSnapshotRequest,
} from "./Domain.ts";
import { reduceDockCommand, restoreDockWorkspace, validateWorkspace } from "./Reducer.ts";

const $I = $ScratchpadId.create("dockview/poc/DockEngine");

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

/** Public transition-kernel service contract. */
export interface DockEngineShape {
  readonly transition: (
    state: DockWorkspace,
    envelope: DockCommandEnvelope
  ) => Effect.Effect<DockMutationOutcome, DockTransitionError>;
  readonly decodeCommand: (input: unknown) => Effect.Effect<DockCommandEnvelope, DockInputError>;
  readonly encodeSnapshot: (state: DockWorkspace) => Effect.Effect<string, DockInputError | DockInvariantViolation>;
  readonly decodeSnapshot: (input: string) => Effect.Effect<DockWorkspace, DockInputError | DockInvariantViolation>;
  readonly restore: (
    current: DockWorkspace,
    input: string,
    request: RestoreSnapshotRequest
  ) => Effect.Effect<DockMutationOutcome, DockInputError | DockInvariantViolation>;
}

/**
 * Stateless dock transition capability consumed by the Atom runtime.
 *
 * Alternate layers can add policy, authorization, collaboration, or remote
 * execution without changing the atom graph.
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

/** Default deterministic transition-kernel layer. */
export const DockEngineLive = Layer.effect(DockEngine, makeDockEngine);

/** Replaceable snapshot persistence port. */
export interface DockSnapshotStoreShape {
  readonly load: Effect.Effect<O.Option<string>, DockPersistenceError>;
  readonly save: (snapshot: string) => Effect.Effect<void, DockPersistenceError>;
}

/** Snapshot persistence capability used by the reactive adapter. */
export class DockSnapshotStore extends Context.Service<DockSnapshotStore, DockSnapshotStoreShape>()(
  $I`DockSnapshotStore`
) {}

/** Creates an isolated in-memory snapshot-store layer for one POC runtime. */
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

/** Resolves a loaded snapshot or fails with an explicit typed absence. */
export const requireSnapshot = Effect.fn("DockSnapshotStore.requireSnapshot")((snapshot: O.Option<string>) =>
  Effect.fromOption(snapshot, () =>
    DockSnapshotMissing.make({
      message: "No persisted dock snapshot is available.",
    })
  )
);
