/**
 * The envelope every parcel is served in, and the union of parcel items it
 * carries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PalantiriId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { AccountHeadroom } from "./AccountHeadroom.models.ts";
import { Freshness } from "./Freshness.ts";
import { GithubHeadroom } from "./GithubHeadroom.models.ts";
import { AdmissionSlots, HostMemory, PressureStall } from "./HostPressure.models.ts";
import { LaneRed } from "./LaneReds.models.ts";
import { ParcelBudget, ParcelId, ParcelKey, ParcelReceipt, ParcelSpec } from "./Parcel.models.ts";
import { SessionChange } from "./SinceLastCheck.models.ts";

const $I = $PalantiriId.create("ParcelEnvelope.models");

/**
 * Any parcel item, tagged by item kind: `AccountHeadroom`, `LaneRed`,
 * `PressureStall`, `HostMemory`, `AdmissionSlots`, `SessionChange` or
 * `GithubHeadroom`.
 *
 * **Example** (Guard an item)
 *
 * ```ts
 * import { AccountHeadroom } from "@beep/palantiri/AccountHeadroom.models"
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import { ParcelItem } from "@beep/palantiri/ParcelEnvelope.models"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const unreachable = Freshness.cases.Unknown.make({ reason: "unreachable", asOf: O.none(), detail: O.none() })
 * const item = AccountHeadroom.make({ provider: "codex", account: 1, state: "failed", windows: [], asOf: O.none(), freshness: unreachable, sources: ["accounts-poll"] })
 * console.log(S.is(ParcelItem)(item)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ParcelItem = S.Union([
  AccountHeadroom,
  LaneRed,
  PressureStall,
  HostMemory,
  AdmissionSlots,
  SessionChange,
  GithubHeadroom,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ParcelItem", { description: "One item of any parcel, tagged by item kind." })
);

/**
 * Runtime type for {@link ParcelItem}.
 *
 * @category models
 * @since 0.0.0
 */
export type ParcelItem = typeof ParcelItem.Type;

/**
 * The envelope every parcel is served in: summary first, freshness, at most
 * a budget of items, and an "N of M" receipt.
 *
 * **Example** (Make an empty envelope)
 *
 * ```ts
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import { ParcelEnvelope } from "@beep/palantiri/ParcelEnvelope.models"
 * import { ParcelReceipt } from "@beep/palantiri/Parcel.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const envelope = ParcelEnvelope.make({
 *   schemaVersion: "palantiri-parcel/v1",
 *   parcel: "account-headroom",
 *   key: "account",
 *   readAt: DateTime.makeUnsafe("2026-10-14T12:00:00Z"),
 *   freshness: Freshness.cases.Unknown.make({ reason: "no-source", asOf: O.none(), detail: O.none() }),
 *   summary: "no accounts",
 *   items: [],
 *   receipt: ParcelReceipt.make({ shown: 0, total: 0 })
 * })
 * console.log(envelope.receipt.shown) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParcelEnvelope extends S.Opaque<ParcelEnvelope, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("palantiri-parcel/v1"),
    parcel: ParcelId,
    key: ParcelKey,
    readAt: S.DateTimeUtcFromString,
    freshness: Freshness,
    summary: S.String,
    items: S.Array(ParcelItem),
    receipt: ParcelReceipt,
  }).pipe(
    $I.annoteSchema("ParcelEnvelope", {
      description: "A parcel response: summary, freshness, budget-capped items and an N-of-M receipt.",
    })
  )
) {}

/**
 * Everything a parcel envelope is built from, before the budget is applied.
 *
 * **Example** (Make a draft)
 *
 * ```ts
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import { ParcelSpec } from "@beep/palantiri/Parcel.models"
 * import { ParcelDraft } from "@beep/palantiri/ParcelEnvelope.models"
 * import * as DateTime from "effect/DateTime"
 * import * as Duration from "effect/Duration"
 *
 * const now = DateTime.makeUnsafe("2026-10-14T12:00:00Z")
 * const draft = ParcelDraft.make({
 *   spec: ParcelSpec.make({ id: "account-headroom", key: "account", freshnessBound: Duration.minutes(5), sources: ["accounts-poll"] }),
 *   readAt: now,
 *   freshness: Freshness.cases.Fresh.make({ asOf: now }),
 *   summary: "0 accounts",
 *   items: [],
 *   budget: 20
 * })
 * console.log(draft.budget) // 20
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParcelDraft extends S.Opaque<ParcelDraft, { readonly brand: unique symbol }>()(
  S.Struct({
    spec: ParcelSpec,
    readAt: S.DateTimeUtcFromString,
    freshness: Freshness,
    summary: S.String,
    items: S.Array(ParcelItem),
    budget: ParcelBudget,
  }).pipe(
    $I.annoteSchema("ParcelDraft", {
      description: "A parcel's spec, read time, freshness, summary and every item, before the budget is applied.",
    })
  )
) {}

/**
 * Wrap a parcel's items in an envelope, keeping at most `budget` of them.
 *
 * **Example** (Cap the items at the budget)
 *
 * ```ts
 * import { AccountHeadroom } from "@beep/palantiri/AccountHeadroom.models"
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import { ParcelSpec } from "@beep/palantiri/Parcel.models"
 * import { ParcelDraft, makeParcelEnvelope } from "@beep/palantiri/ParcelEnvelope.models"
 * import * as A from "effect/Array"
 * import * as DateTime from "effect/DateTime"
 * import * as Duration from "effect/Duration"
 * import * as O from "effect/Option"
 *
 * const now = DateTime.makeUnsafe("2026-10-14T12:00:00Z")
 * const unreachable = Freshness.cases.Unknown.make({ reason: "unreachable", asOf: O.none(), detail: O.none() })
 * const envelope = makeParcelEnvelope(
 *   ParcelDraft.make({
 *     spec: ParcelSpec.make({ id: "account-headroom", key: "account", freshnessBound: Duration.minutes(5), sources: ["accounts-poll"] }),
 *     readAt: now,
 *     freshness: Freshness.cases.Fresh.make({ asOf: now }),
 *     summary: "3 accounts",
 *     items: A.makeBy(3, (index) =>
 *       AccountHeadroom.make({ provider: "codex", account: index + 1, state: "failed", windows: [], asOf: O.none(), freshness: unreachable, sources: ["accounts-poll"] })
 *     ),
 *     budget: 2
 *   })
 * )
 * console.log(envelope.receipt.shown) // 2
 * console.log(envelope.receipt.total) // 3
 * ```
 *
 * @param draft - The spec, read time, freshness, summary, every item, and the budget.
 * @returns The envelope with at most `budget` items.
 * @category constructors
 * @since 0.0.0
 */
export const makeParcelEnvelope = (draft: ParcelDraft): ParcelEnvelope => {
  const shown = A.take(draft.items, draft.budget);
  return ParcelEnvelope.make({
    schemaVersion: "palantiri-parcel/v1",
    parcel: draft.spec.id,
    key: draft.spec.key,
    readAt: draft.readAt,
    freshness: draft.freshness,
    summary: draft.summary,
    items: shown,
    receipt: ParcelReceipt.make({ shown: shown.length, total: draft.items.length }),
  });
};
