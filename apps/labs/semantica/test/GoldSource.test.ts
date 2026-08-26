// @vitest-environment node

import { Sha256Hex } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Layer, Order, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";
import { GOLD_SUBSETS } from "@/canary/Gold";
import { CorpusPaperId } from "@/corpus/Manifest";
import { GoldSourceLive } from "@/layers/GoldSourceLive";
import { contentDigest } from "@/schema/Digest";
import { GoldUnavailable } from "@/schema/Errors";
import { GoldFile, GoldRef, GoldSubset } from "@/schema/Gold";
import { ModelIdentity } from "@/schema/Model";
import { GoldSource } from "@/services/GoldSource";
import type { GoldFile as GoldFileValue } from "@/schema/Gold";

const GoldFileJson = S.fromJsonString(GoldFile, { space: 2 });
const GoldRefJson = S.fromJsonString(GoldRef, { space: 2 });
const goldFileOrder = Order.mapInput(Order.String, (file: GoldFileValue) => `${file.paperId}:${file.subset}`);
const goldPapers = A.map(
  [
    "000000000001",
    "000000000002",
    "000000000003",
    "000000000004",
    "000000000005",
    "000000000006",
    "000000000007",
    "000000000008",
    "000000000009",
    "00000000000a",
  ],
  (id) => CorpusPaperId.make(id)
);
const subsets = GoldSubset.make({
  structure: goldPapers,
  entity: A.take(goldPapers, 5),
  relation: A.take(goldPapers, 3),
});
const proposer = ModelIdentity.make({
  artifactHash: Sha256Hex.make("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
  name: "stub-gold-20260826",
  provider: "xai",
  revision: "stub-gold-20260826",
  taskType: "gold-proposal",
});

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const writeGoldFixture = Effect.fn("GoldSourceTest.writeFixture")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = A.sort(
    yield* Effect.forEach(
      A.flatMap(GOLD_SUBSETS, (subset) => A.map(subsets[subset], (paperId) => ({ paperId, subset }))),
      ({ paperId, subset }) => S.decodeEffect(GoldFile)({ labels: [], paperId, proposer, subset, version: "gold/v1" })
    ),
    goldFileOrder
  );
  yield* Effect.forEach(files, (file) =>
    S.encodeEffect(GoldFileJson)(file).pipe(
      Effect.flatMap((json) =>
        fs.writeFileString(path.join(directory, `${file.paperId}.${file.subset}.json`), `${json}\n`)
      )
    )
  );
  const digest = yield* contentDigest(S.Array(GoldFile))(files);
  const reference = GoldRef.make({
    digest,
    proposer,
    spotCheckedFraction: UnitInterval.make(0),
    subsets,
    version: "gold/v1",
  });
  const referenceJson = yield* S.encodeEffect(GoldRefJson)(reference);
  yield* fs.writeFileString(path.join(directory, "gold.json"), `${referenceJson}\n`);
  return files;
});

describe("C0 gold source", () => {
  it("generates schema-valid gold source paper ids", () => {
    fc.assert(
      fc.property(S.toArbitrary(CorpusPaperId)(fc), (paperId) => S.is(CorpusPaperId)(paperId)),
      { numRuns: 20 }
    );
  });

  it("loads selected files after verifying the complete gold reference", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const directory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-source-" });
            yield* writeGoldFixture(directory);

            const loaded = yield* GoldSource.pipe(
              Effect.flatMap((source) => source.load([A.getUnsafe(goldPapers, 0)])),
              provideScopedLayer(GoldSourceLive(directory))
            );

            expect(loaded).toHaveLength(3);
          })
        )
      )
    ));

  it("fails typed when a covered label file no longer matches gold.json", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const directory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-stale-reference-" });
            yield* writeGoldFixture(directory);
            const paperId = A.getUnsafe(goldPapers, 0);
            const tampered = yield* S.decodeEffect(GoldFile)({
              labels: [
                {
                  depth: 0,
                  endChar: 4,
                  quote: "Test",
                  role: "title",
                  startChar: 0,
                  verified: false,
                },
              ],
              paperId,
              proposer,
              subset: "structure",
              version: "gold/v1",
            });
            const tamperedJson = yield* S.encodeEffect(GoldFileJson)(tampered);
            yield* fs.writeFileString(path.join(directory, `${paperId}.structure.json`), `${tamperedJson}\n`);

            const error = yield* GoldSource.pipe(
              Effect.flatMap((source) => source.load([paperId])),
              provideScopedLayer(GoldSourceLive(directory)),
              Effect.flip
            );

            expect(error).toBeInstanceOf(GoldUnavailable);
            expect(error.reason).toBe("stale-reference");
          })
        )
      )
    ));
});
