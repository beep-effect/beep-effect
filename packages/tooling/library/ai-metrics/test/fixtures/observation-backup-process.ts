// Synthetic process-kill boundary only; no production database or source is opened.
import {
  captureObservationBackup,
  ObservationBackupPolicy,
  ObservationBackupReceipt,
  restoreObservationBackup,
} from "@beep/repo-ai-metrics/observation-backup";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { readTranscriptPage, TranscriptPageInput } from "@beep/repo-ai-metrics/transcript-page";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
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

const program = Effect.gen(function* () {
  const [mode, directory] = yield* S.decodeUnknownEffect(
    S.Tuple([S.Literals(["capture-before", "capture-after", "restore-before", "restore-after"]), S.String])
  )(A.drop(process.argv, 2));
  const fs = yield* FileSystem.FileSystem;
  const boundary = fs.writeFileString(`${directory}/boundary`, mode).pipe(Effect.andThen(Effect.never));
  const intercepted = new Proxy(fs, {
    get(target, key, receiver) {
      if (key === "rename")
        return (from: string, to: string) => {
          if (
            (mode === "capture-before" && Str.endsWith("/manifest.json")(to)) ||
            (mode === "restore-before" && Str.endsWith("/restore.json")(to))
          )
            return boundary;
          return target.rename(from, to);
        };
      return Reflect.get(target, key, receiver);
    },
  });
  const policy = ObservationBackupPolicy.make({ maxBytes: 1048576 });
  const receipt = yield* Effect.gen(function* () {
    const sql = yield* SqliteClient.make({ filename: `${directory}/source.sqlite` });
    const salt = "synthetic-backup-process";
    const config = TranscriptIntakeConfig.make({
      hostId: Sha256Hex.make(Str.repeat(64)("a")),
      namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
      maxPages: 16,
      maxPayloadBytes: 1048576,
      maxDatabasePages: 256,
    });
    const journal = yield* makeTranscriptIntakeJournal(config).pipe(Effect.provideService(SqlClient.SqlClient, sql));
    const path = `${directory}/events.jsonl`;
    yield* fs.writeFileString(
      path,
      '{"type":"response_item","payload":{"type":"message","content":"synthetic-private-backup-process"}}\n'
    );
    const page = yield* readTranscriptPage(
      TranscriptPageInput.make({
        path,
        source: "codex",
        hashSalt: Redacted.make(salt),
        cursor: O.none(),
        maxBytes: 512,
        maxLineBytes: 256,
        maxFrames: 1,
      })
    );
    yield* journal.acceptPage(page, O.none());
    return yield* captureObservationBackup(config, policy, `${directory}/backup`).pipe(
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.provideService(FileSystem.FileSystem, intercepted)
    );
  }).pipe(Effect.scoped);
  yield* fs.writeFileString(
    `${directory}/receipt.json`,
    yield* S.encodeEffect(S.fromJsonString(ObservationBackupReceipt))(receipt),
    { mode: 0o600 }
  );
  if (mode === "capture-after") return yield* boundary;
  // Original source is closed. Recovery uses only the independent snapshot.
  yield* fs.writeFileString(`${directory}/source.sqlite`, "synthetic database corruption");
  const verifier = yield* SqliteClient.make({ filename: ":memory:" });
  yield* restoreObservationBackup(policy, `${directory}/backup`, `${directory}/restored`, receipt).pipe(
    Effect.provideService(SqlClient.SqlClient, verifier),
    Effect.provideService(FileSystem.FileSystem, intercepted)
  );
  return yield* boundary;
});
NodeRuntime.runMain(
  Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, Reactivity.layer).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  )
);
