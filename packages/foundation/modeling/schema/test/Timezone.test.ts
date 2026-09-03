import { Timezone } from "@beep/schema/Timezone";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const decodeTimezoneSync = S.decodeSync(Timezone);
const decodeUnknownTimezoneSync = S.decodeUnknownSync(Timezone);

describe("Timezone", () => {
  it("decodes IANA timezone literals from generated @beep/data values", () => {
    expect(decodeTimezoneSync("UTC")).toBe("UTC");
    expect(decodeTimezoneSync("America/New_York")).toBe("America/New_York");
    expect(Timezone.Options).toContain("Europe/London");
  });

  it("rejects unknown timezone names", () => {
    expect(() => decodeUnknownTimezoneSync("Mars/Base")).toThrow();
  });
});
