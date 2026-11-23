import { fcRuns } from "@beep/fc-runs";
import {
  AppendOptions,
  ByteCount,
  CursoredSlice,
  Envelope,
  EnvelopeFrame,
  InvalidData,
  InvalidJournalConfig,
  InvalidSlice,
  InvalidUtf8,
  JournalClosed,
  JournalConfig,
  JournalNotFound,
  JournalResync,
  JournalResyncReason,
  JournalUnterminated,
  JournalWriteConflict,
  JsonlError,
  JsonlEvent,
  JsonlEventTypeId,
  Line,
  LineSlice,
  MalformedLine,
  ParsedLine,
  Slice,
  TerminalViolation,
  UnknownEvent,
  UnserializableData,
} from "@beep/jsonl";
import { SampledRange } from "@beep/jsonl/internal/tail";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { Ended, Noted, Reopened } from "./fixtures.ts";

// decision: tests-prop-array-form
const runs = { arbitrary: fcRuns(100) };
const encoder = new TextEncoder();
const textEncoderByteLength = (text: string): number => encoder.encode(text).length;

const roundTrip = <T, E>(schema: S.Codec<T, E>) => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  return Effect.fnUntraced(function* (value: T) {
    const encoded = yield* encode(value);
    const decoded = yield* decode(encoded);
    assertTrue(equivalent(decoded, value), "decode(encode(x)) is equivalent to x");
    const encoded1 = yield* encode(decoded);
    assert.deepStrictEqual(encoded1, encoded, "encode(decode(encode(x))) reproduces encode(x)");
    return decoded;
  });
};

const errorRoundTrip = <T extends { readonly message: string }, E>(schema: S.Codec<T, E>) => {
  const law = roundTrip(schema);
  return Effect.fnUntraced(function* (error: T) {
    const decoded = yield* law(error);
    assert.strictEqual(decoded.message, error.message, "the message derives from the encodable fields alone");
  });
};

const schemaErrorCarrierRoundTrip = <T extends { readonly message: string; readonly error: S.SchemaError }, E>(
  schema: S.Codec<T, E>
) => {
  const law = roundTrip(schema);
  return Effect.fnUntraced(function* (error: T) {
    const decoded = yield* law(error);
    assert.strictEqual(
      decoded.error,
      error.error,
      "the guard-only SchemaErrorFromSelf declaration carries a live issue graph and must pass through by identity"
    );
    assert.strictEqual(decoded.message, error.message, "the message derives from the carried issue tree");
  });
};

const oneOfArbitraries = <T>(arbitraries: A.NonEmptyReadonlyArray<Arbitrary.Arbitrary<T>>): Arbitrary.Arbitrary<T> =>
  Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: arbitraries.length - 1 }))).pipe(
    Arbitrary.flatMap((index) =>
      pipe(
        arbitraries,
        A.get(index),
        O.getOrElse(() => A.headNonEmpty(arbitraries))
      )
    )
  );

const terminatedLine = (text: string): LineSlice =>
  LineSlice.make({
    offset: 0,
    end: textEncoderByteLength(text),
    length: textEncoderByteLength(text) - 1,
    text: Str.slice(0, -1)(text),
    terminated: true,
  });

const unterminatedLine = (text: string): LineSlice =>
  LineSlice.make({
    offset: 0,
    end: textEncoderByteLength(text),
    length: textEncoderByteLength(text),
    text,
    terminated: false,
  });

