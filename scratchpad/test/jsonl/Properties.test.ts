// Property floor (D10) for the jsonl lab: every exported schema and codec gets
// an encode/decode round trip, and every parser/formatter gets idempotence and
// fidelity, plus the README's own wire guarantees. Line split/parse laws live in
// LineProperty.test.ts and are not repeated here.
//
// Array form ONLY: the named-record form of it.effect.prop silently discards
// Schema conversion (see LineProperty.test.ts).
import { fcRuns } from "@beep/fc-runs";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
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
} from "../../effected/jsonl/index.ts";
import { SampledRange } from "../../effected/jsonl/internal/tail.ts";
import { matchesFrame } from "../../effected/jsonl/Slice.ts";
import { Ended, Noted, Reopened } from "./fixtures.ts";

const runs = { arbitrary: fcRuns(100) };
const encoder = new TextEncoder();
/** The byte-length oracle: TextEncoder, not the module's own counter. */
const byteLength = (text: string): number => encoder.encode(text).length;

/**
 * The D10 codec law for one schema: decoding an encoded value never fails (a
 * failure fails the Effect and so falsifies the property), the decoded value is
 * equivalent to the original under the schema's own equivalence, and
 * re-encoding reproduces the encoded form exactly.
 */
const roundTrip = <T, E>(schema: S.Codec<T, E>) => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  return Effect.fnUntraced(function* (value: T) {
    const encoded = yield* encode(value);
    const decoded = yield* decode(encoded);
    assertTrue(equivalent(decoded, value), "decode(encode(x)) is equivalent to x");
    assert.deepStrictEqual(yield* encode(decoded), encoded, "encode(decode(encode(x))) reproduces encode(x)");
    return decoded;
  });
};

/** The codec law for an error class, which also pins the derived message. */
const errorRoundTrip = <T extends { readonly message: string }, E>(schema: S.Codec<T, E>) => {
  const law = roundTrip(schema);
  return Effect.fnUntraced(function* (error: T) {
    const decoded = yield* law(error);
    assert.strictEqual(decoded.message, error.message, "the message derives from the encodable fields alone");
  });
};

/**
 * The codec law for an error carrying `SchemaErrorFromSelf`. That field is a
 * guard-only declaration: it has no equivalence of its own, so the schema
 * equivalence cannot see it, and the law asserts the passthrough identity
 * directly.
 */
const schemaErrorCarrierRoundTrip = <T extends { readonly message: string; readonly error: S.SchemaError }, E>(
  schema: S.Codec<T, E>
) => {
  const law = roundTrip(schema);
  return Effect.fnUntraced(function* (error: T) {
    const decoded = yield* law(error);
    assert.strictEqual(decoded.error, error.error, "the structured SchemaError passes through by identity");
    assert.strictEqual(decoded.message, error.message, "the message derives from the carried issue tree");
  });
};

/** A uniform choice between arbitraries; the native module only unions Schemas. */
const oneOf = <T>(arbitraries: A.NonEmptyReadonlyArray<Arbitrary.Arbitrary<T>>): Arbitrary.Arbitrary<T> =>
  Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: arbitraries.length - 1 }))).pipe(
    Arbitrary.flatMap((index) =>
      pipe(
        arbitraries,
        A.get(index),
        O.getOrElse(() => A.headNonEmpty(arbitraries))
      )
    )
  );

/** One encoded record must split into exactly this slice: terminated, spanning every byte. */
const terminatedLine = (text: string): LineSlice =>
  LineSlice.make({
    offset: 0,
    end: byteLength(text),
    length: byteLength(text) - 1,
    text: Str.slice(0, -1)(text),
    terminated: true,
  });

/** Text with no newline is exactly one unterminated slice. */
const unterminatedLine = (text: string): LineSlice =>
  LineSlice.make({ offset: 0, end: byteLength(text), length: byteLength(text), text, terminated: false });

