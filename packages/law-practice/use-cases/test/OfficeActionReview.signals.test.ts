import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { modelOutput, text } from "./fixtures/office-action-review/fixture.ts";
import { fixturePrincipal, makeLayer, reviewScenario } from "./fixtures/office-action-review/support.ts";

it.layer(makeLayer(modelOutput), { timeout: "10 seconds" })("office-action extraction observations", (it) => {
  it.effect("L4-7 verified office-action alignment leaves unreported confidence absent", () =>
    Effect.gen(function* () {
      const { review, input } = yield* reviewScenario({ principal: fixturePrincipal, current: text });
      const result = yield* review.review(input);
      const extraction = yield* review.extractCandidate(input);
      expect(extraction.evidence.span).toMatchObject({
        version: "evidence-position/v2",
        position: result.law.distinction.anchor,
        extractorConfidence: { _tag: "Absent", reason: "not-assessed" },
      });
      expect(result.assessments.alignment._tag).toBe("Assessed");
    })
  );
});
