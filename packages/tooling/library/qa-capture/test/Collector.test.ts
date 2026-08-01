import {
  Collector,
  CollectorHandle,
  CollectorServeOptions,
  decodeActionEventJson,
  decodeCollectorHandleJson,
  EventsAccepted,
  encodeActionEventJson,
  encodeCollectorHandleJson,
  MarkAccepted,
  MarkerEvent,
  PointerDownEvent,
  QaCaptureError,
  Witness,
} from "@beep/qa-capture";
import { A, O, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, FileSystem, Layer, Path, pipe } from "effect";
import * as S from "effect/Schema";
import { FetchHttpClient, HttpBody, HttpClient } from "effect/unstable/http";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const witnessStub = "(()=>{/* witness stub */})();";

const TestLayer = Layer.mergeAll(
  Collector.layer.pipe(Layer.provide(Witness.layerScript(witnessStub)), Layer.provide(NodeServices.layer)),
  NodeServices.layer,
  FetchHttpClient.layer
);

const decodeEventsAccepted = S.decodeUnknownEffect(S.fromJsonString(EventsAccepted));
const decodeMarkAccepted = S.decodeUnknownEffect(S.fromJsonString(MarkAccepted));

describe("@beep/qa-capture collector", () => {
  it.effect(
    "collects NDJSON events end to end and cleans up on scope close",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const eventsPath = path.join(tmpDir, "round-1", "events.ndjson");
        const handlePath = path.join(tmpDir, "current.json");

        const down = PointerDownEvent.make({
          button: 0,
          kind: "pointer-down",
          pointerId: 1,
          selectorPath: '[data-qa="dock-sash"]',
          seq: 1,
          tEpochMs: 1753838000000,
          x: 120,
          y: 240,
        });
        const marker = MarkerEvent.make({
          kind: "marker",
          label: "scenario:start",
          seq: 2,
          tEpochMs: 1753838000100,
        });
        const validLines = yield* Effect.forEach([down, marker], (event) => encodeActionEventJson(event));
        const batch = [...validLines, "this is not json"].join("\n");

        yield* Effect.scoped(
          Effect.gen(function* () {
            const collector = yield* Collector;
            const running = yield* collector.serve(
              CollectorServeOptions.make({
                eventsPath,
                handlePath: O.some(handlePath),
                port: 0,
                round: 1,
                sessionDir: path.join(tmpDir, "round-1"),
                sessionId: "qa-collector-test",
              })
            );
            expect(running.port).toBeGreaterThan(0);
            expect(yield* fs.exists(handlePath)).toBe(true);

            const base = `http://127.0.0.1:${running.port}`;

            const witnessResponse = yield* HttpClient.get(`${base}/witness.js`);
            expect(yield* witnessResponse.text).toBe(witnessStub);

            const eventsResponse = yield* HttpClient.post(`${base}/events`, {
              body: HttpBody.text(batch, "text/plain;charset=UTF-8"),
            });
            const accepted = yield* Effect.flatMap(eventsResponse.text, decodeEventsAccepted);
            expect(accepted.accepted).toBe(2);
            expect(accepted.rejected).toBe(1);

            const markResponse = yield* HttpClient.post(`${base}/mark`, {
              body: HttpBody.jsonUnsafe({ label: "agent:checkpoint" }),
            });
            const marked = yield* Effect.flatMap(markResponse.text, decodeMarkAccepted);
            // Canonical session-wide sequencing: two accepted batch events took
            // seqs 1 and 2, so the server mark receives 3 — never the
            // page-local or placeholder value.
            expect(marked.seq).toBe(3);

            const stopFiber = yield* Effect.forkChild(running.awaitStop);
            yield* HttpClient.post(`${base}/stop`, { body: HttpBody.text("", "text/plain") });
            yield* Fiber.join(stopFiber);

            expect(yield* running.eventsWritten).toBe(3);
            expect(yield* running.rejectedCount).toBe(1);
          })
        );

        // Scope closed: the writer drained and the handle file is gone.
        expect(yield* fs.exists(handlePath)).toBe(false);
        const written = yield* fs.readFileString(eventsPath);
        const lines = pipe(written, Str.split("\n"), A.filter(Str.isNonEmpty));
        expect(A.length(lines)).toBe(3);
        const decoded = yield* Effect.forEach(lines, (line) => decodeActionEventJson(line));
        expect(A.map(decoded, (event) => event.kind)).toEqual(["pointer-down", "marker", "marker"]);
        // On-disk seqs are the canonical rewrite: strictly monotone from 1.
        expect(A.map(decoded, (event) => event.seq)).toEqual([1, 2, 3]);

        yield* fs.remove(tmpDir, { force: true, recursive: true });
      }).pipe(provideScopedLayer(TestLayer)),
    15000
  );

  it.effect(
    "serve refuses to take over a live foreign collector handle",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const handlePath = path.join(tmpDir, "current.json");

        // The test runner's parent process is guaranteed alive and foreign.
        const foreign = CollectorHandle.make({
          eventsPath: path.join(tmpDir, "round-1", "events.ndjson"),
          pid: process.ppid,
          port: 43117,
          round: 1,
          sessionDir: path.join(tmpDir, "round-1"),
          sessionId: "qa-live-foreign",
          startedAtEpochMs: 1753838000000,
        });
        yield* Effect.flatMap(encodeCollectorHandleJson(foreign), (json) => fs.writeFileString(handlePath, json));

        const error = yield* Effect.scoped(
          Effect.gen(function* () {
            const collector = yield* Collector;
            return yield* collector.serve(
              CollectorServeOptions.make({
                eventsPath: path.join(tmpDir, "round-2", "events.ndjson"),
                handlePath: O.some(handlePath),
                port: 0,
                round: 2,
                sessionDir: path.join(tmpDir, "round-2"),
                sessionId: "qa-usurper",
              })
            );
          })
        ).pipe(Effect.flip);

        assert(QaCaptureError.is(error));
        expect(pipe(error.message, Str.includes("still live"))).toBe(true);

        // The live owner's handle survives the refused takeover.
        const remaining = yield* Effect.flatMap(fs.readFileString(handlePath), decodeCollectorHandleJson);
        expect(remaining.sessionId).toBe("qa-live-foreign");

        yield* fs.remove(tmpDir, { force: true, recursive: true });
      }).pipe(provideScopedLayer(TestLayer)),
    15000
  );

  it.effect(
    "serve reclaims a stale dead-pid handle and teardown leaves a successor's handle in place",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const handlePath = path.join(tmpDir, "current.json");

        // A finished child process yields a pid that is provably dead.
        const deadPid = Bun.spawnSync(["true"]).pid;
        const stale = CollectorHandle.make({
          eventsPath: path.join(tmpDir, "round-1", "events.ndjson"),
          pid: deadPid,
          port: 43117,
          round: 1,
          sessionDir: path.join(tmpDir, "round-1"),
          sessionId: "qa-stale-owner",
          startedAtEpochMs: 1753838000000,
        });
        yield* Effect.flatMap(encodeCollectorHandleJson(stale), (json) => fs.writeFileString(handlePath, json));

        const successor = CollectorHandle.make({
          eventsPath: path.join(tmpDir, "round-3", "events.ndjson"),
          pid: process.pid,
          port: 43118,
          round: 3,
          sessionDir: path.join(tmpDir, "round-3"),
          sessionId: "qa-successor",
          startedAtEpochMs: 1753838000500,
        });

        yield* Effect.scoped(
          Effect.gen(function* () {
            const collector = yield* Collector;
            const running = yield* collector.serve(
              CollectorServeOptions.make({
                eventsPath: path.join(tmpDir, "round-2", "events.ndjson"),
                handlePath: O.some(handlePath),
                port: 0,
                round: 2,
                sessionDir: path.join(tmpDir, "round-2"),
                sessionId: "qa-reclaimer",
              })
            );
            // The stale handle was reclaimed by this session.
            expect(running.handle.sessionId).toBe("qa-reclaimer");
            const written = yield* Effect.flatMap(fs.readFileString(handlePath), decodeCollectorHandleJson);
            expect(written.sessionId).toBe("qa-reclaimer");

            // Simulate a takeover while this session is still open: another
            // session's handle replaces the file before the scope closes.
            yield* Effect.flatMap(encodeCollectorHandleJson(successor), (json) => fs.writeFileString(handlePath, json));
          })
        );

        // Teardown of the reclaimer must not delete the successor's handle.
        const remaining = yield* Effect.flatMap(fs.readFileString(handlePath), decodeCollectorHandleJson);
        expect(remaining.sessionId).toBe("qa-successor");

        yield* fs.remove(tmpDir, { force: true, recursive: true });
      }).pipe(provideScopedLayer(TestLayer)),
    15000
  );
});
