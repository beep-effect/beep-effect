// The reading channels' state, one chunk at a time. Text: the first text is held until its start is decided and,
// when the delimiter is detected, until it fills the detection window; then one machine reads every chunk. Bytes: the
// detect window is held until it is full, then the decided decoding turns each chunk into text. Held input is kept as
// the chunks that came, appended in place and joined once, so a chunk costs time in its own length. A step returns
// fatal findings as schema values; the `Csv` facade turns them into the `CsvParseError` the channel fails with.
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
import { bomOf, decodeBytes, decoderFor, firstInvalidUtf8 } from "./encoding.ts";
import { built, Machine } from "./machine.ts";
import { SNIFF_WINDOW } from "./sniff.ts";
import { prepare, Start, startDecided, startOf } from "./start.ts";
import type { LazyArg } from "effect/Function";
import type { CsvReadOptions } from "../CsvOptions.schema.ts";
import type { CsvRecordSlice } from "../CsvTable.schema.ts";
import type { Prepared } from "./start.ts";

/** The fatal findings that stop a channel. */
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

// ── text ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The first text, held until its start is decided: a byte-order mark, and a `sep=` line when one is honoured. */
interface Opening {
  readonly head: string;
  readonly phase: "opening";
}

/** The text after a decided start, held in pieces until it fills the detection window. */
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

/** Where the text channel is: holding its start, holding text to detect the delimiter from, or reading. */
type TextPending = Opening | Sniffing | Running;

/** The records of a step, or the findings that stopped it. */
type TextEmitted = Result.Result<A.NonEmptyReadonlyArray<CsvRecordSlice>, Fatals>;

type TextStep = readonly [TextPending, ReadonlyArray<TextEmitted>];

const fatalsOf = A.filter(CsvDiagnostic.guards.fatal);

/** A step's records, then the findings that stopped it, each only when there is one. */
const slicesOf = (machine: Machine): ReadonlyArray<TextEmitted> => [
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
  return [{ phase: "running", machine }, slicesOf(machine.feed(prepared.text))];
};

const sniffedStart = (sniffing: Sniffing): Start =>
  Start.make({ bom: sniffing.bom, sep: O.none(), text: A.join(sniffing.pieces, "") }, built);

/** Runs once the detection window is full; the pieces are joined once, here or at the end of the input. */
const sniffStep = (sniffing: Sniffing, options: CsvReadOptions): TextStep =>
  sniffing.length >= SNIFF_WINDOW ? startRunning(prepare(sniffedStart(sniffing), options)) : [sniffing, []];

/**
 * The first text so far. An undecided start is at most a BOM and `sep=X\r`, so reading it again with each chunk costs
 * that chunk's length. Once decided, the start is a whole read's: a fixed delimiter or a `sep=` line reads at once,
 * and a detected one waits for the detection window.
 */
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
        (chunk: string): TextStep => [running, running.machine.stopped ? [] : slicesOf(running.machine.feed(chunk))],
    })
  );

const haltRunning = (running: Running): ReadonlyArray<TextEmitted> =>
  running.machine.stopped ? [] : slicesOf(running.machine.finish());

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
      sniffing: (sniffing) => (options: CsvReadOptions) => startAndHalt(sniffedStart(sniffing), options),
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

// ── bytes ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The detect window, held in pieces until it is full. */
interface Window {
  readonly phase: "window";
  readonly pieces: Array<Uint8Array>;
  readonly size: number;
}

type Decoding =
  | Window
  | { readonly phase: "utf8"; readonly carry: Uint8Array; readonly at: number }
  | { readonly phase: "fixed"; readonly decoder: TextDecoder };

/** The bytes channel's decoding so far and the bytes it has seen, against the byte cap. */
interface BytesPending {
  readonly decoding: Decoding;
  readonly over: boolean;
  readonly seen: number;
}

/** A decoded piece of text, or the findings that stopped the decoding. */
type DecodedText = Result.Result<string, Fatals>;

type DecodingStep = readonly [Decoding, ReadonlyArray<DecodedText>];

const failWith = (finding: InvalidUtf8 | TooManyBytes): DecodedText => Result.fail([CsvFatal.make({ finding })]);

// crispen: kept as a loop — it copies each piece into one buffer once; no Effect module concatenates byte arrays.
const concatBytes = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const out = new Uint8Array(Num.sumAll(A.map(parts, (part) => part.length)));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

// crispen: kept as a loop — it reads at most the last three bytes of a chunk, back to the first that starts a
// UTF-8 sequence; no Effect module reads a partial UTF-8 tail.
/** How many trailing bytes start a UTF-8 sequence that the chunk does not finish. */
const incompleteTail = (bytes: Uint8Array): number => {
  for (let back = 1; back <= Num.min(3, bytes.length); back += 1) {
    const b = bytes[bytes.length - back] ?? 0;
    if ((b & 0xc0) === 0x80) continue;
    const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
    return need > back ? back : 0;
  }
  return 0;
};

