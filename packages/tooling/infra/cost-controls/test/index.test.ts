import * as Package from "@beep/infra-cost-controls";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

describe("@beep/infra-cost-controls", () => {
  it.effect("resolves the package entry point through its alias", () =>
    Effect.sync(() => {
      expect(Package).toBeTypeOf("object");
    })
  );
});