const rejectAll = S.decodeUnknownResult(S.Never);
const schemaErrorFromRejectedJson = Arbitrary.schema(S.Json).pipe(Arbitrary.map(flow(rejectAll, Result.merge)));
const invalidData = Arbitrary.all({
  line: Arbitrary.schema(LineSlice),
  event: S.String.pipe(S.Option, Arbitrary.schema),
  error: schemaErrorFromRejectedJson,
}).pipe(Arbitrary.map(InvalidData.make.bind(InvalidData)));
const invalidJournalConfig = schemaErrorFromRejectedJson.pipe(
  Arbitrary.map((error) => InvalidJournalConfig.make({ error }))
);
const invalidSlice = schemaErrorFromRejectedJson.pipe(Arbitrary.map((error) => InvalidSlice.make({ error })));
const jsonlError = oneOfArbitraries<JsonlError>([
  Arbitrary.schema(
    S.Union([
      MalformedLine,
      UnknownEvent,
      UnserializableData,
      TerminalViolation,
      JournalClosed,
      JournalNotFound,
      JournalResync,
      JournalWriteConflict,
      InvalidUtf8,
      JournalUnterminated,
    ])
  ),
  invalidData,
  invalidJournalConfig,
  invalidSlice,
]);

const VoidPinged = JsonlEvent.make("pinged", { data: S.Void });
const registry = Tuple.make(Noted, Ended, Reopened, VoidPinged);
const RegisteredInput = S.Union([Noted.input, Ended.input, Reopened.input, VoidPinged.input]);
const RegisteredEnvelope = S.Union([Noted.envelope, Ended.envelope, Reopened.envelope, VoidPinged.envelope]);
const RegisteredTag = S.Literals(["noted", "ended", "reopened", "pinged"]);
const sameEnvelope = S.toEquivalence(RegisteredEnvelope);
const sameError = S.toEquivalence(JsonlError);
const sameLine = S.toEquivalence(LineSlice);
const encodeInput = S.encodeEffect(RegisteredInput);
const UnknownJson = S.fromJsonString(S.Unknown);
const parseJson = S.decodeEffect(UnknownJson);
const stringifyJson = S.encodeEffect(UnknownJson);
const decodeJsonValue = S.decodeUnknownEffect(S.Json);
const sameJson = S.toEquivalence(S.Json);
const WireRecord = S.Record(S.String, S.Json);
const decodeWire = S.decodeEffect(S.fromJsonString(WireRecord));
const decodeWireValue = S.decodeUnknownEffect(WireRecord);
const sameWire = S.toEquivalence(WireRecord);
const JsonPayloadFrame = S.Struct({ ...EnvelopeFrame.fields, data: S.Json });
const encodeJsonFrame = S.encodeEffect(S.fromJsonString(JsonPayloadFrame));
const sameFrame = S.toEquivalence(EnvelopeFrame);
const HandEditedJsonWhitespace = S.Literals(["", " ", "\t", " \t ", "\r"]);
const isByteCount = S.is(ByteCount);
const isResyncReason = S.is(JournalResyncReason);
const decodeConfig = S.decodeUnknownEffect(JournalConfig);
const encodeConfig = S.encodeEffect(JournalConfig);
const decodeCursoredSlice = S.decodeUnknownEffect(CursoredSlice(RegisteredTag));
const encodeCursoredSlice = S.encodeEffect(CursoredSlice(RegisteredTag));

const laws = {
  byteCount: roundTrip(ByteCount),
  lineSlice: roundTrip(LineSlice),
  parsedLine: roundTrip(ParsedLine),
  envelopeFrame: roundTrip(EnvelopeFrame),
  registeredInput: roundTrip(RegisteredInput),
  registeredEnvelope: roundTrip(RegisteredEnvelope),
  journalConfig: roundTrip(JournalConfig),
  appendOptions: roundTrip(AppendOptions),
  registrySlice: roundTrip(Slice(RegisteredTag)),
  openSlice: roundTrip(Slice(S.String)),
  registryCursoredSlice: roundTrip(CursoredSlice(RegisteredTag)),
  openCursoredSlice: roundTrip(CursoredSlice(S.String)),
  journalResyncReason: roundTrip(JournalResyncReason),
  sampledRange: roundTrip(SampledRange),
  malformedLine: errorRoundTrip(MalformedLine),
  unknownEvent: errorRoundTrip(UnknownEvent),
  unserializableData: errorRoundTrip(UnserializableData),
  terminalViolation: errorRoundTrip(TerminalViolation),
  journalClosed: errorRoundTrip(JournalClosed),
  journalNotFound: errorRoundTrip(JournalNotFound),
  journalResync: errorRoundTrip(JournalResync),
  journalWriteConflict: errorRoundTrip(JournalWriteConflict),
  invalidUtf8: errorRoundTrip(InvalidUtf8),
  journalUnterminated: errorRoundTrip(JournalUnterminated),
  invalidData: schemaErrorCarrierRoundTrip(InvalidData),
  invalidJournalConfig: schemaErrorCarrierRoundTrip(InvalidJournalConfig),
  invalidSlice: schemaErrorCarrierRoundTrip(InvalidSlice),
  jsonlError: errorRoundTrip(JsonlError),
};

