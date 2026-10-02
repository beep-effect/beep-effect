import { CacheProtocolRequest, runCacheProtocolWorker } from "@beep/repo-cli/commands/Cache";
import * as Evidence from "@beep/repo-cli/commands/Cache/Cache.evidence";
import { CacheRuntimeProcess } from "@beep/repo-cli/test/Cache";
import { CacheClientPin } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { NodeCrypto, NodeFileSystem, NodePath } from "@effect/platform-node";
import { afterEach, expect, it, vi } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Fault = LiteralKit([
  "none",
  "network",
  "pin",
  "channel",
  "truncated",
  "stream-secret",
  "file-secret",
  "file-count",
  "file-bytes",
  "summaries",
  "empty-tasks",
  "task-id",
  "version",
  "exit-summary",
  "origin",
  "remote-source",
  "missing-output",
  "extra-output",
  "fallback",
  "changed-tool",
]);
const digest = Sha256Hex.make(Str.repeat(64)("a"));
const encodeSummary = S.encodeEffect(S.fromJsonString(S.Json));
const taskHash = "0123456789abcdef";
afterEach(() => vi.restoreAllMocks());

// Real HTTP fixture and filesystem surround a controlled native-process seam.
// This checks orchestration, never claims real Turbo or sandbox execution.
const fixture = Effect.fn("ProtocolRunnerTest.fixture")(function* (fault: typeof Fault.Type) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const client = yield* HttpClient.HttpClient;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-protocol-runner-" });
  const tool = path.join(root, "turbo");
  yield* fs.writeFileString(tool, "synthetic executable");
  const request = CacheProtocolRequest.make({
    channel: "stable",
    executable: tool,
    client: CacheClientPin.make({
      version: fault === "channel" ? "2.11.5-canary.1" : "2.11.4",
      sha256: digest,
      namespace: "team_runner_fixture",
    }),
  });
  let executed = 0;
  vi.spyOn(Evidence, "hashCacheExperimentExecutable").mockImplementation(() =>
    Effect.succeed(
      fault === "pin" || (fault === "changed-tool" && executed === 9) ? Sha256Hex.make(Str.repeat(64)("b")) : digest
    )
  );
  const process = vi.spyOn(CacheRuntimeProcess, "runCapturedStreams").mockImplementation(
    Effect.fn("ProtocolRunnerTest.process")(function* (options) {
      expect(options.command).toBe("/usr/bin/bwrap");
      expect(options.extendEnv).toBe(false);
      const args = options.args ?? [];
      expect(args).toContain("--unshare-user");
      const work = O.getOrThrow(A.get(args, O.getOrThrow(A.findFirstIndex(args, (arg) => arg === "--bind")) + 1));
      const name = path.basename(work);
      const positive = name === "producer" || name === "replay";
      const env = options.env ?? {};
      expect(env.PROBE_DENY_EXECUTION).toBe(name === "producer" ? "0" : "1");
      const endpoint = `${env.TURBO_API}/v8/artifacts/${taskHash}?teamId=${request.client.namespace}`;
      const headers = { authorization: `Bearer ${env.TURBO_TOKEN}` };
      const response =
        name === "producer"
          ? yield* HttpClientRequest.put(endpoint).pipe(
              HttpClientRequest.setHeaders({ ...headers, "x-artifact-tag": "fixture-tag" }),
              HttpClientRequest.bodyUint8Array(new TextEncoder().encode("synthetic complete artifact")),
              client.execute
            )
          : yield* client.get(endpoint, { headers });
      yield* response.arrayBuffer.pipe(Effect.ignore);
      const exitCode = positive ? 0 : 42;
      const writeSummary = Effect.fn("ProtocolRunnerTest.writeSummary")(function* () {
        yield* fs.makeDirectory(path.join(work, ".turbo/runs"), { recursive: true });
        const task = {
          taskId: fault === "task-id" ? "other" : "build",
          hash: taskHash,
          cache: {
            status: name === "replay" && fault !== "origin" ? "HIT" : "MISS",
            source: fault === "remote-source" ? "LOCAL" : "REMOTE",
          },
          execution: { exitCode: fault === "exit-summary" ? 7 : exitCode },
        };
        const summary = yield* encodeSummary({
          invocation: name,
          turboVersion: fault === "version" ? "wrong" : request.client.version,
          tasks: fault === "empty-tasks" ? [] : [task],
        });
        yield* fs.writeFileString(path.join(work, ".turbo/runs/run.json"), summary);
        if (fault === "summaries") yield* fs.writeFileString(path.join(work, ".turbo/runs/extra.json"), summary);
      });
      yield* writeSummary();
      const writeOutputs = Effect.fn("ProtocolRunnerTest.writeOutputs")(function* () {
        if ((positive && fault !== "missing-output") || (fault === "fallback" && !positive)) {
          yield* fs.makeDirectory(path.join(work, "dist"), { recursive: true });
          yield* fs.writeFileString(path.join(work, "dist/result.txt"), "owned-signed-fixture-output\n");
          if (fault === "extra-output") yield* fs.writeFileString(path.join(work, "dist/extra.txt"), "unexpected");
        }
      });
      yield* writeOutputs();
      const writeCaptureFault = Effect.fn("ProtocolRunnerTest.writeCaptureFault")(function* () {
        if (fault === "file-secret") yield* fs.writeFileString(path.join(work, "leaked.txt"), env.TURBO_TOKEN ?? "");
        if (fault === "file-count")
          for (const index of A.range(0, 65)) yield* fs.writeFileString(path.join(work, `count-${index}`), "x");
        if (fault === "file-bytes")
          for (const index of A.range(0, 4))
            yield* fs.writeFileString(path.join(work, `bytes-${index}`), Str.repeat(1024 * 1024)("x"));
      });
      yield* writeCaptureFault();
      executed += 1;
      return CacheRuntimeProcess.CapturedStreams.make({
        exitCode,
        stdout: fault === "stream-secret" ? (env.TURBO_TOKEN ?? "") : "",
        stderr: "",
        truncated: fault === "truncated",
      });
    }, Effect.orDie)
  );
  const run = runCacheProtocolWorker(root, request).pipe(
    Effect.provideService(FileSystem.FileSystem, {
      ...fs,
      readFileString: (file, encoding) =>
        file === "/proc/net/dev"
          ? Effect.succeed(`header\nheader\n${fault === "network" ? "eth0" : "lo"}: 0\n`)
          : fs.readFileString(file, encoding),
    })
  );
  return { run, process };
});

