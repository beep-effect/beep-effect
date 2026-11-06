/**
 * Unregistered check publication fences and same-generation native check anchor.
 * The caller must be an isolated authenticated authority; no transport starts here.
 * @packageDocumentation
 * @since 0.0.0
 */
import { CheckRun, CheckRunCorrelationOptions } from "@beep/github/CheckRun";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";
import { readOwnerCheckpointSnapshot } from "./OwnerCheckpoint.adapter.ts";
import { OwnerCheckpointBinding, OwnerCheckpointError } from "./OwnerCheckpoint.schemas.ts";
import { makeOwnerCheckpointStore } from "./OwnerCheckpoint.store.ts";
import { sameOwnerCheckpointBinding } from "./OwnerCheckpoint.ts";
import type { CheckRunRef } from "@beep/github/CheckRun";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type {
  OwnerCheckpointOutbox,
  OwnerCheckpointPolicy,
  OwnerCheckpointSnapshot,
} from "./OwnerCheckpoint.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/OwnerCheckpoint.publisher");
const PositiveId = S.Int.check(S.isGreaterThan(0));
const Publication = S.Struct({
  binding: OwnerCheckpointBinding,
  revision: S.Int,
  applicationId: PositiveId,
  externalId: S.NonEmptyString,
  nativeId: S.OptionFromNullOr(PositiveId),
}).pipe(
  $I.annoteSchema("Publication", {
    description: "Durable pre-write publication fence; absence of native identity remains uncertain.",
  })
);
const PublicationJson = S.fromJsonString(Publication);
const NativeCorrelation = S.Struct({ id: PositiveId, external_id: S.NullOr(S.String) });
const NativeCorrelations = S.Array(NativeCorrelation);
const decodeNativeCorrelations = S.decodeUnknownEffect(NativeCorrelations);
const refuse = (reason: OwnerCheckpointError["reason"]) => OwnerCheckpointError.make({ reason });
const storage = () => refuse("storage");

/**
 * Finite publication outcome; uncertainty never authorizes another check creation.
 * **Example** (Inspect the publication outcome)
 * ```ts
 * import { OwnerCheckpointPublishOutcome } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointPublishOutcome) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export const OwnerCheckpointPublishOutcome = S.TaggedUnion({
  Unknown: {},
  Held: { reason: S.Literals(["multiple-native-matches", "native-identity", "native-status", "anchor-missing"]) },
  Published: { checkRunId: PositiveId, state: S.Literals(["held", "released"]) },
}).pipe(
  $I.annoteSchema("OwnerCheckpointPublishOutcome", {
    description: "Observed finite check publication, held conflict or unknown write result.",
  })
);

/**
 * Runtime type of the finite publication outcome.
 * @category type-level
 * @since 0.0.0
 */
export type OwnerCheckpointPublishOutcome = typeof OwnerCheckpointPublishOutcome.Type;

const ownsNative = (row: CheckRunRef, binding: OwnerCheckpointBinding, policy: OwnerCheckpointPolicy): boolean =>
  row.id > 0 &&
  row.name === policy.context &&
  row.nativeIdentity !== undefined &&
  row.nativeIdentity.applicationId === policy.applicationId &&
  row.nativeIdentity.headSha === binding.head;
const hold = (reason: Extract<OwnerCheckpointPublishOutcome, { readonly _tag: "Held" }>["reason"]) =>
  OwnerCheckpointPublishOutcome.cases.Held.make({ reason });
const unknown = () => OwnerCheckpointPublishOutcome.cases.Unknown.make({});

const sameBase = (a: OwnerCheckpointSnapshot["base"], b: OwnerCheckpointSnapshot["base"]) =>
  a.sha === b.sha && a.ref === b.ref && a.repository === b.repository;
const releaseBaseMatches = (entry: OwnerCheckpointOutbox, snapshot: OwnerCheckpointSnapshot) =>
  entry.intent._tag === "CheckReleased" && sameBase(snapshot.base, entry.intent.base);
const observedIdentityMatches = (
  row: CheckRunRef,
  entry: OwnerCheckpointOutbox,
  id: number,
  externalId: string,
  policy: OwnerCheckpointPolicy
) => row.id === id && ownsNative(row, entry.binding, policy) && row.nativeIdentity?.externalId === externalId;
const observedStatusMatches = (row: CheckRunRef, released: boolean) =>
  released
    ? row.status === "completed" && row.nativeIdentity?.conclusion === "success"
    : row.status === "in_progress" || (row.status === "completed" && row.nativeIdentity?.conclusion === "failure");

