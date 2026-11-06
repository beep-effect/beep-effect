/**
 * Offline SQLite CAS and outbox; the caller owns the durable database layer.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import {
  OwnerCheckpointDelivery,
  OwnerCheckpointError,
  OwnerCheckpointIntent,
  OwnerCheckpointOutbox,
  OwnerCheckpointRecord,
  OwnerCheckpointState,
} from "./OwnerCheckpoint.schemas.ts";
import { transitionOwnerCheckpoint } from "./OwnerCheckpoint.ts";
import type * as DateTime from "effect/DateTime";
import type {
  OwnerCheckpointBinding,
  OwnerCheckpointPolicy,
  OwnerCheckpointRequest,
} from "./OwnerCheckpoint.schemas.ts";

const RecordJson = S.fromJsonString(OwnerCheckpointRecord);
const OutboxJson = S.fromJsonString(OwnerCheckpointOutbox);
const encodeRecord = S.encodeEffect(RecordJson);
const encodeOutbox = S.encodeEffect(OutboxJson);
const decodeRecord = S.decodeUnknownEffect(RecordJson);
const decodeOutbox = S.decodeUnknownEffect(OutboxJson);
const storage = () => OwnerCheckpointError.make({ reason: "storage" });
const conflict = () => OwnerCheckpointError.make({ reason: "conflict" });
const requiredValue = <Value>(value: O.Option<Value>) =>
  Effect.fromOption(value).pipe(Effect.mapError(() => OwnerCheckpointError.make({ reason: "missing" })));
const sameBinding = (a: OwnerCheckpointBinding, b: OwnerCheckpointBinding) =>
  a.repository === b.repository &&
  a.prNumber === b.prNumber &&
  a.owner === b.owner &&
  a.head === b.head &&
  a.generation === b.generation;

/**
 * Open the offline owner tables in an explicitly provided SQLite service.
 *
 * **Details**
 * A successful mutation commits state and intent together. No operation calls
 * GitHub or starts a broker. Published check receipts are trusted adapter input,
 * not proof of App identity by themselves. Dispatched merge intents are never
 * automatically retried, including after a process restart.
 *
 * **Example** (Inspect the offline store constructor)
 * ```ts
 * import { makeOwnerCheckpointStore } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof makeOwnerCheckpointStore) // "function"
 * ```
 * @returns Exact-binding reads, transactional CAS, and finite delivery updates.
 * @category services
 * @since 0.0.0
 */
