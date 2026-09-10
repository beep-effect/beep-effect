import { Runpod } from "@beep/runpod";
import { describe, expect, it } from "@effect/vitest";
import { Config, Effect, Layer, Redacted } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

// Resolve RUNPOD_API_KEY, treating absent, blank, or unresolved `op://` reference
// values (present when secrets are not resolved, e.g. no local `op` session) as
// not configured so live calls are skipped instead of authenticating with a
// non-token.
const usableRunpodApiKey = Config.Redacted("RUNPOD_API_KEY").pipe(
  Config.option,
  Effect.map(
    O.filter((value) => {
      const raw = Redacted.value(value);
      return Str.isNonEmpty(raw) && !Str.startsWith("op://")(raw);
    })
  )
);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("@beep/runpod live", () => {
  it.effect(
    "lists pods when RUNPOD_API_KEY is configured",
    Effect.fnUntraced(function* () {
      const apiKey = yield* usableRunpodApiKey;
      if (O.isNone(apiKey)) {
        return;
      }

      const runpod = yield* Runpod;
      const pods = yield* runpod.listPods();
      expect(Array.isArray(pods)).toBe(true);
    }, provideScopedLayer(Runpod.layer))
  );

  it.effect(
    "fetches the unauthenticated OpenAPI document",
    Effect.fnUntraced(function* () {
      const apiKey = yield* usableRunpodApiKey;
      if (O.isNone(apiKey)) {
        return;
      }

      const runpod = yield* Runpod;
      const openApi = yield* runpod.getOpenAPI();
      expect(openApi).toHaveProperty("openapi");
    }, provideScopedLayer(Runpod.layer))
  );
});
