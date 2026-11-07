import { createServer } from "node:net";
import { fcRuns } from "@beep/fc-runs";
import {
  CursorLifecycleError,
  CursorLifecyclePolicy,
  CursorLifecycleRuntime,
  forwardCursorLifecycleHook,
  makeCursorLifecycleReceiver,
  projectCursorLifecycleHookInput,
} from "@beep/repo-ai-metrics/cursor-lifecycle";
import { encodeNativeTraceBatch, NativeExportInput } from "@beep/repo-ai-metrics/native-export";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { makeObservationControl, ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import {
  cursorLifecycleFixtureCodecs,
  cursorPeerSource,
  hashObservationPayload,
  makeCursorLifecycleFixtureReceiver,
  nativeTraceWire,
} from "@beep/repo-ai-metrics/test/cursor-lifecycle";
import { cursorPeerDiagnosticBootstrap } from "@beep/repo-ai-metrics/test/cursor-peer-diagnostic";
import { makeSealedRuntimeFixture, observeFixtureProcessStopped } from "@beep/repo-ai-metrics/test/sealed-runtime";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect } from "@effect/vitest";
import { assertFailure, assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as References from "effect/References";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import type { Socket } from "node:net";

const json = S.fromJsonString(S.Unknown);
const encode = S.encodeUnknownEffect(json);
const decodeWire = S.decodeUnknownEffect(
  S.Struct({
    resourceSpans: S.Array(
      S.Struct({
        scopeSpans: S.Array(
          S.Struct({
            spans: S.Array(
              S.Struct({
                name: S.String,
                startTimeUnixNano: S.String,
                endTimeUnixNano: S.String,
                attributes: S.Array(S.Struct({ key: S.String, value: S.Unknown })),
              })
            ),
          })
        ),
      })
    ),
  })
);
const diagnosticGuard = S.String.check(
  S.isPattern(
    /^(?:(?:source|runtime|unknown)\.)?(?:bounded_json|public_digest|process|observe|serve)\.(?:enter|i\d+|r\d+|b\d+\.\d+)$/
  )
);
const diagnosticReport = S.Struct({
  diagnostic: S.tag("cursor-peer-diagnostic/v1"),
  ok: S.Boolean,
  phase: S.Literals(["bootstrap", "bounded_json", "public_digest", "process", "observe", "serve", "complete"]),
  predicate: S.String.check(
    S.isPattern(
      /^(?:bootstrap|(?:(?:source|runtime|unknown)\.)?(?:bounded_json|public_digest|process|observe|serve)\.(?:enter|i\d+|r\d+|b\d+\.\d+))$/
    )
  ),
  exceptionClass: S.Literals([
    "None",
    "ValueError",
    "PermissionError",
    "FileNotFoundError",
    "ProcessLookupError",
    "TimeoutError",
    "OSError",
    "JSONDecodeError",
    "UnicodeDecodeError",
    "AttributeError",
    "KeyError",
    "StopIteration",
    "ConnectionResetError",
    "BrokenPipeError",
    "Unknown",
  ]),
  sourceHashMatches: S.Boolean,
  predicateAstPreserved: S.Boolean,
  shortCircuitOrderPreserved: S.Boolean,
  projectedPrintSuppressed: S.Boolean,
  checks: S.Record(diagnosticGuard, S.Struct({ observedTrue: S.Boolean, observedFalse: S.Boolean })),
});
const diagnosticReady = S.Struct({ ready: S.tag(true) });
const isDiagnosticReady = S.is(diagnosticReady);
const decodeDiagnosticLine = S.decodeEffect(S.fromJsonString(S.Union([diagnosticReady, diagnosticReport])), {
  onExcessProperty: "error",
});
const decodeDiagnosticReport = S.decodeUnknownEffect(diagnosticReport, { onExcessProperty: "error" });
const encodeDiagnosticError = S.encodeEffect(S.fromJsonString(CursorLifecycleError));
const diagnosticObservation = S.Struct({
  listenerReady: S.Boolean,
  diagnosticAckObserved: S.Boolean,
  helperExitZero: S.Boolean,
  report: diagnosticReport,
});
const diagnosticEvidence = S.Struct({
  ...diagnosticObservation.fields,
  evidence: S.Literals(["synthetic-diagnostic-occurrence-not-retrodiagnosis", "synthetic-regression-fixture"]),
  testProcessReportsBun: S.Boolean,
  testProcessReportsNode22: S.Boolean,
});
const encodeDiagnosticEvidence = S.encodeEffect(S.fromJsonString(diagnosticEvidence));
const decodeDiagnosticEvidence = S.decodeEffect(S.fromJsonString(diagnosticEvidence), { onExcessProperty: "error" });
const equivalentDiagnosticEvidence = S.toEquivalence(diagnosticEvidence);
const decodeAssertionMessage = S.decodeUnknownOption(S.Struct({ message: S.String }));
const diagnosticContext = Effect.fnUntraced(function* (
  observed: typeof diagnosticObservation.Type,
  evidence: typeof diagnosticEvidence.Type.evidence = "synthetic-diagnostic-occurrence-not-retrodiagnosis"
) {
  const encoded = yield* encodeDiagnosticEvidence({
    ...observed,
    evidence,
    testProcessReportsBun: O.isSome(O.fromUndefinedOr(process.versions.bun)),
    testProcessReportsNode22: Str.startsWith("22.")(process.versions.node),
  });
  return `[cursor-peer-diagnostic] ${encoded}`;
});

const inspectSyntheticPeer = Effect.fn("CursorLifecycleTest.inspectSyntheticPeer")(
  function* (policy: CursorLifecyclePolicy, runtime: Effect.Success<ReturnType<typeof makeSealedRuntimeFixture>>) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "cursor-lifecycle-" });
    const socketPath = `${directory}/s`;
    const header = yield* encode({ source: cursorPeerSource, sha256: policy.helperSha256 });
    const publicPolicy = yield* encode({
      workspace: policy.workspace,
      runtimeExecutable: policy.runtimeExecutable,
      runtimeSha256: policy.runtimeSha256,
      sourcePins: policy.sourcePins,
    });
    const stdin = new TextEncoder().encode(`${header}\n${publicPolicy}\n{}\n`);
    const child = yield* ChildProcess.make(
      policy.pythonExecutable,
      ["-I", "-B", "-c", cursorPeerDiagnosticBootstrap, socketPath],
      { extendEnv: false, stdin: Stream.make(stdin), stderr: "ignore", killSignal: "SIGKILL" }
    );
    let output = "";
    let outputBytes = 0;
    const next = yield* child.stdout.pipe(
      Stream.mapEffect((chunk) => {
        outputBytes += chunk.byteLength;
        if (outputBytes > 16384) return Effect.fail("diagnostic-bounds");
        output += new TextDecoder().decode(chunk);
        return Effect.succeed(chunk);
      }),
      Stream.decodeText(),
      Stream.splitLines,
      Stream.rechunk(1),
      Stream.toPull
    );
    const first = yield* next;
    const firstValue = yield* decodeDiagnosticLine(first[0]).pipe(Effect.mapError(() => "diagnostic-envelope"));
    const listenerReady = isDiagnosticReady(firstValue);
    let diagnosticAckObserved = false;
    let reportValue: unknown = firstValue;
    if (listenerReady) {
      const body = yield* encode(start);
      const sending = yield* Effect.forkChild(
        runtime.send(socketPath, body, false).pipe(
          Effect.flatMap((reply) => (reply === "{}\n" ? Effect.void : Effect.fail("diagnostic-socket"))),
          Effect.timeoutOrElse({ duration: "6 seconds", orElse: () => Effect.fail("diagnostic-socket") }),
          Effect.result
        )
      );
      const final = yield* next;
      reportValue = yield* decodeDiagnosticLine(final[0]).pipe(Effect.mapError(() => "diagnostic-envelope"));
      const acknowledged = yield* Fiber.join(sending);
      diagnosticAckObserved = Result.isSuccess(acknowledged);
    }
    const report = yield* decodeDiagnosticReport(reportValue).pipe(Effect.mapError(() => "diagnostic-envelope"));
    const exit = yield* child.exitCode;
    for (const marker of [
      policy.workspace,
      policy.runtimeExecutable,
      "PRIVATE-PROMPT",
      "private@example",
      "native-session",
      "forged-root",
    ])
      expect(Str.includes(marker)(output)).toBe(false);
    return { listenerReady, diagnosticAckObserved, helperExitZero: exit === 0, report };
  },
  Effect.mapError(() => CursorLifecycleError.make({ reason: "transport" }))
);
const salt = "synthetic-cursor-passive-salt";
const id = Sha256Hex.make(Str.repeat(64)("a"));
const sql = makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver });
const platformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.merge(NodeFileSystem.layer, NodePath.layer))
);
const syntheticHandle = (output: Stream.Stream<Uint8Array>, input: Sink.Sink<void, Uint8Array>, running: boolean) =>
  ChildProcessSpawner.makeHandle({
    all: output,
    stdout: output,
    stderr: Stream.empty,
    stdin: input,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(running),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });
