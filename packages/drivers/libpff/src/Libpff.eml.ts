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

const headerLineOctetLimit = 998;
const outlookTimestampPattern = /^([A-Za-z]{3}) (\d{1,2}), (\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.\d+)? UTC$/;
const monthAbbreviations = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const textEncoder = new TextEncoder();

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

// Splits a single word that is itself over the limit; only reachable when a run
// of 998+ octets carries no fold point at all. Iterating the string yields whole
// code points, so astral characters are never cut in half. The budget leaves
// room for the leading space a continuation line carries.
const hardSplit = (word: string): ReadonlyArray<string> =>
  A.reduce(A.fromIterable(word), A.empty<string>(), (chunks, character) =>
    A.matchRight(chunks, {
      onEmpty: () => A.of(character),
      onNonEmpty: (init, last) =>
        octetLength(`${last}${character}`) >= headerLineOctetLimit
          ? A.append(chunks, character)
          : A.append(init, `${last}${character}`),
    })
  );

// A fold point that sits on an original space is lossless: the space becomes the
// continuation indent and unfolding puts it back. A fold inside a word has no
// such space to reuse, so `separated` records which pieces may be rejoined with
// a space and which must be butted together.
interface HeaderPiece {
  readonly separated: boolean;
  readonly text: string;
}

const headerPieces = (line: string): ReadonlyArray<HeaderPiece> =>
  A.flatMap(Str.split(" ")(line), (word, wordIndex) =>
    A.map(hardSplit(word), (text, chunkIndex) => ({ separated: wordIndex > 0 && chunkIndex === 0, text }))
  );

/**
 * Fold one physical header line to RFC 5322's 998-octet line limit.
 *
 * Verbatim transport headers can carry lines over the limit (DKIM signatures,
 * long `Received` chains), and flattening a folded Outlook value into a single
 * line manufactures them. Folding breaks at space boundaries and indents each
 * continuation with a single space, reusing the original space as that indent
 * so unfolding restores the text byte for byte. A line that already fits is
 * returned untouched, so header blocks that arrived correctly folded stay as
 * they are.
 *
 * @remarks
 * A run of 998+ octets containing no space cannot be folded losslessly — there
 * is no space to promote to an indent — so it is hard-split by code point and
 * the continuation indent is a space that was not in the source. That trade is
 * deliberate: the alternative is emitting a line no RFC 5322 parser accepts.
 *
 * @param line - One physical header line.
 * @returns The line when it fits, otherwise its folded continuation lines.
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
    : A.reduce(headerPieces(line), A.empty<string>(), (folded, piece) =>
        A.matchRight(folded, {
          onEmpty: () => A.of(piece.text),
          onNonEmpty: (init, last) => {
            const joined = piece.separated ? `${last} ${piece.text}` : `${last}${piece.text}`;

            return octetLength(joined) > headerLineOctetLimit
              ? A.append(folded, ` ${piece.text}`)
              : A.append(init, joined);
          },
        })
      );

/**
 * Convert a pffexport timestamp into an RFC 5322 date.
 *
 * pffexport renders MAPI times as `Nov 26, 2020 22:18:29.446000000 UTC`. The
 * sub-second precision and the `UTC` suffix are dropped in favor of a `+0000`
 * offset, and the optional day-of-week is omitted so no calendar arithmetic is
 * needed. Anything that does not match yields `None`, which drops the `Date`
 * header rather than emitting a malformed one.
 *
 * @param value - Timestamp text taken from an `OutlookHeaders.txt` field.
 * @returns The RFC 5322 rendering when the timestamp is recognized.
 * @example
 * ```ts
 * import { rfc5322DateFromOutlookTimestamp } from "@beep/libpff"
 * import { O } from "@beep/utils"
 *
 * console.log(
 *   O.getOrElse(rfc5322DateFromOutlookTimestamp("Nov 26, 2020 22:18:29.446000000 UTC"), () => "")
 * ) // "26 Nov 2020 22:18:29 +0000"
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

/**
 * Assemble a deterministic EML document from pre-read message parts.
 *
 * Without attachments the message is single-part with the body's content
 * type; with attachments it becomes `multipart/mixed` with the body as the
 * first part and one base64 part per attachment. A missing body yields an
 * empty `text/plain` part. Output is byte-stable given identical inputs.
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
    return A.join(
      [
        ...headerLines,
        "MIME-Version: 1.0",
        `Content-Type: ${body.contentType}`,
        "Content-Transfer-Encoding: 8bit",
        "",
        body.content,
      ],
      CRLF
    );
  }

  const sections: Array<string> = [
    ...headerLines,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${input.boundary}"`,
    "",
    `--${input.boundary}`,
    `Content-Type: ${body.contentType}`,
    "Content-Transfer-Encoding: 8bit",
    "",
    body.content,
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
