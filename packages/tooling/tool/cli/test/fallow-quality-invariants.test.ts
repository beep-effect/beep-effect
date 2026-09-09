import { reportInvariantDiagnosticsForTesting } from "@beep/repo-cli/test/Quality";
import { expect, it } from "vitest";

it("reports malformed Fallow failure attribution and exit invariants", () => {
  expect(
    reportInvariantDiagnosticsForTesting({
      attributionKinds: [],
      exitStatus: 1,
      findingAttributionSummary: {
        inheritedAdjacent: 2,
        introduced: 1,
        notApplicable: 3,
      },
      status: "tool-failed",
    })
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining("introduced attribution count must be 0"),
      expect.stringContaining("inheritedAdjacent attribution count must be 0"),
      expect.stringContaining("notApplicable attribution count must be 0"),
      expect.stringContaining("attributionKinds"),
    ])
  );

  expect(
    reportInvariantDiagnosticsForTesting({
      attributionKinds: ["not-applicable"],
      exitStatus: 0,
      findingAttributionSummary: {
        inheritedAdjacent: 0,
        introduced: 0,
        notApplicable: 0,
      },
      status: "tool-failed",
    })
  ).toEqual(["Fallow tool-failed envelope exitStatus must be positive."]);
});
