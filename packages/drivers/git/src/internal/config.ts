/**
 * The git-config engine: a lossless, line-oriented scanner producing raw
 * structural records over the source text, plus the splice-based edit
 * primitives the `GitConfig` facade compiles surgical edits into.
 *
 * **Details**
 *
 * Never exported from the package. This module emits raw carriers (plain
 * records with offsets) and never imports the public `GitConfig` classes; the
 * facade materializes typed errors and Schema classes from what it finds here.
 *
 * The grammar is git-config(5), not generic INI:
 *
 * - `[section]` and `[section "subsection"]` headers; section and variable
 *   names are case-insensitive, quoted subsection names are case-sensitive.
 * - The deprecated dotted form `[section.subsection]` splits at the first
 *   dot and lowercases its subsection before case-sensitive comparisons.
 * - Variable names start with a letter and contain letters, digits and `-`.
 * - A bare `key` line (no `=`) is git's boolean-true shorthand.
 * - Values: unquoted trailing whitespace is discarded, internal whitespace
 *   kept verbatim; `"` toggles quoting; `\"`, `\\`, `\n`, `\t`, `\b` are the
 *   recognized escapes; a backslash at end of line continues the value onto
 *   the next line; `#` and `;` start a comment outside quotes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { constant, dual, identity, pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $GitId.create("internal/config");
const DiagnosticJsonString = S.fromJsonString(S.String).pipe(
  $I.annoteSchema("DiagnosticJsonString", { description: "JSON quoting for synchronous scanner diagnostics." })
);
const encodeDiagnosticJsonString = S.encodeResult(DiagnosticJsonString);

/**
 * The shared diagnostic vocabulary emitted by the scanner.
 *
 * **Example** (Recognize a scanner diagnostic code)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { GitConfigDiagnosticCode } from "@beep/git/internal/config";
 *
 * console.log(S.is(GitConfigDiagnosticCode)("invalidEscape")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GitConfigDiagnosticCode = LiteralKit([
  "invalidSectionHeader",
  "invalidKey",
  "invalidLine",
  "unterminatedQuote",
  "invalidEscape",
  "unexpectedCharacter",
]).pipe(
  $I.annoteSchema("GitConfigDiagnosticCode", { description: "The diagnostic codes emitted by the git-config scanner." })
);

/**
 * Decoded value produced by {@link GitConfigDiagnosticCode}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GitConfigDiagnosticCode = typeof GitConfigDiagnosticCode.Type;

/**
 * The scanner's schema-derived diagnostic code type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RawDiagnosticCode = GitConfigDiagnosticCode;

const RawOffset = S.Finite.pipe(
  $I.annoteSchema("RawOffset", { description: "A character offset or length into the scanned git-config text." })
);

/**
 * **Example** (Make a raw scanner diagnostic)
 *
 * ```ts
 * import { RawDiagnostic } from "@beep/git/internal/config";
 *
 * const diagnostic = RawDiagnostic.make({ code: "invalidKey", message: "bad key", offset: 0, length: 4 });
 * console.log(diagnostic.code) // invalidKey
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawDiagnostic extends S.Opaque<RawDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    code: GitConfigDiagnosticCode.pipe(
      $I.annoteKey("RawDiagnostic.code", { description: "The scanner diagnostic code." })
    ),
    length: RawOffset.pipe($I.annoteKey("RawDiagnostic.length", { description: "The diagnostic span length." })),
    message: S.String.pipe(
      $I.annoteKey("RawDiagnostic.message", { description: "The human-readable diagnostic message." })
    ),
    offset: RawOffset.pipe(
      $I.annoteKey("RawDiagnostic.offset", { description: "The diagnostic span's starting character offset." })
    ),
  }).pipe(
    $I.annoteSchema("RawDiagnostic", { description: "One raw scanner diagnostic, positions in character offsets." })
  )
) {}

/**
 * **Example** (Make a raw bare-key entry)
 *
 * ```ts
 * import { RawEntry } from "@beep/git/internal/config";
 *
 * const entry = RawEntry.make({
 *   key: "bare",
 *   keyEnd: 5,
 *   length: 6,
 *   offset: 0,
 *   value: undefined,
 *   valueLength: 0,
 *   valueOffset: -1,
 * });
 * console.log(entry.valueOffset) // -1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawEntry extends S.Opaque<RawEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    key: S.String.pipe($I.annoteKey("RawEntry.key", { description: "The variable name, raw spelling preserved." })),
    keyEnd: RawOffset.pipe(
      $I.annoteKey("RawEntry.keyEnd", {
        description: "Offset just past the key text (where ` = value` inserts for a bare key).",
      })
    ),
    length: RawOffset.pipe(
      $I.annoteKey("RawEntry.length", {
        description: "Length through the final line's newline (for whole-line removal).",
      })
    ),
    offset: RawOffset.pipe(
      $I.annoteKey("RawEntry.offset", {
        description: "Offset of the entry span, including indentation; inline spans start just after `]`.",
      })
    ),
    value: S.UndefinedOr(S.String).pipe(
      $I.annoteKey("RawEntry.value", {
        description: "The decoded value; `undefined` for the bare boolean-true shorthand.",
      })
    ),
    valueLength: RawOffset.pipe(
      $I.annoteKey("RawEntry.valueLength", {
        description: "Length of the raw value region (excludes trailing comment and unquoted trailing whitespace).",
      })
    ),
    valueOffset: RawOffset.pipe(
      $I.annoteKey("RawEntry.valueOffset", {
        description: "Offset of the raw value region's first character; `-1` for a bare key.",
      })
    ),
  }).pipe($I.annoteSchema("RawEntry", { description: "One raw variable line (possibly continued across lines)." }))
) {}

/**
 * **Example** (Read a scanned raw section)
 *
 * ```ts
 * import { scan } from "@beep/git/internal/config";
 *
 * const section = scan("[core]\n\tbare = true\n").sections[0];
 * console.log(section?.name, section?.entries.length) // core 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawSection extends S.Opaque<RawSection, { readonly brand: unique symbol }>()(
  S.Struct({
    bodyStart: RawOffset.pipe(
      $I.annoteKey("RawSection.bodyStart", {
        description: "Offset just past the header line's newline — where the section body starts.",
      })
    ),
    bracketLength: RawOffset.pipe(
      $I.annoteKey("RawSection.bracketLength", { description: "Length of `[...]` inclusive." })
    ),
    bracketOffset: RawOffset.pipe($I.annoteKey("RawSection.bracketOffset", { description: "Offset of the `[`." })),
    contentEnd: RawOffset.pipe(
      $I.annoteKey("RawSection.contentEnd", {
        description: "Where the section's span ends: the next header's line start, or text end.",
      })
    ),
    entries: S.Array(RawEntry).pipe(
      $I.annoteKey("RawSection.entries", { description: "The entries scanned under this section, in order." })
    ),
    fold: S.Boolean.pipe(
      $I.annoteKey("RawSection.fold", {
        description: "True when the subsection came from the deprecated dotted form (already lowercased).",
      })
    ),
    name: S.String.pipe(
      $I.annoteKey("RawSection.name", {
        description: "The section name, raw spelling preserved (dotted form already split).",
      })
    ),
    offset: RawOffset.pipe($I.annoteKey("RawSection.offset", { description: "Offset of the header's line start." })),
    subsection: S.UndefinedOr(S.String).pipe(
      $I.annoteKey("RawSection.subsection", { description: "The decoded subsection name, when present." })
    ),
  }).pipe(
    $I.annoteSchema("RawSection", { description: "One raw section: header spans plus the entries scanned under it." })
  )
) {}

/**
 * **Example** (Read the scanner result)
 *
 * ```ts
 * import { scan } from "@beep/git/internal/config";
 *
 * const parsed = scan("[core]\n");
 * console.log(parsed.sections.length, parsed.diagnostics.length) // 1 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawParse extends S.Opaque<RawParse, { readonly brand: unique symbol }>()(
  S.Struct({
    diagnostics: S.Array(RawDiagnostic).pipe(
      $I.annoteKey("RawParse.diagnostics", { description: "Every diagnostic the scanner found, in order." })
    ),
    sections: S.Array(RawSection).pipe(
      $I.annoteKey("RawParse.sections", { description: "The scanned sections, in source order." })
    ),
  }).pipe(
    $I.annoteSchema("RawParse", {
      description: "The scanner's result: sections in order plus every diagnostic found.",
    })
  )
) {}

interface MutableSection {
  bodyStart: number;
  bracketLength: number;
  bracketOffset: number;
  contentEnd: number;
  entries: Array<RawEntry>;
  fold: boolean;
  name: string;
  offset: number;
  subsection: string | undefined;
}

const isWs = (ch: string | undefined): boolean => ch === " " || ch === "\t";
const isNameChar = (ch: string): boolean => /[A-Za-z0-9.-]/.test(ch);
const isKeyChar = (ch: string): boolean => /[A-Za-z0-9-]/.test(ch);

const GitKey = S.String.check(S.isPattern(/^[A-Za-z][A-Za-z0-9-]*$/)).pipe(
  $I.annoteSchema("GitKey", { description: "A Git variable name: a letter followed by letters, digits or hyphens." })
);

/**
 * Checks git variable names: a letter, then letters/digits/`-`.
 *
 * **Example** (Validate a git variable name)
 *
 * ```ts
 * import { isValidKey } from "@beep/git/internal/config";
 *
 * console.log(isValidKey("file-mode")) // true
 * console.log(isValidKey("1mode")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isValidKey = S.is(GitKey);

const GitSectionName = S.String.check(S.isPattern(/^[A-Za-z0-9.-]+$/)).pipe(
  $I.annoteSchema("GitSectionName", { description: "A Git section name containing letters, digits, hyphens or dots." })
);

/**
 * Checks git section names: letters, digits, `-` and `.`.
 *
 * **Example** (Validate a git section name)
 *
 * ```ts
 * import { isValidSectionName } from "@beep/git/internal/config";
 *
 * console.log(isValidSectionName("remote.origin")) // true
 * console.log(isValidSectionName("remote origin")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isValidSectionName = S.is(GitSectionName);

const isLineEnd: {
  (text: string, offset: number): boolean;
  (offset: number): (text: string) => boolean;
} = dual(
  2,
  (text: string, offset: number): boolean =>
    offset >= text.length ||
    text[offset] === "\n" ||
    (text[offset] === "\r" && (text[offset + 1] === "\n" || offset + 1 === text.length))
);

const skipToLineEnd: {
  (text: string, from: number): number;
  (from: number): (text: string) => number;
} = dual(2, (text: string, from: number): number => {
  let i = from;
  while (i < text.length && text[i] !== "\n") i += 1;
  return i < text.length ? i + 1 : i;
});

const skipWs = (text: string, from: number): number => {
  let i = from;
  while (isWs(text[i])) i += 1;
  return i;
};

const skipWhile = (text: string, from: number, predicate: (ch: string) => boolean): number => {
  let i = from;
  while (i < text.length && predicate(Str.slice(i, i + 1)(text))) i += 1;
  return i;
};

const isCommentStart = (ch: string | undefined): boolean => ch === "#" || ch === ";";

const endsLineOrComment = (text: string, offset: number): boolean =>
  isLineEnd(text, offset) || isCommentStart(text[offset]);

const isStrayCarriageReturn = (text: string, offset: number): boolean =>
  text[offset] === "\r" && !isLineEnd(text, offset);

const isLineBreakChar = (ch: string | undefined): boolean => ch === "\n" || ch === "\r";

interface ScanState {
  readonly diagnostics: Array<RawDiagnostic>;
  readonly sections: Array<MutableSection>;
  readonly text: string;
}

const closeSection = (sections: Array<MutableSection>, end: number): void => {
  const current = sections[sections.length - 1];
  if (current !== undefined && current.contentEnd === -1) current.contentEnd = end;
};

const scanHeaderLine = (state: ScanState, lineStart: number, bracketOffset: number): number => {
  const header = scanHeader(state.text, lineStart, bracketOffset, state.diagnostics);
  if (header.section !== undefined) {
    closeSection(state.sections, lineStart);
    state.sections.push({
      ...header.section,
      bodyStart: header.next,
      contentEnd: -1,
      entries: header.entry === undefined ? [] : [header.entry],
    });
  }
  return header.next;
};

const scanEntryLine = (state: ScanState, lineStart: number, keyStart: number): number => {
  const entryResult = scanEntry(state.text, lineStart, keyStart, state.diagnostics);
  const entry = entryResult.entry;
  if (entry === undefined) return entryResult.next;
  const current = state.sections[state.sections.length - 1];
  if (current === undefined) {
    state.diagnostics.push(
      RawDiagnostic.make({
        code: "invalidLine",
        message: `variable "${entry.key}" appears before any section header`,
        offset: lineStart,
        length: entryResult.next - lineStart,
      })
    );
  } else {
    current.entries.push(entry);
  }
  return entryResult.next;
};

const scanLine = (state: ScanState, lineStart: number): number => {
  const text = state.text;
  const i = skipWs(text, lineStart === 0 && text[0] === "﻿" ? 1 : lineStart);
  if (isStrayCarriageReturn(text, i)) {
    const next = skipToLineEnd(text, i);
    state.diagnostics.push(
      RawDiagnostic.make({
        code: "invalidLine",
        message: "unexpected text after carriage return",
        offset: i,
        length: next - i,
      })
    );
    return next;
  }
  if (endsLineOrComment(text, i)) return skipToLineEnd(text, i);
  return text[i] === "[" ? scanHeaderLine(state, lineStart, i) : scanEntryLine(state, lineStart, i);
};

/**
 * Scans a git-config document into raw sections, entries, and diagnostics.
 *
 * **Details**
 *
 * Never throws; every malformed shape lands in `diagnostics` (the facade turns a
 * non-empty array into the typed parse error).
 *
 * **Example** (Scan a section and report an invalid key)
 *
 * ```ts
 * import { scan } from "@beep/git/internal/config";
 *
 * const parsed = scan("[core]\n\tbare\n");
 * console.log(parsed.sections[0]?.entries[0]?.value) // undefined
 * console.log(parsed.diagnostics.length) // 0
 * console.log(scan("[core]\n1bad = value\n").diagnostics[0]?.code) // invalidKey
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scan = (text: string): RawParse => {
  const nul = pipe(text, Str.indexOf("\0"), O.getOrElse(constant(-1)));
  if (nul >= 0) {
    return RawParse.make({
      sections: [],
      diagnostics: [
        RawDiagnostic.make({
          code: "unexpectedCharacter",
          message: "NUL byte in git-config text",
          offset: nul,
          length: 1,
        }),
      ],
    });
  }
  const state: ScanState = { diagnostics: [], sections: [], text };
  let offset = 0;
  while (offset < text.length) offset = scanLine(state, offset);
  closeSection(state.sections, text.length);
  return RawParse.make({
    sections: A.map(state.sections, (section) => RawSection.make(section)),
    diagnostics: state.diagnostics,
  });
};

interface HeaderScan {
  readonly entry?: RawEntry;
  readonly next: number;
  readonly section: Omit<MutableSection, "bodyStart" | "contentEnd" | "entries"> | undefined;
}

interface HeaderContext {
  readonly bracketOffset: number;
  readonly diagnostics: Array<RawDiagnostic>;
  readonly lineStart: number;
  readonly text: string;
}

const headerFailure = (
  context: HeaderContext,
  at: number,
  message: string,
  code: RawDiagnosticCode = "invalidSectionHeader"
): HeaderScan => {
  const next = skipToLineEnd(context.text, at);
  context.diagnostics.push(
    RawDiagnostic.make({ code, message, offset: context.lineStart, length: next - context.lineStart })
  );
  return { section: undefined, next };
};

interface QuotedSubsection {
  readonly closed: boolean;
  readonly end: number;
  readonly value: string;
}

const subsectionCharAt = (text: string, i: number): string | undefined => (text[i] === "\\" ? text[i + 1] : text[i]);

const subsectionCharWidth = (text: string, i: number): number => (text[i] === "\\" ? 2 : 1);

const scanQuotedSubsection = (text: string, from: number): QuotedSubsection => {
  let i = from;
  let value = "";
  while (i < text.length && !isLineBreakChar(text[i]) && text[i] !== '"') {
    const ch = subsectionCharAt(text, i);
    if (ch === undefined || isLineBreakChar(ch)) return { value, closed: false, end: i };
    value += ch;
    i += subsectionCharWidth(text, i);
  }
  const closed = text[i] === '"';
  return { value, closed, end: closed ? i + 1 : i };
};

interface HeaderAddress {
  readonly fold: boolean;
  readonly name: string;
  readonly subsection: string | undefined;
}

const headerAddress = (name: string, subsection: string | undefined, quoted: boolean): HeaderAddress => {
  const dot = quoted ? -1 : pipe(name, Str.indexOf("."), O.getOrElse(constant(-1)));
  return dot < 0
    ? { name, subsection, fold: false }
    : { name: Str.slice(0, dot)(name), subsection: pipe(name, Str.slice(dot + 1), Str.toLowerCase), fold: true };
};

const closeHeader = (
  context: HeaderContext,
  name: string,
  subsection: string | undefined,
  quoted: boolean,
  closeAt: number
): HeaderScan => {
  const { bracketOffset, diagnostics, lineStart, text } = context;
  if (text[closeAt] !== "]") return headerFailure(context, closeAt, "expected ']' to close the section header");
  const bracketLength = closeAt - bracketOffset + 1;
  const entryStart = closeAt + 1;
  const i = skipWs(text, entryStart);
  if (isStrayCarriageReturn(text, i)) return headerFailure(context, i, "unexpected text after carriage return");
  const address = headerAddress(name, subsection, quoted);
  if (address.name === "") return headerFailure(context, i, "malformed dotted section header");
  const inline = endsLineOrComment(text, i) ? undefined : scanEntry(text, entryStart, i, diagnostics);
  return {
    section: { ...address, offset: lineStart, bracketOffset, bracketLength },
    ...O.getSomesStruct({ entry: O.fromUndefinedOr(inline?.entry) }),
    next: inline === undefined ? skipToLineEnd(text, i) : inline.next,
  };
};

const scanHeader: {
  (text: string, lineStart: number, bracketOffset: number, diagnostics: Array<RawDiagnostic>): HeaderScan;
  (lineStart: number, bracketOffset: number, diagnostics: Array<RawDiagnostic>): (text: string) => HeaderScan;
} = dual(4, (text: string, lineStart: number, bracketOffset: number, diagnostics: Array<RawDiagnostic>): HeaderScan => {
  const context: HeaderContext = { bracketOffset, diagnostics, lineStart, text };
  const nameEnd = skipWhile(text, bracketOffset + 1, isNameChar);
  const name = Str.slice(bracketOffset + 1, nameEnd)(text);
  if (name === "") return headerFailure(context, nameEnd, "section header has no name");
  const afterName = skipWs(text, nameEnd);
  if (text[afterName] !== '"') return closeHeader(context, name, undefined, false, afterName);
  if (afterName === nameEnd) return headerFailure(context, afterName, "expected whitespace before quoted subsection");
  const quoted = scanQuotedSubsection(text, afterName + 1);
  if (!quoted.closed) return headerFailure(context, quoted.end, "unterminated subsection name", "unterminatedQuote");
  return closeHeader(context, name, quoted.value, true, skipWs(text, quoted.end));
});

interface EntryScan {
  readonly entry: RawEntry | undefined;
  readonly next: number;
}

const entryFailure = (
  text: string,
  lineStart: number,
  at: number,
  diagnostics: Array<RawDiagnostic>,
  code: RawDiagnosticCode,
  message: string
): EntryScan => {
  const next = skipToLineEnd(text, at);
  diagnostics.push(RawDiagnostic.make({ code, message, offset: lineStart, length: next - lineStart }));
  return { entry: undefined, next };
};

interface ValueCursor {
  decoded: string;
  i: number;
  inQuotes: boolean;
  significantDecoded: number;
  significantEnd: number;
}

const markSignificant = (cursor: ValueCursor): void => {
  cursor.significantDecoded = cursor.decoded.length;
  cursor.significantEnd = cursor.i - 1;
};

const VALUE_ESCAPES: Readonly<Record<string, string>> = { n: "\n", t: "\t", b: "\b", '"': '"', "\\": "\\" };

const continuationWidth = (text: string, i: number): number => {
  const next = text[i + 1];
  if (next === "\n") return 2;
  return next === "\r" && text[i + 2] === "\n" ? 3 : 0;
};

const stepValueEscape = (
  text: string,
  key: string,
  cursor: ValueCursor,
  diagnostics: Array<RawDiagnostic>
): boolean => {
  const next = text[cursor.i + 1];
  if (next === undefined && !cursor.inQuotes) {
    cursor.i += 1;
    markSignificant(cursor);
    return true;
  }
  const continuation = continuationWidth(text, cursor.i);
  if (continuation > 0) {
    cursor.i += continuation;
    markSignificant(cursor);
    return false;
  }
  const mapped = next === undefined ? undefined : VALUE_ESCAPES[next];
  if (mapped === undefined) {
    diagnostics.push(
      RawDiagnostic.make({
        code: "invalidEscape",
        message: `invalid escape sequence \\${next ?? ""} in value of "${key}"`,
        offset: cursor.i,
        length: 2,
      })
    );
    cursor.i += 2;
    return false;
  }
  cursor.decoded += mapped;
  cursor.i += 2;
  markSignificant(cursor);
  return false;
};

const stepValueChar = (ch: string, cursor: ValueCursor): boolean => {
  if (ch === '"') {
    cursor.inQuotes = !cursor.inQuotes;
    cursor.i += 1;
    markSignificant(cursor);
    return false;
  }
  if (!cursor.inQuotes && isCommentStart(ch)) return true;
  cursor.i += 1;
  if (!cursor.inQuotes && cursor.decoded === "" && isWs(ch)) return false;
  cursor.decoded += ch;
  if (cursor.inQuotes || !isWs(ch)) markSignificant(cursor);
  return false;
};

const isValueLineEnd = (text: string, i: number): boolean => {
  const ch = text[i];
  return ch === "\n" || (ch === "\r" && isLineEnd(text, i));
};

const scanValue = (text: string, key: string, valueOffset: number, diagnostics: Array<RawDiagnostic>): ValueCursor => {
  const cursor: ValueCursor = {
    decoded: "",
    i: valueOffset,
    inQuotes: false,
    significantDecoded: 0,
    significantEnd: valueOffset - 1,
  };
  while (cursor.i < text.length && !isValueLineEnd(text, cursor.i)) {
    const ch = Str.slice(cursor.i, cursor.i + 1)(text);
    const valueEnded = ch === "\\" ? stepValueEscape(text, key, cursor, diagnostics) : stepValueChar(ch, cursor);
    if (valueEnded) break;
  }
  return cursor;
};

const bareEntry = (text: string, key: string, lineStart: number, keyEnd: number, at: number): EntryScan => {
  const next = skipToLineEnd(text, at);
  return {
    entry: RawEntry.make({
      key,
      value: undefined,
      offset: lineStart,
      length: next - lineStart,
      keyEnd,
      valueOffset: -1,
      valueLength: 0,
    }),
    next,
  };
};

const scanEntry: {
  (text: string, lineStart: number, keyStart: number, diagnostics: Array<RawDiagnostic>): EntryScan;
  (lineStart: number, keyStart: number, diagnostics: Array<RawDiagnostic>): (text: string) => EntryScan;
} = dual(4, (text: string, lineStart: number, keyStart: number, diagnostics: Array<RawDiagnostic>): EntryScan => {
  if (!/[A-Za-z]/.test(Str.slice(keyStart, keyStart + 1)(text))) {
    return entryFailure(
      text,
      lineStart,
      keyStart,
      diagnostics,
      "invalidKey",
      "variable names must start with a letter"
    );
  }
  const keyEnd = skipWhile(text, keyStart, isKeyChar);
  const key = Str.slice(keyStart, keyEnd)(text);
  const i = skipWs(text, keyEnd);
  if (endsLineOrComment(text, i)) return bareEntry(text, key, lineStart, keyEnd, i);
  if (text[i] !== "=") {
    const shown = Result.getOrThrowWith(encodeDiagnosticJsonString(Str.slice(i, i + 1)(text)), identity);
    return entryFailure(
      text,
      lineStart,
      i,
      diagnostics,
      "invalidLine",
      `unexpected character ${shown} after variable name "${key}"`
    );
  }
  const valueOffset = skipWs(text, i + 1);
  const cursor = scanValue(text, key, valueOffset, diagnostics);
  if (cursor.inQuotes) {
    diagnostics.push(
      RawDiagnostic.make({
        code: "unterminatedQuote",
        message: `unterminated quoted value of "${key}"`,
        offset: valueOffset,
        length: Math.max(1, cursor.i - valueOffset),
      })
    );
  }
  const next = skipToLineEnd(text, cursor.i);
  return {
    entry: RawEntry.make({
      key,
      value: Str.slice(0, cursor.significantDecoded)(cursor.decoded),
      offset: lineStart,
      length: next - lineStart,
      keyEnd,
      valueOffset,
      valueLength: cursor.significantEnd >= valueOffset ? cursor.significantEnd - valueOffset + 1 : 0,
    }),
    next,
  };
});

/**
 * Checks whether `section` matches the (name, subsection) address under git's case rules.
 *
 * **Details**
 *
 * Section names compare case-insensitively; decoded subsection names compare
 * case-sensitively. The scanner lowercases subsections from deprecated dotted headers.
 *
 * **Example** (Compare section and subsection casing)
 *
 * ```ts
 * import { matchesSection, scan } from "@beep/git/internal/config";
 *
 * const section = scan('[remote "Origin"]\n').sections[0];
 * if (section !== undefined) {
 *   console.log(matchesSection(section, "REMOTE", "Origin")) // true
 *   console.log(matchesSection("remote", "origin")(section)) // false
 * }
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const matchesSection: {
  (name: string, subsection: string | undefined): (section: RawSection) => boolean;
  (section: RawSection, name: string, subsection: string | undefined): boolean;
} = dual(3, (section: RawSection, name: string, subsection: string | undefined): boolean => {
  if (Str.toLowerCase(section.name) !== Str.toLowerCase(name)) return false;
  if (subsection === undefined) return section.subsection === undefined;
  if (section.subsection === undefined) return false;
  return section.subsection === subsection;
});

/**
 * Checks whether `entry` carries `key`; variable names compare case-insensitively.
 *
 * **Example** (Match a variable name with different casing)
 *
 * ```ts
 * import { matchesKey, scan } from "@beep/git/internal/config";
 *
 * const entry = scan("[core]\nFileMode = true\n").sections[0]?.entries[0];
 * if (entry !== undefined) {
 *   console.log(matchesKey(entry, "filemode")) // true
 *   console.log(matchesKey("bare")(entry)) // false
 * }
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const matchesKey: {
  (key: string): (entry: RawEntry) => boolean;
  (entry: RawEntry, key: string): boolean;
} = dual(2, (entry: RawEntry, key: string): boolean => Str.toLowerCase(entry.key) === Str.toLowerCase(key));

/**
 * Serializes a value for insertion into a config line: quoted and escaped
 * exactly when git's grammar demands it, verbatim otherwise.
 *
 * **Example** (Quote a value containing a comment marker)
 *
 * ```ts
 * import { serializeValue } from "@beep/git/internal/config";
 *
 * console.log(serializeValue("true")) // true
 * console.log(serializeValue("value # comment")) // "value # comment"
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const serializeValue = (value: string): string => {
  const needsQuoting = value === "" || value !== Str.trim(value) || /["\\\n\t\b#;]/.test(value);
  if (!needsQuoting) return value;
  const escaped = pipe(
    value,
    Str.replaceAll("\\", "\\\\"),
    Str.replaceAll('"', '\\"'),
    Str.replaceAll("\n", "\\n"),
    Str.replaceAll("\t", "\\t"),
    Str.replaceAll("\b", "\\b")
  );
  return `"${escaped}"`;
};

/**
 * Serializes a section header. The subsection is quoted-and-escaped when present.
 *
 * **Example** (Serialize plain and subsection headers)
 *
 * ```ts
 * import { serializeHeader } from "@beep/git/internal/config";
 *
 * console.log(serializeHeader("core", undefined)) // [core]
 * console.log(serializeHeader("origin")("remote")) // [remote "origin"]
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const serializeHeader: {
  (subsection: string | undefined): (name: string) => string;
  (name: string, subsection: string | undefined): string;
} = dual(2, (name: string, subsection: string | undefined): string =>
  subsection === undefined
    ? `[${name}]`
    : `[${name} "${pipe(subsection, Str.replaceAll("\\", "\\\\"), Str.replaceAll('"', '\\"'))}"]`
);

/**
 * **Example** (Make a text splice)
 *
 * ```ts
 * import { Splice } from "@beep/git/internal/config";
 *
 * const splice = Splice.make({ offset: 1, length: 1, content: "XYZ" });
 * console.log(splice.content) // XYZ
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Splice extends S.Opaque<Splice, { readonly brand: unique symbol }>()(
  S.Struct({
    content: S.String.pipe($I.annoteKey("Splice.content", { description: "The replacement text." })),
    length: RawOffset.pipe($I.annoteKey("Splice.length", { description: "How many characters to replace." })),
    offset: RawOffset.pipe($I.annoteKey("Splice.offset", { description: "Where the replaced span starts." })),
  }).pipe(
    $I.annoteSchema("Splice", {
      description: "One text splice: replace `length` characters at `offset` with `content`.",
    })
  )
) {}

/**
 * Applies a single splice to replace a span of the text.
 *
 * **Example** (Replace a substring with a splice)
 *
 * ```ts
 * import { applySplice, Splice } from "@beep/git/internal/config";
 *
 * console.log(applySplice("abc", Splice.make({ offset: 1, length: 1, content: "XYZ" }))) // aXYZc
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const applySplice: {
  (splice: Splice): (text: string) => string;
  (text: string, splice: Splice): string;
} = dual(
  2,
  (text: string, splice: Splice): string =>
    Str.slice(0, splice.offset)(text) + splice.content + Str.slice(splice.offset + splice.length)(text)
);

/**
 * Finds the indentation to use for a new entry in `section`: its first entry's, else a tab.
 *
 * **Example** (Reuse the first entry indentation)
 *
 * ```ts
 * import { scan, sectionIndent } from "@beep/git/internal/config";
 *
 * const text = "[core]\n  bare\n";
 * const section = scan(text).sections[0];
 * if (section !== undefined) {
 *   console.log(sectionIndent(text, section).length) // 2
 * }
 * const emptySection = scan("[core]\n").sections[0];
 * if (emptySection !== undefined) {
 *   console.log(sectionIndent("[core]\n", emptySection) === "\t") // true
 * }
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const sectionIndent: {
  (section: RawSection): (text: string) => string;
  (text: string, section: RawSection): string;
} = dual(2, (text: string, section: RawSection): string => {
  const first = section.entries[0];
  if (first === undefined) return "\t";
  let end = first.offset;
  while (isWs(text[end])) end += 1;
  return Str.slice(first.offset, end)(text);
});

/**
 * Locates where a new entry line inserts in `section`: after its last entry, else right after the header line.
 *
 * **Example** (Locate insertion offsets in populated and empty sections)
 *
 * ```ts
 * import { scan, sectionInsertOffset } from "@beep/git/internal/config";
 *
 * const section = scan("[core]\n  bare\n").sections[0];
 * if (section !== undefined) {
 *   console.log(sectionInsertOffset(section)) // 14
 * }
 * const emptySection = scan("[core]\n").sections[0];
 * if (emptySection !== undefined) {
 *   console.log(sectionInsertOffset(emptySection)) // 7
 * }
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const sectionInsertOffset = (section: RawSection): number => {
  const last = section.entries[section.entries.length - 1];
  return last === undefined ? section.bodyStart : last.offset + last.length;
};
