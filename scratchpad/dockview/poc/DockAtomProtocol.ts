/**
 * Schema-first protocol between host adapters and the Dockview Atom session.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import { DockCommandEnvelope, DockMutationOutcome, RestoreSnapshotRequest } from "./Domain.ts";

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

const DockAtomOperationKind = LiteralKit([
  "dispatchCommand",
  "dispatchUnknownCommand",
  "saveSnapshot",
  "restoreSnapshot",
]);

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