const sha = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(path);
  return yield* hashObservationPayload(bytes);
});
const start = {
  hook_event_name: "sessionStart",
  cursor_version: "2026.11.05-86047df",
  session_id: "native-session",
  conversation_id: "native-session",
  generation_id: "native-generation",
  is_background_agent: false,
  model: "grok-4.7",
  model_params: [{ id: "effort", value: "medium" }],
  user_email: "private@example.test",
  transcript_path: "/private/transcript",
  prompt: "PRIVATE-PROMPT",
  agent_message: "PRIVATE-MESSAGE",
  callerVerified: true,
  rootId: "forged-root",
  sourceTimestamp: "2026-01-01",
};

const fixture = Effect.fn("CursorLifecycleTest.fixture")(function* (maxPages = 32) {
  yield* TestClock.adjust("1 second");
  const fs = yield* FileSystem.FileSystem;
  const runtime = yield* makeSealedRuntimeFixture();
  const runtimeExecutable = runtime.executable;
  const pythonExecutable = yield* fs.realPath("/usr/bin/python3");
  const namespaceId = yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt));
  const sourceRoot = yield* fs.makeTempDirectoryScoped({ prefix: "cursor-source-fixture-" });
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
  const policy = CursorLifecyclePolicy.make({
    workspace: process.cwd(),
    runtimeExecutable,
    runtimeSha256: runtime.sha256,
    pythonExecutable,
    pythonSha256: yield* sha(pythonExecutable),
    helperSha256: yield* hashObservationPayload(new TextEncoder().encode(cursorPeerSource)),
    rootId: id,
    hostId: id,
    routeId: id,
    hashSalt: Redacted.make(salt),
    approvedModels: ["grok-4.7"],
    sourcePins,
  });
  const journal = yield* makeNativeIntakeJournal(
    TranscriptIntakeConfig.make({ hostId: id, namespaceId, maxPages, maxPayloadBytes: 1048576, maxDatabasePages: 256 })
  );
  const control = yield* makeObservationControl(
    ObservationControlPolicy.make({ maxActive: 1, drainTimeoutMillis: 1000 })
  );
  yield* control.resume;
  const deliver = Effect.fn("CursorLifecycleTest.deliver")(function* (body: unknown, override = policy) {
    const receiver = yield* makeCursorLifecycleFixtureReceiver(override).pipe(
      Effect.provideService(CursorLifecycleRuntime, { journal, control })
    );
    const opened = yield* receiver.open().pipe(Effect.result);
    if (Result.isFailure(opened)) return { result: Result.fail(opened.failure), reply: Result.fail(opened.failure) };
    const encoded = yield* encode(body);
    const sending = yield* Effect.forkChild(
      runtime.send(opened.success.socketPath, encoded, false).pipe(
        Effect.flatMap(cursorLifecycleFixtureCodecs.decodeAcknowledgement),
        Effect.mapError(() => CursorLifecycleError.make({ reason: "transport" })),
        Effect.result
      )
    );
    const result = yield* opened.success.accept.pipe(Effect.result);
    const reply = yield* Fiber.join(sending);
    return { result, reply };
  });
  return { policy, journal, control, namespaceId, deliver, runtime };
});

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) => {
  for (const fault of ["canonical", "owner", "writable", "size", "digest", "changed", "growth"]) {
    it.effect(`interpreter ${fault} enrollment refuses before helper dispatch and durable admission`, () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const fs = yield* FileSystem.FileSystem;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        let dispatches = 0;
        let opened = 0;
        let released = 0;
        const guarded = FileSystem.FileSystem.of({
          ...fs,
          realPath: (path) =>
            path === f.policy.pythonExecutable && fault === "canonical"
              ? Effect.succeed(`${path}-different-canonical-target`)
              : fs.realPath(path),
          open: (path, options) =>
            fs.open(path, options).pipe(
              Effect.flatMap((file) => {
                if (path !== f.policy.pythonExecutable) return Effect.succeed(file);
                return Effect.acquireRelease(
                  Effect.sync(() => {
                    opened++;
                    return file;
                  }),
                  () =>
                    Effect.sync(() => {
                      released++;
                    })
                ).pipe(
                  Effect.map((handle) => {
                    let stats = 0;
                    return {
                      ...handle,
                      stat: handle.stat.pipe(
                        Effect.map((stat) => {
                          stats++;
                          if (fault === "owner") return { ...stat, uid: O.some(123456) };
                          if (fault === "writable") return { ...stat, mode: stat.mode | 0o020 };
                          if (fault === "size") return { ...stat, size: ByteSize.bytes(33554433) };
                          if (fault === "changed" && stats > 1) return { ...stat, ino: O.none() };
                          return stat;
                        })
                      ),
                      readAlloc:
                        fault === "growth" ? () => Effect.succeed(O.some(new Uint8Array(65536))) : handle.readAlloc,
                    };
                  })
                );
              })
            ),
        });
        const policy = fault === "digest" ? CursorLifecyclePolicy.make({ ...f.policy, pythonSha256: id }) : f.policy;
        const result = yield* f.deliver(start, policy).pipe(
          Effect.provideService(FileSystem.FileSystem, guarded),
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, {
            ...spawner,
            spawn: (...args) => {
              dispatches++;
              return spawner.spawn(...args);
            },
          })
        );
        assertFailure(result.result, CursorLifecycleError.make({ reason: "enrollment" }));
        expect(dispatches).toBe(0);
        expect(opened).toBe(fault === "canonical" ? 0 : 1);
        expect(released).toBe(opened);
        expect((yield* f.journal.stats).pages).toBe(0);
      })
    );
  }
  for (const fault of ["ready", "observed", "cwd", "digest", "overflow", "timeout"]) {
    it.effect(`synthetic helper ${fault} output fails closed and finalizes without ACK or journal admission`, () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const started = yield* Deferred.make<void>();
        let released = 0;
        let dispatches = 0;
        let acknowledgements = 0;
        const ready = yield* encode({ ready: fault === "ready" ? false : true });
        const observed = yield* encode({
          peer: {
            peerPid: 1,
            peerStartTicks: "1",
            runtimePid: 1,
            runtimeStartTicks: "1",
            runtimeSha256: fault === "digest" ? id : f.policy.runtimeSha256,
            cwd: fault === "cwd" ? "/synthetic-wrong-root" : f.policy.workspace,
            uid: 1000,
          },
          callback: start,
        });
        const lines =
          fault === "overflow" ? Str.repeat(16385)("x") : `${ready}\n${fault === "observed" ? "{}" : observed}\n`;
        const output =
          fault === "timeout"
            ? Stream.concat(Stream.make(new TextEncoder().encode(`${ready}\n`)), Stream.never)
            : Stream.make(new TextEncoder().encode(lines));
        const synthetic = ChildProcessSpawner.make(() =>
          Effect.acquireRelease(
            Effect.sync(() => {
              dispatches++;
              return syntheticHandle(
                output,
                Sink.forEach((chunk: Uint8Array) =>
                  Effect.sync(() => {
                    if (Str.includes("receiptId")(new TextDecoder().decode(chunk))) acknowledgements++;
                  })
                ),
                false
              );
            }).pipe(Effect.tap(() => Deferred.succeed(started, undefined))),
            () =>
              Effect.sync(() => {
                released++;
              })
          )
        );
        const receiver = yield* makeCursorLifecycleFixtureReceiver(f.policy).pipe(
          Effect.provideService(CursorLifecycleRuntime, { journal: f.journal, control: f.control })
        );
        const running = yield* Effect.forkChild(
          receiver.open().pipe(
            Effect.flatMap((opened) => opened.accept),
            Effect.result,
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, synthetic)
          )
        );
        yield* Deferred.await(started);
        if (fault === "timeout") yield* TestClock.adjust("10 seconds");
        const result = yield* Fiber.join(running);
        assertFailure(
          result,
          CursorLifecycleError.make({
            reason: fault === "observed" ? "callback" : fault === "timeout" ? "transport" : "kernel-binding",
          })
        );
        expect(dispatches).toBe(1);
        expect(released).toBe(1);
        expect(acknowledgements).toBe(0);
        expect((yield* f.journal.stats).pages).toBe(0);
      })
    );
  }
  it.effect("a native session without generation or effort retains Unknown fields and stable replay identity", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const callback = {
        hook_event_name: "sessionStart",
        cursor_version: start.cursor_version,
        session_id: "native-missing-generation",
        conversation_id: "native-missing-generation",
        is_background_agent: false,
      };
      const first = yield* f.deliver(callback);
      if (Result.isFailure(first.result)) return yield* Effect.fail(first.result.failure);
      const events = yield* f.journal.readNewEvents(first.result.success.page.receiptId);
      if (O.isNone(events) || events.value[0] === undefined) return yield* Effect.die("missing lifecycle observation");
      const lifecycle = yield* Effect.fromOption(events.value[0].nativeLifecycle);
      assertNone(lifecycle.generationHash);
      assertNone(lifecycle.reportedEffort);
      const expectedId = yield* hashPrivateIdentifier(
        `cursor-lifecycle/v1:${lifecycle.runtimeInstanceId}:${lifecycle.sessionHash}:Unknown:sessionStart`,
        O.some(salt)
      );
      expect(events.value[0].eventId).toBe(expectedId);
      yield* TestClock.adjust("1 second");
      const replay = yield* f.deliver(callback);
      if (Result.isFailure(replay.result)) return yield* Effect.fail(replay.result.failure);
      expect(replay.result.success).toEqual(first.result.success);
      expect(yield* f.journal.readNewEvents(first.result.success.page.receiptId)).toEqual(events);
    })
  );
});

