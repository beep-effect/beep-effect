import { InvalidUtf8 } from "@beep/scratchpad/effected/jsonl/JsonlError";
import { ByteCount, LineSlice } from "@beep/scratchpad/effected/jsonl/LineSlice";
import { TailWindow } from "@beep/scratchpad/effected/jsonl/internal/tail";
import { CursoredSlice, Slice, matchesFrame } from "@beep/scratchpad/effected/jsonl/Slice";
import { probeBomBytes, readRangeWindow, readTail } from "@beep/scratchpad/effected/jsonl/internal/tail";
import { utf8Length } from "@beep/scratchpad/effected/jsonl/internal/utf8";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { assertFailure, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { line, memory, open, path } from "./fixtures.ts";
import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const Utf16Text = S.String;
describe("JSONL helper boundaries", () => {
  it.prop("matches TextEncoder for arbitrary UTF-16 strings", [Utf16Text], ([text]) => {
    assert.strictEqual(utf8Length(text), new TextEncoder().encode(text).length);
  });
  it.each(["\ud800", "\udc00", "\ud800a", "\ud800\ud800", "\ud800\udfff", "é", "€"])(
    "counts isolated and paired code units %s",
    (text) => {
      assert.strictEqual(utf8Length(text), new TextEncoder().encode(text).length);
    }
  );
  it("rejects a scope filter when the frame has no scope", () => {
    assert.isFalse(matchesFrame({ at: DateTime.makeUnsafe(0), event: "mail", data: null }, { scopes: ["box"] }));
  });
  it.effect("returns an empty partial tail window when no newline exists", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFileString("/journal", "unfinished");
      const tail = yield* readTail(fs, "/journal", 3, 0);
      assert.strictEqual(tail.text, "");
      assert.strictEqual(tail.start, 10);
      assert.isFalse(tail.atFileStart);
    })
  );
  it.effect("stops a range at EOF even when the requested length exceeds the file", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFileString("/journal", "é😀\n");
      assert.strictEqual((yield* readRangeWindow(fs, "/journal", 0, 100, 0)).text, "é😀\n");
      assert.strictEqual((yield* readRangeWindow(fs, "/journal", 7, 100, 0)).text, "");
    })
  );
});

describe("selection schemas", () => {
  it("retains a tag domain and validates byte cursors", () => {
    const tags = S.Literal("mail");
    const selection = Slice(tags);
    const resumed = CursoredSlice(tags);
    assert.isTrue(S.is(selection)({ events: ["mail"], scopes: ["box"] }));
    assert.isFalse(S.is(selection)({ events: ["foreign"] }));
    assert.isTrue(S.is(resumed)({ cursor: 0 }));
    assert.isFalse(S.is(resumed)({ cursor: -1 }));
    assert.isFalse(S.is(resumed)({ cursor: 1.5 }));
  });
});

// Decorate the real shared storage with a legal short-read file handle.
const shortReads = (fs: FileSystem.FileSystem, limit: number): FileSystem.FileSystem => ({
  ...fs,
  open: (path, options) =>
    fs.open(path, options).pipe(
      Effect.map(
        (file): FileSystem.File => ({
          [FileSystem.FileTypeId]: FileSystem.FileTypeId,
          stat: file.stat,
          sync: file.sync,
          seek: (offset, from) => file.seek(offset, from),
          read: (buffer) => file.read(buffer),
          truncate: (length) => file.truncate(length),
          write: (buffer) => file.write(buffer),
          writeAll: (buffer) => file.writeAll(buffer),
          readAlloc: (size) => file.readAlloc(Math.min(size, limit)),
        })
      )
    ),
});

