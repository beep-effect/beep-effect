import { MemoryStats } from "@beep/repo-cli/test/RepoRun";
import {
  isClaudeSessionLive,
  makePrSessionRegistryLive,
  PrRef,
  PrRepository,
  PrSessionRecord,
  parsePrRef,
  ResumeOptions,
  runYeetResume,
  selectResumeRecord,
  YeetCommandError,
  yeetCommand,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Path, Ref, Result, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";
import { makeRecord } from "./yeet-pr-fixtures.ts";

const TestLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128) }))
);
const runYeetCommand = Command.runWith(yeetCommand, { version: "0.0.0" });
const configureRepo = (cwd: string) =>
  Effect.sync(() => {
    const init = Bun.spawnSync(["git", "init", "-q"], { cwd, stderr: "pipe", stdout: "pipe" });
    const remote = Bun.spawnSync(["git", "remote", "add", "origin", "git@github.com:beep-effect/beep-effect.git"], {
      cwd,
      stderr: "pipe",
      stdout: "pipe",
    });
    if (!init.success || !remote.success) assert.fail("fixture git repository setup failed");
  });
const decodeRef = (value: string): PrRef => Result.getOrThrow(S.decodeResult(PrRef)(value));
const options = (overrides: Partial<ResumeOptions> = {}) =>
  ResumeOptions.make({
    ref: decodeRef("42"),
    list: false,
    print: true,
    force: false,
    json: false,
    agent: O.none(),
    ...overrides,
  });

const stubHandle = (exitCode: number) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.empty,
    unref: Effect.succeed(Effect.void),
  });

