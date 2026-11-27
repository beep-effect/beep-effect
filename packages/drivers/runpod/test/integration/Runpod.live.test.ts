import { Runpod } from "@beep/runpod";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";

const isResolvedNonEmptyKey = (value: Redacted.Redacted<string>): boolean => {
  const raw = Redacted.value(value);
  return Str.isNonEmpty(raw) && !Str.startsWith("op://")(raw);
};

const usableRunpodApiKey = Config.Redacted("RUNPOD_API_KEY").pipe(
  Config.option,
  Effect.map(O.filter(isResolvedNonEmptyKey))
);

describe("@beep/runpod live", () => {
  it.layer(Runpod.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "lists one page of pods when RUNPOD_API_KEY is set, non-empty and not an unresolved 1Password op:// reference",
      Effect.fnUntraced(function* (context) {
        const apiKey = yield* usableRunpodApiKey;
        if (O.isNone(apiKey)) {
          return context.skip();
        }

        const runpod = yield* Runpod;
        const page = yield* runpod.listPods();
        expect(A.isArray(page.pods)).toBe(true);
        expect(typeof page.pagination.hasNextPage).toBe("boolean");
      })
    );
  });

  it.layer(Runpod.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "fetches the unauthenticated REST API v2 OpenAPI document",
      Effect.fnUntraced(function* () {
        const runpod = yield* Runpod;
        const openApi = yield* runpod.getOpenApi();
        expect(openApi.openapi).toBe("3.1.0");
        expect(openApi).toHaveProperty("paths");
      })
    );
  });
});
