import { it } from "@beep/test-runner";
import { ReactContextInvariantError } from "@beep/ui/lib/react-invariant";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as S from "effect/Schema";

const sameReactContextInvariantError = S.toEquivalence(ReactContextInvariantError);

describe("React invariant tagged-error declared equivalence", () => {
  it("compares ReactContextInvariantError by declared fields", () => {
    const a = ReactContextInvariantError.make({ message: "Provider missing" });
    const b = ReactContextInvariantError.make({ message: "Provider missing" });
    const c = ReactContextInvariantError.make({ message: "Context missing" });

    pipe(sameReactContextInvariantError(a, b), assertTrue);
    pipe(sameReactContextInvariantError(a, c), assertFalse);
  });
});
