import {
  CodexSecurityError,
  runSecurityCli,
  SECURITY_PACKAGE_VERSION,
  SECURITY_PLUGIN_VERSION,
  SecuritySourceReceipt,
  securityCommand,
  securityRuntime,
  verifySecurityBundleContract,
} from "@beep/repo-cli/test/Codex";
import { expect, it } from "@effect/vitest";
import { assertFailure, assertSome, assertSuccess } from "@effect/vitest/utils";
import {
  Clock,
  ConfigProvider,
  Deferred,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Match,
  Path,
  Ref,
  Sink,
  Stream,
} from "effect";
import * as A from "effect/Array";
import { Command } from "effect/cli";
import * as Duration from "effect/Duration";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeTestLayer } from "./support/CommandTest.ts";

const runCommand = Command.runWith(securityCommand, { version: "test", renderErrors: false });
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeReceipt = S.decodeEffect(S.fromJsonString(SecuritySourceReceipt));
const revision = Str.repeat(40)("a");
const handle = (output: string, exitCode = Effect.succeed(ChildProcessSpawner.ExitCode(0))) =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    stdin: Sink.drain,
    stdout: Stream.make(new TextEncoder().encode(output)),
    stderr: Stream.empty,
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    unref: Effect.succeed(Effect.void),
  });

const fixture = Effect.fn("SecurityDispatchTest.fixture")(function* (
  options: {
    readonly dirty?: boolean;
    readonly exitCode?: number;
    readonly swapOutput?: boolean;
    readonly remote?: string | undefined;
  } = {}
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repo = yield* fs.realPath(process.cwd());
  yield* fs.writeFileString(path.join(repo, "bun.lock"), "fixture");
  yield* fs.makeDirectory(path.join(repo, "src"), { recursive: true });
  const home = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
  const output = path.join(home, "scan");
  const packageRoot = path.join(
    home,
    `.cache/beep/codex-security/${SECURITY_PACKAGE_VERSION}/node_modules/@openai/codex-security`
  );
  const cli = path.join(packageRoot, "bin/codex-security.mjs");
  yield* fs.makeDirectory(path.join(packageRoot, "bin"), { recursive: true });
  yield* fs.makeDirectory(path.join(packageRoot, "_bundled_plugin/.codex-plugin"), { recursive: true });
  yield* fs.writeFileString(cli, "fixture only; never executed");
  yield* fs.writeFileString(
    path.join(packageRoot, "package.json"),
    yield* encodeJson({ name: "@openai/codex-security", version: SECURITY_PACKAGE_VERSION })
  );
  yield* fs.writeFileString(
    path.join(packageRoot, "_bundled_plugin/.codex-plugin/plugin.json"),
    yield* encodeJson({ name: "codex-security", version: SECURITY_PLUGIN_VERSION })
  );
  const calls = yield* Ref.make<ReadonlyArray<ChildProcess.StandardCommand>>([]);
  const spawner = ChildProcessSpawner.make(
    Effect.fnUntraced(function* (command: ChildProcess.Command) {
      if (!ChildProcess.isStandardCommand(command)) return yield* Effect.die("Unexpected pipeline");
      yield* Ref.update(calls, A.append(command));
      if (command.command === "git") {
        const key = A.join(command.args, " ");
        return yield* Match.value(key).pipe(
          Match.when("remote get-url origin", () =>
            Effect.succeed(handle(options.remote ?? "git@github.com:example/project.git\n"))
          ),
          Match.when("rev-parse HEAD", () => Effect.succeed(handle(`${revision}\n`))),
          Match.when("status --porcelain", () =>
            Effect.succeed(handle(options.dirty === true ? " M src/example.ts\n" : ""))
          ),
          Match.orElse(() => Effect.die(`Unexpected git request: ${key}`))
        );
      }
      expect(command.command).toBe("node");
      expect(command.args[0]).toBe(cli);
      if (options.swapOutput === true) {
        yield* fs.remove(output, { recursive: true });
        yield* fs.symlink(path.join(repo, "src"), output);
      }
      return handle("", Effect.succeed(ChildProcessSpawner.ExitCode(options.exitCode ?? 0)));
    })
  );
  const provide = <A2, E, R>(effect: Effect.Effect<A2, E, R>) =>
    effect.pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ HOME: home, PATH: "/fixture/bin" })
      ),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
    );
  return { fs, path, repo, home, output, cli, packageRoot, calls, provide };
});

