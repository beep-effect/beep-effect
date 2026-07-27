import {
  foldHeaderLine,
  rfc5322DateFromOutlookTimestamp,
  stripMimeStructuralHeaders,
  synthesizeEmlHeaderBlock,
} from "@beep/libpff";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";

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

  it("hard-splits a run that carries no fold point of its own", () => {
    const original = `X-Blob: ${"a".repeat(3000)}`;
    const folded = foldHeaderLine(original);

    expect(folded.length).toBeGreaterThan(2);
    expect(folded.every((line) => octets(line) <= 998)).toBe(true);
    // A space-less run has no space to promote to an indent, so folding it
    // inserts one. No content is lost or duplicated, which is the invariant
    // that still holds.
    expect(folded.join("").replaceAll(" ", "")).toBe(original.replaceAll(" ", ""));
  });

  it("measures octets rather than characters", () => {
    // Each euro sign is three octets, so 400 of them exceed the limit while the
    // character count alone would not.
    const original = `Subject: ${"€".repeat(400)}`;

    expect(original.length).toBeLessThan(998);
    expect(octets(original)).toBeGreaterThan(998);
    expect(foldHeaderLine(original).length).toBeGreaterThan(1);
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