/**
 * Build inert durable publication operations using the caller's SQLite service.
 *
 * **Details**
 * One native check anchors a PR/head/generation. Release and revocation update
 * that ID rather than adding a second pending same-name check. A transaction
 * fences each native write before dispatch. Ambiguous responses reconcile only:
 * zero matches stays unknown, one exact row can be observed, multiple rows hold.
 * The returned owner store is internal authority state, never a public command
 * dispatcher. Owner authentication and service isolation remain deployment work.
 *
 * **Example** (Inspect the unregistered publisher constructor)
 * ```ts
 * import { makeOwnerCheckpointPublisher } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof makeOwnerCheckpointPublisher) // "function"
 * ```
 * @param context - Installed authority checkout context.
 * @param policy - Fixed dedicated App and freshness policy.
 * @returns Durable owner store and a fixed check publication operation.
 * @category services
 * @since 0.0.0
 */
export const makeOwnerCheckpointPublisher = Effect.fn("OwnerCheckpoint.makePublisher")(function* (
  context: RepoRunContext,
  policy: OwnerCheckpointPolicy
) {
  const sql = yield* SqlClient.SqlClient;
  const owner = yield* makeOwnerCheckpointStore();
  const native = yield* CheckRun;
  const client = yield* GitHubClient;
  const repository = yield* Repo;
  yield* sql`CREATE TABLE IF NOT EXISTS yeet_owner_checkpoint_publication (
    repository TEXT NOT NULL, pr INTEGER NOT NULL, generation INTEGER NOT NULL, revision INTEGER NOT NULL,
    creates_native INTEGER NOT NULL, settled INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL, PRIMARY KEY(repository, pr, revision))`.pipe(
    Effect.mapError(storage)
  );
  yield* sql`CREATE TABLE IF NOT EXISTS yeet_owner_checkpoint_anchor (
    repository TEXT NOT NULL, pr INTEGER NOT NULL, generation INTEGER NOT NULL, payload TEXT NOT NULL,
    PRIMARY KEY(repository, pr, generation))`.pipe(Effect.mapError(storage));
  const decode = S.decodeUnknownEffect(PublicationJson);
  const encode = S.encodeEffect(PublicationJson);
  const required = <Value>(value: O.Option<Value>) =>
    Effect.fromOption(value).pipe(Effect.mapError(() => refuse("missing")));
  const current = Effect.fnUntraced(function* (binding: OwnerCheckpointBinding, revision: number) {
    if (`${repository.owner}/${repository.repo}` !== binding.repository) return yield* refuse("binding");
    const record = yield* owner.read(binding).pipe(Effect.flatMap(required));
    if (record.revision !== revision) return yield* refuse("conflict");
    const entry = yield* owner.outbox(binding, revision).pipe(Effect.flatMap(required));
    if (entry.intent._tag === "CheckHeld" && record.state._tag === "Held") return { record, entry };
    if (
      entry.intent._tag === "CheckReleased" &&
      record.state._tag === "Released" &&
      entry.intent.releaseId === record.state.releaseId
    )
      return { record, entry };
    return yield* refuse("state");
  });
  const anchor = Effect.fnUntraced(function* (binding: OwnerCheckpointBinding) {
    const rows = yield* sql<{ payload: string }>`SELECT payload FROM yeet_owner_checkpoint_anchor
      WHERE repository=${binding.repository} AND pr=${binding.prNumber} AND generation=${binding.generation}`.pipe(
      Effect.mapError(storage)
    );
    if (rows.length === 0) return O.none<typeof Publication.Type>();
    const row = yield* decode((yield* required(A.head(rows))).payload).pipe(Effect.mapError(storage));
    if (!sameOwnerCheckpointBinding(row.binding, binding) || row.applicationId !== policy.applicationId)
      return yield* refuse("binding");
    return O.some(row);
  });
  const fence = Effect.fnUntraced(function* (entry: OwnerCheckpointOutbox, externalId: string) {
    return yield* sql
      .withTransaction(
        Effect.gen(function* () {
          yield* current(entry.binding, entry.revision);
          // Never let a later revision overtake an ambiguous native write. A
          // late release response must not overwrite a completed revocation.
          const unresolved = yield* sql`SELECT revision FROM yeet_owner_checkpoint_publication
            WHERE repository=${entry.binding.repository} AND pr=${entry.binding.prNumber}
            AND generation=${entry.binding.generation} AND revision<>${entry.revision} AND settled=0 LIMIT 1`.pipe(
            Effect.mapError(storage)
          );
          if (unresolved.length !== 0) return yield* refuse("uncertain");
          const previous = yield* anchor(entry.binding);
          const id = O.flatMap(previous, (row) => row.nativeId);
          const prior =
            yield* sql`SELECT revision FROM yeet_owner_checkpoint_publication WHERE repository=${entry.binding.repository}
        AND pr=${entry.binding.prNumber} AND generation=${entry.binding.generation} AND creates_native=1 LIMIT 1`.pipe(
              Effect.mapError(storage)
            );
          const creates = O.isNone(id) && entry.intent._tag === "CheckHeld" && prior.length === 0;
          const value = {
            binding: entry.binding,
            revision: entry.revision,
            applicationId: policy.applicationId,
            externalId,
            nativeId: O.none<number>(),
          };
          const payload = yield* encode(value).pipe(Effect.mapError(storage));
          const inserted =
            yield* sql`INSERT INTO yeet_owner_checkpoint_publication (repository,pr,generation,revision,creates_native,payload)
        VALUES (${entry.binding.repository},${entry.binding.prNumber},${entry.binding.generation},${entry.revision},${creates ? 1 : 0},${payload})
        ON CONFLICT DO NOTHING RETURNING revision`.pipe(Effect.mapError(storage));
          const rows = yield* sql<{ payload: string }>`SELECT payload FROM yeet_owner_checkpoint_publication
        WHERE repository=${entry.binding.repository} AND pr=${entry.binding.prNumber} AND revision=${entry.revision}`.pipe(
            Effect.mapError(storage)
          );
          const found = yield* decode((yield* required(A.head(rows))).payload).pipe(Effect.mapError(storage));
          if (
            !sameOwnerCheckpointBinding(found.binding, entry.binding) ||
            found.applicationId !== policy.applicationId ||
            found.externalId !== externalId
          )
            return yield* refuse("conflict");
          return { first: inserted.length === 1, creates, anchor: id, previous, publication: found };
        })
      )
      .pipe(Effect.mapError((error) => (S.is(OwnerCheckpointError)(error) ? error : storage())));
  });
  const reconcile = Effect.fnUntraced(function* (binding: OwnerCheckpointBinding, externalId: string) {
    const rows = yield* client
      .paginateStream("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
        owner: repository.owner,
        repo: repository.repo,
        ref: binding.head,
      })
      .pipe(
        Stream.take(2001),
        Stream.runCollect,
        Effect.mapError(() => refuse("publication"))
      );
    if (rows.length > 2000) return yield* refuse("publication");
    const selected = yield* decodeNativeCorrelations(rows).pipe(Effect.mapError(() => refuse("publication")));
    return A.filter(selected, (row) => row.external_id === externalId);
  });
  const remember = Effect.fnUntraced(function* (entry: OwnerCheckpointOutbox, externalId: string, id: number) {
    const value = {
      binding: entry.binding,
      revision: entry.revision,
      applicationId: policy.applicationId,
      externalId,
      nativeId: O.some(id),
    };
    const payload = yield* encode(value).pipe(Effect.mapError(storage));
    yield* sql
      .withTransaction(
        Effect.gen(function* () {
          yield* current(entry.binding, entry.revision);
          const existing = yield* anchor(entry.binding);
          if (O.exists(existing, (found) => O.exists(found.nativeId, (nativeId) => nativeId !== id)))
            return yield* refuse("conflict");
          yield* sql`INSERT INTO yeet_owner_checkpoint_anchor (repository,pr,generation,payload)
        VALUES (${entry.binding.repository},${entry.binding.prNumber},${entry.binding.generation},${payload}) ON CONFLICT DO UPDATE SET payload=excluded.payload`.pipe(
            Effect.mapError(storage)
          );
          yield* sql`UPDATE yeet_owner_checkpoint_publication SET payload=${payload}, settled=1 WHERE repository=${entry.binding.repository}
        AND pr=${entry.binding.prNumber} AND revision=${entry.revision}`.pipe(Effect.mapError(storage));
        })
      )
      .pipe(Effect.mapError((error) => (S.is(OwnerCheckpointError)(error) ? error : storage())));
  });
  const acknowledgeRelease = Effect.fnUntraced(function* (entry: OwnerCheckpointOutbox, id: number) {
    const latest = yield* owner.outbox(entry.binding, entry.revision).pipe(Effect.flatMap(required));
    if (latest.delivery._tag !== "Published") yield* owner.acknowledgePublication(entry.binding, entry.revision, id);
    else if (latest.delivery.checkRunId !== id) return yield* refuse("conflict");
  });
  const recordObserved = Effect.fnUntraced(function* (entry: OwnerCheckpointOutbox, externalId: string, id: number) {
    // Receipt, settled publication fence and release ACK commit together. A
    // failed anchor write must never leave a newly Published release behind.
    yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* current(entry.binding, entry.revision);
        yield* remember(entry, externalId, id);
        if (entry.intent._tag === "CheckReleased") yield* acknowledgeRelease(entry, id);
      })
    );
  });
  const observe = Effect.fnUntraced(function* (entry: OwnerCheckpointOutbox, externalId: string, id: number) {
    const observed = yield* native.get(id).pipe(Effect.result);
    if (Result.isFailure(observed)) return unknown();
    const row = observed.success;
    if (!observedIdentityMatches(row, entry, id, externalId, policy)) return hold("native-identity");
    const released = entry.intent._tag === "CheckReleased";
    if (!observedStatusMatches(row, released)) return hold("native-status");
    if (released) {
      const snapshot = yield* readOwnerCheckpointSnapshot(context, entry.binding, id, policy, externalId);
      if (!releaseBaseMatches(entry, snapshot)) return hold("native-identity");
    }
    const recorded = yield* recordObserved(entry, externalId, id).pipe(Effect.result);
    if (Result.isFailure(recorded)) return unknown();
    return OwnerCheckpointPublishOutcome.cases.Published.make({
      checkRunId: id,
      state: released ? "released" : "held",
    });
  });
  const recover = Effect.fnUntraced(function* (
    entry: OwnerCheckpointOutbox,
    externalId: string,
    expected: O.Option<number>
  ) {
    const matches = yield* reconcile(entry.binding, externalId).pipe(Effect.result);
    if (Result.isFailure(matches) || matches.success.length === 0) return unknown();
    if (matches.success.length !== 1) return hold("multiple-native-matches");
    const match = yield* required(A.head(matches.success));
    if (O.exists(expected, (id) => id !== match.id)) return hold("native-identity");
    return yield* observe(entry, externalId, match.id);
  });
  const ownedAnchorMatches = (
    row: CheckRunRef,
    binding: OwnerCheckpointBinding,
    id: number,
    previous: O.Option<typeof Publication.Type>
  ) =>
    row.id === id &&
    ownsNative(row, binding, policy) &&
    O.exists(previous, (anchor) => anchor.externalId === row.nativeIdentity?.externalId);
  const releaseBaseUnchanged = Effect.fnUntraced(function* (
    before: O.Option<OwnerCheckpointSnapshot>,
    entry: OwnerCheckpointOutbox,
    id: number,
    externalId: string
  ) {
    if (O.isNone(before)) return true;
    const after = yield* readOwnerCheckpointSnapshot(context, entry.binding, id, policy, externalId);
    return before.value.base.sha === after.base.sha && before.value.base.ref === after.base.ref;
  });
  const readReleaseSnapshot = Effect.fnUntraced(function* (entry: OwnerCheckpointOutbox, id: number, row: CheckRunRef) {
    if (entry.intent._tag !== "CheckReleased") return undefined;
    return yield* readOwnerCheckpointSnapshot(context, entry.binding, id, policy, row.nativeIdentity?.externalId ?? "");
  });
  const invalidateUnsettledRelease = Effect.fnUntraced(function* (
    entry: OwnerCheckpointOutbox,
    externalId: string,
    id: number
  ) {
    if (entry.intent._tag !== "CheckReleased") return;
    // This transaction serializes local authority mutations with compensation.
    // REST has no correlation CAS; the unresolved fence remains even after a
    // failure PATCH, since an earlier uncertain request could still finish late.
    yield* sql.withTransaction(
      Effect.gen(function* () {
        const authority = yield* owner.read(entry.binding).pipe(Effect.flatMap(required));
        if (authority.revision < entry.revision) return;
        const rows = yield* sql<{
          payload: string;
          settled: number;
        }>`SELECT payload,settled FROM yeet_owner_checkpoint_publication
        WHERE repository=${entry.binding.repository} AND pr=${entry.binding.prNumber} AND revision=${entry.revision}`;
        const row = yield* required(A.head(rows));
        // A historical settled release retry does not issue another success
        // write. Requalification failure there needs owner Revoke, not reopening.
        if (row.settled !== 0) return;
        const pending = yield* decode(row.payload);
        if (
          !sameOwnerCheckpointBinding(pending.binding, entry.binding) ||
          pending.revision !== entry.revision ||
          pending.applicationId !== policy.applicationId ||
          pending.externalId !== externalId
        )
          return;
        // Defensive authority-DB consistency: the pending fence has no native
        // ID until settlement; the durable prior anchor must still own this ID.
        const durable = yield* anchor(entry.binding);
        if (!O.exists(durable, (value) => O.contains(value.nativeId, id))) return;
        const observed = yield* native.get(id);
        if (!observedIdentityMatches(observed, entry, id, externalId, policy)) return;
        yield* native.complete(id, "failure", undefined, CheckRunCorrelationOptions.make({ externalId }));
      })
    );
  });
  const compensateRelease = <E, R>(
    operation: Effect.Effect<OwnerCheckpointPublishOutcome, E, R>,
    entry: OwnerCheckpointOutbox,
    externalId: string,
    id: number
  ) =>
    operation.pipe(
      Effect.onExit((exit) => {
        if (Exit.isSuccess(exit) && exit.value._tag === "Published") return Effect.void;
        return invalidateUnsettledRelease(entry, externalId, id).pipe(
          Effect.interruptible,
          Effect.timeoutOrElse({ duration: "3 seconds", orElse: () => Effect.void }),
          Effect.exit,
          Effect.asVoid
        );
      })
    );
  const updateAnchor = Effect.fnUntraced(function* (
    entry: OwnerCheckpointOutbox,
    externalId: string,
    previous: O.Option<typeof Publication.Type>,
    id: number
  ) {
    const options = CheckRunCorrelationOptions.make({ externalId });
    const existing = yield* native.get(id).pipe(Effect.result);
    if (Result.isFailure(existing)) return unknown();
    if (!ownedAnchorMatches(existing.success, entry.binding, id, previous)) return hold("native-identity");
    const beforeSnapshot = yield* readReleaseSnapshot(entry, id, existing.success);
    const before = O.fromUndefinedOr(beforeSnapshot);
    if (beforeSnapshot !== undefined && !releaseBaseMatches(entry, beforeSnapshot)) return hold("native-identity");
    yield* current(entry.binding, entry.revision);
    return yield* compensateRelease(
      Effect.gen(function* () {
        const written = yield* native
          .complete(id, entry.intent._tag === "CheckReleased" ? "success" : "failure", undefined, options)
          .pipe(Effect.result);
        if (Result.isFailure(written)) return yield* recover(entry, externalId, O.some(id));
        if (!(yield* releaseBaseUnchanged(before, entry, id, externalId))) return hold("native-identity");
        return yield* observe(entry, externalId, id);
      }),
      entry,
      externalId,
      id
    );
  });

  const publish = Effect.fn("OwnerCheckpoint.publish")(
    function* (binding: OwnerCheckpointBinding, revision: number) {
      const state = yield* current(binding, revision);
      const text = `owner-checkpoint-publication/v1:${binding.repository}:${binding.prNumber}:${binding.owner}:${binding.head}:${binding.generation}:${revision}:${state.entry.intent._tag}`;
      const hash = yield* sha256Hex(text);
      const externalId = `owner-checkpoint/v1:${hash}`;
      const attempt = yield* fence(state.entry, externalId);
      if (!attempt.first) {
        const recovery = recover(state.entry, externalId, attempt.anchor);
        return yield* O.isSome(attempt.anchor)
          ? compensateRelease(recovery, state.entry, externalId, attempt.anchor.value)
          : recovery;
      }
      const options = CheckRunCorrelationOptions.make({ externalId });
      if (attempt.creates) {
        const created = yield* native.create(policy.context, binding.head, options).pipe(Effect.result);
        if (Result.isFailure(created)) return yield* recover(state.entry, externalId, O.none());
        return yield* observe(state.entry, externalId, created.success.id);
      }
      if (O.isNone(attempt.anchor)) return hold("anchor-missing");
      const id = attempt.anchor.value;
      return yield* updateAnchor(state.entry, externalId, attempt.previous, id);
    },
    Effect.timeoutOrElse({ duration: "30 seconds", orElse: () => Effect.succeed(unknown()) })
  );
  return { owner, publish };
});
