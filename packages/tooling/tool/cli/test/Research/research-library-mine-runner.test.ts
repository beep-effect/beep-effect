import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  LibraryMineLaunchPaths,
  LibraryMineRunner,
  LibraryMineRunnerError,
  LibraryMineRunnerLive,
  LibraryMineRunRequest,
  libraryMineAnswerJson,
  libraryMineArgv,
  libraryMineProfile,
  libraryMineProfileServes,
} from "@beep/repo-cli/commands/Research";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import type { LibraryMineProfileId } from "@beep/repo-cli/commands/Research";

const encoder = new TextEncoder();

const paths = LibraryMineLaunchPaths.make({
  cwd: "/s",
  schemaPath: "/s/t.json",
  outputPath: "/s/a.json",
  promptPath: "/s/p.md",
});

const fileTask =
  "Read the job file /s/p.md and follow it exactly. Do not edit any file. Reply with only the JSON object it asks for.";

type Reply =
  | { readonly _tag: "Exit"; readonly stdout: string; readonly stderr: string; readonly exitCode: number }
  | { readonly _tag: "Hang" }
  | { readonly _tag: "SpawnFails" };

const exited = (exitCode: number, stdout: string, stderr = ""): Reply => ({ _tag: "Exit", stdout, stderr, exitCode });

type Spawned = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly options: ChildProcess.CommandOptions;
  readonly stdin: O.Option<string>;
};

const stdinText = (stdin: ChildProcess.CommandOptions["stdin"]) =>
  P.isUndefined(stdin) || P.isString(stdin) || Stream.isStream(stdin) || P.isString(stdin.stream)
    ? Effect.succeed(O.none<string>())
    : stdin.stream.pipe(Stream.decodeText(), Stream.mkString, Effect.asSome);

const handleFor = (reply: Reply) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: reply._tag === "Exit" ? Effect.succeed(ChildProcessSpawner.ExitCode(reply.exitCode)) : Effect.never,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(reply._tag === "Hang"),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(7),
    stderr: reply._tag === "Exit" ? Stream.make(encoder.encode(reply.stderr)) : Stream.never,
    stdin: Sink.drain,
    stdout: reply._tag === "Exit" ? Stream.make(encoder.encode(reply.stdout)) : Stream.never,
    unref: Effect.succeed(Effect.void),
  });

// A spawner that records each launch (argv, options, the prompt piped to stdin) and answers with `reply`.
const fakeSpawner = Effect.fnUntraced(function* (reply: Reply) {
  const spawned = yield* Ref.make<ReadonlyArray<Spawned>>([]);
  const spawner = ChildProcessSpawner.make(
    Effect.fnUntraced(function* (command) {
      if (!ChildProcess.isStandardCommand(command)) return yield* Effect.die("Mining spawns a standard command.");
      const stdin = yield* stdinText(command.options.stdin);
      const args = A.map(command.args, (arg) => (P.isString(arg) ? arg : Redacted.value(arg)));
      yield* Ref.update(spawned, A.append({ command: command.command, args, options: command.options, stdin }));
      if (reply._tag === "SpawnFails")
        return yield* PlatformError.systemError({
          _tag: "NotFound",
          module: "ChildProcess",
          method: "spawn",
          description: "fixture binary is missing",
        });
      return handleFor(reply);
    })
  );
  return { spawned, spawner };
});

const request = (
  profileId: LibraryMineProfileId,
  overrides: Partial<Pick<LibraryMineRunRequest, "argv" | "outputPath" | "timeoutMinutes">> = {}
) => {
  const profile = libraryMineProfile(profileId);
  return LibraryMineRunRequest.make({
    tier: "t2",
    jobKey: "job",
    profile,
    argv: overrides.argv ?? libraryMineArgv(profile, paths),
    cwd: "/s",
    prompt: "Read this capture.",
    outputPath: overrides.outputPath ?? O.none(),
    timeoutMinutes: overrides.timeoutMinutes ?? 1,
  });
};

const runnerLayer = (spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]) =>
  LibraryMineRunnerLive.pipe(Layer.provide(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner)));

