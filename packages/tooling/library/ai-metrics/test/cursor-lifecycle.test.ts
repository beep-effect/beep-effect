import { createConnection } from "node:net";
import {
  CursorLifecyclePolicy,
  forwardCursorLifecycleHook,
  makeCursorLifecycleReceiver,
} from "@beep/repo-ai-metrics/cursor-lifecycle";
import { encodeNativeTraceBatch, NativeExportInput } from "@beep/repo-ai-metrics/native-export";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { makeObservationControl, ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect } from "@effect/vitest";
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
import { cursorPeerSource } from "../src/internal/cursor-peer-source.ts";
import { hashObservationPayload, nativeTraceWire } from "../src/internal/native-trace-wire.ts";

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
    sourcePins: [
      {
        path: "/home/elpresidank/.local/share/cursor-agent/versions/2026.11.05-86047df/1212.index.js",
        sha256: Sha256Hex.make("15b18cb92aa4093acc886d1ef6f6f308bc97a9abca69b89cde805f91e9760042"),
      },
      {
        path: "/home/elpresidank/.local/share/cursor-agent/versions/2026.11.05-86047df/5504.index.js",
        sha256: Sha256Hex.make("02ddf6e240a6f229fcf6e2b414479b26dfd4ad64199fd33ce7a872a391d6fe9c"),
      },
    ],
  });
  const journal = yield* makeNativeIntakeJournal(
    TranscriptIntakeConfig.make({ hostId: id, namespaceId, maxPages, maxPayloadBytes: 1048576, maxDatabasePages: 256 })
  );
  const control = yield* makeObservationControl(
    ObservationControlPolicy.make({ maxActive: 1, drainTimeoutMillis: 1000 })
  );
  yield* control.resume;
  const deliver = Effect.fn("CursorLifecycleTest.deliver")(function* (body: unknown, override = policy) {
    const receiver = makeCursorLifecycleReceiver({ policy: override, journal, control });
    const opened = yield* receiver.open().pipe(Effect.result);
    if (Result.isFailure(opened)) return { result: opened, reply: opened };
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

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeServices.layer), { timeout: "45 seconds" })((it) =>
  it.effect("commits a kernel-observed start before private ACK, drops content and deduplicates readback", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const first = yield* f.deliver(start);
      expect(first.result._tag).toBe("Success");
      expect(first.reply._tag).toBe("Success");
      if (first.result._tag !== "Success") return;
      const receipt = first.result.success;
      expect(receipt).toMatchObject({ accepted: 1, newEvents: 1 });
      const events = yield* f.journal.readNewEvents(receipt.page.receiptId);
      expect(O.isSome(events)).toBe(true);
      if (O.isNone(events)) return;
      const span = events.value[0];
      if (span === undefined || O.isNone(span.nativeLifecycle)) return yield* Effect.die("missing lifecycle");
      expect(span.nativeLifecycle.value).toMatchObject({
        kind: "sessionStart",
        sourceTimestamp: "Unknown",
        assurance: "native-hook-kernel-observed-same-uid-nonexclusive",
        reportedModelId: O.some("grok-4.7"),
        reportedEffort: O.some("medium"),
      });
      expect(span.kind).toBe("CHAIN");
      expect(span.durationKnown).toBe(false);
      expect(O.isNone(span.startTimeUnixNano)).toBe(true);
      const encoded = yield* encode(events.value);
      for (const marker of ["PRIVATE-", "private@example", "/private", "native-session", "forged-root", "2026-01-01"])
        expect(Str.includes(marker)(encoded)).toBe(false);
      yield* TestClock.adjust("10 seconds");
      const repeat = yield* f.deliver(start);
      expect(repeat.result._tag).toBe("Success");
      if (repeat.result._tag === "Success") expect(repeat.result.success.page.receiptId).toBe(receipt.page.receiptId);
      const exported = yield* encodeNativeTraceBatch(
        NativeExportInput.make({
          hostId: id,
          namespaceId: f.namespaceId,
          project: "harness-otel",
          acceptedAtMillis: receipt.page.acceptedAt,
          spans: events.value,
        })
      );
      const wireText = new TextDecoder().decode(exported.body);
      const decoded = yield* decodeWire(
        nativeTraceWire.toObject(nativeTraceWire.decode(exported.body), { longs: String })
      );
      const point = decoded.resourceSpans[0]?.scopeSpans[0]?.spans[0];
      expect(point?.name).toBe("cursor.sessionStart");
      expect(point?.startTimeUnixNano).toBe(`${BigInt(receipt.page.acceptedAt) * BigInt(1000000)}`);
      expect(point?.endTimeUnixNano).toBe(point?.startTimeUnixNano);
      expect(A.some(point?.attributes ?? [], (entry) => Str.startsWith("llm.token_count")(entry.key))).toBe(false);
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

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeServices.layer), { timeout: "45 seconds" })((it) =>
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

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeServices.layer), { timeout: "45 seconds" })((it) =>
  it.effect("a lost local ACK preserves the durable event and replay is idempotent without invoking Cursor", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const receiver = makeCursorLifecycleReceiver({ policy: f.policy, journal: f.journal, control: f.control });
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

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeServices.layer), { timeout: "45 seconds" })((it) =>
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
        expect(span.startTimeUnixNano).toEqual(O.none());
        expect(span.endTimeUnixNano).toEqual(O.none());
        expect(span.status).toBe("unset");
        expect(span.nativeLifecycle.pipe(O.map((v) => v.reportedDurationMillis))).toEqual(O.some(O.some(45000)));
        const changed = yield* f.deliver({ ...end, duration_ms: 46000 });
        if (changed.result._tag !== "Success") return yield* Effect.die("missing conflict receipt");
        expect(changed.result.success).toMatchObject({ accepted: 0, rejected: 1, conflictIndices: [0] });
        const retained = yield* f.journal.readNewEvents(first.result.success.page.receiptId);
        expect(retained).toEqual(events);
      })
  )
);

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeServices.layer), { timeout: "45 seconds" })((it) =>
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

it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeServices.layer), { timeout: "45 seconds" })((it) =>
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
      expect(batch.spans[0]?.nativeLifecycle).toEqual(O.none());
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
  it.layer(Layer.mergeAll(Layer.fresh(sql), NodeCrypto.layer, NodeServices.layer), { timeout: "45 seconds" })((it) =>
    it.effect("rejects an unsupported native envelope before opening the callback socket", () =>
      Effect.gen(function* () {
        const body = yield* encode(bad);
        const result = yield* forwardCursorLifecycleHook("/nonexistent/never-open", body).pipe(Effect.flip);
        expect(result.reason).toBe("callback");
      })
    )
  );
}
