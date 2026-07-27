import { describe, expectTypeOf, it } from "vitest";
import type { TString } from "@beep/types";

describe("TString", () => {
  it("preserves non-empty literal strings", () => {
    expectTypeOf<TString.NonEmpty<"beep">>().toEqualTypeOf<"beep">();
  });

  it("rejects empty literal strings", () => {
    expectTypeOf<TString.NonEmpty<"">>().toEqualTypeOf<never>();
  });

  it("splits string literals into character unions", () => {
    expectTypeOf<TString.Chars<"abc">>().toEqualTypeOf<"a" | "b" | "c">();
  });
});
