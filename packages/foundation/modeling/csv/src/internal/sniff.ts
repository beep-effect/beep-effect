// Delimiter detection, papaparse's rule as the app met it: for each candidate in order, read the sample's first ten
// records with it and measure how consistent their widths are (the sum of width changes between consecutive records)
// and how wide they are on average. The most consistent candidate whose average is above 1.99 wins; ties go to the
// wider. A sample that ends with a line break, the whole input or a cut prefix of a longer one, counts one more, empty
// record after it, as papaparse's preview does; that is why a two-record file read alone falls back to a comma.
// The preview reads under the widest caps, not the read's: a cap the first records pass would otherwise stop the
// right candidate's preview and hand the read to another delimiter, which might pass no cap. The read that follows
// enforces the read's caps under the delimiter detected. The sample is at most `SNIFF_WINDOW` units, which bounds
// what the preview holds.
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

/** The caps a preview reads under: the widest each cap allows, so only the sample's own length bounds it. */
const PREVIEW_LIMITS = CsvLimits.make({
  maxFieldsPerRecord: MAX_FIELDS,
  maxFieldLength: MAX_TEXT_UNITS,
  maxRecordLength: MAX_TEXT_UNITS,
  maxPaddingCells: MAX_TEXT_UNITS,
});

const PREVIEW = 10;
const PIECE = 4096;

const widthsOf = (machine: Machine): ReadonlyArray<number> => A.map(machine.takeCells(), A.length);

// crispen: kept as a loop — it stops reading the sample as soon as ten records are seen, which a fold over every
// piece would not.
const widthsWith = (sample: string, delimiter: CsvDelimiter): ReadonlyArray<number> => {
  const machine = Machine.start(MachineConfig.make({ delimiter, limits: PREVIEW_LIMITS }));
  let widths: ReadonlyArray<number> = A.empty();
  let at = 0;
  while (at < sample.length && widths.length < PREVIEW && !machine.stopped) {
    widths = A.appendAll(widths, widthsOf(machine.feed(Str.slice(at, at + PIECE)(sample))));
    at += PIECE;
  }
  if (widths.length < PREVIEW && !machine.stopped) {
    const endsAtBoundary = machine.atRecordBoundary && sample.length > 0;
    widths = A.appendAll(widths, widthsOf(machine.finish()));
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
          (score) => score.average > 1.99
        ),
    });

/** The more consistent score, the wider on a tie; the earlier on a full tie. */
const better = (current: Score, next: Score): Score =>
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
    onNonEmpty: (scores) => O.some(A.reduce(A.tailNonEmpty(scores), A.headNonEmpty(scores), better).delimiter),
  });
