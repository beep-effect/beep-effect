import {
  AiProviderCliSession,
  ManagedLaunchProfile,
  ManagedSessionError,
  ManagedSessionMessage,
  ManagedSessionSteering,
} from "@beep/ai-provider-cli";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Config from "effect/Config";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as References from "effect/References";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import type { ManagedSessionIdentity, ManagedSessionProcess } from "@beep/ai-provider-cli";

const TestLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, AiProviderCliSession.layer);
const decodeReceivedParams = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const syntheticProfile = Effect.fn("SessionTest.profile")(function* (
  provider: ManagedLaunchProfile["provider"],
  mode = "echo"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();
  const home = path.join(root, "home");
  const workspace = path.join(root, "workspace");
  yield* fs.makeDirectory(workspace);
  return ManagedLaunchProfile.make({
    provider,
    executable: "bun",
    prefixArgs: [
      "run",
      path.join(import.meta.dirname, `fixtures/managed-${provider}-peer.ts`),
      `--beep-fixture-mode=${mode}`,
    ],
    workspace,
    profileRoot: home,
    env: {
      HOME: home,
      PATH: yield* Config.String("PATH"),
      ...(provider === "codex" ? { CODEX_HOME: path.join(home, ".codex") } : {}),
    },
    authLane: "existing-subscription",
    tools: [],
  });
});
it.layer(TestLayer, { timeout: "20 seconds", concurrent: false })(
  "managed native sessions",
  function registerManagedSessionCases(it) {
    it.effect("observes actual child handles and validated identities exactly once on all managed adapters", () =>
      Effect.gen(function* () {
        const sessions = yield* AiProviderCliSession;
        for (const provider of ["codex", "claude", "grok", "cursor"] as const) {
          const order = yield* Ref.make<ReadonlyArray<string>>([]);
          const spawned = yield* Deferred.make<ManagedSessionProcess>();
          const profile = yield* syntheticProfile(provider);
          const session = yield* sessions.open(profile, {
            started: Effect.fn("SessionObserverTest.started")(function* (process: ManagedSessionProcess) {
              assert.isAbove(process.pid, 0);
              assert.isTrue(yield* process.isRunning.pipe(Effect.orDie));
              yield* Deferred.succeed(spawned, process);
              yield* Ref.update(order, (events) => [...events, "started"]);
            }),
            bound: Effect.fn("SessionObserverTest.bound")(function* (identity: ManagedSessionIdentity) {
              assert.equal(identity.provider, provider);
              assert.isNotEmpty(identity.sessionId);
              yield* Ref.update(order, (events) => [...events, "bound"]);
            }),
          });
          assert.deepEqual(yield* Ref.get(order), ["started", "bound"]);
          assert.equal(session.process.pid, (yield* Deferred.await(spawned)).pid);
          yield* session.close;
          assert.isFalse(yield* session.process.isRunning);
        }
      })
    );

    for (const phase of ["started", "bound"] as const) {
      it.effect(`closes the real child before returning an uncertain ${phase} observation failure`, () =>
        Effect.gen(function* () {
          const sessions = yield* AiProviderCliSession;
          for (const provider of ["codex", "claude", "grok", "cursor"] as const) {
            const spawned = yield* Deferred.make<ManagedSessionProcess>();
            const counts = yield* Ref.make({ started: 0, bound: 0 });
            const rejected = ManagedSessionError.make({
              reason: "transport",
              operation: "synthetic-observer",
              message: "PRIVATE-OBSERVER-CANARY",
            });
            const result = yield* sessions
              .open(yield* syntheticProfile(provider), {
                started: Effect.fn("SessionObserverTest.started")(function* (process: ManagedSessionProcess) {
                  yield* Deferred.succeed(spawned, process);
                  yield* Ref.update(counts, (value) => ({ ...value, started: value.started + 1 }));
                  if (phase === "started") return yield* rejected;
                }),
                bound: () =>
                  Ref.update(counts, (value) => ({ ...value, bound: value.bound + 1 })).pipe(
                    Effect.andThen(Effect.fail(rejected))
                  ),
              })
              .pipe(Effect.flip);
            assert.equal(result.operation, `observe-${phase}`);
            assert.notInclude(result.message, "PRIVATE-OBSERVER-CANARY");
            assert.deepEqual(yield* Ref.get(counts), { started: 1, bound: phase === "started" ? 0 : 1 });
            // This assertion runs while the caller scope is still alive.
            assert.isFalse(yield* (yield* Deferred.await(spawned)).isRunning);
          }
        })
      );
    }

    it.effect("does not bind an identity rejected by runtime validation", () =>
      Effect.gen(function* () {
        const spawned = yield* Deferred.make<ManagedSessionProcess>();
        const bound = yield* Ref.make(0);
        const result = yield* (yield* AiProviderCliSession)
          .open(yield* syntheticProfile("codex", "wrong-policy"), {
            started: (process) => Deferred.succeed(spawned, process).pipe(Effect.asVoid),
            bound: () => Ref.update(bound, (count) => count + 1),
          })
          .pipe(Effect.flip);
        assert.equal(result.reason, "policy-mismatch");
        assert.equal(yield* Ref.get(bound), 0);
        assert.isFalse(yield* (yield* Deferred.await(spawned)).isRunning);
      })
    );

    it.effect("rejects unreviewed environment keys before creating a process or provider home", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const sessions = yield* AiProviderCliSession;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const launches = yield* Ref.make(0);
        const watched = ChildProcessSpawner.make((command) =>
          Ref.update(launches, (count) => count + 1).pipe(Effect.andThen(spawner.spawn(command)))
        );
        for (const provider of ["claude", "codex", "cursor", "grok"] as const) {
          const profile = yield* syntheticProfile(provider);
          for (const key of [
            "CURSOR_API_KEY",
            "CODEX_API_KEY",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "XAI_API_KEY",
            "OPENAI_BASE_URL",
            "ANTHROPIC_BASE_URL",
            "GROK_BASE_URL",
            "NODE_OPTIONS",
            "BUN_OPTIONS",
            "LD_PRELOAD",
            "LC_ALL",
            "TMPDIR",
            "XDG_CONFIG_HOME",
            "FIXTURE_MODE",
            "STALL_AT",
            "UNKNOWN_KEY",
            ...(provider === "codex" ? [] : ["CODEX_HOME"]),
          ]) {
            const rejected = yield* sessions
              .open(
                ManagedLaunchProfile.make({
                  ...profile,
                  env: { ...profile.env, [key]: "synthetic-private-value" },
                })
              )
              .pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, watched), Effect.flip);
            assert.equal(rejected.reason, "invalid-profile");
            assert.notInclude(rejected.message, "synthetic-private-value");
          }
          assert.equal(yield* fs.exists(profile.profileRoot), false);
        }
        assert.equal(yield* Ref.get(launches), 0);
      })
    );

    it.effect("fences prompts after idle Claude EOF and finalizes only once", () =>
      Effect.gen(function* () {
        const profile = yield* syntheticProfile("claude", "idle-exit");
        const session = yield* (yield* AiProviderCliSession).open(profile);
        const ended = yield* Deferred.make<void>();
        let closedEvents = 0;
        yield* session.events.pipe(
          Stream.runForEach((event) =>
            event.kind === "closed"
              ? Effect.sync(() => {
                  closedEvents++;
                }).pipe(Effect.andThen(Deferred.succeed(ended, undefined)))
              : Effect.void
          ),
          Effect.forkChild
        );
        yield* Effect.yieldNow;
        const first = yield* session.prompt(ManagedSessionMessage.make({ messageId: "first", text: "first" }));
        assert.equal(first.text, "first");
        yield* Deferred.await(ended);
        const later = yield* session
          .prompt(ManagedSessionMessage.make({ messageId: "later", text: "later" }))
          .pipe(Effect.flip);
        assert.equal(later.reason, "closed");
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        assert.equal(yield* fs.readFileString(path.join(profile.profileRoot, "received-prompt")), "first");
        yield* session.close;
        yield* session.close;
        yield* Effect.yieldNow;
        assert.equal(closedEvents, 1);
      }).pipe(Effect.timeout("5 seconds"), TestClock.withLive)
    );

    it.effect("fences both the active and queued prompt when Claude terminates without a result", () =>
      Effect.gen(function* () {
        const profile = yield* syntheticProfile("claude", "active-exit");
        const session = yield* (yield* AiProviderCliSession).open(profile);
        const started = yield* Deferred.make<void>();
        const queued = yield* Deferred.make<void>();
        yield* session.events.pipe(
          Stream.runForEach((event) =>
            event.kind === "update"
              ? Deferred.succeed(started, undefined)
              : event.kind === "deferred"
                ? Deferred.succeed(queued, undefined)
                : Effect.void
          ),
          Effect.forkChild
        );
        yield* Effect.yieldNow;
        const active = yield* session
          .prompt(ManagedSessionMessage.make({ messageId: "first", text: "first" }))
          .pipe(Effect.flip, Effect.forkChild);
        yield* Deferred.await(started);
        const waiting = yield* session
          .prompt(ManagedSessionMessage.make({ messageId: "queued", text: "queued" }))
          .pipe(Effect.flip, Effect.forkChild);
        yield* Deferred.await(queued);
        yield* session.cancel;
        assert.equal((yield* Fiber.join(active)).reason, "closed");
        assert.equal((yield* Fiber.join(waiting)).reason, "closed");
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        assert.equal(yield* fs.readFileString(path.join(profile.profileRoot, "received-prompt")), "first");
      }).pipe(Effect.timeout("5 seconds"), TestClock.withLive)
    );

    it.effect("preserves successful denial-phrase responses and subsequent session health", () =>
      Effect.gen(function* () {
        for (const provider of ["claude", "codex", "grok", "cursor"] as const) {
          const profile = yield* syntheticProfile(provider, "quoted-denial");
          const session = yield* (yield* AiProviderCliSession).open(profile);
          for (const messageId of ["first", "second"]) {
            const result = yield* session.prompt(
              ManagedSessionMessage.make({ messageId, text: "Upgrade your plan to continue" })
            );
            assert.equal(
              result.text,
              provider === "cursor"
                ? 'The documentation says "Upgrade your plan to continue"; this is quoted output.'
                : "Upgrade your plan to continue"
            );
          }
          yield* session.close;
        }
      })
    );

    it.effect(
      "sends Grok and Cursor a pure generation-1 ACP handshake",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        // The v1 fixtures write each inbound request's params to `received-<method>.json` in HOME.
        const received = (profile: ManagedLaunchProfile, file: string) =>
          fs
            .readFileString(path.join(profile.profileRoot, `received-${file}.json`))
            .pipe(Effect.flatMap(decodeReceivedParams));
        for (const provider of ["grok", "cursor"] as const) {
          const profile = ManagedLaunchProfile.make({
            ...(yield* syntheticProfile(provider)),
            tools: [{ name: "peer", command: "synthetic-mcp", args: ["--stdio"], env: { MODE: "fixture" } }],
          });
          const session = yield* (yield* AiProviderCliSession).open(profile);
          // Exact equality rules out the generation-2 negotiation fields `info` and `capabilities`.
          assert.deepStrictEqual(yield* received(profile, "initialize"), {
            protocolVersion: 1,
            clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
            clientInfo: { name: "beep-managed-session", version: "1" },
          });
          assert.deepStrictEqual(yield* received(profile, "session-new"), {
            cwd: profile.workspace,
            mcpServers: [
              { name: "peer", command: "synthetic-mcp", args: ["--stdio"], env: [{ name: "MODE", value: "fixture" }] },
            ],
          });
          if (provider === "grok")
            assert.deepStrictEqual(yield* received(profile, "authenticate"), {
              methodId: "cached_token",
              _meta: { headless: true },
            });
          else
            assert.deepStrictEqual(yield* received(profile, "session-set_mode"), {
              sessionId: session.identity.sessionId,
              modeId: "ask",
            });
          yield* session.close;
        }
      })
    );

    it.effect(
      "writes scoped Codex tool configuration and denies steering after disposal",
      Effect.fnUntraced(function* () {
        const profile = yield* syntheticProfile("codex");
        const configured = ManagedLaunchProfile.make({
          ...profile,
          tools: [{ name: "peer", command: "false", args: ["synthetic"], env: { MODE: "fixture" } }],
        });
        const session = yield* (yield* AiProviderCliSession).open(configured);
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const content = yield* fs.readFileString(path.join(profile.profileRoot, ".codex/config.toml"));
        assert.include(content, '[mcp_servers."peer".env]');
        assert.include(content, '"MODE" = "fixture"');
        yield* session.cancel;
        yield* session.close;
        const error = yield* session
          .steer(
            ManagedSessionSteering.make({
              expectedTurnId: "none",
              message: ManagedSessionMessage.make({ messageId: "late", text: "synthetic" }),
            })
          )
          .pipe(Effect.flip);
        assert.equal(error.reason, "closed");
      })
    );
    it.effect(
      "rejects unknown child executable as sanitized transport failure",
      Effect.fnUntraced(function* () {
        const profile = yield* syntheticProfile("claude");
        const error = yield* (yield* AiProviderCliSession)
          .open(ManagedLaunchProfile.make({ ...profile, executable: "/missing/synthetic-driver" }))
          .pipe(Effect.flip);
        assert.equal(error.reason, "transport");
        assert.equal(error.operation, "spawn");
      })
    );
    it.effect(
      "cancels Grok and refuses unqualified active steering",
      Effect.fnUntraced(function* () {
        const session = yield* (yield* AiProviderCliSession).open(yield* syntheticProfile("grok"));
        const error = yield* session
          .steer(
            ManagedSessionSteering.make({
              expectedTurnId: "none",
              message: ManagedSessionMessage.make({ messageId: "steer", text: "synthetic" }),
            })
          )
          .pipe(Effect.flip);
        assert.equal(error.reason, "unsupported");
        yield* session.cancel;
        yield* session.close;
      })
    );

    it.effect(
      "classifies a native process that exits mid-prompt as closed and logs only its redacted stderr",
      Effect.fnUntraced(function* () {
        const profile = yield* syntheticProfile("grok", "exit-on-prompt");
        const session = yield* (yield* AiProviderCliSession).open(profile);
        const excerpts: Array<unknown> = [];
        const collector = Logger.make<unknown, void>((options) => {
          const excerpt = options.fiber.getRef(References.CurrentLogAnnotations)["process.stderr_excerpt"];
          if (excerpt !== undefined) excerpts.push(excerpt);
        });
        const error = yield* session
          .prompt(ManagedSessionMessage.make({ messageId: "exited", text: "synthetic" }))
          .pipe(
            Effect.provideService(Logger.CurrentLoggers, new Set([collector])),
            Effect.provideService(References.MinimumLogLevel, "Debug"),
            Effect.flip
          );
        assert.equal(error.reason, "closed");
        assert.equal(error.operation, "prompt");
        assert.notInclude(error.message, "synthetic-secret-token");
        assert.deepStrictEqual(excerpts, ["fatal: ~/.grok/auth.json rejected Bearer [redacted]"]);
      })
    );

    for (const mode of ["malformed-resume", "malformed-turn", "failed-turn"]) {
      it.effect(
        `fences Codex ${mode} without replaying`,
        Effect.fnUntraced(function* () {
          const session = yield* (yield* AiProviderCliSession).open(yield* syntheticProfile("codex", mode));
          const first = yield* session
            .prompt(ManagedSessionMessage.make({ messageId: "first", text: "synthetic" }))
            .pipe(Effect.result);
          const failure =
            mode === "malformed-resume"
              ? yield* session
                  .prompt(ManagedSessionMessage.make({ messageId: "second", text: "synthetic" }))
                  .pipe(Effect.flip)
              : first._tag === "Failure"
                ? first.failure
                : undefined;
          assert.equal(failure?.reason, mode === "malformed-resume" ? "policy-mismatch" : "provider-failure");
          const late = yield* session
            .prompt(ManagedSessionMessage.make({ messageId: "late", text: "synthetic" }))
            .pipe(Effect.flip);
          assert.equal(late.reason, "closed");
        })
      );
    }
    for (const mode of ["wrong-policy", "wrong-session", "no-init", "error", "unknown", "control"]) {
      it.effect(
        `classifies Claude ${mode} without replay`,
        Effect.fnUntraced(function* () {
          const sessions = yield* AiProviderCliSession;
          const session = yield* sessions.open(yield* syntheticProfile("claude", mode));
          const result = yield* session
            .prompt(ManagedSessionMessage.make({ messageId: "case", text: "synthetic" }))
            .pipe(Effect.result);
          if (mode === "unknown" || mode === "control") {
            assert.equal(result._tag, "Success");
          } else {
            assert.equal(result._tag, "Failure");
            if (result._tag === "Failure")
              assert.equal(result.failure.reason, mode === "error" ? "provider-failure" : "policy-mismatch");
          }
          const unsupported = yield* session
            .steer(
              ManagedSessionSteering.make({
                expectedTurnId: "none",
                message: ManagedSessionMessage.make({ messageId: "steer", text: "synthetic" }),
              })
            )
            .pipe(Effect.flip);
          assert.equal(unsupported.reason, "unsupported");
          yield* session.close;
          yield* session.close;
          const late = yield* session
            .prompt(ManagedSessionMessage.make({ messageId: "late", text: "synthetic" }))
            .pipe(Effect.flip);
          assert.equal(late.reason, "closed");
        })
      );
    }
    for (const [provider, mode] of [
      ["cursor", "wrong-model"],
      ["grok", "wrong-model"],
      ["grok", "wrong-effort"],
    ] satisfies ReadonlyArray<readonly ["cursor" | "grok", string]>) {
      it.effect(
        `rejects ${provider} ${mode} readback`,
        Effect.fnUntraced(function* () {
          const sessions = yield* AiProviderCliSession;
          const error = yield* sessions.open(yield* syntheticProfile(provider, mode)).pipe(Effect.flip);
          assert.equal(error.reason, "policy-mismatch");
        })
      );
    }
    for (const invalid of [
      "relative-workspace",
      "same-home",
      "wrong-home",
      "api-env",
      "codex-home",
      "codex-existing",
      "claude-existing",
      "grok-relative",
    ]) {
      it.effect(
        `rejects isolated profile boundary ${invalid}`,
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const provider = Match.value(invalid).pipe(
            Match.when("claude-existing", () => "claude" as const),
            Match.when("grok-relative", () => "grok" as const),
            Match.orElse(() => "codex" as const)
          );
          const profile = yield* syntheticProfile(provider);
          if (invalid === "codex-existing") {
            yield* fs.makeDirectory(path.join(profile.profileRoot, ".codex"), { recursive: true });
            yield* fs.writeFileString(path.join(profile.profileRoot, ".codex/config.toml"), "retained");
          }
          if (invalid === "claude-existing") {
            yield* fs.makeDirectory(profile.profileRoot);
            yield* fs.writeFileString(path.join(profile.profileRoot, "managed-mcp.json"), "retained");
          }
          const changed = Match.value(invalid).pipe(
            Match.when("relative-workspace", () => ManagedLaunchProfile.make({ ...profile, workspace: "relative" })),
            Match.when("same-home", () =>
              ManagedLaunchProfile.make({
                ...profile,
                profileRoot: profile.workspace,
                env: { ...profile.env, HOME: profile.workspace },
              })
            ),
            Match.when("wrong-home", () =>
              ManagedLaunchProfile.make({ ...profile, env: { ...profile.env, HOME: "/foreign" } })
            ),
            Match.when("api-env", () =>
              ManagedLaunchProfile.make({ ...profile, env: { ...profile.env, OPENAI_API_KEY: "synthetic" } })
            ),
            Match.when("codex-home", () =>
              ManagedLaunchProfile.make({ ...profile, env: { ...profile.env, CODEX_HOME: "/foreign" } })
            ),
            Match.when("grok-relative", () =>
              ManagedLaunchProfile.make({ ...profile, sandboxWritablePaths: ["relative"] })
            ),
            Match.orElse(() => profile)
          );
          const sessions = yield* AiProviderCliSession;
          const error = yield* sessions.open(changed).pipe(Effect.flip);
          assert.equal(error.reason, "invalid-profile");
          if (invalid === "codex-existing")
            assert.equal(yield* fs.readFileString(path.join(profile.profileRoot, ".codex/config.toml")), "retained");
          if (invalid === "claude-existing")
            assert.equal(yield* fs.readFileString(path.join(profile.profileRoot, "managed-mcp.json")), "retained");
        })
      );
    }
    it.effect(
      "roundtrips Codex framing and fences queued prompts after close",
      Effect.fnUntraced(function* () {
        const hostPath = yield* Config.String("PATH");
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const home = path.join(root, "home");
        const workspace = path.join(root, "workspace");
        yield* fs.makeDirectory(workspace);
        const sessions = yield* AiProviderCliSession;
        const session = yield* sessions.open(
          ManagedLaunchProfile.make({
            provider: "codex",
            executable: "bun",
            prefixArgs: ["run", path.join(import.meta.dirname, "fixtures/managed-codex-peer.ts")],
            workspace,
            profileRoot: home,
            env: { HOME: home, CODEX_HOME: path.join(home, ".codex"), PATH: hostPath },
            authLane: "existing-subscription",
            tools: [],
          })
        );
        assert.equal(session.identity.model, "gpt-6.1-sol");
        const result = yield* session.prompt(
          ManagedSessionMessage.make({ messageId: "synthetic", text: "synthetic-only-echo" })
        );
        assert.equal(result.text, "synthetic-only-echo");
        assert.equal(result.stopReason, "completed");
        assertSome(result.terminalEvidence, {
          adapter: "codex",
          sessionId: session.identity.sessionId,
          messageId: "synthetic",
          turnId: "owned-turn-1",
          outcome: "delivered",
          stopReason: "completed",
        });
        yield* session.close;
        const error = yield* session
          .prompt(ManagedSessionMessage.make({ messageId: "late", text: "must-not-send" }))
          .pipe(Effect.flip);
        assert.equal(error.reason, "closed");
      })
    );
    it.effect(
      "rejects a different resumed session before dispatch",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const home = path.join(root, "home");
        const workspace = path.join(root, "workspace");
        yield* fs.makeDirectory(workspace);
        const sessions = yield* AiProviderCliSession;
        const session = yield* sessions.open(
          ManagedLaunchProfile.make({
            provider: "codex",
            executable: "bun",
            prefixArgs: [
              "run",
              path.join(import.meta.dirname, "fixtures/managed-codex-peer.ts"),
              "--beep-fixture-mode=wrong-resume",
            ],
            workspace,
            profileRoot: home,
            env: {
              HOME: home,
              CODEX_HOME: path.join(home, ".codex"),
              PATH: yield* Config.String("PATH"),
            },
            authLane: "existing-subscription",
            tools: [],
          })
        );
        yield* session.prompt(ManagedSessionMessage.make({ messageId: "first", text: "synthetic" }));
        const error = yield* session
          .prompt(ManagedSessionMessage.make({ messageId: "rejected", text: "synthetic" }))
          .pipe(Effect.flip);
        assert.equal(error.reason, "policy-mismatch");
        const after = yield* session
          .prompt(ManagedSessionMessage.make({ messageId: "fenced", text: "synthetic" }))
          .pipe(Effect.flip);
        assert.equal(after.reason, "closed");
      })
    );

    it.effect("retains Claude terminal evidence when a successful result omits printable text", () =>
      Effect.gen(function* () {
        const sessions = yield* AiProviderCliSession;
        const session = yield* sessions.open(yield* syntheticProfile("claude", "empty-result"));
        const result = yield* session.prompt(
          ManagedSessionMessage.make({ messageId: "empty-result", text: "synthetic-only" })
        );
        assert.equal(result.text, "");
        assertSome(result.terminalEvidence, {
          adapter: "claude",
          sessionId: session.identity.sessionId,
          messageId: "empty-result",
          outcome: "delivered",
          stopReason: "completed",
        });
        yield* session.close;
      })
    );

    for (const provider of ["grok", "claude"] satisfies ReadonlyArray<"grok" | "claude">) {
      it.effect(
        `roundtrips the persistent ${provider} owned synthetic peer`,
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped();
          const home = path.join(root, "home");
          const workspace = path.join(root, "workspace");
          yield* fs.makeDirectory(workspace);
          const sessions = yield* AiProviderCliSession;
          const session = yield* sessions.open(
            ManagedLaunchProfile.make({
              provider,
              executable: "bun",
              prefixArgs: ["run", path.join(import.meta.dirname, `fixtures/managed-${provider}-peer.ts`)],
              workspace,
              profileRoot: home,
              env: { HOME: home, PATH: yield* Config.String("PATH") },
              authLane: "existing-subscription",
              tools: [],
            })
          );
          if (provider === "grok") assert.equal(session.identity.sessionId, "owned-grok");
          const result = yield* session.prompt(
            ManagedSessionMessage.make({ messageId: "synthetic", text: "synthetic-only-echo" })
          );
          assert.equal(result.text, "synthetic-only-echo");
          assert.equal(result.stopReason, provider === "claude" ? "completed" : "end_turn");
          assertSome(
            O.map(result.terminalEvidence, (evidence) => ({
              adapter: evidence.adapter,
              sessionId: evidence.sessionId,
              messageId: evidence.messageId,
              outcome: evidence.outcome,
            })),
            { adapter: provider, sessionId: session.identity.sessionId, messageId: "synthetic", outcome: "delivered" }
          );
          const second = yield* session.prompt(
            ManagedSessionMessage.make({ messageId: "second", text: "synthetic-second" })
          );
          assert.equal(second.text, "synthetic-second");
          assertSome(
            O.map(second.terminalEvidence, (evidence) => evidence.messageId),
            "second"
          );
          yield* session.close;
        })
      );
    }
    it.effect(
      "rejects a runtime permission mismatch before prompting",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const home = path.join(root, "home");
        const workspace = path.join(root, "workspace");
        yield* fs.makeDirectory(workspace);
        const sessions = yield* AiProviderCliSession;
        const error = yield* sessions
          .open(
            ManagedLaunchProfile.make({
              provider: "codex",
              executable: "bun",
              prefixArgs: [
                "run",
                path.join(import.meta.dirname, "fixtures/managed-codex-peer.ts"),
                "--beep-fixture-mode=wrong-policy",
              ],
              workspace,
              profileRoot: home,
              env: {
                HOME: home,
                CODEX_HOME: path.join(home, ".codex"),
                PATH: yield* Config.String("PATH"),
              },
              authLane: "existing-subscription",
              tools: [],
            })
          )
          .pipe(Effect.flip);
        assert.equal(error.reason, "policy-mismatch");
      })
    );
    it.effect(
      "grants only exact owned MCP allow_once permissions",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const home = path.join(root, "home");
        const workspace = path.join(root, "workspace");
        yield* fs.makeDirectory(workspace);
        const sessions = yield* AiProviderCliSession;
        const session = yield* sessions.open(
          ManagedLaunchProfile.make({
            provider: "grok",
            executable: "bun",
            prefixArgs: ["run", path.join(import.meta.dirname, "fixtures/managed-grok-peer.ts")],
            workspace,
            profileRoot: home,
            env: { HOME: home, PATH: yield* Config.String("PATH") },
            authLane: "existing-subscription",
            tools: [{ name: "peer", command: "false", args: [], env: {} }],
          })
        );
        for (const testCase of ["owned", "wrong-server", "wrong-session", "builtin", "unknown"]) {
          const result = yield* session.prompt(
            ManagedSessionMessage.make({ messageId: testCase, text: `permission:${testCase}` })
          );
          assert.equal(result.text, testCase === "owned" ? "selected" : "cancelled");
        }
      })
    );
    it.effect(
      "handshakes Cursor then classifies subscription denial despite end_turn",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const home = path.join(root, "home");
        const workspace = path.join(root, "workspace");
        yield* fs.makeDirectory(workspace);
        const sessions = yield* AiProviderCliSession;
        const session = yield* sessions.open(
          ManagedLaunchProfile.make({
            provider: "cursor",
            executable: "bun",
            prefixArgs: ["run", path.join(import.meta.dirname, "fixtures/managed-cursor-peer.ts")],
            workspace,
            profileRoot: home,
            env: { HOME: home, PATH: yield* Config.String("PATH") },
            authLane: "existing-subscription",
            tools: [],
          })
        );
        assert.equal(session.identity.sessionId, "owned-cursor");
        assert.equal(session.identity.model, "claude-opus-5-5");
        const error = yield* session
          .prompt(ManagedSessionMessage.make({ messageId: "blocked", text: "synthetic" }))
          .pipe(Effect.flip);
        assert.equal(error.reason, "access-blocked");
      })
    );
    it.effect(
      "bounds an unterminated Claude frame and fences subsequent prompts",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const home = path.join(root, "home");
        const workspace = path.join(root, "workspace");
        yield* fs.makeDirectory(workspace);
        const sessions = yield* AiProviderCliSession;
        const session = yield* sessions.open(
          ManagedLaunchProfile.make({
            provider: "claude",
            executable: "bun",
            prefixArgs: [
              "run",
              path.join(import.meta.dirname, "fixtures/managed-claude-peer.ts"),
              "--beep-fixture-mode=oversized",
            ],
            workspace,
            profileRoot: home,
            env: { HOME: home, PATH: yield* Config.String("PATH") },
            authLane: "existing-subscription",
            tools: [],
          })
        );
        const error = yield* session
          .prompt(ManagedSessionMessage.make({ messageId: "bounded", text: "synthetic" }))
          .pipe(Effect.flip);
        assert.equal(error.reason, "provider-failure");
        const late = yield* session
          .prompt(ManagedSessionMessage.make({ messageId: "fenced", text: "synthetic" }))
          .pipe(Effect.flip);
        assert.equal(late.reason, "closed");
      })
    );
    for (const invalid of ["public-directory", "file", "parent", "existing-config"] satisfies ReadonlyArray<string>) {
      it.effect(
        `rejects Grok writable profile ${invalid}`,
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped();
          const home = path.join(root, "home");
          const workspace = path.join(root, "workspace");
          const state = path.join(root, "state");
          yield* fs.makeDirectory(workspace);
          if (invalid === "file") yield* fs.writeFileString(state, "synthetic", { mode: 0o600 });
          else yield* fs.makeDirectory(state, { mode: invalid === "public-directory" ? 0o755 : 0o700 });
          if (invalid === "public-directory") yield* fs.chmod(state, 0o755);
          if (invalid === "existing-config") {
            yield* fs.makeDirectory(path.join(home, ".grok"), { recursive: true });
            yield* fs.writeFileString(path.join(home, ".grok/sandbox.toml"), "retained-synthetic", { mode: 0o600 });
          }
          const sessions = yield* AiProviderCliSession;
          const error = yield* sessions
            .open(
              ManagedLaunchProfile.make({
                provider: "grok",
                executable: "bun",
                prefixArgs: [],
                workspace,
                profileRoot: home,
                env: { HOME: home, PATH: yield* Config.String("PATH") },
                authLane: "existing-subscription",
                tools: [],
                sandboxWritablePaths: [invalid === "parent" ? root : state],
              })
            )
            .pipe(Effect.flip);
          assert.equal(error.reason, "invalid-profile");
          if (invalid === "existing-config")
            assert.equal(yield* fs.readFileString(path.join(home, ".grok/sandbox.toml")), "retained-synthetic");
        })
      );
    }
    for (const control of ["steer", "cancel", "timeout"] satisfies ReadonlyArray<string>) {
      it.effect(
        `fences targeted Codex ${control} against stale completion`,
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped();
          const home = path.join(root, "home");
          const workspace = path.join(root, "workspace");
          yield* fs.makeDirectory(workspace);
          const sessions = yield* AiProviderCliSession;
          const session = yield* sessions.open(
            ManagedLaunchProfile.make({
              provider: "codex",
              executable: "bun",
              prefixArgs: [
                "run",
                path.join(import.meta.dirname, "fixtures/managed-codex-peer.ts"),
                "--beep-fixture-mode=busy",
              ],
              workspace,
              profileRoot: home,
              env: {
                HOME: home,
                CODEX_HOME: path.join(home, ".codex"),
                PATH: yield* Config.String("PATH"),
              },
              authLane: "existing-subscription",
              tools: [],
            })
          );
          const started = yield* Deferred.make<string>();
          const secondStarted = yield* Deferred.make<string>();
          const Turn = S.Struct({ turnId: S.String });
          yield* session.events.pipe(
            Stream.runForEach((event) => {
              if (event.kind === "update" && S.is(Turn)(event.payload))
                return Deferred.succeed(
                  event.payload.turnId === "owned-turn-2" ? secondStarted : started,
                  event.payload.turnId
                );
              return Effect.void;
            }),
            Effect.forkChild
          );
          yield* Effect.yieldNow;
          const running = yield* session
            .prompt(ManagedSessionMessage.make({ messageId: "active", text: "bounded-synthetic" }))
            .pipe(Effect.result, Effect.forkChild);
          const turnId = yield* Deferred.await(started);
          const queued =
            control === "steer"
              ? yield* session
                  .prompt(ManagedSessionMessage.make({ messageId: "queued", text: "bounded-queued" }))
                  .pipe(Effect.forkChild)
              : undefined;
          const stale = yield* session
            .steer(
              ManagedSessionSteering.make({
                expectedTurnId: "stale-turn",
                message: ManagedSessionMessage.make({ messageId: "stale", text: "synthetic" }),
              })
            )
            .pipe(Effect.flip);
          assert.equal(stale.reason, "policy-mismatch");
          const applyControl = Effect.fn("SyntheticSession.applyControl")(function* () {
            if (control === "steer")
              yield* session.steer(
                ManagedSessionSteering.make({
                  expectedTurnId: turnId,
                  message: ManagedSessionMessage.make({ messageId: "steering", text: "bounded-synthetic" }),
                })
              );
            if (control === "cancel") yield* session.cancel;
            if (control === "timeout") yield* TestClock.adjust("2 minutes");
          });
          yield* applyControl();
          const result = yield* Fiber.join(running);
          if (queued !== undefined) {
            const secondId = yield* Deferred.await(secondStarted);
            assert.notEqual(secondId, turnId);
            yield* session.steer(
              ManagedSessionSteering.make({
                expectedTurnId: secondId,
                message: ManagedSessionMessage.make({ messageId: "second-steer", text: "bounded-synthetic" }),
              })
            );
            assert.equal((yield* Fiber.join(queued)).messageId, "queued");
          }
          const verifyTerminal = Effect.fn("SyntheticSession.verifyTerminal")(function* () {
            if (control === "timeout") {
              assert.equal(result._tag, "Failure");
              if (result._tag === "Failure") assert.equal(result.failure.reason, "timeout");
              const after = yield* session
                .prompt(ManagedSessionMessage.make({ messageId: "fenced", text: "synthetic" }))
                .pipe(Effect.flip);
              assert.equal(after.reason, "closed");
              return;
            }
            assert.equal(result._tag, "Success");
            if (result._tag === "Success") {
              assert.equal(result.success.stopReason, control === "steer" ? "completed" : "interrupted");
              if (control === "cancel") assertNone(result.success.terminalEvidence);
            }
          });
          yield* verifyTerminal();
        })
      );
    }
    for (const operation of [
      "initialize",
      "authenticate",
      "session/new",
      "session/set_mode",
    ] satisfies ReadonlyArray<string>) {
      it.effect(
        `bounds ACP enrollment ${operation} before inference`,
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped();
          const home = path.join(root, "home");
          const workspace = path.join(root, "workspace");
          yield* fs.makeDirectory(home, { mode: 0o700 });
          yield* fs.makeDirectory(workspace);
          const provider = operation === "session/set_mode" ? "cursor" : "grok";
          const sessions = yield* AiProviderCliSession;
          const opening = yield* sessions
            .open(
              ManagedLaunchProfile.make({
                provider,
                executable: "bun",
                prefixArgs: [
                  "run",
                  path.join(import.meta.dirname, `fixtures/managed-${provider}-peer.ts`),
                  `--beep-fixture-stall-at=${operation}`,
                ],
                workspace,
                profileRoot: home,
                env: { HOME: home, PATH: yield* Config.String("PATH") },
                authLane: "existing-subscription",
                tools: [],
              })
            )
            .pipe(Effect.flip, Effect.forkChild);
          yield* fs.exists(path.join(home, "stall-reached")).pipe(Effect.repeat({ until: (exists) => exists }));
          yield* TestClock.adjust("30 seconds");
          const error = yield* Fiber.join(opening);
          assert.equal(error.reason, "timeout");
          assert.equal(error.operation, operation);
        })
      );
    }
  }
);

