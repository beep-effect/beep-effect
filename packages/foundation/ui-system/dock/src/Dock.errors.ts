/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { CommandId } from "./Dock.ids.ts";

const $I = $DockId.create("Dock.errors");

/**
 * Business reason for rejecting a dock command.
 *
 * **Example** (Make panel-not-found reason)
 *
 * ```ts
 * import { DockRejectionReason } from "@beep/dock"
 *
 * const value = DockRejectionReason.make("panel-not-found")
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DockRejectionReason = LiteralKit([
  "workspace-not-empty",
  "workspace-empty",
  "panel-already-open",
  "panel-not-found",
  "group-not-found",
  "split-not-found",
  "group-already-exists",
  "split-already-exists",
  "group-locked",
  "same-group-move",
  "source-group-would-disappear",
  "group-floating",
  "group-not-docked",
  "group-not-floating",
]).annotate(
  $I.annote("DockRejectionReason", {
    description: "Expected business reasons for rejecting a dock command.",
  })
);
/**
 * Decoded business reason for rejecting a dock command.
 *
 * **Example** (Annotate rejection reason type)
 *
 * ```ts
 * import { DockRejectionReason } from "@beep/dock"
 *
 * const value: DockRejectionReason = DockRejectionReason.make("panel-not-found")
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DockRejectionReason = typeof DockRejectionReason.Type;

const DockCommandRejectedFields = {
  commandId: CommandId,
  reason: DockRejectionReason,
  message: S.String,
} satisfies S.Struct.Fields;
const sameDockCommandRejectedFields = S.toEquivalence(S.TaggedStruct("DockCommandRejected", DockCommandRejectedFields));
const sameDockCommandRejected = (self: DockCommandRejected, that: DockCommandRejected): boolean =>
  sameDockCommandRejectedFields(self, that);

/**
 * Typed expected command rejection that leaves state untouched.
 *
 * **Example** (Make rejected command error)
 *
 * ```ts
 * import { CommandId, DockCommandRejected } from "@beep/dock"
 *
 * const value = DockCommandRejected.make({ commandId: CommandId.make("command-close"), reason: "panel-not-found", message: "Panel was not found" })
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DockCommandRejected extends S.TaggedError<DockCommandRejected>($I`DockCommandRejected`)(
  "DockCommandRejected",
  DockCommandRejectedFields,
  $I.annoteClass<
    S.declare<DockCommandRejected>,
    readonly [S.TaggedStruct<"DockCommandRejected", typeof DockCommandRejectedFields>]
  >("DockCommandRejected", {
    description: "An expected command rejection that leaves state untouched.",
    toEquivalence: () => sameDockCommandRejected,
  })
) {}

/**
 * Workspace invariant failure reason.
 *
 * **Example** (Make duplicate-panel-id reason)
 *
 * ```ts
 * import { DockInvariantReason } from "@beep/dock"
 *
 * const value = DockInvariantReason.make("duplicate-panel-id")
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DockInvariantReason = LiteralKit([
  "duplicate-panel-id",
  "duplicate-group-id",
  "duplicate-split-id",
  "revision-exhausted",
  "topology-corrupted",
  "maximized-group-invalid",
]).annotate(
  $I.annote("DockInvariantReason", {
    description: "Workspace invariant failures surfaced through the typed transition boundary.",
  })
);
/**
 * Decoded workspace invariant failure reason.
 *
 * **Example** (Annotate invariant reason type)
 *
 * ```ts
 * import { DockInvariantReason } from "@beep/dock"
 *
 * const value: DockInvariantReason = DockInvariantReason.make("duplicate-panel-id")
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DockInvariantReason = typeof DockInvariantReason.Type;

const DockInvariantViolationFields = {
  reason: DockInvariantReason,
  message: S.String,
} satisfies S.Struct.Fields;
const sameDockInvariantViolationFields = S.toEquivalence(
  S.TaggedStruct("DockInvariantViolation", DockInvariantViolationFields)
);
const sameDockInvariantViolation = (self: DockInvariantViolation, that: DockInvariantViolation): boolean =>
  sameDockInvariantViolationFields(self, that);

/**
 * Typed workspace invariant failure detected before publication.
 *
 * **Example** (Make invariant violation error)
 *
 * ```ts
 * import { DockInvariantViolation } from "@beep/dock"
 *
 * const value = DockInvariantViolation.make({ reason: "duplicate-panel-id", message: "Panel identifiers must be unique" })
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DockInvariantViolation extends S.TaggedError<DockInvariantViolation>($I`DockInvariantViolation`)(
  "DockInvariantViolation",
  DockInvariantViolationFields,
  $I.annoteClass<
    S.declare<DockInvariantViolation>,
    readonly [S.TaggedStruct<"DockInvariantViolation", typeof DockInvariantViolationFields>]
  >("DockInvariantViolation", {
    description: "A workspace invariant failed before state publication.",
    toEquivalence: () => sameDockInvariantViolation,
  })
) {}

/**
 * External schema boundary for rejected unknown input.
 *
 * **Example** (Make command boundary value)
 *
 * ```ts
 * import { DockInputBoundary } from "@beep/dock"
 *
 * const value = DockInputBoundary.make("command")
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DockInputBoundary = LiteralKit(["command", "snapshot"]).annotate(
  $I.annote("DockInputBoundary", {
    description: "External schema boundary at which unknown input was rejected.",
  })
);
/**
 * Decoded external schema boundary for rejected unknown input.
 *
 * **Example** (Annotate input boundary type)
 *
 * ```ts
 * import { DockInputBoundary } from "@beep/dock"
 *
 * const value: DockInputBoundary = DockInputBoundary.make("command")
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DockInputBoundary = typeof DockInputBoundary.Type;

const DockInputErrorFields = {
  boundary: DockInputBoundary,
  message: S.String,
} satisfies S.Struct.Fields;
const sameDockInputErrorFields = S.toEquivalence(S.TaggedStruct("DockInputError", DockInputErrorFields));
const sameDockInputError = (self: DockInputError, that: DockInputError): boolean =>
  sameDockInputErrorFields(self, that);

/**
 * Typed decoding failure at a public input boundary.
 *
 * **Example** (Make snapshot input error)
 *
 * ```ts
 * import { DockInputError } from "@beep/dock"
 *
 * const value = DockInputError.make({ boundary: "snapshot", message: "Invalid snapshot" })
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DockInputError extends S.TaggedError<DockInputError>($I`DockInputError`)(
  "DockInputError",
  DockInputErrorFields,
  $I.annoteClass<S.declare<DockInputError>, readonly [S.TaggedStruct<"DockInputError", typeof DockInputErrorFields>]>(
    "DockInputError",
    {
      description: "Schema decoding failure mapped at a public POC boundary.",
      toEquivalence: () => sameDockInputError,
    }
  )
) {}

/**
 * Snapshot-store operation that may fail.
 *
 * **Example** (Make save operation value)
 *
 * ```ts
 * import { DockPersistenceOperation } from "@beep/dock"
 *
 * const value = DockPersistenceOperation.make("save")
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DockPersistenceOperation = LiteralKit(["load", "save"]).annotate(
  $I.annote("DockPersistenceOperation", {
    description: "Snapshot-store operation that can fail in a host adapter.",
  })
);
/**
 * Decoded snapshot-store operation that may fail.
 *
 * **Example** (Annotate persistence operation type)
 *
 * ```ts
 * import { DockPersistenceOperation } from "@beep/dock"
 *
 * const value: DockPersistenceOperation = DockPersistenceOperation.make("save")
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DockPersistenceOperation = typeof DockPersistenceOperation.Type;

const DockPersistenceErrorFields = {
  operation: DockPersistenceOperation,
  message: S.String,
} satisfies S.Struct.Fields;
const sameDockPersistenceErrorFields = S.toEquivalence(
  S.TaggedStruct("DockPersistenceError", DockPersistenceErrorFields)
);
const sameDockPersistenceError = (self: DockPersistenceError, that: DockPersistenceError): boolean =>
  sameDockPersistenceErrorFields(self, that);

/**
 * Typed failure from a replaceable snapshot-store adapter.
 *
 * **Example** (Make save persistence error)
 *
 * ```ts
 * import { DockPersistenceError } from "@beep/dock"
 *
 * const value = DockPersistenceError.make({ operation: "save", message: "Storage unavailable" })
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DockPersistenceError extends S.TaggedError<DockPersistenceError>($I`DockPersistenceError`)(
  "DockPersistenceError",
  DockPersistenceErrorFields,
  $I.annoteClass<
    S.declare<DockPersistenceError>,
    readonly [S.TaggedStruct<"DockPersistenceError", typeof DockPersistenceErrorFields>]
  >("DockPersistenceError", {
    description: "Failure while loading or saving a dock snapshot.",
    toEquivalence: () => sameDockPersistenceError,
  })
) {}

const DockSnapshotMissingFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameDockSnapshotMissingFields = S.toEquivalence(S.TaggedStruct("DockSnapshotMissing", DockSnapshotMissingFields));
const sameDockSnapshotMissing = (self: DockSnapshotMissing, that: DockSnapshotMissing): boolean =>
  sameDockSnapshotMissingFields(self, that);

/**
 * Typed absence of a requested persisted snapshot.
 *
 * **Example** (Make missing snapshot error)
 *
 * ```ts
 * import { DockSnapshotMissing } from "@beep/dock"
 *
 * const value = DockSnapshotMissing.make({ message: "No snapshot exists" })
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DockSnapshotMissing extends S.TaggedError<DockSnapshotMissing>($I`DockSnapshotMissing`)(
  "DockSnapshotMissing",
  DockSnapshotMissingFields,
  $I.annoteClass<
    S.declare<DockSnapshotMissing>,
    readonly [S.TaggedStruct<"DockSnapshotMissing", typeof DockSnapshotMissingFields>]
  >("DockSnapshotMissing", {
    description: "No persisted snapshot exists for a restore action.",
    toEquivalence: () => sameDockSnapshotMissing,
  })
) {}

/**
 * Tagged union of typed transition failures.
 *
 * **Example** (Create command rejected member)
 *
 * ```ts
 * import { CommandId, DockCommandRejected, DockTransitionError } from "@beep/dock"
 *
 * const value = DockCommandRejected.make({ commandId: CommandId.make("command-close"), reason: "panel-not-found", message: "Panel was not found" })
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DockTransitionError = S.Union([DockCommandRejected, DockInvariantViolation]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DockTransitionError", {
    description: "Error while executing a dock transition.",
  })
);

/**
 * Decoded tagged union of typed transition failures.
 *
 * **Example** (Type transition error union)
 *
 * ```ts
 * import { CommandId, DockCommandRejected, DockTransitionError } from "@beep/dock"
 *
 * const value: DockTransitionError = DockCommandRejected.make({ commandId: CommandId.make("command-close"), reason: "panel-not-found", message: "Panel was not found" })
 * console.log(value)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DockTransitionError = typeof DockTransitionError.Type;
