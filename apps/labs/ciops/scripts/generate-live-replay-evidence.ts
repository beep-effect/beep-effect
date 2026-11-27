import { BunRuntime } from "@effect/platform-bun";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  decodeEvidenceMode,
  EvidenceMode,
  EvidenceWriteScript,
  generateLiveReplayEvidence,
  run4FleetCanonicalWindow,
  run4FleetLiveEvidencePaths,
} from "@/projection/Evidence";
import type { LiveEvidenceRun } from "@/projection/Evidence";

const paths = run4FleetLiveEvidencePaths;

// decision: opt-in-evidence-writes
const generate = Effect.gen(function* () {
  const mode: EvidenceMode = yield* decodeEvidenceMode(
    process.argv,
    EvidenceWriteScript.Enum["evidence:s7-live:write"]
  );
  const run: LiveEvidenceRun = yield* generateLiveReplayEvidence(mode, paths, run4FleetCanonicalWindow);
  const { agreement } = run.summary.live;
  yield* Console.log(
    `${EvidenceMode.is.check(run.mode) ? "Checked" : "Wrote"} ${paths.evidence}: live first-choice agreement ${agreement.agreed} of ${agreement.total}; golden ${run.summary.golden.agreed} of ${run.summary.golden.total}.`
  );
}).pipe(Effect.withSpan("S7LiveEvidence.generate"));

const platform = Layer.merge(BunFileSystem.layer, BunCrypto.layer);

// strictEffectProvide bans Layer-provide outside composed entry layers: build the
// platform layer in a scope and provide the resulting Context to the run.
BunRuntime.runMain(
  platform.pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(generate, context)),
    Effect.scoped
  )
);