export const makeOwnerCheckpointStore = Effect.fn("OwnerCheckpoint.makeStore")(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`PRAGMA synchronous = FULL`.pipe(Effect.mapError(storage));
  yield* sql`CREATE TABLE IF NOT EXISTS yeet_owner_checkpoint (
    repository TEXT NOT NULL, pr INTEGER NOT NULL, revision INTEGER NOT NULL,
    payload TEXT NOT NULL, PRIMARY KEY(repository, pr))`.pipe(Effect.mapError(storage));
  yield* sql`CREATE TABLE IF NOT EXISTS yeet_owner_checkpoint_outbox (
    repository TEXT NOT NULL, pr INTEGER NOT NULL, revision INTEGER NOT NULL,
    payload TEXT NOT NULL, PRIMARY KEY(repository, pr, revision))`.pipe(Effect.mapError(storage));
  const read = Effect.fn("OwnerCheckpoint.read")(function* (binding: OwnerCheckpointBinding) {
    const rows = yield* sql<{ payload: string }>`SELECT payload FROM yeet_owner_checkpoint
      WHERE repository=${binding.repository} AND pr=${binding.prNumber}`.pipe(Effect.mapError(storage));
    if (rows.length === 0) return O.none<OwnerCheckpointRecord>();
    const found = yield* decodeRecord((yield* requiredValue(A.head(rows))).payload).pipe(Effect.mapError(storage));
    if (!sameBinding(found.binding, binding)) return yield* OwnerCheckpointError.make({ reason: "binding" });
    return O.some(found);
  });
  const outbox = Effect.fn("OwnerCheckpoint.outbox")(function* (binding: OwnerCheckpointBinding, revision: number) {
    const rows = yield* sql<{ payload: string }>`SELECT payload FROM yeet_owner_checkpoint_outbox
      WHERE repository=${binding.repository} AND pr=${binding.prNumber} AND revision=${revision}`.pipe(
      Effect.mapError(storage)
    );
    if (rows.length === 0) return O.none<OwnerCheckpointOutbox>();
    const found = yield* decodeOutbox((yield* requiredValue(A.head(rows))).payload).pipe(Effect.mapError(storage));
    if (!sameBinding(found.binding, binding)) return yield* OwnerCheckpointError.make({ reason: "binding" });
    return O.some(found);
  });
  const append = Effect.fnUntraced(function* (entry: OwnerCheckpointOutbox) {
    const encoded = yield* encodeOutbox(entry);
    yield* sql`INSERT INTO yeet_owner_checkpoint_outbox (repository, pr, revision, payload)
      VALUES (${entry.binding.repository}, ${entry.binding.prNumber}, ${entry.revision}, ${encoded})`;
  }, Effect.mapError(storage));
  const replaceDelivery = Effect.fnUntraced(function* (
    entry: OwnerCheckpointOutbox,
    delivery: OwnerCheckpointDelivery
  ) {
    const before = yield* encodeOutbox(entry).pipe(Effect.mapError(storage));
    const next = OwnerCheckpointOutbox.make({ ...entry, delivery });
    const after = yield* encodeOutbox(next).pipe(Effect.mapError(storage));
    const changed = yield* sql`UPDATE yeet_owner_checkpoint_outbox SET payload=${after}
      WHERE repository=${entry.binding.repository} AND pr=${entry.binding.prNumber} AND revision=${entry.revision}
      AND payload=${before} RETURNING revision`.pipe(Effect.mapError(storage));
    if (changed.length !== 1) return yield* conflict();
    return next;
  });
  const register = Effect.fn("OwnerCheckpoint.register")(function* (binding: OwnerCheckpointBinding) {
    if (binding.generation !== 0) return yield* OwnerCheckpointError.make({ reason: "binding" });
    const record = OwnerCheckpointRecord.make({
      binding,
      revision: 0,
      state: OwnerCheckpointState.cases.Held.make({ reason: "registered" }),
    });
    const encoded = yield* encodeRecord(record).pipe(Effect.mapError(storage));
    return yield* sql
      .withTransaction(
        Effect.gen(function* () {
          const changed = yield* sql`INSERT INTO yeet_owner_checkpoint (repository, pr, revision, payload)
        VALUES (${binding.repository}, ${binding.prNumber}, 0, ${encoded}) ON CONFLICT DO NOTHING RETURNING revision`.pipe(
            Effect.mapError(storage)
          );
          if (changed.length !== 1) return yield* conflict();
          yield* append(
            OwnerCheckpointOutbox.make({
              binding,
              revision: 0,
              intent: OwnerCheckpointIntent.cases.CheckHeld.make({}),
              delivery: OwnerCheckpointDelivery.cases.Pending.make({}),
            })
          );
          return record;
        })
      )
      .pipe(Effect.mapError((error) => (S.is(OwnerCheckpointError)(error) ? error : storage())));
  });
  const apply = Effect.fn("OwnerCheckpoint.apply")(function* (
    request: OwnerCheckpointRequest,
    policy: OwnerCheckpointPolicy,
    now: DateTime.Utc
  ) {
    return yield* sql
      .withTransaction(
        Effect.gen(function* () {
          const current = yield* read(request.binding).pipe(Effect.flatMap(requiredValue));
          if (request.command._tag === "Claim") {
            const snapshot = request.command.snapshot;
            const published = yield* outbox(current.binding, current.revision);
            if (
              !O.exists(
                published,
                (entry) =>
                  entry.intent._tag === "CheckReleased" &&
                  entry.delivery._tag === "Published" &&
                  entry.delivery.checkRunId === snapshot.selfCheck.id
              )
            )
              return yield* OwnerCheckpointError.make({ reason: "publication" });
            const own = A.findFirst(snapshot.read.checkRuns, (run) => run.id === snapshot.selfCheck.id);
            if (!O.exists(own, (run) => run.status === "completed" && run.conclusion === "success"))
              return yield* OwnerCheckpointError.make({ reason: "publication" });
          }
          const next = yield* transitionOwnerCheckpoint(current, request, policy, now);
          const encoded = yield* encodeRecord(next.record).pipe(Effect.mapError(storage));
          const changed =
            yield* sql`UPDATE yeet_owner_checkpoint SET revision=${next.record.revision}, payload=${encoded}
        WHERE repository=${request.binding.repository} AND pr=${request.binding.prNumber}
        AND revision=${request.expectedRevision} RETURNING revision`.pipe(Effect.mapError(storage));
          if (changed.length !== 1) return yield* conflict();
          yield* append(next.outbox);
          if (request.command._tag === "Unknown" || request.command._tag === "Confirm") {
            const entries = yield* sql<{ payload: string }>`SELECT payload FROM yeet_owner_checkpoint_outbox
          WHERE repository=${request.binding.repository} AND pr=${request.binding.prNumber} AND revision <= ${current.revision}
          ORDER BY revision DESC LIMIT 2`.pipe(Effect.mapError(storage));
            // Claimed -> Uncertain adds one metadata row; confirmation may follow it.
            for (const row of entries) {
              const entry = yield* decodeOutbox(row.payload).pipe(Effect.mapError(storage));
              if (entry.intent._tag === "Merge" && entry.intent.claimId === request.command.claimId) {
                yield* replaceDelivery(
                  entry,
                  request.command._tag === "Unknown"
                    ? OwnerCheckpointDelivery.cases.Uncertain.make({})
                    : OwnerCheckpointDelivery.cases.Confirmed.make({})
                );
              }
            }
          }
          return next.record;
        })
      )
      .pipe(Effect.mapError((error) => (S.is(OwnerCheckpointError)(error) ? error : storage())));
  });
  const acknowledgePublication = Effect.fn("OwnerCheckpoint.acknowledgePublication")(function* (
    binding: OwnerCheckpointBinding,
    revision: number,
    checkRunId: number
  ) {
    if (!Number.isSafeInteger(revision) || revision < 0 || !Number.isSafeInteger(checkRunId) || checkRunId <= 0)
      return yield* OwnerCheckpointError.make({ reason: "publication" });
    return yield* sql
      .withTransaction(
        Effect.gen(function* () {
          const current = yield* read(binding).pipe(Effect.flatMap(requiredValue));
          if (
            !sameBinding(current.binding, binding) ||
            current.revision !== revision ||
            current.state._tag !== "Released"
          )
            return yield* conflict();
          const entry = yield* outbox(binding, revision).pipe(Effect.flatMap(requiredValue));
          if (entry.intent._tag !== "CheckReleased" || entry.delivery._tag !== "Pending") return yield* conflict();
          return yield* replaceDelivery(entry, OwnerCheckpointDelivery.cases.Published.make({ checkRunId }));
        })
      )
      .pipe(Effect.mapError((error) => (S.is(OwnerCheckpointError)(error) ? error : storage())));
  });
  const prepareDispatch = Effect.fn("OwnerCheckpoint.prepareDispatch")(function* (
    binding: OwnerCheckpointBinding,
    revision: number
  ) {
    if (!Number.isSafeInteger(revision) || revision < 0) return yield* conflict();
    return yield* sql
      .withTransaction(
        Effect.gen(function* () {
          const current = yield* read(binding).pipe(Effect.flatMap(requiredValue));
          if (
            !sameBinding(current.binding, binding) ||
            current.revision !== revision ||
            current.state._tag !== "Claimed"
          )
            return yield* conflict();
          const entry = yield* outbox(binding, revision).pipe(Effect.flatMap(requiredValue));
          if (
            entry.intent._tag !== "Merge" ||
            entry.intent.claimId !== current.state.claimId ||
            entry.delivery._tag !== "Pending"
          )
            return yield* conflict();
          yield* replaceDelivery(entry, OwnerCheckpointDelivery.cases.Dispatched.make({}));
          return current;
        })
      )
      .pipe(Effect.mapError((error) => (S.is(OwnerCheckpointError)(error) ? error : storage())));
  });
  return { read, outbox, register, apply, acknowledgePublication, prepareDispatch };
});
