/**
 * One paused-by-default owner of the bounded observation components.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { PhoenixConfigInput } from "@beep/phoenix";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { DeliveryLedgerConfig } from "./delivery-ledger.ts";
import { EvidenceRetentionPolicy, makeEvidenceRetention } from "./evidence-retention.ts";
import { makeNativeDelivery, NativeDeliveryPolicy } from "./native-delivery.ts";
import { makeNativeHttpIntake, NativeHttpPolicy } from "./native-http.ts";
import { makeNativeReadback } from "./native-readback.ts";
import { makeNativeDeliveryScheduler, NativeSchedulePolicy } from "./native-schedule.ts";
import { captureObservationBackup } from "./observation-backup.ts";
import { makeObservationControl, ObservationControlPolicy } from "./observation-control.ts";
import { makeObservationLaunchFacts } from "./observation-launch-facts.ts";
import { makeObservationLaunchHttp, ObservationLaunchHttpPolicy } from "./observation-launch-http.ts";
import { makePayloadReclaimer, PayloadRetentionPolicy } from "./payload-reclamation.ts";
import { runDiscoveredTranscriptSweep } from "./transcript-discovery.ts";
import { TranscriptAcceptance, TranscriptIntakeConfig, TranscriptIntakeError } from "./transcript-intake.ts";
import { runTranscriptSweep } from "./transcript-sweep.ts";
import type { Sha256Hex } from "@beep/schema";
import type { NativeDeliveryRequest } from "./native-delivery.ts";
import type { ObservationBackupPolicy } from "./observation-backup.ts";
import type { ObservationLaunchFact } from "./observation-launch-facts.ts";
import type { TranscriptDiscovery, TranscriptDiscoveryReadPolicy } from "./transcript-discovery.ts";
import type { TranscriptSweepInput } from "./transcript-sweep.ts";

const $I = $RepoAiMetricsId.create("observation-worker");
const defaultSchedulePolicy = NativeSchedulePolicy.make({
  maxEvents: 8,
  retryDelayMillis: 1000,
  maxRetryDelayMillis: 60000,
  reconcileDelayMillis: 1000,
  tickTimeoutMillis: 10000,
});
/**
 * Private, explicit policies for one journal, native route and backend target.
 *
 * **Details**
 *
 * Contains private routing and hashing configuration; do not publish it as telemetry. No policy is inferred from source content. Journal/destination identity checks remain owned by the constituent services.
 *
 * **Example** (Inspect the observation worker config constructor)
 *
 * ```ts
 * import { ObservationWorkerConfig } from "@beep/repo-ai-metrics/observation-worker"
 * console.log(typeof ObservationWorkerConfig.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationWorkerConfig extends S.Opaque<ObservationWorkerConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    intake: TranscriptIntakeConfig,
    ledger: DeliveryLedgerConfig,
    nativeHttp: NativeHttpPolicy,
    launchHttp: S.OptionFromOptionalKey(ObservationLaunchHttpPolicy).pipe(S.withConstructorDefault(Effect.succeedNone)),
    delivery: NativeDeliveryPolicy,
    backend: PhoenixConfigInput,
    payloadRetention: PayloadRetentionPolicy,
    evidenceRetention: EvidenceRetentionPolicy,
    control: ObservationControlPolicy,
    scheduling: NativeSchedulePolicy.pipe(
      S.withConstructorDefault(Effect.succeed(defaultSchedulePolicy)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultSchedulePolicy))
    ),
  }).pipe(
    $I.annoteSchema("ObservationWorkerConfig", {
      description: "Explicit private composition of one observation worker.",
    })
  )
) {}
const decodeTranscriptAcceptanceRows = S.decodeUnknownEffect(S.Array(TranscriptAcceptance).check(S.isMaxLength(32)));

/**
 * Compose intake, delivery, read-back, source sweeps and reversible maintenance.
 *
 * **Details**
 *
 * Starts paused and never starts a listener, poll loop or held service. All activity methods share bounded admission; excess work fails without queuing. pause closes admission and drains accepted activity; only then may backup/seal/restore run. Maintenance is exclusive and leaves the worker paused on success or failure. resume is explicit. Read-only status/ledger views remain available while paused. The worker exposes no raw mutation-capable journal. The first discovery capability is bound to this worker; a different scanner is refused. Successful pause drains admitted work then suspends that scanner, and worker scope closure also suspends it. Its scope closes admission permanently. Deployment must still enforce a single database owner, connection/header and hard process/disk limits, snapshot generation retention/off-device replication, explicit scheduling and upstream loss accounting. Transcript sweeps collect reconstructed metadata only; shared delivery exports accepted occurrences in an explicit reconstructed stream, with non-additive usage and separate trace identities.
 *
 * **Example** (Inspect the factory for observation worker)
 *
 * ```ts
 * import { makeObservationWorker } from "@beep/repo-ai-metrics/observation-worker"
 * console.log(typeof makeObservationWorker)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const makeObservationWorker = Effect.fn("AiMetrics.makeObservationWorker")(function* (
  config: ObservationWorkerConfig
) {
  const sql = yield* SqlClient.SqlClient;
  const control = yield* makeObservationControl(config.control);
  const intake = yield* makeNativeHttpIntake(config.intake, config.nativeHttp, control);
  const delivery = yield* makeNativeDelivery(config.intake, config.ledger, config.delivery);
  const readback = yield* makeNativeReadback(config.intake, config.ledger, config.delivery, config.backend);
  const scheduler = yield* makeNativeDeliveryScheduler(
    config.intake,
    config.ledger,
    config.scheduling,
    delivery,
    readback
  );
  const payloads = yield* makePayloadReclaimer(config.intake, config.ledger, config.payloadRetention);
  const launches = yield* makeObservationLaunchFacts(config.intake);
  const launchHttp = O.isSome(config.launchHttp)
    ? O.some(yield* makeObservationLaunchHttp(config.intake, config.launchHttp.value, control))
    : O.none();
  const evidence = yield* makeEvidenceRetention(config.intake, config.ledger, config.evidenceRetention);
  let sources = O.none<TranscriptDiscovery>();
  const suspendSources = Effect.suspend(() => (O.isSome(sources) ? sources.value.suspend : Effect.void));
  yield* Effect.addFinalizer(() => suspendSources.pipe(Effect.orDie));
  return {
    handler: Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      return yield* (request.url === "/v1/launch-facts" || request.url === "/v1/launch-context") && O.isSome(launchHttp)
        ? launchHttp.value.handler
        : intake.handler;
    }),
    pause: control.pauseWith(suspendSources),
    resume: control.resume,
    status: control.status,
    stats: intake.journal.stats,
    intakeHealth: intake.health,
    recordLaunch: (fact: ObservationLaunchFact, epoch: number) => control.run(launches.record(fact, epoch)),
    launchFacts: launches.read,
    window: evidence.window,
    eventState: delivery.ledger.state,
    tick: control.run(scheduler.tick),
    send: (request: NativeDeliveryRequest) => control.run(delivery.send(request)),
    reconcile: (request: NativeDeliveryRequest, eventId: Sha256Hex) =>
      control.run(readback.reconcile(request, eventId)),
    sweep: (input: TranscriptSweepInput) =>
      control.run(runTranscriptSweep(config.intake, input).pipe(Effect.provideService(SqlClient.SqlClient, sql))),
    discover: (discovery: TranscriptDiscovery, policy: TranscriptDiscoveryReadPolicy) =>
      control.run(
        Effect.gen(function* () {
          if (discovery.namespaceId !== config.intake.namespaceId)
            return yield* TranscriptIntakeError.make({ reason: "namespace" });
          if (O.isSome(sources) && sources.value !== discovery)
            return yield* TranscriptIntakeError.make({ reason: "configuration" });
          sources = O.some(discovery);
          return yield* runDiscoveredTranscriptSweep(config.intake, discovery, policy).pipe(
            Effect.provideService(SqlClient.SqlClient, sql)
          );
        })
      ),
    reclaim: (receiptId: Sha256Hex) => control.run(payloads.reclaim(receiptId)),
    expire: (receiptId: Sha256Hex) => control.run(payloads.expire(receiptId)),
    reclaimPaused: (receiptId: Sha256Hex) => control.maintain(payloads.reclaim(receiptId)),
    expirePaused: (receiptId: Sha256Hex) => control.maintain(payloads.expire(receiptId)),
    pages: (afterSequence: number) =>
      control.maintain(
        Effect.gen(function* () {
          yield* S.decodeEffect(S.Natural)(afterSequence);
          return yield* sql`SELECT receipt_id AS "receiptId", sequence, accepted_at AS "acceptedAt", payload_bytes AS "payloadBytes", frames, evidence_epoch AS "evidenceEpoch" FROM observation_intake_pages WHERE sequence > ${afterSequence} ORDER BY sequence LIMIT 32`.pipe(
            Effect.flatMap(decodeTranscriptAcceptanceRows)
          );
        })
      ),
    backup: (policy: ObservationBackupPolicy, directory: string) =>
      control.maintain(
        captureObservationBackup(config.intake, policy, directory).pipe(Effect.provideService(SqlClient.SqlClient, sql))
      ),
    seal: (epoch: number) => control.maintain(evidence.seal(epoch)),
    restore: (digest: Sha256Hex) => control.maintain(evidence.restore(digest)),
  };
});
