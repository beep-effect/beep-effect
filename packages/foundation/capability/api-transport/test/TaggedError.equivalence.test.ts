import { EgressDenied } from "@beep/api-transport";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("@beep/api-transport tagged-error declared equivalence", () => {
  it("compares field-free egress denials by their declared tag", () => {
    const same = S.toEquivalence(EgressDenied);
    const first = EgressDenied.make({});
    const second = EgressDenied.make({});

    expect(same(first, second)).toBe(true);
    expect(Reflect.apply(same, undefined, [first, { _tag: "OtherDenial" }])).toBe(false);
  });
});
