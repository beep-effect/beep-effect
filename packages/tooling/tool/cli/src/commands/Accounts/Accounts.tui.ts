/**
 * The live accounts screen: a full-screen board that re-polls on a timer.
 *
 * **Details**
 *
 * The screen takes over the terminal's alternate buffer, so leaving it
 * restores what was there. Keys: `r` polls now, `q`, `Esc`, or `Ctrl+C`
 * quits, and a board taller than the terminal scrolls under a pinned title
 * line with `↑`/`↓` or `j`/`k`, `PgUp`/`PgDn` or `Space`, and `g`/`G` or
 * `Home`/`End`. Line wrap is off while the screen is up, so a terminal
 * narrower than the board clips each line instead of breaking the frame. The
 * screen opens on the staged headroom snapshot, when there is one, until the
 * first poll lands. The board is redrawn every second, which keeps the countdown current
 * and follows terminal resizes; the accounts are polled once per interval.
 * When standard output is not a terminal, the board is printed once instead.
 * A poll that fails leaves the last reading on screen and names the failure in
 * the status line until a poll succeeds again.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import { readAccountHeadroomSnapshot, stageAccountHeadroomReport } from "../Palantiri/Palantiri.service.ts";
import { AccountsBoardLayout, renderAccountsBoard } from "./Accounts.view.ts";
import { loadAccountsReport } from "./AccountsUsage.service.ts";
import type { AccountsStatusReport } from "./Accounts.schemas.ts";

const ENTER_SCREEN = "\u001b[?1049h\u001b[?25l\u001b[?7l";
const LEAVE_SCREEN = "\u001b[?7h\u001b[?25h\u001b[?1049l";
const HOME = "\u001b[H";
const CLEAR_LINE = "\u001b[K";
const CLEAR_BELOW = "\u001b[J";
// Width used when the board is printed to something that is not a terminal.
const PLAIN_WIDTH = 100;
const MIN_INTERVAL = Duration.seconds(15);

interface WatchState {
  // Why the last poll failed, until a poll succeeds again.
  readonly lastError: O.Option<string>;
  readonly nextPollAt: DateTime.Utc;
  readonly polling: boolean;
  readonly report: O.Option<AccountsStatusReport>;
  readonly scroll: number;
}

const clock = (at: DateTime.Utc): string =>
  DateTime.formatLocal(at, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

const secondsUntil = (now: DateTime.Utc, at: DateTime.Utc): number =>
  Math.max(Math.ceil((DateTime.toEpochMillis(at) - DateTime.toEpochMillis(now)) / 1000), 0);

const statusLine = (state: WatchState, now: DateTime.Utc): string =>
  A.join(
    [
      ...O.toArray(O.map(state.lastError, (message) => `poll failed: ${message} (showing the last reading)`)),
      ...O.toArray(O.map(state.report, (report) => `updated ${clock(report.generatedAt)}`)),
      state.polling ? "polling…" : `next poll in ${secondsUntil(now, state.nextPollAt)}s`,
      "r refresh",
      "q quit",
    ],
    "  ·  "
  );

/**
 * The lines a screen paints and the largest scroll offset that still moves
 * the board.
 *
 * @category models
 * @since 0.0.0
 */
export type AccountsViewport = readonly [lines: ReadonlyArray<string>, maxScroll: number];

/**
 * Cut a board down to a terminal's height: the title line stays pinned and
 * the rest scrolls.
 *
 * **Details**
 *
 * When the board fits, every line shows and the scroll range is zero. When it
 * does not, the last line names the lines shown and the scroll keys, and the
 * returned offset is clamped to what can actually scroll.
 *
 * **Example** (Scroll a tall board)
 *
 * ```ts
 * import { accountsViewport } from "@beep/repo-cli/test/Accounts"
 *
 * const [lines, maxScroll] = accountsViewport("title\na\nb\nc\nd\ne", 4, 99)
 * console.log(maxScroll) // 3
 * console.log(lines.slice(0, 3)) // ["title", "d", "e"]
 * ```
 *
 * @param board - The rendered board, title line first.
 * @param rows - The terminal's height in rows.
 * @param scroll - The requested scroll offset, in board lines below the title.
 * @returns The lines to paint and the largest useful scroll offset.
 * @category formatting
 * @since 0.0.0
 */
export const accountsViewport: {
  (rows: number, scroll: number): (board: string) => AccountsViewport;
  (board: string, rows: number, scroll: number): AccountsViewport;
} = dual(3, (board: string, rows: number, scroll: number): AccountsViewport => {
  const [title = "", ...body] = Str.split(board, "\n");
  const room = Math.max(rows - 1, 1);
  if (body.length <= room) return [[title, ...body], 0];
  const height = Math.max(room - 1, 1);
  const maxScroll = body.length - height;
  const offset = Math.min(Math.max(scroll, 0), maxScroll);
  const footer = ` lines ${offset + 1}-${offset + height} of ${body.length}  ·  ↑↓ j k scroll  ·  PgUp PgDn  ·  g G ends`;
  return [[title, ...A.take(A.drop(body, offset), height), footer], maxScroll];
});

const frameOf = (lines: ReadonlyArray<string>): string =>
  `${HOME}${A.join(
    A.map(lines, (line) => `${line}${CLEAR_LINE}`),
    "\n"
  )}${CLEAR_BELOW}`;

const isQuit = (input: Terminal.UserInput): boolean =>
  input.key.name === "q" || input.key.name === "escape" || (input.key.ctrl && input.key.name === "c");

const isRefresh = (input: Terminal.UserInput): boolean => input.key.name === "r";

