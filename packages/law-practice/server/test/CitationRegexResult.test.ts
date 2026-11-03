import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationRegexCapturedRange,
  makeCitationRegexResult,
} from "@beep/law-practice-server/internal/Citation/RegexResult";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const encoder = new TextEncoder();
const $I = $LawPracticeServerId.create("test/CitationRegexResult");
const JsonObjectText = S.fromJsonString(S.JsonObject).pipe(
  $I.annoteSchema("JsonObjectText", {
    description: "Synthetic closed-envelope test controls, including deliberately invalid native payloads.",
  })
);
const encodeObject = S.encodeEffect(JsonObjectText);
const words = (values: ReadonlyArray<number>) => {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index++) view.setUint32(index * 4, values[index] ?? 0, true);
  return bytes;
};
const absent = 0xffffffff;
const wire = Effect.fn("RegexResultTest.wire")(function* (groups: number, matches: number, spans: string) {
  return encoder.encode(
    yield* encodeObject({
      _tag: "Complete",
      version: "citation-regex-result/v1",
      groups,
      matches,
      spans,
    })
  );
});

it.effect("retains empty, unmatched and lookaround captures with Python empty-then-nonempty iteration", () =>
  Effect.gen(function* () {
    const result = yield* makeCitationRegexResult((yield* defaultCitationEnginePolicy).limits, 1, 2);
    const frame = yield* result.encode(3, words([0, 0, absent, absent, 0, 1, 1, 2, 1, 1, 1, 1]));
    const parsed = yield* result.decode(frame.slice(0, -1));
    expect(parsed.matches).toBe(3);
    expect(parsed.groups).toBe(1);
    expect(yield* parsed.capture(0, 0)).toEqual({ _tag: "Range", start: 0, end: 0 });
    expect(yield* parsed.capture(0, 1)).toEqual({ _tag: "Unmatched" });
    expect(yield* parsed.capture(1, 1)).toEqual({ _tag: "Range", start: 1, end: 2 });
    expect(yield* parsed.capture(2, 1)).toEqual({ _tag: "Range", start: 1, end: 1 });
    expect(yield* parsed.capture(3, 0).pipe(Effect.flip)).toMatchObject({ reason: "invalid-frame" });
    expect(yield* parsed.capture(0, 2).pipe(Effect.flip)).toMatchObject({ reason: "invalid-frame" });
    expect(yield* parsed.capture(-1, 0).pipe(Effect.flip)).toMatchObject({ reason: "invalid-frame" });
  })
);

it.effect("checks contextual source points rather than projected UTF-16 lengths", () =>
  Effect.gen(function* () {
    const policy = (yield* defaultCitationEnginePolicy).limits;
    const scalar = yield* makeCitationRegexResult(policy, 0, 1);
    const literalPair = yield* makeCitationRegexResult(policy, 0, 2);
    const frame = yield* literalPair.encode(1, words([1, 2]));
    expect(yield* scalar.decode(frame.slice(0, -1)).pipe(Effect.flip)).toMatchObject({ reason: "invalid-frame" });
    const decoded = yield* literalPair.decode(frame.slice(0, -1));
    expect(yield* decoded.capture(0, 0)).toEqual({ _tag: "Range", start: 1, end: 2 });
  })
);

it.effect("rejects invalid native words, missing groups, overlap and repeated empty matches", () =>
  Effect.gen(function* () {
    const policy = (yield* defaultCitationEnginePolicy).limits;
    const result = yield* makeCitationRegexResult(policy, 1, 3);
    for (const values of [
      [absent, absent, 0, 0],
      [0, 1, absent, 0],
      [0, 4, 0, 1],
      [2, 1, 0, 1],
      [0, 1, 2, 4],
      [0, 1],
    ])
      expect(yield* result.encode(1, words(values)).pipe(Effect.flip)).toMatchObject({ reason: "invalid-frame" });
    const whole = yield* makeCitationRegexResult(policy, 0, 3);
    for (const values of [
      [0, 2, 1, 3],
      [1, 1, 1, 1],
      [1, 2, 0, 1],
    ])
      expect(yield* whole.encode(2, words(values)).pipe(Effect.flip)).toMatchObject({ reason: "invalid-frame" });
  })
);

