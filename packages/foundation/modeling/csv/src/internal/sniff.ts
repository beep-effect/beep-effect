// Delimiter detection, papaparse's rule as the app met it: for each candidate in order, read the sample's first ten
// records with it and measure how consistent their widths are (the sum of width changes between consecutive records)
// and how wide they are on average. The most consistent candidate whose average is above 1.99 wins; ties go to the
// wider. A sample that is the whole input and ends with a line break counts one more, empty record after it, as
// papaparse's preview does; that is why a two-record file read alone falls back to a comma.
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { end, MachineState, push } from "./machine.ts";
import type { CsvDelimiter, CsvReadOptions } from "../CsvOptions.schema.ts";
import type { MachineConfig } from "./machine.ts";

/** Characters of text the delimiter is detected from, as the app's old reader's first piece. */
export const SNIFF_WINDOW = 256 * 1024;

const PREVIEW = 10;
const PIECE = 4096;

const widthsWith = (
  sample: string,
  delimiter: CsvDelimiter,
  limits: CsvReadOptions["limits"]
): ReadonlyArray<number> => {
  const config: MachineConfig = {
    delimiter,
    quotes: "lenient",
    ragged: "keep",
    blankLines: "keep",
    trim: "none",
    limits,
  };
  let state = MachineState.initial;
  const widths: Array<number> = [];
  let at = 0;
  while (at < sample.length && widths.length < PREVIEW && !state.stopped) {
    const step = push(state, Str.slice(at, at + PIECE)(sample), config);
    state = step.state;
    for (const record of step.records) widths.push(record.cells.length);
    at += PIECE;
  }
  if (widths.length < PREVIEW && !state.stopped) {
    const endsAtBoundary = !state.content && !state.held && sample.length > 0;
    const last = end(state, config);
    for (const record of last.records) widths.push(record.cells.length);
    if (endsAtBoundary) widths.push(1);
  }
  return A.take(widths, PREVIEW);
};

/**
 * The detected delimiter, or none when no candidate splits the first records consistently into two or more cells.
 */
export const sniffDelimiter = (input: {
  readonly sample: string;
  readonly candidates: ReadonlyArray<CsvDelimiter>;
  readonly limits: CsvReadOptions["limits"];
}): O.Option<CsvDelimiter> => {
  const { sample, candidates, limits } = input;
  let best: O.Option<{ readonly delimiter: CsvDelimiter; readonly delta: number; readonly average: number }> = O.none();
  for (const delimiter of candidates) {
    const widths = widthsWith(sample, delimiter, limits);
    const [first, ...rest] = widths;
    if (first === undefined) continue;
    let previous = first;
    let delta = 0;
    for (const width of rest) {
      delta += Math.abs(width - previous);
      previous = width;
    }
    const average = A.reduce(widths, 0, (sum, width) => sum + width) / widths.length;
    if (average <= 1.99) continue;
    const better = O.match(best, {
      onNone: () => true,
      onSome: (current) => delta < current.delta || (delta === current.delta && average > current.average),
    });
    if (better) best = O.some({ delimiter, delta, average });
  }
  return O.map(best, (found) => found.delimiter);
};
