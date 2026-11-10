/**
 * The github-headroom parcel: its spec and the pure reducer from this host's
 * GitHub budget ledger to per-bucket headroom.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import { dual, pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { checkFreshness, Freshness, isFreshItem, unknownSplit } from "./Freshness.ts";
import { GithubHeadroom, GithubHeadroomInput, GithubReadingBasis, GithubReserveName } from "./GithubHeadroom.models.ts";
import { ParcelSpec } from "./Parcel.models.ts";
import { makeParcelEnvelope, ParcelDraft } from "./ParcelEnvelope.models.ts";
import type { Freshness as FreshnessType } from "./Freshness.ts";
import type { GithubHeadroomBucketInput, GithubSpender } from "./GithubHeadroom.models.ts";
import type { ParcelBudget } from "./Parcel.models.ts";
import type { ParcelEnvelope } from "./ParcelEnvelope.models.ts";

/**
 * Spec of the github-headroom parcel: keyed by account, fresh for 15 minutes
 * (three 5-minute sampler periods).
 *
 * **Example** (Read the freshness bound)
 *
 * ```ts
 * import { GithubHeadroomSpec } from "@beep/palantiri/GithubHeadroom"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMinutes(GithubHeadroomSpec.freshnessBound)) // 15
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GithubHeadroomSpec = ParcelSpec.make({
  id: "github-headroom",
  key: "account",
  freshnessBound: Duration.minutes(15),
  sources: ["github-ledger", "github-rate-limit-sample"],
});

const SUMMARY_RESOURCES: ReadonlyArray<string> = ["core", "graphql", "search"];
const TOP_SPENDERS = 3;
const NO_LEDGER = "github headroom unknown: no ledger on this host";

const resourceRank = (resource: string): number =>
  O.getOrElse(
    A.findFirstIndex(SUMMARY_RESOURCES, (known) => known === resource),
    () => SUMMARY_RESOURCES.length
  );

const byBucket: Order.Order<GithubHeadroomBucketInput> = Order.combineAll([
  Order.mapInput(Order.String, (bucket: GithubHeadroomBucketInput) => bucket.identity),
  Order.mapInput(Num.Order, (bucket: GithubHeadroomBucketInput) => resourceRank(bucket.resource)),
  Order.mapInput(Order.String, (bucket: GithubHeadroomBucketInput) => bucket.resource),
]);

const toItem =
  (now: DateTime.Utc) =>
  (bucket: GithubHeadroomBucketInput): GithubHeadroom =>
    GithubHeadroom.make({
      identity: bucket.identity,
      resource: bucket.resource,
      limit: bucket.limit,
      remaining: bucket.remaining,
      resetsAt: bucket.resetsAt,
      reserve: bucket.reserve,
      reserveFloor: bucket.reserveFloor,
      asOf: O.some(bucket.asOf),
      freshness: checkFreshness(now, GithubHeadroomSpec.freshnessBound, [bucket.asOf]),
      sources: GithubReadingBasis.is.sample(bucket.basis)
        ? ["github-ledger", "github-rate-limit-sample"]
        : ["github-ledger"],
      unattributedLastHour: bucket.unattributedLastHour,
    });

/**
 * Every bucket of the ledger as a headroom item with its own freshness,
 * ordered by identity, then `core`, `graphql`, `search`, then the other
 * resources by name.
 *
 * **Details**
 *
 * A `Missing` ledger has no items. An item is `Fresh` when its reading is
 * within the 15-minute bound of `now` and `Unknown{stale}` when older.
 *
 * **Example** (No ledger, no items)
 *
 * ```ts
 * import { githubHeadroomItems } from "@beep/palantiri/GithubHeadroom"
 * import { GithubHeadroomInput } from "@beep/palantiri/GithubHeadroom.models"
 * import * as DateTime from "effect/DateTime"
 *
 * const now = DateTime.makeUnsafe("2026-11-10T21:00:00Z")
 * const input = GithubHeadroomInput.cases.Missing.make({ detail: "no ledger directory" })
 * console.log(githubHeadroomItems(input, now).length) // 0
 * ```
 *
 * @param input - The host's ledger view, or its absence.
 * @param now - The read time each item's freshness is checked against.
 * @returns One item per bucket.
 * @category mapping
 * @since 0.0.0
 */
