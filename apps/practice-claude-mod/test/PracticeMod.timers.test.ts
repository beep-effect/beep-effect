import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ModHost } from "@/PracticeMod.host";
import { TimerLog, timerLogLayer } from "@/PracticeMod.timers";
import { ChosenMatter, TimerInterval } from "@/PracticeMod.values";

const decodeTimerIntervals = S.decodeUnknownEffect(S.Array(TimerInterval));
const decodeTimerIntervalLine = S.decodeEffect(S.fromJsonString(TimerInterval));

// What the fake host stored and wrote, so a test can seed and inspect it.
class FakeHostState extends Context.Service<
  FakeHostState,
  { readonly store: MutableHashMap.MutableHashMap<string, unknown> }
>()("@beep/practice-claude-mod/test/PracticeMod.timers.test/FakeHostState") {}

const fakeHost = Layer.effect(ModHost)(
  Effect.map(FakeHostState, ({ store }) =>
    ModHost.of({
      storeGet: Effect.fn("FakeHost.storeGet")((key: string) =>
        Effect.sync(() => O.getOrUndefined(MutableHashMap.get(store, key)))
      ),
      storeSet: Effect.fn("FakeHost.storeSet")((key: string, value: unknown) =>
        Effect.sync(() => void MutableHashMap.set(store, key, value))
      ),
      toast: Effect.fn("FakeHost.toast")((_text: string) => Effect.void),
      sessionId: Effect.succeed("s-1"),
      now: Effect.succeed(DateTime.makeUnsafe(1_000)),
    })
  )
);

const testLayer = () => {
  const state = Layer.sync(FakeHostState)(() => ({ store: MutableHashMap.empty<string, unknown>() }));
  return timerLogLayer.pipe(Layer.provide(fakeHost), Layer.provideMerge(state));
};

const interval = TimerInterval.make({
  schemaVersion: "practice-timer/v1",
  sessionId: "s-1",
  matter: O.some(ChosenMatter.make({ reference: "10008", docketKey: "12345.10008US01", client: "12345" })),
  startedAt: DateTime.makeUnsafe(0),
  stoppedAt: DateTime.makeUnsafe(60_000),
});

describe("TimerLog", () => {
  it.layer(testLayer(), { timeout: "5 seconds" })("append and export", (it) => {
    it.effect(
      "appends encoded intervals and exports round-trippable JSON lines",
      Effect.fnUntraced(function* () {
        const log = yield* TimerLog;
        const { store } = yield* FakeHostState;
        yield* log.record(interval);
        yield* log.record(
          TimerInterval.make({
            ...interval,
            matter: O.none(),
            startedAt: DateTime.makeUnsafe(120_000),
            stoppedAt: DateTime.makeUnsafe(180_000),
          })
        );
        const rows = yield* decodeTimerIntervals(pipe(MutableHashMap.get(store, "timer-intervals"), O.getOrUndefined));
        expect(rows.length).toBe(2);
        assertSome(
          O.map(A.head(rows), (row) => row.sessionId),
          "s-1"
        );
        assertNone(O.flatMap(A.last(rows), (row) => row.matter));
        const jsonl = yield* log.exportJsonl;
        const decoded = yield* Effect.forEach(Str.split("\n")(Str.trim(jsonl)), (line) =>
          decodeTimerIntervalLine(line)
        );
        expect(decoded).toEqual(rows);
      })
    );
  });
  it.layer(testLayer(), { timeout: "5 seconds" })("empty export", (it) => {
    it.effect(
      "exports an empty log without creating an interval",
      Effect.fnUntraced(function* () {
        const log = yield* TimerLog;
        const { store } = yield* FakeHostState;
        const exportJsonl1 = yield* log.exportJsonl;
        expect(exportJsonl1).toBe("");
        assertNone(MutableHashMap.get(store, "timer-intervals"));
      })
    );
  });
  it.layer(testLayer(), { timeout: "5 seconds" })("corrupt store", (it) => {
    it.effect(
      "refuses to overwrite unreadable stored rows",
      Effect.fnUntraced(function* () {
        const log = yield* TimerLog;
        const { store } = yield* FakeHostState;
        MutableHashMap.set(store, "timer-intervals", ["broken"]);
        const error = yield* Effect.flip(log.record(interval));
        expect(error._tag).toBe("TimerStoreUnreadable");
        assertSome(MutableHashMap.get(store, "timer-intervals"), ["broken"]);
      })
    );
  });
});
