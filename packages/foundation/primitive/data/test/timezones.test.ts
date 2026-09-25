import {
  TimezoneDataByName,
  TimezoneDataMetadata,
  TimezoneDataSourceSha256,
  TimezoneDataSourceUrl,
  TimezoneDataValues,
  TimezoneDataVersion,
  TimezoneNameValues,
} from "@beep/data/Timezones";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";

describe("Timezones", () => {
  it("exports generated IANA timezone literals and lookup maps", () => {
    expect(TimezoneNameValues).toContain("UTC");
    expect(TimezoneNameValues).toContain("America/New_York");
    expect(TimezoneDataByName.UTC.name).toBe("UTC");
    expect(TimezoneDataByName["America/New_York"].name).toBe("America/New_York");
    expect(TimezoneDataValues.length).toBe(TimezoneNameValues.length);
  });

  it("exports official tzdb source metadata", () => {
    expect(TimezoneDataVersion).toMatch(/^\d{4}[a-z]$/);
    expect(TimezoneDataSourceUrl).toBe("https://data.iana.org/time-zones/tzdata-latest.tar.gz");
    expect(TimezoneDataSourceSha256).toHaveLength(64);
    expect(TimezoneDataMetadata.sha256).toBe(TimezoneDataSourceSha256);
  });
});
