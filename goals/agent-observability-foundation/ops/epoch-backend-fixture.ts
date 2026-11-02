// Synthetic fixed-clock lifecycle proof against a disposable loopback backend.
import { PhoenixConfigInput } from "@beep/phoenix";
import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import { EvidenceRetentionPolicy, makeEvidenceRetention } from "@beep/repo-ai-metrics/evidence-retention";
import {
  makeNativeDelivery,
  NativeDeliveryPolicy,
  NativeDeliveryRequest,
  nativeDeliveryTargetId,
} from "@beep/repo-ai-metrics/native-delivery";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { makeNativeReadback } from "@beep/repo-ai-metrics/native-readback";
import {
  IdempotentReplayPolicy,
  makeNativeDeliveryScheduler,
  NativeSchedulePolicy,
} from "@beep/repo-ai-metrics/native-schedule";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { makePayloadReclaimer, PayloadRetentionPolicy } from "@beep/repo-ai-metrics/payload-reclamation";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { NodeCrypto, NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const id = (digit: string) => Sha256Hex.make(Str.repeat(64)(digit));
const program = Effect.gen(function* () {
  const [database, origin, output, endpoint] = yield* S.decodeUnknownEffect(
    S.Tuple([S.String, S.String, S.String, S.String])
  )(process.argv.slice(2));
  for (const value of [origin, endpoint]) {
    const url = new URL(value);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") return yield* Effect.die("Disposable loopback only");
  }
  const fs = yield* FileSystem.FileSystem;
  const sql = yield* SqliteClient.make({ filename: database });
  const live = yield* Clock.Clock;
  const clockAt = (millis: number): Clock.Clock => ({
    currentTimeMillisUnsafe: () => millis,
    currentTimeMillis: Effect.succeed(millis),
    currentTimeNanosUnsafe: () => BigInt(millis) * 1000000n,
    currentTimeNanos: Effect.succeed(BigInt(millis) * 1000000n),
    monotonicTimeNanosUnsafe: () => live.monotonicTimeNanosUnsafe(),
    monotonicTimeNanos: live.monotonicTimeNanos,
    sleep: (duration) => live.sleep(duration),
  });
  const result = yield* Effect.gen(function* () {
    const salt = "synthetic-epoch-proof";
    const intake = TranscriptIntakeConfig.make({
      hostId: id("a"),
      namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
      maxPages: 4,
      maxPayloadBytes: 1048576,
      maxDatabasePages: 256,
    });
    const policy = NativeDeliveryPolicy.make({
      endpoint: Redacted.make(endpoint),
      readbackOrigin: O.some(Redacted.make(origin)),
      project: "foundation-epoch-proof",
      timeoutMillis: 5000,
    });
    const config = DeliveryLedgerConfig.make({
      targetId: yield* nativeDeliveryTargetId(policy),
      maxEvents: 4,
      maxAttempts: 8,
      maxAttemptsPerEvent: 4,
    });
    const native = yield* makeNativeIntakeJournal(intake);
    const worker = yield* makeNativeDelivery(intake, config, policy);
    const reader = yield* makeNativeReadback(intake, config, policy, PhoenixConfigInput.make({ baseUrl: origin }));
    const reclaimer = yield* makePayloadReclaimer(
      intake,
      config,
      PayloadRetentionPolicy.make({
        minAgeMillis: 60000,
        minAttemptQuietMillis: 60000,
        maxDispositions: 4,
        expireAfterMillis: O.some(86400000),
      })
    );
    const retention = yield* makeEvidenceRetention(
      intake,
      config,
      EvidenceRetentionPolicy.make({
        minEpochMillis: 60000,
        minAttemptQuietMillis: 60000,
        maxRecords: 32,
        deadlineMillis: 10000,
      })
    );
    const body = yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  traceId: "7".repeat(32),
                  spanId: "7".repeat(16),
                  name: "claude_code.llm_request",
                  startTimeUnixNano: "1793000000000000000",
                  endTimeUnixNano: "1793000000100000000",
                  attributes: [
                    { key: "input_tokens", value: { intValue: "10" } },
                    { key: "output_tokens", value: { intValue: "5" } },
                    { key: "cache_read_tokens", value: { intValue: "0" } },
                    { key: "cache_creation_tokens", value: { intValue: "0" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const batch = yield* projectNativeTraceRequest(
      NativeTraceRequest.make({
        routeId: id("c"),
        hashSalt: Redacted.make(salt),
        contentType: "application/json",
        body: new TextEncoder().encode(body),
        approvedModels: [],
        usageConvention: "claude-code",
      })
    );
    const span = batch.spans[0];
    if (span === undefined) return yield* Effect.die("Missing synthetic span");
    const first = yield* native.acceptBatch(batch);
    const request0 = NativeDeliveryRequest.make({
      receiptId: first.page.receiptId,
      attemptId: id("d"),
      offset: 0,
      limit: 1,
    });
    yield* worker.send(request0);
    let firstVisible = false;
    for (let pass = 0; pass < 30; pass++) {
      const initial = yield* reader.reconcile(request0, span.eventId).pipe(
        Effect.catchIf(
          (error) => error.reason === "not-found",
          () => Effect.succeed({ _tag: "Waiting" })
        )
      );
      if (initial._tag === "Visible") {
        firstVisible = true;
        break;
      }
      yield* Effect.sleep("200 millis");
    }
    if (!firstVisible) return yield* Effect.die("Initial visibility missing");
    const originalAttempt = O.getOrThrow(yield* worker.ledger.attempt(request0.attemptId));
    const later = (yield* Clock.currentTimeMillis) + 61000;
    yield* reclaimer.reclaim(first.page.receiptId).pipe(Effect.provideService(Clock.Clock, clockAt(later)));
    const sealed = yield* retention.seal(0).pipe(Effect.provideService(Clock.Clock, clockAt(later)));
    if (O.isNone(sealed)) return yield* Effect.die("Epoch did not retire");
    return yield* Effect.gen(function* () {
      const second = yield* native.acceptBatch(batch);
      if (second.page.evidenceEpoch !== 1 || second.page.receiptId === first.page.receiptId)
        return yield* Effect.die("Epoch identity not advanced");
      const request1 = NativeDeliveryRequest.make({
        receiptId: second.page.receiptId,
        attemptId: id("e"),
        offset: 0,
        limit: 1,
      });
      yield* worker.send(request1);
      yield* Effect.sleep("3 seconds");
      const readback = yield* reader.reconcile(request1, span.eventId);
      const currentAttempt = O.getOrThrow(yield* worker.ledger.attempt(request1.attemptId));
      if (currentAttempt.payloadDigest === originalAttempt.payloadDigest)
        return yield* Effect.die("Epoch failed to change encoded bytes");
      if (readback._tag !== "Mismatch" && readback._tag !== "Visible")
        return yield* Effect.die("Unexpected epoch readback");
      const state = O.getOrThrow(yield* worker.ledger.state(span.eventId));
      if ((readback._tag === "Visible") !== (state.state === "visible")) return yield* Effect.die("False visibility");
      const scheduler = yield* makeNativeDeliveryScheduler(
        intake,
        config,
        NativeSchedulePolicy.make({
          maxEvents: 4,
          retryDelayMillis: 100,
          maxRetryDelayMillis: 400,
          reconcileDelayMillis: 100,
          tickTimeoutMillis: 5000,
          // Synthetic policy exercises the replay guard; it grants no production qualification.
          idempotentReplay: O.some(
            IdempotentReplayPolicy.make({
              targetId: config.targetId,
              qualificationDigest: id("f"),
              minimumDelayMillis: 3000,
            })
          ),
        }),
        worker,
        reader
      );
      const tick = yield* scheduler.tick.pipe(Effect.provideService(Clock.Clock, clockAt(later + 5000)));
      if (tick._tag !== "Complete" || tick.outcomes.length !== 1)
        return yield* Effect.die("Missing scheduler observation");
      const outcome = tick.outcomes[0];
      if (readback._tag === "Mismatch" && (outcome?._tag !== "Reconciled" || outcome.result._tag !== "Mismatch"))
        return yield* Effect.die("Scheduler did not exercise mismatch replay guard");
      const afterTick = O.getOrThrow(yield* worker.ledger.state(span.eventId));
      if (afterTick.attempts !== state.attempts) return yield* Effect.die("Unexpected automatic replay");
      const expired = yield* reclaimer
        .expire(second.page.receiptId)
        .pipe(Effect.provideService(Clock.Clock, clockAt(later + 86401000)));
      return {
        stableEventId: span.eventId,
        traceId: span.traceId,
        spanId: span.spanId,
        epoch: second.page.evidenceEpoch,
        priorWindow: sealed.value.record,
        encodedBytesChanged: true,
        readback,
        state,
        afterTick,
        schedulerTick: tick,
        syntheticReplayPolicyEnabled: true,
        expired,
        lifecycleClock: "explicit fixed wall clock; network and deadlines use real timers",
      };
    }).pipe(Effect.provideService(Clock.Clock, clockAt(later)));
  }).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  yield* fs.writeFileString(output, yield* S.encodeEffect(S.fromJsonString(S.Unknown))(result), { mode: 0o600 });
});
NodeRuntime.runMain(
  Layer.mergeAll(
    Layer.mergeAll(NodeServices.layer, NodeCrypto.layer),
    Reactivity.layer,
    NodeHttpClient.layerNodeHttp
  ).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  )
);
