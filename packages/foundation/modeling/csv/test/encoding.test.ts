// Bytes to text: a byte-order mark names the encoding, else valid UTF-8 is UTF-8, else Windows-1252; a fixed UTF-8
// refuses invalid bytes with their offset; the byte cap holds for whole reads and streams; a U+FEFF inside the data
// survives a stream split right before it; a failing upstream fails a channel with its own error, nothing flushed
// before it; and the two places a stream may differ from a whole read are pinned.

import { Csv } from "@beep/csv/Csv.codec";
import { InvalidUtf8, TooManyBytes } from "@beep/csv/CsvDiagnostic.schema";
import { CsvDetectEncoding, CsvFixedEncoding, CsvLimits, CsvReadOptions } from "@beep/csv/CsvOptions.schema";
import {
  CsvEncodingFallback,
  CsvEncodingFromBom,
  CsvEncodingGiven,
  CsvEncodingValidUtf8,
  CsvFromBytes,
  CsvSource,
} from "@beep/csv/CsvRead.schema";
import { describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  emittedFromBytes,
  fatalFindings,
  outcomeOfRead,
  pieces,
  readWith,
  readWithRules,
  streamBytes,
  thenFail,
  untilFailure,
  utf8,
} from "./support.ts";
import type { CsvRead } from "@beep/csv/CsvRead.schema";
import type { CsvRecord, CsvRecordSlice } from "@beep/csv/CsvTable.schema";

const sourceOf = (read: Result.Result<CsvRead, unknown>) => Result.map(read, (done) => done.source);
const encodingOf = (read: Result.Result<CsvRead, unknown>) =>
  Result.map(read, (done) =>
    CsvSource.match(done.source, { text: O.none, bytes: (source) => O.some(source.encoding) })
  );
const bytesOf = (...parts: ReadonlyArray<ReadonlyArray<number> | string>): Uint8Array =>
  Uint8Array.from(A.flatMap(parts, (part) => (P.isString(part) ? [...utf8(part)] : part)));
const fixed = (encoding: CsvFixedEncoding["encoding"]) =>
  CsvReadOptions.make({ encoding: CsvFixedEncoding.make({ encoding }) });
const fixedUtf8Comma = readWithRules(",", { encoding: CsvFixedEncoding.make({ encoding: "utf-8" }) });
const detectWindow = (size: bigint) =>
  readWithRules(",", { encoding: CsvDetectEncoding.make({ window: ByteSize.bytes(size) }) });

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
    assertFailure(read.pipe(outcomeOfRead, fatalFindings), [InvalidUtf8.make({ byteOffset: 3 })]);
    assertSuccess(
      encodingOf(Csv.parseBytesResult(bytesOf("Caf", [0xe9], "\n"), fixed("windows-1252"))),
      CsvEncodingGiven.makeOption({ encoding: "windows-1252", bom: false })
    );
  });
});

describe("Windows-1252", () => {
  // Node 22's whole-buffer Windows-1252 decoder drops a leading 0xFF when it is asked to keep byte-order marks; a
  // single-byte encoding has no byte-order mark, so the decoder must not be asked.
  it.effect("a leading 0xFF reads as ÿ, whole or streamed, fixed or detected, in one chunk or split", () =>
    Effect.gen(function* () {
      const bytes = bytesOf([0xff], "a,b\n");
      const expected: ReadonlyArray<CsvRecord> = [["ÿa", "b"]];
      for (const options of [fixed("windows-1252"), CsvReadOptions.default, detectWindow(1n)]) {
        assertSuccess(outcomeOfRead(Csv.parseBytesResult(bytes, options)), expected);
        const oneChunk = yield* streamBytes([bytes], options);
        assertSuccess(oneChunk, expected);
        const split = yield* streamBytes([bytes.subarray(0, 1), bytes.subarray(1)], options);
        assertSuccess(split, expected);
      }
      assertSuccess(outcomeOfRead(Csv.parseBytesResult(bytesOf([0xff]), fixed("windows-1252"))), [["ÿ"]]);
    })
  );
});