describe("bounded short reads", () => {
  it.effect("aggregates split BOM and Unicode before tail decoding", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      const text = "α😀\nβé\n";
      yield* fs.writeFileString("/journal", "\ufeff" + text);
      const short = shortReads(fs, 1);
      assert.strictEqual(yield* probeBomBytes(short, "/journal"), 3);
      const tail = yield* readTail(short, "/journal", 100, 3);
      assert.strictEqual(tail.text, text);
      assert.strictEqual(tail.start, 0);
      assert.strictEqual(tail.size, new TextEncoder().encode(text).length);
      assert.strictEqual((yield* readRangeWindow(short, "/journal", 3, tail.size, 3)).text, text);
      const partial = yield* readTail(short, "/journal", 6, 3);
      assert.strictEqual(partial.text, "βé\n");
      assert.strictEqual(partial.start, 7);
    })
  );
  it.effect("stops a short range at genuine EOF", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFileString("/journal", "é");
      const short = shortReads(fs, 1);
      assert.strictEqual(
        (yield* readRangeWindow(short, "/journal", 0, 100, 0)).text,
        "",
        "an unterminated suffix is withheld"
      );
      assert.strictEqual(yield* probeBomBytes(short, "/journal"), 0);
      assert.strictEqual((yield* readTail(short, "/journal", 100, 0)).text, "é");
    })
  );
  it.effect("does not spin when a reader returns zero bytes", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFileString("/journal", "existing\n");
      let reads = 0;
      const stopped: FileSystem.FileSystem = {
        ...fs,
        open: (path, options) =>
          fs.open(path, options).pipe(
            Effect.map(
              (file): FileSystem.File => ({
                [FileSystem.FileTypeId]: FileSystem.FileTypeId,
                stat: file.stat,
                sync: file.sync,
                seek: (offset, from) => file.seek(offset, from),
                read: (buffer) => file.read(buffer),
                truncate: (length) => file.truncate(length),
                write: (buffer) => file.write(buffer),
                writeAll: (buffer) => file.writeAll(buffer),
                readAlloc: () =>
                  Effect.sync(() => {
                    reads++;
                    return O.some(new Uint8Array(0));
                  }),
              })
            )
          ),
      };
      assert.strictEqual(yield* probeBomBytes(stopped, "/journal"), 0);
      assert.strictEqual((yield* readTail(stopped, "/journal", 100, 0)).text, "");
      assert.strictEqual((yield* readRangeWindow(stopped, "/journal", 0, 100, 0)).text, "");
      assert.strictEqual(reads, 3);
    })
  );
  it.effect("preserves a non-leading U+FEFF at decoded window and range boundaries", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      const content = "first\n\ufeffsecond\n";
      yield* fs.writeFileString("/journal", content);
      const short = shortReads(fs, 1);
      assert.strictEqual(yield* probeBomBytes(short, "/journal"), 0);
      const tail = yield* readTail(short, "/journal", 11, 0);
      assert.strictEqual(tail.text, "\ufeffsecond\n");
      assert.strictEqual(tail.start, 6);
      assert.strictEqual((yield* readRangeWindow(short, "/journal", 6, 100, 0)).text, "\ufeffsecond\n");
    })
  );
});

it.effect("seeds and queries every envelope through one-byte file reads", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const first = line(1, "α😀");
    const second = line(2, "βé");
    yield* fs.writeFileString(path, "\ufeff" + first + second);
    const journal = yield* open({ ...shortReads(fs, 1), watch: () => Stream.never });
    assertSome((yield* SubscriptionRef.get(journal.latest)).pipe(O.map((row) => row.data)), { round: 2, label: "βé" });
    const rows = yield* Stream.runCollect(journal.query({ events: ["noted"] }));
    assert.deepStrictEqual(
      A.map(rows, (row) => row.data.round),
      [1, 2]
    );
    assert.strictEqual(O.getOrThrow(A.head(rows)).line.offset, 0);
    assert.strictEqual(O.getOrThrow(A.last(rows)).line.offset, new TextEncoder().encode(first).length);
  })
);

