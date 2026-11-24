/**
 * The events an adapter emits while a gate runs; they reduce to one
 * {@link GateReport}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { Unit } from "./GateReport.ts";
import { Item, ItemDetail, Location } from "./Item.ts";
import { ItemKey } from "./ItemKey.ts";
import { optionalSlot } from "./internal/slots.ts";
import { PolicyBreach } from "./Policy.ts";
import { Count, DurationMs, IsoInstant, Text } from "./Scalars.ts";
import { StrayOutput } from "./StrayOutput.ts";
import { FailureKind, HistoryLabel, ItemKind, RunReason } from "./Vocabulary.ts";

const $I = $GateReportId.create("GateEvent");

/**
 * The failure kinds a unit-level fault carries: a module that failed to load
 * or a hook that threw.
 *
 * **Example** (Guard a unit fault kind)
 *
 * ```ts
 * import { UnitFaultKind } from "@beep/gate-report/GateEvent";
 *
 * console.log(UnitFaultKind.is.hook("hook")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UnitFaultKind = FailureKind.pick(["load", "hook"]).pipe(
  $I.annoteSchema("UnitFaultKind", {
    description: "The failure kinds a unit-level fault carries: load or hook.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type UnitFaultKind = typeof UnitFaultKind.Type;

/**
 * **Details**
 *
 * Widens upstream `RunEvent`: `Module*`, `Test*`, `Suite*` and `Hook*` become
 * `Unit*` and `Item*`; a hook throw and a load failure are one `UnitFaulted`;
 * coverage thresholds become `PolicyBreached`; `FailureClassified` becomes
 * `ItemLabelled`; `RunTimedOut` becomes `RunCancelled`. `ItemFinished`
 * carries the whole item the adapter built. `RunFinished` carries the tool's
 * own reason and exit code; the reducer applies the honest-count rules over
 * them.
 *
 * **Example** (Build a run start event)
 *
 * ```ts
 * import { GateEvent } from "@beep/gate-report/GateEvent";
 * import * as DateTime from "effect/DateTime";
 *
 * const event = GateEvent.cases.RunStarted.make({
 *   runId: "r1",
 *   gate: "test",
 *   subject: "@beep/glob",
 *   itemKind: "test",
 *   startedAt: DateTime.makeUnsafe(0),
 *   inputFingerprint: "abc",
 * });
 * console.log(event._tag); // RunStarted
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GateEvent = S.TaggedUnion({
  RunStarted: {
    runId: Text,
    gate: Text,
    subject: Text,
    itemKind: ItemKind,
    startedAt: IsoInstant,
    inputFingerprint: Text,
    head: optionalSlot(Text),
    branch: optionalSlot(Text),
  },
  UnitQueued: { unit: Unit },
  UnitStarted: { unit: Text },
  UnitCollected: { unit: Text, items: Count },
  UnitFinished: { unit: Text, durationMs: DurationMs },
  UnitFaulted: {
    unit: Text,
    kind: UnitFaultKind,
    name: S.String,
    detail: ItemDetail,
    location: optionalSlot(Location),
  },
  ItemStarted: { key: ItemKey, unit: Text },
  ItemFinished: { item: Item },
  ItemLabelled: { key: ItemKey, label: HistoryLabel },
  UnhandledError: { detail: ItemDetail, location: optionalSlot(Location) },
  PolicyBreached: { breach: PolicyBreach },
  StrayOutputCaptured: { strayOutput: StrayOutput },
  RunCancelled: { message: S.String },
  RunFinished: {
    durationMs: DurationMs,
    reason: RunReason,
    exitCode: optionalSlot(S.Int),
    collected: optionalSlot(Count),
    logExcerpt: optionalSlot(S.String),
  },
}).pipe(
  $I.annoteSchema("GateEvent", {
    description: "One event of a gate run, emitted by an adapter and reduced into a gate report.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type GateEvent = typeof GateEvent.Type;
