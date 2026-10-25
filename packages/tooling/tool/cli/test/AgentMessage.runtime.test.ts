import * as NodeURL from "node:url";
import { ManagedLaunchProfile, ManagedTerminalEvidence, ManagedTurnResult } from "@beep/ai-provider-cli";
import {
  AgentMessageStore,
  agentMessageServeCommand,
  EndpointBinding,
  EndpointDispatch,
  Envelope,
  LaunchGrant,
  makeAgentMessageCompletion,
  makeAgentMessageStore,
  PolicySnapshot,
  Receipt,
  RouterError,
  runAgentMessageDispatchLoop,
} from "@beep/repo-cli/commands/AgentMessage";
import { recordNativeSettlement } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.runtime";
import { agentMessageStoreLayer, makeAgentMessageSqliteClient } from "@beep/repo-cli/test/AgentMessage";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import type { AgentMessageStoreShape } from "@beep/repo-cli/commands/AgentMessage";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";

const lockTimeout = RouterError.make({
  code: "storage",
  message: "Agent message SQL operation failed: LockTimeoutError.",
});
const ManagedProfileJson = S.fromJsonString(ManagedLaunchProfile);
const GrantJson = S.fromJsonString(LaunchGrant);
const ReceiptJson = S.fromJsonString(Receipt);
const managedCommandFixture = Effect.fn("AgentMessageTest.managedCommandFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "managed-command-" });
  yield* fs.chmod(directory, 0o700);
  const home = path.join(directory, "home");
  const workspace = path.join(directory, "workspace");
  yield* fs.makeDirectory(home, { mode: 0o700 });
  yield* fs.makeDirectory(workspace, { mode: 0o700 });
  const state = path.join(directory, "state");
  const filename = path.join(directory, "profile.json");
  const grantFile = path.join(directory, "grant.json");
  const profile = ManagedLaunchProfile.make({
    provider: "codex",
    executable: "bun",
    prefixArgs: [
      "run",
      path.resolve(import.meta.dirname, "../../../../drivers/ai-provider-cli/test/fixtures/managed-codex-peer.ts"),
    ],
    workspace,
    profileRoot: home,
    env: { HOME: home, CODEX_HOME: path.join(home, ".codex"), PATH: yield* Config.String("PATH") },
    authLane: "existing-subscription",
    tools: [],
  });
  const write = (value: ManagedLaunchProfile) =>
    S.encodeEffect(ManagedProfileJson)(value).pipe(
      Effect.flatMap((json) => fs.writeFileString(filename, json, { mode: 0o600 }))
    );
  yield* write(profile);
  const grant = LaunchGrant.make({
    grantId: "managed-grant",
    endpointId: "managed",
    generation: 1,
    ownerId: "managed-owner",
    repositoryScope: "fixture",
    conversationScope: O.some("conversation"),
    allowedRecipients: ["other"],
    expiresAt: (yield* Clock.currentTimeMillis) + Duration.toMillis(Duration.hours(1)),
    maxMessages: 5,
  });
  const writeGrant = (value: LaunchGrant) =>
    S.encodeEffect(GrantJson)(value).pipe(
      Effect.flatMap((json) => fs.writeFileString(grantFile, json, { mode: 0o600 }))
    );
  yield* writeGrant(grant);
  const run = Command.runWith(agentMessageServeCommand, { version: "test", renderErrors: false });
  const execute = run([
    "--state-dir",
    state,
    "--profile-file",
    filename,
    "--grant-file",
    grantFile,
    "--endpoint",
    "managed",
    "--participant",
    "managed",
    "--owner",
    "managed-owner",
    "--repository-scope",
    "fixture",
    "--generation",
    "1",
  ]);
  return { fs, state, filename, profile, write, grantFile, grant, writeGrant, execute };
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer, Reactivity.layer), {
  timeout: "20 seconds",
})("Managed serve CLI boundary", (it) => {
  it.effect("rejects missing, exposed and credential-bearing profiles before native launch", () =>
    Effect.gen(function* () {
      const f = yield* managedCommandFixture();
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const launches = yield* Ref.make(0);
      const watched = ChildProcessSpawner.make((command) =>
        Ref.update(launches, (count) => count + 1).pipe(Effect.andThen(spawner.spawn(command)))
      );
      yield* f.fs.remove(f.filename);
      expect(
        yield* f.execute.pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched), Effect.isFailure)
      ).toBe(true);
      expect(yield* Ref.get(launches)).toBe(0);
      yield* f.write(f.profile);
      yield* f.fs.remove(f.grantFile);
      expect(
        yield* f.execute.pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched), Effect.isFailure)
      ).toBe(true);
      expect(yield* Ref.get(launches)).toBe(0);
      yield* f.writeGrant(f.grant);
      yield* f.fs.chmod(f.grantFile, 0o644);
      expect(
        yield* f.execute.pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched), Effect.flip)
      ).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
      expect(yield* Ref.get(launches)).toBe(0);
      yield* f.fs.chmod(f.grantFile, 0o600);
      for (const sandboxWritablePaths of [[], [f.profile.workspace]]) {
        yield* f.write(ManagedLaunchProfile.make({ ...f.profile, provider: "grok", sandboxWritablePaths }));
        expect(
          yield* f.execute.pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched), Effect.flip)
        ).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
        expect(yield* Ref.get(launches)).toBe(0);
      }
      yield* f.write(f.profile);
      yield* f.write(f.profile);
      yield* f.fs.chmod(f.filename, 0o644);
      expect(
        yield* f.execute.pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched), Effect.flip)
      ).toMatchObject({ _tag: "RouterError", code: "policyMismatch" });
      expect(yield* Ref.get(launches)).toBe(0);
      yield* f.fs.chmod(f.filename, 0o600);
      yield* f.write(
        ManagedLaunchProfile.make({ ...f.profile, env: { ...f.profile.env, OPENAI_API_KEY: "synthetic-forbidden" } })
      );
      expect(
        yield* f.execute.pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched), Effect.flip)
      ).toMatchObject({ _tag: "ManagedSessionError", reason: "invalid-profile" });
      expect(yield* Ref.get(launches)).toBe(0);
    })
  );

  it.effect("rejects native permission drift and finalizes the launched Bun worker", () =>
    Effect.gen(function* () {
      const f = yield* managedCommandFixture();
      yield* f.write(
        ManagedLaunchProfile.make({
          ...f.profile,
          prefixArgs: [...f.profile.prefixArgs, "--beep-fixture-mode=wrong-policy"],
        })
      );
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const started = yield* Deferred.make<ChildProcessHandle>();
      const watched = ChildProcessSpawner.make((command) =>
        spawner.spawn(command).pipe(Effect.tap((child) => Deferred.succeed(started, child)))
      );
      expect(
        yield* f.execute.pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched), Effect.flip)
      ).toMatchObject({ _tag: "ManagedSessionError", reason: "policy-mismatch" });
      expect(yield* (yield* Deferred.await(started)).isRunning).toBe(false);
      const context = yield* Layer.build(agentMessageStoreLayer(f.state));
      expect(yield* Context.get(context, AgentMessageStore).endpoint("managed").pipe(Effect.isFailure)).toBe(true);
    }).pipe(TestClock.withLive)
  );

  it.effect("enrolls a real Bun worker and stops it after receiving-grant expiry", () =>
    Effect.gen(function* () {
      const f = yield* managedCommandFixture();
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const started = yield* Deferred.make<ChildProcessHandle>();
      const enrolled = yield* Deferred.make<void>();
      const rejected = yield* Deferred.make<Receipt, S.SchemaError>();
      const delivered = yield* Deferred.make<Receipt, S.SchemaError>();
      const expired = yield* Deferred.make<Receipt, S.SchemaError>();
      const watched = ChildProcessSpawner.make((command) =>
        spawner.spawn(command).pipe(Effect.tap((child) => Deferred.succeed(started, child)))
      );
      const originalConsole = yield* Console.Console;
      let printed = 0;
      const observedConsole = Console.Console.of({
        ...originalConsole,
        log: (...args) => {
          originalConsole.log(...args);
          Deferred.doneUnsafe(enrolled, Effect.void);
          if (++printed === 2) Deferred.doneUnsafe(rejected, S.decodeUnknownEffect(ReceiptJson)(args[0]));
          if (printed === 3) Deferred.doneUnsafe(delivered, S.decodeUnknownEffect(ReceiptJson)(args[0]));
          if (printed === 4) Deferred.doneUnsafe(expired, S.decodeUnknownEffect(ReceiptJson)(args[0]));
        },
      });
      const fiber = yield* f.execute.pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched),
        Effect.provideService(Console.Console, observedConsole),
        Effect.forkChild
      );
      const child = yield* Deferred.await(started);
      yield* Deferred.await(enrolled);
      const context = yield* Layer.build(agentMessageStoreLayer(f.state));
      const store = Context.get(context, AgentMessageStore);
      const binding = yield* store.endpoint("managed");
      expect(binding).toMatchObject({
        ownerId: "managed-owner",
        generation: 1,
        sessionId: "owned-thread",
        policy: { modelId: "gpt-6.1-sol", effort: "medium", approvalPolicy: "never" },
      });
      assertSome(
        O.map(binding.host, ({ mode, provider, backend }) => ({ mode, provider, backend })),
        {
          mode: "managed-process",
          provider: "codex",
          backend: "codex-app-server-stdio",
        }
      );
      expect(yield* child.isRunning).toBe(true);
      yield* store.register(
        EndpointBinding.make({
          ...binding,
          endpointId: "sender",
          participantId: "sender",
          ownerId: "sender-owner",
          sessionId: "sender-session",
        })
      );
      const now = yield* Clock.currentTimeMillis;
      yield* store.registerGrant(
        LaunchGrant.make({
          grantId: "sender-grant",
          endpointId: "sender",
          generation: 1,
          ownerId: "sender-owner",
          repositoryScope: "fixture",
          conversationScope: O.some("outside"),
          allowedRecipients: ["managed"],
          expiresAt: now + Duration.toMillis(Duration.hours(1)),
          maxMessages: 5,
        })
      );
      yield* store.acceptWithGrant(
        Envelope.make({
          messageId: "outside-conversation",
          idempotencyKey: "outside-conversation",
          conversationId: "outside",
          from: "sender",
          to: { kind: "direct", endpointId: "managed" },
          repositoryScope: "fixture",
          body: "must-not-reach-native-worker",
          createdAt: now,
          expiresAt: now + 60000,
          capabilityFingerprint: binding.capabilityFingerprint,
          policyFingerprint: binding.policyFingerprint,
        }),
        "sender-grant",
        now
      );
      expect(yield* Deferred.await(rejected)).toMatchObject({
        messageId: "outside-conversation",
        status: "failed",
        sequence: 3,
      });
      yield* store.accept(
        Envelope.make({
          messageId: "native-delivery",
          idempotencyKey: "native-delivery",
          conversationId: "conversation",
          from: "sender",
          to: { kind: "direct", endpointId: "managed" },
          repositoryScope: "fixture",
          body: "synthetic-only-task",
          createdAt: now,
          expiresAt: now + 60000,
          capabilityFingerprint: binding.capabilityFingerprint,
          policyFingerprint: binding.policyFingerprint,
        }),
        now
      );
      expect(yield* Deferred.await(delivered)).toMatchObject({
        messageId: "native-delivery",
        status: "delivered",
        sequence: 6,
      });
      expect((yield* store.receipts("native-delivery"))[2]?.status).toBe("delivered");
      assertSome(yield* store.settlement("native-delivery"), {
        adapter: "codex",
        sessionId: "owned-thread",
        messageId: "native-delivery",
        turnId: "owned-turn-1",
        outcome: "delivered",
        stopReason: "completed",
      });
      assertNone(yield* store.settlement("outside-conversation"));
      expect((yield* store.receipts("outside-conversation"))[2]?.status).toBe("failed");
      // Advance the persisted grant past expiry without waiting an hour of wall time.
      const sql = yield* makeAgentMessageSqliteClient(path.join(f.state, "messages.sqlite"));
      const expiredGrant = LaunchGrant.make({ ...f.grant, expiresAt: now - 1 });
      const expiredPayload = yield* S.encodeEffect(GrantJson)(expiredGrant);
      yield* sql`UPDATE agent_message_grants SET payload = ${expiredPayload} WHERE id = ${f.grant.grantId}`;
      const expiredEnvelope = Envelope.make({
        messageId: "expired-grant-delivery",
        idempotencyKey: "expired-grant-delivery",
        conversationId: "conversation",
        from: "sender",
        to: { kind: "direct", endpointId: "managed" },
        repositoryScope: "fixture",
        body: "must-not-reach-expired-worker",
        createdAt: now,
        expiresAt: now + 60000,
        capabilityFingerprint: binding.capabilityFingerprint,
        policyFingerprint: binding.policyFingerprint,
      });
      yield* store.accept(expiredEnvelope, now);
      const expiredReceipt = yield* Deferred.await(expired);
      expect(expiredReceipt).toMatchObject({ messageId: "expired-grant-delivery", status: "failed" });
      assertSome(expiredReceipt.detail, "invalidGrant: receiving grant expired or enrollment replaced.");
      expect(yield* Fiber.join(fiber).pipe(Effect.flip)).toMatchObject({ code: "invalidGrant" });
      const next = yield* store.accept(
        Envelope.make({
          ...expiredEnvelope,
          messageId: "after-expired-grant",
          idempotencyKey: "after-expired-grant",
        }),
        now
      );
      expect(next).toMatchObject({ messageId: "after-expired-grant", status: "accepted" });
      expect((yield* store.receipts("after-expired-grant"))[0]?.status).toBe("accepted");
      expect(yield* child.isRunning).toBe(false);
    }).pipe(TestClock.withLive)
  );
});
const fixture = Effect.fnUntraced(function* <A, E, R>(
  run: (store: AgentMessageStoreShape, filename: string) => Effect.Effect<A, E, R>,
  provider: PolicySnapshot["provider"] = "injected"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* Config.String("HOME");
  const cache = path.join(home, ".cache", "beep", "agent-message-tests");
  yield* fs.makeDirectory(cache, { recursive: true, mode: 0o700 });
  const directory = yield* fs.makeTempDirectoryScoped({ directory: cache, prefix: "runtime-" });
  const filename = path.join(directory, "messages.sqlite");
  const client = yield* makeAgentMessageSqliteClient(filename, Duration.millis(50));
  const store = yield* makeAgentMessageStore().pipe(Effect.provideService(SqlClient.SqlClient, client));
  yield* Effect.forEach(["sender", "target"], (endpointId) =>
    S.decodeEffect(EndpointBinding)({
      endpointId,
      participantId: endpointId,
      sessionId: `${endpointId}-session`,
      ownerId: `${endpointId}-owner`,
      generation: 1,
      repositoryScope: "fixture",
      capabilityFingerprint: "cap",
      policyFingerprint: "policy",
      supported: true,
      capabilityEvidence: [{ capability: "send", disposition: "verified", source: "injected fixture", observedAt: 0 }],
      policy: {
        provider,
        modelId: "fixture",
        effort: "medium",
        sandbox: "no-tools",
        approvalPolicy: "never",
        fingerprint: "policy",
        policyEvidence: "launch-enforced",
      },
    }).pipe(Effect.flatMap(store.register))
  );
  const now = yield* Clock.currentTimeMillis;
  yield* store.accept(
    Envelope.make({
      messageId: "message",
      idempotencyKey: "message",
      conversationId: "conversation",
      from: "sender",
      to: { kind: "direct", endpointId: "target" },
      repositoryScope: "fixture",
      body: "synthetic",
      createdAt: now,
      expiresAt: now + 86400000,
      capabilityFingerprint: "cap",
      policyFingerprint: "policy",
    }),
    now
  );
  return yield* run(store, filename);
});

