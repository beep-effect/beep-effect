import { createConnection } from "node:net";
import {
  CoworkLifecycleError,
  CoworkLifecyclePolicy,
  CoworkLifecycleRuntime,
  makeCoworkLifecycleReceiver,
} from "@beep/repo-ai-metrics/claude-cowork-lifecycle";
import { CoworkLifecyclePluginRequest, renderCoworkLifecyclePlugin } from "@beep/repo-ai-metrics/claude-cowork-plugin";
import { encodeNativeTraceBatch, NativeExportInput } from "@beep/repo-ai-metrics/native-export";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { makeObservationControl, ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import {
  coworkLifecycleFixtureCodecs,
  coworkPeerSource,
  hashObservationPayload,
  makeCoworkLifecycleFixtureReceiver,
  nativeTraceWire,
  prepareCoworkLifecycleFixtureHook,
} from "@beep/repo-ai-metrics/test/claude-cowork-lifecycle";
import { coworkAncestorFixture } from "@beep/repo-ai-metrics/test/cowork-ancestor";
import { cursorLifecycleFixtureCodecs } from "@beep/repo-ai-metrics/test/cursor-lifecycle";
import { makeLifecycleAckServer } from "@beep/repo-ai-metrics/test/lifecycle-ack-server";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect } from "@effect/vitest";
import {
  assertFailure,
  assertFalse,
  assertNone,
  assertSuccess,
  assertTrue,
  deepStrictEqual,
} from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import type { NativeTraceBatch } from "@beep/repo-ai-metrics/native-trace";
import type { ObservationControl } from "@beep/repo-ai-metrics/observation-control";
import type { PlatformError } from "effect/PlatformError";

const isPolicy = S.is(CoworkLifecyclePolicy);
const json = S.fromJsonString(S.Unknown);
const encode = S.encodeUnknownEffect(json);
const salt = "synthetic-cowork-passive-salt";
const id = Sha256Hex.make(Str.repeat(64)("a"));
const sql = makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver });
const sourceRaceHarness = `import ast, json, os, sys
config = json.load(sys.stdin)
tree = ast.parse(config["source"])
tree.body = [node for node in tree.body if not isinstance(node, ast.Try)]
exec(compile(tree, "owned-public-helper-fixture", "exec"))
original_digest = public_digest
def swapped_digest(filename, maximum):
    result = original_digest(filename, maximum)
    if filename == config["target"]:
        os.replace(config["replacement"], filename)
    return result
public_digest = swapped_digest
bounded_json = lambda: config["policy"]
sys.argv = ["owned-fixture", config["socketPath"]]
try:
    serve()
except ValueError:
    assert not os.path.lexists(config["socketPath"])
    print("refused-before-listen")
else:
    raise AssertionError("source replacement admitted")
`;
const platformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.merge(NodeFileSystem.layer, NodePath.layer))
);
const sha = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(path);
  return yield* hashObservationPayload(bytes);
});
const start = {
  hook_event_name: "SessionStart",
  session_id: "PRIVATE-native-session",
  source: "resume",
  session_title: "PRIVATE-title",
  transcript_path: "/PRIVATE/transcript",
  prompt: "PRIVATE-prompt",
  error: "PRIVATE-error",
  sourceSelector: "forged",
  rootId: "forged-root",
  occurrenceId: "forged-occurrence",
  unknown: { text: "PRIVATE-secret" },
};
const makeDelivery = (
  policy: CoworkLifecyclePolicy,
  journal: Effect.Success<ReturnType<typeof makeNativeIntakeJournal>>,
  control: ObservationControl,
  ancestor: Effect.Success<typeof coworkAncestorFixture>
) => {
  const deliver = Effect.fn("CoworkLifecycleTest.deliver")(function* (
    body: unknown,
    override = policy,
    occurrenceId = "synthetic-occurrence-0001",
    selector = "local-agent"
  ) {
    const encoded = yield* encode(body);
    const receiver = yield* makeCoworkLifecycleFixtureReceiver(override).pipe(
      Effect.provideService(CoworkLifecycleRuntime, { journal, control })
    );
    const opened = yield* receiver.open().pipe(Effect.result);
    if (Result.isFailure(opened)) return { result: Result.fail(opened.failure), reply: Result.fail(opened.failure) };
    yield* prepareCoworkLifecycleFixtureHook(opened.success.socketPath, encoded, selector, occurrenceId);
    const callback = yield* coworkLifecycleFixtureCodecs.decodeCallback(encoded);
    const projected = yield* coworkLifecycleFixtureCodecs.encodeEnvelope(
      coworkLifecycleFixtureCodecs.makeEnvelope({ callback, occurrenceId })
    );
    const sending = yield* Effect.forkChild(
      ancestor.send(opened.success.socketPath, projected).pipe(
        Effect.flatMap(cursorLifecycleFixtureCodecs.decodeAcknowledgement),
        Effect.mapError(() => CoworkLifecycleError.make({ reason: "transport" })),
        Effect.result
      )
    );
    const result = yield* opened.success.accept.pipe(Effect.result);
    const reply = yield* Fiber.join(sending);
    return { result, reply };
  });
  return deliver;
};
const fixture = Effect.fn("CoworkLifecycleTest.fixture")(function* (maxPages = 32) {
  yield* TestClock.adjust("1 second");
  const fs = yield* FileSystem.FileSystem;
  const ancestor = yield* coworkAncestorFixture;
  const runtimeExecutable = ancestor.runtime.executable;
  const pythonExecutable = yield* fs.realPath("/usr/bin/python3");
  const namespaceId = yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt));
  const sourceRoot = yield* fs.makeTempDirectoryScoped({ prefix: "cowork-source-fixture-" });
  const sources = [`${sourceRoot}/dispatcher.js`, `${sourceRoot}/envelope.js`];
  yield* Effect.forEach(sources, (path) =>
    fs.writeFileString(path, "// synthetic public source fixture; no native code\n", { mode: 0o600 })
  );
  const sourcePins = yield* Effect.forEach(
    sources,
    Effect.fnUntraced(function* (path) {
      return { path, sha256: yield* sha(path) };
    })
  );
  const policy = CoworkLifecyclePolicy.make({
    workspace: process.cwd(),
    runtimeExecutable,
    runtimeSha256: yield* sha(runtimeExecutable),
    pythonExecutable,
    pythonSha256: yield* sha(pythonExecutable),
    helperSha256: yield* hashObservationPayload(new TextEncoder().encode(coworkPeerSource)),
    rootId: id,
    hostId: id,
    routeId: id,
    hashSalt: Redacted.make(salt),
    approvedModels: [],
    enrollmentId: id,
    socketPath: `${sourceRoot}/s`,
    appExecutable: runtimeExecutable,
    appSha256: yield* sha(runtimeExecutable),
    appPid: ancestor.appPid,
    appStartTicks: ancestor.appStartTicks,
    sourcePins,
  });
  const journal = yield* makeNativeIntakeJournal(
    TranscriptIntakeConfig.make({ hostId: id, namespaceId, maxPages, maxPayloadBytes: 1048576, maxDatabasePages: 256 })
  );
  const control = yield* makeObservationControl(
    ObservationControlPolicy.make({ maxActive: 1, drainTimeoutMillis: 1000 })
  );
  yield* control.resume;
  return { policy, journal, control, namespaceId, ancestor, deliver: makeDelivery(policy, journal, control, ancestor) };
});

