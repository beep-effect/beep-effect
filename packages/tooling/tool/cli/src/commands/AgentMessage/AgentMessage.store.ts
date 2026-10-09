/** Transactional local messaging state, independent of provider execution.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlError from "effect/sql/SqlError";
import * as Tuple from "effect/Tuple";
import {
  Claim,
  EndpointBinding,
  Envelope,
  LaunchGrant,
  Receipt,
  ReceiptStatus,
  RouterError,
} from "./AgentMessage.models.ts";

const $I = $RepoCliId.create("commands/AgentMessage/AgentMessage.store");
const PayloadRows = S.Array(S.Struct({ payload: S.String }));
const ExistingMessageRows = S.Array(S.Struct({ payload: S.String, sender_generation: S.Natural }));
const QueueLimit = S.Int.check(S.isGreaterThan(0), S.isLessThanOrEqualTo(100000));
const DurabilityRows = S.Array(S.Struct({ synchronous: S.Literals([2]) })).check(S.isMinLength(1));
const JournalRows = S.Array(S.Struct({ journal_mode: S.Literals(["wal"]) })).check(S.isMinLength(1));
const VersionRows = S.Array(S.Struct({ version: S.Literals([1]) })).check(S.isMinLength(1), S.isMaxLength(1));
const SequenceRows = S.Array(S.Struct({ sequence: S.Natural })).check(S.isMinLength(1));
const MessageIdentityRows = S.Array(S.Struct({ id: S.String }));
const RecoveredRows = S.Array(
  S.Struct({ id: S.String, state: ReceiptStatus, attempt_generation: S.Natural, owner: S.String })
);

const CountRows = S.Array(S.Struct({ count: S.Natural }));
const GrantRows = S.Array(S.Struct({ payload: S.String, used: S.Natural }));
const StateRows = S.Array(
  S.Struct({
    payload: S.String,
    state: ReceiptStatus,
    target_generation: S.Natural,
    sender_generation: S.Natural,
    attempt_generation: S.Natural,
    dispatch_active: S.Literals([0, 1, 2]),
    owner: S.NullOr(S.String),
    lease_until: S.NullOr(S.Natural),
  })
);
type MessageState = (typeof StateRows.Type)[number];
const isActiveCompletionState = S.is(
  S.Struct({ state: S.Literals(["claimed", "acknowledged"]), dispatch_active: S.Literals([1, 2]) })
);
const isUsableSendEvidence = S.is(
  S.Struct({ capability: S.Literal("send"), disposition: S.Literals(["verified", "advertised"]) })
);
const ReceiptRows = S.Array(
  S.Struct({
    sequence: S.Natural,
    message_id: S.String,
    status: ReceiptStatus,
    at: S.Natural,
    generation: S.Natural,
    owner: S.NullOr(S.String),
    detail: S.NullOr(S.String),
  })
);
const encodeEnvelope = S.encodeEffect(S.fromJsonString(Envelope));
const decodeEnvelope = S.decodeUnknownEffect(S.fromJsonString(Envelope));
const encodeBinding = S.encodeEffect(S.fromJsonString(EndpointBinding));
const decodeBinding = S.decodeUnknownEffect(S.fromJsonString(EndpointBinding));
const encodeGrant = S.encodeEffect(S.fromJsonString(LaunchGrant));
const decodeGrant = S.decodeUnknownEffect(S.fromJsonString(LaunchGrant));
const error = (code: RouterError["code"], message: string) => RouterError.make({ code, message });
const isRouterError = S.is(RouterError);
const storageError = (cause: unknown) =>
  Match.value(cause).pipe(
    Match.when(isRouterError, (cause) => cause),
    Match.when(SqlError.isSqlError, (cause) =>
      error("storage", `Agent message SQL operation failed: ${cause.reason._tag}.`)
    ),
    Match.when(S.isSchemaError, () => error("storage", "Agent message storage decoding failed: SchemaError.")),
    Match.orElse(() => error("storage", "Agent message storage operation failed."))
  );

/** Operations whose state changes are committed before their results are returned.
 * **Example** (Read durable inbox)
 * ```ts
 * import { AgentMessageStore } from "@beep/repo-cli/commands/AgentMessage"
 * import * as Effect from "effect/Effect"
 * const program = Effect.gen(function* () { return yield* (yield* AgentMessageStore).inbox("peer") })
 * ```
 * @category services
 * @since 0.0.0
 */
