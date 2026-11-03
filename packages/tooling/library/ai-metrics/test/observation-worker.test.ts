import { PhoenixConfigInput } from "@beep/phoenix";
import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import { EvidenceRetentionPolicy } from "@beep/repo-ai-metrics/evidence-retention";
import {
  NativeDeliveryPolicy,
  NativeDeliveryRequest,
  nativeDeliveryTargetId,
} from "@beep/repo-ai-metrics/native-delivery";
import { NativeHttpPolicy } from "@beep/repo-ai-metrics/native-http";
import { ObservationBackupPolicy } from "@beep/repo-ai-metrics/observation-backup";
import { ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import { makeObservationMaintenanceHttp } from "@beep/repo-ai-metrics/observation-maintenance-http";
import { makeObservationRuntime, ObservationRuntimePolicy } from "@beep/repo-ai-metrics/observation-runtime";
import { makeObservationWorker, ObservationWorkerConfig } from "@beep/repo-ai-metrics/observation-worker";
import { PayloadRetentionPolicy } from "@beep/repo-ai-metrics/payload-reclamation";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import {
  makeTranscriptDiscovery,
  TranscriptDiscoveryInput,
  TranscriptDiscoveryReadPolicy,
} from "@beep/repo-ai-metrics/transcript-discovery";
import {
  makeTranscriptIntakeJournal,
  TranscriptAcceptance,
  TranscriptIntakeConfig,
} from "@beep/repo-ai-metrics/transcript-intake";
import { TranscriptSweepInput } from "@beep/repo-ai-metrics/transcript-sweep";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as Protobuf from "protobufjs";
import type * as Statement from "effect/sql/Statement";

const sqlLayer = Layer.merge(makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver }), NodeCrypto.layer);
const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const isStringRows = S.is(S.Array(S.String));
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.Struct({ id: Sha256Hex })]));

