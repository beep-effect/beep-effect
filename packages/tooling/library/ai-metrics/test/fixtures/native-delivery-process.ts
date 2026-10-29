import { PhoenixConfigInput } from "@beep/phoenix";
// Dedicated synthetic native sender; only the parent-owned loopback endpoint is used.
import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import {
  makeNativeDelivery,
  NativeDeliveryPolicy,
  NativeDeliveryRequest,
  nativeDeliveryTargetId,
} from "@beep/repo-ai-metrics/native-delivery";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { makeNativeReadback } from "@beep/repo-ai-metrics/native-readback";
import {
  makeNativeDeliveryScheduler,
  NativeSchedulePolicy,
  NativeScheduleTick,
} from "@beep/repo-ai-metrics/native-schedule";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import * as A from "effect/Array";
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
  const [mode, databasePath, output, marker, endpoint] = yield* S.decodeUnknownEffect(
    S.Tuple([
      S.Literals(["inspect", "send", "before-result", "after-result", "schedule-before-result", "schedule-tick"]),
      S.String,
      S.String,
      S.String,
      S.String,
    ])
  )(A.drop(process.argv, 2));
  const fs = yield* FileSystem.FileSystem;
  const client = yield* SqliteClient.make({ filename: databasePath });
  const writeJson = (path: string, value: unknown) =>
    S.encodeEffect(S.fromJsonString(S.Unknown))(value).pipe(
      Effect.flatMap((value) => fs.writeFileString(`${path}.partial`, value, { mode: 0o600 })),
      Effect.andThen(fs.rename(`${path}.partial`, path))
    );
  const sql = new Proxy(client, {
    apply(target, receiver, parameters) {
      const fragments: unknown = parameters[0];
      if (
        (mode === "before-result" || mode === "schedule-before-result") &&
        S.is(S.Array(S.String))(fragments) &&
        Str.includes("INSERT INTO observation_delivery_results")(fragments[0] ?? "")
      ) {
        return Effect.gen(function* () {
          yield* writeJson(marker, {
            boundary: mode,
            attempts: yield* client`SELECT count(*) AS n FROM observation_delivery_attempts`,
            results: yield* client`SELECT count(*) AS n FROM observation_delivery_results`,
          });
          return yield* Effect.never;
        });
      }
      return Reflect.apply(target, receiver, parameters);
    },
  });
  const salt = "synthetic-delivery-process-salt";
  const intake = TranscriptIntakeConfig.make({
    hostId: id("a"),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 16,
    maxPayloadBytes: 1_048_576,
    maxDatabasePages: 256,
  });
  const policy = NativeDeliveryPolicy.make({
    endpoint: Redacted.make(endpoint),
    project: "synthetic-process",
    timeoutMillis: 2000,
  });
  const config = DeliveryLedgerConfig.make({
    targetId: yield* nativeDeliveryTargetId(policy),
    maxEvents: 16,
    maxAttempts: 16,
    maxAttemptsPerEvent: 8,
  });
  const scheduling = mode === "schedule-before-result" || mode === "schedule-tick";
  const body = yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              { traceId: Str.repeat(32)("1"), spanId: Str.repeat(16)("2"), name: "synthetic-private-ledger-source" },
              ...(scheduling
                ? [
                    {
                      traceId: Str.repeat(32)("1"),
                      spanId: Str.repeat(16)("3"),
                      name: "synthetic-private-ledger-source",
                    },
                  ]
                : []),
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
      usageConvention: "unknown",
    })
  );
  const event = batch.spans[0];
  if (event === undefined) return yield* Effect.die("Invalid fixture");
  const native = yield* makeNativeIntakeJournal(intake).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const worker = yield* makeNativeDelivery(intake, config, policy).pipe(
    Effect.provideService(SqlClient.SqlClient, sql)
  );
  const ledger = worker.ledger;
  let sendResult: unknown = null;
  if (mode !== "inspect") {
    const receipt = yield* native.acceptBatch(batch);
    if (scheduling) {
      const reader = yield* makeNativeReadback(
        intake,
        config,
        policy,
        PhoenixConfigInput.make({ baseUrl: new URL(endpoint).origin })
      ).pipe(Effect.provideService(SqlClient.SqlClient, sql));
      const scheduler = yield* makeNativeDeliveryScheduler(
        intake,
        config,
        NativeSchedulePolicy.make({
          maxEvents: 1,
          retryDelayMillis: 100,
          maxRetryDelayMillis: 400,
          reconcileDelayMillis: 100,
          tickTimeoutMillis: 5000,
        }),
        worker,
        reader
      ).pipe(Effect.provideService(SqlClient.SqlClient, sql));
      sendResult = yield* scheduler.tick.pipe(Effect.flatMap(S.encodeEffect(S.toCodecJson(NativeScheduleTick))));
    } else {
      sendResult = yield* worker.send(
        NativeDeliveryRequest.make({ receiptId: receipt.page.receiptId, attemptId: id("d"), offset: 0, limit: 512 })
      );
    }
    if (mode === "after-result") {
      yield* writeJson(marker, {
        boundary: mode,
        attempts: yield* client`SELECT count(*) AS n FROM observation_delivery_attempts`,
        results: yield* client`SELECT count(*) AS n FROM observation_delivery_results`,
      });
      return yield* Effect.never;
    }
  }
  yield* writeJson(output, {
    sendResult,
    state: O.getOrNull(yield* ledger.state(event.eventId)),
    attempts: yield* client`SELECT count(*) AS n FROM observation_delivery_attempts`,
    results: yield* client`SELECT count(*) AS n FROM observation_delivery_results`,
    integrity: yield* client`PRAGMA integrity_check`,
  });
});
NodeRuntime.runMain(
  Layer.mergeAll(NodeServices.layer, Reactivity.layer, NodeHttpClient.layerNodeHttp).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  )
);
