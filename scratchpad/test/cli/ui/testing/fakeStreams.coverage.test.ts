import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { makeFakeStreams } from "../../../../effected/cli/ui/testing/fakeStreams.ts";

it.effect("terminal methods emit exact cursor bytes, callbacks, and resize both outputs", () => Effect.sync(() => {
  const observed: Array<string> = [];
  const fake = makeFakeStreams({ columns: 17, rows: 9, onStdoutWrite: (text) => observed.push(text) });
  const out = fake.streams.stdout;
  let callbacks = 0;
  const done = () => { callbacks++; };
  out.clearLine(0, done);
  out.clearScreenDown(done);
  out.cursorTo(2, done);
  out.cursorTo(2, 3, done);
  out.moveCursor(-2, 1, done);
  assert.strictEqual(fake.stdout(), "\u001b[2K\u001b[0J\u001b[3G\u001b[4;3H\u001b[2D\u001b[1B");
  assert.strictEqual(observed.join(""), fake.stdout());
  assert.deepStrictEqual(out.getWindowSize(), [17, 9]);
  let resizes = 0;
  out.on("resize", () => { resizes++; });
  fake.resize(30, 11);
  assert.deepStrictEqual(out.getWindowSize(), [30, 11]);
  assert.deepStrictEqual(fake.streams.stderr.getWindowSize(), [30, 11]);
  assert.strictEqual(resizes, 1);
  fake.streams.stderr.write("error");
  assert.strictEqual(fake.stderr(), "error");
  assert.strictEqual(fake.written(), `${fake.stdout()}error`);
  // Node schedules readline's write callbacks on the next tick.
  return () => callbacks;
}).pipe(Effect.flatMap((callbacks) => Effect.callback<void>((resume) => {
  process.nextTick(() => resume(Effect.sync(() => assert.strictEqual(callbacks(), 5))));
}))));

it.effect("vector writes stop on the first error and ignore a repeated completion", () => Effect.sync(() => {
  const out = makeFakeStreams().streams.stdout;
  const error = new Error("write failed");
  const writes: Array<string> = [];
  out._write = (chunk, _encoding, callback) => {
    writes.push(chunk.toString());
    callback(error);
    callback();
  };
  let completions = 0;
  out._writev?.([{ chunk: "first", encoding: "utf8" }, { chunk: "second", encoding: "utf8" }], (actual) => {
    assert.strictEqual(actual, error);
    completions++;
  });
  assert.deepStrictEqual(writes, ["first"]);
  assert.strictEqual(completions, 1);
}));

it.effect("input writes after end release their callback and outputs finalize", () => Effect.gen(function* () {
  const fake = makeFakeStreams();
  fake.streams.stdin.end();
  let completed = false;
  fake.streams.stdin._write("", "utf8", () => { completed = true; });
  assert.isTrue(completed);
  yield* Effect.callback<void>((resume) => { fake.streams.stdout.end(() => resume(Effect.void)); });
  assert.isTrue(fake.streams.stdout.writableFinished);
}));
