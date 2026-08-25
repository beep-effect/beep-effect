import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { PackageFailure, PracticeKgHostError, SmokeFailure } from "../src/PracticeKgMcp.errors.ts";

const expectOpaqueCauseEquivalence = <A>(same: (self: A, that: A) => boolean, first: A, second: A, different: A) => {
  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("practice KG MCP tagged-error declared equivalence", () => {
  it("ignores PackageFailure cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(PackageFailure);
    const first = PackageFailure.make({ cause: { diagnostic: "first" }, message: "Packaging failed." });
    const second = PackageFailure.make({ cause: { diagnostic: "second" }, message: "Packaging failed." });
    const different = PackageFailure.make({ cause: { diagnostic: "first" }, message: "Packaging timed out." });

    expectOpaqueCauseEquivalence(same, first, second, different);
  });

  it("ignores PracticeKgHostError cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(PracticeKgHostError);
    const first = PracticeKgHostError.make({ cause: { diagnostic: "first" }, message: "Host startup failed." });
    const second = PracticeKgHostError.make({ cause: { diagnostic: "second" }, message: "Host startup failed." });
    const different = PracticeKgHostError.make({ cause: { diagnostic: "first" }, message: "Host startup timed out." });

    expectOpaqueCauseEquivalence(same, first, second, different);
  });

  it("ignores SmokeFailure cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(SmokeFailure);
    const first = SmokeFailure.make({ cause: { diagnostic: "first" }, message: "Compiled smoke failed." });
    const second = SmokeFailure.make({ cause: { diagnostic: "second" }, message: "Compiled smoke failed." });
    const different = SmokeFailure.make({ cause: { diagnostic: "first" }, message: "Compiled smoke timed out." });

    expectOpaqueCauseEquivalence(same, first, second, different);
  });
});
