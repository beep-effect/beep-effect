import { CacheFixtureRuntime, CacheSyntheticRequest } from "@beep/repo-cli/commands/Cache";
import { runCacheSyntheticForTesting } from "@beep/repo-cli/test/Cache";
import { CacheClientPin } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Crypto, Effect, FileSystem, Layer, Match, Path, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const platform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const hash = (text: string) => hashBytes(new TextEncoder().encode(text));
const faults = LiteralKit([
  "none",
  "extra-task",
  "wrong-command",
  "remote",
  "foreign-hit",
  "unknown-cache",
  "missing-verdict",
  "wrong-verdict",
  "extra-output",
  "missing-log",
  "extra-summary",
  "bad-client-version",
  "bad-bun-version",
  "drift-client",
  "drift-bun",
]);

// This is a deterministic process double. Its observations test the runner's
// validation and comparison logic; they are never saved as qualification evidence.
const fixture = Effect.fn("SyntheticOrchestrationTest.fixture")(function* (fault: typeof faults.Type = "none") {
  const crypto = yield* Crypto.Crypto;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-synthetic-orchestration-" });
  const runtime = Effect.fnUntraced(function* (name: string, version: string) {
    const executable = path.join(root, name);
    yield* fs.writeFileString(executable, name);
    return CacheFixtureRuntime.make({ executable, pin: { version, sha256: yield* hash(name) } });
  });
  const bun = yield* runtime("bun-a", "1.4.1");
  const alternateBun = yield* runtime("bun-b", "1.4.2");
  const turbo = yield* runtime("turbo", "2.10.0");
  const request = CacheSyntheticRequest.make({
    channel: "stable",
    client: CacheClientPin.make({ ...turbo.pin, namespace: "test" }),
    executable: turbo.executable,
    bun,
    alternateBun,
  });
  const cached = MutableHashSet.empty<string>();
  const calls: Array<string> = [];
  const spawner = ChildProcessSpawner.make(
    Effect.fnUntraced(
      function* (command) {
        if (!ChildProcess.isStandardCommand(command)) return yield* Effect.die("Unexpected piped command");
        expect(command.command).toBe("/usr/bin/bwrap");
        expect(command.options.extendEnv).toBe(false);
        expect(command.args).toContain("--unshare-all");
        expect(command.args).toContain("--die-with-parent");
        const args = command.args;
        const bind = O.getOrThrow(A.findFirstIndex(args, Equal.equals("--bind")));
        const directory = args[bind + 1];
        const guest = args[bind + 2];
        const invocation = A.drop(args, O.getOrThrow(A.findFirstIndex(args, Equal.equals("--"))) + 1);
        const env = command.options.env ?? {};
        const version = env.QUALIFY_BUN_SHA256 === bun.pin.sha256 ? bun.pin.version : alternateBun.pin.version;
        const write = Effect.fnUntraced(function* (relative: string, text: string) {
          const target = path.join(directory, relative);
          yield* fs.makeDirectory(path.dirname(target), { recursive: true });
          yield* fs.writeFileString(target, text);
        });
        let output = "";
        let exitCode = 0;
        if (A.contains(invocation, "--version")) {
          const version = () =>
            invocation[0] === "/tools/turbo"
              ? fault === "bad-client-version"
                ? "wrong"
                : request.client.version
              : fault === "bad-bun-version"
                ? "wrong"
                : env.QUALIFY_BUN_SHA256 === bun.pin.sha256
                  ? bun.pin.version
                  : alternateBun.pin.version;
          output = version();
        } else {
          const observeRun = Effect.fn("SyntheticOrchestrationTest.observeRun")(function* () {
            const label = path.basename(directory);
            calls.push(label);
            const absent = label === "absent-script";
            const enabled = A.contains(invocation, "--cache=local:rw");
            const inputs: Array<string> = [];
            for (const relative of [
              "package.json",
              "bun.lock",
              "turbo.json",
              "packages/fixture/turbo.json",
              "packages/fixture/input.txt",
            ])
              inputs.push(
                (yield* fs.exists(path.join(directory, relative)))
                  ? yield* fs.readFileString(path.join(directory, relative))
                  : ""
              );
            const taskHash = Str.slice(
              0,
              16
            )(yield* hash(A.join([...inputs, env.QUALIFY_INPUT ?? "", env.QUALIFY_BUN_SHA256 ?? ""], "\0")));
            const cacheKey = `${directory}:${taskHash}`;
            const hit = enabled && MutableHashSet.has(cached, cacheKey);
            const failing = yield* fs.exists(path.join(directory, "packages/fixture/fail.txt"));
            exitCode = failing ? 7 : 0;
            const task = {
              taskId: "@qualification/fixture#qualify",
              hash: taskHash,
              cache: { status: hit ? "HIT" : "MISS", local: hit, remote: false },
              command: "sh fixture.sh",
              execution: { exitCode },
            };
            const writeSummary = Effect.fn("SyntheticOrchestrationTest.writeSummary")(function* () {
              const altered = {
                ...task,
                command: fault === "wrong-command" ? "unreviewed" : task.command,
                cache: {
                  status: Match.value(fault).pipe(
                    Match.when("unknown-cache", () => "UNKNOWN"),
                    Match.when("foreign-hit", () => "HIT"),
                    Match.orElse(() => task.cache.status)
                  ),
                  local: task.cache.local,
                  remote: fault === "remote",
                },
                ...Match.value(fault).pipe(
                  Match.when("missing-verdict", () => ({ execution: undefined })),
                  Match.when("wrong-verdict", () => ({ execution: { exitCode: 7 } })),
                  Match.orElse(() => ({}))
                ),
              };
              yield* write(
                ".turbo/runs/run.json",
                yield* encodeJson({ tasks: absent ? [] : fault === "extra-task" ? [altered, altered] : [altered] })
              );
              if (fault === "extra-summary") yield* write(".turbo/runs/extra.json", "{}");
            });
            yield* writeSummary();
            const finalizeCapture = Effect.fn("SyntheticOrchestrationTest.finalizeCapture")(function* () {
              if (!absent) {
                const writeOutputs = Effect.fn("SyntheticOrchestrationTest.writeOutputs")(function* () {
                  const input = yield* fs.readFileString(path.join(directory, "packages/fixture/input.txt"));

                  yield* write("packages/fixture/out/value.txt", `${env.QUALIFY_INPUT}\n${input}${version}\n`);
                  let log = "qualification fixture\n";
                  for (const [filename, text] of R.toEntries({
                    "unsafe.txt": "QUALIFICATION_SYNTHETIC_SECRET_629a94d2",
                    "path.txt": `${guest}/packages/fixture`,
                    "overflow.txt": Str.repeat(65537)("x"),
                  }))
                    if (yield* fs.exists(path.join(directory, "packages/fixture", filename))) log += text;
                  yield* write("packages/fixture/out/task.log", log);
                  if (fault === "extra-output") yield* write("packages/fixture/out/undeclared", "unexpected");
                  if (enabled && fault !== "missing-log")
                    yield* write("packages/fixture/.turbo/turbo-qualify.log", log);
                  if (enabled && !failing) MutableHashSet.add(cached, cacheKey);
                  output = `${log}\nSummary: ${guest}/.turbo/runs/run.json\n`;
                });
                yield* writeOutputs();
              } else if (fault === "drift-client" || fault === "drift-bun") {
                yield* fs.writeFileString(fault === "drift-client" ? turbo.executable : bun.executable, "changed");
              }
            });
            yield* finalizeCapture();
          });
          yield* observeRun();
        }
        const stream = Stream.make(new TextEncoder().encode(output));
        return ChildProcessSpawner.makeHandle({
          all: stream,
          stdout: stream,
          stderr: Stream.empty,
          stdin: Sink.drain,
          exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
          isRunning: Effect.succeed(false),
          kill: () => Effect.void,
          pid: ChildProcessSpawner.ProcessId(1),
          unref: Effect.succeed(Effect.void),
        });
      },
      Effect.orDie,
      Effect.provideService(Crypto.Crypto, crypto)
    )
  );
  const run = (changed = request) =>
    runCacheSyntheticForTesting(root, changed).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
    );
  return { root, fs, path, run, request, calls };
});