describe("the detect window", () => {
  it.effect("decides on the same leading bytes however the input is cut", () =>
    Effect.gen(function* () {
      // The window is one byte; the invalid byte is past it and past the three bytes that may finish a sequence.
      const bytes = bytesOf("aaaaa", [0xe9], "\n");
      const oneChunk = yield* streamBytes([bytes], detectWindow(1n));
      assertFailure(fatalFindings(oneChunk), [InvalidUtf8.make({ byteOffset: 5 })]);
      for (const at of [1, 4, 5, 6]) {
        const split = yield* streamBytes([bytes.subarray(0, at), bytes.subarray(at)], detectWindow(1n));
        deepStrictEqual(split, oneChunk);
      }
    })
  );

  it.effect("a byte that breaks UTF-8 inside the window falls back to Windows-1252 however the input is cut", () =>
    Effect.gen(function* () {
      const bytes = bytesOf("Caf", [0xe9], ",1\nabc\n");
      const expected: ReadonlyArray<CsvRecord> = [["Café", "1"], ["abc"]];
      const oneChunk = yield* streamBytes([bytes], detectWindow(4n));
      assertSuccess(oneChunk, expected);
      const split = yield* streamBytes([bytes.subarray(0, 8), bytes.subarray(8)], detectWindow(4n));
      assertSuccess(split, expected);
    })
  );

  it.effect("a sequence that starts inside the window is checked whole", () =>
    Effect.gen(function* () {
      const valid = yield* streamBytes([bytesOf("a", [0xc3, 0xa9], "bcdefg\n")], detectWindow(2n));
      assertSuccess(valid, [["aébcdefg"]]);
      const broken = yield* streamBytes([bytesOf("a", [0xc3, 0x28], "bcdefg\n")], detectWindow(2n));
      assertSuccess(broken, [["aÃ(bcdefg"]]);
    })
  );
});

describe("the byte cap", () => {
  const capped = CsvReadOptions.make({ limits: CsvLimits.make({ maxInputBytes: ByteSize.bytes(10n) }) });
  const bytes = utf8(Str.repeat(100)("a,b\n"));

  it("a whole read past the cap fails with the input's size", () => {
    assertFailure(Csv.parseBytesResult(bytes, capped).pipe(outcomeOfRead, fatalFindings), [
      TooManyBytes.make({ maximum: ByteSize.bytes(10n), actual: ByteSize.bytes(400n) }),
    ]);
  });

  it.effect("a stream past the cap fails at the first chunk that passes it, with the count so far", () =>
    Effect.gen(function* () {
      const chunks = pieces(bytes.length, A.replicate(4, 100), (from, to) => bytes.subarray(from, to));
      const streamed = yield* streamBytes(chunks, capped);
      assertFailure(fatalFindings(streamed), [
        TooManyBytes.make({ maximum: ByteSize.bytes(10n), actual: ByteSize.bytes(12n) }),
      ]);
    })
  );

  it.effect("the chunk that passes the cap is read up to the cap first, its findings included", () =>
    Effect.gen(function* () {
      const cappedAt = (rules: Partial<CsvLimits>) =>
        readWithRules(",", {
          encoding: CsvFixedEncoding.make({ encoding: "utf-8" }),
          limits: CsvLimits.make({ maxInputBytes: ByteSize.bytes(4n), ...rules }),
        });
      const tooMany = TooManyBytes.make({ maximum: ByteSize.bytes(4n), actual: ByteSize.bytes(7n) });
      const emitted = yield* emittedFromBytes([utf8("a\nb\nxyz")], cappedAt({}));
      deepStrictEqual(emitted, [
        Result.succeed<CsvRecord>(["a"]),
        Result.succeed<CsvRecord>(["b"]),
        Result.fail([tooMany]),
      ]);
      const recordsFirst = yield* emittedFromBytes([utf8("a\nb\nxyz")], cappedAt({ maxRecords: 1 }));
      const kinds = A.map(recordsFirst, Result.mapError(A.map((finding) => finding.kind)));
      deepStrictEqual(kinds, [Result.succeed<CsvRecord>(["a"]), Result.fail(A.of("LimitExceeded" as const))]);
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
      // A fixed UTF-8 decodes each byte as it comes, so every sequence is carried across decoder calls; a detected
      // encoding would hold this short input in its window and decode it whole.
      const streamed = yield* streamBytes(chunks, fixedUtf8Comma);
      assertSuccess(streamed, [["é", "😀"]]);
    })
  );

  it.effect("an unfinished UTF-8 sequence at the end fails the stream at its offset", () =>
    Effect.gen(function* () {
      const streamed = yield* streamBytes([bytesOf("a", [0xe2, 0x82])], fixed("utf-8"));
      assertFailure(fatalFindings(streamed), [InvalidUtf8.make({ byteOffset: 1 })]);
    })
  );

  it.effect("a byte past the detect window that breaks UTF-8 fails the stream, where the whole read falls back", () =>
    Effect.gen(function* () {
      const bytes = bytesOf(Str.repeat(71_681)("a"), [0xe9], "\n");
      const chunks = pieces(bytes.length, A.replicate(4096, 18), (from, to) => bytes.subarray(from, to));
      const streamed = yield* streamBytes(chunks, CsvReadOptions.default);
      assertFailure(fatalFindings(streamed), [InvalidUtf8.make({ byteOffset: 71_681 })]);
      assertSuccess(
        encodingOf(Csv.parseBytesResult(bytes)),
        CsvEncodingFallback.makeOption({ firstInvalidByte: 71_681 })
      );
    })
  );
});

