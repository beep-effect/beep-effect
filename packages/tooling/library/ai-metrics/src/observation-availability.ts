/**
 * Payload-free, separately attributed quota snapshots. Pure ingestion: no account polling or dispatch.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { hashPublicTextSha256 } from "./privacy.ts";
import { makeTranscriptIntakeJournal } from "./transcript-intake.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("observation-availability");
const percent = S.Finite.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(100));
const window = S.Struct({ usedPercent: percent, reportedResetAt: S.OptionFromNullOr(S.Natural) });
/**
 * Explicit source report, never proof of a particular invocation's account or cause.
 * @example
 * ```ts
 * import { ObservationAvailabilityReport } from "@beep/repo-ai-metrics/observation-availability"
 * console.log(ObservationAvailabilityReport.cases.Unknown.make({ reason: "not-reported" }))
 * ```
 * @category models
 * @since 0.0.0
 */
export const ObservationAvailabilityReport = S.TaggedUnion({
  Reported: { weekly: S.OptionFromNullOr(window), session: S.OptionFromNullOr(window) },
  Unavailable: { reason: S.Literals(["consumer-refused", "transport", "decode"]) },
  Unknown: { reason: S.Literals(["not-reported", "not-observed"]) },
}).pipe(
  $I.annoteSchema("ObservationAvailabilityReport", {
    description: "Finite quota metadata without credentials or free text.",
  })
);
/**
 * Runtime type of the source report.
 * @category type-level
 * @since 0.0.0
 */