export interface AgentMessageStoreShape {
  readonly accept: (envelope: Envelope, now: number) => Effect.Effect<Receipt, RouterError>;
  readonly acceptWithGrant: (envelope: Envelope, grantId: string, now: number) => Effect.Effect<Receipt, RouterError>;
  readonly acknowledge: (
    messageId: string,
    endpointId: string,
    now: number,
    grantId?: O.Option<string>
  ) => Effect.Effect<Receipt, RouterError>;
  readonly claimNext: (
    endpointId: string,
    ownerId: string,
    now: number,
    leaseUntil: number
  ) => Effect.Effect<O.Option<Claim>, RouterError>;
  readonly complete: (
    claim: Claim,
    status: "delivered" | "failed" | "ambiguous",
    now: number,
    detail?: O.Option<string>
  ) => Effect.Effect<Receipt, RouterError>;
  readonly endpoint: (endpointId: string) => Effect.Effect<EndpointBinding, RouterError>;
  readonly endpoints: Effect.Effect<ReadonlyArray<EndpointBinding>, RouterError>;
  readonly findMessage: (messageId: string) => Effect.Effect<O.Option<Envelope>, RouterError>;
  readonly inbox: (endpointId: string) => Effect.Effect<ReadonlyArray<Envelope>, RouterError>;
  readonly message: (messageId: string) => Effect.Effect<Envelope, RouterError>;
  readonly receipts: (messageId: string, afterSequence?: number) => Effect.Effect<ReadonlyArray<Receipt>, RouterError>;
  readonly recover: (now: number) => Effect.Effect<number, RouterError>;
  readonly register: (binding: EndpointBinding) => Effect.Effect<void, RouterError>;
  readonly registerGrant: (grant: LaunchGrant) => Effect.Effect<void, RouterError>;
  readonly scopedEndpoints: (
    grantId: string,
    now: number
  ) => Effect.Effect<ReadonlyArray<EndpointBinding>, RouterError>;
  readonly scopedInbox: (grantId: string, now: number) => Effect.Effect<ReadonlyArray<Envelope>, RouterError>;
  readonly scopedReceipts: (
    messageId: string,
    grantId: string,
    now: number
  ) => Effect.Effect<ReadonlyArray<Receipt>, RouterError>;
  readonly subscribe: (messageId: string, afterSequence?: number) => Stream.Stream<Receipt, RouterError>;
  readonly validateGrant: (grantId: string, now: number) => Effect.Effect<LaunchGrant, RouterError>;
}

/** Context service for the durable local message store.
 * **Example** (Request the store)
 * ```ts
 * import { AgentMessageStore } from "@beep/repo-cli/commands/AgentMessage"
 * const service = AgentMessageStore
 * ```
 * @category services
 * @since 0.0.0
 */
export class AgentMessageStore extends Context.Service<AgentMessageStore, AgentMessageStoreShape>()(
  $I`AgentMessageStore`
) {}

/** Initialize a file-backed store on the supplied SQLite client.
 * **Details**
 * The caller owns the restricted state directory and scoped SQL layer. Claims are
 * never reset for retry after expiry: their external outcome is ambiguous.
 * **Example** (Construct store with a bounded queue)
 * ```ts
 * import { makeAgentMessageStore } from "@beep/repo-cli/commands/AgentMessage"
 * const store = makeAgentMessageStore(1000)
 * ```
 * @param maxPending Maximum accepted or claimed messages retained in the dispatch queue.
 * @returns A store using the injected SQL client.
 * @category constructors
 * @since 0.0.0
 */
