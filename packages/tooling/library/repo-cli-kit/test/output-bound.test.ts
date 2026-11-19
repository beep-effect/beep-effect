import * as Bound from "@beep/repo-cli-kit/process/OutputBound";
import * as StepExec from "@beep/repo-cli-kit/process/StepExec";
import { assert, describe, it } from "@effect/vitest";

describe("process/OutputBound", () => {
  it("is the one home of the bound: StepExec re-exports the same values", () => {
    assert.strictEqual(StepExec.OutputBound, Bound.OutputBound);
    assert.strictEqual(StepExec.BoundedOutput, Bound.BoundedOutput);
    assert.strictEqual(StepExec.boundedChunkReducer, Bound.boundedChunkReducer);
    assert.strictEqual(StepExec.emptyBoundedOutput, Bound.emptyBoundedOutput);
  });

  it("keeps the head and the tail of output past a head-tail cap", () => {
    const step = Bound.boundedChunkReducer(
      Bound.OutputBound.make({ maxChars: 4, truncatedNotice: "|", retention: Bound.OutputRetention.Enum["head-tail"] })
    );
    const folded = step(step(Bound.emptyBoundedOutput, "abc"), "defg");
    assert.deepStrictEqual({ text: folded.text, truncated: folded.truncated }, { text: "ab|fg", truncated: true });
  });
});
