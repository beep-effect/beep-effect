// decision: engine-findings-facade-fails
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Channel from "effect/Channel";
import { flow } from "effect/Function";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { CsvDiagnostic, CsvFatal, InvalidUtf8, TooManyBytes } from "../CsvDiagnostic.schema.ts";
import { CsvEncodingChoice } from "../CsvOptions.schema.ts";
import { decoderFor, detectEncoding, firstInvalidUtf8 } from "./encoding.ts";
import { built, Machine } from "./machine.ts";
import { SNIFF_WINDOW } from "./sniff.ts";
import { prepare, Start, startDecided, startOf } from "./start.ts";
import type { LazyArg } from "effect/Function";
import type { CsvReadOptions } from "../CsvOptions.schema.ts";
import type { CsvRecordSlice } from "../CsvTable.schema.ts";
import type { Prepared } from "./start.ts";

type Fatals = A.NonEmptyReadonlyArray<CsvFatal>;

/** How a channel reads its input: its first state, one step per input batch, and what it emits at the end. */
export interface ChannelSteps<In, State, Out> {
  readonly halt: (state: State) => ReadonlyArray<Out>;
  readonly initial: LazyArg<State>;
  readonly step: (state: State, input: In) => readonly [State, ReadonlyArray<Out>];
}

/**
 * A channel that runs `steps`, as `Channel.mapAccum` does, except that `halt` runs only when the upstream ends: an
 * upstream failure passes through as it came, and nothing is flushed before it. (`mapAccum`'s own `onHalt` runs on a
 * failure too, and emits ahead of it.)
 */
export const mapAccumToEnd =
  <In, State, Out>(steps: ChannelSteps<In, State, Out>) =>
  <OutErr, OutDone, InElem, InErr, InDone, Env>(
    self: Channel.Channel<In, OutErr, OutDone, InElem, InErr, InDone, Env>
  ): Channel.Channel<Out, OutErr, OutDone, InElem, InErr, InDone, Env> =>
    self.pipe(
      Channel.map(O.some<In>),
      Channel.concatWith((done: OutDone) => Channel.concat(Channel.succeed(O.none<In>()), Channel.end(done))),
      Channel.mapAccum(steps.initial, (state: State, input: O.Option<In>) =>
        O.match(input, {
          onNone: (): readonly [State, ReadonlyArray<Out>] => [state, steps.halt(state)],
          onSome: (chunk) => steps.step(state, chunk),
        })
      )
    );

interface Opening {
  readonly head: string;
  readonly phase: "opening";
}

interface Sniffing {
  readonly bom: boolean;
  readonly length: number;
  readonly phase: "sniffing";
  readonly pieces: Array<string>;
}

interface Running {
  readonly machine: Machine;
  readonly phase: "running";
}

type TextPending = Opening | Sniffing | Running;

type TextEmitted = Result.Result<A.NonEmptyReadonlyArray<CsvRecordSlice>, Fatals>;

type TextStep = readonly [TextPending, ReadonlyArray<TextEmitted>];

/** The fatal diagnostics among a read's findings, in order. */
export const fatalsOf = A.filter(CsvDiagnostic.guards.fatal);

const recordsThenFatalsOf = (machine: Machine): ReadonlyArray<TextEmitted> => [
  ...A.match(machine.takeSlices(), {
    onEmpty: A.empty<TextEmitted>,
    onNonEmpty: flow(Result.succeed, A.of<TextEmitted>),
  }),
  ...A.match(fatalsOf(machine.takeDiagnostics()), {
    onEmpty: A.empty<TextEmitted>,
    onNonEmpty: flow(Result.fail, A.of<TextEmitted>),
  }),
];

const startRunning = (prepared: Prepared): readonly [Running, ReadonlyArray<TextEmitted>] => {
  const machine = Machine.start(prepared.config);
  return [{ phase: "running", machine }, recordsThenFatalsOf(machine.feed(prepared.text))];
};

const joinHeldPiecesOnce = (sniffing: Sniffing): Start =>
  Start.make({ bom: sniffing.bom, sep: O.none(), text: A.join(sniffing.pieces, "") }, built);

const sniffStep = (sniffing: Sniffing, options: CsvReadOptions): TextStep =>
  sniffing.length >= SNIFF_WINDOW ? startRunning(prepare(joinHeldPiecesOnce(sniffing), options)) : [sniffing, []];

const openStep = (head: string, options: CsvReadOptions): TextStep => {
  if (!startDecided(head, options)) return [{ phase: "opening", head }, []];
  const start = startOf(head, options);
  return options.delimiter.kind === "fixed" || O.isSome(start.sep)
    ? startRunning(prepare(start, options))
    : sniffStep({ phase: "sniffing", bom: start.bom, pieces: [start.text], length: start.text.length }, options);
};