// Build the live layer in the test's scope and run one launch through the service it builds.
const runWith = <E, R>(layer: Layer.Layer<LibraryMineRunner, E, R>, launch: LibraryMineRunRequest) =>
  layer.pipe(
    Layer.build,
    Effect.flatMap((context) => Context.get(context, LibraryMineRunner).run(launch))
  );

const runLive = (spawner: ChildProcessSpawner.ChildProcessSpawner["Service"], launch: LibraryMineRunRequest) =>
  runWith(runnerLayer(spawner), launch);

const withEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

describe("research library mine runner profiles", () => {
  it("builds the exact launch argv for every profile", () => {
    const argvOf = (id: LibraryMineProfileId) => libraryMineArgv(paths)(libraryMineProfile(id));
    expect(argvOf("codex-luna")).toStrictEqual([
      "codex",
      "exec",
      "-m",
      "gpt-6-luna",
      "-c",
      'model_reasoning_effort="medium"',
      "--output-schema",
      "/s/t.json",
      "-s",
      "read-only",
      "--skip-git-repo-check",
      "--cd",
      "/s",
      "-o",
      "/s/a.json",
      "-",
    ]);
    expect(argvOf("claude")).toStrictEqual([
      "claude",
      "-p",
      "--model",
      "claude-opus-5-5",
      "--effort",
      "medium",
      "--output-format",
      "text",
      "--tools",
      "",
      "--strict-mcp-config",
      "--no-session-persistence",
    ]);
    const proxy = (model: string) => [
      "claude",
      "-p",
      "--model",
      model,
      "--settings",
      '{"effortLevel":"medium"}',
      "--output-format",
      "text",
      "--tools",
      "",
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--no-session-persistence",
    ];
    expect(argvOf("proxy-sol")).toStrictEqual(proxy("gpt-6.1-sol(medium)"));
    expect(argvOf("proxy-opus")).toStrictEqual(proxy("claude-opus-5-5"));
    expect(argvOf("junie")).toStrictEqual([
      "junie",
      "--model=claude-opus-5-5",
      "--effort=medium",
      "--output-format=text",
      "--skip-update-check",
      "-p",
      "/s",
      `--task=${fileTask}`,
    ]);
    expect(argvOf("cursor")).toStrictEqual([
      "cursor-agent",
      "-p",
      "--model",
      "claude-opus-5-5-medium",
      "--output-format",
      "text",
      "--sandbox",
      "enabled",
      "--workspace",
      "/s",
      fileTask,
    ]);
  });

  it("routes prompt transports, output files and tiers per profile", () => {
    const ids: ReadonlyArray<LibraryMineProfileId> = [
      "codex-luna",
      "codex-sol",
      "junie",
      "claude",
      "proxy-sol",
      "proxy-opus",
      "cursor",
    ];
    expect(
      A.map(ids, (id) => {
        const profile = libraryMineProfile(id);
        return [id, profile.transport, profile.outputFile, profile.externalLane, profile.route];
      })
    ).toStrictEqual([
      ["codex-luna", "stdin", true, false, "codex-cli"],
      ["codex-sol", "stdin", true, false, "codex-cli"],
      ["junie", "prompt-file", false, true, "junie-cli"],
      ["claude", "stdin", false, false, "claude-code"],
      ["proxy-sol", "stdin", false, false, "proxy-workflow"],
      ["proxy-opus", "stdin", false, false, "proxy-workflow"],
      ["cursor", "prompt-file", false, true, "cursor-seat"],
    ]);
    const servesT1 = libraryMineProfileServes("t1");
    expect(A.filter(ids, (id) => servesT1(libraryMineProfile(id)))).toStrictEqual([
      "codex-luna",
      "claude",
      "proxy-opus",
    ]);
  });

  it("extracts the answer object and falls back to the trimmed text", () => {
    strictEqual(libraryMineAnswerJson('Here it is:\n```json\n{"a":{"b":1}}\n```'), '{"a":{"b":1}}');
    strictEqual(libraryMineAnswerJson("  no object here \n"), "no object here");
    strictEqual(libraryMineAnswerJson(" } reversed { "), "} reversed {");
  });
});

const platform = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

