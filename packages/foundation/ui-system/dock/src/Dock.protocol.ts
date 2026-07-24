/**
 * Schema-first protocol between host adapters and the Dockview Atom session.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import { DockCommandEnvelope, RestoreSnapshotRequest } from "./Dock.commands.ts";
import { DockInputError, DockPersistenceError, DockSnapshotMissing, DockTransitionError } from "./Dock.errors.ts";
import { DockMutationOutcome } from "./Dock.outcomes.ts";

const $I = $DockId.create("Dock.protocol");

/**
 * Operation that executes an already decoded command envelope.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, ClearWorkspaceCommand, CommandId, DispatchDockCommand, DockCommandEnvelope } from "@beep/dock"
 *
 * const value = DispatchDockCommand.make({ envelope: DockCommandEnvelope.make({ commandId: CommandId.make("command-clear"), origin: ApiCommandOrigin.make({ requestId: "request-one" }), command: ClearWorkspaceCommand.make() }) })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class DispatchDockCommand extends S.Class<DispatchDockCommand>($I`DispatchDockCommand`)(
  {
    kind: S.tag("dispatchCommand"),
    envelope: DockCommandEnvelope,
  },
  $I.annote("DispatchDockCommand", {
    description: "Executes a typed dock command through the serialized Atom session.",
  })
) {}

/**
 * Operation that decodes unknown input before dispatch.
 *
 * @example
 * ```ts
 * import { DispatchUnknownDockCommand } from "@beep/dock"
 *
 * const value = DispatchUnknownDockCommand.make({ input: { commandId: "command-clear" } })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class DispatchUnknownDockCommand extends S.Class<DispatchUnknownDockCommand>($I`DispatchUnknownDockCommand`)(
  {
    kind: S.tag("dispatchUnknownCommand"),
    input: S.Unknown,
  },
  $I.annote("DispatchUnknownDockCommand", {
    description: "Decodes untrusted command input at the Atom session boundary.",
  })
) {}

/**
 * Operation that persists the current live workspace.
 *
 * @example
 * ```ts
 * import { SaveDockSnapshot } from "@beep/dock"
 *
 * const value = SaveDockSnapshot.make()
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class SaveDockSnapshot extends S.Class<SaveDockSnapshot>($I`SaveDockSnapshot`)(
  {
    kind: S.tag("saveSnapshot"),
  },
  $I.annote("SaveDockSnapshot", {
    description: "Persists the current workspace without changing live topology.",
  })
) {}

/**
 * Operation that loads and atomically installs a validated snapshot.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, CommandId, RestoreDockSnapshot, RestoreSnapshotRequest } from "@beep/dock"
 *
 * const value = RestoreDockSnapshot.make({ request: RestoreSnapshotRequest.make({ commandId: CommandId.make("command-restore"), origin: ApiCommandOrigin.make({ requestId: "request-one" }) }) })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class RestoreDockSnapshot extends S.Class<RestoreDockSnapshot>($I`RestoreDockSnapshot`)(
  {
    kind: S.tag("restoreSnapshot"),
    request: RestoreSnapshotRequest,
  },
  $I.annote("RestoreDockSnapshot", {
    description: "Loads, validates, and atomically installs the persisted snapshot.",
  })
) {}

/**
 * Serialized operation-kind domain for the tagged algebra of every Atom-session operation.
 *
 * @example
 * ```ts
 * import { DockAtomOperation, SaveDockSnapshot } from "@beep/dock"
 *
 * const value = SaveDockSnapshot.make()
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const DockAtomOperationKind = LiteralKit([
  "dispatchCommand",
  "dispatchUnknownCommand",
  "saveSnapshot",
  "restoreSnapshot",
]).annotate(
  $I.annote("DockAtomOperationKind", {
    description: "Discriminant for the dock atom session operation protocol.",
  })
);
/**
 * Decoded serialized Atom-session operation kind.
 *
 * @example
 * ```ts
 * import { DockAtomOperationKind } from "@beep/dock"
 *
 * const value: DockAtomOperationKind = DockAtomOperationKind.make("saveSnapshot")
 * console.log(value)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export type DockAtomOperationKind = typeof DockAtomOperationKind.Type;

/**
 * Complete serialized operation algebra for one Dockview Atom session.
 *
 * @example
 * ```ts
 * import { DockAtomOperation, SaveDockSnapshot } from "@beep/dock"
 *
 * const value = DockAtomOperation.make(SaveDockSnapshot.make())
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
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
/**
 * Decoded serialized operation submitted to the Atom session.
 *
 * @example
 * ```ts
 * import { DockAtomOperation, SaveDockSnapshot } from "@beep/dock"
 *
 * const value: DockAtomOperation = SaveDockSnapshot.make()
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export type DockAtomOperation = typeof DockAtomOperation.Type;

/**
 * Successful session result for a reducer mutation attempt.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, CommandId, DockMutationCompleted, DockMutationOutcome, DockUnchanged } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const value = DockMutationCompleted.make({ outcome: DockMutationOutcome.make({ commandId: CommandId.make("command-activate"), origin: ApiCommandOrigin.make({ requestId: "request-one" }), result: DockUnchanged.make({ revision: NonNegativeInt.make(2), reason: "panel-already-active" }) }) })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class DockMutationCompleted extends S.Class<DockMutationCompleted>($I`DockMutationCompleted`)(
  {
    kind: S.tag("mutationCompleted"),
    outcome: DockMutationOutcome,
  },
  $I.annote("DockMutationCompleted", {
    description: "Carries either a changed transition or an explicit unchanged result.",
  })
) {}

/**
 * Successful session result for persisted snapshot text.
 *
 * @example
 * ```ts
 * import { DockSnapshotSaved } from "@beep/dock"
 *
 * const value = DockSnapshotSaved.make({ snapshot: "{\"version\":1}" })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
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

/**
 * Tagged union of successful session operation results.
 *
 * @example
 * ```ts
 * import { DockAtomOperationOutcome, DockSnapshotSaved } from "@beep/dock"
 *
 * const value = DockSnapshotSaved.make({ snapshot: "{\"version\":1}" })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const DockAtomOperationOutcome = DockAtomOperationOutcomeKind.mapMembers(
  Tuple.evolve([() => DockMutationCompleted, () => DockSnapshotSaved])
)
  .annotate(
    $I.annote("DockAtomOperationOutcome", {
      description: "Discriminates mutation outcomes from snapshot persistence results.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
/**
 * Decoded tagged union of successful session operation results.
 *
 * @example
 * ```ts
 * import { DockAtomOperationOutcome, DockSnapshotSaved } from "@beep/dock"
 *
 * const value: DockAtomOperationOutcome = DockSnapshotSaved.make({ snapshot: "{\"version\":1}" })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export type DockAtomOperationOutcome = typeof DockAtomOperationOutcome.Type;

/**
 * Tagged union of failures produced by a built Atom session.
 *
 * @example
 * ```ts
 * import { DockAtomSessionError, DockSnapshotMissing } from "@beep/dock"
 *
 * const value = DockSnapshotMissing.make({ message: "No snapshot exists" })
 * console.log(value)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const DockAtomSessionError = S.Union([
  DockTransitionError,
  DockInputError,
  DockPersistenceError,
  DockSnapshotMissing,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DockAtomSessionError", {
    description: "Typed failures produced after the Atom session layer has built.",
  })
);
/**
 * Decoded tagged union of failures produced by a built Atom session.
 *
 * @example
 * ```ts
 * import { DockAtomSessionError, DockSnapshotMissing } from "@beep/dock"
 *
 * const value: DockAtomSessionError = DockSnapshotMissing.make({ message: "No snapshot exists" })
 * console.log(value)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export type DockAtomSessionError = typeof DockAtomSessionError.Type;

/**
 * Ordered feed entry for one successful session operation.
 *
 * @example
 * ```ts
 * import { DockAtomFeedSuccess, DockSnapshotSaved } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const value = DockAtomFeedSuccess.make({ submission: NonNegativeInt.make(1), operationKind: "saveSnapshot", outcome: DockSnapshotSaved.make({ snapshot: "{\"version\":1}" }) })
 * console.log(value)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
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

/**
 * Ordered feed entry for one typed session failure.
 *
 * @example
 * ```ts
 * import { DockAtomFeedFailure, DockSnapshotMissing } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const value = DockAtomFeedFailure.make({ submission: NonNegativeInt.make(1), operationKind: "restoreSnapshot", error: DockSnapshotMissing.make({ message: "No snapshot exists" }) })
 * console.log(value)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
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

/**
 * Lossless ordered completion entry exposed to host adapters.
 *
 * @example
 * ```ts
 * import { DockAtomFeedEntry, DockSnapshotMissing, DockAtomFeedFailure } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const value = DockAtomFeedFailure.make({ submission: NonNegativeInt.make(1), operationKind: "restoreSnapshot", error: DockSnapshotMissing.make({ message: "No snapshot exists" }) })
 * console.log(value)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const DockAtomFeedEntry = S.Union([DockAtomFeedSuccess, DockAtomFeedFailure]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DockAtomFeedEntry", {
    description: "Discriminates successful outcomes from typed failures in the host-facing completion feed.",
  })
);
/**
 * Decoded lossless ordered completion entry exposed to host adapters.
 *
 * @example
 * ```ts
 * import { DockAtomFeedEntry, DockSnapshotMissing, DockAtomFeedFailure } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const value: DockAtomFeedEntry = DockAtomFeedFailure.make({ submission: NonNegativeInt.make(1), operationKind: "restoreSnapshot", error: DockSnapshotMissing.make({ message: "No snapshot exists" }) })
 * console.log(value)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export type DockAtomFeedEntry = typeof DockAtomFeedEntry.Type;
