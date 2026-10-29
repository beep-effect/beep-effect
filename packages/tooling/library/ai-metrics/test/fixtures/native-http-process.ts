// Disposable loopback HTTP worker for synthetic crash boundaries only.
import { makeNativeHttpIntake, NativeHttpPolicy } from "@beep/repo-ai-metrics/native-http";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const decodeArguments = S.decodeUnknownEffect(
  S.Tuple([S.Literals(["inspect", "serve", "before-commit", "after-commit"]), S.String, S.String, S.String, S.String])
);
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));
const isStringRows = S.is(S.Array(S.String));

const program = Effect.gen(function* () {
  const [mode, databasePath, readyPath, resultPath, markerPath] = yield* decodeArguments(A.drop(process.argv, 2));
  const fs = yield* FileSystem.FileSystem;
  const client = yield* SqliteClient.make({ filename: databasePath });
  const salt = "synthetic-native-http-crash-salt";
  const config = TranscriptIntakeConfig.make({
    hostId: Sha256Hex.make(Str.repeat(64)("a")),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 16,
    maxPayloadBytes: 1_048_576,
    maxDatabasePages: 256,
  });
  const writeJson = (path: string, value: unknown) =>
    encodeJsonValue(value).pipe(
      Effect.flatMap((text) => fs.writeFileString(`${path}.partial`, text, { mode: 0o600 })),
      Effect.andThen(fs.rename(`${path}.partial`, path))
    );
  // The production journal has no test hook. Pause only this injected SQL client.
  const sql = new Proxy(client, {
    apply(target, receiver, parameters) {
      const fragments: unknown = parameters[0];
      if (
        mode === "before-commit" &&
        isStringRows(fragments) &&
        Str.includes("INSERT INTO observation_native_receipts")(fragments[0] ?? "")
      ) {
        return Effect.gen(function* () {
          const pages = yield* client`SELECT count(*) AS n FROM observation_intake_pages`;
          const events = yield* client`SELECT count(*) AS n FROM observation_native_events`;
          const receipts = yield* client`SELECT count(*) AS n FROM observation_native_receipts`;
          yield* writeJson(markerPath, { boundary: mode, pages, events, receipts });
          return yield* Effect.never;
        });
      }
      return Reflect.apply(target, receiver, parameters);
    },
  });
  const intake = yield* makeNativeHttpIntake(
    config,
    NativeHttpPolicy.make({
      routeId: Sha256Hex.make(Str.repeat(64)("b")),
      hashSalt: Redacted.make(salt),
      approvedModels: [],
      usageConvention: "claude-code",
      bodyTimeoutMillis: 2000,
    })
  ).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  if (mode === "inspect") {
    const pages =
      yield* client`SELECT receipt_id AS "receiptId", sequence, accepted_at AS "acceptedAt", payload_bytes AS "payloadBytes", frames FROM observation_intake_pages ORDER BY sequence`;
    const events = yield* client`SELECT count(*) AS n FROM observation_native_events`;
    const receipts = yield* client`SELECT count(*) AS n FROM observation_native_receipts`;
    const integrity = yield* client`PRAGMA integrity_check`;
    yield* writeJson(resultPath, { stats: yield* intake.journal.stats, pages, events, receipts, integrity });
    return;
  }
  const server = Context.get(
    yield* Layer.build(BunHttpServer.layer({ hostname: "127.0.0.1", port: 0 })),
    HttpServer.HttpServer
  );
  yield* server.serve(
    intake.handler.pipe(
      Effect.tap(() =>
        mode === "after-commit"
          ? intake.journal.stats.pipe(
              Effect.flatMap((stats) => writeJson(markerPath, { boundary: mode, stats })),
              Effect.andThen(Effect.never)
            )
          : Effect.void
      )
    )
  );
  yield* writeJson(readyPath, { url: `${HttpServer.formatAddress(server.address)}/v1/traces` });
  return yield* Effect.never;
});
NodeRuntime.runMain(
  Layer.mergeAll(NodeServices.layer, Reactivity.layer).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  )
);
