// decision: engine-findings-facade-fails
import { dual } from "effect/Function";
import * as Str from "effect/String";
import { CsvDiagnostic } from "../CsvDiagnostic.schema.ts";
import { CsvFormulaGuard, CsvQuoteRule, CsvRaggedRule, CsvTrimRule } from "../CsvOptions.schema.ts";
import type { RaggedRecord, StrayQuote, TextAfterClosingQuote } from "../CsvDiagnostic.schema.ts";

/** A quoting finding under its rule: a warning when lenient, fatal when strict. */
export const judgeQuote: {
  (finding: StrayQuote | TextAfterClosingQuote): (rule: CsvQuoteRule) => CsvDiagnostic;
  (rule: CsvQuoteRule, finding: StrayQuote | TextAfterClosingQuote): CsvDiagnostic;
} = dual(
  2,
  (rule: CsvQuoteRule, finding: StrayQuote | TextAfterClosingQuote): CsvDiagnostic =>
    CsvQuoteRule.match(rule, {
      lenient: () => CsvDiagnostic.cases.warning.make({ finding }),
      strict: () => CsvDiagnostic.cases.fatal.make({ finding }),
    })
);

/** A ragged record under its rule: a warning when kept or padded, fatal when rejected. */
export const judgeRagged: {
  (finding: RaggedRecord): (rule: CsvRaggedRule) => CsvDiagnostic;
  (rule: CsvRaggedRule, finding: RaggedRecord): CsvDiagnostic;
} = dual(
  2,
  (rule: CsvRaggedRule, finding: RaggedRecord): CsvDiagnostic =>
    CsvRaggedRule.match(rule, {
      keep: () => CsvDiagnostic.cases.warning.make({ finding }),
      pad: () => CsvDiagnostic.cases.warning.make({ finding }),
      reject: () => CsvDiagnostic.cases.fatal.make({ finding }),
    })
);

/** A cell after the trim rule; under `unquoted` the spaces inside quotes stay, because the writer quoted them. */
export const applyTrim: {
  (cell: string, quoted: boolean): (rule: CsvTrimRule) => string;
  (rule: CsvTrimRule, cell: string, quoted: boolean): string;
} = dual(3, (rule: CsvTrimRule, cell: string, quoted: boolean): string =>
  CsvTrimRule.match(rule, {
    none: () => cell,
    unquoted: () => (quoted ? cell : Str.trim(cell)),
    all: () => Str.trim(cell),
  })
);

const formulaStart = /^[=+\-@\t\r]/;

/** A cell after the formula guard: `apostrophe` prefixes `'` to a cell whose first character is in `formulaStart`. */
export const applyFormulaGuard: {
  (cell: string): (guard: CsvFormulaGuard) => string;
  (guard: CsvFormulaGuard, cell: string): string;
} = dual(2, (guard: CsvFormulaGuard, cell: string): string =>
  CsvFormulaGuard.match(guard, {
    none: () => cell,
    apostrophe: () => (formulaStart.test(cell) ? `'${cell}` : cell),
  })
);

/**
 * Whether a cell must be quoted to read back unchanged wherever it stands: it holds the delimiter, a quote, a
 * carriage return or a line feed, or starts with a byte-order mark (which a reader strips at the start of a file).
 * The table's first cell has one more rule, `opensSepLine`.
 */
export const needsQuotes: {
  (delimiter: string): (cell: string) => boolean;
  (cell: string, delimiter: string): boolean;
} = dual(
  2,
  (cell: string, delimiter: string): boolean =>
    Str.includes(delimiter)(cell) ||
    Str.includes('"')(cell) ||
    Str.includes("\r")(cell) ||
    Str.includes("\n")(cell) ||
    Str.startsWith("\uFEFF")(cell)
);

const sepLineStart = /^sep=/i;

/**
 * Whether a table's first cell, written bare, could start a `sep=` line, which a reader honouring `excelSepHint`
 * (and Excel, in any case) takes for the delimiter instead of a record; quoted, it reads back as the cell.
 */
export const opensSepLine = (cell: string): boolean => sepLineStart.test(cell);
