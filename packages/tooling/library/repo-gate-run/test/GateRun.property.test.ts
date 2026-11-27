import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { ConsoleSettings, GateConsole } from "@beep/repo-gate-run/GateConsole";
import { GateHistory } from "@beep/repo-gate-run/GateHistory";
import { GateRecorder } from "@beep/repo-gate-run/GateRecorder";
import { GateRunRequest, runGate } from "@beep/repo-gate-run/GateRun";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { eventsSource, linesOf, packageTarget } from "./support/fixtures.ts";

const services = Layer.mergeAll(
  GateConsole.layer(ConsoleSettings.make({ audience: "agent" })),
  GateHistory.layerNone,
  GateRecorder.layer.pipe(Layer.provide(GateRecordStore.layerMemory))
);

const VERDICTS = [": PASSED,", ": FAILED,", ": ERRORED,", ": CANCELLED,"];

describe("runGate over any event list", () => {
  it.layer(services, { timeout: "60 seconds" })("with the memory recorder", (it) => {
    it.effect.prop(
      "never fails or dies, opens and closes on a verdict line, and keeps the exit code",
      [GateEvent.pipe(S.Array, Arbitrary.schema), Arbitrary.schema(S.Int)],
      ([events, exitCode]) =>
        Effect.gen(function* () {
          const request = GateRunRequest.make({
            target: packageTarget("test"),
            source: eventsSource(events),
            exitCode,
          });
          const result = yield* runGate(request, Stream.empty);
          const lines = linesOf(result.output.text);
          assert.strictEqual(A.headNonEmpty(lines), A.lastNonEmpty(lines));
          assert.isTrue(A.some(VERDICTS, (word) => Str.includes(word)(A.headNonEmpty(lines))));
          assert.strictEqual(result.exitCode, exitCode);
        }),
      { arbitrary: fcRuns(40) }
    );
  });
});
