import {
  classifyCause,
  fingerprintCause,
  renderObservedCause,
  summarizeCause,
  summarizeExit,
} from "@beep/observability";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";

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
    const equivalent = TestCauseError.make({ message: "boom" }).pipe(Cause.fail, fingerprintCause);
    const differentMessage = TestCauseError.make({ message: "kapow" }).pipe(Cause.fail, fingerprintCause);
    const differentClassification = TestCauseError.make({ message: "boom" }).pipe(Cause.die, fingerprintCause);
    expect(equivalent.value).toBe(fingerprint.value);
    expect(differentMessage.value).not.toBe(fingerprint.value);
    expect(differentClassification.value).not.toBe(fingerprint.value);
    expect(summary.primaryMessage).toBe("boom");
    expect(renderObservedCause(cause)).toContain(fingerprint.value);
  });

  it("summarizes success and failure exits", () => {
    const success = summarizeExit(Exit.succeed("ok"));
    const failure = TestCauseError.make({ message: "boom" }).pipe(Cause.fail, Exit.failCause, summarizeExit);

    expect(success.outcome).toBe("success");
    expect(failure.outcome).toBe("failure");
    expect(failure.classification).toBe("failure");
  });
});
