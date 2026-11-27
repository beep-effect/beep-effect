import {
  assembleEml,
  foldHeaderLine,
  parseInternetHeaders,
  rfc5322DateFromOutlookTimestamp,
  stripMimeStructuralHeaders,
  synthesizeEmlHeaderBlock,
} from "@beep/libpff";
import { it } from "@beep/test-runner";
import { O } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Base64 from "effect/encoding/Base64";
import { pipe } from "effect/Function";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Str from "effect/String";

const octets = (value: string): number => new TextEncoder().encode(value).length;

describe("foldHeaderLine", () => {
  it("leaves a header that already fits untouched", () => {
    expect(foldHeaderLine("Subject: short enough")).toStrictEqual(["Subject: short enough"]);
  });

  it("folds an over-long DKIM-Signature at space boundaries and unfolds losslessly", () => {
    const original = `DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=example.com; ${pipe("h=from:to:subject; ", Str.repeat(70))}b=signature`;
    const folded = foldHeaderLine(original);

    expect(original.length).toBeGreaterThan(998);
    expect(folded.length).toBeGreaterThan(1);
    expect(A.every(folded, (line) => octets(line) <= 998)).toBe(true);
    expect(
      A.every(folded.slice(1), (line) => pipe(line, Str.startsWith(" "))),
      "continuations carry the single-space indent that marks them as folded"
    ).toBe(true);
    expect(pipe(O.fromNullishOr(folded[0]), O.map(Str.startsWith(" ")), O.getOrUndefined)).toBe(false);
    expect(A.join(folded, ""), "unfolding per RFC 5322 restores the original byte for byte").toBe(original);
  });

  it("passes through a line with no fold point at all", () => {
    const original = pipe("a", Str.repeat(3000));

    expect(
      foldHeaderLine(original),
      "a split would insert whitespace that survives unfolding, so the over-long line is emitted as it arrived"
    ).toStrictEqual([original]);
  });

  it("keeps an unbreakable value whole while still folding at the one real space", () => {
    const token = pipe("a", Str.repeat(3000));
    const original = `X-Blob: ${token}`;
    const folded = foldHeaderLine(original);

    expect(folded, "the space after the field name is a fold point; the value itself is never cut").toStrictEqual([
      "X-Blob:",
      ` ${token}`,
    ]);
    expect(A.join(folded, "")).toBe(original);
  });

  it("folds up to the unbreakable run and leaves that run whole", () => {
    const token = pipe("b", Str.repeat(1500));
    const original = `X-Mixed: ${pipe("word ", Str.repeat(300))}${token}`;
    const folded = foldHeaderLine(original);

    expect(folded.length).toBeGreaterThan(1);
    expect(
      A.filter(folded, (line) => octets(line) > 998),
      "every foldable line respects the limit; only the unbreakable token is over"
    ).toHaveLength(1);
    expect(A.some(folded, (line) => pipe(line, Str.includes(token)))).toBe(true);
    expect(A.join(folded, ""), "still byte-for-byte reversible, because every break sat on a real space").toBe(
      original
    );
  });

  it("measures octets rather than characters", () => {
    const original = `Subject: ${pipe("€ ", Str.repeat(400))}`;

    expect(original.length).toBeLessThan(998);
    expect(octets(original), "each euro sign is three octets, so 400 of them exceed the limit").toBeGreaterThan(998);
    expect(foldHeaderLine(original).length, "the spaces give the line somewhere to fold").toBeGreaterThan(1);
    expect(A.every(foldHeaderLine(original), (line) => octets(line) <= 998)).toBe(true);
  });
});

describe("rfc5322DateFromOutlookTimestamp", () => {
  it("renders a pffexport timestamp as an RFC 5322 date", () => {
    expect(O.getOrElse(rfc5322DateFromOutlookTimestamp("Nov 26, 2020 22:18:29.446000000 UTC"), () => "")).toBe(
      "26 Nov 2020 22:18:29 +0000"
    );
    expect(O.getOrElse(rfc5322DateFromOutlookTimestamp("Jan 02, 2026 03:04:05.000000000 UTC"), () => "")).toBe(
      "02 Jan 2026 03:04:05 +0000"
    );
  });

  it("declines anything that is not a recognized UTC timestamp", () => {
    for (const value of ["Foo 26, 2020 22:18:29 UTC", "26 Nov 2020 22:18:29 +0000", "Nov 26, 2020 22:18 UTC", ""]) {
      assertNone(rfc5322DateFromOutlookTimestamp(value));
    }
  });

  it("declines out-of-range calendar and clock components", () => {
    const patternShapedButOutOfRange = [
      "Nov 99, 2020 25:61:61.000000000 UTC",
      "Nov 26, 2020 24:00:00.000000000 UTC",
      "Nov 26, 2020 22:60:00.000000000 UTC",
      "Nov 26, 2020 22:18:60.000000000 UTC",
      "Nov 00, 2020 22:18:29.000000000 UTC",
      "Nov 31, 2020 22:18:29.000000000 UTC",
    ];
    for (const value of patternShapedButOutOfRange) {
      assertNone(rfc5322DateFromOutlookTimestamp(value));
    }
  });

  it("applies the right February length for the year", () => {
    assertNone(rfc5322DateFromOutlookTimestamp("Feb 29, 2021 00:00:00.000000000 UTC"));
    expect(O.getOrElse(rfc5322DateFromOutlookTimestamp("Feb 29, 2020 00:00:00.000000000 UTC"), () => "")).toBe(
      "29 Feb 2020 00:00:00 +0000"
    );
    const centuryNonLeapFeb29 = rfc5322DateFromOutlookTimestamp("Feb 29, 1900 00:00:00.000000000 UTC");
    assertNone(centuryNonLeapFeb29);
    expect(O.getOrElse(rfc5322DateFromOutlookTimestamp("Feb 29, 2000 00:00:00.000000000 UTC"), () => "")).toBe(
      "29 Feb 2000 00:00:00 +0000"
    );
  });

  it("accepts the valid upper bounds", () => {
    expect(O.getOrElse(rfc5322DateFromOutlookTimestamp("Nov 26, 2020 23:59:59.000000000 UTC"), () => "")).toBe(
      "26 Nov 2020 23:59:59 +0000"
    );
    expect(O.getOrElse(rfc5322DateFromOutlookTimestamp("Dec 31, 2020 23:59:59.000000000 UTC"), () => "")).toBe(
      "31 Dec 2020 23:59:59 +0000"
    );
  });
});

