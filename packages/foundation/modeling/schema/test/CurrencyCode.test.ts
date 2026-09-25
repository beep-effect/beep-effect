import { CurrencyCode, CurrencyName, isCurrencyCode, USD } from "@beep/schema/CurrencyCode";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";

const decodeCurrencyCodeEffect = S.decodeEffect(CurrencyCode);
const decodeCurrencyNameEffect = S.decodeEffect(CurrencyName);
const decodeUnknownCurrencyCodeEffect = S.decodeUnknownEffect(CurrencyCode);

describe("CurrencyCode", () => {
  it.effect(
    "decodes ISO 4217 literals from generated @beep/data values",
    Effect.fnUntraced(function* () {
      expect(yield* decodeCurrencyCodeEffect("USD")).toBe("USD");
      expect(yield* decodeCurrencyCodeEffect("EUR")).toBe("EUR");
      expect(CurrencyCode.Options).toContain("USD");
      expect(USD).toBe("USD");
    })
  );

  it.effect(
    "exports a generated currency-name literal schema",
    Effect.fnUntraced(function* () {
      expect(yield* decodeCurrencyNameEffect("US Dollar")).toBe("US Dollar");
      expect(CurrencyName.Options).toContain("Euro");
    })
  );

  it.effect(
    "rejects unknown currency codes",
    Effect.fnUntraced(function* () {
      expect(isCurrencyCode("USD")).toBe(true);
      expect(isCurrencyCode("usd")).toBe(false);
      const failure1 = yield* Effect.exit(decodeUnknownCurrencyCodeEffect("ZZZ"));
      pipe(failure1, Exit.hasFails, assertTrue);
    })
  );
});
