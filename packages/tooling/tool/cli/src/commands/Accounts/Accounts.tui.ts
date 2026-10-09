/**
 * The live accounts screen: a full-screen board that re-polls on a timer.
 *
 * **Details**
 *
 * The screen takes over the terminal's alternate buffer, so leaving it
 * restores what was there. Keys: `r` polls now, `q`, `Esc`, or `Ctrl+C`
 * quits. The board is redrawn every second, which keeps the countdown current
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
import * as O from "effect/Option";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import { AccountsBoardLayout, renderAccountsBoard } from "./Accounts.view.ts";
import { loadAccountsReport } from "./AccountsUsage.service.ts";
import type { AccountsStatusReport } from "./Accounts.schemas.ts";

const ENTER_SCREEN = "\u001b[?1049h\u001b[?25l";
const LEAVE_SCREEN = "\u001b[?25h\u001b[?1049l";
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

// Paint over the previous frame line by line instead of clearing the screen
// first, so a redraw never flashes.
const frameOf = (text: string): string =>
  `${HOME}${A.join(
    A.map(Str.split(text, "\n"), (line) => `${line}${CLEAR_LINE}`),
    "\n"
  )}${CLEAR_BELOW}`;

const isQuit = (input: Terminal.UserInput): boolean =>
  input.key.name === "q" || input.key.name === "escape" || (input.key.ctrl && input.key.name === "c");

const isRefresh = (input: Terminal.UserInput): boolean => input.key.name === "r";

const printOnce = Effect.gen(function* () {
  const report = yield* loadAccountsReport(O.none());
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
  const state = yield* Ref.make<WatchState>({
    report: O.none(),
    lastError: O.none(),
    polling: false,
    nextPollAt: yield* DateTime.now,
  });

  const draw = Effect.gen(function* () {
    const current = yield* Ref.get(state);
    const now = yield* DateTime.now;
    const width = yield* terminal.columns;
    const status = statusLine(current, now);
    const body = O.match(current.report, {
      onNone: () => ` Accounts  ${status}\n\n polling every account…`,
      onSome: (report) => renderAccountsBoard(report, AccountsBoardLayout.make({ width, color: true, status })),
    });
    yield* terminal.display(frameOf(body)).pipe(Effect.ignore);
  });

  const poll = Effect.gen(function* () {
    yield* Ref.update(state, (current) => ({ ...current, polling: true }));
    yield* draw;
    const previous = (yield* Ref.get(state)).report;
    const [report, lastError] = yield* loadAccountsReport(previous).pipe(
      Effect.match({
        onFailure: (error) => [previous, O.some(error.message)] as const,
        onSuccess: (next) => [O.some(next), O.none<string>()] as const,
      })
    );
    const now = yield* DateTime.now;
    yield* Ref.set(state, { report, lastError, polling: false, nextPollAt: DateTime.addDuration(now, every) });
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
            : Effect.suspend(() => keys),
    })
  );
  yield* keys;
}, Effect.scoped);