const ackServer = Effect.fn("CursorLifecycleTest.syntheticAckServer")(function* (reply: string, hold: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "ack-contract-" });
  yield* fs.chmod(directory, 0o700);
  const canonical = yield* fs.realPath(directory);
  const path = `${canonical}/s`;
  const seen = yield* Deferred.make<void>();
  let received = "";
  let receivedBytes = 0;
  let sockets: ReadonlyArray<Socket> = [];
  const server = yield* Effect.acquireRelease(
    Effect.sync(() =>
      createServer({ allowHalfOpen: true }, (socket) => {
        sockets = A.append(sockets, socket);
        socket.on("data", (chunk: Uint8Array) => {
          receivedBytes += chunk.byteLength;
          if (receivedBytes > 8192) socket.destroy();
          else received += new TextDecoder().decode(chunk);
        });
        socket.once("end", () => {
          Deferred.doneUnsafe(seen, Effect.void);
          if (!hold) socket.end(reply);
        });
        socket.once("error", () => socket.destroy());
      })
    ),
    (server) =>
      Effect.callback<void>((resume) => {
        A.forEach(sockets, (socket) => socket.destroy());
        server.close(() => resume(Effect.void));
      })
  );
  yield* Effect.callback<void, CursorLifecycleError>((resume) => {
    server.once("error", () => resume(Effect.fail(CursorLifecycleError.make({ reason: "transport" }))));
    server.listen(path, () => resume(Effect.void));
  });
  return { path, received: Effect.sync(() => received), awaitRequest: Deferred.await(seen) };
});

