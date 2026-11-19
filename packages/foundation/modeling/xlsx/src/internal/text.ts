// Which text a workbook's XML can carry. XML 1.0 has no way to write a control character other than a tab or a line
// break, nor a lone surrogate, U+FFFE or U+FFFF. Cell text gets Excel's `_xHHHH_` escape for them
// (internal/writer.ts); a sheet name, a formula and a format code have no escape and so may not hold them.

// Built from text, not written as a pattern literal, so the escapes stay escapes whatever formats this file.
const unsafe = new RegExp(
  "[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\ufffe\\uffff]" +
    "|[\\ud800-\\udbff](?![\\udc00-\\udfff])" +
    "|(?<![\\ud800-\\udbff])[\\udc00-\\udfff]"
);

/** Whether `text` can be written into a workbook part without an escape and read back unchanged. */
export const isXmlSafe = (text: string): boolean => !unsafe.test(text);
