// Ports the upstream classifyTest table (vitest-agent 1cf1ab94,
// packages/sdk/src/utils/classify-test.ts) onto the gate-run-history rules:
// AC-H2 labels, AC-H3 the one flaky rule, AC-H4 recovered for one run and
// AC-H6 the fix-loop delta.
import { RunDelta } from "@beep/gate-report/ConsoleDocument";
import { Unit } from "@beep/gate-report/GateReport";
import {
  checkedUnitOf,
  classifyItem,
  DeltaFailure,
  DeltaRun,
  deltaOf,
  deltaRunOf,
  GateHistoryError,
  HistoryConfig,
  isFlaky,
  Observation,
  observedOutcomes,
  SeriesEvidence,
} from "@beep/gate-report/History";
import { fingerprint } from "@beep/gate-report/ItemKey";
import { deltaText } from "@beep/gate-report/PlainText";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FILE, makeReport, projectWith, testItem } from "./support/builders.ts";
import type { HistoryLabel, ItemOutcome } from "@beep/gate-report/Vocabulary";

type Seen = readonly [outcome: "passed" | "failed", input: string];

const observe = (origin: "local" | "hosted") => (seen: ReadonlyArray<Seen>) =>
  A.map(seen, ([outcome, inputFingerprint], attempt) =>
    Observation.make({
      runId: `r-${inputFingerprint}`,
      inputFingerprint,
      branch: origin === "local" ? "feature/a" : "main",
      origin,
      outcome,
      attempt,
      at: DateTime.makeUnsafe(0),
    })
  );

const local = observe("local");
const hosted = observe("hosted");

type Row = {
  readonly name: string;
  readonly outcome: ItemOutcome;
  readonly current: ReadonlyArray<Seen>;
  readonly lane: ReadonlyArray<Seen>;
  readonly main?: ReadonlyArray<Seen>;
  readonly label: HistoryLabel | undefined;
};

// The current run is input "now"; earlier lane runs are "l1" (newest) to "l3".
const rows: ReadonlyArray<Row> = [
  {
    name: "a retried pass is flaky",
    outcome: "passed",
    current: [
      ["failed", "now"],
      ["passed", "now"],
    ],
    lane: [],
    label: "flaky",
  },
  {
    name: "a retried failure is flaky",
    outcome: "failed",
    current: [
      ["passed", "now"],
      ["failed", "now"],
    ],
    lane: [],
    label: "flaky",
  },
  {
    name: "a fail on the lane's input that passed there before is flaky",
    outcome: "failed",
    current: [["failed", "l1"]],
    lane: [["passed", "l1"]],
    label: "flaky",
  },
  {
    name: "flaky beats red-on-main",
    outcome: "failed",
    current: [
      ["failed", "now"],
      ["passed", "now"],
    ],
    lane: [],
    main: [["failed", "m"]],
    label: "flaky",
  },
  {
    name: "main's own flake on its input is flaky",
    outcome: "failed",
    current: [["failed", "now"]],
    lane: [],
    main: [
      ["failed", "m"],
      ["passed", "m"],
    ],
    label: "flaky",
  },
  {
    name: "a red already on main",
    outcome: "failed",
    current: [["failed", "now"]],
    lane: [["passed", "l1"]],
    main: [["failed", "m"]],
    label: "red-on-main",
  },
  {
    name: "red-on-main beats persistent",
    outcome: "failed",
    current: [["failed", "now"]],
    lane: [["failed", "l1"]],
    main: [["failed", "m"]],
    label: "red-on-main",
  },
  {
    name: "the lane's newest run failed",
    outcome: "failed",
    current: [["failed", "now"]],
    lane: [
      ["failed", "l1"],
      ["passed", "l2"],
    ],
    label: "persistent",
  },
  {
    name: "persistent beats a main pass",
    outcome: "failed",
    current: [["failed", "now"]],
    lane: [["failed", "l1"]],
    main: [["passed", "m"]],
    label: "persistent",
  },
  {
    name: "main passed it",
    outcome: "failed",
    current: [["failed", "now"]],
    lane: [],
    main: [["passed", "m"]],
    label: "introduced-on-lane",
  },
  {
    name: "the lane passed it",
    outcome: "failed",
    current: [["failed", "now"]],
    lane: [["passed", "l1"]],
    label: "introduced-on-lane",
  },
  {
    name: "a pass older than the lane's newest run",
    outcome: "failed",
    current: [["failed", "now"]],
    lane: [
      ["passed", "l1"],
      ["failed", "l2"],
    ],
    label: "introduced-on-lane",
  },
  {
    name: "neither baseline nor lane evidence",
    outcome: "failed",
    current: [["failed", "now"]],
    lane: [],
    label: undefined,
  },
  {
    name: "a baseline that does not hold the item",
    outcome: "failed",
    current: [["failed", "now"]],
    lane: [],
    main: [],
    label: undefined,
  },
  {
    name: "the first green after a red",
    outcome: "passed",
    current: [["passed", "now"]],
    lane: [["failed", "l1"]],
    label: "recovered",
  },
  {
    name: "a green after a green",
    outcome: "passed",
    current: [["passed", "now"]],
    lane: [
      ["passed", "l1"],
      ["failed", "l2"],
    ],
    label: undefined,
  },
  { name: "a first green", outcome: "passed", current: [["passed", "now"]], lane: [], label: undefined },
  { name: "a warning", outcome: "warned", current: [], lane: [["failed", "l1"]], label: undefined },
  { name: "a skip", outcome: "skipped", current: [], lane: [["failed", "l1"]], label: undefined },
];

