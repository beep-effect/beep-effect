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
import * as O from "effect/Option";
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
  for (let index = 0; index < values.length; index++) {
    view.setUint32(index * 4, values[index] ?? 0, true);
  }
  return bytes;
};
const absent = 0xffffffff;
const Participations = S.Array(S.Boolean)
  .check(S.isMaxLength(64))
  .pipe(
    $I.annoteSchema("Participations", {
      description: "Generated participating-empty versus unmatched capture histories.",
    })
  );
const wire = Effect.fn("RegexResultTest.wire")(function* (groups: number, matches: number, spans: string) {
  const citationResult1 = yield* encodeObject({
    _tag: "Complete",
    version: "citation-regex-result/v1",
    groups,
    matches,
    spans,
  });
  return encoder.encode(citationResult1);
});

it.effect("retains empty, unmatched and lookaround captures with Python empty-then-nonempty iteration", () =>
  Effect.gen(function* () {
    const citationResult2 = yield* defaultCitationEnginePolicy;
    const result = yield* makeCitationRegexResult(citationResult2.limits, 1, 2);
    const frame = yield* result.encode(3, words([0, 0, absent, absent, 0, 1, 1, 2, 1, 1, 1, 1]));
    const parsed = yield* result.decode(frame.slice(0, -1));
    expect(parsed.matches).toBe(3);
    expect(parsed.groups).toBe(1);
    const citationResult3 = yield* parsed.capture(0, 0);
    expect(citationResult3).toEqual({ _tag: "Range", start: 0, end: 0 });
    const citationResult4 = yield* parsed.capture(0, 1);
    expect(citationResult4).toEqual({ _tag: "Unmatched" });
    const citationResult5 = yield* parsed.capture(1, 1);
    expect(citationResult5).toEqual({ _tag: "Range", start: 1, end: 2 });
    const citationResult6 = yield* parsed.capture(2, 1);
    expect(citationResult6).toEqual({ _tag: "Range", start: 1, end: 1 });
    const citationResult7 = yield* parsed.capture(3, 0).pipe(Effect.flip);
    expect(citationResult7).toMatchObject({ reason: "invalid-frame" });
    const citationResult8 = yield* parsed.capture(0, 2).pipe(Effect.flip);
    expect(citationResult8).toMatchObject({ reason: "invalid-frame" });
    const citationResult9 = yield* parsed.capture(-1, 0).pipe(Effect.flip);
    expect(citationResult9).toMatchObject({ reason: "invalid-frame" });
  })
);

it.effect("checks contextual source points rather than projected UTF-16 lengths", () =>
  Effect.gen(function* () {
    const policy = (yield* defaultCitationEnginePolicy).limits;
    const scalar = yield* makeCitationRegexResult(policy, 0, 1);
    const literalPair = yield* makeCitationRegexResult(policy, 0, 2);
    const frame = yield* literalPair.encode(1, words([1, 2]));
    const citationResult10 = yield* scalar.decode(frame.slice(0, -1)).pipe(Effect.flip);
    expect(citationResult10).toMatchObject({ reason: "invalid-frame" });
    const decoded = yield* literalPair.decode(frame.slice(0, -1));
    const citationResult11 = yield* decoded.capture(0, 0);
    expect(citationResult11).toEqual({ _tag: "Range", start: 1, end: 2 });
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
    ]) {
      const citationResult40 = yield* result.encode(1, words(values)).pipe(Effect.flip);
      expect(citationResult40).toMatchObject({ reason: "invalid-frame" });
    }
    const whole = yield* makeCitationRegexResult(policy, 0, 3);
    for (const values of [
      [0, 2, 1, 3],
      [1, 1, 1, 1],
      [1, 2, 0, 1],
    ]) {
      const citationResult41 = yield* whole.encode(2, words(values)).pipe(Effect.flip);
      expect(citationResult41).toMatchObject({ reason: "invalid-frame" });
    }
  })
);