const syntheticCoworkOutput = Effect.fnUntraced(function* (fault: string, policy: CoworkLifecyclePolicy) {
  const body = yield* encode(start);
  const callback = yield* coworkLifecycleFixtureCodecs.decodeCallback(body);
  const envelope = coworkLifecycleFixtureCodecs.makeEnvelope({
    callback,
    occurrenceId: "synthetic-mismatch-occurrence",
  });
  const ready = yield* encode({ ready: true });
  const observed = yield* encode({
    peer: {
      peerPid: 1,
      peerStartTicks: "1",
      runtimePid: 1,
      runtimeStartTicks: "1",
      uid: 1000,
      cwd: fault === "cwd" ? "/synthetic-wrong-root" : policy.workspace,
      runtimeSha256: fault === "runtime" ? id : policy.runtimeSha256,
      appPid: fault === "app-pid" ? policy.appPid + 1 : policy.appPid,
      appStartTicks: fault === "app-generation" ? "not-the-enrolled-generation" : policy.appStartTicks,
    },
    callback: envelope,
  });
  return fault === "startup-timeout"
    ? Stream.never
    : fault === "listen-timeout"
      ? Stream.concat(Stream.make(new TextEncoder().encode(`${ready}\n`)), Stream.never)
      : Stream.make(new TextEncoder().encode(`${ready}\n${observed}\n`));
});

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) => {
  it.layer(TestClock.layer())((it) =>
    it.effect("bounded startup qualification does not consume the configured post-readiness listen window", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const fs = yield* FileSystem.FileSystem;
        const startup = yield* Deferred.make<void>();
        const ready = yield* Deferred.make<string, CoworkLifecycleError | PlatformError>();
        let delayed = false;
        const policy = CoworkLifecyclePolicy.make({ ...f.policy, listenMillis: 3000 });
        const guarded = FileSystem.FileSystem.of({
          ...fs,
          open: Effect.fn("CoworkLifecycleTest.delayedInterpreter")((path, options) =>
            fs.open(path, options).pipe(
              Effect.map((file) =>
                path !== policy.pythonExecutable
                  ? file
                  : {
                      ...file,
                      stat: file.stat,
                      readAlloc: Effect.fn("CoworkLifecycleTest.delayedRead")((size) => {
                        if (delayed) return file.readAlloc(size);
                        delayed = true;
                        return Deferred.succeed(startup, undefined).pipe(
                          Effect.andThen(Effect.sleep("3 seconds")),
                          Effect.andThen(file.readAlloc(size))
                        );
                      }),
                    }
              )
            )
          ),
        });
        const receiver = yield* makeCoworkLifecycleFixtureReceiver(policy).pipe(
          Effect.provideService(CoworkLifecycleRuntime, { journal: f.journal, control: f.control }),
          Effect.provideService(FileSystem.FileSystem, guarded)
        );
        const receiving = yield* Effect.forkChild(
          receiver.open().pipe(
            Effect.tapError((error) => Deferred.fail(ready, error)),
            Effect.flatMap((opened) => Deferred.succeed(ready, opened.socketPath).pipe(Effect.andThen(opened.accept))),
            Effect.result,
            Effect.provideService(FileSystem.FileSystem, guarded)
          )
        );
        yield* Deferred.await(startup).pipe(
          Effect.timeoutOrElse({ duration: "5 seconds", orElse: () => Effect.die("startup-delay-not-observed") }),
          TestClock.withLive
        );
        yield* TestClock.adjust("3 seconds");
        const path = yield* Deferred.await(ready).pipe(
          Effect.timeoutOrElse({
            duration: "5 seconds",
            orElse: () => Effect.die("readiness-not-observed-after-delay"),
          }),
          TestClock.withLive
        );
        yield* TestClock.adjust("2500 millis");
        const body = yield* encode(start);
        const callback = yield* coworkLifecycleFixtureCodecs.decodeCallback(body);
        const projected = yield* coworkLifecycleFixtureCodecs.encodeEnvelope(
          coworkLifecycleFixtureCodecs.makeEnvelope({ callback, occurrenceId: "late-in-configured-window" })
        );
        yield* f.ancestor.send(path, projected).pipe(TestClock.withLive);
        const result = yield* Fiber.join(receiving).pipe(
          Effect.timeoutOrElse({
            duration: "5 seconds",
            orElse: () => Effect.die("admission-not-terminal-after-callback"),
          }),
          TestClock.withLive
        );
        const receipt = yield* Effect.fromResult(result);
        expect(receipt.accepted).toBe(1);
        expect((yield* f.journal.stats).pages).toBe(1);
      })
    )
  );
  it.layer(TestClock.layer())((it) =>
    it.effect(
      "a stalled journal acknowledgement expires without a commit or durable ACK and removes the owned listener",
      () =>
        Effect.gen(function* () {
          const f = yield* fixture();
          const fs = yield* FileSystem.FileSystem;
          const attempted = yield* Deferred.make<void>();
          const journal: typeof f.journal = {
            ...f.journal,
            acceptBatch: () => Deferred.succeed(attempted, undefined).pipe(Effect.andThen(Effect.never)),
          };
          const deliver = makeDelivery(f.policy, journal, f.control, f.ancestor);
          const delivering = yield* Effect.forkChild(deliver(start));
          yield* Deferred.await(attempted);
          yield* TestClock.adjust("1 second");
          const delivered = yield* Fiber.join(delivering);
          assertFailure(delivered.result, CoworkLifecycleError.make({ reason: "transport" }));
          assertFailure(delivered.reply, CoworkLifecycleError.make({ reason: "transport" }));
          expect((yield* f.journal.stats).pages).toBe(0);
          const listener = yield* fs.exists(f.policy.socketPath);
          assertFalse(listener);
        })
    )
  );
  it.effect(
    "fixed public pins permit inert construction but synthetic source enrollment still refuses before dispatch",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const policy = CoworkLifecyclePolicy.make({
          ...f.policy,
          runtimeSha256: Sha256Hex.make("eb224419e344575faa4a1f39b290b649425a10cd5ee2ef1d003480cd9ae57eb0"),
          appSha256: Sha256Hex.make("ac20c2f43a7ad4cc49320575d6904a3c176e76d5bd4afa5a2a8863fdbd5b3e40"),
        });
        const receiver = yield* makeCoworkLifecycleReceiver(policy).pipe(
          Effect.provideService(CoworkLifecycleRuntime, { journal: f.journal, control: f.control })
        );
        const refused = yield* receiver.open().pipe(Effect.result);
        assertFailure(refused, CoworkLifecycleError.make({ reason: "enrollment" }));
        const wrongApp = yield* makeCoworkLifecycleReceiver(
          CoworkLifecyclePolicy.make({ ...policy, appSha256: id })
        ).pipe(
          Effect.result,
          Effect.provideService(CoworkLifecycleRuntime, { journal: f.journal, control: f.control })
        );
        assertFailure(wrongApp, CoworkLifecycleError.make({ reason: "enrollment" }));
        expect((yield* f.journal.stats).pages).toBe(0);
      })
  );
  for (const fault of ["cwd", "runtime", "app-pid", "app-generation", "startup-timeout", "listen-timeout"]) {
    it.layer(TestClock.layer())((it) =>
      it.effect(
        `synthetic observed Cowork ${fault} mismatch refuses without durable ACK and releases its helper port`,
        () =>
          Effect.gen(function* () {
            const f = yield* fixture();
            const policySeen = yield* Deferred.make<void>();
            let policyFrames = 0;
            let acknowledgements = 0;
            let releases = 0;
            const response = yield* syntheticCoworkOutput(fault, f.policy);
            const output = policySeen.pipe(Deferred.await, Stream.fromEffect, Stream.drain, Stream.concat(response));
            const spawner = ChildProcessSpawner.make((command) =>
              Effect.gen(function* () {
                const input = command._tag === "StandardCommand" ? command.options.stdin : undefined;
                if (!Stream.isStream(input)) return yield* Effect.die("synthetic input stream missing");
                yield* Effect.forkScoped(
                  Stream.runForEach(input, (chunk) => {
                    if (!(chunk instanceof Uint8Array)) return Effect.die("synthetic input chunk invalid");
                    if (Str.includes("receiptId")(new TextDecoder().decode(chunk)))
                      return Effect.sync(() => {
                        acknowledgements++;
                      });
                    return Effect.sync(() => {
                      policyFrames++;
                    }).pipe(Effect.andThen(Deferred.succeed(policySeen, undefined)));
                  })
                );
                return yield* Effect.acquireRelease(
                  Effect.succeed(
                    ChildProcessSpawner.makeHandle({
                      all: output,
                      stdout: output,
                      stderr: Stream.empty,
                      stdin: Sink.drain,
                      exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
                      isRunning: Effect.succeed(false),
                      kill: () => Effect.void,
                      getInputFd: () => Sink.drain,
                      getOutputFd: () => Stream.empty,
                      pid: ChildProcessSpawner.ProcessId(1),
                      unref: Effect.succeed(Effect.void),
                    })
                  ),
                  () =>
                    Effect.sync(() => {
                      releases++;
                    })
                );
              })
            );
            const receiver = yield* makeCoworkLifecycleFixtureReceiver(f.policy).pipe(
              Effect.provideService(CoworkLifecycleRuntime, { journal: f.journal, control: f.control })
            );
            const running = yield* Effect.forkChild(
              receiver.open().pipe(
                Effect.flatMap((opened) => opened.accept),
                Effect.result,
                Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
              )
            );
            yield* Deferred.await(policySeen).pipe(Effect.timeout("5 seconds"), TestClock.withLive);
            if (fault === "startup-timeout") yield* TestClock.adjust("10 seconds");
            if (fault === "listen-timeout") yield* TestClock.adjust("32 seconds");
            const result = yield* Fiber.join(running).pipe(Effect.timeout("5 seconds"), TestClock.withLive);
            assertFailure(
              result,
              CoworkLifecycleError.make({
                reason: fault === "startup-timeout" || fault === "listen-timeout" ? "transport" : "callback",
              })
            );
            expect(policyFrames).toBe(1);
            expect(acknowledgements).toBe(0);
            expect(releases).toBe(1);
            expect((yield* f.journal.stats).pages).toBe(0);
          })
      )
    );
  }
});

