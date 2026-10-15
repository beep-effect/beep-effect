import {
  AgentMessageStore,
  AgentMessageStoreLimits,
  AmbiguityResolution,
  EndpointBinding,
  EndpointDispatch,
  Envelope,
  LaunchGrant,
  makeAgentMessageRouter,
  makeAgentMessageSqliteClient,
  makeAgentMessageStore,
  Receipt,
  RouterError,
} from "@beep/repo-cli/test/AgentMessage";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Result from "effect/Result";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import type { AgentMessageStoreShape } from "@beep/repo-cli/test/AgentMessage";

const EnvelopeJson = S.fromJsonString(Envelope);
const AmbiguityResolutionJson = S.fromJsonString(AmbiguityResolution);
const encodeAmbiguityResolutionJson = S.encodeEffect(AmbiguityResolutionJson);
const decodeAmbiguityResolutionJson = S.decodeEffect(AmbiguityResolutionJson);
const decodeResolutionAuditRows = S.decodeUnknownEffect(
  S.Array(S.Struct({ payload: S.String, decided_at: S.Natural, receipt_sequence: S.Natural }))
);
const decodeReceiptJson = S.decodeEffect(S.fromJsonString(Receipt));
const encodeEndpointBindingJson = S.encodeEffect(S.fromJsonString(EndpointBinding));

const binding = (id: string, generation = 1) =>
  S.decodeEffect(EndpointBinding)({
    endpointId: id,
    participantId: id,
    sessionId: `${id}-session`,
    ownerId: `${id}-owner`,
    generation,
    repositoryScope: "test-repository",
    capabilityFingerprint: "cap-v1",
    policyFingerprint: "policy-v1",
    supported: true,
    capabilityEvidence: [
      { capability: "send", disposition: "verified", source: "injected endpoint fixture", observedAt: 100 },
    ],
    policy: {
      provider: "injected",
      modelId: "fixture",
      effort: "medium",
      sandbox: "no-tools",
      approvalPolicy: "never",
      fingerprint: "policy-v1",
      policyEvidence: "launch-enforced",
    },
  });
const envelope = (id: string, from = "a", to = "b", expiresAt = 10000) =>
  Envelope.make({
    conversationId: "fixture-conversation",
    messageId: id,
    idempotencyKey: id,
    from,
    to: { kind: "direct", endpointId: to },
    repositoryScope: "test-repository",
    body: `bounded ${id}`,
    createdAt: 100,
    expiresAt,
    capabilityFingerprint: "cap-v1",
    policyFingerprint: "policy-v1",
  });
const grant = (maxMessages = 1) =>
  LaunchGrant.make({
    grantId: "grant-a",
    endpointId: "a",
    generation: 1,
    ownerId: "a-owner",
    repositoryScope: "test-repository",
    allowedRecipients: ["b"],
    expiresAt: 10000,
    maxMessages,
  });

const fixture = Effect.fnUntraced(function* <T, E, R>(
  run: (store: AgentMessageStoreShape, filename: string) => Effect.Effect<T, E, R>,
  maxPending = 1000,
  maxPendingPerEndpoint = 100
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* Config.String("HOME");
  const cache = path.join(home, ".cache", "beep", "agent-message-tests");
  yield* fs.makeDirectory(cache, { recursive: true, mode: 0o700 });
  const directory = yield* fs.makeTempDirectoryScoped({ directory: cache, prefix: "store-" });
  const filename = path.join(directory, "messages.sqlite");
  const client = yield* makeAgentMessageSqliteClient(filename, "50 millis");
  const store = yield* makeAgentMessageStore(AgentMessageStoreLimits.make({ maxPending, maxPendingPerEndpoint })).pipe(
    Effect.provideService(SqlClient.SqlClient, client)
  );
  yield* store.register(yield* binding("a"));
  yield* store.register(yield* binding("b"));
  return yield* run(store, filename);
});

const processFixture = Effect.fn("AgentMessageTest.processFixture")(function* (
  filename: string,
  stage: string,
  markerName: string,
  resolution = O.none<AmbiguityResolution>()
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const checkpoint = path.join(path.dirname(filename), markerName);
  const input = path.join(path.dirname(filename), "envelope.json");
  const payload = yield* O.match(resolution, {
    onNone: () => S.encodeEffect(EnvelopeJson)(envelope("crash")),
    onSome: encodeAmbiguityResolutionJson,
  });
  yield* fs.writeFileString(input, payload, {
    mode: 0o600,
  });
  const child = yield* ChildProcess.make(
    process.execPath,
    [new URL("./fixtures/agent-message/process.ts", import.meta.url).pathname],
    {
      env: {
        BEEP_MESSAGE_FIXTURE_DATABASE: filename,
        BEEP_MESSAGE_FIXTURE_CHECKPOINT: checkpoint,
        BEEP_MESSAGE_FIXTURE_STAGE: stage,
        BEEP_MESSAGE_FIXTURE_ENVELOPE: input,
      },
      stdin: "ignore",
      stdout: "ignore",
      stderr: "inherit",
    }
  );
  const wait = Effect.gen(function* () {
    while (!(yield* fs.exists(checkpoint))) yield* Effect.sleep("10 millis");
    return yield* fs.readFileString(checkpoint);
  }).pipe(Effect.timeout("10 seconds"), TestClock.withLive);
  return { child, wait };
});

