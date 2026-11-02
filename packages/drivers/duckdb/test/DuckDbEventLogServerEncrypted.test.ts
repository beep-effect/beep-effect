import { DuckDbTestLayer } from "@beep/duckdb";
import { suite } from "./shared/SqlEventLogServerEncryptedStorageTest.ts";

suite("duckdb", DuckDbTestLayer);

import * as DuckDbEventLogServerEncrypted from "@beep/duckdb/DuckDbEventLogServerEncrypted";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as EventJournal from "effect/eventlog/EventJournal";
import { StoreId } from "effect/eventlog/EventLogMessage";
import * as EventLogServerEncrypted from "effect/eventlog/EventLogServerEncrypted";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

it.layer(Layer.merge(DuckDbTestLayer, Digest.layerWebCrypto), { timeout: "30 seconds" })(
  "DuckDB encrypted boundaries",
  (it) => {
    it.effect("round-trips epoch-sized sequence ranges and deduplicates retries", () =>
      Effect.gen(function* () {
        const storage = yield* DuckDbEventLogServerEncrypted.makeStorage({
          entryTablePrefix: "width_encrypted",
          remoteIdTable: "width_encrypted_remote",
        });
        const storeId = StoreId.make("wide");
        const publicKey = "width";
        const first = EventJournal.makeEntryIdUnsafe();
        const second = EventJournal.makeEntryIdUnsafe();
        const batch = { entryIds: A.of(first), iv: new Uint8Array(12), encryptedBatch: Uint8Array.of(5) };
        yield* storage.write(publicKey, storeId, [batch]);
        const digest = yield* Digest.Digest;
        const scopeKey = `${publicKey}/${storeId}`;
        const hash = Str.slice(0, 16)(yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(scopeKey)));
        const sql = yield* SqlClient.SqlClient;
        const epoch = 1793151157372;
        yield* sql`UPDATE ${sql(`width_encrypted_${hash}`)} SET sequence = ${epoch}, last_sequence = ${epoch}`;
        yield* sql`UPDATE ${sql(`width_encrypted_${hash}_ids`)} SET sequence = ${epoch}`;
        const next = { ...batch, entryIds: A.of(second) };
        const written = yield* storage.write(publicKey, storeId, [next]);
        assert.strictEqual(A.getUnsafe(written, 0).sequence, epoch + 1);
        assert.deepStrictEqual(yield* storage.write(publicKey, storeId, [next]), []);
        const acks = yield* storage.entrySequences(publicKey, storeId, [first, second]);
        assert.deepStrictEqual(
          A.map(acks, (a) => a.sequence),
          [epoch, epoch + 1]
        );
        const replay = yield* storage.changes(publicKey, storeId, epoch).pipe(Stream.take(2), Stream.runCollect);
        assert.deepStrictEqual(
          A.map(replay, (b) => b.sequence),
          [epoch, epoch + 1]
        );
      })
    );
    it.effect("keeps the remote id and first session binding across storage instances", () =>
      Effect.gen(function* () {
        const options = { entryTablePrefix: "auth_encrypted", remoteIdTable: "auth_encrypted_remote" };
        const first = yield* DuckDbEventLogServerEncrypted.makeStorage(options);
        const second = yield* DuckDbEventLogServerEncrypted.makeStorage(options);
        assert.deepStrictEqual(yield* first.getId, yield* second.getId);
        const key = Uint8Array.of(1, 2, 3);
        assert.deepStrictEqual(yield* first.getOrCreateSessionAuthBinding("identity", key), key);
        assert.deepStrictEqual(yield* second.getOrCreateSessionAuthBinding("identity", Uint8Array.of(4)), key);
      })
    );
    it.effect("defaults table names, skips empty writes and stores a repeated id once", () =>
      Effect.gen(function* () {
        const storage = yield* DuckDbEventLogServerEncrypted.makeStorage();
        const storeId = StoreId.make("defaults");
        assert.deepStrictEqual(yield* storage.write("carol", storeId, []), []);
        const id = EventJournal.makeEntryIdUnsafe();
        const batch = { entryIds: A.make(id, id), iv: new Uint8Array(12), encryptedBatch: Uint8Array.of(3) };
        yield* storage.write("carol", storeId, [batch]);
        const acks = yield* storage.entrySequences("carol", storeId, [id]);
        assert.deepStrictEqual(
          A.map(acks, (ack) => ack.entryId),
          [id]
        );
      })
    );
    it.effect("isolates identities and stores", () =>
      Effect.gen(function* () {
        const storage = yield* DuckDbEventLogServerEncrypted.makeStorage({
          entryTablePrefix: "isolate_encrypted",
          remoteIdTable: "isolate_encrypted_remote",
        });
        const a = EventJournal.makeEntryIdUnsafe();
        const b = EventJournal.makeEntryIdUnsafe();
        yield* storage.write("alice", StoreId.make("users"), [
          { entryIds: [a], iv: new Uint8Array(12), encryptedBatch: Uint8Array.of(1) },
        ]);
        yield* storage.write("bob", StoreId.make("users"), [
          { entryIds: [b], iv: new Uint8Array(12), encryptedBatch: Uint8Array.of(2) },
        ]);
        const left = yield* storage.entrySequences("alice", StoreId.make("users"), [a, b]);
        const right = yield* storage.entrySequences("bob", StoreId.make("users"), [a, b]);
        assert.deepStrictEqual(
          A.map(left, (ack) => ack.entryId),
          [a]
        );
        assert.deepStrictEqual(
          A.map(right, (ack) => ack.entryId),
          [b]
        );
      })
    );
  }
);

it.layer(DuckDbTestLayer, { timeout: "30 seconds" })("DuckDB encrypted storage layers", (it) => {
  it.effect("layerStorageSubtle supplies Web Crypto encryption", () =>
    Effect.gen(function* () {
      const layer = DuckDbEventLogServerEncrypted.layerStorageSubtle({ entryTablePrefix: "subtle_encrypted" });
      const storage = Context.get(yield* Layer.build(layer), EventLogServerEncrypted.Storage);
      assert.deepStrictEqual(yield* storage.getId, yield* storage.getId);
    })
  );
});
