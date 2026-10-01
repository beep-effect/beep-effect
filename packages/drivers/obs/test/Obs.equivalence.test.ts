import { ObsError } from "@beep/obs";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
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

describe("ObsError.fromUnknown", () => {
  it("wraps an unknown cause with the declared context", () => {
    const error = ObsError.fromUnknown("connect", "Failed to reach obs-websocket", {
      cause: new Error("boom"),
      closeCode: 4009,
      requestType: "GetVersion",
    });

    expect(error.operation).toBe("connect");
    expect(error.message).toBe("Failed to reach obs-websocket");
    assertTrue(O.isSome(error.cause));
    assertSome(error.closeCode, 4009);
    assertSome(error.requestType, "GetVersion");
    assertNone(error.requestStatusCode);
  });

  it("passes an existing ObsError cause through unchanged, data-last too", () => {
    const existing = ObsError.make({ message: "request failed", operation: "startRecording" });
    const wrap = ObsError.fromUnknown("Outer failure", { cause: existing });

    expect(wrap("connect")).toBe(existing);
  });
});
