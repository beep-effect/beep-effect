import {
  assembleEml,
  foldHeaderLine,
  rfc5322DateFromOutlookTimestamp,
  stripMimeStructuralHeaders,
  synthesizeEmlHeaderBlock,
} from "@beep/libpff";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Encoding, Result } from "effect";

const octets = (value: string): number => new TextEncoder().encode(value).length;

describe("foldHeaderLine", () => {
  it("leaves a header that already fits untouched", () => {
    expect(foldHeaderLine("Subject: short enough")).toStrictEqual(["Subject: short enough"]);
  });

  it("folds an over-long DKIM-Signature at space boundaries and unfolds losslessly", () => {
    const original = `DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=example.com; ${"h=from:to:subject; ".repeat(70)}b=signature`;
    const folded = foldHeaderLine(original);

    expect(original.length).toBeGreaterThan(998);
    expect(folded.length).toBeGreaterThan(1);
    expect(folded.every((line) => octets(line) <= 998)).toBe(true);
    // Continuations carry the single-space indent that marks them as folded.
    expect(folded.slice(1).every((line) => line.startsWith(" "))).toBe(true);
    expect(folded[0]?.startsWith(" ")).toBe(false);
    // Unfolding per RFC 5322 restores the original byte for byte.
    expect(folded.join("")).toBe(original);
  });

  it("passes through a line with no fold point at all", () => {
    // Nothing to promote to a continuation indent. Splitting would insert
    // whitespace that survives unfolding and corrupt the value, so the
    // over-long line is emitted exactly as it arrived.
    const original = "a".repeat(3000);

    expect(foldHeaderLine(original)).toStrictEqual([original]);
  });

  it("keeps an unbreakable value whole while still folding at the one real space", () => {
    const token = "a".repeat(3000);
    const original = `X-Blob: ${token}`;
    const folded = foldHeaderLine(original);

    // The space after the field name is a legitimate fold point, so it is used;
    // the value itself is never cut.
    expect(folded).toStrictEqual(["X-Blob:", ` ${token}`]);
    expect(folded.join("")).toBe(original);
  });

  it("folds up to the unbreakable run and leaves that run whole", () => {
    const token = "b".repeat(1500);
    const original = `X-Mixed: ${"word ".repeat(300)}${token}`;
    const folded = foldHeaderLine(original);

    expect(folded.length).toBeGreaterThan(1);
    // Every foldable line respects the limit; only the unbreakable token is over.
    expect(folded.filter((line) => octets(line) > 998)).toHaveLength(1);
    expect(folded.some((line) => line.includes(token))).toBe(true);
    // Still byte-for-byte reversible, because every break sat on a real space.
    expect(folded.join("")).toBe(original);
  });

  it("measures octets rather than characters", () => {
    // Each euro sign is three octets, so 400 of them exceed the limit while the
    // character count alone would not. Spaces give it somewhere to fold.
    const original = `Subject: ${"€ ".repeat(400)}`;

    expect(original.length).toBeLessThan(998);
    expect(octets(original)).toBeGreaterThan(998);
    expect(foldHeaderLine(original).length).toBeGreaterThan(1);
    expect(foldHeaderLine(original).every((line) => octets(line) <= 998)).toBe(true);
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
      expect(O.isNone(rfc5322DateFromOutlookTimestamp(value))).toBe(true);
    }
  });

  it("declines out-of-range calendar and clock components", () => {
    // The pattern only constrains digit counts, so these all match it.
    for (const value of [
      "Nov 99, 2020 25:61:61.000000000 UTC",
      "Nov 26, 2020 24:00:00.000000000 UTC",
      "Nov 26, 2020 22:60:00.000000000 UTC",
      "Nov 26, 2020 22:18:60.000000000 UTC",
      "Nov 00, 2020 22:18:29.000000000 UTC",
      "Nov 31, 2020 22:18:29.000000000 UTC",
    ]) {
      expect(O.isNone(rfc5322DateFromOutlookTimestamp(value))).toBe(true);
    }
  });

  it("applies the right February length for the year", () => {
    expect(O.isNone(rfc5322DateFromOutlookTimestamp("Feb 29, 2021 00:00:00.000000000 UTC"))).toBe(true);
    expect(O.getOrElse(rfc5322DateFromOutlookTimestamp("Feb 29, 2020 00:00:00.000000000 UTC"), () => "")).toBe(
      "29 Feb 2020 00:00:00 +0000"
    );
    // Century rule: 1900 is not a leap year, 2000 is.
    expect(O.isNone(rfc5322DateFromOutlookTimestamp("Feb 29, 1900 00:00:00.000000000 UTC"))).toBe(true);
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
    const long = `X-Trace: ${"hop ".repeat(400)}end`;
    const stripped = stripMimeStructuralHeaders(`Subject: hi\r\n${long}\r\n`);

    expect(octets(long)).toBeGreaterThan(998);
    expect(stripped.split("\r\n").every((line) => octets(line) <= 998)).toBe(true);
    expect(stripped.startsWith("Subject: hi\r\n")).toBe(true);
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

  // Strips the RFC 2045 76-column wrapping and decodes the payload back to
  // the body string the part was assembled from.
  const decodeBase64Payload = (payload: string): string =>
    Result.getOrElse(Encoding.decodeBase64String(payload.split("\r\n").join("")), () => "");

  const singlePartPayload = (eml: string): string => eml.slice(eml.indexOf("\r\n\r\n") + 4);

  it("keeps a short body 8bit and byte-identical", () => {
    expect(singlePart("hello")).toBe(
      [
        "Subject: hi",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        "hello",
      ].join("\r\n")
    );
  });

  it("flips a single 999-octet line to wrapped base64 that round-trips", () => {
    const content = "a".repeat(999);
    const eml = singlePart(content);

    expect(eml).toContain("Content-Transfer-Encoding: base64");
    const payload = singlePartPayload(eml);
    expect(payload.split("\r\n").every((line) => line.length <= 76)).toBe(true);
    expect(decodeBase64Payload(payload)).toBe(content);
  });

  it("keeps a body line of exactly 998 octets 8bit", () => {
    const content = "a".repeat(998);
    const eml = singlePart(content);

    expect(eml).toContain("Content-Transfer-Encoding: 8bit");
    expect(eml).not.toContain("Content-Transfer-Encoding: base64");
    expect(singlePartPayload(eml)).toBe(content);
  });

  it("measures octets rather than characters", () => {
    // Each euro sign is three octets, so 333 of them cross the limit while
    // the character count stays far below it.
    const content = "€".repeat(333);
    const eml = singlePart(content);

    expect(content.length).toBe(333);
    expect(octets(content)).toBe(999);
    expect(eml).toContain("Content-Transfer-Encoding: base64");
    expect(decodeBase64Payload(singlePartPayload(eml))).toBe(content);
  });

  it("preserves mixed line endings byte for byte through base64", () => {
    const content = `a\r\nb\n${"x".repeat(999)}`;
    const eml = singlePart(content);

    expect(eml).toContain("Content-Transfer-Encoding: base64");
    expect(decodeBase64Payload(singlePartPayload(eml))).toBe(content);
  });

  it("counts a lone CR toward its physical line", () => {
    // No recognized line break splits this, so it is one 1001-octet physical
    // line: the bare CR is content, not a terminator.
    const content = `${"c".repeat(500)}\r${"d".repeat(500)}`;
    const eml = singlePart(content);

    expect(eml).toContain("Content-Transfer-Encoding: base64");
    expect(decodeBase64Payload(singlePartPayload(eml))).toBe(content);
  });

  it("encodes a long multipart body while leaving the attachment part and boundaries unchanged", () => {
    const content = `<p>${"x".repeat(1200)}</p>`;
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
    expect(eml.endsWith(`--${boundary}--`)).toBe(true);

    const bodySection = eml.split(`\r\n--${boundary}\r\n`)[1] ?? "";
    expect(decodeBase64Payload(bodySection.slice(bodySection.indexOf("\r\n\r\n") + 4))).toBe(content);
  });

  it("keeps a missing body 8bit with an empty part", () => {
    expect(assembleEml({ attachments: [], body: O.none(), boundary, headerBlock: "Subject: hi" })).toBe(
      [
        "Subject: hi",
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        "",
      ].join("\r\n")
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
      ['From: "Ada Lovelace" <ada@example.com>', "Subject: Quarterly report", "Date: 26 Nov 2020 22:18:29 +0000"].join(
        "\r\n"
      )
    );
    // The nonstandard carrier header is gone.
    expect(block).not.toContain("X-Beep-Libpff-Client-Submit-Time");
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
    const block = synthesizeEmlHeaderBlock({ Subject: "word ".repeat(400) });

    expect(block.split("\r\n").every((line) => octets(line) <= 998)).toBe(true);
    expect(block.split("\r\n").length).toBeGreaterThan(1);
  });
});
