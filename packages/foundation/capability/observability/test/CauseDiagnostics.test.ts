import {
  classifyCause,
  fingerprintCause,
  renderObservedCause,
  summarizeCause,
  summarizeExit,
} from "@beep/observability";
import { Cause, Exit } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

class TestCauseError extends S.TaggedError<TestCauseError>()("TestCauseError", {
  message: S.String,
}) {}

describe("CauseDiagnostics", () => {
  it("classifies failure, defect, and mixed causes", () => {
    expect(classifyCause(Cause.fail(TestCauseError.make({ message: "boom" })))).toBe("failure");
    expect(classifyCause(Cause.die("kapow"))).toBe("defect");
    expect(classifyCause(Cause.combine(Cause.fail(TestCauseError.make({ message: "boom" })), Cause.die("kapow")))).toBe(
      "mixed"
    );
  });

  it("creates stable fingerprints and summaries", () => {
    const cause = Cause.fail(TestCauseError.make({ message: "boom" }));
    const fingerprint = fingerprintCause(cause);
    const summary = summarizeCause(cause);

    expect(fingerprint.value).toContain("failure");
    expect(summary.primaryMessage).toBe("boom");
    expect(renderObservedCause(cause)).toContain(fingerprint.value);
  });

  it("summarizes success and failure exits", () => {
    const success = summarizeExit(Exit.succeed("ok"));
    const failure = summarizeExit(Exit.failCause(Cause.fail(TestCauseError.make({ message: "boom" }))));

    expect(success.outcome).toBe("success");
    expect(failure.outcome).toBe("failure");
    expect(failure.classification).toBe("failure");
  });
});
