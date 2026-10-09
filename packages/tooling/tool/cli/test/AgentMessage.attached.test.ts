import { ModelId } from "@beep/repo-cli/commands/Models/Models.catalog.schemas";
import {
  AgentMessageStore,
  AttachedT3NativeBaseline,
  AttachedT3Profile,
  agentMessageStoreLayer,
  CapabilityEvidence,
  callAgentMessagePeer,
  EndpointBinding,
  Envelope,
  LaunchGrant,
  makeAttachedT3Dispatch,
  PolicySnapshot,
  verifyAttachedT3,
} from "@beep/repo-cli/test/AgentMessage";
import {
  T3Code,
  T3CodeConfiguration,
  T3CodeError,
  T3CodeInterrupt,
  T3CodeProject,
  T3CodeRead,
  T3CodeSend,
  T3CodeWait,
} from "@beep/t3-code";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Utils from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const GrantJson = S.fromJsonString(LaunchGrant);
const decodeConfiguration = S.decodeEffect(T3CodeConfiguration);
const decodeRead = S.decodeEffect(T3CodeRead);
const decodeProfile = S.decodeEffect(AttachedT3Profile);
const binding = (id: string) =>
  EndpointBinding.make({
    endpointId: id,
    participantId: id,
    sessionId: id === "b" ? "owned-thread" : id,
    ownerId: `owner-${id}`,
    generation: 1,
    repositoryScope: "repo",
    capabilityFingerprint: "cap",
    policyFingerprint: "policy",
    supported: true,
    capabilityEvidence: [
      CapabilityEvidence.make({
        capability: "send",
        disposition: "verified",
        source: "injected boundary",
        observedAt: 0,
      }),
    ],
    policy: PolicySnapshot.make({
      provider: "injected",
      modelId: ModelId.make("fixture"),
      effort: "medium",
      sandbox: "full-access",
      approvalPolicy: "never",
      fingerprint: "policy",
      policyEvidence: "launch-enforced",
    }),
  });
