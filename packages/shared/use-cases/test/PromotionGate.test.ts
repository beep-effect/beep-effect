import { PromotionGate, PromotionGateVerdict, PromotionSubjectRef } from "@beep/shared-use-cases/PromotionGate";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

describe("PromotionGate", () => {
  it.effect("carries only an opaque subject across the contract", () =>
    Effect.gen(function* () {
      const subject = PromotionSubjectRef.make({ id: "subject-1", kind: "matter" });
      const verdict = yield* PromotionGate.pipe(Effect.flatMap((gate) => gate.evaluate(subject)));

      expect(verdict.outcome).toBe("clear");
    }).pipe(
      Effect.provideService(
        PromotionGate,
        PromotionGate.of({
          evaluate: Effect.fnUntraced(function* () {
            return PromotionGateVerdict.cases.clear.make({});
          }),
        })
      )
    )
  );

  it("round-trips the shared boundary schemas", () => {
    assertSchemaArbitraryDecodesToSelf(PromotionSubjectRef, { numRuns: 25 });
    assertSchemaArbitraryDecodesToSelf(PromotionGateVerdict, { numRuns: 25 });
  });
});
