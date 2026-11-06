import { readCitationByteFrames } from "@beep/law-practice-server/internal/Citation/ByteFrames";
import { makeCitationRegexInput } from "@beep/law-practice-server/internal/Citation/RegexInput";
import { callCitationRegexRpc } from "@beep/law-practice-server/internal/Citation/RegexWorkerClient";
import {
  CitationRegexMatchMode,
  CitationRegexWorkerJob,
  decodeCitationRegexJob,
  encodeCitationRegexJob,
  makeCitationRegexJobPreparation,
  preflightCitationRegexJob,
  preflightCitationRegexJson,
  readCitationRegexFrames,
} from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import {
  CitationRegexWorkerStarted,
  encodeCitationRegexControl,
} from "@beep/law-practice-server/internal/Citation/RegexWorkerRpc";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

const utf8 = new TextEncoder();
const nothing = () => Effect.void;
const setup = Effect.fn("RegexProtocolTest.setup")(function* () {
  const citationResult1 = yield* defaultCitationEnginePolicy;
  const input = yield* makeCitationRegexInput(citationResult1.limits);
  const pattern = yield* input.prepareText("(?P<value>\\d+)", nothing);
  return { input, pattern };
});

it.effect("composes both native preparers with one complete-frame preflight and retained source maps", () =>
  Effect.gen(function* () {
    const citationResult2 = yield* defaultCitationEnginePolicy;
    const preparation = yield* makeCitationRegexJobPreparation(citationResult2.limits);
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
    const citationResult3 = yield* decodeCitationRegexJob(plan.frame.slice(0, -1));
    expect(citationResult3).toEqual(plan.job);
    expect(plan.pattern.value.pythonLength).toBe(2);
    expect(plan.source.value.pythonLength).toBe(1);
    const citationResult4 = yield* plan.pattern.project({ start: 0, end: 1 });
    expect(citationResult4).toEqual({ _tag: "Split", startChar: 0, endChar: 1 });
    const citationResult5 = yield* plan.source.project({ start: 0, end: 1 });
    expect(citationResult5).toEqual({ _tag: "Range", startChar: 0, endChar: 2 });
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
    const citationResult6 = yield* patternBound.prepare(pattern, source, 0, 1, hook).pipe(Effect.flip);
    expect(citationResult6).toMatchObject({
      limit: "patternUtf16",
    });
    const sourceBound = yield* makeCitationRegexJobPreparation({ ...base, producedTextUtf16: 1 });
    const citationResult7 = yield* sourceBound.prepare(source, pattern, 0, 1, hook).pipe(Effect.flip);
    expect(citationResult7).toMatchObject({
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
    const citationResult8 = yield* Fiber.join(task).pipe(Effect.flip);
    expect(citationResult8).toMatchObject({ operation: "extract", limit: "extractDeadline" });
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
    for (const pattern of sources) {
      for (const source of sources) {
        const job = CitationRegexWorkerJob.make({
          mode: "finditer",
          patternWidth: pattern.layout.width,
          patternBytes: pattern.value.storage.bytes,
          sourceWidth: source.layout.width,
          sourceBytes: source.value.storage.bytes,
          flags: 2,
          maxMatches: 0,
        });
        const frame = yield* encodeCitationRegexJob(job, 4096);
        const citationResult9 = yield* preflightCitationRegexJob(pattern.layout, source.layout, 2, 0, frame.byteLength);
        expect(citationResult9).toBe(frame.byteLength);
        const citationResult10 = yield* decodeCitationRegexJob(frame.slice(0, -1));
        expect(citationResult10).toEqual(job);
        const citationResult11 = yield* encodeCitationRegexJob(job, frame.byteLength);
        expect(citationResult11).toEqual(frame);
        const citationResult12 = yield* encodeCitationRegexJob(job, frame.byteLength - 1).pipe(Effect.flip);
        expect(citationResult12).toMatchObject({
          operation: "extract",
          limit: "processMessageBytes",
        });
      }
    }
  })
);

it.effect("charges both base64 residues and the full envelope before payload encoding", () =>
  Effect.gen(function* () {
    const { input, pattern } = yield* setup();
    for (let length = 0; length < 40; length++) {
      const source = yield* input.prepareText(Str.repeat(length)("A"), nothing);
      const job = CitationRegexWorkerJob.make({
        mode: "finditer",
        patternWidth: pattern.layout.width,
        patternBytes: pattern.value.storage.bytes,
        sourceWidth: source.layout.width,
        sourceBytes: source.value.storage.bytes,
        flags: 0,
        maxMatches: 123,
      });
      const frame = yield* encodeCitationRegexJob(job, 4096);
      const citationResult13 = yield* preflightCitationRegexJob(
        pattern.layout,
        source.layout,
        0,
        123,
        frame.byteLength
      );
      expect(citationResult13).toBe(frame.byteLength);
      const citationResult14 = yield* preflightCitationRegexJob(
        pattern.layout,
        source.layout,
        0,
        123,
        frame.byteLength - 1
      ).pipe(Effect.flip);
      expect(citationResult14).toMatchObject({ limit: "processMessageBytes" });
      const citationResult15 = yield* decodeCitationRegexJob(frame.slice(0, -1));
      expect(citationResult15.sourceBytes).toEqual(source.value.storage.bytes);
    }
  })
);

it.effect("handles every split and one-byte input fragments without accepting partial or extra frames", () =>
  Effect.gen(function* () {
    const { input, pattern } = yield* setup();
    const source = yield* input.prepareText("A😀B", nothing);
    const job = CitationRegexWorkerJob.make({
      mode: "finditer",
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
          const citationResult16 = yield* decodeCitationRegexJob(frame);
          result = A.append(result, citationResult16);
        })
      );
      return result;
    });
    for (let index = 0; index <= bytes.byteLength; index++) {
      const citationResult28 = yield* collect([bytes.slice(0, index), bytes.slice(index)]);
      expect(citationResult28).toEqual([job]);
    }
    const citationResult17 = yield* collect(A.map(A.fromIterable(bytes), (byte) => new Uint8Array([byte])));
    expect(citationResult17).toEqual([job]);
    const citationResult18 = yield* collect([bytes.slice(0, -1)]).pipe(Effect.flip);
    expect(citationResult18).toMatchObject({ reason: "invalid-frame" });
    const citationResult19 = yield* collect([bytes, utf8.encode("extra")]).pipe(Effect.flip);
    expect(citationResult19).toMatchObject({ reason: "invalid-frame" });
    const citationResult20 = yield* readCitationRegexFrames(
      Stream.make(new Uint8Array(1000).fill(65)),
      99,
      1,
      nothing
    ).pipe(Effect.flip);
    expect(citationResult20).toMatchObject({ operation: "extract", limit: "processMessageBytes" });
  })
);

