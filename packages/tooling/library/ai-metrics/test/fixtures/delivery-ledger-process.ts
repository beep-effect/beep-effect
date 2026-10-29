// Dedicated synthetic SQLite process fixture. It performs no network send.
import {
  DeliveryAttempt,
  DeliveryLedgerConfig,
  DeliveryOutcome,
  makeDeliveryLedger,
} from "@beep/repo-ai-metrics/delivery-ledger";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
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
  const [mode, databasePath, output, marker] = yield* S.decodeUnknownEffect(
    S.Tuple([S.Literals(["inspect", "accept", "before-result", "after-result"]), S.String, S.String, S.String])
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
        mode === "before-result" &&
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
  const config = DeliveryLedgerConfig.make({
    targetId: id("b"),
    maxEvents: 16,
    maxAttempts: 16,
    maxAttemptsPerEvent: 8,
  });
  const body = yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              { traceId: Str.repeat(32)("1"), spanId: Str.repeat(16)("2"), name: "synthetic-private-ledger-source" },
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
  const ledger = yield* makeDeliveryLedger(intake, config).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  if (mode !== "inspect") {
    const receipt = yield* native.acceptBatch(batch);
    yield* ledger.registerPage(receipt.page.receiptId);
    yield* ledger.prepareAttempt(
      DeliveryAttempt.make({ attemptId: id("d"), payloadDigest: id("e"), eventIds: [event.eventId] })
    );
    yield* ledger.recordOutcome(id("d"), DeliveryOutcome.cases.Accepted.make({}));
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
    state: O.getOrNull(yield* ledger.state(event.eventId)),
    attempts: yield* client`SELECT count(*) AS n FROM observation_delivery_attempts`,
    results: yield* client`SELECT count(*) AS n FROM observation_delivery_results`,
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