const fixedStep = (decoder: TextDecoder, bytes: Uint8Array): DecodingStep => [
  { phase: "fixed", decoder },
  [Result.succeed(decoder.decode(bytes, { stream: true }))],
];

const utf8Step = (carry: Uint8Array, at: number, chunk: Uint8Array): DecodingStep => {
  const bytes = concatBytes([carry, chunk]);
  const keep = incompleteTail(bytes);
  const whole = bytes.subarray(0, bytes.length - keep);
  return O.match(firstInvalidUtf8(whole), {
    onSome: (invalid): DecodingStep => [
      { phase: "utf8", carry: new Uint8Array(0), at },
      [failWith(InvalidUtf8.make({ byteOffset: at + invalid }))],
    ],
    onNone: () => {
      const text = decodeBytes({ bytes: whole, encoding: "utf-8" });
      return [
        { phase: "utf8", carry: bytes.slice(bytes.length - keep), at: at + whole.length },
        Str.isNonEmpty(text) ? [Result.succeed(text)] : [],
      ];
    },
  });
};

/**
 * Decides the encoding from the detect window: a UTF-16 BOM, else whether the window is valid UTF-8. A byte-order
 * mark stays in the decoded text; the text reader strips it, as it does for a whole read. Before the end of the input
 * an unfinished UTF-8 sequence at the window's end may still be completed, so it does not count; at the end it does,
 * and the window decides as a whole read does.
 */
const decideWindow = (bytes: Uint8Array, final: boolean): DecodingStep => {
  const mark = bomOf(bytes);
  if (O.isSome(mark) && mark.value !== "utf-8") return fixedStep(decoderFor(mark.value), bytes);
  const decided = final ? bytes : bytes.subarray(0, bytes.length - incompleteTail(bytes));
  return O.isSome(firstInvalidUtf8(decided))
    ? fixedStep(decoderFor("windows-1252"), bytes)
    : utf8Step(new Uint8Array(0), 0, bytes);
};

/** Fills the detect window, or decodes at once when the options fix the encoding. */
const windowStep = (window: Window, options: CsvReadOptions): DecodingStep =>
  CsvEncodingChoice.match(options.encoding, {
    fixed: ({ encoding }): DecodingStep => {
      const bytes = concatBytes(window.pieces);
      return encoding === "utf-8" ? utf8Step(new Uint8Array(0), 0, bytes) : fixedStep(decoderFor(encoding), bytes);
    },
    detect: (detect): DecodingStep =>
      ByteSize.isGreaterThanOrEqualTo(ByteSize.bytes(BigInt(window.size)), detect.window)
        ? decideWindow(concatBytes(window.pieces), false)
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
        ({ carry, at }) =>
        (chunk: Uint8Array) =>
          utf8Step(carry, at, chunk),
      window: (window) => (chunk: Uint8Array, options: CsvReadOptions) => {
        window.pieces.push(chunk);
        return windowStep({ ...window, size: window.size + chunk.length }, options);
      },
    })
  );

/** What is left at the end of the bytes: a decoder's tail, an unfinished UTF-8 sequence, or an undecided window. */
const haltDecoding: (decoding: Decoding) => ReadonlyArray<DecodedText> = Match.type<Decoding>().pipe(
  Match.discriminatorsExhaustive("phase")({
    fixed: ({ decoder }): ReadonlyArray<DecodedText> => [Result.succeed(decoder.decode())],
    utf8: ({ carry, at }): ReadonlyArray<DecodedText> =>
      carry.length > 0 ? [failWith(InvalidUtf8.make({ byteOffset: at }))] : [],
    window: ({ pieces }): ReadonlyArray<DecodedText> => {
      const [next, texts] = decideWindow(concatBytes(pieces), true);
      return [...texts, ...haltDecoding(next)];
    },
  })
);

/** One byte chunk: counted against the byte cap first, so a stream fails as soon as it has read past the cap. */
const stepChunk = (
  pending: BytesPending,
  chunk: Uint8Array,
  options: CsvReadOptions
): readonly [BytesPending, ReadonlyArray<DecodedText>] => {
  if (pending.over) return [pending, []];
  const seen = pending.seen + chunk.length;
  const size = ByteSize.bytes(BigInt(seen));
  if (ByteSize.isGreaterThan(size, options.limits.maxInputBytes))
    return [
      { ...pending, seen, over: true },
      [failWith(TooManyBytes.make({ maximum: options.limits.maxInputBytes, actual: size }))],
    ];
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
    const initial: readonly [BytesPending, ReadonlyArray<DecodedText>] = [pending, []];
    return A.reduce(chunks, initial, ([state, texts], chunk): readonly [BytesPending, ReadonlyArray<DecodedText>] => {
      const [next, more] = stepChunk(state, chunk, options);
      return [next, A.appendAll(texts, more)];
    });
  },
  halt: (pending) => (pending.over ? [] : haltDecoding(pending.decoding)),
});
