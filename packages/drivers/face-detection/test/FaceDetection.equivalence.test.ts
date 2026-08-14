import { FaceDetectionError } from "@beep/face-detection";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameFaceDetectionError = S.toEquivalence(FaceDetectionError);

describe("FaceDetectionError declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = FaceDetectionError.make({
      cause: O.some(new Error("model failed")),
      message: "detection failed",
      operation: "detect",
    });
    const b = FaceDetectionError.make({
      cause: O.some(new Error("model failed")),
      message: "detection failed",
      operation: "detect",
    });
    const c = FaceDetectionError.make({
      cause: O.some(new Error("other failure")),
      message: "detection failed",
      operation: "detect",
    });

    expect(sameFaceDetectionError(a, b)).toBe(true);
    expect(sameFaceDetectionError(a, c)).toBe(false);
  });
});
