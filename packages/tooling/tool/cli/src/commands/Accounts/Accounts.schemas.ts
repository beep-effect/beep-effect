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
export const AccountProvider = LiteralKit(["claude", "codex", "muse", "grok"]).pipe(
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
 * A provider name on a report row: one of the polled providers, or any name a
 * local snapshot file uses.
 *
 * **Example** (Guard a provider name)
 *
 * ```ts
 * import { AccountProviderName } from "@beep/repo-cli/test/Accounts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AccountProviderName)("cursor")) // true
 * console.log(S.is(AccountProviderName)("Not A Name")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccountProviderName = S.String.check(
  S.isPattern(/^[a-z][a-z0-9-]{0,31}$/, {
    identifier: "AccountProviderName",
    title: "Account provider name",
    description: "Lowercase letters, digits, and hyphens, starting with a letter.",
    message: "a provider name uses lowercase letters, digits, and hyphens",
  })
).pipe($I.annoteSchema("AccountProviderName", { description: "Provider name shown on a report row." }));

/**
 * Provider name shown on a report row.
 *
 * @category models
 * @since 0.0.0
 */
export type AccountProviderName = typeof AccountProviderName.Type;

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
 * One account: its provider, label, and the file its usage comes from. For a
 * polled provider that is the local proxy's stored login, which the proxy keeps
 * refreshed and the poller only reads; for a snapshot it is the snapshot file.
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
  { provider: AccountProviderName, label: AccountLabel, source: S.String },
  $I.annote("AccountRef", { description: "An account and the file its usage comes from." })
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
export const UsageWindowKind = LiteralKit(["session", "weekly", "weekly-scoped", "cycle", "cycle-scoped"]).pipe(
  $I.annoteSchema("UsageWindowKind", {
    description:
      "Short session limit; account-wide weekly or billing-cycle limit; or one of those scoped to a model group.",
  })
);

/**
 * Short session limit; account-wide weekly or billing-cycle limit; or one of
 * those scoped to a model group.
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
 * What a credit balance is counted in.
 *
 * **Example** (Narrow a unit)
 *
 * ```ts
 * import { CreditUnit } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(CreditUnit.is.usd("usd")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CreditUnit = LiteralKit(["usd", "credits"]).pipe(
  $I.annoteSchema("CreditUnit", { description: "Dollars, or the provider's own credit points." })
);

/**
 * Dollars, or the provider's own credit points.
 *
 * @category models
 * @since 0.0.0
 */
export type CreditUnit = typeof CreditUnit.Type;

/**
 * A credit balance that sits beside the plan limits, such as Claude's cloud
 * session credit or a ChatGPT credit balance.
 *
 * **Example** (Make a balance)
 *
 * ```ts
 * import { CreditBalance } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * const credit = CreditBalance.make({ label: "cloud session credits", unit: "usd", remaining: 246.5, limit: O.some(250), expiresAt: O.none() })
 * console.log(credit.remaining) // 246.5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreditBalance extends S.Class<CreditBalance>($I`CreditBalance`)(
  {
    label: S.String,
    unit: CreditUnit,
    remaining: S.Finite,
    limit: S.OptionFromNullOr(S.Finite),
    expiresAt: S.OptionFromNullOr(S.DateTimeUtcFromString),
  },
  $I.annote("CreditBalance", {
    description: "A credit balance beside the plan limits: what is left and when it expires.",
  })
) {}

/**
 * What one poll of one account produced.
 *
 * **Details**
 *
 * `Ok` carries the windows, any credit balances, and the number of unused
 * limit-reset grants when the provider reports one; `asOf` is set when the
 * numbers come from a snapshot file and absent for a live poll. `NeedsLogin` means the stored login is missing or
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
    credits: S.Array(CreditBalance),
    limitResets: S.OptionFromNullOr(S.Finite),
    asOf: S.OptionFromNullOr(S.DateTimeUtcFromString),
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
 * The report panel an account belongs to.
 *
 * **Details**
 *
 * Accounts are ranked against the others in their panel only: a Claude login
 * never competes with a Codex one. Grok Build, Cursor, and Grok Bot share the
 * SuperGrok Heavy panel because one subscription pays for all three, though
 * each keeps its own limit.
 *
 * **Example** (Narrow a section)
 *
 * ```ts
 * import { AccountSection } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(AccountSection.is.supergrok("supergrok")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccountSection = LiteralKit(["claude", "codex", "supergrok", "muse", "other"]).pipe(
  $I.annoteSchema("AccountSection", {
    description: "The provider panel an account is ranked in.",
  })
);

/**
 * The provider panel an account is ranked in.
 *
 * @category models
 * @since 0.0.0
 */
export type AccountSection = typeof AccountSection.Type;

const sectionOfProvider: Readonly<Record<string, AccountSection>> = {
  claude: "claude",
  codex: "codex",
  grok: "supergrok",
  cursor: "supergrok",
  "grok-bot": "supergrok",
  muse: "muse",
};

/**
 * The panel a provider's accounts are ranked in.
 *
 * **Example** (Place Cursor)
 *
 * ```ts
 * import { accountSection } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(accountSection("cursor")) // "supergrok"
 * console.log(accountSection("someone-else")) // "other"
 * ```
 *
 * @param provider - A provider name from a login or a snapshot.
 * @returns The panel for that provider.
 * @category utilities
 * @since 0.0.0
 */
export const accountSection = (provider: string): AccountSection => sectionOfProvider[provider] ?? "other";

/**
 * An account a provider's own CLI is signed in to on this machine.
 *
 * **Example** (Make a signed-in login)
 *
 * ```ts
 * import { SignedInLogin } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(SignedInLogin.make({ provider: "codex", label: "me@example.com" }).provider) // "codex"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SignedInLogin extends S.Class<SignedInLogin>($I`SignedInLogin`)(
  { provider: AccountProviderName, label: AccountLabel },
  $I.annote("SignedInLogin", { description: "The account a provider's CLI is signed in to." })
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
 * The `weekly*` fields describe the account-wide window, which is the billing
 * cycle for a provider that meters by cycle. `dataAgeHours` is set when the
 * reading is not from this poll: a snapshot file, or the last good reading of
 * an account whose poll just failed. `estimated` is set when a window of such
 * a reading has reset since it was taken, so its figures assume an unused
 * window. `signedIn` marks the account the provider's own CLI is signed in to.
 * `burnRate` is the percent that must be spent per hour to finish the
 * week at 100%: `weeklyRemainingPercent / hoursUntilReset`. Among ready
 * accounts, one whose week is already running down ranks before an untouched
 * one, whose quota cannot expire while it waits; then the highest rate ranks
 * first, as the quota most at risk of being wasted.
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
    dataAgeHours: S.OptionFromNullOr(S.Finite),
    estimated: S.Boolean,
    signedIn: S.Boolean,
  },
  $I.annote("AccountRanking", { description: "An account's availability and how urgently its weekly quota needs use." })
) {}

/**
 * A usage snapshot written by a local collector for a provider the poller
 * cannot read itself.
 *
 * **Details**
 *
 * The command shows every `*.json` snapshot in the accounts state directory as
 * a report row with its age. What writes the file is outside this package.
 *
 * **Example** (Decode a snapshot)
 *
 * ```ts
 * import { AccountSnapshotJson } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * const text = '{"schemaVersion":"accounts-snapshot/v1","provider":"cursor","label":"me","capturedAt":"2026-01-05T00:00:00.000Z","plan":null,"windows":[]}'
 * console.log(O.isSome(AccountSnapshotJson.decodeOption(text))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountSnapshot extends S.Class<AccountSnapshot>($I`AccountSnapshot`)(
  {
    schemaVersion: S.Literal("accounts-snapshot/v1"),
    provider: AccountProviderName,
    label: AccountLabel,
    capturedAt: S.DateTimeUtcFromString,
    plan: S.OptionFromNullOr(S.String),
    windows: S.Array(UsageWindow),
  },
  $I.annote("AccountSnapshot", { description: "Usage windows a local collector captured for one account." })
) {}

/**
 * JSON-string codec for {@link AccountSnapshot}.
 *
 * **Example** (Reject malformed text)
 *
 * ```ts
 * import { AccountSnapshotJson } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(AccountSnapshotJson.decodeOption("not-json"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const AccountSnapshotJson = JsonStringCodec(AccountSnapshot);

/**
 * One provider's panel of the report: its accounts, most urgent to use first.
 *
 * **Example** (Make an empty panel)
 *
 * ```ts
 * import { AccountGroup } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(AccountGroup.make({ section: "claude", rows: [] }).section) // "claude"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountGroup extends S.Class<AccountGroup>($I`AccountGroup`)(
  { section: AccountSection, rows: S.Array(AccountRanking) },
  $I.annote("AccountGroup", { description: "One provider's accounts, most urgent to use first." })
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
    schemaVersion: S.Literal("accounts-status/v2"),
    generatedAt: S.DateTimeUtcFromString,
    groups: S.Array(AccountGroup),
  },
  $I.annote("AccountsStatusReport", {
    description: "Every registered account, one panel per provider, each ranked most urgent first.",
  })
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
    dataAgeHours: O.none(),
    estimated: false,
    signedIn: false,
  });

const hasResetBy =
  (now: DateTime.Utc) =>
  (window: UsageWindow): boolean =>
    O.exists(window.resetsAt, (at) => DateTime.toEpochMillis(at) <= DateTime.toEpochMillis(now));

// A window that reset after an older reading was taken starts over: its old
// figure is gone and its next reset is unknown until the account is read again.
const restarted = (window: UsageWindow): UsageWindow =>
  UsageWindow.make({ kind: window.kind, scope: window.scope, usedPercent: 0, resetsAt: O.none() });

type OkOutcome = (typeof AccountUsageOutcome.cases.Ok)["Type"];

const rankOk = (now: DateTime.Utc, usage: AccountUsage, ok: OkOutcome): AccountRanking => {
  const lapsed = hasResetBy(now);
  const estimated = O.isSome(ok.asOf) && A.some(ok.windows, lapsed);
  if (!estimated) return rankWindows(now, usage, ok.windows, ok.asOf, false);
  // The row carries the restarted windows so every figure shown agrees.
  const windows = A.map(ok.windows, (window) => (lapsed(window) ? restarted(window) : window));
  const current = AccountUsage.make({
    account: usage.account,
    outcome: AccountUsageOutcome.cases.Ok.make({ ...ok, windows }),
  });
  return rankWindows(now, current, windows, ok.asOf, true);
};

const rankWindows = (
  now: DateTime.Utc,
  usage: AccountUsage,
  windows: ReadonlyArray<UsageWindow>,
  asOf: O.Option<DateTime.Utc>,
  estimated: boolean
): AccountRanking => {
  // The account-wide window that decides urgency: weekly, or the billing cycle
  // for a provider that meters by cycle.
  const weekly = O.orElse(firstOfKind(windows, "weekly"), () => firstOfKind(windows, "cycle"));
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
    dataAgeHours: O.map(asOf, (at) =>
      Math.max((DateTime.toEpochMillis(now) - DateTime.toEpochMillis(at)) / MILLIS_PER_HOUR, 0)
    ),
    estimated,
    signedIn: false,
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
      Ok: (ok) => rankOk(now, usage, ok),
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

// An untouched window has not started its clock, or restarts it on first use:
// none of its quota can expire while it waits, so it ranks after every window
// that is already running down.
const isUntouched = (row: AccountRanking): boolean => O.exists(row.weeklyRemainingPercent, (left) => left >= 100);

// Ready accounts first; among them, windows already running down before
// untouched ones; then the highest burn rate: the quota most at risk of
// expiring unused. Labels break ties so the order is stable between polls.
const mostUrgentFirst = Order.combineAll<AccountRanking>([
  Order.mapInput(Order.Number, (row) => availabilityRank[row.availability]),
  Order.mapInput(Order.Number, (row) => (isUntouched(row) ? 1 : 0)),
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

const sectionOrder: ReadonlyArray<AccountSection> = ["claude", "codex", "supergrok", "muse", "other"];

const isSignedIn =
  (signedIn: ReadonlyArray<SignedInLogin>) =>
  (row: AccountRanking): boolean =>
    A.some(
      signedIn,
      (login) => login.provider === row.usage.account.provider && login.label === row.usage.account.label
    );

/**
 * Split ranked accounts into provider panels and mark the signed-in ones.
 *
 * **Details**
 *
 * Panels come in a fixed order (Claude, Codex, SuperGrok Heavy, Muse, then
 * anything else) and keep the input order inside each panel, so pass rows from
 * {@link rankAccounts}. A panel with no accounts is left out.
 *
 * **Example** (Group nothing)
 *
 * ```ts
 * import { groupAccounts } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(groupAccounts([], [])) // []
 * ```
 *
 * @param rows - Ranked accounts, most urgent first.
 * @param signedIn - The accounts the providers' CLIs are signed in to.
 * @returns One panel per provider that has accounts.
 * @category utilities
 * @since 0.0.0
 */
export const groupAccounts: {
  (signedIn: ReadonlyArray<SignedInLogin>): (rows: ReadonlyArray<AccountRanking>) => ReadonlyArray<AccountGroup>;
  (rows: ReadonlyArray<AccountRanking>, signedIn: ReadonlyArray<SignedInLogin>): ReadonlyArray<AccountGroup>;
} = dual(
  2,
  (rows: ReadonlyArray<AccountRanking>, signedIn: ReadonlyArray<SignedInLogin>): ReadonlyArray<AccountGroup> => {
    const marked = A.map(rows, (row) =>
      isSignedIn(signedIn)(row) ? AccountRanking.make({ ...row, signedIn: true }) : row
    );
    return A.filter(
      A.map(sectionOrder, (section) =>
        AccountGroup.make({
          section,
          rows: A.filter(marked, (row) => accountSection(row.usage.account.provider) === section),
        })
      ),
      (group) => A.isReadonlyArrayNonEmpty(group.rows)
    );
  }
);
