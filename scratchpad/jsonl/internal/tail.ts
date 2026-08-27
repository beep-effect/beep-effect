/**
 * The bounded tail read.
 *
 * `latest` and every `lastValid`-backed read go through this: `Line.lastValid`
 * takes whole text, so "just read the file" is the easy wrong move — it makes
 * the cost of answering "what is the current state" grow with the age of the
 * journal, which is the thing this package exists to avoid.
 *
 * **Gotchas**
 *
 * This module's window discipline binds the tail reads only. The historical
 * read (`Journal`'s `readFrom`, behind `query` and the replay half of
 * `changes`) currently reads its whole requested region in one allocation
 * bounded by the file's size, and is bounded by the caller's `cursor` rather
 * than by a window. Paging it through {@link readRangeText} is
 * spencerbeggs/effected#233.
 *
 * @see {@link Line.lastValid} for the text-level walk-back these reads feed.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import type { FileSystem, PlatformError } from "effect";
import { Effect, Option } from "effect";

/** UTF-8 BOM, as bytes. `U+FEFF` encodes to these three. */
const BOM = [0xef, 0xbb, 0xbf] as const;

/** Byte value of `\n`. Cannot occur inside a UTF-8 multi-byte sequence. */
const LF = 0x0a;

/**
 * The default tail window.
 *
 * Large enough that a snapshot journal's last line is almost always inside it
 * on the first read, small enough that reading it is cheap against a journal of
 * any age. When it misses, {@link readTail} widens rather than failing.
 *
 * **Example** (Default window size)
 *
 * ```ts
 * console.log(DEFAULT_WINDOW) // 8192
 * ```
 *
 * @see {@link readTail} for the unclamped window this seeds.
 * @see {@link readTailUntil} for widening when the last line misses this window.
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_WINDOW = 8192;

/**
 * A decoded tail window of JSONL text, starting at a line boundary.
 *
 * Offsets this package hands out are relative to the post-BOM start of the
 * file, so the first line of a BOM'd journal begins at 0 exactly as it does
 * in one without. Add `start` to a `LineSlice.offset` computed over `text` to
 * get the offset in the journal.
 *
 * @see {@link readTail} for the operation that produces this window.
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface TailWindow {
	/** The decoded text of the window, starting at a line boundary. */
	readonly text: string;
	/**
	 * The **logical** byte offset the text starts at — that is, post-BOM.
	 *
	 * Offsets this package hands out are relative to the post-BOM start of the
	 * file, so the first line of a BOM'd journal begins at 0 exactly as it does
	 * in one without. Add this to a `LineSlice.offset` computed over `text` to
	 * get the offset in the journal.
	 */
	readonly start: number;
	/** Whether the window reaches the start of the file — nothing left to widen into. */
	readonly atFileStart: boolean;
	/** The journal's logical size in bytes, post-BOM. */
	readonly size: number;
}

/** Does the buffer begin with a UTF-8 BOM? */
const hasBom = (bytes: Uint8Array): boolean =>
	bytes.length >= 3 && bytes[0] === BOM[0] && bytes[1] === BOM[1] && bytes[2] === BOM[2];

