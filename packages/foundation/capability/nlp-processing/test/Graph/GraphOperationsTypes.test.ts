import { Types } from "@beep/nlp-processing/Graph/GraphOperations";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Duration from "effect/Duration";

const costOf = (complexity: "O(n log n)" | "O(n^2)") =>
  Types.OperationCost.cases[complexity].make({
    estimatedTime: Duration.millis(1),
    memoryCost: 1,
    tokenCost: 1,
  });

describe("graph operation types", () => {
  it("scales a cost by its complexity class", () => {
    expect(Duration.toMillis(Types.OperationCost.scale(costOf("O(n log n)"), 8).estimatedTime)).toBe(24);
    expect(Duration.toMillis(Types.OperationCost.scale(4)(costOf("O(n^2)")).estimatedTime)).toBe(16);
  });

  it("builds execution options for each strategy", () => {
    expect(Types.ExecutionOptions.default().strategy._tag).toBe(Types.ExecutionOptions.make({}).strategy._tag);
    expect(Types.ExecutionOptions.sequential().strategy._tag).toBe("Sequential");
    expect(Types.ExecutionOptions.parallel().strategy).toEqual(Types.ExecutionStrategy.Parallel(4));
    expect(Types.ExecutionOptions.parallel(2).strategy).toEqual(Types.ExecutionStrategy.Parallel(2));
    expect(Types.ExecutionStrategy.Batch(16)._tag).toBe("Batch");
  });

  it("reports an invalid result with its errors and no warnings", () => {
    const invalid = Types.ValidationResult.invalid(["missing node"]);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toEqual(["missing node"]);
    expect(invalid.warnings).toEqual([]);
  });
});
