import { assertSchemaArbitraryDecodesToSelf, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("schema test helpers", () => {
  it.prop(
    "accepts schema inputs and nested run options",
    [S.Literal("ready")],
    ([status]) => {
      expect(status).toBe("ready");
    },
    { arbitrary: fcRuns(5) }
  );

  it("fails when a generated type value cannot decode through the codec", () => {
    // @effect-diagnostics-next-line schemaNumber:off -- the transformed codec is the deliberate failure input
    expect(() => assertSchemaArbitraryDecodesToSelf(S.NumberFromString, { runs: 1, seed: 42 })).toThrow();
  });

  it("asserts that schema-derived arbitrary values decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(S.Literal("ready"), { runs: 5 });
  });

  it("supports object-valued class schemas", () => {
    class ExamplePayload extends S.Class<ExamplePayload>("ExamplePayload")({
      count: S.Literal(1),
      status: S.Literal("ready"),
    }) {}

    assertSchemaArbitraryDecodesToSelf(ExamplePayload, { runs: 5 });
  });
});
