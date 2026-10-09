import { ModelId } from "@beep/repo-cli/commands/Models/Models.catalog.schemas";
import {
  AgentMessageStore,
  AgentMessageToolkit,
  agentMessageHandlersLayer,
  agentMessageStoreLayer,
  CapabilityEvidence,
  EndpointBinding,
  Envelope,
  LaunchGrant,
  PolicySnapshot,
  Receipt,
  RouterError,
} from "@beep/repo-cli/test/AgentMessage";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Utils from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type * as Tool from "effect/ai/Tool";
import type * as Scope from "effect/Scope";

const EnvelopeList = S.Array(Envelope);
const EndpointList = S.Array(EndpointBinding);

const binding = (endpointId: string, repositoryScope = "repo", generation = 1) =>
  EndpointBinding.make({
    endpointId,
    participantId: endpointId,
    sessionId: endpointId,
    ownerId: `owner-${endpointId}`,
    generation,
    repositoryScope,
    capabilityFingerprint: "cap-v1",
    policyFingerprint: "policy-v1",
    supported: true,
    capabilityEvidence: [
      CapabilityEvidence.make({ capability: "send", disposition: "verified", source: "injected proof", observedAt: 0 }),
    ],
    policy: PolicySnapshot.make({
      provider: "injected",
      modelId: ModelId.make("fixture"),
      effort: "medium",
      sandbox: "read-only",
      approvalPolicy: "never",
      fingerprint: "policy-v1",
      policyEvidence: "launch-enforced",
    }),
  });

const authority = (endpointId: string, expiresAt: number, maxMessages = 5) =>
  LaunchGrant.make({
    grantId: `grant-${endpointId}`,
    endpointId,
    generation: 1,
    ownerId: `owner-${endpointId}`,
    repositoryScope: "repo",
    allowedRecipients: endpointId === "a" ? ["b"] : ["a"],
    expiresAt,
    maxMessages,
  });

const call = Effect.fn("AgentMessageToolsTest.call")(function* <Name extends keyof typeof AgentMessageToolkit.tools>(
  grantId: string,
  name: Name,
  input: Tool.ParametersEncoded<(typeof AgentMessageToolkit.tools)[Name]>
) {
  const context = yield* Layer.build(agentMessageHandlersLayer(grantId));
  const toolkit = yield* AgentMessageToolkit.pipe(Effect.provide(context));
  const events = yield* toolkit.handle(name, input).pipe(Effect.flatMap(Stream.runCollect));
  return O.getOrThrow(A.last(events));
});