it.layer(Layer.mergeAll(NodeServices.layer, Reactivity.layer), { timeout: "10 seconds" })(
  "AgentMessage transactional delivery",
  (it) => {
    it.effect("acceptance retries preserve receipt and cannot reset persisted grant budget", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.registerGrant(grant());
          const first = yield* store.acceptWithGrant(envelope("m1"), "grant-a", 100);
          const retry = yield* store.acceptWithGrant(envelope("m1"), "grant-a", 101);
          expect(retry.sequence).toBe(first.sequence);
          yield* store.registerGrant(grant());
          expect((yield* Effect.flip(store.acceptWithGrant(envelope("m2"), "grant-a", 102))).code).toBe("invalidGrant");
          expect((yield* store.receipts("m1")).length).toBe(1);
          expect(
            (yield* Effect.flip(store.accept(Envelope.make({ ...envelope("m1"), body: "conflicting payload" }), 103)))
              .code
          ).toBe("conflict");
        })
      )
    );

    it.effect("expired grants, scope mismatch and role targets cannot consume budget or create mail", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.registerGrant(grant());
          expect((yield* Effect.flip(store.validateGrant("grant-a", 10000))).code).toBe("invalidGrant");
          expect((yield* Effect.flip(store.acceptWithGrant(envelope("reverse", "b", "a"), "grant-a", 100))).code).toBe(
            "invalidGrant"
          );
          expect(
            (yield* Effect.flip(
              store.accept(Envelope.make({ ...envelope("role"), to: { kind: "role", roleId: "orchestrator" } }), 100)
            )).code
          ).toBe("unsupported");
          expect(
            (yield* Effect.flip(
              store.accept(Envelope.make({ ...envelope("scope"), repositoryScope: "other-repository" }), 100)
            )).code
          ).toBe("policyMismatch");
          expect(yield* store.inbox("b")).toHaveLength(0);
        })
      )
    );

    it.effect("one destination claim excludes another connection and survives restart as ambiguity", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("m1"), 100);
          yield* store.accept(envelope("m2"), 100);
          const claimed = O.getOrThrow(yield* store.claimNext("b", "b-owner", 101, 201));
          const contenderClient = yield* makeAgentMessageSqliteClient(filename, "50 millis");
          const contender = yield* makeAgentMessageStore().pipe(
            Effect.provideService(SqlClient.SqlClient, contenderClient)
          );
          assertNone(yield* contender.claimNext("b", "b-owner", 102, 202));
          expect((yield* Effect.flip(store.register(yield* binding("b", 2)))).code).toBe("staleClaim");
          expect(yield* contender.recover(202)).toBe(1);
          expect(yield* contender.recover(203)).toBe(0);
          expect(A.map(yield* contender.receipts("m1"), (receipt) => receipt.status)).toEqual([
            "accepted",
            "claimed",
            "ambiguous",
          ]);
          assertNone(yield* contender.claimNext("b", "b-owner", 203, 303));
          expect((yield* Effect.flip(store.complete(claimed, "delivered", 204))).code).toBe("staleClaim");
        })
      )
    );

    it.effect("TTL expiry yields durable receipt and bounded queue refuses additional acceptance", () =>
      fixture(
        (store) =>
          Effect.gen(function* () {
            yield* store.accept(envelope("expired", "a", "b", 110), 100);
            expect((yield* Effect.flip(store.accept(envelope("overflow"), 100))).code).toBe("queueFull");
            assertNone(yield* store.claimNext("b", "b-owner", 110, 210));
            expect(A.map(yield* store.receipts("expired"), (receipt) => receipt.status)).toEqual([
              "accepted",
              "expired",
            ]);
            yield* store.accept(envelope("next"), 111);
            assertSome(
              O.map(yield* store.claimNext("b", "b-owner", 112, 212), (claim) => claim.envelope.messageId),
              "next"
            );
          }),
        1
      )
    );

    it.effect("two injected endpoints preserve roundtrip correlation across restart, duplicate and dropped ACK", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          const seen: string[] = [];
          const request = envelope("request");
          const accepted = yield* store.accept(request, 100);
          const client = yield* makeAgentMessageSqliteClient(filename);
          const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
          const router = yield* makeAgentMessageRouter.pipe(
            Effect.provideService(AgentMessageStore, reopened),
            Effect.provideService(EndpointDispatch, {
              submit: (claim) =>
                Effect.sync(() => {
                  seen.push(claim.envelope.body);
                  return "delivered";
                }),
            })
          );
          expect((yield* router.accept(request, 100)).sequence).toBe(accepted.sequence);
          expect(
            O.getOrThrow(yield* router.dispatchOne("b", "b-owner", 101, 201, () => Effect.succeed(102))).status
          ).toBe("delivered");
          yield* router.acknowledge("request", "b", 103);
          yield* router.accept(Envelope.make({ ...envelope("reply", "b", "a"), replyTo: O.some("request") }), 104);
          yield* router.dispatchOne("a", "a-owner", 105, 205, () => Effect.succeed(106));
          expect(seen).toEqual(["bounded request", "bounded reply"]);
          expect(O.getOrNull((yield* router.message("reply")).replyTo)).toBe("request");
          expect((yield* router.receipts("request")).length).toBe(4);
          expect(yield* router.recover(10000)).toBe(1);
          expect(O.getOrThrow(A.last(yield* router.receipts("reply"))).status).toBe("ambiguous");
          assertNone(yield* router.claimNext("a", "a-owner", 10001, 10101));
          expect(seen).toEqual(["bounded request", "bounded reply"]);
        })
      )
    );

    it.effect("uncertain native submission produces ambiguity rather than automatic retry", () =>
      fixture((store) =>
        Effect.gen(function* () {
          let submissions = 0;
          const router = yield* makeAgentMessageRouter.pipe(
            Effect.provideService(AgentMessageStore, store),
            Effect.provideService(EndpointDispatch, {
              submit: Effect.fn("uncertainSubmit")(function* () {
                submissions += 1;
                return yield* RouterError.make({ code: "storage", message: "synthetic disconnected response" });
              }),
            })
          );
          yield* router.accept(envelope("uncertain"), 100);
          expect(
            O.getOrThrow(yield* router.dispatchOne("b", "b-owner", 101, 201, () => Effect.succeed(102))).status
          ).toBe("ambiguous");
          assertNone(yield* router.dispatchOne("b", "b-owner", 103, 203, () => Effect.succeed(104)));
          expect(submissions).toBe(1);
          expect(O.getOrNull(O.getOrThrow(A.last(yield* store.receipts("uncertain"))).detail)).toBe(
            "storage: synthetic disconnected response"
          );
        })
      )
    );

    it.effect("SIGKILL after child acceptance retains one logical receipt after reopening", () =>
      fixture((_store, filename) =>
        Effect.gen(function* () {
          const process = yield* processFixture(filename, "accept", "accept-checkpoint");
          expect(yield* process.wait).toBe("accepted");
          yield* process.child.kill({ killSignal: "SIGKILL" });
          expect((yield* Effect.flip(process.child.exitCode)).reason.cause).toMatchObject({
            message: expect.stringContaining("SIGKILL"),
          });
          const client = yield* makeAgentMessageSqliteClient(filename);
          const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
          const accepted = yield* reopened.accept(envelope("crash"), 101);
          expect(accepted.status).toBe("accepted");
          expect(yield* reopened.receipts("crash")).toHaveLength(1);
          expect(yield* reopened.inbox("b")).toHaveLength(1);
        })
      )
    );

    it.effect("SIGKILL after child claim holds unknown external outcome without replay", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("crash"), 100);
          const process = yield* processFixture(filename, "claim", "claim-checkpoint");
          expect(yield* process.wait).toBe("claimed");
          yield* process.child.kill({ killSignal: "SIGKILL" });
          expect((yield* Effect.flip(process.child.exitCode)).reason.cause).toMatchObject({
            message: expect.stringContaining("SIGKILL"),
          });
          const client = yield* makeAgentMessageSqliteClient(filename);
          const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
          expect(yield* reopened.recover(202)).toBe(1);
          expect(A.map(yield* reopened.receipts("crash"), (receipt) => receipt.status)).toEqual([
            "accepted",
            "claimed",
            "ambiguous",
          ]);
          assertNone(yield* reopened.claimNext("b", "b-owner", 203, 303));
        })
      )
    );

    it.effect("two real processes race for one destination dispatch slot", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("race-1"), 100);
          yield* store.accept(envelope("race-2"), 100);
          const first = yield* processFixture(filename, "claim", "race-first");
          const second = yield* processFixture(filename, "claim", "race-second");
          const results = yield* Effect.all([first.wait, second.wait], { concurrency: "unbounded" });
          expect(A.filter(results, (result) => result === "claimed")).toHaveLength(1);
          expect(A.filter(results, (result) => result === "none")).toHaveLength(1);
          yield* first.child.kill({ killSignal: "SIGKILL" });
          yield* second.child.kill({ killSignal: "SIGKILL" });
          expect((yield* Effect.flip(first.child.exitCode)).reason.cause).toMatchObject({
            message: expect.stringContaining("SIGKILL"),
          });
          expect((yield* Effect.flip(second.child.exitCode)).reason.cause).toMatchObject({
            message: expect.stringContaining("SIGKILL"),
          });
          expect(yield* store.recover(202)).toBe(1);
        })
      )
    );

    it.effect("replaced direct generation terminalizes unsent mail and allows a new acceptance", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("old-generation"), 100);
          yield* store.register(yield* binding("b", 2));
          expect(A.map(yield* store.receipts("old-generation"), (receipt) => receipt.status)).toEqual([
            "accepted",
            "failed",
          ]);
          yield* store.accept(envelope("new-generation"), 101);
          expect(O.getOrThrow(yield* store.claimNext("b", "b-owner", 102, 202)).envelope.messageId).toBe(
            "new-generation"
          );
        })
      )
    );

    it.effect("advertised native capability permits a bounded attempt while unverified policy holds inference", () =>
      fixture((store) =>
        Effect.gen(function* () {
          const previous = yield* binding("b", 2);
          yield* store.register(
            EndpointBinding.make({
              ...previous,
              capabilityEvidence: [
                {
                  capability: "send",
                  disposition: "advertised",
                  source: "synthetic native handshake",
                  observedAt: 100,
                },
              ],
            })
          );
          yield* store.accept(envelope("advertised"), 100);
          const claim = O.getOrThrow(yield* store.claimNext("b", "b-owner", 101, 201));
          yield* store.complete(claim, "failed", 102);
          const next = yield* binding("b", 3);
          yield* store.register(
            EndpointBinding.make({ ...next, policy: { ...next.policy, policyEvidence: "unverified" } })
          );
          expect((yield* Effect.flip(store.accept(envelope("unverified"), 103))).code).toBe("unsupported");
        })
      )
    );

    it.effect("scoped reads and atomic ACK reject revoked grants and previous generations", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.registerGrant(
            LaunchGrant.make({
              ...grant(),
              grantId: "grant-b-old",
              endpointId: "b",
              ownerId: "b-owner",
              allowedRecipients: ["a"],
            })
          );
          yield* store.accept(envelope("previous"), 100);
          const claim = O.getOrThrow(yield* store.claimNext("b", "b-owner", 101, 201));
          yield* store.complete(claim, "delivered", 102);
          yield* store.acknowledge("previous", "b", 102);
          yield* store.register(yield* binding("b", 2));
          yield* store.registerGrant(
            LaunchGrant.make({
              ...grant(),
              grantId: "grant-b-new",
              endpointId: "b",
              ownerId: "b-owner",
              generation: 2,
              allowedRecipients: ["a"],
            })
          );
          expect((yield* Effect.flip(store.scopedInbox("grant-b-old", 103))).code).toBe("invalidGrant");
          expect(yield* store.scopedInbox("grant-b-new", 103)).toHaveLength(0);
          expect((yield* Effect.flip(store.scopedReceipts("previous", "grant-b-new", 103))).code).toBe("invalidGrant");
          yield* store.accept(envelope("current"), 104);
          yield* store.claimNext("b", "b-owner", 105, 205);
          expect((yield* Effect.flip(store.acknowledge("current", "b", 106, O.some("grant-b-old")))).code).toBe(
            "invalidGrant"
          );
          expect((yield* store.acknowledge("current", "b", 106, O.some("grant-b-new"))).status).toBe("acknowledged");
          expect(yield* store.scopedReceipts("current", "grant-b-new", 107)).toHaveLength(3);
          yield* store.register(yield* binding("a", 2));
          yield* store.registerGrant(LaunchGrant.make({ ...grant(), grantId: "grant-a-new", generation: 2 }));
          expect((yield* Effect.flip(store.acceptWithGrant(envelope("previous"), "grant-a-new", 107))).code).toBe(
            "conflict"
          );
          expect((yield* Effect.flip(store.scopedReceipts("previous", "grant-a-new", 107))).code).toBe("invalidGrant");
          expect(A.map(yield* store.scopedEndpoints("grant-a-new", 107), (endpoint) => endpoint.endpointId)).toEqual([
            "b",
          ]);
        })
      )
    );

    it.effect("replies retain both original direct generations instead of moving to a successor", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("original"), 100);
          yield* store.register(yield* binding("a", 2));
          expect(
            (yield* Effect.flip(
              store.accept(Envelope.make({ ...envelope("reply", "b", "a"), replyTo: O.some("original") }), 101)
            )).code
          ).toBe("conflict");
          expect(yield* store.inbox("a")).toHaveLength(0);
        })
      )
    );

    it.effect("unknown future schema refuses initialization without changing its version rows", () =>
      fixture((_store, filename) =>
        Effect.gen(function* () {
          const client = yield* makeAgentMessageSqliteClient(filename);
          yield* client`DROP TABLE agent_message_meta`;
          yield* client`CREATE TABLE agent_message_meta (version INTEGER PRIMARY KEY)`;
          yield* client`INSERT INTO agent_message_meta (version) VALUES (2)`;
          expect(
            (yield* Effect.flip(makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client)))).code
          ).toBe("storage");
          expect(yield* client`SELECT version FROM agent_message_meta`).toEqual([{ version: 2 }]);
        })
      )
    );

    it.effect("settled acknowledged completion cannot re-arm a hold and poison the next dispatch", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("settled"), 100);
          yield* store.accept(envelope("after-settled"), 100);
          const claim = O.getOrThrow(yield* store.claimNext("b", "b-owner", 101, 201));
          yield* store.acknowledge("settled", "b", 102);
          yield* store.complete(claim, "delivered", 103);
          expect((yield* Effect.flip(store.complete(claim, "ambiguous", 104))).code).toBe("staleClaim");
          expect(O.getOrThrow(yield* store.claimNext("b", "b-owner", 105, 205)).envelope.messageId).toBe(
            "after-settled"
          );
          expect(yield* store.receipts("settled")).toHaveLength(3);
        })
      )
    );

    it.effect("replacement waits for original delivered-mail ACK before activating a successor", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("old-delivered", "a", "b", 110), 100);
          const claim = O.getOrThrow(yield* store.claimNext("b", "b-owner", 101, 201));
          yield* store.complete(claim, "delivered", 102);
          expect((yield* Effect.flip(store.register(yield* binding("b", 2)))).code).toBe("staleClaim");
          yield* store.acknowledge("old-delivered", "b", 103);
          yield* store.register(yield* binding("b", 2));
          yield* store.accept(envelope("successor"), 104);
          expect(yield* store.recover(110)).toBe(0);
          expect(O.getOrThrow(yield* store.claimNext("b", "b-owner", 111, 211)).envelope.messageId).toBe("successor");
        })
      )
    );

    it.effect("participant ACK does not release an externally ambiguous active dispatch", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("ack-uncertain"), 100);
          yield* store.accept(envelope("followup"), 100);
          const claim = O.getOrThrow(yield* store.claimNext("b", "b-owner", 101, 201));
          yield* store.acknowledge("ack-uncertain", "b", 102);
          expect((yield* store.complete(claim, "ambiguous", 103)).status).toBe("ambiguous");
          assertNone(yield* store.claimNext("b", "b-owner", 104, 204));
          expect((yield* Effect.flip(store.register(yield* binding("b", 2)))).code).toBe("staleClaim");
          expect(A.map(yield* store.receipts("ack-uncertain"), (receipt) => receipt.status)).toEqual([
            "accepted",
            "claimed",
            "acknowledged",
            "ambiguous",
          ]);
          const uncertain = O.getOrThrow(A.last(yield* store.receipts("ack-uncertain")));
          expect(O.getOrNull(uncertain.owner)).toBe("b-owner");
          expect(O.getOrNull(uncertain.detail)).toContain("Reconcile the original session");
          expect((yield* store.acknowledge("ack-uncertain", "b", 204)).status).toBe("acknowledged");
          expect((yield* store.complete(claim, "delivered", 205)).status).toBe("delivered");
          expect(O.getOrThrow(yield* store.claimNext("b", "b-owner", 206, 306)).envelope.messageId).toBe("followup");
        })
      )
    );

    it.effect(
      "lease recovery exposes an acknowledged attempt's native hold and permits exact known reconciliation",
      () =>
        fixture((store) =>
          Effect.gen(function* () {
            yield* store.accept(envelope("ack-recovery"), 100);
            yield* store.accept(envelope("after-recovery"), 100);
            const claim = O.getOrThrow(yield* store.claimNext("b", "b-owner", 101, 201));
            const acknowledged = yield* store.acknowledge("ack-recovery", "b", 102);
            expect(yield* store.recover(201)).toBe(1);
            expect(yield* store.recover(202)).toBe(0);
            const held = O.getOrThrow(A.last(yield* store.receipts("ack-recovery")));
            expect(held.status).toBe("ambiguous");
            assertSome(held.owner, "b-owner");
            expect(O.getOrNull(held.detail)).toContain("reconciliation");
            expect((yield* store.acknowledge("ack-recovery", "b", 203)).sequence).toBe(acknowledged.sequence);
            assertNone(yield* store.claimNext("b", "b-owner", 203, 303));
            expect((yield* store.complete(claim, "delivered", 204)).status).toBe("delivered");
            assertSome(
              O.map(yield* store.claimNext("b", "b-owner", 205, 305), (next) => next.envelope.messageId),
              "after-recovery"
            );
          })
        )
    );

    it.effect(
      "a consumed request with dropped ACK survives restart as owned ambiguity without repeating mutation",
      () =>
        fixture((store, filename) =>
          Effect.gen(function* () {
            let consumed = 0;
            const router = yield* makeAgentMessageRouter.pipe(
              Effect.provideService(AgentMessageStore, store),
              Effect.provideService(EndpointDispatch, {
                submit: () =>
                  Effect.sync(() => {
                    consumed += 1;
                    return "delivered";
                  }),
              })
            );
            const request = envelope("drop-ack", "a", "b", 110);
            const accepted = yield* router.accept(request, 100);
            expect((yield* router.accept(request, 100)).sequence).toBe(accepted.sequence);
            yield* router.dispatchOne("b", "b-owner", 101, 201, () => Effect.succeed(102));
            const client = yield* makeAgentMessageSqliteClient(filename);
            const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
            expect(yield* reopened.recover(110)).toBe(1);
            const latest = O.getOrThrow(A.last(yield* reopened.receipts("drop-ack")));
            expect(latest.status).toBe("ambiguous");
            expect(latest.attemptGeneration).toBe(1);
            expect(O.getOrNull(latest.owner)).toBe("b-owner");
            expect(O.getOrNull(latest.detail)).toContain("reconcile the original session");
            assertNone(yield* reopened.claimNext("b", "b-owner", 111, 211));
            expect(consumed).toBe(1);
          })
        )
    );

    it.effect(
      "operator resolution is immutable, replayable after reopening and replacement, and retains its audit",
      () =>
        fixture((store, filename) =>
          Effect.gen(function* () {
            yield* store.accept(envelope("resolve-failed"), 100);
            yield* store.claimNext("b", "b-owner", 101, 201);
            yield* store.recover(201);
            const request = AmbiguityResolution.make({
              resolutionId: "decision-1",
              messageId: "resolve-failed",
              endpointId: "b",
              endpointGeneration: 1,
              attemptGeneration: 1,
              attemptOwnerId: "b-owner",
              operatorId: "fixture-operator",
              disposition: "failed",
              evidence: "Fixture original native attempt returned failure",
              reason: "Known terminal outcome confirmed",
            });
            const receipt = yield* store.resolveAmbiguity(request, 202);
            expect(receipt.status).toBe("failed");
            expect(receipt.attemptGeneration).toBe(1);
            assertSome(receipt.owner, "b-owner");
            expect(O.getOrNull(receipt.detail)).toContain("fixture-operator");
            expect(O.getOrNull(receipt.detail)).toContain(request.evidence);
            expect(yield* store.resolveAmbiguity(request, 203)).toEqual(receipt);
            expect(
              (yield* Effect.flip(
                store.resolveAmbiguity(AmbiguityResolution.make({ ...request, reason: "changed" }), 203)
              )).code
            ).toBe("conflict");
            expect(
              (yield* Effect.flip(
                store.resolveAmbiguity(AmbiguityResolution.make({ ...request, resolutionId: "decision-2" }), 203)
              )).code
            ).toBe("conflict");
            const client = yield* makeAgentMessageSqliteClient(filename);
            const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
            yield* reopened.register(yield* binding("b", 2));
            expect(yield* reopened.resolveAmbiguity(request, 300)).toEqual(receipt);
            expect(A.map(yield* reopened.receipts(request.messageId), (row) => row.status)).toEqual([
              "accepted",
              "claimed",
              "ambiguous",
              "failed",
            ]);
            const audit = yield* client`SELECT payload, decided_at, receipt_sequence FROM agent_message_resolutions`;
            expect(audit).toHaveLength(1);
            const rows = yield* decodeResolutionAuditRows(audit);
            const persisted = O.getOrThrow(A.head(rows));
            expect(persisted.decided_at).toBe(202);
            expect(persisted.receipt_sequence).toBe(receipt.sequence);
            expect(yield* decodeAmbiguityResolutionJson(persisted.payload)).toEqual(request);
          })
        )
    );

    it.effect("resolution validates every attempt fence and rejects nonambiguous and malformed assertions", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("fenced-resolution"), 100);
          const request = AmbiguityResolution.make({
            resolutionId: "fenced",
            messageId: "fenced-resolution",
            endpointId: "b",
            endpointGeneration: 1,
            attemptGeneration: 1,
            attemptOwnerId: "b-owner",
            operatorId: "fixture-operator",
            disposition: "delivered",
            evidence: "Fixture original session terminal result",
            reason: "Known result verified",
          });
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 101))).code).toBe("staleClaim");
          yield* store.claimNext("b", "b-owner", 101, 201);
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 102))).code).toBe("conflict");
          yield* store.recover(201);
          const invalid = [
            AmbiguityResolution.make({ ...request, endpointId: "a" }),
            AmbiguityResolution.make({ ...request, endpointGeneration: 2 }),
            AmbiguityResolution.make({ ...request, attemptGeneration: 2 }),
            AmbiguityResolution.make({ ...request, attemptOwnerId: "other-owner" }),
          ];
          const errors = yield* Effect.forEach(invalid, (decision) =>
            Effect.flip(store.resolveAmbiguity(decision, 202))
          );
          expect(A.map(errors, (failure) => failure.code)).toEqual([
            "conflict",
            "staleClaim",
            "staleClaim",
            "staleClaim",
          ]);
          expect(S.is(AmbiguityResolution)({ ...request, evidence: "" })).toBe(false);
          expect(S.is(AmbiguityResolution)({ ...request, reason: "" })).toBe(false);
          expect(S.is(AmbiguityResolution)({ ...request, disposition: "abandoned" })).toBe(false);
          expect(yield* store.receipts(request.messageId)).toHaveLength(3);
          const receipt = yield* store.resolveAmbiguity(request, 203);
          expect(receipt.status).toBe("delivered");
          yield* store.acknowledge(request.messageId, "b", 204);
          yield* store.register(yield* binding("b", 2));
          expect(yield* store.resolveAmbiguity(request, 205)).toEqual(receipt);
        })
      )
    );

    it.effect(
      "operator resolution releases ACK native hold while preserving original acknowledgement and successor ordering",
      () =>
        fixture((store) =>
          Effect.gen(function* () {
            yield* store.accept(envelope("resolved-ack"), 100);
            yield* store.accept(envelope("resolution-successor"), 100);
            yield* store.claimNext("b", "b-owner", 101, 201);
            const acknowledged = yield* store.acknowledge("resolved-ack", "b", 102);
            yield* store.recover(201);
            const request = AmbiguityResolution.make({
              resolutionId: "ack-decision",
              messageId: "resolved-ack",
              endpointId: "b",
              endpointGeneration: 1,
              attemptGeneration: 1,
              attemptOwnerId: "b-owner",
              operatorId: "fixture-operator",
              disposition: "failed",
              evidence: "Fixture known native failure despite consumption ACK",
              reason: "Release original terminal native hold",
            });
            yield* store.resolveAmbiguity(request, 202);
            expect(yield* store.acknowledge("resolved-ack", "b", 203)).toEqual(acknowledged);
            expect(A.map(yield* store.receipts("resolved-ack"), (row) => row.status)).toEqual([
              "accepted",
              "claimed",
              "acknowledged",
              "ambiguous",
              "failed",
            ]);
            assertSome(
              O.map(yield* store.claimNext("b", "b-owner", 204, 304), (claim) => claim.envelope.messageId),
              "resolution-successor"
            );
          })
        )
    );

    it.effect("concurrent operator decisions append one immutable terminal receipt", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("race-resolution"), 100);
          yield* store.claimNext("b", "b-owner", 101, 201);
          yield* store.recover(201);
          const request = AmbiguityResolution.make({
            resolutionId: "race-1",
            messageId: "race-resolution",
            endpointId: "b",
            endpointGeneration: 1,
            attemptGeneration: 1,
            attemptOwnerId: "b-owner",
            operatorId: "fixture-operator",
            disposition: "failed",
            evidence: "Fixture known terminal result",
            reason: "Confirmed original attempt",
          });
          const client = yield* makeAgentMessageSqliteClient(filename);
          const contender = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
          const outcomes = yield* Effect.all(
            [
              Effect.result(store.resolveAmbiguity(request, 202)),
              Effect.result(
                contender.resolveAmbiguity(AmbiguityResolution.make({ ...request, resolutionId: "race-2" }), 203)
              ),
            ],
            { concurrency: 2 }
          );
          expect(A.filter(outcomes, Result.isSuccess)).toHaveLength(1);
          expect(A.map(A.filter(outcomes, Result.isFailure), (outcome) => outcome.failure.code)).toEqual(["conflict"]);
          expect(yield* store.receipts(request.messageId)).toHaveLength(4);
          const rows = yield* client`SELECT count(*) AS count FROM agent_message_resolutions`;
          expect(rows).toEqual([{ count: 1 }]);
        })
      )
    );

    it.effect("failed operator assertion cannot contradict confirmed delivery for the original attempt", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("confirmed-delivery-resolution", "a", "b", 110), 100);
          const claim = O.getOrThrow(yield* store.claimNext("b", "b-owner", 101, 201));
          yield* store.complete(claim, "delivered", 102);
          expect(yield* store.recover(110)).toBe(1);
          const before = yield* store.receipts(claim.envelope.messageId);
          const request = AmbiguityResolution.make({
            resolutionId: "confirmed-delivery-decision",
            messageId: claim.envelope.messageId,
            endpointId: "b",
            endpointGeneration: 1,
            attemptGeneration: claim.generation,
            attemptOwnerId: claim.ownerId,
            operatorId: "fixture-operator",
            disposition: "failed",
            evidence: "Fixture operator assertion conflicting with stored delivery",
            reason: "Reject contradictory assertion",
          });
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 111))).code).toBe("conflict");
          expect(yield* store.receipts(request.messageId)).toEqual(before);
          const client = yield* makeAgentMessageSqliteClient(filename);
          expect(
            yield* client`SELECT state, dispatch_active, attempt_generation FROM agent_messages WHERE id = ${request.messageId}`
          ).toEqual([{ state: "ambiguous", dispatch_active: 0, attempt_generation: 1 }]);
          expect(
            yield* client`SELECT count(*) AS count FROM agent_message_resolutions WHERE message_id = ${request.messageId}`
          ).toEqual([{ count: 0 }]);
          const delivered = AmbiguityResolution.make({
            ...request,
            disposition: "delivered",
            evidence: "Stored fixture original attempt terminal delivery",
            reason: "Confirm known terminal result",
          });
          const resolved = yield* store.resolveAmbiguity(delivered, 112);
          expect(resolved.status).toBe("delivered");
          expect(yield* store.resolveAmbiguity(delivered, 113)).toEqual(resolved);
          expect(yield* store.receipts(request.messageId)).toHaveLength(A.length(before) + 1);
          expect(
            yield* client`SELECT count(*) AS count FROM agent_message_resolutions WHERE message_id = ${request.messageId}`
          ).toEqual([{ count: 1 }]);
          expect(yield* store.recover(114)).toBe(0);
        })
      )
    );

    it.effect(
      "audited delivered resolution remains terminal after TTL recovery and still accepts participant ACK",
      () =>
        fixture((store, filename) =>
          Effect.gen(function* () {
            yield* store.accept(envelope("resolved-expired-delivery", "a", "b", 110), 100);
            yield* store.claimNext("b", "b-owner", 101, 201);
            expect(yield* store.recover(201)).toBe(1);
            const request = AmbiguityResolution.make({
              resolutionId: "expired-delivery-decision",
              messageId: "resolved-expired-delivery",
              endpointId: "b",
              endpointGeneration: 1,
              attemptGeneration: 1,
              attemptOwnerId: "b-owner",
              operatorId: "fixture-operator",
              disposition: "delivered",
              evidence: "Fixture original native attempt confirmed terminal delivery",
              reason: "Known result verified after TTL",
            });
            const resolved = yield* store.resolveAmbiguity(request, 202);
            expect(yield* store.recover(203)).toBe(0);
            expect(yield* store.recover(204)).toBe(0);
            yield* store.accept(envelope("after-expired-resolution", "a", "b", 300), 204);
            const successor = O.getOrThrow(yield* store.claimNext("b", "b-owner", 205, 305));
            expect(successor.envelope.messageId).toBe("after-expired-resolution");
            expect((yield* store.acknowledge(request.messageId, "b", 206)).status).toBe("acknowledged");
            expect(yield* store.resolveAmbiguity(request, 207)).toEqual(resolved);
            expect(A.map(yield* store.receipts(request.messageId), (receipt) => receipt.status)).toEqual([
              "accepted",
              "claimed",
              "ambiguous",
              "delivered",
              "acknowledged",
            ]);
            const client = yield* makeAgentMessageSqliteClient(filename);
            expect(
              yield* client`SELECT count(*) AS count FROM agent_message_resolutions WHERE message_id = ${request.messageId}`
            ).toEqual([{ count: 1 }]);
            expect(
              yield* client`SELECT state, dispatch_active, attempt_generation FROM agent_messages WHERE id = ${request.messageId}`
            ).toEqual([{ state: "acknowledged", dispatch_active: 0, attempt_generation: 1 }]);
            yield* store.complete(successor, "delivered", 208);
            expect(yield* store.recover(300)).toBe(1);
            expect(O.getOrThrow(A.last(yield* store.receipts(successor.envelope.messageId))).status).toBe("ambiguous");
          })
        )
    );

    it.effect("committed resolution survives process kill and replay returns the same original receipt", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("crash-resolution"), 100);
          yield* store.claimNext("b", "b-owner", 101, 201);
          yield* store.recover(201);
          const request = AmbiguityResolution.make({
            resolutionId: "crash-decision",
            messageId: "crash-resolution",
            endpointId: "b",
            endpointGeneration: 1,
            attemptGeneration: 1,
            attemptOwnerId: "b-owner",
            operatorId: "fixture-operator",
            disposition: "failed",
            evidence: "Synthetic owned attempt terminal failure",
            reason: "Fixture confirms known result",
          });
          const process = yield* processFixture(filename, "resolve", "resolution-checkpoint", O.some(request));
          const committed = yield* decodeReceiptJson(yield* process.wait);
          yield* process.child.kill({ killSignal: "SIGKILL" });
          const client = yield* makeAgentMessageSqliteClient(filename);
          const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
          expect(yield* reopened.resolveAmbiguity(request, 300)).toEqual(committed);
          expect(yield* reopened.receipts(request.messageId)).toHaveLength(4);
          expect(yield* client`SELECT count(*) AS count FROM agent_message_resolutions`).toEqual([{ count: 1 }]);
          expect(
            yield* client`SELECT state, dispatch_active, attempt_generation FROM agent_messages WHERE id = ${request.messageId}`
          ).toEqual([{ state: "failed", dispatch_active: 0, attempt_generation: 1 }]);
        })
      )
    );

    it.effect("resolution audit insertion failure rolls back the hold and receipt before reopening", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("atomic-resolution"), 100);
          yield* store.claimNext("b", "b-owner", 101, 201);
          yield* store.recover(201);
          const request = AmbiguityResolution.make({
            resolutionId: "atomic-1",
            messageId: "atomic-resolution",
            endpointId: "b",
            endpointGeneration: 1,
            attemptGeneration: 1,
            attemptOwnerId: "b-owner",
            operatorId: "fixture-operator",
            disposition: "failed",
            evidence: "Fixture known native terminal failure",
            reason: "Verified original attempt",
          });
          const client = yield* makeAgentMessageSqliteClient(filename);
          yield* client`CREATE TRIGGER fixture_resolution_abort BEFORE INSERT ON agent_message_resolutions BEGIN SELECT RAISE(ABORT, 'fixture audit abort'); END`;
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 202))).code).toBe("storage");
          expect(yield* store.receipts(request.messageId)).toHaveLength(3);
          assertNone(yield* store.claimNext("b", "b-owner", 203, 303));
          expect(yield* client`SELECT count(*) AS count FROM agent_message_resolutions`).toEqual([{ count: 0 }]);
          expect(
            yield* client`SELECT state, dispatch_active, attempt_generation FROM agent_messages WHERE id = ${request.messageId}`
          ).toEqual([{ state: "ambiguous", dispatch_active: 2, attempt_generation: 1 }]);
          yield* client`DROP TRIGGER fixture_resolution_abort`;
          const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
          const receipt = yield* reopened.resolveAmbiguity(request, 204);
          expect(yield* store.resolveAmbiguity(request, 205)).toEqual(receipt);
          expect(yield* store.receipts(request.messageId)).toHaveLength(4);
        })
      )
    );

    it.effect("resolution checks persisted and current endpoint generations independently", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("generation-resolution"), 100);
          yield* store.claimNext("b", "b-owner", 101, 201);
          yield* store.recover(201);
          const request = AmbiguityResolution.make({
            resolutionId: "generation-1",
            messageId: "generation-resolution",
            endpointId: "b",
            endpointGeneration: 1,
            attemptGeneration: 1,
            attemptOwnerId: "b-owner",
            operatorId: "fixture-operator",
            disposition: "failed",
            evidence: "Fixture native failure",
            reason: "Fixture known result",
          });
          const client = yield* makeAgentMessageSqliteClient(filename);
          yield* client`UPDATE agent_messages SET target_generation = 2 WHERE id = ${request.messageId}`;
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 202))).code).toBe("staleClaim");
          yield* client`UPDATE agent_messages SET target_generation = 1 WHERE id = ${request.messageId}`;
          const replacement = yield* encodeEndpointBindingJson(yield* binding("b", 2));
          yield* client`UPDATE agent_message_endpoints SET payload = ${replacement} WHERE id = 'b'`;
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 203))).code).toBe("staleClaim");
          expect(yield* store.receipts(request.messageId)).toHaveLength(3);
        })
      )
    );

    it.effect("endpoint capacity retains delivered ambiguity and acknowledged native holds", () =>
      fixture(
        (store) =>
          Effect.gen(function* () {
            yield* store.accept(envelope("retained-cap", "a", "b", 110), 100);
            const claim = O.getOrThrow(yield* store.claimNext("b", "b-owner", 101, 201));
            expect((yield* Effect.flip(store.accept(envelope("claimed-cap"), 102))).code).toBe("queueFull");
            yield* store.complete(claim, "delivered", 103);
            expect((yield* Effect.flip(store.accept(envelope("delivered-cap"), 104))).code).toBe("queueFull");
            yield* store.recover(110);
            expect((yield* Effect.flip(store.accept(envelope("ambiguous-cap"), 111))).code).toBe("queueFull");
            yield* store.resolveAmbiguity(
              AmbiguityResolution.make({
                resolutionId: "retained-decision",
                messageId: "retained-cap",
                endpointId: "b",
                endpointGeneration: 1,
                attemptGeneration: 1,
                attemptOwnerId: "b-owner",
                operatorId: "fixture-operator",
                disposition: "delivered",
                evidence: "Fixture confirmed terminal delivery",
                reason: "Known fixture result",
              }),
              112
            );
            yield* store.acknowledge("retained-cap", "b", 112);
            yield* store.accept(envelope("ack-cap"), 113);
            yield* store.claimNext("b", "b-owner", 114, 214);
            yield* store.acknowledge("ack-cap", "b", 115);
            expect((yield* Effect.flip(store.accept(envelope("ack-hold-cap"), 116))).code).toBe("queueFull");
            yield* store.recover(214);
            expect((yield* Effect.flip(store.accept(envelope("ack-ambiguous-cap"), 215))).code).toBe("queueFull");
          }),
        10,
        1
      )
    );

    it.effect("endpoint capacity leaves another endpoint room without spending rejected grant budget", () =>
      fixture(
        (store) =>
          Effect.gen(function* () {
            yield* store.register(yield* binding("c"));
            yield* store.registerGrant(grant(1));
            const accepted = yield* store.accept(envelope("endpoint-full"), 100);
            expect(yield* store.accept(envelope("endpoint-full"), 101)).toEqual(accepted);
            expect((yield* Effect.flip(store.acceptWithGrant(envelope("rejected-budget"), "grant-a", 101))).code).toBe(
              "queueFull"
            );
            yield* store.accept(envelope("other-endpoint", "a", "c"), 101);
            const claim = O.getOrThrow(yield* store.claimNext("b", "b-owner", 102, 202));
            yield* store.complete(claim, "failed", 103);
            expect((yield* store.acceptWithGrant(envelope("available-budget"), "grant-a", 104)).status).toBe(
              "accepted"
            );
            expect((yield* Effect.flip(store.accept(envelope("still-full"), 105))).code).toBe("queueFull");
          }),
        3,
        1
      )
    );

    it.effect("global capacity smaller than endpoint limit still wins and limits validate separately", () =>
      fixture(
        (store, filename) =>
          Effect.gen(function* () {
            yield* store.register(yield* binding("c"));
            yield* store.accept(envelope("global-full"), 100);
            expect((yield* Effect.flip(store.accept(envelope("other-global", "a", "c"), 101))).code).toBe("queueFull");
            const client = yield* makeAgentMessageSqliteClient(filename);
            // `make` validates, so the invalid per-endpoint limit is built with checks
            // disabled: the store's own decode must reject it.
            const invalidLimits = AgentMessageStoreLimits.make(
              { maxPending: 1, maxPendingPerEndpoint: 0 },
              { disableChecks: true }
            );
            expect(
              (yield* Effect.flip(
                makeAgentMessageStore(invalidLimits).pipe(Effect.provideService(SqlClient.SqlClient, client))
              )).code
            ).toBe("storage");
          }),
        1,
        10
      )
    );

    it.effect("subscriptions resume from durable receipt cursor on a reopened connection", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          const accepted = yield* store.accept(envelope("watch"), 100);
          const initial = yield* store.subscribe("watch").pipe(Stream.take(1), Stream.runCollect, TestClock.withLive);
          expect(A.map(initial, (receipt) => receipt.sequence)).toEqual([accepted.sequence]);
          yield* store.claimNext("b", "b-owner", 101, 201);
          const client = yield* makeAgentMessageSqliteClient(filename);
          const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
          const next = yield* reopened
            .subscribe("watch", accepted.sequence)
            .pipe(Stream.take(1), Stream.runCollect, TestClock.withLive);
          expect(A.map(next, (receipt) => receipt.status)).toEqual(["claimed"]);
          expect(next[0]?.sequence).toBeGreaterThan(accepted.sequence);
        })
      )
    );

    it.effect("storage diagnostics expose typed classification without stored payload or SQL text", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          const client = yield* makeAgentMessageSqliteClient(filename);
          yield* client`UPDATE agent_message_endpoints SET payload = ${"secret-synthetic-invalid-json"} WHERE id = 'a'`;
          const decode = yield* Effect.flip(store.endpoint("a"));
          expect(decode.code).toBe("storage");
          expect(decode.message).toBe("Agent message storage decoding failed: SchemaError.");
          expect(decode.message).not.toContain("secret");
          yield* client`DROP TABLE agent_message_receipts`;
          const sql = yield* Effect.flip(store.receipts("unknown"));
          expect(sql.code).toBe("storage");
          expect(sql.message).toMatch(/^Agent message SQL operation failed: [A-Za-z]+\.$/);
          expect(sql.message).not.toContain("agent_message_receipts");
        })
      )
    );

    it.effect("conversation grants fence send, reads and ACK without resetting a spent budget", () =>
      fixture((store) =>
        Effect.gen(function* () {
          const scoped = LaunchGrant.make({ ...grant(), conversationScope: O.some("fixture-conversation") });
          yield* store.registerGrant(scoped);
          const other = Envelope.make({ ...envelope("other-task"), conversationId: "other-conversation" });
          expect((yield* Effect.flip(store.acceptWithGrant(other, scoped.grantId, 100))).code).toBe("invalidGrant");
          yield* store.acceptWithGrant(envelope("scoped-task"), scoped.grantId, 100);
          expect(
            (yield* Effect.flip(store.registerGrant(LaunchGrant.make({ ...scoped, conversationScope: O.none() })))).code
          ).toBe("conflict");
          yield* store.registerGrant(scoped);
          expect((yield* Effect.flip(store.acceptWithGrant(envelope("budget"), scoped.grantId, 101))).code).toBe(
            "invalidGrant"
          );
          yield* store.accept(other, 100);
          yield* store.registerGrant(
            LaunchGrant.make({
              ...scoped,
              grantId: "scoped-b",
              endpointId: "b",
              ownerId: "b-owner",
              allowedRecipients: ["a"],
            })
          );
          expect(A.map(yield* store.scopedInbox("scoped-b", 101), (mail) => mail.messageId)).toEqual(["scoped-task"]);
          expect((yield* Effect.flip(store.scopedReceipts("other-task", "scoped-b", 101))).code).toBe("invalidGrant");
          const claim = O.getOrThrow(yield* store.claimNext("b", "b-owner", 101, 201));
          yield* store.complete(claim, "delivered", 102);
          const second = O.getOrThrow(yield* store.claimNext("b", "b-owner", 103, 203));
          expect(second.envelope.messageId).toBe("other-task");
          expect((yield* Effect.flip(store.acknowledge("other-task", "b", 104, O.some("scoped-b")))).code).toBe(
            "invalidGrant"
          );
        })
      )
    );

    it.effect("stopped-writer private backup and restored database retain pending mail and budgets", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* Config.String("HOME");
        const cache = path.join(home, ".cache", "beep", "agent-message-tests");
        yield* fs.makeDirectory(cache, { recursive: true, mode: 0o700 });
        const directory = yield* fs.makeTempDirectoryScoped({ directory: cache, prefix: "reversal-" });
        const filename = path.join(directory, "original.sqlite");
        yield* Effect.scoped(
          Effect.gen(function* () {
            const client = yield* makeAgentMessageSqliteClient(filename);
            const store = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
            yield* store.register(yield* binding("a"));
            yield* store.register(yield* binding("b"));
            yield* store.registerGrant(grant());
            yield* store.acceptWithGrant(envelope("pending-backup"), "grant-a", 100);
          })
        );
        // The nested SQL scope has closed: no writer is active while these bytes are copied.
        const backup = path.join(directory, "backup");
        const restored = path.join(directory, "restored");
        yield* fs.makeDirectory(backup, { mode: 0o700 });
        yield* fs.makeDirectory(restored, { mode: 0o700 });
        yield* Effect.forEach(["", "-wal", "-shm"], (suffix) =>
          Effect.gen(function* () {
            const original = `${filename}${suffix}`;
            if (yield* fs.exists(original)) {
              const destination = path.join(backup, `messages.sqlite${suffix}`);
              yield* fs.copyFile(original, destination);
              yield* fs.chmod(destination, 0o600);
              yield* fs.copyFile(destination, path.join(restored, `messages.sqlite${suffix}`));
              yield* fs.chmod(path.join(restored, `messages.sqlite${suffix}`), 0o600);
            }
          })
        );
        const client = yield* makeAgentMessageSqliteClient(path.join(restored, "messages.sqlite"));
        const store = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
        expect(A.map(yield* store.inbox("b"), (message) => message.messageId)).toEqual(["pending-backup"]);
        expect((yield* store.acceptWithGrant(envelope("pending-backup"), "grant-a", 101)).status).toBe("accepted");
        expect((yield* Effect.flip(store.acceptWithGrant(envelope("budget-still-spent"), "grant-a", 102))).code).toBe(
          "invalidGrant"
        );
        expect(yield* store.receipts("pending-backup")).toHaveLength(1);
        expect((yield* fs.stat(backup)).mode & 0o077).toBe(0);
        expect((yield* fs.stat(path.join(backup, "messages.sqlite"))).mode & 0o077).toBe(0);
      })
    );
  }
);
