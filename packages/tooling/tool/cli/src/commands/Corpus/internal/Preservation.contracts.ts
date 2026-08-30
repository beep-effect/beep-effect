/**
 * Effect service contracts for the T7 preservation gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type { PreservationArchiveIoError } from "../Corpus.errors.ts";
import type {
  CapacityMeasurement,
  PreservationAttemptOutcome,
  PreservationManifestRow,
  PreservationObjectIdentity,
  PreservationVerificationReport,
  StreamingHashResult,
  T7PreservationOptions,
} from "./Preservation.schemas.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/Preservation.contracts");

/**
 * Incremental SHA-256 operations over Effect filesystem streams.
 *
 * @category services
 * @since 0.0.0
 */
export interface StreamingHasherShape {
  readonly hashFile: (path: string) => Effect.Effect<StreamingHashResult, PreservationArchiveIoError>;
  readonly hashFilePrefix: (
    path: string,
    length: number
  ) => Effect.Effect<StreamingHashResult, PreservationArchiveIoError>;
}

/**
 * Service tag for bounded-memory file hashing.
 *
 * **Example** (Access the streaming hasher)
 *
 * ```ts
 * import { StreamingHasher } from "@beep/repo-cli/commands/Corpus"
 * const effect = StreamingHasher.use((hasher) => hasher.hashFile("/tmp/synthetic.bin"))
 * console.log(effect.pipe !== undefined) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class StreamingHasher extends Context.Service<StreamingHasher, StreamingHasherShape>()($I`StreamingHasher`) {}

/**
 * Append-only manifest operations for preservation attempts.
 *
 * @category services
 * @since 0.0.0
 */
export interface PreservationManifestStoreShape {
  readonly append: (row: PreservationManifestRow) => Effect.Effect<void, PreservationArchiveIoError>;
  readonly readAll: Effect.Effect<ReadonlyArray<PreservationManifestRow>, PreservationArchiveIoError>;
  readonly terminalRows: Effect.Effect<ReadonlyArray<PreservationManifestRow>, PreservationArchiveIoError>;
}

/**
 * Service tag for a durable append-only preservation manifest.
 *
 * **Example** (Read terminal manifest rows)
 *
 * ```ts
 * import { PreservationManifestStore } from "@beep/repo-cli/commands/Corpus"
 *
 * const effect = PreservationManifestStore.use((store) => store.terminalRows)
 * console.log(effect.pipe !== undefined) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PreservationManifestStore extends Context.Service<
  PreservationManifestStore,
  PreservationManifestStoreShape
>()($I`PreservationManifestStore`) {}

/**
 * Atomic copy-while-hashing operation for one preservation object.
 *
 * @category services
 * @since 0.0.0
 */
export interface ArchiveWriterShape {
  readonly archiveObject: (
    sourceAbs: string,
    destAbs: string,
    identity: PreservationObjectIdentity
  ) => Effect.Effect<PreservationAttemptOutcome, PreservationArchiveIoError>;
}

/**
 * Service tag for atomic, resumable archive-object writes.
 *
 * **Example** (Access the archive writer)
 *
 * ```ts
 * import { ArchiveWriter } from "@beep/repo-cli/commands/Corpus"
 *
 * const effect = ArchiveWriter.use((writer) => writer)
 * console.log(effect.pipe !== undefined) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ArchiveWriter extends Context.Service<ArchiveWriter, ArchiveWriterShape>()($I`ArchiveWriter`) {}

/**
 * Fresh manifest reparse and destination-byte verification.
 *
 * @category services
 * @since 0.0.0
 */
export interface PreservationVerifierShape {
  readonly verify: (archiveRoot: string) => Effect.Effect<PreservationVerificationReport, PreservationArchiveIoError>;
}

/**
 * Service tag for independent preservation verification.
 *
 * **Example** (Build a verification pass)
 *
 * ```ts
 * import { PreservationVerifier } from "@beep/repo-cli/commands/Corpus"
 *
 * const effect = PreservationVerifier.use((verifier) => verifier.verify("/tmp/archive"))
 * console.log(effect.pipe !== undefined) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PreservationVerifier extends Context.Service<PreservationVerifier, PreservationVerifierShape>()(
  $I`PreservationVerifier`
) {}

/**
 * Capacity measurement over the explicitly bounded T7 source scope.
 *
 * @category services
 * @since 0.0.0
 */
export interface CapacityPreflightServiceShape {
  readonly measure: (options: T7PreservationOptions) => Effect.Effect<CapacityMeasurement, PreservationArchiveIoError>;
}

/**
 * Service tag for source-byte census and destination free-space measurement.
 *
 * **Example** (Access capacity measurement)
 *
 * ```ts
 * import { CapacityPreflightService } from "@beep/repo-cli/commands/Corpus"
 *
 * const effect = CapacityPreflightService.use((service) => service)
 * console.log(effect.pipe !== undefined) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CapacityPreflightService extends Context.Service<
  CapacityPreflightService,
  CapacityPreflightServiceShape
>()($I`CapacityPreflightService`) {}
