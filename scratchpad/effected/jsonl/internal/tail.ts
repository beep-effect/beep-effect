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
// **The scope of that, honestly**: it binds the tail reads. The historical read
// (`Journal`'s `readFrom`, behind `query` and the replay half of `changes`)
// currently reads its whole requested region in one allocation bounded by the
// file's size, and is bounded by the caller's `cursor` rather than by a window.
// Paging it through `readRangeText` is spencerbeggs/effected#233; until
// that lands, this module's discipline is a property of the tail reads, not of
// every read in the service.

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
  { text: S.String, start: S.Finite, atFileStart: S.Boolean, size: S.Finite },
  $I.annote("TailWindow", {
    description: "A tail read beginning at a line boundary, with post-BOM offsets.",
  })
) {}

/** Does the buffer begin with a UTF-8 BOM? */
const hasBom = (bytes: Uint8Array): boolean =>
  bytes.length >= 3 && bytes[0] === BOM[0] && bytes[1] === BOM[1] && bytes[2] === BOM[2];

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
    const head = yield* file.readAlloc(BOM.length);
    const bytes = O.getOrElse(head, () => new Uint8Array(0));
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
 * **`window` is not clamped**, deliberately. `Journal`'s historical read sizes
 * its window to the region it has to return, so a clamp here would silently
 * truncate that read rather than bound it. The clamp belongs with the paged
 * rewrite of that read — one that emits per window and can therefore honour a
 * maximum — and is carried on spencerbeggs/effected#233, not added underneath
 * it.
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
    bomBytes: number
  ): Effect.Effect<TailWindow, PlatformError.PlatformError>;
  (
    path: string,
    window: number,
    bomBytes: number
  ): (fs: FileSystem.FileSystem) => Effect.Effect<TailWindow, PlatformError.PlatformError>;
} = dual(
  4,
  Effect.fn("Jsonl.readTail")(function* (
    fs: FileSystem.FileSystem,
    path: string,
    window: number,
    bomBytes: number
  ): Effect.fn.Return<TailWindow, PlatformError.PlatformError, Scope.Scope> {
    const info = yield* fs.stat(path);
    const physicalSize = ByteSize.toNumberUnsafe(info.size);
    // Every offset below is LOGICAL — post-BOM — on every path, whether or not
    // this particular window happens to reach the start of the file.
    const logicalSize = physicalSize - bomBytes;
    const from = Math.max(bomBytes, physicalSize - window);
    const file = yield* fs.open(path, { flag: "r" });
    yield* file.seek(BigInt(from), "start");
    const read = yield* file.readAlloc(physicalSize - from);
    const bytes = O.getOrElse(read, () => new Uint8Array(0));

    // "At file start" means at the start of the CONTENT, i.e. past the BOM.
    const windowAtFileStart = from === bomBytes;
    let cursor = 0;
    if (!windowAtFileStart) {
      // Discard the partial first line. If there is no newline in the window
      // at all, the whole window is one partial line and there is nothing
      // usable here — the caller widens.
      cursor = A.findFirstIndex(bytes, (byte) => byte === LF).pipe(
        O.map((newline) => newline + 1),
        O.getOrElse(() => bytes.length)
      );
    }

    const text = new TextDecoder().decode(bytes.subarray(cursor));
    return TailWindow.make({
      text,
      start: from + cursor - bomBytes,
      atFileStart: windowAtFileStart,
      size: logicalSize,
    });
  }, Effect.scoped)
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
    initialWindow?: number
  ): Effect.Effect<O.Option<A>, PlatformError.PlatformError>;
  <A>(
    path: string,
    bomBytes: number,
    decode: (window: TailWindow) => O.Option<A>,
    initialWindow?: number
  ): (fs: FileSystem.FileSystem) => Effect.Effect<O.Option<A>, PlatformError.PlatformError>;
} = dual(
  (args) => P.isObject(args[0]),
  Effect.fn("Jsonl.readTailUntil")(function* <A>(
    fs: FileSystem.FileSystem,
    path: string,
    bomBytes: number,
    decode: (window: TailWindow) => O.Option<A>,
    initialWindow = DEFAULT_WINDOW
  ): Effect.fn.Return<O.Option<A>, PlatformError.PlatformError> {
    let window = initialWindow;
    for (;;) {
      const tail = yield* readTail(fs, path, window, bomBytes);
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

/**
 * Read a byte range and decode it as text, safely across chunk boundaries.
 *
 * **Details**
 *
 * The byte→string seam lives here, in the service layer, because `Line.split`
 * is string-in by design and the pure core must never learn about buffers.
 *
 * `TextDecoder` is used in **streaming mode** (`{ stream: true }`) so a
 * multi-byte character split across two reads is reassembled rather than
 * mangled. A naive per-chunk `decode` corrupts any such character — a bug that
 * appears only with non-ASCII payloads at specific sizes, which is exactly the
 * kind that reaches production. The final `decode()` with no argument flushes
 * any trailing partial sequence.
 *
 * **Example** (Read a physical byte range)
 *
 * ```ts
 * import { readRangeText } from "@beep/scratchpad/effected/jsonl/internal/tail";
 * import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
 * import { Effect } from "effect";
 * const program = Effect.gen(function* () {
 *   const fs = yield* MemoryFileSystem.make;
 *   yield* fs.writeFileString("/events.jsonl", "\ufeff42\n");
 *   const text = yield* readRangeText(fs,"/events.jsonl",3,3);
 *   text // => "42\n"
 * });
 * await Effect.runPromise(program);
 * ```
 *
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const readRangeText: {
  (
    fs: FileSystem.FileSystem,
    path: string,
    from: number,
    length: number
  ): Effect.Effect<string, PlatformError.PlatformError>;
  (
    path: string,
    from: number,
    length: number
  ): (fs: FileSystem.FileSystem) => Effect.Effect<string, PlatformError.PlatformError>;
} = dual(
  4,
  Effect.fn("Jsonl.readRangeText")(function* (
    fs: FileSystem.FileSystem,
    path: string,
    from: number,
    length: number
  ): Effect.fn.Return<string, PlatformError.PlatformError, Scope.Scope> {
    if (length <= 0) {
      return "";
    }
    const file = yield* fs.open(path, { flag: "r" });
    yield* file.seek(BigInt(from), "start");
    const decoder = new TextDecoder();
    let text = "";
    let remaining = length;
    while (remaining > 0) {
      const chunk = yield* file.readAlloc(Math.min(remaining, CHUNK));
      if (O.isNone(chunk) || chunk.value.length === 0) {
        break;
      }
      // `stream: true` carries an incomplete trailing sequence into the next
      // call instead of emitting U+FFFD for it.
      text += decoder.decode(chunk.value, { stream: true });
      remaining -= chunk.value.length;
    }
    return text + decoder.decode();
  }, Effect.scoped)
);

/** Read granularity for incremental tail reads. */
const CHUNK = 64 * 1024;
