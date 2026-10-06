import { Sha256Hex } from "@beep/schema/Sha256";
import { BunRuntime } from "@effect/platform-bun";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { Console, Effect, FileSystem, Layer } from "effect";
import { CiOpsProjection, CiOpsProjectionLive } from "@/projection/CiOpsProjection";
import { decodeEvidenceMode, EvidenceDriftError, EvidenceMode, EvidenceWriteScript } from "@/projection/Evidence";
import { GateOrderHandoffRef, PlanEpisodeInput } from "@/projection/Schemas";

const goldenPath = "test/fixtures/lane-plan-v1.ttl";
const writeScript: EvidenceWriteScript = EvidenceWriteScript.Enum["evidence:lane-plan:write"];

// The pinned handoff digest (P2 Ruling 2) and the fixed episode id no admission document uses
// (contract §8.3). Paths are relative to the lab directory, where the package scripts run.
const pinnedSha256 = Sha256Hex.make("705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198");
const episodeId = "lane-plan-golden-1";

// The lab's byte copy of the pinned handoff, the golden's input.
const fixtureInput = PlanEpisodeInput.make({
  episodeId,
  repoRoot: ".",
  handoff: GateOrderHandoffRef.make({ path: "test/fixtures/gate-order-handoff-v1.json", sha256: pinnedSha256 }),
});

// The live handoff, planned through the same §8.1 path on every run: a drifted document fails typed as
// `HandoffDigestMismatchError` naming the path, which is the uncached fallback P2 Ruling 2 relies on
// (the lab's Turbo inputs do not name the live file).
const liveInput = PlanEpisodeInput.make({
  episodeId,
  repoRoot: "../../..",
  handoff: GateOrderHandoffRef.make({
    path: "goals/time-to-certainty/research/gate-order-handoff.json",
    sha256: pinnedSha256,
  }),
});

const checkLiveHandoff = Effect.fnUntraced(function* () {
  const projection = yield* CiOpsProjection;
  const live = yield* projection.planEpisode(liveInput);
  yield* Console.log(`PASS: ${liveInput.handoff.path} still hashes to the pinned ${live.handoffSha256}`);
});

const checkGolden = Effect.fnUntraced(function* (content: string) {
  const fs = yield* FileSystem.FileSystem;
  const golden = yield* fs.readFileString(goldenPath);
  if (golden !== content) {
    return yield* EvidenceDriftError.make({
      path: goldenPath,
      message: "drifted from the emitted lane plan; run `bun run evidence:lane-plan:write`",
    });
  }
  yield* Console.log(`PASS: ${goldenPath} is byte-equal to the emitted lane plan`);
});

// Check-by-default: only `--write` regenerates the golden, and `--check --write` is a typed refusal.
// The live handoff is checked in both modes so a golden is never rewritten from a stale fixture.
const generate = Effect.gen(function* () {
  const mode: EvidenceMode = yield* decodeEvidenceMode(process.argv, writeScript);
  yield* checkLiveHandoff();
  const projection = yield* CiOpsProjection;
  const plan = yield* projection.planEpisode(fixtureInput);
  const document = yield* projection.emitLanePlan(plan);
  yield* Console.log(`lane plan ${plan.planId}: ${plan.laneSteps.length} lane steps`);
  if (EvidenceMode.is.write(mode)) {
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
