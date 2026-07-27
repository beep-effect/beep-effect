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

/**
 * Normalize a verbatim transport-header block for reuse in an assembled EML.
 *
 * The block is truncated at its first blank line (the RFC 5322 header
 * terminator), MIME-structural headers and their folded continuation lines
 * are removed, and line endings are normalized to CRLF.
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
        kept.push(line);
      }
      continue;
    }

    dropping = O.match(headerName(line), {
      onNone: () => false,
      onSome: (name) => A.contains(structuralHeaderNames, name),
    });

    if (!dropping) {
      kept.push(line);
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
 * Emits `From:` (only when a sender email address is present), `Subject:`,
 * and `X-Beep-Libpff-Client-Submit-Time:` carrying the verbatim submit-time
 * string. `Date:`/`To:`/`Cc:` synthesis is an explicit P3 waiver — the
 * verbatim values remain available in the JSONL record headers and the
 * exported metadata children.
 *
 * @example
 * ```ts
 * import { synthesizeEmlHeaderBlock } from "@beep/libpff"
 *
 * const block = synthesizeEmlHeaderBlock({
 *   "Sender email address": "ada@example.com",
 *   "Sender name": "Ada Lovelace",
 *   "Subject": "Quarterly report"
 * })
 * console.log(block.startsWith("From: \"Ada Lovelace\" <ada@example.com>")) // true
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

  const submitTime = O.fromUndefinedOr(headers[outlookClientSubmitTimeKey]).pipe(
    O.map(sanitizeHeaderValue),
    O.filter(Str.isNonEmpty)
  );
  if (O.isSome(submitTime)) {
    lines.push(`X-Beep-Libpff-Client-Submit-Time: ${submitTime.value}`);
  }

  return A.join(lines, CRLF);
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