const fixture = Effect.fn("ObservationWorkerTest.fixture")(function* (blockBackend = false, blockAdmission = false) {
  const sql = yield* SqlClient.SqlClient;
  const backendCalls = yield* Ref.make(0);
  const backendStarted = yield* Deferred.make<void>();
  const backendRelease = yield* Deferred.make<void>();
  const admissionStarted = yield* Deferred.make<void>();
  const admissionRelease = yield* Deferred.make<void>();
  const proxy = new Proxy(sql, {
    apply(target, receiver, parameters) {
      const fragments: unknown = parameters[0];
      const original: Statement.Statement<Record<string, unknown>> = Reflect.apply(target, receiver, parameters);
      if (
        blockAdmission === true &&
        isStringRows(fragments) &&
        Str.includes("INSERT INTO observation_intake_pages")(fragments[0] ?? "")
      )
        return Deferred.succeed(admissionStarted, undefined).pipe(
          Effect.andThen(Deferred.await(admissionRelease)),
          Effect.andThen(original)
        );
      return original;
    },
  });
  const build1 = yield* Layer.build(NodeHttpServer.layerTest.pipe(Layer.fresh));
  const backend = Context.get(build1, HttpServer.HttpServer);
  // The factory-free test layer binds an ephemeral wildcard address; clients dial loopback.
  const origin = pipe(
    HttpServer.formatAddress(backend.address),
    Str.replace("[::]", "[::1]"),
    Str.replace("0.0.0.0", "127.0.0.1")
  );
  yield* backend.serve(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      yield* Ref.update(backendCalls, (n) => n + 1);
      if (request.method !== "POST") {
        return yield* HttpServerResponse.json({}, { status: 404 });
      }
      yield* request.arrayBuffer;
      yield* Deferred.succeed(backendStarted, undefined);
      if (blockBackend === true) {
        yield* Deferred.await(backendRelease);
      }
      return HttpServerResponse.uint8Array(new Uint8Array(), { contentType: "application/x-protobuf" });
    })
  );
  const build2 = yield* Layer.build(NodeHttpClient.layerNodeHttp);
  const client = Context.get(build2, HttpClient.HttpClient);
  const salt = "synthetic-worker-salt";
  const delivery = NativeDeliveryPolicy.make({
    endpoint: Redacted.make(`${origin}/v1/traces`),
    project: "synthetic-worker",
    timeoutMillis: 5000,
  });
  const config = ObservationWorkerConfig.make({
    intake: TranscriptIntakeConfig.make({
      hostId: id("a"),
      namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
      maxPages: 16,
      maxPayloadBytes: 1048576,
      maxDatabasePages: 256,
    }),
    ledger: DeliveryLedgerConfig.make({
      targetId: yield* nativeDeliveryTargetId(delivery),
      maxEvents: 64,
      maxAttempts: 64,
      maxAttemptsPerEvent: 8,
    }),
    nativeHttp: NativeHttpPolicy.make({
      routeId: id("b"),
      hashSalt: Redacted.make(salt),
      approvedModels: [],
      usageConvention: "unknown",
      bodyTimeoutMillis: 2000,
    }),
    delivery,
    backend: PhoenixConfigInput.make({ baseUrl: origin }),
    payloadRetention: PayloadRetentionPolicy.make({
      minAgeMillis: 60000,
      minAttemptQuietMillis: 60000,
      maxDispositions: 64,
      expireAfterMillis: O.some(86400000),
    }),
    evidenceRetention: EvidenceRetentionPolicy.make({
      minEpochMillis: 60000,
      minAttemptQuietMillis: 60000,
      maxRecords: 64,
      deadlineMillis: 10000,
    }),
    control: ObservationControlPolicy.make({ maxActive: 4, drainTimeoutMillis: 5000 }),
  });
  const worker = yield* makeObservationWorker(config).pipe(
    Effect.provideService(HttpClient.HttpClient, client),
    Effect.provideService(SqlClient.SqlClient, proxy)
  );
  const build3 = yield* Layer.build(NodeHttpServer.layerTest.pipe(Layer.fresh));
  const intake = Context.get(build3, HttpServer.HttpServer);
  yield* intake.serve(worker.handler);
  const post = Effect.fn("ObservationWorkerTest.post")(function* (digit = "1", protobuf = false) {
    const body = yield* encodeJsonValue({
      resourceSpans: [{ scopeSpans: [{ spans: [{ traceId: Str.repeat(32)("1"), spanId: Str.repeat(16)(digit) }] }] }],
    });
    const response = yield* client.execute(
      HttpClientRequest.post(`${HttpServer.formatAddress(intake.address)}/v1/traces`).pipe(
        HttpClientRequest.bodyUint8Array(protobuf === true ? new Uint8Array() : new TextEncoder().encode(body)),
        HttpClientRequest.setHeader("content-type", protobuf === true ? "application/x-protobuf" : "application/json")
      )
    );
    const argument = new Headers(response.headers);
    const arrayBuffer1 = yield* response.arrayBuffer;
    return {
      status: response.status,
      headers: argument,
      bytes: new Uint8Array(arrayBuffer1),
    };
  });
  const requestFor = (receiptId: Sha256Hex) =>
    NativeDeliveryRequest.make({ receiptId, attemptId: id("c"), offset: 0, limit: 512 });
  const event = sql`SELECT event_id AS id FROM observation_native_events LIMIT 1`.pipe(
    Effect.flatMap(decodeArguments),
    Effect.map((rows) => rows[0].id)
  );
  const paused = Effect.gen(function* () {
    while ((yield* worker.status).accepting) {
      yield* Effect.yieldNow;
    }
  });
  return {
    worker,
    config,
    sql,
    post,
    requestFor,
    event,
    paused,
    backendCalls,
    backendStarted,
    backendRelease,
    admissionStarted,
    admissionRelease,
  };
});
const futureClock = Effect.gen(function* () {
  const clock = yield* Clock.Clock;
  const now = (yield* Clock.currentTimeMillis) + 86460001;
  return {
    currentTimeMillis: Effect.succeed(now),
    currentTimeMillisUnsafe: () => now,
    currentTimeNanos: clock.currentTimeNanos,
    currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
    monotonicTimeNanos: clock.monotonicTimeNanos,
    monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
    sleep: (duration) => clock.sleep(duration),
  } satisfies Clock.Clock;
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("starts paused, refuses both HTTP encodings and drains a durable send before maintenance", () =>
    Effect.gen(function* () {
      const f = yield* fixture(true);
      const denied = yield* f.post();
      expect(denied.status).toBe(503);
      expect(denied.headers.get("retry-after")).toBe("1");
      expect(denied.headers.get("x-observation-receipt")).toBeNull();
      const binary = yield* f.post("1", true);
      const status = Protobuf.parse(
        'syntax="proto3"; message Status { int32 code=1; string message=2; }'
      ).root.lookupType("Status");
      expect(binary.status).toBe(503);
      expect(status.toObject(status.decode(binary.bytes))).toMatchObject({ code: 14 });
      const stats4 = yield* f.worker.stats;
      expect(stats4).toMatchObject({ pages: 0 });
      expect((yield* f.worker.tick.pipe(Effect.flip)).reason).toBe("paused");
      yield* f.worker.resume;
      const accepted = yield* f.post();
      expect(accepted.status).toBe(200);
      const receiptId = yield* S.decodeUnknownEffect(Sha256Hex)(accepted.headers.get("x-observation-receipt"));
      const request = f.requestFor(receiptId);
      expect((yield* f.worker.seal(0).pipe(Effect.flip)).reason).toBe("busy");
      const sending = yield* f.worker.send(request).pipe(Effect.forkChild);
      yield* Deferred.await(f.backendStarted);
      const pausing = yield* f.worker.pause.pipe(Effect.forkChild);
      yield* f.paused;
      expect((yield* f.post("2")).status).toBe(503);
      expect((yield* f.worker.resume.pipe(Effect.flip)).reason).toBe("busy");
      yield* Deferred.succeed(f.backendRelease, undefined);
      const join5 = yield* Fiber.join(sending);
      expect(join5).toMatchObject({ _tag: "Recorded", outcome: { _tag: "Accepted" } });
      const join6 = yield* Fiber.join(pausing);
      expect(join6).toMatchObject({ active: 0, accepting: false });
      const eventId = yield* f.event;
      const eventState7 = yield* f.worker.eventState(eventId);
      expect(eventState7).toMatchObject({
        _tag: "Some",
        value: { state: "accepted-unverified" },
      });
      expect((yield* f.worker.send(request).pipe(Effect.flip)).reason).toBe("paused");
      expect((yield* f.worker.reconcile(request, eventId).pipe(Effect.flip)).reason).toBe("paused");
      const got = yield* Ref.get(f.backendCalls);
      expect(got).toBe(1);
      const seal8 = yield* f.worker.seal(0);
      assertNone(seal8);
      yield* f.worker.resume;
      expect((yield* f.post("2")).status).toBe(200);
    }).pipe(Effect.timeout("15 seconds"))
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect(
    "drains an in-flight SQLite admission before allowing maintenance and never acknowledges a refused page",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture(false, true);
        yield* f.worker.resume;
        const posting = yield* f.post().pipe(Effect.forkChild);
        yield* Deferred.await(f.admissionStarted);
        const pausing = yield* f.worker.pause.pipe(Effect.forkChild);
        yield* f.paused;
        const status9 = yield* f.worker.status;
        expect(status9).toMatchObject({ active: 1, accepting: false });
        expect((yield* f.post("2")).status).toBe(503);
        expect((yield* f.worker.seal(0).pipe(Effect.flip)).reason).toBe("busy");
        yield* Deferred.succeed(f.admissionRelease, undefined);
        const accepted = yield* Fiber.join(posting);
        expect(accepted.status).toBe(200);
        expect(accepted.headers.get("x-observation-receipt")).not.toBeNull();
        const join10 = yield* Fiber.join(pausing);
        expect(join10).toMatchObject({ active: 0, accepting: false });
        const stats11 = yield* f.worker.stats;
        expect(stats11).toMatchObject({ pages: 1, frames: 1 });
        const value12 = yield* f.sql`SELECT count(*) AS n FROM observation_native_receipts`;
        expect(value12).toEqual([{ n: 1 }]);
      }).pipe(Effect.timeout("15 seconds"))
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect(
    "coordinates expiry, retirement and restoration while preserving uncertainty and refusing paused sweeps",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const sweep = TranscriptSweepInput.make({
          sources: [{ path: "/synthetic-not-read/rollout.jsonl", source: "codex", retired: false }],
          hashSalt: f.config.nativeHttp.hashSalt,
          maxSources: 1,
          maxBytes: 512,
          maxLineBytes: 256,
          maxFrames: 1,
        });
        const pipe13 = yield* f.worker.sweep(sweep).pipe(Effect.flip);
        expect(pipe13).toMatchObject({
          _tag: "ObservationControlError",
          reason: "paused",
        });
        yield* f.worker.resume;
        const accepted = yield* f.post();
        const receiptId = yield* S.decodeUnknownEffect(Sha256Hex)(accepted.headers.get("x-observation-receipt"));
        const request = f.requestFor(receiptId);
        yield* f.worker.send(request);
        const eventId = yield* f.event;
        const clock = yield* futureClock;
        yield* f.worker.expire(receiptId).pipe(Effect.provideService(Clock.Clock, clock));
        yield* f.worker.pause;
        const pipe14 = yield* f.worker.seal(0).pipe(Effect.provideService(Clock.Clock, clock));
        const sealed = O.getOrThrow(pipe14);
        expect(sealed.record.totals).toMatchObject({ acceptedUnverified: 1, visible: 0, expiredPages: 1 });
        const window15 = yield* f.worker.window;
        expect(window15).toMatchObject({ epoch: 1 });
        const restore16 = yield* f.worker.restore(sealed.digest);
        expect(restore16).toBe("restored");
        const window17 = yield* f.worker.window;
        expect(window17).toMatchObject({ epoch: 0 });
        const eventState18 = yield* f.worker.eventState(eventId);
        expect(eventState18).toMatchObject({
          _tag: "Some",
          value: { state: "accepted-unverified" },
        });
        const status19 = yield* f.worker.status;
        expect(status19).toMatchObject({ accepting: false, active: 0, maintenance: false });
        yield* f.worker.resume;
        expect((yield* f.post()).status).toBe(410);
        expect((yield* f.post("2")).status).toBe(200);
        const got20 = yield* Ref.get(f.backendCalls);
        expect(got20).toBe(1);
      }).pipe(Effect.timeout("15 seconds"))
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("captures a physical backup only while paused and leaves admission closed", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.chmod(root, 0o700);
      const policy = ObservationBackupPolicy.make({ maxBytes: 1048576 });
      yield* f.worker.resume;
      expect((yield* f.post()).status).toBe(200);
      const pipe21 = yield* f.worker.backup(policy, `${root}/busy`).pipe(Effect.flip);
      expect(pipe21).toMatchObject({
        _tag: "ObservationControlError",
        reason: "busy",
      });
      const exists22 = yield* fs.exists(`${root}/busy`);
      expect(exists22).toBe(false);
      yield* f.worker.pause;
      const receipt = yield* f.worker.backup(policy, `${root}/backup`);
      expect(receipt.manifest.hostId).toBe(f.config.intake.hostId);
      const exists23 = yield* fs.exists(`${root}/backup/manifest.json`);
      expect(exists23).toBe(true);
      const status24 = yield* f.worker.status;
      expect(status24).toMatchObject({ accepting: false, active: 0, maintenance: false });
      expect((yield* f.post()).status).toBe(503);
    })
  )
);