describe("classifyItem (AC-H2)", () => {
  it.each(rows)("$name", (row) => {
    const evidence = SeriesEvidence.make({
      current: local(row.current),
      lane: local(row.lane),
      main: O.map(O.fromUndefinedOr(row.main), hosted),
    });
    assert.deepStrictEqual(O.getOrUndefined(classifyItem(row.outcome, evidence)), row.label);
  });
});

describe("isFlaky (AC-H3)", () => {
  it("one input with a fail and a pass is flaky", () => {
    assert.isTrue(
      isFlaky(
        local([
          ["failed", "x"],
          ["passed", "x"],
        ])
      )
    );
  });

  it("a fail and a pass on two inputs are a code change", () => {
    assert.isFalse(
      isFlaky(
        local([
          ["failed", "x"],
          ["passed", "y"],
        ])
      )
    );
    assert.isFalse(isFlaky([]));
  });
});

describe("recovered holds one run (AC-H4)", () => {
  it("after red, green, green only the first green is recovered", () => {
    const first = classifyItem(
      "passed",
      SeriesEvidence.make({ current: local([["passed", "g1"]]), lane: local([["failed", "r"]]) })
    );
    const second = classifyItem(
      "passed",
      SeriesEvidence.make({
        current: local([["passed", "g2"]]),
        lane: local([
          ["passed", "g1"],
          ["failed", "r"],
        ]),
      })
    );
    assertSome(first, "recovered");
    assertSome(
      classifyItem(SeriesEvidence.make({ current: [], lane: local([["failed", "r"]]) }))("passed"),
      "recovered"
    );
    assertNone(second);
  });
});

describe("observedOutcomes", () => {
  it("reads each retry attempt, else the outcome, and records no warning or skip", () => {
    assert.deepStrictEqual(
      observedOutcomes(testItem({ name: "a", outcome: "passed", attempts: O.some(["failed", "warned", "passed"]) })),
      ["failed", "passed"]
    );
    assert.deepStrictEqual(observedOutcomes(testItem({ name: "a", outcome: "failed" })), ["failed"]);
    assert.deepStrictEqual(observedOutcomes(testItem({ name: "a", outcome: "skipped" })), []);
  });
});

const failure = (key: string, unit = "u1") => DeltaFailure.make({ fingerprint: key, unit });