const scrollStep = (input: Terminal.UserInput, page: number): O.Option<(scroll: number, max: number) => number> => {
  const name = input.key.name;
  if (name === "down" || name === "j") return O.some((scroll) => scroll + 1);
  if (name === "up" || name === "k") return O.some((scroll) => scroll - 1);
  if (name === "pagedown" || name === "space") return O.some((scroll) => scroll + page);
  if (name === "pageup") return O.some((scroll) => scroll - page);
  if (name === "end" || (name === "g" && input.key.shift)) return O.some((_, max) => max);
  if (name === "home" || name === "g") return O.some(() => 0);
  return O.none();
};

const printOnce = Effect.gen(function* () {
  const report = yield* readAccountHeadroomSnapshot.pipe(
    Effect.flatMap(loadAccountsReport),
    Effect.tap(stageAccountHeadroomReport)
  );
  yield* Console.log(
    renderAccountsBoard(
      report,
      AccountsBoardLayout.make({ width: PLAIN_WIDTH, color: false, status: `updated ${clock(report.generatedAt)}` })
    )
  );
});

/**
 * Run the live accounts screen until the operator quits.
 *
 * **Example** (Build the screen effect)
 *
 * ```ts
 * import { watchAccounts } from "@beep/repo-cli/test/Accounts"
 * import * as Duration from "effect/Duration"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(watchAccounts(Duration.minutes(1)))) // true
 * ```
 *
 * @param interval - Time between polls; at least 15 seconds.
 * @returns An effect that ends when the operator quits.
 * @category commands
 * @since 0.0.0
 */
export const watchAccounts = Effect.fn("Accounts.watch")(function* (interval: Duration.Duration) {
  const terminal = yield* Terminal.Terminal;
  // A terminal reports zero columns when standard output is piped or redirected.
  if ((yield* terminal.columns) === 0) return yield* printOnce;

  const every = Duration.max(interval, MIN_INTERVAL);
  const seed = yield* readAccountHeadroomSnapshot;
  const state = yield* Ref.make<WatchState>({
    report: seed,
    lastError: O.none(),
    polling: false,
    nextPollAt: yield* DateTime.now,
    scroll: 0,
  });
  const scrollRange = yield* Ref.make(0);

  const draw = Effect.gen(function* () {
    const current = yield* Ref.get(state);
    const now = yield* DateTime.now;
    const width = yield* terminal.columns;
    const rows = yield* terminal.rows;
    const status = statusLine(current, now);
    const body = O.match(current.report, {
      onNone: () => ` Accounts  ${status}\n\n polling every account…`,
      onSome: (report) => renderAccountsBoard(report, AccountsBoardLayout.make({ width, color: true, status })),
    });
    const [lines, maxScroll] = accountsViewport(body, rows, current.scroll);
    yield* Ref.set(scrollRange, maxScroll);
    yield* terminal.display(frameOf(lines)).pipe(Effect.ignore);
  });

  const poll = Effect.gen(function* () {
    yield* Ref.update(state, (current) => ({ ...current, polling: true }));
    yield* draw;
    const previous = (yield* Ref.get(state)).report;
    const [report, lastError] = yield* loadAccountsReport(previous).pipe(
      Effect.tap(stageAccountHeadroomReport),
      Effect.match({
        onFailure: (error) => [previous, O.some(error.message)] as const,
        onSuccess: (next) => [O.some(next), O.none<string>()] as const,
      })
    );
    const now = yield* DateTime.now;
    yield* Ref.update(state, (current) => ({
      ...current,
      report,
      lastError,
      polling: false,
      nextPollAt: DateTime.addDuration(now, every),
    }));
    yield* draw;
  });

  // Every second: redraw, and start a poll when one is due and none is running.
  const tick = Effect.gen(function* () {
    const current = yield* Ref.get(state);
    const now = yield* DateTime.now;
    if (!current.polling && DateTime.toEpochMillis(now) >= DateTime.toEpochMillis(current.nextPollAt)) {
      yield* Effect.forkScoped(poll);
    }
    yield* draw;
    yield* Effect.sleep(Duration.seconds(1));
  });

  const scrollBy = Effect.fn("Accounts.scrollBy")(function* (step: (scroll: number, max: number) => number) {
    const max = yield* Ref.get(scrollRange);
    yield* Ref.update(state, (current) => ({
      ...current,
      scroll: Math.min(Math.max(step(Math.min(current.scroll, max), max), 0), max),
    }));
    yield* draw;
  });

  yield* Effect.acquireRelease(terminal.display(ENTER_SCREEN).pipe(Effect.ignore), () =>
    terminal.display(LEAVE_SCREEN).pipe(Effect.ignore)
  );
  yield* tick.pipe(Effect.forever, Effect.forkScoped);

  const input = yield* terminal.readInput;
  const keys: Effect.Effect<void> = Queue.take(input).pipe(
    Effect.matchEffect({
      onFailure: () => Effect.void,
      onSuccess: (key) =>
        isQuit(key)
          ? Effect.void
          : isRefresh(key)
            ? Effect.flatMap(DateTime.now, (now) =>
                Ref.update(state, (current) => ({ ...current, nextPollAt: now }))
              ).pipe(Effect.andThen(Effect.suspend(() => keys)))
            : Effect.flatMap(terminal.rows, (rows) =>
                O.match(scrollStep(key, Math.max(rows - 3, 1)), {
                  onNone: () => Effect.void,
                  onSome: scrollBy,
                })
              ).pipe(Effect.andThen(Effect.suspend(() => keys))),
    })
  );
  yield* keys;
}, Effect.scoped);
