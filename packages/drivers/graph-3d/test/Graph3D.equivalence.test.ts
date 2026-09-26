import { Graph3DDriverError } from "@beep/graph-3d";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as S from "effect/Schema";

const sameGraph3DDriverError = S.toEquivalence(Graph3DDriverError);

describe("Graph3D declared-field equivalence", () => {
  it("treats field-equal Graph3DDriverError instances as equivalent and field-different ones as distinct", () => {
    const a = Graph3DDriverError.make({ message: "renderer failed", reason: "renderFailed" });
    const b = Graph3DDriverError.make({ message: "renderer failed", reason: "renderFailed" });
    const c = Graph3DDriverError.make({ message: "renderer failed again", reason: "renderFailed" });

    expect(sameGraph3DDriverError(a, b)).toBe(true);
    expect(sameGraph3DDriverError(a, c)).toBe(false);
  });
});
