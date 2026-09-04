/**
 * Durable telemetry-v2 write service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PathSafety } from "@beep/file-processing";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FlightRecord, FlightRecordWriteEvent } from "./flight-record.ts";
import { HookPulseLeaseProjection } from "./hook-pulse-lease-emitter.ts";
import { IngestEnumeration, IngestManifest } from "./ingest-manifest.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import { SessionLeaseReconciliation, SessionLeaseTransition } from "./session-lease.ts";
import { combineOipTaints, weakestEvidenceTier } from "./telemetry-v2.ts";
import type { AiMetricsAbsoluteDataRoot } from "./data-root.ts";
import type { FlightRecordCompositionInput } from "./flight-record.ts";
import type { IngestSubject } from "./ingest-manifest.ts";

const $I = $RepoAiMetricsId.create("telemetry-v2-store");
const artifactReceiptSchemaVersion = "telemetry-v2/artifact-receipt/v1";
const flightRecordSchemaVersion = "telemetry-v2/flight-record/v1";

/**
 * Durable telemetry-v2 artifact family.
 *
 * **Example** (Select the pre-read denominator family)
 *
 * ```ts
 * import { TelemetryV2ArtifactKind } from "@beep/repo-ai-metrics"
 *
 * console.log(TelemetryV2ArtifactKind.Enum["ingest-enumeration"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TelemetryV2ArtifactKind = LiteralKit([
  "flight-record-event",
  "hook-pulse-lease-projection",
  "ingest-enumeration",
  "ingest-manifest",
  "session-lease-transition",
  "session-lease-reconciliation",
]).pipe(
  $I.annoteSchema("TelemetryV2ArtifactKind", {
    description: "Content-addressed artifact families written by the telemetry-v2 store.",
  })
);

/**
 * Decoded telemetry-v2 artifact family.
 *
 * @see {@link TelemetryV2ArtifactKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TelemetryV2ArtifactKind = typeof TelemetryV2ArtifactKind.Type;

/**
 * Content-free receipt for one atomically committed telemetry-v2 artifact.
 *
 * **Details**
 *
 * The relative path contains only a fixed artifact-family directory and the
 * service-computed SHA-256 digest. It never reveals the configured data root.
 * Rewriting the same artifact produces the same digest and path.
 *
 * **Example** (Recognize a committed denominator)
 *
 * ```ts
 * import { TelemetryV2ArtifactReceipt } from "@beep/repo-ai-metrics"
 *
 * console.log(TelemetryV2ArtifactReceipt.fields.artifactKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TelemetryV2ArtifactReceipt extends S.Class<TelemetryV2ArtifactReceipt>($I`TelemetryV2ArtifactReceipt`)(
  {
    schemaVersion: S.Literal(artifactReceiptSchemaVersion),
    artifactKind: TelemetryV2ArtifactKind,
    artifactDigest: Sha256Hex,
    relativePath: S.NonEmptyString,
    byteCount: NonNegativeInt,
  },
  $I.annote("TelemetryV2ArtifactReceipt", {
    description: "Hash-only receipt for one atomically committed telemetry-v2 artifact.",
  })
) {}

const TelemetryV2StoreOperation = LiteralKit([
  "prepare-root",
  "compose-flight-record",
  "encode-flight-record-event",
  "encode-hook-pulse-lease-projection",
  "encode-ingest-enumeration",
  "encode-ingest-manifest",
  "encode-session-lease-transition",
  "encode-session-lease-reconciliation",
  "hash-artifact",
  "write-artifact",
  "validate-ingest-manifest",
]);

/**
 * Typed failure raised by the telemetry-v2 write boundary.
 *
 * **Example** (Identify a manifest-linkage failure)
 *
 * ```ts
 * import { TelemetryV2StoreError } from "@beep/repo-ai-metrics"
 *
 * const error = TelemetryV2StoreError.make({
 *   cause: "enumeration mismatch",
 *   message: "The final manifest does not match its persisted enumeration.",
 *   operation: "validate-ingest-manifest"
 * })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TelemetryV2StoreError extends S.TaggedError<TelemetryV2StoreError>($I`TelemetryV2StoreError`)(
  "TelemetryV2StoreError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
    operation: TelemetryV2StoreOperation,
  },
  $I.annoteError<TelemetryV2StoreError>("TelemetryV2StoreError", {
    description: "Typed preparation, composition, validation, encoding, hashing, or write failure.",
  })
) {}

/**
 * Result of composing and durably writing one accepted flight record.
 *
 * **Example** (Inspect the receipt field)
 *
 * ```ts
 * import { TelemetryV2FlightRecordWriteResult } from "@beep/repo-ai-metrics"
 *
 * console.log(TelemetryV2FlightRecordWriteResult.fields.receipt)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TelemetryV2FlightRecordWriteResult extends S.Class<TelemetryV2FlightRecordWriteResult>(
  $I`TelemetryV2FlightRecordWriteResult`
)(
  {
    record: FlightRecord,
    receipt: TelemetryV2ArtifactReceipt,
  },
  $I.annote("TelemetryV2FlightRecordWriteResult", {
    description: "Service-composed flight record and its durable accepted-event receipt.",
  })
) {}

/**
 * Result of an enumerate-before-read ingest write.
 *
 * **Example** (Inspect both durable receipts)
 *
 * ```ts
 * import { TelemetryV2IngestWriteResult } from "@beep/repo-ai-metrics"
 *
 * console.log("enumerationReceipt" in TelemetryV2IngestWriteResult.fields) // true
 * console.log("manifestReceipt" in TelemetryV2IngestWriteResult.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TelemetryV2IngestWriteResult extends S.Class<TelemetryV2IngestWriteResult>(
  $I`TelemetryV2IngestWriteResult`
)(
  {
    enumerationReceipt: TelemetryV2ArtifactReceipt,
    manifest: IngestManifest,
    manifestReceipt: TelemetryV2ArtifactReceipt,
  },
  $I.annote("TelemetryV2IngestWriteResult", {
    description: "Persisted initial denominator and exact final coverage-attestation receipts.",
  })
) {}

/**
 * Effect service contract for durable telemetry-v2 writes.
 *
 * **Details**
 *
 * `runIngest` commits the enumeration before it invokes `afterEnumeration`.
 * The callback is the only place the caller should open source content. Its
 * returned manifest is linkage-checked against the persisted denominator
 * before it can be committed. `writeFlightRecord` derives the record-wide
 * evidence tier and OIP taint instead of accepting either from the emitter.
 *
 * **Example** (Name the service dependency)
 *
 * ```ts
 * import { TelemetryV2Store } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const store = yield* TelemetryV2Store
 *   return store
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface TelemetryV2StoreShape {
  readonly appendFlightRecordEvent: (
    event: FlightRecordWriteEvent
  ) => Effect.Effect<TelemetryV2ArtifactReceipt, TelemetryV2StoreError>;
  readonly appendHookPulseLeaseProjection: (
    projection: HookPulseLeaseProjection
  ) => Effect.Effect<TelemetryV2ArtifactReceipt, TelemetryV2StoreError>;
  readonly appendSessionLeaseReconciliation: (
    reconciliation: SessionLeaseReconciliation
  ) => Effect.Effect<TelemetryV2ArtifactReceipt, TelemetryV2StoreError>;
  readonly appendSessionLeaseTransition: (
    transition: SessionLeaseTransition
  ) => Effect.Effect<TelemetryV2ArtifactReceipt, TelemetryV2StoreError>;
  readonly runIngest: <E, R>(
    enumeration: IngestEnumeration,
    afterEnumeration: (receipt: TelemetryV2ArtifactReceipt) => Effect.Effect<IngestManifest, E, R>
  ) => Effect.Effect<TelemetryV2IngestWriteResult, E | TelemetryV2StoreError, R>;
  readonly writeFlightRecord: (
    input: FlightRecordCompositionInput
  ) => Effect.Effect<TelemetryV2FlightRecordWriteResult, TelemetryV2StoreError>;
}

const storeFailure = (
  operation: typeof TelemetryV2StoreOperation.Type,
  message: string,
  cause: unknown
): TelemetryV2StoreError => TelemetryV2StoreError.make({ cause, message, operation });

const artifactDirectory = (kind: TelemetryV2ArtifactKind): string =>
  TelemetryV2ArtifactKind.$match(kind, {
    "flight-record-event": () => "flight-record-events",
    "hook-pulse-lease-projection": () => "hook-pulse-lease-projections",
    "ingest-enumeration": () => "ingest-enumerations",
    "ingest-manifest": () => "ingest-manifests",
    "session-lease-transition": () => "session-lease-transitions",
    "session-lease-reconciliation": () => "session-lease-reconciliations",
  });

const subjectEquals = (left: IngestSubject, right: IngestSubject): boolean =>
  left.subjectId === right.subjectId &&
  left.rootId === right.rootId &&
  left.sourceKind === right.sourceKind &&
  left.subjectKind === right.subjectKind &&
  left.evidenceTier === right.evidenceTier &&
  left.oipTaint === right.oipTaint;

const manifestMatchesEnumeration = (enumeration: IngestEnumeration, manifest: IngestManifest): boolean =>
  manifest.enumerationId === enumeration.enumerationId &&
  manifest.ingestRunId === enumeration.ingestRunId &&
  manifest.configFingerprint === enumeration.configFingerprint &&
  manifest.configEvidenceTier === enumeration.configEvidenceTier &&
  manifest.enumeratedCount === enumeration.enumeratedCount &&
  A.length(manifest.dispositions) === A.length(enumeration.subjects) &&
  A.every(manifest.dispositions, (disposition) =>
    O.exists(
      A.findFirst(enumeration.subjects, (subject) => subject.subjectId === disposition.subject.subjectId),
      (subject) => subjectEquals(subject, disposition.subject)
    )
  );

const textEncoder = new TextEncoder();

const makeTelemetryV2Store = Effect.fnUntraced(function* (dataRoot: AiMetricsAbsoluteDataRoot) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs
    .makeDirectory(dataRoot, { recursive: true })
    .pipe(
      Effect.mapError((cause) => storeFailure("prepare-root", "Failed to prepare the telemetry-v2 data root.", cause))
    );
  const canonicalRoot = yield* fs
    .realPath(dataRoot)
    .pipe(Effect.mapError((cause) => storeFailure("prepare-root", "Failed to pin the telemetry-v2 data root.", cause)));

  const persistArtifact = Effect.fnUntraced(function* (kind: TelemetryV2ArtifactKind, json: string) {
    const artifactDigest = yield* hashPublicTextSha256(`${kind}\u0000${json}`).pipe(
      Effect.mapError((cause) => storeFailure("hash-artifact", "Failed to hash a telemetry-v2 artifact.", cause))
    );
    const relativePath = `telemetry-v2/${artifactDirectory(kind)}/${artifactDigest}.json`;
    const bytes = textEncoder.encode(`${json}\n`);

    yield* PathSafety.writeFileWithinCanonicalRootAtomically({
      canonicalRoot,
      candidate: relativePath,
      bytes,
    }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.mapError((cause) =>
        storeFailure("write-artifact", "Failed to atomically commit a telemetry-v2 artifact.", cause)
      )
    );

    return TelemetryV2ArtifactReceipt.make({
      schemaVersion: artifactReceiptSchemaVersion,
      artifactKind: kind,
      artifactDigest,
      relativePath,
      byteCount: NonNegativeInt.make(bytes.byteLength),
    });
  });

  const appendFlightRecordEvent = Effect.fn("TelemetryV2Store.appendFlightRecordEvent")(function* (
    event: FlightRecordWriteEvent
  ) {
    const json = yield* FlightRecordWriteEvent.encodeJsonEffect(event).pipe(
      Effect.mapError((cause) =>
        storeFailure("encode-flight-record-event", "Failed to encode a flight-record write event.", cause)
      )
    );
    return yield* persistArtifact(TelemetryV2ArtifactKind.Enum["flight-record-event"], json);
  });

  const appendHookPulseLeaseProjection = Effect.fn("TelemetryV2Store.appendHookPulseLeaseProjection")(function* (
    projection: HookPulseLeaseProjection
  ) {
    const json = yield* HookPulseLeaseProjection.encodeJsonEffect(projection).pipe(
      Effect.mapError((cause) =>
        storeFailure("encode-hook-pulse-lease-projection", "Failed to encode a hook-pulse lease projection.", cause)
      )
    );
    return yield* persistArtifact(TelemetryV2ArtifactKind.Enum["hook-pulse-lease-projection"], json);
  });

  const writeFlightRecord = Effect.fn("TelemetryV2Store.writeFlightRecord")(function* (
    input: FlightRecordCompositionInput
  ) {
    const record = yield* Effect.try({
      try: () =>
        FlightRecord.make({
          schemaVersion: flightRecordSchemaVersion,
          recordId: input.recordId,
          sessionId: input.sessionId,
          sourceKind: input.sourceKind,
          attribution: input.attribution,
          instrumentClass: input.instrumentClass,
          config: input.config,
          semantic: input.semantic,
          mechanical: input.mechanical,
          evidenceRefs: input.evidenceRefs,
          evidenceTier: weakestEvidenceTier([
            input.attribution.evidenceTier,
            input.config.evidenceTier,
            input.semantic.evidenceTier,
            input.mechanical.evidenceTier,
            ...A.map(input.evidenceRefs, (evidence) => evidence.evidenceTier),
          ]),
          oipTaint: combineOipTaints(A.map(input.evidenceRefs, (evidence) => evidence.oipTaint)),
        }),
      catch: (cause) => storeFailure("compose-flight-record", "Failed to compose a telemetry-v2 flight record.", cause),
    });
    const event = FlightRecordWriteEvent.makeAccepted(record);
    const receipt = yield* appendFlightRecordEvent(event);
    return TelemetryV2FlightRecordWriteResult.make({ receipt, record });
  });

  const appendSessionLeaseTransition = Effect.fn("TelemetryV2Store.appendSessionLeaseTransition")(function* (
    transition: SessionLeaseTransition
  ) {
    const json = yield* SessionLeaseTransition.encodeJsonEffect(transition).pipe(
      Effect.mapError((cause) =>
        storeFailure("encode-session-lease-transition", "Failed to encode a session-lease transition.", cause)
      )
    );
    return yield* persistArtifact(TelemetryV2ArtifactKind.Enum["session-lease-transition"], json);
  });

  const appendSessionLeaseReconciliation = Effect.fn("TelemetryV2Store.appendSessionLeaseReconciliation")(function* (
    reconciliation: SessionLeaseReconciliation
  ) {
    const json = yield* SessionLeaseReconciliation.encodeJsonEffect(reconciliation).pipe(
      Effect.mapError((cause) =>
        storeFailure("encode-session-lease-reconciliation", "Failed to encode a session-lease reconciliation.", cause)
      )
    );
    return yield* persistArtifact(TelemetryV2ArtifactKind.Enum["session-lease-reconciliation"], json);
  });

  const runIngest = Effect.fn("TelemetryV2Store.runIngest")(function* <E, R>(
    enumeration: IngestEnumeration,
    afterEnumeration: (receipt: TelemetryV2ArtifactReceipt) => Effect.Effect<IngestManifest, E, R>
  ) {
    const enumerationJson = yield* IngestEnumeration.encodeJsonEffect(enumeration).pipe(
      Effect.mapError((cause) =>
        storeFailure("encode-ingest-enumeration", "Failed to encode an ingest enumeration.", cause)
      )
    );
    const enumerationReceipt = yield* persistArtifact(
      TelemetryV2ArtifactKind.Enum["ingest-enumeration"],
      enumerationJson
    );

    const manifest = yield* afterEnumeration(enumerationReceipt);
    if (!manifestMatchesEnumeration(enumeration, manifest)) {
      return yield* storeFailure(
        "validate-ingest-manifest",
        "The final manifest does not match its persisted enumeration.",
        "ingest-manifest-linkage-mismatch"
      );
    }

    const manifestJson = yield* IngestManifest.encodeJsonEffect(manifest).pipe(
      Effect.mapError((cause) => storeFailure("encode-ingest-manifest", "Failed to encode an ingest manifest.", cause))
    );
    const manifestReceipt = yield* persistArtifact(TelemetryV2ArtifactKind.Enum["ingest-manifest"], manifestJson);
    return TelemetryV2IngestWriteResult.make({ enumerationReceipt, manifest, manifestReceipt });
  });

  const service: TelemetryV2StoreShape = {
    appendFlightRecordEvent,
    appendHookPulseLeaseProjection,
    appendSessionLeaseReconciliation,
    appendSessionLeaseTransition,
    runIngest,
    writeFlightRecord,
  };
  return service;
});

/**
 * Durable, path-confined telemetry-v2 artifact store.
 *
 * **Example** (Construct a live layer)
 *
 * ```ts
 * import { AiMetricsAbsoluteDataRoot, TelemetryV2Store } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const root = Effect.runSync(AiMetricsAbsoluteDataRoot.decodeEffect("/var/lib/beep/ai-metrics"))
 * const layer = TelemetryV2Store.layer(root)
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TelemetryV2Store extends Context.Service<TelemetryV2Store, TelemetryV2StoreShape>()($I`TelemetryV2Store`) {
  /**
   * Build the live store over a validated absolute AI-metrics data root.
   *
   * **Example** (Type the live layer)
   *
   * ```ts
   * import { AiMetricsAbsoluteDataRoot, TelemetryV2Store } from "@beep/repo-ai-metrics"
   * import { Effect } from "effect"
   *
   * const root = Effect.runSync(AiMetricsAbsoluteDataRoot.decodeEffect("/var/lib/beep/ai-metrics"))
   * console.log(TelemetryV2Store.layer(root))
   * ```
   *
   * @param dataRoot - Validated absolute root beneath which telemetry-v2 artifacts are written.
   * @returns A layer that builds the path-confined telemetry-v2 store.
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (
    dataRoot: AiMetricsAbsoluteDataRoot
  ): Layer.Layer<TelemetryV2Store, TelemetryV2StoreError, FileSystem.FileSystem | Path.Path> =>
    Layer.effect(TelemetryV2Store, Effect.map(makeTelemetryV2Store(dataRoot), TelemetryV2Store.of));
}
