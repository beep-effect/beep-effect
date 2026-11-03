import { readCitationByteFrames } from "@beep/law-practice-server/internal/Citation/ByteFrames";
import { makeCitationRegexInput } from "@beep/law-practice-server/internal/Citation/RegexInput";
import {
  CitationRegexWorkerJob,
  decodeCitationRegexJob,
  encodeCitationRegexJob,
  makeCitationRegexJobPreparation,
  preflightCitationRegexJob,
  readCitationRegexFrames,
} from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

const utf8 = new TextEncoder();
const nothing = () => Effect.void;
const setup = Effect.fn("RegexProtocolTest.setup")(function* () {
  const input = yield* makeCitationRegexInput((yield* defaultCitationEnginePolicy).limits);
  const pattern = yield* input.prepareText("(?P<value>\\d+)", nothing);
  return { input, pattern };
});

it.effect("composes both native preparers with one complete-frame preflight and retained source maps", () =>
  Effect.gen(function* () {
    const preparation = yield* makeCitationRegexJobPreparation((yield* defaultCitationEnginePolicy).limits);
    let announced = 0;
    const plan = yield* preparation.prepare(
      { width: 2, bytes: new Uint8Array([0x35, 0xd8, 0xce, 0xdf]) },
      { width: 4, bytes: new Uint8Array([0xce, 0xd7, 1, 0]) },
      2,
      0,
      (bytes) =>
        Effect.sync(() => {
          announced = bytes;
        })
    );
    expect(announced).toBe(plan.frame.byteLength);
    expect(yield* decodeCitationRegexJob(plan.frame.slice(0, -1))).toEqual(plan.job);
    expect(plan.pattern.value.pythonLength).toBe(2);
    expect(plan.source.value.pythonLength).toBe(1);
    expect(yield* plan.pattern.project({ start: 0, end: 1 })).toEqual({ _tag: "Split", startChar: 0, endChar: 1 });
    expect(yield* plan.source.project({ start: 0, end: 1 })).toEqual({ _tag: "Range", startChar: 0, endChar: 2 });
  })
);

it.effect("keeps pattern and source budget failures distinct before allocation hooks", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const pattern = { width: 1, bytes: new Uint8Array([65, 66]) };
    const source = { width: 1, bytes: new Uint8Array([65]) };
    let called = false;
    const hook = () =>
      Effect.sync(() => {
        called = true;
      });
    const patternBound = yield* makeCitationRegexJobPreparation({ ...base, patternUtf16: 1 });
    expect(yield* patternBound.prepare(pattern, source, 0, 1, hook).pipe(Effect.flip)).toMatchObject({
      limit: "patternUtf16",
    });
    const sourceBound = yield* makeCitationRegexJobPreparation({ ...base, producedTextUtf16: 1 });
    expect(yield* sourceBound.prepare(source, pattern, 0, 1, hook).pipe(Effect.flip)).toMatchObject({
      limit: "producedTextUtf16",
    });
    expect(called).toBe(false);
  })
);

it.effect("captures the whole-job deadline across nested preflight and caller Clock replacement", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const preparation = yield* makeCitationRegexJobPreparation({ ...base, extractDeadline: Duration.millis(20) });
    const clock = yield* Clock.Clock;
    const changed: Clock.Clock = { ...clock, sleep: () => Effect.never };
    const text = { width: 1, bytes: new Uint8Array([65]) };
    const task = yield* preparation
      .prepare(text, text, 0, 1, () => Effect.never)
      .pipe(Effect.provideService(Clock.Clock, changed), Effect.forkChild);
    yield* TestClock.adjust(Duration.millis(20));
    expect(yield* Fiber.join(task).pipe(Effect.flip)).toMatchObject({ operation: "extract", limit: "extractDeadline" });
  })
);

it.effect("preserves distinct native source and pattern carriers with identical display projections", () =>
  Effect.gen(function* () {
    const { input } = yield* setup();
    const sources = [
      yield* input.prepareUnicode({ width: 2, bytes: new Uint8Array([0x35, 0xd8, 0xce, 0xdf]) }, nothing),
      yield* input.prepareUnicode({ width: 4, bytes: new Uint8Array([0xce, 0xd7, 1, 0]) }, nothing),
    ];
    expect(A.getUnsafe(sources, 0).value.text).toBe(A.getUnsafe(sources, 1).value.text);
    for (const pattern of sources)
      for (const source of sources) {
        const job = CitationRegexWorkerJob.make({
          patternWidth: pattern.layout.width,
          patternBytes: pattern.value.storage.bytes,
          sourceWidth: source.layout.width,
          sourceBytes: source.value.storage.bytes,
          flags: 2,
          maxMatches: 0,
        });
        const frame = yield* encodeCitationRegexJob(job, 4096);
        expect(yield* preflightCitationRegexJob(pattern.layout, source.layout, 2, 0, frame.byteLength)).toBe(
          frame.byteLength
        );
        expect(yield* decodeCitationRegexJob(frame.slice(0, -1))).toEqual(job);
        expect(yield* encodeCitationRegexJob(job, frame.byteLength)).toEqual(frame);
        expect(yield* encodeCitationRegexJob(job, frame.byteLength - 1).pipe(Effect.flip)).toMatchObject({
          operation: "extract",
          limit: "processMessageBytes",
        });
      }
  })
);

