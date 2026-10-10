import {
  AiProviderCliSession,
  ManagedLaunchProfile,
  ManagedSessionMessage,
  ManagedSessionSteering,
} from "@beep/ai-provider-cli";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

const TestLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, AiProviderCliSession.layer);
it.layer(TestLayer, { timeout: "20 seconds", concurrent: false })("managed native sessions", (it) => {
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
          prefixArgs: ["run", path.join(import.meta.dirname, "fixtures/managed-codex-peer.ts")],
          workspace,
          profileRoot: home,
          env: {
            HOME: home,
            CODEX_HOME: path.join(home, ".codex"),
            PATH: yield* Config.String("PATH"),
            FIXTURE_MODE: "wrong-resume",
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
        const second = yield* session.prompt(
          ManagedSessionMessage.make({ messageId: "second", text: "synthetic-second" })
        );
        assert.equal(second.text, "synthetic-second");
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
            prefixArgs: ["run", path.join(import.meta.dirname, "fixtures/managed-codex-peer.ts")],
            workspace,
            profileRoot: home,
            env: {
              HOME: home,
              CODEX_HOME: path.join(home, ".codex"),
              PATH: yield* Config.String("PATH"),
              FIXTURE_MODE: "wrong-policy",
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
          prefixArgs: ["run", path.join(import.meta.dirname, "fixtures/managed-claude-peer.ts")],
          workspace,
          profileRoot: home,
          env: { HOME: home, PATH: yield* Config.String("PATH"), FIXTURE_MODE: "oversized" },
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
            prefixArgs: ["run", path.join(import.meta.dirname, "fixtures/managed-codex-peer.ts")],
            workspace,
            profileRoot: home,
            env: {
              HOME: home,
              CODEX_HOME: path.join(home, ".codex"),
              PATH: yield* Config.String("PATH"),
              FIXTURE_MODE: "busy",
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
          if (result._tag === "Success")
            assert.equal(result.success.stopReason, control === "steer" ? "completed" : "interrupted");
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
              prefixArgs: ["run", path.join(import.meta.dirname, `fixtures/managed-${provider}-peer.ts`)],
              workspace,
              profileRoot: home,
              env: { HOME: home, PATH: yield* Config.String("PATH"), STALL_AT: operation },
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
});
