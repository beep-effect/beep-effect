import { fcRuns } from "@beep/fc-runs";
import { WellFormedText } from "@beep/schema/WellFormedText";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

describe("WellFormedText", () => {
  it("refuses empty text and lone surrogates and accepts astral characters", () => {
    const isWellFormedText = S.is(WellFormedText);
    assert.deepStrictEqual(A.map(["a", "café", "\u{1F600}", "", "\uD800", "a\uDC00", "\uD83D"], isWellFormedText), [
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it.prop("generated text is well-formed UTF-16", [WellFormedText], ([text]) => assertTrue(text.isWellFormed()), runs);
});
