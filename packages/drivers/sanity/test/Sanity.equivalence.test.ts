import { SanityError } from "@beep/sanity";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameSanityError = S.toEquivalence(SanityError);

describe("Sanity declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = SanityError.fromReason("response status", { status: 404, url: "https://api.sanity.io/query" });
    const b = SanityError.fromReason("response status", { status: 404, url: "https://api.sanity.io/query" });
    const c = SanityError.fromReason("response status", { status: 500, url: "https://api.sanity.io/query" });

    expect(sameSanityError(a, b)).toBe(true);
    expect(sameSanityError(a, c)).toBe(false);
  });

  it("treats defect-only differences as equivalent", () => {
    const a = SanityError.fromReason("transport", {
      cause: new Error("first failure"),
      url: "https://api.sanity.io/query",
    });
    const b = SanityError.fromReason("transport", {
      cause: new Error("second failure"),
      url: "https://api.sanity.io/query",
    });

    // the defect cause is payload, never identity
    expect(sameSanityError(a, b)).toBe(true);
  });
});