export const githubHeadroomItems: {
  (now: DateTime.Utc): (input: GithubHeadroomInput) => ReadonlyArray<GithubHeadroom>;
  (input: GithubHeadroomInput, now: DateTime.Utc): ReadonlyArray<GithubHeadroom>;
} = dual(
  2,
  (input: GithubHeadroomInput, now: DateTime.Utc): ReadonlyArray<GithubHeadroom> =>
    GithubHeadroomInput.match(input, {
      Missing: A.empty<GithubHeadroom>,
      Present: (present) => A.map(A.sort(present.buckets, byBucket), toItem(now)),
    })
);

// Whole minutes, or seconds under a minute, so an age reads "47m", not "47m 12s 340ms".
const ageOf = (from: DateTime.Utc, now: DateTime.Utc): string => {
  const distance = DateTime.distance(from, now);
  const minutes = Math.floor(Duration.toMinutes(distance));
  return minutes >= 1
    ? Duration.format(Duration.minutes(minutes))
    : Duration.format(Duration.seconds(Math.max(0, Math.floor(Duration.toSeconds(distance)))));
};

const clockOf = (at: DateTime.Utc): string => `${pipe(at, DateTime.formatIso, Str.slice(11, 16))}Z`;

const reserveText = (item: GithubHeadroom): string =>
  GithubReserveName.match(item.reserve, {
    clear: () => "",
    below: () =>
      item.limit > 0 ? ` BELOW ${Num.round((item.reserveFloor / item.limit) * 100, 0)}%` : " BELOW reserve",
    unknown: () => " reserve ?",
  });

// The search window resets every minute, so its reset time is noise.
const resetText = (item: GithubHeadroom): string => (item.resource === "search" ? "" : ` ↺${clockOf(item.resetsAt)}`);

const bucketText = (item: GithubHeadroom): string =>
  `${item.resource} ${item.remaining}/${item.limit}${reserveText(item)}${resetText(item)}`;

// The fresh core, graphql and search buckets: the ones the summary shows as headroom.
const shownItems = (items: ReadonlyArray<GithubHeadroom>): ReadonlyArray<GithubHeadroom> =>
  A.filter(items, (item) => isFreshItem(item) && A.contains(SUMMARY_RESOURCES, item.resource));

const headroomText = (items: ReadonlyArray<GithubHeadroom>, now: DateTime.Utc): string =>
  A.match(shownItems(items), {
    onEmpty: () =>
      pipe(
        A.getSomes(A.map(items, (item) => item.asOf)),
        A.match({
          onEmpty: () => "github headroom unknown: no readings on this host",
          onNonEmpty: (asOfs) =>
            `github headroom unknown: last reading ${ageOf(A.max(asOfs, DateTime.Order), now)} ago (sampler idle?)`,
        })
      ),
    onNonEmpty: (fresh) => {
      const identities = A.map(
        R.toEntries(A.groupBy(fresh, (item) => item.identity)),
        ([identity, own]) => `${identity} ${A.join(A.map(own, bucketText), " · ")}`
      );
      const stale = unknownSplit(items, (item) => item.identity);
      return A.join(A.appendAll(identities, stale), "; ");
    },
  });

const byPoints: Order.Order<GithubSpender> = Order.flip(
  Order.mapInput(Num.Order, (spender: GithubSpender) => spender.estimatedPoints)
);

const unattributedText = (items: ReadonlyArray<GithubHeadroom>): O.Option<string> =>
  pipe(
    A.getSomes(A.map(items, (item) => O.map(item.unattributedLastHour, (points) => [item.resource, points] as const))),
    A.filter(([, points]) => points > 0),
    A.groupBy(([resource]) => resource),
    R.toEntries,
    A.sort(Order.mapInput(Num.Order, ([resource]: readonly [string, unknown]) => resourceRank(resource))),
    A.map(([resource, entries]) => `${resource} ${Num.sumAll(A.map(entries, ([, points]) => points))}`),
    A.match({ onEmpty: O.none, onNonEmpty: (parts) => O.some(`unattributed 1h ${A.join(parts, ", ")}`) })
  );

const spendersText = (
  spenders: ReadonlyArray<GithubSpender>,
  summaryAsOf: O.Option<DateTime.Utc>,
  items: ReadonlyArray<GithubHeadroom>,
  now: DateTime.Utc
): string =>
  O.match(summaryAsOf, {
    onNone: () => "spenders unknown (no summary)",
    onSome: (asOf) =>
      checkFreshness(now, GithubHeadroomSpec.freshnessBound, [asOf])._tag === "Fresh"
        ? A.join(
            A.appendAll(
              [
                `top 1h here: ${A.match(A.take(A.sort(spenders, byPoints), TOP_SPENDERS), {
                  onEmpty: () => "none",
                  onNonEmpty: (top) =>
                    A.join(
                      A.map(top, (spender) => `${spender.command} ${spender.estimatedPoints}`),
                      ", "
                    ),
                })}`,
              ],
              A.fromOption(unattributedText(items))
            ),
            "; "
          )
        : `spenders unknown (summary ${ageOf(asOf, now)} old)`,
  });

