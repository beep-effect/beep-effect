// Ported from vitest-agent packages/sdk/__test__/build-report.test.ts at 1cf1ab94 (MIT).
// Ported from vitest-agent packages/ui/__test__/synthesize.test.ts at 1cf1ab94 (MIT).
import { reduceEvents } from "@beep/gate-report/Reducer";
import { StrayOutput } from "@beep/gate-report/StrayOutput";
import { UNREADABLE_FIELD } from "@beep/repo-gate-vitest/internal/ErrorText";
import {
  isTimeoutError,
  keyedNames,
  MAX_UNIT_FAULTS,
  normalizeState,
  runReasonOf,
  SUITE_FAILURE_LABEL,
  SUITE_LOAD_FAILURE_LABEL,
  synthesizeEvents,
} from "@beep/repo-gate-vitest/internal/Synthesize";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { makeModule, makeSuite, makeTestCase, ROOT } from "./support/vitest.ts";
import type { GateReport } from "@beep/gate-report/GateReport";
import type { Item } from "@beep/gate-report/Item";
import type {
  VitestError,
  VitestModule,
  VitestSuite,
  VitestTestCase,
} from "@beep/repo-gate-vitest/internal/VitestShapes";

const synthesize = (
  modules: ReadonlyArray<VitestModule>,
  options: {
    readonly unhandledErrors?: ReadonlyArray<VitestError>;
    readonly reason?: string;
    readonly strayOutput?: O.Option<StrayOutput>;
  } = {}
) =>
  synthesizeEvents({
    runId: "r1",
    gate: "test",
    subject: "@beep/demo",
    root: ROOT,
    startedAt: DateTime.makeUnsafe(0),
    durationMs: 120,
    inputFingerprint: "local:r1",
    modules,
    unhandledErrors: options.unhandledErrors ?? [],
    reason: options.reason ?? "passed",
    strayOutput: options.strayOutput ?? O.none(),
  });

const reportOf = (...args: Parameters<typeof synthesize>): GateReport =>
  Result.getOrThrowWith(reduceEvents(synthesize(...args)), (error) => error);

const onlyItem = (report: GateReport): Item => {
  assert.strictEqual(report.items.length, 1);
  return pipe(
    A.head(report.items),
    O.getOrThrowWith(() => "no item")
  );
};

const stackOf = (item: Item) =>
  pipe(
    item.detail,
    O.flatMap((detail) => detail.stack)
  );

