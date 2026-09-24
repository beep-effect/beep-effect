import { ContinentCode, ContinentCodeFromName, ContinentName, ContinentNameFromCode } from "@beep/schema/ContinentCode";
import { CountryCode, CountryCodeFromName, CountryNameFromCode } from "@beep/schema/CountryCode";
import { CountryName } from "@beep/schema/CountryName";
import { TerritoryCode, TerritoryCodeFromName, TerritoryName, TerritoryNameFromCode } from "@beep/schema/TerritoryCode";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
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
      expect(yield* decodeTerritoryCode("US")).toBe("US");
      expect(yield* decodeTerritoryName("United States")).toBe("United States");
      expect(TerritoryCode.Options).toContain("GB");
      expect(TerritoryName.Options).toContain("United Kingdom");
    })
  );

  it.effect(
    "maps territory codes and names in both directions",
    Effect.fnUntraced(function* () {
      expect(yield* decodeTerritoryNameFromCode("US")).toBe("United States");
      expect(yield* encodeTerritoryNameFromCode("United States")).toBe("US");
      expect(yield* decodeTerritoryCodeFromName("United States")).toBe("US");
      expect(yield* encodeTerritoryCodeFromName("US")).toBe("United States");
    })
  );
});

describe("CountryCode", () => {
  it.effect(
    "aliases the CLDR territory code and name schemas for country-facing callers",
    Effect.fnUntraced(function* () {
      expect(yield* decodeCountryCode("US")).toBe("US");
      expect(yield* decodeCountryName("United States")).toBe("United States");
      expect(yield* decodeCountryNameFromCode("GB")).toBe("United Kingdom");
      expect(yield* decodeCountryCodeFromName("United Kingdom")).toBe("GB");
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
      expect(yield* decodeContinentCode("019")).toBe("019");
      expect(yield* decodeContinentName("Americas")).toBe("Americas");
      expect(ContinentCode.Options).toContain("150");
      expect(ContinentName.Options).toContain("Europe");
    })
  );

  it.effect(
    "maps continent codes and names in both directions",
    Effect.fnUntraced(function* () {
      expect(yield* decodeContinentNameFromCode("019")).toBe("Americas");
      expect(yield* encodeContinentNameFromCode("Americas")).toBe("019");
      expect(yield* decodeContinentCodeFromName("Europe")).toBe("150");
      expect(yield* encodeContinentCodeFromName("150")).toBe("Europe");
    })
  );
});