// Over the shown buckets only: a key seen once (a reviewer App, an old token) must not keep a
// fresh envelope stale. With nothing shown, every bucket decides, so stale stays stale.
const envelopeFreshness = (
  input: GithubHeadroomInput,
  items: ReadonlyArray<GithubHeadroom>,
  now: DateTime.Utc
): FreshnessType =>
  GithubHeadroomInput.match(input, {
    Missing: (missing) =>
      Freshness.cases.Unknown.make({ reason: "no-source", asOf: O.none(), detail: O.some(missing.detail) }),
    Present: (present) =>
      checkFreshness(
        now,
        GithubHeadroomSpec.freshnessBound,
        A.match(shownItems(items), {
          onEmpty: () => A.map(present.buckets, (bucket) => bucket.asOf),
          onNonEmpty: (shown) => A.getSomes(A.map(shown, (item) => item.asOf)),
        })
      ),
  });

const summarize = (input: GithubHeadroomInput, items: ReadonlyArray<GithubHeadroom>, now: DateTime.Utc): string =>
  GithubHeadroomInput.match(input, {
    Missing: () => NO_LEDGER,
    Present: (present) =>
      `${headroomText(items, now)}; ${spendersText(present.spenders, present.summaryAsOf, items, now)}`,
  });

/**
 * Reduce this host's GitHub budget ledger to the github-headroom parcel.
 *
 * **Details**
 *
 * A `Missing` ledger is `Unknown{no-source}` with the summary
 * `github headroom unknown: no ledger on this host`. Otherwise the envelope's
 * freshness is the oldest reading among the buckets the summary shows (the
 * fresh `core`, `graphql` and `search` ones) against the 15-minute bound, so
 * an identity seen once and never again does not keep the parcel stale; with
 * no bucket shown, every bucket's reading decides. The
 * summary lists the fresh `core`, `graphql` and `search` buckets per
 * identity, such as
 * `user:octocat core 3120/5000 ↺21:31Z · graphql 412/5000 BELOW 15% ↺21:40Z · search 30/30`,
 * then the stale identities. With no fresh bucket it says how old the newest
 * reading is instead, so a stale ledger never reads as headroom. The top three
 * spenders of the last hour and the unattributed remainder follow, or
 * `spenders unknown` when the ledger summary is absent or older than the
 * bound. At most `budget` items are kept, with an N-of-M receipt.
 *
 * **Example** (Reduce a missing ledger)
 *
 * ```ts
 * import { reduceGithubHeadroom } from "@beep/palantiri/GithubHeadroom"
 * import { GithubHeadroomInput } from "@beep/palantiri/GithubHeadroom.models"
 * import * as DateTime from "effect/DateTime"
 *
 * const now = DateTime.makeUnsafe("2026-11-10T21:00:00Z")
 * const parcel = reduceGithubHeadroom(GithubHeadroomInput.cases.Missing.make({ detail: "no ledger directory" }), now, 20)
 * console.log(parcel.freshness._tag) // "Unknown"
 * console.log(parcel.summary) // "github headroom unknown: no ledger on this host"
 * ```
 *
 * @param input - The host's ledger view, or its absence.
 * @param now - The read time.
 * @param budget - The most items to keep.
 * @returns The parcel envelope.
 * @category mapping
 * @since 0.0.0
 */
export const reduceGithubHeadroom: {
  (now: DateTime.Utc, budget: ParcelBudget): (input: GithubHeadroomInput) => ParcelEnvelope;
  (input: GithubHeadroomInput, now: DateTime.Utc, budget: ParcelBudget): ParcelEnvelope;
} = dual(3, (input: GithubHeadroomInput, now: DateTime.Utc, budget: ParcelBudget): ParcelEnvelope => {
  const items = githubHeadroomItems(input, now);
  return makeParcelEnvelope(
    ParcelDraft.make({
      spec: GithubHeadroomSpec,
      readAt: now,
      freshness: envelopeFreshness(input, items, now),
      summary: summarize(input, items, now),
      items,
      budget,
    })
  );
});
