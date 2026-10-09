/**
 * `beep accounts`: which subscription account to use next.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import { Command, Flag } from "effect/cli";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { AccountsError } from "./Accounts.errors.ts";
import {
  AccountsStatusReport,
  AccountsStatusReportJson,
  AccountUsageOutcome,
  rankAccounts,
} from "./Accounts.schemas.ts";
import { AccountsSecretsLayout, AccountsSecretsLayoutLive } from "./AccountsSecretsLayout.service.ts";
import { layerAccountsUsageLive, pollAccounts } from "./AccountsUsage.service.ts";
import type { AccountRanking, CreditBalance, UsageWindow } from "./Accounts.schemas.ts";

const reportFailure = <A, R>(effect: Effect.Effect<A, AccountsError, R>) =>
  effect.pipe(Effect.catchTag("AccountsError", (error) => failWithReportedExit(`[accounts] ${error.message}`)));

/**
 * Render a span of hours as the operator reads it: days and hours, or hours
 * and minutes under a day.
 *
 * **Example** (Render spans)
 *
 * ```ts
 * import { renderHours } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(renderHours(136.5)) // "5d 16h"
 * console.log(renderHours(3.25)) // "3h 15m"
 * ```
 *
 * @param hours - A non-negative span in hours.
 * @returns The span in its two largest units.
 * @category formatting
 * @since 0.0.0
 */
export const renderHours = (hours: number): string => {
  const minutes = Math.max(Math.round(hours * 60), 0);
  const days = Math.floor(minutes / 1440);
  const restHours = Math.floor((minutes % 1440) / 60);
  return days > 0 ? `${days}d ${restHours}h` : `${restHours}h ${minutes % 60}m`;
};

const percent = (value: number): string => `${Math.round(value)}%`;

const isScoped = (window: UsageWindow): boolean => window.kind === "weekly-scoped" || window.kind === "cycle-scoped";

const isAccountWide = (window: UsageWindow): boolean => window.kind === "weekly" || window.kind === "cycle";

const windowLabel = (window: UsageWindow): string =>
  isScoped(window) ? O.getOrElse(window.scope, () => "scoped") : window.kind;

const otherWindows = (windows: ReadonlyArray<UsageWindow>): ReadonlyArray<string> =>
  A.map(
    // The first account-wide window is already in the summary.
    A.filter(windows, (window) => !O.contains(A.findFirst(windows, isAccountWide), window)),
    (window) => `${windowLabel(window)} ${percent(window.usedPercent)}`
  );

const amount = (unit: CreditBalance["unit"], value: number): string =>
  unit === "usd" ? `$${Math.round(value)}` : `${Math.round(value)}`;

const renderCredit = (credit: CreditBalance): string =>
  A.join(
    [
      `${credit.label} ${amount(credit.unit, credit.remaining)}`,
      ...O.toArray(O.map(credit.limit, (limit) => `of ${amount(credit.unit, limit)}`)),
      "left",
      ...O.toArray(O.map(credit.expiresAt, (at) => `until ${at.pipe(DateTime.formatIso, Str.slice(0, 10))}`)),
    ],
    " "
  );

const weeklySummary = (row: AccountRanking, windows: ReadonlyArray<UsageWindow>): O.Option<string> =>
  O.zipWith(
    row.weeklyRemainingPercent,
    row.hoursUntilWeeklyReset,
    (left, hours) =>
      `${O.match(A.findFirst(windows, isAccountWide), { onNone: () => "weekly", onSome: windowLabel })} ${percent(left)} left, resets in ${renderHours(hours)}`
  );

/**
 * Render one ranked account as a report line.
 *
 * **Example** (Render an account that needs a login)
 *
 * ```ts
 * import { AccountRef, AccountUsage, AccountUsageOutcome, rankAccount, renderAccountRanking } from "@beep/repo-cli/test/Accounts"
 * import * as DateTime from "effect/DateTime"
 *
 * const usage = AccountUsage.make({
 *   account: AccountRef.make({ provider: "claude", label: "me", source: "/auth/claude-me.json" }),
 *   outcome: AccountUsageOutcome.cases.NeedsLogin.make({ detail: "no stored login" }),
 * })
 * console.log(renderAccountRanking(rankAccount(usage, DateTime.makeUnsafe(0))))
 * // "claude me: needs login (no stored login)"
 * ```
 *
 * @param row - A ranked account.
 * @returns One line: the account, its availability, and its windows.
 * @category formatting
 * @since 0.0.0
 */
