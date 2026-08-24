import { ExiftoolError } from "@beep/exiftool";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameExiftoolError = S.toEquivalence(ExiftoolError);

describe("Exiftool declared-field equivalence", () => {
  it("compares diagnostic fields and ignores the opaque defect cause", () => {
    const a = ExiftoolError.make({ message: "exiftool failed", operation: "readTags" });
    const b = ExiftoolError.make({ message: "exiftool failed", operation: "readTags" });
    const c = ExiftoolError.make({ message: "exiftool failed again", operation: "readTags" });
    const firstCause = ExiftoolError.fromUnknown("readTags", "exiftool failed", { cause: new Error("first") });
    const secondCause = ExiftoolError.fromUnknown("readTags", "exiftool failed", { cause: new Error("second") });

    expect(sameExiftoolError(a, b)).toBe(true);
    expect(sameExiftoolError(a, c)).toBe(false);
    expect(sameExiftoolError(firstCause, secondCause)).toBe(true);
  });
});
