import { CosmosDriverError } from "@beep/cosmos";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameCosmosDriverError = S.toEquivalence(CosmosDriverError);

describe("Cosmos declared-field equivalence", () => {
  it("treats field-equal CosmosDriverError instances as equivalent and field-different ones as distinct", () => {
    const a = CosmosDriverError.make({ message: "renderer failed", reason: "renderFailed" });
    const b = CosmosDriverError.make({ message: "renderer failed", reason: "renderFailed" });
    const c = CosmosDriverError.make({ message: "renderer failed again", reason: "renderFailed" });

    expect(sameCosmosDriverError(a, b)).toBe(true);
    expect(sameCosmosDriverError(a, c)).toBe(false);
  });
});
