// Dedicated synthetic process fixture; no network or historical source access.
import { DeliveryAttempt, DeliveryLedgerConfig, makeDeliveryLedger } from "@beep/repo-ai-metrics/delivery-ledger";
import { EvidenceRetentionPolicy, makeEvidenceRetention } from "@beep/repo-ai-metrics/evidence-retention";
import { EvidenceWindow } from "@beep/repo-ai-metrics/evidence-window";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { makePayloadReclaimer, PayloadRetentionPolicy } from "@beep/repo-ai-metrics/payload-reclamation";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import * as A from "effect/Array";
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

const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const program = Effect.gen(function* () {
  const [mode, databasePath, output, marker] = yield* S.decodeUnknownEffect(
    S.Tuple([
      S.Literals([
        "inspect",
        "new-epoch",
        "before-window",
        "after-window",
        "before-restore",
        "after-restore",
        "restore",
      ]),
      S.String,
      S.String,
      S.String,
    ])
  )(A.drop(process.argv, 2));
  const fs = yield* FileSystem.FileSystem;
  const client = yield* SqliteClient.make({ filename: databasePath });
  const writeJson = (path: string, value: unknown) =>
    S.encodeEffect(S.fromJsonString(S.Unknown))(value).pipe(
      Effect.flatMap((v) => fs.writeFileString(`${path}.partial`, v, { mode: 0o600 })),
      Effect.andThen(fs.rename(`${path}.partial`, path))
    );
  const sql = new Proxy(client, {
    apply(target, receiver, parameters) {
      const fragments: unknown = parameters[0];
      if (
        (mode === "before-window" || mode === "before-restore") &&
        S.is(S.Array(S.String))(fragments) &&
        Str.includes("UPDATE observation_evidence_window")(fragments[0] ?? "")
      )
        return Effect.gen(function* () {
          yield* writeJson(marker, {
            boundary: mode,
            events: yield* client`SELECT count(*) AS n FROM observation_delivery_events`,
          });
          return yield* Effect.never;
        });
      return Reflect.apply(target, receiver, parameters);
    },
  });
  const salt = "synthetic-window-salt";
  const intake = TranscriptIntakeConfig.make({
    hostId: id("a"),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 16,
    maxPayloadBytes: 1048576,
    maxDatabasePages: 256,
  });
  const ledgerConfig = DeliveryLedgerConfig.make({
    targetId: id("b"),
    maxEvents: 16,
    maxAttempts: 16,
    maxAttemptsPerEvent: 8,
  });
  const native = yield* makeNativeIntakeJournal(intake).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const ledger = yield* makeDeliveryLedger(intake, ledgerConfig).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const reclaimer = yield* makePayloadReclaimer(
    intake,
    ledgerConfig,
    PayloadRetentionPolicy.make({
      minAgeMillis: 60000,
      minAttemptQuietMillis: 60000,
      maxDispositions: 16,
      expireAfterMillis: O.some(86400000),
    })
  ).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const retention = yield* makeEvidenceRetention(
    intake,
    ledgerConfig,
    EvidenceRetentionPolicy.make({
      minEpochMillis: 60000,
      minAttemptQuietMillis: 60000,
      maxRecords: 16,
      deadlineMillis: 60000,
    })
  ).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const body = yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
    resourceSpans: [{ scopeSpans: [{ spans: [{ traceId: Str.repeat(32)("1"), spanId: Str.repeat(16)("2") }] }] }],
  });
  const batch = yield* projectNativeTraceRequest(
    NativeTraceRequest.make({
      routeId: id("c"),
      hashSalt: Redacted.make(salt),
      contentType: "application/json",
      body: new TextEncoder().encode(body),
      approvedModels: [],
      usageConvention: "unknown",
    })
  );
  const event = batch.spans[0];
  if (event === undefined) return yield* Effect.die("Missing fixture event");
  let acceptedEpoch: number | null = null;
  if (mode === "new-epoch") acceptedEpoch = (yield* native.acceptBatch(batch)).page.evidenceEpoch;
  if (mode === "before-window" || mode === "after-window") {
    const existing =
      yield* client`SELECT receipt_id AS id FROM observation_native_events WHERE event_id=${event.eventId}`.pipe(
        Effect.flatMap(S.decodeUnknownEffect(S.Array(S.Struct({ id: Sha256Hex }))))
      );
    const receipt =
      existing[0] === undefined ? O.some(yield* native.acceptBatch(batch)) : yield* native.receipt(existing[0].id);
    if (O.isNone(receipt)) return yield* Effect.die("Missing fixture receipt");
    yield* ledger.registerPage(receipt.value.page.receiptId);
    yield* ledger.prepareAttempt(
      DeliveryAttempt.make({ attemptId: id("d"), eventIds: [event.eventId], payloadDigest: id("e") })
    );
    const clock = yield* Clock.Clock;
    const now = receipt.value.page.acceptedAt + 86460001;
    const advanced: Clock.Clock = {
      currentTimeMillis: Effect.succeed(now),
      currentTimeMillisUnsafe: () => now,
      currentTimeNanos: clock.currentTimeNanos,
      currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
      monotonicTimeNanos: clock.monotonicTimeNanos,
      monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
      sleep: (duration) => clock.sleep(duration),
    };
    yield* reclaimer.expire(receipt.value.page.receiptId).pipe(Effect.provideService(Clock.Clock, advanced));
    yield* retention.seal(0).pipe(Effect.provideService(Clock.Clock, advanced));
    if (mode === "after-window") {
      yield* writeJson(marker, {
        boundary: mode,
        events: yield* client`SELECT count(*) AS n FROM observation_delivery_events`,
      });
      return yield* Effect.never;
    }
  }
  let restored: string | null = null;
  if (mode === "before-restore" || mode === "after-restore" || mode === "restore") {
    const rows = yield* client`SELECT payload FROM observation_evidence_recovery WHERE singleton=1`.pipe(
      Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ payload: S.String })])))
    );
    const manifest = yield* S.decodeEffect(S.fromJsonString(S.Struct({ retirementDigest: Sha256Hex })))(
      rows[0].payload
    );
    restored = yield* retention.restore(manifest.retirementDigest);
    if (mode === "after-restore") {
      yield* writeJson(marker, {
        boundary: mode,
        events: yield* client`SELECT count(*) AS n FROM observation_delivery_events`,
      });
      return yield* Effect.never;
    }
  }
  yield* writeJson(output, {
    restored,
    window: yield* S.encodeEffect(EvidenceWindow)(yield* retention.window),
    state: O.getOrNull(yield* ledger.state(event.eventId)),
    acceptedEpoch,
    events: yield* client`SELECT count(*) AS n FROM observation_delivery_events`,
    integrity: yield* client`PRAGMA integrity_check`,
  });
});
NodeRuntime.runMain(
  Layer.mergeAll(NodeServices.layer, Reactivity.layer).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  )
);