describe("synthesizeEvents — structure", () => {
  it("queues the package, then every file under it, then each module's items", () => {
    const events = synthesize([
      makeModule({ file: "test/a.test.ts", tests: [makeTestCase({ name: "one" })] }),
      makeModule({ file: "test/b.test.ts", tests: [makeTestCase({ name: "two" })] }),
    ]);
    assert.deepStrictEqual(
      A.map(events, (event) => event._tag),
      [
        "RunStarted",
        "UnitQueued",
        "UnitQueued",
        "UnitQueued",
        "UnitStarted",
        "UnitCollected",
        "ItemFinished",
        "UnitFinished",
        "UnitStarted",
        "UnitCollected",
        "ItemFinished",
        "UnitFinished",
        "RunFinished",
      ]
    );
  });

  it("keys each test on its file and full name, under the file unit", () => {
    const report = reportOf([
      makeModule({ file: "test/a.test.ts", tests: [makeTestCase({ name: "adds", fullName: "math > adds" })] }),
    ]);
    const item = onlyItem(report);
    assert.deepStrictEqual(item.key, { _tag: "TestKey", file: "test/a.test.ts", fullName: "math > adds" });
    assert.strictEqual(item.unit, "test/a.test.ts");
    assert.deepStrictEqual(
      A.map(report.units, (unit) => [unit.id, unit.kind]),
      [
        ["@beep/demo", "package"],
        ["test/a.test.ts", "file"],
      ]
    );
  });

  it("keeps two tests with one full name in one file as two items, the failure whole", () => {
    const report = reportOf(
      [
        makeModule({
          file: "test/dup.test.ts",
          tests: [
            makeTestCase({
              name: "dup",
              state: "failed",
              errors: [
                {
                  message: "expected 1 to be 2",
                  stacks: [{ method: "dup", file: `${ROOT}/test/dup.test.ts`, line: 4, column: 9 }],
                },
              ],
            }),
            makeTestCase({ name: "dup" }),
          ],
        }),
      ],
      { reason: "failed" }
    );
    assert.strictEqual(report.items.length, 2);
    assert.strictEqual(report.totals.failed, 1);
    assert.strictEqual(report.totals.passed, 1);
    assert.strictEqual(report.reason, "failed");
    const failed = A.filter(report.items, (item) => item.outcome === "failed");
    const passed = A.filter(report.items, (item) => item.outcome === "passed");
    assert.strictEqual(failed.length, 1);
    assert.deepStrictEqual(
      A.map(failed, (item) => item.key),
      [{ _tag: "TestKey", file: "test/dup.test.ts", fullName: "dup" }]
    );
    assert.deepStrictEqual(
      A.map(passed, (item) => item.key),
      [{ _tag: "TestKey", file: "test/dup.test.ts", fullName: "dup (2)" }]
    );
    const failure = A.flatMap(failed, (item) =>
      O.toArray(O.zipWith(item.detail, item.location, (detail, at) => [detail.message, at.file, at.line]))
    );
    assert.deepStrictEqual(failure, [["expected 1 to be 2", "test/dup.test.ts", 4]]);
  });

  it("numbers a repeated full name with the next free ordinal, the first keeping its name", () => {
    assert.deepStrictEqual(keyedNames(["a", "b", "a", "a (2)", "a"]), ["a", "b", "a (2)", "a (2) (2)", "a (3)"]);
    assert.deepStrictEqual(keyedNames([]), []);
  });

  it("accumulates module durations onto the file units", () => {
    const report = reportOf([
      makeModule({ file: "test/a.test.ts", duration: 100, tests: [makeTestCase()] }),
      makeModule({ file: "test/b.test.ts", duration: 200, tests: [makeTestCase()] }),
    ]);
    assert.deepStrictEqual(
      A.map(A.drop(report.units, 1), (unit) => O.getOrUndefined(unit.durationMs)),
      [100, 200]
    );
    assert.strictEqual(report.totals.collected, 2);
    assert.strictEqual(report.reason, "passed");
  });

  it("walks the parent chain into the suite path", () => {
    const outer = makeSuite({ name: "outer" });
    const inner = makeSuite({ name: "inner", parent: outer });
    const item = onlyItem(reportOf([makeModule({ tests: [makeTestCase({ name: "leaf", parent: inner })] })]));
    assert.deepStrictEqual(item.path, ["outer", "inner"]);
    assert.strictEqual(item.name, "leaf");
  });

  it("carries stray output a capture published into the report", () => {
    const stray = StrayOutput.make({ total: 1, stdout: 1, stderr: 0, bytes: 3, samples: [] });
    const report = reportOf([makeModule({ tests: [makeTestCase()] })], { strayOutput: O.some(stray) });
    assertSome(report.strayOutput, stray);
  });
});

describe("synthesizeEvents — stack frames", () => {
  const failing = (stacks: VitestError["stacks"]) =>
    onlyItem(
      reportOf([makeModule({ tests: [makeTestCase({ state: "failed", errors: [{ message: "boom", stacks }] })] })])
    );

  it("joins several string frames with newlines", () => {
    assertSome(stackOf(failing(["frame one", "frame two", "frame three"])), "frame one\nframe two\nframe three");
  });

  it("formats parsed frames as 'at <method> (<file>:<line>:<column>)'", () => {
    assertSome(
      stackOf(
        failing([
          { method: "anonymous", file: "src/math.test.ts", line: 10, column: 5 },
          { method: "Module._compile", file: "node:internal/modules/cjs/loader", line: 100, column: 12 },
        ])
      ),
      "at anonymous (src/math.test.ts:10:5)\nat Module._compile (node:internal/modules/cjs/loader:100:12)"
    );
  });

  it("falls back to '<anonymous>' when a parsed frame has no method", () => {
    assertSome(
      stackOf(failing([{ method: "", file: "src/x.ts", line: 1, column: 2 }])),
      "at <anonymous> (src/x.ts:1:2)"
    );
  });

  it("handles string and parsed frames mixed in one array", () => {
    assertSome(
      stackOf(failing(["raw frame string", { method: "fn", file: "f.ts", line: 3, column: 4 }])),
      "raw frame string\nat fn (f.ts:3:4)"
    );
  });

  it("locates a failure at its top frame outside framework code, relative to the package", () => {
    const item = failing([
      { method: "expect", file: "/repo/node_modules/vitest/dist/index.js", line: 1, column: 1 },
      { method: "adds", file: `${ROOT}/test/math.test.ts`, line: 12, column: 7 },
    ]);
    assertSome(
      O.map(item.location, (location) => [location.file, location.line, location.column]),
      ["test/math.test.ts", 12, 7]
    );
    assertSome(O.map(item.signature, Str.isNonEmpty), true);
  });

  it("records no location and no signature when every frame is framework code", () => {
    const item = failing([{ method: "run", file: "node:internal/process", line: 3, column: 1 }]);
    assertNone(item.location);
    assertNone(item.signature);
  });
});

