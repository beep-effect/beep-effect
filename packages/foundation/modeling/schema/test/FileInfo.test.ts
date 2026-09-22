import { fcRuns } from "@beep/fc-runs";
import { FileInfo, FileInfoType } from "@beep/schema/FileInfo";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as ByteSize from "effect/ByteSize";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import type { FileSystem } from "effect";

const decodeFileInfoEffect = S.decodeEffect(FileInfo);
const decodeUnknownFileInfoEffect = S.decodeUnknownEffect(FileInfo);
const decodeUnknownFileInfoTypeEffect = S.decodeUnknownEffect(FileInfoType);
const encodeFileInfoEffect = S.encodeEffect(FileInfo);
const isFileInfo2 = S.is(FileInfo);

describe("FileInfoType", () => {
  it.effect(
    "accepts supported file-system entry kinds",
    Effect.fnUntraced(function* () {
      for (const kind of FileInfoType.Options) {
        expect(yield* decodeUnknownFileInfoTypeEffect(kind)).toBe(kind);
      }
    })
  );

  it.effect(
    "rejects unsupported entry kinds",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownFileInfoTypeEffect("Device"));
      expect(Result.isFailure(failure1)).toBe(true);
    })
  );
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

  it.effect(
    "decodes another supported case and applies the same defaults",
    Effect.fnUntraced(function* () {
      const info = yield* decodeFileInfoEffect({
        type: "Directory",
        dev: 2,
        mode: 0o755,
        size: ByteSize.bytes(0n),
      });

      expect(info.type).toBe("Directory");
      expect(O.isNone(info.birthtime)).toBe(true);
      expect(O.isNone(info.blocks)).toBe(true);
    })
  );

  it.effect(
    "decodes provided optional stat fields to Some",
    Effect.fnUntraced(function* () {
      const mtime = DateTime.toDateUtc(DateTime.makeUnsafe(1_700_000_000_000));
      const info = yield* decodeFileInfoEffect({
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
    })
  );

  it.effect(
    "round-trips through encode and decode",
    Effect.fnUntraced(function* () {
      const info = FileInfo.cases.SymbolicLink.make({ dev: 3, mode: 0o777, size: ByteSize.bytes(8n) });
      const encoded = yield* encodeFileInfoEffect(info);
      const decoded = yield* decodeFileInfoEffect(encoded);

      expect(decoded).toEqual(info);
    })
  );

  it.effect(
    "rejects unsupported types",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.result(
        decodeUnknownFileInfoEffect({
          type: "Device",
          dev: 1,
          mode: 0o600,
          size: ByteSize.bytes(0n),
        })
      );
      expect(Result.isFailure(failure2)).toBe(true);
    })
  );

  {
    const arbitrary = Arbitrary.schema(FileInfo);
    it.effect.prop(
      "round-trips schema-derived arbitrary values",
      [arbitrary],
      Effect.fnUntraced(function* ([info]) {
        expect(isFileInfo2(info)).toBe(true);
        expect(yield* decodeFileInfoEffect(yield* encodeFileInfoEffect(info))).toEqual(info);

        return true;
      }),
      { arbitrary: fcRuns(50) }
    );
  }
});
