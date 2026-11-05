import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { controlledLiteralScenes, controlledNativeScenes } from "./CitationCleanerCustom.fixtures.ts";
import { replayControlledCleanerScenes } from "./CitationCleanerCustomReplay.fixtures.ts";
import { loadCitationCleanerSource } from "./CitationCleanerSource.fixtures.ts";

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("controlled source callbacks", (it) => {
  it.effect("accounts for every controlled source scene exactly once across unit and hosted partitions", () =>
    Effect.gen(function* () {
      const corpus = yield* loadCitationCleanerSource();
      const source = A.filter(corpus.cases, (row) => row.family === "custom");
      const selected = [...controlledLiteralScenes, ...controlledNativeScenes];
      expect(source).toHaveLength(51);
      expect(selected).toHaveLength(51);
      for (const row of source)
        expect(
          A.filter(selected, (name) => name === row.name),
          row.name
        ).toHaveLength(1);
    })
  );
  it.effect("replays 40 non-HTML scenes with exact callback, iterator, hash and dispatch events", () =>
    Effect.gen(function* () {
      const citationResult1 = yield* replayControlledCleanerScenes(controlledLiteralScenes);
      expect(citationResult1).toEqual({
        scenes: 40,
        runs: 42,
        events: 114,
        safetyDivergences: 0,
      });
    })
  );
  it.effect("uses the actual builtin function handle as a mutable registry key without invoking native HTML", () =>
    Effect.gen(function* () {
      const citationResult2 = yield* replayControlledCleanerScenes(["registry-function-key"]);
      expect(citationResult2).toEqual({
        scenes: 1,
        runs: 1,
        events: 4,
        safetyDivergences: 0,
      });
    })
  );
});
