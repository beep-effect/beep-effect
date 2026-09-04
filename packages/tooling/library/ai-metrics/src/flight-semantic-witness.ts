/**
 * Content-free first-person semantic witnesses for telemetry-v2 flight records.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PathSafety } from "@beep/file-processing";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { Effect, FileSystem, Path } from "effect";
import * as S from "effect/Schema";
import { FlightRecordSemantic } from "./flight-record.ts";
import { AiMetricsTranscriptSource } from "./models.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import { ActivePhase, EvidenceTier, LifecycleState, TerminalOutcome } from "./telemetry-v2.ts";

const $I = $RepoAiMetricsId.create("flight-semantic-witness");
const flightSemanticWitnessSchemaVersion = "telemetry-v2/flight-semantic-witness/v1";
const flightSemanticWitnessReceiptSchemaVersion = "telemetry-v2/flight-semantic-witness-receipt/v1";

/**
 * Bounded input from which an instrumented agent wrapper creates a semantic witness.
 *
 * **Details**
 *
 * Both identifiers are SHA-256 references computed outside the model response.
 * The three semantic labels are first-person claims; timestamps, counts, waits,
 * and terminal provenance are intentionally impossible to supply here.
 *
 * **Example** (Describe a completed wrapper turn)
 *
 * ```ts
 * import { FlightSemanticWitnessInput } from "@beep/repo-ai-metrics"
 *
 * console.log(FlightSemanticWitnessInput.fields.activePhase)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlightSemanticWitnessInput extends S.Class<FlightSemanticWitnessInput>($I`FlightSemanticWitnessInput`)(
  {
    invocationId: Sha256Hex,
    objectiveRef: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    lifecycleState: LifecycleState,
    activePhase: ActivePhase,
    selfReportedTerminalOutcome: TerminalOutcome,
  },
  $I.annote("FlightSemanticWitnessInput", {
    description: "Hash-only identity plus bounded first-person labels supplied by an instrumented agent wrapper.",
  })
) {}

/**
 * Persistent semantic half of one wrapper-observed agent invocation.
 *
 * **Details**
 *
 * The witness retains neither the task prompt nor the model's user-facing final
 * response. Its invocation digest joins exactly to the optional `SessionStart`
 * correlation field in `HookPulseV1`; its objective is represented only by the
 * independently computed content reference.
 *
 * **Example** (Inspect the persistent schema version)
 *
 * ```ts
 * import { FlightSemanticWitness } from "@beep/repo-ai-metrics"
 *
 * console.log(FlightSemanticWitness.fields.schemaVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlightSemanticWitness extends S.Class<FlightSemanticWitness>($I`FlightSemanticWitness`)(
  {
    schemaVersion: S.Literal(flightSemanticWitnessSchemaVersion),
    invocationId: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    semantic: FlightRecordSemantic,
  },
  $I.annote("FlightSemanticWitness", {
    description: "Content-free semantic projection persisted by an instrumented coding-agent wrapper.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(FlightSemanticWitness));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(FlightSemanticWitness));
}

/**
 * Construct a semantic witness while fixing provenance tiers at their honest boundaries.
 *
 * **Details**
 *
 * The wrapper observes the model-authored labels directly, while the objective
 * and aggregate are one derivation away from their inputs. Consequently the
 * semantic aggregate is `derived`, never promoted to `observed`.
 *
 * **Example** (Create a content-free first-person witness)
 *
 * ```ts
 * import { FlightSemanticWitnessInput, makeFlightSemanticWitness } from "@beep/repo-ai-metrics"
 *
 * const input = FlightSemanticWitnessInput.make({
 *   invocationId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *   objectiveRef: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
 *   sourceKind: "codex",
 *   lifecycleState: "terminal",
 *   activePhase: "none",
 *   selfReportedTerminalOutcome: "completed"
 * })
 * console.log(makeFlightSemanticWitness(input).sourceKind) // "codex"
 * ```
 *
 * @param input - Hash-only wrapper identity and bounded first-person labels.
 * @returns A persistent witness containing only the semantic flight-record channel.
 * @category constructors
 * @since 0.0.0
 */
export const makeFlightSemanticWitness = (input: FlightSemanticWitnessInput): FlightSemanticWitness =>
  FlightSemanticWitness.make({
    schemaVersion: flightSemanticWitnessSchemaVersion,
    invocationId: input.invocationId,
    sourceKind: input.sourceKind,
    semantic: FlightRecordSemantic.make({
      objective: {
        status: "known",
        objectiveRef: input.objectiveRef,
        evidenceTier: EvidenceTier.Enum.derived,
      },
      semanticTurns: [
        {
          turnId: input.invocationId,
          sequence: 0,
          lifecycleState: input.lifecycleState,
          activePhase: input.activePhase,
          selfReportedTerminalOutcome: input.selfReportedTerminalOutcome,
          evidenceTier: EvidenceTier.Enum.observed,
        },
      ],
      selfReportedTerminalOutcome: input.selfReportedTerminalOutcome,
      evidenceTier: EvidenceTier.Enum.derived,
    }),
  });

/**
 * Resolve the semantic-witness directory under the shared agent-evidence root.
 *
 * @param evidenceRoot - Absolute agent-evidence root shared by hooks and wrappers.
 * @returns The directory containing one content-free JSON witness per invocation.
 * @category utilities
 * @since 0.0.0
 */
export const flightSemanticWitnessDir = (evidenceRoot: string): string => `${evidenceRoot}/flight-semantic-witnesses`;