describe("a short file that ends in a Windows-1252 byte", () => {
  it.effect("reads as Windows-1252 in a stream, as the whole read does, in one chunk or split", () =>
    Effect.gen(function* () {
      const bytes = bytesOf("Name,City\nAnn,Caf", [0xe9]);
      const expected: ReadonlyArray<CsvRecord> = [
        ["Name", "City"],
        ["Ann", "Café"],
      ];
      assertSuccess(outcomeOfRead(Csv.parseBytesResult(bytes)), expected);
      const oneChunk = yield* streamBytes([bytes], CsvReadOptions.default);
      assertSuccess(oneChunk, expected);
      const split = yield* streamBytes([bytes.subarray(0, 17), bytes.subarray(17)], CsvReadOptions.default);
      assertSuccess(split, expected);
    })
  );
});

describe("input that ends at the detect window's edge", () => {
  const windowOf = (size: bigint) =>
    CsvReadOptions.make({ encoding: CsvDetectEncoding.make({ window: ByteSize.bytes(size) }) });

  it.effect("a four-byte window over 'Caf' and a Windows-1252 byte reads as the whole read does", () =>
    Effect.gen(function* () {
      const bytes = bytesOf("Caf", [0xe9]);
      const streamed = yield* streamBytes([bytes], windowOf(4n));
      assertSuccess(streamed, [["Café"]]);
      deepStrictEqual(streamed, outcomeOfRead(Csv.parseBytesResult(bytes, windowOf(4n))));
    })
  );

  it.effect("the default window, one byte under, exactly and one byte over, reads as the whole read does", () =>
    Effect.gen(function* () {
      for (const length of [65_534, 65_535, 65_536]) {
        const bytes = bytesOf(Str.repeat(length)("a"), [0xe9]);
        const streamed = yield* streamBytes([bytes], CsvReadOptions.default);
        deepStrictEqual(streamed, outcomeOfRead(Csv.parseBytesResult(bytes)));
        assertSuccess(
          Result.map(streamed, (records) => Str.slice(-1)(records[0]?.[0] ?? "")),
          "é"
        );
      }
    })
  );
});

