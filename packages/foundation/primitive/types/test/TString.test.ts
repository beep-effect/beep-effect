import { describe, expectTypeOf, it } from "vitest";
import type { TString } from "@beep/types";

describe("TString", () => {
  it("preserves non-empty literal strings", () => {
    expectTypeOf<TString.NonEmpty<"beep">>().toEqualTypeOf<"beep">();
  });

  it("rejects empty literal strings", () => {
    expectTypeOf<TString.NonEmpty<"">>().toEqualTypeOf<never>();
  });

  it("preserves non-empty strings without boundary slashes", () => {
    expectTypeOf<TString.NonEmptyTrimmed<"beep">>().toEqualTypeOf<"beep">();
    expectTypeOf<TString.NonEmptyTrimmed<"beep/effect">>().toEqualTypeOf<"beep/effect">();
    expectTypeOf<TString.NonEmptyTrimmed<string>>().toEqualTypeOf<TString.NonEmpty<string>>();
  });

  it("rejects empty strings and strings with boundary slashes", () => {
    expectTypeOf<TString.NonEmptyTrimmed<"">>().toEqualTypeOf<never>();
    expectTypeOf<TString.NonEmptyTrimmed<"/beep">>().toEqualTypeOf<never>();
    expectTypeOf<TString.NonEmptyTrimmed<"beep/">>().toEqualTypeOf<never>();
    expectTypeOf<TString.NonEmptyTrimmed<"/beep/">>().toEqualTypeOf<never>();
  });

  it("filters invalid union members", () => {
    type Filtered = TString.NonEmptyTrimmed<"" | "/beep" | "beep/" | "beep/effect">;

    expectTypeOf<Filtered>().toEqualTypeOf<"beep/effect">();
  });

  it("splits string literals into character unions", () => {
    expectTypeOf<TString.Chars<"abc">>().toEqualTypeOf<"a" | "b" | "c">();
  });

  it("preserves ASCII dot property names", () => {
    expectTypeOf<TString.DotPropertyName<"hello">>().toEqualTypeOf<"hello">();
    expectTypeOf<TString.DotPropertyName<"$hello">>().toEqualTypeOf<"$hello">();
    expectTypeOf<TString.DotPropertyName<"_hello">>().toEqualTypeOf<"_hello">();
    expectTypeOf<TString.DotPropertyName<"hello4">>().toEqualTypeOf<"hello4">();
    expectTypeOf<TString.DotPropertyName<"default">>().toEqualTypeOf<"default">();
    expectTypeOf<TString.DotPropertyName<string>>().toEqualTypeOf<string>();
    expectTypeOf<
      TString.DotPropertyName<"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$">
    >().toEqualTypeOf<"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$">();
  });

  it("rejects strings that cannot be used for ASCII dot property access", () => {
    expectTypeOf<TString.DotPropertyName<"">>().toEqualTypeOf<never>();
    expectTypeOf<TString.DotPropertyName<" hello">>().toEqualTypeOf<never>();
    expectTypeOf<TString.DotPropertyName<"1hello">>().toEqualTypeOf<never>();
    expectTypeOf<TString.DotPropertyName<"hello ">>().toEqualTypeOf<never>();
    expectTypeOf<TString.DotPropertyName<"hello-world">>().toEqualTypeOf<never>();
    expectTypeOf<TString.DotPropertyName<"hello.world">>().toEqualTypeOf<never>();
  });

  it("filters invalid dot property name union members", () => {
    type Filtered = TString.DotPropertyName<" hello" | "1hello" | "$hello" | "hello4">;

    expectTypeOf<Filtered>().toEqualTypeOf<"$hello" | "hello4">();
  });
});