it.effect("charges both base64 residues and the full envelope before payload encoding", () =>
  Effect.gen(function* () {
    const { input, pattern } = yield* setup();
    for (let length = 0; length < 40; length++) {
      const source = yield* input.prepareText(Str.repeat(length)("A"), nothing);
      const job = CitationRegexWorkerJob.make({
        patternWidth: pattern.layout.width,
        patternBytes: pattern.value.storage.bytes,
        sourceWidth: source.layout.width,
        sourceBytes: source.value.storage.bytes,
        flags: 0,
        maxMatches: 123,
      });
      const frame = yield* encodeCitationRegexJob(job, 4096);
      expect(yield* preflightCitationRegexJob(pattern.layout, source.layout, 0, 123, frame.byteLength)).toBe(
        frame.byteLength
      );
      expect(
        yield* preflightCitationRegexJob(pattern.layout, source.layout, 0, 123, frame.byteLength - 1).pipe(Effect.flip)
      ).toMatchObject({ limit: "processMessageBytes" });
      expect((yield* decodeCitationRegexJob(frame.slice(0, -1))).sourceBytes).toEqual(source.value.storage.bytes);
    }
  })
);

it.effect("handles every split and one-byte input fragments without accepting partial or extra frames", () =>
  Effect.gen(function* () {
    const { input, pattern } = yield* setup();
    const source = yield* input.prepareText("A😀B", nothing);
    const job = CitationRegexWorkerJob.make({
      patternWidth: pattern.layout.width,
      patternBytes: pattern.value.storage.bytes,
      sourceWidth: source.layout.width,
      sourceBytes: source.value.storage.bytes,
      flags: 0,
      maxMatches: 1,
    });
    const bytes = yield* encodeCitationRegexJob(job, 4096);
    const collect = Effect.fn("RegexProtocolTest.collect")(function* (chunks: ReadonlyArray<Uint8Array>) {
      let result = A.empty<CitationRegexWorkerJob>();
      yield* readCitationRegexFrames(Stream.fromIterable(chunks), bytes.byteLength, 1, (frame) =>
        Effect.gen(function* () {
          result = A.append(result, yield* decodeCitationRegexJob(frame));
        })
      );
      return result;
    });
    for (let index = 0; index <= bytes.byteLength; index++)
      expect(yield* collect([bytes.slice(0, index), bytes.slice(index)])).toEqual([job]);
    expect(yield* collect(A.map(A.fromIterable(bytes), (byte) => new Uint8Array([byte])))).toEqual([job]);
    expect(yield* collect([bytes.slice(0, -1)]).pipe(Effect.flip)).toMatchObject({ reason: "invalid-frame" });
    expect(yield* collect([bytes, utf8.encode("extra")]).pipe(Effect.flip)).toMatchObject({ reason: "invalid-frame" });
    expect(
      yield* readCitationRegexFrames(Stream.make(new Uint8Array(1000).fill(65)), 99, 1, nothing).pipe(Effect.flip)
    ).toMatchObject({ operation: "extract", limit: "processMessageBytes" });
  })
);

it.effect("rejects structural amplification, malformed UTF-8, unknown fields and invalid encoded carriers", () =>
  Effect.gen(function* () {
    const header =
      '"_tag":"Evaluate","version":"citation-regex-worker/v1","patternWidth":1,"patternBytes":"YQ==","sourceWidth":1,"sourceBytes":"Yg==","flags":0,"maxMatches":1';
    for (const bytes of [
      utf8.encode(Str.repeat(20000)("[") + Str.repeat(20000)("]")),
      utf8.encode(`{${header},"callback":"private source"}`),
      utf8.encode(`{${header},"sourceBytes":{"nested":0}}`),
      utf8.encode(`{${Str.replace('"sourceBytes":"Yg=="', '"sourceBytes":"!"')(header)}}`),
      utf8.encode(`{${Str.replace('"flags":0', '"flags":8')(header)}}`),
      utf8.encode(`{${Str.replace('"version":"citation-regex-worker/v1"', '"version":"unknown"')(header)}}`),
      utf8.encode(`{${Str.replace('"version":"citation-regex-worker/v1",', "")(header)}}`),
      utf8.encode(`{${Str.replace('"patternBytes":"YQ=="', `"patternBytes":"${Str.repeat(43692)("A")}"`)(header)}}`),
      utf8.encode(`{${Str.slice(0, -1)(header)}`),
      new Uint8Array([255]),
    ])
      expect(yield* decodeCitationRegexJob(bytes).pipe(Effect.flip)).toMatchObject({ reason: "invalid-frame" });
  })
);

it.effect("runs complete-job preflight while both receiving payloads are still unallocated", () =>
  Effect.gen(function* () {
    const { input, pattern } = yield* setup();
    let sourceFinished = false;
    let patternFinished = false;
    const run = input
      .prepareText("(?P<value>\\d+)", (patternLayout) =>
        input
          .prepareText("123", (sourceLayout) =>
            preflightCitationRegexJob(patternLayout, sourceLayout, 0, 10, 1).pipe(Effect.asVoid)
          )
          .pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                sourceFinished = true;
              })
            ),
            Effect.asVoid
          )
      )
      .pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            patternFinished = true;
          })
        )
      );
    expect(yield* run.pipe(Effect.flip)).toMatchObject({ operation: "extract", limit: "processMessageBytes" });
    expect(sourceFinished).toBe(false);
    expect(patternFinished).toBe(false);
    expect(
      yield* preflightCitationRegexJob(pattern.layout, pattern.layout, 8, 1, 4096).pipe(Effect.flip)
    ).toMatchObject({ reason: "invalid-frame" });
  })
);

it.effect("maps stream failures without leaking their original payload", () =>
  Effect.gen(function* () {
    expect(
      yield* readCitationByteFrames(
        Stream.fail("private source"),
        100,
        1,
        nothing,
        () => "invalid",
        () => "limit",
        () => "channel"
      ).pipe(Effect.flip)
    ).toBe("channel");
  })
);