it.layer(Layer.mergeAll(NodeCrypto.layer, NodeFileSystem.layer, platformLayer), { memoMap: Layer.makeMemoMapUnsafe() })(
  (it) => {
    it.effect("synthetic ACK server closes an oversized request and refuses an occupied owned socket path", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const server = yield* makeLifecycleAckServer("{}", false);
        const socket = yield* Effect.acquireRelease(
          Effect.sync(() => createConnection({ path: server.path })),
          (owned) =>
            Effect.sync(() => {
              owned.destroy();
            })
        );
        yield* Effect.callback<void>((resume) => {
          socket.once("connect", () => socket.end(Str.repeat(8193)("x")));
          socket.once("error", () => resume(Effect.void));
          socket.once("close", () => resume(Effect.void));
        });
        const received = yield* server.received;
        expect(received.length).toBeLessThanOrEqual(8192);
        const guarded = FileSystem.FileSystem.of({
          ...fs,
          makeTempDirectoryScoped: Effect.fn("CoworkLifecycleTest.occupiedSocketDirectory")((options) =>
            fs
              .makeTempDirectoryScoped(options)
              .pipe(Effect.tap((directory) => fs.writeFileString(`${directory}/s`, "owned-occupied", { mode: 0o600 })))
          ),
        });
        const refused = yield* makeLifecycleAckServer("{}", false).pipe(
          Effect.result,
          Effect.provideService(FileSystem.FileSystem, guarded)
        );
        assertFailure(refused, CoworkLifecycleError.make({ reason: "transport" }));
      })
    );
    it.effect("malformed synthetic application readiness fails finite and releases the owned runtime copy", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const original = yield* ChildProcessSpawner.ChildProcessSpawner;
        let calls = 0;
        let releases = 0;
        let executable = "";
        const trackedFs = FileSystem.FileSystem.of({
          ...fs,
          copyFile: Effect.fn("CoworkLifecycleTest.trackRuntimeCopy")((source, destination) =>
            fs.copyFile(source, destination).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  executable = destination;
                })
              )
            )
          ),
        });
        const output = Stream.make(new TextEncoder().encode("not-json\n"));
        const spawner = ChildProcessSpawner.make((command) => {
          calls++;
          if (calls === 1) return original.spawn(command);
          return Effect.acquireRelease(
            Effect.succeed(
              ChildProcessSpawner.makeHandle({
                all: output,
                stdout: output,
                stderr: Stream.empty,
                stdin: Sink.drain,
                exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
                isRunning: Effect.succeed(false),
                kill: () => Effect.void,
                getInputFd: () => Sink.drain,
                getOutputFd: () => Stream.empty,
                pid: ChildProcessSpawner.ProcessId(1),
                unref: Effect.succeed(Effect.void),
              })
            ),
            () =>
              Effect.sync(() => {
                releases++;
              })
          );
        });
        const result = yield* coworkAncestorFixture.pipe(
          Effect.result,
          Effect.provideService(FileSystem.FileSystem, trackedFs),
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        assertFailure(result, CoworkLifecycleError.make({ reason: "transport" }));
        expect(calls).toBe(2);
        expect(releases).toBe(1);
        expect(executable.length).toBeGreaterThan(0);
        const remains = yield* fs.exists(executable);
        expect(remains).toBe(false);
      })
    );
    it.effect("owned ancestor refuses callback injection and oversized commands before an ACK request", () =>
      Effect.gen(function* () {
        const ancestor = yield* coworkAncestorFixture;
        const server = yield* makeLifecycleAckServer("{}", false);
        for (const body of ["{}\nforged", Str.repeat(4097)("é")]) {
          const result = yield* ancestor.send(server.path, body).pipe(Effect.result);
          assertFailure(result, CoworkLifecycleError.make({ reason: "transport" }));
        }
        const oversized = yield* ancestor
          .runScript(Str.repeat(17000)("x"), server.path, "{}", "local-agent")
          .pipe(Effect.result);
        assertFailure(oversized, CoworkLifecycleError.make({ reason: "transport" }));
        const received = yield* server.received;
        expect(received).toBe("");
        const absent = yield* ancestor.send(`${server.path}-absent`, "{}");
        expect(absent).toBe("\n");
        yield* ancestor.close;
        yield* ancestor.closed;
      })
    );
    for (const kind of ["valid", "malformed", "oversized"]) {
      it.effect(`production Cowork preparation projects metadata and validates ${kind} synthetic ACK`, () =>
        Effect.gen(function* () {
          const good = yield* encode({ receiptId: id, accepted: 1, rejected: 0 });
          const reply = kind === "valid" ? good : kind === "malformed" ? "{malformed" : Str.repeat(1025)("x");
          const server = yield* makeLifecycleAckServer(reply, false);
          const body = yield* encode(start);
          const prepared = yield* prepareCoworkLifecycleFixtureHook(
            server.path,
            body,
            "local-agent",
            "synthetic-ack-occurrence"
          );
          const result = yield* prepared.send.pipe(Effect.result);
          if (kind === "valid") assertSuccess(result, { receiptId: id, accepted: 1, rejected: 0 });
          else assertFailure(result, CoworkLifecycleError.make({ reason: "transport" }));
          const forwarded = yield* server.received;
          for (const marker of [
            "PRIVATE-prompt",
            "PRIVATE-title",
            "/PRIVATE/transcript",
            "forged-root",
            "PRIVATE-secret",
          ])
            expect(Str.includes(marker)(forwarded)).toBe(false);
          expect(Str.includes("synthetic-ack-occurrence")(forwarded)).toBe(true);
          // This server observes transport only; it creates no journal or durable ACK.
        })
      );
    }
    it.effect("production Cowork preparation refuses absent transport and oversized input without admission", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const absent = yield* fs.makeTempDirectoryScoped({ prefix: "missing-cowork-ack-" });
        const body = yield* encode(start);
        const prepared = yield* prepareCoworkLifecycleFixtureHook(
          `${absent}/s`,
          body,
          "local-agent",
          "synthetic-ack-occurrence"
        );
        const failed = yield* prepared.send.pipe(Effect.flip);
        expect(failed.reason).toBe("transport");
        const oversized = yield* prepareCoworkLifecycleFixtureHook(
          `${absent}/s`,
          Str.repeat(8193)("x"),
          "local-agent",
          "synthetic-ack-occurrence"
        ).pipe(Effect.flip);
        expect(oversized.reason).toBe("callback");
      })
    );
    it.effect("owned Cowork application and callback exit before their sealed copy is removed", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const ancestor = yield* coworkAncestorFixture;
        assertTrue(ancestor.appPid !== process.pid && ancestor.peerPid !== ancestor.appPid);
        yield* ancestor.close;
        yield* ancestor.closed;
        const remains = yield* Effect.all({
          app: fs.exists(`/proc/${ancestor.appPid}`),
          peer: fs.exists(`/proc/${ancestor.peerPid}`),
          copy: fs.exists(ancestor.runtime.executable),
        });
        expect(remains).toEqual({ app: false, peer: false, copy: false });
        const source = yield* fs.realPath(process.execPath);
        const sourceStat = yield* fs.stat(source);
        expect(sourceStat.mode).toBe(ancestor.runtime.sourceMode);
      })
    );
    it.effect("interrupting a waiting Cowork callback preserves interruption and closes both owned descendants", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const server = yield* makeLifecycleAckServer("", true);
        const ancestor = yield* coworkAncestorFixture;
        const body = yield* encode({ callback: start });
        const sending = yield* Effect.forkChild(ancestor.send(server.path, body));
        yield* server.awaitRequest;
        yield* Fiber.interrupt(sending);
        const outcome = yield* Fiber.await(sending);
        if (outcome._tag !== "Failure") return yield* Effect.die("unexpected-cowork-peer-success");
        outcome.cause.pipe(Cause.hasInterruptsOnly, assertTrue);
        yield* ancestor.closed;
        const remains = yield* Effect.all({
          app: fs.exists(`/proc/${ancestor.appPid}`),
          peer: fs.exists(`/proc/${ancestor.peerPid}`),
          copy: fs.exists(ancestor.runtime.executable),
        });
        expect(remains).toEqual({ app: false, peer: false, copy: false });
      })
    );
  }
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect(
    "a writable private application/runtime artifact refuses without changing bytes or shared permissions",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const fs = yield* FileSystem.FileSystem;
        const digest = yield* sha(f.ancestor.runtime.executable);
        yield* fs.chmod(f.ancestor.runtime.executable, 0o770);
        const refused = yield* f.deliver(start);
        refused.result.pipe(Result.isFailure, assertTrue);
        expect((yield* f.journal.stats).pages).toBe(0);
        const writableDigest = yield* sha(f.ancestor.runtime.executable);
        expect(writableDigest).toBe(digest);
        yield* fs.chmod(f.ancestor.runtime.executable, 0o500);
        const admitted = yield* f.deliver(start);
        admitted.result.pipe(Result.isSuccess, assertTrue);
        expect((yield* f.journal.stats).pages).toBe(1);
        const sealedDigest = yield* sha(f.ancestor.runtime.executable);
        expect(sealedDigest).toBe(digest);
      })
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("stable Unix paths are bounded and an existing path is preserved without intake", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      assertFalse(isPolicy({ ...f.policy, socketPath: `/${Str.repeat(107)("x")}` }));
      assertFalse(isPolicy({ ...f.policy, socketPath: "/non-ascii-é" }));
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(f.policy.socketPath, "SYNTHETIC-EXISTING-PATH");
      const result = yield* f.deliver(start);
      result.result.pipe(Result.isFailure, assertTrue);
      const retained = yield* fs.readFileString(f.policy.socketPath);
      expect(retained).toBe("SYNTHETIC-EXISTING-PATH");
      expect((yield* f.journal.stats).pages).toBe(0);
    })
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("a group-writable enrolled public source refuses even when its bytes and digest are unchanged", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const pin = yield* Effect.fromOption(A.head(f.policy.sourcePins));
      yield* fs.chmod(pin.path, 0o660);
      const result = yield* f.deliver(start);
      result.result.pipe(Result.isFailure, assertTrue);
      expect((yield* f.journal.stats).pages).toBe(0);
      const socketPresent = yield* fs.exists(f.policy.socketPath);
      assertFalse(socketPresent);
    })
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("a changed enrolled source file refuses before a callback or durable ACK", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const pin = yield* Effect.fromOption(A.head(f.policy.sourcePins));
      yield* fs.writeFileString(pin.path, "// changed synthetic source\n");
      const result = yield* f.deliver(start);
      result.result.pipe(Result.isFailure, assertTrue);
      expect((yield* f.journal.stats).pages).toBe(0);
    })
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("persists positive Cowork metadata before ACK and exports an intake-clock point without content", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const delivered = yield* f.deliver(start);
      const receipt = yield* Effect.fromResult(delivered.result);
      yield* Effect.fromResult(delivered.reply);
      expect(receipt.accepted).toBe(1);
      const stored = yield* f.journal.readNewEvents(receipt.page.receiptId);
      const events = yield* Effect.fromOption(stored);
      const span = yield* Effect.fromOption(A.head(events));
      const event = yield* Effect.fromOption(span.nativeLifecycle);
      expect({ harness: event.harness, surface: event.surface, kind: event.kind }).toEqual({
        harness: "claude-desktop",
        surface: "cowork",
        kind: "sessionStart",
      });
      expect(event.sourceTimestamp).toBe("Unknown");
      if (event.harness !== "claude-desktop") return yield* Effect.die("missing Cowork variant");
      expect(event.appScriptBinding).toBe("Unproved");
      expect(event.callbackScriptBinding).toBe("Unproved");
      expect(event.assurance).toBe("native-hook-kernel-observed-same-uid-nonexclusive");
      expect(span.status).toBe("unset");
      assertNone(span.startTimeUnixNano);
      assertNone(event.reportedModelId);
      const serialized = yield* encode(events);
      for (const poison of ["PRIVATE", "forged-root", "forged-occurrence", "transcript_path", "session_title"])
        expect(Str.includes(poison)(serialized)).toBe(false);
      const exported = yield* encodeNativeTraceBatch(
        NativeExportInput.make({
          hostId: id,
          namespaceId: f.namespaceId,
          project: "harness-otel",
          acceptedAtMillis: receipt.page.acceptedAt,
          spans: events,
        })
      );
      const wire = nativeTraceWire.toObject(nativeTraceWire.decode(exported.body), { longs: String });
      const text = yield* encode(wire);
      expect(Str.includes("claude.cowork.sessionStart")(text)).toBe(true);
      expect(Str.includes("llm.token_count")(text)).toBe(false);
      expect(Str.includes("PRIVATE")(text)).toBe(false);
    })
  )
);
it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("lost ACK retains the committed occurrence and permits only identical transport readback", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const receiver = yield* makeCoworkLifecycleFixtureReceiver(f.policy).pipe(
        Effect.provideService(CoworkLifecycleRuntime, { journal: f.journal, control: f.control })
      );
      const opened = yield* receiver.open();
      const body = yield* encode({
        occurrenceId: "synthetic-occurrence-0001",
        selector: "local-agent",
        callback: start,
      });
      yield* f.ancestor.send(opened.socketPath, body, true);
      const uncertain = yield* opened.accept.pipe(Effect.result);
      uncertain.pipe(Result.isFailure, assertTrue);
      expect((yield* f.journal.stats).pages).toBe(1);
      const retry = yield* f.deliver(start);
      retry.reply.pipe(Result.isSuccess, assertTrue);
      expect((yield* f.journal.stats).pages).toBe(1);
    })
  )
);
it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("journal capacity refusal and callback projection failure clean the exact owned stable socket", () =>
    Effect.gen(function* () {
      const f = yield* fixture(1);
      const fs = yield* FileSystem.FileSystem;
      const first = yield* f.deliver(start);
      first.result.pipe(Result.isSuccess, assertTrue);
      const afterSuccess = yield* fs.exists(f.policy.socketPath);
      assertFalse(afterSuccess);
      const full = yield* f.deliver(start, f.policy, "synthetic-occurrence-full");
      full.result.pipe(Result.isFailure, assertTrue);
      full.reply.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(full.result)) expect(full.result.failure.reason).toBe("transport");
      const afterRefusal = yield* fs.exists(f.policy.socketPath);
      assertFalse(afterRefusal);
      const receiver = yield* makeCoworkLifecycleFixtureReceiver(f.policy).pipe(
        Effect.provideService(CoworkLifecycleRuntime, { journal: f.journal, control: f.control })
      );
      const opened = yield* receiver.open();
      const invalidBody = yield* encode({
        occurrenceId: "synthetic-occurrence-invalid",
        selector: "local-agent",
        callback: { ...start, source: "unsupported" },
      });
      const sending = yield* Effect.forkChild(f.ancestor.send(opened.socketPath, invalidBody));
      const invalid = yield* opened.accept.pipe(Effect.result);
      yield* Fiber.join(sending);
      invalid.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(invalid)) expect(invalid.failure.reason).toBe("callback");
      const afterProjection = yield* fs.exists(f.policy.socketPath);
      assertFalse(afterProjection);
      expect((yield* f.journal.stats).pages).toBe(1);
    })
  )
);
for (const capacityRefusal of [false, true]) {
  it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
    timeout: "45 seconds",
  })((it) =>
    it.effect(`a foreign replacement survives ${capacityRefusal ? "refused" : "successful"} journal finalization`, () =>
      Effect.gen(function* () {
        const f = yield* fixture(capacityRefusal ? 1 : 32);
        const fs = yield* FileSystem.FileSystem;
        if (capacityRefusal) yield* f.deliver(start);
        const journal: typeof f.journal = {
          ...f.journal,
          acceptBatch: Effect.fnUntraced(function* (batch: NativeTraceBatch) {
            yield* fs.remove(f.policy.socketPath).pipe(Effect.orDie);
            yield* fs.writeFileString(f.policy.socketPath, "SYNTHETIC-FOREIGN-REPLACEMENT").pipe(Effect.orDie);
            return yield* f.journal.acceptBatch(batch);
          }),
        };
        const deliver = makeDelivery(f.policy, journal, f.control, f.ancestor);
        const delivered = yield* deliver(start, f.policy, "synthetic-occurrence-replaced");
        deepStrictEqual(Result.isFailure(delivered.result), capacityRefusal);
        const retained = yield* fs.readFileString(f.policy.socketPath);
        expect(retained).toBe("SYNTHETIC-FOREIGN-REPLACEMENT");
      })
    )
  );
}
it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("a public source replacement between verified FD hashing and path capture refuses before listening", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const source = yield* Effect.fromOption(A.head(f.policy.sourcePins));
      const target = source.path;
      const replacement = `${target}.replacement`;
      yield* fs.writeFileString(replacement, "// different owned public fixture\n", { mode: 0o600 });
      const body = yield* encode({
        source: coworkPeerSource,
        target,
        replacement,
        socketPath: f.policy.socketPath,
        policy: {
          workspace: f.policy.workspace,
          listenMillis: f.policy.listenMillis,
          sourcePins: f.policy.sourcePins,
          runtimeExecutable: f.policy.runtimeExecutable,
          runtimeSha256: f.policy.runtimeSha256,
          appExecutable: f.policy.appExecutable,
          appSha256: f.policy.appSha256,
        },
      });
      const child = yield* ChildProcess.make(f.policy.pythonExecutable, ["-I", "-B", "-c", sourceRaceHarness], {
        extendEnv: false,
        stdin: Stream.make(new TextEncoder().encode(body)),
        stderr: "ignore",
      });
      const output = yield* child.stdout.pipe(Stream.decodeText(), Stream.mkString, Effect.timeout("3 seconds"));
      const exitCode = yield* child.exitCode;
      expect(exitCode).toBe(0);
      expect(output).toBe("refused-before-listen\n");
      const present = yield* fs.exists(f.policy.socketPath);
      assertFalse(present);
    })
  )
);
it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("pause and unsupported surfaces cannot admit a Cowork event", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      assertFalse(isPolicy({ ...f.policy, executionHost: "vm" }));
      assertFalse(isPolicy({ ...f.policy, executionHost: "cloud" }));
      assertFalse(isPolicy({ ...f.policy, surface: "code" }));
      yield* f.control.pause;
      const result = yield* f.deliver(start);
      result.reply.pipe(Result.isFailure, assertTrue);
      expect((yield* f.journal.stats).pages).toBe(0);
    })
  )
);
it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("deduplicates an occurrence but preserves a second resume of the same session", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const a = yield* f.deliver(start);
      const first = yield* Effect.fromResult(a.result);
      const b = yield* f.deliver(start);
      const duplicate = yield* Effect.fromResult(b.result);
      expect(duplicate.page.receiptId).toBe(first.page.receiptId);
      const c = yield* f.deliver(start, f.policy, "synthetic-occurrence-0002");
      const second = yield* Effect.fromResult(c.result);
      expect(second.newEvents).toBe(1);
      expect(second.page.receiptId === first.page.receiptId).toBe(false);
    })
  )
);
it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("conflicting event content cannot reuse an occurrence ID", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.deliver(start);
      const changed = yield* f.deliver({
        hook_event_name: "SessionEnd",
        session_id: start.session_id,
        reason: "other",
      });
      const receipt = yield* Effect.fromResult(changed.result);
      expect(receipt.accepted).toBe(0);
      expect(receipt.rejected).toBe(1);
    })
  )
);
for (const reason of ["clear", "resume", "logout", "prompt_input_exit", "other"]) {
  it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
    timeout: "45 seconds",
  })((it) =>
    it.effect(`records native SessionEnd ${reason} without inference or success claims`, () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const delivered = yield* f.deliver({ hook_event_name: "SessionEnd", session_id: "native-end", reason });
        const receipt = yield* Effect.fromResult(delivered.result);
        yield* Effect.fromResult(delivered.reply);
        expect(receipt.accepted).toBe(1);
      })
    )
  );
}
for (const field of ["appPid", "appStartTicks", "runtimeSha256", "workspace"] as const) {
  it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
    timeout: "45 seconds",
  })((it) =>
    it.effect(`receiver-owned ${field} mismatch refuses without durable intake`, () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const override = CoworkLifecyclePolicy.make({
          ...f.policy,
          ...(field === "appPid"
            ? { appPid: process.pid + 100000 }
            : field === "appStartTicks"
              ? { appStartTicks: "0" }
              : field === "runtimeSha256"
                ? { runtimeSha256: Sha256Hex.make(Str.repeat(64)("b")) }
                : { workspace: "/tmp" }),
        });
        const delivered = yield* f.deliver(start, override);
        delivered.result.pipe(Result.isFailure, assertTrue);
      })
    )
  );
}
it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("production source contract refuses synthetic interpreter/source enrollment", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const result = yield* makeCoworkLifecycleReceiver(f.policy).pipe(
        Effect.provideService(CoworkLifecycleRuntime, { journal: f.journal, control: f.control }),
        Effect.result
      );
      result.pipe(Result.isFailure, assertTrue);
    })
  )
);
for (const selector of [undefined, "cli", "desktop", "forged"]) {
  it.effect(`own-source selector ${selector ?? "absent"} refuses before transport despite callback claims`, () =>
    Effect.gen(function* () {
      const body = yield* encode({ ...start, selector: "local-agent", surface: "cowork" });
      const result = yield* prepareCoworkLifecycleFixtureHook(
        "/tmp/unused-cowork-socket",
        body,
        selector,
        "synthetic-occurrence-0001"
      ).pipe(Effect.result);
      result.pipe(Result.isFailure, assertTrue);
    })
  );
}
for (const invalid of [
  { ...start, hook_event_name: "Stop" },
  { ...start, source: "unknown" },
  { ...start, reason: "other" },
  { hook_event_name: "SessionEnd", session_id: "x" },
  { ...start, session_id: "" },
  { ...start, session_id: Str.repeat(257)("x") },
  { ...start, prompt: Str.repeat(8193)("x") },
]) {
  it.effect(`rejects malformed or oversized lifecycle ${invalid.hook_event_name} before transport`, () =>
    Effect.gen(function* () {
      const body = yield* encode(invalid);
      const result = yield* prepareCoworkLifecycleFixtureHook(
        "/tmp/unused-cowork-socket",
        body,
        "local-agent",
        "synthetic-occurrence-0001"
      ).pipe(Effect.result);
      result.pipe(Result.isFailure, assertTrue);
    })
  );
}

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect(
    "the actual standalone plugin helper checks its own selector and forwards only positive metadata silently",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const receiver = yield* makeCoworkLifecycleFixtureReceiver(f.policy).pipe(
          Effect.provideService(CoworkLifecycleRuntime, { journal: f.journal, control: f.control })
        );
        const opened = yield* receiver.open();
        const files = yield* renderCoworkLifecyclePlugin(
          CoworkLifecyclePluginRequest.make({ socketPath: opened.socketPath, interpreter: f.policy.runtimeExecutable })
        );
        const names = R.keys(files);
        const ordered = A.sort(names, Order.String);
        expect(ordered).toEqual([".claude-plugin/plugin.json", "hooks/hooks.json", "scripts/observe-lifecycle.mjs"]);
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "cowork-plugin-fixture-" });
        const script = `${directory}/observe-lifecycle.mjs`;
        yield* fs.writeFileString(script, files["scripts/observe-lifecycle.mjs"]);
        const body = yield* encode(start);
        const captured = yield* Effect.all(
          {
            receipt: opened.accept,
            child: f.ancestor.runScript(script, opened.socketPath, body, "local-agent"),
          },
          { concurrency: "unbounded" }
        );
        expect(captured.child.code).toBe(0);
        expect(captured.child.stdout).toBe("");
        expect(captured.child.stderr).toBe("");
        expect(captured.receipt.accepted).toBe(1);
        const stored = yield* f.journal.readNewEvents(captured.receipt.page.receiptId);
        const serialized = yield* encode(stored);
        expect(Str.includes("PRIVATE")(serialized)).toBe(false);
      })
  )
);
for (const selector of ["cli", "local-agent"]) {
  it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
    timeout: "10 seconds",
  })((it) =>
    it.effect(`standalone helper ${selector} is silent and finite even with nonterminating stdin`, () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const files = yield* renderCoworkLifecyclePlugin(
          CoworkLifecyclePluginRequest.make({
            socketPath: "/tmp/unused-cowork-socket",
            interpreter: f.policy.runtimeExecutable,
          })
        );
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "cowork-plugin-timeout-" });
        const script = `${directory}/hook.mjs`;
        yield* fs.writeFileString(script, files["scripts/observe-lifecycle.mjs"]);
        const child = yield* ChildProcess.make(f.policy.runtimeExecutable, [script, "/tmp/unused-cowork-socket"], {
          extendEnv: false,
          env: { CLAUDE_CODE_ENTRYPOINT: selector },
          stdin: Stream.never,
        });
        const captured = yield* Effect.all(
          {
            code: child.exitCode,
            stdout: child.stdout.pipe(Stream.runCollect),
            stderr: child.stderr.pipe(Stream.runCollect),
          },
          { concurrency: "unbounded" }
        );
        expect(Number(captured.code)).toBe(0);
        expect(captured.stdout).toHaveLength(0);
        expect(captured.stderr).toHaveLength(0);
        expect((yield* f.journal.stats).pages).toBe(0);
      })
    )
  );
}
// Runs the real helper's guarded serve() with a stand-in that fails after binding, and signals the
// helper on the os.lstat call inside its socket cleanup. The parent closes stdin just before SIGTERM,
// so a real helper can already be in that cleanup when the signal lands.
const cleanupSignalHarness = `import ast, json, os, signal, socket, sys
config = json.load(sys.stdin)
tree = ast.parse(config["source"])
guarded = [node for node in tree.body if isinstance(node, ast.Try)]
tree.body = [node for node in tree.body if not isinstance(node, ast.Try)]
exec(compile(tree, "owned-public-helper-fixture", "exec"))
def serve():
    global active_socket
    server = socket.socket(socket.AF_UNIX)
    server.bind(config["socketPath"])
    active_socket = (config["socketPath"], identity(os.lstat(config["socketPath"])))
    real_lstat = os.lstat
    def signalled_lstat(path):
        os.lstat = real_lstat
        os.kill(os.getpid(), signal.SIGTERM)
        return real_lstat(path)
    os.lstat = signalled_lstat
    raise ValueError("kernel-binding")
tree.body = guarded
exec(compile(tree, "owned-public-helper-fixture", "exec"))
`;
it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeFileSystem.layer, platformLayer), {
  timeout: "45 seconds",
})((it) =>
  it.effect("a SIGTERM landing during socket cleanup still removes the owned listener", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const body = yield* encode({ source: coworkPeerSource, socketPath: f.policy.socketPath });
      const child = yield* ChildProcess.make(f.policy.pythonExecutable, ["-I", "-B", "-c", cleanupSignalHarness], {
        extendEnv: false,
        stdin: Stream.make(new TextEncoder().encode(body)),
        stderr: "ignore",
      });
      const exitCode = yield* child.exitCode;
      expect(exitCode).toBe(2);
      const present = yield* fs.exists(f.policy.socketPath);
      assertFalse(present);
    })
  )
);