/**
 * Content-free receipt for one atomically persisted semantic witness.
 *
 * **Example** (Inspect the digest field)
 *
 * ```ts
 * import { FlightSemanticWitnessReceipt } from "@beep/repo-ai-metrics"
 *
 * console.log(FlightSemanticWitnessReceipt.fields.witnessDigest)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlightSemanticWitnessReceipt extends S.Class<FlightSemanticWitnessReceipt>(
  $I`FlightSemanticWitnessReceipt`
)(
  {
    schemaVersion: S.Literal(flightSemanticWitnessReceiptSchemaVersion),
    invocationId: Sha256Hex,
    witnessDigest: Sha256Hex,
    relativePath: S.NonEmptyString,
    byteCount: NonNegativeInt,
  },
  $I.annote("FlightSemanticWitnessReceipt", {
    description: "Hash-only receipt for an atomically persisted semantic wrapper witness.",
  })
) {}

const FlightSemanticWitnessWriteOperation = LiteralKit([
  "prepare-root",
  "encode-witness",
  "hash-witness",
  "write-witness",
]).pipe(
  $I.annoteSchema("FlightSemanticWitnessWriteOperation", {
    description: "Persistence operation that failed while writing a semantic wrapper witness.",
  })
);

/**
 * Typed failure raised by the semantic-witness persistence boundary.
 *
 * **Example** (Inspect the failed operation)
 *
 * ```ts
 * import { FlightSemanticWitnessStoreError } from "@beep/repo-ai-metrics"
 *
 * const error = FlightSemanticWitnessStoreError.make({
 *   cause: "unavailable",
 *   message: "Failed to persist witness.",
 *   operation: "write-witness"
 * })
 * console.log(error.operation) // "write-witness"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FlightSemanticWitnessStoreError extends S.TaggedError<FlightSemanticWitnessStoreError>(
  $I`FlightSemanticWitnessStoreError`
)(
  "FlightSemanticWitnessStoreError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
    operation: FlightSemanticWitnessWriteOperation,
  },
  $I.annoteError<FlightSemanticWitnessStoreError>("FlightSemanticWitnessStoreError", {
    description: "Typed preparation, encoding, hashing, or atomic-write failure for a semantic witness.",
  })
) {}

const witnessFailure = (
  operation: typeof FlightSemanticWitnessWriteOperation.Type,
  message: string,
  cause: unknown
): FlightSemanticWitnessStoreError => FlightSemanticWitnessStoreError.make({ cause, message, operation });

const textEncoder = new TextEncoder();

/**
 * Atomically persist one content-free semantic witness in the shared evidence root.
 *
 * **Details**
 *
 * The destination filename is the wrapper-generated invocation digest. The
 * canonical-root write guard prevents symlink or traversal escapes, and a
 * repeated write for the same witness is byte-identical.
 *
 * **Example** (Prepare a witness write)
 *
 * ```ts
 * import { writeFlightSemanticWitness } from "@beep/repo-ai-metrics"
 *
 * console.log(typeof writeFlightSemanticWitness) // "function"
 * ```
 *
 * @param evidenceRoot - Absolute shared agent-evidence root.
 * @param witness - Content-free semantic witness to persist.
 * @returns A digest-only receipt for the committed JSON artifact.
 * @throws {@link FlightSemanticWitnessStoreError} when preparation, encoding, hashing, or atomic persistence fails.
 * @category use-cases
 * @since 0.0.0
 */
export const writeFlightSemanticWitness = Effect.fn("FlightSemanticWitness.write")(function* (
  evidenceRoot: string,
  witness: FlightSemanticWitness
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (!path.isAbsolute(evidenceRoot)) {
    return yield* witnessFailure("prepare-root", "Expected an absolute shared agent-evidence root.", evidenceRoot);
  }
  yield* fs
    .makeDirectory(evidenceRoot, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        witnessFailure("prepare-root", "Failed to prepare the shared agent-evidence root.", cause)
      )
    );
  const canonicalRoot = yield* fs
    .realPath(evidenceRoot)
    .pipe(Effect.mapError((cause) => witnessFailure("prepare-root", "Failed to pin the agent-evidence root.", cause)));
  const json = yield* FlightSemanticWitness.encodeJsonEffect(witness).pipe(
    Effect.mapError((cause) => witnessFailure("encode-witness", "Failed to encode a semantic witness.", cause))
  );
  const witnessDigest = yield* hashPublicTextSha256(`flight-semantic-witness\u0000${json}`).pipe(
    Effect.mapError((cause) => witnessFailure("hash-witness", "Failed to hash a semantic witness.", cause))
  );
  const relativePath = `flight-semantic-witnesses/${witness.invocationId}.json`;
  const bytes = textEncoder.encode(`${json}\n`);

  yield* PathSafety.writeFileWithinCanonicalRootAtomically({ canonicalRoot, candidate: relativePath, bytes }).pipe(
    Effect.provideService(FileSystem.FileSystem, fs),
    Effect.provideService(Path.Path, path),
    Effect.mapError((cause) =>
      witnessFailure("write-witness", "Failed to atomically commit a semantic witness.", cause)
    )
  );

  return FlightSemanticWitnessReceipt.make({
    schemaVersion: flightSemanticWitnessReceiptSchemaVersion,
    invocationId: witness.invocationId,
    witnessDigest,
    relativePath,
    byteCount: NonNegativeInt.make(bytes.byteLength),
  });
});
