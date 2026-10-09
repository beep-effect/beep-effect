/**
 * Frame-first JSONL codecs. Payload validation runs only for selected lines.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as A from "effect/Array";
import { constant, dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Tuple from "effect/Tuple";
import { InvalidData, type MalformedLine, UnknownEvent, UnserializableData } from "./JsonlError.ts";
import type { DataSchema, JsonlEvent } from "./JsonlEvent.ts";
import { Line } from "./Line.ts";
import { LineSlice } from "./LineSlice.ts";

const $I = $ScratchpadId.create("effected/jsonl/Envelope");

/**
 * The wire frame, decoded before selection without traversing its payload.
 * A transient Struct avoids allocating a class for frames that are discarded.
 *
 * **Example** (Read a frame without validating its payload)
 * ```ts import.meta.vitest name="Read a frame without validating its payload"
 * import { EnvelopeFrame } from "@beep/scratchpad/effected/jsonl/Envelope";
 * import * as S from "effect/Schema";
 * import * as Result from "effect/Result";
 * const result = S.decodeResult(EnvelopeFrame)({ at: "2026-10-06T00:00:00Z", event: "started", data: null });
 * Result.isSuccess(result) // => true
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

const input = <Tag extends string, Data>(tag: Tag, data: S.Codec<Data, unknown>) =>
  S.Struct({
    at: S.DateTimeUtcFromString,
    event: S.tag(tag),
    scope: S.optionalKey(S.String),
    data,
  }).annotate(
    $I.annote("EnvelopeInput", { description: "An event input with its wire timestamp and payload codecs." })
  );

const schema = <Tag extends string, Data>(tag: Tag, data: S.Codec<Data, unknown>) =>
  S.Struct({ ...input(tag, data).fields, at: S.DateTimeUtc, line: LineSlice }).annotate(
    $I.annote("Envelope", { description: "A selected event with its decoded payload and source line." })
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
// As upstream's encoder signature: an explicitly undefined scope is accepted and omitted.
type InputOf<E extends JsonlEvent.Any> = E extends JsonlEvent.Any
  ? Omit<EnvelopeOf<E>, "line" | "scope"> & { readonly scope?: string | undefined }
  : never;
type Encoding<R extends JsonlEvent.Registry> = InputOf<R[number]>;

// Each owned registry carries its compiled tag index for its entire lifetime.
class Registry<R extends JsonlEvent.Registry> {
  readonly events: ReadonlyArray<R[number]>;
  readonly index: HashMap.HashMap<string, number>;

  constructor(events: R) {
    this.events = A.copy(events);
    this.index = HashMap.fromIterable(A.map(this.events, (event, position) => Tuple.make(event.tag, position)));
  }
}

const registry = <const R extends JsonlEvent.Registry>(events: R | Registry<R>): Registry<R> =>
  events instanceof Registry ? events : new Registry(events);

const definition = <R extends JsonlEvent.Registry>(events: R | Registry<R>, tag: string): O.Option<R[number]> => {
  const owned = registry(events);
  return HashMap.get(owned.index, tag).pipe(O.flatMap((position) => A.get(owned.events, position)));
};
const decodeFrame = S.decodeUnknownResult(EnvelopeFrame);
const encodeAt = S.encodeUnknownResult(S.DateTimeUtcFromString);
const encodeScope = S.encodeUnknownResult(
  S.Struct({ scope: S.optionalKey(S.String) }).annotate(
    $I.annote("EnvelopeScope", { description: "The optional scope key an encoder input writes." })
  )
);
const encodeJson = S.encodeResult(S.fromJsonString(S.Unknown));
const emptyLine = LineSlice.make({ offset: 0, end: 0, length: 0, text: "", terminated: false });

// The envelope codec only runs on a frame that passed EnvelopeFrame and whose tag
// selected it, so its failure is the payload's. Report it as the payload codec
// does, with issue paths relative to data; the envelope error is kept otherwise.
const payloadError = (data: DataSchema, value: unknown, error: S.SchemaError): S.SchemaError =>
  pipe(S.decodeUnknownResult(data)(value), Result.flip, Result.getOrElse(constant(error)));

const completeResult = <R extends JsonlEvent.Registry>(
  events: R | Registry<R>,
  line: LineSlice,
  frame: EnvelopeFrame
): Result.Result<EnvelopeUnion<R>, DecodeError> => {
  const owned = registry(events);
  const found = definition(owned, frame.event);
  if (O.isNone(found)) {
    return Result.fail(
      UnknownEvent.make({ line, event: frame.event, known: A.map(owned.events, (event) => event.tag) })
    );
  }
  const codec: R[number]["envelope"] = found.value.envelope;
  return S.decodeResult(codec)({ ...frame, line }).pipe(
    Result.mapError((error) =>
      InvalidData.make({ line, event: O.some(frame.event), error: payloadError(found.value.data, frame.data, error) })
    )
  );
};

const frameResult = (
  line: LineSlice
): Result.Result<EnvelopeFrame & { readonly line: LineSlice }, MalformedLine | InvalidData> =>
  Line.parseResult(line).pipe(
    Result.flatMap(({ value }) =>
      decodeFrame(value).pipe(Result.mapError((error) => InvalidData.make({ line, event: O.none(), error })))
    ),
    Result.map((frame) => ({ ...frame, line }))
  );

const decodeResult: {
  <const R extends JsonlEvent.Registry>(
    line: LineSlice,
    events: R | Registry<R>
  ): Result.Result<EnvelopeUnion<R>, DecodeError>;
  <const R extends JsonlEvent.Registry>(
    events: R | Registry<R>
  ): (line: LineSlice) => Result.Result<EnvelopeUnion<R>, DecodeError>;
} = dual(
  2,
  <R extends JsonlEvent.Registry>(line: LineSlice, events: R | Registry<R>): Result.Result<EnvelopeUnion<R>, DecodeError> =>
    frameResult(line).pipe(Result.flatMap((frame) => completeResult(events, line, frame)))
);

const decodeSelectedResult: {
  <const R extends JsonlEvent.Registry>(
    line: LineSlice,
    events: R | Registry<R>,
    select: (frame: EnvelopeFrame) => boolean
  ): O.Option<Result.Result<EnvelopeUnion<R>, DecodeError>>;
  <const R extends JsonlEvent.Registry>(
    events: R | Registry<R>,
    select: (frame: EnvelopeFrame) => boolean
  ): (line: LineSlice) => O.Option<Result.Result<EnvelopeUnion<R>, DecodeError>>;
} = dual(
  3,
  <R extends JsonlEvent.Registry>(
    line: LineSlice,
    events: R | Registry<R>,
    select: (frame: EnvelopeFrame) => boolean
  ): O.Option<Result.Result<EnvelopeUnion<R>, DecodeError>> => {
    const frame = frameResult(line);
    if (Result.isFailure(frame)) return frame.failure.pipe(Result.fail, O.some);
    return select(frame.success) ? O.some(completeResult(events, line, frame.success)) : O.none();
  }
);

const decodeAllResult: {
  <const R extends JsonlEvent.Registry>(
    text: string,
    events: R | Registry<R>
  ): ReadonlyArray<Result.Result<EnvelopeUnion<R>, DecodeError>>;
  <const R extends JsonlEvent.Registry>(
    events: R | Registry<R>
  ): (text: string) => ReadonlyArray<Result.Result<EnvelopeUnion<R>, DecodeError>>;
} = dual(
  2,
  <R extends JsonlEvent.Registry>(
    text: string,
    events: R | Registry<R>
  ): ReadonlyArray<Result.Result<EnvelopeUnion<R>, DecodeError>> =>
    pipe(
      Line.split(text),
      A.filter((line) => !Line.isBlank(line)),
      A.map(decodeResult(registry(events)))
    )
);

const lastValidResult: {
  <const R extends JsonlEvent.Registry>(text: string, events: R | Registry<R>): O.Option<EnvelopeUnion<R>>;
  <const R extends JsonlEvent.Registry>(events: R | Registry<R>): (text: string) => O.Option<EnvelopeUnion<R>>;
} = dual(
  2,
  <R extends JsonlEvent.Registry>(text: string, events: R | Registry<R>): O.Option<EnvelopeUnion<R>> => {
    const owned = registry(events);
    return pipe(
      Line.split(text),
      A.findLast((line) => (Line.isBlank(line) ? O.none() : Result.getSuccess(decodeResult(line, owned))))
    );
  }
);

// A Schema.Class declaration's first type parameter is its structural field
// codec. The registered codec has no services, so neither do those fields.
// Encode a plain decoded patch through that codec; the envelope decoder then
// creates the class instance once, before any bytes are written.
const patchCodec = (data: DataSchema): DataSchema => {
  const ast = data.ast;
  if (!P.isFunction(data) || !SchemaAST.isDeclaration(ast)) return data;
  return A.head(ast.typeParameters).pipe(
    O.map((fields) => S.make<DataSchema>(fields)),
    O.getOrElse(constant(data))
  );
};

const encodeResultWith = <R extends JsonlEvent.Registry>(
  envelope: Encoding<NoInfer<R>>,
  events: R | Registry<R>,
  patch: boolean
): Result.Result<string, EncodeError> => {
  const owned = registry(events);
  const found = definition(owned, envelope.event);
  if (O.isNone(found)) {
    return Result.fail(
      UnknownEvent.make({ line: emptyLine, event: envelope.event, known: A.map(owned.events, (event) => event.tag) })
    );
  }
  // Upstream's order and roots: the payload codec, then the timestamp codec,
  // each on its own value, then the scope check that keeps the frame readable.
  const encoded = Result.all({
    data: S.encodeUnknownResult(patch ? patchCodec(found.value.data) : found.value.data)(envelope.data),
    at: encodeAt(envelope.at),
    scope: encodeScope(O.getSomesStruct({ scope: O.fromUndefinedOr(envelope.scope) })),
  });
  if (Result.isFailure(encoded))
    return Result.fail(InvalidData.make({ line: emptyLine, event: O.some(envelope.event), error: encoded.failure }));
  const { at, scope, data } = encoded.success;
  return encodeJson({ at, event: envelope.event, ...scope, data: data === undefined ? null : data }).pipe(
    Result.map((text) => `${text}\n`),
    Result.mapError((cause) => UnserializableData.make({ event: envelope.event, cause }))
  );
};

type Encoder = {
  <const R extends JsonlEvent.Registry>(
    envelope: Encoding<NoInfer<R>>,
    events: R | Registry<R>
  ): Result.Result<string, EncodeError>;
  <const R extends JsonlEvent.Registry>(
    events: R | Registry<R>
  ): (envelope: Encoding<NoInfer<R>>) => Result.Result<string, EncodeError>;
};

const encodeResult: Encoder = dual(
  2,
  <R extends JsonlEvent.Registry>(envelope: Encoding<NoInfer<R>>, events: R | Registry<R>) =>
    encodeResultWith(envelope, events, false)
);

const encodePatchResult: Encoder = dual(
  2,
  <R extends JsonlEvent.Registry>(envelope: Encoding<NoInfer<R>>, events: R | Registry<R>) =>
    encodeResultWith(envelope, events, true)
);

const decode: {
  <const R extends JsonlEvent.Registry>(
    line: LineSlice,
    events: R | Registry<R>
  ): Effect.Effect<EnvelopeUnion<R>, DecodeError>;
  <const R extends JsonlEvent.Registry>(
    events: R | Registry<R>
  ): (line: LineSlice) => Effect.Effect<EnvelopeUnion<R>, DecodeError>;
} = dual(
  2,
  Effect.fn("Envelope.decode")(function* <R extends JsonlEvent.Registry>(line: LineSlice, events: R | Registry<R>) {
    return yield* Effect.fromResult(decodeResult(line, events));
  })
);

const encode: {
  <const R extends JsonlEvent.Registry>(
    envelope: Encoding<NoInfer<R>>,
    events: R | Registry<R>
  ): Effect.Effect<string, EncodeError>;
  <const R extends JsonlEvent.Registry>(
    events: R | Registry<R>
  ): (envelope: Encoding<NoInfer<R>>) => Effect.Effect<string, EncodeError>;
} = dual(
  2,
  Effect.fn("Envelope.encode")(function* <R extends JsonlEvent.Registry>(envelope: Encoding<NoInfer<R>>, events: R | Registry<R>) {
    return yield* Effect.fromResult(encodeResult(envelope, events));
  })
);

/**
 * Synchronous codecs and their lazy Effect counterparts. Each binary operation
 * takes the processed line, text or envelope first; supplying only the registry
 * returns its pipeable form. Selected decoding filters the frame before data.
 *
 * **Example** (Decode in a pipeline)
 * ```ts import.meta.vitest name="Decode in a pipeline"
 * import { Envelope, JsonlEvent, Line } from "@beep/scratchpad/effected/jsonl/index";
 * import { pipe } from "effect/Function";
 * import * as A from "effect/Array";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 * const events = [JsonlEvent.make("started", { data: S.String })];
 * const decoded = pipe(Line.split('{"at":"2026-10-06T00:00:00Z","event":"started","data":"ready"}'), A.head, O.map(Envelope.decodeResult(events)));
 * O.isSome(decoded) // => true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const Envelope = {
  /**
   * Copies event membership and order into an owned readonly registry and compiles its tag index once.
   *
   * **Example** (Keep caller mutation outside the registry)
   * ```ts
   * import { Envelope, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
   * import * as S from "effect/Schema";
   * const events = [JsonlEvent.make("started", { data: S.String })];
   * const owned = Envelope.registry(events);
   * owned.events[0].tag // => "started"
   * ```
   * @category constructors
   * @since 0.0.0
   */
  registry,
  /**
   * Builds the registered event's input codec, validating its tag, scope and payload while encoding its timestamp.
   *
   * **Example** (Encode a validated input)
   * ```ts import.meta.vitest name="Encode a validated input"
   * import { Envelope } from "@beep/scratchpad/effected/jsonl/Envelope";
   * import * as DateTime from "effect/DateTime";
   * import * as Result from "effect/Result";
   * import * as S from "effect/Schema";
   * const codec = Envelope.input("started", S.String);
   * Result.map(S.encodeResult(codec)({ at: DateTime.makeUnsafe(0), event: "started", data: "ready" }), (frame) => frame.at) // => Result.succeed("1970-01-01T00:00:00.000Z")
   * ```
   * @category schemas
   * @since 0.0.0
   */
  input,
  /**
   * Constructs the runtime schema for one decoded envelope, including its source line. The data codec is applied to decoded input; wire frames are decoded separately.
   *
   * **Example** (Validate a decoded envelope)
   *
   * ```ts import.meta.vitest name="Validate a decoded envelope"
   * import { Envelope, Line } from "@beep/scratchpad/effected/jsonl/index";
   * import * as A from "effect/Array";
   * import * as O from "effect/Option";
   * import * as S from "effect/Schema";
   * const text = '{"at":"2026-10-06T00:00:00Z","event":"started","data":"ready"}';
   * const line = O.getOrThrow(A.head(Line.split(text)));
   * import * as DateTime from "effect/DateTime";
   * const schema = Envelope.schema("started", S.String);
   * S.is(schema)({at:DateTime.makeUnsafe(0),event:"started",data:"ready",line}) // => true
   * ```
   *
   * @category schemas
   * @since 0.0.0
   */
  schema,
  /**
   * Parses JSON and validates the timestamp, tag and optional scope while leaving data unknown. A malformed frame is reported even when a later selection would exclude it.
   *
   * **Example** (Read a frame without its registry)
   *
   * ```ts import.meta.vitest name="Read a frame without its registry"
   * import { Envelope, Line } from "@beep/scratchpad/effected/jsonl/index";
   * import * as A from "effect/Array";
   * import * as O from "effect/Option";
   * const text = '{"at":"2026-10-06T00:00:00Z","event":"started","data":"ready"}';
   * const line = O.getOrThrow(A.head(Line.split(text)));
   * import * as Result from "effect/Result";
   * Result.map(Envelope.frameResult(line), (frame) => frame.event) // => Result.succeed("started")
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  frameResult,
  /**
   * Validates one line with its registered payload codec; a payload failure's issue path is relative to data. Supply the registry last, or curry the registry and pipe the line into the result. An owned registry reuses its compiled index without changing the caller's array.
   *
   * **Example** (Pipe a line through its registry)
   *
   * ```ts import.meta.vitest name="Pipe a line through its registry"
   * import { Envelope, JsonlEvent, Line } from "@beep/scratchpad/effected/jsonl/index";
   * import * as A from "effect/Array";
   * import * as O from "effect/Option";
   * import * as S from "effect/Schema";
   * const events = [JsonlEvent.make("started", { data: S.String })];
   * const text = '{"at":"2026-10-06T00:00:00Z","event":"started","data":"ready"}';
   * const line = O.getOrThrow(A.head(Line.split(text)));
   * import { pipe } from "effect/Function";
   * import * as Result from "effect/Result";
   * pipe(line, Envelope.decodeResult(events), Result.map((row) => row.data)) // => Result.succeed("ready")
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  decodeResult,
  /**
   * Applies selection to the validated frame before decoding data. None means excluded; Some contains either the decoded envelope or its typed failure. Frame failures are always reported.
   *
   * **Example** (Exclude a frame before payload validation)
   *
   * ```ts import.meta.vitest name="Exclude a frame before payload validation"
   * import { Envelope, JsonlEvent, Line } from "@beep/scratchpad/effected/jsonl/index";
   * import * as A from "effect/Array";
   * import * as O from "effect/Option";
   * import * as S from "effect/Schema";
   * const events = [JsonlEvent.make("started", { data: S.String })];
   * const text = '{"at":"2026-10-06T00:00:00Z","event":"started","data":"ready"}';
   * const line = O.getOrThrow(A.head(Line.split(text)));
   * Envelope.decodeSelectedResult(line, events, (frame) => frame.event === "closed") // => O.none()
   * ```
   *
   * @category filtering
   * @since 0.0.0
   */
  decodeSelectedResult,
  /**
   * Decodes every nonblank line in source order. Each line has its own Result, including malformed interior lines and an incomplete final line.
   *
   * **Example** (Preserve a malformed interior line)
   *
   * ```ts import.meta.vitest name="Preserve a malformed interior line"
   * import { Envelope, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
   * import * as A from "effect/Array";
   * import * as S from "effect/Schema";
   * const events = [JsonlEvent.make("started", { data: S.String })];
   * const text = '{"at":"2026-10-06T00:00:00Z","event":"started","data":"ready"}';
   * import * as Result from "effect/Result";
   * A.map(Envelope.decodeAllResult(text + "\nbad\n", events), Result.isSuccess) // => [true, false]
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  decodeAllResult,
  /**
   * Walks backward to the last valid registered envelope. Malformed JSON, unknown tags and invalid payloads are skipped; None means no envelope is valid. A scalar torn tail cannot count as an envelope.
   *
   * **Example** (Walk back past a scalar torn tail)
   *
   * ```ts import.meta.vitest name="Walk back past a scalar torn tail"
   * import { Envelope, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
   * import * as O from "effect/Option";
   * import * as S from "effect/Schema";
   * const events = [JsonlEvent.make("started", { data: S.String })];
   * const text = '{"at":"2026-10-06T00:00:00Z","event":"started","data":"ready"}';
   * Envelope.lastValidResult(text + "\n4", events).pipe(O.map((row) => row.data)) // => O.some("ready")
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  lastValidResult,
  /**
   * Validates the payload with its registered codec, then the timestamp and the scope, and returns one JSON line including its newline. A payload failure's issue path is relative to data, and a timestamp failure carries no path. Void payloads encode as null, and an absent or undefined scope is omitted. Unserializable values fail in the Result channel.
   *
   * **Example** (Encode a correlated payload with a terminator)
   *
   * ```ts import.meta.vitest name="Encode a correlated payload with a terminator"
   * import { Envelope, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
   * import * as S from "effect/Schema";
   * const events = [JsonlEvent.make("started", { data: S.String })];
   * import * as DateTime from "effect/DateTime";
   * import * as Result from "effect/Result";
   * import * as Str from "effect/String";
   * const encoded = Envelope.encodeResult({at:DateTime.makeUnsafe(0),event:"started",data:"ready"}, events);
   * Result.map(encoded, Str.endsWith("\n")) // => Result.succeed(true)
   * ```
   *
   * @category encoding
   * @since 0.0.0
   */
  encodeResult,
  /**
   * Encodes a transient plain patch through a class payload's structural fields.
   * Decode the resulting envelope to construct its payload instance.
   *
   * **Example** (Encode patched class fields before decoding)
   * ```ts
   * import { Envelope, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
   * import * as DateTime from "effect/DateTime";
   * import * as S from "effect/Schema";
   * import { $ScratchpadId } from "@beep/identity/packages";
   * const $I = $ScratchpadId.create("examples/jsonl/patch");
   * class Payload extends S.Class<Payload>($I`Payload`)({ count: S.Number }) {}
   * const events = Envelope.registry([JsonlEvent.make("updated", { data: Payload })]);
   * Envelope.encodePatchResult({ at: DateTime.makeUnsafe(0), event: "updated", data: { count: 2 } }, events);
   * ```
   * @category encoding
   * @since 0.0.0
   */
  encodePatchResult,
  /**
   * Lazily decodes a line in Effect, preserving the synchronous decoder's typed errors. Supply the registry to the curried form when piping a line.
   *
   * **Example** (Decode a line in Effect)
   *
   * ```ts import.meta.vitest name="Decode a line in Effect"
   * import { Envelope, JsonlEvent, Line } from "@beep/scratchpad/effected/jsonl/index";
   * import * as A from "effect/Array";
   * import * as O from "effect/Option";
   * import * as S from "effect/Schema";
   * const events = [JsonlEvent.make("started", { data: S.String })];
   * const text = '{"at":"2026-10-06T00:00:00Z","event":"started","data":"ready"}';
   * const line = O.getOrThrow(A.head(Line.split(text)));
   * import * as Effect from "effect/Effect";
   * const program = Effect.gen(function* () {
   *   const envelope = yield* Envelope.decode(line, events);
   *   envelope.data // => "ready"
   * });
   * await Effect.runPromise(program);
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  decode,
  /**
   * Lazily validates and encodes an envelope in Effect. Constructing the Effect performs no encoding; typed validation and serialization failures occur only when it runs.
   *
   * **Example** (Encode a payload lazily)
   *
   * ```ts import.meta.vitest name="Encode a payload lazily"
   * import { Envelope, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
   * import * as S from "effect/Schema";
   * const events = [JsonlEvent.make("started", { data: S.String })];
   * import * as Effect from "effect/Effect";
   * import * as DateTime from "effect/DateTime";
   * import * as Str from "effect/String";
   * const program = Envelope.encode({at:DateTime.makeUnsafe(0),event:"started",data:"ready"}, events);
   * Str.endsWith("\n")(await Effect.runPromise(program)) // => true
   * ```
   *
   * @category encoding
   * @since 0.0.0
   */
  encode,
};
