import { ObsError } from "@beep/obs";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameObsError = S.toEquivalence(ObsError);

describe("OBS declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = ObsError.make({ message: "request failed", operation: "startRecording" });
    const b = ObsError.make({ message: "request failed", operation: "startRecording" });
    const c = ObsError.make({ message: "request failed", operation: "stopRecording" });

    expect(sameObsError(a, b)).toBe(true);
    expect(sameObsError(a, c)).toBe(false);
  });

  it("ignores the opaque defect cause", () => {
    const a = ObsError.make({
      cause: O.some(new Error("first cause")),
      message: "request failed",
      operation: "startRecording",
    });
    const b = ObsError.make({
      cause: O.some(new Error("second cause")),
      message: "request failed",
      operation: "startRecording",
    });

    expect(sameObsError(a, b)).toBe(true);
  });
});
