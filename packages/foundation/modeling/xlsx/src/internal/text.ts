import { $XlsxId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $XlsxId.create("internal/text");

const unsafe = new RegExp(
  "[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\ufffe\\uffff]" +
    "|[\\ud800-\\udbff](?![\\udc00-\\udfff])" +
    "|(?<![\\ud800-\\udbff])[\\udc00-\\udfff]"
);

/**
 * Whether `text` can be written into a workbook part without an escape and read back unchanged.
 *
 * **Details**
 * XML 1.0 has no way to write a control character other than a tab or a line break, nor a lone surrogate, U+FFFE or
 * U+FFFF. Cell text gets Excel's `_xHHHH_` escape for them (internal/writer.ts); a sheet name, a formula and a format
 * code have no escape and so may not hold them.
 *
 * **Gotchas**
 * The pattern is built from text, not written as a pattern literal, so its escapes stay escapes whatever formats
 * this file.
 */
export const isXmlSafe = (text: string): boolean => !unsafe.test(text);

/** The check on every text a part carries without an escape: a sheet name, a formula, a number format code. */
export const XmlSafeText = S.makeFilter(
  isXmlSafe,
  $I.annote("XmlSafeText", {
    title: "XML-safe text",
    description: "Text with no control character but a tab or a line break, no lone surrogate, no U+FFFE or U+FFFF",
    expected: "text without control characters or lone surrogates",
  })
);

/**
 * Text that no longer shares memory with the XML it was cut from, so a kept cell does not pin its whole chunk.
 *
 * **Details**
 * In JSC (Bun's engine) a string keeps the chunk it was cut from alive, and a cell's text outlives the parsed XML
 * chunk; prefixing builds a rope that `substring` flattens into a fresh string.
 *
 * **Gotchas**
 * Drop it if a profile shows no retained chunks.
 */
export const detached = (text: string): string => (text.length < 13 ? text : Str.substring(1)(` ${text}`));
