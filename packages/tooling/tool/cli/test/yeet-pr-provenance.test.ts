import {
  detectCodexEnvironment,
  detectPrProvenanceFromPaths,
  makePrProvenanceServiceLive,
  PrProvenanceLabel,
  PrProvenanceModel,
  PublicPrProvenance,
  renderPrProvenance,
  toPublicPrProvenance,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Fiber, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { makeRecord, PlatformLayer } from "./yeet-pr-fixtures.ts";

describe("Yeet PR provenance v2", () => {
  it("enforces the public label allowlist", () => {
    const isLabel = S.is(PrProvenanceLabel);
    expect(isLabel("SHIP_VELOCITY")).toBe(true);
    expect(isLabel("beep-effect10-69")).toBe(true);
    expect(isLabel("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    expect(isLabel("abcdef0123456789")).toBe(false);
    expect(isLabel("../escape")).toBe(false);
  });

  it("rejects UUID and long-hex model slugs", () => {
    const isModel = S.is(PrProvenanceModel);
    expect(isModel("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    expect(isModel("0123456789abcdef")).toBe(false);
  });

  it.effect("does not classify companion variables as Codex", () =>
    Effect.gen(function* () {
      expect(yield* detectCodexEnvironment).toStrictEqual([false, O.none()]);
    }).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({
          env: { CLAUDE_CODE_SESSION_ID: "claude-session", CODEX_COMPANION_TRANSCRIPT_PATH: "/tmp/transcript.jsonl" },
        })
      )
    )
  );

  it.effect("uses the exact Claude transcript and matching pid index", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectory();
      const transcript = path.join(home, "session.jsonl");
      const sessions = path.join(home, ".claude", "sessions");
      yield* fs.makeDirectory(sessions, { recursive: true });
      yield* fs.writeFileString(
        transcript,
        '{"cwd":"/session/home"}\n{"type":"assistant","message":{"model":"claude-opus-4-1"}}\n'
      );
      yield* fs.writeFileString(
        path.join(sessions, "123.json"),
        '{"pid":123,"sessionId":"claude-session","cwd":"/index/home","name":"FABLE","nameSource":"user","entrypoint":"claude-desktop"}'
      );
      const provenance = yield* detectPrProvenanceFromPaths("/clone", "/checkout", O.none(), "feat/footer").pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({
            env: {
              HOME: home,
              CLAUDE_CODE_SESSION_ID: "claude-session",
              CLAUDE_PID: "123",
              CODEX_COMPANION_TRANSCRIPT_PATH: transcript,
            },
          })
        )
      );
      expect(provenance.harness).toBe("claude-code");
      expect(provenance.sessionHome).toStrictEqual(O.some("/session/home"));
      expect(provenance.sessionName).toStrictEqual(O.some("FABLE"));
      expect(provenance.model).toBe("claude-opus-4-1");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("degrades rejected UUID and long-hex transcript models to unknown", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectory();
      const transcript = path.join(home, "session.jsonl");
      const detectModel = Effect.fn("test.detectRejectedModel")(function* (model: string) {
        yield* fs.writeFileString(
          transcript,
          `{"cwd":"/session/home"}\n{"type":"assistant","message":{"model":"${model}"}}\n`
        );
        return yield* detectPrProvenanceFromPaths("/clone", "/checkout", O.none(), "feat/footer").pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                HOME: home,
                CLAUDE_CODE_SESSION_ID: "claude-session",
                CODEX_COMPANION_TRANSCRIPT_PATH: transcript,
              },
            })
          )
        );
      });
      expect((yield* detectModel("550e8400-e29b-41d4-a716-446655440000")).model).toBe("unknown");
      expect((yield* detectModel("0123456789abcdef")).model).toBe("unknown");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("ignores a pid index whose session id does not match", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectory();
      const sessions = path.join(home, ".claude", "sessions");
      yield* fs.makeDirectory(sessions, { recursive: true });
      yield* fs.writeFileString(
        path.join(sessions, "123.json"),
        '{"pid":123,"sessionId":"other","cwd":"/wrong","name":"WRONG","nameSource":"user"}'
      );
      const provenance = yield* detectPrProvenanceFromPaths("/clone", "/checkout", O.none(), "feat/footer").pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { HOME: home, CLAUDE_CODE_SESSION_ID: "claude-session", CLAUDE_PID: "123" } })
        )
      );
      expect(provenance.sessionHome).toStrictEqual(O.some("/checkout"));
      expect(provenance.sessionHomeSource).toBe("checkout");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("records Codex hosted by Claude only when CODEX_THREAD_ID exists", () =>
    detectPrProvenanceFromPaths("/clone", "/checkout", O.none(), "feat/footer").pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({ env: { CODEX_THREAD_ID: "thread-id", CLAUDE_CODE_SESSION_ID: "host-id" } })
      ),
      Effect.tap((provenance) =>
        Effect.sync(() => {
          expect(provenance.harness).toBe("codex");
          expect(provenance.hostHarness).toStrictEqual(O.some("claude-code"));
        })
      ),
      provideScopedLayer(PlatformLayer)
    )
  );

  it.effect("reads the latest valid Codex model from turn_context records", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectory();
      const sessions = path.join(home, ".codex", "sessions", "2026", "09", "03");
      yield* fs.makeDirectory(sessions, { recursive: true });
      yield* fs.writeFileString(
        path.join(sessions, "rollout.jsonl"),
        '{"type":"session_meta","payload":{"id":"thread-model","cwd":"/session/home"}}\n' +
          '{"type":"turn_context","model":"gpt-5.4"}\n' +
          '{"type":"turn_context","model":"gpt-5.6-codex"}\n'
      );
      const provenance = yield* detectPrProvenanceFromPaths("/clone", "/checkout", O.none(), "feat/footer").pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { HOME: home, CODEX_THREAD_ID: "thread-model" } })
        )
      );
      expect(provenance.sessionHome).toStrictEqual(O.some("/session/home"));
      expect(provenance.model).toBe("gpt-5.6-codex");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("preserves exact Codex identity when a delayed session store exceeds the detector bound", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      const initialized = Bun.spawnSync(["git", "init", "-q"], { cwd: root, stderr: "pipe", stdout: "pipe" });
      if (!initialized.success) assert.fail("fixture git repository setup failed");
      const delayedFileSystem: FileSystem.FileSystem = {
        ...fs,
        readDirectory: (filePath, options) =>
          Str.endsWith("/.codex/sessions")(filePath)
            ? Effect.sleep("3 seconds").pipe(Effect.andThen(fs.readDirectory(filePath, options)))
            : fs.readDirectory(filePath, options),
      };
      const service = yield* makePrProvenanceServiceLive().pipe(
        Effect.provideService(FileSystem.FileSystem, delayedFileSystem)
      );
      const fiber = yield* Effect.forkChild(service.detect(root, "feat/footer"));
      yield* TestClock.adjust("2 seconds");
      const provenance = yield* Fiber.join(fiber);
      expect(provenance.harness).toBe("codex");
      expect(provenance.sessionId).toStrictEqual(O.some("exact-thread-id"));
      expect(provenance.sessionHome).toStrictEqual(O.some(root));
      expect(provenance.model).toBe("unknown");
    }).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({ env: { HOME: "/fixture-home", CODEX_THREAD_ID: "exact-thread-id" } })
      ),
      provideScopedLayer(PlatformLayer)
    )
  );

  it.effect("publishes a distinct session workspace derived from the session clone", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory();
      const publisher = path.join(root, "beep-effect10");
      const session = path.join(root, "beep-effect3");
      yield* fs.makeDirectory(publisher);
      yield* fs.makeDirectory(session);
      A.forEach([publisher, session], (cwd) => {
        const initialized = Bun.spawnSync(["git", "init", "-q"], { cwd, stderr: "pipe", stdout: "pipe" });
        if (!initialized.success) assert.fail("fixture git repository setup failed");
      });
      const transcript = path.join(root, "session.jsonl");
      yield* fs.writeFileString(transcript, `{"cwd":"${session}"}\n`);
      const provenance = yield* detectPrProvenanceFromPaths(publisher, publisher, O.none(), "feat/footer").pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({
            env: { HOME: root, CLAUDE_CODE_SESSION_ID: "claude-session", CODEX_COMPANION_TRANSCRIPT_PATH: transcript },
          })
        )
      );
      expect(provenance.workspace).toBe("beep-effect10");
      expect(provenance.sessionWorkspace).toStrictEqual(O.some("beep-effect3"));
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it("publishes valid Claude labels but never Codex names", () => {
    const claude = makeRecord({ sessionName: "FABLE", nameSource: "derived" });
    const codex = makeRecord({
      harness: "codex",
      sessionId: "thread-private",
      sessionName: "codex-name",
      recordedAt: "2026-09-03T13:00:00Z",
    });
    const publicValue = toPublicPrProvenance([claude, codex], O.some(42), true);
    expect(publicValue).toBeInstanceOf(PublicPrProvenance);
    expect(publicValue.agents[0]?.label).toStrictEqual(O.none());
    expect(publicValue.agents[1]?.label).toStrictEqual(O.some("FABLE"));
    const footer = renderPrProvenance(publicValue);
    expect(footer).toContain("bun run beep yeet resume 42");
    expect(footer).not.toContain("thread-private");
    expect(footer).not.toContain("/private/");
  });
});
