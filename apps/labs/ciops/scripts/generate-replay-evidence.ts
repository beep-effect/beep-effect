import { BunRuntime } from "@effect/platform-bun";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { Console, Effect, Layer } from "effect";
import {
  decodeEvidenceMode,
  EvidenceMode,
  EvidencePaths,
  EvidenceWriteScript,
  generateReplayEvidence,
} from "@/projection/Evidence";
import type { EvidenceRun } from "@/projection/Evidence";

const paths = EvidencePaths.make({
  abox: "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl",
  journal: "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson",
  evidence: "../../../explorations/beep-ci-operational-ontology/research/s7-replay-evidence.md",
});

// The committed evidence is a frozen dated record, so writing is opt-in:
// only `--write` regenerates it, and only after the replay matched. The
// default (check) mode prints the recomputed report instead of writing it.
const generate = Effect.gen(function* () {
  const mode: EvidenceMode = yield* decodeEvidenceMode(process.argv, EvidenceWriteScript.Enum["evidence:s7:write"]);
  const run: EvidenceRun = yield* generateReplayEvidence(mode, paths);
  if (EvidenceMode.is.check(run.mode)) {
    yield* Console.log(run.rendered);
  }
}).pipe(Effect.withSpan("S7Evidence.generate"));

// strictEffectProvide bans Layer-provide outside composed entry layers, so the
// scoped context build below provides the file system as a Context instead.
BunRuntime.runMain(
  Effect.scoped(
    Effect.flatMap(Layer.build(Layer.merge(BunFileSystem.layer, BunCrypto.layer)), (context) =>
      Effect.provide(generate, context)
    )
  )
);
