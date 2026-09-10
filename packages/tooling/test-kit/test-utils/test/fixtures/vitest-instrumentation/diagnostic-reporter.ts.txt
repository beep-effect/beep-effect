import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { UserConsoleLog } from "vitest";
import type { Reporter, TestCase } from "vitest/node";

const encodeRecord = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

// The parent owns artifact persistence; the reporter needs no platform layer.
// Public errors retain message and cause independently from the registration stack.
export default class DiagnosticReporter implements Reporter {
  onUserConsoleLog(log: UserConsoleLog) {
    return Console.log(log.content).pipe(Effect.runPromise);
  }

  onTestCaseResult(testCase: TestCase) {
    return Effect.gen(function* () {
      const monotonicNanos = yield* Clock.monotonicTimeNanos;
      const result = testCase.result();
      const line = yield* encodeRecord({
        name: testCase.fullName,
        state: result.state,
        runtime: { node: process.versions.node, bun: process.versions.bun ?? null },
        errors: result.errors ?? [],
        diagnostic: testCase.diagnostic(),
        monotonicNanos: `${monotonicNanos}`,
      });
      yield* Console.log(`BEEP_VITEST_RAW_ERROR ${line}`);
    }).pipe(Effect.runPromise);
  }
}
