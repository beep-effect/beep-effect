import { SeverityLevel } from "@beep/schema/SeverityLevel";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";

describe("SeverityLevel", () => {
  it("exports the shared severity literals", () => {
    expect(SeverityLevel.Options).toEqual(["low", "medium", "high", "critical"]);
  });

  it("provides literal guards", () => {
    expect(SeverityLevel.is.high("high")).toBe(true);
    expect(SeverityLevel.is.high("critical")).toBe(false);
  });
});