const fixture = Effect.fn("AgentMessageToolsTest.fixture")(function* <A, E>(
  test: Effect.Effect<A, E, AgentMessageStore | Scope.Scope>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
  yield* fs.chmod(directory, 0o700);
  const context = yield* Layer.build(agentMessageStoreLayer(path.join(directory, "store")));
  return yield* Effect.gen(function* () {
    const store = yield* AgentMessageStore;
    yield* store.register(binding("a"));
    yield* store.register(binding("b"));
    yield* store.register(binding("c"));
    yield* store.register(binding("outside", "another-repo"));
    const now = yield* Clock.currentTimeMillis;
    yield* store.registerGrant(authority("a", now + 60000, 2));
    yield* store.registerGrant(authority("b", now + 60000));
    return yield* test;
  }).pipe(Effect.provide(context));
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("AgentMessage enrollment tool boundary", (it) => {
  it.effect.prop(
    "schema-derived caller identities cannot override host sender authority while body and conversation survive",
    [Arbitrary.schema(Envelope)],
    ([candidate]) =>
      fixture(
        Effect.gen(function* () {
          const result = yield* call("grant-a", "agent_message_send", {
            messageId: candidate.messageId,
            conversationId: candidate.conversationId,
            recipient: "b",
            body: candidate.body,
            ...{
              from: candidate.from,
              repositoryScope: candidate.repositoryScope,
              policyFingerprint: candidate.policyFingerprint,
            },
          });
          expect(result.isFailure).toBe(false);
          const message = yield* (yield* AgentMessageStore).message(candidate.messageId);
          expect(message.from).toBe("a");
          expect(message.repositoryScope).toBe("repo");
          expect(message.policyFingerprint).toBe("policy-v1");
          expect(message.body).toBe(candidate.body);
          expect(message.conversationId).toBe(candidate.conversationId);
        })
      ),
    { arbitrary: fcRuns(25) }
  );
  it.effect("host assigns sender, policy and scope even with forged extra input", () =>
    fixture(
      Effect.gen(function* () {
        const store = yield* AgentMessageStore;
        const result = yield* call("grant-a", "agent_message_send", {
          messageId: "m1",
          conversationId: "conversation",
          recipient: "b",
          body: "hello",
          ...{ from: "outside", repositoryScope: "another-repo", policyFingerprint: "forged" },
        });
        expect(result.isFailure).toBe(false);
        const message = yield* store.message("m1");
        expect(message.from).toBe("a");
        expect(message.repositoryScope).toBe("repo");
        expect(message.policyFingerprint).toBe("policy-v1");
      })
    )
  );

  it.effect("stable sends and replies preserve identity, correlation and budget", () =>
    fixture(
      Effect.gen(function* () {
        const store = yield* AgentMessageStore;
        const input = { messageId: "m1", conversationId: "conversation", recipient: "b", body: "hello" };
        const first = yield* call("grant-a", "agent_message_send", input);
        const repeat = yield* call("grant-a", "agent_message_send", input);
        expect(first.isFailure).toBe(false);
        expect(repeat.encodedResult).toEqual(first.encodedResult);
        const reply = { messageId: "r1", replyTo: "m1", body: "reply" };
        const response = yield* call("grant-b", "agent_message_reply", reply);
        const retry = yield* call("grant-b", "agent_message_reply", reply);
        expect(response.isFailure).toBe(false);
        expect(retry.encodedResult).toEqual(response.encodedResult);
        const message = yield* store.message("r1");
        expect(message.conversationId).toBe("conversation");
        expect(O.getOrNull(message.replyTo)).toBe("m1");
        expect(message.to).toEqual({ kind: "direct", endpointId: "a" });
        expect((yield* call("grant-a", "agent_message_send", { ...input, messageId: "m2" })).isFailure).toBe(false);
        expect((yield* call("grant-a", "agent_message_send", { ...input, messageId: "m3" })).isFailure).toBe(true);
        expect((yield* call("grant-a", "agent_message_send", { ...input, body: "changed" })).isFailure).toBe(true);
      })
    )
  );

  it.effect("forbids disallowed peers, outbound replies and unrelated message reads", () =>
    fixture(
      Effect.gen(function* () {
        const store = yield* AgentMessageStore;
        const now = yield* Clock.currentTimeMillis;
        const denied = yield* call("grant-a", "agent_message_send", {
          messageId: "denied",
          conversationId: "c",
          recipient: "c",
          body: "hello",
        });
        expect(denied.isFailure).toBe(true);
        Utils.assertNone(yield* store.findMessage("denied"));
        yield* call("grant-a", "agent_message_send", {
          messageId: "own",
          conversationId: "c",
          recipient: "b",
          body: "hello",
        });
        expect(
          (yield* call("grant-a", "agent_message_reply", { messageId: "forged-reply", replyTo: "own", body: "x" }))
            .isFailure
        ).toBe(true);

        yield* store.accept(
          Envelope.make({
            messageId: "secret",
            idempotencyKey: "secret",
            conversationId: "private",
            from: "b",
            to: { kind: "direct", endpointId: "c" },
            repositoryScope: "repo",
            body: "private text",
            createdAt: now,
            expiresAt: now + 10000,
            capabilityFingerprint: "cap-v1",
            policyFingerprint: "policy-v1",
          }),
          now
        );
        const inspect = yield* call("grant-a", "agent_message_inspect", { messageId: "secret" });
        expect(inspect.isFailure).toBe(true);
        expect((yield* S.decodeUnknownEffect(RouterError)(inspect.encodedResult)).code).toBe("invalidGrant");
        const inbox = yield* call("grant-a", "agent_message_inbox", {});
        expect(yield* S.decodeUnknownEffect(EnvelopeList)(inbox.encodedResult)).toEqual([]);
        const peers = yield* call("grant-a", "agent_message_discover", {});
        expect(
          A.map(yield* S.decodeUnknownEffect(EndpointList)(peers.encodedResult), (peer) => peer.endpointId)
        ).toEqual(["b"]);
        expect(
          (yield* call("grant-a", "agent_message_reply", { messageId: "bad-reply", replyTo: "secret", body: "x" }))
            .isFailure
        ).toBe(true);
      })
    )
  );

  it.effect("expired and replaced grants deny read tools as well as writes", () =>
    fixture(
      Effect.gen(function* () {
        const store = yield* AgentMessageStore;
        const now = yield* Clock.currentTimeMillis;
        yield* store.registerGrant(LaunchGrant.make({ ...authority("a", now), grantId: "expired" }));
        expect((yield* call("not-enrolled", "agent_message_inbox", {})).isFailure).toBe(true);
        expect(
          (yield* call("not-enrolled", "agent_message_send", {
            messageId: "premature",
            conversationId: "c",
            recipient: "b",
            body: "x",
          })).isFailure
        ).toBe(true);
        Utils.assertNone(yield* store.findMessage("premature"));

        expect((yield* call("expired", "agent_message_inbox", {})).isFailure).toBe(true);
        yield* store.register(binding("a", "repo", 2));
        expect((yield* call("grant-a", "agent_message_discover", {})).isFailure).toBe(true);
        expect(
          (yield* call("grant-a", "agent_message_send", {
            messageId: "stale",
            conversationId: "c",
            recipient: "b",
            body: "x",
          })).isFailure
        ).toBe(true);
      })
    )
  );

  it.effect("recipient acknowledgment during dispatch preserves terminal receipt and serial ownership", () =>
    fixture(
      Effect.gen(function* () {
        const store = yield* AgentMessageStore;
        const now = yield* Clock.currentTimeMillis;
        yield* call("grant-a", "agent_message_send", {
          messageId: "m1",
          conversationId: "c",
          recipient: "b",
          body: "hello",
        });
        yield* call("grant-a", "agent_message_send", {
          messageId: "m2",
          conversationId: "c",
          recipient: "b",
          body: "next",
        });
        const claim = O.getOrThrow(yield* store.claimNext("b", "owner-b", now, now + 10000));
        const ack = yield* call("grant-b", "agent_message_acknowledge", { messageId: "m1" });
        expect(ack.isFailure).toBe(false);
        expect((yield* S.decodeUnknownEffect(Receipt)(ack.encodedResult)).status).toBe("acknowledged");
        Utils.assertNone(yield* store.claimNext("b", "owner-b", now, now + 10000));
        yield* store.complete(claim, "delivered", now + 1);
        expect(O.getOrThrow(A.last(yield* store.receipts("m1"))).status).toBe("acknowledged");
        yield* store
          .claimNext("b", "owner-b", now + 2, now + 10000)
          .pipe(Effect.map(O.isSome), Effect.map(Utils.assertTrue));
      })
    )
  );

  it.effect("withholds newly replaced generation inbox after an outside precheck", () =>
    fixture(
      Effect.gen(function* () {
        const store = yield* AgentMessageStore;
        const revoked = yield* Ref.make(false);
        const now = yield* Clock.currentTimeMillis;
        const racingStore = AgentMessageStore.of({
          ...store,
          scopedInbox: Effect.fn("AgentMessageToolsTest.revokeBeforeAtomicRead")(function* (grantId, at) {
            yield* store.validateGrant(grantId, at);
            yield* store.register(binding("a", "repo", 2));
            yield* store.accept(
              Envelope.make({
                messageId: "new-generation",
                idempotencyKey: "new-generation",
                conversationId: "private-next-generation",
                from: "c",
                to: { kind: "direct", endpointId: "a" },
                repositoryScope: "repo",
                body: "new generation private content",
                createdAt: now,
                expiresAt: now + 10000,
                capabilityFingerprint: "cap-v1",
                policyFingerprint: "policy-v1",
              }),
              now
            );
            yield* Ref.set(revoked, true);
            return yield* store.scopedInbox(grantId, at);
          }),
        });
        const result = yield* call("grant-a", "agent_message_inbox", {}).pipe(
          Effect.provideService(AgentMessageStore, racingStore)
        );
        expect(yield* Ref.get(revoked)).toBe(true);
        expect(result.isFailure).toBe(true);
        expect((yield* S.decodeUnknownEffect(RouterError)(result.encodedResult)).code).toBe("invalidGrant");
        expect(A.length(yield* store.inbox("a"))).toBe(1);
      })
    )
  );

  it.effect("new generations cannot read or reply to predecessor messages", () =>
    fixture(
      Effect.gen(function* () {
        const store = yield* AgentMessageStore;
        const now = yield* Clock.currentTimeMillis;
        yield* call("grant-b", "agent_message_send", {
          messageId: "prior",
          conversationId: "old-conversation",
          recipient: "a",
          body: "previous owner mail",
        });
        const claim = O.getOrThrow(yield* store.claimNext("a", "owner-a", now, now + 10000));
        yield* store.complete(claim, "delivered", now + 1);
        yield* store.acknowledge("prior", "a", now + 2);
        yield* store.register(binding("a", "repo", 2));
        yield* store.registerGrant(
          LaunchGrant.make({ ...authority("a", now + 60000), grantId: "new-a", generation: 2 })
        );
        const inbox = yield* call("new-a", "agent_message_inbox", {});
        expect(inbox.isFailure).toBe(false);
        expect(yield* S.decodeUnknownEffect(EnvelopeList)(inbox.encodedResult)).toEqual([]);
        expect((yield* call("new-a", "agent_message_inspect", { messageId: "prior" })).isFailure).toBe(true);
        expect(
          (yield* call("new-a", "agent_message_reply", {
            messageId: "unauthorized-reply",
            replyTo: "prior",
            body: "reply",
          })).isFailure
        ).toBe(true);
        Utils.assertNone(yield* store.findMessage("unauthorized-reply"));
      })
    )
  );
});
