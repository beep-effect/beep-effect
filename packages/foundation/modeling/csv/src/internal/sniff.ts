// Delimiter detection, papaparse's rule as the app met it: for each candidate in order, read the sample's first ten
// records with it and measure how consistent their widths are (the sum of width changes between consecutive records)
// and how wide they are on average. The most consistent candidate whose average is above 1.99 wins; ties go to the
// wider. A sample that is the whole input and ends with a line break counts one more, empty record after it, as
// papaparse's preview does; that is why a two-record file read alone falls back to a comma.
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { end, MachineConfig, MachineState, push } from "./machine.ts";
import type { CsvDelimiter, CsvReadOptions } from "../CsvOptions.schema.ts";
import type { Step } from "./machine.ts";

type Limits = CsvReadOptions["limits"];

/** Characters of text the delimiter is detected from, as the app's old reader's first piece. */
export const SNIFF_WINDOW = 256 * 1024;

const PREVIEW = 10;
const PIECE = 4096;

const widthsOf = (step: Step): ReadonlyArray<number> => A.map(step.records, (record) => record.cells.length);

// crispen: kept as a loop — it stops reading the sample as soon as ten records are seen, which a fold over every
// piece would not.
const widthsWith = (sample: string, delimiter: CsvDelimiter, limits: Limits): ReadonlyArray<number> => {
  const config = MachineConfig.make({ delimiter, limits });
  let state = MachineState.initial;
  let widths: ReadonlyArray<number> = A.empty();
  let at = 0;
  while (at < sample.length && widths.length < PREVIEW && !state.stopped) {
    const step = push(state, Str.slice(at, at + PIECE)(sample), config);
    state = step.state;
    widths = A.appendAll(widths, widthsOf(step));
    at += PIECE;
  }
  if (widths.length < PREVIEW && !state.stopped) {
    const endsAtBoundary = !state.content && !state.held && sample.length > 0;
    widths = A.appendAll(widths, widthsOf(end(state, config)));
    if (endsAtBoundary) widths = A.append(widths, 1);
  }
  return A.take(widths, PREVIEW);
};

interface Score {
  readonly average: number;
  readonly delimiter: CsvDelimiter;
  readonly delta: number;
}

/** How consistently and how widely a candidate splits the sample, or none when it splits into fewer than two. */
const scoreOf =
  (sample: string, limits: Limits) =>
  (delimiter: CsvDelimiter): O.Option<Score> =>
    A.match(widthsWith(sample, delimiter, limits), {
      onEmpty: O.none,
      onNonEmpty: (widths) =>
        O.liftPredicate(
          {
            delimiter,
            delta: Num.sumAll(A.zipWith(widths, A.drop(widths, 1), (previous, width) => Math.abs(width - previous))),
            average: Num.sumAll(widths) / widths.length,
          },
          (score) => score.average > 1.99
        ),
    });

/** The more consistent score, the wider on a tie; the earlier on a full tie. */
const better = (current: Score, next: Score): Score =>
  next.delta < current.delta || (next.delta === current.delta && next.average > current.average) ? next : current;

/**
 * The detected delimiter, or none when no candidate splits the first records consistently into two or more cells.
 */
export const sniffDelimiter = (input: {
  readonly sample: string;
  readonly candidates: ReadonlyArray<CsvDelimiter>;
  readonly limits: Limits;
}): O.Option<CsvDelimiter> =>
  A.match(A.getSomes(A.map(input.candidates, scoreOf(input.sample, input.limits))), {
    onEmpty: O.none,
    onNonEmpty: (scores) => O.some(A.reduce(A.tailNonEmpty(scores), A.headNonEmpty(scores), better).delimiter),
  });