it.effect("enforces exact complete-frame size and raw-match limits before encoding or decoding payloads", () =>
  Effect.gen(function* () {
    const policy = (yield* defaultCitationEnginePolicy).limits;
    const normal = yield* makeCitationRegexResult(policy, 0, 1);
    const frame = yield* normal.encode(1, words([0, 1]));
    const exact = yield* makeCitationRegexResult({ ...policy, processMessageBytes: frame.byteLength }, 0, 1);
    const citationResult12 = yield* exact.encode(1, words([0, 1]));
    expect(citationResult12).toEqual(frame);
    const citationResult13 = yield* exact.decode(frame.slice(0, -1));
    expect(citationResult13.matches).toBe(1);
    const short = yield* makeCitationRegexResult({ ...policy, processMessageBytes: frame.byteLength - 1 }, 0, 1);
    const citationResult14 = yield* short.encode(1, words([0, 1])).pipe(Effect.flip);
    expect(citationResult14).toMatchObject({ limit: "processMessageBytes" });
    const citationResult15 = yield* short.decode(frame.slice(0, -1)).pipe(Effect.flip);
    expect(citationResult15).toMatchObject({ limit: "processMessageBytes" });
    const citationResult16 = yield* wire(0, 1, "INVALID");
    const citationResult17 = yield* normal.decode(citationResult16, 0).pipe(Effect.flip);
    expect(citationResult17).toMatchObject({
      limit: "patternMatches",
    });
    const empty = yield* normal.encode(0, new Uint8Array(0));
    const citationResult18 = yield* normal.decode(empty.subarray(0, -1), 0);
    expect(citationResult18.matches).toBe(0);
    const bounded = yield* makeCitationRegexResult({ ...policy, patternMatches: 1 }, 0, 1);
    const citationResult19 = yield* bounded.encode(2, new Uint8Array(0)).pipe(Effect.flip);
    expect(citationResult19).toMatchObject({ limit: "patternMatches" });
    const citationResult20 = yield* wire(0, 2, "INVALID");
    const citationResult21 = yield* bounded.decode(citationResult20).pipe(Effect.flip);
    expect(citationResult21).toMatchObject({
      limit: "patternMatches",
    });
  })
);

it.effect("rejects amplified, malformed, excess and mismatched result envelopes without exposing payloads", () =>
  Effect.gen(function* () {
    const citationResult22 = yield* defaultCitationEnginePolicy;
    const result = yield* makeCitationRegexResult(citationResult22.limits, 0, 1);
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
    const citationResult23 = yield* defaultCitationEnginePolicy;
    const result = yield* makeCitationRegexResult(citationResult23.limits, 0, 1);
    const empty = yield* result.encode(0, new Uint8Array(0));
    const citationResult24 = yield* result.decode(empty.slice(0, -1));
    expect(citationResult24.matches).toBe(0);
    const frame = yield* result.encode(1, words([0, 1]));
    const decoded = yield* result.decode(frame.slice(0, -1));
    frame.fill(0);
    const citationResult25 = yield* decoded.capture(0, 0);
    expect(citationResult25).toEqual({ _tag: "Range", start: 0, end: 1 });
    const citationResult26 = yield* S.decodeEffect(CitationRegexCapturedRange)({
      _tag: "Range",
      start: 2,
      end: 1,
    }).pipe(Effect.flip);
    expect(citationResult26).toBeDefined();
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
    const citationResult27 = yield* result
      .collect(Effect.never)
      .pipe(Effect.provideService(Clock.Clock, disabled), Effect.flip);
    expect(citationResult27).toMatchObject({ operation: "extract", limit: "operationDeadline" });
  })
);

it.effect.prop(
  "collects generated native capture histories without losing empty or unmatched groups",
  [Participations],
  ([participates]) =>
    Effect.gen(function* () {
      const citationResult28 = yield* defaultCitationEnginePolicy;
      const result = yield* makeCitationRegexResult(citationResult28.limits, 1, participates.length);
      let index = 0;
      const frame = yield* result.collect(
        Effect.sync(() => {
          if (index === participates.length) {
            return O.none();
          }
          const start = index++;
          return O.some([[start, start + 1], participates[start] === true ? [start, start] : undefined]);
        })
      );
      const decoded = yield* result.decode(frame.subarray(0, -1));
      expect(decoded.matches).toBe(participates.length);
      for (let match = 0; match < participates.length; match++) {
        const citationResult29 = yield* decoded.capture(match, 0);
        expect(citationResult29).toEqual({ _tag: "Range", start: match, end: match + 1 });
        const citationResult30 = yield* decoded.capture(match, 1);
        expect(citationResult30).toEqual(
          participates[match] === true ? { _tag: "Range", start: match, end: match } : { _tag: "Unmatched" }
        );
      }
    })
);

