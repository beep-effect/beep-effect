import { BunRuntime } from "@effect/platform-bun";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { Console, Effect, Layer } from "effect";
import {
  decodeEvidenceMode,
  EvidenceMode,
  generateLiveReplayEvidence,
  run4FleetCanonicalWindow,
  run4FleetLiveEvidencePaths,
} from "@/projection/Evidence";
import type { LiveEvidenceRun } from "@/projection/Evidence";

// The pin's typed constants (P2 Ruling 9) live in `Evidence.ts`, shared with the
// end-to-end test. The run asserts both digests against the files and the window
// members against MANIFEST.yaml's `admission_roots[0].window` and
// `loss_population.chain_counts` before replay.
const paths = run4FleetLiveEvidencePaths;

// Check-by-default: the bare script compares the committed evidence bytes with
// the recomputed render; only `--write` rewrites the file.
const generate = Effect.gen(function* () {
  const mode: EvidenceMode = yield* decodeEvidenceMode(process.argv);
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
  Layer.build(platform).pipe(
    Effect.flatMap((context) => Effect.provide(generate, context)),
    Effect.scoped
  )
);
