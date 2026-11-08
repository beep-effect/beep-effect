import * as Package from "@beep/execution-authority-server";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

describe("@beep/execution-authority-server", () => {
  it.effect("resolves the package entry point through its alias", () =>
    Effect.sync(() => {
      expect(Package).toBeTypeOf("object");
    })
  );
});