it.layer(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer), { memoMap: Layer.makeMemoMapUnsafe() })((it) => {
  it.effect("standalone projection refuses an oversized callback before any transport exists", () =>
    Effect.gen(function* () {
      const result = yield* projectCursorLifecycleHookInput(Str.repeat(8193)("x")).pipe(Effect.result);
      assertFailure(result, CursorLifecycleError.make({ reason: "callback" }));
    })
  );
  it.effect("a silent ACK peer times out and releases the production forwarder socket", () =>
    Effect.gen(function* () {
      const server = yield* ackServer("", true);
      const body = yield* encode(start);
      const sending = yield* Effect.forkChild(forwardCursorLifecycleHook(server.path, body).pipe(Effect.result));
      yield* server.awaitRequest;
      yield* TestClock.adjust("5 seconds");
      const result = yield* Fiber.join(sending);
      assertFailure(result, CursorLifecycleError.make({ reason: "transport" }));
      expect((yield* server.received).length).toBeGreaterThan(0);
    })
  );
  for (const kind of ["valid", "malformed", "oversized"]) {
    it.effect(`production forwarder projects input and validates ${kind} synthetic ACK without durability claims`, () =>
      Effect.gen(function* () {
        const body = yield* encode(start);
        const good = yield* encode({ receiptId: id, accepted: 1, rejected: 0 });
        const reply = kind === "valid" ? good : kind === "malformed" ? "{malformed" : Str.repeat(1025)("x");
        const server = yield* ackServer(reply, false);
        const result = yield* forwardCursorLifecycleHook(server.path, body).pipe(Effect.result);
        const projected = yield* server.received;
        for (const marker of ["PRIVATE-", "private@example", "/private", "callerVerified", "forged-root"])
          expect(Str.includes(marker)(projected)).toBe(false);
        if (kind === "valid") assertSuccess(result, { receiptId: id, accepted: 1, rejected: 0 });
        else assertFailure(result, CursorLifecycleError.make({ reason: "transport" }));
      })
    );
  }
  it.effect("production forwarder reports connection failure and refuses oversized input before transport", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const absent = yield* fs.makeTempDirectoryScoped({ prefix: "missing-ack-" });
      const body = yield* encode(start);
      const connectionError = yield* forwardCursorLifecycleHook(`${absent}/s`, body).pipe(Effect.flip);
      expect(connectionError.reason).toBe("transport");
      const oversized = yield* forwardCursorLifecycleHook(`${absent}/s`, Str.repeat(8193)("x")).pipe(Effect.flip);
      expect(oversized.reason).toBe("callback");
    })
  );
});
it.layer(Layer.mergeAll(NodeCrypto.layer, platformLayer), { memoMap: Layer.makeMemoMapUnsafe() })((it) => {
  for (const fault of ["overflow", "wrong-drop-sentinel", "timeout"]) {
    it.effect(`synthetic peer ${fault} output refuses and closes its owned fixture resources`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const requested = yield* Deferred.make<void>();
        let released = 0;
        const output =
          fault === "timeout"
            ? Stream.never
            : Stream.make(new TextEncoder().encode(fault === "overflow" ? Str.repeat(1025)("x") : "unexpected\n"));
        const observedOutput = Stream.concat(
          Stream.fromEffect(Deferred.succeed(requested, undefined)).pipe(Stream.drain),
          output
        );
        const spawner = ChildProcessSpawner.make(() =>
          Effect.acquireRelease(Effect.succeed(syntheticHandle(observedOutput, Sink.drain, false)), () =>
            Effect.sync(() => {
              released++;
            })
          )
        );
        const runtime = yield* makeSealedRuntimeFixture().pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        const sending = yield* Effect.forkChild(
          runtime.send("/synthetic-no-listener", "{}", fault === "wrong-drop-sentinel").pipe(Effect.result)
        );
        yield* Deferred.await(requested);
        if (fault === "timeout") yield* TestClock.adjust("6 seconds");
        const result = yield* Fiber.join(sending);
        if (Result.isSuccess(result)) return yield* Effect.die("unsafe synthetic child output admitted");
        expect(result.failure.reason).toBe("transport");
        yield* runtime.close;
        expect(released).toBe(1);
        const remains = yield* fs.exists(runtime.executable);
        expect(remains).toBe(false);
      })
    );
  }
  it.effect("terminal observation refuses a still-running handle and never converts interruption into success", () =>
    Effect.gen(function* () {
      const handle = syntheticHandle(Stream.empty, Sink.drain, true);
      const failed = yield* observeFixtureProcessStopped(handle).pipe(Effect.result);
      if (Result.isSuccess(failed)) return yield* Effect.die("running handle accepted as stopped");
      expect(failed.failure.reason).toBe("runtime");
      const terminalFailure = ChildProcessSpawner.makeHandle({
        ...handle,
        exitCode: Effect.fail(
          PlatformError.systemError({ _tag: "Unknown", module: "ChildProcess", method: "exitCode" })
        ),
        isRunning: Effect.succeed(false),
      });
      const stopped = yield* observeFixtureProcessStopped(terminalFailure).pipe(Effect.result);
      assertSuccess(stopped, undefined);
      const waiting = ChildProcessSpawner.makeHandle({ ...handle, exitCode: Effect.never });
      const observing = yield* Effect.forkChild(observeFixtureProcessStopped(waiting));
      yield* Fiber.interrupt(observing);
      const exit = yield* Fiber.await(observing);
      if (exit._tag !== "Failure") return yield* Effect.die("interrupted observation succeeded");
      expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
    })
  );
  for (const fault of ["oversized-source", "missing-inodes", "changed-source", "different-copy-bytes"]) {
    it.effect(`sealed copy ${fault} refuses before child dispatch and removes its owned directory`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const source = yield* fs.realPath(process.execPath);
        const original = yield* fs.stat(source);
        const sourceHash = yield* sha(source);
        let sourceStats = 0;
        let owned = "";
        let dispatches = 0;
        const guarded = FileSystem.FileSystem.of({
          ...fs,
          makeTempDirectoryScoped: (options) =>
            fs.makeTempDirectoryScoped(options).pipe(
              Effect.tap((path) =>
                Effect.sync(() => {
                  owned = path;
                })
              )
            ),
          stat: (path) =>
            fs.stat(path).pipe(
              Effect.map((stat) => {
                if (path === source) {
                  sourceStats++;
                  if (fault === "oversized-source") return { ...stat, size: ByteSize.bytes(268435457) };
                  if (fault === "changed-source" && sourceStats > 1) return { ...stat, size: ByteSize.bytes(1) };
                }
                return fault === "missing-inodes" ? { ...stat, ino: O.none() } : stat;
              })
            ),
          readFile: (path) =>
            fault === "different-copy-bytes" && path !== source
              ? Effect.succeed(new Uint8Array([0]))
              : fs.readFile(path),
        });
        const result = yield* makeSealedRuntimeFixture().pipe(
          Effect.result,
          Effect.provideService(FileSystem.FileSystem, guarded),
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, {
            ...spawner,
            spawn: (...args) => {
              dispatches++;
              return spawner.spawn(...args);
            },
          })
        );
        if (Result.isSuccess(result)) return yield* Effect.die("unsafe synthetic runtime admitted");
        expect(result.failure.reason).toBe("runtime");
        expect(dispatches).toBe(0);
        if (owned !== "") expect(yield* fs.exists(owned)).toBe(false);
        expect((yield* fs.stat(source)).mode).toBe(original.mode);
        expect(yield* sha(source)).toBe(sourceHash);
      })
    );
  }
  it.effect("raw fixture input bounds reject line injection and multibyte overflow without an ACK request", () =>
    Effect.gen(function* () {
      const runtime = yield* makeSealedRuntimeFixture();
      const server = yield* ackServer("{}", false);
      for (const [path, body] of [
        [`${server.path}\nforged`, "{}"],
        [server.path, "{}\nforged"],
        [server.path, Str.repeat(4097)("é")],
      ]) {
        const result = yield* runtime.send(path, body, false).pipe(Effect.result);
        if (Result.isSuccess(result)) return yield* Effect.die("invalid peer input admitted");
        expect(result.failure.reason).toBe("transport");
      }
      expect(yield* server.received).toBe("");
      const missing = yield* runtime.send(`${server.path}-absent`, "{}", false);
      expect(missing).toBe("\n");
      yield* runtime.close;
      yield* runtime.closed;
    })
  );
  it.effect("private runtime close waits for child exit, removes its copy and preserves source permissions", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtime = yield* makeSealedRuntimeFixture();
      yield* runtime.close;
      yield* runtime.closed;
      const remains = yield* fs.exists(runtime.executable);
      expect(remains).toBe(false);
      const source = yield* fs.realPath(process.execPath);
      expect((yield* fs.stat(source)).mode).toBe(runtime.sourceMode);
    })
  );
  it.effect("interrupting a waiting peer send preserves interruption and closes only its owned process and copy", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const server = yield* ackServer("", true);
      const runtime = yield* makeSealedRuntimeFixture();
      const body = yield* encode(start);
      const sending = yield* Effect.forkChild(runtime.send(server.path, body, false));
      yield* server.awaitRequest;
      yield* Fiber.interrupt(sending);
      const outcome = yield* Fiber.await(sending);
      if (outcome._tag !== "Failure") return yield* Effect.die("unexpected-peer-success");
      expect(Cause.hasInterruptsOnly(outcome.cause)).toBe(true);
      yield* runtime.closed;
      const remains = yield* fs.exists(runtime.executable);
      expect(remains).toBe(false);
      const source = yield* fs.realPath(process.execPath);
      expect((yield* fs.stat(source)).mode).toBe(runtime.sourceMode);
    })
  );
});

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect("commits a kernel-observed start before private ACK, drops content and deduplicates readback", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const first = yield* f.deliver(start);
      const receipt = yield* Effect.fromResult(first.result);
      yield* Effect.fromResult(first.reply);
      expect(receipt).toMatchObject({ accepted: 1, newEvents: 1 });
      const stored = yield* f.journal.readNewEvents(receipt.page.receiptId);
      const events = yield* Effect.fromOption(stored);
      const span = yield* Effect.fromOption(A.head(events));
      const lifecycle = yield* Effect.fromOption(span.nativeLifecycle);
      expect({
        kind: lifecycle.kind,
        sourceTimestamp: lifecycle.sourceTimestamp,
        assurance: lifecycle.assurance,
      }).toEqual({
        kind: "sessionStart",
        sourceTimestamp: "Unknown",
        assurance: "native-hook-kernel-observed-same-uid-nonexclusive",
      });
      assertSome(lifecycle.reportedModelId, "grok-4.7");
      assertSome(lifecycle.reportedEffort, "medium");
      expect(span.kind).toBe("CHAIN");
      expect(span.durationKnown).toBe(false);
      assertNone(span.startTimeUnixNano);
      const encoded = yield* encode(events);
      for (const marker of ["PRIVATE-", "private@example", "/private", "native-session", "forged-root", "2026-01-01"])
        expect(Str.includes(marker)(encoded)).toBe(false);
      yield* TestClock.adjust("10 seconds");
      const repeat = yield* f.deliver(start);
      const replay = yield* Effect.fromResult(repeat.result);
      expect(replay.page.receiptId).toBe(receipt.page.receiptId);
      const exported = yield* encodeNativeTraceBatch(
        NativeExportInput.make({
          hostId: id,
          namespaceId: f.namespaceId,
          project: "harness-otel",
          acceptedAtMillis: receipt.page.acceptedAt,
          spans: events,
        })
      );
      const wireText = new TextDecoder().decode(exported.body);
      const decoded = yield* decodeWire(
        nativeTraceWire.toObject(nativeTraceWire.decode(exported.body), { longs: String })
      );
      const resource = yield* Effect.fromOption(A.head(decoded.resourceSpans));
      const scope = yield* Effect.fromOption(A.head(resource.scopeSpans));
      const point = yield* Effect.fromOption(A.head(scope.spans));
      expect(point.name).toBe("cursor.sessionStart");
      expect(point.startTimeUnixNano).toBe(`${BigInt(receipt.page.acceptedAt) * BigInt(1000000)}`);
      expect(point.endTimeUnixNano).toBe(point.startTimeUnixNano);
      expect(A.some(point.attributes, (entry) => Str.startsWith("llm.token_count")(entry.key))).toBe(false);
      for (const label of [
        "cursor.sessionStart",
        "intake_observation",
        "ai_metrics.lifecycle.kind",
        "native-lifecycle",
        "Unknown",
      ])
        expect(Str.includes(label)(wireText)).toBe(true);
      expect(Str.includes("PRIVATE-")(wireText)).toBe(false);
    })
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect("paused intake, foreign host and exhausted capacity never receive a durable acceptance ACK", () =>
    Effect.gen(function* () {
      const f = yield* fixture(1);
      yield* f.control.pause;
      const paused = yield* f.deliver(start);
      expect(paused.reply._tag).toBe("Failure");
      expect((yield* f.journal.stats).pages).toBe(0);
      yield* f.control.resume;
      const foreign = yield* f.deliver(
        start,
        CursorLifecyclePolicy.make({ ...f.policy, hostId: Sha256Hex.make(Str.repeat(64)("b")) })
      );
      expect(foreign.reply._tag).toBe("Failure");
      expect((yield* f.journal.stats).pages).toBe(0);
      const accepted = yield* f.deliver(start);
      expect(accepted.reply._tag).toBe("Success");
      const full = yield* f.deliver({ ...start, hook_event_name: "sessionEnd", reason: "completed", duration_ms: 5 });
      expect(full.result._tag).toBe("Failure");
      expect(full.reply._tag).toBe("Failure");
      expect((yield* f.journal.stats).pages).toBe(1);
    })
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect("a lost local ACK preserves the durable event and replay is idempotent without invoking Cursor", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const receiver = yield* makeCursorLifecycleFixtureReceiver(f.policy).pipe(
        Effect.provideService(CursorLifecycleRuntime, { journal: f.journal, control: f.control })
      );
      const opened = yield* receiver.open();
      const body = yield* encode(start);
      yield* f.runtime.send(opened.socketPath, body, true);
      const uncertain = yield* opened.accept.pipe(Effect.result);
      expect(uncertain._tag).toBe("Failure");
      expect((yield* f.journal.stats).pages).toBe(1);
      const replay = yield* f.deliver(start);
      expect(replay.reply._tag).toBe("Success");
      if (replay.result._tag !== "Success") return yield* Effect.die("missing replay receipt");
      expect(replay.result.success).toMatchObject({ newEvents: 1, accepted: 1 });
      expect((yield* f.journal.stats).pages).toBe(1);
    })
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect(
    "records an end without inventing a start or measured source interval; conflicts preserve the original",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const end = {
          ...start,
          hook_event_name: "sessionEnd",
          reason: "error",
          final_status: "error",
          duration_ms: 45000,
          error_message: "PRIVATE-ERROR",
          tool_result: "PRIVATE-TOOL",
        };
        const first = yield* f.deliver(end);
        expect(first.result._tag).toBe("Success");
        if (first.result._tag !== "Success") return;
        const events = yield* f.journal.readNewEvents(first.result.success.page.receiptId);
        if (O.isNone(events) || events.value[0] === undefined) return yield* Effect.die("missing end");
        const span = events.value[0];
        assertNone(span.startTimeUnixNano);
        assertNone(span.endTimeUnixNano);
        expect(span.status).toBe("unset");
        assertSome(span.nativeLifecycle.pipe(O.map((v) => v.reportedDurationMillis)), O.some(45000));
        const changed = yield* f.deliver({ ...end, duration_ms: 46000 });
        if (changed.result._tag !== "Success") return yield* Effect.die("missing conflict receipt");
        expect(changed.result.success).toMatchObject({ accepted: 0, rejected: 1, conflictIndices: [0] });
        const retained = yield* f.journal.readNewEvents(first.result.success.page.receiptId);
        expect(retained).toEqual(events);
      })
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect("refuses wrong runtime/cwd/source/helper enrollment without recording or acknowledging an event", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      for (const change of [
        { runtimeSha256: id },
        { workspace: "/nonexistent" },
        { helperSha256: id },
        { sourcePins: A.map(f.policy.sourcePins, (pin) => ({ ...pin, sha256: id })) },
      ]) {
        // This is deliberately invalid enrollment, not a caller-supplied authority DTO.
        const policy = CursorLifecyclePolicy.make({ ...f.policy, ...change });
        const result = yield* f.deliver(start, policy);
        expect(result.result._tag).toBe("Failure");
        expect(result.reply._tag).toBe("Failure");
      }
      expect((yield* f.journal.stats).pages).toBe(0);
    })
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect(
    "writable byte-identical private runtime refuses before journal commit; sealing admits the same bytes",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const fs = yield* FileSystem.FileSystem;
        const before = yield* sha(f.runtime.executable);
        expect(before).toBe(f.policy.runtimeSha256);
        const alias = `${f.runtime.executable}.link`;
        yield* fs.symlink(f.runtime.executable, alias);
        const linked = yield* f.deliver(start, CursorLifecyclePolicy.make({ ...f.policy, runtimeExecutable: alias }));
        expect(linked.result._tag).toBe("Failure");
        expect(linked.reply._tag).toBe("Failure");
        expect((yield* f.journal.stats).pages).toBe(0);
        yield* fs.chmod(f.runtime.executable, 0o770);
        const diagnostic = yield* inspectSyntheticPeer(f.policy, f.runtime);
        expect(diagnostic.report.phase).toBe("public_digest");
        expect(diagnostic.report.predicate).toBe("runtime.public_digest.r41");
        expect(
          A.some(
            R.toEntries(diagnostic.report.checks),
            ([name, value]) => name === "runtime.public_digest.b40.1" && value.observedTrue
          )
        ).toBe(true);
        expect(R.keys(diagnostic.report.checks)).not.toContain("runtime.public_digest.b40.2");
        const refused = yield* f.deliver(start);
        expect(refused.result._tag).toBe("Failure");
        expect(refused.reply._tag).toBe("Failure");
        expect((yield* f.journal.stats).pages).toBe(0);
        const writableHash = yield* sha(f.runtime.executable);
        expect(writableHash).toBe(before);
        yield* fs.chmod(f.runtime.executable, 0o500);
        const accepted = yield* f.deliver(start);
        expect(accepted.result._tag).toBe("Success");
        expect(accepted.reply._tag).toBe("Success");
        expect((yield* f.journal.stats).pages).toBe(1);
        const sealedHash = yield* sha(f.runtime.executable);
        expect(sealedHash).toBe(before);
      })
  )
);

