/**
 * Parcel freshness: `Fresh` when every source reading is within the parcel's
 * bound, otherwise `Unknown` with the reason.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PalantiriId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $PalantiriId.create("Freshness");

/**
 * **Details**
 *
 * `stale`: the oldest reading is older than the bound. `unreachable`: the
 * source failed or returned nothing usable. `attribution-incomplete`: an
 * expected emitter is silent. `no-source`: the parcel has no source yet.
 *
 * **Example** (Narrow a reason)
 *
 * ```ts
 * import { UnknownReason } from "@beep/palantiri/Freshness"
 *
 * console.log(UnknownReason.is.stale("stale")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UnknownReason = LiteralKit(["stale", "unreachable", "attribution-incomplete", "no-source"]).pipe(
  $I.annoteSchema("UnknownReason", { description: "Why a parcel's freshness is unknown." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type UnknownReason = typeof UnknownReason.Type;

/**
 * Freshness of a parcel, checked when it is read.
 *
 * **Details**
 *
 * `Fresh.asOf` is the oldest source reading. `Unknown.asOf` is that reading
 * when one exists; `detail` is a short, non-identifying explanation.
 *
 * **Example** (Match a freshness)
 *
 * ```ts
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import * as O from "effect/Option"
 *
 * const unknown = Freshness.cases.Unknown.make({ reason: "unreachable", asOf: O.none(), detail: O.some("offline") })
 * console.log(Freshness.match(unknown, { Fresh: () => "fresh", Unknown: (value) => value.reason })) // "unreachable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Freshness = S.TaggedUnion({
  Fresh: { asOf: S.DateTimeUtcFromString },
  Unknown: {
    reason: UnknownReason,
    asOf: S.OptionFromOptionalKey(S.DateTimeUtcFromString),
    detail: S.OptionFromOptionalKey(S.String),
  },
}).pipe($I.annoteSchema("Freshness", { description: "Whether a parcel's source readings are within its bound." }));

/**
 * @category models
 * @since 0.0.0
 */
export type Freshness = typeof Freshness.Type;

/**
 * Check readings against a freshness bound.
 *
 * **Details**
 *
 * No readings is `Unknown{no-source}`. Otherwise the oldest reading decides:
 * within `bound` of `now` is `Fresh`, older is `Unknown{stale}`. A reading
 * from the future counts as fresh.
 *
 * **Example** (A reading older than the bound is stale)
 *
 * ```ts
 * import { checkFreshness } from "@beep/palantiri/Freshness"
 * import * as DateTime from "effect/DateTime"
 * import * as Duration from "effect/Duration"
 *
 * const now = DateTime.makeUnsafe("2026-10-14T12:00:00Z")
 * const old = DateTime.makeUnsafe("2026-10-14T11:50:00Z")
 * console.log(checkFreshness(now, Duration.minutes(5), [old])._tag) // "Unknown"
 * console.log(checkFreshness(now, Duration.minutes(15), [old])._tag) // "Fresh"
 * ```
 *
 * @param now - The read time.
 * @param bound - The longest a reading may age and still count as fresh.
 * @param asOfs - When each source reading was taken.
 * @returns The parcel's freshness.
 * @category utilities
 * @since 0.0.0
 */
export const checkFreshness: {
  (bound: Duration.Duration, asOfs: ReadonlyArray<DateTime.Utc>): (now: DateTime.Utc) => Freshness;
  (now: DateTime.Utc, bound: Duration.Duration, asOfs: ReadonlyArray<DateTime.Utc>): Freshness;
} = dual(
  3,
  (now: DateTime.Utc, bound: Duration.Duration, asOfs: ReadonlyArray<DateTime.Utc>): Freshness =>
    A.match(asOfs, {
      onEmpty: () =>
        Freshness.cases.Unknown.make({
          reason: UnknownReason.Enum["no-source"],
          asOf: O.none(),
          detail: O.some("no source reported a reading"),
        }),
      onNonEmpty: (readings) => {
        const oldest = A.min(readings, DateTime.Order);
        return Duration.isGreaterThan(DateTime.distance(oldest, now), bound)
          ? Freshness.cases.Unknown.make({ reason: UnknownReason.Enum.stale, asOf: O.some(oldest), detail: O.none() })
          : Freshness.cases.Fresh.make({ asOf: oldest });
      },
    })
);

/**
 * Whether an item's own freshness is `Fresh`.
 *
 * **Example** (Check an item)
 *
 * ```ts
 * import { Freshness, isFreshItem } from "@beep/palantiri/Freshness"
 * import * as DateTime from "effect/DateTime"
 *
 * const item = { freshness: Freshness.cases.Fresh.make({ asOf: DateTime.makeUnsafe(0) }) }
 * console.log(isFreshItem(item)) // true
 * ```
 *
 * @param item - Any parcel item.
 * @returns `true` when the item is fresh.
 * @category predicates
 * @since 0.0.0
 */
export const isFreshItem = <A extends { readonly freshness: Freshness }>(item: A): boolean =>
  item.freshness._tag === "Fresh";

const MAX_LABELS = 5;

const nameLabels = (labels: ReadonlyArray<string>): string =>
  labels.length > MAX_LABELS
    ? `${A.join(A.take(labels, MAX_LABELS), ", ")}, +${labels.length - MAX_LABELS} more`
    : A.join(labels, ", ");

/**
 * Summary parts for the items whose freshness is unknown, one per reason in
 * `UnknownReason` order, such as `1 stale (grok-bot)`.
 *
 * **Details**
 *
 * Each part counts the items with that reason and names their distinct
 * labels in first-seen order, at most five, then `+N more`. Reasons no item
 * has are left out, so all-fresh items give no parts.
 *
 * **Example** (Name the unknown items)
 *
 * ```ts
 * import { Freshness, unknownSplit } from "@beep/palantiri/Freshness"
 * import * as O from "effect/Option"
 *
 * const stale = Freshness.cases.Unknown.make({ reason: "stale", asOf: O.none(), detail: O.none() })
 * console.log(unknownSplit([{ name: "a", freshness: stale }], (item) => item.name)) // ["1 stale (a)"]
 * ```
 *
 * @param items - The parcel's items.
 * @param label - The name a part lists for an item.
 * @returns One part per unknown reason present.
 * @category formatting
 * @since 0.0.0
 */
export const unknownSplit: {
  <A extends { readonly freshness: Freshness }>(
    label: (item: A) => string
  ): (items: ReadonlyArray<A>) => ReadonlyArray<string>;
  <A extends { readonly freshness: Freshness }>(
    items: ReadonlyArray<A>,
    label: (item: A) => string
  ): ReadonlyArray<string>;
} = dual(
  2,
  <A extends { readonly freshness: Freshness }>(
    items: ReadonlyArray<A>,
    label: (item: A) => string
  ): ReadonlyArray<string> =>
    A.getSomes(
      A.map(UnknownReason.literals, (reason) =>
        A.match(
          A.filter(items, (item) =>
            Freshness.match(item.freshness, { Fresh: () => false, Unknown: (unknown) => unknown.reason === reason })
          ),
          {
            onEmpty: O.none,
            onNonEmpty: (some) => O.some(`${some.length} ${reason} (${nameLabels(A.dedupe(A.map(some, label)))})`),
          }
        )
      )
    )
);
