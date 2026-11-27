import { GateEvent } from "@beep/gate-report/GateEvent";
import { IncompleteRunError } from "@beep/gate-report/Reducer";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { GateRecorder, RecordRequest, RunSource, settleSource } from "@beep/repo-gate-run/GateRecorder";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { epoch, eventsSource, packageTarget, testRunEvents } from "./support/fixtures.ts";

const encoder = new TextEncoder();

const unexplained: ReadonlyArray<GateEvent> = [
  GateEvent.cases.RunStarted.make({
    runId: "r1",
    gate: "test",
    subject: "@beep/glob",
    itemKind: "test",
    startedAt: epoch,
    inputFingerprint: "x",
  }),
  GateEvent.cases.RunFinished.make({ durationMs: 5, reason: "passed", exitCode: O.some(1) }),
];

const request = (events: ReadonlyArray<GateEvent>) =>
  RecordRequest.make({ target: packageTarget("test"), source: eventsSource(events) });

const fallbackMessage = Effect.fn("fallbackMessage")(function* (
  events: ReadonlyArray<GateEvent>,
  log: Stream.Stream<Uint8Array>
) {
  const recorder = yield* GateRecorder;
  const recorded = yield* recorder.record(request(events), log);
  return O.flatMap(A.last(recorded.report.items), (item) => O.map(item.detail, (detail) => detail.message));
});

describe("GateRecorder", () => {
  it.layer(GateRecorder.layer.pipe(Layer.provideMerge(GateRecordStore.layerMemory)), { timeout: "30 seconds" })(
    "over the record store",
    (it) => {
      it.effect("writes the log and the record and returns both paths with the log's size", () =>
        Effect.gen(function* () {
          const recorder = yield* GateRecorder;
          const recorded = yield* recorder.record(request(testRunEvents(["adds"])), Stream.make(encoder.encode("abc")));
          const paths = O.getOrThrow(recorded.paths);
          assert.strictEqual(paths.logBytes, 3);
          assert.strictEqual(paths.log, "packages/foundation/primitive/glob/.beep/gates/test/report.log");
          assert.deepStrictEqual(recorded.omissions, []);
        })
      );

      it.effect("gives an unexplained failure the log excerpt, split chunks decoded whole", () =>
        Effect.gen(function* () {
          const check = encoder.encode("✓");
          const message = yield* fallbackMessage(
            unexplained,
            Stream.make(encoder.encode("boom "), check.subarray(0, 1), check.subarray(1))
          );
          assertSome(message, "boom ✓");
        })
      );

      it.effect("keeps the head and the tail of a long stream in the excerpt", () =>
        Effect.gen(function* () {
          const message = yield* fallbackMessage(
            unexplained,
            Stream.make(encoder.encode(`HEAD${Str.repeat(20_000)("x")}TAIL`))
          );
          const text = O.getOrThrow(message);
          assert.isTrue(Str.startsWith("HEAD")(text) && Str.endsWith("TAIL")(text));
          assert.include(text, "log excerpt truncated");
        })
      );

      it.effect("an empty stream leaves the fallback to name the exit code", () =>
        Effect.gen(function* () {
          const message = yield* fallbackMessage(unexplained, Stream.empty);
          assertSome(message, "the tool exited with code 1 and reported no failed item");
        })
      );

      it.effect("fails on events that do not describe a whole run, and on a stream failure", () =>
        Effect.gen(function* () {
          const recorder = yield* GateRecorder;
          const incomplete = yield* Effect.flip(recorder.record(request(A.take(unexplained, 1)), Stream.empty));
          const broken = yield* Effect.flip(recorder.record(request(unexplained), Stream.fail("pipe closed")));
          assert.instanceOf(incomplete, IncompleteRunError);
          assert.strictEqual(broken, "pipe closed");
        })
      );
    }
  );

  it.layer(GateRecorder.layer.pipe(Layer.provide(GateRecordStore.layerFailingWrites("disk full"))), {
    timeout: "30 seconds",
  })("over a store whose writes fail", (it) => {
    it.effect("returns the settled report with no paths and names both writes", () =>
      Effect.gen(function* () {
        const recorder = yield* GateRecorder;
        const recorded = yield* recorder.record(request(testRunEvents([])), Stream.make(encoder.encode("ok")));
        assert.strictEqual(recorded.report.reason, "passed");
        assertNone(recorded.paths);
        assert.deepStrictEqual(
          A.map(recorded.omissions, (omission) => omission.part),
          ["log", "record"]
        );
      })
    );
  });

  it("settles a finished report as it is", () => {
    const report = Result.getOrThrow(settleSource(eventsSource(testRunEvents([])), O.none()));
    const settled = settleSource(O.some("excerpt"))(RunSource.cases.FinishedReport.make({ report }));
    assertSuccess(settled, report);
  });
});
