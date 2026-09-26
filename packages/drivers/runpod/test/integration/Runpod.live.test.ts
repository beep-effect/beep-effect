import { Runpod } from "@beep/runpod";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Config, Effect, Redacted } from "effect";
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

describe("@beep/runpod live", () => {
  it.layer(Runpod.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "lists pods when RUNPOD_API_KEY is configured",
      Effect.fnUntraced(function* (context) {
        const apiKey = yield* usableRunpodApiKey;
        if (O.isNone(apiKey)) {
          return context.skip();
        }

        const runpod = yield* Runpod;
        const pods = yield* runpod.listPods();
        expect(Array.isArray(pods)).toBe(true);
      })
    );
  });

  it.layer(Runpod.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "fetches the unauthenticated OpenAPI document",
      Effect.fnUntraced(function* (context) {
        const apiKey = yield* usableRunpodApiKey;
        if (O.isNone(apiKey)) {
          return context.skip();
        }

        const runpod = yield* Runpod;
        const openApi = yield* runpod.getOpenAPI();
        expect(openApi).toHaveProperty("openapi");
      })
    );
  });
});