describe("yeet resume", () => {
  it.effect("parses number and URL references", () =>
    Effect.gen(function* () {
      expect((yield* parsePrRef("42")).pr).toBe(42);
      const url = yield* parsePrRef("https://github.com/Beep-Effect/Beep-Effect/pull/43");
      expect(url.pr).toBe(43);
      expect(url.repository).toStrictEqual(
        O.some(PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }))
      );
    })
  );

  it.effect("maps an invalid PR reference to an exit-4 command error", () =>
    Effect.gen(function* () {
      const error = yield* parsePrRef("not-a-pr").pipe(Effect.flip);
      assert.instanceOf(error, YeetCommandError);
      expect(error.exitCode).toBe(4);
    })
  );

  it("encodes both number and URL pull-request references", () => {
    expect(Result.getOrThrow(S.encodeResult(PrRef)(decodeRef("42")))).toBe("42");
    expect(
      Result.getOrThrow(S.encodeResult(PrRef)(decodeRef("https://github.com/Beep-Effect/Beep-Effect/pull/43")))
    ).toBe("https://github.com/beep-effect/beep-effect/pull/43");
  });

  it("rejects a pull-request URL whose host is not github.com", () => {
    expect(Result.isFailure(S.decodeResult(PrRef)("https://gitlab.com/beep-effect/beep-effect/pull/42"))).toBe(true);
  });

  it.effect("rejects zero and negative --agent selections", () =>
    Effect.forEach(
      ["0", "-1"],
      (agent) =>
        Effect.gen(function* () {
          const exit = yield* Effect.exit(runYeetCommand(["resume", "42", `--agent=${agent}`]));
          expect(exit._tag).toBe("Failure");
          expect(globalThis.String(exit)).toContain("positive one-based integer");
        }),
      { discard: true }
    ).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("uses --state-root and keeps agent absent as the default selection", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, BEEP_YEET_STATE_ROOT: root } });
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      yield* registry.append(makeRecord({ sessionId: "state-root-default-agent" }));
      yield* runYeetCommand(["resume", "42", "--print", "--state-root", root]);
      const logs = A.join(A.map(yield* TestConsole.logLines, globalThis.String), "\n");
      expect(logs).toContain("state-root-default-agent");
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("covers resume command list and JSON output without a state-root flag", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: root } });
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      yield* registry.append(makeRecord({ harness: "unknown", sessionId: "listed-agent" }));
      yield* runYeetCommand(["resume", "42", "--list", "--json"]).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      const logs = A.join(A.map(yield* TestConsole.logLines, globalThis.String), "\n");
      expect(logs).toContain('"status": "not-resumable"');
      expect(logs).toContain('"sequence": 1');
    }).pipe(provideScopedLayer(TestLayer))
  );

  it("prefers the newest created or pushed row, with one-based override", () => {
    const monitored = makeRecord({ role: "monitored", recordedAt: "2026-09-03T14:00:00Z", sessionId: "monitor" });
    const created = makeRecord({ role: "created", recordedAt: "2026-09-03T13:00:00Z", sessionId: "creator" });
    const rows = [created, monitored];
    expect(O.flatMap(selectResumeRecord(rows, O.none()), (record) => record.sessionId)).toStrictEqual(
      O.some("creator")
    );
    expect(O.flatMap(selectResumeRecord(rows, O.some(1)), (record) => record.sessionId)).toStrictEqual(
      O.some("monitor")
    );
    expect(O.flatMap(selectResumeRecord([monitored], O.none()), (record) => record.sessionId)).toStrictEqual(
      O.some("monitor")
    );
  });

  it("numbers newest distinct sessions instead of duplicate lifecycle rows", () => {
    const created = makeRecord({ role: "created", recordedAt: "2026-09-03T11:00:00Z", sessionId: "same-session" });
    const pushed = makeRecord({ role: "pushed", recordedAt: "2026-09-03T12:00:00Z", sessionId: "same-session" });
    const monitored = makeRecord({ role: "monitored", recordedAt: "2026-09-03T13:00:00Z", sessionId: "same-session" });
    const codex = makeRecord({
      harness: "codex",
      role: "created",
      recordedAt: "2026-09-03T10:00:00Z",
      sessionId: "codex-session",
    });
    expect(
      O.flatMap(selectResumeRecord([created, pushed, monitored, codex], O.some(1)), (record) => record.sessionId)
    ).toStrictEqual(O.some("same-session"));
    expect(
      O.flatMap(selectResumeRecord([created, pushed, monitored, codex], O.some(2)), (record) => record.sessionId)
    ).toStrictEqual(O.some("codex-session"));
    expect(selectResumeRecord([created, pushed, monitored, codex], O.some(3))).toStrictEqual(O.none());
  });

  it.effect("detects a matching live Claude index only when its proc entry exists", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory();
      const sessions = path.join(root, "sessions");
      const proc = path.join(root, "proc");
      yield* fs.makeDirectory(sessions, { recursive: true });
      yield* fs.makeDirectory(path.join(proc, "123"), { recursive: true });
      yield* fs.writeFileString(
        path.join(sessions, "123.json"),
        '{"pid":123,"sessionId":"session-local-only","cwd":"/workspace","name":"FABLE"}'
      );
      const live = yield* isClaudeSessionLive(makeRecord(), sessions, proc);
      expect(live.pipe(O.map((value) => value.pid))).toStrictEqual(O.some(123));
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("misses the Claude live guard for unsupported, absent, and stale index evidence", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory();
      const sessions = path.join(root, "sessions");
      const proc = path.join(root, "proc");
      yield* fs.makeDirectory(sessions, { recursive: true });
      yield* fs.makeDirectory(proc, { recursive: true });
      yield* fs.writeFileString(path.join(sessions, "bad.json"), "not-json");
      yield* fs.makeDirectory(path.join(sessions, "unreadable.json"));
      yield* fs.writeFileString(
        path.join(sessions, "123.json"),
        '{"pid":123,"sessionId":"session-local-only","cwd":"/workspace"}'
      );
      expect(O.isNone(yield* isClaudeSessionLive(makeRecord({ harness: "codex" }), sessions, proc))).toBe(true);
      const withoutSession = PrSessionRecord.make({ ...makeRecord(), sessionId: O.none() });
      expect(O.isNone(yield* isClaudeSessionLive(withoutSession, sessions, proc))).toBe(true);
      expect(O.isNone(yield* isClaudeSessionLive(makeRecord(), sessions, proc))).toBe(true);
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("prints a registry-resolved argv without spawning", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: root } });
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      yield* registry.append(makeRecord());
      yield* runYeetResume(options()).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
      const logs = A.join(A.map(yield* TestConsole.logLines, globalThis.String), "\n");
      expect(logs).toContain("claude '--resume' 'session-local-only'");
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("resolves a URL repository from a different checkout", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: root } });
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      const other = PrRepository.make({ host: "github.com", owner: "other-owner", name: "other-repo" });
      yield* registry.append(makeRecord({ repository: other, sessionId: "repository-b-session" }));
      yield* runYeetResume(options({ ref: decodeRef("https://github.com/OTHER-OWNER/OTHER-REPO/pull/42") })).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      const logs = A.join(A.map(yield* TestConsole.logLines, globalThis.String), "\n");
      expect(logs).toContain("repository-b-session");
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("does not select a same-numbered checkout row for a URL repository", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: root } });
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      const other = PrRepository.make({ host: "github.com", owner: "other-owner", name: "other-repo" });
      yield* registry.append(makeRecord({ sessionId: "repository-a-session" }));
      yield* registry.append(makeRecord({ repository: other, sessionId: "repository-b-session" }));
      yield* runYeetResume(options({ ref: decodeRef("https://github.com/other-owner/other-repo/pull/42") })).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      const logs = A.join(A.map(yield* TestConsole.logLines, globalThis.String), "\n");
      expect(logs).toContain("repository-b-session");
      expect(logs).not.toContain("repository-a-session");
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("keeps a bare number scoped to the checkout repository", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: root } });
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      const other = PrRepository.make({ host: "github.com", owner: "other-owner", name: "other-repo" });
      yield* registry.append(makeRecord({ sessionId: "repository-a-session" }));
      yield* registry.append(makeRecord({ repository: other, sessionId: "repository-b-session" }));
      yield* runYeetResume(options()).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
      const logs = A.join(A.map(yield* TestConsole.logLines, globalThis.String), "\n");
      expect(logs).toContain("repository-a-session");
      expect(logs).not.toContain("repository-b-session");
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("uses the Claude pr-link transcript fallback when registry state is absent", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const project = path.join(root, ".claude", "projects", "fixture");
      yield* fs.makeDirectory(project, { recursive: true });
      yield* fs.writeFileString(
        path.join(project, "transcript-session.jsonl"),
        '{"cwd":"/session/home"}\n{"type":"pr-link","prNumber":42,"sessionId":"ignored","prRepository":"beep-effect/beep-effect"}\n'
      );
      const provider = ConfigProvider.fromEnv({
        env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: path.join(root, "state") },
      });
      yield* runYeetResume(options()).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
      const logs = A.join(A.map(yield* TestConsole.logLines, globalThis.String), "\n");
      expect(logs).toContain("transcript-session");
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("falls back to HOME and an unknown workspace for a transcript without cwd", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory();
      const home = path.join(root, "bad workspace label");
      yield* configureRepo(root);
      const project = path.join(home, ".claude", "projects", "fixture");
      yield* fs.makeDirectory(project, { recursive: true });
      yield* fs.writeFileString(
        path.join(project, "no-cwd.jsonl"),
        '{"type":"pr-link","prNumber":42,"prRepository":"beep-effect/beep-effect"}\n'
      );
      const provider = ConfigProvider.fromEnv({
        env: { HOME: home, PWD: root, BEEP_YEET_STATE_ROOT: path.join(root, "state") },
      });
      yield* runYeetResume(options()).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
      const logs = A.join(A.map(yield* TestConsole.logLines, globalThis.String), "\n");
      expect(logs).toContain("no-cwd");
      expect(logs).toContain(`cwd ${home}`);
      expect(logs).toContain("unknown");
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("reports URL-scoped missing state with repository context", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory();
      const provider = ConfigProvider.fromEnv({
        env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: path.join(root, "state") },
      });
      const error = yield* runYeetResume(
        options({ ref: decodeRef("https://github.com/beep-effect/beep-effect/pull/99") })
      ).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider), Effect.flip);
      assert.instanceOf(error, YeetCommandError);
      expect(error.exitCode).toBe(4);
      expect(error.message).toContain("beep-effect/beep-effect PR #99");
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("prints no rows for an out-of-range explicit agent", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: root } });
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      yield* registry.append(makeRecord());
      yield* runYeetResume(options({ agent: O.some(99) })).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      expect(yield* TestConsole.logLines).toStrictEqual([]);
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("selects only the current repository when PR numbers collide", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const project = path.join(root, ".claude", "projects", "fixture");
      yield* fs.makeDirectory(project, { recursive: true });
      yield* fs.writeFileString(
        path.join(project, "wrong-repository.jsonl"),
        '{"cwd":"/wrong/repository"}\n{"type":"pr-link","prNumber":42,"prRepository":"other-owner/other-repo"}\n'
      );
      yield* fs.writeFileString(
        path.join(project, "current-repository.jsonl"),
        '{"cwd":"/current/repository"}\n{"type":"pr-link","prNumber":42,"prUrl":"https://github.com/beep-effect/beep-effect/pull/42"}\n'
      );
      const provider = ConfigProvider.fromEnv({
        env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: path.join(root, "state") },
      });
      yield* runYeetResume(options()).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
      const logs = A.join(A.map(yield* TestConsole.logLines, globalThis.String), "\n");
      expect(logs).toContain("current-repository");
      expect(logs).not.toContain("wrong-repository");
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("lists one row per session and marks unsupported harnesses as not resumable", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: root } });
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      yield* registry.append(
        makeRecord({ sessionId: "same-session", role: "created", recordedAt: "2026-09-03T11:00:00Z" })
      );
      yield* registry.append(
        makeRecord({ sessionId: "same-session", role: "pushed", recordedAt: "2026-09-03T12:00:00Z" })
      );
      yield* registry.append(
        makeRecord({ sessionId: "same-session", role: "monitored", recordedAt: "2026-09-03T13:00:00Z" })
      );
      yield* registry.append(
        makeRecord({ harness: "unknown", sessionId: "unsupported", recordedAt: "2026-09-03T10:00:00Z" })
      );
      yield* runYeetResume(options({ list: true })).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      const logs = A.map(yield* TestConsole.logLines, globalThis.String);
      expect(logs).toHaveLength(2);
      expect(A.join(logs, "\n")).toContain("not-resumable");
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("spawns the selected Codex argv in its recorded session home", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: root } });
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      yield* registry.append(
        makeRecord({ harness: "claude-code", sessionId: "newest", recordedAt: "2026-09-03T13:00:00Z" })
      );
      const codexRecord = makeRecord({
        harness: "codex",
        sessionId: "codex-thread",
        recordedAt: "2026-09-03T12:00:00Z",
      });
      yield* registry.append(PrSessionRecord.make({ ...codexRecord, sessionHome: O.none(), clonePath: root }));
      const spawned = yield* Ref.make<ReadonlyArray<string>>(A.empty());
      const spawnCwd = yield* Ref.make(O.none<string>());
      const spawner = ChildProcessSpawner.make((command) => {
        const argv = command._tag === "StandardCommand" ? A.prepend(command.args, command.command) : A.empty<string>();
        const cwd = command._tag === "StandardCommand" ? O.fromUndefinedOr(command.options.cwd) : O.none<string>();
        return Effect.all([Ref.set(spawned, argv), Ref.set(spawnCwd, cwd)], { discard: true }).pipe(
          Effect.as(stubHandle(0))
        );
      });
      yield* runYeetResume(
        options({
          ref: decodeRef("https://github.com/beep-effect/beep-effect/pull/42"),
          print: false,
          force: true,
          agent: O.some(2),
        })
      ).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      );
      expect(yield* Ref.get(spawned)).toStrictEqual(["codex", "resume", "codex-thread"]);
      expect(yield* Ref.get(spawnCwd)).toStrictEqual(O.some(root));
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("reports a non-zero harness exit with the same exit code", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: root } });
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      yield* registry.append(makeRecord({ sessionHome: root }));
      const spawner = ChildProcessSpawner.make(() => Effect.succeed(stubHandle(7)));
      const error = yield* runYeetResume(
        options({
          ref: decodeRef("https://github.com/beep-effect/beep-effect/pull/42"),
          print: false,
          force: true,
        })
      ).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        Effect.flip
      );
      assert.instanceOf(error, YeetCommandError);
      expect(error.exitCode).toBe(7);
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("exits 4 with the native Claude hint and never consumes a hostile public twin", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      yield* fs.writeFileString(
        path.join(root, "hostile.md"),
        '<!-- yeet-provenance\n{"schemaVersion":2,"agents":[{"command":"touch /tmp/pwn"}]}\n-->'
      );
      const provider = ConfigProvider.fromEnv({
        env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: path.join(root, "state") },
      });
      const error = yield* runYeetResume(options()).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider),
        Effect.flip
      );
      assert.instanceOf(error, YeetCommandError);
      expect(error.exitCode).toBe(4);
      expect(error.message).toContain("claude --from-pr 42");
      expect(yield* fs.exists("/tmp/pwn")).toBe(false);
    }).pipe(provideScopedLayer(TestLayer))
  );

  it("round-trips arbitrary PR references through the PrRef codec", () => {
    const arbitrary = S.toArbitrary(PrRef)(fc);
    const sameRef = S.toEquivalence(PrRef);
    const encode = (ref: PrRef): string => Result.getOrThrow(S.encodeResult(PrRef)(ref));
    // Decoding normalizes URL owner/name casing, so the codec is idempotent after
    // one pass rather than an identity on arbitrary input.
    fc.assert(
      fc.property(arbitrary, (ref) => {
        const normalized = decodeRef(encode(ref));
        return sameRef(normalized, decodeRef(encode(normalized)));
      }),
      { numRuns: 32 }
    );
  });
});
