// The one place a value takes its schema's brand without the schema walking it again. The sheet reader builds
// hundreds of thousands of cells, each from parts it has just checked (a finite number, text within the cap, an
// error code from the list), and `make` on every one costs more than reading the file. What keeps this honest is
// the tests: every workbook read from a fixture, a generated file or a hostile one is held to `S.is(XlsxWorkbook)`.
import * as Str from "effect/String";

/** A value the reader has checked field by field, as the branded type it is. */
export const trusted = <Branded>(value: object): Branded => value as Branded;

/**
 * Text that no longer shares memory with the XML it was cut from. A string taken from a parsed chunk can keep the
 * whole chunk alive; a cell's text is kept for as long as the workbook is, so it is copied.
 */
export const detached = (text: string): string => {
  if (text.length < 13) return text;
  const copy = ` ${text}`;
  return copy[0] === " " ? Str.substring(1)(copy) : text;
};
