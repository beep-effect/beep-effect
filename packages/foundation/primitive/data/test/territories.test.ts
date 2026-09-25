import {
  ContinentCodeValues,
  ContinentDataByCode,
  ContinentDataNameByCode,
  TerritoryCodeValues,
  TerritoryDataByCode,
  TerritoryDataNameByCode,
  TerritoryDataReleaseTag,
  TerritoryDataValues,
} from "@beep/data/Territories";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";

describe("Territories", () => {
  it("exports generated CLDR territory literals and lookup maps", () => {
    expect(TerritoryCodeValues).toContain("US");
    expect(TerritoryCodeValues).toContain("GB");
    expect(TerritoryDataByCode.US.name).toBe("United States");
    expect(TerritoryDataByCode.GB.name).toBe("United Kingdom");
    expect(TerritoryDataNameByCode.US).toBe("United States");
    expect(TerritoryDataValues.length).toBe(TerritoryCodeValues.length);
  });

  it("exports CLDR top-level containment groups as continent data", () => {
    expect(ContinentCodeValues).toContain("019");
    expect(ContinentCodeValues).toContain("150");
    expect(ContinentDataByCode["019"].name).toBe("Americas");
    expect(ContinentDataByCode["150"].name).toBe("Europe");
    expect(ContinentDataNameByCode["019"]).toBe("Americas");
    expect(TerritoryDataReleaseTag).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
