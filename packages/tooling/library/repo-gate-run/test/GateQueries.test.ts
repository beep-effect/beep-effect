import { GateRecord } from "@beep/gate-report/GateRecord";
import { GateReport, Totals } from "@beep/gate-report/GateReport";
import { Item, ItemDetail } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import {
  GateQueries,
  GateQueryError,
  ItemQuery,
  ItemSelector,
  itemLines,
  RunQuery,
  RunScope,
} from "@beep/repo-gate-run/GateQueries";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { epoch, failedTest } from "./support/fixtures.ts";

const fullItem = Item.make({
  key: ItemKey.cases.TestKey.make({ file: "src/math.test.ts", fullName: "math > divides" }),
  unit: "src/math.test.ts",
  path: ["math"],
  name: "divides",
  outcome: "failed",
  failureKind: O.some("timeout"),
  rule: O.some("vitest/timeout"),
  code: O.some("E1"),
  label: O.some("flaky"),
  signature: O.some("abc123"),
  attempts: O.some(["failed", "passed"]),
  durationMs: O.some(5000),
  detail: ItemDetail.makeOption({ message: "timed out\nafter 5s", diff: O.some("- a\n+ b"), stack: O.some("at x") }),
});

const recordOf = (runId: string) =>
  GateRecord.make({
    generatedAt: epoch,
    report: GateReport.make({
      gate: "test",
      subject: "@beep/glob",
      itemKind: "test",
      runId,
      startedAt: epoch,
      durationMs: 10,
      inputFingerprint: "x",
      reason: "failed",
      outcome: "some-fail",
      units: [],
      items: [
        Item.make({ ...failedTest("skips"), outcome: "skipped", detail: O.none(), location: O.none() }),
        Item.make({ ...failedTest("adds"), outcome: "passed", detail: O.none(), location: O.none() }),
        failedTest("subtracts"),
        fullItem,
      ],
      totals: Totals.make({ collected: 3, passed: 1, failed: 2 }),
    }),
  });

const seeded = Layer.effectDiscard(
  Effect.gen(function* () {
    const store = yield* GateRecordStore;
    yield* store.writeRecord(
      RecordTarget.cases.PackageTarget.make({ packageDir: "packages/glob", gate: "test" }),
      recordOf("p1")
    );
    yield* store.writeRecord(RecordTarget.cases.RootTarget.make({ gate: "test", runId: "run-1" }), recordOf("run-1"));
    yield* store.writeRecord(RecordTarget.cases.RootTarget.make({ gate: "test", runId: "run-2" }), recordOf("run-2"));
  })
);

const queries = Layer.mergeAll(GateQueries.layer, seeded).pipe(Layer.provide(GateRecordStore.layerMemory));

const root = (runId?: string) =>
  RunQuery.make({ gate: "test", scope: RunScope.cases.RootRun.make({ runId: O.fromUndefinedOr(runId) }) });

describe("GateQueries", () => {
  it.layer(queries, { timeout: "30 seconds" })("over a seeded store", (it) => {
    it.effect("shows a package's run, a root run by id and the newest root run", () =>
      Effect.gen(function* () {
        const gate = yield* GateQueries;
        const packageRun = yield* gate.showRun(
          RunQuery.make({ gate: "test", scope: RunScope.cases.PackageRun.make({ packageDir: "packages/glob" }) })
        );
        const byId = yield* gate.showRun(root("run-1"));
        const newest = yield* gate.showRun(root());
        assert.strictEqual(packageRun.location.record, "packages/glob/.beep/gates/test/report.json");
        assert.strictEqual(byId.record.report.runId, "run-1");
        assert.strictEqual(newest.record.report.runId, "run-2");
      })
    );

    it.effect("shows one item in full by position among listed items or by text", () =>
      Effect.gen(function* () {
        const gate = yield* GateQueries;
        const second = yield* gate.showItem(
          ItemQuery.make({ run: root(), selector: ItemSelector.cases.ByPosition.make({ position: 2 }) })
        );
        const byText = yield* gate.showItem(
          ItemQuery.make({ run: root("run-1"), selector: ItemSelector.cases.ByText.make({ text: "subtracts" }) })
        );
        assert.strictEqual(
          second.item.name,
          "divides",
          "positions count failing and warning items only, so the skipped item ahead shifts nothing"
        );
        assert.strictEqual(second.runId, "run-2");
        assert.deepStrictEqual(second.lines, itemLines(fullItem));
        assert.strictEqual(byText.item.name, "subtracts");
      })
    );

    it.effect("reports a gate with no root runs and a selector that matches nothing", () =>
      Effect.gen(function* () {
        const gate = yield* GateQueries;
        const noRuns = yield* Effect.flip(
          gate.showRun(RunQuery.make({ gate: "check", scope: RunScope.cases.RootRun.make({}) }))
        );
        const noItem = yield* Effect.flip(
          gate.showItem(ItemQuery.make({ run: root(), selector: ItemSelector.cases.ByPosition.make({ position: 9 }) }))
        );
        assert.instanceOf(noRuns, GateQueryError);
        assert.strictEqual(noRuns._tag === "GateQueryError" && noRuns.miss, "no-runs");
        assert.strictEqual(noItem._tag === "GateQueryError" && noItem.miss, "no-item");
      })
    );
  });

  it("an item's full text holds every field and the whole message, diff and stack", () => {
    assert.deepStrictEqual(itemLines(fullItem), [
      "src/math.test.ts > math > divides",
      "outcome: failed (timeout)",
      "code: E1",
      "rule: vitest/timeout",
      "label: flaky",
      "signature: abc123",
      "attempts: failed, passed",
      "duration: 5s",
      "message:",
      "  timed out",
      "  after 5s",
      "diff:",
      "  - a",
      "  + b",
      "stack:",
      "  at x",
    ]);
    assert.include(itemLines(failedTest("adds")), "location: src/math.test.ts:12:5");
  });
});
