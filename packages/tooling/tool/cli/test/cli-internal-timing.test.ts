import { boundedText, durationMsSince, errorMessage, firstLine, timestampIso, todayYmd } from "@beep/repo-cli/test/Cli";
import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Str from "effect/String";

describe("internal/cli/Timing", () => {
  it("formats the current instant as an ISO-8601 UTC string", () => {
    const iso = timestampIso();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("measures non-negative elapsed milliseconds, flooring a future start mark at zero", () => {
    const now = globalThis.performance.now();
    expect(durationMsSince(now)).toBeGreaterThanOrEqual(0);
    expect(durationMsSince(now + 60_000)).toBe(0);
    expect(durationMsSince(now - 1_000)).toBeGreaterThanOrEqual(1_000);
  });

  it("renders today's UTC date as a zero-padded YYYY-MM-DD string", () => {
    const today = todayYmd();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = DateTime.nowUnsafe();
    const year = `${DateTime.getPartUtc(now, "year")}`;
    expect(Str.startsWith(year)(today)).toBe(true);
  });

  it("takes the trimmed first line across CRLF and empty input", () => {
    expect(firstLine("  head \r\ntail")).toBe("head");
    expect(firstLine("")).toBe("");
  });

  it("bounds text and reads error messages from objects", () => {
    expect(boundedText("abc", 3)).toBe("abc");
    expect(boundedText(4)("abcdef")).toBe("a...");
    expect(errorMessage({ message: "plain" }, "fallback")).toBe("plain");
    expect(errorMessage(null, "fallback")).toBe("fallback");
  });
});
