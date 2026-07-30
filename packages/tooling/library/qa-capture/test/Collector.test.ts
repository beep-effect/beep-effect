import {
  Collector,
  CollectorServeOptions,
  decodeActionEventJson,
  EventsAccepted,
  encodeActionEventJson,
  MarkAccepted,
  MarkerEvent,
  PointerDownEvent,
  Witness,
} from "@beep/qa-capture";
import { A, O, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
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
});
