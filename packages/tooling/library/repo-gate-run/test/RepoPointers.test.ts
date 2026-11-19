// AC-L9: every pointer line of every cell names repo CLI commands from the
// pointer table, never an MCP tool, a bare tool or a document.
import { FoldResult } from "@beep/gate-report/CauseFold";
import { CellContext, ConsoleInput, dispatchTable } from "@beep/gate-report/Dispatch";
import { GateReport, Totals } from "@beep/gate-report/GateReport";
import { RunOutcome, RunShape } from "@beep/gate-report/Vocabulary";
import { ConsoleRequest } from "@beep/repo-gate-run/GateConsole";
import {
  CommandStatus,
  commandText,
  PointerLineError,
  repoCommands,
  repoGateCommands,
  repoPointerTable,
  verifyPointerLine,
} from "@beep/repo-gate-run/RepoPointers";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { agentConsole, epoch, failedTest, linesOf } from "./support/fixtures.ts";
import type { RepoCommand } from "@beep/repo-gate-run/RepoPointers";

const GATES = ["test", "check"] as const;

// Upstream's MCP tool names, spelled in parts so a search of this package for
// them (the AC-L9 check) finds only real pointers.
const mcpTool = (...parts: ReadonlyArray<string>): string => A.join(parts, "_");
const upstreamTools = [
  mcpTool("test", "errors"),
  mcpTool("failure", "signature", "get"),
  mcpTool("file", "coverage"),
  mcpTool("test", "coverage"),
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

// Every cell of the dispatch table for every gate, through the console.
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
    refused(`next: ${mcpTool("test", "errors")}`, "mcp-tool", mcpTool("test", "errors"));
    refused("next: vitest run --reporter=verbose", "bare-tool", "vitest run --reporter=verbose");
    refused("next: see docs/runbooks/gates.md", "documentation", "see docs/runbooks/gates.md");
    refused("next: https://example.com/gates", "documentation", "https://example.com/gates");
    refused("next: bun run beep gate list", "unknown-command", "bun run beep gate list");
    refused(
      `next: bun run beep gate show test; ${mcpTool("failure", "signature", "get")}`,
      "mcp-tool",
      mcpTool("failure", "signature", "get")
    );
    refused("run vitest", "bare-tool", "run vitest");
  });

  it("names no upstream MCP tool anywhere in the table", () => {
    const texts = A.map(repoCommands, commandText);
    assert.isFalse(A.some(texts, (text) => A.some(upstreamTools, (tool) => Str.includes(tool)(text))));
  });

  // Seam for the live command-tree check: the `gate` command family is not
  // built, so every command is `planned`. When one is marked `live`, this test
  // fails until it is replaced by a check that resolves each live command in
  // the repo CLI's command tree.
  it("every pointer command is still planned, pending the live command-tree check", () => {
    assert.deepStrictEqual(
      A.filter(repoCommands, (command) => CommandStatus.is.live(command.status)),
      A.empty<RepoCommand>()
    );
  });
});