describe("synthetic orchestration process boundary", () => {
  it.effect(
    "compares fresh, replay, invalidation and adversarial observations and removes disposable roots",
    Effect.fnUntraced(function* () {
      const { root, fs, path, run, calls } = yield* fixture();
      const receipt = yield* run();
      expect(receipt.checks.length).toBeGreaterThan(25);
      expect(A.filter(receipt.checks, (check) => !check.passed)).toEqual([]);
      expect(A.filter(receipt.runs, (run) => run.origin === "local-hit").length).toBeGreaterThan(10);
      expect(A.filter(receipt.runs, (run) => run.exitCode !== 0)).toHaveLength(2);
      expect(receipt.nonExecutions[0]?.executionRecordCount).toBe(0);
      expect(calls).toContain("runtime");
      expect(calls).toContain("shadow-unicode-input");
      expect(yield* fs.readDirectory(path.join(root, ".beep/cache/experiments"))).toEqual(["owner"]);
    }, provideScopedLayer(platform))
  );

  for (const fault of faults.omitOptions(["none"])) {
    it.effect(
      `rejects ${fault} and still removes disposable roots`,
      Effect.fnUntraced(function* () {
        const { root, fs, path, run } = yield* fixture(fault);
        const result = yield* run().pipe(Effect.result);
        expect(Result.isFailure(result)).toBe(true);
        expect(yield* fs.readDirectory(path.join(root, ".beep/cache/experiments"))).toEqual(["owner"]);
      }, provideScopedLayer(platform))
    );
  }

  it.effect(
    "rejects mismatched pins, duplicate runtimes and wrong channels before spawning",
    Effect.fnUntraced(function* () {
      const { request, run, calls } = yield* fixture();
      for (const changed of [
        CacheSyntheticRequest.make({
          ...request,
          bun: CacheFixtureRuntime.make({ ...request.bun, pin: request.alternateBun.pin }),
        }),
        CacheSyntheticRequest.make({ ...request, alternateBun: request.bun }),
        CacheSyntheticRequest.make({
          ...request,
          client: CacheClientPin.make({ ...request.client, sha256: request.bun.pin.sha256 }),
        }),
        CacheSyntheticRequest.make({ ...request, channel: "canary" }),
      ]) {
        expect(Result.isFailure(yield* run(changed).pipe(Effect.result))).toBe(true);
      }
      expect(calls).toEqual([]);
    }, provideScopedLayer(platform))
  );
});
