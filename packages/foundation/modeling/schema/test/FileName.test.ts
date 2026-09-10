import { fcRuns } from "@beep/fc-runs";
import { FileName } from "@beep/schema/FileName";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownFileNameSync = S.decodeUnknownSync(FileName);
const isFileName2 = S.is(FileName);
const FileNamePayload = S.Struct({ fileName: FileName });
const decodeFileNamePayloadSync = S.decodeSync(FileNamePayload);
const decodeUnknownFileNamePayloadSync = S.decodeUnknownSync(FileNamePayload);

describe("FileName", () => {
  it("accepts portable file names with known extensions", () => {
    expect(decodeUnknownFileNameSync("readme.txt")).toBe("readme.txt");
    expect(decodeUnknownFileNameSync("archive.tar.gz")).toBe("archive.tar.gz");
    expect(decodeUnknownFileNameSync("release.notes.v1.txt")).toBe("release.notes.v1.txt");
    expect(decodeUnknownFileNameSync(".cache.png")).toBe(".cache.png");
  });

  it("keeps FilePath's any-major-os portability policy for accepted names", () => {
    expect(decodeUnknownFileNameSync("a<.txt")).toBe("a<.txt");
    expect(decodeUnknownFileNameSync("CON.txt")).toBe("CON.txt");
  });

  it("rejects names without a non-empty basename before the final extension", () => {
    expect(() => decodeUnknownFileNameSync(".png")).toThrow();
  });

  it("rejects names without a known extension segment", () => {
    expect(() => decodeUnknownFileNameSync("readme")).toThrow();
    expect(() => decodeUnknownFileNameSync("readme.")).toThrow();
    expect(() => decodeUnknownFileNameSync("readme.unknownext")).toThrow();
  });

  it("rejects names containing path separators", () => {
    expect(() => decodeUnknownFileNameSync("bad/name.txt")).toThrow("File name stems must not contain /");
    expect(() => decodeUnknownFileNameSync("bad\\name.txt")).toThrow("File name stems must not contain \\");
  });

  it("rejects names containing embedded NUL bytes", () => {
    expect(() => decodeUnknownFileNameSync(`bad\u0000name.txt`)).toThrow(
      "File name stems must not contain embedded NUL bytes"
    );
  });

  it("supports guard-style schema checks", () => {
    expect(isFileName2("photo.png")).toBe(true);
    expect(isFileName2("photo")).toBe(false);
    expect(isFileName2("bad/name.txt")).toBe(false);
  });

  it("reports nested field failures at the fileName key", () => {
    expect(() => decodeFileNamePayloadSync({ fileName: "bad/name.txt" })).toThrow(`at ["fileName"]`);
  });

  it("decodes object schemas with a fileName property", () => {
    const input = { fileName: "archive.tar.gz" };

    expect(decodeUnknownFileNamePayloadSync(input)).toEqual(input);
  });

  it("derives only-valid names from the schema arbitrary and round-trips them", () => {
    const arbitrary = Arbitrary.schema(FileName);
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([name]) => {
            expect(isFileName2(name)).toBe(true);
            expect(decodeUnknownFileNameSync(name)).toBe(name);

            return true;
          },
          fcRuns(50)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });
});
