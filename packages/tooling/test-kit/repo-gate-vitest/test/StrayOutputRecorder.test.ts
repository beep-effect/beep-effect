// Ported from vitest-agent packages/sdk/__test__/stray-output.test.ts at 1cf1ab94 (MIT).
import { StrayOutput, StrayOutputSample } from "@beep/gate-report/StrayOutput";
import {
  isEscapeOnly,
  makeStrayOutputRecorder,
  readStrayOutput,
  STRAY_OUTPUT_SOURCE,
} from "@beep/repo-gate-vitest/internal/StrayOutputRecorder";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";

const sample = (stream: "stdout" | "stderr", text: string) => StrayOutputSample.make({ stream, text });

describe("makeStrayOutputRecorder", () => {
  it("records nothing until something is written", () => {
    assertNone(makeStrayOutputRecorder().snapshot());
  });

  it("counts lines per stream and the bytes written", () => {
    const recorder = makeStrayOutputRecorder();
    recorder.write("stderr", "one\ntwo\n");
    recorder.write("stdout", "three\n");
    assertSome(
      recorder.snapshot(),
      StrayOutput.make({
        total: 3,
        stdout: 1,
        stderr: 2,
        bytes: 14,
        samples: [sample("stderr", "one"), sample("stderr", "two"), sample("stdout", "three")],
      })
    );
  });

  it("joins a line split across writes, and keeps the streams apart", () => {
    const recorder = makeStrayOutputRecorder();
    recorder.write("stderr", "Preparing ");
    recorder.write("stdout", "out\n");
    recorder.write("stderr", "worktree\n");
    const snapshot = recorder.snapshot();
    assertSome(
      O.map(snapshot, (stray) => stray.stderr),
      1
    );
    assert.isTrue(
      O.exists(snapshot, (stray) =>
        A.some(stray.samples, (entry) => entry.stream === "stderr" && entry.text === "Preparing worktree")
      )
    );
  });

  it("counts a trailing partial line in the snapshot", () => {
    const recorder = makeStrayOutputRecorder();
    recorder.write("stderr", "no newline");
    assertSome(
      O.map(recorder.snapshot(), (stray) => [stray.total, stray.stderr, A.map(stray.samples, (entry) => entry.text)]),
      [1, 1, ["no newline"]]
    );
  });

  it("skips blank lines and strips escapes from samples", () => {
    const recorder = makeStrayOutputRecorder();
    recorder.write("stdout", "\n  \n\u001b[31mred\u001b[39m\r\n");
    assertSome(
      O.map(recorder.snapshot(), (stray) => [stray.total, stray.samples]),
      [1, [sample("stdout", "red")]]
    );
  });

  it("ignores escape-only writes (the Logger's cursor and clear-screen writes)", () => {
    const recorder = makeStrayOutputRecorder();
    recorder.write("stdout", "\u001b[?25h");
    recorder.write("stdout", "\u001bc\u001b[3J");
    recorder.write("stdout", "");
    assertNone(recorder.snapshot());
  });

  it("caps the samples and their length, but keeps counting", () => {
    const recorder = makeStrayOutputRecorder({ maxSamples: 2, maxSampleChars: 5 });
    recorder.write("stderr", `${Str.repeat(50)("x")}\nb\nc\nd\n`);
    const snapshot = recorder.snapshot();
    assertSome(
      O.map(snapshot, (stray) => stray.total),
      4
    );
    assertSome(
      O.map(snapshot, (stray) => stray.samples),
      [sample("stderr", "xxxxx…"), sample("stderr", "b")]
    );
  });

  it("bounds a line that never ends", () => {
    const recorder = makeStrayOutputRecorder({ maxSampleChars: 8 });
    A.forEach(A.range(1, 1000), () => recorder.write("stderr", "0123456789"));
    assertSome(
      O.map(recorder.snapshot(), (stray) => [stray.total, stray.bytes, A.map(stray.samples, (entry) => entry.text)]),
      [1, 10_000, ["01234567…"]]
    );
  });

  it("reset starts a new run", () => {
    const recorder = makeStrayOutputRecorder();
    recorder.write("stderr", "partial");
    recorder.reset();
    assertNone(recorder.snapshot());
    recorder.write("stderr", "next\n");
    assertSome(
      O.map(recorder.snapshot(), (stray) => stray.samples),
      [sample("stderr", "next")]
    );
  });
});

describe("isEscapeOnly", () => {
  it("is true for cursor, clear-screen and erase-scrollback escapes", () => {
    assert.isTrue(isEscapeOnly("\u001b[?25l"));
    assert.isTrue(isEscapeOnly("\u001bc\u001b[3J"));
  });

  it("is false for text, empty included", () => {
    assert.isFalse(isEscapeOnly(""));
    assert.isFalse(isEscapeOnly("\u001b[31mx"));
  });
});

describe("readStrayOutput", () => {
  const stray = StrayOutput.make({ total: 1, stdout: 1, stderr: 0, bytes: 2, samples: [] });

  it("reads the source a capture published on the logger", () => {
    assertSome(readStrayOutput({ [STRAY_OUTPUT_SOURCE]: { snapshot: () => stray } }), stray);
    assertSome(readStrayOutput({ [STRAY_OUTPUT_SOURCE]: { snapshot: () => O.some(stray) } }), stray);
  });

  it("reads a recorder published as the source", () => {
    const recorder = makeStrayOutputRecorder();
    recorder.write("stdout", "hi\n");
    assertSome(
      O.map(readStrayOutput({ [STRAY_OUTPUT_SOURCE]: recorder }), (value) => value.total),
      1
    );
  });

  it("is none when nothing was published, or the source is unusable", () => {
    assertNone(readStrayOutput({}));
    assertNone(readStrayOutput(undefined));
    assertNone(readStrayOutput({ [STRAY_OUTPUT_SOURCE]: { snapshot: "no" } }));
    assertNone(readStrayOutput({ [STRAY_OUTPUT_SOURCE]: { snapshot: () => ({ not: "stray" }) } }));
    assertNone(
      readStrayOutput({
        [STRAY_OUTPUT_SOURCE]: {
          snapshot: () => {
            throw new TypeError("broken source");
          },
        },
      })
    );
  });
});
