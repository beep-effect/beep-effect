// Adapted from upstream Envelope.test.ts (MIT), using value-first dual codecs.
import {
  Envelope,
  InvalidData,
  JsonlEvent,
  Line,
  MalformedLine,
  UnknownEvent,
  UnserializableData,
} from "../../effected/jsonl/index.ts";
import type { EnvelopeInput } from "../../effected/jsonl/Envelope.ts";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertFailure, assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";

const at = DateTime.makeUnsafe("2026-08-03T17:04:11.912Z");
const Payload = S.Struct({ round: S.Finite, from: S.String });
const Mail = JsonlEvent.make("mail", { data: Payload });
const End = JsonlEvent.make("end", { data: S.Void, terminal: true });
const events = Tuple.make(Mail, End);
const line = (text: string) => O.getOrThrow(A.head(Line.split(text)));
const text = (round: number) =>
  `{"at":"2026-08-03T17:04:11.912Z","event":"mail","data":{"round":${round},"from":"silk"}}`;
const encodeUnknown = S.encodeResult(S.fromJsonString(S.Unknown));

describe("Envelope boundaries", () => {
  it("preserves schema ownership, flags and registry identity", () => {
    assert.strictEqual(Mail.data, Payload);
    assert.isFalse(Mail.terminal);
    assert.isFalse(Mail.reopen);
    assert.isTrue(End.terminal);
    const mutable = [Mail];
    const registry = Envelope.registry(mutable);
    assertSuccess(
      Result.map(Envelope.decodeResult(line(text(1)), registry), (row) => row.data),
      { round: 1, from: "silk" }
    );
    mutable.pop();
    assert.deepStrictEqual(registry.events, [Mail]);
    assertSuccess(
      Result.map(Envelope.decodeResult(line(text(2)), registry), (row) => row.data),
      { round: 2, from: "silk" }
    );
  });
  it("validates only the frame before selection", () => {
    const source = line('{"at":"2026-08-03T17:04:11.912Z","event":"mail","data":{"round":"bad"}}');
    assertSuccess(
      Result.map(Envelope.frameResult(source), (frame) => frame.data),
      { round: "bad" }
    );
    assertNone(Envelope.decodeSelectedResult(source, events, () => false));
    const selected = Envelope.decodeSelectedResult(source, events, () => true);
    assertSome(
      O.map(selected, (result) =>
        result.pipe(
          Result.getFailure,
          O.map((error) => error._tag),
          O.getOrThrow
        )
      ),
      "InvalidData"
    );
  });
  it("keeps date and omission semantics", () => {
    const decoded = Envelope.frameResult(line(text(1)));
    assertSuccess(
      Result.map(decoded, (frame) => DateTime.formatIso(frame.at)),
      DateTime.formatIso(at)
    );
    assert.isFalse(P.hasProperty(Result.getOrThrow(decoded), "scope"));
    const scoped = Str.replace('"event"', '"scope":"mailbox","event"')(text(1));
    assertSuccess(
      Result.map(Envelope.frameResult(line(scoped)), (frame) => frame.scope),
      "mailbox"
    );
  });
  it("does not traverse deeply nested unknown data at the frame boundary", () => {
    const deep = Str.repeat(20000)("[") + "1" + Str.repeat(20000)("]");
    const source = line(`{"at":"2026-08-03T17:04:11.912Z","event":"mail","data":${deep}}`);
    assertSuccess(
      Result.map(Envelope.frameResult(source), (frame) => frame.event),
      "mail"
    );
  });
  it("retains typed error details for malformed lines, foreign events and invalid data", () => {
    const malformed = line("{bad");
    assertFailure(Envelope.frameResult(malformed), MalformedLine.make({ line: malformed }));
    const foreign = line(Str.replace('"mail"', '"foreign"')(text(1)));
    assertFailure(
      Envelope.decodeResult(foreign, events),
      UnknownEvent.make({ line: foreign, event: "foreign", known: ["mail", "end"] })
    );
    const invalid = Envelope.decodeResult(line(Str.replace('"round":1', '"round":"bad"')(text(1))), events);
    const error = invalid.pipe(Result.getFailure, O.getOrThrow);
    assertFailure(invalid, error);
    assert.instanceOf(error, InvalidData);
    if (!S.is(InvalidData)(error)) return assert.fail("expected InvalidData");
    assertSome(error.event, "mail");
    assert.isDefined(error.error.issue);
    const frameError = Envelope.frameResult(line("{}")).pipe(Result.getFailure, O.getOrThrow);
    assert.instanceOf(frameError, InvalidData);
    if (!S.is(InvalidData)(frameError)) return assert.fail("expected InvalidData");
    assertNone(frameError.event);
  });
  it.each(["__proto__", "constructor", "prototype", "__defineGetter__"])("ignores hostile envelope key %s", (key) => {
    const source = line(Str.replace('"event"', `"${key}":{"polluted":true},"event"`)(text(1)));
    const decoded = Envelope.decodeResult(source, events);
    assertSuccess(
      Result.map(decoded, (row) => row.data),
      { round: 1, from: "silk" }
    );
    assert.isUndefined(Reflect.get(Result.getOrThrow(decoded), "polluted"));
    assert.isUndefined(Reflect.get({}, "polluted"));
  });
  it("ignores hostile payload keys and preserves escaped control characters", () => {
    const source = line(
      Str.replace('"from":"silk"', '"from":"a\\u0000b\\u001fc","__proto__":{"polluted":true}')(text(1))
    );
    const decoded = Envelope.decodeResult(source, events);
    assertSuccess(
      Result.map(decoded, (row) => row.data),
      { round: 1, from: "a\u0000b\u001fc" }
    );
    assert.isUndefined(Reflect.get({}, "polluted"));
  });
  for (const shape of [
    "{bad",
    "null",
    "42",
    '"text"',
    "[]",
    "{}",
    '{"event":"mail"}',
    '{"at":"bad","event":"mail","data":{}}',
  ]) {
    it.effect(`fails typed for hostile shape ${shape}`, () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(Envelope.decode(line(shape), events));
        const error = exit.pipe(Exit.findErrorOption, O.getOrThrow);
        assertExitFailure(
          exit,
          Cause.annotate(
            Cause.fail(error),
            Exit.match(exit, { onFailure: Cause.annotations, onSuccess: Context.empty })
          )
        );
      })
    );
  }
  it.each(["{", "4", '{"at":"2026-08-03T17:04:11.912Z","event":"foreign","data":null}'])(
    "walks back past %s",
    (tail) => {
      const source = `${text(1)}\n${text(2)}\n${tail}`;
      assertSome(
        O.map(Envelope.lastValidResult(source, events), (row) => row.data),
        { round: 2, from: "silk" }
      );
    }
  );
  it("reports bad interior lines and has no tail when no envelope is valid", () => {
    const rows = Envelope.decodeAllResult(`${text(1)}\nbad\n${text(2)}\n`, events);
    assert.strictEqual(rows.length, 3);
    const [one, bad, two] = rows;
    assert.isDefined(one);
    assert.isDefined(bad);
    assert.isDefined(two);
    assertSuccess(
      Result.map(one, (row) => row.data),
      { round: 1, from: "silk" }
    );
    assertFailure(
      Result.mapError(bad, (error) => error._tag),
      "MalformedLine"
    );
    assertSuccess(
      Result.map(two, (row) => row.data),
      { round: 2, from: "silk" }
    );
    assertNone(Envelope.lastValidResult("4\nnull\n{}\n", events));
  });
  it("encodes a complete terminated line and round-trips scope", () => {
    assertSuccess(
      Envelope.encodeResult({ at, event: "mail", data: { round: 7, from: "silk" } }, events),
      text(7) + "\n"
    );
    const encoded = Result.getOrThrow(
      Envelope.encodeResult({ at, event: "mail", scope: "box", data: { round: 7, from: "silk" } }, events)
    );
    assertSuccess(
      Result.map(Envelope.decodeResult(line(encoded), events), (row) => row.scope),
      "box"
    );
  });
  it("round-trips void using JSON null and omits scope", () => {
    const encoded = Envelope.encodeResult({ at, event: "end", data: undefined }, events);
    assertSuccess(encoded, '{"at":"2026-08-03T17:04:11.912Z","event":"end","data":null}\n');
    assertSuccess(
      Result.map(encoded.pipe(Result.getOrThrow, line, Envelope.decodeResult(events)), (row) => row.data),
      undefined
    );
  });
  for (const kind of ["bigint", "circular"]) {
    it.effect(`lazily reports ${kind} serialization as a typed failure`, () =>
      Effect.gen(function* () {
        const cycle: Record<string, unknown> = { name: "loop" };
        cycle.self = cycle;
        const data = kind === "bigint" ? { n: 1n } : cycle;
        const unknownEvents = Tuple.make(JsonlEvent.make("unknown", { data: S.Unknown }));
        const program = Envelope.encode({ at, event: "unknown", data }, unknownEvents);
        const exit = yield* Effect.exit(program);
        const error = exit.pipe(Exit.findErrorOption, O.getOrThrow);
        assertExitFailure(
          exit,
          Cause.annotate(
            Cause.fail(error),
            Exit.match(exit, { onFailure: Cause.annotations, onSuccess: Context.empty })
          )
        );
        assert.strictEqual(error._tag, "UnserializableData");
        assert.include(error.message, "unknown");
        assert.notInclude(error.message, "loop");
        // Adjusts upstream's `cause instanceOf TypeError`: the JSON codec's SchemaError is the cause (D20).
        if (!S.is(UnserializableData)(error)) return assert.fail("expected UnserializableData");
        if (!S.isSchemaError(error.cause)) return assert.fail("expected the JSON codec's SchemaError as the cause");
        assert.strictEqual(error.cause.message, "Expected a JSON-serializable value");
        assert.strictEqual(
          error.message,
          'cannot serialize payload for event "unknown": Expected a JSON-serializable value'
        );
      })
    );
  }
  it("builds external JSON fixtures through schema codecs", () => {
    assertSuccess(encodeUnknown({ n: 1 }), '{"n":1}');
  });
});