it.effect("rejects the next raw match before decoding its captures and allows a complete zero-match result", () =>
  Effect.gen(function* () {
    const policy = (yield* defaultCitationEnginePolicy).limits;
    const result = yield* makeCitationRegexResult({ ...policy, patternMatches: 1 }, 0, 1);
    let pulls = 0;
    const failed = yield* result
      .collect(Effect.sync(() => O.some(++pulls === 1 ? [[0, 1]] : "invalid capture data")))
      .pipe(Effect.flip);
    expect(failed).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patternMatches" });
    expect(pulls).toBe(2);
    const zero = yield* makeCitationRegexResult(policy, 0, 0);
    const citationResult31 = yield* zero.collect(Effect.succeedNone, 0);
    const citationResult32 = yield* zero.decode(citationResult31.subarray(0, -1));
    expect(citationResult32.matches).toBe(0);
    const citationResult33 = yield* zero.collect(Effect.succeedSome([[0, 0]]), 0).pipe(Effect.flip);
    expect(citationResult33).toMatchObject({
      limit: "patternMatches",
    });
  })
);

it.effect("checks the complete result ceiling before capture allocation and publishes no partial table", () =>
  Effect.gen(function* () {
    const policy = (yield* defaultCitationEnginePolicy).limits;
    const result = yield* makeCitationRegexResult(policy, 0, 1);
    const frame = yield* result.encode(1, words([0, 1]));
    const pull = () => {
      let emitted = false;
      return Effect.sync(() => {
        if (emitted) {
          return O.none();
        }
        emitted = true;
        return O.some([[0, 1]]);
      });
    };
    const exact = yield* makeCitationRegexResult({ ...policy, processMessageBytes: frame.byteLength }, 0, 1);
    const citationResult34 = yield* exact.collect(pull());
    expect(citationResult34).toEqual(frame);
    const short = yield* makeCitationRegexResult({ ...policy, processMessageBytes: frame.byteLength - 1 }, 0, 1);
    const citationResult35 = yield* short.collect(pull()).pipe(Effect.flip);
    expect(citationResult35).toMatchObject({ limit: "processMessageBytes" });
    const citationResult36 = yield* short.collect(Effect.succeedSome("malformed capture row")).pipe(Effect.flip);
    expect(citationResult36).toMatchObject({
      limit: "processMessageBytes",
    });
    let calls = 0;
    const citationResult37 = yield* result
      .collect(Effect.suspend(() => (++calls === 1 ? Effect.succeedSome([[0, 1]]) : Effect.fail("pull-failed"))))
      .pipe(Effect.flip);
    expect(citationResult37).toBe("pull-failed");
  })
);

it.effect("rejects malformed native rows and overlapping whole matches during collection", () =>
  Effect.gen(function* () {
    const citationResult38 = yield* defaultCitationEnginePolicy;
    const result = yield* makeCitationRegexResult(citationResult38.limits, 0, 2);
    for (const row of [[], [undefined], [[0, 3]], [[-1, 0]], [[0, 1, 2]], [[2, 1]], "private source"]) {
      const failed = yield* result.collect(Effect.succeedSome(row)).pipe(Effect.flip);
      expect(failed).toMatchObject({ _tag: "CitationRegexWorkerFailure", reason: "invalid-frame" });
      expect(failed.message).not.toContain("private source");
    }
    const citationResult39 = yield* result.collect(Effect.succeedSome([[0, 1]])).pipe(Effect.flip);
    expect(citationResult39).toMatchObject({
      reason: "invalid-frame",
    });
  })
);