it.effect.prop(
  "arbitrary closed diagnostic evidence roundtrips without serializing forged private fields",
  [Arbitrary.schema(diagnosticEvidence)],
  Effect.fnUntraced(function* ([sample]) {
    const forged = {
      ...sample,
      argv: ["PRIVATE-ARGV"],
      path: "/private/PRIVATE-PATH",
      stderr: "PRIVATE-STDERR",
      report: { ...sample.report, callback: "PRIVATE-CALLBACK" },
    };
    const encoded = yield* encodeDiagnosticEvidence(forged);
    const decoded = yield* decodeDiagnosticEvidence(encoded);
    expect(equivalentDiagnosticEvidence(sample, decoded)).toBe(true);
    expect(R.keys(decoded)).toHaveLength(7);
    for (const marker of ["PRIVATE-ARGV", "PRIVATE-PATH", "PRIVATE-STDERR", "PRIVATE-CALLBACK"])
      expect(Str.includes(marker)(encoded)).toBe(false);
  }),
  { arbitrary: fcRuns(25) }
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect("refuses group-writable source fixtures without weakening the kernel observer", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const pin = yield* Effect.fromOption(A.head(f.policy.sourcePins));
      expect((yield* fs.stat(pin.path)).mode & 0o777).toBe(0o600);
      yield* fs.chmod(pin.path, 0o660);
      const result = yield* f.deliver(start);
      expect(result.result._tag).toBe("Failure");
      expect(result.reply._tag).toBe("Failure");
      expect((yield* f.journal.stats).pages).toBe(0);
    })
  )
);

