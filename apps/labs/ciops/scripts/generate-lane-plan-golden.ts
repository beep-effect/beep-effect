import { Sha256Hex } from "@beep/schema/Sha256";
import { BunRuntime } from "@effect/platform-bun";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { Console, Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import { CiOpsProjection, CiOpsProjectionLive } from "@/projection/CiOpsProjection";
import { GateOrderHandoffRef, PlanEpisodeInput } from "@/projection/Schemas";

const goldenPath = "test/fixtures/lane-plan-v1.ttl";

// The lab's byte copy of the pinned handoff (P2 Ruling 2), planned under a fixed episode id that no
// admission document uses (contract §8.3), from the lab directory as the package scripts run it.
const input = PlanEpisodeInput.make({
  episodeId: "lane-plan-golden-1",
  repoRoot: ".",
  handoff: GateOrderHandoffRef.make({
    path: "test/fixtures/gate-order-handoff-v1.json",
    sha256: Sha256Hex.make("705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198"),
  }),
});

const checkGolden = Effect.fnUntraced(function* (content: string) {
  const fs = yield* FileSystem.FileSystem;
  const golden = yield* fs.readFileString(goldenPath);
  if (golden !== content) {
    return yield* Effect.die(
      `${goldenPath} drifted from the emitted lane plan; run \`bun run evidence:lane-plan:write\`.`
    );
  }
  yield* Console.log(`PASS: ${goldenPath} is byte-equal to the emitted lane plan`);
});

// Check-by-default: only `--write` regenerates the golden.
const generate = Effect.gen(function* () {
  const projection = yield* CiOpsProjection;
  const plan = yield* projection.planEpisode(input);
  const document = yield* projection.emitLanePlan(plan);
  yield* Console.log(`lane plan ${plan.planId}: ${plan.laneSteps.length} lane steps`);
  if (A.contains(process.argv, "--write")) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(goldenPath, document.content);
    return yield* Console.log(`wrote ${goldenPath}`);
  }
  return yield* checkGolden(document.content);
}).pipe(Effect.withSpan("LanePlanGolden.generate"));

// strictEffectProvide bans Layer-provide outside composed entry layers, so the
// scoped context build below provides the platform and service as a Context.
BunRuntime.runMain(
  Effect.scoped(
    Effect.flatMap(
      Layer.build(CiOpsProjectionLive.pipe(Layer.provideMerge(Layer.merge(BunFileSystem.layer, BunCrypto.layer)))),
      (context) => Effect.provide(generate, context)
    )
  )
);
