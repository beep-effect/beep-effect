import { FileName } from "@beep/schema/FileName";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("FileName", () => {
  const decode = S.decodeUnknownSync(FileName);

  it("accepts portable file names with known extensions", () => {
    expect(decode("readme.txt")).toBe("readme.txt");
    expect(decode("archive.tar.gz")).toBe("archive.tar.gz");
    expect(decode("release.notes.v1.txt")).toBe("release.notes.v1.txt");
    expect(decode(".cache.png")).toBe(".cache.png");
  });

  it("keeps FilePath's any-major-os portability policy for accepted names", () => {
    expect(decode("a<.txt")).toBe("a<.txt");
    expect(decode("CON.txt")).toBe("CON.txt");
  });

  it("rejects names without a non-empty basename before the final extension", () => {
    expect(() => decode(".png")).toThrow();
  });

  it("rejects names without a known extension segment", () => {
    expect(() => decode("readme")).toThrow();
    expect(() => decode("readme.")).toThrow();
    expect(() => decode("readme.unknownext")).toThrow();
  });

  it("rejects names containing path separators", () => {
    expect(() => decode("bad/name.txt")).toThrow("File name stems must not contain /");
    expect(() => decode("bad\\name.txt")).toThrow("File name stems must not contain \\");
  });

  it("rejects names containing embedded NUL bytes", () => {
    expect(() => decode(`bad\u0000name.txt`)).toThrow("File name stems must not contain embedded NUL bytes");
  });

  it("supports guard-style schema checks", () => {
    const isFileName = S.is(FileName);

    expect(isFileName("photo.png")).toBe(true);
    expect(isFileName("photo")).toBe(false);
    expect(isFileName("bad/name.txt")).toBe(false);
  });

  it("reports nested field failures at the fileName key", () => {
    const Payload = S.Struct({
      fileName: FileName,
    });

    expect(() => S.decodeUnknownSync(Payload)({ fileName: "bad/name.txt" })).toThrow(`at ["fileName"]`);
  });

  it("decodes object schemas with a fileName property", () => {
    const Payload = S.Struct({
      fileName: FileName,
    });
    const input = { fileName: "archive.tar.gz" };

    expect(S.decodeUnknownSync(Payload)(input)).toEqual(input);
  });

  it("derives only-valid names from the schema arbitrary and round-trips them", () => {
    const arbitrary = S.toArbitrary(FileName);
    const isFileName = S.is(FileName);

    fc.assert(
      fc.property(arbitrary, (name) => {
        expect(isFileName(name)).toBe(true);
        expect(decode(name)).toBe(name);
      }),
      { numRuns: 50 }
    );
  });
});
