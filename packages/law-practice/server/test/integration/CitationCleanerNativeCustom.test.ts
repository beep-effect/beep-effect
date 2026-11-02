import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import { controlledNativeScenes } from "../CitationCleanerCustom.fixtures.ts";
import { replayControlledCleanerScenes } from "../CitationCleanerCustomReplay.fixtures.ts";

// Real-worker proof stays in hosted integration. No environment skip can green it.
it.layer(Layer.merge(BunServices.layer, BunCrypto.layer), { excludeTestServices: true })(
  "native controlled cleaner source scenes",
  (it) => {
    it.effect(
      "replays all eleven native/function scenes, withholds resource-truncated output and confirms every child exit",
      () =>
        Effect.gen(function* () {
          const real = yield* ChildProcessSpawner;
          let spawned = 0;
          let confirmed = 0;
          const spawner = ChildProcessSpawner.of({
            ...real,
            spawn: Effect.fn("NativeCustomTest.spawn")((command) =>
              real.spawn(command).pipe(
                Effect.map((handle) => {
                  spawned++;
                  let seen = false;
                  return {
                    ...handle,
                    isRunning: handle.isRunning.pipe(
                      Effect.tap((running) =>
                        Effect.sync(() => {
                          if (!running && !seen) {
                            expect(() => process.kill(handle.pid, 0)).toThrow();
                            seen = true;
                            confirmed++;
                          }
                        })
                      )
                    ),
                  };
                })
              )
            ),
          });
          const totals = yield* replayControlledCleanerScenes(controlledNativeScenes, spawner);
          expect(totals).toEqual({ scenes: 11, runs: 12, events: 59, safetyDivergences: 1 });
          expect({ spawned, confirmed }).toEqual({ spawned: 10, confirmed: 10 });
        }),
      { timeout: 180_000 }
    );
  }
);
