import { FoldResult } from "@beep/gate-report/CauseFold";
import { CellContext, ConsoleInput, dispatchTable } from "@beep/gate-report/Dispatch";
import { GateReport, Totals } from "@beep/gate-report/GateReport";
import { RunOutcome, RunShape } from "@beep/gate-report/Vocabulary";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { ConsoleRequest, ConsoleSettings, makeGateConsole } from "@beep/repo-gate-run/GateConsole";
import {
  CommandStatus,
  commandText,
  PointerLineError,
  repoCommands,
  repoGateCommands,
  repoGateCommandsFor,
  repoPointerTable,
  repoPointerTableFor,
  verifyPointerLine,
} from "@beep/repo-gate-run/RepoPointers";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { agentConsole, epoch, failedTest, linesOf } from "./support/fixtures.ts";
import type { RepoCommand } from "@beep/repo-gate-run/RepoPointers";

const GATES = ["test", "check"] as const;

const mcpToolSpelledInParts = (...parts: ReadonlyArray<string>): string => A.join(parts, "_");
const upstreamTools = [
  mcpToolSpelledInParts("test", "errors"),
  mcpToolSpelledInParts("failure", "signature", "get"),
  mcpToolSpelledInParts("file", "coverage"),
  mcpToolSpelledInParts("test", "coverage"),
];

const reportFor = (gate: string) =>
  GateReport.make({
    gate,
    subject: "@beep/glob",
    itemKind: gate === "check" ? "diagnostic" : "test",
    runId: "r1",
    startedAt: epoch,
    durationMs: 10,
    inputFingerprint: "x",
    reason: "failed",
    outcome: "some-fail",
    units: [],
    items: [failedTest("adds")],
    totals: Totals.make({ collected: 1, failed: 1 }),
  });

const pointerLines = A.flatMap(GATES, (gate) =>
  A.flatMap(RunShape.literals, (shape) =>
    A.flatMap(RunOutcome.literals, (outcome) => {
      const report = GateReport.make({ ...reportFor(gate), outcome });
      const input = ConsoleInput.make({ report, pointers: repoPointerTable });
      const document = dispatchTable[shape][outcome](
        CellContext.make({ input, fold: FoldResult.make({ folds: [], rest: report.items }) })
      );
      return A.fromOption(O.map(document.pointer, (pointer) => `next: ${A.join(pointer.commands, "; ")}`));
    })
  )
);

describe("AC-L9: next steps are commands", () => {
  it("every pointer line of every cell names only commands from the pointer table", () => {
    assert.strictEqual(pointerLines.length, GATES.length * RunShape.literals.length * (RunOutcome.literals.length - 1));
    const refused = A.filter(pointerLines, (line) => Result.isFailure(verifyPointerLine(line, repoCommands)));
    assert.deepStrictEqual(refused, []);
  });

  it("the console's own pointer line passes the same check", () => {
    const lines = linesOf(agentConsole.render(ConsoleRequest.make({ report: reportFor("check") })).text);
    const pointer = O.getOrThrow(A.findFirst(lines, Str.startsWith("next: ")));
    assertSuccess(verifyPointerLine(repoCommands)(pointer), [repoGateCommands.check.showRun]);
  });

  it("refuses an MCP tool name, a bare tool, a document and an unknown repo command", () => {
    const refused = (line: string, violation: PointerLineError["violation"], command: string) =>
      assertFailure(verifyPointerLine(line, repoCommands), PointerLineError.make({ violation, command }));
    refused(`next: ${mcpToolSpelledInParts("test", "errors")}`, "mcp-tool", mcpToolSpelledInParts("test", "errors"));
    refused("next: vitest run --reporter=verbose", "bare-tool", "vitest run --reporter=verbose");
    refused("next: see docs/runbooks/gates.md", "documentation", "see docs/runbooks/gates.md");
    refused("next: https://example.com/gates", "documentation", "https://example.com/gates");
    refused("next: bun run beep gate list", "unknown-command", "bun run beep gate list");
    refused(
      `next: bun run beep gate show test; ${mcpToolSpelledInParts("failure", "signature", "get")}`,
      "mcp-tool",
      mcpToolSpelledInParts("failure", "signature", "get")
    );
    refused("run vitest", "bare-tool", "run vitest");
  });

  it("names no upstream MCP tool anywhere in the table", () => {
    const texts = A.map(repoCommands, commandText);
    assert.isFalse(A.some(texts, (text) => A.some(upstreamTools, (tool) => Str.includes(tool)(text))));
  });

  it("every pointer command is live", () => {
    assert.deepStrictEqual(
      A.filter(repoCommands, (command) => CommandStatus.is.planned(command.status)),
      A.empty<RepoCommand>(),
      "every pointer command is built; the repo CLI's gate-pointers test resolves each in its real command tree"
    );
  });
});

describe("pointers pinned to a record", () => {
  const packageTarget = RecordTarget.cases.PackageTarget.make({
    packageDir: "packages/foundation/modeling/glob",
    gate: "check",
  });
  const rootTarget = RecordTarget.cases.RootTarget.make({ gate: "test", runId: "20261119T000000000Z-0001" });

  it("names a package record by --dir and a root run by --run", () => {
    assert.strictEqual(
      commandText(repoGateCommandsFor(packageTarget).showRun),
      "bun run beep gate show check --dir packages/foundation/modeling/glob"
    );
    assert.strictEqual(
      commandText(repoGateCommandsFor(rootTarget).showItem),
      "bun run beep gate item test 1 --run 20261119T000000000Z-0001"
    );
    assert.deepStrictEqual(R.keys(repoPointerTableFor(rootTarget)), ["test"]);
  });

  it("a console request's own pointer table replaces the settings' one", () => {
    const text = makeGateConsole(ConsoleSettings.make({ audience: "agent" })).render(
      ConsoleRequest.make({ report: reportFor("check"), pointers: O.some(repoPointerTableFor(packageTarget)) })
    ).text;
    const pointer = A.filter(linesOf(text), Str.startsWith("next: "));
    assert.deepStrictEqual(pointer, ["next: bun run beep gate show check --dir packages/foundation/modeling/glob"]);
    const commands = repoGateCommandsFor(packageTarget);
    assertSuccess(
      Result.map(verifyPointerLine(A.getUnsafe(pointer, 0), [commands.showRun, commands.showItem]), A.length),
      1
    );
  });
});
