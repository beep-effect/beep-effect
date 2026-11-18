import { makeStrictGate } from "@beep/observability/strict";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Order from "effect/Order";
import refusalTagsGolden from "./__golden__/strict-refusal-tags.json" with { type: "json" };
import keysGolden from "./__golden__/strict-shape-only.keys.json" with { type: "json" };
import { representativeLogs, representativeMetrics, representativeTraces } from "./support/StrictGate.batches.ts";
import { bodyJson, demoConfig, exportedKeySet, layerTestSalt } from "./support/StrictGate.harness.ts";

describe("StrictGate golden", () => {
  it.layer(layerTestSalt, { timeout: "10 seconds" })((it) => {
    it.effect("exports exactly the golden shape-only key set and refuses with exactly the golden tags", () =>
      Effect.gen(function* () {
        const strict = yield* makeStrictGate(demoConfig());
        const bodies = yield* Effect.all(
          [
            bodyJson(strict.serialization.traces(representativeTraces())),
            bodyJson(strict.serialization.metrics(representativeMetrics())),
            bodyJson(strict.serialization.logs(representativeLogs())),
          ],
          { concurrency: 1 }
        );
        const tags = yield* strict.ledger.pipe(
          Effect.map((ledger) => ledger.pipe(HashMap.keys, A.fromIterable, A.sort(Order.String)))
        );

        expect(exportedKeySet(bodies)).toEqual(keysGolden);
        expect(tags).toEqual(refusalTagsGolden);
      })
    );
  });
});
