/**
 * Frame-first JSONL codecs. Payload validation runs only for selected lines.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { InvalidData, type MalformedLine, UnknownEvent, UnserializableData } from "./JsonlError.js";
import type { JsonlEvent } from "./JsonlEvent.js";
import { Line } from "./Line.js";
import { LineSlice } from "./LineSlice.js";

const $I = $ScratchpadId.create("effected/jsonl/Envelope");

/**
 * The wire frame, decoded before selection without traversing its payload.
 * A transient Struct avoids allocating a class for frames that are discarded.
 *
 * **Example** (Read a frame without validating its payload)
 * ```ts
 * import { EnvelopeFrame } from "@beep/scratchpad/effected/jsonl/Envelope";
 * import * as S from "effect/Schema";
 * import * as Result from "effect/Result";
 * const result = S.decodeUnknownResult(EnvelopeFrame)({ at: "2026-10-06T00:00:00Z", event: "started", data: null });
 * console.log(Result.isSuccess(result)); // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const EnvelopeFrame = S.Struct({
  at: S.DateTimeUtcFromString,
  event: S.String,
  scope: S.optionalKey(S.String),
  data: S.Unknown,
}).annotate($I.annote("EnvelopeFrame", { description: "An envelope frame with an undecoded payload." }));

/**
 * The decoded frame, before its registered payload codec runs.
 * @category type-level
 * @since 0.0.0
 */
export type EnvelopeFrame = typeof EnvelopeFrame.Type;

const inputFields = <Tag extends string, Data>(tag: Tag, data: S.Codec<Data, unknown>) => ({
  at: S.DateTimeUtc,
  event: S.Literal(tag),
  scope: S.optionalKey(S.String),
  data,
});

const input = <Tag extends string, Data>(tag: Tag, data: S.Codec<Data, unknown>) => S.Struct(inputFields(tag, data));

const schema = <Tag extends string, Data>(tag: Tag, data: S.Codec<Data, unknown>) =>
  S.Struct({ ...inputFields(tag, data), line: LineSlice }).annotate(
    $I.annote("Envelope", { description: "A selected event with its decoded payload and source line." }),
  );

/**
 * A schema-derived envelope for one event tag and payload.
 * @category type-level
 * @since 0.0.0
 */
export type Envelope<Tag extends string, Data> = ReturnType<typeof schema<Tag, Data>>["Type"];

/**
 * An envelope without a source line, accepted by the encoder.
 * @category type-level
 * @since 0.0.0
 */
export type EnvelopeInput<Tag extends string, Data> = ReturnType<typeof input<Tag, Data>>["Type"];

/**
 * The envelope produced by an event definition's codec.
 * @category type-level
 * @since 0.0.0
 */
export type EnvelopeOf<E extends JsonlEvent.Any> = E["envelope"]["Type"];

/**
 * The discriminated union carried by a registry.
 * @category type-level
 * @since 0.0.0
 */
export type EnvelopeUnion<R extends JsonlEvent.Registry> = EnvelopeOf<R[number]>;

/**
 * Registry envelopes whose discriminant belongs to T.
 * @category type-level
 * @since 0.0.0
 */
export type EnvelopeWithTag<R extends JsonlEvent.Registry, T extends string> = Extract<
  EnvelopeUnion<R>,
  { readonly event: T }
>;

type DecodeError = MalformedLine | InvalidData | UnknownEvent;
type EncodeError = UnknownEvent | InvalidData | UnserializableData;
type InputOf<E extends JsonlEvent.Any> = E extends JsonlEvent.Any ? Omit<EnvelopeOf<E>, "line"> : never;
type Encoding<R extends JsonlEvent.Registry> = InputOf<R[number]>;

// A weak-key cache releases an index when its registry is no longer used.
// The index itself is an immutable HashMap; positions retain R[number]'s type.
const registryIndex = new WeakMap<JsonlEvent.Registry, HashMap.HashMap<string, number>>();
const indexRegistry = (events: JsonlEvent.Registry): HashMap.HashMap<string, number> => {
  const cached = O.fromUndefinedOr(registryIndex.get(events));
  if (O.isSome(cached)) return cached.value;
  Object.freeze(events);
  const index = HashMap.fromIterable(A.map(events, (event, position) => Tuple.make(event.tag, position)));
  registryIndex.set(events, index);
  return index;
};