describe("jsonl schema round trips", () => {
  it.effect.prop("ByteCount round-trips", [ByteCount], ([count]) => laws.byteCount(count), runs);

  it.effect.prop(
    "ByteCount admits exactly the non-negative safe integers",
    [S.Union([S.Finite, ByteCount])],
    ([value]) =>
      Effect.sync(() => {
        assert.strictEqual(
          isByteCount(value),
          Number.isSafeInteger(value) && value >= 0,
          "ByteCount is the safe-integer domain: 2 ** 53 is an integer but not a byte count"
        );
      }),
    runs
  );

  it.effect.prop("LineSlice round-trips", [LineSlice], ([line]) => laws.lineSlice(line), runs);

  it.effect.prop(
    "LineSlice.rebase composes additively and keeps content and terminator",
    [Arbitrary.schema(LineSlice), ByteCount, ByteCount],
    ([line, first, second]) =>
      Effect.sync(() => {
        const stepwise = pipe(line, LineSlice.rebase(first), LineSlice.rebase(second));
        assertTrue(
          sameLine(stepwise, LineSlice.rebase(line, first + second)),
          "rebase(a) then rebase(b) is rebase(a + b)"
        );
        assertTrue(sameLine(LineSlice.rebase(line, 0), line), "rebase(0) is the identity");
        assert.strictEqual(
          stepwise.offset - line.offset,
          first + second,
          "strictEqual, not deepStrictEqual: ByteCount admits -0, which equals 0 as an offset"
        );
        assert.strictEqual(stepwise.end - line.end, first + second);
        assert.strictEqual(stepwise.length, line.length);
        assert.strictEqual(stepwise.text, line.text);
        assert.strictEqual(stepwise.terminated, line.terminated);
      }),
    runs
  );

  it.effect.prop("ParsedLine round-trips", [ParsedLine], ([parsed]) => laws.parsedLine(parsed), runs);

  it.effect.prop("EnvelopeFrame round-trips", [EnvelopeFrame], ([frame]) => laws.envelopeFrame(frame), runs);

  it.effect.prop(
    "every registered event's input codec round-trips",
    [RegisteredInput],
    ([input]) => laws.registeredInput(input),
    runs
  );

  it.effect.prop(
    "every registered event's envelope codec round-trips",
    [RegisteredEnvelope],
    ([envelope]) => laws.registeredEnvelope(envelope),
    runs
  );

  it.effect.prop("JournalConfig round-trips", [JournalConfig], ([config]) => laws.journalConfig(config), runs);

  it.effect.prop("AppendOptions round-trips", [AppendOptions], ([options]) => laws.appendOptions(options), runs);

  it.effect.prop("SampledRange round-trips", [SampledRange], ([page]) => laws.sampledRange(page), runs);

  it.effect.prop(
    "Slice round-trips over a registry tag domain",
    [Slice(RegisteredTag)],
    ([slice]) => laws.registrySlice(slice),
    runs
  );

  it.effect.prop(
    "Slice round-trips over open string tags",
    [Slice(S.String)],
    ([slice]) => laws.openSlice(slice),
    runs
  );

  it.effect.prop(
    "CursoredSlice round-trips over a registry tag domain",
    [CursoredSlice(RegisteredTag)],
    ([slice]) => laws.registryCursoredSlice(slice),
    runs
  );

  it.effect.prop(
    "CursoredSlice round-trips over open string tags",
    [CursoredSlice(S.String)],
    ([slice]) => laws.openCursoredSlice(slice),
    runs
  );

  it.effect.prop(
    "optional configuration and slice keys are exact and reject an explicit undefined (kept deviation D15, EF-40)",
    [Arbitrary.schema(JournalConfig), CursoredSlice(RegisteredTag)],
    ([config, slice]) =>
      Effect.gen(function* () {
        const encodedConfig = yield* encodeConfig(config);
        for (const key of ["directory", "capacity", "shutdownPublishTimeout"] as const) {
          const explicit = yield* Effect.exit(decodeConfig({ ...encodedConfig, [key]: undefined }));
          explicit.pipe(Exit.isFailure, assertTrue);
        }
        const encodedSlice = yield* encodeCursoredSlice(slice);
        for (const key of ["events", "scopes", "from", "to", "cursor"] as const) {
          const explicit = yield* Effect.exit(decodeCursoredSlice({ ...encodedSlice, [key]: undefined }));
          explicit.pipe(Exit.isFailure, assertTrue);
        }
      }),
    runs
  );

  it.effect.prop(
    "JournalResyncReason round-trips",
    [JournalResyncReason],
    ([reason]) => laws.journalResyncReason(reason),
    runs
  );

  it.effect.prop(
    "JournalResyncReason admits exactly the two documented breaches",
    [S.Union([S.String, S.Literals(["truncated", "replaced", "Truncated", "replaced ", "rotated"])])],
    ([candidate]) =>
      Effect.sync(() => {
        assert.strictEqual(isResyncReason(candidate), candidate === "truncated" || candidate === "replaced");
      }),
    runs
  );
});

