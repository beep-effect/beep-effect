// Bytes to text: a byte-order mark names the encoding, else valid UTF-8 is UTF-8, else Windows-1252; a fixed UTF-8
// refuses invalid bytes with their offset; the byte cap holds for whole reads and streams; a U+FEFF inside the data
// survives a stream split right before it; and the one place a stream may differ from a whole read is pinned.

import { Csv } from "@beep/csv/Csv.codec";
import { InvalidUtf8, TooManyBytes } from "@beep/csv/CsvDiagnostic.schema";
import { CsvFixedEncoding, CsvLimits, CsvReadOptions } from "@beep/csv/CsvOptions.schema";
import {
  CsvEncodingFallback,
  CsvEncodingFromBom,
  CsvEncodingGiven,
  CsvEncodingValidUtf8,
  CsvFromBytes,
  CsvSource,
} from "@beep/csv/CsvRead.schema";
import { describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { outcomeOfRead, pieces, readWith, streamBytes, utf8 } from "./support.ts";
import type { CsvRead } from "@beep/csv/CsvRead.schema";

const sourceOf = (read: Result.Result<CsvRead, unknown>) => Result.map(read, (done) => done.source);
const encodingOf = (read: Result.Result<CsvRead, unknown>) =>
  Result.map(read, (done) =>
    CsvSource.match(done.source, { text: O.none, bytes: (source) => O.some(source.encoding) })
  );
const bytesOf = (...parts: ReadonlyArray<ReadonlyArray<number> | string>): Uint8Array =>
  Uint8Array.from(A.flatMap(parts, (part) => (P.isString(part) ? [...utf8(part)] : part)));
const fixed = (encoding: CsvFixedEncoding["encoding"]) =>
  CsvReadOptions.make({ encoding: CsvFixedEncoding.make({ encoding }) });

describe("encoding detection", () => {
  it("a UTF-8 BOM names UTF-8 and is not part of the text", () => {
    const bytes = bytesOf([0xef, 0xbb, 0xbf], "a,b\n");
    assertSuccess(
      sourceOf(Csv.parseBytesResult(bytes)),
      CsvFromBytes.make({
        encoding: CsvEncodingFromBom.make({ encoding: "utf-8" }),
        bytes: ByteSize.bytes(7n),
      })
    );
    assertSuccess(outcomeOfRead(Csv.parseBytesResult(bytes)), [["a", "b"]]);
  });

  it("UTF-16 BOMs name UTF-16, either byte order", () => {
    const le = bytesOf([0xff, 0xfe, 0x61, 0x00, 0x2c, 0x00, 0x62, 0x00, 0x0a, 0x00]);
    const be = bytesOf([0xfe, 0xff, 0x00, 0x61, 0x00, 0x2c, 0x00, 0x62, 0x00, 0x0a]);
    assertSuccess(outcomeOfRead(Csv.parseBytesResult(le)), [["a", "b"]]);
    assertSuccess(outcomeOfRead(Csv.parseBytesResult(be)), [["a", "b"]]);
    assertSuccess(encodingOf(Csv.parseBytesResult(be)), CsvEncodingFromBom.makeOption({ encoding: "utf-16be" }));
  });

  it("valid UTF-8 without a mark is UTF-8", () => {
    assertSuccess(encodingOf(Csv.parseBytesResult(utf8("Größe\n"))), CsvEncodingValidUtf8.makeOption({}));
  });

  it("bytes that are not UTF-8 fall back to Windows-1252, naming the first invalid byte", () => {
    const read = Csv.parseBytesResult(bytesOf("Caf", [0xe9], ",1\n"));
    assertSuccess(outcomeOfRead(read), [["Café", "1"]]);
    assertSuccess(encodingOf(read), CsvEncodingFallback.makeOption({ firstInvalidByte: 3 }));
  });

  it("a fixed UTF-8 refuses invalid bytes with their offset, and a fixed encoding is recorded as given", () => {
    const read = Csv.parseBytesResult(bytesOf("Caf", [0xe9], "\n"), fixed("utf-8"));
    assertFailure(
      Result.mapError(outcomeOfRead(read), (fatals) => A.map(fatals, (f) => f.finding)),
      [InvalidUtf8.make({ byteOffset: 3 })]
    );
    assertSuccess(
      encodingOf(Csv.parseBytesResult(bytesOf("Caf", [0xe9], "\n"), fixed("windows-1252"))),
      CsvEncodingGiven.makeOption({ encoding: "windows-1252", bom: false })
    );
  });
});

describe("the byte cap", () => {
  const capped = CsvReadOptions.make({ limits: CsvLimits.make({ maxInputBytes: ByteSize.bytes(10n) }) });
  const bytes = utf8(Str.repeat(100)("a,b\n"));

  it("a whole read past the cap fails with the input's size", () => {
    assertFailure(
      Result.mapError(outcomeOfRead(Csv.parseBytesResult(bytes, capped)), (fatals) => A.map(fatals, (f) => f.finding)),
      [TooManyBytes.make({ maximum: ByteSize.bytes(10n), actual: ByteSize.bytes(400n) })]
    );
  });

  it.effect("a stream past the cap fails at the first chunk that passes it, with the count so far", () =>
    Effect.gen(function* () {
      const chunks = pieces(bytes.length, A.replicate(4, 100), (from, to) => bytes.subarray(from, to));
      const streamed = yield* streamBytes(chunks, capped);
      assertFailure(
        Result.mapError(streamed, (fatals) => A.map(fatals, (f) => f.finding)),
        [TooManyBytes.make({ maximum: ByteSize.bytes(10n), actual: ByteSize.bytes(12n) })]
      );
    })
  );

  it.effect("a stream within the cap reads every record", () =>
    Effect.gen(function* () {
      const within = CsvReadOptions.make({ limits: CsvLimits.make({ maxInputBytes: ByteSize.bytes(400n) }) });
      const chunks = pieces(bytes.length, A.replicate(4, 100), (from, to) => bytes.subarray(from, to));
      const streamed = yield* streamBytes(chunks, within);
      assertSuccess(Result.map(streamed, A.length), 100);
    })
  );
});

describe("streaming bytes", () => {
  it.effect("a U+FEFF that starts a decoded chunk is cell data, not dropped", () =>
    Effect.gen(function* () {
      const bytes = utf8("a,\uFEFFb\n");
      const streamed = yield* streamBytes([bytes.subarray(0, 2), bytes.subarray(2)], readWith(","));
      assertSuccess(streamed, [["a", "\uFEFFb"]]);
      assertSuccess(outcomeOfRead(Csv.parseBytesResult(bytes, readWith(","))), [["a", "\uFEFFb"]]);
    })
  );

  it.effect("a multi-byte character split across every byte reads as one character", () =>
    Effect.gen(function* () {
      const bytes = utf8("é,😀\n");
      const chunks = pieces(bytes.length, A.replicate(1, bytes.length), (from, to) => bytes.subarray(from, to));
      const streamed = yield* streamBytes(chunks, readWith(","));
      assertSuccess(streamed, [["é", "😀"]]);
    })
  );

  it.effect("an unfinished UTF-8 sequence at the end fails the stream at its offset", () =>
    Effect.gen(function* () {
      const streamed = yield* streamBytes([bytesOf("a", [0xe2, 0x82])], fixed("utf-8"));
      assertFailure(
        Result.mapError(streamed, (fatals) => A.map(fatals, (f) => f.finding)),
        [InvalidUtf8.make({ byteOffset: 1 })]
      );
    })
  );

  it.effect("a byte past the detect window that breaks UTF-8 fails the stream, where the whole read falls back", () =>
    Effect.gen(function* () {
      const bytes = bytesOf(Str.repeat(71_681)("a"), [0xe9], "\n");
      const chunks = pieces(bytes.length, A.replicate(4096, 18), (from, to) => bytes.subarray(from, to));
      const streamed = yield* streamBytes(chunks, CsvReadOptions.default);
      assertFailure(
        Result.mapError(streamed, (fatals) => A.map(fatals, (f) => f.finding)),
        [InvalidUtf8.make({ byteOffset: 71_681 })]
      );
      assertSuccess(
        encodingOf(Csv.parseBytesResult(bytes)),
        CsvEncodingFallback.makeOption({ firstInvalidByte: 71_681 })
      );
    })
  );
});