export const makeAgentMessageStore = (
  maxPending = 1000
): Effect.Effect<AgentMessageStoreShape, RouterError, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* S.decodeEffect(QueueLimit)(maxPending);
    yield* sql`PRAGMA journal_mode = WAL`;
    yield* sql`PRAGMA synchronous = FULL`;
    const durability = yield* sql`PRAGMA synchronous`;
    const modes = yield* sql`PRAGMA journal_mode`;
    yield* S.decodeUnknownEffect(DurabilityRows)(durability);
    yield* S.decodeUnknownEffect(JournalRows)(modes);
    yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql`CREATE TABLE IF NOT EXISTS agent_message_meta (version INTEGER PRIMARY KEY CHECK (version = 1))`;
        const versions = yield* sql`SELECT version FROM agent_message_meta`;
        if (A.length(versions) === 0) yield* sql`INSERT INTO agent_message_meta (version) VALUES (1)`;
        else yield* S.decodeUnknownEffect(VersionRows)(versions);
        yield* sql`CREATE TABLE IF NOT EXISTS agent_message_endpoints (id TEXT PRIMARY KEY, payload TEXT NOT NULL)`;
        yield* sql`CREATE TABLE IF NOT EXISTS agent_message_grants (id TEXT PRIMARY KEY, payload TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0)`;
        yield* sql`CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, payload TEXT NOT NULL,
        target TEXT NOT NULL, sender TEXT NOT NULL, scope TEXT NOT NULL,
        target_generation INTEGER NOT NULL, sender_generation INTEGER NOT NULL, state TEXT NOT NULL,
        created INTEGER NOT NULL, expires INTEGER NOT NULL,
        attempt_generation INTEGER NOT NULL DEFAULT 0, dispatch_active INTEGER NOT NULL DEFAULT 0, owner TEXT, lease_until INTEGER)`;
        yield* sql`CREATE INDEX IF NOT EXISTS agent_messages_pending ON agent_messages(target, state, created, id)`;
        yield* sql`CREATE TABLE IF NOT EXISTS agent_message_receipts (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT NOT NULL,
        status TEXT NOT NULL, at INTEGER NOT NULL, generation INTEGER NOT NULL,
        owner TEXT, detail TEXT)`;
        yield* sql`CREATE INDEX IF NOT EXISTS agent_message_receipts_message ON agent_message_receipts(message_id, sequence)`;
      })
    );

    const transaction = <T, E, R>(operation: Effect.Effect<T, E, R>) =>
      sql.withTransaction(operation).pipe(Effect.mapError(storageError));
    const endpoint = Effect.fn("AgentMessageStore.endpoint")(function* (endpointId: string) {
      const rows = yield* sql`SELECT payload FROM agent_message_endpoints WHERE id = ${endpointId}`.pipe(
        Effect.flatMap(S.decodeUnknownEffect(PayloadRows))
      );
      const row = A.head(rows);
      if (O.isNone(row)) return yield* error("unknownEndpoint", "Endpoint is not enrolled.");
      return yield* decodeBinding(row.value.payload);
    }, Effect.mapError(storageError));
    const state = Effect.fn("AgentMessageStore.state")(function* (messageId: string) {
      const rows =
        yield* sql`SELECT payload, state, target_generation, sender_generation, attempt_generation, dispatch_active, owner, lease_until FROM agent_messages WHERE id = ${messageId}`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(StateRows))
        );
      const row = A.head(rows);
      if (O.isNone(row)) return yield* error("conflict", "Message does not exist.");
      return row.value;
    });
    const receipts = Effect.fn("AgentMessageStore.receipts")(function* (messageId: string, afterSequence = 0) {
      const rows =
        yield* sql`SELECT sequence, message_id, status, at, generation, owner, detail FROM agent_message_receipts WHERE message_id = ${messageId} AND sequence > ${afterSequence} ORDER BY sequence`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(ReceiptRows))
        );
      return A.map(rows, (row) =>
        Receipt.make({
          sequence: row.sequence,
          messageId: row.message_id,
          status: row.status,
          at: row.at,
          attemptGeneration: row.generation,
          owner: O.fromNullishOr(row.owner),
          detail: O.fromNullishOr(row.detail),
        })
      );
    }, Effect.mapError(storageError));
    const append = Effect.fn("AgentMessageStore.append")(function* (
      messageId: string,
      status: ReceiptStatus,
      at: number,
      generation: number,
      owner = O.none<string>(),
      detail = O.none<string>()
    ) {
      const rows =
        yield* sql`INSERT INTO agent_message_receipts (message_id, status, at, generation, owner, detail) VALUES (${messageId}, ${status}, ${at}, ${generation}, ${O.getOrNull(owner)}, ${O.getOrNull(detail)}) RETURNING sequence`;
      const decoded = yield* S.decodeUnknownEffect(SequenceRows)(rows);
      const row = A.head(decoded);
      if (O.isNone(row)) return yield* error("storage", "Receipt insertion returned no sequence.");
      return Receipt.make({
        sequence: row.value.sequence,
        messageId,
        status,
        at,
        attemptGeneration: generation,
        owner,
        detail,
      });
    });
    const validateGrant = Effect.fn("AgentMessageStore.validateGrant")(function* (grantId: string, now: number) {
      const rows = yield* sql`SELECT payload, used FROM agent_message_grants WHERE id = ${grantId}`.pipe(
        Effect.flatMap(S.decodeUnknownEffect(GrantRows))
      );
      const row = A.head(rows);
      if (O.isNone(row)) return yield* error("invalidGrant", "Launch grant is not registered.");
      const grant = yield* decodeGrant(row.value.payload);
      const binding = yield* endpoint(grant.endpointId);
      if (
        grant.expiresAt <= now ||
        !binding.supported ||
        grant.generation !== binding.generation ||
        grant.ownerId !== binding.ownerId ||
        grant.repositoryScope !== binding.repositoryScope
      ) {
        return yield* error("invalidGrant", "Launch grant expired or its enrollment was replaced.");
      }
      return grant;
    }, Effect.mapError(storageError));
    const duplicateAcceptance = Effect.fn("AgentMessageStore.duplicateAcceptance")(function* (
      envelope: Envelope,
      payload: string,
      senderGeneration: number
    ) {
      const existing =
        yield* sql`SELECT payload, sender_generation FROM agent_messages WHERE id = ${envelope.messageId} OR idempotency_key = ${envelope.idempotencyKey}`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(ExistingMessageRows))
        );
      const duplicate = A.head(existing);
      if (O.isSome(duplicate)) {
        if (duplicate.value.payload !== payload || duplicate.value.sender_generation !== senderGeneration)
          return yield* error("conflict", "Message identity was reused with different content.");
        const receipt = A.head(yield* receipts(envelope.messageId));
        if (O.isNone(receipt)) return yield* error("storage", "Accepted message has no durable acceptance receipt.");
        return O.some(receipt.value);
      }
      return O.none<Receipt>();
    });
    const validateLifetime = Effect.fn("AgentMessageStore.validateLifetime")(function* (
      envelope: Envelope,
      now: number
    ) {
      if (
        envelope.expiresAt <= now ||
        envelope.expiresAt <= envelope.createdAt ||
        envelope.createdAt > now ||
        envelope.expiresAt - envelope.createdAt > 86400000
      )
        return yield* error("expired", "Envelope timestamps require an unexpired TTL of at most one day.");
    });
    const validateDestination = Effect.fn("AgentMessageStore.validateDestination")(function* (
      envelope: Envelope,
      target: EndpointBinding
    ) {
      if (
        !target.supported ||
        target.policy.policyEvidence === "unverified" ||
        !A.some(target.capabilityEvidence, isUsableSendEvidence)
      )
        return yield* error(
          "unsupported",
          "Destination lacks an authorized managed delivery capability and usable policy evidence."
        );
      if (
        target.repositoryScope !== envelope.repositoryScope ||
        target.policyFingerprint !== target.policy.fingerprint ||
        target.policyFingerprint !== envelope.policyFingerprint ||
        target.capabilityFingerprint !== envelope.capabilityFingerprint
      ) {
        return yield* error(
          "policyMismatch",
          "Destination policy, capability or repository scope differs from the envelope."
        );
      }
    });
    const validateReply = Effect.fn("AgentMessageStore.validateReply")(function* (
      envelope: Envelope,
      sender: EndpointBinding,
      target: EndpointBinding
    ) {
      if (O.isNone(envelope.replyTo)) return;
      const originalState = yield* state(envelope.replyTo.value);
      const original = yield* decodeEnvelope(originalState.payload);
      if (
        original.to.kind !== "direct" ||
        original.to.endpointId !== envelope.from ||
        original.from !== target.endpointId ||
        original.conversationId !== envelope.conversationId ||
        original.repositoryScope !== envelope.repositoryScope ||
        originalState.target_generation !== sender.generation ||
        originalState.sender_generation !== target.generation
      )
        return yield* error(
          "conflict",
          "Reply must retain the original conversation and both direct endpoint generations."
        );
    });
    const reserveAcceptance = Effect.fn("AgentMessageStore.reserveAcceptance")(function* (
      grant: O.Option<LaunchGrant>
    ) {
      const counts =
        yield* sql`SELECT count(*) AS count FROM agent_messages WHERE state IN ('accepted', 'claimed', 'ambiguous', 'delivered') OR dispatch_active != 0`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(CountRows))
        );
      if (A.some(counts, (row) => row.count >= maxPending))
        return yield* error("queueFull", "Durable message queue is at capacity.");
      if (O.isSome(grant)) {
        const spent =
          yield* sql`UPDATE agent_message_grants SET used = used + 1 WHERE id = ${grant.value.grantId} AND used < ${grant.value.maxMessages} RETURNING used`;
        if (A.length(spent) === 0) return yield* error("invalidGrant", "Launch grant message budget is exhausted.");
      }
    });
    const authorizeSend = Effect.fn("AgentMessageStore.authorizeSend")(function* (
      envelope: Envelope,
      targetId: string,
      grant: O.Option<LaunchGrant>
    ) {
      if (O.isNone(grant)) return;
      if (
        grant.value.endpointId !== envelope.from ||
        grant.value.repositoryScope !== envelope.repositoryScope ||
        (O.isSome(grant.value.conversationScope) && grant.value.conversationScope.value !== envelope.conversationId) ||
        !A.contains(grant.value.allowedRecipients, targetId)
      ) {
        return yield* error("invalidGrant", "Launch grant does not authorize this sender and recipient.");
      }
    });
    const reconcileReplacement = Effect.fn("AgentMessageStore.reconcileReplacement")(function* (
      binding: EndpointBinding
    ) {
      const busy =
        yield* sql`SELECT count(*) AS count FROM agent_messages WHERE target = ${binding.endpointId} AND (dispatch_active != 0 OR state IN ('ambiguous', 'delivered'))`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(CountRows))
        );
      if (A.some(busy, (row) => row.count > 0))
        return yield* error(
          "staleClaim",
          "Enrollment cannot activate a successor with an unresolved dispatch or acknowledgement."
        );
      const stale =
        yield* sql`UPDATE agent_messages SET state = 'failed' WHERE target = ${binding.endpointId} AND state = 'accepted' AND target_generation < ${binding.generation} RETURNING id`;
      const staleRows = yield* S.decodeUnknownEffect(MessageIdentityRows)(stale);
      const at = yield* Clock.currentTimeMillis;
      yield* Effect.forEach(staleRows, (row) =>
        append(
          row.id,
          "failed",
          at,
          0,
          O.none(),
          O.some("Direct destination generation was replaced before submission; explicit new acceptance is required.")
        )
      );
    });
    const validateDispatcher = Effect.fn("AgentMessageStore.validateDispatcher")(function* (
      binding: EndpointBinding,
      ownerId: string
    ) {
      if (
        !binding.supported ||
        binding.policy.policyEvidence === "unverified" ||
        binding.ownerId !== ownerId ||
        binding.policyFingerprint !== binding.policy.fingerprint ||
        !A.some(binding.capabilityEvidence, isUsableSendEvidence)
      )
        return yield* error(
          "policyMismatch",
          "Dispatcher does not match the evidenced enrollment owner and effective policy."
        );
      if (O.isSome(binding.host) && binding.host.value.provider !== binding.policy.provider)
        return yield* error("policyMismatch", "Endpoint host provider differs from its enrolled policy.");
    });
    const validateCompletion = Effect.fn("AgentMessageStore.validateCompletion")(function* (
      claim: Claim,
      current: MessageState
    ) {
      const binding = claim.envelope.to.kind === "direct" ? yield* endpoint(claim.envelope.to.endpointId) : undefined;
      if (
        !isActiveCompletionState(current) ||
        current.owner !== claim.ownerId ||
        current.attempt_generation !== claim.generation ||
        current.lease_until !== claim.leaseUntil
      )
        return yield* error("staleClaim", "Dispatch result no longer owns the current lease and enrollment.");
      if (
        binding === undefined ||
        binding.ownerId !== claim.ownerId ||
        binding.generation !== current.target_generation
      )
        return yield* error("staleClaim", "Dispatch result no longer owns the current lease and enrollment.");
    });
    const completeAcknowledged = Effect.fn("AgentMessageStore.completeAcknowledged")(function* (
      claim: Claim,
      current: MessageState,
      status: "delivered" | "failed" | "ambiguous",
      now: number,
      detail: O.Option<string>
    ) {
      const active = status === "ambiguous" ? 2 : 0;
      yield* sql`UPDATE agent_messages SET dispatch_active = ${active} WHERE id = ${claim.envelope.messageId}`;
      if (status === "ambiguous" && current.dispatch_active === 1)
        return yield* append(
          claim.envelope.messageId,
          "ambiguous",
          now,
          claim.generation,
          O.some(claim.ownerId),
          O.some(
            Str.takeLeft(
              `Participant acknowledged consumption; native completion is unknown. Reconcile the original session before retry. ${O.getOrElse(detail, () => "")}`,
              1024
            )
          )
        );
      if (status !== "ambiguous" && current.dispatch_active === 2)
        return yield* append(
          claim.envelope.messageId,
          status,
          now,
          claim.generation,
          O.some(claim.ownerId),
          O.some(
            "Original owned native attempt reached a known terminal result; its dispatch hold is released and participant acknowledgement is retained."
          )
        );
      const last = A.last(yield* receipts(claim.envelope.messageId));
      if (O.isNone(last)) return yield* error("storage", "Acknowledged message has no receipt.");
      return last.value;
    });
    const authorizeAcknowledgement = Effect.fn("AgentMessageStore.authorizeAcknowledgement")(function* (
      envelope: Envelope,
      endpointId: string,
      now: number,
      grantId: O.Option<string>
    ) {
      if (O.isNone(grantId)) return;
      const grant = yield* validateGrant(grantId.value, now);
      if (
        grant.endpointId !== endpointId ||
        grant.repositoryScope !== envelope.repositoryScope ||
        (O.isSome(grant.conversationScope) && grant.conversationScope.value !== envelope.conversationId)
      )
        return yield* error("invalidGrant", "Launch grant does not authorize this acknowledgement.");
    });
    const validateAcknowledgementRecipient = Effect.fn("AgentMessageStore.validateAcknowledgementRecipient")(function* (
      envelope: Envelope,
      endpointId: string,
      current: MessageState
    ) {
      if (
        envelope.to.kind !== "direct" ||
        envelope.to.endpointId !== endpointId ||
        (current.state !== "claimed" && current.state !== "delivered" && current.state !== "acknowledged")
      )
        return yield* error("conflict", "Only a dispatched recipient can acknowledge a message.");
      const binding = yield* endpoint(endpointId);
      if (binding.generation !== current.target_generation)
        return yield* error("staleClaim", "Acknowledgement belongs to a replaced endpoint generation.");
    });
    const accept = (envelope: Envelope, now: number, grantId: O.Option<string>) =>
      transaction(
        Effect.gen(function* () {
          const payload = yield* encodeEnvelope(envelope);
          const grant = yield* O.match(grantId, {
            onNone: () => Effect.succeed(O.none<LaunchGrant>()),
            onSome: (id) => Effect.asSome(validateGrant(id, now)),
          });
          if (envelope.to.kind !== "direct")
            return yield* error(
              "unsupported",
              "Role routing requires an authorized register projection and is unsupported in this slice."
            );
          const sender = yield* endpoint(envelope.from);
          if (sender.repositoryScope !== envelope.repositoryScope)
            return yield* error("policyMismatch", "Sender repository scope differs from the envelope.");
          yield* authorizeSend(envelope, envelope.to.endpointId, grant);
          const duplicate = yield* duplicateAcceptance(envelope, payload, sender.generation);
          if (O.isSome(duplicate)) return duplicate.value;
          yield* validateLifetime(envelope, now);
          const target = yield* endpoint(envelope.to.endpointId);
          yield* validateDestination(envelope, target);
          yield* validateReply(envelope, sender, target);
          yield* reserveAcceptance(grant);
          yield* sql`INSERT INTO agent_messages (id, idempotency_key, payload, target, sender, scope, target_generation, sender_generation, state, created, expires) VALUES (${envelope.messageId}, ${envelope.idempotencyKey}, ${payload}, ${target.endpointId}, ${envelope.from}, ${envelope.repositoryScope}, ${target.generation}, ${sender.generation}, 'accepted', ${envelope.createdAt}, ${envelope.expiresAt})`;
          return yield* append(envelope.messageId, "accepted", now, 0);
        })
      );
    const recover = (now: number) =>
      transaction(
        Effect.gen(function* () {
          const expired =
            yield* sql`UPDATE agent_messages SET state = 'expired' WHERE state = 'accepted' AND expires <= ${now} RETURNING id`;
          const expiredRows = yield* S.decodeUnknownEffect(MessageIdentityRows)(expired);
          yield* Effect.forEach(expiredRows, (row) => append(row.id, "expired", now, 0));
          const rows =
            yield* sql`UPDATE agent_messages SET state = CASE WHEN state = 'acknowledged' THEN state ELSE 'ambiguous' END, dispatch_active = 2 WHERE dispatch_active = 1 AND lease_until <= ${now} RETURNING id, state, attempt_generation, owner`;
          const decoded = yield* S.decodeUnknownEffect(RecoveredRows)(rows);
          yield* Effect.forEach(decoded, (row) =>
            append(
              row.id,
              "ambiguous",
              now,
              row.attempt_generation,
              O.some(row.owner),
              O.some("Dispatch lease expired; external outcome requires reconciliation.")
            )
          );
          const unacknowledged =
            yield* sql`UPDATE agent_messages SET state = 'ambiguous' WHERE state = 'delivered' AND expires <= ${now} RETURNING id, state, attempt_generation, owner`;
          const unacknowledgedRows = yield* S.decodeUnknownEffect(RecoveredRows)(unacknowledged);
          yield* Effect.forEach(unacknowledgedRows, (row) =>
            append(
              row.id,
              "ambiguous",
              now,
              row.attempt_generation,
              O.some(row.owner),
              O.some(
                "Acknowledgement deadline expired after native consumption; the attempt owner must reconcile the original session before any retry."
              )
            )
          );
          return A.length(decoded) + A.length(expiredRows) + A.length(unacknowledgedRows);
        })
      );

    return {
      endpoint,
      scopedEndpoints: (grantId, now) =>
        transaction(
          Effect.gen(function* () {
            const grant = yield* validateGrant(grantId, now);
            const rows = yield* sql`SELECT payload FROM agent_message_endpoints ORDER BY id`.pipe(
              Effect.flatMap(S.decodeUnknownEffect(PayloadRows))
            );
            const bindings = yield* Effect.forEach(rows, (row) => decodeBinding(row.payload));
            return A.filter(
              bindings,
              (binding) =>
                binding.repositoryScope === grant.repositoryScope &&
                A.contains(grant.allowedRecipients, binding.endpointId)
            );
          })
        ),
      scopedInbox: (grantId, now) =>
        transaction(
          Effect.gen(function* () {
            const grant = yield* validateGrant(grantId, now);
            const rows =
              yield* sql`SELECT payload FROM agent_messages WHERE target = ${grant.endpointId} AND scope = ${grant.repositoryScope} AND target_generation = ${grant.generation} AND state IN ('accepted', 'claimed', 'delivered', 'ambiguous') ORDER BY created, rowid`.pipe(
                Effect.flatMap(S.decodeUnknownEffect(PayloadRows))
              );
            const envelopes = yield* Effect.forEach(rows, (row) => decodeEnvelope(row.payload));
            return A.filter(envelopes, (envelope) =>
              O.match(grant.conversationScope, {
                onNone: () => true,
                onSome: (conversationId) => envelope.conversationId === conversationId,
              })
            );
          })
        ),
      scopedReceipts: (messageId, grantId, now) =>
        transaction(
          Effect.gen(function* () {
            const grant = yield* validateGrant(grantId, now);
            const current = yield* state(messageId);
            const envelope = yield* decodeEnvelope(current.payload);
            const ownsSender = envelope.from === grant.endpointId && current.sender_generation === grant.generation;
            const ownsRecipient =
              envelope.to.kind === "direct" &&
              envelope.to.endpointId === grant.endpointId &&
              current.target_generation === grant.generation;
            if (
              envelope.repositoryScope !== grant.repositoryScope ||
              (O.isSome(grant.conversationScope) && grant.conversationScope.value !== envelope.conversationId) ||
              (!ownsSender && !ownsRecipient)
            )
              return yield* error(
                "invalidGrant",
                "Message receipts are outside this grant's generation and repository scope."
              );
            return yield* receipts(messageId);
          })
        ),
      endpoints: sql`SELECT payload FROM agent_message_endpoints ORDER BY id`.pipe(
        Effect.flatMap(S.decodeUnknownEffect(PayloadRows)),
        Effect.flatMap(Effect.forEach((row) => decodeBinding(row.payload))),
        Effect.mapError(storageError)
      ),
      register: (binding) =>
        transaction(
          Effect.gen(function* () {
            if (binding.policyFingerprint !== binding.policy.fingerprint)
              return yield* error("policyMismatch", "Enrollment policy fingerprint differs from effective policy.");
            const payload = yield* encodeBinding(binding);
            const rows = yield* sql`SELECT payload FROM agent_message_endpoints WHERE id = ${binding.endpointId}`.pipe(
              Effect.flatMap(S.decodeUnknownEffect(PayloadRows))
            );
            const previous = A.head(rows);
            if (O.isSome(previous)) {
              const prior = yield* decodeBinding(previous.value.payload);
              if (
                binding.generation < prior.generation ||
                (binding.generation === prior.generation && payload !== previous.value.payload)
              )
                return yield* error("staleClaim", "Enrollment replacement requires a newer generation.");
              if (binding.generation > prior.generation) yield* reconcileReplacement(binding);
            }
            yield* sql`INSERT INTO agent_message_endpoints (id, payload) VALUES (${binding.endpointId}, ${payload}) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`;
          })
        ),
      registerGrant: (grant) =>
        transaction(
          Effect.gen(function* () {
            const binding = yield* endpoint(grant.endpointId);
            if (
              grant.ownerId !== binding.ownerId ||
              grant.generation !== binding.generation ||
              grant.repositoryScope !== binding.repositoryScope
            )
              return yield* error("invalidGrant", "Launch grant does not match its current enrollment.");
            const payload = yield* encodeGrant(grant);
            const rows = yield* sql`SELECT payload FROM agent_message_grants WHERE id = ${grant.grantId}`.pipe(
              Effect.flatMap(S.decodeUnknownEffect(PayloadRows))
            );
            const previous = A.head(rows);
            if (O.isSome(previous) && previous.value.payload !== payload)
              return yield* error("conflict", "Launch grant identity cannot be replaced.");
            yield* sql`INSERT OR IGNORE INTO agent_message_grants (id, payload, used) VALUES (${grant.grantId}, ${payload}, 0)`;
          })
        ),
      validateGrant: (grantId, now) => transaction(validateGrant(grantId, now)),
      accept: (envelope, now) => accept(envelope, now, O.none()),
      acceptWithGrant: (envelope, grantId, now) => accept(envelope, now, O.some(grantId)),
      recover,
      claimNext: (endpointId, ownerId, now, leaseUntil) =>
        transaction(
          Effect.gen(function* () {
            if (leaseUntil <= now || leaseUntil > now + 300000)
              return yield* error("staleClaim", "Dispatch lease must be positive and at most five minutes.");
            const binding = yield* endpoint(endpointId);
            yield* validateDispatcher(binding, ownerId);
            const busy =
              yield* sql`SELECT count(*) AS count FROM agent_messages WHERE target = ${endpointId} AND (dispatch_active != 0 OR state = 'ambiguous')`.pipe(
                Effect.flatMap(S.decodeUnknownEffect(CountRows))
              );
            if (A.some(busy, (row) => row.count > 0)) return O.none<Claim>();
            const expired =
              yield* sql`UPDATE agent_messages SET state = 'expired' WHERE target = ${endpointId} AND state = 'accepted' AND expires <= ${now} RETURNING id`;
            const expiredRows = yield* S.decodeUnknownEffect(MessageIdentityRows)(expired);
            yield* Effect.forEach(expiredRows, (row) => append(row.id, "expired", now, 0));
            const rows =
              yield* sql`SELECT payload, state, target_generation, sender_generation, attempt_generation, dispatch_active, owner, lease_until FROM agent_messages WHERE target = ${endpointId} AND state = 'accepted' ORDER BY created, rowid LIMIT 1`.pipe(
                Effect.flatMap(S.decodeUnknownEffect(StateRows))
              );
            const row = A.head(rows);
            if (O.isNone(row)) return O.none<Claim>();
            const envelope = yield* decodeEnvelope(row.value.payload);
            if (
              row.value.target_generation !== binding.generation ||
              envelope.policyFingerprint !== binding.policyFingerprint ||
              envelope.capabilityFingerprint !== binding.capabilityFingerprint
            )
              return yield* error("policyMismatch", "Accepted message is fenced by a replaced enrollment.");
            const generation = row.value.attempt_generation + 1;
            yield* sql`UPDATE agent_messages SET state = 'claimed', dispatch_active = 1, owner = ${ownerId}, lease_until = ${leaseUntil}, attempt_generation = ${generation} WHERE id = ${envelope.messageId} AND state = 'accepted'`;
            yield* append(envelope.messageId, "claimed", now, generation, O.some(ownerId));
            return O.some(Claim.make({ envelope, ownerId, generation, leaseUntil }));
          })
        ),
      complete: (claim, status, now, detail = O.none()) =>
        transaction(
          Effect.gen(function* () {
            const current = yield* state(claim.envelope.messageId);
            yield* validateCompletion(claim, current);
            if (current.state === "acknowledged")
              return yield* completeAcknowledged(claim, current, status, now, detail);
            if (claim.leaseUntil <= now)
              return yield* error("staleClaim", "Dispatch lease expired before its result was recorded.");
            yield* sql`UPDATE agent_messages SET state = ${status}, dispatch_active = 0 WHERE id = ${claim.envelope.messageId}`;
            return yield* append(
              claim.envelope.messageId,
              status,
              now,
              claim.generation,
              O.some(claim.ownerId),
              detail
            );
          })
        ),
      message: (messageId) =>
        state(messageId).pipe(
          Effect.flatMap((row) => decodeEnvelope(row.payload)),
          Effect.mapError(storageError)
        ),
      findMessage: (messageId) =>
        sql`SELECT payload FROM agent_messages WHERE id = ${messageId}`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(PayloadRows)),
          Effect.flatMap((rows) =>
            O.match(A.head(rows), {
              onNone: () => Effect.succeed(O.none<Envelope>()),
              onSome: (row) => Effect.asSome(decodeEnvelope(row.payload)),
            })
          ),
          Effect.mapError(storageError)
        ),
      inbox: (endpointId) =>
        sql`SELECT payload FROM agent_messages WHERE target = ${endpointId} AND state IN ('accepted', 'claimed', 'delivered', 'ambiguous') ORDER BY created, rowid`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(PayloadRows)),
          Effect.flatMap(Effect.forEach((row) => decodeEnvelope(row.payload))),
          Effect.mapError(storageError)
        ),
      receipts,
      subscribe: (messageId, afterSequence = 0) =>
        Stream.unfold(afterSequence, (cursor) =>
          Effect.map(receipts(messageId, cursor), (rows) =>
            Tuple.make(
              rows,
              O.getOrElse(
                O.map(A.last(rows), (row) => row.sequence),
                () => cursor
              )
            )
          )
        ).pipe(Stream.schedule(Schedule.spaced(Duration.seconds(1))), Stream.flattenIterable),
      acknowledge: (messageId, endpointId, now, grantId = O.none()) =>
        transaction(
          Effect.gen(function* () {
            const current = yield* state(messageId);
            const envelope = yield* decodeEnvelope(current.payload);
            yield* authorizeAcknowledgement(envelope, endpointId, now, grantId);
            yield* validateAcknowledgementRecipient(envelope, endpointId, current);
            if (current.state === "acknowledged") {
              const last = A.findLast(yield* receipts(messageId), (receipt) => receipt.status === "acknowledged");
              if (O.isNone(last)) return yield* error("storage", "Acknowledged message has no receipt.");
              return last.value;
            }
            yield* sql`UPDATE agent_messages SET state = 'acknowledged' WHERE id = ${messageId}`;
            return yield* append(
              messageId,
              "acknowledged",
              now,
              current.attempt_generation,
              O.fromNullishOr(current.owner)
            );
          })
        ),
    } satisfies AgentMessageStoreShape;
  }).pipe(Effect.mapError(storageError));
