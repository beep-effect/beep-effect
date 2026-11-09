import * as Package from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

describe("@beep/agent-memory-store", () => {
  it.effect("resolves the package entry point through its alias", () =>
    Effect.sync(() => {
      expect(Package).toBeTypeOf("object");
    })
  );
});
