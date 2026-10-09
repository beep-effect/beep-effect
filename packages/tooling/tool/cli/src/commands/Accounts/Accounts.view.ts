/**
 * The accounts board: one panel per provider, each account on one line with
 * its quota bar, and a dimmed line of detail under it.
 *
 * **Details**
 *
 * Every function here is pure: it turns a report into text. The live screen
 * (`accounts` with no subcommand) and the one-shot `accounts status` print the
 * same board.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import defaultChalk, { Chalk } from "@beep/chalk";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AccountAvailability, AccountUsageOutcome } from "./Accounts.schemas.ts";
import type {
  AccountGroup,
  AccountRanking,
  AccountSection,
  AccountsStatusReport,
  CreditBalance,
  UsageWindow,
} from "./Accounts.schemas.ts";

const $I = $RepoCliId.create("commands/Accounts/Accounts.view");

/**
 * How to draw the board: its width in columns, whether to color it, and the
 * status text shown next to the title.
 *
 * **Example** (Lay out a plain board)
 *
 * ```ts
 * import { AccountsBoardLayout } from "@beep/repo-cli/test/Accounts"
 *
 * const layout = AccountsBoardLayout.make({ width: 100, color: false, status: "updated 14:02" })
 * console.log(layout.width) // 100
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountsBoardLayout extends S.Class<AccountsBoardLayout>($I`AccountsBoardLayout`)(
  { width: S.Int, color: S.Boolean, status: S.String },
  $I.annote("AccountsBoardLayout", { description: "Width, coloring, and title status of the accounts board." })
) {}

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
 * console.log(renderHours(0.5)) // "30m"
 * ```
 *
 * @param hours - A non-negative span in hours.
 * @returns The span in its two largest units, or minutes alone under an hour.
 * @category formatting
 * @since 0.0.0
 */