describe("strict byte decoding", () => {
  it.effect("reports malformed UTF-8 without inflating offsets", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFile("/journal", new Uint8Array([0x22, 0xff, 0x22, 0x0a]));
      const committed = yield* Effect.result(readRangeWindow(fs, "/journal", 0, 4, 0));
      const tail = yield* Effect.result(readTail(fs, "/journal", 100, 0));
      for (const result of [committed, tail]) {
        assertFailure(
          Result.mapError(result, (error) => error._tag),
          "InvalidUtf8"
        );
        const error = result.pipe(Result.getFailure, O.getOrThrow);
        if (!S.is(InvalidUtf8)(error)) return assert.fail("expected InvalidUtf8");
        assert.strictEqual(error.path, "/journal");
        assert.strictEqual(error.offset, 0);
      }
    })
  );
  it.effect("withholds even invalid bytes in an unterminated physical suffix", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFile("/journal", new Uint8Array([0x34, 0x32, 0x0a, 0xff]));
      const window = yield* readRangeWindow(fs, "/journal", 0, 4, 0);
      assert.strictEqual(window.text, "42\n");
      assert.strictEqual(window.start, 0);
      assert.strictEqual(window.size, 4);
      assert.strictEqual((yield* readTail(fs, "/journal", 100, 0, true)).text, "42\n");
      yield* fs.writeFile("/journal", new Uint8Array([0x34, 0x32, 0x0a, 0xff, 0x0a]));
      assertFailure(
        (yield* Effect.result(readRangeWindow(fs, "/journal", 0, 5, 0))).pipe(Result.mapError((error) => error._tag)),
        "InvalidUtf8"
      );
    })
  );
  it.effect("retains a split multi-byte suffix until its terminating newline", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFile("/journal", new Uint8Array([0x34, 0x32, 0x0a, 0xe2]));
      assert.strictEqual((yield* readRangeWindow(shortReads(fs, 1), "/journal", 0, 4, 0)).text, "42\n");
      assertFailure(
        (yield* Effect.result(readTail(shortReads(fs, 1), "/journal", 100, 0))).pipe(
          Result.mapError((error) => error._tag)
        ),
        "InvalidUtf8"
      );
      yield* fs.writeFile("/journal", new Uint8Array([0x34, 0x32, 0x0a, 0xe2, 0x82, 0xac, 0x0a]));
      assert.strictEqual((yield* readRangeWindow(shortReads(fs, 1), "/journal", 0, 7, 0)).text, "42\n€\n");
    })
  );
  it.effect("skips a leading cursor fragment as bytes before strict decoding", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFileString("/journal", "😀\n42\n");
      const window = yield* readRangeWindow(shortReads(fs, 1), "/journal", 1, 7, 0, true);
      assert.strictEqual(window.text, "42\n");
      assert.strictEqual(window.start, 5);
      assert.strictEqual(window.size, 8);
      const partial = yield* readRangeWindow(fs, "/journal", 1, 2, 0, true);
      assert.strictEqual(partial.text, "");
      assert.strictEqual(partial.start, 3);
    })
  );
  it.effect("preserves TextEncoder's valid replacement for a lone UTF-16 surrogate", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      const bytes = new TextEncoder().encode("\ud800\n");
      yield* fs.writeFile("/journal", bytes);
      const window = yield* readRangeWindow(fs, "/journal", 0, bytes.length, 0);
      assert.strictEqual(window.text, "�\n");
      assert.strictEqual(window.size, 4);
    })
  );
});

it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid byte positions and lengths %s", (size) => {
  assert.isFalse(S.is(ByteCount)(size));
  assert.isFalse(S.is(LineSlice.fields.offset)(size));
  assert.isFalse(S.is(LineSlice.fields.end)(size));
  assert.isFalse(S.is(LineSlice.fields.length)(size));
  assert.isFalse(S.is(TailWindow.fields.start)(size));
  assert.isFalse(S.is(TailWindow.fields.size)(size));
});

it("rebases both byte cursors without changing content or termination", () => {
  const source = LineSlice.make({ offset: 2, end: 7, length: 3, text: "abc", terminated: true });
  const rebased = LineSlice.rebase(source, 10);
  assert.deepStrictEqual(rebased, LineSlice.make({ offset: 12, end: 17, length: 3, text: "abc", terminated: true }));
  assert.deepStrictEqual(LineSlice.rebase(10)(source), rebased);
  assert.strictEqual(source.offset, 2);
});

it.effect("clamps a stale BOM probe when the file shrinks below the BOM size", () =>
  Effect.gen(function* () {
    const fs = yield* MemoryFileSystem.make;
    yield* fs.writeFileString("/journal", "x");
    const window = yield* readTail(fs, "/journal", 100, 3);
    assert.strictEqual(window.text, "");
    assert.strictEqual(window.start, 0);
    assert.strictEqual(window.size, 0);
    assert.isTrue(window.atFileStart);
  })
);

it.effect("rejects overlong, surrogate and isolated continuation encodings before a valid tail", () =>
  Effect.gen(function* () {
    const fs = yield* MemoryFileSystem.make;
    for (const invalid of [[0xc0, 0xaf], [0xed, 0xa0, 0x80], [0x80], [0xf4, 0x90, 0x80, 0x80]]) {
      const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x22, ...invalid, 0x22, 0x0a, 0x34, 0x32, 0x0a]);
      yield* fs.writeFile("/journal", bytes);
      const result = yield* Effect.result(readRangeWindow(shortReads(fs, 1), "/journal", 3, bytes.length - 3, 3));
      const error = result.pipe(Result.getFailure, O.getOrThrow);
      if (!S.is(InvalidUtf8)(error)) return assert.fail("expected InvalidUtf8");
      assert.strictEqual(
        error.offset,
        3,
        "the error identifies the physical decoded range start, not the precise corrupt byte"
      );
    }
  })
);
