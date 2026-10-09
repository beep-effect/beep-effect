// Adapted from upstream integration/Journal.int.test.ts (MIT).
import { Envelope, Line } from "../../effected/jsonl/index.ts";
import { NodeFileSystem } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { events, line, open } from "./fixtures.ts";

const temporary = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped();
  return { fs, path: directory + "/journal.jsonl" };
});
it.layer(NodeFileSystem.layer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
  it.effect("real concurrent writes remain complete and decode to exactly the written rounds", () =>
    Effect.gen(function* () {
      const { fs, path } = yield* temporary;
      const journal = yield* open(fs, { path });
      yield* journal.create;
      const rounds = A.range(0, 39);
      yield* Effect.forEach(rounds, (round) => journal.append("noted", { round, label: Str.repeat(200)("x") }), {
        concurrency: 8,
      });
      const text = yield* fs.readFileString(path);
      const lines = Line.split(text);
      assert.strictEqual(lines.length, rounds.length);
      assert.isTrue(A.every(lines, (line) => line.terminated));
      const decoded = Result.all(Envelope.decodeAllResult(text, events));
      assertSuccess(
        Result.map(decoded, (rows) =>
          A.sort(
            A.map(rows, (row) => (row.event === "noted" ? row.data.round : -1)),
            Order.Number
          )
        ),
        rounds
      );
    })
  );
  it.effect("foreign writes between local appends preserve physical offsets", () =>
    Effect.gen(function* () {
      const { fs, path } = yield* temporary;
      const journal = yield* open(fs, { path });
      yield* journal.create;
      const one = yield* journal.append("noted", { round: 1, label: "ours" });
      const handle = yield* fs.open(path, { flag: "a" });
      yield* handle.writeAll(new TextEncoder().encode(line(2, "theirs")));
      const three = yield* journal.append("noted", { round: 3, label: "ours" });
      const rows = yield* Stream.runCollect(journal.query({ events: ["noted"] }));
      assert.deepStrictEqual(
        A.map(rows, (row) => row.data.round),
        [1, 2, 3]
      );
      assert.strictEqual(rows[0]?.line.end, one.line.end);
      assert.strictEqual(rows[2]?.line.offset, three.line.offset);
      assert.strictEqual(rows[1]?.line.offset, one.line.end);
      assert.strictEqual(rows[1]?.line.end, three.line.offset);
    })
  );
  it.effect("an independent layer reopens the written tail and BOM offsets are logical", () =>
    Effect.gen(function* () {
      const { fs, path } = yield* temporary;
      yield* fs.writeFileString(path, "\ufeff" + line(1));
      const first = yield* open(fs, { path });
      assertSome((yield* SubscriptionRef.get(first.latest)).pipe(O.map((row) => row.line.offset)), 0);
      const appended = yield* first.append("noted", { round: 2, label: "second" });
      const second = yield* open(fs, { path });
      assertSome(yield* SubscriptionRef.get(second.latest), appended);
    })
  );
  // Native filesystem notifications require the live platform clock for a useful
  // timeout. No sleep or polling is used: the subscriber awaits the actual event.
  it.effect(
    "two real journal layers observe each other through filesystem notifications",
    () =>
      Effect.gen(function* () {
        const { fs, path } = yield* temporary;
        const writer = yield* open(fs, { path });
        yield* writer.create;
        const reader = yield* open(fs, { path });
        const observing = yield* reader
          .changes({ events: ["noted"] })
          .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
        yield* writer.append("noted", { round: 1, label: "writer" });
        assert.deepStrictEqual(
          A.map(yield* Fiber.join(observing), (row) => row.data),
          [{ round: 1, label: "writer" }]
        );
      }).pipe(Effect.timeout(Duration.seconds(10))),
    15000
  );
});
