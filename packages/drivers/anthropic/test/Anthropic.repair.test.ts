import { AnthropicToolJsonResponse, collectToolParamsJson, collectToolParamsJsonWithUsage } from "@beep/anthropic";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Stream } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { Response } from "effect/unstable/ai";

const JsonAnthropicToolJsonResponse = S.fromJsonString(AnthropicToolJsonResponse);
const AnthropicToolJsonResponseArbitrary = S.toArbitrary(AnthropicToolJsonResponse)(fc);

describe("Anthropic repair helpers", () => {
  it.effect(
    "collects streamed tool params until the end marker",
    Effect.fnUntraced(function* () {
      const json = yield* collectToolParamsJson(
        Stream.make(
          Response.makePart("tool-params-delta", { delta: '{"repairs":', id: "repair" }),
          Response.makePart("tool-params-delta", { delta: "[]}", id: "repair" }),
          Response.makePart("tool-params-end", { id: "repair" }),
          Response.makePart("tool-params-delta", { delta: "ignored", id: "repair" })
        )
      );

      expect(json).toBe('{"repairs":[]}');
    })
  );

  it.effect(
    "collects terminal repair usage and round-trips the result through JSON",
    Effect.fnUntraced(function* () {
      const result = yield* collectToolParamsJsonWithUsage(
        Stream.make(
          Response.makePart("tool-params-delta", { delta: '{"repairs":[]}', id: "repair" }),
          Response.makePart("tool-params-end", { id: "repair" }),
          Response.makePart("finish", {
            reason: "tool-calls",
            usage: Response.Usage.make({
              inputTokens: { cacheRead: 1, cacheWrite: 2, total: 7, uncached: 4 },
              outputTokens: { reasoning: undefined, text: 3, total: 3 },
            }),
          })
        )
      );

      expect(result.paramsJson).toBe('{"repairs":[]}');
      expect(result.usage.inputTokens.total).toBe(7);
      expect(result.usage.outputTokens.total).toBe(3);

      const encoded = yield* S.encodeEffect(JsonAnthropicToolJsonResponse)(result);
      const decoded = yield* S.decodeEffect(JsonAnthropicToolJsonResponse)(encoded);
      expect(yield* S.encodeEffect(JsonAnthropicToolJsonResponse)(decoded)).toBe(encoded);
    })
  );

  it.effect("round-trips schema-derived repair responses through JSON", () =>
    Effect.sync(() =>
      fc.assert(
        fc.property(AnthropicToolJsonResponseArbitrary, (response) => {
          const encoded = S.encodeOption(JsonAnthropicToolJsonResponse)(response);
          const reencoded = O.flatMap(encoded, (json) =>
            O.flatMap(
              S.decodeOption(JsonAnthropicToolJsonResponse)(json),
              S.encodeOption(JsonAnthropicToolJsonResponse)
            )
          );

          expect(O.isSome(encoded)).toBe(true);
          expect(reencoded).toStrictEqual(encoded);
        }),
        fcRuns(25)
      )
    )
  );
});
