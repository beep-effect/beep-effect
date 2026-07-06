import { ContinentCode, ContinentCodeFromName, ContinentName, ContinentNameFromCode } from "@beep/schema/ContinentCode";
import { CountryCode, CountryCodeFromName, CountryNameFromCode } from "@beep/schema/CountryCode";
import { CountryName } from "@beep/schema/CountryName";
import { TerritoryCode, TerritoryCodeFromName, TerritoryName, TerritoryNameFromCode } from "@beep/schema/TerritoryCode";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("TerritoryCode", () => {
  it("decodes CLDR territory codes and names from generated @beep/data values", () => {
    expect(S.decodeSync(TerritoryCode)("US")).toBe("US");
    expect(S.decodeSync(TerritoryName)("United States")).toBe("United States");
    expect(TerritoryCode.Options).toContain("GB");
    expect(TerritoryName.Options).toContain("United Kingdom");
  });

  it("maps territory codes and names in both directions", () => {
    expect(S.decodeSync(TerritoryNameFromCode)("US")).toBe("United States");
    expect(S.encodeSync(TerritoryNameFromCode)("United States")).toBe("US");
    expect(S.decodeSync(TerritoryCodeFromName)("United States")).toBe("US");
    expect(S.encodeSync(TerritoryCodeFromName)("US")).toBe("United States");
  });
});

describe("CountryCode", () => {
  it("aliases the CLDR territory code and name schemas for country-facing callers", () => {
    expect(S.decodeSync(CountryCode)("US")).toBe("US");
    expect(S.decodeSync(CountryName)("United States")).toBe("United States");
    expect(S.decodeSync(CountryNameFromCode)("GB")).toBe("United Kingdom");
    expect(S.decodeSync(CountryCodeFromName)("United Kingdom")).toBe("GB");
  });

  it("renders flags only for alpha-2 country codes", () => {
    expect(CountryCode.getFlag("US")).toBe("🇺🇸");
    expect(CountryCode.getFlag("GB")).toBe("🇬🇧");
    expect(CountryCode.getFlag("001")).toBe("");
    expect(CountryCode.getFlag("us")).toBe("");
  });
});

describe("ContinentCode", () => {
  it("decodes CLDR top-level containment codes and names", () => {
    expect(S.decodeSync(ContinentCode)("019")).toBe("019");
    expect(S.decodeSync(ContinentName)("Americas")).toBe("Americas");
    expect(ContinentCode.Options).toContain("150");
    expect(ContinentName.Options).toContain("Europe");
  });

  it("maps continent codes and names in both directions", () => {
    expect(S.decodeSync(ContinentNameFromCode)("019")).toBe("Americas");
    expect(S.encodeSync(ContinentNameFromCode)("Americas")).toBe("019");
    expect(S.decodeSync(ContinentCodeFromName)("Europe")).toBe("150");
    expect(S.encodeSync(ContinentCodeFromName)("150")).toBe("Europe");
  });
});
