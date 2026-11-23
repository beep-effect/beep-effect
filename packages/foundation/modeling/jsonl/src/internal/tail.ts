/**
 * Internal JSONL file and byte helpers.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $JsonlId } from "@beep/identity/packages";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { InvalidUtf8, JournalResync, JournalResyncReason } from "../JsonlError.ts";
import { ByteCount } from "../LineSlice.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as PlatformError from "effect/PlatformError";
import type * as Scope from "effect/Scope";

const $I = $JsonlId.create("internal/tail");

const UTF8_BOM_BYTES = Tuple.make(0xef, 0xbb, 0xbf);

const LF = 0x0a;

/**
 * The default tail window.
 *
 * **Details**
 *
 * Large enough that a snapshot journal's last line is almost always inside it
 * on the first read, small enough that reading it is cheap against a journal of
 * any age. When it misses, {@link readTail} widens rather than failing.
 *
 * **Example** (Inspect the initial read budget)
 *
 * ```ts import.meta.vitest name="Inspect the initial read budget"
 * import { DEFAULT_WINDOW } from "@beep/jsonl/internal/tail";
 * DEFAULT_WINDOW // => 8192
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_WINDOW = 8192;

/**
 * A decoded tail window.
 *
 * **Example** (Describe a complete tail window)
 *
 * ```ts import.meta.vitest name="Describe a complete tail window"
 * import { TailWindow } from "@beep/jsonl/internal/tail";
 * const window = TailWindow.make({text:"42\n",start:0,size:3,atFileStart:true});
 * window.size // => 3
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class TailWindow extends S.Opaque<TailWindow, { readonly brand: unique symbol }>()(
  S.Struct({ text: S.String, start: ByteCount, atFileStart: S.Boolean, size: ByteCount }).pipe(
    $I.annoteSchema("TailWindow", {
      description: "A tail read beginning at a line boundary, with post-BOM offsets.",
    })
  )
) {}

const hasBom = (bytes: Uint8Array): boolean =>
  bytes.length >= 3 &&
  bytes[0] === UTF8_BOM_BYTES[0] &&
  bytes[1] === UTF8_BOM_BYTES[1] &&
  bytes[2] === UTF8_BOM_BYTES[2];

const readAtMost: {
  (file: FileSystem.File, length: number): Effect.Effect<Uint8Array, PlatformError.PlatformError>;
  (length: number): (file: FileSystem.File) => Effect.Effect<Uint8Array, PlatformError.PlatformError>;
} = dual(
  2,
  Effect.fn("Jsonl.readBytes")(function* (file: FileSystem.File, length: number) {
    const bytes = new Uint8Array(length);
    let offset = 0;
    while (offset < length) {
      const chunk = yield* file.readAlloc(Math.min(length - offset, READ_CHUNK_BYTES));
      if (O.isNone(chunk) || chunk.value.length === 0) break;
      bytes.set(chunk.value, offset);
      offset += chunk.value.length;
    }
    return bytes.subarray(0, offset);
  })
);

const afterFirstNewlineOrEnd = (bytes: Uint8Array): number => {
  const newline = bytes.indexOf(LF);
  return newline === -1 ? bytes.length : newline + 1;
};

const decodeLogicalWindow: {
  (
    path: string,
    bytes: Uint8Array,
    from: number,
    bomBytes: number,
    skipPartialLine: boolean,
    completeOnly: boolean
  ): Effect.Effect<TailWindow, InvalidUtf8>;
  (
    bytes: Uint8Array,
    from: number,
    bomBytes: number,
    skipPartialLine: boolean,
    completeOnly: boolean
  ): (path: string) => Effect.Effect<TailWindow, InvalidUtf8>;
} = dual(
  6,
  Effect.fn("Jsonl.windowOf")(function* (
    path: string,
    bytes: Uint8Array,
    from: number,
    bomBytes: number,
    skipPartialLine: boolean,
    completeOnly: boolean
  ): Effect.fn.Return<TailWindow, InvalidUtf8> {
    // decision: tail-typed-array-byte-scans
    const cursor = skipPartialLine ? afterFirstNewlineOrEnd(bytes) : 0;
    const end = completeOnly ? bytes.lastIndexOf(LF) + 1 : bytes.length;
    const text = yield* Effect.try({
      try: () =>
        new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(bytes.subarray(cursor, end)),
      catch: (cause) => InvalidUtf8.make({ path, offset: from + cursor, cause }),
    });
    return TailWindow.make({
      text,
      start: from + cursor - bomBytes,
      size: from + bytes.length - bomBytes,
      atFileStart: from === bomBytes,
    });
  })
);

const readWindow: {
  (
    fs: FileSystem.FileSystem,
    path: string,
    from: number,
    length: number,
    bomBytes: number,
    skipPartialLine: boolean,
    completeOnly: boolean
  ): Effect.Effect<TailWindow, PlatformError.PlatformError | InvalidUtf8>;
  (
    path: string,
    from: number,
    length: number,
    bomBytes: number,
    skipPartialLine: boolean,
    completeOnly: boolean
  ): (fs: FileSystem.FileSystem) => Effect.Effect<TailWindow, PlatformError.PlatformError | InvalidUtf8>;
} = dual(
  7,
  Effect.fn("Jsonl.readWindow")(function* (
    fs: FileSystem.FileSystem,
    path: string,
    from: number,
    length: number,
    bomBytes: number,
    skipPartialLine: boolean,
    completeOnly: boolean
  ): Effect.fn.Return<TailWindow, PlatformError.PlatformError | InvalidUtf8, Scope.Scope> {
    const file = yield* fs.open(path, { flag: "r" });
    yield* file.seek(BigInt(from), "start");
    const bytes = yield* readAtMost(file, length);
    return yield* decodeLogicalWindow(path, bytes, from, bomBytes, skipPartialLine, completeOnly);
  }, Effect.scoped)
);

/**
 * Decode complete records in a captured absolute byte range.
 *
 * **Details**
 *
 * A leading cursor fragment is discarded in bytes when requested, before strict
 * UTF-8 decoding. Every byte after the final newline is withheld without decoding
 * so a live writer can finish its suffix. The window start and size are logical
 * post-BOM offsets; size records the actual byte end read, including withheld bytes.
 *
 * **Example** (Hold an unfinished multi-byte suffix)
 * ```ts
 * import { readRangeWindow } from "@beep/jsonl/internal/tail";
 * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
 * import * as Effect from "effect/Effect";
 * const program = Effect.gen(function* () {
 *   const fs = yield* MemoryFileSystem.make;
 *   yield* fs.writeFile("/events.jsonl", new Uint8Array([0x34, 0x32, 0x0a, 0xe2]));
 *   const window = yield* readRangeWindow(fs, "/events.jsonl", 0, 4, 0);
 *   window.text // => "42\n"
 *   window.size // => 4
 * });
 * await Effect.runPromise(program);
 * ```
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const readRangeWindow: {
  (
    fs: FileSystem.FileSystem,
    path: string,
    from: number,
    length: number,
    bomBytes: number,
    skipPartialLine?: boolean
  ): Effect.Effect<TailWindow, PlatformError.PlatformError | InvalidUtf8>;
  (
    path: string,
    from: number,
    length: number,
    bomBytes: number,
    skipPartialLine?: boolean
  ): (fs: FileSystem.FileSystem) => Effect.Effect<TailWindow, PlatformError.PlatformError | InvalidUtf8>;
} = dual(
  (args) => P.isObject(args[0]),
  Effect.fn("Jsonl.readRangeWindow")(
    (
      fs: FileSystem.FileSystem,
      path: string,
      from: number,
      length: number,
      bomBytes: number,
      skipPartialLine = false
    ) => readWindow(fs, path, from, length, bomBytes, skipPartialLine, true)
  )
);

/**
 * One bounded page of a historical range, read through the handle a reader
 * opened when it sampled the range.
 *
 * **Details**
 *
 * `from` is the page's physical offset and `length` the bytes it must cover;
 * both stay inside the sampled range. `sampledEnd` is that range's logical
 * end, reported as `JournalResync.expected` when the file no longer holds the
 * page. `skipPartialLine` discards a leading cursor fragment, as for
 * {@link readRangeWindow}.
 *
 * **Example** (Describe the first page of a sampled range)
 * ```ts import.meta.vitest name="Describe the first page of a sampled range"
 * import { SampledRange } from "@beep/jsonl/internal/tail";
 * const page = SampledRange.make({
 *   path: "events.jsonl", from: 0, length: 4, bomBytes: 0, sampledEnd: 4, skipPartialLine: false,
 * });
 * page.sampledEnd // => 4
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class SampledRange extends S.Opaque<SampledRange, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    from: ByteCount,
    length: ByteCount,
    bomBytes: ByteCount,
    sampledEnd: ByteCount,
    skipPartialLine: S.Boolean,
  }).pipe(
    $I.annoteSchema("SampledRange", {
      description: "One bounded page of a sampled historical range, read through the reader's pinned handle.",
    })
  )
) {}

/**
 * Decode one page of a sampled range through an already open handle.
 *
 * **Details**
 *
 * The handle is the one the reader opened when it sampled the range, so a file
 * renamed over the path afterwards cannot leak into the read: the handle still
 * names the sampled file. Every byte of the page lies inside that sample, so a
 * read that reaches end of file first means the file shrank beneath the reader;
 * it fails `JournalResync` (truncated) with the sampled logical end as
 * `expected` and the handle's current logical size as `actual`, rather than
 * ending the read early as if the history were complete. Like
 * {@link readRangeWindow}, bytes after the final newline are withheld.
 *
 * **Example** (Fail a page the file no longer holds)
 * ```ts
 * import { readSampledWindow } from "@beep/jsonl/internal/tail";
 * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
 * import * as Effect from "effect/Effect";
 * const program = Effect.gen(function* () {
 *   const fs = yield* MemoryFileSystem.make;
 *   yield* fs.writeFileString("/events.jsonl", "1\n2\n");
 *   const file = yield* fs.open("/events.jsonl", { flag: "r" });
 *   const page = { path: "/events.jsonl", from: 0, length: 4, bomBytes: 0, sampledEnd: 4, skipPartialLine: false };
 *   const window = yield* readSampledWindow(file, page);
 *   window.text // => "1\n2\n"
 *   yield* fs.writeFileString("/events.jsonl", "");
 *   const error = yield* Effect.flip(readSampledWindow(file, page));
 *   error._tag // => "JournalResync"
 * });
 * await Effect.runPromise(Effect.scoped(program));
 * ```
 *
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const readSampledWindow: {
  (
    file: FileSystem.File,
    page: SampledRange
  ): Effect.Effect<TailWindow, PlatformError.PlatformError | InvalidUtf8 | JournalResync>;
  (
    page: SampledRange
  ): (file: FileSystem.File) => Effect.Effect<TailWindow, PlatformError.PlatformError | InvalidUtf8 | JournalResync>;
} = dual(
  2,
  Effect.fn("Jsonl.readSampledWindow")(function* (
    file: FileSystem.File,
    page: SampledRange
  ): Effect.fn.Return<TailWindow, PlatformError.PlatformError | InvalidUtf8 | JournalResync> {
    yield* file.seek(BigInt(page.from), "start");
    const bytes = yield* readAtMost(file, page.length);
    if (bytes.length < page.length) {
      const info = yield* file.stat;
      return yield* JournalResync.make({
        path: page.path,
        reason: JournalResyncReason.Enum.truncated,
        expected: page.sampledEnd,
        actual: Math.max(0, ByteSize.toNumberUnsafe(info.size) - page.bomBytes),
      });
    }
    return yield* decodeLogicalWindow(page.path, bytes, page.from, page.bomBytes, page.skipPartialLine, true);
  })
);

/**
 * The BOM width of an open file, read through its handle.
 *
 * **Details**
 *
 * A reader that takes the BOM width, the size and the identity from one handle
 * holds three facts about one file. Probing the path again for any of them can
 * describe a file that was renamed over it in between, and a BOM width applied
 * to the wrong file shifts every offset it yields by three bytes. The handle is
 * left positioned just past the bytes it read.
 *
 * **Example** (Read a BOM width through an open handle)
 * ```ts
 * import { handleBomBytes } from "@beep/jsonl/internal/tail";
 * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
 * import * as Effect from "effect/Effect";
 * const program = Effect.gen(function* () {
 *   const fs = yield* MemoryFileSystem.make;
 *   yield* fs.writeFileString("/events.jsonl", "\ufeff42\n");
 *   const file = yield* fs.open("/events.jsonl", { flag: "r" });
 *   // A rename over the path cannot change what this handle reports.
 *   yield* fs.writeFileString("/next.jsonl", "42\n");
 *   yield* fs.rename("/next.jsonl", "/events.jsonl");
 *   const bytes = yield* handleBomBytes(file);
 *   bytes // => 3
 * });
 * await Effect.runPromise(Effect.scoped(program));
 * ```
 *
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const handleBomBytes: (file: FileSystem.File) => Effect.Effect<number, PlatformError.PlatformError> = Effect.fn(
  "Jsonl.handleBomBytes"
)(function* (file: FileSystem.File) {
  yield* file.seek(BigInt(0), "start");
  const bytes = yield* readAtMost(file, UTF8_BOM_BYTES.length);
  return hasBom(bytes) ? UTF8_BOM_BYTES.length : 0;
});

/**
 * Probe the first three bytes of a file for a BOM.
 *
 * **Details**
 *
 * This is a property of the FILE, so it is read once from the start rather than
 * inferred from whatever window happens to be in hand. Inferring it from window
 * position was a real defect: a BOM'd journal larger than the window never has
 * a window at offset 0, so every offset it emitted was physical — silently off
 * by three against a file the package itself had described as post-BOM.
 *
 * **Example** (Detect a leading UTF-8 BOM)
 *
 * ```ts
 * import { probeBomBytes } from "@beep/jsonl/internal/tail";
 * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
 * import * as Effect from "effect/Effect";
 * const program = Effect.gen(function* () {
 *   const fs = yield* MemoryFileSystem.make;
 *   yield* fs.writeFileString("/events.jsonl", "\ufeff42\n");
 *   const bytes = yield* probeBomBytes(fs,"/events.jsonl");
 *   bytes // => 3
 * });
 * await Effect.runPromise(program);
 * ```
 *
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const probeBomBytes: {
  (fs: FileSystem.FileSystem, path: string): Effect.Effect<number, PlatformError.PlatformError>;
  (path: string): (fs: FileSystem.FileSystem) => Effect.Effect<number, PlatformError.PlatformError>;
} = dual(
  2,
  Effect.fn("Jsonl.probeBomBytes")(function* (
    fs: FileSystem.FileSystem,
    path: string
  ): Effect.fn.Return<number, PlatformError.PlatformError, Scope.Scope> {
    const file = yield* fs.open(path, { flag: "r" });
    return yield* handleBomBytes(file);
  }, Effect.scoped)
);

/**
 * Read the last `window` bytes of a journal, decoded from a line boundary.
 *
 * **Details**
 *
 * Three disciplines, each load-bearing:
 *
 * 1. **Start at a line boundary.** Unless the window reaches offset 0, the
 *    leading partial line is discarded — everything up to and including the
 *    first `\n`. This is also what makes the decode safe across a chunk
 *    boundary: `\n` is `0x0A` and **cannot** appear inside a UTF-8 multi-byte
 *    sequence, so a window that starts just past one starts on a character
 *    boundary too. No separate mid-character guard is needed.
 * 2. **Strip exactly one leading BOM, at the byte level**, and only when the
 *    window genuinely starts at file offset 0. Reads here are offset-based, so
 *    an implicit strip (as `readFileString` performs) would desynchronize every
 *    offset the package emits; doing it explicitly keeps the convention stated.
 *    A `U+FEFF` anywhere else is content and is left alone.
 * 3. **Never read the whole file** unless the file is smaller than the window.
 *
 * `completeOnly` withholds every suffix beyond the last newline before strict
 * UTF-8 decoding; Journal seed reads enable it. The default raw window retains
 * valid unterminated text and fails typed when its bytes are not complete UTF-8.
 *
 * **`window` is not clamped**: a last-valid search widens when its initial
 * window does not contain a complete record. Successful short reads are
 * aggregated up to the sampled byte count or EOF before decoding. File BOM
 * bytes are skipped explicitly; a content U+FEFF at a window boundary survives.
 *
 * **Example** (Read a complete tail window)
 *
 * ```ts
 * import { readTail } from "@beep/jsonl/internal/tail";
 * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
 * import * as Effect from "effect/Effect";
 * const program = Effect.gen(function* () {
 *   const fs = yield* MemoryFileSystem.make;
 *   yield* fs.writeFileString("/events.jsonl", "\ufeff42\n");
 *   const window = yield* readTail(fs,"/events.jsonl",8192,3);
 *   window.text // => "42\n"
 * });
 * await Effect.runPromise(program);
 * ```
 *
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const readTail: {
  (
    fs: FileSystem.FileSystem,
    path: string,
    window: number,
    bomBytes: number,
    completeOnly?: boolean
  ): Effect.Effect<TailWindow, PlatformError.PlatformError | InvalidUtf8>;
  (
    path: string,
    window: number,
    bomBytes: number,
    completeOnly?: boolean
  ): (fs: FileSystem.FileSystem) => Effect.Effect<TailWindow, PlatformError.PlatformError | InvalidUtf8>;
} = dual(
  (args) => P.isObject(args[0]),
  Effect.fn("Jsonl.readTail")(function* (
    fs: FileSystem.FileSystem,
    path: string,
    window: number,
    bomBytes: number,
    completeOnly = false
  ): Effect.fn.Return<TailWindow, PlatformError.PlatformError | InvalidUtf8> {
    const info = yield* fs.stat(path);
    const physicalSize = ByteSize.toNumberUnsafe(info.size);
    const contentStart = Math.min(bomBytes, physicalSize);
    const from = Math.min(physicalSize, Math.max(contentStart, physicalSize - window));
    return yield* readWindow(fs, path, from, physicalSize - from, contentStart, from !== contentStart, completeOnly);
  })
);

/**
 * Read widening windows until `decode` finds something, or the whole file has
 * been seen.
 *
 * **Details**
 *
 * The widening is what makes the bounded read *correct* rather than merely
 * cheap: a journal whose last line is longer than the initial window would
 * otherwise report "no valid envelope" for a perfectly healthy file.
 *
 * **Example** (Widen a tail search)
 *
 * ```ts
 * import { readTailUntil } from "@beep/jsonl/internal/tail";
 * import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
 * import { Line } from "@beep/jsonl/Line";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * const program = Effect.gen(function* () {
 *   const fs = yield* MemoryFileSystem.make;
 *   yield* fs.writeFileString("/events.jsonl", "\ufeff42\n");
 *   const found = yield* readTailUntil(fs,"/events.jsonl",3,(window) => Line.lastValid(window.text));
 *   found.pipe(O.map((row) => row.value)) // => O.some(42)
 * });
 * await Effect.runPromise(program);
 * ```
 *
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const readTailUntil: {
  <A>(
    fs: FileSystem.FileSystem,
    path: string,
    bomBytes: number,
    decode: (window: TailWindow) => O.Option<A>,
    initialWindow?: number,
    completeOnly?: boolean
  ): Effect.Effect<O.Option<A>, PlatformError.PlatformError | InvalidUtf8>;
  <A>(
    path: string,
    bomBytes: number,
    decode: (window: TailWindow) => O.Option<A>,
    initialWindow?: number,
    completeOnly?: boolean
  ): (fs: FileSystem.FileSystem) => Effect.Effect<O.Option<A>, PlatformError.PlatformError | InvalidUtf8>;
} = dual(
  (args) => P.isObject(args[0]),
  Effect.fn("Jsonl.readTailUntil")(function* <A>(
    fs: FileSystem.FileSystem,
    path: string,
    bomBytes: number,
    decode: (window: TailWindow) => O.Option<A>,
    initialWindow = DEFAULT_WINDOW,
    completeOnly = false
  ): Effect.fn.Return<O.Option<A>, PlatformError.PlatformError | InvalidUtf8> {
    let window = initialWindow;
    for (;;) {
      const tail = yield* readTail(fs, path, window, bomBytes, completeOnly);
      const found = decode(tail);
      if (O.isSome(found)) {
        return found;
      }
      if (tail.atFileStart) {
        return O.none<A>();
      }
      window *= 4;
    }
  })
);

const READ_CHUNK_BYTES = 64 * 1024;
