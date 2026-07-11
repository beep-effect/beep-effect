import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

describe("@beep/oxigraph lazy service surface", () => {
  it.effect(
    "imports the live layer without constructing an Oxigraph store",
    Effect.fnUntraced(function* () {
      expect(OxigraphSparqlQueryServiceLive).toBeDefined();
    })
  );
});
