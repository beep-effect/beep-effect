import { $TestUtilsId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $TestUtilsId.create("Vitest");

const PositiveTimeoutMillis = S.Finite.check(
  S.isGreaterThan(0, {
    identifier: $I`PositiveTimeoutMillisCheck`,
    message: "A test watchdog timeout must be greater than zero",
  })
).pipe(
  $I.annoteSchema("PositiveTimeoutMillis", {
    description: "Finite positive live-clock watchdog budget in milliseconds.",
  })
);

/**
 * Failure raised when an instrumented tester callback runs outside Vitest's
 * public per-execution context boundary.
 *
 * **Example** (Inspect a missing context)
 *
 * ```ts
 * import { TestContextUnavailable } from "@beep/test-utils/Vitest"
 *
 * const error = TestContextUnavailable.make({ method: "each" })
 * console.log(error.method)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TestContextUnavailable extends S.TaggedError<TestContextUnavailable>($I`TestContextUnavailable`)(
  "TestContextUnavailable",
  {
    method: S.NonEmptyString.pipe(
      $I.annoteKey("TestContextUnavailable.method", {
        description: "Instrumented tester method that could not resolve its public Vitest execution context.",
      })
    ),
  },
  $I.annoteError<TestContextUnavailable>("TestContextUnavailable", {
    description: "Typed failure for an instrumented callback invoked outside the public Vitest context boundary.",
  })
) {
  static readonly is = S.is(TestContextUnavailable);

  override get message(): string {
    return `Instrumented ${this.method} callback ran without its Vitest execution context`;
  }
}

/**
 * Failure raised when an instrumented Effect test does not finish before its
 * live-clock watchdog budget.
 *
 * **Details**
 *
 * `lastLogLine` is `None` when the test emitted no Effect log event before the
 * watchdog expired. The error preserves the resolved Vitest task name and the
 * exact watchdog budget derived from that task's timeout.
 *
 * **Example** (Inspect a test hang)
 *
 * ```ts
 * import { TestHang } from "@beep/test-utils/Vitest"
 * import * as O from "effect/Option"
 *
 * const error = TestHang.make({
 *   lastLogLine: O.some("waiting for queue"),
 *   testName: "worker drains its queue",
 *   timeoutMillis: 950
 * })
 *
 * console.log(error.testName)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TestHang extends S.TaggedError<TestHang>($I`TestHang`)(
  "TestHang",
  {
    lastLogLine: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("TestHang.lastLogLine", {
        description: "Last Effect log line observed locally for the hanging test, when one exists.",
      })
    ),
    testName: S.NonEmptyString.pipe(
      $I.annoteKey("TestHang.testName", {
        description: "Resolved full Vitest task name for the hanging test.",
      })
    ),
    timeoutMillis: PositiveTimeoutMillis.pipe(
      $I.annoteKey("TestHang.timeoutMillis", {
        description: "Live-clock watchdog budget derived from the resolved Vitest task timeout.",
      })
    ),
  },
  $I.annoteError<TestHang>("TestHang", {
    description: "Typed failure for an Effect test that exceeded its live-clock watchdog budget.",
  })
) {
  static readonly is = S.is(TestHang);

  override get message(): string {
    const lastLog = O.getOrElse(this.lastLogLine, () => "<none>");
    return `Instrumented test "${this.testName}" exceeded its ${this.timeoutMillis}ms watchdog. Last log: ${lastLog}`;
  }
}
