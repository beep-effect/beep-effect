import { BunRuntime } from "@effect/platform-bun";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { Console, Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import { decodeAdmissionPolicyParams } from "@/projection/AboxPolicy";
import {
  decodeAdmissionJournal,
  renderReplayEvidence,
  replayAdmissionJournal,
  requireReplayMatch,
} from "@/projection/Replay";
import { PolicyDecodeError } from "@/projection/Schemas";

const aboxPath = "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl";
const journalPath =
  "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson";
const evidencePath = "../../../explorations/beep-ci-operational-ontology/research/s7-replay-evidence.md";

const ioFailure = (operation: string, path: string) =>
  PolicyDecodeError.make({ message: `Failed to ${operation} repo-relative artifact "${path}".` });

const readArtifact = Effect.fn("S7Evidence.readArtifact")(function* (
  path: string
): Effect.fn.Return<string, PolicyDecodeError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(path).pipe(Effect.mapError(() => ioFailure("read", path)));
});

const writeEvidence = Effect.fn("S7Evidence.writeEvidence")(function* (
  content: string
): Effect.fn.Return<void, PolicyDecodeError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(evidencePath, content).pipe(Effect.mapError(() => ioFailure("write", evidencePath)));
});

const utf8 = new TextEncoder();

const sha256 = Effect.fn("S7Evidence.sha256")(function* (content: string) {
  const crypto = yield* Crypto.Crypto;
  return Hex.encode(yield* crypto.digest("SHA-256", utf8.encode(content)));
});

const generate = Effect.gen(function* () {
  const artifacts = yield* Effect.all(
    { abox: readArtifact(aboxPath), journal: readArtifact(journalPath) },
    { concurrency: 2 }
  );
  const policy = yield* decodeAdmissionPolicyParams(artifacts.abox);
  const events = yield* decodeAdmissionJournal(artifacts.journal);
  const policyDigest = yield* sha256(artifacts.abox);
  const journalDigest = yield* sha256(artifacts.journal);
  const report = yield* replayAdmissionJournal(policy, events, policyDigest, journalDigest);
  // Check mode recomputes and validates the frozen replay without regenerating
  // the historical report (whose explanatory prose belongs to its packet).
  if (A.contains(process.argv, "--check")) {
    yield* Console.log(renderReplayEvidence(report, journalDigest));
  } else {
    yield* writeEvidence(renderReplayEvidence(report, journalDigest));
  }
  yield* requireReplayMatch(report);
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