it.layer(
  Layer.mergeAll(
    NodeFileSystem.layer,
    NodePath.layer,
    NodeCrypto.layer,
    FetchHttpClient.layer,
    Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() => Effect.die("Unexpected native process"))
    )
  ),
  { timeout: "30 seconds", excludeTestServices: true }
)("protocol worker orchestration", (it) => {
  it.effect("records all nine isolated roots and validates the signed protocol matrix", () =>
    Effect.gen(function* () {
      const { run, process } = yield* fixture("none");
      const result = yield* run;
      expect(result.roots).toHaveLength(9);
      expect(result.observation.runs).toHaveLength(6);
      expect(result.failures).toHaveLength(3);
      expect(result.events).toHaveLength(9);
      expect(process).toHaveBeenCalledTimes(9);
    })
  );
  for (const [fault, message] of [
    ["network", "loopback-only"],
    ["pin", "requested pin"],
    ["channel", "selected client channel"],
    ["truncated", "capture exceeded"],
    ["stream-secret", "capture contains"],
    ["file-secret", "artifact contains"],
    ["file-count", "file count"],
    ["file-bytes", "bytes exceeded"],
    ["summaries", "exactly one native summary"],
    ["empty-tasks", "did not execute"],
    ["task-id", "disagrees"],
    ["version", "disagrees"],
    ["exit-summary", "disagrees"],
    ["origin", "actual remote hit"],
    ["remote-source", "actual remote hit"],
    ["missing-output", "omitted output"],
    ["extra-output", "undeclared output"],
    ["fallback", "fallback execution"],
    ["changed-tool", "identity changed"],
  ] as const)
    it.effect(`refuses ${fault}`, () =>
      Effect.gen(function* () {
        const { run } = yield* fixture(fault);
        Result.match(yield* run.pipe(Effect.result), {
          onSuccess: () => expect.fail("Worker accepted the injected fault"),
          onFailure: (error) => expect(error.message).toContain(message),
        });
      })
    );
});