const definition = <R extends JsonlEvent.Registry>(events: R, tag: string): O.Option<R[number]> =>
  HashMap.get(indexRegistry(events), tag).pipe(O.flatMap((position) => A.get(events, position)));
const decodeFrame = S.decodeUnknownResult(EnvelopeFrame);
const encodeAt = S.encodeResult(S.DateTimeUtcFromString);
const encodeJson = S.encodeResult(S.fromJsonString(S.Unknown));
const isBlank = (line: LineSlice): boolean => Str.isEmpty(Str.trim(line.text));

const completeResult = <R extends JsonlEvent.Registry>(
  events: R,
  line: LineSlice,
  frame: EnvelopeFrame,
): Result.Result<EnvelopeUnion<R>, DecodeError> => {
  const found = definition(events, frame.event);
  if (O.isNone(found)) {
    return Result.fail(UnknownEvent.make({ line, event: frame.event, known: A.map(events, (event) => event.tag) }));
  }
  const codec: R[number]["envelope"] = found.value.envelope;
  return S.decodeResult(codec)({ ...frame, line }).pipe(
    Result.mapError((error) => InvalidData.make({ line, event: O.some(frame.event), error })),
  );
};

const frameResult = (
  line: LineSlice,
): Result.Result<EnvelopeFrame & { readonly line: LineSlice }, MalformedLine | InvalidData> =>
  Line.parseResult(line).pipe(
    Result.flatMap(({ value }) =>
      decodeFrame(value).pipe(Result.mapError((error) => InvalidData.make({ line, event: O.none(), error }))),
    ),
    Result.map((frame) => ({ ...frame, line })),
  );

const decodeResult: {
  <const R extends JsonlEvent.Registry>(line: LineSlice, events: R): Result.Result<EnvelopeUnion<R>, DecodeError>;
  <const R extends JsonlEvent.Registry>(events: R): (line: LineSlice) => Result.Result<EnvelopeUnion<R>, DecodeError>;
} = dual(
  2,
  <R extends JsonlEvent.Registry>(line: LineSlice, events: R): Result.Result<EnvelopeUnion<R>, DecodeError> =>
    frameResult(line).pipe(Result.flatMap((frame) => completeResult(events, line, frame))),
);

const decodeSelectedResult: {
  <const R extends JsonlEvent.Registry>(
    line: LineSlice,
    events: R,
    select: (frame: EnvelopeFrame) => boolean,
  ): O.Option<Result.Result<EnvelopeUnion<R>, DecodeError>>;
  <const R extends JsonlEvent.Registry>(
    events: R,
    select: (frame: EnvelopeFrame) => boolean,
  ): (line: LineSlice) => O.Option<Result.Result<EnvelopeUnion<R>, DecodeError>>;
} = dual(
  3,
  <R extends JsonlEvent.Registry>(
    line: LineSlice,
    events: R,
    select: (frame: EnvelopeFrame) => boolean,
  ): O.Option<Result.Result<EnvelopeUnion<R>, DecodeError>> => {
    const frame = frameResult(line);
    if (Result.isFailure(frame)) return frame.failure.pipe(Result.fail, O.some);
    return select(frame.success) ? O.some(completeResult(events, line, frame.success)) : O.none();
  },
);

const decodeAllResult: {
  <const R extends JsonlEvent.Registry>(
    text: string,
    events: R,
  ): ReadonlyArray<Result.Result<EnvelopeUnion<R>, DecodeError>>;
  <const R extends JsonlEvent.Registry>(
    events: R,
  ): (text: string) => ReadonlyArray<Result.Result<EnvelopeUnion<R>, DecodeError>>;
} = dual(
  2,
  <R extends JsonlEvent.Registry>(
    text: string,
    events: R,
  ): ReadonlyArray<Result.Result<EnvelopeUnion<R>, DecodeError>> =>
    pipe(
      Line.split(text),
      A.filter((line) => !isBlank(line)),
      A.map(decodeResult(events)),
    ),
);