export const renderHours = (hours: number): string => {
  const minutes = Math.max(Math.round(hours * 60), 0);
  const days = Math.floor(minutes / 1440);
  const restHours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${restHours}h`;
  return restHours > 0 ? `${restHours}h ${minutes % 60}m` : `${minutes}m`;
};

const MIN_WIDTH = 64;
const MAX_WIDTH = 120;
const STATUS_WIDTH = 12;
const PERCENT_WIDTH = 9;
const RESET_WIDTH = 7;
const MAX_LABEL_WIDTH = 30;
const MIN_BAR_WIDTH = 4;
// A reading older than this is worth a second look before switching to it.
const STALE_HOURS = 6;
const MILLIS_PER_HOUR = 3_600_000;

const sectionTitle: Readonly<Record<AccountSection, string>> = {
  claude: "Claude",
  codex: "Codex",
  supergrok: "SuperGrok Heavy",
  muse: "Muse",
  other: "Other",
};

const productName: Readonly<Record<string, string>> = {
  grok: "Grok Build",
  cursor: "Cursor",
  "grok-bot": "Grok Bot",
};

// In these panels the accounts are alternatives to each other, so the order
// is advice. The SuperGrok panel lists three tools on one subscription, and
// Muse has one login: nothing there to choose between.
const isRanked = (section: AccountSection): boolean =>
  section === "claude" || section === "codex" || section === "other";

const makePalette = (color: boolean) => {
  const ink = color ? defaultChalk : new Chalk({ level: 0 });
  return {
    color,
    title: ink.bold.hex("#e8f0ea"),
    border: ink.hex("#4b5a51"),
    accent: ink.bold.hex("#5eea8a"),
    good: ink.hex("#5eea8a"),
    warn: ink.hex("#f5c84b"),
    bad: ink.hex("#f2777a"),
    dim: ink.hex("#8c9a92"),
    faint: ink.hex("#3a443e"),
  };
};

type Palette = ReturnType<typeof makePalette>;

// Fit plain text into a column: cut with an ellipsis, or pad with spaces.
const fit = (text: string, width: number): string =>
  Str.length(text) > width ? `${text.slice(0, Math.max(width - 1, 0))}…` : pipe(text, Str.padEnd(width));

const fitRight = (text: string, width: number): string =>
  Str.length(text) > width ? text.slice(0, width) : pipe(text, Str.padStart(width));

const percent = (value: number): string => `${Math.round(value)}%`;

const leftOf = (window: UsageWindow): number => Math.max(100 - window.usedPercent, 0);

const isAccountWide = (window: UsageWindow): boolean => window.kind === "weekly" || window.kind === "cycle";

const isScoped = (window: UsageWindow): boolean => window.kind === "weekly-scoped" || window.kind === "cycle-scoped";

const windowsOf = (row: AccountRanking): ReadonlyArray<UsageWindow> =>
  AccountUsageOutcome.match(row.usage.outcome, {
    Ok: ({ windows }) => windows,
    NeedsLogin: A.empty<UsageWindow>,
    Failed: A.empty<UsageWindow>,
  });

const hoursUntil = (from: DateTime.Utc, at: DateTime.Utc): number =>
  Math.max((DateTime.toEpochMillis(at) - DateTime.toEpochMillis(from)) / MILLIS_PER_HOUR, 0);

const sessionWindow = (row: AccountRanking): O.Option<UsageWindow> =>
  A.findFirst(windowsOf(row), (window) => window.kind === "session");

// Hours until an account that cannot take work now can take it again.
const hoursUntilAvailable = (row: AccountRanking, now: DateTime.Utc): O.Option<number> =>
  AccountAvailability.$match(row.availability, {
    "session-capped": () =>
      O.flatMap(sessionWindow(row), (window) => O.map(window.resetsAt, (at) => hoursUntil(now, at))),
    "weekly-exhausted": () => row.hoursUntilWeeklyReset,
    ready: O.none<number>,
    unavailable: O.none<number>,
  });

const labelOf = (section: AccountSection, row: AccountRanking): string =>
  section === "supergrok"
    ? (productName[row.usage.account.provider] ?? row.usage.account.provider)
    : row.usage.account.label;

type Status = readonly [label: string, tone: (text: string) => string];

const statusOf = (row: AccountRanking, palette: Palette): Status =>
  AccountUsageOutcome.match(row.usage.outcome, {
    NeedsLogin: (): Status => ["needs login", palette.bad],
    Failed: (): Status => ["unreadable", palette.bad],
    Ok: (): Status =>
      AccountAvailability.$match(row.availability, {
        "weekly-exhausted": (): Status => ["week used up", palette.bad],
        "session-capped": (): Status => ["session full", palette.warn],
        ready: (): Status => (row.estimated ? ["ready (est.)", palette.dim] : ["ready", palette.good]),
        unavailable: (): Status => ["unreadable", palette.bad],
      }),
  });

const barOf = (row: AccountRanking, width: number, palette: Palette): string => {
  const [full, empty] = palette.color ? ["━", "━"] : ["█", "░"];
  return O.match(row.weeklyRemainingPercent, {
    // No limit data at all: leave the track out rather than draw an empty one.
    onNone: () => pipe(" ", Str.repeat(width)),
    onSome: (left) => {
      const filled = Math.min(Math.round((left / 100) * width), width);
      const tone = row.estimated ? palette.dim : left >= 50 ? palette.good : left >= 20 ? palette.warn : palette.bad;
      return `${tone(pipe(full, Str.repeat(filled)))}${palette.faint(pipe(empty, Str.repeat(width - filled)))}`;
    },
  });
};

const resetOf = (row: AccountRanking): string => {
  const accountWide = A.findFirst(windowsOf(row), isAccountWide);
  // An unstarted week, or one that reset since an older reading, has no known
  // reset time yet.
  const known = O.exists(accountWide, (window) => O.isSome(window.resetsAt));
  return known ? O.match(row.hoursUntilWeeklyReset, { onNone: () => "", onSome: renderHours }) : "";
};

const amount = (unit: CreditBalance["unit"], value: number): string =>
  unit === "usd" ? `$${Math.round(value)}` : `${Math.round(value)}`;

const shortDate = (at: DateTime.Utc): string =>
  DateTime.format(at, { month: "short", day: "numeric", timeZone: "UTC", locale: "en-US" });

const creditOf = (credit: CreditBalance): string =>
  A.join(
    [
      `${amount(credit.unit, credit.remaining)}`,
      ...O.toArray(O.map(credit.limit, (limit) => `of ${amount(credit.unit, limit)}`)),
      credit.label,
      ...O.toArray(O.map(credit.expiresAt, (at) => `(expire ${shortDate(at)})`)),
    ],
    " "
  );

// A session this close to full ends the next long task early.
const LOW_SESSION_PERCENT = 20;

const sessionDetail = (row: AccountRanking, now: DateTime.Utc, palette: Palette): O.Option<string> =>
  O.map(sessionWindow(row), (window) =>
    window.usedPercent >= 100
      ? palette.warn(
          O.match(window.resetsAt, {
            onNone: () => "session full",
            onSome: (at) => `session back in ${renderHours(hoursUntil(now, at))}`,
          })
        )
      : (leftOf(window) < LOW_SESSION_PERCENT ? palette.warn : palette.dim)(`session ${percent(leftOf(window))} left`)
  );

const otherWindowDetails = (row: AccountRanking): ReadonlyArray<string> => {
  const windows = windowsOf(row);
  const headline = A.findFirst(windows, isAccountWide);
  return A.map(
    A.filter(windows, (window) => isScoped(window) || (isAccountWide(window) && !O.contains(headline, window))),
    (window) => `${O.getOrElse(window.scope, () => window.kind)} ${percent(leftOf(window))} left`
  );
};

const ageDetail = (row: AccountRanking, palette: Palette): ReadonlyArray<string> =>
  O.match(row.dataAgeHours, {
    onNone: A.empty<string>,
    onSome: (hours) => [
      (hours >= STALE_HOURS ? palette.warn : palette.dim)(`as of ${renderHours(hours)} ago`),
      ...(row.estimated ? [palette.dim("a limit reset since then")] : A.empty<string>()),
    ],
  });

const detailsOf = (row: AccountRanking, now: DateTime.Utc, palette: Palette): ReadonlyArray<string> =>
  AccountUsageOutcome.match(row.usage.outcome, {
    NeedsLogin: ({ detail }) => [palette.dim(detail)],
    Failed: ({ detail }) => [palette.dim(detail)],
    Ok: ({ plan, windows, credits, limitResets }) => [
      ...O.toArray(sessionDetail(row, now, palette)),
      ...A.map(
        [
          ...(A.isReadonlyArrayEmpty(windows) ? ["no usage reported (idle)"] : A.empty<string>()),
          ...otherWindowDetails(row),
          ...A.map(credits, creditOf),
          ...O.toArray(
            O.map(
              O.filter(limitResets, (count) => count > 0),
              (count) => `${count} limit reset${count === 1 ? "" : "s"} unused`
            )
          ),
          ...O.toArray(O.map(plan, (value) => `plan ${value}`)),
        ],
        (text) => palette.dim(text)
      ),
      ...ageDetail(row, palette),
    ],
  });

// Join colored parts and cut the result to a visible width. The parts are
// cut as plain text first so no escape sequence is ever split.
const SEPARATOR = " · ";

const joinFitted = (parts: ReadonlyArray<string>, plain: ReadonlyArray<string>, width: number): string =>
  A.join(
    A.reduce(A.zip(parts, plain), { kept: A.empty<string>(), used: 0, full: false }, (state, [part, text]) => {
      const used = state.used + (A.isReadonlyArrayEmpty(state.kept) ? 0 : SEPARATOR.length) + Str.length(text);
      return state.full || used > width
        ? { ...state, full: true }
        : { kept: A.append(state.kept, part), used, full: false };
    }).kept,
    SEPARATOR
  );

const stripAnsi = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, "");

const visibleLength = (text: string): number => Str.length(stripAnsi(text));

interface Columns {
  readonly bar: number;
  readonly inner: number;
  readonly label: number;
}

// Every column of a row except the label and the bar: marker, separators,
// status, percent, and reset.
const ROW_FIXED_WIDTH = 2 + 1 + 1 + STATUS_WIDTH + 1 + 1 + PERCENT_WIDTH + 1 + RESET_WIDTH;
const MIN_LABEL_WIDTH = 10;

// The label column shrinks before the bar would push a row past the frame;
// `fit` truncates the labels it then cannot hold.
const columnsFor = (width: number, labels: ReadonlyArray<string>): Columns => {
  const inner = width - 4;
  const wanted = Math.min(Math.max(...A.map(labels, Str.length), 8) + 2, MAX_LABEL_WIDTH);
  const label = Math.max(Math.min(wanted, inner - ROW_FIXED_WIDTH - MIN_BAR_WIDTH), MIN_LABEL_WIDTH);
  return { inner, label, bar: Math.max(inner - ROW_FIXED_WIDTH - label, MIN_BAR_WIDTH) };
};

const framed = (content: string, columns: Columns, palette: Palette): string =>
  `${palette.border("│")} ${content}${" ".repeat(Math.max(columns.inner - visibleLength(content), 0))} ${palette.border("│")}`;

const rowLines = (
  section: AccountSection,
  row: AccountRanking,
  index: number,
  firstReady: O.Option<AccountRanking>,
  columns: Columns,
  now: DateTime.Utc,
  palette: Palette
): ReadonlyArray<string> => {
  const isNext = isRanked(section) && O.exists(firstReady, (ready) => ready === row);
  const marker = isRanked(section)
    ? isNext
      ? palette.accent("▶ ")
      : palette.dim(fit(`${index + 1}`, 2))
    : palette.dim("· ");
  const name = fit(labelOf(section, row), columns.label - 2);
  const signed = row.signedIn ? palette.accent(" ●") : "  ";
  const [status, tone] = statusOf(row, palette);
  const left = O.match(row.weeklyRemainingPercent, {
    onNone: () => "",
    onSome: (value) => `${percent(value)} left`,
  });
  const head = A.join(
    [
      `${marker}${(isNext ? palette.title : (text: string) => text)(name)}${signed}`,
      tone(fit(status, STATUS_WIDTH)),
      ` ${barOf(row, columns.bar, palette)}`,
      fitRight(left, PERCENT_WIDTH),
      palette.dim(fitRight(resetOf(row), RESET_WIDTH)),
    ],
    " "
  );
  const details = detailsOf(row, now, palette);
  const indent = "   ";
  const detailLine = joinFitted(details, A.map(details, stripAnsi), columns.inner - indent.length);
  return Str.isEmpty(detailLine)
    ? [framed(head, columns, palette)]
    : [framed(head, columns, palette), framed(`${indent}${detailLine}`, columns, palette)];
};

const panelHint = (group: AccountGroup, now: DateTime.Utc, firstReady: O.Option<AccountRanking>, palette: Palette) => {
  if (group.section === "supergrok") return O.map(A.head(group.rows), (row) => palette.dim(row.usage.account.label));
  if (!isRanked(group.section)) return O.none();
  return O.match(firstReady, {
    onSome: (row) => {
      const label = row.usage.account.label;
      if (row.signedIn) return O.some(palette.good(`stay on ${label}`));
      return O.some(
        A.some(group.rows, (other) => other.signedIn)
          ? palette.accent(`switch to ${label}`)
          : palette.accent(`use ${label}`)
      );
    },
    onNone: () => {
      const soonest = A.reduce(
        A.getSomes(A.map(group.rows, (row) => hoursUntilAvailable(row, now))),
        O.none<number>(),
        (best, hours) => O.some(O.match(best, { onNone: () => hours, onSome: (value) => Math.min(value, hours) }))
      );
      return O.some(
        palette.bad(
          O.match(soonest, {
            onNone: () => "none ready",
            onSome: (hours) => `none ready · first back in ${renderHours(hours)}`,
          })
        )
      );
    },
  });
};

const panelLines = (group: AccountGroup, width: number, now: DateTime.Utc, palette: Palette): ReadonlyArray<string> => {
  const columns = columnsFor(
    width,
    A.map(group.rows, (row) => labelOf(group.section, row))
  );
  const firstReady = A.findFirst(group.rows, (row) => row.availability === "ready");
  const title = ` ${sectionTitle[group.section]} `;
  const hint = O.map(panelHint(group, now, firstReady, palette), (text) => ` ${text} `);
  const fill = Math.max(width - 4 - Str.length(title) - O.match(hint, { onNone: () => 0, onSome: visibleLength }), 0);
  const top = `${palette.border("╭─")}${palette.title(title)}${palette.border("─".repeat(fill))}${O.getOrElse(hint, () => "")}${palette.border("─╮")}`;
  const bottom = palette.border(`╰${"─".repeat(width - 2)}╯`);
  return [
    top,
    ...A.flatMap(group.rows, (row, index) => rowLines(group.section, row, index, firstReady, columns, now, palette)),
    bottom,
  ];
};

/**
 * Render the report as the accounts board: a title line, a legend, and one
 * panel per provider.
 *
 * **Details**
 *
 * The width is clamped to 64..120 columns. Inside the Claude and Codex panels
 * the account to use next carries `▶`, and the panel's title bar says whether
 * to stay on the signed-in account (`●`) or switch. Percentages always mean
 * quota left.
 *
 * **Example** (Render an empty report)
 *
 * ```ts
 * import { AccountsBoardLayout, AccountsStatusReport, renderAccountsBoard } from "@beep/repo-cli/test/Accounts"
 * import * as DateTime from "effect/DateTime"
 *
 * const report = AccountsStatusReport.make({
 *   schemaVersion: "accounts-status/v2",
 *   generatedAt: DateTime.makeUnsafe(0),
 *   groups: [],
 * })
 * const text = renderAccountsBoard(report, AccountsBoardLayout.make({ width: 80, color: false, status: "" }))
 * console.log(text.includes("no accounts")) // true
 * ```
 *
 * @param report - The ranked report.
 * @param layout - Width, coloring, and the title status text.
 * @returns The board as lines of text.
 * @category formatting
 * @since 0.0.0
 */
export const renderAccountsBoard: {
  (layout: AccountsBoardLayout): (report: AccountsStatusReport) => string;
  (report: AccountsStatusReport, layout: AccountsBoardLayout): string;
} = dual(2, (report: AccountsStatusReport, layout: AccountsBoardLayout): string => {
  const palette = makePalette(layout.color);
  const width = Math.min(Math.max(layout.width, MIN_WIDTH), MAX_WIDTH);
  const status = fit(layout.status, Math.max(width - 11, 0)).trimEnd();
  const heading = `${palette.title(" Accounts")}${Str.isEmpty(status) ? "" : `  ${palette.dim(status)}`}`;
  // The long legend needs 80 columns; narrower boards get the short one.
  const legend =
    width >= 80
      ? palette.dim(
          ` ${palette.accent("▶")} use next   ${palette.accent("●")} signed in to the CLI   bars: weekly or billing-cycle quota left`
        )
      : palette.dim(` ${palette.accent("▶")} use next   ${palette.accent("●")} CLI login   bars: quota left`);
  if (!A.isReadonlyArrayNonEmpty(report.groups)) {
    return A.join(
      [
        heading,
        "",
        palette.dim(" no accounts: sign in through the proxy (cli-proxy-api --claude-login) or add a snapshot file"),
      ],
      "\n"
    );
  }
  return A.join(
    [heading, legend, ...A.flatMap(report.groups, (group) => panelLines(group, width, report.generatedAt, palette))],
    "\n"
  );
});
