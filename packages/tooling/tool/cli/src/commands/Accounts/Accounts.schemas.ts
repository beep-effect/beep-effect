/**
 * Subscription accounts and their plan-limit usage: which login has quota
 * left, and which one to spend first.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Accounts/Accounts.schemas");

/**
 * The subscription provider an account belongs to.
 *
 * **Example** (Narrow a provider)
 *
 * ```ts
 * import { AccountProvider } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(AccountProvider.is.claude("claude")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccountProvider = LiteralKit(["claude", "codex"]).pipe(
  $I.annoteSchema("AccountProvider", { description: "Subscription provider whose plan limits are polled." })
);

/**
 * Subscription provider whose plan limits are polled.
 *
 * @category models
 * @since 0.0.0
 */
export type AccountProvider = typeof AccountProvider.Type;

/**
 * The operator's name for one account: a directory-safe label such as an
 * email address.
 *
 * **Example** (Guard a label)
 *
 * ```ts
 * import { AccountLabel } from "@beep/repo-cli/test/Accounts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AccountLabel)("me@example.com")) // true
 * console.log(S.is(AccountLabel)("../escape")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccountLabel = S.String.check(
  S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._@+-]{0,127}$/, {
    identifier: "AccountLabel",
    title: "Account label",
    description: "Starts with a letter or digit, then letters, digits, or . _ @ + - (no path separators).",
    message: "an account label uses letters, digits, and . _ @ + - only",
  })
).pipe($I.annoteSchema("AccountLabel", { description: "Directory-safe operator name for one account." }));

/**
 * Directory-safe operator name for one account.
 *
 * @category models
 * @since 0.0.0
 */
export type AccountLabel = typeof AccountLabel.Type;

/**
 * One account: its provider, label, and the stored-login file its usage is
 * read with. The file belongs to the local proxy, which keeps it refreshed;
 * the poller only reads it.
 *
 * **Example** (Make an account)
 *
 * ```ts
 * import { AccountRef } from "@beep/repo-cli/test/Accounts"
 *
 * const account = AccountRef.make({ provider: "claude", label: "me@example.com", source: "/auth/claude-me@example.com.json" })
 * console.log(account.provider) // "claude"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountRef extends S.Class<AccountRef>($I`AccountRef`)(
  { provider: AccountProvider, label: AccountLabel, source: S.String },
  $I.annote("AccountRef", { description: "An account and the stored-login file its usage is read with." })
) {}

/**
 * Which limit a usage window measures.
 *
 * **Example** (Narrow a kind)
 *
 * ```ts
 * import { UsageWindowKind } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(UsageWindowKind.is.weekly("weekly")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UsageWindowKind = LiteralKit(["session", "weekly", "weekly-scoped"]).pipe(
  $I.annoteSchema("UsageWindowKind", {
    description: "Short session limit, account-wide weekly limit, or a weekly limit scoped to one model.",
  })
);

/**
 * Short session limit, account-wide weekly limit, or a weekly limit scoped to
 * one model.
 *
 * @category models
 * @since 0.0.0
 */
export type UsageWindowKind = typeof UsageWindowKind.Type;

/**
 * One plan-limit window as the provider reports it.
 *
 * **Details**
 *
 * `resetsAt` is absent while the window has not started: the provider starts
 * the clock on first use.
 *
 * **Example** (Make a window)
 *
 * ```ts
 * import { UsageWindow } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * const window = UsageWindow.make({ kind: "weekly", scope: O.none(), usedPercent: 84, resetsAt: O.none() })
 * console.log(window.usedPercent) // 84
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsageWindow extends S.Class<UsageWindow>($I`UsageWindow`)(
  {
    kind: UsageWindowKind,
    scope: S.OptionFromNullOr(S.String),
    usedPercent: S.Finite,
    resetsAt: S.OptionFromNullOr(S.DateTimeUtcFromString),
  },
  $I.annote("UsageWindow", { description: "One plan-limit window: how full it is and when it resets." })
) {}

/**
 * What one poll of one account produced.
 *
 * **Details**
 *
 * `Ok` carries the windows. `NeedsLogin` means the stored login is missing or
 * no longer refreshes, so the operator must sign that account in again.
 * `Failed` is any other read, network, or decode failure.
 *
 * **Example** (Match an outcome)
 *
 * ```ts
 * import { AccountUsageOutcome } from "@beep/repo-cli/test/Accounts"
 *
 * const outcome = AccountUsageOutcome.cases.NeedsLogin.make({ detail: "no stored login" })
 * console.log(outcome._tag) // "NeedsLogin"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccountUsageOutcome = S.TaggedUnion({
  Ok: {
    identity: S.OptionFromNullOr(S.String),
    plan: S.OptionFromNullOr(S.String),
    windows: S.Array(UsageWindow),
  },
  NeedsLogin: { detail: S.String },
  Failed: { detail: S.String },
}).pipe($I.annoteSchema("AccountUsageOutcome", { description: "Result of polling one account's plan limits." }));

/**
 * Result of polling one account's plan limits.
 *
 * @category models
 * @since 0.0.0
 */