describe("synthesizeEvents — missing results and diagnostics", () => {
  it("records a test whose diagnostic() is undefined without a duration", () => {
    const report = reportOf([
      makeModule({
        tests: [
          makeTestCase({ name: "skipped", state: "skipped", noDiagnostic: true }),
          makeTestCase({ name: "passing", duration: 20 }),
        ],
      }),
    ]);
    assert.strictEqual(report.totals.collected, 2);
    assert.strictEqual(report.totals.passed, 1);
    assert.strictEqual(report.totals.skipped, 1);
    assert.deepStrictEqual(
      A.map(report.items, (item) => O.getOrUndefined(item.durationMs)),
      [undefined, 20]
    );
  });

  it("records a test whose result() is undefined (pending) as skipped", () => {
    const report = reportOf([
      makeModule({ tests: [makeTestCase({ name: "pending", noResult: true }), makeTestCase({ name: "passing" })] }),
    ]);
    assert.strictEqual(report.totals.skipped, 1);
    assert.strictEqual(report.totals.passed, 1);
    assert.strictEqual(report.reason, "passed");
  });

  it("gives a module whose diagnostic() is undefined a zero duration", () => {
    const report = reportOf([makeModule({ noDiagnostic: true, tests: [makeTestCase()] })]);
    assertSome(
      pipe(
        A.get(report.units, 1),
        O.flatMap((unit) => unit.durationMs)
      ),
      0
    );
  });

  it("records a pending state as skipped, never as a failure", () => {
    const report = reportOf([
      makeModule({ tests: [makeTestCase({ name: "pending", state: "pending" }), makeTestCase({ name: "passing" })] }),
    ]);
    assert.strictEqual(report.totals.skipped, 1);
    assert.strictEqual(report.totals.failed, 0);
    assert.strictEqual(report.outcome, "all-pass");
  });

  it("normalizes an unknown state to skipped", () => {
    const report = reportOf([makeModule({ tests: [makeTestCase({ state: "some-unknown-state" })] })]);
    assert.strictEqual(report.totals.skipped, 1);
    assert.strictEqual(report.totals.passed, 0);
    assert.strictEqual(report.totals.failed, 0);
    assert.strictEqual(normalizeState(undefined), "skipped");
    assert.strictEqual(normalizeState("todo"), "skipped");
  });

  it("records per-attempt outcomes when the runner retried a test", () => {
    const item = onlyItem(reportOf([makeModule({ tests: [makeTestCase({ attempts: ["failed", "passed"] })] })]));
    assertSome(item.attempts, ["failed", "passed"]);
    assertNone(onlyItem(reportOf([makeModule({ tests: [makeTestCase({ attempts: ["passed"] })] })])).attempts);
  });
});

