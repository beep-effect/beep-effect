import { $SemanticaId } from "@beep/identity/packages";
import * as Pglite from "@beep/pglite";
import { Clock, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { canonicalJson } from "@/corpus/Canonical";
import { RuntimeMode } from "@/runtime/Config";
import { sha256TextSync } from "@/schema/Digest";
import { SourceDocument } from "@/schema/Document";
import { LedgerFailed } from "@/schema/Errors";
import { EvidenceClaim, ExtractOutcome } from "@/schema/Evidence";
import { RunId } from "@/schema/Ids";
import { LedgerDocumentSnapshot, LedgerSnapshot } from "@/schema/Ledger";
import { ProvenanceEvent } from "@/schema/Provenance";
import { Chunk } from "@/schema/Text";
import { Ledger } from "@/services/Ledger";
import type * as SqlError from "effect/unstable/sql/SqlError";

const $I = $SemanticaId.create("layers/LedgerLive");

class LedgerLiveOptions extends S.Class<LedgerLiveOptions>($I`LedgerLiveOptions`)(
  {
    ledgerRoot: S.NonEmptyString,
    mode: RuntimeMode,
    runId: RunId,
  },
  $I.annote("LedgerLiveOptions", {
    description: "Filesystem root and execution identity for one isolated PGlite ledger.",
  })
) {}

class StoredRow extends S.Class<StoredRow>($I`StoredRow`)(
  { digest: S.String, payload: S.String },
  $I.annote("StoredRow", { description: "Digest and canonical JSON payload read from an immutable ledger row." })
) {}

const databaseFailed = (): LedgerFailed =>
  LedgerFailed.make({ message: "The C0 ledger database operation failed.", reason: "database-failed" });

const conflictingRow = (): LedgerFailed =>
  LedgerFailed.make({ message: "A content-addressed ledger row has conflicting bytes.", reason: "conflicting-row" });

const decodeFailed = (): LedgerFailed =>
  LedgerFailed.make({ message: "A persisted C0 ledger row did not decode.", reason: "decode-failed" });

const encodePayload = Effect.fn("Ledger.encodePayload")(function* <Type, Encoded>(
  schema: S.Codec<Type, Encoded, never, never>,
  value: Type
) {
  const encoded = yield* S.encodeEffect(schema)(value).pipe(Effect.orDie);
  const payload = canonicalJson(encoded);
  return { digest: sha256TextSync(payload), payload };
});

const decodePayload = <Type, Encoded>(schema: S.Codec<Type, Encoded, never, never>, payload: string) =>
  S.decodeEffect(S.fromJsonString(schema))(payload).pipe(Effect.mapError(decodeFailed));

const ensureStoredDigest = (rows: ReadonlyArray<StoredRow>, expected: string): Effect.Effect<void, LedgerFailed> =>
  A.head(rows).pipe(
    O.filter((row) => Str.Equivalence(row.digest, expected)),
    O.match({
      onNone: () => Effect.fail(conflictingRow()),
      onSome: () => Effect.void,
    })
  );

const recoverSql = <Value, Error, Requirements>(
  effect: Effect.Effect<Value, Error | SqlError.SqlError, Requirements>
) => effect.pipe(Effect.catchTag("SqlError", () => Effect.fail(databaseFailed())));

const makeLedger = Effect.fn("Ledger.make")(function* (runId: RunId) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();

  yield* recoverSql(
    Effect.all(
      [
        sql`CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, digest TEXT NOT NULL, payload TEXT NOT NULL)`,
        sql`CREATE TABLE IF NOT EXISTS parse_outcomes (id TEXT PRIMARY KEY, document TEXT NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL)`,
        sql`CREATE TABLE IF NOT EXISTS chunks (id TEXT PRIMARY KEY, document TEXT NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL)`,
        sql`CREATE TABLE IF NOT EXISTS claims (id TEXT PRIMARY KEY, batch TEXT NOT NULL, document TEXT NOT NULL, lane TEXT NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL)`,
        sql`CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, document TEXT NOT NULL, lane TEXT NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL)`,
        sql`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, digest TEXT NOT NULL, payload TEXT NOT NULL, recorded_at BIGINT NOT NULL)`,
        sql`CREATE TABLE IF NOT EXISTS conflicts (id TEXT PRIMARY KEY, left_claim TEXT NOT NULL, right_claim TEXT NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL)`,
      ],
      { concurrency: 1, discard: true }
    )
  );

  const appendEvent = Effect.fn("Ledger.appendEvent")(function* (event: ProvenanceEvent) {
    const stored = yield* encodePayload(ProvenanceEvent, event);
    const recordedAt = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO events (id, digest, payload, recorded_at)
        VALUES (${event.id}, ${stored.digest}, ${stored.payload}, ${recordedAt})
        ON CONFLICT (id) DO NOTHING`;
    const rows = yield* sql<StoredRow>`SELECT digest, payload FROM events WHERE id = ${event.id}`;
    yield* ensureStoredDigest(rows, stored.digest);
  });

  return Ledger.of({
    appendDocument: Effect.fn("Ledger.appendDocument")(function* (document, outcome, canonical, chunks, events) {
      const transaction = Effect.gen(function* () {
        const storedDocument = yield* encodePayload(SourceDocument, document);
        yield* sql`INSERT INTO documents (id, digest, payload)
            VALUES (${document.id}, ${storedDocument.digest}, ${storedDocument.payload})
            ON CONFLICT (id) DO NOTHING`;
        yield* ensureStoredDigest(
          yield* sql<StoredRow>`SELECT digest, payload FROM documents WHERE id = ${document.id}`,
          storedDocument.digest
        );

        const parseSnapshot = LedgerDocumentSnapshot.make({
          canonical,
          chunks,
          document,
          outcome,
        });
        const storedParse = yield* encodePayload(LedgerDocumentSnapshot, parseSnapshot);
        yield* sql`INSERT INTO parse_outcomes (id, document, digest, payload)
            VALUES (${document.id}, ${document.id}, ${storedParse.digest}, ${storedParse.payload})
            ON CONFLICT (id) DO NOTHING`;
        yield* ensureStoredDigest(
          yield* sql<StoredRow>`SELECT digest, payload FROM parse_outcomes WHERE id = ${document.id}`,
          storedParse.digest
        );

        yield* Effect.forEach(
          chunks,
          Effect.fnUntraced(function* (chunk) {
            const stored = yield* encodePayload(Chunk, chunk);
            yield* sql`INSERT INTO chunks (id, document, digest, payload)
                VALUES (${chunk.id}, ${chunk.document}, ${stored.digest}, ${stored.payload})
                ON CONFLICT (id) DO NOTHING`;
            yield* ensureStoredDigest(
              yield* sql<StoredRow>`SELECT digest, payload FROM chunks WHERE id = ${chunk.id}`,
              stored.digest
            );
          }),
          { concurrency: 1, discard: true }
        );
        yield* Effect.forEach(events, appendEvent, {
          concurrency: 1,
          discard: true,
        });
      });
      return yield* recoverSql(sql.withTransaction(transaction));
    }),

    appendBatch: Effect.fn("Ledger.appendBatch")(function* (outcome, events) {
      const transaction = Effect.gen(function* () {
        const stored = yield* encodePayload(ExtractOutcome, outcome);
        const batchId = ExtractOutcome.match(outcome, {
          Extracted: ({ batch }) => batch.id,
          Degraded: () => stored.digest,
        });
        const document = ExtractOutcome.match(outcome, {
          Extracted: ({ batch }) => batch.document,
          Degraded: (degraded) => degraded.document,
        });
        const lane = ExtractOutcome.match(outcome, {
          Extracted: ({ batch }) => (Str.Equivalence(batch.method, "hosted-langextract") ? "hosted" : "pattern"),
          Degraded: (degraded) => degraded.lane,
        });
        yield* sql`INSERT INTO batches (id, document, lane, digest, payload)
            VALUES (${batchId}, ${document}, ${lane}, ${stored.digest}, ${stored.payload})
            ON CONFLICT (id) DO NOTHING`;
        yield* ensureStoredDigest(
          yield* sql<StoredRow>`SELECT digest, payload FROM batches WHERE id = ${batchId}`,
          stored.digest
        );

        if (outcome.outcome === "Extracted") {
          yield* Effect.forEach(
            outcome.batch.claims,
            Effect.fnUntraced(function* (claim) {
              const claimStored = yield* encodePayload(EvidenceClaim, claim);
              yield* sql`INSERT INTO claims (id, batch, document, lane, digest, payload)
                  VALUES (${claim.id}, ${outcome.batch.id}, ${claim.document}, ${lane}, ${claimStored.digest}, ${claimStored.payload})
                  ON CONFLICT (id) DO NOTHING`;
              yield* ensureStoredDigest(
                yield* sql<StoredRow>`SELECT digest, payload FROM claims WHERE id = ${claim.id}`,
                claimStored.digest
              );
            }),
            { concurrency: 1, discard: true }
          );
        }
        yield* Effect.forEach(events, appendEvent, {
          concurrency: 1,
          discard: true,
        });
      });
      return yield* recoverSql(sql.withTransaction(transaction));
    }),

    read: Effect.fn("Ledger.read")(function* (requestedRun) {
      if (!Str.Equivalence(requestedRun, runId)) {
        return yield* LedgerFailed.make({
          message: "The requested run does not match this ledger execution.",
          reason: "run-mismatch",
        });
      }
      const readRows = yield* recoverSql(
        Effect.all({
          batches: sql<StoredRow>`SELECT digest, payload FROM batches ORDER BY id`,
          documents: sql<StoredRow>`SELECT digest, payload FROM parse_outcomes ORDER BY document`,
          events: sql<StoredRow>`SELECT digest, payload FROM events ORDER BY recorded_at, id`,
        })
      );
      const documents = yield* Effect.forEach(
        readRows.documents,
        (row) => decodePayload(LedgerDocumentSnapshot, row.payload),
        {
          concurrency: 1,
        }
      );
      const batches = yield* Effect.forEach(readRows.batches, (row) => decodePayload(ExtractOutcome, row.payload), {
        concurrency: 1,
      });
      const events = yield* Effect.forEach(readRows.events, (row) => decodePayload(ProvenanceEvent, row.payload), {
        concurrency: 1,
      });
      return LedgerSnapshot.make({
        batches,
        documents,
        events,
        run: requestedRun,
      });
    }),
  });
});

/**
 * File-backed PGlite ledger for one run execution mode.
 *
 * **Example** (Create an isolated replay ledger)
 *
 * ```ts
 * import { LedgerLive } from "@/layers/LedgerLive"
 * import { RunId } from "@/schema/Ids"
 * import { Layer } from "effect"
 * import * as Str from "effect/String"
 *
 * const layer = LedgerLive({
 *   ledgerRoot: ".beep/semantica/ledger",
 *   mode: "replay",
 *   runId: RunId.make(Str.repeat(64)("a"))
 * })
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LedgerLive = (options: LedgerLiveOptions) =>
  Layer.effect(Ledger, makeLedger(options.runId)).pipe(
    Layer.provide(
      Layer.unwrap(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dataDir = path.join(options.ledgerRoot, options.runId, options.mode);
          yield* fs.makeDirectory(path.dirname(dataDir), { recursive: true }).pipe(Effect.mapError(databaseFailed));
          return Pglite.makeLayer({ dataDir });
        })
      )
    )
  );
