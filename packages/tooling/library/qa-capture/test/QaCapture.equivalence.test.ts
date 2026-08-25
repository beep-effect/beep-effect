import { QaCaptureError } from "@beep/qa-capture";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sameQaCaptureError = S.toEquivalence(QaCaptureError);

describe("QaCaptureError declared-field equivalence", () => {
  it("compares stable fields and ignores the opaque cause", () => {
    const a = QaCaptureError.make({
      cause: O.some("same cause"),
      message: "capture failed",
      operation: "record",
      path: O.some("/tmp/session"),
    });
    const b = QaCaptureError.make({
      cause: O.some("same cause"),
      message: "capture failed",
      operation: "record",
      path: O.some("/tmp/session"),
    });
    const different = QaCaptureError.make({
      cause: O.some("same cause"),
      message: "capture failed",
      operation: "extract",
      path: O.some("/tmp/session"),
    });
    const differentCause = QaCaptureError.make({
      cause: O.some("different cause"),
      message: "capture failed",
      operation: "record",
      path: O.some("/tmp/session"),
    });

    expect(sameQaCaptureError(a, b)).toBe(true);
    expect(sameQaCaptureError(a, different)).toBe(false);
    expect(sameQaCaptureError(a, differentCause)).toBe(true);
  });
});
