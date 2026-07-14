/**
 * Schema-first protocol between host adapters and the Dockview Atom session.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import {
  DockCommandEnvelope,
  DockInputError,
  DockInvariantViolation,
  DockMutationOutcome,
  DockPersistenceError,
  DockSnapshotMissing,
  DockTransitionError,
  RestoreSnapshotRequest,
} from "./Domain.ts";

const $I = $ScratchpadId.create("dockview/poc/DockAtomProtocol");

/** Executes an already decoded command envelope. */
export class DispatchDockCommand extends S.Class<DispatchDockCommand>($I`DispatchDockCommand`)(
  {
    kind: S.tag("dispatchCommand"),
    envelope: DockCommandEnvelope,
  },
  $I.annote("DispatchDockCommand", {
    description: "Executes a typed dock command through the serialized Atom session.",
  })
) {}

/** Decodes unknown input before attempting a command transition. */
export class DispatchUnknownDockCommand extends S.Class<DispatchUnknownDockCommand>($I`DispatchUnknownDockCommand`)(
  {
    kind: S.tag("dispatchUnknownCommand"),
    input: S.Unknown,
  },
  $I.annote("DispatchUnknownDockCommand", {
    description: "Decodes untrusted command input at the Atom session boundary.",
  })
) {}

/** Persists the current live workspace through the snapshot-store service. */
export class SaveDockSnapshot extends S.Class<SaveDockSnapshot>($I`SaveDockSnapshot`)(
  {
    kind: S.tag("saveSnapshot"),
  },
  $I.annote("SaveDockSnapshot", {
    description: "Persists the current workspace without changing live topology.",
  })
) {}

/** Restores the persisted snapshot through a validated atomic transition. */
export class RestoreDockSnapshot extends S.Class<RestoreDockSnapshot>($I`RestoreDockSnapshot`)(
  {
    kind: S.tag("restoreSnapshot"),
    request: RestoreSnapshotRequest,
  },
  $I.annote("RestoreDockSnapshot", {
    description: "Loads, validates, and atomically installs the persisted snapshot.",
  })
) {}

export const DockAtomOperationKind = LiteralKit([
  "dispatchCommand",
  "dispatchUnknownCommand",
  "saveSnapshot",
  "restoreSnapshot",
]);
export type DockAtomOperationKind = typeof DockAtomOperationKind.Type;

/** Complete serialized operation algebra for one Dockview Atom session. */
export const DockAtomOperation = DockAtomOperationKind.mapMembers(
  Tuple.evolve([
    () => DispatchDockCommand,
    () => DispatchUnknownDockCommand,
    () => SaveDockSnapshot,
    () => RestoreDockSnapshot,
  ])
)
  .annotate(
    $I.annote("DockAtomOperation", {
      description: "All stateful session operations share this one serialized execution lane.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type DockAtomOperation = typeof DockAtomOperation.Type;

/** Session result for a command or restore attempt that reached the reducer. */
export class DockMutationCompleted extends S.Class<DockMutationCompleted>($I`DockMutationCompleted`)(
  {
    kind: S.tag("mutationCompleted"),
    outcome: DockMutationOutcome,
  },
  $I.annote("DockMutationCompleted", {
    description: "Carries either a changed transition or an explicit unchanged result.",
  })
) {}

/** Session result for a successfully persisted snapshot. */
export class DockSnapshotSaved extends S.Class<DockSnapshotSaved>($I`DockSnapshotSaved`)(
  {
    kind: S.tag("snapshotSaved"),
    snapshot: S.String,
  },
  $I.annote("DockSnapshotSaved", {
    description: "Confirms persistence and carries the encoded snapshot for diagnostics.",
  })
) {}

const DockAtomOperationOutcomeKind = LiteralKit(["mutationCompleted", "snapshotSaved"]);

/** Exhaustive successful result from the serialized session operation lane. */
export const DockAtomOperationOutcome = DockAtomOperationOutcomeKind.mapMembers(
  Tuple.evolve([() => DockMutationCompleted, () => DockSnapshotSaved])
)
  .annotate(
    $I.annote("DockAtomOperationOutcome", {
      description: "Discriminates mutation outcomes from snapshot persistence results.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type DockAtomOperationOutcome = typeof DockAtomOperationOutcome.Type;

/** Typed failures produced after the Atom session layer has built. */
export const DockAtomSessionError = S.Union([
  DockTransitionError,
  DockInputError,
  DockInvariantViolation,
  DockPersistenceError,
  DockSnapshotMissing,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DockAtomSessionError", {
    description: "Typed failures produced after the Atom session layer has built.",
  })
);
export type DockAtomSessionError = typeof DockAtomSessionError.Type;

/** One successfully completed serialized session operation. */
export class DockAtomFeedSuccess extends S.TaggedClass<DockAtomFeedSuccess>($I`DockAtomFeedSuccess`)(
  "Success",
  {
    submission: NonNegativeInt,
    operationKind: DockAtomOperationKind,
    outcome: DockAtomOperationOutcome,
  },
  $I.annote("DockAtomFeedSuccess", {
    description: "Publishes one successful operation outcome with its submission causality.",
  })
) {}

/** One typed failure from a completed serialized session operation. */
export class DockAtomFeedFailure extends S.TaggedClass<DockAtomFeedFailure>($I`DockAtomFeedFailure`)(
  "Failure",
  {
    submission: NonNegativeInt,
    operationKind: DockAtomOperationKind,
    error: DockAtomSessionError,
  },
  $I.annote("DockAtomFeedFailure", {
    description: "Publishes one typed session failure with its operation and submission causality.",
  })
) {}

/** Lossless ordered completion entry exposed to host adapters. */
export const DockAtomFeedEntry = S.Union([DockAtomFeedSuccess, DockAtomFeedFailure]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DockAtomFeedEntry", {
    description: "Discriminates successful outcomes from typed failures in the host-facing completion feed.",
  })
);
export type DockAtomFeedEntry = typeof DockAtomFeedEntry.Type;
