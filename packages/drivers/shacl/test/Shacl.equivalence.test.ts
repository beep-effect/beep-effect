import { ShaclEngineError } from "@beep/shacl";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as S from "effect/Schema";

const sameShaclEngineError = S.toEquivalence(ShaclEngineError);

describe("SHACL declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = ShaclEngineError.make({ message: "validation failed", reason: "validationFailed" });
    const b = ShaclEngineError.make({ message: "validation failed", reason: "validationFailed" });
    const c = ShaclEngineError.make({ message: "validation failed", reason: "datasetLoadFailed" });

    pipe(sameShaclEngineError(a, b), assertTrue);
    pipe(sameShaclEngineError(a, c), assertFalse);
  });
});