describe("synthesizeEvents — failures", () => {
  it("records a failed test's message and diff", () => {
    const item = onlyItem(
      reportOf(
        [
          makeModule({
            tests: [makeTestCase({ state: "failed", errors: [{ message: "expected 1 to be 2", diff: "- 2\n+ 1" }] })],
          }),
        ],
        { reason: "failed" }
      )
    );
    assert.strictEqual(item.outcome, "failed");
    assertSome(item.failureKind, "assertion");
    assertSome(
      O.map(item.detail, (detail) => [detail.message, O.getOrUndefined(detail.diff)]),
      ["expected 1 to be 2", "- 2\n+ 1"]
    );
  });

  it("marks a Vitest timeout as a timeout, not an assertion", () => {
    const report = reportOf(
      [
        makeModule({
          tests: [makeTestCase({ state: "failed", errors: [{ message: "Test timed out in 5000ms." }] })],
        }),
      ],
      { reason: "failed" }
    );
    assertSome(onlyItem(report).failureKind, "timeout");
    assert.strictEqual(report.totals.timedOut, 1);
    assert.isTrue(isTimeoutError({ name: "TimeoutError", message: "slow" }));
    assert.isFalse(isTimeoutError({ message: "expected 1 to be 2" }));
  });

  // Ported from vitest-agent packages/sdk/__test__/detect-timeout.test.ts at 1cf1ab94 (MIT).
  it("matches a hook-timeout message", () => {
    assert.isTrue(isTimeoutError({ message: "Hook timed out in 10000ms." }));
  });

  it("is case-insensitive on the message", () => {
    assert.isTrue(isTimeoutError({ message: "TEST TIMED OUT IN 5000MS" }));
  });

  it("does not match when the message is undefined", () => {
    assert.isFalse(isTimeoutError({}));
  });

  it("captures unhandled errors as their own items", () => {
    const report = reportOf([], {
      unhandledErrors: [{ message: "global crash", stacks: ["at top-level"] }],
      reason: "interrupted",
    });
    const item = onlyItem(report);
    assertSome(item.failureKind, "unhandled");
    assertSome(stackOf(item), "at top-level");
    assert.strictEqual(report.reason, "cancelled");
  });

  it("survives an error whose message getter throws at the property access", () => {
    const hostile: VitestError = {
      get message(): string {
        throw new TypeError("this.cause.toString is not a function");
      },
    };
    const report = reportOf([makeModule({ file: "test/hostile.test.ts", state: "failed", errors: [hostile] })], {
      reason: "failed",
    });
    assertSome(
      O.map(onlyItem(report).detail, (detail) => detail.message),
      UNREADABLE_FIELD
    );
  });

  it("records an error that has no message", () => {
    const report = reportOf([makeModule({ state: "failed", errors: [{ stack: "at x (y.ts:1:2)" }] })]);
    assertSome(
      O.map(onlyItem(report).detail, (detail) => detail.message),
      "<missing message>"
    );
  });
});

describe("synthesizeEvents — suite-level failures", () => {
  it("records a module that failed to load as a load fault, collecting nothing", () => {
    const report = reportOf(
      [
        makeModule({
          file: "test/text-utils.test.ts",
          state: "failed",
          errors: [{ message: "Cannot find module '../src/text-utils.js'" }],
        }),
      ],
      { reason: "failed" }
    );
    const item = onlyItem(report);
    assert.strictEqual(item.name, SUITE_LOAD_FAILURE_LABEL);
    assertSome(item.failureKind, "load");
    assert.strictEqual(report.totals.loadFailed, 1);
    assert.strictEqual(report.totals.failed, 0);
    assert.strictEqual(report.reason, "failed", "a load failure reads the same alone as beside other modules");
  });

  it("fails a module whose afterAll hook threw even though every test passed", () => {
    const report = reportOf([
      makeModule({
        file: "test/hooky.test.ts",
        tests: [makeTestCase({ name: "t1" })],
        suites: [makeSuite({ state: "failed", errors: [{ message: "AsyncFiberError: ..." }] })],
      }),
    ]);
    const fault = A.filter(report.items, (item) => item.name === SUITE_FAILURE_LABEL);
    assert.strictEqual(fault.length, 1);
    assert.strictEqual(report.totals.hookFailed, 1);
    assert.strictEqual(report.outcome, "some-fail");
  });

  it("keeps every hook error of a module, each its own fault", () => {
    const report = reportOf([
      makeModule({
        file: "test/hooks.test.ts",
        tests: [makeTestCase({ name: "t1" })],
        errors: [{ message: "beforeAll threw" }],
        suites: [makeSuite({ state: "failed", errors: [{ message: "afterAll threw" }] })],
      }),
    ]);
    const faults = A.filter(report.items, (item) => O.exists(item.failureKind, (kind) => kind === "hook"));
    assert.deepStrictEqual(
      A.map(faults, (item) => [item.name, O.getOrUndefined(O.map(item.detail, (detail) => detail.message))]),
      [
        [SUITE_FAILURE_LABEL, "beforeAll threw"],
        [`${SUITE_FAILURE_LABEL} (2)`, "afterAll threw"],
      ]
    );
    assert.strictEqual(report.totals.hookFailed, 2);
  });

  it("records at most the bound of faults per module and counts the rest in the last", () => {
    const errors = A.makeBy(MAX_UNIT_FAULTS + 2, (index) => ({ message: `load error ${index + 1}` }));
    const report = reportOf([makeModule({ file: "test/many.test.ts", state: "failed", errors })], {
      reason: "failed",
    });
    assert.strictEqual(report.items.length, MAX_UNIT_FAULTS);
    assert.strictEqual(report.totals.loadFailed, MAX_UNIT_FAULTS);
    const last = pipe(
      A.last(report.items),
      O.flatMap((item) => item.detail),
      O.map((detail) => detail.message)
    );
    assertSome(last, `load error ${MAX_UNIT_FAULTS}\n2 more errors in this module not recorded`);
  });

  it("fails a module in state failed with empty errors() and only passing tests", () => {
    const report = reportOf([makeModule({ file: "test/hooky2.test.ts", state: "failed", tests: [makeTestCase()] })]);
    assert.strictEqual(report.totals.hookFailed, 1);
    assert.isTrue(
      A.some(report.items, (item) =>
        O.exists(item.detail, (detail) => detail.message === "the module failed without an error")
      )
    );
  });

  it("does not add a fault when a failed test already explains a failed module", () => {
    const report = reportOf(
      [makeModule({ state: "failed", tests: [makeTestCase({ state: "failed", errors: [{ message: "x" }] })] })],
      { reason: "failed" }
    );
    assert.strictEqual(report.totals.failed, 1);
    assert.strictEqual(report.totals.hookFailed + report.totals.loadFailed, 0);
  });

  it("fails the run when one module of several failed to load", () => {
    const report = reportOf([
      makeModule({
        file: "test/broken.test.ts",
        state: "failed",
        errors: [{ message: "Cannot find module './nope.js'" }],
      }),
      makeModule({ file: "test/fine.test.ts", tests: [makeTestCase({ name: "ok" })] }),
    ]);
    assert.strictEqual(report.outcome, "some-fail");
    assert.strictEqual(report.totals.loadFailed, 1);
  });
});

