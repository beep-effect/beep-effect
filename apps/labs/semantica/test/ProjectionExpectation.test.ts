// @vitest-environment node

import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Option, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { GProjectionExpectation } from "@/schema/Projection";

const GProjectionExpectationJson = S.fromJsonString(GProjectionExpectation);
const decodeGProjectionExpectationJson = S.decodeEffect(GProjectionExpectationJson);
describe("G-projection expectations", () => {
  it.layer(BunServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("freezes the model, dimension, known neighbour, and non-empty SPARQL counts before C1", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const source = yield* fs.readFileString("fixtures/gold/v1/g-projection.json");
        const expected = yield* decodeGProjectionExpectationJson(source);

        expect(expected.model.provider).toBe("openai");
        expect(expected.model.name).toBe("text-embedding-3-small");
        expect(Option.getOrThrow(expected.model.dimension)).toBe(1536);
        expect(expected.paper).toBe("057e356e94f8");
        expect(expected.knn.rank).toBe(1);
        expect(expected.knn.queryChunk).not.toBe(expected.knn.neighborChunk);
        expect(A.map(expected.sparql, (query) => query.expectedCount)).toEqual([577, 22]);
        pipe(
          A.every(expected.sparql, (query) => query.expectedCount > 0),
          assertTrue
        );
      })
    );
  });
});