/**
 * Probe the first three bytes of a file for a BOM.
 *
 * This is a property of the FILE, so it is read once from the start rather than
 * inferred from whatever window happens to be in hand. Inferring it from window
 * position was a real defect: a BOM'd journal larger than the window never has
 * a window at offset 0, so every offset it emitted was physical — silently off
 * by three against a file the package itself had described as post-BOM.
 *
 * **Gotchas**
 *
 * Do not infer BOM from window position. A journal larger than the window never
 * has a window at offset 0, and skipping this probe silently shifts every
 * cursor by 3.
 *
 * **Example** (BOM byte count from a seeded volume)
 *
 * ```ts
 * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
 * import { Effect, FileSystem } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   return yield* probeBomBytes(fs, "/mail.jsonl")
 * })
 * const layer = MemoryFileSystem.layerWith({
 *   "/mail.jsonl": "\uFEFF{\"event\":\"started\"}\n",
 * })
 * Effect.runPromise(program.pipe(Effect.provide(layer))).then(console.log)
 * // 3
 * ```
 *
 * @see {@link DEFAULT_WINDOW} for the window size that must not be used to infer BOM.
 * @see {@link Line.lastValid} for the walk-back that consumes the decoded tail text.
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const probeBomBytes = (
	fs: FileSystem.FileSystem,
	path: string,
): Effect.Effect<number, PlatformError.PlatformError, never> =>
	Effect.gen(function* () {
		const file = yield* fs.open(path, { flag: "r" });
		const head = yield* file.readAlloc(BOM.length);
		const bytes = Option.getOrElse(head, () => new Uint8Array(0));
		return hasBom(bytes) ? BOM.length : 0;
	}).pipe(Effect.scoped);

/**
 * Read the last `window` bytes of a journal, decoded from a line boundary.
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
 * **Gotchas**
 *
 * `window` is not clamped, deliberately. `Journal`'s historical read sizes its
 * window to the region it has to return, so a clamp here would silently
 * truncate that read rather than bound it. The clamp belongs with the paged
 * rewrite of that read (spencerbeggs/effected#233).
 *
 * **Example** (Window start rebases to a line boundary)
 *
 * ```ts
 * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
 * import { Effect, FileSystem } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const bom = yield* probeBomBytes(fs, "/mail.jsonl")
 *   return yield* readTail(fs, "/mail.jsonl", 8, bom)
 * })
 * const layer = MemoryFileSystem.layerWith({
 *   "/mail.jsonl": "aaaaaaa\nbbbb\n",
 * })
 * Effect.runPromise(program.pipe(Effect.provide(layer))).then((tail) => {
 *   console.log(tail.text) // "bbbb\n"
 *   console.log(tail.start) // 8
 * })
 * ```
 *
 * @see {@link probeBomBytes} for the file-level BOM count this subtracts.
 * @see {@link DEFAULT_WINDOW} for the usual first window size.
 * @see {@link Line.lastValid} for walking the decoded window text.
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const readTail = (
	fs: FileSystem.FileSystem,
	path: string,
	window: number,
	bomBytes: number,
): Effect.Effect<TailWindow, PlatformError.PlatformError, never> =>
	Effect.gen(function* () {
		const info = yield* fs.stat(path);
		const physicalSize = Number(info.size);
		// Every offset below is LOGICAL — post-BOM — on every path, whether or not
		// this particular window happens to reach the start of the file.
		const logicalSize = physicalSize - bomBytes;
		const from = Math.max(bomBytes, physicalSize - window);
		const file = yield* fs.open(path, { flag: "r" });
		yield* file.seek(from, "start");
		const read = yield* file.readAlloc(physicalSize - from);
		const bytes = Option.getOrElse(read, () => new Uint8Array(0));

		// "At file start" means at the start of the CONTENT, i.e. past the BOM.
		const windowAtFileStart = from === bomBytes;
		let cursor = 0;
		if (!windowAtFileStart) {
			// Discard the partial first line. If there is no newline in the window
			// at all, the whole window is one partial line and there is nothing
			// usable here — the caller widens.
			const newline = bytes.indexOf(LF);
			cursor = newline === -1 ? bytes.length : newline + 1;
		}

		const text = new TextDecoder().decode(bytes.subarray(cursor));
		return {
			text,
			start: from + cursor - bomBytes,
			atFileStart: windowAtFileStart,
			size: logicalSize,
		};
	}).pipe(Effect.scoped);

/**
 * Read widening windows until `decode` finds something, or the whole file has
 * been seen.
 *
 * The widening is what makes the bounded read *correct* rather than merely
 * cheap: a journal whose last line is longer than the initial window would
 * otherwise report "no valid envelope" for a perfectly healthy file.
 *
 * **Example** (Widen until the last line is inside the window)
 *
 * ```ts
 * import { Line } from "@beep/scratchpad/jsonl"
 * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
 * import { Effect, FileSystem } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const bom = yield* probeBomBytes(fs, "/mail.jsonl")
 *   return yield* readTailUntil(fs, "/mail.jsonl", bom, (window) => Line.lastValid(window.text), 4)
 * })
 * const layer = MemoryFileSystem.layerWith({
 *   "/mail.jsonl": '{"round":1}\n',
 * })
 * Effect.runPromise(program.pipe(Effect.provide(layer))).then((found) => {
 *   console.log(O.isSome(found)) // true
 * })
 * ```
 *
 * @see {@link readTail} for the unclamped window this widens.
 * @see {@link DEFAULT_WINDOW} for the usual first window size.
 * @see {@link Line.lastValid} for the typical `decode` argument.
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const readTailUntil = <A>(
	fs: FileSystem.FileSystem,
	path: string,
	bomBytes: number,
	decode: (window: TailWindow) => Option.Option<A>,
	initialWindow = DEFAULT_WINDOW,
): Effect.Effect<Option.Option<A>, PlatformError.PlatformError, never> =>
	Effect.gen(function* () {
		let window = initialWindow;
		for (;;) {
			const tail = yield* readTail(fs, path, window, bomBytes);
			const found = decode(tail);
			if (Option.isSome(found)) {
				return found;
			}
			if (tail.atFileStart) {
				// The window already covered the whole file; widening cannot help.
				return Option.none<A>();
			}
			window *= 4;
		}
	});

/**
 * Read a byte range and decode it as text, safely across chunk boundaries.
 *
 * The byte→string seam lives here, in the service layer, because `Line.split`
 * is string-in by design and the pure core must never learn about buffers.
 *
 * **Gotchas**
 *
 * `TextDecoder` is used in **streaming mode** (`{ stream: true }`) so a
 * multi-byte character split across two reads is reassembled rather than
 * mangled. A naive per-chunk `decode` corrupts any such character — a bug that
 * appears only with non-ASCII payloads at specific sizes. The final
 * `decode()` with no argument flushes any trailing partial sequence. Do not
 * decode chunks independently.
 *
 * **Example** (Read a seeded range as text)
 *
 * ```ts
 * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
 * import { Effect, FileSystem } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   return yield* readRangeText(fs, "/mail.jsonl", 0, 12)
 * })
 * const layer = MemoryFileSystem.layerWith({
 *   "/mail.jsonl": '{"round":1}\n',
 * })
 * Effect.runPromise(program.pipe(Effect.provide(layer))).then(console.log)
 * // {"round":1}\n
 * ```
 *
 * @see {@link Line.lastValid} for walking the decoded range as JSONL.
 * @see {@link readTail} for the windowed tail read that also decodes from bytes.
 * @internal
 * @category resource-management
 * @since 0.0.0
 */
export const readRangeText = (
	fs: FileSystem.FileSystem,
	path: string,
	from: number,
	length: number,
): Effect.Effect<string, PlatformError.PlatformError, never> =>
	Effect.gen(function* () {
		if (length <= 0) {
			return "";
		}
		const file = yield* fs.open(path, { flag: "r" });
		yield* file.seek(from, "start");
		const decoder = new TextDecoder();
		let text = "";
		let remaining = length;
		while (remaining > 0) {
			const chunk = yield* file.readAlloc(Math.min(remaining, CHUNK));
			if (Option.isNone(chunk) || chunk.value.length === 0) {
				break;
			}
			// `stream: true` carries an incomplete trailing sequence into the next
			// call instead of emitting U+FFFD for it.
			text += decoder.decode(chunk.value, { stream: true });
			remaining -= chunk.value.length;
		}
		return text + decoder.decode();
	}).pipe(Effect.scoped);

/** Read granularity for incremental tail reads. */
const CHUNK = 64 * 1024;
