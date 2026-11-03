import * as NodeURL from "node:url";
import { $RepoCliId } from "@beep/identity/packages";
import {
  AgentMessageStore,
  AgentMessageStoreLimits,
  AmbiguityResolution,
  Claim,
  EndpointBinding,
  EndpointDispatch,
  Envelope,
  LaunchGrant,
  makeAgentMessageRouter,
  makeAgentMessageSqliteClient,
  makeAgentMessageStore,
  OriginalRuntimeEvidence,
  PolicySnapshot,
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

const $I = $RepoCliId.create("test/agent-message-store");
const EnvelopeJson = S.fromJsonString(Envelope);
const ResolutionJson = S.fromJsonString(AmbiguityResolution);
const ReceiptJson = S.fromJsonString(Receipt);
const BindingJson = S.fromJsonString(EndpointBinding);
const ResolutionAuditRows = S.Array(
  S.Struct({ payload: S.String, decided_at: S.Natural, receipt_sequence: S.Natural })
).pipe(
  $I.annoteSchema("ResolutionAuditRows", {
    description:
      "Fixture audit rows retaining canonical resolution payload, original decision time and receipt sequence.",
  })
);

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
// Represents the original trusted adapter settlement in synthetic-only fixtures.
const persistSettlement = Effect.fn("persistSettlement")(function* (
  store: AgentMessageStoreShape,
  request: AmbiguityResolution
) {
  yield* store.recordSettlement(
    Claim.make({
      envelope: yield* store.message(request.messageId),
      ownerId: request.attemptOwnerId,
      generation: request.attemptGeneration,
      leaseUntil: 201,
    }),
    request.runtimeEvidence,
    202
  );
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
  maxPendingPerEndpoint = 100,
  maxStoredMessages = 100000
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* Config.String("HOME");
  const cache = path.join(home, ".cache", "beep", "agent-message-tests");
  yield* fs.makeDirectory(cache, { recursive: true, mode: 0o700 });
  const directory = yield* fs.makeTempDirectoryScoped({ directory: cache, prefix: "store-" });
  const filename = path.join(directory, "messages.sqlite");
  const client = yield* makeAgentMessageSqliteClient(filename, "50 millis");
  const store = yield* makeAgentMessageStore(
    AgentMessageStoreLimits.make({ maxPending, maxPendingPerEndpoint, maxStoredMessages })
  ).pipe(Effect.provideService(SqlClient.SqlClient, client));
  const binding1 = yield* binding("a");
  yield* store.register(binding1);
  const binding2 = yield* binding("b");
  yield* store.register(binding2);
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
    onSome: S.encodeEffect(ResolutionJson),
  });
  yield* fs.writeFileString(input, payload, {
    mode: 0o600,
  });
  const child = yield* ChildProcess.make(
    process.execPath,
    [NodeURL.fileURLToPath(new URL("./fixtures/agent-message/process.ts", import.meta.url))],
    {
      env: {
        BEEP_MESSAGE_FIXTURE_DATABASE: filename,
        BEEP_MESSAGE_FIXTURE_CHECKPOINT: checkpoint,
        BEEP_MESSAGE_FIXTURE_STAGE: stage,
        BEEP_MESSAGE_FIXTURE_ENVELOPE: input,
      },
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
    }
  );
  const waitFor = (suffix = "") =>
    Effect.gen(function* () {
      while (!(yield* fs.exists(`${checkpoint}${suffix}`))) {
        yield* Effect.sleep("10 millis");
      }
      return yield* fs.readFileString(`${checkpoint}${suffix}`);
    }).pipe(
      Effect.raceFirst(
        child.exitCode.pipe(
          Effect.flatMap((code) =>
            RouterError.make({
              code: "storage",
              message: `Fixture exited before checkpoint ${markerName}${suffix}: ${code}`,
            })
          )
        )
      ),
      Effect.timeout("10 seconds"),
      TestClock.withLive
    );
  return { child, wait: waitFor(), waitFor };
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
          for (const message of [
            Envelope.make({ ...envelope("wrong-policy"), policyFingerprint: "different-policy" }),
            Envelope.make({ ...envelope("wrong-capability"), capabilityFingerprint: "different-capability" }),
          ]) {
            const rejected = yield* Effect.flip(store.accept(message, 100));
            expect(rejected.message).toBe(
              "Destination policy, capability or repository scope differs from the envelope."
            );
          }
          const inbox3 = yield* store.inbox("b");
          expect(inbox3).toHaveLength(0);
        })
      )
    );

    it.effect("one destination claim excludes another connection and survives restart as ambiguity", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("m1"), 100);
          yield* store.accept(envelope("m2"), 100);
          const unauthorized = yield* Effect.flip(store.claimNext("b", "wrong-owner", 101, 201));
          expect(unauthorized.message).toBe(
            "Dispatcher does not match the evidenced enrollment owner and effective policy."
          );
          const claimNext4 = yield* store.claimNext("b", "b-owner", 101, 201);
          const claimed = O.getOrThrow(claimNext4);
          const contenderClient = yield* makeAgentMessageSqliteClient(filename, "50 millis");
          const contender = yield* makeAgentMessageStore().pipe(
            Effect.provideService(SqlClient.SqlClient, contenderClient)
          );
          const claimNext5 = yield* contender.claimNext("b", "b-owner", 102, 202);
          assertNone(claimNext5);
          const binding6 = yield* binding("b", 2);
          expect((yield* Effect.flip(store.register(binding6))).code).toBe("staleClaim");
          const recover7 = yield* contender.recover(202);
          expect(recover7).toBe(1);
          const recover8 = yield* contender.recover(203);
          expect(recover8).toBe(0);
          const receipts9 = yield* contender.receipts("m1");
          expect(A.map(receipts9, (receipt) => receipt.status)).toEqual(["accepted", "claimed", "ambiguous"]);
          const claimNext10 = yield* contender.claimNext("b", "b-owner", 203, 303);
          assertNone(claimNext10);
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
            const claimNext11 = yield* store.claimNext("b", "b-owner", 110, 210);
            assertNone(claimNext11);
            const receipts12 = yield* store.receipts("expired");
            expect(A.map(receipts12, (receipt) => receipt.status)).toEqual(["accepted", "expired"]);
            yield* store.accept(envelope("next"), 111);
            const claimNext13 = yield* store.claimNext("b", "b-owner", 112, 212);
            assertSome(
              O.map(claimNext13, (claim) => claim.envelope.messageId),
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
          const dispatchOne14 = yield* router.dispatchOne("b", "b-owner", 101, 201, () => Effect.succeed(102));
          expect(O.getOrThrow(dispatchOne14).status).toBe("delivered");
          yield* router.acknowledge("request", "b", 103);
          yield* router.accept(Envelope.make({ ...envelope("reply", "b", "a"), replyTo: O.some("request") }), 104);
          yield* router.dispatchOne("a", "a-owner", 105, 205, () => Effect.succeed(106));
          expect(seen).toEqual(["bounded request", "bounded reply"]);
          expect(O.getOrNull((yield* router.message("reply")).replyTo)).toBe("request");
          expect((yield* router.receipts("request")).length).toBe(4);
          const recover15 = yield* router.recover(10000);
          expect(recover15).toBe(1);
          const receipts16 = yield* router.receipts("reply");
          expect(O.getOrThrow(A.last(receipts16)).status).toBe("ambiguous");
          const claimNext17 = yield* router.claimNext("a", "a-owner", 10001, 10101);
          assertNone(claimNext17);
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
          const dispatchOne18 = yield* router.dispatchOne("b", "b-owner", 101, 201, () => Effect.succeed(102));
          expect(O.getOrThrow(dispatchOne18).status).toBe("ambiguous");
          const dispatchOne19 = yield* router.dispatchOne("b", "b-owner", 103, 203, () => Effect.succeed(104));
          assertNone(dispatchOne19);
          expect(submissions).toBe(1);
          const receipts20 = yield* store.receipts("uncertain");
          expect(O.getOrNull(O.getOrThrow(A.last(receipts20)).detail)).toBe("storage: synthetic disconnected response");
        })
      )
    );

    it.effect("SIGKILL after child acceptance retains one logical receipt after reopening", () =>
      fixture((_store, filename) =>
        Effect.gen(function* () {
          const process = yield* processFixture(filename, "accept", "accept-checkpoint");
          const wait21 = yield* process.wait;
          expect(wait21).toBe("accepted");
          yield* process.child.kill({ killSignal: "SIGKILL" });
          expect((yield* Effect.flip(process.child.exitCode)).reason.cause).toMatchObject({
            message: expect.stringContaining("SIGKILL"),
          });
          const client = yield* makeAgentMessageSqliteClient(filename);
          const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
          const accepted = yield* reopened.accept(envelope("crash"), 101);
          expect(accepted.status).toBe("accepted");
          const receipts22 = yield* reopened.receipts("crash");
          expect(receipts22).toHaveLength(1);
          const inbox23 = yield* reopened.inbox("b");
          expect(inbox23).toHaveLength(1);
        })
      )
    );

    it.effect("SIGKILL after child claim holds unknown external outcome without replay", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("crash"), 100);
          const process = yield* processFixture(filename, "claim", "claim-checkpoint");
          const wait24 = yield* process.wait;
          expect(wait24).toBe("claimed");
          yield* process.child.kill({ killSignal: "SIGKILL" });
          expect((yield* Effect.flip(process.child.exitCode)).reason.cause).toMatchObject({
            message: expect.stringContaining("SIGKILL"),
          });
          const client = yield* makeAgentMessageSqliteClient(filename);
          const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
          const recover25 = yield* reopened.recover(202);
          expect(recover25).toBe(1);
          const receipts26 = yield* reopened.receipts("crash");
          expect(A.map(receipts26, (receipt) => receipt.status)).toEqual(["accepted", "claimed", "ambiguous"]);
          const claimNext27 = yield* reopened.claimNext("b", "b-owner", 203, 303);
          assertNone(claimNext27);
        })
      )
    );

    it.effect("child initialization retries temporary write contention", () =>
      fixture((_store, filename) =>
        Effect.gen(function* () {
          const blocker = yield* makeAgentMessageSqliteClient(filename, "50 millis");
          const process = yield* Effect.acquireUseRelease(
            blocker`BEGIN IMMEDIATE`,
            () =>
              Effect.gen(function* () {
                const child = yield* processFixture(filename, "claim", "initialization-contention");
                // Release only after initialization has actually exhausted its native busy wait.
                const waitFor28 = yield* child.waitFor(".contended");
                expect(waitFor28).toBe("contended");
                return child;
              }),
            () => blocker`ROLLBACK`.pipe(Effect.orDie)
          );
          const wait29 = yield* process.wait;
          expect(wait29).toBe("none");
          yield* process.child.kill({ killSignal: "SIGKILL" });
          expect((yield* Effect.flip(process.child.exitCode)).reason.cause).toMatchObject({
            message: expect.stringContaining("SIGKILL"),
          });
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
          const recover30 = yield* store.recover(202);
          expect(recover30).toBe(1);
        })
      )
    );

    it.effect("replaced direct generation terminalizes unsent mail and allows a new acceptance", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("old-generation"), 100);
          const binding31 = yield* binding("b", 2);
          yield* store.register(binding31);
          const receipts32 = yield* store.receipts("old-generation");
          expect(A.map(receipts32, (receipt) => receipt.status)).toEqual(["accepted", "failed"]);
          yield* store.accept(envelope("new-generation"), 101);
          const claimNext33 = yield* store.claimNext("b", "b-owner", 102, 202);
          expect(O.getOrThrow(claimNext33).envelope.messageId).toBe("new-generation");
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
          const claimNext34 = yield* store.claimNext("b", "b-owner", 101, 201);
          const claim = O.getOrThrow(claimNext34);
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
          const claimNext35 = yield* store.claimNext("b", "b-owner", 101, 201);
          const claim = O.getOrThrow(claimNext35);
          yield* store.complete(claim, "delivered", 102);
          yield* store.acknowledge("previous", "b", 102);
          const binding36 = yield* binding("b", 2);
          yield* store.register(binding36);
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
          const scopedInbox37 = yield* store.scopedInbox("grant-b-new", 103);
          expect(scopedInbox37).toHaveLength(0);
          expect((yield* Effect.flip(store.scopedReceipts("previous", "grant-b-new", 103))).code).toBe("invalidGrant");
          yield* store.accept(envelope("current"), 104);
          yield* store.claimNext("b", "b-owner", 105, 205);
          expect((yield* Effect.flip(store.acknowledge("current", "b", 106, O.some("grant-b-old")))).code).toBe(
            "invalidGrant"
          );
          expect((yield* store.acknowledge("current", "b", 106, O.some("grant-b-new"))).status).toBe("acknowledged");
          const scopedReceipts38 = yield* store.scopedReceipts("current", "grant-b-new", 107);
          expect(scopedReceipts38).toHaveLength(3);
          const binding39 = yield* binding("a", 2);
          yield* store.register(binding39);
          yield* store.registerGrant(LaunchGrant.make({ ...grant(), grantId: "grant-a-new", generation: 2 }));
          expect((yield* Effect.flip(store.acceptWithGrant(envelope("previous"), "grant-a-new", 107))).code).toBe(
            "conflict"
          );
          expect((yield* Effect.flip(store.scopedReceipts("previous", "grant-a-new", 107))).code).toBe("invalidGrant");
          const scopedEndpoints40 = yield* store.scopedEndpoints("grant-a-new", 107);
          expect(A.map(scopedEndpoints40, (endpoint) => endpoint.endpointId)).toEqual(["b"]);
        })
      )
    );

    it.effect("replies retain both original direct generations instead of moving to a successor", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("original"), 100);
          const binding41 = yield* binding("a", 2);
          yield* store.register(binding41);
          expect(
            (yield* Effect.flip(
              store.accept(Envelope.make({ ...envelope("reply", "b", "a"), replyTo: O.some("original") }), 101)
            )).code
          ).toBe("conflict");
          const inbox42 = yield* store.inbox("a");
          expect(inbox42).toHaveLength(0);
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
          const value = yield* client`SELECT version FROM agent_message_meta`;
          expect(value).toEqual([{ version: 2 }]);
        })
      )
    );

    it.effect("settled acknowledged completion cannot re-arm a hold and poison the next dispatch", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("settled"), 100);
          yield* store.accept(envelope("after-settled"), 100);
          const claimNext43 = yield* store.claimNext("b", "b-owner", 101, 201);
          const claim = O.getOrThrow(claimNext43);
          yield* store.acknowledge("settled", "b", 102);
          yield* store.complete(claim, "delivered", 103);
          expect((yield* Effect.flip(store.complete(claim, "ambiguous", 104))).code).toBe("staleClaim");
          const claimNext44 = yield* store.claimNext("b", "b-owner", 105, 205);
          expect(O.getOrThrow(claimNext44).envelope.messageId).toBe("after-settled");
          const receipts45 = yield* store.receipts("settled");
          expect(receipts45).toHaveLength(4);
        })
      )
    );

    it.effect("retains delivered and failed receipts after a mid-turn ACK without changing its idempotent result", () =>
      Effect.forEach(
        [
          { status: "delivered", uncertain: false },
          { status: "failed", uncertain: false },
          { status: "delivered", uncertain: true },
          { status: "failed", uncertain: true },
        ] as const,
        ({ status, uncertain }) =>
          fixture((store) =>
            Effect.gen(function* () {
              yield* store.accept(envelope("ack-terminal"), 100);
              yield* store.accept(envelope("after-terminal"), 100);
              const claimNext46 = yield* store.claimNext("b", "b-owner", 101, 201);
              const claim = O.getOrThrow(claimNext46);
              const acknowledged = yield* store.acknowledge("ack-terminal", "b", 102);
              if (uncertain) {
                yield* store.complete(claim, "ambiguous", 102);
              }
              const detail = O.some(`Native ${status} detail`);
              const terminal = yield* store.complete(claim, status, 103, detail);
              expect(terminal.status).toBe(status);
              expect(terminal.detail).toEqual(detail);
              assertSome(terminal.owner, "b-owner");
              expect(terminal.attemptGeneration).toBe(claim.generation);
              const acknowledge47 = yield* store.acknowledge("ack-terminal", "b", 104);
              expect(acknowledge47).toEqual(acknowledged);
              expect((yield* store.complete(claim, status, 105, detail).pipe(Effect.flip)).code).toBe("staleClaim");
              const receipts48 = yield* store.receipts("ack-terminal");
              expect(A.map(receipts48, (receipt) => receipt.status)).toEqual([
                "accepted",
                "claimed",
                "acknowledged",
                ...(uncertain ? ["ambiguous"] : []),
                status,
              ]);
              const claimNext49 = yield* store.claimNext("b", "b-owner", 106, 206);
              expect(O.getOrThrow(claimNext49).envelope.messageId).toBe("after-terminal");
            })
          )
      )
    );

    it.effect("replacement waits for original delivered-mail ACK before activating a successor", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("old-delivered", "a", "b", 110), 100);
          const claimNext50 = yield* store.claimNext("b", "b-owner", 101, 201);
          const claim = O.getOrThrow(claimNext50);
          yield* store.complete(claim, "delivered", 102);
          const binding51 = yield* binding("b", 2);
          expect((yield* Effect.flip(store.register(binding51))).code).toBe("staleClaim");
          yield* store.acknowledge("old-delivered", "b", 103);
          const binding52 = yield* binding("b", 2);
          yield* store.register(binding52);
          yield* store.accept(envelope("successor"), 104);
          const recover53 = yield* store.recover(110);
          expect(recover53).toBe(0);
          const claimNext54 = yield* store.claimNext("b", "b-owner", 111, 211);
          expect(O.getOrThrow(claimNext54).envelope.messageId).toBe("successor");
        })
      )
    );

    it.effect("participant ACK does not release an externally ambiguous active dispatch", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("ack-uncertain"), 100);
          yield* store.accept(envelope("followup"), 100);
          const claimNext55 = yield* store.claimNext("b", "b-owner", 101, 201);
          const claim = O.getOrThrow(claimNext55);
          yield* store.acknowledge("ack-uncertain", "b", 102);
          expect((yield* store.complete(claim, "ambiguous", 103)).status).toBe("ambiguous");
          const claimNext56 = yield* store.claimNext("b", "b-owner", 104, 204);
          assertNone(claimNext56);
          const binding57 = yield* binding("b", 2);
          expect((yield* Effect.flip(store.register(binding57))).code).toBe("staleClaim");
          const receipts58 = yield* store.receipts("ack-uncertain");
          expect(A.map(receipts58, (receipt) => receipt.status)).toEqual([
            "accepted",
            "claimed",
            "acknowledged",
            "ambiguous",
          ]);
          const receipts59 = yield* store.receipts("ack-uncertain");
          const uncertain = O.getOrThrow(A.last(receipts59));
          expect(O.getOrNull(uncertain.owner)).toBe("b-owner");
          expect(O.getOrNull(uncertain.detail)).toContain("Reconcile the original session");
          expect((yield* store.acknowledge("ack-uncertain", "b", 204)).status).toBe("acknowledged");
          expect((yield* store.complete(claim, "delivered", 205)).status).toBe("delivered");
          const claimNext60 = yield* store.claimNext("b", "b-owner", 206, 306);
          expect(O.getOrThrow(claimNext60).envelope.messageId).toBe("followup");
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
            const claimNext61 = yield* store.claimNext("b", "b-owner", 101, 201);
            const claim = O.getOrThrow(claimNext61);
            const acknowledged = yield* store.acknowledge("ack-recovery", "b", 102);
            const recover62 = yield* store.recover(201);
            expect(recover62).toBe(1);
            const recover63 = yield* store.recover(202);
            expect(recover63).toBe(0);
            const receipts64 = yield* store.receipts("ack-recovery");
            const held = O.getOrThrow(A.last(receipts64));
            expect(held.status).toBe("ambiguous");
            assertSome(held.owner, "b-owner");
            expect(O.getOrNull(held.detail)).toContain("reconciliation");
            expect((yield* store.acknowledge("ack-recovery", "b", 203)).sequence).toBe(acknowledged.sequence);
            const claimNext65 = yield* store.claimNext("b", "b-owner", 203, 303);
            assertNone(claimNext65);
            expect((yield* store.complete(claim, "delivered", 204)).status).toBe("delivered");
            const claimNext66 = yield* store.claimNext("b", "b-owner", 205, 305);
            assertSome(
              O.map(claimNext66, (next) => next.envelope.messageId),
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
            const recover67 = yield* reopened.recover(110);
            expect(recover67).toBe(1);
            const receipts68 = yield* reopened.receipts("drop-ack");
            const latest = O.getOrThrow(A.last(receipts68));
            expect(latest.status).toBe("ambiguous");
            expect(latest.attemptGeneration).toBe(1);
            expect(O.getOrNull(latest.owner)).toBe("b-owner");
            expect(O.getOrNull(latest.detail)).toContain("reconcile the original session");
            const claimNext69 = yield* reopened.claimNext("b", "b-owner", 111, 211);
            assertNone(claimNext69);
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
              runtimeEvidence: {
                adapter: "injected",
                sessionId: "b-session",
                terminalId: "fixture-terminal",
                outcome: "failed",
                source: "Synthetic original runtime terminal record",
              },
              evidence: "Fixture original native attempt returned failure",
              reason: "Known terminal outcome confirmed",
            });
            yield* persistSettlement(store, request);
            const receipt = yield* store.resolveAmbiguity(request, 202);
            expect(receipt.status).toBe("failed");
            expect(receipt.attemptGeneration).toBe(1);
            assertSome(receipt.owner, "b-owner");
            expect(O.getOrNull(receipt.detail)).toContain("fixture-operator");
            expect(O.getOrNull(receipt.detail)).toContain(request.evidence);
            const resolvedAmbiguity = yield* store.resolveAmbiguity(request, 203);
            expect(resolvedAmbiguity).toEqual(receipt);
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
            const binding70 = yield* binding("b", 2);
            yield* reopened.register(binding70);
            const resolvedAmbiguity71 = yield* reopened.resolveAmbiguity(request, 300);
            expect(resolvedAmbiguity71).toEqual(receipt);
            const receipts72 = yield* reopened.receipts(request.messageId);
            expect(A.map(receipts72, (row) => row.status)).toEqual(["accepted", "claimed", "ambiguous", "failed"]);
            const audit = yield* client`SELECT payload, decided_at, receipt_sequence FROM agent_message_resolutions`;
            expect(audit).toHaveLength(1);
            const rows = yield* S.decodeUnknownEffect(ResolutionAuditRows)(audit);
            const persisted = O.getOrThrow(A.head(rows));
            expect(persisted.decided_at).toBe(202);
            expect(persisted.receipt_sequence).toBe(receipt.sequence);
            const value73 = yield* S.decodeEffect(ResolutionJson)(persisted.payload);
            expect(value73).toEqual(request);
            yield* client`DELETE FROM agent_message_receipts WHERE sequence = ${receipt.sequence}`;
            expect((yield* Effect.flip(reopened.resolveAmbiguity(request, 301))).message).toBe(
              "Resolution audit has no original receipt."
            );
          })
        )
    );

    it.effect("resolution validates every attempt fence and rejects nonambiguous and malformed assertions", () =>
      fixture((store) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("fenced-resolution"), 100);
          const runtimeEvidence = {
            adapter: "injected",
            sessionId: "b-session",
            terminalId: "fixture-terminal",
            outcome: "delivered",
            source: "Synthetic original runtime terminal record",
          } satisfies OriginalRuntimeEvidence;
          const request = AmbiguityResolution.make({
            resolutionId: "fenced",
            messageId: "fenced-resolution",
            endpointId: "b",
            endpointGeneration: 1,
            attemptGeneration: 1,
            attemptOwnerId: "b-owner",
            operatorId: "fixture-operator",
            disposition: "delivered",
            runtimeEvidence,
            evidence: "Fixture original session terminal result",
            reason: "Known result verified",
          });
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 101))).code).toBe("staleClaim");
          yield* store.claimNext("b", "b-owner", 101, 201);
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 102))).code).toBe("conflict");
          yield* store.recover(201);
          yield* persistSettlement(store, request);
          const invalid = [
            AmbiguityResolution.make({ ...request, endpointId: "a" }),
            AmbiguityResolution.make({ ...request, endpointGeneration: 2 }),
            AmbiguityResolution.make({ ...request, attemptGeneration: 2 }),
            AmbiguityResolution.make({ ...request, attemptOwnerId: "other-owner" }),
            AmbiguityResolution.make({ ...request, disposition: "failed" }),
            AmbiguityResolution.make({
              ...request,
              runtimeEvidence: { ...request.runtimeEvidence, sessionId: "replacement-session" },
            }),
            AmbiguityResolution.make({
              ...request,
              runtimeEvidence: {
                adapter: "codex",
                sessionId: "b-session",
                messageId: request.messageId,
                turnId: "unrelated-turn",
                outcome: "delivered",
                stopReason: "completed",
              },
            }),
            AmbiguityResolution.make({
              ...request,
              runtimeEvidence: { ...runtimeEvidence, outcome: "failed" },
            }),
          ];
          const errors = yield* Effect.forEach(invalid, (decision) =>
            Effect.flip(store.resolveAmbiguity(decision, 202))
          );
          expect(A.map(errors, (failure) => failure.code)).toEqual([
            "conflict",
            "staleClaim",
            "staleClaim",
            "staleClaim",
            "conflict",
            "conflict",
            "conflict",
            "conflict",
          ]);
          expect(S.is(AmbiguityResolution)({ ...request, evidence: "" })).toBe(false);
          expect(S.is(AmbiguityResolution)({ ...request, runtimeEvidence: undefined })).toBe(false);
          expect(
            S.is(AmbiguityResolution)({ ...request, runtimeEvidence: { ...request.runtimeEvidence, terminalId: "" } })
          ).toBe(false);
          expect(S.is(AmbiguityResolution)({ ...request, reason: "" })).toBe(false);
          expect(S.is(AmbiguityResolution)({ ...request, disposition: "abandoned" })).toBe(false);
          const receipts74 = yield* store.receipts(request.messageId);
          expect(receipts74).toHaveLength(3);
          const receipt = yield* store.resolveAmbiguity(request, 203);
          expect(receipt.status).toBe("delivered");
          yield* store.acknowledge(request.messageId, "b", 204);
          const binding75 = yield* binding("b", 2);
          yield* store.register(binding75);
          const resolvedAmbiguity76 = yield* store.resolveAmbiguity(request, 205);
          expect(resolvedAmbiguity76).toEqual(receipt);
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
              runtimeEvidence: {
                adapter: "injected",
                sessionId: "b-session",
                terminalId: "fixture-terminal",
                outcome: "failed",
                source: "Synthetic original runtime terminal record",
              },
              evidence: "Fixture known native failure despite consumption ACK",
              reason: "Release original terminal native hold",
            });
            yield* persistSettlement(store, request);
            yield* store.resolveAmbiguity(request, 202);
            const acknowledge77 = yield* store.acknowledge("resolved-ack", "b", 203);
            expect(acknowledge77).toEqual(acknowledged);
            const receipts78 = yield* store.receipts("resolved-ack");
            expect(A.map(receipts78, (row) => row.status)).toEqual([
              "accepted",
              "claimed",
              "acknowledged",
              "ambiguous",
              "failed",
            ]);
            const claimNext79 = yield* store.claimNext("b", "b-owner", 204, 304);
            assertSome(
              O.map(claimNext79, (claim) => claim.envelope.messageId),
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
            runtimeEvidence: {
              adapter: "injected",
              sessionId: "b-session",
              terminalId: "fixture-terminal",
              outcome: "failed",
              source: "Synthetic original runtime terminal record",
            },
            evidence: "Fixture known terminal result",
            reason: "Confirmed original attempt",
          });
          yield* persistSettlement(store, request);
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
          const receipts80 = yield* store.receipts(request.messageId);
          expect(receipts80).toHaveLength(4);
          const rows = yield* client`SELECT count(*) AS count FROM agent_message_resolutions`;
          expect(rows).toEqual([{ count: 1 }]);
        })
      )
    );

    it.effect("failed operator assertion cannot contradict confirmed delivery for the original attempt", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("confirmed-delivery-resolution", "a", "b", 110), 100);
          const claimNext81 = yield* store.claimNext("b", "b-owner", 101, 201);
          const claim = O.getOrThrow(claimNext81);
          const originalTerminal = {
            adapter: "injected",
            sessionId: "b-session",
            terminalId: "fixture-terminal",
            outcome: "delivered",
            source: "Synthetic original runtime terminal record",
          } satisfies OriginalRuntimeEvidence;
          const value82 = yield* S.decodeEffect(OriginalRuntimeEvidence)(originalTerminal);
          yield* store.recordSettlement(claim, value82, 102);
          yield* store.complete(claim, "delivered", 102);
          const recover83 = yield* store.recover(110);
          expect(recover83).toBe(1);
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
            runtimeEvidence: {
              adapter: "injected",
              sessionId: "b-session",
              terminalId: "fixture-terminal",
              outcome: "failed",
              source: "Synthetic original runtime terminal record",
            },
            evidence: "Fixture operator assertion conflicting with stored delivery",
            reason: "Reject contradictory assertion",
          });
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 111))).code).toBe("conflict");
          const receipts84 = yield* store.receipts(request.messageId);
          expect(receipts84).toEqual(before);
          const client = yield* makeAgentMessageSqliteClient(filename);
          const value85 =
            yield* client`SELECT state, dispatch_active, attempt_generation FROM agent_messages WHERE id = ${request.messageId}`;
          expect(value85).toEqual([{ state: "ambiguous", dispatch_active: 0, attempt_generation: 1 }]);
          const value86 =
            yield* client`SELECT count(*) AS count FROM agent_message_resolutions WHERE message_id = ${request.messageId}`;
          expect(value86).toEqual([{ count: 0 }]);
          const delivered = AmbiguityResolution.make({
            ...request,
            disposition: "delivered",
            runtimeEvidence: {
              adapter: "injected",
              sessionId: "b-session",
              terminalId: "fixture-terminal",
              outcome: "delivered",
              source: "Synthetic original runtime terminal record",
            },
            evidence: "Stored fixture original attempt terminal delivery",
            reason: "Confirm known terminal result",
          });
          const resolved = yield* store.resolveAmbiguity(delivered, 112);
          expect(resolved.status).toBe("delivered");
          const resolvedAmbiguity87 = yield* store.resolveAmbiguity(delivered, 113);
          expect(resolvedAmbiguity87).toEqual(resolved);
          const receipts88 = yield* store.receipts(request.messageId);
          expect(receipts88).toHaveLength(A.length(before) + 1);
          const value89 =
            yield* client`SELECT count(*) AS count FROM agent_message_resolutions WHERE message_id = ${request.messageId}`;
          expect(value89).toEqual([{ count: 1 }]);
          const recover90 = yield* store.recover(114);
          expect(recover90).toBe(0);
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
            const recover91 = yield* store.recover(201);
            expect(recover91).toBe(1);
            const request = AmbiguityResolution.make({
              resolutionId: "expired-delivery-decision",
              messageId: "resolved-expired-delivery",
              endpointId: "b",
              endpointGeneration: 1,
              attemptGeneration: 1,
              attemptOwnerId: "b-owner",
              operatorId: "fixture-operator",
              disposition: "delivered",
              runtimeEvidence: {
                adapter: "injected",
                sessionId: "b-session",
                terminalId: "fixture-terminal",
                outcome: "delivered",
                source: "Synthetic original runtime terminal record",
              },
              evidence: "Fixture original native attempt confirmed terminal delivery",
              reason: "Known result verified after TTL",
            });
            yield* persistSettlement(store, request);
            const resolved = yield* store.resolveAmbiguity(request, 202);
            const recover92 = yield* store.recover(203);
            expect(recover92).toBe(0);
            const recover93 = yield* store.recover(204);
            expect(recover93).toBe(0);
            yield* store.accept(envelope("after-expired-resolution", "a", "b", 300), 204);
            const claimNext94 = yield* store.claimNext("b", "b-owner", 205, 305);
            const successor = O.getOrThrow(claimNext94);
            expect(successor.envelope.messageId).toBe("after-expired-resolution");
            expect((yield* store.acknowledge(request.messageId, "b", 206)).status).toBe("acknowledged");
            const resolvedAmbiguity95 = yield* store.resolveAmbiguity(request, 207);
            expect(resolvedAmbiguity95).toEqual(resolved);
            const receipts96 = yield* store.receipts(request.messageId);
            expect(A.map(receipts96, (receipt) => receipt.status)).toEqual([
              "accepted",
              "claimed",
              "ambiguous",
              "delivered",
              "acknowledged",
            ]);
            const client = yield* makeAgentMessageSqliteClient(filename);
            const value97 =
              yield* client`SELECT count(*) AS count FROM agent_message_resolutions WHERE message_id = ${request.messageId}`;
            expect(value97).toEqual([{ count: 1 }]);
            const value98 =
              yield* client`SELECT state, dispatch_active, attempt_generation FROM agent_messages WHERE id = ${request.messageId}`;
            expect(value98).toEqual([{ state: "acknowledged", dispatch_active: 0, attempt_generation: 1 }]);
            yield* store.complete(successor, "delivered", 208);
            const recover99 = yield* store.recover(300);
            expect(recover99).toBe(1);
            const receipts100 = yield* store.receipts(successor.envelope.messageId);
            expect(O.getOrThrow(A.last(receipts100)).status).toBe("ambiguous");
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
            runtimeEvidence: {
              adapter: "injected",
              sessionId: "b-session",
              terminalId: "fixture-terminal",
              outcome: "failed",
              source: "Synthetic original runtime terminal record",
            },
            evidence: "Synthetic owned attempt terminal failure",
            reason: "Fixture confirms known result",
          });
          yield* persistSettlement(store, request);
          const process = yield* processFixture(filename, "resolve", "resolution-checkpoint", O.some(request));
          const argument = S.decodeEffect(ReceiptJson);
          const wait1 = yield* process.wait;
          const committed = yield* argument(wait1);
          yield* process.child.kill({ killSignal: "SIGKILL" });
          const client = yield* makeAgentMessageSqliteClient(filename);
          const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
          const resolvedAmbiguity101 = yield* reopened.resolveAmbiguity(request, 300);
          expect(resolvedAmbiguity101).toEqual(committed);
          const receipts102 = yield* reopened.receipts(request.messageId);
          expect(receipts102).toHaveLength(4);
          const value103 = yield* client`SELECT count(*) AS count FROM agent_message_resolutions`;
          expect(value103).toEqual([{ count: 1 }]);
          const value104 =
            yield* client`SELECT state, dispatch_active, attempt_generation FROM agent_messages WHERE id = ${request.messageId}`;
          expect(value104).toEqual([{ state: "failed", dispatch_active: 0, attempt_generation: 1 }]);
        })
      )
    );

    it.effect("unclaimed messages cannot acquire terminal proof and expiry appends its original receipt", () =>
      fixture((store) =>
        Effect.gen(function* () {
          const original = envelope("unclaimed-terminal", "a", "b", 110);
          yield* store.accept(original, 100);
          const inventedClaim = Claim.make({ envelope: original, ownerId: "b-owner", generation: 1, leaseUntil: 201 });
          const evidence = yield* S.decodeEffect(OriginalRuntimeEvidence)({
            adapter: "injected",
            sessionId: "b-session",
            terminalId: "unclaimed-terminal",
            outcome: "delivered",
            source: "Synthetic result without a dispatch",
          });
          expect((yield* Effect.flip(store.recordSettlement(inventedClaim, evidence, 101))).message).toBe(
            "Terminal settlement requires the original unresolved dispatch hold."
          );
          const settlement105 = yield* store.settlement(original.messageId);
          assertNone(settlement105);
          const recover106 = yield* store.recover(110);
          expect(recover106).toBe(1);
          const receipts107 = yield* store.receipts(original.messageId);
          expect(A.map(receipts107, (receipt) => receipt.status)).toEqual(["accepted", "expired"]);
          const recover108 = yield* store.recover(111);
          expect(recover108).toBe(0);
        })
      )
    );

    it.effect(
      "original settlement survives process kill, stays immutable and reconciles without another dispatch",
      () =>
        fixture((store, filename) =>
          Effect.gen(function* () {
            yield* store.accept(envelope("settlement-crash"), 100);
            const claimNext109 = yield* store.claimNext("b", "b-owner", 101, 201);
            const claim = O.getOrThrow(claimNext109);
            const runtimeEvidence = {
              adapter: "injected",
              sessionId: "b-session",
              terminalId: "original-terminal",
              outcome: "delivered",
              source: "Synthetic actual original settlement",
            } satisfies OriginalRuntimeEvidence;
            const request = AmbiguityResolution.make({
              resolutionId: "settlement-crash-resolution",
              messageId: "settlement-crash",
              endpointId: "b",
              endpointGeneration: 1,
              attemptGeneration: 1,
              attemptOwnerId: "b-owner",
              operatorId: "fixture-operator",
              disposition: "delivered",
              runtimeEvidence,
              evidence: "Original persisted synthetic terminal result",
              reason: "Reconcile after host crash",
            });
            const process = yield* processFixture(filename, "settle", "settled-checkpoint", O.some(request));
            const wait110 = yield* process.wait;
            expect(wait110).toBe("settled");
            yield* process.child.kill({ killSignal: "SIGKILL" });
            const client = yield* makeAgentMessageSqliteClient(filename);
            const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
            const settlement111 = yield* reopened.settlement(request.messageId);
            assertSome(settlement111, request.runtimeEvidence);
            yield* reopened.recordSettlement(claim, request.runtimeEvidence, 202);
            const invalidReplays = [
              Claim.make({ ...claim, ownerId: "foreign-owner" }),
              Claim.make({ ...claim, leaseUntil: 202 }),
              Claim.make({ ...claim, envelope: Envelope.make({ ...claim.envelope, body: "changed original body" }) }),
            ];
            const replayErrors = yield* Effect.forEach(invalidReplays, (replay) =>
              reopened.recordSettlement(replay, request.runtimeEvidence, 202).pipe(Effect.flip)
            );
            expect(A.map(replayErrors, (failure) => failure.code)).toEqual(["conflict", "conflict", "conflict"]);
            const changed = yield* S.decodeEffect(OriginalRuntimeEvidence)({
              ...runtimeEvidence,
              terminalId: "wrong-terminal",
            });
            expect((yield* Effect.flip(reopened.recordSettlement(claim, changed, 202))).code).toBe("conflict");
            yield* reopened.recover(201);
            expect(
              (yield* Effect.flip(
                reopened.resolveAmbiguity(AmbiguityResolution.make({ ...request, runtimeEvidence: changed }), 202)
              )).code
            ).toBe("conflict");
            const claimNext112 = yield* reopened.claimNext("b", "b-owner", 202, 302);
            assertNone(claimNext112);
            const receipt = yield* reopened.resolveAmbiguity(request, 203);
            const resolvedAmbiguity113 = yield* reopened.resolveAmbiguity(request, 204);
            expect(resolvedAmbiguity113).toEqual(receipt);
            const value114 = yield* client`SELECT count(*) AS count FROM agent_message_settlements`;
            expect(value114).toEqual([{ count: 1 }]);
            const receipts115 = yield* reopened.receipts(request.messageId);
            expect(receipts115).toHaveLength(4);
          })
        )
    );

    it.effect("native terminal proof must identify the original prompt before it can be persisted", () =>
      fixture((store) =>
        Effect.gen(function* () {
          const original = yield* binding("c");
          yield* store.register(
            EndpointBinding.make({
              ...original,
              policy: PolicySnapshot.make({ ...original.policy, provider: "codex" }),
            })
          );
          yield* store.accept(envelope("original-native-prompt", "a", "c"), 100);
          const claimNext116 = yield* store.claimNext("c", "c-owner", 101, 201);
          const claim = O.getOrThrow(claimNext116);
          const wrongMessage = {
            adapter: "codex",
            sessionId: "c-session",
            messageId: "another-prompt",
            turnId: "synthetic-observed-turn",
            stopReason: "completed",
            outcome: "delivered",
          } satisfies OriginalRuntimeEvidence;
          expect((yield* Effect.flip(store.recordSettlement(claim, wrongMessage, 102))).message).toBe(
            "Native terminal response does not identify the original prompt."
          );
          const settlement117 = yield* store.settlement(claim.envelope.messageId);
          assertNone(settlement117);
          const evidence = yield* S.decodeEffect(OriginalRuntimeEvidence)({
            ...wrongMessage,
            messageId: claim.envelope.messageId,
          });
          yield* store.recordSettlement(claim, evidence, 103);
          const settlement118 = yield* store.settlement(claim.envelope.messageId);
          assertSome(settlement118, evidence);
          yield* store.recover(201);
          const request = AmbiguityResolution.make({
            resolutionId: "native-original",
            messageId: claim.envelope.messageId,
            endpointId: "c",
            endpointGeneration: 1,
            attemptGeneration: claim.generation,
            attemptOwnerId: claim.ownerId,
            operatorId: "host",
            disposition: "delivered",
            runtimeEvidence: evidence,
            evidence: "Synthetic original native terminal response",
            reason: "Reconcile original synthetic prompt",
          });
          expect((yield* store.resolveAmbiguity(request, 202)).status).toBe("delivered");
        })
      )
    );

    it.effect("legacy holds and failed settlement transactions cannot be cleared by an assertion", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          yield* store.accept(envelope("legacy-hold"), 100);
          const claimNext119 = yield* store.claimNext("b", "b-owner", 101, 201);
          const claim = O.getOrThrow(claimNext119);
          const evidence = yield* S.decodeEffect(OriginalRuntimeEvidence)({
            adapter: "injected",
            sessionId: "b-session",
            terminalId: "original-terminal",
            outcome: "delivered",
            source: "Synthetic settlement",
          });
          const client = yield* makeAgentMessageSqliteClient(filename);
          yield* client`CREATE TRIGGER fixture_settlement_abort BEFORE INSERT ON agent_message_settlements BEGIN SELECT RAISE(ABORT, 'fixture settlement abort'); END`;
          expect((yield* Effect.flip(store.recordSettlement(claim, evidence, 102))).code).toBe("storage");
          const settlement120 = yield* store.settlement(claim.envelope.messageId);
          assertNone(settlement120);
          yield* store.recover(201);
          const request = AmbiguityResolution.make({
            resolutionId: "legacy-assertion",
            messageId: "legacy-hold",
            endpointId: "b",
            endpointGeneration: 1,
            attemptGeneration: 1,
            attemptOwnerId: "b-owner",
            operatorId: "operator",
            disposition: "delivered",
            runtimeEvidence: evidence,
            evidence: "Unpersisted operator assertion",
            reason: "Must retain legacy hold",
          });
          const rejected = yield* Effect.flip(store.resolveAmbiguity(request, 202));
          expect(rejected.message).toBe("No original runtime terminal settlement was persisted; retain this hold.");
          const receipts121 = yield* store.receipts(request.messageId);
          expect(receipts121).toHaveLength(3);
          const claimNext122 = yield* store.claimNext("b", "b-owner", 203, 303);
          assertNone(claimNext122);
          yield* client`DROP TRIGGER fixture_settlement_abort`;
          for (const stale of [
            Claim.make({ ...claim, generation: 2 }),
            Claim.make({ ...claim, leaseUntil: 202 }),
            Claim.make({ ...claim, envelope: Envelope.make({ ...claim.envelope, body: "changed original message" }) }),
          ]) {
            expect((yield* Effect.flip(store.recordSettlement(stale, evidence, 204))).code).toBe("staleClaim");
          }
          const wrongOwner = Claim.make({ ...claim, ownerId: "wrong-owner" });
          expect((yield* Effect.flip(store.recordSettlement(wrongOwner, evidence, 204))).code).toBe("staleClaim");
          const wrongSession = yield* S.decodeEffect(OriginalRuntimeEvidence)({
            ...evidence,
            sessionId: "replacement-session",
          });
          expect((yield* Effect.flip(store.recordSettlement(claim, wrongSession, 204))).code).toBe("staleClaim");
          const settlement123 = yield* store.settlement(request.messageId);
          assertNone(settlement123);
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
            runtimeEvidence: {
              adapter: "injected",
              sessionId: "b-session",
              terminalId: "fixture-terminal",
              outcome: "failed",
              source: "Synthetic original runtime terminal record",
            },
            evidence: "Fixture known native terminal failure",
            reason: "Verified original attempt",
          });
          yield* persistSettlement(store, request);
          const client = yield* makeAgentMessageSqliteClient(filename);
          yield* client`CREATE TRIGGER fixture_resolution_abort BEFORE INSERT ON agent_message_resolutions BEGIN SELECT RAISE(ABORT, 'fixture audit abort'); END`;
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 202))).code).toBe("storage");
          const receipts124 = yield* store.receipts(request.messageId);
          expect(receipts124).toHaveLength(3);
          const claimNext125 = yield* store.claimNext("b", "b-owner", 203, 303);
          assertNone(claimNext125);
          const value126 = yield* client`SELECT count(*) AS count FROM agent_message_resolutions`;
          expect(value126).toEqual([{ count: 0 }]);
          const value127 =
            yield* client`SELECT state, dispatch_active, attempt_generation FROM agent_messages WHERE id = ${request.messageId}`;
          expect(value127).toEqual([{ state: "ambiguous", dispatch_active: 2, attempt_generation: 1 }]);
          yield* client`DROP TRIGGER fixture_resolution_abort`;
          const reopened = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
          const receipt = yield* reopened.resolveAmbiguity(request, 204);
          const resolvedAmbiguity128 = yield* store.resolveAmbiguity(request, 205);
          expect(resolvedAmbiguity128).toEqual(receipt);
          const receipts129 = yield* store.receipts(request.messageId);
          expect(receipts129).toHaveLength(4);
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
            runtimeEvidence: {
              adapter: "injected",
              sessionId: "b-session",
              terminalId: "fixture-terminal",
              outcome: "failed",
              source: "Synthetic original runtime terminal record",
            },
            evidence: "Fixture native failure",
            reason: "Fixture known result",
          });
          yield* persistSettlement(store, request);
          const client = yield* makeAgentMessageSqliteClient(filename);
          yield* client`UPDATE agent_messages SET target_generation = 2 WHERE id = ${request.messageId}`;
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 202))).code).toBe("staleClaim");
          yield* client`UPDATE agent_messages SET target_generation = 1 WHERE id = ${request.messageId}`;
          const argument1 = S.encodeEffect(BindingJson);
          const binding3 = yield* binding("b", 2);
          const replacement = yield* argument1(binding3);
          yield* client`UPDATE agent_message_endpoints SET payload = ${replacement} WHERE id = 'b'`;
          expect((yield* Effect.flip(store.resolveAmbiguity(request, 203))).code).toBe("staleClaim");
          const receipts130 = yield* store.receipts(request.messageId);
          expect(receipts130).toHaveLength(3);
        })
      )
    );

    it.effect("endpoint capacity retains delivered ambiguity and acknowledged native holds", () =>
      fixture(
        (store) =>
          Effect.gen(function* () {
            yield* store.accept(envelope("retained-cap", "a", "b", 110), 100);
            const claimNext131 = yield* store.claimNext("b", "b-owner", 101, 201);
            const claim = O.getOrThrow(claimNext131);
            expect((yield* Effect.flip(store.accept(envelope("claimed-cap"), 102))).code).toBe("queueFull");
            const value132 = yield* S.decodeEffect(OriginalRuntimeEvidence)({
              adapter: "injected",
              sessionId: "b-session",
              terminalId: "fixture-terminal",
              outcome: "delivered",
              source: "Synthetic original runtime terminal record",
            });
            yield* store.recordSettlement(claim, value132, 103);
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
                runtimeEvidence: {
                  adapter: "injected",
                  sessionId: "b-session",
                  terminalId: "fixture-terminal",
                  outcome: "delivered",
                  source: "Synthetic original runtime terminal record",
                },
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
            const binding133 = yield* binding("c");
            yield* store.register(binding133);
            yield* store.registerGrant(grant(1));
            const accepted = yield* store.accept(envelope("endpoint-full"), 100);
            const accept134 = yield* store.accept(envelope("endpoint-full"), 101);
            expect(accept134).toEqual(accepted);
            expect((yield* Effect.flip(store.acceptWithGrant(envelope("rejected-budget"), "grant-a", 101))).code).toBe(
              "queueFull"
            );
            yield* store.accept(envelope("other-endpoint", "a", "c"), 101);
            const claimNext135 = yield* store.claimNext("b", "b-owner", 102, 202);
            const claim = O.getOrThrow(claimNext135);
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
            const binding136 = yield* binding("c");
            yield* store.register(binding136);
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

    it.effect("global retained-message ceiling includes terminal history and preserves exact acceptance replay", () =>
      fixture(
        (store) =>
          Effect.gen(function* () {
            const original = envelope("retained-history");
            const accepted = yield* store.accept(original, 100);
            const claimNext137 = yield* store.claimNext("b", "b-owner", 101, 201);
            const claim = O.getOrThrow(claimNext137);
            yield* store.complete(claim, "failed", 102);
            const accept138 = yield* store.accept(original, 103);
            expect(accept138).toEqual(accepted);
            const rejected = yield* Effect.flip(store.accept(envelope("history-overflow"), 104));
            expect(rejected.code).toBe("queueFull");
            expect(rejected.message).toBe(
              "Retained message history is at the global storage ceiling; archive this store before new admission."
            );
            const receipts139 = yield* store.receipts(original.messageId);
            expect(receipts139).toHaveLength(3);
          }),
        10,
        5,
        1
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
          const scopedInbox140 = yield* store.scopedInbox("scoped-b", 101);
          expect(A.map(scopedInbox140, (mail) => mail.messageId)).toEqual(["scoped-task"]);
          expect((yield* Effect.flip(store.scopedReceipts("other-task", "scoped-b", 101))).code).toBe("invalidGrant");
          const claimNext141 = yield* store.claimNext("b", "b-owner", 101, 201);
          const claim = O.getOrThrow(claimNext141);
          yield* store.complete(claim, "delivered", 102);
          const claimNext142 = yield* store.claimNext("b", "b-owner", 103, 203);
          const second = O.getOrThrow(claimNext142);
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
            const binding143 = yield* binding("a");
            yield* store.register(binding143);
            const binding144 = yield* binding("b");
            yield* store.register(binding144);
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
        const inbox145 = yield* store.inbox("b");
        expect(A.map(inbox145, (message) => message.messageId)).toEqual(["pending-backup"]);
        expect((yield* store.acceptWithGrant(envelope("pending-backup"), "grant-a", 101)).status).toBe("accepted");
        expect((yield* Effect.flip(store.acceptWithGrant(envelope("budget-still-spent"), "grant-a", 102))).code).toBe(
          "invalidGrant"
        );
        const receipts146 = yield* store.receipts("pending-backup");
        expect(receipts146).toHaveLength(1);
        expect((yield* fs.stat(backup)).mode & 0o077).toBe(0);
        expect((yield* fs.stat(path.join(backup, "messages.sqlite"))).mode & 0o077).toBe(0);
      })
    );
  }
);
