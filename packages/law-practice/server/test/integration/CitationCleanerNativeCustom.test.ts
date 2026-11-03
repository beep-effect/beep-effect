import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { controlledNativeScenes } from "../CitationCleanerCustom.fixtures.ts";
import { replayControlledCleanerScenes } from "../CitationCleanerCustomReplay.fixtures.ts";
import { CitationNativeExitCounts, makeCitationObservedSpawner } from "../CitationNativeSpawner.fixtures.ts";

// Real-worker proof stays in hosted integration. No environment skip can green it.
it.layer(Layer.merge(BunServices.layer, BunCrypto.layer), { excludeTestServices: true })(
  "native controlled cleaner source scenes",
  (it) => {
    it.effect(
      "replays all eleven native/function scenes, withholds resource-truncated output and confirms every child exit",
      () =>
        Effect.gen(function* () {
          const native = yield* makeCitationObservedSpawner();
          const totals = yield* replayControlledCleanerScenes(controlledNativeScenes, native.spawner);
          expect(totals).toEqual({ scenes: 11, runs: 12, events: 79, safetyDivergences: 1 });
          const citationResult1 = yield* native.snapshot;
          expect(citationResult1).toEqual(CitationNativeExitCounts.make({ spawned: 10, confirmed: 10 }));
        }),
      { timeout: 180_000 }
    );
  }
);
