import {
  CurrencyCodeDataByCode,
  CurrencyCodeDataCodeValues,
  CurrencyCodeDataMetadata,
  CurrencyCodeDataNameByCode,
  CurrencyCodeDataPublished,
  CurrencyCodeDataSourceSha256,
  CurrencyCodeDataSourceUrl,
  CurrencyCodeDataValues,
} from "@beep/data/CurrencyCodes";
import { it } from "@beep/test-runner";
import { A, O } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { pipe } from "effect";

describe("CurrencyCodes", () => {
  it("exports the generated ISO 4217 data through the public module", () => {
    const usd = pipe(
      CurrencyCodeDataValues,
      A.findFirst((entry) => entry.code === "USD")
    );

    expect(A.length(CurrencyCodeDataValues)).toBeGreaterThan(0);
    expect(O.isSome(usd)).toBe(true);
    pipe(
      usd,
      O.match({
        onNone: () => expect.fail("Expected USD to be present in currency code data"),
        onSome: (entry) => {
          expect(entry.currency).toBe("US Dollar");
          expect(entry.number).toBe("840");
        },
      })
    );
  });

  it("exports typed lookup maps and official source metadata", () => {
    expect(CurrencyCodeDataByCode.USD.currency).toBe("US Dollar");
    expect(CurrencyCodeDataNameByCode.USD).toBe("US Dollar");
    expect(CurrencyCodeDataCodeValues).toContain("USD");
    expect(CurrencyCodeDataPublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CurrencyCodeDataSourceUrl).toContain("six-group.com");
    expect(CurrencyCodeDataSourceSha256).toHaveLength(64);
    expect(CurrencyCodeDataMetadata.sha256).toBe(CurrencyCodeDataSourceSha256);
  });

  it("keeps special-purpose codes with N.A. minor units normalized to zero digits", () => {
    const xba = pipe(
      CurrencyCodeDataValues,
      A.findFirst((entry) => entry.code === "XBA")
    );

    expect(O.isSome(xba)).toBe(true);
    pipe(
      xba,
      O.match({
        onNone: () => expect.fail("Expected XBA to be present in currency code data"),
        onSome: (entry) => {
          expect(entry.digits).toBe(0);
        },
      })
    );
  });
});
