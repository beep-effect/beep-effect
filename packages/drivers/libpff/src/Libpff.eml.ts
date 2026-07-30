/**
 * Deterministic EML assembly for pffexport-exported items.
 *
 * pffexport materializes message parts (headers, body, attachments) as plain
 * files; this module reassembles them into RFC 5322/2046 messages without any
 * runtime dependency, so assembly stays pure and byte-stable given the same
 * export tree.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, R, Str } from "@beep/utils";
import { Encoding } from "effect";

const CRLF = "\r\n";
const base64LineLength = 76;
const headerValueUnsafePattern = /[\r\n]+/g;
const quotePattern = /"/g;
const lineBreakPattern = /\r?\n/;
const continuationPattern = /^[ \t]/;

// MIME-structural headers are stripped from verbatim transport headers because
// the driver generates its own structure; keeping the original Content-Type
// (typically multipart with a boundary that no longer exists in the
// reassembled body) would make the EML unparseable.
const structuralHeaderNames: ReadonlyArray<string> = [
  "content-disposition",
  "content-id",
  "content-transfer-encoding",
  "content-type",
  "mime-version",
];

const outlookSubjectKey = "Subject";
const outlookSenderNameKey = "Sender name";
const outlookSenderEmailKey = "Sender email address";
const outlookClientSubmitTimeKey = "Client submit time";

// RFC 5322's 998-octet physical-line limit. It governs headers and bodies
// alike: header lines fold against it, body parts switch encoding against it.
const headerLineOctetLimit = 998;
const outlookTimestampPattern = /^([A-Za-z]{3}) (\d{1,2}), (\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.\d+)? UTC$/;
const monthAbbreviations = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const textEncoder = new TextEncoder();

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// The pattern only constrains digit counts, so "Nov 99, 2020 25:61:61 UTC"
// matches it. Calendar and clock ranges are checked separately.
const daysInMonth = (month: string, year: number): number =>
  A.findFirstIndex(monthAbbreviations, Str.equivalence(month)).pipe(
    O.map((index) => (index === 1 && isLeapYear(year) ? 29 : O.getOrElse(A.get(monthLengths, index), () => 0))),
    O.getOrElse(() => 0)
  );

/**
 * File name of the EML artifact assembled inside each exported item directory.
 *
 * @example
 * ```ts
 * import { PFFEXPORT_EML_FILE_NAME } from "@beep/libpff"
 *
 * console.log(PFFEXPORT_EML_FILE_NAME) // "Message.eml"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PFFEXPORT_EML_FILE_NAME = "Message.eml";

const sanitizeHeaderValue = (value: string): string => Str.trim(Str.replace(headerValueUnsafePattern, " ")(value));

const sanitizeQuotedValue = (value: string): string => Str.replace(quotePattern, "'")(sanitizeHeaderValue(value));

const foldBase64Lines = (encoded: string): string => {
  const lines: Array<string> = [];
  for (let index = 0; index < encoded.length; index += base64LineLength) {
    lines.push(encoded.slice(index, index + base64LineLength));
  }
  return A.join(lines, CRLF);
};

const headerName = (line: string): O.Option<string> => {
  const separator = line.indexOf(":");
  return separator > 0 ? O.some(Str.toLowerCase(Str.trim(line.slice(0, separator)))) : O.none();
};

const octetLength = (value: string): number => textEncoder.encode(value).length;

/**
 * Fold one physical header line to RFC 5322's 998-octet line limit.
 *
 * Verbatim transport headers can carry lines over the limit (DKIM signatures,
 * long `Received` chains), and flattening a folded Outlook value into a single
 * line manufactures them. Folding breaks only at existing spaces and indents
 * each continuation with a single space, reusing the original space as that
 * indent so unfolding restores the text byte for byte. A line that already fits
 * is returned untouched, so header blocks that arrived correctly folded stay as
 * they are.
 *
 * @remarks
 * An unbroken run of 998+ octets — a message-id, a DKIM `b=` tag — has no space
 * to promote to an indent, so it is emitted intact and over-long rather than
 * split. For an archival exporter, preserving the original header value byte
 * for byte outranks the line-length limit: a spec-violating long line is
 * recoverable by any consumer, whereas a token mutated by inserted continuation
 * whitespace (which survives unfolding) is not.
 *
 * @param line - One physical header line.
 * @returns The line when it fits or cannot be folded losslessly, otherwise its folded continuation lines.
 * @example
 * ```ts
 * import { foldHeaderLine } from "@beep/libpff"
 *
 * console.log(foldHeaderLine("Subject: short")) // [ "Subject: short" ]
 *
 * const long = `X-Long: ${"token ".repeat(400)}`
 * const folded = foldHeaderLine(long)
 * console.log(folded.length > 1) // true
 * console.log(folded.join("") === long) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const foldHeaderLine = (line: string): ReadonlyArray<string> =>
  octetLength(line) <= headerLineOctetLimit
    ? A.of(line)
    : A.reduce(Str.split(" ")(line), A.empty<string>(), (folded, word) =>
        A.matchRight(folded, {
          onEmpty: () => A.of(word),
          onNonEmpty: (init, last) =>
            // Breaking here promotes this word's own leading space to the
            // continuation indent, so unfolding puts it back unchanged.
            octetLength(`${last} ${word}`) > headerLineOctetLimit
              ? A.append(folded, ` ${word}`)
              : A.append(init, `${last} ${word}`),
        })
      );

/**
 * Convert a pffexport timestamp into an RFC 5322 date.
 *
 * pffexport renders MAPI times as `Nov 26, 2020 22:18:29.446000000 UTC`. The
 * sub-second precision and the `UTC` suffix are dropped in favor of a `+0000`
 * offset, and the optional day-of-week is omitted so no calendar arithmetic is
 * needed. Calendar and clock components are range-checked — including the
 * February length for the given year — so an impossible timestamp such as
 * `Nov 99, 2020 25:61:61 UTC` yields `None`. Anything that does not parse or
 * does not validate drops the `Date` header rather than emitting a malformed
 * one.
 *
 * @param value - Timestamp text taken from an `OutlookHeaders.txt` field.
 * @returns The RFC 5322 rendering when the timestamp is recognized and in range.
 * @example
 * ```ts
 * import { rfc5322DateFromOutlookTimestamp } from "@beep/libpff"
 * import { O } from "@beep/utils"
 *
 * console.log(
 *   O.getOrElse(rfc5322DateFromOutlookTimestamp("Nov 26, 2020 22:18:29.446000000 UTC"), () => "")
 * ) // "26 Nov 2020 22:18:29 +0000"
 * console.log(O.isNone(rfc5322DateFromOutlookTimestamp("Feb 29, 2021 00:00:00 UTC"))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const rfc5322DateFromOutlookTimestamp = (value: string): O.Option<string> =>
  Str.match(outlookTimestampPattern)(Str.trim(value)).pipe(
    O.flatMap((groups) =>
      O.all({
        day: A.get(groups, 2),
        hour: A.get(groups, 4),
        minute: A.get(groups, 5),
        month: A.get(groups, 1).pipe(O.filter((month) => A.contains(monthAbbreviations, month))),
        second: A.get(groups, 6),
        year: A.get(groups, 3),
      })
    ),
    O.filter(
      ({ day, hour, minute, month, second, year }) =>
        Number(hour) <= 23 &&
        Number(minute) <= 59 &&
        Number(second) <= 59 &&
        Number(day) >= 1 &&
        Number(day) <= daysInMonth(month, Number(year))
    ),
    O.map(({ day, hour, minute, month, second, year }) => `${day} ${month} ${year} ${hour}:${minute}:${second} +0000`)
  );

/**
 * Normalize a verbatim transport-header block for reuse in an assembled EML.
 *
 * The block is truncated at its first blank line (the RFC 5322 header
 * terminator), MIME-structural headers and their folded continuation lines
 * are removed, line endings are normalized to CRLF, and any physical line over
 * the 998-octet limit is folded. Lines that already fit are passed through
 * unchanged, so a block that arrived correctly folded is preserved as-is.
 *
 * @example
 * ```ts
 * import { stripMimeStructuralHeaders } from "@beep/libpff"
 *
 * const stripped = stripMimeStructuralHeaders(
 *   "Subject: hi\nContent-Type: multipart/mixed;\n boundary=x\nFrom: a@b.c\n"
 * )
 * console.log(stripped) // "Subject: hi\r\nFrom: a@b.c"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const stripMimeStructuralHeaders = (headerBlock: string): string => {
  const kept: Array<string> = [];
  let dropping = false;

  for (const line of headerBlock.split(lineBreakPattern)) {
    if (Str.isEmpty(Str.trim(line))) {
      break;
    }

    if (continuationPattern.test(line)) {
      if (!dropping) {
        kept.push(...foldHeaderLine(line));
      }
      continue;
    }

    dropping = O.match(headerName(line), {
      onNone: () => false,
      onSome: (name) => A.contains(structuralHeaderNames, name),
    });

    if (!dropping) {
      kept.push(...foldHeaderLine(line));
    }
  }

  return A.join(kept, CRLF);
};

/**
 * Parse a pffexport `OutlookHeaders.txt` document into a key/value record.
 *
 * Lines split on their first colon; keys and values are trimmed, values are
 * flattened to single lines, and the first occurrence of a repeated key wins
 * so the result is deterministic.
 *
 * @example
 * ```ts
 * import { parseOutlookHeaders } from "@beep/libpff"
 *
 * const headers = parseOutlookHeaders("Subject:\tQuarterly report\nSize:\t128\n")
 * console.log(headers["Subject"]) // "Quarterly report"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const parseOutlookHeaders = (text: string): Record<string, string> => {
  const parsed: Record<string, string> = {};

  for (const line of text.split(lineBreakPattern)) {
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const key = Str.trim(line.slice(0, separator));
    if (Str.isEmpty(key) || R.has(parsed, key)) {
      continue;
    }
    parsed[key] = sanitizeHeaderValue(line.slice(separator + 1));
  }

  return parsed;
};

/**
 * Synthesize a minimal EML header block from parsed Outlook headers.
 *
 * Emits `From:` (only when a sender email address is present), `Subject:`, and
 * `Date:` parsed from the Outlook client-submit time. A submit time that does
 * not parse is omitted rather than emitted malformed; its verbatim value stays
 * available in the JSONL record headers, as do `To:`/`Cc:`, whose synthesis
 * remains an explicit P3 waiver. Every emitted line is folded to the
 * 998-octet limit, which matters here because flattening a folded Outlook
 * value produces a single long line.
 *
 * @example
 * ```ts
 * import { synthesizeEmlHeaderBlock } from "@beep/libpff"
 *
 * const block = synthesizeEmlHeaderBlock({
 *   "Client submit time": "Nov 26, 2020 22:18:29.446000000 UTC",
 *   "Sender email address": "ada@example.com",
 *   "Sender name": "Ada Lovelace",
 *   "Subject": "Quarterly report"
 * })
 * console.log(block.startsWith("From: \"Ada Lovelace\" <ada@example.com>")) // true
 * console.log(block.includes("Date: 26 Nov 2020 22:18:29 +0000")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const synthesizeEmlHeaderBlock = (headers: Readonly<Record<string, string>>): string => {
  const lines: Array<string> = [];
  const senderEmail = O.fromUndefinedOr(headers[outlookSenderEmailKey]).pipe(
    O.map(sanitizeHeaderValue),
    O.filter(Str.isNonEmpty)
  );
  const senderName = O.fromUndefinedOr(headers[outlookSenderNameKey]).pipe(
    O.map(sanitizeQuotedValue),
    O.filter(Str.isNonEmpty)
  );

  if (O.isSome(senderEmail)) {
    lines.push(
      O.match(senderName, {
        onNone: () => `From: ${senderEmail.value}`,
        onSome: (name) => `From: "${name}" <${senderEmail.value}>`,
      })
    );
  }

  const subject = O.fromUndefinedOr(headers[outlookSubjectKey]).pipe(O.map(sanitizeHeaderValue));
  if (O.isSome(subject)) {
    lines.push(`Subject: ${subject.value}`);
  }

  const date = O.fromUndefinedOr(headers[outlookClientSubmitTimeKey]).pipe(
    O.map(sanitizeHeaderValue),
    O.filter(Str.isNonEmpty),
    O.flatMap(rfc5322DateFromOutlookTimestamp)
  );
  if (O.isSome(date)) {
    lines.push(`Date: ${date.value}`);
  }

  return A.join(A.flatMap(lines, foldHeaderLine), CRLF);
};

interface EmlBodyPart {
  readonly content: string;
  readonly contentType: string;
}

interface EmlAttachmentPart {
  readonly bytes: Uint8Array;
  readonly fileName: string;
}

interface EmlAssemblyInput {
  readonly attachments: ReadonlyArray<EmlAttachmentPart>;
  readonly body: O.Option<EmlBodyPart>;
  readonly boundary: string;
  readonly headerBlock: string;
}

const emptyBody: EmlBodyPart = { content: "", contentType: "text/plain; charset=utf-8" };

// A body part obeys the same 998-octet physical-line limit as headers, but
// folding would corrupt content, so a part with any over-long line switches
// to base64 (losslessly — decoding restores the exact body string) while
// every other part stays verbatim 8bit. Splitting on the line-break pattern
// leaves a lone CR inside its line, where it counts toward the octet length:
// a deliberate safe over-trigger for the one break style RFC 5322 does not
// recognize.
const bodySectionLines = (body: EmlBodyPart): ReadonlyArray<string> =>
  A.some(body.content.split(lineBreakPattern), (line) => octetLength(line) > headerLineOctetLimit)
    ? [
        `Content-Type: ${body.contentType}`,
        "Content-Transfer-Encoding: base64",
        "",
        foldBase64Lines(Encoding.encodeBase64(body.content)),
      ]
    : [`Content-Type: ${body.contentType}`, "Content-Transfer-Encoding: 8bit", "", body.content];

/**
 * Assemble a deterministic EML document from pre-read message parts.
 *
 * Without attachments the message is single-part with the body's content
 * type; with attachments it becomes `multipart/mixed` with the body as the
 * first part and one base64 part per attachment. A missing body yields an
 * empty `text/plain` part. Output is byte-stable given identical inputs.
 *
 * @remarks
 * Body parts follow RFC 5322's 998-octet physical-line limit: a part whose
 * lines all fit is emitted verbatim as 8bit, while a part with any longer
 * line is emitted as base64. That switch is a cliff — a one-octet difference
 * flips the whole part between encodings, so output stays deterministic per
 * input but near-identical messages can diff dissimilarly. Base64 here is
 * lossless relative to the decoded body string (the raw file's bytes after
 * UTF-8 decoding with U+FFFD replacement): decoding the part restores that
 * string exactly, while the raw body file beside the EML remains the
 * authoritative byte-for-byte artifact.
 *
 * @example
 * ```ts
 * import { assembleEml } from "@beep/libpff"
 * import { O } from "@beep/utils"
 *
 * const eml = assembleEml({
 *   attachments: [],
 *   body: O.some({ content: "hello", contentType: "text/plain; charset=utf-8" }),
 *   boundary: "=_beep-example",
 *   headerBlock: "Subject: hi"
 * })
 * console.log(eml.includes("Subject: hi")) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const assembleEml = (input: EmlAssemblyInput): string => {
  const body = O.getOrElse(input.body, () => emptyBody);
  const headerLines = Str.isNonEmpty(input.headerBlock) ? [input.headerBlock] : [];

  if (A.isReadonlyArrayEmpty(input.attachments)) {
    return A.join([...headerLines, "MIME-Version: 1.0", ...bodySectionLines(body)], CRLF);
  }

  const sections: Array<string> = [
    ...headerLines,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${input.boundary}"`,
    "",
    `--${input.boundary}`,
    ...bodySectionLines(body),
  ];

  for (const attachment of input.attachments) {
    const fileName = sanitizeQuotedValue(attachment.fileName);
    sections.push(
      `--${input.boundary}`,
      `Content-Type: application/octet-stream; name="${fileName}"`,
      `Content-Disposition: attachment; filename="${fileName}"`,
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64Lines(Encoding.encodeBase64(attachment.bytes))
    );
  }

  sections.push(`--${input.boundary}--`);
  return A.join(sections, CRLF);
};
