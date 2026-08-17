import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Correction, correctionShouldApply } from "../../Service/Agent/CorrectorAgent.ts";

describe("CorrectorAgent correction model", () => {
  it.effect(
    "derives automatic application exhaustively from the correction strategy",
    Effect.fnUntraced(function* () {
      const generated = Correction.cases["generate-value"].make({
        focusNode: "https://example.com/entity/1",
        path: "https://example.com/property/name",
        originalValue: O.none(),
        newValue: "Ada",
        explanation: "The required name was missing.",
        confidence: Confidence.make(0.9),
      });
      const skipped = Correction.cases.skip.make({
        focusNode: "https://example.com/entity/1",
        explanation: "Manual review is required.",
        confidence: Confidence.make(1),
      });

      assert.isTrue(correctionShouldApply(generated));
      assert.isFalse(correctionShouldApply(skipped));
    })
  );

  it.effect(
    "rejects a value strategy whose required replacement value is absent",
    Effect.fnUntraced(function* () {
      const error = yield* S.decodeUnknownEffect(Correction)({
        strategy: "generate-value",
        focusNode: "https://example.com/entity/1",
        path: "https://example.com/property/name",
        explanation: "The required name was missing.",
        confidence: 0.9,
      }).pipe(Effect.flip);

      assert.include(error.message, "newValue");
    })
  );
});