export type AccountUsageOutcome = typeof AccountUsageOutcome.Type;

/**
 * One account and the outcome of polling it.
 *
 * **Example** (Make a usage row)
 *
 * ```ts
 * import { AccountRef, AccountUsage, AccountUsageOutcome } from "@beep/repo-cli/test/Accounts"
 *
 * const usage = AccountUsage.make({
 *   account: AccountRef.make({ provider: "codex", label: "work", source: "/auth/codex-work.json" }),
 *   outcome: AccountUsageOutcome.cases.Failed.make({ detail: "offline" }),
 * })
 * console.log(usage.outcome._tag) // "Failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountUsage extends S.Class<AccountUsage>($I`AccountUsage`)(
  { account: AccountRef, outcome: AccountUsageOutcome },
  $I.annote("AccountUsage", { description: "One account and the outcome of polling its plan limits." })
) {}

/**
 * Whether an account can take work right now.
 *
 * **Example** (Narrow an availability)
 *
 * ```ts
 * import { AccountAvailability } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(AccountAvailability.is.ready("ready")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccountAvailability = LiteralKit(["ready", "session-capped", "weekly-exhausted", "unavailable"]).pipe(
  $I.annoteSchema("AccountAvailability", {
    description: "Ready for work, waiting on the session window, out of weekly quota, or not readable.",
  })
);

/**
 * Ready for work, waiting on the session window, out of weekly quota, or not
 * readable.
 *
 * @category models
 * @since 0.0.0
 */
export type AccountAvailability = typeof AccountAvailability.Type;

/**
 * One ranked row of the status report.
 *
 * **Details**
 *
 * `burnRate` is the weekly percent that must be spent per hour to finish the
 * week at 100%: `weeklyRemainingPercent / hoursUntilReset`. The account with
 * the highest rate is the one most at risk of wasting quota, so it ranks
 * first.
 *
 * **Example** (Read a ranking)
 *
 * ```ts
 * import { rankAccounts } from "@beep/repo-cli/test/Accounts"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(rankAccounts([], DateTime.makeUnsafe(0)).length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountRanking extends S.Class<AccountRanking>($I`AccountRanking`)(
  {
    usage: AccountUsage,
    availability: AccountAvailability,
    weeklyRemainingPercent: S.OptionFromNullOr(S.Finite),
    hoursUntilWeeklyReset: S.OptionFromNullOr(S.Finite),
    burnRate: S.OptionFromNullOr(S.Finite),
  },
  $I.annote("AccountRanking", { description: "An account's availability and how urgently its weekly quota needs use." })
) {}

/**
 * The `accounts status --json` document.
 *
 * **Example** (Encode a report)
 *
 * ```ts
 * import { AccountsStatusReportJson } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(typeof AccountsStatusReportJson.encode) // function
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountsStatusReport extends S.Class<AccountsStatusReport>($I`AccountsStatusReport`)(
  {
    schemaVersion: S.Literal("accounts-status/v1"),
    generatedAt: S.DateTimeUtcFromString,
    rows: S.Array(AccountRanking),
  },
  $I.annote("AccountsStatusReport", { description: "Every registered account, most urgent to use first." })
) {}

/**
 * JSON-string codec for {@link AccountsStatusReport}.
 *
 * **Example** (Decode a report)
 *
 * ```ts
 * import { AccountsStatusReportJson } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(AccountsStatusReportJson.decodeOption("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const AccountsStatusReportJson = JsonStringCodec(AccountsStatusReport);

const MILLIS_PER_HOUR = 3_600_000;
// A weekly window that has not started yet has no reset time: the provider
// starts a seven-day clock on first use, so that is the time left to spend it.
const UNSTARTED_WEEK_HOURS = 168;
// Below this the reset is effectively now; clamp so the rate stays finite.
const MIN_HOURS = 1 / 60;

const hoursUntil = (now: DateTime.Utc, at: DateTime.Utc): number =>
  Math.max((DateTime.toEpochMillis(at) - DateTime.toEpochMillis(now)) / MILLIS_PER_HOUR, MIN_HOURS);

const firstOfKind = (windows: ReadonlyArray<UsageWindow>, kind: UsageWindowKind): O.Option<UsageWindow> =>
  A.findFirst(windows, (window) => window.kind === kind);

const isFull = (window: UsageWindow): boolean => window.usedPercent >= 100;

const unavailable = (usage: AccountUsage): AccountRanking =>
  AccountRanking.make({
    usage,
    availability: "unavailable",
    weeklyRemainingPercent: O.none(),
    hoursUntilWeeklyReset: O.none(),
    burnRate: O.none(),
  });

const rankOk = (now: DateTime.Utc, usage: AccountUsage, windows: ReadonlyArray<UsageWindow>): AccountRanking => {
  const weekly = firstOfKind(windows, "weekly");
  const remaining = O.map(weekly, (window) => Math.max(100 - window.usedPercent, 0));
  const hours = O.map(weekly, (window) =>
    O.match(window.resetsAt, { onNone: () => UNSTARTED_WEEK_HOURS, onSome: (at) => hoursUntil(now, at) })
  );
  const sessionFull = O.exists(firstOfKind(windows, "session"), isFull);
  const availability: AccountAvailability = O.exists(weekly, isFull)
    ? "weekly-exhausted"
    : sessionFull
      ? "session-capped"
      : "ready";
  return AccountRanking.make({
    usage,
    availability,
    weeklyRemainingPercent: remaining,
    hoursUntilWeeklyReset: hours,
    burnRate: O.zipWith(remaining, hours, (left, time) => left / time),
  });
};

/**
 * Rank one polled account.
 *
 * **Example** (Rank an unreadable account)
 *
 * ```ts
 * import { AccountRef, AccountUsage, AccountUsageOutcome, rankAccount } from "@beep/repo-cli/test/Accounts"
 * import * as DateTime from "effect/DateTime"
 *
 * const usage = AccountUsage.make({
 *   account: AccountRef.make({ provider: "claude", label: "me", source: "/auth/claude-me.json" }),
 *   outcome: AccountUsageOutcome.cases.NeedsLogin.make({ detail: "no stored login" }),
 * })
 * console.log(rankAccount(usage, DateTime.makeUnsafe(0)).availability) // "unavailable"
 * ```
 *
 * @param usage - The polled account.
 * @param now - The instant reset distances are measured from.
 * @returns The account's availability and weekly urgency.
 * @category utilities
 * @since 0.0.0
 */