it.layer(platform, { timeout: "30 seconds" })("research library mine live runner", (it) => {
  it.effect("pipes a stdin prompt to the inherited environment and returns stdout", () =>
    Effect.gen(function* () {
      const fake = yield* fakeSpawner(exited(0, '{"coverage":"complete"}'));
      const answer = yield* runLive(fake.spawner, request("claude"));
      strictEqual(answer, '{"coverage":"complete"}');
      const [spawned] = yield* Ref.get(fake.spawned);
      expect([spawned?.command, spawned?.options.cwd, spawned?.options.extendEnv, spawned?.options.env]).toStrictEqual([
        "claude",
        "/s",
        true,
        undefined,
      ]);
      expect(spawned?.args).toStrictEqual(A.drop(libraryMineArgv(libraryMineProfile("claude"), paths), 1));
      assertSome(
        O.flatMap(O.fromNullishOr(spawned), (launch) => launch.stdin),
        "Read this capture."
      );
    })
  );

  it.effect("ignores stdin for a prompt-file runner and reads a -o runner's output file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "research-library-mine-runner-" });
      const junie = yield* fakeSpawner(exited(0, "junie answer"));
      const junieAnswer = yield* runLive(junie.spawner, request("junie"));
      strictEqual(junieAnswer, "junie answer");
      const [prompted] = yield* Ref.get(junie.spawned);
      strictEqual(prompted?.options.stdin, "ignore");
      assertNone(O.flatMap(O.fromNullishOr(prompted), (launch) => launch.stdin));
      const output = path.join(dir, "answer.json");
      yield* fs.writeFileString(output, '{"decision":"skip"}');
      const codex = yield* fakeSpawner(exited(0, "progress chatter on stdout"));
      const written = yield* runLive(codex.spawner, request("codex-luna", { outputPath: O.some(output) }));
      strictEqual(written, '{"decision":"skip"}');
      const missing = yield* Effect.flip(
        runLive(codex.spawner, request("codex-luna", { outputPath: O.some(path.join(dir, "absent.json")) }))
      );
      expect([missing.quota, missing.message]).toStrictEqual([false, "codex wrote no output file."]);
    })
  );

  it.effect("launches proxy profiles with a scrubbed environment carrying the redacted client token", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "research-library-mine-home-" });
      yield* fs.makeDirectory(path.join(home, ".cli-proxy-api"));
      yield* fs.writeFileString(path.join(home, ".cli-proxy-api/client-token"), "  proxy-token\n");
      const fake = yield* fakeSpawner(exited(0, "proxied"));
      const proxied = yield* runLive(fake.spawner, request("proxy-sol")).pipe(
        withEnv({ HOME: home, PATH: "/opt/bin" })
      );
      strictEqual(proxied, "proxied");
      yield* runLive(fake.spawner, request("proxy-opus")).pipe(withEnv({ HOME: home }));
      const launches = yield* Ref.get(fake.spawned);
      const environments = A.map(launches, (launch) => {
        const env = launch.options.env ?? {};
        const token = env.ANTHROPIC_AUTH_TOKEN;
        return [
          launch.options.extendEnv,
          env.HOME,
          env.PATH,
          env.TERM,
          env.ANTHROPIC_BASE_URL,
          env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
          Redacted.isRedacted(token) ? Redacted.value(token) : token,
        ];
      });
      expect(environments).toStrictEqual([
        [false, home, `${home}/.local/bin:/opt/bin`, "dumb", "http://127.0.0.1:8317", "gpt-6-luna", "proxy-token"],
        [false, home, `${home}/.local/bin:/usr/bin:/bin`, "dumb", "http://127.0.0.1:8317", "gpt-6-luna", "proxy-token"],
      ]);
      const noToken = yield* Effect.flip(
        runLive(fake.spawner, request("proxy-sol")).pipe(withEnv({ HOME: path.join(home, "elsewhere") }))
      );
      strictEqual(noToken.message, "claude failed to launch: The local proxy client token is unavailable.");
      const noHome = yield* Effect.flip(runLive(fake.spawner, request("proxy-sol")).pipe(withEnv({})));
      strictEqual(noHome.message, "claude failed to launch: HOME is not set.");
      const brokenPath = yield* Effect.flip(
        runLive(fake.spawner, request("proxy-sol")).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.make((key) =>
              key[0] === "PATH"
                ? Effect.fail(new ConfigProvider.SourceError({ message: "environment unreadable" }))
                : Effect.succeed(ConfigProvider.makeValue(home))
            )
          )
        )
      );
      strictEqual(brokenPath.message, "claude failed to launch: PATH could not be read.");
      strictEqual((yield* Ref.get(fake.spawned)).length, 2);
    })
  );

  it.effect("fails an empty argv and a launch the spawner rejects without a quota pause", () =>
    Effect.gen(function* () {
      const fake = yield* fakeSpawner({ _tag: "SpawnFails" });
      const empty = yield* Effect.flip(runLive(fake.spawner, request("claude", { argv: [] })));
      expect([empty.quota, empty.message]).toStrictEqual([false, "Runner argv is empty."]);
      strictEqual((yield* Ref.get(fake.spawned)).length, 0);
      const rejected = yield* Effect.flip(runLive(fake.spawner, request("claude")));
      assertInstanceOf(rejected, LibraryMineRunnerError);
      assertTrue(!rejected.quota);
      expect(rejected.message).toMatch(/^claude failed to launch: /);
    })
  );

  it.effect("classifies non-zero exits by their stderr tail and redacts credentials", () =>
    Effect.gen(function* () {
      const plain = yield* fakeSpawner(exited(2, "", "boom: token=abc123 refused"));
      const failure = yield* Effect.flip(runLive(plain.spawner, request("claude")));
      expect([failure.quota, failure.message]).toStrictEqual([false, "claude exited 2: boom: [redacted] refused"]);
      const limited = yield* fakeSpawner(exited(1, "", "Error: 429 Too Many Requests"));
      const quota = yield* Effect.flip(runLive(limited.spawner, request("claude")));
      expect([quota.quota, quota.message]).toStrictEqual([true, "claude exited 1: Error: 429 Too Many Requests"]);
    })
  );

  it.effect("reads the log file a runner's stderr names for its quota signal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "research-library-mine-log-" });
      const log = path.join(dir, "junie.log");
      yield* fs.writeFileString(log, "step 1 ok\nUsage limit reached for this billing cycle\n");
      const exhausted = yield* fakeSpawner(exited(1, "", `Junie stopped; see log file: ${log}`));
      const quota = yield* Effect.flip(runLive(exhausted.spawner, request("junie")));
      expect([quota.quota, quota.message]).toStrictEqual([true, `junie exited 1: Junie stopped; see log file: ${log}`]);
      const clean = path.join(dir, "clean.log");
      yield* fs.writeFileString(clean, "step 1 failed: syntax error\n");
      const crashed = yield* fakeSpawner(exited(1, "", `Junie stopped; see log file: ${clean}`));
      strictEqual((yield* Effect.flip(runLive(crashed.spawner, request("junie")))).quota, false);
      const vanished = yield* fakeSpawner(exited(1, "", `Junie stopped; see log file: ${path.join(dir, "gone.log")}`));
      strictEqual((yield* Effect.flip(runLive(vanished.spawner, request("junie")))).quota, false);
    })
  );
});

// A runner over its own empty memory filesystem: the never-exiting child reads no file.
const runDetached = (spawner: ChildProcessSpawner.ChildProcessSpawner["Service"], launch: LibraryMineRunRequest) =>
  runWith(runnerLayer(spawner).pipe(Layer.provide(MemoryFileSystem.layer)), launch);

// Outside the shared layer block so this test owns its TestClock before advancing it.
it.effect("times out a runner that never exits", () =>
  Effect.gen(function* () {
    const fake = yield* fakeSpawner({ _tag: "Hang" });
    const fiber = yield* runDetached(fake.spawner, request("claude")).pipe(Effect.flip, Effect.forkChild);
    yield* TestClock.adjust("1 minute");
    const timedOut = yield* Fiber.join(fiber);
    expect([timedOut.quota, timedOut.message]).toStrictEqual([false, "claude timed out after 1 minutes."]);
  })
);