describe("deltaOf (AC-H6)", () => {
  const before = DeltaRun.make({ units: ["u1", "u2"], failed: [failure("a"), failure("b"), failure("c", "u2")] });

  it("counts fixed, still failing and new over the units both runs checked", () => {
    const after = DeltaRun.make({ units: ["u1", "u2"], failed: [failure("b"), failure("d"), failure("e", "u2")] });
    assert.strictEqual(deltaText(deltaOf(before, after)), "since last run: 2 fixed, 1 still failing, 2 new");
  });

  it("a re-run over fewer units counts only the shared units and says the scope differs", () => {
    const after = DeltaRun.make({ units: ["u1"], failed: [failure("a")] });
    assert.strictEqual(
      deltaText(deltaOf(before, after)),
      "since last run: 1 fixed, 1 still failing, 0 new (scope differs)"
    );
    const wider = DeltaRun.make({ units: ["u1", "u2", "u3"], failed: [failure("z", "u3")] });
    assert.isTrue(deltaOf(before, wider).scopeDiffers);
  });

  it("a green re-run after a red carries the fixed suffix on its one line", () => {
    const red = makeReport({
      units: [Unit.make({ id: FILE, kind: "file" })],
      items: [testItem({ name: "adds", outcome: "failed" }), testItem({ name: "subtracts", outcome: "failed" })],
      reason: "failed",
      outcome: "some-fail",
    });
    const green = makeReport({
      units: [Unit.make({ id: FILE, kind: "file" })],
      items: [testItem({ name: "adds", outcome: "passed" }), testItem({ name: "subtracts", outcome: "passed" })],
    });
    const delta = deltaOf(deltaRunOf(red), deltaRunOf(green));
    assert.deepStrictEqual(delta, RunDelta.make({ fixed: 2, stillFailing: 0, new: 0 }));
    assert.deepStrictEqual(deltaOf(deltaRunOf(green))(deltaRunOf(red)), delta);
    const lines = projectWith({ report: green, delta });
    assert.strictEqual(lines.length, 1);
    assert.isTrue(Str.endsWith(" (2 fixed since last run)")(lines[0] ?? ""));
  });

  it("does not count a failure that is skipped or warned now as fixed, and counts one that is gone", () => {
    const red = makeReport({
      units: [Unit.make({ id: FILE, kind: "file" })],
      items: A.map(["skips", "warns", "leaves"], (name) => testItem({ name, outcome: "failed" })),
      reason: "failed",
      outcome: "some-fail",
    });
    const after = deltaRunOf(
      makeReport({
        units: [Unit.make({ id: FILE, kind: "file" })],
        items: [testItem({ name: "skips", outcome: "skipped" }), testItem({ name: "warns", outcome: "warned" })],
      })
    );
    assert.strictEqual(after.unobserved.length, 2);
    assert.deepStrictEqual(deltaOf(deltaRunOf(red), after), RunDelta.make({ fixed: 1, stillFailing: 0, new: 0 }));
  });

  it("reads a report's failed items by key fingerprint and unit", () => {
    const item = testItem({ name: "adds", outcome: "failed" });
    const run = deltaRunOf(makeReport({ items: [item, testItem({ name: "subtracts", outcome: "passed" })] }));
    assert.deepStrictEqual(run.failed, [failure(fingerprint(item.key), FILE)]);
  });
});

describe("checkedUnitOf", () => {
  const item = testItem({ name: "adds", outcome: "failed" });
  const pkg = (id: string) => Unit.make({ id, kind: "package" });

  it("keeps a declared unit, else the one package unit, else the item's unit", () => {
    assert.strictEqual(checkedUnitOf(makeReport({ units: [Unit.make({ id: FILE, kind: "file" })] }), item), FILE);
    assert.strictEqual(checkedUnitOf(makeReport({ units: [pkg("@beep/glob")] }), item), "@beep/glob");
    assert.strictEqual(checkedUnitOf(item)(makeReport({ units: [pkg("@beep/a"), pkg("@beep/b")] })), FILE);
  });
});

describe("history configuration and error", () => {
  it("defaults the window to 10, retention to 200, the deadline to 250 ms and retry to 5 from 50 ms", () => {
    const config = HistoryConfig.make({});
    assert.deepStrictEqual(
      [config.window, config.retainRuns, config.deadlineMs, config.retryAttempts, config.retryBaseMs],
      [10, 200, 250, 5, 50]
    );
    assert.isFalse(S.is(HistoryConfig)({ ...config, window: 0 }));
  });

  it("carries a reason from the closed domain", () => {
    assert.strictEqual(GateHistoryError.make({ reason: "read-deadline", message: "late" }).reason, "read-deadline");
  });
});
