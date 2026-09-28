import { fcRuns } from "@beep/fc-runs";
import { FlightRecordCompositionInput, FlightRecordCompositionInputArbitrary } from "@beep/repo-ai-metrics";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as S from "effect/Schema";

const isFlightRecordCompositionInput = S.is(FlightRecordCompositionInput);

describe("flight record generation", () => {
  it.prop(
    "reconciles terminal outcomes and provenance in mechanical records",
    [FlightRecordCompositionInputArbitrary],
    ([input]) => {
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
    },
    { arbitrary: fcRuns(1000) }
  );
});
