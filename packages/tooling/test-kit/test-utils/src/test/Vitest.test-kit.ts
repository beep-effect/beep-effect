/**
 * Source-only test access to the instrumented runner with a controlled watchdog clock.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeVitestRuntime } from "../internal/VitestRuntime.ts";
import type { Clock } from "effect";

/**
 * Creates the package-local runner with an explicit watchdog clock.
 *
 * **Details**
 *
 * Only instrumentation time reads and watchdog sleeps use this clock. Effect
 * bodies retain their ordinary TestEnv, including TestClock. Each registration
 * and execution retains its own property deadline and lifecycle. The named
 * `@beep/test-utils/test/Vitest` subpath has a null publish export. The scoped
 * wildcard also blocks filename-derived test imports; source access uses this
 * exact named entry. These guards restrict import reachability, not artifact files.
 *
 * **Example** (Bind a watchdog without replacing the body clock)
 *
 * ```ts
 * import { makeIt } from "@beep/test-utils/test/Vitest";
 * import { expect } from "@effect/vitest";
 * import * as Clock from "effect/Clock";
 * import * as Effect from "effect/Effect";
 * import { TestClock } from "effect/testing";
 *
 * const it = makeIt(Effect.runSync(Clock.Clock));
 * it.effect("keeps the body clock independent", () =>
 *   Effect.gen(function* () {
 *     yield* TestClock.adjust("1 second");
 *     expect(yield* Clock.currentTimeMillis).toBe(1_000);
 *   })
 * );
 * ```
 *
 * @param clock - Clock used exclusively by the watchdog and lifecycle timing.
 * @returns The instrumented registration API bound to that clock.
 * @category testing
 * @since 0.0.0
 */
export const makeIt = (clock: Clock.Clock) => makeVitestRuntime(clock).it;
