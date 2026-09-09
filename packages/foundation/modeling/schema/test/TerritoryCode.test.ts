import { ContinentCode, ContinentCodeFromName, ContinentName, ContinentNameFromCode } from "@beep/schema/ContinentCode";
import { CountryCode, CountryCodeFromName, CountryNameFromCode } from "@beep/schema/CountryCode";
import { CountryName } from "@beep/schema/CountryName";
import { TerritoryCode, TerritoryCodeFromName, TerritoryName, TerritoryNameFromCode } from "@beep/schema/TerritoryCode";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const decodeContinentCodeSync = S.decodeSync(ContinentCode);
const decodeContinentCodeFromNameSync = S.decodeSync(ContinentCodeFromName);
const decodeContinentNameSync = S.decodeSync(ContinentName);
const decodeContinentNameFromCodeSync = S.decodeSync(ContinentNameFromCode);
const decodeCountryCodeSync = S.decodeSync(CountryCode);
const decodeCountryCodeFromNameSync = S.decodeSync(CountryCodeFromName);
const decodeCountryNameSync = S.decodeSync(CountryName);
const decodeCountryNameFromCodeSync = S.decodeSync(CountryNameFromCode);
const decodeTerritoryCodeSync = S.decodeSync(TerritoryCode);
const decodeTerritoryCodeFromNameSync = S.decodeSync(TerritoryCodeFromName);
const decodeTerritoryNameSync = S.decodeSync(TerritoryName);
const decodeTerritoryNameFromCodeSync = S.decodeSync(TerritoryNameFromCode);
const encodeContinentCodeFromNameSync = S.encodeSync(ContinentCodeFromName);
const encodeContinentNameFromCodeSync = S.encodeSync(ContinentNameFromCode);
const encodeTerritoryCodeFromNameSync = S.encodeSync(TerritoryCodeFromName);
const encodeTerritoryNameFromCodeSync = S.encodeSync(TerritoryNameFromCode);

describe("TerritoryCode", () => {
  it("decodes CLDR territory codes and names from generated @beep/data values", () => {
    expect(decodeTerritoryCodeSync("US")).toBe("US");
    expect(decodeTerritoryNameSync("United States")).toBe("United States");
    expect(TerritoryCode.Options).toContain("GB");
    expect(TerritoryName.Options).toContain("United Kingdom");
  });

  it("maps territory codes and names in both directions", () => {
    expect(decodeTerritoryNameFromCodeSync("US")).toBe("United States");
    expect(encodeTerritoryNameFromCodeSync("United States")).toBe("US");
    expect(decodeTerritoryCodeFromNameSync("United States")).toBe("US");
    expect(encodeTerritoryCodeFromNameSync("US")).toBe("United States");
  });
});

describe("CountryCode", () => {
  it("aliases the CLDR territory code and name schemas for country-facing callers", () => {
    expect(decodeCountryCodeSync("US")).toBe("US");
    expect(decodeCountryNameSync("United States")).toBe("United States");
    expect(decodeCountryNameFromCodeSync("GB")).toBe("United Kingdom");
    expect(decodeCountryCodeFromNameSync("United Kingdom")).toBe("GB");
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
    expect(decodeContinentCodeSync("019")).toBe("019");
    expect(decodeContinentNameSync("Americas")).toBe("Americas");
    expect(ContinentCode.Options).toContain("150");
    expect(ContinentName.Options).toContain("Europe");
  });

  it("maps continent codes and names in both directions", () => {
    expect(decodeContinentNameFromCodeSync("019")).toBe("Americas");
    expect(encodeContinentNameFromCodeSync("Americas")).toBe("019");
    expect(decodeContinentCodeFromNameSync("Europe")).toBe("150");
    expect(encodeContinentCodeFromNameSync("150")).toBe("Europe");
  });
});
