import * as GlobModule from "@beep/schema/Glob";
import { Glob } from "@beep/schema/Glob";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("Glob", () => {
  const decode = S.decodeUnknownSync(Glob);

  it("accepts portable glob patterns supported by the Bun parser", () => {
    expect(decode("src/**/*.ts")).toBe("src/**/*.ts");
    expect(decode("{src,test}/**/*.ts")).toBe("{src,test}/**/*.ts");
    expect(decode("foo/bar")).toBe("foo/bar");
    expect(decode("foo/[bar")).toBe("foo/[bar");
    expect(decode("foo/{bar")).toBe("foo/{bar");
    expect(decode("!index.ts")).toBe("!index.ts");
  });

  it("rejects empty input", () => {
    expect(() => decode("")).toThrow("Glob pattern must not be empty");
  });

  it("rejects backslash-separated patterns", () => {
    expect(() => decode("src\\**\\*.ts")).toThrow("Glob pattern must use forward slashes instead of backslashes");
  });

  it("rejects patterns longer than the current matcher limit", () => {
    const tooLong = "a".repeat(65_537);

    expect(() => decode(tooLong)).toThrow("Glob pattern must not exceed 65536 characters");
  });

  it("supports guard-style schema checks", () => {
    const isGlob = S.is(Glob);

    expect(isGlob("src/**/*.ts")).toBe(true);
    expect(isGlob("src\\**\\*.ts")).toBe(false);
  });

  it("reports nested field failures at the glob key", () => {
    const Payload = S.Struct({
      glob: Glob,
    });

    expect(() => S.decodeUnknownSync(Payload)({ glob: "src\\**\\*.ts" })).toThrow(`at ["glob"]`);
  });

  it("derives portable glob patterns from the source schema arbitrary", () => {
    const arbitrary = S.toArbitrary(Glob);
    const isGlob = S.is(Glob);

    fc.assert(
      fc.property(arbitrary, (pattern) => {
        expect(isGlob(pattern)).toBe(true);
        expect(decode(pattern)).toBe(pattern);
      }),
      { numRuns: 25 }
    );
  });

  it("exposes the canonical namespace module schema role", () => {
    expect(S.decodeUnknownSync(GlobModule.Schema)("src/**/*.ts")).toBe("src/**/*.ts");
    expect(GlobModule.Glob).toBe(GlobModule.Schema);
  });
});
