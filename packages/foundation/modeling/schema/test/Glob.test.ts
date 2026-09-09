import { fcRuns } from "@beep/fc-runs";
import * as GlobModule from "@beep/schema/Glob";
import { Glob } from "@beep/schema/Glob";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeGlobModuleSchemaSync = S.decodeSync(GlobModule.Schema);
const decodeUnknownGlobSync = S.decodeUnknownSync(Glob);
const isGlob2 = S.is(Glob);
const GlobPayload = S.Struct({ glob: Glob });
const decodeGlobPayloadSync = S.decodeSync(GlobPayload);

describe("Glob", () => {
  it("accepts portable glob patterns supported by the Bun parser", () => {
    expect(decodeUnknownGlobSync("src/**/*.ts")).toBe("src/**/*.ts");
    expect(decodeUnknownGlobSync("{src,test}/**/*.ts")).toBe("{src,test}/**/*.ts");
    expect(decodeUnknownGlobSync("foo/bar")).toBe("foo/bar");
    expect(decodeUnknownGlobSync("foo/[bar")).toBe("foo/[bar");
    expect(decodeUnknownGlobSync("foo/{bar")).toBe("foo/{bar");
    expect(decodeUnknownGlobSync("!index.ts")).toBe("!index.ts");
  });

  it("rejects empty input", () => {
    expect(() => decodeUnknownGlobSync("")).toThrow("Glob pattern must not be empty");
  });

  it("rejects backslash-separated patterns", () => {
    expect(() => decodeUnknownGlobSync("src\\**\\*.ts")).toThrow(
      "Glob pattern must use forward slashes instead of backslashes"
    );
  });

  it("rejects patterns longer than the current matcher limit", () => {
    const tooLong = "a".repeat(65_537);

    expect(() => decodeUnknownGlobSync(tooLong)).toThrow("Glob pattern must not exceed 65536 characters");
  });

  it("supports guard-style schema checks", () => {
    expect(isGlob2("src/**/*.ts")).toBe(true);
    expect(isGlob2("src\\**\\*.ts")).toBe(false);
  });

  it("reports nested field failures at the glob key", () => {
    expect(() => decodeGlobPayloadSync({ glob: "src\\**\\*.ts" })).toThrow(`at ["glob"]`);
  });

  it("derives portable glob patterns from the source schema arbitrary", () => {
    const arbitrary = S.toArbitrary(Glob)(fc);
    fc.assert(
      fc.property(arbitrary, (pattern) => {
        expect(isGlob2(pattern)).toBe(true);
        expect(decodeUnknownGlobSync(pattern)).toBe(pattern);
      }),
      fcRuns(25)
    );
  });

  it("exposes the canonical namespace module schema role", () => {
    expect(decodeGlobModuleSchemaSync("src/**/*.ts")).toBe("src/**/*.ts");
    expect(GlobModule.Glob).toBe(GlobModule.Schema);
  });
});
