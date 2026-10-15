import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as S from "effect/Schema";
import { SelfCheckFailure, SmokeFailure } from "../src/PracticeKgMcp.errors.ts";

const expectOpaqueCauseEquivalence = <A>(same: (self: A, that: A) => boolean, first: A, second: A, different: A) => {
  assertTrue(same(first, second));
  assertFalse(same(first, different));
};

describe("practice KG MCP tagged-error declared equivalence", () => {
  it("ignores SmokeFailure cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(SmokeFailure);
    const first = SmokeFailure.make({ cause: { diagnostic: "first" }, message: "Compiled smoke failed." });
    const second = SmokeFailure.make({ cause: { diagnostic: "second" }, message: "Compiled smoke failed." });
    const different = SmokeFailure.make({ cause: { diagnostic: "first" }, message: "Compiled smoke timed out." });

    expectOpaqueCauseEquivalence(same, first, second, different);
  });

  it("ignores SelfCheckFailure cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(SelfCheckFailure);
    const first = SelfCheckFailure.make({ cause: { diagnostic: "first" }, message: "Self-check failed." });
    const second = SelfCheckFailure.make({ cause: { diagnostic: "second" }, message: "Self-check failed." });
    const different = SelfCheckFailure.make({ cause: { diagnostic: "first" }, message: "Self-check timed out." });

    expectOpaqueCauseEquivalence(same, first, second, different);
  });
});