export type ObservationAvailabilityReport = typeof ObservationAvailabilityReport.Type;
/**
 * Consumer-projected snapshot. Source attribution is declared, not authentication or native-runtime attestation.
 * No launch/session ID is accepted, so account quota cannot silently become an invocation diagnosis.
 * @example
 * ```ts
 * import { ObservationAvailabilitySnapshot } from "@beep/repo-ai-metrics/observation-availability"
 * console.log(typeof ObservationAvailabilitySnapshot.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationAvailabilitySnapshot extends S.Opaque<
  ObservationAvailabilitySnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    snapshotId: Sha256Hex,
    sourceEvidenceId: Sha256Hex,
    declaredHarness: S.tag("muse"),
    sourceKind: S.tag("registered-proxy-account-status"),
    observedAt: S.Natural,
    report: ObservationAvailabilityReport,
  }).pipe(
    $I.annoteSchema("ObservationAvailabilitySnapshot", {
      description: "Separate bounded quota snapshot, never an inferred native attempt.",
    })
  )
) {}
/**
 * First local durable acknowledgment of an immutable snapshot.
 * @example
 * ```ts
 * import { ObservationAvailabilityReceipt } from "@beep/repo-ai-metrics/observation-availability"
 * console.log(typeof ObservationAvailabilityReceipt.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationAvailabilityReceipt extends S.Opaque<
  ObservationAvailabilityReceipt,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("observation-availability-receipt/v1"),
    receiptId: Sha256Hex,
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    evidenceEpoch: S.Natural,
    acceptedAt: S.Natural,
    snapshot: ObservationAvailabilitySnapshot,
  }).pipe(
    $I.annoteSchema("ObservationAvailabilityReceipt", {
      description: "Durable metadata receipt; no remote availability or inference guarantee.",
    })
  )
) {}
/**
 * Finite snapshot ingestion refusal.
 * @example
 * ```ts
 * import { ObservationAvailabilityError } from "@beep/repo-ai-metrics/observation-availability"
 * console.log(ObservationAvailabilityError.make({ reason: "conflict" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ObservationAvailabilityError extends S.TaggedError<
  ObservationAvailabilityError,
  { readonly brand: unique symbol }
>($I`ObservationAvailabilityError`)(
  "ObservationAvailabilityError",
  { reason: S.Literals(["decode", "conflict", "capacity", "retired", "clock", "storage"]) },
  $I.annote("ObservationAvailabilityError", { description: "Payload-free quota journal refusal." })
) {}
const failure = (reason: ObservationAvailabilityError["reason"]) => ObservationAvailabilityError.make({ reason });
const safe = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError((e) => (S.is(ObservationAvailabilityError)(e) ? e : failure("storage"))));
const decodeSnapshot = S.decodeUnknownEffect(ObservationAvailabilitySnapshot, { onExcessProperty: "error" });
const encodeSnapshot = S.encodeEffect(S.fromJsonString(ObservationAvailabilitySnapshot));
const encodeReceipt = S.encodeEffect(S.fromJsonString(ObservationAvailabilityReceipt));
const decodeReceipt = S.decodeEffect(S.fromJsonString(ObservationAvailabilityReceipt), { onExcessProperty: "error" });
const rows = S.Array(S.Struct({ payload: S.String, digest: Sha256Hex, bytes: S.Natural, epoch: S.Natural }));
const decodeRows = S.decodeUnknownEffect(rows);
const decodeCount = S.decodeUnknownEffect(S.Tuple([S.Struct({ n: S.Natural })]));
/**
 * Open a bounded pure-ingestion journal in the existing intake database.
 * Uses the shared physical ceiling and payload accounting, including launch completion reservations.
 * Snapshots remain immutable across epochs; old rows consume capacity until an explicitly reviewed recovery.
 * Known-ID reads only: no enumeration, implicit latest snapshot, inferred freshness or account/launch join.
 * @example
 * ```ts
 * import { makeObservationAvailability } from "@beep/repo-ai-metrics/observation-availability"
 * console.log(typeof makeObservationAvailability)
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeObservationAvailability = Effect.fn("AiMetrics.makeObservationAvailability")(function* (
  config: TranscriptIntakeConfig
) {
  const base = yield* makeTranscriptIntakeJournal(config);
  const sql = yield* SqlClient.SqlClient;
  const receiptIdentity = Effect.fnUntraced(function* (snapshot: ObservationAvailabilitySnapshot, epoch: number) {
    return yield* hashPublicTextSha256(
      `observation-availability/v1:${config.hostId}:${config.namespaceId}:${epoch}:${yield* encodeSnapshot(snapshot)}`
    );
  });
  const read = Effect.fn("AiMetrics.availability.read")((snapshotId: Sha256Hex, epoch: number) =>
    safe(
      sql.withTransaction(
        Effect.gen(function* () {
          if ((yield* base.evidenceWindow).epoch !== epoch) return yield* failure("retired");
          const found =
            yield* sql`SELECT substr(payload,1,8193) AS payload,digest,payload_bytes AS bytes,evidence_epoch AS epoch FROM observation_availability_snapshots WHERE snapshot_id=${snapshotId}`.pipe(
              Effect.flatMap(decodeRows)
            );
          const row = A.head(found);
          if (O.isNone(row)) return O.none<ObservationAvailabilityReceipt>();
          const stored = row.value;
          if (stored.epoch !== epoch) return yield* failure("retired");
          const digest = yield* hashPublicTextSha256(stored.payload);
          if (
            !A.every(
              [
                stored.bytes <= 8192,
                new TextEncoder().encode(stored.payload).byteLength === stored.bytes,
                digest === stored.digest,
              ],
              identity
            )
          )
            return yield* failure("storage");
          const receipt = yield* decodeReceipt(stored.payload);
          const expectedId = yield* receiptIdentity(receipt.snapshot, epoch);
          if (
            !A.every(
              [
                receipt.snapshot.snapshotId === snapshotId,
                receipt.evidenceEpoch === epoch,
                receipt.hostId === config.hostId,
                receipt.namespaceId === config.namespaceId,
                receipt.receiptId === expectedId,
                receipt.snapshot.observedAt <= receipt.acceptedAt,
              ],
              identity
            )
          )
            return yield* failure("storage");
          return O.some(receipt);
        })
      )
    )
  );
  const record = Effect.fn("AiMetrics.availability.record")((input: unknown, epoch: number) =>
    safe(
      Effect.gen(function* () {
        const snapshot = yield* decodeSnapshot(input).pipe(Effect.mapError(() => failure("decode")));
        return yield* sql.withTransaction(
          Effect.gen(function* () {
            const existing = yield* read(snapshot.snapshotId, epoch);
            const receiptId = yield* receiptIdentity(snapshot, epoch);
            if (O.isSome(existing)) {
              if (existing.value.receiptId !== receiptId) return yield* failure("conflict");
              return existing.value;
            }
            const acceptedAt = yield* Clock.currentTimeMillis;
            if (snapshot.observedAt > acceptedAt) return yield* failure("clock");
            const receipt = ObservationAvailabilityReceipt.make({
              receiptId,
              hostId: config.hostId,
              namespaceId: config.namespaceId,
              evidenceEpoch: epoch,
              acceptedAt,
              snapshot,
            });
            const payload = yield* encodeReceipt(receipt);
            const bytes = new TextEncoder().encode(payload).byteLength;
            const count = yield* sql`SELECT count(*) AS n FROM observation_availability_snapshots`.pipe(
              Effect.flatMap(decodeCount)
            );
            if (
              count[0].n >= config.maxPages ||
              bytes > 8192 ||
              (yield* base.stats).payloadBytes + (yield* base.reservedLaunchBytes) + bytes > config.maxPayloadBytes
            )
              return yield* failure("capacity");
            const digest = yield* hashPublicTextSha256(payload);
            yield* sql`INSERT INTO observation_availability_snapshots(snapshot_id,payload,digest,payload_bytes,evidence_epoch) VALUES(${snapshot.snapshotId},${payload},${digest},${bytes},${epoch})`;
            return receipt;
          })
        );
      })
    )
  );
  return { read, record };
});