it.layer(Layer.mergeAll(NodeServices.layer, Reactivity.layer), { timeout: "10 seconds" })(
  "Managed mailbox resilience",
  (it) => {
    it.effect("retries recover, claim and completion without resubmitting a consumed prompt", () =>
      fixture((store) =>
        Effect.gen(function* () {
          const finished = yield* Deferred.make<void>();
          let recoverCalls = 0;
          let claimCalls = 0;
          let completeCalls = 0;
          let submits = 0;
          const wrapped: AgentMessageStoreShape = {
            ...store,
            recover: Effect.fnUntraced(function* (now: number) {
              if (++recoverCalls <= 2) return yield* lockTimeout;
              return yield* store.recover(now);
            }),
            claimNext: Effect.fnUntraced(function* (...args: Parameters<AgentMessageStoreShape["claimNext"]>) {
              if (++claimCalls <= 2) return yield* lockTimeout;
              return yield* store.claimNext(...args);
            }),
            complete: Effect.fnUntraced(function* (...args: Parameters<AgentMessageStoreShape["complete"]>) {
              if (++completeCalls <= 2) return yield* lockTimeout;
              const receipt = yield* store.complete(...args);
              yield* Deferred.succeed(finished, undefined);
              return receipt;
            }),
          };
          const fiber = yield* runAgentMessageDispatchLoop("target", "target-owner").pipe(
            Effect.provideService(AgentMessageStore, wrapped),
            Effect.provideService(EndpointDispatch, {
              submit: Effect.fnUntraced(function* () {
                submits++;
                yield* store.acknowledge("message", "target", 0);
                return yield* Effect.succeed<"delivered">("delivered");
              }),
            }),
            Effect.forkChild
          );
          yield* TestClock.adjust(Duration.seconds(2));
          yield* Deferred.await(finished);
          expect(submits).toBe(1);
          expect(completeCalls).toBe(3);
          expect((yield* store.acknowledge("message", "target", 0)).status).toBe("acknowledged");
          yield* Fiber.interrupt(fiber);
        })
      )
    );

    it.effect("rejects missing, foreign and contradictory native settlement evidence without changing the hold", () =>
      fixture(
        (store) =>
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis;
            const claim = O.getOrThrow(yield* store.claimNext("target", "target-owner", now, now + 30000));
            const absent = ManagedTurnResult.make({
              messageId: claim.envelope.messageId,
              text: "",
              stopReason: "completed",
            });
            const correlated = ManagedTurnResult.make({
              ...absent,
              terminalEvidence: O.some(
                ManagedTerminalEvidence.make({
                  adapter: "codex",
                  sessionId: "target-session",
                  messageId: claim.envelope.messageId,
                  turnId: "synthetic-original-turn",
                  outcome: "delivered",
                  stopReason: "completed",
                })
              ),
            });
            const foreign = ManagedTurnResult.make({ ...correlated, messageId: "foreign-message" });
            const contradictory = ManagedTurnResult.make({ ...correlated, stopReason: "interrupted" });
            const failures = yield* Effect.forEach([absent, foreign, contradictory], (response) =>
              recordNativeSettlement(store, claim, response).pipe(Effect.flip)
            );
            expect(A.map(failures, (failure) => failure.code)).toEqual(["conflict", "conflict", "conflict"]);
            expect(failures[2]?.message).toBe(
              "Native response contradicts its terminal evidence; retain the dispatch hold."
            );
            assertNone(yield* store.settlement(claim.envelope.messageId));
            expect(A.map(yield* store.receipts(claim.envelope.messageId), (receipt) => receipt.status)).toEqual([
              "accepted",
              "claimed",
            ]);
          }),
        "codex"
      )
    );

    it.effect("native settlement retries one mailbox lock before delivery and does not retry other errors", () =>
      Effect.gen(function* () {
        const clock = yield* TestClock.make();
        return yield* fixture((store) =>
          Effect.gen(function* () {
            const original = yield* store.endpoint("target");
            yield* store.register(
              EndpointBinding.make({
                ...original,
                endpointId: "native",
                participantId: "native",
                ownerId: "native-owner",
                sessionId: "native-session",
                policy: PolicySnapshot.make({ ...original.policy, provider: "codex" }),
              })
            );
            const now = yield* Clock.currentTimeMillis;
            const envelope = Envelope.make({
              ...(yield* store.message("message")),
              messageId: "native-message",
              idempotencyKey: "native-message",
              to: { kind: "direct", endpointId: "native" },
            });
            yield* store.accept(envelope, now);
            const claim = O.getOrThrow(yield* store.claimNext("native", "native-owner", now, now + 30000));
            const evidence = ManagedTerminalEvidence.make({
              adapter: "codex",
              sessionId: "native-session",
              messageId: envelope.messageId,
              turnId: "original-native-turn",
              outcome: "delivered",
              stopReason: "completed",
            });
            const response = ManagedTurnResult.make({
              messageId: envelope.messageId,
              text: "",
              stopReason: "completed",
              terminalEvidence: O.some(evidence),
            });
            let writes = 0;
            const attempted = yield* Deferred.make<void>();
            const wrapped: AgentMessageStoreShape = {
              ...store,
              recordSettlement: Effect.fnUntraced(function* (
                ...args: Parameters<AgentMessageStoreShape["recordSettlement"]>
              ) {
                writes++;
                if (writes === 1) {
                  yield* Deferred.succeed(attempted, undefined);
                  return yield* lockTimeout;
                }
                return yield* store.recordSettlement(...args);
              }),
            };
            const recording = yield* recordNativeSettlement(wrapped, claim, response).pipe(Effect.forkChild);
            yield* Deferred.await(attempted);
            assertNone(yield* store.settlement(envelope.messageId));
            expect(A.map(yield* store.receipts(envelope.messageId), (receipt) => receipt.status)).toEqual([
              "accepted",
              "claimed",
            ]);
            yield* clock.adjust(Duration.millis(250));
            const status = yield* Fiber.join(recording);
            expect(status).toBe("delivered");
            expect(writes).toBe(2);
            assertSome(yield* store.settlement(envelope.messageId), evidence);
            expect((yield* store.complete(claim, status, yield* Clock.currentTimeMillis)).status).toBe("delivered");
            const failure = RouterError.make({ code: "conflict", message: "Synthetic non-lock settlement failure." });
            let failures = 0;
            const rejected = yield* recordNativeSettlement(
              {
                ...store,
                recordSettlement: Effect.fnUntraced(function* () {
                  failures++;
                  return yield* failure;
                }),
              },
              claim,
              response
            ).pipe(Effect.flip);
            expect(rejected).toEqual(failure);
            expect(failures).toBe(1);
          })
        ).pipe(Effect.provideService(Clock.Clock, clock));
      })
    );

    it.effect("an invalid receiving grant remains fatal when completion exhausts its lock retries", () =>
      Effect.gen(function* () {
        const clock = yield* TestClock.make();
        return yield* fixture((store) =>
          Effect.gen(function* () {
            const invalid = RouterError.make({ code: "invalidGrant", message: "Pinned receiving grant expired." });
            const priorLogs = (yield* TestConsole.logLines).length;
            const invalidReceivingGrant = yield* Ref.make(O.none<RouterError>());
            let completions = 0;
            let submissions = 0;
            const wrapped: AgentMessageStoreShape = {
              ...store,
              complete: makeAgentMessageCompletion(
                {
                  ...store,
                  complete: Effect.fnUntraced(function* () {
                    completions++;
                    return yield* lockTimeout;
                  }),
                },
                invalidReceivingGrant
              ),
            };
            const fiber = yield* runAgentMessageDispatchLoop("target", "target-owner").pipe(
              Effect.provideService(AgentMessageStore, wrapped),
              Effect.provideService(EndpointDispatch, {
                submit: Effect.fnUntraced(function* () {
                  submissions++;
                  yield* Ref.set(invalidReceivingGrant, O.some(invalid));
                  return yield* invalid;
                }),
              }),
              Effect.forkChild
            );
            yield* clock.adjust(Duration.seconds(3));
            expect(yield* Fiber.join(fiber).pipe(Effect.flip)).toEqual(invalid);
            expect(completions).toBe(9);
            expect(submissions).toBe(1);
            expect(A.map(yield* store.receipts("message"), (receipt) => receipt.status)).toEqual([
              "accepted",
              "claimed",
            ]);
            assertNone(yield* store.claimNext("target", "target-owner", 3000, 4000));
            const logs = A.filter(A.drop(yield* TestConsole.logLines, priorLogs), S.is(S.String));
            expect(A.filterMap(logs, (line) => S.decodeResult(ReceiptJson)(line))).toEqual([]);
            expect(A.some(logs, Str.includes("receipt was not persisted"))).toBe(true);
          })
        ).pipe(Effect.provideService(Clock.Clock, clock));
      })
    );

    it.effect("exhausted completion retries retain the claim and owned process until cancellation", () =>
      fixture((store) =>
        Effect.gen(function* () {
          const exhausted = yield* Deferred.make<void>();
          const started = yield* Deferred.make<ChildProcessHandle>();
          let submits = 0;
          let attempts = 0;
          const wrapped: AgentMessageStoreShape = {
            ...store,
            complete: Effect.fnUntraced(function* () {
              if (++attempts === 9) yield* Deferred.succeed(exhausted, undefined);
              return yield* lockTimeout;
            }),
          };
          const fiber = yield* Effect.scoped(
            Effect.gen(function* () {
              const child = yield* ChildProcess.make(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
                stdout: "ignore",
                stderr: "inherit",
              });
              yield* Deferred.succeed(started, child);
              yield* runAgentMessageDispatchLoop("target", "target-owner").pipe(
                Effect.provideService(AgentMessageStore, wrapped),
                Effect.provideService(EndpointDispatch, {
                  submit: () =>
                    Effect.sync(() => {
                      submits++;
                      return "delivered";
                    }),
                })
              );
            })
          ).pipe(Effect.forkChild);
          const child = yield* Deferred.await(started);
          yield* TestClock.adjust(Duration.seconds(3));
          yield* Deferred.await(exhausted);
          expect(submits).toBe(1);
          expect(attempts).toBe(9);
          expect(yield* child.isRunning).toBe(true);
          assertNone(yield* store.claimNext("target", "target-owner", 3000, 183000));
          yield* Fiber.interrupt(fiber);
          expect(yield* child.isRunning).toBe(false);
        })
      )
    );

    it.effect("late terminal completion keeps the worker alive for ambiguity recovery without another submission", () =>
      fixture((store) =>
        Effect.gen(function* () {
          const recovered = yield* Deferred.make<void>();
          let elapsed = 0;
          let submissions = 0;
          const wrapped: AgentMessageStoreShape = {
            ...store,
            complete: (claim, status, now, detail) => store.complete(claim, status, now + elapsed, detail),
            recover: Effect.fnUntraced(function* (now: number) {
              const count = yield* store.recover(now + elapsed);
              if (count === 1) yield* Deferred.succeed(recovered, undefined);
              return count;
            }),
          };
          const fiber = yield* runAgentMessageDispatchLoop("target", "target-owner").pipe(
            Effect.provideService(AgentMessageStore, wrapped),
            Effect.provideService(EndpointDispatch, {
              submit: () =>
                Effect.sync(() => {
                  submissions++;
                  elapsed = 190000;
                  return "delivered";
                }),
            }),
            Effect.forkChild
          );
          yield* Deferred.await(recovered);
          expect(fiber.pollUnsafe()).toBeUndefined();
          expect(submissions).toBe(1);
          expect(A.map(yield* store.receipts("message"), (receipt) => receipt.status)).toEqual([
            "accepted",
            "claimed",
            "ambiguous",
          ]);
          const now = yield* Clock.currentTimeMillis;
          assertNone(yield* store.claimNext("target", "target-owner", now + elapsed, now + elapsed + 1000));
          yield* Fiber.interrupt(fiber);
        })
      ).pipe(TestClock.withLive)
    );

    it.effect("permanent storage and policy errors remain fatal and finalize the scope", () =>
      fixture((store) =>
        Effect.forEach(
          [
            RouterError.make({ code: "storage", message: "Agent message storage decoding failed: SchemaError." }),
            RouterError.make({ code: "policyMismatch", message: "Synthetic fatal policy mismatch." }),
            RouterError.make({ code: "staleClaim", message: "Dispatch lease expired before its result was recorded." }),
          ],
          (failure) =>
            Effect.gen(function* () {
              let attempts = 0;
              let finalized = false;
              const error = yield* Effect.gen(function* () {
                yield* Effect.addFinalizer(() =>
                  Effect.sync(() => {
                    finalized = true;
                  })
                );
                yield* runAgentMessageDispatchLoop("target", "target-owner").pipe(
                  Effect.provideService(AgentMessageStore, {
                    ...store,
                    recover: Effect.fnUntraced(function* () {
                      attempts++;
                      return yield* failure;
                    }),
                  }),
                  Effect.provideService(EndpointDispatch, { submit: () => Effect.succeed("delivered") })
                );
              }).pipe(Effect.scoped, Effect.flip);
              expect(error).toEqual(failure);
              expect(attempts).toBe(1);
              expect(finalized).toBe(true);
            })
        )
      )
    );

    it.effect("a released real SQLite writer lock drains completion without another prompt", () =>
      fixture((store, filename) =>
        Effect.gen(function* () {
          const scope = yield* Scope.Scope;
          const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
          const fs = yield* FileSystem.FileSystem;
          const checkpoint = `${filename}.lock`;
          const completed = yield* Deferred.make<void>();
          const lockedProcess = yield* Deferred.make<ChildProcessHandle>();
          let submits = 0;
          let contention = 0;
          const wrapped: AgentMessageStoreShape = {
            ...store,
            complete: Effect.fnUntraced(function* (...args: Parameters<AgentMessageStoreShape["complete"]>) {
              return yield* store.complete(...args).pipe(
                Effect.tapError((error) =>
                  error.message === lockTimeout.message
                    ? Effect.gen(function* () {
                        contention++;
                        const lock = yield* Deferred.await(lockedProcess);
                        yield* fs.writeFileString(`${checkpoint}.release`, "release", { mode: 0o600 });
                        expect(Number(yield* lock.exitCode)).toBe(0);
                      })
                    : Effect.void
                ),
                Effect.tap(() => Deferred.succeed(completed, undefined)),
                Effect.catchTag("PlatformError", () =>
                  RouterError.make({ code: "storage", message: "Synthetic lock release fixture failed." })
                )
              );
            }),
          };
          const fiber = yield* runAgentMessageDispatchLoop("target", "target-owner").pipe(
            Effect.provideService(AgentMessageStore, wrapped),
            Effect.provideService(EndpointDispatch, {
              submit: Effect.fnUntraced(
                function* () {
                  submits++;
                  const lock = yield* ChildProcess.make(
                    process.execPath,
                    [NodeURL.fileURLToPath(new URL("./fixtures/agent-message/process.ts", import.meta.url))],
                    {
                      env: {
                        BEEP_MESSAGE_FIXTURE_DATABASE: filename,
                        BEEP_MESSAGE_FIXTURE_CHECKPOINT: checkpoint,
                        BEEP_MESSAGE_FIXTURE_STAGE: "lock",
                      },
                      stdout: "ignore",
                      stderr: "inherit",
                    }
                  );
                  yield* Deferred.succeed(lockedProcess, lock);
                  yield* fs
                    .exists(checkpoint)
                    .pipe(Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: identity<boolean> }));
                  return yield* Effect.succeed<"delivered">("delivered");
                },
                Effect.provideService(Scope.Scope, scope),
                Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
                Effect.mapError(() => RouterError.make({ code: "storage", message: "Synthetic lock fixture failed." }))
              ),
            }),
            Effect.forkChild
          );
          yield* Deferred.await(completed);
          expect(submits).toBe(1);
          expect(contention).toBe(1);
          expect((yield* store.receipts("message"))[2]?.status).toBe("delivered");
          yield* Fiber.interrupt(fiber);
        })
      ).pipe(TestClock.withLive)
    );
  }
);
