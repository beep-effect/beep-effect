import { fcRuns } from "@beep/fc-runs";
import { FileInfo, FileInfoType } from "@beep/schema/FileInfo";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as ByteSize from "effect/ByteSize";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import type { FileSystem } from "effect";

const decodeFileInfoSync = S.decodeSync(FileInfo);
const decodeUnknownFileInfoSync = S.decodeUnknownSync(FileInfo);
const decodeUnknownFileInfoTypeSync = S.decodeUnknownSync(FileInfoType);
const encodeFileInfoSync = S.encodeSync(FileInfo);
const isFileInfo2 = S.is(FileInfo);

describe("FileInfoType", () => {
  it("accepts supported file-system entry kinds", () => {
    for (const kind of FileInfoType.Options) {
      expect(decodeUnknownFileInfoTypeSync(kind)).toBe(kind);
    }
  });

  it("rejects unsupported entry kinds", () => {
    expect(() => decodeUnknownFileInfoTypeSync("Device")).toThrow();
  });
});

describe("FileInfo", () => {
  it("constructs typed cases compatible with File.Info and defaults optional stat fields to None", () => {
    const info: FileSystem.File.Info = FileInfo.cases.File.make({
      dev: 1,
      mode: 0o644,
      size: ByteSize.bytes(12n),
    });

    expect(info.type).toBe("File");
    expect(info.size).toBe(12n);
    expect(O.isNone(info.mtime)).toBe(true);
    expect(O.isNone(info.ino)).toBe(true);
    expect(O.isNone(info.blksize)).toBe(true);
  });

  it("constructs every entry kind with a matching type", () => {
    for (const kind of FileInfoType.Options) {
      const info = FileInfo.cases[kind].make({ dev: 1, mode: 0o600, size: ByteSize.bytes(0n) });
      expect(info.type).toBe(kind);
    }
  });

  it("decodes another supported case and applies the same defaults", () => {
    const info = decodeFileInfoSync({
      type: "Directory",
      dev: 2,
      mode: 0o755,
      size: ByteSize.bytes(0n),
    });

    expect(info.type).toBe("Directory");
    expect(O.isNone(info.birthtime)).toBe(true);
    expect(O.isNone(info.blocks)).toBe(true);
  });

  it("decodes provided optional stat fields to Some", () => {
    const mtime = DateTime.toDateUtc(DateTime.makeUnsafe(1_700_000_000_000));
    const info = decodeFileInfoSync({
      type: "File",
      dev: 1,
      mode: 0o644,
      size: ByteSize.bytes(42n),
      mtime,
      ino: 7,
    });

    expect(O.isSome(info.mtime)).toBe(true);
    expect(info.mtime).toEqual(O.some(mtime));
    expect(info.ino).toEqual(O.some(7));
  });

  it("round-trips through encode and decode", () => {
    const info = FileInfo.cases.SymbolicLink.make({ dev: 3, mode: 0o777, size: ByteSize.bytes(8n) });
    const encoded = encodeFileInfoSync(info);
    const decoded = decodeFileInfoSync(encoded);

    expect(decoded).toEqual(info);
  });

  it("rejects unsupported types", () => {
    expect(() =>
      decodeUnknownFileInfoSync({
        type: "Device",
        dev: 1,
        mode: 0o600,
        size: ByteSize.bytes(0n),
      })
    ).toThrow();
  });

  it("round-trips schema-derived arbitrary values", () => {
    const arbitrary = Arbitrary.schema(FileInfo);
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([info]) => {
            expect(isFileInfo2(info)).toBe(true);
            expect(decodeFileInfoSync(encodeFileInfoSync(info))).toEqual(info);

            return true;
          },
          fcRuns(50)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });
});
