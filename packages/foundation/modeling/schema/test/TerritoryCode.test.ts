import { ContinentCode, ContinentCodeFromName, ContinentName, ContinentNameFromCode } from "@beep/schema/ContinentCode";
import { CountryCode, CountryCodeFromName, CountryNameFromCode } from "@beep/schema/CountryCode";
import { CountryName } from "@beep/schema/CountryName";
import { TerritoryCode, TerritoryCodeFromName, TerritoryName, TerritoryNameFromCode } from "@beep/schema/TerritoryCode";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const decodeContinentCode = S.decodeUnknownEffect(ContinentCode);
const decodeContinentCodeFromName = S.decodeUnknownEffect(ContinentCodeFromName);
const decodeContinentName = S.decodeUnknownEffect(ContinentName);
const decodeContinentNameFromCode = S.decodeUnknownEffect(ContinentNameFromCode);
const decodeCountryCode = S.decodeUnknownEffect(CountryCode);
const decodeCountryCodeFromName = S.decodeUnknownEffect(CountryCodeFromName);
const decodeCountryName = S.decodeUnknownEffect(CountryName);
const decodeCountryNameFromCode = S.decodeUnknownEffect(CountryNameFromCode);
const decodeTerritoryCode = S.decodeUnknownEffect(TerritoryCode);
const decodeTerritoryCodeFromName = S.decodeUnknownEffect(TerritoryCodeFromName);
const decodeTerritoryName = S.decodeUnknownEffect(TerritoryName);
const decodeTerritoryNameFromCode = S.decodeUnknownEffect(TerritoryNameFromCode);
const encodeContinentCodeFromName = S.encodeEffect(ContinentCodeFromName);
const encodeContinentNameFromCode = S.encodeEffect(ContinentNameFromCode);
const encodeTerritoryCodeFromName = S.encodeEffect(TerritoryCodeFromName);
const encodeTerritoryNameFromCode = S.encodeEffect(TerritoryNameFromCode);

describe("TerritoryCode", () => {
  it.effect(
    "decodes CLDR territory codes and names from generated @beep/data values",
    Effect.fnUntraced(function* () {
      const decodedTerritoryCode = yield* decodeTerritoryCode("US");
      expect(decodedTerritoryCode).toBe("US");
      const decodedTerritoryName = yield* decodeTerritoryName("United States");
      expect(decodedTerritoryName).toBe("United States");
      expect(TerritoryCode.literals).toContain("GB");
      expect(TerritoryName.literals).toContain("United Kingdom");
    })
  );

  it.effect(
    "maps territory codes and names in both directions",
    Effect.fnUntraced(function* () {
      const decodedTerritoryNameFromCode = yield* decodeTerritoryNameFromCode("US");
      expect(decodedTerritoryNameFromCode).toBe("United States");
      const encodedTerritoryNameFromCode = yield* encodeTerritoryNameFromCode("United States");
      expect(encodedTerritoryNameFromCode).toBe("US");
      const decodedTerritoryCodeFromName = yield* decodeTerritoryCodeFromName("United States");
      expect(decodedTerritoryCodeFromName).toBe("US");
      const encodedTerritoryCodeFromName = yield* encodeTerritoryCodeFromName("US");
      expect(encodedTerritoryCodeFromName).toBe("United States");
    })
  );
});

describe("CountryCode", () => {
  it.effect(
    "aliases the CLDR territory code and name schemas for country-facing callers",
    Effect.fnUntraced(function* () {
      const decodedCountryCode = yield* decodeCountryCode("US");
      expect(decodedCountryCode).toBe("US");
      const decodedCountryName = yield* decodeCountryName("United States");
      expect(decodedCountryName).toBe("United States");
      const decodedCountryNameFromCode = yield* decodeCountryNameFromCode("GB");
      expect(decodedCountryNameFromCode).toBe("United Kingdom");
      const decodedCountryCodeFromName = yield* decodeCountryCodeFromName("United Kingdom");
      expect(decodedCountryCodeFromName).toBe("GB");
    })
  );

  it("renders flags only for alpha-2 country codes", () => {
    expect(CountryCode.getFlag("US")).toBe("🇺🇸");
    expect(CountryCode.getFlag("GB")).toBe("🇬🇧");
    expect(CountryCode.getFlag("001")).toBe("");
    expect(CountryCode.getFlag("us")).toBe("");
  });
});

describe("ContinentCode", () => {
  it.effect(
    "decodes CLDR top-level containment codes and names",
    Effect.fnUntraced(function* () {
      const decodedContinentCode = yield* decodeContinentCode("019");
      expect(decodedContinentCode).toBe("019");
      const decodedContinentName = yield* decodeContinentName("Americas");
      expect(decodedContinentName).toBe("Americas");
      expect(ContinentCode.literals).toContain("150");
      expect(ContinentName.literals).toContain("Europe");
    })
  );

  it.effect(
    "maps continent codes and names in both directions",
    Effect.fnUntraced(function* () {
      const decodedContinentNameFromCode = yield* decodeContinentNameFromCode("019");
      expect(decodedContinentNameFromCode).toBe("Americas");
      const encodedContinentNameFromCode = yield* encodeContinentNameFromCode("Americas");
      expect(encodedContinentNameFromCode).toBe("019");
      const decodedContinentCodeFromName = yield* decodeContinentCodeFromName("Europe");
      expect(decodedContinentCodeFromName).toBe("150");
      const encodedContinentCodeFromName = yield* encodeContinentCodeFromName("150");
      expect(encodedContinentCodeFromName).toBe("Europe");
    })
  );
});
