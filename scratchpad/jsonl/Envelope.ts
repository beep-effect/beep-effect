/**
 * The envelope layer: the one opinion this package imposes.
 *
 * Every line is an envelope — `at`, `event`, an optional `scope`, and the
 * payload under `data` — and the payload is validated by the schema registered
 * for its tag. Everything the read vocabulary is built on lives on the
 * envelope, which is why it is a contract rather than a convention.
 *
 * The runtime read path is **two stages**, and the split is what makes the
 * package's headline property true rather than aspirational: the
 * {@link EnvelopeFrame} decodes first with `data` left untouched, filtering
 * reads only frame fields, and the registered payload schema applies **on
 * demand, to selected lines only**. The "derived discriminated union" is the
 * derived *type* — see {@link (Envelope:interface)} — never a `Schema.Union`
 * value on the read path, because discriminating through a union decodes every
 * line's payload eagerly and inverts the guarantee.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as O from "@beep/utils/Option";
import type { DateTime } from "effect";
import { Effect, HashMap, MutableHashMap, Option, Result, Schema } from "effect";
import type { MalformedLine } from "./JsonlError.ts";
import { InvalidData, UnknownEvent, UnserializableData } from "./JsonlError.ts";
import type { DataSchema, JsonlEvent } from "./JsonlEvent.ts";
import { Line } from "./Line.ts";
import { LineSlice } from "./LineSlice.ts";

const $I = $ScratchpadId.create("jsonl/Envelope");

/**
 * Stage one of the read path: the envelope with its payload left undecoded.
 *
 * A `Schema.Struct` rather than a `Schema.Class` deliberately. This is the hot
 * path — it runs for every line of every read, including the lines a `Slice` is
 * about to discard — and it is a transient the caller never holds, so there is
 * nothing to gain from wrapping each one in a class instance.
 *
 * `data` is `Schema.Unknown`, which passes the payload through without
 * traversing it. That is what keeps frame decoding independent of payload
 * depth, and what lets filtering happen before any payload schema runs.
 *
 * **Gotchas**
 *
 * Never put a `Schema.Union` on the read path — filtering must decode this
 * frame first. `Line.lastValid` accepts a torn scalar (`4` from `42`) that is
 * not an envelope; walk back with {@link Envelope.lastValidResult} when the
 * line must be one.
 *
 * **Example** (Decode a raw line's frame with data still unknown)
 *
 * ```ts
 * import { Envelope, Line } from "@beep/scratchpad/jsonl"
 * import { Result } from "effect"
 *
 * const line = Line.split(
 *   '{"at":"2026-01-15T12:00:00.000Z","event":"mail-received","data":{"round":1}}\n',
 * )[0]
 * if (line !== undefined) {
 *   const frame = Envelope.frameResult(line)
 *   console.log(Result.isSuccess(frame)) // true
 *   if (Result.isSuccess(frame)) {
 *     console.log(frame.success.event) // "mail-received"
 *     console.log(frame.success.data) // { round: 1 }
 *   }
 * }
 * ```
 *
 * @see {@link Line.lastValid} for the JSON-only walk-back that does not close torn scalars.
 * @see {@link Envelope.lastValidResult} for the envelope walk-back.
 * @see {@link JsonlEvent} for the registry whose payload schemas stage two applies.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const EnvelopeFrame = Schema.Struct({
  at: Schema.DateTimeUtcFromString,
  event: Schema.String,
  scope: Schema.optionalKey(Schema.String),
  data: Schema.Unknown,
}).pipe(
  $I.annoteSchema("EnvelopeFrame", {
    description: "Stage-one envelope with payload left as unknown JSON.",
  })
);

/**
 * Decoded stage-one envelope produced by {@link EnvelopeFrame}.
 *
 * `data` is still the raw JSON value; the registered payload schema has not run.
 *
 * @see {@link EnvelopeFrame} for the runtime schema and two-stage decode contract.
 * @category type-level
 * @since 0.0.0
 */
export type EnvelopeFrame = typeof EnvelopeFrame.Type;