const stepPending: (pending: TextPending) => (chunk: string, options: CsvReadOptions) => TextStep =
  Match.type<TextPending>().pipe(
    Match.discriminatorsExhaustive("phase")({
      opening:
        ({ head }) =>
        (chunk: string, options: CsvReadOptions) =>
          openStep(`${head}${chunk}`, options),
      sniffing: (sniffing) => (chunk: string, options: CsvReadOptions) => {
        sniffing.pieces.push(chunk);
        return sniffStep({ ...sniffing, length: sniffing.length + chunk.length }, options);
      },
      running:
        (running) =>
        (chunk: string): TextStep => [
          running,
          running.machine.stopped ? [] : recordsThenFatalsOf(running.machine.feed(chunk)),
        ],
    })
  );

const haltRunning = (running: Running): ReadonlyArray<TextEmitted> =>
  running.machine.stopped ? [] : recordsThenFatalsOf(running.machine.finish());

const startAndHalt = (start: Start, options: CsvReadOptions): ReadonlyArray<TextEmitted> => {
  const [started, emitted] = startRunning(prepare(start, options));
  return [...emitted, ...haltRunning(started)];
};

const haltPending: (pending: TextPending) => (options: CsvReadOptions) => ReadonlyArray<TextEmitted> =
  Match.type<TextPending>().pipe(
    Match.discriminatorsExhaustive("phase")({
      opening:
        ({ head }) =>
        (options: CsvReadOptions) =>
          startAndHalt(startOf(head, options), options),
      sniffing: (sniffing) => (options: CsvReadOptions) => startAndHalt(joinHeldPiecesOnce(sniffing), options),
      running: (running) => () => haltRunning(running),
    })
  );

/**
 * How the text channel reads under `options`: chunk by chunk, and at the end a held start is read as it is and the
 * last record flushed.
 */
export const textSteps = (options: CsvReadOptions): ChannelSteps<ReadonlyArray<string>, TextPending, TextEmitted> => ({
  initial: (): TextPending => ({ phase: "opening", head: "" }),
  step: (pending, chunks) => stepPending(pending)(A.join(chunks, ""), options),
  halt: (pending) => haltPending(pending)(options),
});

interface Window {
  readonly phase: "window";
  readonly pieces: Array<Uint8Array>;
  readonly size: number;
}

type Decoding =
  | Window
  | { readonly phase: "utf8"; readonly carry: Uint8Array; readonly at: number; readonly decoder: TextDecoder }
  | { readonly phase: "fixed"; readonly decoder: TextDecoder };

interface BytesPending {
  readonly decoding: Decoding;
  readonly over: boolean;
  readonly seen: number;
}

type DecodedText = Result.Result<string, Fatals>;

type DecodingStep = readonly [Decoding, ReadonlyArray<DecodedText>];

const failWith = (finding: InvalidUtf8 | TooManyBytes): DecodedText => Result.fail([CsvFatal.make({ finding })]);

// decision: imperative-engine-loops
const concatBytes = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const out = new Uint8Array(Num.sumAll(A.map(parts, (part) => part.length)));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const isContinuation = (byte: number): boolean => (byte & 0xc0) === 0x80;

const sequenceLengthFromLeadHighBits = (lead: number): number => {
  if (lead >= 0xf0) return 4;
  if (lead >= 0xe0) return 3;
  return lead >= 0xc0 ? 2 : 1;
};

// decision: imperative-engine-loops
const unfinishedSequenceTailLength = (bytes: Uint8Array): number => {
  const reach = Num.min(3, bytes.length);
  let back = 1;
  while (back <= reach && isContinuation(bytes[bytes.length - back] ?? 0)) back += 1;
  if (back > reach) return 0;
  return sequenceLengthFromLeadHighBits(bytes[bytes.length - back] ?? 0) > back ? back : 0;
};

const textOf = (text: string): ReadonlyArray<DecodedText> => (Str.isNonEmpty(text) ? [Result.succeed(text)] : []);

const fixedStep = (decoder: TextDecoder, bytes: Uint8Array): DecodingStep => [
  { phase: "fixed", decoder },
  [Result.succeed(decoder.decode(bytes, { stream: true }))],
];

const utf8Step = (carry: Uint8Array, at: number, decoder: TextDecoder, chunk: Uint8Array): DecodingStep => {
  const bytes = carry.length === 0 ? chunk : concatBytes([carry, chunk]);
  const keep = unfinishedSequenceTailLength(bytes);
  const whole = bytes.subarray(0, bytes.length - keep);
  return O.match(firstInvalidUtf8(whole), {
    onSome: (invalid): DecodingStep => [
      { phase: "utf8", carry: new Uint8Array(0), at, decoder },
      [...textOf(decoder.decode(whole.subarray(0, invalid))), failWith(InvalidUtf8.make({ byteOffset: at + invalid }))],
    ],
    onNone: (): DecodingStep => [
      { phase: "utf8", carry: bytes.slice(bytes.length - keep), at: at + whole.length, decoder },
      textOf(decoder.decode(whole)),
    ],
  });
};