const setup = Effect.fn("AttachedTest.setup")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
  yield* fs.chmod(directory, 0o700);
  const context = yield* agentMessageStoreLayer(path.join(directory, "store")).pipe(Layer.build);
  const store = yield* AgentMessageStore.pipe(Effect.provide(context));
  yield* store.register(binding("a"));
  yield* store.register(binding("b"));
  const now = yield* Clock.currentTimeMillis;
  const grant = LaunchGrant.make({
    grantId: "grant-b",
    endpointId: "b",
    generation: 1,
    ownerId: "owner-b",
    repositoryScope: "repo",
    conversationScope: O.some("conversation"),
    allowedRecipients: ["a"],
    expiresAt: now + 60000,
    maxMessages: 1,
  });
  yield* store.registerGrant(grant);
  const grantFile = path.join(directory, "grant.json");
  yield* fs.writeFileString(grantFile, yield* S.encodeEffect(GrantJson)(grant), { mode: 0o600 });
  const configuration = yield* decodeConfiguration({
    threadId: "owned-thread",
    modelSelection: {
      instanceId: "codex",
      model: "gpt-6.1-sol",
      options: [{ id: "reasoningEffort", value: "medium" }],
    },
    runtimeMode: "full-access",
    interactionMode: "default",
  });
  const profile = yield* decodeProfile({
    ownershipConfirmed: true,
    threadId: "owned-thread",
    projectId: "project",
    workspace: directory,
    endpointId: "b",
    participantId: "b",
    ownerId: "owner-b",
    generation: 1,
    repositoryScope: "repo",
    provider: "codex",
    expectedConfiguration: configuration,
    nativeBaseline: {
      sessionId: "native-baseline",
      policy: "never/full-access",
      observedAt: 1,
      source: "separate injected observation",
    },
    serverVersion: "fixture",
    sourceCommit: "fixture",
    artifactDigest: "fixture",
    url: "http://127.0.0.1:3773/mcp",
    oauthCredentialFile: grantFile,
    grantFile,
    peerExecutable: grantFile,
    waitTimeoutMs: 1000,
    conversationId: "conversation",
  });
  const envelope = Envelope.make({
    messageId: "incoming",
    idempotencyKey: "incoming",
    conversationId: "conversation",
    from: "a",
    to: { kind: "direct", endpointId: "b" },
    repositoryScope: "repo",
    body: "bounded communication",
    createdAt: now,
    expiresAt: now + 30000,
    capabilityFingerprint: "cap",
    policyFingerprint: "policy",
  });
  yield* store.accept(envelope, now);
  const claim = O.getOrThrow(yield* store.claimNext("b", "owner-b", now + 1, now + 20000));
  return { fs, directory, grantFile, grant, configuration, profile, context, store, claim, now };
});
const fixture = Effect.fn("AttachedTest.driver")(function* (
  state: Effect.Success<ReturnType<typeof setup>>,
  scenario: "ack" | "no-ack" | "drift" | "stale" | "lost" | "busy"
) {
  const sent = yield* Ref.make(0);
  const read = Effect.fnUntraced(function* () {
    const count = yield* Ref.get(sent);
    return yield* decodeRead({
      thread: {
        threadId: "owned-thread",
        projectId: "project",
        status: scenario === "busy" && count === 0 ? "running" : "completed",
        latestRunId: count > 0 ? "run" : null,
        activeRunId: scenario === "busy" && count === 0 ? "other-run" : null,
        providerInstanceId: "codex",
        model: "gpt-6.1-sol",
        runtimeMode: "full-access",
        interactionMode: "default",
        worktreePath: null,
      },
      recentRuns:
        count > 0
          ? [
              {
                runId: "run",
                ordinal: 1,
                status: "completed",
                providerInstanceId: "codex",
                model: "gpt-6.1-sol",
                requestedAt: "fixture",
                startedAt: "fixture",
                completedAt: "fixture",
              },
            ]
          : [],
      items: [],
      nextPosition: null,
      hasMore: false,
    });
  });
  return {
    sent,
    driver: T3Code.of({
      readConfiguration: Effect.fn("AttachedTest.readConfiguration")(() =>
        Ref.get(sent).pipe(
          Effect.map((count) =>
            scenario === "drift" && count > 0
              ? T3CodeConfiguration.make({ ...state.configuration, runtimeMode: "approval-required" })
              : state.configuration
          )
        )
      ),
      readProject: Effect.fn("AttachedTest.readProject")(() =>
        Effect.succeed(T3CodeProject.make({ id: "project", workspaceRoot: state.directory }))
      ),
      read: Effect.fn("AttachedTest.read")(() =>
        read().pipe(
          Effect.mapError(() =>
            T3CodeError.make({ operation: "read", reason: "protocol", submission: "not-submitted" })
          )
        )
      ),
      sendQueued: Effect.fnUntraced(function* (_thread, _text, requestKey) {
        expect(requestKey).toMatch(/^beep:[a-f0-9]{64}$/);
        yield* Ref.update(sent, (n) => n + 1);
        if (scenario === "lost")
          return yield* T3CodeError.make({ operation: "send", reason: "timeout", submission: "possibly-submitted" });
        if (scenario !== "no-ack")
          yield* state.store.acknowledge("incoming", "b", state.now + 2, O.some("grant-b")).pipe(Effect.orDie);
        return T3CodeSend.make({
          threadId: "owned-thread",
          messageId: "native-message",
          runId: "run",
          status: "queued",
          delivery: "queued",
        });
      }),
      waitExactRun: Effect.fn("AttachedTest.waitExactRun")(() =>
        Effect.succeed(
          T3CodeWait.make({
            threadId: "owned-thread",
            runId: scenario === "stale" ? "other-run" : "run",
            status: "completed",
            timedOut: false,
          })
        )
      ),
      interruptExactRun: Effect.fn("AttachedTest.interruptExactRun")(() =>
        Effect.succeed(T3CodeInterrupt.make({ threadId: "owned-thread", runId: null, status: "no_active_run" }))
      ),
    }),
  };
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("Attached T3 and scoped peer boundaries", (it) => {
  it.effect("requires scoped ACK and the exact settled native run", () =>
    Effect.gen(function* () {
      const state = yield* setup();
      const { driver, sent } = yield* fixture(state, "ack");
      const dispatch = yield* makeAttachedT3Dispatch(state.profile, state.directory).pipe(
        Effect.provideService(AgentMessageStore, state.store),
        Effect.provideService(T3Code, driver)
      );
      expect(yield* dispatch.submit(state.claim)).toBe("delivered");
      expect(yield* Ref.get(sent)).toBe(1);
    })
  );
  it.effect("does not treat native completion without participant ACK as consumption", () =>
    Effect.gen(function* () {
      const state = yield* setup();
      const { driver } = yield* fixture(state, "no-ack");
      const dispatch = yield* makeAttachedT3Dispatch(state.profile, state.directory).pipe(
        Effect.provideService(AgentMessageStore, state.store),
        Effect.provideService(T3Code, driver)
      );
      const result = yield* dispatch.submit(state.claim).pipe(Effect.result);
      result.pipe(Result.isFailure, Utils.assertTrue);
    })
  );
  it.effect("drift, stale runs and lost submission receipts fail without resubmission", () =>
    Effect.forEach(
      ["drift", "stale", "lost"] satisfies ReadonlyArray<"drift" | "stale" | "lost">,
      (scenario) =>
        Effect.gen(function* () {
          const state = yield* setup();
          const { driver, sent } = yield* fixture(state, scenario);
          const dispatch = yield* makeAttachedT3Dispatch(state.profile, state.directory).pipe(
            Effect.provideService(AgentMessageStore, state.store),
            Effect.provideService(T3Code, driver)
          );
          const result = yield* dispatch.submit(state.claim).pipe(Effect.result);
          result.pipe(Result.isFailure, Utils.assertTrue);
          expect(yield* Ref.get(sent)).toBe(1);
        }),
      { concurrency: 1 }
    )
  );
  it.effect("refuses busy enrollment but queues a distinct exact run for an enrolled busy peer", () =>
    Effect.gen(function* () {
      const state = yield* setup();
      const { driver, sent } = yield* fixture(state, "busy");
      const dispatch = yield* makeAttachedT3Dispatch(state.profile, state.directory).pipe(
        Effect.provideService(AgentMessageStore, state.store),
        Effect.provideService(T3Code, driver)
      );
      const enrollment = yield* verifyAttachedT3(state.profile, true).pipe(
        Effect.provideService(T3Code, driver),
        Effect.result
      );
      enrollment.pipe(Result.isFailure, Utils.assertTrue);
      expect(yield* dispatch.submit(state.claim)).toBe("delivered");
      expect(yield* Ref.get(sent)).toBe(1);
    })
  );
  it.effect("rejects validly queued foreign conversation and unallowed sender before native exposure", () =>
    Effect.forEach(
      ["outside-conversation", "unallowed-peer"],
      (scenario) =>
        Effect.gen(function* () {
          const state = yield* setup();
          yield* state.store.complete(state.claim, "failed", state.now + 2);
          const sender = scenario === "unallowed-peer" ? "c" : "a";
          const conversation = scenario === "outside-conversation" ? "outside" : "conversation";
          if (sender === "c") yield* state.store.register(binding("c"));
          const senderGrant = LaunchGrant.make({
            grantId: "sender-grant",
            endpointId: sender,
            generation: 1,
            ownerId: `owner-${sender}`,
            repositoryScope: "repo",
            conversationScope: O.some(conversation),
            allowedRecipients: ["b"],
            expiresAt: state.now + 60000,
            maxMessages: 1,
          });
          yield* state.store.registerGrant(senderGrant);
          const foreign = Envelope.make({
            ...state.claim.envelope,
            messageId: "foreign",
            idempotencyKey: "foreign",
            from: sender,
            conversationId: conversation,
          });
          expect((yield* state.store.acceptWithGrant(foreign, senderGrant.grantId, state.now + 3)).status).toBe(
            "accepted"
          );
          const claim = O.getOrThrow(yield* state.store.claimNext("b", "owner-b", state.now + 4, state.now + 20000));
          const { driver, sent } = yield* fixture(state, "ack");
          const dispatch = yield* makeAttachedT3Dispatch(state.profile, state.directory).pipe(
            Effect.provideService(AgentMessageStore, state.store),
            Effect.provideService(T3Code, driver)
          );
          expect(yield* dispatch.submit(claim)).toBe("failed");
          expect(yield* Ref.get(sent)).toBe(0);
        }),
      { concurrency: 1 }
    )
  );
  it.effect("peer handler failures stay failures and persisted conversation/budget limits apply", () =>
    Effect.gen(function* () {
      const state = yield* setup();
      const run = (conversationId: string, messageId: string) =>
        callAgentMessagePeer(state.grantFile, "agent_message_send", {
          conversationId,
          messageId,
          recipient: "a",
          body: "bounded",
        }).pipe(Effect.provideService(AgentMessageStore, state.store), Effect.result);
      yield* run("outside", "denied").pipe(Effect.map(Result.isFailure), Effect.map(Utils.assertTrue));
      yield* run("conversation", "outbound").pipe(Effect.map(Result.isSuccess), Effect.map(Utils.assertTrue));
      yield* run("conversation", "outbound").pipe(Effect.map(Result.isSuccess), Effect.map(Utils.assertTrue));
      const denied = yield* run("conversation", "over-budget");
      denied.pipe(Result.isFailure, Utils.assertTrue);
    })
  );
  it.effect("expired private grant references cannot acquire sender authority", () =>
    Effect.gen(function* () {
      const state = yield* setup();
      const expired = LaunchGrant.make({ ...state.grant, grantId: "expired", expiresAt: 0 });
      yield* state.store.registerGrant(expired);
      yield* state.fs.writeFileString(state.grantFile, yield* S.encodeEffect(GrantJson)(expired), { mode: 0o600 });
      const result = yield* callAgentMessagePeer(state.grantFile, "agent_message_inbox", {}).pipe(
        Effect.provideService(AgentMessageStore, state.store),
        Effect.result
      );
      result.pipe(Result.isFailure, Utils.assertTrue);
    })
  );
});

const ProfileJson = S.fromJsonString(AttachedT3Profile);
const BaselineJson = S.fromJsonString(AttachedT3NativeBaseline);
it.effect.prop(
  "private attachment declarations preserve identity and policy fields through the JSON boundary",
  [Arbitrary.schema(AttachedT3Profile)],
  ([profile]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ProfileJson)(profile);
      const decoded = yield* S.decodeEffect(ProfileJson)(encoded);
      expect(Equal.equals(decoded, profile)).toBe(true);
    })
);
it.effect.prop(
  "dated native baseline remains a separate roundtrippable attestation",
  [Arbitrary.schema(AttachedT3NativeBaseline)],
  ([baseline]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(BaselineJson)(baseline);
      const decoded = yield* S.decodeEffect(BaselineJson)(encoded);
      expect(Equal.equals(decoded, baseline)).toBe(true);
    })
);