it.effect("preflights the exact frame for each mode and rejects unknown modes before reservation", () =>
  Effect.gen(function* () {
    const citationResult21 = yield* defaultCitationEnginePolicy;
    const preparation = yield* makeCitationRegexJobPreparation(citationResult21.limits);
    const input = { width: 1, bytes: utf8.encode("b") };
    for (const mode of CitationRegexMatchMode.literals) {
      const prepared = yield* preparation.prepare(input, input, 0, 1, nothing, mode);
      const count = yield* preflightCitationRegexJob(
        prepared.pattern.layout,
        prepared.source.layout,
        0,
        1,
        prepared.frame.byteLength,
        mode
      );
      expect(count).toBe(prepared.frame.byteLength);
      const citationResult22 = yield* decodeCitationRegexJob(prepared.frame.subarray(0, -1));
      expect(citationResult22.mode).toBe(mode);
      const citationResult23 = yield* preflightCitationRegexJob(
        prepared.pattern.layout,
        prepared.source.layout,
        0,
        1,
        count - 1,
        mode
      ).pipe(Effect.flip);
      expect(citationResult23).toMatchObject({ limit: "processMessageBytes" });
    }
    let reserved = false;
    const citationResult24 = yield* preparation
      .prepare(
        input,
        input,
        0,
        1,
        () =>
          Effect.sync(() => {
            reserved = true;
          }),
        "unknown"
      )
      .pipe(Effect.flip);
    expect(citationResult24).toMatchObject({ reason: "invalid-frame" });
    expect(reserved).toBe(false);
  })
);

it.effect("rejects structural amplification, malformed UTF-8, unknown fields and invalid encoded carriers", () =>
  Effect.gen(function* () {
    const header =
      '"_tag":"Evaluate","version":"citation-regex-worker/v2","patternWidth":1,"patternBytes":"YQ==","sourceWidth":1,"sourceBytes":"Yg==","flags":0,"maxMatches":1,"mode":"finditer"';
    for (const bytes of [
      utf8.encode(Str.repeat(20000)("[") + Str.repeat(20000)("]")),
      utf8.encode(`{${header},"callback":"private source"}`),
      utf8.encode(`{${Str.replace('"mode":"finditer"', '"mode":"unknown"')(header)}}`),
      utf8.encode(`{${Str.replace(',"mode":"finditer"', "")(header)}}`),
      utf8.encode(
        `{${Str.replace('"version":"citation-regex-worker/v2"', '"version":"citation-regex-worker/v1"')(header)}}`
      ),
      utf8.encode(`{${header},"sourceBytes":{"nested":0}}`),
      utf8.encode(`{${Str.replace('"sourceBytes":"Yg=="', '"sourceBytes":"!"')(header)}}`),
      utf8.encode(`{${Str.replace('"flags":0', '"flags":8')(header)}}`),
      utf8.encode(`{${Str.replace('"version":"citation-regex-worker/v2"', '"version":"unknown"')(header)}}`),
      utf8.encode(`{${Str.replace('"version":"citation-regex-worker/v2",', "")(header)}}`),
      utf8.encode(`{${Str.replace('"patternBytes":"YQ=="', `"patternBytes":"${Str.repeat(43692)("A")}"`)(header)}}`),
      utf8.encode(`{${Str.slice(0, -1)(header)}`),
      new Uint8Array([255]),
    ]) {
      const citationResult29 = yield* decodeCitationRegexJob(bytes).pipe(Effect.flip);
      expect(citationResult29).toMatchObject({ reason: "invalid-frame" });
    }
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
    const citationResult25 = yield* run.pipe(Effect.flip);
    expect(citationResult25).toMatchObject({ operation: "extract", limit: "processMessageBytes" });
    expect(sourceFinished).toBe(false);
    expect(patternFinished).toBe(false);
    const citationResult26 = yield* preflightCitationRegexJob(pattern.layout, pattern.layout, 8, 1, 4096).pipe(
      Effect.flip
    );
    expect(citationResult26).toMatchObject({ reason: "invalid-frame" });
  })
);

