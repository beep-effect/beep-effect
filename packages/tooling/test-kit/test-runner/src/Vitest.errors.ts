/**
 * Typed context and watchdog failures for the instrumented Vitest runner.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { RegistryTerms } from "./internal/generated/RegistryTerms.ts";

// This bootstrap package cannot import @beep/identity, so its schema identities
// come from the registry projection the identity registry generator writes.
const identity = (code: keyof typeof RegistryTerms) => {
  const { identifier, iri, curie } = RegistryTerms[code];
  return { schemaId: Symbol.for(identifier), identifier, iri, curie };
};

const PositiveTimeoutMillis = S.Finite.check(
  S.isGreaterThan(0, {
    identifier: "@beep/test-runner/Vitest/PositiveTimeoutMillisCheck",
    message: "A test watchdog timeout must be greater than zero",
  })
).pipe(
  S.annotate({
    ...identity("@beep/test-runner/Vitest/PositiveTimeoutMillis"),
    title: "PositiveTimeoutMillis",
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
 * import { TestContextUnavailable } from "@beep/test-runner"
 *
 * const error = TestContextUnavailable.make({ method: "each" })
 * console.log(error.method)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TestContextUnavailable extends S.TaggedError<TestContextUnavailable, { readonly brand: unique symbol }>(
  RegistryTerms["@beep/test-runner/Vitest/TestContextUnavailable"].identifier
)(
  "TestContextUnavailable",
  {
    method: S.NonEmptyString.pipe(
      S.annotateKey({
        ...identity("@beep/test-runner/Vitest/TestContextUnavailable.method"),
        title: "TestContextUnavailable.method",
        description: "Instrumented tester method that could not resolve its public Vitest execution context.",
      })
    ),
  },
  {
    ...identity("@beep/test-runner/Vitest/TestContextUnavailable"),
    title: "TestContextUnavailable",
    description: "Typed failure for an instrumented callback invoked outside the public Vitest context boundary.",
  }
) {
  static readonly is = S.is(TestContextUnavailable);

  /**
   * Describe the instrumented method whose public Vitest execution context is missing.
   *
   * @returns The context failure message for reporters and callers.
   */
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
 * import { TestHang } from "@beep/test-runner"
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
export class TestHang extends S.TaggedError<TestHang, { readonly brand: unique symbol }>(
  RegistryTerms["@beep/test-runner/Vitest/TestHang"].identifier
)(
  "TestHang",
  {
    lastLogLine: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<string>())),
      S.annotateKey({
        ...identity("@beep/test-runner/Vitest/TestHang.lastLogLine"),
        title: "TestHang.lastLogLine",
        description: "Last Effect log line observed locally for the hanging test, when one exists.",
      })
    ),
    testName: S.NonEmptyString.pipe(
      S.annotateKey({
        ...identity("@beep/test-runner/Vitest/TestHang.testName"),
        title: "TestHang.testName",
        description: "Resolved full Vitest task name for the hanging test.",
      })
    ),
    timeoutMillis: PositiveTimeoutMillis.pipe(
      S.annotateKey({
        ...identity("@beep/test-runner/Vitest/TestHang.timeoutMillis"),
        title: "TestHang.timeoutMillis",
        description: "Live-clock watchdog budget derived from the resolved Vitest task timeout.",
      })
    ),
  },
  {
    ...identity("@beep/test-runner/Vitest/TestHang"),
    title: "TestHang",
    description: "Typed failure for an Effect test that exceeded its live-clock watchdog budget.",
  }
) {
  static readonly is = S.is(TestHang);

  /**
   * Describe the expired watchdog with its test name, budget and last captured log.
   *
   * @returns The watchdog failure message, including a marker when no log was captured.
   */
  override get message(): string {
    const lastLog = O.getOrElse(this.lastLogLine, () => "<none>");
    return `Instrumented test "${this.testName}" exceeded its ${this.timeoutMillis}ms watchdog. Last log: ${lastLog}`;
  }
}
