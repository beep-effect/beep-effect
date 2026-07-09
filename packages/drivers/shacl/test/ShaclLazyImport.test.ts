import { ShaclValidationServiceLive } from "@beep/shacl";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

describe("@beep/shacl lazy service surface", () => {
  it.effect(
    "imports the live layer without constructing a SHACL validator",
    Effect.fnUntraced(function* () {
      expect(ShaclValidationServiceLive).toBeDefined();
    })
  );
});