describe("JsonlError round trips", () => {
  it.effect.prop("MalformedLine", [MalformedLine], ([error]) => laws.malformedLine(error), runs);
  it.effect.prop("UnknownEvent", [UnknownEvent], ([error]) => laws.unknownEvent(error), runs);
  it.effect.prop("UnserializableData", [UnserializableData], ([error]) => laws.unserializableData(error), runs);
  it.effect.prop(
    "UnserializableData with an Error cause, which the derived S.Defect arbitrary never produces",
    [S.String, S.String],
    ([event, message]) => laws.unserializableData(UnserializableData.make({ event, cause: new Error(message) })),
    runs
  );
  it.effect.prop("TerminalViolation", [TerminalViolation], ([error]) => laws.terminalViolation(error), runs);
  it.effect.prop("JournalClosed", [JournalClosed], ([error]) => laws.journalClosed(error), runs);
  it.effect.prop("JournalNotFound", [JournalNotFound], ([error]) => laws.journalNotFound(error), runs);
  it.effect.prop("JournalResync", [JournalResync], ([error]) => laws.journalResync(error), runs);
  it.effect.prop("JournalWriteConflict", [JournalWriteConflict], ([error]) => laws.journalWriteConflict(error), runs);
  it.effect.prop("InvalidUtf8", [InvalidUtf8], ([error]) => laws.invalidUtf8(error), runs);
  it.effect.prop(
    "InvalidUtf8 with an Error cause",
    [S.String, ByteCount, S.String],
    ([path, offset, message]) => laws.invalidUtf8(InvalidUtf8.make({ path, offset, cause: new Error(message) })),
    runs
  );
  it.effect.prop("JournalUnterminated", [JournalUnterminated], ([error]) => laws.journalUnterminated(error), runs);
  it.effect.prop(
    "InvalidData (explicit generator: Arbitrary.schema refuses the SchemaErrorFromSelf declaration)",
    [invalidData],
    ([error]) => laws.invalidData(error),
    runs
  );
  it.effect.prop(
    "InvalidJournalConfig (explicit generator: Arbitrary.schema refuses the SchemaErrorFromSelf declaration)",
    [invalidJournalConfig],
    ([error]) => laws.invalidJournalConfig(error),
    runs
  );
  it.effect.prop(
    "InvalidSlice (explicit generator: Arbitrary.schema refuses the SchemaErrorFromSelf declaration)",
    [invalidSlice],
    ([error]) => laws.invalidSlice(error),
    runs
  );
  it.effect.prop("the JsonlError union over every member", [jsonlError], ([error]) => laws.jsonlError(error), runs);
});