const lastValidResult: {
  <const R extends JsonlEvent.Registry>(text: string, events: R): O.Option<EnvelopeUnion<R>>;
  <const R extends JsonlEvent.Registry>(events: R): (text: string) => O.Option<EnvelopeUnion<R>>;
} = dual(
  2,
  <R extends JsonlEvent.Registry>(text: string, events: R): O.Option<EnvelopeUnion<R>> =>
    pipe(
      Line.split(text),
      A.findLast((line) => (isBlank(line) ? O.none() : Result.getSuccess(decodeResult(line, events)))),
    ),
);

const encodeResult: {
  <const R extends JsonlEvent.Registry>(envelope: Encoding<NoInfer<R>>, events: R): Result.Result<string, EncodeError>;
  <const R extends JsonlEvent.Registry>(
    events: R,
  ): (envelope: Encoding<NoInfer<R>>) => Result.Result<string, EncodeError>;
} = dual(
  2,
  <R extends JsonlEvent.Registry>(envelope: Encoding<NoInfer<R>>, events: R): Result.Result<string, EncodeError> => {
    const empty = LineSlice.make({ offset: 0, end: 0, length: 0, text: "", terminated: false });
    const found = definition(events, envelope.event);
    if (O.isNone(found)) {
      return Result.fail(
        UnknownEvent.make({ line: empty, event: envelope.event, known: A.map(events, (event) => event.tag) }),
      );
    }
    const data = S.encodeUnknownResult(found.value.data)(envelope.data);
    if (Result.isFailure(data))
      return Result.fail(InvalidData.make({ line: empty, event: O.some(envelope.event), error: data.failure }));
    const at = encodeAt(envelope.at);
    if (Result.isFailure(at))
      return Result.fail(InvalidData.make({ line: empty, event: O.some(envelope.event), error: at.failure }));
    return encodeJson({
      at: at.success,
      event: envelope.event,
      ...(envelope.scope === undefined ? {} : { scope: envelope.scope }),
      data: data.success === undefined ? null : data.success,
    }).pipe(
      Result.map((text) => `${text}\n`),
      Result.mapError((cause) => UnserializableData.make({ event: envelope.event, cause })),
    );
  },
);

const decode: {
  <const R extends JsonlEvent.Registry>(line: LineSlice, events: R): Effect.Effect<EnvelopeUnion<R>, DecodeError>;
  <const R extends JsonlEvent.Registry>(events: R): (line: LineSlice) => Effect.Effect<EnvelopeUnion<R>, DecodeError>;
} = dual(
  2,
  Effect.fn("Envelope.decode")(function* <R extends JsonlEvent.Registry>(line: LineSlice, events: R) {
    return yield* Effect.fromResult(decodeResult(line, events));
  }),
);

const encode: {
  <const R extends JsonlEvent.Registry>(envelope: Encoding<NoInfer<R>>, events: R): Effect.Effect<string, EncodeError>;
  <const R extends JsonlEvent.Registry>(
    events: R,
  ): (envelope: Encoding<NoInfer<R>>) => Effect.Effect<string, EncodeError>;
} = dual(
  2,
  Effect.fn("Envelope.encode")(function* <R extends JsonlEvent.Registry>(envelope: Encoding<NoInfer<R>>, events: R) {
    return yield* Effect.fromResult(encodeResult(envelope, events));
  }),
);

/**
 * Synchronous codecs and their lazy Effect counterparts. Each binary operation
 * takes the processed line, text or envelope first; supplying only the registry
 * returns its pipeable form. Selected decoding filters the frame before data.
 *
 * **Example** (Decode in a pipeline)
 * ```ts
 * import { Envelope, JsonlEvent, Line } from "@beep/scratchpad/effected/jsonl/index";
 * import { pipe } from "effect";
 * import * as A from "effect/Array";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 * const events = [JsonlEvent.make("started", { data: S.String })];
 * const decoded = pipe(Line.split('{"at":"2026-10-06T00:00:00Z","event":"started","data":"ready"}'), A.head, O.map(Envelope.decodeResult(events)));
 * console.log(O.isSome(decoded)); // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const Envelope = {
  schema,
  frameResult,
  decodeResult,
  decodeSelectedResult,
  decodeAllResult,
  lastValidResult,
  encodeResult,
  decode,
  encode,
};
