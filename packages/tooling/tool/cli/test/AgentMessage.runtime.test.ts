import {
  AgentMessageStore,
  EndpointBinding,
  EndpointDispatch,
  Envelope,
  makeAgentMessageStore,
  RouterError,
  runAgentMessageDispatchLoop,
} from "@beep/repo-cli/commands/AgentMessage";
import { makeAgentMessageSqliteClient } from "@beep/repo-cli/test/AgentMessage";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import type { AgentMessageStoreShape } from "@beep/repo-cli/commands/AgentMessage";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";

const lockTimeout = RouterError.make({
  code: "storage",
  message: "Agent message SQL operation failed: LockTimeoutError.",
});
const fixture = Effect.fnUntraced(function* <A, E, R>(
  run: (store: AgentMessageStoreShape, filename: string) => Effect.Effect<A, E, R>
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
        provider: "injected",
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

    it.effect("permanent storage and policy errors remain fatal and finalize the scope", () =>
      fixture((store) =>
        Effect.forEach(
          [
            RouterError.make({ code: "storage", message: "Agent message storage decoding failed: SchemaError." }),
            RouterError.make({ code: "policyMismatch", message: "Synthetic fatal policy mismatch." }),
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
                    [new URL("./fixtures/agent-message/process.ts", import.meta.url).pathname],
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