/**
 * A decoded envelope: the frame, its validated payload, and where it sits in
 * the source.
 *
 * This interface is what the "derived discriminated union" derives *into*.
 * A registry of event definitions produces a union of these discriminated on
 * `event`, so narrowing on the tag recovers the payload type registered for it.
 * It is intentionally type-level: the payload schema is selected dynamically
 * from that registry after {@link EnvelopeFrame} performs the fixed runtime
 * frame decode.
 *
 * @see {@link Envelope} for decode, encode, and the envelope-level walk-back.
 * @see {@link EnvelopeFrame} for the undecoded frame stage one produces.
 * @public
 * @category models
 * @since 0.0.0
 */
export interface Envelope<out Tag extends string, out Data> {
  /** UTC timestamp, assigned by the service at append time from the `Clock`. */
  readonly at: DateTime.Utc;
  /** The event tag: the union discriminant and the primary filter key. */
  readonly event: Tag;
  /** The partition key, with no further semantics. */
  readonly scope?: string | undefined;
  /** The payload, validated against the schema registered for `event`. */
  readonly data: Data;
  /** Where this envelope's line sits in the source, in bytes. */
  readonly line: LineSlice;
}

/**
 * Envelope type derived from one event definition, distributing over a union.
 *
 * @see {@link Envelope} for the interface this alias instantiates.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type EnvelopeOf<E extends JsonlEvent.Any> =
  E extends JsonlEvent<infer Tag, infer Data extends DataSchema, boolean, boolean>
    ? Envelope<Tag, Data["Type"]>
    : never;

/**
 * Discriminated union of every envelope a registry can carry.
 *
 * @see {@link Envelope} for the interface members of this union.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type EnvelopeUnion<R extends JsonlEvent.Registry> = EnvelopeOf<JsonlEvent.Events<R>>;

/**
 * Envelope variant carrying a given tag — the type a slice narrows to.
 *
 * @see {@link Envelope} for the interface this extract refines.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type EnvelopeWithTag<R extends JsonlEvent.Registry, T extends string> = Extract<
  EnvelopeUnion<R>,
  { readonly event: T }
>;

/**
 * The tag→definition lookup, built once per registry rather than once per line.
 *
 * A registry is a frozen array declared at module scope and handed to every
 * call, so it is a legitimate cache key: the same array always indexes to the
 * same map. Building the map per call was measured at 1.23x the cost of this on
 * the per-line decode path — small, but paid once per line of every read, which
 * is exactly the shape of cost this package exists to keep down.
 *
 * Registry arrays use identity equality in `MutableHashMap`, matching the
 * caller-owned registry instance used throughout a journal layer.
 */
const registryIndex = MutableHashMap.empty<JsonlEvent.Registry, HashMap.HashMap<string, JsonlEvent.Any>>();

const indexRegistry = (events: JsonlEvent.Registry): HashMap.HashMap<string, JsonlEvent.Any> => {
  const cached = MutableHashMap.get(registryIndex, events);
  if (Option.isSome(cached)) {
    return cached.value;
  }
  const index = HashMap.fromIterable(events.map((event) => [event.tag, event] as const));
  MutableHashMap.set(registryIndex, events, index);
  return index;
};

const decodeFrame = Schema.decodeUnknownResult(EnvelopeFrame);
const encodeAt = Schema.encodeUnknownResult(Schema.DateTimeUtcFromString);

/**
 * Stage two: apply the registered payload schema to an already-decoded frame.
 *
 * A module-level const rather than a member of the exported `Envelope` object,
 * and deliberately not exported. API Extractor honours release tags on
 * top-level declarations, not on members of an exported object literal — so an
 * `@internal` tag down there is inert text and the member ships as supported
 * public API. Hoisting is what actually keeps it off the surface.
 *
 * Both `decodeResult` and `decodeSelectedResult` call this, so there is exactly
 * one payload-decode path and the filtered and unfiltered forms cannot drift.
 */
const completeResult = <const R extends JsonlEvent.Registry>(
  events: R,
  line: LineSlice,
  frame: EnvelopeFrame
): Result.Result<EnvelopeUnion<R>, MalformedLine | InvalidData | UnknownEvent> => {
  const { at, event, scope, data } = frame;
  const definition = Option.getOrUndefined(HashMap.get(indexRegistry(events), event));
  if (definition === undefined) {
    return Result.fail(UnknownEvent.make({ line, event, known: events.map((e) => e.tag) }));
  }
  const decoded = Schema.decodeUnknownResult(definition.data)(data);
  if (Result.isFailure(decoded)) {
    return Result.fail(InvalidData.make({ line, event: Option.some(event), error: decoded.failure }));
  }
  return Result.succeed({
    at,
    event,
    ...O.getSomesStruct({ scope: O.fromUndefinedOr(scope) }),
    data: decoded.success,
    line,
  } as EnvelopeUnion<R>);
};

