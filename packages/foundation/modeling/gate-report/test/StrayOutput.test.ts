// Ported from vitest-agent 1cf1ab94 packages/sdk/__test__/stray-output.test.ts (MIT).
import { GateReport } from "@beep/gate-report/GateReport";
import { StrayOutput, StrayOutputSample, strayOutputNote } from "@beep/gate-report/StrayOutput";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { makeReport } from "./support/builders.ts";

describe("StrayOutput", () => {
  it("is an optional report field", () => {
    assertNone(makeReport().strayOutput);
    assert.isTrue("strayOutput" in GateReport.fields);
  });

  it("the note names the count, the stream, the usual cause and the fix", () => {
    const lines = strayOutputNote(
      StrayOutput.make({
        total: 2,
        stdout: 2,
        stderr: 0,
        bytes: 24,
        samples: [StrayOutputSample.make({ stream: "stdout", text: "git worktree add" })],
      })
    );
    assert.deepStrictEqual(lines, [
      'Stray output: the run wrote 2 lines directly to stdout, bypassing the runner\'s console capture. A child process with inherited stdio is the usual cause; pass `stdio: "pipe"`.',
      "  stdout: git worktree add",
      "  (+1 more)",
    ]);
  });

  it("says both streams, singular, and shows at most three samples", () => {
    const sample = (text: string) => StrayOutputSample.make({ stream: "stderr", text });
    const lines = strayOutputNote(
      StrayOutput.make({
        total: 1,
        stdout: 1,
        stderr: 1,
        bytes: 3,
        samples: [sample("a"), sample("b"), sample("c"), sample("d")],
      })
    );
    assert.strictEqual(lines.length, 4);
    assert.include(lines[0] ?? "", "wrote 1 line directly to stdout and stderr");
  });

  it("names stderr alone and omits the remainder when no sample was kept", () => {
    const lines = strayOutputNote(StrayOutput.make({ total: 5, stdout: 0, stderr: 5, bytes: 50, samples: [] }));
    assert.strictEqual(lines.length, 1);
    assert.include(lines[0] ?? "", "directly to stderr,");
  });
});