it.layer(Layer.fresh(Layer.merge(sqlLayer, NodeServices.layer)), { timeout: "30 seconds", excludeTestServices: true })(
  (it) =>
    it.effect("gates real filesystem discovery and its durable reader behind worker admission", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* fs.makeTempDirectoryScoped();
        yield* fs.writeFileString(
          `${dir}/rollout-synthetic.jsonl`,
          '{"type":"response_item","payload":{"type":"message"}}\n'
        );
        const discovery = yield* makeTranscriptDiscovery(
          TranscriptDiscoveryInput.make({
            roots: [{ path: dir, source: "codex", retired: false }],
            hashSalt: f.config.nativeHttp.hashSalt,
            maxDepth: 2,
            maxEntries: 1,
            maxFiles: 32,
            maxCycleEntries: 128,
          })
        );
        const policy = TranscriptDiscoveryReadPolicy.make({ maxBytes: 512, maxLineBytes: 256, maxFrames: 1 });
        const pipe25 = yield* f.worker.discover(discovery, policy).pipe(Effect.flip);
        expect(pipe25).toMatchObject({ reason: "paused" });
        expect((yield* f.worker.stats).pages).toBe(0);
        yield* f.worker.resume;
        const result = yield* f.worker.discover(discovery, policy);
        expect(result.discovery.roots[0]).toMatchObject({ cycle: 1, state: "scanning" });
        expect(result.discovery.activeHelpers).toBe(1);
        expect((yield* f.worker.stats).pages).toBe(0);
        yield* f.worker.pause;
        const pipe26 = yield* f.worker.discover(discovery, policy).pipe(Effect.flip);
        expect(pipe26).toMatchObject({ reason: "paused" });
        yield* f.worker.resume;
        const restarted = yield* f.worker.discover(discovery, policy);
        expect(restarted.discovery.roots[0]).toMatchObject({ cycle: 2, state: "scanning" });
        const accepted = yield* f.worker.discover(discovery, policy);
        expect(accepted.sweep.outcomes[0]?._tag).toBe("Accepted");
        expect((yield* f.worker.stats).pages).toBe(1);
        const other = yield* makeTranscriptDiscovery(
          TranscriptDiscoveryInput.make({
            roots: [{ path: dir, source: "codex", retired: false }],
            hashSalt: f.config.nativeHttp.hashSalt,
            maxDepth: 2,
            maxEntries: 1,
            maxFiles: 1,
            maxCycleEntries: 128,
          })
        );
        const pipe27 = yield* f.worker.discover(other, policy).pipe(Effect.flip);
        expect(pipe27).toMatchObject({ reason: "configuration" });
        yield* f.worker.pause;
        expect((yield* f.worker.stats).pages).toBe(1);
      })
    )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("schedules accepted receipts after resume and drains the scheduler before pausing", () =>
    Effect.gen(function* () {
      const f = yield* fixture(true);
      yield* f.worker.resume;
      expect((yield* f.post()).status).toBe(200);
      const ticking = yield* f.worker.tick.pipe(Effect.forkChild);
      yield* Deferred.await(f.backendStarted);
      const pausing = yield* f.worker.pause.pipe(Effect.forkChild);
      yield* f.paused;
      expect((yield* f.worker.tick.pipe(Effect.flip)).reason).toBe("paused");
      yield* Deferred.succeed(f.backendRelease, undefined);
      const join28 = yield* Fiber.join(ticking);
      expect(join28).toMatchObject({ _tag: "Complete", outcomes: [{ _tag: "Sent" }] });
      const join29 = yield* Fiber.join(pausing);
      expect(join29).toMatchObject({ active: 0, accepting: false });
      const got30 = yield* Ref.get(f.backendCalls);
      expect(got30).toBe(1);
      const event45 = yield* f.event;
      const eventState31 = yield* f.worker.eventState(event45);
      expect(eventState31).toMatchObject({ value: { state: "accepted-unverified" } });
    }).pipe(Effect.timeout("15 seconds"))
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("runs the actual journal-to-socket scheduler on cadence and closes intake on shutdown", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const runtime = yield* makeObservationRuntime(
        f.worker,
        ObservationRuntimePolicy.make({ intervalMillis: 100, cycleTimeoutMillis: 1000, staleAfterMillis: 1500 })
      );
      const running = yield* runtime.run.pipe(Effect.forkChild);
      yield* runtime.health.pipe(
        Effect.repeat({ until: (health) => O.isSome(health.lastCycle), schedule: Schedule.spaced(5) })
      );
      const health32 = yield* runtime.health;
      expect(health32).toMatchObject({ phase: "paused", sourceCoverage: "unknown" });
      expect((yield* f.post()).status).toBe(503);
      yield* f.worker.resume;
      expect((yield* f.post()).status).toBe(200);
      const eventId = yield* f.event;
      yield* f.worker.eventState(eventId).pipe(
        Effect.repeat({
          until: (state) => O.isSome(state) && state.value.state === "accepted-unverified",
          schedule: Schedule.spaced(5),
        })
      );
      const got33 = yield* Ref.get(f.backendCalls);
      expect(got33).toBe(1);
      yield* Fiber.interrupt(running);
      const health34 = yield* runtime.health;
      expect(health34).toMatchObject({ phase: "stopped", running: false, sourceCoverage: "unknown" });
      const status35 = yield* f.worker.status;
      expect(status35).toMatchObject({ accepting: false, active: 0 });
      expect((yield* f.post("2")).status).toBe(503);
    }).pipe(Effect.timeout("15 seconds"))
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses an unexpected table beyond the complete owned table inventory on reopen", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const tables = yield* f.sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*'`;
      expect(tables.length).toBeGreaterThanOrEqual(20);
      yield* f.sql`CREATE TABLE unexpected_late_table (private_value TEXT)`;
      const pipe36 = yield* makeTranscriptIntakeJournal(f.config.intake).pipe(Effect.isFailure);
      expect(pipe36).toBe(true);
      expect((yield* f.sql`SELECT name FROM sqlite_master WHERE name='unexpected_late_table'`).length).toBe(1);
    })
  )
);
it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses an unexpected table beyond the complete owned table inventory before backup", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const tables = yield* f.sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*'`;
      expect(tables.length).toBeGreaterThanOrEqual(20);
      yield* f.sql`CREATE TABLE unexpected_late_table (private_value TEXT)`;
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.chmod(root, 0o700);
      const pipe37 = yield* f.worker
        .backup(ObservationBackupPolicy.make({ maxBytes: 1048576 }), `${root}/refused`)
        .pipe(Effect.isFailure);
      expect(pipe37).toBe(true);
      const exists38 = yield* fs.exists(`${root}/refused/manifest.json`);
      expect(exists38).toBe(false);
    })
  )
);