describe("Line parser fidelity", () => {
  it.effect.prop(
    "parse(stringify(parse(x))) equals parse(x), stringify is idempotent through parse, and parse recovers the value",
    [S.Json, HandEditedJsonWhitespace, HandEditedJsonWhitespace],
    ([value, before, after]) =>
      Effect.gen(function* () {
        const text = `${before}${yield* stringifyJson(value)}${after}`;
        const line = unterminatedLine(text);
        assert.deepStrictEqual(Line.split(text), [line], "a JSON value without a newline is one unterminated line");
        const first = yield* Effect.fromResult(Line.parseResult(line));
        assertTrue(sameLine(first.line, line), "the parsed line keeps its source slice");
        const decodedJsonValue = yield* decodeJsonValue(first.value);
        assertTrue(sameJson(decodedJsonValue, value), "parse recovers the written value");
        const canonical = yield* stringifyJson(first.value);
        const second = yield* Effect.fromResult(Line.parseResult(unterminatedLine(canonical)));
        assert.deepStrictEqual(second.value, first.value, "parse(stringify(parse(x))) equals parse(x)");
        const stringifyJson2 = yield* stringifyJson(second.value);
        assert.strictEqual(stringifyJson2, canonical, "stringify(parse(.)) is idempotent");
        const parsedJson = yield* parseJson(canonical);
        assert.deepStrictEqual(parsedJson, first.value);
      }),
    runs
  );
});

