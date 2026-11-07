import { prepareCitationCallbackInput } from "@beep/law-practice-server/internal/Citation/CallbackInput";
import {
  CitationCallbackFailure,
  copyCitationCallbackFailure,
} from "@beep/law-practice-server/internal/Citation/CallbackResource";
import { makeCitationResolutionWork } from "@beep/law-practice-server/internal/Citation/CallbackSession";
import { prepareCitationResolution } from "@beep/law-practice-server/internal/Citation/ResolutionInput";
import { resolveCitationMentions } from "@beep/law-practice-server/internal/Citation/Resolve";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { CitationCallbackObservation, prepareCallbackObservation } from "./CitationCallbackSession.fixtures.ts";

const Json = S.fromJsonString(CitationCallbackFailure);
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("resolution budget identity", (it) => {
  it.effect("identifies source and mention admission before either resolver runs", () =>
    Effect.gen(function* () {
      const input = yield* prepareCallbackObservation(
        CitationCallbackObservation.make({
          name: "limit-identity",
          kinds: ["id", "id"],
          pages: {},
          bindings: {},
          events: [],
          outcome: { status: "value", groups: [] },
        })
      );
      for (const [field, maximum] of [
        ["mentions", 1],
        ["sourceUtf16", 1],
      ] as const) {
        const request = { ...input, limits: { ...input.limits, [field]: maximum } };
        const prepared = yield* prepareCitationResolution(request).pipe(Effect.flip);
        const callback = yield* prepareCitationCallbackInput(request).pipe(Effect.flip);
        const resolved = yield* resolveCitationMentions(request).pipe(Effect.flip);
        for (const failure of [prepared, callback, resolved])
          expect(failure).toMatchObject({ reason: "limit-exceeded", limit: field });
      }
    })
  );
  it.effect(
    "preserves exact work limits and strips incidental callback payloads without inventing missing limits",
    () =>
      Effect.gen(function* () {
        const defaults = (yield* defaultCitationEnginePolicy).limits;
        const work = yield* makeCitationResolutionWork({ ...defaults, resolutionIterations: 1 });
        yield* work.step;
        const exhausted = yield* work.step.pipe(Effect.flip);
        expect(exhausted).toMatchObject({ reason: "limit-exceeded", limit: "resolutionIterations" });
        Reflect.set(exhausted, "sourceText", "private source");
        Reflect.set(exhausted, "cause", { message: "private cause" });
        const copy = copyCitationCallbackFailure(exhausted);
        expect(copy).toMatchObject({ reason: "limit-exceeded", limit: "resolutionIterations" });
        const json = yield* S.encodeEffect(Json)(copy);
        expect(json).not.toContain("private");
        expect("sourceText" in copy).toBe(false);
        expect("cause" in copy).toBe(false);
        const legacy = copyCitationCallbackFailure(CitationCallbackFailure.make({ reason: "limit-exceeded" }));
        expect("limit" in legacy).toBe(false);
      })
  );
});
