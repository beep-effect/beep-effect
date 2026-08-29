import { EgressDenied } from "@beep/api-transport";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("EgressDenied", () => {
  it("constructs reason-free with only its tag", () => {
    const denial = EgressDenied.make({});

    expect(denial._tag).toBe("EgressDenied");
    expect(EgressDenied.is(denial)).toBe(true);
    // Field-free by design: a denial reason surfaced to the caller would be a
    // probing channel, so the error's serialized form carries the tag and
    // nothing else.
    const encoded = S.encodeSync(EgressDenied)(denial);
    expect(Object.keys(encoded)).toEqual(["_tag"]);
  });

  it("round-trips through its schema", () => {
    const decoded = S.decodeSync(EgressDenied)({ _tag: "EgressDenied" });

    expect(EgressDenied.is(decoded)).toBe(true);
    expect(EgressDenied.is({ _tag: "SomethingElse" })).toBe(false);
  });
});
