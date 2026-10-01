/**
 * Frozen S7 replay-evidence program: argv mode decoding and the write-gated
 * replay run shared by the `evidence:s7` / `evidence:s7:write` scripts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Console, Effect, FileSystem } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import * as S from "effect/Schema";
import { decodeAdmissionPolicyParams } from "./AboxPolicy.ts";
import { decodeAdmissionJournal, renderReplayEvidence, replayAdmissionJournal, requireReplayMatch } from "./Replay.ts";
import { PolicyDecodeError } from "./Schemas.ts";
import type { ReplayReport } from "./Replay.ts";
import type { ReplayMismatchError } from "./Schemas.ts";

const $I = $CiopsId.create("projection/Evidence");

/**
 * Run mode of the replay-evidence script.
 *
 * `check` recomputes and validates the replay without touching the committed
 * record; `write` regenerates the frozen evidence file and is opt-in only.
 *
 * **Example** (Recognize the write mode)
 *
 * ```ts
 * import { EvidenceMode } from "@/projection/Evidence"
 *
 * console.log(EvidenceMode.is.write("write")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceMode = LiteralKit(["check", "write"]).pipe(
  $I.annoteSchema("EvidenceMode", {
    description: "Replay-evidence run mode: read-only check (default) or opt-in regeneration.",
  })
);

/**
 * Decoded run mode accepted by {@link EvidenceMode}.
 *
 * @see {@link EvidenceMode} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type EvidenceMode = typeof EvidenceMode.Type;

/**
 * Repo-relative inputs and output of one replay-evidence run.
 *
 * **Example** (Describe the frozen S6 packet)
 *
 * ```ts
 * import { EvidencePaths } from "@/projection/Evidence"
 *
 * const paths = EvidencePaths.make({
 *   abox: "graphs/abox.ttl",
 *   journal: "snapshot/raw/journal.ndjson",
 *   evidence: "research/s7-replay-evidence.md"
 * })
 * console.log(paths.evidence) // "research/s7-replay-evidence.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidencePaths extends S.Class<EvidencePaths>($I`EvidencePaths`)(
  {
    abox: S.String,
    journal: S.String,
    evidence: S.String,
  },
  $I.annote("EvidencePaths", {
    description: "Policy A-Box, admission journal and evidence report paths for one replay run.",
  })
) {}

const conflictingModes = PolicyDecodeError.make({
  message:
    "`--check` and `--write` are mutually exclusive; regenerate the frozen evidence with `bun run evidence:s7:write`.",
});

/**
 * Decodes the script argv into an {@link EvidenceMode}.
 *
 * **Details**
 *
 * The absence of `--write` is the read-only `check` mode, so a bare
 * `bun run evidence:s7` can never rewrite the dated record. Passing both
 * flags is a typed failure rather than a silent precedence choice.
 *
 * **Example** (Default to check mode)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeEvidenceMode } from "@/projection/Evidence"
 *
 * console.log(Effect.runSync(decodeEvidenceMode(["bun", "script.ts"]))) // "check"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEvidenceMode = Effect.fn("Evidence.decodeEvidenceMode")(function* (
  argv: ReadonlyArray<string>
): Effect.fn.Return<EvidenceMode, PolicyDecodeError> {
  const write = A.contains(argv, "--write");
  if (write && A.contains(argv, "--check")) {
    return yield* conflictingModes;
  }
  return write ? EvidenceMode.Enum.write : EvidenceMode.Enum.check;
});

const ioFailure = (operation: string, path: string) =>
  PolicyDecodeError.make({ message: `Failed to ${operation} repo-relative artifact "${path}".` });

const readArtifact = Effect.fn("Evidence.readArtifact")(function* (
  path: string
): Effect.fn.Return<string, PolicyDecodeError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(path).pipe(Effect.mapError(() => ioFailure("read", path)));
});

const writeEvidence = Effect.fn("Evidence.writeEvidence")(function* (
  path: string,
  content: string
): Effect.fn.Return<void, PolicyDecodeError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(path, content).pipe(Effect.mapError(() => ioFailure("write", path)));
});

const utf8 = new TextEncoder();

const sha256 = Effect.fn("Evidence.sha256")(function* (
  content: string
): Effect.fn.Return<string, PolicyDecodeError, Crypto.Crypto> {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto
    .digest("SHA-256", utf8.encode(content))
    .pipe(Effect.mapError(() => PolicyDecodeError.make({ message: "Failed to digest a replay artifact." })));
  return Hex.encode(digest);
});

/**
 * Outcome of one replay-evidence run: the validated report and its rendering.
 *
 * **Example** (Describe a passing check run)
 *
 * ```ts
 * import { EvidenceRun } from "@/projection/Evidence"
 *
 * const run = EvidenceRun.make({ mode: "check", rendered: "# S7 replay evidence\n\nPASS" })
 * console.log(run.mode) // "check"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceRun extends S.Class<EvidenceRun>($I`EvidenceRun`)(
  {
    mode: EvidenceMode,
    rendered: S.String,
  },
  $I.annote("EvidenceRun", {
    description: "Mode and rendered Markdown of a replay-evidence run that passed the differential replay.",
  })
) {}

/**
 * Replays the frozen journal against the policy A-Box and, only in `write`
 * mode and only after the replay matched, regenerates the evidence file.
 *
 * **Details**
 *
 * `requireReplayMatch` runs before any write, so a diverging replay can never
 * overwrite a good committed record. The rendering is computed first and
 * printed when the replay diverges, so the FAIL table (expected versus
 * projected nonces) stays available for diagnosis. `check` mode never touches
 * the file system beyond reading its inputs.
 *
 * **Example** (Validate without writing)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EvidencePaths, generateReplayEvidence } from "@/projection/Evidence"
 *
 * const program = generateReplayEvidence("check", EvidencePaths.make({
 *   abox: "graphs/abox.ttl",
 *   journal: "snapshot/raw/journal.ndjson",
 *   evidence: "research/s7-replay-evidence.md"
 * }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const generateReplayEvidence = Effect.fn("Evidence.generateReplayEvidence")(function* (
  mode: EvidenceMode,
  paths: EvidencePaths
): Effect.fn.Return<EvidenceRun, PolicyDecodeError | ReplayMismatchError, FileSystem.FileSystem | Crypto.Crypto> {
  const artifacts = yield* Effect.all(
    { abox: readArtifact(paths.abox), journal: readArtifact(paths.journal) },
    { concurrency: 2 }
  );
  const policy = yield* decodeAdmissionPolicyParams(artifacts.abox);
  const events = yield* decodeAdmissionJournal(artifacts.journal);
  const policyDigest = yield* sha256(artifacts.abox);
  const journalDigest = yield* sha256(artifacts.journal);
  const replayed: ReplayReport = yield* replayAdmissionJournal(policy, events, policyDigest, journalDigest);
  const rendered = renderReplayEvidence(replayed, journalDigest);
  // A diverging replay fails typed before any write; its FAIL table is printed
  // first so the expected/projected nonces remain diagnosable from the run.
  const report = yield* requireReplayMatch(replayed).pipe(Effect.tapError(() => Console.log(rendered)));
  if (EvidenceMode.is.write(mode)) {
    yield* writeEvidence(paths.evidence, rendered);
  }
  return EvidenceRun.make({ mode, rendered: renderReplayEvidence(report, journalDigest) });
});
