import { GrantRevisionMismatch, PolicyRevision } from "@beep/execution-authority-domain";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as S from "effect/Schema";

describe("execution-authority-domain tagged-error declared equivalence", () => {
  it("compares GrantRevisionMismatch by both revision fields", () => {
    const sameError = S.toEquivalence(GrantRevisionMismatch);
    const revision1 = PolicyRevision.make("1.0.0");
    const revision2 = PolicyRevision.make("2.0.0");
    const revision3 = PolicyRevision.make("3.0.0");
    const a = GrantRevisionMismatch.between(revision1, revision2);
    const b = GrantRevisionMismatch.between(revision1, revision2);
    const c = GrantRevisionMismatch.between(revision1, revision3);

    expect(sameError(a, b)).toBe(true);
    expect(sameError(a, c)).toBe(false);
  });
});