describe("runReasonOf", () => {
  it("maps Vitest's end reasons onto run reasons", () => {
    assert.deepStrictEqual(A.map(["passed", "failed", "interrupted", "later"], runReasonOf), [
      "passed",
      "failed",
      "cancelled",
      "failed",
    ]);
  });
});

describe("synthesizeEvents — reported objects that throw", () => {
  const boom = (): never => {
    throw new TypeError("reported object is gone");
  };

  it("reads a module and tests whose accessors throw as empty, never failing the synthesis", () => {
    const hostileTest: VitestTestCase = {
      type: "test",
      name: "hostile",
      fullName: "hostile",
      result: boom,
      diagnostic: boom,
      attempts: boom,
    };
    const hostileSuites: VitestModule = {
      ...makeModule({ file: "test/suites.test.ts", tests: [hostileTest] }),
      state: boom,
      children: { allTests: () => [hostileTest], allSuites: boom },
      errors: boom,
      diagnostic: boom,
    };
    const hostileTests: VitestModule = {
      ...makeModule({ file: "test/tests.test.ts" }),
      children: { allTests: boom, allSuites: () => [makeSuite({ state: "failed" })] },
    };
    const report = reportOf([hostileSuites, hostileTests]);
    const item = onlyItem({ ...report, items: A.filter(report.items, (entry) => entry.name === "hostile") });
    assert.strictEqual(item.outcome, "skipped");
    assertNone(item.durationMs);
    assertNone(item.attempts);
    assert.strictEqual(report.totals.loadFailed, 1);
  });

  it("reads a test without attempts() and a suite without errors(), as older Vitest reporters hand them, as having none", () => {
    const bare: VitestTestCase = {
      type: "test",
      name: "bare",
      fullName: "bare",
      result: () => ({ state: "passed" }),
      diagnostic: () => ({ duration: 3 }),
    };
    const suite: VitestSuite = { type: "suite", name: "s", state: () => "passed" };
    const report = reportOf([makeModule({ tests: [bare], suites: [suite] })]);
    assertNone(onlyItem(report).attempts);
    assert.strictEqual(report.outcome, "all-pass");
    assert.strictEqual(report.totals.hookFailed, 0);
  });

  it("tolerates a suite whose errors() and state() throw", () => {
    const suite: VitestSuite = { type: "suite", name: "s", state: boom, errors: boom };
    const report = reportOf([makeModule({ tests: [makeTestCase()], suites: [suite] })]);
    assert.strictEqual(report.outcome, "all-pass");
  });
});
