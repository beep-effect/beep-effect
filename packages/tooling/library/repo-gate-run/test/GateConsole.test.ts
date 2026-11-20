import { ConsoleBudget, RecordPaths, RunDelta } from "@beep/gate-report/ConsoleDocument";
import { GateReport } from "@beep/gate-report/GateReport";
import { reduceEvents } from "@beep/gate-report/Reducer";
import { buildClosureCommand, foldFixesFor, WORKSPACE_SUBJECT } from "@beep/repo-gate-run/ConsoleDefaults";
import {
  ConsoleRequest,
  ConsoleSettings,
  GateConsole,
  makeGateConsole,
  ProgressSnapshot,
} from "@beep/repo-gate-run/GateConsole";
import { Omission, omissionLines } from "@beep/repo-gate-run/Omission";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import {
  agentConsole,
  checkRunEvents,
  linesOf,
  stripTerminal,
  terminalConsole,
  testRunEvents,
} from "./support/fixtures.ts";
import type { GateEvent } from "@beep/gate-report/GateEvent";

const reportOf = (events: ReadonlyArray<GateEvent>): GateReport =>
  Result.getOrThrowWith(reduceEvents(events), (error) => error);

const paths = RecordPaths.make({
  record: "packages/foundation/primitive/glob/.beep/gates/test/report.json",
  log: "packages/foundation/primitive/glob/.beep/gates/test/report.log",
  logBytes: 2048,
});

