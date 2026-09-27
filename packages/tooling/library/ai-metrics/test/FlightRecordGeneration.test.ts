import { fcRuns } from "@beep/fc-runs";
import { FlightRecordCompositionInput, FlightRecordCompositionInputArbitrary } from "@beep/repo-ai-metrics";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const isFlightRecordCompositionInput = S.is(FlightRecordCompositionInput);

describe("flight record generation", () => {
  it.effect("reconciles terminal outcomes and provenance in mechanical records", () =>
    Effect.gen(function* () {
      const result = yield* Arbitrary.checkEffect(
        FlightRecordCompositionInputArbitrary,
        (input) => {
          pipe(isFlightRecordCompositionInput(input), assertTrue);
          const mechanical = input.mechanical;
          expect(mechanical).toBeDefined();
          if (mechanical === undefined) throw new Error("Missing generated mechanical record");
          if (mechanical.lifecycleState === "terminal") {
            expect(mechanical.terminalOutcome).not.toBe("none");
            expect(mechanical.terminalProvenance).not.toBe("none");
          } else {
            expect(mechanical.terminalOutcome).toBe("none");
            expect(mechanical.terminalProvenance).toBe("none");
          }
          return true;
        },
        fcRuns(1000)
      );
      expect(result._tag).toBe("Passed");
    })
  );
});