it.layer(Layer.merge(Layer.fresh(sql), NodeCrypto.layer), { timeout: "45 seconds" })((it) =>
  it.effect("raw OTLP lifecycle assertions cannot mint receiver provenance", () =>
    Effect.gen(function* () {
      const body = yield* encode({
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: Str.repeat(32)("1"),
                    spanId: Str.repeat(16)("2"),
                    attributes: [
                      {
                        key: "ai_metrics.lifecycle.assurance",
                        value: { stringValue: "native-hook-kernel-observed-same-uid-nonexclusive" },
                      },
                      { key: "ai_metrics.lifecycle.kind", value: { stringValue: "sessionEnd" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      const batch = yield* projectNativeTraceRequest(
        NativeTraceRequest.make({
          routeId: id,
          hashSalt: Redacted.make(salt),
          contentType: "application/json",
          body: new TextEncoder().encode(body),
          approvedModels: [],
          usageConvention: "unknown",
        })
      );
      expect(batch.spans).toHaveLength(1);
      const span = yield* Effect.fromOption(A.head(batch.spans));
      assertNone(span.nativeLifecycle);
    })
  )
);

for (const bad of [
  { ...start, session_id: "other" },
  { ...start, is_background_agent: true },
  { ...start, hook_event_name: "afterAgentResponse" },
  { ...start, cursor_version: "unknown" },
  { ...start, hook_event_name: "sessionEnd", reason: "surprise", duration_ms: 1 },
  { ...start, hook_event_name: "sessionEnd", reason: "completed", duration_ms: -1 },
]) {
  it.effect("rejects an unsupported native envelope before opening the callback socket", () =>
    Effect.gen(function* () {
      const body = yield* encode(bad);
      const result = yield* forwardCursorLifecycleHook("/nonexistent/never-open", body).pipe(Effect.flip);
      expect(result.reason).toBe("callback");
    })
  );
}

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect("production receiver refuses synthetic public source pins before opening a listener", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const receiver = yield* makeCursorLifecycleReceiver(f.policy).pipe(
        Effect.provideService(CursorLifecycleRuntime, { journal: f.journal, control: f.control })
      );
      const error = yield* receiver.open().pipe(Effect.flip);
      expect(error.reason).toBe("enrollment");
      expect((yield* f.journal.stats).pages).toBe(0);
    })
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect("reports closed synthetic peer predicates without retaining callback or process values", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const observed = yield* inspectSyntheticPeer(f.policy, f.runtime);
      const message = yield* diagnosticContext(observed);
      // This schema-closed metadata has no paths, PIDs, argv, environment, callback body or stderr.
      yield* Effect.logInfo(message);
      expect(observed.report.sourceHashMatches, message).toBe(true);
      expect(observed.report.predicateAstPreserved, message).toBe(true);
      expect(observed.report.shortCircuitOrderPreserved, message).toBe(true);
      expect(observed.report.projectedPrintSuppressed, message).toBe(true);
      expect(observed.report.ok, message).toBe(true);
      expect(observed.diagnosticAckObserved, message).toBe(true);
      expect(observed.helperExitZero, message).toBe(true);
      expect((yield* f.journal.stats).pages, message).toBe(0);
    }).pipe(Effect.timeout("15 seconds"))
  )
);

it.effect("closed diagnostic assertion context survives when all info logging is filtered", () =>
  Effect.gen(function* () {
    const report = diagnosticReport.make({
      ok: false,
      phase: "public_digest",
      predicate: "source.public_digest.b40.1",
      exceptionClass: "ValueError",
      sourceHashMatches: true,
      predicateAstPreserved: true,
      shortCircuitOrderPreserved: true,
      projectedPrintSuppressed: true,
      checks: { "source.public_digest.b40.1": { observedTrue: true, observedFalse: false } },
    });
    const message = yield* diagnosticContext(
      { listenerReady: true, diagnosticAckObserved: false, helperExitZero: false, report },
      "synthetic-regression-fixture"
    );
    let infoLogs = 0;
    const logger = Logger.make(() => {
      infoLogs++;
    });
    const loggerContext = yield* Layer.build(Logger.layer([logger]));
    const assertion = yield* Effect.gen(function* () {
      yield* Effect.logInfo(message);
      return yield* Effect.try({
        try: () => expect(report.ok, message).toBe(true),
        catch: (error) =>
          decodeAssertionMessage(error).pipe(
            O.map((value) => value.message),
            O.getOrElse(() => "unclassified-assertion")
          ),
      }).pipe(Effect.flip);
    }).pipe(Effect.provideService(References.MinimumLogLevel, "None"), Effect.provideContext(loggerContext));
    expect(infoLogs).toBe(0);
    expect(Str.includes(message)(assertion)).toBe(true);
    expect(Str.includes("source.public_digest.b40.1")(assertion)).toBe(true);
    for (const forbidden of [
      "PRIVATE-PROMPT",
      "private@example",
      "native-session",
      "forged-root",
      "/home/",
      "argv",
      "stderr",
    ])
      expect(Str.includes(forbidden)(assertion)).toBe(false);
  })
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect("refuses a diagnostic source digest mismatch before observing a peer", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const observed = yield* inspectSyntheticPeer(
        CursorLifecyclePolicy.make({ ...f.policy, helperSha256: id }),
        f.runtime
      );
      expect(observed.listenerReady).toBe(false);
      expect(observed.diagnosticAckObserved).toBe(false);
      expect(observed.report.sourceHashMatches).toBe(false);
      expect(observed.report.phase).toBe("bootstrap");
      expect(R.size(observed.report.checks)).toBe(0);
      expect((yield* f.journal.stats).pages).toBe(0);
    }).pipe(Effect.timeout("15 seconds"))
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect("attributes an owned synthetic writable source refusal to a closed digest predicate", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const pin = yield* Effect.fromOption(A.head(f.policy.sourcePins));
      yield* fs.chmod(pin.path, 0o660);
      const observed = yield* inspectSyntheticPeer(f.policy, f.runtime);
      expect(observed.listenerReady).toBe(true);
      expect(observed.report.ok).toBe(false);
      expect(observed.report.phase).toBe("public_digest");
      expect(observed.report.exceptionClass).toBe("ValueError");
      expect(observed.diagnosticAckObserved).toBe(false);
      expect(
        A.some(
          R.toEntries(observed.report.checks),
          ([name, value]) => name === "source.public_digest.b40.1" && value.observedTrue
        )
      ).toBe(true);
      expect(observed.report.predicateAstPreserved).toBe(true);
      expect(observed.report.shortCircuitOrderPreserved).toBe(true);
      expect((yield* f.journal.stats).pages).toBe(0);
    }).pipe(Effect.timeout("15 seconds"))
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, platformLayer), { timeout: "45 seconds" })((it) =>
  it.effect("diagnostic transport errors cannot expose helper arguments or raw exceptions", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const failed = yield* inspectSyntheticPeer(
        CursorLifecyclePolicy.make({ ...f.policy, pythonExecutable: "/nonexistent/PRIVATE-HELPER" }),
        f.runtime
      ).pipe(Effect.flip);
      expect(failed.reason).toBe("transport");
      const encoded = yield* encodeDiagnosticError(failed);
      expect(Str.includes("PRIVATE-HELPER")(encoded)).toBe(false);
      expect(Str.includes("_closed_probe")(encoded)).toBe(false);
      expect((yield* f.journal.stats).pages).toBe(0);
    }).pipe(Effect.timeout("15 seconds"))
  )
);
