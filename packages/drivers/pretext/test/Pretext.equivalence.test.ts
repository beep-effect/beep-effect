import { PretextMeasurementUnavailableError } from "@beep/pretext";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const samePretextMeasurementUnavailableError = S.toEquivalence(PretextMeasurementUnavailableError);

describe("Pretext declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different ones as distinct", () => {
    const a = PretextMeasurementUnavailableError.make({
      message: "Canvas 2D is unavailable.",
      reason: "missingCanvas2d",
    });
    const b = PretextMeasurementUnavailableError.make({
      message: "Canvas 2D is unavailable.",
      reason: "missingCanvas2d",
    });
    const c = PretextMeasurementUnavailableError.make({
      message: "Intl.Segmenter is unavailable.",
      reason: "missingIntlSegmenter",
    });

    expect(samePretextMeasurementUnavailableError(a, b)).toBe(true);
    expect(samePretextMeasurementUnavailableError(a, c)).toBe(false);
  });
});
