import { fcRuns } from "@beep/fc-runs";
import { FileInfo, FileInfoType } from "@beep/schema/FileInfo";
import { describe, expect, it } from "@effect/vitest";
import { FileSystem } from "effect";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("FileInfoType", () => {
  const decode = S.decodeUnknownSync(FileInfoType);

  it("accepts supported file-system entry kinds", () => {
    for (const kind of FileInfoType.Options) {
      expect(decode(kind)).toBe(kind);
    }
  });

  it("rejects unsupported entry kinds", () => {
    expect(() => decode("Device")).toThrow();
  });
});

describe("FileInfo", () => {
  it("constructs typed cases compatible with File.Info and defaults optional stat fields to None", () => {
    const info: FileSystem.File.Info = FileInfo.cases.File.make({
      dev: 1,
      mode: 0o644,
      size: FileSystem.Size(12n),
    });

    expect(info.type).toBe("File");
    expect(info.size).toBe(12n);
    expect(O.isNone(info.mtime)).toBe(true);
    expect(O.isNone(info.ino)).toBe(true);
    expect(O.isNone(info.blksize)).toBe(true);
  });

  it("constructs every entry kind with a matching type", () => {
    for (const kind of FileInfoType.Options) {
      const info = FileInfo.cases[kind].make({ dev: 1, mode: 0o600, size: FileSystem.Size(0n) });
      expect(info.type).toBe(kind);
    }
  });

  it("decodes another supported case and applies the same defaults", () => {
    const info = S.decodeUnknownSync(FileInfo)({
      type: "Directory",
      dev: 2,
      mode: 0o755,
      size: 0n,
    });

    expect(info.type).toBe("Directory");
    expect(O.isNone(info.birthtime)).toBe(true);
    expect(O.isNone(info.blocks)).toBe(true);
  });

  it("decodes provided optional stat fields to Some", () => {
    const mtime = DateTime.toDateUtc(DateTime.makeUnsafe(1_700_000_000_000));
    const info = S.decodeUnknownSync(FileInfo)({
      type: "File",
      dev: 1,
      mode: 0o644,
      size: 42n,
      mtime,
      ino: 7,
    });

    expect(O.isSome(info.mtime)).toBe(true);
    expect(info.mtime).toEqual(O.some(mtime));
    expect(info.ino).toEqual(O.some(7));
  });

  it("round-trips through encode and decode", () => {
    const info = FileInfo.cases.SymbolicLink.make({ dev: 3, mode: 0o777, size: FileSystem.Size(8n) });
    const encoded = S.encodeSync(FileInfo)(info);
    const decoded = S.decodeUnknownSync(FileInfo)(encoded);

    expect(decoded).toEqual(info);
  });

  it("rejects unsupported types", () => {
    expect(() =>
      S.decodeUnknownSync(FileInfo)({
        type: "Device",
        dev: 1,
        mode: 0o600,
        size: 0n,
      })
    ).toThrow();
  });

  it("round-trips schema-derived arbitrary values", () => {
    const arbitrary = S.toArbitrary(FileInfo)(fc);
    const isFileInfo = S.is(FileInfo);

    fc.assert(
      fc.property(arbitrary, (info) => {
        expect(isFileInfo(info)).toBe(true);
        expect(S.decodeUnknownSync(FileInfo)(S.encodeSync(FileInfo)(info))).toEqual(info);
      }),
      fcRuns(50)
    );
  });
});
