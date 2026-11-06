/**
 * The account-headroom parcel: its spec and the pure reducer from an accounts
 * report to anonymized per-account headroom.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import { AccountHeadroom, AccountsReportOutcome, HeadroomWindow } from "./AccountHeadroom.models.ts";
import { checkFreshness, Freshness, isFreshItem, unknownSplit } from "./Freshness.ts";
import { ParcelSpec } from "./Parcel.models.ts";
import { makeParcelEnvelope, ParcelDraft } from "./ParcelEnvelope.models.ts";
import type * as DateTime from "effect/DateTime";
import type {
  AccountHeadroomInput,
  AccountsReportInput,
  AccountsReportRow,
  AccountsReportWindow,
} from "./AccountHeadroom.models.ts";
import type { Freshness as FreshnessType } from "./Freshness.ts";
import type { ParcelBudget } from "./Parcel.models.ts";
import type { ParcelEnvelope } from "./ParcelEnvelope.models.ts";

/**
 * Spec of the account-headroom parcel: keyed by account, fresh for 5 minutes.
 *
 * **Example** (Read the freshness bound)
 *
 * ```ts
 * import { AccountHeadroomSpec } from "@beep/palantiri/AccountHeadroom"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMinutes(AccountHeadroomSpec.freshnessBound)) // 5
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AccountHeadroomSpec = ParcelSpec.make({
  id: "account-headroom",
  key: "account",
  freshnessBound: Duration.minutes(5),
  sources: ["accounts-poll", "accounts-retained"],
});

const byLabel: Order.Order<AccountsReportRow> = Order.mapInput(Order.String, (row) => row.usage.account.label);

const toWindow = (window: AccountsReportWindow): HeadroomWindow =>
  HeadroomWindow.make({
    kind: window.kind,
    scope: window.scope,
    remainingPercent: Num.clamp(100 - window.usedPercent, { minimum: 0, maximum: 100 }),
    resetsAt: window.resetsAt,
  });

const unreachable = (detail: string): FreshnessType =>
  Freshness.cases.Unknown.make({ reason: "unreachable", asOf: O.none(), detail: O.some(detail) });

const toItem =
  (now: DateTime.Utc, generatedAt: DateTime.Utc, provider: string) =>
  (row: AccountsReportRow, index: number): AccountHeadroom =>
    AccountsReportOutcome.match(row.usage.outcome, {
      Ok: (ok) => {
        const asOf = O.getOrElse(ok.asOf, () => generatedAt);
        return AccountHeadroom.make({
          provider,
          account: index + 1,
          state: "ok",
          windows: A.map(ok.windows, toWindow),
          asOf: O.some(asOf),
          freshness: checkFreshness(now, AccountHeadroomSpec.freshnessBound, [asOf]),
          sources: [O.isSome(ok.asOf) ? "accounts-retained" : "accounts-poll"],
        });
      },
      NeedsLogin: () =>
        AccountHeadroom.make({
          provider,
          account: index + 1,
          state: "needs-login",
          windows: [],
          asOf: O.none(),
          freshness: unreachable("needs login"),
          sources: ["accounts-poll"],
        }),
      Failed: () =>
        AccountHeadroom.make({
          provider,
          account: index + 1,
          state: "failed",
          windows: [],
          asOf: O.none(),
          freshness: unreachable("poll failed"),
          sources: ["accounts-poll"],
        }),
    });

/**
 * Every account of a report as an anonymized headroom item with its own
 * freshness, ordered by provider then ordinal.
 *
 * **Details**
 *
 * Each provider's accounts are numbered from 1 in label order. The label is
 * read only for that ordering. A live reading's `asOf` is the report's
 * `generatedAt`; a retained reading keeps its own. An item is `Fresh` when
 * its reading is within the 5-minute bound of `now`, `Unknown{stale}` when
 * older, and `Unknown{unreachable}` when its poll failed or needs a login.
 *
 * **Example** (No accounts, no items)
 *
 * ```ts
 * import { accountHeadroomItems } from "@beep/palantiri/AccountHeadroom"
 * import { AccountsReportInput } from "@beep/palantiri/AccountHeadroom.models"
 * import * as DateTime from "effect/DateTime"
 *
 * const now = DateTime.makeUnsafe("2026-10-14T12:00:00Z")
 * const report = AccountsReportInput.make({ schemaVersion: "accounts-status/v2", generatedAt: now, groups: [] })
 * console.log(accountHeadroomItems(report, now).length) // 0
 * ```
 *
 * @param report - The decoded accounts report.
 * @param now - The read time each item's freshness is checked against.
 * @returns One item per account.
 * @category mapping
 * @since 0.0.0
 */
export const accountHeadroomItems: {
  (now: DateTime.Utc): (report: AccountsReportInput) => ReadonlyArray<AccountHeadroom>;
  (report: AccountsReportInput, now: DateTime.Utc): ReadonlyArray<AccountHeadroom>;
} = dual(
  2,
  (report: AccountsReportInput, now: DateTime.Utc): ReadonlyArray<AccountHeadroom> =>
    A.flatMap(
      A.sort(
        R.toEntries(
          A.groupBy(
            A.flatMap(report.groups, (group) => group.rows),
            (row) => row.usage.account.provider
          )
        ),
        Order.mapInput(Order.String, ([provider]: readonly [string, unknown]) => provider)
      ),
      ([provider, rows]) => A.map(A.sort(rows, byLabel), toItem(now, report.generatedAt, provider))
    )
);

const isAccountWide = (window: HeadroomWindow): boolean => window.kind === "weekly" || window.kind === "cycle";

