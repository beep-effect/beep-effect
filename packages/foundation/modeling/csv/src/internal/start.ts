// A read's start, shared by whole reads and streams: an optional byte-order mark, then, when the options honour one,
// an Excel `sep=` line naming the delimiter, then the text; and the delimiter the read settles on and the machine
// rules it reads by.
import { $CsvId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { CsvDelimiter, CsvDelimiterChoice } from "../CsvOptions.schema.ts";
import { CsvIndex } from "../CsvPosition.schema.ts";
import {
  CsvDelimiterDetected,
  CsvDelimiterFallback,
  CsvDelimiterFound,
  CsvDelimiterFromSepLine,
  CsvDelimiterGiven,
} from "../CsvRead.schema.ts";
import { built, MachineConfig } from "./machine.ts";
import { SNIFF_WINDOW, sniffDelimiter } from "./sniff.ts";
import type { CsvReadOptions } from "../CsvOptions.schema.ts";

const $I = $CsvId.create("internal/start");

const sepLine = /^sep=([,;\t|])(\r\n|\n|\r)/;

/** A start more input could still turn into a `sep=` line, or change its line break (`sep=;\r` may be `sep=;\r\n`). */
const openSepLine = /^(?:s|se|sep|sep=|sep=[,;\t|]|sep=[,;\t|]\r)?$/;

/** A first line such as `sep=;`: the delimiter it names and how many units it spans. */
const SepLine = S.Struct({
  delimiter: CsvDelimiter.pipe(S.annotateKey({ description: "The delimiter the line names" })),
  length: CsvIndex.pipe(S.annotateKey({ description: "Units the line spans, its line break included" })),
}).pipe($I.annoteSchema("SepLine", { description: "An Excel sep= first line" }));

/** The input's start, read: whether it had a byte-order mark, its `sep=` line when honoured, and the text after. */
export class Start extends S.Opaque<Start, { readonly brand: unique symbol }>()(
  S.Struct({
    bom: S.Boolean.pipe(S.annotateKey({ description: "Whether the input began with a byte-order mark" })),
    sep: S.Option(SepLine).pipe(S.annotateKey({ description: "The sep= line, when one was honoured" })),
    text: S.String.pipe(S.annotateKey({ description: "The text after the mark and the sep= line" })),
  }).pipe($I.annoteSchema("Start", { description: "A read's start" }))
) {}

/** A read start with its delimiter settled and the rules the machine reads it by. */
export class Prepared extends S.Opaque<Prepared, { readonly brand: unique symbol }>()(
  S.Struct({
    ...Struct.pick(Start.fields, ["bom", "text"]),
    config: MachineConfig,
    delimiter: CsvDelimiterFound.pipe(S.annotateKey({ description: "How the delimiter was found" })),
  }).pipe($I.annoteSchema("Prepared", { description: "A read start with its delimiter settled" }))
) {}

const sepLineOf = (text: string): O.Option<typeof SepLine.Type> =>
  O.flatMap(O.fromNullishOr(sepLine.exec(text)), (match) =>
    O.map(O.filter(O.fromNullishOr(match[1]), S.is(CsvDelimiter)), (delimiter) => ({
      delimiter,
      length: match[0].length,
    }))
  );

const unmarked = (input: string): string => (Str.startsWith("\uFEFF")(input) ? Str.slice(1)(input) : input);

/** Strips a BOM and, when asked, a `sep=` line. */
export const startOf: {
  (options: CsvReadOptions): (input: string) => Start;
  (input: string, options: CsvReadOptions): Start;
} = dual(2, (input: string, options: CsvReadOptions): Start => {
  const text = unmarked(input);
  const sep = options.excelSepHint ? sepLineOf(text) : O.none();
  return Start.make(
    {
      bom: text.length < input.length,
      sep,
      text: O.getOrElse(
        O.map(sep, ({ length }) => Str.slice(length)(text)),
        () => text
      ),
    },
    built
  );
});

/**
 * Whether more input could no longer change what {@link startOf} makes of a stream's first text: a BOM is decided by
 * the first unit, a `sep=` line once its line break is known.
 */
export const startDecided: {
  (options: CsvReadOptions): (input: string) => boolean;
  (input: string, options: CsvReadOptions): boolean;
} = dual(
  2,
  (input: string, options: CsvReadOptions): boolean =>
    Str.isNonEmpty(input) && !(options.excelSepHint && openSepLine.test(unmarked(input)))
);

/** The delimiter the options fix, or the one detected from the text's start, or the comma fallback. */
const settleDelimiter = (text: string, options: CsvReadOptions): CsvDelimiterFound =>
  CsvDelimiterChoice.match(options.delimiter, {
    fixed: ({ delimiter }) => CsvDelimiterGiven.make({ delimiter }),
    detect: ({ candidates }) =>
      O.getOrElse(
        O.map(
          sniffDelimiter({ sample: Str.slice(0, SNIFF_WINDOW)(text), candidates, limits: options.limits }),
          (delimiter) => CsvDelimiterDetected.make({ delimiter })
        ),
        () => CsvDelimiterFallback.make({})
      ),
  });

/** Settles the delimiter of a read start: from its `sep=` line, else as the options say. */
export const prepare: {
  (options: CsvReadOptions): (start: Start) => Prepared;
  (start: Start, options: CsvReadOptions): Prepared;
} = dual(2, (start: Start, options: CsvReadOptions): Prepared => {
  const delimiter = O.getOrElse(
    O.map(start.sep, ({ delimiter }): CsvDelimiterFound => CsvDelimiterFromSepLine.make({ delimiter })),
    () => settleDelimiter(start.text, options)
  );
  return Prepared.make(
    {
      text: start.text,
      bom: start.bom,
      delimiter,
      config: MachineConfig.make({
        delimiter: delimiter.delimiter,
        quotes: options.quotes,
        ragged: options.ragged,
        blankLines: options.blankLines,
        trim: options.trim,
        limits: options.limits,
      }),
    },
    built
  );
});
