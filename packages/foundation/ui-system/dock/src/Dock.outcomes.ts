/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { CommandOrigin } from "./Dock.commands.ts";
import { DockEvent } from "./Dock.events.ts";
import { CommandId } from "./Dock.ids.ts";
import { DockWorkspace } from "./Dock.tree.ts";

const $I = $DockId.create("Dock.outcomes");

/**
 * Reason a valid dock intent produces no change.
 *
 * @example
 * ```ts
 * import { DockUnchangedReason } from "@beep/dock"
 *
 * const value = DockUnchangedReason.make("panel-already-active")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DockUnchangedReason = LiteralKit([
  "panel-already-active",
  "panel-unchanged",
  "group-unchanged",
  "split-ratio-unchanged",
  "snapshot-identical",
  "panel-position-unchanged",
  "topology-unchanged",
  "group-already-maximized",
  "no-group-maximized",
  "floating-position-unchanged",
]).annotate(
  $I.annote("DockUnchangedReason", {
    description: "Expected reasons a valid dock intent produces no state change or domain event.",
  })
);
/**
 * Decoded reason a valid dock intent produces no change.
 *
 * @example
 * ```ts
 * import { DockUnchangedReason } from "@beep/dock"
 *
 * const value: DockUnchangedReason = DockUnchangedReason.make("panel-already-active")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DockUnchangedReason = typeof DockUnchangedReason.Type;

/**
 * Result for a state-changing dock intent with emitted events.
 *
 * @example
 * ```ts
 * import { DockChanged, DockWorkspace, WorkspaceClearedEvent } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const value = DockChanged.make({ previousRevision: NonNegativeInt.make(0), state: DockWorkspace.empty, events: [WorkspaceClearedEvent.make()] })
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DockChanged extends S.TaggedClass<DockChanged>($I`DockChanged`)(
  "Changed",
  {
    previousRevision: NonNegativeInt,
    state: DockWorkspace,
    events: S.NonEmptyArray(DockEvent),
  },
  $I.annote("DockChanged", {
    description: "A dock intent changed state and produced causally associated events.",
  })
) {}

/**
 * Result for a valid idempotent dock intent.
 *
 * @example
 * ```ts
 * import { DockUnchanged } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const value = DockUnchanged.make({ revision: NonNegativeInt.make(3), reason: "panel-already-active" })
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DockUnchanged extends S.TaggedClass<DockUnchanged>($I`DockUnchanged`)(
  "Unchanged",
  {
    revision: NonNegativeInt,
    reason: DockUnchangedReason,
  },
  $I.annote("DockUnchanged", {
    description: "A valid dock intent left state and revision untouched and emitted no event.",
  })
) {}

/**
 * Tagged result of a valid dock mutation.
 *
 * @example
 * ```ts
 * import { DockMutationResult, DockUnchanged } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const value = DockUnchanged.make({ revision: NonNegativeInt.make(3), reason: "panel-already-active" })
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DockMutationResult = S.Union([DockChanged, DockUnchanged]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DockMutationResult", {
    description: "Discriminates published state changes from idempotent no-change results.",
  })
);
/**
 * Decoded tagged result of a valid dock mutation.
 *
 * @example
 * ```ts
 * import { DockMutationResult, DockUnchanged } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const value: DockMutationResult = DockUnchanged.make({ revision: NonNegativeInt.make(3), reason: "panel-already-active" })
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DockMutationResult = typeof DockMutationResult.Type;

/**
 * Causal envelope around a changed or unchanged mutation.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, CommandId, DockMutationOutcome, DockUnchanged } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const value = DockMutationOutcome.make({ commandId: CommandId.make("command-activate"), origin: ApiCommandOrigin.make({ requestId: "request-one" }), result: DockUnchanged.make({ revision: NonNegativeInt.make(3), reason: "panel-already-active" }) })
 * console.log(value.commandId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DockMutationOutcome extends S.Class<DockMutationOutcome>($I`DockMutationOutcome`)(
  {
    commandId: CommandId,
    origin: CommandOrigin,
    result: DockMutationResult,
  },
  $I.annote("DockMutationOutcome", {
    description: "Causally identified result of a valid command or snapshot restore.",
  })
) {}
