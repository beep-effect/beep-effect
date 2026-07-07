import { URLStr } from "@beep/schema/URL";
import { Str } from "@beep/utils";
import { VENICE_API_URL, VeniceAI, VeniceAIConfigInput } from "@beep/venice-ai";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Layer, pipe, Redacted } from "effect";
import * as O from "effect/Option";
import { FetchHttpClient } from "effect/unstable/http";

// Skip when the key is absent, blank, or an unresolved `op://` reference (present
// when secrets are not resolved, e.g. no local `op` session).
const apiKey = pipe(
  Bun.env.AI_VENICE_API_KEY,
  O.fromUndefinedOr,
  O.filter((value) => Str.isNonEmpty(value) && !Str.startsWith("op://")(value))
);

const makeLiveLayer = (key: string) =>
  VeniceAI.makeLayer(
    VeniceAIConfigInput.make({
      apiKey: O.some(Redacted.make(key)),
      baseUrl: URLStr.make(VENICE_API_URL),
    })
  ).pipe(Layer.provide(FetchHttpClient.layer));

pipe(
  apiKey,
  O.match({
    onNone: () =>
      describe("VeniceAI live integration (AI_VENICE_API_KEY)", () => {
        it("skips live API calls when AI_VENICE_API_KEY is absent", () => {
          expect(O.isNone(apiKey)).toBe(true);
        });
      }),
    onSome: (key) =>
      describe.concurrent("VeniceAI live integration", () => {
        layer(makeLiveLayer(key), { timeout: "30 seconds" })((it) => {
          it.effect(
            "lists models through the live Venice API",
            Effect.fnUntraced(function* () {
              const venice = yield* VeniceAI;
              const response = yield* venice.listModels();

              expect(response._tag).toBe("Json");
              expect(response.status).toBe(200);
            })
          );
        });
      }),
  })
);
