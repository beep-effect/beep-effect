/**
 * The stray-output recorder, ported from upstream
 * `packages/sdk/src/utils/stray-output.ts`: counts the non-blank lines a run
 * wrote around the runner's console capture, per stream, with their bytes
 * and the first few lines as samples, in bounded memory. The reader takes
 * the snapshot a capture published on Vitest's `Logger`.
 *
 * The capture's install point (wrapping the `Logger`'s output streams) is
 * not ported: the adapter patches no stream. A capture that some other party
 * publishes under {@link STRAY_OUTPUT_SOURCE} is read at the end of a run.
 *
 * @since 0.0.0
 */
import { stripEscapes } from "@beep/gate-report/Escapes";
import { StrayOutput, StrayOutputSample } from "@beep/gate-report/StrayOutput";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { OutputStream } from "@beep/gate-report/Vocabulary";

const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/gu;

/**
 * True when `text` is nothing but terminal escape sequences: the cursor and
 * clear-screen writes Vitest's own `Logger` makes. Empty text is not
 * escape-only.
 *
 * @since 0.0.0
 */
export const isEscapeOnly = (text: string): boolean => Str.isNonEmpty(text) && Str.isEmpty(stripEscapes(text));

type RecorderOptions = {
  readonly maxSamples?: number;
  readonly maxSampleChars?: number;
};

/**
 * Records stray output for one run at a time.
 *
 * @since 0.0.0
 */
export type StrayOutputRecorder = {
  /** Record text written to a stream; a write of escapes only is ignored. */
  readonly write: (stream: OutputStream, text: string) => void;
  /** What the run wrote so far, a trailing partial line included. */
  readonly snapshot: () => O.Option<StrayOutput>;
  /** Forget everything: a new run starts. */
  readonly reset: () => void;
};

type Pending = { text: string; cut: boolean };

type Tally = { stdout: number; stderr: number };

const encoder = new TextEncoder();

const clean = (line: string): string => Str.trim(Str.replace(CONTROL, "")(stripEscapes(line)));

/**
 * Make a {@link StrayOutputRecorder}: five samples of at most 160 characters
 * unless told otherwise.
 *
 * @since 0.0.0
 */
export const makeStrayOutputRecorder = (options: RecorderOptions = {}): StrayOutputRecorder => {
  const maxSamples = options.maxSamples ?? 5;
  const maxChars = options.maxSampleChars ?? 160;
  const state = {
    counts: { stdout: 0, stderr: 0 },
    bytes: 0,
    samples: A.empty<StrayOutputSample>(),
    pending: { stdout: { text: "", cut: false }, stderr: { text: "", cut: false } },
  };

  const sampleOf = (line: Pending): string => {
    const text = clean(line.text);
    return line.cut || text.length > maxChars ? `${Str.takeLeft(text, maxChars)}…` : text;
  };

  const finish = (stream: OutputStream, line: Pending, into: Tally, samples: Array<StrayOutputSample>): void => {
    if (Str.isEmpty(clean(line.text))) return;
    into[stream] += 1;
    if (samples.length < maxSamples) samples.push(StrayOutputSample.make({ stream, text: sampleOf(line) }));
  };

  const heldCharsWithEscapeSlack = maxChars * 4;
  const append = (line: Pending, text: string): void => {
    const room = heldCharsWithEscapeSlack - line.text.length;
    if (text.length <= room) {
      line.text = `${line.text}${text}`;
      return;
    }
    line.text = `${line.text}${Str.takeLeft(text, Math.max(0, room))}`;
    line.cut = true;
  };

  const startLine = (stream: OutputStream) => (part: string) => {
    const line = state.pending[stream];
    finish(stream, line, state.counts, state.samples);
    line.text = "";
    line.cut = false;
    append(line, part);
  };

  return {
    write: (stream, text) => {
      if (Str.isEmpty(text) || isEscapeOnly(text)) return;
      state.bytes += encoder.encode(text).length;
      const [first, ...rest] = Str.split(text, "\n");
      append(state.pending[stream], first);
      A.forEach(rest, startLine(stream));
    },
    snapshot: () => {
      const totals = { ...state.counts };
      const samples = [...state.samples];
      finish("stdout", state.pending.stdout, totals, samples);
      finish("stderr", state.pending.stderr, totals, samples);
      const total = totals.stdout + totals.stderr;
      return total === 0
        ? O.none()
        : StrayOutput.makeOption({ total, stdout: totals.stdout, stderr: totals.stderr, bytes: state.bytes, samples });
    },
    reset: () => {
      state.counts = { stdout: 0, stderr: 0 };
      state.bytes = 0;
      state.samples = [];
      state.pending = { stdout: { text: "", cut: false }, stderr: { text: "", cut: false } };
    },
  };
};

/**
 * The key a stray-output capture publishes its snapshot source under, on the
 * Vitest `Logger` whose streams it wraps. `Symbol.for`, so two copies of
 * this module meet on it.
 *
 * @since 0.0.0
 */
export const STRAY_OUTPUT_SOURCE: unique symbol = Symbol.for("@beep/repo-gate-vitest/stray-output");

const isStrayOutput = S.is(StrayOutput);

const snapshotOf = (source: unknown): O.Option<StrayOutput> =>
  pipe(
    O.liftPredicate(source, P.hasProperty("snapshot")),
    O.map((value) => value.snapshot),
    O.filter(P.isFunction),
    O.flatMap((snapshot) =>
      pipe(
        Result.try(() => snapshot()),
        Result.getSuccess
      )
    ),
    O.flatMap((value: unknown) => (O.isOption(value) ? value : O.fromNullishOr(value))),
    O.filter(isStrayOutput)
  );

/**
 * Read the current run's stray output from a Vitest `Logger` a capture was
 * published on; none when nothing was published or the run wrote nothing.
 *
 * @since 0.0.0
 */
export const readStrayOutput = (logger: unknown): O.Option<StrayOutput> =>
  pipe(
    O.liftPredicate(logger, P.hasProperty(STRAY_OUTPUT_SOURCE)),
    O.flatMap((value) => snapshotOf(value[STRAY_OUTPUT_SOURCE]))
  );