// ---------------------------------------------------------------------------
// Schemas without a derivable arbitrary.
//
// `SchemaErrorFromSelf` (InvalidData, InvalidJournalConfig, InvalidSlice) is
// `S.declare(S.isSchemaError)`: Arbitrary.schema refuses it ("unsupported
// Declaration"). A real SchemaError comes from rejecting an arbitrary JSON value
// with `S.Never`, and the remaining fields are derived from their own schemas.
// ---------------------------------------------------------------------------
const rejectAll = S.decodeUnknownResult(S.Never);
const schemaError = Arbitrary.schema(S.Json).pipe(Arbitrary.map(flow(rejectAll, Result.merge)));
const invalidData = Arbitrary.all({
  line: Arbitrary.schema(LineSlice),
  event: S.String.pipe(S.Option, Arbitrary.schema),
  error: schemaError,
}).pipe(Arbitrary.map(InvalidData.make));
const invalidJournalConfig = schemaError.pipe(Arbitrary.map((error) => InvalidJournalConfig.make({ error })));
const invalidSlice = schemaError.pipe(Arbitrary.map((error) => InvalidSlice.make({ error })));
const jsonlError = oneOf<JsonlError>([
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

// ---------------------------------------------------------------------------
// The registry under test: the shared fixtures (a struct payload with an
// optional key, a terminal Null event, a reopen Null event) plus a void payload,
// which the README promises encodes as JSON null.
// ---------------------------------------------------------------------------
const Pinged = JsonlEvent.make("pinged", { data: S.Void });
const registry = Tuple.make(Noted, Ended, Reopened, Pinged);
const RegisteredInput = S.Union([Noted.input, Ended.input, Reopened.input, Pinged.input]);
const RegisteredEnvelope = S.Union([Noted.envelope, Ended.envelope, Reopened.envelope, Pinged.envelope]);
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
/** A frame whose payload is JSON, so it has a wire form to round-trip. */
const JsonFrame = S.Struct({ ...EnvelopeFrame.fields, data: S.Json });
const encodeJsonFrame = S.encodeEffect(S.fromJsonString(JsonFrame));
const sameFrame = S.toEquivalence(EnvelopeFrame);
/** JSON insignificant whitespace a hand-edited line may carry around its value. */
const Padding = S.Literals(["", " ", "\t", " \t ", "\r"]);
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
        // S.Int is the safe-integer domain: 2 ** 53 is an integer but not a byte count.
        assert.strictEqual(isByteCount(value), Number.isSafeInteger(value) && value >= 0);
      }),
    runs
  );

  it.effect.prop("LineSlice round-trips", [LineSlice], ([line]) => laws.lineSlice(line), runs);

  it.effect.prop(
    "LineSlice.rebase composes additively and keeps content and terminator",
    [LineSlice, ByteCount, ByteCount],
    ([line, first, second]) =>
      Effect.sync(() => {
        const stepwise = pipe(line, LineSlice.rebase(first), LineSlice.rebase(second));
        assertTrue(sameLine(stepwise, LineSlice.rebase(line, first + second)), "rebase(a) then rebase(b) is rebase(a + b)");
        assertTrue(sameLine(LineSlice.rebase(line, 0), line), "rebase(0) is the identity");
        // strictEqual, not deepStrictEqual: ByteCount admits -0, which equals 0 as an offset.
        assert.strictEqual(stepwise.offset - line.offset, first + second);
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

  it.effect.prop("Slice round-trips over open string tags", [Slice(S.String)], ([slice]) => laws.openSlice(slice), runs);

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

  // Upstream omission semantics (D15 reverted): an explicitly undefined optional
  // key decodes, reads as undefined, and selects exactly what omitting it does.
  it.effect.prop(
    "optional configuration and slice keys treat an explicit undefined as omission",
    [JournalConfig, CursoredSlice(RegisteredTag), EnvelopeFrame],
    ([config, slice, frame]) =>
      Effect.gen(function* () {
        const encodedConfig = yield* encodeConfig(config);
        for (const key of ["directory", "capacity", "shutdownPublishTimeout"] as const) {
          const explicit = yield* decodeConfig({ ...encodedConfig, [key]: undefined });
          const omitted = yield* decodeConfig(Struct.omit(encodedConfig, [key]));
          assert.isUndefined(explicit[key], `JournalConfig.${key}: undefined decodes as absent`);
          assert.isUndefined(omitted[key], `JournalConfig.${key}: omission decodes as absent`);
        }
        const encodedSlice = yield* encodeCursoredSlice(slice);
        for (const key of ["events", "scopes", "from", "to", "cursor"] as const) {
          const explicit = yield* decodeCursoredSlice({ ...encodedSlice, [key]: undefined });
          const omitted = yield* decodeCursoredSlice(Struct.omit(encodedSlice, [key]));
          assert.isUndefined(explicit[key], `CursoredSlice.${key}: undefined decodes as absent`);
          assert.strictEqual(
            matchesFrame(frame, explicit),
            matchesFrame(frame, omitted),
            `CursoredSlice.${key}: undefined selects what omission selects`
          );
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
  // S.Defect derives an arbitrary over JSON-like causes; Error causes are added
  // explicitly below because the derived space contains none.
  it.effect.prop("UnserializableData", [UnserializableData], ([error]) => laws.unserializableData(error), runs);
  it.effect.prop(
    "UnserializableData with an Error cause",
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
  it.effect.prop("InvalidData (explicit generator)", [invalidData], ([error]) => laws.invalidData(error), runs);
  it.effect.prop(
    "InvalidJournalConfig (explicit generator)",
    [invalidJournalConfig],
    ([error]) => laws.invalidJournalConfig(error),
    runs
  );
  it.effect.prop("InvalidSlice (explicit generator)", [invalidSlice], ([error]) => laws.invalidSlice(error), runs);
  it.effect.prop("the JsonlError union over every member", [jsonlError], ([error]) => laws.jsonlError(error), runs);
});

describe("Line parser fidelity", () => {
  it.effect.prop(
    "parse(stringify(parse(x))) equals parse(x), stringify is idempotent through parse, and parse recovers the value",
    [S.Json, Padding, Padding],
    ([value, before, after]) =>
      Effect.gen(function* () {
        const text = `${before}${yield* stringifyJson(value)}${after}`;
        const line = unterminatedLine(text);
        assert.deepStrictEqual(Line.split(text), [line], "a JSON value without a newline is one unterminated line");
        const first = yield* Effect.fromResult(Line.parseResult(line));
        assertTrue(sameLine(first.line, line), "the parsed line keeps its source slice");
        assertTrue(sameJson(yield* decodeJsonValue(first.value), value), "parse recovers the written value");
        const canonical = yield* stringifyJson(first.value);
        const second = yield* Effect.fromResult(Line.parseResult(unterminatedLine(canonical)));
        assert.deepStrictEqual(second.value, first.value, "parse(stringify(parse(x))) equals parse(x)");
        assert.strictEqual(yield* stringifyJson(second.value), canonical, "stringify(parse(.)) is idempotent");
        assert.deepStrictEqual(yield* parseJson(canonical), first.value);
      }),
    runs
  );
});

describe("Envelope codec fidelity over a registry", () => {
  it.effect.prop(
    "a JSON frame decodes back to itself before any payload codec runs",
    [JsonFrame],
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
        assertTrue(sameEnvelope(yield* pipe(line, Envelope.decode(registry)), decoded), "both dual forms agree");
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
        const wire = yield* decodeWire(yield* Envelope.encode(input, registry));
        const encoded = yield* encodeInput(input);
        // Compared as JSON, where -0 and 0 are one number: the expectation is the
        // input codec's output with a void payload written as null.
        const expected = yield* decodeWireValue({ ...encoded, data: encoded.data ?? null });
        assertTrue(sameWire(wire, expected), "the wire record is the encoded input");
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
        const line = terminatedLine(yield* Envelope.encode(input, registry));
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
        const texts = yield* Effect.forEach(inputs, Envelope.encode(registry));
        const journal = A.join(texts, "");
        const decoded = yield* Effect.forEach(Envelope.decodeAllResult(journal, registry), Effect.fromResult);
        const ends = pipe(
          texts,
          A.scan(0, (offset, text) => offset + byteLength(text)),
          A.drop(1)
        );
        assert.strictEqual(decoded.length, inputs.length, "no record is dropped or invented");
        for (const [[input, envelope], end] of pipe(inputs, A.zip(decoded), A.zip(ends))) {
          assertTrue(sameEnvelope(envelope, { ...input, line: envelope.line }), "each record decodes back to its input");
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
        const line = terminatedLine(yield* Envelope.encode(input, events));
        const decoded = yield* Envelope.decode(line, events);
        assertTrue(S.toEquivalence(event.envelope)(decoded, { ...input, line }), "the derived envelope round-trips");
        const foreign = `${tag}~`;
        const stranger = Tuple.make(JsonlEvent.make(foreign, { data: Noted.data }));
        const foreignLine = terminatedLine(yield* Envelope.encode({ ...sample, event: foreign }, stranger));
        const rejected = yield* Effect.flip(Envelope.decode(foreignLine, events));
        assertTrue(
          sameError(rejected, UnknownEvent.make({ line: foreignLine, event: foreign, known: [tag] })),
          "an unregistered tag fails typed with the registry's tags"
        );
      }),
    runs
  );
});
