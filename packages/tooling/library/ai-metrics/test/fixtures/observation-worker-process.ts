// Disposable resource/failure proof only. Fixture routes must never enter a production listener.
import { PhoenixConfigInput } from "@beep/phoenix";
import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import { EvidenceRetentionPolicy } from "@beep/repo-ai-metrics/evidence-retention";
import { NativeDeliveryPolicy, nativeDeliveryTargetId } from "@beep/repo-ai-metrics/native-delivery";
import { NativeHttpPolicy } from "@beep/repo-ai-metrics/native-http";
import { ObservationBackupPolicy } from "@beep/repo-ai-metrics/observation-backup";
import { ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import { makeObservationWorker, ObservationWorkerConfig } from "@beep/repo-ai-metrics/observation-worker";
import { PayloadRetentionPolicy } from "@beep/repo-ai-metrics/payload-reclamation";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import {
  makeTranscriptDiscovery,
  TranscriptDiscoveryInput,
  TranscriptDiscoveryReadPolicy,
} from "@beep/repo-ai-metrics/transcript-discovery";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.String, S.String]));
const isCodeRecord = S.is(S.Struct({ code: S.tag("EMFILE") }));
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));

const program = Effect.gen(function* () {
  const [databasePath, outputPath] = yield* decodeArguments(A.drop(process.argv, 2));
  const fs = yield* FileSystem.FileSystem;
  const sql = yield* SqliteClient.make({ filename: databasePath });
  const salt = "synthetic-resource-worker-salt";
  // The resource proof performs no backend traffic; loopback port 9 is never called.
  const delivery = NativeDeliveryPolicy.make({
    endpoint: Redacted.make("http://127.0.0.1:9/v1/traces"),
    project: "synthetic-resource-proof",
    timeoutMillis: 1000,
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
      bodyTimeoutMillis: 1000,
    }),
    delivery,
    backend: PhoenixConfigInput.make({ baseUrl: "http://127.0.0.1:9" }),
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
    control: ObservationControlPolicy.make({ maxActive: 4, drainTimeoutMillis: 2000 }),
  });
  const worker = yield* makeObservationWorker(config).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  yield* fs.makeDirectory(`${databasePath}.discovery-parent`, { recursive: true });
  const socketPath = `${databasePath}.sock`;
  yield* fs.remove(socketPath, { force: true });
  const server = Context.get(
    yield* Layer.build(BunHttpServer.layer({ unix: socketPath, maxRequestBodySize: 524288, idleTimeout: 2 })),
    HttpServer.HttpServer
  );
  const handler = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (request.url === "/__fixture/state")
      return yield* HttpServerResponse.json({ control: yield* worker.status, stats: yield* worker.stats });
    if (request.url === "/__fixture/resume" && request.method === "POST")
      return yield* HttpServerResponse.json(yield* worker.resume);
    if (request.url === "/__fixture/backup" && request.method === "POST") {
      yield* worker.pause;
      return yield* HttpServerResponse.json(
        yield* worker.backup(ObservationBackupPolicy.make({ maxBytes: 1048576 }), `${databasePath}.backup`)
      );
    }
    if (request.url === "/__fixture/discovery" && request.method === "POST") {
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const directory = yield* fs.makeTempDirectoryScoped({ directory: `${databasePath}.discovery-parent` });
          for (const n of A.range(1, 12)) yield* fs.writeFileString(`${directory}/ignored-${n}.txt`, "");
          const discovery = yield* makeTranscriptDiscovery(
            TranscriptDiscoveryInput.make({
              roots: [{ path: directory, source: "codex", retired: false }],
              hashSalt: config.nativeHttp.hashSalt,
              maxDepth: 2,
              maxEntries: 32,
              maxFiles: 32,
              maxCycleEntries: 64,
            })
          );
          return yield* worker.discover(
            discovery,
            TranscriptDiscoveryReadPolicy.make({
              maxBytes: 512,
              maxLineBytes: 256,
              maxFrames: 1,
            })
          );
        })
      );
      return yield* HttpServerResponse.json(result);
    }
    if (request.url === "/__fixture/fd" && request.method === "POST") {
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          for (let opened = 0; opened < 512; opened += 1) {
            const handle = yield* Effect.result(fs.open("/dev/null", { flag: "r" }));
            if (Result.isFailure(handle)) return { opened, exhausted: isCodeRecord(handle.failure.reason.cause) };
          }
          return { opened: 512, exhausted: false };
        })
      );
      return yield* HttpServerResponse.json(result);
    }
    if (request.url === "/__fixture/cpu" && request.method === "POST") {
      const result = yield* Effect.sync(() => {
        const start = performance.now();
        let iterations = 0;
        while (performance.now() - start < 2000) iterations += 1;
        return { elapsedMillis: performance.now() - start, iterations };
      });
      return yield* HttpServerResponse.json(result);
    }
    if (request.url === "/__fixture/memory" && request.method === "POST") {
      // Parent must verify the cgroup memory/swap ceilings before invoking this route.
      yield* Effect.sync(() => {
        const retained: Array<Uint8Array> = [];
        for (let n = 0; n < 128; n += 1) retained.push(new Uint8Array(8 * 1024 * 1024).fill(n));
        return retained.length;
      });
      return yield* HttpServerResponse.json({ memoryLimitDidNotStopFixture: true });
    }
    return yield* worker.handler;
  });
  yield* server.serve(handler);
  yield* fs.chmod(socketPath, 0o600);
  const ready = yield* encodeJsonValue({
    socketPath,
    pid: process.pid,
    control: yield* worker.status,
  });
  yield* fs.writeFileString(`${outputPath}.partial`, ready, { mode: 0o600 });
  yield* fs.rename(`${outputPath}.partial`, outputPath);
  return yield* Effect.never;
});
NodeRuntime.runMain(
  Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, NodeHttpClient.layerNodeHttp, Reactivity.layer).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  )
);
