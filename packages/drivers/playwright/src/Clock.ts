/**
 * Effect service wrapper for Playwright's browser clock APIs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { useHelper } from "./internal/use.ts";
import type { Clock as CoreClock } from "playwright";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("Clock");

/**
 * The fake clock of a browser context, with every time operation as an Effect.
 *
 * @category models
 * @since 0.0.0
 */
export interface ClockShape {
  /**
   * Advance the clock by jumping forward in time. Only fires due timers at most once. This is equivalent to user
   * closing the laptop lid for a while and reopening it later, after given time.
   *
   * @see {@link CoreClock.fastForward} for the wrapped Playwright method.
   */
  readonly fastForward: (ticks: number | string) => Effect.Effect<void, PlaywrightError>;
  /**
   * Install fake implementations for time-related functions.
   *
   * @see {@link CoreClock.install} for the wrapped Playwright method.
   */
  readonly install: (options?: { time?: number | string | Date }) => Effect.Effect<void, PlaywrightError>;
  /**
   * Advance the clock by jumping forward in time and pause the time.
   *
   * @see {@link CoreClock.pauseAt} for the wrapped Playwright method.
   */
  readonly pauseAt: (time: number | string | Date) => Effect.Effect<void, PlaywrightError>;
  /**
   * Resumes timers. Once this method is called, time resumes flowing, timers are fired as usual.
   *
   * @see {@link CoreClock.resume} for the wrapped Playwright method.
   */
  readonly resume: Effect.Effect<void, PlaywrightError>;
  /**
   * Advance the clock, firing all the time-related callbacks.
   *
   * @see {@link CoreClock.runFor} for the wrapped Playwright method.
   */
  readonly runFor: (ticks: number | string) => Effect.Effect<void, PlaywrightError>;
  /**
   * Makes `Date.now` and `new Date()` return fixed fake time at all times, keeps all the timers running.
   *
   * @see {@link CoreClock.setFixedTime} for the wrapped Playwright method.
   */
  readonly setFixedTime: (time: number | string | Date) => Effect.Effect<void, PlaywrightError>;
  /**
   * Sets system time, but does not trigger any timers.
   *
   * @see {@link CoreClock.setSystemTime} for the wrapped Playwright method.
   */
  readonly setSystemTime: (time: number | string | Date) => Effect.Effect<void, PlaywrightError>;
  /**
   * Runs any promise-based method on the underlying Playwright `Clock`, for functionality this service does not
   * expose directly.
   *
   * @see {@link CoreClock} for the wrapped Playwright clock.
   */
  readonly use: <T>(f: (clock: CoreClock) => Promise<T>) => Effect.Effect<T, PlaywrightError>;
}

/**
 * Service for a {@link ClockShape}.
 *
 * **Example** (Freeze the page clock)
 *
 * ```ts
 * import { Clock } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const frozen = Effect.gen(function* () {
 *   const clock = yield* Clock
 *   yield* clock.install({ time: new Date("2024-01-01T00:00:00Z") })
 *   yield* clock.pauseAt(new Date("2024-01-01T08:00:00Z"))
 *   yield* clock.runFor("01:00")
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Clock extends Context.Service<Clock, ClockShape>()($I`Clock`) {}

/**
 * Creates a `Clock` from a Playwright `Clock` instance.
 *
 * **Example** (Wrap a page's clock)
 *
 * ```ts
 * import { makeClock } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const fixTime = (page: Page) => makeClock(page.clock).setFixedTime(new Date("2024-01-01T00:00:00Z"))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeClock = (clock: CoreClock): ClockShape => {
  const use = useHelper(clock);

  return Clock.of({
    fastForward: Effect.fn("Clock.fastForward")((ticks) => use((c) => c.fastForward(ticks))),
    install: Effect.fn("Clock.install")((options) => use((c) => c.install(options))),
    pauseAt: Effect.fn("Clock.pauseAt")((time) => use((c) => c.pauseAt(time))),
    resume: use((c) => c.resume()),
    runFor: Effect.fn("Clock.runFor")((ticks) => use((c) => c.runFor(ticks))),
    setFixedTime: Effect.fn("Clock.setFixedTime")((time) => use((c) => c.setFixedTime(time))),
    setSystemTime: Effect.fn("Clock.setSystemTime")((time) => use((c) => c.setSystemTime(time))),
    use,
  });
};