// The serial suite owns cwd until every test and its scoped fixture have finished.
const WorkingDirectory = Layer.effectDiscard(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const original = process.cwd();
    const directory = yield* fs.makeTempDirectoryScoped();
    yield* Effect.acquireRelease(
      Effect.sync(() => process.chdir(directory)),
      () => Effect.sync(() => process.chdir(original))
    );
  })
).pipe(Layer.provideMerge(NodeTestLayer));

it.layer(Layer.mergeAll(WorkingDirectory, TestConsole.layer), { timeout: "30 seconds" })(
  "security command dispatch",
  (it) => {
    it.effect(
      "renders the command index without runtime discovery",
      Effect.fnUntraced(function* () {
        yield* runCommand([]);
        expect(A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n")).toContain(
          "beep codex security scan --output-dir"
        );
      })
    );

    it.effect("preflights a dirty target without creating scan output", () =>
      Effect.gen(function* () {
        const f = yield* fixture({ dirty: true });
        yield* f.provide(runCommand(["preflight", "--output-dir", f.output, "--max-cost", "5", "--path", "src"]));
        expect(yield* f.fs.exists(f.output)).toBe(false);
        const calls = yield* Ref.get(f.calls);
        expect(A.map(calls, (call) => call.command)).toEqual(["git", "git", "git", "node"]);
        assertSome(
          O.map(A.last(calls), (call) => call.args),
          [
            f.cli,
            "scan",
            f.repo,
            "--auth",
            "chatgpt",
            "--mode",
            "standard",
            "--model",
            "gpt-6-astra",
            "--effort",
            "medium",
            "--output-dir",
            f.output,
            "--knowledge-base",
            f.path.join(f.repo, "docs/security/threat-model.md"),
            "--max-cost",
            "5",
            "--headless",
            "--format",
            "json",
            "--path",
            "src",
            "--dry-run",
          ]
        );
        expect(A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n")).toContain("uncommitted changes");
      })
    );

    for (const exitCode of [0, 7]) {
      it.effect(`records source provenance and preserves scanner exit ${exitCode}`, () =>
        Effect.gen(function* () {
          const f = yield* fixture({ exitCode });
          const result = yield* f
            .provide(runCommand(["scan", "--output-dir", f.output, "--max-cost", "12", "--timeout-minutes", "2"]))
            .pipe(Effect.result);
          if (exitCode === 0) assertSuccess(result, undefined);
          else
            assertFailure(
              result,
              CodexSecurityError.make({
                message:
                  "Security CLI exited 7. Findings or incomplete coverage require review; this is not a passing scan.",
                exitCode: 7,
              })
            );
          const receipt = yield* decodeReceipt(yield* f.fs.readFileString(f.path.join(f.output, "beep-source.json")));
          expect(receipt.repository).toBe("example/project");
          expect(receipt.revision).toBe(revision);
          expect((yield* f.fs.stat(f.output)).mode & 0o777).toBe(0o700);
          expect((yield* f.fs.stat(f.path.join(f.output, "beep-source.json"))).mode & 0o777).toBe(0o600);
          const calls = yield* Ref.get(f.calls);
          const node = A.findFirst(calls, (call) => call.command === "node");
          assertSome(
            O.map(node, (call) => call.options),
            {
              cwd: f.repo,
              extendEnv: false,
              stdin: "ignore",
              stdout: "inherit",
              stderr: "inherit",
              killSignal: "SIGTERM",
              forceKillAfter: Duration.seconds(5),
              env: {
                HOME: f.home,
                PATH: "/fixture/bin",
                CODEX_SECURITY_STATE_DIR: f.path.join(f.home, ".cache/beep/codex-security/state"),
              },
            }
          );
          expect(A.some(calls, (call) => A.contains(call.args, "--dry-run"))).toBe(false);
        })
      );
    }

    for (const scenario of [
      "dirty",
      "inside",
      "existing",
      "missing-parent",
      "bad-remote",
      "missing-runtime",
      "bad-metadata",
      "swapped",
    ]) {
      it.effect(`fails closed for ${scenario}`, () =>
        Effect.gen(function* () {
          const f = yield* fixture({
            dirty: scenario === "dirty",
            swapOutput: scenario === "swapped",
            remote: scenario === "bad-remote" ? "https://example.com/private/repo" : undefined,
          });
          yield* Match.value(scenario).pipe(
            Match.when("missing-runtime", () => f.fs.remove(f.cli)),
            Match.when("bad-metadata", () => f.fs.writeFileString(f.path.join(f.packageRoot, "package.json"), "{}")),
            Match.when("existing", () => f.fs.makeDirectory(f.output)),
            Match.orElse(() => Effect.void)
          );
          const output = Match.value(scenario).pipe(
            Match.when("inside", () => f.path.join(f.repo, "output")),
            Match.when("missing-parent", () => f.path.join(f.home, "absent", "output")),
            Match.orElse(() => f.output)
          );
          const error = yield* f
            .provide(runCommand(["scan", "--output-dir", output, "--max-cost", "5"]))
            .pipe(Effect.flip);
          const messages: Record<string, string> = {
            dirty: "Commit or stash",
            inside: "outside the repository",
            existing: "new output directory",
            "missing-parent": "Security setup failed",
            "bad-remote": "credential-free GitHub slug",
            "missing-runtime": "Install the pinned runtime",
            "bad-metadata": "metadata failed validation",
            swapped: "replaced or linked",
          };
          expect(error.message).toContain(messages[scenario]);
          const calls = yield* Ref.get(f.calls);
          expect(A.filter(calls, (call) => call.command === "node")).toHaveLength(scenario === "swapped" ? 1 : 0);
          expect(yield* f.fs.exists(f.path.join(f.repo, "src/beep-source.json"))).toBe(false);
          if (scenario === "missing-runtime" || scenario === "bad-metadata") expect(calls).toHaveLength(0);
        })
      );
    }

    it.effect("times out a stalled child and releases its scoped handle", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        // This deadline owns a fresh clock; it never advances the suite clock.
        const clock = yield* TestClock.withLive(TestClock.make());
        const started = yield* Deferred.make<void>();
        const released = yield* Ref.make(false);
        const stalled = ChildProcessSpawner.make(() =>
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() => Ref.set(released, true));
            yield* Deferred.succeed(started, undefined);
            return handle("", Effect.never);
          })
        );
        const execution = f.provide(
          runSecurityCli({
            args: ["scan"],
            stdout: "ignore",
            stderr: "ignore",
            timeout: Duration.seconds(1),
            timeoutMessage: "Fixture deadline exceeded.",
          }).pipe(
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, stalled),
            Effect.provideService(Clock.Clock, clock)
          )
        );
        const fiber = yield* execution.pipe(Effect.result, Effect.forkChild);
        yield* Deferred.await(started);
        yield* clock.adjust("1 second");
        assertFailure(yield* Fiber.join(fiber), CodexSecurityError.make({ message: "Fixture deadline exceeded." }));
        expect(yield* Ref.get(released)).toBe(true);
      })
    );

    for (const exitCode of [0, 2]) {
      it.effect(`validates a sealed export with fake upstream exit ${exitCode}`, () =>
        Effect.gen(function* () {
          const f = yield* fixture({ exitCode });
          const result = yield* f.provide(verifySecurityBundleContract(f.output)).pipe(Effect.result);
          if (exitCode === 0) assertSuccess(result, undefined);
          else
            assertFailure(
              result,
              CodexSecurityError.make({
                message: "The pinned upstream exporter rejected the sealed bundle contract. No packet was written.",
              })
            );
          const calls = yield* Ref.get(f.calls);
          expect(calls).toHaveLength(1);
          assertSome(
            O.map(A.head(calls), (call) => call.args),
            [f.cli, "export", f.output, "--export-format", "json", "--output", "-"]
          );
          assertSome(
            O.map(A.head(calls), (call) => call.options.stdout),
            "ignore"
          );
          assertSome(
            O.map(A.head(calls), (call) => call.options.stderr),
            "inherit"
          );
          expect(yield* f.fs.exists(f.output)).toBe(false);
        })
      );
    }

    it.effect("rejects a missing pinned runtime without spawning", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.fs.remove(f.cli);
        expect((yield* f.provide(securityRuntime).pipe(Effect.flip)).message).toContain(
          `@openai/codex-security@${SECURITY_PACKAGE_VERSION}`
        );
        expect(yield* Ref.get(f.calls)).toEqual([]);
      })
    );
  }
);