it.effect("maps stream failures without leaking their original payload", () =>
  Effect.gen(function* () {
    const citationResult27 = yield* readCitationByteFrames(
      Stream.fail("private source"),
      100,
      1,
      nothing,
      () => "invalid",
      () => "limit",
      () => "channel"
    ).pipe(Effect.flip);
    expect(citationResult27).toBe("channel");
  })
);

it.effect("rejects malformed preparation inputs and closes platform stream failures", () =>
  Effect.gen(function* () {
    const invalidPolicy = yield* makeCitationRegexJobPreparation(null).pipe(Effect.flip);
    expect(invalidPolicy).toMatchObject({ reason: "invalid-runtime" });
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const preparation = yield* makeCitationRegexJobPreparation(limits);
    const invalidSource = yield* preparation
      .prepare({ width: 1, bytes: utf8.encode("a") }, null, 0, 1, () =>
        Effect.die("Malformed source must fail before allocation")
      )
      .pipe(Effect.flip);
    expect(invalidSource).toMatchObject({ reason: "invalid-frame" });
    const broken = yield* readCitationRegexFrames(
      Stream.fail(
        PlatformError.systemError({ module: "Stdio", method: "stdin", _tag: "Unknown", cause: "private-source" })
      ),
      100,
      1,
      nothing
    ).pipe(Effect.flip);
    expect(broken).toMatchObject({ reason: "channel-failed" });
    expect("cause" in broken).toBe(false);
  })
);

it.effect("rejects out-of-order RPC controls and does not retry failed writes", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const preparation = yield* makeCitationRegexJobPreparation(limits);
    const native = { width: 1, bytes: utf8.encode("a") };
    const { job, frame } = yield* preparation.prepare(native, native, 0, 1, nothing);
    const wrongOrder = yield* encodeCitationRegexControl(
      CitationRegexWorkerStarted.make({}),
      limits.processMessageBytes
    );
    const invalid = yield* callCitationRegexRpc(
      { stdin: Sink.drain, stdout: Stream.make(wrongOrder) },
      job,
      frame,
      limits.processMessageBytes
    ).pipe(Effect.flip);
    expect(invalid).toMatchObject({ reason: "invalid-frame" });
    let sends = 0;
    const failed = yield* callCitationRegexRpc(
      {
        stdout: Stream.never,
        stdin: Sink.forEach(() =>
          Effect.gen(function* () {
            sends++;
            return yield* PlatformError.badArgument({ module: "test", method: "stdin", description: "private-source" });
          })
        ),
      },
      job,
      frame,
      limits.processMessageBytes
    ).pipe(Effect.flip);
    expect(failed).toMatchObject({ reason: "channel-failed" });
    expect("cause" in failed).toBe(false);
    expect(sends).toBe(1);
  })
);

it.effect("checks the absolute pattern ceiling even when handed a valid source-role layout", () =>
  Effect.gen(function* () {
    const { input, pattern } = yield* setup();
    const policy = yield* defaultCitationEnginePolicy;
    const wide = yield* input.prepareText(Str.repeat(8193)("a"), nothing);
    const failure = yield* preflightCitationRegexJob(
      wide.layout,
      pattern.layout,
      0,
      1,
      policy.limits.processMessageBytes
    ).pipe(Effect.flip);
    expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patternUtf16" });
  })
);

it.effect("keeps escaped delimiters inside JSON strings and rejects an unmatched closing object", () =>
  Effect.gen(function* () {
    const text = yield* S.encodeEffect(S.fromJsonString(S.Struct({ message: S.String })))({
      message: 'quote " slash \\ } : {',
    });
    yield* preflightCitationRegexJson(utf8.encode(text), 1);
    const failure = yield* preflightCitationRegexJson(utf8.encode("}"), 1).pipe(Effect.flip);
    expect(failure).toMatchObject({ _tag: "CitationRegexWorkerFailure", reason: "invalid-frame" });
  })
);