describe("a failing upstream", () => {
  const cellsOf = Result.map((slice: CsvRecordSlice) => slice.cells);

  it.effect("fails the text channel with the caller's error, after the records it finished and no others", () =>
    Effect.gen(function* () {
      const emitted = yield* untilFailure(
        thenFail(["1,2\n3"], "io").pipe(Stream.pipeThroughChannel(Csv.decodeString<string>(readWith(","))))
      );
      deepStrictEqual(A.map(emitted, cellsOf), [Result.succeed<CsvRecord>(["1", "2"]), Result.fail("io")]);
    })
  );

  it.effect("fails the text channel with the caller's error while a quote is open, not with UnterminatedQuote", () =>
    Effect.gen(function* () {
      const emitted = yield* untilFailure(
        thenFail(['a,"b'], "io").pipe(Stream.pipeThroughChannel(Csv.decodeString<string>(readWith(","))))
      );
      deepStrictEqual(emitted, [Result.fail("io")]);
    })
  );

  it.effect("fails the bytes channel with the caller's error, under a fixed and a detected encoding", () =>
    Effect.gen(function* () {
      const decodeWith = (options: CsvReadOptions) =>
        untilFailure(thenFail([utf8("1,2\n3")], "io").pipe(Stream.pipeThroughChannel(Csv.decode<string>(options))));
      const fixedUtf8 = yield* decodeWith(
        readWithRules(",", { encoding: CsvFixedEncoding.make({ encoding: "utf-8" }) })
      );
      deepStrictEqual(A.map(fixedUtf8, cellsOf), [Result.succeed<CsvRecord>(["1", "2"]), Result.fail("io")]);
      // The detect window is still open when the upstream fails, so nothing was decoded.
      const detected = yield* decodeWith(readWith(","));
      deepStrictEqual(detected, [Result.fail("io")]);
    })
  );

  it.effect("a byte cap passed while a quote is open fails with TooManyBytes, not UnterminatedQuote", () =>
    Effect.gen(function* () {
      const options = CsvReadOptions.make({
        encoding: CsvFixedEncoding.make({ encoding: "utf-8" }),
        limits: CsvLimits.make({ maxInputBytes: ByteSize.bytes(10n) }),
      });
      const streamed = yield* streamBytes([utf8('"aaaa'), utf8("aaaaaaaaaa")], options);
      assertFailure(fatalFindings(streamed), [
        TooManyBytes.make({ maximum: ByteSize.bytes(10n), actual: ByteSize.bytes(15n) }),
      ]);
    })
  );

  it.effect("bytes UTF-8 refuses fail the bytes channel after the records before them in the same chunk", () =>
    Effect.gen(function* () {
      const emitted = yield* emittedFromBytes([bytesOf("a\n", [0xff], "\n")], fixedUtf8Comma);
      deepStrictEqual(emitted, [Result.succeed<CsvRecord>(["a"]), Result.fail([InvalidUtf8.make({ byteOffset: 2 })])]);
      // The open record is not flushed ahead of the failure.
      const open = yield* emittedFromBytes([bytesOf("a\nb", [0xff], "\n")], fixedUtf8Comma);
      deepStrictEqual(open, [Result.succeed<CsvRecord>(["a"]), Result.fail([InvalidUtf8.make({ byteOffset: 3 })])]);
    })
  );

  it.effect("bytes UTF-8 refuses, split after an open quote, fail with InvalidUtf8 at their offset", () =>
    Effect.gen(function* () {
      const streamed = yield* streamBytes([bytesOf(',"'), bytesOf([0xa9])], fixed("utf-8"));
      assertFailure(fatalFindings(streamed), [InvalidUtf8.make({ byteOffset: 2 })]);
    })
  );
});

describe("the order of fatal findings", () => {
  it.effect("a stream fails on the first finding in input order; a whole read checks the encoding first", () =>
    Effect.gen(function* () {
      const options = readWithRules(",", {
        encoding: CsvFixedEncoding.make({ encoding: "utf-8" }),
        limits: CsvLimits.make({ maxRecords: 2 }),
      });
      const text = utf8("a\nb\nc\n");
      assertFailure(Csv.parseBytesResult(bytesOf("a\nb\nc\n", [0xff]), options).pipe(outcomeOfRead, fatalFindings), [
        InvalidUtf8.make({ byteOffset: 6 }),
      ]);
      for (const chunks of [[text, bytesOf([0xff])], [bytesOf("a\nb\nc\n", [0xff])]]) {
        const streamed = yield* streamBytes(chunks, options);
        assertTrue(
          Result.isFailure(streamed) && A.every(streamed.failure, (fatal) => fatal.finding.kind === "LimitExceeded"),
          "the stream fails with the records cap, split or in one chunk"
        );
      }
    })
  );
});
