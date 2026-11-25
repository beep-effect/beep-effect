/**
 * One gate run as a typed report: the gate, the subject, the units it was
 * asked to cover, the items it produced, the totals, the run reason and the
 * outcome.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Item } from "./Item.ts";
import { optionalSlot } from "./internal/slots.ts";
import { PolicyRenderState } from "./Policy.ts";
import { Count, DurationMs, IsoInstant, Text } from "./Scalars.ts";
import { StrayOutput } from "./StrayOutput.ts";
import { ItemKind, RunOutcome, RunReason, UnitKind } from "./Vocabulary.ts";

const $I = $GateReportId.create("GateReport");

/**
 * What a gate was asked to cover: a package, a file or a CI job.
 *
 * **Details**
 *
 * Units form a tree at most two deep: a file names its package as `parent`.
 * Items hang off leaf units.
 *
 * **Example** (Build a file unit)
 *
 * ```ts
 * import { Unit } from "@beep/gate-report/GateReport";
 * import * as O from "effect/Option";
 *
 * const unit = Unit.make({ id: "src/a.test.ts", kind: "file", parent: O.some("@beep/glob") });
 * console.log(unit.kind); // file
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Unit extends S.Opaque<Unit, { readonly brand: unique symbol }>()(
  S.Struct({
    id: Text,
    kind: UnitKind,
    parent: optionalSlot(Text),
    durationMs: optionalSlot(DurationMs),
  }).pipe(
    $I.annoteSchema("Unit", {
      description: "A package, file or job the gate was asked to cover.",
    })
  )
) {}

const countField = Count.pipe(S.withConstructorDefault(Effect.succeed(0)));

/**
 * The counts a report carries, each with its own total.
 *
 * **Details**
 *
 * Widens upstream `RenderTotals` with `collected`, `warned` and `errored`,
 * and gives load failures, hook failures and unhandled errors their own
 * totals. `failed` counts assertion failures only, so history math stays a
 * pure item count. Fields default to zero when constructed.
 *
 * **Example** (Build totals)
 *
 * ```ts
 * import { Totals } from "@beep/gate-report/GateReport";
 *
 * const totals = Totals.make({ collected: 2, passed: 1, failed: 1 });
 * console.log(totals.skipped); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Totals extends S.Opaque<Totals, { readonly brand: unique symbol }>()(
  S.Struct({
    collected: countField,
    passed: countField,
    failed: countField,
    warned: countField,
    skipped: countField,
    timedOut: countField,
    loadFailed: countField,
    hookFailed: countField,
    unhandled: countField,
    errored: countField,
    durationMs: DurationMs.pipe(S.withConstructorDefault(Effect.succeed(0))),
  }).pipe(
    $I.annoteSchema("Totals", {
      description: "The counts of one run, with a separate total for every failure kind.",
    })
  )
) {}

/**
 * **Details**
 *
 * `inputFingerprint` is opaque: the Turbo task hash or a digest of the head
 * commit and the subject's changes, chosen by the caller. `runId` sorts by
 * time. `reason` gives the verdict word; `outcome` selects the dispatch cell.
 * A diagnostic gate records only failing and warning items; a unit it checked
 * with no item passed every absent key.
 *
 * **Example** (Build an empty report)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test",
 *   subject: "@beep/glob",
 *   itemKind: "test",
 *   runId: "20261119T100000Z-1",
 *   startedAt: DateTime.makeUnsafe(0),
 *   durationMs: 12,
 *   inputFingerprint: "abc123",
 *   reason: "errored",
 *   outcome: "some-fail",
 *   units: [],
 *   items: [],
 *   totals: Totals.make({}),
 * });
 * console.log(report.reason); // errored
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GateReport extends S.Opaque<GateReport, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: Text,
    subject: Text,
    itemKind: ItemKind,
    runId: Text,
    startedAt: IsoInstant,
    durationMs: DurationMs,
    inputFingerprint: Text,
    head: optionalSlot(Text),
    branch: optionalSlot(Text),
    reason: RunReason,
    outcome: RunOutcome,
    units: S.Array(Unit),
    items: S.Array(Item),
    totals: Totals,
    policy: optionalSlot(PolicyRenderState),
    strayOutput: optionalSlot(StrayOutput),
  }).pipe(
    $I.annoteSchema("GateReport", {
      description: "One gate run: its units, items, totals, run reason and outcome.",
    })
  )
) {}
