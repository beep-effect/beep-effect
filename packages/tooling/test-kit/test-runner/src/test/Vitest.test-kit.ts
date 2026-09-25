/**
 * Source-only test access to the instrumented runner with a controlled watchdog clock.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { instrumentMethods as instrumentMethodsInternal } from "../internal/VitestInstrumentation.ts";
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
 * `@beep/test-runner/test/Vitest` subpath has a null publish export. The scoped
 * wildcard also blocks filename-derived test imports; source access uses this
 * exact named entry. These guards restrict import reachability, not artifact files.
 *
 * **Example** (Bind a watchdog without replacing the body clock)
 *
 * ```ts
 * import { makeIt } from "@beep/test-runner/test/Vitest";
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

/**
 * Instruments an arbitrary Effect Vitest methods object with the package
 * watchdog and context wiring.
 *
 * **Details**
 *
 * Tests hand in a fake methods object to capture the wrapped callbacks the
 * instrumentation registers, then drive those callbacks directly, for example
 * outside the async-local execution store. `undefined` selects the live clock.
 *
 * **Example** (Instrument the stock methods on the live clock)
 *
 * ```ts
 * import { instrumentMethods } from "@beep/test-runner/test/Vitest";
 * import { it } from "@effect/vitest";
 * import * as Effect from "effect/Effect";
 *
 * const instrumented = instrumentMethods(it, undefined);
 * instrumented.effect("runs under the package watchdog", () => Effect.void);
 * ```
 *
 * @param methods - Effect Vitest methods to wrap.
 * @param clock - Watchdog clock, or `undefined` for the live clock.
 * @returns The instrumented methods object.
 * @category testing
 * @since 0.0.0
 */
export const instrumentMethods = instrumentMethodsInternal;
