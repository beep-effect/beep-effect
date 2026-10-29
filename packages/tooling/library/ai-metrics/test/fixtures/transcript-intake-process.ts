// Executed only by the synthetic process-crash tests. No production source is read.
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import {
  makeTranscriptIntakeJournal,
  TranscriptIntakeConfig,
  TranscriptScheduleInput,
} from "@beep/repo-ai-metrics/transcript-intake";
import { readTranscriptPage, TranscriptPageInput } from "@beep/repo-ai-metrics/transcript-page";
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

const args = A.drop(process.argv, 2);
const program = Effect.gen(function* () {
  const [mode, databasePath, sourcePath, resultPath, markerPath] = yield* S.decodeUnknownEffect(
    S.Tuple([
      S.Literals(["inspect", "accept", "reserve", "before-commit", "after-commit"]),
      S.String,
      S.String,
      S.String,
      S.String,
    ])
  )(args);
  const fs = yield* FileSystem.FileSystem;
  const client = yield* SqliteClient.make({ filename: databasePath });
  const salt = "synthetic-process-intake-salt";
  const config = TranscriptIntakeConfig.make({
    hostId: Sha256Hex.make(Str.repeat(64)("a")),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 16,
    maxPayloadBytes: 1_048_576,
    maxDatabasePages: 256,
  });
  const writeJson = (path: string, value: unknown) =>
    S.encodeEffect(S.fromJsonString(S.Unknown))(value).pipe(
      Effect.flatMap((text) => fs.writeFileString(`${path}.partial`, text, { mode: 0o600 })),
      Effect.andThen(fs.rename(`${path}.partial`, path))
    );
  // Pause after the page INSERT but before the cursor INSERT/transaction COMMIT.
  // The parent kills this exact child. The production API has no crash-test hook.
  const sql = new Proxy(client, {
    apply(target, receiver, parameters) {
      const fragments: unknown = parameters[0];
      if (
        mode === "before-commit" &&
        S.is(S.Array(S.String))(fragments) &&
        Str.includes("INSERT INTO observation_source_cursors")(fragments[0] ?? "")
      ) {
        return Effect.gen(function* () {
          const pages = yield* client`SELECT COUNT(*) AS count FROM observation_intake_pages`;
          const cursors = yield* client`SELECT COUNT(*) AS count FROM observation_source_cursors`;
          yield* writeJson(markerPath, { boundary: mode, pages, cursors });
          return yield* Effect.never;
        });
      }
      return Reflect.apply(target, receiver, parameters);
    },
  });
  const journal = yield* makeTranscriptIntakeJournal(config).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const selected =
    mode === "reserve"
      ? yield* journal.reserveSources(
          TranscriptScheduleInput.make({
            candidates: A.map(["a", "b", "c"], (value) => Sha256Hex.make(Str.repeat(64)(value))),
            limit: 1,
          })
        )
      : [];
  const page = yield* readTranscriptPage(
    TranscriptPageInput.make({
      path: sourcePath,
      source: "codex",
      hashSalt: Redacted.make(salt),
      cursor: O.none(),
      maxBytes: 512,
      maxLineBytes: 256,
      maxFrames: 1,
    })
  );
  if (mode !== "inspect" && mode !== "reserve") {
    yield* journal.acceptPage(page, O.none());
    if (mode === "after-commit") {
      yield* writeJson(markerPath, { boundary: mode, stats: yield* journal.stats });
      return yield* Effect.never;
    }
  }
  const cursor = yield* journal.readCursor(page.cursor.source, page.cursor.pathHash);
  const receipts =
    yield* client`SELECT receipt_id AS "receiptId", sequence, accepted_at AS "acceptedAt", payload_bytes AS "payloadBytes", frames FROM observation_intake_pages ORDER BY sequence`;
  const integrity = yield* client`PRAGMA integrity_check`;
  yield* writeJson(resultPath, {
    stats: yield* journal.stats,
    hasCursor: O.isSome(cursor),
    receipts,
    integrity,
    selected,
  });
});

NodeRuntime.runMain(
  Layer.mergeAll(NodeServices.layer, Reactivity.layer).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  )
);