export const renderAccountRanking = (row: AccountRanking): string => {
  const name = `${row.usage.account.provider} ${row.usage.account.label}`;
  return AccountUsageOutcome.match(row.usage.outcome, {
    NeedsLogin: ({ detail }) => `${name}: needs login (${detail})`,
    Failed: ({ detail }) => `${name}: unreadable (${detail})`,
    Ok: ({ plan, windows, credits, limitResets }) =>
      A.join(
        [
          `${name}: ${row.availability}`,
          ...O.toArray(weeklySummary(row, windows)),
          ...otherWindows(windows),
          ...A.map(credits, renderCredit),
          ...O.toArray(
            O.map(
              O.filter(limitResets, (count) => count > 0),
              (count) => `${count} limit reset(s) unused`
            )
          ),
          ...O.toArray(O.map(plan, (value) => `plan ${value}`)),
          ...O.toArray(O.map(row.snapshotAgeHours, (hours) => `snapshot ${renderHours(hours)} old`)),
        ],
        " · "
      ),
  });
};

/**
 * Render the ranked report: the account to use first, then every account.
 *
 * **Example** (Render an empty report)
 *
 * ```ts
 * import { renderAccountsStatus } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(renderAccountsStatus([])) // "[accounts] the proxy holds no supported login"
 * ```
 *
 * @param rows - Ranked accounts, most urgent first.
 * @returns The report text.
 * @category formatting
 * @since 0.0.0
 */
export const renderAccountsStatus = (rows: ReadonlyArray<AccountRanking>): string => {
  if (!A.isReadonlyArrayNonEmpty(rows)) return "[accounts] the proxy holds no supported login";
  const first = A.headNonEmpty(rows);
  const headline =
    first.availability === "ready"
      ? `[accounts] use first: ${first.usage.account.provider} ${first.usage.account.label}`
      : "[accounts] no account is ready right now";
  return A.join([headline, ...A.map(rows, (row, index) => `  ${index + 1}. ${renderAccountRanking(row)}`)], "\n");
};

const jsonFlag = Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Emit the report as JSON"));

/**
 * `beep accounts status`: poll every account and rank them.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { accountsStatusCommand } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(accountsStatusCommand.name) // "status"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const accountsStatusCommand = Command.make(
  "status",
  { json: jsonFlag },
  Effect.fn(function* ({ json }) {
    const program = Effect.gen(function* () {
      const usages = yield* pollAccounts;
      const now = yield* DateTime.now;
      const rows = rankAccounts(usages, now);
      if (!json) {
        yield* Console.log(renderAccountsStatus(rows));
        return;
      }
      const report = AccountsStatusReport.make({ schemaVersion: "accounts-status/v1", generatedAt: now, rows });
      // One document on the console, like the other `--json` surfaces that
      // automation decodes as a whole.
      yield* Console.log(
        yield* AccountsStatusReportJson.encode(report).pipe(
          Effect.mapError((cause) =>
            AccountsError.make({ reason: "decode", message: "Failed to encode the accounts report.", cause })
          )
        )
      );
    });
    yield* reportFailure(program);
  })
).pipe(
  Command.withDescription("Poll each account's plan limits and rank them by how urgently the weekly quota needs use"),
  Command.provide(layerAccountsUsageLive)
);

const secretsLayoutCommand = Command.make(
  "secrets-layout",
  { apply: Flag.Boolean("apply").pipe(Flag.withDefault(false)) },
  Effect.fn("Accounts.secretsLayout")(function* ({ apply }) {
    const service = yield* AccountsSecretsLayout;
    for (const line of yield* service.run(apply)) yield* Console.log(line);
  })
).pipe(
  Command.withDescription("Preview vault sections; --apply requires the operator's op-human route"),
  Command.provide(AccountsSecretsLayoutLive)
);

/**
 * `beep accounts`: the account usage command family.
 *
 * **Example** (Read the family name)
 *
 * ```ts
 * import { accountsCommand } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(accountsCommand.name) // "accounts"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const accountsCommand = Command.make("accounts", {}, () =>
  Console.log(A.join(["Accounts commands:", "- bun run beep accounts status [--json]"], "\n"))
).pipe(
  Command.withDescription("Show which Claude, Codex, Muse, or Grok subscription account to use next"),
  Command.withSubcommands([accountsStatusCommand, secretsLayoutCommand])
);