/**
 * Decoding, encoding and the envelope-level walk-back.
 *
 * Every operation here is synchronous and `Result`-based; the `Effect` forms are
 * defined **in terms of** the sync ones via `Effect.fromResult`, so the two can
 * never drift into two implementations of the same rule.
 *
 * **Gotchas**
 *
 * Never put a `Schema.Union` on the read path — filter {@link EnvelopeFrame}
 * first. `Schema.Void` encodes to `undefined` and `JSON.stringify` drops that
 * key, so encode emits `null` instead; otherwise the frame could never decode.
 * Unguarded `JSON.stringify` throws at `Effect.fromResult` construction, where
 * no fiber can catch it — that becomes {@link UnserializableData}.
 * `Line.lastValid` accepts a torn scalar that is not an envelope.
 *
 * **Example** (Registry decode and Void encodes as null)
 *
 * ```ts
 * import { Envelope, JsonlEvent, Line } from "@beep/scratchpad/jsonl"
 * import { DateTime, Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const MailReceived = JsonlEvent.make("mail-received", {
 *   data: S.Struct({ round: S.Number }),
 * })
 * const Unlinked = JsonlEvent.make("unlinked", { data: S.Void, terminal: true })
 * const events = [MailReceived, Unlinked] as const
 * const at = DateTime.makeUnsafe("2026-01-15T12:00:00.000Z")
 *
 * const line = Line.split(
 *   '{"at":"2026-01-15T12:00:00.000Z","event":"mail-received","data":{"round":1}}\n',
 * )[0]
 * if (line !== undefined) {
 *   const decoded = Envelope.decodeResult(events, line)
 *   console.log(Result.isSuccess(decoded)) // true
 * }
 *
 * const encoded = Envelope.encodeResult(events, { event: "unlinked", data: undefined, at })
 * console.log(Result.isSuccess(encoded)) // true
 * if (Result.isSuccess(encoded)) {
 *   console.log(encoded.success.includes('"data":null')) // true
 * }
 * ```
 *
 * @see {@link Line.lastValid} for the JSON-only walk-back that does not close torn scalars.
 * @see {@link Envelope.lastValidResult} for the envelope walk-back.
 * @see {@link JsonlEvent} for the registry whose tags and payload schemas these operations use.
 * @see {@link UnserializableData} for a valid payload that cannot be JSON.
 * @public
 * @category codecs
 * @since 0.0.0
 */
