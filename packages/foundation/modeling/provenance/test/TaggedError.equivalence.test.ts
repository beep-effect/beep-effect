import { VerifiedTextAnchorError } from "@beep/provenance/VerifiedTextAnchor";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("@beep/provenance tagged-error declared equivalence", () => {
  it("compares verified text-anchor errors by declared fields", () => {
    const same = S.toEquivalence(VerifiedTextAnchorError);
    const first = VerifiedTextAnchorError.fromReason("quote-mismatch");
    const second = VerifiedTextAnchorError.fromReason("quote-mismatch");
    const different = VerifiedTextAnchorError.fromReason("stale-source");

    expect(same(first, second)).toBe(true);
    expect(same(first, different)).toBe(false);
  });
});
