// Ported from vitest-agent 1cf1ab94 packages/ui/__test__/format-duration.test.ts and packages/ui/src/counts.ts (MIT).
import { formatBytes, formatCounts, formatDuration, plural } from "@beep/gate-report/Format";
import { Totals } from "@beep/gate-report/GateReport";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";

describe("formatDuration", () => {
  it("renders a whole sub-second millisecond value unchanged", () => {
    assert.strictEqual(formatDuration(250), "250ms");
  });

  it("rounds a sub-second float to whole milliseconds", () => {
    assert.strictEqual(formatDuration(14.87745800000016), "15ms");
  });

  it("drops a trailing .0 when the rounded millisecond value is whole", () => {
    assert.strictEqual(formatDuration(14.02), "14ms");
  });

  it("renders zero as 0ms", () => {
    assert.strictEqual(formatDuration(0), "0ms");
  });

  it("renders exactly one second as 1s", () => {
    assert.strictEqual(formatDuration(1000), "1s");
  });

  it("rounds a multi-second value to one decimal place", () => {
    assert.strictEqual(formatDuration(2549), "2.5s");
  });

  it("switches to minutes and whole seconds from one minute", () => {
    assert.strictEqual(formatDuration(63210), "1m 3s");
  });

  it("stays in the millisecond form just below one second", () => {
    assert.strictEqual(formatDuration(999.4), "999ms");
  });

  it("writes a value that rounds up to a second in seconds, never 1000ms", () => {
    assert.strictEqual(formatDuration(999.6), "1s");
  });

  it("writes a value that rounds up to a minute in minutes, never 60s", () => {
    assert.strictEqual(formatDuration(59_960), "1m 0s");
  });
});

describe("plural and formatBytes", () => {
  it("chooses the singular for one only", () => {
    assert.deepStrictEqual(
      A.map([0, 1, 2], (count) => plural({ count, one: "test", other: "tests" })),
      ["0 tests", "1 test", "2 tests"]
    );
  });

  it("writes bytes, then one-decimal kilobytes and megabytes", () => {
    assert.deepStrictEqual(A.map([0, 512, 1024, 1536, 13_450, 5 * 1024 * 1024, 2 ** 50], formatBytes), [
      "0 B",
      "512 B",
      "1 KB",
      "1.5 KB",
      "13.1 KB",
      "5 MB",
      "1048576 GB",
    ]);
  });
});

describe("formatCounts, the totals line retargeted from vitest-agent 1cf1ab94 packages/ui/src/counts.ts", () => {
  const counts = (totals: Totals, itemKind: "test" | "diagnostic" | "step" = "test") =>
    formatCounts({ totals, itemKind });

  it("prints passed over the item total, then each non-zero total", () => {
    assert.strictEqual(
      counts(Totals.make({ collected: 4, passed: 2, failed: 1, skipped: 1 })),
      "2/4 passed, 1 failed, 1 skipped"
    );
  });

  it("counts timeouts and warnings in the denominator", () => {
    assert.strictEqual(
      counts(Totals.make({ collected: 4, passed: 1, warned: 1, timedOut: 2 })),
      "1/4 passed, 1 warned, 2 timed out"
    );
  });

  it("prints an empty test run as 0 tests collected", () => {
    assert.strictEqual(counts(Totals.make({})), "0 tests collected");
  });

  it("keeps the passed form when tests were collected but none finished", () => {
    assert.strictEqual(counts(Totals.make({ collected: 3 })), "0/0 passed");
  });

  it("appends load, hook, unhandled and errored totals, singular and plural", () => {
    assert.strictEqual(
      counts(Totals.make({ collected: 1, passed: 1, loadFailed: 1, hookFailed: 2, unhandled: 1, errored: 1 })),
      "1/1 passed, 1 load failure, 2 hook failures, 1 unhandled error, 1 errored"
    );
  });

  it("prints a diagnostic gate as errors, warnings and units checked", () => {
    assert.strictEqual(
      counts(Totals.make({ collected: 30, failed: 2, warned: 1 }), "diagnostic"),
      "2 errors, 1 warning, 30 units checked"
    );
    assert.strictEqual(counts(Totals.make({}), "diagnostic"), "0 errors, 0 warnings, 0 units checked");
  });

  it("prints a step gate like a test gate, and an empty one as 0 steps run", () => {
    assert.strictEqual(counts(Totals.make({}), "step"), "0 steps run");
    assert.strictEqual(counts(Totals.make({ collected: 2, passed: 2 }), "step"), "2/2 passed");
  });
});
