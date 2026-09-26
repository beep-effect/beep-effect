import {
  ToolNameCandidate,
  ToolNameNormalizationError,
  ToolNameRegistrationError,
} from "@beep/gov-legal-mcp/ToolNames";
import { GovinfoSearchFailure } from "@beep/gov-legal-mcp/Tools";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const decodeGovinfoSearchFailure = S.decodeEffect(GovinfoSearchFailure);
const decodeToolNameNormalizationError = S.decodeEffect(ToolNameNormalizationError);
const decodeExpectedWireName = S.decodeEffect(ToolNameRegistrationError.fields.expectedWireName);
const encodeGovinfoSearchFailure = S.encodeEffect(GovinfoSearchFailure);
const encodeToolNameNormalizationError = S.encodeEffect(ToolNameNormalizationError);

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

  it.effect(
    "treats field-equal ToolNameRegistrationError instances as equivalent and field-different ones as distinct",
    Effect.fnUntraced(function* () {
      const candidate = ToolNameCandidate.make({ operationId: "search", source: "govinfo" });
      const expectedWireName = yield* decodeExpectedWireName("govinfo_search");
      const a = ToolNameRegistrationError.make({
        candidate,
        expectedWireName,
        message: "declaration missing from production report",
        reason: "missing_candidate",
      });
      const b = ToolNameRegistrationError.make({
        candidate,
        expectedWireName,
        message: "declaration missing from production report",
        reason: "missing_candidate",
      });
      const c = ToolNameRegistrationError.make({
        candidate,
        expectedWireName,
        message: "declaration missing from production report",
        reason: "wire_name_drift",
      });

      expect(sameRegistrationError(a, b)).toBe(true);
      expect(sameRegistrationError(a, c)).toBe(false);
    })
  );

  it.effect(
    "round-trips schema-derived error values under the declared comparator",
    Effect.fnUntraced(function* () {
      const searchResult = yield* Arbitrary.checkEffect(
        Arbitrary.all([Arbitrary.schema(GovinfoSearchFailure)]),
        ([value]) =>
          encodeGovinfoSearchFailure(value).pipe(
            Effect.flatMap(decodeGovinfoSearchFailure),
            Effect.map((decoded) => sameGovinfoSearchFailure(decoded, value))
          ),
        fcRuns(25)
      );
      const normalizationResult = yield* Arbitrary.checkEffect(
        Arbitrary.all([Arbitrary.schema(ToolNameNormalizationError)]),
        ([value]) =>
          encodeToolNameNormalizationError(value).pipe(
            Effect.flatMap(decodeToolNameNormalizationError),
            Effect.map((decoded) => sameNormalizationError(decoded, value))
          ),
        fcRuns(25)
      );

      expect(searchResult).toMatchObject({ _tag: "Passed" });
      expect(normalizationResult).toMatchObject({ _tag: "Passed" });
    })
  );
});