export const Envelope = {
  /**
   * Stage one only: decode the frame, leaving `data` untouched.
   *
   * This is what filtering reads. It never runs a payload schema, so its cost
   * is independent of payload size and depth, and a line destined to be
   * filtered out never pays for its payload at all.
   *
   * @param line - A slice from `Line.split`.
   */
  frameResult: (
    line: LineSlice
  ): Result.Result<EnvelopeFrame & { readonly line: LineSlice }, MalformedLine | InvalidData> => {
    const parsed = Line.parseResult(line);
    if (Result.isFailure(parsed)) {
      return Result.fail(parsed.failure);
    }
    const frame = decodeFrame(parsed.success.value);
    if (Result.isFailure(frame)) {
      return Result.fail(InvalidData.make({ line, event: Option.none(), error: frame.failure }));
    }
    return Result.succeed({ ...frame.success, line });
  },

  /**
   * Decode one line into a fully validated envelope, running both stages.
   *
   * @param events - The registry defining which tags are legal and what their
   *   payloads must look like.
   * @param line - A slice from `Line.split`.
   * @returns The envelope, or the typed reason it is not one: not JSON
   *   (`MalformedLine`), not an envelope or a bad payload (`InvalidData`), or
   *   a tag this registry does not define (`UnknownEvent`).
   */
  decodeResult: <const R extends JsonlEvent.Registry>(
    events: R,
    line: LineSlice
  ): Result.Result<EnvelopeUnion<R>, MalformedLine | InvalidData | UnknownEvent> => {
    const frame = Envelope.frameResult(line);
    if (Result.isFailure(frame)) {
      return Result.fail(frame.failure);
    }
    // Delegates to stage two so there is exactly one payload-decode path,
    // shared with the filtered form.
    return completeResult(events, line, frame.success);
  },

  /**
   * Decode a line only if its **frame** is selected, running the payload schema
   * for selected lines only.
   *
   * This is the structural form of the filter-before-decode guarantee: when
   * `select` rejects the frame, the registered `data` schema is never reached,
   * so a consumer reading a journal it shares with a noisy neighbour pays
   * nothing for the neighbour's payloads. Writing the filter *after* a full
   * decode would produce identical output while charging for every line — which
   * is why this exists as its own operation rather than as advice.
   *
   * @param events - The registry to validate against.
   * @param line - A slice from `Line.split`.
   * @param select - Predicate over the decoded frame — `at`, `event`, `scope`
   *   and the raw undecoded `data`.
   * @returns `Option.none()` when the frame is not selected; otherwise the
   *   fully decoded envelope, or the typed reason it is not one.
   */
  decodeSelectedResult: <const R extends JsonlEvent.Registry>(
    events: R,
    line: LineSlice,
    select: (frame: EnvelopeFrame) => boolean
  ): Option.Option<Result.Result<EnvelopeUnion<R>, MalformedLine | InvalidData | UnknownEvent>> => {
    const frame = Envelope.frameResult(line);
    if (Result.isFailure(frame)) {
      return Option.some(Result.fail(frame.failure));
    }
    if (!select(frame.success)) {
      // Stage two never runs. This early return IS the guarantee.
      return Option.none();
    }
    return Option.some(completeResult(events, line, frame.success));
  },

  /**
   * Decode every non-blank line, reporting failures rather than dropping them.
   *
   * Same contract as `Line.parseAll` one layer down: a line that is not a
   * legal envelope is a `Result` in the array, never a gap in it.
   */
  decodeAllResult: <const R extends JsonlEvent.Registry>(
    events: R,
    text: string
  ): ReadonlyArray<Result.Result<EnvelopeUnion<R>, MalformedLine | InvalidData | UnknownEvent>> => {
    const results: Array<Result.Result<EnvelopeUnion<R>, MalformedLine | InvalidData | UnknownEvent>> = [];
    for (const line of Line.split(text)) {
      if (line.text.trim() !== "") {
        results.push(Envelope.decodeResult(events, line));
      }
    }
    return results;
  },

  /**
   * Walk back from the end to the last valid **envelope**.
   *
   * This is the binding definition of "the last valid line", and the envelope
   * layer is where it has to live. `Line.lastValid` stops at JSON validity,
   * which is not enough: a torn scalar tail (`42` cut mid-write leaves `4`)
   * parses cleanly as a different value, so a JSON-level walk-back would hand
   * back corruption as the current state. An envelope is always an object,
   * every strict prefix of an object text is invalid JSON, and a bare `4` is
   * not an envelope — so this walk-back detects the torn tail that the one
   * below it structurally cannot.
   *
   * Decoding stops at the first success, so the cost tracks the damage at the
   * tail rather than the age of the file.
   *
   * @param events - The registry to validate against.
   * @param text - JSONL source text.
   * @returns The last valid envelope, or `Option.none()` if there is none.
   */
  lastValidResult: <const R extends JsonlEvent.Registry>(events: R, text: string): Option.Option<EnvelopeUnion<R>> => {
    const lines = Line.split(text);
    for (let index = lines.length - 1; index >= 0; index--) {
      const line = lines[index];
      if (line === undefined || line.text.trim() === "") {
        continue;
      }
      const decoded = Envelope.decodeResult(events, line);
      if (Result.isSuccess(decoded)) {
        return Option.some(decoded.success);
      }
    }
    return Option.none();
  },

  /**
   * Encode one envelope into a complete JSONL line, terminator included.
   *
   * The trailing `\n` is part of the returned string on purpose: the
   * cooperative-writer contract is one `writeAll` of a *complete line*, and an
   * API that returned the text without its terminator would invite a caller to
   * write the two separately — which is exactly the interleaving the contract
   * exists to prevent.
   *
   * No `Schema.Union` is involved. The tag is known, so the payload schema is
   * a direct registry lookup; a union would buy nothing and decode eagerly.
   *
   * @param events - The registry to validate against.
   * @param envelope - The event tag, its payload, the service-assigned
   *   timestamp, and an optional scope.
   */
  encodeResult: <const R extends JsonlEvent.Registry, const T extends JsonlEvent.Tag<R>>(
    events: R,
    envelope: {
      readonly event: T;
      readonly data: JsonlEvent.Data<R, T>;
      readonly at: DateTime.Utc;
      readonly scope?: string | undefined;
    }
  ): Result.Result<string, UnknownEvent | InvalidData | UnserializableData> => {
    const empty = LineSlice.make({ offset: 0, end: 0, length: 0, text: "", terminated: false });
    const definition = Option.getOrUndefined(HashMap.get(indexRegistry(events), envelope.event));
    if (definition === undefined) {
      return Result.fail(UnknownEvent.make({ line: empty, event: envelope.event, known: events.map((e) => e.tag) }));
    }
    const data = Schema.encodeUnknownResult(definition.data)(envelope.data);
    if (Result.isFailure(data)) {
      return Result.fail(InvalidData.make({ line: empty, event: Option.some(envelope.event), error: data.failure }));
    }
    const at = encodeAt(envelope.at);
    if (Result.isFailure(at)) {
      return Result.fail(InvalidData.make({ line: empty, event: Option.some(envelope.event), error: at.failure }));
    }
    // `JSON.stringify` throws on a bigint or a reference cycle, and a payload
    // schema is free to admit both. Unguarded, that TypeError escapes the typed
    // channel entirely — and via `Effect.fromResult`, which evaluates eagerly,
    // it would throw at Effect CONSTRUCTION where no fiber can catch it.
    let text: string;
    try {
      text = JSON.stringify({
        at: at.success,
        event: envelope.event,
        ...O.getSomesStruct({ scope: O.fromUndefinedOr(envelope.scope) }),
        // `data` is REQUIRED on the frame, so unlike `scope` it can never be
        // spread away. `Schema.Void` encodes to `undefined` and
        // `JSON.stringify` DROPS undefined-valued keys, which would emit a
        // line with no `data` key that the frame could then never decode.
        // JSON has no `undefined`; `null` is its spelling of absence.
        data: data.success === undefined ? null : data.success,
      });
    } catch (cause) {
      return Result.fail(UnserializableData.make({ event: envelope.event, cause }));
    }
    return Result.succeed(`${text}\n`);
  },

  // ── Effect forms ────────────────────────────────────────────────────────
  //
  // Each is a one-line lift of its sync twin through `Effect.fromResult`.
  // There is deliberately no second implementation to keep in step: the rule
  // lives once, in the `*Result` function, and these only change its wrapper.
  // `Effect.fromResult` also puts the failure in the TYPED channel — a raw
  // `yield* someResult` is a compile error in v4 and dies as a defect if
  // forced past the type system.

  /**
   * {@link (Envelope:variable).decodeResult} in the `Effect` channel.
   *
   * Prefer the sync form in a hook or any caller that has no runtime; this
   * exists for programs that already are one.
   */
  decode: <const R extends JsonlEvent.Registry>(
    events: R,
    line: LineSlice
  ): Effect.Effect<EnvelopeUnion<R>, MalformedLine | InvalidData | UnknownEvent> =>
    Effect.fromResult(Envelope.decodeResult(events, line)),

  /**
   * {@link (Envelope:variable).encodeResult} in the `Effect` channel.
   */
  encode: <const R extends JsonlEvent.Registry, const T extends JsonlEvent.Tag<R>>(
    events: R,
    envelope: {
      readonly event: T;
      readonly data: JsonlEvent.Data<R, T>;
      readonly at: DateTime.Utc;
      readonly scope?: string | undefined;
    }
  ): Effect.Effect<string, UnknownEvent | InvalidData | UnserializableData> =>
    Effect.fromResult(Envelope.encodeResult(events, envelope)),
} as const;
