// decision: papaparse-delimiter-detection
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { CsvLimits } from "../CsvOptions.schema.ts";
import { MAX_TEXT_UNITS } from "../CsvPosition.schema.ts";
import { MAX_FIELDS } from "../CsvTable.schema.ts";
import { Machine, MachineConfig } from "./machine.ts";
import type { CsvDelimiter } from "../CsvOptions.schema.ts";

/** Characters of text the delimiter is detected from, as the app's old reader's first piece. */
export const SNIFF_WINDOW = 256 * 1024;

const PREVIEW_LIMITS_WIDEST_SO_ONLY_THE_SAMPLE_BOUNDS = CsvLimits.make({
  maxFieldsPerRecord: MAX_FIELDS,
  maxFieldLength: MAX_TEXT_UNITS,
  maxRecordLength: MAX_TEXT_UNITS,
  maxPaddingCells: MAX_TEXT_UNITS,
});

const PREVIEW_RECORDS = 10;
const PAPAPARSE_TRAILING_EMPTY_RECORD_WIDTH = 1;
const PIECE = 4096;

const widthsOf = (machine: Machine): ReadonlyArray<number> => A.map(machine.takeCells(), A.length);

// decision: imperative-engine-loops
const widthsWith = (sample: string, delimiter: CsvDelimiter): ReadonlyArray<number> => {
  const machine = Machine.start(
    MachineConfig.make({ delimiter, limits: PREVIEW_LIMITS_WIDEST_SO_ONLY_THE_SAMPLE_BOUNDS })
  );
  let widths: ReadonlyArray<number> = A.empty();
  let at = 0;
  while (at < sample.length && widths.length < PREVIEW_RECORDS && !machine.stopped) {
    widths = A.appendAll(widths, widthsOf(machine.feed(Str.slice(at, at + PIECE)(sample))));
    at += PIECE;
  }
  if (widths.length < PREVIEW_RECORDS && !machine.stopped) {
    const endsAtBoundary = machine.atRecordBoundary && sample.length > 0;
    widths = A.appendAll(widths, widthsOf(machine.finish()));
    if (endsAtBoundary) widths = A.append(widths, PAPAPARSE_TRAILING_EMPTY_RECORD_WIDTH);
  }
  return A.take(widths, PREVIEW_RECORDS);
};

const splitsIntoTwoOrMoreOnAverage = (score: Score): boolean => score.average > 1.99;

interface Score {
  readonly average: number;
  readonly delimiter: CsvDelimiter;
  readonly delta: number;
}

const scoreOf =
  (sample: string) =>
  (delimiter: CsvDelimiter): O.Option<Score> =>
    A.match(widthsWith(sample, delimiter), {
      onEmpty: O.none,
      onNonEmpty: (widths) =>
        O.liftPredicate(
          {
            delimiter,
            delta: Num.sumAll(A.zipWith(widths, A.drop(widths, 1), (previous, width) => Math.abs(width - previous))),
            average: Num.sumAll(widths) / widths.length,
          },
          splitsIntoTwoOrMoreOnAverage
        ),
    });

const moreConsistentThenWiderThenEarlier = (current: Score, next: Score): Score =>
  next.delta < current.delta || (next.delta === current.delta && next.average > current.average) ? next : current;

/**
 * The detected delimiter, or none when no candidate splits the first records consistently into two or more cells.
 * The read's caps do not change it.
 */
export const sniffDelimiter = (input: {
  readonly sample: string;
  readonly candidates: ReadonlyArray<CsvDelimiter>;
}): O.Option<CsvDelimiter> =>
  A.match(A.getSomes(A.map(input.candidates, scoreOf(input.sample))), {
    onEmpty: O.none,
    onNonEmpty: (scores) =>
      O.some(A.reduce(A.tailNonEmpty(scores), A.headNonEmpty(scores), moreConsistentThenWiderThenEarlier).delimiter),
  });