export const rankAccount: {
  (now: DateTime.Utc): (usage: AccountUsage) => AccountRanking;
  (usage: AccountUsage, now: DateTime.Utc): AccountRanking;
} = dual(
  2,
  (usage: AccountUsage, now: DateTime.Utc): AccountRanking =>
    AccountUsageOutcome.match(usage.outcome, {
      Ok: ({ windows }) => rankOk(now, usage, windows),
      NeedsLogin: () => unavailable(usage),
      Failed: () => unavailable(usage),
    })
);

const availabilityRank: Record<AccountAvailability, number> = {
  ready: 0,
  "session-capped": 1,
  "weekly-exhausted": 2,
  unavailable: 3,
};

// Ready accounts first, then the highest burn rate: the quota most at risk of
// expiring unused. Labels break ties so the order is stable between polls.
const mostUrgentFirst = Order.combineAll<AccountRanking>([
  Order.mapInput(Order.Number, (row) => availabilityRank[row.availability]),
  Order.mapInput(Order.Number, (row) => -O.getOrElse(row.burnRate, () => -1)),
  Order.mapInput(Order.String, (row) => `${row.usage.account.provider}/${row.usage.account.label}`),
]);

/**
 * Rank polled accounts: the one whose weekly quota most needs spending first.
 *
 * **Example** (Rank nothing)
 *
 * ```ts
 * import { rankAccounts } from "@beep/repo-cli/test/Accounts"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(rankAccounts([], DateTime.makeUnsafe(0))) // []
 * ```
 *
 * @param usages - Every polled account, in any order.
 * @param now - The instant reset distances are measured from.
 * @returns The accounts, most urgent to use first.
 * @category utilities
 * @since 0.0.0
 */
export const rankAccounts: {
  (now: DateTime.Utc): (usages: ReadonlyArray<AccountUsage>) => ReadonlyArray<AccountRanking>;
  (usages: ReadonlyArray<AccountUsage>, now: DateTime.Utc): ReadonlyArray<AccountRanking>;
} = dual(
  2,
  (usages: ReadonlyArray<AccountUsage>, now: DateTime.Utc): ReadonlyArray<AccountRanking> =>
    A.sort(A.map(usages, rankAccount(now)), mostUrgentFirst)
);
