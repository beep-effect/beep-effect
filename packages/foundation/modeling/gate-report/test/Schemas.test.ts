// Ported from vitest-agent 1cf1ab94 packages/sdk/__test__/{Common,AgentReport,RunEvent,RenderState}.test.ts (MIT).
import { GateEvent } from "@beep/gate-report/GateEvent";
import { GateReport, Totals, Unit } from "@beep/gate-report/GateReport";
import { Item, ItemDetail } from "@beep/gate-report/Item";
import { HistoryLabel, ItemOutcome, RunReason } from "@beep/gate-report/Vocabulary";
import { assert, describe, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { decodes, makeReport } from "./support/builders.ts";

const accepts = <T, E>(schema: S.Codec<T, E>, input: unknown): boolean => O.isSome(decodes(schema)(input));

const item = {
  key: { _tag: "TestKey", file: "src/a.test.ts", fullName: "adds" },
  unit: "src/a.test.ts",
  path: [],
  name: "adds",
  outcome: "passed",
};

const totals = {
  collected: 3,
  passed: 3,
  failed: 0,
  warned: 0,
  skipped: 0,
  timedOut: 0,
  loadFailed: 0,
  hookFailed: 0,
  unhandled: 0,
  errored: 0,
  durationMs: 12,
};

const report = {
  gate: "test",
  subject: "@beep/glob",
  itemKind: "test",
  runId: "r1",
  startedAt: "2026-11-19T10:00:00.000Z",
  durationMs: 12,
  inputFingerprint: "x",
  reason: "passed",
  outcome: "all-pass",
  units: [],
  items: [],
  totals,
};

describe("widened schemas retargeted from vitest-agent 1cf1ab94 Common, AgentReport, RunEvent and RenderState tests", () => {
  it("ItemOutcome accepts its members and rejects pending and unknown values", () => {
    for (const value of ["passed", "failed", "warned", "skipped"])
      assert.isTrue(
        accepts(ItemOutcome, value),
        "the console, package-manager, environment, executor and detail-level sets are not in this package"
      );
    for (const value of ["pending", "unknown", 1]) assert.isFalse(accepts(ItemOutcome, value));
  });

  it("RunReason accepts its members and rejects interrupted", () => {
    for (const value of ["passed", "failed", "errored", "cancelled"]) assert.isTrue(accepts(RunReason, value));
    assert.isFalse(accepts(RunReason, "interrupted"));
  });

  it("HistoryLabel accepts its members and rejects stable and new-failure", () => {
    for (const value of HistoryLabel.literals) assert.isTrue(accepts(HistoryLabel, value));
    for (const value of ["stable", "new-failure"]) assert.isFalse(accepts(HistoryLabel, value));
  });
});

describe("ItemDetail (ReportError retargeted)", () => {
  it("accepts a minimal detail with only a message, and a full one", () => {
    assert.isTrue(accepts(ItemDetail, { message: "boom" }));
    assert.isTrue(accepts(ItemDetail, { message: "boom", diff: "- a\n+ b", stack: "at f" }));
  });

  it("rejects a missing or non-string message", () => {
    assert.isFalse(accepts(ItemDetail, {}));
    assert.isFalse(accepts(ItemDetail, { message: 1 }));
  });
});

describe("Totals (ReportSummary retargeted)", () => {
  it("accepts valid totals and defaults missing counts to zero when constructed", () => {
    assert.isTrue(accepts(Totals, totals));
    assert.strictEqual(Totals.make({}).timedOut, 0);
    assert.strictEqual(Totals.make({}).durationMs, 0);
  });

  it("rejects missing fields and negative or fractional counts", () => {
    assert.isFalse(accepts(Totals, { passed: 1 }));
    assert.isFalse(accepts(Totals, { ...totals, failed: -1 }));
    assert.isFalse(accepts(Totals, { ...totals, failed: 1.5 }));
  });
});

describe("Item (TestReport retargeted)", () => {
  it("accepts a minimal item and a full one", () => {
    assert.isTrue(accepts(Item, item));
    assert.isTrue(
      accepts(Item, {
        ...item,
        outcome: "failed",
        location: { file: "src/a.test.ts", line: 3, column: 1 },
        detail: { message: "x", diff: "d" },
        code: "TS1",
        rule: "r",
        severity: "error",
        failureKind: "timeout",
        signature: "0123456789abcdef",
        attempts: ["failed", "passed"],
        durationMs: 4,
        label: "flaky",
      })
    );
  });

  it("rejects an invalid outcome, an invalid label and empty attempts", () => {
    assert.isFalse(accepts(Item, { ...item, outcome: "pending" }));
    assert.isFalse(accepts(Item, { ...item, label: "stable" }));
    assert.isFalse(accepts(Item, { ...item, attempts: [] }));
  });

  it("rejects a zero line number", () => {
    assert.isFalse(accepts(Item, { ...item, location: { file: "a", line: 0, column: 1 } }));
  });
});

describe("Unit (ModuleReport retargeted)", () => {
  it("accepts a unit with and without a parent and duration", () => {
    assert.isTrue(accepts(Unit, { id: "src/a.test.ts", kind: "file" }));
    assert.isTrue(accepts(Unit, { id: "src/a.test.ts", kind: "file", parent: "@beep/glob", durationMs: 3 }));
  });

  it("rejects a missing kind and an empty id", () => {
    assert.isFalse(accepts(Unit, { id: "src/a.test.ts" }));
    assert.isFalse(accepts(Unit, { id: "", kind: "file" }));
  });
});

describe("GateReport (AgentReport retargeted)", () => {
  it("accepts a minimal report, one with a branch and head, one with a policy and one with items", () => {
    assert.isTrue(accepts(GateReport, report));
    assert.isTrue(accepts(GateReport, { ...report, head: "abc", branch: "main" }));
    assert.isTrue(
      accepts(GateReport, { ...report, policy: { breaches: [{ _tag: "ErrorBudgetBreach", budget: 0, actual: 1 }] } })
    );
    assert.isTrue(accepts(GateReport, { ...report, items: [item] }));
    assert.isTrue(S.is(GateReport)(makeReport()));
  });

  it("rejects an invalid reason and missing required fields", () => {
    assert.isFalse(accepts(GateReport, { ...report, reason: "interrupted" }));
    assert.isFalse(accepts(GateReport, { ...report, startedAt: "Mon Jan 01 2026" }));
    assert.isFalse(accepts(GateReport, { gate: "test" }));
  });
});

describe("GateEvent (RunEvent retargeted)", () => {
  it("accepts an ItemFinished carrying a timed-out item and a RunFinished carrying the collected count", () => {
    assert.isTrue(
      accepts(GateEvent, { _tag: "ItemFinished", item: { ...item, outcome: "failed", failureKind: "timeout" } })
    );
    assert.isTrue(accepts(GateEvent, { _tag: "RunFinished", durationMs: 1, reason: "passed", collected: 4 }));
  });

  it("rejects an unknown event tag and a unit fault of a non-unit kind", () => {
    assert.isFalse(accepts(GateEvent, { _tag: "TrendComputed", direction: "stable", runCount: 1 }));
    assert.isFalse(
      accepts(GateEvent, { _tag: "UnitFaulted", unit: "u", kind: "timeout", name: "n", detail: { message: "m" } })
    );
  });
});
