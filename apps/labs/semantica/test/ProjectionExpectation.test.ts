// @vitest-environment node

import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Layer, Option } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import { GProjectionExpectation } from "@/schema/Projection";

const GProjectionExpectationJson = S.fromJsonString(GProjectionExpectation);
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("G-projection expectations", () => {
  it("freezes the model, dimension, known neighbour, and non-empty SPARQL counts before C1", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const source = yield* fs.readFileString("fixtures/gold/v1/g-projection.json");
          const expected = yield* S.decodeEffect(GProjectionExpectationJson)(source);

          expect(expected.model.provider).toBe("openai");
          expect(expected.model.name).toBe("text-embedding-3-small");
          expect(Option.getOrThrow(expected.model.dimension)).toBe(1536);
          expect(expected.paper).toBe("057e356e94f8");
          expect(expected.knn.rank).toBe(1);
          expect(expected.knn.queryChunk).not.toBe(expected.knn.neighborChunk);
          expect(A.map(expected.sparql, (query) => query.expectedCount)).toEqual([577, 22]);
          expect(A.every(expected.sparql, (query) => query.expectedCount > 0)).toBe(true);
        })
      )
    ));
});