it.effect("enforces exact complete-frame size and raw-match limits before encoding or decoding payloads", () =>
  Effect.gen(function* () {
    const policy = (yield* defaultCitationEnginePolicy).limits;
    const normal = yield* makeCitationRegexResult(policy, 0, 1);
    const frame = yield* normal.encode(1, words([0, 1]));
    const exact = yield* makeCitationRegexResult({ ...policy, processMessageBytes: frame.byteLength }, 0, 1);
    expect(yield* exact.encode(1, words([0, 1]))).toEqual(frame);
    expect((yield* exact.decode(frame.slice(0, -1))).matches).toBe(1);
    const short = yield* makeCitationRegexResult({ ...policy, processMessageBytes: frame.byteLength - 1 }, 0, 1);
    expect(yield* short.encode(1, words([0, 1])).pipe(Effect.flip)).toMatchObject({ limit: "processMessageBytes" });
    expect(yield* short.decode(frame.slice(0, -1)).pipe(Effect.flip)).toMatchObject({ limit: "processMessageBytes" });
    const bounded = yield* makeCitationRegexResult({ ...policy, patternMatches: 1 }, 0, 1);
    expect(yield* bounded.encode(2, new Uint8Array(0)).pipe(Effect.flip)).toMatchObject({ limit: "patternMatches" });
    expect(yield* bounded.decode(yield* wire(0, 2, "INVALID")).pipe(Effect.flip)).toMatchObject({
      limit: "patternMatches",
    });
  })
);

it.effect("rejects amplified, malformed, excess and mismatched result envelopes without exposing payloads", () =>
  Effect.gen(function* () {
    const result = yield* makeCitationRegexResult((yield* defaultCitationEnginePolicy).limits, 0, 1);
    const bodies = [
      yield* wire(1, 0, ""),
      yield* wire(0, 1, ""),
      yield* wire(0, 1, "/////wAAAAA="),
      yield* wire(0, 1, "!!!!!!!!!!!!"),
      encoder.encode(
        '{"_tag":"Complete","version":"citation-regex-result/v1","groups":0,"matches":0,"spans":"","secret":"PRIVATE"}'
      ),
      encoder.encode('{"spans":{"deep":[]}}'),
      new Uint8Array([255]),
    ];
    for (const body of bodies) {
      const failure = yield* result.decode(body).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationRegexWorkerFailure", reason: "invalid-frame" });
      expect(failure.message).not.toContain("PRIVATE");
    }
  })
);

it.effect("accepts a complete zero-match result and owns decoded capture bytes", () =>
  Effect.gen(function* () {
    const result = yield* makeCitationRegexResult((yield* defaultCitationEnginePolicy).limits, 0, 1);
    const empty = yield* result.encode(0, new Uint8Array(0));
    expect((yield* result.decode(empty.slice(0, -1))).matches).toBe(0);
    const frame = yield* result.encode(1, words([0, 1]));
    const decoded = yield* result.decode(frame.slice(0, -1));
    frame.fill(0);
    expect(yield* decoded.capture(0, 0)).toEqual({ _tag: "Range", start: 0, end: 1 });
    expect(
      yield* S.decodeEffect(CitationRegexCapturedRange)({ _tag: "Range", start: 2, end: 1 }).pipe(Effect.flip)
    ).toBeDefined();
  })
);

it.effect("captures its deadline Clock and gives total-operation timing precedence on a tie", () =>
  Effect.gen(function* () {
    const policy = (yield* defaultCitationEnginePolicy).limits;
    const clock = yield* Clock.Clock;
    const immediate: Clock.Clock = { ...clock, sleep: () => Effect.void };
    const disabled: Clock.Clock = { ...clock, sleep: () => Effect.never };
    const result = yield* makeCitationRegexResult(
      {
        ...policy,
        extractDeadline: Duration.millis(10),
        operationDeadline: Duration.millis(10),
      },
      0,
      1
    ).pipe(Effect.provideService(Clock.Clock, immediate));
    const failure = yield* result
      .encode(1, words([0, 1]))
      .pipe(Effect.provideService(Clock.Clock, disabled), Effect.flip);
    expect(failure).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      operation: "extract",
      limit: "operationDeadline",
    });
  })
);
