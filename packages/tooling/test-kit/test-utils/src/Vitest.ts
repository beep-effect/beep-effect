/**
 * Instrumented Effect Vitest methods with per-test tracing and a live-clock
 * watchdog derived from the resolved Vitest task timeout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Typed failures raised by the instrumented test runner.
 *
 * @category errors
 * @since 0.0.0
 */
export { TestContextUnavailable, TestHang } from "./Vitest.errors.ts";

import { InstrumentedVitestRuntime } from "./internal/VitestRuntime.ts";

/**
 * Instrumented drop-in replacement for `it` from `@effect/vitest`.
 *
 * **Details**
 *
 * Plain Vitest calls and the complete Effect/live/layer tester surface delegate
 * to the public rc.113 runner. Effectful bodies gain a live-clock watchdog below
 * their resolved task timeout. Set `BEEP_TEST_TRACE=1`, or run in CI, to emit
 * annotated start/end diagnostics; JSON reporter durations remain authoritative.
 *
 * **Gotchas**
 *
 * Live mode is still reserved for tests that require live Clock/Console or
 * unmanaged wall-clock behavior. Instrumentation does not provide platform
 * services and does not advance a test's `TestClock`.
 *
 * **Example** (Run an instrumented Effect test)
 *
 * ```ts
 * import { it } from "@beep/test-utils/Vitest"
 * import { assertTrue } from "@effect/vitest/utils"
 * import { Effect } from "effect"
 *
 * it.effect("keeps the Effect test environment", () =>
 *   Effect.sync(() => assertTrue(true)))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const it = InstrumentedVitestRuntime.it;