for (const stop of ["timeout", "interrupt"] as const) {
  it.layer(TestLayer, { timeout: "20 seconds", concurrent: false })((it) =>
    it.effect(`cleans up an acquired child on observer ${stop} without a second launch`, () =>
      Effect.gen(function* () {
        const sessions = yield* AiProviderCliSession;
        const spawned = yield* Deferred.make<ManagedSessionProcess>();
        const count = yield* Ref.make(0);
        const opening = yield* sessions
          .open(yield* syntheticProfile("codex"), {
            started: (process) =>
              Deferred.succeed(spawned, process).pipe(
                Effect.andThen(Ref.update(count, (n) => n + 1)),
                Effect.andThen(Effect.never)
              ),
            bound: () => Effect.die("Unexpected bound observation"),
          })
          .pipe(Effect.flip, Effect.forkChild);
        const process = yield* Deferred.await(spawned);
        if (stop === "timeout") {
          yield* TestClock.adjust("5 seconds");
          const error = yield* Fiber.join(opening);
          assert.equal(error.reason, "timeout");
          assert.equal(error.operation, "observe-started");
        } else yield* Fiber.interrupt(opening);
        assert.equal(yield* Ref.get(count), 1);
        assert.isFalse(yield* process.isRunning);
      })
    )
  );
}
