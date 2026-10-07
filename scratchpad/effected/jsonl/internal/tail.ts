/**
 * Internal JSONL file and byte helpers.
 * @packageDocumentation
 * @since 0.0.0
 */
// The bounded tail read.
//
// `latest` and every `lastValid`-backed read go through this: `Line.lastValid`
// takes whole text, so "just read the file" is the easy wrong move — it makes
// the cost of answering "what is the current state" grow with the age of the
// journal, which is the thing this package exists to avoid.
//
// Historical reads capture an absolute range and decode it through
// `readRangeWindow`, retaining their sampled start/end if another writer appends.
// Each requested range is materialized as text. Journal historical reads call
// this helper in bounded pages and emit complete envelopes between reads.

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import type * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import type * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Tuple from "effect/Tuple";
import { InvalidUtf8 } from "../JsonlError.ts";
import { ByteCount } from "../LineSlice.ts";

const $I = $ScratchpadId.create("effected/jsonl/internal/tail");

/** UTF-8 BOM, as bytes. `U+FEFF` encodes to these three. */
const BOM = Tuple.make(0xef, 0xbb, 0xbf);

/** Byte value of `\n`. Cannot occur inside a UTF-8 multi-byte sequence. */
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
 * import { DEFAULT_WINDOW } from "@beep/scratchpad/effected/jsonl/internal/tail";
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
 * import { TailWindow } from "@beep/scratchpad/effected/jsonl/internal/tail";
 * const window = TailWindow.make({text:"42\n",start:0,size:3,atFileStart:true});
 * window.size // => 3
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class TailWindow extends S.Class<TailWindow>($I`TailWindow`)(
  { text: S.String, start: ByteCount, atFileStart: S.Boolean, size: ByteCount },
  $I.annote("TailWindow", {
    description: "A tail read beginning at a line boundary, with post-BOM offsets.",
  })
) {}

/** Does the buffer begin with a UTF-8 BOM? */
const hasBom = (bytes: Uint8Array): boolean =>
  bytes.length >= 3 && bytes[0] === BOM[0] && bytes[1] === BOM[1] && bytes[2] === BOM[2];

/** Read up to the bounded byte count, tolerating successful short reads. */
const readBytes = Effect.fn("Jsonl.readBytes")(function* (file: FileSystem.File, length: number) {
  const bytes = new Uint8Array(length);
  let offset = 0;
  while (offset < length) {
    const chunk = yield* file.readAlloc(Math.min(length - offset, CHUNK));
    if (O.isNone(chunk) || chunk.value.length === 0) break;
    bytes.set(chunk.value, offset);
    offset += chunk.value.length;
  }
  return bytes.subarray(0, offset);
});

const readWindow = Effect.fn("Jsonl.readWindow")(function* (
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
  const bytes = yield* readBytes(file, length);
  const cursor = skipPartialLine
    ? A.findFirstIndex(bytes, (byte) => byte === LF).pipe(
        O.map((newline) => newline + 1),
        O.getOrElse(() => bytes.length)
      )
    : 0;
  const end = completeOnly
    ? A.findLastIndex(bytes, (byte) => byte === LF).pipe(
        O.map((newline) => newline + 1),
        O.getOrElse(() => 0)
      )
    : bytes.length;
  // Discard byte fragments before decoding. A cursor can point into a UTF-8
  // sequence, and an unfinished suffix can contain a pending multi-byte code point.
  const text = yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(cursor, end)),
    catch: (cause) => InvalidUtf8.make({ path, offset: from + cursor, cause }),
  });
  return TailWindow.make({
    text,
    start: from + cursor - bomBytes,
    size: from + length - bomBytes,
    atFileStart: from === bomBytes,
  });
}, Effect.scoped);

/**
 * Decode complete records in a captured absolute byte range.
 *
 * **Details**
 *
 * A leading cursor fragment is discarded in bytes when requested, before strict
 * UTF-8 decoding. Every byte after the final newline is withheld without decoding
 * so a live writer can finish its suffix. The window start and size are logical
 * post-BOM offsets; size records the sampled range end, including withheld bytes.
 *
 * **Example** (Hold an unfinished multi-byte suffix)
 * ```ts
 * import { readRangeWindow } from "@beep/scratchpad/effected/jsonl/internal/tail";
 * import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
 * import { Effect } from "effect";
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
 * import { probeBomBytes } from "@beep/scratchpad/effected/jsonl/internal/tail";
 * import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
 * import { Effect } from "effect";
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
    const bytes = yield* readBytes(file, BOM.length);
    return hasBom(bytes) ? BOM.length : 0;
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
 * import { readTail } from "@beep/scratchpad/effected/jsonl/internal/tail";
 * import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
 * import { Effect } from "effect";
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
    // Every offset below is LOGICAL — post-BOM — on every path, whether or not
    // this particular window happens to reach the start of the file.
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
 * import { readTailUntil } from "@beep/scratchpad/effected/jsonl/internal/tail";
 * import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
 * import { Line } from "@beep/scratchpad/effected/jsonl/index";
 * import { Effect } from "effect";
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
        // The window already covered the whole file; widening cannot help.
        return O.none<A>();
      }
      window *= 4;
    }
  })
);

/** Read granularity for incremental tail reads. */
const CHUNK = 64 * 1024;