describe("Envelope codec fidelity over a registry", () => {
  it.effect.prop(
    "a JSON frame decodes back to itself before any payload codec runs",
    [JsonPayloadFrame],
    ([frame]) =>
      Effect.gen(function* () {
        const text = yield* encodeJsonFrame(frame);
        const line = unterminatedLine(text);
        assert.deepStrictEqual(Line.split(text), [line]);
        const decoded = yield* Effect.fromResult(Envelope.frameResult(line));
        assertTrue(sameFrame(decoded, frame), "frameResult(encode(frame)) is equivalent to frame");
        assertTrue(sameLine(decoded.line, line));
      }),
    runs
  );

  it.effect.prop(
    "each registered event encodes to one terminated line that decodes back to it",
    [RegisteredInput],
    ([input]) =>
      Effect.gen(function* () {
        const text = yield* Envelope.encode(input, registry);
        assertTrue(Str.endsWith("\n")(text), "an encoded record carries its terminator");
        const line = terminatedLine(text);
        assert.deepStrictEqual(Line.split(text), [line], "one record is exactly one line");
        const decoded = yield* Envelope.decode(line, registry);
        assertTrue(sameEnvelope(decoded, { ...input, line }), "decode(encode(x)) is x on its source line");
        const pipe3 = yield* pipe(line, Envelope.decode(registry));
        assertTrue(sameEnvelope(pipe3, decoded), "both dual forms agree");
      }),
    runs
  );

  it.effect.prop(
    "encode is idempotent through decode, and decode is faithful through encode",
    [RegisteredInput],
    ([input]) =>
      Effect.gen(function* () {
        const text = yield* Envelope.encode(input, registry);
        const decoded = yield* Envelope.decode(terminatedLine(text), registry);
        const again = yield* pipe(decoded, Envelope.encode(registry));
        assert.strictEqual(again, text, "encode(decode(encode(x))) equals encode(x)");
        const redecoded = yield* Envelope.decode(terminatedLine(again), registry);
        assertTrue(sameEnvelope(redecoded, decoded), "decode(encode(decode(t))) equals decode(t)");
      }),
    runs
  );

  it.effect.prop(
    "void payloads encode as JSON null and an absent scope key stays omitted",
    [RegisteredInput],
    ([input]) =>
      Effect.gen(function* () {
        const encoded4 = yield* Envelope.encode(input, registry);
        const wire = yield* decodeWire(encoded4);
        const encoded = yield* encodeInput(input);
        const expected = yield* decodeWireValue({ ...encoded, data: encoded.data ?? null });
        assertTrue(
          sameWire(wire, expected),
          "the wire record is the encoded input with void written as null, compared as JSON where -0 and 0 are one number"
        );
        assert.strictEqual(R.has(wire, "scope"), P.isNotUndefined(input.scope), "scope is written iff it was given");
        assertTrue(R.has(wire, "data"), "data is always written, as null when void");
      }),
    runs
  );

  it.effect.prop(
    "selection excludes unselected frames and otherwise agrees with decodeResult",
    [RegisteredInput, S.Array(RegisteredTag)],
    ([input, chosen]) =>
      Effect.gen(function* () {
        const encoded5 = yield* Envelope.encode(input, registry);
        const line = terminatedLine(encoded5);
        const selected = Envelope.decodeSelectedResult(line, registry, (frame) => A.contains(chosen, frame.event));
        if (A.contains(chosen, input.event)) {
          assertSome(selected, Envelope.decodeResult(line, registry));
        } else {
          assertNone(selected);
        }
      }),
    runs
  );

  it.effect.prop(
    "a journal of encoded records decodes record by record at cumulative UTF-8 offsets",
    [S.Array(RegisteredInput).check(S.isMaxLength(8))],
    ([inputs]) =>
      Effect.gen(function* () {
        const texts = yield* Effect.forEach(inputs, Envelope.encode(registry), { concurrency: 1 });
        const journal = A.join(texts, "");
        const decoded = yield* Effect.forEach(Envelope.decodeAllResult(journal, registry), Effect.fromResult, {
          concurrency: 1,
        });
        const ends = pipe(
          texts,
          A.scan(0, (offset, text) => offset + textEncoderByteLength(text)),
          A.drop(1)
        );
        assert.strictEqual(decoded.length, inputs.length, "no record is dropped or invented");
        for (const [[input, envelope], end] of pipe(inputs, A.zip(decoded), A.zip(ends))) {
          assertTrue(
            sameEnvelope(envelope, { ...input, line: envelope.line }),
            "each record decodes back to its input"
          );
          assert.strictEqual(envelope.line.end, end, "line.end is the UTF-8 resume cursor past this record");
        }
        assert.deepStrictEqual(Envelope.lastValidResult(journal, registry), A.last(decoded));
      }),
    runs
  );
});

describe("JsonlEvent definitions", () => {
  it.effect.prop(
    "make keeps tag and flags, and its derived codecs round-trip that tag and reject any other",
    [S.String, S.Boolean, S.Boolean, Noted.input],
    ([tag, terminal, reopen, sample]) =>
      Effect.gen(function* () {
        const event = JsonlEvent.make(tag, { data: Noted.data, terminal, reopen });
        assert.deepStrictEqual(
          [event[JsonlEventTypeId], event.tag, event.data, event.terminal, event.reopen],
          [JsonlEventTypeId, tag, Noted.data, terminal, reopen]
        );
        const events = Tuple.make(event);
        const input = { ...sample, event: tag };
        const encoded6 = yield* Envelope.encode(input, events);
        const line = terminatedLine(encoded6);
        const decoded = yield* Envelope.decode(line, events);
        assertTrue(S.toEquivalence(event.envelope)(decoded, { ...input, line }), "the derived envelope round-trips");
        const foreign = `${tag}~`;
        const stranger = Tuple.make(JsonlEvent.make(foreign, { data: Noted.data }));
        const encoded7 = yield* Envelope.encode({ ...sample, event: foreign }, stranger);
        const foreignLine = terminatedLine(encoded7);
        const rejected = yield* Effect.flip(Envelope.decode(foreignLine, events));
        assertTrue(
          sameError(rejected, UnknownEvent.make({ line: foreignLine, event: foreign, known: [tag] })),
          "an unregistered tag fails typed with the registry's tags"
        );
      }),
    runs
  );
});