describe("encoder validation boundaries", () => {
  it("reports an unregistered tag without attempting payload encoding", () => {
    const registry: JsonlEvent.Registry = Tuple.make(Mail);
    const encoded = Envelope.encodeResult({ at, event: "missing", data: null }, registry);
    assertFailure(
      Result.mapError(encoded, (error) => error._tag),
      "UnknownEvent"
    );
  });
  it("rejects invalid payloads introduced by an untyped caller", () => {
    const input: EnvelopeInput<"mail", typeof Payload.Type> = { at, event: "mail", data: { round: 7, from: "silk" } };
    Reflect.set(input.data, "round", "invalid");
    assertFailure(
      Result.mapError(Envelope.encodeResult(input, events), (error) => error._tag),
      "InvalidData"
    );
  });
  it("rejects an untyped scope before emitting an unreadable wire frame", () => {
    const result: unknown = Reflect.apply(Envelope.encodeResult, undefined, [
      { at, event: "mail", scope: 42, data: { round: 7, from: "silk" } },
      events,
    ]);
    if (!Result.isResult(result) || !Result.isFailure(result) || !S.is(InvalidData)(result.failure))
      return assert.fail("expected the input codec to report InvalidData");
    assertSome(result.failure.event, "mail");
    assert.strictEqual(result.failure.line.text, "");
    assert.strictEqual(result.failure.line.offset, 0);
    assert.isDefined(result.failure.error.issue);
  });
  it("treats an explicitly undefined scope as an omitted one, as upstream does", () => {
    const encoded = Envelope.encodeResult(
      { at, event: "mail", scope: undefined, data: { round: 7, from: "silk" } },
      events
    );
    assertSuccess(encoded, text(7) + "\n");
    assertSuccess(
      Envelope.encodeResult({ at, event: "end", scope: undefined, data: undefined }, events),
      '{"at":"2026-08-03T17:04:11.912Z","event":"end","data":null}\n'
    );
    const decoded = encoded.pipe(Result.getOrThrow, line, Envelope.decodeResult(events), Result.getOrThrow);
    assert.isFalse(P.hasProperty(decoded, "scope"));
  });
  it("rejects invalid timestamps introduced by an untyped caller", () => {
    const input: EnvelopeInput<"mail", typeof Payload.Type> = { at, event: "mail", data: { round: 7, from: "silk" } };
    Reflect.set(input, "at", "invalid");
    assertFailure(
      Result.mapError(Envelope.encodeResult(input, events), (error) => error._tag),
      "InvalidData"
    );
  });
  it("walks back over blank lines after the last valid envelope", () => {
    assertSome(
      O.map(Envelope.lastValidResult(text(1) + "\n \n", events), (row) => row.data),
      { round: 1, from: "silk" }
    );
  });
});

it("returns malformed frame errors before applying selection", () => {
  const selected = Envelope.decodeSelectedResult(line("{"), events, () => false);
  assertSome(
    selected.pipe(
      O.flatMap(Result.getFailure),
      O.map((error) => error._tag)
    ),
    "MalformedLine"
  );
});
