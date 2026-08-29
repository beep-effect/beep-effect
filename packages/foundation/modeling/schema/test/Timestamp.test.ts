import { EPOCH, EpochMillis, Timestamp } from "@beep/schema/Timestamp";
import { describe, expect, it } from "@effect/vitest";

describe("Timestamp", () => {
  it("constructs the Unix epoch", () => {
    expect(EPOCH.epochMillis).toBe(0);
    expect(EPOCH.toISOStr()).toBe("1970-01-01T00:00:00Z");
    expect(Timestamp.make({ epochMillis: EpochMillis.make(0) }).epochMillis).toBe(0);
  });

  it("accepts zero epoch milliseconds and rejects negative values", () => {
    expect(EpochMillis.fromUnknown(0)).toBe(0);
    expect(() => EpochMillis.fromUnknown(-1)).toThrow();
  });
});
