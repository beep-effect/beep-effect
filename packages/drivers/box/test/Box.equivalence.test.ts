import { BoxError } from "@beep/box";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as S from "effect/Schema";

const sameBoxError = S.toEquivalence(BoxError);

describe("Box declared-field equivalence", () => {
  it("treats field-equal BoxError instances as equivalent and field-different ones as distinct", () => {
    const a = BoxError.fromReason("response status", { code: "rate_limit" });
    const b = BoxError.fromReason("response status", { code: "rate_limit" });
    const c = BoxError.fromReason("response status", { code: "not_found" });

    pipe(sameBoxError(a, b), assertTrue);
    pipe(sameBoxError(a, c), assertFalse);
  });
});