describe("GateConsole", () => {
  it("one renderer serves the test gate and the check gate", () => {
    const test = linesOf(
      agentConsole.render(ConsoleRequest.make({ report: reportOf(testRunEvents(["adds"])), paths: O.some(paths) })).text
    );
    const check = linesOf(agentConsole.render(ConsoleRequest.make({ report: reportOf(checkRunEvents) })).text);
    assert.strictEqual(test[0], "test @beep/glob src/math.test.ts: FAILED, 2/3 passed, 1 failed (1.2s)");
    assert.strictEqual(test[0], A.lastNonEmpty(test));
    assert.include(test, "- src/math.test.ts:12:5 > math > adds");
    assert.include(
      test,
      "record: packages/foundation/primitive/glob/.beep/gates/test/report.json | log: packages/foundation/primitive/glob/.beep/gates/test/report.log (2 KB)"
    );
    assert.strictEqual(check[0], "check @beep/glob: FAILED, 2 errors, 0 warnings, 1 unit checked (900ms)");
    assert.include(check, "- src/a.ts:3:7 TS2322 > Type 'string' is not assignable to type 'number'.");
    assert.include(check, "- src/b.ts:9:1 TS2304 > Cannot find name 'missing'.");
    assert.include(check, "next: bun run beep gate show check");
  });

  it("a green run is its verdict line alone, the delta as its suffix", () => {
    const output = agentConsole.render(
      ConsoleRequest.make({
        report: reportOf(testRunEvents([])),
        delta: RunDelta.makeOption({ fixed: 1, stillFailing: 0, new: 0 }),
      })
    );
    assert.strictEqual(output.projection, "agent");
    assert.strictEqual(
      output.text,
      "test @beep/glob src/math.test.ts: PASSED, 3/3 passed (1.2s) (1 fixed since last run)"
    );
  });

  it("the terminal projection paints the same lines after clearing the progress line", () => {
    const request = ConsoleRequest.make({ report: reportOf(testRunEvents(["adds"])), paths: O.some(paths) });
    const terminal = terminalConsole.render(request);
    assert.strictEqual(terminal.projection, "terminal");
    assert.isTrue(Str.startsWith("\r\u001b[2K")(terminal.text));
    assert.include(terminal.text, "\u001b[");
    assert.strictEqual(stripTerminal(terminal.text), agentConsole.render(request).text);
  });

  it("names what was not written on one line before the closing verdict", () => {
    const omissions = [
      Omission.make({ part: "record", reason: "disk full" }),
      Omission.make({ part: "log", reason: "disk full\nretry later" }),
      Omission.make({ part: "history", reason: "deadline missed" }),
    ];
    const lines = linesOf(
      agentConsole.render(ConsoleRequest.make({ report: reportOf(testRunEvents([])), omissions })).text
    );
    assert.deepStrictEqual(A.drop(lines, 1), [
      "record and raw log unavailable: disk full",
      "history not read: deadline missed",
      "test @beep/glob src/math.test.ts: PASSED, 3/3 passed (1.2s)",
    ]);
    assert.strictEqual(lines[0], A.lastNonEmpty(lines));
  });

  it("names a lone record or log failure and cuts a long reason to the line limit", () => {
    assert.deepStrictEqual(omissionLines([Omission.make({ part: "log", reason: "gone" })]), [
      "raw log unavailable: gone",
    ]);
    assert.deepStrictEqual(omissionLines([Omission.make({ part: "record", reason: "gone" })]), [
      "record unavailable: gone",
    ]);
    const long = Str.repeat(300)("x");
    const lines = linesOf(
      agentConsole.render(
        ConsoleRequest.make({
          report: reportOf(testRunEvents([])),
          omissions: [Omission.make({ part: "record", reason: long })],
        })
      ).text
    );
    assert.strictEqual(lines[1]?.length, 240);
    assert.isTrue(Str.endsWith("...")(lines[1] ?? ""));
  });

  it("keeps the whole budget when it cannot spare room for an omission line", () => {
    const tight = makeGateConsole(
      ConsoleSettings.make({
        audience: "agent",
        budget: ConsoleBudget.make({ maxChars: 328, maxLineChars: 40, maxDiffLines: 0 }),
      })
    );
    const lines = linesOf(
      tight.render(
        ConsoleRequest.make({
          report: reportOf(testRunEvents([])),
          omissions: [Omission.make({ part: "history", reason: "late" })],
        })
      ).text
    );
    assert.strictEqual(lines[1], "history not read: late");
    assert.strictEqual(buildClosureCommand(WORKSPACE_SUBJECT), "bun x turbo run build");
    assert.strictEqual(buildClosureCommand("@beep/glob"), "bun x turbo run build --filter=@beep/glob^...");
    assert.strictEqual(buildClosureCommand("glob"), "bun x turbo run build --filter=glob^...");
    assert.strictEqual(
      foldFixesFor("packages/foundation/modeling/glob").TS6305,
      "bun x turbo run build --filter=./packages/foundation/modeling/glob^..."
    );
  });

  it("keeps the whole console, omission lines included, within a minimum budget", () => {
    const minimum = ConsoleBudget.make({ maxChars: 328, maxLineChars: 40, maxDiffLines: 0 });
    const tight = makeGateConsole(ConsoleSettings.make({ audience: "agent", budget: minimum }));
    const omissions = A.map(["record", "log", "history"] as const, (part) =>
      Omission.make({ part, reason: Str.repeat(80)("r") })
    );
    const text = tight.render(
      ConsoleRequest.make({
        report: reportOf(testRunEvents(["adds", "subtracts", "divides"])),
        paths: O.some(paths),
        omissions,
      })
    ).text;
    const lines = linesOf(text);
    assert.isAtMost(text.length + 1, minimum.maxChars);
    assert.isTrue(A.some(lines, Str.startsWith("record and raw log unavailable: ")));
    assert.isTrue(A.some(lines, Str.startsWith("history not read: ")));
    assert.include(lines, "... 3 more in the record");
    assert.strictEqual(lines[0], A.lastNonEmpty(lines));
  });

  it("paints every verdict word and every line kind", () => {
    const red = terminalConsole.render(
      ConsoleRequest.make({
        report: GateReport.make({ ...reportOf(testRunEvents(["adds"])), reason: "errored" }),
        delta: RunDelta.makeOption({ fixed: 0, stillFailing: 1, new: 0 }),
        paths: O.some(paths),
        omissions: [Omission.make({ part: "history", reason: "late" })],
      })
    );
    const cancelled = terminalConsole.render(
      ConsoleRequest.make({
        report: GateReport.make({ ...reportOf(testRunEvents([])), reason: "cancelled", outcome: "interrupted" }),
      })
    );
    assert.include(stripTerminal(red.text), "since last run: 0 fixed, 1 still failing, 0 new");
    assert.include(stripTerminal(cancelled.text), "CANCELLED");
  });

  it("writes a live progress line for a person and nothing for an agent", () => {
    const snapshot = ProgressSnapshot.make({
      gate: "test",
      subject: "@beep/glob",
      done: 12,
      failed: 1,
      elapsedMs: 3400,
    });
    const frame = terminalConsole.progress(snapshot);
    assertSome(O.map(frame, stripTerminal), "test @beep/glob: running, 12 done, 1 failed (3.4s)");
    assert.isFalse(O.exists(frame, Str.includes("\n")));
    assertNone(agentConsole.progress(snapshot));
  });

  it.layer(GateConsole.layer(ConsoleSettings.make({ audience: "ci" })), { timeout: "30 seconds" })(
    "as a service",
    (it) => {
      it.effect("renders the agent projection under CI", () =>
        Effect.gen(function* () {
          const gateConsole = yield* GateConsole;
          const output = gateConsole.render(ConsoleRequest.make({ report: reportOf(testRunEvents([])) }));
          assert.strictEqual(output.projection, "agent");
        })
      );
    }
  );
});