describe("stripMimeStructuralHeaders", () => {
  it("folds an over-long verbatim header line", () => {
    const long = `X-Trace: ${pipe("hop ", Str.repeat(400))}end`;
    const stripped = stripMimeStructuralHeaders(`Subject: hi\r\n${long}\r\n`);

    expect(octets(long)).toBeGreaterThan(998);
    expect(A.every(pipe(stripped, Str.split("\r\n")), (line) => octets(line) <= 998)).toBe(true);
    expect(pipe(stripped, Str.startsWith("Subject: hi\r\n"))).toBe(true);
  });

  it("leaves an already-folded block alone", () => {
    const block = "Subject: hi\r\nContent-Type: multipart/mixed;\r\n boundary=x\r\nFrom: a@b.c\r\n";

    expect(stripMimeStructuralHeaders(block)).toBe("Subject: hi\r\nFrom: a@b.c");
  });
});

describe("assembleEml", () => {
  const boundary = "=_beep-test-boundary";

  const singlePart = (content: string, contentType = "text/plain; charset=utf-8"): string =>
    assembleEml({
      attachments: [],
      body: O.some({ content, contentType }),
      boundary,
      headerBlock: "Subject: hi",
    });

  const unwrapAndDecodeBase64Payload = (payload: string): string =>
    Result.getOrElse(Base64.decodeString(A.join(pipe(payload, Str.split("\r\n")), "")), () => "");

  const singlePartPayload = (eml: string): string =>
    pipe(
      eml,
      Str.indexOf("\r\n\r\n"),
      O.match({ onNone: () => pipe(eml, Str.slice(3)), onSome: (separator) => pipe(eml, Str.slice(separator + 4)) })
    );

  it("keeps a short body 8bit and byte-identical", () => {
    expect(singlePart("hello")).toBe(
      A.join(
        [
          "Subject: hi",
          "MIME-Version: 1.0",
          "Content-Type: text/plain; charset=utf-8",
          "Content-Transfer-Encoding: 8bit",
          "",
          "hello",
        ],
        "\r\n"
      )
    );
  });

  it("flips a single 999-octet line to wrapped base64 that round-trips", () => {
    const content = pipe("a", Str.repeat(999));
    const eml = singlePart(content);

    expect(eml).toContain("Content-Transfer-Encoding: base64");
    const payload = singlePartPayload(eml);
    expect(A.every(pipe(payload, Str.split("\r\n")), (line) => line.length <= 76)).toBe(true);
    expect(unwrapAndDecodeBase64Payload(payload)).toBe(content);
  });

  it("keeps a body line of exactly 998 octets 8bit", () => {
    const content = pipe("a", Str.repeat(998));
    const eml = singlePart(content);

    expect(eml).toContain("Content-Transfer-Encoding: 8bit");
    expect(eml).not.toContain("Content-Transfer-Encoding: base64");
    expect(singlePartPayload(eml)).toBe(content);
  });

  it("measures octets rather than characters", () => {
    const content = pipe("€", Str.repeat(333));
    const eml = singlePart(content);

    expect(content.length).toBe(333);
    expect(octets(content), "each euro sign is three octets, so 333 of them cross the limit").toBe(999);
    expect(eml).toContain("Content-Transfer-Encoding: base64");
    expect(unwrapAndDecodeBase64Payload(singlePartPayload(eml))).toBe(content);
  });

  it("preserves mixed line endings byte for byte through base64", () => {
    const content = `a\r\nb\n${pipe("x", Str.repeat(999))}`;
    const eml = singlePart(content);

    expect(eml).toContain("Content-Transfer-Encoding: base64");
    expect(unwrapAndDecodeBase64Payload(singlePartPayload(eml))).toBe(content);
  });

  it("counts a lone CR toward its physical line", () => {
    const content = `${pipe("c", Str.repeat(500))}\r${pipe("d", Str.repeat(500))}`;
    const eml = singlePart(content);

    expect(eml, "the bare CR is content, so this is one 1001-octet physical line").toContain(
      "Content-Transfer-Encoding: base64"
    );
    expect(unwrapAndDecodeBase64Payload(singlePartPayload(eml))).toBe(content);
  });

  it("encodes a long multipart body while leaving the attachment part and boundaries unchanged", () => {
    const content = `<p>${pipe("x", Str.repeat(1200))}</p>`;
    const eml = assembleEml({
      attachments: [{ bytes: new TextEncoder().encode("pdfbytes"), fileName: "report.pdf" }],
      body: O.some({ content, contentType: "text/html; charset=utf-8" }),
      boundary,
      headerBlock: "Subject: hi",
    });

    expect(eml).toContain(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    expect(eml).toContain("Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64");
    expect(eml).toContain('Content-Type: application/octet-stream; name="report.pdf"');
    expect(eml).toContain('Content-Disposition: attachment; filename="report.pdf"');
    expect(eml).toContain("cGRmYnl0ZXM=");
    expect(pipe(eml, Str.endsWith(`--${boundary}--`))).toBe(true);

    const bodySection = pipe(eml, Str.split(`\r\n--${boundary}\r\n`))[1] ?? "";
    expect(
      unwrapAndDecodeBase64Payload(
        pipe(
          bodySection,
          Str.indexOf("\r\n\r\n"),
          O.match({
            onNone: () => pipe(bodySection, Str.slice(3)),
            onSome: (separator) => pipe(bodySection, Str.slice(separator + 4)),
          })
        )
      )
    ).toBe(content);
  });

  it("keeps a missing body 8bit with an empty part", () => {
    expect(assembleEml({ attachments: [], body: O.none(), boundary, headerBlock: "Subject: hi" })).toBe(
      A.join(
        [
          "Subject: hi",
          "MIME-Version: 1.0",
          "Content-Type: text/plain; charset=utf-8",
          "Content-Transfer-Encoding: 8bit",
          "",
          "",
        ],
        "\r\n"
      )
    );
  });
});

describe("synthesizeEmlHeaderBlock", () => {
  it("emits a real Date header parsed from the Outlook client submit time", () => {
    const block = synthesizeEmlHeaderBlock({
      "Client submit time": "Nov 26, 2020 22:18:29.446000000 UTC",
      "Sender email address": "ada@example.com",
      "Sender name": "Ada Lovelace",
      Subject: "Quarterly report",
    });

    expect(block).toBe(
      A.join(
        ['From: "Ada Lovelace" <ada@example.com>', "Subject: Quarterly report", "Date: 26 Nov 2020 22:18:29 +0000"],
        "\r\n"
      )
    );
    expect(block, "the nonstandard carrier header is gone").not.toContain("X-Beep-Libpff-Client-Submit-Time");
  });

  it("omits Date rather than emitting an unparseable submit time", () => {
    const block = synthesizeEmlHeaderBlock({
      "Client submit time": "sometime last Tuesday",
      Subject: "No usable date",
    });

    expect(block).toBe("Subject: No usable date");
    expect(block).not.toContain("Date:");
  });

  it("folds a synthesized line that the flattened Outlook value made over-long", () => {
    const block = synthesizeEmlHeaderBlock({ Subject: pipe("word ", Str.repeat(400)) });

    expect(A.every(pipe(block, Str.split("\r\n")), (line) => octets(line) <= 998)).toBe(true);
    expect(pipe(block, Str.split("\r\n")).length).toBeGreaterThan(1);
  });
});

describe("parseInternetHeaders", () => {
  it("unfolds, lowercases, retains repeated headers and respects quoted commas", () => {
    expect(
      parseInternetHeaders(
        'TO: "Doe, Ada" <ada@example.com>,\r\n\t bob@example.com\r\nTo: carol@example.com\r\nCc: "A\\" B, C" <c@example.com>\r\nReferences: <one>\r\n <two>\r\nReferences: <three>\r\nSubject: hello\r\n world\r\n\r\nTo: body'
      )
    ).toStrictEqual({
      to: ['"Doe, Ada" <ada@example.com>', "bob@example.com", "carol@example.com"],
      cc: ['"A\\" B, C" <c@example.com>'],
      references: ["<one>", "<two>", "<three>"],
      subject: ["hello world"],
    });
    expect(parseInternetHeaders("From: a@example.com\nSubject: folded\n value\nBad line").subject).toStrictEqual([
      "folded value",
    ]);
  });

  it("keeps prototype-named header fields as ordinary own keys", () => {
    const headers = parseInternetHeaders("Subject: hi\nConstructor: x\n__proto__: y\nHasOwnProperty: z\n");
    expect(R.toEntries(headers)).toStrictEqual([
      ["subject", ["hi"]],
      ["constructor", ["x"]],
      ["__proto__", ["y"]],
      ["hasownproperty", ["z"]],
    ]);
    expect(Object.getPrototypeOf(headers)).toBe(Object.prototype);
  });
});
