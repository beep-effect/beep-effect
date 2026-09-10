import {
  ToolNameCandidate,
  ToolNameNormalizationError,
  ToolNameRegistrationError,
} from "@beep/gov-legal-mcp/ToolNames";
import { GovinfoSearchFailure } from "@beep/gov-legal-mcp/Tools";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { flow } from "effect";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeGovinfoSearchFailureSync = S.decodeSync(GovinfoSearchFailure);
const decodeToolNameNormalizationErrorSync = S.decodeSync(ToolNameNormalizationError);
const decodeToolNameRegistrationErrorFieldsExpectedWireNameSync = S.decodeSync(
  ToolNameRegistrationError.fields.expectedWireName
);
const encodeGovinfoSearchFailureSync = S.encodeSync(GovinfoSearchFailure);
const encodeToolNameNormalizationErrorSync = S.encodeSync(ToolNameNormalizationError);

const sameGovinfoSearchFailure = S.toEquivalence(GovinfoSearchFailure);
const sameNormalizationError = S.toEquivalence(ToolNameNormalizationError);
const sameRegistrationError = S.toEquivalence(ToolNameRegistrationError);

describe("gov-legal-mcp declared-field equivalence", () => {
  it("treats field-equal GovinfoSearchFailure instances as equivalent and field-different ones as distinct", () => {
    const a = GovinfoSearchFailure.make({ reason: "transport" });
    const b = GovinfoSearchFailure.make({ reason: "transport" });
    const c = GovinfoSearchFailure.make({ reason: "response status" });

    expect(sameGovinfoSearchFailure(a, b)).toBe(true);
    expect(sameGovinfoSearchFailure(a, c)).toBe(false);
  });

  it("treats field-equal ToolNameNormalizationError instances as equivalent and field-different ones as distinct", () => {
    const a = ToolNameNormalizationError.make({
      candidate: "search.results",
      message: "normalized name is empty",
      normalized: "",
      reason: "empty_normalized",
    });
    const b = ToolNameNormalizationError.make({
      candidate: "search.results",
      message: "normalized name is empty",
      normalized: "",
      reason: "empty_normalized",
    });
    const c = ToolNameNormalizationError.make({
      candidate: "search.results",
      message: "normalized name is empty",
      normalized: "",
      reason: "invalid_normalized",
    });

    expect(sameNormalizationError(a, b)).toBe(true);
    expect(sameNormalizationError(a, c)).toBe(false);
  });

  it("treats field-equal ToolNameRegistrationError instances as equivalent and field-different ones as distinct", () => {
    const candidate = ToolNameCandidate.make({ operationId: "search", source: "govinfo" });
    const a = ToolNameRegistrationError.make({
      candidate,
      expectedWireName: decodeToolNameRegistrationErrorFieldsExpectedWireNameSync("govinfo_search"),
      message: "declaration missing from production report",
      reason: "missing_candidate",
    });
    const b = ToolNameRegistrationError.make({
      candidate,
      expectedWireName: decodeToolNameRegistrationErrorFieldsExpectedWireNameSync("govinfo_search"),
      message: "declaration missing from production report",
      reason: "missing_candidate",
    });
    const c = ToolNameRegistrationError.make({
      candidate,
      expectedWireName: decodeToolNameRegistrationErrorFieldsExpectedWireNameSync("govinfo_search"),
      message: "declaration missing from production report",
      reason: "wire_name_drift",
    });

    expect(sameRegistrationError(a, b)).toBe(true);
    expect(sameRegistrationError(a, c)).toBe(false);
  });

  it("round-trips schema-derived error values under the declared comparator", () => {
    const roundTripSearchFailure = flow(encodeGovinfoSearchFailureSync, decodeGovinfoSearchFailureSync);
    const roundTripNormalizationError = flow(
      encodeToolNameNormalizationErrorSync,
      decodeToolNameNormalizationErrorSync
    );

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(GovinfoSearchFailure)]),
          ([value]) => {
            expect(sameGovinfoSearchFailure(roundTripSearchFailure(value), value)).toBe(true);

            return true;
          },
          fcRuns(25)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(ToolNameNormalizationError)]),
          ([value]) => {
            expect(sameNormalizationError(roundTripNormalizationError(value), value)).toBe(true);

            return true;
          },
          fcRuns(25)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });
});