/**
 * The items whose own freshness is `Fresh`.
 *
 * **Example** (No items, none fresh)
 *
 * ```ts
 * import { freshAccountHeadroom } from "@beep/palantiri/AccountHeadroom"
 *
 * console.log(freshAccountHeadroom([]).length) // 0
 * ```
 *
 * @param items - Headroom items, each carrying its own freshness.
 * @returns The fresh ones, in order.
 * @category filtering
 * @since 0.0.0
 */
export const freshAccountHeadroom = (items: ReadonlyArray<AccountHeadroom>): ReadonlyArray<AccountHeadroom> =>
  A.filter(items, isFreshItem);

const bestAccountWide = (items: ReadonlyArray<AccountHeadroom>): O.Option<string> =>
  O.map(
    A.match(
      A.flatMap(freshAccountHeadroom(items), (item) =>
        A.map(A.filter(item.windows, isAccountWide), (window) => ({ item, remaining: window.remainingPercent }))
      ),
      {
        onEmpty: O.none,
        onNonEmpty: (candidates) =>
          O.some(
            A.max(
              candidates,
              Order.mapInput(Num.Order, (candidate: { readonly remaining: number }) => candidate.remaining)
            )
          ),
      }
    ),
    ({ item, remaining }) => `; most weekly headroom: ${item.provider} #${item.account} at ${Num.round(remaining, 0)}%`
  );

const summarize = (items: ReadonlyArray<AccountHeadroom>, missing: O.Option<ReadonlyArray<string>>): string => {
  const parts = A.appendAll(
    unknownSplit(items, (item) => item.provider),
    missing.pipe(attributionGap, A.fromOption)
  );
  const split = A.match(parts, { onEmpty: () => "", onNonEmpty: (some) => `; ${A.join(some, ", ")}` });
  return `${freshAccountHeadroom(items).length} of ${items.length} accounts fresh${split}${O.getOrElse(bestAccountWide(items), () => "")}`;
};

// `None` when the host's provider listing failed: attribution is unknown, not
// complete.
const missingProviders = (
  input: AccountHeadroomInput,
  items: ReadonlyArray<AccountHeadroom>
): O.Option<ReadonlyArray<string>> => {
  const served = HashSet.fromIterable(A.map(items, (item) => item.provider));
  return O.map(input.expectedProviders, (expected) =>
    A.sort(A.dedupe(A.filter(expected, (provider) => !HashSet.has(served, provider))), Order.String)
  );
};

const attributionGap = (missing: O.Option<ReadonlyArray<string>>): O.Option<string> =>
  O.match(missing, {
    onNone: () => O.some("provider listing unavailable"),
    onSome: A.match({ onEmpty: O.none, onNonEmpty: (some) => O.some(`no reading from ${A.join(some, ", ")}`) }),
  });

const envelopeFreshness = (
  input: AccountHeadroomInput,
  now: DateTime.Utc,
  missing: O.Option<ReadonlyArray<string>>
): FreshnessType => {
  const read = checkFreshness(now, AccountHeadroomSpec.freshnessBound, [input.report.generatedAt]);
  return read._tag === "Fresh"
    ? O.match(attributionGap(missing), {
        onNone: () => read,
        onSome: (detail) =>
          Freshness.cases.Unknown.make({
            reason: "attribution-incomplete",
            asOf: O.some(read.asOf),
            detail: O.some(detail),
          }),
      })
    : read;
};

/**
 * Reduce an accounts report to the account-headroom parcel.
 *
 * **Details**
 *
 * Freshness has two levels. Each item carries its own (see
 * {@link accountHeadroomItems}). The envelope's describes the read itself:
 * `Fresh` when the poll or snapshot it served from is within 5 minutes,
 * `Unknown{stale}` when that report is older (a cached reading served without
 * a refresh, or after a failed live poll), and `Unknown{attribution-incomplete}` when an
 * expected provider produced no item or the provider listing itself failed.
 * The summary leads with the split, such
 * as `11 of 13 accounts fresh; 1 stale (grok-bot), 1 unreachable (codex)`.
 * At most `budget` items are kept, with an N-of-M receipt.
 *
 * **Example** (Reduce an empty report)
 *
 * ```ts
 * import { reduceAccountHeadroom } from "@beep/palantiri/AccountHeadroom"
 * import { AccountHeadroomInput, AccountsReportInput } from "@beep/palantiri/AccountHeadroom.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const now = DateTime.makeUnsafe("2026-10-14T12:00:00Z")
 * const report = AccountsReportInput.make({ schemaVersion: "accounts-status/v2", generatedAt: now, groups: [] })
 * const parcel = reduceAccountHeadroom(AccountHeadroomInput.make({ report, expectedProviders: O.some([]) }), now, 20)
 * console.log(parcel.freshness._tag) // "Fresh"
 * console.log(parcel.summary) // "0 of 0 accounts fresh"
 * ```
 *
 * @param input - The decoded accounts report and the expected providers.
 * @param now - The read time.
 * @param budget - The most items to keep.
 * @returns The parcel envelope.
 * @category mapping
 * @since 0.0.0
 */
export const reduceAccountHeadroom: {
  (now: DateTime.Utc, budget: ParcelBudget): (input: AccountHeadroomInput) => ParcelEnvelope;
  (input: AccountHeadroomInput, now: DateTime.Utc, budget: ParcelBudget): ParcelEnvelope;
} = dual(3, (input: AccountHeadroomInput, now: DateTime.Utc, budget: ParcelBudget): ParcelEnvelope => {
  const items = accountHeadroomItems(input.report, now);
  const missing = missingProviders(input, items);
  return makeParcelEnvelope(
    ParcelDraft.make({
      spec: AccountHeadroomSpec,
      readAt: now,
      freshness: envelopeFreshness(input, now, missing),
      summary: summarize(items, missing),
      items,
      budget,
    })
  );
});
