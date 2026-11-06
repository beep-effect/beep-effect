import { createConnection } from "node:net";
import {
  CursorLifecyclePolicy,
  CursorLifecycleRuntime,
  forwardCursorLifecycleHook,
  makeCursorLifecycleReceiver,
} from "@beep/repo-ai-metrics/cursor-lifecycle";
import { encodeNativeTraceBatch, NativeExportInput } from "@beep/repo-ai-metrics/native-export";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { makeObservationControl, ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import {
  cursorPeerSource,
  hashObservationPayload,
  makeCursorLifecycleFixtureReceiver,
  nativeTraceWire,
} from "@beep/repo-ai-metrics/test/cursor-lifecycle";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

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
const salt = "synthetic-cursor-passive-salt";
const id = Sha256Hex.make(Str.repeat(64)("a"));
const sql = makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver });
const platformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.merge(NodeFileSystem.layer, NodePath.layer))
);
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
  const runtimeExecutable = yield* fs.realPath(process.execPath);
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
    runtimeSha256: yield* sha(runtimeExecutable),
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
      forwardCursorLifecycleHook(opened.success.socketPath, encoded).pipe(Effect.result)
    );
    const result = yield* opened.success.accept.pipe(Effect.result);
    const reply = yield* Fiber.join(sending);
    return { result, reply };
  });
  return { policy, journal, control, namespaceId, deliver };
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
      yield* Effect.callback<void>((resume) => {
        const socket = createConnection({ path: opened.socketPath, allowHalfOpen: true });
        socket.once("connect", () =>
          socket.end(body, () => {
            socket.destroy();
            resume(Effect.void);
          })
        );
        socket.once("error", () => resume(Effect.void));
        return Effect.sync(() => socket.destroy());
      });
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