const maintenanceFixture = Effect.fn("ObservationWorkerTest.maintenanceFixture")(function* (future = false) {
  const f = yield* fixture();
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped();
  yield* fs.chmod(root, 0o700);
  const maintenance = yield* makeObservationMaintenanceHttp(f.worker, f.config, root);
  const build39 = yield* Layer.build(NodeHttpServer.layerTest.pipe(Layer.fresh));
  const server = Context.get(build39, HttpServer.HttpServer);
  yield* server.serve(
    future === true
      ? yield* futureClock.pipe(
          Effect.map((clock) => maintenance.handler.pipe(Effect.provideService(Clock.Clock, clock)))
        )
      : maintenance.handler
  );
  const build40 = yield* Layer.build(NodeHttpClient.layerNodeHttp);
  const client = Context.get(build40, HttpClient.HttpClient);
  const request = Effect.fn("ObservationWorkerTest.maintenanceRequest")(function* (
    command: unknown,
    hostId = f.config.intake.hostId,
    targetId = maintenance.context.targetId,
    ownerInstanceId = maintenance.context.ownerInstanceId
  ) {
    const body = yield* encodeJsonValue({
      version: "observation-maintenance/v1",
      hostId,
      namespaceId: f.config.intake.namespaceId,
      targetId,
      ownerInstanceId,
      command,
    });
    const response = yield* client.execute(
      HttpClientRequest.post(`${HttpServer.formatAddress(server.address)}/maintenance`).pipe(
        HttpClientRequest.bodyText(body, "application/json")
      )
    );
    return { status: response.status, text: yield* response.text };
  });
  return { ...f, root, fs, request, maintenance };
});
const decodeArgumentsJson = S.decodeEffect(S.fromJsonString(S.Tuple([TranscriptAcceptance])));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("private maintenance refuses active mutations, bad identity and arbitrary backup destinations", () =>
    Effect.gen(function* () {
      const f = yield* maintenanceFixture();
      expect((yield* f.request({ _tag: "Window" }, id("f"))).status).toBe(409);
      expect((yield* f.request({ _tag: "Window" }, f.config.intake.hostId, id("f"))).status).toBe(409);
      const anotherOwner = yield* makeObservationMaintenanceHttp(f.worker, f.config, f.root);
      expect(
        (yield* f.request(
          { _tag: "Window" },
          f.config.intake.hostId,
          f.config.ledger.targetId,
          anotherOwner.context.ownerInstanceId
        )).status
      ).toBe(409);

      expect((yield* f.request({ _tag: "Backup", slot: 4 })).status).toBe(400);
      expect((yield* f.request({ _tag: "Backup", slot: 0, directory: "synthetic-private" })).status).toBe(400);
      expect((yield* f.request({ _tag: "Window", extra: Str.repeat(5000)("x") })).status).toBe(413);
      yield* f.worker.resume;
      expect((yield* f.post()).status).toBe(200);
      expect((yield* f.request({ _tag: "Backup", slot: 0 })).status).toBe(503);
      expect((yield* f.request({ _tag: "Pages", afterSequence: 0 })).status).toBe(503);
      const exists41 = yield* f.fs.exists(`${f.root}/backup-0`);
      expect(exists41).toBe(false);
      yield* f.worker.pause;
      const pages = yield* f.request({ _tag: "Pages", afterSequence: 0 });
      expect(pages.status).toBe(200);
      const rows = yield* decodeArgumentsJson(pages.text);
      expect((yield* f.request({ _tag: "Pages", afterSequence: rows[0].sequence })).text).toBe("[]");
      expect((yield* f.request({ _tag: "Reclaim", receiptId: rows[0].receiptId })).text).toBe("null");
      expect((yield* f.request({ _tag: "Expire", receiptId: rows[0].receiptId })).text).toBe("null");
      const backup = yield* f.request({ _tag: "Backup", slot: 0 });
      expect(backup.status).toBe(200);
      const original = yield* f.fs.readFileString(`${f.root}/backup-0/manifest.json`);
      expect((yield* f.request({ _tag: "Backup", slot: 0 })).status).toBe(503);
      const readFileString42 = yield* f.fs.readFileString(`${f.root}/backup-0/manifest.json`);
      expect(readFileString42).toBe(original);
      expect((yield* f.request({ _tag: "Seal", epoch: 0 })).text).toBe("null");
      const status43 = yield* f.worker.status;
      expect(status43).toMatchObject({ accepting: false, active: 0, maintenance: false });
    })
  )
);
const decodeJsonValue = S.decodeEffect(S.fromJsonString(S.Unknown));
const decodeDigestRecordJson = S.decodeEffect(S.fromJsonString(S.Struct({ digest: Sha256Hex })));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("private maintenance expires old metadata, seals and restores exact evidence without resuming", () =>
    Effect.gen(function* () {
      const f = yield* maintenanceFixture(true);
      yield* f.worker.resume;
      const post = yield* f.post();
      const receiptId = yield* S.decodeUnknownEffect(Sha256Hex)(post.headers.get("x-observation-receipt"));
      yield* f.worker.pause;
      const expired = yield* f.request({ _tag: "Expire", receiptId });
      expect(expired.status).toBe(200);
      const decodedJsonValue = yield* decodeJsonValue(expired.text);
      expect(decodedJsonValue).toMatchObject({
        reason: "retention-expired",
      });
      const sealed = yield* f.request({ _tag: "Seal", epoch: 0 });
      expect(sealed.status).toBe(200);
      const seal = yield* decodeDigestRecordJson(sealed.text);
      expect((yield* f.request({ _tag: "RestoreEvidence", digest: id("f") })).status).toBe(503);
      expect((yield* f.request({ _tag: "RestoreEvidence", digest: seal.digest })).text).toBe('"restored"');
      expect((yield* f.request({ _tag: "RestoreEvidence", digest: seal.digest })).text).toBe('"already-restored"');
      const status44 = yield* f.worker.status;
      expect(status44).toMatchObject({ accepting: false, active: 0, maintenance: false });
    })
  )
);