const startUtf8 = (bytes: Uint8Array): DecodingStep => utf8Step(new Uint8Array(0), 0, decoderFor("utf-8"), bytes);

const UNFINISHED_UTF8_SEQUENCE_MAX_BYTES = 3;

const decideWindow = (bytes: Uint8Array, window: O.Option<number>): DecodingStep => {
  const encoding = O.match(window, {
    onNone: () => detectEncoding({ bytes }),
    onSome: (within) =>
      detectEncoding({ bytes: bytes.subarray(0, within + UNFINISHED_UTF8_SEQUENCE_MAX_BYTES), within }),
  });
  return encoding.encoding === "utf-8" ? startUtf8(bytes) : fixedStep(decoderFor(encoding.encoding), bytes);
};

const windowStep = (window: Window, options: CsvReadOptions): DecodingStep =>
  CsvEncodingChoice.match(options.encoding, {
    fixed: ({ encoding }): DecodingStep => {
      const bytes = concatBytes(window.pieces);
      return encoding === "utf-8" ? startUtf8(bytes) : fixedStep(decoderFor(encoding), bytes);
    },
    detect: (detect): DecodingStep =>
      ByteSize.isGreaterThan(
        ByteSize.bytes(BigInt(Num.max(0, window.size - UNFINISHED_UTF8_SEQUENCE_MAX_BYTES))),
        detect.window
      )
        ? decideWindow(concatBytes(window.pieces), O.some(Number(detect.window)))
        : [window, []],
  });

const stepDecoding: (decoding: Decoding) => (chunk: Uint8Array, options: CsvReadOptions) => DecodingStep =
  Match.type<Decoding>().pipe(
    Match.discriminatorsExhaustive("phase")({
      fixed:
        ({ decoder }) =>
        (chunk: Uint8Array) =>
          fixedStep(decoder, chunk),
      utf8:
        ({ at, carry, decoder }) =>
        (chunk: Uint8Array) =>
          utf8Step(carry, at, decoder, chunk),
      window: (window) => (chunk: Uint8Array, options: CsvReadOptions) => {
        window.pieces.push(chunk);
        return windowStep({ ...window, size: window.size + chunk.length }, options);
      },
    })
  );

const haltDecoding: (decoding: Decoding) => ReadonlyArray<DecodedText> = Match.type<Decoding>().pipe(
  Match.discriminatorsExhaustive("phase")({
    fixed: ({ decoder }): ReadonlyArray<DecodedText> => [Result.succeed(decoder.decode())],
    utf8: ({ carry, at }): ReadonlyArray<DecodedText> =>
      carry.length > 0 ? [failWith(InvalidUtf8.make({ byteOffset: at }))] : [],
    window: ({ pieces }): ReadonlyArray<DecodedText> => {
      const [next, texts] = decideWindow(concatBytes(pieces), O.none());
      return [...texts, ...haltDecoding(next)];
    },
  })
);

type BytesStep = readonly [BytesPending, ReadonlyArray<DecodedText>];

const passCap = (pending: BytesPending, chunk: Uint8Array, seen: number, options: CsvReadOptions): BytesStep => {
  const { maxInputBytes } = options.limits;
  const [decoding, texts] = stepDecoding(pending.decoding)(
    chunk.subarray(0, Number(maxInputBytes) - pending.seen),
    options
  );
  return [
    { decoding, seen, over: true },
    [...texts, failWith(TooManyBytes.make({ maximum: maxInputBytes, actual: ByteSize.bytes(BigInt(seen)) }))],
  ];
};

const stepChunk = (pending: BytesPending, chunk: Uint8Array, options: CsvReadOptions): BytesStep => {
  if (pending.over) return [pending, []];
  const seen = pending.seen + chunk.length;
  if (ByteSize.isGreaterThan(ByteSize.bytes(BigInt(seen)), options.limits.maxInputBytes))
    return passCap(pending, chunk, seen, options);
  const [decoding, texts] = stepDecoding(pending.decoding)(chunk, options);
  return [{ decoding, seen, over: false }, texts];
};

/**
 * How the bytes channel reads under `options`: each batch of chunks counted and decoded in order, and at the end the
 * rest decoded, unless the cap already stopped the bytes.
 */
export const bytesSteps = (
  options: CsvReadOptions
): ChannelSteps<ReadonlyArray<Uint8Array>, BytesPending, DecodedText> => ({
  initial: (): BytesPending => ({ decoding: { phase: "window", pieces: [], size: 0 }, seen: 0, over: false }),
  step: (pending, chunks) => {
    const initial: BytesStep = [pending, []];
    return A.reduce(chunks, initial, ([state, texts], chunk): BytesStep => {
      const [next, more] = stepChunk(state, chunk, options);
      return [next, A.appendAll(texts, more)];
    });
  },
  halt: (pending) => (pending.over ? [] : haltDecoding(pending.decoding)),
});
