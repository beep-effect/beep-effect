/**
 * Schema-first protocol between host adapters and the Dockview Atom session.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { DockCommandEnvelope, RestoreSnapshotRequest } from "./Dock.commands.ts";
import {
  DockCommandRejected,
  DockInputError,
  DockInvariantViolation,
  DockPersistenceError,
  DockSnapshotMissing,
} from "./Dock.errors.ts";
import { DockMutationOutcome } from "./Dock.outcomes.ts";

const $I = $DockId.create("Dock.protocol");

/**
 * Operation that executes an already decoded command envelope.
 *
 * **Example** (Make dispatch dock command)
 *
 * ```ts
 * import { ApiCommandOrigin, ClearWorkspaceCommand, DockCommandEnvelope } from "@beep/dock/Dock.commands"
 * import { CommandId } from "@beep/dock/Dock.ids"
 * import { DispatchDockCommand } from "@beep/dock/Dock.protocol"
 *
 * const value = DispatchDockCommand.make({ envelope: DockCommandEnvelope.make({ commandId: CommandId.make("command-clear"), origin: ApiCommandOrigin.make({ requestId: "request-one" }), command: ClearWorkspaceCommand.make({}) }) })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class DispatchDockCommand extends S.Opaque<DispatchDockCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("dispatchCommand"),
    envelope: DockCommandEnvelope,
  }).pipe(
    $I.annoteSchema("DispatchDockCommand", {
      description: "Executes a typed dock command through the serialized Atom session.",
    })
  )
) {}

/**
 * Operation that decodes unknown input before dispatch.
 *
 * **Example** (Make unknown command dispatch)
 *
 * ```ts
 * import { DispatchUnknownDockCommand } from "@beep/dock/Dock.protocol"
 *
 * const value = DispatchUnknownDockCommand.make({ input: { commandId: "command-clear" } })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class DispatchUnknownDockCommand extends S.Opaque<
  DispatchUnknownDockCommand,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("dispatchUnknownCommand"),
    input: S.Unknown,
  }).pipe(
    $I.annoteSchema("DispatchUnknownDockCommand", {
      description: "Decodes untrusted command input at the Atom session boundary.",
    })
  )
) {}

/**
 * Operation that persists the current live workspace.
 *
 * **Example** (Make save snapshot operation)
 *
 * ```ts
 * import { SaveDockSnapshot } from "@beep/dock/Dock.protocol"
 *
 * const value = SaveDockSnapshot.make({})
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class SaveDockSnapshot extends S.Opaque<SaveDockSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("saveSnapshot"),
  }).pipe(
    $I.annoteSchema("SaveDockSnapshot", {
      description: "Persists the current workspace without changing live topology.",
    })
  )
) {}

/**
 * Operation that loads and atomically installs a validated snapshot.
 *
 * **Example** (Make restore snapshot operation)
 *
 * ```ts
 * import { ApiCommandOrigin, RestoreSnapshotRequest } from "@beep/dock/Dock.commands"
 * import { CommandId } from "@beep/dock/Dock.ids"
 * import { RestoreDockSnapshot } from "@beep/dock/Dock.protocol"
 *
 * const value = RestoreDockSnapshot.make({ request: RestoreSnapshotRequest.make({ commandId: CommandId.make("command-restore"), origin: ApiCommandOrigin.make({ requestId: "request-one" }) }) })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class RestoreDockSnapshot extends S.Opaque<RestoreDockSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("restoreSnapshot"),
    request: RestoreSnapshotRequest,
  }).pipe(
    $I.annoteSchema("RestoreDockSnapshot", {
      description: "Loads, validates, and atomically installs the persisted snapshot.",
    })
  )
) {}

/**
 * Serialized operation-kind domain for the tagged algebra of every Atom-session operation.
 *
 * **Example** (Read operation kind field)
 *
 * ```ts
 * import { DockAtomOperation, SaveDockSnapshot } from "@beep/dock/Dock.protocol"
 *
 * const value = SaveDockSnapshot.make({})
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
]).pipe(
  $I.annoteSchema("DockAtomOperationKind", {
    description: "Discriminant for the dock atom session operation protocol.",
  })
);
/**
 * Decoded serialized Atom-session operation kind.
 *
 * **Example** (Make operation kind value)
 *
 * ```ts
 * import { DockAtomOperationKind } from "@beep/dock/Dock.protocol"
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
 * **Example** (Wrap save snapshot operation)
 *
 * ```ts
 * import { DockAtomOperation, SaveDockSnapshot } from "@beep/dock/Dock.protocol"
 *
 * const value = DockAtomOperation.make(SaveDockSnapshot.make({}))
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
).pipe(
  $I.annoteSchema("DockAtomOperation", {
    description: "All stateful session operations share this one serialized execution lane.",
  }),
  S.toTaggedUnion("kind")
);
/**
 * Decoded serialized operation submitted to the Atom session.
 *
 * **Example** (Assign save snapshot type)
 *
 * ```ts
 * import { DockAtomOperation, SaveDockSnapshot } from "@beep/dock/Dock.protocol"
 *
 * const value: DockAtomOperation = SaveDockSnapshot.make({})
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
 * **Example** (Make mutation completed result)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ApiCommandOrigin } from "@beep/dock/Dock.commands"
 * import { CommandId } from "@beep/dock/Dock.ids"
 * import { DockMutationCompleted } from "@beep/dock/Dock.protocol"
 * import { DockMutationOutcome, DockUnchanged } from "@beep/dock/Dock.outcomes"
 *
 * const value = DockMutationCompleted.make({ outcome: DockMutationOutcome.make({ commandId: CommandId.make("command-activate"), origin: ApiCommandOrigin.make({ requestId: "request-one" }), result: DockUnchanged.make({ revision: S.Natural.make(2), reason: "panel-already-active" }) }) })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class DockMutationCompleted extends S.Opaque<DockMutationCompleted, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("mutationCompleted"),
    outcome: DockMutationOutcome,
  }).pipe(
    $I.annoteSchema("DockMutationCompleted", {
      description: "Carries either a changed transition or an explicit unchanged result.",
    })
  )
) {}

/**
 * Successful session result for persisted snapshot text.
 *
 * **Example** (Make snapshot saved result)
 *
 * ```ts
 * import { DockSnapshotSaved } from "@beep/dock/Dock.protocol"
 *
 * const value = DockSnapshotSaved.make({ snapshot: "{\"version\":1}" })
 * console.log(value.kind)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class DockSnapshotSaved extends S.Opaque<DockSnapshotSaved, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("snapshotSaved"),
    snapshot: S.String,
  }).pipe(
    $I.annoteSchema("DockSnapshotSaved", {
      description: "Confirms persistence and carries the encoded snapshot for diagnostics.",
    })
  )
) {}

const DockAtomOperationOutcomeKind = LiteralKit(["mutationCompleted", "snapshotSaved"]);

/**
 * Tagged union of successful session operation results.
 *
 * **Example** (Use snapshot saved outcome)
 *
 * ```ts
 * import { DockAtomOperationOutcome, DockSnapshotSaved } from "@beep/dock/Dock.protocol"
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
).pipe(
  $I.annoteSchema("DockAtomOperationOutcome", {
    description: "Discriminates mutation outcomes from snapshot persistence results.",
  }),
  S.toTaggedUnion("kind")
);
/**
 * Decoded tagged union of successful session operation results.
 *
 * **Example** (Type snapshot saved outcome)
 *
 * ```ts
 * import { DockAtomOperationOutcome, DockSnapshotSaved } from "@beep/dock/Dock.protocol"
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
 * **Example** (Make snapshot missing error)
 *
 * ```ts
 * import { DockAtomSessionError } from "@beep/dock/Dock.protocol"
 * import { DockSnapshotMissing } from "@beep/dock/Dock.errors"
 *
 * const value = DockSnapshotMissing.make({ message: "No snapshot exists" })
 * console.log(value)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const DockAtomSessionError = S.Union([
  DockCommandRejected,
  DockInvariantViolation,
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
 * **Example** (Type snapshot missing error)
 *
 * ```ts
 * import { DockAtomSessionError } from "@beep/dock/Dock.protocol"
 * import { DockSnapshotMissing } from "@beep/dock/Dock.errors"
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
 * **Example** (Make feed success entry)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DockAtomFeedSuccess, DockSnapshotSaved } from "@beep/dock/Dock.protocol"
 *
 * const value = DockAtomFeedSuccess.make({ submission: S.Natural.make(1), operationKind: "saveSnapshot", outcome: DockSnapshotSaved.make({ snapshot: "{\"version\":1}" }) })
 * console.log(value)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class DockAtomFeedSuccess extends S.Opaque<DockAtomFeedSuccess, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Success", {
    submission: S.Natural,
    operationKind: DockAtomOperationKind,
    outcome: DockAtomOperationOutcome,
  }).pipe(
    $I.annoteSchema("DockAtomFeedSuccess", {
      description: "Publishes one successful operation outcome with its submission causality.",
    })
  )
) {}

/**
 * Ordered feed entry for one typed session failure.
 *
 * **Example** (Make feed failure entry)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DockAtomFeedFailure } from "@beep/dock/Dock.protocol"
 * import { DockSnapshotMissing } from "@beep/dock/Dock.errors"
 *
 * const value = DockAtomFeedFailure.make({ submission: S.Natural.make(1), operationKind: "restoreSnapshot", error: DockSnapshotMissing.make({ message: "No snapshot exists" }) })
 * console.log(value)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class DockAtomFeedFailure extends S.Opaque<DockAtomFeedFailure, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Failure", {
    submission: S.Natural,
    operationKind: DockAtomOperationKind,
    error: DockAtomSessionError,
  }).pipe(
    $I.annoteSchema("DockAtomFeedFailure", {
      description: "Publishes one typed session failure with its operation and submission causality.",
    })
  )
) {}

/**
 * Lossless ordered completion entry exposed to host adapters.
 *
 * **Example** (Use feed failure entry)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DockAtomFeedEntry, DockAtomFeedFailure } from "@beep/dock/Dock.protocol"
 * import { DockSnapshotMissing } from "@beep/dock/Dock.errors"
 *
 * const value = DockAtomFeedFailure.make({ submission: S.Natural.make(1), operationKind: "restoreSnapshot", error: DockSnapshotMissing.make({ message: "No snapshot exists" }) })
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
 * **Example** (Type feed failure entry)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DockAtomFeedEntry, DockAtomFeedFailure } from "@beep/dock/Dock.protocol"
 * import { DockSnapshotMissing } from "@beep/dock/Dock.errors"
 *
 * const value: DockAtomFeedEntry = DockAtomFeedFailure.make({ submission: S.Natural.make(1), operationKind: "restoreSnapshot", error: DockSnapshotMissing.make({ message: "No snapshot exists" }) })
 * console.log(value)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export type DockAtomFeedEntry = typeof DockAtomFeedEntry.Type;
